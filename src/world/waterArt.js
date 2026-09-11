// THE ART'S OWN WATER (WATER4, 2026-09-11). Mac: "its still not taking
// into account all the water textures that are on land, and its not
// traced well, just square."
//
// WATER1 drew water by CORNER: a 256-entry table says which corners of
// a record are water (world/waterCorners.js) and the shader blends the
// four, so every shore was a straight diagonal or a straight edge, and
// a record whose water reaches no corner - the puddle in the middle of
// a dirt tile, a pond's inner bank - drew no water at all. The classic
// art knows better. Every terrain record is a 64x64 indexed bitmap, and
// the texels that are water are the texels painted in RECORD 0's
// palette indices: the water tile is nothing but water, so its index
// set IS the archive's water palette. This leaf reads one archive's
// bitmaps once and mints three things:
//
//   coverage  an ART_GRID x ART_GRID box average of "is water" per
//             record, in the RECORD's own frame (before the tile's
//             rotation), 0..255 - the renderer uploads it as one R8
//             texture ART_GRID wide and ART_GRID * records tall, and
//             the water shader samples it bilinearly at the very uv
//             TERRAIN_FS reads the record's texel by (its ROT/TRANS,
//             render/renderer.js), so the shore is the art's own
//             outline, feathered between cells;
//   any       by CONVERTED tile byte (record << 2 | turn), whether the
//             record draws water at all - a quad enters the water pass
//             on it, a town enters the pass on it;
//   corners   by converted byte, the record's four corners as WATER1's
//             bits (1 = (0,0), 2 = (1,0), 4 = (0,1), 8 = (1,1) in the
//             tilemap's frame), read off the art THROUGH the rotation -
//             the basin (render/waterBasin.js) carves its vertices by
//             these, exactly as it carved by the hand-made table.
//
// artCoverage is the shader's sample on the CPU, for the feet: MAC2's
// law (the player swims where the surface is drawn) rides it through
// artShore, the shader's own shore ramp, so the feet cross into water
// where the eye sees the water begin (player/exteriorSurface.js).
//
// The corner table is not retired: it is the fallback where no art is
// loaded (the tests, a lab without the archive), and the shape the
// basin and the feet read when the archive's bitmaps are not there.

/** Coverage cells per tile side: 64 texels in 16 cells of 4x4, so a
 *  dithered shore averages to a fraction instead of a checker, and the
 *  bilinear between cells traces the outline at 0.4 units. */
export const ART_GRID = 16;
/** The shore ramp over the art's coverage: nothing under the first,
 *  the whole body past the second, smoothstep between. A dither is
 *  fractional coverage, so the ramp sits LOW - half-water reads as
 *  water, not as lace. */
export const ART_SHORE = Object.freeze([0.2, 0.6]);
/** The coverage at which a corner or the feet are IN water: the ramp's
 *  midpoint, where artShore crosses the shader's (and MAC2's) 0.5. */
export const ART_WET = (ART_SHORE[0] + ART_SHORE[1]) / 2;

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

/** The shader's shore ramp: smoothstep(ART_SHORE[0], ART_SHORE[1], coverage). */
export function artShore(coverage) {
  const x = clamp01((coverage - ART_SHORE[0]) / (ART_SHORE[1] - ART_SHORE[0]));
  return x * x * (3 - 2 * x);
}

/** The palette indices record 0 is painted in - the archive's water. */
export function waterIndexSet(waterBitmap) {
  const set = new Set();
  const d = waterBitmap?.data;
  if (d) for (let i = 0; i < d.length; i++) set.add(d[i]);
  return set;
}

/**
 * One record's coverage grid: ART_GRID x ART_GRID box averages of
 * "this texel's index is in the water set", row-major in the record's
 * frame (cell (u, v) at v * grid + u), 0..255. An empty bitmap (a
 * record the archive does not carry) is all dry.
 */
export function recordCoverage(bitmap, waterSet, grid = ART_GRID) {
  const out = new Uint8Array(grid * grid);
  const w = bitmap?.width | 0, h = bitmap?.height | 0, d = bitmap?.data;
  if (!d || w <= 0 || h <= 0) return out;
  for (let cv = 0; cv < grid; cv++) {
    const y0 = Math.floor(cv * h / grid), y1 = Math.max(y0 + 1, Math.floor((cv + 1) * h / grid));
    for (let cu = 0; cu < grid; cu++) {
      const x0 = Math.floor(cu * w / grid), x1 = Math.max(x0 + 1, Math.floor((cu + 1) * w / grid));
      let wet = 0, n = 0;
      for (let y = y0; y < y1 && y < h; y++) {
        const row = y * w;
        for (let x = x0; x < x1 && x < w; x++) { n++; if (waterSet.has(d[row + x])) wet++; }
      }
      out[cv * grid + cu] = n ? Math.round(255 * wet / n) : 0;
    }
  }
  return out;
}

