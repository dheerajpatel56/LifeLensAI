/**
 * The dataset bar is always on screen because every number in the app means
 * something different depending on which dataset is active and which date window
 * is applied. It is a control strip, not decoration.
 */

import { useState } from 'react'
import { CalendarRange, FlaskConical, RotateCcw } from 'lucide-react'
import clsx from 'clsx'
import { toast } from 'sonner'
import { useDataset } from '../../hooks/useDataset'
import { api } from '../../services/api'
import { Badge, Button, Input } from '../ui'
import { formatDate } from '../../utils/format'
import type { DatasetSource } from '../../types/api'

export function DatasetBar() {
  const { dataset, filter, setFilter, clearFilter, selectSource, loading, markStale } = useDataset()
  const [switching, setSwitching] = useState<DatasetSource | null>(null)

  const handleSelect = async (source: DatasetSource) => {
    if (!dataset || source === dataset.source) return
    setSwitching(source)
    try {
      await selectSource(source)
      const label = dataset.available_sources.find((entry) => entry.source === source)?.source_label
      toast.success(`Now analysing ${label?.toLowerCase() ?? source}`)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not switch dataset')
    } finally {
      setSwitching(null)
    }
  }

  const handleLoadDemo = async () => {
    setSwitching('demo')
    try {
      const report = await api.loadDemo(false)
      await selectSource('demo')
      markStale()
      toast.success(report.message)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not load the demo dataset')
    } finally {
      setSwitching(null)
    }
  }

  const rangeActive = Boolean(filter.start || filter.end)

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-t border-line px-4 py-2.5 sm:px-6 lg:border-t-0">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-2xs font-medium uppercase tracking-wide text-faint">Dataset</span>
        <div
          role="group"
          aria-label="Active dataset"
          className="flex max-w-full overflow-x-auto rounded-[6px] border border-line bg-raised p-0.5"
        >
          {(dataset?.available_sources ?? []).map((entry) => {
            const isActive = dataset?.source === entry.source
            return (
              <button
                key={entry.source}
                type="button"
                onClick={() => void handleSelect(entry.source)}
                aria-pressed={isActive}
                disabled={switching !== null}
                title={`${entry.source_label} — ${entry.record_count.toLocaleString()} record(s)`}
                className={clsx(
                  'tnum whitespace-nowrap rounded-[4px] px-2 py-1 text-xs font-medium transition-colors duration-150',
                  isActive
                    ? 'bg-accent/18 text-ink'
                    : 'text-muted hover:text-body disabled:text-faint',
                )}
              >
                {entry.source === 'demo' ? 'Demo' : entry.source === 'user' ? 'Mine' : 'Imported'}
                <span className="ml-1.5 text-faint">{entry.record_count.toLocaleString()}</span>
              </button>
            )
          })}
        </div>
        {dataset?.is_synthetic && (
          <Badge tone="warning">
            <FlaskConical className="size-3" aria-hidden />
            Synthetic
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-faint">
          <CalendarRange className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">Range</span>
        </span>
        {/* Native date inputs have a wide intrinsic width; constrain them explicitly
            or they push the rest of the bar onto another row. */}
        <Input
          type="date"
          aria-label="Range start"
          value={filter.start ?? ''}
          min={dataset?.date_start ?? undefined}
          max={filter.end ?? dataset?.date_end ?? undefined}
          onChange={(event) => setFilter({ ...filter, start: event.target.value || null })}
          className="!w-[8.75rem] px-2 py-1 text-xs"
        />
        <span className="text-xs text-faint">to</span>
        <Input
          type="date"
          aria-label="Range end"
          value={filter.end ?? ''}
          min={filter.start ?? dataset?.date_start ?? undefined}
          max={dataset?.date_end ?? undefined}
          onChange={(event) => setFilter({ ...filter, end: event.target.value || null })}
          className="!w-[8.75rem] px-2 py-1 text-xs"
        />
        {rangeActive && (
          <Button
            variant="ghost"
            icon={<RotateCcw className="size-3.5" />}
            onClick={clearFilter}
            className="px-2 py-1"
          >
            Reset
          </Button>
        )}
      </div>

      <p className="tnum ml-auto text-2xs text-faint">
        {loading
          ? 'Loading dataset…'
          : dataset && dataset.record_count > 0
            ? `${dataset.record_count.toLocaleString()} records · ${formatDate(dataset.date_start)} – ${formatDate(dataset.date_end)}`
            : 'No records in this dataset'}
      </p>

      {dataset && dataset.record_count === 0 && dataset.source === 'demo' && (
        <Button variant="primary" loading={switching === 'demo'} onClick={() => void handleLoadDemo()}>
          Load demo data
        </Button>
      )}
    </div>
  )
}
