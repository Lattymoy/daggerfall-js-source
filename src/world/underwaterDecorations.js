// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DW-E2 (2026-09-25): ILIAC PUDDLE NO MORE'S SEAFLOOR DECORATIONS -
// UnderwaterDecorationCatalog.cs, UnderwaterDecorations.cs and the
// placement half of UnderwaterDecorationBatchFactory.cs (jet082, 1.2.2).
//
// THE CATALOG. Six pools of Daggerfall's own flats - weed, coral, rocks,
// dead sea life - one per water biome (the climate's: PassiveFishSpecies
// Catalog.ClimateToBiome), each a list with a record repeated as many
// times as its weight, so a uniform draw from the list is the weighted
// draw. Archive 106 records 2-6 are animated (5 frames a second).
//
// THE PLACEMENT, per map pixel, seeded by the pixel (Random.InitState(
// TileDecorationSeed)): a pass count off the Decoration Frequency (its
// fraction a roll), more in the open ocean and fewer in the desert's; each
// pass walks the heightmap three samples at a time with a jitter of up to
// two, keeps a sample under the sea, stands a picked record on the floor
// mesh's own triangle there - at least 8 m of water, at most 35 degrees of
// slope, clear of the floor by a quarter metre (three quarters for the
// animated) and of the surface by half a metre at 1.2x the record's height
// - five metres from every other, until the per-pixel cap; past the cap
// the list is shuffled and cut.
//
// THE WORK, as the mod paces it: one pixel placed a frame at most, one
// placed batch stood a frame (a pixel is placed only once its floor is
// built, and again whenever the floor is rebuilt); the player's own pixel
// keeps what it has; pixels within the Decoration Populate Radius of the
// player's, re-enqueued when the player crosses into a new pixel; heavy
// work only (DeepWaterRuntime), and not in a frame the promote work
// already spent a millisecond in (DeepWaterPromoteTiming).
//
// THE SEEDED STREAM (Port-Ledger A, the engine-internal randomness row):
// the mod seeds UnityEngine.Random per pixel; the port seeds Unity.
// Mathematics' xorshift (formats/umRandom.js) with the same seed - the
// same placement on every visit to a pixel, different concrete positions.
// The mod's unseeded draws at spawn time (a replacement's random scale, a
// batch's random start frame) are the host's (scenes/deepWatersDecor.js).
// ═══════════════════════════════════════════════════════════════════

import { UMRandom } from '../formats/umRandom.js';
import { HEIGHTMAP_DIMENSION } from './terrainSampler.js';
import { heightSample, DW_WATER_THRESHOLD } from './deepWaterClassification.js';
import { sampleMeshLocalYAndSlope, TILE_WORLD_SIZE } from './deepWaterFloor.js';
import { DW_OCEAN_LOCAL_Y } from './deepWatersPixel.js';

const f32 = Math.fround;

// ── WaterBiome + PassiveFishSpeciesCatalog.ClimateToBiome ──────────
export const WATER_BIOME = Object.freeze({ None: 0, OpenOcean: 1, Tropical: 2, Temperate: 4, Swamp: 8, Cold: 0x10, Desert: 0x20, Any: 0x3f });

/** ClimateToBiome: the pixel's climate to its water biome (the open ocean for any other). */
export function climateToBiome(climateIndex) {
  switch (climateIndex) {
    case 223: return WATER_BIOME.OpenOcean;
    case 229: case 227: return WATER_BIOME.Tropical;
    case 228: return WATER_BIOME.Swamp;
    case 231: case 232: return WATER_BIOME.Temperate;
    case 230: case 226: return WATER_BIOME.Cold;
    case 224: case 225: return WATER_BIOME.Desert;
    default: return WATER_BIOME.OpenOcean;
  }
}

// ── UnderwaterDecorationCatalog ─────────────────────────────────────
/** A record, [archive, record]. */
const R = (archive, record) => Object.freeze({ archive, record });
const add = (list, rec, weight) => { for (let i = 0; i < weight; i++) list.push(rec); };
const addMany = (list, weight, ...recs) => { for (const r of recs) add(list, r, weight); };
const addCommonWater = (list) => { add(list, R(106, 6), 8); add(list, R(106, 2), 3); add(list, R(106, 3), 3); };
const addDeadSeaLife = (list, weight) => addMany(list, weight, R(305, 0), R(305, 1), R(305, 2), R(306, 0), R(380, 1));

