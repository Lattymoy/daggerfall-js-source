# World 2.0 - the canon

What World 2.0 is, its data and the rules that hold it. Read this before changing anything under `src/world/gen2/`, the
seam in the ground's readers, `scenes/gen2Host.js`, `public/worldgen2/` or the World Editor. How it fits together, its
rules and what is open are `03-World/World-2-Arc.md`.

## The layers

Five, each over the one before, none writing into another:

1. **Canon** - the authored geography (`world/tamriel/tamrielGeography.js`: provinces, ranges, rivers) and the owner's
   relief, read through `world/gen2/canon.js`. Never the player's traced picture.
2. **Generated environment** - a region's bake: geology, climate, worked land, water, soil, biomes, resources.
3. **Authored overrides** - an editor document's layers (`world/gen2/edit/`), and the land rows of
   `world/land/landEdits.json`, which still win over any ground (they are asked last).
4. **Settlements and infrastructure** - settlement records with their buildings, roads and terrain operations.
5. **Persistent gameplay** - homes, decor, rentals, recall, quests: the account service's and the save's, never in a bake.

## Coordinates

A world pixel is 819.2 m, keyed by `worldPixelKey`, x east and y south, the Bay's (0, 0) at its north-west corner. A
point is a fraction of a pixel; pixel P covers [P, P + 1). The kernel's sample (x, y) of pixel (px, py) is the point
(px + x / 128, py + 1 - y / 128). A pixel's WOODS byte stands at its node, its south-east corner. A region's cell (i, j)
at `res` cells a pixel covers [x0 + i / res, x0 + (i + 1) / res). A facing is a unit vector, never an angle.

## Determinism

Every gameplay field - a bake, the sampler, a town, a plant, an edit - is built from `+ - * /`, `Math.sqrt`, `floor`,
`round`, `abs`, `min`, `max`, `imul` and bit operations. `exact.js` `INEXACT_CALLS` lists what is barred, and
`wg2_foundation.test.js` sweeps `src/world/gen2/` for it and for `**`. Sorting breaks every tie by index. The priority
queue (`gridOps.js` `CellHeap`) pops equal keys lowest index first.

## The stages

`stageGraph.js` orders them: canon, geology, climate, erosion, hydrology, soil, biome, vegetation, resources,
suitability, settlements. A stage reads only those its `reads` names. A change marks the stages downstream of it stale
over its rectangle grown by each one's reach; hydrology's reach is the changed water's basin. A stage's law changes its
`version`; a change to any law that moves a bake raises `BAKE_GENERATOR` (`regionBake.js`).

## Data

