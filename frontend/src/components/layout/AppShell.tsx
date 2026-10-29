import { useEffect, useRef, useState } from 'react'
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
import { enterRoute, settle } from '../../utils/motion'

/**
 * Application chrome.
 *
 * This is a workspace, not a document: the toolbar and status bar are fixed, the
 * navigation rail is fixed, and only the canvas scrolls. The previous shell let
 * the whole page scroll as one column, which is what made every screen read as a
 * stack of slabs regardless of what was in them.
 */

const NAV = [
  { to: '/', label: 'Overview', short: 'Overview', icon: LayoutDashboard },
  { to: '/check-in', label: 'Daily check-in', short: 'Check-in', icon: NotebookPen },
  { to: '/patterns', label: 'Pattern explorer', short: 'Patterns', icon: Radar },
  { to: '/insights', label: 'Insights', short: 'Insights', icon: Lightbulb },
  { to: '/datasets', label: 'Datasets', short: 'Datasets', icon: Database },
  { to: '/about', label: 'About & method', short: 'About', icon: BookOpen },
]

function Mark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="var(--color-accent-ink)" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.75" stroke="var(--color-muted)" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="1.1" fill="var(--color-ink)" />
    </svg>
  )
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'relative flex items-center gap-2 py-1.5 pl-3 pr-2 text-xs transition-colors duration-150',
              isActive
                ? 'bg-surface font-medium text-ink'
                : 'text-muted hover:bg-surface/60 hover:text-body',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-accent" />}
              <Icon
                className={clsx('size-3.5 shrink-0', isActive ? 'text-accent-ink' : 'text-faint')}
                aria-hidden
              />
              {label}
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
  const canvasRef = useRef<HTMLDivElement>(null)

  const current = NAV.find((entry) =>
    entry.to === '/' ? location.pathname === '/' : location.pathname.startsWith(entry.to),
  )

  useEffect(() => setMobileOpen(false), [location.pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  // Reset the canvas scroll and settle the new view on navigation.
  useEffect(() => {
    canvasRef.current?.scrollTo({ top: 0 })
    enterRoute(canvasRef.current)
  }, [location.pathname])

  // If a route transition started while the document was hidden, rAF never ran
  // and the canvas is still mid-fade. Restore it when the page comes back.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && canvasRef.current) {
        if (Number(getComputedStyle(canvasRef.current).opacity) < 1) {
          settle(canvasRef.current)
        }
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  return (
    <div className="workspace bg-base">
      {/* Toolbar: one dense line. App mark, where you are, dataset controls. */}
      <header className="flex items-center gap-3 border-b border-line bg-base-deep px-3">
        <div className="flex shrink-0 items-center gap-2 py-1.5">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            className="rounded-[2px] p-1 text-muted transition-colors hover:bg-surface hover:text-ink lg:hidden"
          >
            <Menu className="size-4" aria-hidden />
          </button>
          <Mark />
          <span className="text-xs font-semibold tracking-tight text-ink">LifeLens</span>
          <span aria-hidden className="text-faint">
            /
          </span>
          <span className="text-xs text-muted">{current?.short ?? 'Overview'}</span>
        </div>
        <div className="min-w-0 flex-1">
          <DatasetBar />
        </div>
      </header>

      <div className="grid min-h-0 lg:grid-cols-[13rem_1fr]">
        <aside className="hidden min-h-0 flex-col overflow-y-auto border-r border-line bg-base-deep py-1.5 lg:flex">
          <NavItems />
        </aside>

        <div ref={canvasRef} className="canvas min-w-0 px-4 py-4 sm:px-6 sm:py-5">
          <Outlet />
        </div>
      </div>

      {/* Status bar: the state of the session, always visible, never narrated. */}
      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-base-deep px-3 py-1 text-2xs text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-1.5 rounded-full bg-positive" />
          Local
        </span>
        {dataset && (
          <>
            <span className="tnum">
              {dataset.source_label} · {dataset.record_count.toLocaleString()} records
            </span>
            {dataset.is_synthetic && <span className="text-warning">synthetic</span>}
          </>
        )}
        <span className="ml-auto">Self-reported data · associations, not causal claims</span>
      </footer>

      {mobileOpen && (
        <div className="lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-ink/35"
            style={{ zIndex: 'var(--z-overlay)' }}
          />
          <div
            className="fixed inset-y-0 left-0 flex w-60 max-w-[80vw] flex-col border-r border-line bg-base-deep"
            style={{ zIndex: 'var(--z-dialog)' }}
          >
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <span className="flex items-center gap-2">
                <Mark />
                <span className="text-xs font-semibold text-ink">LifeLens</span>
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="rounded-[2px] p-1 text-muted transition-colors hover:bg-surface hover:text-ink"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-1.5">
              <NavItems onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
