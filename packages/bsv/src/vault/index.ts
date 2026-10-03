// The key vault: a BIP39 key, wrapped at rest with AES-GCM from a PRF secret or a passphrase, and
// kept unlocked for a day. Lifted from Postern's src/services (vault.ts, keySession.ts,
// session.ts); the stored shape is Postern's. No UI, no browser store, no WebAuthn call: the PRF
// secret and the storage are inputs.
export { createMnemonic, findInvalidWords, generate, isValidMnemonic, keyFromPhrase, normalisePhrase, publicKeyHexFromKey } from './phrase.js';
export type { GeneratedKey } from './phrase.js';
export { VaultError, unwrap, wrap } from './wrap.js';
export type { AesKey, Secret, VaultErrorCode, WrappedVault } from './wrap.js';
export { DEFAULT_VAULT_KEY, MemoryStorage, loadVault, removeVault, saveVault } from './storage.js';
export type { Storage } from './storage.js';
export { SESSION_HOURS, SESSION_MS, createKeySession, memorySessionStore } from './session.js';
export type { KeySession, KeySessionOptions, PersistedSession, SessionStore } from './session.js';
