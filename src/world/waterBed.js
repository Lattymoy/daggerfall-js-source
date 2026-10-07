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
import { WATER_DRAW_MASK_TABLE, NO_BED_DEPTH, SHEET_NO_BED } from './waterCorners.js';
import { convertTile } from './terrainSurface.js';
import { tileDataAt, marchTile, sampleHeight } from './terrainTiles.js';   // AUDIT WATER-NEXT F2: a neighbour's tiles, by its own law

/** The bed's depth at the heart of wide water, world units (a tile is 6.4; a man stands about 1.8). */
export const BED_DEPTH = 4.0;
/** How far from the bank the bed reaches its depth, world units (three tiles). */
export const BED_RAMP = 19.2;
/** A tile's side, world units. */
export const TILE_UNITS = 6.4;
/** The sheet's depths for water with no bed under it - their one home is the water's leaf (waterCorners.js). */
export { NO_BED_DEPTH, SHEET_NO_BED };

/** 0..1 off the bank: a smoothstep - a shallow shelf off the bank (where clear water shows its bed), the slope
 *  steepest between, the middle flat. The real game's first shots (the moat) took an ease-out: a tile from the bank
 *  was already 2.2 deep, and the shallows the eye looks for were a sliver. */
export const bedProfile = (t) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };

/**
 * Every grid vertex's bed depth (world units, 0 on and beyond the bank).
 * @param {Uint8Array} bytes the CONVERTED tilemap (record << 2 | turn), row-major, `tileDim` a row
 * @param {{stride?: number, tileDim?: number, width?: number, height?: number, table?: Uint8Array|number[], halo?: ?{tp: number, dim: number, bits: Uint8Array}}} [o]
 *   `halo` (stride 1): bedHalo's band of the neighbours' tiles - their votes and banks across the seams
 *   `width`/`height` the tiles the grid spans (the whole map by default), `stride` tiles a grid cell
 * @returns {Float32Array|null} (width/stride + 1) x (height/stride + 1), x fastest; null where no vertex is wet
 */
export function waterBedDepths(bytes, { stride = 1, tileDim = 128, width = tileDim, height = tileDim, table = WATER_DRAW_MASK_TABLE, halo = null } = {}) {
  if (halo && stride === 1) return haloBedDepths(bytes, tileDim, width, height, table, halo);
  const gx = width / stride + 1, gz = height / stride + 1;
  const n = gx * gz;
  const wet = new Uint8Array(n);
  let any = false;
  // the corner bits as the water shader reads them (waterSurface.js coverage): bit 0 the tile's (0,0), bit 1 (1,0),
  // bit 2 (0,1), bit 3 (1,1) - so the tile south-west of a vertex votes its bit 3, south-east 2, north-west 1, north-east 0.
  // AUDIT WATER-NEXT P1: the four votes written out - the loop of [dx, dz, bit] rows cost the build twice this
  for (let vz = 0; vz < gz; vz++) {
    const cz = vz * stride, south = cz > 0, north = cz < height, rowS = (cz - 1) * tileDim, rowN = cz * tileDim;
    for (let vx = 0; vx < gx; vx++) {
      const cx = vx * stride, west = cx > 0, east = cx < width;
      if (south && west && !(table[bytes[rowS + cx - 1]] & 8)) continue;
      if (south && east && !(table[bytes[rowS + cx]] & 4)) continue;
      if (north && west && !(table[bytes[rowN + cx - 1]] & 2)) continue;
      if (north && east && !(table[bytes[rowN + cx]] & 1)) continue;
      if (!((south || north) && (west || east))) continue;   // a tile past the map's edge is no vote - and no tile, no vertex
      wet[vz * gx + vx] = 1; any = true;
    }
  }
  if (!any) return null;
  // the 3-4 chamfer: 3 a step, 4 a diagonal, from every dry vertex; a grid with no bank at all is open water
  const BIG = 1e9;
  const d = chamfer(wet, gx, gz);
  const unit = (stride * TILE_UNITS) / 3;   // a chamfer step of 3 is one grid cell
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) if (wet[i]) out[i] = BED_DEPTH * bedProfile(Math.min(d[i], BIG) * unit / BED_RAMP);
  return out;
}

/** AUDIT WATER-NEXT F2: how far past a near pixel's edge the bed looks, in tiles - its ramp (BED_RAMP, three tiles) and
 *  the tile a vertex's vote reaches into. */
export const BED_HALO_TILES = Math.ceil(BED_RAMP / TILE_UNITS) + 1;

