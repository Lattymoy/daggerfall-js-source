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
// * STREAMING_TERRAIN_SCALE, normals by clamped central differences.

import {
  HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, TERRAIN_SIZE,
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

/** The byte the conversion above never writes (the tileset has 56
 *  records: 55 << 2 | 3 is 223 at the most) - Iliac Puddle No More's
 *  clipped texel, its (255, 0, 255, 0) Color32 mark in the port's R8UI
 *  TileMap. world/deepWaterCap.js writes it; the terrain program's clip
 *  variant discards it (render/renderer.js terrainClipFs, FAR-CLIP1). Its
 *  one home is here, where both reach it: the renderer already reads this
 *  module, and must not read the cap's (whose closure takes the bake). */
export const CLIP_SENTINEL = 255;

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
 * @returns {number} world height, MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE applied
 */
export function surfaceHeightAt(heightmapData, lx, lz, stride = 1) {
  const hDim = HEIGHTMAP_DIMENSION;
  const worldHeight = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
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
 * GRASS-LIT2 (2026-10-02): THE GROUND'S NORMAL WHERE A BLADE STANDS - the
 * drawn surface's own, as the terrain's fragment stage receives it: the
 * stride-1 grid's vertex normals (buildTerrainGrid's central differences,
 * ghost rows and all) interpolated over the triangle under (lx, lz), cut on
 * surfaceHeightAt's diagonal, then normalised as TERRAIN_FS normalises
 * vNormal. Written into `out` - the placer asks it once a blade.
 * @param {Float32Array} normals the pixel's stride-1 grid normals, vertex (xi, zi) at (zi * 129 + xi) * 3
 * @param {number} lx pixel-local x, 0..TERRAIN_SIZE
 * @param {number} lz pixel-local z, 0..TERRAIN_SIZE
 * @param {number[]|Float32Array} [out]
 * @returns {number[]|Float32Array} the unit normal [x, y, z]
 */
export function surfaceNormalAt(normals, lx, lz, out = [0, 0, 0]) {
  const g = HEIGHTMAP_DIMENSION;
  const quad = TERRAIN_SIZE / (g - 1);
  const last = g - 2;
  const qx = Math.max(0, Math.min(last, Math.floor(lx / quad)));
  const qz = Math.max(0, Math.min(last, Math.floor(lz / quad)));
  const ax = lx / quad - qx, az = lz / quad - qz;
  const i00 = (qz * g + qx) * 3, i10 = i00 + 3, i01 = i00 + g * 3, i11 = i01 + 3;
  let l2 = 0;
  for (let c = 0; c < 3; c++) {
    const n00 = normals[i00 + c], n10 = normals[i10 + c], n01 = normals[i01 + c], n11 = normals[i11 + c];
    // the diagonal runs (x,z)-(x+1,z+1): az >= ax is the i0,i2,i3 half (surfaceHeightAt's)
    const v = az >= ax ? n00 + az * (n01 - n00) + ax * (n11 - n01) : n00 + ax * (n10 - n00) + az * (n11 - n10);
    out[c] = v; l2 += v * v;
  }
  const l = Math.sqrt(l2) || 1;
  out[0] /= l; out[1] /= l; out[2] /= l;
  return out;
}

/**
 * SNOWFALL1 (2026-10-08): THE DRAWN GROUND'S NORMAL, FROM ITS SAMPLES ALONE - surfaceNormalAt's interpolation, over the
 * grid's vertex normals as buildTerrainGrid makes them at the pixel's stride (central differences at the stride's own
 * span, the pixel's edge one-sided: a pixel keeps no ghost rows), for a pixel that keeps no normals of its own (a
 * pixel's groundNormals are the grass's, stride 1, and only while the grass is on). The snow's surfaces light by it.
 * @param {Float32Array} heightmapData sample(x, z) = data[x*hDim+z], normalized
 * @param {number} lx pixel-local x, 0..TERRAIN_SIZE
 * @param {number} lz pixel-local z, 0..TERRAIN_SIZE
 * @param {number} [stride] the ring class this pixel is drawn at
 * @param {number[]|Float32Array} [out]
 * @returns {number[]|Float32Array} the unit normal [x, y, z]
 */
const _snVn = new Float64Array(12);   // SNOWFALL1: the quad's four vertex normals - one scratch, the snow asks once a sample
const _snAt = (data, x, z) => data[Math.max(0, Math.min(HEIGHTMAP_DIMENSION - 1, x)) * HEIGHTMAP_DIMENSION + Math.max(0, Math.min(HEIGHTMAP_DIMENSION - 1, z))];
export function surfaceNormalFromSamples(heightmapData, lx, lz, stride = 1, out = [0, 0, 0]) {
  const hDim = HEIGHTMAP_DIMENSION, cell = TERRAIN_SIZE / (hDim - 1), lift = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
  const quad = cell * stride;
  const last = (hDim - 1) / stride - 1;
  const qx = Math.max(0, Math.min(last, Math.floor(lx / quad)));
  const qz = Math.max(0, Math.min(last, Math.floor(lz / quad)));
  const ax = lx / quad - qx, az = lz / quad - qz;
  const ny = 2 * cell * stride, vn = _snVn;
  for (let c = 0; c < 4; c++) {   // buildTerrainGrid's vertex normals at the stride grid's corners (0,0), (1,0), (0,1), (1,1)
    const x = (qx + (c & 1)) * stride, z = (qz + (c >> 1)) * stride;
    const nx = _snAt(heightmapData, x - stride, z) * lift - _snAt(heightmapData, x + stride, z) * lift;
    const nz = _snAt(heightmapData, x, z - stride) * lift - _snAt(heightmapData, x, z + stride) * lift;
    const l = Math.hypot(nx, ny, nz);
    vn[c * 3] = nx / l; vn[c * 3 + 1] = ny / l; vn[c * 3 + 2] = nz / l;
  }
  let l2 = 0;
  for (let c = 0; c < 3; c++) {
    const sw = vn[c], se = vn[3 + c], nw = vn[6 + c], ne = vn[9 + c];   // the quad's corners, surfaceHeightAt's cut
    const v = az >= ax ? sw + az * (nw - sw) + ax * (ne - nw) : sw + ax * (se - sw) + az * (ne - se);
    out[c] = v; l2 += v * v;
  }
  const l = Math.sqrt(l2) || 1;
  for (let c = 0; c < 3; c++) out[c] /= l;
  return out;
}

/**
 * SNOWFALL1 (2026-10-08): A GRID'S VALUE ON THE DRAWN TRIANGLE - a per-vertex value of a grid laid in the terrain's
 * order (x fastest, `gx` vertices a row, `cell` world units apart: buildTerrainIndices' and flatGrid's) read on the
 * triangle under (lx, lz), cut on surfaceHeightAt's diagonal. WATER-NEXT's bed depths through it are what the carve
 * took off the drawn ground there - for what is laid ON that ground (the snow).
 * @param {ArrayLike<number>} values gx * gz, x fastest
 * @returns {number}
 */
export function gridValueAt(values, gx, gz, cell, lx, lz) {
  const qx = Math.max(0, Math.min(gx - 2, Math.floor(lx / cell))), qz = Math.max(0, Math.min(gz - 2, Math.floor(lz / cell)));
  const ax = lx / cell - qx, az = lz / cell - qz;
  const i = qz * gx + qx;
  const v00 = values[i], v10 = values[i + 1], v01 = values[i + gx], v11 = values[i + gx + 1];
  return az >= ax ? v00 + az * (v01 - v00) + ax * (v11 - v01) : v00 + ax * (v10 - v00) + az * (v11 - v10);
}

/** Unity's heightmap: kMaxHeight steps to a terrain's full height (terrainSampleHeightAt, below). */
export const UNITY_HEIGHTMAP_MAX_HEIGHT = 32766;
/** A normalized height as Unity's heightmap holds it: its step, 0 to kMaxHeight. */
export const unityHeightmapStep = (h) => Math.round(Math.min(1, Math.max(0, h)) * UNITY_HEIGHTMAP_MAX_HEIGHT);
/** One step's height: the streamed terrain's size.y (MaxTerrainHeight x TerrainScale) over kMaxHeight, a float. */
const UNITY_HEIGHT_PER_STEP = Math.fround((MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE) / UNITY_HEIGHTMAP_MAX_HEIGHT);

/**
 * FIELD-CSA2 (2026-09-29, the Discord through Mac: "I can't get my boat to
 * work", "Ports are bugged for player boats"): TERRAIN.SAMPLEHEIGHT, AT THE
 * PRECISION UNITY HOLDS A HEIGHTMAP IN.
 *
 * DFU hands each terrain its heights as floats (DaggerfallTerrain's
 * TerrainData.SetHeights over MapPixelData's normalized samples), and Unity
 * does not keep the floats: a TerrainData heightmap holds each height as a
 * 16-bit step, kMaxHeight (32766) of them to the terrain's full height - the
 * scale Unity's terrain tools write as 32766/65535 on the heightmap's 16-bit
 * texture. Terrain.SampleHeight reads those steps: GetInterpolatedHeight over
 * the quad's two triangles, cut on the drawn ground's own diagonal (above),
 * the terrain's height over kMaxHeight a step.
 *
 * A step is 1923.75 / 32766 = 0.0587 m, nothing to anything that stands on
 * the ground. It is everything to a law whose line IS the sea: the sampler
 * clamps the whole sea to the ocean elevation (27.2 x 1.25 = 34 m over the
 * terrain), and Come Sail Away reads a boat's node as water, with Iliac
 * Puddle No More on, when `SampleHeight(node) < 34` (its WaterLevel). Unity's
 * flat sea is 579.105 steps, held as 579 - 33.994 m, under the line. The
 * drawn ground's floats read 34.000001 m, never under it: on the port every
 * node of every boat on the open sea read land, no boat rowed or raised a
 * sail, and the Overworld's crossing found no water to launch on. The trap
 * WATER1 found in the tile job, where the reference's float32 held the line
 * and a double missed it (terrainTiles.js generateTileData).
 *
 * The step is Unity's; whether its SetHeights rounds a height to the step or
 * truncates it is in no source the port has, and the port rounds. The sea is
 * step 579 either way (579.105); the two readings part only for a height in
 * the upper half of a step, 2.9 cm.
 *
 * @param {Float32Array} heightmapData sample(x, z) = data[x*hDim+z], normalized
 * @param {number} lx pixel-local x, 0..TERRAIN_SIZE
 * @param {number} lz pixel-local z, 0..TERRAIN_SIZE
 * @param {number} [stride] the ring class this pixel is drawn at - its quads, as the drawn ground's
 * @returns {number} the height over the terrain's own y, a float
 */
export function terrainSampleHeightAt(heightmapData, lx, lz, stride = 1) {
  const f = Math.fround;
  const hDim = HEIGHTMAP_DIMENSION;
  const quad = (TERRAIN_SIZE / (hDim - 1)) * stride;
  const last = (hDim - 1) / stride - 1;        // the last quad's index
  const at = (x, z) => unityHeightmapStep(heightmapData[Math.max(0, Math.min(hDim - 1, x)) * hDim
    + Math.max(0, Math.min(hDim - 1, z))]);
  const qx = Math.max(0, Math.min(last, Math.floor(lx / quad)));
  const qz = Math.max(0, Math.min(last, Math.floor(lz / quad)));
  const u = f(lx / quad - qx), v = f(lz / quad - qz);
  const x0 = qx * stride, z0 = qz * stride, x1 = x0 + stride, z1 = z0 + stride;
  const z00 = at(x0, z0), z11 = at(x1, z1);
  let h;
  if (u > v) {
    const z10 = at(x1, z0);   // Unity's z01: one quad along x
    h = f(f(z00 + f((z10 - z00) * u)) + f((z11 - z10) * v));
  } else {
    const z01 = at(x0, z1);   // Unity's z10: one quad along z
    h = f(f(z00 + f((z11 - z01) * u)) + f((z01 - z00) * v));
  }
  return f(h * UNITY_HEIGHT_PER_STEP);
}

/**
 * NATURE-GROUND (2026-09-26, Ilvi on the Discord: "I encountered a lot of
 * floating sprites across Illiac Bay"): HOW FAR THE DRAWN GROUND AT
 * (lx, lz) LIES OFF A LOCATION'S PLANE - up (+) or down (-). A location
 * stands on the pixel's average height (world.js `locLocal`), and
 * blendLocationTerrain writes that average only inside the location's
 * rect: the band outside it, out to the pixel's edge, is only EASED
 * toward it. A tree or a bush the block lays in that band stood on the
 * plane, over ground that falls away or rises through it.
 *
 * The plane is read the way the rect holds it - the average as the
 * Float32 sample it was written as - so inside the rect this answers
 * exactly 0 and nothing there moves.
 * @param {Float32Array} heightmapData the pixel's blended samples
 * @param {number} avg the normalized average the blend flattened to
 * @param {number} lx pixel-local x
 * @param {number} lz pixel-local z
 */
export function groundOffPlane(heightmapData, avg, lx, lz) {
  return surfaceHeightAt(heightmapData, lx, lz) - Math.fround(avg) * (MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE);
}

/** WOD-BUSH: the share of a box's footprint, each side, left out of the ground read - a bush's foot is its middle. */
export const GROUND_UNDER_INSET = 0.25;

/**
 * WOD-BUSH (2026-10-01, Mac: "World of daggerfall bush props float above the
 * ground in bandit camps"): THE LOWEST DRAWN GROUND UNDER A BOX - over the
 * middle of its footprint (GROUND_UNDER_INSET off each side), read at its
 * corners, its centre lines and every sample line that crosses it, so no
 * quad under it is skipped. The footprint is held to the pixel: the ground
 * past its edge is the neighbour's, which this pixel does not hold.
 * @param {Float32Array} heightmapData the pixel's blended samples
 * @param {ArrayLike<number>} box [minX, minY, minZ, maxX, maxY, maxZ], pixel-local
 * @returns {number} world height
 */
export function lowestGroundUnder(heightmapData, box) {
  const cell = TERRAIN_SIZE / (HEIGHTMAP_DIMENSION - 1);
  const clamp = (v) => Math.max(0, Math.min(TERRAIN_SIZE, v));
  const span = (lo, hi) => {
    const a = clamp(lo + (hi - lo) * GROUND_UNDER_INSET), b = clamp(hi - (hi - lo) * GROUND_UNDER_INSET);
    const out = [a, (a + b) / 2, b];
    for (let g = Math.ceil(a / cell) * cell; g < b; g += cell) out.push(g);
    return out;
  };
  const xs = span(box[0], box[3]), zs = span(box[2], box[5]);
  let low = Infinity;
  for (const x of xs) for (const z of zs) low = Math.min(low, surfaceHeightAt(heightmapData, x, z));
  return low;
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
  const worldHeight = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
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
