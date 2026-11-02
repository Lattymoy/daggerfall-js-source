// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ROAD-LOOK (2026-10-27, KPbICA on the DFO Online Discord, forwarded by the owner: "Texture blending for road tiles and
// surroundings"; bible/03-World/Roads.md ROAD-LOOK) - A ROAD'S EDGE BLENDS INTO ITS GROUND.
//
// Daggerfall draws its ground a tile at a time: each of a pixel's 128 x 128 tiles is one record of the ground's archive,
// sampled NEAREST to its square's edge (DFU's TilemapTextureArray, the port's terrain programs - render/renderer.js
// TERRAIN_FS, the lane's EL_TERRAIN_FS). The ground's own kinds meet through the marching squares' transition records
// (terrainTiles.js assignTiles), but a road is not a kind of ground: Basic Roads' painter writes its paving (46) over the
// ground and a cardinal road has no edge tile at all (roadPainter.js ROAD_TILES: two tiles of 46, his own table), so a
// road's side is the straight line between a stone tile and a grass one. Its diagonal flanks (47, 55) carry their own
// ragged edge across the tile, and the town's streets are the same three records (BLOCKS.BSA: 24,686 tiles of 46 in the
// RMB blocks, 23,433 of their sides on dirt or grass). DFU with Basic Roads draws them so.
//
// THE LAW (a departure: Port-Ledger A, ROAD-LOOK) - in the ground's own fragment, so wherever a road tile stands (the
// Bay's painted roads, the curves past it, a town's ring and its streets) and nothing in a tilemap moves:
//  - A ROAD'S SHARE. Every cell is the road's paving (ROAD_PAVING, 46) or not - its two edge tiles (47, 55) are the
//    ground's side: each carries the road's own ragged edge across it, its paving toward the road's and its ground
//    toward the ground (blended as paving, their stone where it reaches a tile's corner ran out into the grass as
//    smudges). A point's share of road is the bilinear of its four nearest cells' (the dual square about its nearest tile corner, from cell centre to cell centre) - 1 inside a road's
//    tiles, 0 inside the ground's, a half on a straight edge - moved by a wander (three octaves of value noise on the
//    pixel's own lattices) and drawn across a soft rim: `smoothstep(0.5 - soft, 0.5 + soft, share + wander)`. A
//    straight edge becomes a ragged one, a convex corner is rounded, a stair of whole tiles reads as its slope.
//  - THE ROAD IS NOT SMEARED. Past REACH of an edge the share is whole, so a two-tile road keeps its middle 1.44 tiles
//    its own pictures; the ground keeps its own past REACH too.
//  - WHAT IS DRAWN. A point draws its own tile at its own kind's share and the OTHER kind's tile at the rest - the cell of
//    that kind nearest it across this corner (its x or y neighbour, or the diagonal one), several weighted by
//    `nearWeight` (whole on a seam itself, none half a tile off). A neighbour's picture is its own record, turned by its
//    own transform and MIRRORED about its own square (so it meets the point's on their seam exactly), at the fragment's
//    own gradient. So the colour is continuous across every seam between a road and the ground, and a seam between two
//    cells of one kind keeps its own step, never larger.
//  - WATER IS NEVER BLENDED. A cell whose record carries water (WATER_DRAW_MASK_TABLE: any corner, any turn) or no
//    ground record at all (56 and up: a clip mark, world/terrain/terrainSurface.js CLIP_SENTINEL) draws its own tile and
//    lends none: a road at a shore meets the water's sheet as it did.
//  - THE SAME ON EVERY PIXEL. The wander's lattices are whole numbers of cells a pixel's side and their hashes are
//    taken modulo the pixel, so the field is continuous across a pixel's edge; a neighbour off the pixel's tilemap is its edge's own.
// render/roadEdgeGlsl.js is this file's twin in GLSL, term for term (test/world/road/roadlook.test.js runs the shader's
// functions through test/glsl.mjs against these). Sums, products and integer hashes alone.
// ═══════════════════════════════════════════════════════════════════
import { WATER_DRAW_MASK_TABLE } from '../water/waterCorners.js';
import { GROUND_RECORD_LIMIT } from '../terrain/terrainTiles.js';

/** Daggerfall's road tiles: the paving (46) and its two edges (47 over dirt, 55 over grass) - CityNavigation.GetTileWeight's
 *  "Roads are great!" (world/city/cityNavigation.js), Basic Roads' painter's slots (world/road/roadPainter.js ROAD_TILES).
 *  Their one home (world/urban/townFabric.js reads them here). */
