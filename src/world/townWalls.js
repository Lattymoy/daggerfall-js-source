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
import { registerPortBlock, blockFromJson } from '../formats/worldData/worldDataReplacement.js';
import { layoutRmbBlock } from './rmbLayout.js';   // FB1028 YARDS Y1: the carrier as #1184 laid it, for the yards' measures
import { registerCustomModel } from './customModels.js';
import { carriageRecordsOf } from './immersiveTravelGates.js';   // TS7: Immersive Travel's carriages, at the new gates
import { getLocationTerrainTileOrigin } from './terrain/terrainTiles.js';   // TS7: a town's walk shut to its ground
import { reliefOf } from './terrain/capitalRelief.js';   // SOLITUDE-RELIEF: a capital's terraces' works
import { NAV_CELL } from './city/cityNavigation.js';
import { curvesOf, curvePolyline, CURVE_STEPS } from './road/roadCurves.js';   // ROAD-FOLLOW: past the Bay a road's arm is its curve
import { DIR_DELTA } from './road/roadNetwork.js';
import { arenaRoadByte, arenaJoinByte } from './arenaRoads.js';   // ROAD-FOLLOW: the roads past the Bay, and a crossing's join on the Bay
import { inBay } from './tamriel/tamrielFrame.js';
import { ROAD_RECORDS } from './road/roadEdge.js';   // GATE-ROADS: Daggerfall's paving, a town's streets
import { subMeshDoorType, DOOR_TYPE } from './meshReader.js';   // FB1028 DOORS: a wall piece's door faces, by DFU's door law

/** Daggerfall's wall pieces (ARCH3D): a tower, a length of wall (25.6 m, 9.6 m thick, its inside its local -z), a gate. */
export const WALL_MODELS = Object.freeze({ tower: 444, wall: 445, gate: 446 });
/** GATE-ROADS: THE GATE'S OPENING - the gate model's way through is its floor face, x -8.05 to 1.68 m of its own frame
 *  (ARCH3D 446): its middle `along` the model's +x from its origin - a piece's (out[1], -out[0]), so its start marker stands
 *  that side (TOWN_WALL.marker) - and `half` its half width, in metres. */
export const GATE_OPENING = Object.freeze({ along: -3.185, half: 4.865 });
/** A gate piece's opening (GATE_OPENING): its middle and its outward normal, in the piece's metres.
 *  @param {{ at: [number, number], out: [number, number], stretch?: number }} p */
export function gateOpening(p) {
  const s = GATE_OPENING.along * (p.stretch ?? 1);
  return { at: /** @type {[number, number]} */ ([p.at[0] + s * p.out[1], p.at[1] - s * p.out[0]]), out: p.out };
}
/** A gate block's name (WALLAA08-11: north, east, south, west). */
export const isGateBlock = (name) => /^WALLAA(08|09|10|11)/i.test(String(name ?? ''));
/** A ground tile's side and a block's, in metres. */
const TILE_M = 6.4, BLOCK_M = 102.4;
/** THE WALL'S MEASURES (its line's and its round's: world/townShape.js WALL_ROUND): a length of wall, in metres; how many
 *  lengths between two towers; the start marker outside a gate, in metres (out, and along - Daggerfall's 15.2 and 3); TS6:
 *  how far a chord may cut in from the line, in metres (the line stands 13.6 m from a house at the least, a length 4.8 m
 *  in from its middle). */
export const TOWN_WALL = Object.freeze({ piece: 25.6, run: 2, marker: Object.freeze([15.2, -3]), sag: 3 });
/** Half a length's thickness and of a tower's body (ARCH3D 445, 444), in metres. */
const WALL_HALF = 4.8;
/** FB1028 BENDS: how far a tower stands out of its wall's faces, in metres - never in a length's plane, and low enough that
 *  a body sliding along the wall (its 0.35 m radius) rides past it. */
export const TOWER_PROUD = 0.1;
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
/** ROAD-FOLLOW: the point of a round nearest `q`, moved `shift` metres along it (counter-clockwise), as rayHit answers -
 *  its edge and the fraction. */
function lineHit(pts, q, shift = 0) {
  const n = pts.length, cum = [0];
  let near = 0, best = Infinity;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], ll = dx * dx + dy * dy, len = Math.sqrt(ll);
    const t = ll ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / ll)) : 0;
    const d = Math.hypot(a[0] + dx * t - q[0], a[1] + dy * t - q[1]);
    if (d < best) { best = d; near = cum[i] + t * len; }
    cum.push(cum[i] + len);
  }
  const P = cum[n];
  if (!(P > 0)) return null;
  const u = (((near + shift) % P) + P) % P;
  let i = 0;
  while (i < n - 1 && cum[i + 1] < u) i++;
  return { t: 0, i, s: (u - cum[i]) / Math.max(1e-9, cum[i + 1] - cum[i]) };
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
 * chord; a tower at every chord's end, square to the line's bend. A line with no gate is one run round, from the bearing
 * south. Each piece's centre, its outward normal (its local +z), its stretch; FB1028: a tower's `thick`, its body across.
 * @param {Array<[number, number]>} pts @param {[number, number]} c @param {Array<[number, number]>} gates
 * @returns {Array<{ model: number, at: [number, number], out: [number, number], stretch: number, thick?: number }>}
 */
export function wallPieces(pts, c, gates, o = {}) {
  const L = o.piece ?? TOWN_WALL.piece, run = o.run ?? TOWN_WALL.run;
  if (pts.length < 3) return [];
  // ROAD-FOLLOW (`o.onLine`): the gates are points ON the line - where the roads cross it - each gate's opening centred on
  // its own (GATE-ROADS: its length runs from half a length and GATE_OPENING.along before it - the opening lies that far on
  // round from the length's middle), and two gates a length of wall apart at the least
  const onLine = !!o.onLine;
  const hits = (gates.length ? gates : [[c[0], c[1] - 1]]).map((g) => (onLine ? lineHit(pts, g, -L / 2 + GATE_OPENING.along) : rayHit(pts, c, [g[0] - c[0], g[1] - c[1]]))).filter(Boolean);
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
  const gap = onLine ? 2 * L : L * (run + 2), stops = [];
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
    // FB1028 BENDS: its body across the wall wide enough to hold its two lengths' mitred ends, and TOWER_PROUD more
    const half = Math.max(0.5, (nx * n1[0] + ny * n1[1]) / m), thick = (WALL_HALF / half + TOWER_PROUD) / WALL_HALF;
    out.push({ model: WALL_MODELS.tower, at: e.p, out: /** @type {[number, number]} */ ([nx / m, ny / m]), stretch: 1, thick });
  });
  return out;
}

// ---------------------------------------------------------------- a city's wall

/**
 * A CITY PAST THE BAY'S WALL: its buildings' tiles (world/townShape.js townTiles over each kept block, as its ground reads
 * them - wall, open and carrier cells none), its line round them (wallLine, smoothed, in the town's metres - x east, z north, from its grid's
 * south-west corner), its gates (the bearing of each of its template's gate pieces, `template`'s grid read with `rmbOf`),
 * its pieces (wallPieces) and its start markers (outside each gate, Daggerfall's offset). Null for a city with no building.
 * ROAD-FOLLOW: `paths` - its pixel's road and track bytes and whether they are drawn as curves (townWallPathsReader's) -
 * stands a gate where each road or track the terrain paints in to the town crosses the line (roadGatePoints), and the
 * template's bearings only where none does; with none handed (a host that paints no roads, the fixed-city bench) the
 * template's, as before.
 * @param {any} dfLocation the outlined city (outlineTownLocation's) @param {string[]} templateNames its template's grid
 * @param {(name: string) => any} rmbOf a block's RMB half by its name (null where none)
 * @param {?{ roads: number, tracks: number, curved: boolean }} [paths]
 */
