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
  changeType: ChangeType;
}

export type ChangeType = 'CREATED' | 'UPDATED' | 'DELETED';

export interface Attachment {
  id: number;
  careSubjectId: number;
  consultationId: number | null;
  uploadedById: number;
  uploadedByName: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  ocrStatus: 'PENDING' | 'DONE' | 'FAILED';
  ocrText: string | null;
  ocrError: string | null;
  uploadedAt: string;
  ocrCompletedAt: string | null;
}

export interface AttachmentAccess {
  url: string;
  expiresAt: string;
}

export interface HealthEntry {
  id: number;
  careSubjectId: number;
  categoryCode: string;
  categoryName: string;
  createdAt: string;
  deletedAt: string | null;
  latestVersion: HealthEntryVersion;
}

/** El PATCH reemplaza todos los campos de la versión: lo que no se envía queda en null. */
export interface HealthEntryUpdate {
  title: string;
  details?: string;
  dose?: string;
  frequency?: string;
  occurredOn?: string;
  confidenceLevel: ConfidenceLevel;
  notes?: string;
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
  EntryHistory: { subjectId: number; entryId: number };
  EditEntry: { subjectId: number; entryId: number };
  Documents: { subjectId: number };
};
