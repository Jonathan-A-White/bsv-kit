// One-off: records the Authorization header POSTERN's own apiFetch (src/services/apiAuth.ts, the v2
// 'Postern2' signer of mw-xhtcup.10) sends for a fixed key and a fixed nonce, plus the requests it makes,
// as packages/bsv/tests/fixtures/postern-door.json. Three cases: a GET with a query, a POST with a JSON
// string body, a POST with a binary body. The top-level authorization/requests are the first case's.
// Not part of the build or the tests (neither tsconfig includes scripts/). Run it with Postern's tsx:
//
//   (cd /home/jwhite/postern && npx tsx <bsv-kit>/packages/bsv/scripts/postern-door-fixture.ts) \
//     > packages/bsv/tests/fixtures/postern-door.json
import { apiFetch } from '/home/jwhite/postern/src/services/apiAuth.ts';
import { publicKeyHexFromMasterKey } from '/home/jwhite/postern/src/services/vault.ts';

const KEY_HEX = '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20';
const NONCE = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
const key = new Uint8Array(Buffer.from(KEY_HEX, 'hex'));

interface Case {
  name: string;
  path: string;
  method: string;
  /** A string body is sent as text, bodyHex as these bytes; neither means no body. */
  body?: string;
  bodyHex?: string;
}

const CASES: Case[] = [
  { name: 'GET with a query', path: '/messages?since=0', method: 'GET' },
  { name: 'POST with a JSON body', path: '/messages', method: 'POST', body: '{"to":"mill","text":"héllo ✓"}' },
  { name: 'POST with a binary body', path: '/blobs', method: 'POST', bodyHex: '00ff10809f7e0001' },
];

const cases = [];
for (const c of CASES) {
  const requests: { url: string; method: string; authorization: string | null }[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, method: init?.method ?? 'GET', authorization: new Headers(init?.headers).get('Authorization') });
    return url.endsWith('/challenge')
      ? new Response(JSON.stringify({ nonce: NONCE }), { status: 200 })
      : new Response('{}', { status: 200 });
  }) as typeof fetch;
  const body = c.bodyHex !== undefined ? new Uint8Array(Buffer.from(c.bodyHex, 'hex')) : c.body;
  await apiFetch(c.path, c.method === 'GET' ? undefined : { method: c.method, body }, { unlockedKey: key, apiBase: '/api', fetchImpl });
  cases.push({ ...c, authorization: requests.find((r) => r.authorization)?.authorization, requests });
}

process.stdout.write(
  JSON.stringify(
    {
      source: "Postern src/services/apiAuth.ts apiFetch (Postern2), via packages/bsv/scripts/postern-door-fixture.ts",
      keyHex: KEY_HEX,
      publicKeyHex: publicKeyHexFromMasterKey(key),
      nonce: NONCE,
      authorization: cases[0].authorization,
      requests: cases[0].requests,
      cases,
    },
    null,
    2,
  ) + '\n',
);
