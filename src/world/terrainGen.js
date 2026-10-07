// ═══════════════════════════════════════════════════════════════════
// EV7 — THE PIXEL KERNEL, one pure function. buildPixel's CPU-heavy
// prologue ran ~84,000 perlinNoise calls per map pixel (33k in
// generateSamples, up to 50k in generateTileData - the tile
// classifier out-costs the heightmap itself) plus ~166k cubic
// interpolations and 16k atans in layoutNature, all inside ONE task:
// every await in buildPixel is a cache-warm microtask, so the whole
// body landed on the frame the pixel was enqueued - the map-pixel
// crossing hitch. This module is that prologue factored out VERBATIM,
// in the exact inline order, so it can run on a Worker (terrainGenClient
// / terrainGenWorker) or on this thread (the fallback IS the old path,
// not a failure - the RA1 road-bake law).
//
// The inputs are the postMessage-safe half of buildPixel's world:
// `woods` is any object answering the sampler's three-method surface
// (getHeightMapValuesRange1Dim / getLargeHeightMapValuesRange /
// getHeightMapValue - the worker owns its own WoodsFile from a copied
// byte buffer), and the LOCATION half stays with the caller:
// setLocationTiles needs BlocksFile+MapsFile, which are file objects
// that do not cross a postMessage boundary, so the caller runs it
// first and its tilemap + rect ride INTO the job as plain data.
// ═══════════════════════════════════════════════════════════════════

import { generateSamples, ghostSampler, HEIGHTMAP_DIMENSION } from './terrainSampler.js';
import { buildTerrainGrid, convertTilemap } from './terrainSurface.js';
import { assignTiles, blendLocationTerrain, calcAvgMaxHeight, generateTileData } from './terrainTiles.js';
import { layoutNature } from './terrainNature.js';
import { paintRoads, smoothRoadHeights, pathCorners } from './roadPainter.js';
import { MAP_W } from './roadNetwork.js';
import { applyPicks } from './wodLocationLoader.js';   // WOD2: World of Daggerfall's smoothing arms
import { createLandforms } from './landforms.js';   // LANDFORM1-3: the port's own terrain, inside the kernel

/**
 * The whole CPU side of one streamed pixel, in buildPixel's own order:
 * samples -> (location: avg + blend, over the PRE-SEEDED tilemap the
 * caller's setLocationTiles wrote) -> tileData/assignTiles -> the
 * grid with its ghost-row edge normals (EV4) and far-ring stride ->
 * the converted tilemap bytes -> the nature layout.
 *
 * @param {object} job
 * @param {object} job.woods - the sampler's three-method surface.
 * @param {number} job.px
 * @param {number} job.py
 * @param {number} [job.stride] - 1 or the EV4 far-ring stride.
 * @param {Uint8Array} job.tilemap - 128x128, location tiles already
 *   set by the caller when the pixel carries one; mutated here.
 * @param {?object} job.locationRect - setLocationTiles' answer.
 * @param {boolean} job.hasLocation
 * @param {number} job.climateType - the pixel's climate, for nature.
 * @param {?{picks:Array<{flatten:boolean, rect:object}>}} [job.wod] -
 *   WOD2: the World of Daggerfall instances the main thread's
 *   pickLocations placed on this pixel, in order; null with the mod off.
 * @param {?{archive:number, hidden:boolean}} [job.forests] - FOREST1: the
 *   Real forests switch (null off, DFU's scatter): the climate's summer
 *   nature archive, and whether the pixel's location is a place the woods
 *   hide (a dungeon, a shrine) rather than one they draw back from (a town).
 * @param {boolean} [job.landform] - LANDFORM1-3: the Landforms row (off,
 *   DFU's kernel): the relief, and the paths cut into the land with this
 *   kernel's own network - its rivers where they are painted.
 * @returns {{samples: Float32Array, tilemap: Uint8Array,
 *   positions: Float32Array, normals: Float32Array,
 *   tilemapBytes: Uint8Array, avg: number, paths: ?Uint8Array,
 *   nature: Array<{record:number,x:number,y:number,z:number}>}}
 */
