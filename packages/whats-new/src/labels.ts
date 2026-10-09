// labels.ts: every word on the screen, replaceable by the app.

export interface WhatsNewLabels {
  /** The sheet's heading. */
  title: string;
  close: string;
  new: string;
  fixed: string;
  /** The list when there is no changelog. */
  empty: string;
}

export const DEFAULT_LABELS: WhatsNewLabels = {
  title: "What's new",
  close: 'Close',
  new: 'New',
  fixed: 'Fixed',
  empty: 'No changes listed yet.',
};

export interface CheckLabels {
  check: string;
  checking: string;
  upToDate: string;
  /** Shown beside the button when the app gave no `updateReady` of its own. */
  updateReady: string;
  failed: string;
}

export const DEFAULT_CHECK_LABELS: CheckLabels = {
  check: 'Check for updates',
  checking: 'Checking…',
  upToDate: 'Up to date',
  updateReady: 'Update ready',
  failed: "Couldn't check",
};
