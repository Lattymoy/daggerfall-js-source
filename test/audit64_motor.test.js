// AUDIT 64, the PLAYER MOTOR lane. Seven laws, each pinned against the
// REFERENCE's own number rather than against the port's:
//
//   F0  UpdateSpeed's third statement - GetSwimSpeed over the
//       input-adjusted speed for an EXTERIOR swimmer (PlayerMotor.cs
//       :383-389, PlayerSpeedChanger.cs:418-422).
//   F1  HandleJumpInput's exterior-water cancel (AcrobatMotor.cs:64-70).
//   F2  CheckAirControl's IsEnhancedJumping disjunct (AcrobatMotor.cs
//       :130-151).
//   F3  AutoRun's forward force and its MoveBackwards clear
//       (InputManager.cs:542-545, :1850-1852) - and, from the review
//       round, the footstep gate that is IsStandingStill
//       (PlayerFootsteps.cs:264-265 over PlayerMotor.cs:113-125) plus
//       the clear's home OUTSIDE PlayerMotor.cs:371-375's levitation
//       return.
//   F4  the dungeon shallow-water threshold reads the LIVE controller
//       centre (PlayerFootsteps.cs:189/:201 + PlayerHeightChanger.cs
//       :473-478) - pinned in test/audit26_audio.test.js beside F090.
//   F5  CanStand is an upward SphereCast of camCrouchToStandDist, not a
//       standing-capsule fit (PlayerHeightChanger.cs:115, :525-531).
//   F6  LevitateMotor's paralysis return (LevitateMotor.cs:67-69).
//   F7  the Running TALLY's gate is PlayerEntity.cs:311, not the
//       fatigue band's :408 - pinned in test/audit23_hosts.test.js and
//       test/tr1_transport.test.js beside the laws they already hold.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { MoveAxes } from '../src/player/moveAxes.js';
import { FootstepMachine, FOOTSTEP, WALK_STEP_INTERVAL } from '../src/systems/footsteps.js';   // review round: the stride the autorun latch must still drive
import { moveHeld, anyMove } from '../src/ui/input.js';   // ...and the raw-key term that silenced it
import {
  PlayerMotor,
  CAPSULE_HEIGHT, CAPSULE_RADIUS, CROUCH_HEIGHT, CROUCH_TO_STAND_DIST,
  OVER_ENCUMBERED_LIMIT, JUMP_SPEED, GRAVITY, DIAGONAL_FACTOR,
} from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const DT = 1 / 60;
const still = (over = {}) => ({ forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, ...over });

function floored() {
  const col = new Collider(() => 0);
  col.addMesh('floor', [-40, 0, -40, 40, 0, -40, 40, 0, 40, -40, 0, 40], [0, 1, 2, 0, 2, 3], I);
  return col;
}

/** A ceiling plane at `y` over the whole floor, wound downward. */
function ceiled(y) {
  const col = floored();
  col.addMesh('ceil', [-40, y, -40, 40, y, -40, 40, y, 40, -40, y, 40], [0, 2, 1, 0, 3, 2], I);
  return col;
}

function stood(col, stats) {
  const m = new PlayerMotor(col, stats);
  m.spawn(0, 0.05, 0);
  for (let f = 0; f < 40; f++) m.update(DT, still(), 0);
  return m;
}

// ── F0: the exterior swim speed ───────────────────────────────────

// PlayerSpeedChanger.cs:389-393 (GetWalkSpeed) and :418-422
// (GetSwimSpeed), spelled out from DFU's own arithmetic and constants
// (:30-31 classicToUnitySpeedUnitRatio 39.5, dfWalkBase 150) so a
// mutation of the port's walkSpeed()/swimSpeed() cannot move the
// expectation with it.
const dfuBaseSpeed = (speed) => (speed + 150 - 0.5 * (100 - Math.max(speed, 30))) / 39.5;
const dfuSwimSpeed = (base, swimming) => base * (swimming / 200) + base / 4;

