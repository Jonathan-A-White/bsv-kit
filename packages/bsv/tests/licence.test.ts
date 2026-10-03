// hasLicence and licenceStatus, with the fake chain reader. Cases are Postern's licence.test.ts, plus
// the status words (held / none / revoked / indexing) and the 'still indexing' grace (mw-1589l.24).
import { describe, expect, it } from 'vitest';
import { licence } from '../src/index.js';
import { ADDRESS, OTHER_ADDRESS, PUBLIC_KEY_HEX, mintTxHex, transferTxHex } from './support/records.js';

const { FakeChainReader, addressForPublicKey, findLicence, hasLicence, licenceStatus, DEFAULT_GRACE_MS } = licence;

const MINT = 'b'.repeat(64);
const NOW = Date.parse('2026-10-03T12:00:00.000Z');
const at = (msBefore: number): string => new Date(NOW - msBefore).toISOString();

describe('addressForPublicKey', () => {
  it('derives the testnet address from the public key', () => {
    expect(addressForPublicKey(PUBLIC_KEY_HEX)).toBe(ADDRESS);
  });
});

describe('hasLicence', () => {
  it('is false when the address has no history', async () => {
    expect(await hasLicence(PUBLIC_KEY_HEX, 'postern', { reader: new FakeChainReader() })).toBe(false);
  });

  it('is true for a mint in the collection with no later transfer', async () => {
    const reader = new FakeChainReader();
    reader.addTransaction(ADDRESS, MINT, mintTxHex('postern'));
    expect(await hasLicence(PUBLIC_KEY_HEX, 'postern', { reader })).toBe(true);
  });

  it('is false once the token was transferred away', async () => {
    const reader = new FakeChainReader();
    reader.addTransaction(ADDRESS, MINT, mintTxHex('postern'));
    reader.addTransaction(ADDRESS, 'd'.repeat(64), transferTxHex(`${MINT}:0`));
    expect(await hasLicence(PUBLIC_KEY_HEX, 'postern', { reader })).toBe(false);
  });

  it("ignores a mint in another app's collection", async () => {
    const reader = new FakeChainReader();
    reader.addTransaction(ADDRESS, '2'.repeat(64), mintTxHex('cairn'));
    expect(await hasLicence(PUBLIC_KEY_HEX, 'postern', { reader })).toBe(false);
  });

  it('ignores a mint that names someone else as holder', async () => {
    const reader = new FakeChainReader();
    reader.addTransaction(ADDRESS, MINT, mintTxHex('postern', OTHER_ADDRESS));
    expect(await hasLicence(PUBLIC_KEY_HEX, 'postern', { reader })).toBe(false);
  });

  it('sees a mint that is only in the mempool', async () => {
    const reader = new FakeChainReader();
    reader.addUnconfirmedTransaction(ADDRESS, MINT, mintTxHex('postern'));
    expect(await hasLicence(PUBLIC_KEY_HEX, 'postern', { reader })).toBe(true);
  });

  it('sees a transfer that is only in the mempool, and a mint listed in both histories once', async () => {
    const reader = new FakeChainReader();
    reader.addTransaction(ADDRESS, MINT, mintTxHex('postern'));
    reader.addUnconfirmedTransaction(ADDRESS, MINT, mintTxHex('postern'));
    expect(await hasLicence(PUBLIC_KEY_HEX, 'postern', { reader })).toBe(true);
    reader.addUnconfirmedTransaction(ADDRESS, 'd'.repeat(64), transferTxHex(`${MINT}:0`));
    expect(await hasLicence(PUBLIC_KEY_HEX, 'postern', { reader })).toBe(false);
  });

  it('lets the chain being unreachable reject, rather than answer no', async () => {
    const reader = new FakeChainReader();
    reader.offline = true;
    await expect(hasLicence(PUBLIC_KEY_HEX, 'postern', { reader })).rejects.toThrow('unreachable');
  });
});

describe('findLicence', () => {
  it('names the outpoint (the mint at vout 0) and the collection', async () => {
    const reader = new FakeChainReader();
    reader.addTransaction(ADDRESS, MINT, mintTxHex('postern'));
    expect(await findLicence(PUBLIC_KEY_HEX, 'postern', { reader })).toEqual({ txid: MINT, vout: 0, collection: 'postern' });
  });

  it('takes the latest live mint of the collection', async () => {
    const reader = new FakeChainReader();
    reader.addTransaction(ADDRESS, '1'.repeat(64), mintTxHex('postern'));
    reader.addTransaction(ADDRESS, '2'.repeat(64), mintTxHex('postern'));
    expect(await findLicence(PUBLIC_KEY_HEX, 'postern', { reader })).toMatchObject({ txid: '2'.repeat(64) });
  });

  it('takes a list of collections in order of preference, whatever their order in the history', async () => {
    const legacy = 'spellforge-leaderboard-testnet';
    for (const order of [[legacy, 'postern'], ['postern', legacy]]) {
      const reader = new FakeChainReader();
      order.forEach((collection, i) => reader.addTransaction(ADDRESS, String(i + 3).repeat(64), mintTxHex(collection)));
      expect(await findLicence(PUBLIC_KEY_HEX, ['postern', legacy], { reader })).toMatchObject({ collection: 'postern' });
    }
  });

  it('falls back to the next collection when the preferred mint was transferred away', async () => {
    const legacy = 'spellforge-leaderboard-testnet';
    const reader = new FakeChainReader();
    reader.addTransaction(ADDRESS, '7'.repeat(64), mintTxHex(legacy));
    reader.addTransaction(ADDRESS, '8'.repeat(64), mintTxHex('postern'));
    reader.addTransaction(ADDRESS, '9'.repeat(64), transferTxHex(`${'8'.repeat(64)}:0`));
    expect(await findLicence(PUBLIC_KEY_HEX, ['postern', legacy], { reader })).toEqual({
      txid: '7'.repeat(64),
      vout: 0,
      collection: legacy,
    });
  });
});

