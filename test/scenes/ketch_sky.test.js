// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 2): THE KETCH IN DAGGERFALL'S SKY - her flight on the shared
// clock alone (sighted from the east, turning to her station's heading; still at her station with her anchor-lift let
// down; weighing anchor, turning west and gone), her matrix standing her lift where the map says it hangs, and the set:
// her collider only while she keeps station, the lift's ride (a body in it KT_BOARD_HOLD_MS rises; set down by the way
// down it must step out first; nobody rides while the client says no), her draws. tools/mutants/ketch_sky.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ketchSkyPose, ketchSkyMatrix, createKetchSky, KT_SKY, KT_STATION_MID, KT_LIFT_AT, KT_BOARD_HOLD_MS, KT_SKY_BUCKET, KT_SKY_TEXT, KT_LIFT_NEAR_M } from '../../src/scenes/ketch/ketchSky.js';
import { ketchVoyageOf, KT_SIGHT_MS } from '../../src/net/ketch/ketchLaw.js';
import { deckToDungeon, KT_ANCHOR_LIFT } from '../../src/net/ketch/ketchDeck.js';
import { KT_GROUND, KT_SKY_CHAIN, buildKetchShip } from '../../src/world/ketch/ketchModel.js';

const v = ketchVoyageOf(2);
const apply = (M, [x, y, z]) => [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]];
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

test('KETCH HER FLIGHT ON THE CLOCK: nowhere while away; sighted far to the east and high, bow west, closing as she slows and turning to her heading at the last; still at her station, her lift let down over its time; weighing anchor - the lift drawn up, the turn west, then gaining way west and height until out of sight (mutants: she comes from the west; the lift down while sighted; she never leaves)', () => {
  assert.equal(ketchSkyPose(v.sightAt - 1), null);
  const s0 = ketchSkyPose(v.sightAt);
  assert.ok(near(s0.dx, KT_SKY.approach) && s0.dy > KT_SKY.high - KT_SKY.bob - 1e-6 && near(s0.yaw, Math.PI / 2), 'far east, high, bow west');
  assert.equal(s0.lift, 0);
  const s1 = ketchSkyPose(v.sightAt + KT_SIGHT_MS / 2);
  assert.ok(s1.dx < s0.dx && s1.dx > 0, 'closing');
  assert.ok(near(s1.yaw, Math.PI / 2), 'not yet turning');
  const s2 = ketchSkyPose(v.at - 1);
  assert.ok(s2.dx < 1 && Math.abs(s2.yaw) < 0.01, 'at her station, turned to her heading');
  const d0 = ketchSkyPose(v.at), d1 = ketchSkyPose(v.at + KT_SKY.lower / 2), d2 = ketchSkyPose(v.at + KT_SKY.lower);
  assert.deepEqual([d0.dx, d0.dy, d0.yaw, d0.lift, d0.moving], [0, 0, 0, 0, false]);
  assert.ok(near(d1.lift, 0.5) && d2.lift === 1, 'the lift let down');
  const g0 = ketchSkyPose(v.departAt + KT_SKY.lower / 2);
  assert.ok(near(g0.lift, 0.5) && g0.dx === 0 && g0.moving === false, 'the lift drawn up first');
  const g1 = ketchSkyPose(v.departAt + KT_SKY.lower + KT_SKY.turnWest / 2);
  assert.ok(near(g1.yaw, Math.PI / 4) && g1.dx === 0, 'turning west');
  const g2 = ketchSkyPose(v.departAt + KT_SKY.lower + KT_SKY.turnWest + 60_000);
  assert.ok(g2.dx < 0 && g2.dy > 0 && near(g2.yaw, Math.PI / 2), 'west and climbing');
  let t = v.departAt + KT_SKY.lower + KT_SKY.turnWest;
  while (ketchSkyPose(t)) t += 10_000;
  assert.ok(t < v.endAt, 'out of sight before the crews\' last minutes end');
});

test('KETCH HER MATRIX: at her station her anchor-lift hangs where the map says (her station\'s, the city\'s frame), her deck at the height asked; bow west at a quarter turn (mutants: the turn the wrong way; her middle forgotten)', () => {
  const M = new Float32Array(16), mid = [KT_STATION_MID.x + 100, 40, KT_STATION_MID.z - 50];
  ketchSkyMatrix(M, mid, ketchSkyPose(v.at));
  const p = apply(M, deckToDungeon(KT_ANCHOR_LIFT.x, 0, KT_ANCHOR_LIFT.z));
  assert.ok(near(p[0], KT_LIFT_AT.x + 100, 1e-3) && near(p[1], 40, 1e-3) && near(p[2], KT_LIFT_AT.z - 50, 1e-3));
  ketchSkyMatrix(M, mid, { dx: 0, dy: 0, dz: 0, yaw: Math.PI / 2 });
  const bow = apply(M, deckToDungeon(0, 0, 0)), stern = apply(M, deckToDungeon(0, 0, 200));
  assert.ok(bow[0] < stern[0] && near(bow[2], stern[2], 1e-3), 'the bow west of the stern');
  ketchSkyMatrix(M, mid, { dx: 0, dy: 0, dz: 0, yaw: 0 });
  const bow0 = apply(M, deckToDungeon(0, 0, 0)), stern0 = apply(M, deckToDungeon(0, 0, 200));
  assert.ok(bow0[2] < stern0[2], 'at her heading the bow south (deck +z north)');
});

