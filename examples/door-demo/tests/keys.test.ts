import { describe, expect, it } from 'vitest';
import { vault } from 'bsv-kit/bsv';
import { forgetKey, hasStoredKey, makeKey, unlockKey } from '../src/keys.js';

describe('makeKey and unlockKey', () => {
  it('makes a key, stores it wrapped by the passphrase, and unlocks the same key', async () => {
    const storage = new vault.MemoryStorage();
    expect(await hasStoredKey(storage)).toBe(false);
    const made = await makeKey(storage, 'correct horse');
    expect(made.phrase.split(' ')).toHaveLength(12);
    expect(made.publicKeyHex).toMatch(/^0[23][0-9a-f]{64}$/);
    expect(await hasStoredKey(storage)).toBe(true);

    const unlocked = await unlockKey(storage, 'correct horse');
    expect(unlocked.publicKeyHex).toBe(made.publicKeyHex);
    expect(Array.from(unlocked.key)).toEqual(Array.from(made.key));
  });

  it('refuses a wrong passphrase in plain words', async () => {
    const storage = new vault.MemoryStorage();
    await makeKey(storage, 'correct horse');
    await expect(unlockKey(storage, 'wrong')).rejects.toThrow('That passphrase does not open the stored key.');
  });

  it('refuses an empty passphrase on make and on unlock', async () => {
    const storage = new vault.MemoryStorage();
    await expect(makeKey(storage, '  ')).rejects.toThrow('Type a passphrase first.');
    await expect(unlockKey(storage, '')).rejects.toThrow('Type a passphrase first.');
  });

  it('says there is no key when unlocking an empty store', async () => {
    await expect(unlockKey(new vault.MemoryStorage(), 'x')).rejects.toThrow('No key is stored in this browser yet. Make one first.');
  });

  it('will not overwrite a stored key by making another', async () => {
    const storage = new vault.MemoryStorage();
    const first = await makeKey(storage, 'one');
    await expect(makeKey(storage, 'two')).rejects.toThrow('A key is already stored in this browser. Unlock it, or forget it first.');
    expect((await unlockKey(storage, 'one')).publicKeyHex).toBe(first.publicKeyHex);
  });

  it('forgets the stored key', async () => {
    const storage = new vault.MemoryStorage();
    await makeKey(storage, 'one');
    await forgetKey(storage);
    expect(await hasStoredKey(storage)).toBe(false);
  });
});
