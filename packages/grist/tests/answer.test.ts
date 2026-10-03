import { describe, expect, it } from 'vitest';
import { door } from 'bsv-kit/bsv';
import { grist } from '../src/index.js';
import { BASE, MILL, PHONE, PHONE_KEY, fakeBackend, type FakeBackend, type FakeRecord } from './support/backend.js';
import fixture from './fixtures/postern-grist.json' with { type: 'json' };

const { awaitAnswer, decryptAnswer } = grist;
const TXID = fixture.answers.answered.plaintext.re;

const answerRecord = (status: 'answered' | 'refused' | 'failed', seq: number, over: Partial<FakeRecord> = {}): FakeRecord => ({
  seq,
  txid: `direct:${String(seq).padStart(64, '0')}`,
  class: 'grist',
  to: PHONE.publicKeyHex,
  from: MILL.publicKeyHex,
  ct: fixture.answers[status].envelope.ct,
  signer: MILL.publicKeyHex,
  ...over,
});

const setup = (): { backend: FakeBackend; d: InstanceType<typeof door.Door> } => {
  const backend = fakeBackend();
  return { backend, d: new door.Door({ baseUrl: BASE, key: PHONE_KEY, fetch: backend.fetch }) };
};
const opts = (d: InstanceType<typeof door.Door>, extra: object = {}) => ({ door: d, key: PHONE_KEY, mill: MILL.publicKeyHex, intervalMs: 1, ...extra });

describe('decryptAnswer', () => {
  it('reads each answer Postern sealed from the mill, with the app key', () => {
    for (const status of ['answered', 'refused', 'failed'] as const) {
      expect(decryptAnswer(fixture.answers[status].envelope.ct, PHONE_KEY)).toEqual(fixture.answers[status].plaintext);
    }
  });

  it('gives the answer record of section 19: re, status, answer, reason, grind', () => {
    const answered = decryptAnswer(fixture.answers.answered.envelope.ct, PHONE_KEY);
    expect(answered.re).toBe(TXID);
    expect(answered.status).toBe('answered');
    expect(answered.answer).toMatchObject({ responseType: 'sweep-result' });
    expect(answered.grind).toMatchObject({ app: 'cairn', kind: 'sweep', v: '1.1' });
    expect(decryptAnswer(fixture.answers.refused.envelope.ct, PHONE_KEY).reason).toMatch(/licence/);
  });

  it('says the sealer when asked: the BRC-78 header names who sealed it', () => {
    expect(grist.sealerOf(fixture.answers.answered.envelope.ct)).toBe(MILL.publicKeyHex);
  });

  it('throws on a record that is not an answer', () => {
    // sealed to the mill, not to the app: the app key cannot open it
    expect(() => decryptAnswer(fixture.grist.envelope.ct, PHONE_KEY)).toThrow();
  });
});

describe('awaitAnswer', () => {
  it('resolves on the record whose re is the txid', async () => {
    const { backend, d } = setup();
    backend.records = [answerRecord('answered', 3)];
    const answer = await awaitAnswer(TXID, opts(d));
    expect(answer).toEqual(fixture.answers.answered.plaintext);
  });

  it('resolves a refused or failed answer too, for the caller to read the status', async () => {
    for (const status of ['refused', 'failed'] as const) {
      const { backend, d } = setup();
      backend.records = [answerRecord(status, 1)];
      expect((await awaitAnswer(TXID, opts(d))).status).toBe(status);
    }
  });

  it('ignores records that are not the answer: another re, another class, another sender, a signer that is not the mill, one it cannot open', async () => {
    const { backend, d } = setup();
    backend.records = [
      answerRecord('answered', 1, { class: 'message' }),
      answerRecord('answered', 2, { from: PHONE.publicKeyHex }),
      answerRecord('answered', 3, { signer: PHONE.publicKeyHex }),
      answerRecord('answered', 4, { to: MILL.publicKeyHex }),
      answerRecord('answered', 5, { ct: fixture.grist.envelope.ct }),
      answerRecord('answered', 6, { ct: 'not base64 at all!' }),
    ];
    const answer = await awaitAnswer('direct:' + 'f'.repeat(64), opts(d, { signal: AbortSignal.timeout(60) })).catch((e: unknown) => e);
    // none of them answers that txid: it keeps waiting until the signal stops it
    expect((answer as Error).name).toBe('AbortError');
    expect(backend.polls()).toBeGreaterThan(1);
  });

  it('polls while pending, then resolves when the answer arrives', async () => {
    const { backend, d } = setup();
    backend.onPoll = (n) => {
      if (n === 3) backend.records = [answerRecord('answered', 7)];
    };
    const answer = await awaitAnswer(TXID, opts(d));
    expect(answer.status).toBe('answered');
    expect(backend.polls()).toBe(3);
  });

  it('pages from the cursor the backend gave, not from the start every time', async () => {
    const { backend, d } = setup();
    backend.records = [answerRecord('answered', 1, { class: 'message' })];
    backend.onPoll = (n) => {
      if (n === 2) backend.records = [...backend.records, answerRecord('answered', 2)];
    };
    await awaitAnswer(TXID, opts(d));
    const since = backend.seen.filter((s) => s.path.startsWith('/messages?since=')).map((s) => s.path);
    expect(since).toEqual(['/messages?since=0', '/messages?since=1']);
  });

  it('defaults to a 20 second poll', () => {
    expect(grist.POLL_INTERVAL_MS).toBe(20_000);
  });

  it('asks /api/me for the mill key when none is given', async () => {
    const { backend, d } = setup();
    backend.records = [answerRecord('answered', 1)];
    await awaitAnswer(TXID, { door: d, key: PHONE_KEY, intervalMs: 1 });
    expect(backend.seen.map((s) => s.path)).toContain('/me');
  });

  it('rejects cleanly when aborted between polls, and does not poll again', async () => {
    const { backend, d } = setup();
    const controller = new AbortController();
    backend.onPoll = (n) => {
      if (n === 2) setTimeout(() => controller.abort(), 0);
    };
    const err = await awaitAnswer(TXID, opts(d, { intervalMs: 50, signal: controller.signal })).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(grist.AwaitAbortedError);
    expect((err as Error).name).toBe('AbortError');
    const polls = backend.polls();
    await new Promise((r) => setTimeout(r, 120));
    expect(backend.polls()).toBe(polls);
  });

  it('rejects at once for a signal already aborted, polling nothing', async () => {
    const { backend, d } = setup();
    const err = await awaitAnswer(TXID, opts(d, { signal: AbortSignal.abort() })).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(grist.AwaitAbortedError);
    expect(backend.seen).toEqual([]);
  });

  it('rejects cleanly when aborted during a poll that never answers', async () => {
    const backend = fakeBackend();
    const hang = ((input: string | URL, init?: RequestInit) =>
      String(input).includes('/messages?since=')
        ? new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('fetch aborted'))))
        : backend.fetch(input, init)) as typeof fetch;
    const d = new door.Door({ baseUrl: BASE, key: PHONE_KEY, fetch: hang });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);
    const err = await awaitAnswer(TXID, opts(d, { signal: controller.signal })).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(grist.AwaitAbortedError);
  });

  it('lets a backend failure through, for the caller to decide', async () => {
    const { d } = setup();
    d.fetch = async () => new Response('{}', { status: 500 });
    await expect(awaitAnswer(TXID, opts(d))).rejects.toThrow(/500/);
  });
});
