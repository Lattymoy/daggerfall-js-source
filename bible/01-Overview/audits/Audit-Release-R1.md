# AUDIT RELEASE, lane R1 (2026-10-26) - the seams between TESA's streams, read for the release

The owner (2026-10-26): **"I want to do a comprehensive audit to ensure everything is perfect and that everything is
covered for a smooth release that expands our world seamlessly. All systems should be integrated precisely"**. The
branch (`ccr-f9503f62-d9h2m1` at 367cf11766) had just taken eleven streams of work, each built alone and merged:
GRANT-SLEEP and PROVINCE-SLEEP, AUDIT TESA III E1 and E2, VOYAGER (`03-World/Roads.md`), URBANIZER
(`03-World/Urban-Fabric.md`), NIGHT-FOG (`07-Rendering/Weather-Arc.md`), ZONE-LINE (`11-Multiplayer/Wild-Zone.md` section
27), MID-RING, FAR-FIELD, MAP-WHOLE, MAP-WATERS and FAR-LANDMARK, BREATHTAKER, CYRODIIL-WATERS and CYRODIIL-SHORES
(`03-World/Tamriel.md`), WW7-7 to WW7-12 (`03-World/World-Wide.md`), GRAHT1 (`03-World/Graht-Oaks.md`) and IC-GRAND
(`03-World/Arena-Provinces.md`). This lane read the SEAMS: where one stream's output is another's input. The coordinator
set the day's cut-off at 12:30 UTC: release blockers first (a crash, a hang, a save corrupted, the online world split
between clients, a server's cost), lesser findings recorded open, not half-fixed. What a finding changed is marked in
the code beside the fix, `AUDIT RELEASE R1-<n>`.

## How it was run

- **Each seam probed on the freeware's data** (`ARENA2_PATH=/home/claude/dfdata/arena2`), in the lane's scratchpad: the
  trace and the fit as the game installs them, the Imperial City's span and gates as the roads' host reads them, the Red
  Ring Road's points on the roads' worker's own ground, five of Cyrodiil's road regions built through the worker's own
  state (`tools/tesaRoadsAtlas.mjs`'s inputs: 56,777 road pixels, 72 named legs) and laid against the carved rivers, the
  raw ground under the city's 625 slices against the far ring's, and every walled Bay city's wall ids against the city's
  model and block families.
- **The streams' ARENA2-gated pins run together on the merged head.** CI runs none of them, and each stream ran its own
  before the merge: the 35 files of the last day's work that read ARENA2 (the hosts', the bands', the zone's three, the
  roads', the ports', the capitals', the Bay's walls, the town shapes, the urban fabric, the biomes and the world-wide
  ones), and `breathtaker.test.js` (13 of 13) - the result is below.
- **Two streams were still changing their files** (the Imperial City's, and the coast and border smoothing's): a finding
  there is recorded with its proposal and not edited.

## The findings

| Id | Sev | Finding | Status |
|---|---|---|---|
| R1-1 | HIGH | A Bay city's wall model and one of the Imperial City's cells answered one model id: 43 of the 410 walled Bay cities, 15 of them on a cell that places its fabric | FIXED and pinned (8 mutants with R1-2, all dead) |
| R1-2 | LOW | The Travel View's ground past the table kept the land that stood at its first plan - a plan asked before the trace and the fit landed walked the authored continent past the Bay for the session (AUDIT TESA III E2's routed item) | FIXED and pinned |
| R1-3 | MED | The roads past the Bay cross the carved rivers with no ford and no bridge, and the river's water is painted over the road at each crossing (192 road pixels on a channel's pixel in five of Cyrodiil's regions, 37 of them running along it) | FIXED (RIVER-FORDS, `03-World/Roads.md`: the channels priced as fords, the paint keeps a road's tiles, TAMRIEL_ROADS_VERSION 5) |
| R1-4 | LOW | The Imperial City's far landmarks stand each slice on the raw ground at its pixel, where the stream flattens every slice to the centre's: a slice stands up to 40 m higher once built | FIXED by IC-GRAND and pinned (7 mutants, all dead) |
| R1-5 | NOTE | The Red Ring Road runs 30 to 67 km from the Imperial City's centre - between the city and the trace's ring of water, as VOYAGER chose - while IC-GRAND's own Lake Rumare is inside the city's 20.48 km | RECORDED for the owner |

No finding of this lane is a release blocker by the cut-off's measure: none crashes, hangs, writes a save, splits a room's
world or moves a server's cost. R1-1 is the one a player meets - a city's street or a Bay town's wall drawn as the other.

### R1-1 - a town's wall model and the Imperial City's cells (HIGH, FIXED)

