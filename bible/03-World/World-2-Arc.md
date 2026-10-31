# World 2.0 - World Generation 2.0, Settlement System 2.0 and the World Editor (WG2)

Opened 2026-10-31. KPbICA's specification "DFO - World Generation 2.0, Settlement System 2.0 & World Editor" (31 October
2026, posted to DFO Online Core): a world made from connected environmental rules - geology, water, climate, soil and
living cover - with towns built from that ground without RMB blocks, and a visual editor that changes both and
publishes the change safely. KPbICA: *"To address the RMB-contracts restriction we better to take care of the WorldGen at
first."* The owner, handing it over: *"This is a big arc and we need to do this correctly with no band aids. I give you
full autonomy."*

The canon every later slice reads is `03-World/World-2-Canon.md`. The audit that opened the arc is
`01-Overview/audits/Audit-World-2-Phase-0.md`.

## Decision records

- **WG-1 (2026-10-31) A layer under the world's own readers, not a second pipeline.** The kernel, its workers, the near
  grid, the mid and far rings and the collision stay. A published region answers the ground's own reads -
  `tamrielGround.js`'s byte and climate, `landforms.js`'s shaper, `terrainGen.js`'s water paint - before their laws.
  Cost: a region is bounded by what those reads carry; the classic skin sees its bytes, not its grain.
- **WG-2 (2026-10-31) Exact arithmetic for every gameplay field.** Only IEEE-754's correctly rounded operations: no
  sine, exponent, `**`, `Math.hypot`, random or clock. Two clients on one revision agree to the bit. A sweep holds
  `src/world/gen2/`. Cost: angles become unit vectors, and the noise is our own seeded gradient noise.
- **WG-3 (2026-10-31) The canon is the repository's own.** A bake reads the authored geography, the owner's relief and
  the tables - never the player's traced picture, whose raster is game data. The fit is the manifest's, measured from
  the freeware. Cost: the authored coast is cruder than the trace, so a published region stays inland (WG-7).
- **WG-4 (2026-10-31) Erosion offline; clients read bakes.** `tools/wg2Bake.mjs` runs the stages; the bake ships
  gzipped under `public/worldgen2/`. Cost: 1.4 MB for the two prototype regions.
- **WG-5 (2026-10-31) A versioned manifest, bound to the ground law.** `world/gen2/worldManifest.json` names every
  version, the seed, the fit and the published regions. The published set's print is recorded under the online
  `GROUND_LAW`; publishing without raising it fails a pin, so the relay's ground gate turns an older build away.
- **WG-6 (2026-10-31) Rivers are vectors.** A bake cell is 410 m; a river is 3 to 60 m. The bake keeps each river's
  cells and the client carves the channel from the course. Surfaces never rise downstream.
- **WG-7 (2026-10-31) Nothing published by this arc.** The Bay's ground, its seam band and the coast are refused to a
  published region without the owner's dated word. Phase 6 is the owner's: the prototypes stand behind `?wg2=<id>`.
- **WG-8 (2026-10-31) Resources say where and how rich, never what they pay.** The economy stays the server's.
- **WG-9 (2026-10-31) A building is a record, an RMB block one source of it.** Legacy ids keep the key and the layout
  stamp; new ids are a settlement's sequence under its own map id lane (0x342), never reused.

- **WG-10 (2026-11-01) A lake is a node of the network.** Inside a closed basin water follows the real ground to its
  floor; the flood's epsilon-graded flat is only for finding the spill. Cost: a second pass over each basin's cells.
- **WG-11 (2026-11-01) Towns ship in their region's bake.** Made offline on the bake's own ground, minted and refused
  whole on any problem, so every client stands the same records and nothing is generated at run time. Cost: a town
  moves with its bake; editing one re-bakes its region.
- **WG-12 (2026-11-01) A province is tiles on one world lattice, crossfaded.** The weights are a partition of unity, so
  overlapping tiles sum to one and a lone region eases in as before. Cost: two tiles' rivers may not meet exactly in
  the overlap; the canon and the continent's inflow keep them close.
- **WG-13 (2026-11-01) Publishing ships the lean cut.** Height, biome and lakes are all the ground reads; the authoring
  planes stay with the tools. Cost: a client cannot place plants or sites from a lean bake.

## Phase 0 - the audit and the canon (DONE)

Four reads of the terrain pipeline, the Tamriel geography, the places and buildings, and the tooling, with the baselines
`tools/wg2Measure.mjs` takes: `01-Overview/audits/Audit-World-2-Phase-0.md`. The canon: `03-World/World-2-Canon.md`.

## Phase 1 - the environmental foundation (BUILT)

