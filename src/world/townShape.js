// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TOWN-SHAPES (2026-10-25, the owner: "IC should be round, give other towns
// unique shapes. Its time to move away from perfect squares. Ensure nobody's
// home is removed. This needs to be perfection"; bible/03-World/Town-Shapes.md)
// - A TOWN'S OWN OUTLINE.
//
// DFU's reference: a town is a rectangle of RMB blocks, and the ground under
// it the bounding box of the tiles its blocks stamp (TerrainHelper.SetLocation
// Tiles, world/terrain/terrainTiles.js setLocationTiles), flattened whole and
// blended to the pixel's edge (BlendLocationTerrainJob) - a square plateau, on
// a coast a square of land cut into the sea.
//
// DEPARTURE (named; Port-Ledger section A): a town's ground is its SHAPE -
// every tile its buildings stand on (the blocks' own town-map bytes,
// AutoMapData: a byte not 0 is a building's or a wall's), the streets between
// them (any hole the outline closes round), and a margin about them whose
// width wanders on a noise of the town's own seed - so no two towns share an
// outline and none is a square. NO BLOCK IS DROPPED AND NO BUILDING MOVES: the
// grid, its blocks and every building key are Daggerfall's (net/homeLaw.js: a
// home is its town's map id and its building's key), so every home stands
// where it stood. A walled city of the Bay keeps Daggerfall's wall ring, its
// ground round it; one past the Bay stands on its round, walled on it (TS4:
// townRound, world/townWalls.js). The water a town stands beside stays water
// past its margin (world/terrain/terrainTiles.js townGroundMask).
//
// Pure - the terrain's worker and the main thread make the same outline.
// ═══════════════════════════════════════════════════════════════════

/** Ground tiles a block a side (world/terrain/terrainTiles.js RMB_TILES_PER_BLOCK) and town-map cells a block a side. */
export const SHAPE_TILES_PER_BLOCK = 16;
export const SHAPE_AUTOMAP_SIDE = 64;
/** THE OUTLINE'S MEASURES, in ground tiles (6.4 m): the margin about the buildings, how far it wanders either way, and the
 *  wander's scale (its noise's cell) - the wander always less than the margin, so every building's tile is inside. */
export const TOWN_SHAPE = Object.freeze({ margin: 4.5, wander: 3, scale: 14, seaMargin: 1.5 });
/** A wall block's name (BLOCKS.BSA's twelve: WALLAA00-11) - its bytes are the wall's, never the town's ground. */
export const isWallBlock = (name) => /^WALLAA\d\d/i.test(String(name ?? ''));
/** TS4: a city's own block that carries its wall (world/townWalls.js townWallBlockName) - its model and markers stand on
 *  the round's ground, never shape it. */
export const isWallCarrier = (name) => /^TESW[0-9A-Z]+\.RMB$/i.test(String(name ?? ''));
/** TS4: A WALLED CITY'S ROUND, in ground tiles: its wall's line out from the nearest building (Daggerfall's stands 12.8 m
 *  out from the blocks it guards), how far its buildings are closed into one round (a gap between two blocks' houses is the
 *  town's), and the town's own ground past the wall's line - the wall, its gates' markers (15.2 m out, more past a gate
 *  on a hollow bend) and room round them. */
export const WALL_ROUND = Object.freeze({ line: 2.5, close: 5, apron: 4.5 });

/**
 * THE TILES A TOWN'S BUILDINGS STAND ON: its grid of `w` x `h` blocks, `automapOf(bx, by)` a block's 64 x 64 town-map bytes
 * (or null: a block the reader has none of) - a tile is taken where any of its 4 x 4 bytes is not 0. Tile (x, y) in the
 * town's tiles, y north (world/terrain/terrainTiles.js setLocationTiles: a block's tile (tx, 15 - ty) of its ground; the
 * town map's row r is the tile row 15 - r/4, measured on the wall blocks). A wall block takes none.
 * @param {number} w @param {number} h @param {(bx: number, by: number) => (Uint8Array|null|undefined)} automapOf
 * @param {(bx: number, by: number) => boolean} [isWall]
 * @returns {Uint8Array} 1 a building's tile, (w*16) x (h*16), row-major from the south-west
 */
