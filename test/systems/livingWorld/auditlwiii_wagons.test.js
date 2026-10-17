// AUDIT LW-III (bible/01-Overview/audits/Audit-LivingWorld-III.md, "The caravans' wagons"): THE CARAVANS CLEAR OF ONE
// ANOTHER - a train keeps to the right of the road the way it walks (LANE_N) and steps out abreast of another walking its
// way on one stretch (roadLanes); each wagon's axle stands its hitch straight behind its horse and faces it (the
// trailer's law, chordBehind); a shared camp's teams stand one park (campTeam's slots), each horse tied alongside its
// wagon; a fight's bodies stand clear of the beset party's team (clearOfTeam), drawn and stood live. Pure and synthetic:
// no game data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  trainOf, campTeam, campTurn, chordBehind, clearOfTeam, fileSpan, teamOf, LANE_N, HITCH_N, LEAD_N, WAGON_TAIL_N, CAMP_PARK_N,
  CAMP_HORSE_SIDE_N, CAMP_TEAM_ARC_N, CART_FOOT_N, HORSE_FOOT_N, BODY_CLEAR_N,
} from '../../../src/systems/livingWorld/wagons.js';
import { wayAt, laneAt, wayOf, partyAt, membersAt, NATIVE_PER_M, NATIVE_PIXEL, CALENDAR_MPM, LANE_EASE_N } from '../../../src/systems/livingWorld/trips.js';
import { roadLanes, campGroups, campParkOf, foePlaces, fightPlaces, partyPlaces, CAMP_RING_N, CAMP_RING_STEP_N, ABREAST_N, ABREAST_GAP_N, ABREAST_EASE_N, FILE_GAP_N } from '../../../src/scenes/livingWorld/livingRoads.js';
import { createRoadFights } from '../../../src/scenes/roadFights.js';
import { MEASURED } from '../../../src/world/wagonModels.js';
import { HORSE_BOX_SIZE } from '../../../src/systems/horse/horseCartLaw.js';
import { livingMap, partiesOver } from '../../lwRoads.mjs';
import { DAY_MIN } from '../../../src/systems/livingWorld/dayPlan.js';

const res = (id, cls = null) => ({ id, cls, name: id });
const straight = (len = 20 * NATIVE_PIXEL) => ({ pts: [[0, 0], [0, len]], cum: [0, len], len, kinds: ['road'] });
const caravan = (id, way, extra = {}) => { const leader = res(`${id}.m`); return { id, kind: 'merchant', from: { blocks: 40 }, leader, party: [leader, res(`${id}.a`, 144), res(`${id}.p`)], way, backT0: 1e9, pace: 200, ...extra }; };
/** A wagon's body (the Small Cart's footprint) as an oriented box: does a point stand in it? */
const inCart = (w, x, z, pad = 0) => {
  const dx = x - w.x, dz = z - w.z, f = dx * Math.sin(w.yaw) + dz * Math.cos(w.yaw), r = dx * Math.cos(w.yaw) - dz * Math.sin(w.yaw);
  return f > -CART_FOOT_N.back - pad && f < CART_FOOT_N.front + pad && Math.abs(r) < CART_FOOT_N.half + pad;
};
const corners = (w) => [[-CART_FOOT_N.back, -1], [-CART_FOOT_N.back, 1], [CART_FOOT_N.front, -1], [CART_FOOT_N.front, 1]]
  .map(([f, s]) => ({ x: w.x + Math.sin(w.yaw) * f + Math.cos(w.yaw) * s * CART_FOOT_N.half, z: w.z + Math.cos(w.yaw) * f - Math.sin(w.yaw) * s * CART_FOOT_N.half }));
const cartsMeet = (a, b) => corners(a).some((p) => inCart(b, p.x, p.z)) || corners(b).some((p) => inCart(a, p.x, p.z)) || Math.hypot(a.x - b.x, a.z - b.z) < NATIVE_PER_M;
const turnOf = (a, b) => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI);

