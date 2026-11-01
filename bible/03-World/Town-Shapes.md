# Town Shapes

Towns away from perfect squares. Every town's ground follows an organic outline round its buildings, flattened to its
own land and eased back into the country, with the sea kept and a paved ring road round it. Towns past the Bay take
unique block outlines; the Bay's towns keep every building. Walled cities are walled on their outline, their gates
where the roads come in. The Imperial City is round. The player sees it in the shape of every town, its walls and its
approach roads.

## How it works

- **The outline** (`src/world/townShape.js`). A block's town-map bytes mark its buildings' tiles (`townOccupancy`),
  plus each misc model's and flat's tile and the eight round it, and the fields a block's crops sow
  (`townFieldTiles`). The outline (`townShapeField`) is every tile within `TOWN_SHAPE.margin` (4.5 tiles, 29 m) of a
  building's, the margin wandering on value noise seeded with the town's map id, with every enclosed hole filled. A
  capital has its own plan and no outline.
- **The ground follows it.** Only the outline's tiles are stamped (`src/world/terrain/terrainTiles.js`
  `setLocationTiles`); the rect carries the outline (`shape`), so every reader has it. The town's ground is flattened to
  the mean of the land under it, then eased back to the land over up to 12 tiles or a grade limit, never past its share
  of the way to the pixel's edge, so a neighbour meets it. The sea is kept past the ease. The Deep Waters bake, the
  landforms' lift and the classic pass read the same outline.
- **The ring road** (`townRoadRing`, `src/world/road/roadPainter.js`). Basic Roads' road round a location paves the dry
  tiles just off the outline, never water.
- **Past the Bay** (TS3). Every clone town past the Bay (Arena's places, the countryside's towns; never a capital or a
  lair) lays only the blocks of a unique outline; edge blocks are left out.
- **Walls** (`src/world/townWalls.js`, `src/world/townOutline.js`). A walled city past the Bay is walled on its outline
  instead of Daggerfall's rectangular WALLAA ring, and every Bay city is too (`wallBayCity`), online as off, on
  Daggerfall's own blocks. A bend's tower is the corner tower's body alone. What stood at Daggerfall's gates (yards,
  carriages, boards) stands at the new gates.
- **Gates on roads** (`src/world/townGates.js`). Every walled town's gates are placed where its roads come in, every
  gate on its road and opening onto a street, never into a building; a capital's road runs on to its gate. Wall lengths
  keep clear of their towers, and no town fabric stands where the wall stands.
- **The Imperial City** is round, its lake round inside its outline, and its outskirts' towns round
  (`Arena-Provinces.md` for its plan and scale).
- **Followers.** Nature keeps off the outline by true distance (`src/world/terrain/terrainNature.js` `natureCleared`);
  the walkers' navgrid and the town map follow the outline; no yard stands on a painted road.

## Rules

- The Imperial City round; other towns unique shapes; move away from perfect squares; nobody's home removed (the
  owner). The mixed way: towns past the Bay take unique block outlines, the Bay's towns keep every building and take
  organic ground, walls and shores (the owner).
- City gates line up with roads and with the town's streets (the owner). No band aids.
- No block is dropped and no building moves on the Bay: a home is its town's map id and building key
  (`src/net/homeLaw.js`).
- Edge blocks are left out past the Bay only in the same release that lets homes be bought there, so no home's block is
  ever left out.
- Tamriel: every town on the Bay and past it takes an outline; capitals keep their own plans.

## Daggerfall Unity

DFU's `TerrainHelper.SetLocationTiles` stamps the whole grid and `BlendLocationTerrainJob` flattens a rectangle;
`DefaultTerrainNature.LayoutNature` and `CityNavigation.SetRMBData` read the whole grid; every TownCity is walled by
the twelve WALLAA blocks in a rectangle. Departures (TOWN-SHAPES): the outline, its ground and ease, outlines of blocks
past the Bay, walls on the outline and gates on the roads.

## Code and tests

- `src/world/townShape.js` - outline and field
- `src/world/terrain/terrainTiles.js` - stamp and ease
- `src/world/townWalls.js`, `src/world/townOutline.js`, `src/world/townGates.js` - walls and gates
- `test/world/townoutline.test.js`, `test/world/townwalls.test.js`, `test/world/townbends.test.js`,
  `test/world/townfollow.test.js`, `test/world/townpaths.test.js` - outline, walls, bends, followers, paths
- `test/world/baywalls.test.js`, `test/world/gateroads.test.js` - the Bay's walls and gates on roads
- `test/world/fb1028_yards_past.test.js` - the yards of the walled templates past the Bay

## Open

- Past the Bay, 20 of the 1,221 yards the 407 walled city templates stand (a road every way) lie off the cells an
  earlier sweep of the yards' law gave them, on Daggerfall's own blocks. The three read keep that sweep's wall, roads
  and paths, with a town fabric that lays 158 to 524 cells fewer; why it moves them is not known, as for template
  297's stable. The pin holds nine templates' every yard on its cells.
