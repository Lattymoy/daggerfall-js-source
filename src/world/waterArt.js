// THE ART'S OWN WATER (WATER4, 2026-09-11; WATER5 the same day: PER
// TEXEL, AND THE DISTANCE TO THE SHORE). Mac: "its still not taking
// into account all the water textures that are on land, and its not
// traced well, just square" - and of WATER4's 16x16 cells, "it's still
// not a perfect trace."
//
// WATER1 drew water by CORNER: a 256-entry table says which corners of
// a record are water (world/waterCorners.js) and the shader blends the
// four, so every shore was a straight diagonal or a straight edge, and
// a record whose water reaches no corner - the puddle in the middle of
// a dirt tile, a pond's inner bank - drew no water at all. WATER4 read
// the art, but averaged it into 4x4-texel cells and blended between
// them: anything finer than a cell smeared, corners rounded, and the
// shore landed where 40% of a cell was water. The classic art is
// pixels, and a perfect trace is PER PIXEL. Every terrain record is a
// 64x64 indexed bitmap, and record 0 - the water tile - is painted in
// nothing but water, so its palette indices ARE the archive's water
// (widened by colour: an index whose palette colour sits within
// WATER_COLOUR_TOLERANCE of one of record 0's is water too, so a shore
// record's lighter or darker blues count). This leaf reads one
// archive's bitmaps once and mints:
//
//   mask      per record, per texel, 0 or 1 in the RECORD's own frame
//             (before the tile's turn) - the water is exactly the
//             texels the art paints water;
//   sdf       per record, per texel, the SIGNED DISTANCE to the shore
//             in texels, encoded to a byte about 128 (the shore) over
//             ±SDF_RANGE: positive inside the water, negative outside,
//             the texel boundary at zero. The renderer uploads it as a
//             TEXTURE_2D_ARRAY of the tile array's own shape (64 x 64 x
//             records, LINEAR) and the water shader reads it at the very
//             uv TERRAIN_FS draws the record's texel by (its ROT/TRANS,
//             render/renderer.js): the edge is the field's zero
//             crossing, feathered over one screen pixel - on the art's
//             outline at any distance, with no shimmer; and the foam
//             band and the feet read the same number;
//   any       by CONVERTED tile byte (record << 2 | turn), whether the
//             record draws water at all (a quad enters the pass on it,
//             a town enters the pass on it);
//   corners   by converted byte, the record's four corners as WATER1's
//             bits (1 = (0,0), 2 = (1,0), 4 = (0,1), 8 = (1,1) in the
//             tilemap's frame): the corner TEXEL, read through the turn
//             - the basin (render/waterBasin.js) carves by these.
//
// artDistance is the shader's read on the CPU, texel-exact (NEAREST, as
// the ground samples its own texel); artCoverage folds it to 0..1 about
// 0.5 for MAC2's law (the player swims where the surface is drawn -
// player/exteriorSurface.js). The corner table is not retired: it is
// the fallback where no art is loaded (the tests, the lab's `?noart`).
// `?water=mask` paints the mask over the ground, for the eye that judges
// the trace.

/** The record's side in texels: the classic terrain tile. */
export const ART_SIZE = 64;
/** The distance field's reach, in texels, either side of the shore -
 *  the foam band lives inside it (0.8 units at a 6.4-unit tile). */
export const SDF_RANGE = 8;
/** How far (Euclidean RGB, 0..255 a channel) from one of record 0's
 *  colours an index may sit and still be water: a shore record's
 *  lighter or darker blue counts, a brown does not. */
export const WATER_COLOUR_TOLERANCE = 24;

/** The tile's four turns as TERRAIN_FS applies them: the fragment's
 *  fraction inside the tile (x along the row, y along the column)
 *  becomes the record's own uv. GLSL's mat2 is column-major, so the
 *  shader's `ROT[t] * f + TRANS[t]` is, turn by turn, exactly this. */
export const ART_TURN = Object.freeze([
  (x, y) => [x, y],
  (x, y) => [y, 1 - x],
  (x, y) => [1 - x, 1 - y],
  (x, y) => [1 - y, x],
]);

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The palette indices that are water: record 0's own, and - with a
 *  palette to read colours from - every index within the tolerance of
 *  one of record 0's colours. */
