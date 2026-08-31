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
export function generatePixelTerrain({ woods, px, py, stride = 1, tilemap, locationRect = null, hasLocation = false, climateType }) {
  const samples = generateSamples(woods, px, py);
  let avg = 0;
  if (hasLocation) {
    [avg] = calcAvgMaxHeight(samples);
    blendLocationTerrain(samples, avg, locationRect);
  }
  assignTiles(generateTileData(samples, px, py), tilemap, true);
  const grid = buildTerrainGrid(samples, stride, ghostSampler(woods, px, py));
  const tilemapBytes = convertTilemap(tilemap);
  const nature = layoutNature(samples, tilemap, {
    mapPixelX: px,
    mapPixelY: py,
    rawWorldHeight: woods.getHeightMapValue(px, py),
    climateType,
    locationRect,
  });
  return { samples, tilemap, positions: grid.positions, normals: grid.normals, tilemapBytes, avg, nature };
}
