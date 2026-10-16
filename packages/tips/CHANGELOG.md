# Changelog: @bsv-kit/tips

Newest first. Breaking changes come first in a release, each with its migration in one sentence.

## 0.2.0 (2026-10-16)

The first release: the package was added on 2026-10-09 at version 0.2.0 (the number the repo shared then), and the tag
v0.2.0 is made on 2026-10-16.

- New: `createTips` with `nextTip(event)`, `dismiss(id)`, `isDismissed`, `reset` and `resetAll`: a list of one-time tips, the
  first not yet dismissed shown, dismissed for good through a storage the app injects (sync or async). No DOM; imports
  nothing from bsv or grist (mw-5r3p30.81).
