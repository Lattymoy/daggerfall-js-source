// Ground plane mesh for an RMB block: 16x16 tile quads at GroundOffset,
// batched into one submesh per texture record. DFU renders this as a single
// quad through a tilemap shader; we emit per-tile quads with the rotate/flip
// applied as UV transforms instead - a renderer-side equivalent producing the
// same picture without a custom atlas pass. Tile size and height come from
// the verbatim layout constants.

import { GROUND_OFFSET, GROUND_TILE_SIZE, GROUND_TILE_DIM } from '../world/rmbLayout.js';
import { GLOBAL_SCALE } from '../world/meshReader.js';

/**
 * Build meshReader-shaped buffers for the ground of one block.
 * @param {Array<Array<{record:number,rotated:boolean,flipped:boolean}>>} tiles
 *   layoutRmbBlock().groundTiles, indexed [y][x].
 * @param {number} groundArchive - climate ground texture archive.
 * @returns same shape as dfMeshToModel output.
 */
export function buildGroundMesh(tiles, groundArchive) {
  const tileSize = GROUND_TILE_SIZE * GLOBAL_SCALE;
  const height = GROUND_OFFSET * GLOBAL_SCALE;
  const quadCount = GROUND_TILE_DIM * GROUND_TILE_DIM;

  const positions = new Float32Array(quadCount * 4 * 3);
  const normals = new Float32Array(quadCount * 4 * 3);
  const uvs = new Float32Array(quadCount * 4 * 2);
  const indices = new Uint32Array(quadCount * 6);

  // Group tiles by record so each record is one submesh (one texture bind).
  const byRecord = new Map();
  for (let y = 0; y < GROUND_TILE_DIM; y++) {
    for (let x = 0; x < GROUND_TILE_DIM; x++) {
      const t = tiles[y][x];
      if (!byRecord.has(t.record)) byRecord.set(t.record, []);
      byRecord.get(t.record).push({ x, y, t });
    }
  }

  const subMeshes = [];
  let v = 0;
  let i = 0;
  for (const [record, list] of [...byRecord.entries()].sort((a, b) => a[0] - b[0])) {
    const startIndex = i;
    for (const { x, y, t } of list) {
      const x0 = x * tileSize;
      const z0 = y * tileSize;
      const x1 = x0 + tileSize;
      const z1 = z0 + tileSize;

      // Base UV corners for verts [(x0,z0),(x0,z1),(x1,z1),(x1,z0)].
      let corners = [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
      ];
      // Rotated: 90 degrees; flipped: mirrored both axes.
      if (t.rotated) corners = corners.map(([u, w]) => [w, 1 - u]);
      if (t.flipped) corners = corners.map(([u, w]) => [1 - u, 1 - w]);

      const base = v;
      const quad = [
        [x0, z0],
        [x0, z1],
        [x1, z1],
        [x1, z0],
      ];
      for (let c = 0; c < 4; c++) {
        positions[v * 3] = quad[c][0];
        positions[v * 3 + 1] = height;
        positions[v * 3 + 2] = quad[c][1];
        normals[v * 3 + 1] = 1;
        uvs[v * 2] = corners[c][0];
        uvs[v * 2 + 1] = corners[c][1];
        v++;
      }
      // Two triangles wound counter-clockwise seen from above (+Y normal):
      // (v1-v0)x(v2-v0) = (0,0,ts)x(ts,0,ts) = (0, ts*ts, 0).
      indices[i++] = base;
      indices[i++] = base + 1;
      indices[i++] = base + 2;
      indices[i++] = base;
      indices[i++] = base + 2;
      indices[i++] = base + 3;
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
