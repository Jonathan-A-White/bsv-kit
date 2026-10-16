# Splitting bsv-kit by domain

Story mw-6ww.122, written 2026-10-16. The Governor's words (Postern general, 2026-10-16 03:20-03:22Z): "bsv kit
should be bsv related libraries"; "pull out [components] into ... repos [that] actually make sense ... and then make
sure that the apps calling them get updated"; "follow the best practices of ... open source libraries ... everything
should have an MIT license and ... good documentation and ... the boundaries make sense"; "maybe even notes with ... how
to contribute".

This is a plan, not a move. Nothing in bsv-kit changes with it. Each move below is one story, one session, one rig.

## 1. What bsv-kit holds today, who imports it, and where each piece goes

Surveyed 2026-10-16 across every rig in the factory's config (`[rigs]`): the `bsv-kit` line in each app's
`package.json` and every `from 'bsv-kit/...'` / `import('bsv-kit/...')` / `import 'bsv-kit/.../styles.css'` under the
rig. Rigs with no bsv-kit line and no import: audible-kit, millwright, cairn, argus, night-stack, myshape, msb-audio,
rotator-cuff-pt, nac-service-media, fellowship, whisper-hid. The five importers all pin a full commit SHA, none a tag:

| App | Pin (short) | Entry points imported |
|---|---|---|
| legend | 87b9c42 | bsv, grist, tips, whats-new (+ whats-new/styles.css) |
| lampas | fec787f | bsv, grist, tips, composer (+ styles.css), speech, speech/react (+ styles.css), whats-new (+ styles.css), testing/mic, testing/speech |
| trade-tracker | fec787f | bsv, grist |
| spell-forge | 3016cfb | bsv, grist, speech, speech/react, testing (the fake Postern), testing/speech |
| postern | 6a22cfe | composer (+ styles.css), speech, speech/react (+ styles.css), whats-new (+ styles.css), testing/mic, testing/speech |

Postern imports none of bsv or grist: its `src/services` (vault.ts, licence.ts, deliver.ts and the rest) are the originals
bsv-kit was lifted from, and they stay the law for the wire formats. That is not a copy to remove in this plan.

### The packages and their new homes

Four repos, all public, all MIT, all under Jonathan-A-White, all installed by pinned commit from GitHub the way bsv-kit
is today: **bsv-kit** (keeps only what needs a BSV key), **voice-kit** (new: speaking and listening in the browser),
**pwa-kit** (new: what every installed web app shows about itself), **audible-kit** (new, already begun: the Audible
link and chapter times). Each row's reason is the boundary test: *what does the package need to exist?*

| Package (entry point) | Version | Imported by | Repo | Reason, in one line |
|---|---|---|---|---|
| @bsv-kit/bsv (`bsv-kit/bsv`: vault, door, licence) | 0.2.0 | legend, lampas, trade-tracker, spell-forge | **bsv-kit** (stays) | It is BSV: keys from a mnemonic, Postern's signed door, a licence read off the chain. |
| @bsv-kit/grist (`bsv-kit/grist`, and `bsv-kit/testing`, the fake Postern) | 0.2.0 | legend, lampas, trade-tracker, spell-forge | **bsv-kit** (stays) | Cannot work without a BSV key: it signs through bsv's door and seals to the mill's key with @bsv/sdk; it is the one package that imports bsv. |
| @bsv-kit/composer (`bsv-kit/composer` + styles.css) | 0.3.0 | lampas, postern | **voice-kit** | Hold-to-talk, microphone choice, recording, speech recognition: a voice component with no BSV in it (its `transcribe` is a port the app fills). |
| @bsv-kit/speech (`bsv-kit/speech`, `bsv-kit/speech/react` + styles.css) | 0.1.0 | lampas, spell-forge, postern | **voice-kit** | Read-aloud over the page's speechSynthesis and its SpeakingBar: the other half of voice. |
| @bsv-kit/testing (`bsv-kit/testing/speech`, `bsv-kit/testing/mic`) | 0.1.0 | lampas, spell-forge, postern | **voice-kit** | The honest fakes of exactly the two browser APIs composer and speech use; they belong beside what they fake. |
| @bsv-kit/whats-new (`bsv-kit/whats-new` + styles.css) | 0.1.2 | legend, lampas, postern | **pwa-kit** | A changelog sheet and a service-worker update check: an installed app talking about its own releases, nothing to do with keys or voice. |
| @bsv-kit/tips (`bsv-kit/tips`) | 0.2.0 | legend, lampas | **pwa-kit** | One-time tips, which to show now, dismissed for good: app-shell state with injected storage; same domain as What's new (what the app tells the person about itself). |
| (none yet) audible (`audible-kit`) | 0.1.0 | lampas (mw-5r3p30.451), postern (mw-ev7oyy.24), both to come | **audible-kit** | "Audible has nothing to do with the kit" (the Governor): a smart link and a catalogue read, no browser API, no key. |

