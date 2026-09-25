// ═══════════════════════════════════════════════════════════════════
// DW-A (2026-09-25): THE DEEP BAY'S COASTLINE, BUILT FROM THE PLAYER'S
// OWN WORLD. Iliac Puddle No More 1.2.2 (jet082) carves its sea against
// a "distance bake" - DeepWaterDistanceBake.cs reads it, a Unity editor
// tool (Tools > Deep Waters > Bake Distance Field, not in the mod's
// DLL) wrote it. The shipped file is 356 MB of the game's own terrain,
// classified: a derivative of WOODS.WLD, MAPS.BSA and BLOCKS.BSA, and a
// render of game data is game data, so it does not enter this repo.
// The port builds the same planes here, from the player's archive, by
// the rules the file itself proves - every one checked against the
// mod's own DistanceBakeVanilla (bible/03-World/Deep-Waters.md, "The
// coastline is rebuilt, not carried"):
//
//   HEIGHTS    - the baker's MapPixelData: WOODS.WLD after
//                StreamingWorld's boot SmoothLocationNeighbourhood
//                (terrainHelper.js; the host runs it before the world
//                mounts), DefaultTerrainSampler, then the classic
//                location blend (CalcAvgMaxHeight + BlendLocationTerrain
//                over SetLocationTiles' rect). Against the mod's file:
//                the smoothing cuts disagreement where it acts from
//                461,517 cells to 21,419, the blend from 17,311 to 749.
//   THRESHOLD  - DeepWaterWaterClassification.TryGetWaterThreshold:
//                OceanElevation / MaxTerrainHeight + 1e-5, float32.
//   FINE       - 64 x 64 cells a pixel, rows north to south: a cell is
//                water when ANY heightmap sample of its 3 x 3 window is
//                at or under the threshold - the mod's own
//                IsCellPartiallySubmerged at resolution 64.
//   COARSE     - 8 x 8 cells a pixel: a CANDIDATE when MORE than half
//                of its 64 fine-cell centre samples are water (32 of 64
//                is land: a tie counted wet would put cells with fewer
//                than 35 wet fine cells in the sea, and the file has
//                none); the sea is the 8-connected flood of candidates
//                from the map's border - one component in the file,
//                every inland lake left out.
//   DISTANCE   - octile (1, sqrt 2) distance from each sea cell to the
//                nearest in-map non-sea cell, x 102.4 / 16, rounded,
//                capped at 255 (byte x 16 m). Byte-exact over all 32
//                million cells of the file.
//   EDGE       - the same over the cells whose 64 fine cells are all
//                water, lakes included; the file's LOCAL plane is the
//                same bytes. Byte-exact over all 32 million cells.
//
// What cannot be byte-exact is the terrain: the port's extra ground
// noise is Ken Perlin's, not Unity's (perlin.js, Port-Ledger A), so a
// coastline agrees with the mod's file to within that noise (median 81
// of 4,096 fine cells on a coastal pixel) and follows THIS port's
// ground exactly - which is what the carve has to match.
//
// THE COST, AND WHERE IT GOES. 500,000 pixels cannot each be sampled
// (16,641 samples, two Perlin calls each). A provable bound over the
// sampler's cubic weights settles 96% of the world as all land or all
// sea from the WOODS bytes alone; the rest are sampled at the 64 fine
// centres the coarse rule reads, and only a sample the bound cannot
// settle pays for its Perlin term. The flood runs pixel by pixel with an
// 8 x 8 bitmask per coastal pixel. That global half is `buildGlobal`,
// pure and worker-safe, its result a small typed-array record the host
// caches (deepWatersBakeCache.js). Everything per pixel - the fine mask,
// the two distance planes - is built on first ask and kept.
// ═══════════════════════════════════════════════════════════════════

import {
  cubicInterpolator, generateSamples, getNoise,
  HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, SCALED_OCEAN_ELEVATION, BASE_HEIGHT_SCALE,
} from './terrainSampler.js';
import { calcAvgMaxHeight, blendLocationTerrain } from './terrainTiles.js';
import { MAP_WIDTH as MAP_W, MAP_HEIGHT as MAP_H } from '../formats/woodsFile.js';   // IsValidMapPixel's 1000 x 500
import { roundToInt } from '../systems/mathf.js';

const f32 = Math.fround;

/** The planes' shape - the mod's file header, v6 (DeepWaterDistanceBake.TryLoadBytes). */
export const BAKE_MAGIC = 0x44574442;          // "BDWD"
export const BAKE_VERSION = 6;
export const BAKE_SUB = 8;                     // subCellsPerPixelX / Y
export const BAKE_SUB_FINE = 64;               // subCellsPerPixelFine
export const BAKE_DISTANCE_SCALE_METERS = 16;  // distanceScaleMeters
/** One coarse cell's side in meters: the pixel's 819.2 over 8. */
export const BAKE_CELL_METERS = 819.2 / BAKE_SUB;
/** The distance planes' cap: a byte. */
export const BAKE_DISTANCE_CAP = 255;

/** DeepWaterWaterClassification.TryGetWaterThreshold: OceanElevation / MaxTerrainHeight + 1E-05f, every op a float. */
export const WATER_THRESHOLD = f32(f32(SCALED_OCEAN_ELEVATION / MAX_TERRAIN_HEIGHT) + f32(1e-5));

const HDIM = HEIGHTMAP_DIMENSION;
const SPAN = HDIM - 1;                          // 128
const DIV = SPAN / 3;                           // the sampler's large-map divisor
const NOISE_MAP_SCALE = 4;                      // DefaultTerrainSampler's scales, as terrainSampler.js keeps them
const EXTRA_NOISE_SCALE = 10;
const MAX_MAP_PIXEL_Y = 500;                    // MapsFile.MaxMapPixelY

/** The sampler's extra ground noise at its most: GetNoise(.., 0.5 amplitude) is at most 0.5, twice, times 10. */
export const EXTRA_NOISE_MAX = EXTRA_NOISE_SCALE * 0.5 * 0.5;

/** Pixel classes out of the bound. */
export const PIXEL_LAND = 0;
export const PIXEL_SEA = 1;
export const PIXEL_MIXED = 2;

