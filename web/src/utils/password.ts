const MIN_CHARACTERS = 8
const MAX_BYTES = 72

const utf8Bytes = (value: string) => new TextEncoder().encode(value).length
const hasLetter = (value: string) => /[A-Za-z]/.test(value)
const hasNumber = (value: string) => /[0-9]/.test(value)

/** Mismas reglas que el backend y la app móvil: 8 caracteres, hasta 72 bytes UTF-8, una letra A-Z y un número. */
export function passwordChecks(password: string) {
  return [
    { ok: password.length >= MIN_CHARACTERS, label: '8 caracteres' },
    { ok: password.length > 0 && utf8Bytes(password) <= MAX_BYTES, label: 'Longitud admitida' },
    { ok: hasLetter(password), label: 'Una letra (A-Z)' },
    { ok: hasNumber(password), label: 'Un número' },
  ]
}

/** Primer requisito que falta, o null si la contraseña es válida. */
export function passwordError(password: string): string | null {
  if (password.length < MIN_CHARACTERS) return 'Usa al menos 8 caracteres.'
  if (utf8Bytes(password) > MAX_BYTES) return 'La contraseña es demasiado larga. Usa menos caracteres o símbolos.'
  if (!hasLetter(password)) return 'Incluye al menos una letra de la A a la Z.'
  if (!hasNumber(password)) return 'Incluye al menos un número.'
  return null
}
