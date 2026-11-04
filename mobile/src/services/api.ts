import { http } from './http';
import { collectPages, type Page } from './pagination';
import type {
  AuthResponse,
  CareRelationship,
  CareSubject,
  Consultation,
  HealthCategory,
  HealthEntry,
  HealthEntryInput,
  HealthEntryUpdate,
  HealthEntryVersion,
  Notification,
  User,
} from '../types';

/** Quita los campos vacíos para que el backend reciba null. */
function clean<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined)) as T;
}

export const login = (email: string, password: string) =>
  http.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data);

export const register = (name: string, email: string, password: string) =>
  http.post<AuthResponse>('/auth/register', { name, email, password }).then((r) => r.data);

export const logout = (refreshToken: string) => http.post('/auth/logout', { refreshToken });

export const getMe = () => http.get<User>('/users/me').then((r) => r.data);

export const getCareSubjects = () => http.get<CareSubject[]>('/care-subjects').then((r) => r.data);

export const getCareSubject = (id: number) => http.get<CareSubject>(`/care-subjects/${id}`).then((r) => r.data);

export const createCareSubject = (data: { name: string; birthDate?: string; notes?: string }) =>
  http.post<CareSubject>('/care-subjects', clean(data)).then((r) => r.data);

export const getCareRelationships = (subjectId: number) =>
  http.get<CareRelationship[]>(`/care-subjects/${subjectId}/relationships`).then((r) => r.data);

export const getConsultations = (subjectId: number) =>
  http.get<Consultation[]>(`/care-subjects/${subjectId}/consultations`).then((r) => r.data);

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

export const getHealthEntry = (subjectId: number, entryId: number) =>
  http.get<HealthEntry>(`/care-subjects/${subjectId}/health-entries/${entryId}`).then((r) => r.data);

export const updateHealthEntry = (subjectId: number, entryId: number, data: HealthEntryUpdate) =>
  http.patch<HealthEntry>(`/care-subjects/${subjectId}/health-entries/${entryId}`, clean(data)).then((r) => r.data);

/** De la versión más nueva a la más antigua. */
export const getHealthEntryVersions = (subjectId: number, entryId: number) =>
  http.get<HealthEntryVersion[]>(`/care-subjects/${subjectId}/health-entries/${entryId}/versions`).then((r) => r.data);

export const getNotificationsPage =(page = 0, unread?: boolean) =>
  http.get<Page<Notification> | Notification[]>('/notifications', { params: { page, size: 100, unread } }).then((r) => r.data);

export const getNotifications = () => collectPages((page) => getNotificationsPage(page));

export const markNotificationRead = (id: number) =>
  http.patch<Notification>(`/notifications/${id}/read`).then((r) => r.data);
