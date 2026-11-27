import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { getHandoffSummaryPdf } from '../../services/api/handoffs'
import { getErrorMessage } from '../../utils/apiErrors'
import { focusRing } from '../../utils/styles'

export function SummaryPdfDownload({ token, accessGrant, deadline, onUnavailable }: { token: string; accessGrant?: string | null; deadline: number; onUnavailable: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])

  async function download() {
    if (busy || performance.now() >= deadline) return
    const request = new AbortController()
    controller.current = request
    setBusy(true)
    setError(null)
    try {
      const pdf = await getHandoffSummaryPdf(token, accessGrant, request.signal)
      if (request.signal.aborted || performance.now() >= deadline) return
      const url = URL.createObjectURL(pdf)
      const link = document.createElement('a')
      link.href = url
      link.download = 'resumen-clinico-yuyay.pdf'
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (cause) {
      if (request.signal.aborted) return
      if (axios.isAxiosError(cause) && cause.response?.status === 410) onUnavailable()
      else setError(getErrorMessage(cause))
    } finally {
      if (!request.signal.aborted) setBusy(false)
    }
  }

  return (
    <div className="grid gap-2">
      <button type="button" disabled={busy} onClick={() => void download()}
        className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line px-3.5 py-2 text-sm font-semibold hover:bg-primary-tint disabled:opacity-60 ${focusRing}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4.5"><path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" /></svg>
        {busy ? 'Descargando…' : 'Descargar PDF'}
      </button>
      {error ? <p role="alert" className="max-w-xs text-sm text-danger">{error}</p> : null}
    </div>
  )
}
