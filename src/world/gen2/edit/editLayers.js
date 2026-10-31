// WG2 THE EDITOR'S MODEL (bible/03-World/World-2-Canon.md, "Editing"): a designer's changes as data, never written
// into the bake - named layers of operations (brushes on the ground, biome paint, roads, settlements, a building moved
// or removed), applied in order over the bake by `editedSampler`. The ground's changes are kept as patches filed by
// 16-pixel tile, so an edit costs what it touches. Every operation says the rectangle it moves, and the stages it
// makes stale downstream (stageGraph.js staleAfter) are the ones the editor bakes again.
import { worldPixelKey } from '../../worldWide/worldGrid.js';
import { smoothstep, fbm, seedOf } from '../exact.js';
import { staleAfter } from '../stageGraph.js';
import { PIXEL_M } from '../regionSampler.js';
import { nearCourse, ROAD_SHOULDER_M } from '../riverLaw.js';

export const TILE_PX = 16;
/** The operations and the stage each changes. */
export const OP_STAGE = Object.freeze({ raise: 'erosion', lower: 'erosion', smooth: 'erosion', flatten: 'erosion', noise: 'erosion', river: 'erosion', biome: 'biome', material: 'biome', road: 'settlements', settlement: 'settlements', building: 'settlements', exclude: 'suitability' });
const BRUSHES = new Set(['raise', 'lower', 'smooth', 'flatten', 'noise']);
const sq = (v) => v * v;

/** @typedef {{ kind: string, x?: number, y?: number, r?: number, strength?: number, falloff?: string, level?: number, biome?: number, pts?: number[][], width?: number, spec?: any, id?: string, at?: any, remove?: boolean, rect?: any }} Op */
/** @typedef {{ name: string, visible: boolean, locked: boolean, ops: Op[] }} Layer */
/** @typedef {{ format: 'wg2-edit', region: string, base: string, revision: number, layers: Layer[] }} EditDoc */

/** A new document over a bake. @param {string} region @param {string} basePrint @returns {EditDoc} */
export const newDoc = (region, basePrint) => Object.freeze({ format: 'wg2-edit', region, base: basePrint, revision: 0, layers: Object.freeze([layer('Base edits')]) });
/** @param {string} name @returns {Layer} */
export const layer = (name) => Object.freeze({ name, visible: true, locked: false, ops: Object.freeze([]) });

/** An operation's problems, as words. @param {any} op */
export function opProblems(op) {
  const out = [];
  if (!op || !OP_STAGE[op.kind]) return ['kind'];
  if (BRUSHES.has(op.kind) || op.kind === 'biome' || op.kind === 'material') {
    if (![op.x, op.y].every(Number.isFinite)) out.push('at');
    if (!(op.r > 0 && op.r <= 4000)) out.push('radius');
    if (BRUSHES.has(op.kind) && op.kind !== 'flatten' && !(op.strength > 0 && op.strength <= 500)) out.push('strength');
    if (op.kind === 'flatten' && !Number.isFinite(op.level)) out.push('level');
    if (op.falloff && !['smooth', 'linear', 'flat'].includes(op.falloff)) out.push('falloff');
  }
  if ((op.kind === 'road' || op.kind === 'river') && !(Array.isArray(op.pts) && op.pts.length >= 2 && op.pts.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])))) out.push('course');
  if (op.kind === 'road' && !(op.width > 0 && op.width <= 30)) out.push('width');
  if (op.kind === 'river' && !(op.width > 0 && op.width <= 200 && op.depth > 0 && op.depth <= 30)) out.push('width or depth');
  if (op.kind === 'settlement' && !(op.spec && typeof op.spec.id === 'string')) out.push('settlement');
  if (op.kind === 'building' && typeof op.id !== 'string') out.push('building');
  return out;
}