// A sample's height in the sampler's scaled units is decided WITHOUT its
// Perlin term when that term cannot move it across the threshold. Both
// margins are far wider than any rounding in between (a float32 ulp at
// the threshold is ~1e-9 of the normalized height).
const T_SCALED = WATER_THRESHOLD * MAX_TERRAIN_HEIGHT;
const MARGIN = 1e-4;

// The quick test's y-halves, the same for every pixel: CubicInterpolator is
// sum(w_i(f) v_i) with w0 = -f^3+2f^2-f, w1 = f^3-2f^2+1, w2 = -f^3+f^2+f,
// w3 = f^3-f^2, so a row's weights are four numbers. The weighted sum is not
// the interpolator's own float order, which only the MARGIN above has to
// cover (1e-15 against 1e-4); `exact` keeps the interpolator itself.
const cubicWeights = (f, out, o) => {
  const f2 = f * f, f3 = f2 * f;
  out[o] = -f3 + 2 * f2 - f; out[o + 1] = f3 - 2 * f2 + 1; out[o + 2] = -f3 + f2 + f; out[o + 3] = f3 - f2;
};
const YW = new Float64Array(HEIGHTMAP_DIMENSION * 4);   // base: sfracy = y / 128
const YU = new Float64Array(HEIGHTMAP_DIMENSION * 4);   // large-map noise: fracy within the cell
const CELL_OF = new Int8Array(HEIGHTMAP_DIMENSION);     // floor(v / DIV), the same for x and y
for (let v = 0; v < HEIGHTMAP_DIMENSION; v++) {
  const i = Math.floor(v / (SPAN / 3));
  CELL_OF[v] = i;
  cubicWeights(v / SPAN, YW, v * 4);
  cubicWeights((v - i * (SPAN / 3)) / (SPAN / 3), YU, v * 4);
}

// ---------------------------------------------------------------------
// THE BOUND. The sampler's CubicInterpolator is sum(w_i(f) v_i) with
// w0 = -f(1-f)^2 and w3 = -f^2(1-f) never positive (each at most 4/27
// deep, together f(1-f) <= 1/4) and w1 + w2 = 1 - w0 - w3. So over
// f in [0, 1], with inputs known only to lie in [lo_i, hi_i], the value
// is at most max(hi1, hi2) + min(4/27 (a + b), max(a, b) / 4) with
// a = max(0, M - lo0), b = max(0, M - lo3) - and symmetrically below.
// ---------------------------------------------------------------------

function cubicHi(lo0, hi1, hi2, lo3) {
  const M = hi1 > hi2 ? hi1 : hi2;
  const a = M - lo0 > 0 ? M - lo0 : 0, b = M - lo3 > 0 ? M - lo3 : 0;
  const s = (4 / 27) * (a + b), q = 0.25 * (a > b ? a : b);
  return M + (s < q ? s : q);
}
function cubicLo(hi0, lo1, lo2, hi3) {
  const m = lo1 < lo2 ? lo1 : lo2;
  const a = hi0 - m > 0 ? hi0 - m : 0, b = hi3 - m > 0 ? hi3 - m : 0;
  const s = (4 / 27) * (a + b), q = 0.25 * (a > b ? a : b);
  return m - (s < q ? s : q);
}

/**
 * WoodsFile.GetLargeHeightMapValuesRange(mx - 1, my, 3), flattened the way
 * DefaultTerrainSampler flattens it (lhm[y * 9 + x] = lhm2[x, y]), written
 * into `out` without the reader's per-call arrays. Verbatim clamps.
 */
function readLargeWindow(woods, mapPixelX, mapPixelY, out) {
  const bytes = woods._bytes, offsets = woods.dataOffsets;
  if (!bytes || !offsets) {                    // a reader without the raw file: the reader's own door
    out.set(woods.getLargeHeightMapValuesRange(mapPixelX - 1, mapPixelY, 3));
    return out;
  }
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      let sx = mapPixelX - 1 + x, sy = mapPixelY - y;
      if (sx < 0) sx = 0;
      if (sx >= MAP_W - 1) sx = MAP_W - 1;
      if (sy < 0) sy = 0;
      if (sy >= MAP_H - 1) sy = MAP_H - 1;
      const pos = offsets[sy * MAP_W + sx] + 22;
      for (let iy = 1; iy <= 3; iy++) {
        for (let ix = 1; ix <= 3; ix++) {
          out[(y * 3 + iy - 1) * 9 + (x * 3 + ix - 1)] = bytes[pos + (4 - iy) * 5 + ix];
        }
      }
    }
  }
  return out;
}

const _shm = new Uint8Array(16);
const _lhm = new Uint8Array(81);
const _rowLo = new Float64Array(4), _rowHi = new Float64Array(4);
const _lRowLo = new Float64Array(28), _lRowHi = new Float64Array(28);

/**
 * The pixel's height range, provably - scaled units, extra noise and the
 * ocean clamp included. `[lo, hi]` with every sample's height inside.
 */
export function pixelHeightBounds(woods, mapPixelX, mapPixelY) {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) _shm[r + c * 4] = woods.getHeightMapValue(mapPixelX - 2 + r, mapPixelY - 2 + c);
  // Base: the four x-cubics (rows c = 3, 2, 1, 0 are x1..x4), then the y-cubic over their ranges.
  for (let k = 0; k < 4; k++) {
    const c = 3 - k;
    const v0 = _shm[c * 4], v1 = _shm[1 + c * 4], v2 = _shm[2 + c * 4], v3 = _shm[3 + c * 4];
    _rowLo[k] = cubicLo(v0, v1, v2, v3);
    _rowHi[k] = cubicHi(v0, v1, v2, v3);
  }
  const bLo = cubicLo(_rowHi[0], _rowLo[1], _rowLo[2], _rowHi[3]) * BASE_HEIGHT_SCALE;
  const bHi = cubicHi(_rowLo[0], _rowHi[1], _rowHi[2], _rowLo[3]) * BASE_HEIGHT_SCALE;
  readLargeWindow(woods, mapPixelX, mapPixelY, _lhm);
  // Each large-map row's x-cubic bound, once per (row R, cell column ix): the cells share them.
  for (let R = 0; R < 7; R++) {
    for (let ix = 0; ix <= 3; ix++) {
      const b = R * 9 + ix;
      const v0 = _lhm[b], v1 = _lhm[b + 1], v2 = _lhm[b + 2], v3 = _lhm[b + 3];
      _lRowLo[R * 4 + ix] = cubicLo(v0, v1, v2, v3);
      _lRowHi[R * 4 + ix] = cubicHi(v0, v1, v2, v3);
    }
  }
  let nLo = Infinity, nHi = -Infinity;
  for (let iy = 0; iy <= 3; iy++) {
    for (let ix = 0; ix <= 3; ix++) {
      const a = iy * 4 + ix;
      const lo = cubicLo(_lRowHi[a], _lRowLo[a + 4], _lRowLo[a + 8], _lRowHi[a + 12]) * NOISE_MAP_SCALE;
      const hi = cubicHi(_lRowLo[a], _lRowHi[a + 4], _lRowHi[a + 8], _lRowLo[a + 12]) * NOISE_MAP_SCALE;
      if (lo < nLo) nLo = lo;
      if (hi > nHi) nHi = hi;
    }
  }
  let lo = bLo + nLo, hi = bHi + nHi + EXTRA_NOISE_MAX;
  if (lo < SCALED_OCEAN_ELEVATION) lo = SCALED_OCEAN_ELEVATION;   // the sampler's clamp
  if (hi < SCALED_OCEAN_ELEVATION) hi = SCALED_OCEAN_ELEVATION;
  return [lo, hi];
}

