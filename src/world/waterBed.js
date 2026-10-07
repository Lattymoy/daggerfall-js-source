// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WATER-NEXT 2 - THE BED (2026-10-07, Mac: "real translucent water with proper waves and shoreline interactivity
// completely replacing our current water implementation"): CLEAR WATER MUST HAVE SOMETHING UNDER IT.
//
// Daggerfall's water is a tile of the ground: a pond, a river, a moat is the ground itself, painted, at the height the
// ground stands. WATER1 drew its sheet a hand's breadth over that ground, so nothing could be seen THROUGH it - there
// was nothing under it but the paint. Here the ground the eye sees is lowered under the water into a bowl, and the
// water's sheet stays where the ground was:
//
//   - A grid vertex is WET when every tile that meets it calls that corner water (WATER1's corner table, the draw's -
//     world/waterCorners.js WATER_DRAW_MASK_TABLE); a corner one tile calls dry is the bank. A tile past the map's edge
//     is no vote, so a river crossing a pixel's seam is not dammed at it.
//   - Its distance to the bank is a 3-4 chamfer transform over the grid (exact enough at a tile's resolution), in world
//     units at the grid's own stride.
//   - The depth eases off the bank - a shallow shelf, a slope, a flat heart (`bedProfile`) - to BED_DEPTH over BED_RAMP.
//
// DRAWN ONLY. `carveBed` lowers a COPY of the uploaded positions and re-lights the slopes it made; the game's ground -
// world.js heightAt over the pixel's samples, the fixed town's flat quad - never moves: the feet swim, the foes stand
// and the flats are seated where DFU has them. The sheet takes the grid AS IT STOOD and the depth under each vertex,
// so the water knows, at every pixel it draws, how much water lies under it (WATER-NEXT's shading reads it).
// ═══════════════════════════════════════════════════════════════════
import { WATER_DRAW_MASK_TABLE } from './waterCorners.js';

/** The bed's depth at the heart of wide water, world units (a tile is 6.4; a man stands about 1.8). */
export const BED_DEPTH = 4.0;
/** How far from the bank the bed reaches its depth, world units (three tiles). */
export const BED_RAMP = 19.2;
/** A tile's side, world units. */
export const TILE_UNITS = 6.4;

/** 0..1 off the bank: a smoothstep - a shallow shelf off the bank (where clear water shows its bed), the slope
 *  steepest between, the middle flat. The real game's first shots (the moat) took an ease-out: a tile from the bank
 *  was already 2.2 deep, and the shallows the eye looks for were a sliver. */
export const bedProfile = (t) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };

/**
 * Every grid vertex's bed depth (world units, 0 on and beyond the bank).
 * @param {Uint8Array} bytes the CONVERTED tilemap (record << 2 | turn), row-major, `tileDim` a row
 * @param {{stride?: number, tileDim?: number, width?: number, height?: number, table?: Uint8Array|number[]}} [o]
 *   `width`/`height` the tiles the grid spans (the whole map by default), `stride` tiles a grid cell
 * @returns {Float32Array|null} (width/stride + 1) x (height/stride + 1), x fastest; null where no vertex is wet
 */
export function waterBedDepths(bytes, { stride = 1, tileDim = 128, width = tileDim, height = tileDim, table = WATER_DRAW_MASK_TABLE } = {}) {
  const gx = width / stride + 1, gz = height / stride + 1;
  const n = gx * gz;
  const wet = new Uint8Array(n);
  let any = false;
  // the corner bits as the water shader reads them (waterSurface.js coverage): bit 0 the tile's (0,0), bit 1 (1,0),
  // bit 2 (0,1), bit 3 (1,1) - so the tile south-west of a vertex votes its bit 3, south-east 2, north-west 1, north-east 0
  const VOTES = [[-1, -1, 8], [0, -1, 4], [-1, 0, 2], [0, 0, 1]];
  for (let vz = 0; vz < gz; vz++) {
    for (let vx = 0; vx < gx; vx++) {
      const cx = vx * stride, cz = vz * stride;
      let votes = 0, ok = true;
      for (const [dx, dz, bit] of VOTES) {
        const tx = cx + dx, tz = cz + dz;
        if (tx < 0 || tz < 0 || tx >= width || tz >= height) continue;
        votes++;
        if (!(table[bytes[tz * tileDim + tx]] & bit)) { ok = false; break; }
      }
      if (ok && votes) { wet[vz * gx + vx] = 1; any = true; }
    }
  }
  if (!any) return null;
  // the 3-4 chamfer: 3 a step, 4 a diagonal, from every dry vertex; a grid with no bank at all is open water
  const BIG = 1e9;
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) d[i] = wet[i] ? BIG : 0;
  const relax = (i, j, w) => { if (d[j] + w < d[i]) d[i] = d[j] + w; };
  for (let z = 0; z < gz; z++) {
    for (let x = 0; x < gx; x++) {
      const i = z * gx + x;
      if (!wet[i]) continue;
      if (x > 0) relax(i, i - 1, 3);
      if (z > 0) {
        relax(i, i - gx, 3);
        if (x > 0) relax(i, i - gx - 1, 4);
        if (x < gx - 1) relax(i, i - gx + 1, 4);
      }
    }
  }
  for (let z = gz - 1; z >= 0; z--) {
    for (let x = gx - 1; x >= 0; x--) {
      const i = z * gx + x;
      if (!wet[i]) continue;
      if (x < gx - 1) relax(i, i + 1, 3);
      if (z < gz - 1) {
        relax(i, i + gx, 3);
        if (x < gx - 1) relax(i, i + gx + 1, 4);
        if (x > 0) relax(i, i + gx - 1, 4);
      }
    }
  }
  const unit = (stride * TILE_UNITS) / 3;   // a chamfer step of 3 is one grid cell
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = wet[i] ? BED_DEPTH * bedProfile(Math.min(d[i], BIG) * unit / BED_RAMP) : 0;
  return out;
}

