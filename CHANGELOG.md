# Changelog: bsv-kit

Newest first. Breaking changes come first in a release, each with its migration in one sentence.

Each library keeps its own changelog; this one records the repo's releases (the tags) and points at them:

- [@bsv-kit/bsv](packages/bsv/CHANGELOG.md)
- [@bsv-kit/grist](packages/grist/CHANGELOG.md)

## v1.0.0 (2026-10-17)

bsv-kit keeps only what needs a BSV key: bsv and grist. Five libraries and the composer demo moved out, to the two new
repos, which hold their history from the commit they were lifted at (git log in this repo before v1.0.0 is their past).

- Changed (breaking, removed): `@bsv-kit/composer` (`bsv-kit/composer`, `bsv-kit/composer/styles.css`) moved to
  [voice-kit](https://github.com/Jonathan-A-White/voice-kit) as `voice-kit/composer`; so did the composer demo page.
- Changed (breaking, removed): `@bsv-kit/speech` (`bsv-kit/speech`, `bsv-kit/speech/react`, `bsv-kit/speech/styles.css`)
  moved to [voice-kit](https://github.com/Jonathan-A-White/voice-kit) as `voice-kit/speech`, `voice-kit/speech/react` and
  `voice-kit/speech/styles.css`.
- Changed (breaking, removed): `@bsv-kit/testing`'s speech and microphone fakes (`bsv-kit/testing/speech`,
  `bsv-kit/testing/mic`) moved to [voice-kit](https://github.com/Jonathan-A-White/voice-kit) as `voice-kit/testing/speech`
  and `voice-kit/testing/mic`. The package `packages/testing` is gone; `bsv-kit/testing`, grist's fake Postern, stays and
  is unchanged.
- Changed (breaking, removed): `@bsv-kit/whats-new` (`bsv-kit/whats-new`, `bsv-kit/whats-new/styles.css`) moved to
  [pwa-kit](https://github.com/Jonathan-A-White/pwa-kit) as `pwa-kit/whats-new`.
- Changed (breaking, removed): `@bsv-kit/tips` (`bsv-kit/tips`) moved to
  [pwa-kit](https://github.com/Jonathan-A-White/pwa-kit) as `pwa-kit/tips`.
- Migration, in one sentence: change the import's package name (`bsv-kit/composer` to `voice-kit/composer` and so on) and
  install voice-kit or pwa-kit by tag; an app pinned to an earlier bsv-kit tag or commit keeps every package that pin had.
- Changed: the React peer dependency and the React, jsdom, Testing Library and Playwright dev dependencies went with the
  libraries that used them; bsv and grist are unchanged (bsv 0.2.0, grist 0.2.0).
- Package versions at this tag: bsv 0.2.0, grist 0.2.0.

## v0.2.0 (2026-10-16)

- New: `@bsv-kit/tips`, `@bsv-kit/composer`, `@bsv-kit/whats-new`, `@bsv-kit/speech` and `@bsv-kit/testing`, with their
  entry points `bsv-kit/tips`, `bsv-kit/composer`, `bsv-kit/whats-new`, `bsv-kit/speech`, `bsv-kit/speech/react`,
  `bsv-kit/testing/speech` and `bsv-kit/testing/mic` (and the `styles.css` of the three UI libraries).
- Changed (breaking, bsv): the door signs Postern's v2 scheme and the v1 header is gone. See
  [bsv's changelog](packages/bsv/CHANGELOG.md).
- Changed: grist takes audio, names, `sendGristRecord` and `readAnswerPage`, and a payload of up to 20480 bytes; bsv reads
  licence transactions in bulk with an optional `txCache`. See [grist's](packages/grist/CHANGELOG.md) and
  [bsv's](packages/bsv/CHANGELOG.md).
- New: CONTRIBUTING.md, the changelogs, examples in bsv's and tips's READMEs, and a build job in CI.
- Package versions at this tag: bsv 0.2.0, grist 0.2.0, tips 0.2.0, composer 0.3.0, whats-new 0.1.2, speech 0.1.0,
  testing 0.1.0.

## v0.1.0 (2026-10-09)

- New: `@bsv-kit/bsv` (key vault, door client, licence check) and `@bsv-kit/grist` (send grist, poll the answer).
