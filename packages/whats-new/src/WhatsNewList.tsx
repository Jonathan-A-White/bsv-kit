// WhatsNewList: every version, its date and its lines, for Settings or About.
import { useMemo } from 'react';
import { versionsSince, type ChangelogEntry } from './changelog.js';
import { DEFAULT_LABELS, type WhatsNewLabels } from './labels.js';
import { VersionGroups } from './VersionGroups.js';

export interface WhatsNewListProps {
  /** The app's changelog (useChangelog); null while it loads. */
  entries: readonly ChangelogEntry[] | null;
  labels?: Partial<WhatsNewLabels>;
  className?: string;
}

export function WhatsNewList({ entries, labels, className }: WhatsNewListProps) {
  const words = { ...DEFAULT_LABELS, ...labels };
  const groups = useMemo(() => versionsSince(entries ?? []), [entries]);
  return (
    <div className={className ? `bk-whats-new ${className}` : 'bk-whats-new'}>
      {groups.length === 0 ? <p className="bk-whats-new__empty">{words.empty}</p> : <VersionGroups groups={groups} labels={words} />}
    </div>
  );
}
