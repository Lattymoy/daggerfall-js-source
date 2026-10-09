// @ts-check
// TAVERN-TABLE (2026-10-08, the owner: "Lets instead place a specific table in each inn. A new property specifficaly used
// for the card table"): THE CARD TABLE'S OWN PROP - pure, DOM-free. Every tavern stands one (scenes/interiorContext.js,
// where the floor is found by world/placedCardTable.js), and it is the ONLY card table: Daggerfall's own tables are
// furniture again. A poker table, a long side for two players either side and one at each end (world/cardTables.js
// seatSpots: six seats round its box): a wooden top on four legs, the felt inlaid in it 2 mm proud, so the cards lie on
// the table's top (cardTables.js tableFrame reads the world box's top) - and a stool at every seat (AUDIT TAVERN-TABLE
// M1: a seat stood over the bare floor sat its body on air), stood where seatSpots stands the seat, under the hips.
//
// THE ART IS OURS. No pixel here comes from ARENA2 (Port-Doctrine: A RENDER OF GAME DATA IS GAME DATA): the felt and
// the wood are PAINTED here, texel by texel, from a fixed hash - the same picture on every client, and no page needed,
// so the build in node draws what the browser draws. String-keyed (CARD_TABLE_ARCHIVE) beside Daggerfall's numbered
// archives, uploaded with their mip chain as world art is (renderer.uploadTexture).
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { seatSpots } from './cardTables.js';

/** The prop's textures: a string archive, its two records. */
export const CARD_TABLE_ARCHIVE = 'cardtable';
export const FELT_RECORD = 'felt';
export const WOOD_RECORD = 'wood';
/** TAVERN-TABLES (section 30): the gold table's felt - its own record, so the room's two tables are told apart at a
 *  glance (the chips table green, the gold table red). */
export const GOLD_FELT_RECORD = 'feltgold';
/** MEASURE (TAVERN-TABLE): the table, in metres - its length (x), breadth (z), the top's height and thickness, the
 *  wooden rail round the felt, the felt's lift over the wood, a leg's square and its inset from the corner. The top
 *  stands at the seated pose's own table (seatPose.js SEAT_TOP_DEFAULT; AUDIT TAVERN-TABLE L1: at 0.76 a tall race's
 *  thighs met the slab's underside), and the rail is narrower than a chip stack's inset (cardScene.js STACK_IN less
 *  CHIP_R; AUDIT TAVERN-TABLE L2: at 7 cm the stacks stood on the wood). */
export const CARD_TABLE_W = 1.5;
export const CARD_TABLE_D = 1;
export const CARD_TABLE_TOP = 0.8;
export const CARD_TABLE_SLAB = 0.06;
export const CARD_TABLE_RAIL = 0.04;
export const CARD_TABLE_FELT_LIFT = 0.002;
export const CARD_TABLE_LEG = 0.07;
export const CARD_TABLE_LEG_IN = 0.1;
/** MEASURE (AUDIT TAVERN-TABLE M1): a stool - its seat's square, its top's height (under the seated hips, seatPose.js
 *  SEAT_HIP_DROP below the measured biped's pelvis, less the seat of the body), its seat's thickness, a leg's square and
 *  its inset. Low enough that the seat's own probe reads it as something to sit over (cardTables.js SEAT_SURFACE_MAX). */
export const STOOL_W = 0.34;
export const STOOL_TOP = 0.48;
export const STOOL_SEAT = 0.04;
export const STOOL_LEG = 0.04;
export const STOOL_LEG_IN = 0.03;
/** The wood's texture repeats every this many metres. */
export const WOOD_TILE_M = 0.5;
/** The painted textures' size (texels, square). */
export const CARD_TABLE_TEX = 64;
/** MEASURE (TAVERN-TABLE): the felt's green and the wood's brown, as RGB. */
export const FELT_RGB = Object.freeze([31, 90, 55]);
export const WOOD_RGB = Object.freeze([107, 66, 38]);
/** MEASURE (TAVERN-TABLES): the gold table's red. */
export const GOLD_FELT_RGB = Object.freeze([118, 26, 34]);

/** The TABLE's own box, the stools apart - what its seats stand round (cardTables.js seatSpots) and its floor is found
 *  for (placedCardTable.js); its top the felt's. */
export const CARD_TABLE_BOX = Object.freeze({
  min: Object.freeze([-CARD_TABLE_W / 2, 0, -CARD_TABLE_D / 2]),
  max: Object.freeze([CARD_TABLE_W / 2, CARD_TABLE_TOP + CARD_TABLE_FELT_LIFT, CARD_TABLE_D / 2]),
});

/**
 * The prop's model, its lowest point on y = 0 and the table's footprint's middle on the origin: `{positions, normals,
 * uvs, indices, subMeshes}` (the shape every model the renderer draws has) - the wood's triangles (the table, then its
 * stools), then the felt's. TAVERN-TABLES: `felt` the felt's record (GOLD_FELT_RECORD for the gold table).
 */