export function generatePixelTerrain({ woods, px, py, stride = 1, tilemap, locationRect = null, hasLocation = false, climateType, roads = null, wod = null, forests = null, landform = false }) {
  // LANDFORM1-3: built from the network THIS kernel holds - the one the painter below paints - so the cut and the paint
  // are the same roads; restrideGrid's ghost rows take the same landforms, so the edge normals read the shaped ground.
  const landforms = landform ? createLandforms({ woods, roads }) : null;
  // AUDIT LANDFORMS D3: THE LANDFORMS MOVE THE GROUND, NEVER A TILE. A location's blend pulls its whole pixel toward the
  // pixel's mean, and the landforms move that mean (a road's bed and a river's channel by centimetres, a massif in the
  // pixel by up to 268 m - Chesterbrugh), so a beach sample the classifier read on the shaped blend crossed the beach
  // line where DFU's did not: 359 tiles in 97 of the 314 coastal location pixels on the real data turned between sand
  // and land. The tiles are classified on DFU's own samples through DFU's own blend - written in the same pass - and
  // where they part from the shaped ground they part by at most 2.2 m (the Dunynak Excavation, 313 under 10 cm).
  const classic = landforms && hasLocation ? new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION) : null;
  const samples = generateSamples(woods, px, py, HEIGHTMAP_DIMENSION, landforms, classic);
  let avg = 0;
  if (hasLocation) {
    [avg] = calcAvgMaxHeight(samples);
    blendLocationTerrain(samples, avg, locationRect);
    if (classic) blendLocationTerrain(classic, calcAvgMaxHeight(classic)[0], locationRect);
  }
  // ROADS 2: the one seam. Ground classified, squares not yet run, so a
  // road tile lands over a known ground type and the marching squares
  // blend around it. `roads` is null in a solo build with no network
  // loaded and the pipeline is then byte-for-byte what it was.
  const tileData = generateTileData(classic ?? samples, px, py);
  // GRASS-PATH1: the painter's own record of which tiles it wrote, so
  // the grass placer can keep off a path it cannot name by record.
  let paths = null;
  if (roads) {
    paths = new Uint8Array(tilemap.length);
    const i = py * MAP_W + px;
    // ROADS 23: the mod's corners - a neighbour's diagonal brushes this
    // pixel's corner tile - and its water, off unless the network says.
    const c = (m) => (m ? pathCorners(m, px, py, MAP_W) : 0);
    paintRoads(tileData, tilemap, roads.roads[i], roads.tracks[i], hasLocation ? locationRect : null, 129, {
      river: roads.rivers ? roads.rivers[i] : 0, stream: roads.streams ? roads.streams[i] : 0, water: !!roads.water,
      corners: { road: c(roads.roads), track: c(roads.tracks), river: c(roads.rivers), stream: c(roads.streams) },
      paths,   // GRASS-PATH1
    });
    // ROADS 10: the ground under the road is smoothed - after the paint,
    // before the grid is built from the samples. The network carries the
    // switch (`smooth`, default on, the design's SmoothRoads) so the
    // worker needs no settings access.
    if (roads.smooth !== false) smoothRoadHeights(samples, tilemap, 129, hasLocation ? locationRect : null);   // AUDIT 51: the mod skips the rect
  }
  assignTiles(tileData, tilemap, true);
  // WOD2: World of Daggerfall's "Smooth the terrain" arms
  // (LocationLoader.cs:174-230). The mod runs on
  // DaggerfallTerrain.OnPromoteTerrainData, which DFU raises AFTER the
  // tiles are assigned (CompleteMapPixelDataUpdate) and the heights are
  // pushed, and BEFORE the streamer lays the nature out - so here: the
  // tiles keep the unflattened slope's pattern, and the grid, the
  // collision floor and the nature below all read the levelled ground.
  // The averages ride back for the objects' height (:238); a pixel with
  // a real location starts from its own mean (MapData.averageHeight is
  // only ever computed there), every other from 0.
  const wodResult = wod && wod.picks.length ? applyPicks(samples, wod.picks, hasLocation ? avg : 0) : null;
  const grid = restrideGrid({ woods, px, py, stride, samples, landforms });   // PERF-EXT26: the one grid law, the restride's too
  const tilemapBytes = convertTilemap(tilemap);
  const nature = layoutNature(samples, tilemap, {
    mapPixelX: px,
    mapPixelY: py,
    rawWorldHeight: woods.getHeightMapValue(px, py),
    climateType,
    // WOD2: the loader SETS MapData.locationRect to its site (:179/:208),
    // and the nature layout reads that field - so the trees keep their
    // clearance off a camp exactly as they keep it off a town.
    locationRect: wodResult?.locationRect ?? locationRect,
    // FOREST1: the places the woods close round or draw back from - the
    // location (hidden or not, as the caller says) and every World of
    // Daggerfall SITE (the loader's rect is only the last), each its whole
    // footprint; never a rock field or a mountain (AUDIT FOREST1 F1: the
    // caller marks them `hide: false` and they are no place). And the road
    // painter's own track mask, which a forest keeps off (AUDIT FOREST1 F8).
    forests: forests ? {
      archive: forests.archive,
      pois: [
        ...(hasLocation && locationRect ? [{ ...locationRect, hide: !!forests.hidden }] : []),
        ...(wod?.picks ?? []).filter((p) => p.hide !== false).map(({ rect: r, bounds: b }) => (b
          ? { xMin: b.xMin, xMax: b.xMax, yMin: b.yMin, yMax: b.yMax, hide: true }
          : { xMin: r.x, xMax: r.x + r.width, yMin: r.y, yMax: r.y + r.height, hide: true })),
      ],
      paths,
    } : null,
  });
  return { samples, tilemap, positions: grid.positions, normals: grid.normals, tilemapBytes, avg, nature,
    paths,   // GRASS-PATH1: null when no network was present, as `withRoads` says
    // ROADS 25: whether a network was PRESENT when this pixel was painted.
    // The network loads asynchronously and the world starts building at
    // once, so the first pixels can be painted with none - and were then
    // kept, roadless, while the map (rebuilt on arrival) showed the roads.
    withRoads: !!roads,
    wodAverages: wodResult ? wodResult.averages : null,   // WOD2: per pick, the normalized average its objects stand on
  };
}

