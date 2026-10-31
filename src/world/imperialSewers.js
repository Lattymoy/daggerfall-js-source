// @ts-check
// IC-GRAND (2026-10-26; the team's spec forwarded by the owner, URBANIZER 4: "(Imperial city only) Sewage system (that will
// be used for creating Sewers in the future)"; bible/03-World/Arena-Provinces.md IC-GRAND) - THE IMPERIAL CITY'S SEWERS,
// laid out as a law and its data now so a later slice can make them a place to walk: no tunnel stands yet, only the
// covers in the streets (world/imperialFabricModels.js) and what this module answers.
//
//   - THE MAINS run under the city's roads (world/imperialCity.js imperialRoads): one under each avenue and each radial,
//     from Green Emperor Way out to the city wall, falling outward (MAIN_FALL); one under each ring road, falling from the
//     middle of each run between two radials toward both (RING_FALL), into the radial it meets above that radial's own
//     invert (RING_DROP); one under Green Emperor Way, into the six avenues' heads.
//   - THE OUTFALLS: each radial's main runs on past the city wall under the isle as a culvert to the lake at its bearing -
//     at the isle's shore, or the Waterfront's quay's edge where its bearing reaches the quay (outfallAt) - and pours into
//     Lake Rumare there.
//   - THE BRANCHES run under the districts' own streets (world/imperialFabric.js - its lanes and wider; never its alleys),
//     shallow, each draining to the main under the nearest road.
//   - THE COVERS: a manhole on a main every MANHOLE_EVERY along its road's middle, a grate at each kerb beside it; a
//     manhole on a branch every BRANCH_MANHOLE.
// Pure: every answer is the city's metres (x east, z south) and depths under the street's ground (metres down to the
// sewer's floor, its invert).
import { IMPERIAL, imperialRoads, polar, imperialBearing, imperialLand, pointSeg } from './imperialCity.js';
import { fabricStreetsIn } from './imperialFabric.js'; // the branches under the districts' own streets

/** The sewers' measures: a main's width and height, a branch's; a main's invert under Green Emperor Way, its fall a metre
 *  out; a ring's fall a metre along toward a radial, its drop into one; a branch's depth; the covers' spacing. */
export const IMPERIAL_SEWERS = Object.freeze({
  main: Object.freeze({ w: 2.4, h: 2.8 }),
  branch: Object.freeze({ w: 1.2, h: 1.6 }),
  headDepth: 5,
  MAIN_FALL: 1 / 500,
  RING_FALL: 1 / 1000,
  RING_DROP: 0.6,
  branchDepth: 2.6,
  manholeEvery: 60,
  branchManhole: 40,
  coverR: 0.6,
  gateOut: 0.4,
});
const S = IMPERIAL_SEWERS;

/** A main's depth at a distance out along a radial (its invert under the street). */
export const radialDepthAt = (r) => S.headDepth + Math.max(0, r - IMPERIAL.way.r0) * S.MAIN_FALL;

/** THE OUTFALL'S END of a radial's culvert at its bearing: the lake's edge - the isle's shore, or the Waterfront's quay
 *  where its bearing reaches the quay - the last point on land out along the bearing from the city wall (a walk of 4 m
 *  steps), its mouth on the shore and the water a step on. */
export function outfallAt(b, I = IMPERIAL) {
  let r = I.cityWall.r + 20;
  while (r < I.lake && imperialLand(...polar(b, r), I)) r += 4;
  return polar(b, r - 4); // the last step on land: its mouth on the shore, the water a step on
}

let _mains = null;
/**
 * THE MAINS - each `{ id, kind, path, depth0, depth1, w, h, into }`: its path (points, the city's metres) from its head to
 * where it pours, its invert's depth at each end, its section, and the main or outfall it pours into (`into`: an id, or
 * 'lake'). Radials (and avenues) from Green Emperor Way to the city wall, their culverts on to the lake; ring roads in
 * runs from the middle between two radials to each; Green Emperor Way in six runs into the avenues' heads. Made once.
 */
