# The Places Past the Bay

The towns, countryside, lairs, ports, roads and capitals that stand on the continent past the Iliac Bay, so every
province can be walked into, travelled and lived in. The places are the port's own, made on the
trace of Daggerfall's map from the player's Daggerfall files, the same on every client. Seven capitals are built by
hand, the Imperial City the largest of all. The player meets them travelling, on the held map and in the Overworld.

## How it works

- **The named places** (`src/world/tamrielPlaces.js` `makeTamrielPlaces`, stood by `src/world/arenaPlaces.js`
  `standArenaPixels`). The lore's cities and the towns and villages made beside them, each stood on the pixel under its
  point where that pixel is its own province's land. The module names keep `arena...` because saves and discoveries use
  that id lane.
- **Clones** (`src/world/arenaLocations.js`). Each named place stands as a non-mutating clone of one of Daggerfall's own
  places, under its own name, id and index: a city-state a TownCity, a town a TownHamlet, a village a TownVillage. The
  world host asks for it as the pixel builds (`src/scenes/world.js` `_locationToBuild`). Town outlines are
  `Town-Shapes.md`'s; the streets and stone `Urban-Fabric.md`'s.
- **The countryside** (`src/world/tamrielCountry.js`). Hamlets, villages, farms, homes, inns, temples and shrines
  between the named places, at the Bay's own rate for each climate, counted from the player's own MAPS.BSA, CLIMATE.PAK
  and WOODS.WLD, rolled by each pixel's hash.
- **The lairs** (`src/world/tamrielDungeons.js`). Labyrinths, keeps, ruins and graveyards at the Bay's rate, at most one
  an 8 x 8 cell of the countryside's grid, each laid out of Daggerfall's dungeon blocks in a plan of its own, never a
  copy of a Bay dungeon. A lair rolls DFU's dungeon tables by its type.
- **Ports and roads.** Ports past the Bay (`src/world/worldWide/worldPorts.js`), houses for sale, the roads between
  places (`Roads.md`) and their crossings onto the Bay's roads. The map reads the places the roads were laid to
  (`src/world/pastBayPlaces.js`).
- **The capitals** (`src/world/tamrielCapitals.js`, `src/world/capitalPlans.js`). Built by hand, not cloned: the
  Imperial City (`src/world/capitalImperial.js`), Solitude on its rock (`src/world/capitalSolitude.js`), Mournhold,
  Alinor, Falinesti, Torval and Helstrom, each a block grid laid out here, its districts of Daggerfall's own city blocks
  (every house, shop, guild and temple with its interior and people) round landmarks of the port's own
  (`src/world/capitalModels.js`), with castles, approaches, carriages, trees and walks.
- **The Imperial City** (`src/world/imperialCity.js`). `IMPERIAL_SPAN` 25 pixels a side, 20.48 km across: each pixel's
  slice of one plan its own location, flattened to meet level. The White-Gold Tower on its plaza, Green Emperor Way's
  ring road, the Palace District, the city wall, distinct districts (the Market, the Arena District, the Arboretum, the Temple District, Talos Plaza, the Elven Gardens), the Prison, the Arcane University, the
  Waterfront, Talos Bridge, the Lake Rumare ring and outskirts' round towns. Its own street fabric, buildings, homes,
  yards, windows, lights and sewers (`src/world/imperial*.js`), built ahead on a worker and drawn as an impostor past the
  stream's reach. Daggerfall's arena stands in the Arena District. To the living world the city is one town.

## Rules

- Implement Arena on our Tamriel: Arena's map, our engine (the owner). No Arena files are needed:
  canon plus generated places (the owner). Nothing of Arena is read.
- Populate the world with unique smaller towns, farms and its own dungeons (the owner).
- Redesign each capital close to the other games' (Oblivion's Imperial City, Skyrim's Solitude); build them yourself, no
  files needed (the owner). Signatures in a layout of the port's own, never a copy of another game's level or meshes.
- The Imperial City at 20 km, distinct districts with varied layouts and parkour opportunities; Daggerfall's arena
  replaces the colosseum there and stays in Daggerfall (Mac).
- No Arena art, sound or level is read; ARENA2 and Arena are never in the repository.
- One Tamriel a room online.

## Daggerfall Unity

A DFU city is its MAPS.BSA row's grid of RMB blocks, one location a pixel, eight blocks a side at most
(`RMBLayout`, `DaggerfallLocation`). Departures: everything past the Bay; capitals laid out by hand; the Imperial City as
625 slices with streets and buildings no Daggerfall block carries, far slices standing a view of their own, and the city
past the stream drawn on the far ring.

## Code and tests

- `src/world/tamrielPlaces.js`, `src/world/arenaPlaces.js`, `src/world/arenaLocations.js` - the named places
- `src/world/tamrielCountry.js`, `src/world/tamrielDungeons.js` - the countryside and lairs
- `src/world/tamrielCapitals.js`, `src/world/capital*.js`, `src/world/imperialCity.js` - the capitals
- `test/tesa2_arena.test.js`, `test/tesa3_provinces.test.js`, `test/tesa6_ports.test.js`,
  `test/tesa7_country.test.js`, `test/tesa8_lairs.test.js`, `test/tesa12_places.test.js` - places, ports, countryside,
  lairs
- `test/tesa10_capitals.test.js`, `test/tesa10c_capitals.test.js`, `test/tesa11_imperial.test.js`,
  `test/tesalore_capitals.test.js`, `test/world/audittesa2c_capitals.test.js` - the capitals
- `test/world/icgrand_fabric.test.js`, `icgrand_arena.test.js`, `icgrand_palace.test.js`, `icgrand_sewers.test.js`,
  `icgrand_lod.test.js`, `icgrand_prebuild.test.js`, `icgrand_living.test.js` - the Imperial City
- `test/world/solitude_relief.test.js` - Solitude on its rock