test('AUDIT 64 F0: an EXTERIOR swimmer moves at GetSwimSpeed, not the grounded walk speed', () => {
  // PlayerMotor.cs:383-389 - UpdateSpeed's third statement. `sunk` is
  // controllerSink, which DoSinking/DoUnsinking write in lockstep with
  // PlayerEnterExit.IsPlayerSwimming (PlayerHeightChanger.cs:419-423,
  // :374-377), and outdoors levitateMotor.IsSwimming stays FALSE
  // (PlayerEnterExit.cs:414-421), so FixedUpdate never returns early
  // and the GROUNDED path carries the swim speed.
  const stats = { speed: 50, running: 30, swimming: 30 };
  const m = stood(floored(), stats);
  m.onExteriorWater = true;
  for (let f = 0; f < 40; f++) m.update(DT, still(), 0);   // arm the sink
  assert.equal(m.sunk, true, 'DoSinking has armed');

  const z0 = m.pos[2];
  for (let f = 0; f < 60; f++) m.update(DT, still({ forward: 1 }), 0);
  const moved = m.pos[2] - z0;
  const want = dfuSwimSpeed(dfuBaseSpeed(50), 30);
  assert.ok(Math.abs(moved - want) < 0.05,
    `one second of exterior swimming is ${want.toFixed(4)} (base ${dfuBaseSpeed(50).toFixed(4)} * 30/200 + /4), got ${moved.toFixed(4)}`);
  // ...and the walk base is 2.5x that at Swimming 30, which is exactly
  // what the port did before.
  assert.ok(moved < dfuBaseSpeed(50) * 0.5, 'not the full walk base');
  // IsMovingLessThanHalfSpeed compares GetBaseSpeed()/2 against the
  // SWIM-adjusted field (PlayerMotor.cs:168-181), so a swimmer under
  // half the walk base reads true for the stealth/footstep consumers.
  assert.equal(m.movingLessThanHalfSpeed, true, 'the half-speed mirror reads the swim-scaled field');
});

test('AUDIT 64 F0: GetSwimSpeed scales the INPUT-ADJUSTED speed, and water walking is exempt', () => {
  const stats = { speed: 50, running: 30, swimming: 30 };
  // Running: the swim law multiplies the run base, not the walk base.
  const r = stood(floored(), stats);
  r.onExteriorWater = true;
  for (let f = 0; f < 40; f++) r.update(DT, still(), 0);
  const rz = r.pos[2];
  for (let f = 0; f < 60; f++) r.update(DT, still({ forward: 1, run: true }), 0);
  const ran = r.pos[2] - rz;
  const walked = dfuSwimSpeed(dfuBaseSpeed(50), 30);
  assert.ok(ran > walked * 1.2, `a running swimmer scales the RUN base (${ran.toFixed(3)} vs walk ${walked.toFixed(3)})`);

  // PlayerMotor.cs:387 - `&& !PlayerEntity.IsWaterWalking`.
  const w = stood(floored(), stats);
  w.onExteriorWater = true;
  for (let f = 0; f < 40; f++) w.update(DT, still(), 0);
  w.waterWalking = true;
  const wz = w.pos[2];
  for (let f = 0; f < 60; f++) w.update(DT, still({ forward: 1 }), 0);
  const wmoved = w.pos[2] - wz;
  assert.ok(Math.abs(wmoved - dfuBaseSpeed(50)) < 0.05,
    `a water walker keeps the untouched walk base ${dfuBaseSpeed(50).toFixed(4)}, got ${wmoved.toFixed(4)}`);
});

// ── F1: the exterior-water jump cancel ────────────────────────────

test('AUDIT 64 F1: an exterior swimmer cannot jump (AcrobatMotor.cs:64-70)', () => {
  const m = stood(floored());
  m.onExteriorWater = true;
  for (let f = 0; f < 40; f++) m.update(DT, still(), 0);
  assert.ok(m.grounded && m.groundedTime >= 0.1, 'past the bunny-hop gate');
  m.update(DT, still({ jump: true }), 0);
  assert.equal(m.jumped, false, 'DFU refuses the jump on a Swimming water tile');
  assert.ok(m.velY <= 0, `no liftoff (velY ${m.velY})`);

  // ...and the SAME motor jumps the moment the water is gone, so a
  // mutation that cancels every jump reddens here.
  m.onExteriorWater = false;
  for (let f = 0; f < 40; f++) m.update(DT, still(), 0);
  m.update(DT, still({ jump: true }), 0);
  assert.equal(m.jumped, true, 'off the water the jump fires');
  assert.ok(m.velY > 0);
});

