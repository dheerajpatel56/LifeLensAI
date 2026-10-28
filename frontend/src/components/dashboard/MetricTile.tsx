import type { MetricValue } from '../../types/api'
import { SampleSize, Skeleton } from '../ui'
import { formatUnitValue } from '../../utils/format'

/**
 * A metric reads as a labelled row of data, not as a hero statistic. The sample
 * size sits with the number because a mean of three days is not a mean of three
 * hundred.
 */
export function MetricTile({ metric }: { metric: MetricValue }) {
  const unavailable = metric.value === null

  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[10px] border border-line bg-surface px-4 py-3">
      <span className="truncate text-xs text-muted">{metric.label}</span>
      <span className="flex items-baseline gap-1">
        <span
          className={`tnum text-2xl font-semibold ${unavailable ? 'text-faint' : 'text-ink'}`}
        >
          {formatUnitValue(metric.value, metric.unit)}
        </span>
        {!unavailable && metric.unit && metric.unit !== '/10' && (
          <span className="text-xs text-muted">{metric.unit}</span>
        )}
        {!unavailable && metric.unit === '/10' && <span className="text-xs text-muted">/ 10</span>}
      </span>
      {unavailable ? (
        <span className="text-2xs text-faint">Not recorded in this range</span>
      ) : (
        <SampleSize n={metric.sample_size} />
      )}
    </div>
  )
}

export function MetricTileSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-line bg-surface px-4 py-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-2.5 w-12" />
    </div>
  )
}
