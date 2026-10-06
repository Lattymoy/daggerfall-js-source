// SERPENT1 (2026-10-04, Mac: "A new world event that requires players with a ship to meet up and take on a large scale
// sea serpent in the ocean"; "You make the decisions and online only ... make this something truly special"): SETHRAKUL'S
// LAW, BODY AND BRAIN. The schedule and its words (net/serpentLaw.js - the dawn watch every other game day, never beside
// the gate); the body as law (net/serpentBody.js - the head's legs, the track the body lies along, how it rides the sea,
// the coil, what a ball may strike); the relay's brain over a seeded rng and a fake clock (net/serpentBrain.js - the
// numbers a ship's claim sets, the join, every refusal a blow can meet, the weak place, the phases and their turns, the
// coil slipped, held, broken and crushed, the sounding, who serpentEarned it, the checkpoint).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  serpentTimes, serpentAt, serpentPhase, serpentDayAt, isSerpentDay, serpentAdmits, serpentHolds, serpentSwims, serpentMarked,
  serpentCountdown, serpentCountdownWords, serpentClock, serpentRing, serpentRoll, serpentLaneOf, serpentAlongOf, SERPENT_ALONG,
  serpentBossOf, serpentBossById, SERPENT_BOSSES, sightingLine, risingLine, sealLine, soundLine, slainLine, SERPENT_DAY_MINUTES,
  SERPENT_EVERY_DAYS, SERPENT_SURFACE_MS, SERPENT_DIVE_MS, SERPENT_RING_PIXELS, SERPENT_NATIVE_PER_M,
} from '../src/net/serpentLaw.js';
import { gateTimes, GATE_COLLAPSE_MS, gameDayAt, PIXEL_M as GATE_PIXEL_M } from '../src/net/gateLaw.js';
import {
  LEG, MODE, legAt, legFrom, headAt, spinePoint, bodyAt, depthAt, depthOf, modeAt, coilPoint, coilWeight, anyExposed, coilAngleAt, DRIFT_V,
  headExposed, nearestExposed, segmentBox, segExposed, radiusAt, SEG_N, SEG_LEN, BODY_LEN, DEEP_Y, MODE_BLEND_MS, COIL_BLEND_MS,
  COIL_R, BREACH_Y, REAR_Y,
} from '../src/net/serpentBody.js';
import {
  newSerpentFight, joinSerpentFight, applySerpentHit, stepSerpentBrain, serpentStateOf, serpentEarned, serpentEarnedBy, serpentTopDealers, serpentDamageChart, pickSerpentTarget, serpentAttacksFor,
  chooseSerpentAttack, coilWord, coilHolds, pruneLegs, refOf, clampHull, SHIP_REF, SERPENT_TTK_S, SERPENT_BUCKET_RATE_X, SERPENT_BUCKET_DEPTH_X,
  SERPENT_HIT_CAP_X, SERPENT_HIT_HZ_MAX, HEAD_X, STUN_X, ZONES, SERPENT_PHASE_AT, SERPENT_SHIELD_MS, SERPENT_ATTACK_TABLE, SERPENT_ATTACK_BY_ID, SERPENT_PHASE_TURN, SERPENT_OPENING_MS,
  ENGAGE_R, GUN_REACH_M, SERPENT_POSE_SLACK, COIL_MS, COIL_ESC_MS, SERPENT_STUN_MS, COIL_TEAM_S, COIL_HP_MIN, SERPENT_RECEIPT_SHARE, SERPENT_STOOD_SHARE,
  SERPENT_FIGHTERS_MAX, SERPENT_ABSENT_RETIRE_MS, ARENA_R, MAEL_ORBIT_R, RAM_V, ramLen, BREACH_LEAD_MS, SERPENT_COIL_PASS, SERPENT_STAND_R, SERPENT_IDLE_RETIRE_MS, SERPENT_TARGET_R, serpentWreck, serpentShareWanted, COIL_WORD_EARLY_MS, serpentAtkFrame,
  SERPENT_SAY_AHEAD_MS,   // AUDIT SHIPS B5: an end's swim said ahead
} from '../src/net/serpentBrain.js';
import { HULL, HULL_BUILDS, GUNS } from '../src/systems/naval/navalShips.js';
import { orientedBox, segmentBoxEntry } from '../src/systems/naval/navalBallistics.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';

const iso = (ms) => new Date(ms).toISOString();
/** A seeded [0,1) source (mulberry32) - the pins' own dice. */
function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ═══ THE SCHEDULE ════════════════════════════════════════════════════════════════════════════════

test('SERPENT1 schedule: the dawn watch of every odd game day - sighted 02:00, risen 05:00, the storm closing its waters 08:00, sounding 10:00 (day 363: 23:02:30, 23:17:30, 23:32:30 and 23:42:30 UTC) (mutants: a minute moved; the day phase flipped)', () => {
  assert.equal(SERPENT_DAY_MINUTES, MINUTES_PER_DAY);
  assert.equal(SERPENT_EVERY_DAYS, 2);
  assert.ok(isSerpentDay(363) && !isSerpentDay(364) && isSerpentDay(365));
  assert.ok(!isSerpentDay(-1) && !isSerpentDay(3.5) && !isSerpentDay(NaN));
  const t = serpentTimes(363);
  assert.deepEqual([iso(t.omenAt), iso(t.riseAt), iso(t.sealAt), iso(t.soundAt)],
    ['2026-09-13T23:02:30.000Z', '2026-09-13T23:17:30.000Z', '2026-09-13T23:32:30.000Z', '2026-09-13T23:42:30.000Z']);
  assert.equal(serpentTimes(363), t, 'a day\'s instants are made once');
  assert.equal(serpentDayAt(t.riseAt), 363);
  assert.equal(serpentDayAt(t.riseAt), gameDayAt(t.riseAt), 'the gate\'s own day');
  // four real hours apart: the next serpent is day 365's, at the same minutes past
  assert.equal(serpentTimes(365).riseAt - t.riseAt, 4 * 3600 * 1000);
});

test('SERPENT1 schedule: NEVER BESIDE THE GATE - over a year of game days, no serpent\'s sighting-to-gone overlaps any gate\'s omen-to-collapse (mutants: the serpent moved into the evening; every day a serpent day with the hours moved)', () => {
  for (let day = 363; day < 363 + 360; day++) {
    if (!isSerpentDay(day)) continue;
    const s = serpentTimes(day), a = s.omenAt, b = s.soundAt + SERPENT_DIVE_MS;
    for (const g of [gateTimes(day - 1), gateTimes(day), gateTimes(day + 1)]) {
      const c = g.omenAt, d = g.wrathAt + GATE_COLLAPSE_MS;
      assert.ok(b <= c || d <= a, `day ${day}: the serpent ${iso(a)}-${iso(b)} meets the gate ${iso(c)}-${iso(d)}`);
    }
  }
});