test('AUDIT 64 F0/F1: the two interior hosts state GetOnExteriorWaterMethod\'s indoor answer', () => {
  // PlayerMotor.cs:367 recomputes onExteriorWaterMethod every Update,
  // and :585-587 answers None indoors because GetOnExteriorGroundMethod
  // fails on PlayerEnterExit.IsPlayerInside (:511-513). Only the two
  // exterior hosts raise the port's flag, so the non-exterior hosts owe
  // the clear - otherwise a value carried in off a lake keeps the sunk
  // capsule, the swim speed and the jump cancel underground.
  for (const host of ['scenes/worldModes.js', 'scenes/dungeon.js']) {
    assert.match(src(host), /player\.onExteriorWater = false;/, `${host}: the indoor answer`);
  }
});

// ── F2: the enhanced-jump air control ─────────────────────────────

test('AUDIT 64 F2: under the Jump spell the airborne x/z are recomputed from input', () => {
  // AcrobatMotor.cs:145-150 - the IsEnhancedJumping disjunct, over the
  // `speed` UpdateSpeed just wrote (PlayerMotor.cs:349-353).
  const stats = { speed: 50, running: 30, swimming: 30 };
  let buffed = true;
  const m = new PlayerMotor(floored(), stats, { enhancedJumping: () => buffed });
  m.spawn(0, 0.05, 0);
  for (let f = 0; f < 40; f++) m.update(DT, still(), 0);
  // Jump while running forward...
  m.update(DT, still({ forward: 1, jump: true }), 0);
  assert.equal(m.jumped, true);
  assert.ok(m._airVelZ > 0, 'the liftoff carries forward momentum');
  // ...then reverse the stick in mid-air. DFU ASSIGNS the new x/z.
  m.update(DT, still({ forward: -1 }), 0);
  const want = -dfuBaseSpeed(50);
  assert.ok(Math.abs(m._airVelZ - want) < 0.05,
    `mid-air steering assigns -walkSpeed (${want.toFixed(4)}), got ${m._airVelZ.toFixed(4)}`);

  // Without the effect the momentum is FROZEN (airControl = false,
  // AcrobatMotor.cs:21) - the mutation that drops the disjunction.
  buffed = false;
  const frozen = m._airVelZ;
  m.update(DT, still({ forward: 1 }), 0);
  assert.equal(m._airVelZ, frozen, 'no spell, no steering');
});

test('AUDIT 64 F2: the arm is not jump-only - a buffed player steering off a ledge', () => {
  // CheckAirControl runs from PlayerMotor.cs:349-353 on EVERY airborne
  // frame, so gating it on `jumping` would be wrong.
  const col = new Collider(() => -100);
  col.addMesh('ledge', [-40, 0, -40, 40, 0, -40, 40, 0, 0, -40, 0, 0], [0, 1, 2, 0, 2, 3], I);
  const m = new PlayerMotor(col, { speed: 50, running: 30, swimming: 30 }, { enhancedJumping: () => true });
  m.spawn(0, 0.05, -5);
  for (let f = 0; f < 40; f++) m.update(DT, still(), 0);
  // Walk off the +z edge, never jumping.
  for (let f = 0; f < 90 && m.grounded; f++) m.update(DT, still({ forward: 1 }), 0);
  assert.equal(m.grounded, false, 'walked off the ledge');
  assert.equal(m.jumping, false, 'never jumped');
  m.update(DT, still({ strafe: 1 }), 0);
  assert.ok(Math.abs(m._airVelX - dfuBaseSpeed(50)) < 0.05, 'a strafe steers the fall');
  assert.ok(Math.abs(m._airVelZ) < 1e-9, 'and the assignment kills the forward term');
});

test('AUDIT 64 F2: the diagonal factor is limitDiagonalSpeed\'s, and every host wires the dep', () => {
  assert.equal(DIAGONAL_FACTOR, 0.7071, 'AcrobatMotor.cs:143 inputModifyFactor');
  for (const host of ['scenes/world.js', 'scenes/exterior.js', 'scenes/dungeon.js']) {
    assert.match(src(host), /enhancedJumping: \(\) => isEnhancedJumping\(playerEntity\)/,
      `${host}: DaggerfallEntity.IsEnhancedJumping reaches the motor`);
  }
});

// ── F3: AutoRun ───────────────────────────────────────────────────

