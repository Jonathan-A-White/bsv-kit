import { describe, expect, it } from 'vitest';
import { DEFAULTS, readPhoto, sweepInput } from '../src/request.js';

describe('request', () => {
  it('defaults to the one grind that exists today', () => {
    expect(DEFAULTS).toMatchObject({ app: 'cairn', kind: 'sweep', v: '1.1', collection: 'cairn' });
  });

  it('builds the Sweep Request of the version asked', () => {
    expect(sweepInput('1.1')).toEqual({
      schemaVersion: '1.1',
      requestType: 'sweep',
      place: { name: 'Door demo drawer', path: 'Door demo -> drawer' },
    });
  });

  it('reads a photo into bytes and a type', async () => {
    const file = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    const photo = await readPhoto(file);
    expect(photo.mime).toBe('image/png');
    expect(Array.from(photo.bytes)).toEqual([1, 2, 3]);
  });

  it('refuses a file the mill does not take', async () => {
    await expect(readPhoto(new Blob(['x'], { type: 'image/gif' }))).rejects.toThrow('The mill takes JPEG, PNG or WebP photos; this one is image/gif.');
    await expect(readPhoto(new Blob(['x']))).rejects.toThrow('The mill takes JPEG, PNG or WebP photos; this one is of unknown type.');
  });
});