test('AUDIT LW-III the footprints are the models\' own: the Small Cart\'s (MEASURED.cart: its bottom\'s back edge, its shafts\' tips, its half width) and the pool\'s horse box (HORSE_BOX_SIZE) - never a second literal (mutants: the back, the front, the half, the horse)', () => {
  assert.equal(CART_FOOT_N.back, -MEASURED.cart.bottomBack[1] * NATIVE_PER_M);
  assert.equal(CART_FOOT_N.front, MEASURED.cart.frontZ * NATIVE_PER_M);
  assert.equal(CART_FOOT_N.half, MEASURED.cart.sideX * NATIVE_PER_M);
  assert.deepEqual(HORSE_FOOT_N, { half: (HORSE_BOX_SIZE[2] / 2) * NATIVE_PER_M, side: (HORSE_BOX_SIZE[0] / 2) * NATIVE_PER_M });
  assert.deepEqual([LANE_N, ABREAST_N, ABREAST_GAP_N, ABREAST_EASE_N, LANE_EASE_N, CAMP_TEAM_ARC_N, BODY_CLEAR_N], [80, 120, 80, 240, 400, 200, 14]);
});

test('AUDIT LW-III KEEP RIGHT: a lane is wayAt\'s point carried `side` to the right of the way\'s own direction, on the line wayAt\'s own; across a corner it runs on with no jump, its heading eased over LANE_EASE_N either side (mutants: the side, the ease, the corner\'s half)', () => {
  const way = straight();
  const p = laneAt(way, 5000, 80);
  assert.ok(Math.abs(p.x - 80) < 1e-9 && Math.abs(p.z - 5000) < 1e-9 && p.yaw === 0, 'right of a way walking +z is +x');
  assert.ok(Math.abs(laneAt(way, 5000, -80).x + 80) < 1e-9, 'a negative side its left');
  const bend = wayOf({ pixels: [{ x: 0, y: 10 }, { x: 1, y: 10 }, { x: 2, y: 9 }, { x: 2, y: 8 }] });
  for (const s of [100, NATIVE_PIXEL * 0.5, NATIVE_PIXEL * 1.7]) {
    const q = laneAt(bend, s, 0), w = wayAt(bend, s);
    assert.ok(Math.hypot(q.x - w.x, q.z - w.z) < 1e-6, 'on the line, wayAt\'s point');
  }
  // across each corner, in steps of 2 native: no jump, and the heading turns by eased steps
  for (const corner of [bend.cum[1], bend.cum[2]]) {
    let last = null, most = 0, mostTurn = 0;
    for (let s = corner - 400; s <= corner + 400; s += 2) {
      const q = laneAt(bend, s, 80);
      if (last) { most = Math.max(most, Math.hypot(q.x - last.x, q.z - last.z)); mostTurn = Math.max(mostTurn, turnOf(q.yaw, last.yaw)); }
      last = q;
    }
    assert.ok(most < 3, `no jump at the corner (${most.toFixed(2)} native a 2-native step)`);
    assert.ok(mostTurn < 0.05, `the heading eased (${mostTurn.toFixed(3)} rad a step)`);
  }
  // the widest lane (abreast: LANE_N + ABREAST_N), inside each corner and outside it: it never folds back on itself
  for (const side of [LANE_N + ABREAST_N, -(LANE_N + ABREAST_N)]) for (const corner of [bend.cum[1], bend.cum[2]]) {
    let last = null;
    for (let s = corner - 600; s <= corner + 600; s += 2) {
      const q = laneAt(bend, s, side);
      if (last) assert.ok((q.x - last.x) * Math.sin(last.yaw) + (q.z - last.z) * Math.cos(last.yaw) > 0, `no fold at ${s} (side ${side})`);
      last = q;
    }
  }
  // at its middle the curve stands a quarter of the way to each leg's end from the corner (A/4 + V/2 + B/4)
  { const c = bend.cum[1], A = wayAt(bend, c - LANE_EASE_N), V = wayAt(bend, c), B = wayAt(bend, c + LANE_EASE_N), q = laneAt(bend, c, 0);
    assert.ok(Math.hypot(q.x - (A.x / 4 + V.x / 2 + B.x / 4), q.z - (A.z / 4 + V.z / 2 + B.z / 4)) < 1e-6, 'the corner rounded'); }
  const at = laneAt(bend, bend.cum[1], 0), turn = turnOf(wayAt(bend, bend.cum[1] - 1).yaw, wayAt(bend, bend.cum[1] + 1).yaw);
  assert.ok(Math.abs(turnOf(at.yaw, wayAt(bend, bend.cum[1] - 1).yaw) - turn / 2) < 1e-6, 'at the corner, half its turn');
  assert.ok(Math.abs(turnOf(laneAt(bend, bend.cum[1] - LANE_EASE_N - 1, 0).yaw, wayAt(bend, 10).yaw)) < 1e-9, 'past the ease, the segment\'s own');
});

