// The typed failures of grist. The backend's own failures (RefusedError, BackendUnreachableError,
// ApiTimeoutError) are bsv's door errors, passed through as they are.

/** The grist or a photo is not one the mill takes; nothing was uploaded or sent. */
export class GristInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GristInputError';
  }
}

/** The caller's signal stopped a wait for an answer. Its name is 'AbortError', as an aborted fetch's is. */
export class AwaitAbortedError extends Error {
  constructor() {
    super('Waiting for the answer was stopped.');
    this.name = 'AbortError';
  }
}
