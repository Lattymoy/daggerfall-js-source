// @ts-check
// A WATER BODY IS A LEVEL, NOT A TILE. A grid vertex the tiles mark as water stands at its body's level -
// the body's own law where one speaks (the sea, World 2.0, Cyrodiil: `levelAt`), else the uncarved ground - and the dry
// vertices beside it borrow that level, never above their own ground, so the plane runs on into the bank and the
// ground cuts it there. The sheet stands at the level; where it runs on over ground no higher than it, a smoothed cut
// field ends it, and on a rising bank the smoothed rise does. Drawn only: the feet and the townsfolk read the law's table.
import { WATER_DRAW_MASK_TABLE, RISE_MAX } from './waterCorners.js';
import { CLIP_SENTINEL } from '../terrain/terrainSurface.js';
import { SCALED_OCEAN_ELEVATION, STREAMING_TERRAIN_SCALE } from '../terrain/terrainSampler.js';

/** The sea's level in the scene: the kernel's ocean clamp at the streamed scale (34). */
export const SEA_LEVEL_Y = Math.fround(SCALED_OCEAN_ELEVATION * STREAMING_TERRAIN_SCALE);
/** How near the sea's level a vertex's ground stands to be the sea (the clamp, through a float). */
export const SEA_GROUND_EPSILON = 0.01;
/** How far a borrowing vertex's ground must stand over the level for the ground, not the cut field, to end the water
 *  there: past the sheet's lift and its calmest swell, so the depth test meets the plane inside the cell. */
export const DEPTH_CUT_RISE = 0.25;

/**
 * Each vertex's share of the tiles meeting it that call that corner water (the draw's table): 0 none, 1 all. A tile past
 * the map is no vote - each pixel marks its seam by its own tiles, so the two sides agree wherever both are water (the
 * bed's halo cannot see a painted river). A Deep Waters clip is the open sea, water at every corner.
 * @param {Uint8Array} bytes the converted tilemap, `tileDim` a row
 * @param {{stride?: number, tileDim?: number, width?: number, height?: number, table?: Uint8Array|number[]}} [o]
 * @returns {Float32Array|null} (width/stride + 1) x (height/stride + 1), x fastest; null where no tile is water
 */
export function waterVotes(
  bytes,
  { stride = 1, tileDim = 128, width = tileDim, height = tileDim, table = WATER_DRAW_MASK_TABLE } = {},
) {
  const gx = width / stride + 1,
    gz = height / stride + 1,
    f = new Float32Array(gx * gz);
  /** a tile's corner bits, or -1 for no vote */
  const bitsAt = (tx, tz) => {
    if (!(tx >= 0 && tz >= 0 && tx < width && tz < height)) return -1;
    return bitsOf(bytes[tz * tileDim + tx], table);
  };
  let any = false;
  for (let vz = 0; vz < gz; vz++) {
    const cz = vz * stride;
    for (let vx = 0; vx < gx; vx++) {
      const cx = vx * stride,
        sw = bitsAt(cx - 1, cz - 1),
        se = bitsAt(cx, cz - 1),
        nw = bitsAt(cx - 1, cz),
        ne = bitsAt(cx, cz);
      const wet =
        (sw >= 0 && sw & 8 ? 1 : 0) +
        (se >= 0 && se & 4 ? 1 : 0) +
        (nw >= 0 && nw & 2 ? 1 : 0) +
        (ne >= 0 && ne & 1 ? 1 : 0);
      if (!wet) continue;
      f[vz * gx + vx] = wet / ((sw >= 0 ? 1 : 0) + (se >= 0 ? 1 : 0) + (nw >= 0 ? 1 : 0) + (ne >= 0 ? 1 : 0));
      any = true;
    }
  }
  return any ? f : null;
}

/** The ground's two triangles meet on a quad's (0,0)-(1,1) diagonal (terrainSurface.js buildTerrainIndices), so the
 *  ground under a quad's centre is that diagonal's middle. */
const centreGround = (pos, i0, i3) => (pos[i0 * 3 + 1] + pos[i3 * 3 + 1]) / 2;
const corners = (m) => ((m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1)) / 4;