export function townWall(dfLocation, templateNames, rmbOf, paths = null) {
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
  const roads = paths ? roadGatePoints(pts, getLocationTerrainTileOrigin(dfLocation), paths) : [];   // ROAD-FOLLOW
  // GATE-ROADS: each gate moved along the wall from its road's crossing to where it opens onto one of the town's streets
  const blockAt = (bx, by) => rmbOf(ed.blockNames[by * w + bx]);
  const town = roads.length ? { W: w * T, H: h * T, houses: townHouses(w, h, blockAt), streets: townStreets(w, h, blockAt) } : null;
  const onStreets = town ? gatesOnStreets(pts, roads, town) : [];
  const streetWays = town ? streetGates(pts, town, onStreets) : [];   // FB1028 ROADS: and a gate where a street of the town's runs into the wall
  const ways = [...onStreets, ...streetWays];
  const pieces = roads.length ? wallPieces(pts, c, ways, { onLine: true }) : wallPieces(pts, c, gates);
  // FB1028 YARDS (the owner: every yard where #1184 stood it): the pieces as #1184 stood them - no street's gate, no tower grown
  const was = streetWays.length ? wallPieces(pts, c, onStreets, { onLine: true }) : pieces, yardPieces = was.map((p) => ({ ...p, thick: 1 }));
  return { line: pts, gates, frames, middle: c, pieces, markers: gateMarkers(pieces), roads, ways, streetWays, yardPieces };
}
/** A wall's start markers: outside each gate, Daggerfall's offset (TOWN_WALL.marker). @param {any[]} pieces */
const gateMarkers = (pieces) => {
  const [outM, alongM] = TOWN_WALL.marker;
  return pieces.filter((p) => p.model === WALL_MODELS.gate).map((p) => /** @type {[number, number]} */ ([p.at[0] + p.out[0] * outM + p.out[1] * alongM, p.at[1] + p.out[1] * outM - p.out[0] * alongM]));
};

/**
 * FB1028 ROADS (the owner's staff: "a cobbled road running straight into a blank stretch of the wall"): WHERE THE TOWN'S
 * OWN STREETS RUN INTO ITS WALL. The line stands WALL_ROUND.line from the nearest house, and a street Daggerfall laid out
 * to its ring's gate runs on past the houses into it. Each run of the line over the town's paving (`town.streets`) whose
 * middle is GATE_ARMS_MERGE or more along the line from every gate (`ways`) and every run taken before is a gate's point -
 * its opening centred on it (wallPieces' `onLine`). A run nearer a gate is left: two gates stand two lengths apart at least.
 * @param {Array<[number, number]>} pts @param {{ W: number, H: number, streets: Uint8Array }} town @param {Array<[number, number]>} ways
 * @returns {Array<[number, number]>} */
export function streetGates(pts, town, ways) {
  const n = pts.length, cum = [0], STEP = 0.8;
  for (let i = 0; i < n; i++) cum.push(cum[i] + Math.hypot(pts[(i + 1) % n][0] - pts[i][0], pts[(i + 1) % n][1] - pts[i][1]));
  const P = cum[n];
  if (!(P > 0)) return [];
  const at = (u) => {
    let lo = 0, hi = n - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (cum[m] <= u) lo = m; else hi = m - 1; }
    const a = pts[lo], b = pts[(lo + 1) % n], f = (u - cum[lo]) / Math.max(1e-9, cum[lo + 1] - cum[lo]);
    return /** @type {[number, number]} */ ([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  };
  const paved = (u) => { const [x, z] = at(u), tx = Math.floor(x / TILE_M), ty = Math.floor(z / TILE_M); return tx >= 0 && ty >= 0 && tx < town.W && ty < town.H && !!town.streets[ty * town.W + tx]; };
  const arcOf = (q) => { let best = Infinity, arc = 0; for (let u = 0; u < P; u += STEP) { const p = at(u), d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < best) { best = d; arc = u; } } return arc; };
  const taken = ways.map(arcOf), out = [];
  // the runs, from a sample off the paving (so none is split at the line's start)
  let s0 = 0;
  while (s0 < P && paved(s0)) s0 += STEP;
  for (let k = 0, from = -1; k * STEP <= P; k++) {
    const u = s0 + k * STEP, on = k * STEP < P && paved(u % P);
    if (on && from < 0) from = u;
    if (on || from < 0) continue;
    const mid = (from + u - STEP) / 2;
    from = -1;
    if (taken.some((a) => Math.abs(((a - mid + P / 2) % P + P) % P - P / 2) < GATE_ARMS_MERGE)) continue;
    taken.push(mid % P);
    out.push(at(mid % P));
  }
  return out;
}

// ---------------------------------------------------------------- GATE-ROADS: a gate opens onto a street

/** GATE-ROADS: how far along its wall a gate may move from its road's crossing (`reach`, metres), the way in it looks down
 *  from its opening's middle (`half` its half width - a cart's, inside the opening, so a lane one tile wide is a street;
 *  `depth` how far in), and how much of that way must be the town's paving (`paved`) before any house - a gate on a street,
 *  never at a row of houses. */
export const GATE_WAY = Object.freeze({ reach: 3 * TOWN_WALL.piece, half: 2, depth: 48, paved: 2 * TILE_M });

/** A town's streets - the tiles its blocks pave with Daggerfall's road records (ROAD_RECORDS), (w*16) x (h*16), row-major
 *  from the south-west as townTiles' (a block's ground tile (tx, 15 - ty)). `rmbAt(bx, by)` a block's RMB half, or null.
 *  @param {number} w @param {number} h @param {(bx: number, by: number) => any} rmbAt @returns {Uint8Array} */
export function townStreets(w, h, rmbAt) {
  const T = SHAPE_TILES_PER_BLOCK, W = w * T, out = new Uint8Array(W * h * T);
  for (let by = 0; by < h; by++) for (let bx = 0; bx < w; bx++) {
    const gt = rmbAt(bx, by)?.fldHeader?.groundData?.groundTiles;
    if (!gt) continue;
    for (let ty = 0; ty < T; ty++) for (let tx = 0; tx < T; tx++) if (ROAD_RECORDS.includes(gt[tx]?.[T - 1 - ty]?.textureRecord)) out[(by * T + ty) * W + bx * T + tx] = 1;
  }
  return out;
}

/** A town's houses on its town map's cells (1.6 m, 64 a block side): a byte not 0 - a building's or a wall's, Daggerfall's
 *  ground flats (0xfb) aside - (w*64) x (h*64), row-major from the south-west (townBlockedCells' frame).
 *  @param {number} w @param {number} h @param {(bx: number, by: number) => any} rmbAt @returns {Uint8Array} */
export function townHouses(w, h, rmbAt) {
  const S = SHAPE_AUTOMAP_SIDE, W = w * S, out = new Uint8Array(W * h * S);
  for (let by = 0; by < h; by++) for (let bx = 0; bx < w; bx++) {
    const a = rmbAt(bx, by)?.fldHeader?.autoMapData;
    if (a) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (a[y * S + x] && a[y * S + x] !== 0xfb) out[(by * S + S - 1 - y) * W + bx * S + x] = 1;
  }
  return out;
}

/** Whether the way straight in from `p` (the town's metres) along `n` runs onto a street: GATE_WAY.paved of paving under its
 *  middle before any house under its width. `town`: its `houses` (townHouses' cells) and `streets` (townStreets' tiles),
 *  `W` x `H` tiles. */
