// ═══════════════════════════════════════════════════════════════════
// ECOTONE1 (2026-10-07, Mac: "Making it where bione transitions are
// insta t and instead fade and transition naturally into each other") -
// THE ECOTONE: where two climates meet, one wandering, patchy border in
// place of the map pixel's straight edge.
//
// DFU decides a climate per map pixel (CLIMATE.PAK) and everything that
// follows from it - the ground's tile set, the nature archive, how thick
// the trees stand, which tiles grow grass - is that pixel's, to its edge:
// 819.2 m of temperate woods, then a straight line, then desert. Here every
// pixel edge has a SHARE: a point near it belongs partly to the pixel on
// either side, and the shares are one function of where the point stands
// in the world, so the two pixels that draw the same point agree on it.
//
//   - THE SEAM WANDERS. The line the shares cross at is the edge moved by
//     two octaves of value noise (ECOTONE.warp): bends half a pixel long
//     and a ragged fifty-metre hem, never the edge's straight line, and
//     never farther from it than their amplitudes together.
//   - THE BORDER IS PATCHES, NOT A SMEAR. Across ECOTONE.band either side
//     of the wandering seam the neighbour's chance rises from none to
//     whole; a third noise (ECOTONE.patch: fifty-metre blots, thirteen-
//     metre ragged rims) is held against that chance, so the far climate
//     comes in as islands that grow and join toward the seam - sand
//     through thinning grass, snow in drifts - each blot's rim a few
//     metres soft (ECOTONE.edge). Two pictures faded into each other read
//     as a smear; this reads as ground, and from afar as a fade. The
//     patch noise is STRETCHED (ECOTONE.stretch) before it is held
//     against the chance: two octaves of value noise sum to a hump about
//     a half (nine tenths of the land between 0.25 and 0.75), so a chance
//     of a fifth showed almost none of the neighbour and the border was a
//     ragged line; stretched, the share of the land the neighbour holds
//     is about its chance, across the whole band.
//   - CORNERS. A point's two seams (the nearer of each axis) give each of
//     the four pixels round it the product of its two shares, which sum
//     to one, and each pixel of the four computes the same four.
//   - EXACT EDGES. Past ECOTONE_REACH from an edge a share is exactly
//     whole: the noise cannot carry the seam farther, and the smoothstep
//     is flat there. A pixel whose neighbours are all its own climate
//     asks nothing at all.
//
// The noise is integer-hashed on WORLD tile lattices whose cells divide a
// pixel's 128 tiles, so a pixel's origin is a whole number of cells and a
// lattice index is exact in GLSL's ints and JS's alike (render/
// ecotoneGlsl.js is this file's twin, term for term: test/
// ecotone1.test.js runs the shader's function through test/glsl.mjs and
// holds it to these). The ground reads the shares per fragment; the
// layout (world/terrainNature.js) and the grass read the climate that
// owns a point (ecotoneOwner), so a tree, a blade and the ground under
// them agree on which climate they are in.
// ═══════════════════════════════════════════════════════════════════

/** The ecotone's numbers, in one place. Lattice cells are in tiles (6.4 m) and divide a pixel's 128. */
export const ECOTONE = Object.freeze({
  /** the neighbour's chance rises from none to whole across this many metres either side of the wandering seam */
  band: 96,
  /** the seam's wander: two octaves - a lattice cell (tiles) and an amplitude (m) each */
  warp: Object.freeze([Object.freeze({ cell: 64, amp: 48 }), Object.freeze({ cell: 8, amp: 16 })]),
  /** the patches held against the chance: two octaves - a lattice cell (tiles) and a weight each (the weights sum to 1) */
  patch: Object.freeze([Object.freeze({ cell: 8, weight: 0.65 }), Object.freeze({ cell: 2, weight: 0.35 })]),
  /** the patch noise's stretch about a half, so its values spread over the whole of [0, 1] (clamped) */
  stretch: 2,
  /** how soft a patch's rim is, in the stretched noise's own units */
  edge: 0.06,
  /** the world's tile rows are counted from this map row north of the map, so every lattice index is positive */
  row0: 512,
  /** the hash's salts for the seams across x (between a pixel and its east or west neighbour) and across z */
  saltX: 101,
  saltZ: 211,
});
/** A pixel (m) and a tile (m). */
const PIXEL_M = 819.2;
const TILE_M = 6.4;
const HALF_M = PIXEL_M / 2;
/** Past this many metres from an edge, the shares are whole: the band and the seam's widest wander. */
export const ECOTONE_REACH = ECOTONE.band + ECOTONE.warp.reduce((s, o) => s + o.amp, 0);

/** The lattice hash: three words, murmur-style mixing, the top 24 bits as [0, 1) - the twin of ecoHash in GLSL. */
export function ecoHash(ix, iz, salt) {
  let h = (Math.imul(ix, 0x8da6b343) ^ Math.imul(iz, 0xd8163841) ^ Math.imul(salt, 0xcb1ab31f)) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return (h >>> 8) / 16777216;
}

/** The pixel's first world tile on each axis: x east, z north from ECOTONE.row0 - integers. */
export const ecoOrigin = (px, py) => [px * 128, (ECOTONE.row0 - py) * 128];

/**
 * Value noise on a lattice of `cell` tiles at a pixel-local point (tiles, `tx` east and `tz` north), smoothstepped
 * between its four corners - continuous across pixel edges because the lattice is the world's.
 * @param {number[]} origin ecoOrigin's
 */
