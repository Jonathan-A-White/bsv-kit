// The door: the one place every signed /api call goes through. Lifted from Postern's
// src/services/apiAuth.ts (apiFetch), with the backend URL, the key and the fetch as inputs.
// With a key, each call fetches a fresh nonce from GET /api/challenge and signs the whole request with
// it (the v2 scheme: "postern-v2", the method, the request target as sent, the hex sha256 of the body
// and the nonce, joined by "\n"; @bsv/sdk PrivateKey.sign(message).toDER('hex'), matching the backend's
// VerifySignature: a single sha256 of the message's UTF-8 bytes), attaching
// "Authorization: Postern2 <pubkeyHex>:<nonceHex>:<sigHex>". So a header proves one request only.
// The v1 scheme ("Postern", the nonce alone) is refused by the backend since mw-xhtcup.10 and is gone.
// A nonce is single-use, so every authenticated call signs its own. "Licence required" is thrown
// only when the backend's 401 says no licence is held (its body's machine-readable "reason") or
// names no reason (an older backend). A nonce refusal is retried once with a fresh challenge; a
// failed challenge says the backend could not be reached.
import { Hash, PrivateKey, Utils } from '@bsv/sdk';
import { BackendUnreachableError, LICENCE_REQUIRED, RefusedError } from './errors.js';
import { fetchMe } from './me.js';
import type { Me } from './me.js';
import { API_TIMEOUT_MS, fetchWithin } from './timeout.js';

/** What the backend's GET /api/challenge issues: plain hex. */
export const NONCE_SHAPE = /^[0-9a-f]{32,128}$/;

export interface DoorOptions {
  /** The backend's address, without "/api" and without a trailing slash (one is ignored);
   * empty for a page served by the backend itself. */
  baseUrl: string;
  /** The raw 32-byte master key (what the vault unlocks). Omitted for an unauthenticated door. */
  key?: Uint8Array;
  /** Defaults to the global fetch. */
  fetch?: typeof fetch;
  /** How long any one request may go unanswered; defaults to API_TIMEOUT_MS. */
  timeoutMs?: number;
}

/** The bytes a request's body hashes as: a string's UTF-8 bytes, a buffer's (or view's) bytes as they are, none for no body.
 * Anything else is refused here, before anything is signed or sent, rather than signed over the wrong bytes. */
function bodyBytes(body: RequestInit['body']): Uint8Array {
  if (body === undefined || body === null) return new Uint8Array(0);
  if (typeof body === 'string') return new TextEncoder().encode(body);
  if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  // Not instanceof: a buffer made in another realm (a test's, a worker's) is still one.
  if (Object.prototype.toString.call(body) === '[object ArrayBuffer]') return new Uint8Array(body as ArrayBuffer);
  throw new Error('This request has a body of a kind that cannot be signed; nothing was sent.');
}

/** The request target as it goes on the request line: path and query as written, no scheme or host. */
function requestTarget(url: string): string {
  return url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i, '');
}

/** Bodies up to this size are hashed in script, in one go; larger ones (a photo) by crypto.subtle. */
const SYNC_HASH_LIMIT = 64 * 1024;

/** The lower-case hex SHA-256 of `bytes`. */
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (bytes.length <= SYNC_HASH_LIMIT) return Utils.toHex(Hash.sha256(Array.from(bytes)));
  // Re-wrapped: a buffer from another realm fails crypto.subtle's instance check.
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return Utils.toHex(Array.from(new Uint8Array(digest)));
}

/** The "reason" a backend 401 names, or undefined from an older backend. */
async function refusalReason(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.clone().json()) as { reason?: unknown };
    return typeof body.reason === 'string' ? body.reason : undefined;
  } catch {
    return undefined;
  }
}

/** What a 401 says. Only a backend that says no licence is held (or, being older,
 * names no reason) is a licence problem; any other refusal of a signed call is
 * about the proof, and says so. */
function refusalError(reason: string | undefined, signed: boolean): RefusedError {
  if (!signed || reason === undefined || reason === 'no_licence') return new RefusedError(LICENCE_REQUIRED, 401);
  if (reason === 'nonce') {
    return new RefusedError("The backend twice rejected this phone's one-time sign-in code. Nothing was lost; try again.", 401);
  }
  return new RefusedError("The backend did not accept this phone's proof of who it is. Try again.", 401);
}

export class Door {
  private readonly base: string;
  private readonly privateKey: PrivateKey | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: DoorOptions) {
    this.base = `${options.baseUrl.replace(/\/+$/, '')}/api`;
    this.privateKey = options.key ? PrivateKey.fromHex(Utils.toHex(Array.from(options.key))) : undefined;
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? API_TIMEOUT_MS;
  }

  private async signedAuthorizationHeader(privateKey: PrivateKey, request: { method: string; target: string; body: Uint8Array }): Promise<string> {
    const challengeResponse = await fetchWithin(this.fetchImpl, `${this.base}/challenge`, undefined, false, this.timeoutMs);
    if (!challengeResponse.ok) {
      throw new BackendUnreachableError(`The backend could not be reached for a sign-in code (it answered ${challengeResponse.status}). Try again in a moment.`);
    }
    const { nonce } = (await challengeResponse.json()) as { nonce: unknown };
    // The same key signs a hands step's approval. A backend that could get anything signed as a
    // "nonce" could get an approval signed without asking, so only a plain hex nonce, which is
    // what the backend issues, is ever signed, and only inside the postern-v2 message.
    if (typeof nonce !== 'string' || !NONCE_SHAPE.test(nonce)) throw new Error('The backend sent a challenge that is not a nonce; nothing was signed.');
    const message = `postern-v2\n${request.method}\n${request.target}\n${await sha256Hex(request.body)}\n${nonce}`;
    const signature = privateKey.sign(message).toDER('hex') as string;
    return `Postern2 ${privateKey.toPublicKey().toString()}:${nonce}:${signature}`;
  }

  /**
   * Fetches `${baseUrl}/api${path}`, attaching a header that signs this request (v2) when the door has a key. A 401
   * whose reason is a refused nonce is retried once with a fresh challenge (the backend refuses
   * before acting, so a POST is safe to send again); a 401 becomes "Licence required" only when no
   * licence is held. Throws ApiTimeoutError, BackendUnreachableError or RefusedError; any other
   * status is the caller's to read.
   */
  async fetch(path: string, init?: RequestInit): Promise<Response> {
    const method = (init?.method ?? 'GET').toUpperCase();
    const sent = method !== 'GET' && method !== 'HEAD';
    const privateKey = this.privateKey;
    const url = `${this.base}${path}`;
    const request = privateKey ? { method, target: requestTarget(url), body: bodyBytes(init?.body) } : undefined;

    const attempt = async (): Promise<Response> => {
      const headers = new Headers(init?.headers);
      if (privateKey && request) headers.set('Authorization', await this.signedAuthorizationHeader(privateKey, request));
      return fetchWithin(this.fetchImpl, url, { ...init, headers }, sent, this.timeoutMs);
    };

    let response = await attempt();
    if (response.status === 401) {
      let reason = await refusalReason(response);
      if (privateKey && reason === 'nonce') {
        response = await attempt();
        reason = response.status === 401 ? await refusalReason(response) : undefined;
      }
      if (response.status === 401) throw refusalError(reason, privateKey !== undefined);
    }
    return response;
  }

  /** Who is who: GET /api/me, parsed. LEGACY for a backend that predates it; NoLicenceError when no licence is held. */
  me(): Promise<Me> {
    return fetchMe(this);
  }
}
