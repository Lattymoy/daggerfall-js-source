# YARD-CELL - a town's yards kept, synced and stood by block (2026-10-26)

**Status: YC1 BUILT (section 10), the owner's final approval given 2026-10-26; YC2, YC3 and YC4 to come.** The plan was
revised with the owner's answers before it was approved. The plan replaces the whole-town yard snapshot that YARD-SNAP (`Scale-Arc.md`) built and
YARD-TOWN (`06-Systems/Online-Arc.md`, merged as #1276) bounded at 6,500 pieces a town.

The owner's answers to the first draft, each worked into the sections named:

1. **Updates are pushed, with a slow poll as the safety net**, and the poll is skipped wherever it cannot matter
   (sections 3.6 and 3.7).
2. **Old builds are told to update.** The old whole-town route is refused from YC1 on, not answered cut at 6,500
   (section 3.4).
3. **YC1 lands on main before #1184**; #1184 renumbers at its merge. YC1's tests measure the capitals' own blocks
   against #1184's branch (section 4.1).
4. **`HOME_TOWN_MAX` goes to 2,048 inside YC1**, its comment corrected; the homes answer by cell is a slice of its own
   after the yards (section 6).

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

- A block of Daggerfall's has at most 32 building records (BLOCKS.BSA's fixed list; 25 is the most any block uses).
- A yard holds at most `DECOR_YARD_CAP` (60) pieces.
- So a cell holds at most 32 x 60 = 1,920 pieces. At the widest row the yard's law allows (216 bytes), that is about
  415 KB - under a quarter of `KEPT_BOARD_MAX_BYTES` (1.5 MB). A cell's built row never passes the kept bound unless a
  block holds more than 115 buildings, which BLOCKS.BSA's format does not allow. A test pins this with the format's 32,
  so it needs no ARENA2.
- **Not yet shown for blocks the port builds itself.** #1184's capitals stand blocks of their own (section 4.1), which
  BLOCKS.BSA does not hold. Their building count is bounded only by the key's record byte (256), and 256 x 60 pieces
  would pass the kept bound. YC1 must show they hold at most 32 (section 4.1, gap 1).

### 3.2 Schema (migration 0183_yard_cell, account service acct205)

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
- **Kept for rollback, dropped later.** `home_yards`, `home_yards_ver` and their triggers stay until YC1 has been
  live without a rollback. Nothing builds a town row any more; the old triggers still move the town's version, so
  acct192's read (the rows as they stand where the built row is behind) stays correct if the service is rolled back.
  YC3 drops them.
