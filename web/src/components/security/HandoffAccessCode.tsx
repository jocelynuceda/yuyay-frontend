import { useEffect, useState } from 'react'
import { accessCodeDeadline, getHandoffAccessCode } from '../../services/security/handoffAccess'
import { getErrorMessage } from '../../utils/apiErrors'
import { focusRing } from '../../utils/styles'

type CodeState =
  | { phase: 'loading' | 'paused' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; code: string | null; seconds: number; period: number }

/** Cada sesión tiene su propio ciclo: no se reutiliza ni un render del código de otro enlace. */
type AccessCodeProps = { sessionId: number; subjectId?: number }

export function HandoffAccessCode(props: AccessCodeProps) {
  return <AccessCode key={`${props.subjectId}:${props.sessionId}`} {...props} />
}

function AccessCode({ sessionId, subjectId }: AccessCodeProps) {
  const [state, setState] = useState<CodeState>({ phase: 'loading' })
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    let generation = 0
    let staleResponses = 0
    let controller: AbortController | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const available = () => document.visibilityState !== 'hidden' && window.navigator.onLine !== false

    async function refresh() {
      const current = ++generation
      controller?.abort()
      clearTimeout(timer)
      if (!active) return
      if (!available()) { setState({ phase: 'paused' }); return }
      setState({ phase: 'loading' })
      controller = new AbortController()
      const startedAt = performance.now()
      try {
        const code = await getHandoffAccessCode(sessionId, controller.signal, subjectId)
        if (!active || current !== generation || !available()) return
        const deadline = accessCodeDeadline(code, startedAt, performance.now())
        if (deadline <= performance.now()) {
          // Al cruzar una ventana, la latencia puede traer el código anterior: ocultarlo y esperar brevemente.
          if (++staleResponses <= 2) timer = setTimeout(() => { void refresh() }, 250)
          else setState({ phase: 'error', message: 'El código venció mientras llegaba. Solicita uno nuevo.' })
          return
        }
        staleResponses = 0
        function tick() {
          if (!active || current !== generation) return
          const remaining = deadline - performance.now()
          if (remaining <= 0) { void refresh(); return }
          setState({ phase: 'ready', code: code.code, seconds: Math.ceil(remaining / 1000), period: code.periodSeconds })
          timer = setTimeout(tick, Math.min(remaining, 250))
        }
        tick()
      } catch (error) {
        if (!active || current !== generation) return
        setState({ phase: 'error', message: getErrorMessage(error) })
      }
    }

    const synchronize = () => { void refresh() }
    synchronize()
    window.addEventListener('focus', synchronize)
    window.addEventListener('online', synchronize)
    window.addEventListener('offline', synchronize)
    document.addEventListener('visibilitychange', synchronize)
    return () => {
      active = false
      generation++
      controller?.abort()
      clearTimeout(timer)
      window.removeEventListener('focus', synchronize)
      window.removeEventListener('online', synchronize)
      window.removeEventListener('offline', synchronize)
      document.removeEventListener('visibilitychange', synchronize)
    }
  }, [sessionId, subjectId, retry])

  const ready = state.phase === 'ready'
  const progress = ready ? state.seconds / state.period : 0
  return (
    <section aria-label="Código de acceso al resumen" className="grid gap-4 rounded-2xl border border-primary-fg/20 bg-primary-tint p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-widest text-muted uppercase">Acceso protegido</p>
          <h3 className="mt-1 font-display text-xl font-semibold">Código de acceso</h3>
        </div>
        <div className="relative size-16 shrink-0 text-primary-fg" aria-hidden="true">
          <svg viewBox="0 0 64 64" className="size-16 -rotate-90" fill="none">
            <circle cx="32" cy="32" r="27" stroke="currentColor" strokeWidth="4" opacity="0.18" />
            <circle cx="32" cy="32" r="27" stroke="currentColor" strokeWidth="4" pathLength="100"
              strokeDasharray="100" strokeDashoffset={100 * (1 - progress)} strokeLinecap="round" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">{ready ? `${state.seconds}s` : '—'}</span>
        </div>
      </div>
      {ready ? (
        <div>
          {state.code === null ? <p role="status" className="font-display text-2xl font-semibold text-ink">Código utilizado</p> : <div role="group" aria-label={`Código de acceso: ${state.code.split('').join(' ')}`} className="font-display text-4xl font-semibold tracking-[0.18em] text-ink tabular-nums sm:text-5xl">
            <span aria-hidden="true">{state.code.slice(0, 3)} {state.code.slice(3)}</span>
          </div>}
          <p className="mt-2 text-sm text-muted">Se renueva cada 30 segundos y se usa una sola vez.</p>
        </div>
      ) : state.phase === 'error' ? (
        <div className="grid gap-2">
          <p role="alert" className="text-sm text-danger">{state.message}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)} className={`justify-self-start text-sm font-semibold text-primary-fg underline ${focusRing}`}>Solicitar nuevo código</button>
        </div>
      ) : (
        <p role="status" className="text-sm text-muted">{state.phase === 'paused' ? 'Código oculto. Se actualizará al volver a esta ventana con conexión.' : 'Obteniendo código seguro…'}</p>
      )}
      <p className="border-t border-primary-fg/15 pt-3 text-sm text-muted">Comparte este código con el médico por separado del enlace, cuando esté listo para abrirlo. Una vez dentro, podrá leer durante el tiempo de consulta configurado.</p>
    </section>
  )
}
