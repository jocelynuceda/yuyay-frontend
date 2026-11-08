import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { getUnreadCount } from '../services/api/notifications'
import { UnreadCountContext } from './unread-count-context'
import type { UnreadCountValue } from './unread-count-context'

/** Mantiene el número de avisos sin leer; se actualiza en cada cambio de ruta y con `refresh`. Si falla, el contador es 0. */
export function UnreadCountProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [count, setCount] = useState(0)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    getUnreadCount(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setCount(data.unreadCount)
      })
      .catch(() => {
        if (!controller.signal.aborted) setCount(0)
      })
    return () => controller.abort()
  }, [pathname, version])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  const value = useMemo<UnreadCountValue>(() => ({ count, refresh }), [count, refresh])

  return <UnreadCountContext.Provider value={value}>{children}</UnreadCountContext.Provider>
}
