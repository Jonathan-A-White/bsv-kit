// The door: the one place every signed /api call goes through. Lifted from Postern's
// src/services/apiAuth.ts (apiFetch), with the backend URL, the key and the fetch as inputs.
// With a key, each call fetches a fresh nonce from GET /api/challenge and signs it
// (@bsv/sdk PrivateKey.sign(nonce).toDER('hex'), matching the backend's VerifySignature: a single
// sha256 of the nonce string's UTF-8 bytes), attaching "Authorization: Postern <pubkeyHex>:<nonceHex>:<sigHex>".
// A nonce is single-use, so every authenticated call signs its own. "Licence required" is thrown
// only when the backend's 401 says no licence is held (its body's machine-readable "reason") or
// names no reason (an older backend). A nonce refusal is retried once with a fresh challenge; a
// failed challenge says the backend could not be reached.
import { PrivateKey, Utils } from '@bsv/sdk';
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

  private async signedAuthorizationHeader(privateKey: PrivateKey): Promise<string> {
    const challengeResponse = await fetchWithin(this.fetchImpl, `${this.base}/challenge`, undefined, false, this.timeoutMs);
    if (!challengeResponse.ok) {
      throw new BackendUnreachableError(`The backend could not be reached for a sign-in code (it answered ${challengeResponse.status}). Try again in a moment.`);
    }
    const { nonce } = (await challengeResponse.json()) as { nonce: unknown };
    // The same key signs a hands step's approval. A backend that could get anything signed as a
    // "nonce" could get an approval signed without asking, so only a plain hex nonce, which is
    // what the backend issues, is ever signed.
    if (typeof nonce !== 'string' || !NONCE_SHAPE.test(nonce)) throw new Error('The backend sent a challenge that is not a nonce; nothing was signed.');
    const signature = privateKey.sign(nonce).toDER('hex') as string;
    return `Postern ${privateKey.toPublicKey().toString()}:${nonce}:${signature}`;
  }

  /**
   * Fetches `${baseUrl}/api${path}`, attaching a signed proof header when the door has a key. A 401
   * whose reason is a refused nonce is retried once with a fresh challenge (the backend refuses
   * before acting, so a POST is safe to send again); a 401 becomes "Licence required" only when no
   * licence is held. Throws ApiTimeoutError, BackendUnreachableError or RefusedError; any other
   * status is the caller's to read.
   */
  async fetch(path: string, init?: RequestInit): Promise<Response> {
    const method = (init?.method ?? 'GET').toUpperCase();
    const sent = method !== 'GET' && method !== 'HEAD';
    const privateKey = this.privateKey;

    const attempt = async (): Promise<Response> => {
      const headers = new Headers(init?.headers);
      if (privateKey) headers.set('Authorization', await this.signedAuthorizationHeader(privateKey));
      return fetchWithin(this.fetchImpl, `${this.base}${path}`, { ...init, headers }, sent, this.timeoutMs);
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
