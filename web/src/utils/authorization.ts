import axios from 'axios'
import type {
  CareAuthorizationDeclarationRequest,
  CareAuthorizationOption,
  CareAuthorizationPolicy,
  CareAuthorizationType,
} from '../types'

/** Elección en curso: ninguna opción viene marcada y la confirmación empieza desmarcada. */
export interface AuthorizationChoice {
  type: CareAuthorizationType | null
  confirmed: boolean
}

export const emptyAuthorizationChoice: AuthorizationChoice = { type: null, confirmed: false }

export const CHOOSE_AUTHORIZATION = 'Elige una opción para continuar.'
export const CONFIRM_AUTHORIZATION = 'Marca la confirmación para continuar.'
export const AUTHORIZATION_TEXT_CHANGED =
  'El texto de la declaración cambió. Revísalo y vuelve a confirmar para continuar.'

/** Las opciones de perfil propio o ficticio no hacen la pregunta del tercero. */
export function splitAuthorizationOptions(policy: CareAuthorizationPolicy) {
  const isThirdParty = (option: CareAuthorizationOption) =>
    option.scope === 'WITHIN_DECLARED_AUTHORIZATION' || option.type === 'PENDING'
  return {
    ownOptions: policy.options.filter((option) => !isThirdParty(option)),
    thirdPartyOptions: policy.options.filter(isThirdParty),
  }
}

export function findOption(policy: CareAuthorizationPolicy, type: CareAuthorizationType | null) {
  return policy.options.find((option) => option.type === type) ?? null
}

/**
 * Valida la elección antes de enviarla. Devuelve el cuerpo listo para el backend, o el motivo por el
 * que todavía no se puede enviar. Una opción sin confirmación (pendiente) nunca se envía.
 */
export function buildDeclaration(
  policy: CareAuthorizationPolicy,
  choice: AuthorizationChoice,
): { ok: true; declaration: CareAuthorizationDeclarationRequest } | { ok: false; error: string; pending?: true } {
  const option = findOption(policy, choice.type)
  if (!option) return { ok: false, error: CHOOSE_AUTHORIZATION }
  if (!option.confirmationText) return { ok: false, error: option.description, pending: true }
  if (!choice.confirmed) return { ok: false, error: CONFIRM_AUTHORIZATION }
  return { ok: true, declaration: { type: option.type, textVersion: policy.textVersion, confirmed: true } }
}

/** Clave opaca del alta: letras, números y guiones (lo que acepta el backend), única por intento. */
export function newRequestId() {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return uuid
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/**
 * Conserva la misma clave mientras el contenido del alta no cambie, para que un reintento tras un
 * fallo de red recupere el mismo perfil. Si la persona cambia algún dato, la siguiente alta usa otra.
 */
export function createRequestIdTracker(generate: () => string = newRequestId) {
  let last: { content: string; requestId: string } | null = null
  return (content: unknown) => {
    const key = JSON.stringify(content)
    if (!last || last.content !== key) last = { content: key, requestId: generate() }
    return last.requestId
  }
}

/** 409 del backend: el texto de la declaración ya no es el vigente (hay que volver a revisarlo). */
export function isConflict(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 409
}

/** Opción declarada, leída de la copia del texto que guardó el backend (sin la pregunta del tercero). */
export function declarationLabel(text: string) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  return lines.find((line) => !line.endsWith('?')) ?? lines[0] ?? ''
}
