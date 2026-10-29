/**
 * Correlation matrix as a CSS-grid heatmap. Recharts has no good heatmap, and a
 * grid of cells is both lighter and keeps every value selectable text.
 *
 * Colour encodes direction and magnitude; the number is always printed as well,
 * so the chart never depends on colour alone.
 */

import { useState } from 'react'
import clsx from 'clsx'
import type { CorrelationResponse } from '../../types/api'
import { EmptyState } from '../ui'

function cellStyle(coefficient: number | null): { background: string; color: string } {
  if (coefficient === null) {
    return { background: 'var(--color-raised)', color: 'var(--color-faint)' }
  }
  const magnitude = Math.min(Math.abs(coefficient), 1)
  // Alpha ramps with |r| so weak cells recede and strong cells read instantly.
  // Capped below full strength so the figure stays legible in every cell.
  const alpha = 0.06 + magnitude * 0.5
  const hue = coefficient >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'
  return {
    background: `color-mix(in srgb, ${hue} ${Math.round(alpha * 100)}%, var(--color-base))`,
    color: magnitude > 0.62 ? 'var(--color-base)' : 'var(--color-ink)',
  }
}

export function CorrelationHeatmap({ data }: { data: CorrelationResponse }) {
  const [hovered, setHovered] = useState<string | null>(null)

  if (!data.available || data.variables.length < 2) {
    return (
      <EmptyState
        title="No matrix to show"
        description={data.message || 'At least two numeric columns with variation are needed.'}
      />
    )
  }

  const lookup = new Map(
    data.matrix.map((cell) => [`${cell.x_field}|${cell.y_field}`, cell]),
  )
  const vars = data.variables

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[36rem] gap-px bg-line/40"
          style={{ gridTemplateColumns: `minmax(8.5rem, auto) repeat(${vars.length}, minmax(2.75rem, 1fr))` }}
          role="table"
          aria-label={`${data.method} correlation matrix`}
        >
          <div role="columnheader" className="sticky left-0 bg-surface" />
          {vars.map((field) => (
            <div
              key={`head-${field}`}
              role="columnheader"
              className="flex items-end justify-center pb-1.5"
            >
              <span
                className="whitespace-nowrap text-2xs text-muted"
                style={{ writingMode: 'vertical-rl', rotate: '180deg' }}
                title={data.labels[field]}
              >
                {data.labels[field]}
              </span>
            </div>
          ))}

          {vars.map((rowField) => (
            <div key={`row-${rowField}`} className="contents" role="row">
              <div
                role="rowheader"
                className="sticky left-0 flex items-center bg-surface pr-2 text-2xs text-muted"
              >
                <span className="truncate" title={data.labels[rowField]}>
                  {data.labels[rowField]}
                </span>
              </div>
              {vars.map((colField) => {
                const cell =
                  lookup.get(`${rowField}|${colField}`) ?? lookup.get(`${colField}|${rowField}`)
                const coefficient = cell?.coefficient ?? null
                const key = `${rowField}|${colField}`
                const isSelf = rowField === colField
                const style = isSelf
                  ? { background: 'var(--color-raised)', color: 'var(--color-muted)' }
                  : cellStyle(coefficient)
                return (
                  <div
                    key={key}
                    role="cell"
                    tabIndex={0}
                    onMouseEnter={() => setHovered(key)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(key)}
                    onBlur={() => setHovered(null)}
                    aria-label={`${data.labels[rowField]} vs ${data.labels[colField]}: ${
                      coefficient === null ? 'not available' : coefficient.toFixed(2)
                    }, n = ${cell?.sample_size ?? 0}`}
                    className={clsx(
                      'tnum grid h-9 place-items-center text-2xs font-medium transition-[outline] duration-150',
                      hovered === key && 'outline outline-2 outline-accent',
                    )}
                    style={style}
                  >
                    {isSelf ? '—' : coefficient === null ? 'n/a' : coefficient.toFixed(2)}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-2xs text-muted">
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-10"
            style={{
              background:
                'linear-gradient(90deg, color-mix(in srgb, var(--color-negative) 56%, var(--color-base)), var(--color-base), color-mix(in srgb, var(--color-positive) 56%, var(--color-base)))',
            }}
            aria-hidden
          />
          −1 (opposite) → 0 (none) → +1 (together)
        </span>
        <span>
          Cells marked <span className="text-faint">n/a</span> had too few overlapping days or a
          constant column.
        </span>
      </div>
    </div>
  )
}
