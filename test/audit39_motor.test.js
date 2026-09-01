// AUDIT 39 - the player-motor cluster (#57, #58, #60, #61, #62, #63).
//
// #57: LevitateMotor's IsSwimming/IsLevitating are property setters -
//      BOTH edges of BOTH modes raise PlayerMotor.CancelMovement
//      (:151/:159/:174/:182), and FixedUpdate's cancel block
//      (:286-294) runs AcrobatMotor.ClearFallingDamage (:239-243).
//      Without it a fall broken by Levitate was billed in full the
//      moment the spell ended.
// #58: PlayerHeightChanger.DecideHeightAction gates the whole
//      crouch/climb/swim block `!riding && !onWater && !levitating`
//      (:171) - the port expressed only the levitating half, so one
//      tap of C dropped a horse to crouch speed.
// #60: the same early return zeroes moveDirection (:322-326); the
//      port kept the stale horizontal momentum across levitation,
//      swimming and a climb.
// #61: AcrobatMotor.HandleJumpInput's transport arms - the Cart
//      cancel (:66-70) and the Horse's flat 1.75 (:82-86).
// #62: CameraRecoiler.ResetRecoil's three subscribers (:178-197).
// #63: PlayerSpeedChanger.CaptureInputSpeedAdjustment's run half and
//      the AutoRun latch (:72-99).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PlayerMotor, JUMP_SPEED, HORSE_JUMP_MULTIPLIER, FALL_DAMAGE_THRESHOLD, GRAVITY,
  crouchSpeed, rideSpeed, walkSpeed,
} from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';
import { TRANSPORT_MODES, DF_RIDE_BASE } from '../src/systems/transport.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const DT = 1 / 60;

function floored() {
  const col = new Collider(() => 0);
  col.addMesh('floor', new Float32Array([-40, 0, -40, 40, 0, -40, 40, 0, 40, -40, 0, 40]), [0, 1, 2, 0, 2, 3], I);
  return col;
}
const still = (over = {}) => ({ forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, ...over });
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
/** Steps until the motor is grounded again (or the budget runs out). */
function fallToGround(m, input = still()) {
  for (let f = 0; f < 600 && !m.grounded; f++) m.update(DT, input, 0);
}

// ── #57: the cancel block ─────────────────────────────────────────

test('AUDIT 39 #57: a levitate EDGE raises CancelMovement, and the cancel block clears the live fall', () => {
  const m = new PlayerMotor(floored());
  m.spawn(0, 40, 0);
  for (let f = 0; f < 10; f++) m.update(DT, still(), 0);
  assert.equal(m.falling, true, 'the drop is live');
  assert.ok(near(m.fallStart, 40), 'anchored where it began');

  m.levitating = true;
  assert.equal(m.cancelMovement, true, 'SetLevitating (:151) raises it on the START edge');
  const y = m.pos[1];
  m.update(DT, still(), 0);   // the cancel block spends one whole step
  assert.equal(m.cancelMovement, false, 'and FixedUpdate spends it');
  assert.equal(m.falling, false, 'ClearFallingDamage: falling = false');
  assert.ok(near(m.fallStart, y), 'and fallStartLevel = the position it was cleared at');
  assert.ok(near(m.pos[1], y), 'the cancel step moves nothing at all');
});

test('AUDIT 39 #57: Levitate SAVES the fall - ending it near the floor bills only the rest of the drop', () => {
  const m = new PlayerMotor(floored());
  m.spawn(0, 40, 0);
  for (let f = 0; f < 10; f++) m.update(DT, still(), 0);
  m.levitating = true;
  m.update(DT, still(), 0);          // the START edge's cancel step
  m.pos[1] = 1;                      // float gently down to the floor
  m.levitating = false;
  assert.equal(m.cancelMovement, true, 'SetLevitating (:159) raises it on the END edge too');
  m.update(DT, still(), 0);          // the END edge's cancel step re-anchors here
  fallToGround(m);
  assert.equal(m.grounded, true);
  assert.ok(m.landedFallDistance < FALL_DAMAGE_THRESHOLD,
    `the drop billed is the metre after the spell, not the 40 before it (${m.landedFallDistance})`);
});

test('AUDIT 39 #57: a dive into water clears it the same way (SetSwimming :174-186)', () => {
  const m = new PlayerMotor(floored());
  m.spawn(0, 40, 0);
  for (let f = 0; f < 10; f++) m.update(DT, still(), 0);
  assert.equal(m.falling, true);
  m.swimming = true;
  assert.equal(m.cancelMovement, true);
  m.update(DT, still(), 0);
  assert.equal(m.falling, false, 'the port had only the EXTERIOR water-tile exemption');
  // ...and the flag is an EDGE, not a level: a host rewriting the same
  // value every frame raises nothing.
  m.swimming = true;
  assert.equal(m.cancelMovement, false, 'the same value is no transition');
});

