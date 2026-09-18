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

/** Verbatim UpdateTileMapDataJob byte conversion, for ONE tile - the
 *  one home, because FD1 needed the same conversion per-tile off the
 *  render path and a second copy of this is exactly how the water
 *  sentinel would come to be handled in one place and not the other. */
export function convertTile(tile) {
  if (tile === 0xff) return 0;   // convertWater: FF sentinel back to record 0
  let record = (tile * 4) & 0xff;
  if ((tile & 64) !== 0) record += 1;
  if ((tile & 128) !== 0) record += 2;
  return record;
}

/** Verbatim UpdateTileMapDataJob byte conversion. */
export function convertTilemap(tilemapData) {
  const out = new Uint8Array(tilemapData.length);
  for (let i = 0; i < tilemapData.length; i++) out[i] = convertTile(tilemapData[i]);
  return out;
}

/** FD1 - StreamingWorld.PlayerTileMapIndex (StreamingWorld.cs:345):
 *  `playerTerrain.TileMap[...].r / 4`, where `.r` is what the job
 *  above writes. So the index is the CONVERTED byte >> 2, which is:
 *
 *    - 0 for the 0xFF location-zero sentinel, because convertWater
 *      restores it to record 0 - and record 0 IS water. A town ground
 *      tile that happened to encode as zero therefore reads as WATER
 *      to every consumer of this index. That is DFU's behaviour, kept.
 *    - `tile & 0x3f` otherwise: (tile * 4) & 0xff is (tile & 0x3f) * 4,
 *      and the rotate/flip addends are both under 4, so the divide
 *      drops them. The port's `recordOf` masks for the same reason.
 *
 *  `null` is the port's "no built terrain under the player", which is
 *  DFU's -1 (UpdatePlayerTerrainTileIndex:321 sets it before any
 *  lookup and returns early off-terrain). -1 is not 0, so every
 *  consumer that tests for water gets FALSE indoors and underground -
 *  which is why this needs no interior arm. */
export const playerTileMapIndex = (rawTile) => (rawTile == null ? -1 : convertTile(rawTile) >> 2);

/** DFU's terrain tile record 0. StreamingWorld's own doc comment
 *  lists it: "0 = Water, 1 = Dirt, 2 = Grass, 3 = Stone" (:175-178). */
export const WATER_TILE_INDEX = 0;

/** AcrobatMotor.CheckFallingDamage:213 - "don't take damage if
 *  landing in outdoor water". Answers false for a null tile, as -1
 *  does in C#. */
export const isOutdoorWaterTile = (rawTile) => playerTileMapIndex(rawTile) === WATER_TILE_INDEX;

/** EV4: how far the LOD skirt drops below the edge vertices. The
 *  stride-4 far ring chords the height curve, so where it abuts a
 *  full-res pixel the two edge polylines differ by the chord error - a
 *  T-junction crack straight through to the sky. The skirt is the
 *  standard fix: the perimeter extruded down and stitched, deep enough
 *  to swallow the worst chord over four 6.4-unit cells. */
export const TERRAIN_SKIRT_DEPTH = 40;

