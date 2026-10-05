// The real ChainReader: WhatsOnChain's REST API. Lifted from spell-forge-bsv's WhatsOnChainProvider
// (the read methods), with fetch, the base URL and the delay as inputs; the URLs, the pacing and the
// retries are its own (tests/fixtures/postern-licence.json is what it did).
import type { AddressHistoryEntry, ChainReader } from './reader.js';

/** Postern's chainConfig.providerBaseUrl: the testnet. */
export const WOC_TESTNET_URL = 'https://api.whatsonchain.com/v1/bsv/test';

const MAX_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 500;
const MAX_ERROR_BODY_CHARS = 200;
// Postern's issue.ts MAX_HISTORY_PAGES: 50 pages of 100 transactions.
const MAX_HISTORY_PAGES = 50;
// WhatsOnChain rate-limits at 3 requests/s per IP without a key, and its 429 carries no CORS header, so a
// browser sees a rejected fetch rather than a status. Every request is paced this far apart.
const MIN_REQUEST_SPACING_MS = 350;
// Its /tx/{txid}/hex index lags a few seconds behind its address indexes after a broadcast: a 404 is retried.
const TX_HEX_NOT_FOUND_RETRY_DELAY_MS = 1000;
const TX_HEX_NOT_FOUND_RETRY_TIMEOUT_MS = 15000;
const TX_HEX_NOT_FOUND_MAX_ATTEMPTS = Math.ceil(TX_HEX_NOT_FOUND_RETRY_TIMEOUT_MS / TX_HEX_NOT_FOUND_RETRY_DELAY_MS);

