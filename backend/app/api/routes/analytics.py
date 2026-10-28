"""Analytics endpoints: overview metrics, clustering, correlations, rules."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.constants import DATASET_SOURCES, SOURCE_LABELS
from app.db.database import get_db
from app.db.schemas import (
    ClusterDistributionItem,
    ClusterRequest,
    ClusterResponse,
    CorrelationRequest,
    CorrelationResponse,
    OverviewResponse,
    RulesRequest,
    RulesResponse,
)
from app.services import analytics, association_rules, clustering, correlation, dataset_service
from app.services import insight_service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _load(db: Session, request: ClusterRequest | CorrelationRequest | RulesRequest):
    if request.source and request.source not in DATASET_SOURCES:
        raise HTTPException(status_code=422, detail=f"unknown dataset source '{request.source}'")
    return dataset_service.records_frame(db, request.source, request.start, request.end)


@router.get("/overview", response_model=OverviewResponse)
def overview(
    source: str | None = Query(default=None),
    start: str | None = Query(default=None),
    end: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> OverviewResponse:
    from datetime import date as date_type

    if source and source not in DATASET_SOURCES:
        raise HTTPException(status_code=422, detail=f"unknown dataset source '{source}'")

    def parse(value: str | None) -> date_type | None:
        if not value:
            return None
        try:
            return date_type.fromisoformat(value)
        except ValueError as exc:
            raise HTTPException(
                status_code=422, detail=f"'{value}' is not a valid ISO date (YYYY-MM-DD)"
            ) from exc

    start_date, end_date = parse(start), parse(end)
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=422, detail="start date must be on or before end date")

    full_frame, resolved = dataset_service.records_frame(db, source)
    frame, _ = dataset_service.records_frame(db, source, start_date, end_date)

    metrics = analytics.compute_metrics(frame)
    trend, trend_granularity = analytics.compute_trend(frame)
    sleep_vs_productivity = analytics.compute_scatter(frame, "sleep_hours", "productivity_score")
    mood_vs_stress = analytics.compute_scatter(frame, "stress_score", "mood_score")
    sufficiency = analytics.assess_sufficiency(frame)

    # The dashboard's pattern list and cluster mix come from the same services the
    # Pattern Explorer uses, so the two pages can never disagree.
    correlations = correlation.run_correlations(frame, method="spearman", source=resolved)
    rules = association_rules.run_association_rules(frame, source=resolved)
    clusters = clustering.run_clustering(frame, n_clusters=4, source=resolved)

    distribution = [
        ClusterDistributionItem(
            cluster_id=profile.cluster_id,
            label=profile.label,
            size=profile.size,
            share=profile.share,
        )
        for profile in clusters.profiles
        if profile.size > 0
    ]

    date_start, date_end = (None, None)
    if not frame.empty and "date" in frame.columns:
        dates = frame["date"].dropna()
        if not dates.empty:
            date_start, date_end = dates.min(), dates.max()

    return OverviewResponse(
        source=resolved,  # type: ignore[arg-type]
        source_label=SOURCE_LABELS[resolved],
        is_synthetic=resolved == "demo",
        record_count=len(full_frame),
        filtered_count=len(frame),
        date_start=date_start,
        date_end=date_end,
        metrics=metrics,
        trend=trend,
        trend_granularity=trend_granularity,  # type: ignore[arg-type]
        sleep_vs_productivity=sleep_vs_productivity,
        mood_vs_stress=mood_vs_stress,
        recent_checkins=analytics.recent_checkins(frame),
        top_patterns=insight_service.top_patterns(correlations, rules),
        cluster_distribution=distribution,
        data_sufficiency=sufficiency,
    )


@router.post("/clusters", response_model=ClusterResponse)
def clusters(request: ClusterRequest, db: Session = Depends(get_db)) -> ClusterResponse:
    frame, resolved = _load(db, request)
    return clustering.run_clustering(
        frame,
        n_clusters=request.n_clusters,
        features=request.features,
        source=resolved,
    )


@router.post("/correlations", response_model=CorrelationResponse)
def correlations(request: CorrelationRequest, db: Session = Depends(get_db)) -> CorrelationResponse:
    frame, resolved = _load(db, request)
    return correlation.run_correlations(
        frame,
        method=request.method,
        variables=request.variables,
        target=request.target,
        min_samples=request.min_samples,
        source=resolved,
    )


@router.post("/association-rules", response_model=RulesResponse)
def rules(request: RulesRequest, db: Session = Depends(get_db)) -> RulesResponse:
    frame, resolved = _load(db, request)
    return association_rules.run_association_rules(
        frame,
        min_support=request.min_support,
        min_confidence=request.min_confidence,
        min_lift=request.min_lift,
        max_antecedent_size=request.max_antecedent_size,
        fields=request.fields,
        source=resolved,
    )
