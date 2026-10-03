import { describe, expect, it } from 'vitest';
import { vault } from '../src/index.js';
import posternFixtures from './fixtures/postern-vault.json' with { type: 'json' };
import bsvkitFixtures from './fixtures/bsvkit-vault.json' with { type: 'json' };

const { wrap, unwrap, generate, VaultError } = vault;

const fromHex = (h: string): Uint8Array => new Uint8Array(Buffer.from(h, 'hex'));
const toHex = (b: ArrayBuffer | Uint8Array): string => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString('hex');

interface Fixture {
  mode: string;
  phrase: string;
  prfSecretHex?: string;
  passphrase?: string;
  saltHex?: string;
  keyHex: string;
  publicKeyHex: string;
  ciphertextHex: string;
  ivHex: string;
}

function secretOf(f: Fixture): { prfSecret: Uint8Array } | { passphrase: string } {
  return f.mode === 'prf' ? { prfSecret: fromHex(f.prfSecretHex!) } : { passphrase: f.passphrase ?? f.phrase };
}

function rowOf(f: Fixture): vault.WrappedVault {
  return {
    mode: f.mode as 'prf' | 'phrase',
    ciphertext: fromHex(f.ciphertextHex).buffer as ArrayBuffer,
    iv: fromHex(f.ivHex),
    ...(f.saltHex ? { salt: fromHex(f.saltHex) } : {}),
    publicKeyHex: f.publicKeyHex,
  };
}

describe('vault.wrap and vault.unwrap', () => {
  it('round-trips a key wrapped with a PRF secret', async () => {
    const { key, publicKeyHex } = await generate();
    const prfSecret = crypto.getRandomValues(new Uint8Array(32));
    const wrapped = await wrap(key, { prfSecret });
    expect(wrapped.mode).toBe('prf');
    expect(wrapped.publicKeyHex).toBe(publicKeyHex);
    expect(wrapped.iv).toHaveLength(12);
    expect(wrapped.salt).toBeUndefined();
    expect(await unwrap(wrapped, { prfSecret })).toEqual(key);
  });

  it('round-trips a key wrapped with a passphrase, storing a 16-byte salt', async () => {
    const { phrase, key } = await generate();
    const wrapped = await wrap(key, { passphrase: phrase });
    expect(wrapped.mode).toBe('phrase');
    expect(wrapped.salt).toHaveLength(16);
    expect(await unwrap(wrapped, { passphrase: phrase })).toEqual(key);
  });

  it('unwraps with the passphrase typed untidily', async () => {
    const { phrase, key } = await generate();
    const wrapped = await wrap(key, { passphrase: phrase });
    expect(await unwrap(wrapped, { passphrase: '  ' + phrase.toUpperCase() + '\n' })).toEqual(key);
  });

  it('accepts the PRF secret as an ArrayBuffer too', async () => {
    const { key } = await generate();
    const prfSecret = crypto.getRandomValues(new Uint8Array(32));
    const wrapped = await wrap(key, { prfSecret: prfSecret.buffer });
    expect(await unwrap(wrapped, { prfSecret })).toEqual(key);
  });

  it('fails cleanly with the wrong passphrase', async () => {
    const { phrase, key } = await generate();
    const wrapped = await wrap(key, { passphrase: phrase });
    const err = await unwrap(wrapped, { passphrase: (await generate()).phrase }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(VaultError);
    expect((err as vault.VaultError).code).toBe('wrong-secret');
  });

  it('fails cleanly with the wrong PRF secret', async () => {
    const { key } = await generate();
    const wrapped = await wrap(key, { prfSecret: crypto.getRandomValues(new Uint8Array(32)) });
    const err = await unwrap(wrapped, { prfSecret: crypto.getRandomValues(new Uint8Array(32)) }).catch((e: unknown) => e);
    expect((err as vault.VaultError).code).toBe('wrong-secret');
  });

  it('refuses a secret of the wrong kind, and a phrase blob with no salt', async () => {
    const { phrase, key } = await generate();
    const wrapped = await wrap(key, { passphrase: phrase });
    const mismatch = await unwrap(wrapped, { prfSecret: new Uint8Array(32) }).catch((e: unknown) => e);
    expect((mismatch as vault.VaultError).code).toBe('wrong-mode');
    const saltless = { ...wrapped, salt: undefined };
    const missing = await unwrap(saltless, { passphrase: phrase }).catch((e: unknown) => e);
    expect((missing as vault.VaultError).code).toBe('no-salt');
  });

  it('refuses a tampered blob', async () => {
    const { phrase, key } = await generate();
    const wrapped = await wrap(key, { passphrase: phrase });
    const bytes = new Uint8Array(wrapped.ciphertext.slice(0));
    bytes[0] ^= 1;
    const err = await unwrap({ ...wrapped, ciphertext: bytes.buffer }, { passphrase: phrase }).catch((e: unknown) => e);
    expect((err as vault.VaultError).code).toBe('wrong-secret');
  });

  it('rejects a key that is not 32 bytes', async () => {
    await expect(wrap(new Uint8Array(16), { passphrase: 'x' })).rejects.toThrow(/32/);
  });
});

describe('wrapped-key fixtures made by Postern', () => {
  it('has at least two blobs, one of each mode', () => {
    expect(posternFixtures.length).toBeGreaterThanOrEqual(2);
    expect(new Set(posternFixtures.map((f) => f.mode))).toEqual(new Set(['prf', 'phrase']));
  });

  it.each(posternFixtures.map((f, i) => [i, f.mode, f] as const))('blob %i (%s) unwraps to the recorded key', async (_i, _mode, f) => {
    const key = await unwrap(rowOf(f), secretOf(f));
    expect(toHex(key)).toBe(f.keyHex);
  });
});

describe('wrapped-key fixtures made by bsv-kit (Postern unwraps them: scripts/postern-fixtures.ts verify)', () => {
  it('has a blob of each mode', () => {
    expect(new Set(bsvkitFixtures.map((f) => f.mode))).toEqual(new Set(['prf', 'phrase']));
  });

  it.each(bsvkitFixtures.map((f, i) => [i, f.mode, f] as const))('blob %i (%s) still unwraps to the recorded key', async (_i, _mode, f) => {
    expect(toHex(await unwrap(rowOf(f), secretOf(f)))).toBe(f.keyHex);
  });
});
