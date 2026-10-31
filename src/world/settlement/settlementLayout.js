// @ts-check
// RMB-CONTRACTS RMBC3 (2026-10-31, bible/03-World/RMB-Contracts.md RD-15): A SETTLEMENT'S LAYOUT, THE PART THE GROUND NEEDS.
// Stages A to C of the generator: the site and its frame, the cells, and the terraces - each cell's pad, the links between
// them, the datum. The terrain worker runs it on its own natural ground, carves the land to its pads and hands the layout
// on, so the ground and the buildings come from one computation; settlementGen.js dresses it. Serializable: plain
// records, no functions. Worker-safe: it reaches world/ alone (test/world/tamriel2.test.js TAMRIEL2-WORKER).
import { hash32 } from '../blockHash.js';
import { dsin, dcos, datan2, dhypot } from './exactMath.js';
import { STEP_MAX, PITCH_MAX } from './settlementLimits.js';
import { SETTLEMENT_STYLES, SETTLEMENT_ARCHETYPES } from './settlementStyles.js';

export const GENERATOR_ID = 'rmbc-terrace';
/** Raised when the same inputs would lay out a different plan. A published plan keeps the version it was made by. */
export const SETTLEMENT_GENERATOR_VERSION = 1;
/** Most an arc runs between two of its points, metres. */
export const ARC_STEP = 8;
/** The canal between two decks of an island settlement, metres. */
export const ISLAND_GAP = 3;
/** The least a deck stands over the ground under it, metres. */
export const DECK_CLEAR = 0.6;
/** A row town's arc: the radius of the circle it follows, metres - a hillside's bend, and a shore's gentler one. */
export const ROW_RADIUS = Object.freeze([140, 320]);
export const SHORE_RADIUS = Object.freeze([600, 1200]);
/** How far a link's two ends stand from the rim they cross, metres. */
const LINK_REACH = 2.5;
/** A site whose terraces stand further than this many terrace steps from their ground is too steep for the archetype. */
export const CUT_STEPS_MAX = 2.5;

/**
 * @typedef {readonly [number, number]} Pt
 * @typedef {{ heightAt: (east: number, north: number) => number, waterAt?: (east: number, north: number) => boolean }} SiteEnv
 * @typedef {{ place: number, origin: { px: number, py: number, east: number, north: number }, seed: number, archetype: string, style: string,
 *   site: { east: number, north: number, radius: number }, env?: SiteEnv, roads?: number[], ledger?: any, protectedKeys?: number[],
 *   published?: any[], params?: { size?: number, density?: number, bands?: number, sectors?: number, open?: number },
 *   fix?: { layout?: string, centre?: number[], shore?: { dir: number[], at: number } } }} SettlementInput
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

/** n spans of [0.6, 1.4] weight, laid end to end over `total`. */
export function splits(rng, n, total, salt) {
  const w = Array.from({ length: n }, (_, i) => 0.6 + 0.8 * rng(salt, i));
  const sum = w.reduce((a, b) => a + b, 0);
  let acc = 0;
  return w.map((x) => { const s = acc; acc += (x / sum) * total; return [s, acc]; });
}