function buildOpenOceanPool() {
  const l = [];
  addCommonWater(l);
  add(l, R(106, 2), 12); add(l, R(106, 3), 10); add(l, R(211, 9), 10); add(l, R(211, 10), 6); add(l, R(253, 24), 8);
  add(l, R(501, 29), 8); add(l, R(502, 2), 8);
  add(l, R(105, 5), 8); add(l, R(105, 6), 8); add(l, R(105, 7), 8); add(l, R(105, 8), 8); add(l, R(105, 9), 8); add(l, R(105, 10), 8);
  add(l, R(206, 29), 3); add(l, R(206, 30), 3); add(l, R(206, 31), 3); add(l, R(206, 32), 3);
  addDeadSeaLife(l, 3);
  return l;
}
function buildTropicalPool() {
  const l = [];
  addCommonWater(l);
  addMany(l, 12, R(105, 2), R(105, 3), R(105, 4));
  addMany(l, 12, R(211, 9), R(211, 10));
  addMany(l, 16, R(213, 15));
  addMany(l, 12, R(253, 63));
  addMany(l, 16, R(501, 1), R(501, 18), R(501, 21), R(501, 23), R(501, 26), R(501, 29), R(501, 31));
  addMany(l, 14, R(502, 1), R(502, 2), R(502, 11), R(502, 21), R(502, 22), R(502, 27), R(502, 28), R(502, 29), R(502, 31));
  add(l, R(105, 0), 2); add(l, R(105, 5), 2);
  addDeadSeaLife(l, 1);
  return l;
}
function buildTemperatePool() {
  const l = [];
  addCommonWater(l);
  addMany(l, 14, R(106, 2), R(106, 3), R(106, 4), R(106, 5));
  add(l, R(105, 1), 10);
  addMany(l, 12, R(213, 11), R(213, 12), R(213, 15));
  addMany(l, 12, R(501, 18), R(501, 21), R(501, 23), R(501, 26), R(501, 29), R(501, 31));
  addMany(l, 10, R(502, 7), R(502, 8), R(502, 21), R(502, 23), R(502, 26), R(502, 27), R(502, 28), R(502, 31));
  addMany(l, 6, R(211, 9), R(211, 10), R(253, 24));
  add(l, R(105, 5), 3); add(l, R(105, 6), 3);
  addDeadSeaLife(l, 1);
  return l;
}
function buildSwampPool() {
  const l = [];
  addCommonWater(l);
  add(l, R(105, 1), 10);
  addMany(l, 16, R(106, 4), R(106, 5));
  add(l, R(211, 10), 6);
  addMany(l, 14, R(213, 15));
  addMany(l, 16, R(502, 3), R(502, 4), R(502, 5), R(502, 6), R(502, 7), R(502, 8), R(502, 9), R(502, 10), R(502, 21), R(502, 22), R(502, 29), R(502, 30));
  addMany(l, 10, R(501, 18), R(501, 21), R(501, 23), R(501, 26), R(501, 27), R(501, 28), R(501, 29));
  add(l, R(105, 5), 4); add(l, R(105, 10), 4);
  addDeadSeaLife(l, 2);
  return l;
}
function buildColdPool() {
  const l = [];
  addCommonWater(l);
  add(l, R(106, 6), 14);
  addMany(l, 10, R(206, 0), R(206, 1), R(206, 3), R(206, 4), R(206, 5), R(206, 6));
  addMany(l, 8, R(105, 5), R(105, 6), R(105, 7), R(105, 8), R(105, 9), R(105, 10));
  addMany(l, 7, R(206, 29), R(206, 30), R(206, 31), R(206, 32));
  addMany(l, 5, R(211, 10), R(253, 24), R(502, 4), R(502, 5), R(502, 6), R(502, 11));
  addMany(l, 3, R(206, 0), R(206, 1), R(206, 29), R(206, 30), R(206, 31), R(206, 32));
  addDeadSeaLife(l, 4);
  return l;
}
function buildDesertPool() {
  const l = [];
  addCommonWater(l);
  add(l, R(211, 10), 6);
  addMany(l, 8, R(105, 3), R(105, 4), R(105, 9));
  addMany(l, 4, R(502, 4), R(502, 5), R(502, 6), R(502, 11));
  add(l, R(305, 1), 4);
  return l;
}