export function cardTablePropModel({ felt: feltRecord = FELT_RECORD } = {}) {
  const positions = [], normals = [], uvs = [];
  const wood = [], felt = [];
  const quad = (out, corners, n, uv) => {
    const base = positions.length / 3;
    corners.forEach((c, i) => { positions.push(...c); normals.push(...n); uvs.push(...uv(c, i)); });
    out.push(base, base + 2, base + 1, base, base + 3, base + 2);   // counter-clockwise about its normal - cardTableDraw.js cardModel's winding, the renderer's front
  };
  // THE WOOD'S UVS ARE THE FACE'S OWN AXES (AUDIT TAVERN-TABLE L4): the grain (the texture's u) runs along a top's
  // length, round a side, and up a leg (`upright`); v across - every face tiled at WOOD_TILE_M in its own metres
  const woodUv = (n, upright) => {
    const [u, v] = n[1] !== 0 ? [0, 2] : upright ? [1, n[0] !== 0 ? 2 : 0] : [n[0] !== 0 ? 2 : 0, 1];
    return (c) => [c[u] / WOOD_TILE_M, c[v] / WOOD_TILE_M];
  };
  // a box of wood, x0..x1 by y0..y1 by z0..z1; `top` false leaves its top off (a leg's, under a top)
  const box = (x0, x1, y0, y1, z0, z1, { top = true, upright = false } = {}) => {
    const face = (corners, n) => quad(wood, corners, n, woodUv(n, upright));
    if (top) face([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]);
    face([[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]], [0, -1, 0]);
    face([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [1, 0, 0]);
    face([[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]], [-1, 0, 0]);
    face([[x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1]], [0, 0, 1]);
    face([[x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z0]], [0, 0, -1]);
  };
  // four legs inset from a square's corners, under a top at `under`
  const legs = (hx, hz, inset, l, under, ox = 0, oz = 0) => {
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const cx = ox + sx * (hx - inset - l / 2), cz = oz + sz * (hz - inset - l / 2);
      box(cx - l / 2, cx + l / 2, 0, under, cz - l / 2, cz + l / 2, { top: false, upright: true });
    }
  };
  const w = CARD_TABLE_W / 2, d = CARD_TABLE_D / 2, under = CARD_TABLE_TOP - CARD_TABLE_SLAB;
  box(-w, w, under, CARD_TABLE_TOP, -d, d);
  legs(w, d, CARD_TABLE_LEG_IN, CARD_TABLE_LEG, under);
  const sw = STOOL_W / 2, sUnder = STOOL_TOP - STOOL_SEAT;
  for (const s of seatSpots(CARD_TABLE_BOX)) {
    box(s.lx - sw, s.lx + sw, sUnder, STOOL_TOP, s.lz - sw, s.lz + sw);
    legs(sw, sw, STOOL_LEG_IN, STOOL_LEG, sUnder, s.lx, s.lz);
  }
  const fw = w - CARD_TABLE_RAIL, fd = d - CARD_TABLE_RAIL, fy = CARD_TABLE_TOP + CARD_TABLE_FELT_LIFT;
  const feltUv = [[0, 0], [1, 0], [1, 1], [0, 1]];
  quad(felt, [[-fw, fy, -fd], [fw, fy, -fd], [fw, fy, fd], [-fw, fy, fd]], [0, 1, 0], (_, i) => feltUv[i]);
  return {
    positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs),
    indices: new Uint32Array([...wood, ...felt]),
    subMeshes: [
      { textureArchive: CARD_TABLE_ARCHIVE, textureRecord: WOOD_RECORD, startIndex: 0, primitiveCount: wood.length / 3 },
      { textureArchive: CARD_TABLE_ARCHIVE, textureRecord: feltRecord, startIndex: wood.length, primitiveCount: felt.length / 3 },
    ],
  };
}

/** A texel's fixed noise, 0..1 (an integer hash - the same on every client). */
export function texelNoise(x, y, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** A painted texture, `{width, height, colors}` (RGBA, renderer.uploadTexture's color32), each texel `rgb(x, y)`. */
function painted(rgb) {
  const n = CARD_TABLE_TEX, colors = new Uint8ClampedArray(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const [r, g, b] = rgb(x, y), o = (y * n + x) * 4;
    colors[o] = r; colors[o + 1] = g; colors[o + 2] = b; colors[o + 3] = 255;
  }
  return { width: n, height: n, colors };
}

/** The felt: its green (TAVERN-TABLES: or `rgb`, the gold table's red), each texel a little lighter or darker (the
 *  nap). */
export const paintFelt = (rgb = FELT_RGB) => painted((x, y) => {
  const k = 0.9 + 0.2 * texelNoise(x, y, 1);
  return rgb.map((c) => Math.round(c * k));
});

/** The wood: its brown in grain running along u (the texture's x), each row's shade its own and a texel's a little. */
export const paintWood = () => painted((x, y) => {
  const k = 0.8 + 0.25 * texelNoise(0, y, 2) + 0.06 * texelNoise(x, y, 3);
  return WOOD_RGB.map((c) => Math.round(c * k));
});