`src/world/gen2/`: the exact kit (`exact.js`), raster fields (`field.js`), the grid's operations (`gridOps.js`), the
stages and their invalidation (`stageGraph.js`), the manifest (`manifest.js`), the canon (`canon.js`) and the tables
(`tables.js` over `data/*.json`: rocks, soils, biomes, plants and a profile for each of the ten theatres).

## Phase 2 - the terrain generator (BUILT)

Geology from a world-wide terrane lattice and the canon's spines raised as ridges; climate with lapse, latitude,
orographic rain and rain shadow; stream-power erosion with sediment laid in fans and lakes; a priority-flood drainage
with lakes by water balance (terminal lakes and salt flats in a dry land), rivers with monotone surfaces, falls,
rapids, flood plains, wetlands, springs and the water table; soils, biomes, dunes across the wind, oases and
resources. Two prototype bakes: the Dragontails east of the Bay (`hammerfell-test`) and a Black Marsh wetland. The seam
installs a bake on every thread through the `tamriel` message.

Since: a lake is a node of the drainage (WG-10), a filled flat falls to its spill with a grain, and ranges' ridges are
warped and branched - the longest straight river run in the Dragontails bake fell from 66 cells to 9. The continent's
drainage (`continent.js`) brings 10 m3/s into the Dragontails region from past its edge, and scopes an edit's stale
hydrology to its own river. A province bakes as tiles (`tiling.js`, WG-12) and publishes lean (WG-13).

## Phase 3 - Settlement System 2.0 (BUILT)

`src/world/gen2/settle/`: the building record and the RMB adapter; site selection by type; the generator's stages A to
G; terrain adaptation (plinths, terraces with pads and retaining walls, stilts and platforms); a validator. Five
prototype towns stand without RMB: Tava Wells, Hollowstone, Sentry Hold, Reedford and Hist Shallows.

## Phase 4 - the World Editor (BUILT, first increment)

`worldeditor.html` over `src/tools/worldEditor.js` and the model in `src/world/gen2/edit/`: brushes, biome paint,
settlements placed and generated, a district made again, buildings removed, named layers, undo and redo, the checks,
draft to published with rollback, packages, and the pixel in 3D through the game's renderer. Since: roads and rivers
drawn by hand, and a bake that takes a document as its authored overrides (`tools/wg2Bake.mjs --doc`).

## Phases 5 to 7 - what this arc built of them, and what waits

Built: the services each role carries, the home key lane, the protected-property guard and its refusal, resource sites
with stable ids, the ground law's binding, and a profile for every province. Waiting, each its own slice: a generated
town's doors and interiors in the streamed world, NPC navigation over a published region, a continental drainage pass
for inflow at a region's edge, published regions (the owner's call), and province-wide bakes. Two tunings seen in the
editor: a river across a filled flat runs straight (the flood's grading), and a range's ridges read streaky.

## THE FOUR HOSTS (Home.md)

- `scenes/world.js` - wired: `gen2Bakes()` (`scenes/gen2Host.js`) rides `terrainGen.setTamriel`; no statement added.
- `scenes/exterior.js` - nothing: the fixed-city bench streams no ground past the Bay.
- `scenes/worldModes.js` - nothing: interiors read no published ground yet.
- `scenes/dungeonContext.js` - nothing: dungeons read no published ground.

## Pins and mutants

- `test/world/gen2/wg2_foundation.test.js` - the sweep, the noise, the tables, the manifest and its ground law, the stages.
- `test/world/gen2/wg2_terrain.test.js` - determinism, water's laws, the readers' bytes, seams, in Hammerfell and Skyrim.
- `test/world/gen2/wg2_bakes.test.js` - the shipped bakes reproduce; Phase 2's exit features; plants meet their needs.
- `test/world/gen2/wg2_seam.test.js` - the seam with none and one region, the fit's refusal, the paint.
- `test/world/gen2/wg2_settlements.test.js` - five towns sound, culture's geometry, sites, regeneration, legacy ids.
- `test/world/gen2/wg2_editor.test.js` - layers, undo, stale stages, publishing's gates, property, packages, prefabs,
  roads and rivers, the override bake.
- `test/world/gen2/wg2_continent.test.js` - the continent's drainage, inflow, downstream reach, the basin network.
- `test/world/gen2/wg2_tiles.test.js` - nine provinces' tiles, the crossfade, the manifest's tilings, the lean cut.
- `tools/mutants/wg2.json` - the mutants.

## Port-Ledger

Section A, WG2: the generator, the bakes, the seam, settlements without RMB and the editor are ours. DFU reads WOODS.WLD
and CLIMATE.PAK and lays every town from RMB blocks.
