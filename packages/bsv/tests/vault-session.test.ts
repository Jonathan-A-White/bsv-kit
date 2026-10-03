import { describe, expect, it } from 'vitest';
import { vault } from '../src/index.js';

const { createKeySession, memorySessionStore, SESSION_MS, SESSION_HOURS } = vault;

const KEY = new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1));

function setup() {
  const clock = { now: 1_000_000 };
  const store = memorySessionStore();
  const session = createKeySession({ store, now: () => clock.now });
  return { clock, store, session };
}

describe('the day-long key session', () => {
  it("lasts a day, from unlocking (Postern's period)", () => {
    expect(SESSION_HOURS).toBe(24);
    expect(SESSION_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('has no key until one is set', () => {
    expect(setup().session.getKey()).toBeNull();
  });

  it('keeps the key until the day is up, then drops it', () => {
    const { clock, session } = setup();
    void session.setKey(KEY);
    clock.now += SESSION_MS - 1;
    expect(session.getKey()).toEqual(KEY);
    clock.now += 1;
    expect(session.getKey()).toBeNull();
  });

  it('does not stretch the day when the key is used', () => {
    const { clock, session } = setup();
    void session.setKey(KEY);
    clock.now += SESSION_MS / 2;
    expect(session.getKey()).toEqual(KEY);
    clock.now += SESSION_MS / 2;
    expect(session.getKey()).toBeNull();
  });

  it('reports when it expires, and null with no key', () => {
    const { clock, session } = setup();
    expect(session.expiresAt()).toBeNull();
    void session.setKey(KEY);
    expect(session.expiresAt()).toBe(clock.now + SESSION_MS);
  });

  it('lock drops the key here and in the store', async () => {
    const { store, session } = setup();
    await session.setKey(KEY);
    expect(await store.get()).not.toBeNull();
    await session.lock();
    expect(session.getKey()).toBeNull();
    expect(await store.get()).toBeNull();
  });

  it('never stores the key in the clear, and the device key cannot be exported', async () => {
    const { store, session } = setup();
    await session.setKey(KEY);
    const row = (await store.get())!;
    expect(Array.from(new Uint8Array(row.ciphertext))).not.toEqual(Array.from(KEY));
    expect(row.deviceKey.extractable).toBe(false);
    expect(row.expiresAt).toBe(session.expiresAt());
  });

  it('resumes a session kept from earlier today, as a relaunch would', async () => {
    const { clock, store, session } = setup();
    await session.setKey(KEY);
    const relaunched = createKeySession({ store, now: () => clock.now + 60_000 });
    expect(relaunched.getKey()).toBeNull();
    expect(await relaunched.resume()).toBe(true);
    expect(relaunched.getKey()).toEqual(KEY);
    expect(relaunched.expiresAt()).toBe(session.expiresAt());
  });

  it('does not resume a lapsed session, and forgets it', async () => {
    const { clock, store, session } = setup();
    await session.setKey(KEY);
    const later = createKeySession({ store, now: () => clock.now + SESSION_MS });
    expect(await later.resume()).toBe(false);
    expect(await store.get()).toBeNull();
  });

  it('tells listeners when the key comes and goes', async () => {
    const { session } = setup();
    const seen: boolean[] = [];
    const stop = session.onChange(() => seen.push(session.getKey() !== null));
    await session.setKey(KEY);
    await session.lock();
    stop();
    await session.setKey(KEY);
    expect(seen).toEqual([true, false]);
  });

  it('works memory-only when no store is given', async () => {
    const clock = { now: 5 };
    const session = createKeySession({ now: () => clock.now });
    await session.setKey(KEY);
    expect(session.getKey()).toEqual(KEY);
    expect(await session.resume()).toBe(true);
  });

  it('stays memory-only when the store cannot keep a key (a relaunch then asks again)', async () => {
    const clock = { now: 5 };
    const broken = {
      save: async () => {
        throw new Error('no CryptoKey storage');
      },
      get: async () => null,
      clear: async () => undefined,
    };
    const session = createKeySession({ store: broken, now: () => clock.now });
    await session.setKey(KEY);
    expect(session.getKey()).toEqual(KEY);
  });
});
