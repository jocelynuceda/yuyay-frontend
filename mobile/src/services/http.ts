import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { ApiErrorBody, AuthResponse } from '../types';

/**
 * URL del backend:
 * - EXPO_PUBLIC_API_URL si está definida (producción / despliegue).
 * - En desarrollo, el mismo servidor de Metro (IP y puerto de la computadora que corre Expo):
 *   metro.config.js reenvía /api al backend, así funciona aunque la red bloquee el 8080.
 *   En la versión web, el mismo origen de la página (también pasa por el proxy, sin problemas de CORS).
 */
function resolveApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  if (Platform.OS === 'web') return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081';
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) return `http://${hostUri}`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';
}

export const API_URL = resolveApiUrl();

/** Error con mensaje listo para mostrar al usuario. */
export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/* ---------- Tokens ---------- */

const REFRESH_KEY = 'yuyay.refreshToken';

// SecureStore guarda en Keychain (iOS) / Keystore (Android). En web no existe, se usa localStorage.
const secureStorage = {
  get: (key: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(globalThis.localStorage?.getItem(key) ?? null)
      : SecureStore.getItemAsync(key),
  set: (key: string, value: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(globalThis.localStorage?.setItem(key, value))
      : SecureStore.setItemAsync(key, value),
  remove: (key: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(globalThis.localStorage?.removeItem(key))
      : SecureStore.deleteItemAsync(key),
};

// El access token solo vive en memoria; el refresh token en almacenamiento seguro.
let accessToken: string | null = null;

export const tokenStore = {
  getRefresh: () => secureStorage.get(REFRESH_KEY),
  async save(tokens: Pick<AuthResponse, 'accessToken' | 'refreshToken'>) {
    accessToken = tokens.accessToken;
    await secureStorage.set(REFRESH_KEY, tokens.refreshToken);
  },
  async clear() {
    accessToken = null;
    await secureStorage.remove(REFRESH_KEY);
  },
};

/* ---------- Cliente axios ---------- */

export const http = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshing: Promise<AuthResponse> | null = null;

/** Pide un access token nuevo con el refresh token (una sola petición aunque fallen varias). */
export function refreshSession(): Promise<AuthResponse> {
  refreshing ??= (async () => {
    const refreshToken = await tokenStore.getRefresh();
    if (!refreshToken) throw new ApiError(401, 'Sin sesión');
    const { data } = await axios.post<AuthResponse>(`${API_URL}/api/v1/auth/refresh`, {
      refreshToken,
    });
    await tokenStore.save(data);
    return data;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** El AuthContext se suscribe para cerrar sesión cuando el refresh falla. */
let onSessionExpired: () => void = () => {};
export const setSessionExpiredHandler = (handler: () => void) => {
  onSessionExpired = handler;
};

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const config = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const isAuthCall = config?.url?.startsWith('/auth/');

    if (error.response?.status === 401 && config && !config._retried && !isAuthCall) {
      config._retried = true;
      try {
        await refreshSession();
        return http(config);
      } catch {
        await tokenStore.clear();
        onSessionExpired();
      }
    }
    return Promise.reject(toApiError(error));
  },
);

function toApiError(error: AxiosError<ApiErrorBody>): ApiError {
  if (!error.response) {
    return new ApiError(
      0,
      error.code === 'ECONNABORTED'
        ? 'El servidor tardó demasiado en responder.'
        : 'No pudimos conectar con el servidor. Revisa tu conexión.',
    );
  }
  const { status, data } = error.response;
  const fieldErrors = Object.fromEntries((data?.fieldErrors ?? []).map((f) => [f.field, f.message]));
  if (status >= 500) return new ApiError(status, 'El servidor tuvo un problema. Inténtalo de nuevo.');
  if (status === 403) return new ApiError(status, 'No tienes permiso para hacer esto.');
  return new ApiError(status, data?.message || 'Algo salió mal. Inténtalo de nuevo.', fieldErrors);
}
