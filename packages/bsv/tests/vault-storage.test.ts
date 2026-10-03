import { describe, expect, it } from 'vitest';
import { vault } from '../src/index.js';

const { MemoryStorage, saveVault, loadVault, removeVault, wrap, unwrap, generate } = vault;

describe('MemoryStorage', () => {
  it('gets, sets and removes strings', async () => {
    const s = new MemoryStorage();
    expect(await s.get('a')).toBeNull();
    await s.set('a', 'one');
    expect(await s.get('a')).toBe('one');
    await s.remove('a');
    expect(await s.get('a')).toBeNull();
  });
});

describe('saveVault and loadVault', () => {
  it('keep a wrapped key as a string and give back one that still unwraps', async () => {
    const storage = new MemoryStorage();
    const { phrase, key } = await generate();
    await saveVault(storage, await wrap(key, { passphrase: phrase }));
    const loaded = await loadVault(storage);
    expect(loaded?.mode).toBe('phrase');
    expect(await unwrap(loaded!, { passphrase: phrase })).toEqual(key);
  });

  it('round-trips a PRF blob, and holds no plaintext key', async () => {
    const storage = new MemoryStorage();
    const { key } = await generate();
    const prfSecret = crypto.getRandomValues(new Uint8Array(32));
    await saveVault(storage, await wrap(key, { prfSecret }), 'mine');
    const raw = (await storage.get('mine'))!;
    expect(raw).not.toContain(Buffer.from(key).toString('hex'));
    expect(await unwrap((await loadVault(storage, 'mine'))!, { prfSecret })).toEqual(key);
  });

  it('loads nothing when nothing is stored, or when what is stored is not a vault', async () => {
    const storage = new MemoryStorage();
    expect(await loadVault(storage)).toBeNull();
    await storage.set('bsv-kit.vault', 'not json');
    expect(await loadVault(storage)).toBeNull();
    await storage.set('bsv-kit.vault', '{"mode":"prf"}');
    expect(await loadVault(storage)).toBeNull();
  });

  it('removes it', async () => {
    const storage = new MemoryStorage();
    await saveVault(storage, await wrap(new Uint8Array(32), { passphrase: 'p' }));
    await removeVault(storage);
    expect(await loadVault(storage)).toBeNull();
  });
});
