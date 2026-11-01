// @ts-check
// A SETTLEMENT LAID OUT ON ITS GROUND. A ring town wraps
// a square; a row town follows an arc - round a hillside, along a shore. Its layout (settlementLayout.js, stages A to C) cuts
// it into cells, each a flat pad near its natural height, terraced so every step is climbable. This dresses a layout -
// streets, plots, a building on each plot big enough, the archetype's services on the best of them, features, keys -
// and checks the plan. Deterministic from its inputs on every engine (exactMath.js). Not a DFU member.
import { hash32 } from '../blockHash.js';
import { dsin, dcos, datan2, dhypot } from './exactMath.js';
import { BUILDING_TYPES, isResidence } from '../buildingNames.js';
import { GUILD_FACTION_IDS, DIVINES } from '../../systems/guild/guildFactions.js';
import { SETTLEMENT_CONTRACT_VERSION, validateSettlement } from './settlementContract.js';
import { emptyIdLedger, reconcileBuildingIds, anchorLedger } from './settlementIds.js';
import { SETTLEMENT_STYLES, SETTLEMENT_ARCHETYPES } from './settlementStyles.js';
import { FORT_WALL, FORT_TOWER, FEATURE_CLEAR, MARKET_RING, featureReach } from './settlementLimits.js';
import { distanceToSegment } from './settlementGeometry.js';
import { layoutSettlement, polarFrame, along, splits, cm, clampWithin, compassBearing, ringCentroid, TAU, GENERATOR_ID, SETTLEMENT_GENERATOR_VERSION, CUT_STEPS_MAX, districtDraw, yardTrees, onRoad } from './settlementLayout.js';

export { GENERATOR_ID, SETTLEMENT_GENERATOR_VERSION, ARC_STEP, ISLAND_GAP, DECK_CLEAR, ROW_RADIUS, SHORE_RADIUS, layoutSettlement, yardTrees, onRoad } from './settlementLayout.js';

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
 * Stages D to G on a layout: the terrain worker's, or layoutSettlement's. `check` false skips the contract's check (a host
 * standing a plan its generator's tests and the publish already hold to it).
 * @param {import('./settlementLayout.js').SettlementInput} input @param {ReturnType<typeof layoutSettlement>} L @param {{ check?: boolean }} [opts]
 * @returns {{ plan: SettlementPlan, ledger: IdLedger, report: any }}
 */
