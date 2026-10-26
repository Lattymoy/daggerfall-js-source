// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TOWN-SHAPES TS4 (2026-10-25, the owner: "give other towns unique shapes.
// Its time to move away from perfect squares ... This needs to be
// perfection"; bible/03-World/Town-Shapes.md TS4) - A CITY PAST THE BAY
// WALLED ON ITS OWN OUTLINE.
//
// DFU's reference: a city's walls are the ring of its MAPS.BSA grid - the
// twelve WALLAA blocks, corner towers (444) and straight runs of Daggerfall's
// wall (445) on each side, a gate (446) in the four gate blocks with the
// city's start markers fifteen metres outside it - a rectangle, its walls
// hugging the blocks inside (12.8 m in from the ring cell's inner edge).
//
// DEPARTURE (named; Port-Ledger section A, TOWN-SHAPES): a city past the Bay
// (its ring left out with the cells its outline leaves - world/townOutline.js)
// stands a wall of Daggerfall's own pieces on the edge of its round (world/
// townShape.js townRound: WALL_ROUND.line out from the nearest building, its
// buildings closed into one round) - a tower (444) at every bend, two
// lengths of wall (445) between towers, a gate (446) at the bearing of each
// of its template's gates with a tower either side, and a start marker outside
// each gate where Daggerfall stands them. The pieces are one model of the
// town's own (world/customModels.js, built from the player's ARCH3D), carried
// by a block of the town's own in its south-west cell (the ring's corner -
// always left out). Its ground is its round and an apron past it (world/
// terrain/terrainTiles.js locationShapeField). The Bay's cities keep
// Daggerfall's walls: their gate
// blocks carry their start markers, Immersive Travel's carriages and the town
// mods' gates.
//
// Pure, but for the registrations (standTownWall - the host stands them).
// ═══════════════════════════════════════════════════════════════════
import { townTiles, townRound, isWallCarrier, shutOffGround, SHAPE_TILES_PER_BLOCK, SHAPE_AUTOMAP_SIDE, WALL_ROUND } from './townShape.js';
import { composeArenaModel } from './arena/arenaModel.js';
import { registerPortBlock } from '../formats/worldData/worldDataReplacement.js';
import { registerCustomModel } from './customModels.js';
import { carriageRecordsOf } from './immersiveTravelGates.js';   // TS7: Immersive Travel's carriages, at the new gates
import { getLocationTerrainTileOrigin } from './terrain/terrainTiles.js';   // TS7: a town's walk shut to its ground

/** Daggerfall's wall pieces (ARCH3D): a tower, a length of wall (25.6 m, 9.6 m thick, its inside its local -z), a gate. */
export const WALL_MODELS = Object.freeze({ tower: 444, wall: 445, gate: 446 });
/** A gate block's name (WALLAA08-11: north, east, south, west). */
export const isGateBlock = (name) => /^WALLAA(08|09|10|11)/i.test(String(name ?? ''));
/** A ground tile's side and a block's, in metres. */
const TILE_M = 6.4, BLOCK_M = 102.4;
/** THE WALL'S MEASURES (its line's and its round's: world/townShape.js WALL_ROUND): a length of wall, in metres; how many
 *  lengths between two towers; the start marker outside a gate, in metres (out, and along - Daggerfall's 15.2 and 3); TS6:
 *  how far a chord may cut in from the line, in metres (the line stands 13.6 m from a house at the least, a length 4.8 m
 *  in from its middle). */
export const TOWN_WALL = Object.freeze({ piece: 25.6, run: 2, marker: Object.freeze([15.2, -3]), sag: 3 });
/** The block of a city's own that carries its wall (its south-west cell) and its index, and the wall's model id - off the
 *  low 20 bits of its map id (Arena's places: 500000 and up). */
export const townWallBlockName = (mapId) => `TESW${((mapId >>> 0) & 0xfffff).toString(36).toUpperCase()}.RMB`;
export const townWallBlockIndex = (mapId) => 1000000 + ((mapId >>> 0) & 0xfffff);
/** AUDIT RELEASE R1-1: where the walls' model ids run - 1,000,000 to 2,048,575, under every other run of the port's own
 *  models (the capitals' 910xxx below it; IC-GRAND's families at 3,000,000 and 3,100,000, world/imperialBlocks.js; URBANIZER's
 *  fabrics from 5,000,000, world/urban/townFabricStand.js). At 3,000,000 a Bay city's wall (43 of the 410, Knightston's
 *  3,013,420 among them) answered for one of the Imperial City's cells: a model registered by its id wins over a family's,
 *  and the pipeline keeps one mesh an id (scenes/dataPipeline.js gpuMeshes). */
export const TOWN_WALL_MODEL_BASE = 1000000;
export const townWallModelId = (mapId) => TOWN_WALL_MODEL_BASE + ((mapId >>> 0) & 0xfffff);

// ---------------------------------------------------------------- the line

/**
 * THE WALL'S LINE round a town's buildings: the edge of its round (world/townShape.js townRound - WALL_ROUND.line out from
 * the nearest building, closed by WALL_ROUND.close, its holes filled) traced on the tile centres (marching squares), the
 * longest round, counter-clockwise (x east, y north), in tiles.
 * @param {Uint8Array} occ a building's tile 1 (townTiles'), `W` x `H`, row-major from the south-west
 * @param {number} W @param {number} H
 * @returns {Array<[number, number]>} the round's points, in tiles (a tile's centre at its index + 0.5); empty with no building
 */
export function wallLine(occ, W, H) {
  if (!occ.some((v) => v)) return [];
  const { level } = townRound(occ, W, H);
  return traceRound((x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : level[y * W + x]), W, H);
}

/** The longest round of a field's level-0 edge over a `W` x `H` grid of tile centres (`field(x, y)`, past 0 inside, read
 *  one tile past the grid each way), counter-clockwise, in tiles. */
export const traceRound = (field, W, H) => longestRound(traceEdges(field, W, H));

/** Marching squares over the tile centres (x - 1 .. W, y - 1 .. H): each cell's piece of the level-0 edge, its points in
 *  tiles, the cut a 1024th of a tile in (a distance is often whole: two crossings on one centre fork the round). Each piece
 *  runs with the inside on its right (clockwise round an island); a saddle's two corners joined where the cell's middle is
 *  inside. */
