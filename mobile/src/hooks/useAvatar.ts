import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { avatarId, defaultAvatar, parseAvatarId, type AvatarChoice } from '../components/LionAvatar';
import { useAuth } from './useAuth';

/**
 * Avatar elegido por el usuario, guardado solo en este dispositivo (el backend no tiene un campo para esto).
 * Se guarda un único JSON { "<idUsuario>:me" | "<idUsuario>:subject:<id>": "cub-lion" } para no mezclar cuentas.
 */
const STORAGE_KEY = 'yuyay.avatars';

const storage = {
  get: () =>
    Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.getItem(STORAGE_KEY) ?? null) : SecureStore.getItemAsync(STORAGE_KEY),
  set: (value: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(globalThis.localStorage?.setItem(STORAGE_KEY, value))
      : SecureStore.setItemAsync(STORAGE_KEY, value),
};

let choices: Record<string, string> = {};
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load() {
  loaded ??= storage
    .get()
    .then((raw) => {
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object') choices = parsed as Record<string, string>;
      listeners.forEach((l) => l());
    })
    .catch(() => {});
  return loaded;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function save(key: string, value: string | null) {
  await load();
  const next = { ...choices };
  if (value) next[key] = value;
  else delete next[key];
  choices = next;
  listeners.forEach((l) => l());
  await storage.set(JSON.stringify(next)).catch(() => {});
}

export type AvatarTarget = { type: 'me' } | { type: 'subject'; id: number; age: number | null };

/** Avatar a mostrar (el elegido o el automático) y cómo cambiarlo; `null` vuelve al automático. */
export function useAvatar(target: AvatarTarget) {
  const { user } = useAuth();
  useEffect(() => {
    void load();
  }, []);
  const key = target.type === 'me' ? `${user?.id ?? 0}:me` : `${user?.id ?? 0}:subject:${target.id}`;
  const stored = useSyncExternalStore(subscribe, () => choices[key] ?? null);
  const fallback = target.type === 'me' ? defaultAvatar(30) : defaultAvatar(target.age, target.id);
  const chosen = parseAvatarId(stored);

  const setAvatar = useCallback((choice: AvatarChoice | null) => save(key, choice ? avatarId(choice) : null), [key]);

  return { avatar: chosen ?? fallback, automatic: fallback, isCustom: chosen !== null, setAvatar };
}
