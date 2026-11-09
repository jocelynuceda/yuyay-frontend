import { AxiosError, create } from 'axios';
import type { DelegateConsultation, DelegateSession, HealthEntry } from '../types';
import { ApiError, toApiError } from './client';
import { API_URL, secureStorage } from './http';

const SESSION_KEY = 'yuyay.delegateSession';

// Cliente aparte: quien abre un acceso delegado no tiene cuenta, así que no debe usar el refresh ni cerrar sesiones.
const delegateHttp = create({ baseURL: `${API_URL}/api/v1`, timeout: 15000 });

delegateHttp.interceptors.response.use(undefined, (error: unknown) => {
  // El backend responde 403 cuando la delegación venció o fue revocada
  if (error instanceof AxiosError && error.response?.status === 403) {
    throw new ApiError(403, 'Este acceso venció o fue revocado.');
  }
  throw toApiError(error);
});

/** Acepta el código solo o el enlace completo, con o sin barra final. */
export function parseAccessCode(input: string) {
  return input.trim().split(/[?#]/)[0].replace(/\/+$/, '').split('/').pop() ?? '';
}

/** El enlace se canjea una sola vez: la sesión se guarda para poder volver a entrar hasta que venza. */
export async function openDelegation(code: string): Promise<DelegateSession> {
  const { data } = await delegateHttp.post<Omit<DelegateSession, 'sourceToken'>>(
    `/public/delegations/${encodeURIComponent(code)}/exchange`,
  );
  const session: DelegateSession = {
    accessToken: data.accessToken,
    expiresAt: data.expiresAt,
    careSubjectName: data.careSubjectName,
    granteeName: data.granteeName,
    categoryCodes: data.categoryCodes,
    includeConsultations: data.includeConsultations,
    sourceToken: code,
  };
  await secureStorage.set(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function loadDelegateSession(): Promise<DelegateSession | null> {
  const saved = await secureStorage.get(SESSION_KEY);
  if (!saved) return null;
  const session: DelegateSession = JSON.parse(saved);
  if (Date.parse(session.expiresAt) > Date.now()) return session;
  await clearDelegateSession();
  return null;
}

export const clearDelegateSession = () => secureStorage.remove(SESSION_KEY);

export const getDelegateEntries = (session: DelegateSession) =>
  delegateHttp
    .get<HealthEntry[]>('/delegate/health-entries', {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
    .then((r) => r.data);

export const getDelegateConsultations = (session: DelegateSession) =>
  delegateHttp
    .get<DelegateConsultation[]>('/delegate/consultations', {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
    .then((r) => r.data);
