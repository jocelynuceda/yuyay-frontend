import { getErrorMessage, getErrorStatus } from './apiErrors'
import type { ClaimExchangeResponse, ClaimInvitation } from '../types/profileClaim'

declare global {
  interface Window { __yuyayClaimToken?: string }
}
let activeToken: string | null = null

/** El arranque retira el token de la dirección antes de cargar recursos externos. Solo vive en memoria. */
export function rememberClaimToken(token: string) { activeToken = token }
export function getClaimToken(): string | null {
  if (typeof window !== 'undefined' && window.__yuyayClaimToken !== undefined) {
    activeToken = window.__yuyayClaimToken
    delete window.__yuyayClaimToken
  }
  return activeToken
}
export function clearClaimToken(expected?: string) {
  if (expected !== undefined && getClaimToken() !== expected) return
  activeToken = null
  if (typeof window !== 'undefined') delete window.__yuyayClaimToken
}

export function claimInvitationStatus(invitation: ClaimInvitation, now = Date.now()) {
  if (invitation.exchangedAt) return 'Utilizada'
  if (invitation.revokedAt) return 'Revocada'
  if (!invitation.pending || Date.parse(invitation.validUntil) <= now) return 'Vencida'
  return 'Pendiente'
}

export function claimErrorMessage(error: unknown, token = '') {
  const status = getErrorStatus(error)
  if (status === 403) return 'Este enlace no corresponde a esta cuenta o ya no tienes autorización. Usa el correo que recibió la invitación.'
  if (status === 404) return 'El enlace de entrega no es válido o ya no está disponible.'
  const message = getErrorMessage(error)
  return token ? message.split(token).join('[enlace]').split(encodeURIComponent(token)).join('[enlace]') : message
}

type ClaimState = {
  phase: 'checking' | 'ready' | 'saving' | 'uncertain' | 'failed' | 'saved' | 'resolved'
  result: ClaimExchangeResponse | null
  message: string | null
  historyRequired: boolean
  historyVisited: boolean
}
type ClaimAttempt = ReturnType<typeof createClaimAttempt>
const attempts = new Map<string, { userId: number; attempt: ClaimAttempt }>()

/** Un SHA-256 de cuenta + llave aleatoria identifica la revisión sin persistir ninguno de esos datos. */
async function markerFor(userId: number, token: string) {
  const bytes = new TextEncoder().encode(userId + ':' + token)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return 'yuyay.claim-check.v1.' + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function createClaimAttempt(exchange: () => Promise<ClaimExchangeResponse>, token: string, userId?: number) {
  let state: ClaimState = {
    phase: userId === undefined ? 'ready' : 'checking', result: null, message: null,
    historyRequired: false, historyVisited: false,
  }
  let disposed = false
  let marker: string | null = null
  const listeners = new Set<() => void>()
  const update = (patch: Partial<ClaimState>) => {
    state = { ...state, ...patch }
    listeners.forEach((notify) => notify())
  }
  function persist(value: boolean) {
    if (!marker) return
    try {
      if (value) window.localStorage.setItem(marker, '1')
      else window.localStorage.removeItem(marker)
    } catch { /* Sin almacenamiento, se exige comprobar las personas al reabrir el enlace. */ }
  }
  const initialized = userId === undefined ? Promise.resolve() : (async () => {
    let historyRequired = true
    try {
      marker = await markerFor(userId, token)
      historyRequired = window.localStorage.getItem(marker) === '1'
    } catch { /* No sustituir SHA-256 por un identificador débil ni guardar la llave. */ }
    if (!disposed) update({ phase: 'ready', historyRequired })
  })()

  return {
    initialized,
    getSnapshot: () => state,
    subscribe: (notify: () => void) => { listeners.add(notify); return () => { listeners.delete(notify) } },
    visitHistory() {
      if (!disposed && (state.phase === 'uncertain' || state.historyRequired)) update({ historyVisited: true })
    },
    acknowledgeHistory() {
      if (disposed || !state.historyVisited) return
      if (state.phase === 'uncertain') {
        persist(false)
        update({ phase: 'resolved', historyRequired: false, message: null })
      } else if (state.phase === 'ready' && state.historyRequired) {
        persist(false)
        update({ historyRequired: false, historyVisited: false })
      }
    },
    async submit() {
      // La transición es síncrona: doble clic y reapertura comparten el mismo intento.
      if (disposed || state.phase !== 'ready' || state.historyRequired) return
      persist(true) // Solo "1" bajo una clave opaca; sin token, correo, nombre ni datos clínicos.
      update({ phase: 'saving', message: null })
      try {
        const result = await exchange()
        if (disposed) return
        persist(false)
        update({ phase: 'saved', result })
      } catch (error) {
        if (disposed) return
        const status = getErrorStatus(error)
        if (status === undefined || status === 0 || status >= 500 || status === 408) {
          persist(true)
          update({
            phase: 'uncertain',
            message: 'No sabemos si se completó la entrega. Comprueba tus personas antes de realizar otra operación. No volveremos a enviar este canje automáticamente.',
          })
        } else {
          persist(false)
          update({ phase: 'failed', message: claimErrorMessage(error, token) })
        }
      }
    },
    dispose() {
      // Logout libera datos en memoria, pero conserva el aviso de esta cuenta e invitación.
      disposed = true
      listeners.clear()
      state = { phase: 'ready', result: null, message: null, historyRequired: false, historyVisited: false }
    },
  }
}

export function acquireClaimAttempt(userId: number, token: string, exchange: () => Promise<ClaimExchangeResponse>) {
  const key = userId + ':' + token
  let entry = attempts.get(key)
  if (!entry) {
    entry = { userId, attempt: createClaimAttempt(exchange, token, userId) }
    attempts.set(key, entry)
  }
  return entry.attempt
}

export function releaseClaimAttempt(userId: number, token: string) {
  const key = userId + ':' + token
  const entry = attempts.get(key)
  if (entry && ['saved', 'resolved'].includes(entry.attempt.getSnapshot().phase)) {
    entry.attempt.dispose()
    attempts.delete(key)
  }
}

export function forgetClaimAttempts(userId: number) {
  for (const [key, entry] of attempts) {
    if (entry.userId !== userId) continue
    entry.attempt.dispose()
    attempts.delete(key)
  }
}
