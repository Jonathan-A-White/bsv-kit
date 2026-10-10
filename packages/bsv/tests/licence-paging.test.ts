// The WhatsOnChain reader reads the whole confirmed history: /confirmed/history, page after page by
// nextPageToken, as Postern's issue.ts does (WhatsOnChain's plain /history holds only the newest 100
// transactions, so a key with more after its mint read as 'none'). The network is a scripted fake fetch.
import { describe, expect, it } from 'vitest';
import { licence } from '../src/index.js';
import { ADDRESS, PUBLIC_KEY_HEX, mintTxHex, transferTxHex } from './support/records.js';

const { WhatsOnChainReader, hasLicence, licenceStatus } = licence;

const BASE = 'https://woc.example/v1';
const MINT = 'b'.repeat(64);
const TRANSFER = 'd'.repeat(64);
const txidOf = (n: number): string => n.toString(16).padStart(64, '0');

type Row = { tx_hash: string; height: number };
interface Page {
  result: Row[];
  nextPageToken?: string;
}

/** `count` transactions of an unrelated collection, newest height last, ids starting at `from`. */
function filler(count: number, from: number): { rows: Row[]; hex: Record<string, string> } {
  const rows: Row[] = [];
  const hex: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    const txid = txidOf(from + i);
    rows.push({ tx_hash: txid, height: from + i });
    hex[txid] = mintTxHex('cairn');
  }
  return { rows, hex };
}

/** A scripted WhatsOnChain: `pages(token)` answers /confirmed/history, `hex` the transactions. */
function scriptedFetch(pages: (token: string | null) => Page, hex: Record<string, string>) {
  const urls: string[] = [];
  const fetchFn = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    urls.push(url);
    const path = url.slice(BASE.length);
    if (path === '/txs/hex') {
      // The bulk read, as WhatsOnChain answers it: an error entry for a txid it does not have.
      const { txids } = JSON.parse(String(init?.body)) as { txids: string[] };
      return new Response(JSON.stringify(txids.map((txid) => (hex[txid] ? { txid, hex: hex[txid] } : { txid, error: 'unknown' }))), { status: 200 });
    }
    const history = /^\/address\/[^/]+\/confirmed\/history(?:\?token=(.*))?$/.exec(path);
    if (history) return new Response(JSON.stringify(pages(history[1] === undefined ? null : decodeURIComponent(history[1]))), { status: 200 });
    if (/^\/address\/[^/]+\/unconfirmed\/history$/.test(path)) {
      return new Response(JSON.stringify({ address: ADDRESS, script: '', result: [], error: '' }), { status: 200 });
    }
    const hexMatch = /^\/tx\/([0-9a-f]{64})\/hex$/.exec(path);
    if (hexMatch && hex[hexMatch[1]]) return new Response(hex[hexMatch[1]], { status: 200 });
    return new Response('Not Found', { status: 404 });
  }) as typeof fetch;
  const reader = new WhatsOnChainReader({ baseUrl: BASE, fetch: fetchFn, delay: async () => {} });
  return { reader, urls };
}

