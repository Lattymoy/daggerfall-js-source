// @ts-check
// TAVERN-TABLE (2026-10-08, the owner: "Lets instead place a specific table in each inn. A new property specifficaly used
// for the card table"): THE CARD TABLE'S OWN PROP - pure, DOM-free. Every tavern stands one (scenes/interiorContext.js,
// where the floor is found by world/placedCardTable.js), and it is the ONLY card table: Daggerfall's own tables are
// furniture again. A poker table, a long side for two players either side and one at each end (world/cardTables.js
// seatSpots: six seats round its box): a wooden top on four legs, the felt inlaid in it, flush, so the cards lie on the
// table's top (cardTables.js tableFrame reads the world box's top).
//
// THE ART IS OURS. No pixel here comes from ARENA2 (Port-Doctrine: A RENDER OF GAME DATA IS GAME DATA): the felt and
// the wood are PAINTED here, texel by texel, from a fixed hash - the same picture on every client, and no page needed,
// so the build in node draws what the browser draws. String-keyed (CARD_TABLE_ARCHIVE) beside Daggerfall's numbered
// archives, uploaded with their mip chain as world art is (renderer.uploadTexture).
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).

/** The prop's textures: a string archive, its two records. */
export const CARD_TABLE_ARCHIVE = 'cardtable';
export const FELT_RECORD = 'felt';
export const WOOD_RECORD = 'wood';
/** MEASURE (TAVERN-TABLE): the table, in metres - its length (x), breadth (z), the top's height and thickness, the
 *  wooden rail round the felt, the felt's lift over the wood, a leg's square and its inset from the corner. */
export const CARD_TABLE_W = 1.5;
export const CARD_TABLE_D = 1;
export const CARD_TABLE_TOP = 0.76;
export const CARD_TABLE_SLAB = 0.06;
export const CARD_TABLE_RAIL = 0.07;
export const CARD_TABLE_FELT_LIFT = 0.002;
export const CARD_TABLE_LEG = 0.07;
export const CARD_TABLE_LEG_IN = 0.1;
/** The wood's texture repeats every this many metres. */
export const WOOD_TILE_M = 0.5;
/** The painted textures' size (texels, square). */
export const CARD_TABLE_TEX = 64;
/** MEASURE (TAVERN-TABLE): the felt's green and the wood's brown, as RGB. */
export const FELT_RGB = Object.freeze([31, 90, 55]);
export const WOOD_RGB = Object.freeze([107, 66, 38]);

/**
 * The prop's model, its lowest point on y = 0 and its footprint's middle on the origin: `{positions, normals, uvs,
 * indices, subMeshes}` (the shape every model the renderer draws has) - the wood's triangles, then the felt's.
 */
export function cardTablePropModel() {
  const positions = [], normals = [], uvs = [];
  const wood = [], felt = [];
  const quad = (out, corners, n, uv) => {
    const base = positions.length / 3;
    corners.forEach((c, i) => { positions.push(...c); normals.push(...n); uvs.push(...uv[i]); });
    out.push(base, base + 2, base + 1, base, base + 3, base + 2);   // counter-clockwise about its normal - cardTableDraw.js cardModel's winding, the renderer's front
  };
  const t = (a, b) => [[0, 0], [a / WOOD_TILE_M, 0], [a / WOOD_TILE_M, b / WOOD_TILE_M], [0, b / WOOD_TILE_M]];
  // a box of wood, x0..x1 by y0..y1 by z0..z1; `top` false leaves its top off (a leg's, under the slab)
  const box = (x0, x1, y0, y1, z0, z1, top = true) => {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    if (top) quad(wood, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0], t(dx, dz));
    quad(wood, [[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]], [0, -1, 0], t(dx, dz));
    quad(wood, [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [1, 0, 0], t(dz, dy));
    quad(wood, [[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]], [-1, 0, 0], t(dz, dy));
    quad(wood, [[x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1]], [0, 0, 1], t(dx, dy));
    quad(wood, [[x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z0]], [0, 0, -1], t(dx, dy));
  };
  const w = CARD_TABLE_W / 2, d = CARD_TABLE_D / 2, under = CARD_TABLE_TOP - CARD_TABLE_SLAB;
  box(-w, w, under, CARD_TABLE_TOP, -d, d);
  const lx = w - CARD_TABLE_LEG_IN, lz = d - CARD_TABLE_LEG_IN, l = CARD_TABLE_LEG;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const cx = sx * (lx - l / 2), cz = sz * (lz - l / 2);
    box(cx - l / 2, cx + l / 2, 0, under, cz - l / 2, cz + l / 2, false);
  }
  const fw = w - CARD_TABLE_RAIL, fd = d - CARD_TABLE_RAIL, fy = CARD_TABLE_TOP + CARD_TABLE_FELT_LIFT;
  quad(felt, [[-fw, fy, -fd], [fw, fy, -fd], [fw, fy, fd], [-fw, fy, fd]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  return {
    positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs),
    indices: new Uint32Array([...wood, ...felt]),
    subMeshes: [
      { textureArchive: CARD_TABLE_ARCHIVE, textureRecord: WOOD_RECORD, startIndex: 0, primitiveCount: wood.length / 3 },
      { textureArchive: CARD_TABLE_ARCHIVE, textureRecord: FELT_RECORD, startIndex: wood.length, primitiveCount: felt.length / 3 },
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

/** The felt: its green, each texel a little lighter or darker (the nap). */
export const paintFelt = () => painted((x, y) => {
  const k = 0.9 + 0.2 * texelNoise(x, y, 1);
  return FELT_RGB.map((c) => Math.round(c * k));
});

/** The wood: its brown in grain running along u (the texture's x), each row's shade its own and a texel's a little. */
export const paintWood = () => painted((x, y) => {
  const k = 0.8 + 0.25 * texelNoise(0, y, 2) + 0.06 * texelNoise(x, y, 3);
  return WOOD_RGB.map((c) => Math.round(c * k));
});
