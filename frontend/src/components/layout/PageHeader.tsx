import type { ReactNode } from 'react'
import { MethodNote } from './Workspace'

/**
 * A page head is one line: what this view is, its scope as inline meta, and its
 * actions. The long explanation that used to sit under every title now lives in
 * `note`, behind a disclosure — present for anyone defending the method, not
 * occupying the top of the screen on every visit.
 */
export function PageHeader({
  title,
  meta,
  note,
  actions,
}: {
  title: string
  meta?: ReactNode
  note?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h1 className="text-base font-semibold tracking-tight text-ink">{title}</h1>
          {meta && <span className="tnum text-2xs text-faint">{meta}</span>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
      </div>
      {note && <MethodNote label="About this view">{note}</MethodNote>}
    </header>
  )
}
