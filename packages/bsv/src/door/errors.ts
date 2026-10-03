// The door's typed failures. Lifted from Postern's src/services/apiAuth.ts, unchanged in meaning.

/** An /api call the backend did not answer in time. `sent` is whether the
 * request itself (not just its challenge) went out and could have been acted on
 * (a POST): then the outcome is unknown, otherwise nothing was done. */
export class ApiTimeoutError extends Error {
  readonly sent: boolean;
  constructor(sent: boolean) {
    super('The backend did not answer in time.');
    this.sent = sent;
    this.name = 'ApiTimeoutError';
  }
}

/** The backend, or the proxy in front of it, did not answer a call as a working backend does
 * (no connection, no sign-in code): the call can be retried by another way. */
export class BackendUnreachableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'BackendUnreachableError';
  }
}

/** The backend answered and said no, with its own words and HTTP status. A 4xx (other than 408 and
 * 429) is a permanent refusal: sending the same thing again gets the same answer. */
export class RefusedError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'RefusedError';
  }
}

/** The message of the RefusedError for a 401 that says no licence is held. */
export const LICENCE_REQUIRED = 'Licence required';

/** This key holds no licence: the one signal an app needs to offer the licence screen. */
export class NoLicenceError extends Error {
  constructor() {
    super('This key holds no Postern licence.');
    this.name = 'NoLicenceError';
  }
}

/** Whether `err` is the backend refusing for good: a 4xx other than a request timeout (408) or too many requests (429).
 * A lost connection, a timeout, a gateway error and any 5xx are not: they are tried again, in their place. */
export function isPermanentRefusal(err: unknown): err is RefusedError {
  return err instanceof RefusedError && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429;
}