function traceEdges(field, W, H) {
  const segs = [];
  const f = (x, y) => field(x, y) - 1 / 1024;   // the cut a hair off the grid's own values: no crossing lands on a tile's centre
  const at = (x0, y0, x1, y1) => { const a = f(x0, y0), b = f(x1, y1), t = a / (a - b); return [x0 + (x1 - x0) * t + 0.5, y0 + (y1 - y0) * t + 0.5]; };
  for (let y = -1; y < H; y++) {
    for (let x = -1; x < W; x++) {
      const bl = f(x, y) > 0, br = f(x + 1, y) > 0, tr = f(x + 1, y + 1) > 0, tl = f(x, y + 1) > 0;
      const c = (bl ? 1 : 0) | (br ? 2 : 0) | (tr ? 4 : 0) | (tl ? 8 : 0);
      if (c === 0 || c === 15) continue;
      const S = () => at(x, y, x + 1, y), E = () => at(x + 1, y, x + 1, y + 1), N = () => at(x, y + 1, x + 1, y + 1), Wd = () => at(x, y, x, y + 1);
      const mid = (f(x, y) + f(x + 1, y) + f(x + 1, y + 1) + f(x, y + 1)) / 4 > 0;
      // [from, to]: the inside on the right of each
      const table = {
        1: [[Wd, S]], 2: [[S, E]], 3: [[Wd, E]], 4: [[E, N]], 6: [[S, N]], 7: [[Wd, N]], 8: [[N, Wd]],
        9: [[N, S]], 11: [[N, E]], 12: [[E, Wd]], 13: [[E, S]], 14: [[S, Wd]],
        5: mid ? [[Wd, N], [E, S]] : [[Wd, S], [E, N]], 10: mid ? [[S, Wd], [N, E]] : [[S, E], [N, Wd]],
      };
      for (const [p, q] of table[c]) segs.push([p(), q()]);
    }
  }
  return segs;
}

/** The pieces joined end to end into rounds; the longest, counter-clockwise. */
function longestRound(segs) {
  const key = (p) => `${Math.round(p[0] * 1e4)},${Math.round(p[1] * 1e4)}`;
  const from = new Map();
  segs.forEach((s, i) => from.set(key(s[0]), i));
  const used = new Uint8Array(segs.length);
  let best = [], bestArea = 0;
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    const round = [];
    for (let j = i; j !== undefined && !used[j]; j = from.get(key(segs[j][1]))) { used[j] = 1; round.push(segs[j][0]); }
    const area = signedArea(round);
    if (Math.abs(area) > Math.abs(bestArea)) { best = round; bestArea = area; }
  }
  return bestArea < 0 ? best.reverse() : best;
}
/** A round's signed area (positive counter-clockwise, x east, y north). */
export function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; a += x0 * y1 - x1 * y0; }
  return a / 2;
}

/** A round smoothed (Chaikin's corner cutting, `n` times) - the tile grid's steps worn off. */
export function smoothRound(pts, n = 2) {
  let p = pts;
  for (let k = 0; k < n; k++) {
    const q = [];
    for (let i = 0; i < p.length; i++) {
      const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % p.length];
      q.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25], [x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
    }
    p = q;
  }
  return p;
}

// ---------------------------------------------------------------- the pieces

/** The point a ray from `c` along `dir` first leaves a round, and its place along the round (its edge and the fraction). */
function rayHit(pts, c, dir) {
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const ex = b[0] - a[0], ey = b[1] - a[1], den = dir[0] * ey - dir[1] * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((a[0] - c[0]) * ey - (a[1] - c[1]) * ex) / den, s = ((a[0] - c[0]) * dir[1] - (a[1] - c[1]) * dir[0]) / den;
    if (t > 0 && s >= 0 && s <= 1 && (!best || t > best.t)) best = { t, i, s };
  }
  return best;
}
/** A round re-cut to start at edge `i` fraction `s`: its points from there, the start first. */
function startAt(pts, i, s) {
  const a = pts[i], b = pts[(i + 1) % pts.length], p = [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];
  return [p, ...pts.slice(i + 1), ...pts.slice(0, i + 1)];
}

/**
 * THE WALL'S PIECES on its line (`pts`, in metres, counter-clockwise): a gate of one length where the line meets the
 * bearing of each gate (`gates`, points in metres, from the round's middle `c` - a gate within TOWN_WALL.run + 2 lengths of
 * the one before slid on along the wall to that, one crowding the first slid back, one with no room passed over), and between
 * gates runs of whole lengths (as many as the run holds, near enough) in chords of TOWN_WALL.run, each stretched to its
 * chord; a tower at every chord's end, square to the line's bend. A line with no
 * gate is one run round, from the bearing south. Each piece's centre, its outward normal (its local +z) and its stretch.
 * @param {Array<[number, number]>} pts @param {[number, number]} c @param {Array<[number, number]>} gates
 * @returns {Array<{ model: number, at: [number, number], out: [number, number], stretch: number }>}
 */
