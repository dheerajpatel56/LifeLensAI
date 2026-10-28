/**
 * Minimal async-data hooks. No global state library: the dataset context plus
 * these hooks cover everything this app needs, and a store would only hide where
 * each number comes from.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../services/api'

export interface AsyncState<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
}

export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    loaderRef
      .current()
      .then((result) => {
        if (!cancelled) {
          setData(result)
        }
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setData(null)
        setError(
          cause instanceof ApiError
            ? cause.message
            : cause instanceof Error
              ? cause.message
              : 'Something went wrong loading this view.',
        )
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const reload = useCallback(() => setNonce((value) => value + 1), [])

  return { data, error, loading, reload }
}

/** Wraps a one-off action (submit, delete, upload) with pending and error state. */
export function useAction<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result>,
) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (...args: Args): Promise<Result | null> => {
      setPending(true)
      setError(null)
      try {
        return await action(...args)
      } catch (cause: unknown) {
        setError(
          cause instanceof ApiError
            ? cause.message
            : cause instanceof Error
              ? cause.message
              : 'The action could not be completed.',
        )
        return null
      } finally {
        setPending(false)
      }
    },
    [action],
  )

  return { run, pending, error, clearError: () => setError(null) }
}
