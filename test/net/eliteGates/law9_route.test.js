// THE ASCENT (LAW 9, 2026-10-16, Mac: "Something that isnt just a straight line from point A to point B";
// bible/11-Multiplayer/Elite-Gates-Ascent.md section 1): THE ROUTE (net/eliteGates/egRoute.js) - the law's one measure of progress, and
// every reader of progress moved onto it: the toll (net/eliteGates/egBrain.js egTollOf), THE FAIR TRAIL's furthest point and its
// cast-back's "back" (net/eliteGates/egFair.js), the Divers' island ahead (net/eliteGates/egLegion.js egIsleAhead), the leading member and the
// Harriers' rise ahead of theirs (net/eliteGates/egBrain.js spanLegion), the Captive's chains (egCaptiveSpots), the Low Road's pick
// (egPoseIn, onLowRoad), a hall's ground (net/eliteGates/egLaw.js egInHall). Laws 4-8: the old readers (kept below, word for word as
// they stood at 2566401e6) and the new agree on every point of hundreds of halls. LAW 9: synthetic halls that turn, double
// back, climb, fork, run a side way and cross over themselves 6 m up - progress by the route, never by z - read by the
// readers themselves and by the director over the real Room's law (a hall given with a route, net/eliteGates/egLaw.js egSpecGive).
import test from 'node:test';
import assert from 'node:assert/strict';
import { egRouteOf, egRouteAlong, egRouteAlongAt, egRouteNear, egRouteRoad, egRouteAt, egRouteLen, egRouteAhead, egRouteInHall,
  EG_ROUTE_KINDS, EG_ROUTE_ROADS, EG_ROUTE_Y_WEIGHT, EG_ROUTE_UNDER_X, EG_ROUTE_BOUND, EG_LINE_HALF_X } from '../../../src/net/eliteGates/egRoute.js';
import { egHallOf, egInHall, egSpecGive, egSpecForget, egCircleSpecs, egBandOfHall, EG_BRINK_HALLS, EG_HALL_LEN_MAX, EG_HALL_PITCH, EG_TOLL_KINDS, EG_TOLL_QUARTERS, EG_TOLL_WAIVE_MS,
  EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egTollOf, egCaptiveSpots, egBreachNew, egEnter, egStep, egPoseIn, EG_CHAINS, EG_SHADOW_SIDE_M, EG_SHADOW_AHEAD_M } from '../../../src/net/eliteGates/egBrain.js';
import { egFairNew, egFairPose, EG_FAIR_SNAP_M } from '../../../src/net/eliteGates/egFair.js';
import { egIsleAhead, EG_KIND, EG_DIVER_WAIT_R } from '../../../src/net/eliteGates/egLegion.js';
import { egFightView } from '../../../src/net/eliteGates/egWalkGraph.js';
import { EG_ROLE, egBodiesOf } from '../../../src/net/eliteGates/egBodies.js';
import { egRuinColumns } from '../../../src/world/eliteGates/egRuin.js';
import { GATE_COURT_BOUND } from '../../../src/net/wire.js';

// ── THE OLD READERS, word for word as they stood (2566401e6) - the measure laws 4-8 must keep ────────────────────────
const OLD = {
  inHall: (spec, sx, z, pad = 40) => Math.abs(sx - spec.x0) <= 120 + pad && z >= -pad && z <= spec.len + pad,
  toll(spec, m, A, h, now) {
    if (!EG_TOLL_KINDS.includes(spec?.kind) || !spec.arrive || !spec.end || m?.downH === h || A?.atEnd) return 0;
    if (A?.fnew > 0 && now - A.fnew <= EG_TOLL_WAIVE_MS) return 0;
    const road = Math.round((spec.end.z - spec.arrive.z) * 100);
    if (!(road > 0)) return 0;
    const ahead = Math.max(0, Math.round((spec.end.z - (A?.far ?? spec.arrive.z)) * 100));
    return Math.min(EG_TOLL_QUARTERS, Math.ceil((EG_TOLL_QUARTERS * ahead) / road));
  },
  far: (p) => p.z,   // egFair farther: `if (A.far == null || p.z > A.far) A.far = p.z`
  back: (p, L) => p.z < L[3] - EG_FAIR_SNAP_M,   // egFairPose: a cast back onto still ground behind
  isleAhead(isles, z) { let isle = null; for (const d of isles ?? []) if (d.z + d.r > z && (!isle || d.z < isle.z)) isle = d; return isle; },
  lowRoad: (spec, b) => !!spec.fork && b.z >= spec.fork.z && b.x >= (spec.fork.lowX + spec.fork.x) / 2,   // onLowRoad, and egPoseIn's pick
  lead: (inHall) => inHall.reduce((p, q) => (q.z > p.z ? q : p)),
  harrier: (m, s) => [m.x + s * EG_SHADOW_SIDE_M, m.z + EG_SHADOW_AHEAD_M],
  captive(spec) {
    const law = spec.spots?.chain ?? [];
    if (law.length >= EG_CHAINS) return law.slice(0, EG_CHAINS).map((q) => [q.x, q.z]);
    const about = (d) => [0, 120, 240].map((deg) => /** @type {[number, number]} */ ([d.x + Math.sin((deg * Math.PI) / 180) * (d.r / 2), d.z + Math.cos((deg * Math.PI) / 180) * (d.r / 2)]));
    if (spec.kind === 'span' || spec.kind === 'brink') {
      const fl = egFightView(spec).fl, isles = fl.filter((f) => f.g === 'island').sort((a, b) => a.z - b.z);
      const ground = isles.length >= EG_CHAINS ? isles : [...isles, ...fl.filter((f) => f.g === 'plate').sort((a, b) => a.z - b.z)];
      if (ground.length >= EG_CHAINS) return [0, 1, 2].map((j) => { const d = ground[Math.round((j * (ground.length - 1)) / 2)]; return [d.x, d.z]; });
      if (ground.length) return about(ground[0]);
    }
    const ch = spec.spots?.chamber?.[0], disc = ch ? (spec.fl ?? []).find((f) => f.t === 'd' && Math.hypot(f.x - ch.x, f.z - ch.z) <= f.r) : null;
    if (disc) return about(disc);
    const lane = (spec.fl ?? []).find((f) => f.t === 'l');
    if (lane) return [0.25, 0.5, 0.75].map((t) => [lane.ax + (lane.bx - lane.ax) * t, lane.az + (lane.bz - lane.az) * t]);
    return law.map((q) => [q.x, q.z]);
  },
};