export const DECORATION_POOLS = Object.freeze({
  [WATER_BIOME.OpenOcean]: Object.freeze(buildOpenOceanPool()),
  [WATER_BIOME.Tropical]: Object.freeze(buildTropicalPool()),
  [WATER_BIOME.Temperate]: Object.freeze(buildTemperatePool()),
  [WATER_BIOME.Swamp]: Object.freeze(buildSwampPool()),
  [WATER_BIOME.Cold]: Object.freeze(buildColdPool()),
  [WATER_BIOME.Desert]: Object.freeze(buildDesertPool()),
});

/** PoolForBiome: the biome's pool, the open ocean's for any other. */
export const poolForBiome = (biome) => DECORATION_POOLS[biome] ?? DECORATION_POOLS[WATER_BIOME.OpenOcean];

/** PickRecord: a uniform draw from the climate's biome's pool (Random.Range(0, Length)). */
export function pickRecord(climateIndex, rng) {
  const pool = poolForBiome(climateToBiome(climateIndex));
  return pool[rng.range(0, pool.length)];
}

/** Texture106FramesPerSecond: archive 106 animates at 5 frames a second, nothing else does. */
export const TEXTURE_106_FPS = 5;
export const framesPerSecondOf = (archive) => (archive === 106 ? TEXTURE_106_FPS : 0);
/** UsesArchiveAnimation: archive 106, records 2 to 6. */
export const usesArchiveAnimation = (rec) => rec.archive === 106 && rec.record >= 2 && rec.record <= 6;

// ── the placement constants (UnderwaterDecorations) ─────────────────
export const MAX_DECORATIONS_PER_TILE_HARD_CAP = 2304;
export const SAMPLE_STRIDE = 3;
export const MINIMUM_DECORATION_SPACING = 5;
export const MINIMUM_SEAFLOOR_DEPTH = 8;
export const DECORATION_SEAFLOOR_CLEARANCE = 0.25;            // SeafloorClearance (the swimmer's is another: scenes/deepWatersSwimMove.js)
export const ANIMATED_DECORATION_SEAFLOOR_CLEARANCE = 0.75;   // AnimatedSeafloorClearance
export const SURFACE_DECORATION_CLEARANCE = 0.5;
export const MAX_DECORATION_SLOPE_DEGREES = 35;
/** A replacement's random scale (DecorationScaleMin .. Max); the surface clearance is tested at the max, the biggest it may draw. */
export const DECORATION_SCALE_MIN = 0.7;
export const DECORATION_SCALE_MAX = 1.2;
/** BubbleFallbackVisualHeight: archive 106's height where the record has none, in metres (72 native units). */
export const BUBBLE_FALLBACK_VISUAL_HEIGHT = f32(1.8000001);

/** GetSeafloorClearance. */
export const seafloorClearance = (rec) => (usesArchiveAnimation(rec) ? ANIMATED_DECORATION_SEAFLOOR_CLEARANCE : DECORATION_SEAFLOOR_CLEARANCE);

/** TileDecorationSeed and GetSpacingCellKey: (x * 73856093) ^ (y * 19349663), in int32. */
export const tileDecorationSeed = (x, y) => Math.imul(x, 73856093) ^ Math.imul(y, 19349663);
export const spacingCellKey = (x, z) => Math.imul(x, 73856093) ^ Math.imul(z, 19349663);

/**
 * The port's stand-in for a UnityEngine.Random stream seeded by
 * Random.InitState(seed): Unity.Mathematics' xorshift over the same seed
 * (a zero seed, which that generator cannot take, becomes a fixed one).
 * Range semantics as Unity's: an int range's max is exclusive.
 */
export function seededUnityRandom(seed) {
  const s = seed >>> 0;
  const rng = new UMRandom(s === 0 ? 0x6e624eb7 : s);
  return {
    range: (min, maxExclusive) => (maxExclusive > min ? rng.nextIntRange(min, maxExclusive) : min),
    rangeFloat: (min, max) => rng.nextFloatRange(min, max),
    value: () => rng.nextFloat(),
  };
}

/** RollDecorationPasses: the Decoration Frequency's whole passes, and its fraction as a chance of one more. */
export function rollDecorationPasses(frequency, rng) {
  const num = Math.max(0, frequency);
  let n = Math.floor(num);
  if (rng.value() < f32(num - n)) n++;
  return n;
}

/** DecorationPassesForBiome: the open ocean 1.35x the passes, the desert 0.55x (rounded up). */
export function decorationPassesForBiome(passes, climateIndex) {
  if (passes <= 0) return 0;
  switch (climateToBiome(climateIndex)) {
    case WATER_BIOME.OpenOcean: return Math.ceil(f32(passes * f32(1.35)));
    case WATER_BIOME.Desert: return Math.ceil(f32(passes * f32(0.55)));
    default: return passes;
  }
}

