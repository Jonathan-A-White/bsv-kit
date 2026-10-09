// WhatsNewSheet: shown once after the app starts on a version newer than the last one seen, listing every version
// since; closing it stores the version. Never on a first install (the version is simply remembered).
// The app can also open it itself, from the Update ready banner: pass `open`, `since` and `onClose`.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { compareVersions, versionsSince, type ChangelogEntry } from './changelog.js';
import { DEFAULT_LABELS, type WhatsNewLabels } from './labels.js';
import { pageStorage, readSeen, writeSeen, type StorageLike } from './storage.js';
import { VersionGroups } from './VersionGroups.js';

export interface WhatsNewSheetProps {
  /** The app's changelog (useChangelog); null while it loads. */
  entries: readonly ChangelogEntry[] | null;
  /** The version this build is. */
  version: string;
  /** The localStorage key the app names for the last version seen. */
  storageKey: string;
  /** Where the last version seen is kept. Default: the page's localStorage. */
  storage?: StorageLike;
  labels?: Partial<WhatsNewLabels>;
  /** The app opens the sheet itself (the banner's What's new). Then nothing is stored and `onClose` says when it is closed. */
  open?: boolean;
  /** With `open`: list the versions after this one (the version the app is running). Default: every version. */
  since?: string;
  onClose?: () => void;
  className?: string;
}

export function WhatsNewSheet({ entries, version, storageKey, storage, labels, open, since, onClose, className }: WhatsNewSheetProps) {
  const words = { ...DEFAULT_LABELS, ...labels };
  const controlled = open !== undefined;
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  // the last version seen, as the page had it when it started (undefined: not read yet)
  const [seen, setSeen] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (controlled) return;
    const store = storage ?? pageStorage();
    const stored = readSeen(store, storageKey);
    if (stored === null) {
      // a first install has nothing new to tell: remember where it starts
      writeSeen(store, storageKey, version);
      setSeen(version);
    } else {
      setSeen(stored);
    }
  }, [controlled, storage, storageKey, version]);

  const groups = useMemo(() => {
    if (!entries) return [];
    if (controlled) return open ? versionsSince(entries, since) : [];
    return seen && compareVersions(seen, version) < 0 ? versionsSince(entries, seen, version) : [];
  }, [entries, controlled, open, since, seen, version]);

  const markSeen = useCallback(() => {
    writeSeen(storage ?? pageStorage(), storageKey, version);
    setSeen(version);
  }, [storage, storageKey, version]);

  // the changelog says nothing about the versions since: remember the version without bothering him
  useEffect(() => {
    if (!controlled && entries && seen && compareVersions(seen, version) < 0 && groups.length === 0) markSeen();
  }, [controlled, entries, seen, version, groups.length, markSeen]);

  const shown = groups.length > 0;
  const close = useCallback(() => {
    if (controlled) onClose?.();
    else markSeen();
  }, [controlled, onClose, markSeen]);

  useEffect(() => {
    if (!shown) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shown, close]);

  if (!shown) return null;
  return (
    <div className="bk-whats-new__backdrop" onClick={close}>
      <div
        className={className ? `bk-whats-new bk-whats-new__sheet ${className}` : 'bk-whats-new bk-whats-new__sheet'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="bk-whats-new__title" id={titleId}>
          {words.title}
        </h2>
        <VersionGroups groups={groups} labels={words} />
        <button type="button" className="bk-whats-new__button bk-whats-new__close" ref={closeRef} onClick={close}>
          {words.close}
        </button>
      </div>
    </div>
  );
}