export function imperialSewerMains(I = IMPERIAL) {
  if (_mains && I === IMPERIAL) return _mains;
  const roads = imperialRoads(I),
    out = [];
  const radials = roads.filter((r) => r.kind === 'avenue' || r.kind === 'radial').sort((a, b) => a.b - b.b);
  for (const rd of radials) {
    const head = rd.kind === 'avenue' ? (I.way.r0 + I.way.r1) / 2 : I.palaceWall.r + 10,
      end = I.cityWall.r;
    const id = `${rd.kind}:${rd.b}`;
    out.push({
      id,
      kind: 'radial',
      b: rd.b,
      path: [polar(rd.b, head), polar(rd.b, end)],
      depth0: radialDepthAt(head),
      depth1: radialDepthAt(end),
      w: S.main.w,
      h: S.main.h,
      into: `outfall:${rd.b}`,
    });
    const fall = outfallAt(rd.b, I),
      rEnd = Math.hypot(...fall);
    out.push({
      id: `outfall:${rd.b}`,
      kind: 'outfall',
      b: rd.b,
      path: [polar(rd.b, end), fall],
      depth0: radialDepthAt(end),
      depth1: radialDepthAt(rEnd),
      w: S.main.w,
      h: S.main.h,
      into: 'lake',
    });
  }
  // the rings: a run from the middle between two radials to each of them
  for (const ring of roads.filter((r) => r.kind === 'ring' || r.kind === 'way')) {
    const meets = ring.kind === 'way' ? radials.filter((rd) => rd.kind === 'avenue') : radials;
    for (let k = 0; k < meets.length; k++) {
      const a = meets[k].b,
        b = k + 1 < meets.length ? meets[k + 1].b : meets[0].b + 360,
        mid = (a + b) / 2;
      const span = ((b - a) / 2) * (Math.PI / 180) * ring.r; // metres from the middle to either radial
      const dJoin = radialDepthAt(ring.r) - S.RING_DROP,
        dMid = Math.max(1.5, dJoin - span * S.RING_FALL);
      for (const { to, rb } of [
        { to: meets[k], rb: a },
        { to: k + 1 < meets.length ? meets[k + 1] : meets[0], rb: b },
      ]) {
        const path = [];
        for (let i = 0; i <= 8; i++) path.push(polar(mid + ((rb - mid) * i) / 8, ring.r));
        out.push({
          id: `${ring.kind}:${ring.r}:${mid.toFixed(1)}>${to.b}`,
          kind: ring.kind === 'way' ? 'way' : 'ring',
          r: ring.r,
          path,
          depth0: dMid,
          depth1: dJoin,
          w: S.main.w,
          h: S.main.h,
          into: `${to.kind}:${to.b}`,
        });
      }
    }
  }
  const frozen = Object.freeze(
    out.map((m) => Object.freeze({ ...m, path: Object.freeze(m.path.map((p) => Object.freeze(p))) })),
  );
  if (I === IMPERIAL) _mains = frozen;
  return frozen;
}
/** THE OUTFALLS: each culvert's end at the lake - `{ id, at, b }`. */
export const imperialSewerOutfalls = (I = IMPERIAL) =>
  imperialSewerMains(I)
    .filter((m) => m.kind === 'outfall')
    .map((m) => Object.freeze({ id: m.id, at: m.path[m.path.length - 1], b: m.b }));

/** A main's depth at a point along it (its nearest point's share of the way from its head). */
export function mainDepthAt(m, x, z) {
  let best = Infinity,
    at = 0,
    total = 0;
  const lens = [];
  for (let i = 0; i + 1 < m.path.length; i++) {
    const l = Math.hypot(m.path[i + 1][0] - m.path[i][0], m.path[i + 1][1] - m.path[i][1]);
    lens.push(l);
    total += l;
  }
  let run = 0;
  for (let i = 0; i + 1 < m.path.length; i++) {
    const a = m.path[i],
      b = m.path[i + 1],
      d = pointSeg(x, z, a, b);
    if (d < best) {
      const l2 = lens[i] ** 2,
        t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) / l2)) : 0;
      best = d;
      at = run + t * lens[i];
    }
    run += lens[i];
  }
  return m.depth0 + (m.depth1 - m.depth0) * (total ? at / total : 0);
}

/**
 * THE COVERS on the mains a rectangle of the city's metres holds - `{ at, kind, main }`: a manhole every MANHOLE_EVERY along
 * each main's path (inside the city wall; an outfall's culvert under the isle has none) and a grate at each kerb beside
 * it, `gateOut` short of the road's edge.
 */
