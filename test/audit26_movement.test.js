// AUDIT 26 - the movement cluster (F026, F027, F028/F029, F031, F032).
//
// F026: HandleJumpInput's WasClimbing BYPASS of the bunny-hop clock
//       (AcrobatMotor.cs:76) - the flag had been written every step
//       with no reader anywhere in src/.
// F027: LevitateMotor's over-encumbered swimmer is dragged DOWN and
//       the sink REPLACES the float keys (:83-85).
// F028/F029: PlayerHeightChanger's two forced-stand arms - a crouched
//       LEVITATOR (:137-145) and every frame while CLIMBING
//       (:184-191), plus the `!levitating` gate on the crouch block.
// F031: the descent arm is Crouch OR FloatDown (:88-89); every host
//       passed FloatDown alone.
// F032: slowFallSpeed rides UNITY's 0.02 fixed step, not the port's
//       1/60 - a flat 2.1 m/s (pinned in motorStairs).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PlayerMotor, GROUNDED_JUMP_GATE_S, OVER_ENCUMBERED_LIMIT, SLOWFALL_VELOCITY } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function floored() {
  const col = new Collider(() => 0);
  col.addMesh('floor', new Float32Array([-10, 0, -10, 10, 0, -10, 10, 0, 10, -10, 0, 10]), [0, 1, 2, 0, 2, 3], I);
  return col;
}
const still = (over = {}) => ({ forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, ...over });

// ── F026 ──────────────────────────────────────────────────────────

test('F026: a player who WAS climbing jumps with zero grounded time', () => {
  // The bypass fires on the frame a climb ENDS: climb.step() sets
  // wasClimbing := isClimbing (climbing.js, ClimbingMotor.cs:390) and
  // then aborts, so the gate below reads true that once. An ACTIVE
  // climb returns before the gate; the frame after, wasClimbing has
  // already fallen to false.
  const mk = () => {
    const m = new PlayerMotor(floored(), { speed: 50, running: 30 }, {
      climbing: { inputs: () => ({ climbing: 50, luck: 50 }), tally: () => {}, rolls: () => 0, say: () => {} },
    });
    m.spawn(0, 0, 0);
    m.update(1 / 60, still(), 0);        // land
    m.groundedTime = 0;                   // a fresh landing - inside the 0.1s clock
    return m;
  };
  assert.ok(GROUNDED_JUMP_GATE_S > 0);

  // no climb behind it: the bunny-hop gate refuses
  const cold = mk();
  cold.update(1 / 60, still({ jump: true }), 0);
  assert.equal(cold.climb.wasClimbing, false);
  assert.ok(cold.velY <= 0, 'the plain gate still blocks an instant re-jump');

  // aborting a climb onto ground and pressing Jump: DFU goes at once
  const warm = mk();
  warm.climb.isClimbing = true;
  warm.update(1 / 60, still({ jump: true }), 0);
  assert.equal(warm.climb.isClimbing, false, 'the climb ended this frame');
  assert.equal(warm.climb.wasClimbing, true, 'and left the flag the gate reads');
  assert.ok(warm.velY > 0, 'WasClimbing bypasses the grounded clock');
});

test('F026: the bypass does not open the gate for everything else', () => {
  const m = new PlayerMotor(floored());
  m.spawn(0, 0, 0);
  m.update(1 / 60, still(), 0);
  m.groundedTime = 0;
  // a CLIMBLESS motor (no deps mounted) has no climb state at all -
  // the optional chain must answer falsy, not throw or pass.
  assert.equal(m.climb, null);
  m.update(1 / 60, still({ jump: true }), 0);
  assert.ok(m.velY <= 0, 'no climb state, no bypass');
  // past the clock it jumps as always
  m.groundedTime = GROUNDED_JUMP_GATE_S;
  m.update(1 / 60, still({ jump: true }), 0);
  assert.ok(m.velY > 0);
});

// ── F027 ──────────────────────────────────────────────────────────

test('F027: an over-encumbered swimmer is dragged down, and the sink REPLACES the keys', () => {
  // overEncumbered = CarriedWeight * 4 > 250 (:83) - 62.5 kg.
  assert.equal(OVER_ENCUMBERED_LIMIT, 250);
  const mk = (kg) => {
    const m = new PlayerMotor(floored(), { speed: 50, running: 30, swimming: 30 }, { carriedWeight: () => kg });
    m.spawn(0, 5, 0);
    m.swimming = true;
    return m;
  };
  const yAfter = (m, input) => { const before = m.pos[1]; m.update(1 / 60, input, 0); return m.pos[1] - before; };

  // light: holding UP surfaces
  const light = mk(10);
  assert.ok(yAfter(light, still({ up: true })) > 0, 'a light swimmer surfaces');

  // heavy: the sink replaces the input - holding UP still goes DOWN
  const heavy = mk(63);   // 63 * 4 = 252 > 250
  assert.ok(yAfter(heavy, still({ up: true })) < 0, 'past 62.5 kg the loaded swimmer cannot surface');

  // the boundary is strict `>`: exactly 62.5 kg is NOT over-encumbered
  const edge = mk(62.5);
  assert.ok(yAfter(edge, still({ up: true })) > 0, '250 is not > 250');

  // levitating, water-walking and climbing all exempt (:83-84)
  const lev = mk(100); lev.levitating = true;
  assert.ok(yAfter(lev, still({ up: true })) > 0, 'levitation exempts');
  const ww = mk(100); ww.waterWalking = true;
  assert.ok(yAfter(ww, still({ up: true })) >= 0, 'water-walking exempts');
});

