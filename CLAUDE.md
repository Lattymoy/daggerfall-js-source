# CLAUDE.md

The docs are `bible/` - start at `bible/Home.md` (its Process rules bind every
change) and read `bible/01-Overview/Port-Doctrine.md` before touching code.

- **Scope** (SCOPE1, Mac, 2026-10-14): DFO Online is its own game, not a 1:1
  port. Daggerfall Unity is the reference - read it first, cite it, name a
  departure from it - not a target to match. Older pages that say "1:1" are
  history; Port-Doctrine's Scope section governs new work.

- **The world is Tamriel** (TAMRIEL-WIDE, the owner, 2026-10-28: "ensure our future development isnt just
  Daggerfall anymore and is the entirety of tamriel"; Port-Doctrine's "The whole of Tamriel"): the Iliac Bay is one
  theatre of ten. New work answers for every province, or its record says where it does not and why. Key a pixel by
  `worldPixelKey`, bound it by `worldPixelOk`, find a place in `worldPlaces`, read regions 0..70 and areas - never
  MapsFile's `y * 1000 + x`, a loop over MAPS.BSA's regions or a 0..999 bound, except as the Bay's own data behind
  `inBay` with a `BAY-OWN:` comment saying why. Pin a case past the Bay beside the Bay's, and probe in a province, not
  only in Daggerfall. `test/tooling/tamrielwide.test.js` holds the tree to `tools/tamrielWideBaseline.json`, which
  only goes down.
- **World 2.0 reads its canon first** (WG2, the owner, 2026-10-31: "This is a big arc and we need to do this correctly
  with no band aids"): before touching `src/world/gen2/`, the ground's seam, `public/worldgen2/` or the World Editor, read
  `bible/03-World/World-2-Canon.md`. Gameplay fields use exact arithmetic only; a law that moves a bake re-bakes with
  `node tools/wg2Bake.mjs all`; publishing a region raises `GROUND_LAW` and is the owner's call.
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
- **The loot level gate stays unpublished** (LOOT-GATE, Dudey, 2026-10-25): patch notes, release notes and Discord
  posts never give the levels, factors or drop chances in `src/systems/loot/lootLevelGate.js`. Say only that Rare and
  Legendary gear is rarer early on and more common as a character grows.
- **Patch notes go in the pull request's description**, under
  `## Patch notes: <title>` (`.github/pull_request_template.md`). The desktop
  release reads them there. Never commit a patch-notes file:
  `test/tooling/rel4_release.test.js` fails the suite on one. Editing a merged pull
  request's description rewrites its release's notes (`release-notes.yml`).
- **Patch notes are written in STE** (STE-NOTES, the owner, 2026-10-26: "The law for patch notes is now ASD-STE100
  Simplified Technical English (STE)"): STE's approved words in their approved meanings, one topic in a sentence,
  25 words at most (20 in an instruction), six sentences to a paragraph, no semicolons, no -ing verb forms, no
  contractions, the simple tenses, a control or an item **bold** (`bible/01-Overview/Desktop-App.md` STE-NOTES).
  The pull request's `ste-notes` check reads the description each time it changes: write the description to a
  file and run `node scripts/steNotes.mjs <file>` before you post it. A clean run is not proof - the dictionary is
  the writer's.
- **Discord is code** (DISCORD-CODE, Mac, 2026-10-17, `bible/11-Multiplayer/Chat-Safety-Arc.md`
  section 9): the bot's commands are declared in `server-account/src/discordCommands.js`, its cards
  and answers are `server-account/src/discord.js`, its channel and moderators are
  `server-account/wrangler.toml`. The account deploy writes them to Discord (`account-deploy.yml`,
  "Point Discord at the service": the Interactions Endpoint URL, the whole command list, the bot's
  permissions in the channel checked). Change Discord by changing those and merging - never ask for
  the bot's token or for Developer Portal clicks the deploy can do. A person still invites the bot,
  grants its roles, and rotates its token (the `DISCORD_BOT_TOKEN` secret).
- **Say it once, plainly** (PLAIN-TEXT, the owner, 2026-10-26: "reduce over explanatory text + reduce the amount
  of ai-like crafted text"; `bible/Home.md`): player text at most 40 words a string and 25 a sentence, no padding; a
  comment says why in at most 8 lines; a bible paragraph at most 150 words. `test/tooling/plaintext.test.js` holds the
  tree to `tools/plainTextBaseline.json`, which only goes down.
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
