# Testing

The suite is Node's own test runner over every `*.test.js` under `test/`, each file in its own process. It runs on
every pull request and before every deploy and release, split into shards that run at once. A test file says what it
covers in its own titles and header comment; the suite counts itself. Players never meet it directly: it is what keeps
a change from reaching them broken.

## How the suite runs

- **The runner.** `tools/testShards.mjs` `runTests` runs every list of tests: the whole suite (`npm test`, shard
  `1/1`), a CI shard, or `test:changed`. It starts the longest files first by their recorded times, with
  `--test-concurrency` at the machine's core count. `tools/failSummary.mjs` reports beside the runner's own output and
  names each failing test's file, line and reason at the end of the log, and on GitHub as an annotation and a summary.
- **Shards.** `shardsOf` splits the files by recorded time, the longest first, each onto the lightest shard. Every file
  is in exactly one shard; a file with no recorded time weighs the median. `node tools/testShards.mjs 2/8` runs one
  shard, `--list` prints it, `--plan 8` shows the split.
- **Times.** Each CI shard records its files' wall times (`--record`, `tools/fileTimes.mjs`). After a green run
  `.github/workflows/test-times.yml` merges them (`tools/testTimes.mjs --merge`) and saves them in the Actions cache.
  The next run's `times` job finds the newest key and every shard restores that one key, so all eight split alike.
  With none saved the committed `tools/testTimes.json` is used. `npm run test:times` retakes it by hand on a quiet
  machine. Stale times only balance shards worse; they never leave a file out.
- **CI's verify.** `.github/workflows/verify.yml` is the one check, as parallel jobs: lint and types, the suite in
  eight shards, the Elite Breach course sweep (`.github/workflows/eg-sweep.yml`), and the build. Every job restores
  `node_modules` from a cache keyed by `package-lock.json`. `check.yml` calls it on a pull request; its `check` job
  runs `always()` and fails unless verify passed, because a skipped required check would count as a pass. `deploy.yml`
  verifies main's head before it publishes the site, and `release-desktop.yml`'s `gate` verifies the release's commit.
  A pull request that conflicts with its base runs no workflow: merge the base in before the push meant to be verified.
- **`npm run test:changed`** (`tools/testChanged.mjs`) runs the tests a change can move: files that changed, files that
  import a changed file at any depth, and files whose text names it. Changes are taken against the merge base with
  `origin/main`, plus staged, unstaged and untracked files. A change to `package.json`, the lockfile or `tsconfig.json`
  runs everything. `--list` prints the choice.
- **`npm run gates`** runs the bible's gates: `test/bible/manifest.test.js`, `test/tooling/citeanchor.test.js`,
  `test/scenes/citedrift.test.js`, `test/tooling/mutantdrift.test.js`, `test/bible/audit18_bible_docs.test.js`,
  `test/tooling/plaintext.test.js` and `test/tooling/tamrielwide.test.js`. They catch a cite or a mutant record a change
  moved, which `test:changed` does not pick.
- **Before a push** (FAST-SUITE): `npm run lint`, `npm run types`, the gates, and `npm run test:changed`. When that is
  most of the suite, run the change's own test files and leave the rest to CI. `npm run check` (lint, types, the suite
  and the build, in series) is for when CI cannot run. `npm run lint` keeps a content-keyed cache.
- **Mutants.** A record in `tools/mutants/*.json` names a source file, the exact text to replace (`old`), its
  replacement (`new`) and the tests that must kill it. `node tools/mutate.mjs <records>` judges them; `--jobs N` runs N
  at once, each in a workspace copy of the tree. A mutant is dead only when its tests pass unmutated and fail mutated.
  A record whose tests fail unmutated is no verdict, and the run fails. `test/tooling/mutantdrift.test.js` fails a
  record whose `old` text is no longer in its file.

## What a test must do

- **Have a unique file name.** The bible names a test by its file name alone (`test/bible/manifest.test.js`).
- **Run without game data, or skip by name.** Synthetic tests build their data in memory and always run. Real-data
  tests are gated on `ARENA2_PATH` (a `skipReal` reason) and pin observed counts, names, ids and checksums. CI has no
  ARENA2, so a real-data pin is a local gate only. When you change a law, grep the gated files for it too. Get the data
  with `sh tools/fetch-data.sh`, then `ARENA2_PATH=/home/claude/dfdata/arena2 npm test`.
