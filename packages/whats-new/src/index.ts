// @bsv-kit/whats-new: every app's What's new as one React package.
export {
  DEFAULT_SUMMARY_WORDS,
  compareVersions,
  fetchChangelog,
  githubAnchor,
  parseChangelog,
  summarise,
  versionLink,
  versionsSince,
  type ChangeKind,
  type ChangelogEntry,
  type Summary,
  type SummaryWords,
  type VersionGroup,
  type VersionLinkOptions,
} from './changelog.js';
export { useChangelog } from './useChangelog.js';
export { WhatsNewSheet, type WhatsNewSheetProps } from './WhatsNewSheet.js';
export { WhatsNewList, type WhatsNewListProps } from './WhatsNewList.js';
export { UpdateSummary, type UpdateSummaryProps } from './UpdateSummary.js';
export { CheckForUpdates, type CheckForUpdatesProps, type UpdateRegistration, type UpdateWorker } from './CheckForUpdates.js';
export { DEFAULT_CHECK_LABELS, DEFAULT_LABELS, type CheckLabels, type WhatsNewLabels } from './labels.js';
export type { StorageLike } from './storage.js';
