/**
 * Single API client. Nothing in the UI talks to the backend except through here,
 * so error handling, base URL resolution and query building exist in one place.
 */

import type {
  ActiveDataset,
  CheckIn,
  CheckInPage,
  CheckInPayload,
  ClusterRequest,
  ClusterResponse,
  CorrelationRequest,
  CorrelationResponse,
  DatasetPreview,
  DatasetSource,
  DatasetSummary,
  DemoLoadReport,
  HealthResponse,
  ImportReport,
  InsightsResponse,
  OverviewResponse,
  RulesRequest,
  RulesResponse,
} from '../types/api'

// Empty default means "same origin", which the Vite dev proxy forwards to FastAPI.
const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type Query = Record<string, string | number | boolean | null | undefined>

function buildUrl(path: string, query?: Query): string {
  const search = new URLSearchParams()
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      search.set(key, String(value))
    }
  })
  const qs = search.toString()
  return `${BASE}${path}${qs ? `?${qs}` : ''}`
}

async function request<T>(path: string, init?: RequestInit, query?: Query): Promise<T> {
  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
      headers: init?.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
      ...init,
    })
  } catch {
    throw new ApiError(
      'Could not reach the LifeLens API. Is the backend running on port 8000?',
      0,
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }

  if (!response.ok) {
    const detail =
      payload && typeof payload === 'object' && 'detail' in payload
        ? String((payload as { detail: unknown }).detail)
        : typeof payload === 'string' && payload
          ? payload
          : `Request failed with status ${response.status}`
    throw new ApiError(detail, response.status)
  }

  return payload as T
}

export const api = {
  health: () => request<HealthResponse>('/api/health'),

  // --- check-ins ---------------------------------------------------------- //
  listCheckIns: (params: { limit?: number; offset?: number; start?: string; end?: string } = {}) =>
    request<CheckInPage>('/api/checkins', undefined, params),

  createCheckIn: (payload: CheckInPayload) =>
    request<CheckIn>('/api/checkins', { method: 'POST', body: JSON.stringify(payload) }),

  updateCheckIn: (id: number, payload: CheckInPayload) =>
    request<CheckIn>(`/api/checkins/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  deleteCheckIn: (id: number) => request<void>(`/api/checkins/${id}`, { method: 'DELETE' }),

  checkInByDate: (date: string) => request<CheckIn>(`/api/checkins/by-date/${date}`),

  activateUserData: () => request<{ message: string }>('/api/checkins/activate', { method: 'POST' }),

  // --- datasets ----------------------------------------------------------- //
  activeDataset: () => request<ActiveDataset>('/api/datasets/active'),

  selectDataset: (source: DatasetSource) =>
    request<ActiveDataset>('/api/datasets/active', {
      method: 'POST',
      body: JSON.stringify({ source }),
    }),

  datasetSummary: (source?: DatasetSource) =>
    request<DatasetSummary>('/api/datasets/summary', undefined, { source }),

  datasetPreview: (params: { source?: DatasetSource; limit?: number; offset?: number } = {}) =>
    request<DatasetPreview>('/api/datasets/preview', undefined, params),

  loadDemo: (replace = false) =>
    request<DemoLoadReport>('/api/datasets/demo', { method: 'POST' }, { replace }),

  uploadCsv: (file: File, options: { columnMap?: Record<string, string>; replaceExisting?: boolean } = {}) => {
    const body = new FormData()
    body.append('file', file)
    if (options.columnMap && Object.keys(options.columnMap).length > 0) {
      body.append('column_map', JSON.stringify(options.columnMap))
    }
    body.append('replace_existing', String(options.replaceExisting ?? true))
    body.append('activate', 'true')
    return request<ImportReport>('/api/datasets/upload', { method: 'POST', body })
  },

  exportUrl: (source?: DatasetSource) => buildUrl('/api/datasets/export', { source }),

  resetSource: (source: DatasetSource) =>
    request<{ removed: number; message: string }>(`/api/datasets/${source}`, { method: 'DELETE' }),

  // --- analytics ---------------------------------------------------------- //
  overview: (params: { source?: DatasetSource; start?: string; end?: string } = {}) =>
    request<OverviewResponse>('/api/analytics/overview', undefined, params),

  clusters: (body: ClusterRequest) =>
    request<ClusterResponse>('/api/analytics/clusters', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  correlations: (body: CorrelationRequest) =>
    request<CorrelationResponse>('/api/analytics/correlations', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  associationRules: (body: RulesRequest) =>
    request<RulesResponse>('/api/analytics/association-rules', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  insights: (params: {
    source?: DatasetSource
    start?: string
    end?: string
    method?: string
    n_clusters?: number
    min_support?: number
    min_confidence?: number
  } = {}) => request<InsightsResponse>('/api/insights', undefined, params),
}