/** A failed WhatsOnChain call; `status` is the HTTP status when there was one. */
export class ChainError extends Error {
  readonly status?: number;
  constructor(message: string, options?: { status?: number; cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ChainError';
    this.status = options?.status;
  }
}

export interface WhatsOnChainReaderOptions {
  /** Defaults to WOC_TESTNET_URL. */
  baseUrl?: string;
  /** Defaults to the global fetch. */
  fetch?: typeof fetch;
  /** Waits that many milliseconds; defaults to a timer. Tests pass one that returns at once. */
  delay?: (ms: number) => Promise<void>;
}

interface HistoryRow {
  tx_hash: string;
  height: number;
}

const timerDelay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export class WhatsOnChainReader implements ChainReader {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly delay: (ms: number) => Promise<void>;
  private requestGate: Promise<void> = Promise.resolve();
  private hasSentRequest = false;

  constructor(options: WhatsOnChainReaderOptions = {}) {
    this.baseUrl = (options.baseUrl ?? WOC_TESTNET_URL).replace(/\/+$/, '');
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
    this.delay = options.delay ?? timerDelay;
  }

  /** Serialises dispatch across this reader's requests so no two fire closer than MIN_REQUEST_SPACING_MS.
   * Called once per public method, not per retry: the retries already wait longer. */
  private async waitForRequestSlot(): Promise<void> {
    const myTurn = this.requestGate.then(async () => {
      if (this.hasSentRequest) await this.delay(MIN_REQUEST_SPACING_MS);
      this.hasSentRequest = true;
    });
    this.requestGate = myTurn;
    await myTurn;
  }

  /** The whole confirmed history, oldest first. WhatsOnChain's plain /history holds only the newest 100
   * transactions, so this pages /confirmed/history by nextPageToken (newest page first), as Postern's
   * issue.ts does. Past MAX_HISTORY_PAGES it throws: a list missing its oldest pages could read as a key
   * that never minted. */
  async getAddressHistory(address: string): Promise<AddressHistoryEntry[]> {
    const path = `/address/${address.trim()}/confirmed/history`;
    const pages: HistoryRow[][] = [];
    let token = '';
    for (;;) {
      if (pages.length === MAX_HISTORY_PAGES) {
        throw new ChainError(`The history of ${address.trim()} runs past ${MAX_HISTORY_PAGES} pages, more than can be read here.`);
      }
      await this.waitForRequestSlot();
      let page: { rows: HistoryRow[]; nextPageToken?: string };
      try {
        page = await this.historyPage(path, token);
      } catch (error) {
        // WhatsOnChain answers a 404 on the first page for an address it has never seen: no history, as
        // Postern's confirmedHistory.ts reads it. A 404 on a later page stays an error.
        if (pages.length === 0 && error instanceof ChainError && error.status === 404) return [];
        throw error;
      }
      pages.push(page.rows);
      if (!page.nextPageToken) break;
      token = page.nextPageToken;
    }
    return pages
      .reverse()
      .flat()
      .map((row) => ({ txid: row.tx_hash, height: row.height }))
      .sort((a, b) => (a.height ?? 0) - (b.height ?? 0));
  }

  private async historyPage(path: string, token: string): Promise<{ rows: HistoryRow[]; nextPageToken?: string }> {
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    const body = (await (await this.request(`${path}${query}`)).json()) as unknown;
    if (Array.isArray(body)) return { rows: body as HistoryRow[] };
    const page = body as { result?: unknown; nextPageToken?: unknown; error?: unknown } | null;
    if (page && typeof page.error === 'string' && page.error) {
      throw new ChainError(`WhatsOnChain could not read the history: ${page.error}`);
    }
    const nextPageToken = typeof page?.nextPageToken === 'string' ? page.nextPageToken : undefined;
    if (page && Array.isArray(page.result)) return { rows: page.result as HistoryRow[], nextPageToken };
    if (page && 'result' in page && page.result === null) return { rows: [], nextPageToken };
    throw new ChainError(`WhatsOnChain ${path} returned an unexpected response shape: ${JSON.stringify(body).slice(0, MAX_ERROR_BODY_CHARS)}`);
  }

  getUnconfirmedAddressHistory(address: string): Promise<AddressHistoryEntry[]> {
    return this.history(`/address/${address.trim()}/unconfirmed/history`);
  }

  private async history(path: string): Promise<AddressHistoryEntry[]> {
    await this.waitForRequestSlot();
    const body = (await (await this.request(path)).json()) as unknown;
    return this.expectArray(path, body).map((row) => ({ txid: row.tx_hash, height: row.height }));
  }

  /** WhatsOnChain answers most lists with a bare array but wraps the unconfirmed history in
   * `{ address, script, result, error }`. Accept either, and name the endpoint for anything else. */
  private expectArray(path: string, body: unknown): HistoryRow[] {
    if (Array.isArray(body)) return body as HistoryRow[];
    const wrapped = (body as { result?: unknown } | null)?.result;
    if (Array.isArray(wrapped)) return wrapped as HistoryRow[];
    throw new ChainError(`WhatsOnChain ${path} returned an unexpected response shape: ${JSON.stringify(body).slice(0, MAX_ERROR_BODY_CHARS)}`);
  }

  async getTransactionHex(txid: string): Promise<string> {
    await this.waitForRequestSlot();
    const path = `/tx/${txid.trim()}/hex`;
    for (let attempt = 1; ; attempt++) {
      try {
        return (await (await this.request(path)).text()).trim();
      } catch (error) {
        const retryable = error instanceof ChainError && error.status === 404;
        if (!retryable || attempt >= TX_HEX_NOT_FOUND_MAX_ATTEMPTS) throw error;
        await this.delay(TX_HEX_NOT_FOUND_RETRY_DELAY_MS);
      }
    }
  }

  private async request(path: string): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    let retryDelayMs = INITIAL_RETRY_DELAY_MS;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let response: Response;
      try {
        response = await this.fetchImpl(url);
      } catch (error) {
        // A rejected fetch cannot be told from a 429 here (see MIN_REQUEST_SPACING_MS): retry it the same way.
        if (attempt === MAX_ATTEMPTS) {
          throw new ChainError('Could not reach WhatsOnChain after 3 tries (offline, or rate-limited: its 429 reply carries no CORS header)', { cause: error });
        }
        await this.delay(retryDelayMs);
        retryDelayMs *= 2;
        continue;
      }
      if (response.status === 429) {
        if (attempt === MAX_ATTEMPTS) throw new ChainError('WhatsOnChain rate-limited the request (429) after retries', { status: 429 });
        await this.delay(retryDelayMs);
        retryDelayMs *= 2;
        continue;
      }
      if (!response.ok) {
        const bodyText = (await response.text()).trim().slice(0, MAX_ERROR_BODY_CHARS);
        throw new ChainError(`WhatsOnChain said ${response.status}${bodyText ? `: ${bodyText}` : ''}`, { status: response.status });
      }
      return response;
    }
    throw new ChainError('WhatsOnChain rate-limited the request (429) after retries', { status: 429 });
  }
}