export function dressSettlement(input, L, { check = true } = {}) {
  const { place, origin, seed, params = {} } = input;
  const A = SETTLEMENT_ARCHETYPES[input.archetype], st = SETTLEMENT_STYLES[input.style];
  if (!A) throw new RangeError(`no settlement archetype '${input.archetype}' (settlementStyles.js SETTLEMENT_ARCHETYPES)`);
  if (!st) throw new RangeError(`no settlement style '${input.style}' (settlementStyles.js SETTLEMENT_STYLES)`);
  const rngOf = districtDraw(input);   // each plot drawn by its own cell and number
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
    if (L.core && reachOf[j] < 1) continue;   // a sector its town's roads left unbuilt is no district
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
    for (const [local, [s0, s1]] of splits(draw, n, ue - us, 9 + c.k * 31 + c.j).entries()) {   // a plot's number is its split's: one dropped renames none
      const p0 = us + s0, p1 = us + s1;
      if (c.road && onRoad(c.road, p0, p1, inset(rf, 3))) continue;   // the road runs here - its plots either side
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
      proposed.push({ id, c, fp, door, facing, prestige, area: width * bd, tall: choose(st.storeys, 12, c.k, c.j, local) });
    }
  }
  const mound = cells.get('mound');
  if (mound) {
    const gb = mound.gb, fp = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx, dz]) => frame.toW(gb + datan2(dx, dz), keepHalf * Math.SQRT2));
    const door = /** @type {Pt} */ ([cm((fp[2][0] + fp[3][0]) / 2), cm((fp[2][1] + fp[3][1]) / 2)]);
    proposed.unshift({ id: 'keep', c: mound, fp, door, facing: degrees(gb), prestige: 2, area: 4 * keepHalf * keepHalf, keep: true, tall: st.storeys[1] });
  }

  // the services take their plots: near the square (the inner bands), near a gate, or the best left
  const T = BUILDING_TYPES, taken = new Map();
  if (mound) taken.set('keep', { type: T.Palace, factionId: 0 });
  const order = [...proposed].sort((x, y) => y.prestige - x.prestige || (x.id < y.id ? -1 : 1));
  // Every service first keeps the plot it was published on while that plot stands; one whose plot is gone takes a
  // plot drawn afresh (its anchor new, or its district's seed its own) before another district's - so none moves a house
  const was = new Map((input.published ?? []).map((building) => [building.anchor, building.type]));
  const serve = (/** @type {any} */ plot, /** @type {any} */ s) => taken.set(plot.id, { type: T[s.type], factionId: T[s.type] === T.Temple ? DIVINES[st.temple] : s.guild ? GUILD_FACTION_IDS[s.guild] : 0 });
  const homeless = A.services.filter((s) => {
    const kept = order.find((plot) => !taken.has(plot.id) && was.get(plot.id) === T[s.type]);
    if (kept) serve(kept, s);
    return !kept;
  });
  const fresh = (/** @type {any} */ p) => !was.has(p.id) || input.districtSeeds?.[`d${p.c.j}`] !== undefined;
  for (const s of homeless) {
    const score = (p) => (s.near === 'plaza' ? -p.c.k : s.near === 'gate' ? (gateSectors.includes(p.c.j) ? 10 : 0) + (ring ? p.c.k : -p.c.k) : 0) * 10 + p.prestige + (s.type === 'Temple' ? p.area / 100 : 0);
    const free = order.filter((p) => !taken.has(p.id)), open = free.filter(fresh);
    if (!free.length) break;
    serve((open.length ? open : free).reduce((x, y) => (score(y) > score(x) ? y : x)), s);
  }
  const buildings = proposed.map((p) => {
    const t = taken.get(p.id) ?? { type: p.prestige > 0.75 ? T.House2 : T.House1, factionId: 0 };
    return /** @type {Building} */ ({
      key: 0, source: 'procedural', anchor: p.id, pad: p.c.id, at: ringCentroid(p.fp), yaw: p.facing, lift: 0, footprint: p.fp,
      storeys: p.keep ? st.storeys[1] + 1 : clampWithin(Math.round(p.tall + (p.prestige > 0.8 ? 1 : 0)), 1, st.storeys[1] + 1),   // its plot's draw: a neighbour gone re-rolls none
      exterior: { kind: 'procedural', style: input.style }, interior: { kind: 'generated', plan: p.id }, entrances: [{ n: 0, at: p.door, facing: p.facing }],
      type: t.type, factionId: t.factionId, quality: clampWithin(Math.round(1 + 19 * (A.wealth * 0.6 + Math.min(1, p.prestige) * 0.4)), 1, 20),
      nameSeed: hash32(place >>> 0, ...[...p.id].map((ch) => ch.charCodeAt(0))) & 0x7fffffff, access: isResidence(t.type) ? 'private' : 'public',
    });
  });

  // G - the square's feature, the yards' trees, the walls and towers, the docks
  const centre = cells.has('plaza') && !L.core ? centreSpot(A.centreFeature, frame, L, uStart + 0.3, Math.min(inner * 0.7, inner - 2)) : null;   // A core is the town's own
  if (centre) features.push({ id: 'centre', kind: A.centreFeature, pad: 'plaza', at: centre.at, ...(centre.size === undefined ? {} : { size: centre.size }) });
  for (const t of yardTrees(input, L)) features.push({ id: t.id, kind: 'tree', pad: t.pad, at: t.at });
  for (const w of L.walls) features.push({ id: w.id, kind: 'wall', path: w.path, ground: w.ground });
  for (const t of L.towers) features.push({ id: t.id, kind: 'tower', at: t.at, y: t.y });
  for (const d of L.docks) features.push({ id: d.id, kind: 'dock', path: d.path });
  // the outline holds every pad, a fort's walls and towers past its rim, a river town's docks out over its water
  const beyond = L.walls.length + L.towers.length ? FORT_WALL.thick + 2 * FORT_TOWER.r + 3 * FEATURE_CLEAR : 0;
  const outer = (/** @type {number} */ j) => (beyond ? Math.max(outR(j), outR((j + 1) % sectors), outR((j + sectors - 1) % sectors)) + beyond : outR(j));
  const quay = Math.min(inner + vOut, ...L.docks.map((d) => dhypot(d.path[1][0] - L.c[0], d.path[1][1] - L.c[1]) - 1));
  const allStops = grids.flat().filter((u, i, a) => i === 0 || u - a[i - 1] > 1e-9);
  const footprint = dedupe(L.c, [...edges.flatMap(([u0, u1], j) => along(frame, grids[j], u0, u1, outer(j))), ...(ring ? [] : along(frame, allStops, uStart, uStart + uSpan, quay).reverse())]);

  // A grown town's keys are its anchors' own; a published settlement keeps its ledger
  const ledger0 = input.keys === 'anchored' ? anchorLedger(place, buildings.map((b) => b.anchor)) : input.ledger ?? emptyIdLedger(place);
  const ids = reconcileBuildingIds(ledger0, buildings, { protectedKeys: input.protectedKeys, published: input.published });
  const gates = gateSectors.filter((j) => cells.has(cellId(gateBand, j))).map((j, i) => {
    const c = cells.get(cellId(gateBand, j));
    const v = ring ? c.b - 1 : c.a + ws / 2;
    const u = ring ? c.u0 + inset(v, gap / 2 + wl / 2) : j === 0 ? c.u0 + inset(v, gap / 2 + 1) : c.u1 - inset(v, gap / 2 + 1);
    return { id: `gate${i}`, pad: c.id, at: frame.toW(u, v) };
  });
  if (L.core) gates.unshift({ id: 'gate-core', pad: 'plaza', at: /** @type {Pt} */ ([cm(L.core.centre[0]), cm(L.core.centre[1])]) });   // The outskirts' way in is their town
  /** @type {SettlementPlan} */
  const plan = {
    contract: SETTLEMENT_CONTRACT_VERSION, place, source: 'procedural', generator: { id: GENERATOR_ID, version: SETTLEMENT_GENERATOR_VERSION, seed: seed >>> 0 }, revision: 0,
    origin, footprint, pads, links: planLinks, gates, streets, districts, buildings: ids.buildings, plots, features,
  };
  const cut = [...cells.values()].filter((c) => !c.raised).map((c) => Math.abs(c.h - c.natural));
  const problems = check ? validateSettlement(plan) : [];   // unchecked, a host's: the plan is held to the contract where it is made
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