test('AUDIT 64 F3: a latched AutoRun drives the vertical axis with no key held', () => {
  // InputManager.cs:542-545 - `if (ToggleAutorun) ApplyVerticalForce(1)`.
  const noAccel = new MoveAxes();
  assert.equal(noAccel.update(DT, {}, { acceleration: false }).forward, 0, 'nothing held, nothing moves');
  assert.equal(noAccel.update(DT, { autorun: true }, { acceleration: false }).forward, 1,
    'the latch alone is a full +1 (:1466-1468 - vertical = scale)');
  // MoveBackwards runs AFTER :542 (FindKeyboardActions is :548), and
  // the last write wins in this arm: back beats the latch.
  assert.equal(noAccel.update(DT, { autorun: true, backwards: true }, { acceleration: false }).forward, -1,
    'MoveBackwards\'s ApplyVerticalForce(-1) is the later write');
  assert.equal(noAccel.update(DT, { autorun: true, forwards: true }, { acceleration: false }).forward, 1);
  assert.equal(noAccel.update(DT, { forwards: true, backwards: true }, { acceleration: false }).forward, 0,
    'the recorded neutral-difference answer for two opposing keys is untouched');
});

test('AUDIT 64 F3: with MovementAcceleration the latch climbs at 9.8/s and friction cannot decay it', () => {
  // ApplyVerticalForce (:1465-1473) raises posVerticalImpulse, which
  // ApplyFriction (:1482-1483) then honours.
  const a = new MoveAxes();
  let v = 0;
  for (let f = 0; f < 6; f++) v = a.update(DT, { autorun: true }, { acceleration: true }).forward;
  assert.ok(Math.abs(v - 9.8 * DT * 6) < 1e-9, `six steps of moveAccelerationConst 9.8 (${v})`);
  // A mutation that drops the impulse flag would have friction cancel
  // every frame and leave the axis at 0.
  assert.ok(v > 0, 'the impulse blocks ApplyFriction');
  // Autorun + MoveForwards sums TWO forces in one Update.
  const b = new MoveAxes();
  const one = b.update(DT, { forwards: true }, { acceleration: true }).forward;
  const c = new MoveAxes();
  const two = c.update(DT, { forwards: true, autorun: true }, { acceleration: true }).forward;
  assert.ok(Math.abs(two - one * 2) < 1e-9, `:542 then :1848 - two +1 forces (${two} vs ${one})`);
});

test('AUDIT 64 F3: MoveBackwards HELD clears ToggleAutorun, so the next press RE-latches', () => {
  // InputManager.cs:1850-1852 clears it inside FindKeyboardActions'
  // GetKey loop - HELD, not the press edge, which is what
  // PlayerSpeedChanger.cs:96-99's ToggleRun clear is.
  const m = stood(floored());
  const bag = (over) => still({ autoRun: false, back: false, sneak: false, ...over });
  m.update(DT, bag({ autoRun: true }), 0);
  assert.equal(m.toggleAutorun, true, 'the press latches (PlayerSpeedChanger.cs:85-93)');
  assert.equal(m.isRunning, true, 'and forces the run mode on');
  // Tap MoveBackwards: DFU zeroes ToggleAutorun on the held key. (The
  // held/edge distinction is unobservable in isolation because the
  // AutoRun press is itself refused while MoveBackwards is down
  // (PlayerSpeedChanger.cs:85-93); the law this pin holds is that
  // ToggleAutorun is cleared AT ALL - the port cleared only ToggleRun.)
  m.update(DT, bag({ back: true }), 0);
  assert.equal(m.toggleAutorun, false, 'the held back key zeroes the latch');
  m.update(DT, bag(), 0);
  // ONE press resumes it. Before this the stale `_autorun` made the
  // press compute `!true = false` and turn the latch OFF.
  m.update(DT, bag({ autoRun: true }), 0);
  assert.equal(m.toggleAutorun, true, 'one press resumes the autorun');
  assert.equal(m.isRunning, true);
});

test('AUDIT 64 F3: all four hosts hand the latch to the axes', () => {
  for (const host of ['scenes/world.js', 'scenes/exterior.js', 'scenes/dungeon.js', 'scenes/worldModes.js']) {
    assert.match(src(host), /moveAxes\.update\(dt, \{ \.\.\.mv, autorun: player\.toggleAutorun \}\)/,
      `${host}: InputManager.cs:542's force reaches the axes`);
  }
});

// ── F3, THE REVIEW ROUND ──────────────────────────────────────────
// Two halves of the same law were left wrong by the first pass: the
// footstep gate (which is IsStandingStill, not a HasAction read) and
// the home of the ToggleAutorun clear (InputManager, not the
// levitation-gated PlayerSpeedChanger port).

