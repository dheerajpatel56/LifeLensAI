"""Health and application metadata."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.database import get_db
from app.db.schemas import HealthResponse
from app.services import dataset_service

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health(db: Session = Depends(get_db)) -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        app=settings.app_name,
        version=settings.app_version,
        tagline=settings.app_tagline,
        database="connected",
        demo_dataset_available=dataset_service.demo_csv_available(),
        record_counts=dataset_service.count_by_source(db),
        active_source=dataset_service.get_active_source(db),  # type: ignore[arg-type]
    )