- **The number.** 0183 and acct205 (0176 and acct193 when this was written, renumbered past main's numbers at the merges, last past the horizontal slices' 0179 to 0182 and LEVEL-45's acct204) are the next free ones on main. #1184 carries 0174-0177 and acct189 on its
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

**The old route is refused from YC1 on** (the owner's answer 2). `/v1/homes/yards` answers `410` with the word
`client-update` and reads nothing. YC1 carries the service and the client together, so the build that asks the cell
route is the build the site publishes with it.

- **What an old build shows for it.** Checked on main: nothing. `homeYards.js` `ensure` reads any answer that is not
  `ok` as a failed ask and backs off (`yardRetryMs`, 10 s doubling to 5 minutes); no yard of a stranger stands, and no
  sentence is said. No shape of this route's answer makes an old build say anything: the build reads only `ok` and
  `data.yards`. An unknown word reaches a player only through a write's refusal, where `accountRefusalText` turns it
  into "The account service had a problem. Try again." - the wrong sentence.
- **What tells an old build to update.** SRV-N's build notice (`net/updateNotice.js`): a page polls the live site
  every `BUILD_POLL_MS` (10 minutes) and says in the chat window that a new version is out and a reload brings it.
  The site's deploy waits until the account service serves the build's `ACCOUNT_VERSION` (`deploy.yml`, "Wait for the
  account service to serve this build's version"), so an old page loses its strangers' yards when YC1's service
  deploys and hears the notice within ten minutes of the site going live, minutes later. That notice is the "please
  update" an old build shows; YC1 adds nothing an old build could read.
- **The desktop app.** It bundles its build and updates in its launcher before play (`01-Overview/Desktop-App.md`). A
  desktop session open across the deploy has no yards of strangers until it is restarted, and the launcher then
  updates it.
- **Writes from an old build still land.** Placing, moving and removing a yard piece use the same routes, and the
  service accepts them as before; only the old read is refused. Nothing an old build writes is lost.
- **So YC3's route removal folds into YC1.** What stays for YC3 is dropping the old tables (section 3.2), which the
  rollback story needs until YC1 has been live without a rollback.

### 3.5 The client

The town-wide cache in `homeYards.js` (`towns`, `ensure`) is replaced by a module of its own,
`yardCellSync.js` beside it in `src/scenes`, which `homeYards.js` wires. The module owns which cells to ask, the versions
held, the request and the merge; `homeYards.js` keeps the standing, the lots and the decorator.

- **Which cells.** The cells that hold a home the town's homes answer lists, within `YARD_ASK_M` (YARD-SHED's reach,
  the draw reach and 200 m) of the player's feet. A cell's distance is its nearest such home's (`homeFrames`). A yard
  only stands for a listed home, so a cell with none is never asked.
- **When.** At once for a cell that comes into reach; on a push that names a cell it holds at an older version (section
  3.6); and on the poll, as one request with the versions of the cells in reach. A poll of an unchanged town is a list
  of versions out and an empty list back. The poll's interval and when it is skipped are section 3.7's.
- **Memory follows reach.** A cell that leaves reach (with a margin, so a step back does not ask again) is dropped with
  its yards. What a client holds depends on how much it can reach, not on how large the town is.
- **Nearest first across towns.** The cells in reach are ranked by distance across every town whose homes are in reach,
  not within one town. Where towns meet - above all the Imperial City's slices (section 4.1) - the nearest yards
  belong to the next town. The asking is ranked the same way: one request per town, sent nearest town first.
- **Nearest first, on a time budget.** The yards that wait to be stood are stood nearest first, while the frame's
  standing time is under a budget, and always at least one a frame. The budget is set at the build by YARD-TOWN's own
  method (Daggerfall's city on a local build, the live yards and a filled town given by the probe, the longest frame
  of the landing read), with the target that the landing adds no frame longer than YARD-TOWN's measured 33 ms. It
  replaces `YARD_STANDS_A_FRAME`. The owner's own yard and the one the decorator stands in never wait, as today.
- **Kept as they are:** YARD-STALE and `YARD_WRITE_HOLD_MS` (the owner's own write stands over any answer for 60 s),
  the failure back-off (`yardRetryMs`, now per town's request), HOME-VOTE's hiding, YARD-RANGE's draw.
- **The refusal text.** `account.refusal.yardTownFull` and its drafts in every language go; no service says it after
  YC1.

### 3.6 The push (the owner's answer 1)

A cell's new version reaches the players who hold it as it happens. The relay already carries the account service's
word to every page online: QUEST-HOME's HOME ORDER (`net/identityToken.js` mintHomeOrder, the relay's `t: 'home'` arm in
`server/src/index.js`). The service signs an order for an act that moves a home; the acting player's client carries it
to the hub; the hub checks the signature with the key it already holds and fans the word to every socket. The yard's
push is the same shape.

- **The order.** A decor route that moves a yard (place, move, hide, remove, a batch) answers with a signed YARD ORDER
  beside its answer: `{ o: 'yard', s, m, c, v, e }` - account `s`'s act moved town `m`'s cell `c` to version `v`. `v` is
  the version the route's settle built (`settleYardCell` returns the version it read, in the same statement that built
  the row), never a number the client says. `yard` joins `ORDER_KINDS`; the order's time to live is the HOME ORDER's.
- **The carrier.** The acting client sends `{ t: 'yard', order }` to the hub. It sends it only to a relay whose welcome
  says it hears yard words (a field the new relay adds to the hub's welcome), so no build ever sends an older relay a
  frame type it does not know.
- **The room: the hub, not the town.** In the streaming world a town's room is its map pixel's (`net/online.js`
  roomKeyFor, `worldRoom`), and a player within reach of a town's edge can stand in the next pixel. That is every
  Imperial City slice's edge (section 4.1). The hub is the one room every online player holds a socket to, as
  QUEST-HOME chose it for the same reason. A page that holds no cell of that town drops the word unread.
- **One frame a second at most.** The hub meters each carrier (a gate of its own, as `homeGate` meters home orders,
  before the signature is checked) and gathers the words it verified into one frame,
  `{ t: 'yard', l: [[m, c, v], ...] }`, sent at most once a second, with the highest `v` for a cell kept. The fan's cost
  follows the second, not the number of placements. Unlike home words, yard words are not held for late joiners: a
  page that joins asks its cells anyway.
- **What a page does with one.** A word for a cell it holds at an older version asks that cell, after a random wait
  of up to two seconds so a town's pages do not ask in the same instant. The isolates' kept answers (30 s) take most of
  those asks. A word for a cell it holds at that version or newer is dropped.
- **Reordered, repeated or missed.** Versions only climb, so a word older than what a page holds is dropped, and the
  same word twice is one ask at most. A word that never comes - a dropped socket, a full gate, a write with no carrier
  (a home released or an account deleted, whose home leaves the homes answer by its own HOME ORDER, taking its yard
  down) - is found by the slow poll (section 3.7). A word can never put a page's yards wrong, because a page acts on a
  word only by asking the service.
- **The owner's own page** already holds its write (YARD-STALE); its own word is dropped by the version rule.
- **RELAY_VERSION moves** with the order kind and the hub's arm (YC2). Relay pull requests conflict on it at every
  relay merge on main; YC2 renumbers at its merge, as every relay change does.

### 3.7 The slow poll, and when there is none

With the push, the poll is a safety net. Its interval and its skips:

- **The interval.** While the push is healthy, the cells in reach are polled every few minutes
  (`YARD_SLOW_POLL_MS`, 5 minutes to start, set at the build). Without it - no hub socket, or a relay that does not
  hear yard words - the poll stays at today's 60 s.
- **"Healthy"** is a hub socket welcomed by a relay that hears yard words, open without a break since the last poll.
  A break ends it: when the socket is welcomed again, the cells in reach are asked at once (the words of the gap are
  lost, since none is held) and the slow interval starts again. "Delivered recently" cannot be read from silence - a
  quiet town sends no words - so the socket's unbroken life is the test.
- **A quiet reach lengthens it.** Each poll that finds nothing changed doubles the interval, up to 20 minutes. Any
  change in reach - a push, a poll that found one, a cell coming into reach - sets it back to `YARD_SLOW_POLL_MS`.
- **No poll at all** while there is nothing a poll could change on screen. On leaving each state, one catch-up
  request asks the cells in reach with their versions, which costs a list of versions while nothing changed:
  - no home listed in the homes answer within reach (no cell to ask);
  - indoors, in a dungeon, on the travel map, or in a window that hides the world (the yards are not drawn);
  - the tab hidden (`document.visibilityState`), or the desktop window minimised.
- **First loads are not skipped.** A cell coming into reach is asked at once, push or no push.

### 3.8 What does not change

- The relay changes only in YC2 (section 3.6): one order kind and the hub's arm. It keeps no yard state.
- Yards stand in `scenes/world.js` alone. `scenes/exterior.js`, `scenes/worldModes.js` (interiors) and
  `scenes/dungeonContext.js` stand none. No host grows: the new client code is `yardCellSync.js`, wired by `homeYards.js`;
  on the relay, the yard word is a Room method of its own, not a branch of `_message` (HOST-SPLIT).
- `keptBoard.js` is not edited. Its other tenants, the vendor board (`market.js`) and the arena board (`arena.js`),
  keep their rows and shapes.
- The routes the account deploy's smoke calls (`/v1/homes/town`, `/v1/homes/claim`, `/v1/homes/decor`,
  `/v1/homes/decor/place`, pinned in `test/systems/home2.test.js` and by #885) keep their names.

## 4. How it fits the rest of Tamriel (#1184)

Read on #1184's branch (draft, head `ccr-b2e6795e-z6ckz1`) on 2026-10-26: its `world/arenaLocations.js`,
`world/tamrielCountry.js`, `world/tamrielCapitals.js`, `net/homeLaw.js`, and its pages `03-World/World-Wide.md`,
`03-World/Arena-Provinces.md`, `03-World/Town-Shapes.md` and `03-World/Tamriel.md`. None of these is on main yet.

- **Building keys do not change.** Arena's places and the countryside are clones of MAPS.BSA templates. Town-Shapes.md
  on the branch says their grid, their blocks and every building key are Daggerfall's. A capital is cut into slices of
  at most 8 x 8 blocks, some of them Daggerfall's and some the port's own (`TESA<tag><code>.RMB`, section 4.1). In
  every case block x and y stay under 8 and the key keeps its form, so `cell = building_key >> 8` holds past the Bay. No
  key needs widening. What a capital's own block holds is the one bound not yet shown (section 4.1, gap 1).
- **Map ids stay 32-bit, in new lanes.** Arena's places take `(0xA7 << 20) | (500000 + n)`; the countryside takes lanes
  0x300-0x33F with 0x80000 set; lairs 0x340; capital slices 0x341, each slice its own location and its own map id. Bay
  ids stay under 500,000 in their low 20 bits, so none collides. `home_yard_cell_ver` and `home_yard_cells` key on the
  same `map_id INTEGER` the homes use, so a new lane needs no yard change.
- **Homes past the Bay are buyable when #1184 deploys** (WW7-5 on the branch: `HOME_REGION_MAX` 61 to 70, and the
  online purchase path checks no place kind). The branch does not touch yards or decor, so those homes get yards
  through this design unchanged.
- **The counts grow by an order of magnitude.** About 226,000 rolled countryside places (about 92,000 of them farms,
  manors and poor homes), 283 Arena places and the capital slices join the Bay's 15,251. That is why every per-isolate
  structure here is bounded by bytes or by what is in flight, never by a town count, and why the clock reads a stale
  index instead of every town. The two current offenders are named in section 1: `yardWrites` and the clock's scan.
- **One migration.** Because the keys do not change, adding Tamriel needs no second yard migration: its towns' cells
  are made by the triggers the first time a yard piece is placed there.

### 4.1 The Imperial City

Read in Town-Shapes.md on #1184's branch, section 7 (TS5, BUILT): the city is seven map pixels a side, a plan of 56 x 56
blocks about 5.7 km across, its city wall 3.9 km across. Each pixel's 8 x 8 blocks are one slice, its own location and
its own map id: 49 slices. Of the plan's 3,136 cells, 1,003 are the city's own blocks, 625 Daggerfall's, 134 gardens,
820 open ground and 554 lake. A city of another size (7 km by 5 km would be about nine pixels by seven) is another count of
slices, each still at most 8 x 8 blocks, so nothing in this plan depends on the city's size.

What the design does for it:

- **Each player is sent what is near.** Today the unit is a whole slice. A player near a slice's corner is within
  `YARD_ASK_M` of up to four slices and downloads each whole every minute. With cells, a player is sent the blocks with
  homes within reach, from whichever slices they lie in, and after the first load only the blocks that changed.
- **No slice is full.** Today's 6,500 would apply to each slice, and the dense centre slices would meet it first. It
  goes (section 3.3).
- **A write rebuilds one block**, not a slice of up to 64.
- **The isolate's memory holds.** 49 slices are 49 towns to today's per-town structures. The kept answers bounded by
  bytes, and no map that grows by town, hold whatever the slice count.

The three gaps the city shows, each closed in the slice named:

1. **What a city block holds (YC1).** The city's own blocks are the port's, not BLOCKS.BSA's, so the 32-record bound of
   section 3.1 is not shown for them. The capitals' block builder was not among the files read for this plan. YC1 lands
   on main before #1184 (the owner's answer 3), so its test of the capitals cannot import them on main. It is written
   against #1184's builder and skips only while that module is absent: YC1's pull request runs it on a checkout of
   #1184's branch and records the result (the most building records in any capital's own block), and the test runs on
   main from the day #1184 merges. It fails a capital block past 32 building records.

   If a block must hold more, YC1 bounds the cell row by the key's 256 records instead: it splits the kept row of such a
   cell in parts (each part's text under `KEPT_BOARD_MAX_BYTES`) and still serves the cell as one answer. The plan
   does not raise the yard's 60 or cut a block.
2. **Nearest first across slices (YC1).** At a slice's edge the nearest yards belong to the next slice. Section 3.5
   ranks the cells, the requests and the standing across every town in reach; the YC1 client test stands the yards of
   two neighbouring towns in one order by distance.
3. **The city's homes answer (section 6).** A yard stands only for a home in its town's homes answer, at most
   `HOME_TOWN_MAX` a town. Nobody has counted the homes of a dense city slice. The same YC1 test measures the most
   buildings in any capital slice, on #1184's branch first and on main after #1184 merges, and fails a slice past
   `HOME_TOWN_MAX`.

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

## 6. The town's homes answer (decided: the owner's answer 4)

A yard stands only for a home the town's homes answer lists (`homeYards.js` sync reads `homes.homeAt`). That answer
lists at most `HOME_TOWN_MAX` (512) homes, in building-key order (`homes.js`). Wayrest has 506 houses (section 2),
guild halls are homes too, and the capital slices past the Bay are not measured (section 4.1, gap 3). A town past 512
homes would hide the yards (and the doors) of its eastern blocks - the same fault YARD-TOWN fixed for the yards.

**Decided.** YC1 raises `HOME_TOWN_MAX` to 2,048 - the most buildings a town of Daggerfall's blocks can hold, 64 blocks x
32 records - and its comment says that bound and Wayrest's 506 houses in place of "the widest, Daggerfall's, 316". The
answer's bound is a LIMIT on a read; its size still follows the homes a town has. If section 4.1's test finds a capital
block past 32 records, the bound is raised to what that test measures in the same change. The homes answer by cell and
by version, the same shape as the yards', is a slice of its own after the yards (YC4).

## 7. Risks

- **The backfill's time.** 0183 builds every cell in one migration, as 0136 and 0175 built every town. The cell build
  reads the same rows in smaller groups; the YC1 test times the migration over a database filled to Daggerfall's live
  count and to the law's maximum for one town.
- **Rollback.** acct192 reads `home_yards`, which nothing builds after YC1. Its triggers keep the town versions moving,
  so a rolled-back service reads the rows as they stand: correct, and as slow as before YARD-SNAP until the clock
  catches up. A rolled-back service has no cell route, so the site is rolled back with it (YC1 is one release of both).
  YC3 drops the old tables only after YC1 has been live without a rollback.
- **Old builds lose strangers' yards until they reload** (section 3.4): from YC1's service deploy until the build
  notice, at most about ten minutes after the site goes live, and a desktop session until it is restarted. Their
  writes still land. This is the owner's choice over serving them a town cut at 6,500.
- **A push storm.** A town busy with placements sends at most one hub frame a second, and its pages ask only the cells
  they hold, after a random wait, mostly from the isolates' kept answers (section 3.6). YC2's test drives a burst.
- **A relay that drops yard words** (an old relay, a full gate, a dropped socket) leaves the slow poll, never a wrong
  yard: a word only makes a page ask.
- **A replica behind a client.** Handled by "a version never goes back" (section 3.4); pinned by a test.
- **A key moved between cells** (arenaMoveHome). Both cells move by the UPDATE trigger; pinned by a test.
- **Conflicts at the merge:** #1184's migration and version numbers, and #1296/#1294 near the decor routes' 409 line.

## 8. How it will be proven

**In the suite:**

- Over the real Worker: a town filled past 6,500 yard pieces accepts the next one; a yard's 61st is still refused as
  `yard-cap`; a write rebuilds its own cell's row and leaves every other cell's `built` untouched; a cascade leaves its
  cell stale and the clock builds it from the stale index.
- A cell at the law's maximum (32 buildings x 60 pieces, every row the widest the law allows) is kept in its built row,
  under `KEPT_BOARD_MAX_BYTES`.
- The cell route: unchanged cells left out; the byte budget and `more`; a client version newer than the read's answered
  as unchanged; a request of 66 cells refused; a map id in a past-the-Bay lane (0x80000 set) and the `BUILDING_KEY_0`
  cell served like any other.
- The UPDATE trigger moves both cells when a home's rows move to another key.
- The old route: `410` with `client-update`, reading nothing; an old build's `ensure` (main's `homeYards.js`, run with
  fakes) backs off on it without a throw.
- `HOME_TOWN_MAX` is 2,048 and a town of 2,048 homes is answered whole.
- The client module (`yardCellSync.js`), run with fakes: only cells with listed homes within reach asked, nearest first;
  versions sent; a cell that leaves reach dropped; standing nearest first under the budget; two neighbouring towns'
  yards (two Imperial City slices) stood in one order by distance.
- Over #1184's capitals as built (section 4.1): no capital's own block holds more than 32 building records, and no
  capital slice more buildings than `HOME_TOWN_MAX`; run on #1184's branch in YC1's pull request, and on main once
  #1184 merges.
- The push (YC2): a decor write's answer carries a YARD ORDER for its cell at the version its settle built; the hub
  verifies it and refuses a forged or expired one; words of one second go out as one frame with each cell's highest
  version; a relay that does not say it hears yard words is never sent one; a page drops a word at or below the
  version it holds and asks once for a newer one; a burst of words in a town costs one frame a second.
- The poll (YC1's skips, YC2's interval): no request indoors, in a dungeon, on the travel map, with the tab hidden or
  with no listed home in reach; one catch-up on leaving each; the slow interval only while the hub socket is unbroken,
  a catch-up at its welcome after a break; the interval doubling over quiet polls to 20 minutes and back on a change.
- Mutation records for the new tests, as YARD-TOWN's were (its `tools/mutants/yard_town.json`, DELETED by YC1 with the town cap).

**In the running game (each slice, when a slot is free):**

- **The field report again.** In Daggerfall's city, place a yard piece at a home in the eastern blocks (block column 5
  or more), restart the game, and see it standing - the report YARD-TOWN answered.
- **The landing.** YARD-TOWN's probe, again: the live city and a filled city, the longest frame of the landing and the
  order the yards stand in (nearest first).
- **Two clients (YC1).** Two characters in one town on a local relay and account service. A places a piece in a far
  cell; B sees it within a poll and its kept answer's 30 s. B's network log shows its poll answer carries that one cell,
  and an unchanged poll carries none.
- **Two clients (YC2).** The same, with the push: B sees A's piece within about three seconds (the hub's second, the
  random wait, the ask), with no poll between. Then B's hub socket is cut and A places again: B's catch-up at the
  welcome brings it.
