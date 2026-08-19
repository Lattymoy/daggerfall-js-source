// AUDIT 18 (player lane): the three motor/activation parity defects
// this pass repaired, each pinned against the DFU C# it was measured
// from.
//
//  F1  PlayerHeightChanger runs on the RENDER frame. DFU reads the
//      Crouch press in PlayerMotor.Update (:364-371 ->
//      heightChanger.DecideHeightAction) and applies it in
//      PlayerHeightChanger.Update - never in FixedUpdate. The port
//      read input.crouch INSIDE the fixed-step loop, so any render
//      frame shorter than 1/60 s ran zero steps and threw the one-
//      frame edge away: on a 120 Hz display every other crouch press
//      did nothing.
//  F2  A BLOCKED stand-up is not dropped on the spot. DFU's
//      PlayerHeightChanger.Update chain is
//        else if (heightAction == DoStanding && CanStand()) DoStand();
//        ... else DoDismount();
//      so a blocked stand falls through to DoDismount, which (already
//      dismounted) only ticks camTimer and calls timerResetAction()
//      once camTimer >= timerMax (timerFast 0.10 s). The request
//      therefore RETRIES every frame for 0.10 s and is only then
//      forgotten; the port forgot it immediately.
//  F3  IsMovingLessThanHalfSpeed (PlayerMotor.cs:113-125, :168-182).
//      IsStandingStill runs its zero-magnitude test only inside
//      `if (grounded)` and returns false otherwise, and the swim /
//      levitate early return at :322-326 sits ABOVE UpdateSpeed, so
//      the `speed` FIELD keeps its last grounded value while
//      swimming. The port dropped the grounded term and compared
//      against the freshly computed SWIM speed.
//  F4  PlayerActivate.cs:85 CorpseActivationDistance = 150 *
//      GlobalScale (3.75), deliberately longer than everything else
//      (:866-874 exempts CorpseMarker from the treasure gate and
//      :938 re-tests it against this constant). It was never ported.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PlayerMotor, HEIGHT_TIMER_FAST, CROUCH_HEIGHT, CAPSULE_HEIGHT,
  CROUCH_EYE_HEIGHT, EYE_HEIGHT, FIXED_DT,
  walkSpeed, sneakSpeed, swimSpeed,
} from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';
import {
  pickActivatable, GLOBAL_SCALE,
  CORPSE_ACTIVATION_DISTANCE, DEFAULT_ACTIVATION_DISTANCE,
} from '../src/player/activate.js';

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const still = () => ({ forward: 0, strafe: 0, run: false, sneak: false, jump: false, up: false, down: false });

function floored() {
  const col = new Collider(() => 0);
  col.addMesh('floor',
    new Float32Array([-10, 0, -10, 10, 0, -10, 10, 0, 10, -10, 0, 10]),
    new Uint32Array([0, 1, 2, 0, 2, 3]), I);
  return col;
}

/** A flat floor whose CanStand probe and grounded result are driven by
 *  the test (the geometry-driven versions live in player.test.js /
 *  motorStairs.test.js - here the LAW is under test, not the probe). */
function stubFloor() {
  return {
    blockedStand: false,
    onGround: true,
    penetrationAt() { return this.blockedStand ? 0.9 : 0; },
    move(pos, dx, dy, dz) {
      pos[0] += dx;
      pos[2] += dz;
      pos[1] = this.onGround ? 0 : pos[1] + dy;
      return { grounded: this.onGround, groundKey: this.onGround ? 'floor' : null };
    },
  };
}

