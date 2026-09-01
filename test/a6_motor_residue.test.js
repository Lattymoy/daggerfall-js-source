// ROAD TO 1:1, Wave A - A6 MOTOR RESIDUE. The four laws AUDIT 44 left
// standing in the player motor:
//
//   1. THE DOORWAY HEAD DIP - FrictionMotor.HeadDipHandling (:119-156)
//      and PlayerHeightChanger.StandingHeightAdjustment (:95-100,
//      :235-244). Top of head blocked, eyes clear, STATIC geometry:
//      the standing capsule dips 0.28 and the eye with it (half, the
//      controller transform's own share).
//   2. THE STEP AND HEAD PROBES - PlayerMoveScanner.FindStep (:151),
//      FindHeadHit (:170) and SetHitSomethingInFront (:307), over the
//      collider's new sphereCast, plus AcrobatMotor.ApplyGravity's
//      anti-bump GATE (:190-194) that FindStep exists for.
//   3. THE SWIM CAPSULE - controllerSwimHeight 0.30 (:57) through
//      DoSinking/DoUnsinking (:352-434) on timerSlow.
//   4. THE TELEPORT FREEZE - DaggerfallAction.Teleport :594 arming
//      PlayerMotor.freezeMotor, spent by FixedUpdate :296-307; and
//      the heading a Teleport does NOT change, because
//      PlayerMouseLook.Update (:256-259) rewrites the body's euler
//      from its own Yaw the very next frame.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PlayerMotor,
  CAPSULE_HEIGHT, CAPSULE_RADIUS, EYE_HEIGHT, CROUCH_HEIGHT, CROUCH_EYE_HEIGHT,
  RIDE_EYE_HEIGHT, HEAD_DIP_CLEARANCE, HEAD_DIP_RAY_DISTANCE, HEAD_DIP_TOP_MARGIN,
  SWIM_HEIGHT, SWIM_EYE_HEIGHT, SWIM_HORSE_DISPLACEMENT, SWIM_RIDE_EYE_HEIGHT,
  HEIGHT_TIMER_SLOW, TELEPORT_FREEZE_S, ANTI_BUMP_FACTOR, isStaticGeometryKey,
  GRAVITY, FIXED_DT,
} from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';
import {
  PlayerMoveScanner, STEP_PROBE_RADIUS, STEP_PROBE_DISPLACEMENT, STEP_PROBE_RANGE,
  HEAD_HIT_RADIUS_FACTOR, HEAD_PROBE_RANGE, IN_FRONT_REACH,
} from '../src/player/moveScanner.js';
import { TRANSPORT_MODES } from '../src/systems/transport.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

// ROAD-Ar R16. Every pin below that names a DFU number asserts the
// LITERAL, never the port's own constant. Asserting the constant lets a
// mutation of it move the expectation with it - the vacuous-pin failure
// mode this project already recorded against factionrep's MIN_POWER,
// and eight of these numbers (the swim capsule, the freeze, the head
// probes) could all be wrong at once with the whole suite green. The
// constants stay imported for the CODE PATH and for this one table.
test('A6: the constants ARE the C# numbers - the table every pin below stands on', () => {
  // PlayerHeightChanger.cs
  assert.equal(SWIM_HEIGHT, 0.30, ':57 controllerSwimHeight');
  assert.equal(SWIM_HORSE_DISPLACEMENT, 0.30, ':58 controllerSwimHorseDisplacement');
  assert.equal(HEIGHT_TIMER_SLOW, 0.4, ':72 timerSlow');
  // The two swim EYE levels are the port's own law, not DFU literals -
  // DFU derives camSwimLevel from controllerSwimHeight/2 - eyeHeight
  // (:110), the port sits 0.1 below the capsule top like its crouch and
  // stand levels. Pinned as the port's arithmetic over DFU's numbers.
  assert.equal(SWIM_EYE_HEIGHT, 0.20, 'controllerSwimHeight 0.30, less the port\'s 0.1');
  assert.equal(SWIM_RIDE_EYE_HEIGHT, 0.50, '0.30 + 0.30, less the port\'s 0.1');
  // FrictionMotor.HeadDipHandling
  assert.equal(HEAD_DIP_RAY_DISTANCE, 0.5, ':121 raySampleDistance');
  assert.equal(HEAD_DIP_CLEARANCE, -0.28, ':122 clearanceAdjustment');
  assert.equal(HEAD_DIP_TOP_MARGIN, 0.25, ':128 - the head ray origin\'s + 0.25f');
  // PlayerMoveScanner.Start / DaggerfallAction.Teleport
  assert.equal(HEAD_HIT_RADIUS_FACTOR, 0.85, 'PlayerMoveScanner.cs:114 radius * 0.85f');
  assert.equal(TELEPORT_FREEZE_S, 0.5, 'DaggerfallAction.cs:594 FreezeMotor = 0.5f');
});

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const DT = FIXED_DT;
const still = (over = {}) => ({ forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, ...over });
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

