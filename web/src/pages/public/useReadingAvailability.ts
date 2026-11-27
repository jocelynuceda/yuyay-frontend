import axios from 'axios'
import { useEffect, useState } from 'react'
import { isAccessLost } from '../../utils/accessStatus'

const POLL_MS = 10000

/** Solo consulta la vigencia del enlace. No vuelve a abrirlo ni renueva el permiso. */
export function useReadingAvailability(
  opened: boolean, checkAccess: (signal: AbortSignal) => Promise<unknown>,
  onUnavailable: () => void, isDenied: (status?: number) => boolean = isAccessLost,
) {
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (!opened) return
    let timer: ReturnType<typeof setTimeout>
    let pending: AbortController | undefined
    const canCheck = () => document.visibilityState !== 'hidden' && window.navigator.onLine !== false
    function stop() {
      clearTimeout(timer)
      pending?.abort()
      pending = undefined
    }
    function pause() {
      stop()
      setPaused(true)
    }
    async function check() {
      if (!canCheck()) { pause(); return }
      if (pending) return
      clearTimeout(timer)
      const request = new AbortController()
      pending = request
      // Si el servidor tarda, ocultar la lectura hasta que confirme el acceso.
      timer = setTimeout(() => setPaused(true), 3000)
      try {
        await checkAccess(request.signal)
        if (!request.signal.aborted) setPaused(false)
      } catch (error) {
        if (request.signal.aborted) return
        if (axios.isAxiosError(error) && isDenied(error.response?.status)) {
          stop()
          onUnavailable()
          return
        }
        setPaused(true)
      } finally {
        if (!request.signal.aborted) {
          pending = undefined
          clearTimeout(timer)
          timer = setTimeout(check, POLL_MS)
        }
      }
    }
    if (canCheck()) timer = setTimeout(check, POLL_MS)
    else pause()
    window.addEventListener('focus', check)
    window.addEventListener('pageshow', check)
    window.addEventListener('pagehide', pause)
    window.addEventListener('online', check)
    window.addEventListener('offline', pause)
    document.addEventListener('visibilitychange', check)
    return () => {
      stop()
      window.removeEventListener('focus', check)
      window.removeEventListener('pageshow', check)
      window.removeEventListener('pagehide', pause)
      window.removeEventListener('online', check)
      window.removeEventListener('offline', pause)
      document.removeEventListener('visibilitychange', check)
    }
  }, [opened, checkAccess, onUnavailable, isDenied])

  return paused
}
