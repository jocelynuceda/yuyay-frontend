/** Lo que declara la cuenta sobre el perfil. Es una declaración, no una verificación del titular. */
export type CareAuthorizationType = 'SELF' | 'FICTITIOUS' | 'HOLDER_PERMISSION' | 'LEGAL_REPRESENTATION' | 'PENDING'

export type CareAuthorizationScope = 'OWN_DATA' | 'FICTITIOUS_DATA_ONLY' | 'WITHIN_DECLARED_AUTHORIZATION'

export interface CareAuthorizationOption {
  type: CareAuthorizationType
  label: string
  description: string
  /** null para PENDING: no se guarda ni perfil ni declaración. */
  scope: CareAuthorizationScope | null
  /** null para PENDING: no hay nada que confirmar. */
  confirmationText: string | null
}

/** Catálogo vigente: se muestra tal cual y se envía su versión al declarar. */
export interface CareAuthorizationPolicy {
  textVersion: string
  thirdPartyQuestion: string
  options: CareAuthorizationOption[]
}

export interface CareAuthorizationDeclarationRequest {
  type: CareAuthorizationType
  textVersion: string
  confirmed: boolean
}

export interface CareAuthorizationUpdateRequest extends CareAuthorizationDeclarationRequest {
  /** ID de la declaración vigente que se revisó; null si el perfil no tenía ninguna. */
  previousDeclarationId: number | null
}

export interface CareAuthorizationDeclaration {
  id: number
  careSubjectId: number
  declaredByUserId: number
  type: CareAuthorizationType
  scope: CareAuthorizationScope
  textVersion: string
  text: string
  declaredAt: string
}
