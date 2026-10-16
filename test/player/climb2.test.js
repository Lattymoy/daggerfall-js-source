// CLIMB2 (the Enhanced Climbing arc - bible/03-World/Parkour-Arc.md; Mac said yes to it after AUDIT CLIMB1): THE
// HANG, THE SHIMMY, THE GRIP AND THE FREE CLIMB. Mac's calls: "Jump is the grab" (a lip caught in the air is held;
// Forward climbs up, Crouch drops), "Skill scales it" (the grip's time, the climb's and the shimmy's pace), "Free-climb
// on grip" (a sheer wall climbed without the classic roll, on a grip that runs out) and the proposal's "heavy packs
// cut your reach". The laws (player/parkour.js), the hand-hold against a real Collider's boxes, the motor living
// every move, the classic lane untouched, and the hosts that feed and draw it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  senseGrip, wallContact, gripSeconds, shimmySpeed, freeClimbSpeed, freeStartSeconds, parkourReach, registerParkourGate, planCorner,
  PARKOUR_HANG_DROP, PARKOUR_HANG_LOW, PARKOUR_HANG_GAP, PARKOUR_GRIP_MIN_S, PARKOUR_GRIP_MAX_S, PARKOUR_GRIP_TIRED,
  PARKOUR_GRIP_REGEN_S, PARKOUR_GRIP_LOW, PARKOUR_GRIP_LOW_TEXT, PARKOUR_GRIP_MIN, PARKOUR_HAND_SPAN,
  PARKOUR_REACH_MIN, PARKOUR_AIR_REACH, PARKOUR_LOAD_CUT, PARKOUR_START_MIN_S, PARKOUR_START_MAX_S,
  PARKOUR_SHIMMY_MIN, PARKOUR_SHIMMY_MAX, PARKOUR_CLIMB_MIN, PARKOUR_CLIMB_MAX, PARKOUR_UP_GAP,
} from '../../src/player/parkour.js';
import { climbingSpeed, CONTINUE_CLIMBING_SKILL_CHECK_FREQUENCY } from '../../src/player/climbing.js';
import { overcapClimbSpeed } from '../../src/systems/skillSoftcap.js';
import {
  PlayerMotor, motionBagOf, CAPSULE_RADIUS, CAPSULE_HEIGHT, EYE_HEIGHT, SYSTEM_TIMER_UPDATES_DIVISOR,
} from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';
import { parkourDeps } from '../../src/scenes/shared.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BOX_IDX = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
const boxAt = (x0, y0, z0, x1, y1, z1) => new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]);

/** A floor, and boxes; `wall(top)` the usual block whose face stands at z = 1 across the look (+z), x -3..3. */
function scene(floorY = 0) {
  const col = new Collider(() => -100);
  col.addMesh('floor', new Float32Array([-20, floorY, -20, 20, floorY, -20, 20, floorY, 20, -20, floorY, 20]), [0, 1, 2, 0, 2, 3], I);
  let n = 0;
  const box = (x0, y0, z0, x1, y1, z1, key = `b${n++}`) => col.addMesh(key, boxAt(x0, y0, z0, x1, y1, z1), BOX_IDX, I);
  return { col, box };
}
const wall = (top = 2.3, depth = 3) => { const s = scene(); s.box(-3, 0, 1, 3, top, 1 + depth, 'block'); return s.col; };
const GEO = { radius: CAPSULE_RADIUS, stand: CAPSULE_HEIGHT };
const N = [0, 0, -1];
const BACK = CAPSULE_RADIUS + PARKOUR_HANG_GAP;
const near = (a, b, e = 1e-3) => Math.abs(a - b) <= e;

/** A motor on a world, the enhanced climb mounted (and the classic one, so its flag is read as the hosts read it),
 *  driven by a scripted input. Every step's state is logged. */
function drive(col, { skill = 50, fatigue = 1, load = 0, enabled = true, x = 0, z = 0.4, y = 0.02, steps = 200, input, rolls = null, spell = false }) {
  const said = [], tallies = [], classicRolls = [];
  const climbing = {
    inputs: () => ({ climbing: skill, luck: 50 }), tally: () => {}, say: () => {},
    rolls: () => { classicRolls.push(1); return rolls ?? 0; },
  };
  const m = new PlayerMotor(col, { speed: 50, running: 30 }, {
    climbing,
    parkour: {
      enabled: () => enabled, inputs: () => ({ climbing: skill, fatigue, load, enhanced: spell }),
      say: (l) => said.push(l), tally: () => tallies.push(1),
    },
  });
  m.spawn(x, y, z);
  const log = [];
  for (let i = 0; i < steps; i++) {
    m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: false, crouch: false, ...input(i, m) }, 0);
    log.push({
      i, st: m._pkMove ? `move:${m._pkMove.kind}` : m._wall ? m._wall.mode : m.grounded ? 'ground' : 'air',
      pos: [...m.pos], grip: m.grip, fell: m.landedFallDistance, edge: m.parkoured,
      // the render eye against the feet it interpolates (MAC1's stair filter would trail a climb)
      eyeLag: Math.abs(m.eyeAt()[1] - m.eye[1] - (m._prevPos[1] - m.pos[1]) * (1 - m._alpha)),
    });
  }
  return { m, log, said, tallies, classicRolls };
}
const firstAt = (log, st) => log.find((e) => e.st === st);
const states = (log) => log.reduce((a, e) => (a[a.length - 1] === e.st ? a : [...a, e.st]), []);
const held = (from = 10, to = 40) => (i) => ({ jump: i >= from && i < to });

