import { EncryptedMessage, PrivateKey, Utils } from '@bsv/sdk';
import { describe, expect, it } from 'vitest';
import { door } from 'bsv-kit/bsv';
import { grist } from '../src/index.js';
import { BASE, MILL, PHONE, PHONE_KEY, bytesOf, fakeBackend, fromHex } from './support/backend.js';
import fixture from './fixtures/postern-grist.json' with { type: 'json' };

const { sendGrist } = grist;
const INPUT = { schemaVersion: '1.1', requestType: 'sweep', place: { name: 'Top drawer', path: 'Kitchen -> Top drawer' } };
const photo = (n: number, mime = 'image/jpeg') => ({ bytes: Uint8Array.from({ length: 10 + n }, (_, i) => (i * 7 + n) & 0xff), mime });

function setup() {
  const backend = fakeBackend();
  const d = new door.Door({ baseUrl: BASE, key: PHONE_KEY, fetch: backend.fetch });
  return { backend, d };
}

/** The record the app posted: its envelope and the script's payload, read back. */
function postedEnvelope(seen: { method: string; path: string; body?: Uint8Array }[]) {
  const post = seen.find((s) => s.method === 'POST' && s.path === '/messages')!;
  const { scriptHex } = JSON.parse(Buffer.from(post.body!).toString('utf-8')) as { scriptHex: string };
  return { scriptHex, ...grist.readRecordScript(scriptHex) };
}

const decryptAsMill = (ct: string): unknown =>
  JSON.parse(Utils.toUTF8(EncryptedMessage.decrypt(Utils.toArray(ct, 'base64'), PrivateKey.fromHex(MILL.privateKeyHex))));