export function wallPieces(pts, c, gates, o = {}) {
  const L = o.piece ?? TOWN_WALL.piece, run = o.run ?? TOWN_WALL.run;
  if (pts.length < 3) return [];
  const hits = (gates.length ? gates : [[c[0], c[1] - 1]]).map((g) => rayHit(pts, c, [g[0] - c[0], g[1] - c[1]])).filter(Boolean);
  if (!hits.length) return [];
  hits.sort((a, b) => a.i + a.s - (b.i + b.s));
  const closed = startAt(pts, hits[0].i, hits[0].s);
  closed.push(closed[0]);
  const cum = [0];
  for (let i = 1; i < closed.length; i++) cum.push(cum[i - 1] + Math.hypot(closed[i][0] - closed[i - 1][0], closed[i][1] - closed[i - 1][1]));
  const P = cum[cum.length - 1];
  const pointAt = (d) => {
    const u = ((d % P) + P) % P;
    let j = 0;
    while (j < cum.length - 2 && cum[j + 1] < u) j++;
    const f = (u - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j]);
    return /** @type {[number, number]} */ ([closed[j][0] + (closed[j + 1][0] - closed[j][0]) * f, closed[j][1] + (closed[j + 1][1] - closed[j][1]) * f]);
  };
  // each gate's place along the round (its nearest point to the ray's), in order, too-near ones passed over
  const arcOf = (q) => {
    let best = Infinity, arc = 0;
    for (let j = 0; j < closed.length - 1; j++) {
      const a = closed[j], b = closed[j + 1], dx = b[0] - a[0], dy = b[1] - a[1], ll = dx * dx + dy * dy;
      const t = ll ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / ll)) : 0;
      const dd = Math.hypot(a[0] + dx * t - q[0], a[1] + dy * t - q[1]);
      if (dd < best) { best = dd; arc = cum[j] + t * Math.sqrt(ll); }
    }
    return arc;
  };
  const gap = L * (run + 2), stops = [];
  for (const h of hits) {
    const e = pts[h.i], f = pts[(h.i + 1) % pts.length], q = [e[0] + (f[0] - e[0]) * h.s, e[1] + (f[1] - e[1]) * h.s];
    // a gate crowding the last slid on along the wall, one crowding the first (round the wall) slid back - none where neither has room
    const arc = stops.length ? Math.min(Math.max(arcOf(q), stops[stops.length - 1] + gap), P - gap) : 0;
    if (!stops.length || arc >= stops[stops.length - 1] + gap) stops.push(arc);
  }
  const isGate = gates.length > 0;
  /** @type {Array<{ p: [number, number], gate: boolean, k: number }>} the chords' ends in order round, each with whether the
   *  chord from it is a gate and how many lengths it holds */
  const ends = [];
  stops.forEach((a, i) => {
    const from = isGate ? a + L : a, to = i + 1 < stops.length ? stops[i + 1] : P;
    if (isGate) ends.push({ p: pointAt(a), gate: true, k: 1 });
    // the run's whole lengths, then its chords of `run` of them (the odd ones on the first chords), each end at its share -
    // TS6: a chord that cuts in past TOWN_WALL.sag from the line (a tight bulge of the round: the wall across it stood on a
    // house in 34 of 136 cities, measured) laid a length at a time
    const K = Math.max(1, Math.round((to - from) / L)), m = Math.max(1, Math.round(K / run));
    const share = (done) => from + ((to - from) * done) / K;
    const cutIn = (done, k) => {
      const da = share(done), db = share(done + k), a = pointAt(da), b = pointAt(db), dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
      let worst = 0;
      for (let i = 0; i < closed.length; i++) if (cum[i] > da && cum[i] < db) worst = Math.max(worst, ((closed[i][0] - a[0]) * dy - (closed[i][1] - a[1]) * dx) / len);
      return worst;
    };
    for (let j = 0, done = 0; j < m; j++) {
      const k = Math.floor(K / m) + (j < K % m ? 1 : 0), split = k > 1 && cutIn(done, k) > (o.sag ?? TOWN_WALL.sag);
      for (let s = 0; s < (split ? k : 1); s++) ends.push({ p: pointAt(share(done + s)), gate: false, k: split ? 1 : k });
      done += k;
    }
  });
  const out = [], normals = [];
  ends.forEach((e, i) => {
    const a = e.p, b = ends[(i + 1) % ends.length].p, dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    const ux = dx / (len || 1), uy = dy / (len || 1), k = e.k;
    normals.push([uy, -ux]);
    for (let j = 0; j < k; j++) out.push({ model: e.gate ? WALL_MODELS.gate : WALL_MODELS.wall, at: /** @type {[number, number]} */ ([a[0] + (dx * (j + 0.5)) / k, a[1] + (dy * (j + 0.5)) / k]), out: /** @type {[number, number]} */ ([uy, -ux]), stretch: len / (k * L) });
  });
  ends.forEach((e, i) => {
    const n0 = normals[(i + normals.length - 1) % normals.length], n1 = normals[i], nx = n0[0] + n1[0], ny = n0[1] + n1[1], m = Math.hypot(nx, ny) || 1;
    out.push({ model: WALL_MODELS.tower, at: e.p, out: /** @type {[number, number]} */ ([nx / m, ny / m]), stretch: 1 });
  });
  return out;
}

// ---------------------------------------------------------------- a city's wall

/**
 * A CITY PAST THE BAY'S WALL: its buildings' tiles (world/townShape.js townTiles over each kept block, as its ground reads
 * them - wall, open and carrier cells none), its line round them (wallLine, smoothed, in the town's metres - x east, z north, from its grid's
 * south-west corner), its gates (the bearing of each of its template's gate pieces, `template`'s grid read with `rmbOf`),
 * its pieces (wallPieces) and its start markers (outside each gate, Daggerfall's offset). Null for a city with no building.
 * @param {any} dfLocation the outlined city (outlineTownLocation's) @param {string[]} templateNames its template's grid
 * @param {(name: string) => any} rmbOf a block's RMB half by its name (null where none)
 */
export function townWall(dfLocation, templateNames, rmbOf) {
  const ed = dfLocation?.exterior?.exteriorData;
  if (!ed?.blockNames) return null;
  const { width: w, height: h } = ed, T = SHAPE_TILES_PER_BLOCK, PAD = Math.ceil(WALL_ROUND.line + WALL_ROUND.close) + 2;
  const occ0 = townTiles(w, h, (bx, by) => rmbOf(ed.blockNames[by * w + bx]));
  const W = w * T + 2 * PAD, H = h * T + 2 * PAD, occ = new Uint8Array(W * H);
  for (let y = 0; y < h * T; y++) occ.set(occ0.subarray(y * w * T, (y + 1) * w * T), (y + PAD) * W + PAD);
  const tiles = wallLine(occ, W, H);
  if (tiles.length < 3) return null;
  const pts = smoothRound(tiles).map(([x, y]) => /** @type {[number, number]} */ ([(x - PAD) * TILE_M, (y - PAD) * TILE_M]));
  const c = /** @type {[number, number]} */ ([w * BLOCK_M / 2, h * BLOCK_M / 2]);
  /** @type {Array<[number, number]>} */
  const gates = [];
  /** TS7: each gate's frame - its block, its model's origin and its outward normal, in the town's metres (RMBLayout: the
   *  subrecord at (x, 4096 - z), its model's offset turned with it, a turn of `r` counter-clockwise by r / 2048 of a round) */
  const frames = [];
  templateNames.forEach((name, i) => {
    if (!isGateBlock(name)) return;
    const bx = i % w, by = Math.floor(i / w);
    for (const s of rmbOf(name)?.subRecords ?? []) {
      const o = (s.exterior?.block3dObjectRecords ?? []).find((r) => r.modelIdNum === WALL_MODELS.gate);
      if (!o) continue;
      const sx = bx * BLOCK_M + s.xPos * 0.025, sz = by * BLOCK_M + (4096 - s.zPos) * 0.025;
      gates.push(/** @type {[number, number]} */ ([sx, sz]));
      const f = ((s.yRotation ?? 0) * Math.PI) / 1024, cos = Math.cos(f), sin = Math.sin(f), lx = o.xPos * 0.025, lz = o.zPos * 0.025;
      frames.push({ name, block: [bx * BLOCK_M, by * BLOCK_M], at: [sx + lx * cos - lz * sin, sz + lx * sin + lz * cos], out: [-sin, cos] });
    }
  });
  const pieces = wallPieces(pts, c, gates);
  const [outM, alongM] = TOWN_WALL.marker;
  const markers = pieces.filter((p) => p.model === WALL_MODELS.gate).map((p) => /** @type {[number, number]} */ ([p.at[0] + p.out[0] * outM + p.out[1] * alongM, p.at[1] + p.out[1] * outM - p.out[0] * alongM]));
  return { line: pts, gates, frames, middle: c, pieces, markers };
}

