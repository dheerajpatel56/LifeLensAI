import { useEffect, useRef } from 'react'
import clsx from 'clsx'
import type { MetricValue } from '../../types/api'
import { Skeleton } from '../ui'
import { countTo } from '../../utils/motion'

/**
 * Metrics render as one divided strip, not five separate cards.
 *
 * Five identical bordered tiles in a row is the dashboard template everyone
 * recognises. A single ruled strip reads as one instrument panel, puts the figures
 * on a shared baseline so they can be compared at a glance, and removes four
 * borders from the page.
 */
function formatFor(metric: MetricValue) {
  return (current: number): string => {
    if (metric.unit === 'minutes') return String(Math.round(current))
    return current.toFixed(1)
  }
}

function MetricCell({ metric }: { metric: MetricValue }) {
  const valueRef = useRef<HTMLSpanElement>(null)
  const unavailable = metric.value === null

  // The figure counting up is the state change itself, which is the one case
  // where animating a number earns its place.
  useEffect(() => {
    if (unavailable || metric.value === null) return
    countTo(valueRef.current, metric.value, formatFor(metric))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric.value, metric.key, unavailable])

  return (
    <div className="flex min-w-0 flex-col gap-0.5 px-4 py-3 first:pl-0 sm:px-5">
      <span className="label truncate">{metric.label}</span>
      <span className="flex items-baseline gap-1">
        {unavailable ? (
          <span className="tnum text-2xl font-semibold text-faint">—</span>
        ) : (
          <>
            <span ref={valueRef} className="tnum text-2xl font-semibold text-ink">
              {formatFor(metric)(metric.value ?? 0)}
            </span>
            <span className="text-xs text-muted">
              {metric.unit === '/10' ? '/ 10' : metric.unit}
            </span>
          </>
        )}
      </span>
      <span className="tnum text-2xs text-faint">
        {unavailable ? 'not recorded' : `n = ${metric.sample_size.toLocaleString()}`}
      </span>
    </div>
  )
}

export function MetricStrip({
  metrics,
  className,
}: {
  metrics: MetricValue[]
  className?: string
}) {
  return (
    <div
      className={clsx(
        'flex flex-wrap border-y border-line [&>*+*]:border-l [&>*+*]:border-line',
        className,
      )}
    >
      {metrics.map((metric) => (
        <MetricCell key={metric.key} metric={metric} />
      ))}
    </div>
  )
}

export function MetricStripSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-wrap border-y border-line [&>*+*]:border-l [&>*+*]:border-line">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex flex-col gap-1.5 px-4 py-3 first:pl-0 sm:px-5">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-6 w-14" />
          <Skeleton className="h-2 w-10" />
        </div>
      ))}
    </div>
  )
}
