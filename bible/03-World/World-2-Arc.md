# World 2.0

World 2.0 makes the world from connected environmental rules - geology, water, climate, soil and living cover - builds
towns from that ground without RMB blocks, and gives a World Editor that changes both and publishes the change safely.
Regions are baked offline and shipped; a client reads a bake and never generates at run time. Nothing is published: the
prototypes stand behind `?wg2=<id>`. The laws every slice reads are in `03-World/World-2-Canon.md`.

## How it works

### The foundation (`src/world/gen2/`)

The exact kit (`exact.js`), raster fields (`field.js`), the grid's operations (`gridOps.js`), the stages and their
invalidation (`stageGraph.js`), the versioned manifest (`manifest.js`, `worldManifest.json`), the canon (`canon.js`)
and the tables (`tables.js` over `data/*.json`: rocks, soils, biomes, plants and a profile for each of the ten
theatres). `tools/wg2Measure.mjs` takes the terrain pipeline's baselines.

### The terrain generator

Geology from a world-wide terrane lattice with the canon's spines raised as warped, branched ridges; climate with lapse,
latitude, orographic rain and rain shadow; stream-power erosion with sediment laid in fans and lakes; a priority-flood
drainage where a lake is a node of the network and a filled flat falls to its spill with a grain; rivers with monotone
surfaces, falls, rapids, flood plains, wetlands, springs and the water table; soils, biomes, dunes across the wind,
oases and resources. The continent's drainage (`continent.js`) brings inflow past a region's edge and scopes an edit's
stale hydrology to its own river. A province bakes as tiles on one lattice, crossfaded (`tiling.js`), and publishes
lean: height, biome and lakes.

### The seam

`tools/wg2Bake.mjs` runs the stages; the bake ships gzipped under `public/worldgen2/`. A region answers the ground's own
reads - `tamrielGround.js`'s byte and climate, `landforms.js`'s shaper, `terrainGen.js`'s water paint - before their
laws, installed on every thread through the `tamriel` message (`scenes/gen2Host.js`). Rivers are vectors: the bake keeps
each river's cells and the client carves the channel from the course.

### Settlements (`src/world/gen2/settle/`, `src/world/settle2/`)

The building record and the RMB adapter; site selection by type; the generator's stages; terrain adaptation (plinths,
terraces with pads and retaining walls, stilts and platforms); a validator. Towns are made offline on the bake's own
ground and ship in their region's bake, refused whole on any problem. In the streamed world they stand with doors,
interiors, walls, gates, terraces, stairs, wells, stalls, docks, bridges and stilt platforms. A door is judged on the
ground the stream draws (`padLaw.js` `drawnAt`). Five prototype towns: Tava Wells, Hollowstone, Sentry Hold, Reedford
and Hist Shallows.

### The World Editor

`worldeditor.html` over `src/tools/worldEditor.js` and the model in `src/world/gen2/edit/`: brushes, biome paint, roads
and rivers by hand, settlements placed and generated, a district made again, buildings removed, named layers, undo and
redo, the checks, draft to published with rollback, packages, and the pixel in 3D through the game's renderer. A bake
takes a document as its authored overrides (`tools/wg2Bake.mjs --doc`).

### The hosts

`scenes/world.js` wires `gen2Bakes()` through `terrainGen.setTamriel`; the towns come through modules it already builds
(`tamrielPlacesHost.js` constructs `settle2Host.js`, `spawnStandHost.js` asks it first past the Bay, `pixelBuild.js`
stands its ground). `scenes/exterior.js` streams no ground past the Bay. `scenes/worldModes.js` takes a town's door as a
static door and its interior as the subrecord's. `scenes/dungeonContext.js` has nothing to do: a mine is a building.

## Rules

- Do it correctly, with no band aids (the owner).
- A layer under the world's own readers, not a second pipeline: the kernel, its workers, the rings and the collision
  stay. A region is bounded by what those reads carry; the classic skin sees its bytes, not its grain.
- Exact arithmetic for every gameplay field: no sine, exponent, `**`, `Math.hypot`, random or clock. A sweep holds
  `src/world/gen2/`.
- The canon is the repository's own: the authored geography, the owner's relief and the tables, never the player's
  traced picture. So a published region stays inland.
- The published set's print is recorded under the online `GROUND_LAW`. Publishing is the owner's call; the Bay's
  ground, its seam band and the coast are refused to a region without the owner's word.
- Resources say where and how rich, never what they pay: the economy stays the server's.
- A building is a record; an RMB block is one source of it. Legacy ids keep the key and the layout stamp; new ids take a
  settlement's sequence under map id lane 0x342, never reused.

## Daggerfall Unity

DFU reads WOODS.WLD and CLIMATE.PAK and lays every town from RMB blocks. The generator, the bakes, the seam,
settlements without RMB and the editor are ours.

## Code and tests

- `test/world/gen2/wg2_foundation.test.js` - the sweep, the noise, the tables, the manifest and its ground law, the
  stages
- `test/world/gen2/wg2_terrain.test.js` - determinism, water's laws, the readers' bytes, seams, in Hammerfell and Skyrim
- `test/world/gen2/wg2_bakes.test.js` - the shipped bakes reproduce; plants meet their needs
- `test/world/gen2/wg2_seam.test.js` - the seam with none and one region, the fit's refusal, the paint
- `test/world/gen2/wg2_settlements.test.js` - the towns sound, culture's geometry, sites, regeneration, legacy ids, sills
- `test/world/gen2/wg2_editor.test.js` - layers, undo, stale stages, publishing's gates, property, packages, roads and
  rivers, the override bake
- `test/world/gen2/wg2_continent.test.js`, `wg2_tiles.test.js` - the continent's drainage, province tiles, the lean cut
- `test/world/settle2/wg2towns.test.js`, `wg2towns_freeware.test.js`, `wg2towns_features.test.js` - the towns standing
- `tools/mutants/wg2.json`, `tools/mutants/wg2towns.json` - the mutants; `tools/wg2TownProbe.mjs` - a town in the game;
  `tools/wg2Bench.mjs` - frame times with and without a region

## Open

- NPC navigation over a published region.
- A pixel's build in a region costs about twice the Bay's in the browser bench (`tools/wg2Bench.mjs`); not yet profiled.
- Crops standing on the towns' fields.
- Publishing a region (the owner's call).
- Two tiles' rivers may not meet exactly in a province's overlap; the canon and the continent's inflow keep them close.
- A terrace's floor may stand over its pad's middle, so its door is never under the drawn ground.
