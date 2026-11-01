// @ts-check
// A SETTLEMENT'S LAYOUT, THE PART THE GROUND NEEDS.
// Stages A to C of the generator: the site and its frame, the cells, and the terraces - each cell's pad, the links between
// them, the datum. The terrain worker runs it on its own natural ground, carves the land to its pads and hands the layout
// on, so the ground and the buildings come from one computation; settlementGen.js dresses it. Serializable: plain
// records, no functions. Worker-safe: it reaches world/ alone (test/world/tamriel2.test.js TAMRIEL2-WORKER).
import { hash32 } from '../blockHash.js';
import { dsin, dcos, datan2, dhypot } from './exactMath.js';
import { STEP_MAX, PITCH_MAX, FORT_WALL, FORT_TOWER, FEATURE_REACH, FEATURE_CLEAR, TREE_CLEAR } from './settlementLimits.js';
import { settlementGroundAt } from './settlementGround.js';
import { distanceToSegment } from './settlementGeometry.js';
import { wrapAngle } from '../mat4.js';
import { SETTLEMENT_STYLES, SETTLEMENT_ARCHETYPES } from './settlementStyles.js';

export const GENERATOR_ID = 'rmbc-terrace';
/** Raised when the same inputs would lay out a different plan. A published plan keeps the version it was made by. */
export const SETTLEMENT_GENERATOR_VERSION = 6;   // moves with any change to a plan; the golden prints (rmbc3_exact) hold it
/** Most an arc runs between two of its points, metres. */
export const ARC_STEP = 8;
/** The canal between two decks of an island settlement, metres. */
export const ISLAND_GAP = 3;
/** The least a deck stands over the ground under it, metres. */
export const DECK_CLEAR = 0.6;
/** A row town's arc: the radius of the circle it follows, metres - a hillside's bend, and a shore's gentler one. */
export const ROW_RADIUS = Object.freeze([140, 320]);
export const SHORE_RADIUS = Object.freeze([600, 1200]);
/** Two wall lines closer than this, metres, stand as one (no hairline step between them). */
const HAIRLINE = 0.1;
/** The least two neighbouring bands' streets overlap for a link between them, metres: a walker's way. */
export const ALONG_LEAST = 1.5;
/** How far a link's two ends stand from the rim they cross, metres. */
const LINK_REACH = 2.5;
/** A site whose terraces stand further than this many terrace steps from their ground is too steep for the archetype. */
export const CUT_STEPS_MAX = 2.5;
/** How far a dock looks for water past its quay, and how far it runs out over it, metres. */
export const DOCK_REACH = 40;
export const DOCK_OUT = 8;
/** A keep's half side, metres; its mound's radius past its corners; and the square round the mound, a street and the
 *  square's feature. */
export const KEEP_HALF = 7;
export const KEEP_MOUND = KEEP_HALF * Math.SQRT2 + 2.5;
export const KEEP_ROOM = 6;
/** How far a yard tree stands from a road through its cell, metres along its arc. */
export const ROAD_CLEAR = 4;

/**
 * @typedef {readonly [number, number]} Pt
 * @typedef {{ heightAt: (east: number, north: number) => number, waterAt?: (east: number, north: number) => boolean, blockedAt?: (east: number, north: number) => boolean, roadAt?: (east: number, north: number) => boolean }} SiteEnv
 * @typedef {{ place: number, origin: { px: number, py: number, east: number, north: number }, seed: number, archetype: string, style: string,
 *   site: { east: number, north: number, radius: number }, env?: SiteEnv, roads?: number[], ledger?: any, keys?: 'anchored', districtSeeds?: Record<string, number>, protectedKeys?: number[],
 *   published?: any[], params?: { size?: number, density?: number, bands?: number, sectors?: number, open?: number },
 *   fix?: { layout?: string, centre?: number[], shore?: { dir: number[], at: number } }, core?: { centre: number[], half: number[], y: number, clear?: number }, bounds?: { e0: number, e1: number, n0: number, n1: number } }} SettlementInput
 */

export const TAU = Math.PI * 2;
export const cm = (/** @type {number} */ x) => Math.round(x * 100) / 100;
export const clampWithin = (/** @type {number} */ x, /** @type {number} */ lo, /** @type {number} */ hi) => Math.max(lo, Math.min(hi, x));
export const compassBearing = (/** @type {number} */ e, /** @type {number} */ n) => datan2(e, n);

/** The polar frame every layout is cut in: u an angle clockwise from north, v a distance from its centre. */
export function polarFrame(c) {
  return { c, toW: (u, v) => /** @type {Pt} */ ([cm(c[0] + v * dsin(u)), cm(c[1] + v * dcos(u))]), du: (s, v) => s / Math.max(v, 1e-6) };
}

/** The points along u from u0 to u1 at v: both ends and every grid stop between, none nearer an end than 25 cm. */
export function along(frame, grid, u0, u1, v) {
  const near = frame.du(0.25, v);
  return [u0, ...grid.filter((g) => g > u0 + near && g < u1 - near), u1].map((u) => frame.toW(u, v));
}

/** The ground near the site: its fall (a plane's gradient) and how far its middle stands over its rim. */
function readSite(env, site) {
  const pts = [];
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) pts.push([site.east + (i * site.radius) / 2, site.north + (j * site.radius) / 2]);
  const h = pts.map(([e, n]) => env.heightAt(e, n));
  const mean = h.reduce((a, b) => a + b, 0) / h.length;
  let ge = 0, gn = 0, ss = 0;
  pts.forEach(([e, n], i) => { const de = e - site.east, dn = n - site.north; ge += de * (h[i] - mean); gn += dn * (h[i] - mean); ss += de * de; });
  const rim = h.filter((_, i) => Math.abs(pts[i][0] - site.east) === site.radius || Math.abs(pts[i][1] - site.north) === site.radius);
  return { grad: [ge / ss, gn / ss], hill: env.heightAt(site.east, site.north) - rim.reduce((a, b) => a + b, 0) / rim.length };
}