export function opensOntoStreet(p, n, town) {
  const { W, H, houses, streets } = town, C = BLOCK_M / SHAPE_AUTOMAP_SIDE, CW = W * (TILE_M / C), CH = H * (TILE_M / C);
  const at = (x, z) => { const tx = Math.floor(x / TILE_M), ty = Math.floor(z / TILE_M); return tx >= 0 && ty >= 0 && tx < W && ty < H ? ty * W + tx : -1; };
  const house = (x, z) => { const cx = Math.floor(x / C), cy = Math.floor(z / C); return cx >= 0 && cy >= 0 && cx < CW && cy < CH && houses[cy * CW + cx] === 1; };
  const STEP = 0.8, half = Math.round(GATE_WAY.half / STEP), need = Math.round(GATE_WAY.paved / STEP);   // whole steps: no sum drifts
  for (let k = 0, paved = 0; k * STEP <= GATE_WAY.depth; k++) {
    const d = k * STEP;
    for (let j = -half; j <= half; j++) if (house(p[0] + n[0] * d - n[1] * j * STEP, p[1] + n[1] * d + n[0] * j * STEP)) return false;
    const i = at(p[0] + n[0] * d, p[1] + n[1] * d);
    if (i >= 0 && streets[i] && ++paved >= need) return true;
  }
  return false;
}

/**
 * GATE-ROADS: EACH ROAD'S GATE WHERE IT OPENS ONTO A STREET - its crossing (roadGatePoints') moved along the line `pts`
 * (counter-clockwise, the town's metres) to the nearest point within GATE_WAY.reach whose gate, as wallPieces stands it
 * there (its length's chord, its opening on it and facing in - gateOpening), opens onto one (opensOntoStreet); a crossing
 * with none near kept, two that come to one street one gate (the first). Its road on is the terrain's (road/gateRoads.js).
 * @param {Array<[number, number]>} pts @param {Array<[number, number]>} crossings
 * @param {{ W: number, H: number, houses: Uint8Array, streets: Uint8Array }} town townHouses' and townStreets', `W` x `H` tiles
 * @returns {Array<[number, number]>} */
export function gatesOnStreets(pts, crossings, town) {
  const n = pts.length, cum = [0];
  for (let i = 0; i < n; i++) cum.push(cum[i] + Math.hypot(pts[(i + 1) % n][0] - pts[i][0], pts[(i + 1) % n][1] - pts[i][1]));
  const P = cum[n];
  const at = (u) => {
    u = ((u % P) + P) % P;
    let i = 0;
    while (i < n - 1 && cum[i + 1] < u) i++;
    const a = pts[i], b = pts[(i + 1) % n], len = Math.max(1e-9, cum[i + 1] - cum[i]), f = (u - cum[i]) / len;
    return { p: /** @type {[number, number]} */ ([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]), n: /** @type {[number, number]} */ ([-(b[1] - a[1]) / len, (b[0] - a[0]) / len]) };
  };
  const arcOf = (q) => {
    let best = Infinity, arc = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], ll = dx * dx + dy * dy;
      const t = ll ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / ll)) : 0;
      const d = Math.hypot(a[0] + dx * t - q[0], a[1] + dy * t - q[1]);
      if (d < best) { best = d; arc = cum[i] + t * Math.sqrt(ll); }
    }
    return arc;
  };
  // the gate wallPieces stands with its opening at arc u: its length the chord from half a length and the opening's offset
  // before u, its opening on that chord (gateOpening) and facing in off it
  const L = TOWN_WALL.piece;
  const gateAt = (u) => {
    const a = at(u - L / 2 + GATE_OPENING.along).p, b = at(u + L / 2 + GATE_OPENING.along).p, len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const m = gateOpening({ at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], out: [d[1], -d[0]], stretch: len / L });
    return { p: m.at, n: /** @type {[number, number]} */ ([-d[1], d[0]]) };
  };
  const out = [];
  for (const q of crossings) {
    const a0 = arcOf(q);
    let way = null;
    for (let s = 0; s <= GATE_WAY.reach && !way; s += 0.8) for (const sg of s ? [1, -1] : [1]) { const c = gateAt(a0 + sg * s); if (!way && opensOntoStreet(c.p, c.n, town)) way = { q: at(a0 + sg * s).p, a: a0 + sg * s }; }
    way ??= { q, a: a0 };
    if (!out.some((o) => Math.abs(((o.a - way.a + P / 2) % P + P) % P - P / 2) < GATE_ARMS_MERGE)) out.push(way);
  }
  return out.map((o) => o.q);
}

// ---------------------------------------------------------------- ROAD-FOLLOW: the gates where the roads come in

/** ROAD-FOLLOW: two roads that cross a wall's line nearer than this (metres along it) come in through one gate - the
 *  nearest two gates may stand (wallPieces' `onLine`: a gate's length and a length of wall between). */
export const GATE_ARMS_MERGE = 2 * TOWN_WALL.piece;
/** A compass bit's edge point in its pixel's tile frame (x east, y north) - roadCurves.js's own EXIT. */
const ARM_EXIT = new Map(DIR_DELTA.map(([bit, dx, dy]) => [bit, [64 + 64 * dx, 64 - 64 * dy]]));
/**
 * ROAD-FOLLOW: THE LINES A PIXEL'S PAINTED ARM `bit` RUNS IN ON from its edge, in its tile frame (x east, y north, 0 to 128),
 * each its edge's point first: on the Bay Basic Roads' straight band to the middle (roadPainter.js PaintPath), past the
 * Bay (`curved`) each curve VOYAGER2 draws from that edge (world/road/roadCurves.js curvesOf: to a bit it pairs with, or
 * straight in to the middle).
 * @param {number} bits @param {number} bit @param {boolean} curved @returns {Array<Array<[number, number]>>}
 */
export function armLines(bits, bit, curved) {
  const e = ARM_EXIT.get(bit);
  if (!e || !(bits & bit)) return [];
  if (!curved) return [[/** @type {[number, number]} */ ([e[0], e[1]]), [64, 64]]];
  const out = [];
  for (const q of curvesOf(bits).curves) {
    const from = q[0] === e[0] && q[1] === e[1], to = q[4] === e[0] && q[5] === e[1];
    if (!from && !to) continue;
    const p = curvePolyline(q), line = [];
    for (let k = 0; k <= CURVE_STEPS; k++) line.push(/** @type {[number, number]} */ ([p[2 * k], p[2 * k + 1]]));
    out.push(from ? line : line.reverse());
  }
  return out;
}
/** Where a line of runs `poly` first crosses a closed round `ring` (both in metres), walked from its first point; null. */
function firstCrossing(poly, ring) {
  for (let k = 0; k + 1 < poly.length; k++) {
    const [ax, ay] = poly[k], [bx, by] = poly[k + 1], dx = bx - ax, dy = by - ay;
    let best = null;
    for (let i = 0; i < ring.length; i++) {
      const [cx, cy] = ring[i], [ex, ey] = ring[(i + 1) % ring.length], fx = ex - cx, fy = ey - cy, den = dx * fy - dy * fx;
      if (Math.abs(den) < 1e-12) continue;
      const t = ((cx - ax) * fy - (cy - ay) * fx) / den, u = ((cx - ax) * dy - (cy - ay) * dx) / den;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && (!best || t < best.t)) best = { t, q: /** @type {[number, number]} */ ([ax + dx * t, ay + dy * t]) };
    }
    if (best) return best.q;
  }
  return null;
}
/**
 * ROAD-FOLLOW: WHERE THE ROADS COME IN - each road's and each track's arm the terrain paints on the city's pixel
 * (`paths`: the pixel's bytes, `curved` past the Bay), walked in from its edge to where it first crosses the wall's line
 * `pts` (the town's metres, its grid's south-west corner at the pixel's tile `origin`): one point on the line an arm, and
 * arms crossing nearer than GATE_ARMS_MERGE along it one, at their middle. An arm that never reaches the line (it passes
 * the town by) none.
 * @param {Array<[number, number]>} pts @param {{ x: number, y: number }} origin
 * @param {{ roads: number, tracks: number, curved: boolean }} paths @returns {Array<[number, number]>}
 */