test('audit18 player F1: the crouch key is read on the RENDER frame - a 120 Hz frame that runs no physics step must not swallow it', () => {
  const m = new PlayerMotor(floored());
  m.spawn(0, 0, 0);
  for (let f = 0; f < 30; f++) m.update(1 / 60, still(), 0);
  assert.equal(m.crouching, false);
  // 1/120 < FIXED_DT: the accumulator reaches a step only on every
  // SECOND frame, so half of these presses land on a frame that runs
  // no physics at all. DFU's DecideHeightAction sees every one.
  assert.ok(1 / 120 < FIXED_DT);
  // P18: the toggle is TIMED - each press lands on IsCrouching still
  // false (DoCrouch flips at camTimer >= timerMax), so every re-press
  // re-arms DoCrouching and the FIRST press's clock keeps running.
  // The law under test is that the un-stepped frames still ARM it.
  const presses = [true, false, true, false, true, false, true, false];
  for (const crouch of presses) {
    m.update(1 / 120, { ...still(), crouch }, 0);
    assert.equal(m.heightAction, 'crouch', 'a no-step frame must not swallow the press');
    assert.equal(m.crouching, false, 'nothing flips before camTimer >= timerMax');
  }
  m.update(0.04, still(), 0);   // 8/120 + 0.04 crosses the 0.10 budget
  assert.equal(m.crouching, true, 'the un-stepped presses were never swallowed');
  // and the flip is real, not just a flag: the capsule and the eye
  // land with it.
  assert.equal(m.height, CROUCH_HEIGHT);
  assert.equal(m.eye[1], m.pos[1] + CROUCH_EYE_HEIGHT);
  // The stand direction flips at the START (DoStand adjusts height
  // first) - same frame as the press, only the eye lags.
  m.update(1 / 120, { ...still(), crouch: true }, 0);
  assert.equal(m.crouching, false);
  assert.equal(m.height, CAPSULE_HEIGHT);
  assert.ok(m.eye[1] < m.pos[1] + EYE_HEIGHT, 'the eye is still rising');
  m.update(0.12, still(), 0);   // the camera window closes
  assert.equal(m.eye[1], m.pos[1] + EYE_HEIGHT);
  // The mirror: ONE edge across a 3-step catch-up frame toggles ONCE.
  const m2 = new PlayerMotor(floored());
  m2.spawn(0, 0, 0);
  m2.update(3 / 60, { ...still(), crouch: true }, 0);
  m2.update(3 / 60, still(), 0);   // 0.05 + 0.05 completes the window
  assert.equal(m2.crouching, true);
  m2.update(3 / 60, still(), 0);
  assert.equal(m2.crouching, true);
});

test('audit18 player F2: a blocked stand-up RETRIES for timerFast 0.10 s, then timerResetAction drops it', () => {
  assert.equal(HEIGHT_TIMER_FAST, 0.10);   // PlayerHeightChanger.timerFast
  const col = stubFloor();
  const m = new PlayerMotor(col);
  m.spawn(0, 0, 0);
  m.update(0.04, { ...still(), crouch: true }, 0);
  m.update(0.08, still(), 0);              // P18: DoCrouch completes at camTimer 0.10
  assert.equal(m.crouching, true);
  assert.equal(m.heightAction, null);      // DoCrouch is never blocked, and it has completed

  // Press stand under a low ceiling: CanStand() fails, so DFU keeps
  // heightAction == DoStanding and retries it on every Update.
  col.blockedStand = true;
  m.update(0.04, { ...still(), crouch: true }, 0);
  assert.equal(m.crouching, true);
  assert.equal(m.heightAction, 'stand');
  assert.equal(m.heightTimer, 0.04);
  m.update(0.04, still(), 0);              // camTimer 0.08 - still inside the window
  assert.equal(m.heightAction, 'stand');
  // The ceiling clears with NO second press: DFU stands the player up.
  col.blockedStand = false;
  m.update(0.04, still(), 0);
  assert.equal(m.crouching, false, 'a blocked stand-up retries inside timerFast');
  assert.equal(m.heightAction, null);
  assert.equal(m.heightTimer, 0);

  // Past 0.10 s the action IS forgotten - DFU does not stand you up
  // minutes later, and a pin that only checked the retry would let a
  // permanent latch through.
  const col2 = stubFloor();
  const m2 = new PlayerMotor(col2);
  m2.spawn(0, 0, 0);
  m2.update(0.04, { ...still(), crouch: true }, 0);
  m2.update(0.08, still(), 0);             // the crouch completes
  col2.blockedStand = true;
  m2.update(0.04, { ...still(), crouch: true }, 0);   // camTimer 0.04
  m2.update(0.04, still(), 0);                        // camTimer 0.08
  assert.equal(m2.heightAction, 'stand');
  m2.update(0.04, still(), 0);                        // camTimer 0.12 >= 0.10
  assert.equal(m2.heightAction, null);
  assert.equal(m2.heightTimer, 0);
  col2.blockedStand = false;
  m2.update(0.04, still(), 0);
  assert.equal(m2.crouching, true, 'the dropped request must not resurrect');
  // Re-pressing during a blocked stand does NOT extend the window:
  // DFU resets camTimer only in timerResetAction.
  const col3 = stubFloor();
  const m3 = new PlayerMotor(col3);
  m3.spawn(0, 0, 0);
  m3.update(0.04, { ...still(), crouch: true }, 0);
  m3.update(0.08, still(), 0);             // the crouch completes
  col3.blockedStand = true;
  m3.update(0.04, { ...still(), crouch: true }, 0);
  m3.update(0.04, { ...still(), crouch: true }, 0);
  assert.equal(m3.heightTimer, 0.08);
  m3.update(0.04, { ...still(), crouch: true }, 0);
  assert.equal(m3.heightAction, null, 'a re-press does not reset camTimer');
});

