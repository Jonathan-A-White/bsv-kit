# Changelog: @bsv-kit/whats-new

Newest first. Breaking changes come first in a release, each with its migration in one sentence.

## 0.1.1 (2026-10-10)

- Fixed: Check for updates no longer says "Up to date" when nothing was checked (mw-s061bg.12). Offline
  (`navigator.onLine` false), or when the worker's script cannot be fetched from the server, it says "Couldn't check"
  and the button tries again; with no service worker to ask it says "Updates are not checked here" (new label
  `unavailable`). New optional `fetch` prop and `UpdateRegistration.active`. "Up to date" now needs the server to have answered.

## 0.1.0 (2026-10-09)

- New: `useChangelog`, `summarise`, `UpdateSummary`, `WhatsNewSheet`, `WhatsNewList`, `CheckForUpdates` and
  `versionLink`: the Update ready banner's summary, a one-time What's new sheet after an update (never on a first
  install), the versions list for About, a Check for updates button, and the link from the version to
  `CHANGELOG.md` on GitHub (mw-s061bg.2). Themed by `--bk-whats-new-*` and `bk-whats-new__*` classes
  (`bsv-kit/whats-new/styles.css`).