/** LAND when no sample can be water, SEA when every sample must be, MIXED otherwise. */
export function classifyPixel(woods, mapPixelX, mapPixelY) {
  const [lo, hi] = pixelHeightBounds(woods, mapPixelX, mapPixelY);
  if (lo > T_SCALED + MARGIN) return PIXEL_LAND;
  if (hi < T_SCALED - MARGIN) return PIXEL_SEA;
  return PIXEL_MIXED;
}

/**
 * A range of heights WITHOUT the ground noise, settled: 0 when every height is
 * land already (the noise only raises), 1 when even the noise's 2.5 cannot lift
 * the highest to the sea's threshold, -1 when a sample has to say.
 */
export function settleRange(lo, hi) {
  return lo > T_SCALED + MARGIN ? 0 : hi + EXTRA_NOISE_MAX < T_SCALED - MARGIN ? 1 : -1;
}

// ---------------------------------------------------------------------
// THE EXACT SAMPLE, CHEAPLY. The sampler's own arithmetic, split: the
// base and the large-map noise are cubics whose x-halves do not depend
// on y, so they are evaluated once per column (the same calls with the
// same arguments as sampleKernel, so the same doubles); a large-map
// cell's region the bound settles is answered whole; and the Perlin
// term is paid only by a sample the first two terms cannot settle,
// added in the kernel's own order - so a sample that decides anything
// is the streamed terrain's sample, bit for bit (pinned against
// generateSamples in test/dwa_bake.test.js).
// ---------------------------------------------------------------------

/**
 * A pixel's water test over its heightmap samples, x east, y north, 0..128:
 * `quick` answers 1 / 0 from the first two terms or -1, `exact` pays for the
 * ground noise, `water` is the one then the other.
 * @returns {{water: Function, quick: Function, exact: Function}}
 */
export function pixelWaterSampler(woods, mapPixelX, mapPixelY, locationRect = null) {
  if (locationRect) {
    // The blend reads the whole pixel's average, so the pixel is sampled whole - the streamed build's own order.
    const S = generateSamples(woods, mapPixelX, mapPixelY);
    const [avg] = calcAvgMaxHeight(S);
    blendLocationTerrain(S, avg, locationRect);
    const water = (x, y) => S[x * HDIM + y] <= WATER_THRESHOLD;
    return { water, quick: (x, y) => (water(x, y) ? 1 : 0), exact: water };
  }
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) _shm[r + c * 4] = woods.getHeightMapValue(mapPixelX - 2 + r, mapPixelY - 2 + c);
  const shm = _shm.slice();
  const lhm = readLargeWindow(woods, mapPixelX, mapPixelY, new Uint8Array(81));
  // Base x-halves: baseX[k * HDIM + x], k = 0..3 over shm rows c = 3, 2, 1, 0 (the kernel's x1..x4).
  const baseX = new Float64Array(4 * HDIM);
  // Noise x-halves per lhm row R (0..6): noiseX[R * HDIM + x], at the column's own ix and fracx.
  const noiseX = new Float64Array(7 * HDIM);
  for (let x = 0; x < HDIM; x++) {
    const sfracx = x / SPAN;
    for (let k = 0; k < 4; k++) {
      const c = 3 - k;
      baseX[k * HDIM + x] = cubicInterpolator(shm[c * 4], shm[1 + c * 4], shm[2 + c * 4], shm[3 + c * 4], sfracx);
    }
    const ix = Math.floor(x / DIV);
    const fracx = (x - ix * DIV) / DIV;
    for (let R = 0; R < 7; R++) {
      const b = R * 9 + ix;
      noiseX[R * HDIM + x] = cubicInterpolator(lhm[b], lhm[b + 1], lhm[b + 2], lhm[b + 3], fracx);
    }
  }
  // Each large-map cell's region settled whole when its bound allows: 1 all water, 0 all land, -1 per sample.
  const region = new Int8Array(16);
  const lo4 = new Float64Array(4), hi4 = new Float64Array(4);
  for (let rx = 0; rx < 4; rx++) {
    const x0 = rx === 3 ? SPAN : Math.ceil(rx * DIV), x1 = rx === 3 ? SPAN : Math.ceil((rx + 1) * DIV) - 1;
    for (let k = 0; k < 4; k++) {
      let mn = Infinity, mx = -Infinity;
      for (let x = x0; x <= x1; x++) { const v = baseX[k * HDIM + x]; if (v < mn) mn = v; if (v > mx) mx = v; }
      lo4[k] = mn; hi4[k] = mx;
    }
    const bLo = cubicLo(hi4[0], lo4[1], lo4[2], hi4[3]) * BASE_HEIGHT_SCALE;
    const bHi = cubicHi(lo4[0], hi4[1], hi4[2], lo4[3]) * BASE_HEIGHT_SCALE;
    for (let ry = 0; ry < 4; ry++) {
      for (let j = 0; j < 4; j++) {
        let mn = Infinity, mx = -Infinity;
        for (let x = x0; x <= x1; x++) { const v = noiseX[(ry + j) * HDIM + x]; if (v < mn) mn = v; if (v > mx) mx = v; }
        lo4[j] = mn; hi4[j] = mx;
      }
      const nLo = cubicLo(hi4[0], lo4[1], lo4[2], hi4[3]) * NOISE_MAP_SCALE;
      const nHi = cubicHi(lo4[0], hi4[1], hi4[2], lo4[3]) * NOISE_MAP_SCALE;
      region[ry * 4 + rx] = settleRange(bLo + nLo, bHi + nHi);
    }
  }
  const hiT = T_SCALED + MARGIN, loT = T_SCALED - EXTRA_NOISE_MAX - MARGIN;
  const nx0 = mapPixelX * SPAN, ny0 = (MAX_MAP_PIXEL_Y - mapPixelY) * SPAN;
  // The first two terms of the kernel's sum, in its order: 0 + base * 8, + noise * 4.
  const h0 = (x, y) => {
    const iy = Math.floor(y / DIV);
    const sfracy = y / SPAN;
    const fracy = (y - iy * DIV) / DIV;
    const base = cubicInterpolator(baseX[x], baseX[HDIM + x], baseX[2 * HDIM + x], baseX[3 * HDIM + x], sfracy);
    const noise = cubicInterpolator(noiseX[iy * HDIM + x], noiseX[(iy + 1) * HDIM + x], noiseX[(iy + 2) * HDIM + x], noiseX[(iy + 3) * HDIM + x], fracy);
    let h = 0;
    h += base * BASE_HEIGHT_SCALE;
    h += noise * NOISE_MAP_SCALE;
    return h;
  };
  /** 1 water, 0 land, -1 when only the ground noise can say. */
  const quick = (x, y) => {
    const iy = CELL_OF[y];
    const settled = region[iy * 4 + CELL_OF[x]];
    if (settled >= 0) return settled;
    const w = y * 4, r = iy * HDIM + x;
    const base = YW[w] * baseX[x] + YW[w + 1] * baseX[HDIM + x] + YW[w + 2] * baseX[2 * HDIM + x] + YW[w + 3] * baseX[3 * HDIM + x];
    const noise = YU[w] * noiseX[r] + YU[w + 1] * noiseX[r + HDIM] + YU[w + 2] * noiseX[r + 2 * HDIM] + YU[w + 3] * noiseX[r + 3 * HDIM];
    const h = base * BASE_HEIGHT_SCALE + noise * NOISE_MAP_SCALE;
    return h > hiT ? 0 : h < loT ? 1 : -1;   // the noise only raises, and the clamp lifts to the sea
  };
  /** The sample itself: + (low * high) * 10, then the float the heightmap stores. The sampler's clamp to
   *  the sea is left out on purpose - it lifts a sample TO the ocean elevation, which is under the
   *  threshold, so it can never move a sample across it. */
  const exact = (x, y) => {
    let h = h0(x, y);
    const nx = nx0 + x, ny = ny0 + y;
    h += (getNoise(nx, ny, 0.3, 0.5, 0.5, 1) * getNoise(nx, ny, 0.9, 0.5, 0.5, 1)) * EXTRA_NOISE_SCALE;
    return f32(Math.min(1, Math.max(0, h / MAX_TERRAIN_HEIGHT))) <= WATER_THRESHOLD;
  };
  return {
    quick, exact,
    water(x, y) { const q = quick(x, y); return q < 0 ? exact(x, y) : q === 1; },
  };
}