/** The site's highest dry point, or its lowest, on a 9 x 9 search of its inner half. */
function searchCentre(env, site, want) {
  let best = [site.east, site.north], score = -Infinity;
  for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
    const e = site.east + (i * site.radius) / 8, n = site.north + (j * site.radius) / 8;
    if (env.waterAt?.(e, n) && want === 'high') continue;
    const s = (want === 'high' ? 1 : -1) * env.heightAt(e, n) - dhypot(i, j) * 0.01;
    if (s > score) { score = s; best = [e, n]; }
  }
  return best;
}

/** The water near the site: its direction (toward the weighted middle of the water within twice the site's radius - square to
 *  a straight shore, into a lake's pocket) and the shore's distance that way, to the metre; null with no water near. */
function findShore(env, site) {
  if (!env.waterAt) return null;
  let we = 0, wn = 0;
  for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) {
    const de = (i * site.radius) / 4, dn = (j * site.radius) / 4, d = dhypot(de, dn);
    if (!d || !env.waterAt(site.east + de, site.north + dn)) continue;
    const w = 1 / (d * (1 + d / site.radius));
    we += de * w; wn += dn * w;
  }
  const len = dhypot(we, wn);
  if (!len) return null;
  const dir = [we / len, wn / len];
  for (let s = 1; s <= site.radius * 2; s++) if (env.waterAt(site.east + dir[0] * s, site.north + dir[1] * s)) return { dir, at: s };
  return null;
}

/** A published shore - its direction fixed, its distance read from the ground every client stands, so a ground
 *  that moves its water moves the quay with it; null with no water that way. */
function shoreAlong(env, site, dir) {
  if (!env.waterAt || !dir) return null;
  for (let step = 1; step <= site.radius * 2; step++) if (env.waterAt(site.east + dir[0] * step, site.north + dir[1] * step)) return { dir, at: step };
  return null;
}

/** n spans of [0.6, 1.4] weight, laid end to end over `total`. */
export function splits(rng, n, total, salt) {
  const w = Array.from({ length: n }, (_, i) => 0.6 + 0.8 * rng(salt, i));
  const sum = w.reduce((a, b) => a + b, 0);
  let acc = 0;
  return w.map((x) => { const s = acc; acc += (x / sum) * total; return [s, acc]; });
}

/**
 * Stages A to C. roads: the bearings roads arrive from (degrees clockwise from north); params: the editor's controls -
 * size and density scale the town and its plots, bands and sectors its cells, open the share left open ground; core a legacy town's rectangle (half its sides east and north, its ground's height, the street round the town inside it) in the plaza's place; bounds where a cell may stand;
 * env.blockedAt the ground no cell may take.
 * @param {SettlementInput} input @param {SiteEnv} env
 */