test('SERPENT1 schedule: the serpent the clock is about - today\'s until it has gone, then the next serpent day\'s; its phases in order, a kill ending it early in its throes, never a kill outside its waters\' time (mutants: the dive\'s tail dropped; a fall before the rising honoured)', () => {
  const t = serpentTimes(363), u = serpentTimes(365);
  assert.equal(serpentAt(t.omenAt - 60_000), t, 'before the sighting it is upcoming');
  assert.equal(serpentAt(t.soundAt + SERPENT_DIVE_MS - 1), t);
  assert.equal(serpentAt(t.soundAt + SERPENT_DIVE_MS), u, 'gone, the next');
  assert.equal(serpentAt(serpentTimes(364).riseAt), u, 'a day without one points at the next');
  const ph = (ms, fell = null) => serpentPhase(t, ms, fell);
  assert.equal(ph(t.omenAt - 1), 'quiet');
  assert.equal(ph(t.omenAt), 'omen');
  assert.equal(ph(t.riseAt), 'rising');
  assert.equal(ph(t.riseAt + SERPENT_SURFACE_MS), 'hunt');
  assert.equal(ph(t.sealAt), 'late');
  assert.equal(ph(t.soundAt), 'sounding');
  assert.equal(ph(t.soundAt + SERPENT_DIVE_MS), 'gone');
  const fell = t.riseAt + 300_000;
  assert.equal(ph(fell - 1, fell), 'hunt');
  assert.equal(ph(fell, fell), 'slain');
  assert.equal(ph(fell + SERPENT_DIVE_MS, fell), 'gone');
  assert.equal(ph(t.riseAt - 5, t.riseAt - 10), 'omen', 'a fall before it rose is no fall');
  assert.equal(ph(t.soundAt + 1, t.soundAt + 1), 'sounding', 'nor one after it sounded');
  assert.ok(serpentSwims('hunt') && serpentSwims('slain') && !serpentSwims('omen') && !serpentSwims('gone'));
  assert.ok(serpentMarked('omen') && serpentMarked('late') && !serpentMarked('quiet') && !serpentMarked('gone'));
});

test('SERPENT1 schedule: who may come - a newcomer from the rising until the storm closes its waters, a fighter until it has gone; the countdowns and their words (mutants: admission past the seal; a hold past the dive)', () => {
  const t = serpentTimes(363);
  assert.ok(!serpentAdmits(363, t.riseAt - 1) && serpentAdmits(363, t.riseAt) && serpentAdmits(363, t.sealAt - 1) && !serpentAdmits(363, t.sealAt));
  assert.ok(!serpentAdmits(364, serpentTimes(364).riseAt), 'no serpent, no admission');
  assert.ok(serpentHolds(363, t.sealAt) && serpentHolds(363, t.soundAt + SERPENT_DIVE_MS - 1) && !serpentHolds(363, t.soundAt + SERPENT_DIVE_MS) && !serpentHolds(363, t.riseAt - 1));
  assert.deepEqual(serpentCountdown(t, t.omenAt), { to: 'rise', ms: t.riseAt - t.omenAt });
  assert.equal(serpentCountdownWords(serpentCountdown(t, t.riseAt - 61_500)), 'rises in 1m 02s');
  assert.equal(serpentCountdownWords(serpentCountdown(t, t.riseAt + SERPENT_SURFACE_MS)), `storm closes in ${serpentClock(t.sealAt - t.riseAt - SERPENT_SURFACE_MS)}`);
  // AUDIT SERPENT B9: as it rises the countdown is the storm's - never "rises in 0s"
  assert.deepEqual(serpentCountdown(t, t.riseAt + 1000), { to: 'seal', ms: t.sealAt - t.riseAt - 1000 });
  assert.equal(serpentCountdownWords(serpentCountdown(t, t.sealAt)), 'dives in 10m 00s');
  assert.equal(serpentCountdown(t, t.soundAt), null);
  assert.equal(serpentClock(1), '1s', 'rounded up - never 0s with time left');
  assert.equal(serpentClock(59_001), '1m 00s');
  assert.equal(serpentClock(15 * 60_000), '15m 00s', 'AUDIT SERPENT (words): never "15:00", a clock\'s hour');
});

test('SERPENT1 rolls: the lane tries and the place along each are the day\'s own hash, the place in the lane\'s middle stretch; the ring on the map holds its site (mutants: the along share outside its stretch; the ring centred on the site with no shift)', () => {
  assert.equal(serpentRoll(363, 5), serpentRoll(363, 5));
  assert.notEqual(serpentRoll(363, 5), serpentRoll(365, 5));
  for (let i = 0; i < 50; i++) {
    const k = serpentLaneOf(363 + 2 * i, i % 7, 41);
    assert.ok(Number.isInteger(k) && k >= 0 && k < 41);
    const a = serpentAlongOf(363 + 2 * i, i);
    assert.ok(a >= SERPENT_ALONG[0] && a <= SERPENT_ALONG[1]);
  }
  assert.equal(serpentLaneOf(363, 0, 0), -1, 'no lanes, no lane');
  assert.equal(SERPENT_NATIVE_PER_M, 32768 / GATE_PIXEL_M, 'the map pixel\'s metres the gate\'s own (AUDIT SERPENT 2: imported, never a second literal)');
  let shifted = 0;
  for (let day = 1; day < 200; day += 2) {
    const sx = 250.5 * 32768, sz = (499 - 210 + 0.5) * 32768;
    const ring = serpentRing(day, sx, sz);
    assert.ok(Math.hypot(ring.gx - ring.cx, ring.gy - ring.cy) < ring.r, 'the site lies inside its ring');
    assert.equal(ring.r, SERPENT_RING_PIXELS);
    assert.ok(Math.abs(ring.gx - 250.5) < 1e-9 && Math.abs(ring.gy - 210.5) < 1e-9, 'the site at its map pixel, y south');
    if (Math.hypot(ring.gx - ring.cx, ring.gy - ring.cy) > 0.05) shifted++;
  }
  assert.ok(shifted > 80, 'the ring is pulled off the site - it says where to sail, the sea says where');
});

test('SERPENT1 words: the boss table, and each line the event, where and when (mutants: a line naming no place; the kill\'s names unjoined)', () => {
  assert.equal(SERPENT_BOSSES.length, 1);
  assert.equal(serpentBossOf(363).id, 'sethrakul');
  assert.equal(serpentBossById('nobody').id, 'sethrakul');
  const w = { near: 'Sentinel', boss: 'Sethrakul', at: '14:32', left: '4m 07s' };
  assert.equal(sightingLine(w), 'Bells ring in the harbours: a great serpent is sighted off Sentinel. Sethrakul rises at 14:32 your time.');
  assert.equal(risingLine(w), 'Sethrakul rises off Sentinel. The storm closes over its waters in 4m 07s.');
  assert.equal(sealLine(w), 'A storm closes over Sethrakul\'s waters off Sentinel - no ship can join the fight now. It dives at 14:32 your time.');
  assert.equal(soundLine(w), 'Sethrakul dives off Sentinel and is gone into the deep.');
  assert.equal(slainLine({ ...w, top: ['Ama', 'Bel', 'Cor'] }), 'Sethrakul is slain off Sentinel by Ama, Bel and Cor. Its hoard goes to the ships that fought it.');
  assert.equal(slainLine({ ...w, near: null, top: [] }), 'Sethrakul is slain. Its hoard goes to the ships that fought it.');
});

