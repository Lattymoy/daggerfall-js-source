// @ts-check
// RMB-CONTRACTS RMBC2 (2026-10-31, bible/03-World/RMB-Contracts.md): A SETTLEMENT LAID OUT ON ITS GROUND. A ring town wraps
// a square; a row town follows an arc - round a hillside, along a shore. Either is cut into cells, a band of plots behind
// its street, one sector of it, and each cell is a flat pad near its natural height. Neighbouring pads are pulled together
// until every step can be climbed by its link, so the town terraces with the land. Plots line each street, a building
// stands on each plot big enough, and the archetype's services take the best of them. Deterministic from its inputs; the
// toolchain generates a plan and publishes it as data (RD-10). Not a DFU member: DFU's towns are RMB grids.
import { hash32 } from '../blockHash.js';
import { BUILDING_TYPES, isResidence } from '../buildingNames.js';
import { GUILD_FACTION_IDS } from '../../systems/guild/guildFactions.js';
import { SETTLEMENT_CONTRACT_VERSION, STEP_MAX, PITCH_MAX, validateSettlement } from './settlementContract.js';
import { emptyIdLedger, reconcileBuildingIds } from './settlementIds.js';
import { SETTLEMENT_STYLES, SETTLEMENT_ARCHETYPES } from './settlementStyles.js';

export const GENERATOR_ID = 'rmbc-terrace';
/** Raised when the same inputs would lay out a different plan. A published plan keeps the version it was made by. */
export const GENERATOR_VERSION = 1;
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
const CUT_STEPS_MAX = 2.5;

/**
 * @typedef {import('./settlementContract.js').SettlementPlan} SettlementPlan
 * @typedef {import('./settlementContract.js').Building} Building
 * @typedef {import('./settlementIds.js').IdLedger} IdLedger
 * @typedef {readonly [number, number]} Pt
 * @typedef {{ heightAt: (east: number, north: number) => number, waterAt?: (east: number, north: number) => boolean }} SiteEnv
 */

const TAU = Math.PI * 2;
const cm = (/** @type {number} */ x) => Math.round(x * 100) / 100;
const clamp = (/** @type {number} */ x, /** @type {number} */ lo, /** @type {number} */ hi) => Math.max(lo, Math.min(hi, x));
const bearingOf = (/** @type {number} */ e, /** @type {number} */ n) => Math.atan2(e, n);

/** The polar frame every layout is cut in: u an angle clockwise from north, v a distance from its centre. */
function polarFrame(c) {
  return { c, toW: (u, v) => /** @type {Pt} */ ([cm(c[0] + v * Math.sin(u)), cm(c[1] + v * Math.cos(u))]), du: (s, v) => s / Math.max(v, 1e-6) };
}

/** The points along u from u0 to u1 at v: both ends and every grid stop between, none nearer an end than 25 cm. */
function along(frame, grid, u0, u1, v) {
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
    const s = (want === 'high' ? 1 : -1) * env.heightAt(e, n) - Math.hypot(i, j) * 0.01;
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
    const de = (i * site.radius) / 4, dn = (j * site.radius) / 4, d = Math.hypot(de, dn);
    if (!d || !env.waterAt(site.east + de, site.north + dn)) continue;
    const w = 1 / (d * (1 + d / site.radius));
    we += de * w; wn += dn * w;
  }
  const len = Math.hypot(we, wn);
  if (!len) return null;
  const dir = [we / len, wn / len];
  for (let s = 1; s <= site.radius * 2; s++) if (env.waterAt(site.east + dir[0] * s, site.north + dir[1] * s)) return { dir, at: s };
  return null;
}

/** n spans of [0.6, 1.4] weight, laid end to end over `total`. */
function splits(rng, n, total, salt) {
  const w = Array.from({ length: n }, (_, i) => 0.6 + 0.8 * rng(salt, i));
  const sum = w.reduce((a, b) => a + b, 0);
  let acc = 0;
  return w.map((x) => { const s = acc; acc += (x / sum) * total; return [s, acc]; });
}