Why three new repos and not seven, or one: the import map above shows the packages travel in pairs. Every app that
imports composer or speech also imports the testing fakes; every app that imports whats-new or tips imports the other or
nothing else from that pair. A repo per package would make lampas pin five repos; one `misc-kit` would put a React
microphone component beside a storage-only tips module, which is the "boundaries make sense" test failed again. Voice
and pwa each have one sentence that says what belongs and what does not.

Why grist stays, and the alternative not taken: a `postern-kit` holding grist would have one dependency, a git-pinned
bsv-kit, and every grist app would bump two pins for one Postern change; grist's own tests pass only with bsv's door in
front of them. Revisit if grist ever grows a transport that is not keyed.

Names in the new repos: the entry points keep their last segment (`voice-kit/composer`, `voice-kit/speech`,
`voice-kit/speech/react`, `voice-kit/testing/speech`, `voice-kit/testing/mic`, `pwa-kit/whats-new`, `pwa-kit/tips`), so an
app's move is a one-word change per import. The workspace package names become `@voice-kit/*` and `@pwa-kit/*`. The
CSS class prefixes `bk-composer__*`, `bk-speech__*`, `bk-whats-new__*` and the `--bk-*` custom properties do **not**
change: lampas (55 references), postern (22) and spell-forge (11) theme them in their own CSS, and a rename would be a
breaking change bought for nothing. Each README says so under *The look* ("`bk-` for historical reasons").

### Copies the moves can remove, and copies they cannot

