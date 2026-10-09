// useChangelog: the app's changelog.json, read once from the base URL with cache 'no-store'. null while it loads,
// and for good when it cannot be read: a missing changelog hides What's new, it never breaks the app.
import { useEffect, useState } from 'react';
import { fetchChangelog, type ChangelogEntry } from './changelog.js';

export function useChangelog(baseUrl: string, fetchFn?: typeof fetch): ChangelogEntry[] | null {
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null);
  useEffect(() => {
    let current = true;
    fetchChangelog(baseUrl, fetchFn).then(
      (list) => {
        if (current) setEntries(list);
      },
      () => {},
    );
    return () => {
      current = false;
    };
  }, [baseUrl, fetchFn]);
  return entries;
}
