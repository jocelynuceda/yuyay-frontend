import { useContext } from 'react'
import { ToastContext, type ToastApi } from '../contexts/toast-context'

/** `toast.success(msg)`, `toast.error(msg)` y `toast.info(msg)`. */
export function useToast(): ToastApi {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast debe usarse dentro de ToastProvider.')
  return context
}
