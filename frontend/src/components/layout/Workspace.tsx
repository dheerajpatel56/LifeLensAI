/**
 * Workspace primitives.
 *
 * The shape this replaces: page title, paragraph, then a column of full-width
 * slabs each carrying a heading and an explanatory subtitle. That structure is
 * documentation laid out as UI, and it reads as generated because every section
 * announces and explains itself in the same voice at the same size.
 *
 * What replaces it:
 *
 * - `SectionHead` is one line. A small-caps label, optional inline meta on the
 *   right. No descriptive paragraph. Method notes belong in `MethodNote`, which
 *   is a disclosure the user opens when they want it.
 * - `Rail` / `Canvas` split parameters from results, so controls stay put while
 *   results scroll — how an analysis tool behaves.
 * - `Grid` places content in defined cells instead of stacking slabs.
 */

import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

export function SectionHead({
  label,
  meta,
  actions,
  className,
}: {
  label: string
  meta?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={clsx(
        'flex min-h-7 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line pb-1.5',
        className,
      )}
    >
      <h2 className="label text-muted">{label}</h2>
      <div className="flex items-center gap-3">
        {meta && <span className="tnum text-2xs text-faint">{meta}</span>}
        {actions}
      </div>
    </div>
  )
}

/**
 * Method notes live behind a disclosure. The information is kept — this is a
 * project that has to defend its method — but it stops competing with the data
 * for the same visual weight.
 */
export function MethodNote({ children, label = 'Method' }: { children: ReactNode; label?: string }) {
  return (
    <details className="group mt-2">
      <summary className="label inline-flex cursor-pointer list-none items-center gap-1 text-faint transition-colors hover:text-muted">
        <ChevronRight
          className="size-3 transition-transform duration-150 group-open:rotate-90"
          aria-hidden
        />
        {label}
      </summary>
      <div className="measure mt-1.5 border-l border-line pl-3 text-xs text-muted">{children}</div>
    </details>
  )
}

/** A block of content in the canvas. No border, no title bar — the head does that. */
export function Block({
  id,
  label,
  meta,
  actions,
  note,
  children,
  className,
  span,
}: {
  /** Anchor target, for pages that carry a contents rail. */
  id?: string
  label?: string
  meta?: ReactNode
  actions?: ReactNode
  note?: ReactNode
  children: ReactNode
  className?: string
  span?: string
}) {
  return (
    <section id={id} className={clsx('flex min-w-0 scroll-mt-4 flex-col', span, className)}>
      {label && <SectionHead label={label} meta={meta} actions={actions} />}
      <div className={clsx(label && 'pt-3')}>{children}</div>
      {note && <MethodNote>{note}</MethodNote>}
    </section>
  )
}

/** Parameter rail: sticky, dense, its own scroll. */
export function Rail({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <aside
      className={clsx(
        'flex flex-col gap-4 border-line lg:sticky lg:top-0 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:border-r lg:pr-5',
        className,
      )}
    >
      {children}
    </aside>
  )
}

export function RailGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="label border-b border-line pb-1">{label}</h3>
      {children}
    </div>
  )
}

/** Result canvas beside a rail. */
export function Canvas({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('flex min-w-0 flex-col gap-6', className)}>{children}</div>
}

/** Two-column workspace: parameters left, results right. */
export function Split({ rail, children }: { rail: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[16rem_1fr] lg:gap-6">
      {rail}
      {children}
    </div>
  )
}

/** Explicit grid cells rather than a stack of full-width slabs. */
export function Grid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={clsx('grid gap-x-6 gap-y-6', className)}>{children}</div>
}

/**
 * A read-out: one figure with its label, for the dense figure rows that replace
 * the metric-card grid.
 */
export function Readout({
  label,
  value,
  unit,
  sub,
  tone,
}: {
  label: string
  value: ReactNode
  unit?: ReactNode
  sub?: ReactNode
  tone?: 'default' | 'muted'
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="label truncate">{label}</span>
      <span className="flex items-baseline gap-1">
        <span
          className={clsx(
            'tnum text-lg font-medium',
            tone === 'muted' ? 'text-faint' : 'text-ink',
          )}
        >
          {value}
        </span>
        {unit && <span className="text-2xs text-muted">{unit}</span>}
      </span>
      {sub && <span className="tnum text-2xs text-faint">{sub}</span>}
    </div>
  )
}
