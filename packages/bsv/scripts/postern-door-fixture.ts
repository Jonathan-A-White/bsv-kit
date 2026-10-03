// One-off: records the Authorization header POSTERN's own apiFetch (src/services/apiAuth.ts) sends
// for a fixed key and a fixed nonce, plus the requests it makes, as packages/bsv/tests/fixtures/postern-door.json.
// Not part of the build or the tests (neither tsconfig includes scripts/). Run it with Postern's tsx:
//
//   (cd /home/jwhite/postern && npx tsx <bsv-kit>/packages/bsv/scripts/postern-door-fixture.ts) \
//     > packages/bsv/tests/fixtures/postern-door.json
import { apiFetch } from '/home/jwhite/postern/src/services/apiAuth.ts';
import { publicKeyHexFromMasterKey } from '/home/jwhite/postern/src/services/vault.ts';

const KEY_HEX = '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20';
const NONCE = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
const key = new Uint8Array(Buffer.from(KEY_HEX, 'hex'));

const requests: { url: string; method: string; authorization: string | null }[] = [];
const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  requests.push({ url, method: init?.method ?? 'GET', authorization: new Headers(init?.headers).get('Authorization') });
  return url.endsWith('/challenge')
    ? new Response(JSON.stringify({ nonce: NONCE }), { status: 200 })
    : new Response('{}', { status: 200 });
}) as typeof fetch;

await apiFetch('/messages?since=0', undefined, { unlockedKey: key, apiBase: '/api', fetchImpl });
const authorization = requests.find((r) => r.authorization)?.authorization;
process.stdout.write(
  JSON.stringify({ keyHex: KEY_HEX, publicKeyHex: publicKeyHexFromMasterKey(key), nonce: NONCE, authorization, requests }, null, 2) + '\n',
);
