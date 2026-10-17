# bsv-kit

Shared TypeScript libraries for the Governor's PWAs, lifted from the working code in
[Postern](https://github.com/Jonathan-A-White/postern). One repo, two separate libraries:

- `@bsv-kit/bsv`: key vault, door client for signed Postern API calls, licence check.
- `@bsv-kit/grist`: send grist with photos and recordings, poll the mill's answer (and a one-page read
  for apps that keep their own cursor). It may use bsv only
  through bsv's public exports; bsv imports nothing from grist, so an app can use bsv alone. Its `bsv-kit/testing` entry is a
  fake Postern for an app's tests.

No UI and no DOM live in either. The example page lives under `examples/` (see
[examples/door-demo](examples/door-demo/README.md); `npm run demo` serves it).

bsv-kit is for what cannot work without a BSV key. The libraries that used to sit beside them moved out at 1.0.0: the
message composer, the read-aloud engine and the speech and microphone test fakes to
[voice-kit](https://github.com/Jonathan-A-White/voice-kit), What's new and the one-time tips to
[pwa-kit](https://github.com/Jonathan-A-White/pwa-kit). The [CHANGELOG](CHANGELOG.md) says where each went.

## Install

From GitHub, by tag (there is no registry). The latest is `v1.0.0`; `prepare` builds the libraries on install. An app
pins a tag or a full commit SHA, never a branch:

```bash
npm install github:Jonathan-A-White/bsv-kit#v1.0.0
```

npm 11 warns that `bsv-kit` has an install script (`prepare`, the build) not yet covered by
`allowScripts`. Allow it with `npm install-scripts approve bsv-kit`, which adds an entry to your
`package.json` keyed by the install line, for example:

```json
"allowScripts": { "github:Jonathan-A-White/bsv-kit#v1.0.0": true }
```

```ts
import { vault, door, licence } from 'bsv-kit/bsv';
import { grist } from 'bsv-kit/grist';
import { fakePostern } from 'bsv-kit/testing'; // in tests only: a fake Postern behind a fetch
```

## Modules

Postern's wire formats are the law; each module is lifted from the Postern file named here.

| Entry point      | Namespace | What it is                                   | Postern source (`src/services/`)               |
| ---------------- | --------- | -------------------------------------------- | ---------------------------------------------- |
| `bsv-kit/bsv`    | `vault`   | the BSV key, wrapped at rest, unlocked a day | `vault.ts`, `keySession.ts`, `session.ts`      |
| `bsv-kit/bsv`    | `door`    | challenge-signed `/api` calls                | `apiAuth.ts`                                   |
| `bsv-kit/bsv`    | `licence` | does a key hold a License token              | `licence.ts`                                   |
| `bsv-kit/grist`  | `grist`   | send grist with photos, poll the answer      | `send.ts`, `attachments.ts`, `talk.ts`         |
| `bsv-kit/testing`| `fakePostern` | TEST-ONLY fake backend for an app's tests | (the grist tests' own fake)                    |

## Credits

> "If I have seen further it is by standing on the shoulders of Giants."
> Isaac Newton, letter to Robert Hooke, 1675

bsv-kit stands on the work below. Each credit gives what it is used for, its licence and any changes made. None of it is
changed by us: we use each as published.

A source added or removed changes its credit in the same commit, and the credits test says so: each credit ends with its
`Kind:` (package, tool, service, idea, font or data); a package credit fails when that package is no longer in a package.json,
and every bundled font or data file must be named in backticks by a font or data credit.

Runtime libraries (installed with the libraries):

- [@bsv/sdk](https://github.com/bsv-blockchain/ts-stack/tree/main/packages/sdk): the BSV TypeScript SDK; keys, signatures, transactions and
  the token checks behind the key vault, the door's signed calls and the licence check in `@bsv-kit/bsv` and `@bsv-kit/grist`.
  Licence: [Open BSV License version 4](https://github.com/bsv-blockchain/ts-stack/blob/main/packages/sdk/LICENSE.txt). No changes. Kind: package.
- [@scure/bip39](https://github.com/paulmillr/scure-bip39): BIP-39 recovery words for the key vault in `@bsv-kit/bsv`, by
  Paul Miller. Licence: [MIT](https://github.com/paulmillr/scure-bip39/blob/main/LICENSE). No changes. Kind: package.

Outside services:

- [WhatsOnChain](https://whatsonchain.com): the block explorer API that the licence check reads transactions from. Licence:
  [terms of use](https://whatsonchain.com/terms-of-use) of its public API. Nothing is copied from it. Kind: service.

Tools used to build and test (not installed by apps):

- [TypeScript](https://github.com/microsoft/TypeScript): the language and compiler. Licence:
  [Apache-2.0](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt). No changes. Kind: package.
- [Vitest](https://vitest.dev): runs the tests. Licence: [MIT](https://github.com/vitest-dev/vitest/blob/main/LICENSE). No changes. Kind: package.
- [ESLint](https://eslint.org): the linter. Licence: [MIT](https://github.com/eslint/eslint/blob/main/LICENSE). No changes. Kind: package.
- [Vite](https://vite.dev): serves and builds the example page under `examples/`. Licence:
  [MIT](https://github.com/vitejs/vite/blob/main/LICENSE). No changes. Kind: package.

Projects and ideas we took:

- [Postern](https://github.com/Jonathan-A-White/postern): the code and wire formats here are lifted from Postern's working code, which is
  the law for them. Licence: [MIT](https://github.com/Jonathan-A-White/postern/blob/main/LICENSE). Adapted into separate libraries with
  no UI, no DOM and injected storage. Kind: idea.
- [Beads](https://github.com/steveyegge/beads): Steve Yegge's issue tracker for AI agents; the work on this repo is tracked in it.
  Licence: [MIT](https://github.com/steveyegge/beads/blob/main/LICENSE). Used as published. Kind: tool.
- [Gas Town](https://github.com/steveyegge/gastown): Steve Yegge's idea of a factory of coordinating agent roles, which shaped how
  this repo is built. Licence: [MIT](https://github.com/steveyegge/gastown/blob/main/LICENSE). We took the idea, not its code. Kind: idea.
- [Claude Code](https://www.anthropic.com/claude-code): Anthropic's coding agent, which writes the code in this repo under the
  Governor's direction. Licence: [commercial terms](https://www.anthropic.com/legal/commercial-terms). Used as a tool. Kind: tool.

## Develop

```bash
npm ci --no-audit --no-fund && npm run lint && npm run typecheck && npm test && npm run build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to propose a change, [CLAUDE.md](CLAUDE.md) for conventions and
[CHANGELOG.md](CHANGELOG.md) for what each release changed. MIT licensed.