/** Fine cell (fx, fy) - fy from the north edge - reads samples x in [2fx, 2fx+2], yNorth in [126-2fy, 128-2fy]:
 *  water when any is. A sample the quick test settles wet ends it; the noise is paid only for the rest. */
export function fineCellWater(sampler, fx, fy) {
  const x0 = 2 * fx, y0 = SPAN - 2 - 2 * fy;
  let open = 0;
  for (let a = 0; a <= 2; a++) {
    for (let b = 0; b <= 2; b++) {
      const q = sampler.quick(x0 + a, y0 + b);
      if (q === 1) return true;
      if (q < 0) open |= 1 << (a * 3 + b);
    }
  }
  for (let k = 0; k < 9; k++) if ((open >> k) & 1 && sampler.exact(x0 + Math.floor(k / 3), y0 + (k % 3))) return true;
  return false;
}

/**
 * A pixel's coarse candidates: 8 bytes, byte = row from the north, bit = column
 * from the west; set when more than 32 of the cell's 64 fine-cell centre samples
 * (2fx + 1, 127 - 2fy) are water. A cell stops counting once its answer is fixed.
 */
export function coarseCandidateBits(sampler) {
  const out = new Uint8Array(BAKE_SUB);
  const open = new Int32Array(64);
  for (let cy = 0; cy < BAKE_SUB; cy++) {
    for (let cx = 0; cx < BAKE_SUB; cx++) {
      let wet = 0, dry = 0, n = 0;
      for (let fy = 0; fy < 8; fy++) {
        for (let fx = 0; fx < 8; fx++) {
          const x = 2 * (cx * 8 + fx) + 1, y = SPAN - 1 - 2 * (cy * 8 + fy);
          const q = sampler.quick(x, y);
          if (q === 1) wet++; else if (q === 0) dry++; else open[n++] = x * 256 + y;
        }
      }
      for (let k = 0; k < n && wet <= 32 && dry < 32; k++) {
        if (sampler.exact(open[k] >> 8, open[k] & 255)) wet++; else dry++;
      }
      if (wet > 32) out[cy] |= 1 << cx;
    }
  }
  return out;
}

/** A pixel's fine mask: 512 bytes, row-major from the north (64 rows of 8 bytes), bit = fx & 7. */
export function fineMaskBits(sampler) {
  const out = new Uint8Array(BAKE_SUB_FINE * BAKE_SUB_FINE / 8);
  for (let fy = 0; fy < BAKE_SUB_FINE; fy++) {
    for (let fx = 0; fx < BAKE_SUB_FINE; fx++) if (fineCellWater(sampler, fx, fy)) out[fy * 8 + (fx >> 3)] |= 1 << (fx & 7);
  }
  return out;
}

/** The coarse cells whose 64 fine cells are all water: 8 bytes as coarseCandidateBits. */
export function fullWaterBits(fine) {
  const out = new Uint8Array(BAKE_SUB);
  for (let cy = 0; cy < BAKE_SUB; cy++) {
    for (let cx = 0; cx < BAKE_SUB; cx++) {
      let all = true;
      for (let fy = 0; fy < 8 && all; fy++) if (fine[(cy * 8 + fy) * 8 + cx] !== 0xff) all = false;
      if (all) out[cy] |= 1 << cx;
    }
  }
  return out;
}

