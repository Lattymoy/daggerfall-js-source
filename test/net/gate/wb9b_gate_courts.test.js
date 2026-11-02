// WB9b (2026-09-30, Mac: "I want to add 2 more arena's of the same size that the boss leaps to between each phase. A
// walkway should form to allow players to traverse through each arena."): THREE COURTS AND THE WALKWAYS LAID BETWEEN
// THEM. The Warden fights each phase in its own court - the first where the players arrive, then west, then north - and
// at each phase's turn he BOUNDS across the fire to the next court's heart; the bound's word lays a walkway from the
// court he leaves, stone by stone out of the fire, and he waits there under his ward for a challenger to cross it.
//
//   the floor's law    net/gate/gateBrain.js COURTS, WALKS, walkFormed, onFloor, clampToFloor - the relay's bound on where a
//                      blow may come from and the motor's on where a player may walk, one law at both ends
//   the brain           PHASE_TURN's bound, the wait (CROSS_WAIT_MAX_MS), his court (`court`), the crossings (`xa`)
//   the wire and link   the state's `ct` and `xa`; a bound's word lays its walkway on every screen at once (crossLaid)
//   the screen          the motor's clamp (world/gate/gateArena.js courtArena), the slabs rising (slabRise, slabMatrix), the
//                       telegraph over the court it lands in, the braziers nearest first, the land clear of the floor
//
// Design: bible/11-Multiplayer/World-Bosses.md section 14 (WB9b).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  COURTS, COURTS_HIS, PLAN_PLAIN, COURT_R, COURT_CENTRE, WALKS, WALK_HALF_W, WALK_LEAD_MS, WALK_FORM_MS, WALK_SINK_M, BOSS_REACH_R, POSE_SLACK, SHIELD_MS,
  ATTACKS, PHASE_AT, PHASE_TURN, TURN_BREATH_MS, CROSS_AIR_MS, CROSS_WAIT_MAX_MS, CROSS_WARD_MAX_MS, HIT_KINDS,
  courtOfPhase, nearestCourt, inCourt, walkwayOf, walkFormed, onFloor, clampToFloor, keepInCourt, leapAt, airOf, windupOf,
  newFight, joinFight, applyHit, stepBrain, stateOf,
} from '../../../src/net/gate/gateBrain.js';
import { validGateOut, GATE_COURT_BOUND } from '../../../src/net/wire.js';
import { foldGate, crossLaid, GATE_STATE_EMPTY } from '../../../src/net/gate/gateLink.js';
import {
  courtArena, courtArenaAt, courtToDungeon, walkSlabs, slabRise, slabMatrix, buildWalkSlabModel, courtLights, courtLightsNear, courtOpenings,
  courtSpireAxes, courtBraziers, SLAB_LEN_M, SLAB_RISE_MS, LAVA_Y,
} from '../../../src/world/gate/gateArena.js';
import { bossPlace, bossHop, bossAct, CROSS_HEIGHT, BOSS_CUES, QUAKE_ON, ATTACK_COLORS } from '../../../src/world/gate/gateBoss.js';
import { telegraphShape, GateTelegraphRenderer } from '../../../src/render/gate/gateTelegraph.js';
import { deadlandsIslands, floorGap, LAND_CLEAR_M } from '../../../src/world/deadlandsLand.js';
import { PlayerMotor } from '../../../src/player/motor.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_000_000;
function seeded(s) {
  let a = s >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function fightOf(lvs = [10]) {
  const f = newFight(7, T0, T0 + 3_600_000, 'ruhn');
  lvs.forEach((lv, i) => assert.ok(joinFight(f, `s${i + 1}`, `P${i + 1}`, lv, T0, true)));
  return f;
}
const body = (sub, x, z, dead = false) => ({ sub, x, z, dead });
const at = (k, dx = 0, dz = 0) => [COURTS[k][0] + dx, COURTS[k][1] + dz];

// ═══ THE FLOOR ═══════════════════════════════════════════════════════════════════════════════════════════════════

test('WB9b the courts: three of the first court\'s size, never meeting, each rim a walkway\'s length from the next; west then north, clear of the great tower\'s window; each phase fought in its own (mutants: a court moved onto another)', () => {
  assert.equal(COURTS_HIS, 3, 'his three - WB14b: the portents\' floors follow them in the one table (wb14b_portents.test.js)');
  assert.deepEqual(COURTS[0], [0, 0], 'the first where the players arrive - the court frame\'s origin');
  for (let k = 1; k < COURTS_HIS; k++) {
    const gap = Math.hypot(COURTS[k][0] - COURTS[k - 1][0], COURTS[k][1] - COURTS[k - 1][1]) - 2 * COURT_R;
    assert.ok(gap >= 18 && gap <= 30, `court ${k} stands ${gap.toFixed(1)} m past the last one's rim`);
  }
  assert.ok(COURTS[1][0] < -40 && COURTS[2][1] < -60, 'west, then north (-z is toward the boss from the arrival)');
  for (let a = 0; a < COURTS_HIS; a++) for (let b = a + 1; b < COURTS_HIS; b++) assert.ok(Math.hypot(COURTS[a][0] - COURTS[b][0], COURTS[a][1] - COURTS[b][1]) > 2 * COURT_R + 10);
  assert.deepEqual([1, 2, 3].map(courtOfPhase), [0, 1, 2]);
  assert.equal(courtOfPhase(9), 2); assert.equal(courtOfPhase(0), 0);
  for (let k = 0; k < 3; k++) {
    assert.equal(nearestCourt(...at(k, 5, -7)), k);
    assert.ok(inCourt(...at(k, COURT_R - 0.1, 0), k) && !inCourt(...at(k, COURT_R + 0.5, 0), k) && inCourt(...at(k, COURT_R + 0.5, 0), k, POSE_SLACK));
  }
  assert.ok(GATE_COURT_BOUND >= Math.max(...COURTS.slice(0, COURTS_HIS).map(([x, z]) => Math.hypot(x, z) + COURT_R)) + 10, 'the wire\'s bound holds the third court\'s far rim');
});

test('WB9b the walkways: walkway k joins court k to court k+1 along the line between their hearts, WALK_SINK_M into each floor (no seam at a rim), WALK_HALF_W either side; laid from WALK_LEAD_MS after its bound\'s word over WALK_FORM_MS, and nothing before a word (mutants: laid at the word; a walkway never ending)', () => {
  assert.equal(PLAN_PLAIN.walks.length, COURTS_HIS - 1, 'a plain night\'s two');
  for (const w of WALKS) {
    assert.deepEqual(w, walkwayOf(w.k));
    const A = COURTS[w.a], B = COURTS[w.b];   // WB14b: walkway k joins floor a to floor b (the plain night's two: court k to court k+1)
    if (w.k < 2) assert.deepEqual([w.a, w.b], [w.k, w.k + 1]);
    assert.ok(Math.abs(Math.hypot(w.ax - A[0], w.az - A[1]) - (COURT_R - WALK_SINK_M)) < 1e-9, 'it begins inside the court it leaves');
    assert.ok(Math.abs(Math.hypot(w.bx - B[0], w.bz - B[1]) - (COURT_R - WALK_SINK_M)) < 1e-9, 'and ends inside the one it reaches');
    assert.ok(Math.abs(w.len - (Math.hypot(B[0] - A[0], B[1] - A[1]) - 2 * (COURT_R - WALK_SINK_M))) < 1e-9);
    assert.ok(Math.abs(Math.hypot(w.ux, w.uz) - 1) < 1e-12);
  }
  assert.equal(walkwayOf(WALKS.length), null, 'no walkway past the last');
  const xa = [T0];
  assert.equal(walkFormed([], 0, T0 + 99999), 0, 'no word, no walkway');
  assert.equal(walkFormed(xa, 0, T0 + WALK_LEAD_MS), 0, 'the lead first - the stones still under the fire');
  assert.equal(walkFormed(xa, 0, T0 + WALK_LEAD_MS + WALK_FORM_MS / 2), 0.5);
  assert.equal(walkFormed(xa, 0, T0 + WALK_LEAD_MS + WALK_FORM_MS + 5000), 1);
  assert.equal(walkFormed(xa, 1, T0 + 99999), 0, 'the second has its own word');
  assert.ok(WALK_LEAD_MS + WALK_FORM_MS < windupOf(ATTACKS.cross, 2) + ATTACKS.cross.active + ATTACKS.cross.recover + CROSS_WAIT_MAX_MS, 'laid long before his wait ends');
  assert.ok(WALK_HALF_W * 2 >= 5, 'wide enough for a crowd and a dodge');
});

test('WB9b the floor a body may stand on - the relay\'s bound on a blow and the motor\'s on a step: the first court always; a walkway as far as it is laid (a pose\'s slack beyond); the next court once its walkway is whole; the nearest point of the floor for a body off it, drawn in by its own radius (mutants: the next court open before its walkway; the front ignored)', () => {
  const w = WALKS[0], mid = (t, s = 0) => [w.ax + w.ux * t + w.uz * s, w.az + w.uz * t - w.ux * s];
  assert.ok(onFloor(0, 0, [], T0) && onFloor(...at(0, 0, COURT_R - 0.1), [], T0));
  assert.ok(!onFloor(...at(1), [], T0), 'the second court closed with no crossing');
  assert.ok(!onFloor(...mid(3), [], T0), 'no walkway');
  const xa = [T0], half = T0 + WALK_LEAD_MS + WALK_FORM_MS / 2;
  assert.ok(onFloor(...mid(w.len * 0.5 - 0.1), xa, half), 'laid to half its length');
  assert.ok(!onFloor(...mid(w.len * 0.5 + 0.6), xa, half), 'not past its front');
  assert.ok(onFloor(...mid(w.len * 0.5 + 0.6), xa, half, POSE_SLACK), 'a pose\'s slack beyond it');
  assert.ok(!onFloor(...mid(10, WALK_HALF_W + 0.3), xa, half), 'not off its side');
  assert.ok(!onFloor(...at(1), xa, half), 'the next court waits for the whole walkway');
  const whole = T0 + WALK_LEAD_MS + WALK_FORM_MS;
  assert.ok(onFloor(...at(1), xa, whole) && onFloor(...at(1, COURT_R - 0.2, 0), xa, whole));
  assert.ok(!onFloor(...at(2), xa, whole + 99999), 'the third waits for its own');
  assert.ok(onFloor(...at(2), [T0, T0], whole));
  assert.equal(onFloor(NaN, 0, xa, whole), false);
  // the clamp
  assert.equal(clampToFloor(...at(0, 3, 3), [], T0), null, 'on the floor: nothing to do');
  assert.deepEqual(clampToFloor(COURT_R + 5, 0, [], T0, 0.5).map((v) => Math.round(v * 1e6) / 1e6), [COURT_R - 0.5, 0], 'back to the rim, its radius in');
  const off = mid(8, WALK_HALF_W + 2), back = clampToFloor(...off, xa, whole, 0.4);
  const sb = (back[0] - w.ax) * w.uz - (back[1] - w.az) * w.ux;
  assert.ok(Math.abs(Math.abs(sb) - (WALK_HALF_W - 0.4)) < 1e-9, `onto the walkway's edge, drawn in: ${sb}`);
  const ahead = clampToFloor(...mid(w.len * 0.5 + 3), xa, half, 0);
  assert.ok(Math.abs((ahead[0] - w.ax) * w.ux + (ahead[1] - w.az) * w.uz - w.len * 0.5) < 1e-9, 'held at the laid front');
  assert.equal(clampToFloor(...at(1, 2, 2), xa, whole), null, 'standing in the court the walkway reached');
});

// ═══ THE BRAIN ═══════════════════════════════════════════════════════════════════════════════════════════════════

test('WB9b the bound: at each phase\'s turn he bounds from the court he fights in to the next one\'s heart - the ward raised through it, the walkway\'s word said with it (`xa` on the fight and in its state), his flight the leap\'s law over CROSS_AIR_MS, and from its landing he fights in the new court (mutants: the walkway never laid; the court never changed)', () => {
  const f = fightOf([10, 10]);
  const bodies = [body('s1', 3, 4), body('s2', -5, 2)];
  f.nextAt = T0; f.pos = [2, -3];
  f.hp = f.max * PHASE_AT[0];
  const out = stepBrain(f, T0 + 1000, bodies, seeded(1));
  assert.deepEqual(out.find((o) => o.k === 'ph'), { k: 'ph', n: 2, until: T0 + 1000 + CROSS_WARD_MAX_MS });
  const b = out.find((o) => o.k === 'atk');
  assert.equal(b.a, ATTACKS.cross.id);
  assert.deepEqual(b.tg, [[...COURTS[1]]]);
  assert.equal(b.at, T0 + 1000 + ATTACKS.cross.windup, 'its whole wind-up, told at once');
  assert.deepEqual(f.xa, [T0 + 1000], 'the walkway\'s word, with the bound\'s');
  assert.deepEqual(stateOf(f).xa, [T0 + 1000]);
  assert.equal(stateOf(f).ct, 0, 'still in the first court through the wind-up');
  assert.equal(airOf(ATTACKS.cross), CROSS_AIR_MS);
  const mid = leapAt(f.atk, b.at - CROSS_AIR_MS / 2);
  assert.ok(Math.abs(mid[0] - (2 + COURTS[1][0]) / 2) < 1e-9 && Math.abs(mid[1] - (-3 + COURTS[1][1]) / 2) < 1e-9, 'half way over the fire');
  stepBrain(f, b.at, bodies, seeded(1));
  assert.equal(f.court, 1, 'he fights in the new court from its landing');
  assert.deepEqual(f.pos, [...COURTS[1]]);
  assert.equal(stateOf(f).ct, 1);
  // the turn to the third: both walkways laid now
  f.atk = null; f.queue = []; f.pending = null; f.hp = f.max * PHASE_AT[1];
  const o3 = stepBrain(f, T0 + 60_000, [body('s1', ...at(1, 3, 3))], seeded(2));
  assert.deepEqual(o3.find((o) => o.k === 'atk').tg, [[...COURTS[2]]]);
  assert.deepEqual(f.xa, [T0 + 1000, T0 + 60_000]);
  // a fight checkpointed before WB9 (no court, no crossings) in phase two crosses to the third over both walkways
  const old = fightOf([10]);
  old.phase = 2; old.nextAt = T0; delete old.court; delete old.xa; old.hp = old.max * PHASE_AT[1];
  stepBrain(old, T0 + 500, [body('s1', 3, 3)], seeded(3));
  assert.deepEqual(old.xa, [T0 + 500, T0 + 500], 'every walkway up to the court he bounds to - the wire says them in order, no gap');
  assert.ok(onFloor(...at(2), old.xa, T0 + 500 + WALK_LEAD_MS + WALK_FORM_MS), 'and the third court is reached');
});

test('WB9b the wait: in his new court his ward holds until a living challenger stands in it (or CROSS_WAIT_MAX_MS), then his own ward more while the phase\'s signature is cast from its heart; he chooses, aims at and waits for those in his court alone - a fighter left behind is not before him (mutants: the signature cast at once; the wait forever; a fighter in another court chosen)', () => {
  const f = fightOf([10, 10]);
  f.nextAt = T0; f.hp = f.max * PHASE_AT[0];
  const behind = [body('s1', 2, 2), body('s2', -3, 1)];
  stepBrain(f, T0, behind, seeded(1));
  const landed = f.atk.until;
  stepBrain(f, landed, behind, seeded(1));
  for (let t = landed + TURN_BREATH_MS; t < landed + 10_000; t += 250) {
    const o = stepBrain(f, t, behind, seeded(t));
    assert.ok(!o.some((x) => x.k === 'atk' || x.k === 'mv'), `he waits, still, at ${t - landed} ms`);
  }
  assert.ok(T0 + 10_000 < f.shieldUntil, 'warded through the wait');
  assert.equal(applyHit(f, 's1', 50, HIT_KINDS.Spell, { x: 2, z: 2 }, landed + 9000), 0, 'nothing lands on him while he waits');
  const over = [body('s1', ...at(1, 4, 5)), body('s2', -3, 1)];
  const t1 = landed + 10_000;
  const arrive = stepBrain(f, t1, over, seeded(4));
  assert.deepEqual(arrive.find((o) => o.k === 'ph'), { k: 'ph', n: 2, until: t1 + SHIELD_MS });
  const nova = stepBrain(f, t1 + TURN_BREATH_MS, over, seeded(4)).find((o) => o.k === 'atk');
  assert.equal(nova.a, ATTACKS.nova.id);
  assert.deepEqual([nova.x, nova.z], [...COURTS[1]], 'cast from the new court\'s heart');
  // after the turn he goes after the one in his court, never the one left behind
  f.atk = null; f.nextAt = 0; f.target = null;
  for (let i = 0; i < 40; i++) {
    const o = stepBrain(f, t1 + 5000 + i * 250, over, seeded(100 + i));
    for (const x of o) {
      if (x.k === 'mv') assert.ok(inCourt(x.tx, x.tz, 1), 'his walk stays in his court');
      if (x.k === 'atk' && x.tg.length) for (const p of x.tg) assert.ok(inCourt(p[0], p[1], 1), 'his fire falls on his court');
    }
    if (f.target) assert.equal(f.target, 's1', 'the fighter in his court');
  }
  // nobody crosses: after CROSS_WAIT_MAX_MS he goes on anyway
  const g = fightOf([10]);
  g.nextAt = T0; g.hp = g.max * PHASE_AT[0];
  stepBrain(g, T0, [body('s1', 1, 1)], seeded(1));
  const gl = g.atk.until;
  stepBrain(g, gl, [body('s1', 1, 1)], seeded(1));
  assert.ok(!stepBrain(g, gl + CROSS_WAIT_MAX_MS - 250, [body('s1', 1, 1)], seeded(1)).some((o) => o.k === 'ph'));
  assert.ok(stepBrain(g, gl + CROSS_WAIT_MAX_MS + 250, [body('s1', 1, 1)], seeded(1)).some((o) => o.k === 'ph'), 'the wait has its end');
  assert.ok(CROSS_WARD_MAX_MS >= windupOf(ATTACKS.cross, 2) + ATTACKS.cross.active + ATTACKS.cross.recover + TURN_BREATH_MS + CROSS_WAIT_MAX_MS, 'the turn\'s ward outlasts the longest wait');
});

test('WB9b a blow from the floor as it is laid: from a walkway not yet laid, or a court not yet reached, nothing lands; from the reached court it does, and from the laid walkway\'s mouth within POSE_SLACK of his court - AUDIT WB9 (brain F1): never from further along it, nor from a court he has left (mutants: the old ring - the first court\'s alone)', () => {
  const f = fightOf([10]);
  f.court = 1; f.pos = [...COURTS[1]]; f.xa = [T0];
  const w = WALKS[0], near = { x: COURTS[1][0], z: COURTS[1][1] + 3 };
  assert.equal(applyHit(f, 's1', 5, HIT_KINDS.Spell, near, T0 + 1000), 0, 'the court not reached yet');
  assert.ok(applyHit(f, 's1', 5, HIT_KINDS.Spell, near, T0 + WALK_LEAD_MS + WALK_FORM_MS + 1) > 0, 'reached');
  // the walkway's mouth: past his court's rim, within the pose's slack of it
  let a = 0;
  while (Math.hypot(w.ax + w.ux * a - COURTS[0][0], w.az + w.uz * a - COURTS[0][1]) < COURT_R + POSE_SLACK / 2) a += 0.05;
  const mouth = { x: w.ax + w.ux * a, z: w.az + w.uz * a }, onWalk = { x: w.ax + w.ux * 10, z: w.az + w.uz * 10 };
  assert.ok(!inCourt(mouth.x, mouth.z, 0) && inCourt(mouth.x, mouth.z, 0, POSE_SLACK) && !inCourt(onWalk.x, onWalk.z, 0, POSE_SLACK));
  const g = fightOf([10]);
  g.xa = [T0];
  assert.equal(applyHit(g, 's1', 5, HIT_KINDS.Spell, onWalk, T0 + WALK_LEAD_MS), 0, 'not laid there yet');
  assert.ok(applyHit(g, 's1', 5, HIT_KINDS.Spell, mouth, T0 + WALK_LEAD_MS + WALK_FORM_MS) > 0, 'at his court\'s edge, within the slack');
  assert.equal(applyHit(g, 's1', 5, HIT_KINDS.Spell, onWalk, T0 + WALK_LEAD_MS + WALK_FORM_MS + 1000), 0, 'AUDIT WB9 (brain F1): laid, but outside his court - nothing lands');
  f.court = 1;
  assert.equal(applyHit(f, 's1', 5, HIT_KINDS.Spell, { x: COURTS[0][0], z: COURTS[0][1] }, T0 + WALK_LEAD_MS + WALK_FORM_MS + 2000), 0, 'AUDIT WB9 (brain F1): nor from the court he has left');
  assert.deepEqual(keepInCourt(COURTS[1][0] + 40, COURTS[1][1], BOSS_REACH_R, COURTS[1]), [COURTS[1][0] + BOSS_REACH_R, COURTS[1][1]], 'the ring he keeps to is his court\'s');
});

// ═══ THE WIRE AND THE LINK ═══════════════════════════════════════════════════════════════════════════════════════

test('WB9b the wire and the link: the state says his court (0..2) and the crossings (at most two relay moments); a bound\'s word lays its walkway on every screen that hears it, from its own moment (its landing less its wind-up) - never twice, never from another attack (mutants: the court unbounded; the walkway left to the next state)', () => {
  const f = fightOf([10]);
  f.court = 1; f.xa = [T0 + 5];
  const st = stateOf(f);
  assert.deepEqual([validGateOut(st).ct, validGateOut(st).xa], [1, [T0 + 5]]);
  assert.equal(validGateOut({ ...st, ct: COURTS.length }), null, 'WB14b: any floor of the table, none past it');
  assert.equal(validGateOut({ ...st, xa: [1, 2, 3, 4, 5, 6, 7] }), null, 'WB14b: a walkway the table holds, none past it');
  assert.equal(validGateOut({ ...st, xa: [1, null] }), null, 'nor a hole at the end');
  assert.deepEqual(validGateOut({ ...st, xa: [1, null, 3] }).xa, [1, null, 3], 'a hole in the middle: a walkway not laid');
  assert.equal(validGateOut({ ...st, xa: ['x'] }), null);
  assert.deepEqual(validGateOut({ ...st, xa: undefined }).xa, [], 'an older relay\'s state: nothing crossed');
  let s = foldGate(GATE_STATE_EMPTY, st, T0);
  assert.deepEqual(s.xa, [T0 + 5]);
  const word = { k: 'atk', i: 9, a: ATTACKS.cross.id, at: T0 + 20_000, x: COURTS[1][0], z: COURTS[1][1], yw: 0, tg: [[...COURTS[2]]] };
  s = foldGate(s, word, T0 + 17_600);
  assert.deepEqual(s.xa, [T0 + 5, T0 + 20_000 - ATTACKS.cross.windup], 'laid from the word\'s own moment');
  assert.deepEqual(crossLaid(s, word), {}, 'never twice');
  assert.deepEqual(crossLaid({ xa: [] }, { ...word, a: ATTACKS.leap.id }), {}, 'a leap lays nothing');
  assert.deepEqual(crossLaid({ xa: [] }, { ...word, tg: [[...COURTS[1]]] }), { xa: [T0 + 20_000 - ATTACKS.cross.windup] });
});

// ═══ THE SCREEN ══════════════════════════════════════════════════════════════════════════════════════════════════

test('WB9b the motor\'s floor: the court\'s arena answers the nearest point of the floor as laid (the brain\'s own law, in the dungeon\'s frame), a player\'s capsule in; the motor puts a body back there and takes the airborne momentum out of the floor away - off a walkway\'s side as off the rim (mutants: the arena\'s clamp ignored; the momentum kept)', () => {
  const a = courtArena([], T0);
  assert.deepEqual(a.centre, [...COURT_CENTRE]); assert.equal(a.radius, COURT_R);
  assert.equal(a.clamp(courtToDungeon(3, 0, 3), 0.4), null);
  a.xa = [T0]; a.now = T0 + WALK_LEAD_MS + WALK_FORM_MS;   // the host refills one arena each frame
  const w = WALKS[0], side = courtToDungeon(w.ax + w.ux * 9 + w.uz * (WALK_HALF_W + 1), 0, w.az + w.uz * 9 - w.ux * (WALK_HALF_W + 1));
  const to = a.clamp(side, 0.4);
  const back = [to[0] - COURT_CENTRE[0], to[1] - COURT_CENTRE[2]];
  assert.ok(onFloor(back[0], back[1], a.xa, a.now), 'put back on the walkway');
  const m = new PlayerMotor();
  m.pos = [...side]; m.arena = a;
  m._airVelX = w.uz * 3; m._airVelZ = -w.ux * 3;   // flying off its side
  m._keepInArena();
  assert.ok(onFloor(m.pos[0] - COURT_CENTRE[0], m.pos[2] - COURT_CENTRE[2], a.xa, a.now));
  assert.ok(Math.hypot(m._airVelX, m._airVelZ) < 1e-9, 'the momentum off the floor taken away');
  m._airVelX = w.ux * 2; m._airVelZ = w.uz * 2;
  m._keepInArena();
  assert.ok(Math.abs(Math.hypot(m._airVelX, m._airVelZ) - 2) < 1e-9, 'along the walkway it carries on');
});

test('WB9b the walkway\'s stones: slabs of about SLAB_LEN_M the walkway\'s whole length, each risen out of the fire WHOLE before the laid floor reaches its near edge, none before the bound\'s word; under the sea until then, at the floor once laid (mutants: a slab still rising under a foot; a slab up before the word)', () => {
  const S = walkSlabs();
  assert.equal(S, walkSlabs(), 'made once');
  for (const w of PLAN_PLAIN.walks.map((k) => WALKS[k])) {   // WB14b: a plain night's walkways
    const own = S.filter((s) => s.walk === w.k);
    assert.equal(own.length, Math.ceil(w.len / SLAB_LEN_M));
    assert.ok(Math.abs(own.reduce((a, s) => a + s.len, 0) - w.len) < 1e-9, 'the whole walkway');
  }
  const xa = [T0, T0 + 40_000];
  for (const s of S) {
    const word = xa[s.walk];
    assert.equal(slabRise(s, xa, word - 1), 0, 'nothing before the word');
    assert.equal(slabRise(s, [], T0 + 99_999), 0);
    // the floor's front reaches the slab's near edge at walkFormed = j/n: the slab is whole by then
    const front = word + WALK_LEAD_MS + (s.j / s.n) * WALK_FORM_MS;
    assert.ok(Math.abs(walkFormed(xa, s.walk, front) - s.j / s.n) < 1e-12);
    assert.equal(slabRise(s, xa, front), 1, `slab ${s.walk}/${s.j} whole as the floor reaches it`);
    assert.ok(slabRise(s, xa, front - SLAB_RISE_MS - 1) === 0 || s.j * WALK_FORM_MS / s.n + WALK_LEAD_MS < SLAB_RISE_MS, 'rising over SLAB_RISE_MS');
    const under = slabMatrix(s, xa, word - 1), laid = slabMatrix(s, xa, front + 1);
    assert.ok(under[13] < LAVA_Y, 'under the sea');
    assert.ok(Math.abs(laid[13] - COURT_CENTRE[1]) < 1e-6, 'its flagstones at the floor');
    const p = courtToDungeon(s.x, 0, s.z);
    assert.ok(Math.abs(laid[12] - p[0]) < 1e-4 && Math.abs(laid[14] - p[2]) < 1e-4);
    const det = laid[0] * (laid[5] * laid[10] - laid[9] * laid[6]) - laid[4] * (laid[1] * laid[10] - laid[9] * laid[2]) + laid[8] * (laid[1] * laid[6] - laid[5] * laid[2]);
    assert.ok(det > 0, 'never mirrored');
  }
  const model = buildWalkSlabModel();
  assert.ok(model.positions.length > 0 && model.subMeshes.length === 2);
  let top = -Infinity;
  for (let i = 1; i < model.positions.length; i += 3) top = Math.max(top, model.positions[i]);
  assert.ok(Math.abs(top) < 1e-6, 'the model\'s top is its floor');
});

test('WB9b the court as it is drawn: his flight over the fire CROSS_HEIGHT at its top, on his run\'s frames; the bound heard across the courts and shaking the ground; its telegraph drawn over the court it lands in, the Wrath\'s and the Reckoning\'s over all three; the braziers clear of every walkway\'s mouth and the spires too; the lights the fight\'s first and the braziers nearest first (mutants: the bound drawn on the ground; the telegraph over the court he leaves)', () => {
  const word = { i: 3, a: ATTACKS.cross.id, at: T0 + 2400, x: 0, z: 0, yw: 0, tg: [[...COURTS[1]]] };
  const s = { ...GATE_STATE_EMPTY, day: 1, phase: 2, atk: word, x: 0, z: 0, max: 100, hp: 60 };
  assert.equal(bossHop(s, word.at - CROSS_AIR_MS - 1), 0);
  assert.ok(Math.abs(bossHop(s, word.at - CROSS_AIR_MS / 2) - CROSS_HEIGHT) < 1e-9, 'at the top of the arc');
  assert.equal(bossAct(s, word.at - CROSS_AIR_MS / 2).act, 'run');
  assert.deepEqual(bossPlace(s, word.at + 10), [...COURTS[1]]);
  assert.ok(BOSS_CUES.windup.cross.reach >= 150 && BOSS_CUES.land.cross.reach >= 150 && QUAKE_ON.includes('cross') && ATTACK_COLORS.cross);
  assert.equal(telegraphShape(word, 2, T0 + 1000).court, 1, 'over the court it lands in');
  assert.equal(telegraphShape({ ...word, a: ATTACKS.slam.id, x: COURTS[2][0] + 3, z: COURTS[2][1] }, 3, T0 + 1000).court, 2, 'a slam over the court he stands in');
  assert.equal(telegraphShape({ ...word, a: ATTACKS.reckon.id, at: T0 + 30_000 }, 3, T0 + 1000).court, -1, 'the Reckoning over all');
  const calls = [];
  const gl = new Proxy({ TRIANGLES: 4 }, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; }) });
  const pass = new GateTelegraphRenderer(gl);
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  pass.draw(telegraphShape({ ...word, a: ATTACKS.reckon.id, at: T0 + 30_000 }, 3, T0 + 20_000), I, I, [0, 0, 0], 1);
  assert.equal(pass.drawn, 3, 'one quad over each court');
  pass.draw(telegraphShape(word, 2, T0 + 1000), I, I, [0, 0, 0], 1);
  assert.equal(pass.drawn, 1);
  assert.deepEqual(calls.filter((c) => c[0] === 'uniform2f' && c[1] === 'uCourt').at(-1).slice(2), [...COURTS[1]]);
  // what stands round each rim keeps each opening clear
  for (let k = 0; k < COURTS_HIS; k++) {
    const opens = courtOpenings(k);
    assert.equal(opens.length, (k === 0 ? 1 : 0) + PLAN_PLAIN.walks.map((i) => WALKS[i]).filter((w) => w.a === k || w.b === k).length);
    const angleOff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    for (const [, p] of courtBraziers(k)) for (const o of opens) assert.ok(angleOff(Math.atan2(p[2] - COURTS[k][1], p[0] - COURTS[k][0]), o) > 0.15, 'no brazier in a walkway\'s mouth');
    for (const sp of courtSpireAxes(k)) for (const o of opens) assert.ok(angleOff(Math.atan2(sp.t[2] - COURTS[k][1], sp.t[0] - COURTS[k][0]), o) > 0.25, 'no spire leaning over one');
  }
  const eye = courtToDungeon(COURTS[2][0], 2, COURTS[2][1]);
  const near = courtLightsNear(eye);
  assert.equal(near, courtLightsNear(null), 'one list, sorted again in place');
  assert.equal(near.length, courtLights().length);
  const d = (l) => Math.hypot(l.x - eye[0], l.z - eye[2]);
  for (let i = 1; i < near.length; i++) assert.ok(d(near[i]) >= d(near[i - 1]) - 1e-9, 'the nearest first');
  assert.equal(nearestCourt(near[0].x - COURT_CENTRE[0], near[0].z - COURT_CENTRE[2]), 2, 'the court this screen stands in');
});

