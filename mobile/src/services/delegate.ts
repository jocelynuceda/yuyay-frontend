import { AxiosError, create } from 'axios';
import type { DelegateConsultation, DelegateSession, HealthEntry } from '../types';
import { ApiError, toApiError } from './client';
import { createDelegateStore, type DelegateOwner } from '../utils/delegateStore';
import { API_URL, secureStorage } from './http';

// El acceso queda en el dispositivo, pero atado a quien lo abrió (o a nadie, si no había sesión)
const store = createDelegateStore(secureStorage);

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
export async function openDelegation(code: string, owner: DelegateOwner): Promise<DelegateSession> {
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
  await store.save(owner, session);
  return session;
}

export const loadDelegateSession = (owner: DelegateOwner) => store.load(owner);

export const clearDelegateSession = (owner: DelegateOwner) => store.clear(owner);

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
