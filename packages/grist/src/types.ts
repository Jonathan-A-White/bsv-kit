// The shapes of docs/protocol.md section 19.

/** The header of a grist: which grind to run. `model` and `effort` are optional asks the mill honours
 * only within the factory's caps. */
export interface GristHeader {
  app: string;
  kind: string;
  /** The version of the app's own request schema. */
  v: string;
  model?: string;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
}

/** A file as the grist lists it: the sealed upload's hash and byte length, the file's type and, when it had
 * one, its base name (protocol section 8: a reader must cope without it). */
export interface Attachment {
  hash: string;
  size: number;
  mime: string;
  name?: string;
}

/** What a grist's `ct` seals to the mill key. */
export interface GristPlaintext {
  grist: GristHeader;
  input: unknown;
  attachments: Attachment[];
}

/** A photo to send: its bytes and its type (image/jpeg, image/png or image/webp), and optionally its base name
 * (no folders). */
export interface Photo {
  bytes: Uint8Array;
  mime: string;
  name?: string;
}

/** A file to send under `attachments`: a photo, or a recording (audio/webm, audio/ogg or audio/mp4). A codec
 * suffix on the mime ('audio/webm;codecs=opus') is dropped on the wire. `name` is optional, a base name. */
export type GristFile = Photo;

/** What sending a grist gives back: the grist's id (`direct:…`), its place in the backend's sequence and the
 * mill key it was sealed to, for an app to keep and read the answer with later. */
export interface SentGrist {
  txid: string;
  seq: number;
  mill: string;
}

export type AnswerStatus = 'answered' | 'refused' | 'failed';

/** Which grind answered, and the commit of the app's rig it was read at. */
export interface GrindRef {
  app: string;
  kind: string;
  v: string;
  commit?: string;
}

/** What the mill's answer record seals: `re` is the grist's txid. `answer` is in the app's own schema
 * (the app checks it again before it keeps anything); `reason` is present unless `answered`. */
export interface GristAnswer<A = unknown> {
  re: string;
  status: AnswerStatus;
  answer?: A;
  reason?: string;
  grind: GrindRef;
  /** What the mill echoes beside an answer for the app to keep: the scorers' results. Typed loosely on purpose
   * (an `unknown` the app narrows); absent when the grind has none. */
  reading_result?: unknown;
}

/** The clear envelope of docs/protocol.md section 1, as it travels and as GET /api/messages returns it. */
export interface Envelope {
  v: 1;
  kind: 'msg';
  class: string;
  to: string;
  from: string;
  ts: number;
  ct: string;
}
