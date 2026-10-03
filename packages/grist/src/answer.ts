// awaitAnswer: pages GET /api/messages?since= until the mill's answer to a grist arrives (docs/protocol.md
// section 19, "Waiting": every 20 seconds while any grist is unanswered). An answer counts only when it is a
// grist record from the mill to this key, signed (when the backend says who) by the mill, sealed by the mill, and
// whose re is the grist's txid. Lifted in spirit from millwright's gristsend.go (answerIn).
import { vault } from 'bsv-kit/bsv';
import type { door } from 'bsv-kit/bsv';
import { AwaitAbortedError } from './errors.js';
import { fetchMill } from './mill.js';
import { openCt, sealerOf } from './seal.js';
import type { Envelope, GristAnswer } from './types.js';

type Door = InstanceType<typeof door.Door>;

/** How often an unanswered grist is paged for (section 19). */
export const POLL_INTERVAL_MS = 20_000;

export interface AwaitAnswerOptions {
  /** The door the calls go through (its key is the app's). */
  door: Door;
  /** The app's raw 32-byte key: what opens the answer. */
  key: Uint8Array;
  /** Milliseconds between pages while the answer is pending; defaults to POLL_INTERVAL_MS. */
  intervalMs?: number;
  /** Stops the wait: the promise rejects with an AwaitAbortedError. */
  signal?: AbortSignal;
  /** The pinned mill key; asked of GET /api/me when absent. */
  mill?: string;
}

interface RecordRow {
  seq?: number;
  signer?: string;
  payload?: Partial<Envelope>;
}

/** Opens the mill's answer record in `ct` with the app's key. Throws if the key is not the one it was sealed to,
 * or the plaintext is not an answer (no `re` and `status`). */
export function decryptAnswer<A = unknown>(ct: string, key: Uint8Array): GristAnswer<A> {
  const answer = JSON.parse(openCt(ct, key)) as Partial<GristAnswer<A>>;
  if (typeof answer.re !== 'string' || typeof answer.status !== 'string') throw new Error('This is not a grist answer.');
  return answer as GristAnswer<A>;
}

function answerIn<A>(row: RecordRow, key: Uint8Array, mine: string, mill: string, txid: string): GristAnswer<A> | undefined {
  const p = row.payload;
  if (!p || p.class !== 'grist' || p.from !== mill || p.to !== mine || typeof p.ct !== 'string') return undefined;
  if (row.signer && row.signer !== mill) return undefined;
  try {
    if (sealerOf(p.ct) !== mill) return undefined;
    const answer = decryptAnswer<A>(p.ct, key);
    return answer.re === txid ? answer : undefined;
  } catch {
    return undefined;
  }
}

/** One page of GET /api/messages. The door adds a listener to the signal it is given and never removes it, so each
 * page gets a signal of its own, linked to the caller's: a wait of hours does not pile listeners on the caller's. */
async function page(d: Door, since: number, signal: AbortSignal | undefined): Promise<{ records?: RecordRow[]; next?: number }> {
  const own = new AbortController();
  const stop = (): void => own.abort();
  signal?.addEventListener('abort', stop, { once: true });
  try {
    const response = await d.fetch(`/messages?since=${since}`, { signal: own.signal });
    if (!response.ok) throw new Error(`The backend answered ${response.status} to /api/messages.`);
    return (await response.json()) as { records?: RecordRow[]; next?: number };
  } catch (err) {
    if (signal?.aborted) throw new AwaitAbortedError();
    throw err;
  } finally {
    signal?.removeEventListener('abort', stop);
  }
}

/** Waits `ms`, or rejects when `signal` aborts. */
function pause(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AwaitAbortedError());
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new AwaitAbortedError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Resolves with the mill's answer to the grist `txid` (`direct:…`): its record whose `re` is that id. A `refused` or
 * `failed` answer resolves too, for the caller to read `status` and `reason`. Rejects with an AwaitAbortedError
 * when the signal aborts, and with the door's error if the backend fails.
 */
export async function awaitAnswer<A = unknown>(txid: string, options: AwaitAnswerOptions): Promise<GristAnswer<A>> {
  const { door: d, key, signal } = options;
  const intervalMs = options.intervalMs ?? POLL_INTERVAL_MS;
  if (signal?.aborted) throw new AwaitAbortedError();
  const mill = options.mill ?? (await fetchMill(d));
  const mine = vault.publicKeyHexFromKey(key);
  let since = 0;
  for (;;) {
    const body = await page(d, since, signal);
    for (const row of body.records ?? []) {
      const answer = answerIn<A>(row, key, mine, mill, txid);
      if (answer) return answer;
      since = Math.max(since, row.seq ?? 0);
    }
    since = Math.max(since, body.next ?? 0);
    await pause(intervalMs, signal);
  }
}
