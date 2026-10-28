/**
 * TypeScript mirrors of the backend Pydantic schemas in `backend/app/db/schemas.py`.
 * Keep the two in step: the API is the single source of truth for every number
 * rendered in this app.
 */

export type DatasetSource = 'demo' | 'user' | 'import'
export type CorrelationMethod = 'pearson' | 'spearman'

export interface HealthResponse {
  status: 'ok'
  app: string
  version: string
  tagline: string
  database: string
  demo_dataset_available: boolean
  record_counts: Record<DatasetSource, number>
  active_source: DatasetSource
}

export interface CheckIn {
  id: number
  source: DatasetSource
  date: string
  sleep_hours: number
  sleep_quality: number
  screen_time_hours: number
  social_media_hours: number
  study_work_hours: number
  exercise_minutes: number
  caffeine_servings: number
  stress_score: number
  mood_score: number
  productivity_score: number
  notes: string | null
  created_at: string
  updated_at: string
}

export type CheckInPayload = Omit<CheckIn, 'id' | 'source' | 'created_at' | 'updated_at'>

export interface CheckInPage {
  items: CheckIn[]
  total: number
  limit: number
  offset: number
}

export interface AvailableSource {
  source: DatasetSource
  source_label: string
  record_count: number
  is_synthetic: boolean
}

export interface ActiveDataset {
  source: DatasetSource
  source_label: string
  is_synthetic: boolean
  record_count: number
  date_start: string | null
  date_end: string | null
  available_sources: AvailableSource[]
}

export interface ColumnSummary {
  name: string
  label: string
  unit: string | null
  present: boolean
  missing_count: number
  missing_pct: number
  minimum: number | null
  maximum: number | null
  mean: number | null
}

export interface DatasetSummary {
  source: DatasetSource
  source_label: string
  is_synthetic: boolean
  record_count: number
  date_start: string | null
  date_end: string | null
  columns: ColumnSummary[]
  duplicate_date_count: number
  total_missing_values: number
  has_outcome_fields: boolean
  analyses_available: boolean
  notes: string[]
}

export interface DatasetPreview {
  source: DatasetSource
  columns: string[]
  rows: Array<Record<string, string | number | null>>
  total: number
  limit: number
  offset: number
}

export interface RowError {
  row_number: number
  field: string | null
  message: string
  value: string | null
}

export interface ImportReport {
  filename: string
  accepted: number
  rejected: number
  duplicates_within_file: number
  replaced_existing: number
  detected_columns: Record<string, string>
  unmapped_columns: string[]
  missing_required_columns: string[]
  missing_value_counts: Record<string, number>
  row_errors: RowError[]
  activated: boolean
  message: string
}

export interface DemoLoadReport {
  inserted: number
  skipped_existing: number
  total_demo_records: number
  activated: boolean
  message: string
}

export interface MetricValue {
  key: string
  label: string
  value: number | null
  unit: string | null
  sample_size: number
}

export interface TrendPoint {
  date: string
  mood_score: number | null
  productivity_score: number | null
  sleep_hours: number | null
  stress_score: number | null
  screen_time_hours: number | null
}

export interface ScatterPoint {
  x: number
  y: number
  date: string | null
}

export interface ScatterSeries {
  x_field: string
  y_field: string
  x_label: string
  y_label: string
  points: ScatterPoint[]
  sample_size: number
}

export interface DataSufficiency {
  sufficient: boolean
  record_count: number
  minimum_recommended: number
  missing_requirements: string[]
  guidance: string
}

export interface ClusterDistributionItem {
  cluster_id: number
  label: string
  size: number
  share: number
}

export interface InsightItem {
  id: string
  category: 'correlation' | 'association' | 'cluster' | 'summary' | 'data_quality'
  kind: 'observation' | 'suggestion'
  title: string
  detail: string
  evidence: string
  sample_size: number | null
  strength: string | null
  confidence_note: string | null
  related_page: string | null
}

export interface RecentCheckIn {
  id?: number
  date: string
  mood_score: number | null
  productivity_score: number | null
  sleep_hours: number | null
  stress_score: number | null
  notes: string | null
}