The investment's measure is copies removed per move. Today the apps hold no second copy of a bsv-kit package: legend's and
lampas's `src/tips/` wrap `bsv-kit/tips`, lampas's `src/speech/` and postern's `services/speech.ts` and
`services/whatsNew.ts` wrap bsv-kit's engine and sheet, spell-forge's `src/grist/` wraps `bsv-kit/grist`. So the
repo split removes none; it moves packages so the next piece (audible-kit's link, the next voice piece) lands in a repo
whose name says what it is. The first real "copies removed" count belongs to audible-kit: Lampas and Postern each import
the link instead of writing it (its bead's Expect line).

## 2. The open-source bar, and bsv-kit against it

The bar every library repo meets (the Governor's words, the vault's `seats/builder/library-best-practices/checklist.md`,
and audible-kit's AC 7):

1. **Public** repo under Jonathan-A-White; nothing personal in code, fixtures, docs or history (a `check:personal`
   script in `npm test`).
2. **MIT LICENSE** at the root and `"license": "MIT"` in every package.json.
3. **README** with what it is, an install line that works when tried (pinned commit or tag, the npm 11 `allowScripts`
   note), one example per entry point, and a per-package README; a Credits section when anything is bundled.
4. **CHANGELOG.md** (root, or one per package with the root pointing at them), newest first, breaking changes first.
5. **CONTRIBUTING.md**: how to build, test, propose a change, and what a change must bring (test first, fixture from the
   producer for a wire format, credit for a new dependency).
6. **Tests** that run without the network: producer-made fixtures, fake backends, a dependency-rule test per package,
   a consumer smoke test that installs the repo into a scratch app.
7. **CI** running lint, typecheck, test and build on push and pull request.
8. **Typed exports**: ESM, an `exports` map with `types` and `default`, subpath entry points, no deep imports.
9. **Apps pin a commit or a version**, never a branch; a tag exists and equals the package.json version it names; the
   README's install line names a tag that exists.

bsv-kit against it, 2026-10-16 (repo public, MIT, release v0.1.0 of 2026-10-15):

| Bar | bsv-kit | Gap |
|---|---|---|
| 1 Public, nothing personal | Public; `scripts/check-personal.mjs` in `npm test` | none |
| 2 MIT | Root LICENSE; all seven package.json say MIT | none |
| 3 README | Root README: Install (pinned commit, allowScripts), one import per entry point, Modules, Credits, Develop; seven package READMEs | The install line still says "no tag yet" and pins a commit older than every app's; bsv's and tips's package READMEs have no headings and no example block (**gap A**) |
| 4 CHANGELOG | composer, speech, testing and whats-new have one | bsv, grist and tips have none; no root CHANGELOG or pointer (**gap B**) |
| 5 CONTRIBUTING | README's Develop section and CLAUDE.md | No CONTRIBUTING.md (**gap C**) |
| 6 Tests | Fixtures from Postern's own scripts, fake Postern, dependency-rule tests in every package, `consumer-smoke.mjs` in `npm test`, credits check | none |
| 7 CI | `.github/workflows/ci.yml`: lint, typecheck, test | No build job; the build runs only inside the smoke test's scratch install, which needs the network (**gap D**) |
| 8 Typed exports | `exports` with types + default for twelve entry points; `files` packs `packages/*/dist/**` | none |
| 9 Pins and tags | Five apps pin full SHAs; one tag v0.1.0 | Root version is 0.2.0 and composer 0.3.0 with no tag for either; the README install line and the tag disagree; trade-tracker has no `allowScripts` entry; legend, lampas, spell-forge and postern each have one `git+ssh` line in their lock (**gap E**) |

Gaps A to E are one bsv-kit story (M0 below). They are small, and each new repo copies bsv-kit's shape, so closing them
first means the copies start clean.

## 3. The moves, in order

Rules held throughout: one story is one session on one rig; never two moves on one rig at once, so an app with two
switches makes them in two stories, one after the other; each move story names its rig, its files and the apps it
updates; an app's move deletes nothing from bsv-kit, and bsv-kit deletes a package only after its last importer has
switched.

### How apps keep working mid-move: the one-step switch, not a re-export

Chosen: **one-step switch**. An app's move story adds the new repo's pin, changes every import's first word
(`bsv-kit/composer` to `voice-kit/composer`), and bumps or keeps its bsv-kit pin, in one commit its gate proves.
bsv-kit never re-exports from the new repo.

Reason: every app pins bsv-kit by commit, so a package removed from bsv-kit's main is still there for every app that
has not switched, for as long as it keeps its pin. The old code stays reachable without bsv-kit doing anything. A
one-version re-export would make bsv-kit depend on voice-kit and pwa-kit by git pin, which puts a `prepare` build inside
a `prepare` build, two `allowScripts` keys to keep in step, and React peers in a BSV library for a version, all to spare
each app one edit per import that `sed` makes. The cost of the one-step switch is the ordering rule above: no app may
need a bsv fix from a bsv-kit commit after its old packages are gone until it has switched, which is why the removal
story (M10) is last and waits for every switch to land.

What each app's switch does, every time: `npm install github:Jonathan-A-White/<kit>#<sha>`; an `allowScripts` entry
keyed by that exact line; the lock checked for `git+https`; imports and `styles.css` imports changed; vitest aliases or
`vi.mock` paths that name `bsv-kit/...` changed with them; the app's gate green; for lampas and postern the Mayor's live
check too. Nothing in the app's own wrappers moves.

### The order

Each new repo is made by the Mayor as audible-kit was (gh repo create, clone to `~/<rig>`, the config's `[rigs]`,
`[tests]` and `[heavy_net]` lines, the vault's rig page), then a Builder story fills it.

| # | Story | Rig | Files | Apps updated | Waits for |
|---|---|---|---|---|---|
| M0 | bsv-kit meets the bar: CONTRIBUTING.md; CHANGELOGs for bsv, grist, tips and a root CHANGELOG pointing at all seven; headings and an example block in bsv's and tips's READMEs; a build job in CI; the README's install line names the tag; tag v0.2.0 made locally (the push and release are the Governor's) | bsv-kit | CONTRIBUTING.md, CHANGELOG.md, packages/{bsv,grist,tips}/CHANGELOG.md, packages/{bsv,tips}/README.md, README.md, .github/workflows/ci.yml (the story says so) | none | nothing |
| M1 | audible-kit built to the bar | audible-kit | its whole tree (mw-5r3p30.452, in progress) | none | nothing |
| M2 | voice-kit: lift composer, speech and testing from bsv-kit at one named commit, with bsv-kit's tooling (tsconfig.base, eslint, vitest, scripts/check-personal, credits, consumer-smoke, the Chromium shot test), root `exports` for the five entry points, README, CONTRIBUTING, CHANGELOGs continued ("Moved from bsv-kit, where this was @bsv-kit/composer 0.3.0"), CI; the composer-demo example comes with it | voice-kit | the whole new tree | none | M0 (so it copies a repo that meets the bar) |
| M3 | pwa-kit: lift whats-new and tips the same way | pwa-kit | the whole new tree | none | M0 |
| M4 | postern onto voice-kit: composer, speech, speech/react, testing/mic, testing/speech and the two styles.css | postern | package.json, package-lock.json, every file importing those six names, vitest config if it aliases them | postern | M2 |
| M5 | lampas onto voice-kit: composer, speech, speech/react, testing/mic, testing/speech, styles.css | lampas | as M4 | lampas | M2 |
| M6 | spell-forge onto voice-kit: speech, speech/react, testing/speech (keeps `bsv-kit/testing`, the fake Postern, and `bsv-kit/grist`) | spell-forge | as M4 | spell-forge | M2 |
| M7 | legend onto pwa-kit: whats-new and tips | legend | as M4 | legend | M3 |
| M8 | lampas onto pwa-kit: whats-new and tips | lampas | as M4 | lampas | M3 and M5 (one move on lampas at a time) |
| M9 | postern onto pwa-kit: whats-new | postern | as M4 | postern | M3 and M4 |
| M10 | bsv-kit keeps only BSV: delete packages composer, speech, testing, whats-new, tips, examples/composer-demo, their `exports`, build and typecheck lines, vitest aliases, README and CLAUDE.md sections and credits; root CHANGELOG says where each went; version 1.0.0 of bsv-kit tagged locally | bsv-kit | packages/{composer,speech,testing,whats-new,tips}, examples/composer-demo, package.json, package-lock.json, vitest.config.ts, tsconfig.json, README.md, CLAUDE.md, CHANGELOG.md | none (trade-tracker, legend, lampas, spell-forge keep their pins; each bumps to 1.0.0 on its next bsv or grist change) | M4 to M9 all landed |
| M11 | lampas 'Listen in Audible' (mw-5r3p30.451) and Postern's To do Audible button (mw-ev7oyy.24): the first imports of audible-kit, already filed | lampas, postern | theirs | lampas, postern | M1; on lampas, after M8 |

Parallelism: M1, M2 and M3 are on three different rigs and can run together once M0 lands. M4, M5, M6 and M7 are on
four different rigs and can run together once M2 and M3 land. M8 and M9 follow on their rigs. M10 is alone. The
critical path is M0, M2, M5, M8, M10: five sessions.

What the new repos do not copy from bsv-kit: the Postern fixture scripts under `packages/bsv/scripts` (BSV only), the
door demo, and the `bsv-kit/testing` fake Postern (it is grist's). Tooling is copied, not shared: a `kit-tooling`
repo is a fourth thing to pin for an eslint config, which rule 01 of the best-practices ("build only a real gap") says
not to do until two repos have diverged and had to be brought back.

History: the move copies files at one named bsv-kit commit rather than rewriting history with filter-repo. bsv-kit is
public and keeps the history; each moved CHANGELOG names the commit it was lifted at, so `git log` in bsv-kit before
that commit is the package's past. (bsv-kit's own `.git` is shared by its worktrees; a history rewrite there is the one
thing this plan refuses.)

## 4. audible-kit against the bar

audible-kit is the first new repo (mw-5r3p30.452, P1, in progress 2026-10-16 on branch mw/mw-5r3p30.452; main holds
only the initial commit and LICENSE). Its bead's AC 7 is this document's bar, item for item:

| Bar | audible-kit (its AC 7) | Note |
|---|---|---|
| 1 Public, nothing personal | Public repo made by gh 2026-10-16 03:25Z | Add bsv-kit's `check:personal` to `npm test` (the story copies bsv-kit's tooling; make sure this script is in the copy) |
| 2 MIT | LICENSE made by gh; `license` field | ok once package.json says MIT |
| 3 README | What it is, install from GitHub with a pinned commit, examples for both functions | ok; add the `allowScripts` note bsv-kit's README carries, which AC 7 does not mention |
| 4 CHANGELOG | CHANGELOG.md | ok |
| 5 CONTRIBUTING | CONTRIBUTING.md (build, test, propose a change) | ok; it is the first repo in the factory to have one, so bsv-kit's M0 copies it back |
| 6 Tests | Fake fetch, saved metadata fixture, never the network; `npm test` green | ok; a consumer smoke test (install the repo into a scratch app) is not in AC 7 and is the one test bsv-kit has that it lacks |
| 7 CI | A workflow running lint, typecheck, test and build | ok, and ahead of bsv-kit, whose CI lacks the build job |
| 8 Typed exports | Typed exports; root `exports` | ok |
| 9 Pins | Installable as `github:Jonathan-A-White/audible-kit#<commit>`, dist built by `prepare` | ok; a tag at the first commit lampas pins |

Two things to carry into its closing comment or a follow-up: the `check:personal` script and the consumer smoke test.
Neither blocks M11.

## The stories, ready to file

Each below is the one-line title; rig, files and apps are in the table in section 3, and the acceptance criterion for
every switch is the same: the app's gate passes, no `bsv-kit/<moved name>` import remains (grep is the finish line), the
new pin is a full SHA with its `allowScripts` key and a `git+https` lock line.

- M0 · bsv-kit: meets the open-source bar (CONTRIBUTING.md, CHANGELOGs for bsv, grist, tips and a root one, README
  examples for bsv and tips, a CI build job, install line naming the tag, v0.2.0 tagged locally)
- M2 · voice-kit (new MIT repo): composer, speech and the speech and mic fakes lifted from bsv-kit, with its tooling,
  README, CONTRIBUTING, CHANGELOGs and CI
- M3 · pwa-kit (new MIT repo): whats-new and tips lifted from bsv-kit, with its tooling, README, CONTRIBUTING,
  CHANGELOGs and CI
- M4 · postern onto voice-kit (composer, speech, testing fakes), one-step switch
- M5 · lampas onto voice-kit (composer, speech, testing fakes), one-step switch
- M6 · spell-forge onto voice-kit (speech, testing/speech), one-step switch
- M7 · legend onto pwa-kit (whats-new, tips), one-step switch
- M8 · lampas onto pwa-kit (whats-new, tips), one-step switch, after M5
- M9 · postern onto pwa-kit (whats-new), one-step switch, after M4
- M10 · bsv-kit keeps only BSV: the five moved packages, the composer demo and their exports deleted; v1.0.0 tagged
  locally
- A demo story closing the epic on the Governor's 'Looks good': the three repos on GitHub, each README's install line
  tried in a scratch folder, Lampas and Postern running on the new pins.

M1 (audible-kit) and M11 (its first two importers) are filed already: mw-5r3p30.452, mw-5r3p30.451, mw-ev7oyy.24.
