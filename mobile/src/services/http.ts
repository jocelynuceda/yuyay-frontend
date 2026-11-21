import { create } from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import * as Updates from 'expo-updates';
import type { AuthResponse } from '../types';
import type { TermsDocument } from '../types/terms';
import { ApiError, createApiClient, toApiError } from './client';
import { CLIENT_HEADER, clientHeaderValue } from '../utils/clientHeader.ts';
import { createSession, NoSessionError } from './session';

function resolveApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  if (Platform.OS === 'web') return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081';
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) return `http://${hostUri}`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';
}

export const API_URL = resolveApiUrl();

function resolveClientHeader(): string {
  try {
    // En Expo Go, desarrollo o web no hay updateId y el valor termina en '+dev'.
    return clientHeaderValue(Platform.OS, Constants.expoConfig?.version, Updates.updateId, Updates.isEmbeddedLaunch);
  } catch {
    return clientHeaderValue(Platform.OS);
  }
}

export const CLIENT_HEADERS = { [CLIENT_HEADER]: resolveClientHeader() };
export { ApiError, NoSessionError };

const LEGACY_REFRESH_KEY = 'yuyay.refreshToken';
const REFRESH_KEY = `${LEGACY_REFRESH_KEY}.${Array.from(API_URL, (char) => char.charCodeAt(0).toString(16)).join('-')}`;
export const secureStorage = {
  get: (key: string) => Platform.OS === 'web'
    ? Promise.resolve(globalThis.localStorage?.getItem(key) ?? null) : SecureStore.getItemAsync(key),
  set: (key: string, value: string) => Platform.OS === 'web'
    ? Promise.resolve(globalThis.localStorage?.setItem(key, value)) : SecureStore.setItemAsync(key, value),
  remove: (key: string) => Platform.OS === 'web'
    ? Promise.resolve(globalThis.localStorage?.removeItem(key)) : SecureStore.deleteItemAsync(key),
};

const auth = create({ baseURL: `${API_URL}/api/v1/auth`, timeout: 15000, headers: CLIENT_HEADERS });

export function getAccountTerms(): Promise<TermsDocument> {
  return auth.get<TermsDocument>('/terms').then(({ data }) => data).catch((error: unknown) => {
    throw toApiError(error);
  });
}
let onSessionExpired = () => {};
let onRecoveryRequired = (_message: string) => {};

export const session = createSession<AuthResponse>({
  storage: {
    get: async () => await secureStorage.get(REFRESH_KEY) ?? await secureStorage.get(LEGACY_REFRESH_KEY),
    set: async (token) => {
      await secureStorage.set(REFRESH_KEY, token);
      await secureStorage.remove(LEGACY_REFRESH_KEY);
    },
    remove: async () => {
      await secureStorage.remove(REFRESH_KEY);
      await secureStorage.remove(LEGACY_REFRESH_KEY);
    },
  },
  renew: async (refreshToken) => {
    try {
      return (await auth.post<AuthResponse>('/refresh', { refreshToken })).data;
    } catch (error) {
      throw toApiError(error);
    }
  },
  revoke: (refreshToken) => auth.post('/logout', { refreshToken }),
  isRejected: (error) => error instanceof ApiError && error.status === 401,
  onExpired: () => onSessionExpired(),
  onRecovery: (error) => onRecoveryRequired(toApiError(error).message),
});

export const refreshSession = session.refresh;
export function setSessionHandlers(expired: () => void, recovery: (message: string) => void) {
  onSessionExpired = expired;
  onRecoveryRequired = recovery;
  return () => {
    onSessionExpired = () => {};
    onRecoveryRequired = () => {};
  };
}
export const http = createApiClient(`${API_URL}/api/v1`, session, { clientHeader: CLIENT_HEADERS[CLIENT_HEADER] });