export interface OverviewResponse {
  source: DatasetSource
  source_label: string
  is_synthetic: boolean
  record_count: number
  filtered_count: number
  date_start: string | null
  date_end: string | null
  metrics: MetricValue[]
  trend: TrendPoint[]
  trend_granularity: 'daily' | 'weekly' | 'monthly'
  sleep_vs_productivity: ScatterSeries | null
  mood_vs_stress: ScatterSeries | null
  recent_checkins: RecentCheckIn[]
  top_patterns: InsightItem[]
  cluster_distribution: ClusterDistributionItem[]
  data_sufficiency: DataSufficiency
}

export interface ClusterFeatureProfile {
  field: string
  label: string
  unit: string | null
  mean: number
  median: number
  overall_mean: number
  z_score: number
  direction: 'above' | 'below' | 'typical'
}

export interface ClusterProfile {
  cluster_id: number
  label: string
  description: string
  size: number
  share: number
  features: ClusterFeatureProfile[]
}

export interface ProjectionPoint {
  x: number
  y: number
  cluster_id: number
  date: string | null
}

export interface ClusterResponse {
  available: boolean
  message: string
  source: DatasetSource
  n_clusters: number
  requested_clusters: number
  rows_used: number
  rows_dropped: number
  features_used: string[]
  silhouette_score: number | null
  silhouette_available: boolean
  inertia: number | null
  profiles: ClusterProfile[]
  projection: ProjectionPoint[]
  projection_explained_variance: number[]
  limitations: string[]
}

export interface CorrelationPair {
  x_field: string
  y_field: string
  x_label: string
  y_label: string
  coefficient: number
  sample_size: number
  p_value: number | null
  strength: 'negligible' | 'weak' | 'moderate' | 'strong'
  direction: 'positive' | 'negative' | 'none'
  evidence: 'insufficient' | 'limited' | 'reasonable'
  interpretation: string
}

export interface CorrelationMatrixCell {
  x_field: string
  y_field: string
  coefficient: number | null
  sample_size: number
}

export interface CorrelationResponse {
  available: boolean
  message: string
  source: DatasetSource
  method: CorrelationMethod
  rows_considered: number
  variables: string[]
  labels: Record<string, string>
  matrix: CorrelationMatrixCell[]
  ranked_pairs: CorrelationPair[]
  excluded_variables: Record<string, string>
  caveats: string[]
}

export interface AssociationRule {
  antecedent: string[]
  consequent: string[]
  antecedent_text: string
  consequent_text: string
  support: number
  confidence: number
  lift: number
  antecedent_support: number
  consequent_support: number
  transaction_count: number
  matching_transactions: number
  interpretation: string
}

export interface FrequentItemset {
  items: string[]
  support: number
  count: number
  size: number
}

export interface RulesResponse {
  available: boolean
  message: string
  source: DatasetSource
  transactions: number
  min_support: number
  min_confidence: number
  min_lift: number
  bin_definitions: Record<string, Record<string, string>>
  frequent_itemsets: FrequentItemset[]
  rules: AssociationRule[]
  caveats: string[]
}

export interface InsightGroup {
  key: string
  title: string
  description: string
  items: InsightItem[]
}

export interface InsightsResponse {
  source: DatasetSource
  source_label: string
  is_synthetic: boolean
  record_count: number
  generated_at: string
  groups: InsightGroup[]
  disclaimers: string[]
  data_sufficiency: DataSufficiency
}

export interface ClusterRequest {
  source?: DatasetSource | null
  start?: string | null
  end?: string | null
  n_clusters?: number
  features?: string[] | null
}

export interface CorrelationRequest {
  source?: DatasetSource | null
  start?: string | null
  end?: string | null
  method?: CorrelationMethod
  variables?: string[] | null
  target?: string | null
  min_samples?: number
}

export interface RulesRequest {
  source?: DatasetSource | null
  start?: string | null
  end?: string | null
  min_support?: number
  min_confidence?: number
  min_lift?: number
  max_antecedent_size?: number
  fields?: string[] | null
}
