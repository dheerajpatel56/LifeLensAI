"""Dataset selection, demo loading, CSV import/export and preview."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.constants import DATASET_SOURCES, SOURCE_LABELS
from app.db.database import get_db
from app.db.schemas import (
    ActiveDataset,
    DatasetPreview,
    DatasetSelect,
    DatasetSummary,
    DemoLoadReport,
    ImportReport,
)
from app.services import dataset_service

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


@router.get("/active", response_model=ActiveDataset)
def get_active(db: Session = Depends(get_db)) -> ActiveDataset:
    return dataset_service.active_dataset(db)


@router.post("/active", response_model=ActiveDataset)
def select_active(payload: DatasetSelect, db: Session = Depends(get_db)) -> ActiveDataset:
    try:
        dataset_service.set_active_source(db, payload.source)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return dataset_service.active_dataset(db)


@router.get("/summary", response_model=DatasetSummary)
def get_summary(
    source: str | None = Query(default=None), db: Session = Depends(get_db)
) -> DatasetSummary:
    if source and source not in DATASET_SOURCES:
        raise HTTPException(status_code=422, detail=f"unknown dataset source '{source}'")
    return dataset_service.dataset_summary(db, source)


@router.get("/preview", response_model=DatasetPreview)
def get_preview(
    source: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> DatasetPreview:
    if source and source not in DATASET_SOURCES:
        raise HTTPException(status_code=422, detail=f"unknown dataset source '{source}'")
    rows, columns, total, resolved = dataset_service.preview_rows(db, source, limit, offset)
    return DatasetPreview(
        source=resolved,  # type: ignore[arg-type]
        columns=columns,
        rows=rows,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/demo", response_model=DemoLoadReport)
def load_demo(
    replace: bool = Query(default=False, description="clear demo rows first"),
    db: Session = Depends(get_db),
) -> DemoLoadReport:
    try:
        return dataset_service.load_demo_dataset(db, replace=replace, activate=True)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/upload", response_model=ImportReport)
async def upload_csv(
    file: UploadFile = File(...),
    column_map: str | None = Form(default=None),
    replace_existing: bool = Form(default=True),
    activate: bool = Form(default=True),
    db: Session = Depends(get_db),
) -> ImportReport:
    settings = get_settings()
    filename = file.filename or "upload.csv"
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=422, detail="only .csv files are accepted")

    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"file exceeds the {settings.max_upload_mb} MB limit",
        )

    overrides: dict[str, str] | None = None
    if column_map:
        try:
            parsed = json.loads(column_map)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=422, detail="column_map must be valid JSON") from exc
        if not isinstance(parsed, dict):
            raise HTTPException(status_code=422, detail="column_map must be a JSON object")
        overrides = {str(k): str(v) for k, v in parsed.items() if v}

    try:
        return dataset_service.import_csv(
            db,
            content=content,
            filename=filename,
            column_overrides=overrides,
            replace_existing=replace_existing,
            activate=activate,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/export")
def export(
    source: str | None = Query(default=None), db: Session = Depends(get_db)
) -> Response:
    if source and source not in DATASET_SOURCES:
        raise HTTPException(status_code=422, detail=f"unknown dataset source '{source}'")
    csv_text, resolved = dataset_service.export_csv(db, source)
    filename = f"lifelens-{resolved}.csv"
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/{source}", response_model=dict)
def reset(source: str, db: Session = Depends(get_db)) -> dict[str, object]:
    """Delete every record for one source. Deliberate and confirmed in the UI."""
    if source not in DATASET_SOURCES:
        raise HTTPException(status_code=422, detail=f"unknown dataset source '{source}'")
    removed = dataset_service.reset_source(db, source)
    return {
        "source": source,
        "removed": removed,
        "message": f"Removed {removed} record(s) from {SOURCE_LABELS[source]}.",
    }
