// Wrapping the key at rest with AES-GCM, in exactly the shape Postern stores (its VaultRow minus
// the app-side fields: id, credentialId, prfFallbackReason). The wrapping key comes from a 32-byte
// PRF secret (HKDF) or from a passphrase (PBKDF2, 210 000 rounds, 16-byte salt kept beside the
// blob). The WebAuthn call that yields a PRF secret is the app's; here it is an input.
import { normalisePhrase, publicKeyHexFromKey } from './phrase.js';

/** The platform's CryptoKey, named without the DOM typings (this build has none). */
export type AesKey = Awaited<ReturnType<typeof crypto.subtle.importKey>>;

const PBKDF2_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BYTES = 32;
const HKDF_INFO = 'postern-vault-aes-v1';

/** What opens a wrapped key: a PRF secret, or a passphrase (the recovery phrase, in Postern). */
export type Secret = { prfSecret: Uint8Array | ArrayBuffer } | { passphrase: string };

/** The stored shape. `ciphertext` is the AES-GCM output (the 32-byte key plus the 16-byte tag). */
export interface WrappedVault {
  mode: 'prf' | 'phrase';
  ciphertext: ArrayBuffer;
  iv: Uint8Array;
  /** Present for mode 'phrase' only. */
  salt?: Uint8Array;
  /** The compressed public key (hex), in the clear, so a screen can show it without unlocking. */
  publicKeyHex: string;
}

export type VaultErrorCode = 'wrong-secret' | 'wrong-mode' | 'no-salt' | 'bad-key';

export class VaultError extends Error {
  readonly code: VaultErrorCode;
  constructor(code: VaultErrorCode, message: string) {
    super(message);
    this.name = 'VaultError';
    this.code = code;
  }
}

function isPrf(secret: Secret): secret is { prfSecret: Uint8Array | ArrayBuffer } {
  return 'prfSecret' in secret;
}

async function aesKeyFromPrf(prfSecret: Uint8Array | ArrayBuffer): Promise<AesKey> {
  // Re-wrapped in this realm's Uint8Array: the secret may cross a realm boundary, and SubtleCrypto's
  // instanceof checks are realm-sensitive.
  const hkdfKey = await crypto.subtle.importKey('raw', new Uint8Array(prfSecret), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: new TextEncoder().encode(HKDF_INFO) },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function aesKeyFromPassphrase(passphrase: string, salt: Uint8Array): Promise<AesKey> {
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(normalisePhrase(passphrase)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(salt), iterations: PBKDF2_ITERATIONS },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Wraps a 32-byte key with a PRF secret or a passphrase. */
export async function wrap(key: Uint8Array, secret: Secret): Promise<WrappedVault> {
  if (key.length !== KEY_BYTES) throw new VaultError('bad-key', `The key must be ${KEY_BYTES} bytes.`);
  const salt = isPrf(secret) ? undefined : crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const aesKey = isPrf(secret) ? await aesKeyFromPrf(secret.prfSecret) : await aesKeyFromPassphrase(secret.passphrase, salt!);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, new Uint8Array(key));
  return {
    mode: isPrf(secret) ? 'prf' : 'phrase',
    ciphertext,
    iv,
    ...(salt ? { salt } : {}),
    publicKeyHex: publicKeyHexFromKey(key),
  };
}

/** Opens a wrapped key. Throws a VaultError ('wrong-secret' for a wrong secret or a damaged blob). */
export async function unwrap(wrapped: WrappedVault, secret: Secret): Promise<Uint8Array> {
  if (isPrf(secret) !== (wrapped.mode === 'prf')) {
    throw new VaultError('wrong-mode', wrapped.mode === 'prf' ? 'This key opens with its passkey, not a passphrase.' : 'This key opens with a passphrase, not a passkey.');
  }
  let aesKey: AesKey;
  if (isPrf(secret)) {
    aesKey = await aesKeyFromPrf(secret.prfSecret);
  } else {
    if (!wrapped.salt) throw new VaultError('no-salt', 'No recovery salt is stored for this key.');
    aesKey = await aesKeyFromPassphrase(secret.passphrase, wrapped.salt);
  }
  try {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(wrapped.iv) }, aesKey, new Uint8Array(wrapped.ciphertext));
    return new Uint8Array(plaintext);
  } catch {
    throw new VaultError('wrong-secret', isPrf(secret) ? 'That passkey did not unlock the key.' : 'That recovery phrase did not unlock the key.');
  }
}