/**
 * The ground the eye sees, carved: a copy of `positions` with every grid vertex lowered by its bed depth (the skirt
 * of a strided grid, appended after the g*g vertices, follows its edge vertex), and `normals` re-lit where the carve
 * made a slope (central differences over the carved grid, one-sided at its edge). The inputs are not touched.
 * @param {Float32Array} positions the grid as built (x, y, z a vertex; g*g first, x fastest)
 * @param {Float32Array} normals
 * @param {Float32Array} depths waterBedDepths' answer for the same grid
 * @param {number} gx vertices a row
 * @param {number} gz rows
 * @returns {{positions: Float32Array, normals: Float32Array}}
 */
export function carveBed(positions, normals, depths, gx, gz) {
  const p = positions.slice(), nm = normals.slice();
  const g = gx * gz;
  for (let i = 0; i < g; i++) if (depths[i] > 0) p[i * 3 + 1] -= depths[i];
  // a strided grid's skirt: four edges of g vertices each, south, north, west, east (terrainSurface.js buildTerrainGrid)
  if (positions.length > g * 3 && gx === gz) {
    const edges = [(i) => i, (i) => (gz - 1) * gx + i, (i) => i * gx, (i) => i * gx + (gx - 1)];
    let o = g;
    for (const edge of edges) for (let i = 0; i < gx; i++, o++) p[o * 3 + 1] -= depths[edge(i)];
  }
  const y = (x, z) => p[(Math.max(0, Math.min(gz - 1, z)) * gx + Math.max(0, Math.min(gx - 1, x))) * 3 + 1];
  const cellX = gx > 1 ? positions[3] - positions[0] : TILE_UNITS;
  const cellZ = gz > 1 ? positions[gx * 3 + 2] - positions[2] : TILE_UNITS;
  for (let z = 0; z < gz; z++) {
    for (let x = 0; x < gx; x++) {
      const i = z * gx + x;
      // only where the carve reaches: a vertex or a neighbour lowered
      if (!(depths[i] > 0 || depths[z * gx + Math.max(0, x - 1)] > 0 || depths[z * gx + Math.min(gx - 1, x + 1)] > 0
        || depths[Math.max(0, z - 1) * gx + x] > 0 || depths[Math.min(gz - 1, z + 1) * gx + x] > 0)) continue;
      const nx = (y(x - 1, z) - y(x + 1, z)) / (2 * cellX), nz = (y(x, z - 1) - y(x, z + 1)) / (2 * cellZ);
      const l = Math.hypot(nx, 1, nz);
      nm[i * 3] = nx / l; nm[i * 3 + 1] = 1 / l; nm[i * 3 + 2] = nz / l;
    }
  }
  return { positions: p, normals: nm };
}

/**
 * One grid's bed, whole: the depths, the carved ground to upload, and the sheet (the grid as it stood). null where the
 * grid holds no wet vertex - the ground uploads as built and the water, if any, lies on it as WATER1's did.
 * @param {{positions: Float32Array, normals: Float32Array}} grid
 * @param {Uint8Array} bytes the converted tilemap
 * @param {{stride?: number, tileDim?: number, width?: number, height?: number}} [o]
 */
export function waterBedOf(grid, bytes, o = {}) {
  const stride = o.stride ?? 1, tileDim = o.tileDim ?? 128;
  const width = o.width ?? tileDim, height = o.height ?? tileDim;
  const depths = waterBedDepths(bytes, { stride, tileDim, width, height });
  if (!depths) return null;
  const gx = width / stride + 1, gz = height / stride + 1;
  const ground = carveBed(grid.positions, grid.normals, depths, gx, gz);
  return { depths, ground, sheet: grid.positions, gx, gz };
}

/** A flat grid `width` x `height` tiles at height `y` (the fixed town's ground, which DFU lays as one flat quad), the
 *  terrain's vertex order and triangulation (terrainSurface.js buildTerrainIndices), so a bed can be carved in it. */
export function flatGrid(width, height, y, cell = TILE_UNITS) {
  const gx = width + 1, gz = height + 1;
  const positions = new Float32Array(gx * gz * 3), normals = new Float32Array(gx * gz * 3);
  for (let z = 0, o = 0; z < gz; z++) {
    for (let x = 0; x < gx; x++, o += 3) {
      positions[o] = x * cell; positions[o + 1] = y; positions[o + 2] = z * cell;
      normals[o + 1] = 1;
    }
  }
  const indices = new Uint32Array(width * height * 6);
  for (let z = 0, o = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      const i0 = z * gx + x, i1 = i0 + 1, i2 = i0 + gx, i3 = i2 + 1;
      indices[o++] = i0; indices[o++] = i2; indices[o++] = i3;
      indices[o++] = i0; indices[o++] = i3; indices[o++] = i1;
    }
  }
  return { positions, normals, indices };
}
