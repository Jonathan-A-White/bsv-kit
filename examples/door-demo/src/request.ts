// The grist this page sends: Cairn's Sweep Request and a photo.
import type { grist } from 'bsv-kit/grist';

/** The one grind that exists today. */
export const DEFAULTS = { app: 'cairn', kind: 'sweep', v: '1.1', collection: 'cairn' } as const;

const TAKEN = ['image/jpeg', 'image/png', 'image/webp'];

/** A Sweep Request (Cairn's sweep-request-1.1 schema) for a made-up place; `v` is its schemaVersion. */
export function sweepInput(v: string): unknown {
  return { schemaVersion: v, requestType: 'sweep', place: { name: 'Door demo drawer', path: 'Door demo -> drawer' } };
}

export async function readPhoto(file: Blob): Promise<grist.Photo> {
  if (!TAKEN.includes(file.type)) {
    throw new Error(`The mill takes JPEG, PNG or WebP photos; this one is ${file.type || 'of unknown type'}.`);
  }
  return { bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type };
}