// ---------------------------------------------------------------------
// THE GLOBAL HALF: classes, candidates, the flood.
// ---------------------------------------------------------------------

/** The 8 x 8 flood inside one pixel: grow `reached` through `cand`, 8-connected, until it stops. */
function floodInside(reached, cand) {
  let grew = true;
  while (grew) {
    grew = false;
    for (let r = 0; r < 8; r++) {
      const m = reached[r] | (r > 0 ? reached[r - 1] : 0) | (r < 7 ? reached[r + 1] : 0);
      const d = (m | ((m << 1) & 0xff) | (m >> 1)) & cand[r];
      if ((d | reached[r]) !== reached[r]) { reached[r] |= d; grew = true; }
    }
  }
}

const ALL8 = new Uint8Array(8).fill(0xff);
const NONE8 = new Uint8Array(8);

/**
 * Build the world's sea mask.
 * @param {object} woods - the loaded (boot-smoothed) WoodsFile.
 * @param {object} [opts]
 * @param {(px: number, py: number) => ?object} [opts.locationRectAt] - SetLocationTiles' rect for a pixel
 *   that holds a classic location, or null.
 * @param {(px: number, py: number) => number} [opts.classify] - the bound's class (test seam).
 * @param {(px: number, py: number) => Uint8Array} [opts.candidates] - a mixed pixel's 8 candidate bytes (test seam).
 * @returns {{state: Uint8Array, partialIndex: Int32Array, partialBits: Uint8Array, classes: Uint8Array, stats: object}}
 *   state per pixel: 0 no sea cell, 1 all 64, 2 some (their bits in partialBits at the pixel's
 *   partialIndex slot, 8 bytes each). classes: the bound's LAND / SEA / MIXED.
 */
export function buildGlobal(woods, opts = {}) {
  const steps = buildGlobalSteps(woods, opts);
  let r = steps.next();
  while (!r.done) r = steps.next();
  return r.value;
}

/**
 * buildGlobal as steps: the generator yields between slices of work (a row
 * of pixels classified, a coastal pixel sampled) so a host with no worker
 * can spread it over frames; it returns buildGlobal's record.
 */
export function* buildGlobalSteps(woods, {
  locationRectAt = () => null,
  classify = (px, py) => classifyPixel(woods, px, py),
  candidates = (px, py) => coarseCandidateBits(pixelWaterSampler(woods, px, py, locationRectAt(px, py))),
} = {}) {
  const n = MAP_W * MAP_H;
  const classes = new Uint8Array(n);
  for (let py = 0; py < MAP_H; py++) {
    for (let px = 0; px < MAP_W; px++) classes[py * MAP_W + px] = classify(px, py);
    yield;
  }
  // Candidates of the mixed pixels.
  const candIndex = new Int32Array(n).fill(-1);
  let mixed = 0;
  for (let i = 0; i < n; i++) if (classes[i] === PIXEL_MIXED) candIndex[i] = mixed++;
  const candBits = new Uint8Array(mixed * 8);
  for (let i = 0; i < n; i++) {
    if (classes[i] !== PIXEL_MIXED) continue;
    const px = i % MAP_W, py = (i - px) / MAP_W;
    candBits.set(candidates(px, py), candIndex[i] * 8);
    yield;
  }
  const cand = (i) => (classes[i] === PIXEL_SEA ? ALL8 : classes[i] === PIXEL_LAND ? NONE8 : candBits.subarray(candIndex[i] * 8, candIndex[i] * 8 + 8));
  // The flood: reached masks per pixel, a worklist of pixels.
  const reached = new Uint8Array(n * 8);
  const queued = new Uint8Array(n);
  const queue = new Int32Array(n);
  let qh = 0, qt = 0, qn = 0;
  const push = (i) => { if (queued[i]) return; queued[i] = 1; queue[qt] = i; qt = (qt + 1) % n; qn++; };
  const pushAround = (px, py) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const x = px + dx, y = py + dy;
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H || classes[y * MAP_W + x] === PIXEL_LAND) continue;
      push(y * MAP_W + x);
    }
  };
  // Seeds: the candidates on the map's edge, each flooded through its own pixel at once.
  for (let py = 0; py < MAP_H; py++) {
    for (let px = 0; px < MAP_W; px++) {
      if (px !== 0 && py !== 0 && px !== MAP_W - 1 && py !== MAP_H - 1) continue;
      const i = py * MAP_W + px, c = cand(i);
      if (c === NONE8) continue;
      const r = reached.subarray(i * 8, i * 8 + 8);
      for (let row = 0; row < 8; row++) {
        let edge = 0;
        if (px === 0) edge |= 1;
        if (px === MAP_W - 1) edge |= 0x80;
        if (py === 0 && row === 0) edge |= 0xff;
        if (py === MAP_H - 1 && row === 7) edge |= 0xff;
        r[row] |= edge & c[row];
      }
      floodInside(r, c);
      let any = 0;
      for (let row = 0; row < 8; row++) any |= r[row];
      if (any) pushAround(px, py);
    }
  }
  const inc = new Uint8Array(8);
  while (qn > 0) {
    const i = queue[qh]; qh = (qh + 1) % n; qn--; queued[i] = 0;
    const c = cand(i);
    if (c === NONE8) continue;
    const px = i % MAP_W, py = (i - px) / MAP_W;
    const r = reached.subarray(i * 8, i * 8 + 8);
    // Incoming: the neighbours' reached cells 8-adjacent to this pixel's cells.
    inc.fill(0);
    const nb = (dx, dy) => { const x = px + dx, y = py + dy; return (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) ? null : reached.subarray((y * MAP_W + x) * 8, (y * MAP_W + x) * 8 + 8); };
    const W = nb(-1, 0), E = nb(1, 0), N = nb(0, -1), S = nb(0, 1), NW = nb(-1, -1), NE = nb(1, -1), SW = nb(-1, 1), SE = nb(1, 1);
    for (let row = 0; row < 8; row++) {
      if (W) { const m = ((W[row] >> 7) & 1) | (row > 0 ? (W[row - 1] >> 7) & 1 : 0) | (row < 7 ? (W[row + 1] >> 7) & 1 : 0); if (m) inc[row] |= 1; }
      if (E) { const m = (E[row] & 1) | (row > 0 ? E[row - 1] & 1 : 0) | (row < 7 ? E[row + 1] & 1 : 0); if (m) inc[row] |= 0x80; }
    }
    if (N) { const m = N[7]; inc[0] |= m | ((m << 1) & 0xff) | (m >> 1); }
    if (S) { const m = S[0]; inc[7] |= m | ((m << 1) & 0xff) | (m >> 1); }
    if (NW && (NW[7] & 0x80)) inc[0] |= 1;
    if (NE && (NE[7] & 1)) inc[0] |= 0x80;
    if (SW && (SW[0] & 0x80)) inc[7] |= 1;
    if (SE && (SE[0] & 1)) inc[7] |= 0x80;
    let changed = false;
    for (let row = 0; row < 8; row++) {
      const add = inc[row] & c[row] & ~r[row];
      if (add) { r[row] |= add; changed = true; }
    }
    if (!changed) continue;                    // the flood inside a pixel only ever starts from a new cell
    floodInside(r, c);
    pushAround(px, py);
  }
  // Compact: 0 none, 1 all, 2 some.
  const state = new Uint8Array(n);
  const partial = [];
  for (let i = 0; i < n; i++) {
    const r = reached.subarray(i * 8, i * 8 + 8);
    let any = 0, all = 0xff;
    for (let row = 0; row < 8; row++) { any |= r[row]; all &= r[row]; }
    if (!any) continue;
    if (all === 0xff) { state[i] = 1; continue; }
    state[i] = 2;
    partial.push(i);
  }
  const partialIndex = Int32Array.from(partial);
  const partialBits = new Uint8Array(partial.length * 8);
  for (let k = 0; k < partial.length; k++) partialBits.set(reached.subarray(partial[k] * 8, partial[k] * 8 + 8), k * 8);
  let sea = 0, land = 0;
  for (let i = 0; i < n; i++) { if (classes[i] === PIXEL_SEA) sea++; else if (classes[i] === PIXEL_LAND) land++; }
  return { state, partialIndex, partialBits, classes, stats: { land, sea, mixed, partial: partial.length } };
}

