// Every /api call times out. Lifted from Postern's src/services/apiAuth.ts.
import { ApiTimeoutError, BackendUnreachableError } from './errors.js';

/** How long any /api call may go unanswered before it is given up on: one
 * number for the challenge, the blob upload, the message post and the rest. */
export const API_TIMEOUT_MS = 30_000;

/** Settles like `work`, or rejects with an ApiTimeoutError once `ms` have passed.
 * `onTimeout` (an abort) runs after the rejection is issued: aborting a fetch
 * rejects it at once with the browser's AbortError, which must not win the race. */
export function withTimeout<T>(work: Promise<T>, sent: boolean, ms = API_TIMEOUT_MS, onTimeout?: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new ApiTimeoutError(sent));
      onTimeout?.();
    }, ms);
  });
  return Promise.race([work, expired]).finally(() => clearTimeout(timer));
}

/** One fetch that is aborted, and rejected with an ApiTimeoutError, if no
 * response arrives in time. A caller's own signal still aborts it. The timer
 * stops when the response's headers arrive, so a long-lived stream is not cut.
 * A fetch that fails to connect (a TypeError, as fetch rejects) is a
 * BackendUnreachableError; the caller's own abort passes through as it is. */
export function fetchWithin(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit | undefined,
  sent: boolean,
  ms = API_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const caller = init?.signal;
  if (caller) {
    if (caller.aborted) controller.abort(caller.reason);
    else caller.addEventListener('abort', () => controller.abort(caller.reason), { once: true });
  }
  const work = Promise.resolve(fetchImpl(url, { ...init, signal: controller.signal })).catch((err: unknown) => {
    if (err instanceof TypeError) throw new BackendUnreachableError('The backend could not be reached. Try again in a moment.', { cause: err });
    throw err;
  });
  return withTimeout(work, sent, ms, () => controller.abort());
}
