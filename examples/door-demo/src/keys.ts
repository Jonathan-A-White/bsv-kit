// Making and unlocking the demo's key: bsv's vault, wrapped by a passphrase, kept in a Storage.
import { vault } from 'bsv-kit/bsv';

export interface UnlockedKey {
  key: Uint8Array;
  publicKeyHex: string;
}

export interface MadeKey extends UnlockedKey {
  /** The 12-word recovery phrase: shown once, never stored. */
  phrase: string;
}

function need(passphrase: string): void {
  if (!passphrase.trim()) throw new Error('Type a passphrase first.');
}

export async function hasStoredKey(storage: vault.Storage): Promise<boolean> {
  return (await vault.loadVault(storage)) !== null;
}

export async function makeKey(storage: vault.Storage, passphrase: string): Promise<MadeKey> {
  need(passphrase);
  if (await hasStoredKey(storage)) throw new Error('A key is already stored in this browser. Unlock it, or forget it first.');
  const made = await vault.generate();
  await vault.saveVault(storage, await vault.wrap(made.key, { passphrase }));
  return { phrase: made.phrase, key: made.key, publicKeyHex: made.publicKeyHex };
}

export async function unlockKey(storage: vault.Storage, passphrase: string): Promise<UnlockedKey> {
  need(passphrase);
  const wrapped = await vault.loadVault(storage);
  if (!wrapped) throw new Error('No key is stored in this browser yet. Make one first.');
  try {
    const key = await vault.unwrap(wrapped, { passphrase });
    return { key, publicKeyHex: vault.publicKeyHexFromKey(key) };
  } catch (err) {
    if (err instanceof vault.VaultError && err.code === 'wrong-secret') throw new Error('That passphrase does not open the stored key.');
    throw err;
  }
}

export async function forgetKey(storage: vault.Storage): Promise<void> {
  await vault.removeVault(storage);
}

/** The browser's localStorage behind bsv's storage port. */
export function browserStorage(): vault.Storage {
  return {
    get: (k) => localStorage.getItem(k),
    set: (k, v) => localStorage.setItem(k, v),
    remove: (k) => localStorage.removeItem(k),
  };
}