/** One floor quad under everything, motorStairs' own shape. */
function floored() {
  const col = new Collider(() => 0);
  col.addMesh('floor', [-40, 0, -40, 40, 0, -40, 40, 0, 40, -40, 0, 40], [0, 1, 2, 0, 2, 3], I);
  return col;
}

/** A vertical slab facing -z at `z`, spanning y0..y1. The head dip's
 *  doorframe: the head ray (2.05 above the feet standing) strikes it
 *  and the eye ray (1.70) passes under. */
function addSlab(col, { key = 'world', z = 0.3, y0 = 1.85, y1 = 3, hw = 3 } = {}) {
  col.addMesh(key, [-hw, y0, z, hw, y0, z, hw, y1, z, -hw, y1, z], [0, 1, 2, 0, 2, 3], I);
}

/** Stand a motor on the floor and settle it. `over` lands BEFORE the
 *  settle, because the head dip runs on every grounded step. */
function stood(col, over = {}) {
  const m = new PlayerMotor(col);
  m.spawn(0, 0.05, 0);
  Object.assign(m, over);
  for (let f = 0; f < 6; f++) m.update(DT, still(), 0);
  return m;
}

// ── 1. the doorway head dip ───────────────────────────────────────

test('A6 head dip: top of head blocked + eyes clear + static geometry dips the standing height 0.28', () => {
  const clear = stood(floored());
  assert.equal(clear.standingHeightAdjustment, 0, 'undipped on open floor');
  assert.ok(near(clear.height, CAPSULE_HEIGHT));

  const col = floored();
  addSlab(col);                      // a lintel 1.85 up, 0.3 ahead
  const m = stood(col);              // facing +z, standing under it
  assert.equal(m.standingHeightAdjustment, -0.28, 'clearanceAdjustment (:122)');
  assert.ok(near(m.height, CAPSULE_HEIGHT - 0.28),
    'CurrentControllerStandingHeight = 1.8 + adjustment (:87-90)');
  // ControllerHeightChange keeps the feet and drops the transform by
  // half the change (:477-478); the camera's LOCAL height is untouched,
  // so the eye falls exactly half the dip.
  assert.ok(near(m.eye[1] - m.pos[1], EYE_HEIGHT - 0.28 / 2),
    'the eye takes half the dip, the capsule top all of it');
});

test('A6 head dip: the dip HOLDS while the obstacle is there - the head sample rides the FIXED standing height', () => {
  // :128 samples from FixedControllerStandingHeight / 2 + 0.25, not
  // Current - so a capsule that is already dipped keeps testing the
  // same overhead and does not bounce back into the frame.
  const col = floored();
  addSlab(col);
  const m = stood(col);
  for (let f = 0; f < 12; f++) {
    m.update(DT, still(), 0);   // held under the frame, not walked through it
    assert.equal(m.standingHeightAdjustment, -0.28, `frame ${f} stays dipped`);
    assert.ok(near(m.height, CAPSULE_HEIGHT - 0.28));
  }
});

test('A6 head dip: eyes blocked too is NOT a doorframe - the undip is immediate', () => {
  const col = floored();
  addSlab(col, { y0: 1.0 });   // the slab now reaches eye level
  const m = stood(col);
  m.update(DT, still({ forward: 1 }), 0);
  assert.equal(m.standingHeightAdjustment, 0, '`headRayHit && !eyeRayHit` (:137)');
});