test('AUDIT LW-III KEEP RIGHT: a train walks its lane - every horse and wagon `lane` right of the road\'s middle the way it goes, out and home - so two caravans that meet pass side by side, never one through the other (mutants: the lane, the way home\'s side)', () => {
  const way = straight();
  const a = caravan('L1.t0:1', way), b = caravan('L2.t0:1', way);
  const out = trainOf(a, { phase: 'out', s: 30000 }, a.party, 0, HITCH_N, LANE_N);
  const home = trainOf(b, { phase: 'back', s: 30000 }, b.party, 0, HITCH_N, LANE_N);
  for (const p of [...out.horses, ...out.wagons]) assert.ok(Math.abs(p.x - LANE_N) < 1e-6, 'out: right of +z is +x');
  for (const p of [...home.horses, ...home.wagons]) assert.ok(Math.abs(p.x + LANE_N) < 1e-6, 'home: right of -z is -x');
  for (const s of [26000, 28000, 30000, 32000, 34000]) {
    const o = trainOf(a, { phase: 'out', s }, a.party, 0, HITCH_N, LANE_N), h = trainOf(b, { phase: 'back', s: 60000 - s }, b.party, 0, HITCH_N, LANE_N);
    for (const w of o.wagons) for (const v of h.wagons) assert.ok(!cartsMeet(w, v), 'their wagons pass clear');
    for (const m of h.people) for (const w of o.wagons) assert.ok(!inCart(w, m.x, m.z), 'its people pass clear of the other\'s wagons');
  }
  // unsaid, on the line (as LW10 laid it)
  assert.ok(Math.abs(trainOf(a, { phase: 'out', s: 30000 }, a.party, 0).wagons[0].x) < 1e-9);
  // a file without a team walks its lane too
  const walker = { id: 'L3.t0:1', kind: 'pilgrim', party: [res('w0'), res('w1')], way };
  const file = partyPlaces(walker, { phase: 'back', s: 30000 }, null, LANE_N);
  assert.ok(Math.abs(file[0].x + LANE_N) < 1e-9, 'home, its lane its own right');
});

test('AUDIT LW-III THE TRAILER\'S LAW: round a corner each wagon\'s axle stands its hitch STRAIGHT behind its horse, on its lane, and faces it - its shafts where its horse is, turning as it rounds, never all at once; the next team WAGON_TAIL_N straight behind the axle (mutants: the chord, the face, the tail, the search)', () => {
  const bend = wayOf({ pixels: [{ x: 0, y: 10 }, { x: 1, y: 10 }, { x: 1, y: 9 }, { x: 2, y: 9 }] });
  const trip = caravan('L1.t0:9', bend);
  const hitchN = 3.8 * NATIVE_PER_M;
  const last = {}, mostTurn = { out: 0, back: 0 };
  for (let s = bend.cum[1] - 600; s <= bend.cum[1] + 900; s += 4) {
    const t = trainOf(trip, { phase: s % 8 ? 'out' : 'back', s }, trip.party, 0, hitchN, LANE_N);   // out the lane inside the corner, home outside it
    t.wagons.forEach((w, i) => {
      const h = t.horses[i];
      assert.ok(Math.abs(Math.hypot(h.x - w.x, h.z - w.z) - hitchN) < 0.05, `the hitch straight at ${s}`);
      assert.ok(turnOf(Math.atan2(h.x - w.x, h.z - w.z), w.yaw) < 1e-9, `facing its horse at ${s}`);
      const on = laneAt(bend, s % 8 ? w.s : bend.len - w.s, s % 8 ? LANE_N : -LANE_N);
      assert.ok(Math.hypot(on.x - w.x, on.z - w.z) < 1e-6, 'its axle on its lane');
    });
    const nxt = t.horses[1], w0 = t.wagons[0];
    assert.ok(Math.abs(Math.hypot(nxt.x - w0.x, nxt.z - w0.z) - WAGON_TAIL_N) < 0.05, 'the next team straight behind the axle');
    const ph = s % 8 ? 'out' : 'back';
    if (last[ph]) mostTurn[ph] = Math.max(mostTurn[ph], turnOf(w0.yaw, last[ph].yaw));
    last[ph] = w0;
  }
  for (const ph of ['out', 'back']) assert.ok(mostTurn[ph] < 0.25, `${ph}: the wagon turns as it rounds (${mostTurn[ph].toFixed(3)} rad an 8-native step)`);
  // chordBehind on a straight is the arc; round a corner a little more; past the way's end the arc's own
  const way = straight();
  const line = (s) => wayAt(way, s);
  assert.equal(chordBehind(line, 5000, 1, 150), 4850);
  assert.equal(chordBehind(line, 5000, -1, 150), 5150);
  const round = (s) => wayAt(bend, s), c = bend.cum[1] + 50;
  const k = c - chordBehind(round, c, 1, 150);
  assert.ok(k > 150 && Math.abs(Math.hypot(round(c).x - round(c - k).x, round(c).z - round(c - k).z) - 150) < 0.05, 'round a corner a little more');
  assert.equal(chordBehind(round, 10, 1, 150), 10 - 150, 'past the way\'s start, the arc\'s');
});

