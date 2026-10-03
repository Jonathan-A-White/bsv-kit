// The real chain reader against the requests POSTERN's own WhatsOnChainProvider made (fixtures/postern-licence.json,
// recorded by scripts/postern-licence-fixture.ts): the same URLs in the same order, the same pacing and
// lag retries, and the same answer from the licence check. The network is a fake fetch.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { licence } from '../src/index.js';
import { PUBLIC_KEY_HEX } from './support/records.js';

const { WhatsOnChainReader, findLicence, WOC_TESTNET_URL } = licence;

interface Scenario {
  name: string;
  history: { tx_hash: string; height: number }[];
  unconfirmed: { tx_hash: string; height: number }[];
  hexByTxid: Record<string, string>;
  lagOnce?: string[];
  requests: { url: string; method: string }[];
  delays: number[];
  found: { txid: string; vout: number; collection: string } | null;
}
const fixture = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'postern-licence.json'), 'utf-8')) as {
  address: string;
  baseUrl: string;
  scenarios: Scenario[];
};

/** A scripted WhatsOnChain answering the way the fixture's scenario says. */
function scriptedFetch(scenario: Scenario) {
  const requests: { url: string; method: string }[] = [];
  const lagged = new Set<string>();
  const fetchFn = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, method: init?.method ?? 'GET' });
    const path = url.slice(fixture.baseUrl.length);
    if (path === `/address/${fixture.address}/history`) return new Response(JSON.stringify(scenario.history), { status: 200 });
    if (path === `/address/${fixture.address}/unconfirmed/history`) {
      return new Response(JSON.stringify({ address: fixture.address, script: '', result: scenario.unconfirmed, error: '' }), { status: 200 });
    }
    const hexMatch = /^\/tx\/([0-9a-f]{64})\/hex$/.exec(path);
    if (hexMatch) {
      const txid = hexMatch[1];
      if (scenario.lagOnce?.includes(txid) && !lagged.has(txid)) {
        lagged.add(txid);
        return new Response('Not Found', { status: 404 });
      }
      const hex = scenario.hexByTxid[txid];
      return hex ? new Response(`${hex}\n`, { status: 200 }) : new Response('Not Found', { status: 404 });
    }
    return new Response('unexpected', { status: 500 });
  }) as typeof fetch;
  return { fetchFn, requests };
}

describe('WhatsOnChainReader against the requests Postern made', () => {
  it('has the same base URL as Postern\'s chainConfig', () => {
    expect(WOC_TESTNET_URL).toBe(fixture.baseUrl);
  });

  for (const scenario of fixture.scenarios) {
    it(`builds the same URLs, pacing and answer: ${scenario.name}`, async () => {
      const { fetchFn, requests } = scriptedFetch(scenario);
      const delays: number[] = [];
      const reader = new WhatsOnChainReader({ fetch: fetchFn, delay: async (ms) => void delays.push(ms) });
      const found = await findLicence(PUBLIC_KEY_HEX, ['postern', 'spellforge-leaderboard-testnet'], { reader });
      expect(requests).toEqual(scenario.requests);
      expect(delays).toEqual(scenario.delays);
      expect(found).toEqual(scenario.found);
    });
  }
});

describe('WhatsOnChainReader requests', () => {
  const ok = (body: unknown) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200 });

  it('reads a bare array and a { result } wrapper alike, and trims the address', async () => {
    const urls: string[] = [];
    const fetchFn = (async (input: string | URL) => {
      urls.push(String(input));
      return String(input).endsWith('/unconfirmed/history') ? ok({ result: [{ tx_hash: 'b'.repeat(64), height: 0 }] }) : ok([{ tx_hash: 'a'.repeat(64), height: 5 }]);
    }) as typeof fetch;
    const reader = new WhatsOnChainReader({ fetch: fetchFn, baseUrl: 'https://woc.example/v1', delay: async () => {} });
    expect(await reader.getAddressHistory(' addr1 ')).toEqual([{ txid: 'a'.repeat(64), height: 5 }]);
    expect(await reader.getUnconfirmedAddressHistory(' addr1 ')).toEqual([{ txid: 'b'.repeat(64), height: 0 }]);
    expect(urls).toEqual(['https://woc.example/v1/address/addr1/history', 'https://woc.example/v1/address/addr1/unconfirmed/history']);
  });

  it('rejects a body that is not a history, naming the endpoint', async () => {
    const reader = new WhatsOnChainReader({ fetch: (async () => ok({ nope: 1 })) as typeof fetch, delay: async () => {} });
    await expect(reader.getAddressHistory('addr1')).rejects.toThrow('/address/addr1/history returned an unexpected response shape');
  });

  it('retries a 429 with a doubling delay, then gives up', async () => {
    let calls = 0;
    const delays: number[] = [];
    const reader = new WhatsOnChainReader({
      fetch: (async () => (++calls, new Response('', { status: 429 }))) as typeof fetch,
      delay: async (ms) => void delays.push(ms),
    });
    await expect(reader.getAddressHistory('addr1')).rejects.toThrow('429');
    expect(calls).toBe(3);
    expect(delays).toEqual([500, 1000]);
  });

  it('retries a fetch that throws (a CORS-less 429 looks like one), then says it could not reach WhatsOnChain', async () => {
    let calls = 0;
    const reader = new WhatsOnChainReader({
      fetch: (async () => {
        calls++;
        throw new TypeError('Failed to fetch');
      }) as typeof fetch,
      delay: async () => {},
    });
    await expect(reader.getAddressHistory('addr1')).rejects.toThrow('Could not reach WhatsOnChain');
    expect(calls).toBe(3);
  });

  it('does not retry any other refusal, and names the status and the start of the body', async () => {
    let calls = 0;
    const reader = new WhatsOnChainReader({ fetch: (async () => (++calls, new Response('teapot', { status: 418 }))) as typeof fetch, delay: async () => {} });
    await expect(reader.getAddressHistory('addr1')).rejects.toThrow('WhatsOnChain said 418: teapot');
    expect(calls).toBe(1);
  });

  it('keeps asking for a transaction that 404s, up to 15 tries a second apart, then gives up', async () => {
    let calls = 0;
    const delays: number[] = [];
    const reader = new WhatsOnChainReader({
      fetch: (async () => (++calls, new Response('Not Found', { status: 404 }))) as typeof fetch,
      delay: async (ms) => void delays.push(ms),
    });
    await expect(reader.getTransactionHex('c'.repeat(64))).rejects.toThrow('404');
    expect(calls).toBe(15);
    expect(delays.filter((ms) => ms === 1000)).toHaveLength(14);
  });
});
