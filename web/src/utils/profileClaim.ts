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
export function clearClaimToken() { activeToken = null }

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
  phase: 'ready' | 'saving' | 'uncertain' | 'failed' | 'saved'
  result: ClaimExchangeResponse | null
  message: string | null
}
type ClaimAttempt = ReturnType<typeof createClaimAttempt>
const attempts = new Map<string, { userId: number; attempt: ClaimAttempt }>()
const unresolved = new Set<object>()
const marker = 'yuyay.claim-history-check-required'

function writeMarker(value: boolean) {
  try {
    if (value) window.localStorage.setItem(marker, '1')
    else window.localStorage.removeItem(marker)
  } catch { /* Sin almacenamiento, la página explica que debe comprobarse el historial. */ }
}

export function requiresClaimHistoryCheck() {
  if (unresolved.size) return false
  try { return window.localStorage.getItem(marker) === '1' } catch { return true }
}
export function acknowledgeClaimHistory() { if (!unresolved.size) writeMarker(false) }

export function createClaimAttempt(exchange: () => Promise<ClaimExchangeResponse>, token: string) {
  let state: ClaimState = { phase: 'ready', result: null, message: null }
  let disposed = false
  const identity = {}
  const listeners = new Set<() => void>()
  const update = (patch: Partial<ClaimState>) => {
    state = { ...state, ...patch }
    listeners.forEach((notify) => notify())
  }
  return {
    getSnapshot: () => state,
    subscribe: (notify: () => void) => { listeners.add(notify); return () => { listeners.delete(notify) } },
    async submit() {
      // Síncrono: un doble clic o una pantalla reabierta no puede repetir el canje.
      if (disposed || state.phase !== 'ready') return
      unresolved.add(identity)
      writeMarker(true) // Solo un indicador: nunca token, correo, nombre ni información clínica.
      update({ phase: 'saving', message: null })
      try {
        const result = await exchange()
        if (disposed) return
        unresolved.delete(identity)
        if (!unresolved.size) writeMarker(false)
        update({ phase: 'saved', result })
      } catch (error) {
        if (disposed) return
        const status = getErrorStatus(error)
        if (status === undefined || status === 0 || status >= 500 || status === 408) {
          update({
            phase: 'uncertain',
            message: 'No sabemos si se completó la entrega. Comprueba tus personas antes de realizar otra operación. No volveremos a enviar este canje automáticamente.',
          })
        } else {
          unresolved.delete(identity)
          if (!unresolved.size) writeMarker(false)
          update({ phase: 'failed', message: claimErrorMessage(error, token) })
        }
      }
    },
    dispose() {
      disposed = true
      unresolved.delete(identity)
      listeners.clear()
      state = { phase: 'ready', result: null, message: null }
    },
  }
}

export function acquireClaimAttempt(userId: number, token: string, exchange: () => Promise<ClaimExchangeResponse>) {
  const key = userId + ':' + token
  let entry = attempts.get(key)
  if (!entry) {
    entry = { userId, attempt: createClaimAttempt(exchange, token) }
    attempts.set(key, entry)
  }
  return entry.attempt
}

export function forgetClaimAttempts(userId: number) {
  for (const [key, entry] of attempts) {
    if (entry.userId !== userId) continue
    entry.attempt.dispose()
    attempts.delete(key)
  }
}