/**
 * THE LEVELS: a vertex the tiles mark takes `levelAt`'s level (vx, vz and its uncarved ground; NaN for none) or its
 * uncarved ground; a dry vertex beside one borrows its neighbours' mean, never above its own ground. The cut: 1 - 2 x
 * the vote share at the water's vertices; at a borrowing vertex -1 where its ground rises through the plane (the depth
 * test is the shore there), 1 where the plane runs on over it (the cut field ends it). NaN levels hold none.
 * @param {{grid: Float32Array, gx: number, gz: number, votes: Float32Array, levelAt?: ?((vx: number, vz: number, y: number) => number)}} o
 * @returns {{level: Float32Array, cut: Float32Array}}
 */
export function waterLevels({ grid, gx, gz, votes, levelAt = null }) {
  const n = gx * gz,
    level = new Float32Array(n).fill(NaN),
    cut = new Float32Array(n);
  for (let vz = 0; vz < gz; vz++) {
    for (let vx = 0; vx < gx; vx++) {
      const i = vz * gx + vx;
      if (!(votes[i] > 0)) continue;
      const own = levelAt ? levelAt(vx, vz, grid[i * 3 + 1]) : NaN;
      level[i] = Number.isFinite(own) ? own : grid[i * 3 + 1];
      cut[i] = 1 - 2 * votes[i];
    }
  }
  for (let z = 0; z < gz; z++) {
    for (let x = 0; x < gx; x++) {
      const i = z * gx + x;
      if (votes[i] > 0) continue;
      let sum = 0,
        k = 0;
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx,
            nz = z + dz;
          if (nx < 0 || nz < 0 || nx >= gx || nz >= gz || !(votes[nz * gx + nx] > 0)) continue;
          sum += level[nz * gx + nx];
          k++;
        }
      if (!k) continue;
      const y = grid[i * 3 + 1];
      level[i] = Math.min(sum / k, y);
      cut[i] = y > level[i] + DEPTH_CUT_RISE ? -1 : 1;
    }
  }
  return { level, cut };
}

/**
 * THE SHEET at its level: a quad whose four corners hold a level, one the water's own, as four triangles about its centre
 * (the tile's own water there). Attributes: the level; the depth over the carved `ground` and the shading's (never under
 * `bedDepths`); the cut (waterLevels'); `sea`, the clip's share about a vertex and its standing at the sea's
 * level. `shore` (stride 1): shoreMap's r the cut, g the bed's own water, b the clip's share, a the bank's rise.
 * @param {{grid: Float32Array, ground: Float32Array, gx: number, gz: number, votes: Float32Array, level: Float32Array, cut: Float32Array, bedDepths?: ?Float32Array, bytes: Uint8Array, stride?: number, tileDim?: number, table?: Uint8Array|number[]}} o
 * @returns {{positions: Float32Array, depths: Float32Array, cut: Float32Array, sea: Float32Array, shore: ?{w: number, h: number, data: Uint8Array}, indices: Uint32Array}|null}
 */