export function sewerCoversIn(x0, z0, x1, z1, I = IMPERIAL) {
  const out = [],
    roads = imperialRoads(I);
  const widthOf = (m) =>
    (m.kind === 'radial'
      ? roads.find((r) => (r.kind === 'avenue' || r.kind === 'radial') && r.b === m.b)?.w
      : roads.find((r) => (r.kind === 'ring' || r.kind === 'way') && r.r === m.r)?.w) ?? 16;
  for (const m of imperialSewerMains(I)) {
    if (m.kind === 'outfall') continue;
    const w = widthOf(m);
    for (let i = 0; i + 1 < m.path.length; i++) {
      const a = m.path[i],
        b = m.path[i + 1],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (
        Math.max(a[0], b[0]) < x0 - w ||
        Math.min(a[0], b[0]) > x1 + w ||
        Math.max(a[1], b[1]) < z0 - w ||
        Math.min(a[1], b[1]) > z1 + w
      )
        continue;
      const t = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
        n = [-t[1], t[0]];
      // the covers at whole spacings along the main from its head, so two runs that share a point share its cover
      for (
        let s = Math.ceil(1e-6 + runBefore(m, i) / S.manholeEvery) * S.manholeEvery - runBefore(m, i);
        s < len;
        s += S.manholeEvery
      ) {
        const p = [a[0] + t[0] * s, a[1] + t[1] * s];
        if (p[0] < x0 || p[0] >= x1 || p[1] < z0 || p[1] >= z1) continue;
        out.push({ at: p, kind: 'manhole', main: m.id });
        for (const side of [1, -1])
          out.push({
            at: [p[0] + n[0] * side * (w / 2 - S.gateOut), p[1] + n[1] * side * (w / 2 - S.gateOut)],
            kind: 'grate',
            main: m.id,
          });
      }
    }
  }
  return out;
}
/** A main's run up to its i-th point. */
function runBefore(m, i) {
  let s = 0;
  for (let k = 0; k < i; k++) s += Math.hypot(m.path[k + 1][0] - m.path[k][0], m.path[k + 1][1] - m.path[k][1]);
  return s;
}

/** The main under a point's road (within its road's half-width), or null - the one a branch or a grate pours into. */
export function mainUnder(x, z, pad = 0, I = IMPERIAL) {
  let best = null,
    bd = Infinity;
  for (const m of imperialSewerMains(I)) {
    if (m.kind === 'outfall') continue;
    for (let i = 0; i + 1 < m.path.length; i++) {
      const d = pointSeg(x, z, m.path[i], m.path[i + 1]);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
  }
  return bd <= S.main.w / 2 + pad ? best : null;
}
/** The nearest main to a point - where a branch there drains. */
export function nearestMain(x, z, I = IMPERIAL) {
  let best = null,
    bd = Infinity;
  for (const m of imperialSewerMains(I)) {
    if (m.kind === 'outfall') continue;
    for (let i = 0; i + 1 < m.path.length; i++) {
      const d = pointSeg(x, z, m.path[i], m.path[i + 1]);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
  }
  return best;
}
/** The bearing a point is at, for a branch's record. */
export const sewerBearing = (x, z) => imperialBearing(x, z);

/**
 * A CELL'S BRANCHES (row r, column c of the plan): under each of its streets a lane or wider (world/imperialFabric.js
 * fabricStreetsIn), `{ a, b, depth, w, drainsTo }` - shallow, draining to the nearest main - and their manholes, one every
 * BRANCH_MANHOLE along each branch.
 */
export function sewerBranchesIn(r, c) {
  const branches = fabricStreetsIn(r, c).map((s) => {
    const m = nearestMain((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2);
    return Object.freeze({
      a: s.a,
      b: s.b,
      w: S.branch.w,
      depth: S.branchDepth,
      drainsTo: m?.id ?? null,
      street: s.kind,
    });
  });
  const covers = [];
  for (const br of branches) {
    const len = Math.hypot(br.b[0] - br.a[0], br.b[1] - br.a[1]);
    for (let s = S.branchManhole / 2; s < len; s += S.branchManhole)
      covers.push({
        at: [br.a[0] + ((br.b[0] - br.a[0]) * s) / len, br.a[1] + ((br.b[1] - br.a[1]) * s) / len],
        kind: 'manhole',
        main: br.drainsTo,
      });
  }
  return { branches, covers };
}