test('AUDIT 64 F3 (review): the autorun stride is AUDIBLE - PlayerFootsteps gates on IsStandingStill', () => {
  // PlayerFootsteps.cs:264-265 `if (playerMotor.IsStandingStill)
  // return;` over PlayerMotor.cs:113-125, which is
  // `Vector2(moveDirection.x, moveDirection.z).magnitude == 0` inside
  // `if (grounded)`. Under autorun InputManager.cs:542-545's
  // ApplyVerticalForce(1) gives Vertical a non-zero value and
  // GroundedMovement writes it into moveDirection, so DFU is NOT
  // standing still and plays the stride.
  const m = stood(floored());
  const axes = new MoveAxes();
  const bag = (over) => still({ autoRun: false, back: false, sneak: false, ...over });
  m.update(DT, bag({ autoRun: true }), 0);
  assert.equal(m.toggleAutorun, true, 'the latch is on');

  // The counterfactual the port shipped: no MOVE key is held, so the
  // raw-key term reads "standing still" and silenced the stride.
  assert.equal(anyMove(moveHeld(new Set())), false, 'no MoveForwards/Backwards/Left/Right is down');

  const fs = new FootstepMachine();
  const set = [FOOTSTEP.Stone1, FOOTSTEP.Stone2];
  let steps = 0;
  let sawMoving = false;
  for (let f = 0; f < 240; f++) {
    const a = axes.update(DT, { autorun: m.toggleAutorun }, { acceleration: false });
    m.update(DT, bag({ forward: a.forward, strafe: a.strafe }), 0);
    if (!m.standing) sawMoving = true;
    if (fs.update(m.pos, {
      grounded: m.grounded, swimming: false, levitating: false,
      standingStill: m.standing, halfSpeed: m.movingLessThanHalfSpeed,
    }, set)) steps++;
  }
  assert.equal(sawMoving, true, 'IsStandingStill is FALSE under a latched autorun');
  assert.ok(steps > 0, `the autorun stride is heard (${steps} steps over four seconds)`);
  assert.ok(m.pos[2] > WALK_STEP_INTERVAL, 'and the player really covered ground');

  // ...and the frozen player is STILL silent, because DFU's own
  // silence runs through the same getter: FrictionMotor
  // .GroundedMovement zeroes inputX/inputY on IsParalyzed
  // (FrictionMotor.cs:76-81), so moveDirection is zero and :113-125
  // answers true. The hosts' paralysis bag zeroes both axes, latch or
  // no latch.
  assert.equal(m.toggleAutorun, true, 'the latch is still on');
  m.update(DT, bag({ forward: 0, strafe: 0 }), 0);
  assert.equal(m.standing, true, 'a paralysed autorunner takes no stride');
  assert.equal(fs.update(m.pos, {
    grounded: m.grounded, swimming: false, levitating: false,
    standingStill: m.standing, halfSpeed: m.movingLessThanHalfSpeed,
  }, set), null, 'and the machine plays nothing');
});

test('AUDIT 64 F3 (review): all four hosts gate the stride on IsStandingStill', () => {
  for (const host of ['scenes/world.js', 'scenes/exterior.js', 'scenes/dungeon.js', 'scenes/worldModes.js']) {
    const s = src(host);
    assert.ok(s.includes('standingStill: player.standing'),
      `${host}: PlayerFootsteps.cs:264 reads playerMotor.IsStandingStill`);
    assert.equal(/standingStill: !moving/.test(s), false,
      `${host}: the raw-move-key term is not IsStandingStill (it is silent under autorun)`);
  }
});

test('AUDIT 64 F3 (review): a LEVITATING autorunner loses the latch on MoveBackwards', () => {
  // The clear is InputManager.cs:1850-1852, inside FindKeyboardActions'
  // GetKey loop - InputManager.Update has no levitation test anywhere.
  // PlayerMotor.cs:371-375's early return gates only
  // speedChanger.CaptureInputSpeedAdjustment().
  const m = stood(floored());
  const bag = (over) => still({ autoRun: false, back: false, sneak: false, ...over });
  m.update(DT, bag({ autoRun: true }), 0);
  assert.equal(m.toggleAutorun, true);
  m.levitating = true;
  m.update(DT, bag({ back: true }), 0);
  assert.equal(m.toggleAutorun, false, 'MoveBackwards HELD zeroes ToggleAutorun while levitating too');

  // ...and PlayerSpeedChanger's own half stays under the gate: an
  // AutoRun press mid-levitation changes nothing, because
  // CaptureInputSpeedAdjustment is what :373 returns above.
  m.update(DT, bag(), 0);
  m.update(DT, bag({ autoRun: true }), 0);
  assert.equal(m.toggleAutorun, false, 'the levitation gate still owns the toggle arm');
});