describe('sendGrist: the envelope', () => {
  it('posts a grist record to the mill whose ct decrypts, with the mill key, to the plaintext of section 19', async () => {
    const { backend, d } = setup();
    const txid = await sendGrist({ door: d, key: PHONE_KEY, app: 'cairn', kind: 'sweep', v: '1.1', input: INPUT, photos: [photo(1)], ts: fixture.ts });
    expect(txid).toBe(`direct:${'a'.repeat(64)}`);
    const { envelope } = postedEnvelope(backend.seen);
    expect(Object.keys(envelope)).toEqual(['v', 'kind', 'class', 'to', 'from', 'ts', 'ct']);
    expect(envelope).toMatchObject({ v: 1, kind: 'msg', class: 'grist', to: MILL.publicKeyHex, from: PHONE.publicKeyHex, ts: fixture.ts });
    const plain = decryptAsMill(envelope.ct as string) as Record<string, unknown>;
    expect(Object.keys(plain)).toEqual(['grist', 'input', 'attachments']);
    expect(plain.grist).toEqual({ app: 'cairn', kind: 'sweep', v: '1.1' });
    expect(plain.input).toEqual(INPUT);
    expect(plain.attachments).toHaveLength(1);
  });

  it('carries model and effort in the grist header only when asked for', async () => {
    const { backend, d } = setup();
    await sendGrist({ door: d, key: PHONE_KEY, app: 'cairn', kind: 'sweep', v: '1.1', input: INPUT, photos: [], model: 'sonnet', effort: 'high' });
    const plain = decryptAsMill(postedEnvelope(backend.seen).envelope.ct as string) as { grist: unknown };
    expect(plain.grist).toEqual({ app: 'cairn', kind: 'sweep', v: '1.1', model: 'sonnet', effort: 'high' });
  });

  it('is sealed the way Postern seals: the same plaintext, sealed by the mill key reading what Postern sealed, and the same script framing', async () => {
    // Postern's recorded envelope decrypts with the mill key to the section 19 plaintext ...
    const posterns = decryptAsMill(fixture.grist.envelope.ct);
    expect(posterns).toEqual(JSON.parse(fixture.grist.plaintext));
    expect(Object.keys(posterns as object)).toEqual(['grist', 'input', 'attachments']);
    // ... and ours, for the same input, has the same shape and the same script framing around it.
    const { backend, d } = setup();
    const vectorGrist = JSON.parse(fixture.grist.plaintext) as { grist: { app: string; kind: string; v: string }; input: unknown };
    await sendGrist({ door: d, key: PHONE_KEY, ...vectorGrist.grist, input: vectorGrist.input, photos: [photo(1)], ts: fixture.ts });
    const ours = postedEnvelope(backend.seen);
    const theirs = grist.readRecordScript(fixture.grist.scriptHex);
    expect(Object.keys(ours.envelope)).toEqual(Object.keys(theirs.envelope));
    expect({ ...ours.envelope, ct: '' }).toEqual({ ...theirs.envelope, ct: '' });
    const plain = decryptAsMill(ours.envelope.ct as string) as { grist: unknown; input: unknown };
    expect({ grist: plain.grist, input: plain.input }).toEqual({ grist: vectorGrist.grist, input: vectorGrist.input });
    expect(ours.scriptHex.slice(0, 26)).toBe(fixture.grist.scriptHex.slice(0, 26));
  });

  it('builds the record script as Postern does: encodeRecordScript, byte for byte, for the payload Postern made', () => {
    expect(grist.recordScriptHex(fixture.grist.envelope as grist.Envelope)).toBe(fixture.grist.scriptHex);
    expect(grist.recordScriptHex(fixture.answers.answered.envelope as grist.Envelope)).toBe(fixture.answers.answered.scriptHex);
  });

  it('refuses a request whose record would not fit before anything is sent', async () => {
    const { backend, d } = setup();
    await expect(
      sendGrist({ door: d, key: PHONE_KEY, app: 'cairn', kind: 'sweep', v: '1.1', input: { text: 'x'.repeat(20_000) }, photos: [] }),
    ).rejects.toBeInstanceOf(grist.GristInputError);
    expect(backend.seen.filter((s) => s.method === 'POST')).toEqual([]);
  });

  it('asks for the mill key from /api/me, or uses the one it is given and does not ask', async () => {
    const a = setup();
    await sendGrist({ door: a.d, key: PHONE_KEY, app: 'cairn', kind: 'sweep', v: '1.1', input: INPUT, photos: [] });
    expect(a.backend.seen.map((s) => s.path)).toContain('/me');
    const b = setup();
    await sendGrist({ door: b.d, key: PHONE_KEY, app: 'cairn', kind: 'sweep', v: '1.1', input: INPUT, photos: [], mill: MILL.publicKeyHex });
    expect(b.backend.seen.map((s) => s.path)).not.toContain('/me');
  });

  it('refuses to send when the backend names no mill key', async () => {
    const { backend, d } = setup();
    backend.mill = '';
    await expect(sendGrist({ door: d, key: PHONE_KEY, app: 'cairn', kind: 'sweep', v: '1.1', input: INPUT, photos: [] })).rejects.toThrow(/mill/);
  });
});

