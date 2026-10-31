# AUDIT RELEASE, lane R4 (2026-10-26) - what the release costs: first boot, memory, frames and the server bill

The owner (Mac, 2026-10-26): **"I want to do a comprehensive audit to ensure everything is perfect and that everything is
covered for a smooth release that expands our world seamlessly. All systems should be integrated precisely"** - and on
this branch before it, that the land past the Bay "doesnt implode the server or insanely skyrocket our server cost", and
that "the overworld experiences hitching ... expand the overworld view distance without killing performance". This page
is lane R4's: the cost of the release - what a new and a returning player's machine pays at first boot, what the new
systems hold in memory and whether anything grows as a player crosses Tamriel, what they add to a frame, and what the
release adds to the Cloudflare bill. Branch `ccr-f9503f62-d9h2m1` at 367cf11766 (TESA III's eleven streams merged). The
Imperial City's own cost, the coast's smoothing and the cache keys and load order are other lanes' (For the coordinator,
below).

## How it was run

- **In node, over the freeware ARENA2** (`tools/fetch-data.sh`, `ARENA2_PATH=/home/claude/dfdata/arena2`), each build a
  player pays driven through the game's own modules as the hosts call them - the trace, the fit, the waters' compile, the
  roads' region build (the TESA14 pin's inputs, `createRoadsWorkerState` as the worker runs it), the roads host's start,
  the Graht-oaks' meshes, the rings' sizes - and a walk across the continent's frame reading every pixel's zone, height
  and climate as a streamed grid reads them (4,000 steps of the 11 x 11 about the walker, 484,000 reads, corner to corner
  of the 4,960 x 3,100 Bay-pixel frame). Probes capped at `--max-old-space-size=3072`; they live in the session's
  scratch, outside the tree, as OW-HITCH's did (their numbers are below and re-made by the steps here).
- **The machine was loaded**: 4 cores shared with several agents and a full-suite run - load average 9 to 22 through every
  timing here. Wall-clock figures are inflated, roughly two to four times; read them as relative and as upper bounds.
  Counts (regions, reads, rows, objects, sockets) are exact.
- **The live bill** read with the owner's read-only Cloudflare token (never written to the tree): the account's GraphQL
  analytics - `durableObjectsPeriodicGroups` (active time, by day, by hour, by object), `durableObjectsInvocationsAdaptiveGroups`
  (requests, and each object's `name` - its room key), `d1AnalyticsAdaptiveGroups` and `workersInvocationsAdaptive` - for
  the seven days to 2026-10-25, and the hour 19:00-20:00 UTC on 2026-10-25 object by object. Priced at the published
  Workers Paid rates over the counts (not an invoice), as `11-Multiplayer/Scale-Arc.md` PROVINCE-SLEEP priced them.
- **The relay and the account service** read for every message, timer, alarm, room, storage operation and D1 query this
  branch adds against main's merge base (b5faf20db9): `git diff b5faf20db9 HEAD -- server server-account src/net`.
- **No browser.** The container's memory would not hold a world page through a boot (OW-STREAM's record: 1.8-3.3 GB a
  page, twenty attempts killed by the OOM killer); the frames in the real game are the owner's A/B (For the owner).

## The findings