export function townOccupancy(w, h, automapOf, isWall = () => false) {
  const T = SHAPE_TILES_PER_BLOCK,
    W = w * T,
    out = new Uint8Array(W * h * T);
  for (let by = 0; by < h; by++) {
    for (let bx = 0; bx < w; bx++) {
      if (isWall(bx, by)) continue;
      const am = automapOf(bx, by);
      if (!am) continue;
      for (let r = 0; r < SHAPE_AUTOMAP_SIDE; r++) {
        for (let c = 0; c < SHAPE_AUTOMAP_SIDE; c++) {
          if (!am[r * SHAPE_AUTOMAP_SIDE + c]) continue;
          out[(by * T + (T - 1 - (r >> 2))) * W + bx * T + (c >> 2)] = 1;
        }
      }
    }
  }
  return out;
}

/** A misc record's block units a tile (6.4 m): its block metres x east (x * 0.025), z north ((z + 4096) * 0.025 -
 *  world/tamrielCapitals.js miscModelAt's law). */
const RECORD_TILE_UNITS = 256;
/**
 * THE TILES A TOWN STANDS ON: its buildings' (townOccupancy, each block's town-map bytes) and its blocks' misc models' and
 * flats', each the tile it stands on and the eight about it - a fence, a well, a statue, a tree of the block's own stands
 * on the town's ground, never the land's slope. `rmbAt(bx, by)` a block's RMB half, or null.
 * @param {number} w @param {number} h @param {(bx: number, by: number) => any} rmbAt
 * @returns {Uint8Array} (w*16) x (h*16), row-major from the south-west
 */
export function townTiles(w, h, rmbAt) {
  const T = SHAPE_TILES_PER_BLOCK,
    W = w * T,
    H = h * T;
  const occ = townOccupancy(w, h, (bx, by) => rmbAt(bx, by)?.fldHeader?.autoMapData ?? null);
  for (let by = 0; by < h; by++) {
    for (let bx = 0; bx < w; bx++) {
      const rmb = rmbAt(bx, by);
      for (const r of [...(rmb?.misc3dObjectRecords ?? []), ...(rmb?.miscFlatObjectRecords ?? [])]) {
        const tx = Math.floor(r.xPos / RECORD_TILE_UNITS),
          ty = Math.floor((r.zPos + 4096) / RECORD_TILE_UNITS);
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const x = bx * T + tx + dx,
              y = by * T + ty + dy;
            if (x >= 0 && x < W && y >= 0 && y < H) occ[y * W + x] = 1;
          }
      }
    }
  }
  return occ;
}

/** FB1028 CROP-GROUND: the fields of flats (world/flatFields.js, which re-exports these): a model id that sows a field,
 *  and its measure. Kept here so the terrain's outline reads it with no module more on the boot path. */
const _fields = new Map();
/** @param {number} id @param {{ rangeX: number, rangeZ: number, spacing: number, noise: number, firstRecordOnly?: boolean }} spec @param {() => boolean} [isOn] */
export function registerFlatField(id, spec, isOn = () => true) {
  _fields.set(Number(id), { spec: Object.freeze({ ...spec }), isOn });
}
/** @param {number} id */
export function flatFieldFor(id) {
  const f = _fields.get(Number(id));
  return f && f.isOn() ? f.spec : null;
}
export function _resetFlatFields() {
  _fields.clear();
}

/**
 * FB1028 CROP-GROUND: THE TILES A TOWN'S FIELDS ARE SOWN OVER. A field's plants stand on its block's plane, over a
 * rectangle round its record (flatFields.js sowField, in the world's axes, each plant nudged up to `noise`), so every
 * tile of it is the town's - its record's tile alone left the plants over the land's slope and the sea.
 * @param {number} w @param {number} h @param {(bx: number, by: number) => any} rmbAt @param {number} [pad] tiles each side
 * @returns {?Uint8Array} 1 a field's tile, (w*16 + 2pad) x (h*16 + 2pad) row-major from the south-west, or null for none
 */