`townWalls.js:"export const TOWN_WALL_MODEL_BASE = 1000000;"` (was `3000000 + ((mapId >>> 0) & 0xfffff)`),
`imperialBlocks.js:"export const IMPERIAL_FABRIC_MODEL"` (was `3_000_000` when this lane read it), `customModels.js:"export function customModelFor"`.
AT THE MERGE (2026-10-26): IC-GRAND's own perf pass found the same overlap from the city's side and moved its fabric's and
skylines' models to 7,000,000 and 7,100,000 (`03-World/Arena-Provinces.md` "THE ID RUNS"); with this lane's walls at
1,000,000 the two ranges are clear from both sides, and both pins hold.
TS4 and TS7 (`03-World/Town-Shapes.md`) gave a walled city's wall one model of its own at 3,000,000 and its map id's low
20 bits. IC-GRAND then gave the Imperial City's forty thousand cells a model FAMILY at 3,000,000 + the cell's index (and
its 625 slices' skylines one at 3,100,000) - built without seeing the walls. A model registered by its id is asked before
any family (`customModelFor`), and the pipeline keeps one GPU mesh an id (`scenes/dataPipeline.js` gpuMeshes, shared across
pixels). Every Bay city registers its wall as its location is read (`townOutline.js` wallBayCity, TS7), so once a session
had read one of the colliding cities, the city's cell under that id drew the town's wall pieces (solid, at the cell's
origin) - or, the cell asked first, the town's wall carrier drew the cell's street fabric.

Measured on the freeware's MAPS.BSA: all 410 Bay cities are walled by wallBayCity's own test, and 43 of their wall ids
fell in the fabric's run (Knightston's 3,013,420 is the cell (67, 20); Chesterlech's the cell (82, 153)); 15 of those
cells place a fabric model (`imperialFabricModels.js` fabricCellHasModel) - Chesterlech, Gallomore, Eastville Derry,
Wrothgaria, Longwall, Newing, Longborne, Longfort, Riptower, Hormont, Eastleigh, Merborne, Chesterbeth, Baelhope and Ykalon.
Arena's walled places (500,000 and up) fell in no family's run.

The fix moves the walls' run to 1,000,000-2,048,575, under every other run of the port's own models (the capitals'
910xxx below it; IC-GRAND's 3,000,000 and 3,100,000 and URBANIZER's 5,000,000 above). Nothing persists a wall's model id
(the carrier block's JSON is made in the session, the GPU cache is the session's). The walls' BLOCK indices
(`townWallBlockIndex`, 1,000,000 + 20 bits, to 2,048,575) reach over IC-GRAND's own blocks' run (2,000,000-2,039,999) in
principle: no place reaches it today (the 410 Bay cities' low 20 bits are all under 1,000,000; Arena's are 500,000 + at
most 432), and the pin below holds the Bay's. THE FOUR HOSTS: the id is one function every host reads -
`scenes/world.js` (the streamed towns, `tamrielPlacesHost.js` standTownWall) and `scenes/exterior.js` (the bench draws a
Bay city's wall since AUDIT TESA III E1-2) wired by it; `scenes/worldModes.js` and `scenes/dungeonContext.js` stand no
town's wall.

Pins: `test/world/auditrelease_r1.test.js` (the model runs disjoint - the walls, the city's fabric and skylines,
URBANIZER's, the capitals' landmarks and the arena; a wall stood beside the city's own family, its cell answering its own
fabric and asking no wall's pieces; with ARENA2 every one of the 410 Bay walls clear of the city's runs and no two alike).
PIN MOVED (AUDIT RELEASE R1-1): `test/world/townwalls.test.js` (the walls' ids). URBANIZER's comment on the runs
(`townFabricStand.js`) says the new one.

### R1-2 - the Travel View's ground and the land that lands after it (LOW, FIXED)

`travelRoute.js:"const memoMoved ="`, `travelRoute.js:"get isWater() {"`.
The route ground (`routeGround`) kept its answers past the Bay's table (`dryBeyond`, dropped only past BEYOND_CACHE_MAX),
the sea lanes keep their water by the ground's `isWater` (planSeaLanes' `_laneGround`), and the host makes one ground a
session (`world.js:"const tvRouteGround = () => {"`, made again only when the zone comes or goes). The land past the
Bay is not the boot's: the trace with its relief and the fit land after it (`terrainGenClient.js` setTamriel, which drops
the ground's own byte cache - the route ground's was not). A Travel View plan asked before they landed (or past the Bay
before another fit) kept the authored continent's coast past the table for the session. AUDIT TESA III E2 routed it
unreproduced; here it is reproduced on the module (a ground asked before a trace answers the sea past the table after
it). The fix: the answers are dropped when the land's version (`tamrielLandVersion`) or the fit moves, and `isWater` is
another function then, so the lanes' kept tiles are asked again. A ground with nothing past the table (the living world's,
`scenes/livingWorld/livingTrips.js`) keeps its one function - its trips are unchanged to the byte. No host grew: the
module reads the land itself. THE FOUR HOSTS: `scenes/world.js` (the Travel View and the living world) wired by it;
`scenes/exterior.js`, `scenes/worldModes.js` and `scenes/dungeonContext.js` plan no route past the Bay.