test('audit18 player F3: IsStandingStill needs GROUNDED, and the swim path compares the STALE land speed', () => {
  const m = new PlayerMotor(floored());
  m.spawn(0, 0, 0);
  for (let f = 0; f < 30; f++) m.update(1 / 60, still(), 0);
  assert.equal(m.grounded, true);
  assert.equal(m.movingLessThanHalfSpeed, true, 'grounded + zero input IS standing still');
  // Jump: airborne with an empty input. DFU's IsStandingStill returns
  // false outright off the ground, so the getter falls through to
  // GetBaseSpeed()/2 >= speed - walk/2 >= walk is false.
  m.update(1 / 60, { ...still(), jump: true }, 0);
  assert.equal(m.grounded, false);
  m.update(1 / 60, still(), 0);
  assert.equal(m.grounded, false);
  assert.equal(m.movingLessThanHalfSpeed, false, 'IsStandingStill is false when not grounded');
  assert.equal(m.speed, walkSpeed(50));

  // Swimming forward at Swimming 30: the port used to feed the SWIM
  // speed (0.4 x walk) into the comparison, which walk/2 clears, so a
  // swimmer was reported as sneak-slow. DFU returns above UpdateSpeed,
  // so the comparison runs against the last LAND speed.
  const pool = stubFloor();
  const m2 = new PlayerMotor(pool, { speed: 50, running: 30, swimming: 30 });
  m2.spawn(0, 0, 0);
  for (let f = 0; f < 10; f++) m2.update(1 / 60, { ...still(), forward: 1 }, 0);
  assert.equal(m2.speed, walkSpeed(50));
  pool.onGround = false;
  m2.swimming = true;
  m2.update(1 / 60, { ...still(), forward: 1 }, 0);   // this frame still ends grounded=false
  m2.update(1 / 60, { ...still(), forward: 1 }, 0);
  assert.equal(m2.grounded, false);
  assert.equal(m2.speed, walkSpeed(50), 'UpdateSpeed never runs on the swim path');
  assert.ok(walkSpeed(50) / 2 >= swimSpeed(walkSpeed(50), 30), 'the swim speed WOULD clear the half line');
  assert.equal(m2.movingLessThanHalfSpeed, false, 'DFU compares the stale LAND speed, not the swim speed');

  // ...and it is the stale field, not a hardcoded false: a player who
  // was SNEAKING when they hit the water keeps sneak speed, and
  // walk/2 >= sneak IS true.
  const pool2 = stubFloor();
  const m3 = new PlayerMotor(pool2, { speed: 50, running: 30, swimming: 30 });
  m3.spawn(0, 0, 0);
  for (let f = 0; f < 10; f++) m3.update(1 / 60, { ...still(), forward: 1, sneak: true }, 0);
  assert.equal(m3.isSneaking, true);
  assert.equal(m3.speed, sneakSpeed(walkSpeed(50)));
  pool2.onGround = false;
  m3.swimming = true;
  m3.update(1 / 60, { ...still(), forward: 1 }, 0);
  m3.update(1 / 60, { ...still(), forward: 1 }, 0);
  assert.equal(m3.grounded, false);
  assert.equal(m3.speed, sneakSpeed(walkSpeed(50)));
  assert.equal(m3.movingLessThanHalfSpeed, true, 'the stale SNEAK speed still lands under the half line');
});

test('audit18 player F4: CorpseActivationDistance is 150 classic units, not the 128 default', () => {
  assert.equal(CORPSE_ACTIVATION_DISTANCE, 150 * GLOBAL_SCALE);
  assert.equal(CORPSE_ACTIVATION_DISTANCE, 3.75);
  assert.equal(DEFAULT_ACTIVATION_DISTANCE, 3.2);
  const clear = { raycast: () => Infinity };
  // A body whose AABB entry sits at 3.45 - past the 128-unit default,
  // inside the 150-unit corpse reach.
  const corpseAt = (d) => ({ aabb: { min: [-0.05, -0.05, d], max: [0.05, 0.05, d + 0.1] } });
  const eye = [0, 0, 0];
  const fwd = [0, 0, 1];
  assert.equal(pickActivatable(eye, fwd,
    [{ key: 'corpse:0', ...corpseAt(3.45), distance: CORPSE_ACTIVATION_DISTANCE }], clear), 'corpse:0');
  // The reach the port actually gave corpses before this fix.
  assert.equal(pickActivatable(eye, fwd,
    [{ key: 'corpse:0', ...corpseAt(3.45) }], clear), null);
  // The gate still bites past 3.75 - a "fix" that removed it is caught.
  assert.equal(pickActivatable(eye, fwd,
    [{ key: 'corpse:0', ...corpseAt(3.9), distance: CORPSE_ACTIVATION_DISTANCE }], clear), null);
});
