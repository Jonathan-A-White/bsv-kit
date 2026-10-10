// The chain reader port: the three WhatsOnChain reads Postern's licence check makes, and an optional bulk
// read of transactions. Lifted from the read side of spell-forge-bsv's ChainProvider.

export interface AddressHistoryEntry {
  txid: string;
  height?: number;
}

export interface ChainReader {
  /** Confirmed history of an address, oldest first. */
  getAddressHistory(address: string): Promise<AddressHistoryEntry[]>;
  /** The mempool's part of the history; a reader that cannot tell leaves it out. */
  getUnconfirmedAddressHistory?(address: string): Promise<AddressHistoryEntry[]>;
  /** The raw transaction, as hex. */
  getTransactionHex(txid: string): Promise<string>;
  /** Many raw transactions at once, by txid (WhatsOnChain's /txs/hex, 20 a request). A txid it could not read
   * is left out of the map, and the licence check asks getTransactionHex for it. */
  getTransactionHexes?(txids: readonly string[]): Promise<Map<string, string>>;
}