- **An old build (YC1).** The build from before YC1 against YC1's service: no strangers' yards, no error on screen, and
  the build notice once the new site is served.
- **The Imperial City, once #1184 is on main.** Stand at a corner where four slices meet, with yard pieces placed in
  each: the yards stand nearest first across the slices, and the polls carry only the blocks in reach.

## 9. The slices

| Slice | What | Deploy |
|---|---|---|
| YC1 | Service: migration 0183 (cell tables, triggers, backfill), `settleYardCell`, the stale clock, the cell route, the per-cell kept answers, the town cap removed, the old route refused (`410`, `client-update`), `HOME_TOWN_MAX` 2,048, the capitals' test (section 4.1). Client: `yardCellSync.js`, nearest first across towns, standing on a time budget, the poll at 60 s with section 3.7's skips, the refusal text removed | one release, on main before #1184: account service acct205 first, the site after it (its deploy waits for the version) |
| YC2 | The push: the YARD ORDER (service), the hub's yard arm and welcome field (relay, RELAY_VERSION), the client's carrier and listener; the slow poll and its doubling | the relay and the service before the site; one release |
| YC3 | `home_yards`, `home_yards_ver` and their triggers dropped | account service alone, after YC1 has been live without a rollback |
| YC4 | The town's homes answer by cell and by version (section 6) | its own slice, after YC2 |

