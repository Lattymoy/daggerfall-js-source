// ═══════════════════════════════════════════════════════════════════
// DW-B: DeepWaterTerrainCapRenderer.cs (Iliac Puddle No More 1.2.2,
// jet082) - what happens to a pixel's own ground once the sea under it
// is carved:
//
//   A PURE-OCEAN pixel (the bake's cells all sea, none land, every
//   height on the sea) is not drawn at all - Unity's
//   `terrain.drawHeightmap = false`; the floor and the surface are all
//   there is.
//
//   Otherwise, on a pixel whose MapData has water, the tilemap texture is
//   PATCHED: a water tile (records 0, 5, 6, 7, 48) whose tile-cell corners
//   all sit on the sea is CLIPPED - its texels discarded, the hole the
//   floor is seen through - and a water tile that stands ABOVE the sea is
//   REPAINTED with the nearest non-water texel within eight tiles, so the
//   classic flat water cap never shows at a height the sea is not.
//
// The mod marks a clipped texel (255, 0, 255, 0) in the Color32 tilemap
// its clip shader reads. The port's tilemap texture is one R8UI byte a
// tile (DFU's converted record << 2 | rotate | flip << 1, which never
// reaches 255 - the tileset has 56 records), so the mark is the byte 255:
// CLIP_SENTINEL, which every terrain program discards (renderer.js,
// enhancedLighting.js, shadowPass.js).
// ═══════════════════════════════════════════════════════════════════

import { HEIGHTMAP_DIMENSION } from './terrainSampler.js';
import { WORLD_MAP_TILE_DIM } from './terrainTiles.js';
import { heightSample, mapDataHasWater, mapDataFullySubmerged, DW_WATER_THRESHOLD } from './deepWaterClassification.js';

const f32 = Math.fround;
const clampInt = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** The byte a clipped texel carries in the port's R8UI tilemap. */
export const CLIP_SENTINEL = 255;

/** IsClippedWaterTileData, for the texture-array encoding (record = byte >> 2). */
export function isClippedWaterTileData(tileData) {
  const n = tileData >> 2;
  return n === 0 || n === 5 || n === 6 || n === 7 || n === 48;
}

/** IsPromotedTerrainTexelSafeToClip: every heightmap sample the texel spans sits on the sea. */
export function isPromotedTerrainTexelSafeToClip(mapData, texelX, texelZ, texelDim = WORLD_MAP_TILE_DIM) {
  if (!mapData || !mapData.samples || texelDim <= 0) return true;
  const num = DW_WATER_THRESHOLD;
  const length = HEIGHTMAP_DIMENSION, length2 = HEIGHTMAP_DIMENSION;
  const num2 = clampInt(Math.floor(f32(f32(texelX * (length2 - 1)) / texelDim)), 0, length2 - 1);
  const num3 = clampInt(Math.ceil(f32(f32((texelX + 1) * (length2 - 1)) / texelDim)), 0, length2 - 1);
  const num4 = clampInt(Math.floor(f32(f32(texelZ * (length - 1)) / texelDim)), 0, length - 1);
  const num5 = clampInt(Math.ceil(f32(f32((texelZ + 1) * (length - 1)) / texelDim)), 0, length - 1);
  for (let i = num4; i <= num5; i++) for (let j = num2; j <= num3; j++) if (heightSample(mapData, i, j) > num) return false;
  return true;
}

/** ShouldClipPromotedWaterTexel. */
export function shouldClipPromotedWaterTexel(mapData, tileData, texelX, texelZ, texelDim = WORLD_MAP_TILE_DIM) {
  return isClippedWaterTileData(tileData) && isPromotedTerrainTexelSafeToClip(mapData, texelX, texelZ, texelDim);
}

/** TryFindNearestSolidTexel: ring by ring out to 8, rows then columns, the first non-water texel of the SOURCE. */
function nearestSolidTexel(source, texelX, texelZ, dim) {
  for (let i = 1; i <= 8; i++) {
    for (let j = -i; j <= i; j++) {
      for (let k = -i; k <= i; k++) {
        if (Math.abs(k) !== i && Math.abs(j) !== i) continue;
        const x = texelX + k, z = texelZ + j;
        if (x >= 0 && z >= 0 && x < dim && z < dim) {
          const v = source[z * dim + x];
          if (!isClippedWaterTileData(v)) return v;
        }
      }
    }
  }
  return -1;
}

