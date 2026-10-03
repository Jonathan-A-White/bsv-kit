// The chain reader port: the three WhatsOnChain reads Postern's licence check makes, and nothing else.
// Lifted from the read side of spell-forge-bsv's ChainProvider.

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
}
