import { PrivateKey, PublicKey, Signature } from '@bsv/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { door } from '../src/index.js';
import fixture from './fixtures/postern-door.json' with { type: 'json' };

const { Door, ApiTimeoutError, BackendUnreachableError, RefusedError, NoLicenceError, LEGACY, API_TIMEOUT_MS, NONCE_SHAPE, isPermanentRefusal } = door;

const fromHex = (h: string): Uint8Array => new Uint8Array(Buffer.from(h, 'hex'));
const KEY = fromHex(fixture.keyHex);
const BASE = 'https://backend.example';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const challenge = (nonce = fixture.nonce): Response => json({ nonce });
const refusal = (reason?: string): Response => json({ error: 'refused', ...(reason ? { reason } : {}) }, 401);
const isChallenge = (url: string | URL): boolean => String(url).endsWith('/api/challenge');
const hangs = (): Promise<Response> => new Promise<Response>(() => {});

type Fetch = typeof fetch;
const asFetch = (f: unknown): Fetch => f as Fetch;
const callsOf = (f: { mock: { calls: unknown[][] } }): [string | URL, RequestInit | undefined][] => f.mock.calls as [string | URL, RequestInit | undefined][];

describe('Door.fetch: the signed header', () => {
  it('is, byte for byte, the header Postern makes for the same key and nonce', async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => (isChallenge(url) ? challenge() : json({})));
    const d = new Door({ baseUrl: BASE, key: KEY, fetch: asFetch(fetchImpl) });
    await d.fetch('/messages?since=0');
    const sent = callsOf(fetchImpl).map(([url, init]) => ({
      url: String(url),
      method: init?.method ?? 'GET',
      authorization: new Headers(init?.headers).get('Authorization'),
    }));
    // The fixture's urls are Postern's, whose api base is "/api"; here the base is the backend's.
    expect(sent.map((r) => ({ ...r, url: r.url.replace(BASE, '') }))).toEqual(fixture.requests);
    expect(sent[1].authorization).toBe(fixture.authorization);
  });

  it('carries a signature the backend can verify', async () => {
    const key = PrivateKey.fromRandom();
    const seen: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (isChallenge(url)) return challenge();
      seen.push(new Headers(init?.headers).get('Authorization') ?? '');
      return json({});
    });
    await new Door({ baseUrl: BASE, key: new Uint8Array(Buffer.from(key.toHex(), 'hex')), fetch: asFetch(fetchImpl) }).fetch('/x');
    const [, pub, nonce, sig] = seen[0].match(/^Postern ([0-9a-f]+):([0-9a-f]+):([0-9a-f]+)$/)!;
    expect(pub).toBe(key.toPublicKey().toString());
    expect(PublicKey.fromString(pub).verify(nonce, Signature.fromDER(sig, 'hex'))).toBe(true);
  });

  it('signs a fresh nonce for every call, and keeps the caller\'s own headers and method', async () => {
    let challenges = 0;
    const calls: RequestInit[] = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (isChallenge(url)) return challenge(String(++challenges).repeat(64));
      calls.push(init ?? {});
      return json({});
    });
    const d = new Door({ baseUrl: BASE, key: KEY, fetch: asFetch(fetchImpl) });
    await d.fetch('/a', { method: 'POST', body: 'x', headers: { 'X-Mine': '1' } });
    await d.fetch('/b');
    expect(challenges).toBe(2);
    const h = new Headers(calls[0].headers);
    expect(h.get('X-Mine')).toBe('1');
    expect(calls[0].method).toBe('POST');
    expect(calls[0].body).toBe('x');
    expect(new Headers(calls[0].headers).get('Authorization')).not.toBe(new Headers(calls[1].headers).get('Authorization'));
  });

  it('with no key, sends no challenge request and no Authorization header', async () => {
    const urls: string[] = [];
    let auth = true;
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      urls.push(String(url));
      auth = new Headers(init?.headers).has('Authorization');
      return json({});
    });
    await new Door({ baseUrl: BASE, fetch: asFetch(fetchImpl) }).fetch('/view');
    expect(urls).toEqual([`${BASE}/api/view`]);
    expect(auth).toBe(false);
  });

  it('takes an empty base url for same-origin calls', async () => {
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL) => {
      urls.push(String(url));
      return isChallenge(url) ? challenge() : json({});
    });
    await new Door({ baseUrl: '', key: KEY, fetch: asFetch(fetchImpl) }).fetch('/me');
    expect(urls).toEqual(['/api/challenge', '/api/me']);
  });

  it('ignores a trailing slash on the base url', async () => {
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL) => {
      urls.push(String(url));
      return json({});
    });
    await new Door({ baseUrl: `${BASE}/`, fetch: asFetch(fetchImpl) }).fetch('/view');
    expect(urls).toEqual([`${BASE}/api/view`]);
  });

  it('refuses to sign anything but a plain hex nonce, and sends nothing else', async () => {
    const forged = `hands-approve/v1\n${'2d'.repeat(32)}\n1790000000\n`;
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL) => {
      urls.push(String(url));
      return json({ nonce: forged });
    });
    await expect(new Door({ baseUrl: BASE, key: KEY, fetch: asFetch(fetchImpl) }).fetch('/messages')).rejects.toThrow('not a nonce');
    expect(urls).toEqual([`${BASE}/api/challenge`]);
    expect(NONCE_SHAPE.test(fixture.nonce)).toBe(true);
  });
});

