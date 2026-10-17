// EG-FULL, LAYER TWO (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 10.3-10.5): THE
// SPANS' LAW AND THE TIMED SOLVER (net/eliteGates/egSpanLaw.js), and the pieces on the screen (scenes/eliteGates/egSpan.js, scenes/eliteGates/egFight.js's
// place) - every piece where the one law has it on the shared clock; THE SPAN BUILD's reach held UNDER the real motor's
// (player/motor.js PlayerMotor over player/collider.js Collider - the solver is never generous); every laid course proven
// and a refused one laid again; a Rail that carries, a Pendulum whose touch casts back (Iron Footing III stands it), a
// Gust that pushes (Iron Footing takes its share), a Drop walled, a Vent that bites once an eruption.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egPieceAt, egPendAt, egPendHits, egVentState, egInVentDisc, egJumpReach, egSpanPairs, egPairWindows, egSpanProof,
  EG_SPAN_RUN_MPS, EG_JUMP_MPS, EG_JUMP_G, EG_JUMP_FWD, EG_BODY_R, EG_BEAT_CYCLE_S, EG_BEAT_SOLID_S, EG_CRUMBLE_DELAY_S, EG_PEND_REACH,
  EG_VENT_R, EG_VENT_FIRE_S, EG_VENT_TELL_S, EG_DROP_WALL_H, EG_WINDOW_MIN, EG_WAIT_MAX } from '../../../src/net/eliteGates/egSpanLaw.js';
import { egHallOf, egCircleSpecs, EG_RELAY_MAX, EG_VENT_PCT, EG_BELT_MPS } from '../../../src/net/eliteGates/egLaw.js';
import { egCircleColliderTris } from '../../../src/world/eliteGates/egHall.js';
import { runSpeed, JUMP_SPEED, GRAVITY, JUMP_FWD_BOOST, CAPSULE_RADIUS, PlayerMotor } from '../../../src/player/motor.js';
import { Collider } from '../../../src/player/collider.js';
import { stepTris } from '../../../src/world/superDungeon/sdStepsModel.js';
import { SD_BEAT_CYCLE, SD_BEAT_SOLID, SD_CRUMBLE_DELAY, gustAt } from '../../../src/world/superDungeon/sdSteps.js';
import { createEgSpan, egDropTris, egStepKey } from '../../../src/scenes/eliteGates/egSpan.js';
import { createEgFight } from '../../../src/scenes/eliteGates/egFight.js';
import { EG_FIGHT_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { realmToDungeon, dungeonToRealm } from '../../../src/net/superDungeon/sdBrain.js';
import { registerSpireFooting, registerSpireWake } from '../../../src/systems/eliteGates/spireKit.js';

const still = (o = {}) => ({ forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, ...o });
/** THE SPAN BUILD on the real motor: does a running jump from 0.1 m short of one slab's edge land on the next, `gap`
 *  metres on and `dh` higher? */
function crosses(gap, dh) {
  const col = new Collider(() => -Infinity), { positions, indices } = stepTris('drift'), d = 2.4;
  col.addMesh('a', positions, indices, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 10, 0, 1]);
  col.addMesh('b', positions, indices, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 10 + dh, d + gap, 1]);
  const m = new PlayerMotor(col, { speed: 10, running: 0, swimming: 30 });
  m.spawn(0, 10, -d / 2 + 0.4);
  let jumped = false;
  for (let k = 0; k < 400; k++) {
    const go = !jumped && m.pos[2] >= d / 2 - 0.1;
    m.update(1 / 60, still({ forward: 1, run: true, jump: go, up: go }), 0);
    if (go) jumped = true;
    if (m.pos[1] < 5) return false;
    if (jumped && m.grounded && m.groundKey === 'b') return true;
  }
  return false;
}