// ── #58: no crouching from the saddle ─────────────────────────────

test('AUDIT 39 #58: a mounted player cannot crouch - the `!riding` half of :171', () => {
  const m = new PlayerMotor(floored(), { speed: 50, running: 40 });
  m.spawn(0, 0.1, 0);
  for (let f = 0; f < 5; f++) m.update(DT, still(), 0);
  m.setTransportMode(TRANSPORT_MODES.Horse);
  m.heightTimer = 1; m.update(DT, still(), 0);   // let the mount finish
  const mounted = m.speed;
  assert.ok(near(mounted, rideSpeed(50, DF_RIDE_BASE)), 'trotting');

  for (let f = 0; f < 5; f++) m.update(DT, still({ crouch: true }), 0);
  assert.equal(m.heightAction, null, 'DecideHeightAction never reaches the crouch toggle');
  assert.equal(m.crouching, false);
  assert.ok(near(m.speed, mounted), 'so the horse never falls to crouch speed');
  assert.ok(crouchSpeed(50) < mounted, 'which is the drop this refuses');

  // ...and dismounted the same key still works, unchanged.
  m.setTransportMode(TRANSPORT_MODES.Foot);
  m.heightTimer = 1; m.update(DT, still(), 0);
  m.update(DT, still({ crouch: true }), 0);
  assert.equal(m.heightAction, 'crouch', 'on foot the toggle is untouched');
});

// ── #60: moveDirection = Vector3.zero ─────────────────────────────

test('AUDIT 39 #60: leaving levitation in mid-air drops STRAIGHT down - no stale momentum', () => {
  const m = new PlayerMotor(floored(), { speed: 50, running: 100 });
  m.spawn(0, 0.1, 0);
  for (let f = 0; f < 30; f++) m.update(DT, still({ forward: 1, run: true }), 0);
  assert.ok(Math.hypot(m._airVelX, m._airVelZ) > 0, 'running north');

  m.levitating = true;
  m.update(DT, still(), 0);                       // the cancel step
  m.pos[1] = 8;
  for (let f = 0; f < 30; f++) m.update(DT, still({ up: true }), 0);
  assert.equal(m._airVelX, 0, 'the levitate path zeroes moveDirection every step (:322-326)');
  assert.equal(m._airVelZ, 0);

  m.levitating = false;
  const [x0, z0] = [m.pos[0], m.pos[2]];
  m.update(DT, still(), 0);
  fallToGround(m);
  assert.ok(near(m.pos[0], x0, 1e-6) && near(m.pos[2], z0, 1e-6),
    'airControl is false, so a zeroed moveDirection is what the whole fall spends');
});

// ── #61: the transport arms of the jump ───────────────────────────

test('AUDIT 39 #61: a HORSE jumps at the flat 1.75 and a CART cannot jump at all', () => {
  assert.equal(HORSE_JUMP_MULTIPLIER, 1.75, '"At least 1.5f to be able to jump over hedges"');
  const mk = (mode) => {
    const m = new PlayerMotor(floored(), { speed: 50, running: 40 });
    m.jumpBoost = () => 1.15;   // the on-foot skill sum (Jumping 30)
    m.spawn(0, 0.1, 0);
    for (let f = 0; f < 20; f++) m.update(DT, still(), 0);   // past the 0.1 s grounded gate
    if (mode !== TRANSPORT_MODES.Foot) { m.setTransportMode(mode); m.heightTimer = 1; m.update(DT, still(), 0); }
    m.update(DT, still({ jump: true }), 0);
    return m;
  };
  // The takeoff velocity, less the same step's gravity.
  const takeoff = (mult) => JUMP_SPEED * mult - GRAVITY * DT;
  const foot = mk(TRANSPORT_MODES.Foot);
  assert.equal(foot.jumped, true);
  assert.ok(near(foot.velY, takeoff(1.15), 1e-6), 'on foot the skill multiplier still owns the takeoff');

  const horse = mk(TRANSPORT_MODES.Horse);
  assert.equal(horse.jumped, true, 'a horse jumps');
  assert.ok(near(horse.velY, takeoff(HORSE_JUMP_MULTIPLIER), 1e-6),
    `the flat 1.75 REPLACES the skill sum rather than multiplying it (${horse.velY})`);

  const cart = mk(TRANSPORT_MODES.Cart);
  assert.equal(cart.jumped, false, 'the cart cancel (:66-70)');
  assert.equal(cart.jumping, false);
  assert.ok(cart.velY <= 0, 'no takeoff velocity at all');
});

