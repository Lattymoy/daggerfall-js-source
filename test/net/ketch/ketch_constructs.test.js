// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md sections 5 and 8): THE KETCH'S CONSTRUCTS AND THE SHIP'S BLOWS
// JUDGED - the five kinds and their blows (every one a full shape stamp held at the wind-up floor, the Captain's Stomp
// and its jumped Tonal Wave), their health by the crew, a body kept on its floor and walked round what stands on it, a
// spider at a carrier, a sentry keeping its range, a blow on one believed (risen, the hand, its storey, its reach, a
// Warden struck waking); and the relay's judge - a plain blow counted on a body deep in it before and after, an
// element's or a jumped one's only knocking a cell loose, the hazards on the shared clock on their storey.
// tools/mutants/ketch_constructs.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KT_KINDS, KT_KIND_BY_K, KT_FLOORS, KT_OBSTACLES, keepOnFloor, steer, newConstruct, constructHp, bodyWord, constructBlows, constructAllows,
  chooseFor, beatConstruct, hitConstruct, constructAt, mvWord,
} from '../../../src/net/ketch/ketchConstructs.js';
import { judgeVoyage, KT_STOREY_BAND, KT_HAZARD_SPAN_S } from '../../../src/net/ketch/ketchJudge.js';
import { KT_LIFT, KT_MAIN_MAST, KT_HOLD, KT_GALLERY, KT_HAMMER, hammerPhase, KT_ARCS, KT_ANCHOR, KT_WAIST, ketchBowHalf } from '../../../src/net/ketch/ketchDeck.js';
import { dpsRef, HIT_KINDS, MELEE_REACH, POSE_SLACK, BUCKET_DEPTH_X, GATE_HIT_HZ_MAX, REPEAT_MAX } from '../../../src/net/gate/gateBrain.js';
import { egFloorWindup } from '../../../src/net/eliteGates/egShape.js';
import { BODY_AFTER_MS } from '../../../src/net/bossBody.js';

const T0 = 1_800_000_000_000;
const seeded = (s) => () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
const member = (lv = 30, now = T0) => ({ name: 'P', lv, dealt: 0, clipped: 0, bucket: BUCKET_DEPTH_X * dpsRef(lv), bucketAt: now, rate: GATE_HIT_HZ_MAX, rateAt: now });

test('KETCH THE KINDS: five on the wire in order (sphere, sentry, spider, Hammer Warden, Watch-Captain); every blow\'s shape one the stamps know and its wind-up held at THE WIND-UP FLOOR; the Captain\'s Stomp answering its Tonal Wave a beat after, jumped (mutants: two kinds\' numbers swapped; the wave unjumped; a wind-up under the floor)', () => {
  assert.deepEqual(KT_KIND_BY_K.map((K) => K.key), ['sphere', 'sentry', 'spider', 'warden', 'captain']);
  for (const K of KT_KIND_BY_K) for (const A of K.blows) assert.ok(['lane', 'self', 'ahead', 'cone', 'at', 'ats'].includes(A.sh), `${K.key} ${A.key}`);
  for (const K of KT_KIND_BY_K) {
    const B = newConstruct(1, K.key, K.key === 'warden' ? 'landing' : K.key === 'spider' ? 'hold' : 'waist', 0, 40, 0, 100, T0);
    for (const A of K.blows) {
      const made = constructBlows(B, A, 1, T0, { x: B.x, z: B.z + 3 }, [{ x: B.x, z: B.z + 3 }]);
      assert.ok(made[0].wu >= A.wu && made[0].wu === egFloorWindup(A.wu, made[0].s), `${K.key} ${A.key} at the floor`);
      assert.equal(made[0].at, T0 + made[0].wu);
      assert.equal(made[0].y, B.y, 'its floor\'s height');
      assert.equal(made[0].el, A.el);
    }
  }
  const C = newConstruct(5, 'captain', 'waist', 0, 54, Math.PI, 100, T0);
  const stomp = constructBlows(C, KT_KINDS.captain.blows[0], 7, T0, { x: 0, z: 50 });
  assert.equal(stomp.length, 2);
  assert.deepEqual([stomp[1].i, stomp[1].jp, stomp[1].at - stomp[0].at], [8, 1, KT_KINDS.captain.blows[0].wave.after]);
  assert.equal(stomp[1].s[0][0], 'r', 'a ring rolling out');
});

