// UpdateSummary: the Update ready banner's line, '0.5.9 · 1 new, 2 fixed · What's new', where What's new is a button
// that opens the sheet (the app passes `onOpen`, and shows WhatsNewSheet with `open`). Nothing when nothing is after `since`.
import { summarise, DEFAULT_SUMMARY_WORDS, type ChangelogEntry, type SummaryWords } from './changelog.js';

export interface UpdateSummaryProps {
  /** The waiting build's changelog (useChangelog, which reads it fresh). */
  entries: readonly ChangelogEntry[] | null;
  /** The version the app is running now. */
  since: string;
  onOpen: () => void;
  words?: Partial<SummaryWords>;
  className?: string;
}

export function UpdateSummary({ entries, since, onOpen, words, className }: UpdateSummaryProps) {
  const w = { ...DEFAULT_SUMMARY_WORDS, ...words };
  const summary = entries ? summarise(entries, since, w) : null;
  if (!summary) return null;
  return (
    <span className={className ? `bk-whats-new__summary ${className}` : 'bk-whats-new__summary'}>
      {summary.text} ·{' '}
      <button type="button" className="bk-whats-new__button bk-whats-new__link" onClick={onOpen}>
        {w.whatsNew}
      </button>
    </span>
  );
}