export function ecoNoise(origin, tx, tz, cell, salt) {
  const qx = tx / cell, qz = tz / cell;
  const fx0 = Math.floor(qx), fz0 = Math.floor(qz);
  const ix = origin[0] / cell + fx0, iz = origin[1] / cell + fz0;
  const fx = qx - fx0, fz = qz - fz0;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = ecoHash(ix, iz, salt), b = ecoHash(ix + 1, iz, salt), c = ecoHash(ix, iz + 1, salt), d = ecoHash(ix + 1, iz + 1, salt);
  const top = a + (b - a) * ux, bot = c + (d - c) * ux;
  return top + (bot - top) * uz;
}

const smoothstep = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * THE SEAM'S SHARE: at `u` metres past an edge (positive toward +x or +z), the share of the pixel on the positive side,
 * at the pixel-local point (tx, tz) in tiles. 0 or 1 exactly past ECOTONE_REACH.
 */
export function ecoShare(origin, u, tx, tz, salt) {
  if (u <= -ECOTONE_REACH) return 0;
  if (u >= ECOTONE_REACH) return 1;
  const [w0, w1] = ECOTONE.warp, [p0, p1] = ECOTONE.patch, e = ECOTONE.edge;
  const d = u + w0.amp * (2 * ecoNoise(origin, tx, tz, w0.cell, salt) - 1) + w1.amp * (2 * ecoNoise(origin, tx, tz, w1.cell, salt + 1) - 1);
  const p = Math.min(1, Math.max(0, 0.5 + d / (2 * ECOTONE.band)));
  const n0 = p0.weight * ecoNoise(origin, tx, tz, p0.cell, salt + 2) + p1.weight * ecoNoise(origin, tx, tz, p1.cell, salt + 3);
  const n = Math.min(1, Math.max(0, (n0 - 0.5) * ECOTONE.stretch + 0.5));
  return smoothstep(-e, e, -e + (1 + 2 * e) * p - n);
}

/**
 * THE FOUR PIXELS' SHARES of a pixel-local point (metres, x east, z north): `sx`/`sz` the side of the nearer edge on
 * each axis (-1 west/south, +1 east/north), and the weights of the pixel itself, its neighbour across x, its neighbour
 * across z and the one across the corner - they sum to 1. Writes into `out` when handed one.
 * `axes` (bit 1 x, bit 2 z) names the seams whose shares can change what the caller asks - an axis left out is whole
 * (ecotoneOwner's: a seam with the same climate either side, and the corner its z-neighbour's, moves no weight).
 * @param {number} px @param {number} py @param {number} x @param {number} z
 * @param {{ sx: number, sz: number, own: number, nx: number, nz: number, nd: number }} [out] @param {number} [axes]
 */
export function ecotoneShares(px, py, x, z, out = { sx: 0, sz: 0, own: 1, nx: 0, nz: 0, nd: 0 }, axes = 3) {
  const sx = x < HALF_M ? -1 : 1, sz = z < HALF_M ? -1 : 1;
  const ux = sx < 0 ? x : x - PIXEL_M, uz = sz < 0 ? z : z - PIXEL_M;
  const askX = (axes & 1) && Math.abs(ux) < ECOTONE_REACH, askZ = (axes & 2) && Math.abs(uz) < ECOTONE_REACH;
  let ox = 1, oz = 1;
  if (askX || askZ) {
    const origin = ecoOrigin(px, py), tx = x / TILE_M, tz = z / TILE_M;
    if (askX) { const s = ecoShare(origin, ux, tx, tz, ECOTONE.saltX); ox = sx < 0 ? s : 1 - s; }
    if (askZ) { const s = ecoShare(origin, uz, tx, tz, ECOTONE.saltZ); oz = sz < 0 ? s : 1 - s; }
  }
  out.sx = sx; out.sz = sz;
  out.own = ox * oz; out.nx = (1 - ox) * oz; out.nz = ox * (1 - oz); out.nd = (1 - ox) * (1 - oz);
  return out;
}

const _shares = { sx: 0, sz: 0, own: 1, nx: 0, nz: 0, nd: 0 };
/**
 * WHICH NEIGHBOUR'S CLIMATE OWNS a pixel-local point: `key(dx, dz)` names each pixel's climate (dx east, dz north, -1..1;
 * a pixel off the map should answer the pixel's own) and the climate whose pixels' shares sum highest wins, the
 * pixel's own on a tie. Answers [dx, dz] of a pixel of the winning climate - [0, 0] when it is the pixel's own.
 * @param {number} px @param {number} py @param {number} x @param {number} z
 * @param {(dx: number, dz: number) => any} key
 */
export function ecotoneOwner(px, py, x, z, key) {
  const sx = x < HALF_M ? -1 : 1, sz = z < HALF_M ? -1 : 1;
  const k0 = key(0, 0), kx = key(sx, 0), kz = key(0, sz), kd = key(sx, sz);
  // a seam moves weight only where the climate changes across it: across x, unless the neighbour is the pixel's own
  // and the corner its z-neighbour's (that row then wears one climate whatever the x share); across z the same way
  const axes = (kx === k0 && kd === kz ? 0 : 1) | (kz === k0 && kd === kx ? 0 : 2);
  if (!axes) return [0, 0];
  const s = ecotoneShares(px, py, x, z, _shares, axes);
  if (s.own >= 0.5) return [0, 0];
  const cands = [[0, 0, s.own], [s.sx, 0, s.nx], [0, s.sz, s.nz], [s.sx, s.sz, s.nd]];
  const sums = new Map();
  for (const [dx, dz, w] of cands) {
    const k = key(dx, dz);
    sums.set(k, (sums.get(k) ?? 0) + w);
  }
  const ownKey = key(0, 0);
  let best = ownKey, bestW = sums.get(ownKey);
  for (const [k, w] of sums) if (w > bestW) { best = k; bestW = w; }
  if (best === ownKey) return [0, 0];
  for (const [dx, dz] of cands) if (key(dx, dz) === best) return [dx, dz];
  return [0, 0];
}
