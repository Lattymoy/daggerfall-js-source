# AUDIT TESA III, lane E1 (2026-10-26) - the world, the scenes, the formats and the characters past the Bay, read cold

The owner, of TESA (`03-World/Arena-Provinces.md`, `03-World/Tamriel.md`, `03-World/World-Wide.md`,
`03-World/Town-Shapes.md`, PR #1184 at 8df5233181): **"Comprehensive audit on everything to ensure perfection"**. Lane E1
of six read the branch's changes against main (`git diff b5faf20db9..8df5233181`) in `src/world/`, `src/scenes/`,
`src/render/`, `src/formats/`, `src/characters/`, `src/assets/` and `src/main.js`, with their tests and records. Lane E2 read
`src/systems`, `src/net`, `src/ui`, `server/` and `server-account/`. Each finding has its verdict here; the code says the
same at every site it changed (`AUDIT TESA III E1-<n>`).

## How it was run

- **Where the last audits stopped.** AUDIT TESA II's lanes (C, G, K, M, P, R, Z - recorded in the arc pages they fixed)
  read TESA up to bf98d29f8d (MAP-LINES). Everything after it on TESA had no audit: REGION-LINES 2, WW7-1 to WW7-6,
  TOWN-SHAPES TS2 to TS7, START1 to START3 (AUDIT STARTS read those), the TESA x AUDIT TESA II merge and GRANT-SLEEP (lane
  E2's). The lane read those first and hardest, then the earlier work for what the earlier audits did not reach.
- **The earlier fixes, held.** CI runs no test with ARENA2, so every ARENA2-gated pin is only ever run on an agent's
  machine. Run here with the freeware's data (`ARENA2_PATH`), on this head: the TESA suites (183 tests), AUDIT TESA II's
  world pins (83), the town shapes' (27), the hosts', starts' and world-wide pins (170) - all pass but two wall-clock
  bounds under the shared machine's load (20 to 34 on four cores): `auditstarts.test.js` V4/V7's "under a second and a
  half" (passed alone) and `start2_provinces.test.js`'s voyages "each planned in under three seconds" (the slowest 5,528 ms
  alone at a load of 23 - every route assertion before it passed). E2's files, reported to it.
- **Probes on the freeware's data**, each in the lane's scratchpad: every possible Arena city-state seed walled two ways,
  the road ring against the painter over the Bay's 3,444 towns, the Deep Waters bake against the streamed ground at its
  339 coastal location pixels and through the pixel promote, the Eltheric isles' bake, the bench's town map.
- **Mid-audit**, the coordinator gave three more streams their files (the roads past the Bay, terrain and Tamriel's ground,
  the capitals' and the places' fabric): a finding there is recorded with its fix, proven on a copy, and routed.

## The findings

| Id | Sev | Finding | Verdict |
|---|---|---|---|
| E1-1 | MED | TS2's road ring is mostly never paved, and where it is paved at a shore town it can pave the sea | FIXED by the roads' stream (VOYAGER, KPbICA stream F), pinned (4 mutants) |
| E1-2 | LOW | The fixed-city bench (`?exterior`) draws no wall on a Bay city's town map and walks its people through the wall | FIXED, pinned (4 mutants) |
| E1-3 | MED | WW7-1/WW7-2's record says travellers, caravans, outlaws and divers live past the Bay; the merge kept P7's guard and none do | FIXED (the record); the guard lifted on the owner's call (WW7-7, 2026-10-26) |
| E1-4 | MED | The Deep Waters bake blends a coastal town's rect DFU's way while the streamed ground follows TS2's outline - the seafloor before 262 Bay towns shaped against a coastline that is gone | FIXED for the Bay, pinned (4 mutants); the Eltheric isles' half FIXED by the terrain stream (stream G, 2026-10-26), pinned (7 mutants) |
| E1-5 | LOW | The jungle's trails keep off a town's rect, not its outline | FIXED (GRAHT1's stream) - reproduced on the freeware |

### E1-1 - the road ring round a town's outline (MED, FIXED)

`roadPainter.js:"Math.abs(DIM - 1 - x - y)"`
- the FAST-SUITE guard (2026-10-20) passes by every tile off the centre cross, the two diagonals and the rect, proven by
`tools/roadGuardProof.mjs` against the rect's law. TS2 (2026-10-25) moved "Paint roads around locations" from the rect's
padding to its outline's ring (`terrainTiles.js` townRoadRing: the tiles off the town's ground within 2.5 of it), and the
ground reaches past the rect (the margin's wander runs up to 7.5 tiles past the grid; the rect 2-3), so the ring lies mostly
outside it. Scenario: any town on a road. Probe (`paintRoads` with the terrain job's own rect - its mask and ring - over every
Bay city, hamlet and village): 1,451,249 ring tiles, 259,606 paved (17.9%); Aldton 8.4%, Dragontail 8.3% - the ring reduced
to stubs where the arms cross it. And TS2 keeps a shore town's sea, while the ring paves 46 on any ground: 2,670 ring tiles
over water (21 towns), 516 paved today.

Fix (proven on a copy of the painter - every Bay town, all 3,444): the guard passes no ring tile
(`&& !locationRect?.ring?.[y * DIM + x]`), the ring paves no water ground (`ctx.rect.ring[ctx.i] === 1 && ctx.ground !==
TILE.water`), and `smoothRoadHeights` keeps off the ring as it keeps off the rect (DFU's ring was the rect's padding, never
smoothed). Result: every dry ring tile paved (1,448,579 of 1,448,579), none of the ring over water (the 183 water tiles
left are the road's own arms - the mod's table, AUDIT-TESA A3-5), every tile off the ring byte for byte as before, no ring
tile smoothed. `tools/roadGuardProof.mjs` holds as it is (the guard only skips less). Pin to add with it: a ring outside
the rect and off the cross paved; a ring tile over water not; a ring tile's samples unsmoothed - mutants on each clause.

FIXED (2026-10-26, the roads' stream - KPbICA's VOYAGER, which did not supersede it: its curved painter runs past the Bay
alone and paved its whole ring already) as proposed, the three clauses:
`roadPainter.js:"!locationRect?.ring?.[i]"`, the ring's condition
`roadPainter.js:"AUDIT TESA III E1-1: never".."m &&"`
and `roadPainter.js:"if (rect?.ring?.[y * tDim + x])"`; and the curved painter past the Bay keeps the same sea
(`roadCurves.js:"if (ground === WATER)"`). Measured through the real kernel
(`generatePixelTerrain` with Basic Roads' arrays, every 8th of the Bay's 2,043 towns on a road): the ring paved 15.6%
before, 124,699 of 124,699 after, none of it over water in the sample. `tools/roadGuardProof.mjs` (its stale imports
pointed back at `src/world/road/` now - the painter moved there) against the base painter (8df5233181): 103,487 real-map
cases, 113,727 with the sweep, none differ - its rects carry no ring. Pins:
`test/world/road/audittesa3e1_ring.test.js` (a ring tile off the rect, the cross and the diagonals paved, every tile off
the ring and the rect the arms' own; a ring tile over water left, by both painters; a ring tile's samples unsmoothed).
Mutants: `tools/mutants/audittesa3e1.json` E1-1 (4, all dead). PIN MOVED (AUDIT TESA III E1-1): TOWN-SHAPES' ring
condition (`test/world/terrain/townshapes.test.js`).

### E1-2 - the bench's town map and walkers (LOW, FIXED)

`exterior.js:"cityNav.setBlockData(b.x, b.y, wallLaidBytes(dfLocation, b.x, b.y, b.dfBlock.rmbBlock.fldHeader.autoMapData),"`.
TS6 laid a city's wall on its town map and shut it to its walkers in the streaming host alone (`exteriorAutomapToggle.js`,
`pixelBuild.js` townWalkShut) and its record named no other host (Home.md, THE FOUR HOSTS). TS7 then opened every Bay city's
ring on the door's read - the bench (`scenes/exterior.js`, `?exterior`, `?region&loc`) reads the same edited location, so it
stands TS7's wall model but draws its town map and carves its walk grid off the blocks' own bytes, where the ring's wall
bytes are gone. Probe: Daggerfall on the bench - the classic ring 11,064 wall-byte cells, after the edit 0; the wall's 12,513
cells open to its walkers (Wayrest alike; Sentinel 442 of its own). FIXED: the bench draws the wall
(`wallOnTownMap(..., townWallCellsOf(dfLocation), loc.width)`) and carves its walk grid off each block's bytes with the wall
laid in (`townWalls.js` wallLaidBytes - a copy; a block it crosses none of, or a city with no wall of its own, its own bytes;
`CityNavigation.setBlockData` shuts every cell not 0). Expressions in two existing statements: `bootExterior` grows no line.
Pins: `test/world/audittesa3e1.test.js` (the law, the walk grid shut where raw bytes walk through, the two wirings; with ARENA2
Daggerfall, Wayrest and Sentinel shut on every wall cell). Mutants: `tools/mutants/audittesa3e1.json` E1-2 (4, all dead).

### E1-3 - the living world past the Bay, as recorded (MED, FIXED in the record)

`livingIndex.js`'s `export const livingRoams = (p) => inBay(p.px, p.py);` (as it stood at 79ca20e8d1). AUDIT TESA II P7 held the living world's trips,
dives and bands to the Bay "until WW7" - its ways' planner read only the Bay's ground. WW7-2 (on TESA, before the merge)
taught the planner the land past the Bay, and WW7-1's record says travellers, caravans, outlaws, divers, carried word and
hideouts find a town there. The TESA x AUDIT TESA II merge kept P7's guard (`townsNear`, `dungeonsNear`, `townsIn` the Bay's
alone; `livingLanes.js` from: no traveller sails from past the Bay) and recorded nothing of it, so WW7-2's ways are asked by
no trip, and the record and the host's comment said otherwise. Verified: the merged pins themselves (`ww1_world.test.js` "no
trip from past the Bay", `audittesa2p_hosts.test.js` P7) pass on this head. FIXED: `03-World/World-Wide.md` WW7-1, WW7-2 and
its stage row, and the world host's comment on its ways, said what the code did. The owner's call, 2026-10-26: *"Yes
travellers to need to travel everywhere. Same for ships."* - WW7-7 lifted the guard (`03-World/World-Wide.md` WW7-7), the
three this record left unmeasured each measured there: the trips' cost past the Bay (the squares by the roads' places, the
ways on a bounded window, a tile of ground a frame), the roads past it (the planner walks them), and a room whose clients
stand the land differently (a trip keeps to its own side of the Bay's edge, and past it waits on the roads laid whole).
WW7-9 and WW7-10 then took the trips and the packets across the edge, the land past the Bay waking a region at a time
(`03-World/World-Wide.md` WW7-9, WW7-10).

### E1-4 - the Deep Waters bake against TS2's ground (MED, FIXED for the Bay)

`deepWatersBakeCache.js:"export function rectsLookup"` built `{ xMin, xMax, yMin, yMax }` off rows of five numbers
(`deepWatersClient.js` deepWatersLocationRects), so `deepWatersBake.js` pixelWaterSampler's blend - commented "a town's
outline, as the streamed build flattens it" - was DFU's rect blend, which lifts the sea in the rect into land; TS2's
streamed ground keeps that sea. Scenario: any coastal Bay town, Deep Waters on (the default). Probes: at 262 of the 339
coastal location pixels the bake called 453,230 samples of the streamed sea land (Antelibuton 3,741, Aldwall Rock 3,265, the
Mole and Giant Tavern 8,515); the bake's own output moved - 235 pixels' fine masks (111,912 cells), 133 pixels' states,
20,801 partial-bit bytes; through the pixel promote at the default Water Depth (250 m) the seafloor before Antelibuton,
Aldwall Rock and Cudogudax stood up to 14, 15 and 27 m off (Cudogudax: 1,464 of its 4,225 floor vertices by more than 5 m),
shaped against the old rect's coastline. FIXED: each row carries the rect's outline (its `shape`), `rectsLookup` hands it to
the blend, `rectsFingerprint` hashes its bytes, and BAKE_GENERATOR_VERSION is 2 so no bake kept off the rect alone is read
from a player's IndexedDB. After: on the bake's own threshold, the bake's water is the streamed ground's, sample for sample,
at all 339 pixels. Pins: `test/world/audittesa3e1.test.js` (the row, the lookup, the key, the version; with ARENA2 Antelibuton
and Aldwall Rock equal to the streamed ground where the rect alone was thousands of samples off). Mutants E1-4 (4, all dead).

The Eltheric isles (routed, then FIXED by the terrain stream - stream G, 2026-10-26): the Eltheric bake read each template's
rect (`etherWatersBake.js` etherPlaceRects, the templates' own map ids), while each isle's clone stands its own TS2 outline,
seeded by its own map id (`etherPlaces.js` etherPlaceId). Probe, 60 port isles sampled: bounds the same at every one, 3
disagreeing, 564 samples. Two fixes were open: the clones keep DFU's rect blend, or the isles' bake is handed each isle's
outline as it asks for it. The second was taken (the coordinator's word: an outline rather than none). `etherPlaceRects`
keeps each template's outline basis once (`terrainTiles.js` locationOutlineBasis - the occupied tiles on the outline's box
and the tiles the stamp would lay, packed a bit a tile; 2,737 distinct of the freeware's 7,538 templates, 2.15 MB, 255 ms of
packing on a 7.5 s walk), and `etherRectAt` draws the isle's outline under its own id and the rect setLocationTiles cuts
under it (`outlineOfBasis`, `rectOfBasis`; locationShapeField is the basis under the location's own id, and carries it,
unenumerated). The bounds move with the outline too (a ruin's by two tiles in the pin's fixture), so both are the isle's.
After, over 120 port and ruin isles about Veilhaven on the freeware data: outline and bounds the clone's at 120 of 120; the
bake's water off the streamed ground 3,691 samples at 13 isles before, 0 after. Pins: `test/world/audittesa3e1_ether.test.js`
(3, a template and its clones built and stamped by setLocationTiles itself); mutants `tools/mutants/audittesa3e1_ether.json`
(7, all dead). PIN MOVED: `test/world/terrain/bootrects.test.js` (the Bay's row carries its outline - E1's own change,
whose source pin it had left).

### E1-5 - the jungle's trails and a town's outline (LOW, FIXED)

The trails kept off the rect (`x >= rect.xMin && x <= rect.xMax ...`), and TS2's ground runs past the rect (E1-1's
measure), so a trail through a jungle town's margin past its rect wore dirt into the town's own ground. REPRODUCED by the
canopy's stream (GRAHT1, `03-World/Graht-Oaks.md`) on the freeware, over every town of the Bay's jungle (1,407 in its
reach): the rect's square had let trails run on over the cleared ground of 442 of them - 10,891 corners, 3,603 of them
corners of a town's own outline tiles - and cut 35 short among the trees of their open ground. FIXED:
`jungleTrails.js:"if (rect && cornerCleared(rect, x, y))"`
- a corner of any tile `natureCleared` keeps (the outline and NATURE_CLEARANCE round it, as its trees keep) is the town's;
a rect without an outline its rect, as before. After: 0 and 0. Pin: `test/world/jungletrails.test.js` "a town's clearing";
mutants `tools/mutants/jungletrails.json` E1-5 (3, all dead).

## What was checked and found sound

- **TS4's walls**: every one of the 432 seeds an Arena city-state can take (nine provinces, 48 slots), by both outline
  laws (the lobed and the Imperial City's outskirts' round) - 864 walls, every building tile of every one inside its line.
- **The walls' and blocks' ids** (`townWallBlockName` and its index and model on a map id's low 20 bits): only a TownCity
  template is walled (410 of MAPS.BSA's, every one; no other type has a WALLAA block), and Arena's city-states' low 20 bits
  are distinct (500,000 and up) - the countryside's ids, which share their low 20 bits across 64 rows, never take a wall.
- **The location indices past the Bay** are disjoint: Arena's from -1,000,000, the countryside's -2,000,000 to -35,554,432,
  the lairs' from -40,000,000, the capitals' from -41,000,000.
- **WW7's town table** (`townTable.js`) answers every use the host's Map had (`get`, `set`, `has`; nothing iterates it).
- **The registry's live list** (AUDIT TESA II P7): its stamp holds the places' pixels, the fit and the land; the capitals'
  version moves only at the boot.
- **The Bay's `y * 1000 + x` keys left in the lane** (the snow's frame, the POIs' rides, the Deep Waters rows): each is the
  Bay's or a frame's few pixels - the POIs are held to the Bay's 1000 x 500 by their law.
- **The regions past the Bay's races** (`REGION_RACES` 2..7): every reader adds one for DFU's Races or tests `=== 1`.
- **TS2 at a pixel's edge**: the outline's blend fades to the land's own over its last four samples, as DFU's rect blend
  does outside its rect, and every rect stays inside (11..116); a walled city's ring cells are open ground there.
- **The merge's resolutions** in the lane's files (world.js, tamrielPlacesHost.js, pastBayRows.js, tamrielGround.js,
  terrainGen.js, terrainTiles.js) - the two halves of the registry and the strait at a corner as recorded.

## Not checked

- **The running game.** A SwiftShader boot past the Bay needs some 4 GB (AUDIT TESA-BIOME J6) and the machine held 2 GB free
  of 15 beside five other lanes' browsers; two boots at Daggerfall were stopped (the first on the title menu). E1-1's and
  E1-4's effects are measured on the data and through the pixel promote, not seen on screen.
- **The DW-A oracle** (`dwa_bake.test.js`, the mod's own `DistanceBakeVanilla`, never in the repo): with E1-4 the port's
  coastline departs from the mod's at TS2's coastal towns too; its bounds (coarse sea 0.998, fine 0.9 over every coastal
  pixel) leave room for 262 pixels, unconfirmed.
- **BOOT-RECTS' cost** with TS2's outline in every rect it reads (the isles' 7,538 templates and the Bay's coastal towns, on
  the page's thread at the boot): under a load average of 20 the outline was 2.31 ms of a town's 7.44 ms read - a third of
  the walk; no clean measure was possible here.

## The pins

`test/world/audittesa3e1.test.js` (4 tests, 2 with ARENA2); `tools/mutants/audittesa3e1.json` (8 mutants, all dead with
`node tools/mutate.mjs --jobs 2 tools/mutants/audittesa3e1.json`).
