"""Dashboard metrics, trends and scatter series — all computed from the active data."""

from __future__ import annotations

import pandas as pd

from app.core.constants import (
    FIELD_LABELS,
    FIELD_UNITS,
    MIN_CLUSTERING_ROWS,
    OUTCOME_FIELDS,
)
from app.db.schemas import (
    DataSufficiency,
    MetricValue,
    ScatterPoint,
    ScatterSeries,
    TrendPoint,
)
from app.services.preprocessing import clean_frame

# Metrics shown on the overview, in display order.
OVERVIEW_METRICS: tuple[str, ...] = (
    "mood_score",
    "productivity_score",
    "sleep_hours",
    "stress_score",
    "screen_time_hours",
)

TREND_FIELDS: tuple[str, ...] = (
    "mood_score",
    "productivity_score",
    "sleep_hours",
    "stress_score",
    "screen_time_hours",
)

MINIMUM_RECOMMENDED_RECORDS = 30


def compute_metrics(frame: pd.DataFrame) -> list[MetricValue]:
    """Mean of each overview metric, with the sample size it was computed on."""
    metrics: list[MetricValue] = []
    for field in OVERVIEW_METRICS:
        if field in frame.columns:
            series = pd.to_numeric(frame[field], errors="coerce").dropna()
        else:
            series = pd.Series(dtype=float)
        metrics.append(
            MetricValue(
                key=field,
                label=FIELD_LABELS.get(field, field),
                value=None if series.empty else round(float(series.mean()), 2),
                unit=FIELD_UNITS.get(field),
                sample_size=int(series.size),
            )
        )
    return metrics


def compute_trend(
    frame: pd.DataFrame, max_points: int = 120
) -> tuple[list[TrendPoint], str]:
    """Daily trend series, aggregated to a coarser grain over long ranges.

    A thousand daily points of a 1-10 self-report is visual noise, not a trend, so
    long spans are averaged into weekly or monthly buckets. The granularity is
    returned so the chart can say which one it is showing.
    """
    if frame.empty or "date" not in frame.columns:
        return [], "daily"

    working = frame.copy()
    working["date"] = pd.to_datetime(working["date"], errors="coerce")
    working = working[working["date"].notna()].sort_values("date")
    if working.empty:
        return [], "daily"

    available = [field for field in TREND_FIELDS if field in working.columns]
    if not available:
        return [], "daily"

    for field in available:
        working[field] = pd.to_numeric(working[field], errors="coerce")

    span_days = int((working["date"].max() - working["date"].min()).days) + 1
    if span_days <= max_points:
        rule, granularity = "D", "daily"
    elif span_days <= max_points * 7:
        rule, granularity = "W", "weekly"
    else:
        rule, granularity = "MS", "monthly"

    grouped = (
        working.set_index("date")[available].resample(rule).mean().dropna(how="all")
    )

    points: list[TrendPoint] = []
    for timestamp, row in grouped.iterrows():
        payload: dict[str, object] = {"date": pd.Timestamp(timestamp).date()}
        for field in available:
            value = row.get(field)
            payload[field] = None if pd.isna(value) else round(float(value), 2)
        points.append(TrendPoint(**payload))  # type: ignore[arg-type]
    return points, granularity


def compute_scatter(
    frame: pd.DataFrame, x_field: str, y_field: str, max_points: int = 600
) -> ScatterSeries | None:
    """Pairwise-complete scatter data for one pair of fields."""
    if frame.empty or x_field not in frame.columns or y_field not in frame.columns:
        return None

    x = pd.to_numeric(frame[x_field], errors="coerce")
    y = pd.to_numeric(frame[y_field], errors="coerce")
    mask = x.notna() & y.notna()
    if not bool(mask.any()):
        return None

    subset = frame[mask]
    if len(subset) > max_points:
        subset = subset.sample(max_points, random_state=42).sort_index()

    dates = (
        pd.to_datetime(subset["date"], errors="coerce") if "date" in subset.columns else None
    )
    points: list[ScatterPoint] = []
    for position in range(len(subset)):
        point_date = None
        if dates is not None:
            raw = dates.iloc[position]
            point_date = None if pd.isna(raw) else raw.date()
        points.append(
            ScatterPoint(
                x=round(float(pd.to_numeric(subset[x_field], errors="coerce").iloc[position]), 2),
                y=round(float(pd.to_numeric(subset[y_field], errors="coerce").iloc[position]), 2),
                date=point_date,
            )
        )

    return ScatterSeries(
        x_field=x_field,
        y_field=y_field,
        x_label=FIELD_LABELS.get(x_field, x_field),
        y_label=FIELD_LABELS.get(y_field, y_field),
        points=points,
        sample_size=int(mask.sum()),
    )


def recent_checkins(frame: pd.DataFrame, limit: int = 7) -> list[dict[str, object]]:
    if frame.empty or "date" not in frame.columns:
        return []
    working = frame.copy()
    working["date"] = pd.to_datetime(working["date"], errors="coerce")
    working = working[working["date"].notna()].sort_values("date", ascending=False).head(limit)

    rows: list[dict[str, object]] = []
    for _, row in working.iterrows():
        entry: dict[str, object] = {"date": row["date"].date().isoformat()}
        if "id" in working.columns and not pd.isna(row.get("id")):
            entry["id"] = int(row["id"])
        for field in ("mood_score", "productivity_score", "sleep_hours", "stress_score"):
            value = row.get(field)
            entry[field] = None if pd.isna(value) else round(float(value), 2)
        notes = row.get("notes")
        entry["notes"] = None if pd.isna(notes) or not str(notes).strip() else str(notes)
        rows.append(entry)
    return rows


def assess_sufficiency(frame: pd.DataFrame) -> DataSufficiency:
    """State plainly whether there is enough data, and what is missing if not."""
    cleaned, _ = clean_frame(frame)
    count = len(cleaned)
    missing: list[str] = []

    for field in OUTCOME_FIELDS:
        if field not in cleaned.columns or cleaned[field].notna().sum() == 0:
            missing.append(f"{FIELD_LABELS[field]} values")

    if count == 0:
        guidance = (
            "No records in the current selection. Load the demo dataset, import a CSV, "
            "or add your first daily check-in."
        )
    elif count < MIN_CLUSTERING_ROWS:
        guidance = (
            f"{count} record(s) available. Clustering needs at least {MIN_CLUSTERING_ROWS} and "
            f"correlations become meaningful from about {MINIMUM_RECOMMENDED_RECORDS}. "
            "Add more check-ins or widen the date range."
        )
    elif count < MINIMUM_RECOMMENDED_RECORDS:
        guidance = (
            f"{count} record(s) available. Clustering will run, but correlations and rules "
            f"stay provisional until roughly {MINIMUM_RECOMMENDED_RECORDS} records."
        )
    elif missing:
        guidance = (
            "Enough records, but " + " and ".join(missing) + " are missing, so the analyses "
            "that depend on them are unavailable."
        )
    else:
        guidance = f"{count} records available — every analysis on this dataset can run."

    return DataSufficiency(
        sufficient=count >= MINIMUM_RECOMMENDED_RECORDS and not missing,
        record_count=count,
        minimum_recommended=MINIMUM_RECOMMENDED_RECORDS,
        missing_requirements=missing,
        guidance=guidance,
    )