export function waterSheet({
  grid,
  ground,
  gx,
  gz,
  votes,
  level,
  cut,
  bedDepths = null,
  bytes,
  stride = 1,
  tileDim = 128,
  table = WATER_DRAW_MASK_TABLE,
}) {
  const n = gx * gz;
  const quads = [];
  for (let z = 0; z < gz - 1; z++) {
    for (let x = 0; x < gx - 1; x++) {
      const i0 = z * gx + x,
        i1 = i0 + 1,
        i2 = i0 + gx,
        i3 = i2 + 1;
      if (!(
        Number.isFinite(level[i0]) &&
        Number.isFinite(level[i1]) &&
        Number.isFinite(level[i2]) &&
        Number.isFinite(level[i3])
      ))
        continue;
      if (!(votes[i0] > 0 || votes[i1] > 0 || votes[i2] > 0 || votes[i3] > 0)) continue;
      quads.push(i0);
    }
  }
  if (!quads.length) return null;
  const total = n + quads.length,
    positions = new Float32Array(total * 3),
    depths = new Float32Array(total * 2),
    cuts = new Float32Array(total),
    sea = new Float32Array(total * 2);
  const shade = (i) => Math.max(level[i] - ground[i * 3 + 1], bedDepths ? bedDepths[i] : 0);
  const tilesWide = (gx - 1) * stride,
    tilesDeep = (gz - 1) * stride;
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(level[i])) continue;
    const col = i % gx,
      row = (i - col) / gx;
    positions[i * 3] = grid[i * 3];
    positions[i * 3 + 1] = level[i];
    positions[i * 3 + 2] = grid[i * 3 + 2];
    depths[i * 2] = level[i] - ground[i * 3 + 1];
    depths[i * 2 + 1] = shade(i);
    cuts[i] = cut[i];
    sea[i * 2] = clipShare(
      bytes,
      col * stride - 1,
      row * stride - 1,
      col * stride + 1,
      row * stride + 1,
      tilesWide,
      tilesDeep,
      tileDim,
    );
    sea[i * 2 + 1] = level[i] === SEA_LEVEL_Y ? 1 : 0;
  }
  const centre = (x, z) => {
    const corner = z * gx + x,
      at = (i) => (Number.isFinite(level[i]) ? cut[i] : 1);
    const mean = (at(corner) + at(corner + 1) + at(corner + gx) + at(corner + gx + 1)) / 4;
    return stride === 1 ? Math.min(mean, 1 - 2 * corners(bitsOf(bytes[z * tileDim + x], table))) : mean;
  };
  const indices = new Uint32Array(quads.length * 12);
  quads.forEach((i0, q) => {
    const i1 = i0 + 1,
      i2 = i0 + gx,
      i3 = i2 + 1,
      c = n + q,
      x = i0 % gx,
      z = (i0 - x) / gx;
    const lv = (level[i0] + level[i1] + level[i2] + level[i3]) / 4,
      d = lv - centreGround(ground, i0, i3);
    positions[c * 3] = (grid[i0 * 3] + grid[i3 * 3]) / 2;
    positions[c * 3 + 1] = lv;
    positions[c * 3 + 2] = (grid[i0 * 3 + 2] + grid[i3 * 3 + 2]) / 2;
    depths[c * 2] = d;
    depths[c * 2 + 1] = Math.max(d, (shade(i0) + shade(i1) + shade(i2) + shade(i3)) / 4);
    cuts[c] = centre(x, z);
    sea[c * 2] = clipShare(
      bytes,
      x * stride,
      z * stride,
      (x + 1) * stride,
      (z + 1) * stride,
      tilesWide,
      tilesDeep,
      tileDim,
    );
    sea[c * 2 + 1] = (sea[i0 * 2 + 1] + sea[i1 * 2 + 1] + sea[i2 * 2 + 1] + sea[i3 * 2 + 1]) / 4;
    const o = q * 12;
    indices[o] = c;
    indices[o + 1] = i0;
    indices[o + 2] = i2;
    indices[o + 3] = c;
    indices[o + 4] = i2;
    indices[o + 5] = i3;
    indices[o + 6] = c;
    indices[o + 7] = i3;
    indices[o + 8] = i1;
    indices[o + 9] = c;
    indices[o + 10] = i1;
    indices[o + 11] = i0;
  });
  let shore = null;
  if (stride === 1) {
    const quadCount = (gx - 1) * (gz - 1),
      cutAt = new Float32Array(n),
      wet = new Float32Array(n),
      open = new Float32Array(n),
      rise = new Float32Array(n);
    const cutMid = new Float32Array(quadCount),
      wetMid = new Float32Array(quadCount),
      openMid = new Float32Array(quadCount),
      riseMid = new Float32Array(quadCount);
    for (let i = 0; i < n; i++) {
      const col = i % gx,
        row = (i - col) / gx;
      cutAt[i] = Number.isFinite(level[i]) ? cut[i] : 1;
      wet[i] = 1 - 2 * (votes[i] > 0 ? votes[i] : 0);
      open[i] = clipShare(bytes, col - 1, row - 1, col + 1, row + 1, tilesWide, tilesDeep, tileDim);
      rise[i] = Number.isFinite(level[i]) ? Math.max(0, ground[i * 3 + 1] - level[i]) : RISE_MAX;
    }
    for (let z = 0; z < gz - 1; z++) {
      for (let x = 0; x < gx - 1; x++) {
        const near = z * gx + x,
          k = z * (gx - 1) + x,
          tile = bytes[z * tileDim + x],
          far = near + gx + 1;
        cutMid[k] = centre(x, z);
        wetMid[k] = Math.min(
          (wet[near] + wet[near + 1] + wet[near + gx] + wet[far]) / 4,
          1 - 2 * corners(bitsOf(tile, table)),
        );
        openMid[k] = tile === CLIP_SENTINEL ? 1 : 0;
        const meanLevel = (level[near] + level[near + 1] + level[near + gx] + level[far]) / 4;
        riseMid[k] = Number.isFinite(meanLevel) ? Math.max(0, centreGround(ground, near, far) - meanLevel) : RISE_MAX;
      }
    }
    const cutField = shoreMap(gx, gz, cutAt, cutMid).field,
      wetField = shoreMap(gx, gz, wet, wetMid).field,
      openMap = shoreMap(gx, gz, open, openMid, OPEN_SIGMA, Infinity);
    const riseField = shoreMap(gx, gz, rise, riseMid, RISE_SIGMA, Infinity).field,
      data = new Uint8Array(openMap.field.length * 4);
    for (let k = 0; k < openMap.field.length; k++) {
      data[k * 4] = toByte(cutField[k]);
      data[k * 4 + 1] = toByte(wetField[k]);
      data[k * 4 + 2] = Math.round(openMap.field[k] * 255);
      data[k * 4 + 3] = Math.round(Math.min(1, riseField[k] / RISE_MAX) * 255);
    }
    shore = { w: openMap.w, h: openMap.h, data };
  }
  return { positions, depths, cut: cuts, sea, shore, indices };
}

