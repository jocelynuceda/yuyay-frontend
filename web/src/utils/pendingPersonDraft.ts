import { z } from 'zod'

export const pendingPersonPrefix = 'yuyay.pendingPerson.v1.'
const logoutMarker = 'yuyay.pendingPerson.logout'

function withDraftLock<T>(operation: () => T) {
  return window.navigator.locks ? window.navigator.locks.request(pendingPersonPrefix, operation) : operation()
}

export async function clearPendingPeople() {
  let storage: Storage
  try { storage = window.localStorage } catch { return } // El navegador bloquea este almacenamiento.
  await withDraftLock(() => {
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i)
      if (key?.startsWith(pendingPersonPrefix)) storage.removeItem(key)
    }
    // Invalida también un primer autoguardado que todavía no tenía una clave que borrar.
    storage.removeItem(logoutMarker)
  })
}

const draftSchema = z.object({
  requestId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  name: z.string(), birthDate: z.string(), notes: z.string(),
  gender: z.enum(['', 'MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']),
})

/** Cada formulario compara sus cambios con la copia que abrió o guardó por última vez. */
export function openPendingPerson(draftKey?: string) {
  if (!draftKey) return
  const key = draftKey
  let seen: string | null = null
  let openedAt: string | undefined
  let draft: z.infer<typeof draftSchema> | undefined
  try {
    openedAt = window.localStorage.getItem(logoutMarker) ?? undefined
    if (!openedAt) {
      openedAt = Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-')
      window.localStorage.setItem(logoutMarker, openedAt)
    }
    seen = window.localStorage.getItem(key)
    if (seen) draft = draftSchema.parse(JSON.parse(seen))
  } catch { /* Un borrador ilegible no impide abrir el formulario. */ }

  async function update(next: string | null) {
    const apply = () => {
      if (window.localStorage.getItem(logoutMarker) !== openedAt) return false
      if (window.localStorage.getItem(key) !== seen) return false
      if (next === null) window.localStorage.removeItem(key)
      else window.localStorage.setItem(key, next)
      seen = next
      return true
    }
    // Serializa lectura y escritura entre pestañas cuando ambas actúan a la vez.
    return withDraftLock(apply)
  }
  return { draft, update }
}