export function layoutSettlement(input, env) {
  const { place, seed, site, roads = [], params = {} } = input;
  const A = SETTLEMENT_ARCHETYPES[input.archetype], st = SETTLEMENT_STYLES[input.style];
  if (!A) throw new RangeError(`no settlement archetype '${input.archetype}' (settlementStyles.js SETTLEMENT_ARCHETYPES)`);
  if (!st) throw new RangeError(`no settlement style '${input.style}' (settlementStyles.js SETTLEMENT_STYLES)`);
  const rng = (...ns) => hash32(seed >>> 0, place >>> 0, ...ns) / 0x100000000;
  const pick = (range, ...ns) => range[0] + (range[1] - range[0]) * rng(...ns);
  const sizeK = clampWithin(params.size ?? 1, 0.5, 2);

  // A - the site and its layout: a ring round a square, or a row along an arc
  // a published settlement fixes what its ground chose when the toolchain laid it out (settlementPlaces.js `fix`)
  const fix = input.fix ?? {};
  const ground = readSite(env, site);
  const core = input.core ?? null;   // A legacy town's square - the ring's middle, never moved
  let layout = fix.layout ?? A.frame, centre = A.centre;
  if (core) [layout, centre] = ['ring', 'core'];
  if (fix.layout === 'ring') centre = fix.centre ? 'fixed' : 'site';
  if (fix.layout === 'row' && centre !== 'water') centre = 'contour';
  if (layout === 'auto') {
    if (ground.hill > 3) [layout, centre] = ['ring', 'high'];
    else if (dhypot(ground.grad[0], ground.grad[1]) > 0.08) [layout, centre] = ['row', 'contour'];
    else [layout, centre] = ['ring', 'site'];
  }
  const ring = layout === 'ring';
  const shore = centre === 'water' ? (fix.shore ? shoreAlong(env, site, fix.shore.dir) : null) ?? findShore(env, site) : null;   // A fixed shore's way, its distance the ground's
  if (centre === 'water' && !shore) centre = 'contour';
  const islands = A.islands || st.deck > 0;
  const deck = islands ? Math.max(st.deck, A.islands ? 1.4 : 0) : 0;
  const ws = st.street, wl = st.lane, gap = islands ? ISLAND_GAP : 0;
  const plotDepth = pick(st.depth, 1);
  const bandDepth = ws + plotDepth + st.back + gap;
  const bands = clampWithin(Math.round(params.bands ?? A.bands), 1, 8);
  const size = pick(A.size, 3) * sizeK * (A.frame === 'auto' && !ring ? 2.2 : 1);   // an auto village's size is a radius
  const across = (A.plaza * sizeK + (bands * bandDepth) / 2) / (A.plaza + (bands * bandDepth) / 2);   // a ring's middle, as much longer as its square is wider
  const sectors = clampWithin(Math.round(params.sectors ?? (ring ? pick(A.sectors, 2) * across : size / 28)), ring ? 3 : 2, core ? 24 : 16);   // a core's narrower, to hug it
  const depthAll = bands * bandDepth;

  let frame, inner, uStart, uSpan, vOut = 0;
  if (ring) {
    const c = centre === 'core' ? /** @type {NonNullable<typeof core>} */ (core).centre : centre === 'fixed' ? fix.centre : centre === 'high' ? searchCentre(env, site, 'high') : centre === 'low' ? searchCentre(env, site, 'low') : [site.east, site.north];
    frame = polarFrame(c);
    inner = core ? dhypot(core.half[0], core.half[1]) + ws : Math.max(A.plaza * sizeK, A.keep ? KEEP_MOUND + KEEP_ROOM + gap / 2 : 0);   // a core's corners and a street round them; a keep's mound and room round it
    uStart = rng(5) * TAU;
    uSpan = TAU;
  } else {
    const R0 = pick(shore ? SHORE_RADIUS : ROW_RADIUS, 4);
    let c, toward;
    if (shore) {
      // the arc's centre stands out over the water and its first band's inner edge is the quay; the arc's ends bend
      // toward the water by its sag, so the quay stands back that far at its middle and the docks run out further
      const sag = R0 * (1 - dcos(size / (R0 + depthAll / 2) / 2)), back = shore.at - 2 - sag;
      const at = [site.east + shore.dir[0] * back, site.north + shore.dir[1] * back];
      c = [at[0] + shore.dir[0] * R0, at[1] + shore.dir[1] * R0];
      toward = [-shore.dir[0], -shore.dir[1]];
      vOut = -(Math.min(12, shore.at) + sag);
    } else {
      const g = ground.grad, gl = dhypot(g[0], g[1]), side = rng(14) < 0.5 ? 1 : -1;   // the arc bends round a hollow or a spur
      const up = gl > 1e-6 ? [g[0] / gl, g[1] / gl] : [dsin(rng(4) * TAU), dcos(rng(4) * TAU)];
      toward = [up[0] * side, up[1] * side];
      c = [site.east - toward[0] * (R0 + depthAll / 2), site.north - toward[1] * (R0 + depthAll / 2)];
    }
    frame = polarFrame(c);
    inner = R0;
    uSpan = size / (R0 + depthAll / 2);
    uStart = compassBearing(toward[0], toward[1]) - uSpan / 2;
  }

  // B - the cells: sector edges, each sector's band radii, the arc grid a sector's bands share
  const edges = splits(rng, sectors, uSpan, 6).map(([a, b]) => [a + uStart, b + uStart]);
  const innerOf = (/** @type {number} */ j) => (core ? coreEdge(core.half, edges[j][0], edges[j][1]) + ws + rng(21, j) * 6 : inner);   // a core's hugged, set back a little or more
  const radii = edges.map((_, j) => {
    const out = [innerOf(j)];
    for (let k = 1; k <= bands; k++) out.push(out[k - 1] + bandDepth + (rng(7, j, k) - 0.5) * ws * 0.8);
    return out;
  });
  // a ring town leaves some outer sectors unbuilt, so its edge is ragged; never a gate's
  const reachOf = edges.map((_, j) => (ring && bands > 1 && rng(15, j) < 0.25 ? bands - 1 : bands));
  if (core) roadReach(reachOf, edges, roads, bands, rng);   // a core's outskirts reach out along its roads
  const grids = edges.map(([u0, u1], j) => {
    const m = Math.max(2, Math.ceil(((u1 - u0) * radii[j][bands]) / ARC_STEP));
    return Array.from({ length: m + 1 }, (_, i) => u0 + ((u1 - u0) * i) / m);
  });
  const inset = (v, s) => frame.du(s, v);

  // gates: a ring's on its outer band facing the roads (or spread round it), a row's at its two ends
  const gateSectors = [];
  const midOf = (j) => (edges[j][0] + edges[j][1]) / 2;
  if (ring) {
    const wants = roads.length ? roads.map((d) => (d * Math.PI) / 180) : Array.from({ length: A.gates }, (_, i) => uStart + ((i + 0.5) * TAU) / A.gates);
    for (const w of wants) {
      let best = 0, bd = Infinity;
      for (let j = 0; j < sectors; j++) { const d = Math.abs(datan2(dsin(midOf(j) - w), dcos(midOf(j) - w))); if (d < bd) { bd = d; best = j; } }
      if (!gateSectors.includes(best)) gateSectors.push(best);
    }
    for (const j of gateSectors) reachOf[j] = bands;
  } else gateSectors.push(0, sectors - 1);
  const outR = (j) => radii[j][reachOf[j]];

  /** @type {Map<string, any>} */ const cells = new Map();
  const cellId = (k, j) => (k === 0 ? 'plaza' : `c${k}.${j}`);
  for (let j = 0; j < sectors; j++) {
    const [u0, u1] = edges[j];
    for (let k = 1; k <= reachOf[j]; k++) {
      if (core && k > 1 && rng(19, j, k) < 0.18 * (k - 1)) { reachOf[j] = k - 1; break; }   // an end left ragged
      const ai = radii[j][k - 1] + gap / 2, bi = radii[j][k] - gap / 2;
      const outer = along(frame, grids[j], u0 + inset(bi, gap / 2), u1 - inset(bi, gap / 2), bi);
      const innerArc = along(frame, grids[j], u0 + inset(ai, gap / 2), u1 - inset(ai, gap / 2), ai).reverse();
      cells.set(cellId(k, j), { id: cellId(k, j), k, j, a: ai, b: bi, u0, u1, poly: [...outer, ...innerArc] });
    }
  }
  if (core) {
    const [midE, midN] = core.centre, [east, north] = core.half;
    const rect = [[midE - east, midN - north], [midE + east, midN - north], [midE + east, midN + north], [midE - east, midN + north]].map(([e, n]) => /** @type {Pt} */ ([cm(e), cm(n)]));
    cells.set('plaza', { id: 'plaza', k: 0, j: -1, a: 0, b: Math.max(east, north), poly: rect, core: true });
  } else if (ring && inner > 0) {
    const r = inner - gap / 2, us = [];
    for (const g of grids) for (const u of g) if (!us.length || u - us[us.length - 1] > 1e-9) us.push(u);
    cells.set('plaza', { id: 'plaza', k: 0, j: -1, a: 0, b: r, poly: us.filter((u) => u < uStart + uSpan - 1e-9).map((u) => frame.toW(u, r)) });   // a ring's span is the whole turn
  }

  // natural ground under each cell; a cut cell under water is dropped
  const made = cells.size;
  for (const c of cells.values()) {
    if (c.core) { c.natural = c.top = c.h = /** @type {NonNullable<typeof core>} */ (core).y; c.wet = 0; c.raised = false; continue; }
    const samples = c.poly.filter((_, i) => i % 2 === 0);
    samples.push(ringCentroid(c.poly));
    const hs = samples.map(([e, n]) => env.heightAt(e, n)), dry = hs.filter((_, i) => !env.waterAt?.(samples[i][0], samples[i][1]));
    c.natural = (dry.length ? dry : hs).reduce((s, x) => s + x, 0) / (dry.length || hs.length);   // its dry ground's: a pad never under the water it meets
    c.top = Math.max(...hs);
    c.low = Math.min(...hs);   // a deck's posts reach its lowest ground
    c.wet = 1 - dry.length / samples.length;
    c.raised = islands;
    c.h = islands ? c.top + deck : c.natural;
  }
  for (const c of [...cells.values()]) if (!c.core && ((!islands && c.wet > 0.25) || cellBarred(c.poly, env, input.bounds))) cells.delete(c.id);
  // a road crossing a cell keeps it - where in the cell it runs is kept, and the dressing builds beside it
  if (env.roadAt) for (const cell of cells.values()) if (!cell.core) cell.road = roadAcross(cell.poly, env.roadAt, frame.c);
  const gateBand = ring ? bands : 1;
  for (const j of gateSectors) {
    const g = cells.get(cellId(gateBand, j));
    if (g && islands && deck > STEP_MAX && g.wet <= 0.5) { g.raised = false; g.h = g.natural; }   // a raised town's gate is a landing on its dry ground; a deck where that is under half
  }

  // the ways between cells; what no gate reaches is dropped
  /** @type {Array<{ from: string, to: string, kind: 'across'|'along'|'plaza' }>} */ const ways = [];
  const shared = (/** @type {any} */ one, /** @type {any} */ other) => Math.min(one.a, other.a) + ws - Math.max(one.a, other.a);   // how far two bands' streets overlap
  for (let j = 0; j < sectors; j++) {
    for (let k = 1; k <= bands; k++) {
      if (k > 1 || cells.has('plaza')) ways.push({ from: cellId(k - 1, j), to: cellId(k, j), kind: k === 1 ? 'plaza' : 'across' });
      const jn = j + 1 < sectors ? j + 1 : ring ? 0 : -1, here = cells.get(cellId(k, j)), there = cells.get(cellId(k, jn));
      if (jn >= 0 && (!here || !there || shared(here, there) >= ALONG_LEAST)) ways.push({ from: cellId(k, j), to: cellId(k, jn), kind: 'along' });   // two streets that meet
    }
  }
  const live = () => ways.filter((w) => cells.has(w.from) && cells.has(w.to));
  const reach = new Set(), stack = core ? ['plaza'] : gateSectors.map((j) => cellId(gateBand, j)).filter((id) => cells.has(id));   // a core's outskirts reach from the town
  while (stack.length) {
    const id = /** @type {string} */ (stack.pop());
    if (reach.has(id)) continue;
    reach.add(id);
    for (const w of live()) { if (w.from === id) stack.push(w.to); else if (w.to === id) stack.push(w.from); }
  }
  for (const id of [...cells.keys()]) if (!reach.has(id)) cells.delete(id);

  // C - each way's link, and the terraces: neighbours pulled together until each step is climbable
  let links = live().map((w) => {
    const f = cells.get(w.from), t = cells.get(w.to);
    let a, b;
    if (w.kind === 'along') {
      // at the radius both streets share, so it stays on them, clear of a third pad and every plot
      const reachU = Math.max(LINK_REACH, gap / 2 + 1), along = Math.max(f.a, t.a) + shared(f, t) / 2;
      a = frame.toW(f.u1 - inset(along, reachU), along);
      b = frame.toW(t.u0 + inset(along, reachU), along);
    } else {
      // a core's a metre inside its town's edge that way, on the town's own level ground
      const town = (/** @type {number} */ bearing) => rectEdge(/** @type {NonNullable<typeof core>} */ (core).half.map((side) => Math.max(0.5, side - (core?.clear ?? 0) - 1)), bearing);
      const inner = f.core ? town(edges[t.j][0]) : f.b - (w.kind === 'plaza' ? Math.min(LINK_REACH, f.b / 2) : LINK_REACH);
      // its lane's inset where the next sector's pads begin beside it (a square's, a core's edge, or its inner band's), clear all along
      const beside = f.core ? rectEdge(/** @type {NonNullable<typeof core>} */ (core).half, edges[t.j][0]) : f.k === 0 ? t.a : Math.min(inner, t.a);
      const lu = edges[t.j][0] + inset(beside, gap / 2 + wl / 2);
      const start = f.core ? town(lu) : inner;
      a = frame.toW(lu, start);
      b = frame.toW(lu, t.a + Math.min(LINK_REACH, ws));
    }
    const run = dhypot(b[0] - a[0], b[1] - a[1]);
    // an along link is a chord: its middle sags inward, so its width gives the sag up on both sides
    const sag = w.kind === 'along' ? Math.max(0, Math.max(f.a, t.a) + shared(f, t) / 2 - dhypot((a[0] + b[0]) / 2 - frame.c[0], (a[1] + b[1]) / 2 - frame.c[1])) : 0;
    // a bridge between decks keeps a bridge's pitch; a step between cut terraces is a retaining wall's height at most
    const bridge = f.raised && t.raised && gap > 0;
    const pitch = (bridge ? PITCH_MAX.bridge : PITCH_MAX.stairs) * (f.core ? Math.min(run, (core?.clear ?? run) - 0.5) : run);   // a core's flight stands in its own street
    return { ...w, a, b, run, bridge, max: (f.raised || t.raised ? pitch : Math.min(st.terrace, pitch)) * 0.95 - 0.02, width: w.kind === 'along' ? cm(Math.min(ws, shared(f, t)) - 2 * sag - 0.1) : wl };
  });
  const keepHalf = KEEP_HALF;
  if (A.keep && cells.has('plaza') && !core) {
    const pz = cells.get('plaza'), r = KEEP_MOUND, gb = gateSectors.length ? midOf(gateSectors[0]) : uStart;
    cells.set('mound', { id: 'mound', k: -1, j: -1, a: 0, b: r, poly: Array.from({ length: 16 }, (_, i) => frame.toW(gb + (i / 16) * TAU, r)), natural: pz.natural, top: pz.top, h: pz.h + 1.5, raised: pz.raised, gb });
    links.push({ from: 'plaza', to: 'mound', kind: 'plaza', a: frame.toW(gb, r + 1.6), b: frame.toW(gb, r - 1.6), run: 3.2, bridge: false, max: Math.min(st.terrace, PITCH_MAX.stairs * 3.2) * 0.95 - 0.02, width: 3 });
  }
  // a deck never sinks within DECK_CLEAR of the ground under it, and raising every deck together always meets every
  // link; a deck moves four times as readily as cut ground, which costs earth where a deck costs a longer post
  const least = (c) => (c.raised ? c.top + DECK_CLEAR : -Infinity);
  const give = (c) => (c.core ? 0 : c.raised ? 4 : 1);   // a core never moves: the town stands where it stands
  for (let it = 0; it < 2000; it++) {
    let worst = 0;
    for (const l of links) {
      const f = cells.get(l.from), t = cells.get(l.to), d = t.h - f.h, over = Math.abs(d) - l.max;
      if (over <= 0) continue;
      worst = Math.max(worst, over);
      const s = Math.sign(d) * over, share = give(f) / (give(f) + give(t));
      f.h = Math.max(least(f), f.h + s * share);
      t.h = Math.max(least(t), t.h - s * (1 - share));
    }
    if (worst < 1e-4) break;
  }
  if (core) links = dropDeepCuts(cells, links, CUT_STEPS_MAX * st.terrace);   // A cell its town's height would cut too deep is not built
  const kept = [...cells.values()].filter((c) => c.k >= 0);
  const datum = core ? cm(core.y) : kept.length ? cm(kept.reduce((s, c) => s + c.natural, 0) / kept.length) : 0;
  // a core's first band paved in to the core's edge: the street round the town stands at its sector's level
  const apron = (/** @type {any} */ cell) => {
    const half = /** @type {NonNullable<typeof core>} */ (core).half, outer = cell.poly.slice(0, cell.poly.length / 2), [first, last] = [compassBearing(outer[0][0] - frame.c[0], outer[0][1] - frame.c[1]), compassBearing(outer.at(-1)[0] - frame.c[0], outer.at(-1)[1] - frame.c[1])];
    const end = last < first ? last + TAU : last, corner = datan2(half[0], half[1]), corners = [];
    for (const bend of [corner, TAU / 2 - corner, TAU / 2 + corner, TAU - corner]) for (const turn of [-TAU, 0, TAU]) if (bend + turn > first && bend + turn < end) corners.push(bend + turn);
    const edge = (/** @type {number} */ bearing) => frame.toW(bearing, rectEdge(half, bearing));
    return [...outer, edge(end), ...corners.sort((x, y) => y - x).map(edge), edge(first)];
  };
  /** @type {import('./settlementContract.js').Pad[]} */
  const pads = [...cells.values()].map((c) => ({ id: c.id, poly: core && c.k === 1 ? apron(c) : c.poly, y: cm(c.h - datum), rim: Math.abs(c.h - c.natural) > 1 ? 'wall' : 'grade', base: c.raised ? 'raised' : 'cut', ...(c.core ? { legacy: true } : {}) }));
  const padY = new Map(pads.map((p) => [p.id, p.y]));
  /** @type {import('./settlementContract.js').Link[]} */
  const planLinks = links.map((l, i) => {
    const rise = Math.abs(padY.get(l.to) - padY.get(l.from));
    return { id: `l${i}`, kind: l.bridge ? 'bridge' : rise <= STEP_MAX ? 'grade' : rise <= PITCH_MAX.ramp * l.run ? 'ramp' : 'stairs', from: l.from, to: l.to, a: l.a, b: l.b, width: l.width };
  });

  const walls = A.wall && ring ? fortWalls(frame, cells, { edges, grids, sectors, gateSectors }, env, pads, datum) : { walls: [], towers: [] };
  const docks = A.docks && !ring && vOut < 0 ? docksOut(frame, cells, { uStart, uSpan, size, inner, gap }, env) : [];

  return {
    version: SETTLEMENT_GENERATOR_VERSION, layout, c: frame.c, shore, ring, inner, uStart, uSpan, vOut, edges, radii, reachOf, grids, gateSectors, gateBand,
    islands, gap, ws, wl, plotDepth, bands, sectors, size, keepHalf, made, keptCount: kept.length, datum, pads, links: planLinks, ...walls, docks,
    core: core ? { centre: core.centre, half: core.half } : null,
    cells: [...cells.values()].map((c) => ({ ...(c.road?.length ? { road: c.road } : {}), id: c.id, k: c.k, j: c.j, a: c.a, b: c.b, u0: c.u0, u1: c.u1, poly: c.poly, natural: c.natural, low: c.low, h: c.h, raised: c.raised, gb: c.gb, ...(c.core ? { core: true } : {}) })),
  };
}

