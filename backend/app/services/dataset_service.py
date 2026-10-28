"""Dataset management: active selection, demo loading, CSV import and export.

Records for the three sources (`demo`, `user`, `import`) live in one table but are
never mixed: every read is filtered by source, and every write targets exactly
one source. Switching the active dataset only changes a pointer in `app_state`;
it never deletes or merges rows.
"""

from __future__ import annotations

import csv
import io
import re
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.config import DEMO_CSV_PATH, get_settings
from app.core.constants import (
    DATASET_SOURCES,
    FIELD_LABELS,
    FIELD_UNITS,
    MAX_NOTES_LENGTH,
    NUMERIC_FIELDS,
    OUTCOME_FIELDS,
    REQUIRED_FIELDS,
    SOURCE_DEMO,
    SOURCE_IMPORT,
    SOURCE_LABELS,
    SOURCE_USER,
)
from app.db.models import AppState, CheckIn, ImportBatch
from app.db.schemas import (
    ActiveDataset,
    AvailableSource,
    ColumnSummary,
    DatasetSummary,
    DemoLoadReport,
    ImportReport,
    RowError,
)
from app.utils import validation

ACTIVE_SOURCE_KEY = "active_source"
_SAFE_FILENAME = re.compile(r"[^A-Za-z0-9._-]+")


# --------------------------------------------------------------------------- #
# Active source
# --------------------------------------------------------------------------- #
def get_active_source(db: Session) -> str:
    row = db.get(AppState, ACTIVE_SOURCE_KEY)
    if row and row.value in DATASET_SOURCES:
        return row.value
    return SOURCE_DEMO


def set_active_source(db: Session, source: str) -> str:
    if source not in DATASET_SOURCES:
        raise ValueError(f"unknown dataset source '{source}'")
    row = db.get(AppState, ACTIVE_SOURCE_KEY)
    if row:
        row.value = source
        row.updated_at = datetime.now(timezone.utc)
    else:
        db.add(AppState(key=ACTIVE_SOURCE_KEY, value=source))
    db.commit()
    return source


def count_by_source(db: Session) -> dict[str, int]:
    rows = db.execute(select(CheckIn.source, func.count(CheckIn.id)).group_by(CheckIn.source)).all()
    counts = {source: 0 for source in DATASET_SOURCES}
    for source, total in rows:
        counts[source] = int(total)
    return counts


# --------------------------------------------------------------------------- #
# Reading records
# --------------------------------------------------------------------------- #
def records_frame(
    db: Session,
    source: str | None = None,
    start: date | None = None,
    end: date | None = None,
) -> tuple[pd.DataFrame, str]:
    """Load one source's records into a DataFrame, optionally date-filtered."""
    resolved = source or get_active_source(db)
    statement = select(CheckIn).where(CheckIn.source == resolved)
    if start:
        statement = statement.where(CheckIn.date >= start)
    if end:
        statement = statement.where(CheckIn.date <= end)
    statement = statement.order_by(CheckIn.date)

    rows = db.execute(statement).scalars().all()
    if not rows:
        return pd.DataFrame(columns=["id", "date", *NUMERIC_FIELDS, "notes"]), resolved

    frame = pd.DataFrame(
        [
            {
                "id": row.id,
                "date": row.date,
                "sleep_hours": row.sleep_hours,
                "sleep_quality": row.sleep_quality,
                "screen_time_hours": row.screen_time_hours,
                "social_media_hours": row.social_media_hours,
                "study_work_hours": row.study_work_hours,
                "exercise_minutes": row.exercise_minutes,
                "caffeine_servings": row.caffeine_servings,
                "stress_score": row.stress_score,
                "mood_score": row.mood_score,
                "productivity_score": row.productivity_score,
                "notes": row.notes,
            }
            for row in rows
        ]
    )
    return frame, resolved


def date_bounds(db: Session, source: str) -> tuple[date | None, date | None]:
    row = db.execute(
        select(func.min(CheckIn.date), func.max(CheckIn.date)).where(CheckIn.source == source)
    ).one()
    return row[0], row[1]


def active_dataset(db: Session) -> ActiveDataset:
    source = get_active_source(db)
    counts = count_by_source(db)
    start, end = date_bounds(db, source)
    return ActiveDataset(
        source=source,  # type: ignore[arg-type]
        source_label=SOURCE_LABELS[source],
        is_synthetic=source == SOURCE_DEMO,
        record_count=counts[source],
        date_start=start,
        date_end=end,
        available_sources=[
            AvailableSource(
                source=name,  # type: ignore[arg-type]
                source_label=SOURCE_LABELS[name],
                record_count=counts[name],
                is_synthetic=name == SOURCE_DEMO,
            )
            for name in DATASET_SOURCES
        ],
    )


