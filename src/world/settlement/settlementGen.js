// @ts-check
// RMB-CONTRACTS RMBC2 (2026-10-31, bible/03-World/RMB-Contracts.md): A SETTLEMENT LAID OUT ON ITS GROUND. A ring town wraps
// a square; a row town follows an arc - round a hillside, along a shore. Its layout (settlementLayout.js, stages A to C) cuts
// it into cells, each a flat pad near its natural height, terraced so every step is climbable. This dresses a layout -
// streets, plots, a building on each plot big enough, the archetype's services on the best of them, features, keys -
// and checks the plan. Deterministic from its inputs on every engine (exactMath.js, RD-13). Not a DFU member.
import { hash32 } from '../blockHash.js';
import { dsin, dcos, datan2, dhypot } from './exactMath.js';
import { BUILDING_TYPES, isResidence } from '../buildingNames.js';
import { GUILD_FACTION_IDS, DIVINES } from '../../systems/guild/guildFactions.js';
import { SETTLEMENT_CONTRACT_VERSION, validateSettlement } from './settlementContract.js';
import { emptyIdLedger, reconcileBuildingIds, anchorLedger } from './settlementIds.js';
import { SETTLEMENT_STYLES, SETTLEMENT_ARCHETYPES } from './settlementStyles.js';
import { layoutSettlement, polarFrame, along, splits, cm, clampWithin, compassBearing, ringCentroid, TAU, GENERATOR_ID, SETTLEMENT_GENERATOR_VERSION, CUT_STEPS_MAX } from './settlementLayout.js';

export { GENERATOR_ID, SETTLEMENT_GENERATOR_VERSION, ARC_STEP, ISLAND_GAP, DECK_CLEAR, ROW_RADIUS, SHORE_RADIUS, layoutSettlement } from './settlementLayout.js';

/** @typedef {import('./settlementContract.js').SettlementPlan} SettlementPlan @typedef {import('./settlementContract.js').Building} Building */
/** @typedef {import('./settlementIds.js').IdLedger} IdLedger @typedef {readonly [number, number]} Pt */
const LAYOUT_OF = (input) => layoutSettlement(input, /** @type {any} */ (input.env));
/**
 * Lay out a settlement: its layout on `input.env`, dressed.
 * @param {import('./settlementLayout.js').SettlementInput} input
 * @returns {{ plan: SettlementPlan, ledger: IdLedger, report: any }}
 */
export const generateSettlement = (input) => dressSettlement(input, LAYOUT_OF(input));

/**
 * Stages D to G on a layout: the terrain worker's, or layoutSettlement's.
 * @param {import('./settlementLayout.js').SettlementInput} input @param {ReturnType<typeof layoutSettlement>} L
 * @returns {{ plan: SettlementPlan, ledger: IdLedger, report: any }}
 */
/** ORGANIC: whether a road's bearing (a cell's `road`, in [0, a turn)) falls within a plot's span widened by `margin`.
 *  @param {readonly number[]} road @param {number} start @param {number} end @param {number} margin */
export function onRoad(road, start, end, margin) {
  for (const bearing of road) for (const turn of [-TAU, 0, TAU, 2 * TAU]) if (bearing + turn >= start - margin && bearing + turn <= end + margin) return true;
  return false;
}