test('AUDIT LW-III ABREAST: of two parties walking one way on one stretch, the faster - at one pace the later trip - walks ABREAST_N farther right while their files are within ABREAST_GAP_N, easing back over ABREAST_EASE_N; met the other way, or far, each its LANE_N (mutants: who steps, the way, the gap, the ease, the across)', () => {
  const way = straight();
  const a = caravan('L1.t0:1', way), b = caravan('L2.t0:1', way);
  const walk = (trip, s, phase = 'out') => ({ trip, at: { phase, s, ...wayAt(way, s) }, members: trip.party });
  const one = roadLanes([walk(a, 30000), walk(b, 30000)], HITCH_N);
  assert.equal(one.get('L1.t0:1'), LANE_N, 'the earlier trip keeps its lane');
  assert.equal(one.get('L2.t0:1'), LANE_N + ABREAST_N, 'the later steps out');
  const faster = roadLanes([walk({ ...a, pace: 300 }, 30000), walk(b, 30000)], HITCH_N);
  assert.equal(faster.get('L1.t0:1'), LANE_N + ABREAST_N, 'the faster steps out, whatever its id');
  const met = roadLanes([walk(a, 30000), walk(b, 30000, 'back')], HITCH_N);
  assert.deepEqual([met.get('L1.t0:1'), met.get('L2.t0:1')], [LANE_N, LANE_N], 'met the other way: each its own side');
  const span = fileSpan(a, a.party.length, HITCH_N, FILE_GAP_N);
  const behind = (gap) => roadLanes([walk(a, 30000), walk(b, 30000 - span.behind - fileSpan(b, 3, HITCH_N, FILE_GAP_N).ahead - gap)], HITCH_N).get('L2.t0:1');
  assert.equal(behind(ABREAST_GAP_N - 1), LANE_N + ABREAST_N, 'within the gap, abreast');
  assert.ok(Math.abs(behind(ABREAST_GAP_N + ABREAST_EASE_N / 2) - (LANE_N + ABREAST_N / 2)) < 1e-6, 'eased half way');
  assert.equal(behind(ABREAST_GAP_N + ABREAST_EASE_N + 1), LANE_N, 'past the ease, one lane');
  // on a road beside, not on this one
  const beside = { ...walk(b, 30000), at: { phase: 'out', s: 30000, x: 0, z: 30000 } };
  const far = { pts: [[ABREAST_GAP_N + ABREAST_EASE_N, 0], [ABREAST_GAP_N + ABREAST_EASE_N, 20 * NATIVE_PIXEL]], cum: [0, 20 * NATIVE_PIXEL], len: 20 * NATIVE_PIXEL, kinds: [] };
  assert.equal(roadLanes([walk(a, 30000), { ...beside, trip: { ...b, way: far } }], HITCH_N).get('L2.t0:1'), LANE_N, 'a road beside is not this one');
  // two abreast stand clear of one another the whole way
  for (const s of [20000, 30000, 40000]) {
    const L = roadLanes([walk(a, s), walk(b, s)], HITCH_N);
    const ta = trainOf(a, { phase: 'out', s }, a.party, 0, HITCH_N, L.get(a.id)), tb = trainOf(b, { phase: 'out', s }, b.party, 0, HITCH_N, L.get(b.id));
    for (const w of ta.wagons) for (const v of tb.wagons) assert.ok(!cartsMeet(w, v), 'abreast, clear');
    // and on the road: a wagon's far side inside the road's half width (travelPaths.js P_SIZE 512: 6.4 m)
    for (const w of tb.wagons) assert.ok(Math.abs(w.x) + CART_FOOT_N.half <= 256, 'on the road');
  }
});

