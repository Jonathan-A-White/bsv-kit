// The fake Postern a consumer's tests use: imported by the name a consumer resolves, 'bsv-kit/testing'.
import { describe, expect, it } from 'vitest';
import { door } from 'bsv-kit/bsv';
import { fakePostern } from 'bsv-kit/testing';
import { grist } from '../src/index.js';
import * as testing from 'bsv-kit/testing';

describe('bsv-kit/testing', () => {
  it('is the fake Postern: a fetch, the calls it saw and the records it holds', async () => {
    const fake = fakePostern();
    expect(testing.MILL_KEY).toBeInstanceOf(Uint8Array);
    const d = new door.Door({ baseUrl: fake.base, key: fake.appKey, fetch: fake.fetch });
    const sent = await grist.sendGristRecord({ door: d, key: fake.appKey, app: 'cairn', kind: 'sweep', v: '1.1', input: { a: 1 }, attachments: [{ bytes: Uint8Array.of(1, 2, 3), mime: 'audio/webm', name: 'clip.webm' }] });
    expect(sent.mill).toBe(fake.mill);
    expect(fake.seen.map((s) => `${s.method} ${s.path}`)).toEqual(['GET /me', 'POST /blobs', 'POST /messages']);
  });

  it('answers as the mill when told to, and readAnswerPage finds the answer', async () => {
    const fake = fakePostern();
    const d = new door.Door({ baseUrl: fake.base, key: fake.appKey, fetch: fake.fetch });
    const { txid, mill } = await grist.sendGristRecord({ door: d, key: fake.appKey, app: 'cairn', kind: 'sweep', v: '1.1', input: {}, photos: [] });
    const before = await grist.readAnswerPage(txid, { door: d, key: fake.appKey, mill, since: 0 });
    expect(before.answer).toBeNull();
    fake.reply({ re: txid, status: 'answered', answer: { ok: true }, grind: { app: 'cairn', kind: 'sweep', v: '1.1' } });
    const after = await grist.readAnswerPage(txid, { door: d, key: fake.appKey, mill, since: before.next });
    expect(after.answer).toMatchObject({ re: txid, status: 'answered', answer: { ok: true } });
    expect(after.next).toBe(1);
  });

  it('can be made to fail: blobs, post, unreachable', async () => {
    const fake = fakePostern();
    fake.failPost = { status: 503, error: 'Standby.' };
    const d = new door.Door({ baseUrl: fake.base, key: fake.appKey, fetch: fake.fetch });
    await expect(grist.sendGrist({ door: d, key: fake.appKey, app: 'cairn', kind: 'sweep', v: '1.1', input: {}, photos: [] })).rejects.toBeInstanceOf(door.BackendUnreachableError);
  });
});
