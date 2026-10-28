# AUDIT TAMRIEL-WIDE - the integrated tree read cold, and the rule for what comes next (2026-10-28)

The owner, the day PR #1184 merged: *"With the new tamriel integrated, I want to do an audit on anything that could be
broken and ensure pur future development isnt just Daggerfall anymore and is the entirety of tamriel"*.

Two halves. The audit reads main at `41804bd39` (#1184 merged as `1e18a8f64`, and the day's fixes after it) for what
is broken. The rule makes new work answer for all of Tamriel, and a test holds it (TAMRIEL-WIDE, below).

**Status: IN PROGRESS.** The lanes are reading. Their findings, and what was fixed, are written here as each is
verified.

## The baseline

Run on the audited head with the freeware data (`/home/claude/dfdata/arena2`): `npm run lint` clean, `npm run types`
clean, `npm run build` clean. The whole suite in one shard is recorded under "The suite" once it ends.

Two checks fail with ARENA2 and pass without it, so CI never sees them:
`test/formats/worldData/it1_worlddata.test.js` "IT1 with ARENA2_PATH" and `test/formats/worldData/wd1_worlddata.test.js`
"WD1 with ARENA2". Both are the Immersive Travel gate patch `WALLAA08.RMB.json`, which rebuilds to sha256 `5491ffb9...`
where the patch records `a4c5443d...`. It fails the same way at `ca4484772` (the merge that added the test) and at
`edd55fa0c` (main before #1184), so it is not Tamriel's. Field Bugs 2026-10-20h and Quest Audit III recorded it before.
The patch was built without a BLOCKS.BSA (`vendor/immersive-travel/README.md`), and settling it needs the author's
bundle: `node tools/immersiveTravelPatches.mjs <dfmod> <arena2>`. In play the loader warns and serves the rebuild.

## How it was run

Five cold lanes, each reading a frozen worktree of the audited head, told to reproduce a finding before reporting it
and to check the earlier audits first (`Audit-Left-In-The-Bay.md`, `../Audit-TESA.md`, `../../03-World/World-Wide.md`).

| Lane | Over |
|---|---|
| A | the features main merged beside #1184, written for the Bay: the yards, homes, health, remains, saves, the first-visit cache, the snow worker, the cover index, the Abyss parties, the shop |
| B | the wire, the relay, the account service and the saves: every bound and key of a pixel, region, place or map id |
| C | a sweep of `src/` for the Bay-only idioms, a verdict on every hit, and the signal for a gate |
| D | what the player sees and does: text in 13 languages, the maps, quests and the starts, names |
| E | the Tamriel fixes after the merge: FB1028, PROVINCE-FOLK, SEA-SQUARE, COAST-PORT, the Overworld's walks, the homes |

## TAMRIEL-WIDE - the rule

`../Port-Doctrine.md` "The whole of Tamriel", `../../Home.md` THE WORLD IS TAMRIEL, and `CLAUDE.md` carry it. The
pull request template asks where a change works past the Bay.

`tools/tamrielWide.mjs` counts four idioms in code lines (comments are not counted), a file at a time, in `src/`,
`server/src/` and `server-account/src/`:

| Idiom | Matches | The world's way |
|---|---|---|
| `pixel-id` | `py * 1000 + px` and its spellings | `worldPixelKey` |
| `region-walk` | a `for` over `regionCount` | the `worldPlaces` registry |
| `bay-bound` | a pixel compared with 1000, 999, 500 or 499 | `worldPixelOk`, or `inBay` for the Bay's own data |
| `region-62` | a region compared with 61 or 62 | `BAY_REGION_COUNT`, `theatreOfRegion` |

`test/tooling/tamrielwide.test.js` holds the tree to `tools/tamrielWideBaseline.json`, which only goes down. A line
that reads the Bay's own data on purpose carries a `BAY-OWN:` comment, on it or the line above, and is not counted.
