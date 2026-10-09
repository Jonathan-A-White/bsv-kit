// A tips list, "which tip to show now" and "dismissed for good", kept through a storage the app injects.
// The app draws the tip; this only decides which one and remembers the dismissals.

/** One tip: a stable id, the words to show, and the app event that shows it. */
export interface Tip {
  /** Stable and unique within the list; the dismissal is remembered under it. */
  id: string;
  text: string;
  /** The app event that shows this tip, for example 'reader-opened'. Any string the app chooses. */
  event: string;
}

/** The storage the app injects: any getItem / setItem pair, sync or async (the browser's own key-value store fits as it is). */
export interface TipStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
}

export interface TipsOptions {
  tips: readonly Tip[];
  storage: TipStorage;
  /** The storage key the dismissed ids are kept under. Give each list its own when two share a storage. */
  key?: string;
}

export interface Tips {
  /** The first tip of `event`, in list order, that is not dismissed; null when there is none. It stays the answer until dismissed. */
  nextTip(event: string): Promise<Tip | null>;
  /** Dismiss a tip for good. Dismissing it again changes nothing. An id not in the list is a TipsError. */
  dismiss(id: string): Promise<void>;
  isDismissed(id: string): Promise<boolean>;
  /** Forget one dismissal, so the tip can show again. */
  reset(id: string): Promise<void>;
  /** Forget every dismissal. */
  resetAll(): Promise<void>;
}

export const DEFAULT_KEY = 'bsv-kit:tips:dismissed';

/** A bad tips list, or a dismissal of a tip that is not in it. */
export class TipsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TipsError';
  }
}

export function createTips(options: TipsOptions): Tips {
  const list: Tip[] = options.tips.map((t) => ({ id: t.id, text: t.text, event: t.event }));
  const { storage } = options;
  const key = options.key ?? DEFAULT_KEY;

  const seen = new Set<string>();
  for (const t of list) {
    if (typeof t.id !== 'string' || t.id.trim() === '') throw new TipsError('a tip needs a non-empty id');
    if (typeof t.text !== 'string' || t.text.trim() === '') throw new TipsError(`tip ${t.id} needs text`);
    if (typeof t.event !== 'string' || t.event.trim() === '') throw new TipsError(`tip ${t.id} needs an event`);
    if (seen.has(t.id)) throw new TipsError(`two tips have the id ${t.id}`);
    seen.add(t.id);
  }

  /** The dismissed ids; stored data that is not a JSON array of strings counts as nothing dismissed. */
  async function load(): Promise<string[]> {
    const raw = await storage.getItem(key);
    if (raw === null) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.every((v) => typeof v === 'string') ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }

  const save = async (ids: string[]): Promise<void> => {
    await storage.setItem(key, JSON.stringify(ids));
  };

  const known = (id: string): void => {
    if (!seen.has(id)) throw new TipsError(`no tip has the id ${id}`);
  };

  return {
    async nextTip(event) {
      const dismissed = new Set(await load());
      return list.find((t) => t.event === event && !dismissed.has(t.id)) ?? null;
    },
    async dismiss(id) {
      known(id);
      const ids = await load();
      if (!ids.includes(id)) await save([...ids, id]);
    },
    async isDismissed(id) {
      return (await load()).includes(id);
    },
    async reset(id) {
      const ids = await load();
      if (ids.includes(id)) await save(ids.filter((i) => i !== id));
    },
    async resetAll() {
      await save([]);
    },
  };
}