/** The world-pixel rectangle an operation moves. @param {Op} op */
export function opRect(op) {
  if (op.x !== undefined && op.r !== undefined) { const r = op.r / PIXEL_M; return { x: Math.floor(op.x - r), y: Math.floor(op.y - r), w: Math.ceil(2 * r) + 2, h: Math.ceil(2 * r) + 2 }; }
  const pts = op.pts ?? (op.at ? [[op.at.x, op.at.y]] : op.spec ? [[op.spec.x, op.spec.y]] : op.rect ? [[op.rect.x, op.rect.y], [op.rect.x + op.rect.w, op.rect.y + op.rect.h]] : []);
  if (!pts.length) return { x: 0, y: 0, w: 0, h: 0 };
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), m = op.kind === 'settlement' ? 1 : 0.2;
  const x = Math.floor(Math.min(...xs) - m), y = Math.floor(Math.min(...ys) - m);
  return { x, y, w: Math.ceil(Math.max(...xs) + m) - x + 1, h: Math.ceil(Math.max(...ys) + m) - y + 1 };
}

/** A copy of the document with an operation added to a layer (a locked layer refuses it). @param {EditDoc} doc @param {number} li @param {Op} op */
export function addOp(doc, li, op) {
  const L = doc.layers[li];
  if (!L || L.locked) throw new Error(`layer ${li} is locked or missing`);
  const bad = opProblems(op);
  if (bad.length) throw new Error(`the operation is not whole: ${bad.join(', ')}`);
  return withLayer(doc, li, { ...L, ops: Object.freeze([...L.ops, Object.freeze({ ...op })]) });
}
/** @param {EditDoc} doc @param {number} li @param {Layer} L */
export const withLayer = (doc, li, L) => Object.freeze({ ...doc, layers: Object.freeze(doc.layers.map((x, i) => (i === li ? Object.freeze(L) : x))) });
/** @param {EditDoc} doc @param {string} name */
export const addLayer = (doc, name) => Object.freeze({ ...doc, layers: Object.freeze([...doc.layers, layer(name)]) });

/** The weight of a brush at a distance (0..1). */
function falloffAt(op, d) {
  const r = /** @type {number} */ (op.r), t = d / r;
  if (t >= 1) return 0;
  if (op.falloff === 'flat') return 1;
  if (op.falloff === 'linear') return 1 - t;
  return 1 - smoothstep(0, 1, t);
}

/**
 * The ground's patches from a document's visible brushes, over the bake's grid (`sampler.fields.elev`): a map of tile key
 * to a Float32Array of metres added at each cell of the tile. Brushes apply in layer and operation order, each reading
 * the ground as the ones before it left it (a flatten flattens what a raise raised).
 * @param {EditDoc} doc @param {import('../regionSampler.js').RegionSampler} S
 */
export function groundPatches(doc, S) {
  const e = S.fields.elev, res = e.res, side = TILE_PX * res, patches = new Map(), seed = seedOf(S.header.seed, 'brush');
  const tileOf = (i, j) => {
    const tx = Math.floor(i / side), ty = Math.floor(j / side), k = worldPixelKey(e.x0 + tx * TILE_PX, e.y0 + ty * TILE_PX);
    let p = patches.get(k);
    if (!p) patches.set(k, (p = { tx, ty, data: new Float32Array(side * side) }));
    return p;
  };
  const delta = (i, j) => { const p = patches.get(worldPixelKey(e.x0 + Math.floor(i / side) * TILE_PX, e.y0 + Math.floor(j / side) * TILE_PX)); return p ? p.data[(j % side) * side + (i % side)] : 0; };
  for (const L of doc.layers) {
    if (!L.visible) continue;
    for (const op of L.ops) {
      if (!BRUSHES.has(op.kind)) continue;
      const rc = (/** @type {number} */ (op.r) / PIXEL_M) * res, [ci, cj] = e.cellOf(/** @type {number} */ (op.x), /** @type {number} */ (op.y));
      const cells = [];
      for (let j = Math.max(0, Math.floor(cj - rc)); j <= Math.min(e.h - 1, Math.ceil(cj + rc)); j++) for (let i = Math.max(0, Math.floor(ci - rc)); i <= Math.min(e.w - 1, Math.ceil(ci + rc)); i++) {
        const x = e.x0 + (i + 0.5) / res, y = e.y0 + (j + 0.5) / res, d = Math.sqrt(sq(x - /** @type {number} */ (op.x)) + sq(y - /** @type {number} */ (op.y))) * PIXEL_M;
        const w = falloffAt(op, d);
        if (w > 0) cells.push([i, j, w]);
      }
      const now = (i, j) => e.get(i, j) + delta(i, j);
      const moves = cells.map(([i, j, w]) => {
        const s = /** @type {number} */ (op.strength ?? 0);
        if (op.kind === 'raise') return s * w;
        if (op.kind === 'lower') return -s * w;
        if (op.kind === 'flatten') return (/** @type {number} */ (op.level) - now(i, j)) * w;
        if (op.kind === 'noise') return s * w * fbm(seed, (e.x0 + i / res) * 3, (e.y0 + j / res) * 3, 3);
        let sum = 0;
        for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) sum += now(i + a, j + b);
        return (sum / 9 - now(i, j)) * Math.min(1, w * s / 10);
      });
      cells.forEach(([i, j], n) => { const p = tileOf(i, j); p.data[(j % side) * side + (i % side)] += moves[n]; });
    }
  }
  return patches;
}

