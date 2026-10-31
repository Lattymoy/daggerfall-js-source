// @ts-check
// COAST-LOOK (2026-10-28, the owner: "Coastlines arent texture blended properly. They have hard edges" - "Both edges";
// bible/07-Rendering/Water-Arc.md COAST-LOOK, a departure: Port-Ledger A). A marching-squares transition tile (water-dirt,
// dirt-grass, grass-stone and the river painter's shore twins) is drawn as its two kinds' base records, the second
// kind's share the bilinear of its corners moved by a wander and drawn across a soft rim: one line across every seam.
// The water's sheet and silt take the same line, and Deep Waters' cut follows a wandering line inside the clipped tiles
// (COAST_CUT). The physics keep DFU's corner table. render/groundEdgeGlsl.js is the GLSL twin, term for term, and
// test/render/coastlook.test.js holds the two together.
import { createLookupTable } from './terrainTiles.js';
import { convertTile } from './terrainSurface.js';
import { SHORE_FAMILIES } from '../water/waterCorners.js';
import { roadEdgeNoise } from '../road/roadEdge.js'; // the lattice noise, its one home (ROAD-LOOK)

/** The ground's kinds, a corner's tileData (terrainTiles.js generateTileData), each its base record (a pure tile's). */
export const GROUND_KIND = Object.freeze({ water: 0, dirt: 1, grass: 2, stone: 3 });

/** The rim's half width and the wander, in the share's units. The octaves' lattices are whole cells a pixel's side (a bay
 *  some 25 m across, a ragged 6 m, a broken 1.6 m), so the field is the same on both sides of a pixel's edge. */
export const GROUND_EDGE = Object.freeze({
  soft: 0.08,
  wander: Object.freeze([
    Object.freeze({ cells: 32, amp: 0.16 }),
    Object.freeze({ cells: 128, amp: 0.08 }),
    Object.freeze({ cells: 512, amp: 0.04 }),
  ]),
  salt: 0x6e1,
});
/** How far from the line (in share) a point can be anything but one kind: the rim and the wander's widest. */
export const GROUND_EDGE_REACH = GROUND_EDGE.soft + GROUND_EDGE.wander.reduce((s, o) => s + o.amp, 0);

/** The families by column (corner, edge, three corners, saddle): `a` the kind at the unset corners, `b` at the set ones -
 *  the odd kind's (marchTile's shape bits); the shore twins' set corners are the land's. */
const FAMILIES = Object.freeze([
  { records: SHORE_FAMILIES[0], a: GROUND_KIND.water, b: GROUND_KIND.dirt, ring: 0 },
  { records: Object.freeze([10, 11, 12, 51]), a: GROUND_KIND.grass, b: GROUND_KIND.dirt, ring: 1 },
  { records: Object.freeze([15, 16, 17, 53]), a: GROUND_KIND.grass, b: GROUND_KIND.stone, ring: 2 },
  { records: SHORE_FAMILIES[1], a: GROUND_KIND.water, b: GROUND_KIND.grass, ring: 0 },
  { records: SHORE_FAMILIES[2], a: GROUND_KIND.water, b: GROUND_KIND.stone, ring: 0 },
]);

/** An entry: 0 for no transition, else 1 | a << 1 | b << 3 | mask << 5 (mask bit 1 corner (0,0), 2 (1,0), 4 (0,1),
 *  8 (1,1): the tilemap's frame, as world/water/waterCorners.js's). */
const entry = (a, b, mask) => 1 | (a << 1) | (b << 3) | (mask << 5);

/** The transitions' corners by converted byte (record << 2 | turn): what the march wrote each from, the shore twins by
 *  the water-dirt column, a saddle half turned as its unturned self (WATER-DRAW2's rule). */
export function buildGroundKindTable() {
  const table = new Uint16Array(256);
  const lookup = createLookupTable();
  for (const fam of FAMILIES.slice(0, 3)) {
    for (let shape = 1; shape < 15; shape++) {
      const raw = lookup[shape | (fam.ring << 4)];
      const k = fam.records.indexOf(raw & 0x3f);
      if (k < 0)
        throw new Error(
          `COAST-LOOK: ring ${fam.ring}'s shape ${shape} wrote record ${raw & 0x3f}, no transition of its family`,
        );
      const at = convertTile(raw),
        e = entry(fam.a, fam.b, shape);
      if (table[at] && table[at] !== e) throw new Error(`COAST-LOOK: byte ${at} written by two shapes`);
      table[at] = e;
      // the river painter's twins: the same column, the same turn, the water's land another kind
      if (fam.ring === 0)
        for (const twin of FAMILIES.slice(3)) table[(twin.records[k] << 2) | (at & 3)] = entry(twin.a, twin.b, shape);
    }
  }
  for (const fam of FAMILIES) {
    const saddle = fam.records[3];
    for (const t of [2, 3]) if (!table[(saddle << 2) | t]) table[(saddle << 2) | t] = table[(saddle << 2) | (t - 2)];
  }
  return table;
}

/** The 256 converted bytes' entries. */
export const GROUND_KIND_TABLE = buildGroundKindTable();

/** A byte's transition, or null: `{ a, b, mask }` - the kind at the unset corners, the kind at the set ones. */
export function groundKindsOf(byte) {
  const e = GROUND_KIND_TABLE[byte & 0xff];
  return e ? { a: (e >> 1) & 3, b: (e >> 3) & 3, mask: (e >> 5) & 15 } : null;
}