export const ROAD_RECORDS = Object.freeze([46, 47, 55]);
/** The road's paving (roadPainter.js TILE.road, ROAD_TILES' inner): the record a road's edge is blended off. */
export const ROAD_PAVING = ROAD_RECORDS[0];

/** The law's dials, in tiles (6.4 m). */
export const ROAD_EDGE = Object.freeze({
  /** the rim's half width, in the share's own units (tiles across a straight edge) */
  soft: 0.07,
  /** the wander: three octaves of value noise, each its lattice's cells a pixel's side (4 tiles, a tile, a quarter tile -
   *  a bend some 25 m long, a ragged 6 m, a broken 1.6 m) and an amplitude (share) */
  wander: Object.freeze([
    Object.freeze({ cells: 32, amp: 0.12 }),
    Object.freeze({ cells: 128, amp: 0.06 }),
    Object.freeze({ cells: 512, amp: 0.05 }),
  ]),
  /** the wander's hash salt (each later octave's one more) */
  salt: 0x0d5,
});
/** How far past a straight edge (tiles) the share can be anything but whole: the rim and the wander's widest. */
export const ROAD_EDGE_REACH = ROAD_EDGE.soft + ROAD_EDGE.wander.reduce((s, o) => s + o.amp, 0);
/** A pixel's tiles a side - the wander's period. */
const DIM = 128;

/** The records that carry water to the eye (WATER_DRAW_MASK_TABLE, any corner of any turn) as two 32-bit words, records
 *  0-31 and 32-63 - the shader's own constant. */
export const ROAD_EDGE_WET = Object.freeze(
  (() => {
    const w = [0, 0];
    for (let r = 0; r < 64; r++) {
      let wet = false;
      for (let t = 0; t < 4; t++) if (WATER_DRAW_MASK_TABLE[(r << 2) | t]) wet = true;
      if (wet) w[r >> 5] = (w[r >> 5] | (1 << (r & 31))) >>> 0;
    }
    return w;
  })(),
);

/** Is a converted tile byte (record << 2 | turn) the road's paving. */
export const isRoadByte = (d) => d >>> 2 === ROAD_PAVING;
/** Does a converted tile byte take part in a road's edge: a ground record, dry. */
export const takesRoadEdge = (d) => {
  const r = d >>> 2;
  return r < GROUND_RECORD_LIMIT && ((ROAD_EDGE_WET[r >> 5] >>> (r & 31)) & 1) === 0;
};

/** The lattice hash, the top 24 bits as [0, 1) - integer arithmetic, GLSL's uint twin bit for bit. */
export function roadEdgeHash(ix, iy, salt) {
  let h = (Math.imul(ix, 0x8da6b343) ^ Math.imul(iy, 0xd8163841) ^ Math.imul(salt, 0xcb1ab31f)) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return (h >>> 8) / 16777216;
}
/** Value noise on a lattice of `n` cells a pixel's side at a pixel-local point (tiles), its lattice taken modulo the
 *  pixel - so the same on a pixel's east edge as on its neighbour's west. */
export function roadEdgeNoise(x, y, n, salt) {
  const qx = (x * n) / DIM,
    qy = (y * n) / DIM,
    fx0 = Math.floor(qx),
    fy0 = Math.floor(qy);
  const fx = qx - fx0,
    fy = qy - fy0,
    ux = fx * fx * (3 - 2 * fx),
    uy = fy * fy * (3 - 2 * fy);
  const m = (i) => ((i % n) + n) % n;
  const a = roadEdgeHash(m(fx0), m(fy0), salt),
    b = roadEdgeHash(m(fx0 + 1), m(fy0), salt);
  const c = roadEdgeHash(m(fx0), m(fy0 + 1), salt),
    d = roadEdgeHash(m(fx0 + 1), m(fy0 + 1), salt);
  const top = a + (b - a) * ux,
    bot = c + (d - c) * ux;
  return top + (bot - top) * uy;
}
/** The edge's wander at a pixel-local point (tiles): within +-(the amplitudes' sum). */
export function roadEdgeWander(x, y) {
  let w = 0;
  ROAD_EDGE.wander.forEach((o, k) => {
    w += o.amp * (2 * roadEdgeNoise(x, y, o.cells, ROAD_EDGE.salt + k) - 1);
  });
  return w;
}
const smoothstep = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** A cell's weight as the other kind's picture at `d` tiles from its square: whole on the seam, none half a tile off. */
export function nearWeight(d) {
  const w = Math.max(0.5 - d, 0);
  return (w * w) / Math.max(d * d, 1e-6);
}