export function roadGatePoints(pts, origin, paths) {
  const hits = [];
  for (const kind of /** @type {const} */ (['roads', 'tracks'])) {
    const bits = paths[kind] | 0;
    for (const [bit] of DIR_DELTA) {
      for (const arm of armLines(bits, bit, !!paths.curved)) {
        const q = firstCrossing(arm.map(([tx, ty]) => /** @type {[number, number]} */ ([(tx - origin.x) * TILE_M, (ty - origin.y) * TILE_M])), pts);
        if (q) hits.push(q);
      }
    }
  }
  if (hits.length < 2) return hits;
  // in order round the line, and each run of crossings nearer than GATE_ARMS_MERGE to the last one gate at its middle
  const n = pts.length, cum = [0];
  for (let i = 0; i < n; i++) cum.push(cum[i] + Math.hypot(pts[(i + 1) % n][0] - pts[i][0], pts[(i + 1) % n][1] - pts[i][1]));
  const P = cum[n], arcOf = (q) => {
    let best = Infinity, arc = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], ll = dx * dx + dy * dy;
      const t = ll ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / ll)) : 0;
      const d = Math.hypot(a[0] + dx * t - q[0], a[1] + dy * t - q[1]);
      if (d < best) { best = d; arc = cum[i] + t * Math.sqrt(ll); }
    }
    return arc;
  };
  const at = hits.map((q) => ({ q, a: arcOf(q) })).sort((x, y) => x.a - y.a);
  const groups = [];
  for (const h of at) { const g = groups.at(-1); if (g && h.a - g.at(-1).a < GATE_ARMS_MERGE) g.push(h); else groups.push([h]); }
  if (groups.length > 1 && groups[0][0].a + P - groups.at(-1).at(-1).a < GATE_ARMS_MERGE) groups[0].unshift(...groups.pop());   // round past the line's start
  return groups.map((g) => /** @type {[number, number]} */ (g.length === 1 ? g[0].q : [g.reduce((s, h) => s + h.q[0], 0) / g.length, g.reduce((s, h) => s + h.q[1], 0) / g.length]));
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
  // AUDIT FB1028 B2: a road's gate takes its template gate's things first, a street's gate (streetGates) what is left
  const street = (i) => (wall?.streetWays ?? []).some((q) => Math.hypot(q[0] - gp[i].at[0], q[1] - gp[i].at[1]) < TOWN_WALL.piece / 2) ? 1 : 0;
  pairs.sort((a, b) => street(a[1]) - street(b[1]) || a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
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

/** WALL-FLICKER (FB1028): how far past a bend tower's side a face running along that side is cut away, in metres - past
 *  the depth buffer's step at 400 m (near 0.2 m, 24 bits). */
export const TOWER_CLEAR = 0.05;
/** The part of a convex polygon where `f` is 0 or more, its cut's corners interpolated (each corner [x, y, z, nx, ny, nz,
 *  u, v]). */
function cutTo(poly, f) {
  const out = [], d = poly.map(f);
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length, a = poly[i], b = poly[j], fa = d[i], fb = d[j];
    if (fa >= 0) out.push(a);
    if ((fa > 0 && fb < 0) || (fa < 0 && fb > 0)) {
      const t = fa / (fa - fb), m = new Array(a.length);
      for (let k = 0; k < a.length; k++) m[k] = a[k] + (b[k] - a[k]) * t;
      out.push(m);
    }
  }
  return out;
}
/** A point's place in a tower's frame: along its line (its local +x) and out. */
const alongOf = ({ at, out }, x, z) => (x - at[0]) * out[1] - (z - at[1]) * out[0];
const outOf = ({ at, out }, x, z) => (x - at[0]) * out[0] + (z - at[1]) * out[1];
/** A convex polygon's parts outside a box of a tower's frame (`a` along, `o` out, each [from, to]) under its crown - each
 *  side's outside kept and the rest cut by the next: convex polygons. */
function outsideBox(poly, tw, [a0, a1], [o0, o1]) {
  const a = (v) => alongOf(tw, v[0], v[2]), o = (v) => outOf(tw, v[0], v[2]);
  const sides = [(v) => a(v) - a1, (v) => a0 - a(v), (v) => o(v) - o1, (v) => o0 - o(v), (v) => v[1] - CORNER_TOWER.crown];
  // wholly past one side: as it was; within them all: none
  let within = true;
  for (const f of sides) {
    let past = true;
    for (const v of poly) { const d = f(v); if (d < 0) past = false; if (d > 0) within = false; }
    if (past) return [poly];
  }
  if (within) return [];
  const kept = [];
  let rest = poly;
  for (const f of sides) {
    const outside = cutTo(rest, f);
    if (outside.length > 2) kept.push(outside);
    rest = cutTo(rest, (v) => -f(v));
    if (rest.length < 3) break;
  }
  return kept;
}
/**
 * WALL-FLICKER: A LENGTH OR A GATE CUT CLEAR OF THE BEND TOWERS (`towers`, their pieces) - its model's parts (the carrier's
 * metres) in a tower's body left out, a face along a side cut TOWER_CLEAR past it, a level face mitred at the tower's middle.
 * Its end stands in the body (TS8): its faces lay in the tower's where the line runs straight, and its walk on the next
 * one's at a sharp bend, both drawn there. A part no tower reaches is handed back as it was.
 * @param {{ positions: Float32Array, normals: Float32Array, uvs: ArrayLike<number>, indices: ArrayLike<number>, subMeshes: any[] }} part
 * @param {Array<{ at: [number, number], out: [number, number], thick?: number }>} towers
 */