test('KETCH THEIR HEALTH: `hpS` seconds of the crew\'s mean reference damage; the Hammer Wardens and the Captain a share a member, the frail ones none (mutants: the Wardens the crew\'s whole; a sphere scaled by the crew)', () => {
  assert.equal(constructHp('sphere', 30, 8), Math.round(KT_KINDS.sphere.hpS * dpsRef(30)));
  assert.equal(constructHp('sphere', 30, 8), constructHp('sphere', 30, 1));
  assert.equal(constructHp('warden', 30, 4), Math.round(KT_KINDS.warden.hpS * dpsRef(30) * KT_KINDS.warden.crewX * 4));
  assert.equal(constructHp('captain', 20, 3), Math.round(KT_KINDS.captain.hpS * dpsRef(20) * KT_KINDS.captain.crewX * 3));
  const B = newConstruct(101, 'sentry', 'waist', 1.234, 20.456, 0.5, 314.2, T0);
  assert.deepEqual(bodyWord(B), [101, 1, 1.23, 0, 20.46, 0.5, 315, 315]);
});

test('KETCH A BODY ON ITS FLOOR: kept inside its edge (the landing wider aft, the bridge its core\'s disc); its walk round what stands in the way - the waist\'s capstans and covers, the mast-lift\'s tower and the main mast beside it (mutants: the tower forgotten; the bridge\'s disc a square; the Watch held off the Anchor Deck)', () => {
  const W = KT_FLOORS.waist;
  assert.deepEqual(keepOnFloor(W, 40, 30, 1), [KT_WAIST.x1 - 1, 30], 'the waist\'s beam');
  assert.deepEqual(keepOnFloor(W, 40, 6, 1), [ketchBowHalf(6) - 1, 6], 'and the Anchor Deck\'s, narrower - the waist\'s floor runs over it');   // PIN MOVED (AUDIT KETCH II L4-4): its box's beam before - the bow narrows inside it
  assert.deepEqual(keepOnFloor(W, 0, -5, 1), [0, KT_ANCHOR.z0 + 1], 'never off the bow');
  assert.deepEqual(keepOnFloor(KT_FLOORS.landing, 8, 120, 0), [8, 120], 'the landing wider aft');
  assert.deepEqual(keepOnFloor(KT_FLOORS.landing, 8, 100, 0), [KT_GALLERY.x1, 100], 'the corridor before it');
  const [bx, bz] = keepOnFloor(KT_FLOORS.bridge, 30, 230, 0);   // off the axes: a disc, never its square
  assert.ok(Math.abs(Math.hypot(bx, bz - 200) - KT_FLOORS.bridge.disc) < 1e-9, 'kept on the core\'s disc');
  const tower = KT_OBSTACLES.waist.find(([x, z]) => x === KT_LIFT.x && z === KT_LIFT.z);
  assert.ok(tower && tower[2] >= KT_LIFT.half * Math.SQRT2, 'the tower, whole');
  assert.ok(KT_OBSTACLES.waist.some(([x, z]) => x === KT_MAIN_MAST.x && z === KT_MAIN_MAST.z), 'and the mast');
  const way = steer('waist', KT_LIFT.x, KT_LIFT.z - 8, KT_LIFT.x, KT_LIFT.z + 8, 0.9);
  assert.notDeepEqual(way, [KT_LIFT.x, KT_LIFT.z + 8], 'a waypoint round the tower');
  assert.ok(Math.hypot(way[0] - KT_LIFT.x, way[1] - KT_LIFT.z) > tower[2], 'clear of it');
  assert.deepEqual(steer('landing', 0, 100, 0, 120, 1), [0, 120], 'nothing in the way: straight');
});

