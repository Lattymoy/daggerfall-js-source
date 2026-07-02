// Terrain surface data for the tilemap-shader pass (Rendering-Arc R9):
// one 129x129 height grid per map pixel plus a 128x128 tilemap byte
// texture, sampled by the renderer's terrain program exactly like
// Daggerfall Unity's shipped Daggerfall/TilemapTextureArray shader.
// Verbatim pieces:
//   - convertTilemap is TerrainHelper.UpdateTileMapDataJob 1:1: the RMB
//     tile byte [flip, rotate, 6-bit record] becomes
//     [6-bit record << 2 | rotate | flip << 1] ((byte)(tile * 4) + bits),
//     and the 0xFF water sentinel converts back to record 0
//     (ConvertWaterTiles defaults true).
//   - The shader-side decode (renderer TERRAIN_FS) is the verbatim
//     tileIndex = data >> 2, transform = data & 3, with the shader's
//     four rotation matrices and translations - the shipped DFU shader
//     treats the flip bit as a 180-degree rotation (transform 2) and
//     rotate+flip as 270 degrees; kept as-written.
// Heights and normals mirror the retired per-tile-quad path exactly:
// corner (x, z) samples heightmapData[x * hDim + z] * MAX_TERRAIN_HEIGHT
// * DEFAULT_TERRAIN_SCALE, normals by clamped central differences.

import {
  HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, DEFAULT_TERRAIN_SCALE, TERRAIN_SIZE,
} from './terrainSampler.js';
import { WORLD_MAP_TILE_DIM } from './terrainTiles.js';

/** Verbatim UpdateTileMapDataJob byte conversion. */
export function convertTilemap(tilemapData) {
  const out = new Uint8Array(tilemapData.length);
  for (let i = 0; i < tilemapData.length; i++) {
    const tile = tilemapData[i];
    if (tile === 0xff) {
      out[i] = 0; // convertWater: FF sentinel back to record 0
      continue;
    }
    let record = (tile * 4) & 0xff;
    if ((tile & 64) !== 0) record += 1;
    if ((tile & 128) !== 0) record += 2;
    out[i] = record;
  }
  return out;
}

/**
 * Build the height grid for one pixel: positions + normals over the
 * 129x129 samples, pixel-local frame (x/z in [0, 819.2]).
 * @param {Float32Array} heightmapData - sample(x, z) = data[x*hDim+z].
 * @returns {{positions: Float32Array, normals: Float32Array}}
 */
export function buildTerrainGrid(heightmapData) {
  const hDim = HEIGHTMAP_DIMENSION;
  const cell = TERRAIN_SIZE / (hDim - 1);
  const worldHeight = MAX_TERRAIN_HEIGHT * DEFAULT_TERRAIN_SCALE;
  const at = (x, z) => heightmapData[x * hDim + z] * worldHeight;

  const positions = new Float32Array(hDim * hDim * 3);
  const normals = new Float32Array(hDim * hDim * 3);
  let o = 0;
  for (let z = 0; z < hDim; z++) {
    for (let x = 0; x < hDim; x++) {
      positions[o] = x * cell;
      positions[o + 1] = at(x, z);
      positions[o + 2] = z * cell;
      const hl = at(Math.max(0, x - 1), z);
      const hr = at(Math.min(hDim - 1, x + 1), z);
      const hd = at(x, Math.max(0, z - 1));
      const hu = at(x, Math.min(hDim - 1, z + 1));
      const nx = hl - hr;
      const nz = hd - hu;
      const ny = 2 * cell;
      const l = Math.hypot(nx, ny, nz);
      normals[o] = nx / l;
      normals[o + 1] = ny / l;
      normals[o + 2] = nz / l;
      o += 3;
    }
  }
  return { positions, normals };
}

/** Shared triangle indices for the 129x129 grid (row-major x-fastest). */
export function buildTerrainIndices() {
  const hDim = HEIGHTMAP_DIMENSION;
  const q = hDim - 1;
  const indices = new Uint32Array(q * q * 6);
  let o = 0;
  for (let z = 0; z < q; z++) {
    for (let x = 0; x < q; x++) {
      const i0 = z * hDim + x;
      const i1 = i0 + 1;
      const i2 = i0 + hDim;
      const i3 = i2 + 1;
      // Diagonal from (x, z) to (x+1, z+1), matching the retired quad
      // tessellation exactly (same triangles, same winding).
      indices[o++] = i0; indices[o++] = i2; indices[o++] = i3;
      indices[o++] = i0; indices[o++] = i3; indices[o++] = i1;
    }
  }
  return indices;
}

export const TERRAIN_TILE_DIM = WORLD_MAP_TILE_DIM;
