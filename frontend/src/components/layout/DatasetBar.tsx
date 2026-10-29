/**
 * Dataset controls, inline in the toolbar.
 *
 * These live in the chrome rather than in the page because they scope every
 * figure the app shows. Kept to one dense line: a segmented source switch, the
 * date window, and nothing else.
 */

import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import clsx from 'clsx'
import { toast } from 'sonner'
import { useDataset } from '../../hooks/useDataset'
import { api } from '../../services/api'
import { Button, Input } from '../ui'
import type { DatasetSource } from '../../types/api'

const SHORT_LABEL: Record<DatasetSource, string> = {
  demo: 'Demo',
  user: 'Mine',
  import: 'Imported',
}

export function DatasetBar() {
  const { dataset, filter, setFilter, clearFilter, selectSource, markStale } = useDataset()
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
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 py-1">
      <div
        role="group"
        aria-label="Active dataset"
        className="flex overflow-x-auto rounded-[2px] border border-line"
      >
        {(dataset?.available_sources ?? []).map((entry, index) => {
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
                'whitespace-nowrap px-2 py-[3px] text-2xs transition-colors duration-150',
                index > 0 && 'border-l border-line',
                isActive
                  ? 'bg-surface font-medium text-ink'
                  : 'text-muted hover:bg-surface/60 hover:text-body disabled:text-faint',
              )}
            >
              {SHORT_LABEL[entry.source]}
              <span className="tnum ml-1 text-muted">{entry.record_count.toLocaleString()}</span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-1">
        <Input
          type="date"
          aria-label="Range start"
          value={filter.start ?? ''}
          min={dataset?.date_start ?? undefined}
          max={filter.end ?? dataset?.date_end ?? undefined}
          onChange={(event) => setFilter({ ...filter, start: event.target.value || null })}
          className="!w-[7.75rem] px-1.5 py-[2px] text-2xs"
        />
        <span aria-hidden className="text-2xs text-muted">
          –
        </span>
        <Input
          type="date"
          aria-label="Range end"
          value={filter.end ?? ''}
          min={filter.start ?? dataset?.date_start ?? undefined}
          max={dataset?.date_end ?? undefined}
          onChange={(event) => setFilter({ ...filter, end: event.target.value || null })}
          className="!w-[7.75rem] px-1.5 py-[2px] text-2xs"
        />
        {rangeActive && (
          <Button
            variant="ghost"
            aria-label="Clear date range"
            icon={<RotateCcw className="size-3" />}
            onClick={clearFilter}
            className="px-1 py-[2px]"
          />
        )}
      </div>

      {dataset && dataset.record_count === 0 && dataset.source === 'demo' && (
        <Button variant="primary" loading={switching === 'demo'} onClick={() => void handleLoadDemo()}>
          Load demo data
        </Button>
      )}
    </div>
  )
}