export function waterIndexSet(waterBitmap, palette = waterBitmap?.palette ?? null, tolerance = WATER_COLOUR_TOLERANCE) {
  const set = new Set();
  const d = waterBitmap?.data;
  if (d) for (let i = 0; i < d.length; i++) set.add(d[i]);
  if (!palette || typeof palette.get !== 'function' || !set.size) return set;
  const own = [...set].map((i) => palette.get(i));
  const t2 = tolerance * tolerance;
  for (let i = 0; i < 256; i++) {
    if (set.has(i)) continue;
    const c = palette.get(i);
    if (!c) continue;
    for (const w of own) {
      const dr = c.r - w.r, dg = c.g - w.g, db = c.b - w.b;
      if (dr * dr + dg * dg + db * db <= t2) { set.add(i); break; }
    }
  }
  return set;
}

/** One record's water mask: a byte per texel (1 water, 0 dry) in the
 *  record's frame, row-major (y * ART_SIZE + x). A record the archive
 *  does not carry, or of another size, is all dry. */
export function recordMask(bitmap, waterSet, size = ART_SIZE) {
  const out = new Uint8Array(size * size);
  const w = bitmap?.width | 0, h = bitmap?.height | 0, d = bitmap?.data;
  if (!d || w !== size || h !== size) return out;
  for (let i = 0; i < size * size; i++) out[i] = waterSet.has(d[i]) ? 1 : 0;
  return out;
}

