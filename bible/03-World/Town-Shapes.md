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
| TS4 | a walled city's walls follow its outline (the twelve WALLAA blocks make only rectangles) | planned |
| TS5 | the Imperial City 7 x 7, round, its lake round inside its outline | planned |
| TS6 | trees, walkers and the town map follow the outline (they read the rect today) | planned |

**DEPLOY RULE**: TS3 ships in the same release as WW7-5 (homes past the Bay, `bible/03-World/World-Wide.md` WW7-5): a home
past the Bay is bought only in a town's final outline, so no block a home stands in is ever left out.

## 3. TS1 - the outline (`world/townShape.js`)

- **The buildings' tiles** (`townOccupancy`): a block's town-map bytes (`AutoMapData`, 64 x 64) - a byte not 0 a
  building's or a wall's - each ground tile (16 a block side) taken where any of its 4 x 4 bytes is; the town map's row
  `r` is the tile row `15 - r/4` and its column `c` the tile column `c/4` (measured on the wall blocks WALLAA04-07, whose
  walls sit beside the two rows they stamp). A block's misc models and flats each take their tile and the eight round it
  (`terrainTiles.js` locationShapeField: x * 0.025, (z + 4096) * 0.025 - `tamrielCapitals.js` miscModelAt's law), so a
  fence, a well, a tree of the block's own stands on the town's ground and never on the land's slope.
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
  shore town meets the sea where the shore is. Its stamped tile there is given back (`unstampOffShape`), and the land's own
  tiles are laid.
- **The flatten** (`blendShapedTerrain`, through `blendLocationTerrain`): every sample a tile of the town's ground touches
  set to the mean of the land under it (`ground` read there, never the sea's; a step over the beach at the least,
  `SHAPE_FLOOR`) - the job answers that height, the location stands at it; the rest eased back over `SHAPE_BLEND_TILES`
  (12, 77 m) on a smoothstep; the sea past the margin never lifted; the pixel's edge the land's own (`SHAPE_EDGE_TILES`, 4,
  as DFU's ramp keeps it, so a neighbour's ground meets it). A rect without an outline (a capital) takes DFU's blend as
  before and answers its average.
- **Its copies** follow by the same rect: the Deep Waters bake's water test, the landforms' lift (`landformLiftField`,
  its difference field flattened on the outline with DFU's own samples as its land), the classic pass.
- **The road's ring** (`townRoadRing`, `roadPainter.js`): the mod's "Paint roads around locations" paves the tiles off the
  town's ground within two and a half of it - its outline's ring, where it paved the rect's padding.
- Measured on the freeware: Daggerfall stands within its walls as before (its rect 11..116, its tiles' histogram
  unchanged, its ground 0.166139 for DFU's 0.166147 - its own land's mean); Antelibuton keeps its sea (thousands of water
  samples where DFU's blend left about 240); Gothway Garden's outline wanders on every side. The corpus' stamped tiles
  9,252,505 (DFU's 9,565,908); every rect still interior (11..116).
- Interim: a walled city's wall blocks are inside its outline (their bytes are walls - occupied) until TS4 lays its walls
  on the outline; trees, walkers and the town map read the rect until TS6.

PINS MOVED: `test/world/terrain/terrain.test.js` (Daggerfall's rect bounds and outline, its ground, the corpus' stamped
total, the environs' first tree), `test/render/boot2.test.js` (the entry's reach 85: `world/townShape.js`, a leaf).
Tests `test/world/terrain/townshapes.test.js`; mutants `tools/mutants/townshapes.json` (15, all dead).

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
- Interim until TS4: a city-state's wall ring is open (its cells left out), and with it the city's start markers - Daggerfall
  keeps a city's only start markers in its four gate blocks (WALLAA08-11, measured: every TownCity), so an arrival lands at
  the grid's edge as a town's does until TS4 stands its gates.

Tests `test/world/townoutline.test.js`. PINS MOVED: `test/tesa2_arena.test.js` (the arena clone laid as its outline),
`test/tesa7_country.test.js` (the host's stub carries the outline).

