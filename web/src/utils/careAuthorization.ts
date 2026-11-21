import type {
  CareAuthorizationInput,
  CareAuthorizationPolicy,
  CareAuthorizationScope,
  CareAuthorizationType,
  CareSubjectCreation,
} from '../types/careAuthorization'

export const thirdPartyTypes = ['HOLDER_PERMISSION', 'LEGAL_REPRESENTATION', 'PENDING'] as const
export const profileKinds = ['SELF', 'FICTITIOUS', 'THIRD_PARTY'] as const
export type ProfileKind = (typeof profileKinds)[number]
export type ThirdPartyType = (typeof thirdPartyTypes)[number]

const scopes: Record<CareAuthorizationInput['type'], CareAuthorizationScope> = {
  SELF: 'OWN_DATA',
  FICTITIOUS: 'FICTITIOUS_DATA_ONLY',
  HOLDER_PERMISSION: 'WITHIN_DECLARED_AUTHORIZATION',
  LEGAL_REPRESENTATION: 'WITHIN_DECLARED_AUTHORIZATION',
}

export const scopeLabels: Record<CareAuthorizationScope, string> = {
  OWN_DATA: 'Datos propios',
  FICTITIOUS_DATA_ONLY: 'Solo datos ficticios',
  WITHIN_DECLARED_AUTHORIZATION: 'Dentro de lo autorizado',
}

export const declarationLabels: Record<CareAuthorizationInput['type'], string> = {
  SELF: 'Perfil propio',
  FICTITIOUS: 'Perfil ficticio',
  HOLDER_PERMISSION: 'Permiso declarado del titular',
  LEGAL_REPRESENTATION: 'Representación legal declarada',
}

export function makeCareDeclaration(
  policy: CareAuthorizationPolicy | null,
  type: CareAuthorizationType | null,
  acceptedVersion: string | null,
): CareAuthorizationInput | null {
  if (!policy?.textVersion || policy.textVersion !== acceptedVersion || !type || type === 'PENDING') return null
  const option = policy.options.find((candidate) => candidate.type === type)
  if (!option?.confirmationText || option.scope !== scopes[type]) return null
  return { type, textVersion: policy.textVersion, confirmed: true }
}

export interface CreationAttempt<T> {
  request: CareSubjectCreation<T>
  uncertain: boolean
}

export function prepareCareSubjectCreation<T>(
  previous: CreationAttempt<T> | null,
  declaration: CareAuthorizationInput,
  data: T,
  newId: () => string,
): CareSubjectCreation<T> {
  if (previous && (previous.uncertain ||
      (JSON.stringify(previous.request.data) === JSON.stringify(data) &&
       JSON.stringify(previous.request.declaration) === JSON.stringify(declaration)))) return previous.request
  return { requestId: newId(), declaration, data }
}

export function creationOutcomeUncertain(status: number | undefined, previousUncertain = false) {
  if (previousUncertain) return status !== 400 && status !== 409
  return status === undefined || status === 0 || status === 408 || status >= 500
}
