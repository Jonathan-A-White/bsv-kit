// What a licence check with an issuer costs (mw-fm7wmn.22). Legend's check:licence took ~19 minutes on
// testnet: every transaction of the holder's and the issuer's histories was read one request at a time, and
// every revoke the issuer ever wrote had its parents read to check the signature, whoever's licence it
// revoked. Here a counting reader stands over a chain shaped like the real one (a holder with a long
// history of unrelated transactions; an issuer with dozens of mints to other holders and several revokes
// of their licences) and counts the requests WhatsOnChain would see.
import { P2PKH, PrivateKey, Transaction, UnlockingScript } from '@bsv/sdk';
import { describe, expect, it } from 'vitest';
import { licence } from '../src/index.js';
import type { AddressHistoryEntry, ChainReader } from '../src/licence/index.js';
import { ADDRESS, PUBLIC_KEY_HEX, signedRecordTx } from './support/records.js';

const { FakeChainReader, licenceStatus } = licence;

const ISSUER = PrivateKey.fromHex('22'.repeat(32));
const ISSUER_PUBLIC_KEY = ISSUER.toPublicKey().toString();
const ISSUER_ADDRESS = ISSUER.toPublicKey().toAddress('testnet');
const OTHERS = 40;
const OTHERS_REVOKED = 6;
const HOLDER_HISTORY = 300;
/** WhatsOnChain's /txs/hex takes at most 20 txids a request. */
const BULK = 20;

/** A P2PKH output to the issuer that a record can spend; `n` makes each one its own transaction. */
function issuerFunding(n: number): Transaction {
  const tx = new Transaction();
  tx.addOutput({ lockingScript: new P2PKH().lock(ISSUER_ADDRESS), satoshis: 1000 + n });
  return tx;
}

/** A transaction paying the holder that carries no record: the long history of a much-used key. */
function unrelatedPayment(n: number): string {
  const tx = new Transaction();
  tx.addInput({ sourceTXID: n.toString(16).padStart(64, '0'), sourceOutputIndex: 0, unlockingScript: new UnlockingScript() });
  tx.addOutput({ lockingScript: new P2PKH().lock(ADDRESS), satoshis: 500 + n });
  return tx.toHex();
}

interface Chain {
  fake: InstanceType<typeof FakeChainReader>;
  /** The issuer's history, in order; parents are known by txid only. */
  issuerTxids: string[];
  /** Every transaction a signed record spends from (none is in any history). */
  parents: Set<string>;
  holderMint?: string;
}

/** The chain: the holder's unrelated history, then the issuer's mints to others and its revokes of some of them. */
async function issuerShapedChain(options: { holderMint?: boolean; holderRevoked?: boolean } = {}): Promise<Chain> {
  const fake = new FakeChainReader();
  for (let n = 0; n < HOLDER_HISTORY; n++) {
    const hex = unrelatedPayment(n);
    fake.addTransaction(ADDRESS, Transaction.fromHex(hex).id('hex'), hex);
  }
  const issuerTxids: string[] = [];
  const parents = new Set<string>();
  let funded = 0;
  const issue = async (recordType: 'M' | 'W', payload: object): Promise<string> => {
    const funding = issuerFunding(funded++);
    fake.addKnownTransaction(funding.id('hex'), funding.toHex());
    parents.add(funding.id('hex'));
    const record = await signedRecordTx(ISSUER, funding, recordType, payload);
    fake.addTransaction(ISSUER_ADDRESS, record.txid, record.hex);
    issuerTxids.push(record.txid);
    return record.txid;
  };
  const otherMints: string[] = [];
  for (let n = 0; n < OTHERS; n++) {
    const other = PrivateKey.fromHex((n + 100).toString(16).padStart(64, '0')).toPublicKey().toAddress('testnet');
    otherMints.push(await issue('M', { collection: 'legend', holder: other }));
  }
  for (const mint of otherMints.slice(0, OTHERS_REVOKED)) await issue('W', { kind: 'revoke', origin: `${mint}:0` });
  const chain: Chain = { fake, issuerTxids, parents };
  if (options.holderMint) {
    chain.holderMint = await issue('M', { collection: 'legend', holder: ADDRESS });
    if (options.holderRevoked) await issue('W', { kind: 'revoke', origin: `${chain.holderMint}:0` });
  }
  return chain;
}