/** A seeded die for the sampled points (the same points every run). */
const dieOf = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
/** Every place a hall's law names a body may stand at or near - its plates, discs, bands' ends and middles, lanes, pieces,
 *  islands, a hero's floors' corners, THE FORK's own lines (its z, its midpoint in x, exactly) - and `extra` points drawn
 *  about its bound; each at heights unknown, on its floor, a leap over it and fallen under it. */
function pointsOf(spec, rng, extra = 24) {
  const P = [];
  const at = (x, y, z) => { for (const dy of [undefined, 0, 2.7, -35]) P.push({ x, y: dy === undefined ? undefined : (y ?? 0) + dy, z }); };
  for (const d of [spec.arrive, spec.end, ...spec.discs, ...(spec.islands ?? [])].filter(Boolean)) { at(d.x, d.y, d.z); at(d.x + d.r, d.y, d.z); at(d.x, d.y, d.z - d.r); }
  for (const b of spec.bands) { at(b.x, b.y, b.z0); at(b.x + b.halfW, b.y, (b.z0 + b.z1) / 2); at(b.x - b.halfW, b.y, b.z1); }
  for (const l of spec.lanes ?? []) { at(l.ax, l.y, l.az); at(l.bx, l.y, l.bz); }
  for (const s of spec.steps) at(s.x, s.y, s.z);
  for (const q of spec.heroes ?? []) for (const g of q.floors) for (const c of g.poly) at(c[0], g.y, c[1]);
  if (spec.fork) { const F = spec.fork, mid = (F.lowX + F.x) / 2; for (const x of [mid, mid - 1e-9, F.lowX, F.x]) for (const z of [F.z, F.z - 1e-9, F.z + 3]) at(x, 0, z); }
  for (let k = 0; k < extra; k++) at((rng() - 0.5) * 300, (rng() - 0.5) * 40, -45 + rng() * (spec.len + 90));
  return P;
}
/** The halls of laws 4-8 the proof reads: three seeds, thirty halls each, every ground. */
function* oldHalls() {
  for (const law of [4, 5, 6, 7, 8]) for (const seed of [7, 12345, 424242]) for (let h = 1; h <= 30; h++) yield egHallOf(seed, h, h % 3, law);
}