/**
 * ApplyTilemapTextureClip over the port's converted tilemap bytes.
 * @param {Uint8Array} tilemapBytes - the pixel's converted tilemap (z * 128 + x)
 * @param {object} mapData - {samples, tilemap}
 * @returns {?Uint8Array} the patched copy, or null when no texel changed (the texture stays as it is).
 */
export function patchTilemapForClip(tilemapBytes, mapData) {
  const num = WORLD_MAP_TILE_DIM;
  if (!tilemapBytes || tilemapBytes.length !== num * num) return null;
  const out = new Uint8Array(tilemapBytes.length);
  let flag = false;
  for (let i = 0; i < num; i++) {
    for (let j = 0; j < num; j++) {
      const k = i * num + j;
      let v = tilemapBytes[k];
      const water = isClippedWaterTileData(v);
      if (water && isPromotedTerrainTexelSafeToClip(mapData, j, i, num)) { v = CLIP_SENTINEL; flag = true; }
      else if (water) {
        const r = nearestSolidTexel(tilemapBytes, j, i, num);
        if (r >= 0) { v = r; flag = true; }
      }
      out[k] = v;
    }
  }
  return flag ? out : null;
}

/**
 * ShouldHidePureOceanCap: the bake calls every cell of the pixel sea and
 * none land, and the pixel's own heights all sit on the sea.
 */
export function shouldHidePureOceanCap(mapPixelX, mapPixelY, mapData, bake) {
  if (!bake || !bake.loaded || !bake.mapPixelHasWaterCells(mapPixelX, mapPixelY)) return false;
  if (bake.mapPixelHasLandCells(mapPixelX, mapPixelY)) return false;
  if (mapDataHasWater(mapData)) return mapDataFullySubmerged(mapData);
  return false;
}

/**
 * UpdateTerrainCapRenderer's decision, whole: hide the pixel's ground, or
 * clip its water texels (a patched tilemap), or leave it as it was.
 * @returns {{hide: boolean, tilemap: ?Uint8Array}}
 */
export function capDecision(mapPixelX, mapPixelY, mapData, tilemapBytes, bake) {
  const hide = shouldHidePureOceanCap(mapPixelX, mapPixelY, mapData, bake);
  const clip = !hide && mapDataHasWater(mapData);
  return { hide, tilemap: clip ? patchTilemapForClip(tilemapBytes, mapData) : null };
}

/**
 * THE CLIP, AS GEOMETRY. The mod discards a clipped texel in its terrain
 * shader (TilemapTextureArrayClipWater's `(255, 0, 255)` test); a texel is a
 * whole terrain tile, and a tile is a whole quad of the stride-1 grid - so
 * the port leaves the clipped tiles' quads out of the pixel's index set
 * instead, and the ground's program (and every other pixel's) keeps its
 * early depth test. buildTerrainIndices' layout exactly (terrainSurface.js):
 * a strided quad goes when every tile it covers is clipped (a far pixel's
 * part-clipped quad stands at the sea's height, under the surface), and a
 * strided grid's skirt stays whole.
 * @param {Uint8Array} bytes - the pixel's patched TileMap (z * 128 + x)
 * @param {number} [stride]
 * @returns {?Uint32Array} null when no quad is clipped
 */
export function clippedTerrainIndices(bytes, stride = 1) {
  const dim = WORLD_MAP_TILE_DIM;
  const g = (HEIGHTMAP_DIMENSION - 1) / stride + 1;
  const q = g - 1;
  const out = [];
  let dropped = 0;
  for (let z = 0; z < q; z++) {
    for (let x = 0; x < q; x++) {
      let clipped = true;
      for (let tz = z * stride; tz < (z + 1) * stride && clipped; tz++) {
        for (let tx = x * stride; tx < (x + 1) * stride; tx++) if (bytes[tz * dim + tx] !== CLIP_SENTINEL) { clipped = false; break; }
      }
      if (clipped) { dropped++; continue; }
      const i0 = z * g + x, i1 = i0 + 1, i2 = i0 + g, i3 = i2 + 1;
      out.push(i0, i2, i3, i0, i3, i1);
    }
  }
  if (!dropped) return null;
  if (stride > 1) {
    const edges = [(i) => i, (i) => (g - 1) * g + i, (i) => i * g, (i) => i * g + (g - 1)];
    for (let e = 0; e < 4; e++) {
      const edge = edges[e], base = g * g + e * g;
      for (let i = 0; i < q; i++) {
        const t0 = edge(i), t1 = edge(i + 1), b0 = base + i, b1 = base + i + 1;
        out.push(t0, b0, b1, t0, b1, t1, t0, b1, b0, t0, t1, b1);
      }
    }
  }
  return Uint32Array.from(out);
}