test('CLIMB2: the laws - the grip\'s time is the skill\'s and the body\'s Fatigue\'s, the pace the skill\'s, the reach less under a heavy pack', () => {
  assert.equal(gripSeconds(0), PARKOUR_GRIP_MIN_S);
  assert.equal(gripSeconds(100), PARKOUR_GRIP_MAX_S);
  assert.ok(near(gripSeconds(50), 18), 'half way');
  assert.ok(near(gripSeconds(100, 0), PARKOUR_GRIP_MAX_S * PARKOUR_GRIP_TIRED), 'a spent body holds on a third as long');
  assert.ok(gripSeconds(50, 0.5) < gripSeconds(50, 1) && gripSeconds(50, 0.5) > gripSeconds(50, 0));
  assert.equal(gripSeconds(150), PARKOUR_GRIP_MAX_S, 'past 100 no longer');
  assert.equal(shimmySpeed(0), PARKOUR_SHIMMY_MIN);
  assert.equal(shimmySpeed(100), PARKOUR_SHIMMY_MAX);
  assert.ok(near(freeClimbSpeed(6, 0), climbingSpeed(6) * PARKOUR_CLIMB_MIN), 'the classic climb\'s pace (Speed / 3) at a share');
  assert.ok(near(freeClimbSpeed(6, 100), climbingSpeed(6) * PARKOUR_CLIMB_MAX));
  assert.ok(near(freeClimbSpeed(6, 50, true), 2 * freeClimbSpeed(6, 50)), 'the Climbing spell doubles it, as the classic climb\'s');
  assert.equal(freeStartSeconds(0), PARKOUR_START_MIN_S);
  assert.equal(freeStartSeconds(100), PARKOUR_START_MAX_S);
  assert.ok(PARKOUR_START_MIN_S < 14 * SYSTEM_TIMER_UPDATES_DIVISOR, 'quicker than the classic start (0.77 s and a roll)');
  // the pack: nothing to half of it, the whole cut at a full one, no more past it
  assert.equal(parkourReach(50, 0), parkourReach(50));
  assert.equal(parkourReach(50, 0.5), parkourReach(50));
  assert.ok(near(parkourReach(50, 1), parkourReach(50) - PARKOUR_LOAD_CUT));
  assert.ok(near(parkourReach(50, 0.75), parkourReach(50) - PARKOUR_LOAD_CUT / 2));
  assert.ok(near(parkourReach(50, 3), parkourReach(50) - PARKOUR_LOAD_CUT));
  // a hang is in reach whatever the pack: the chest is under the shortest air reach
  assert.ok(PARKOUR_HANG_LOW < PARKOUR_REACH_MIN - PARKOUR_LOAD_CUT + PARKOUR_AIR_REACH);
  // the hanging body: the eye 0.1 under the lip (the motor's EYE_HEIGHT restated)
  assert.ok(near(PARKOUR_HANG_DROP - EYE_HEIGHT, 0.1));
  assert.equal(PARKOUR_HANG_GAP, PARKOUR_UP_GAP);
});

