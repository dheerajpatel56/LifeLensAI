"""Computed, explainable insights assembled from the mining services."""

from __future__ import annotations

from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.constants import DATASET_SOURCES
from app.db.database import get_db
from app.db.schemas import InsightsResponse
from app.services import association_rules, clustering, correlation, dataset_service, insight_service

router = APIRouter(prefix="/api", tags=["insights"])


@router.get("/insights", response_model=InsightsResponse)
def insights(
    source: str | None = Query(default=None),
    start: date_type | None = Query(default=None),
    end: date_type | None = Query(default=None),
    method: str = Query(default="spearman", pattern="^(pearson|spearman)$"),
    n_clusters: int = Query(default=4, ge=2, le=8),
    min_support: float = Query(default=0.08, gt=0, le=1),
    min_confidence: float = Query(default=0.5, gt=0, le=1),
    db: Session = Depends(get_db),
) -> InsightsResponse:
    if source and source not in DATASET_SOURCES:
        raise HTTPException(status_code=422, detail=f"unknown dataset source '{source}'")
    if start and end and start > end:
        raise HTTPException(status_code=422, detail="start date must be on or before end date")

    frame, resolved = dataset_service.records_frame(db, source, start, end)

    correlations = correlation.run_correlations(frame, method=method, source=resolved)
    rules = association_rules.run_association_rules(
        frame, min_support=min_support, min_confidence=min_confidence, source=resolved
    )
    clusters = clustering.run_clustering(frame, n_clusters=n_clusters, source=resolved)

    return insight_service.build_insights(frame, resolved, correlations, rules, clusters)
