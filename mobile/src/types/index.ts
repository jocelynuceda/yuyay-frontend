// Espejo de los DTOs del backend (com.yuyay.*.dto)

import type { NavigatorScreenParams } from '@react-navigation/native';

export type Role = 'USER' | 'ADMIN';
export type CareRole = 'PRINCIPAL' | 'CAREGIVER';
export type ConfidenceLevel = 'CONFIRMED' | 'UNCERTAIN';
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

export interface HealthCategory {
  id: number;
  code: string;
  name: string;
  description: string | null;
}

export interface HealthEntryVersion {
  id: number;
  versionNumber: number;
  title: string;
  details: string | null;
  dose: string | null;
  frequency: string | null;
  occurredOn: string | null;
  confidenceLevel: ConfidenceLevel;
  notes: string | null;
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
}

export interface Consultation {
  id: number;
  careSubjectId: number;
  createdByUserId: number;
  date: string;
  reason: string;
  notes: string | null;
  createdAt: string;
}

export interface ConsultationInput {
  date: string;
  reason: string;
  notes?: string;
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

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
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
  NewEntry: { subjectId: number; categoryCode?: string };
  Caregivers: { subjectId: number; isPrincipal: boolean };
  InviteCaregiver: { subjectId: number };
  Handoffs: { subjectId: number };
  NewHandoff: { subjectId: number };
  HandoffView: { handoffId: number };
  Delegations: { subjectId: number; isPrincipal: boolean };
  NewDelegation: { subjectId: number };
  Consultations: { subjectId: number; isPrincipal: boolean };
  NewConsultation: { subjectId: number };
  UpcomingConsultations: undefined;
  NearbyClinics: undefined;
};
