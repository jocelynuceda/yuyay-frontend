export type CareAuthorizationType = 'SELF' | 'FICTITIOUS' | 'HOLDER_PERMISSION' | 'LEGAL_REPRESENTATION' | 'PENDING'
export type CareAuthorizationScope = 'OWN_DATA' | 'FICTITIOUS_DATA_ONLY' | 'WITHIN_DECLARED_AUTHORIZATION'

export interface CareAuthorizationOption {
  type: CareAuthorizationType
  label: string
  description: string
  scope: CareAuthorizationScope | null
  confirmationText: string | null
}

export interface CareAuthorizationPolicy {
  textVersion: string
  thirdPartyQuestion: string
  options: CareAuthorizationOption[]
}

export interface CareAuthorizationInput {
  type: Exclude<CareAuthorizationType, 'PENDING'>
  textVersion: string
  confirmed: true
}

export interface CareAuthorizationDeclaration {
  id: number
  careSubjectId: number
  declaredByUserId: number
  type: CareAuthorizationInput['type']
  scope: CareAuthorizationScope
  textVersion: string
  text: string
  declaredAt: string
}

export interface CareSubjectCreation<T> {
  requestId: string
  declaration: CareAuthorizationInput
  data: T
}
