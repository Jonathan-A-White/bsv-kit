// TEST-ONLY: a fake Postern backend for an app's tests, imported as 'bsv-kit/testing'. It is the routes sendGrist,
// sendGristRecord, readAnswerPage and awaitAnswer use, behind a `fetch` to give to bsv's door; nothing here touches
// a network. Do not import it from app code that ships. Grown from the fake the grist tests use, so an app need not
// write its own (and fix it when the protocol moves).
import { PrivateKey, Utils } from '@bsv/sdk';
import { sealEnvelope } from './seal.js';
import type { GristAnswer } from './types.js';

/** Published test keys, made up for fakes: never a real key. The defaults of `fakePostern`. */
export const MILL_KEY = Uint8Array.from(Utils.toArray('00'.repeat(31) + '0a', 'hex'));
export const APP_KEY = Uint8Array.from(Utils.toArray('00'.repeat(31) + '0b', 'hex'));
/** What the fake's door challenge answers (GET /api/challenge). */
export const NONCE = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

const publicKeyOf = (key: Uint8Array): string => PrivateKey.fromHex(Utils.toHex(Array.from(key))).toPublicKey().toString();

/** One request the fake saw (the challenge excepted): `path` is after `/api`, query included. */
export interface Seen {
  method: string;
  path: string;
  body?: Uint8Array;
}

/** A record the fake's GET /api/messages lists; `signer` is who the backend says signed it in. */
export interface FakeRecord {
  seq: number;
  txid: string;
  class: string;
  to: string;
  from: string;
  ct: string;
  signer?: string;
}

export interface FakePosternOptions {
  /** The origin the app's door is given as `baseUrl`; defaults to 'https://backend.example'. */
  base?: string;
  /** The mill's raw key, which `reply` seals answers with; defaults to MILL_KEY. */
  millKey?: Uint8Array;
  /** The app's raw key, whose public key answers are sealed to and GET /api/me names; defaults to APP_KEY. */
  appKey?: Uint8Array;
  /** The mill's public key GET /api/me names, when it is not the public key of `millKey` (a recorded answer's). */
  mill?: string;
  /** The app's public key when it is not the public key of `appKey`. */
  pubkey?: string;
}

export interface FakePostern {
  /** Give it to the door: `new door.Door({ baseUrl: fake.base, key, fetch: fake.fetch })`. */
  fetch: typeof fetch;
  base: string;
  appKey: Uint8Array;
  /** The mill's public key as GET /api/me names it. Set `mill = ''` to make the backend name none. */
  mill: string;
  /** Every request so far, in order. */
  seen: Seen[];
  /** What GET /api/messages lists, by the `since` it is asked for: the records with seq > since. */
  records: FakeRecord[];
  /** Calls of GET /api/messages so far. */
  polls: () => number;
  /** Make POST /api/blobs answer this status and error. */
  failBlobs?: { status: number; error: string };
  /** Make POST /api/messages answer this status and error (503 reads as unreachable). */
  failPost?: { status: number; error: string };
  /** What POST /api/messages answers on success; `{txid: 'direct:aaaa…', seq: 1}` by default. Leave `seq` out to
   * answer without one. */
  postResult?: { txid: string; seq?: number };
  /** Runs before each GET /api/messages answers, with the number of the call (a test's seam: add a record, abort). */
  onPoll?: (n: number) => void;
  /** Adds the mill's answer record, sealed by `millKey` to the app, with the next seq; returns the record. */
  reply: (answer: GristAnswer) => FakeRecord;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** A fresh fake Postern. */
export function fakePostern(options: FakePosternOptions = {}): FakePostern {
  const base = options.base ?? 'https://backend.example';
  const millKey = options.millKey ?? MILL_KEY;
  const appKey = options.appKey ?? APP_KEY;
  const pubkey = options.pubkey ?? publicKeyOf(appKey);
  const seen: Seen[] = [];
  let polls = 0;
  let blobs = 0;
  const fake: FakePostern = {
    base,
    appKey,
    mill: options.mill ?? publicKeyOf(millKey),
    seen,
    records: [],
    polls: () => polls,
    reply: (answer) => {
      const seq = Math.max(0, ...fake.records.map((r) => r.seq)) + 1;
      const envelope = sealEnvelope(JSON.stringify(answer), millKey, pubkey, 1);
      const record: FakeRecord = { seq, txid: `direct:${String(seq).padStart(64, '0')}`, class: 'grist', to: pubkey, from: publicKeyOf(millKey), ct: envelope.ct, signer: publicKeyOf(millKey) };
      fake.records.push(record);
      return record;
    },
    fetch: (async (input: string | URL, init?: RequestInit) => {
      const path = String(input).replace(base, '').replace(/^\/api/, '');
      const method = (init?.method ?? 'GET').toUpperCase();
      const raw = init?.body;
      const body = raw === undefined || raw === null ? undefined : typeof raw === 'string' ? new TextEncoder().encode(raw) : new Uint8Array(raw as ArrayBuffer | Uint8Array);
      if (path === '/challenge') return json({ nonce: NONCE });
      seen.push({ method, path, ...(body ? { body } : {}) });
      if (path === '/me') return json({ pubkey, mayor: '', mill: fake.mill, network: 'testnet', features: ['direct', 'me'] });
      if (path === '/blobs' && method === 'POST') {
        if (fake.failBlobs) return json({ error: fake.failBlobs.error }, fake.failBlobs.status);
        blobs += 1;
        return json({ hash: `${blobs}`.padStart(64, 'b'), size: body?.length ?? 0 }, 201);
      }
      if (path === '/messages' && method === 'POST') {
        if (fake.failPost) return json({ error: fake.failPost.error }, fake.failPost.status);
        return json(fake.postResult ?? { txid: `direct:${'a'.repeat(64)}`, seq: 1 }, 201);
      }
      if (path.startsWith('/messages?since=')) {
        polls += 1;
        fake.onPoll?.(polls);
        const since = Number(path.split('=')[1]);
        const records = fake.records.filter((r) => r.seq > since).map((r) => ({
          seq: r.seq, txid: r.txid, vout: 0, height: 0, signer: r.signer,
          payload: { v: 1, kind: 'msg', class: r.class, to: r.to, from: r.from, ts: 1, ct: r.ct },
        }));
        return json({ records, next: Math.max(0, ...fake.records.map((r) => r.seq)) });
      }
      return json({ error: 'not found' }, 404);
    }) as typeof fetch,
  };
  return fake;
}