/** The Gaussian's spread over the fan's field, in tiles - wide enough to round a tile's step into the
 *  coast's own line. */
export const SHORE_SIGMA = 0.6;
/** How far the smoothed field may stray from the fan's (a straight shore runs 2 a tile), so a stream or a
 *  pool a tile wide keeps its heart and a causeway its spine. */
export const SHORE_HOLD = 0.7;
/** The clip's share's spread, in tiles - the band over which the open sea's look fades in. */
export const OPEN_SIGMA = 1;
/** THE BANK'S RISE - how far the drawn ground stands over the plane (0 under it), smoothed by RISE_SIGMA
 *  tiles, enough to iron out a triangle's zigzag; the texel holds 0 to RISE_MAX units (waterCorners.js, the program's
 *  read too), a vertex with no level the most. The program fades the water out on it (waterSurface.js RISE_FADE). */
export const RISE_SIGMA = 0.35;
export { RISE_MAX };

/**
 * A SHORE IS A LINE, NOT A TILE'S EDGE. The fan's field (`corner` at the vertices of a `gx` x `gz` grid,
 * `centre` at its quads' middles) on a lattice of half tiles, blurred by SHORE_SIGMA and held within SHORE_HOLD of
 * itself. The GPU reads it bilinear (renderer.js createWaterSheet), so the zero line - the shore - is a curve.
 * @param {number} gx @param {number} gz @param {Float32Array} corner @param {Float32Array} centre
 * @param {number} [sigma] @param {number} [hold]
 * @returns {{w: number, h: number, field: Float32Array}} (2 gx - 1) x (2 gz - 1), x fastest
 */
