// The door client: signed Postern API calls. Lifted from Postern's src/services/apiAuth.ts and
// me.ts; the backend URL, the key and the fetch are inputs. No UI, no DOM.
export { Door, NONCE_SHAPE } from './door.js';
export type { DoorOptions } from './door.js';
export { ApiTimeoutError, BackendUnreachableError, LICENCE_REQUIRED, NoLicenceError, RefusedError, isPermanentRefusal } from './errors.js';
export { API_TIMEOUT_MS, withTimeout } from './timeout.js';
export { LEGACY } from './me.js';
export type { Feature, Me, MeCollection } from './me.js';
