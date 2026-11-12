import { useCallback, useSyncExternalStore } from 'react'
import { avatarId, defaultAvatar, parseAvatarId, type AvatarChoice } from '../utils/avatars'
import { ageFrom } from '../utils/format'
import { useAuth } from './useAuth'

/**
 * Avatar elegido por el usuario, guardado solo en este navegador (el backend no tiene un campo para esto).
 * Un único JSON { "<idUsuario>:me" | "<idUsuario>:subject:<id>": "cub-lion" } para no mezclar cuentas.
 */
const STORAGE_KEY = 'yuyay.avatars'
const CHANGE_EVENT = 'yuyay:avatars'

let cachedRaw: string | null | undefined
let cached: Record<string, string> = {}

function readAll(): Record<string, string> {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    // Almacenamiento bloqueado: se usa el avatar automático
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : {}
      cached = parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
    } catch {
      cached = {}
    }
  }
  return cached
}

function subscribe(listener: () => void) {
  // "storage" avisa de cambios en otras pestañas; el evento propio, de esta
  window.addEventListener('storage', listener)
  window.addEventListener(CHANGE_EVENT, listener)
  return () => {
    window.removeEventListener('storage', listener)
    window.removeEventListener(CHANGE_EVENT, listener)
  }
}

function save(key: string, value: string | null) {
  const next = { ...readAll() }
  if (value) next[key] = value
  else delete next[key]
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    return
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export type AvatarTarget = { type: 'me' } | { type: 'subject'; id: number; birthDate?: string | null }

/** Avatar a mostrar (el elegido o el automático) y cómo cambiarlo; `null` vuelve al automático. */
export function useAvatar(target: AvatarTarget) {
  const { user } = useAuth()
  const key = target.type === 'me' ? `${user?.id ?? 0}:me` : `${user?.id ?? 0}:subject:${target.id}`
  const stored = useSyncExternalStore(subscribe, () => readAll()[key] ?? null, () => null)
  const automatic = target.type === 'me' ? defaultAvatar(30) : defaultAvatar(ageFrom(target.birthDate), target.id)
  const chosen = parseAvatarId(stored)
  const setAvatar = useCallback((choice: AvatarChoice | null) => save(key, choice ? avatarId(choice) : null), [key])
  return { avatar: chosen ?? automatic, automatic, isCustom: chosen !== null, setAvatar }
}