def dataset_summary(db: Session, source: str | None = None) -> DatasetSummary:
    frame, resolved = records_frame(db, source)
    start, end = date_bounds(db, resolved)
    total = len(frame)

    columns: list[ColumnSummary] = []
    total_missing = 0
    for field in NUMERIC_FIELDS:
        present = field in frame.columns
        series = pd.to_numeric(frame[field], errors="coerce") if present else pd.Series(dtype=float)
        missing = int(series.isna().sum()) if total else 0
        total_missing += missing
        valid = series.dropna()
        columns.append(
            ColumnSummary(
                name=field,
                label=FIELD_LABELS.get(field, field),
                unit=FIELD_UNITS.get(field),
                present=present and not valid.empty,
                missing_count=missing,
                missing_pct=round(missing / total * 100, 2) if total else 0.0,
                minimum=None if valid.empty else round(float(valid.min()), 2),
                maximum=None if valid.empty else round(float(valid.max()), 2),
                mean=None if valid.empty else round(float(valid.mean()), 2),
            )
        )

    duplicate_dates = 0
    if total and "date" in frame.columns:
        duplicate_dates = int(frame["date"].duplicated().sum())

    has_outcomes = all(
        any(column.name == field and column.present for column in columns)
        for field in OUTCOME_FIELDS
    )

    notes: list[str] = []
    if resolved == SOURCE_DEMO:
        notes.append(
            "This is the built-in synthetic demo dataset. Every value is simulated; "
            "no relationship in it is a real-world finding."
        )
    if not has_outcomes:
        notes.append(
            "Mood and/or productivity are missing, so analyses that depend on them are unavailable."
        )
    if total == 0:
        notes.append("This dataset is empty. Add check-ins, import a CSV, or load the demo data.")

    return DatasetSummary(
        source=resolved,  # type: ignore[arg-type]
        source_label=SOURCE_LABELS[resolved],
        is_synthetic=resolved == SOURCE_DEMO,
        record_count=total,
        date_start=start,
        date_end=end,
        columns=columns,
        duplicate_date_count=duplicate_dates,
        total_missing_values=total_missing,
        has_outcome_fields=has_outcomes,
        analyses_available=total > 0 and has_outcomes,
        notes=notes,
    )


def preview_rows(
    db: Session, source: str | None, limit: int, offset: int
) -> tuple[list[dict[str, Any]], list[str], int, str]:
    frame, resolved = records_frame(db, source)
    total = len(frame)
    columns = ["date", *NUMERIC_FIELDS, "notes"]
    if total == 0:
        return [], columns, 0, resolved

    window = frame.iloc[offset : offset + limit]
    rows: list[dict[str, Any]] = []
    for _, row in window.iterrows():
        entry: dict[str, Any] = {"id": int(row["id"])}
        for column in columns:
            value = row.get(column)
            if pd.isna(value):
                entry[column] = None
            elif isinstance(value, (date, datetime)):
                entry[column] = pd.Timestamp(value).date().isoformat()
            elif column == "notes":
                entry[column] = str(value)
            else:
                entry[column] = float(value)
        rows.append(entry)
    return rows, columns, total, resolved


def export_csv(db: Session, source: str | None = None) -> tuple[str, str]:
    """Serialise one source to CSV text. Returns `(csv_text, source)`."""
    frame, resolved = records_frame(db, source)
    columns = ["date", *NUMERIC_FIELDS, "notes"]
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(["record_id", *columns])
    for _, row in frame.iterrows():
        values: list[Any] = [row.get("id")]
        for column in columns:
            value = row.get(column)
            if pd.isna(value):
                values.append("")
            elif isinstance(value, (date, datetime)):
                values.append(pd.Timestamp(value).date().isoformat())
            else:
                values.append(value)
        writer.writerow(values)
    return buffer.getvalue(), resolved


# --------------------------------------------------------------------------- #
# Demo dataset
# --------------------------------------------------------------------------- #
def demo_csv_available() -> bool:
    return DEMO_CSV_PATH.exists()