/**
 * TS7: WHAT STANDS AT A GATE - each gate piece's own gate of its template (the one nearest its bearing from the middle,
 * each once) and what that gate block stands about its gate: Daggerfall's own (`classicOf(name)`, the game's block - every
 * client alike: the two bulletin boards inside it) and Immersive Travel's (`extra(name)`, its records on that gate while
 * the mod is loaded: the carriage, the cart, the horses and the driver), each carried from the template gate's frame (its
 * model's origin, its outward normal, the line along it) to the new gate's, a model turned with it - JSON records, the
 * carrier's metres. The gate's start marker is TS4's own (standTownWall). None for a wall with no frames.
 * STOOD CLEAR (`blocked`, townBlockedCells': its wall's cells and its blocks' town-map bytes): a tower stands either side
 * of every gate here, where Daggerfall's gate block has a straight wall - its boards and the mod's carts stood in them
 * (measured: 1,655 of the Bay's 3,280 boards). Each gate's things inside it move further in together, and those outside
 * further out, by the least step (GATE_CLEAR.step) that leaves every one of them clear by its reach.
 * @param {any} wall townWall's @param {((name: string) => any)|null} classicOf @param {(name: string) => any} [extra]
 * @param {?{ cells: Uint8Array, W: number, H: number }} [blocked]
 * @returns {{ models: any[], flats: any[] }}
 */
export function gateFurniture(wall, classicOf, extra = carriageRecordsOf, blocked = null) {
  const models = [], flats = [], frames = wall?.frames ?? [], c = wall?.middle ?? [0, 0];
  const gp = (wall?.pieces ?? []).filter((p) => p.model === WALL_MODELS.gate);
  const bearing = ([x, z]) => Math.atan2(z - c[1], x - c[0]);
  const pairs = [];
  gp.forEach((p, i) => frames.forEach((f, j) => pairs.push([Math.abs(Math.atan2(Math.sin(bearing(p.at) - bearing(f.at)), Math.cos(bearing(p.at) - bearing(f.at)))), i, j])));
  pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const usedP = new Set(), usedF = new Set();
  for (const [, i, j] of pairs) {
    if (usedP.has(i) || usedF.has(j)) continue;
    usedP.add(i); usedF.add(j);
    const p = gp[i], f = frames[j], ut = [f.out[1], -f.out[0]], up = [p.out[1], -p.out[0]];
    const turn = Math.round((Math.atan2(f.out[0] * p.out[1] - f.out[1] * p.out[0], f.out[0] * p.out[0] + f.out[1] * p.out[1]) * 1024) / Math.PI);
    /** a record's place in the template gate's frame: along its line, and out from it (inside below 0) */
    const local = (r) => {
      const dx = f.block[0] + r.XPos * 0.025 - f.at[0], dz = f.block[1] + (r.ZPos + 4096) * 0.025 - f.at[1];
      return /** @type {[number, number]} */ ([dx * ut[0] + dz * ut[1], dx * f.out[0] + dz * f.out[1]]);
    };
    const place = (/** @type {number[]} */ ab) => /** @type {[number, number]} */ ([p.at[0] + ab[0] * up[0] + ab[1] * p.out[0], p.at[1] + ab[0] * up[1] + ab[1] * p.out[1]]);
    const own = classicOf?.(f.name)?.rmbBlock ?? null, more = extra?.(f.name) ?? null;
    const items = [
      ...[...(own?.misc3dObjectRecords ?? []).map(modelRecord), ...(more?.Misc3dObjectRecords ?? [])].map((r) => ({ r, model: true, at: local(r) })),
      ...[...(own?.miscFlatObjectRecords ?? []).map(flatRecord), ...(more?.MiscFlatObjectRecords ?? [])].filter((t) => !(t.TextureArchive === 199 && t.TextureRecord === 10)).map((r) => ({ r, model: false, at: local(r) })),
    ];
    for (const side of [-1, 1]) {
      const group = items.filter((it) => (it.at[1] < 0 ? -1 : 1) === side);
      const clear = (it, da, db) => clearAt(blocked, place([it.at[0] + da, it.at[1] + side * db]), it.model ? GATE_CLEAR.model : GATE_CLEAR.flat);
      let d = 0;
      while (d < GATE_CLEAR.most && !group.every((it) => clear(it, 0, d))) d += GATE_CLEAR.step;
      const together = group.every((it) => clear(it, 0, d));
      for (const it of group) {
        // the group moved together where it can; else each of its own, the nearest clear place on its side (a wall bent at
        // the gate, a house behind it - 2 of the Bay's 3,280 boards)
        const [da, db] = together ? [0, d] : nearestClear((a, b) => clear(it, a, b));
        const [x, z] = place([it.at[0] + da, it.at[1] + side * db]);
        if (it.model) models.push({ ...it.r, ...record(x, z), YRotation: (it.r.YRotation ?? 0) + turn });
        else flats.push({ ...it.r, ...record(x, z) });
      }
    }
  }
  return { models, flats };
}
/** TS7: a classic block's misc model and flat as the carrier's JSON writes them (formats/worldData/worldDataJson.js modelJson,
 *  flatJson - zero scales dropped). */