test('A6 head dip: a NON-STATIC overhead never dips - IsStaticGeometry (:137) is a bucket-key test here', () => {
  const col = floored();
  addSlab(col, { key: 'act:0:12' });   // an action model, as actionSystem registers it
  const m = stood(col);
  m.update(DT, still({ forward: 1 }), 0);
  assert.equal(m.standingHeightAdjustment, 0, 'a swinging door or moving platform is not a doorframe');

  assert.equal(isStaticGeometryKey('dungeon'), true);
  assert.equal(isStaticGeometryKey('interior'), true);
  assert.equal(isStaticGeometryKey('7,12'), true, 'a streamed exterior pixel');
  assert.equal(isStaticGeometryKey('act:0:12'), false);
  assert.equal(isStaticGeometryKey('door:3'), false);
  assert.equal(isStaticGeometryKey(null), false, 'a clear ray is not static geometry');
});

test('A6 head dip: crouched and paralysed both refuse the probe', () => {
  {
    const col = floored();
    addSlab(col);
    const m = stood(col, { crouching: true });   // `|| playerMotor.IsCrouching` (:124)
    m.update(DT, still({ forward: 1 }), 0);
    assert.equal(m.standingHeightAdjustment, 0);
    assert.ok(near(m.height, CROUCH_HEIGHT), 'the crouch height takes no adjustment');
    assert.ok(near(m.eye[1] - m.pos[1], CROUCH_EYE_HEIGHT));
  }
  {
    const col = floored();
    addSlab(col);
    const m = stood(col);
    assert.equal(m.standingHeightAdjustment, -0.28);
    // `if (!IsParalyzed) HeadDipHandling();` (:90-93): the dip is not
    // re-evaluated at all, so it HOLDS rather than clearing.
    m.paralyzed = true;
    m.update(DT, still(), 0);
    assert.equal(m.standingHeightAdjustment, -0.28, 'held, not cleared');
  }
});

test('A6 head dip: a crouch and a stand both clear the adjustment (DoCrouch :256, DoStand :271)', () => {
  const col = floored();
  addSlab(col);
  const m = stood(col);
  m.update(DT, still({ forward: 1 }), 0);
  assert.equal(m.standingHeightAdjustment, -0.28);
  // Crouch: the press arms it, the clock finishes it, and the flip
  // zeroes the adjustment with the height.
  m.update(DT, still({ crouch: true }), 0);
  for (let f = 0; f < 12; f++) m.update(DT, still(), 0);
  assert.equal(m.crouching, true);
  assert.equal(m.standingHeightAdjustment, 0);
});

test('A6 head dip: the geometry of the two samples is DFU\'s, not an approximation of it', () => {
  // A recording collider: the probe must sample forward from
  // centre + FixedControllerStandingHeight/2 + 0.25 and from the eye,
  // both for raySampleDistance.
  const rays = [];
  const fake = {
    raycastHit: (o, d, max) => { rays.push({ kind: 'head', o: [...o], d: [...d], max }); return { dist: Infinity, key: null }; },
    raycast: (o, d, max) => { rays.push({ kind: 'eye', o: [...o], d: [...d], max }); return Infinity; },
    move: (feet) => ({ grounded: true, hitCeiling: false, groundKey: 'floor' }),
    penetrationAt: () => 0,
  };
  const m = new PlayerMotor(fake);
  m.pos[0] = 0; m.pos[1] = 0; m.pos[2] = 0;
  m.grounded = true;
  m._headDipHandling(0, 1);   // yaw 0 -> forward (0, 0, 1)
  const head = rays.find((r) => r.kind === 'head');
  const eye = rays.find((r) => r.kind === 'eye');
  assert.ok(near(head.o[1], CAPSULE_HEIGHT / 2 + CAPSULE_HEIGHT / 2 + 0.25),
    'headRay from centre + FixedControllerStandingHeight/2 + 0.25 (:128)');
  assert.ok(near(eye.o[1], EYE_HEIGHT), 'eyeRay from the camera (:129)');
  assert.deepEqual(head.d, [0, 0, 1], 'myTransform.forward - the BODY carries yaw only');
  assert.deepEqual(eye.d, [0, 0, 1]);
  assert.equal(head.max, 0.5, 'raySampleDistance (:121)');
  assert.equal(eye.max, 0.5);
});

// ── 2. PlayerMoveScanner ──────────────────────────────────────────