- **Find Daggerfall Unity through `test/dfuRoot.mjs`.** Parity pins that regenerate a table from DFU's C# read
  `DFU_ROOT`: `DFU_PATH` first, then the sparse clone `tools/parity/prepare.sh` makes. With neither they skip.
  `test/tooling/parityroot.test.js` fails a test that hardcodes the path.
- **Treat a skip as not a pass.** A pin that never runs proves nothing. Run gated pins where their data is.
- **Answer for Tamriel.** A world test pins a case past the Iliac Bay beside the Bay's, and a probe runs in another
  province, not only in Daggerfall (TAMRIEL-WIDE, the owner).
- **Measure coverage from both sides.** A pin that a set is covered must also say what happens outside the set, and
  its measure must be able to report a miss (`test/systems/effectcoverage.test.js`).
- **Test the mechanism, not its text.** A pin that greps for a mechanism does not test it: run it. A pin reads a whole
  function, never a fixed window of source lines.
- **Measure allocation through `test/allocChild.mjs`.** A suite that counts a frame's bytes spawns its child with
  `ALLOC_CHILD_ARGS` whole. `test/allocSettle.mjs` makes each `gc()` first finish V8's optimising queue, so the
  measure reads the optimised code the browser runs. `test/tooling/allocchild.test.js` holds the list to its purpose.

### Probes

A probe (`tools/*Probe.mjs`, many behind an `npm run` script) is run by hand, not by the suite: it needs a browser, a
real runtime or game data. It drives the real seam and the real markup, never markup of its own. A probe that cannot
reach its first check is as silent as one nobody ran, so a probe fails when a check has nothing to read.

- `npm run account` (`tools/accountProbe.mjs`) stands `server-account/` up in a real workerd with real migrations and
  drives the account lifecycle and a cloud-save round trip. It catches what an import cannot: a Worker that does not
  boot, or a binding that is not bound.
- `npm run shot [out.png]` (`tools/screenshot.mjs`) boots Vite and photographs a scene in Chromium. The scene query is
  `SHOT_QUERY`, not argv; `SHOT_TIMEOUT` raises the ready wait. SwiftShader runs heavy scenes at a few frames a second,
  so a time-based proof polls state.
- `npm run firsthour` (`tools/firstHourProbe.mjs`) plays one character through chargen, a dungeon, a fight, the road,
  a town, a shop and a bed, with a screenshot a stage (`SHOTS`). It needs game data and about twenty-five minutes. Run
  it when a host, a window or the boot path changes.

## Rules

- Faster checks never cost a standard: every test file runs on every pull request and before every deploy (Mac).
- `.github/workflows/intro-quality.yml` runs the intro's own test files before its probes, not the whole check in
  series (the owner).
- ARENA2 is freeware: fetch it with `tools/fetch-data.sh` before work that reads the game's files, and never report it
  missing (the owner).
- This page carries no table of test files and no suite total (`test/bible/manifest.test.js`).
- When an audit finds a defect, the fix includes the gate for its class (`bible/01-Overview/Hardening.md`).

## Code and tests

- `tools/testShards.mjs` - the runner and the shard split; `tools/testChanged.mjs` - the tests a change can move
- `tools/testTimes.mjs`, `tools/fileTimes.mjs` - recorded times; `tools/failSummary.mjs` - the failure summary
- `tools/mutate.mjs`, `tools/mutants/` - mutation records and their judge
- `test/dfuRoot.mjs`, `test/allocChild.mjs`, `test/allocSettle.mjs` - shared test helpers
- `test/tooling/flow1_ci.test.js` - every file in exactly one shard, the workflows' shard counts agree
- `test/tooling/fastsuite.test.js`, `test/tooling/citimes.test.js`, `test/tooling/cifast_failsummary.test.js` - the
  runner, the recorded times, the failure summary

## Open

- The real-data pins encode the English retail data by value. A German install fails them on its own data, and they
  read file names literally, so a mixed-case install fails them too.
- On a non-English install `src/systems/chargenSession.js` falls back to `CLASS_CAREERS` only for an empty class name,
  so an enciphered CLASS*.CFG name shows in the class list. No pin can catch it: the suite has no non-English data.