test('EG-FULL THE PIECES\' LAW (section 10.3): a Drift swings across and a Rail travels along by their own amp and period; a Beat stands its solid share of the Steps\' cycle; a Pendulum\'s weight swings EG_PEND_REACH either side over the middle of its gap and a touch is inside it; a Vent is told over its last EG_VENT_TELL_S and erupts its last EG_VENT_FIRE_S; the motor\'s and the Steps\' numbers pinned equal (mutants: a Rail moving across; a Beat off its cycle; a Vent untold)', () => {
  assert.ok(Math.abs(EG_SPAN_RUN_MPS - runSpeed(10, 0)) < 1e-9, 'THE SPAN BUILD\'s run is the motor\'s');
  assert.deepEqual([EG_JUMP_MPS, EG_JUMP_G, EG_JUMP_FWD, EG_BODY_R], [JUMP_SPEED, GRAVITY, JUMP_FWD_BOOST, CAPSULE_RADIUS]);
  assert.deepEqual([EG_BEAT_CYCLE_S, EG_BEAT_SOLID_S, EG_CRUMBLE_DELAY_S], [SD_BEAT_CYCLE, SD_BEAT_SOLID, SD_CRUMBLE_DELAY]);
  const drift = { kind: 'drift', amp: 1.5, period: 6, phase: 0 }, rail = { kind: 'rail', amp: 2, period: 8, phase: 0 };
  assert.ok(Math.abs(egPieceAt(drift, 1.5).dx - 1.5) < 1e-9 && egPieceAt(drift, 1.5).dz === 0, 'a Drift a quarter through, at its amp across');
  assert.ok(Math.abs(egPieceAt(rail, 2).dz - 2) < 1e-9 && egPieceAt(rail, 2).dx === 0, 'a Rail a quarter through, at its amp along');
  const beat = { kind: 'beat', beat: 1.8 };
  assert.equal(egPieceAt(beat, 1.8).solid, true);
  assert.equal(egPieceAt(beat, 1.8 + SD_BEAT_SOLID + 0.01).solid, false);
  assert.equal(egPieceAt(beat, 1.8 + SD_BEAT_CYCLE).solid, true);
  const pend = { kind: 'pend', x: 0, y: 0, z: 10, d: 2.6, gap: 3, period: 4, phase: 0 };
  assert.deepEqual(egPendAt(pend, 0), { x: 0, z: 10 - 1.3 - 1.5 });
  assert.ok(Math.abs(egPendAt(pend, 1).x - EG_PEND_REACH) < 1e-9, 'a quarter through, at its reach');
  assert.equal(egPendHits(pend, 0, 0, 0, 7.2), true, 'in its path at the course\'s middle');
  assert.equal(egPendHits(pend, 1, 0, 0, 7.2), false, 'swung away');
  const vent = { kind: 'vent', x: 0, z: 0, period: 5, phase: 0 };
  assert.deepEqual(egVentState(vent, 1), { tell: 0, fire: false });
  assert.ok(Math.abs(egVentState(vent, 5 - EG_VENT_FIRE_S - EG_VENT_TELL_S / 2).tell - 0.5) < 1e-9, 'its ring half closed');
  assert.equal(egVentState(vent, 5 - EG_VENT_FIRE_S / 2).fire, true);
  assert.equal(egInVentDisc(vent, EG_VENT_R - 0.01, 0), true);
  assert.equal(egInVentDisc(vent, EG_VENT_R + 0.01, 0), false);
  assert.equal(EG_VENT_PCT, 0.2, 'a span Vent bites as a Rampart\'s does - one number');
});

test('EG-FULL THE REACH IS NEVER GENEROUS (section 10.5): at every height the solver allows - level, a metre down, a Drop\'s 4.5 m, 0.4 m up - THE SPAN BUILD on the real motor crosses the widest gap the solver lets stand, and the solver\'s widest level gap covers the envelope\'s 3.2 m (mutants: a reach past the motor\'s; a reach that refuses the envelope)', () => {
  for (const dh of [0, -1, -4.5, 0.4]) {
    const { reach } = egJumpReach(dh);
    assert.ok(reach > 2, `a reach at ${dh}`);
    assert.ok(crosses(reach, dh), `the real motor crosses the solver's ${reach.toFixed(2)} m at ${dh} m`);
  }
  assert.ok(egJumpReach(0).reach >= 3.2, 'the envelope\'s widest gap stands');
  assert.equal(egJumpReach(1).reach, 0, 'no running jump rises a metre');
  assert.ok(egJumpReach(-1).reach > egJumpReach(0).reach && egJumpReach(0).reach > egJumpReach(0.4).reach);
});

