// Terrain ground mesh for one map pixel: 128x128 tile quads draped over
// the heightfield, batched into one submesh per texture record. DFU
// renders this through a Unity terrain + tilemap shader sampling a
// 128x128 index texture; per-tile quads with rotate/flip as UV transforms
// are our renderer-side equivalent, same as groundMesh.js (ledgered
// ground-plane departure). Tile bytes decode exactly like RMB bitfields:
// record = b & 63, rotate = b & 64, flip = b & 128; 0xFF is the
// "explicit record 0" sentinel from SetLocationTiles (water), verbatim
// UpdateTileMapDataJob's convertWater path.

import { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, DEFAULT_TERRAIN_SCALE, TERRAIN_SIZE } from '../world/terrainSampler.js';
import { WORLD_MAP_TILE_DIM } from '../world/terrainTiles.js';

/**
 * Build meshReader-shaped buffers for one pixel's terrain.
 * @param {Uint8Array} tilemapData - 128x128 tile bytes (y * dim + x).
 * @param {Float32Array} heightmapData - generateSamples output
 *   (sample(x, y) = data[x * hDim + y]).
 * @param {number} groundArchive - climate ground texture archive.
 * @returns same shape as dfMeshToModel output.
 */
export function buildTerrainMesh(tilemapData, heightmapData, groundArchive) {
  const tDim = WORLD_MAP_TILE_DIM;
  const hDim = HEIGHTMAP_DIMENSION;
  const tileSize = TERRAIN_SIZE / tDim;
  const worldHeight = MAX_TERRAIN_HEIGHT * DEFAULT_TERRAIN_SCALE;
  const at = (x, y) => heightmapData[x * hDim + y] * worldHeight;

  const quadCount = tDim * tDim;
  const positions = new Float32Array(quadCount * 4 * 3);
  const normals = new Float32Array(quadCount * 4 * 3);
  const uvs = new Float32Array(quadCount * 4 * 2);
  const indices = new Uint32Array(quadCount * 6);

  // Group tiles by record so each record is one submesh.
  const byRecord = new Map();
  for (let y = 0; y < tDim; y++) {
    for (let x = 0; x < tDim; x++) {
      const b = tilemapData[y * tDim + x];
      const record = b === 0xff ? 0 : b & 63;
      const rotated = b !== 0xff && (b & 64) !== 0;
      const flipped = b !== 0xff && (b & 128) !== 0;
      if (!byRecord.has(record)) byRecord.set(record, []);
      byRecord.get(record).push({ x, y, rotated, flipped });
    }
  }

  const normalAt = (x, y) => {
    const hl = at(Math.max(0, x - 1), y);
    const hr = at(Math.min(hDim - 1, x + 1), y);
    const hd = at(x, Math.max(0, y - 1));
    const hu = at(x, Math.min(hDim - 1, y + 1));
    const nx = hl - hr, ny = 2 * tileSize, nz = hd - hu;
    const nl = Math.hypot(nx, ny, nz) || 1;
    return [nx / nl, ny / nl, nz / nl];
  };

  const subMeshes = [];
  let v = 0;
  let i = 0;
  for (const [record, list] of [...byRecord.entries()].sort((a, b) => a[0] - b[0])) {
    const startIndex = i;
    for (const { x, y, rotated, flipped } of list) {
      let corners = [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
      ];
      if (rotated) corners = corners.map(([u, w]) => [w, 1 - u]);
      if (flipped) corners = corners.map(([u, w]) => [1 - u, 1 - w]);
      const quad = [
        [x, y],
        [x, y + 1],
        [x + 1, y + 1],
        [x + 1, y],
      ];
      const base = v;
      for (let c = 0; c < 4; c++) {
        const [gx, gy] = quad[c];
        const o = v * 3;
        positions[o] = gx * tileSize;
        positions[o + 1] = at(gx, gy);
        positions[o + 2] = gy * tileSize;
        const n = normalAt(gx, gy);
        normals[o] = n[0]; normals[o + 1] = n[1]; normals[o + 2] = n[2];
        uvs[v * 2] = corners[c][0];
        uvs[v * 2 + 1] = corners[c][1];
        v++;
      }
      indices[i++] = base; indices[i++] = base + 1; indices[i++] = base + 2;
      indices[i++] = base; indices[i++] = base + 2; indices[i++] = base + 3;
    }
    subMeshes.push({
      textureArchive: groundArchive,
      textureRecord: record,
      startIndex,
      primitiveCount: (i - startIndex) / 3,
    });
  }

  return { positions, normals, uvs, indices, subMeshes };
}