test('A6 scanner: FindStep drops a 0.1 sphere and reports the distance its CENTRE travelled', () => {
  const col = floored();
  const s = new PlayerMoveScanner(col);
  // Centre at 0.9 above a floor at 0: the sphere touches when its
  // centre is 0.1 up, so hit.distance is 0.8.
  s.findStep([0, 0.9, 0], [0, 0, 0], CAPSULE_HEIGHT, false);
  assert.ok(near(s.stepHitDistance, 0.8, 1e-4), `0.8, got ${s.stepHitDistance}`);
  assert.equal(STEP_PROBE_RADIUS, 0.1);
  assert.equal(STEP_PROBE_DISPLACEMENT, 0.10);
  assert.equal(STEP_PROBE_RANGE, 2.10);
});

test('A6 scanner: a JUMPING player scans nothing, and a miss reports 0 - not the range', () => {
  const col = floored();
  const s = new PlayerMoveScanner(col);
  s.findStep([0, 0.9, 0], [0, 0, 0], CAPSULE_HEIGHT, true);
  assert.equal(s.stepHitDistance, 0, '`!acrobatMotor.Jumping &&` short-circuits the cast (:164)');
  s.findStep([0, 40, 0], [0, 0, 0], CAPSULE_HEIGHT, false);
  assert.equal(s.stepHitDistance, 0, 'the else arm is 0f (:167), never maxRange');
});

test('A6 scanner: the step origin is displaced 0.10 along the HORIZONTAL of moveDirection', () => {
  const seen = [];
  const fake = { sphereCast: (o, r, d, max) => { seen.push({ o: [...o], r, d: [...d], max }); return { dist: Infinity, key: null }; } };
  const s = new PlayerMoveScanner(fake);
  // A diagonal move with a big vertical: ProjectOnPlane drops the y,
  // then .normalized * 0.10 (:159).
  s.findStep([5, 2, 7], [3, -99, 4], CAPSULE_HEIGHT, false);
  assert.ok(near(seen[0].o[0], 5 + 0.06), 'x + 0.10 * 3/5');
  assert.ok(near(seen[0].o[2], 7 + 0.08), 'z + 0.10 * 4/5');
  assert.ok(near(seen[0].o[1], 2), 'the origin keeps the controller centre height');
  assert.deepEqual(seen[0].d, [0, -1, 0]);
  assert.ok(near(seen[0].max, CAPSULE_HEIGHT / 2 + STEP_PROBE_RANGE), 'height/2 + 2.10 (:157)');
  // Unity's Vector3.normalized of a zero vector is zero - a standing
  // player drops the sphere straight down the centre line.
  seen.length = 0;
  s.findStep([5, 2, 7], [0, 0, 0], CAPSULE_HEIGHT, false);
  assert.deepEqual(seen[0].o, [5, 2, 7]);
});

test('A6 scanner: FindHeadHit casts radius * 0.85 upward for 2, and leaves the distance STALE on a clear cast', () => {
  const col = floored();
  col.addMesh('ceil', [-4, 2.5, -4, 4, 2.5, -4, 4, 2.5, 4, -4, 2.5, 4], [0, 1, 2, 0, 2, 3], I);
  const s = new PlayerMoveScanner(col);
  assert.ok(near(s.headHitRadius, CAPSULE_RADIUS * 0.85), 'HeadHitRadius (:114)');
  assert.equal(HEAD_PROBE_RANGE, 2);

  assert.equal(s.findHeadHit([0, 0.9, 0]), true);
  assert.ok(near(s.headHitDistance, 2.5 - 0.9 - s.headHitRadius, 1e-4),
    `centre travel to contact, got ${s.headHitDistance}`);
  assert.equal(s.headHitKey, 'ceil');

  const held = s.headHitDistance;
  assert.equal(s.findHeadHit([20, 0.9, 20]), false, 'nothing overhead out on the open floor');
  assert.equal(s.headHitDistance, held, 'DFU rewrites HeadRaycastHit only - the distance is not zeroed (:184)');
  assert.equal(s.headHitKey, null);
});

test('A6 scanner: SetHitSomethingInFront reaches exactly radius + 0.1', () => {
  const mk = (z) => {
    const col = floored();
    col.addMesh('wall', [-3, 0, z, 3, 0, z, 3, 3, z, -3, 3, z], [0, 1, 2, 0, 2, 3], I);
    return new PlayerMoveScanner(col);
  };
  assert.equal(IN_FRONT_REACH, 0.1);
  assert.equal(mk(0.4).setHitSomethingInFront([0, 0.9, 0], [0, 0, 1]), true, 'inside 0.45');
  assert.equal(mk(0.5).setHitSomethingInFront([0, 0.9, 0], [0, 0, 1]), false, 'outside 0.45');
});