/** How far from a rectangle's middle its edge stands at a bearing. @param {readonly number[]} half its half sides, east and
 *  north @param {number} bearing */
export function rectEdge(half, bearing) {
  const across = Math.abs(dsin(bearing)), up = Math.abs(dcos(bearing));
  return Math.min(across > 1e-12 ? half[0] / across : Infinity, up > 1e-12 ? half[1] / up : Infinity);
}

/** How far from a rectangle's middle its edge stands at the furthest along a sector's span - at a corner if the span
 *  holds one, else at whichever end is nearer a corner. @param {readonly number[]} half @param {number} from @param {number} to */
export function coreEdge(half, from, to) {
  const corner = datan2(half[0], half[1]);
  for (const at of [corner, TAU / 2 - corner, TAU / 2 + corner, TAU - corner]) if (at + Math.ceil((from - at) / TAU) * TAU <= to) return dhypot(half[0], half[1]);
  return Math.max(rectEdge(half, from), rectEdge(half, to));
}

/**
 * A walled ring's walls and towers, just outside the cells that stand: each sector's run past its outermost cell's rim,
 * stepping round a taller neighbour on the shorter side, where no cell stands; a tower projecting out at every corner and
 * either side of each gate. A run breaks over water and a tower there is not built. Each foot is the ground the carve
 * leaves there, over the datum (a deck town's the land's own).
 * @param {ReturnType<typeof polarFrame>} frame @param {Map<string, any>} cells
 * @param {{ edges: number[][], grids: number[][], sectors: number, gateSectors: number[] }} rings @param {SiteEnv} env @param {import('./settlementContract.js').Pad[]} pads @param {number} datum
 */
