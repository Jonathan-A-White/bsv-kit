// Builds transaction hex carrying one nftgate typed record, the shape Postern's licence check reads.
// Built with @bsv/sdk like Postern's own tests/support/nftgate-fixtures.ts; licence-record.test.ts
// checks it makes the same bytes as the fixture Postern's builders made.
import { LockingScript, OP, PrivateKey, Transaction, Utils } from '@bsv/sdk';

export const KEY = PrivateKey.fromHex('11'.repeat(32));
export const PUBLIC_KEY_HEX = KEY.toPublicKey().toString();
export const ADDRESS = KEY.toPublicKey().toAddress('testnet');
export const OTHER_ADDRESS = 'mzSomeoneElseAddress';

function typedRecordTxHex(recordType: 'M' | 'TR' | 'W', payload: object): string {
  const script = new LockingScript()
    .writeOpCode(OP.OP_FALSE)
    .writeOpCode(OP.OP_RETURN)
    .writeBin(Utils.toArray('nftgate', 'utf8'))
    .writeBin([0x02])
    .writeBin(Utils.toArray(recordType, 'utf8'))
    .writeBin([0x00])
    .writeBin(Utils.toArray(JSON.stringify(payload), 'utf8'));
  const tx = new Transaction();
  tx.addOutput({ lockingScript: script, satoshis: 0 });
  return tx.toHex();
}

/** A mint (type-M) record naming `holderAddress` as the holder of `collection`. */
export function mintTxHex(collection: string, holderAddress: string = ADDRESS): string {
  return typedRecordTxHex('M', { collection, holder: holderAddress });
}

/** A transfer (type-TR) record moving the token at `origin` ("txid:vout") to `toAddress`. */
export function transferTxHex(origin: string, toAddress: string = OTHER_ADDRESS): string {
  return typedRecordTxHex('TR', { origin, to: toAddress });
}

/** An issuer's revoke (type-W) record naming `origin`. */
export function revokeTxHex(origin: string): string {
  return typedRecordTxHex('W', { kind: 'revoke', origin });
}
