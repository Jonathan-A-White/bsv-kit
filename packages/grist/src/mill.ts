// The mill key comes from GET /api/me (docs/protocol.md section 19: an app pins it, trust on first use).
import type { door } from 'bsv-kit/bsv';

type Door = InstanceType<typeof door.Door>;

/** The mill's public key as the backend names it, or an Error when it names none. */
export async function fetchMill(d: Door): Promise<string> {
  const response = await d.fetch('/me');
  if (!response.ok) throw new Error(`The backend answered ${response.status} to /api/me.`);
  const body = (await response.json()) as { mill?: unknown };
  const mill = typeof body.mill === 'string' ? body.mill.trim() : '';
  if (!mill) throw new Error('The backend names no mill key (POSTERN_MILL_KEY), so there is nowhere to send a grist.');
  return mill;
}
