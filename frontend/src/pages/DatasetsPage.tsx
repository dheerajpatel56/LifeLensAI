import { useRef, useState } from 'react'
import { Download, FileUp, RefreshCw, Trash2, Upload } from 'lucide-react'
import clsx from 'clsx'
import { toast } from 'sonner'
import { api, ApiError } from '../services/api'
import { useAsync } from '../hooks/useApi'
import { useDataset } from '../hooks/useDataset'
import { PageHeader } from '../components/layout/PageHeader'
import {
  Badge,
  Button,
  Callout,
  ConfirmInline,
  EmptyState,
  ErrorState,
  Panel,
  Select,
  Skeleton,
} from '../components/ui'
import { formatDate, formatNumber } from '../utils/format'
import type { DatasetSource, ImportReport } from '../types/api'

const CANONICAL_FIELDS = [
  'date',
  'sleep_hours',
  'sleep_quality',
  'screen_time_hours',
  'social_media_hours',
  'study_work_hours',
  'exercise_minutes',
  'caffeine_servings',
  'stress_score',
  'mood_score',
  'productivity_score',
  'notes',
]

const PREVIEW_PAGE = 15

export function DatasetsPage() {
  const { dataset, selectSource, markStale, refresh, version } = useDataset()
  const fileInput = useRef<HTMLInputElement>(null)

  const [offset, setOffset] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [columnMap, setColumnMap] = useState<Record<string, string>>({})
  const [resetTarget, setResetTarget] = useState<DatasetSource | null>(null)
  const [resetting, setResetting] = useState(false)
  const [reloadingDemo, setReloadingDemo] = useState(false)

  const summary = useAsync(
    () => api.datasetSummary(dataset?.source),
    [dataset?.source, version],
  )
  const preview = useAsync(
    () => api.datasetPreview({ source: dataset?.source, limit: PREVIEW_PAGE, offset }),
    [dataset?.source, offset, version],
  )

  const refreshAll = () => {
    void refresh()
    summary.reload()
    preview.reload()
    markStale()
  }

  const doUpload = async (file: File, overrides: Record<string, string> = {}) => {
    setUploading(true)
    try {
      const result = await api.uploadCsv(file, { columnMap: overrides, replaceExisting: true })
      setReport(result)
      if (result.accepted > 0) {
        toast.success(result.message)
        setPendingFile(null)
        setColumnMap({})
        setOffset(0)
        await selectSource('import')
        refreshAll()
      } else if (result.missing_required_columns.length > 0) {
        // Keep the file around so the user can map their own column names.
        setPendingFile(file)
        toast.error('Some required columns were not recognised — map them below.')
      } else {
        toast.error(result.message)
      }
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : 'The upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const handleFile = (file: File | undefined) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Only .csv files are accepted.')
      return
    }
    setReport(null)
    void doUpload(file)
  }

  const handleReloadDemo = async () => {
    setReloadingDemo(true)
    try {
      const result = await api.loadDemo(true)
      await selectSource('demo')
      refreshAll()
      toast.success(result.message)
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : 'Could not reload the demo dataset.')
    } finally {
      setReloadingDemo(false)
    }
  }

  const handleReset = async () => {
    if (!resetTarget) return
    setResetting(true)
    try {
      const result = await api.resetSource(resetTarget)
      toast.success(result.message)
      setResetTarget(null)
      refreshAll()
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : 'Could not clear that dataset.')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Datasets"
        lede="Three datasets are kept side by side and never merged: the built-in synthetic demo, the check-ins you type, and whatever CSV you import. Only one is analysed at a time."
        actions={
          <>
            <a
              href={api.exportUrl(dataset?.source)}
              download
              className="inline-flex items-center gap-2 rounded-[6px] border border-line bg-raised px-3 py-1.5 text-sm font-medium text-body no-underline transition-colors hover:border-line-strong hover:text-ink"
            >
              <Download className="size-4" aria-hidden />
              Export CSV
            </a>
            <Button
              variant="secondary"
              icon={<RefreshCw className="size-4" />}
              loading={reloadingDemo}
              onClick={() => void handleReloadDemo()}
            >
              Reload demo data
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-5">
        {/* Source picker */}
        <Panel
          title="Which dataset am I analysing?"
          description="Switching only changes what the analyses read. Nothing is deleted or merged."
        >
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]">
            {(dataset?.available_sources ?? []).map((entry) => {
              const isActive = dataset?.source === entry.source
              return (
                <button
                  key={entry.source}
                  type="button"
                  onClick={() => void selectSource(entry.source)}
                  aria-pressed={isActive}
                  className={clsx(
                    'flex flex-col items-start gap-1.5 rounded-[10px] border px-4 py-3 text-left transition-colors duration-150',
                    isActive
                      ? 'border-accent/45 bg-accent/12'
                      : 'border-line bg-surface hover:border-line-strong',
                  )}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className={clsx('text-sm font-medium', isActive ? 'text-ink' : 'text-body')}>
                      {entry.source_label}
                    </span>
                    {entry.is_synthetic && <Badge tone="warning">Synthetic</Badge>}
                    {isActive && !entry.is_synthetic && <Badge tone="accent">Active</Badge>}
                  </span>
                  <span className="tnum text-xs text-muted">
                    {entry.record_count.toLocaleString()} record(s)
                  </span>
                  {entry.record_count === 0 && (
                    <span className="text-2xs text-faint">Empty — analyses will have nothing to read</span>
                  )}
                </button>
              )
            })}
          </div>
        </Panel>

        {/* Summary */}
        <Panel
          title="Active dataset summary"
          description="Counts, column coverage and missingness for the dataset currently being analysed."
          actions={summary.data && <Badge tone="neutral">{summary.data.source_label}</Badge>}
        >
          {summary.loading && !summary.data ? (
            <Skeleton className="h-48" />
          ) : summary.error ? (
            <ErrorState message={summary.error} onRetry={summary.reload} />
          ) : summary.data ? (
            <div className="flex flex-col gap-4">
              <dl className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(9rem,1fr))]">
                {[
                  ['Records', summary.data.record_count.toLocaleString()],
                  ['First day', formatDate(summary.data.date_start)],
                  ['Last day', formatDate(summary.data.date_end)],
                  ['Duplicate dates', String(summary.data.duplicate_date_count)],
                  ['Missing values', summary.data.total_missing_values.toLocaleString()],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[10px] border border-line bg-raised px-3 py-2">
                    <dt className="text-2xs text-muted">{label}</dt>
                    <dd className="tnum mt-0.5 text-md font-semibold text-ink">{value}</dd>
                  </div>
                ))}
              </dl>

              {summary.data.notes.map((note) => (
                <Callout key={note} tone={summary.data?.is_synthetic ? 'warning' : 'neutral'}>
                  {note}
                </Callout>
              ))}

              <div className="-mx-4 overflow-x-auto sm:-mx-5">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-2xs uppercase tracking-wide text-faint">
                      <th scope="col" className="px-4 py-2 font-medium sm:px-5">Column</th>
                      <th scope="col" className="px-3 py-2 font-medium">Status</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Missing</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Min</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Mean</th>
                      <th scope="col" className="px-4 py-2 text-right font-medium sm:px-5">Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.data.columns.map((column) => (
                      <tr
                        key={column.name}
                        className="border-b border-line/60 transition-colors last:border-0 hover:bg-raised"
                      >
                        <td className="px-4 py-2 sm:px-5">
                          <span className="text-ink">{column.label}</span>
                          <span className="ml-1.5 text-2xs text-faint">{column.unit}</span>
                        </td>
                        <td className="px-3 py-2">
                          {column.present ? (
                            <Badge tone="positive">Present</Badge>
                          ) : (
                            <Badge tone="negative">Absent</Badge>
                          )}
                        </td>
                        <td className="tnum px-3 py-2 text-right text-body">
                          {column.missing_count} ({column.missing_pct}%)
                        </td>
                        <td className="tnum px-3 py-2 text-right text-muted">
                          {formatNumber(column.minimum)}
                        </td>
                        <td className="tnum px-3 py-2 text-right text-body">
                          {formatNumber(column.mean, 2)}
                        </td>
                        <td className="tnum px-4 py-2 text-right text-muted sm:px-5">
                          {formatNumber(column.maximum)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </Panel>

        {/* Import */}
        <Panel
          title="Import a CSV"
          description="Files are parsed as text only and never executed. Every rejected row is reported with the reason."
        >
          <div className="flex flex-col gap-4">
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                handleFile(event.dataTransfer.files?.[0])
              }}
              className="flex flex-col items-center gap-3 rounded-[10px] border border-dashed border-line px-6 py-8 text-center"
            >
              <FileUp className="size-5 text-muted" aria-hidden />
              <div>
                <p className="text-sm font-medium text-ink">Drop a .csv file here</p>
                <p className="measure mt-1 text-xs text-muted">
                  Needs at least <code className="text-body">date</code>,{' '}
                  <code className="text-body">sleep_hours</code>,{' '}
                  <code className="text-body">mood_score</code> and{' '}
                  <code className="text-body">productivity_score</code>. Common alternative names
                  such as <code className="text-body">sleep</code> or{' '}
                  <code className="text-body">screen_time</code> are recognised automatically.
                </p>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
              <Button
                variant="primary"
                icon={<Upload className="size-4" />}
                loading={uploading}
                onClick={() => fileInput.current?.click()}
              >
                Choose a file
              </Button>
            </div>

            {/* Column mapping appears only when the file needs it. */}
            {pendingFile && report && report.missing_required_columns.length > 0 && (
              <div className="flex flex-col gap-3 rounded-[10px] border border-warning/35 bg-warning/8 px-4 py-3.5">
                <p className="text-sm font-medium text-ink">
                  Map your columns to the fields LifeLens needs
                </p>
                <p className="measure text-xs text-body">
                  These columns in <span className="text-ink">{report.filename}</span> were not
                  recognised. Point each one at the field it holds, then import again.
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {report.unmapped_columns.map((rawColumn) => (
                    <label key={rawColumn} className="flex flex-col gap-1">
                      <span className="truncate text-xs text-muted" title={rawColumn}>
                        {rawColumn}
                      </span>
                      <Select
                        value={columnMap[rawColumn] ?? ''}
                        onChange={(event) =>
                          setColumnMap((current) => ({ ...current, [rawColumn]: event.target.value }))
                        }
                      >
                        <option value="">Ignore this column</option>
                        {CANONICAL_FIELDS.map((field) => (
                          <option key={field} value={field}>
                            {field}
                          </option>
                        ))}
                      </Select>
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    loading={uploading}
                    onClick={() => void doUpload(pendingFile, columnMap)}
                  >
                    Import with this mapping
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setPendingFile(null)
                      setColumnMap({})
                      setReport(null)
                    }}
                  >
                    Discard this file
                  </Button>
                </div>
              </div>
            )}

            {/* Validation report */}
            {report && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={report.accepted > 0 ? 'positive' : 'negative'}>
                    {report.accepted} accepted
                  </Badge>
                  <Badge tone={report.rejected > 0 ? 'warning' : 'neutral'}>
                    {report.rejected} rejected
                  </Badge>
                  {report.duplicates_within_file > 0 && (
                    <Badge tone="warning">
                      {report.duplicates_within_file} duplicate date(s) in the file
                    </Badge>
                  )}
                  {report.replaced_existing > 0 && (
                    <Badge tone="neutral">
                      replaced {report.replaced_existing} previously imported row(s)
                    </Badge>
                  )}
                </div>

                <p className="measure text-sm text-body">{report.message}</p>

                {Object.keys(report.detected_columns).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted">Recognised columns</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {Object.entries(report.detected_columns).map(([raw, canonical]) => (
                        <Badge key={raw} tone="neutral">
                          {raw} → {canonical}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {report.row_errors.length > 0 && (
                  <div className="-mx-4 overflow-x-auto sm:-mx-5">
                    <p className="px-4 pb-1.5 text-xs font-medium text-muted sm:px-5">
                      Row-level problems ({report.row_errors.length} shown)
                    </p>
                    <table className="w-full min-w-[32rem] text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-2xs uppercase tracking-wide text-faint">
                          <th scope="col" className="px-4 py-2 font-medium sm:px-5">Row</th>
                          <th scope="col" className="px-3 py-2 font-medium">Field</th>
                          <th scope="col" className="px-3 py-2 font-medium">Value</th>
                          <th scope="col" className="px-4 py-2 font-medium sm:px-5">Why it was rejected</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.row_errors.slice(0, 50).map((rowError, index) => (
                          <tr key={index} className="border-b border-line/60 last:border-0">
                            <td className="tnum px-4 py-2 text-muted sm:px-5">
                              {rowError.row_number || '—'}
                            </td>
                            <td className="px-3 py-2 text-body">{rowError.field ?? '—'}</td>
                            <td className="px-3 py-2 text-muted">{rowError.value ?? '—'}</td>
                            <td className="px-4 py-2 text-body sm:px-5">{rowError.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </Panel>

        {/* Preview */}
        <Panel
          title="Dataset preview"
          description="Paginated so a thousand-row dataset does not stall the page."
          actions={
            preview.data && (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PREVIEW_PAGE))}
                >
                  Previous
                </Button>
                <span className="tnum text-xs text-muted">
                  {preview.data.total === 0
                    ? '0'
                    : `${offset + 1}–${Math.min(offset + PREVIEW_PAGE, preview.data.total)}`}{' '}
                  of {preview.data.total.toLocaleString()}
                </span>
                <Button
                  variant="secondary"
                  disabled={offset + PREVIEW_PAGE >= preview.data.total}
                  onClick={() => setOffset(offset + PREVIEW_PAGE)}
                >
                  Next
                </Button>
              </div>
            )
          }
        >
          {preview.loading && !preview.data ? (
            <Skeleton className="h-64" />
          ) : preview.error ? (
            <ErrorState message={preview.error} onRetry={preview.reload} />
          ) : preview.data && preview.data.rows.length > 0 ? (
            <div className="-mx-4 overflow-x-auto sm:-mx-5">
              <table className="w-full min-w-[60rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-2xs uppercase tracking-wide text-faint">
                    {preview.data.columns.map((column) => (
                      <th key={column} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.data.rows.map((row, index) => (
                    <tr
                      key={String(row.id ?? index)}
                      className="border-b border-line/60 transition-colors last:border-0 hover:bg-raised"
                    >
                      {preview.data!.columns.map((column) => (
                        <td key={column} className="tnum whitespace-nowrap px-3 py-1.5 text-body">
                          {row[column] === null || row[column] === ''
                            ? <span className="text-faint">—</span>
                            : String(row[column])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Nothing to preview"
              description="This dataset has no rows. Load the demo data, import a CSV, or record a check-in."
            />
          )}
        </Panel>

        {/* Destructive zone */}
        <Panel
          title="Clear a dataset"
          description="Deliberate and irreversible. Each source is cleared on its own; the other two are untouched."
        >
          {resetTarget ? (
            <ConfirmInline
              question={`Permanently delete every record in “${
                dataset?.available_sources.find((entry) => entry.source === resetTarget)?.source_label
              }”?`}
              confirmLabel="Delete them"
              pending={resetting}
              onConfirm={() => void handleReset()}
              onCancel={() => setResetTarget(null)}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {(dataset?.available_sources ?? []).map((entry) => (
                <Button
                  key={entry.source}
                  variant="danger"
                  icon={<Trash2 className="size-3.5" />}
                  disabled={entry.record_count === 0}
                  onClick={() => setResetTarget(entry.source)}
                >
                  Clear {entry.source_label.toLowerCase()}
                </Button>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