/**
 * GRASS3 (2026-09-18): THE HEIGHT OF THE SURFACE THAT IS ACTUALLY DRAWN,
 * at any point inside a pixel - pixel-local x/z, the same frame
 * `buildTerrainGrid` builds in.
 *
 * WHY THIS IS NOT BILINEAR, which is the whole point of it. The terrain
 * is TRIANGLES: `buildTerrainIndices` cuts every quad on the diagonal
 * from (x, z) to (x+1, z+1) and emits i0,i2,i3 then i0,i3,i1. Inside a
 * quad the drawn surface is therefore two PLANES, and a bilinear patch
 * is a different surface that agrees with it only on the diagonal and
 * at the corners. Anything placed by bilinear sits off the ground it is
 * supposed to stand on, by up to a quarter of the quad's saddle term.
 *
 * `scenes/world.js`'s grass placer did exactly that. HOW MUCH IT
 * MATTERED, measured honestly and corrected once (tools/grassHeightProbe
 * .mjs): across real terrain grades - 7% to 75% - the two surfaces are
 * between 0.003 and 0.08 world units apart, against a blade 0.25 to
 * 0.72 tall. NO blade is off by even a sixth of its height. A first
 * reading of this claimed 41% of blades floated on "hilly" ground and
 * 74% in "mountains"; that synthetic terrain turned out to be a 311%
 * grade - a cliff, not a landscape - and the real answer is that
 * nobody would ever have seen this.
 *
 * So this is a CORRECTNESS fix, not a visible one, and it is worth
 * making for two reasons that do not depend on the size of the error:
 * a placer should ask the surface where the surface is rather than
 * approximate it, and this is the exact law a GPU-placed field has to
 * run in its vertex shader - where it stops being free, because a
 * derived blade has no baked height to fall back on.
 *
 * The same law is what a GPU placer has to run, because a blade derived
 * in a vertex shader must land on the surface the fragment shader is
 * drawing. Kept here, beside the grid and the indices it has to agree
 * with, so there is ONE place that knows how the ground is cut.
 *
 * `stride` matches the ring class: the far ring's mesh is coarser, so
 * its drawn surface is coarser too, and asking this for a stride-1
 * height over stride-4 ground would float just as badly.
 *
 * @param {Float32Array} heightmapData sample(x, z) = data[x*hDim+z], normalized
 * @param {number} lx pixel-local x, 0..TERRAIN_SIZE
 * @param {number} lz pixel-local z, 0..TERRAIN_SIZE
 * @param {number} [stride] the ring class this pixel is drawn at
 * @returns {number} world height, MAX_TERRAIN_HEIGHT * DEFAULT_TERRAIN_SCALE applied
 */
export function surfaceHeightAt(heightmapData, lx, lz, stride = 1) {
  const hDim = HEIGHTMAP_DIMENSION;
  const worldHeight = MAX_TERRAIN_HEIGHT * DEFAULT_TERRAIN_SCALE;
  const quad = (TERRAIN_SIZE / (hDim - 1)) * stride;
  const last = (hDim - 1) / stride - 1;        // the last quad's index
  const at = (x, z) => heightmapData[Math.max(0, Math.min(hDim - 1, x)) * hDim
    + Math.max(0, Math.min(hDim - 1, z))];
  const qx = Math.max(0, Math.min(last, Math.floor(lx / quad)));
  const qz = Math.max(0, Math.min(last, Math.floor(lz / quad)));
  const ax = lx / quad - qx, az = lz / quad - qz;
  const x0 = qx * stride, z0 = qz * stride, x1 = x0 + stride, z1 = z0 + stride;
  const h00 = at(x0, z0), h10 = at(x1, z0), h01 = at(x0, z1), h11 = at(x1, z1);
  // the diagonal runs (x,z)-(x+1,z+1): az >= ax is the i0,i2,i3 half
  const h = az >= ax
    ? h00 + az * (h01 - h00) + ax * (h11 - h01)
    : h00 + ax * (h10 - h00) + az * (h11 - h10);
  return h * worldHeight;
}

/**
 * Build the height grid for one pixel: positions + normals over the
 * 129x129 samples, pixel-local frame (x/z in [0, 819.2]).
 *
 * EV4 grew two optional arms, both default-off so the classic path is
 * byte-identical:
 *  - `stride` builds every stride-th sample (stride 4 = a 33x33 grid,
 *    a 16x triangle cut for the streamed world's far ring), plus a
 *    perimeter SKIRT (see TERRAIN_SKIRT_DEPTH) appended after the
 *    grid vertices, edge normals copied so lighting stays continuous.
 *  - `ghost` answers out-of-range sample coordinates (the neighbor
 *    pixel's rows, NORMALIZED like heightmapData) so edge normals are
 *    true central differences instead of one-sided ones - without it
 *    every 819.2-unit chunk seam carries a permanent lighting lattice.
 * @param {Float32Array} heightmapData - sample(x, z) = data[x*hDim+z].
 * @param {number} [stride]
 * @param {(x: number, z: number) => number} [ghost]
 * @returns {{positions: Float32Array, normals: Float32Array}}
 */