Each slice is its own pull request, opened as a draft and made ready only after its in-game check.

## 10. YC1 - built (2026-10-26)

The service and the client of section 3, in one release (acct205, migration 0183; acct193 and 0176 on its branch, renumbered past main's numbers at the merges, last past LEVEL-45). Departures from the plan above are
named in the second list.

- **The law both ends read**: `src/net/yardCellLaw.js` - `yardCellOf`, the request's shape (`yardCellAskOf`, at most
  YARD_CELLS_ASK_MAX = 65 cells) and the read's bound (YARD_CELL_PIECES_MAX, 256 records of 60).
- **The service**: `server-account/src/yardCells.js` - the build (`settleYardCell`, `settleStaleYardCells` on the
  minute's clock as `yard-cells`), the read (`readYardCells`: the asked cells' versions in one statement, the changed
  cells' rows in a second, a stale cell read as its rows stand) and the isolate's kept cells (`yardCellsKept`: by bytes,
  least recently used first, the evicted bookmark raising the floor, a write's mark sending the next read to the primary,
  and YARD-SHED's shared read of one moment). `server-account/src/decor.js` lost its whole-town read, the town cap and
  `yard-town-full`; `index.js` answers `/v1/homes/yards/cells` before the session, refuses `/v1/homes/yards` with 410
  `client-update`, and a decor write settles its own cell. `HOME_TOWN_MAX` is 2,048.
- **The client**: `src/scenes/yardCellSync.js`, wired by `src/scenes/homeYards.js`, which stands strangers' yards
  nearest first on `YARD_STAND_BUDGET_MS`. The town-full sentence left `net/accountClient.js` and every language.
- **The deploy's smoke** (`account-deploy.yml`): the cell route read off a cell D1 built, the old route's 410 asked until
  this deploy answers it, the kept cells asked of D1 itself.
- **The relay redeploys** as world276 (world266 on the branch, renumbered past AUDIT KETCH II, KETCH-WORDS, NIRNROOT-SAGE, BOW-TOPS, CHAT-POST, MASTER-THREE, RPT1026, APPEARANCES and HUNTERS-MARK, LADDER-CUT, and SD-PARTY): `net/homeLaw.js`, where HOME_TOWN_MAX lives, is in its import graph. No relay behaviour moves.

Departures from the plan:

1. **No poll while mounted, too.** The world host's ceiling is exact (HOST-SPLIT), so the yards host decides when to poll
   from what it is already given: the player on foot in the street (`outside` - which is also false in a saddle), no
   window up (the frame's `overlayUp`, the decorator's own panel included), the page shown. A mounted player's cells in
   reach are still asked as they come into reach; only the poll for others' changes waits for the dismount.
2. **The catch-up is the poll that came due.** Leaving a window does not poll by itself: a poll that came due while
   polling was paused goes at once, and one that did not, at its time. A catch-up on every window closed would have asked
   the service each time the inventory was shut.
3. **The poll's clock starts when its answer lands**, as the town-wide answer's did - an answer slow in flight is not
   asked again the moment it lands.
4. **The owner's own write is laid over the cell when it is read** (`piecesOf`), never written into it. A cell answered
   as unchanged keeps what it holds, so a write written into it would have outlived its hold for as long as the cell did
   not move.
5. **`YARD_STAND_BUDGET_MS` is 3 ms**, set by check 1 below.

**The capitals, measured** (section 4.1, gaps 1 and 3) on #1184's branch at 4d8200b017 with ARENA2: 7 capitals, 57
slices, 1,397 port blocks holding no building record; the most records in any block a slice lays 23 (the Imperial
City's TEMPAAD0.RMB), under the 32 the cells are bounded by; the densest slice the Imperial City's 18th - 794 buildings,
707 houses - past the old HOME_TOWN_MAX of 512 (its 16th slice, 606, the first past it) and inside 2,048.
`test/world/yardcells_capitals.test.js` holds both bounds over every slice; it skips until #1184 is on main.

**Tests**: `test/server/yard_cells.test.js` (the law, the migration's triggers and backfill, YARD-SNAP's oracle carried
to cells with the old town version still moving - the rollback's net, the build and the clock, a cell at the law's
widest, the read, a past-the-Bay map id, the Worker's routes, YARD-SHED's laws, the kept cells), and
`test/scenes/yardcellsync.test.js` (the reach, the poll, the pause, the back-off, nearest-first standing). Replaced and
removed with their mutant records, their laws carried into those two or gone with the code: `yard_snap.test.js` (the
town row), `yard_town.test.js` (the town cap), `yardtown.test.js` (four a frame) and `yardshed.test.js` (the town's
kept answer and its client). `primary_trips.test.js` holds YARDS-REPLICA and its audit's floor a cell at a time; the
tests reading a town's yards read them through the cells (`test/yardCellsRead.mjs`). Mutant records:
`tools/mutants/yard_cells.json` and `yardcellsync.json` (26, all dead), and 18 other files' records re-aimed at the
same laws in their new homes (all dead).

**Check 1, in the running game** (2026-10-26, headed Edge on the RTX 5080, #1304 at 84f27b002d, the account service and
the relay in local workerd - `tools/loadHarness.mjs` standServices; two runs):

- **The field report: PASS.** Daggerfall's city seeded with 539 strangers' yards and 7,000 pieces, past YARD-TOWN's 6,500.
  A registered account's realm character placed a piece at its home in the eastern blocks (column 5, row 4) through the
  service's own place route (answered 200). The game was loaded again, and the home's yard stood with that piece in it.
  Done in both runs.
- **The landing: the target is not met.** Section 3.5 aimed for no landing frame longer than YARD-TOWN's measured 33
  ms; these runs show 38-62 ms. The cell route was held until the town had settled, then let go, and every frame after was timed.

  Run 1: the longest frame was 54 ms at a 6 ms budget, 38 ms at 3 ms and 46 ms at 10 ms (2, 3 and 7 frames over 33 ms).
  Run 2 (the request asked again from where the player stood): 62 ms at 3 ms (26 frames over 33 ms) and 54 ms at 2 ms
  (7). Every yard (515-526) stood within about one second each time. YARD-TOWN measured 38-63 ms for a city of 4,000 at
  four yards a frame. The spread between runs is wider than the budget's effect: most of the landing's long frames are
  other work (the answer's parse, the models' builds). The budget is set to 3 ms, the best measured.
- **Hooks used**: the probe's served-source edits (the yards and homes read out, the budget read from the page), `__pose`,
  `__shotReady` and `__frame`; the homes and the strangers' pieces were seeded into the local database, and the one piece
  placed through the route with the account's secret. The decorator's in-world placement was not driven (canvas clicks do
  not register in a Playwright Edge); YC1 does not change it.
- **Not shown in the game**: the nearest-first order - the whole town stood inside one half-second sample.

**Check 2, two clients, in the running game: PASS** (2026-10-26, the same setup, #1304 at a7b8e26e92). Two registered
accounts' realm characters stood online in Daggerfall's city. B stood by a western home; A's home was 449 m east, in cell
1287.

- Before A's write, B polled every 60 s with the 8 cells in its reach, and both polls of the unchanged town were answered
  with no cell.
- A placed a piece through the place route (200). B's next poll was answered with exactly one cell, 1287, holding the new
  piece, and B's page stood it 61 s after the placement.
- Two runs before this one showed nothing, and they confirmed a skip that works as designed. The intro's and the
  tutorial's pages were still up, and the game holds its pause latch while one is (`overlayUp`), so B never polled. Put
  away with a key each, as a player puts them away, the polls ran.
- **Run again on the head to be merged: PASS** (2026-10-27, #1304 at e062e17fcb, after two merges of main renumbered it
  to acct197, migration 0178 and world270; headless Edge with the pointer lock answered in the page). B's two polls of
  the unchanged town carried no cells. A placed a piece in cell 1287, 449 m away. B's next poll carried that one cell,
  and B's page showed the piece 60.9 s after the write.

**Check 3, an old build, in the running game** (2026-10-26): main's client at 829fc148da against YC1's service (acct196)
and relay in local workerd.

- **Its yards: as section 3.4 says.** It asked `/v1/homes/yards` four times, its back-off between, and was answered 410
  `{"error":"client-update"}` each time. None of the 20 strangers' yards seeded beside the player stood, nothing was said
  on screen, and the page threw nothing.
- **Its writes land.** A yard piece placed through the old build's own client (its `accountDecor` place, the page's fetch
  and storage) was answered ok, and YC1's cell route serves it.
- **The build notice: shown.** The old page's build poll (`BUILD_POLL_MS`, ten minutes after the load) ran once.
  The probe's route answered it with a page carrying another build tag, standing in for YC1's site being live. The
  line went into the chat log at once. The System menu was up when it landed, and the chat is hidden under any overlay
  (`ui/chatPanel.js`'s `render`), so the page's text did not hold it yet. When the menu closed, the line stood over
  the world at the top left, with the chat closed: the closed chat's peek. Three earlier runs did not show it: a quest's
  letter was up, and then the character was dead.
- **A gap, in the old build and not YC1's.** The peek's fade (`CHAT_FADE_MS`, 20 s) runs from when the line is
  said, also while an overlay hides the chat. A notice that lands under a menu the player keeps open for longer is not
  peeked; it waits in the chat log for the next time the chat is opened. The notice's code (SRV-N,
  `net/updateNotice.js`) is unchanged by YC1.

## 11. YC2 - building (2026-10-27)

The push and the slow poll of sections 3.6 and 3.7. Branched from YC1's head (#1304), since YC1 is not merged yet.
These are the working notes. The pull request holds the checks as they are run.

**Decisions taken at the build:**

- **The version comes from the settle.** `settleYardCell` builds the cell with `RETURNING built`. A row back means
  the write moved the cell to that version, and the route mints an order. No row back means that nothing moved, or
  the minute's clock built the cell first. In that case no order goes, and the slow poll finds the change. The route
  does not read `body.yard`, because move and remove do not carry it.
- **The order** is `{ o: 'yard', s, m, c, v, i, e }`, with an exact key list (the shape of the hide, freeze and
  staff event orders). No other order kind may carry `m`, `c` or `v`. Its time to live is the HOME ORDER's.
- **The owner's own word.** The route's answer also carries `yardVer` in plain text, beside the sealed `yardOrder`.
  `hold()` raises the held cell's version to it, so the owner's page drops its own word by the version rule.
- **The welcome field, not a version minimum.** The hub's welcome says `yd: 1`. A client carries a yard order only
  to a hub that said it. A `YARD_RELAY_MIN` would move at every renumber (`HOME_RELAY_MIN`'s note records the cost).
- **No host grows.** `bootWorld` has one logical line of room. The carrier and the listener go through a net-level
  registry (the `onHomeOrders` shape): `online.js` hands the yard words and the hub link's state to it, and
  `accountClient.js` hands it the orders. `homeYards.js` and `yardCellSync.js` subscribe to it. On the relay, the
  arm is a module of its own (the `staffFreeze.js` shape), with one dispatch line in `_message`.
- **ACCOUNT_VERSION moves (acct206).** The site's deploy waits until the service serves the version in the tree
  (`deploy.yml`, "Read the account service this build talks to"). Without the move, a new site could go live on
  an old service: its writes would carry no order, and with a healthy hub socket its poll would be the slow one, which
  is worse than YC1.
- **The relay keeps no yard state on disk.** Words owed are held in memory, as the highest `v` for each `m:c`, and
  one timer sends them as one frame a second at most.

**The hub's shards.** A hub shard hands every frame on to the bus (`net/wire.js` isSocialRoom's note, SCALE5c), and
the bus's fan reaches every shard's sockets. The yard arm takes that route, as the home arm does. Read in the code,
not driven: no test stands a sharded hub for the yard word.

**What was built** (account acct206, relay world277 - over YC1's acct205 and world276; world271 to world276, and acct198 to acct200 then acct205, on the branch, renumbered past YC1 at the merges):

- Service: `settleYardCell` answers `{ cell, ver }` off `RETURNING built`; the decor routes answer `yardVer` and
  `yardOrder` (`server-account/src/index.js` yardOrderOf); `net/identityToken.js` kind `yard`, `mintYardOrder`.
- Relay: `server/src/yardWords.js` (takeYardOrder, the owed words, yardFan); one line in `_message`; `yd: 1` in the
  hub's welcome; `parseClient` knows `{t:'yard', order}`. The law both ends read is `net/yardWordLaw.js`.
- Client: `net/yardPush.js` (the carrier, the welcome and close, the frames' gate, the ears); three hooks in
  `net/online.js` and one in `net/accountClient.js`; `scenes/yardCellSync.js` hears words, polls slowly while the push
  is healthy and doubles over quiet polls; `scenes/homeYards.js` subscribes and hands each write's `yardVer` on.
  `bootWorld` is not touched.

**Departures from sections 3.6 and 3.7:**

- **The order's own version, not the cell's.** The owner's write answers `yardVer`, which marks the held cell's
  `ownVer`. The owner's own word is dropped by it. The cell's `ver` stays the last answer's: raising it to `yardVer`
  would let a later poll answer "no change" and leave the owner's yard stale once its 60 s hold ended.
- **No extra poll on leaving a skip.** Words heard while the yards are not drawn are kept and asked the moment they are
  drawn again, and a poll that came due meanwhile goes then (YC1's rule). An extra poll on every edge would add nothing
  while the push is healthy, and it moved YC1's timing (`fb1001_yard.test.js` PRIMARY-TRIPS).
- **A pushed cell answered at an older version** (another isolate's kept answer, up to 30 s) is asked again after
  `YARD_PUSH_RETRY_MS` (15 s), three asks in all. The slow poll finds what that misses.
- **Words dropped at the version held** include words for a cell the page does not hold, for any town.

**In the running game (PASS, 2026-10-27, at 37944c8b3a).** Two registered characters, A and B, online in Daggerfall
on the real relay and account service in local workerd; headless Edge with the pointer lock answered in the page. B's
sockets went through the probe, which logged the hub's yard frames and could cut and hold off B's hub link. A placed
each piece through its own page's account client, so each write's YARD ORDER took the real path to the hub. A's home
was block 1287, about 450 m from B.

- **The slow poll.** While both pages' push was healthy, B asked for no cell in 75 s.
- **The push.** B heard the hub's word 0.1 s after A's write and showed the piece after 1.6 s (2.2 s on a second run).
- **A missed push.** B's hub link was cut and held off. The broken push fell back to the minute's poll, which was
  overdue and went at once; A placed only after it. B did not show the piece in 8 s and heard no word. When the link
  came back, B polled every cell in reach at the welcome and showed the piece 0.8 s after it.
- **The skip.** With B's tab hidden, B heard the hub's word for A's next piece but asked nothing in 10 s. When the tab
  showed, B asked that cell at once and showed the piece after 0.6 s.
- Not driven here: a window over the world, which reads the same gate as the hidden tab and was driven in YC1's
  checks, and the hub's shards (above). The relay was renumbered world272 to world277, and the account acct199 to acct206, after this run; the renumbers move no code.