// ═══ THE BODY ════════════════════════════════════════════════════════════════════════════════════

test('SERPENT1 body: a leg is a closed form - a straight run at its speed, an arc turning about a centre to its side, a new leg begun where the head is and as it heads (no jump, no kink) (mutants: the arc\'s centre on the wrong side; the turn\'s rate off the radius)', () => {
  const T = 1_000_000;
  const line = { k: LEG.line, at: T, x: 0, z: 0, yw: 0, v: 10 };
  assert.deepEqual(legAt(line, T + 2000), { x: 0, z: 20, yw: 0 }, 'north at 10 m/s, two seconds');
  // a right turn of radius 50 from heading north: a quarter turn later it heads east, 50 east and 50 north of its start
  const arc = { k: LEG.arc, at: T, x: 0, z: 0, yw: 0, v: 10, r: 50, sd: 1 };
  const q = legAt(arc, T + ((Math.PI / 2) * 50 / 10) * 1000);
  assert.ok(Math.abs(q.x - 50) < 1e-6 && Math.abs(q.z - 50) < 1e-6 && Math.abs(q.yw - Math.PI / 2) < 1e-9, JSON.stringify(q));
  const left = legAt({ ...arc, sd: -1 }, T + ((Math.PI / 2) * 50 / 10) * 1000);
  assert.ok(Math.abs(left.x + 50) < 1e-6 && Math.abs(left.z - 50) < 1e-6, 'a left turn mirrors it');
  const legs = [arc];
  const next = legFrom(legs, T + 3000, LEG.line, 10);
  const at = headAt(legs, T + 3000);
  assert.deepEqual([next.x, next.z, next.yw], [at.x, at.z, at.yw]);
  legs.push(next);
  const a = headAt(legs, T + 2999), b = headAt(legs, T + 3001);
  assert.ok(Math.hypot(b.x - a.x, b.z - a.z) < 0.03 && Math.abs(b.yw - a.yw) < 0.01, 'smooth across the leg\'s seam');
});

test('SERPENT1 body: THE BODY LIES ALONG THE TRACK - each SEG_LEN of it is SEG_LEN of the head\'s own path walked back, however the pace changed; past the oldest leg, straight back along its heading; and never back past a JUMP (mutants: the walk by time not metres; the jump crossed)', () => {
  const T = 1_000_000;
  const legs = [{ k: LEG.line, at: T, x: 0, z: 0, yw: 0, v: 5 }, { k: LEG.line, at: T + 10_000, x: 0, z: 50, yw: 0, v: 25 }];
  const t = T + 12_000;   // the head 50 + 50 = 100 m north
  assert.deepEqual(headAt(legs, t), { x: 0, z: 100, yw: 0 });
  for (let i = 0; i <= SEG_N; i++) {
    const p = spinePoint(legs, t, i * SEG_LEN);
    assert.ok(Math.abs(p.z - (100 - i * SEG_LEN)) < 1e-9, `point ${i} at ${p.z}`);
  }
  // a jump: the head placed 300 m east - the body lies straight back from it, never across to the old track
  legs.push({ k: LEG.line, at: T + 13_000, x: 300, z: 0, yw: Math.PI / 2, v: 10, j: 1 });
  const p = spinePoint(legs, T + 14_000, 60);
  assert.ok(Math.abs(p.x - (300 + 10 - 60)) < 1e-9 && Math.abs(p.z) < 1e-9, JSON.stringify(p));
  assert.deepEqual(headAt(legs, T + 12_999), legAt(legs[1], T + 12_999), 'before its moment the jump is not the way');
  assert.equal(BODY_LEN, SEG_N * SEG_LEN);
  assert.ok(radiusAt(40) > radiusAt(0) && radiusAt(BODY_LEN) < radiusAt(140), 'the great coils a third down, the tail\'s taper');
});

test('SERPENT1 body: how it rides the sea - sounded wholly under, cruising with its head at the top and humps rolling down it, the head thrown up in a breach and held higher reared, every change eased (mutants: the deep shallower than its own bound; a change of mode with no ease)', () => {
  const t = 5_000_000;
  for (let s = 0; s <= BODY_LEN; s += 7) assert.equal(depthOf(MODE.deep, s, t), DEEP_Y);
  assert.ok(Math.abs(depthOf(MODE.breach, 0, t) - BREACH_Y) < 1e-9 && Math.abs(depthOf(MODE.rear, 0, t) - REAR_Y) < 1e-9);
  const humps = [...Array(SEG_N + 1).keys()].map((i) => depthOf(MODE.cruise, i * SEG_LEN, t));
  assert.ok(humps.some((y) => y > 1) && humps.some((y) => y < -1), 'arches above the sea and troughs under it');
  const modes = [{ at: t, m: MODE.deep }, { at: t + 10_000, m: MODE.breach }];
  assert.equal(depthAt(modes, 0, t + 10_000), DEEP_Y, 'the change begins where the last mode stood');
  assert.ok(depthAt(modes, 0, t + 10_000 + MODE_BLEND_MS / 2) > DEEP_Y && depthAt(modes, 0, t + 10_000 + MODE_BLEND_MS / 2) < BREACH_Y);
  assert.ok(Math.abs(depthAt(modes, 0, t + 10_000 + MODE_BLEND_MS) - BREACH_Y) < 1e-9);
  assert.equal(modeAt(modes, t + 9_999), MODE.deep);
  assert.equal(modeAt(modes, t + 10_000), MODE.breach);
});

test('SERPENT1 body: the coil - the head looming over her deck, the loop round her at the waterline, wound on and off over COIL_BLEND_MS; the head the weak place while it looms (mutants: the loop off its radius; the weight never easing off)', () => {
  const c = { x: 100, z: -40, th: 0.3, at: 1000, off: 0 };
  for (let s = 30; s <= 140; s += 10) { const p = coilPoint(c, s); assert.ok(Math.abs(Math.hypot(p.x - c.x, p.z - c.z) - COIL_R) < 1e-6, `the loop at ${s}`); }
  assert.ok(coilPoint(c, 0).y > 10, 'the head over her');
  assert.equal(coilWeight(c, 1000), 0);
  assert.equal(coilWeight(c, 1000 + COIL_BLEND_MS), 1);
  const off = { ...c, off: 5000 };
  assert.equal(coilWeight(off, 5000 + COIL_BLEND_MS), 0);
  const legs = [{ k: LEG.line, at: 0, x: 120, z: -40, yw: 0, v: 3, j: 1 }];
  const b = { legs, modes: [{ at: 0, m: MODE.coil }], coil: c };
  const pts = bodyAt(b, 1000 + COIL_BLEND_MS);
  assert.equal(pts.length, SEG_N + 1);
  // PIN MOVED (AUDIT SHIPS B6, 2026-10-06): the coil drawn turns with its head (coilAngleAt) - DRIFT_V round COIL_R since
  // it wound on, counter-clockwise, held where it lets go
  assert.ok(Math.abs(pts[5].x - coilPoint(c, 35, coilAngleAt(c, 1000 + COIL_BLEND_MS)).x) < 1e-9, 'wound on, the body IS the coil');
  assert.ok(Math.abs(coilAngleAt(c, 1000 + COIL_BLEND_MS) - (c.th - (DRIFT_V * COIL_BLEND_MS) / 1000 / COIL_R)) < 1e-12, 'turned with its head');
  assert.equal(coilAngleAt(off, 9000), coilAngleAt(off, 5000), 'held where it let go');
  assert.ok(headExposed(b, pts, 1000 + COIL_BLEND_MS));
  // sounded, the path's body under the coil - nothing of it on the surface a second serpent beside her
  const under = bodyAt({ legs, modes: [{ at: 0, m: MODE.coil }], coil: null }, 5000);
  assert.ok(!anyExposed(under));
});

