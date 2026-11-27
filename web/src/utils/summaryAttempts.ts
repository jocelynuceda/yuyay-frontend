import { createSummaryReview } from './summaryReview'

type Model = ReturnType<typeof createSummaryReview>
type Attempt = { model: Model; unsubscribe: () => void }
const sessions = new WeakMap<object, Map<string, Attempt>>()
const pending = new Set<Model>()
const identities = new Map<number, object>()

export function summarySession(userId: number) {
  let scope = identities.get(userId)
  if (!scope) {
    scope = {}
    identities.set(userId, scope)
  }
  return scope
}

function warnOnClose(event: BeforeUnloadEvent) {
  if (!pending.size) return
  event.preventDefault()
  event.returnValue = ''
}
const marker = 'yuyay.summary-history-check-required'

function persistPending(value: boolean) {
  try {
    if (value) window.localStorage.setItem(marker, '1')
    else window.localStorage.removeItem(marker)
  } catch {
    // Sin almacenamiento, la siguiente entrada siempre pide revisar el historial.
  }
}

export function requiresSummaryHistoryCheck() {
  if (pending.size) return false
  try { return window.localStorage.getItem(marker) === '1' } catch { return true }
}

export function acknowledgeSummaryHistory() {
  if (!pending.size) persistPending(false)
}

export function acquireSummaryAttempt(session: object, key: string, create: () => Model): Model {
  let attempts = sessions.get(session)
  if (!attempts) {
    attempts = new Map()
    sessions.set(session, attempts)
  }
  const previous = attempts.get(key)
  if (previous) return previous.model
  const model = create()
  const unsubscribe = model.subscribe(() => {
    const phase = model.getSnapshot().phase
    if (phase === 'saving' || phase === 'uncertain') {
      pending.add(model)
      window.addEventListener('beforeunload', warnOnClose)
      persistPending(true)
    } else if (pending.delete(model)) {
      if (!pending.size) {
        persistPending(false)
        window.removeEventListener('beforeunload', warnOnClose)
      }
    }
  })
  attempts.set(key, { model, unsubscribe })
  return model
}

export function releaseSummaryAttempt(session: object, key: string, model: Model) {
  const phase = model.getSnapshot().phase
  if (phase === 'saving' || phase === 'uncertain') return
  const attempts = sessions.get(session)
  if (attempts?.get(key)?.model !== model) return
  attempts.get(key)?.unsubscribe()
  attempts.delete(key)
  model.dispose()
}

/** Descarta incluso los intentos pendientes de una persona cuyo acceso se retiró. */
export function forgetSubjectSummaryAttempts(session: object, subjectId: number) {
  const attempts = sessions.get(session)
  for (const [key, attempt] of attempts ?? []) {
    if (!key.startsWith(`${subjectId}/`)) continue
    attempt.unsubscribe()
    pending.delete(attempt.model)
    attempt.model.dispose()
    attempts?.delete(key)
  }
  if (!pending.size) window.removeEventListener('beforeunload', warnOnClose)
}

/** Cambiar de cuenta descarta datos privados, pero conserva el aviso de resultado desconocido. */
export function forgetSummarySession(session: object) {
  const attempts = sessions.get(session)
  for (const attempt of attempts?.values() ?? []) {
    attempt.unsubscribe()
    pending.delete(attempt.model)
    attempt.model.dispose()
  }
  sessions.delete(session)
  for (const [id, scope] of identities) if (scope === session) identities.delete(id)
  if (!pending.size) window.removeEventListener('beforeunload', warnOnClose)
}