/** CanPlaceDecoration: five metres clear of every placed decoration (a 5 m grid, the 3 x 3 around); a pass records it. */
export function canPlaceDecoration(localPos, spacingGrid) {
  const cx = Math.floor(localPos[0] / MINIMUM_DECORATION_SPACING);
  const cz = Math.floor(localPos[2] / MINIMUM_DECORATION_SPACING);
  const minSq = MINIMUM_DECORATION_SPACING * MINIMUM_DECORATION_SPACING;
  const x = localPos[0], z = localPos[2];
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const cell = spacingGrid.get(spacingCellKey(cx + j, cz + i));
      if (!cell) continue;
      for (const p of cell) {
        const dx = p[0] - x, dz = p[1] - z;
        if (dx * dx + dz * dz < minSq) return false;
      }
    }
  }
  const key = spacingCellKey(cx, cz);
  let own = spacingGrid.get(key);
  if (!own) { own = []; spacingGrid.set(key, own); }
  own.push([x, z]);
  return true;
}

/**
 * TryGetAuthoredDecorationVisualHeight: the record's billboard height in
 * metres - its scaled size (MeshReader.GetScaledBillboardSize x 0.025);
 * archive 106's 1.8 m where the record has none; with a replacement (and
 * not an animated record) the replacement's own batch height when taller.
 * 0 when the record cannot be read (the record is then never placed).
 * Sizes are metres ({w, h}, world/rmbFlats.js scaledBillboardSize's).
 * @param {{archive: number, record: number}} rec
 * @param {{scaledSize: (rec: {archive: number, record: number}) => ?{w: number, h: number},
 *          replacementSize?: (rec: {archive: number, record: number}) => ?{w: number, h: number}}} source
 */
export function authoredVisualHeight(rec, source) {
  let h = 0;
  try {
    const s = source.scaledSize(rec);
    if (s && s.h > 0) h = f32(s.h);
    else if (rec.archive === 106) h = BUBBLE_FALLBACK_VISUAL_HEIGHT;
    if (!usesArchiveAnimation(rec)) {
      const b = source.replacementSize?.(rec);
      if (b && b.h > 0) h = Math.max(h, f32(b.h));
    }
  } catch { h = 0; }
  return h;
}

/**
 * GenerateBillboardPositions: one pass over a pixel's heightmap.
 * @param {object} a
 * @param {{samples: Float32Array}} a.mapData - the pixel's heightmap (heightmapSamples[a, b] through heightSample)
 * @param {?object} a.floor - the pixel's floor mesh (TrySampleMeshLocalYAndSlope)
 * @param {number} a.climateIndex - the tile data's biome climate
 * @param {Array<{archive: number, record: number, local: number[]}>} a.positions - appended to
 * @param {Map<number, number[][]>} a.spacingGrid
 * @param {ReturnType<typeof seededUnityRandom>} a.rng
 * @param {(rec: {archive: number, record: number}) => number} a.visualHeight - the record's authored height (0: never placed)
 */
export function generateBillboardPositions({ mapData, floor, climateIndex, positions, spacingGrid, rng, visualHeight }) {
  const oceanLocalY = DW_OCEAN_LOCAL_Y;
  const length = HEIGHTMAP_DIMENSION, length2 = HEIGHTMAP_DIMENSION;
  const size = f32(TILE_WORLD_SIZE);   // terrainData.size.x / .z
  for (let i = 0; i < length - 1; i += SAMPLE_STRIDE) {
    for (let j = 0; j < length2 - 1; j += SAMPLE_STRIDE) {
      const num3 = i + rng.range(0, 3);
      const num4 = j + rng.range(0, 3);
      if (num3 >= length || num4 >= length2 || heightSample(mapData, num3, num4) > DW_WATER_THRESHOLD) continue;
      const lx = f32(f32(num4 / (length2 - 1)) * size);
      const lz = f32(f32(num3 / (length - 1)) * size);
      const hit = floor ? sampleMeshLocalYAndSlope(floor, lx, lz) : null;
      if (!hit || oceanLocalY - hit.localY < MINIMUM_SEAFLOOR_DEPTH || hit.slopeDegrees > MAX_DECORATION_SLOPE_DEGREES) continue;
      const rec = pickRecord(climateIndex, rng);
      // TryGetDecorationVisualHeight(record, 1.2f): the authored height at the largest a replacement may draw
      const authored = visualHeight(rec);
      if (!(authored > 0)) continue;
      const vh = f32(authored * Math.max(0.01, DECORATION_SCALE_MAX));
      const y = f32(hit.localY + seafloorClearance(rec));
      if (y >= oceanLocalY || f32(y + vh) > f32(oceanLocalY - SURFACE_DECORATION_CLEARANCE)) continue;
      const local = [lx, y, lz];
      if (canPlaceDecoration(local, spacingGrid)) positions.push({ archive: rec.archive, record: rec.record, local });
    }
  }
}

