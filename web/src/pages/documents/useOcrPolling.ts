import { useEffect } from 'react'

export const OCR_POLL_MS = 3000

/** La lectura corre en segundo plano en el backend: mientras siga en curso se vuelve a consultar. */
export function useOcrPolling(reading: boolean, reload: () => void) {
  useEffect(() => {
    if (!reading) return
    const timer = setInterval(reload, OCR_POLL_MS)
    return () => clearInterval(timer)
  }, [reading, reload])
}