// ---------------------------------------------------------------------
// THE PER-PIXEL HALF, AND DeepWaterDistanceBake's QUERIES.
// ---------------------------------------------------------------------

/** How far a distance plane can see: the cap, 255 x 16 m, is 39.8 cells, and a cell 5 pixels out is at least 41
 *  cells away (octile distance is never under Chebyshev) - so a window 5 pixels each way decides every byte of the
 *  centre pixel exactly, and a shortest octile path never leaves the box its two ends span. */
const WINDOW_PIXELS = 5;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clampInt = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** IsValidMapPixel. */
export function isValidMapPixel(mapPixelX, mapPixelY) {
  return mapPixelX >= 0 && mapPixelY >= 0 && mapPixelX < MAP_W && mapPixelY < MAP_H;
}

/** BakedSouthFraction: a float parameter is a float32, so the input is rounded first. */
export const bakedSouthFraction = (fracZ) => f32(1 - clamp01(f32(fracZ)));

/**
 * Octile distance bytes for the 8 x 8 cells of pixel (px, py), row-major from
 * the north-west, over a window of pixels. `maskBits(px, py)` answers a pixel's
 * 8 bytes (null off the map: those cells are neither in the mask nor seeds, as
 * the file's whole-map transform never saw them).
 */
export function distanceBytes(px, py, maskBits) {
  const R = WINDOW_PIXELS, side = (2 * R + 1) * BAKE_SUB;
  const D = new Float64Array(side * side);
  for (let wy = 0; wy < 2 * R + 1; wy++) {
    for (let wx = 0; wx < 2 * R + 1; wx++) {
      const bits = maskBits(px - R + wx, py - R + wy);
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const k = (wy * 8 + r) * side + wx * 8 + c;
          if (!bits) { D[k] = Infinity; continue; }       // off the map: neither sea nor a seed
          D[k] = (bits[r] >> c) & 1 ? Infinity : 0;
        }
      }
    }
  }
  const S2 = Math.SQRT2;
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const k = y * side + x;
      let d = D[k];
      if (d === 0) continue;
      if (x > 0 && D[k - 1] + 1 < d) d = D[k - 1] + 1;
      if (y > 0) {
        if (D[k - side] + 1 < d) d = D[k - side] + 1;
        if (x > 0 && D[k - side - 1] + S2 < d) d = D[k - side - 1] + S2;
        if (x < side - 1 && D[k - side + 1] + S2 < d) d = D[k - side + 1] + S2;
      }
      D[k] = d;
    }
  }
  for (let y = side - 1; y >= 0; y--) {
    for (let x = side - 1; x >= 0; x--) {
      const k = y * side + x;
      let d = D[k];
      if (d === 0) continue;
      if (x < side - 1 && D[k + 1] + 1 < d) d = D[k + 1] + 1;
      if (y < side - 1) {
        if (D[k + side] + 1 < d) d = D[k + side] + 1;
        if (x < side - 1 && D[k + side + 1] + S2 < d) d = D[k + side + 1] + S2;
        if (x > 0 && D[k + side - 1] + S2 < d) d = D[k + side - 1] + S2;
      }
      D[k] = d;
    }
  }
  const out = new Uint8Array(64);
  const o = R * BAKE_SUB;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const d = D[(o + r) * side + o + c];
      out[r * 8 + c] = d === 0 ? 0 : d === Infinity ? BAKE_DISTANCE_CAP : Math.min(BAKE_DISTANCE_CAP, Math.round(d * BAKE_CELL_METERS / BAKE_DISTANCE_SCALE_METERS));
    }
  }
  return out;
}

/**
 * The bake, answered. Built over the global record and the woods reader;
 * per-pixel planes are made on first ask and kept.
 */