/** A ChainReader over the fake that counts what WhatsOnChain would be asked: one request per history read and
 * per transaction, and, when `bulk`, one per 20 txids of a bulk read. `fetched` lists every txid asked for. */
function countingReader(fake: InstanceType<typeof FakeChainReader>, bulk: boolean) {
  const counted = { requests: 0, fetched: [] as string[] };
  const reader: ChainReader = {
    async getAddressHistory(address: string): Promise<AddressHistoryEntry[]> {
      counted.requests++;
      return fake.getAddressHistory(address);
    },
    async getUnconfirmedAddressHistory(address: string): Promise<AddressHistoryEntry[]> {
      counted.requests++;
      return fake.getUnconfirmedAddressHistory(address);
    },
    async getTransactionHex(txid: string): Promise<string> {
      counted.requests++;
      counted.fetched.push(txid);
      return fake.getTransactionHex(txid);
    },
  };
  if (bulk) {
    reader.getTransactionHexes = async (txids: readonly string[]): Promise<Map<string, string>> => {
      counted.requests += Math.ceil(txids.length / BULK);
      counted.fetched.push(...txids);
      const found = new Map<string, string>();
      for (const txid of txids) found.set(txid, await fake.getTransactionHex(txid));
      return found;
    };
  }
  return { reader, counted };
}

const repeats = (txids: readonly string[]): string[] => txids.filter((txid, i) => txids.indexOf(txid) !== i);

describe('a licence check with an issuer, counted', () => {
  for (const bulk of [false, true]) {
    describe(bulk ? 'with a reader that reads in bulk' : 'with a reader that reads one transaction at a time', () => {
      it("reads no parent of a revoke of someone else's licence, and no transaction twice", async () => {
        const chain = await issuerShapedChain();
        const { reader, counted } = countingReader(chain.fake, bulk);
        const status = await licenceStatus(PUBLIC_KEY_HEX, 'legend', { reader, issuer: ISSUER_PUBLIC_KEY, now: () => 0 });
        expect(status.state).toBe('none');
        expect(counted.fetched.filter((txid) => chain.parents.has(txid))).toEqual([]);
        expect(repeats(counted.fetched)).toEqual([]);
      });

      it("still honours the issuer's revoke of this holder's licence, reading only that revoke's parent and the mint's", async () => {
        const chain = await issuerShapedChain({ holderMint: true, holderRevoked: true });
        const { reader, counted } = countingReader(chain.fake, bulk);
        const status = await licenceStatus(PUBLIC_KEY_HEX, 'legend', { reader, issuer: ISSUER_PUBLIC_KEY, now: () => 0 });
        expect(status).toMatchObject({ state: 'revoked', outpoint: { txid: chain.holderMint, vout: 0 } });
        expect(counted.fetched.filter((txid) => chain.parents.has(txid))).toHaveLength(2);
        expect(repeats(counted.fetched)).toEqual([]);
      });
    });
  }

  it('reads a parent a history also lists once, whichever comes first', async () => {
    // The issuer's mint and the transaction funding it in one block: the history may list the mint first.
    const fake = new FakeChainReader();
    const funding = issuerFunding(0);
    const mint = await signedRecordTx(ISSUER, funding, 'M', { collection: 'legend', holder: ADDRESS });
    fake.addTransaction(ISSUER_ADDRESS, mint.txid, mint.hex);
    fake.addTransaction(ISSUER_ADDRESS, funding.id('hex'), funding.toHex());
    const { reader, counted } = countingReader(fake, false);
    expect(await licenceStatus(PUBLIC_KEY_HEX, 'legend', { reader, issuer: ISSUER_PUBLIC_KEY, now: () => 0 })).toMatchObject({ state: 'held' });
    expect(repeats(counted.fetched)).toEqual([]);
  });

  it('asks WhatsOnChain one request per 20 history transactions for a holder with none, not one per record and parent', async () => {
    const chain = await issuerShapedChain();
    const { reader, counted } = countingReader(chain.fake, true);
    await licenceStatus(PUBLIC_KEY_HEX, 'legend', { reader, issuer: ISSUER_PUBLIC_KEY, now: () => 0 });
    const histories = 4; // confirmed and unconfirmed, of the holder and of the issuer
    expect(counted.requests).toBe(histories + Math.ceil((HOLDER_HISTORY + chain.issuerTxids.length) / BULK));
    expect(counted.requests).toBeLessThan(HOLDER_HISTORY / 10);
  });

  it('asks one more request, for its mint\'s parent, for a holder with one live licence', async () => {
    const chain = await issuerShapedChain({ holderMint: true });
    const { reader, counted } = countingReader(chain.fake, true);
    const status = await licenceStatus(PUBLIC_KEY_HEX, 'legend', { reader, issuer: ISSUER_PUBLIC_KEY, now: () => 0 });
    expect(status).toMatchObject({ state: 'held', outpoint: { txid: chain.holderMint, vout: 0 } });
    expect(counted.requests).toBe(4 + Math.ceil((HOLDER_HISTORY + chain.issuerTxids.length) / BULK) + 1);
  });
});