describe('Door.fetch: refusals', () => {
  it('retries a nonce refusal once with a fresh challenge and returns the second answer', async () => {
    let challenges = 0;
    const auths: (string | null)[] = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (isChallenge(url)) return challenge(String(++challenges).repeat(64));
      auths.push(new Headers(init?.headers).get('Authorization'));
      return auths.length === 1 ? refusal('nonce') : json({ ok: true });
    });
    const response = await new Door({ baseUrl: BASE, key: KEY, fetch: asFetch(fetchImpl) }).fetch('/blobs', { method: 'POST', body: 'x' });
    expect(response.status).toBe(200);
    expect(challenges).toBe(2);
    expect(auths).toHaveLength(2);
    expect(auths[0]).not.toBe(auths[1]);
  });

  it('a second nonce refusal surfaces as a RefusedError (401) without the word Licence', async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => (isChallenge(url) ? challenge() : refusal('nonce')));
    const err = await new Door({ baseUrl: BASE, key: KEY, fetch: asFetch(fetchImpl) }).fetch('/messages', { method: 'POST' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RefusedError);
    expect((err as InstanceType<typeof RefusedError>).status).toBe(401);
    expect((err as Error).message).not.toContain('Licence');
    expect(fetchImpl.mock.calls.filter(([u]) => !isChallenge(u))).toHaveLength(2);
    expect(isPermanentRefusal(err)).toBe(true);
  });

  it('says "Licence required" for no_licence, for an old backend naming no reason, and with no key; no retry', async () => {
    for (const reason of ['no_licence', undefined]) {
      const fetchImpl = vi.fn(async (url: string | URL) => (isChallenge(url) ? challenge() : refusal(reason)));
      const err = await new Door({ baseUrl: BASE, key: KEY, fetch: asFetch(fetchImpl) }).fetch('/me').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(RefusedError);
      expect((err as Error).message).toBe('Licence required');
      expect(fetchImpl.mock.calls.filter(([u]) => isChallenge(u))).toHaveLength(1);
    }
    const keyless = vi.fn(async () => refusal('nonce'));
    await expect(new Door({ baseUrl: BASE, fetch: asFetch(keyless) }).fetch('/me')).rejects.toThrow('Licence required');
    expect(keyless).toHaveBeenCalledTimes(1);
  });

  it('says a rejected proof was rejected, not that a licence is needed', async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => (isChallenge(url) ? challenge() : refusal('signature')));
    const err = await new Door({ baseUrl: BASE, key: KEY, fetch: asFetch(fetchImpl) }).fetch('/me').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RefusedError);
    expect((err as Error).message).not.toContain('Licence');
  });

  it('returns a non-401 answer unchanged', async () => {
    const response = await new Door({ baseUrl: BASE, fetch: asFetch(async () => new Response('', { status: 502 })) }).fetch('/view');
    expect(response.status).toBe(502);
  });

  it('classifies permanent refusals: 4xx except 408 and 429', () => {
    expect(isPermanentRefusal(new RefusedError('x', 403))).toBe(true);
    expect(isPermanentRefusal(new RefusedError('x', 408))).toBe(false);
    expect(isPermanentRefusal(new RefusedError('x', 429))).toBe(false);
    expect(isPermanentRefusal(new RefusedError('x', 500))).toBe(false);
    expect(isPermanentRefusal(new Error('x'))).toBe(false);
  });
});

describe('Door.fetch: an unreachable backend', () => {
  it('a challenge the backend answers badly is a BackendUnreachableError naming the status', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 503 }));
    const err = await new Door({ baseUrl: BASE, key: KEY, fetch: asFetch(fetchImpl) }).fetch('/me').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BackendUnreachableError);
    expect((err as Error).message).toContain('503');
    expect((err as Error).message).not.toContain('Licence');
  });

  it('a connection that fails is a BackendUnreachableError too, with the cause kept', async () => {
    const cause = new TypeError('fetch failed');
    const fetchImpl = vi.fn(async () => {
      throw cause;
    });
    const err = await new Door({ baseUrl: BASE, key: KEY, fetch: asFetch(fetchImpl) }).fetch('/me').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BackendUnreachableError);
    expect((err as Error).cause).toBe(cause);
  });
});

