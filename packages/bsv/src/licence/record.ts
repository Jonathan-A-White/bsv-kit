// The nftgate typed record (format 0x02), as Postern's licence check reads it from a transaction.
// Lifted from spell-forge-bsv's record.ts (decodeTypedRecordScript, findTypedRecordsInTransaction).
//
// Script layout: OP_FALSE OP_RETURN <'nftgate'> <0x02> <type: M, W or TR> [<manifest: 0x00>] <payload>.
// The manifest push is absent from the older four-push layout; either is read.
import { Transaction } from '@bsv/sdk';

const OP_FALSE = 0x00;
const OP_RETURN = 0x6a;
const OP_PUSHDATA1 = 0x4c;
const OP_PUSHDATA2 = 0x4d;
const OP_PUSHDATA4 = 0x4e;
const PROTOCOL_ID = 'nftgate';
const RECORD_VERSION_TYPED = 0x02;

export type TypedRecordType = 'M' | 'W' | 'TR';

export interface TypedRecordInTransaction {
  recordType: TypedRecordType;
  payloadBytes: number[];
  vout: number;
}

/** Splits a pushdata sequence (literal length, OP_PUSHDATA1/2/4) into its pushes, or null if it is not one. */
function parsePushes(bytes: number[]): number[][] | null {
  const pushes: number[][] = [];
  let i = 0;
  while (i < bytes.length) {
    const op = bytes[i++];
    let length: number;
    if (op < OP_PUSHDATA1) {
      length = op;
    } else if (op === OP_PUSHDATA1) {
      if (i + 1 > bytes.length) return null;
      length = bytes[i];
      i += 1;
    } else if (op === OP_PUSHDATA2) {
      if (i + 2 > bytes.length) return null;
      length = bytes[i] | (bytes[i + 1] << 8);
      i += 2;
    } else if (op === OP_PUSHDATA4) {
      if (i + 4 > bytes.length) return null;
      length = (bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24)) >>> 0;
      i += 4;
    } else {
      return null;
    }
    if (i + length > bytes.length) return null;
    pushes.push(bytes.slice(i, i + length));
    i += length;
  }
  return pushes;
}

const text = (bytes: number[]): string => String.fromCharCode(...bytes);

/** The record a locking script holds, or null for anything else (a P2PKH output, a foreign OP_RETURN, ...). */
function decodeTypedRecordScript(script: number[]): { recordType: TypedRecordType; payloadBytes: number[] } | null {
  if (script[0] !== OP_FALSE || script[1] !== OP_RETURN) return null;
  const pushes = parsePushes(script.slice(2));
  if (!pushes || (pushes.length !== 4 && pushes.length !== 5)) return null;
  const [protocol, version, type] = pushes;
  if (text(protocol) !== PROTOCOL_ID) return null;
  if (version.length !== 1 || version[0] !== RECORD_VERSION_TYPED) return null;
  const recordType = (['M', 'W', 'TR'] as const).find((t) => t === text(type));
  if (!recordType) return null;
  if (pushes.length === 5 && !(pushes[3].length === 1 && pushes[3][0] === 0)) return null; // only the empty manifest is understood
  return { recordType, payloadBytes: pushes[pushes.length - 1] };
}

/** Every typed nftgate record output in a transaction, each with its vout. */
export function findTypedRecords(txHex: string): TypedRecordInTransaction[] {
  const records: TypedRecordInTransaction[] = [];
  Transaction.fromHex(txHex).outputs.forEach((output, vout) => {
    const decoded = decodeTypedRecordScript(output.lockingScript.toBinary());
    if (decoded) records.push({ ...decoded, vout });
  });
  return records;
}