def load_demo_dataset(db: Session, replace: bool = False, activate: bool = True) -> DemoLoadReport:
    """Load `data/lifelens_demo.csv` into the `demo` source.

    Repeated calls never duplicate rows: existing demo dates are skipped unless
    `replace` is set, in which case the demo source is cleared first. User-entered
    and imported records are untouched either way.
    """
    if not DEMO_CSV_PATH.exists():
        raise FileNotFoundError(
            "data/lifelens_demo.csv is missing. Run scripts/generate_demo_dataset.py."
        )

    if replace:
        db.execute(delete(CheckIn).where(CheckIn.source == SOURCE_DEMO))
        db.commit()

    existing_dates = set(
        db.execute(select(CheckIn.date).where(CheckIn.source == SOURCE_DEMO)).scalars().all()
    )

    frame = pd.read_csv(DEMO_CSV_PATH)
    inserted = 0
    skipped = 0
    seen: set[date] = set()

    for _, row in frame.iterrows():
        try:
            row_date = validation.parse_date(row["date"])
        except ValueError:
            skipped += 1
            continue
        if row_date in existing_dates or row_date in seen:
            skipped += 1
            continue
        seen.add(row_date)

        values: dict[str, Any] = {}
        for field in NUMERIC_FIELDS:
            raw = row.get(field)
            if validation.is_blank(raw):
                values[field] = None
                continue
            try:
                values[field] = validation.parse_number(field, raw)
            except ValueError:
                values[field] = None

        notes = row.get("notes")
        db.add(
            CheckIn(
                source=SOURCE_DEMO,
                date=row_date,
                notes=None if validation.is_blank(notes) else str(notes)[:MAX_NOTES_LENGTH],
                **values,
            )
        )
        inserted += 1

    db.commit()
    total = int(
        db.execute(
            select(func.count(CheckIn.id)).where(CheckIn.source == SOURCE_DEMO)
        ).scalar_one()
    )
    if activate:
        set_active_source(db, SOURCE_DEMO)

    if replace:
        message = f"Demo dataset reloaded from scratch: {inserted} records."
    elif inserted:
        message = f"Added {inserted} demo records ({skipped} already present)."
    else:
        message = f"Demo dataset already loaded ({total} records). Nothing to add."

    return DemoLoadReport(
        inserted=inserted,
        skipped_existing=skipped,
        total_demo_records=total,
        activated=activate,
        message=message,
    )


def ensure_demo_loaded(db: Session) -> None:
    """Load demo data on first start so the app is never empty on arrival."""
    existing = db.execute(
        select(func.count(CheckIn.id)).where(CheckIn.source == SOURCE_DEMO)
    ).scalar_one()
    if not existing and demo_csv_available():
        load_demo_dataset(db, replace=False, activate=True)


# --------------------------------------------------------------------------- #
# CSV import
# --------------------------------------------------------------------------- #
def safe_filename(name: str) -> str:
    """Reduce an uploaded filename to a basename of safe characters."""
    base = Path(str(name)).name
    cleaned = _SAFE_FILENAME.sub("_", base).strip("._") or "upload.csv"
    return cleaned[:120]