const modelRecord = (m) => ({
  ModelId: m.modelId ?? String(m.modelIdNum), ModelIdNum: m.modelIdNum, ObjectType: m.objectType ?? 0, XPos: m.xPos, YPos: m.yPos, ZPos: m.zPos,
  ...(m.xScale ? { XScale: m.xScale } : {}), ...(m.yScale ? { YScale: m.yScale } : {}), ...(m.zScale ? { ZScale: m.zScale } : {}),
  XRotation: m.xRotation ?? 0, YRotation: m.yRotation ?? 0, ZRotation: m.zRotation ?? 0,
});
const flatRecord = (f) => ({ Position: f.position ?? 0, XPos: f.xPos, YPos: f.yPos, ZPos: f.zPos, TextureArchive: f.textureArchive, TextureRecord: f.textureRecord, FactionID: f.factionID ?? 0, Flags: f.flags ?? 0 });
/** TS7: how far a thing at a gate keeps off a wall's or a building's cell (a model's reach, a flat's), and the step and the
 *  most it is moved to be clear, in metres. */
export const GATE_CLEAR = Object.freeze({ model: 2.4, flat: 0.8, step: 0.8, most: 16 });
/** TS7: the nearest offset (along, further out on its side) at which `ok` holds - rings of GATE_CLEAR.step out to its
 *  most, never back across the wall; none, where it stood. */
function nearestClear(ok) {
  const { step, most } = GATE_CLEAR;
  for (let r = 0; r <= most; r += step) {
    for (let a = -r; a <= r + 1e-9; a += step) for (const b of [r - Math.abs(a), Math.abs(a) - r + 2 * r]) if (b >= 0 && b <= most && ok(a, b)) return [a, b];
  }
  return [0, 0];
}
/** TS7: whether no blocked cell lies within `reach` of (x, z) - a cell its 1.6 m square, the town's metres. */
function clearAt(blocked, [x, z], reach) {
  if (!blocked) return true;
  const C = BLOCK_M / SHAPE_AUTOMAP_SIDE, { cells, W, H } = blocked;
  for (let gz = Math.floor((z - reach) / C); gz <= Math.floor((z + reach) / C); gz++) {
    for (let gx = Math.floor((x - reach) / C); gx <= Math.floor((x + reach) / C); gx++) {
      if (gx < 0 || gz < 0 || gx >= W || gz >= H) continue;
      const cx = Math.max(gx * C, Math.min(x, (gx + 1) * C)), cz = Math.max(gz * C, Math.min(z, (gz + 1) * C));
      if (cells[gz * W + gx] && Math.hypot(cx - x, cz - z) < reach) return false;
    }
  }
  return true;
}
/** TS7: THE CELLS NOTHING MORE STANDS ON - a wall's (townWallCells) and every town-map byte of the town's blocks (a
 *  building's, a model's, a flat's - Daggerfall's ground flats, 0xfb, aside), `rmbOf(name)` a block's RMB half. Its
 *  rows the walk grid's. @param {any} dfLocation @param {any} wall @param {(name: string) => any} rmbOf */
export function townBlockedCells(dfLocation, wall, rmbOf) {
  const ed = dfLocation.exterior.exteriorData, w = ed.width, h = ed.height, S = SHAPE_AUTOMAP_SIDE, W = w * S;
  const cells = townWallCells(wall, w, h);
  for (let by = 0; by < h; by++) for (let bx = 0; bx < w; bx++) {
    const a = rmbOf(ed.blockNames[by * w + bx])?.fldHeader?.autoMapData;
    if (!a) continue;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (a[y * S + x] && a[y * S + x] !== 0xfb) cells[(by * S + S - 1 - y) * W + bx * S + x] = 1;
  }
  return { cells, W, H: h * S };
}

/** TS8 (2026-10-26, the owner: "Town walls and their curvature expose thin open extruding walls"): DAGGERFALL'S CORNER
 *  TOWER, measured on the freeware (ARCH3D 444: x -8.4..8.4, z -8.35..8.35, 14.45 m tall). It is a corner's: its body a
 *  9.6 m square - the wall's own thickness, where two walls cross - centred at (-2.8, 2.85) of its origin, under a crown
 *  from `crown` up; and off its +x and -z sides two stubs of wall 6.4 m long (y 0..8.05), open at their ends, where a
 *  corner's two lengths meet it. `body` is [x0, x1, z0, z1], `extent` the whole model's [x0, x1, z0, z1]. */
export const CORNER_TOWER = Object.freeze({ body: Object.freeze([-7.6, 2, -1.95, 7.65]), crown: 12.85, extent: Object.freeze([-8.4, 8.4, -8.35, 8.35]) });
const _bends = new WeakMap();
/**
 * TS8: A BEND'S TOWER - the corner tower's body alone, its middle the origin. TS4 stood the whole corner tower at every
 * bend of a line that is no corner (its origin on the line, its +z out): one stub stood 3.55 m into the town past the
 * wall's inner face and one 2.85 m out past its outer face, their ends open, and the body off the line. Here every face
 * under the crown past the body's +x or -z side (the stubs) is left out, and with them the faces on those two sides (they
 * stood only over the wall walk, a door in each - the stubs closed them under it); the two sides are closed with the
 * body's own outer faces (its -x and +z, whole from the ground to the crown) turned a half round about its middle, so a
 * side's stone and its pictures are the tower's own. Kept a model. A model that is not 444's measure (`extent`, to 5 cm -
 * a mod's tower) stands as it is.
 * @param {any} m dfMeshToModel's shape @returns {any} the same shape
 */