test('AUDIT LW-III ONE CAMP, ONE PARK: the camps\' teams stand round one park - each party its slots (k0 of the camp\'s teams), turned the first\'s way, the ring grown to CAMP_TEAM_ARC_N a team - so two caravans of one camp never stand a wagon in the other\'s; a lone camp parks as LW10 did; each horse tied alongside its wagon, facing the fire, clear of its bed (mutants: the slots, the turn, the arc, the horse\'s face)', () => {
  const way = straight();
  const trips = ['L1.t0:1', 'L2.t0:1', 'L3.t0:1'].map((id) => caravan(id, way));
  const camped = trips.map((trip, i) => ({ trip, at: { phase: 'out', camp: true, x: i * 200, z: 0 }, members: trip.party }));
  const g = campGroups(camped);
  const first = g.get('L1.t0:1');
  assert.equal(first.teams, 6, 'two wagons each');
  assert.deepEqual(trips.map((t) => g.get(t.id).k0), [0, 2, 4]);
  assert.ok(trips.every((t) => g.get(t.id).turn === campTurn(trips[0])), 'turned the first\'s way');
  const r = CAMP_RING_N + Math.max(0, first.n - 4) * CAMP_RING_STEP_N;
  const parks = trips.map((t) => campTeam(t, first.x, first.z, r, 0, { k0: g.get(t.id).k0, n: first.teams, turn: first.turn }));
  const all = parks.flatMap((p) => p.wagons);
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) assert.ok(!cartsMeet(all[i], all[j]), `${all[i].key} and ${all[j].key} clear`);
  const horses = parks.flatMap((p) => p.horses);
  for (const h of horses) for (const w of all) {
    for (const f of [-HORSE_FOOT_N.half, 0, HORSE_FOOT_N.half]) assert.ok(!inCart(w, h.x + Math.sin(h.yaw) * f, h.z + Math.cos(h.yaw) * f), `${h.key}'s body clear of ${w.key}`);
  }
  const d = Math.max(r + CAMP_PARK_N, (6 * CAMP_TEAM_ARC_N) / (Math.PI * 2));
  for (const w of all) assert.ok(Math.abs(Math.hypot(w.x - first.x, w.z - first.z) - d) < 1e-6, 'one park');
  // a camp of six lone carters' worth of wagons: the park grows to CAMP_TEAM_ARC_N a team, none in another
  const six = Array.from({ length: 6 }, (_, i) => { const l = res(`L${i}.m`); return { id: `L${i + 1}.t0:2`, kind: 'merchant', from: { blocks: 40 }, leader: l, party: [l], way, backT0: 1e9 }; });
  const g6 = campGroups(six.map((trip) => ({ trip, at: { phase: 'out', camp: true, x: 0, z: 0 }, members: trip.party })));
  const p6 = six.flatMap((trip) => campParkOf(trip, { x: 0, z: 0 }, g6.get(trip.id), 0).wagons);
  assert.equal(p6.length, 12);
  for (const w of p6) assert.ok(Math.abs(Math.hypot(w.x, w.z) - (12 * CAMP_TEAM_ARC_N) / (Math.PI * 2)) < 1e-6, 'the park grown to its teams');
  for (let i = 0; i < p6.length; i++) for (let j = i + 1; j < p6.length; j++) assert.ok(!cartsMeet(p6[i], p6[j]), 'twelve, clear');
  // lone: LW10's park, unchanged
  const lone = campTeam(trips[0], 0, 0, 90, 0);
  const a0 = campTurn(trips[0]);
  assert.ok(Math.abs(lone.wagons[0].x - Math.sin(a0) * (90 + CAMP_PARK_N)) < 1e-9 && Math.abs(lone.wagons[1].x - Math.sin(a0 + Math.PI) * (90 + CAMP_PARK_N)) < 1e-9);
  assert.deepEqual(campTeam(trips[0], 0, 0, 90, 0, { k0: 0, n: 2, turn: a0 }), lone, 'a camp of one parks as its own');
  for (let i = 0; i < 2; i++) {
    assert.equal(lone.horses[i].yaw, lone.wagons[i].yaw, 'facing the fire as its wagon does');
    assert.ok(Math.abs(Math.hypot(lone.horses[i].x - lone.wagons[i].x, lone.horses[i].z - lone.wagons[i].z) - CAMP_HORSE_SIDE_N) < 1e-6);
  }
});

