// storage.ts: where the last version seen is kept. localStorage unless the app injects another; a storage that is
// missing or throws (private mode, a denied page) is treated as empty, never as a crash.

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The page's localStorage, or null where there is none. Looked up when called, never at import. */
export function pageStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readSeen(storage: StorageLike | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeSeen(storage: StorageLike | null, key: string, version: string): void {
  try {
    storage?.setItem(key, version);
  } catch {
    // nowhere to keep it: the sheet may show again, which is the harmless way to be wrong
  }
}
