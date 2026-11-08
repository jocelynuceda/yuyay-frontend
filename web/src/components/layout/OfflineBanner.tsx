import { useContext, useEffect, useRef } from 'react'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { ToastContext } from '../../contexts/toast-context'
import { Icon } from '../ui/Icon'

/** Barra de aviso sin conexión; al volver la red muestra un aviso breve (si hay ToastProvider). */
export function OfflineBanner() {
  const online = useOnlineStatus()
  const toast = useContext(ToastContext)
  const wasOffline = useRef(!online)

  useEffect(() => {
    if (wasOffline.current && online) toast?.info('Conexión restablecida.')
    wasOffline.current = !online
  }, [online, toast])

  if (online) return null
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 bg-danger-bg px-4 py-2 text-sm font-semibold text-danger sm:px-6">
      <Icon name="alert" className="h-5 w-5 shrink-0" />
      Sin conexión. Los cambios no se guardarán hasta que vuelva la red.
    </div>
  )
}
