import { Platform } from 'react-native';
import { API_URL, http, session } from './http';
import { collectPages, type Page } from './pagination';
import type {
  AccessLog,
  Attachment,
  AuthResponse,
  CareRelationship,
  CareSubject,
  Consultation,
  ConsultationInput,
  ConsultationUpdate,
  Delegation,
  DelegationCreated,
  DelegationInput,
  Handoff,
  HandoffDetail,
  HandoffInput,
  HandoffSession,
  HandoffSessionCreated,
  HealthCategory,
  HealthEntry,
  HealthEntryInput,
  HealthEntryUpdate,
  HealthEntryVersion,
  InviteCaregiverInput,
  Notification,
  User,
} from '../types';

/** Quita los campos vacíos para que el backend reciba null. */
function clean<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined)) as T;
}

/** Tamaño máximo que acepta el backend en las listas paginadas. */
const MAX_PAGE_SIZE = 100;

export const login = (email: string, password: string) =>
  http.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data);

export const register = (name: string, email: string, password: string) =>
  http.post<AuthResponse>('/auth/register', { name, email, password }).then((r) => r.data);

export const forgotPassword = (email: string) => http.post('/auth/forgot-password', { email });

export const resetPassword = (email: string, code: string, newPassword: string) =>
  http.post('/auth/reset-password', { email, code, newPassword });

export const logout = (refreshToken: string) => http.post('/auth/logout', { refreshToken });

export const getMe = () => http.get<User>('/users/me').then((r) => r.data);

export const getCareSubjects = () => http.get<CareSubject[]>('/care-subjects').then((r) => r.data);

export const getCareSubject = (id: number) => http.get<CareSubject>(`/care-subjects/${id}`).then((r) => r.data);

export const createCareSubject = (data: { name: string; birthDate?: string; notes?: string }) =>
  http.post<CareSubject>('/care-subjects', clean(data)).then((r) => r.data);

/** PATCH reemplaza los tres datos: lo que llega en null queda vacío. */
export const updateCareSubject = (id: number, data: { name: string; birthDate: string | null; notes: string | null }) =>
  http.patch<CareSubject>(`/care-subjects/${id}`, data).then((r) => r.data);

export const getCareRelationships = (subjectId: number) =>
  http.get<CareRelationship[]>(`/care-subjects/${subjectId}/relationships`).then((r) => r.data);

export const getConsultations = (subjectId: number) =>
  http.get<Consultation[]>(`/care-subjects/${subjectId}/consultations`).then((r) => r.data);

export const createConsultation = (subjectId: number, data: ConsultationInput) =>
  http.post<Consultation>(`/care-subjects/${subjectId}/consultations`, clean(data)).then((r) => r.data);

export const updateConsultation = (consultationId: number, data: ConsultationUpdate) =>
  http.patch<Consultation>(`/consultations/${consultationId}`, data).then((r) => r.data);

export const getConsultationChanges = (subjectId: number, sinceConsultationId: number) =>
  http
    .get<HealthEntryVersion[]>(`/care-subjects/${subjectId}/consultations/changes`, {
      params: { sinceConsultationId },
    })
    .then((r) => r.data);

export const deleteConsultation = (consultationId: number) => http.delete(`/consultations/${consultationId}`);

export const getPendingInvitations = () =>
  http.get<CareRelationship[]>('/me/relationships/pending').then((r) => r.data);

export const acceptInvitation = (relationshipId: number) =>
  http.post<CareRelationship>(`/me/relationships/${relationshipId}/accept`).then((r) => r.data);

export const getHealthCategories = () => http.get<HealthCategory[]>('/health-categories').then((r) => r.data);

export const getHealthEntriesPage = (subjectId: number, page = 0, category?: string) =>
  http.get<Page<HealthEntry> | HealthEntry[]>(`/care-subjects/${subjectId}/health-entries`, {
    params: { page, size: 100, category, sort: 'createdAt,desc' },
  }).then((r) => r.data);

export const getHealthEntries = (subjectId: number, category?: string) =>
  collectPages((page) => getHealthEntriesPage(subjectId, page, category));

export const createHealthEntry = (subjectId: number, data: HealthEntryInput) =>
  http.post<HealthEntry>(`/care-subjects/${subjectId}/health-entries`, clean(data)).then((r) => r.data);

export const getNotificationsPage = (page = 0, unread?: boolean) =>
  http.get<Page<Notification> | Notification[]>('/notifications', { params: { page, size: 100, unread } }).then((r) => r.data);

export const getNotifications = () => collectPages((page) => getNotificationsPage(page));

export const markNotificationRead = (id: number) =>
  http.patch<Notification>(`/notifications/${id}/read`).then((r) => r.data);

/* ---------- Cuidadores ---------- */

export const inviteCaregiver = (subjectId: number, data: InviteCaregiverInput) =>
  http.post<CareRelationship>(`/care-subjects/${subjectId}/relationships`, clean(data)).then((r) => r.data);

