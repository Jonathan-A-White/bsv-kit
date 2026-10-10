// A ChainReader double: holds transactions by address history and txid, with no network. Setting
// `offline` makes every method reject, standing in for WhatsOnChain being unreachable.
import type { AddressHistoryEntry, ChainReader } from './reader.js';

export class FakeChainReader implements ChainReader {
  offline = false;

  private readonly confirmed = new Map<string, AddressHistoryEntry[]>();
  private readonly unconfirmed = new Map<string, AddressHistoryEntry[]>();
  private readonly hexByTxid = new Map<string, string>();

  /** A mined transaction in the address's history. */
  addTransaction(address: string, txid: string, hex: string, height = 1): void {
    this.hexByTxid.set(txid, hex);
    this.confirmed.set(address, [...(this.confirmed.get(address) ?? []), { txid, height }]);
  }

  /** A transaction still in the mempool: listed only by the unconfirmed history. */
  addUnconfirmedTransaction(address: string, txid: string, hex: string): void {
    this.hexByTxid.set(txid, hex);
    this.unconfirmed.set(address, [...(this.unconfirmed.get(address) ?? []), { txid, height: 0 }]);
  }

  /** A transaction the reader can give by txid but that no address history lists (a source transaction). */
  addKnownTransaction(txid: string, hex: string): void {
    this.hexByTxid.set(txid, hex);
  }

  private assertOnline(): void {
    if (this.offline) throw new Error('the chain is unreachable');
  }

  async getAddressHistory(address: string): Promise<AddressHistoryEntry[]> {
    this.assertOnline();
    return this.confirmed.get(address) ?? [];
  }

  async getUnconfirmedAddressHistory(address: string): Promise<AddressHistoryEntry[]> {
    this.assertOnline();
    return this.unconfirmed.get(address) ?? [];
  }

  async getTransactionHex(txid: string): Promise<string> {
    this.assertOnline();
    const hex = this.hexByTxid.get(txid);
    if (!hex) throw new Error(`FakeChainReader has no transaction for ${txid}`);
    return hex;
  }

  /** The bulk read: every txid it holds; one it does not is left out, as WhatsOnChain leaves one it cannot read. */
  async getTransactionHexes(txids: readonly string[]): Promise<Map<string, string>> {
    this.assertOnline();
    const found = new Map<string, string>();
    for (const txid of txids) {
      const hex = this.hexByTxid.get(txid);
      if (hex) found.set(txid, hex);
    }
    return found;
  }
}