describe('the transaction cache', () => {
  /** An in-memory cache, as an app might keep in IndexedDB. */
  function memoryCache() {
    const stored = new Map<string, string>();
    return { stored, txCache: { get: async (txid: string) => stored.get(txid), set: async (txid: string, hex: string) => void stored.set(txid, hex) } };
  }

  it('keeps every transaction a check reads, and a second check reads none of them again', async () => {
    const chain = await issuerShapedChain({ holderMint: true });
    const { stored, txCache } = memoryCache();
    const first = countingReader(chain.fake, true);
    const cold = await licenceStatus(PUBLIC_KEY_HEX, 'legend', { reader: first.reader, issuer: ISSUER_PUBLIC_KEY, txCache, now: () => 0 });
    expect(new Set(stored.keys())).toEqual(new Set(first.counted.fetched));
    const second = countingReader(chain.fake, true);
    const warm = await licenceStatus(PUBLIC_KEY_HEX, 'legend', { reader: second.reader, issuer: ISSUER_PUBLIC_KEY, txCache, now: () => 0 });
    expect(warm).toEqual(cold);
    expect(second.counted.fetched).toEqual([]);
    expect(second.counted.requests).toBe(4);
  });

  it('reads again a cached transaction that is not the one its txid names, and replaces it', async () => {
    const chain = await issuerShapedChain({ holderMint: true });
    const { stored, txCache } = memoryCache();
    stored.set(chain.holderMint!, unrelatedPayment(0));
    const { reader, counted } = countingReader(chain.fake, false);
    const status = await licenceStatus(PUBLIC_KEY_HEX, 'legend', { reader, issuer: ISSUER_PUBLIC_KEY, txCache, now: () => 0 });
    expect(status).toMatchObject({ state: 'held', outpoint: { txid: chain.holderMint } });
    expect(counted.fetched).toContain(chain.holderMint);
    expect(Transaction.fromHex(stored.get(chain.holderMint!)!).id('hex')).toBe(chain.holderMint);
  });

  it('answers from the chain when the cache fails to read or to keep', async () => {
    const chain = await issuerShapedChain({ holderMint: true });
    const txCache = {
      get: async (): Promise<string | undefined> => {
        throw new Error('IndexedDB is closed');
      },
      set: () => {
        throw new Error('quota');
      },
    };
    const { reader } = countingReader(chain.fake, true);
    expect(await licenceStatus(PUBLIC_KEY_HEX, 'legend', { reader, issuer: ISSUER_PUBLIC_KEY, txCache, now: () => 0 })).toMatchObject({ state: 'held' });
  });
});