export function townFieldTiles(w, h, rmbAt, pad = 0) {
  const T = SHAPE_TILES_PER_BLOCK,
    PW = w * T + 2 * pad,
    PH = h * T + 2 * pad,
    UNITS = 40; // a block unit is 0.025 m
  let out = null;
  for (let by = 0; by < h; by++) {
    for (let bx = 0; bx < w; bx++) {
      for (const r of rmbAt(bx, by)?.misc3dObjectRecords ?? []) {
        const f = flatFieldFor(r.modelIdNum);
        if (!f) continue;
        const hx = (Math.trunc(f.rangeX / 2) + f.noise) * UNITS,
          hz = (Math.trunc(f.rangeZ / 2) + f.noise) * UNITS,
          z = r.zPos + 4096;
        out ??= new Uint8Array(PW * PH);
        for (let y = Math.floor((z - hz) / RECORD_TILE_UNITS); y <= Math.floor((z + hz) / RECORD_TILE_UNITS); y++) {
          for (
            let x = Math.floor((r.xPos - hx) / RECORD_TILE_UNITS);
            x <= Math.floor((r.xPos + hx) / RECORD_TILE_UNITS);
            x++
          ) {
            const X = pad + bx * T + x,
              Y = pad + by * T + y;
            if (X >= 0 && Y >= 0 && X < PW && Y < PH) out[Y * PW + X] = 1;
          }
        }
      }
    }
  }
  return out;
}