export function dressSettlement(input, L) {
  const { place, origin, seed, params = {} } = input;
  const A = SETTLEMENT_ARCHETYPES[input.archetype], st = SETTLEMENT_STYLES[input.style];
  if (!A) throw new RangeError(`no settlement archetype '${input.archetype}' (settlementStyles.js SETTLEMENT_ARCHETYPES)`);
  if (!st) throw new RangeError(`no settlement style '${input.style}' (settlementStyles.js SETTLEMENT_STYLES)`);
  const rng = (...ns) => hash32(seed >>> 0, place >>> 0, ...ns) / 0x100000000;
  const pick = (range, ...ns) => range[0] + (range[1] - range[0]) * rng(...ns);
  // RMBC9: each district draws from its own seed (the editor's `districtSeeds`), each plot by its own cell and number
  const rngOf = (/** @type {number} */ j) => { const base = (input.districtSeeds?.[`d${j}`] ?? seed) >>> 0; return (/** @type {number[]} */ ...salt) => hash32(base, place >>> 0, ...salt) / 0x100000000; };
  const density = clampWithin(params.density ?? 1, 0.5, 2), openShare = clampWithin(params.open ?? 0.08, 0, 0.9);
  const frame = polarFrame(L.c), inset = (v, s) => frame.du(s, v);
  const { ring, inner, uStart, uSpan, vOut, edges, radii, reachOf, grids, gateSectors, gateBand, gap, ws, wl, plotDepth, bands, sectors, size, keepHalf, made, datum, pads, layout } = L;
  const planLinks = L.links;
  const cells = new Map(L.cells.map((c) => [c.id, c]));
  const outR = (j) => radii[j][reachOf[j]];
  const cellId = (k, j) => (k === 0 ? 'plaza' : `c${k}.${j}`);
  const kept = { length: L.keptCount };

  // D - each band's street along its inner edge, each sector's lane; districts by sector
  const streets = [], plots = [], features = [], districts = [];
  for (let j = 0; j < sectors; j++) {
    if (L.core && reachOf[j] < 1) continue;   // ORGANIC: a sector its town's roads left unbuilt is no district
    const [u0, u1] = edges[j], r0 = L.core ? radii[j][0] : ring ? inner : inner + vOut;
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
    const draw = rngOf(c.j), choose = (/** @type {readonly number[]} */ range, /** @type {number[]} */ ...salt) => range[0] + (range[1] - range[0]) * draw(...salt);
    const n = Math.floor(((ue - us) * rf) / (choose(st.frontage, 8, c.k, c.j) / density));
    if (n < 1) continue;
    for (const [s0, s1] of splits(draw, n, ue - us, 9 + c.k * 31 + c.j)) {
      const p0 = us + s0, p1 = us + s1, local = plots.filter((p) => p.pad === c.id).length;
      if (c.road && onRoad(c.road, p0, p1, inset(rf, 3))) continue;   // ORGANIC: the road runs here - its plots either side
      const id = `${c.id}.p${local}`;
      const poly = [...along(frame, grids[c.j], p0, p1, rf), ...along(frame, grids[c.j], p0, p1, rf + depth).reverse()];
      plots.push({ id, pad: c.id, poly, street: `s${c.k}.${c.j}`, district: `d${c.j}` });
      // a chord sags inside its arc: the front wall's across the whole plot, the plot's back edge's across one grid step
      const half = (p1 - p0) / 2, sag = rf * (1 - dcos(half));
      const step = (c.u1 - c.u0) / Math.max(1, grids[c.j].length - 1), backSag = (rf + depth) * (1 - dcos(Math.min(half, step / 2)));
      const set = 0.5 + draw(16, c.k, c.j, local) * 1.2;
      const r1 = rf + set + sag, bd = Math.min(depth - set - 0.05 - sag - backSag, choose(st.depth, 10, c.k, c.j, local)), r2 = r1 + bd;
      const g = st.gap / 2, q0 = (r) => p0 + inset(r, g), q1 = (r) => p1 - inset(r, g);
      const fp = [frame.toW(q0(r1), r1), frame.toW(q1(r1), r1), frame.toW(q1(r2), r2), frame.toW(q0(r2), r2)];
      const width = dhypot(fp[1][0] - fp[0][0], fp[1][1] - fp[0][1]);
      if (width < 5 || bd < 5 || draw(17, c.k, c.j, local) < openShare) {
        features.push({ id: `g${id}`, kind: 'garden', pad: c.id, at: ringCentroid(poly) });
        continue;
      }
      const door = /** @type {Pt} */ ([cm((fp[0][0] + fp[1][0]) / 2), cm((fp[0][1] + fp[1][1]) / 2)]);
      const facing = degrees(compassBearing(-dsin((p0 + p1) / 2), -dcos((p0 + p1) / 2)));   // toward the street: the frame's centre
      const prestige = (1 - (c.k - 1) / Math.max(1, bands)) * 0.6 + (gateSectors.includes(c.j) ? 0.3 : 0) + draw(11, c.k, c.j, local) * 0.1;
      proposed.push({ id, c, fp, door, facing, prestige, area: width * bd });
    }
  }
  const mound = cells.get('mound');
  if (mound) {
    const gb = mound.gb, fp = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx, dz]) => frame.toW(gb + datan2(dx, dz), keepHalf * Math.SQRT2));
    const door = /** @type {Pt} */ ([cm((fp[2][0] + fp[3][0]) / 2), cm((fp[2][1] + fp[3][1]) / 2)]);
    proposed.unshift({ id: 'keep', c: mound, fp, door, facing: degrees(gb), prestige: 2, area: 4 * keepHalf * keepHalf, keep: true });
  }

  // the services take their plots: near the square (the inner bands), near a gate, or the best left
  const T = BUILDING_TYPES, taken = new Map();
  if (mound) taken.set('keep', { type: T.Palace, factionId: 0 });
  const order = [...proposed].sort((x, y) => y.prestige - x.prestige || (x.id < y.id ? -1 : 1));
  // RMBC9: a service keeps the plot it was published on while that plot stands - a district regenerated moves no other's
  const was = new Map((input.published ?? []).map((building) => [building.anchor, building.type]));
  for (const s of A.services) {
    const kept = order.find((plot) => !taken.has(plot.id) && was.get(plot.id) === T[s.type]);
    if (kept) { taken.set(kept.id, { type: T[s.type], factionId: T[s.type] === T.Temple ? DIVINES[st.temple] : s.guild ? GUILD_FACTION_IDS[s.guild] : 0 }); continue; }
    const score = (p) => (s.near === 'plaza' ? -p.c.k : s.near === 'gate' ? (gateSectors.includes(p.c.j) ? 10 : 0) + (ring ? p.c.k : -p.c.k) : 0) * 10 + p.prestige + (s.type === 'Temple' ? p.area / 100 : 0);
    const free = order.filter((p) => !taken.has(p.id));
    if (!free.length) break;
    const best = free.reduce((x, y) => (score(y) > score(x) ? y : x));
    const type = T[s.type];
    taken.set(best.id, { type, factionId: type === T.Temple ? DIVINES[st.temple] : s.guild ? GUILD_FACTION_IDS[s.guild] : 0 });
  }
  const buildings = proposed.map((p, i) => {
    const t = taken.get(p.id) ?? { type: p.prestige > 0.75 ? T.House2 : T.House1, factionId: 0 };
    return /** @type {Building} */ ({
      key: 0, source: 'procedural', anchor: p.id, pad: p.c.id, at: ringCentroid(p.fp), yaw: p.facing, lift: 0, footprint: p.fp,
      storeys: p.keep ? st.storeys[1] + 1 : clampWithin(Math.round(pick(st.storeys, 12, i) + (p.prestige > 0.8 ? 1 : 0)), 1, st.storeys[1] + 1),
      exterior: { kind: 'procedural', style: input.style }, interior: { kind: 'generated', plan: p.id }, entrances: [{ n: 0, at: p.door, facing: p.facing }],
      type: t.type, factionId: t.factionId, quality: clampWithin(Math.round(1 + 19 * (A.wealth * 0.6 + Math.min(1, p.prestige) * 0.4)), 1, 20),
      nameSeed: hash32(place >>> 0, ...[...p.id].map((ch) => ch.charCodeAt(0))) & 0x7fffffff, access: isResidence(t.type) ? 'private' : 'public',
    });
  });

  // G - the square's feature, the yards' trees, the walls and towers, the docks
  if (cells.has('plaza') && !L.core) features.push({ id: 'centre', kind: A.centreFeature, pad: 'plaza', at: frame.toW(uStart + 0.3, Math.min(inner * 0.7, inner - 2)) });   // RMBC6: a core is the town's own
  for (const c of cells.values()) {
    if (c.k < 1) continue;
    for (let t = 0; t < 3; t++) if (rngOf(c.j)(13, c.k, c.j, t) < 0.5) features.push({ id: `t${c.id}.${t}`, kind: 'tree', pad: c.id, at: frame.toW(c.u0 + (c.u1 - c.u0) * (0.25 + t * 0.25), c.b - st.back / 2) });
  }
  const allStops = grids.flat().filter((u, i, a) => i === 0 || u - a[i - 1] > 1e-9);
  const footprint = dedupe(L.c, [...edges.flatMap(([u0, u1], j) => along(frame, grids[j], u0, u1, outR(j))),
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

  // RMBC7: a grown town's keys are its anchors' own (RD-19); a published settlement keeps its ledger
  const ledger0 = input.keys === 'anchored' ? anchorLedger(place, buildings.map((b) => b.anchor)) : input.ledger ?? emptyIdLedger(place);
  const ids = reconcileBuildingIds(ledger0, buildings, { protectedKeys: input.protectedKeys, published: input.published });
  const gates = gateSectors.filter((j) => cells.has(cellId(gateBand, j))).map((j, i) => {
    const c = cells.get(cellId(gateBand, j));
    const v = ring ? c.b - 1 : c.a + ws / 2;
    const u = ring ? c.u0 + inset(v, gap / 2 + wl / 2) : j === 0 ? c.u0 + inset(v, gap / 2 + 1) : c.u1 - inset(v, gap / 2 + 1);
    return { id: `gate${i}`, pad: c.id, at: frame.toW(u, v) };
  });
  if (L.core) gates.unshift({ id: 'gate-core', pad: 'plaza', at: /** @type {Pt} */ ([cm(L.core.centre[0]), cm(L.core.centre[1])]) });   // RMBC6: the outskirts' way in is their town
  /** @type {SettlementPlan} */
  const plan = {
    contract: SETTLEMENT_CONTRACT_VERSION, place, source: 'procedural', generator: { id: GENERATOR_ID, version: SETTLEMENT_GENERATOR_VERSION, seed: seed >>> 0 }, revision: 0,
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
      layout, centre: frame.c, shore: L.shore, datum, problems, conflicts: ids.conflicts,
      counts: { pads: pads.length, links: planLinks.length, plots: plots.length, buildings: buildings.length, features: features.length },
      services: buildings.filter((b) => !isResidence(b.type)).length, relief: pads.length ? cm(Math.max(...pads.map((p) => p.y)) - Math.min(...pads.map((p) => p.y))) : 0,
    },
  };
}


const degrees = (/** @type {number} */ rad) => cm((((rad * 180) / Math.PI) % 360 + 360) % 360);

/** A ring with no point within 5 cm of the one before it (two sectors' radii a hair apart). Given the frame's centre `c`, of
 *  two such points the farther from it stays, so an outline still holds every pad behind it.
 *  @param {readonly number[]|null} c @param {Pt[]} [ring] */
function dedupe(c, ring) {
  if (!ring) { ring = /** @type {Pt[]} */ (/** @type {unknown} */ (c)); c = null; }
  const far = (p) => (c ? dhypot(p[0] - c[0], p[1] - c[1]) : 0);
  const near = (p, q) => dhypot(p[0] - q[0], p[1] - q[1]) <= 0.05;
  const out = [];
  for (const p of ring) {
    const q = out[out.length - 1];
    if (!q || !near(p, q)) out.push(p);
    else if (far(p) > far(q)) out[out.length - 1] = p;
  }
  while (out.length > 1 && near(out[0], out[out.length - 1])) { const last = /** @type {Pt} */ (out.pop()); if (far(last) > far(out[0])) out[0] = last; }
  return out;
}