/** Packed two entries to a uint, as the shader's GE_KINDS: entry i is word i >> 1, its half i & 1. */
export function packGroundKinds(table = GROUND_KIND_TABLE) {
  const words = new Uint32Array(128);
  for (let i = 0; i < 256; i++) words[i >> 1] = (words[i >> 1] | ((table[i] & 0xffff) << ((i & 1) * 16))) >>> 0;
  return words;
}

/** The bilinear of a corner mask at (fx, fy) inside a tile - the corners' share, set 1 and unset 0. */
export function cornerShare(mask, fx, fy) {
  const c00 = mask & 1,
    c10 = (mask >> 1) & 1,
    c01 = (mask >> 2) & 1,
    c11 = (mask >> 3) & 1;
  const top = c00 + (c10 - c00) * fx,
    bottom = c01 + (c11 - c01) * fx;
  return top + (bottom - top) * fy;
}

/** The wander at a pixel-local point (tiles), within +-(the amplitudes' sum): the road edge's lattice, on its own salt. */
export function groundEdgeWander(x, y) {
  let w = 0;
  GROUND_EDGE.wander.forEach((o, k) => {
    w += o.amp * (2 * roadEdgeNoise(x, y, o.cells, GROUND_EDGE.salt + k) - 1);
  });
  return w;
}

const smoothstep = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** A corner share moved by the wander at the pixel-local point (x, y) and drawn across the rim: 0 to 1. */
export function edgeShare(share, x, y) {
  return smoothstep(0.5 - GROUND_EDGE.soft, 0.5 + GROUND_EDGE.soft, share + groundEdgeWander(x, y));
}

/** The blend of a tile's byte at a pixel-local point: null (its own picture), or `{ a, b, share }`.
 *  @param {number} byte @param {number} x @param {number} y */
export function groundEdgeAt(byte, x, y) {
  const k = groundKindsOf(byte);
  if (!k) return null;
  const fx = x - Math.floor(x),
    fy = y - Math.floor(y);
  return { a: k.a, b: k.b, share: edgeShare(cornerShare(k.mask, fx, fy), x, y) };
}

/** DEEP WATERS' CUT PER FRAGMENT: the mod discards a clipped tile whole (a staircase). Here a clipped tile's point is cut
 *  where the share of clipped cells about it (the dual square's bilinear, ROAD-LOOK's), plus the wander, passes `line`;
 *  a kept point draws the nearest kept cell's picture, mirrored. A kept cell's seam reads at most 0.75 and a quadrant
 *  of clipped cells 1, so the line stays inside (0.75, 1): never along a kept seam, never a notch. */
export const COAST_CUT = Object.freeze({
  line: 0.875,
  /** the wander's widest move of the line, either way */
  reach: 0.12,
});
/** The ground's wander (+-(GROUND_EDGE_REACH - soft) at its widest) carried as +-reach. */
export const COAST_CUT_WANDER = COAST_CUT.reach / (GROUND_EDGE_REACH - GROUND_EDGE.soft);

/** The cut at a pixel-local point: `{ cut, from }` - `from` the kept cell a kept point of a clipped cell draws.
 *  `cutAt(cx, cy)` whether a cell is clipped (the caller clamps to its tilemap).
 *  @param {(cx: number, cy: number) => boolean} cutAt @param {number} x @param {number} y */
export function coastCutAt(cutAt, x, y) {
  const D = 128,
    cx = Math.min(D - 1, Math.max(0, Math.floor(x))),
    cy = Math.min(D - 1, Math.max(0, Math.floor(y)));
  if (!cutAt(cx, cy)) return { cut: false, from: null };
  const fx = x - cx,
    fy = y - cy,
    sx = fx < 0.5 ? -1 : 1,
    sy = fy < 0.5 ? -1 : 1;
  const cb = [cx + sx, cy],
    cc = [cx, cy + sy],
    cd = [cx + sx, cy + sy];
  const kb = cutAt(cb[0], cb[1]),
    kc = cutAt(cc[0], cc[1]),
    kd = cutAt(cd[0], cd[1]);
  if (kb && kc && kd) return { cut: true, from: null };
  const kx = Math.floor(x + 0.5),
    ky = Math.floor(y + 0.5),
    s0 = x - (kx - 0.5),
    s1 = y - (ky - 0.5);
  const wx = (c) => (c === kx ? s0 : 1 - s0),
    wy = (c) => (c === ky ? s1 : 1 - s1);
  const lin =
    wx(cx) * wy(cy) +
    (kb ? wx(cb[0]) * wy(cb[1]) : 0) +
    (kc ? wx(cc[0]) * wy(cc[1]) : 0) +
    (kd ? wx(cd[0]) * wy(cd[1]) : 0);
  if (lin + COAST_CUT_WANDER * groundEdgeWander(x, y) > COAST_CUT.line) return { cut: true, from: null };
  // kept: the nearest kept cell across this corner - its x or y neighbour (the nearer edge first), else the diagonal
  const u = Math.min(fx, 1 - fx),
    v = Math.min(fy, 1 - fy);
  const order =
    u <= v
      ? [
          [kb, cb],
          [kc, cc],
        ]
      : [
          [kc, cc],
          [kb, cb],
        ];
  for (const [k, c] of order) if (!k) return { cut: false, from: /** @type {[number, number]} */ (c) };
  return { cut: false, from: /** @type {[number, number]} */ (cd) };
}
