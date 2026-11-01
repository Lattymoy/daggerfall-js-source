# Roads

Roads, tracks, rivers and streams across Tamriel. The network is our own everywhere, routed on the land and curved; on
the Bay it is painted by Hazelnut's **Basic Roads** painter (MIT), ported, under the mod's switch. Road edges blend into
the ground, bridges cross the wide rivers, and nothing of the wild stands over a road. The player meets roads everywhere
outdoors, on the travel map and in the Overworld.

## How it works

- **The Bay's network** (`src/world/roadsProducer.js` `buildRoadsFromArchives`), built in the terrain worker from the
  player's MAPS.BSA and WOODS.WLD and cached. The rivers and streams follow the land's drainage
  (`src/world/road/riverNetwork.js`). The roads and tracks follow the law the roads past the Bay take: the land's price
  (`src/world/road/roadLand.js`), a river crossed once as a ford is priced, a place on its own pixel's land, and the
  gap links (`src/world/road/roadGaps.js`). A road leaves each land every 100 pixels of an edge (`EDGE_GATE_SPACING`),
  where the crossings meet the provinces' roads. On the freeware it lays 14,965 road, 28,059 track, 1,549 river and
  3,036 stream pixels, no road on the sea.
- **The painter** (`src/world/road/roadPainter.js`). A port of the mod's painter: roads in whole tiles (paving record 46,
  diagonal flanks 47 and 55), tracks in Daggerfall's dirt-to-grass tiles, an arm stopping at a town's rect. It records
  which tiles it wrote, so later readers know a road tile from a town's paving. Rivers and streams paint when their
  switch is on.
- **The map** draws the network as lines on the travel map.
- **Cut into the land.** With Landforms on, roads and rivers are graded and cut in (`Landforms.md`).
- **Clear roadsides** (`src/world/road/roadVerge.js`). Every placer of the wild's flats and trees asks whether the
  whole flat or tree, not just its root tile, would stand over a road, and keeps off.
- **Past the Bay** (`src/world/tamrielRoads.js`, `src/world/arenaRoads.js`). The Bay's network stays on the Bay. Roads
  between Arena's places are built by the same builder on windows over each region. Every route pays the land's law
  (`src/world/road/roadLand.js` `landStep`, `VOYAGER_DIALS`): grade squared on smoothed height, so a road goes round a
  steep rise and takes the valley or pass; water, shores and carved lakes refused. Roads are drawn as curves
  (`src/world/road/roadCurves.js`), with gentle bends at turns and junctions, and the Overworld walks them as roads.
  Cyrodiil's named roads follow a table of which road joins which cities (`src/world/road/cyrodiilRoads.js`
  `CYRODIIL_ROADS`). A crossing's join carries a Bay road straight out to its edge to meet them.
- **Rivers crossed** (`RIVER_FORD`). A step onto a carved river's channel costs more for its width, so a road crosses a
  river once, square to it, at its narrowest. Where a road's curve meets a carved river wider than a ford
  (`BRIDGE.fordMax`, 25.6 m), a bridge stands (`src/world/road/roadBridges.js`, `src/world/road/bridgeModels.js`): a
  road's of stone with arches and a parapet, a track's of timber on trestles. Narrower rivers are fords.
- **The edge blend** (`src/world/road/roadEdge.js`, GLSL twin `src/render/roadEdgeGlsl.js`). The paving's hard tile
  line is blended into the ground beside it.

## Rules

- The network is our own (OWN-WORK, the owner); Hazelnut's MIT painter is ported, its notice in `LICENSE`.
- One switch, `Enabled` (on), with `SmoothRoads` (on) and `RiversAndStreams` (off), as the mod ships them
  (`src/systems/modSettings.js` `roads-hazelnut`). Off, the roads stay without rivers, and the maps and journeys do
  not read them. Online the lane forces it, since roads level ground and clear the wild.
- Objects like trees avoid roads and paths (Mac).
- Roads past the Bay follow the landscape, round rivers, shores and tall mountains, with natural curves, and behave as
  roads for the Overworld's pathfinding (KPbICA's spec, forwarded by the owner).
- Road edges are blended and wide rivers bridged, no band aids (the owner).
- A change past the Bay touches no Bay pixel except a crossing's join.

## Daggerfall Unity

Basic Roads is a DFU mod; its painter is ported 1:1. Departures: our own network on the Bay and past it (land law,
drainage, curves, named roads in Cyrodiil), clear roadsides, fords and bridges over carved rivers, and the blended
edge.

## Code and tests

- `src/world/roadsProducer.js`, `src/world/road/` - loader, network, painter, verge, curves, land law, bridges, edge
- `src/world/tamrielRoads.js`, `src/world/arenaRoads.js` - the roads past the Bay
- `test/world/road/roads.test.js`, `roadsParity.test.js`, `roadsReal.test.js` - the network, the painter's parity
- `test/world/road/ownwork2_bayroads.test.js` - the Bay's own network
- `test/world/road/verge1.test.js`, `lptfit.test.js`, `fb1020c_trunkfit.test.js` - clear roadsides
- `test/world/road/voyager1_land.test.js`, `voyager2_curves.test.js`, `voyager_cyrodiil.test.js` - past the Bay
- `test/world/road/river_fords.test.js`, `test/world/road/roadlook.test.js` - fords, bridges, the edge blend

## Open

- No ferry crosses the Niben.
- Places can still be rolled inside carved lakes.
- A bridge is a pixel's static, so the far ring past the built pixels does not draw it.
