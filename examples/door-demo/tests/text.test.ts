import { describe, expect, it } from 'vitest';
import type { licence } from 'bsv-kit/bsv';
import { describeAnswer, describeError, describeLicence } from '../src/text.js';

type Status = licence.LicenceStatus;
const checkedAt = '2026-10-02T10:00:00.000Z';

describe('describeLicence', () => {
  it('says held, with the mint', () => {
    const s: Status = { state: 'held', outpoint: { txid: 'ab'.repeat(32), vout: 0 }, collection: 'cairn', checkedAt };
    expect(describeLicence(s)).toBe(`Held: this key holds a licence in "cairn" (mint ${'ab'.repeat(32)}:0).`);
  });
  it('says revoked', () => {
    const s: Status = { state: 'revoked', outpoint: { txid: 'cd'.repeat(32), vout: 1 }, collection: 'cairn', checkedAt };
    expect(describeLicence(s)).toContain('Revoked');
  });
  it('says none, and what to do about it', () => {
    expect(describeLicence({ state: 'none', checkedAt })).toBe(
      'None: this key holds no licence in that collection. Give the public key above to the Governor to be licensed.',
    );
  });
  it('says indexing', () => {
    expect(describeLicence({ state: 'indexing', txid: 'ef', broadcastAt: checkedAt, checkedAt })).toContain('on its way');
  });
});

describe('describeAnswer', () => {
  it('shows an answered grist with its answer as indented JSON', () => {
    const text = describeAnswer({ re: 't', status: 'answered', answer: { items: [{ name: 'spoon' }] }, grind: { app: 'cairn', kind: 'sweep', v: '1.1' } });
    expect(text).toContain('answered');
    expect(text).toContain('cairn / sweep / 1.1');
    expect(text).toContain('"name": "spoon"');
  });
  it('shows a refusal with its reason', () => {
    const text = describeAnswer({ re: 't', status: 'refused', reason: 'model', grind: { app: 'cairn', kind: 'sweep', v: '1.1' } });
    expect(text).toContain('refused');
    expect(text).toContain('model');
  });
});

describe('describeError', () => {
  it('uses the message of an Error and the text of anything else', () => {
    expect(describeError(new Error('boom'))).toBe('boom');
    expect(describeError('plain')).toBe('plain');
  });
});
