import { exchangeDelegationToken } from '../services/api/delegations'
import type { DelegateSession } from '../types'

// El backend canjea cada enlace una sola vez: la sesión se guarda para que recargar la página
// no deje al delegado sin acceso. Vence con la delegación (expiresAt).
const storageKey = (token: string) => `yuyay.delegate.${token}`
const inFlight = new Map<string, Promise<DelegateSession>>()

function read(token: string): DelegateSession | null {
  try {
    const raw = localStorage.getItem(storageKey(token))
    if (!raw) return null
    const session = JSON.parse(raw) as DelegateSession
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(storageKey(token))
      return null
    }
    return session
  } catch {
    return null
  }
}

export function forgetDelegateSession(token: string) {
  try {
    localStorage.removeItem(storageKey(token))
  } catch {
    // Sin almacenamiento disponible no hay nada que borrar
  }
}

/** Devuelve la sesión guardada o canjea el token (una sola vez aunque se llame dos veces seguidas). */
export function getDelegateSession(token: string): Promise<DelegateSession> {
  const saved = read(token)
  if (saved) return Promise.resolve(saved)

  let pending = inFlight.get(token)
  if (!pending) {
    pending = exchangeDelegationToken(token)
      .then((session) => {
        try {
          localStorage.setItem(storageKey(token), JSON.stringify(session))
        } catch {
          // Sin almacenamiento la sesión dura lo que dure la pestaña
        }
        return session
      })
      .finally(() => inFlight.delete(token))
    inFlight.set(token, pending)
  }
  return pending
}