// Felzenszwalb & Huttenlocher's one-dimensional squared distance
// transform: f is the row's seed cost (0 at a seed, INF elsewhere), out
// its squared distance to the nearest seed. Exact, linear.
const INF = 1e12;
function edt1d(f, n, out, v, z) {
  let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; out[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}
/** Squared Euclidean distance from every texel to the nearest texel
 *  where `seed(i)` is true; INF where there is none. */
function edt2d(seed, size) {
  const g = new Float64Array(size * size);
  for (let i = 0; i < size * size; i++) g[i] = seed(i) ? 0 : INF;
  const f = new Float64Array(size), o = new Float64Array(size), v = new Int32Array(size), z = new Float64Array(size + 1);
  for (let x = 0; x < size; x++) {   // columns
    for (let y = 0; y < size; y++) f[y] = g[y * size + x];
    edt1d(f, size, o, v, z);
    for (let y = 0; y < size; y++) g[y * size + x] = o[y];
  }
  for (let y = 0; y < size; y++) {   // rows
    for (let x = 0; x < size; x++) f[x] = g[y * size + x];
    edt1d(f, size, o, v, z);
    for (let x = 0; x < size; x++) g[y * size + x] = o[x];
  }
  return g;
}

/**
 * The signed distance of every texel to the shore, in texels: positive
 * in the water, negative on the dry, the distance to the nearest texel
 * of the other kind less a half - so a texel on either side of the
 * shore reads ±0.5 and the field crosses zero ON the texel boundary. A
 * record all water or all dry reads ±SDF_RANGE throughout.
 */
export function signedDistance(mask, size = ART_SIZE, range = SDF_RANGE) {
  const n = size * size;
  const out = new Float32Array(n);
  let wet = 0;
  for (let i = 0; i < n; i++) wet += mask[i];
  if (wet === 0) return out.fill(-range);
  if (wet === n) return out.fill(range);
  const toDry = edt2d((i) => !mask[i], size), toWet = edt2d((i) => !!mask[i], size);
  for (let i = 0; i < n; i++) {
    const d = mask[i] ? Math.sqrt(toDry[i]) - 0.5 : -(Math.sqrt(toWet[i]) - 0.5);
    out[i] = d > range ? range : d < -range ? -range : d;
  }
  return out;
}

/** The field's byte: 128 is the shore, 255 is +SDF_RANGE, 1 is -SDF_RANGE. */
export const encodeDistance = (d, range = SDF_RANGE) => Math.round(128 + Math.max(-range, Math.min(range, d)) * (127 / range));
/** ...and back, as the shader decodes it: (byte - 128) * (SDF_RANGE / 127). */
export const decodeDistance = (byte, range = SDF_RANGE) => (byte - 128) * (range / 127);

/**
 * The texel under a point of a tile, in the record's frame: the
 * CONVERTED tile byte (record << 2 | turn, as the tilemap texture
 * carries it and the shader reads it) and the fraction inside the tile
 * in the tilemap's frame (the shader's `fract(vLocalXZ / tile)`, x
 * along the row, y along the column), turned as TERRAIN_FS turns it
 * and taken NEAREST with CLAMP_TO_EDGE, as the ground samples the same
 * texel. Answers [tx, ty] in 0..ART_SIZE-1.
 */
export function artTexel(art, convertedByte, fx, fy) {
  const t = convertedByte & 3, size = art?.size ?? ART_SIZE;
  const [u, v] = ART_TURN[t](clamp01(fx), clamp01(fy));
  const tx = Math.min(size - 1, Math.floor(clamp01(u) * size)), ty = Math.min(size - 1, Math.floor(clamp01(v) * size));
  return [tx, ty];
}

/** The art's signed distance to the shore under a point of a tile, in
 *  texels (the shader's read on the CPU); -SDF_RANGE off the art. */
export function artDistance(art, convertedByte, fx, fy) {
  const layer = (convertedByte & 0xff) >> 2;
  if (!art || layer >= art.records) return -SDF_RANGE;
  const [tx, ty] = artTexel(art, convertedByte, fx, fy);
  return decodeDistance(art.sdf[layer * art.size * art.size + ty * art.size + tx], art.range);
}

/** 0..1 about the shore: the distance folded so that 0.5 is the
 *  shoreline and 1 a texel into the water - what the feet compare to
 *  MAC2's SWIM_COVERAGE (0.5): at or past it the texel is water. */
export const artCoverage = (art, convertedByte, fx, fy) => clamp01(0.5 + artDistance(art, convertedByte, fx, fy));

/** WATER1's corner bits of one converted byte, read off the art: the
 *  corner texel itself, through the turn. */
export function artCornerMask(art, convertedByte) {
  let m = 0;
  if (artDistance(art, convertedByte, 0, 0) >= 0) m |= 1;
  if (artDistance(art, convertedByte, 1, 0) >= 0) m |= 2;
  if (artDistance(art, convertedByte, 0, 1) >= 0) m |= 4;
  if (artDistance(art, convertedByte, 1, 1) >= 0) m |= 8;
  return m;
}

/**
 * Read one archive's water off its own bitmaps: `bitmaps[r]` is record
 * r's first frame as textureFile.getDFBitmap answers it (an indexed
 * {width, height, data, palette}), record 0 the water. Null when there
 * is no record 0 to learn the water's palette from.
 *
 * @returns {{size: number, range: number, records: number, mask: Uint8Array,
 *            sdf: Uint8Array, any: Uint8Array, corners: Uint8Array} | null}
 *   mask / sdf: records * size * size bytes, record-major (the texture
 *   array's layers); any / corners: 256 entries by converted byte.
 */
export function buildWaterArt(bitmaps, { tolerance = WATER_COLOUR_TOLERANCE } = {}) {
  if (!bitmaps?.length || !bitmaps[0]?.data?.length) return null;
  const set = waterIndexSet(bitmaps[0], bitmaps[0].palette ?? null, tolerance);
  const size = ART_SIZE, n = size * size;
  const records = Math.min(bitmaps.length, 64);   // the converted byte carries six bits of record
  const mask = new Uint8Array(records * n), sdf = new Uint8Array(records * n);
  const wetRecord = new Uint8Array(records);
  for (let r = 0; r < records; r++) {
    const m = recordMask(bitmaps[r], set, size);
    mask.set(m, r * n);
    const d = signedDistance(m, size, SDF_RANGE);
    for (let i = 0; i < n; i++) { sdf[r * n + i] = encodeDistance(d[i], SDF_RANGE); if (m[i]) wetRecord[r] = 1; }
  }
  const art = { size, range: SDF_RANGE, records, mask, sdf, any: new Uint8Array(256), corners: new Uint8Array(256) };
  for (let r = 0; r < records; r++) {
    for (let t = 0; t < 4; t++) {
      const byte = (r << 2) | t;
      art.any[byte] = wetRecord[r];
      art.corners[byte] = wetRecord[r] ? artCornerMask(art, byte) : 0;
    }
  }
  return art;
}
