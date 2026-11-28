import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { Gender } from '../types';
import type { DateParts } from '../utils/dates';
import { createPendingPersonStorage } from './pendingPersonStorage';

export type PersonDraft = { name: string; dateParts: DateParts; gender: Gender | null; notes: string };

type StoredDraft = PersonDraft & { requestId: string };

const storage = Platform.OS === 'web'
  ? createPendingPersonStorage({
    get: key => globalThis.localStorage.getItem(key),
    set: (key, value) => globalThis.localStorage.setItem(key, value),
    remove: async key => globalThis.localStorage.removeItem(key),
  }, () => Object.keys(globalThis.localStorage))
  : createPendingPersonStorage({
    get: key => SecureStore.getItem(key),
    set: (key, value) => SecureStore.setItem(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
    remove: key => SecureStore.deleteItemAsync(key),
  });

export const clearPendingPeople = storage.clear;
export const removePendingPerson = storage.remove;

export function readPendingPerson(key: string): StoredDraft | undefined {
  try {
    const raw = storage.read(key);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (typeof draft?.requestId === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(draft.requestId) &&
        typeof draft.name === 'string' && typeof draft.notes === 'string' &&
        [draft.dateParts?.day, draft.dateParts?.month, draft.dateParts?.year].every(part => typeof part === 'string') &&
        [null, 'MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'].includes(draft.gender)) return draft;
  } catch { return; }
}

export function writePendingPerson(key: string, draft: StoredDraft) {
  storage.write(key, JSON.stringify(draft));
}