describe('WhatsOnChainReader confirmed history paging', () => {
  it('finds a mint on page 2 when page 1 holds 100 other transactions and a nextPageToken', async () => {
    const newest = filler(100, 1000);
    const { reader, urls } = scriptedFetch(
      (token) =>
        token === null
          ? { result: newest.rows, nextPageToken: 'page-2' }
          : { result: [{ tx_hash: MINT, height: 10 }] },
      { ...newest.hex, [MINT]: mintTxHex('postern') },
    );
    expect(await hasLicence(PUBLIC_KEY_HEX, 'postern', { reader })).toBe(true);
    const historyUrls = urls.filter((url) => url.includes('/confirmed/history'));
    expect(historyUrls).toEqual([`${BASE}/address/${ADDRESS}/confirmed/history`, `${BASE}/address/${ADDRESS}/confirmed/history?token=page-2`]);
  });

  it('lets a transfer on page 1 kill the mint on page 2', async () => {
    const { reader } = scriptedFetch(
      (token) =>
        token === null
          ? { result: [{ tx_hash: TRANSFER, height: 20 }], nextPageToken: 'page-2' }
          : { result: [{ tx_hash: MINT, height: 10 }] },
      { [MINT]: mintTxHex('postern'), [TRANSFER]: transferTxHex(`${MINT}:0`) },
    );
    expect(await hasLicence(PUBLIC_KEY_HEX, 'postern', { reader })).toBe(false);
    const status = await licenceStatus(PUBLIC_KEY_HEX, 'postern', { reader });
    expect(status).toMatchObject({ state: 'revoked', outpoint: { txid: MINT, vout: 0 }, collection: 'postern' });
  });

  it('returns the history oldest first, whatever order the pages came in', async () => {
    const { reader } = scriptedFetch(
      (token) =>
        token === null
          ? { result: [{ tx_hash: txidOf(3), height: 30 }, { tx_hash: txidOf(4), height: 40 }], nextPageToken: 'p2' }
          : { result: [{ tx_hash: txidOf(1), height: 10 }, { tx_hash: txidOf(2), height: 20 }] },
      {},
    );
    expect((await reader.getAddressHistory(ADDRESS)).map((entry) => entry.height)).toEqual([10, 20, 30, 40]);
  });

  it('stops at 50 pages when every page carries a token, and says so rather than answering from a partial list', async () => {
    let served = 0;
    const { reader, urls } = scriptedFetch(() => {
      served++;
      return { result: [{ tx_hash: txidOf(served), height: served }], nextPageToken: `t${served + 1}` };
    }, {});
    await expect(reader.getAddressHistory(ADDRESS)).rejects.toThrow('50 pages');
    expect(urls.filter((url) => url.includes('/confirmed/history'))).toHaveLength(50);
    expect(served).toBe(50);
  });

  it('paces the pages and leaves the unconfirmed read as it was', async () => {
    const delays: number[] = [];
    const urls: string[] = [];
    const fetchFn = (async (input: string | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.endsWith('/unconfirmed/history')) return new Response(JSON.stringify({ result: [{ tx_hash: txidOf(9), height: 0 }] }), { status: 200 });
      return new Response(JSON.stringify(url.includes('?token=') ? { result: [] } : { result: [], nextPageToken: 'n' }), { status: 200 });
    }) as typeof fetch;
    const reader = new WhatsOnChainReader({ baseUrl: BASE, fetch: fetchFn, delay: async (ms) => void delays.push(ms) });
    await reader.getAddressHistory(ADDRESS);
    expect(delays).toEqual([350]);
    expect(await reader.getUnconfirmedAddressHistory(ADDRESS)).toEqual([{ txid: txidOf(9), height: 0 }]);
    expect(urls.at(-1)).toBe(`${BASE}/address/${ADDRESS}/unconfirmed/history`);
  });

  // WhatsOnChain answers 404 'Not Found' on /confirmed/history for an address it has never seen; Postern
  // (confirmedHistory.ts, missingIsEmpty) reads that as no history.
  it('reads a 404 on the first page of the confirmed history as an empty history', async () => {
    const urls: string[] = [];
    const fetchFn = (async (input: string | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.endsWith('/unconfirmed/history')) return new Response(JSON.stringify({ address: ADDRESS, script: '', result: [], error: '' }), { status: 200 });
      return new Response('Not Found', { status: 404 });
    }) as typeof fetch;
    const reader = new WhatsOnChainReader({ baseUrl: BASE, fetch: fetchFn, delay: async () => {} });
    expect(await reader.getAddressHistory(ADDRESS)).toEqual([]);
    expect(await licenceStatus(PUBLIC_KEY_HEX, 'cairn', { reader })).toMatchObject({ state: 'none' });
    expect(await hasLicence(PUBLIC_KEY_HEX, 'cairn', { reader })).toBe(false);
  });

  it('still fails on a 404 for a later page of the confirmed history', async () => {
    const fetchFn = (async (input: string | URL) =>
      String(input).includes('?token=')
        ? new Response('Not Found', { status: 404 })
        : new Response(JSON.stringify({ result: [{ tx_hash: txidOf(1), height: 1 }], nextPageToken: 'p2' }), { status: 200 })) as typeof fetch;
    const reader = new WhatsOnChainReader({ baseUrl: BASE, fetch: fetchFn, delay: async () => {} });
    await expect(reader.getAddressHistory(ADDRESS)).rejects.toThrow('404');
  });

  it('still fails on a 404 for the unconfirmed history', async () => {
    const reader = new WhatsOnChainReader({
      baseUrl: BASE,
      fetch: (async () => new Response('Not Found', { status: 404 })) as typeof fetch,
      delay: async () => {},
    });
    await expect(reader.getUnconfirmedAddressHistory(ADDRESS)).rejects.toThrow('404');
  });

  it('names the error WhatsOnChain gives for a page', async () => {
    const reader = new WhatsOnChainReader({
      baseUrl: BASE,
      fetch: (async () => new Response(JSON.stringify({ result: [], error: 'bad token' }), { status: 200 })) as typeof fetch,
      delay: async () => {},
    });
    await expect(reader.getAddressHistory(ADDRESS)).rejects.toThrow('bad token');
  });
});