Pins: `test/systems/travel/auditrelease_r1_route.test.js` (a trace landing after a plan; another fit; the living world's
ground unchanged). Mutants: `tools/mutants/auditrelease_r1.json` (R1-1 4 and R1-2 4, all dead; R1-1's last dies by the
non-ARENA2 pin as well).

### R1-3 - the roads past the Bay and the carved rivers (MED, FIXED by RIVER-FORDS - `03-World/Roads.md`)

`terrainGen.js:"if (landforms && !inBay(px, py)) paintTamrielWaters(tileData, px, py, hasLocation ? locationRect : null, undefined, paths);"`,
`tamrielRoadsWorker.js:"const wet = (x, y) => !inBay(x, y) && heightAt(x, y) <= WATER_BYTE;"`. CYRODIIL-WATERS carves
ten rivers inside the kernel, narrower than a pixel, and paints their channels water after the roads are painted; the
roads' worker routes on the pixels' bytes, which carry no channel (VOYAGER's own record, `03-World/Roads.md` OPEN (3)).
Measured at 367cf11766, before SMOOTH-LAND moved the land (GROUND_ROLL_VERSION 4 lays every road again; nothing in it
reads a channel either, so the seam stands).
CYRODIIL-SHORES then gave the roads `riverPixel` and `riverRaster` ("a router's question" - `tamrielWaters.js`), and no
reader takes them. Measured on the freeware (Cyrodiil's five regions (2,5), (2,6), (3,4), (3,5), (3,6) built as the game
builds them): 192 of 56,777 road pixels stand on a channel's pixel - the White Rose 58, the Brena 31, the Strid 26, the
Reed 26, the Corbolo 25 and five more - 155 crossings and 37 pixels where the road runs along the river. Each is a road
that meets water and goes on the other side, priced as dry ground (no ford's cost, so no crossing chosen where the
channel is narrowest) and with no bridge. Not a blocker: a player wades it, the living world's ways are the pixels'
(`travelRoute.js` - no channel there either), every client the same.

Proposed (the roads' stream and the waters', one change, TAMRIEL_ROADS_VERSION moved): the roads' worker reads
`riverRaster` over its region's grid as fords (`roadLand.js` landForRoutes' `ford` mask and VOYAGER_DIALS.fordCost - a
channel's pixel crossed along its flow's perpendicular, never walked along), and the paint keeps a crossing's road tiles
a ford (or lays a bridge model) where `paintTamrielWaters` meets a road's tile.

### R1-4 - the Imperial City on the horizon stands its slices on the land's raw ground (LOW, FIXED)