test('KETCH WHOM A BODY GOES AT: a spider at a carrier when one stands on its floor; the most threat that often; else anyone; nobody - nobody (mutants: the spider blind to carriers)', () => {
  const S = newConstruct(1, 'spider', 'hold', 0, 100, 0, 10, T0);
  const here = [{ sub: 'a', x: 0, z: 90 }, { sub: 'b', x: 0, z: 110, carry: true }];
  const picks = Array.from({ length: 40 }, (_, k) => chooseFor(S, here, {}, seeded(k + 1))?.sub);
  assert.ok(picks.filter((s) => s === 'b').length >= 28, 'mostly the carrier');
  const P = newConstruct(2, 'sphere', 'waist', 0, 30, 0, 10, T0);
  const t = Array.from({ length: 40 }, (_, k) => chooseFor(P, here, { a: 50 }, seeded(k + 1))?.sub);
  assert.ok(t.filter((s) => s === 'a').length >= 28, 'mostly the most threat');
  assert.equal(chooseFor(P, [], {}, seeded(1)), null);
});

test('KETCH A BODY\'S BEAT: a sentry keeps its range - backing off a chosen too near; a sphere walks in and strikes; a blow in flight held to its recovery; never the same blow a third time running (mutants: a sentry closing to melee; a blow begun mid-recovery)', () => {
  const rng = seeded(4), S = { seq: 0 };
  const sentry = newConstruct(3, 'sentry', 'waist', 0, 40, 0, 100, T0);
  const out = [], blows = [];
  beatConstruct(sentry, T0, [{ sub: 'a', x: 0, z: 42 }], {}, rng, S, out, blows);
  assert.equal(out[0].k, 'mv');
  assert.ok(out[0].tz < 40, 'backing away from the one at its feet');
  const sphere = newConstruct(4, 'sphere', 'waist', 0, 20, 0, 100, T0);
  const o2 = [], b2 = [];
  beatConstruct(sphere, T0, [{ sub: 'a', x: 0, z: 23 }], {}, rng, S, o2, b2);
  assert.ok(o2.some((f) => f.k === 'bl'), 'a blow');
  const until = sphere.until;
  const o3 = [];
  for (const at of [T0 + 250, T0 + 700, T0 + 1200, until - 1]) beatConstruct(sphere, at, [{ sub: 'a', x: 0, z: 23 }], {}, rng, S, o3, b2);
  assert.deepEqual(o3, [], 'held to its recovery - no blow begun before it ends');
  assert.deepEqual(constructAllows('sphere', 1, 0, 1).map((A) => A.key), ['spark'], 'the last left out');
  assert.deepEqual(constructAllows('spider', 1, 0, REPEAT_MAX), [], 'never a third sting running');
  const bow = newConstruct(6, 'sphere', 'waist', 0, 20, Math.PI, 100, T0), o5 = [];
  beatConstruct(bow, T0, [{ sub: 'a', x: 0, z: 6 }], {}, rng, S, o5, []);
  assert.ok(o5[0].k === 'mv' && o5[0].tz < KT_WAIST.z0, 'a crew at the anchor-lift: the Watch walks onto the Anchor Deck at it');
  const far = newConstruct(5, 'sphere', 'waist', 0, 20, 0, 100, T0), o4 = [];
  beatConstruct(far, T0, [{ sub: 'a', x: 0, z: 40 }], {}, rng, S, o4, []);
  assert.equal(o4[0].k, 'mv');
  assert.deepEqual(mvWord(far, T0), o4[0]);
  const [x1, z1] = constructAt(far, T0 + 1000);
  assert.ok(z1 > 20 && Math.abs(z1 - 20 - KT_KINDS.sphere.speed) < 1e-6 && x1 === 0, 'its walk read at a moment');
});

