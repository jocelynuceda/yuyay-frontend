import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ToastRegion, type ToastItem, type ToastTone } from '../components/ui/Toast'
import { ToastContext, type ToastApi } from './toast-context'

const MAX_TOASTS = 3
const DURATIONS: Record<ToastTone, number> = { success: 4000, info: 4000, error: 6000 }

/** Provee `useToast()` y dibuja los avisos (máximo 3 a la vez, se cierran solos). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer !== undefined) clearTimeout(timer)
    timers.current.delete(id)
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(
    (tone: ToastTone, message: string) => {
      const id = ++nextId.current
      setToasts((current) => {
        const next = [...current, { id, tone, message }]
        const dropped = next.splice(0, Math.max(0, next.length - MAX_TOASTS))
        dropped.forEach((toast) => {
          const timer = timers.current.get(toast.id)
          if (timer !== undefined) clearTimeout(timer)
          timers.current.delete(toast.id)
        })
        return next
      })
      timers.current.set(id, setTimeout(() => dismiss(id), DURATIONS[tone]))
    },
    [dismiss],
  )

  useEffect(() => {
    const active = timers.current
    return () => {
      active.forEach(clearTimeout)
      active.clear()
    }
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => show('success', message),
      error: (message) => show('error', message),
      info: (message) => show('info', message),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}