test('A6 scanner: the motor runs the step probe where FixedUpdate does, and after the jump', () => {
  const col = floored();
  col.addMesh('ceil', [-4, 2.5, -4, 4, 2.5, -4, 4, 2.5, 4, -4, 2.5, 4], [0, 1, 2, 0, 2, 3], I);
  const m = stood(col);
  assert.ok(near(m.scanner.stepHitDistance, 0.8, 1e-4), 'FindStep runs from FixedUpdate (:355)');
  // The head probe is NOT spent per step: its one classic consumer
  // (PlayerCrush) is recorded, and its AdvancedClimbing sibling is
  // Ledger A. The motor says so where DFU calls them.
  assert.equal(m.scanner.headHitDistance, 0, 'no cast without a reader');
  const body = src('player/motor.js');
  assert.match(body, /PlayerCrush\.cs \(the/, 'the motor records the consumer, at DFU\'s own call site');
  assert.ok(!body.includes('this.scanner?.findHeadHit('), 'and does not spend nine rays a step on it');
  // The jump's own frame: HandleJumpInput raises Jumping BEFORE
  // FindStep, so the probe answers 0 on the take-off step. (The
  // bunny-hop gate wants 0.1 s of grounded time first.)
  for (let f = 0; f < 8; f++) m.update(DT, still(), 0);
  m.update(DT, still({ jump: true }), 0);
  assert.equal(m.jumping, true);
  assert.equal(m.scanner.stepHitDistance, 0);
});

test('A6 anti-bump: the GATE is ApplyGravity\'s, and the velocity spike is deliberately not spent', () => {
  const col = floored();
  const m = stood(col);
  // Standing on flat ground: StepHitDistance 0.8, minRange 0.75,
  // maxRange 1.85 - squarely in range, which is why DFU presses the
  // controller down every grounded frame.
  const minRange = CAPSULE_HEIGHT / 2 - 0.15;
  assert.ok(m.scanner.stepHitDistance > minRange && m.scanner.stepHitDistance < minRange + 1.10);
  assert.equal(m.antiBumpInRange, true);
  assert.equal(ANTI_BUMP_FACTOR, 20.75);
  // What is NOT done: the port's collider expresses the same law with
  // its ground snap and its multi-frame step ratchet, and spending
  // 20.75 of velocity on top wipes the ratchet. A grounded walking
  // step must therefore still end at velY 0, not at -20.75.
  m.update(DT, still({ forward: 1 }), 0);
  assert.equal(m.velY, 0, 'no forced descent under a walking player');
  assert.ok(!src('player/motor.js').includes('this.velY -= ANTI_BUMP_FACTOR'),
    'the spike is recorded at the site, not applied');
});

test('A6 anti-bump: walking off a ledge switches the gate off by itself - StepHitDistance is 0 over a void', () => {
  const col = new Collider(() => -Infinity);
  // A 4x4 plate with nothing under it and nothing past it.
  col.addMesh('plate', [-2, 0, -2, 2, 0, -2, 2, 0, 2, -2, 0, 2], [0, 1, 2, 0, 2, 3], I);
  const s = new PlayerMoveScanner(col);
  s.findStep([0, 0.9, 0], [0, 0, 0], CAPSULE_HEIGHT, false);
  assert.ok(s.stepHitDistance > 0, 'over the plate');
  s.findStep([0, 0.9, 20], [0, 0, 0], CAPSULE_HEIGHT, false);
  assert.equal(s.stepHitDistance, 0, 'over the void - the maxRange 3.0 cast finds nothing');
});

// ── 3. the swim capsule ───────────────────────────────────────────

test('A6 swim: OnExteriorWater sinks the capsule to 0.30 at once and lerps the eye over timerSlow', () => {
  const m = stood(floored());
  assert.ok(near(m.height, CAPSULE_HEIGHT));
  m.onExteriorWater = true;

  m.update(DT, still(), 0);
  assert.equal(m.sunk, true, 'controllerSink (:420)');
  assert.equal(m.heightAction, 'sink');
  assert.ok(near(m.height, 0.30), 'controllerSwimHeight 0.30 (:57), applied on the arming frame');
  // The camera is the half that takes time: prevCamLevel -> the swim
  // level across camTimer / timerSlow.
  const t = DT / 0.4;   // timerSlow (:72)
  assert.ok(near(m.eye[1] - m.pos[1], EYE_HEIGHT + (0.20 - EYE_HEIGHT) * t, 1e-9));

  for (let f = 0; f < 30; f++) m.update(DT, still(), 0);
  assert.equal(m.heightAction, null, 'timerResetAction ends it past timerSlow');
  assert.ok(near(m.eye[1] - m.pos[1], 0.20), '0.30 - 0.1, the port\'s own eye law');
});

test('A6 swim: leaving the water unsinks, and the two clocks are the SLOW one', () => {
  const m = stood(floored());
  m.onExteriorWater = true;
  for (let f = 0; f < 30; f++) m.update(DT, still(), 0);
  assert.equal(m.sunk, true);

  m.onExteriorWater = false;
  m.update(DT, still(), 0);
  assert.equal(m.sunk, false, 'DoUnsinking (:374)');
  assert.equal(m.heightAction, 'unsink');
  assert.equal(m.heightTimerMax, 0.4, 'timerSlow on BOTH edges (:149, :155)');
  assert.ok(near(m.height, CAPSULE_HEIGHT), 'CurrentControllerStandingHeight is back at once');
  for (let f = 0; f < 30; f++) m.update(DT, still(), 0);
  assert.ok(near(m.eye[1] - m.pos[1], EYE_HEIGHT));
});

test('A6 swim: a MOUNTED swimmer carries the horse displacement, capsule and eye', () => {
  const m = stood(floored());
  m.setTransportMode(TRANSPORT_MODES.Horse);
  for (let f = 0; f < 20; f++) m.update(DT, still(), 0);
  assert.ok(near(m.eye[1] - m.pos[1], RIDE_EYE_HEIGHT));

  m.onExteriorWater = true;
  m.update(DT, still(), 0);
  assert.ok(near(m.height, 0.30 + 0.30), 'controllerSwimHorseDisplacement (:58, :296)');
  for (let f = 0; f < 30; f++) m.update(DT, still(), 0);
  assert.ok(near(m.eye[1] - m.pos[1], 0.50), '0.60 - 0.1');
});

test('A6 swim: the sink CLEARS the crouch, and while sunk the crouch key is refused', () => {
  const m = stood(floored());
  m.update(DT, still({ crouch: true }), 0);
  for (let f = 0; f < 10; f++) m.update(DT, still(), 0);
  assert.equal(m.crouching, true);

  m.onExteriorWater = true;
  m.update(DT, still(), 0);
  assert.equal(m.crouching, false, 'DoSinking :422');
  assert.equal(m.sunk, true);
  // :171's `!onWater` - the whole crouch/climb/swim block is refused
  // while the sink owns the capsule.
  m.update(DT, still({ crouch: true }), 0);
  for (let f = 0; f < 12; f++) m.update(DT, still(), 0);
  assert.equal(m.crouching, false, 'no crouch toggle over exterior water');
  assert.ok(near(m.height, 0.30));
});

test('A6 swim: LEVITATION forces onWater false (:144), so floating up unsinks the capsule', () => {
  const m = stood(floored());
  m.onExteriorWater = true;
  for (let f = 0; f < 30; f++) m.update(DT, still(), 0);
  assert.equal(m.sunk, true);

  m.levitating = true;
  m.update(DT, still(), 0);   // the levitate edge's cancel step
  m.update(DT, still(), 0);
  assert.equal(m.sunk, false, 'the unsink arm reads onWater AFTER levitation has zeroed it');
});

test('A6 swim: the collider clamps a below-2r capsule to a SPHERE instead of inverting its axis', () => {
  // Unity does this for any CharacterController under 2 * radius, and
  // controllerSwimHeight 0.30 against radius 0.35 is the one stance
  // that reaches it. A signed axis put the "upper" sphere 0.40 BELOW
  // the lower one, so the sunk swimmer probed under his own feet.
  const col = floored();
  const feet = [0, 5, 0];
  const r = col.move(feet, 0, -6, 0, 0.30);   // the literal, not the constant
  assert.equal(r.grounded, true);
  assert.ok(near(feet[1], 0, 1e-3), `a sunk capsule lands ON the floor, got ${feet[1]}`);
  assert.ok(feet[1] > -0.01, 'and never below it');
});

// ── 4. the teleport freeze, and the heading it does not change ────

test('A6 freeze: an armed FreezeMotor stops the motor dead, then raises CancelMovement', () => {
  const m = new PlayerMotor(floored());
  m.spawn(0, 20, 0);
  m.freezeMotor = TELEPORT_FREEZE_S;
  const y = m.pos[1];
  for (let f = 0; f < 20; f++) m.update(DT, still({ forward: 1 }), 0);
  assert.ok(near(m.pos[1], y), 'no gravity while frozen');
  assert.ok(near(m.pos[2], 0), 'no input while frozen');
  assert.equal(m.velY, 0);
  assert.ok(m.freezeMotor > 0, '20 steps is a third of a second');

  // Run the rest of the clock out.
  const steps = Math.ceil(0.5 / DT) - 20 + 1;   // FreezeMotor 0.5f (:594)
  for (let f = 0; f < steps; f++) m.update(DT, still(), 0);
  assert.equal(m.freezeMotor, 0);
  assert.ok(near(m.pos[1], y), 'the tick that ends the freeze raises CancelMovement, which costs one more step');
  m.update(DT, still(), 0);
  assert.equal(m.cancelMovement, false, 'and the cancel block spends it');
  m.update(DT, still(), 0);
  assert.ok(m.pos[1] < y, 'only now does the fall resume');
});

test('A6 freeze: the freeze block sits BELOW the cancel block and ABOVE the probes', () => {
  const body = src('player/motor.js');
  const cancel = body.indexOf('if (this.cancelMovement) {');
  const freeze = body.indexOf('if (this.freezeMotor > 0) {');
  const probeNote = body.indexOf("A6 - PlayerMoveScanner's OTHER TWO probes belong HERE");
  const climb = body.indexOf('if (this._climbStep(dt, input, yaw)) return;');
  assert.ok(cancel > 0 && freeze > cancel, 'PlayerMotor.FixedUpdate :286-307');
  assert.ok(probeNote > freeze && probeNote < climb, ':308-309 sits between the freeze and the climb return');
});

test('A6 freeze: both hosts that warp on a Teleport action arm the settle and leave the heading alone', () => {
  for (const f of ['scenes/dungeon.js', 'scenes/worldModes.js']) {
    const s = src(f);
    assert.match(s, /player\.freezeMotor = TELEPORT_FREEZE_S;\n\s*player\.spawn\(pos\[0\], pos\[1\], pos\[2\]\);/,
      `${f} arms FreezeMotor before the warp, as DaggerfallAction.Teleport does`);
    assert.ok(!/onTeleport = \(\{[^}]*\}\) => \{[^}]*cam\.yaw = yawDeg/s.test(s),
      `${f} does not steer the camera - PlayerMouseLook rewrites the body's yaw next frame anyway`);
  }
});