/**
 * The square's feature: at its preferred bearing and distance from the middle, else the nearest that keeps its body on
 * the square, off the keep's mound and clear of every way onto it; a market's ring drawn in on a small square. Null where
 * none fits. @param {string} kind @param {ReturnType<typeof polarFrame>} frame @param {ReturnType<typeof layoutSettlement>} layout
 * @param {number} bearing @param {number} distance
 */
function centreSpot(kind, frame, layout, bearing, distance) {
  const plaza = layout.cells.find((cell) => cell.id === 'plaza'), mound = layout.cells.find((cell) => cell.id === 'mound');
  const rim = Math.min(...plaza.poly.map((corner, i) => distanceToSegment(frame.c, corner, plaza.poly[(i + 1) % plaza.poly.length])));   // its chords' nearest
  const ways = layout.links.filter((link) => link.from === 'plaza' || link.to === 'plaza');
  for (const size of kind === 'market' ? [MARKET_RING, MARKET_RING * 0.85, MARKET_RING * 0.7] : [undefined]) {
    const reach = featureReach({ kind, size }), least = mound ? mound.b + reach + FEATURE_CLEAR : 0, most = rim - reach - FEATURE_CLEAR;
    if (most < least) continue;
    const out = [];
    for (let step = clampWithin(distance, least, most); step > least; step -= 1) out.push(step);
    for (const away of [...out, least]) {
      for (let k = 0; k < (away > 0 ? 48 : 1); k++) {
        const at = frame.toW(bearing + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (TAU / 48), away);
        if (ways.every((link) => distanceToSegment(at, link.a, link.b) >= reach + link.width / 2 + FEATURE_CLEAR)) return { at, size };
      }
    }
  }
  return null;
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
