# World Assembly

How Daggerfall's data becomes the world the player walks: models, town blocks, flats, doors and interiors, dungeons,
terrain, nature and the streaming map. The data math is ported from Daggerfall Unity; the rendering is ours
(`01-Overview/Port-Doctrine.md`). This page covers the Iliac Bay's own data. The land past the Bay is built by the
Tamriel pages (`Tamriel.md`, `Tamriel-Lands.md`).

## How it works

- **Models.** `src/world/meshReader.js` converts a DFMesh: GlobalScale 0.025, position (X, -Y, Z) times scale, each
  plane a triangle fan, negative V on REPEAT wrapping. Door planes are pulled out in the vertex pass (archives 74
  building, 56 dungeon enter, 331 ruin enter, 95 dungeon exit).
- **Town blocks.** `src/world/rmbLayout.js` places an RMB block's models and its ground tilemap (tiles read
  `[x][15 - y]`; records 56 and up are markers and become grass). `src/world/locationLayout.js` sets each block of a
  location at `(x, 0, y) * 102.4`. `src/world/rmbFlats.js` collects misc, exterior and nature flats.
  `src/world/staticBuildings.js` builds one hit box per subrecord, which the activation ray reads first.
- **Doors and interiors.** `src/world/staticDoors.js` sizes a door from its plane's diagonal. Interiors are laid out by
  `src/world/interior/interiorLayout.js`. The enter marker also accepts a Rest marker (199.4), as DFU does. The ladder
  (41409) climbs only when its object type is 3.
- **Dungeons.** `src/world/rdbLayout.js` places an RDB block: model matrix T * Rz * Rx * Ry, exit doors (70300) only in
  the starting block, action doors closed with their starting lock, flats and markers, and the NPC flat archives
  (`src/world/npcFlatArchives.js`) as static NPCs. Fixed treasure keeps its exact position. `src/world/actionSystem.js`
  runs action doors and linked action records.
- **Terrain.** `src/world/terrain/terrainSampler.js` samples WOODS.WLD into 129x129 heights a map pixel: bicubic base,
  bicubic noise and Perlin detail. Height is sample x 1539 x 1.25 (`STREAMING_TERRAIN_SCALE`), a pixel is 819.2 units
  (`TERRAIN_SIZE`). `src/world/terrain/terrainTiles.js` classifies tiles (water, beach, dirt, grass, stone), stamps a
  location's ground tiles, flattens its rect to the pixel average and blends the edge.
- **Nature.** `src/world/terrain/terrainNature.js` scatters nature flats on a wilderness pixel, clear of locations.
- **Streaming.** `src/world/streamingWorld.js` holds the desired pixel grid (`TERRAIN_DISTANCE` 3, a 7x7 grid; the
  setting allows 1 to 4), builds nearest first, and recenters the floating origin on a pixel change.
- **Arrival.** `src/world/locationEntrance.js` stands a traveller just outside a random side of the location, or at its
  nearest start marker in a city, facing in. Fast travel, court release and ship arrival pass a reposition to
  `src/scenes/world.js` `_teleportToPixel` (`REPOSITION`, `src/systems/ship.js`). A landing held inside a solid moves
  to open ground nearby.
- **City gates.** `src/world/city/cityGate.js` closes the gate models (446 open, 447 closed) at night.

## Rules

- The data math is DFU's, ported 1:1 unless a departure is named here.
- A teardown of built pixels (the roads loading late, a season re-skin) re-queues them nearest first and holds the
  player's motor until their own pixel stands again (`src/scenes/world.js` `rebuildRoadless`).
- Only one location stands on a map pixel.

## Daggerfall Unity

The modules port `MeshReader.cs`, `RMBLayout.cs`, `RDBLayout.cs`, `DaggerfallLocation.LayoutLocation`,
`GameObjectHelper.GetStaticDoors`, `DaggerfallStaticBuildings`, `DaggerfallAction` and `DaggerfallActionDoor`,
`DefaultTerrainSampler`, `DefaultTerrainTexturing`, `DefaultTerrainNature`, `StreamingWorld`, `FloatingOrigin` and
`DaggerfallCityGate`. Departures:

- Perlin noise: DFU calls Unity's engine-internal `Mathf.PerlinNoise`, which cannot be translated.
  `src/world/perlin.js` uses Ken Perlin's reference improved noise, remapped to [0, 1]. The terrain is deterministic,
  but not DFU's samples.
- The streaming map uses a closed-form pixel mapping instead of DFU's incremental accumulation; it is the same mapping
  without drift.
- The billboard shader samples bottom-up textures the right way up; the mesh path keeps DFU's negative-V convention.

## Code and tests

- `src/world/meshReader.js`, `src/world/rmbLayout.js`, `src/world/locationLayout.js`, `src/world/rmbFlats.js`,
  `src/world/rdbLayout.js`, `src/world/staticDoors.js`, `src/world/staticBuildings.js`, `src/world/actionSystem.js` -
  layout
- `src/world/terrain/` - terrain sampling, texturing and nature
- `src/world/streamingWorld.js`, `src/world/locationEntrance.js` - streaming and arrival
- Town life is wired here but documented with its systems: the population (`src/world/city/cityNavigation.js`,
  `src/characters/mobile/mobilePerson.js`), the watch (`src/scenes/cityGuards.js`), talk (`src/systems/talk/`) and
  the court (`src/systems/court.js`). Windmills are `Windmills.md`.
- `test/world/terrain/terrain.test.js` - the sampler, tiles and location stamp on fixed pixels
- `test/world/streaming.test.js` - the streaming grid
- `test/world/audit64_layout.test.js` - the layout rules ported from DFU
- `test/player/enterexit.test.js`, `test/systems/travelArrival.test.js`, `test/scenes/fixc_firstStart.test.js` -
  arrival and the first stand
