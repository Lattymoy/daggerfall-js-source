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
import { townTiles, townRound, isWallCarrier, SHAPE_TILES_PER_BLOCK, WALL_ROUND } from './townShape.js';
import { composeArenaModel } from './arena/arenaModel.js';
import { registerPortBlock } from '../formats/worldData/worldDataReplacement.js';
import { registerCustomModel } from './customModels.js';

/** Daggerfall's wall pieces (ARCH3D): a tower, a length of wall (25.6 m, 9.6 m thick, its inside its local -z), a gate. */
export const WALL_MODELS = Object.freeze({ tower: 444, wall: 445, gate: 446 });
/** A gate block's name (WALLAA08-11: north, east, south, west). */
export const isGateBlock = (name) => /^WALLAA(08|09|10|11)/i.test(String(name ?? ''));
/** A ground tile's side and a block's, in metres. */
const TILE_M = 6.4, BLOCK_M = 102.4;
/** THE WALL'S MEASURES (its line's and its round's: world/townShape.js WALL_ROUND): a length of wall, in metres; how many
 *  lengths between two towers; the start marker outside a gate, in metres (out, and along - Daggerfall's 15.2 and 3). */
export const TOWN_WALL = Object.freeze({ piece: 25.6, run: 2, marker: Object.freeze([15.2, -3]) });
/** The block of a city's own that carries its wall (its south-west cell) and its index, and the wall's model id - off the
 *  low 20 bits of its map id (Arena's places: 500000 and up). */
export const townWallBlockName = (mapId) => `TESW${((mapId >>> 0) & 0xfffff).toString(36).toUpperCase()}.RMB`;
export const townWallBlockIndex = (mapId) => 1000000 + ((mapId >>> 0) & 0xfffff);
export const townWallModelId = (mapId) => 3000000 + ((mapId >>> 0) & 0xfffff);

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
    // the run's whole lengths, then its chords of `run` of them (the odd ones on the first chords), each end at its share
    const K = Math.max(1, Math.round((to - from) / L)), m = Math.max(1, Math.round(K / run));
    for (let j = 0, done = 0; j < m; j++) {
      const k = Math.floor(K / m) + (j < K % m ? 1 : 0);
      ends.push({ p: pointAt(from + ((to - from) * done) / K), gate: false, k });
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
  const gates = [];
  templateNames.forEach((name, i) => {
    if (!isGateBlock(name)) return;
    const bx = i % w, by = Math.floor(i / w);
    for (const s of rmbOf(name)?.subRecords ?? []) {
      if (!(s.exterior?.block3dObjectRecords ?? []).some((o) => o.modelIdNum === WALL_MODELS.gate)) continue;
      gates.push(/** @type {[number, number]} */ ([bx * BLOCK_M + s.xPos * 0.025, by * BLOCK_M + (4096 - s.zPos) * 0.025]));
    }
  });
  const pieces = wallPieces(pts, c, gates);
  const [outM, alongM] = TOWN_WALL.marker;
  const markers = pieces.filter((p) => p.model === WALL_MODELS.gate).map((p) => /** @type {[number, number]} */ ([p.at[0] + p.out[0] * outM + p.out[1] * alongM, p.at[1] + p.out[1] * outM - p.out[0] * alongM]));
  return { line: pts, gates, pieces, markers };
}

/**
 * THE WALL'S MODEL: each piece's classic model (`classicModel(id)`, dfMeshToModel's shape - metres, its inside its local -z)
 * turned so its local +z is the piece's outward normal and its +x along the line, stretched along its length, set at its
 * centre (x east, z north, the carrier's metres) - all of them one model, a submesh a picture (composeArenaModel).
 * @param {ReturnType<typeof wallPieces>} pieces @param {(id: number) => any} classicModel
 */
export function townWallModel(pieces, classicModel) {
  const parts = [];
  for (const p of pieces) {
    const m = classicModel(p.model);
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
 *  its corner, its start markers. */
export function townWallBlockJson(name, modelId, markers, open) {
  const json = open();
  json.Name = name;
  json.RmbBlock.FldHeader.Name = name;
  json.RmbBlock.Misc3dObjectRecords = [{ ModelId: String(modelId), ModelIdNum: modelId, ObjectType: 0, ...record(0, 0), YPos: -4, XRotation: 0, YRotation: 0, ZRotation: 0 }];
  json.RmbBlock.MiscFlatObjectRecords = markers.map(([x, z]) => ({ Position: 0, ...record(x, z), YPos: 0, TextureArchive: 199, TextureRecord: 10, FactionID: 0, Flags: 0 }));
  return json;
}

const _stood = new Set();
/**
 * A CITY'S WALL STOOD, once a city: its wall (townWall over `templateNames` - its template's grid, for its gates - and the
 * blocks as `servedOf(name)` serves them, as its ground reads them: a wall's carrier none) and its carrier block and model
 * registered, each made when first read - the model off the player's ARCH3D. `dfLocation` outlineTownLocation's, its
 * south-west cell townWallBlockName; `open()` the open cell's JSON (world/townOutline.js townOutlineBlockJson). Answers its
 * wall, or null (stood before, or no building).
 * @param {any} dfLocation @param {string[]} templateNames @param {(name: string) => any} servedOf @param {() => any} open
 */
export function standTownWall(dfLocation, templateNames, servedOf, open) {
  const mapId = (dfLocation?.mapTableData?.mapId ?? 0) >>> 0, name = townWallBlockName(mapId);
  if (_stood.has(name)) return null;
  const wall = townWall(dfLocation, templateNames, (n) => (isWallCarrier(n) ? null : servedOf(n)?.rmbBlock ?? null));
  if (!wall) return null;
  _stood.add(name);
  const modelId = townWallModelId(mapId);
  registerPortBlock(name, () => townWallBlockJson(name, modelId, wall.markers, open), townWallBlockIndex(mapId));
  registerCustomModel(modelId, (ctx) => townWallModel(wall.pieces, (id) => ctx?.classicModel?.(id) ?? null), () => true, { needs: Object.values(WALL_MODELS) });
  return wall;
}
