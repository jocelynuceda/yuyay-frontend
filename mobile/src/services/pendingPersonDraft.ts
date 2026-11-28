import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { Gender } from '../types';
import type { DateParts } from '../utils/dates';

export type PersonDraft = { name: string; dateParts: DateParts; gender: Gender | null; notes: string };

type StoredDraft = PersonDraft & { requestId: string };

export function readPendingPerson(key: string): StoredDraft | undefined {
  try {
    const raw = Platform.OS === 'web' ? globalThis.localStorage.getItem(key) : SecureStore.getItem(key);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (typeof draft?.requestId === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(draft.requestId) &&
        typeof draft.name === 'string' && typeof draft.notes === 'string' &&
        [draft.dateParts?.day, draft.dateParts?.month, draft.dateParts?.year].every(part => typeof part === 'string') &&
        [null, 'MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'].includes(draft.gender)) return draft;
  } catch { return; }
}

export function writePendingPerson(key: string, draft: StoredDraft | null) {
  if (Platform.OS === 'web') {
    if (draft) globalThis.localStorage.setItem(key, JSON.stringify(draft));
    else globalThis.localStorage.removeItem(key);
  } else {
    SecureStore.setItem(key, draft ? JSON.stringify(draft) : '', { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  }
}
