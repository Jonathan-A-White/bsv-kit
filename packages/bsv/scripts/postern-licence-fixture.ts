// One-off: records what POSTERN's own licence check does, as packages/bsv/tests/fixtures/postern-licence.json:
// the transaction hex Postern's own test builders make (nftgate typed records), and the WhatsOnChain
// requests (URL, method, delay) Postern's findLicence + WhatsOnChainProvider make against a scripted
// WhatsOnChain, with the answer findLicence gave. Not part of the build or the tests (neither tsconfig
// includes scripts/). Run it with Postern's tsx:
//
//   (cd <postern-checkout> && npx tsx <bsv-kit>/packages/bsv/scripts/postern-licence-fixture.ts) \
//     > packages/bsv/tests/fixtures/postern-licence.json
import { PrivateKey } from '@bsv/sdk';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Postern's checkout: POSTERN_DIR, or the current directory (run these from the Postern checkout).
const POSTERN = resolve(process.env.POSTERN_DIR ?? process.cwd());
const postern = (path: string) => import(pathToFileURL(resolve(POSTERN, path)).href);
const { WhatsOnChainProvider, chainConfig } = await postern('node_modules/spell-forge-bsv/dist/index.js');
const { findLicence } = await postern('src/services/licence.ts');
const { COCKPIT_COLLECTION, LEGACY_LICENCE_COLLECTION } = await postern('src/services/collections.ts');
const { mintRecordTxHex, transferRecordTxHex } = await postern('tests/support/nftgate-fixtures.ts');

const KEY = PrivateKey.fromHex('11'.repeat(32));
const PUBLIC_KEY_HEX = KEY.toPublicKey().toString();
const ADDRESS = KEY.toPublicKey().toAddress(chainConfig.network);
const OTHER_ADDRESS = 'mzSomeoneElseAddress';

const MINT_TXID = 'b'.repeat(64);
const TRANSFER_TXID = 'd'.repeat(64);
const UNRELATED_TXID = 'a'.repeat(64);

const hexes = {
  mintPostern: mintRecordTxHex(COCKPIT_COLLECTION, ADDRESS),
  mintLegacy: mintRecordTxHex(LEGACY_LICENCE_COLLECTION, ADDRESS),
  mintOther: mintRecordTxHex('some-other-collection', ADDRESS),
  mintForSomeoneElse: mintRecordTxHex(COCKPIT_COLLECTION, OTHER_ADDRESS),
  transferAwayFromB: transferRecordTxHex(`${MINT_TXID}:0`, OTHER_ADDRESS),
};

interface Scenario {
  name: string;
  /** Confirmed history, as WhatsOnChain's /history answers it. */
  history: { tx_hash: string; height: number }[];
  /** Mempool history, as /unconfirmed/history answers it (wrapped in { result }). */
  unconfirmed: { tx_hash: string; height: number }[];
  hexByTxid: Record<string, string>;
  /** txids whose first /hex request is answered 404, as WhatsOnChain's index lagging. */
  lagOnce?: string[];
}

const scenarios: Scenario[] = [
  { name: 'empty history', history: [], unconfirmed: [], hexByTxid: {} },
  {
    name: 'a confirmed mint',
    history: [{ tx_hash: MINT_TXID, height: 100 }],
    unconfirmed: [],
    hexByTxid: { [MINT_TXID]: hexes.mintPostern },
  },
  {
    name: 'a confirmed mint, later transferred away (the transfer still in the mempool)',
    history: [{ tx_hash: MINT_TXID, height: 100 }],
    unconfirmed: [{ tx_hash: TRANSFER_TXID, height: 0 }],
    hexByTxid: { [MINT_TXID]: hexes.mintPostern, [TRANSFER_TXID]: hexes.transferAwayFromB },
  },
  {
    name: 'an unrelated transaction, then a mint seen both confirmed and in the mempool',
    history: [
      { tx_hash: UNRELATED_TXID, height: 90 },
      { tx_hash: MINT_TXID, height: 100 },
    ],
    unconfirmed: [{ tx_hash: MINT_TXID, height: 0 }],
    hexByTxid: { [UNRELATED_TXID]: hexes.mintOther, [MINT_TXID]: hexes.mintPostern },
  },
  {
    name: 'a mint whose hex 404s once, as the index lags',
    history: [{ tx_hash: MINT_TXID, height: 0 }],
    unconfirmed: [],
    hexByTxid: { [MINT_TXID]: hexes.mintPostern },
    lagOnce: [MINT_TXID],
  },
];

async function record(scenario: Scenario) {
  const requests: { url: string; method: string }[] = [];
  const delays: number[] = [];
  const lagged = new Set<string>();
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, method: init?.method ?? 'GET' });
    const path = url.slice(chainConfig.providerBaseUrl.length);
    if (path === `/address/${ADDRESS}/history`) return new Response(JSON.stringify(scenario.history), { status: 200 });
    if (path === `/address/${ADDRESS}/unconfirmed/history`) {
      return new Response(JSON.stringify({ address: ADDRESS, script: '', result: scenario.unconfirmed, error: '' }), { status: 200 });
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
  const provider = new WhatsOnChainProvider(chainConfig, fetchFn, async (ms: number) => {
    delays.push(ms);
  });
  const found = await findLicence(PUBLIC_KEY_HEX, provider);
  return { ...scenario, requests, delays, found };
}

const recorded = [];
for (const scenario of scenarios) recorded.push(await record(scenario));
process.stdout.write(
  JSON.stringify(
    {
      keyHex: '11'.repeat(32),
      publicKeyHex: PUBLIC_KEY_HEX,
      address: ADDRESS,
      otherAddress: OTHER_ADDRESS,
      baseUrl: chainConfig.providerBaseUrl,
      txids: { mint: MINT_TXID, transfer: TRANSFER_TXID, unrelated: UNRELATED_TXID },
      hexes,
      scenarios: recorded,
    },
    null,
    2,
  ) + '\n',
);