export function bendTower(m) {
  if (!m?.positions || !m.indices || !m.subMeshes) return m;
  let made = _bends.get(m);
  if (made) return made;
  const P = m.positions, N = m.normals, U = m.uvs, eps = 0.02;
  const lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  for (let v = 0; v < P.length; v += 3) { lo[0] = Math.min(lo[0], P[v]); hi[0] = Math.max(hi[0], P[v]); lo[1] = Math.min(lo[1], P[v + 2]); hi[1] = Math.max(hi[1], P[v + 2]); }
  const [ex0, ex1, ez0, ez1] = CORNER_TOWER.extent;
  if ([lo[0] - ex0, hi[0] - ex1, lo[1] - ez0, hi[1] - ez1].some((d) => Math.abs(d) > 0.05)) { _bends.set(m, m); return m; }
  const [x0, x1, z0, z1] = CORNER_TOWER.body, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const positions = [], normals = [], uvs = [], subMeshes = [];
  // a vertex at the body's middle - or turned a half round about it (x and z, and the normal's, negated)
  const put = (v, turn) => {
    const s = turn ? -1 : 1;
    positions.push(s * (P[v * 3] - cx), P[v * 3 + 1], s * (P[v * 3 + 2] - cz));
    normals.push(s * N[v * 3], N[v * 3 + 1], s * N[v * 3 + 2]);
    uvs.push(U[v * 2], U[v * 2 + 1]);
  };
  for (const s of m.subMeshes) {
    const startIndex = positions.length / 3;
    let n = 0;
    for (let t = 0; t < s.primitiveCount; t++) {
      const ids = [0, 1, 2].map((k) => m.indices[s.startIndex + t * 3 + k]);
      const mid = (axis) => (P[ids[0] * 3 + axis] + P[ids[1] * 3 + axis] + P[ids[2] * 3 + axis]) / 3;
      const on = (axis, at) => ids.every((v) => Math.abs(P[v * 3 + axis] - at) < eps);
      const under = mid(1) < CORNER_TOWER.crown - eps;
      if (under && (mid(0) > x1 + eps || mid(2) < z0 - eps)) continue;   // a stub
      if (under && (on(0, x1) || on(2, z0))) continue;   // a side a stub joined
      for (const v of ids) put(v, false);
      n++;
      if (under && (on(0, x0) || on(2, z1))) { for (const v of ids) put(v, true); n++; }   // its far side, closed
    }
    if (n) subMeshes.push({ textureArchive: s.textureArchive, textureRecord: s.textureRecord, startIndex, primitiveCount: n });
  }
  const count = positions.length / 3;
  made = { positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs), indices: Uint32Array.from({ length: count }, (_, i) => i), subMeshes };
  _bends.set(m, made);
  return made;
}

/**
 * THE WALL'S MODEL: each piece's classic model (`classicModel(id)`, dfMeshToModel's shape - metres, its inside its local -z)
 * turned so its local +z is the piece's outward normal and its +x along the line, stretched along its length, set at its
 * centre (x east, z north, the carrier's metres) - all of them one model, a submesh a picture (composeArenaModel). TS8: a
 * tower the corner tower's body alone (bendTower).
 * @param {ReturnType<typeof wallPieces>} pieces @param {(id: number) => any} classicModel
 */
export function townWallModel(pieces, classicModel) {
  const parts = [];
  for (const p of pieces) {
    const m = p.model === WALL_MODELS.tower ? bendTower(classicModel(p.model)) : classicModel(p.model);
    if (!m) continue;
    const [wx, wz] = p.out, ux = wz, uz = -wx;   // local +x: u = (w.z, -w.x), so u x up = w (no mirror)
    const n = m.positions.length / 3, positions = new Float32Array(n * 3), normals = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) {
      const lx = m.positions[v * 3] * p.stretch, ly = m.positions[v * 3 + 1], lz = m.positions[v * 3 + 2];
      positions[v * 3] = p.at[0] + lx * ux + lz * wx;
      positions[v * 3 + 1] = ly;
      positions[v * 3 + 2] = p.at[1] + lx * uz + lz * wz;
      const nx = m.normals[v * 3] / p.stretch, ny = m.normals[v * 3 + 1], nz = m.normals[v * 3 + 2], len = Math.hypot(nx, ny, nz) || 1;
      normals[v * 3] = (nx * ux + nz * wx) / len;
      normals[v * 3 + 1] = ny / len;
      normals[v * 3 + 2] = (nx * uz + nz * wz) / len;
    }
    parts.push({ positions, normals, uvs: m.uvs, indices: m.indices, subMeshes: m.subMeshes });
  }
  return composeArenaModel(parts);
}

/** A misc model or a flat at the carrier's metres (x east, z north) on the ground - DFU's record law
 *  (world/rmbLayout.js: x * 0.025, (z + 4096) * 0.025; world/tamrielCapitals.js miscModelAt, startMarkerAt). */
const record = (x, z) => ({ XPos: Math.round(x / 0.025), ZPos: Math.round(z / 0.025) - 4096 });

/** THE CARRIER: the city's own block in its south-west cell - open ground (world/townOutline.js's), its wall's model at
 *  its corner, its start markers; TS7: what stands at its gates (gateFurniture's), after them. */
export function townWallBlockJson(name, modelId, markers, open, furniture = null) {
  const json = open();
  json.Name = name;
  json.RmbBlock.FldHeader.Name = name;
  json.RmbBlock.Misc3dObjectRecords = [{ ModelId: String(modelId), ModelIdNum: modelId, ObjectType: 0, ...record(0, 0), YPos: -4, XRotation: 0, YRotation: 0, ZRotation: 0 }, ...(furniture?.models ?? [])];
  json.RmbBlock.MiscFlatObjectRecords = [...markers.map(([x, z]) => ({ Position: 0, ...record(x, z), YPos: 0, TextureArchive: 199, TextureRecord: 10, FactionID: 0, Flags: 0 })), ...(furniture?.flats ?? [])];
  return json;
}

const _stood = new Set();
/** TS6: each city's wall as standTownWall stood it this session, by its map id (its cells made when first asked); TS7: a
 *  Bay city's made when first read (`of`). */
const _walls = new Map();
/** A wall's blocks: `servedOf(name)` as this client serves them (its line and its gates) and - TS7 - `classicOf(name)` the
 *  game's own (what stands at its gates); a bare function is `servedOf`. */
