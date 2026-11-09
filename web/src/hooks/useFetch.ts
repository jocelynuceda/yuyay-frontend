import axios from 'axios'
import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage } from '../utils/apiErrors'

interface FetchState<T> {
  data: T | null
  error: string | null
  loading: boolean
}

function isCanceled(error: unknown): boolean {
  if (axios.isCancel(error)) return true
  const name = typeof error === 'object' && error !== null && 'name' in error ? error.name : undefined
  return name === 'CanceledError' || name === 'AbortError'
}

/**
 * Carga datos cancelables: pasa un AbortSignal al `fetcher`, cancela al desmontar y al cambiar `deps`
 * o llamar a `reload`. Conserva los datos anteriores mientras recarga.
 */
export function useFetch<T>(fetcher: (signal: AbortSignal) => Promise<T>, deps: readonly unknown[]) {
  const [state, setState] = useState<FetchState<T>>({ data: null, error: null, loading: true })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState((prev) => ({ ...prev, error: null, loading: true }))
    fetcher(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: null, loading: false })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isCanceled(error)) return
        setState((prev) => ({ ...prev, error: getErrorMessage(error), loading: false }))
      })
    return () => controller.abort()
    // `deps` resume los parámetros del fetcher; `version` fuerza la recarga
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  return { data: state.data, error: state.error, loading: state.loading, reload }
}
