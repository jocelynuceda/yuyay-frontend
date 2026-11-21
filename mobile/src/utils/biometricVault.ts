import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { bytesToHex, hexToBytes } from '@noble/ciphers/utils.js';

/**
 * Dónde guarda el celular cada pieza. `readKey` y `writeKey` usan el almacenamiento protegido por biometría
 * del sistema: el teléfono comprueba la huella o el rostro y Yuyay solo recibe la clave si la comprobación pasa.
 */
export interface VaultStore {
  getPlain(): Promise<string | null>;
  setPlain(token: string): Promise<void>;
  removePlain(): Promise<void>;
  getSealed(): Promise<string | null>;
  setSealed(sealed: string): Promise<void>;
  removeSealed(): Promise<void>;
  /** Pide biometría. Devuelve null si la clave ya no existe (cambiaron las huellas o rostros) y lanza si se cancela o falla. */
  readKey(): Promise<string | null>;
  writeKey(key: string): Promise<void>;
  removeKey(): Promise<void>;
}

export class VaultLockedError extends Error {
  constructor() {
    super('Yuyay está bloqueado: desbloquéalo con biometría.');
  }
}

const VERSION = 'v1:';
const NONCE_BYTES = 24;

function toBytes(text: string): Uint8Array {
  const binary = encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function fromBytes(bytes: Uint8Array): string {
  let encoded = '';
  for (const byte of bytes) encoded += `%${byte.toString(16).padStart(2, '0')}`;
  return decodeURIComponent(encoded);
}

export function seal(key: Uint8Array, text: string, randomBytes: (count: number) => Uint8Array): string {
  const nonce = randomBytes(NONCE_BYTES);
  return VERSION + bytesToHex(nonce) + bytesToHex(xchacha20poly1305(key, nonce).encrypt(toBytes(text)));
}

export function unseal(key: Uint8Array, sealed: string): string {
  if (!sealed.startsWith(VERSION)) throw new Error('Formato de credencial desconocido.');
  const bytes = hexToBytes(sealed.slice(VERSION.length));
  return fromBytes(xchacha20poly1305(key, bytes.subarray(0, NONCE_BYTES)).decrypt(bytes.subarray(NONCE_BYTES)));
}

/**
 * Guarda el refresh token. Con biometría activada, el token se guarda cifrado con una clave que solo el
 * almacenamiento biométrico entrega. El token rota en cada renovación: se vuelve a cifrar con la clave en
 * memoria, así el teléfono no pide la huella en cada renovación. Sin desbloquear, el token no se puede leer.
 */
export function createVault(store: VaultStore, randomBytes: (count: number) => Uint8Array) {
  let key: Uint8Array | null = null;
  let enabled: boolean | undefined;

  async function isEnabled() {
    enabled ??= (await store.getSealed()) !== null;
    return enabled;
  }

  async function wipe() {
    key = null;
    enabled = false;
    await Promise.all([store.removePlain(), store.removeSealed(), store.removeKey()]);
  }

  return {
    isEnabled,
    get unlocked() { return key !== null; },

    /** Lanza si la persona cancela o falla. 'invalidated' borra la sesión guardada: hay que volver a entrar. */
    async unlock(): Promise<'unlocked' | 'invalidated'> {
      const stored = await store.readKey();
      if (!stored) {
        await wipe();
        return 'invalidated';
      }
      key = hexToBytes(stored);
      return 'unlocked';
    },

    async enable(token: string) {
      const next = randomBytes(32);
      try {
        await store.writeKey(bytesToHex(next));
        await store.setSealed(seal(next, token, randomBytes));
      } catch (error) {
        await Promise.allSettled([store.removeKey(), store.removeSealed()]);
        throw error;
      }
      key = next;
      enabled = true;
      await store.removePlain();
    },

    async disable(token: string) {
      await store.setPlain(token);
      key = null;
      enabled = false;
      await Promise.all([store.removeSealed(), store.removeKey()]);
    },

    /** Almacenamiento para la sesión. Cerrar sesión o perderla también desactiva la biometría. */
    storage: {
      get: async () => {
        if (!(await isEnabled())) return store.getPlain();
        if (!key) return null;
        const sealed = await store.getSealed();
        return sealed ? unseal(key, sealed) : null;
      },
      set: async (token: string) => {
        if (!(await isEnabled())) return store.setPlain(token);
        if (!key) throw new VaultLockedError();
        await store.setSealed(seal(key, token, randomBytes));
      },
      remove: wipe,
    },
  };
}

export type Vault = ReturnType<typeof createVault>;