export function clearOfTowers(part, towers) {
  const P = part.positions, N = part.normals, U = part.uvs, half = (CORNER_TOWER.body[1] - CORNER_TOWER.body[0]) / 2;
  // FB1028: a bend's tower grown across its wall (`thick`) - its body that far out of the line
  const across = (tw) => half * (tw.thick ?? 1), T = Math.max(1, ...towers.map((tw) => tw.thick ?? 1)), r = 2 * Math.SQRT2 * half * T;
  const corner = (i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2], N[i * 3], N[i * 3 + 1], N[i * 3 + 2], U[i * 2], U[i * 2 + 1]];
  let mx = 0, mz = 0, x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let v = 0; v < P.length; v += 3) {
    mx += P[v] / (P.length / 3); mz += P[v + 2] / (P.length / 3);
    x0 = Math.min(x0, P[v]); x1 = Math.max(x1, P[v]); z0 = Math.min(z0, P[v + 2]); z1 = Math.max(z1, P[v + 2]);
  }
  towers = towers.filter((tw) => tw.at[0] + r > x0 && tw.at[0] - r < x1 && tw.at[1] + r > z0 && tw.at[1] - r < z1);   // those in its reach
  if (!towers.length) return part;
  /** its parts outside one tower: its body (a face along a side TOWER_CLEAR past it), then a level face's on the far side of
   *  its middle (the next piece's walk lies there, as level) */
  const clear = (q, tw) => {
    const ca = Math.abs(q[0][3] * tw.out[1] - q[0][5] * tw.out[0]) >= Math.SQRT1_2 ? TOWER_CLEAR : 0, co = Math.abs(q[0][3] * tw.out[0] + q[0][5] * tw.out[1]) >= Math.SQRT1_2 ? TOWER_CLEAR : 0;
    const body = outsideBox(q, tw, [-half - ca, half + ca], [-across(tw) - co, across(tw) + co]);
    if (Math.abs(q[0][4]) < Math.SQRT1_2) return body;
    return body.flatMap((k) => outsideBox(k, tw, alongOf(tw, mx, mz) < 0 ? [0, 2 * half] : [-2 * half, 0], [-2 * across(tw), 2 * across(tw)]));
  };
  // a corner of its own kept once, as it was; a cut's corner added
  const positions = [], normals = [], uvs = [], indices = [], subMeshes = [], own = new Int32Array(P.length / 3).fill(-1);
  const put = (v) => { positions.push(v[0], v[1], v[2]); normals.push(v[3], v[4], v[5]); uvs.push(v[6], v[7]); return positions.length / 3 - 1; };
  const ownAt = (i) => (own[i] >= 0 ? own[i] : (own[i] = put(corner(i))));
  const rBody = Math.SQRT2 * (half * T + TOWER_CLEAR), near = [];
  let cut = false;
  for (const s of part.subMeshes) {
    const startIndex = indices.length;
    for (let t = 0; t < s.primitiveCount; t++) {
      // the towers whose body (or, for a level face, its far side) its box meets
      const i0 = part.indices[s.startIndex + t * 3], i1 = part.indices[s.startIndex + t * 3 + 1], i2 = part.indices[s.startIndex + t * 3 + 2];
      const rr = Math.abs(N[i0 * 3 + 1]) >= Math.SQRT1_2 ? r : rBody;
      near.length = 0;
      for (const tw of towers) {
        // its corners in the tower's frame: kept whole where they all lie past one side of the boxes it is cut by
        let a0 = Infinity, a1 = -Infinity, o0 = Infinity, o1 = -Infinity;
        for (const i of [i0, i1, i2]) { const a = alongOf(tw, P[i * 3], P[i * 3 + 2]), o = outOf(tw, P[i * 3], P[i * 3 + 2]); a0 = Math.min(a0, a); a1 = Math.max(a1, a); o0 = Math.min(o0, o); o1 = Math.max(o1, o); }
        const reach = rr === r ? 2 * half : half + TOWER_CLEAR, reachOut = rr === r ? 2 * across(tw) : across(tw) + TOWER_CLEAR;
        if (a0 < reach && a1 > -reach && o0 < reachOut && o1 > -reachOut) near.push(tw);
      }
      const ids = [i0, i1, i2];
      if (!near.length) { indices.push(ownAt(i0), ownAt(i1), ownAt(i2)); continue; }
      const tri = ids.map(corner), polys = near.reduce((ps, tw) => ps.flatMap((q) => clear(q, tw)), [tri]);
      cut = true;
      for (const q of polys) {
        const at = q.map((v) => (tri.includes(v) ? ownAt(ids[tri.indexOf(v)]) : put(v)));
        for (let k = 1; k + 1 < q.length; k++) {
          // a sliver under a tenth of a millimetre across (a face on a cut's plane, as the corners' floats stand it) left out
          const [a, b, c] = [q[0], q[k], q[k + 1]], e = [0, 1, 2].map((i) => b[i] - a[i]), g = [0, 1, 2].map((i) => c[i] - a[i]);
          const twice = Math.hypot(e[1] * g[2] - e[2] * g[1], e[2] * g[0] - e[0] * g[2], e[0] * g[1] - e[1] * g[0]);
          if (twice >= 1e-4 * Math.max(Math.hypot(...e), Math.hypot(...g), Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2]))) indices.push(at[0], at[k], at[k + 1]);
        }
      }
    }
    if (indices.length > startIndex) subMeshes.push({ ...s, startIndex, primitiveCount: (indices.length - startIndex) / 3 });
  }
  if (!cut) return part;
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs), indices: Uint32Array.from(indices), subMeshes };
}

/**
 * THE WALL'S MODEL: each piece's classic model (`classicModel(id)`, dfMeshToModel's shape - metres, its inside its local -z)
 * turned so its local +z is the piece's outward normal and its +x along the line, stretched along its length, set at its
 * centre (x east, z north, the carrier's metres) - all of them one model, a submesh a picture (composeArenaModel). TS8: a
 * tower the corner tower's body alone (bendTower). FB1028: no door (wallDoorless); a tower grown across by `thick`; a
 * length or a gate cut on its towers' middle lines (mitreEnds) and clear of their bodies (WALL-FLICKER, clearOfTowers).
 * @param {ReturnType<typeof wallPieces>} pieces @param {(id: number) => any} classicModel
 */
export function townWallModel(pieces, classicModel) {
  const steps = townWallModelSteps(pieces, classicModel);
  let r = steps.next();
  while (!r.done) r = steps.next();
  return r.value;
}
/** WALL-FLICKER: how many pieces of a wall are made between two breaths (the cut is several times the pieces' own work). */
export const WALL_PIECES_A_BREATH = 16;
/** The wall's model made a breath at a time (`breathe()` awaited every WALL_PIECES_A_BREATH pieces) - the model door's
 *  `buildSliced` (world/customModels.js customModelBuilt), as the town's fabric is. */
export async function townWallModelSliced(pieces, classicModel, breathe) {
  const steps = townWallModelSteps(pieces, classicModel);
  let r = steps.next();
  while (!r.done) { await breathe(); r = steps.next(); }
  return r.value;
}
function* townWallModelSteps(pieces, classicModel) {
  const parts = [], towers = pieces.filter((p) => p.model === WALL_MODELS.tower);
  const corner = classicModel(WALL_MODELS.tower), bodies = corner && bendTower(corner) !== corner ? towers : [];   // a mod's tower none
  let made = 0;
  for (const p of pieces) {
    if (++made % WALL_PIECES_A_BREATH === 0) yield;
    const tower = p.model === WALL_MODELS.tower, m = wallDoorless(tower ? bendTower(classicModel(p.model)) : classicModel(p.model));
    if (!m) continue;
    const [wx, wz] = p.out, ux = wz, uz = -wx, th = tower ? p.thick ?? 1 : 1;   // local +x: u = (w.z, -w.x), so u x up = w (no mirror)
    const n = m.positions.length / 3, positions = new Float32Array(n * 3), normals = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) {
      const lx = m.positions[v * 3] * p.stretch, ly = m.positions[v * 3 + 1], lz = m.positions[v * 3 + 2] * th;
      positions[v * 3] = p.at[0] + lx * ux + lz * wx;
      positions[v * 3 + 1] = ly;
      positions[v * 3 + 2] = p.at[1] + lx * uz + lz * wz;
      const nx = m.normals[v * 3] / p.stretch, ny = m.normals[v * 3 + 1], nz = m.normals[v * 3 + 2] / th, len = Math.hypot(nx, ny, nz) || 1;
      normals[v * 3] = (nx * ux + nz * wx) / len;
      normals[v * 3 + 1] = ny / len;
      normals[v * 3 + 2] = (nx * uz + nz * wz) / len;
    }
    const part = { positions, normals, uvs: m.uvs, indices: m.indices, subMeshes: m.subMeshes };
    parts.push(tower ? part : clearOfTowers(mitreEnds(part, p, towers), bodies));
  }
  return composeArenaModel(parts);
}

/** FB1028 BENDS: the planes a length or a gate is cut on - each tower its ends stand in, on the tower's middle line across
 *  the wall (its own `out`), the piece's side kept: two lengths meeting at a bend meet on one plane, inside the tower's
 *  body, and neither runs on through the other or out of the tower's faces. @param {any} p @param {any[]} towers */
export function mitrePlanes(p, towers) {
  const hl = (TOWN_WALL.piece * p.stretch) / 2, u = [p.out[1], -p.out[0]], planes = [];
  for (const s of [-1, 1]) {
    const e = [p.at[0] + s * hl * u[0], p.at[1] + s * hl * u[1]];
    const t = towers.find((q) => Math.hypot(q.at[0] - e[0], q.at[1] - e[1]) < 0.01);
    if (!t) continue;
    const n = [t.out[1], -t.out[0]], k = Math.sign((p.at[0] - t.at[0]) * n[0] + (p.at[1] - t.at[1]) * n[1]) || 1;
    planes.push({ at: t.at, n: [k * n[0], k * n[1]] });
  }
  return planes;
}
/** FB1028 BENDS: a placed part (townWallModel's) cut on its piece's mitre planes - a triangle across a plane cut on it, its
 *  normals and UVs carried along the cut; one wholly past a plane gone. A part with no plane as it is. */
