// The licence check: does a key hold a License token. Lifted from Postern's src/services/licence.ts.
// A licence is a type-M ('mint') record naming the key's own testnet address as holder, in the
// collection asked for, with no later type-TR ('transfer') record moving that same origin away. The
// token is output 0 of its mint transaction, so the origin is the mint's txid at vout 0.
//
// A self-minted licence is funded by the holder's own key, so it is in the holder's own address
// history. A licence an issuer minted to the key (Postern's Issue a licence) is funded by the issuer:
// its token is a contract-locked output no address lists, so it is found only in the ISSUER's address
// history, as Postern's backend does (server/internal/licence). Name the issuer (`issuer`, its public
// key) to read that history too; the backend's issuer rule then applies as it does there: a mint counts
// only if the issuer signed it, and the issuer's signed revoke (W) record ends a licence.
//
// Postern caches the answer and a "mint pending" marker in its own store; here the marker is an input
// (`pending`) and the answer is returned, so the app keeps whatever it likes.
import { Hash, PublicKey, Transaction, Utils } from '@bsv/sdk';
import type { ChainReader } from './reader.js';
import { findTypedRecords } from './record.js';
import type { TypedRecordInTransaction } from './record.js';
import { WhatsOnChainReader } from './whatsonchain.js';

/** The network Postern's licences live on (its chainConfig.network). */
const NETWORK = 'testnet';

/** How long a mint that was broadcast but is not in the history yet is called "indexing" rather than "none".
 * Postern keeps the marker until the mint shows (mw-1589l.24); a library cannot wait forever, so this is a limit. */
export const DEFAULT_GRACE_MS = 10 * 60 * 1000;

export interface LicenceOutpoint {
  txid: string;
  vout: number;
}

/** A found licence: where its mint is, and the collection that mint names. */
export interface FoundLicence extends LicenceOutpoint {
  collection: string;
}

/** A mint the app has broadcast, as Postern records it the moment it does (setMintPending). */
export interface MintPending {
  txid: string;
  /** ISO time of the broadcast. */
  broadcastAt: string;
}

export type LicenceStatus =
  /** A mint in the collection with no later transfer. */
  | { state: 'held'; outpoint: LicenceOutpoint; collection: string; checkedAt: string }
  /** A mint in the collection, and a later transfer moved it away. */
  | { state: 'revoked'; outpoint: LicenceOutpoint; collection: string; checkedAt: string }
  /** No mint yet, but one was broadcast within the grace period: WhatsOnChain is still indexing it. */
  | { state: 'indexing'; txid: string; broadcastAt: string; checkedAt: string }
  | { state: 'none'; checkedAt: string };

export interface LicenceOptions {
  /** Defaults to WhatsOnChain's testnet. */
  reader?: ChainReader;
  /** The issuer's public key (hex). Reads the issuer's address history as well as the holder's, counts only a
   * mint the issuer signed, and honours the issuer's revokes: how a licence the issuer funded is found. */
  issuer?: string;
  /** The mint the app broadcast and is waiting to see; read only by licenceStatus. */
  pending?: MintPending;
  /** Defaults to DEFAULT_GRACE_MS. */
  graceMs?: number;
  /** The time now in milliseconds; defaults to Date.now. */
  now?: () => number;
  /** Keeps the raw transactions a check reads, so the next check reads only what is new (see TransactionCache). */
  txCache?: TransactionCache;
}

/**
 * Where an app keeps raw transactions between checks (IndexedDB, say). A transaction never changes, so a
 * kept one is good for ever; a copy that is not the transaction its txid names is read again, and a cache
 * that fails to read or to keep is passed over: the chain is the source of truth.
 */
export interface TransactionCache {
  get(txid: string): Promise<string | undefined> | string | undefined;
  set(txid: string, hex: string): Promise<void> | void;
}

/** The testnet address a License locked to this public key would show. */
export function addressForPublicKey(publicKeyHex: string): string {
  return PublicKey.fromString(publicKeyHex).toAddress(NETWORK);
}

