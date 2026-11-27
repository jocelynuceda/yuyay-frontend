import type { ConsultationPreparation, ConfirmPreparation } from '../types/consultationPreparation';
import { Platform } from 'react-native';
import { API_URL, CLIENT_HEADERS, http, session } from './http';
import { attachmentUploadOptions } from './attachmentUpload';
import { createHandoffAccessApi } from './security/handoffAccessCodeApi';
import { collectPages, type Page } from './pagination';
import type { TermsAcceptance } from '../types/terms';
import type {
  RegisterInput,
  Gender,
  AccessLog,
  Attachment,
  AttachmentAccess,
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
  HealthCategory,
  HealthEntry,
  HealthEntryInput,
  HealthEntryUpdate,
  HealthEntryVersion,
  InviteCaregiverInput,
  Notification,
  User,
} from '../types';
import type { CareAuthorizationDeclaration, CareAuthorizationPolicy, CareSubjectCreation } from '../types/careAuthorization';

/** Quita los campos vacíos para que el backend reciba null. */
function clean<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined)) as T;
}

/** Tamaño máximo que acepta el backend en las listas paginadas. */
const MAX_PAGE_SIZE = 100;

export const login = (email: string, password: string) =>
  http.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data);

/**
 * Ingreso o alta con el ID token de Google. La versión de los términos solo se envía al crear una
 * cuenta nueva (después de un 428).
 */
export const loginWithGoogle = (idToken: string, acceptedTermsVersion?: string) =>
  http.post<AuthResponse>('/auth/google', { idToken, acceptedTermsVersion }).then((r) => r.data);

/** El DNI solo se contrasta con el nombre en el backend; no se guarda. */
/** Nombre completo del documento, para mostrarlo antes de crear la cuenta. */
export const lookupDni = (dni: string) =>
  http.post<{ fullName: string }>('/auth/dni-lookup', { dni }).then((r) => r.data);

export const register = (account: RegisterInput, acceptance: TermsAcceptance) =>
  http.post<AuthResponse>('/auth/register', { ...account, ...acceptance }).then((r) => r.data);

export const forgotPassword = (email: string) => http.post('/auth/forgot-password', { email });

export const resetPassword = (email: string, code: string, newPassword: string) =>
  http.post('/auth/reset-password', { email, code, newPassword });

export const logout = (refreshToken: string) => http.post('/auth/logout', { refreshToken });

/** Solo cambia el nombre de la cuenta. */
export const updateMe = (name: string, gender: Gender | null) => http.patch<User>('/users/me', { name, gender }).then((r) => r.data);

export const getCareSubjects = () => http.get<CareSubject[]>('/care-subjects').then((r) => r.data);

export const getCareSubject = (id: number) => http.get<CareSubject>(`/care-subjects/${id}`).then((r) => r.data);

export const getCareAuthorizationPolicy = () =>
  http.get<CareAuthorizationPolicy>('/care-subjects/authorization-policy').then((r) => r.data);

export const getCareAuthorizationHistory = (id: number) =>
  http.get<CareAuthorizationDeclaration[]>(`/care-subjects/${id}/authorization-declarations`).then((r) => r.data);

export interface CareSubjectCreationFields {
  name: string;
  birthDate?: string;
  gender: Gender | null;
  notes?: string;
}

export const createCareSubject = ({ data, requestId, declaration }: CareSubjectCreation<CareSubjectCreationFields>) =>
  http.post<CareSubject>('/care-subjects', { ...clean(data), requestId, declaration }).then((r) => r.data);

/** PATCH reemplaza los tres datos: lo que llega en null queda vacío. */
export const updateCareSubject = (id: number, data: { name: string; birthDate: string | null; gender: Gender | null; notes: string | null }) =>
  http.patch<CareSubject>(`/care-subjects/${id}`, data).then((r) => r.data);

/** El backend solo lo permite al principal y si la persona no tiene registros de salud (409). */
export const deleteCareSubject = (id: number) => http.delete(`/care-subjects/${id}`);

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

export const getHealthEntriesPage = (subjectId: number, page = 0, category?: string, size = 100) =>
  http.get<Page<HealthEntry> | HealthEntry[]>(`/care-subjects/${subjectId}/health-entries`, {
    params: { page, size, category, sort: 'createdAt,desc' },
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

const handoffAccessApi = createHandoffAccessApi(http);
export const createHandoffSession = handoffAccessApi.createSession;
export const getHandoffAccessCode = handoffAccessApi.getCode;

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
    // Una foto tarda más que una petición normal; FormData se envía tal cual
    .post<Attachment>(`/care-subjects/${subjectId}/attachments`, form, { ...attachmentUploadOptions, transformRequest: (data) => data })
    .then((r) => r.data);

/** Enlace temporal (S3) para abrir el archivo original. */
export const getAttachmentAccess = (subjectId: number, attachmentId: number) =>
  http.get<AttachmentAccess>(`/care-subjects/${subjectId}/attachments/${attachmentId}/access`).then((r) => r.data);

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
    headers: { ...CLIENT_HEADERS, Authorization: `Bearer ${session.accessToken}` },
  };
}

export const retryOcr = (subjectId: number, attachmentId: number) =>
  http.post<Attachment>(`/care-subjects/${subjectId}/attachments/${attachmentId}/ocr-retry`).then((r) => r.data);

export const prepareConsultation = (consultationId: number) =>
  http.get<ConsultationPreparation>(
    `/consultations/${consultationId}/preparation`,
  ).then((response) => response.data);

export const confirmConsultation = (consultationId: number, body: ConfirmPreparation) =>
  http.post<HandoffDetail>(`/consultations/${consultationId}/preparation/confirm`, body)
    .then((response) => response.data);