function fortWalls(frame, cells, { edges, grids, sectors, gateSectors }, env, pads, datum) {
  const rim = edges.map(() => -Infinity);
  for (const cell of cells.values()) if (cell.k >= 1) rim[cell.j] = Math.max(rim[cell.j], cell.b);
  const has = (/** @type {number} */ j) => rim[j] > -Infinity, walled = (/** @type {number} */ j) => has(j) && !gateSectors.includes(j);
  const line = (/** @type {number} */ j) => rim[j] + FORT_WALL.thick / 2 + FEATURE_CLEAR;
  // the boundary beside a gate's lane (its sector's first edge): its step and tower kept on the walled side, the way out clear
  const byGate = (/** @type {number} */ j) => walled(j) && gateSectors.includes((j + 1) % sectors);
  const setBack = (/** @type {number} */ radius) => (FEATURE_REACH.tower + FEATURE_CLEAR) / radius;
  const off = (/** @type {number} */ j) => {   // the step at the end of sector j: on its shorter side
    const next = (j + 1) % sectors;
    if (!has(j) || !has(next)) return 0;
    const turn = (FORT_WALL.thick / 2 + FEATURE_CLEAR) / Math.min(line(j), line(next));
    // beside a gate: its step on the walled side; as tall or taller, no step and its run stops short of the way
    if (byGate(j)) return rim[j] < rim[next] ? -turn : -(FORT_WALL.thick / 2 + FEATURE_CLEAR) / line(j);
    if (Math.abs(rim[j] - rim[next]) < HAIRLINE) return 0;
    return rim[j] < rim[next] ? -turn : turn;
  };
  const ground = (/** @type {Pt} */ point) => { const natural = env.heightAt(point[0], point[1]); return (settlementGroundAt(pads, datum, point[0], point[1], natural) ?? natural) - datum; };
  const wet = (/** @type {Pt} */ point) => !!env.waterAt?.(point[0], point[1]);
  const walls = [], towers = [];
  for (let j = 0; j < sectors; j++) {
    const prev = (j + sectors - 1) % sectors, next = (j + 1) % sectors, from = edges[j][0] + off(prev);
    if (walled(prev) || walled(j)) {
      const out = Math.max(rim[j], rim[prev]) + FEATURE_REACH.tower + FEATURE_CLEAR;   // its eave past the rim too
      const at = frame.toW(byGate(prev) ? Math.min(from, edges[j][0] - setBack(out)) : from, out);
      const ring = [at, ...Array.from({ length: 8 }, (_, i) => /** @type {Pt} */ ([at[0] + FORT_TOWER.r * dsin((i * TAU) / 8), at[1] + FORT_TOWER.r * dcos((i * TAU) / 8)]))];
      if (!ring.some(wet)) towers.push({ id: `tower${j}`, at, y: cm(Math.min(...ring.map(ground))) });
    }
    if (!walled(j)) continue;
    const to = edges[j][1] + off(j), path = along(frame, grids[j], from, to, line(j));
    if (has(prev) && !walled(prev) && Math.abs(line(prev) - line(j)) >= HAIRLINE) path.unshift(frame.toW(from, line(prev)));   // a gate's side
    if (has(next) && Math.abs(line(next) - line(j)) >= HAIRLINE && !(byGate(j) && rim[j] >= rim[next])) path.push(frame.toW(to, line(next)));
    let run = { path: [path[0]], ground: /** @type {number[]} */ ([]) }, n = 0;
    const close = () => { if (run.ground.length) walls.push({ id: `wall${j}.${n++}`, path: run.path, ground: run.ground }); };
    for (let i = 0; i + 1 < path.length; i++) {
      const [a, b] = [path[i], path[i + 1]], steps = Math.max(1, Math.ceil(dhypot(b[0] - a[0], b[1] - a[1]) / 2));
      const points = Array.from({ length: steps + 1 }, (_, k) => /** @type {Pt} */ ([a[0] + ((b[0] - a[0]) * k) / steps, a[1] + ((b[1] - a[1]) * k) / steps]));
      if (points.some(wet)) { close(); run = { path: [b], ground: [] }; continue; }
      const heights = points.map(ground);
      if (Math.max(...heights) - Math.min(...heights) > FORT_WALL.h - 2) {   // ground climbing past the wall: a run each sample's stretch
        for (let k = 1; k < points.length; k++) { run.path.push(points[k]); run.ground.push(cm(Math.min(heights[k - 1], heights[k]))); }
        continue;
      }
      run.path.push(b);
      run.ground.push(cm(Math.min(...heights)));
    }
    close();
  }
  return { walls, towers };
}

