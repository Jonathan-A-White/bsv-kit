// The fake Postern for the grist tests: bsv-kit/testing's, set to the keys of the fixtures Postern made.
import { Utils } from '@bsv/sdk';
import { fakePostern, NONCE, type FakePostern, type FakeRecord, type Seen } from '../../src/testing.js';
import vectors from '../fixtures/postern-grist-vectors.json' with { type: 'json' };

export const MILL = vectors.keys.mill;
export const PHONE = vectors.keys.cairnPhone;
export const BASE = 'https://backend.example';
export { NONCE };
export type { FakeRecord, Seen };
export type FakeBackend = FakePostern;

export const fromHex = (h: string): Uint8Array => new Uint8Array(Buffer.from(h, 'hex'));
export const PHONE_KEY = fromHex(PHONE.privateKeyHex);

export const fakeBackend = (): FakeBackend =>
  fakePostern({ base: BASE, appKey: PHONE_KEY, millKey: fromHex(MILL.privateKeyHex), mill: MILL.publicKeyHex, pubkey: PHONE.publicKeyHex });

/** The bytes of a hex string as a number array, the way the SDK reads them. */
export const bytesOf = (hex: string): number[] => Utils.toArray(hex, 'hex');