test('AUDIT 64 F3 (review): a key HELD across a levitation window is not a new press', () => {
  // ActionStarted (InputManager.cs:626-629) reads previousActions vs
  // currentActions, and InputManager.Update rebuilds both every frame
  // (:463-464) - levitation cannot stale them.
  const m = stood(floored());
  const bag = (over) => still({ autoRun: false, back: false, sneak: false, ...over });
  m.levitating = true;
  m.update(DT, bag({ autoRun: true }), 0);
  m.update(DT, bag({ autoRun: true }), 0);
  m.levitating = false;
  m.update(DT, bag({ autoRun: true }), 0);
  assert.equal(m.toggleAutorun, false, 'the key was never released, so there is no press edge to spend');
  m.update(DT, bag(), 0);
  m.update(DT, bag({ autoRun: true }), 0);
  assert.equal(m.toggleAutorun, true, 'a real press still latches');

  // The same holds for Run, the other ActionStarted read the toggle
  // arm spends (PlayerSpeedChanger.cs:72-76: with ToggleRun raised,
  // runningMode is XORed by ActionStarted(Run)). The latch above left
  // ToggleRun true, so the edge is observable.
  assert.equal(m.isRunning, true, 'the autorun latch forced the run mode on');
  m.levitating = true;
  m.update(DT, bag({ autoRun: true, run: true }), 0);
  m.update(DT, bag({ autoRun: true, run: true }), 0);
  m.levitating = false;
  // (the levitation edge raises CancelMovement, PlayerMotor.cs:286-294,
  // so give the walk path a couple of steps to write IsRunning again)
  for (let f = 0; f < 3; f++) m.update(DT, bag({ autoRun: true, run: true }), 0);
  assert.equal(m.isRunning, true, 'a Run key held across the window does not toggle the mode off');
});

test('AUDIT 64 F3 (review): IsStandingStill for a swimmer is the grounded test over a zeroed moveDirection', () => {
  // PlayerMotor.cs:322-326 sets `moveDirection = Vector3.zero` and
  // RETURNS for a swimmer/levitator, so :113-125 collapses to
  // `grounded` - the walk path's writer is below that return.
  const m = stood(floored());
  // Walk first, so the WALK path's writer leaves `standing` false...
  for (let f = 0; f < 10; f++) m.update(DT, still({ forward: 1 }), 0);
  assert.equal(m.standing, false, 'the walker is not standing still');
  assert.equal(m.grounded, true);
  // ...then take to the water without leaving the floor. DFU zeroes
  // moveDirection at :322-326, so IsStandingStill answers `grounded`
  // - true - however hard the swimmer pushes forward.
  m.swimming = true;
  m.update(DT, still({ forward: 1 }), 0);
  assert.equal(m.grounded, true, 'still touching the bottom');
  assert.equal(m.standing, true, 'moveDirection is zero, so IsStandingStill is the grounded test');
  // Rise off the bottom and the same getter flips the other way -
  // :113-125 returns false outright when not grounded, however still
  // the swimmer is.
  for (let f = 0; f < 30; f++) m.update(DT, still({ forward: 1, up: true }), 0);
  assert.equal(m.grounded, false, 'the swimmer has left the floor');
  assert.equal(m.standing, false, 'and IsStandingStill is false off the ground');
});

// ── F5: CanStand ──────────────────────────────────────────────────

test('AUDIT 64 F5: CanStand sweeps camCrouchToStandDist upward, clearing only feet+1.25', () => {
  // PlayerHeightChanger.cs:115 + :525-531. The reference's numbers:
  // (1.8 - 0.9)/2 = 0.45 from the crouched centre feet+0.45 with the
  // controller radius 0.35 tops out at feet+1.25 - the CAMERA's rise,
  // not the 1.8 capsule.
  assert.equal(CROUCH_TO_STAND_DIST, 0.45, 'camCrouchToStandDist (:115)');
  assert.equal(CAPSULE_RADIUS, 0.35, 'controller.radius');
  assert.equal(CROUCH_HEIGHT / 2 + CROUCH_TO_STAND_DIST + CAPSULE_RADIUS, 1.25,
    'the swept sphere tops out at feet + 1.25');
  assert.equal(CAPSULE_HEIGHT, 1.8);
});

