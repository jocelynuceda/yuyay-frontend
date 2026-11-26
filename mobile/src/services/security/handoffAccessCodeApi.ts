import type { AxiosInstance } from 'axios';
import type { HandoffSessionCreated } from '../../types';
import type { HandoffAccessCodeResponse } from './handoffAccessCode';

/** Autenticación en el cliente HTTP; ni el JWT ni el código van en la URL. */
export function createHandoffAccessApi(http: Pick<AxiosInstance, 'get' | 'post'>) {
  return {
    getCode: (sessionId: number, signal: AbortSignal) =>
      http.get<HandoffAccessCodeResponse>(`/handoff-sessions/${sessionId}/access-code`, { signal })
        .then((response) => response.data),
    createSession: (handoffId: number, expiresInHours: number, sessionWindowMinutes: number) =>
      http.post<HandoffSessionCreated>(`/handoffs/${handoffId}/sessions`, { expiresInHours, sessionWindowMinutes, requireAccessCode: true })
        .then((response) => response.data),
  };
}
