import { exchangeDelegationToken } from '../services/api/delegations'
import type { DelegateSession } from '../types'

// El backend canjea cada enlace una sola vez: la sesión se guarda para que recargar la página
// no deje al delegado sin acceso. Se usa sessionStorage y no localStorage: el token da acceso a
// datos de salud y no debe quedar en el equipo (por ejemplo, una computadora compartida) al
// cerrar la pestaña. También se descarta al vencer la delegación (expiresAt).
const storageKey = (token: string) => `yuyay.delegate.${token}`
const inFlight = new Map<string, Promise<DelegateSession>>()

function read(token: string): DelegateSession | null {
  try {
    const raw = sessionStorage.getItem(storageKey(token))
    if (!raw) return null
    const session = JSON.parse(raw) as DelegateSession
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem(storageKey(token))
      return null
    }
    return session
  } catch {
    return null
  }
}

export function forgetDelegateSession(token: string) {
  try {
    sessionStorage.removeItem(storageKey(token))
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
          sessionStorage.setItem(storageKey(token), JSON.stringify(session))
        } catch {
          // Sin almacenamiento la sesión dura lo que la página esté abierta
        }
        return session
      })
      .finally(() => inFlight.delete(token))
    inFlight.set(token, pending)
  }
  return pending
}
