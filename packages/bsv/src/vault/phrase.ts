// The recovery phrase and the key it makes. Lifted from Postern's src/services/vault.ts:
// the key is the BIP32 master private key of a BIP39 phrase, and the phrase is never stored.
import { generateMnemonic, mnemonicToSeedWebcrypto, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { PrivateKey, Utils } from '@bsv/sdk';

/** A fresh 12-word BIP39 phrase. */
export function createMnemonic(): string {
  return generateMnemonic(wordlist, 128);
}

// A phrase typed on a phone keyboard can arrive auto-capitalised, autocorrected, or with stray
// whitespace. Every derivation normalises through this first, so a phrase that reads the same to
// a person derives the same key. Generated phrases are already in this form.
export function normalisePhrase(input: string): string {
  return input.normalize('NFKD').toLowerCase().trim().replace(/\s+/g, ' ');
}

export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(normalisePhrase(mnemonic), wordlist);
}

/** The words of `mnemonic` that are not in the BIP39 wordlist, as typed. */
export function findInvalidWords(mnemonic: string): string[] {
  return mnemonic
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .filter((word) => !wordlist.includes(normalisePhrase(word)));
}

/**
 * The BIP32 master key derivation (HMAC-SHA512("Bitcoin seed", seed)): IL is the 32-byte private
 * key. The standard way a BSV/BTC wallet turns a BIP39 seed into its first key.
 */
export async function keyFromPhrase(mnemonic: string): Promise<Uint8Array> {
  const seed = await mnemonicToSeedWebcrypto(normalisePhrase(mnemonic));
  const hmacKey = await crypto.subtle.importKey('raw', new TextEncoder().encode('Bitcoin seed'), { name: 'HMAC', hash: 'SHA-512' }, false, [
    'sign',
  ]);
  const digest = await crypto.subtle.sign('HMAC', hmacKey, seed);
  return new Uint8Array(digest).slice(0, 32);
}

/** The compressed public key (hex) this key signs for. Public: stored in the clear beside the wrapped key. */
export function publicKeyHexFromKey(key: Uint8Array): string {
  return PrivateKey.fromHex(Utils.toHex(Array.from(key))).toPublicKey().toString();
}

export interface GeneratedKey {
  /** The 12-word recovery phrase: show it once, never store it. */
  phrase: string;
  /** The 32-byte private key the phrase derives. */
  key: Uint8Array;
  publicKeyHex: string;
}

/** Makes a recovery phrase and the key it derives. */
export async function generate(): Promise<GeneratedKey> {
  const phrase = createMnemonic();
  const key = await keyFromPhrase(phrase);
  return { phrase, key, publicKeyHex: publicKeyHexFromKey(key) };
}
