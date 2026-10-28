/**
 * The active dataset and the date filter are the only genuinely global state:
 * every page's numbers mean something different depending on them, so they live
 * in one context rather than being threaded through every component.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../services/api'
import type { ActiveDataset, DatasetSource } from '../types/api'

export interface DateFilter {
  start: string | null
  end: string | null
}

interface DatasetContextValue {
  dataset: ActiveDataset | null
  loading: boolean
  error: string | null
  filter: DateFilter
  setFilter: (filter: DateFilter) => void
  clearFilter: () => void
  selectSource: (source: DatasetSource) => Promise<void>
  refresh: () => Promise<void>
  /** Bumped whenever records change, so pages can re-fetch derived analytics. */
  version: number
  markStale: () => void
}

const DatasetContext = createContext<DatasetContextValue | null>(null)

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<ActiveDataset | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilterState] = useState<DateFilter>({ start: null, end: null })
  const [version, setVersion] = useState(0)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setDataset(await api.activeDataset())
    } catch (cause) {
      setDataset(null)
      setError(cause instanceof Error ? cause.message : 'Could not load the active dataset.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const selectSource = useCallback(async (source: DatasetSource) => {
    const next = await api.selectDataset(source)
    setDataset(next)
    // A different dataset has a different date span, so the old window is meaningless.
    setFilterState({ start: null, end: null })
    setVersion((value) => value + 1)
  }, [])

  const value = useMemo<DatasetContextValue>(
    () => ({
      dataset,
      loading,
      error,
      filter,
      setFilter: setFilterState,
      clearFilter: () => setFilterState({ start: null, end: null }),
      selectSource,
      refresh,
      version,
      markStale: () => setVersion((current) => current + 1),
    }),
    [dataset, loading, error, filter, selectSource, refresh, version],
  )

  return <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>
}

export function useDataset(): DatasetContextValue {
  const context = useContext(DatasetContext)
  if (!context) {
    throw new Error('useDataset must be used inside a DatasetProvider')
  }
  return context
}
