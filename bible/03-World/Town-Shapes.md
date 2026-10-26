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
  its difference field flattened on the outline with DFU's own samples as its land), the classic pass. AUDIT TESA III
  E1-4 (2026-10-26, `01-Overview/audits/Audit-Tesa-III-E1.md`): the bake's did not - its rows were the rect's four numbers
  (`deepWatersClient.js` deepWatersLocationRects, `deepWatersBakeCache.js` rectsLookup), so it blended DFU's way and called
  the sea TS2 keeps land: 453,230 samples at 262 of the Bay's 339 coastal location pixels, the seafloor before them shaped
  against the old rect's coastline (up to 27 m off at the default depth). A row now carries the outline, the key its
  bytes, BAKE_GENERATOR_VERSION 2. OPEN: the Eltheric isles' bake still reads its templates' rects, while each clone
  stands its own outline (seeded by its own map id) - 3 of 60 sampled port isles, 564 samples.
- **The road's ring** (`townRoadRing`, `roadPainter.js`): the mod's "Paint roads around locations" paves the tiles off the
  town's ground within two and a half of it - its outline's ring, where it paved the rect's padding. AUDIT TESA III E1-1
  (OPEN, routed to the roads' stream): the painter's FAST-SUITE guard passes by every tile off the centre cross, the
  diagonals and the rect - proven against the rect's law alone - and the ring lies past the rect, so 82% of it is never
  paved (259,606 of 1,451,249 ring tiles over the Bay's 3,444 towns; a road's stubs where its arms cross it); and the ring
  paves the sea where TS2 keeps it (2,670 ring tiles over water).
- Measured on the freeware: Daggerfall stands within its walls as before (its rect 11..116, its tiles' histogram
  unchanged, its ground 0.166139 for DFU's 0.166147 - its own land's mean); Antelibuton keeps its sea (thousands of water
  samples where DFU's blend left about 240); Gothway Garden's outline wanders on every side. The corpus' stamped tiles
  9,252,505 (DFU's 9,565,908); every rect still interior (11..116).
- A walled city of the Bay kept Daggerfall's wall ring here (its wall blocks' bytes are walls - occupied - so its ground
  wrapped the ring); TS7 walls it on its outline as a city past the Bay is (its round and apron its ground).

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
- **The model** (townWallModel): every piece one model of the city's own (`world/customModels.js`, id 3,000,000 and its
  map id's low 20 bits), composed of the player's own ARCH3D pieces (needs 444, 445, 446) - turned so its local +z is its
  outward normal and its +x along the line (no mirror), stretched along its length - so it collides and draws as any model.
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
(*"7x7 km?"*): seven pixels, the plan 5.7 km a side, its city wall 3.9 km across.

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
  the jungle.
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
  grid's rows the stamp's (`setLocationTiles`: a block's tile (tx, 15 - ty)), pinned against both.
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
- Measured over all 410 Bay walled cities: four gates each, every wall closed on its walk grid, no house under one; 3,280
  boards, every one inside its wall; 1,640 carriages and 1,640 drivers, every carriage outside; every piece clear of the
  wall and the houses and on the town's ground.
- **The yards** (`world/merchantYards/merchantYardSites.js` townGroundOf's `shut`, `scenes/world.js` townPlacesFor,
  `scenes/pixelBuild.js`): a town's Stable, Wagon Yard, joinery and port places are placed on its walk grid shut as its
  walkers' is (`world/townWalls.js` townWalkShut: off its ground, on its wall). Measured over a quarter of the cities and
  towns past the Bay: 6 yards stood partly off their town's ground (a left-out cell's slope); none now.

Tests `test/world/baywalls.test.js`. Mutants `tools/mutants/baywalls.json`. PINS MOVED: `test/world/townwalls.test.js` (the
host hands its blocks both ways), `test/world/townfollow.test.js` (one walk shut), `test/world/merchantyards1.test.js` and
`test/systems/shipyards1_found.test.js` (the places handed the walk shut).
