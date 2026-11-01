# Deep Waters

A port of jet082's **Iliac Puddle No More 1.2.2** (its assembly calls itself Deep Waters), its law read off the compiled
assembly; the release's record is in `01-Overview/Own-Work.md`. Vanilla Daggerfall's sea is a flat sheet of water over a
flat bed; the mod carves it out into a real sea with a shelving coast, a deep floor, seafloor life, fish, foes, sunken
loot and swimming. The continent's sea past the Bay is carved by the same rules. It is the required dependency of Ocean
Holes (`Ocean-Holes.md`).

## How it works

- **The coastline** (`src/world/deepWater/deepWatersBake.js`, cached by `deepWatersBakeCache.js`, built in
  `deepWatersWorker.js`). The mod ships a large distance bake derived from Daggerfall's data; the port builds the same
  planes on the player's machine from the player's own files (the threshold, the fine and coarse masks, the flood from
  the map's border, octile distances capped at 255) and caches them in IndexedDB.
- **The floor** (`src/world/deepWater/deepWatersPixel.js`, `deepWaterTileData.js`, `deepBathymetry.js`,
  `deepWaterClassification.js`, `deepWaterFloor.js`, `deepWaterCap.js`). Per pixel: the biome and local edge, the
  bathymetry (shelf from the edge distance, the climate's base depth, noise), the floor mesh and walls, and a cap that
  hides an ocean pixel's ground and clips a coastal pixel's water tiles. The terrain's clip variant draws a patched tile
  per texel, so no carved sea draws as road art at a distance.
- **The look** (`src/render/deepWatersRender.js`, `src/world/deepWater/deepWaterLook.js`). The seafloor's and surfaces'
  own programs, the scene tint, the underwater distance fog, the horizon under water.
- **The swimmer** (`src/scenes/deepWater/deepWatersPlayer.js`, `deepWatersSwimMove.js`,
  `src/world/deepWater/deepWaterSwim.js`). The swim driver runs before and after the motor, as the mod's two scripts run
  first and last in DFU's frame: when the player is in the water and swimming, the stroke, the floor clamp, the breath
  and the ear under water.
- **Seafloor life** (`src/world/underwater/underwaterDecorations.js`, `src/scenes/deepWater/deepWatersDecor.js`). Weed,
  coral, rock and dead sea life, placed per pixel and paced.
- **Fish** (`src/world/passiveFish.js`, `src/scenes/deepWater/deepWatersFish.js`). Seven species at the mod's
  templates 9001-9007, in schools by biome and depth; caught as loot and stocked on shop shelves through the
  custom-group table. The rows are ours (`src/systems/deepWater/deepWatersFishRows.js`): one name a fish, its item's
  and its species' (the Gold Butterflyfish, the Rusttail Bass, the Pale Grouper), the mark a fisher sees and the kind,
  no place in it. A fish weighs Raw Fish's kilo at the Grey Mackerel's height, by the cube of its own, and costs its
  meat at Raw Fish's price plus 60 over its spawn weight. A catch saved under an old name takes its new one
  (`normalizeFishItems`).
- **The fish's pictures** are ours (`src/systems/deepWater/fishArt.js`, by `src/art/ownPainter.js`), each under the
  texture name its species reads and at the power-of-two size the sea samples. A fish is drawn in the shape it shows,
  so `restoreIconAspect` gives its icon that shape. The sea's billboards take them through
  `createFishPictures({ picture })`, painted in the page's idle slices (`src/systems/idleWork.js`); a species spawns
  once its picture is up. The icons come through `installDeepWatersFishIcons`.
- **Foes** (`src/world/underwater/underwaterEnemies.js`, `src/scenes/deepWater/deepWatersEncounters.js`). Eleven types
  by depth band, from Slaughterfish in the shallows to the Lich past 0.85 of the depth, a rare boss in the deep, and
  treasure guards.
- **Sunken loot** (`src/world/underwater/underwaterLoot.js`, `src/scenes/deepWater/deepWatersLoot.js`). Stray piles with
  rubble and wrecks with their own piles and guards.
- **The continent's sea** (`src/world/tamrielWatersBake.js` `TamrielWatersBake`). Past the Bay the bake covers the
  continent's frame, built by the Bay's own rules from the composed ground: the floor shelves from every beach into the
  deep (2.7 m at the edge, 11.2 m 128 m out, then the climate's plain). The open sea is the trace's, flooded a cell at a
  time. The Bay's pixels stay the Bay's bake; the Eltheric Ocean has its own (`Eltheric-Ocean.md`).

## Rules

- Mods attached are made compatible and implemented 1:1 (Mac); the fish's rows, words and pictures are ours (OWN-WORK,
  the owner). Every setting's description is ours; the defaults stay the sea's ported tuning.
- Coastlines have sand and dirt and arc into the deep, with water slightly see-through to show the depth (the owner).
- The coastline is rebuilt on the player's machine, never carried: the mod's bake is derived from Daggerfall's data,
  which never enters the repository.
- Online the room owns the sea and its depth (the seafloor is ground), the deep's foes and sunken loot, and the swim
  multiplier, the stroke and the Argonians' breath. The surfaces, fog, fish and weed are each player's own
  (`src/systems/online/onlineLane.js`).

## Daggerfall Unity

The mod's assembly is the reference. Departures, among them: our own fish rows and pictures; the coastline built on the
player's machine rather than carried (it differs at the coast by the port's Perlin noise); fog per fragment; the water
column drawn twice; the recentre carries the schools; the world's fog on the top; the whole stream carved; the unload
takes the mod's children; surfacing restores the sky's fog colour; the swim is handed to the motor directly instead of
borrowing DFU's dungeon flag; and the continent's sea past the Bay.

## Code and tests

- `src/world/deepWater/` - bake, floor, cap, look, swim, runtime
- `src/scenes/deepWater/` - the host, swimmer, decorations, fish, encounters and loot
- `src/world/underwater/` - decorations, foes, loot and look laws
- `test/world/deepWater/dwa_bake.test.js` - the bake against the mod's own, cell for cell, when present
- `test/world/deepWater/dwb_world.test.js`, `dwe_decorations.test.js`, `dwe_runtime.test.js`, `dwf_farsea.test.js` -
  floor, decorations, runtime and the far sea
- `test/world/deepWater/tamriel_deep.test.js` - the continent's sea
- `test/systems/item/dwe_fish.test.js`, `test/systems/ownwork4_pictures.test.js` - the fish's rows and pictures
