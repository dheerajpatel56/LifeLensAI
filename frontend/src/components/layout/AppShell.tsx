import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BookOpen,
  Database,
  LayoutDashboard,
  Lightbulb,
  Menu,
  NotebookPen,
  Radar,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import { DatasetBar } from './DatasetBar'
import { useDataset } from '../../hooks/useDataset'

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, hint: 'Dashboard' },
  { to: '/check-in', label: 'Daily check-in', icon: NotebookPen, hint: 'Record today' },
  { to: '/patterns', label: 'Pattern explorer', icon: Radar, hint: 'Clusters, correlations, rules' },
  { to: '/insights', label: 'Insights', icon: Lightbulb, hint: 'Plain-English findings' },
  { to: '/datasets', label: 'Datasets', icon: Database, hint: 'Import, export, switch' },
  { to: '/about', label: 'About & method', icon: BookOpen, hint: 'How it works' },
]

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-[8px] border border-accent/40 bg-accent/15"
      >
        {/* A lens: concentric rings reading inward, drawn rather than imported. */}
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="8.5" stroke="var(--color-accent-ink)" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="4" stroke="var(--color-cyan)" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="1.25" fill="var(--color-ink)" />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold tracking-tight text-ink">LifeLens AI</span>
        <span className="block truncate text-2xs text-faint">Patterns behind your days</span>
      </span>
    </div>
  )
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV.map(({ to, label, icon: Icon, hint }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'group flex items-start gap-2.5 rounded-[6px] px-2.5 py-2 transition-colors duration-150',
              isActive
                ? 'bg-accent/14 text-ink'
                : 'text-muted hover:bg-raised hover:text-body active:bg-line',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                className={clsx('mt-0.5 size-4 shrink-0', isActive ? 'text-accent-ink' : 'text-faint')}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{label}</span>
                <span className="block truncate text-2xs text-faint">{hint}</span>
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { dataset } = useDataset()

  // Close the drawer on navigation and on Escape.
  useEffect(() => setMobileOpen(false), [location.pathname])
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  return (
    <div className="min-h-screen bg-base lg:grid lg:grid-cols-[264px_1fr]">
      {/* Desktop sidebar: a second, deeper neutral layer, per DESIGN.md. */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-base-deep px-3 py-4 lg:flex">
        <div className="px-1.5">
          <Wordmark />
        </div>
        <div className="mt-6 flex-1 overflow-y-auto">
          <NavItems />
        </div>
        <div className="border-t border-line px-2.5 pt-3">
          <p className="text-2xs text-faint">
            Local-first. Not a medical or diagnostic tool.
          </p>
          {dataset && (
            <p className="mt-1.5 text-2xs text-faint">
              Analysing <span className="text-muted">{dataset.source_label.toLowerCase()}</span>
            </p>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header
          className="sticky top-0 border-b border-line bg-base/85 backdrop-blur-sm"
          style={{ zIndex: 'var(--z-sticky)' }}
        >
          <div className="flex items-center gap-3 px-4 py-2.5 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              className="rounded-[6px] p-1.5 text-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <Menu className="size-5" aria-hidden />
            </button>
            <Wordmark />
          </div>
          <DatasetBar />
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6">
          <Outlet />
        </main>

        <footer className="border-t border-line px-4 py-4 text-2xs text-faint sm:px-6">
          LifeLens AI · mood and productivity are self-reported · associations shown are not causal
          claims
        </footer>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden" style={{ zIndex: 'var(--z-sidebar)', position: 'relative' }}>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-base-deep/70"
            style={{ zIndex: 'var(--z-overlay)' }}
          />
          <div
            className="enter fixed inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-base-deep px-3 py-4"
            style={{ zIndex: 'var(--z-dialog)' }}
          >
            <div className="flex items-center justify-between px-1.5">
              <Wordmark />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="rounded-[6px] p-1.5 text-muted transition-colors hover:bg-raised hover:text-ink"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="mt-6 flex-1 overflow-y-auto">
              <NavItems onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