def import_csv(
    db: Session,
    content: bytes,
    filename: str,
    column_overrides: dict[str, str] | None = None,
    replace_existing: bool = True,
    activate: bool = True,
    store_dir: Path | None = None,
) -> ImportReport:
    """Validate and import a CSV into the `import` source.

    The file is only ever parsed as text: nothing from it is executed, and the
    stored copy is written under a sanitised basename inside the upload directory.
    """
    settings = get_settings()
    if len(content) > settings.max_upload_bytes:
        raise ValueError(
            f"file is larger than the {settings.max_upload_mb} MB limit "
            f"({len(content) / 1024 / 1024:.1f} MB)"
        )
    if not content.strip():
        raise ValueError("the uploaded file is empty")

    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError("the file is not valid UTF-8 text — save it as CSV (UTF-8)") from exc

    try:
        frame = pd.read_csv(io.StringIO(text), dtype=str, keep_default_na=False)
    except Exception as exc:  # pandas raises several parser error types
        raise ValueError(f"could not parse the file as CSV: {exc}") from exc

    if frame.empty:
        raise ValueError("the file contains headers but no data rows")

    headers = [str(column) for column in frame.columns]
    mapping, unmapped = validation.map_columns(headers)
    if column_overrides:
        for raw_header, canonical in column_overrides.items():
            if raw_header in headers and canonical:
                mapping[raw_header] = canonical
                if raw_header in unmapped:
                    unmapped.remove(raw_header)

    canonical_columns = set(mapping.values())
    missing_required = validation.missing_required_columns(canonical_columns)

    report = ImportReport(
        filename=safe_filename(filename),
        accepted=0,
        rejected=0,
        duplicates_within_file=0,
        replaced_existing=0,
        detected_columns=mapping,
        unmapped_columns=unmapped,
        missing_required_columns=missing_required,
        missing_value_counts={},
        row_errors=[],
        activated=False,
        message="",
    )

    if missing_required:
        report.message = (
            "Import rejected: required column(s) missing — "
            + ", ".join(missing_required)
            + ". Map them from your own column names and try again."
        )
        return report

    renamed = frame.rename(columns=mapping)
    accepted_rows: list[dict[str, Any]] = []
    seen_dates: set[date] = set()
    missing_counts: dict[str, int] = {}

    for position, row in renamed.iterrows():
        row_number = int(position) + 2  # +1 for zero-index, +1 for the header line
        errors: list[RowError] = []

        try:
            row_date = validation.parse_date(row.get("date"))
        except ValueError as exc:
            report.row_errors.append(
                RowError(row_number=row_number, field="date", message=str(exc),
                         value=str(row.get("date"))[:40])
            )
            report.rejected += 1
            continue

        if row_date in seen_dates:
            report.duplicates_within_file += 1
            report.row_errors.append(
                RowError(
                    row_number=row_number,
                    field="date",
                    message=f"duplicate date {row_date.isoformat()} within the file — row skipped",
                    value=row_date.isoformat(),
                )
            )
            report.rejected += 1
            continue

        values: dict[str, Any] = {}
        for field in NUMERIC_FIELDS:
            if field not in renamed.columns:
                values[field] = None
                missing_counts[field] = missing_counts.get(field, 0) + 1
                continue
            raw = row.get(field)
            if validation.is_blank(raw):
                values[field] = None
                missing_counts[field] = missing_counts.get(field, 0) + 1
                if field in REQUIRED_FIELDS:
                    errors.append(
                        RowError(
                            row_number=row_number,
                            field=field,
                            message=f"{FIELD_LABELS.get(field, field)} is required but blank",
                        )
                    )
                continue
            try:
                values[field] = validation.parse_number(field, raw)
            except ValueError as exc:
                errors.append(
                    RowError(
                        row_number=row_number,
                        field=field,
                        message=str(exc),
                        value=str(raw)[:40],
                    )
                )

        for field, message in validation.cross_field_errors(values):
            errors.append(RowError(row_number=row_number, field=field, message=message))

        notes: str | None = None
        if "notes" in renamed.columns:
            try:
                notes = validation.validate_notes(row.get("notes"))
            except ValueError as exc:
                errors.append(RowError(row_number=row_number, field="notes", message=str(exc)))

        if errors:
            report.row_errors.extend(errors)
            report.rejected += 1
            continue

        seen_dates.add(row_date)
        accepted_rows.append({"date": row_date, "notes": notes, **values})

    report.missing_value_counts = missing_counts
    report.accepted = len(accepted_rows)

    if not accepted_rows:
        report.message = (
            f"No rows could be imported. {report.rejected} row(s) were rejected — "
            "see the row-level errors for the reason on each one."
        )
        # Trim the error list so an entirely broken file cannot flood the response.
        report.row_errors = report.row_errors[:200]
        return report

    if replace_existing:
        removed = db.execute(delete(CheckIn).where(CheckIn.source == SOURCE_IMPORT)).rowcount
        report.replaced_existing = int(removed or 0)
        db.commit()

    existing_dates = set(
        db.execute(select(CheckIn.date).where(CheckIn.source == SOURCE_IMPORT)).scalars().all()
    )
    inserted = 0
    for entry in accepted_rows:
        if entry["date"] in existing_dates:
            report.row_errors.append(
                RowError(
                    row_number=0,
                    field="date",
                    message=(
                        f"{entry['date'].isoformat()} already exists in the imported dataset "
                        "— row skipped"
                    ),
                    value=entry["date"].isoformat(),
                )
            )
            report.rejected += 1
            continue
        db.add(CheckIn(source=SOURCE_IMPORT, **entry))
        existing_dates.add(entry["date"])
        inserted += 1

    report.accepted = inserted

    stored_path: str | None = None
    target_dir = store_dir or settings.upload_path
    try:
        target_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        destination = target_dir / f"{stamp}-{report.filename}"
        destination.write_bytes(content)
        stored_path = str(destination)
    except OSError:
        # Storing the original file is a convenience, not a requirement.
        stored_path = None

    db.add(
        ImportBatch(
            filename=report.filename,
            stored_path=stored_path,
            rows_accepted=report.accepted,
            rows_rejected=report.rejected,
        )
    )
    db.commit()

    if activate:
        set_active_source(db, SOURCE_IMPORT)
        report.activated = True

    report.row_errors = report.row_errors[:200]
    report.message = (
        f"Imported {report.accepted} row(s) from {report.filename}"
        + (f", rejected {report.rejected}" if report.rejected else "")
        + (". The imported dataset is now active." if report.activated else ".")
    )
    return report


def reset_source(db: Session, source: str) -> int:
    """Delete every record for one source. Returns the number removed."""
    if source not in DATASET_SOURCES:
        raise ValueError(f"unknown dataset source '{source}'")
    removed = db.execute(delete(CheckIn).where(CheckIn.source == source)).rowcount
    db.commit()
    return int(removed or 0)