export class DeepWatersBake {
  /**
   * @param {object} deps
   * @param {object} deps.woods - the boot-smoothed WoodsFile the world streams from.
   * @param {object} deps.global - buildGlobal's record (or the cache's copy of it).
   * @param {(px: number, py: number) => ?object} [deps.locationRectAt]
   * @param {(px: number, py: number) => Uint8Array} [deps.fineAt] - a mixed pixel's 512-byte fine mask (test seam).
   */
  constructor({ woods, global, locationRectAt = () => null, fineAt = null }) {
    this.woods = woods;
    this.state = global.state;
    this.classes = global.classes;
    this.locationRectAt = locationRectAt;
    this._fineAt = fineAt ?? ((px, py) => fineMaskBits(pixelWaterSampler(this.woods, px, py, this.locationRectAt(px, py))));
    this._partial = new Map();
    for (let k = 0; k < global.partialIndex.length; k++) this._partial.set(global.partialIndex[k], global.partialBits.subarray(k * 8, k * 8 + 8));
    this._fine = new Map();       // pixel -> 512 bytes
    this._full = new Map();       // pixel -> 8 bytes (all-64-fine-water cells)
    this._dist = new Map();       // pixel -> 64 bytes
    this._edge = new Map();
    // The file's header, as TryLoadBytes reads it.
    this.subX = BAKE_SUB; this.subY = BAKE_SUB; this.subFine = BAKE_SUB_FINE;
    this.distanceScaleMeters = BAKE_DISTANCE_SCALE_METERS;
    this.widthCells = MAP_W * BAKE_SUB; this.heightCells = MAP_H * BAKE_SUB;
    this.widthCellsFine = MAP_W * BAKE_SUB_FINE; this.heightCellsFine = MAP_H * BAKE_SUB_FINE;
    this.loaded = true;           // IsLoaded
    this.hasFineWaterMask = true; // HasFineWaterMask
  }

  // ---- the planes ----------------------------------------------------

  /** The sea bits of a pixel (8 bytes), null off the map. */
  seaBits(px, py) {
    if (!isValidMapPixel(px, py)) return null;
    const i = py * MAP_W + px, s = this.state[i];
    return s === 1 ? ALL8 : s === 2 ? this._partial.get(i) : NONE8;
  }

  /** The fine mask of a pixel (512 bytes). */
  fineBits(px, py) {
    const i = py * MAP_W + px;
    let f = this._fine.get(i);
    if (f) return f;
    const cls = this.classes[i];
    if (cls === PIXEL_SEA) f = FINE_ALL;
    else if (cls === PIXEL_LAND) f = FINE_NONE;
    else f = this._fineAt(px, py);
    this._fine.set(i, f);
    return f;
  }

  /** The all-fine-water bits of a pixel (8 bytes), null off the map. */
  fullBits(px, py) {
    if (!isValidMapPixel(px, py)) return null;
    const i = py * MAP_W + px;
    let b = this._full.get(i);
    if (b) return b;
    const cls = this.classes[i];
    b = cls === PIXEL_SEA ? ALL8 : cls === PIXEL_LAND ? NONE8 : fullWaterBits(this.fineBits(px, py));
    this._full.set(i, b);
    return b;
  }

  _plane(plane, px, py) {
    const cache = plane === 'dist' ? this._dist : this._edge;
    const i = py * MAP_W + px;
    let b = cache.get(i);
    if (b) return b;
    b = distanceBytes(px, py, plane === 'dist' ? (x, y) => this.seaBits(x, y) : (x, y) => this.fullBits(x, y));
    cache.set(i, b);
    return b;
  }