test('AUDIT LW-III CLEAR OF THE TEAM: a body standing in a wagon\'s footprint or a horse\'s goes out by the nearest side, BODY_CLEAR_N beyond; one clear stays where it is; the drawn fight\'s ring and foes, and the live fight\'s bodies, stand clear of the beset party\'s team (mutants: the side, the pad, the passes, the foes, the ring, the live stand)', () => {
  const w = { x: 0, z: 0, yaw: 0 };
  const team = { wagons: [w], horses: [] };
  const c = clearOfTeam(10, 60, team);
  assert.ok(Math.abs(c.x - (CART_FOOT_N.half + BODY_CLEAR_N)) < 1e-9 && Math.abs(c.z - 60) < 1e-9, 'out the near side');
  assert.ok(Math.abs(clearOfTeam(-10, 60, team).x + CART_FOOT_N.half + BODY_CLEAR_N) < 1e-9, 'out the other side, its own');
  const back = clearOfTeam(0, -CART_FOOT_N.back + 2, team);
  assert.ok(Math.abs(back.z + CART_FOOT_N.back + BODY_CLEAR_N) < 1e-9, 'out the back');
  assert.deepEqual(clearOfTeam(500, 0, team), { x: 500, z: 0 }, 'clear, where it stood');
  const h = clearOfTeam(3, 200, { wagons: [], horses: [{ x: 0, z: 200, yaw: Math.PI / 2 }] });
  assert.ok(Math.abs(Math.abs(h.z - 200) - (HORSE_FOOT_N.side + BODY_CLEAR_N)) < 1e-9 && Math.abs(h.x - 3) < 1e-9, 'out of a horse by its side');
  // a hold-up on the march: the ring and the foes clear of the train
  const way = straight();
  const trip = { ...caravan('L1.t0:4', way, { from: { blocks: 40 } }), enc: { id: 'L1.t0:4:e', foes: [1, 2, 3, 4, 5, 6, 7], t1: 1e9 } };
  for (let s = 20000; s < 20400; s += 37) {
    const at = { phase: 'out', s, ...wayAt(way, s), halt: true, fight: true };
    const train = trainOf(trip, at, trip.party, 0, HITCH_N, LANE_N);
    const places = [...fightPlaces(trip, at, trip.party).map((m) => clearOfTeam(m.x, m.z, train)), ...foePlaces(trip, at, train)];
    for (const p of places) {
      for (const wg of train.wagons) assert.ok(!inCart(wg, p.x, p.z, BODY_CLEAR_N - 1e-6), 'none in a wagon');
      for (const hs of train.horses) {
        const dx = p.x - hs.x, dz = p.z - hs.z, f = dx * Math.sin(hs.yaw) + dz * Math.cos(hs.yaw), r = dx * Math.cos(hs.yaw) - dz * Math.sin(hs.yaw);
        assert.ok(!(Math.abs(f) < HORSE_FOOT_N.half && Math.abs(r) < HORSE_FOOT_N.side), 'none in a horse');
      }
    }
  }
  // unsaid, foePlaces is LW4's ring
  const at0 = { phase: 'out', s: 20000, ...wayAt(way, 20000) };
  assert.deepEqual(foePlaces(trip, at0), foePlaces(trip, at0, null));
  // the live stand: every body rises clear of the team handed with the party
  const spawned = [];
  const fights = createRoadFights({
    sceneOf: (x, z) => [x / 40, 0, z / 40], spawn: (type, feet) => { spawned.push(feet); return null; }, ready: () => true, owner: () => true,
    clock: () => 0, inPool: () => true, remove: () => {}, relations: () => null, turnKeyOf: () => '', dies: () => false,
  });
  const at = { phase: 'out', s: 20000, ...wayAt(way, 20000), halt: true, fight: true };
  const train = trainOf(trip, at, trip.party, 0, HITCH_N, LANE_N);
  fights.frame([{ trip, at, team: train }], { x: at.x, z: at.z }, 10);
  assert.ok(spawned.length >= trip.enc.foes.length, 'its bodies asked for');
  for (const f of spawned) for (const wg of train.wagons) assert.ok(!inCart(wg, f[0] * 40, f[2] * 40, BODY_CLEAR_N - 1e-6), 'none rises in a wagon');
});

