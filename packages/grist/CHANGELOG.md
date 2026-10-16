# Changelog: @bsv-kit/grist

Newest first. Breaking changes come first in a release, each with its migration in one sentence.

## 0.2.0 (2026-10-16)

Everything since 0.1.0 (the v0.1.0 tag of 2026-10-09); the version number was raised on 2026-10-09 and the tag v0.2.0 is
made on 2026-10-16.

- Changed: the record payload cap is 20480 bytes (`MAX_PAYLOAD_BYTES`), double what it was, so a long spoken question and a
  receipt send (mw-5r3p30.343).
- New: audio attachments (`audio/webm`, `audio/ogg`, `audio/mp4`; a codec suffix is dropped), optional file names, and
  `sendGristRecord`, which returns `{ txid, seq, mill }`; `sendGrist` and photos are unchanged (mw-026yqg.4).
- New: `readAnswerPage` reads one page of answers from a cursor, for an app that polls on its own schedule; `awaitAnswer` is
  the loop built on it; an answer may carry `reading_result` (mw-026yqg.4).
- New: `bsv-kit/testing`, the fake Postern the grist tests use (`fakePostern`, `reply`), for an app's own tests; test-only
  (mw-026yqg.4).

## 0.1.0 (2026-10-09)

- New: `sendGrist` (photos sealed to the mill's key, the grist sealed to it in a BRC-78 envelope and posted) and
  `awaitAnswer` (pages the mill's answers until the one for the txid arrives; `refused` and `failed` resolve too), with
  `decryptAnswer`. Imports bsv as `bsv-kit/bsv`.