  /** Warm every plane a query about pixel (px, py) can read - the host calls it before a build. */
  prepare(px, py) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = px + dx, y = py + dy;
      if (!isValidMapPixel(x, y)) continue;
      this._plane('dist', x, y);
      this._plane('edge', x, y);
      this.fineBits(x, y);
    }
  }

  /**
   * The planes prepare(px, py) warmed, as rows another thread's bake can
   * adopt: a pixel build on the Deep Waters worker hands them back with its
   * geometry, so this thread's queries about a streamed pixel never pay for
   * a fine mask twice. A pure pixel's fine mask is the shared constant and
   * does not travel.
   * @returns {Array<{i: number, fine: ?Uint8Array, dist: ?Uint8Array, edge: ?Uint8Array}>}
   */
  exportPlanes(px, py) {
    const rows = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = px + dx, y = py + dy;
      if (!isValidMapPixel(x, y)) continue;
      const i = y * MAP_W + x;
      const f = this.classes[i] === PIXEL_MIXED ? this._fine.get(i) ?? null : null;
      const row = { i, fine: f ? f.slice() : null, dist: this._dist.get(i)?.slice() ?? null, edge: this._edge.get(i)?.slice() ?? null };
      if (row.fine || row.dist || row.edge) rows.push(row);
    }
    return rows;
  }

  /** Take exportPlanes' rows into this bake's caches (what is already here stays - the bytes are the same). */
  adoptPlanes(rows) {
    for (const r of rows ?? []) {
      if (!Number.isInteger(r?.i) || r.i < 0 || r.i >= MAP_W * MAP_H) continue;
      if (r.fine && r.fine.length === 512 && !this._fine.has(r.i)) this._fine.set(r.i, r.fine);
      if (r.dist && r.dist.length === 64 && !this._dist.has(r.i)) this._dist.set(r.i, r.dist);
      if (r.edge && r.edge.length === 64 && !this._edge.has(r.i)) this._edge.set(r.i, r.edge);
    }
  }

  /** Forget the per-pixel planes of pixels farther than `radius` (Chebyshev) from (px, py). */
  evictOutside(px, py, radius) {
    for (const cache of [this._fine, this._full, this._dist, this._edge]) {
      for (const i of [...cache.keys()]) {
        const x = i % MAP_W, y = (i - x) / MAP_W;
        if (Math.max(Math.abs(x - px), Math.abs(y - py)) > radius) cache.delete(i);
      }
    }
  }

  /** A byte of a distance plane at global cell (x, y). */
  _byte(plane, x, y) {
    const px = x >> 3, py = y >> 3;
    return this._plane(plane, px, py)[(y & 7) * 8 + (x & 7)];
  }

  _coarseBit(x, y) {
    const b = this.seaBits(x >> 3, y >> 3);
    return !!b && ((b[y & 7] >> (x & 7)) & 1) === 1;
  }

  _fineBit(fx, fy) {
    const f = this.fineBits(fx >> 6, fy >> 6);
    const r = fy & 63, c = fx & 63;
    return ((f[r * 8 + (c >> 3)] >> (c & 7)) & 1) === 1;
  }

  // ---- DeepWaterDistanceBake's queries, verbatim ---------------------

  /** SampleDistanceMeters. */
  sampleDistanceMeters(mapPixelX, mapPixelY, fracX, fracZ) {
    if (!this.loaded) return Number.MAX_VALUE;
    return this._bilinearSampleMeters('dist', mapPixelX, mapPixelY, fracX, fracZ);
  }

  /** SampleEdgeDistanceMeters. */
  sampleEdgeDistanceMeters(mapPixelX, mapPixelY, fracX, fracZ) {
    return this._bilinearSampleMeters('edge', mapPixelX, mapPixelY, fracX, fracZ);
  }

  /** SampleLocalEdgeDistanceMeters: the file's local plane is the edge plane's bytes. */
  sampleLocalEdgeDistanceMeters(mapPixelX, mapPixelY, fracX, fracZ) {
    return this._bilinearSampleMeters('edge', mapPixelX, mapPixelY, fracX, fracZ);
  }

  /** BilinearSampleMeters, float by float. */
  _bilinearSampleMeters(plane, mapPixelX, mapPixelY, fracX, fracZ) {
    const num = f32(f32(f32(mapPixelX * this.subX) + f32(clamp01(f32(fracX)) * this.subX)) - 0.5);
    const num2 = f32(f32(f32(mapPixelY * this.subY) + f32(bakedSouthFraction(fracZ) * this.subY)) - 0.5);
    const num3 = clampInt(Math.floor(num), 0, this.widthCells - 1);
    const num4 = clampInt(Math.floor(num2), 0, this.heightCells - 1);
    const num5 = Math.min(num3 + 1, this.widthCells - 1);
    const num6 = Math.min(num4 + 1, this.heightCells - 1);
    const num7 = clamp01(f32(num - num3));
    const num8 = clamp01(f32(num2 - num4));
    const s = this.distanceScaleMeters;
    const num9 = f32(this._byte(plane, num3, num4) * s);
    const num10 = f32(this._byte(plane, num5, num4) * s);
    const num11 = f32(this._byte(plane, num3, num6) * s);
    const num12 = f32(this._byte(plane, num5, num6) * s);
    // Mathf.Lerp(a, b, t) = a + (b - a) * Clamp01(t), every op a float32 op.
    const num13 = f32(num9 + f32(f32(num10 - num9) * num7));
    const num14 = f32(num11 + f32(f32(num12 - num11) * num7));
    return f32(num13 + f32(f32(num14 - num13) * num8));
  }

  /** IsWaterAt. */
  isWaterAt(mapPixelX, mapPixelY, fracX, fracZ) {
    if (!this.loaded) return false;
    const [x, y] = this._nearestCell(mapPixelX, mapPixelY, fracX, fracZ);
    return this._cellHasWater(x, y);
  }

  /** IsCarvedWater. */
  isCarvedWater(mapPixelX, mapPixelY, fracX, fracZ) {
    if (!this.loaded || !this.hasFineWaterMask || this.subFine <= 0) return false;
    const num = f32(f32(f32(mapPixelX * this.subFine) + f32(clamp01(f32(fracX)) * this.subFine)) - 0.5);
    const num2 = f32(f32(f32(mapPixelY * this.subFine) + f32(bakedSouthFraction(fracZ) * this.subFine)) - 0.5);
    const num3 = clampInt(roundToInt(num), 0, this.widthCellsFine - 1);
    const row = clampInt(roundToInt(num2), 0, this.heightCellsFine - 1);
    return this._fineBit(num3, row);
  }

  /** MapPixelHasFineWaterCells. */
  mapPixelHasFineWaterCells(mapPixelX, mapPixelY) {
    if (!this.loaded || !this.hasFineWaterMask || this.subFine <= 0) return false;
    if (!isValidMapPixel(mapPixelX, mapPixelY)) return false;
    const f = this.fineBits(mapPixelX, mapPixelY);
    for (let i = 0; i < f.length; i++) if (f[i]) return true;
    return false;
  }

  /** MapPixelHasWaterCells. */
  mapPixelHasWaterCells(mapPixelX, mapPixelY) { return this._mapPixelHasCoarseCell(mapPixelX, mapPixelY, true); }

  /** MapPixelOrCardinalNeighborHasWaterCells. */
  mapPixelOrCardinalNeighborHasWaterCells(mapPixelX, mapPixelY) {
    if (!this.mapPixelHasWaterCells(mapPixelX, mapPixelY) && !this.mapPixelHasWaterCells(mapPixelX - 1, mapPixelY)
      && !this.mapPixelHasWaterCells(mapPixelX + 1, mapPixelY) && !this.mapPixelHasWaterCells(mapPixelX, mapPixelY - 1)) {
      return this.mapPixelHasWaterCells(mapPixelX, mapPixelY + 1);
    }
    return true;
  }

  /** MapPixelHasLandCells. */
  mapPixelHasLandCells(mapPixelX, mapPixelY) { return this._mapPixelHasCoarseCell(mapPixelX, mapPixelY, false); }

  /** MapPixelHasCoarseCell. */
  _mapPixelHasCoarseCell(mapPixelX, mapPixelY, water) {
    if (!this.loaded) return false;
    if (!isValidMapPixel(mapPixelX, mapPixelY)) return false;
    const b = this.seaBits(mapPixelX, mapPixelY);
    for (let r = 0; r < 8; r++) if (water ? b[r] !== 0 : b[r] !== 0xff) return true;
    return false;
  }

  /** GetNearestCell. */
  _nearestCell(mapPixelX, mapPixelY, fracX, fracZ) {
    const num = f32(f32(f32(mapPixelX * this.subX) + f32(clamp01(f32(fracX)) * this.subX)) - 0.5);
    const num2 = f32(f32(f32(mapPixelY * this.subY) + f32(bakedSouthFraction(fracZ) * this.subY)) - 0.5);
    return [clampInt(roundToInt(num), 0, this.widthCells - 1), clampInt(roundToInt(num2), 0, this.heightCells - 1)];
  }

  /** CellHasWater: the water-mask bit. */
  _cellHasWater(x, y) {
    if (x < 0 || y < 0 || x >= this.widthCells || y >= this.heightCells) return false;
    return this._coarseBit(x, y);
  }
}

const FINE_ALL = new Uint8Array(512).fill(0xff);
const FINE_NONE = new Uint8Array(512);