export const removeCaregiver = (subjectId: number, relationshipId: number) =>
  http.delete(`/care-subjects/${subjectId}/relationships/${relationshipId}`);

/* ---------- Resumen de traspaso ---------- */

export const getHandoffs = (subjectId: number) =>
  http.get<Handoff[]>(`/care-subjects/${subjectId}/handoffs`).then((r) => r.data);

export const createHandoff = (subjectId: number, data: HandoffInput) =>
  http.post<HandoffDetail>(`/care-subjects/${subjectId}/handoffs`, clean(data)).then((r) => r.data);

export const getHandoff = (handoffId: number) => http.get<HandoffDetail>(`/handoffs/${handoffId}`).then((r) => r.data);

export const deleteHandoff = (handoffId: number) => http.delete(`/handoffs/${handoffId}`);

export const getHandoffSessions = (handoffId: number) =>
  http.get<HandoffSession[]>(`/handoffs/${handoffId}/sessions`).then((r) => r.data);

export const createHandoffSession = (handoffId: number, expiresInHours: number, sessionWindowMinutes: number) =>
  http
    .post<HandoffSessionCreated>(`/handoffs/${handoffId}/sessions`, { expiresInHours, sessionWindowMinutes })
    .then((r) => r.data);

export const revokeHandoffSession = (sessionId: number) => http.delete(`/handoff-sessions/${sessionId}`);

/* ---------- Delegar acceso ---------- */

export const getDelegations = (subjectId: number) =>
  http.get<Delegation[]>(`/care-subjects/${subjectId}/delegations`).then((r) => r.data);

export const createDelegation = (subjectId: number, data: DelegationInput) =>
  http.post<DelegationCreated>(`/care-subjects/${subjectId}/delegations`, data).then((r) => r.data);

export const revokeDelegation = (delegationId: number) => http.delete(`/delegations/${delegationId}`);

/* ---------- Editar registro e historial ---------- */

export const getHealthEntry = (subjectId: number, entryId: number) =>
  http.get<HealthEntry>(`/care-subjects/${subjectId}/health-entries/${entryId}`).then((r) => r.data);

export const updateHealthEntry = (subjectId: number, entryId: number, data: HealthEntryUpdate) =>
  http.patch<HealthEntry>(`/care-subjects/${subjectId}/health-entries/${entryId}`, clean(data)).then((r) => r.data);

export const deleteHealthEntry = (subjectId: number, entryId: number) =>
  http.delete(`/care-subjects/${subjectId}/health-entries/${entryId}`);

export const getEntryVersions = (subjectId: number, entryId: number) =>
  http
    .get<HealthEntryVersion[]>(`/care-subjects/${subjectId}/health-entries/${entryId}/versions`)
    .then((r) => r.data);

/* ---------- Bitácora ---------- */

/** Los últimos movimientos: una sola página, la más reciente. */
export const getAccessLogs = (subjectId: number) =>
  http
    .get<AccessLog[] | { content: AccessLog[] }>(`/care-subjects/${subjectId}/access-logs`, {
      params: { size: MAX_PAGE_SIZE },
    })
    .then((r) => (Array.isArray(r.data) ? r.data : r.data.content));

/* ---------- Documentos y OCR ---------- */

export const getAttachments = (subjectId: number) =>
  http.get<Attachment[]>(`/care-subjects/${subjectId}/attachments`).then((r) => r.data);

export const getAttachment = (subjectId: number, attachmentId: number) =>
  http.get<Attachment>(`/care-subjects/${subjectId}/attachments/${attachmentId}`).then((r) => r.data);

export const uploadAttachment = (subjectId: number, form: FormData) =>
  http
    .post<Attachment>(`/care-subjects/${subjectId}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      // Una foto tarda más que una petición normal
      timeout: 60000,
      transformRequest: (data) => data,
    })
    .then((r) => r.data);

export const deleteAttachment = (subjectId: number, attachmentId: number) =>
  http.delete(`/care-subjects/${subjectId}/attachments/${attachmentId}`);

/** Fuente de un archivo privado: en iOS y Android va con el token y en la web como blob local. */
export async function getAttachmentSource(subjectId: number, attachmentId: number) {
  const path = `/care-subjects/${subjectId}/attachments/${attachmentId}`;
  if (Platform.OS === 'web') {
    const { data } = await http.get<Blob>(`${path}/content`, { responseType: 'blob', timeout: 60000 });
    return { uri: URL.createObjectURL(data) };
  }
  // La imagen y el audio se piden fuera de axios: esta llamada renueva el token si ya venció
  await getAttachment(subjectId, attachmentId);
  return {
    uri: `${API_URL}/api/v1${path}/content`,
    headers: { Authorization: `Bearer ${session.accessToken}` },
  };
}

export const retryOcr = (subjectId: number, attachmentId: number) =>
  http.post<Attachment>(`/care-subjects/${subjectId}/attachments/${attachmentId}/ocr-retry`).then((r) => r.data);