export function buildTerrainGrid(heightmapData, stride = 1, ghost = null) {
  const hDim = HEIGHTMAP_DIMENSION;
  const cell = TERRAIN_SIZE / (hDim - 1);
  const worldHeight = MAX_TERRAIN_HEIGHT * DEFAULT_TERRAIN_SCALE;
  const at = (x, z) => {
    if (ghost && (x < 0 || x >= hDim || z < 0 || z >= hDim)) return ghost(x, z) * worldHeight;
    return heightmapData[Math.max(0, Math.min(hDim - 1, x)) * hDim
      + Math.max(0, Math.min(hDim - 1, z))] * worldHeight;
  };

  const g = (hDim - 1) / stride + 1;   // vertices per side
  const skirt = stride > 1 ? g * 4 : 0;
  const positions = new Float32Array((g * g + skirt) * 3);
  const normals = new Float32Array((g * g + skirt) * 3);
  let o = 0;
  for (let zi = 0; zi < g; zi++) {
    for (let xi = 0; xi < g; xi++) {
      const x = xi * stride, z = zi * stride;
      positions[o] = x * cell;
      positions[o + 1] = at(x, z);
      positions[o + 2] = z * cell;
      // Central differences at the stride's own span; without a ghost
      // the edge falls back to the old clamped one-sided form.
      const hl = at(x - stride, z);
      const hr = at(x + stride, z);
      const hd = at(x, z - stride);
      const hu = at(x, z + stride);
      const nx = hl - hr;
      const nz = hd - hu;
      const ny = 2 * cell * stride;
      const l = Math.hypot(nx, ny, nz);
      normals[o] = nx / l;
      normals[o + 1] = ny / l;
      normals[o + 2] = nz / l;
      o += 3;
    }
  }
  if (skirt) {
    // Perimeter order matches buildTerrainIndices' skirt walk: south
    // row (zi=0), north row (zi=g-1), west column (xi=0), east column
    // (xi=g-1) - corners appear twice, which costs four vertices and
    // saves every consumer a special case.
    const edges = [
      (i) => i,                 // south: vertex (i, 0)
      (i) => (g - 1) * g + i,   // north: vertex (i, g-1)
      (i) => i * g,             // west:  vertex (0, i)
      (i) => i * g + (g - 1),   // east:  vertex (g-1, i)
    ];
    for (const edge of edges) {
      for (let i = 0; i < g; i++) {
        const src = edge(i) * 3;
        positions[o] = positions[src];
        positions[o + 1] = positions[src + 1] - TERRAIN_SKIRT_DEPTH;
        positions[o + 2] = positions[src + 2];
        normals[o] = normals[src];
        normals[o + 1] = normals[src + 1];
        normals[o + 2] = normals[src + 2];
        o += 3;
      }
    }
  }
  return { positions, normals };
}

/** Shared triangle indices for the 129x129 grid (row-major x-fastest).
 *  EV4: `stride` > 1 indexes the matching strided grid and stitches
 *  its skirt - both windings on the skirt quads, so the curtain shows
 *  whichever way the crack is looked through. */
export function buildTerrainIndices(stride = 1) {
  const hDim = HEIGHTMAP_DIMENSION;
  const g = (hDim - 1) / stride + 1;
  const q = g - 1;
  const skirtQuads = stride > 1 ? q * 4 : 0;
  const indices = new Uint32Array(q * q * 6 + skirtQuads * 12);
  let o = 0;
  for (let z = 0; z < q; z++) {
    for (let x = 0; x < q; x++) {
      const i0 = z * g + x;
      const i1 = i0 + 1;
      const i2 = i0 + g;
      const i3 = i2 + 1;
      // Diagonal from (x, z) to (x+1, z+1), matching the retired quad
      // tessellation exactly (same triangles, same winding).
      indices[o++] = i0; indices[o++] = i2; indices[o++] = i3;
      indices[o++] = i0; indices[o++] = i3; indices[o++] = i1;
    }
  }
  if (skirtQuads) {
    const edges = [
      (i) => i,                 // south row, skirt copies at g*g + 0*g
      (i) => (g - 1) * g + i,   // north row, skirt at g*g + 1*g
      (i) => i * g,             // west column, skirt at g*g + 2*g
      (i) => i * g + (g - 1),   // east column, skirt at g*g + 3*g
    ];
    for (let e = 0; e < 4; e++) {
      const edge = edges[e];
      const base = g * g + e * g;
      for (let i = 0; i < q; i++) {
        const t0 = edge(i), t1 = edge(i + 1);
        const b0 = base + i, b1 = base + i + 1;
        indices[o++] = t0; indices[o++] = b0; indices[o++] = b1;
        indices[o++] = t0; indices[o++] = b1; indices[o++] = t1;
        indices[o++] = t0; indices[o++] = b1; indices[o++] = b0;
        indices[o++] = t0; indices[o++] = t1; indices[o++] = b1;
      }
    }
  }
  return indices;
}

export const TERRAIN_TILE_DIM = WORLD_MAP_TILE_DIM;
