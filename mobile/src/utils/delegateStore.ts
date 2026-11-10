import type { DelegateSession } from '../types';

/** Id del usuario que abrió el acceso, o null si lo abrió sin sesión. */
export type DelegateOwner = number | null;

/** Clave de versiones anteriores, sin dueño: no se sabe de quién era. */
export const LEGACY_DELEGATE_KEY = 'yuyay.delegateSession';

export type KeyValueStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

export function delegateSessionKey(owner: DelegateOwner) {
  return owner === null ? 'yuyay.delegateSession.guest' : `yuyay.delegateSession.user.${owner}`;
}

/** Guarda el acceso delegado por dueño, para que en un teléfono compartido nadie vea el de otra persona. */
export function createDelegateStore(storage: KeyValueStore, now: () => number = Date.now) {
  return {
    async save(owner: DelegateOwner, session: DelegateSession) {
      await storage.set(delegateSessionKey(owner), JSON.stringify(session));
    },
    async load(owner: DelegateOwner): Promise<DelegateSession | null> {
      // Un acceso guardado sin dueño (versiones anteriores) se descarta por privacidad
      if (await storage.get(LEGACY_DELEGATE_KEY)) await storage.remove(LEGACY_DELEGATE_KEY);
      const key = delegateSessionKey(owner);
      const saved = await storage.get(key);
      if (!saved) return null;
      try {
        const session: DelegateSession = JSON.parse(saved);
        if (Date.parse(session.expiresAt) > now()) return session;
      } catch {
        // JSON inválido: se trata igual que uno vencido
      }
      await storage.remove(key);
      return null;
    },
    async clear(owner: DelegateOwner) {
      await storage.remove(delegateSessionKey(owner));
    },
  };
}
