import type { ReactNode } from 'react'

export function PageHeader({
  title,
  lede,
  actions,
}: {
  title: string
  lede: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">{title}</h1>
        <p className="measure mt-1.5 text-sm text-muted">{lede}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
