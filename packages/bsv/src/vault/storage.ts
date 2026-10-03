// The storage port: the library never reaches for a browser store. An app hands in anything that
// can get, set and remove strings (local storage, IndexedDB behind a wrapper, a file); tests use
// MemoryStorage. The wrapped key is kept as one JSON string.
import type { WrappedVault } from './wrap.js';

type Maybe<T> = T | Promise<T>;

export interface Storage {
  get(key: string): Maybe<string | null>;
  set(key: string, value: string): Maybe<void>;
  remove(key: string): Maybe<void>;
}

/** An in-memory Storage, for tests. */
export class MemoryStorage implements Storage {
  private readonly items = new Map<string, string>();
  get(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  set(key: string, value: string): void {
    this.items.set(key, value);
  }
  remove(key: string): void {
    this.items.delete(key);
  }
}

export const DEFAULT_VAULT_KEY = 'bsv-kit.vault';

const toHex = (b: Uint8Array | ArrayBuffer): string =>
  Array.from(b instanceof Uint8Array ? b : new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');

function fromHex(h: unknown): Uint8Array | null {
  if (typeof h !== 'string' || h.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(h)) return null;
  return new Uint8Array((h.match(/../g) ?? []).map((p) => parseInt(p, 16)));
}

export async function saveVault(storage: Storage, wrapped: WrappedVault, name: string = DEFAULT_VAULT_KEY): Promise<void> {
  await storage.set(
    name,
    JSON.stringify({
      mode: wrapped.mode,
      ciphertextHex: toHex(wrapped.ciphertext),
      ivHex: toHex(wrapped.iv),
      ...(wrapped.salt ? { saltHex: toHex(wrapped.salt) } : {}),
      publicKeyHex: wrapped.publicKeyHex,
    }),
  );
}

/** The stored wrapped key, or null when there is none or what is stored is not a vault. */
export async function loadVault(storage: Storage, name: string = DEFAULT_VAULT_KEY): Promise<WrappedVault | null> {
  const raw = await storage.get(name);
  if (raw === null) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  const ciphertext = fromHex(parsed.ciphertextHex);
  const iv = fromHex(parsed.ivHex);
  const salt = parsed.saltHex === undefined ? undefined : fromHex(parsed.saltHex);
  if ((parsed.mode !== 'prf' && parsed.mode !== 'phrase') || !ciphertext || !iv || salt === null || typeof parsed.publicKeyHex !== 'string') {
    return null;
  }
  return {
    mode: parsed.mode,
    ciphertext: ciphertext.buffer as ArrayBuffer,
    iv,
    ...(salt ? { salt } : {}),
    publicKeyHex: parsed.publicKeyHex,
  };
}

export async function removeVault(storage: Storage, name: string = DEFAULT_VAULT_KEY): Promise<void> {
  await storage.remove(name);
}