test('WB9b the Deadlands keep clear of the floor: no island within LAND_CLEAR_M of a court or a walkway (their widest rock counted), none past the far plane\'s ring (mutants: an island over a walkway)', () => {
  for (const isl of deadlandsIslands()) {
    assert.ok(floorGap(isl.x, isl.z) >= isl.r * 1.35 + LAND_CLEAR_M, `an island ${floorGap(isl.x, isl.z).toFixed(1)} m off the floor`);
  }
  assert.ok(floorGap(...at(1)) < 0 && floorGap(...at(0, 0, 0), 0) > 0, 'inside a court is negative - and a court left out is not counted');
});

test('WB9b the seams, by source: the world host refills one arena a frame from the link\'s crossings on the relay\'s clock; the dungeon arm stands the slabs and moves them before the frame\'s draws; the court draws his mark over the court he stands in; the relay carries the brain\'s floor (mutants: each seam removed)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const _courtArena = courtArena\(_gateFloor\.none, 0\);/);
  assert.match(w, /player\.arena = courtArenaAt\(_courtArena, gateLink\?\.state\(\)\?\.xa \?\? _gateFloor\.none, Date\.now\(\) \+ _sharedOffsetMs, modes\?\.gateArenaDay\?\.\(\)\);/);   // WB14b: and the night whose plan holds me; PIN MOVED (WB14e): guarded, as every read of modes above its making (audit24_wave37); PIN MOVED (WB14, the merge of LAYERED-GEAR): refilled by courtArenaAt - the host's ceiling
  const A = courtArena([], 0), xs = [1, 2];
  assert.equal(courtArenaAt(A, xs, 77, 9), A, 'the one arena, never a new one a frame');
  assert.deepEqual([A.xa, A.now, A.day], [xs, 77, 9]);
  assert.match(w, /gateFloor: \(\) => \{ _gateFloor\.xa = gateLink\?\.state\(\)\?\.xa \?\? _gateFloor\.none; _gateFloor\.now = Date\.now\(\) \+ _sharedOffsetMs; return _gateFloor; \},/);
  const wm = read('src/scenes/worldModes.js');
  // WB14b (PIN MOVED): the court is stood by scenes/gate/gateStand.js, out of the host - the night's walkways
  assert.match(read('src/scenes/gate/gateStand.js'), /for \(const sl of walkSlabs\(plan\.pt\)\) ctx\.dynamicDraws\.push\(\{ gpu: slabMesh, object: \{ matrix: slabMatrix\(sl, fl\?\.xa \?\? NO_XA, fl\?\.now \?\? 0\) \}, slab: sl \}\);/);
  const moved = wm.indexOf('if (d.slab) slabMatrix(d.slab, _floor?.xa ?? NO_XA, _floor?.now ?? 0, d.object.matrix);'), begin = wm.indexOf('renderer.beginFrame(proj, view, _ktLook?.sunDir ?? INTERIOR_LIGHT_DIR, WORLD_FRAME);');   // PIN MOVED (KETCH): the dungeon arm's frame, on a ship's deck in the sun's own direction
  assert.ok(moved > 0 && moved < begin, 'the stones moved before the frame\'s draws');
  const gc = read('src/scenes/gate/gateCourt.js');
  assert.match(gc, /_mark\.court = nearestCourt\(mx, mz\); mark = _mark;/);
  const brain = read('src/net/gate/gateBrain.js');
  assert.match(brain, /if \(!onFloor\(pose\.x, pose\.z, f\.xa, now, POSE_SLACK, planOf\(f\)\)\) return 0;/);   // WB14b: the night's plan's floor
  assert.match(read('src/player/motor.js'), /if \(typeof a\.clamp === 'function'\) \{ this\._putBack\(a\.clamp\(this\.pos, CAPSULE_RADIUS\)\); return; \}/);
  assert.equal(PHASE_TURN[2][0].a, 'cross');
});
