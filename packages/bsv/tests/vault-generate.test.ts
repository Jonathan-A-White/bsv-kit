import { describe, expect, it } from 'vitest';
import { vault } from '../src/index.js';
import posternFixtures from './fixtures/postern-vault.json' with { type: 'json' };

const { generate, normalisePhrase, isValidMnemonic, findInvalidWords, keyFromPhrase, publicKeyHexFromKey } = vault;

describe('vault.generate', () => {
  it('yields a 12-word valid phrase and a 32-byte key that phrase derives', async () => {
    const made = await generate();
    expect(made.phrase.split(' ')).toHaveLength(12);
    expect(isValidMnemonic(made.phrase)).toBe(true);
    expect(made.key).toHaveLength(32);
    expect(await keyFromPhrase(made.phrase)).toEqual(made.key);
    expect(made.publicKeyHex).toBe(publicKeyHexFromKey(made.key));
  });

  it('makes a different phrase each time', async () => {
    expect((await generate()).phrase).not.toBe((await generate()).phrase);
  });

  it("derives Postern's key and public key for the same phrase (fixtures made by Postern)", async () => {
    for (const f of posternFixtures) {
      const key = await keyFromPhrase(f.phrase);
      expect(Buffer.from(key).toString('hex')).toBe(f.keyHex);
      expect(publicKeyHexFromKey(key)).toBe(f.publicKeyHex);
    }
  });

  it('derives the same key from a phrase typed with capitals and stray whitespace', async () => {
    const f = posternFixtures[0];
    const messy = '  ' + f.phrase.toUpperCase().replace(/ /g, '  ') + '\n';
    expect(Buffer.from(await keyFromPhrase(messy)).toString('hex')).toBe(f.keyHex);
  });
});

describe('phrase helpers', () => {
  it('normalises case, whitespace and unicode form', () => {
    expect(normalisePhrase('  Abandon  ABANDON\nabandon ')).toBe('abandon abandon abandon');
  });

  it('rejects a bad checksum', () => {
    expect(isValidMnemonic('abandon '.repeat(11) + 'about wrong')).toBe(false);
  });

  it('names words that are not in the wordlist, keeping their casing', () => {
    expect(findInvalidWords('Aple ' + 'abandon '.repeat(10) + 'about')).toEqual(['Aple']);
    expect(findInvalidWords(posternFixtures[0].phrase)).toEqual([]);
  });
});
