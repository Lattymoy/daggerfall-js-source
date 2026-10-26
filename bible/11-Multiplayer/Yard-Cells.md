# YARD-CELL - a town's yards kept, synced and stood by block (PLAN, 2026-10-26)

**Status: PLAN. Nothing is built.** The owner approves this plan before any slice is built. The plan replaces the
whole-town yard snapshot that YARD-SNAP (`Scale-Arc.md`) built and YARD-TOWN (`06-Systems/Online-Arc.md`, merged as
#1276) bounded at 6,500 pieces a town.

The owner and a maintainer judged YARD-TOWN a band-aid. The owner: "this project is an mmorpg with one of the largest
world sizes ever already - these types of things need to be scalable, we should not be taking shortcuts." The owner
also asked that the design fit the work already planned, above all the rest of Tamriel (#1184, TESA with WORLD-WIDE).

## 1. What is wrong with the yards today

Each yard bound below was read on main at 9aa6bc4662. None of them comes from a game rule.

| Bound | Value | Where | What it comes from | Can a player meet it? |
|---|---|---|---|---|
| `DECOR_YARDS_TOWN_MAX` | 6,500 pieces a town | `src/net/decorLaw.js` | one 1.5 MB D1 row a town (`keptBoard.js` KEPT_BOARD_MAX_BYTES / a 216-byte row) | yes: "This town's yards hold ... the most a town can" (`yard-town-full`) |
| `YARDS_SETTLE_A_MINUTE` | 50 towns a minute | `server-account/src/decor.js` | arbitrary | no, but a cascade's town waits for it |
| `YARDS_KEPT_MAX` | 4,096 towns an isolate | `server-account/src/decor.js` | arbitrary; past it every kept town is dropped at once | no |
| `HOME_TOWN_MAX` | 512 homes a town answer | `src/net/homeLaw.js` | "the widest, Daggerfall's, 316" - wrong, see section 2 | yes, indirectly: a home past it stands no yard |
| `YARD_STANDS_A_FRAME` | 4 yards a frame | `src/scenes/homeYards.js` | measured once on one machine, in map order | no, but the far side of a city stands before the near side |

The costs grow with the town, not with what changed:

- **A write rebuilds the town.** Every decor route that moves a yard piece awaits `settleYards`, which reads every yard
  row of the town and writes one JSON row of up to 1.5 MB (the decor routes in `server-account/src/index.js`, after
  `forgetYards`).
- **Every player downloads the whole town every minute.** `homeYards.js` asks `/v1/homes/yards` again each
  `YARD_TOWN_TTL_MS` (60 s) and the answer carries no version, so an unchanged town is sent whole: about 144 bytes a
  piece, 0.9 MB for a town at 6,500 (YARD-TOWN's own figure).
- **The client stands yards in map order.** `sync` walks the built pixels and their homes in insertion order and stops
  after `YARD_STANDS_A_FRAME`; the yard beside the player can wait behind the far side of the town.
- **The minute's clock scans every town.** `settleStaleYards` asks, for each row of `home_yards_ver`, whether its built
  row is fresh. That is a walk of every town that ever stood a yard piece, once a minute.
- **One per-isolate map never shrinks.** `yardWrites` in `decor.js` gains one entry for each town written in the
  isolate and is cleared only by the tests' reset. Its comment bounds it by "the towns", which is 15,251 on the Bay
  and about 241,000 places with TESA (section 4).

## 2. The ground, measured

Measured on 2026-10-26 from ARENA2 with the repository's own readers (`formats/blocksFile.js`, `formats/mapsFile.js`):
every location of MAPS.BSA with an exterior, every RMB block it names.

| Quantity | Measured | Note |
|---|---|---|
| Locations with an exterior | 15,251 | the Bay |
| Blocks a town | at most 8 x 8 | `HOME_TOWN_BLOCKS_MAX` 64 |
| Buildings a block | at most 25 (GRVEAS07.RMB) | the block's record list has 32 slots (`blocksFile.js` buildingDataList) |
| Buildings a town | at most 647 (Daggerfall) | Wayrest 643, Sentinel 410 |
| Houses (House1-House6) a town | at most 506 (Wayrest) | Daggerfall 484; 135 towns hold more than 300 |
| Houses a block | at most 25 | |
| Houses in all | 371,151 | |
| Map ids (MAPS.BSA's map table, the homes' `map_id`) | 1,001 to 0x7283288C | fits 31 bits; `homeMapIdOk` takes 32 |

So `HOME_TOWN_MAX` (512) is six above Wayrest's houses, before any guild hall, and its comment is wrong.

## 3. The design

### 3.1 The cell

A **cell** is one RMB block of one town: `(map_id, cell)`, where `cell = building_key >> 8`. A building key is
`(blockX << 16) + (blockY << 8) + record` (`systems/talk/talkTopics.js` makeBuildingKey), so `building_key >> 8` is
`(blockX << 8) + blockY`.

The one key that is not in that form is `BUILDING_KEY_0` (`1 << 24`, block (0, 0), record 0). Its cell is `65536`. The
plan keeps that and adds no special case: a cell is a partition key, not a place. The client finds a cell's place from
the buildings in it (section 3.5). A town therefore has at most 65 cells: 64 blocks and that one key.

What a cell holds is bounded by the game:

- A block has at most 32 building records (BLOCKS.BSA's fixed list; 25 is the most any block uses).
- A yard holds at most `DECOR_YARD_CAP` (60) pieces.
- So a cell holds at most 32 x 60 = 1,920 pieces. At the widest row the yard's law allows (216 bytes), that is about
  415 KB - under a quarter of `KEPT_BOARD_MAX_BYTES` (1.5 MB). A cell's built row never passes the kept bound unless a
  block's record list grows past 115, which BLOCKS.BSA's format does not allow. A test pins this with the format's 32,
  so it needs no ARENA2.

### 3.2 Schema (migration 0176_yard_cell, account service acct193)

```sql
-- a cell's version, moved by the database on every yard row written; `built`, the version its row was last built at
CREATE TABLE home_yard_cell_ver (
  map_id INTEGER NOT NULL,
  cell   INTEGER NOT NULL,
  ver    INTEGER NOT NULL DEFAULT 1,
  built  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (map_id, cell)
) WITHOUT ROWID;
-- the cells whose row is behind their version: the clock reads this index, never the whole table
CREATE INDEX idx_home_yard_cell_stale ON home_yard_cell_ver (map_id, cell) WHERE ver <> built;
-- a cell's rows as the read takes them, kept at `built`, in `shape`
CREATE TABLE home_yard_cells (
  map_id INTEGER NOT NULL,
  cell   INTEGER NOT NULL,
  built  INTEGER NOT NULL,
  shape  TEXT NOT NULL,
  rows   TEXT,
  PRIMARY KEY (map_id, cell)
) WITHOUT ROWID;
```

- **The version row stays narrow.** The rows' text lives in `home_yard_cells`, as YARD-SNAP split them (AUDIT LEAN-READS
  2 B3: a version kept beside the text rewrote the text on every write). `built` in the version row costs one integer
  and lets a partial index find the stale cells.
- **Three triggers on `home_decor`**, as 0136's: an INSERT of a yard row bumps its cell, a DELETE bumps its cell, and an
  UPDATE bumps the OLD row's cell and the NEW row's cell. A home moved to another key (`homes.js` arenaMoveHome carries
  its decor rows) and a row moved in or out of the yard move both cells. A version row made for the first time starts
  past any version its cell was kept at (0136's AUDIT LEAN-READS 2 B4 rule).
- **No new index on `home_decor`.** A cell's rows are one key range of 0136's `idx_home_decor_yard_order`
  `(map_id, yard, building_key, placed_at, id)`: `building_key BETWEEN cell << 8 AND (cell << 8) + 255`. The cell
  `65536` is the range of `BUILDING_KEY_0` alone. No sort.
- **Backfill in the migration**, as 0136 and 0175 did: a version row and a built row for every cell that holds a yard
  piece, in the shape the code reads.
- **Kept for rollback, dropped later.** `home_yards`, `home_yards_ver` and their triggers stay through YC1 and YC2.
  Nothing builds a town row any more; the old triggers still move the town's version, so acct192's read (the rows as
  they stand where the built row is behind) stays correct if the service is rolled back. YC3 drops them.
- **The number.** 0176 and acct193 are the next free ones on main today. #1184 carries 0174-0177 and acct189 on its
  branch and renumbers at its merge, as its own pages say; whichever lands second renumbers.

### 3.3 Writes

- **No town-wide cap.** `DECOR_YARDS_TOWN_MAX`, `TOWN_ROOM_SQL` and the `yard-town-full` refusal go. A yard piece is
  bounded by the game's own rules: `DECOR_YARD_CAP` (60) a yard, `DECOR_YARD_POS_MAX` and `DECOR_YARD_HIGH` for its
  place, and how many homes an owner may hold (`HOME_CAP`). A guild hall's yard keeps its own rule (GUILD-YARD).
- **A write rebuilds one cell.** The decor routes call `settleYardCell(db, mapId, cellOf(buildingKey))` in place of
  `settleYards(db, mapId)`: one statement that reads at most 1,920 rows of one key range and writes one row of at most
  415 KB, and sets `built` in the version row. A chest's use moves no yard and builds nothing, as today.
- **The clock builds what a cascade left.** `settleStaleYardCells` reads `idx_home_yard_cell_stale` and builds the
  stale cells it finds, a page a firing. A cascade (a home released, an account deleted, a sweep) is the only writer
  that leaves a cell stale, so the page size paces the clock and is never seen by a player: a stale cell is read as its
  rows stand until it is built.
- **A deploy that changes the shape** marks every cell stale in its own migration (`UPDATE home_yard_cell_ver SET
  built = 0`), so the clock finds them by the index and nothing scans for a shape.

### 3.4 Reads: the cell route

`POST /v1/homes/yards/cells`, answered before the session check like `/v1/homes/yards` (YARD-SHED: its answer is every
caller's alike).

- **Request:** `{ mapId, cells: [[cell, ver], ...] }`, nearest cell first. `ver` is the version the client holds, 0
  for none. At most 65 cells (a town's whole), so a request is bounded by the game, not by a count we chose.
- **Answer:** `{ mapId, cells: [{ cell, ver, yards: [{ buildingKey, pieces }] }], more }`. Only the cells whose version
  differs from the client's are sent; a cell the client holds at its version is left out. The cells are answered in
  the request's order until the answer's text reaches a byte budget (about 1 MB, chosen at the build by measurement);
  the first changed cell is always answered whole. `more` lists the changed cells left out, and the client asks for
  them in its next request.
- **A version never goes back.** The read is a replica's (YARDS-REPLICA) or an isolate's kept answer, so it can be
  behind what the client already holds. Where the client's version is newer, the cell is answered as unchanged and the
  client keeps what it has. Versions only climb (the triggers), so "newer" is a plain comparison.
- **One statement** reads the versions of the asked cells and the built rows of the changed ones (`json_each` over the
  request). A cell whose built row is behind its version, or of another shape, is read as its rows stand - never an
  answer older than the rows (YARD-SNAP's rule, kept).
- **The rate.** The route stays under `overAccountRate('yards:<ip>')` (240 a minute). A first load of the widest town
  at the law's maximum (Wayrest's 506 houses x 60 pieces, about 4.4 MB) is five requests; a minute's poll is one. The YC1
  test counts the requests a first load of that town takes, so the budget and the rate are checked against each
  other.
- **The isolate's kept answers** are kept per cell, `(mapId, cell) -> { at, ver, answer, bytes }`, for `YARDS_KEPT_S`
  (30 s), in a map bounded by bytes (least recently used dropped first, never the whole map at once). A write in this
  isolate drops that cell's entry and reads it next from the primary (YARDS-REPLICA's rule, per cell). The write
  counter that stops an answer read before a write from being kept lives on the in-flight read, not in a map keyed by
  town, so nothing in the isolate grows with the number of towns.

**The old route during the change.** `/v1/homes/yards` stays answered for builds from before YC2. It reads the town's
cell rows (at most 65) and answers them in building-key order, cut at 6,500 pieces as it is cut today. An old build in
a town past 6,500 sees the town as it saw it under YARD-TOWN until it updates; nothing is lost from the database. The
route logs how often it is asked, and YC3 removes it when that falls to nothing.

### 3.5 The client

The town-wide cache in `homeYards.js` (`towns`, `ensure`) is replaced by a module of its own,
`yardCells.js` beside it in `src/scenes`, which `homeYards.js` wires. The module owns which cells to ask, the versions
held, the request and the merge; `homeYards.js` keeps the standing, the lots and the decorator.

- **Which cells.** The cells that hold a home the town's homes answer lists, within `YARD_ASK_M` (YARD-SHED's reach,
  the draw reach and 200 m) of the player's feet. A cell's distance is its nearest such home's (`homeFrames`). A yard
  only stands for a listed home, so a cell with none is never asked.
- **When.** At once for a cell that comes into reach; then each `YARD_TOWN_TTL_MS` (60 s) for the cells in reach, as
  one request with their versions. A poll of an unchanged town is a list of versions out and an empty list back.
- **Memory follows reach.** A cell that leaves reach (with a margin, so a step back does not ask again) is dropped with
  its yards. What a client holds depends on how much it can reach, not on how large the town is.
- **Nearest first, on a time budget.** The yards that wait to be stood are stood nearest first, while the frame's
  standing time is under a budget, and always at least one a frame. The budget is set at the build by YARD-TOWN's own
  method (Daggerfall's city on a local build, the live yards and a filled town given by the probe, the longest frame
  of the landing read), with the target that the landing adds no frame longer than YARD-TOWN's measured 33 ms. It
  replaces `YARD_STANDS_A_FRAME`. The owner's own yard and the one the decorator stands in never wait, as today.
- **Kept as they are:** YARD-STALE and `YARD_WRITE_HOLD_MS` (the owner's own write stands over any answer for 60 s),
  the failure back-off (`yardRetryMs`, now per town's request), HOME-VOTE's hiding, YARD-RANGE's draw.
- **The refusal text.** `account.refusal.yardTownFull` and its drafts in every language go; no service says it after
  YC1.

### 3.6 What does not change

- No relay change. Yards are the account service's and the client's.
- Yards stand in `scenes/world.js` alone. `scenes/exterior.js`, `scenes/worldModes.js` (interiors) and
  `scenes/dungeonContext.js` stand none. No host grows: the new client code is `yardCells.js`, wired by `homeYards.js`.
- `keptBoard.js` is not edited. Its other tenants, the vendor board (`market.js`) and the arena board (`arena.js`),
  keep their rows and shapes.
- The routes the account deploy's smoke calls (`/v1/homes/town`, `/v1/homes/claim`, `/v1/homes/decor`,
  `/v1/homes/decor/place`, pinned in `test/systems/home2.test.js` and by #885) keep their names.

## 4. How it fits the rest of Tamriel (#1184)

Read on #1184's branch (draft, head `ccr-b2e6795e-z6ckz1`) on 2026-10-26: its `world/arenaLocations.js`,
`world/tamrielCountry.js`, `world/tamrielCapitals.js`, `net/homeLaw.js`, and its pages `03-World/World-Wide.md`,
`03-World/Arena-Provinces.md`, `03-World/Town-Shapes.md` and `03-World/Tamriel.md`. None of these is on main yet.

- **Building keys do not change.** Arena's places and the countryside are clones of MAPS.BSA templates, and a capital
  is cut into slices of at most 8 x 8 blocks of Bay RMB blocks. Town-Shapes.md on the branch says the grid, its blocks
  and every building key are Daggerfall's. Block x and y stay under 8 and the record index stays inside a block's list,
  so `cell = building_key >> 8` holds past the Bay. No key needs widening.
- **Map ids stay 32-bit, in new lanes.** Arena's places take `(0xA7 << 20) | (500000 + n)`; the countryside takes lanes
  0x300-0x33F with 0x80000 set; lairs 0x340; capital slices 0x341, each slice its own location and its own map id. Bay
  ids stay under 500,000 in their low 20 bits, so none collides. `home_yard_cell_ver` and `home_yard_cells` key on the
  same `map_id INTEGER` the homes use, so a new lane needs no yard change. The branch's sources disagree on how many
  slices the Imperial City has; the plan depends only on each slice being its own map id of at most 8 x 8 blocks.
- **Homes past the Bay are buyable when #1184 deploys** (WW7-5 on the branch: `HOME_REGION_MAX` 61 to 70, and the
  online purchase path checks no place kind). The branch does not touch yards or decor, so those homes get yards
  through this design unchanged.
- **The counts grow by an order of magnitude.** About 226,000 rolled countryside places (about 92,000 of them farms,
  manors and poor homes), 283 Arena places and the capital slices join the Bay's 15,251. That is why every per-isolate
  structure here is bounded by bytes or by what is in flight, never by a town count, and why the clock reads a stale
  index instead of every town. The two current offenders are named in section 1: `yardWrites` and the clock's scan.
- **One migration.** Because the keys do not change, adding Tamriel needs no second yard migration: its towns' cells
  are made by the triggers the first time a yard piece is placed there.

## 5. Other work on the same ground

Searched on 2026-10-26: the open pull requests of Lattymoy/daggerfall-js-source, and its pull requests and issues by
yard, YARD-SNAP, YARD-TOWN, decor, home yard and "town full".

- **#1184 TESA** (draft): section 4. Its migrations 0174-0177 already collide with main's 0174 and 0175.
- **START1-3 (#1216)** merged into #1184's branch, not main, and touches no homes, yards, decor, building keys or the
  account service.
- **#1296 and #1294** both re-aim `tools/mutants/decor1.json` to the 409 line of the decor routes in
  `server-account/src/index.js` (the line that now ends `|| r.error === 'decor-busy'`). YC1 does not edit that line
  (`yard-town-full` is not in its set), but it edits the settle a few lines above it, and the mutant record's anchor
  can move with any edit near it: rebase on whichever lands first.
- **#1207 GUILD-PANE** moves one host pin in `test/net/guild_yard.test.js`; no conflict with the design.
- No issue is open on the yards; #1134 matched "yard" and is about fast travel.
- Related merged work: #1276 YARD-TOWN, #1068 LEAN-READS (YARD-SNAP, `keptBoard.js`), #640 YARD-SHED, #881 HOMES-SHED,
  #537 GUILD-YARD.

## 6. A decision for the owner: the town's homes answer (D2)

A yard stands only for a home the town's homes answer lists (`homeYards.js` sync reads `homes.homeAt`). That answer
lists at most `HOME_TOWN_MAX` (512) homes, in building-key order (`homes.js`). Wayrest has 506 houses (section 2),
guild halls are homes too, and the capital slices past the Bay are not measured. A town past 512 homes would hide the
yards (and the doors) of its eastern blocks - the same fault YARD-TOWN fixed for the yards.

**Recommendation:** a slice of its own after YC2, with the same shape as this plan: the homes answer by cell and by
version. Until then, raise `HOME_TOWN_MAX` to the most buildings a town can hold (64 blocks x 32 records = 2,048, the
format's bound) and correct its comment, so no town the game can make is cut. That raise is one constant and its test;
it can ride YC1 if the owner prefers.

## 7. Risks

- **The backfill's time.** 0176 builds every cell in one migration, as 0136 and 0175 built every town. The cell build
  reads the same rows in smaller groups; the YC1 test times the migration over a database filled to Daggerfall's live
  count and to the law's maximum for one town.
- **Rollback.** acct192 reads `home_yards`, which nothing builds after YC1. Its triggers keep the town versions moving,
  so a rolled-back service reads the rows as they stand: correct, and as slow as before YARD-SNAP until the clock
  catches up. YC3 drops the old tables only after YC2 has been live without a rollback.
- **Old builds in towns past 6,500.** They see what YARD-TOWN served until they update (`updateNotice.js` tells a
  running page a new build exists). Nothing is lost.
- **A replica behind a client.** Handled by "a version never goes back" (section 3.4); pinned by a test.
- **A key moved between cells** (arenaMoveHome). Both cells move by the UPDATE trigger; pinned by a test.
- **Conflicts at the merge:** #1184's migration and version numbers, and #1296/#1294 near the decor routes' 409 line.

## 8. How it will be proven

**In the suite (YC1, YC2):**

- Over the real Worker: a town filled past 6,500 yard pieces accepts the next one; a yard's 61st is still refused as
  `yard-cap`; a write rebuilds its own cell's row and leaves every other cell's `built` untouched; a cascade leaves its
  cell stale and the clock builds it from the stale index.
- A cell at the law's maximum (32 buildings x 60 pieces, every row the widest the law allows) is kept in its built row,
  under `KEPT_BOARD_MAX_BYTES`.
- The cell route: unchanged cells left out; the byte budget and `more`; a client version newer than the read's answered
  as unchanged; a request of 66 cells refused; a map id in a past-the-Bay lane (0x80000 set) and the `BUILDING_KEY_0`
  cell served like any other.
- The UPDATE trigger moves both cells when a home's rows move to another key.
- The old route: the town's cells concatenated, cut at 6,500, in building-key order.
- The client module (`yardCells.js`), run with fakes: only cells with listed homes within reach asked, nearest first;
  versions sent; a cell that leaves reach dropped; standing nearest first under the budget.
- Mutation records for the new tests, as YARD-TOWN's `tools/mutants/yard_town.json`.

**In the running game (YC2, when a slot is free):**

- **The field report again.** In Daggerfall's city, place a yard piece at a home in the eastern blocks (block column 5
  or more), restart the game, and see it standing - the report YARD-TOWN answered.
- **The landing.** YARD-TOWN's probe, again: the live city and a filled city, the longest frame of the landing and the
  order the yards stand in (nearest first).
- **Two clients.** Two characters in one town on a local relay and account service. A places a piece in a far cell; B
  sees it within a poll and its kept answer's 30 s. B's network log shows its poll answer carries that one cell, and an
  unchanged poll carries none.

## 9. The slices

| Slice | What | Deploy |
|---|---|---|
| YC1 | Migration 0176 (cell tables, triggers, backfill), `settleYardCell`, the stale clock, the cell route, the per-cell kept answers, the town cap removed, the old route answered from cells | account service acct193, before the site |
| YC2 | The client module `yardCells.js`, nearest-first standing on a time budget, the refusal text removed | the site, after YC1 is live |
| YC3 | The old route removed; `home_yards`, `home_yards_ver` and their triggers dropped | account service, after YC2 has been live without a rollback and the old route's log is empty |
| D2 | The town's homes answer by cell (section 6), if the owner approves | its own slice |

Each slice is its own pull request, opened as a draft and made ready only after its in-game check.
