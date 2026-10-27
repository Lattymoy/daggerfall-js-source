# HANDOFF: AUDIT LEFT IN THE BAY - the fix program (2026-10-27, saved at the session limit)

This branch holds documents only. Do not merge it. It keeps what lived only in the session's scratch folder: the
audit's record, the fix briefs, the agent map and the lanes' probes. The code is on the branches named below.

## Where things stand

- **PR #1321** (`ccr-e60534fb-hlob1p`, head `5e2d374204`, CI green on all 17 checks): this PR's own findings F1 (the
  Imperial City's bake stall), F2 (TS9's half tiles past the Bay) and F3 (TS10's walk-shut key) are fixed, pinned and
  recorded. Nine of the twelve stale doc lines are fixed.
- **The other 35 findings** are on nine package branches, one per package, each made from `e77eadc58f` (PR #1321's
  head before F1). The owner's words: "Every single thing here needs to be addressed. No exceptions."
- A commit titled `WIP AUDIT BAY-LEFT <package>` is the worktree's uncommitted work at the moment the usage limit
  stopped the agent. It is unverified: its tests, mutants and records may not all be run or written. A branch with no
  WIP commit had everything committed by its agent; its last commits are the agent's own, but no final report was
  written, so its checks still need a run.

## The package branches

### `ccr-e60534fb-hlob1p-wp1-gates`
- `fa7eb8c03e` WIP AUDIT BAY-LEFT wp1-gates: the package's uncommitted work, saved at the session limit
- `3d1695fa32` WW-GATES-EVERYWHERE: an Oblivion Gate in every province, its kill its own province's seats', its scans in idle moments

### `ccr-e60534fb-hlob1p-wp2-starfall`
- `736009e139` WW5: the mutants - ww5_stars (37) and ww5_hollows (65), all dead; the pins that kill them
- `f50813d9eb` WW5: the pins - ww5_stars and ww5_hollows, the freeware's world beside them
- `8a816b719e` WW5: a coven night and a Hollow in every theatre - the law, the wire, the relay, the page

### `ccr-e60534fb-hlob1p-wp3-raids`
- `b324ba92a7` WW6: the record - World-Wide WW6 BUILT, the raids' and staff events' pages, R2-7, the ledger and the arcs
- `f5658e7a8e` WW6: the two survivors - a town's index bound pinned, the lanes' run-out check left to the expiry pass
- `4dc6686c9a` WW6: pins and mutants for raids and staff town events past the Bay
- `2548c5593b` WW6: the client rolls, keeps and announces raids at towns past the Bay
- `dc663e7384` WW6: a staff town event may stand at a town past the Bay
- `4a6434f90e` WW6: raid keys, tuples and day slots on the world's grid, at both ends
- `d1118bc45a` WW6: the raids' host seams out of bootWorld (HOST-SPLIT)

### `ccr-e60534fb-hlob1p-wp4-dungeons`
- `b4a9c1156f` WIP AUDIT BAY-LEFT wp4-dungeons: the package's uncommitted work, saved at the session limit
- `4b4bd6b7a8` HOST-SPLIT SPAWN-WORLD: the spawn's stand, its ground and the Overworld's dungeon lists out of bootWorld
- `a9b333871c` SPAWN-HOLE: no hole in the ground past the Bay (AUDIT LEFT IN THE BAY A1)

### `ccr-e60534fb-hlob1p-wp5-quests`
- `ed1bfb75db` BAY-LEFT-B: the record, the ledger, the mutants
- `ea45018ff0` BAY-LEFT-B HOUSES: houses sold, deeded and given past the Bay
- `59b227b438` BAY-LEFT-B B1: a seat's id a Bay place's too; the pins made to fail
- `7ab0ed4321` BAY-LEFT-B B5-B7: the pins the quest layer's reads moved
- `84f380b398` BAY-LEFT-B B3-B7: %di, Where-is, the map reveals, scrying and %lp past the Bay
- `3ecc250eb0` BAY-LEFT-B B1: Project Legacy's heir born at a seat past the Bay
- `6d37550870` BAY-LEFT-B: the boot's start out of bootWorld (HOST-SPLIT), verbatim

### `ccr-e60534fb-hlob1p-wp6-courts`
- `598d83c441` PROVINCE-COURTS: the pins the provinces' factions move
- `39ea6f94e4` PROVINCE-COURTS: the L10N3e name lookups count the two new sites
- `be6b0aa0da` PROVINCE-COURTS: the record
- `b920d193a6` PROVINCE-COURTS: each province past the Bay its court, its people and its ruler

### `ccr-e60534fb-hlob1p-wp7-maps`
- `09054c5584` WIP AUDIT BAY-LEFT wp7-maps: the package's uncommitted work, saved at the session limit
- `d2ab0e9896` HOST-SPLIT (BAY-LEFT-MAPS): the Overworld's places by summary out of bootWorld
- `2c413d5358` BAY-LEFT-MAPS: Travel Options' roads past the Bay (C10)
- `4f4302c353` BAY-LEFT-MAPS: the held map's marks and the map's flags past the Bay (C1, C2)

### `ccr-e60534fb-hlob1p-wp8-sea`
- `d1d662732e` WIP AUDIT BAY-LEFT wp8-sea: the package's uncommitted work, saved at the session limit
- `29c8279886` BAY-LEFT-SEA: staff /town audit lists a province's capitals first, 400 a page (E4)
- `0e921bc6b3` BAY-LEFT-SEA: weather born at sea past the Bay is the sea's (D4)
- `1b879ee155` BAY-LEFT-SEA: the world's ports' comment back above them
- `57b1e99e75` BAY-LEFT-SEA: a harbourmaster at every port past the Bay (C5)
- `b6a1001830` BAY-LEFT-SEA: the market's couriers know the road to and from every province (B2 = E1)
- `eeb094d0d4` BAY-LEFT-SEA: the market's pieces and hubs out of bootWorld (HOST-SPLIT)

### `ccr-e60534fb-hlob1p-wp9-ground`
- `9716408b51` WIP AUDIT BAY-LEFT wp9-ground: the package's uncommitted work, saved at the session limit
- `e04d5d2972` BAY-LEFT-GROUND: a record's frame moves out of bootWorld, verbatim (HOST-SPLIT)
- `d508970cf5` BAY-LEFT-GROUND: the ground moved past the Bay - GROUND_LAW 2, and its print reads past the Bay
- `0184f16bad` BAY-LEFT-GROUND: the landforms' sites past the Bay - a town past the Bay stands in its land (D1)
- `b2982f9e02` BAY-LEFT-GROUND: the Snowfall mod past the Bay - deep snow, tracks, hollows and berms (D3)
- `df565b3a63` BAY-LEFT-GROUND: the snow's ground moves out of bootWorld, verbatim (HOST-SPLIT)
- `29924e5829` BAY-LEFT-GROUND: LW6's dive pin and mutant follow the trouble's foes to their module
- `4410dd1d35` BAY-LEFT-GROUND: the road's trouble on the land's own wild past the Bay (D2)

## What each package covers (the audit's item numbers and lane ids, `Audit-Left-In-The-Bay.md`)

- WP1 gates: Oblivion Gates in every province (A2), a province gate's kill credits its seats (A2b), the province scans
  in idle time (A2c), the Sky-Ketch in every province (A4).
- WP2 starfall: WW5 - Starfall's covens and the Hollows in every province (item 26).
- WP3 raids: WW6 - raids and staff town events past the Bay (item 27).
- WP4 dungeons: the build hole (A1, fixed), online spawned dungeons and Elite past the Bay (A3), Ocean Holes pits past
  the Bay (35), the Overworld's dungeons past the Bay (C4), the bounty boards' quarry by the land's own fauna (37).
- WP5 quests: Legacy heirs past the Bay (B1), %di (B3), Where-is (B4), map reveals (B5/C8), scrying (B6), %lp (B7),
  house sales in Arena towns and the countryside (32).
- WP6 courts: the factions past the Bay (item 33) and the vampire-clan guard.
- WP7 maps: held-map marks (C1), waypoints (C2), places by summary / passages / far plates / quest press (C3), the
  Find box (C9), Travel Options' roads (C10), held-map gaps (C11), Come Sail Away's map (C12), the building discovery
  key (C7/E2).
- WP8 sea: harbourmasters past the Bay (C5), the capitals' harbours (C6), the market's hubs (B2/E1), the Bounty edict
  past the Bay (B8/E3), staff /town audit (E4), weather born at sea (D4).
- WP9 ground: the landforms' site pull past the Bay (D1), road trouble's fauna (D2), the Snowfall mod past the Bay
  (D3), landformLiftAt past the Bay (D5).

## The owner's calls, taken ("Every single thing here needs to be addressed. No exceptions.", 2026-10-26)

- Gate lanes 1..8 open; Cyrodiil's lane never (the open zone).
- Site-bound world events (gates, covens, Hollows, the ketch, raids) stand nowhere in the open zone.
- One Sky-Ketch station per province, at its crown capital.
- A province's covens are authored as content.
- Online spawns past the Bay in a world id lane.
- A harbourmaster past the Bay keeps the nearest Bay crown's board.
- The Bounty edict past the Bay pays on hideouts and lairs.
- The landforms' sites past the Bay come from places every client stands (GROUND-AGREE).
- A vampire bloodline is mapped per province.

## Left to do

1. Finish each package to its brief (`FIXBRIEF.md`): the WIP commits' tests, mutants (all dead), records, the bible
   gates, lint, types, `npm run cites -- --check`.
2. Stale doc lines still open, in the packages' areas: WW2 "a gate past the Bay credits none" and WW2 "Opening a lane"
   against AUDIT TESA II P7 (WP1); WW3 "The crowns ... until WW-R" (WP8); Travel-View VOYAGER2.1 "its trips stay on the
   Bay" (WP7); Audit-Release-R2.md scrying "no region table" (WP5). Check each package fixed its own.
3. Merge each package branch into `ccr-e60534fb-hlob1p`. Expect conflicts in `src/scenes/world.js`, `src/net/wire.js`,
   `server/src/index.js`, `locales/*`, `bible/03-World/World-Wide.md`, `Port-Ledger.md`, `Active-Arcs.md` and the
   host ceilings in `test/scenes/hostceiling.test.js` (recompute them after the merges).
4. Re-hash relay `world270` in place in `test/net/relayversion.test.js` (NOT YET DEPLOYED), and write the
   RELAY_VERSION / ACCOUNT_VERSION (`acct196`) notes once. Note that main has since merged #1322 (WOVEN-PAYS) as
   account acct196: the base branch's next merge of main will collide on that number.
5. Record the audit at `bible/01-Overview/audits/Audit-Left-In-The-Bay.md` with each finding's fix, its Page-Index
   line and an Active-Arcs line.
6. The full suite with `ARENA2_PATH` (`sh tools/fetch-data.sh`), push, PR #1321's description (patch notes, What
   changed, Verification - LOOT-GATE: no loot-gate numbers), CI green.

## Files here

- `Audit-Left-In-The-Bay.md`: the audit's record (38 findings, the stale lines, the coverage).
- `BRIEF.md`, `LEDGER.md`: the audit's lane brief and ledger.
- `FIXBRIEF.md`: the shared brief every fix package was given (the laws, the checks, the report).
- `AGENTS.md`: the packages and the agent ids that ran them.
- `probes/<lane>/`: the lanes' probes, which reproduce each finding on the freeware data; `probes/me/` the lead's.