test('KETCH A BLOW ON A CONSTRUCT: nothing on a body not yet risen or down, past the hand, from another storey, or a swing past its reach; the purse\'s acceptance off its health; a sleeping Warden struck wakes (mutants: struck before it rises; a storey ignored; a sleeping Warden struck on)', () => {
  const B = newConstruct(9, 'sphere', 'waist', 0, 30, 0, 200, T0, { upAt: T0 + 1000 });
  const p = member();
  assert.equal(hitConstruct(B, p, 50, HIT_KINDS.Shaft, { x: 0, y: 0, z: 25 }, T0 + 500), 0, 'rising');
  const t = T0 + 1000;
  assert.equal(hitConstruct(B, p, 50, HIT_KINDS.Shaft, { x: 0, y: -6, z: 25 }, t), 0, 'a storey below');
  assert.equal(hitConstruct(B, p, 50, HIT_KINDS.Melee, { x: 0, y: 0, z: 30 - KT_KINDS.sphere.r - MELEE_REACH - POSE_SLACK - 0.5 }, t + 250), 0, 'a swing past reach');
  assert.equal(hitConstruct(B, p, 50, HIT_KINDS.Melee, { x: 0, y: 0, z: 28 }, t + 500), 50);
  assert.equal(B.h, 150);
  const q = member();
  q.rate = 0; q.rateAt = t + 500;
  assert.equal(hitConstruct(B, q, 50, HIT_KINDS.Shaft, { x: 0, y: 0, z: 28 }, t + 500), 0, 'past the hand');
  const W = newConstruct(10, 'warden', 'landing', -4, 118, Math.PI, 500, T0, { wake: false });
  assert.ok(hitConstruct(W, member(), 10, HIT_KINDS.Shaft, { x: 0, y: -6, z: 110 }, T0) > 0);
  assert.equal(W.wake, true);
  B.h = 0;
  assert.equal(hitConstruct(B, member(), 50, HIT_KINDS.Shaft, { x: 0, y: 0, z: 28 }, t + 900), 0, 'down');
});

test('KETCH THE JUDGE - a construct\'s blow: its plain share on a body deep in it before and after its landing, once; an element\'s or a jumped one\'s never counted, but every account any blow met is struck (its cell knocked loose) - save a jump\'s; never another storey\'s (mutants: the fire counted; a jumped wave knocking a cell; the storey ignored)', () => {
  const at = T0 + 10_000;
  const body = (sub, x, z, y = 0) => ({ sub, x, z, y, dead: false, tr: [[at - 100, x, z, y], [at + 100, x, z, y]] });
  const V = { players: { a: {}, b: {}, c: {} }, blows: [
    { i: 1, o: 100, s: [['d', 0, 30, 3]], at, wu: 1000, p: 0.1, b: 6, el: null, y: 0 },
    { i: 2, o: 100, s: [['d', 10, 30, 3]], at, wu: 1000, p: 0.1, b: 6, el: 'shock', y: 0 },
    { i: 3, o: 100, s: [['d', 20, 30, 3]], at, wu: 1000, p: 0.1, b: 6, el: null, y: 0, jp: 1 },
  ], hzAt: (at + 5000) / 1000 };
  const { hits, struck } = judgeVoyage(V, [body('a', 0, 30), body('b', 10, 30), body('c', 20, 30)], at + BODY_AFTER_MS);
  assert.deepEqual(hits, [{ sub: 'a', share: 0.1 }]);
  assert.deepEqual([...struck].sort(), ['a', 'b'], 'the shock knocks b\'s cell; the jumped wave nobody\'s');
  assert.deepEqual(judgeVoyage(V, [body('a', 0, 30)], at + BODY_AFTER_MS + 500).hits, [], 'once');
  const U = { players: { a: {} }, blows: [{ i: 4, o: 100, s: [['d', 0, 30, 3]], at, wu: 1000, p: 0.1, b: 6, el: null, y: 0 }], hzAt: (at + 5000) / 1000 };
  assert.deepEqual(judgeVoyage(U, [body('a', 0, 30, -6 - KT_STOREY_BAND)], at + BODY_AFTER_MS).hits, [], 'a storey below');
});

