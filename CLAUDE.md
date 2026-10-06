# CLAUDE.md

The docs are `bible/` - start at `bible/Home.md` (its Process rules bind every
change) and read `bible/01-Overview/Port-Doctrine.md` before touching code.

- **Before a push** (FAST-SUITE, `bible/09-Testing/Testing.md` "How the suite
  runs"): `npm run lint`, `npm run types`, the bible's gates (`test/manifest`,
  `citeanchor`, `citedrift`, `mutantdrift`, `audit18_bible_docs`, `ledger` -
  always: they catch a cite or a mutant record a change moved, which the tests
  it picks do not) and `npm run test:changed` - the tests a change can move. When that is
  most of the suite (a change to a host the source pins read, like
  `worldModes.js`), run the change's own test files instead and leave the rest
  to CI. CI's `verify` runs the whole gate - lint, types, every test file in
  four shards, the build - on every pull request and before every deploy, and
  a pull request is not done until it is green on its head. A pull request
  that conflicts with its base runs NO workflow: merge the base in before the
  push that is meant to be verified. The whole `npm run check` in series (~15
  minutes on four cores) is for when CI cannot run it.
- **A cite into our own code is an anchor** (`bible/Home.md`, A CITE NAMES
  WHAT IT POINTS AT): `world.js:"const livingQuarry = () =>"`, the one line
  that holds that text - never `world.js:6153`. Write a number and
  `npm run cites -- --apply` converts it; `citeanchor` fails a quote that stops
  being true, at the doc and the quote. After merging main into a branch that
  still wrote numbers: take main's side of each cite-only conflict, then
  `npm run cites -- --apply` and `-- --check`.
- **Patch notes go in the pull request's description**, under
  `## Patch notes: <title>` (`.github/pull_request_template.md`). The desktop
  release reads them there. Never commit a patch-notes file:
  `test/rel4_release.test.js` fails the suite on one. Editing a merged pull
  request's description rewrites its release's notes (`release-notes.yml`).