/** BuildDecorationPositions: the biome's passes until the cap (checked after each pass). */
export function buildDecorationPositions({ mapData, floor, climateIndex, passes, cap, rng, visualHeight }) {
  const positions = [];
  const spacingGrid = new Map();
  const n = decorationPassesForBiome(passes, climateIndex);
  for (let i = 0; i < n; i++) {
    generateBillboardPositions({ mapData, floor, climateIndex, positions, spacingGrid, rng, visualHeight });
    if (positions.length >= cap) break;
  }
  return positions;
}

/** TrimDecorationPositions: past the cap, a Fisher-Yates shuffle from the end (Random.Range(0, i + 1)), then cut. */
export function trimDecorationPositions(positions, cap, rng) {
  if (!positions || positions.length <= cap) return positions;
  for (let i = positions.length - 1; i > 0; i--) {
    const k = rng.range(0, i + 1);
    const t = positions[i]; positions[i] = positions[k]; positions[k] = t;
  }
  positions.length = cap;
  return positions;
}

/** GetDecorationCap: the setting, 1..2304 (the setting's own range is 64..2304). */
export const decorationCap = (maxPerTile) => Math.min(MAX_DECORATIONS_PER_TILE_HARD_CAP, Math.max(1, maxPerTile | 0));
/** GetPopulateRadius: the setting, 1..3. */
export const populateRadius = (radius) => Math.min(3, Math.max(1, radius | 0));

/**
 * PopulateTile's placement: the pixel's own stream, the passes rolled, the
 * positions built and trimmed. Null when the roll gave no pass (the pixel
 * is then marked current with none); otherwise the positions, which may be
 * none (the pixel is then asked again the next time it is queued).
 */
export function placeTileDecorations({ mapPixelX, mapPixelY, mapData, floor, climateIndex, frequency, cap, visualHeight }) {
  const rng = seededUnityRandom(tileDecorationSeed(mapPixelX, mapPixelY));
  const passes = rollDecorationPasses(frequency, rng);
  if (passes <= 0) return null;
  const positions = buildDecorationPositions({ mapData, floor, climateIndex, passes, cap, rng, visualHeight });
  if (positions.length) trimDecorationPositions(positions, cap, rng);
  return positions;
}

// ── GetEdgeCleanedTexture (UnderwaterDecorationBatchFactory) ────────
/** IsTransparentPadding: alpha under 16, or a near-black texel (every channel 12 or less). */
export function isTransparentPadding(data, i) {
  if (data[i + 3] < 16) return true;
  return data[i] <= 12 && data[i + 1] <= 12 && data[i + 2] <= 12;
}

/**
 * ClearEdgeBlackPixels: a flood from the texture's four edges through its
 * padding (4-neighbours) - every texel it reaches is made fully
 * transparent, so the black a sprite's outline carries against its
 * transparent surround goes and the sprite reads clean against the water.
 * `data` is RGBA, row by row. Returns true when a texel changed (the C#
 * then keeps the cleaned copy; false keeps the source).
 * @param {{width: number, height: number, data: Uint8Array | Uint8ClampedArray}} img
 */
export function clearEdgeBlackPixels(img) {
  const { width, height, data } = img;
  if (!(width > 0) || !(height > 0)) return false;
  const queued = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0, tail = 0;
  const enqueue = (x, y) => {
    const n = y * width + x;
    if (!queued[n] && isTransparentPadding(data, n * 4)) { queued[n] = 1; queue[tail++] = n; }
  };
  for (let i = 0; i < width; i++) { enqueue(i, 0); enqueue(i, height - 1); }
  for (let j = 1; j < height - 1; j++) { enqueue(0, j); enqueue(width - 1, j); }
  let changed = false;
  while (head < tail) {
    const n = queue[head++];
    if (data[n * 4 + 3] !== 0) { data[n * 4 + 3] = 0; changed = true; }
    const x = n % width, y = (n - x) / width;
    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < width) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < height) enqueue(x, y + 1);
  }
  return changed;
}