/**
 * A river town's docks: each from its quay straight out to the water and DOCK_OUT past its edge, on a quay that stands;
 * none where no water lies within DOCK_REACH.
 * @param {ReturnType<typeof polarFrame>} frame @param {Map<string, any>} cells
 * @param {{ uStart: number, uSpan: number, size: number, inner: number, gap: number }} row @param {SiteEnv} env
 */
function docksOut(frame, cells, { uStart, uSpan, size, inner, gap }, env) {
  const docks = [], quay = inner + gap / 2, wet = (/** @type {number} */ bearing, /** @type {number} */ out) => { const point = frame.toW(bearing, out); return !!env.waterAt?.(point[0], point[1]); };
  const n = Math.max(1, Math.floor(size / 24));
  for (let i = 0; i < n; i++) {
    const bearing = uStart + (uSpan * (i + 0.5)) / n;
    if (![...cells.values()].some((cell) => cell.k === 1 && cell.u0 <= bearing && bearing <= cell.u1)) continue;   // its quay's cell dropped
    let edge = null;
    for (let out = quay - 1; out >= quay - DOCK_REACH; out--) if (wet(bearing, out)) { edge = out; break; }
    if (edge === null) continue;
    let end = edge;
    while (end > edge - DOCK_OUT && wet(bearing, end - 1)) end--;
    docks.push({ id: `dock${i}`, path: [frame.toW(bearing, quay), frame.toW(bearing, end)] });
  }
  return docks;
}