export function shoreMap(gx, gz, corner, centre, sigma = SHORE_SIGMA, hold = SHORE_HOLD) {
  const cols = 2 * gx - 1,
    rows = 2 * gz - 1,
    fan = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = i >> 1,
        z = j >> 1,
        at = z * gx + x;
      fan[j * cols + i] =
        i & 1
          ? j & 1
            ? centre[z * (gx - 1) + x]
            : (corner[at] + corner[at + 1]) / 2
          : j & 1
            ? (corner[at] + corner[at + gx]) / 2
            : corner[at];
    }
  }
  const spread = 2 * sigma,
    reach = Math.ceil(2.5 * spread),
    kernel = new Float32Array(2 * reach + 1);
  let sum = 0;
  for (let step = -reach; step <= reach; step++)
    sum += kernel[step + reach] = Math.exp(-(step * step) / (2 * spread * spread));
  for (let step = 0; step <= 2 * reach; step++) kernel[step] /= sum;
  const tmp = new Float32Array(cols * rows),
    field = new Float32Array(cols * rows);
  blurLine(fan, tmp, cols, rows, 1, cols, kernel, reach);
  blurLine(tmp, field, rows, cols, cols, 1, kernel, reach);
  for (let i = 0; i < cols * rows; i++) field[i] = Math.max(fan[i] - hold, Math.min(fan[i] + hold, field[i]));
  return { w: cols, h: rows, field };
}

/** One pass of a separable blur: `n` lines of `len` samples, `step` apart within a line and `across` between lines,
 *  the edge sample held past the end. */
function blurLine(src, dst, len, n, step, across, kernel, reach) {
  for (let line = 0; line < n; line++) {
    const base = line * across;
    for (let i = 0; i < len; i++) {
      let sum = 0;
      if (i >= reach && i < len - reach)
        for (let off = -reach, at = base + (i - reach) * step; off <= reach; off++, at += step)
          sum += kernel[off + reach] * src[at];
      else
        for (let off = -reach; off <= reach; off++)
          sum += kernel[off + reach] * src[base + Math.min(len - 1, Math.max(0, i + off)) * step];
      dst[base + i * step] = sum;
    }
  }
}

/** A field in -1..1 as a texel byte (0 at -1, 255 at 1). */
const toByte = (value) => Math.round((Math.max(-1, Math.min(1, value)) + 1) * 127.5);
/** The share of the tiles [x0, x1) x [z0, z1) inside the map (`width` x `height`) Deep Waters clipped. */
function clipShare(bytes, x0, z0, x1, z1, width, height, tileDim) {
  let k = 0,
    all = 0;
  for (let z = Math.max(0, z0); z < Math.min(height, z1); z++)
    for (let x = Math.max(0, x0); x < Math.min(width, x1); x++) {
      all++;
      if (bytes[z * tileDim + x] === CLIP_SENTINEL) k++;
    }
  return all ? k / all : 0;
}

/** The cut the GPU interpolates at (fx, fy) in a sheet's quad - its four triangles about the centre (`cc`), corners
 *  `c00` (0,0), `c10` (1,0), `c01` (0,1), `c11` (1,1): the JS twin, for the pins. */
export function fanCut(c00, c10, c01, c11, cc, fx, fy) {
  const dx = fx - 0.5,
    dy = fy - 0.5,
    ax = Math.abs(dx),
    ay = Math.abs(dy);
  if (ax === 0 && ay === 0) return cc;
  if (ax >= ay) {
    const s = dy / (2 * ax) + 0.5,
      a = dx < 0 ? c00 : c10,
      b = dx < 0 ? c01 : c11;
    return cc + 2 * ax * (a + (b - a) * s - cc);
  }
  const s = dx / (2 * ay) + 0.5,
    a = dy < 0 ? c00 : c01,
    b = dy < 0 ? c10 : c11;
  return cc + 2 * ay * (a + (b - a) * s - cc);
}

/** A tile's water corners (the draw's table) - all four for a Deep Waters clip, the open sea. */
const bitsOf = (b, table) => (b === CLIP_SENTINEL ? 15 : table[b]);

/** The sea's law as a level source: the sea's level where the uncarved ground stands at it (the kernel clamps the sea's
 *  ground up to it). */
export const seaLevelAt = (y) => (y <= SEA_LEVEL_Y + SEA_GROUND_EPSILON ? SEA_LEVEL_Y : NaN);

/** The buffers a sheet holds, for a worker's transfer list. */
export const sheetBuffers = (sheet) =>
  sheet
    ? [
        sheet.positions.buffer,
        sheet.depths.buffer,
        sheet.cut.buffer,
        sheet.sea.buffer,
        ...(sheet.shore ? [sheet.shore.data.buffer] : []),
        sheet.indices.buffer,
      ]
    : [];