const ioOf = (io) => (typeof io === 'function' ? { servedOf: io, classicOf: null } : { servedOf: io?.servedOf ?? (() => null), classicOf: io?.classicOf ?? null });
/**
 * TS7: A CITY'S WALL REGISTERED, made when first read (`made` when the caller has it): its carrier block on the door at its
 * index (open ground, the wall's model, its markers and what stands at its gates) and its model, and its cells for the
 * town map and the walkers (townWallCellsOf). The Bay's cities register theirs as they are read (world/townOutline.js
 * wallBayCity), a wall made only when a carrier is first laid out.
 * @param {any} dfLocation @param {string[]} templateNames @param {any} io @param {() => any} open @param {any} [made]
 */
export function registerTownWall(dfLocation, templateNames, io, open, made = undefined) {
  const mapId = (dfLocation?.mapTableData?.mapId ?? 0) >>> 0, name = townWallBlockName(mapId), { servedOf, classicOf } = ioOf(io);
  if (_stood.has(name)) return false;
  _stood.add(name);
  const kept = { wall: made, w: dfLocation.exterior.exteriorData.width, h: dfLocation.exterior.exteriorData.height, cells: null, of: () => null };
  kept.of = () => (kept.wall === undefined ? (kept.wall = townWall(dfLocation, templateNames, (n) => (isWallCarrier(n) ? null : servedOf(n)?.rmbBlock ?? null))) : kept.wall);
  _walls.set(mapId, kept);   // TS6: its town map's and its walkers'
  const modelId = townWallModelId(mapId);
  const rmbOf = (n) => (isWallCarrier(n) ? null : servedOf(n)?.rmbBlock ?? null);
  registerPortBlock(name, () => {
    const wall = kept.of();
    return townWallBlockJson(name, modelId, wall?.markers ?? [], open, wall ? gateFurniture(wall, classicOf, carriageRecordsOf, townBlockedCells(dfLocation, wall, rmbOf)) : null);
  }, townWallBlockIndex(mapId));
  registerCustomModel(modelId, (ctx) => townWallModel(kept.of()?.pieces ?? [], (id) => ctx?.classicModel?.(id) ?? null), () => true, { needs: Object.values(WALL_MODELS) });
  return true;
}
/**
 * A CITY'S WALL STOOD, once a city: its wall (townWall over `templateNames` - its template's grid, for its gates - and the
 * blocks as `io` serves them, as its ground reads them: a wall's carrier none) and its carrier block and model
 * registered (registerTownWall), each made when first read - the model off the player's ARCH3D. `dfLocation`
 * outlineTownLocation's, its south-west cell townWallBlockName; `open()` the open cell's JSON (world/townOutline.js
 * townOutlineBlockJson). Answers its wall, or null (stood before, or no building).
 * @param {any} dfLocation @param {string[]} templateNames @param {any} io @param {() => any} open
 */
export function standTownWall(dfLocation, templateNames, io, open) {
  const mapId = (dfLocation?.mapTableData?.mapId ?? 0) >>> 0;
  if (_stood.has(townWallBlockName(mapId))) return null;
  const wall = townWall(dfLocation, templateNames, (n) => (isWallCarrier(n) ? null : ioOf(io).servedOf(n)?.rmbBlock ?? null));
  if (!wall) return null;
  registerTownWall(dfLocation, templateNames, io, open, wall);
  return wall;
}

// ---------------------------------------------------------------- TS6: the town map's wall and the walkers'

/** TS6: Daggerfall's wall on its town map (WALLAA00-11's town-map byte, measured on the freeware) and each piece's footprint,
 *  in metres - a length's thickness and a tower's side (TS4's measures: 445 9.6 m thick; TS8: a bend's tower the corner
 *  tower's body, 9.6 m square - 16.8 m was the whole of 444 with its stubs, which no bend stands). */
export const WALL_BYTE = 0x18;
const WALL_FOOT = Object.freeze({ thick: 9.6, tower: 9.6 });

/**
 * TS6: THE CELLS A WALL STANDS ON - the town-map cells (64 a block side, 1.6 m) of a grid of `w` x `h` blocks each piece
 * covers, row-major from the south-west (the walk grid's own order: world/city/cityNavigation.js): a length or a gate its
 * stretched length by its thickness, a tower its square, each turned to its line (`out`, its local +z).
 * @param {{ pieces: ReturnType<typeof wallPieces> }} wall @param {number} w @param {number} h
 * @returns {Uint8Array} 1 a cell of the wall's
 */
export function townWallCells(wall, w, h) {
  const S = SHAPE_AUTOMAP_SIDE, C = BLOCK_M / S, W = w * S, H = h * S, out = new Uint8Array(W * H);
  for (const p of wall.pieces) {
    const tower = p.model === WALL_MODELS.tower;
    const hl = (tower ? WALL_FOOT.tower : TOWN_WALL.piece * p.stretch) / 2, ht = (tower ? WALL_FOOT.tower : WALL_FOOT.thick) / 2;
    const [wx, wz] = p.out, ux = wz, uz = -wx, r = Math.hypot(hl, ht);
    const x0 = Math.max(0, Math.floor((p.at[0] - r) / C)), x1 = Math.min(W - 1, Math.floor((p.at[0] + r) / C));
    const y0 = Math.max(0, Math.floor((p.at[1] - r) / C)), y1 = Math.min(H - 1, Math.floor((p.at[1] + r) / C));
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
      const dx = (gx + 0.5) * C - p.at[0], dz = (gy + 0.5) * C - p.at[1];
      if (Math.abs(dx * ux + dz * uz) <= hl && Math.abs(dx * wx + dz * wz) <= ht) out[gy * W + gx] = 1;
    }
  }
  return out;
}

/** TS6: a city's wall's cells (townWallCells) as its wall was registered this session - null for a town with no wall of
 *  its own. Once a city.
 *  @param {any} dfLocation */
export function townWallCellsOf(dfLocation) {
  const kept = _walls.get((dfLocation?.mapTableData?.mapId ?? -1) >>> 0);
  if (!kept || !dfLocation.outline?.walled) return null;
  const wall = kept.of();
  return wall ? (kept.cells ??= townWallCells(wall, kept.w, kept.h)) : null;
}

/** URBANIZER U3 (world/urban/townFabricStand.js fabricEnds): a city's wall's gates as its wall was registered this session -
 *  each gate piece's middle and its outward normal (`at`, `out`: the carrier's metres, the location's - its carrier is the
 *  south-west cell) - or null for a town with no wall of its own. @param {any} dfLocation */