/**
 * A sampler with a document's edits over it: the ground raised or lowered by its patches (bilinear between cells), a
 * painted biome where a brush laid one. The bake is untouched; dropping the document is the bake again.
 * @param {import('../regionSampler.js').RegionSampler} S @param {EditDoc} doc
 */
export function editedSampler(S, doc) {
  const patches = groundPatches(doc, S), e = S.fields.elev, res = e.res, side = TILE_PX * res;
  const cellDelta = (i, j) => {
    i = i < 0 ? 0 : i >= e.w ? e.w - 1 : i; j = j < 0 ? 0 : j >= e.h ? e.h - 1 : j;
    const p = patches.get(worldPixelKey(e.x0 + Math.floor(i / side) * TILE_PX, e.y0 + Math.floor(j / side) * TILE_PX));
    return p ? p.data[(j % side) * side + (i % side)] : 0;
  };
  const deltaAt = (x, y) => {
    if (!patches.size) return 0;
    const fx = (x - e.x0) * res - 0.5, fy = (y - e.y0) * res - 0.5, i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j;
    const a = cellDelta(i, j) + (cellDelta(i + 1, j) - cellDelta(i, j)) * tx, b = cellDelta(i, j + 1) + (cellDelta(i + 1, j + 1) - cellDelta(i, j + 1)) * tx;
    return a + (b - a) * ty;
  };
  const paints = doc.layers.filter((L) => L.visible).flatMap((L) => L.ops.filter((o) => o.kind === 'biome'));
  const ground = (x, y) => S.heightAt(x, y) + deltaAt(x, y), ways = authoredCourses(doc, ground);
  return {
    ...S, patches, ways,
    heightAt: (x, y) => onCourses(ways, x, y, ground(x, y)),
    waterAt(x, y) {
      for (const rv of ways.rivers) { const n = nearM(rv.pts, x, y); if (n && n.d < rv.width / 2) return { kind: 'river', surface: n.z, river: 'authored' }; }
      return S.waterAt(x, y);
    },
    env(x, y) {
      const out = /** @type {any} */ (S.env(x, y));
      for (const p of paints) if (Math.sqrt(sq(x - /** @type {number} */ (p.x)) + sq(y - /** @type {number} */ (p.y))) * PIXEL_M < /** @type {number} */ (p.r)) out.biome = p.biome;
      return out;
    },
    slopeAt: (x, y) => { const d = 0.5 / res, gx = (deltaAt(x + d, y) - deltaAt(x - d, y)) / (2 * d * PIXEL_M), gy = (deltaAt(x, y + d) - deltaAt(x, y - d)) / (2 * d * PIXEL_M); return S.slopeAt(x, y) + Math.sqrt(gx * gx + gy * gy); },
  };
}

/** What a document makes stale against its bake: each stage and the rectangle to bake again - the hydrology over the
 *  change's water downstream when `basinOf` is given (continent.js downstreamOf), over the region else.
 *  @param {EditDoc} doc @param {{ x: number, y: number, w: number, h: number }} bounds @param {(r: any) => any} [basinOf] */