| Id | Sev | Finding | Before / after | Status |
|---|---|---|---|---|
| R4-1 | LOW | Nothing held the relay's timers to a count: GRANT-SLEEP took the one a cell held, and the next timer armed on a cell's or a province's path would keep it awake unseen | 14 timer sites, 0 intervals - unpinned / pinned by callee | FIXED (a census pin) |
| R4-2 | MED | E2-1's fix writes one SQLite row at every grant ask that moves a cell's gate - the release's one new per-message storage write | ~3 rows a player-minute in the open; at most 2 a socket-second (the socket gate); ~$130 a month per 1,000 concurrent | MEASURED, pinned as a budget (one row an ask, one read an instance life, none a pose or a tally) |
| R4-3 | HIGH (cost) | The spread: a 16-pixel cell is one Durable Object awake while anyone in it moves, and the land past the Bay is 30 times the Bay's cells - a player alone past the Bay holds about 1.9 cells awake (their own and the halo's) | Bay: ~0.15 awake cells a player online; alone past the Bay ~1.9 (~$7.8 a month a lone concurrent player) | RECORDED - proposals for the owner; lever 2 TAKEN (LONE-SLEEP, 2026-10-26) |
| R4-4 | LOW | Every boot (a returning one too) traces the picture, masks the relief and fits the Bay again on the page's thread, and starts the roads' build with a region scan and a print - the same answers each time | 0.3-0.9 s (trace with its relief, then the fit), 0.4 s (scan and print), in four tasks - none over a second | RECORDED - the cache is lane R1's |
| R4-5 | LOW | A low-end machine (2 cores) builds the roads past the Bay on one worker beside the terrain worker: the first boot's 48 regions are some 28 minutes of one core | `roadsWorkerCount(2)` = 1; 853 s on two workers in the running game | RECORDED |
| R4-6 | INFO | No retained cache of the new systems grows without bound across Tamriel: every pixel-, tile- and cell-keyed one is capped or keyed by a finite set | the walk: zones 91,836 of 262,144, heights 228,105 of 262,144, the heap after collection 17 MB lower than before it | VERIFIED |
| R4-7 | MED | SMOOTH-LAND (merged at ad2a8d71de) moved the land past the Bay onto a smooth law the page's thread builds whole: the law at the first province asked at boot, and the continent's lines, Cyrodiil's red line and the held map's chains in one task at the map's first open | the law 0.9-1.6 s first on this thread (0.15-0.29 s warm); the first open's ink 2.1-3.3 s here (some 1 s on the stream's own unloaded figure) | FIXED - the lines made in idle time from the trace's landing (proposal 2), the law made a tile at a time as it is read (proposal 3's aim: its build some 20-80 ms), `03-World/Tamriel.md` SMOOTH-LAND |

### R4-1 - the relay's timers, counted (FIXED)

`server/src/index.js:"_downArm() { if (!this._downT) this._downT = setTimeout(() => { this._downT = null; this._downFlush(); }, HUB_BATCH_MS); }"`.
A timer pending is what keeps a Durable Object from hibernating, and duration is 61% of the live bill. GRANT-SLEEP
(`11-Multiplayer/Spawn-Grants.md` section 22) took the ten-minute timer a cell held for its grant measure, and
`sleepcost.test.js` holds that one timer gone - but nothing held the rest, so the next timer armed on a cell's path, or
on a province's channel, would cost an object awake per player and be seen only on the bill. The census, read
2026-10-26 over all twelve files of the relay: fourteen `setTimeout` sites - the hub's pose batches (2), its bus link's
flushes and holds (3), the hub's batch wait, its poll's wake and answer (3), the counts it says (2), the down link's
flush, the chat feed's wait (1), and the staff feeds' two (`staffFeeds.js`) - each fired and gone, none armed by a cell,
a channel past the Bay or a grant; no `setInterval` anywhere. `test/net/auditr4_relaybill.test.js` R4-1 holds that census
by each site's callee: a timer added, or one moved to another callee, fails it until its row is written here.

### R4-2 - the grant gate's row an ask (MEASURED, pinned)

`server/src/index.js:"await this._grantGateKeep(G, now);"`, `server/src/index.js:"return (this._grantGateRead ??= (async () => {"`.
AUDIT TESA III E2-1 keeps a cell's grant gate in its storage so a hibernation cannot refill every bucket - a security fix,
and the release's one new per-message storage write. Its cost, pinned as counts (R4-2): a pose touches no gate; a tally
reads it once (the first ask an instance life) and writes nothing; every ask that can move it (a mint, a renew, a free, a
carry, an heir) writes one row; a woken cell reads it once again. A write's value is the gate - a few hundred bytes to some
50 KB at the cell's ceiling - but a SQLite-backed object (`new_sqlite_classes = ["Room"]`) is billed by the row, $1.00 a
million past the 50 million a month included (which the live bill is already past - some 6 million rows a day).

What it costs: a player in the open asks about three times a minute - an estimate from the asks' own shape (a mint and a
free a foe that stands, a renew a batch of up to 32 live grants every eight minutes - `GRANT_RENEW_LEAD_MS` before
`GRANT_TTL_MS`), not a live count (GRANT2's measure posts asks to the service, not to this token's analytics) - so some 130 million rows a
month per 1,000 concurrent players outdoors, **~$130 a month**, ~$11 per 1,000 daily players at two hours a day. Its
ceiling is the socket gate, `src/net/grantLaw.js:"export const GRANT_HZ_MAX"`: a client flooding asks writes at most
5.2 million rows a socket-month ($5.18) - the same order as the object it holds awake ($4.11), not an amplification.
**Proposed, not built (a security fix on release day is not the place)**: write a refused ask's gate only when the refusal
moved something (a bucket's refill accounting does move it today), and let a `free` go unwritten while anything still binds (the key
still let go when nothing does) - a freed grant read back after a sleep counts against the ceiling until its own expiry,
the strict side. Both together would take roughly a third
of the rows.

### R4-3 - the spread: cells awake per player (RECORDED - the release's dominant cost)

`src/net/wire.js:"export const WORLD_CELL = 16;"`, `src/net/wire.js:"export const RANGE_PIXELS = 3;"`,
`src/net/online.js:"export const POSE_HZ = 10;"`, `src/net/wire.js:"export const HEARTBEAT_MS = 20000;"`.
A world cell is a Durable Object; one with a moving player gets poses at POSE_HZ and never sleeps (the runtime hibernates
an object only after some ten idle seconds; a still player's heartbeat every 20 s lets it sleep). A client stands in its
cell and in the halo of every cell within RANGE_PIXELS of its edges, and a halo's poses go every HALO_STEP_M moved: on a
16-pixel cell a player holds on average 1 + 2 x (6/16) + (6/16)^2 = **~1.9 cells**, all awake while they move. At 128 MB
an object awake a month is 328,500 GB-s, **$4.11**.

Measured live, the evening's hour (2026-10-25 19:00-20:00 UTC, every object named): the hub's 16 shards and bus held
~1,140 sockets - every online client - and **162 cells were awake on average** (1,047 objects woke in the hour; 497 of them
never held more than one socket, and those were awake 11% of the cells' time). In the Bay, players share: ~0.15 awake
cells per player online. Past the Bay the frame is 4,960 x 3,100 Bay pixels - 60,140 cells against the Bay's 2,016 - and a
player away from a capital or a road's town is alone in theirs and its halo.

| per 1,000 concurrent players | cells awake | cells' duration a month |
|---|---|---|
| as the Bay today (0.15 a player) | ~150 | ~$600 |
| 30% of them alone past the Bay | ~150 x 0.7 + 300 x 1.9 = ~675 | ~$2,780 (+$2,160) |
| every one outdoors (~70%) alone | ~45 + 1,330 = ~1,375 | ~$5,650 (+$5,030) |

So the release's bill moves with WHERE players go, not how many come: today's run-rate (below) is some $2,170 a month per
1,000 peak-concurrent players, and a third of them roaming the provinces alone adds about as much again in the cells
alone. Nothing here is a fault - it is what one object per cell costs over a world thirty times larger - and nothing of it
is fixed in this pass: each lever is a wire or relay law change, and the owner's to choose.

**Proposed for the owner** (each measured against the live bill with the hour-by-object query below):
1. **Larger cells past the Bay** - a 64-pixel cell there (sixteen of the Bay's to one) holds a lone player in ~1.2 objects,
   and more players share one. A room-key change past the Bay alone (`cellRoomOfWire`), the relay's law with it.
2. **A lone cell's pose at the heartbeat** - a client whose cell and halo hold no peer and no stream sends its pose on
   HEARTBEAT_MS alone, so the object sleeps between; the first peer's hello wakes it, and the client returns to POSE_HZ
   as it is told of them. Halves nothing in a crowd and nearly all of it on the open road.
   **TAKEN** (the owner, 2026-10-26: "Idle lone cells"): LONE-SLEEP, `11-Multiplayer/Scale-Arc.md` - a lone session's
   pose down its own cell's socket once a minute (`src/net/loneSleep.js:"export const LONE_POSE_MS"`, the
   longest the silence law and the Watch's tick allow - HEARTBEAT_MS itself unmoved) and none down an empty halo; at once
   on a peer's join, a referee's word, a fight or a word judged by where it stands. Client only, gated on the release's number (world269 at the second merge); composed with main's HIBERNATE (alone one notion - standing alone, nothing); a
   lone mover's ~1.9 objects to ~0.2-0.6.
3. **A halo past the Bay only within one pixel** (RANGE_PIXELS 1 there): ~1.3 cells a lone player instead of ~1.9.

### R4-4 - the boot's continent, built again each boot (FIXED - the trace, its relief, the fit and the roads' scan kept; the roads' print not)

`src/scenes/world.js:"preloadTamrielTrace({ fetchBytes, palette }).then(async (trace) => {"`,
`src/scenes/tamrielRoadsHost.js:"inputs, print: inputsPrint(inputs), regions,"`. Timed in node (load 9-22):

| build | thread | cached? | new player | returning player |
|---|---|---|---|---|
| WOODS.WLD and MAPS.BSA parsed | page | the files in IndexedDB (dataSource.js); the parse no | 57-258 ms, 71-83 ms | the same |
| the trace (TMAP00I0 + TAMRIEL2) | page | no | 134-351 ms (relief off) | the same |
| the trace with its relief (decode and mask) | page | no | 87-171 ms (the module's chunk warm) | the same |
| the Bay fitted to the picture (`fitBayToPicture`) | page, in the trace's `.then` | no | 251-583 ms (580-1,032 ms after SMOOTH-LAND's merge - R4-7) | the same |
| the land's smooth law (`landLaw`, SMOOTH-LAND) | page and each worker, its own | no (a WeakMap by the trace) | 0.93-1.62 s first, 0.15-0.29 s warm (R4-7) | the same |
| the waters' law (`tamrielWaters` compile) | the terrain worker; the page only with no worker (`watersInk.js`) | per worker life | 658-1,116 ms | the same |
| the roads' build start: the 48 regions with land scanned, the print | page | the scan kept (R4-4, fixed) | 317 ms + 100 ms | the print's 100 ms |
| the roads past the Bay, 48 regions | 1-4 roads workers (`roadsWorkerCount`) | IndexedDB, a region a key (`regionKey`) | 8.2 s and 15.1 s for the two nearest here; 6-72 s each, 853 s on two workers in the running game | from the cache, landed 8 ms a task (`LAND_BUDGET_MS`) |
| a region's roads landing (unpacked, merged into the page's layer, its tiles stamped) | page, a region a task | - | 7,933 pixels (region (1, 4)): unpack 0.6-3.5 ms, merge 1.3-8.3 ms, stamp 0.7-8.7 ms over twelve landings into a growing layer (load 30-38; one reading of 176 ms in the build's own process was the collector after its 42 MB) | the same, from the cache |
| the far field's and the middle ring's grounds | the terrain worker | no | ~100 ms a ring (Travel-View MID-RING) | the same |
| their vertices, tints and order | page, HORIZON_BUDGET_MS (2 ms) a frame | no | 54,289 + 14,641 vertices; an order written at a pixel crossed (1.6-7.9 ms) | the same |
| the held map's ink | page, a tile a budget (`tamrielTiles.js`) | no (tiles kept, least recent let go) | MAP-WHOLE's record | the same |
| the Graht-oaks' nine meshes | page, a breath between each | no | 208 ms whole, ~23 ms a mesh; 3.16 MB packed | the same |
| a forest pixel's oaks (`grahtSites`) | the terrain worker | no | with the pixel's build | the same |

None is over a second on the page's thread on an unloaded machine, and none blocks the first frame; the longest new task
a boot pays is the trace's landing (the fit and the hand-off to the terrain worker, 0.3-0.6 s). What is rebuilt when
nothing changed is the trace, the relief's mask, the fit, the waters' law (on the worker) and the roads' scan and print -
about a second of the page's thread and one of the worker's each boot. **Proposed** (lane R1 owns the cache keys): keep
the trace, its relief and the fit in IndexedDB under a print of TMAP00I0, TAMRIEL2, WOODS.WLD and the relief module's
version - the roads' own `inputsPrint` already hashes all four.
**Fixed (the coast's stream, 2026-10-26; the owner: "Take care of exclusions and gaps"):**
`src/world/tamriel/tamrielBootCache.js:"export const BOOT_CACHE_VERSION"` keeps in IndexedDB, and a returning boot
takes: the trace and its relief (`preloadTamrielTrace`), under a print of the two pictures' bytes, the palette read and
the relief's own data, each record checked against its key, its sizes and its arrays' checksum; the fit (`fitBayToPicture`
takes a kept fit for the very land it samples - its masks' print); and the roads' regions to build (the roads' start - since EXACT-PIECES the regions it wants, the Bay's own with those with land, the kept set's key tagged `w1`,
`src/scenes/tamrielRoadsHost.js:"const regions = regionsByNearness(lattice, keptLandRegions({ lattice, scan: (r) => regionWanted(r, heightAt), ground }), from);"`)
under a print of the ground they were scanned on - the fit, the Bay's own bytes, GROUND_ROLL_VERSION and BIOMES_VERSION -
and the lattice. Timed in node (an in-memory store): the trace and relief 469 ms at a first boot, 18-32 ms returning; the
fit 677 ms, 10-96 ms returning (its land's masks still sampled). No IndexedDB, a blocked one, a record that does not
answer: built as before. The laws a kept continent stands for are printed under BOOT_CACHE_VERSION
(`test/world/bootcache.test.js`), so a law moved without it fails. Not kept: the roads' print (`inputsPrint`, some
100 ms) - it is the roads' own key over their inputs, and the waters' law on the worker (its own stream's).

### R4-5 - the low-end machine (RECORDED)

`src/world/tamrielRoadsClient.js:"export const roadsWorkerCount"`. Two cores: one roads worker (the floor of
`cores - 2`), beside the terrain worker and the page - three busy threads on two cores through the first boot's roads,
some 1,700 worker-seconds (853 s on two workers in the running game), so the stream's own pixel builds share a core with
them for nearly half an hour. Each idle roads worker held some 80 MB (AUDIT TESA II R4, let go when the build ends); one
here grew 28-35 MB a region in flight, a process of 557 MB RSS with the trace, the maps and the ground. A 4 GB machine
also holds the world page (1.8-3.3 GB in OW-STREAM's record). The living world waits on the nearest few regions only
(WW7-9), so play is not held for the whole build. **Proposed**: on two cores, pause the roads worker while the stream has
pixels owed (the client's `near` already re-orders; a `hold()` beside it), or build the regions within a few of the
player first and the rest only when the page is idle.

### R4-7 - the smooth land's law and lines, built whole on the page (FIXED)

`src/world/tamriel/tamrielLand.js:"export function landLaw(trace) {"`, `src/world/tamriel/tamrielLines.js:"export function lawLines"`,
`src/ui/tamrielInk.js:"export function tracedChains(trace) {"`, `src/systems/wild/cyrodiilZone.js:"export function zoneLineOf"`.
SMOOTH-LAND (`03-World/Tamriel.md`; the owner: "Whatever is most detailed"), merged into this lane at ad2a8d71de, reads a
pixel's province past the Bay through the land's smooth law, made once a trace on each thread that asks (`landLaw`: the
labels, the land's and each province's distances over the padded picture), and draws every coast and border, the zone's
red line and the held map's chains from the law's own lines (`lawLines(trace).all()`: the continent's walk over every
square of mixed centres). Timed in node over the freeware (load 7.7-11.4, two runs):

| step | thread | when | here |
|---|---|---|---|
| `landLaw`, the first on a thread | page, terrain worker, roads workers, each its own | the first province asked - at the trace's landing (the places, the roads' start) | 0.93-1.62 s (cold code); 0.15-0.29 s on a fresh trace with the code warm |
| `fitBayToPicture` | page | the trace's landing | 0.58-1.03 s (0.25-0.58 s before the merge, the same load band) |
| `provinceKeyBeyondBay`, 200,000 scattered pixels | any | a walk, a build | 0.30-0.44 s (1.5-2.2 microseconds a pixel) |
| `lawLines(trace).all()` | page | the held map's first open (`buildTamrielInk` -> `tracedChains`) | 1.32-2.12 s; 51,610 pieces over 51,582 squares, 19-51 MB while made |
| `zoneLineOf` | page | the same open (and the zone's own red line) | 0.47-0.95 s |
| `tracedChains`' linking and thinning | page | the same open | 0.25-0.74 s |

So the map's first open after a boot holds the page some 2-3 s here in one task - the stream's own figure, unloaded, is
some 1 s - and a boot's trace landing grows by the law's first build. MAP-WHOLE's tiles land a budget at a time; this is
the one piece of the map that does not. Nothing is retained past its trace and fit (`_laws` and `_lines` are WeakMaps by
the trace), so nothing grows (R4-6). Not fixed here - the files are the coast's stream's, still moving. **Proposed**: (1)
make the lines where the waters are already made - the terrain worker, which builds its own law anyway - and post the
pieces and points to the page as MAP-WATERS posts the rivers (`world/tamriel/watersInk.js`), so neither the page's law
nor the walk lands on the map's open; or (2) walk `all()` as a generator a budget a step from the trace's landing in idle
time (the squares are independent), the map's open waiting on it as the roads' tiles wait on their regions; and (3) let
the page's first `landLaw` ride the same idle step after the trace lands rather than the first province asked.
**Fixed (proposal 2, the coast's stream, 2026-10-26):** the walk, Cyrodiil's line and the linking are steps, walked
TRACED_SLICE_STEPS a slice of idle time from the trace's landing into the keep the map's open reads
(`src/ui/tamrielInk.js:"export function startTracedJob(trace) {"`); the chains byte for byte the whole walk's, a step's
work bounded by its structure (`test/world/smoothland.test.js`, R4-7). **Proposal 3's aim (the same day):** the law's
build is its labels alone and its distances are made a tile of 16 x 16 centres at a time as reads first need them
(`src/world/tamriel/tamrielLand.js:"function at(L, F, ix, iy, fx, fy) {"`) - on the page and in every worker alike; the build
28-83 ms here, a read at most four tiles a field (pinned by count), the fields bit for bit the eager build's.

### R4-6 - nothing grows without bound (VERIFIED)

Every module-level and host-level Map or Set this branch adds was read for its key and its bound. Pixel-keyed: the zones
(`src/world/tamriel/tamrielBiomes.js:"export const BIOME_CACHE_MAX = 262144;"`) and the heights
(`src/world/tamriel/tamrielGround.js:"export const GROUND_CACHE_MAX = 262144;"`), each cleared at its cap; the air's tiles
(512, oldest first) and pixels (65,536, a quarter let go); the trips' memo (40,000); a place's pixel cache
(`PIXEL_PLACES_KEPT`); the held map's road ink and tiles (least recent first). Keyed by a finite set: the provinces' stood
seeds and peak ranges, a city's wall (`src/world/townWalls.js:"const _walls = new Map();"` - a walled city a key, made as
it is read), a town's fabric (`TOWN_FABRIC_KEEP`), the lanes' ways by lane key, the living index's squares and districts
(cleared as a region lands), the fauna's tables by biome, the rings' templates by shape. The walk across the frame read
484,000 pixels; the zones' cache held 91,836 and the heights' 228,105, both under their caps, and the heap after a
collection stood 17 MB below where the walk began. A long journey's cost is the standing world's (MEM-AUDIT), not these.

## The new systems' budgets

- **The middle ring**: 54,289 vertices and 107,648 triangles - positions, normals, coarse ground (Float32), colour and
  sea (bytes): 1.7 MB of vertex buffers and 0.65-1.3 MB of index, rebuilt every MID_REBUILD_DRIFT (3) pixels.
- **The far field**: 14,641 vertices (positions and normals Float32, colour and sea bytes): ~0.4 MB and its index.
- **The Graht-oaks**: nine meshes (three variants, three LODs) packed in 3.16 MB, made once a session a breath at a time;
  a frame walks every built pixel's trees (`src/scenes/grahtHost.js:"if (n || shown) gpu.setInstances"` -
  the instances uploaded each frame they are shown), a few thousand trees at the default view.
- **The roads past the Bay**: a region's layer and places, a worker ~80 MB while it builds; the merged layer on the page
  is a Map of road pixels (not measured whole here).
- **Not measured** (no browser): the travellers' and ships' per-frame cost everywhere (WW7-7, WW7-8), the far landmarks'
  draws, the night fog's - their pins hold their counts; their frames are the owner's A/B.

## The server bill

**Live baseline** (the seven days to 2026-10-25, main's relay and account service):

| line | a day | a month | priced |
|---|---|---|---|
| Durable Object duration | 3.91 million GB-s | 117 million GB-s | $1,462 |
| Durable Object requests | 323 million invocations, some 37 million billed (sockets' messages at 20 to 1 - PROVINCE-SLEEP's split) | ~1.1 billion billed | ~$166 |
| Durable Object SQLite rows written | some 6 million (PROVINCE-SLEEP's reading; the periodic dataset reports no units for SQLite-backed objects) | ~180 million | ~$130 |
| D1 rows read / written | 7.4 billion / 10.3 million | 221 billion / 309 million | $196 / $259 |
| Workers (the account service, the relay) | 13 million requests, 87,000 CPU s | 391 million, 2.6 million s | $114 + $52 |
| **total, with the $5 plan** | | | **~$2,390 a month** |

The evening's peak was some 1,100-1,140 concurrent (the hub's sockets); per 1,000 peak-concurrent players that is some
**$2,170 a month**. The hour by object: the region channels 156 objects awake on average, the cells 162, the dungeons 94,
the interiors 44, the hub's shards 17, everything else under 10.

**What the release adds**, per 1,000 concurrent players:

| | a month | how |
|---|---|---|
| R4-3, the spread | +$0 (every player in the Bay) to +$5,030 (every one outdoors alone past it); **~+$2,160 at 30% alone past the Bay** | cells awake, above |
| R4-2, the grant gate's rows | **~+$130** | ~3 asks a player-minute in the open, a row each |
| the gate read at a wake | ~$0 | a row read an instance life ($0.001 a million) |
| province channels (PROVINCE-SLEEP) | ~$0 past the lines' own time | one object a province, its sockets hibernated between lines |
| new messages, timers, alarms, rooms | none | no new send on the client's wire; the relay's timers counted (R4-1); the gates' lanes past the Bay stand none (`GATE_LANES_OPEN` the Bay's); the serpent's agreed site said to a hub's sockets when it moves (a few a day) and to a hello |
| the account service | ~$0 | the new routes are a player's acts (a castle bought or sold, a gift, a witness); the seats' list reads the region law's rows from an isolate's minute cache (`server-account/src/domains.js:"export const DOMAIN_ROWS_KEPT_S = 60;"`) |

So **the release adds some $2,300 a month per 1,000 concurrent players if a third of them roam past the Bay alone**, and
the per-player bound is the spread's: ~$7.8 a month for a concurrent player alone past the Bay against ~$0.6 for one in
the Bay's crowd. Measure it the week after release with the hour-by-object query (the cells' awake objects against the
hub's sockets) before choosing among R4-3's levers.

## For the coordinator - findings in files this lane did not edit

- **SMOOTH-LAND (the coast's stream)**: R4-7 - the law's first build on each thread and the held map's first ink
  (the continent's lines, the zone's line and the chains) are single tasks on the page; the proposals are R4-7's.

- **The cache keys and load order (lane R1)**: R4-4's trace, relief and fit are rebuilt every boot (~1 s of the page's
  thread); a print of TMAP00I0, TAMRIEL2, WOODS.WLD and the relief module's version would let a returning boot skip them.
  The roads' region key hashes every WOODS byte, the trace and every relief cell on the page's thread at each build start
  (100 ms here) - it could ride the worker's `init`.
- **The Imperial City, the coast's smoothing**: not read for cost in this lane - the capitals' plans and the city's
  models (`capitalPlans.js` and its kin) are the Imperial City stream's, still changing as this was measured, so their
  first-boot share is not in R4-4's table.

## For the owner

- R4-3's three levers - each a wire law, each the owner's to choose, each measured on the live bill after.
- The A/B this container could not run: `tools/owHitchProbe.mjs` and `tools/heldMapLoadProbe.mjs` on a machine with a
  GPU, the base and this branch (OW-STREAM's For the owner), and a two-core machine's first boot with the roads building.

## Pins

`test/net/auditr4_relaybill.test.js` (2): R4-1 the relay's timers by callee, no interval; R4-2 the grant gate's rows and
reads as counts over poses, tallies, mints and a wake. Mutants: `tools/mutants/auditr4.json`, 6, all dead (a timer on a
cell's path, an interval, a staff feed's timer added, the gate read every ask, a tally's row, two rows an ask). No code of
the game moved; no pin moved; the relay's law is unchanged (no re-hash).
