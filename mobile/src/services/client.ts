import { AxiosError, create, type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorBody } from '../types';

export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (!(error instanceof AxiosError) || !error.response) {
    return new ApiError(0, error instanceof AxiosError && error.code === 'ECONNABORTED'
      ? 'El servidor tardó demasiado en responder.'
      : 'No pudimos conectar con el servidor. Revisa tu conexión.');
  }
  const { status, data } = error.response as { status: number; data?: ApiErrorBody };
  const fieldErrors = Object.fromEntries((data?.fieldErrors ?? []).map((f) => [f.field, f.message]));
  if (status >= 500) return new ApiError(status, 'El servidor tuvo un problema. Inténtalo de nuevo.');
  if (status === 403) return new ApiError(status, 'No tienes permiso para hacer esto.');
  return new ApiError(status, data?.message || 'Algo salió mal. Inténtalo de nuevo.', fieldErrors);
}

/** Códigos que indican un fallo pasajero del servidor o de un proxy. */
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const RETRYABLE_METHODS = new Set(['get', 'head', 'options']);
export const MAX_RETRIES = 2;

/**
 * Un error vale la pena reintentarlo si es de red, de tiempo agotado o un fallo pasajero del servidor.
 * Solo en lecturas: repetir un POST o un DELETE podría crear o borrar algo dos veces.
 */
export function isRetryable(error: AxiosError): boolean {
  const method = (error.config?.method ?? 'get').toLowerCase();
  if (!RETRYABLE_METHODS.has(method) || error.code === AxiosError.ERR_CANCELED) return false;
  if (!error.response) return true;
  return RETRYABLE_STATUS.has(error.response.status);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ClientSession {
  readonly generation: number;
  readonly accessToken: string | null;
  refresh: () => Promise<unknown>;
}

export function createApiClient(baseURL: string, session: ClientSession, { retryDelayMs = 600 } = {}) {
  const http = create({ baseURL, headers: { 'Content-Type': 'application/json' }, timeout: 15000 });
  type Request = InternalAxiosRequestConfig & {
    _retried?: boolean;
    _attempts?: number;
    _generation?: number;
    _access?: string | null;
  };

  http.interceptors.request.use((config: Request) => {
    config._generation = session.generation;
    config._access = session.accessToken;
    if (session.accessToken) config.headers.Authorization = `Bearer ${session.accessToken}`;
    else config.headers.delete('Authorization');
    return config;
  });
  http.interceptors.response.use((response) => response, async (error: AxiosError) => {
    const config = error.config as Request | undefined;
    if (error.response?.status === 401 && config && !config._retried
        && !config.url?.startsWith('/auth/') && config._generation === session.generation) {
      config._retried = true;
      try {
        // A late 401 for the previous access token can arrive after another request refreshed it.
        if (config._access === session.accessToken) await session.refresh();
        if (config._generation !== session.generation) throw new ApiError(401, 'La sesión cambió.');
        return http(config);
      } catch (refreshError) {
        return Promise.reject(toApiError(refreshError));
      }
    }
    // Reintento con espera creciente (600 ms, 1.2 s) para errores recuperables, si la sesión no cambió
    if (config && isRetryable(error) && (config._attempts ?? 0) < MAX_RETRIES
        && config._generation === session.generation) {
      config._attempts = (config._attempts ?? 0) + 1;
      await wait(retryDelayMs * 2 ** (config._attempts - 1));
      return http(config);
    }
    return Promise.reject(toApiError(error));
  });
  return http;
}