function mitreEnds(part, p, towers) {
  const planes = mitrePlanes(p, towers);
  if (!planes.length) return part;
  const { positions: P, normals: N, uvs: U, indices: I } = part, n0 = P.length / 3, more = [], index = [], subMeshes = [];
  const side = (q, pl) => (q[0] - pl.at[0]) * pl.n[0] + (q[2] - pl.at[1]) * pl.n[1];
  const kept = new Uint8Array(n0);
  for (let v = 0; v < n0; v++) kept[v] = planes.every((pl) => side([P[v * 3], 0, P[v * 3 + 2]], pl) >= 0) ? 1 : 0;
  // a corner of a cut triangle: its eight values, kept as a new vertex (its index past the part's own)
  const vert = (v) => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2], N[v * 3], N[v * 3 + 1], N[v * 3 + 2], U[v * 2], U[v * 2 + 1]];
  const add = (q) => { more.push(q); return n0 + more.length - 1; };
  for (const s of part.subMeshes) {
    const startIndex = index.length;
    for (let t = 0; t < s.primitiveCount; t++) {
      const a = I[s.startIndex + t * 3], b = I[s.startIndex + t * 3 + 1], c = I[s.startIndex + t * 3 + 2];
      if (kept[a] && kept[b] && kept[c]) { index.push(a, b, c); continue; }   // the most of them: whole on the piece's side
      let poly = [vert(a), vert(b), vert(c)];
      for (const pl of planes) {
        const cut = [];
        poly.forEach((q, k) => {
          const r = poly[(k + 1) % poly.length], dq = side(q, pl), dr = side(r, pl);
          if (dq >= 0) cut.push(q);
          if ((dq >= 0) !== (dr >= 0)) cut.push(q.map((x, j) => x + ((r[j] - x) * dq) / (dq - dr)));
        });
        poly = cut;
      }
      for (let k = 1; k + 1 < poly.length; k++) index.push(add(poly[0]), add(poly[k]), add(poly[k + 1]));
    }
    if (index.length > startIndex) subMeshes.push({ textureArchive: s.textureArchive, textureRecord: s.textureRecord, startIndex, primitiveCount: (index.length - startIndex) / 3 });
  }
  const n = n0 + more.length, positions = new Float32Array(n * 3), normals = new Float32Array(n * 3), uvs = new Float32Array(n * 2);
  positions.set(P); normals.set(N); uvs.set(U);
  more.forEach((q, k) => { positions.set(q.slice(0, 3), (n0 + k) * 3); normals.set(q.slice(3, 6), (n0 + k) * 3); uvs.set(q.slice(6, 8), (n0 + k) * 2); });
  return { positions, normals, uvs, indices: Uint32Array.from(index), subMeshes };
}

const _doorless = new WeakMap();
/**
 * FB1028 DOORS: A LENGTH OR A GATE WITH NO DOOR. Daggerfall's wall doors (445's one, 446's two, on the wall's inside at
 * ground level) are a Town23 building's, opening into the ring block's interior; a wall on its outline is one model of
 * the town's own and opens into none, and at a bend its lengths' doors stood in the towers. Each door triangle is laid in
 * the face it is cut from: the picture and UV law of a coplanar triangle of the model's that shares a corner with it.
 * A model with no door is itself. @param {any} m dfMeshToModel's shape @returns {any}
 */
export function wallDoorless(m) {
  if (!m?.positions || !m.indices || !m.subMeshes) return m;
  let made = _doorless.get(m);
  if (made) return made;
  const isDoor = (s) => subMeshDoorType(s.textureArchive, s.textureRecord) !== DOOR_TYPE.NONE;
  if (!m.subMeshes.some(isDoor)) { _doorless.set(m, m); return m; }
  const P = m.positions, N = m.normals, U = m.uvs, at = (v) => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
  const row = (v, uv) => [...at(v), N[v * 3], N[v * 3 + 1], N[v * 3 + 2], ...uv];
  const tris = m.subMeshes.flatMap((s) => Array.from({ length: s.primitiveCount }, (_, t) => ({ s, ids: [0, 1, 2].map((k) => m.indices[s.startIndex + t * 3 + k]) })));
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const planeOf = (ids) => {
    const [a, b, c] = ids.map(at), e = sub(b, a), f = sub(c, a), n = [e[1] * f[2] - e[2] * f[1], e[2] * f[0] - e[0] * f[2], e[0] * f[1] - e[1] * f[0]], l = Math.hypot(...n) || 1;
    return { n: n.map((x) => x / l), d: dot(n, a) / l };
  };
  const byKey = new Map(), key = (s) => `${s.textureArchive}/${s.textureRecord}`;
  for (const t of tris) {
    if (isDoor(t.s)) continue;
    if (!byKey.has(key(t.s))) byKey.set(key(t.s), { s: t.s, rows: [] });
    byKey.get(key(t.s)).rows.push(t.ids.map((v) => row(v, [U[v * 2], U[v * 2 + 1]])));
  }
  for (const t of tris.filter((q) => isDoor(q.s))) {
    const pl = planeOf(t.ids), corners = t.ids.map(at);
    const coplanar = (q) => { const o = planeOf(q.ids); return dot(o.n, pl.n) > 0.999 && Math.abs(o.d - pl.d) < 0.01; };
    const face = tris.find((q) => !isDoor(q.s) && coplanar(q) && q.ids.some((v) => corners.some((c) => Math.hypot(...sub(at(v), c)) < 1e-3)));
    if (!face) continue;   // no face of its own to lay it in: left out
    const [q0, q1, q2] = face.ids.map(at), e1 = sub(q1, q0), e2 = sub(q2, q0), [i0, i1, i2] = face.ids;
    const a11 = dot(e1, e1), a12 = dot(e1, e2), a22 = dot(e2, e2), det = a11 * a22 - a12 * a12 || 1;
    const uvAt = (p) => {
      const r = sub(p, q0), b1 = dot(r, e1), b2 = dot(r, e2), s = (b1 * a22 - b2 * a12) / det, w = (b2 * a11 - b1 * a12) / det;
      return [0, 1].map((j) => U[i0 * 2 + j] + s * (U[i1 * 2 + j] - U[i0 * 2 + j]) + w * (U[i2 * 2 + j] - U[i0 * 2 + j]));
    };
    byKey.get(key(face.s)).rows.push(t.ids.map((v) => row(v, uvAt(at(v)))));
  }
  const pos = [], nrm = [], uv = [], subMeshes = [];
  for (const { s, rows } of byKey.values()) {
    subMeshes.push({ textureArchive: s.textureArchive, textureRecord: s.textureRecord, startIndex: pos.length / 3, primitiveCount: rows.length });
    for (const q of rows.flat()) { pos.push(q[0], q[1], q[2]); nrm.push(q[3], q[4], q[5]); uv.push(q[6], q[7]); }
  }
  made = { ...m, positions: new Float32Array(pos), normals: new Float32Array(nrm), uvs: new Float32Array(uv), indices: Uint32Array.from({ length: pos.length / 3 }, (_, i) => i), subMeshes, doors: [] };
  _doorless.set(m, made);
  return made;
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
  // ROAD-FOLLOW: a wall still waiting for its pixel's roads (modelId null) stands nothing yet - the carrier open ground, and
  // provisional: the door builds it again at its next read (formats/worldData/worldDataReplacement.js portBlock)
  if (modelId == null) { json.Provisional = true; json.RmbBlock.Misc3dObjectRecords = []; json.RmbBlock.MiscFlatObjectRecords = []; return json; }
  json.RmbBlock.Misc3dObjectRecords = [{ ModelId: String(modelId), ModelIdNum: modelId, ObjectType: 0, ...record(0, 0), YPos: -4, XRotation: 0, YRotation: 0, ZRotation: 0 }, ...(furniture?.models ?? [])];
  json.RmbBlock.MiscFlatObjectRecords = [...markers.map(([x, z]) => ({ Position: 0, ...record(x, z), YPos: 0, TextureArchive: 199, TextureRecord: 10, FactionID: 0, Flags: 0 })), ...(furniture?.flats ?? [])];
  return json;
}

