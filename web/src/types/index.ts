// Contrato del backend dbp-yuyay (/api/v1).
// LocalDate = 'YYYY-MM-DD'; Instant = fecha ISO con zona.

export type CareRole = 'PRINCIPAL' | 'CAREGIVER'
export type CareStatus = 'PENDING' | 'ACTIVE' | 'REVOKED'
export type ConfidenceLevel = 'CONFIRMED' | 'UNCERTAIN'
export type ChangeType = 'CREATED' | 'UPDATED' | 'DELETED'
export type AccessAction = 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE' | 'OPEN_HANDOFF_LINK' | 'EXCHANGE_DELEGATION'

export const CATEGORY_CODES = ['ALLERGY', 'CONDITION', 'MEDICATION', 'IMMUNIZATION', 'EPISODE', 'EXAM_RESULT'] as const
export type CategoryCode = (typeof CATEGORY_CODES)[number]
export const MEDICATION: CategoryCode = 'MEDICATION'

// ---- Comunes ----

export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

/** page empieza en 0; size máximo 100; sort = 'campo,asc|desc'. */
export interface PageParams {
  page?: number
  size?: number
  sort?: string
}

export interface ErrorResponse {
  timestamp: string
  status: number
  error: string
  message: string
  path: string
  fieldErrors: { field: string; message: string }[] | null
}

export interface UserSummary {
  id: number
  name: string
}

export interface CareUserSummary extends UserSummary {
  email: string
}

// ---- Personas ----

export interface CareSubject {
  id: number
  name: string
  birthDate: string | null
  notes: string | null
  createdAt: string
  myRole: CareRole
}

export interface CareSubjectRequest {
  name: string
  birthDate: string | null
  notes: string | null
}

// ---- Registros de salud ----

export interface HealthCategory {
  id: number
  code: CategoryCode
  name: string
  description: string
}

export interface HealthEntryVersion {
  id: number
  versionNumber: number
  changeType: ChangeType
  title: string
  details: string | null
  dose: string | null
  frequency: string | null
  occurredOn: string | null
  confidenceLevel: ConfidenceLevel
  notes: string | null
  declaredBy: UserSummary
  declaredAt: string
  sourceAttachmentId: number | null
}

export interface HealthEntry {
  id: number
  careSubjectId: number
  categoryCode: CategoryCode
  categoryName: string
  createdBy: UserSummary
  createdAt: string
  deletedAt: string | null
  latestVersion: HealthEntryVersion
}

/** PATCH reemplaza todos los campos. Dosis y frecuencia solo para MEDICATION. */
export interface HealthEntryUpdateRequest {
  title: string
  details: string | null
  dose: string | null
  frequency: string | null
  occurredOn: string | null
  confidenceLevel: ConfidenceLevel
  notes: string | null
}

export interface HealthEntryCreateRequest extends HealthEntryUpdateRequest {
  categoryCode: CategoryCode
  sourceAttachmentId?: number | null
}

export interface HealthEntryListParams extends PageParams {
  category?: CategoryCode
}

// ---- Consultas ----

export interface Consultation {
  id: number
  careSubjectId: number
  createdByUserId: number
  date: string
  /** Hora opcional, 'HH:mm:ss'. */
  time: string | null
  reason: string
  notes: string | null
  createdAt: string
}

export interface ConsultationDetail extends Consultation {
  careSubjectName: string
}

export interface ConsultationRequest {
  date: string
  time: string | null
  reason: string
  notes: string | null
}

/** En PATCH lo ausente no cambia: para quitar la hora se envía clearTime y para vaciar las notas, ''. */
export interface ConsultationUpdate {
  date: string
  time?: string
  clearTime: boolean
  reason: string
  notes: string
}

// ---- Cuidadores ----

export interface CareRelationship {
  id: number
  careSubjectId: number
  careSubjectName: string
  user: CareUserSummary
  role: CareRole
  status: CareStatus
  relationshipLabel: string | null
  invitedAt: string
  acceptedAt: string | null
  revokedAt: string | null
}

export interface CareInviteRequest {
  email: string
  role: CareRole
  relationshipLabel: string | null
}

// ---- Delegaciones ----