test('AUDIT LW-III the caravans clear, on the synthetic map: two days of every party laid as the roads\' layer lays it - no wagon in another\'s, nobody of another party in a wagon, no fight\'s body in a wagon or a horse, no parked horse in a cart, every wagon facing its horse (the audit\'s probe, before: 464 minutes of wagons met, 82 parties walked through a wagon, 62 fight bodies in a team, every camp\'s horse in its cart, the shafts up to 31 degrees off their horse)', () => {
  const map = livingMap();
  const o = { mpm: CALENDAR_MPM, memo: new Map() };
  const D0 = 300, D1 = 302;
  const trips = partiesOver(map, D0, D1, o);
  const hitchN = 3.8 * NATIVE_PER_M;
  const bad = { met: 0, through: 0, fight: 0, horse: 0, face: 0 };
  let marched = 0, camps = 0;
  for (let t = D0 * DAY_MIN; t < D1 * DAY_MIN; t += 4) {
    const live = [];
    for (const trip of trips) {
      const at = partyAt(trip, t);
      if ((at.phase !== 'out' && at.phase !== 'back') || at.inn) continue;
      const members = membersAt(trip, t);
      if (members.length) live.push({ trip, at, members });
    }
    const groups = campGroups(live.filter((p) => p.at.camp));
    const lanes = roadLanes(live.filter((p) => !p.at.camp), hitchN);
    const laid = live.map(({ trip, at, members }) => {
      const k = teamOf(trip), has = k.wagons + k.packs > 0, camp = groups.get(trip.id) ?? null;
      let people, team = { wagons: [], horses: [] };
      if (has && !at.camp) {
        const tr = trainOf(trip, at, members, t, hitchN, lanes.get(trip.id));
        team = tr; people = at.fight ? fightPlaces(trip, at, members) : tr.people;
      } else {
        people = at.fight ? fightPlaces(trip, at, members) : partyPlaces({ ...trip, party: members }, at, at.fight ? null : camp, lanes.get(trip.id) ?? LANE_N);
        if (has) team = campParkOf(trip, at, camp, t);   // the layer's own park
      }
      if (at.fight && has) people = [...people.map((m) => clearOfTeam(m.x, m.z, team)), ...foePlaces(trip, at, team)];
      return { trip, at, people, team };
    });
    for (const p of laid) {
      if (!p.team.wagons.length) continue;
      if (!p.at.camp && !p.at.halt) {
        marched++;
        p.team.wagons.forEach((w, i) => { const h = p.team.horses[i]; if (turnOf(Math.atan2(h.x - w.x, h.z - w.z), w.yaw) > 1e-6) bad.face++; });
      }
      if (p.at.fight) for (const m of p.people) if (p.team.wagons.some((w) => inCart(w, m.x, m.z))) bad.fight++;
      if (p.at.camp) {
        camps++;
        for (const h of p.team.horses) for (const f of [-HORSE_FOOT_N.half, 0, HORSE_FOOT_N.half]) if (p.team.wagons.some((w) => inCart(w, h.x + Math.sin(h.yaw) * f, h.z + Math.cos(h.yaw) * f))) bad.horse++;
      }
      for (const q of laid) {
        if (q === p) continue;
        for (const m of q.people) if (p.team.wagons.some((w) => inCart(w, m.x, m.z))) bad.through++;
        if (q.trip.id > p.trip.id) for (const a of p.team.wagons) for (const b of q.team.wagons) if (cartsMeet(a, b)) bad.met++;
      }
    }
  }
  assert.ok(marched > 1000 && camps > 1000, `the probe saw caravans walk (${marched}) and camp (${camps})`);
  assert.deepEqual(bad, { met: 0, through: 0, fight: 0, horse: 0, face: 0 });
});