function decodePayload(record: TypedRecordInTransaction): Record<string, unknown> | null {
  try {
    return JSON.parse(Utils.toUTF8(record.payloadBytes)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** The transactions one check reads, each read once: from those it has, else the app's cache, else the reader
 * (in bulk when it can, as the histories are long; one at a time for any the bulk read left out). */
class Transactions {
  private readonly known = new Map<string, string>();

  constructor(
    private readonly reader: ChainReader,
    private readonly cache: TransactionCache | undefined,
  ) {}

  async load(txids: readonly string[]): Promise<void> {
    const missing: string[] = [];
    for (const txid of new Set(txids)) {
      if (this.known.has(txid)) continue;
      const cached = await this.cached(txid);
      if (cached === undefined) missing.push(txid);
      else this.known.set(txid, cached);
    }
    if (missing.length > 1 && this.reader.getTransactionHexes) {
      // A bulk read that fails fails the check, as any read does: reading its txids one at a time instead
      // would ask a rate-limited WhatsOnChain twenty times more.
      const found = await this.reader.getTransactionHexes(missing);
      for (const txid of missing) {
        const hex = found.get(txid);
        if (hex) await this.keep(txid, hex);
      }
    }
    for (const txid of missing) {
      if (!this.known.has(txid)) await this.keep(txid, await this.reader.getTransactionHex(txid));
    }
  }

  async get(txid: string): Promise<string> {
    await this.load([txid]);
    return this.known.get(txid) as string;
  }

  private async cached(txid: string): Promise<string | undefined> {
    if (!this.cache) return undefined;
    try {
      const hex = await this.cache.get(txid);
      if (hex && Transaction.fromHex(hex).id('hex') === txid) return hex;
    } catch {
      // A cache that cannot be read, or a copy that does not parse, is read from the chain instead.
    }
    return undefined;
  }

  private async keep(txid: string, hex: string): Promise<void> {
    this.known.set(txid, hex);
    if (!this.cache) return;
    try {
      await this.cache.set(txid, hex);
    } catch {
      // Not kept: the next check reads it from the chain again.
    }
  }
}

/** Whether the transaction has an input unlocked by the issuer's key: a P2PKH scriptSig pushing that key and
 * spending an output P2PKH to it, so the network checked the signature (a key pushed over any other output
 * proves nothing). Postern backend's issuerCheck.signed. */
async function signedBy(txHex: string, issuerKeyHex: string, txs: Transactions): Promise<boolean> {
  const issuerHash = Hash.hash160(Utils.toArray(issuerKeyHex, 'hex'));
  const tx = Transaction.fromHex(txHex);
  for (const input of tx.inputs) {
    const chunks = input.unlockingScript?.chunks ?? [];
    const pushed = chunks.length === 2 ? chunks[1].data : undefined;
    if (!pushed || Utils.toHex(pushed) !== issuerKeyHex || input.sourceTXID === undefined) continue;
    const output = Transaction.fromHex(await txs.get(input.sourceTXID)).outputs[input.sourceOutputIndex ?? 0];
    const script = output?.lockingScript.toBinary();
    if (script?.length === 25 && script[0] === 0x76 && script[1] === 0xa9 && script[2] === 0x14 && script[23] === 0x88 && script[24] === 0xac) {
      if (Utils.toHex(script.slice(3, 23)) === Utils.toHex(issuerHash)) return true;
    }
  }
  return false;
}

/** The distinct transactions of an address's confirmed and unconfirmed history, in that order. */
async function historyOf(address: string, reader: ChainReader) {
  const [confirmed, unconfirmed] = await Promise.all([
    reader.getAddressHistory(address),
    reader.getUnconfirmedAddressHistory ? reader.getUnconfirmedAddressHistory(address) : Promise.resolve([]),
  ]);
  return [...confirmed, ...unconfirmed];
}

/** Every mint of the collections naming this address holder, and every origin a transfer or a revoke moved away. */
async function scan(address: string, collections: readonly string[], reader: ChainReader, issuerKeyHex?: string, txCache?: TransactionCache) {
  const issuerAddress = issuerKeyHex ? addressForPublicKey(issuerKeyHex) : undefined;
  const own = await historyOf(address, reader);
  const issuerHistory = !issuerAddress ? [] : issuerAddress === address ? own : await historyOf(issuerAddress, reader);
  const inIssuerHistory = new Set(issuerHistory.map((entry) => entry.txid));
  const seen = new Set<string>();
  const history = [...own, ...issuerHistory].filter((entry) => !seen.has(entry.txid) && seen.add(entry.txid));

  const txs = new Transactions(reader, txCache);
  await txs.load(history.map((entry) => entry.txid));
  const mints: FoundLicence[] = [];
  const transferred = new Set<string>();
  const revokes: { origin: string; txHex: string }[] = [];
  for (const entry of history) {
    const txHex = await txs.get(entry.txid);
    for (const record of findTypedRecords(txHex)) {
      if (record.recordType === 'W') {
        // The issuer's revoke: signed by the issuer and found in the issuer's own history. Who signed it is
        // checked below, and only for a revoke naming one of this holder's mints: no other can change the answer.
        if (!issuerKeyHex || !inIssuerHistory.has(entry.txid)) continue;
        const payload = decodePayload(record);
        if (payload?.kind !== 'revoke' || typeof payload.origin !== 'string') continue;
        revokes.push({ origin: payload.origin.toLowerCase(), txHex });
        continue;
      }
      const payload = decodePayload(record);
      if (!payload) continue;
      if (record.recordType === 'M' && typeof payload.collection === 'string' && typeof payload.holder === 'string') {
        if (!collections.includes(payload.collection) || payload.holder !== address) continue;
        if (issuerKeyHex && !(await signedBy(txHex, issuerKeyHex, txs))) continue;
        mints.push({ txid: entry.txid, vout: 0, collection: payload.collection });
      } else if (record.recordType === 'TR' && typeof payload.origin === 'string' && typeof payload.to === 'string') {
        transferred.add(payload.origin);
      }
    }
  }
  for (const mint of mints) {
    const origin = `${mint.txid}:${mint.vout}`;
    for (const revoke of revokes) {
      if (transferred.has(origin)) break;
      if (revoke.origin === origin && issuerKeyHex && (await signedBy(revoke.txHex, issuerKeyHex, txs))) transferred.add(origin);
    }
  }

  // The latest mint of each collection, in the order the collections were asked for.
  const latest = (live: boolean) => {
    const wanted = mints.filter((mint) => transferred.has(`${mint.txid}:${mint.vout}`) !== live);
    for (const collection of collections) {
      const found = wanted.filter((mint) => mint.collection === collection).at(-1);
      if (found) return found;
    }
    return null;
  };
  return { live: latest(true), moved: latest(false) };
}

const asList = (collection: string | readonly string[]): readonly string[] => (typeof collection === 'string' ? [collection] : collection);

/**
 * Walks the key's own address history for a mint record naming it holder of the collection, then
 * checks no later transfer record moves that origin away. `collection` may be a list in order of
 * preference (Postern counts 'postern' first and, in its transition, an older collection): a live
 * mint of an earlier one wins whatever their order in the history. Null when none is live. `options.issuer`
 * adds the issuer's history, for a licence the issuer funded (see the top of this file).
 */
export async function findLicence(
  publicKeyHex: string,
  collection: string | readonly string[],
  options: LicenceOptions = {},
): Promise<FoundLicence | null> {
  return findLicenceForAddress(addressForPublicKey(publicKeyHex), collection, options);
}

/** findLicence for a holder known by its testnet address (the name a mint record carries) rather than its public key. */
export async function findLicenceForAddress(
  address: string,
  collection: string | readonly string[],
  options: LicenceOptions = {},
): Promise<FoundLicence | null> {
  const reader = options.reader ?? new WhatsOnChainReader();
  return (await scan(address, asList(collection), reader, options.issuer?.toLowerCase(), options.txCache)).live;
}

/** Whether the key holds a mint in the collection with no later transfer. */
export async function hasLicence(publicKeyHex: string, collection: string | readonly string[], options: LicenceOptions = {}): Promise<boolean> {
  return (await findLicence(publicKeyHex, collection, options)) !== null;
}

/**
 * The richer answer: held (a live mint), indexing (none yet, but `pending` names a mint broadcast within
 * the grace period), revoked (a mint was moved away by a later transfer) or none. Held beats indexing
 * beats revoked, so someone who re-mints after a transfer sees their mint is on its way.
 */
export async function licenceStatus(
  publicKeyHex: string,
  collection: string | readonly string[],
  options: LicenceOptions = {},
): Promise<LicenceStatus> {
  const reader = options.reader ?? new WhatsOnChainReader();
  const now = (options.now ?? Date.now)();
  const checkedAt = new Date(now).toISOString();
  const { live, moved } = await scan(addressForPublicKey(publicKeyHex), asList(collection), reader, options.issuer?.toLowerCase(), options.txCache);

  if (live) return { state: 'held', outpoint: { txid: live.txid, vout: live.vout }, collection: live.collection, checkedAt };
  const { pending } = options;
  if (pending && now - Date.parse(pending.broadcastAt) <= (options.graceMs ?? DEFAULT_GRACE_MS)) {
    return { state: 'indexing', txid: pending.txid, broadcastAt: pending.broadcastAt, checkedAt };
  }
  if (moved) return { state: 'revoked', outpoint: { txid: moved.txid, vout: moved.vout }, collection: moved.collection, checkedAt };
  return { state: 'none', checkedAt };
}