export interface Delegation {
  id: number
  careSubjectId: number
  careSubjectName: string
  grantedBy: CareUserSummary
  granteeName: string
  granteeEmail: string
  categoryCodes: CategoryCode[]
  includeConsultations: boolean
  validUntil: string
  exchangedAt: string | null
  revokedAt: string | null
  createdAt: string
  active: boolean
}

export interface DelegationRequest {
  granteeName: string
  granteeEmail: string
  categoryCodes: CategoryCode[]
  includeConsultations: boolean
  validUntil: string // Instant futuro
}

export interface DelegationCreated {
  delegation: Delegation
  token: string
  shareLink: string
}

export interface DelegateSession {
  accessToken: string
  tokenType: string
  expiresAt: string
  careSubjectId: number
  careSubjectName: string
  granteeName: string
  categoryCodes: CategoryCode[]
  /** Falta en las sesiones guardadas antes de que existiera esta opción. */
  includeConsultations?: boolean
}

export interface DelegateMe {
  delegationId: number
  careSubjectId: number
  careSubjectName: string
  granteeName: string
  categoryCodes: CategoryCode[]
  includeConsultations: boolean
  validUntil: string
}

/** Sin las notas: pueden mencionar información que no se compartió. */
export type DelegateConsultation = Pick<Consultation, 'id' | 'date' | 'time' | 'reason'>

// ---- Traspasos ----

export interface Handoff {
  id: number
  careSubjectId: number
  createdByUserId: number
  reason: string
  questions: string | null
  createdAt: string
}

export interface HandoffItem {
  healthEntryId: number
  healthEntryVersionId: number
  categoryCode: CategoryCode
  versionNumber: number
  changeType: ChangeType
  title: string
  details: string | null
  dose: string | null
  frequency: string | null
  occurredOn: string | null
  confidenceLevel: ConfidenceLevel
  notes: string | null
  declaredAt: string
}

export interface HandoffDetail extends Handoff {
  items: HandoffItem[]
}

export interface HandoffRequest {
  reason: string
  questions: string | null
  healthEntryIds: number[]
}

export interface HandoffSession {
  id: number
  handoffId: number
  expiresAt: string
  sessionWindowMinutes: number
  firstOpenedAt: string | null
  revokedAt: string | null
  createdAt: string
}

export interface HandoffSessionRequest {
  expiresInHours: number // 1–72
  sessionWindowMinutes: number // ≥ 1
}

export interface HandoffSessionCreated {
  id: number
  token: string
  expiresAt: string
  sessionWindowMinutes: number
  createdAt: string
}

export interface OpenHandoffRequest {
  visitorName: string
  visitorRole: string
}

export interface HandoffPublicView {
  handoffId: number
  careSubjectName: string
  reason: string
  questions: string | null
  createdAt: string
  items: HandoffItem[]
}

// ---- Bitácora ----

export interface AccessLog {
  id: number
  careSubjectId: number
  userId: number | null
  delegationId: number | null
  action: AccessAction
  targetType: string
  targetId: number | null
  visitorName: string | null
  visitorRole: string | null
  occurredAt: string
}

// ---- Avisos y perfil ----

export interface Notification {
  id: number
  type: 'ENTRY_CHANGED' | 'INVITATION' | 'CAREGIVER_JOINED' | (string & {})
  title: string
  body: string
  careSubjectId: number | null
  read: boolean
  readAt: string | null
  createdAt: string
}

export interface UnreadCount {
  unreadCount: number
}

export interface UserProfile {
  id: number
  email: string
  name: string
  role: string
  createdAt: string
}

// ---- Documentos ----

export type OcrStatus = 'PENDING' | 'DONE' | 'FAILED'

export interface Attachment {
  id: number
  careSubjectId: number
  consultationId: number | null
  uploadedById: number
  uploadedByName: string
  originalFilename: string
  contentType: string
  sizeBytes: number
  ocrStatus: OcrStatus
  ocrText: string | null
  ocrError: string | null
  uploadedAt: string
  ocrCompletedAt: string | null
}

export interface AttachmentAccess {
  url: string
  expiresAt: string
}

export type { User, LoginRequest, RegisterRequest, AuthResponse } from './auth'
