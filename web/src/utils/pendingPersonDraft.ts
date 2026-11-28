import { z } from 'zod'

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
  let draft: z.infer<typeof draftSchema> | undefined
  try {
    seen = window.localStorage.getItem(key)
    if (seen) draft = draftSchema.parse(JSON.parse(seen))
  } catch { /* Un borrador ilegible no impide abrir el formulario. */ }

  async function update(next: string | null) {
    const apply = () => {
      if (window.localStorage.getItem(key) !== seen) return false
      if (next === null) window.localStorage.removeItem(key)
      else window.localStorage.setItem(key, next)
      seen = next
      return true
    }
    // Serializa lectura y escritura entre pestañas cuando ambas actúan a la vez.
    return window.navigator.locks ? window.navigator.locks.request(key, apply) : apply()
  }
  return { draft, update }
}
