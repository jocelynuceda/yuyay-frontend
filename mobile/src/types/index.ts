// Espejo de los DTOs del backend (com.yuyay.*.dto)

import type { NavigatorScreenParams } from '@react-navigation/native';

export type Role = 'USER' | 'ADMIN';
export type CareRole = 'PRINCIPAL' | 'CAREGIVER';
export type ConfidenceLevel = 'CONFIRMED' | 'UNCERTAIN';
export type ChangeType = 'CREATED' | 'UPDATED' | 'DELETED';
export type OcrStatus = 'PENDING' | 'DONE' | 'FAILED';
export type AccessAction = 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE' | 'OPEN_HANDOFF_LINK' | 'EXCHANGE_DELEGATION';
export type NotificationType = 'ENTRY_CHANGED' | 'INVITATION' | 'DELEGATION';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresInSeconds: number;
  user: User;
}

export interface CareSubject {
  id: number;
  name: string;
  birthDate: string | null;
  notes: string | null;
  createdAt: string;
  myRole: CareRole;
}

export interface CareRelationship {
  id: number;
  careSubjectId: number;
  careSubjectName: string;
  user: { id: number; name: string; email: string };
  role: CareRole;
  status: 'PENDING' | 'ACTIVE' | 'REVOKED';
  relationshipLabel: string | null;
  invitedAt: string | null;
  acceptedAt: string | null;
}

export interface InviteCaregiverInput {
  email: string;
  role: CareRole;
  relationshipLabel?: string;
}

export interface HandoffItem {
  healthEntryId: number;
  categoryCode: string;
  versionNumber: number;
  title: string;
  details: string | null;
  dose: string | null;
  frequency: string | null;
  occurredOn: string | null;
  confidenceLevel: ConfidenceLevel;
  notes: string | null;
  declaredAt: string;
}

export interface Handoff {
  id: number;
  careSubjectId: number;
  reason: string;
  questions: string | null;
  createdAt: string;
}

export interface HandoffDetail extends Handoff {
  items: HandoffItem[];
}

export interface HandoffInput {
  reason: string;
  questions?: string;
  healthEntryIds: number[];
}

export interface HandoffSession {
  id: number;
  expiresAt: string;
  sessionWindowMinutes: number;
  firstOpenedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface HandoffSessionCreated {
  id: number;
  token: string;
  expiresAt: string;
  sessionWindowMinutes: number;
}

export interface Delegation {
  id: number;
  careSubjectId: number;
  grantedBy: { id: number; name: string; email: string };
  granteeName: string;
  granteeEmail: string;
  categoryCodes: string[];
  validUntil: string;
  exchangedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  active: boolean;
}

export interface DelegationInput {
  granteeName: string;
  granteeEmail: string;
  categoryCodes: string[];
  validUntil: string;
}

export interface DelegationCreated {
  delegation: Delegation;
  token: string;
  shareLink: string;
}

/** Sesión de quien abrió un acceso delegado: no tiene cuenta, solo este token temporal. */
export interface DelegateSession {
  accessToken: string;
  expiresAt: string;
  careSubjectName: string;
  granteeName: string;
  categoryCodes: string[];
  /** Código con el que se abrió: al volver al mismo enlace se reutiliza esta sesión. */
  sourceToken: string;
}

export interface HealthCategory {
  id: number;
  code: string;
  name: string;
  description: string | null;
}

export interface HealthEntryVersion {
  id: number;
  versionNumber: number;
  changeType: ChangeType;
  title: string;
  details: string | null;
  dose: string | null;
  frequency: string | null;
  occurredOn: string | null;
  confidenceLevel: ConfidenceLevel;
  notes: string | null;
  sourceAttachmentId: number | null;
  declaredBy: { id: number; name: string };
  declaredAt: string;
}

export interface HealthEntry {
  id: number;
  careSubjectId: number;
  categoryCode: string;
  categoryName: string;
  createdAt: string;
  latestVersion: HealthEntryVersion;
}

export interface HealthEntryInput {
  categoryCode: string;
  title: string;
  details?: string;
  dose?: string;
  frequency?: string;
  confidenceLevel: ConfidenceLevel;
  sourceAttachmentId?: number;
}

/** PATCH reemplaza la versión completa: lo que no se envía queda vacío en la nueva versión. */
export interface HealthEntryUpdate {
  title: string;
  details?: string | null;
  dose?: string | null;
  frequency?: string | null;
  occurredOn?: string | null;
  notes?: string | null;
  confidenceLevel: ConfidenceLevel;
}

export interface Attachment {
  id: number;
  careSubjectId: number;
  uploadedByName: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  ocrStatus: OcrStatus;
  ocrText: string | null;
  ocrError: string | null;
  uploadedAt: string;
}

export interface AccessLog {
  id: number;
  userId: number | null;
  delegationId: number | null;
  action: AccessAction;
  targetType: string | null;
  targetId: number | null;
  visitorName: string | null;
  visitorRole: string | null;
  occurredAt: string;
}

export interface Consultation {
  id: number;
  careSubjectId: number;
  createdByUserId: number;
  date: string;
  /** Hora opcional, como "15:30:00". */
  time: string | null;
  reason: string;
  notes: string | null;
  createdAt: string;
}

export interface ConsultationInput {
  date: string;
  time?: string;
  reason: string;
  notes?: string;
}

/** En PATCH lo ausente no cambia: para quitar la hora se envía clearTime. */
export interface ConsultationUpdate extends Required<Omit<ConsultationInput, 'time'>> {
  time?: string;
  clearTime: boolean;
}

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  body: string | null;
  careSubjectId: number | null;
  read: boolean;
  createdAt: string;
}

export interface ApiErrorBody {
  status: number;
  message: string;
  fieldErrors?: { field: string; message: string }[] | null;
}

/* ---------- Navegación ---------- */

export type RootStackParamList = {
  Main: undefined;
  Delegate: { token?: string } | undefined;
};

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type TabNavigatorParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList> | undefined;
  Notifications: undefined;
  Profile: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  SubjectDetail: { subjectId: number; name: string };
  NewSubject: undefined;
  EditSubject: { subject: CareSubject };
  NewEntry: {
    subjectId: number;
    categoryCode?: string;
    details?: string;
    sourceAttachmentId?: number;
    /** Vuelve a la pantalla anterior en lugar de saltarse la revisión del documento */
    returnToSource?: boolean;
  };
  EditEntry: { subjectId: number; entryId: number };
  EntryHistory: { subjectId: number; entryId: number };
  Caregivers: { subjectId: number; isPrincipal: boolean };
  InviteCaregiver: { subjectId: number };
  Handoffs: { subjectId: number };
  NewHandoff: { subjectId: number };
  HandoffView: { handoffId: number };
  Delegations: { subjectId: number; isPrincipal: boolean };
  NewDelegation: { subjectId: number };
  Consultations: { subjectId: number; subjectName: string; isPrincipal: boolean };
  NewConsultation: { subjectId: number; consultation?: Consultation };
  ConsultationChanges: { subjectId: number; consultationId: number; since: string };
  AccessLog: { subjectId: number };
  AccessLogDetail: { subjectId: number; log: AccessLog; actor: string };
  Documents: { subjectId: number };
  ReviewOcr: { subjectId: number; attachmentId: number };
  VoiceNotes: { subjectId: number };
  UpcomingConsultations: undefined;
  NearbyClinics: undefined;
};
