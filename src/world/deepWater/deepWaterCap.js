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
// CLIP_SENTINEL (its one home is world/terrain/terrainSurface.js, the TileMap
// byte's). The terrain program that discards it is the CLIP VARIANT
// (render/renderer.js terrainClipFs, FAR-CLIP1) - the mod's
// ApplyWaterTexelClip swaps each terrain it clips to that shader, and
// the streaming host draws the ground of a pixel whose TileMap this patched
// with it (scenes/world.js). The plain terrain programs never test the byte
// (it would draw as tile layer 63, which GL clamps to the ground archive's
// last record), and the shadow pass's depth program reads no tilemap.
// ═══════════════════════════════════════════════════════════════════

import { HEIGHTMAP_DIMENSION } from '../terrain/terrainSampler.js';
import { WORLD_MAP_TILE_DIM } from '../terrain/terrainTiles.js';
import { heightSample, mapDataHasWater, mapDataFullySubmerged, DW_WATER_THRESHOLD } from './deepWaterClassification.js';
import { CLIP_SENTINEL } from '../terrain/terrainSurface.js';   // FAR-CLIP1: the byte's one home, the TileMap format's module - the renderer reads it there too

const f32 = Math.fround;
const clampInt = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** The byte a clipped texel carries in the port's R8UI tilemap - world/terrain/terrainSurface.js's, for this module's readers. */
export { CLIP_SENTINEL };

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
 * THE CLIP'S CULL. The mod discards a clipped texel in its terrain shader
 * (TilemapTextureArrayClipWater's `(255, 0, 255)` test), and so does the
 * port: a pixel whose TileMap the cap patched draws its ground with the
 * terrain program's clip variant (render/renderer.js terrainClipFs,
 * FAR-CLIP1). This leaves out of the pixel's index set what that discard
 * would take WHOLE, buildTerrainIndices' layout exactly
 * (terrainSurface.js): a quad goes when
 * every tile it covers is clipped - on the stride-1 grid a tile is a quad
 * and this is the whole clip - and a strided grid's skirt segment (EV4's,
 * the port's own) goes when every edge tile it hangs under is clipped: left
 * whole it hung 40 m of pale curtain in the carved sea along every far
 * coastal pixel's edges, the sea's "square panels" (DW-F). A far pixel's
 * part-clipped quad, or skirt segment, STANDS: its clipped tiles are the
 * program's to discard. (Until FAR-CLIP1 nothing did - no terrain program
 * tested the byte - and the far ground drew them as road art on the quad's
 * chord, over the sea: "geometry just being hard squares".)
 * @param {Uint8Array} bytes - the pixel's patched TileMap (z * 128 + x)
 * @param {number} [stride]
 * @returns {?Uint32Array} null when no quad or skirt segment is clipped
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
  if (stride > 1) {
    const edges = [(i) => i, (i) => (g - 1) * g + i, (i) => i * g, (i) => i * g + (g - 1)];
    // the edge tiles under each side (z * 128 + x): south row 0, north row 127, west column 0, east column 127
    const last = dim - 1;
    const tiles = [(t) => t, (t) => last * dim + t, (t) => t * dim, (t) => t * dim + last];
    for (let e = 0; e < 4; e++) {
      const edge = edges[e], tile = tiles[e], base = g * g + e * g;
      for (let i = 0; i < q; i++) {
        let clipped = true;
        for (let t = i * stride; t < (i + 1) * stride; t++) if (bytes[tile(t)] !== CLIP_SENTINEL) { clipped = false; break; }
        if (clipped) { dropped++; continue; }
        const t0 = edge(i), t1 = edge(i + 1), b0 = base + i, b1 = base + i + 1;
        out.push(t0, b0, b1, t0, b1, t1, t0, b1, b0, t0, t1, b1);
      }
    }
  }
  if (!dropped) return null;
  return Uint32Array.from(out);
}
