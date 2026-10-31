# Town Shapes - away from perfect squares (TOWN-SHAPES, 2026-10-25)

The owner, shown the lore-scale Imperial City (a wheel of districts round the White-Gold Tower, circular outskirts, a long
bridge over the lake): *"This needs to be the scale of the Imperial City with the outskirt locations being circular also.
Any city that uses a body a water shouldnt be a square and should blend in"*; asked how large and which towns: the
Imperial City 7 x 7 pixels, and *"IC should be round, give other towns unique shapes. Its time to move away from perfect
squares. Rnsute nobody's home is removed. This needs to be perfection"*; shown both ways (every building kept, or edge
blocks left out): the mixed way - **towns past the Bay take unique block outlines, the Bay's towns keep every building**
and take organic ground, walls and shores round them.

## 1. What stood (DFU's reference, measured on the freeware)

- A town is a rectangle of RMB blocks; the ground under it the bounding box of the tiles its blocks stamp plus a clearance
  (`TerrainHelper.SetLocationTiles`, `world/terrain/terrainTiles.js` setLocationTiles), flattened whole to the PIXEL's mean
  and blended to the pixel's edge (`BlendLocationTerrainJob`) - a truncated pyramid on a square base.
- On a coast the blend lifts the pixel's sea into land: of the 86 Bay town pixels holding sea, Antelibuton's 6,922 water
  corners became 242, Aldwall Rock's 5,968 became 218 - a square of land and sand cut into the coast.
- Daggerfall's building blocks are built to their edges (20-44% of a block's town map is buildings, to its sides), so a
  town that keeps every building is its grid's square at its core (the first preview, `scratchpad` renders shown the
  owner).

## 2. The stages

| Stage | What | State |
|---|---|---|
| TS1 | the outline law (`world/townShape.js`) | BUILT (with TS2) |
| TS2 | a town's ground is its outline - stamped, flattened to its own land, eased back to the land, the sea kept, the road's ring round it | BUILT (below) |
| TS3 | towns past the Bay laid as unique block outlines (edge blocks left out - no home can stand past the Bay before WW7-5 deploys) | BUILT (below) |
| TS4 | a walled city past the Bay walled on its outline (the twelve WALLAA blocks make only rectangles); the Bay's cities keep Daggerfall's walls | BUILT (below) |
| TS5 | the Imperial City 7 x 7, round, its lake round inside its outline; its outskirts' towns round | BUILT (below) |
| TS6 | trees, walkers and the town map follow the outline | BUILT (below) |
| TS7 | the Bay's walled cities walled on their outline; what stood at Daggerfall's gates at the new gates; a town's yards on its own ground | BUILT (below) |
| TS8 | a bend's tower the corner tower's body alone - no stub of wall into the town or out past the wall | BUILT (below) |
| TS9 | the road's ring painted whole, its angled edges blended | BUILT (below) |
| TS10 | the roads painted through a town's ground its grid's roads - no yard on one | BUILT (below) |
| FB1028 | the Bay's walls: no door, a bend's two lengths cut on its tower, every road and street to a gate | BUILT (below) |

**DEPLOY RULE**: TS3 ships in the same release as WW7-5 (homes past the Bay, `bible/03-World/World-Wide.md` WW7-5): a home
past the Bay is bought only in a town's final outline, so no block a home stands in is ever left out.

## 3. TS1 - the outline (`world/townShape.js`)

- **The buildings' tiles** (`townOccupancy`): a block's town-map bytes (`AutoMapData`, 64 x 64) - a byte not 0 a
  building's or a wall's - each ground tile (16 a block side) taken where any of its 4 x 4 bytes is; the town map's row
  `r` is the tile row `15 - r/4` and its column `c` the tile column `c/4` (measured on the wall blocks WALLAA04-07, whose
  walls sit beside the two rows they stamp). A block's misc models and flats each take their tile and the eight round it
  (`terrainTiles.js` locationShapeField: x * 0.025, (z + 4096) * 0.025 - `tamrielCapitals.js` miscModelAt's law), so a
  fence, a well, a tree of the block's own stands on the town's ground and never on the land's slope.
- **A field of flats** (FB1028, `townShape.js` townFieldTiles): the town packs' crops stand on the block's plane, sown up
  to 42 m round their record, so the terrain's outline takes every tile a field sows - after a wall's round, which reads
  none.
- **The outline** (`townShapeField`): every tile within `TOWN_SHAPE.margin` (4.5 tiles, 29 m) of a building's, the margin
  wandering by `wander` (3 tiles) on two octaves of value noise seeded with the town's map id - never so far in that a
  building's tile is left out - and every hole it closes round filled (a square, a street, a garden between the houses).
  Its field is each tile's distance to a building in quarter tiles (0 outside). It is laid over the grid and `SHAPE_PAD`
  tiles round it, so the margin wanders out past the blocks' squares. A town with no building's tile is its whole grid.
- **No block is dropped and no building moves** in TS1/TS2: the grid, its blocks and every building key are
  Daggerfall's (`net/homeLaw.js`: a home is its town's map id and its building's key), so every home stands where it
  stood.
- A capital is its own plan's (`dfLocation.capital`: no outline) - TS5.

## 4. TS2 - the ground follows the outline (BUILT)

DEPARTURE (named; Port-Ledger section A, TOWN-SHAPES): from `TerrainHelper.SetLocationTiles` and `BlendLocationTerrainJob`.

- **The stamp** (`setLocationTiles`): only the outline's tiles are stamped; each block is read once for the outline and the
  stamp. The rect it answers is the stamped tiles' bounds and clearance as before, and carries the outline (`shape`, 128 x
  128 codes) - every reader of the rect has its bounds, and every blend its outline.
