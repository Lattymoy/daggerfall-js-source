# CLAUDE.md

DFO Online: its own game built on The Elder Scrolls II: Daggerfall's data. Hand-rolled WebGL2, Vite, Node ESM, no
framework. Docs: `bible/Home.md`. Read `bible/01-Overview/Port-Doctrine.md` before you change code.

## Commands

- `sh tools/fetch-data.sh`, then `export ARENA2_PATH=/home/claude/dfdata/arena2`. ARENA2 is freeware: fetch it before
  any work that reads the map, the game's files or the running game. Never report it missing.
- Before a push: `npm run lint`, `npm run types`, `npm run gates`, `npm run test:changed`. If `test:changed` picks
  most of the suite, run the change's own test files and leave the rest to CI.
- CI's `verify` runs everything. A PR is done when it is green on its head. A PR that conflicts with its base runs
  no workflow: merge the base in first.
- `npm run cites -- --apply` turns a `file.js:123` cite in the bible into an anchor (`file.js:"the line's text"`).
  After a merge, take main's side of a cite-only conflict, then `-- --apply` and `-- --check`.

## Rules

Each is an owner's decision. A rule's name is its label in the bible.

- **SCOPE1**: DFO Online is its own game, not a 1:1 port. Daggerfall Unity is the reference: read it first, cite it,
  and name any departure. Pages that say "1:1" are history.
- **TAMRIEL-WIDE**: the world is all of Tamriel, not just the Iliac Bay. Key a pixel with `worldPixelKey`, bound it
  with `worldPixelOk`, find places with `worldPlaces`, read regions 0..70. Never MapsFile's `y * 1000 + x` or a
  0..999 bound unless it is the Bay's own data, behind `inBay`, with a `BAY-OWN:` comment. Test a case past the Bay
  as well. `test/tooling/tamrielwide.test.js` ratchets `tools/tamrielWideBaseline.json` down only.
- **HOST-SPLIT**: the hosts do not grow. New behaviour goes in a module the host wires (`src/scenes/fishHost.js`
  is the shape). `test/scenes/hostceiling.test.js` lists the hosts and their ceilings.
- **PLAIN-TEXT**: player text is at most 40 words a string and 25 a sentence. A bible paragraph is at most 150
  words. `tools/plainTextBaseline.json` only goes down.
- **HISTORY-OUT**: history lives in git and PR descriptions, never in the bible or the code. The bible says how
  things work now; update a system's page when you change its behaviour. A comment says why, in 8 lines or fewer,
  with no ticket tag, date, quote or bible pointer. `tools/commentTagsBaseline.json` only goes down;
  `tools/commentSweep.mjs` takes history out folder by folder (`bible/01-Overview/Readability-Arc.md`).
- **LOOT-GATE** (Dudey): never publish the levels, factors or chances in `src/systems/loot/lootLevelGate.js`. Say
  only that Rare and Legendary gear is rarer early on and more common as a character grows.
- **Patch notes** go in the PR description under `## Patch notes: <title>`, written in STE. Use the `ste-notes`
  skill. Never commit a patch-notes file.
- **Discord is code**: change the bot by changing `server-account/` and merging (see `server-account/CLAUDE.md`).
  Never ask for the bot's token or for clicks the deploy can do.