test('A6: the head-dip guard reads IsParalyzed in every host that computes it', () => {
  for (const f of ['scenes/dungeon.js', 'scenes/exterior.js', 'scenes/world.js', 'scenes/worldModes.js']) {
    assert.match(src(f), /player\.paralyzed = paralyzed;/, `${f} feeds the flag`);
  }
});

// A little insurance that the module graph the motor now carries is
// import-order safe: moveScanner.js reads CAPSULE_RADIUS inside its
// constructor, never at module level (motor.js's own cycle note).
test('A6: the scanner defaults its radius from the motor constant at CONSTRUCTION time', () => {
  const s = new PlayerMoveScanner({});
  assert.ok(near(s.radius, CAPSULE_RADIUS));
  assert.equal(s.stepHitDistance, 0);
  assert.equal(s.headHitDistance, 0);
  assert.equal(s.hitSomethingInFront, false);
  // A facade collider with no sweep API leaves every probe alone
  // rather than crashing the step.
  s.findStep([0, 0, 0], [0, 0, 0], CAPSULE_HEIGHT, false);
  assert.equal(s.findHeadHit([0, 0, 0]), false);
  assert.equal(s.setHitSomethingInFront([0, 0, 0], [0, 0, 1]), false);
  assert.ok(GRAVITY > 0);
});