test('KETCH THE JUDGE - the ship\'s hazards on the shared clock: a hammer landing on a body in its lane, on the gun deck\'s storey; an arc-coil live striking a carrier through its span; nothing judged on a floor nobody stands on; a long sleep judged over KT_HAZARD_SPAN_S at most (mutants: the hold\'s arcs judged with nobody in the hold; the span unbounded; the crossing unread; a crossing straddling the waking counted; the deck above crossing)', () => {
  // the first hammer (row 0, lane 0) lands at its phase; a body under it on the gun deck
  const ph = hammerPhase(0, 0), z = KT_HAMMER.rows[0], x = KT_HAMMER.lanes[0];
  const landMs = Math.round((ph + KT_HAMMER.cycle * 1000) * 1000), atS = landMs / 1000;
  const g = (sub) => ({ sub, x, z, y: KT_GALLERY.y, dead: false, tr: [[landMs - 100, x, z, KT_GALLERY.y], [landMs + 100, x, z, KT_GALLERY.y]] });
  const V = { players: { a: {} }, blows: [], hzAt: atS - 0.5 };
  const r = judgeVoyage(V, [g('a')], landMs + BODY_AFTER_MS + 10);
  assert.deepEqual(r.hits, [{ sub: 'a', share: KT_HAMMER.p }]);
  assert.ok(r.struck.has('a'));
  // an arc in the hold: a lane narrower than the margin (nobody stands deep in it) - a carrier CROSSING it while it is live
  const az = KT_ARCS.z[0], arcAt = Math.round(KT_ARCS.cycle * 1000 * 1000);
  assert.ok(KT_ARCS.w / 2 < 1.5, 'too narrow to stand deep in');
  const carrier = (tr) => ({ sub: 'a', x: 0, z: tr.at(-1)[2], y: KT_HOLD.y, dead: false, tr });
  const across = (tr) => { const H = { players: { a: {} }, blows: [], hzAt: arcAt / 1000 - 0.5 }, b = carrier(tr), s = new Set(); for (const t of [arcAt + BODY_AFTER_MS, arcAt + 900 + BODY_AFTER_MS, arcAt + 1500 + BODY_AFTER_MS]) { const r = judgeVoyage(H, [b], t); for (const x of r.struck) s.add(x); assert.deepEqual(r.hits, [], 'an element\'s: knocked, never counted'); } return s.has('a'); };
  assert.equal(across([[arcAt + 200, 0, az + 3, KT_HOLD.y], [arcAt + 500, 0, az - 3, KT_HOLD.y]]), true, 'crossed while live: struck');
  assert.equal(across([[arcAt - 100, 0, az + 3, KT_HOLD.y], [arcAt + 200, 0, az - 3, KT_HOLD.y]]), false, 'a crossing straddling its waking: the carrier\'s favour');
  assert.equal(across([[arcAt + 200, 0, az + 3, KT_HOLD.y], [arcAt + 500, 0, az + 1.5, KT_HOLD.y]]), false, 'short of it');
  assert.equal(across([[arcAt + 200, 0, az + 3, 0], [arcAt + 500, 0, az - 3, 0]]), false, 'the deck above');
  assert.equal(across([[arcAt + 200, 14, az + 3, KT_HOLD.y], [arcAt + 500, 14, az - 3, KT_HOLD.y]]), false, 'past its posts');
  const h = carrier([[arcAt + 200, 0, az + 3, KT_HOLD.y], [arcAt + 500, 0, az - 3, KT_HOLD.y]]);
  // nobody in the hold: its arcs never queued
  const E = { players: { a: {} }, blows: [], hzAt: arcAt / 1000 - 0.5 };
  judgeVoyage(E, [{ ...h, y: 0, z: 30, tr: [] }], arcAt + BODY_AFTER_MS);
  assert.deepEqual(E.hzq, []);
  // a room asleep an hour: only the last span judged
  const L = { players: { a: {} }, blows: [], hzAt: 1000 };
  const slept = judgeVoyage(L, [g('a')], 3_600_000 + 1_000_000);
  assert.ok(slept.hits.length <= 1, `an hour asleep judges the last span alone, never every hammer of the hour (${slept.hits.length})`);
  assert.ok(L.hzq.every((hz) => hz.at >= (3_600_000 + 1_000_000 - BODY_AFTER_MS) - KT_HAZARD_SPAN_S * 1000 - 1), 'over the span alone');
});
