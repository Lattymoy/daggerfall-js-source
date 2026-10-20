# CLAUDE.md

The docs are `bible/` - start at `bible/Home.md` (its Process rules bind every
change) and read `bible/01-Overview/Port-Doctrine.md` before touching code.

- **Scope** (SCOPE1, Mac, 2026-10-14): DFO Online is its own game, not a 1:1
  port. Daggerfall Unity is the reference - read it first, cite it, name a
  departure from it - not a target to match. Older pages that say "1:1" are
  history; Port-Doctrine's Scope section governs new work.

- **ARENA2 is freeware - fetch it, never report it missing** (the owner, 2026-10-18: "Why not install the freeware.
  Im tired of having to ask you to do this"): `sh tools/fetch-data.sh` puts Daggerfall's own data at
  `/home/claude/dfdata/arena2` (~150 MB, never in the repo). Run it before any work that reads the map, the game's
  files or the running game, and set `ARENA2_PATH` to it. "Not checkable here: no ARENA2" is a check not yet run.
- **Before a push** (FAST-SUITE, `bible/09-Testing/Testing.md` "How the suite
  runs"): `npm run lint`, `npm run types`, the bible's gates (`test/bible/manifest`,
  `citeanchor`, `citedrift`, `mutantdrift`, `audit18_bible_docs`, `ledger` -
  always: they catch a cite or a mutant record a change moved, which the tests
  it picks do not) and `npm run test:changed` - the tests a change can move. When that is
  most of the suite (a change to a host the source pins read, like
  `worldModes.js`), run the change's own test files instead and leave the rest
  to CI. CI's `verify` runs the whole gate - lint, types, every test file in
  eight shards, the build - on every pull request and before every deploy, and
  a pull request is not done until it is green on its head. A pull request
  that conflicts with its base runs NO `pull_request` workflow: merge the base
  in before the push that is meant to be verified - or comment `/check` on it,
  which runs the whole check on its branch as it stands and says it on the head
  as `check (asked)` (CHECK-ASK); the required `check` still comes once it
  merges cleanly. The whole
  `npm run check` in series (~15 minutes on four cores) is for when CI cannot
  run it.
- **Main is development, `release` is production** (RELEASE-FLOW,
  `bible/01-Overview/Release-Flow.md`): a pull request targets main - a hotfix
  alone targets release, branched from release - and needs a reviewer's
  approval (`.github/CODEOWNERS`). Main is played in the dev environment
  (`dev-deploy.yml`, inside WireGuard); the relay, the account service, the
  site and the desktop release move only when their workflows are dispatched on
  release and a release manager approves them. GitHub lets only an admin merge
  into release and only a release manager approve; anyone who can push may
  dispatch, so: a session never merges into release and never dispatches or
  approves a production workflow; it may open the pull request that promotes
  main or carries a hotfix. Roles are code:
  `ops/github/settings.json`, applied by an admin (`tools/repoSettings.mjs`).
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
  `test/tooling/rel4_release.test.js` fails the suite on one. Editing a merged pull
  request's description rewrites its release's notes (`release-notes.yml`).
- **Discord is code** (DISCORD-CODE, Mac, 2026-10-17, `bible/11-Multiplayer/Chat-Safety-Arc.md`
  section 9): the bot's commands are declared in `server-account/src/discordCommands.js`, its cards
  and answers are `server-account/src/discord.js`, its channel and moderators are
  `server-account/wrangler.toml`. The account deploy writes them to Discord (`account-deploy.yml`,
  "Point Discord at the service": the Interactions Endpoint URL, the whole command list, the bot's
  permissions in the channel checked). Change Discord by changing those and merging; it reaches
  Discord with the release that carries it (RELEASE-FLOW) - never ask for
  the bot's token or for Developer Portal clicks the deploy can do. A person still invites the bot,
  grants its roles, and rotates its token (the `DISCORD_BOT_TOKEN` secret).
- **The hosts do not grow** (HOST-SPLIT, `bible/01-Overview/Host-Split.md`):
  new behaviour goes into a module the host wires (`src/scenes/fishHost.js` is
  the shape), never into `bootWorld`, `createWorldModes`, `buildDungeonContext`,
  `bootExterior`, `navalHost`'s `createNavalHost` or `comeSailAway`'s
  `createComeSailAwayRuntime` themselves - and on the relay into a Room method of its own,
  never into `_message`, nor into any other function the test holds to a ceiling.
  `test/scenes/hostceiling.test.js` fails a host that lengthens
  past its ceiling in logical lines (statements and entries - splitting a crowded
  line costs nothing); `node tools/hostScope.mjs <host>` maps what a
  block reads and writes before you move it.