describe('sendGrist: the photos', () => {
  it('refuses 5 photos before any upload', async () => {
    const { backend, d } = setup();
    const photos = [1, 2, 3, 4, 5].map((n) => photo(n));
    await expect(sendGrist({ door: d, key: PHONE_KEY, app: 'cairn', kind: 'sweep', v: '1.1', input: INPUT, photos })).rejects.toBeInstanceOf(grist.GristInputError);
    expect(backend.seen).toEqual([]);
  });

  it('accepts 4', async () => {
    const { backend, d } = setup();
    await sendGrist({ door: d, key: PHONE_KEY, app: 'cairn', kind: 'sweep', v: '1.1', input: INPUT, photos: [1, 2, 3, 4].map((n) => photo(n)) });
    expect(backend.seen.filter((s) => s.path === '/blobs')).toHaveLength(4);
  });

  it('refuses a type a grist does not carry, and an oversize photo, before any upload', async () => {
    for (const bad of [photo(1, 'application/pdf'), photo(1, 'image/gif'), { bytes: new Uint8Array(grist.MAX_PHOTO_BYTES + 1), mime: 'image/png' }]) {
      const { backend, d } = setup();
      await expect(
        sendGrist({ door: d, key: PHONE_KEY, app: 'cairn', kind: 'sweep', v: '1.1', input: INPUT, photos: [photo(2), bad] }),
      ).rejects.toBeInstanceOf(grist.GristInputError);
      expect(backend.seen).toEqual([]);
    }
  });

  it('uploads each photo sealed to the mill key and lists it by hash, size and mime', async () => {
    const { backend, d } = setup();
    const photos = [photo(1, 'image/jpeg'), photo(2, 'image/png'), photo(3, 'image/webp')];
    await sendGrist({ door: d, key: PHONE_KEY, app: 'cairn', kind: 'sweep', v: '1.1', input: INPUT, photos });
    const uploads = backend.seen.filter((s) => s.path === '/blobs');
    expect(uploads).toHaveLength(3);
    uploads.forEach((u, i) => {
      // The body is BRC-78 ciphertext, not the photo; the mill key opens it.
      expect(Buffer.from(u.body!).includes(Buffer.from(photos[i].bytes))).toBe(false);
      const opened = EncryptedMessage.decrypt(Array.from(u.body!), PrivateKey.fromHex(MILL.privateKeyHex));
      expect(Uint8Array.from(opened)).toEqual(photos[i].bytes);
    });
    const plain = decryptAsMill(postedEnvelope(backend.seen).envelope.ct as string) as { attachments: unknown[] };
    expect(plain.attachments).toEqual(
      uploads.map((u, i) => ({ hash: `${i + 1}`.padStart(64, 'b'), size: u.body!.length, mime: photos[i].mime })),
    );
    expect(Object.keys(plain.attachments[0] as object)).toEqual(['hash', 'size', 'mime']);
  });

  it('uploads every photo before it posts the record, and posts nothing when an upload fails', async () => {
    const { backend, d } = setup();
    await sendGrist({ door: d, key: PHONE_KEY, app: 'cairn', kind: 'sweep', v: '1.1', input: INPUT, photos: [photo(1), photo(2)] });
    const order = backend.seen.map((s) => `${s.method} ${s.path}`).filter((s) => s !== 'GET /me');
    expect(order).toEqual(['POST /blobs', 'POST /blobs', 'POST /messages']);

    const failing = setup();
    failing.backend.failBlobs = { status: 413, error: 'That image is too large.' };
    await expect(
      sendGrist({ door: failing.d, key: PHONE_KEY, app: 'cairn', kind: 'sweep', v: '1.1', input: INPUT, photos: [photo(1)] }),
    ).rejects.toMatchObject({ name: 'RefusedError', status: 413, message: 'That image is too large.' });
    expect(failing.backend.seen.some((s) => s.path === '/messages')).toBe(false);
  });

  it('reads the Postern fixture photo: sealed by Postern, opened with the mill key', () => {
    const opened = EncryptedMessage.decrypt(bytesOf(fixture.photo.sealedHex), PrivateKey.fromHex(MILL.privateKeyHex));
    expect(Uint8Array.from(opened)).toEqual(fromHex(fixture.photo.bytesHex));
  });
});

describe('sendGrist: what it will not send', () => {
  it('refuses an app or kind the mill would not name, and an empty version', async () => {
    for (const bad of [{ app: 'Cairn' }, { app: '' }, { kind: 'a b' }, { kind: 'x'.repeat(65) }, { v: ' ' }]) {
      const { backend, d } = setup();
      await expect(
        sendGrist({ door: d, key: PHONE_KEY, app: 'cairn', kind: 'sweep', v: '1.1', input: INPUT, photos: [], ...bad }),
      ).rejects.toBeInstanceOf(grist.GristInputError);
      expect(backend.seen).toEqual([]);
    }
  });

  it('turns a refusal of the post into a RefusedError with the backend’s words', async () => {
    const { backend, d } = setup();
    backend.failPost = { status: 403, error: 'An app key sends grist to the mill only.' };
    await expect(sendGrist({ door: d, key: PHONE_KEY, app: 'cairn', kind: 'sweep', v: '1.1', input: INPUT, photos: [] })).rejects.toMatchObject({
      name: 'RefusedError',
      status: 403,
      message: 'An app key sends grist to the mill only.',
    });
  });

  it('turns a gateway error into a BackendUnreachableError', async () => {
    const { backend, d } = setup();
    backend.failPost = { status: 503, error: 'Standby.' };
    await expect(sendGrist({ door: d, key: PHONE_KEY, app: 'cairn', kind: 'sweep', v: '1.1', input: INPUT, photos: [] })).rejects.toBeInstanceOf(
      door.BackendUnreachableError,
    );
  });
});