test('CLIMB2: the hand-hold - the lip where the wall steps out, the body hanging under it; a wall running on, a gap, a sill too thin and no room are none', () => {
  const g = senseGrip(wall(2.5), [0, 0, 1], N, 2.5, GEO);
  assert.ok(g, 'a lip');
  assert.ok(near(g.lipY, 2.5));
  assert.deepEqual(g.normal.map((v) => Math.round(v * 1000) / 1000 + 0), [0, 0, -1]);
  assert.ok(near(g.feet[1], 2.5 - PARKOUR_HANG_DROP) && near(g.feet[2], 1 - BACK) && near(g.feet[0], 0), 'the body off the face by its radius and a gap, the lip 1.8 over its feet');
  assert.equal(g.key, 'block');
  for (const want of [2.4, 2.62]) assert.ok(near(senseGrip(wall(2.5), [0, 0, 1], N, want, GEO)?.lipY ?? NaN, 2.5), `found from ${want}, inside the window`);
  assert.equal(senseGrip(wall(2.5), [0, 0, 1], N, 2.7, GEO), null, 'out of the window');
  assert.equal(senseGrip(wall(8), [0, 0, 1], N, 2.5, GEO), null, 'a wall that runs on over the window is no lip');
  assert.equal(senseGrip(wall(2.5), [3.2, 0, 1], N, 2.5, GEO), null, 'past the wall\'s end: air');
  assert.ok(senseGrip(wall(2.5), [2.9, 0, 1], N, 2.5, GEO, false), 'at the very edge the hand still takes it');
  const sill = (depth) => { const s = scene(); s.box(-3, 0, 1 + depth, 3, 8, 4, 'wall'); s.box(-1, 2.4, 1, 1, 2.5, 1 + depth, 'sill'); return s.col; };
  assert.equal(senseGrip(sill(0.1), [0, 0, 1], N, 2.5, GEO)?.key, 'sill', 'a 10 cm sill on a tall wall');
  assert.equal(senseGrip(sill(0.05), [0, 0, 1], N, 2.5, GEO), null, 'a 5 cm one is too thin for the fingers');
  assert.equal(senseGrip(wall(1.5), [0, 0, 1], N, 1.5, GEO), null, 'the floor too near under the lip for a body to hang');
  assert.ok(senseGrip(wall(1.5), [0, 0, 1], N, 1.5, GEO, false), '...though the hands could hold it');
  // a pitched top past 50 degrees is no hold
  const roof = scene();
  roof.col.addMesh('roof', new Float32Array([-3, 2.5, 1, 3, 2.5, 1, 3, 3.5, 1.5, -3, 3.5, 1.5]), [0, 2, 1, 0, 3, 2], I);
  roof.box(-3, 0, 1, 3, 2.5, 1.02);
  assert.equal(senseGrip(roof.col, [0, 0, 1], N, 2.5, GEO), null, 'a 63-degree roof');
  // a knife-edge ridge - the top falling back from the face's edge at 55 degrees - is no hold (steeper than a top, and
  // the top's ray, a rung and a little long, finds nothing under the edge at all)
  const ridge = scene(), P = [], fall = 2.5 - 0.3 * Math.tan((55 * Math.PI) / 180);
  for (const x of [-3, 3]) P.push(x, 0, 1, x, 2.5, 1, x, fall, 1.3, x, 0, 1.3);
  const Q = [[0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [0, 3, 7, 4], [0, 1, 2, 3], [4, 7, 6, 5]];
  ridge.col.addMesh('ridge', new Float32Array(P), Q.flatMap(([a, b, c, d]) => [a, b, c, a, c, d]), I);
  assert.equal(senseGrip(ridge.col, [0, 0, 1], N, 2.5, GEO), null, 'a knife edge');
  // a top read outside the window is refused: a curb's plate is the edge the rungs meet, the top behind it 18 cm
  // under the lip expected; asked about where it is, it is found
  const curb = scene(); curb.box(-3, 0, 1, 3, 2.32, 4); curb.box(-3, 2.32, 1, 3, 2.36, 1.01);
  assert.equal(senseGrip(curb.col, [0, 0, 1], N, 2.5, GEO), null, 'outside the window');
  assert.ok(near(senseGrip(curb.col, [0, 0, 1], N, 2.36, GEO)?.lipY ?? NaN, 2.32, 0.01));
  // a face turned more than 30 degrees from the one expected is another wall, not this one
  const turned = [Math.sin(0.7), 0, -Math.cos(0.7)];
  assert.equal(senseGrip(wall(2.5), [0, 0, 1], turned, 2.5, GEO), null);
});

test('CLIMB2: the free climber\'s wall is a face - a walkable ramp is not one, a steep face is', () => {
  const k = Math.tan((40 * Math.PI) / 180), ramp = scene();
  ramp.col.addMesh('ramp', new Float32Array([-3, 0, 1, 3, 0, 1, 3, 2, 1 + 2 / k, -3, 2, 1 + 2 / k]), [0, 2, 1, 0, 3, 2], I);
  assert.equal(wallContact(ramp.col, [0, 0.2 * k, 1.2], [0, 0, 1], CAPSULE_HEIGHT, CAPSULE_RADIUS), null, 'a 40-degree ramp, stood on');
  const m = Math.tan((60 * Math.PI) / 180), steep = scene();
  steep.col.addMesh('steep', new Float32Array([-3, 0, 1, 3, 0, 1, 3, 3, 1 + 3 / m, -3, 3, 1 + 3 / m]), [0, 2, 1, 0, 3, 2], I);
  const c = wallContact(steep.col, [0, 0, 0.8], [0, 0, 1], CAPSULE_HEIGHT, CAPSULE_RADIUS);
  assert.ok(c && near(c.normal[2], -1, 1e-3), 'a 60-degree face is climbed, its normal levelled');
  assert.ok(near(wallContact(wall(3), [0, 0, 0.6], [0, 0, 1], CAPSULE_HEIGHT, CAPSULE_RADIUS)?.dist ?? NaN, 0.4));
  assert.equal(wallContact(wall(3), [0, 0, 0.3], [0, 0, 1], CAPSULE_HEIGHT, CAPSULE_RADIUS), null, 'out of the body\'s reach');
});

test('CLIMB2 LIVE: Jump held without Forward catches a chest-high lip and HOLDS it - the body under the lip, the eye just below it, a climb to all that reads one', () => {
  const r = drive(wall(2.3), { skill: 100, input: held() });
  assert.deepEqual(states(r.log), ['ground', 'air', 'move:catch', 'hang']);
  assert.equal(r.m.hanging, true);
  assert.ok(near(r.m.pos[1], 2.3 - PARKOUR_HANG_DROP, 0.01) && near(r.m.pos[2], 1 - BACK, 0.01), `under the lip (${r.m.pos.map((v) => v.toFixed(2))})`);
  assert.ok(near(r.m.eye[1], 2.3 - 0.1, 0.02), `the eye just under the lip (${r.m.eye[1].toFixed(2)})`);
  assert.deepEqual(r.log.filter((e) => e.edge).map((e) => e.edge), ['catch'], 'one catch billed (a jump\'s exertion, Climbing trained)');
  assert.equal(r.m.climb.isClimbing, true, 'the classic climb\'s flag: the fatigue band\'s climbing arm, the bob, the torch and the shield');
  assert.equal(motionBagOf(r.m).climbing, true);
  assert.equal(r.m.grounded, false);
  assert.equal(r.m.falling, false, 'held, no fall');
  // the hang holds still - no gravity - while the grip lasts
  const y = r.m.pos[1], g = r.m.grip;
  for (let i = 0; i < 60; i++) r.m.update(1 / 60, { forward: 0, strafe: 0, jump: false }, 0);
  assert.ok(near(r.m.pos[1], y, 1e-6), 'a second later, where it hung');
  assert.ok(near(g - r.m.grip, 1 / gripSeconds(100), 1e-3), `a second's grip spent (${(g - r.m.grip).toFixed(4)})`);
  assert.deepEqual(r.m.gripShown, { amount: r.m.grip, low: false }, 'the HUD\'s grip');
});

test('CLIMB2 LIVE: the way into the hang is proven - a pole beside the pull toward the wall refuses the catch, and the lip is climbed onto round it instead', () => {
  const run = (pole) => {
    const s = scene();
    s.box(-3, 0, 1, 3, 2.4, 4);
    if (pole) s.box(0.31, 0, 0.35, 0.37, 3, 0.41);   // clear of the body where it is caught and where it would hang
    const m = new PlayerMotor(s.col, { speed: 50, running: 30 }, { parkour: { enabled: () => true, inputs: () => ({ climbing: 100 }) } });
    m.spawn(0, 1.0, 0.15);   // falling 0.85 m out from the face, Jump held
    const seen = [];
    for (let i = 0; i < 40; i++) {
      m.update(1 / 60, { forward: 0, strafe: 0, jump: true }, 0);
      const st = m._pkMove ? m._pkMove.kind : m._wall ? m._wall.mode : 'free';
      if (seen[seen.length - 1] !== st) seen.push(st);
    }
    return seen;
  };
  assert.deepEqual(run(false).slice(0, 2), ['catch', 'hang'], 'no pole: caught and held');
  const round = run(true);
  assert.ok(!round.includes('catch'), 'the pole on the way: no catch through it');
  assert.ok(round.includes('mantle'), `climbed onto round it (${round.join(' > ')})`);
});

test('CLIMB2 LIVE: from the hang Forward climbs up onto the top; a fresh Jump does too; the Jump the catch spent does not', () => {
  const w = drive(wall(2.3), { skill: 100, steps: 140, input: (i) => ({ ...held()(i), forward: i >= 70 && i < 80 ? 1 : 0 }) });
  assert.deepEqual(states(w.log).slice(-3), ['hang', 'move:mantle', 'ground']);
  assert.ok(near(w.m.pos[1], 2.3, 0.03) && w.m.pos[2] > 1.3, 'on the top');
  assert.equal(w.m.climb.isClimbing, false);
  const j = drive(wall(2.3), { skill: 100, steps: 140, input: (i) => ({ jump: (i >= 10 && i < 40) || i === 70 }) });
  assert.equal(firstAt(j.log, 'move:mantle')?.i, 70, 'a fresh press');
  // Jump held on from the catch: the hang stays
  const k = drive(wall(2.3), { skill: 100, steps: 140, input: (i) => ({ jump: i >= 10 }) });
  assert.equal(k.m.hanging, true, 'held from the catch, the Jump is spent');
});

test('CLIMB2 LIVE: Crouch lets go - the body falls from the hang and no crouch is toggled; a held Jump does not take the lip back', () => {
  // a 2.7 m lip, at the top of a Climbing 100 jump's reach: the hang's feet 0.9 m over the floor
  const r = drive(wall(2.7), { skill: 100, steps: 150, input: (i) => ({ jump: i >= 10, crouch: i === 60 }) });
  assert.ok(r.log.some((e) => e.st === 'hang'), 'caught and held');
  const drop = r.log.findIndex((e, i) => i > 0 && r.log[i - 1].st === 'hang' && e.st === 'air');
  assert.ok(drop >= 60 && drop <= 61, `let go on the press (step ${drop})`);
  assert.equal(r.m.crouching, false, 'the press toggled no crouch');
  assert.ok(!r.log.slice(drop).some((e) => e.st === 'move:catch' || e.st === 'hang'), 'the held Jump took nothing back');
  const land = r.log.slice(drop).find((e) => e.fell > 0);
  assert.ok(land && near(land.fell, 2.7 - PARKOUR_HANG_DROP, 0.05), `the fall billed from where the hands let go (${land?.fell.toFixed(2)})`);
});

test('CLIMB2 LIVE: the wall taken in a fall holds the fall there - let go, the fall is billed from where the hands let go, not from where it began', () => {
  // falling beside a sheer wall with Forward held, Jump pressed a moment in: the hands take the wall; Crouch at once
  const r = drive(wall(9), { skill: 100, z: 0.6, y: 6, steps: 120, input: (i, m) => ({ forward: 1, jump: i >= 15, crouch: m.onWall }) });
  const grabbed = r.log.find((e) => e.st === 'climb');
  assert.ok(grabbed && grabbed.pos[1] < 6 - 0.3, `taken a way into the fall (at ${grabbed?.pos[1].toFixed(2)})`);
  const landed = r.log.find((e) => e.fell > 1);
  assert.ok(landed && near(landed.fell, grabbed.pos[1], 0.1), `billed ${landed?.fell.toFixed(2)} m, from the wall`);
});

test('CLIMB2 LIVE: let go of a free climb with Jump held - the lip above is not taken back', () => {
  let phase = 0;
  const r = drive(wall(3.0), { skill: 100, z: 0.6, steps: 160, input: (i, m) => {
    if (phase === 0 && m.onWall && m.pos[1] >= 0.8) phase = 1;
    if (phase === 1) { phase = 2; return { jump: true }; }
    if (phase === 2) { phase = 3; return { jump: true, crouch: true }; }
    return phase >= 3 ? { jump: true } : { forward: 1 };
  } });
  const let_ = r.log.findIndex((e, i) => i && r.log[i - 1].st === 'climb' && e.st !== 'climb');
  assert.ok(let_ > 0, 'let go');
  assert.ok(!r.log.slice(let_).some((e) => e.st === 'move:catch' || e.st === 'hang' || e.st === 'climb'), 'the Jump held through the letting go caught nothing');
});

test('CLIMB2 LIVE: a lip with no top to climb onto - a sill under a soffit - holds; Forward asks once; Back climbs down the face', () => {
  // CLIMB3 moved this pin: a sill on a wall that goes on up over it is climbed past (test/player/climb3.test.js); this one is
  // under a soffit standing out over the body 0.4 m above it, nothing for the hands to go on up
  const s = scene();
  s.box(-3, 0, 1.12, 3, 2.7, 4, 'wall');
  s.box(-3, 2.7, 0.1, 3, 2.9, 4, 'soffit');
  s.box(-1.5, 2.2, 1, 1.5, 2.3, 1.12, 'sill');
  let asks = 0;
  const r = drive(s.col, { skill: 100, steps: 200, input: (i, m) => {
    if (i === 60) { const real = m.collider.surfaceHit.bind(m.collider); m.collider.surfaceHit = (...a) => { asks++; return real(...a); }; }
    return { ...held()(i), forward: i >= 60 && i < 120 ? 1 : i >= 140 ? -1 : 0 };
  } });
  assert.ok(r.log[100].st === 'hang' && r.log[119].st === 'hang', 'Forward held finds no way up and the hands keep the sill');
  assert.ok(asks < 150, `the way up is asked once, not every step (${asks} top rays over 60 steps: the hold's own one a step, and one ask)`);
  assert.equal(r.log[150].st, 'climb', 'Back: the free climb down the wall under it');
  assert.ok(r.m.pos[1] < 0.1 && r.m.climb.isClimbing === false, 'down to the floor, standing');
});

test('CLIMB2 LIVE: the shimmy - along the lip at the skill\'s pace, following its height; the lead hand stops it where the lip ends', () => {
  // (a lip over the standing reach and under the jump's: 2.0 m at Climbing 0, 2.3 at 100)
  const pace = (skill) => {
    const r = drive(wall(skill ? 2.3 : 2.0), { skill, steps: 180, input: (i) => ({ ...held()(i), strafe: i >= 60 && i < 120 ? 1 : 0 }) });
    assert.equal(r.log[59].st, 'hang', `hanging at Climbing ${skill}`);
    return r.log[119].pos[0] - r.log[59].pos[0];
  };
  assert.ok(near(pace(0), PARKOUR_SHIMMY_MIN, 0.03), `Climbing 0: ${pace(0).toFixed(2)} m in a second`);
  assert.ok(near(pace(100), PARKOUR_SHIMMY_MAX, 0.03), `Climbing 100: ${pace(100).toFixed(2)} m`);
  // Left too (the look's left, facing the wall)
  const left = drive(wall(2.3), { skill: 100, steps: 180, input: (i) => ({ ...held()(i), strafe: i >= 60 ? -1 : 0 }) });
  assert.ok(near(left.log[119].pos[0] - left.log[59].pos[0], -PARKOUR_SHIMMY_MAX, 0.03), 'left, at the same pace');
  // a lip that steps down 10 cm half way: the hands follow it
  const s = scene();
  s.box(-3, 0, 1, 0, 2.3, 4); s.box(0, 0, 1, 3, 2.2, 4);
  const step = drive(s.col, { skill: 100, x: -1, steps: 240, input: (i) => ({ ...held()(i), strafe: i >= 60 ? 1 : 0 }) });
  assert.ok(step.m.pos[0] > 1.5 && near(step.m.pos[1], 2.2 - PARKOUR_HANG_DROP, 0.01), `along and down the step (${step.m.pos.map((v) => v.toFixed(2))})`);
  // a gap wider than the hands: stopped short of it
  const g = scene();
  g.box(-3, 0, 1, 1, 2.3, 4); g.box(1.6, 0, 1, 4, 2.3, 4);
  const gap = drive(g.col, { skill: 100, steps: 300, input: (i) => ({ ...held()(i), strafe: i >= 60 ? 1 : 0 }) });
  assert.equal(gap.m.hanging, true);
  assert.ok(near(gap.m.pos[0], 1 - PARKOUR_HAND_SPAN, 0.03), `stopped a hand short of the gap (x ${gap.m.pos[0].toFixed(2)})`);
  // a lip that ends against a taller wall running on: no corner, stopped
  const t = scene();
  t.box(-3, 0, 1, 1, 2.3, 4); t.box(1, 0, 1, 4, 6, 4);
  const tall = drive(t.col, { skill: 100, steps: 300, input: (i) => ({ ...held()(i), strafe: i >= 60 ? 1 : 0 }) });
  assert.ok(tall.m.hanging && near(tall.m.pos[0], 1 - PARKOUR_HAND_SPAN, 0.03));
});

test('CLIMB2 LIVE: corners - the hands follow the lip round an outer corner and into an inner one, and a hold of Right carries them round the whole building', () => {
  const r = drive(wall(2.3, 3), { skill: 100, x: 1.5, steps: 900, input: (i) => ({ ...held()(i), strafe: i >= 60 ? 1 : 0 }) });
  const normals = [];
  for (const e of r.log) if (e.st === 'hang') { const k = `${Math.round(e.pos[0])},${Math.round(e.pos[2])}`; if (normals[normals.length - 1] !== k) normals.push(k); }
  const turns = r.log.filter((e, i) => i && e.st === 'move:corner' && r.log[i - 1].st !== 'move:corner').length;
  assert.equal(turns, 4, 'four outer corners, and back to the front');
  assert.ok(r.m.hanging && near(r.m.pos[2], 1 - BACK, 0.01) && r.m.pos[0] > -2.8, `on the front face again (${r.m.pos.map((v) => v.toFixed(2))})`);
  assert.ok(!r.log.some((e) => e.edge === 'corner'), 'a corner bills no exertion');
  // a downpipe on the corner's own diagonal, clear of both hangs: the way round is proven, and there is none
  const pipe = scene();
  pipe.box(-3, 0, 1, 3, 2.3, 4); pipe.box(3.33, 0, 0.63, 3.37, 2.6, 0.67);
  const piped = drive(pipe.col, { skill: 100, x: 1.5, steps: 260, input: (i) => ({ ...held()(i), strafe: i >= 60 ? 1 : 0 }) });
  assert.ok(!piped.log.some((e) => e.st === 'move:corner') && piped.m.hanging, 'stopped at the edge');
  // an L: the second block stands out toward the body on the right
  const L = scene();
  L.box(-3, 0, 1, 3, 2.3, 4); L.box(2, 0, -2, 4, 2.3, 1);
  const inner = drive(L.col, { skill: 100, steps: 300, input: (i) => ({ ...held()(i), strafe: i >= 60 ? 1 : 0 }) });
  const at = inner.log.find((e, i) => i && inner.log[i - 1].st === 'move:corner' && e.st === 'hang');
  assert.ok(at && near(at.pos[0], 2 - BACK, 0.02), `turned to face the wall across the lip (${at?.pos.map((v) => v.toFixed(2))})`);
  assert.ok(inner.m.pos[2] < 0, 'and on along it, away from the first face');
});

test('CLIMB2 LIVE: the grip runs out - at Climbing 0 a hang holds six seconds, says so as it fails, and lets go; tired, a third of that; back on the ground it returns', () => {
  const r = drive(wall(2.1), { skill: 0, steps: 520, input: held() });
  // timed from the catch: the catch's own pull spends the grip as the hang does (AUDIT CLIMB2 H4)
  const caught = firstAt(r.log, 'move:catch').i;
  const gone = r.log.findIndex((e, i) => i > caught && e.st !== 'hang' && e.st !== 'move:catch');
  assert.ok(near((gone - caught) / 60, PARKOUR_GRIP_MIN_S, 0.05), `held ${((gone - caught) / 60).toFixed(2)} s`);
  assert.deepEqual(r.said, [PARKOUR_GRIP_LOW_TEXT], 'the line once, as it failed');
  const warned = r.log.findIndex((e) => e.grip <= PARKOUR_GRIP_LOW);
  assert.ok(r.log[warned].st === 'hang');
  assert.ok(r.m.grounded, 'fell to the floor');
  // tired
  const t = drive(wall(2.1), { skill: 0, fatigue: 0, steps: 300, input: held() });
  const tc = firstAt(t.log, 'move:catch').i;
  const tg = t.log.findIndex((e, i) => i > tc && e.st !== 'hang' && e.st !== 'move:catch');
  assert.ok(near((tg - tc) / 60, PARKOUR_GRIP_MIN_S * PARKOUR_GRIP_TIRED, 0.05), `tired: ${((tg - tc) / 60).toFixed(2)} s`);
  // on the ground it comes back, whole in PARKOUR_GRIP_REGEN_S
  r.m.grip = 0;
  const g0 = r.m.grip, ticks = Math.round(PARKOUR_GRIP_REGEN_S * 60 * 0.5);
  for (let i = 0; i < ticks; i++) r.m.update(1 / 60, { forward: 0, strafe: 0, jump: false }, 0);
  assert.ok(near(r.m.grip - g0, 0.5, 0.02), 'half back in half the time');
  assert.equal(r.m.gripShown.amount, r.m.grip, 'the HUD shows it coming back');
  for (let i = 0; i < ticks + 5; i++) r.m.update(1 / 60, { forward: 0, strafe: 0, jump: false }, 0);
  assert.equal(r.m.grip, 1);
  assert.equal(r.m.gripShown, null, 'whole, and off the wall: the HUD draws none');
});

test('CLIMB2 LIVE: a spent grip takes no hold - no catch, no grab, no free climb', () => {
  const c = new PlayerMotor(wall(2.3), { speed: 50, running: 30 }, { parkour: { enabled: () => true, inputs: () => ({ climbing: 100 }) } });
  c.spawn(0, 0.02, 0.4);
  let took = false;
  for (let i = 0; i < 40; i++) { c.grip = 0; c.update(1 / 60, { forward: 0, strafe: 0, jump: i >= 10 && i < 40 }, 0); took ||= c.onWall || c.mantling; }
  assert.equal(took, false, 'nothing caught, not for a step');
  const f = new PlayerMotor(wall(6), { speed: 50, running: 30 }, { parkour: { enabled: () => true, inputs: () => ({ climbing: 100 }) } });
  f.spawn(0, 0.02, 0.6);
  let held = false;
  for (let i = 0; i < 90; i++) { f.grip = 0; f.update(1 / 60, { forward: 1, strafe: 0, jump: i >= 10 && i < 40 }, 0); held ||= f.onWall; }
  assert.equal(held, false, 'no grab and no free climb');
  const g = new PlayerMotor(wall(6), { speed: 50, running: 30 }, { parkour: { enabled: () => true, inputs: () => ({ climbing: 100 }) } });
  g.spawn(0, 0.02, 0.6);
  held = false;
  for (let i = 0; i < 90; i++) { g.grip = 0; g.update(1 / 60, { forward: 1, strafe: 0, jump: false }, 0); held ||= g.onWall; }
  assert.equal(held, false, 'Forward held against the wall starts no free climb');
  assert.ok(PARKOUR_GRIP_MIN > 0);
});

test('CLIMB2 LIVE: the free climb - Forward held against a wall, the skill\'s start time and no roll; up at the skill\'s pace; its top is the lip, climbed over with Forward still held', () => {
  const r = drive(wall(4.0), { skill: 50, z: 0.6, steps: 240, input: () => ({ forward: 1 }), rolls: 0.99 });
  const start = firstAt(r.log, 'climb').i;
  const pushed = r.log.findIndex((e) => near(e.pos[2], 1 - CAPSULE_RADIUS, 0.005));
  assert.ok(near((start - pushed) / 60, freeStartSeconds(50), 2 / 60), `started ${((start - pushed) / 60).toFixed(2)} s after the wall stopped it`);
  assert.equal(r.classicRolls.length, 0, 'the classic machine never rolled - a roll that fails every time changes nothing');
  const a = r.log[start + 20], b = r.log[start + 50];
  const v = (b.pos[1] - a.pos[1]) / (30 / 60);
  assert.ok(near(v, freeClimbSpeed(r.m.speed, 50), 0.05), `up at ${v.toFixed(2)} m/s`);
  const lag = Math.max(...r.log.filter((e) => e.st === 'climb').map((e) => e.eyeLag));
  assert.ok(lag < 1e-4, `the eye rides the climber, not MAC1's stair filter (lag ${lag.toFixed(4)})`);
  assert.deepEqual(states(r.log).slice(0, 4), ['ground', 'climb', 'move:mantle', 'ground'], 'the lip held, and climbed straight over');
  const pull = firstAt(r.log, 'move:mantle');
  // AUDIT CLIMB2 H5: the top-out is CLIMB1's - over the lip once it comes within the hands' reach (a lower wall's lip
  // never comes to the hang's height)
  assert.ok(near(pull.pos[1], 4.0 - (parkourReach(50) + PARKOUR_AIR_REACH), 0.06), `over the lip once it came within the reach (from ${pull.pos[1].toFixed(3)})`);
  const top = r.log.find((e, i) => i && r.log[i - 1].st === 'move:mantle' && e.st === 'ground');
  assert.ok(near(top.pos[1], 4.0, 0.03), 'on the top');
  // Forward let go as the lip comes to the hands: they hold it
  const stop = drive(wall(4.0), { skill: 50, z: 0.6, steps: 240, input: (i, m) => ({ forward: m.pos[1] > 1.8 ? 0 : 1 }) });
  assert.equal(stop.m.onWall, true, 'held on the wall below the top');
  assert.ok(r.tallies.length >= 1, 'the Climbing skill tallied on the wall');
  // the classic lane: the same wall and the same hold roll the classic machine, and nothing of this runs
  const off = drive(wall(4.0), { skill: 50, enabled: false, z: 0.6, steps: 120, input: () => ({ forward: 1 }), rolls: 0 });
  assert.ok(off.classicRolls.length > 0, 'the classic climb rolled');
  assert.ok(!off.log.some((e) => e.st === 'climb' || e.st === 'hang'));
});

test('CLIMB2 LIVE: on the wall - Back climbs down to the floor and stands; across, the wall\'s edge stops the body; held still, the grip drains at half', () => {
  // (HUG-TOUCH, FIELD BUGS 2026-10-02: 165 steps up, not 150 - the classic hug's deep press leaned on that seam and shoved
  // the climb up it 0.5 cm a step faster than its pace, as on the far side of such a seam it shoved a climb down)
  const down = drive(wall(6), { skill: 50, z: 0.6, steps: 440, input: (i) => ({ forward: i < 165 ? 1 : -1 }) });
  assert.ok(down.log[164].pos[1] > 3, 'up past the face\'s own seam (the box face\'s diagonal crosses x = 0 at y = 3)');
  const off = down.log.findIndex((e, i) => i > 165 && e.st === 'ground');
  assert.ok(off > 150 && near(down.log[off].pos[1], 0, 0.02), 'down and standing');
  assert.ok(Math.abs(down.log[off].pos[0]) < 1e-3, `straight down: the hug's press slides nothing along the face (it took a climb 2.8 m sideways; x ${down.log[off].pos[0].toFixed(3)})`);
  // let go high on the wall: the fall is billed from where the hands let go, the whole of it
  const drop = drive(wall(9), { skill: 100, z: 0.6, steps: 400, input: (i, m) => ({ forward: m.pos[1] < 5.6 && m.onWall ? 1 : (m.pos[1] < 5.6 && !m.onWall && i < 60 ? 1 : 0), crouch: m.pos[1] >= 5.6 && m.onWall }) });
  const landed = drop.log.find((e) => e.fell > 1);
  assert.ok(landed && near(landed.fell, 5.6, 0.1), `a drop from 5.6 m billed ${landed?.fell.toFixed(2)} m`);
  const across = drive(wall(6), { skill: 50, x: 2, z: 0.6, steps: 300, input: (i) => ({ forward: i < 80 ? 1 : 0, strafe: i >= 80 ? 1 : 0 }) });
  assert.equal(across.m.onWall, true, 'still on the wall');
  assert.ok(across.m.pos[0] < 3 && across.m.pos[0] > 2.6, `stopped at the edge (x ${across.m.pos[0].toFixed(2)})`);
  const still = drive(wall(6), { skill: 0, z: 0.6, steps: 400, input: (i) => ({ forward: i < 60 ? 1 : 0 }) });
  const s0 = still.log[100].grip, s1 = still.log[160].grip;
  assert.ok(near(s0 - s1, 0.5 / PARKOUR_GRIP_MIN_S, 0.003), `a second held still costs half a second's grip (${(s0 - s1).toFixed(4)})`);
});

test('CLIMB2 LIVE: out of the water - a swimmer\'s Forward held against a wall starts the free climb as the classic climb\'s did; a catch or a mantle does not start from the water', () => {
  const m = new PlayerMotor(wall(3), { speed: 50, running: 30 }, { parkour: { enabled: () => true, inputs: () => ({ climbing: 50 }) } });
  m.spawn(0, 0.02, 0.6);
  m.swimming = true;   // (the host's water model says so)
  let started = -1;
  for (let i = 0; i < 90 && started < 0; i++) { m.update(1 / 60, { forward: 1, strafe: 0, jump: false }, 0); if (m.onWall) started = i; }
  assert.ok(started > 0, 'the free climb from the water');
  const n = new PlayerMotor(wall(1.5), { speed: 50, running: 30 }, { parkour: { enabled: () => true, inputs: () => ({ climbing: 100 }) } });
  n.spawn(0, 0.02, 0.4);
  n.swimming = true;
  for (let i = 0; i < 30; i++) n.update(1 / 60, { forward: 0, strafe: 0, jump: i >= 5 }, 0);
  assert.equal(n.mantling || n.onWall, false, 'Jump in the water swims (CLIMB1\'s "never from water")');
});

test('CLIMB2 LIVE: Forward and Jump held in the air at a sheer wall - the hands take the wall itself', () => {
  const r = drive(wall(8), { skill: 50, z: 0.5, steps: 90, input: (i) => ({ forward: 1, jump: i >= 10 && i < 60 }) });
  const g = r.log.find((e) => e.st === 'climb');
  assert.ok(g && g.i <= 12, 'taken on the jump');
  assert.equal(g.edge, 'catch', 'billed as a catch');
  assert.ok(r.m.pos[1] > 1, 'and climbed');
  // Jump alone: nothing
  const n = drive(wall(8), { skill: 50, z: 0.5, steps: 90, input: held(10, 60) });
  assert.ok(!n.log.some((e) => e.st === 'climb'));
});

test('CLIMB2 LIVE: the switch turned on under a classic climb ends it; turned off under a hold, the hands let go', () => {
  let on = false;
  const col = wall(8);
  const m = new PlayerMotor(col, { speed: 50, running: 30 }, {
    climbing: { inputs: () => ({ climbing: 100, luck: 100 }), tally: () => {}, rolls: () => 0, say: () => {} },
    parkour: { enabled: () => on, inputs: () => ({ climbing: 50 }) },
  });
  m.spawn(0, 0.02, 0.6);
  for (let i = 0; i < 90; i++) m.update(1 / 60, { forward: 1, strafe: 0, jump: false }, 0);
  assert.equal(m.climb.isClimbing, true, 'the classic climb');
  on = true;
  m.update(1 / 60, { forward: 1, strafe: 0, jump: false }, 0);
  assert.equal(m.climb.isClimbing, false, 'ended the step the lane changed');
  for (let i = 0; i < 60; i++) m.update(1 / 60, { forward: 1, strafe: 0, jump: false }, 0);
  assert.equal(m.onWall, true, 'the free climb took it');
  on = false;
  m.update(1 / 60, { forward: 0, strafe: 0, jump: false }, 0);
  assert.equal(m.onWall, false);
  assert.equal(m.climb.isClimbing, false);
});

test('CLIMB2 LIVE: Roleplay & Realism - a drawn weapon refuses the catch and the free climb with the mod\'s line, and lets go on the wall', () => {
  try {
    registerParkourGate(() => 'no weapon');
    const c = drive(wall(2.3), { skill: 100, steps: 60, input: held() });
    assert.ok(!c.log.some((e) => e.st === 'move:catch' || e.st === 'hang'), 'no catch');
    assert.deepEqual(c.said, ['no weapon'], 'said once');
    const f = drive(wall(6), { skill: 100, z: 0.6, steps: 120, input: () => ({ forward: 1 }) });
    assert.ok(!f.log.some((e) => e.st === 'climb'));
    assert.deepEqual(f.said, ['no weapon'], 'said once for the hold, not every step');
    registerParkourGate(null);
    let drawn = false;
    registerParkourGate(() => (drawn ? 'no weapon' : null));
    const h = drive(wall(2.3), { skill: 100, steps: 120, input: (i) => { if (i === 70) drawn = true; return held()(i); } });
    assert.ok(h.log[60].st === 'hang' && h.log[80].st !== 'hang', 'drawn on the wall: the hands let go');
  } finally { registerParkourGate(null); }
});

test('CLIMB2 LIVE: a heavy pack cuts the reach - a lip the jump catches unloaded is out of reach under a full pack', () => {
  const light = drive(wall(2.3), { skill: 50, steps: 60, input: held() });
  const heavy = drive(wall(2.3), { skill: 50, load: 1, steps: 60, input: held() });
  assert.ok(light.log.some((e) => e.st === 'move:catch'), 'caught unloaded');
  assert.ok(!heavy.log.some((e) => e.st === 'move:catch'), 'not under a full pack');
});

test('CLIMB2 LIVE: a hold is ended by a placement, shifted by the world\'s recentre, and rides what it holds - the recentre no second carry', () => {
  for (const place of ['spawn', 'pinFeet', 'freeze']) {
    const r = drive(wall(2.3), { skill: 100, steps: 60, input: held() });
    assert.equal(r.m.hanging, true);
    // placed a metre along the same wall, where the hands could take the same lip: a placement is never a hold
    if (place === 'freeze') r.m.freezeMotor = 0.5; else r.m[place](r.m.pos[0] + 1, r.m.pos[1], r.m.pos[2]);
    r.m.update(1 / 60, { forward: 0, strafe: 0, jump: false }, 0);
    assert.equal(r.m.onWall, false, `${place} ends the hold`);
    assert.equal(r.m.climb.isClimbing, false);
  }
  const r = drive(wall(2.3), { skill: 100, steps: 60, input: held() });
  const lip = r.m._wall.lipY;
  r.m.offsetOrigin([0, 10, 0]);
  assert.ok(near(r.m._wall.lipY, lip + 10));
  // a hold on a mover rides it; a recentre (the mover's pose moving with the world) is no motion of its own
  const t = [0, 0, 0];
  const col = new Collider(() => -100);
  col.addMesh('floor', new Float32Array([-20, 0, -20, 20, 0, -20, 20, 0, 20, -20, 0, 20]), [0, 1, 2, 0, 2, 3], I);
  col.addMesh('hull', boxAt(-3, 0, 1, 3, 2.3, 4), BOX_IDX, I, () => t, null);
  const m = new PlayerMotor(col, { speed: 50, running: 30 }, { parkour: { enabled: () => true, inputs: () => ({ climbing: 100 }) } });
  m.spawn(0, 0.02, 0.4);
  for (let i = 0; i < 60; i++) m.update(1 / 60, { forward: 0, strafe: 0, jump: i >= 10 && i < 40 }, 0);
  assert.equal(m.hanging, true);
  const x0 = m.pos[0];
  for (let i = 0; i < 30; i++) { t[0] += 0.02; m.update(1 / 60, { forward: 0, strafe: 0, jump: false }, 0); }
  assert.ok(near(m.pos[0] - x0, 0.6, 0.01) && m.hanging, `carried along with the hull (${(m.pos[0] - x0).toFixed(3)} m)`);
  const x1 = m.pos[0];
  t[0] += 50; m.offsetOrigin([50, 0, 0]);   // the world recentres: the hull and the body move by it together
  m.update(1 / 60, { forward: 0, strafe: 0, jump: false }, 0);
  assert.ok(near(m.pos[0] - x1, 50, 0.01), `shifted once, not twice (${(m.pos[0] - x1).toFixed(3)})`);
});

test('CLIMB2 LIVE: a crouched jump holds nothing, and the hang forces the body to stand', () => {
  const r = drive(wall(2.3), { skill: 100, steps: 60, input: (i) => ({ crouch: i === 2, ...held()(i) }) });
  assert.ok(!r.log.some((e) => e.st === 'move:catch'), 'crouched in the air, no hang');
});

test('CLIMB2: the tally on the wall keeps the classic climb\'s continue cadence', () => {
  const r = drive(wall(2.3), { skill: 100, steps: 60 + 5 * 60, input: held() });
  const onWall = r.log.filter((e) => e.st === 'hang').length / 60;
  const cadence = SYSTEM_TIMER_UPDATES_DIVISOR * CONTINUE_CLIMBING_SKILL_CHECK_FREQUENCY;
  assert.ok(Math.abs(r.tallies.length - Math.floor(onWall / (cadence + 1 / 60))) <= 1, `${r.tallies.length} tallies in ${onWall.toFixed(2)} s`);
});

test('CLIMB2 hosts: the deps carry the Fatigue, the pack and the tally; every HUD is handed the grip; the interior ticker reports the climb', () => {
  const e = { race: 'Breton', stats: { strength: 50, endurance: 50, luck: 50 }, skills: {}, items: [], fatigue: 1600 };
  const d = parkourDeps(e);
  const i = d.inputs();
  assert.ok(near(i.fatigue, 1600 / ((50 + 50) * 64)), 'the Fatigue over its most');
  assert.equal(i.load, 0);
  assert.equal(typeof d.tally, 'function');
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js']) {
    assert.match(read(f), /\n\s*grip: player\.gripShown,/, `${f} hands its HUD the grip`);
  }
  assert.match(read('src/scenes/dungeonContext.js'), /grip: _activity\.grip \?\? null,/, 'the dungeon context\'s HUD, from the host\'s report');
  for (const f of ['src/scenes/dungeon.js', 'src/scenes/worldModes.js']) {
    assert.match(read(f), /reportActivity\?\.\(\{[^\n]*grip: player\.gripShown, fell: /, `${f} reports the grip`);
  }
  const wm = read('src/scenes/worldModes.js');
  const bag = wm.slice(wm.indexOf('interiorTicker.tick(dt, {'), wm.indexOf('});', wm.indexOf('interiorTicker.tick(dt, {')));
  assert.match(bag, /climbing: !!player\.climb\?\.isClimbing,/, 'the interior ticker reports the climb (PlayerEntity.cs:405-408 asks it indoors too)');
  const hud = read('src/ui/hud/hud.js');
  assert.match(hud, /drawBreathBar\(renderer, canvas, art, vitals, s\);\n\s*drawGripBar\(renderer, canvas, art, grip(?: \?\? steed)?, s\);/, 'the classic HUD draws the grip beside the breath');   // PIN MOVED (STEED1): the horse's breath in its place, a rider holding no wall
  assert.match(hud, /drawGripBar\(renderer, canvas, art, grip(?: \?\? steed)?, s2\);/, '...and under the large HUD');   // PIN MOVED (STEED1)
  assert.match(hud, /\n\s*grip,   \/\/ CLIMB2\n/, 'the enhanced HUD is handed it');
  assert.match(read('src/ui/enhanced/enhancedHud.js'), /el\('span', 'hud-breathlabel', 'Grip'\)/);
});

test('CLIMB2 x CLIMB-PAST (main #498): a mastered Climbing\'s points past 100 climb faster on the enhanced lane too - the free climb, the shimmy and its corners, by the classic climb\'s own multiplier', () => {
  // online the enhanced climb is always on and the classic climb never runs, so a pace that read the 0..100 skill alone
  // took FIELD BUGS 2026-10-01 #7's fix ("Running jumping climbing dint work passed 100") away from every online climber
  const x = overcapClimbSpeed(200);
  assert.ok(x > 1.3, `Climbing 200 climbs x${x} on the classic lane`);
  // the laws: the LIVE value's multiplier on the pace alone - the skill's share stays the 0..100 law's
  assert.ok(near(freeClimbSpeed(6, 100, false, 200), climbingSpeed(6, false, 200) * PARKOUR_CLIMB_MAX), 'the classic climb\'s own pace, at the share');
  assert.ok(near(freeClimbSpeed(6, 100, false, 200), x * freeClimbSpeed(6, 100)));
  assert.equal(freeClimbSpeed(6, 100, false, 100), freeClimbSpeed(6, 100), 'to 100 nothing moves');
  assert.ok(near(shimmySpeed(100, 200), x * PARKOUR_SHIMMY_MAX));
  assert.equal(shimmySpeed(100, 100), PARKOUR_SHIMMY_MAX);
  const grip = { feet: [1, 0, 0], normal: [1, 0, 0], lipY: 2 };
  assert.ok(near(planCorner([0, 0, 0], [0.5, 0, 0.3], grip, 100, 200).dur * x, planCorner([0, 0, 0], [0.5, 0, 0.3], grip, 100).dur), 'a corner at the shimmy\'s pace');
  // live, through the deps' own `climbing` read: up the face, along the lip, and round a corner
  const up = (skill) => {
    const r = drive(wall(6.0), { skill, z: 0.6, steps: 120, input: () => ({ forward: 1 }) });
    const s = firstAt(r.log, 'climb').i;
    return (r.log[s + 50].pos[1] - r.log[s + 20].pos[1]) / (30 / 60);
  };
  assert.ok(near(up(200) / up(100), x, 0.02), `the free climb: ${up(100).toFixed(2)} -> ${up(200).toFixed(2)} m/s`);
  const along = (skill) => {
    const r = drive(wall(2.3), { skill, steps: 150, input: (i) => ({ ...held()(i), strafe: i >= 60 && i < 90 ? 1 : 0 }) });
    assert.equal(r.log[59].st, 'hang', `hanging at Climbing ${skill}`);
    return (r.log[89].pos[0] - r.log[59].pos[0]) / (30 / 60);
  };
  assert.ok(near(along(200), x * PARKOUR_SHIMMY_MAX, 0.04), `the shimmy: ${along(200).toFixed(2)} m/s`);
  const corner = (skill) => {
    let dur = null;
    drive(wall(2.3, 3), { skill, x: 1.5, steps: 400, input: (i, m) => { if (dur == null && m._pkMove?.kind === 'corner') dur = m._pkMove.dur; return { ...held()(i), strafe: i >= 60 ? 1 : 0 }; } });
    assert.ok(dur != null, `a corner at Climbing ${skill}`);
    return dur;
  };
  assert.ok(near(corner(100) / corner(200), x, 0.01), `round the corner in ${corner(200).toFixed(3)} s, not ${corner(100).toFixed(3)}`);
});