- **On the land** (`townGroundMask`): a tile of the margin past `TOWN_SHAPE.seaMargin` (1.5 tiles) of a building whose
  land is water (a corner sample at or under the ocean line, read on DFU's own samples) is no ground of the town's - a
  shore town meets the sea where the shore is. FB1028: nor is a margin's tile nearer the pixel's edge than the ease needs to
  meet the edge's own ground at `SHAPE_GRADE` (`SHAPE_EDGE_TILES`, 4, at the least). Its stamped tile there is given back
  (`unstampOffShape`), and the land's own tiles are laid.
- **The flatten** (`blendShapedTerrain`, through `blendLocationTerrain`): every sample a tile of the town's ground touches
  set to the mean of the land under it (`ground` read there, never the sea's; a step over the beach at the least,
  `SHAPE_FLOOR`) - the job answers that height, the location stands at it. A rect without an outline (a capital) takes
  DFU's blend as before and answers its average.
- **The ease** (FB1028): the rest eased back on a smoothstep over `SHAPE_BLEND_TILES` (12, 77 m), or as far as the town
  stands over or under the land there at `SHAPE_GRADE` (0.6 m a metre on the mean). The sea is eased as the land is:
  lifted as far as the ease reaches, kept past it. The ease never runs past its share of the way to the pixel's edge, whose
  samples are the land's own, so a neighbour's ground meets it. Its reach is read on DFU's own samples alone, so every copy
  below eases alike.
- **Its copies** follow by the same rect: the Deep Waters bake's water test, the landforms' lift (`landformLiftField`,
  its difference field flattened on the outline with DFU's own samples as its land), the classic pass. AUDIT TESA III
  E1-4 (2026-10-26, `01-Overview/audits/Audit-Tesa-III-E1.md`): the bake's did not - its rows were the rect's four numbers
  (`deepWatersClient.js` deepWatersLocationRects, `deepWatersBakeCache.js` rectsLookup), so it blended DFU's way and called
  the sea TS2 keeps land: 453,230 samples at 262 of the Bay's 339 coastal location pixels, the seafloor before them shaped
  against the old rect's coastline (up to 27 m off at the default depth). A row now carries the outline, the key its
  bytes, BAKE_GENERATOR_VERSION 2. The Eltheric isles' bake read its templates' rects, while each clone stands its own
  outline (seeded by its own map id) - 3 of 60 sampled port isles, 564 samples: it now draws each isle's outline and the
  rect cut under it off its template's basis under the isle's own id (`terrainTiles.js` locationOutlineBasis,
  outlineOfBasis, rectOfBasis; `03-World/Deep-Waters.md`).
- **The road's ring** (`townRoadRing`, `roadPainter.js`): the mod's "Paint roads around locations" paves the tiles off the
  town's ground within two and a half of it - its outline's ring, where it paved the rect's padding. AUDIT TESA III E1-1
  (FIXED 2026-10-26, the roads' stream): the painter's FAST-SUITE guard passed by every tile off the centre cross, the
  diagonals and the rect - proven against the rect's law alone - and the ring lies past the rect, so 82% of it was never
  paved (259,606 of 1,451,249 ring tiles over the Bay's 3,444 towns; a road's stubs where its arms cross it); and the ring
  paved the sea where TS2 keeps it (2,670 ring tiles over water). Now the guard passes no ring tile, the ring paves no
  water and `smoothRoadHeights` keeps off it (`roadPainter.js:"&& !locationRect?.ring?.[i]) continue;"`): the
  whole dry ring paved (the audit page's record).
- Measured on the freeware: Daggerfall stands within its walls as before (its rect 11..116, its tiles' histogram
  unchanged, its ground 0.166139 for DFU's 0.166147 - its own land's mean); Antelibuton keeps its sea (thousands of water
  samples where DFU's blend left about 240); Gothway Garden's outline wanders on every side. The corpus' stamped tiles
  9,252,505 (DFU's 9,565,908); every rect still interior (11..116).
- A walled city of the Bay kept Daggerfall's wall ring here (its wall blocks' bytes are walls - occupied - so its ground
  wrapped the ring); TS7 walls it on its outline as a city past the Bay is (its round and apron its ground).

PINS MOVED: `test/world/terrain/terrain.test.js` (Daggerfall's rect bounds and outline, its ground, the corpus' stamped
total, the environs' first tree), `test/render/boot2.test.js` (the entry's reach 85: `world/townShape.js`, a leaf).
Tests `test/world/terrain/townshapes.test.js`; mutants `tools/mutants/townshapes.json` (15, all dead).

### TS2 at FB1028 TOWN-GROUND (FIXED 2026-10-28)

Discord, the day #1184 shipped: Westhead Moor *"Weird crop hovering, giant craters and cliffs on the outskirts"*; Aldwall
Rock *"some big holes and uhm.. cubic mistakes ... The ports are now off a cliff instead of smooth?"*. Measured on the
freeware as the stream builds a Bay town online (both town packs, the Landforms row, Basic Roads, the gates' roads): each
step between two samples 6.4 m apart, less the step the same pixel has built with no town.

- **The sea beside the town.** TS2 stood a town at its land's mean and kept the sea a sample past its margin: Westhead Moor
  at 81 m over a sea at 34 m, a 46 m step; Aldwall Rock 34 m. Its holes were the sea inside the outline, its squares a
  dock's tiles out in the sea, and a port's jetty met the cliff's face (`systems/naval/quays.js` planQuay).
- **The ease on a hillside.** Twelve samples whatever the height: Madla at 241 m over land falling to 98 m, steps of 19 m.
- **The pixel's edge.** The edge band eased the town's own ground in its last four samples: steps of 12 m at Westhead
  Moor's edges, its blocks there off their ground.
- **The crops.** A field had only its record's tile on the outline: 769 crops at Westhead Moor and 706 at Aldwall Rock
  stood off their plane, up to 47 m over the sea.

| the Bay's 86 town pixels holding sea | towns with a step over 10 m (over 20 m) | the worst | steps over 10 m | flats off their plane | sea samples kept |
| --- | --- | --- | --- | --- | --- |
| DFU's blend | 7 (2) | 27.1 m | 2,816 | 0 | 11,737 |
| TS2 | 53 (28) | 99.5 m | 9,131 | 5,763 in 30 towns | 162,400 |
| now | 3 (0) | 18.6 m | 995 | 0 | 135,907 |

Of 177,754 sea samples in DFU's own ground. Westhead Moor's worst is 7.3 m now and Aldwall Rock's 7.7 m, every crop and
model on its ground. The three still over 10 m (Tunmont 18.6 m, Kalunnunu 14.4 m, Naresa 13.9 m) stand their blocks 7-8
tiles from a pixel edge 100-120 m under them; DFU's blend steps 25, 15 and 17 m there. Over all the Bay's 3,444 town
pixels: TS2 57 towns over 10 m (28 over 20 m) and 5,902 flats off in 37; now the same three, no flat or model off. The
ports (106, their 619 quays planned on this ground): past a jetty's end the ground rose over its deck by more than 6 m at
92 of them (83 over 12 m, Westhead Moor's 44 m, Aldwall Rock's 31.5 m, the worst 102 m); now at 5, none over 12 m.

**The smaller departure.** A town that stands over its sea cannot meet it without a step unless the sea gives room. The
ease takes the least room its grade needs, 77 m at the least, where DFU lifts the whole rect's sea. A least of four
samples kept 143,128 sea samples but stood 7 towns over 10 m at the shore's own steps.

**The copies.** Each blend reads its reach on DFU's own samples, so the stream, its classic pass, the landforms' lift and
the Deep Waters bake ease alike: the bake's sea is the stream's at every sample of both towns (BAKE_GENERATOR_VERSION 3).
A town's level moved at 103 of the 3,444 (the edge band takes margin off its mean; 5.2 m the most). The Eltheric isles'
bake draws an isle's outline off its template's packed basis, which carries the crops' tiles too (`etherWatersBake.js`
etherPlaceRects), and the boot walks' kept blocks keep a model's id (FIRST-VISIT, `groundTilesKept.js`), so a second
launch's outlines hold the crops as the first's. THE GROUND MOVED: its shores and outskirts by tens of metres, so GROUND_LAW (`net/wire.js`) moves 2 to
3, and RELAY_VERSION with it; the print now reads a town (`03-World/Landforms.md` GROUND-GATE).

**The records.** A saved height is DFU's frame: DFU's own samples through the town's classic blend
(`scenes/groundFrameHost.js`). The blend moved that ground: of the 3,444 town pixels, 747 by over 5 m and 147 by over
20 m (Chesterbrugh +291.8 m, Westhead Moor +55 m, Aldwall Rock -37.8 m). The ground's print, which read no town, held
the same cells under GROUND_LAW 2 and 3; TS2's 12-sample ease now moves it 8.9 m.
So GROUND_FRAME_LAW (`world/terrain/terrainSampler.js`) moves 3 to 4: a record stamped before 4 (an outer camp, a pile,
an anchor, the restored position) is moved by its town's blend's change at its spot (`world/landforms.js`
townGroundMovedField, today's blend less TS2's), on the Bay and past it, the row on or off. TS2's blend is kept for this
alone, over the outline before the crops (`world/terrain/townBlendBefore.js`). RELIEF-PEAKS keeps its own law,
RELIEF_FRAME_LAW 3.

**The records #1371 wrote.** #1371's build stood today's ground and still stamped 3, so a record it saved would be moved
twice. A record stamped before 4 is moved only when it stands nearer the old ground than today's (`groundFrameHost.js`
townMove); with the ground there not yet loaded it is moved, as one written before #1371.

**Not a Bay town's ground alone.** The blend is every shaped town's, so towns past the Bay moved too (Sunhold's and
Woodhearth's banks, below).

**AUDIT FB1028 A2-A3 (GROUND_LAW 4).** The cold audit of #1371 found two defects. A2: a town's own ground stood at its
level to the pixel's last sample but one, so where its margin reached the edge band the seam was a cliff (Sentinel's
south seam fell 47 m in 12.8 m). A3: each sample read its reach off its own height, so the departure kept,
Δ·S(c/Δ), fell as Δ grew past 4c/3: beside tall relief, land further off the town's level ended nearer it (a pit on a
hill's flank; Chesterbrugh's row y = 83 rose, then fell, over land rising 964 to 1021 m).

**The law now** (`world/terrain/terrainTiles.js` blendShapedTerrain). On the land the departure kept `d` samples out is
the least of the land's departure times the smoothstep over SHAPE_BLEND_TILES and a smooth cone (easeCone: 32/3 of that
smoothstep to nine samples, then a grade a sample). It never falls as the land stands further off, rises at 4/3 of
SHAPE_GRADE at the most, and reaches the land where FB1028's did. The sea and its shore's first 10 m (SHAPE_SHORE_M)
fade to FB1028's ease, its reach off its own depth: the cone there kept a raised port's sea low further out (a jetty's
90th percentile 0.11 to 1.14 m). The two agree to a departure of 41 m. There, sea far below can still end nearer the
level than sea less far. The weight reads `ground` alone, so every blend eases alike.

**The seam.** A sample's share of the way to the edge is measured, inside the band the seam needs, from the town's last
stood sample: a corner of a tile within a tile of a building's, a model's, a flat's or a crop's (a model's foot overhangs
its own tile: at distance 0 alone Aldwall Rock's model 323 stood 1.9 m in its ground). Every stood sample keeps the
level, so only the core's corners past a tile ease with the seam. Where buildings stand in the band (Sentinel fills its
pixel) the seam stays steeper than the grade: easing it would stand them off their ground, as TS2 did.

**Across the edge (BUILT: ACROSS-EDGE, `../01-Overview/bugs/Field-Bugs-2026-10-29c.md`).** The worst seams meet the next pixel: Tunmont's west 130 m over its
neighbour's sea, Kalunnunu's north 109 m over open sea, Naresa's south 166 m under a hillside rising away, Sentinel's
south 47 m under land its neighbour's tavern leaves 54 tiles of room. A run at the grade needs 34, 29, 43 and 12 samples
past the edge. Every producer of a pixel's ground (the stream's worker, its classic pass, the landforms' lift, the
records' frame, the Deep Waters and isles' bakes, the print) would have to read its neighbours' outlines and blended
levels, a second pixel's build each, and the first two would raise land in open sea.

**The records' frame.** This ground is unmerged, so GROUND_FRAME_LAW stays 4: a record stamped 4 was written on it, and
townGroundMovedField reads today's blend, this law (Westhead Moor's move 60.0 m at the most, where FB1028's was 55 m).
GROUND_LAW moves 3 to 4 (RELAY_VERSION world279) and BAKE_GENERATOR_VERSION 3 to 4. The print's town cell, a hillside,
moves 7.8 m at 19 of its points.

**AUDIT FB1028 A2-A3 measured.** As above, the stream's build of every Bay town pixel; the row off reads the blend alone.

| the Bay's 3,444 town pixels | FB1028 | A2-A3 |
| --- | --- | --- |
| towns with a step over 10 m (row on) | 3 | 3 |
| the worst step | 18.6 m | 18.6 m |
| steps over 6 m: by the sea / at a pixel edge / on land | 120 / 1,222 / 6,333 | 116 / 1,184 / 3,996 |
| steps over 10 m | 995 | 969 |
| flats and models off their plane | 0 | 0 |
| sea samples kept | 135,907 | 135,907 |
| ground past a jetty's end over its deck: 90th percentile, worst, ports over 6 m (of 106) | 0.11 m, 11.48 m, 5 | 0.11 m, 11.44 m, 5 |
| towns whose edge row the blend steepens over 5 m (row off) | 56 (worst 23.3 m) | 52 (worst 23.1 m) |
| slope reversals 10 samples in (row off) | 19,065 (107 towns over 3 m, worst 11.0 m) | 19,867 (110 towns over 3 m, worst 11.0 m) |
| Westhead Moor's / Aldwall Rock's worst step | 7.33 / 7.73 m | 7.33 / 7.73 m |

**What grew, and why.** Slope reversals, 802 more (110 towns over 3 m, where 107): the cone climbs with distance, so on a hill's far side the eased ground rises while the land falls, and the seam's run turns the land's own slope by an edge. The worst is Naresa's at its seam, as before. The ports are FB1028's: the sea eases as it did. The seam gained little (edge rows over 5 m 56 to 52, the three towns over 10 m the same): its room is the core's corners past a tile, since all a model may stand on keeps the level.

Tests `test/world/terrain/fb1028_townground.test.js` (10; A2's, A3's and the port's after the edge's), `fb1028_townground_real.test.js`
(ARENA2) and `fb1028_townground_frame.test.js` (6). Mutants `tools/mutants/fb1028_townground.json` (47, all dead). PINS
MOVED by A2-A3: the edge test's level under the buildings (its stood samples, not all its ground), the frame's Westhead
Moor move (55 to 60.0 m), the bake's version 4, world279's 44 pins; re-aimed by content: the ease's mutants here,
TS-the-sea-lifted, E1-4-the-version-unmoved, BAY-LEFT-GROUND-GROUND-LAW-not-moved, NIRNROOT-SAGE-relay-unmoved,
S38-version-not-bumped. PINS MOVED by FB1028:
`test/world/reliefpeaks.test.js` and `bayleftground_frame.test.js` (the stamp 4), the ground's print (a town's cell),
`test/world/terrain/townshapes.test.js` (Antelibuton's sea 2,084 samples, where 3,000), `test/world/audittesa3e1.test.js`
(the bake's version 3), `test/systems/naval/portships_bay.test.js` and `portships_real.test.js` (sounded off the water
alone no ship stands on a bank at Chestertower, Pilliweyn, Wadijerareg, Sunhold or Woodhearth: their banks were TS2's
cliffs); re-aimed by content: TS-the-sea-lifted, TW-the-round-unread, E1-4-the-version-unmoved,
RELIEF-PEAKS-record-move-on-stamped, -on-the-bay and -unhanded; TS-the-edge-moved at the pixel's edge kept the land's (AUDIT FB1028: its first aim
was FB1028-the-edge-share-unread's).

## 5. TS3 - a town past the Bay is its own outline of blocks (BUILT)

DEPARTURE (named; Port-Ledger section A, TOWN-SHAPES): from DFU's whole grid - every cell of a MAPS.BSA row laid.

- **Which towns**: every clone past the Bay - Arena's places (`world/arenaLocations.js`: a city-state a TownCity, a town a
  TownHamlet, a village a TownVillage) and the countryside's (`world/tamrielCountry.js`) - as the host stands it
  (`scenes/tamrielPlacesHost.js` arenaLocationAt, countryLocationAt). Never a capital (its own plan's, TS5), a lair, or a
  town of the Bay.
- **The blob** (`world/townOutline.js` outlineCells): a cell is kept where its centre, in the half-extents of the grid's
  cells that are no wall's, is within a rim that wanders by bearing - `TOWN_OUTLINE.reach` 0.98, three to five lobes 0.14
  to 0.24 deep at a phase off the town's map id, a value noise of 0.08 on top. A grid narrower than three cells both ways
  keeps every cell (a village is whole).
- **Every kind kept** (townOutlineCells, wholeOutline): the lobes are tried at eight turns over half a turn and the first
  that keeps one of each kind of the town's buildings is taken (a guild's hall by its guild, a temple by its god, a shop by
  its type, its tavern, its palace); a kind no turn keeps gives back its holder nearest the middle; the kept cells joined
  into one piece by the shortest ways between them. Measured on the freeware over every template at four seeds each: no
  town loses a kind; a city-state keeps its middle and leaves out 10 to 40 per cent of the cells inside its walls (85 per
  cent leave out some), a hamlet of three cells or more a side one to four.
- **The same on every client**: the kinds a cell holds are read off the game's own blocks (`classicKinds`, through
  `BlocksFile.readClassicBlock` - past the world-data door), so a client running a town mod keeps the same cells; the strip
  is the draw as the client lays its blocks (`drawNamedBuildings`), so every kept building keeps the entry it draws there.