/**
 * PERF-EXT26 (2026-09-25, the players: "fps issues in the exterior but
 * fine in the interior", "me too my friend.. don't know why. I got a
 * RX6600"): A PIXEL'S GRID AT A STRIDE, from its samples as the pixel
 * keeps them (post-blend, post-smoothing) and the ghost rows off the woods
 * for its edge normals (EV4). The build above, the world host's ring-class
 * swap (STREAM1's restride) and the terrain worker's `grid` job all run
 * this one law, so a promotion built on the worker is the bytes one built
 * on the main thread is, by construction.
 * LANDFORM1-3: the ghost rows are the neighbours' SHAPED ground - `landforms` when the caller holds them (the build
 * above), else made here from `landform` and the network (a promotion: the host's job, the worker's own network).
 * @param {{ woods: object, px: number, py: number, stride?: number, samples: Float32Array, landform?: boolean, roads?: ?object, landforms?: ?object }} job
 * @returns {{ positions: Float32Array, normals: Float32Array }}
 */
export function restrideGrid({ woods, px, py, stride = 1, samples, landform = false, roads = null, landforms = null }) {
  const lf = landforms ?? (landform ? createLandforms({ woods, roads }) : null);
  return buildTerrainGrid(samples, stride, ghostSampler(woods, px, py, HEIGHTMAP_DIMENSION, lf));
}