/** The bilinear read of one record's grid at texel coordinates
 *  (ax, ay), texel centres at half-integers, clamped a half-texel in
 *  from the edge - the way LINEAR sampling with CLAMP_TO_EDGE reads
 *  the uploaded texture. */
function sampleGrid(coverage, base, grid, ax, ay) {
  const lo = 0.5, hi = grid - 0.5;
  const x = (ax < lo ? lo : ax > hi ? hi : ax) - 0.5;
  const y = (ay < lo ? lo : ay > hi ? hi : ay) - 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, grid - 1), y1 = Math.min(y0 + 1, grid - 1);
  const tx = x - x0, ty = y - y0;
  const v = (xx, yy) => coverage[base + yy * grid + xx] / 255;
  const top = v(x0, y0) + (v(x1, y0) - v(x0, y0)) * tx;
  const bottom = v(x0, y1) + (v(x1, y1) - v(x0, y1)) * tx;
  return top + (bottom - top) * ty;
}

/**
 * The art's water coverage (0..1) under a point of a tile: the
 * CONVERTED tile byte (record << 2 | turn, as the tilemap texture
 * carries it and the shader reads it) and the fraction inside the tile
 * in the tilemap's frame - the shader's `fract(vLocalXZ / tile)`,
 * x along the row, y along the column. The shader's sample, on the CPU.
 */
export function artCoverage(art, convertedByte, fx, fy) {
  const layer = (convertedByte & 0xff) >> 2, t = convertedByte & 3;
  if (!art || layer >= art.records) return 0;
  const g = art.grid;
  const [u, v] = ART_TURN[t](clamp01(fx), clamp01(fy));
  return sampleGrid(art.coverage, layer * g * g, g, clamp01(u) * g, clamp01(v) * g);
}

/** WATER1's corner bits of one converted byte, read off the art:
 *  bit 1 = (0,0), 2 = (1,0), 4 = (0,1), 8 = (1,1) of the tilemap's
 *  frame, each wet at or past ART_WET. */
export function artCornerMask(art, convertedByte) {
  let m = 0;
  if (artCoverage(art, convertedByte, 0, 0) >= ART_WET) m |= 1;
  if (artCoverage(art, convertedByte, 1, 0) >= ART_WET) m |= 2;
  if (artCoverage(art, convertedByte, 0, 1) >= ART_WET) m |= 4;
  if (artCoverage(art, convertedByte, 1, 1) >= ART_WET) m |= 8;
  return m;
}

/**
 * Read one archive's water off its own bitmaps: `bitmaps[r]` is record
 * r's first frame as textureFile.getDFBitmap answers it (an indexed
 * {width, height, data}), record 0 the water. Null when there is no
 * record 0 to learn the water's palette from.
 *
 * @returns {{grid: number, records: number, coverage: Uint8Array,
 *            any: Uint8Array, corners: Uint8Array} | null}
 *   coverage: records * grid * grid bytes, record-major (the texture's
 *   rows); any / corners: 256 entries by converted byte.
 */
export function buildWaterArt(bitmaps, { grid = ART_GRID } = {}) {
  if (!bitmaps?.length || !bitmaps[0]?.data?.length) return null;
  const set = waterIndexSet(bitmaps[0]);
  const records = Math.min(bitmaps.length, 64);   // the converted byte carries six bits of record
  const coverage = new Uint8Array(records * grid * grid);
  const wetRecord = new Uint8Array(records);
  for (let r = 0; r < records; r++) {
    const c = recordCoverage(bitmaps[r], set, grid);
    coverage.set(c, r * grid * grid);
    let max = 0;
    for (let i = 0; i < c.length; i++) if (c[i] > max) max = c[i];
    wetRecord[r] = max > ART_SHORE[0] * 255 ? 1 : 0;   // below the ramp's foot the shader draws nothing of it
  }
  const art = { grid, records, coverage, any: new Uint8Array(256), corners: new Uint8Array(256) };
  for (let r = 0; r < records; r++) {
    for (let t = 0; t < 4; t++) {
      const byte = (r << 2) | t;
      art.any[byte] = wetRecord[r];
      art.corners[byte] = wetRecord[r] ? artCornerMask(art, byte) : 0;
    }
  }
  return art;
}
