// The unlocked key, shared by every screen, for a day from unlocking (Postern: plans/0021
// decision 14, "passkey unlock once a day"): in memory, and, so a relaunch does not ask again,
// kept wrapped with a non-extractable AES key this device generated. Lifted from Postern's
// keySession.ts and session.ts. The device key is a CryptoKey that cannot be turned into a string,
// so its store is a structured port (SessionStore), not the string Storage port. With no store, or
// a store that cannot keep a CryptoKey, the session is memory-only and a relaunch asks again.
import type { AesKey } from './wrap.js';

export const SESSION_HOURS = 24;
export const SESSION_MS = SESSION_HOURS * 60 * 60 * 1000;

/** What is kept between launches: the key wrapped with a device key that can never be read out. */
export interface PersistedSession {
  deviceKey: AesKey;
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
  expiresAt: number;
}

export interface SessionStore {
  save(row: PersistedSession): Promise<void>;
  get(): Promise<PersistedSession | null>;
  clear(): Promise<void>;
}

/** An in-memory SessionStore, for tests. */
export function memorySessionStore(): SessionStore {
  let row: PersistedSession | null = null;
  return {
    save: async (r) => {
      row = r;
    },
    get: async () => row,
    clear: async () => {
      row = null;
    },
  };
}

export interface KeySessionOptions {
  store?: SessionStore;
  /** The clock, in milliseconds. Defaults to Date.now. */
  now?: () => number;
}

export interface KeySession {
  /** Holds `key` for a day from now (or until `expiresAt`) and keeps it across relaunches. Resolves once kept; never rejects. */
  setKey(key: Uint8Array, expiresAt?: number): Promise<void>;
  /** The unlocked key, or null when there is none or the day is up. */
  getKey(): Uint8Array | null;
  expiresAt(): number | null;
  /** Ends the session here and in the store. Resolves once the store is clear; never rejects. */
  lock(): Promise<void>;
  /** On launch: takes back a session kept from earlier today, if there is one. */
  resume(): Promise<boolean>;
  /** Called whenever the key is set or dropped. Returns a function that stops listening. */
  onChange(listener: () => void): () => void;
}

export function createKeySession(options: KeySessionOptions = {}): KeySession {
  const { store } = options;
  const now = options.now ?? Date.now;
  let current: { key: Uint8Array; expiresAt: number } | null = null;
  const listeners = new Set<() => void>();
  const emit = (): void => {
    for (const listener of listeners) listener();
  };

  async function persist(key: Uint8Array, expiresAt: number): Promise<void> {
    if (!store) return;
    try {
      const deviceKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, deviceKey, new Uint8Array(key));
      await store.save({ deviceKey, iv, ciphertext, expiresAt });
    } catch {
      await forget();
    }
  }

  async function forget(): Promise<void> {
    try {
      await store?.clear();
    } catch {
      // Nothing stored, or storage unavailable: either way there is no session.
    }
  }

  async function restore(): Promise<{ key: Uint8Array; expiresAt: number } | null> {
    if (!store) return null;
    try {
      const row = await store.get();
      if (!row) return null;
      if (now() >= row.expiresAt) {
        await forget();
        return null;
      }
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(row.iv) }, row.deviceKey, new Uint8Array(row.ciphertext));
      return { key: new Uint8Array(plain), expiresAt: row.expiresAt };
    } catch {
      await forget();
      return null;
    }
  }

  const getKey = (): Uint8Array | null => {
    if (!current) return null;
    if (now() >= current.expiresAt) {
      current = null;
      void forget();
      emit();
      return null;
    }
    return current.key;
  };

  return {
    setKey(key, expiresAt = now() + SESSION_MS) {
      current = { key, expiresAt };
      emit();
      return persist(key, expiresAt);
    },
    getKey,
    expiresAt: () => (getKey() ? (current?.expiresAt ?? null) : null),
    async lock() {
      const had = current !== null;
      current = null;
      await forget();
      if (had) emit();
    },
    async resume() {
      if (getKey()) return true;
      const restored = await restore();
      if (!restored) return false;
      current = restored;
      emit();
      return true;
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