`capitalSkyline.js:"const px = centre.px"`
(IC-GRAND's file; as found, the line read the slice's own pixel's ground, `fr.groundAt(px, py)`). The stream flattens every slice of the city to its centre's ground
(`terrainGen.js` flattenAt); the far ring has no flatten, and each slice's landmark stands on the ring's own height at its
pixel. On the freeware the ground under the 625 slices reads 10 to 14 bytes, the ring's heights 100 to 140 m against the
centre's 140 m: a slice's silhouette stands up to 40 m low and rises as its pixel is built. Not seen in a browser (the
lane ran none). Proposed for IC-GRAND: stand every slice's landmark at the centre pixel's ground (`fr.groundAt(centre.px,
centre.py)`), as the stream stands it.

FIXED (IC-GRAND, 2026-10-26): every slice stands at the ring's ground at the centre pixel
(`capitalSkyline.js:"function cityGround"`), its feet - every corner at its ground, the far view lays no
flat quad there - down to the ring's lowest round its pixel and never above the city's
(`capitalSkyline.js:"function lowestAround"`), so a slice over lower land stands on a plinth to it, not in
the air. With the centre off the ring's grid (the traveller up
to SKYLINE_REACH out, 61 pixels against the ring's 48) the city's ground is the ring's at its slice on the grid nearest the
centre, and every slice is stood again once the ring has the centre. Pinned in `test/world/icgrand_lod.test.js` THE CITY
ON THE HORIZON (PIN MOVED: it read each slice's foot at its own pixel's ground); `tools/mutants/icgrand.json` R1-4-skyline-*
(7) and IC-GRAND-skyline-stood-at-nought re-aimed by content, all dead. Not photographed (the shared machine's memory).

### R1-5 - the Red Ring Road and the two Lake Rumares (NOTE)

`cyrodiilRoads.js:"export function ringPoints(ring, walkable, wet) {"`, `world/imperialCity.js:"lake: 10000, // AUDIT"`. VOYAGER-CYRODIIL
rings the Imperial City "along Lake Rumare's shore": the first water each of twelve bearings meets past the span. IC-GRAND
puts the city's own isle and Lake Rumare's far shore (10 km) INSIDE its 25 pixels, and the trace's ring of water (IC-RING's
"circle river") stands 36 to 56 pixels out. On the freeware, on SMOOTH-LAND's land (ad2a8d71de), the ring's twelve points
stand 37 to 82 pixels (30 to 67 km) from the city's centre, its one gate (Talos Bridge, west, at 13) joined to the nearest
point 40 pixels off (at 367cf11766, before the land was smoothed: 37 to 84, and 42). The roads'
host reads the span and the gates off the plan (no literal), so nothing is out of step - but the canon road runs along the
lake round the isle, and here the lake is the city's own. The owner's call: keep the ring at the trace's water, or stand
it RING_GAP past the span (the ring's own rule with no water) now that the lake is the city's.

## Checked and found sound

- **The Imperial City's plan exports.** The roads' host reads the city's centre, span and gates through
  `capitalCentrePixel`, `capitalSpan` and `capitalGates` (none hard-coded, IC-GRAND's 25 pixels read as they stand); the
  far landmarks, the outskirts and the living world find the city by its family or its ordinal 0 alike (`capitalSkyline.js`
  CITY, `tamrielCapitals.js` imperialOutskirts, `livingIndex.js` capitalStreet); URBANIZER dresses no slice of it
  (`townFabricStand.js` fabricTown - every slice is capital 0); the zone's peace stands in each slice's streets (each a
  TownCity with its exterior - `zoneSafe.js` settledAt); no carved water reaches any of its 625 slices
  (`breathtaker.test.js` with ARENA2, 13 of 13).
- **Load order.** The roads' build restarts when the places' pixels move (`tamrielRoadsHost.js` frame - the trace and the
  relief move the land's version, and the places with it); the serpent's lanes are WHOLE with the trace (`worldLanes.js`
  whole) and the ports past the Bay are a live list keyed by the same trace (`tamrielPlacesHost.js` registerLive's stamp),
  so the two flip together; the ground's own byte cache is dropped as the trace lands (R1-2 was the one memo that was
  not).
- **The cache keys.** The roads' region key carries GROUND_ROLL_VERSION, every WOODS byte, the trace and its relief, the
  dials and the named roads' spec (`tamrielRoads.js` inputsPrint); the map's waters move `watersInkVersion` on every
  install; Deep Waters' bake (BAKE_GENERATOR_VERSION 2) is the Bay's alone.
- **Determinism and the kill switches.** The graht-oaks are a hash of the world's tile, the named roads' legs pure on each
  worker's ground; `?capitals=off` and `?graht=off` are honoured offline only, `?midring`, `?farfield` and `?nightfog` move
  no shared state.

## The streams' ARENA2 pins on the merged head

- The 35 files of the last day's work that read ARENA2 (the hosts', the bands', the zone's three - `audittesa2z_zone`,
  `zoneline`, `zonesafe` - the roads', the ports', the Arena District's, the capitals', the zones', the world's, E1's, the
  Bay's walls, the relief, the town shapes, the biomes, the town outlines and walls, URBANIZER's fabric and the world-wide
  ones), on 367cf11766 with ARENA2: 366 of 366, none skipped. Again on this lane's head with SMOOTH-LAND merged
  (ad2a8d71de), with `breathtaker`, SMOOTH-LAND's `smoothland` and this audit's pins beside them: 389 of 389, none
  skipped (AUDIT TESA II C1's capitals pin some 30 minutes of it at a load of 20).
- `test/world/breathtaker.test.js`: 13 of 13 (the waters' four on the freeware's trace among them).
- The tests that read `travelRoute.js` (18 files, R1-2's reach): 256 of 258. The two that fail are wall-clock bounds,
  AUDIT STARTS V4/V7's "under a second and a half" (the slowest 8,741 ms) and START2's voyages' "under three seconds"
  (9,906 ms), at a load of 27 to 31 on four cores - every route assertion before them passed, and AUDIT TESA III E1
  recorded the same two at loads of 20 to 34. R1-2 costs them nothing: the ground's water past the table asked 1.2 million
  times, the code before the fix against it, alternated under one load - 1,407 to 1,677 ms before, 1,234 to 1,880 after,
  the same answers.

## Versions

No relay change, no account change, no migration. The roads' cache is unmoved (R1-1 and R1-2 change nothing a region's
build reads).

## What this lane could not check

A browser (memory was the shared machine's): R1-4's pop and R1-1's drawn wall are measured, not photographed. The whole
continent's roads against the rivers (five of Cyrodiil's regions were built - the rivers are Cyrodiil's alone). Main's
merge (E2-3's renumbering).