/** Each sector's reach by how squarely it faces a road out of the town - a road's sector its whole depth, one a
 *  sixth of a turn off any road none but for its draw (about one in eight a band); with no road, about a band all
 *  round. Written into `reachOf`. */
export function roadReach(reachOf, edges, roads, bands, rng) {
  const ways = roads.map((deg) => (deg * Math.PI) / 180);
  for (let j = 0; j < edges.length; j++) {
    const mid = (edges[j][0] + edges[j][1]) / 2;
    const off = ways.length ? Math.min(...ways.map((w) => Math.abs(datan2(dsin(mid - w), dcos(mid - w))))) : TAU / 10;
    const lean = Math.max(0, 1 - off / (TAU / 6));
    reachOf[j] = clampWithin(Math.round(bands * lean + (rng(15, j) - 0.45) * 1.2), off < TAU / 24 ? 1 : 0, bands);
  }
}

/** Each district's draw: its own seed (the editor's `districtSeeds`) or the settlement's. @param {SettlementInput} input */
export const districtDraw = (input) => (/** @type {number} */ j) => {
  const base = (input.districtSeeds?.[`d${j}`] ?? input.seed) >>> 0;
  return (/** @type {number[]} */ ...salt) => hash32(base, input.place >>> 0, ...salt) / 0x100000000;
};

/**
 * A settlement's yard trees: up to three along each cell's yard, by its district's draw. The dressing's `tree` features
 * and the terrain worker's nature flats (terrainGen.js) are these, so a tree is the land's own picture in every season.
 * @param {SettlementInput} input @param {ReturnType<typeof layoutSettlement>} layout
 * @returns {Array<{ id: string, pad: string, at: Pt }>}
 */
