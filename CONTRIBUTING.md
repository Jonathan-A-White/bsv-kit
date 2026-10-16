# Contributing to bsv-kit

bsv-kit is a set of small TypeScript libraries lifted from [Postern](https://github.com/Jonathan-A-White/postern). It is
MIT licensed. A change is welcome when it is small, has its test, and leaves the gate green.

## Build and test

Node 20 or later. From a clone:

```bash
npm ci --no-audit --no-fund && npm run lint && npm run typecheck && npm test && npm run build
```

All of it must pass before a change is proposed. `npm test` runs every package's tests (they need no network, apart from
`scripts/consumer-smoke.mjs`, which installs the repo into a scratch app and needs the network or a warm npm cache) and the
checks in `scripts/` (nothing personal in a tracked file, the README's Credits). The one Chromium test, in
`packages/testing/tests/playwright.test.ts`, skips with a note when Chromium will not launch;
`BSV_KIT_REQUIRE_CHROMIUM=1` makes that a failure. `npm run demo` serves the door demo under `examples/`.

[CLAUDE.md](CLAUDE.md) holds the layout of the repo and its conventions, and is the place to start.

## Proposing a change

1. Open an issue, or a pull request with the reason in its first lines. One change is one purpose: a fix, a feature, a
   document. Two purposes are two pull requests.
2. Branch from `main`. Commit in small steps, each with a plain sentence saying what changed.
3. Make the gate pass, then open the pull request. CI runs the same lint, typecheck, test and build jobs on it.

## What a change must bring

- **A test first.** Write the failing test, then the code that makes it pass. Tests live in each package's `tests/`. A
  test is never weakened or deleted to make a change pass.
- **A fixture from the producer, for a wire format.** The formats are Postern's, and Postern is the law: a change to what goes
  over the wire needs a fixture made by Postern's own code (see the scripts under `packages/*/scripts/`, which find
  Postern's checkout from `POSTERN_DIR`). Without one, the format does not change.
- **A credit, for a dependency.** A package, tool, font or data file added or removed changes its credit in the README in
  the same commit; the credits test checks this.
- **A changelog line.** A change to a package's behaviour adds an entry, newest first, to that package's `CHANGELOG.md`,
  with breaking changes first, and raises the package's version in its `package.json` and in `package-lock.json`.
- **Docs that match.** A new or changed call is in the package's README, with an example that runs.
- **The boundaries kept.** Each library stands alone. grist may use bsv only through its public exports, imported as
  `bsv-kit/bsv`; bsv imports nothing from grist; tips, composer, whats-new, speech and testing import nothing from the
  others. A dependency-rule test in each package says so. No UI and no DOM inside bsv, grist and tips.
- **Nothing personal.** No host name, home-directory path or full public key in a tracked file outside
  `tests/fixtures/` (`npm run check:personal`, part of `npm test`).
- **Strict TypeScript and ESM.** Relative imports end in `.js`; lint forbids explicit `any`.

## Releases

A release is a version in the packages' `package.json`, an entry in each changed package's changelog, an entry in the
root [CHANGELOG.md](CHANGELOG.md), and an annotated tag `vX.Y.Z` on the commit. Apps install by tag or by full commit SHA
(`npm install github:Jonathan-A-White/bsv-kit#vX.Y.Z`), never by branch.