/** The set over a fake city at (1000, 2000), its fields at 50, a fake collider and renderer. */
function sky({ mayBoard = () => true } = {}) {
  let clock = v.at + KT_SKY.lower + 1000, f = null;
  const col = { buckets: new Map(), adds: 0, addMesh(b, p, i, m) { this.adds++; this.buckets.set(b, m); }, removeBucket(b) { this.buckets.delete(b); } };
  const draws = [], said = [];
  let boards = 0;
  const S = createKetchSky({
    renderer: { createMesh: (m) => ({ m }), drawMesh: (mesh, M) => draws.push(mesh), destroyMesh() {} },
    collider: () => col, city: () => [1000, 2000], groundAt: () => 50, frameY: () => 0, now: () => clock,
    feet: () => f, say: (t) => said.push(t), onBoard: () => boards++, mayBoard,
  });
  return { S, col, draws, said, boards: () => boards, set: (t) => { clock = t; }, step: (ms) => { clock += ms; }, stand: (p) => { f = p; }, now: () => clock };
}

test('KETCH HER SET - her collider while she keeps station (laid once, the same matrix never laid again), taken up as she weighs anchor; her ship, chain and cage drawn while the lift is down (mutants: her collider while she moves; laid every frame; the lift drawn up yet drawn)', () => {
  const k = sky();
  const p = k.S.frame();
  assert.ok(p && p.still);
  assert.equal(p.ground, 50);
  assert.equal(p.deck, 50 - KT_GROUND.y);
  assert.deepEqual(p.lift, [1000 + KT_LIFT_AT.x, 50, 2000 + KT_LIFT_AT.z], 'the cage on the fields');
  assert.ok(k.col.buckets.has(KT_SKY_BUCKET));
  k.step(250); k.S.frame();
  assert.equal(k.col.adds, 1, 'the same matrix: laid once');
  assert.equal(k.S.draw(), 1);
  assert.equal(k.draws.length, 4, 'ship, lamps, chain, cage');   // PIN MOVED (AUDIT SHIP A4): her lamps a mesh of their own (KETCH-LOOK KL1), drawn outside too
  const L = buildKetchShip().lamps;
  assert.ok(k.draws.some((d) => d.m.positions.length === L.positions.length && d.m.indices.length === L.indices.length), 'her lamps among them');
  const drawn = k.draws.length;
  k.set(v.at - 60_000);
  k.S.frame();
  k.S.draw();
  assert.equal(k.draws.length - drawn, 2, 'sighted, her lift drawn up: her ship and her lamps alone');
  k.set(v.departAt + 1000);
  const q = k.S.frame();
  assert.ok(q.lift[1] > 50 && q.lift[1] <= 50 + KT_SKY_CHAIN, 'the cage rising');
  assert.equal(k.col.buckets.has(KT_SKY_BUCKET), false, 'weighing anchor: her hull no floor');
  k.set(v.endAt + 1);
  assert.equal(k.S.frame(), null);
});

test('KETCH THE LIFT\'S RIDE: near it, its word once; a body standing in the lowered cage counts down and rises KT_BOARD_HOLD_MS on; stepping out stops the count; set down by the way down it must step out before it rises again; nobody rides while the client says no or before the lift is down (mutants: a ride at once; set down and straight back up; a ride while refused)', () => {
  const k = sky();
  const p = k.S.frame();
  k.stand([p.lift[0] + KT_LIFT_NEAR_M - 1, 50, p.lift[2]]);
  k.S.frame(); k.S.frame();
  assert.deepEqual(k.said, [KT_SKY_TEXT.near], 'said once');
  k.stand([p.lift[0], 50, p.lift[2]]);
  for (let t = 0; t < KT_BOARD_HOLD_MS - 250; t += 250) { k.S.frame(); k.step(250); }
  assert.equal(k.boards(), 0, 'not yet');
  assert.ok(k.said.includes(KT_SKY_TEXT.rising(3)) && k.said.includes(KT_SKY_TEXT.rising(1)));
  k.step(250); k.S.frame();
  assert.equal(k.boards(), 1, 'up');
  const before = k.said.length;
  for (let t = 0; t < 2 * KT_BOARD_HOLD_MS; t += 250) { k.S.frame(); k.step(250); }
  assert.deepEqual([k.boards(), k.said.length], [1, before], 'refused, still in the cage: asked once, no count again (AUDIT KETCH L3-2)');
  k.S.hold();
  for (let t = 0; t < 2 * KT_BOARD_HOLD_MS; t += 250) { k.S.frame(); k.step(250); }
  assert.equal(k.boards(), 1, 'set down in it: it must step out first');
  k.stand([p.lift[0] + 5, 50, p.lift[2]]); k.S.frame(); k.step(250);
  k.stand([p.lift[0], 50, p.lift[2]]);
  for (let t = 0; t <= KT_BOARD_HOLD_MS; t += 250) { k.S.frame(); k.step(250); }
  assert.equal(k.boards(), 2, 'out and back in: up again');
  const no = sky({ mayBoard: () => false });
  const np = no.S.frame();
  no.stand([np.lift[0], 50, np.lift[2]]);
  for (let t = 0; t <= 2 * KT_BOARD_HOLD_MS; t += 250) { no.S.frame(); no.step(250); }
  assert.equal(no.boards(), 0, 'the client says no');
  const early = sky();
  early.set(v.at + 1000);
  const ep = early.S.frame();
  early.stand([ep.lift[0], ep.lift[1], ep.lift[2]]);
  for (let t = 0; t <= 2 * KT_BOARD_HOLD_MS; t += 250) { early.S.frame(); early.step(250); }
  assert.equal(early.boards(), 0, 'the lift still coming down');
});