test('AUDIT 64 F5: a 1.4 ceiling PERMITS the stand where the old full-capsule probe refused it', () => {
  // 1.4 sits inside the 1.25..1.8 band the port used to refuse. DoStand
  // (:265-283) raises the capsule regardless and lets the head clip.
  const m = stood(ceiled(1.4));
  m.update(DT, still({ crouch: true }), 0);
  for (let f = 0; f < 20; f++) m.update(DT, still(), 0);
  assert.equal(m.crouching, true, 'crouched under the low ceiling');
  m.update(DT, still({ crouch: true }), 0);
  for (let f = 0; f < 20; f++) m.update(DT, still(), 0);
  assert.equal(m.crouching, false, 'DFU stands the player up under a 1.4 ceiling');
});

test('AUDIT 64 F5: a 1.2 ceiling still REFUSES - the sweep reaches 1.25', () => {
  const m = stood(ceiled(1.2));
  m.update(DT, still({ crouch: true }), 0);
  for (let f = 0; f < 20; f++) m.update(DT, still(), 0);
  assert.equal(m.crouching, true);
  m.update(DT, still({ crouch: true }), 0);
  for (let f = 0; f < 20; f++) m.update(DT, still(), 0);
  assert.equal(m.crouching, true, 'DFU\'s own sweep hits at 1.2 too');
});

// ── F6: the paralyzed swimmer ─────────────────────────────────────

test('AUDIT 64 F6: a paralyzed over-encumbered swimmer takes NO displacement', () => {
  // LevitateMotor.cs:67-69's return sits above the input read, above the
  // upDownVector ladder (the over-encumbered sink at :81-89 included)
  // and above the one movement call at :106.
  assert.equal(OVER_ENCUMBERED_LIMIT, 250, 'LevitateMotor.cs:83 - CarriedWeight * 4 > 250');
  const mk = (paralyzed) => {
    const m = new PlayerMotor(floored(), { speed: 50, running: 30, swimming: 30 },
      { carriedWeight: () => 80 });   // 80 * 4 = 320 > 250
    m.spawn(0, 20, 0);
    m.waterSurfaceY = 40;
    m.swimming = true;
    m.paralyzed = paralyzed;
    return m;
  };
  const frozen = mk(true);
  const y0 = frozen.pos[1];
  for (let f = 0; f < 60; f++) frozen.update(DT, still(), 0);
  assert.equal(frozen.pos[1], y0, 'DFU holds a paralyzed swimmer in place - the sink never runs');

  // ...and the F027 sink itself still fires without the paralysis, so
  // the guard cannot be a silent revert of that law.
  const sinking = mk(false);
  const z0 = sinking.pos[1];
  for (let f = 0; f < 60; f++) sinking.update(DT, still(), 0);
  assert.ok(sinking.pos[1] < z0 - 1, `the unfrozen over-encumbered swimmer still sinks (${(sinking.pos[1] - z0).toFixed(3)})`);
});

test('AUDIT 64 F6: the vector zeroing above the guard still runs (PlayerMotor.cs:321-326)', () => {
  // `moveDirection = Vector3.zero` is unconditional on the swim/levitate
  // return, paralysis or not - so a paralyzed swimmer who leaves the
  // water drops straight down rather than resuming stale momentum.
  const m = new PlayerMotor(floored(), { speed: 50, running: 30, swimming: 30 });
  m.spawn(0, 20, 0);
  m.swimming = true;
  m.update(DT, still(), 0);   // the swim EDGE spends PlayerMotor.CancelMovement (:286-294) and returns
  m._airVelX = 5; m._airVelZ = 5; m.velY = 9;
  m.paralyzed = true;
  m.update(DT, still(), 0);
  assert.equal(m._airVelX, 0, 'the air momentum is scrubbed');
  assert.equal(m._airVelZ, 0);
  assert.equal(m.velY, 0);
});

// ── the gravity constant the pins above stand on ──────────────────

test('AUDIT 64: the jump/gravity constants are DFU\'s, so the F1 pin means something', () => {
  assert.equal(JUMP_SPEED, 4.5, 'AcrobatMotor jumpSpeed');
  assert.equal(GRAVITY, 20.0, 'PlayerMotor gravity');
});
