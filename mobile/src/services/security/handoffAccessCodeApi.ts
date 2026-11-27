import type { AxiosInstance } from 'axios';
import type { HandoffSessionCreated } from '../../types';
import type { HandoffAccessCodeResponse } from './handoffAccessCode';

export type HandoffSessionRequest = { expiresInMinutes: number; sessionWindowMinutes: number; allowDownload?: boolean };

/** Autenticación en el cliente HTTP; ni el JWT ni el código van en la URL. */
export function createHandoffAccessApi(http: Pick<AxiosInstance, 'get' | 'post'>) {
  return {
    getCode: (sessionId: number, signal: AbortSignal) =>
      http.get<HandoffAccessCodeResponse>(`/handoff-sessions/${sessionId}/access-code`, { signal })
        .then((response) => response.data),
    createSession(handoffId: number, ...args: [request: HandoffSessionRequest] | [expiresInHours: number, sessionWindowMinutes: number]) {
      const request = args.length === 1 ? args[0] : { expiresInHours: args[0], sessionWindowMinutes: args[1] };
      return http.post<HandoffSessionCreated>(`/handoffs/${handoffId}/sessions`, { ...request, requireAccessCode: true })
        .then((response) => response.data);
    },
  };
}
