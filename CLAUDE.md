# CLAUDE.md

Development guide for AI assistants (Builders) working on bsv-kit.

## Gate command

```bash
npm ci --no-audit --no-fund && npm run lint && npm run typecheck && npm test && npm run build
```

All must pass clean before a story is done. Node 20+. A fresh worktree needs `npm ci`.

## Layout

```
packages/bsv/     @bsv-kit/bsv: vault, door, licence (runtime dependencies: @bsv/sdk, @scure/bip39)
packages/grist/   @bsv-kit/grist: send grist, poll the answer (imports bsv as 'bsv-kit/bsv', the name a consumer resolves)
packages/tips/    @bsv-kit/tips: one-time tips, which one to show now, dismissed for good (injected storage; imports nothing from bsv or grist)
packages/composer/  @bsv-kit/composer: Postern's message composer, a React component (the one UI library; peers react, react-dom;
                    imports nothing from bsv, grist or tips: packages/composer/tests/dependency-rule.test.ts). Its own
                    tsconfig.json (DOM lib, jsx) typechecks it; the root tsconfig.json excludes it. styles.css is copied to dist by the build.
  each: package.json, src/, tests/, README.md, tsconfig.build.json
tsconfig.base.json  strict settings shared by all
tsconfig.json       typecheck of src + tests, composer excepted (grist's 'bsv-kit/bsv' resolves to bsv's source; so does vitest)
examples/door-demo/  Vite page (workspace, not packed) that makes a key, checks a licence and sends a grist; npm run demo
scripts/check-personal.mjs  fails on a personal host, home path or public key in a tracked file (npm run check:personal)
scripts/credits.mjs  the README's Credits check: opens with Newton's line, every credit has a link-text name and a licence link, every package.json dependency is credited, every credit has a `Kind:`, a `Kind: package.` credit fails once that package is no longer a dependency, and every bundled font or data file is named by a font or data credit (adding or removing a source changes its credit in the same commit)
scripts/consumer-smoke.mjs  installs bsv-kit from a fresh clone into a scratch app (npm run smoke; npm test runs it)
vitest.config.ts    runs packages/*/tests and examples/*/tests (aliases bsv-kit/bsv, grist, tips and composer to source); a .tsx test
                    that needs a page says so on its first line: // @vitest-environment jsdom
```

The root package `bsv-kit` has the entry points `bsv-kit/bsv`, `bsv-kit/grist`, `bsv-kit/tips`, `bsv-kit/composer` (and
`bsv-kit/composer/styles.css`) and `bsv-kit/testing` (the
grist tests' fake Postern, test-only, `packages/grist/src/testing.ts`); its `exports`
point at each package's `dist`, and `prepare` runs the build (bsv first), so installing from
GitHub by commit (or by tag, once one exists) works.

## Conventions

- Formats are Postern's: never change a wire format without a fixture from Postern. The code is
  lifted from Postern's src/services.
- One repo, four separate libraries (tips and composer stand alone: `packages/tips/tests/dependency-rule.test.ts`). grist may use bsv only through its public exports; bsv imports
  nothing from grist (`packages/bsv/tests/dependency-rule.test.ts`). An app must be able to import
  bsv alone.
- No UI and no DOM (`window`, `document`, `navigator`) inside bsv, grist and tips; the example page lives
  under `examples/`. The composer is the one UI library: React and the DOM live there and nowhere else, and it
  is styled only through `bk-composer__*` classes and `--bk-composer-*` custom properties.
- TypeScript strict, ESM (NodeNext: relative imports end in `.js`). Lint forbids explicit `any`.
- Test-first: write the failing test before the code that makes it pass. Tests live in each
  package's `tests/`.
- Nothing personal in tracked files: no owner's host name, no home-directory path, no full public key
  outside `tests/fixtures/` (`npm run check:personal`, part of `npm test`; `scripts/check-personal.mjs`).
  The demo takes its backend from `DEMO_BACKEND` and its issuer from the page or `DEMO_ISSUER`.
- The Postern fixture scripts under `packages/*/scripts/` find Postern's checkout from `POSTERN_DIR`, or
  the directory they are run from.
- Do not change `.github/workflows/` unless the story says so.
- Every epic ends with a demo story (label demo) that closes on the Governor's 'Looks good'.

## Install notes

- `npm install github:Jonathan-A-White/bsv-kit#<commit-or-tag>` installs the devDependencies, runs `prepare`
  and packs `packages/*/dist/**`. (`files` needs `dist/**`: the folders are git-ignored, and npm
  skips a bare `dist` entry.)
- `npm install <path-to-a-clone>` links the clone and runs `prepare` there without installing
  anything, so the clone must have had `npm ci` first (the gate does that).