/**
 * Stages A to C. roads: the bearings roads arrive from (degrees clockwise from north); params: the editor's controls -
 * size and density scale the town and its plots, bands and sectors its cells, open the share left open ground.
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
  let layout = fix.layout ?? A.frame, centre = A.centre;
  if (fix.layout === 'ring') centre = fix.centre ? 'fixed' : 'site';
  if (fix.layout === 'row' && centre !== 'water') centre = 'contour';
  if (layout === 'auto') {
    if (ground.hill > 3) [layout, centre] = ['ring', 'high'];
    else if (dhypot(ground.grad[0], ground.grad[1]) > 0.08) [layout, centre] = ['row', 'contour'];
    else [layout, centre] = ['ring', 'site'];
  }
  const ring = layout === 'ring';
  const shore = centre === 'water' ? fix.shore ?? findShore(env, site) : null;
  if (centre === 'water' && !shore) centre = 'contour';
  const islands = A.islands || st.deck > 0;
  const deck = islands ? Math.max(st.deck, A.islands ? 1.4 : 0) : 0;
  const ws = st.street, wl = st.lane, gap = islands ? ISLAND_GAP : 0;
  const plotDepth = pick(st.depth, 1);
  const bandDepth = ws + plotDepth + st.back + gap;
  const bands = clampWithin(Math.round(params.bands ?? A.bands), 1, 8);
  const size = pick(A.size, 3) * sizeK * (A.frame === 'auto' && !ring ? 2.2 : 1);   // an auto village's size is a radius
  const sectors = clampWithin(Math.round(params.sectors ?? (ring ? pick(A.sectors, 2) : size / 28)), ring ? 3 : 2, 16);
  const depthAll = bands * bandDepth;

  let frame, inner, uStart, uSpan, vOut = 0;
  if (ring) {
    const c = centre === 'fixed' ? fix.centre : centre === 'high' ? searchCentre(env, site, 'high') : centre === 'low' ? searchCentre(env, site, 'low') : [site.east, site.north];
    frame = polarFrame(c);
    inner = A.plaza;
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
  const radii = edges.map((_, j) => {
    const out = [inner];
    for (let k = 1; k <= bands; k++) out.push(out[k - 1] + bandDepth + (rng(7, j, k) - 0.5) * ws * 0.8);
    return out;
  });
  // a ring town leaves some outer sectors unbuilt, so its edge is ragged; never a gate's
  const reachOf = edges.map((_, j) => (ring && bands > 1 && rng(15, j) < 0.25 ? bands - 1 : bands));
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
      const ai = radii[j][k - 1] + gap / 2, bi = radii[j][k] - gap / 2;
      const outer = along(frame, grids[j], u0 + inset(bi, gap / 2), u1 - inset(bi, gap / 2), bi);
      const innerArc = along(frame, grids[j], u0 + inset(ai, gap / 2), u1 - inset(ai, gap / 2), ai).reverse();
      cells.set(cellId(k, j), { id: cellId(k, j), k, j, a: ai, b: bi, u0, u1, poly: [...outer, ...innerArc] });
    }
  }
  if (ring && inner > 0) {
    const r = inner - gap / 2, us = [];
    for (const g of grids) for (const u of g) if (!us.length || u - us[us.length - 1] > 1e-9) us.push(u);
    cells.set('plaza', { id: 'plaza', k: 0, j: -1, a: 0, b: r, poly: us.filter((u) => u < uStart + uSpan - 1e-9).map((u) => frame.toW(u, r)) });   // a ring's span is the whole turn
  }

  // natural ground under each cell; a cut cell under water is dropped
  const made = cells.size;
  for (const c of cells.values()) {
    const samples = c.poly.filter((_, i) => i % 2 === 0);
    samples.push(ringCentroid(c.poly));
    const hs = samples.map(([e, n]) => env.heightAt(e, n));
    c.natural = hs.reduce((s, x) => s + x, 0) / hs.length;
    c.top = Math.max(...hs);
    c.wet = samples.filter(([e, n]) => env.waterAt?.(e, n)).length / samples.length;
    c.raised = islands;
    c.h = islands ? c.top + deck : c.natural;
  }
  for (const c of [...cells.values()]) if (!islands && c.wet > 0.25) cells.delete(c.id);
  const gateBand = ring ? bands : 1;
  for (const j of gateSectors) {
    const g = cells.get(cellId(gateBand, j));
    if (g && islands && deck > STEP_MAX) { g.raised = false; g.h = g.natural; }   // a raised town's gate is a landing on the ground
  }

  // the ways between cells; what no gate reaches is dropped
  /** @type {Array<{ from: string, to: string, kind: 'across'|'along'|'plaza' }>} */ const ways = [];
  for (let j = 0; j < sectors; j++) {
    for (let k = 1; k <= bands; k++) {
      if (k > 1 || cells.has('plaza')) ways.push({ from: cellId(k - 1, j), to: cellId(k, j), kind: k === 1 ? 'plaza' : 'across' });
      const jn = j + 1 < sectors ? j + 1 : ring ? 0 : -1;
      if (jn >= 0) ways.push({ from: cellId(k, j), to: cellId(k, jn), kind: 'along' });
    }
  }
  const live = () => ways.filter((w) => cells.has(w.from) && cells.has(w.to));
  const reach = new Set(), stack = gateSectors.map((j) => cellId(gateBand, j)).filter((id) => cells.has(id));
  while (stack.length) {
    const id = /** @type {string} */ (stack.pop());
    if (reach.has(id)) continue;
    reach.add(id);
    for (const w of live()) { if (w.from === id) stack.push(w.to); else if (w.to === id) stack.push(w.from); }
  }
  for (const id of [...cells.keys()]) if (!reach.has(id)) cells.delete(id);

  // C - each way's link, and the terraces: neighbours pulled together until each step is climbable
  const links = live().map((w) => {
    const f = cells.get(w.from), t = cells.get(w.to);
    let a, b;
    if (w.kind === 'along') {
      const reachU = Math.max(LINK_REACH, gap / 2 + 1);
      a = frame.toW(f.u1 - inset(f.a + ws / 2, reachU), f.a + ws / 2);
      b = frame.toW(t.u0 + inset(t.a + ws / 2, reachU), t.a + ws / 2);
    } else {
      const lu = edges[t.j][0] + inset((f.b + t.a) / 2, gap / 2 + wl / 2);
      a = frame.toW(lu, f.b - (w.kind === 'plaza' ? Math.min(LINK_REACH, f.b / 2) : LINK_REACH));
      b = frame.toW(lu, t.a + Math.min(LINK_REACH, ws));
    }
    const run = dhypot(b[0] - a[0], b[1] - a[1]);
    // a bridge between decks keeps a bridge's pitch; a step between cut terraces is a retaining wall's height at most
    const bridge = f.raised && t.raised && gap > 0;
    const pitch = (bridge ? PITCH_MAX.bridge : PITCH_MAX.stairs) * run;
    return { ...w, a, b, run, bridge, max: (f.raised || t.raised ? pitch : Math.min(st.terrace, pitch)) * 0.95 - 0.02, width: w.kind === 'along' ? ws : wl };
  });
  const keepHalf = 7;
  if (A.keep && cells.has('plaza')) {
    const pz = cells.get('plaza'), r = keepHalf * Math.SQRT2 + 2.5, gb = gateSectors.length ? midOf(gateSectors[0]) : uStart;
    cells.set('mound', { id: 'mound', k: -1, j: -1, a: 0, b: r, poly: Array.from({ length: 16 }, (_, i) => frame.toW(gb + (i / 16) * TAU, r)), natural: pz.natural, top: pz.top, h: pz.h + 1.5, raised: pz.raised, gb });
    links.push({ from: 'plaza', to: 'mound', kind: 'plaza', a: frame.toW(gb, r + 1.6), b: frame.toW(gb, r - 1.6), run: 3.2, bridge: false, max: Math.min(st.terrace, PITCH_MAX.stairs * 3.2) * 0.95 - 0.02, width: 3 });
  }
  // a deck never sinks within DECK_CLEAR of the ground under it, and raising every deck together always meets every
  // link; a deck moves four times as readily as cut ground, which costs earth where a deck costs a longer post
  const least = (c) => (c.raised ? c.top + DECK_CLEAR : -Infinity);
  const give = (c) => (c.raised ? 4 : 1);
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
  const kept = [...cells.values()].filter((c) => c.k >= 0);
  const datum = kept.length ? cm(kept.reduce((s, c) => s + c.natural, 0) / kept.length) : 0;
  /** @type {import('./settlementContract.js').Pad[]} */
  const pads = [...cells.values()].map((c) => ({ id: c.id, poly: c.poly, y: cm(c.h - datum), rim: Math.abs(c.h - c.natural) > 1 ? 'wall' : 'grade', base: c.raised ? 'raised' : 'cut' }));
  const padY = new Map(pads.map((p) => [p.id, p.y]));
  /** @type {import('./settlementContract.js').Link[]} */
  const planLinks = links.map((l, i) => {
    const rise = Math.abs(padY.get(l.to) - padY.get(l.from));
    return { id: `l${i}`, kind: l.bridge ? 'bridge' : rise <= STEP_MAX ? 'grade' : rise <= PITCH_MAX.ramp * l.run ? 'ramp' : 'stairs', from: l.from, to: l.to, a: l.a, b: l.b, width: l.width };
  });

  return {
    version: SETTLEMENT_GENERATOR_VERSION, layout, c: frame.c, shore, ring, inner, uStart, uSpan, vOut, edges, radii, reachOf, grids, gateSectors, gateBand,
    islands, gap, ws, wl, plotDepth, bands, sectors, size, keepHalf, made, keptCount: kept.length, datum, pads, links: planLinks,
    cells: [...cells.values()].map((c) => ({ id: c.id, k: c.k, j: c.j, a: c.a, b: c.b, u0: c.u0, u1: c.u1, poly: c.poly, natural: c.natural, h: c.h, raised: c.raised, gb: c.gb })),
  };
}

/** @param {readonly Pt[]} ring */
export function ringCentroid(ring) {
  return /** @type {Pt} */ ([cm(ring.reduce((s, p) => s + p[0], 0) / ring.length), cm(ring.reduce((s, p) => s + p[1], 0) / ring.length)]);
}