describe('Door.fetch: timeouts', () => {
  afterEach(() => vi.useRealTimers());

  async function failureOf(work: Promise<unknown>, ms: number): Promise<unknown> {
    const caught = work.then(
      () => undefined,
      (err: unknown) => err,
    );
    await vi.advanceTimersByTimeAsync(ms);
    return caught;
  }
  const hangsUntilAborted = (_url: string | URL, init?: RequestInit): Promise<Response> =>
    new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    });

  it('defaults to thirty seconds', () => {
    expect(API_TIMEOUT_MS).toBe(30_000);
  });

  it('a challenge that never answers is an ApiTimeoutError, before anything was sent', async () => {
    vi.useFakeTimers();
    const d = new Door({ baseUrl: BASE, key: KEY, fetch: asFetch(hangs) });
    const err = await failureOf(d.fetch('/messages', { method: 'POST' }), API_TIMEOUT_MS);
    expect(err).toBeInstanceOf(ApiTimeoutError);
    expect((err as InstanceType<typeof ApiTimeoutError>).sent).toBe(false);
  });

  it('a POST that never answers is an ApiTimeoutError after it was sent; a GET has sent nothing', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async (url: string | URL) => (isChallenge(url) ? challenge() : hangs()));
    const d = new Door({ baseUrl: BASE, key: KEY, fetch: asFetch(fetchImpl) });
    const post = await failureOf(d.fetch('/messages', { method: 'POST' }), API_TIMEOUT_MS);
    expect((post as InstanceType<typeof ApiTimeoutError>).sent).toBe(true);
    const get = await failureOf(d.fetch('/view'), API_TIMEOUT_MS);
    expect((get as InstanceType<typeof ApiTimeoutError>).sent).toBe(false);
  });

  it('times out after the configured period, not before', async () => {
    vi.useFakeTimers();
    const d = new Door({ baseUrl: BASE, fetch: asFetch(hangs), timeoutMs: 1_000 });
    let outcome: unknown;
    void d.fetch('/view').catch((e: unknown) => (outcome = e));
    await vi.advanceTimersByTimeAsync(999);
    expect(outcome).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome).toBeInstanceOf(ApiTimeoutError);
  });

  it('aborts the fetch it gave up on, and a browser-style AbortError does not win the race', async () => {
    vi.useFakeTimers();
    let seen: AbortSignal | undefined;
    const fetchImpl = vi.fn((url: string | URL, init?: RequestInit) => {
      seen = init?.signal ?? undefined;
      return hangsUntilAborted(url, init);
    });
    const err = await failureOf(new Door({ baseUrl: BASE, fetch: asFetch(fetchImpl) }).fetch('/view'), API_TIMEOUT_MS);
    expect(err).toBeInstanceOf(ApiTimeoutError);
    expect(seen?.aborted).toBe(true);
  });

  it("a caller's own abort still rejects with the abort, not a timeout", async () => {
    vi.useFakeTimers();
    const caller = new AbortController();
    const d = new Door({ baseUrl: BASE, fetch: asFetch(hangsUntilAborted) });
    const caught = d.fetch('/events', { signal: caller.signal }).then(
      () => undefined,
      (e: unknown) => e,
    );
    await vi.advanceTimersByTimeAsync(0);
    caller.abort();
    const err = await caught;
    expect(err).not.toBeInstanceOf(ApiTimeoutError);
    expect(err).not.toBeInstanceOf(BackendUnreachableError);
    expect((err as Error).name).toBe('AbortError');
  });
});

describe('Door.me', () => {
  const me = { pubkey: 'p', mayor: 'm', network: 'mainnet', features: ['direct', 'me'], collections: [{ name: 'c', app: 'a' }, { name: 'd' }] };
  const meFetch = (answer: () => Response) => vi.fn(async (url: string | URL) => (isChallenge(url) ? challenge() : answer()));

  it('returns the parsed body of a signed GET /api/me', async () => {
    const fetchImpl = meFetch(() => json(me));
    const got = await new Door({ baseUrl: BASE, key: KEY, fetch: asFetch(fetchImpl) }).me();
    expect(got).toEqual(me);
    const [url, init] = callsOf(fetchImpl)[1];
    expect(String(url)).toBe(`${BASE}/api/me`);
    expect(new Headers(init?.headers).get('Authorization')).toBe(fixture.authorization);
  });

  it('fills the gaps Postern fills, and drops what is not a string or a collection', async () => {
    const got = await new Door({ baseUrl: BASE, key: KEY, fetch: asFetch(meFetch(() => json({ features: ['me', 3], collections: [1, { name: '' }, { name: 'x', app: 5 }] }))) }).me();
    expect(got).toEqual({ pubkey: '', mayor: '', network: 'testnet', features: ['me'], collections: [{ name: 'x' }] });
  });

  it('is LEGACY for a backend that predates /api/me (404 or 405)', async () => {
    for (const status of [404, 405]) {
      expect(await new Door({ baseUrl: BASE, key: KEY, fetch: asFetch(meFetch(() => new Response('', { status }))) }).me()).toEqual(LEGACY);
    }
  });

  it('throws NoLicenceError for a 401 that says no licence is held', async () => {
    const d = new Door({ baseUrl: BASE, key: KEY, fetch: asFetch(meFetch(() => refusal('no_licence'))) });
    await expect(d.me()).rejects.toBeInstanceOf(NoLicenceError);
  });

  it('throws for any other failing status, naming it', async () => {
    const d = new Door({ baseUrl: BASE, key: KEY, fetch: asFetch(meFetch(() => new Response('', { status: 500 }))) });
    await expect(d.me()).rejects.toThrow('500');
  });
});