test('F027: carried weight is the LIVE pack, wired at every host that builds a motor', () => {
  // PlayerEntity.CarriedWeight (:184) is the pack plus gold at
  // 0.0025 kg a piece - which inventory.totalWeight already is,
  // gold being an item in the port rather than a separate counter.
  for (const f of ['scenes/world.js', 'scenes/exterior.js', 'scenes/dungeon.js']) {
    assert.ok(src(f).includes('carriedWeight: () => totalWeight(playerEntity.items ?? [])'), `${f} feeds the live pack`);
  }
});

// ── F028 / F029 ───────────────────────────────────────────────────

test('F028: a crouched LEVITATOR is forced to stand and toggles nothing', () => {
  const m = new PlayerMotor(floored());
  m.spawn(0, 0, 0);
  m.crouching = true;
  m.levitating = true;
  m._heightAction(1 / 60, still());
  assert.equal(m.heightAction, 'stand', 'DoStanding, and DecideHeightAction returns (:137-145)');
  // ...and the crouch KEY cannot re-crouch a levitator: the whole
  // block is gated `!levitating` (:171), so no gap-fitting mid-air.
  const m2 = new PlayerMotor(floored());
  m2.spawn(0, 0, 0);
  m2.levitating = true;
  m2._heightAction(1 / 60, still({ crouch: true }));
  assert.equal(m2.heightAction, null, 'a levitator cannot toggle the 0.9 capsule');
});

test('F029: climbing forces standing every frame, on the MEDIUM clock', () => {
  const m = new PlayerMotor(floored(), { speed: 50, running: 30 }, {
    climbing: { inputs: () => ({ climbing: 50, luck: 50 }), tally: () => {}, rolls: () => 0, say: () => {} },
  });
  m.spawn(0, 0, 0);
  m.crouching = true;
  m.climb.isClimbing = true;
  m._heightAction(1 / 60, still());
  assert.equal(m.heightAction, 'stand', 'a crouched climber is stood up');
  const medium = m.heightTimerMax;
  // the timerMax is set whether or not a stand was needed (:185-186)
  const m2 = new PlayerMotor(floored(), { speed: 50, running: 30 }, {
    climbing: { inputs: () => ({ climbing: 50, luck: 50 }), tally: () => {}, rolls: () => 0, say: () => {} },
  });
  m2.spawn(0, 0, 0);
  m2.climb.isClimbing = true;
  m2._heightAction(1 / 60, still());
  assert.equal(m2.heightAction, null, 'an upright climber needs no stand');
  assert.equal(m2.heightTimerMax, medium, 'but the medium clock is armed either way');
});

// ── F031 / F032 ───────────────────────────────────────────────────

test('F031: every host reads Crouch OR FloatDown for the descent', () => {
  for (const f of ['scenes/world.js', 'scenes/exterior.js', 'scenes/dungeon.js', 'scenes/worldModes.js']) {
    const s = src(f);
    assert.ok(s.includes("down: crouchHeld || held(keys, 'FloatDown')"), `${f} descends on Crouch too`);
    assert.ok(s.includes("up: jumpHeld || held(keys, 'FloatUp')"), `${f} rises on Jump/FloatUp (the mirror)`);
  }
});

test('F032: slow fall is a flat 2.1 m/s - DFU\'s step, not the port\'s', () => {
  // 105 * Unity's 0.02 fixed step, inside FixedUpdate, on a value
  // spent as a velocity (Move(moveDirection * dt)).
  assert.equal(SLOWFALL_VELOCITY, 2.1);
  const m = new PlayerMotor(floored());
  m.spawn(0, 8, 0);
  m.slowFalling = true;
  m.update(1 / 60, still(), 0);
  m.update(1 / 60, still(), 0);
  assert.ok(Math.abs(m.velY + 2.1) < 1e-9, `slowfall velY ${m.velY} = -2.1`);
  // the rate is INDEPENDENT of the caller's step - the old cut
  // multiplied by dt and gave 1.75 at 1/60 (and 2.1 only at 0.02).
  const m2 = new PlayerMotor(floored());
  m2.spawn(0, 8, 0);
  m2.slowFalling = true;
  m2.update(1 / 30, still(), 0);
  m2.update(1 / 30, still(), 0);
  assert.ok(Math.abs(m2.velY + 2.1) < 1e-9, 'the same 2.1 at a 1/30 step');
});
