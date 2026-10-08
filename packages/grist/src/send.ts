// sendGrist: docs/protocol.md section 19. Each photo is sealed to the MILL key and uploaded (POST /api/blobs,
// section 8); the grist's plaintext {grist, input, attachments} is sealed to the mill (BRC-78) in a section 1
// envelope of class "grist" and posted with POST /api/messages (section 9). Every photo is uploaded before the
// record is posted, so a failed upload posts nothing. The calls go through bsv's door.
import { door } from 'bsv-kit/bsv';
import { GristInputError } from './errors.js';
import { fetchMill } from './mill.js';
import { recordScriptHex, sealBytes, sealEnvelope } from './seal.js';
import type { Attachment, Envelope, GristFile, GristHeader, GristPlaintext, Photo, SentGrist } from './types.js';

const { BackendUnreachableError, RefusedError, withTimeout } = door;
type Door = InstanceType<typeof door.Door>;

/** The most photos one grist carries (section 19). */
export const MAX_PHOTOS = 4;
/** 8 MB: the cap on one photo, checked before any upload (section 8). */
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
/** What a grist may carry (section 19). */
export const PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** The recordings a grist may carry under `attachments`. */
export const AUDIO_MIMES = ['audio/webm', 'audio/ogg', 'audio/mp4'] as const;
/** 8 MiB: the cap on all the audio of one grist together, checked before any upload. */
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
/** The names the mill takes for an app and a kind (millwright's gristKind). */
const NAME = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export interface SendGristParams {
  /** The door the calls go through (its key is the app's). */
  door: Door;
  /** The app's raw 32-byte key: what seals the photos and the envelope. */
  key: Uint8Array;
  app: string;
  kind: string;
  /** The version of the app's own request schema. */
  v: string;
  /** The app's request, in the app's own schema. */
  input: unknown;
  /** Photos: image/jpeg, image/png or image/webp, at most 8 MB each; each may carry a `name`. With `attachments`,
   * at most 4 files in all. Absent means none. */
  photos?: Photo[];
  /** Photos and recordings (audio/webm, audio/ogg, audio/mp4; all the audio together at most 8 MiB), sent after
   * `photos`, each with an optional `name`. */
  attachments?: GristFile[];
  model?: string;
  effort?: GristHeader['effort'];
  /** The pinned mill key; asked of GET /api/me when absent. */
  mill?: string;
  /** The outbox row's client id, so the backend stores a retry once (section 9). */
  clientId?: string;
  /** Unix seconds; defaults to now. A fixed value makes a reproducible envelope. */
  ts?: number;
}

/** The mime without its parameters ('audio/webm;codecs=opus' becomes 'audio/webm'), lower-case. */
const baseMime = (mime: string): string => mime.split(';')[0].trim().toLowerCase();

/** Every file the grist carries, in the order the grind sees them: `photos`, then `attachments` (whose mimes are
 * normalised to their base type). */
function filesOf(params: SendGristParams): GristFile[] {
  return [...(params.photos ?? []), ...(params.attachments ?? []).map((f) => ({ ...f, mime: baseMime(f.mime) }))];
}

/** What the backend's refusal says, in its own words. */
async function refusalMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.clone().json()) as { error?: unknown };
    if (typeof body.error === 'string' && body.error) return body.error;
  } catch {
    // not JSON: the fallback says it
  }
  return fallback;
}

/** The grist as the record will carry it, with the attachments the uploads will name. */
function plaintextOf(params: SendGristParams, attachments: Attachment[]): GristPlaintext {
  const header: GristHeader = { app: params.app, kind: params.kind, v: params.v, ...(params.model ? { model: params.model } : {}), ...(params.effort ? { effort: params.effort } : {}) };
  return { grist: header, input: params.input, attachments };
}

function envelopeOf(plaintext: GristPlaintext, params: SendGristParams, mill: string): Envelope {
  return sealEnvelope(JSON.stringify(plaintext), params.key, mill, params.ts ?? Math.floor(Date.now() / 1000));
}

/** Whether the record would fit its cap, found out before any photo is uploaded: the attachments are
 * stood in for by the longest entries the uploads can name. */
function checkFits(params: SendGristParams, mill: string): void {
  const stand: Attachment[] = filesOf(params).map((f) => ({ hash: '0'.repeat(64), size: 99_999_999, mime: f.mime, ...(f.name === undefined ? {} : { name: f.name }) }));
  try {
    recordScriptHex(envelopeOf(plaintextOf(params, stand), params, mill));
  } catch (err) {
    if (err instanceof RangeError) throw new GristInputError(`This grist is too large to send: ${err.message}.`);
    throw err;
  }
}

