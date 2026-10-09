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
  each: package.json, src/, tests/, README.md, tsconfig.build.json
tsconfig.base.json  strict settings shared by all
tsconfig.json       typecheck of src + tests (grist's 'bsv-kit/bsv' resolves to bsv's source; so does vitest)
examples/door-demo/  Vite page (workspace, not packed) that makes a key, checks a licence and sends a grist; npm run demo
scripts/check-personal.mjs  fails on a personal host, home path or public key in a tracked file (npm run check:personal)
scripts/consumer-smoke.mjs  installs bsv-kit from a fresh clone into a scratch app (npm run smoke; npm test runs it)
vitest.config.ts    runs packages/*/tests and examples/*/tests (aliases bsv-kit/bsv, bsv-kit/grist and bsv-kit/tips to source)
```

The root package `bsv-kit` has the entry points `bsv-kit/bsv`, `bsv-kit/grist`, `bsv-kit/tips` and `bsv-kit/testing` (the
grist tests' fake Postern, test-only, `packages/grist/src/testing.ts`); its `exports`
point at each package's `dist`, and `prepare` runs the build (bsv first), so installing from
GitHub by commit (or by tag, once one exists) works.

## Conventions

- Formats are Postern's: never change a wire format without a fixture from Postern. The code is
  lifted from Postern's src/services.
- One repo, three separate libraries (tips stands alone: `packages/tips/tests/dependency-rule.test.ts`). grist may use bsv only through its public exports; bsv imports
  nothing from grist (`packages/bsv/tests/dependency-rule.test.ts`). An app must be able to import
  bsv alone.
- No UI and no DOM (`window`, `document`, `navigator`) inside the libraries; the example page lives
  under `examples/`.
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