/**
 * THE BLEND AT A PIXEL-LOCAL POINT (tiles, x east and y north, 0..128): the cells it draws and each one's weight, summing
 * to 1 - `[[cx, cy, weight], ...]`, the point's own cell first - and the road's share there. `byteAt(cx, cy)` the
 * converted tile byte of a cell (the caller clamps to its tilemap: a cell off it answers its edge's).
 * @param {(cx: number, cy: number) => number} byteAt @param {number} x @param {number} y
 * @returns {{ rho: number, draw: Array<[number, number, number]> }}
 */
export function roadEdgeAt(byteAt, x, y) {
  const cx = Math.min(DIM - 1, Math.max(0, Math.floor(x))),
    cy = Math.min(DIM - 1, Math.max(0, Math.floor(y)));
  const fx = x - cx,
    fy = y - cy,
    own = byteAt(cx, cy);
  const ra = isRoadByte(own);
  const whole = { rho: ra ? 1 : 0, draw: /** @type {Array<[number, number, number]>} */ ([[cx, cy, 1]]) };
  if (!takesRoadEdge(own)) return whole;
  const sx = fx < 0.5 ? -1 : 1,
    sy = fy < 0.5 ? -1 : 1;
  const bx = cx + sx,
    by = cy,
    dcx = cx,
    dcy = cy + sy,
    ddx = cx + sx,
    ddy = cy + sy;
  const db = byteAt(bx, by),
    dc = byteAt(dcx, dcy),
    dd = byteAt(ddx, ddy);
  const rb = isRoadByte(db),
    rc = isRoadByte(dc),
    rd = isRoadByte(dd);
  if (ra === rb && ra === rc && ra === rd) return whole;
  // the dual square: its corner the nearest tile corner, (kx, ky); s runs 0..1 from the cells' centres west and south of it
  const kx = Math.floor(x + 0.5),
    ky = Math.floor(y + 0.5),
    s0 = x - (kx - 0.5),
    s1 = y - (ky - 0.5);
  const wx = (c) => (c === kx ? s0 : 1 - s0),
    wy = (c) => (c === ky ? s1 : 1 - s1);
  const lin =
    (ra ? wx(cx) * wy(cy) : 0) +
    (rb ? wx(bx) * wy(by) : 0) +
    (rc ? wx(dcx) * wy(dcy) : 0) +
    (rd ? wx(ddx) * wy(ddy) : 0);
  const rho = smoothstep(0.5 - ROAD_EDGE.soft, 0.5 + ROAD_EDGE.soft, lin + roadEdgeWander(x, y));
  const mine = ra ? rho : 1 - rho;
  if (mine >= 1) return { rho, draw: whole.draw };
  const u = Math.min(fx, 1 - fx),
    v = Math.min(fy, 1 - fy);
  const gb = rb !== ra && takesRoadEdge(db) ? nearWeight(u) : 0;
  const gc = rc !== ra && takesRoadEdge(dc) ? nearWeight(v) : 0;
  const gd = rd !== ra && takesRoadEdge(dd) ? nearWeight(Math.sqrt(u * u + v * v)) : 0;
  const gs = gb + gc + gd;
  if (gs <= 0) return { rho, draw: whole.draw };
  const draw = /** @type {Array<[number, number, number]>} */ ([[cx, cy, mine]]);
  if (gb > 0) draw.push([bx, by, ((1 - mine) * gb) / gs]);
  if (gc > 0) draw.push([dcx, dcy, ((1 - mine) * gc) / gs]);
  if (gd > 0) draw.push([ddx, ddy, ((1 - mine) * gd) / gs]);
  return { rho, draw };
}

/** A cell's picture coordinate at a pixel-local point: the point mirrored about the cell's own square (a point inside
 *  it is itself), in the cell's frame - so two cells' pictures meet on their seam. */
export function mirroredLocal(cx, cy, x, y) {
  const m = (l) => (l < 0 ? -l : l > 1 ? 2 - l : l);
  return [m(x - cx), m(y - cy)];
}