/**
 * AUDIT WATER-NEXT F2 (2026-10-07): THE BED ACROSS A SEAM. Each pixel carved its bed alone - a tile past its edge no
 * vote, a bank past its edge unseen - so a vertex on the seam two pixels share was carved to two depths, 4 on one side
 * and 1 or 0 on the other, and a near grid has no skirt: an open crack in the drawn ground under clear water (drawn as
 * the water's own dark body in Full, the frame's clear colour in Simple). The bed now reads BED_HALO_TILES of each
 * neighbour's tiles past the edge, classified and marched by the neighbour's own law from the kernel's ghost samples
 * (terrainSampler.js ghostSampler: the neighbour's own kernel) - its index's beach jitter, its latitude, its corners -
 * so both pixels carve a seam vertex from the same tiles, and agree. A neighbour's STAMPED or PAINTED tiles (a town's
 * blocks, a road, a river) are not in its kernel: a bed there may still part at the seam (recorded,
 * bible/01-Overview/Audit-WATER-NEXT.md). Near grids only (stride 1): a strided grid's skirt closes its seams.
 * @param {(x: number, z: number) => number} ghost the sample at a coordinate of this pixel's frame, past its edge too
 * @param {number} px @param {number} py the pixel
 * @param {Uint8Array|number[]} [table]
 * @returns {{tp: number, dim: number, bits: Uint8Array}} each tile's water corners in a band `tp` deep round the
 *   128-tile map (`dim` a row; the map's own tiles left 0 - they are the TileMap's)
 */
export function bedHalo(ghost, px, py, table = WATER_DRAW_MASK_TABLE) {
  const tp = BED_HALO_TILES, side = 128, dim = side + 2 * tp;
  const bits = new Uint8Array(dim * dim);
  const memo = new Map();
  /** a corner of a neighbour's tile: its tileData in ITS frame (its index's jitter, its latitude) */
  const corner = (x, z, dx, dz) => {
    const key = ((dx + 1) * 3 + (dz + 1)) * 1048576 + (x + 512) * 1024 + (z + 512);
    let v = memo.get(key);
    if (v === undefined) {
      v = tileDataAt(sampleHeight(Math.fround(ghost(x, z))), x - dx * side, z + dz * side, px + dx, py + dz);
      memo.set(key, v);
    }
    return v;
  };
  for (let tz = -tp; tz < side + tp; tz++) {
    // the map's Y runs south: a tile before row 0 is the south neighbour's (py + 1), past row 127 the north's
    const dz = tz < 0 ? 1 : tz >= side ? -1 : 0;
    for (let tx = -tp; tx < side + tp; tx++) {
      const dx = tx < 0 ? -1 : tx >= side ? 1 : 0;
      if (!dx && !dz) continue;
      const raw = marchTile(corner(tx, tz, dx, dz), corner(tx + 1, tz, dx, dz), corner(tx, tz + 1, dx, dz), corner(tx + 1, tz + 1, dx, dz));
      bits[(tz + tp) * dim + (tx + tp)] = table[convertTile(raw)];
    }
  }
  return { tp, dim, bits };
}

/** AUDIT WATER-NEXT F2: whether a TileMap's water comes within the halo's reach of the map's edge - where it does not,
 *  no seam vertex is near water and the bed needs no neighbour's tile. */
export function bedNearEdge(bytes, table = WATER_DRAW_MASK_TABLE, side = 128) {
  const reach = BED_HALO_TILES;
  for (let z = 0; z < side; z++) {
    const band = z < reach || z >= side - reach;
    for (let x = 0; x < side; x++) {
      if (!band && x === reach) x = side - reach;   // the row's middle is no edge's
      if (table[bytes[z * side + x]]) return true;
    }
  }
  return false;
}

/** waterBedDepths with a halo (stride 1): the votes and the banks of the neighbours' tiles, the chamfer run over the
 *  pixel and BED_HALO_TILES - 1 vertices round it, the pixel's own vertices answered. */
function haloBedDepths(bytes, tileDim, width, height, table, halo) {
  const pad = halo.tp - 1, gx = width + 1, gz = height + 1, ex = gx + 2 * pad, ez = gz + 2 * pad;
  const bitsAt = (tx, tz) => (tx >= 0 && tz >= 0 && tx < width && tz < height
    ? table[bytes[tz * tileDim + tx]] : halo.bits[(tz + halo.tp) * halo.dim + (tx + halo.tp)]);
  const n = ex * ez;
  const wet = new Uint8Array(n);
  let any = false;
  for (let vz = 0; vz < ez; vz++) {
    const cz = vz - pad;
    for (let vx = 0; vx < ex; vx++) {
      const cx = vx - pad;
      if ((bitsAt(cx - 1, cz - 1) & 8) && (bitsAt(cx, cz - 1) & 4) && (bitsAt(cx - 1, cz) & 2) && (bitsAt(cx, cz) & 1)) {
        wet[vz * ex + vx] = 1;
        if (cx >= 0 && cz >= 0 && cx < gx && cz < gz) any = true;
      }
    }
  }
  if (!any) return null;
  const d = chamfer(wet, ex, ez);
  const unit = TILE_UNITS / 3;
  const out = new Float32Array(gx * gz);
  for (let z = 0; z < gz; z++) {
    for (let x = 0; x < gx; x++) {
      const i = (z + pad) * ex + (x + pad);
      if (wet[i]) out[z * gx + x] = BED_DEPTH * bedProfile(Math.min(d[i], 1e9) * unit / BED_RAMP);
    }
  }
  return out;
}

