"""Pydantic request/response schemas.

All validation enforced here is also the contract the frontend types mirror. The
backend never trusts the browser: every rule below runs server-side.
"""

from __future__ import annotations

from datetime import date as date_type
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.constants import MAX_NOTES_LENGTH, SOURCE_USER

Hours = Annotated[float, Field(ge=0, le=24)]
Scale10 = Annotated[int, Field(ge=1, le=10)]
Minutes = Annotated[float, Field(ge=0, le=1440)]
Servings = Annotated[float, Field(ge=0, le=20)]


# --------------------------------------------------------------------------- #
# Check-ins
# --------------------------------------------------------------------------- #
class CheckInBase(BaseModel):
    date: date_type
    sleep_hours: Hours
    sleep_quality: Scale10
    screen_time_hours: Hours
    social_media_hours: Hours
    study_work_hours: Hours
    exercise_minutes: Minutes
    caffeine_servings: Servings
    stress_score: Scale10
    mood_score: Scale10
    productivity_score: Scale10
    notes: str | None = Field(default=None, max_length=MAX_NOTES_LENGTH)

    @field_validator("notes")
    @classmethod
    def _strip_notes(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @model_validator(mode="after")
    def _social_media_within_screen_time(self) -> "CheckInBase":
        if self.social_media_hours > self.screen_time_hours:
            raise ValueError("social_media_hours cannot exceed screen_time_hours")
        return self

    @model_validator(mode="after")
    def _day_hours_are_plausible(self) -> "CheckInBase":
        if self.sleep_hours + self.study_work_hours > 24:
            raise ValueError("sleep_hours plus study_work_hours cannot exceed 24")
        return self


class CheckInCreate(CheckInBase):
    pass


class CheckInUpdate(CheckInBase):
    pass


class CheckInOut(CheckInBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str = SOURCE_USER
    created_at: datetime
    updated_at: datetime


class CheckInPage(BaseModel):
    items: list[CheckInOut]
    total: int
    limit: int
    offset: int


# --------------------------------------------------------------------------- #
# Datasets
# --------------------------------------------------------------------------- #
DatasetSource = Literal["demo", "user", "import"]


class ColumnSummary(BaseModel):
    name: str
    label: str
    unit: str | None = None
    present: bool
    missing_count: int
    missing_pct: float
    minimum: float | None = None
    maximum: float | None = None
    mean: float | None = None


class DatasetSummary(BaseModel):
    source: DatasetSource
    source_label: str
    is_synthetic: bool
    record_count: int
    date_start: date_type | None
    date_end: date_type | None
    columns: list[ColumnSummary]
    duplicate_date_count: int
    total_missing_values: int
    has_outcome_fields: bool
    analyses_available: bool
    notes: list[str] = Field(default_factory=list)


class ActiveDataset(BaseModel):
    source: DatasetSource
    source_label: str
    is_synthetic: bool
    record_count: int
    date_start: date_type | None
    date_end: date_type | None
    available_sources: list["AvailableSource"]


class AvailableSource(BaseModel):
    source: DatasetSource
    source_label: str
    record_count: int
    is_synthetic: bool


class DatasetSelect(BaseModel):
    source: DatasetSource


class DatasetPreview(BaseModel):
    source: DatasetSource
    columns: list[str]
    rows: list[dict[str, Any]]
    total: int
    limit: int
    offset: int


class RowError(BaseModel):
    row_number: int
    field: str | None
    message: str
    value: str | None = None


class ImportReport(BaseModel):
    filename: str
    accepted: int
    rejected: int
    duplicates_within_file: int
    replaced_existing: int
    detected_columns: dict[str, str]
    unmapped_columns: list[str]
    missing_required_columns: list[str]
    missing_value_counts: dict[str, int]
    row_errors: list[RowError]
    activated: bool
    message: str


class DemoLoadReport(BaseModel):
    inserted: int
    skipped_existing: int
    total_demo_records: int
    activated: bool
    message: str


# --------------------------------------------------------------------------- #
# Analytics — shared
# --------------------------------------------------------------------------- #
class DateRange(BaseModel):
    start: date_type | None = None
    end: date_type | None = None

    @model_validator(mode="after")
    def _ordered(self) -> "DateRange":
        if self.start and self.end and self.start > self.end:
            raise ValueError("start date must be on or before end date")
        return self


class AnalyticsRequest(BaseModel):
    source: DatasetSource | None = None
    start: date_type | None = None
    end: date_type | None = None

    @model_validator(mode="after")
    def _ordered(self) -> "AnalyticsRequest":
        if self.start and self.end and self.start > self.end:
            raise ValueError("start date must be on or before end date")
        return self


# --------------------------------------------------------------------------- #
# Analytics — overview
# --------------------------------------------------------------------------- #
class MetricValue(BaseModel):
    key: str
    label: str
    value: float | None
    unit: str | None = None
    sample_size: int


class TrendPoint(BaseModel):
    date: date_type
    mood_score: float | None = None
    productivity_score: float | None = None
    sleep_hours: float | None = None
    stress_score: float | None = None
    screen_time_hours: float | None = None


class ScatterPoint(BaseModel):
    x: float
    y: float
    date: date_type | None = None


class ScatterSeries(BaseModel):
    x_field: str
    y_field: str
    x_label: str
    y_label: str
    points: list[ScatterPoint]
    sample_size: int


class OverviewResponse(BaseModel):
    source: DatasetSource
    source_label: str
    is_synthetic: bool
    record_count: int
    filtered_count: int
    date_start: date_type | None
    date_end: date_type | None
    metrics: list[MetricValue]
    trend: list[TrendPoint]
    trend_granularity: Literal["daily", "weekly", "monthly"]
    sleep_vs_productivity: ScatterSeries | None
    mood_vs_stress: ScatterSeries | None
    recent_checkins: list[dict[str, Any]]
    top_patterns: list["InsightItem"]
    cluster_distribution: list["ClusterDistributionItem"]
    data_sufficiency: "DataSufficiency"


class DataSufficiency(BaseModel):
    sufficient: bool
    record_count: int
    minimum_recommended: int
    missing_requirements: list[str]
    guidance: str


class ClusterDistributionItem(BaseModel):
    cluster_id: int
    label: str
    size: int
    share: float


# --------------------------------------------------------------------------- #
# Analytics — clustering
# --------------------------------------------------------------------------- #
class ClusterRequest(AnalyticsRequest):
    n_clusters: int = Field(default=4, ge=2, le=8)
    features: list[str] | None = None


class ClusterFeatureProfile(BaseModel):
    field: str
    label: str
    unit: str | None
    mean: float
    median: float
    overall_mean: float
    z_score: float
    direction: Literal["above", "below", "typical"]


class ClusterProfile(BaseModel):
    cluster_id: int
    label: str
    description: str
    size: int
    share: float
    features: list[ClusterFeatureProfile]


class ProjectionPoint(BaseModel):
    x: float
    y: float
    cluster_id: int
    date: date_type | None = None


class ClusterResponse(BaseModel):
    available: bool
    message: str
    source: DatasetSource
    n_clusters: int
    requested_clusters: int
    rows_used: int
    rows_dropped: int
    features_used: list[str]
    silhouette_score: float | None
    silhouette_available: bool
    inertia: float | None
    profiles: list[ClusterProfile]
    projection: list[ProjectionPoint]
    projection_explained_variance: list[float]
    limitations: list[str]


# --------------------------------------------------------------------------- #
# Analytics — correlations
# --------------------------------------------------------------------------- #
class CorrelationRequest(AnalyticsRequest):
    method: Literal["pearson", "spearman"] = "spearman"
    variables: list[str] | None = None
    target: str | None = None
    min_samples: int = Field(default=10, ge=3, le=1000)


class CorrelationPair(BaseModel):
    x_field: str
    y_field: str
    x_label: str
    y_label: str
    coefficient: float
    sample_size: int
    p_value: float | None
    strength: Literal["negligible", "weak", "moderate", "strong"]
    direction: Literal["positive", "negative", "none"]
    evidence: Literal["insufficient", "limited", "reasonable"]
    interpretation: str


class CorrelationMatrixCell(BaseModel):
    x_field: str
    y_field: str
    coefficient: float | None
    sample_size: int


class CorrelationResponse(BaseModel):
    available: bool
    message: str
    source: DatasetSource
    method: Literal["pearson", "spearman"]
    rows_considered: int
    variables: list[str]
    labels: dict[str, str]
    matrix: list[CorrelationMatrixCell]
    ranked_pairs: list[CorrelationPair]
    excluded_variables: dict[str, str]
    caveats: list[str]


# --------------------------------------------------------------------------- #
# Analytics — association rules
# --------------------------------------------------------------------------- #
class RulesRequest(AnalyticsRequest):
    min_support: float = Field(default=0.08, gt=0, le=1)
    min_confidence: float = Field(default=0.5, gt=0, le=1)
    min_lift: float = Field(default=1.0, ge=0, le=100)
    max_antecedent_size: int = Field(default=2, ge=1, le=3)
    fields: list[str] | None = None


class AssociationRule(BaseModel):
    antecedent: list[str]
    consequent: list[str]
    antecedent_text: str
    consequent_text: str
    support: float
    confidence: float
    lift: float
    antecedent_support: float
    consequent_support: float
    transaction_count: int
    matching_transactions: int
    interpretation: str


class FrequentItemset(BaseModel):
    items: list[str]
    support: float
    count: int
    size: int


class RulesResponse(BaseModel):
    available: bool
    message: str
    source: DatasetSource
    transactions: int
    min_support: float
    min_confidence: float
    min_lift: float
    bin_definitions: dict[str, dict[str, str]]
    frequent_itemsets: list[FrequentItemset]
    rules: list[AssociationRule]
    caveats: list[str]


# --------------------------------------------------------------------------- #
# Insights
# --------------------------------------------------------------------------- #
class InsightItem(BaseModel):
    id: str
    category: Literal["correlation", "association", "cluster", "summary", "data_quality"]
    kind: Literal["observation", "suggestion"]
    title: str
    detail: str
    evidence: str
    sample_size: int | None = None
    strength: str | None = None
    confidence_note: str | None = None
    related_page: str | None = None


class InsightGroup(BaseModel):
    key: str
    title: str
    description: str
    items: list[InsightItem]


class InsightsResponse(BaseModel):
    source: DatasetSource
    source_label: str
    is_synthetic: bool
    record_count: int
    generated_at: datetime
    groups: list[InsightGroup]
    disclaimers: list[str]
    data_sufficiency: DataSufficiency


# --------------------------------------------------------------------------- #
# Health
# --------------------------------------------------------------------------- #
class HealthResponse(BaseModel):
    status: Literal["ok"]
    app: str
    version: str
    tagline: str
    database: str
    demo_dataset_available: bool
    record_counts: dict[str, int]
    active_source: DatasetSource


class ErrorResponse(BaseModel):
    detail: str
    errors: list[RowError] | None = None


ActiveDataset.model_rebuild()
OverviewResponse.model_rebuild()
