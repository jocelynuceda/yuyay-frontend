import { z } from 'zod'

const draftSchema = z.object({
  requestId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  name: z.string(), birthDate: z.string(), notes: z.string(),
  gender: z.enum(['', 'MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']),
})

export function readPendingPerson(key?: string) {
  if (!key) return
  try {
    const raw = window.localStorage.getItem(key)
    if (raw) return draftSchema.parse(JSON.parse(raw))
  } catch { return }
}
