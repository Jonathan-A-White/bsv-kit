// who is who: the backend says which key is the caller's and which is the Mayor's, and which of
// the protocol's v2 features it serves. Lifted from Postern's src/services/me.ts (fetchMe); pinning
// the Mayor's key is the app's to do, so it is not here. An old backend that has no /api/me is
// "legacy".
import type { Door } from './door.js';
import { LICENCE_REQUIRED, NoLicenceError, RefusedError } from './errors.js';

export type Feature = 'direct' | 'events' | 'view' | 'beads' | 'me';

/** A collection a cockpit key may issue licences in; `app` names the app it opens the grist door to. */
export interface MeCollection {
  name: string;
  app?: string;
}

export interface Me {
  pubkey: string;
  mayor: string;
  network: string;
  features: Feature[];
  /** A cockpit key only: absent for an app key or an older backend. */
  collections?: MeCollection[];
}

export const LEGACY: Me = { pubkey: '', mayor: '', network: 'testnet', features: [] };

function readCollection(raw: unknown): MeCollection[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const { name, app } = raw as { name?: unknown; app?: unknown };
  if (typeof name !== 'string' || !name) return [];
  return [typeof app === 'string' && app ? { name, app } : { name }];
}

/** GET /api/me. Resolves LEGACY for a backend that predates it (404/405), and throws
 * NoLicenceError for a 401 that says no licence is held. */
export async function fetchMe(door: Door): Promise<Me> {
  let response: Response;
  try {
    response = await door.fetch('/me');
  } catch (err) {
    if (err instanceof RefusedError && err.message === LICENCE_REQUIRED) throw new NoLicenceError();
    throw err;
  }
  if (response.status === 404 || response.status === 405) return LEGACY;
  if (!response.ok) throw new Error(`The backend answered ${response.status} to /api/me.`);
  const body = (await response.json()) as Partial<Me>;
  return {
    pubkey: typeof body.pubkey === 'string' ? body.pubkey : '',
    mayor: typeof body.mayor === 'string' ? body.mayor : '',
    network: typeof body.network === 'string' ? body.network : 'testnet',
    features: Array.isArray(body.features) ? (body.features.filter((f) => typeof f === 'string') as Feature[]) : [],
    ...(Array.isArray(body.collections) ? { collections: body.collections.flatMap(readCollection) } : {}),
  };
}