test('SERPENT1 body: WHAT A BALL MAY STRIKE - a segment above the sea, its box the shots\' own shape lying along it; nothing while it is sounded; the head only thrown up (mutants: an exposed test of the centre alone; the box\'s axis across the segment)', () => {
  const legs = [{ k: LEG.line, at: 0, x: 0, z: 0, yw: 0, v: 11, j: 1 }];
  const t = 20_000;
  const deep = bodyAt({ legs, modes: [{ at: 0, m: MODE.deep }] }, t);
  assert.ok(!anyExposed(deep) && nearestExposed(deep, 0, 0) === null);
  const cruise = { legs, modes: [{ at: 0, m: MODE.cruise }] };
  const pts = bodyAt(cruise, t);
  assert.ok(anyExposed(pts));
  assert.ok(!headExposed(cruise, pts, t), 'cruising, the head skims - no weak place');
  assert.ok(headExposed(cruise, pts, t, true), 'stunned, it is');
  const breach = { legs, modes: [{ at: 0, m: MODE.breach }] };
  assert.ok(headExposed(breach, bodyAt(breach, t), t));
  const i = [...Array(SEG_N).keys()].find((k) => segExposed(pts, k));
  const box = segmentBox(pts, i, 0);
  const mid = [(pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2, (pts[i].z + pts[i + 1].z) / 2];
  assert.ok(Math.abs(box.c[0] - mid[0]) < 1e-9 && Math.abs(box.c[1] - mid[1]) < 1e-9 && Math.abs(box.c[2] - mid[2]) < 1e-9);
  // a ball across the segment strikes it; one along its side past its girth does not
  const across = segmentBoxEntry([mid[0] - 30, mid[1], mid[2]], [mid[0] + 30, mid[1], mid[2]], box, 0.1);
  assert.ok(across && across.t > 0.4 && across.t < 0.5);
  assert.equal(segmentBoxEntry([mid[0] + pts[i].r + 2, mid[1], mid[2] - 30], [mid[0] + pts[i].r + 2, mid[1], mid[2] + 30], box, 0.1), null);
  // the shots' own boxes have the same fields
  const ship = orientedBox([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], [0, 0, 0], [1, 1, 1]);
  assert.deepEqual(Object.keys(box).sort(), Object.keys(ship).sort());
});

// ═══ THE BRAIN ═══════════════════════════════════════════════════════════════════════════════════

const T0 = 10_000_000;
const SOUND = T0 + 25 * 60_000;
/** A fight with ships of hulls `hls` (subs s1, s2, ...), the clock at T0. */
function fightOf(hls = [HULL.Carrack]) {
  const f = newSerpentFight(363, T0, SOUND, 'sethrakul', 0, 0, 0.4);
  hls.forEach((hl, i) => assert.ok(joinSerpentFight(f, `s${i + 1}`, `P${i + 1}`, 20, hl, T0, true)));
  return f;
}
const body = (sub, x, z, dead = false) => ({ sub, x, z, dead });
/** The serpent cruising round the waters' heart at 60 m, its body up and its opening over - for the blows' pins. */
function surfaced(f, t = T0) {
  f.legs = [{ k: LEG.arc, at: t - 30_000, x: -60, z: 0, yw: 0, v: 11, r: 60, sd: 1, j: 1 }];
  f.modes = [{ at: t - 30_000, m: MODE.cruise }];
  f.openUntil = t;
  f.nextAt = t;
  return f;
}

test('SERPENT1 brain: A SHIP\'S CLAIM SETS BOTH WHAT IT BRINGS AND WHAT IT MAY DEAL - so no claim buys a faster kill: one ship at the cap fells its own share in (SERPENT_TTK_S - SERPENT_BUCKET_DEPTH_X) / SERPENT_BUCKET_RATE_X seconds whatever hull it says; a hand aboard another\'s ship brings and deals nothing (mutants: the share off the claim; the bucket off the claim; the one-blow cap lifted)', () => {
  assert.deepEqual(SHIP_REF, [0, 3.6, 10, 13, 12]);   // AUDIT SERPENT T6: the Large Boat's swivels are uncrewed (reload x1.4)
  assert.equal(SHIP_REF.length, HULL_BUILDS.length, 'a reference for every hull');
  assert.equal(refOf(-1), 0); assert.equal(refOf(99), 0); assert.equal(clampHull(2.5), -1);
  // the reference is a hull's broadside a second, both sides in turn - the guns' own numbers
  const side = (h) => (h.broadside.length * GUNS[h.gun].hull) / GUNS[h.gun].reload;
  for (const hl of [HULL.SmallShip, HULL.Carrack]) assert.ok(Math.abs(SHIP_REF[hl] - side(HULL_BUILDS[hl]) * 1.15) < 2.5, `hull ${hl}`);
  const fastest = (SERPENT_TTK_S - SERPENT_BUCKET_DEPTH_X) / SERPENT_BUCKET_RATE_X;
  for (const hl of [HULL.LargeBoat, HULL.SmallShip, HULL.LargeGalley, HULL.Carrack]) {
    const f = surfaced(fightOf([hl]));
    assert.equal(f.max, SERPENT_TTK_S * SHIP_REF[hl]);
    let now = T0, n = 0;
    while (!f.fell && n < 100000) { f.shieldUntil = 0; applySerpentHit(f, 's1', 5000, ZONES.head, { x: 30, z: 0 }, now); now += 1000 / SERPENT_HIT_HZ_MAX; n++; }
    const took = (f.fell.at - T0) / 1000;
    assert.ok(Math.abs(took - fastest) <= 1000 / SERPENT_HIT_HZ_MAX / 1000 + 1e-9, `hull ${hl}: ${took} s`);
    assert.ok(f.players.s1.clipped > 0, 'the cap and the bucket clipped what was claimed');
  }
  const f = fightOf([-1]);
  assert.equal(f.max, 0, 'a hand brings nothing');
  surfaced(f);
  applySerpentHit(f, 's1', 50, ZONES.body, { x: 30, z: 0 }, T0);
  assert.equal(f.players.s1.dealt, 0, 'and deals nothing with guns it does not have');
  assert.ok(SERPENT_HIT_CAP_X <= SERPENT_BUCKET_DEPTH_X);
  // ONE blow with the bucket full lands SERPENT_HIT_CAP_X of the reference and no more - a held volley never dumps the bucket
  const g = surfaced(fightOf([HULL.Carrack]));
  g.shieldUntil = 0;
  applySerpentHit(g, 's1', 5000, ZONES.body, { x: 30, z: 0 }, T0);
  assert.ok(Math.abs(g.players.s1.dealt - SERPENT_HIT_CAP_X * SHIP_REF[HULL.Carrack]) < 1e-9, `the one-blow cap (${g.players.s1.dealt})`);
});

test('SERPENT1 brain: the join - a ship brings its share at the CURRENT fraction (a late ship heals nothing) with an empty bucket after first blood, the first claim kept, nobody new outside the waters\' time or after the end, and a full fight frees an idle seat (mutants: a late share added whole; a re-claim raising the hull; admits ignored)', () => {
  const f = surfaced(fightOf([HULL.Carrack]));
  applySerpentHit(f, 's1', 100, ZONES.body, { x: 30, z: 0 }, T0);
  const frac = f.hp / f.max;
  assert.ok(joinSerpentFight(f, 's2', 'P2', 30, HULL.SmallShip, T0 + 1000, true));
  assert.ok(Math.abs(f.hp / f.max - frac) < 1e-12, 'the fraction held');
  assert.equal(f.players.s2.bucket, 0, 'a late ship\'s bucket starts empty');
  // AUDIT SERPENT B4/H2: a bigger hull claimed later is HER ship now - her old share out, the new in at the fraction it
  // stands at, its bucket empty (the late ship's law); a smaller one later never shrinks it; her level is her first
  const before = f.max, frac2 = f.hp / f.max;
  assert.ok(joinSerpentFight(f, 's2', 'P2b', 60, HULL.Carrack, T0 + 2000, true));
  assert.equal(f.players.s2.hl, HULL.Carrack, 'the bigger hull claimed');
  assert.equal(f.max, before - SERPENT_TTK_S * SHIP_REF[HULL.SmallShip] + SERPENT_TTK_S * SHIP_REF[HULL.Carrack]);
  assert.ok(Math.abs(f.hp / f.max - frac2) < 1e-12, 'at the fraction it stands at');
  assert.equal(f.players.s2.bucket, 0, 'its bucket empty');
  assert.equal(f.players.s2.lv, 30, 'the first level kept');
  // PIN MOVED (AUDIT 2 XB9, 2026-10-06): a smaller warship of her own is her ship now too - her share down to hers, at the
  // fraction it stands at, her bucket kept (spendPurse holds it to her depth): never shrunk, a captain sailing one was
  // no ship of the fight at all (AUDIT SHIPS C1's `aboard`), and a true pair read as one. Her rowboat or a friend's
  // deck still takes her share out whole until she is aboard again (C1)
  const was = f.max, frac3 = f.hp / f.max, bucket = f.players.s2.bucket;
  assert.ok(joinSerpentFight(f, 's2', 'P2b', 60, HULL.LargeBoat, T0 + 3000, true));
  assert.equal(f.players.s2.hl, HULL.LargeBoat, 'a smaller warship of her own: hers');
  assert.equal(f.max, was - SERPENT_TTK_S * SHIP_REF[HULL.Carrack] + SERPENT_TTK_S * SHIP_REF[HULL.LargeBoat]);
  assert.ok(Math.abs(f.hp / f.max - frac3) < 1e-12, 'at the fraction it stands at');
  assert.equal(f.players.s2.bucket, bucket, 'her bucket kept');
  assert.equal(f.players.s2.retired, false, 'a ship of the fight');
  assert.equal(f.players.s2.name, 'P2b', 'the name follows the player');
  assert.ok(!joinSerpentFight(f, 's3', 'P3', 1, HULL.Carrack, T0, false), 'not while it admits nobody');
  const g = fightOf([]);
  for (let i = 0; i < SERPENT_FIGHTERS_MAX; i++) assert.ok(joinSerpentFight(g, `q${i}`, 'Q', 1, HULL.Rowboat, T0, true));
  assert.ok(!joinSerpentFight(g, 'late', 'L', 1, HULL.Carrack, T0, true), 'full, with no one to free');
  assert.ok(joinSerpentFight(g, 'late', 'L', 1, HULL.Carrack, T0, true, new Set()), 'full, an idle seat freed');
});

test('SERPENT1 brain: A BLOW - refused from a stranger, under its ward, past the blow rate, with no pose, from away from the fight, while nothing of it is above the sea, and from beyond a gun\'s reach of what is; the head thrown up lands HEAD_X, a stunned serpent STUN_X (mutants: each refusal removed; the head\'s weight given cruising)', () => {
  const near = { x: 30, z: 0 };
  const fresh = () => surfaced(fightOf([HULL.Carrack]));
  let f = fresh();
  applySerpentHit(f, 'stranger', 10, ZONES.body, near, T0);
  assert.equal(f.hp, f.max);
  f.shieldUntil = T0 + 1; applySerpentHit(f, 's1', 10, ZONES.body, near, T0);
  assert.equal(f.players.s1.dealt, 0, 'warded');
  f = fresh();
  for (let i = 0; i < SERPENT_HIT_HZ_MAX + 3; i++) applySerpentHit(f, 's1', 1, ZONES.body, near, T0);
  assert.equal(f.players.s1.dealt, SERPENT_HIT_HZ_MAX, 'past the blow rate in one instant');
  f = fresh(); applySerpentHit(f, 's1', 10, ZONES.body, null, T0); assert.equal(f.players.s1.dealt, 0, 'no pose');
  f = fresh(); applySerpentHit(f, 's1', 10, ZONES.body, { x: ENGAGE_R + SERPENT_POSE_SLACK + 5, z: 0 }, T0); assert.equal(f.players.s1.dealt, 0, 'away from the fight');
  f = fresh(); f.modes = [{ at: T0 - 30_000, m: MODE.deep }]; applySerpentHit(f, 's1', 10, ZONES.body, near, T0); assert.equal(f.players.s1.dealt, 0, 'sounded');
  f = fresh();
  applySerpentHit(f, 's1', 10, ZONES.body, { x: 60 + 4 + GUN_REACH_M + SERPENT_POSE_SLACK + 20, z: 0 }, T0);
  assert.equal(f.players.s1.dealt, 0, 'beyond a gun\'s reach');
  f = fresh();
  applySerpentHit(f, 's1', 10, ZONES.body, { x: 60 + GUN_REACH_M, z: 0 }, T0);
  assert.equal(f.players.s1.dealt, 10, 'within it');
  f = fresh(); applySerpentHit(f, 's1', 10, ZONES.head, near, T0); assert.equal(f.players.s1.dealt, 10, 'cruising, a ball on the head is a ball');
  f = fresh(); f.modes = [{ at: T0 - 30_000, m: MODE.breach }]; applySerpentHit(f, 's1', 10, ZONES.head, near, T0); assert.equal(f.players.s1.dealt, 10 * HEAD_X, 'thrown up');
  f = fresh(); f.stunUntil = T0 + 1; applySerpentHit(f, 's1', 10, ZONES.body, near, T0); assert.equal(f.players.s1.dealt, 10 * STUN_X, 'stunned');
  f = fresh(); f.stunUntil = T0 + 1; applySerpentHit(f, 's1', 10, ZONES.head, near, T0); assert.equal(f.players.s1.dealt, 10 * HEAD_X * STUN_X, 'stunned, its head on the water');
});

test('SERPENT1 brain: the opening - it surfaces and circles SERPENT_OPENING_MS before it strikes, then goes at a ship near it; the attacks\' tables - a coil only from the Coil on and only at a ship, the last attack left out while another is open, none thrice running (mutants: no opening; the coil in the Hunt; a hand coiled)', () => {
  const f = fightOf([HULL.Carrack]);
  const rng = seeded(3);
  const bodies = [body('s1', 120, 40)];
  let first = null;
  for (let t = T0; t < T0 + 30_000 && !first; t += 250) for (const o of stepSerpentBrain(f, t, bodies, rng)) if (o.k === 'atk' && !first) first = { ...o, t };
  assert.ok(first && first.t >= T0 + SERPENT_OPENING_MS, `the first attack at ${first?.t - T0}`);
  assert.equal(first.s, 's1');
  assert.ok(!serpentAttacksFor(1, 50, true).includes(SERPENT_ATTACK_TABLE.coil));
  assert.ok(serpentAttacksFor(2, 50, true).includes(SERPENT_ATTACK_TABLE.coil) && !serpentAttacksFor(2, 50, false).includes(SERPENT_ATTACK_TABLE.coil));
  assert.ok(serpentAttacksFor(3, 50, true).includes(SERPENT_ATTACK_TABLE.roar) && !serpentAttacksFor(2, 50, true).includes(SERPENT_ATTACK_TABLE.roar));
  assert.ok(!serpentAttacksFor(1, 20, true, SERPENT_ATTACK_TABLE.lash.id).includes(SERPENT_ATTACK_TABLE.lash), 'the last left out');
  assert.ok(!serpentAttacksFor(1, 20, true).includes(SERPENT_ATTACK_TABLE.ram), 'a ram needs room to run');
  assert.deepEqual(serpentAttacksFor(1, 999, true), [], 'nothing reaches');
  const rng2 = seeded(9), seen = new Map();
  for (let i = 0; i < 4000; i++) { const a = chooseSerpentAttack([SERPENT_ATTACK_TABLE.lash, SERPENT_ATTACK_TABLE.spit], rng2); seen.set(a, (seen.get(a) ?? 0) + 1); }
  assert.ok(Math.abs(seen.get(SERPENT_ATTACK_TABLE.lash) / 4000 - 0.6) < 0.04, 'by weight');
  for (const A of SERPENT_ATTACK_BY_ID) assert.ok(A.windup >= 2600, `${A.key}: a wind-up a ship can see coming`);
});

test('SERPENT1 brain: THE TURNS - at 66% its ward and Satakal\'s Call then a coil on the ship it hates most; at 33% its ward, the Maelstrom forming where it swims (SERPENT3; the waters\' heart before) and the Abyssal Roar from its eye, the serpent circling the eye reared (mutants: a phase threshold off; no ward; the coil not following the call)', () => {
  const f = surfaced(fightOf([HULL.Carrack, HULL.SmallShip]));
  const rng = seeded(5);
  const bodies = [body('s1', 120, 40), body('s2', -90, 60)];
  f.threat.s2 = 500;
  f.hp = f.max * SERPENT_PHASE_AT[0] - 1;
  const words = [];
  for (let t = T0; t < T0 + 20_000; t += 250) for (const o of stepSerpentBrain(f, t, bodies, rng)) words.push({ ...o, t });
  const ph = words.find((o) => o.k === 'ph');
  assert.deepEqual([ph.n, ph.until - ph.t], [2, SERPENT_SHIELD_MS]);
  const atks = words.filter((o) => o.k === 'atk').map((o) => SERPENT_ATTACK_BY_ID[o.a].key);
  assert.deepEqual(atks.slice(0, 2), SERPENT_PHASE_TURN[2]);
  const coil = words.find((o) => o.k === 'atk' && o.a === SERPENT_ATTACK_TABLE.coil.id);
  assert.ok(coil.s === 's2' || coil.s === 's1');
  // the third phase
  const g = surfaced(fightOf([HULL.Carrack]));
  g.phase = 2; g.hp = g.max * SERPENT_PHASE_AT[1] - 1;
  const w2 = [];
  let seen = null;
  for (let t = T0; t < T0 + 20_000; t += 250) {
    for (const o of stepSerpentBrain(g, t, [body('s1', 150, 0)], rng)) w2.push({ ...o, t });
    const mm = w2.find((o) => o.k === 'mael');
    if (mm && !seen && t >= mm.at + 2000) seen = { h: headAt(g.legs, mm.at + 2000), m: modeAt(g.modes, mm.at + 2000) };
  }
  assert.deepEqual(w2.filter((o) => o.k === 'atk').map((o) => SERPENT_ATTACK_BY_ID[o.a].key).slice(0, 2), SERPENT_PHASE_TURN[3]);
  const m = w2.find((o) => o.k === 'mael');
  const forming = w2.find((o) => o.k === 'atk' && o.a === SERPENT_ATTACK_TABLE.mael.id);
  // PIN MOVED (SERPENT3): the whirl forms where it swims - where its word said it would, its round inside its waters -
  // no longer at the waters' heart, where its head leapt onto the round
  assert.deepEqual([m.x, m.z], forming.tg[0], 'where its word said it forms');
  assert.ok(Math.hypot(m.x, m.z) <= ARENA_R - MAEL_ORBIT_R + 0.01, 'its round inside its waters');
  assert.equal(m.at, forming.at, 'formed at the forming\'s landing');
  assert.ok(Math.abs(Math.hypot(seen.h.x - m.x, seen.h.z - m.z) - MAEL_ORBIT_R) < 1, `circling the eye: ${Math.hypot(seen.h.x - m.x, seen.h.z - m.z)}`);
  assert.equal(seen.m, MODE.rear, 'reared out of the whirl');
});

/** A fight with a coil just landed on s1 (at the origin), the second ship at its guns. */
function coiled() {
  const f = surfaced(fightOf([HULL.Carrack, HULL.Carrack]));
  f.phase = 2;
  const rng = seeded(2);
  f.atk = { i: 9, a: SERPENT_ATTACK_TABLE.coil.id, at: T0 + 100, x: 50, z: 0, yw: 0, tg: [[0, 0]], until: T0 + 100 + SERPENT_ATTACK_TABLE.coil.recover, s: 's1' };
  f.seq = 9;
  const bodies = [body('s1', 0, 0), body('s2', 150, 0)];
  f.threat = { s1: 5, s2: 5 };   // both at their guns before it - AUDIT SERPENT T3: the coil's health is the fighting ships'
  const words = [];
  for (let t = T0; t <= T0 + 500; t += 250) for (const o of stepSerpentBrain(f, t, bodies, rng)) words.push(o);
  return { f, rng, bodies, words };
}

test('SERPENT1 brain: THE COIL - it winds about the ship where its ring was said with COIL_TEAM_S of the fighters\' broadsides as its health; her word `held` brings it onto her hull, `esc` within COIL_ESC_MS lets it close on empty sea, and only she speaks for her (mutants: anyone\'s word heard; an escape heard late; the health off the team)', () => {
  const { f, words } = coiled();
  const c = words.find((o) => o.k === 'coil');
  assert.ok(c && c.s === 's1' && c.x === 0 && c.z === 0);
  assert.equal(c.m, Math.max(COIL_HP_MIN, COIL_TEAM_S * 2 * SHIP_REF[HULL.Carrack]));
  // AUDIT SERPENT T3: ships with no fire on it (no threat) and wrecks bring the coil nothing
  const idle = surfaced(fightOf([HULL.Carrack, HULL.Carrack]));
  idle.phase = 2; idle.threat = { s1: 5 }; idle.seq = 9;
  idle.atk = { i: 9, a: SERPENT_ATTACK_TABLE.coil.id, at: T0 + 100, x: 50, z: 0, yw: 0, tg: [[0, 0]], until: T0 + 100 + SERPENT_ATTACK_TABLE.coil.recover, s: 's1' };
  const iw = [];
  for (let t = T0; t <= T0 + 500; t += 250) for (const o of stepSerpentBrain(idle, t, [body('s1', 0, 0), body('s2', 150, 0)], seeded(2))) iw.push(o);
  assert.equal(iw.find((o) => o.k === 'coil').m, Math.max(COIL_HP_MIN, COIL_TEAM_S * SHIP_REF[HULL.Carrack]), 'the silent ship brings it nothing');
  assert.ok(coilHolds(f, T0 + 500));
  assert.deepEqual(coilWord(f, 's2', 'esc', 9, 0, 0, T0 + 600), [], 'another\'s word is nothing');
  const held = coilWord(f, 's1', 'held', 9, 12, -8, T0 + 600);
  assert.equal(held[0].k, 'coil');
  assert.deepEqual([f.coil.x, f.coil.z], [12, -8], 'onto her hull\'s middle');
  assert.deepEqual(coilWord(f, 's1', 'esc', 9, 0, 0, T0 + 700), [], 'once held, held');
  const g = coiled().f;
  assert.deepEqual(coilWord(g, 's1', 'esc', 9, 0, 0, T0 + 100 + COIL_ESC_MS + 1), [], 'too late to slip it');
  const out = coilWord(g, 's1', 'esc', 9, 0, 0, T0 + 900);
  assert.equal(out.at(-1).k, 'cx');
  assert.ok(!coilHolds(g, T0 + 1000));
});

test('SERPENT1 brain: A COIL BROKEN by the ships\' fire lets go and lies SERPENT_STUN_MS stunned (no blow of its, its head the prize); one left whole crushes her at COIL_MS (mutants: the stun not set; the crush never said; blows on the coil landing on its health)', () => {
  const { f, rng, bodies } = coiled();
  coilWord(f, 's1', 'held', 9, 0, 0, T0 + 600);
  const hp = f.hp;
  let t = T0 + 700, broke = null;
  while (!broke && t < T0 + 20_000) { for (const o of applySerpentHit(f, 's2', 40, ZONES.coil, { x: 150, z: 0 }, t)) if (o.k === 'cb') broke = o; t += 300; }
  // PIN MOVED (AUDIT SHIPS D2, 2026-10-06): stunned from the break, its letting go said SERPENT_SAY_AHEAD_MS on (the
  // word's moment is the coil's `off`, which every screen unwinds it from)
  assert.ok(broke && broke.n === 'P2' && broke.su === broke.at - SERPENT_SAY_AHEAD_MS + SERPENT_STUN_MS);
  // AUDIT SERPENT T3: the coil's health first - and SERPENT_COIL_PASS of every blow on it off its own
  assert.ok(Math.abs(f.hp - (hp - f.players.s2.cd * SERPENT_COIL_PASS)) < 1e-6, `the coil's fire passes through (${hp} -> ${f.hp})`);
  assert.ok(f.players.s2.cd > 0 && f.players.s2.cd === f.players.s2.dealt);
  const during = [];
  for (let u = t; u < broke.su; u += 250) for (const o of stepSerpentBrain(f, u, bodies, rng)) during.push(o);
  assert.ok(!during.some((o) => o.k === 'atk'), 'stunned, it strikes nothing');
  const g = coiled();
  coilWord(g.f, 's1', 'held', 9, 0, 0, T0 + 600);
  const after = [];
  for (let u = T0 + 750; u <= T0 + 100 + COIL_MS + 500; u += 250) for (const o of stepSerpentBrain(g.f, u, g.bodies, g.rng)) after.push(o);
  assert.ok(after.some((o) => o.k === 'cr'), 'crushed');
  assert.ok(!coilHolds(g.f, T0 + 100 + COIL_MS + 600));
});

test('SERPENT1 brain: THE END - the kill stamps its fall once with its three best and the chart, and nothing moves it after; unslain at its sounding it dives and is gone; who serpentEarned it - a ship that dealt SERPENT_RECEIPT_SHARE of its share, a hand that stood SERPENT_STOOD_SHARE of it, nobody before the fall (mutants: a hand earning by a dealt of nought; the share of the whole health; a blow after the fall)', () => {
  const f = surfaced(fightOf([HULL.Carrack, HULL.SmallShip, -1]));
  const rng = seeded(4);
  const bodies = [body('s1', 30, 0), body('s2', -40, 0), body('s3', 30, 2)];
  // the second ship comes for ten seconds and sails off; the first and the hand aboard her stand it out
  for (let t = T0; t < T0 + 60_000; t += 250) stepSerpentBrain(f, t, t < T0 + 10_000 ? bodies : [bodies[0], bodies[2]], rng);
  assert.ok(!serpentEarned(f, 's3'), 'nobody before the fall');
  surfaced(f, T0 + 60_000);   // up again, round the heart, for the blows
  f.shieldUntil = 0;
  applySerpentHit(f, 's2', SERPENT_RECEIPT_SHARE * f.players.s2.share * 0.5, ZONES.body, { x: -40, z: 0 }, T0 + 60_000);
  let t = T0 + 60_100;
  for (let n = 0; !f.fell && n < 5000; n++) { f.shieldUntil = 0; for (const o of applySerpentHit(f, 's1', 5000, ZONES.body, { x: 30, z: 0 }, t)) if (o.k === 'fell') assert.equal(o.top[0], 'P1'); t += 200; }
  assert.ok(f.fell, 'felled');
  assert.deepEqual(f.fell.top, serpentTopDealers(f, 3));
  assert.equal(f.fell.dm.length, 3);
  assert.ok(serpentEarned(f, 's1') && serpentEarnedBy(f, 's1') === 'dealt');
  assert.ok(!serpentEarned(f, 's2'), 'half the share it needed, and ten seconds stood');
  assert.ok(f.players.s3.stoodMs >= SERPENT_STOOD_SHARE * f.liveMs && serpentEarned(f, 's3') && serpentEarnedBy(f, 's3') === 'stood', 'the hand stood it out');
  const was = f.players.s1.dealt;
  applySerpentHit(f, 's1', 10, ZONES.body, { x: 30, z: 0 }, t + 1000);
  assert.equal(f.players.s1.dealt, was);
  assert.ok(!joinSerpentFight(f, 'new', 'N', 1, HULL.Carrack, t, true));
  // the sounding
  const g = surfaced(fightOf([HULL.Carrack]));
  const out = stepSerpentBrain(g, SOUND, [body('s1', 30, 0)], rng);
  assert.equal(out.at(-1).k, 'gone');
  assert.ok(g.gone && !g.fell && !serpentEarned(g, 's1'));
  // PIN MOVED (AUDIT SHIPS B5, 2026-10-06): its dive said SERPENT_SAY_AHEAD_MS on, as every turn of its swim is
  assert.equal(depthAt(g.modes, 0, SOUND + SERPENT_SAY_AHEAD_MS + MODE_BLEND_MS), DEEP_Y, 'gone into the deep');
});

test('SERPENT1 brain: a share leaves with its fighter (SERPENT_ABSENT_RETIRE_MS away) and comes back at the fraction it stands at; threat picks the ship that dealt most; a hand is never picked while a ship is at the fight (mutants: the share kept; a hand picked first)', () => {
  const f = surfaced(fightOf([HULL.Carrack, HULL.Carrack]));
  const rng = seeded(8);
  const max = f.max;
  for (let t = T0; t <= T0 + SERPENT_ABSENT_RETIRE_MS + 500; t += 250) stepSerpentBrain(f, t, [body('s1', 30, 0)], rng);
  assert.equal(f.max, max / 2, 'the absent ship\'s share out');
  stepSerpentBrain(f, T0 + SERPENT_ABSENT_RETIRE_MS + 750, [body('s1', 30, 0), body('s2', 40, 0)], rng);
  assert.equal(f.max, max);
  const g = fightOf([HULL.Carrack, -1, HULL.SmallShip]);
  g.threat = { s1: 10, s3: 100, s2: 1000 };
  const picks = new Map();
  const r = seeded(1);
  for (let i = 0; i < 400; i++) { const p = pickSerpentTarget(g, [body('s1', 0, 0), body('s2', 0, 0), body('s3', 0, 0)], r); picks.set(p.sub, (picks.get(p.sub) ?? 0) + 1); }
  assert.ok(!picks.has('s2'), 'the hand rides the ship - the ship is the target');
  assert.ok(picks.get('s3') > picks.get('s1') * 2);
});

test('SERPENT1 brain: THE CHECKPOINT - the fight is plain numbers and strings: the state that went to storage steps exactly as the one that did not; the `st` frame carries every field a joiner draws from; a pruned track lets go of nothing the body lies along (mutants: a field the state drops; the prune by count alone)', () => {
  const f = surfaced(fightOf([HULL.Carrack, HULL.SmallShip]));
  const bodies = [body('s1', 120, 40), body('s2', -90, 60)];
  const early = seeded(12);
  for (let t = T0; t < T0 + 90_000; t += 250) stepSerpentBrain(f, t, bodies, early);
  const g = JSON.parse(JSON.stringify(f));
  const rng1 = seeded(77), rng2 = seeded(77);   // the same dice from the checkpoint on
  const a = [], b = [];
  for (let t = T0 + 90_000; t < T0 + 150_000; t += 250) { a.push(...stepSerpentBrain(f, t, bodies, rng1)); b.push(...stepSerpentBrain(g, t, bodies, rng2)); }
  assert.deepEqual(b, a);
  const st = serpentStateOf(f);
  for (const k of ['d', 'b', 'sx', 'sz', 'ph', 'h', 'm', 'legs', 'modes', 'coil', 'mael', 'atk', 'sh', 'su', 'sa', 'n', 'op', 'fell', 'gone']) assert.ok(k in st, k);
  // the prune
  const t = T0 + 150_000;
  const before = bodyAt(f, t).map((p) => [p.x, p.y, p.z]);
  pruneLegs(f, t);
  assert.deepEqual(bodyAt(f, t).map((p) => [p.x, p.y, p.z]), before);
  assert.ok(f.legs.length <= 12, `${f.legs.length} legs kept`);
});

test('SERPENT1 brain: THE SWIM - over a long fight its head never leaves its waters by more than a turn\'s width, a ram runs its lane at RAM_V from the wind-up\'s end, a breach bursts up where its mark was said (mutants: the aim unbounded; the ram run during its wind-up; the breach placed late)', () => {
  const f = fightOf([HULL.Carrack, HULL.SmallShip]);
  const rng = seeded(21);
  const bodies = [body('s1', 300, 200), body('s2', -350, -100)];
  let far = 0, ram = null, breach = null;
  for (let t = T0; t < T0 + 240_000; t += 250) {
    for (const o of stepSerpentBrain(f, t, bodies, rng)) {
      if (o.k === 'atk' && o.a === SERPENT_ATTACK_TABLE.ram.id && !ram) ram = o;
      if (o.k === 'atk' && o.a === SERPENT_ATTACK_TABLE.breach.id && !breach) breach = o;
    }
    const h = headAt(f.legs, t);
    far = Math.max(far, Math.hypot(h.x, h.z));
  }
  assert.ok(far < ARENA_R + 200, `its head ${far.toFixed(0)} m from the heart`);
  assert.ok(ram && breach, 'both seen');
  assert.ok(Math.abs(Math.hypot(ram.tg[1][0] - ram.tg[0][0], ram.tg[1][1] - ram.tg[0][1]) - ramLen()) < 0.05);
  // replay the legs the brain kept: at the ram's landing the head is at its lane's start, a second on RAM_V along it
  const g = fightOf([HULL.Carrack, HULL.SmallShip]);
  const r2 = seeded(21);
  let atRam = null, atBreach = null;
  for (let t = T0; t < T0 + 240_000; t += 250) {
    stepSerpentBrain(g, t, bodies, r2);
    if (!atRam && t >= ram.at + 1000) atRam = headAt(g.legs, ram.at + 1000);
    if (!atBreach && t >= breach.at) atBreach = headAt(g.legs, breach.at);
  }
  const along = Math.hypot(atRam.x - ram.tg[0][0], atRam.z - ram.tg[0][1]);
  assert.ok(Math.abs(along - RAM_V) < 0.6, `a second down the lane: ${along}`);
  assert.ok(Math.hypot(atBreach.x - breach.tg[0][0], atBreach.z - breach.tg[0][1]) < 0.5, 'up where it was marked');
  assert.ok(BREACH_LEAD_MS < SERPENT_ATTACK_TABLE.breach.windup);
});
