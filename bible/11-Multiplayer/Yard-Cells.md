# Yard Cells

How players' house yards are kept, synced and drawn online. A town's yards are kept by block: each RMB block of a
town is one cell with its own version, and a page asks only the cells near the player whose version moved. A player
meets it as other players' yard decorations standing around their homes in any town, nearest first, with a change
showing within seconds.

## How it works

**The cell** (`src/net/yardCellLaw.js`). A cell is `(map_id, cell)` where `cell = building_key >> 8` (`yardCellOf`):
one block of one town. A town has at most `YARD_CELLS_ASK_MAX` cells (64 blocks and the one key of block (0, 0)). A
cell holds at most `YARD_CELL_PIECES_MAX` pieces (256 building records of `DECOR_YARD_CAP` each). There is no
town-wide cap: a yard is bounded by its own rules and by how many homes an owner may hold.

**The service** (`server-account/src/yardCells.js`). Triggers on `home_decor` move a cell's version on every yard row
written (migration `0190_yard_cell`); a moved home moves both its cells. A decor write rebuilds its own cell
(`settleYardCell`), returning the version it built. The minute's clock builds the cells a cascade left stale
(`settleStaleYardCells`), found by a partial index, a page a firing. A stale cell is read as its rows stand, never older.

**The cell route.** `POST /v1/homes/yards/cells` `{ mapId, cells: [[cell, ver], ...] }`, nearest cell first, answered
before the session check. Only cells whose version differs are answered (`readYardCells`), in request order up to a
byte budget, the first changed cell always whole; `more` lists the rest. A version never goes back: where the client
holds a newer one, the cell reads as unchanged. Each isolate keeps answers per cell for `YARDS_KEPT_S`, bounded by
bytes; a write in that isolate sends the next read to the primary. The old whole-town route `/v1/homes/yards` answers
410 `client-update`; an old build backs off and is told to update by the build notice (`src/net/updateNotice.js`).

**The push** (`src/net/yardWordLaw.js`, `src/net/yardPush.js`, `server/src/yardWords.js`). A decor write that moved a
cell answers a signed YARD ORDER (`{ o: 'yard', s, m, c, v, i, e }`, `mintYardOrder`) and the cell's version
(`yardVer`). The acting client carries the order to the hub, only if the hub's welcome said `yd: 1`. The hub checks the
signature and fans `{ t: 'yard', l: [[m, c, v], ...] }` to every page at most once each `YARD_FAN_MS`, keeping each
cell's highest version. Nothing is held for late joiners. A page acts on a word only by asking that cell, after a
random wait up to `YARD_PUSH_WAIT_MS`.

**The client** (`src/scenes/yardCellSync.js`, wired by `src/scenes/homeYards.js`).

- It asks the cells holding a listed home within `YARD_ASK_M` of the player, nearest first across every town in
  reach, and drops cells past reach plus `YARD_KEEP_MARGIN_M`.
- With a healthy push (a hub socket unbroken since the last poll) it polls every `YARD_SLOW_POLL_MS`, doubling over
  quiet polls to `YARD_SLOW_POLL_MAX_MS`; without one, every `YARD_TOWN_TTL_MS`. After a break it asks every cell in
  reach at the welcome.
- It does not poll indoors, mounted, under a window, or with the tab hidden; words heard meanwhile are asked once the
  yards are drawn again.
- The owner's own write is laid over its cell for `YARD_WRITE_HOLD_MS` and its own word is dropped by version.
- A pushed cell answered at an older version is asked again after `YARD_PUSH_RETRY_MS`, `YARD_PUSH_TRIES` asks in all.
- Strangers' yards stand nearest first within `YARD_STAND_BUDGET_MS` a frame, always one.

**Drawing** (`src/scenes/yardBlockMerge.js`). Strangers' yards in one block within the yard range share one merge: one
mesh a texture and one billboard batch a picture. Merges are made nearest block first within
`YARD_BLOCK_MERGE_BUDGET_MS` a frame. The owner's own yard and a hall keeper's merge alone.

**Past the Bay.** A cell is keyed by the map id and building key, so a town past the Bay works alike. The Imperial
City's served blocks hold up to 75 records, inside the key's 256 a cell; `test/world/yardcells_capitals.test.js` counts
the city as served.

## Rules

- Scalable, no shortcuts: no town-wide cap on yards (the owner).
- Updates are pushed, with a slow poll as the safety net, skipped where it cannot matter (the owner).
- Old builds are told to update: the whole-town route is refused, not answered cut (the owner).
- `HOME_TOWN_MAX` (`src/net/homeLaw.js`) is 2,048 homes a town answer (the owner).
- The homes answer goes by cell and version too, in a slice of its own: shared rows by cell, the caller's own part by
  its own rows, a signed home cell order, and the old route kept one release (the owner).
- Yards stand in `src/scenes/world.js` alone; the relay keeps no yard state and its yard word is a module of its own,
  not a branch of `_message` (HOST-SPLIT).

## Code and tests

- `src/net/yardCellLaw.js` - the cell, the request's shape, the read's bound
- `server-account/src/yardCells.js` - build, stale clock, read, kept answers
- `src/net/yardWordLaw.js`, `src/net/yardPush.js`, `server/src/yardWords.js` - the push
- `src/scenes/yardCellSync.js`, `src/scenes/homeYards.js`, `src/scenes/yardBlockMerge.js` - the client
- `test/server/yard_cells.test.js` - the law, migration triggers and backfill, the build, the read, kept cells
- `test/server/yard_push.test.js` - the order and the hub's fan
- `test/scenes/yardcellsync.test.js` - reach, polls, pauses, back-off, nearest-first standing
- `test/scenes/yardblock.test.js` - block merges
- `test/world/yardcells_capitals.test.js` - the capitals' blocks as served

## Open

- The homes answer by cell and version (`/v1/homes/cells`, `/v1/homes/own`, the `hcell` order) is decided, not built.
  Every page still asks a town's whole homes answer every minute.
- The hub's shards carry the yard word through the bus; no test stands a sharded hub for it.
- A city landing's longest frame is over the 33 ms target; most of it is parsing and model building, not standing.
- Raising `HOME_TOWN_MAX` past the Imperial City's largest slices is a relay and account release, not taken.
