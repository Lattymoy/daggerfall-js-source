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

import { generateSamples, ghostSampler } from './terrainSampler.js';
import { buildTerrainGrid, convertTilemap } from './terrainSurface.js';
import { assignTiles, blendLocationTerrain, calcAvgMaxHeight, generateTileData } from './terrainTiles.js';
import { layoutNature } from './terrainNature.js';
import { paintRoads, smoothRoadHeights, pathCorners } from './roadPainter.js';
import { MAP_W } from './roadNetwork.js';

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
 * @returns {{samples: Float32Array, tilemap: Uint8Array,
 *   positions: Float32Array, normals: Float32Array,
 *   tilemapBytes: Uint8Array, avg: number,
 *   nature: Array<{record:number,x:number,y:number,z:number}>}}
 */
export function generatePixelTerrain({ woods, px, py, stride = 1, tilemap, locationRect = null, hasLocation = false, climateType, roads = null }) {
  const samples = generateSamples(woods, px, py);
  let avg = 0;
  if (hasLocation) {
    [avg] = calcAvgMaxHeight(samples);
    blendLocationTerrain(samples, avg, locationRect);
  }
  // ROADS 2: the one seam. Ground classified, squares not yet run, so a
  // road tile lands over a known ground type and the marching squares
  // blend around it. `roads` is null in a solo build with no network
  // loaded and the pipeline is then byte-for-byte what it was.
  const tileData = generateTileData(samples, px, py);
  if (roads) {
    const i = py * MAP_W + px;
    // ROADS 23: the mod's corners - a neighbour's diagonal brushes this
    // pixel's corner tile - and its water, off unless the network says.
    const c = (m) => (m ? pathCorners(m, px, py, MAP_W) : 0);
    paintRoads(tileData, tilemap, roads.roads[i], roads.tracks[i], hasLocation ? locationRect : null, 129, {
      river: roads.rivers ? roads.rivers[i] : 0, stream: roads.streams ? roads.streams[i] : 0, water: !!roads.water,
      corners: { road: c(roads.roads), track: c(roads.tracks), river: c(roads.rivers), stream: c(roads.streams) },
    });
    // ROADS 10: the ground under the road is smoothed - after the paint,
    // before the grid is built from the samples. The network carries the
    // switch (`smooth`, default on, the design's SmoothRoads) so the
    // worker needs no settings access.
    if (roads.smooth !== false) smoothRoadHeights(samples, tilemap, 129, hasLocation ? locationRect : null);   // AUDIT 51: the mod skips the rect
  }
  assignTiles(tileData, tilemap, true);
  const grid = buildTerrainGrid(samples, stride, ghostSampler(woods, px, py));
  const tilemapBytes = convertTilemap(tilemap);
  const nature = layoutNature(samples, tilemap, {
    mapPixelX: px,
    mapPixelY: py,
    rawWorldHeight: woods.getHeightMapValue(px, py),
    climateType,
    locationRect,
  });
  return { samples, tilemap, positions: grid.positions, normals: grid.normals, tilemapBytes, avg, nature,
    // ROADS 25: whether a network was PRESENT when this pixel was painted.
    // The network loads asynchronously and the world starts building at
    // once, so the first pixels can be painted with none - and were then
    // kept, roadless, while the map (rebuilt on arrival) showed the roads.
    withRoads: !!roads,
  };
}
