// @ts-check
// WATER-LEVEL (2026-10-31, the owner: "We need to make sure we go away from the water tiles and move into a proper
// water shader"): A WATER BODY IS A LEVEL, NOT A TILE. A grid vertex the tiles mark as water stands at its body's level -
// the body's own law where one speaks (the sea, World 2.0, Cyrodiil: `levelAt`), else the uncarved ground - and the dry
// vertices beside it borrow that level, never above their own ground, so the plane runs on into the bank and the
// ground cuts it there. The sheet stands at the level; where it runs on over ground no higher than it, a cut field
// ends it. Drawn only: the feet and the townsfolk read the law's table. bible/07-Rendering/Water-Arc.md WATER-LEVEL.
import { WATER_DRAW_MASK_TABLE } from './waterCorners.js';
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
 * bed's halo cannot see a painted river) - and a Deep Waters clip is no vote.
 * @param {Uint8Array} bytes the converted tilemap, `tileDim` a row
 * @param {{stride?: number, tileDim?: number, width?: number, height?: number, table?: Uint8Array|number[]}} [o]
 * @returns {Float32Array|null} (width/stride + 1) x (height/stride + 1), x fastest; null where no tile is water
 */
export function waterVotes(bytes, { stride = 1, tileDim = 128, width = tileDim, height = tileDim, table = WATER_DRAW_MASK_TABLE } = {}) {
  const gx = width / stride + 1, gz = height / stride + 1, f = new Float32Array(gx * gz);
  /** a tile's corner bits, or -1 for no vote */
  const bitsAt = (tx, tz) => {
    if (!(tx >= 0 && tz >= 0 && tx < width && tz < height)) return -1;
    const b = bytes[tz * tileDim + tx];
    return b === CLIP_SENTINEL ? -1 : table[b];
  };
  let any = false;
  for (let vz = 0; vz < gz; vz++) {
    const cz = vz * stride;
    for (let vx = 0; vx < gx; vx++) {
      const cx = vx * stride, sw = bitsAt(cx - 1, cz - 1), se = bitsAt(cx, cz - 1), nw = bitsAt(cx - 1, cz), ne = bitsAt(cx, cz);
      const wet = (sw >= 0 && sw & 8 ? 1 : 0) + (se >= 0 && se & 4 ? 1 : 0) + (nw >= 0 && nw & 2 ? 1 : 0) + (ne >= 0 && ne & 1 ? 1 : 0);
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
  const n = gx * gz, level = new Float32Array(n).fill(NaN), cut = new Float32Array(n);
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
      let sum = 0, k = 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= gx || nz >= gz || !(votes[nz * gx + nx] > 0)) continue;
        sum += level[nz * gx + nx]; k++;
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
 * THE SHEET at its level: a quad whose four corners hold a level, one of them the water's own, as four triangles about
 * its centre (the tile's own water there, so water a tile wide keeps a middle). Attributes: the level; the depth over
 * the carved `ground` and the shading's (never under `bedDepths`, the bed's profile); the cut (waterLevels').
 * @param {{grid: Float32Array, ground: Float32Array, gx: number, gz: number, votes: Float32Array, level: Float32Array, cut: Float32Array, bedDepths?: ?Float32Array, bytes: Uint8Array, stride?: number, tileDim?: number, table?: Uint8Array|number[]}} o
 * @returns {{positions: Float32Array, depths: Float32Array, cut: Float32Array, indices: Uint32Array}|null}
 */
export function waterSheet({ grid, ground, gx, gz, votes, level, cut, bedDepths = null, bytes, stride = 1, tileDim = 128, table = WATER_DRAW_MASK_TABLE }) {
  const n = gx * gz;
  const quads = [];
  for (let z = 0; z < gz - 1; z++) {
    for (let x = 0; x < gx - 1; x++) {
      const i0 = z * gx + x, i1 = i0 + 1, i2 = i0 + gx, i3 = i2 + 1;
      if (!(Number.isFinite(level[i0]) && Number.isFinite(level[i1]) && Number.isFinite(level[i2]) && Number.isFinite(level[i3]))) continue;
      if (!(votes[i0] > 0 || votes[i1] > 0 || votes[i2] > 0 || votes[i3] > 0)) continue;
      if (clipped(bytes, x, z, stride, tileDim)) continue;   // Iliac Puddle No More's own sea stands there
      quads.push(i0);
    }
  }
  if (!quads.length) return null;
  const total = n + quads.length, positions = new Float32Array(total * 3), depths = new Float32Array(total * 2), cuts = new Float32Array(total);
  const shade = (i) => Math.max(level[i] - ground[i * 3 + 1], bedDepths ? bedDepths[i] : 0);
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(level[i])) continue;
    positions[i * 3] = grid[i * 3]; positions[i * 3 + 1] = level[i]; positions[i * 3 + 2] = grid[i * 3 + 2];
    depths[i * 2] = level[i] - ground[i * 3 + 1]; depths[i * 2 + 1] = shade(i);
    cuts[i] = cut[i];
  }
  const indices = new Uint32Array(quads.length * 12);
  quads.forEach((i0, q) => {
    const i1 = i0 + 1, i2 = i0 + gx, i3 = i2 + 1, c = n + q, x = i0 % gx, z = (i0 - x) / gx;
    const lv = (level[i0] + level[i1] + level[i2] + level[i3]) / 4, d = lv - centreGround(ground, i0, i3);
    positions[c * 3] = (grid[i0 * 3] + grid[i3 * 3]) / 2; positions[c * 3 + 1] = lv; positions[c * 3 + 2] = (grid[i0 * 3 + 2] + grid[i3 * 3 + 2]) / 2;
    depths[c * 2] = d; depths[c * 2 + 1] = Math.max(d, (shade(i0) + shade(i1) + shade(i2) + shade(i3)) / 4);
    const mean = (cut[i0] + cut[i1] + cut[i2] + cut[i3]) / 4;
    cuts[c] = stride === 1 ? Math.min(mean, 1 - 2 * corners(tileBits(bytes, x, z, tileDim, table))) : mean;
    const o = q * 12;
    indices[o] = c; indices[o + 1] = i0; indices[o + 2] = i2; indices[o + 3] = c; indices[o + 4] = i2; indices[o + 5] = i3;
    indices[o + 6] = c; indices[o + 7] = i3; indices[o + 8] = i1; indices[o + 9] = c; indices[o + 10] = i1; indices[o + 11] = i0;
  });
  return { positions, depths, cut: cuts, indices };
}

/** The cut the GPU interpolates at (fx, fy) in a sheet's quad - its four triangles about the centre (`cc`), corners
 *  `c00` (0,0), `c10` (1,0), `c01` (0,1), `c11` (1,1): the JS twin, for the pins. */
export function fanCut(c00, c10, c01, c11, cc, fx, fy) {
  const dx = fx - 0.5, dy = fy - 0.5, ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax === 0 && ay === 0) return cc;
  if (ax >= ay) {
    const s = dy / (2 * ax) + 0.5, a = dx < 0 ? c00 : c10, b = dx < 0 ? c01 : c11;
    return cc + 2 * ax * (a + (b - a) * s - cc);
  }
  const s = dx / (2 * ay) + 0.5, a = dy < 0 ? c00 : c01, b = dy < 0 ? c10 : c11;
  return cc + 2 * ay * (a + (b - a) * s - cc);
}

/** A tile's water corners (the draw's table), none for a clip. */
const tileBits = (bytes, x, z, tileDim, table) => { const b = bytes[z * tileDim + x]; return b === CLIP_SENTINEL ? 0 : table[b]; };
/** Does a quad of a stride-`stride` grid hold a tile Deep Waters clipped? */
function clipped(bytes, x, z, stride, tileDim) {
  for (let tz = z * stride; tz < (z + 1) * stride; tz++) for (let tx = x * stride; tx < (x + 1) * stride; tx++) if (bytes[tz * tileDim + tx] === CLIP_SENTINEL) return true;
  return false;
}

/** The sea's law as a level source: the sea's level where the uncarved ground stands at it (the kernel clamps the sea's
 *  ground up to it). */
export const seaLevelAt = (y) => (y <= SEA_LEVEL_Y + SEA_GROUND_EPSILON ? SEA_LEVEL_Y : NaN);

/** The buffers a sheet holds, for a worker's transfer list. */
export const sheetBuffers = (sheet) => (sheet ? [sheet.positions.buffer, sheet.depths.buffer, sheet.cut.buffer, sheet.indices.buffer] : []);