export function yardTrees(input, layout) {
  const style = SETTLEMENT_STYLES[input.style], frame = polarFrame(layout.c), rngOf = districtDraw(input), out = [];
  const walled = !!SETTLEMENT_ARCHETYPES[input.archetype]?.wall && layout.ring;
  const lane = layout.gap / 2 + layout.wl + TREE_CLEAR, side = layout.gap / 2 + TREE_CLEAR;
  for (const cell of layout.cells) {
    // none on a deck (a tree is the ground's), nor in a walled town's outer band, beside its wall
    if (cell.k < 1 || cell.raised || (walled && cell.k === layout.reachOf[cell.j])) continue;
    const radius = cell.b - style.back / 2;
    for (let slot = 0; slot < 3; slot++) {
      if (rngOf(cell.j)(13, cell.k, cell.j, slot) >= 0.5) continue;
      const bearing = cell.u0 + (cell.u1 - cell.u0) * (0.25 + slot * 0.25), at = frame.toW(bearing, radius);
      // clear of its lane, the next sector's, a road through its cell and every way between pads
      if ((bearing - cell.u0) * radius < lane || (cell.u1 - bearing) * radius < side || (cell.road && onRoad(cell.road, bearing, bearing, frame.du(ROAD_CLEAR, radius)))) continue;
      if (!layout.links.some((link) => distanceToSegment(at, link.a, link.b) < link.width / 2 + TREE_CLEAR)) out.push({ id: `t${cell.id}.${slot}`, pad: cell.id, at });
    }
  }
  return out;
}

/** whether a road's bearing (a cell's `road`, in [0, a turn)) falls within a plot's span widened by `margin`.
 *  @param {readonly number[]} road @param {number} start @param {number} end @param {number} margin */
export function onRoad(road, start, end, margin) {
  const middle = (start + end) / 2, half = (end - start) / 2 + margin;
  return road.some((bearing) => Math.abs(wrapAngle(bearing - middle)) <= half);
}

/** The cells round a fixed core whose cut passes `limit`, dropped; then the outer end of a link the solve left too
 *  steep (a deck held over its ground beside a core that never moves); and what no longer reaches the core after them. The
 *  links left. Dropping a cell only loosens its neighbours, so every link left still holds. */
function dropDeepCuts(cells, links, limit) {
  for (const cell of [...cells.values()]) if (!cell.core && !cell.raised && Math.abs(cell.h - cell.natural) > limit) cells.delete(cell.id);
  for (const link of links) {
    const from = cells.get(link.from), to = cells.get(link.to);
    if (!from || !to || Math.abs(to.h - from.h) <= link.max + 1e-3) continue;
    cells.delete((from.core ? to : to.core ? from : to.k > from.k || (to.k === from.k && to.id > from.id) ? to : from).id);
  }
  let live = links.filter((link) => cells.has(link.from) && cells.has(link.to));
  const reach = new Set(), stack = ['plaza'];
  while (stack.length) {
    const id = /** @type {string} */ (stack.pop());
    if (reach.has(id)) continue;
    reach.add(id);
    for (const link of live) { if (link.from === id) stack.push(link.to); else if (link.to === id) stack.push(link.from); }
  }
  for (const id of [...cells.keys()]) if (!reach.has(id)) cells.delete(id);
  live = live.filter((link) => cells.has(link.from) && cells.has(link.to));
  return live;
}

/** A cell that may not stand - a corner past the bounds, or any 3 m point inside it on ground the env bars.
 *  @param {readonly Pt[]} poly @param {SiteEnv} env @param {SettlementInput['bounds']} bounds */
export function cellBarred(poly, env, bounds) {
  if (bounds && poly.some(([e, n]) => e < bounds.e0 || e > bounds.e1 || n < bounds.n0 || n > bounds.n1)) return true;
  if (!env.blockedAt) return false;
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  for (const [e, n] of poly) { west = Math.min(west, e); east = Math.max(east, e); south = Math.min(south, n); north = Math.max(north, n); }
  for (let e = west + 1.5; e < east; e += 3) for (let n = south + 1.5; n < north; n += 3) if (insideRing(poly, e, n) && env.blockedAt(e, n)) return true;
  return false;
}

/** the bearings from the frame's centre of every 3 m point inside a cell a road takes, sorted, rounded to a
 *  thousandth of a radian - where the dressing leaves a plot unbuilt. @param {readonly Pt[]} poly
 *  @param {(east: number, north: number) => boolean} roadAt @param {Pt} centre */
export function roadAcross(poly, roadAt, centre) {
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  for (const [e, n] of poly) { west = Math.min(west, e); east = Math.max(east, e); south = Math.min(south, n); north = Math.max(north, n); }
  const seen = new Set();
  for (let e = west + 1.5; e < east; e += 3) for (let n = south + 1.5; n < north; n += 3) {
    if (!insideRing(poly, e, n) || !roadAt(e, n)) continue;
    let angle = compassBearing(e - centre[0], n - centre[1]);
    if (angle < 0) angle += TAU;
    seen.add(Math.round(angle * 1000) / 1000);
  }
  return [...seen].sort((a, b) => a - b);
}

/** Whether (e, n) is inside a ring (even-odd). @param {readonly Pt[]} ring @param {number} e @param {number} n */
function insideRing(ring, e, n) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [eastI, northI] = ring[i], [eastJ, northJ] = ring[j];
    if ((northI > n) !== (northJ > n) && e < ((eastJ - eastI) * (n - northI)) / (northJ - northI) + eastI) inside = !inside;
  }
  return inside;
}

/** @param {readonly Pt[]} ring */
export function ringCentroid(ring) {
  return /** @type {Pt} */ ([cm(ring.reduce((s, p) => s + p[0], 0) / ring.length), cm(ring.reduce((s, p) => s + p[1], 0) / ring.length)]);
}
