import { describe, expect, it } from 'vitest';
import { MAX_PAYLOAD_BYTES, readRecordScript, recordScriptHex } from '../src/seal.js';
import type { Envelope } from '../src/types.js';

/** An envelope whose JSON payload is exactly `bytes` long (the ct is padded). */
function envelopeOfSize(bytes: number): Envelope {
  const base: Envelope = { v: 1, kind: 'msg', class: 'grist', to: '02'.padEnd(66, '0'), from: '03'.padEnd(66, '0'), ts: 1_700_000_000, ct: '' };
  const pad = bytes - new TextEncoder().encode(JSON.stringify(base)).length;
  return { ...base, ct: 'A'.repeat(pad) };
}

describe('the record payload cap', () => {
  it('is 20480 bytes', () => {
    expect(MAX_PAYLOAD_BYTES).toBe(20480);
  });

  it('seals a 20480-byte payload', () => {
    const envelope = envelopeOfSize(20480);
    expect(readRecordScript(recordScriptHex(envelope)).envelope).toEqual(envelope);
  });

  it('refuses a 20481-byte payload, naming 20480', () => {
    expect(() => recordScriptHex(envelopeOfSize(20481))).toThrow(new RangeError('Record payload is 20481 bytes, over the 20480-byte cap'));
  });
});
