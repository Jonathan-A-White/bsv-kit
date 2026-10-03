// A fake Postern backend for the grist tests: the routes sendGrist and awaitAnswer use, behind a fetch.
import { Utils } from '@bsv/sdk';
import vectors from '../fixtures/postern-grist-vectors.json' with { type: 'json' };

export const MILL = vectors.keys.mill;
export const PHONE = vectors.keys.cairnPhone;
export const BASE = 'https://backend.example';
export const NONCE = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

export const fromHex = (h: string): Uint8Array => new Uint8Array(Buffer.from(h, 'hex'));
export const PHONE_KEY = fromHex(PHONE.privateKeyHex);

export interface Seen {
  method: string;
  path: string;
  body?: Uint8Array;
}

export interface FakeRecord {
  seq: number;
  txid: string;
  class: string;
  to: string;
  from: string;
  ct: string;
  signer?: string;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export interface FakeBackend {
  fetch: typeof fetch;
  seen: Seen[];
  /** What GET /api/messages answers, by the `since` it is asked for: records with seq > since. */
  records: FakeRecord[];
  /** Calls of GET /api/messages so far. */
  polls: () => number;
  /** Set to make POST /api/blobs / POST /api/messages answer this status. */
  failBlobs?: { status: number; error: string };
  /** What /api/me names as the mill; the vector's mill key by default. */
  mill?: string;
  failPost?: { status: number; error: string };
  /** Runs before each GET /api/messages answers (a test's seam: add a record, abort). */
  onPoll?: (n: number) => void;
}

export function fakeBackend(): FakeBackend {
  const seen: Seen[] = [];
  let polls = 0;
  let blobs = 0;
  const backend: FakeBackend = {
    seen,
    records: [],
    polls: () => polls,
    fetch: (async (input: string | URL, init?: RequestInit) => {
      const url = String(input).replace(BASE, '');
      const method = (init?.method ?? 'GET').toUpperCase();
      const path = url.replace(/^\/api/, '');
      const raw = init?.body;
      const body = raw === undefined || raw === null ? undefined : typeof raw === 'string' ? new TextEncoder().encode(raw) : new Uint8Array(raw as ArrayBuffer | Uint8Array);
      if (path === '/challenge') return json({ nonce: NONCE });
      seen.push({ method, path, ...(body ? { body } : {}) });
      if (path === '/me') return json({ pubkey: PHONE.publicKeyHex, mayor: '', mill: backend.mill ?? MILL.publicKeyHex, network: 'testnet', features: ['direct', 'me'] });
      if (path === '/blobs' && method === 'POST') {
        if (backend.failBlobs) return json({ error: backend.failBlobs.error }, backend.failBlobs.status);
        blobs += 1;
        return json({ hash: `${blobs}`.padStart(64, 'b'), size: body?.length ?? 0 }, 201);
      }
      if (path === '/messages' && method === 'POST') {
        if (backend.failPost) return json({ error: backend.failPost.error }, backend.failPost.status);
        return json({ txid: `direct:${'a'.repeat(64)}`, seq: 1 }, 201);
      }
      if (path.startsWith('/messages?since=')) {
        polls += 1;
        backend.onPoll?.(polls);
        const since = Number(path.split('=')[1]);
        const records = backend.records.filter((r) => r.seq > since).map((r) => ({
          seq: r.seq, txid: r.txid, vout: 0, height: 0, signer: r.signer,
          payload: { v: 1, kind: 'msg', class: r.class, to: r.to, from: r.from, ts: 1, ct: r.ct },
        }));
        return json({ records, next: Math.max(0, ...backend.records.map((r) => r.seq)) });
      }
      return json({ error: 'not found' }, 404);
    }) as typeof fetch,
  };
  return backend;
}

/** The bytes of a hex string as a number array, the way the SDK reads them. */
export const bytesOf = (hex: string): number[] => Utils.toArray(hex, 'hex');