- **The open cell** (`TOWN_OUTLINE_BLOCK`, `TESAOPEN.RMB`, index 906000, on the door behind no switch -
  `scenes/modWorldData.js` installTownOutline): every ground tile record 63 (past GROUND_RECORD_LIMIT - never stamped, the
  land's own), no tree, no town-map byte, no building, model or flat. The town's ground (TS2) wraps the kept blocks.
- **The list** (outlineTownLocation): a new location - its template's grid and list untouched - whose left-out cells are
  the open block, its building list stripped of exactly the named entries those cells drew (the arena's law, `world/arena/
  arenaCity.js` standArenaInLocation) and `outline` its counts. The list's other entries (its houses' - DFU draws none of
  them) stay, as the arena's do.
- **Homes**: none can stand past the Bay before WW7-5 deploys; this ships in the same release (the DEPLOY RULE), so no home
  is ever in a cell left out. The Bay's towns keep every block.
- A city-state's wall ring is left out with its cells - and with it the city's start markers: Daggerfall keeps a city's
  only start markers in its four gate blocks (WALLAA08-11, measured: every TownCity). TS4 walls its outline, stands its
  gates and lays its markers again; its south-west cell (the ring's corner) is the wall's carrier, not the open block.

Tests `test/world/townoutline.test.js`. PINS MOVED: `test/tesa2_arena.test.js` (the arena clone laid as its outline),
`test/tesa7_country.test.js` (the host's stub carries the outline).

## 6. TS4 - a city past the Bay walled on its outline (BUILT)

DEPARTURE (named; Port-Ledger section A, TOWN-SHAPES): from DFU's wall ring - the twelve WALLAA blocks, a rectangle.

- **What Daggerfall stands** (measured on the freeware): every TownCity (410) is walled - corner blocks WALLAA00-03 (a
  tower, model 444, a square 16.8 m), side blocks 04-07 (four lengths of wall, 445: 25.6 m long, 9.6 m thick, 10.85 m
  high, its inside its local -z - rotation 0 is the north wall) and gate blocks 08-11 (446 in a length's stead). The walls
  hug the blocks inside: 12.8 m in from the ring cell's inner edge. Each gate block holds the city's start marker 15.2 m
  OUTSIDE its gate (an arrival lands at the gates) and two small models (41739) inside it.
- **The round** (`world/townShape.js` townRound, WALL_ROUND): the tiles 2.5 or nearer a building's tile (the town's tiles
  as its ground reads them - `townTiles`: the blocks' town-map bytes, their misc models and flats), closed by 5 (grown by
  it and shrunk back: a lane under ten tiles between two blocks' houses is the town's), its holes filled.
- **The line** (`world/townWalls.js` wallLine): the round's edge traced on the tile centres (marching squares, the cut a
  1024th of a tile off the grid's own values - a whole distance put two crossings on one centre and forked the round),
  the longest round, counter-clockwise, its steps worn off (Chaikin's corners, twice).
- **The pieces** (wallPieces): a gate (446) where the line meets the bearing of each of the template's gate pieces from
  the grid's middle - a gate crowding the one before (four lengths) slid on along the wall, one crowding the first slid
  back; between gates runs of whole lengths of wall (445) in chords of two, each stretched to its chord; a tower (444) at
  every chord's end, square to the line's bend. Every piece's outside faces out.
- **The model** (townWallModel): every piece one model of the city's own (`world/customModels.js`, id 1,000,000 and its
  map id's low 20 bits - AUDIT RELEASE R1-1, `01-Overview/audits/Audit-Release-R1.md`: at 3,000,000 a Bay city's wall shared
  an id with one of IC-GRAND's city cells), composed of the player's own ARCH3D pieces (needs 444, 445, 446) - turned so its local +z is its
  outward normal and its +x along the line (no mirror), stretched along its length - so it collides and draws as any model.
  WALL-FLICKER (section 15): every length and gate cut clear of the towers' bodies.
- **The carrier** (standTownWall, townWallBlockJson): a block of the city's own (`TESW<low 20 bits in base 36>.RMB`, index
  1,000,000 and the same bits) in its south-west cell: open ground, the wall's model at its corner, and a start marker
  outside each gate at Daggerfall's offset (15.2 m out, 3 m along). The host stands it as it clones the city
  (`scenes/tamrielPlacesHost.js` arenaLocationAt) - from the blocks as this client serves them, as its ground reads them.
- **The ground** (`world/terrain/terrainTiles.js` locationShapeField): a walled city past the Bay stands on its round, and
  its apron - 4.5 tiles past the wall's line - is its own (coded 1: kept on the water too, so a coastal city's wall and its
  markers stand on land); past the apron the margin wanders as any town's. A carrier's model and markers shape none.
- Measured on the freeware over all 407 city templates: every kept building inside its wall, four gates each, every marker
  outside its wall on the city's own ground, every piece on it; 117 pieces a city on the mean; the pieces' stretch 0.72 to
  1.11 (94 per cent within a tenth of a length); 7.7 ms to outline a city and 15.9 ms to lay its wall, once a session.
  TS6: a chord that cut in more than 3 m (`TOWN_WALL.sag`) from the line across a tight bulge stood its wall on a house in
  34 of 136 cities (one to eight town-map cells); such a chord is laid a length at a time - none in any of the 407 now,
  130 pieces a city on the mean, their stretch 0.75 to 1.12.
- The Bay's cities kept Daggerfall's walls at TS4 - their gate blocks carry their start markers, Immersive Travel's
  carriages (IT1, a layer on WALLAA08-11) and the town mods' gates - until TS7 carried those to the new gates and walled
  them on their outline too (a ring a town mod rebuilt keeps its ring).

Tests `test/world/townwalls.test.js`. Mutants `tools/mutants/townwalls.json`. PINS MOVED: `test/world/townoutline.test.js`
(a walled city's corner the wall's carrier).

## 7. TS5 - the Imperial City at seven pixels, round (BUILT)

The owner, asked how large: *"7x7 pixels"* - seven map pixels a side, 5.73 km across (a pixel 819.2 m); asked again
(*"7x7 km?"*): seven pixels, the plan 5.7 km a side, its city wall 3.9 km across. SUPERSEDED in its measures by IC-GRAND
(`03-World/Arena-Provinces.md` IC-GRAND, 2026-10-26, the owner: *"Lets do 20km"*): twenty-five pixels, 20.48 km a side,
its city wall 13.8 km across, its outskirts fifty pixels out - every law below the same at the new span.

- **The wheel 2.17 times out** (`world/imperialCity.js` IMPERIAL_SPAN 7, IMPERIAL): the city wall 1950 m from the middle
  (TESA11's 900), the palace wall 650, Green Emperor Way 548-574, the tombs (twelve) at 416, the isle's shore 2200; each
  landmark's distance out the same (the Colosseum 1390, the Temple of the One 1475, Talos Plaza's dragon 1390, the
  Divines 1300, the Prison 2340, the University 2420, the Waterfront's quay 2370 and its six piers to 2560); most a third
  larger (the Colosseum 100 x 80 m, its ways in 10 m wide - its 64 bays' middles 4.4 m off its axes at the new size), the
  Temple of the One as it stood (its dome kept at vanilla's texel density). A tower in the city wall every five degrees.
- **The White-Gold Tower massive** (the owner: *"Tower needs to be massive"*; IMPERIAL.tower): twice TESA11's every way -
  1360 m to its gilt spire's tip (the camera draws to 6 km), its plinth 344 m across, its shaft 224 m across at its foot,
  its fins out to 208 m; its door a man's as it was. Its plaza of stone out to 260 m round it (inside the tombs' ring at
  416), the city's start markers on it 220 m out; still wholly in the centre slice.
- **The lake round** (IMPERIAL.lake, 2720 m - 2820 when TS5 was built; TESA x AUDIT TESA II, below): Lake Rumare a ring
  from the isle's shore to its far shore; past it the land (`imperialLand`, district Rumare Shore - no district of the
  city's), its sand ten metres, then the land's own tile (OPEN_TILE, never stamped); a cell wholly past it open ground (plan
  cell `O`, the open block of TS3). The plan's corners are land, not lake. Talos Bridge runs from the west gate to the far
  shore and comes down over its 40 m landing on the city's own block (`bridgeLine`, 2760 m out).
- **The plan** (56 x 56, its anchor (28, 28)): 554 lake, 820 open, 1003 of the city's own, 625 of Daggerfall's blocks, 134
  gardens (at 2820 m: 717, 664, 998, 623, 134); an own block's code two base-36 characters a coordinate (`I0r0r`), a garden's name too where a plan passes 36
  cells (`world/tamrielCapitals.js` capitalGardenName - the other capitals' as they were).
- **The slices' names** (IMPERIAL_SLICE_NAMES, made from the plan): the centre Imperial City; else the district holding
  most of its cells (a sector's, the Prison's, the University's, the Waterfront's - eight cells at the least), else City
  Isle, Lake Rumare or Rumare Shore. A district over several slices names each.
- **The landmarks in parts** (IMPERIAL_PARTS, `world/capitalModels.js` modelPart): at seven pixels the city wall stands
  three pixels from the centre, and the land view's distance may be one - a landmark carried whole by the centre would be
  gone from an outer slice. Each landmark is drawn whole once and carried in parts: a part for each slice whose square it
  touches (`EXTENTS`, generous by its towers), the part its triangles whose middles stand in the slice and its doors there
  (the White-Gold Tower's to its castle in the centre's). 55 parts of the thirteen landmarks; every triangle in one.
- **The pictures far out** (`vanillaTexels`): each model's UVs taken from a whole number of pictures nearest its middle -
  the same look - so its texels hold in a 32-bit UV kilometres from the city's middle (the University had drifted to 40.5
  texels a metre).
- **The outskirts round** (IMPERIAL_OUTSKIRTS 14 pixels, `world/tamrielCapitals.js` imperialOutskirts, `world/townOutline.js`
  ROUND_OUTLINE): a town past the Bay within fourteen pixels of the city's centre, off its own pixels, takes a round outline
  - no lobe, no noise, its rim 0.9 of its grid's half-extents (a three by three leaves its corners) - every kind of its
  buildings still kept.
- The plan is made as the module loads: 100-125 ms in node (TESA11's 57), its walls' and ways' lines made once and a
  segment's box tried before its distance.

Tests `test/world/imperialscale.test.js`. PINS MOVED: `test/tesa11_imperial.test.js` (the plan, the districts, the slices,
the pixel law, a slice's location, the ground, the port blocks and the parts, the bridge), `test/tesa10_capitals.test.js`
(the east slice, the gardens' names, the anchor block, the centre's models and slice, a kind missing),
`test/tesa10c_capitals.test.js`, `test/tesalore_capitals.test.js`, `test/audit_tesa.test.js` (the gardens' names),
`test/world/worldWide/ww7_castles.test.js` (the drawn models), `test/systems/l10n4_hardcoded.test.js` (Lake Rumare),
`test/tesa2_arena.test.js`, `test/tesa7_country.test.js` and `test/world/townoutline.test.js` (the host's round outskirts).

### TS5 at TESA x AUDIT TESA II (2026-10-25)

The audit's branch built its lane C on TESA11's three pixels; merged into TS5's seven, its laws hold at the larger scale:
- **The rim (C1)**: no landmark in a capital's outer 70.4 m on a side of land. At 2820 m the lake laid water into it, so
  the lake is 2720 m: its far shore, its sand and the bridge's landing short of the rim's inner edge (2796.8 m) and inside
  the city's own blocks (2764.8 m) - AUDIT-TESA A6-3 keeps every landmark out of Daggerfall's blocks, and at 2740 m the
  landing stood 15 m into the plan's west `O` cell. On three pixels the rim's inner edge was the far shore and the bridge
  ran to it; on seven the land past the lake stands between, and the bridge ends at its landing.
- **The causeways (C3)**: each to its compound's gate - on seven pixels the Prison's runs off its bearing (its compound's
  half a sixth of the way out), and TESA-LORE's pin reads the causeway's own line.
- **Every slice's arrivals (C7)**: `imperialSliceMarkers(s)` works one slice the first time its carrier is built - the
  forty-eight at once took 270 ms. The four corner slices hold no city ground (the plan's corners are land): they carry
  no marker, and an arrival there stands at their edge, as DFU's in a location without one (`locationEntrance.js`).
- **A quad on one plane (C14)** with TS5's whole-picture offset (`vanillaTexels`' `o`): the 45-degree pin reads from its
  first corner.
- **The rect by the slice's sides** (`terrainTiles.js` setLocationTiles, `capital.rim`): C1's rect ended where a slice's
  stamped ground ends - on seven pixels a corner slice is all open land (`O`, none stamped) and stood unflattened, a seam to
  its neighbours. Now the rim's 11 tiles on each outer side and DFU's clearance on a side its own slice shares, whatever
  the slice holds: the span meets the land, and itself, level (`audittesa2c_capitals.test.js` C1/C2 with ARENA2).

## 8. TS6 - the trees, the walkers and the town map follow the outline (BUILT)

DEPARTURE (named; Port-Ledger section A, TOWN-SHAPES): from `DefaultTerrainNature.LayoutNature`'s rect and from
`CityNavigation.SetRMBData`'s whole grid.

- **The clearing** (`world/terrain/terrainNature.js` natureCleared, outlineDistance): a town whose rect carries its outline
  keeps nature off the tiles within `NATURE_CLEARANCE` (DFU's 4) of it, by the true distance - round, never a square cut
  about it; a rect without one (a capital, a World of Daggerfall site) keeps its rect widened by 4 as DFU does. Every reader
  asks it: DFU's scatter, its border law (ECOTONE1's dfuTiles), the gathering nodes' stand (natureStandsAt), the forests,
  the jungle, its trails (`world/jungle/jungleTrails.js` cornerCleared - AUDIT TESA III E1-5: they had kept off the rect,
  running on over the outline's margin past it) and Valenwood's graht-oaks (`03-World/Graht-Oaks.md`).
- **DFU's stream kept** (dfuScatter): DFU walks one stream across the pixel and draws for no tile of the rect, so a tile of
  the rect off the clearing stands what DFU's law would there on the tile's own dice (dfuTiles, as ECOTONE1 lays a
  neighbour's tile) - every flat past the rect is DFU's own, but those on the town's ground past its rect (its outline's
  margin, which DFU's rect never covered) and four tiles past it, dropped after their draws.
- **The woods' fields** (placesPull): drawn back from a town's outline, not its rect.
- Measured on the freeware: a Bay town's outline covers nearly its whole square and runs a few tiles past it (Gothway
  Garden's frees one tile of its grown rect; its clearing reaches four tiles further out than DFU's) - Daggerfall's pixel,
  its ground nearly to the pixel's edge, stands 808 flats where DFU's rect left 1,237, its first DFU's own. A town past the
  Bay's open cells (TS3) are the land's, wooded as it is.
- **The walkers** (`world/townShape.js` shutOffGround, the terrain job's `townGround` - townGroundMask's): a walk grid cell
  whose tile is none of the town's ground walks no one - a town past the Bay's open cells, a Bay town's square past its
  outline, its tiles the sea took back (TS2); `scenes/pixelBuild.js` shuts it as it builds the grid. Four cells a tile, the
  grid's rows the stamp's (`setLocationTiles`: a block's tile (tx, 15 - ty)), pinned against both. TOWN-BOARDS
  (2026-10-27, `03-World/Urban-Fabric.md` section 9): the law is one function, `world/townShape.js` onTownTile - the
  walkers are shut by it and URBANIZER's fabric is planned on it, so no fence of a yard runs down the land past the ground
  (and the fabric reads the painted paths by it, TS10 below).
- **The wall** (`world/townWalls.js` townWallCells, townWallCellsOf): a city past the Bay's wall as cells of its town map
  (64 a block, 1.6 m) - a length its stretched 25.6 m by 9.6, a tower 16.8 m square, each turned to its line. Its walkers
  never cross it (shutTownWall - its gates shut, as Daggerfall's gate blocks carve theirs); its town map draws it in
  Daggerfall's wall byte (0x18, WALLAA00-11's) over a copy of each block's bytes (wallOnTownMap,
  `scenes/exteriorAutomapToggle.js`). Measured over every third city: every wall closed on its walk grid, 0.23 ms a city.
  THE FOUR HOSTS (AUDIT TESA III E1-2, 2026-10-26): the streaming host (`scenes/world.js`, through `pixelBuild.js` and
  `exteriorAutomapToggle.js`) and the fixed-city bench (`scenes/exterior.js`, `?exterior` / `?region&loc`) - the bench had
  been left out, and TS7 opens every Bay city's ring on the door's read, so its Daggerfall drew no wall at all on its town
  map (11,064 wall-byte cells before TS7, 0 after) and its walkers crossed every one of the wall's 12,513 cells. It now
  draws the wall (wallOnTownMap) and carves its walk grid off each block's bytes with the wall laid in
  (`townWalls.js` wallLaidBytes); the interiors (`scenes/worldModes.js`) and the dungeons (`scenes/dungeonContext.js`)
  stand no street.

Tests `test/world/townfollow.test.js`. Mutants `tools/mutants/townfollow.json`. PINS MOVED: `test/world/terrain/terrain.test.js`
(Daggerfall's environs: 1237 flats -> 808), `test/ui/town/arena_townmap.test.js` (the streaming host's town map rows through
wallOnTownMap).

## 9. TS7 - the Bay's cities walled on their outline, their gates dressed, their yards on their ground (BUILT)

The owner, shown the open items (the yards, the carriages and the boards at the new gates, the Bay's square walls): *"Do all
the open items"*. DEPARTURE (named; Port-Ledger section A, TOWN-SHAPES): from the Bay's WALLAA rings, and from DFU's yard
and gate dressing standing only where Daggerfall's blocks put them.

- **The Bay's walled cities** (`world/townOutline.js` wallBayCity, an edit of the location as the door reads it -
  `formats/worldData/worldDataReplacement.js` registerLocationEdit, after the Arena's): a grid whose border is Daggerfall's
  wall blocks (WALLAA00-11) and nothing else - every one of the Bay's 410 walled cities, measured - has its ring cells open
  (`TESAOPEN.RMB`) but its south-west corner, its wall's carrier; its own grid kept as `wallTook`, `outline` walled. Every
  building is kept (the ring blocks hold none, so no building's key moves). Its wall is TS4's, registered as it is read and
  made when its carrier is first laid out (`world/townWalls.js` registerTownWall, 12-15 ms a city once a session); its
  ground TS4's round and apron. A ring a town mod rebuilt - Beautiful Cities' wall-and-farm and wall-and-tavern composites,
  its corners - is not Daggerfall's and keeps its ring; Beautiful Cities' own redrawn gates (served under the classic
  names) go with the ring, their dressing with them.
- **Templates as they were read** (`world/townShape.js` unwalledLocation): the places past the Bay clone the Bay's cities -
  `arenaTemplates`, `countryTemplates`, `capitalBase`, `cityBlockNames` and `outlineTownLocation` read a walled city's own
  grid back (its ring, its gates), so no clone carries a Bay city's carrier.
- **The terrain never reads a carrier** (`terrainTiles.js` setLocationTiles): it is open ground that shapes none, so a
  boot's walk over the coastal towns (BOOT-RECTS) makes no wall.
- **What stands at a gate** (`world/townWalls.js` gateFurniture): each gate piece's own gate of its template (nearest by
  bearing, each once - townWall's `frames`: the gate model's origin, 1.6 m in from its subrecord, and its outward normal)
  and what that gate block stands about it - the game's own block (the two bulletin boards, 41739, inside each gate - the
  same on every client) and Immersive Travel's records on it while the mod is loaded (`world/immersiveTravelGates.js`
  carriageRecordsOf: the carriage, the cart, the horses, the driver in faction 8642, whose click is its Fast Travel) -
  carried from the template gate's frame to the new gate's, a model turned with it; the start marker TS4's own. A walled
  city's carrier is a carriage town (hasCarriageGate).
- **Stood clear** (townBlockedCells, GATE_CLEAR): a tower stands either side of every gate here, where Daggerfall's gate
  block has a straight wall - 1,655 of the Bay's 3,280 boards stood in one. A gate's things inside it move further in
  together, those outside further out, by the least 0.8 m step that leaves each clear of every wall cell and town-map byte
  by its reach (a model 2.4 m, a flat 0.8 m); one that cannot go with its group takes its own nearest clear place on its
  side (2 boards of 3,280).
- Measured over all 410 Bay walled cities: four gates each, every wall closed on its walk grid, no house under one (its pin
  read the wall's own cells - FB1028 measured the houses: none within 2 m); 3,280
  boards, every one inside its wall; 1,640 carriages and 1,640 drivers, every carriage outside; every piece clear of the
  wall and the houses and on the town's ground.
- **Off the roads, at every gate** (AUDIT CAPITAL-CARRIAGES L2 and L3, 2026-10-29; townGateOutside, GATE_ROAD_CLEAR,
  `world/townGates.js`): a wall built on its pixel's roads can have more gates than its template's four frames, and the
  things outside a gate stood where its road came in. A gate past the frames takes its nearest frame's things again,
  turned to face it. The things outside stand on the town's own ground, 2.5 tiles and their reach off each painted road's
  and track's line and off each gate's passage, the group moved along the wall up to 32 m. A gate's laid road goes round
  the carriage's models. The Bay, every second walled city, the packs off, on Basic Roads' roads: 731 of 780 gates
  dressed, now 780; 29 carriages on a road, now 0. Past the Bay 2 of 109 gates (Jehanna, Rihad) have no clear place.
- **The yards** (`world/merchantYards/merchantYardSites.js` townGroundOf's `shut`, `scenes/world.js` townPlacesFor,
  `scenes/pixelBuild.js`): a town's Stable, Wagon Yard, joinery and port places are placed on its walk grid shut as its
  walkers' is (`world/townWalls.js` townWalkShut: off its ground, on its wall). Measured over a quarter of the cities and
  towns past the Bay: 6 yards stood partly off their town's ground (a left-out cell's slope); none now.

Tests `test/world/baywalls.test.js`. Mutants `tools/mutants/baywalls.json`. PINS MOVED: `test/world/townwalls.test.js` (the
host hands its blocks both ways), `test/world/townfollow.test.js` (one walk shut), `test/world/merchantyards1.test.js` and
`test/systems/shipyards1_found.test.js` (the places handed the walk shut).

## 10. TS8 - a bend's tower (BUILT)

The owner, on the tamriel branch: *"The new city layout structure is broken. Town walls and their curvature expose thin
open extruding walls"*. Measured on the freeware: Daggerfall's tower (ARCH3D 444) is a CORNER's - its body a 9.6 m square
(the wall's own thickness, where two walls cross) centred at (-2.8, 2.85) of its origin under a crown from 12.85 m, and
off its +x and -z sides two stubs of wall 6.4 m long, 8.05 m tall, open at their ends, where a corner's two lengths meet
it (its 16.8 m "square" in TS4 was this whole: the body and its stubs). TS4 stood it at every bend of a line that is no
corner, its origin on the line and its +z out: one stub stood 3.55 m into the town past the wall's inner face and one
2.85 m out past its outer face, both ends open, and the body off the line (the owner's thin open walls - rendered on
Gallobrugh's wall, every tower).

- **The bend's tower** (`world/townWalls.js` bendTower, CORNER_TOWER): the corner tower's body alone, its middle the
  origin - every face under the crown past the body's +x or -z side (the stubs) left out, and with them the faces on
  those two sides (they stood only over the wall walk, a door in each - the stubs closed them under it); the two sides
  closed with the body's own outer faces (its -x and +z, whole from the ground to the crown) turned a half round about
  its middle, so a side's stone and pictures are the tower's own. Kept a model; a tower not of 444's measure (to 5 cm -
  a mod's) stands as it is. `townWallModel` stands it for every tower piece. A length's end (open, as Daggerfall's are:
  they meet a tower or the next length in its ring) now stands inside the tower's body at every bend - the body is the
  wall's thickness, and a length's end is a 9.6 m segment through its middle, whatever the turn.
- **WALL-FLICKER** (section 15): where the line runs straight, a length's faces lay in its tower's own and both drew
  there; every length and gate is cut clear of the body now.
- **Its cells** (`townWallCells`, WALL_FOOT): a tower's square on the town map and the walk grid is its body's, 9.6 m -
  every wall still closed on its walk grid (TS6's measure, re-run), every board and carriage still clear (TS7's).
- FB1028 (section 16): the body is grown across the wall to hold its two lengths' ends, each cut on its middle line.
- The one law for every town the new layout walls - a city past the Bay (TS4) and every one of the Bay's 410 walled
  cities (TS7, Daggerfall itself among them): `registerTownWall`'s model is `townWallModel`'s. Measured with its faces
  drawn one-sided, from outside and inside the wall: every 23rd city past the Bay (18 cities, 1,285 views), back faces
  seen (an open end) 599,878 pixels before, 2,044 after; every 23rd of the Bay's walled cities (18, 1,267 views), 591,570
  before, 2,013 after - the rest the coping's knife edge seen at a grazing angle, as on Daggerfall's own straight walls.

DEPARTURE (named; Port-Ledger section A, TOWN-SHAPES): from the corner tower stood whole - a bend's tower is its body.
Tests `test/world/townbends.test.js` (4, two on ARENA2: the game's 444 made a bend's, its sides closed to the crown;
every ninth city past the Bay - every length's and gate's end in a tower's body or square on the next length, every
face under the crowns within a piece's footprint). Mutants `tools/mutants/townbends.json` (9, all dead). PINS MOVED:
`test/world/townfollow.test.js` (a tower's cells 6 by 6, where 10 by 10). `townwalls.json`'s TW-the-carrier-shaping
survives on the branch's base as here (its pin no longer reaches the carrier's shaping) - recorded, not changed.

The owner's next words on the same walls - *"walls cant be climbed over"* - were the enhanced climb's, not the walls':
`03-World/Parkour-Arc.md` CLIMB-CREST.

## 11. TS9 - the road's ring whole, its angled edges blended (BUILT)

The owner, on the tamriel branch: *"Roads around the city arent properly blended when they are angled"*. TS2 moved the
mod's "Paint roads around locations" ring from the rect's padding onto the outline (`townRoadRing`: the tiles off the
town's ground within two and a half of it). Rendered on the freeware's tiles (Gothway Garden, and Gallobrugh's template
walled past the Bay on the same pixel), two faults:

- **The ring in pieces.** The painter passes by every tile it cannot reach (FAST-SUITE's guard: off the pixel's centre
  cross, its two diagonals and the location RECT). The outline's ring runs outside the rect - a walled city's ground is its
  round and its apron, a Bay town's margin wanders past its blocks - so its tiles were passed by, but where the cross
  and the diagonals ran through them: the ring stood as a bar across each road into the town and a stub at each
  diagonal. The guard now lets a ring tile through (`roadPainter.js` paintRoads: `locationRect.ring`), and the ring is
  painted whole.
- **Its stairs.** Where the outline runs at an angle, the ring's edges were stairs of whole road tiles (46), where the
  mod's own diagonal roads blend theirs with the diagonal's edge (DIAG_OUT: 47 over dirt, 55 over grass) on their flanks.
  `townRoadRing` now codes the half tiles (`RING`, `world/townShape.js`): a tile off the ring and off the town's ground
  with the ring on two sides at a corner and neither on the other two (a step's notch, outside) takes a half with its
  road toward that corner; a ring tile with the town's ground on two sides at a corner and the ring on the other two (a
  step's corner, inside) one with its road away - so a 45-degree stair is one straight edge each side, as a diagonal
  road's is. The painter turns each as the mod turns its flanks (RING_HALF: a NE-SW road's flank with its road north and
  west is flipped, south and east as it stands; a NW-SE road's north and east rotated, south and west both - pinned
  against the mod's own flanks), never over the sea (its tile kept) nor over a road an arm laid there; GRASS-PATH1's mask
  takes it as a path.

**AUDIT BAY-LEFT F2 - the half tiles past the Bay** (2026-10-27, `01-Overview/audits/Audit-Left-In-The-Bay.md`). A pixel
past the Bay takes VOYAGER2's curved painter (`world/road/roadCurves.js` paintCurvedPaths), whose ring pass paved the
ring's whole tiles alone, and the straight pass after it is handed no road: on three pixels past the Bay 2 of 72 half
tiles were laid, 72 of 72 on the Bay. The ring pass now lays them as `roadPainter.js` paintPath does - the diagonal's own
edge by the ground, turned by RING_HALF, never over the sea - and RING_HALF's home is `roadCurves.js`, both painters
reading it. After: 72 of 72 past the Bay.

DEPARTURE (named; Port-Ledger section A, TOWN-SHAPES): the mod paves its rect's padding square and whole; the outline's
ring (TS2) is blended where it runs at an angle. Tests `test/world/terrain/townring.test.js` (4, its last on ARENA2: both
towns' rings painted whole, their angled edges blended, and a third built on a pixel truly past the Bay with the roads
layer's road, its half tiles every one its code's; F2's synthetic case the curved painter's ring tiles the Bay painter's
bytes for every code - grass, dirt, the sea). Mutants `tools/mutants/townring.json` (11, all dead). PIN MOVED (F2): the
ARENA2 case's "past the Bay" city had stood on Gothway Garden's own Bay pixel, so the curved painter never ran;
TS9-notch-turned's file is `roadCurves.js` now and `audittesa3e1.json`'s E1-1-the-curved-ring-paves-the-sea re-aimed by
content (dead). PINS MOVED:
`test/world/terrain/townshapes.test.js` (the ring's whole tiles by their code); `townshapes.json` TS-the-square-ring and
`fastsuite_roads.json` FAST-road-rect-dropped re-aimed by content (dead).

## 12. TS10 - no yard on a painted road (BUILT)

The owner, on the tamriel branch: *"Sometimes locations like the horse stable, etc can be placed on pathways"*. A town's
yards (the Stable, the Wagon Yard, the joinery - MERCHANT-YARDS, CARP-YARD - and a port's places) are placed on its walk
grid off every road cell, a road cell being one its block's own ground tile lays as road (CityNavigation's weight 15 for
46, 47, 55). But the roads the TERRAIN paints through a town's ground stand on cells its blocks lay as open land: an arm
of the pixel's road or track across a cell a town past the Bay leaves open (TS3, `TESAOPEN.RMB`: record 63, weight 7),
or across a Bay city's old wall ring (TS7). Measured over every twelfth city and town past the Bay on a pixel with roads
every way (N, S, E, W, NE, SW): 8 of 373 yards stood on a painted road (Ripwark's Wagon Yard on 82 of its cells).

- **The paving** (`world/townWalls.js` paveOnGrid, PATH_WEIGHT): every open cell of a town's grid whose terrain tile the
  road painter wrote - GRASS-PATH1's `paths` mask, the painter's own record (a track's dirt reads as the land's by its
  record alone) - is a road of the grid (weight 15, CityNavigation's for a road tile; a building's cell stays shut, a
  walker's flag kept). A yard keeps off it and may face it, as it keeps off and faces the town's own streets.
- **The walk** (`townWalkShut`, its third argument): the pixel's walk shut paves its terrain job's paths
  (`scenes/pixelBuild.js`), for its walkers and its yards alike - the walkers take a painted road as a street. Its `key`
  names the paths it read, so a town's places (`scenes/world.js` townPlacesFor's memo) are placed again when its pixel is
  built again once the roads land (ROADS 25's rebuild), never kept from the roadless build.
- Measured again: 0 of the 373 on a painted road, every one of them still placed.
- **AUDIT BAY-LEFT F3 - the key through the fabric** (2026-10-27, `01-Overview/audits/Audit-Left-In-The-Bay.md`): the
  pixel build wraps the walk shut in URBANIZER U3's (`world/urban/townFabricStand.js` fabricWalkShut), a new function
  that carried no `key`, so the memo read 'shut' whatever the roads and kept the yards placed before them - on the Bay
  and past it. The wrapper's key is now the town's shut's and whether its fabric stands, read when asked.
- **TOWN-BOARDS 2 - the fabric's yards** (2026-10-27, `03-World/Urban-Fabric.md` section 9): URBANIZER's fabric read
  Daggerfall's own roads alone, so a painted road over a cell it plans could be a yard's grass, fenced across. It reads the
  same paths now (`world/urban/townFabric.js` fabricGrid `onRoad`, through `world/townShape.js` onTownTile - the tile law
  paveOnGrid reads too): a painted cell is a road of the town's, and no yard, fence or woodpile of the fabric stands on it.
  paveOnGrid and townWalkShut are unchanged.

DEPARTURE (named; Port-Ledger section A, TOWN-SHAPES): from CityNavigation.SetRMBData's weights, which read a block's own
ground tile alone - a road the terrain painted on a town's ground is its grid's road. Tests `test/world/townpaths.test.js`
(6, its last on ARENA2; F3's the fabric's key moving with its roads). Mutants `tools/mutants/townpaths.json` (10, all dead). PINS MOVED: `test/world/townfollow.test.js`
(the walk shut reads the paths and paves them between its ground and its wall); `townfollow.json` TF-the-wall-unwired and
TF-the-ground-unshut re-aimed by content (dead).

## 13. ROAD-FOLLOW - a walled town's gates where its roads come in; a capital's road on to its gate (BUILT)

The owner, 2026-10-27: *"Also, city gates do not line up with the roads"*; then *"No band aids or half assed work"* -
every walled town's gates meet its roads, everywhere. The Overworld's half of the record is `06-Systems/Travel-View.md`
ROAD-FOLLOW.

**Measured first** on the freeware (every walled city's wall made as the game makes it, against the roads the terrain
PAINTS on its pixel - the terrain job's own path tiles; a gate has its road where a painted road lies in a road's width
straight out of its front within 48 m; a road runs into the wall where a painted tile lies under a length or a tower and
the road it is part of reaches no gate within 40 m):

| | walled | gates | gates with a road | lengths and towers a road runs into | towns at fault |
| --- | --- | --- | --- | --- | --- |
| the Bay's (TS7) | 410 | 1,640 | 90 | 2,712 of 51,155 | 410 |
| past the Bay (TS4) | 60 | 240 | 7 | 248 of 7,632 | 60 |

and the capitals' 14 road gates in a wall: each road's paint stopped at the span's edge, 79.6 to 200 m short of its gate
and up to 160 m to one side of it (Mournhold's four and Helstrom's two 79.6 and 82.4 m short; Alinor's and Torval's north
gates 80.4 m short and 158 and 160 m aside, their east and west 34 m aside; Solitude's 96 m short and 113.6 m aside; the
Imperial City's Talos Bridge landing 200 m in).

**Which side was placed without reading the other.** TS4 and TS7 stand a wall's gates at the bearings of its template's
gate blocks (Daggerfall's WALLAA08-11 in the template's ring, wherever Daggerfall put them), and the terrain paints each
road's arm in from its pixel's edge on its own compass bearing (Basic Roads' bands to the middle on the Bay; VOYAGER2's
curves past it) - neither reads the other. A capital's road ends at its gate pixel's arm (`tamrielCapitals.js`
capitalGates: the side's middle) and its plan's gates are where its streets need them.

**Which side moves, and why.** The gates move to the roads, never the roads to the gates. The roads are everyone's: the
planner and Travel Options walk them (Travel-View ROAD-FOLLOW), the maps draw them, the Bay's are Basic Roads' bytes and
painter to the byte (ROADS 23's oracle compares them), and past the Bay they are the land's law built region by region in
a worker under a key (VOYAGER) - a road bent to a town's gate would leave every one of them. A wall is its town's own: TS4
and TS7 lay it on its outline and only borrowed its gates' bearings from the template, so moving them moves only the wall
and what stands at its gates (TS7's dressing, its markers). A capital is its plan: its gates are on its lanes (Alinor's
north gate off its palace's height, Solitude's between the tavern's block and Castle Dour), so there the CITY lays the
road on from where it ends to its gate - its own ground, as Daggerfall's walled cities' gate blocks carry their roads
through their ring.

**What holds now.**

- **The walled towns' gates** (`world/townWalls.js`): its pixel's painted arms (`townWalls.js:"export function armLines(bits, bit, curved) {"`:
  the Bay's band, past it each curve VOYAGER2 draws from that edge), each walked in from its edge to where it first
  crosses the wall's line (`townWalls.js:"export function roadGatePoints(pts, origin, paths) {"`); arms crossing nearer
  than GATE_ARMS_MERGE (two lengths, 51.2 m) along the line one gate at their middle; each gate centred on its crossing
  (`wallPieces`' `onLine`), two a length of wall apart at the least. The template's bearings only where no arm reaches the
  wall (a town no road comes to), as before.
- **A wall waits for its roads.** Its gates need its pixel's painted roads, and they land after the town can first be
  read - the Bay's network after the boot, the roads past the Bay a region at a time. So the host hands the walls a reader
  (`townWalls.js:"export function townWallPathsReader({ bay, landedIn = null, byte = arenaRoadByte, join = arenaJoinByte }) {"`,
  wired in `scenes/tamrielPlacesHost.js`): null while the pixel's roads are not known. While they are not, the wall is
  not made - its carrier block provisional (open ground, no model, no marker - the world-data door builds it again at
  its next read: `worldDataReplacement.js:"if (!json?.Provisional)"`), the town's fabric plans no streets
  (`townFabricStand.js:"if (dfLocation.outline?.walled && townWallWaits(dfLocation))"`), and once they land
  its pixel is built again (`tamrielSweepsHost.js:"|| townWallReadyAt(p.px, p.py);"`, TESA4's stale law).
- **A capital's approaches** (`world/capitalApproaches.js`): each plan names its road gates (`gateAt`, the middle of each
  opening, off the measures its wall is cut at - `capitalPlans.js:"const landwardGates"`, Mournhold's,
  Helstrom's, Solitude's main gate, the Imperial City's Talos Bridge landing); the road's gate pixel stands off the slice
  the gate stands in (`capitalApproaches.js:"export function capitalGateSlice"`); and the capital lays
  two tiles of the road's own surface (the painter's record 46) from the arm's end - the middle of the gate pixel's side -
  straight in to a gate on its line, else in to APPROACH_SKIRT (19.2 m) outside the wall's line, along it, and in to the
  gate (`capitalApproaches.js:"export function capitalApproaches"`). Its gardens lay it over their rim too (the
  rim's no ground elsewhere), no tree on it (`tamrielCapitals.js:"tile: (x, z) => (way(x, z) ? APPROACH_TILE : rim(x, z) ? CAPITAL_NO_GROUND : tile(x, z)),"`);
  the Imperial City's crosses four cells of the open ground past its lake, each now a block of its own
  (`capitalApproachName`), the shared open cell everywhere else. Every approach lies on gardens and open ground, under no
  model. Falinesti has no wall: its four roads end at its span's edge, its forest.

**Measured after**, the same count:

| | walled | gates | gates with a road | lengths and towers a road runs into | towns at fault |
| --- | --- | --- | --- | --- | --- |
| the Bay's (TS7) | 410 | 1,513 | 1,512 | 0 | 1 |
| past the Bay (TS4) | 60 | 94 | 94 | 2 | 1 |

and every capital's 14 road gates met: the road's arm at its gate pixel (all 18 of the capitals' gate pixels carry their
arm into the span on the freeware), then the capital's approach every metre to the gate. The two left: Peno's one gate
whose road is a track crossing its wall at a corner, its painted tiles running along the wall rather than out of the
gate; and Woodhearth's one road, which comes in through its gate and runs on to its pixel's middle within a few metres of
the wall's own line where it bends back inside - one and two tiles of the road's edge under a length and a tower. Each
road comes in through a gate and each gate has its road.

- **The four hosts**: none grows - the places host hands the reader in one statement beside the roads host it already
  makes (`scenes/tamrielPlacesHost.js`), the sweeps host's stale law asks it (`scenes/tamrielSweepsHost.js`), the world
  host, `scenes/exterior.js`, `scenes/worldModes.js` and `scenes/dungeonContext.js` are untouched. Nothing crosses the
  wire: a wall and an approach are each client's own build of the same data.
- **The departure, named**: DFU stands Daggerfall's own walled cities, their gate blocks where the template has them, and
  Basic Roads paints to the location's rect; TS4 and TS7 (ours) stood their gates by those bearings, and now by the roads;
  the capitals are ours whole (TESA10 on).
- Pins `test/world/road_gates.test.js` (11: the arms, the crossings, the gates on the line, a city's wall on its roads, the
  wall that waits, the door, the reader, the wiring, the capitals' gates, their approaches, their blocks). Mutants
  `tools/mutants/road_follow.json` (the walls' and the capitals' records among its 52); re-aimed by content:
  AUDIT-TESA-II-C1-rim-laid-ground, AUDIT-TESA-II-C1-rim-wooded, IS-the-open-cell-unnamed, TESA14-the-gate-on-the-span,
  TESA5-the-bay-never-stale, AUDIT-TESA-A6-2-eager-door, WW7-4-made-unbound, WW7-4-made-each-read.

## 14. GATE-ROADS - every gate on its road, opening onto a street (BUILT, a port departure)

The owner, 2026-10-28: *"With cities, roads still do not like up properly with gates and pathways in the town. Gates can
lead to a bunch of buildings and it just doesnt make any sense"*; and *"No band aids or half assed work"*.

**Why ROAD-FOLLOW did not reach it.** It measured the Bay's cities walled on their outline (TS7) with the town packs off.
Online both packs are on for every room (`systems/online/onlineLane.js`, WD3), and Beautiful Cities rebuilds every Bay
city's ring (its wall-and-farm and wall-and-tavern composites): `wallBayCity` keeps a ring a mod rebuilt, so all 410 keep
the mod's ring and its gates. The road painter brings each arm to the middle of the pixel's side and rings the town's
ground (TS9); the mod's gates stand on its inner wall 60 to 100 m in, across its ring blocks' farms. Nothing joined them:
ROAD-FOLLOW counted a painted road within 48 m of a gate's front as its road, and the town's apron lay between.

**Where a wall stands on the outline** (past the Bay always, the Bay with the packs off) ROAD-FOLLOW stood each gate where a
road's arm crosses the wall's line - a bearing, which reads none of the town's streets: most faced a row of houses 16 m in
(the wall's line is WALL_ROUND.line from the nearest building).

**And a gate's opening is not its model's middle.** Daggerfall's gate (ARCH3D 446) is a length of wall whose way through,
its floor face, runs from x -8.05 to 1.68 m of its frame: 9.73 m wide, its middle 3.185 m off the model's origin -
Daggerfall's start marker stands that side of it (TOWN_WALL.marker's -3 m). Everything read the origin as the middle:
ROAD-FOLLOW's gate "centred on its crossing" stood its opening 3.2 m along, and on Beautiful Cities' north gates the
origin's tile column is the tower's, the mod's road one tile west of it.

**Measured first** (the freeware, Daggerfall's own data; a gate is on the road where a road's tile - paving, or a tile a
road holds - just outside its opening, across its width, joins by road tiles to the painter's own; a gate opens onto a
street where its opening's way in runs two tiles of the town's paving before any house, `opensOntoStreet`; past the Bay
main's walls):

| | cities | gates | on the road | onto a street |
| --- | --- | --- | --- | --- |
| the Bay online (Beautiful Cities' rings), every second | 205 | 820 | 270 | the mod's |
| the Bay walled on its outline (the packs off) | 410 | 1,513 | - | 269 |
| past the Bay, every third city template, a road every way | 136 | 1,084 | 1,081 | 217 |

**The law.**

- **The opening** (`townWalls.js:"export const GATE_OPENING = Object.freeze({ along: -3.185, half: 4.865 });"`): a gate
  piece's opening is its model's floor face (`gateOpening`: its middle `along` the model's +x, `(out[1], -out[0])`). A wall
  on its outline stands each gate's opening on its point, its length begun half a length and the opening's offset before
  it (`wallPieces`); the town's fabric past the Bay plans its main streets off the openings (`townWallGatesOf`, URBANIZER
  U3).
- **A gate on a street** (`townWalls.js:"export function gatesOnStreets(pts, crossings, town) {"`): each road's gate moves
  from its crossing along the wall, within GATE_WAY.reach (three lengths), to the nearest point where the gate as it will
  stand - its length's chord, its opening on it and facing in off it - opens onto a street (`opensOntoStreet`: a cart's way,
  GATE_WAY.half to either side, clear of every house - `townHouses`, the town map's bytes, its ground flats aside - until
  two tiles of the town's paving, ROAD_RECORDS, under its middle). A road with no street near keeps its crossing; two that
  come to one street are one gate.
- **Every gate on its road** (`gateRoads.js:"export function layGateRoads(tilemap, paths, tileData, town, ground = null) {"`):
  the terrain kernel lays each gate's road after the painter and its smoothing. Its passage runs across the opening's width (its
  middle's line and half its half width to either side - an opening on a tile's edge opens onto both tiles) from the
  middle out to the first open tile past the wall's half thickness, through the wall and its towers, never over water.
  From there it lays the cheapest way within GATE_ROAD.reach (40 tiles) out to the nearest road the painter laid and in to
  the town's nearest paving: along the town's paving where it leads, round a block's model or flat where the way round is
  short, never over a house, the wall or water, straight where it can, two tiles wide where there is room.
- **What it lays.** A tile already a road - the painter's, the town's paving - is kept as it lies; every tile laid is the
  road's record and the paths hold it (GRASS-PATH1: the grass, the woods and a town's yards keep off it; its walkers take it
  as a road, TS10).
- **The gates handed on** (`townGates.js:"export function townGateRoads(dfLocation, mapsFile, blocksFile) {"`): the
  pixel's build gives the kernel each gate's opening in the pixel's tiles with its outward normal and its half width, and
  the tiles a road may not cross - a wall on its outline its own gates and cells, a kept ring its blocks' gate models
  (WALL_MODELS.gate, turned by their subrecord and their own turn). A capital lays its own approaches (ROAD-FOLLOW); a wall
  still waiting for its roads hands none, its pixel built again when they land.

**What does not move.** Basic Roads' painter and its tiles to the byte (ROADS 23's oracle); the ground's heights (laid
after the smoothing - GROUND_LAW's print is unchanged); a kept ring's own gates and streets, which are the mod's; a gate's
start marker and TS7's dressing, which stand off the model as Daggerfall's do. Nothing crosses the wire: each client lays
the same roads off the same data.

**Measured after**, the same count:

| | cities | gates | on the road | onto a street |
| --- | --- | --- | --- | --- |
| the Bay online (Beautiful Cities' rings), every second | 205 | 820 | 820 | the mod's |
| the Bay walled on its outline (the packs off) | 410 | 1,513 | - | 1,363 |
| past the Bay, every third city template, a road every way | 136 | 1,080 | 1,080 | 1,039 |

Every gate is on its road. The 150 gates of the packs-off Bay and the 41 past it that open onto no street have none within
three lengths of their road's crossing, or were slid apart (two gates a length of wall apart at the least); the kernel
still lays each one's road in from its opening to the town's nearest paving, where one lies within the reach.

- **The hosts**: none grows - `scenes/pixelBuild.js` hands the gates in one statement beside the rect it makes; the kernel
  calls the road once.
- FB1028 (section 16): the slide left each road's arm running on into the wall; on a Bay wall's ground the arms are taken
  up and joined to the gates, and a street of the town's that runs into the wall takes a gate of its own.
- **The departure** (Port-Ledger A, GATE-ROADS): DFU paints Basic Roads to a location's rect and stands Daggerfall's gate
  blocks where the template has them; ours joins each gate to the road, and moves a wall of our own onto a street.
- Pins `test/world/gateroads.test.js` (10, one on the freeware: the gate model's floor, the Bay as online stands it, past
  the Bay, the packs off). Mutants `tools/mutants/gateroads.json` (39, all dead); re-aimed by content:
  RF-the-gate-begun-at-the-crossing, U3S-the-gates-a-walls.

## 15. WALL-FLICKER - a length clear of its tower, no fabric where the wall stands (BUILT)

FIELD BUGS 2026-10-28, #bug-reports, after #1184 shipped: *"The city wall at the entrance of Riften has texture flicker"*.

**Why.** A bend's tower is the corner tower's body, a square of the wall's own thickness (TS8), and every length and gate
ends in its middle. Where the line runs straight through a tower, the length's two faces lie in the planes of the
tower's two sides, over half of each. At a turn of a degree they cross them in a long, thin band, and at a sharp bend two
lengths' walks lie on each other just past the body. The depth buffer cannot order two faces in one plane, so the frame
shows some of each, and the mix moves as the eye moves.

**Riften**, as the places host stands it: Skyrim's fourth city at Bay pixel (2356, 77), Gothbrone Hall's grid off
MAPS.BSA's own rows, one road from the east (the roads' worker's regions over its pixel). It has one gate, at (624.0,
355.2) of its carrier, facing east, on a straight run. The tower north of the gate turns 0.0004 degrees. The gate's and the
next length's faces lie in that tower's side planes: 154 m2, and 77 m2 of it on the side a player meets at the gate.

**Measured first** (the freeware; faces of two pieces that face one way, over each other within 1 mm, outside the towers'
bodies): the Bay's 410 walled cities (TS7, the packs off, Basic Roads' roads), 603,355 m2, every city; the 407 city
templates past the Bay (a road every way), 302,885 m2, every city. 5,647 of their 44,880 towers stand where the line runs
straight (under 0.01 degrees), 2,067 of them beside a gate.

**The law** (`townWalls.js:"export function clearOfTowers(part, towers) {"`, which townWallModel applies to every length and
gate): each part of the piece inside a bend tower's body is left out. A face that runs along a side of the body is cut
TOWER_CLEAR (5 cm, the depth buffer's step at 400 m) past it too. A level face is mitred at the tower's middle, so one
walk stops where the next begins; no turn passes 89 degrees, so the next walk covers what is cut. Everything cut was in
the tower, on its face or under the next walk, so nothing opens. A tower not of 444's measure (a mod's) cuts nothing.

**The town's fabric.** A gate's way has Daggerfall's floor (446) at the town's ground, and URBANIZER lays its setts and
cobbles at the same height (FABRIC_ROAD_Y). GATE-ROADS stands gates on the towns' streets, so a block's paving often runs
under a gate; and where a length lies on the fabric's grid, a yard's fence can run in its face. Measured over the 407
city templates past the Bay and Riften (each fabric planned on its whole grid, a road every way; its faces against its
wall's, within 4 cm): 88 towns, 1,853 m2. The fabric now lays nothing on a cell that a piece of the wall touches
(`townFabricStand.js:"const under = wall"`, townWallCells grown a cell's half diagonal): none now.

**Measured after**: no two faces within 1 mm on any wall of either set, nor within 4 cm (822,943 and 495,846 m2 before),
two that only meet along an edge aside; the same open ends seen at the towers as before, by level rays from both sides
at 22 walls. With section 16's mitres and grown towers, the model of every fifth Bay city holds 10.6 per cent more
triangles than its pieces made alone (886,446 to 980,640), 12.0 per cent on the test's sample of both sets, and takes
about seven times as long to make (37 against 5 ms a city, on a loaded machine). So the model door makes it a breath at a time,
WALL_PIECES_A_BREATH (16) pieces between two (townWallModelSliced), as it makes the town's fabric.

**The probe.** Riften's gate drawn at the game's depth (24 bits, 0.2 to 6,000 m), each piece in its own colour, from its
start marker toward that tower: 13,556 of the towers' pixels changed when the eye moved 1 cm, now 112 (their edges);
from 108 m, 598, now 12.

**The Bay.** The same builder walls the Bay's 410 cities (TS7), so the cut holds there as past the Bay. A ring of
Daggerfall's own (its WALLAA blocks, or a town mod's) stands a corner tower only at a corner and its lengths end to end,
with no piece in another, and needs no cut: every 20th of the 410 rings, laid as MAPS.BSA lays them, has no two faces
within 4 cm of each other. The Bay's towns have no fabric.

- No new departure: the walls on an outline are TS4's and TS7's (Port-Ledger A, TOWN-SHAPES); DFU stands Daggerfall's
  ring.
- The hosts: none grows - the wall is `world/townWalls.js`'s, the paving `world/urban/townFabricStand.js`'s.
- Tests `test/world/fb1028_wallflicker.test.js` (7, three on ARENA2: every twentieth walled city on the Bay and past it,
  Riften, five towns whose fabric lay in their wall's faces). PINS MOVED (AUDIT FB1028): its bends' towers grown as
  wallPieces mints them, so the open ends are read against the pieces made alone as grown and the body as grown; a
  three-degree bend added. Mutants `tools/mutants/fb1028_wallflicker.json` (23: 19 dead, 4 recorded equivalent with why
  - two of them the mitre's branch, which cuts on mitreEnds' own plane; three die only on ARENA2). Re-aimed by content: `townboards.json`
  TB-the-stands-ground-dropped (dead).

## 16. FB1028 - the Bay's walls: no door, no bend run through, no road into the wall (BUILT)

The report (Discord #bug-reports, 2026-10-28, a staff member, after #1184): *"Daggerfall City Walls are Janky ... roads
lead to nowhere"*; *"West side has parts clipping into itself, stuttering, and there's doors in walls that are
clipping"*; *"roads leading to gates that were there, and are no longer in every part of the city"*. The owner kept the
shaped walls: the defects are fixed, and every yard keeps its place.

**Why Daggerfall stands walled on its outline online.** The room loads Beautiful Cities, whose rings TS7 keeps. But a
town where a home was bought before WD3 is held in Daggerfall's own layout for the whole room (`net/homeLaw.js` WD3), and
Daggerfall is one: it stands as every Bay city does with the packs off. Every count below is the packs off, over all 410.

**What was wrong, measured first.**

- **The doors are the wall's own.** Daggerfall's length (ARCH3D 445) carries a door on its inner face a metre from its
  end, its gate (446) two: a Town23 building's doors into the ring block's "City Walls". A wall on its outline is one
  model of the town's own and opens into nothing; at a chord's end a length's door stood in its tower - of the 32,779
  doors on #1184's 410 walls, 7,169 inside a tower's body and 11,191 inside it or on its side's plane, within 1 cm (21 and
  34 of Daggerfall's 106). No building stands within 2 m of any wall (159,004
  building models; Daggerfall's nearest 6.45 m): TS7's pin read the wall's own cells, so it could not have seen one.
- **Parts clipping into itself are the bends.** A bend's tower is the wall's own thickness (TS8), so at a bend its two
  lengths ran on through each other and out of its faces: on the bend's inner side their faces and parapets crossed in
  front of the tower. 24,619 of the 31,266 lengths and gates ran into another (80 of Daggerfall's 101; its west side's V
  and notch turn 29 degrees). The sharpest bend on the Bay turns 76 degrees.
- **Roads to nowhere are two.** GATE-ROADS slid each road's gate along the wall onto a street (18 to 47 m at Daggerfall),
  and the painter's arm ran on into the wall where its gate had stood, its stub inside leading back to it: 1,645 pieces
  of 369 walls stood on a road away from every gate (9 of Daggerfall's), and 2,287 road tiles inside ran up to a wall
  away from a gate (380 walls, 11 at Daggerfall). And a street of the town's own ran into the wall where Daggerfall's
  ring had its gate: 34 cities, 66 tiles.
- **The stutter is not the wall's code.** Its model, cells, gates and keep are made once a wall and kept (`townWallOf`,
  `townWallCellsOf`, `harbourKeep.js` townKeepField). A body walked the whole of Daggerfall's wall, inside and out, on the
  game's collider over the wall's model: 0.04 to 0.5 ms a move, no jolt; it stops only in the pockets of the bends. The
  towers stood in the plane of the lengths' faces, the two pictures fighting there as the eye moves (the coplanar faces are
  lane B's record); the crossing faces of the bends showed the same way.

**What holds now.**

- **No door** (`townWalls.js:"export function wallDoorless(m) {"`): each door triangle of a piece is laid in the face it is
  cut from - the picture and the UV law of a coplanar triangle of the model's that shares a corner with it. Every triangle
  is kept; the model has no door left to open.
- **A bend's lengths cut on it** (`townWalls.js:"export function mitrePlanes(p, towers) {"`, mitreEnds): a length or a gate
  is cut at each tower it ends in, on the tower's middle line across the wall, its own side kept - the two meet on one
  plane inside the tower. The tower is grown across to 4.8 m / cos(half the turn) and TOWER_PROUD (0.1 m) more (wallPieces'
  `thick`; its cells with it): it holds the cut and stands out of the faces, low enough that a sliding body rides past.
- **The arms taken up** (`gateRoads.js:"export function takeUpArms(tilemap, paths, inside, ground) {"`, joinArms): on a Bay
  wall's ground the painter's road and track tiles outside the wall's inner face are taken up, and the stub inside joined
  to them (`townGates.js` insideWall hands the inside). Each gate's road is laid on to the ring round the ground; an arm
  cut where no ring runs (a pixel of tracks alone) is joined to the nearest gate's road. A river's tiles, the town's paving
  and the painter's tiles off the ground stay as they were laid.
- **A gate on each street** (`townWalls.js:"export function streetGates(pts, town, ways) {"`): where the line runs over the
  town's paving two lengths or more from every gate, a gate stands on the run's middle; GATE-ROADS lays its road out.

**Measured after**, the same counts: no door on any wall; no length or gate in another (31,261, 5 cm past a cut); 8
pieces of 5 walls on a road away from a gate, none of Daggerfall's. Those are streets (5 cities, 12 tiles), each within
two lengths of a gate onto the same street - two gates stand two lengths apart at least. The 112 road tiles inside against
a wall (55 walls) each run on to a gate: 95 a gate's road along the inner face, 17 the painter's. Gates 1,513 to 1,568 (55
walls one more; Daggerfall 5, as it was; the nearest two 57.7 m apart).

**Every yard where #1184 stood it** (the owner's decision; `gateRoads.js:"export function yardRoads(tilemap, paths, tileData, town) {"`,
`townWalls.js:"export function townWallYardCellsOf(dfLocation) {"`). A yard's place reads the roads and the wall, and
the new ones moved 310 of the 1,258 (220 cities; over 44 of them, 42 of 49 moves with the take-up). So the yards read
what they read at #1184: the paths with no arm taken up and the roads of the gates that wall stood (`townGates.js` hands
them as `yard`), and that wall's cells - no street's gate, no tower grown (townWall's `yardPieces`). The host shuts the
yards' ground so (`scenes/pixelBuild.js` yardShut); its walkers keep the new.

**And the gates' things and the ground as #1184 laid them** (FB1028 YARDS Y1, Y2). The yards measure the wall's carrier
as #1184 laid it: its boards, carriages and markers by that wall's gates, stood clear of its cells
(`townWalls.js:"export function townWallYardLayout(yl, dfLocation) {"`). The game stands today's. The yards' ground is
TS2's mask over the outline before its crops, with no edge band
(`townBlendBefore.js:"export function townGroundMaskBefore(shape, ground, hDim) {"`, the kernel's `yardGround`), and
today's ring is no road on it (`terrainGen.js:"export function ringAsWas(paths, ring, yardGround) {"`). The host hands
both (`scenes/pixelBuild.js` shapeWas, yardShut), so the Bay's yards keep #1184's mask whatever today's becomes.

**A broken yard placed again** (`merchantYardSites.js:"export function* keptSitesSteps"`). A
yard keeps its #1184 place unless the place no longer fits the town as it stands (siteFits: its cells on no road and
nothing shut, its pad clear of the wall and every closed cell). One that does not is placed again by its kind's law on
the new ground, every kept yard's and port's ground closed first (`scenes/world.js` townPlacesFor, `world/townWalls.js`
yardWalkShut). AUDIT FB1028 B5: a kept yard's pad may touch a cell only the wall's growth since #1184 closed (a tower
grown, a street's gate), never its own ground. Y1: the keep reads the gates' things as they stand, and a pad may touch a
cell only their move since #1184 closed.

Measured over all 410 at the merge: 1,183 of the 1,258 yards stood on #1184's cells; 50 moved on a gate's new road, 2 in
the new wall, 19 against a grown tower, and 4 stables by the gate dressing. B5 and B2 (a road's gate keeps its things)
put back the 19 and Puweyn's stable. At `dba794637` 1,199 stood: Knightsgate's stable moved by the gate dressing, the new
mask moved Wayrest's shipyard and Penwall Derry's shipyard and lighthouse, and Naresa's Wagon Yard had moved since,
closed on the walkers' ground (by none of the wall, the ground or the gates' things). Y1 puts the stable back and Y2 the
three port places: now 1,203 stand; no yard broken (none in, against or on the wall, on a road, off its ground or out of
reach), none over another. The 55 moved:

| city | yard | why |
| --- | --- | --- |
| Akhahanu | Stable | on a gate's new road |
| Akhahanu | Wagon Yard | on a gate's new road |
| Akhera-Korom | joinery | on a gate's new road |
| Aldleigh | Wagon Yard | on a gate's new road |
| Atrohala | joinery | on a gate's new road |
| Baelwall | Wagon Yard | on a gate's new road |
| Baelwood | Stable | on a gate's new road |
| Bhoriane | joinery | on a gate's new road |
| Blackley | joinery | on a gate's new road |
| Broadwell | Wagon Yard | on a gate's new road |
| Burgham | joinery | on a gate's new road |
| Burgwold | joinery | on a gate's new road |
| Ceranda-Kom | Wagon Yard | on a gate's new road |
| Charbeth | Wagon Yard | on a gate's new road |
| Charenworth | Stable | on a gate's new road |
| Chesterbeth | joinery | on a gate's new road |
| Chesterbeth | Wagon Yard | on a gate's new road |
| Cromwark Hamlet | Stable | on a gate's new road |
| Eastcastle | Stable | on a gate's new road |
| Elotunia | joinery | on a gate's new road |
| Fontbeth | Wagon Yard | on a gate's new road |
| Fontfort | Stable | on a gate's new road |
| Gothwark | Stable | on a gate's new road |
| Gyselah | Wagon Yard | on a gate's new road |
| Holway | Stable | on a gate's new road |
| Issaqumbaa | Stable | on a gate's new road |
| Jaladnia | Stable | on a gate's new road |
| Khajastareg | Wagon Yard | on a gate's new road |
| Knightsgate | joinery | on a gate's new road |
| Knightsmore | Stable | in the new wall |
| Longhope End | Stable | on a gate's new road |
| Merborne | joinery | on a gate's new road |
| Mesajer | Wagon Yard | on a gate's new road |
| Midbury | joinery | on a gate's new road |
| Naresa | Wagon Yard | closed on the walkers' ground |
| Newcester | Stable | on a gate's new road |
| Newmarket | joinery | on a gate's new road |
| Newvale | Wagon Yard | on a gate's new road |
| Osenabu | Wagon Yard | on a gate's new road |
| Oxway | joinery | on a gate's new road |
| Penwood | Wagon Yard | on a gate's new road |
| Pothago | Stable | on a gate's new road |
| Pythinis | Stable | on a gate's new road |
| Singcroft | Wagon Yard | on a gate's new road |
| Singham | Wagon Yard | on a gate's new road |
| Syra-Kom | Stable | on a gate's new road |
| Syrunnuweyn | Wagon Yard | on a gate's new road |
| Tasoparet | Wagon Yard | on a gate's new road |
| Tigonus | joinery | in the new wall |
| Tsetissiara | Stable | on a gate's new road |
| Tunborne | joinery | on a gate's new road |
| Tuntale | Wagon Yard | on a gate's new road |
| Umberadax | Wagon Yard | on a gate's new road |
| Whitewark | Stable | on a gate's new road |
| Zenirijet | Stable | on a gate's new road |

Westhead Moor's shipyard and lighthouse moved again since, on purpose: WESTHEAD-NORTH
(`01-Overview/bugs/Field-Bugs-2026-10-28.md`).

The three by the gate dressing (Y1): TS7 steps a gate's boards and carriage clear of the grown towers, up to 0.8 m
over #1184's (Knightsgate's two). On the things as #1184 laid them, all three stables are placed on #1184's cells.
Knightsgate's keeps them. Issaqumbaa's and Syra-Kom's lie on a gate's new road on today's ground, so they are broken and
placed again by the law: Issaqumbaa's 4 cells away, Syra-Kom's across the town.

Past the Bay (Y2), sampled over every eighth walled template (102, 306 yards): 11 moved before, 1 now. That one, template
297's stable, also moves with the mask and the paths left out, so neither is its cause (OPEN). The keep moves 1 more
(template 33's stable), which the new ground breaks.

The street gates (Y3): each has a road out. Naresa's, Akhahanu's and Menakat's open onto the town's paving, and
GATE-ROADS lays one or two tiles on to the ring. The audit's probe read the painter's tiles alone, 6 to 15 m out, where
the paving is. No gate or road code changed: 1,568 gates.

**Not changed, and why.** The wall is one model, so its pixel's build stands its 14,600 triangles in one step: 30 to 94 ms
on the collider, and as much again with the player in town (the late solids' gate, `player/lateSolid.js`, builds a probe of
it: its box is the city's) - where the ring's blocks stood a piece at a time with a breath between. A model a chord needs
model ids the walls' run has no room for. Past the Bay (TS4) the same slide leaves its arms into the walls; there the arm
inside crosses the town's open cells as its fabric's road, and is left for its own slice.

DEPARTURE (named; Port-Ledger section A, TOWN-SHAPES): from Daggerfall's wall pieces - no door where the wall is a model of
the town's own, a length cut at a bend and its tower grown across; from Basic Roads' tiles on a Bay wall's ground. Tests
`test/world/fb1028_walls.test.js` (21, six on ARENA2) and `test/world/fb1028_yards_past.test.js` (1, on ARENA2). Mutants
`tools/mutants/fb1028_walls.json` (51; the 37 dead without ARENA2: AUDIT FB1028 runs the yard law, yardRoads, yardPieces
and the host's own lines on synthetic towns; of Y1-Y2's 14, 12 die without ARENA2 and 2 with it). PINS
MOVED: `test/world/gateroads.test.js` (the kernel handed the town's ground), `test/world/townbends.test.js` (a tower's
footprint as wide as it stands); `baywalls`, `ic_stutter`, `merchantyards1`, `shipyards1_found` (the host hands the
places the yards' shut), `carpyard1` (the kept yards), `road/roads` (the yards' paths); re-aimed by content: GATE-ROADS-the-roads-never-laid, TS8-towers-whole,
TF-the-length-and-thickness-swapped, TW-the-turn-mirrored, TB-the-walk-unshared, TF-the-wall-unwired, TS10-key-blind.