// ── #62: ResetRecoil's subscribers ────────────────────────────────

test('AUDIT 39 #62: the hosts wire CameraRecoiler.reset to load, relocation and the court screen', () => {
  const world = src('scenes/world.js');
  assert.match(world, /_loading = true;\n[\s\S]{0,200}?cameraRecoiler\.reset\(\);/,
    'world: SaveLoadManager_OnStartLoad (:185-191)');
  assert.match(world, /async function _teleportToPixel\([\s\S]{0,400}?cameraRecoiler\.reset\(\);/,
    'world: StreamingWorld_OnInitWorld (:178-183) - fast travel, teleport, the load\'s landing');
  for (const f of ['scenes/world.js', 'scenes/exterior.js']) {
    assert.match(src(f), /onCourtScreen: \(\) => cameraRecoiler\.reset\(\)/,
      `${f}: DaggerfallCourtWindow_OnCourtScreen (:193-197)`);
  }
  assert.match(src('scenes/arrestFlow.js'), /playerEntity\.arrested = true;\n\s*onCourtScreen\(\);/,
    'the court screen raises its event where DFU raises it');
  assert.match(src('scenes/dungeon.js'), /cameraRecoiler\.reset\(\); return _ctxQuickLoad\.apply\(ctx, args\);/,
    'the dungeon host hooks its one load door');
});

// ── #63: ToggleRun / AutoRun ──────────────────────────────────────

test('AUDIT 39 #63: AutoRun latches ToggleRun - the run survives the key release, MoveBackwards ends it', () => {
  const m = new PlayerMotor(floored(), { speed: 50, running: 40 });
  m.spawn(0, 0.1, 0);
  for (let f = 0; f < 5; f++) m.update(DT, still(), 0);
  assert.equal(m.isRunning, false);

  // The press flips ToggleAutorun, hands it to ToggleRun, and forces
  // the run mode on because the player was not already running.
  m.update(DT, still({ autoRun: true }), 0);
  assert.equal(m.isRunning, true, 'autorun runs with no Run key held');
  for (let f = 0; f < 5; f++) m.update(DT, still({ autoRun: true }), 0);
  assert.equal(m.isRunning, true, 'holding the key is not more presses (ActionStarted, not HasAction)');
  m.update(DT, still(), 0);
  assert.equal(m.isRunning, true, 'the release keeps the latch - that is the point');

  // A MoveBackwards PRESS drops it (InputManager.cs:1851).
  m.update(DT, still({ back: true, forward: -1 }), 0);
  m.update(DT, still(), 0);
  assert.equal(m.isRunning, false, 'walking backwards ends the autorun');
});

test('AUDIT 39 #63: the AutoRun press is refused while MoveBackwards is held, and a second press ends the latch', () => {
  const m = new PlayerMotor(floored(), { speed: 50, running: 40 });
  m.spawn(0, 0.1, 0);
  for (let f = 0; f < 5; f++) m.update(DT, still(), 0);
  m.update(DT, still({ autoRun: true, back: true, forward: -1 }), 0);
  m.update(DT, still(), 0);
  assert.equal(m.isRunning, false, '`&& !HasAction(MoveBackwards)` (:83)');

  m.update(DT, still({ autoRun: true }), 0);
  assert.equal(m.isRunning, true);
  m.update(DT, still(), 0);            // release, so the next press is an edge
  m.update(DT, still({ autoRun: true }), 0);
  m.update(DT, still(), 0);
  assert.equal(m.isRunning, false, 'the second press clears ToggleAutorun and the mode falls to the held key');
});

test('AUDIT 39 #63: without the latch the run is the held key, exactly as before', () => {
  const m = new PlayerMotor(floored(), { speed: 50, running: 40 });
  m.spawn(0, 0.1, 0);
  for (let f = 0; f < 5; f++) m.update(DT, still(), 0);
  m.update(DT, still({ forward: 1, run: true }), 0);
  assert.equal(m.isRunning, true);
  m.update(DT, still({ forward: 1 }), 0);
  assert.equal(m.isRunning, false, 'release ends it');
  assert.ok(near(m.speed, walkSpeed(50)));
});

test('AUDIT 39 #63: every host feeds the AutoRun action and its MoveBackwards cancel', () => {
  for (const f of ['scenes/world.js', 'scenes/exterior.js', 'scenes/dungeon.js', 'scenes/worldModes.js']) {
    const s = src(f);
    assert.match(s, /autoRun: held\(keys, 'AutoRun'\),\n\s*back: mv\.backwards,/, `${f} feeds the latch`);
  }
});