Designers change the world through `src/world/gen2/data/`: `rocks.json`, `soils.json`, `biomes.json` (each with its
Daggerfall climate byte), `species.json` (each plant's needs), `provinces.json` (one profile a theatre, 0 to 9),
`styles.json`, `settlementTypes.json` and `prefabs.json`. `tables.js` `tableProblems` names a broken reference.

## The bake

`tools/wg2Bake.mjs <id|all>` writes `public/worldgen2/<id>.wg2.gz`; `--doc <package>` bakes an editor's document in as
the authored overrides, `--province <Key>` a province's tiles, `--lean` the runtime cut. The file (`bakeCodec.js`) is `WG2B`, a header
length, a JSON header (spec, versions, canon print, rivers as their cells, lakes, falls, springs, resources) and planes
quantised to fixed steps, then a byte and a climate a pixel. Its print is FNV-1a of the bytes. A bake is remade from its
spec on any machine to the same print (`wg2_bakes.test.js`): a law that moves one re-bakes and commits both.

The header also holds the region's towns (`regionBake.js` `bakeTowns`): made offline on the bake's own ground, minted,
and refused whole on any validator problem, so every client stands the same records. A lean bake (`bakeCodec.js`
`RUNTIME`) carries height, biome and lakes alone - the same ground at about a third of the bytes.

## Tiles

A province too large for one bake is cut on one lattice over the world (`tiling.js`, 128-pixel tiles anchored at the
Bay's corner) into the tiles that hold its land, each baked over its core grown by its overlap. Where tiles overlap,
the seam crossfades them: `regionSampler.js` `weight` is a product of the axes' eases, a partition of unity, and
`gen2Ground.js` lays every region's share over the world's ground. Tiles of one tiling stand over each other's bands;
anything else overlapping is refused, at install and in the manifest. All nine provinces make 628 tiles: about 11 s
and 0.59 MB gzipped each, a third of that lean.

## The seam

`gen2Ground.js` holds the installed bakes, fetched under the app's root (`scenes/gen2Host.js` `bakeUrl`). `tamrielHeightByte` asks `gen2Byte` before the land rows,
`tamrielClimateAt` asks `gen2Climate` after them, the shaper's `landAt` takes `gen2Units`, and `terrainGen.js` paints
`paintGen2Waters`. A region eases into the world's ground over `REGION_BLEND_PX` (8) inside its edge. The bakes ride the
`tamriel` message to the terrain, roads and deep-water workers. A bake made on another fit is refused. With none
installed every hook answers undefined. The kept roads past the Bay are keyed by `gen2Stamp`.

## The manifest

`world/gen2/worldManifest.json`: `worldId`, `schemaVersion`, the five versions, `worldSeed`, `fit`, `groundLaw`,
`published` and `groundPrints`. A published region names its rectangle, bake file, print, generator and revision.
`manifestProblems` refuses one on the Bay or its 14-pixel seam band without a dated `migration` quote, two that
overlap, and a generator this build cannot read. Publishing changes `groundPrint`; record it under a raised
`GROUND_LAW` (`net/wire.js`), with a moved field for saved heights (`terrainSampler.js` `GROUND_FRAME_LAW`).

## Water

Rivers carry discharge from runoff (`hydrology.js` `runoff`, Budyko's shape), lose water in a dry land, and need
`RIVER_KM2` of drainage. A course's surface never rises; its bed is under it by `riverDepth`. A closed hollow holds
water to where evaporation meets inflow: brimful and spilling, a terminal lake, or a salt flat. A spring's pool is
`POOL_PX` across. Channels are carved by the sampler from the courses. The sampler reads the ground between
cells: a lake's shore is where the ground meets its level, and a dune field fades out - never a step or a straight
shore at a cell's edge (`regionSampler.js` `waterAt`).

Inside a closed hollow the water runs down the real ground to its floor, and the lake is one node of the network
(`hydrology.js` `basinNet`, Kahn's order): no river crosses the flood's flat in a straight line. A flat the geology
filled falls gently to its spill with a grain of its own (`geology.js` `FLAT_RISE`, `FLAT_GRAIN`).

`continent.js` runs Tamriel's rain to the sea at the relief's grain. `regionInflow` lays the rivers that enter a region
one cell inside its edge, and `downstreamOf` is the stages' hydrology reach: a change reaches its river to the mouth,
never upstream.

## Plants

`vegetation.js` `plantsIn` grows each species of the biomes present on its own jittered lattice, thinned by its grove
field, never past a need (`speciesProblems`); trees keep their spacing. The same box grows the same plants.

## Buildings and settlements

A building (`settle/buildingRecord.js`) has an id, a role and the Daggerfall type the game reads, services, access, a
place, a footprint, doors on the street side, an interior and, for a house, a home key. Legacy:
`rmb:<mapId>:<key>@<layout>` from `rmbAdapter.js`, nothing moved. New: `<settlement>/b<seq>`; `mintIds` keeps an id
across a regeneration when the same plot stands on the same ground, and never gives a retired one again. Each building
keeps a block slot [bx, by, record] in its pixel's location, and a house's home key is the game's building key for it
(`talkTopics.js` `makeBuildingKey`). A settlement's map id lane is 0x342.

A town stands within one map pixel, and a terrace's pad (`padLaw.js`) is one law for the generator and the streamed
ground. A door is judged on the ground the stream draws (`drawnAt`, the kernel's two triangles over each 6.4 m quad,
which a pad narrower than one is not): its floor is never under it, and no later pad raises it over an earlier door.
`settlementGen.js` makes a town in stages A to G; `settlementValidate.js` must answer nothing before it is saved.

In the streamed world (`world/settle2/`, `scenes/settle2Host.js`) a baked town is a location on its pixel: an 8 x 8 grid
of its own blocks (a port block family), each building a shell model (ids from 8,000,000, one a shape) with a door, and
an interior made from a donor of its role's pool. Its wall, gates, retaining walls, stairs, wells, stalls, docks,
bridges and platforms are models of the same lane (`settle2Features.js`), each a pure function of its shape. Its
location index is -(42,000,000 + ordinal). It stands on the region's ground, nothing blended, its models laid from its
plaza's plane. A place listed before it on its pixel keeps the pixel, and a town stands only where the near grid streams
its region's ground (Landforms on).

A departure from DFU: an arrival at a town lands at its nearest way in, as a city's does - its grid is its whole pixel,
so a village's edge landing would be the next pixel.

## Editing and publishing

An editor document is frozen data: layers of operations (`editLayers.js` `opProblems` names a bad one). A road eases
the ground to its smoothed level across its width and shoulder; a hand-drawn river cuts a channel under a surface that
never rises, and a bake with the document stands it as a river whatever it carries. Its ground
changes are patches filed by 16-pixel tile. History is a stack of documents. A revision goes draft, review, staging,
published (`revisions.js`); each gate is in `advanceRevision`. A publication retires the last; a rollback publishes the one
before. `propertyGuard.js` refuses a change over a protected record. Packages carry a print and the bake they edit.

## Compatibility rules

- The Bay's ground, its towns, its blocks, homes, keys and layout pins are untouched by any of this.
- No region is published by default; the prototypes stand behind `?wg2=<id>` (`scenes/gen2Host.js`).
- A bake ships no ARENA2 data and no raster of the player's picture; an `arch3d` prefab is named, never shipped.
- New work answers for every province (TAMRIEL-WIDE): profiles exist for all ten theatres, and pins hold a case past
  the Bay.