/** A hash of integers in [0, 1) - the outline's own noise, the same on every client and in every worker. */
function hash01(seed, x, y) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (const v of [x, y]) {
    h = Math.imul(h ^ (v | 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}
/** The outline's wander at tile (x, y): two octaves of smoothed value noise on the town's seed, in [-1, 1].
 *  @param {number} seed @param {number} x @param {number} y @param {number} [scale] its noise's cell, in tiles */
export function shapeWander(seed, x, y, scale = TOWN_SHAPE.scale) {
  let v = 0,
    amp = 1,
    sum = 0,
    s = scale;
  for (let o = 0; o < 2; o++) {
    const fx = x / s,
      fy = y / s,
      ix = Math.floor(fx),
      iy = Math.floor(fy),
      tx = fx - ix,
      ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx),
      sy = ty * ty * (3 - 2 * ty);
    const k = seed + o * 0x51ed27;
    const a = hash01(k, ix, iy),
      b = hash01(k, ix + 1, iy),
      c = hash01(k, ix, iy + 1),
      d = hash01(k, ix + 1, iy + 1);
    v += amp * (a + (b - a) * sx + (c + (d - c) * sx - (a + (b - a) * sx)) * sy);
    sum += amp;
    amp *= 0.5;
    s /= 2;
  }
  return (v / sum) * 2 - 1;
}

/** TS9: a town's road ring's codes (terrain/terrainTiles.js townRoadRing, road/roadPainter.js): a whole road tile, and the
 *  half tiles that blend its angled edges - each the road's own diagonal edge (the painter's DIAG_OUT: 47 over dirt, 55
 *  over grass) with its road toward a corner. */
export const RING = Object.freeze({ road: 1, NW: 2, NE: 3, SE: 4, SW: 5 });

/**
 * Each tile's distance (in tiles) to the nearest taken one - an exact Euclidean transform (Felzenszwalb's, two passes of
 * the lower envelope) over the town's tiles; Infinity on a town with none.
 * @param {Uint8Array} occ @param {number} W @param {number} H @returns {Float64Array}
 */
export function tileDistance(occ, W, H) {
  const INF = 1e20,
    f = new Float64Array(Math.max(W, H)),
    d = new Float64Array(W * H);
  const line = (n, get, set) => {
    const v = new Int32Array(n),
      z = new Float64Array(n + 1),
      g = new Float64Array(n);
    for (let i = 0; i < n; i++) g[i] = get(i);
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = (g[q] + q * q - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (g[q] + q * q - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      set(q, (q - v[k]) ** 2 + g[v[k]]);
    }
  };
  for (let i = 0; i < W * H; i++) d[i] = occ[i] ? 0 : INF;
  for (let x = 0; x < W; x++)
    line(
      H,
      (y) => d[y * W + x],
      (y, val) => {
        f[y] = val;
        if (y === H - 1) for (let yy = 0; yy < H; yy++) d[yy * W + x] = f[yy];
      },
    );
  for (let y = 0; y < H; y++)
    line(
      W,
      (x) => d[y * W + x],
      (x, val) => {
        f[x] = val;
        if (x === W - 1) for (let xx = 0; xx < W; xx++) d[y * W + xx] = f[xx];
      },
    );
  for (let i = 0; i < W * H; i++) d[i] = d[i] >= INF / 2 ? Infinity : Math.sqrt(d[i]);
  return d;
}

/**
 * TS4: A WALLED CITY'S ROUND: the tiles `line` or nearer a building's, closed by `close` (grown by it and shrunk back - a
 * gap under twice it between two buildings' rounds is the town's), its holes filled (`inside`), and the field its edge is
 * traced on (`level`: past 0 inside - the tile's depth in from the grown round's edge less `close`, a hole's 0.5 - and 0 or
 * under outside).
 * @param {Uint8Array} occ @param {number} W @param {number} H @param {number} [line] @param {number} [close]
 * @returns {{ inside: Uint8Array, level: Float64Array }}
 */
export function townRound(occ, W, H, line = WALL_ROUND.line, close = WALL_ROUND.close) {
  const d = tileDistance(occ, W, H),
    grown = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) grown[i] = d[i] > line + close ? 1 : 0;
  const e = tileDistance(grown, W, H),
    inside = new Uint8Array(W * H),
    level = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) {
    inside[i] = !grown[i] && e[i] > close ? 1 : 0;
    level[i] = grown[i] ? -1 : e[i] - close;
  }
  const seen = new Uint8Array(W * H),
    stack = [];
  const push = (x, y) => {
    const i = y * W + x;
    if (!inside[i] && !seen[i]) {
      seen[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < W; x++) {
    push(x, 0);
    push(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    push(0, y);
    push(W - 1, y);
  }
  while (stack.length) {
    const i = /** @type {number} */ (stack.pop()),
      x = i % W,
      y = (i - x) / W;
    if (x > 0) push(x - 1, y);
    if (x < W - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < H - 1) push(x, y + 1);
  }
  for (let i = 0; i < W * H; i++)
    if (!inside[i] && !seen[i]) {
      inside[i] = 1;
      level[i] = 0.5;
    }
  return { inside, level };
}

/**
 * A TOWN'S SHAPE over its tiles, as a field: 0 outside it, else 1 + its tile's distance to a building's in quarter tiles
 * (254 the most) - every tile within its margin of a building's (the margin wandering on the town's seed - never so far in
 * that a building's tile is left out), and every hole the outline closes round filled (a square, a street, a garden
 * between the houses is the town's: its distance its own). The water a town stands beside is the terrain's to take off
 * (world/terrain/terrainTiles.js townGroundMask: a tile of the margin past TOWN_SHAPE.seaMargin over the sea is none). A town
 * of no building's tile is its whole grid (nothing to shape round), each tile 1.
 * @param {Uint8Array} occ townOccupancy's @param {number} W @param {number} H tiles a side
 * @param {number} seed the town's own (its map id)
 * @param {{ margin?: number, wander?: number, core?: number }} [o] TS4: `core` the tiles within it of a taken one the
 *   town's own (coded 1 - world/terrain/terrainTiles.js townGroundMask keeps them on water too)
 * @returns {Uint8Array}
 */
export function townShapeField(occ, W, H, seed, o = {}) {
  const margin = o.margin ?? TOWN_SHAPE.margin,
    wander = Math.min(o.wander ?? TOWN_SHAPE.wander, margin - 0.5),
    core = o.core ?? 0;
  const out = new Uint8Array(W * H);
  if (!occ.some((v) => v)) return out.fill(1);
  const dist = tileDistance(occ, W, H);
  const enc = (d) => 1 + Math.min(253, Math.round(d * 4));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x,
        d = dist[i];
      if (d <= core)
        out[i] = 1; // TS4: the round's own ground - a wall's, its markers' - its distance none
      else if (d <= margin + wander * shapeWander(seed >>> 0, x, y)) out[i] = enc(d);
    }
  }
  // the holes: every tile the outside cannot reach is the town's
  const seen = new Uint8Array(W * H),
    stack = [];
  const push = (x, y) => {
    const i = y * W + x;
    if (!out[i] && !seen[i]) {
      seen[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < W; x++) {
    push(x, 0);
    push(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    push(0, y);
    push(W - 1, y);
  }
  while (stack.length) {
    const i = /** @type {number} */ (stack.pop()),
      x = i % W,
      y = (i - x) / W;
    if (x > 0) push(x - 1, y);
    if (x < W - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < H - 1) push(x, y + 1);
  }
  for (let i = 0; i < W * H; i++) if (!out[i] && !seen[i]) out[i] = enc(dist[i]);
  return out;
}
/** A field's tile's distance to a building's, in tiles (townShapeField's), or Infinity outside the shape. @param {number} v */
export const shapeFieldDistance = (v) => (v ? (v - 1) / 4 : Infinity);
/** A TOWN'S SHAPE as a mask - townShapeField's tiles, 1 the town's. The same arguments. */
export function townShape(occ, W, H, seed, o = {}) {
  return townShapeField(occ, W, H, seed, o).map((v) => (v ? 1 : 0));
}

/**
 * TS6: THE WALKERS' TOWN - its walk grid (world/city/cityNavigation.js: four cells a ground tile, its rows the location's
 * tile rows from the north edge, as setLocationTiles stamps them) shut past its ground: `ground` the pixel's tiles that are
 * the town's (world/terrain/terrainTiles.js townGroundMask, index x + y * 128), its grid's south-west tile at `tilePos`. A
 * cell whose tile is none of the town's walks no one - a town past the Bay's open cells (TS3), a Bay town's square past
 * its outline, its tiles the sea took back (TS2). DFU walks the whole grid (CityNavigation.SetRMBData).
 * @param {{width: number, height: number, grid: Uint8Array}} nav @param {Uint8Array} ground @param {{x: number, y: number}} tilePos
 */
export function shutOffGround(nav, ground, tilePos) {
  for (let gy = 0; gy < nav.height; gy++) {
    for (let gx = 0; gx < nav.width; gx++) {
      if (!onTownTile(ground, tilePos, gx, gy)) nav.grid[gy * nav.width + gx] = 0;
    }
  }
}
/**
 * TS6, TOWN-BOARDS: IS A CELL OF A TOWN'S GRID ON A TILE OF A PIXEL'S MASK - the walk grid's cell (gx, gy), four a ground
 * tile, x east and y north from the grid's south-west tile at `tilePos`; `tiles` one of the pixel's masks (index x + y *
 * 128): its town's ground (world/terrain/terrainTiles.js townGroundMask - the ground TS2 flattens, never the land it eases
 * back to), or the paths its terrain painted (TS10, roadPainter.js GRASS-PATH1). The one law the walkers are shut by
 * (shutOffGround) and the town's fabric is planned on (world/urban/townFabricStand.js townFabricFor: its ground and its
 * painted roads); world/townWalls.js paveOnGrid reads the same tiles the same way. @param {ArrayLike<number>} tiles
 * @param {{x: number, y: number}} tilePos @param {number} gx @param {number} gy
 */
export function onTownTile(tiles, tilePos, gx, gy) {
  const D = 128;
  const ty = tilePos.y + (gy >> 2);
  const tx = tilePos.x + (gx >> 2);
  return tx >= 0 && ty >= 0 && tx < D && ty < D && !!tiles[tx + ty * D];
}
/** TS7: a location as its template was read - a Bay city world/townOutline.js wallBayCity walled, its own ring again and
 *  no outline (the places past the Bay clone their templates' grids, rings and gates and all); any other location itself.
 *  @param {any} loc */
export function unwalledLocation(loc) {
  const ed = loc?.exterior?.exteriorData;
  if (!ed?.wallTook) return loc;
  const { wallTook, ...rest } = ed;
  const { outline, ...out } = loc;
  return { ...out, exterior: { ...loc.exterior, exteriorData: { ...rest, blockNames: wallTook } } };
}