const _stood = new Set();
/** TS6: each city's wall as standTownWall stood it this session, by its map id (its cells made when first asked); TS7: a
 *  Bay city's made when first read (`of`). */
const _walls = new Map();

// ---------------------------------------------------------------- ROAD-FOLLOW: a wall made when its roads are known

/** ROAD-FOLLOW: the reader of a city pixel's painted roads the walls' gates are stood on - `(px, py)` answers the pixel's
 *  road and track bytes and whether the terrain draws them as curves, or null while they are not known yet (the network
 *  or its region still to land); none set (the fixed-city bench, a test) - the template's gates, as before. */
let _paths = null;
/** @param {?((px: number, py: number) => ?{ roads: number, tracks: number, curved: boolean })} reader */
export function setTownWallPaths(reader) { _paths = typeof reader === 'function' ? reader : null; }
/** A location's map pixel (its map row's longitude and latitude - MapsFile's law, a clone's past the Bay too). */
const townPixel = (dfLocation) => {
  const t = dfLocation?.mapTableData;
  return t ? { x: Math.trunc(t.longitude / 128), y: 499 - Math.trunc(t.latitude / 128) } : null;
};
/** Its pixel's roads by the reader: undefined with no reader, null while not known. */
const townPaths = (dfLocation) => {
  if (!_paths) return undefined;
  const at = townPixel(dfLocation);
  return at ? _paths(at.x, at.y) : undefined;
};
/**
 * ROAD-FOLLOW: THE HOST'S READER of a city pixel's roads (setTownWallPaths) - the roads the terrain paints there: on the
 * Bay the network's bytes (`bay()`: the host's terrainGen.roads(), Basic Roads' or the port's own - null until it lands,
 * the main thread's copy landing before any pixel painted with it answers) and a crossing's join (TESA5); past the Bay the
 * layer's (world/arenaRoads.js) once every region that may lay a road on the pixel has landed (`landedIn`, the roads
 * host's), drawn as curves (VOYAGER2).
 * @param {{ bay: () => any, landedIn?: ?((x0: number, y0: number, x1: number, y1: number) => boolean), byte?: typeof arenaRoadByte, join?: typeof arenaJoinByte }} o
 */
export function townWallPathsReader({ bay, landedIn = null, byte = arenaRoadByte, join = arenaJoinByte }) {
  return (px, py) => {
    if (inBay(px, py)) {
      const net = bay();
      if (!net) return null;
      const i = py * 1000 + px;
      return { roads: (net.roads?.[i] ?? 0) | join(px, py), tracks: net.tracks?.[i] ?? 0, curved: false };
    }
    if (!landedIn || !landedIn(px, py, px + 1, py + 1)) return null;
    return { roads: byte('roads', px, py), tracks: byte('tracks', px, py), curved: true };
  };
}
/** ROAD-FOLLOW: whether a city's wall still waits for its pixel's roads (none made yet, none known). @param {any} dfLocation */
export function townWallWaits(dfLocation) {
  const kept = _walls.get((dfLocation?.mapTableData?.mapId ?? -1) >>> 0);
  return !!kept && kept.wall === undefined && townPaths(dfLocation) === null;
}
/** ROAD-FOLLOW: whether pixel (px, py) stood its city's carrier while its wall waited for its roads, and they are known
 *  now - its pixel is to be built again (scenes/tamrielSweepsHost.js arenaRoadsStale, as a region lands); once. */
export function townWallReadyAt(px, py) {
  const kept = _waiting.get(`${px},${py}`);
  if (!kept || townPaths(kept.dfLocation) === null) return false;
  _waiting.delete(`${px},${py}`);
  return true;
}
/** The walls whose carrier was laid while they waited, by their pixel. */
const _waiting = new Map();
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
  /** @type {any} */
  const kept = { wall: made, w: dfLocation.exterior.exteriorData.width, h: dfLocation.exterior.exteriorData.height, cells: null, of: () => null, dfLocation };
  const modelId = townWallModelId(mapId);
  const rmbOf = (n) => (isWallCarrier(n) ? null : servedOf(n)?.rmbBlock ?? null);
  // the model registered when the wall is made - never one built off a wall still waiting (its mesh is kept by its id)
  const model = () => registerCustomModel(modelId, (ctx) => townWallModel(kept.wall?.pieces ?? [], (id) => ctx?.classicModel?.(id) ?? null), () => true, {
    needs: Object.values(WALL_MODELS),
    buildSliced: (ctx, breathe) => townWallModelSliced(kept.wall?.pieces ?? [], (id) => ctx?.classicModel?.(id) ?? null, breathe),   // WALL-FLICKER: a breath at a time
  });
  // ROAD-FOLLOW: made when first read with its pixel's roads known (its gates where they come in - townWall's `paths`);
  // while they are not, none made and nothing kept, and its pixel is built again when they land (`_waiting`)
  kept.of = () => {
    if (kept.wall !== undefined) return kept.wall;
    const paths = townPaths(dfLocation);
    if (paths === null) return null;
    kept.wall = townWall(dfLocation, templateNames, rmbOf, paths ?? null);
    model();
    return kept.wall;
  };
  if (made !== undefined) model();
  // FB1028 YARDS Y1: the carrier as #1184 laid it - its gates' things stood clear of that wall (yardPieces), no street's
  // gate - or null where it lays them as today's does. The yards' measures alone read it (townWallYardLayout).
  kept.yardCarrier = () => {
    const wall = kept.of();
    if (!wall?.yardPieces) return null;
    if (kept.yardBlock !== undefined) return kept.yardBlock;
    const was = { ...wall, pieces: wall.yardPieces, streetWays: [] }, markers = gateMarkers(was.pieces);
    const then = gateFurniture(was, classicOf, carriageRecordsOf, townBlockedCells(dfLocation, was, rmbOf));
    const now = gateFurniture(wall, classicOf, carriageRecordsOf, townBlockedCells(dfLocation, wall, rmbOf));
    const same = JSON.stringify([then, markers]) === JSON.stringify([now, wall.markers]);
    return (kept.yardBlock = same ? null : blockFromJson(townWallBlockJson(name, modelId, markers, open, then), townWallBlockIndex(mapId)));
  };
  _walls.set(mapId, kept);   // TS6: its town map's and its walkers'
  // ROAD-FOLLOW: a carrier laid while its wall waits is provisional, and its pixel is owed a build once its roads land
  // (`_waiting`, townWallReadyAt); the carrier laid with its wall pays that debt
  const at = townPixel(dfLocation), key = at ? `${at.x},${at.y}` : null;
  registerPortBlock(name, () => {
    const wall = kept.of();
    if (wall === null && kept.wall === undefined) { if (key) _waiting.set(key, kept); return townWallBlockJson(name, null, [], open); }
    if (key && _waiting.get(key) === kept) _waiting.delete(key);
    return townWallBlockJson(name, modelId, wall?.markers ?? [], open, wall ? gateFurniture(wall, classicOf, carriageRecordsOf, townBlockedCells(dfLocation, wall, rmbOf)) : null);
  }, townWallBlockIndex(mapId));
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
  // ROAD-FOLLOW: its gates where its pixel's roads come in - registered to be made when they are known, if they are not yet
  const paths = townPaths(dfLocation);
  if (paths === null) { registerTownWall(dfLocation, templateNames, io, open); return null; }
  const wall = townWall(dfLocation, templateNames, (n) => (isWallCarrier(n) ? null : ioOf(io).servedOf(n)?.rmbBlock ?? null), paths ?? null);
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
 * stretched length by its thickness, a tower its square, each turned to its line (`out`, its local +z); WALL-FLICKER: each
 * grown `grow` metres every way.
 * @param {{ pieces: ReturnType<typeof wallPieces> }} wall @param {number} w @param {number} h @param {number} [grow]
 * @returns {Uint8Array} 1 a cell of the wall's
 */
