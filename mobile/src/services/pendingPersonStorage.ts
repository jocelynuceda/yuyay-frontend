export const pendingPersonPrefix = 'yuyay.pendingPerson.v1.';

export function pendingPersonKey(apiUrl: string, userId: number) {
  return `${pendingPersonPrefix}${apiUrl.replace(/[^a-zA-Z0-9.-]/g, '_')}.${userId}`;
}

interface DraftStorage {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
  remove: (key: string) => Promise<void>;
}

// SecureStore elimina por clave y no permite enumerarlas. El índice contiene solo claves.
const indexKey = 'yuyay.pendingPerson.keys';

export function createPendingPersonStorage(storage: DraftStorage, listWebKeys?: () => string[]) {
  function keys(): string[] {
    return JSON.parse(storage.get(indexKey) ?? '[]');
  }

  function remember(key: string) {
    if (listWebKeys) return;
    const known = keys();
    if (!known.includes(key)) storage.set(indexKey, JSON.stringify([...known, key]));
  }

  return {
    read(key: string) {
      const value = storage.get(key);
      if (value) remember(key); // Incluye borradores guardados con la versión anterior.
      return value;
    },
    write(key: string, value: string) {
      remember(key);
      storage.set(key, value);
    },
    remove: storage.remove,
    async clear(currentKey?: string) {
      const pending = new Set(listWebKeys ? listWebKeys() : keys());
      if (currentKey) pending.add(currentKey);
      for (const key of pending) {
        if (key.startsWith(pendingPersonPrefix)) await storage.remove(key);
      }
      if (!listWebKeys) await storage.remove(indexKey);
    },
  };
}