export function docStale(doc, bounds, basinOf = undefined) {
  /** @type {Map<string, any>} */
  const out = new Map();
  for (const L of doc.layers) if (L.visible) for (const op of L.ops) {
    for (const [s, r] of staleAfter(/** @type {any} */ (OP_STAGE[op.kind]), opRect(op), bounds, { self: true, basinOf })) {
      const was = out.get(s);
      out.set(s, was ? { x: Math.min(was.x, r.x), y: Math.min(was.y, r.y), w: Math.max(was.x + was.w, r.x + r.w) - Math.min(was.x, r.x), h: Math.max(was.y + was.h, r.y + r.h) - Math.min(was.y, r.y) } : r);
    }
  }
  return out;
}

/** A hand river's banks past its channel, metres (a road's shoulder is riverLaw.js ROAD_SHOULDER_M). */
export const BANK_M = 10;
/** A course's points every this many metres, for its level. */
const COURSE_STEP_M = 8;

/**
 * The visible layers' roads and hand-drawn rivers as courses over the ground `heightAt`: a road's level the ground along
 * it smoothed (five points about each), a river's surface the ground along it, held so it never rises downstream (the
 * drawing's first point is its source). Each point [x, y, z] in world pixels and metres.
 * @param {EditDoc} doc @param {(x: number, y: number) => number} heightAt
 */
export function authoredCourses(doc, heightAt) {
  const roads = [], rivers = [];
  for (const L of doc.layers) {
    if (!L.visible) continue;
    for (const op of L.ops) {
      if (op.kind !== 'road' && op.kind !== 'river') continue;
      const pts = densify(/** @type {number[][]} */ (op.pts), COURSE_STEP_M / PIXEL_M), zs = pts.map(([x, y]) => heightAt(x, y));
      if (op.kind === 'road') {
        const z = zs.map((_, i) => { let sum = 0, n = 0; for (let k = Math.max(0, i - 2); k <= Math.min(zs.length - 1, i + 2); k++) { sum += zs[k]; n++; } return sum / n; });
        roads.push({ width: /** @type {number} */ (op.width), pts: pts.map(([x, y], i) => [x, y, z[i]]) });
      } else {
        let s = Infinity;
        rivers.push({ width: /** @type {number} */ (op.width), depth: /** @type {number} */ (op.depth), pts: pts.map(([x, y], i) => { s = Math.min(s, zs[i] - 0.5); return [x, y, s]; }) });
      }
    }
  }
  return { roads, rivers };
}
/** A polyline with a point at least every `step` (world pixels). */
function densify(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], n = Math.max(1, Math.ceil(Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay)) / step));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
}
/** The nearest point of a course in metres (riverLaw.js nearCourse, its distance in world pixels). @param {number[][]} pts */
const nearM = (pts, x, y) => { const n = nearCourse(pts, x, y); return n ? { d: n.d * PIXEL_M, z: n.z } : null; };
/** The ground at a point with the courses on it: a river's channel cut under its surface with banks over it, a road's
 *  bed eased to its level across its width and shoulder. @param {ReturnType<typeof authoredCourses>} ways */
export function onCourses(ways, x, y, h) {
  for (const rv of ways.rivers) {
    const n = nearM(rv.pts, x, y), half = rv.width / 2;
    if (!n || n.d >= half + BANK_M) continue;
    if (n.d < half) { const u = n.d / half; return Math.min(h, n.z - rv.depth * (1 - u * u)); }
    const top = Math.max(h, n.z + 0.4);
    return n.z + 0.4 + (top - n.z - 0.4) * smoothstep(half, half + BANK_M, n.d);
  }
  for (const rd of ways.roads) {
    const n = nearM(rd.pts, x, y), half = rd.width / 2;
    if (!n || n.d >= half + ROAD_SHOULDER_M) continue;
    return n.z + (h - n.z) * smoothstep(half, half + ROAD_SHOULDER_M, n.d);
  }
  return h;
}