describe('licenceStatus', () => {
  it('is held for a mint with no later transfer', async () => {
    const reader = new FakeChainReader();
    reader.addTransaction(ADDRESS, MINT, mintTxHex('postern'));
    expect(await licenceStatus(PUBLIC_KEY_HEX, 'postern', { reader, now: () => NOW })).toEqual({
      state: 'held',
      outpoint: { txid: MINT, vout: 0 },
      collection: 'postern',
      checkedAt: new Date(NOW).toISOString(),
    });
  });

  it('is revoked for a mint with a later transfer', async () => {
    const reader = new FakeChainReader();
    reader.addTransaction(ADDRESS, MINT, mintTxHex('postern'));
    reader.addTransaction(ADDRESS, 'd'.repeat(64), transferTxHex(`${MINT}:0`));
    expect(await licenceStatus(PUBLIC_KEY_HEX, 'postern', { reader, now: () => NOW })).toEqual({
      state: 'revoked',
      outpoint: { txid: MINT, vout: 0 },
      collection: 'postern',
      checkedAt: new Date(NOW).toISOString(),
    });
  });

  it('is none when there is nothing', async () => {
    expect(await licenceStatus(PUBLIC_KEY_HEX, 'postern', { reader: new FakeChainReader(), now: () => NOW })).toEqual({
      state: 'none',
      checkedAt: new Date(NOW).toISOString(),
    });
  });

  it('is none when the only mint is in another collection', async () => {
    const reader = new FakeChainReader();
    reader.addTransaction(ADDRESS, MINT, mintTxHex('cairn'));
    expect((await licenceStatus(PUBLIC_KEY_HEX, 'postern', { reader })).state).toBe('none');
  });

  describe('the still-indexing grace', () => {
    it('is indexing for a mint broadcast within the grace period and not yet indexed', async () => {
      const pending = { txid: MINT, broadcastAt: at(30_000) };
      const status = await licenceStatus(PUBLIC_KEY_HEX, 'postern', { reader: new FakeChainReader(), pending, now: () => NOW });
      expect(status).toEqual({ state: 'indexing', txid: MINT, broadcastAt: pending.broadcastAt, checkedAt: new Date(NOW).toISOString() });
    });

    it('is none once the grace period has passed (the mint is not coming)', async () => {
      const pending = { txid: MINT, broadcastAt: at(DEFAULT_GRACE_MS + 1) };
      const status = await licenceStatus(PUBLIC_KEY_HEX, 'postern', { reader: new FakeChainReader(), pending, now: () => NOW });
      expect(status.state).toBe('none');
    });

    it('takes the grace period as an option', async () => {
      const pending = { txid: MINT, broadcastAt: at(5_000) };
      const options = { reader: new FakeChainReader(), pending, now: () => NOW };
      expect((await licenceStatus(PUBLIC_KEY_HEX, 'postern', { ...options, graceMs: 10_000 })).state).toBe('indexing');
      expect((await licenceStatus(PUBLIC_KEY_HEX, 'postern', { ...options, graceMs: 1_000 })).state).toBe('none');
    });

    it('is held, not indexing, once the mint shows in the history', async () => {
      const reader = new FakeChainReader();
      reader.addTransaction(ADDRESS, MINT, mintTxHex('postern'));
      const status = await licenceStatus(PUBLIC_KEY_HEX, 'postern', { reader, pending: { txid: MINT, broadcastAt: at(1_000) }, now: () => NOW });
      expect(status.state).toBe('held');
    });

    it('is indexing, not revoked, for a re-mint while the old mint stands transferred away', async () => {
      const reader = new FakeChainReader();
      reader.addTransaction(ADDRESS, '1'.repeat(64), mintTxHex('postern'));
      reader.addTransaction(ADDRESS, '2'.repeat(64), transferTxHex(`${'1'.repeat(64)}:0`));
      const status = await licenceStatus(PUBLIC_KEY_HEX, 'postern', { reader, pending: { txid: MINT, broadcastAt: at(1_000) }, now: () => NOW });
      expect(status.state).toBe('indexing');
    });

    it('is revoked, not indexing, once the grace has passed on a re-mint that never showed', async () => {
      const reader = new FakeChainReader();
      reader.addTransaction(ADDRESS, '1'.repeat(64), mintTxHex('postern'));
      reader.addTransaction(ADDRESS, '2'.repeat(64), transferTxHex(`${'1'.repeat(64)}:0`));
      const status = await licenceStatus(PUBLIC_KEY_HEX, 'postern', {
        reader,
        pending: { txid: MINT, broadcastAt: at(DEFAULT_GRACE_MS * 2) },
        now: () => NOW,
      });
      expect(status.state).toBe('revoked');
    });

    it('ignores a pending marker whose time cannot be read', async () => {
      const status = await licenceStatus(PUBLIC_KEY_HEX, 'postern', {
        reader: new FakeChainReader(),
        pending: { txid: MINT, broadcastAt: 'not a time' },
        now: () => NOW,
      });
      expect(status.state).toBe('none');
    });
  });
});