function check(params: SendGristParams): void {
  if (!NAME.test(params.app)) throw new GristInputError(`The app ${JSON.stringify(params.app)} must be lower-case letters, digits, - or _.`);
  if (!NAME.test(params.kind)) throw new GristInputError(`The kind ${JSON.stringify(params.kind)} must be lower-case letters, digits, - or _.`);
  if (!params.v.trim()) throw new GristInputError('A grist needs the version of the app’s request schema.');
  for (const photo of params.photos ?? []) {
    if (!(PHOTO_MIMES as readonly string[]).includes(photo.mime)) throw new GristInputError(`${photo.mime} is not a photo a grist carries: use image/jpeg, image/png or image/webp.`);
  }
  const files = filesOf(params);
  if (files.length > MAX_PHOTOS) throw new GristInputError(`${files.length} files is over the ${MAX_PHOTOS} a grist may carry.`);
  let audioBytes = 0;
  for (const file of files) {
    if (file.name !== undefined && (!file.name.trim() || /[\\/]/.test(file.name))) {
      throw new GristInputError(`The file name ${JSON.stringify(file.name)} must be a base name: not empty, no folders.`);
    }
    if ((AUDIO_MIMES as readonly string[]).includes(file.mime)) {
      audioBytes += file.bytes.length;
    } else if (!(PHOTO_MIMES as readonly string[]).includes(file.mime)) {
      throw new GristInputError(`${file.mime || 'a file of no type'} is not a file a grist carries: use image/jpeg, image/png or image/webp, or audio/webm, audio/ogg or audio/mp4.`);
    } else if (file.bytes.length > MAX_PHOTO_BYTES) {
      throw new GristInputError(`A photo of ${file.bytes.length} bytes is over the ${MAX_PHOTO_BYTES} bytes (8 MB) a photo may be.`);
    }
  }
  if (audioBytes > MAX_AUDIO_BYTES) throw new GristInputError(`${audioBytes} bytes of audio is over the ${MAX_AUDIO_BYTES} bytes (8 MiB) a grist may carry.`);
}

async function upload(d: Door, sealed: Uint8Array, file: GristFile): Promise<Attachment> {
  const response = await d.fetch('/blobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: sealed.buffer.slice(sealed.byteOffset, sealed.byteOffset + sealed.byteLength) as ArrayBuffer,
  });
  if (!response.ok) throw new RefusedError(await refusalMessage(response, 'The image upload failed.'), response.status);
  // The upload has not sent the grist: a timeout here means nothing has gone.
  const body = (await withTimeout(response.json(), false)) as { hash?: unknown; size?: unknown };
  if (typeof body.hash !== 'string' || typeof body.size !== 'number') throw new Error('The upload succeeded but returned no hash.');
  return { hash: body.hash, size: body.size, mime: file.mime, ...(file.name === undefined ? {} : { name: file.name }) };
}

async function post(d: Door, scriptHex: string, clientId: string | undefined): Promise<{ txid: string; seq: number | undefined }> {
  const response = await d.fetch('/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(clientId ? { scriptHex, clientId } : { scriptHex }),
  });
  if (response.status === 502 || response.status === 503 || response.status === 504) {
    throw new BackendUnreachableError(await refusalMessage(response, 'The backend refused the grist.'));
  }
  if (!response.ok) throw new RefusedError(await refusalMessage(response, 'The backend refused the grist.'), response.status);
  const body = (await withTimeout(response.json(), true)) as { txid?: unknown; seq?: unknown };
  if (typeof body.txid !== 'string') throw new Error('The backend took the grist but named no id.');
  return { txid: body.txid, seq: typeof body.seq === 'number' ? body.seq : undefined };
}

async function deliver(params: SendGristParams): Promise<{ txid: string; seq: number | undefined; mill: string }> {
  check(params);
  const mill = params.mill ?? (await fetchMill(params.door));
  checkFits(params, mill);
  const attachments: Attachment[] = [];
  for (const file of filesOf(params)) {
    attachments.push(await upload(params.door, sealBytes(file.bytes, params.key, mill), file));
  }
  const { txid, seq } = await post(params.door, recordScriptHex(envelopeOf(plaintextOf(params, attachments), params, mill)), params.clientId);
  return { txid, seq, mill };
}

/**
 * Sends a grist: seals and uploads each file (photos, then attachments) to the mill key, then posts the grist
 * record. Resolves with its txid (`direct:…`), which `awaitAnswer` matches the mill's answer to. Throws
 * GristInputError (nothing sent) for a grist the mill would refuse for its shape, the door's errors for the
 * backend's.
 */
export async function sendGrist(params: SendGristParams): Promise<string> {
  return (await deliver(params)).txid;
}

/**
 * Sends a grist as `sendGrist` does and resolves with {txid, seq, mill}: the id, its place in the backend's
 * sequence and the mill key it was sealed to, for an app to keep and read the answer with later (readAnswerPage).
 * Throws when the backend names no seq (the grist has been sent by then).
 */
export async function sendGristRecord(params: SendGristParams): Promise<SentGrist> {
  const { txid, seq, mill } = await deliver(params);
  if (seq === undefined) throw new Error('The backend took the grist but named no seq.');
  return { txid, seq, mill };
}