export function townWallCells(wall, w, h, grow = 0) {
  const S = SHAPE_AUTOMAP_SIDE, C = BLOCK_M / S, W = w * S, H = h * S, out = new Uint8Array(W * H);
  for (const p of wall.pieces) {
    const tower = p.model === WALL_MODELS.tower;
    const hl = (tower ? WALL_FOOT.tower : TOWN_WALL.piece * p.stretch) / 2, ht = (tower ? WALL_FOOT.tower * (p.thick ?? 1) : WALL_FOOT.thick) / 2;   // FB1028: a bend's tower grown across
    const [wx, wz] = p.out, ux = wz, uz = -wx, r = Math.hypot(hl, ht);
    const x0 = Math.max(0, Math.floor((p.at[0] - r - 2 * grow) / C)), x1 = Math.min(W - 1, Math.floor((p.at[0] + r + 2 * grow) / C));
    const y0 = Math.max(0, Math.floor((p.at[1] - r - 2 * grow) / C)), y1 = Math.min(H - 1, Math.floor((p.at[1] + r + 2 * grow) / C));
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
      const dx = (gx + 0.5) * C - p.at[0], dz = (gy + 0.5) * C - p.at[1];
      if (Math.abs(dx * ux + dz * uz) <= hl + grow && Math.abs(dx * wx + dz * wz) <= ht + grow) out[gy * W + gx] = 1;
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
/** FB1028 YARDS: the cells of a city's wall as #1184 stood it (townWall's `yardPieces`) - its yards' ground. @param {any} dfLocation */
export function townWallYardCellsOf(dfLocation) {
  const cells = townWallCellsOf(dfLocation), held = cells ? _walls.get((dfLocation.mapTableData.mapId ?? -1) >>> 0) : null, wall = held?.of();
  return wall?.yardPieces ? (held.yardCells ??= townWallCells({ pieces: wall.yardPieces }, held.w, held.h)) : cells;
}

/** FB1028 YARDS Y1 (the owner: every yard where #1184 stood it): a laid-out town (layoutLocation's) with its wall's
 *  carrier as #1184 laid it (registerTownWall's yardCarrier) and today's layout as `now` - yardMeasuresSteps measures
 *  both, the yards' ground the first. `yl` itself where the two lay the same. @param {any} yl @param {any} dfLocation */
export function townWallYardLayout(yl, dfLocation) {
  const mapId = (dfLocation?.mapTableData?.mapId ?? -1) >>> 0, held = _walls.get(mapId);
  const dfBlock = held && dfLocation.outline?.walled && yl?.blocks ? held.yardCarrier?.() : null;
  if (!dfBlock) return yl;
  const name = townWallBlockName(mapId).toUpperCase();
  const blocks = yl.blocks.map((b) => (String(b.blockName ?? '').toUpperCase() === name ? { ...b, dfBlock, layout: layoutRmbBlock(dfBlock, { enhanced: true, windmills: true }) } : b));
  return { ...yl, blocks, now: yl };
}

/** PORT-SHIPS (systems/naval/harbourKeep.js): a city's wall as it was registered this session - townWall's (its line, its
 *  pieces: the location's metres from its grid's south-west corner) - or null for a town with no wall of its own. */
export function townWallOf(dfLocation) {
  const held = _walls.get((dfLocation?.mapTableData?.mapId ?? -1) >>> 0);
  return held && dfLocation.outline?.walled ? held.of() : null;
}

/** URBANIZER U3 (world/urban/townFabricStand.js fabricEnds): a city's wall's gates as its wall was registered this session -
 *  each gate's opening's middle (GATE-ROADS: gateOpening) and its outward normal (`at`, `out`: the carrier's metres, the
 *  location's - its carrier is the south-west cell) - or null for a town with no wall of its own. @param {any} dfLocation */
export function townWallGatesOf(dfLocation) {
  const held = _walls.get((dfLocation?.mapTableData?.mapId ?? -1) >>> 0);
  if (!held || !dfLocation.outline?.walled) return null;
  const wall = held.of();
  return wall ? wall.pieces.filter((p) => p.model === WALL_MODELS.gate).map((p) => Object.freeze(gateOpening(p))) : null;
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
/** SOLITUDE-RELIEF: a capital on its relief's walk grid shut where its works stand (world/terrain/capitalRelief.js
 *  CAPITAL_RELIEFS' `walkShut`) - the grid's cell (gx, gy) at the pixel's metres from its south-west, the relief's anchor
 *  metres from its north-west (its location the whole pixel). */
export function shutRelief(nav, relief) {
  if (!relief.walkShut) return;
  for (let gy = 0; gy < nav.height; gy++) {
    for (let gx = 0; gx < nav.width; gx++) {
      if (relief.walkShut(relief.x0 + (gx + 0.5) * NAV_CELL, relief.z0 + relief.side - (gy + 0.5) * NAV_CELL)) nav.grid[gy * nav.width + gx] = 0;
    }
  }
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
 *  again once the roads land places its yards again. FB1028 YARDS: `yards` shuts the wall as #1184 stood it
 *  (townWallYardCellsOf). @param {any} dfLocation @param {?Uint8Array} ground @param {?Uint8Array} [paths] @param {boolean} [yards] */
/** FB1028 YARDS: the yards' shut (#1184's, `was`) carrying the town's shut as it stands now (`now` - keptSitesSteps'
 *  ground); its key both. @param {any} was @param {any} now */
export const yardWalkShut = (was, now, dfLocation = null) => {
  const f = (nav) => was(nav);
  // AUDIT FB1028 B5: and the cells the wall gained since #1184 (a tower grown, a street's gate) - a kept yard's pad may
  // touch them, never its own ground (keptSitesSteps)
  const gained = () => { const a = townWallCellsOf(dfLocation), b = townWallYardCellsOf(dfLocation); return a && b && a !== b ? a.map((v, i) => (v && !b[i] ? 1 : 0)) : null; };
  const nowF = Object.assign((nav) => now(nav), { key: now?.key, gained: dfLocation ? gained : () => null });
  Object.defineProperty(f, 'now', { value: now ? nowF : now });
  Object.defineProperty(f, 'yardLayout', { value: (/** @type {any} */ yl) => (dfLocation ? townWallYardLayout(yl, dfLocation) : yl) });   // FB1028 YARDS Y1
  Object.defineProperty(f, 'key', { get: () => `${was.key}|now ${now?.key}` });
  return f;
};
export const townWalkShut = (dfLocation, ground, paths = null, yards = false) => {
  const relief = reliefOf(dfLocation);
  const shut = (nav) => {
    const origin = getLocationTerrainTileOrigin(dfLocation);
    if (ground) shutOffGround(nav, ground, origin);
    if (paths) paveOnGrid(nav, paths, origin);
    shutTownWall(nav, yards ? townWallYardCellsOf(dfLocation) : townWallCellsOf(dfLocation));
    if (relief) shutRelief(nav, relief);
  };
  let h = 0x811c9dc5;   // FNV-1a over the painted tiles' indices
  if (paths) for (let i = 0; i < paths.length; i++) if (paths[i]) h = Math.imul(h ^ i, 0x01000193) >>> 0;
  shut.key = `shut|${ground ? 'ground' : ''}|${paths ? h.toString(36) : ''}${yards ? '|yards' : ''}`;
  return shut;
};