test('THE ASCENT - THE ROUTE, LAWS 4-8 (Elite-Gates-Ascent.md section 1): their route is THE COURSE\'S LINE and its measure IS z - over 450 halls of laws 4-8 and every point their law names (and more drawn about them, at every height), the old readers and the new answer the same number: the furthest fair point and the cast-back\'s "back", the toll, a hall\'s ground, the island ahead, the leading member, the Harriers\' rise, the Low Road\'s pick, the Captive\'s chains (mutants: the run-on ends closed, the fork\'s midpoint read past, the line\'s bound the bound\'s)', () => {
  const rng = dieOf(9);
  let points = 0, halls = 0, forks = 0, chains = 0;
  for (const spec of oldHalls()) {
    halls++;
    if (spec.fork) forks++;
    const R = egRouteOf(spec);
    assert.equal(R.line, 1, 'a law 4-8 hall is THE COURSE\'S LINE');
    assert.deepEqual([R.nodes, R.main, R.paths], [[[0, 0, 0], [0, 0, spec.len]], [0, 1], [[0, 1], [0, 1]]]);
    assert.ok(Object.isFrozen(R) && egRouteOf(spec) === R, 'kept, frozen');
    assert.equal(egRouteLen(spec), spec.len);
    const P = pointsOf(spec, rng);
    const isles = egFightView(spec).fl.filter((f) => f.g === 'island' || f.g === 'plate');
    const m = { downH: 0 };
    for (let i = 0; i < P.length; i++) {
      const p = P[i], L = [0, P[(i + 7) % P.length].x, P[(i + 7) % P.length].y, P[(i + 7) % P.length].z];
      points++;
      // the measure: exactly z, on either road, as an array or a pose
      const a = egRouteAlongAt(spec, p.x, p.y, p.z);
      assert.ok(a === OLD.far(p) && egRouteAlong(spec, [p.x, p.y, p.z], 1) === p.z && egRouteAlong(spec, p) === p.z, `hall ${spec.seed}:${spec.h} law ${spec.v} (${p.x}, ${p.y}, ${p.z}): ${a}`);
      assert.equal(a < egRouteAlongAt(spec, L[1], L[2], L[3]) - EG_FAIR_SNAP_M, OLD.back(p, L));
      // the toll, read with the furthest point each trail keeps
      for (const A of [null, { far: null }, { far: a }, { far: a, atEnd: 1 }, { far: a, fnew: 5 }]) {
        const Aold = A && A.far != null ? { ...A, far: OLD.far(p) } : A;
        assert.equal(egTollOf(spec, m, A, 1, 100_000), OLD.toll(spec, m, Aold, 1, 100_000));
      }
      // a hall's ground (the Spire's frame), the island ahead, the road, the Harriers
      const sx = spec.x0 + p.x * 1.2, pad = [40, 4, 0][i % 3];
      assert.equal(egInHall(spec, sx, p.z, pad), OLD.inHall(spec, sx, p.z, pad));
      assert.equal(egRouteInHall(spec, sx, p.z, pad), OLD.inHall(spec, sx, p.z, pad));
      assert.equal(egIsleAhead(isles, egRouteAlong(spec, p), spec), OLD.isleAhead(isles, p.z));
      assert.equal(egRouteRoad(spec, p), OLD.lowRoad(spec, p) ? 1 : 0);
      for (const s of [1, -1]) assert.deepEqual(egRouteAhead(spec, p, EG_SHADOW_AHEAD_M, s * EG_SHADOW_SIDE_M), OLD.harrier(p, s));
    }
    // the leading member of every company of three the points make
    for (let i = 0; i + 2 < P.length; i += 3) {
      const co = [P[i], P[i + 1], P[i + 2]];
      assert.equal(Math.max(...co.map((q) => egRouteAlong(spec, q))), OLD.lead(co).z);
    }
    const cs = egCaptiveSpots(spec);
    assert.deepEqual(cs, OLD.captive(spec));
    chains += cs.length;
  }
  assert.equal(halls, 450);
  assert.ok(points >= 100_000 && forks >= 40 && chains >= 600, `${points} points, ${forks} forks, ${chains} chains`);
});

// ── LAW 9: synthetic halls (THE ROOMS slice lays the real ones) ─────────────────────────────────────────────────────
const dist3 = (A, B) => Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
/** A LAW 9 hall as its spec says it: its route (`links` [a, b, kind, road, len?] - len its length in space unless said), its
 *  plates at its main way's ends, `extra` fields over it. */
function hall9(nodes, links, main, extra = {}) {
  const route = { nodes, links: links.map(([a, b, kind = 'walk', road = 0, len]) => ({ a, b, kind, road, len: len ?? dist3(nodes[a], nodes[b]) })), main };
  const A = nodes[main[0]], E = nodes[main[main.length - 1]];
  return { law: 9, v: 9, kind: 'span', x0: 0, len: 158, route, arrive: { x: A[0], y: A[1], z: A[2], r: 5, role: 'arrive' }, end: { x: E[0], y: E[1], z: E[2], r: 5, role: 'end' },
    discs: [], bands: [], lanes: [], steps: [], ramps: [], islands: [], fl: [], spots: {}, heroes: [], alcoves: [], ...extra };
}
/**
 * THE ASCENT'S OWN HALL: along a corridor (+z), round a corner (+x), back down a second corridor (-z - the hall doubles
 * back), up a climb pitch 6 m to a bridge that crosses OVER THE FIRST CORRIDOR (at (0, 6, 12)), along a gallery and on to
 * the door, 6 m up. THE FORK's other road a stair from the corner to the bridge's head; a side way that ends at a cache, and
 * one that leaves the gallery and comes back to it.
 */
