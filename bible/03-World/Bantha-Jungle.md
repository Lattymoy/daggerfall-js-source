# The Jungle of Bantha

A dense jungle in four storeys of the owner's five trees, under a humid haze that cuts visibility, on the area the owner
painted on Hammerfell's shore of the Bay (from Lainlyn and Satakalaam east to Mournoth and the map's edge). The same
jungle grows in Cyrodiil's jungle zones and under Valenwood's graht-oaks. The player meets it walking or travelling
through those lands.

## How it works

- **The owner's trees** (`src/assets/jungle/source/`). Five OBJs as supplied (banyan, kapok, fig, flame, mahogany),
  each with its own alpha-cut picture, fetched the first time a pixel stands a jungle tree and read as Low Poly Trees'
  meshes, mirrored in x into the port's handedness (`src/world/jungle/jungleModels.js`,
  `src/systems/jungleTreesAssets.js`). They take tree records 12-16 of archive 500.
- **Where** (`src/world/jungle/banthaArea.js`, built by `tools/banthaArea.mjs`). The owner's red drawing on the Bay's
  map, smoothed at its own resolution and held to Hammerfell's land: map pixels of seven regions, no region whole. The
  edge comes in as stands over about a kilometre. Past the Bay the jungle field (`src/world/jungle/jungleRegion.js`
  `jungleField`) reads the biome zones' `jungle` flag.
- **Four storeys** (`src/world/terrain/jungleNature.js` `withJungle`, run by the terrain kernel). A tile is the
  jungle's where its share beats a stand noise, and the pixel's own flats give way. Canopy: one tree on every other
  2 x 2-tile site, trunks about 16 m apart, crowns meeting. Emergents: the kapok and the mahogany above the rest.
  Understorey: young trees, thicker in light gaps. Mid storey: the rainforest's palms. Floor: the rainforest's cover.
  Every draw is a hash of a world tile, so trees stand in the same place on every client and on the worker, and
  Logging's trees stand where the room sees them.
- **Trunks hold foes out** (`src/world/propBodies.js` `jungleBody`, `src/characters/foeSpacing.js`
  `keepFoesOffBodies`). A trunk's body, its measured girth up to where its crown begins, keeps a foe out as it keeps the
  player: a foe in one is put at its edge in that frame, and steps round it where its way lies past. A line of sight or
  a missile to a body standing in a trunk or a crown stops only where it crosses that cover's middle inside it
  (`src/ai/cover.js`): a body in front of the middle is seen and struck, one behind it is hidden, both ways. A young
  banyan's or flame tree's crown begins at 1.1-1.9 m. The bodies are the species', so every jungle stands them.
- **The floor carpet** (`src/scenes/jungleFloorHost.js`). A second field of the grass system wearing grass, ferns and
  broad leaves on crossed cards (`src/render/jungleFloorArt.js`), so no earth shows. The meadow's grass keeps out of it.
- **Roadside pairs and trails** (`src/world/jungle/jungleRoadside.js`, `src/world/jungle/jungleTrails.js`). Pairs of
  the owner's trees astride roads and tracks with lianas strung across, each sunk to the lowest ground under its feet;
  the jungle's own trails worn into its tiles, never the road network's.
- **The haze** (`src/render/hazeGlsl.js`, `src/world/jungle/jungleHaze.js`, `src/scenes/jungleHost.js`). A layer of
  humid air: 0.0055 extinction a metre (half the light at 126 m) up to a floor at the canopy's height (28 m), falling
  off by e every 90 m above. A valley is thickest; a summit clears. It is thickest at dawn and in rain, fog and storms,
  and drifts. The haze multiplies the world's fog and culls whole what it hides.

## Rules

- Populate Bantha in a dense jungle with a haze that reduces visibility, insanely detailed, without hurting
  performance, no band aids (the owner). The jungle is the area the owner painted, with a floor of grass, ferns and broad
  leaves and no earth showing (the owner).
- Cyrodiil receives the jungle (the owner; `Tamriel-Biomes.md`). Valenwood's forest stands it under the graht-oaks.
- Offline, the Features row `bantha-jungle` on the enhanced skin, on by default; the classic skin keeps DFU's woods.
  `?jungle=off` and `?junglehaze=off` are the kill doors. Online it is forced on, since Logging's trees stand in it. The
  floor carpet follows each player's grass row.
- Only the world host is wired: the bench, interiors and dungeons stand no wilderness, and each clears the haze.
- The jungle's trees, pairs and trails are never Logging's to fell, except the trees Logging already stands.

## Daggerfall Unity

`DefaultTerrainNature.LayoutNature` scatters the pixel's climate archive. Departures (THE JUNGLE OF BANTHA): the
jungle's own law and the owner's trees on the area; the owner's area, not a region (Daggerfall's Bantha, region 10,
paints no pixel); the floor carpet; the roadside pairs and trails; a regional height haze multiplying DFU's one fog;
culling what the haze hides.

## Code and tests

- `src/world/jungle/` - area, models, region field, haze, roadside, trails
- `src/world/terrain/jungleNature.js` - the storeys
- `src/scenes/jungleHost.js`, `src/scenes/jungleFloorHost.js`, `src/scenes/treesHost.js` - the hosts
- `test/world/bantha1_jungle.test.js`, `test/world/bantha2_area.test.js`, `test/world/bantha2_floor.test.js`,
  `test/world/junglegrass.test.js`, `test/world/jungleroadside.test.js`, `test/world/junglespread.test.js`,
  `test/world/jungletrails.test.js`, `test/characters/trunkfoes.test.js`

## Open

- In winter the Rainforest climate's ground snows and the jungle stands on it unchanged, as DFU's palms do. Vanilla
  Enhanced's Snowless Swamps and Jungles takes the snow off; a winter law of the jungle's own is the owner's call.
