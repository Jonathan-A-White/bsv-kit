// Sealing and reading: BRC-78 (@bsv/sdk's EncryptedMessage) and the record script, lifted from Postern's
// src/services/messages.ts (encryptMessage, encryptAttachment) and spell-forge-bsv's record.ts
// (encodeRecordScript). Postern's wire formats are the law: the fixture in tests/fixtures was made by that code.
import { EncryptedMessage, LockingScript, OP, PrivateKey, PublicKey, Utils } from '@bsv/sdk';
import type { Envelope } from './types.js';

/** `nftgate`, the record's protocol id, and its version byte (docs/protocol.md section 1). */
const PROTOCOL_ID = Utils.toArray('nftgate', 'utf8');
const RECORD_VERSION_PLAINTEXT = 0x01;
/** The cap spell-forge-bsv's encodeRecordScript puts on a record's payload. */
export const MAX_PAYLOAD_BYTES = 10 * 1024;

const privateKeyOf = (key: Uint8Array): PrivateKey => PrivateKey.fromHex(Utils.toHex(Array.from(key)));

/** Seals `bytes` to `recipientPublicKeyHex`, from the sender's key: the raw BRC-78 bytes (a photo's upload). */
export function sealBytes(bytes: Uint8Array, senderKey: Uint8Array, recipientPublicKeyHex: string): Uint8Array {
  return new Uint8Array(EncryptedMessage.encrypt(Array.from(bytes), privateKeyOf(senderKey), PublicKey.fromString(recipientPublicKeyHex)));
}

/** Builds the section 1 envelope for `text` sealed to the recipient, class `grist`, `ts` in Unix seconds. */
export function sealEnvelope(text: string, senderKey: Uint8Array, recipientPublicKeyHex: string, ts: number): Envelope {
  const sender = privateKeyOf(senderKey);
  const recipient = PublicKey.fromString(recipientPublicKeyHex);
  const encrypted = EncryptedMessage.encrypt(Utils.toArray(text, 'utf8'), sender, recipient);
  return {
    v: 1,
    kind: 'msg',
    class: 'grist',
    to: recipient.toString(),
    from: sender.toPublicKey().toString(),
    ts,
    ct: Utils.toBase64(encrypted),
  };
}

/** Opens a `ct` with the recipient's key. Throws when the key is not the one it was sealed to. */
export function openCt(ct: string, recipientKey: Uint8Array): string {
  return Utils.toUTF8(EncryptedMessage.decrypt(Utils.toArray(ct, 'base64'), privateKeyOf(recipientKey)));
}

/** Who sealed a `ct`: the sender's public key, from its BRC-78 header (version 4 bytes, then the sender's 33). */
export function sealerOf(ct: string): string {
  const bytes = Utils.toArray(ct, 'base64');
  if (bytes.length < 37) throw new Error('This is not a sealed message.');
  return Utils.toHex(bytes.slice(4, 37));
}

/** The hex of the record script that carries `envelope`: OP_FALSE OP_RETURN 'nftgate' 0x01 <payload>. */
export function recordScriptHex(envelope: Envelope): string {
  const payload = Utils.toArray(JSON.stringify(envelope), 'utf8');
  if (payload.length > MAX_PAYLOAD_BYTES) throw new RangeError(`Record payload is ${payload.length} bytes, over the ${MAX_PAYLOAD_BYTES}-byte cap`);
  return new LockingScript().writeOpCode(OP.OP_FALSE).writeOpCode(OP.OP_RETURN).writeBin(PROTOCOL_ID).writeBin([RECORD_VERSION_PLAINTEXT]).writeBin(payload).toHex();
}

/** Reads a record script back: its envelope. The SDK's parser treats everything after OP_RETURN as one blob,
 * so the pushes are read by hand. Throws for anything that is not an nftgate version 1 record. */
export function readRecordScript(scriptHex: string): { envelope: Envelope } {
  const bytes = Utils.toArray(scriptHex, 'hex');
  const pushes: number[][] = [];
  let i = 2;
  if (bytes[0] !== OP.OP_FALSE || bytes[1] !== OP.OP_RETURN) throw new Error('This is not a record script.');
  while (i < bytes.length) {
    const op = bytes[i++];
    let len = op;
    if (op === OP.OP_PUSHDATA1) len = bytes[i++];
    else if (op === OP.OP_PUSHDATA2) {
      len = bytes[i] | (bytes[i + 1] << 8);
      i += 2;
    } else if (op === OP.OP_PUSHDATA4) {
      len = bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24);
      i += 4;
    } else if (op > OP.OP_PUSHDATA1) throw new Error('This is not a record script.');
    pushes.push(bytes.slice(i, i + len));
    i += len;
  }
  const [protocol, version, payload] = pushes;
  if (pushes.length !== 3 || Utils.toUTF8(protocol) !== 'nftgate' || version.length !== 1 || version[0] !== RECORD_VERSION_PLAINTEXT) {
    throw new Error('This is not an nftgate record.');
  }
  return { envelope: JSON.parse(Utils.toUTF8(payload)) as Envelope };
}