/** The 3-4 chamfer from every dry vertex of a `gx` x `gz` grid (a wet vertex with no bank in the grid stays 1e9). */
function chamfer(wet, gx, gz) {
  const n = gx * gz, d = new Float32Array(n);
  for (let i = 0; i < n; i++) d[i] = wet[i] ? 1e9 : 0;
  for (let z = 0; z < gz; z++) {
    for (let x = 0; x < gx; x++) {
      const i = z * gx + x;
      if (!wet[i]) continue;
      let v = d[i];
      if (x > 0 && d[i - 1] + 3 < v) v = d[i - 1] + 3;
      if (z > 0) {
        if (d[i - gx] + 3 < v) v = d[i - gx] + 3;
        if (x > 0 && d[i - gx - 1] + 4 < v) v = d[i - gx - 1] + 4;
        if (x < gx - 1 && d[i - gx + 1] + 4 < v) v = d[i - gx + 1] + 4;
      }
      d[i] = v;
    }
  }
  for (let z = gz - 1; z >= 0; z--) {
    for (let x = gx - 1; x >= 0; x--) {
      const i = z * gx + x;
      if (!wet[i]) continue;
      let v = d[i];
      if (x < gx - 1 && d[i + 1] + 3 < v) v = d[i + 1] + 3;
      if (z < gz - 1) {
        if (d[i + gx] + 3 < v) v = d[i + gx] + 3;
        if (x < gx - 1 && d[i + gx + 1] + 4 < v) v = d[i + gx + 1] + 4;
        if (x > 0 && d[i + gx - 1] + 4 < v) v = d[i + gx - 1] + 4;
      }
      d[i] = v;
    }
  }
  return d;
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
 * AUDIT WATER-NEXT H2 (2026-10-07): THE SHEET'S DEPTHS - the water's attribute 1, beside the carve's own depths. Where the
 * carve reaches, the bed's: a wet vertex its depth, and a bank vertex beside one 0 (where the shore's foam lies). Where it
 * does not - a one-tile stream in a pixel whose pond was carved: no vertex of it is wet, so nothing under it moved -
 * SHEET_NO_BED, as a pixel with no bed at all draws its every sheet. The sheet had taken the carve's 0 there: a stream
 * that is tinted water in one pixel was a clear film edged in foam in the next, whenever a pond stood somewhere in it.
 * @param {Float32Array} depths waterBedDepths' answer
 * @param {number} gx vertices a row
 * @param {number} gz rows
 * @returns {Float32Array}
 */
export function sheetDepthsOf(depths, gx, gz) {
  const out = new Float32Array(depths.length);
  for (let z = 0; z < gz; z++) {
    for (let x = 0; x < gx; x++) {
      const i = z * gx + x;
      if (depths[i] > 0) { out[i] = depths[i]; continue; }
      let bank = false;
      for (let dz = -1; dz <= 1 && !bank; dz++) {
        const nz = z + dz;
        if (nz < 0 || nz >= gz) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < gx && depths[nz * gx + nx] > 0) { bank = true; break; }
        }
      }
      out[i] = bank ? 0 : SHEET_NO_BED;
    }
  }
  return out;
}

/**
 * One grid's bed, whole: the depths, the carved ground to upload, and the sheet (the grid as it stood) with its own
 * depths (sheetDepthsOf). null where the grid holds no wet vertex - the ground uploads as built and the water, if any,
 * lies on it as WATER1's did.
 * @param {{positions: Float32Array, normals: Float32Array}} grid
 * @param {Uint8Array} bytes the converted tilemap
 * @param {{stride?: number, tileDim?: number, width?: number, height?: number, halo?: ?{tp: number, dim: number, bits: Uint8Array}}} [o]
 *   `halo` bedHalo's band (a near grid of the streaming world: the seams agree)
 */
export function waterBedOf(grid, bytes, o = {}) {
  const stride = o.stride ?? 1, tileDim = o.tileDim ?? 128;
  const width = o.width ?? tileDim, height = o.height ?? tileDim;
  const depths = waterBedDepths(bytes, { stride, tileDim, width, height, halo: o.halo ?? null });
  if (!depths) return null;
  const gx = width / stride + 1, gz = height / stride + 1;
  const ground = carveBed(grid.positions, grid.normals, depths, gx, gz);
  return { depths, sheetDepths: sheetDepthsOf(depths, gx, gz), ground, sheet: grid.positions, gx, gz };
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