test('EG-FULL THE TIMED SOLVER (section 10.5): every course the generator lays is proven - its pairs a window of EG_WINDOW_MIN in every 12 s and never more than EG_WAIT_MAX to wait, every Crumble left in time, every Vent\'s platform and Drop\'s landing wide enough; a gap past the reach, a Rail that strands its rider and a Pendulum that never clears are refused; a course laid again says how often (mutants: the solver skipped; a wait unbounded; a redraw that never tries)', () => {
  // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): spec law 8's halls by name, each the one course THE TIMED SOLVER proves
  // whole; a LAW 9 hall's courses are proven where they stand (net/eliteGates/egLaw.js egAscentProof - test/net/eliteGates/law9_rooms.test.js)
  let laid = 0, halls = 0;
  for (const seed of [77, 0xbeef, 3, 99]) {
    for (let c = 1; c <= 20; c++) {
      for (const geo of [0, 4]) {
        for (const s of egCircleSpecs(seed, c, geo, 8)) {
          if (!s.steps.length) continue;
          halls++;
          const p = egSpanProof(s);
          assert.ok(p.ok, `seed ${seed} hall ${s.h} geo ${geo}: ${p.why.slice(0, 3).join('; ')}`);
          assert.ok(s.laid >= 0 && s.laid <= EG_RELAY_MAX + 1);
          if (s.laid > 0) laid++;
          for (const pair of egSpanPairs(s)) { const w = egPairWindows(pair); assert.ok(w.worst12 >= EG_WINDOW_MIN && w.wait <= EG_WAIT_MAX); }
        }
      }
    }
  }
  assert.ok(halls > 300 && laid > 0, `some courses laid again (${laid} of ${halls})`);
  // refusals, from a laid hall bent
  const base = egHallOf(77, 2, 0), steps = base.steps.map((q) => ({ ...q }));
  const far = { ...base, steps: steps.map((q, k) => (k === 1 ? { ...q, z: q.z + 1.5, gap: q.gap + 1.5 } : k > 1 ? { ...q, z: q.z + 1.5 } : q)) };
  assert.equal(egSpanProof(far).ok, false, 'a gap past the reach');
  const rail = { kind: 'rail', i: 0, x: 0, y: 0, z: 10, w: 3, d: 3, amp: 6, period: 8, phase: 0, gap: 3.1, beat: 0, span: 0 };
  assert.ok(egSpanProof({ steps: [rail] }).why.some((w) => /Rail's travel closes/.test(w)), 'a Rail whose travel closes on what stands before it - refused for that');   // LAYER THREE: by its own reason (THE MEDIAN would refuse it too)
  const pend = { kind: 'pend', i: 0, x: 0, y: 0, z: 10, w: 3, d: 2.6, amp: 0, period: 0.9, phase: 0, gap: 3, beat: 0, span: 0 };
  assert.equal(egSpanProof({ steps: [pend] }).ok, false, 'a Pendulum too quick to pass');
  assert.equal(egSpanProof({ steps: [{ ...pend, kind: 'vent', w: 3, d: 3, period: 5 }] }).ok, false, 'a Vent on a narrow platform');
  assert.equal(egSpanProof({ steps: [{ ...pend, kind: 'still', period: 0 }] }).ok, true, 'a still slab 3 m on');
  const A = { kind: 'drift', i: 0, x: 0, y: 0, z: 10, w: 3, d: 2.4, amp: 5, period: 14, phase: 0, gap: 3, beat: 0, span: 0 }, B2 = { ...A, i: 1, z: 15.4, phase: Math.PI };
  const opposed = egSpanProof({ steps: [A, B2] });
  assert.deepEqual(opposed.why, ['1: a wait of 5.00 s'], 'two Drifts swung apart: windows enough, but too long a wait between them');
});

test('EG-FULL THE PIECES ON THE SCREEN (section 10.3): a Rail stands where the law has it and carries its rider; a Pendulum\'s touch casts me back to my last floor - Iron Footing III stands it; a Gust section pushes me as the Steps\' breath does, Iron Footing taking its share; a Drop\'s landing is walled to EG_DROP_WALL_H on its far side and flanks (mutants: the rider left behind; the pendulum harmless; the gust unweighed)', () => {
  // a Wellhead circle carries every piece; find a Rail, a Pendulum and a Gust section
  let found = null;
  for (let seed = 1; seed < 400 && !found; seed++) for (let c = 16; c <= 20 && !found; c++) {
    const specs = egCircleSpecs(seed, c, 1), all = specs.flatMap((s) => s.steps.map((q) => ({ s, q })));
    const r = all.find((x) => x.q.kind === 'rail'), p = all.find((x) => x.q.kind === 'pend'), g = all.find((x) => x.q.kind === 'gust');
    if (r && p && g) found = { seed, c, r, p, g };
  }
  assert.ok(found, 'a circle with a Rail, a Pendulum and a Gust');
  const span = createEgSpan({ seed: found.seed, c: found.c, geo: 1 });
  const buckets = new Map();
  span.stand({ dynamicDraws: [], collider: { addMesh: (key, p, i, m, T) => buckets.set(key, T) } });
  // the Rail: where the law has it, its rider carried
  const { s: rs, q: rq } = found.r, t0 = rq.period / 4 - rq.phase * rq.period / (2 * Math.PI);
  const carried = [];
  const rider = { pos: realmToDungeon(rs.x0 + rq.x, rq.y, rq.z), grounded: true, groundKey: egStepKey(rs.h, rq.i), height: 1.8, carryBy: (dx, dy, dz) => carried.push([dx, dy, dz]), collider: { move: () => {} } };
  span.ride(t0, 0.016, rider, true);
  span.ride(t0 + 0.5, 0.016, rider, true);
  const T = buckets.get(egStepKey(rs.h, rq.i))();
  const want = realmToDungeon(rs.x0 + rq.x, rq.y, rq.z + egPieceAt(rq, t0 + 0.5).dz);
  assert.ok(Math.abs(T[2] - want[2]) < 1e-6 && Math.abs(T[0] - want[0]) < 1e-6, 'the Rail stands where the law has it');
  assert.ok(carried.length && Math.abs(carried.at(-1)[2] - (egPieceAt(rq, t0 + 0.5).dz - egPieceAt(rq, t0).dz)) < 1e-6, 'its rider carried along');
  // the Pendulum: a touch casts back, Iron Footing III stands it
  const { s: ps, q: pq } = found.p;
  const floorKey = 'eg:hall', standOn = realmToDungeon(ps.x0, 0, 1.5);
  const body = { pos: [...standOn], grounded: true, groundKey: floorKey, height: 1.8, carryBy: () => {}, collider: { move: () => {} } };
  span.ride(0, 0.016, body, true);   // my floor marked
  let tHit = 0;
  for (let k = 0; k < 400; k++) { const w = egPendAt(pq, k * 0.01); if (Math.abs(w.x - pq.x) < 0.05) { tHit = k * 0.01; break; } }
  const w = egPendAt(pq, tHit);
  body.pos = realmToDungeon(ps.x0 + pq.x, pq.y, w.z); body.grounded = false; body.groundKey = null;
  const back = span.ride(tHit, 0.016, body, true);
  assert.ok(back && Math.abs(back[2] - standOn[2]) < 1e-6, 'the Pendulum\'s touch casts me back to my last floor');
  registerSpireFooting(() => 1);
  try { assert.equal(span.ride(tHit, 0.016, body, true), null, 'Iron Footing III stands it'); } finally { registerSpireFooting(null); }
  // the Gust: the breath's push, Iron Footing's share off it
  const { s: gs, q: gq } = found.g;
  let tg = 0; for (let k = 0; k < 1200; k++) if (gustAt(k * 0.01).push) { tg = k * 0.01; break; }
  const moved = [];
  const gb = { pos: realmToDungeon(gs.x0 + gq.x, gq.y, gq.z), grounded: true, groundKey: egStepKey(gs.h, gq.i), height: 1.8, jumping: false, carryBy: () => {}, collider: { move: (p, dx) => moved.push(dx) } };
  span.ride(tg, 0.05, gb, true);
  assert.ok(Math.abs(moved.at(-1) - gustAt(tg).push * 0.05) < 1e-9, 'pushed as the breath pushes');
  registerSpireFooting(() => 0.65);
  try { span.ride(tg, 0.05, gb, true); assert.ok(Math.abs(moved.at(-1) - gustAt(tg).push * 0.05 * 0.35) < 1e-9, 'Iron Footing II takes 65% off'); } finally { registerSpireFooting(null); }
  // the Drop: walled
  const tris = egDropTris(6, 6).positions;
  let top = -Infinity, far = -Infinity;
  for (let i = 0; i < tris.length; i += 3) { top = Math.max(top, tris[i + 1]); far = Math.max(far, tris[i + 2]); }
  assert.ok(Math.abs(top - EG_DROP_WALL_H) < 1e-6 && far > 3, 'its walls stand EG_DROP_WALL_H over the landing, past its far edge');
  void dungeonToRealm;
});

test('EG-FULL A VENT BITES ONCE AN ERUPTION (sections 8.3 and 10.3): standing in a span Vent\'s disc as it erupts takes its share, fire, once that eruption - again the next; standing clear takes nothing; the Rampart\'s vents told and judged as EG-PLAY had them (mutants: the vent judged every frame; the vent harmless)', () => {
  let at = null;
  for (let seed = 1; seed < 400 && !at; seed++) for (let h = 76; h <= 100 && !at; h++) { const s = egHallOf(seed, h, 0); const v = s.steps.find((q) => q.kind === 'vent'); if (v) at = { seed, h, s, v }; }
  assert.ok(at, 'a hall with a Vent');
  let t = 0;
  for (let k = 0; k < 2000; k++) if (egVentState(at.v, k * 0.01).fire) { t = k * 10 + 5; break; }
  const E = { b: '0123456789abcdef', h: at.h, seed: at.seed, geo: 0, sg: 'trial', end: null, hw: 1, fight: EG_FIGHT_EMPTY, co: [] };
  const hits = [];
  const entity = { health: 100, maxHealth: 100 };
  let feetAt = realmToDungeon(at.s.x0 + at.v.x, at.v.y, at.v.z);
  const fight = createEgFight({ link: { state: () => E }, now: () => t, feet: () => feetAt, player: () => entity, save: () => 100, strike: (d, how) => hits.push([d, how?.el]), me: () => 'acct-mac' });
  fight.frame(); fight.frame();
  assert.equal(hits.length, 1, 'once an eruption');
  assert.equal(hits[0][1], 'fire');
  assert.ok(hits[0][0] > 0);
  t += at.v.period * 1000; fight.frame();
  assert.equal(hits.length, 2, 'again the next');
  feetAt = realmToDungeon(at.s.x0 + at.v.x + EG_VENT_R + 0.6, at.v.y, at.v.z);
  t += at.v.period * 1000; fight.frame();
  assert.equal(hits.length, 2, 'clear of its disc, nothing');
});

test('EG-FULL THE RAMPART\'S GROUND (section 8.3): a Falling Wall\'s walkway stands as segments that fall behind the company - none before its hall wakes, none in its first 20 s, then segment by segment at 1.5 m/s - and a member caught is cast to the nearest standing segment ahead; neither the circle\'s mesh nor its collider carries that walkway; a Forge Bridge\'s walkway carries whoever stands on it toward the arrival plate at EG_BELT_MPS (mutants: the wall never falling; a caught member cast onto fallen ground; the belt running the wrong way)', () => {
  let fw = null, fb = null;
  for (let seed = 1; seed < 600 && !(fw && fb); seed++) for (let c = 2; c <= 20 && !(fw && fb); c++) for (const s of egCircleSpecs(seed, c, 0)) {
    if (!fw && s.variant === 'fallingwall') fw = { seed, c, s };
    if (!fb && s.variant === 'forgebridge') fb = { seed, c, s };
  }
  assert.ok(fw && fb, 'a Falling Wall and a Forge Bridge');
  const wake = { h: 0, hw: 0 };
  registerSpireWake(() => wake);
  try {
    const span = createEgSpan({ seed: fw.seed, c: fw.c, geo: 0 }), buckets = new Map();
    span.stand({ dynamicDraws: [], collider: { addMesh: (key, p, i, m, T) => buckets.set(key, T) } });
    const mine = span.walls.filter((g) => g.h === fw.s.h);
    assert.ok(mine.length > 20, 'the walkway as segments');
    assert.ok(Math.abs(mine.at(-1).z1 - fw.s.walk.z1) < 1e-6 && Math.abs(mine[0].z0 - fw.s.walk.z0) < 1e-6);
    const ride = (tMs, body = null) => span.ride(tMs / 1000, 0.016, body, !!body);
    ride(1_000_000);
    assert.ok(span.walls.filter((g) => g.h === fw.s.h).every((g) => !g.gone), 'nothing falls before the wake');
    wake.h = fw.s.h; wake.hw = 1_000_000;
    ride(1_000_000 + 19_000);
    assert.ok(span.walls.filter((g) => g.h === fw.s.h).every((g) => !g.gone), 'nor in its first 20 s');
    ride(1_000_000 + 20_000 + 10_000);   // 15 m fallen
    const now = span.walls.filter((g) => g.h === fw.s.h), edge = fw.s.walk.z0 + 15;
    for (const g of now) assert.equal(g.gone, g.z1 <= edge + 1e-9, `segment ${g.k} at ${g.z0.toFixed(1)}-${g.z1.toFixed(1)}`);
    assert.ok(now.some((g) => g.gone) && now.some((g) => !g.gone));
    // a member caught: stood behind the edge, falling into the void - cast to the nearest standing segment ahead
    const caught = { pos: realmToDungeon(fw.s.x0 + fw.s.walk.x, 0, fw.s.walk.z0 + 5), grounded: true, groundKey: now[2].key, height: 1.8, carryBy: () => {}, collider: { move: () => {} } };
    span.ride((1_000_000 + 5_000) / 1000, 0.016, caught, true);   // stood there before the fall (the cast-back's place marked)
    caught.grounded = false; caught.groundKey = null; caught.pos[1] -= 40;
    const back = span.ride((1_000_000 + 30_000) / 1000, 0.016, caught, true);
    assert.ok(back, 'cast back');
    const [, , bz] = dungeonToRealm(back[0], back[1], back[2]);
    const firstUp = now.find((g) => g.z0 >= edge - 1e-9);   // wholly ahead of the edge - never the one about to fall
    assert.ok(Math.abs(bz - (firstUp.z0 + firstUp.z1) / 2) < 1e-6, `onto the nearest standing segment ahead (${bz.toFixed(2)})`);
    // the circle's own mesh and collider leave that walkway out
    const tris = egCircleColliderTris(fw.seed, fw.c, 0);
    const mid = realmToDungeon(fw.s.x0 + fw.s.walk.x, 0, (fw.s.walk.z0 + fw.s.walk.z1) / 2);
    let under = false;
    for (let i = 0; i < tris.length; i += 9) {
      const xs = [tris[i], tris[i + 3], tris[i + 6]], zs = [tris[i + 2], tris[i + 5], tris[i + 8]], ys = [tris[i + 1], tris[i + 4], tris[i + 7]];
      if (ys.every((y) => Math.abs(y - mid[1]) < 0.01) && Math.min(...xs) <= mid[0] && Math.max(...xs) >= mid[0] && Math.min(...zs) <= mid[2] && Math.max(...zs) >= mid[2]) under = true;
    }
    assert.equal(under, false, 'no static floor under the falling walkway');
    // the Forge Bridge: carried toward the arrival plate
    const belt = createEgSpan({ seed: fb.seed, c: fb.c, geo: 0 });
    belt.stand({ dynamicDraws: [], collider: { addMesh: () => {} } });
    const moved = [];
    const onBelt = { pos: realmToDungeon(fb.s.x0 + fb.s.walk.x, 0, (fb.s.walk.z0 + fb.s.walk.z1) / 2), grounded: true, groundKey: 'eg:hall', height: 1.8, carryBy: () => {}, collider: { move: (p, dx, dy, dz) => moved.push([dx, dz]) } };
    belt.ride(10, 0.05, onBelt, true);
    assert.ok(moved.length && moved.at(-1)[0] === 0 && Math.abs(moved.at(-1)[1] + EG_BELT_MPS * 0.05) < 1e-9, 'toward the arrival plate at the belt\'s pace');
  } finally { registerSpireWake(null); }
});
