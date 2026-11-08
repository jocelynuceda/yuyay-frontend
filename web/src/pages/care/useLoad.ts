import { useEffect, useState } from 'react'
import { getErrorMessage } from '../../utils/apiErrors'

export type Load<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T }

/** Carga datos y los vuelve a pedir con `reload`. Reemplazable por el hook de datos de la base. */
export function useLoad<T>(fetcher: () => Promise<T>, key: unknown) {
  const [state, setState] = useState<Load<T>>({ status: 'loading' })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    fetcher()
      .then((data) => active && setState({ status: 'ready', data }))
      .catch((error) => active && setState({ status: 'error', message: getErrorMessage(error) }))
    return () => {
      active = false
    }
    // `key` resume los parámetros del fetcher
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version])

  return { state, reload: () => setVersion((v) => v + 1) }
}
