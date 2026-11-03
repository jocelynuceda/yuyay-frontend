import { http } from './http';
import type {
  AuthResponse,
  CareRelationship,
  CareSubject,
  Consultation,
  HealthCategory,
  HealthEntry,
  HealthEntryInput,
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

export const getHealthEntries = (subjectId: number, category?: string) =>
  http
    .get<HealthEntry[]>(`/care-subjects/${subjectId}/health-entries`, {
      params: category ? { category } : undefined,
    })
    .then((r) => r.data);

export const createHealthEntry = (subjectId: number, data: HealthEntryInput) =>
  http.post<HealthEntry>(`/care-subjects/${subjectId}/health-entries`, clean(data)).then((r) => r.data);

export const getNotifications = () => http.get<Notification[]>('/notifications').then((r) => r.data);

export const markNotificationRead = (id: number) =>
  http.patch<Notification>(`/notifications/${id}/read`).then((r) => r.data);
