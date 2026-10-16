# Changelog: bsv-kit

Newest first. Breaking changes come first in a release, each with its migration in one sentence.

Each library keeps its own changelog; this one records the repo's releases (the tags) and points at them:

- [@bsv-kit/bsv](packages/bsv/CHANGELOG.md)
- [@bsv-kit/grist](packages/grist/CHANGELOG.md)
- [@bsv-kit/tips](packages/tips/CHANGELOG.md)
- [@bsv-kit/composer](packages/composer/CHANGELOG.md)
- [@bsv-kit/whats-new](packages/whats-new/CHANGELOG.md)
- [@bsv-kit/speech](packages/speech/CHANGELOG.md)
- [@bsv-kit/testing](packages/testing/CHANGELOG.md)

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