/**
 * Lay out a settlement. roads: the bearings roads arrive from (degrees clockwise from north); params: the editor's
 * controls - size and density scale the town and its plots, bands and sectors its cells, open the share left open ground.
 * @param {{ place: number, origin: import('./settlementContract.js').Origin, seed: number, archetype: string, style: string,
 *   site: { east: number, north: number, radius: number }, env: SiteEnv, roads?: number[], ledger?: IdLedger,
 *   protectedKeys?: number[], published?: Building[], params?: { size?: number, density?: number, bands?: number, sectors?: number, open?: number } }} input
 * @returns {{ plan: SettlementPlan, ledger: IdLedger, report: any }}
 */
export function generateSettlement(input) {
  const { place, origin, seed, site, env, roads = [], params = {} } = input;
  const A = SETTLEMENT_ARCHETYPES[input.archetype], st = SETTLEMENT_STYLES[input.style];
  if (!A) throw new RangeError(`no settlement archetype '${input.archetype}' (settlementStyles.js SETTLEMENT_ARCHETYPES)`);
  if (!st) throw new RangeError(`no settlement style '${input.style}' (settlementStyles.js SETTLEMENT_STYLES)`);
  const rng = (...ns) => hash32(seed >>> 0, place >>> 0, ...ns) / 0x100000000;
  const pick = (range, ...ns) => range[0] + (range[1] - range[0]) * rng(...ns);
  const density = clamp(params.density ?? 1, 0.5, 2), sizeK = clamp(params.size ?? 1, 0.5, 2), openShare = clamp(params.open ?? 0.08, 0, 0.9);

  // A - the site and its layout: a ring round a square, or a row along an arc
  const ground = readSite(env, site);
  let layout = A.frame, centre = A.centre;
  if (layout === 'auto') {
    if (ground.hill > 3) [layout, centre] = ['ring', 'high'];
    else if (Math.hypot(...ground.grad) > 0.08) [layout, centre] = ['row', 'contour'];
    else [layout, centre] = ['ring', 'site'];
  }
  const ring = layout === 'ring';
  const shore = centre === 'water' ? findShore(env, site) : null;
  if (centre === 'water' && !shore) centre = 'contour';
  const islands = A.islands || st.deck > 0;
  const deck = islands ? Math.max(st.deck, A.islands ? 1.4 : 0) : 0;
  const ws = st.street, wl = st.lane, gap = islands ? ISLAND_GAP : 0;
  const plotDepth = pick(st.depth, 1);
  const bandDepth = ws + plotDepth + st.back + gap;
  const bands = clamp(Math.round(params.bands ?? A.bands), 1, 8);
  const size = pick(A.size, 3) * sizeK * (A.frame === 'auto' && !ring ? 2.2 : 1);   // an auto village's size is a radius
  const sectors = clamp(Math.round(params.sectors ?? (ring ? pick(A.sectors, 2) : size / 28)), ring ? 3 : 2, 16);
  const depthAll = bands * bandDepth;

  let frame, inner, uStart, uSpan, vOut = 0;
  if (ring) {
    const c = centre === 'high' ? searchCentre(env, site, 'high') : centre === 'low' ? searchCentre(env, site, 'low') : [site.east, site.north];
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
      const sag = R0 * (1 - Math.cos(size / (R0 + depthAll / 2) / 2)), back = shore.at - 2 - sag;
      const at = [site.east + shore.dir[0] * back, site.north + shore.dir[1] * back];
      c = [at[0] + shore.dir[0] * R0, at[1] + shore.dir[1] * R0];
      toward = [-shore.dir[0], -shore.dir[1]];
      vOut = -(Math.min(12, shore.at) + sag);
    } else {
      const g = ground.grad, gl = Math.hypot(...g), side = rng(14) < 0.5 ? 1 : -1;   // the arc bends round a hollow or a spur
      const up = gl > 1e-6 ? [g[0] / gl, g[1] / gl] : [Math.sin(rng(4) * TAU), Math.cos(rng(4) * TAU)];
      toward = [up[0] * side, up[1] * side];
      c = [site.east - toward[0] * (R0 + depthAll / 2), site.north - toward[1] * (R0 + depthAll / 2)];
    }
    frame = polarFrame(c);
    inner = R0;
    uSpan = size / (R0 + depthAll / 2);
    uStart = bearingOf(toward[0], toward[1]) - uSpan / 2;
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
      for (let j = 0; j < sectors; j++) { const d = Math.abs(Math.atan2(Math.sin(midOf(j) - w), Math.cos(midOf(j) - w))); if (d < bd) { bd = d; best = j; } }
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
    cells.set('plaza', { id: 'plaza', k: 0, j: -1, a: 0, b: r, poly: us.filter((u) => u < uStart + TAU - 1e-9).map((u) => frame.toW(u, r)) });
  }

  // natural ground under each cell; a cut cell under water is dropped
  const made = cells.size;
  for (const c of cells.values()) {
    const samples = c.poly.filter((_, i) => i % 2 === 0);
    samples.push(centroid(c.poly));
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
    const run = Math.hypot(b[0] - a[0], b[1] - a[1]);
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

  // D - each band's street along its inner edge, each sector's lane; districts by sector
  const streets = [], plots = [], features = [], districts = [];
  for (let j = 0; j < sectors; j++) {
    const [u0, u1] = edges[j], r0 = ring ? inner : inner + vOut;
    const poly = [...along(frame, grids[j], u0, u1, outR(j)), ...(r0 > 1 ? along(frame, grids[j], u0, u1, r0).reverse() : [frame.c])];
    districts.push({ id: `d${j}`, purpose: gateSectors.includes(j) ? 'market' : 'residential', poly: dedupe(poly) });
  }
  for (const c of cells.values()) {
    if (c.k < 1) continue;
    const r = c.a + ws / 2, e0 = c.u0 + inset(r, gap / 2 + 0.5), e1 = c.u1 - inset(r, gap / 2 + 0.5);
    streets.push({ id: `s${c.k}.${c.j}`, rank: c.k === 1 ? 'main' : 'side', width: ws, pad: c.id, path: along(frame, grids[c.j], e0, e1, r) });
    const lu = (v) => c.u0 + inset(v, gap / 2 + wl / 2);
    streets.push({ id: `w${c.k}.${c.j}`, rank: gateSectors.includes(c.j) ? 'main' : 'alley', width: wl, pad: c.id, path: [frame.toW(lu(c.a + 0.5), c.a + 0.5), frame.toW(lu(c.b - 0.5), c.b - 0.5)] });
  }

  // E, F - plots behind each street; a building on each big enough, its door to the street
  const proposed = [];
  for (const c of [...cells.values()].sort((x, y) => (x.k - y.k) || (x.j - y.j))) {
    if (c.k < 1) continue;
    const rf = c.a + ws, depth = Math.min(plotDepth, c.b - st.back - rf);
    if (depth < st.depth[0] * 0.7) continue;
    const us = c.u0 + inset(rf, gap / 2 + wl), ue = c.u1 - inset(rf, gap / 2);
    const n = Math.floor(((ue - us) * rf) / (pick(st.frontage, 8, c.k, c.j) / density));
    if (n < 1) continue;
    for (const [s0, s1] of splits(rng, n, ue - us, 9 + c.k * 31 + c.j)) {
      const p0 = us + s0, p1 = us + s1, i = plots.length;
      const id = `${c.id}.p${plots.filter((p) => p.pad === c.id).length}`;
      const poly = [...along(frame, grids[c.j], p0, p1, rf), ...along(frame, grids[c.j], p0, p1, rf + depth).reverse()];
      plots.push({ id, pad: c.id, poly, street: `s${c.k}.${c.j}`, district: `d${c.j}` });
      // a chord sags inside its arc: the front wall's across the whole plot, the plot's back edge's across one grid step
      const half = (p1 - p0) / 2, sag = rf * (1 - Math.cos(half));
      const step = (c.u1 - c.u0) / Math.max(1, grids[c.j].length - 1), backSag = (rf + depth) * (1 - Math.cos(Math.min(half, step / 2)));
      const set = 0.5 + rng(16, i) * 1.2;
      const r1 = rf + set + sag, bd = Math.min(depth - set - 0.05 - sag - backSag, pick(st.depth, 10, i)), r2 = r1 + bd;
      const g = st.gap / 2, q0 = (r) => p0 + inset(r, g), q1 = (r) => p1 - inset(r, g);
      const fp = [frame.toW(q0(r1), r1), frame.toW(q1(r1), r1), frame.toW(q1(r2), r2), frame.toW(q0(r2), r2)];
      const width = Math.hypot(fp[1][0] - fp[0][0], fp[1][1] - fp[0][1]);
      if (width < 5 || bd < 5 || rng(17, i) < openShare) {
        features.push({ id: `g${features.length}`, kind: 'garden', pad: c.id, at: centroid(poly) });
        continue;
      }
      const door = /** @type {Pt} */ ([cm((fp[0][0] + fp[1][0]) / 2), cm((fp[0][1] + fp[1][1]) / 2)]);
      const facing = degrees(bearingOf(-Math.sin((p0 + p1) / 2), -Math.cos((p0 + p1) / 2)));   // toward the street: the frame's centre
      const prestige = (1 - (c.k - 1) / Math.max(1, bands)) * 0.6 + (gateSectors.includes(c.j) ? 0.3 : 0) + rng(11, i) * 0.1;
      proposed.push({ id, c, fp, door, facing, prestige, area: width * bd });
    }
  }
  const mound = cells.get('mound');
  if (mound) {
    const gb = mound.gb, fp = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx, dz]) => frame.toW(gb + Math.atan2(dx, dz), keepHalf * Math.SQRT2));
    const door = /** @type {Pt} */ ([cm((fp[2][0] + fp[3][0]) / 2), cm((fp[2][1] + fp[3][1]) / 2)]);
    proposed.unshift({ id: 'keep', c: mound, fp, door, facing: degrees(gb), prestige: 2, area: 4 * keepHalf * keepHalf, keep: true });
  }

  // the services take their plots: near the square (the inner bands), near a gate, or the best left
  const T = BUILDING_TYPES, taken = new Map();
  if (mound) taken.set('keep', { type: T.Palace, factionId: 0 });
  const order = [...proposed].sort((x, y) => y.prestige - x.prestige || (x.id < y.id ? -1 : 1));
  for (const s of A.services) {
    const score = (p) => (s.near === 'plaza' ? -p.c.k : s.near === 'gate' ? (gateSectors.includes(p.c.j) ? 10 : 0) + (ring ? p.c.k : -p.c.k) : 0) * 10 + p.prestige + (s.type === 'Temple' ? p.area / 100 : 0);
    const free = order.filter((p) => !taken.has(p.id));
    if (!free.length) break;
    const best = free.reduce((x, y) => (score(y) > score(x) ? y : x));
    const type = T[s.type];
    taken.set(best.id, { type, factionId: type === T.Temple ? st.temple : s.guild ? GUILD_FACTION_IDS[s.guild] : 0 });
  }
  const buildings = proposed.map((p, i) => {
    const t = taken.get(p.id) ?? { type: p.prestige > 0.75 ? T.House2 : T.House1, factionId: 0 };
    return /** @type {Building} */ ({
      key: 0, source: 'procedural', anchor: p.id, pad: p.c.id, at: centroid(p.fp), yaw: p.facing, lift: 0, footprint: p.fp,
      storeys: p.keep ? st.storeys[1] + 1 : clamp(Math.round(pick(st.storeys, 12, i) + (p.prestige > 0.8 ? 1 : 0)), 1, st.storeys[1] + 1),
      exterior: { kind: 'procedural', style: input.style }, interior: { kind: 'generated', plan: p.id }, entrances: [{ n: 0, at: p.door, facing: p.facing }],
      type: t.type, factionId: t.factionId, quality: clamp(Math.round(1 + 19 * (A.wealth * 0.6 + Math.min(1, p.prestige) * 0.4)), 1, 20),
      nameSeed: hash32(place >>> 0, ...[...p.id].map((ch) => ch.charCodeAt(0))) & 0x7fffffff, access: isResidence(t.type) ? 'private' : 'public',
    });
  });

  // G - the square's feature, the yards' trees, the walls and towers, the docks
  if (cells.has('plaza')) features.push({ id: 'centre', kind: A.centreFeature, pad: 'plaza', at: frame.toW(uStart + 0.3, Math.min(inner * 0.7, inner - 2)) });
  for (const c of cells.values()) {
    if (c.k < 1) continue;
    for (let t = 0; t < 3; t++) if (rng(13, c.k, c.j, t) < 0.5) features.push({ id: `t${c.id}.${t}`, kind: 'tree', pad: c.id, at: frame.toW(c.u0 + (c.u1 - c.u0) * (0.25 + t * 0.25), c.b - st.back / 2) });
  }
  const allStops = grids.flat().filter((u, i, a) => i === 0 || u - a[i - 1] > 1e-9);
  const footprint = dedupe([...edges.flatMap(([u0, u1], j) => along(frame, grids[j], u0, u1, outR(j))),
    ...(ring ? [] : along(frame, allStops, uStart, uStart + uSpan, inner + vOut).reverse())]);
  if (A.wall && ring) {
    for (let j = 0; j < sectors; j++) {
      if (gateSectors.includes(j)) continue;
      const jn = (j + 1) % sectors, jp = (j + sectors - 1) % sectors;
      features.push({ id: `wall${j}`, kind: 'wall', path: [...along(frame, grids[j], edges[j][0], edges[j][1], outR(j)), frame.toW(edges[j][1], outR(jn))] });
      features.push({ id: `tower${j}`, kind: 'tower', at: frame.toW(edges[j][0], Math.min(outR(j), outR(jp))) });
    }
  }
  if (A.docks && !ring && vOut < 0) {
    const n = Math.max(1, Math.floor(size / 24));
    for (let i = 0; i < n; i++) {
      const u = uStart + (uSpan * (i + 0.5)) / n;
      features.push({ id: `dock${i}`, kind: 'dock', path: [frame.toW(u, inner), frame.toW(u, inner + vOut + 0.5)] });
    }
  }

  const ids = reconcileBuildingIds(input.ledger ?? emptyIdLedger(place), buildings, { protectedKeys: input.protectedKeys, published: input.published });
  const gates = gateSectors.filter((j) => cells.has(cellId(gateBand, j))).map((j, i) => {
    const c = cells.get(cellId(gateBand, j));
    const v = ring ? c.b - 1 : c.a + ws / 2;
    const u = ring ? c.u0 + inset(v, gap / 2 + wl / 2) : j === 0 ? c.u0 + inset(v, gap / 2 + 1) : c.u1 - inset(v, gap / 2 + 1);
    return { id: `gate${i}`, pad: c.id, at: frame.toW(u, v) };
  });
  /** @type {SettlementPlan} */
  const plan = {
    contract: SETTLEMENT_CONTRACT_VERSION, place, source: 'procedural', generator: { id: GENERATOR_ID, version: GENERATOR_VERSION, seed: seed >>> 0 }, revision: 0,
    origin, footprint, pads, links: planLinks, gates, streets, districts, buildings: ids.buildings, plots, features,
  };
  const cut = [...cells.values()].filter((c) => !c.raised).map((c) => Math.abs(c.h - c.natural));
  const problems = validateSettlement(plan);
  // fit: a site the archetype cannot stand on (a cut town on a marsh, a cliff) lays out too little or cuts too deep
  const fit = { kept: made ? cm(kept.length / made) : 0, buildings: buildings.length, least: A.services.length + 2, cutMax: cm(Math.max(0, ...cut)), cutLimit: cm(CUT_STEPS_MAX * st.terrace) };
  return {
    plan, ledger: ids.ledger,
    report: {
      ok: !problems.length && !ids.conflicts.length && fit.buildings >= fit.least && fit.cutMax <= fit.cutLimit, fit,
      layout, centre: frame.c, datum, problems, conflicts: ids.conflicts,
      counts: { pads: pads.length, links: planLinks.length, plots: plots.length, buildings: buildings.length, features: features.length },
      services: buildings.filter((b) => !isResidence(b.type)).length, relief: pads.length ? cm(Math.max(...pads.map((p) => p.y)) - Math.min(...pads.map((p) => p.y))) : 0,
    },
  };
}

const degrees = (/** @type {number} */ rad) => cm((((rad * 180) / Math.PI) % 360 + 360) % 360);

/** @param {readonly Pt[]} ring */
function centroid(ring) {
  return /** @type {Pt} */ ([cm(ring.reduce((s, p) => s + p[0], 0) / ring.length), cm(ring.reduce((s, p) => s + p[1], 0) / ring.length)]);
}

/** A ring with no point within 5 cm of the one before it (two sectors' radii a hair apart). @param {Pt[]} ring */
function dedupe(ring) {
  const out = [];
  for (const p of ring) { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.05) out.push(p); }
  while (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= 0.05) out.pop();
  return out;
}