const N = [[0, 0, 0], [0, 0, 40], [30, 0, 40], [30, 0, 10], [30, 6, 12], [-10, 6, 12], [-10, 6, 60], [0, 6, 70], [40, 3, 25], [-25, 6, 12], [-20, 6, 24]];
const LINKS = [[0, 1], [1, 2], [3, 2], [3, 4, 'climb'], [4, 5, 'bridge'], [5, 6], [6, 7], [2, 8, 'stair', 1, 30], [8, 4, 'stair', 1, 30], [5, 9, 'walk', 2], [5, 10, 'walk', 2], [10, 6, 'walk', 2]];
const ASCENT = () => hall9(N, LINKS, [0, 1, 2, 3, 4, 5, 6, 7]);
const CUM = [0, 40, 70, 100, 100 + Math.hypot(6, 2), 140 + Math.hypot(6, 2), 188 + Math.hypot(6, 2), 188 + Math.hypot(6, 2) + Math.hypot(10, 10)];
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('THE ASCENT - THE ROUTE, LAW 9 (section 1): a hall that turns, doubles back and climbs is measured along its ways - each place on the main way its walked length from the arrival plate, the corridor that runs back down -z gaining as its z falls, a climb pitch gaining with its height, before the plate less than nothing and past the door more than the whole; the route said back (its paths, its lengths), the point at a progress found again, the nearest point named (mutants: the run-on ends closed, a plan-only point read in space, the main way\'s own link passed over, the route read as the line)', () => {
  const spec = ASCENT(), R = egRouteOf(spec);
  assert.equal(R.line, 0);
  assert.deepEqual(R.paths, [[0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 8, 4, 5, 6, 7]], 'road 1: the main with THE FORK\'s stair taken');
  assert.deepEqual(R.ways, [[0, 1, 2, 3, 4, 5, 6], [0, 1, 7, 8, 4, 5, 6]], 'the links each road takes, in order');
  assert.ok(Object.isFrozen(R) && Object.isFrozen(R.paths[1]) && egRouteOf(spec) === R, 'kept by its route, frozen');
  assert.ok(near(R.len[0], CUM[7]) && near(egRouteLen(spec), CUM[7]) && near(egRouteLen(spec, 1), 70 + 60 + 40 + 48 + Math.hypot(10, 10)), 'each road its walked length');
  assert.deepEqual([[...EG_ROUTE_KINDS], { ...EG_ROUTE_ROADS }], [['walk', 'stair', 'climb', 'drop', 'span', 'bridge'], { main: 0, fork: 1, side: 2 }], 'the contract\'s kinds and roads');
  // the main way's places: their walked length; the corridor back down -z gains as z falls
  for (const [k, n] of [0, 1, 2, 3, 4, 5, 6, 7].entries()) assert.ok(near(egRouteAlong(spec, N[n]), CUM[k]), `node ${n}`);
  assert.ok(near(egRouteAlong(spec, [30, 0, 30]), 80) && near(egRouteAlong(spec, [30, 0, 20]), 90), 'z falls, progress rises');
  assert.ok(near(egRouteAlong(spec, [30, undefined, 20]), 90), 'with no height said, plan alone');
  // the climb: a body on the pitch gains with its height
  const c = [1, 3, 5].map((y) => egRouteAlong(spec, [30, y, 10 + y / 3]));
  assert.ok(c[0] > CUM[3] && c[1] > c[0] && c[2] > c[1] && c[2] < CUM[4], `up the pitch: ${c}`);
  // run on before the plate and past the door
  assert.ok(near(egRouteAlong(spec, [0, 0, -5]), -5), 'behind the plate, less than nothing');
  assert.ok(near(egRouteAlong(spec, [0, 6, 75]), CUM[6] + 25 / Math.SQRT2) && egRouteAlong(spec, [0, 6, 75]) > CUM[7] + 3, 'past the door, more than the whole');
  // the point at a progress, found again
  for (const s of [0, 12, 55, 85, 101, 125, 160, 200, CUM[7]]) {
    const p = egRouteAt(spec, s);
    assert.ok(near(egRouteAlong(spec, p), s, 1e-6), `at ${s}: (${p})`);
  }
  assert.deepEqual(egRouteAt(spec, -5), [0, 0, -5], 'run on behind the plate');
  assert.deepEqual(egRouteAt(spec, 130, 1).map((v) => Math.round(v * 1e6) / 1e6), [30, 6, 12], 'road 1\'s own way: its stair\'s head');
  // the nearest point named
  const q = egRouteNear(spec, [31, 0, 25]);
  assert.deepEqual([q.i, q.road, q.kind, q.x, q.y, q.z, q.d, q.along], [2, 0, 'walk', 30, 0, 25, 1, 85]);
  // a way joined to nothing is no part of the route
  const stray = hall9([...N, [100, 0, 50], [110, 0, 50]], [...LINKS, [11, 12]], [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.ok(near(egRouteAlong(stray, [105, 0, 50]), egRouteAlong(spec, [105, 0, 50])) && egRouteAlong(spec, [105, 0, 50]) > 0, 'read off the route\'s own ways');
  // a route the module cannot read (no main way) is the line
  const bad = { ...spec, route: { nodes: N, links: spec.route.links } };
  assert.equal(egRouteOf(bad).line, 1);
  assert.equal(egRouteAlong(bad, [30, 0, 20]), 20);
});

test('THE ASCENT - THE ROUTE, LAW 9 CROSSING OVER ITSELF (section 2): the bridge crosses 6 m over the corridor it came along - a body on the bridge reads the bridge, never the floor under it, and one on the corridor or leaping from it (2.7 m up) reads the corridor; between the two the lower holds to 4 m over it (a metre under a way weighs twice one over it); a body that never says its height is read in plan; the road a body is on likewise (mutants: height weighed nothing, a metre under weighed as one over, the weight on the wrong side)', () => {
  const spec = ASCENT(), bridge = CUM[4] + 30;
  assert.equal(EG_ROUTE_Y_WEIGHT, 4);
  assert.equal(EG_ROUTE_UNDER_X, 2);
  assert.ok(near(egRouteAlong(spec, [0, 6, 12]), bridge), 'on the bridge: the bridge');
  assert.ok(near(egRouteAlong(spec, [0.5, 6.4, 12]), bridge - 0.5), 'half a metre back along it (the bridge runs -x)');
  assert.ok(near(egRouteAlong(spec, [0, 0, 12]), 12), 'on the corridor under it: the corridor');
  assert.ok(near(egRouteAlong(spec, [0, 2.7, 12]), 12), 'a leap from the corridor: still the corridor');
  assert.ok(near(egRouteAlong(spec, [0, 3.9, 12]), 12) && near(egRouteAlong(spec, [0, 4.1, 12]), bridge), 'the lower holds to 4 m over it');
  assert.equal(egRouteNear(spec, [0, 6, 12]).kind, 'bridge');
  assert.equal(egRouteNear(spec, [0, 0, 12]).i, 0);
  // the fair trail's furthest point and the toll, at the crossing - by the route, not by z (the bridge's z is the corridor's)
  assert.ok(egRouteAlong(spec, [0, 6, 12]) - egRouteAlong(spec, [0, 0, 12]) > 120);
});

test('THE ASCENT - THE ROUTE, LAW 9 ROADS AND SIDE WAYS (sections 1 and 5): THE FORK\'s other road measured on its own walk (its own path, its own length) and, read on the main way, between the places it leaves and rejoins it in proportion to the walk; a side way that ends reads the place it leaves from, one that comes back reads between; the road a body is on is its nearest way\'s, by height too - and at the fork\'s own place, the main way; ahead along the way of travel, a link said either way round, a climb\'s face as the way on from its lip (mutants: the fork\'s other way never taken, the proportion read from the far end, the lower road losing a tie, the way said backwards kept, the face given no way)', () => {
  const spec = ASCENT();
  // road 1's stair: its own walk on road 1; on the main way between the corner (70) and the bridge's head, by the walk
  const head = CUM[4];
  assert.ok(near(egRouteAlong(spec, N[8], 1), 100), 'on its own road: 70 + 30');
  assert.ok(near(egRouteAlong(spec, N[8]), 70 + (head - 70) * 0.5), 'on the main way: half way between the places it joins');
  assert.ok(near(egRouteAlong(spec, [40, undefined, 25]), 70 + (head - 70) * 0.5), 'in plan too');
  assert.ok(near(egRouteAlong(spec, [30, 0, 20], 1), 70 + 60 * (20 / (30 + Math.hypot(6, 2)))), 'the main way\'s climb, read on road 1');
  // side ways: a dead end reads where it leaves; a loop between its ends, by the walk
  assert.ok(near(egRouteAlong(spec, [-25, 6, 12]), CUM[5]) && near(egRouteAlong(spec, [-20, 6, 12]), CUM[5]), 'the cache\'s way: where it leaves');
  const w5 = Math.hypot(10, 12), w6 = Math.hypot(10, 36);
  assert.ok(near(egRouteAlong(spec, N[10]), CUM[5] + 48 * (w5 / (w5 + w6))), 'the loop: between, by the walk');
  // the road a body is on
  assert.deepEqual([egRouteRoad(spec, [0, 0, 20]), egRouteRoad(spec, N[8]), egRouteRoad(spec, [-22, 6, 12]), egRouteRoad(spec, [30, 6, 12])], [0, 1, 2, 0]);
  assert.equal(egRouteRoad(spec, [40, 0, 25]), 0, 'under the stair, on the corridor beside it: by height, the main way');
  assert.equal(egRouteRoad(spec, [40, undefined, 25]), 1, 'with no height, in plan: the stair');
  const forkFirst = hall9(N, [[2, 8, 'stair', 1, 30], ...LINKS.filter((l) => l[3] !== 1), [8, 4, 'stair', 1, 30]], [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(egRouteRoad(forkFirst, N[2]), 0, 'the fork\'s own place: the main way, whichever link is said first');
  // ahead: along the way of travel toward the door, a link said either way round (3 -> 2 is walked 2 -> 3, -z)
  assert.deepEqual(egRouteAhead(spec, [30, 0, 25], 6, 5), [25, 19], 'down the corridor that runs back: -z ahead, across it -x');
  assert.deepEqual(egRouteAhead(spec, [10, 0, 40], 6, 5), [16, 35], 'round the corner: +x ahead');
  const face = hall9([[0, 0, 0], [0, 0, 20], [0, 6, 20], [-30, 6, 20]], [[0, 1], [1, 2, 'climb'], [2, 3]], [0, 1, 2, 3]);
  assert.deepEqual(egRouteAhead(face, [0, 3, 20], 6, 0), [-6, 20], 'on a sheer face: the way on from its lip');
  assert.ok(near(egRouteAlong(face, [0, 3, 20]), 23), 'up the face, by its height');
  // the main way's own link between two places, though another road's is shorter
  const twin = hall9([[0, 0, 0], [0, 0, 20], [0, 0, 40]], [[1, 2, 'stair', 1, 5], [0, 1], [1, 2, 'climb', 0, 8]], [0, 1, 2]);
  assert.deepEqual([egRouteLen(twin), egRouteLen(twin, 1)], [28, 25]);
});

test('THE ASCENT - THE ROUTE, LAW 9 READERS (section 1): THE FAIR TRAIL\'s furthest point is the route\'s (on the bridge, past the corridor under it), a cast back onto ground behind along the route is no stretch run - where z would have called it a leap ahead at forty metres a second; the toll counts the route still ahead; the Captive\'s chains hang along the route, the island ahead is ahead along it; a hall\'s ground is its bound (mutants: the furthest read by z, "back" read by z, the toll\'s road by z, the chains by z, the island by z, the bound the line\'s strip)', () => {
  const lane = (a, b, y = N[a][1]) => ({ ax: N[a][0], az: N[a][2], bx: N[b][0], bz: N[b][2], hw: 2, y, role: 'walk' });
  const floors = { discs: [{ x: 0, y: 0, z: 0, r: 5, role: 'arrive' }, { x: 0, y: 6, z: 70, r: 5, role: 'end' }], lanes: [lane(0, 1), lane(1, 2), lane(3, 2), lane(4, 5), lane(5, 6)] };
  const spec = { ...ASCENT(), ...floors }, line = { ...spec, route: undefined };
  // the furthest fair point: on the bridge it is the bridge's progress - its z is the corridor's 12
  const A = egFairNew(3), Z = egFairNew(3);
  const walk = [[0, 0, 0, 0], [30, 0, 25, 1000], [0, 6, 12, 2000], [0, 0, 30, 3000]];   // blind stretches: support alone is judged
  for (const [x, y, z, t] of walk) { egFairPose(A, spec, { x, y, z }, t); egFairPose(Z, line, { x, y, z }, t); }
  assert.ok(near(A.far, CUM[4] + 30), `the route's: ${A.far}`);
  assert.equal(Z.far, 30, 'z would keep the corridor\'s end');
  // a cast-back: from the bridge onto the corridor behind (by the route) - though ahead by z, 32 m in 0.1 s
  const cast = (S) => { const T = egFairNew(3); egFairPose(T, S, { x: 0, y: 6, z: 12 }, 0); egFairPose(T, S, { x: 30, y: 0, z: 25 }, 100); return T; };
  assert.deepEqual([cast(spec).brk, cast(spec).why], [0, ''], 'behind along the route: no stretch run');
  assert.deepEqual([cast(line).brk, cast(line).why], [1, 'speed'], 'by z it was a leap ahead');
  // the toll: the route still ahead of the furthest point - from the bridge, two quarters of four (z would say four)
  const m = { downH: 0 };
  assert.equal(egTollOf(spec, m, { far: CUM[4] + 30 }, 1, 100_000), 2);
  assert.equal(egTollOf(spec, m, null, 1, 100_000), EG_TOLL_QUARTERS, 'no fair point: the whole road');
  assert.equal(egTollOf(spec, m, { far: CUM[7] - 1 }, 1, 100_000), 1, 'a step short pays one');
  assert.equal(OLD.toll(spec, m, { far: 12 }, 1, 100_000), 4);
  // the Captive's chains along the route: the corridor's, the doubled-back corridor's, the gallery's (z would say 20, 30, 40)
  const isl = [{ x: 30, y: 0, z: 20, r: 3 }, { x: -10, y: 6, z: 40, r: 3 }, { x: 0, y: 0, z: 30, r: 3 }];
  const cs = { ...spec, islands: isl };
  assert.deepEqual(egCaptiveSpots(cs), [[0, 30], [30, 20], [-10, 40]]);
  assert.deepEqual(OLD.captive(cs), [[30, 20], [0, 30], [-10, 40]]);
  // the island ahead along the route of a body at the corner (progress 70): the doubled-back corridor's, at z 20
  const view = egFightView(cs), isles = view.fl.filter((f) => f.g === 'island' || f.g === 'plate');
  assert.deepEqual([egIsleAhead(isles, egRouteAlong(cs, [30, 0, 40]), cs)].map((d) => [d.x, d.z]), [[30, 20]]);
  assert.deepEqual([OLD.isleAhead(isles, 40)].map((d) => [d.x, d.z]), [[-10, 40]]);
  assert.deepEqual([egIsleAhead(isles, egRouteAlong(cs, [0, 6, 12]), cs)].map((d) => [d.x, d.z]), [[-10, 40]], 'from the bridge: the gallery\'s');
  // a hall's ground: LAW 9 its bound (section 7) about its origin, never the line's strip
  assert.equal(EG_ROUTE_BOUND.z1, EG_HALL_LEN_MAX);
  assert.ok(EG_ROUTE_BOUND.x < GATE_COURT_BOUND && EG_ROUTE_BOUND.z1 < GATE_COURT_BOUND && -EG_ROUTE_BOUND.z0 < GATE_COURT_BOUND, 'inside the wire\'s bound');
  assert.ok(EG_ROUTE_BOUND.x + 40 < EG_HALL_PITCH / 2, 'never the next hall\'s');
  assert.equal(EG_LINE_HALF_X, 120);
  const far9 = { ...spec, x0: 500, len: 70 };
  for (const [sx, z, pad, want] of [[500 + 140, 30, 4, true], [500 - 154, 30, 4, true], [500 + 155, 30, 4, false], [500, -12, 4, true], [500, -15, 4, false], [500, 160, 4, true], [500, 163, 4, false], [500 + 189, 0, 40, true]]) {
    assert.equal(egInHall(far9, sx, z, pad), want, `(${sx}, ${z}) pad ${pad}`);
    assert.equal(egRouteInHall(far9, sx, z, pad), want);
  }
  assert.equal(OLD.inHall(far9, 640, 30, 4), false, 'the line\'s strip ended at 124');
});

test('THE ASCENT - THE ROUTE IN THE RUIN (Elite-Gates.md section 1.5, world/eliteGates/egRuin.js): a Brink\'s first third wears the band above and its last its own - thirds of its ROUTE, so a Brink whose route runs back along its z wears its own band where its z begins and the band above where it ends; the line\'s keep their thirds by z (mutants: the thirds by z)', () => {
  const spec = egCircleSpecs(7, 6, 0)[0], band = egBandOfHall(spec.h), L = spec.len;
  assert.ok(EG_BRINK_HALLS.includes(spec.h) && band > 0);
  const back = { ...spec, route: { nodes: [[0, 0, L], [0, 0, 0]], links: [{ a: 0, b: 1, kind: 'walk', road: 0, len: L }], main: [0, 1] } };
  const thirds = (S) => {
    const out = { first: new Set(), last: new Set() };
    for (const c of [...egRuinColumns(S).cols, ...egRuinColumns(S).among]) { if (c.z < L / 3 - 3) out.first.add(c.band); if (c.z > (2 * L) / 3 + 3) out.last.add(c.band); }
    return [[...out.first], [...out.last]];
  };
  assert.deepEqual(thirds(spec), [[band - 1], [band]], 'the line: the band above where z begins');
  assert.deepEqual(thirds(back), [[band], [band - 1]], 'the route run back: its own where z begins');
});

// ── THE DIRECTOR over a hall given with a route (the real Room's law: egSpecGive) ───────────────────────────────────
const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
/** A breach of two at hall `h` of `seed` - the hall given with `route` - its trial woken with the company on the plate. */
function breachAt(seed, h, route) {
  egSpecForget();
  // PIN MOVED (THE ROOMS, LAW 9 - 2026-10-16): the hall drawn under spec law 8 - the route given is laid over law 8's line (its
  // fork, its passage at z 29); a LAW 9 hall's own route is test/net/eliteGates/law9_rooms.test.js's
  const real = egHallOf(seed, h, 0, 8);
  assert.ok(egSpecGive({ ...real, route }));
  let s = seed;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = [['acct-0', 'M0', 1], ['acct-1', 'M1', 2]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  const spec = egHallOf(seed, h, 0);
  assert.ok(spec.route, 'the hall as given');
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const frames = [];
  const step = (ms = 250) => { now += ms; const o = egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); frames.push(...o); return o; };
  for (let k = 0; k < 60 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial');
  const at = (sub, x, z, y) => { pos[sub] = { sx: spec.x0 + x, z, ...(y != null ? { y } : {}) }; };
  return { B, spec, frames, step, at, now: () => now };
}
const raised = (frames, k) => frames.filter((f) => f.k === 'ead').flatMap((f) => f.a).filter((t) => t[1] === EG_ROLE.add && t[2] === k);

test('THE ASCENT - THE ROUTE IN THE DIRECTOR (section 1, over sections 8.2 and 11.4): in a hall whose route runs the other way along it (its door at the course\'s plate end), the member furthest along the ROUTE leads - the one nearest the plate - and the Divers rise over the ground ahead of it along the route and keep circling it; the Harriers rise ahead of their members along the route (behind them in z); a trail\'s road is the route\'s road its pose stands nearest, by height too (mutants: the leader by z, the leader the least along, the island ahead by z, a Diver\'s island by z, the Harriers by z, the road by the fork\'s x, the road by plan alone)', () => {
  // seed 12345, hall 52: a forked span in the Shade (its Divers); its route given running from z 300 down to z -100
  const S = breachAt(12345, 52, { nodes: [[0, 0, 300], [0, 0, -100]], links: [{ a: 0, b: 1, kind: 'walk', road: 0, len: 400 }], main: [0, 1] });
  const { B, spec } = S;
  assert.equal(spec.band, 2);
  S.at('acct-0', 0, 29); S.at('acct-1', 0, 50);   // a passage's floor, and a Rail ahead of it by z
  S.frames.length = 0;
  B.F.waveNo = 0; B.F.waveAt = S.now() + 250;
  S.step();
  const divers = raised(S.frames, EG_KIND.diver), harriers = raised(S.frames, EG_KIND.harrier);
  assert.ok(divers.length > 0 && harriers.length > 0, `a wave: ${divers.length} Divers, ${harriers.length} Harriers`);
  const plate = spec.arrive;
  for (const t of divers) assert.ok(Math.abs(Math.hypot(t[4] - plate.x, t[5] - plate.z) - EG_DIVER_WAIT_R) <= 1.5, `risen over the plate - ahead along the route of the member nearest it (${t[4]}, ${t[5]})`);
  for (const t of harriers) assert.ok(t[5] === 29 - EG_SHADOW_AHEAD_M || t[5] === 50 - EG_SHADOW_AHEAD_M, `ahead along the route: behind in z (${t[4]}, ${t[5]})`);
  for (let k = 0; k < 40; k++) S.step();
  const ds = egBodiesOf(B.F, EG_ROLE.add).filter((a) => a.k === EG_KIND.diver);
  assert.ok(ds.length > 0);
  for (const d of ds) assert.ok(Math.hypot(d.x - plate.x, d.z - plate.z) <= EG_DIVER_WAIT_R + 1.5, `circling the plate (${d.x.toFixed(1)}, ${d.z.toFixed(1)})`);
  egSpecForget();

  // seed 12345, hall 2: a span with no fork; its route gives THE FORK's other road a way 8 m over the course, 3 m aside
  const T = breachAt(12345, 2, { nodes: [[0, 0, 0], [0, 0, 60], [0, 0, 100], [0, 0, 144.14], [3, 8, 70], [3, 8, 90]],
    links: [{ a: 0, b: 1, kind: 'walk', road: 0, len: 60 }, { a: 1, b: 2, kind: 'walk', road: 0, len: 40 }, { a: 2, b: 3, kind: 'walk', road: 0, len: 44.14 },
      { a: 1, b: 4, kind: 'stair', road: 1, len: 13 }, { a: 4, b: 5, kind: 'bridge', road: 1, len: 20 }, { a: 5, b: 2, kind: 'stair', road: 1, len: 13 }], main: [0, 1, 2, 3] });
  assert.equal(T.spec.fork, null);
  const t0 = T.now(), sx = T.spec.x0, A = () => T.B.mem['acct-0'].fair;
  egPoseIn(T.B, 'acct-0', { sx, y: 0, z: 0 }, t0);
  egPoseIn(T.B, 'acct-0', { sx: sx + 3, y: 0, z: 80 }, t0 + 1000);
  assert.equal(A().road, 0, 'on the course under the high way: the main road');
  egPoseIn(T.B, 'acct-0', { sx: sx + 3, y: 8, z: 80 }, t0 + 2000);
  assert.equal(A().road, 1, 'up on it: THE FORK\'s other road - in a hall that lays no fork');
  egPoseIn(T.B, 'acct-0', { sx, y: 0, z: 120 }, t0 + 3000);
  assert.equal(A().road, 1, 'once taken, kept');
  // the Low Road's word and its foes are THE FORK's: a hall that lays no fork says none for a member on its road 1
  T.at('acct-0', 3, 80, 8); T.frames.length = 0;
  for (let k = 0; k < 8; k++) T.step();
  assert.ok(!T.frames.some((f) => f.k === 'esay' && f.w === 'lowroad'), 'no Low Road in a hall with no fork');
  egSpecForget();
});