export function townWallGatesOf(dfLocation) {
  const held = _walls.get((dfLocation?.mapTableData?.mapId ?? -1) >>> 0);
  if (!held || !dfLocation.outline?.walled) return null;
  const wall = held.of();
  return wall ? wall.pieces.filter((p) => p.model === WALL_MODELS.gate).map((p) => Object.freeze({ at: p.at, out: p.out })) : null;
}

/**
 * TS6: THE WALL ON A CITY'S TOWN MAP - its blocks (the town map's `[{ x, y, autoMap }]`) each with its wall's cells laid in
 * Daggerfall's wall byte, a copy (the bytes the walk grid carves are the cache's, never touched - ui/exteriorAutomapWindow.js
 * THE COPY LAW); a block the wall crosses none of, and every block where `cells` is null, as it was. Its rows the town
 * map's own (a block's row r the walk grid's row 63 - r of its block).
 * @param {Array<{ x: number, y: number, autoMap?: ?Uint8Array }>} blocks @param {?Uint8Array} cells @param {number} w
 */
export function wallOnTownMap(blocks, cells, w) {
  if (!cells) return blocks;
  const S = SHAPE_AUTOMAP_SIDE, W = w * S;
  return blocks.map((b) => {
    let bytes = null;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (!cells[(b.y * S + S - 1 - y) * W + b.x * S + x]) continue;
      bytes ??= Uint8Array.from(b.autoMap ?? new Uint8Array(S * S));
      bytes[y * S + x] = WALL_BYTE;
    }
    return bytes ? { ...b, autoMap: bytes } : b;
  });
}

/** AUDIT TESA III E1-2: ONE BLOCK'S TOWN-MAP BYTES WITH ITS CITY'S WALL LAID - wallOnTownMap's copy for the block at (bx, by),
 *  else its own bytes (no wall of the city's own, or none of it in this block). A host that carves its walk grid off its
 *  blocks' bytes alone (scenes/exterior.js, the fixed-city bench: CityNavigation.setBlockData shuts every cell not 0)
 *  shuts the wall with them - TS7 opened every Bay city's ring on the door's read, its wall bytes with it.
 *  @param {any} dfLocation @param {number} bx @param {number} by @param {?Uint8Array} autoMap */
export const wallLaidBytes = (dfLocation, bx, by, autoMap) => wallOnTownMap([{ x: bx, y: by, autoMap }], townWallCellsOf(dfLocation), dfLocation?.exterior?.exteriorData?.width ?? 0)[0].autoMap;

/** TS6: and its walkers - no cell of its wall walked, a gate's neither (Daggerfall's gate blocks carve theirs shut).
 *  @param {{ grid: Uint8Array }} nav @param {?Uint8Array} cells */
export function shutTownWall(nav, cells) {
  if (cells) for (let i = 0; i < cells.length; i++) if (cells[i]) nav.grid[i] = 0;
}

/** TS10: a road cell's weight on a town's grid - CityNavigation.GetTileWeight's for a road tile (46, 47, 55: "Roads are
 *  great!", world/city/cityNavigation.js tileWeight - pinned equal), the weight a yard reads as a road. */
export const PATH_WEIGHT = 15;
/**
 * TS10 (2026-10-26, the owner: "Sometimes locations like the horse stable, etc can be placed on pathways"): A TOWN'S
 * PAINTED PATHS ON ITS GRID. A town's grid weighs each cell by its own block's ground tile (CityNavigation.SetRMBData), and
 * a yard keeps off the road cells it reads there - but the roads the terrain painted through the town's ground (an arm
 * of the pixel's road or track across a cell a town past the Bay leaves open - TS3 - or a Bay city's old wall ring, TS7)
 * stand on cells its blocks lay as open land: a Stable, a Wagon Yard or a joinery stood on them (8 of 373 yards over every
 * twelfth city and town past the Bay on a pixel with roads every way, measured). Every open cell whose terrain tile the
 * road painter wrote (`paths`, GRASS-PATH1's mask - the painter alone knows a track's dirt from the land's) is a road of
 * the grid: a yard stands beside it, never on it, and the walkers take it as they take the town's own streets.
 * @param {{width: number, height: number, grid: Uint8Array}} nav @param {Uint8Array} paths 128 x 128, x + y * 128
 * @param {{x: number, y: number}} tilePos the grid's south-west tile (getLocationTerrainTileOrigin)
 */
export function paveOnGrid(nav, paths, tilePos) {
  const D = 128;
  for (let gy = 0; gy < nav.height; gy++) {
    const ty = tilePos.y + (gy >> 2);
    if (ty < 0 || ty >= D) continue;
    for (let gx = 0; gx < nav.width; gx++) {
      const tx = tilePos.x + (gx >> 2), i = gy * nav.width + gx;
      if (tx >= 0 && tx < D && paths[tx + ty * D] && nav.grid[i] >> 4) nav.grid[i] = (PATH_WEIGHT << 4) | (nav.grid[i] & 0xf);
    }
  }
}
/** TS7: A TOWN'S WALK SHUT - its walkers' grid and its yards' ground (world/merchantYards/merchantYardSites.js townGroundOf)
 *  shut past its ground (shutOffGround; `ground` the terrain job's townGround - null, none shut) and on its wall
 *  (shutTownWall); TS10: the paths the terrain painted on its ground its roads (paveOnGrid; `paths` the job's - null,
 *  none). Its `key` says what it reads, for a memo of what was placed on it (scenes/world.js townPlacesFor): a pixel built
 *  again once the roads land places its yards again. @param {any} dfLocation @param {?Uint8Array} ground
 *  @param {?Uint8Array} [paths] */
export const townWalkShut = (dfLocation, ground, paths = null) => {
  const shut = (nav) => {
    const origin = getLocationTerrainTileOrigin(dfLocation);
    if (ground) shutOffGround(nav, ground, origin);
    if (paths) paveOnGrid(nav, paths, origin);
    shutTownWall(nav, townWallCellsOf(dfLocation));
  };
  let h = 0x811c9dc5;   // FNV-1a over the painted tiles' indices
  if (paths) for (let i = 0; i < paths.length; i++) if (paths[i]) h = Math.imul(h ^ i, 0x01000193) >>> 0;
  shut.key = `shut|${ground ? 'ground' : ''}|${paths ? h.toString(36) : ''}`;
  return shut;
};
