// AUDIT 24 (the full-codebase parity sweep), combat + formats.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerWeapon } from '../src/combat/playerWeapon.js';
import {
  createWeaponMachine, machineCancelBowDraw, machineAttack,
  getBowCooldownTime, MAX_GESTURE_SECONDS, ATTACK_THRESHOLD,
} from '../src/characters/weaponStates.js';

const SABER = { name: 'Saber', templateIndex: 117 };

test('audit24 combat: the swing gate is the TRAIL length, not the sum', () => {
  // Gesture keeps _sum (for the angle) and TravelDist (for the gate),
  // and its own comment says they differ "because the trail may bend"
  // (WeaponManager.cs:99-100); :808 compares TravelDist/_longestDim.
  const pw = new PlayerWeapon({ weapon: SABER, liveSpeed: 50 });
  pw.sheathed = false;
  pw.update(0);
  const DIM = 1200;
  assert.equal(ATTACK_THRESHOLD, 0.05);
  // 55 right then 50 left: the trail is 105 (0.0875 > 0.05) and the SUM
  // is +5 - DFU swings Right; the old |sum| gate saw 5 and refused.
  assert.equal(pw.gesture(55, 0, true, 1 / 60, DIM), null, '55/1200 is under the threshold');
  const strike = pw.gesture(-50, 0, true, 1 / 60, DIM);
  assert.equal(strike, 'StrikeRight', 'the bent trail fires, with the direction from the SUM');
});

test('audit24 combat: MaxGestureSeconds is a sliding window, not a hard reset', () => {
  // TrimOld (:111-123) drops only the points OLDER than the window and
  // subtracts each from the sum and the travel; Add calls it first
  // (:133). So motion from 0.9s ago still counts at t=1.0s, and the
  // gate is met by any rolling one-second window. The port zeroed the
  // WHOLE accumulator at each 1s boundary - the current frame's motion
  // with it - so a drag that quickens after a slow first second had to
  // earn the entire threshold again from nothing.
  assert.equal(MAX_GESTURE_SECONDS, 1.0);
  const DIM = 1200;
  const pw = new PlayerWeapon({ weapon: SABER, liveSpeed: 50 });
  pw.sheathed = false;
  pw.update(0);
  // second one: 0.9px a frame - 54px of trail, under the 60px gate
  let fired = null;
  for (let i = 0; i < 60 && !fired; i++) fired = pw.gesture(0.9, 0, true, 1 / 60, DIM);
  assert.equal(fired, null, '54/1200 never crossed 0.05 in the first second');
  // then it quickens to 1.5px a frame. DFU's window still holds the
  // tail of the slow drag, so 54 + 0.6 per frame crosses 60 ten frames
  // in - at t = 1.167s, well before a from-scratch 60px could.
  let frames = 0;
  while (!fired && frames < 40) { fired = pw.gesture(1.5, 0, true, 1 / 60, DIM); frames++; }
  assert.equal(fired, 'StrikeRight', 'the slow first second still counted');
  assert.ok(frames <= 12, `crossed on frame ${frames} - 54 + 0.6 a frame, not from zero`);
  // From nothing it would take 60/1.5 = 40 frames, which is what the
  // hard reset made the player do.
  assert.ok(frames < 40);
});

test('audit24 combat: a CANCELLED bow draw charges the full cooldown', () => {
  // The un-draw leaves isAttacking true (WeaponManager.cs:355-357), so
  // the next Update's not-attacking reset charges the bow cooldown
  // (:220-222) exactly as a loosed arrow does.
  const m = createWeaponMachine(true);
  assert.ok(machineAttack(m, 'StrikeUp'), 'the draw starts');
  assert.equal(machineCancelBowDraw(m, 50), true);
  assert.equal(m.state, 'Idle');
  assert.equal(m.cooldownUntil, m.now + getBowCooldownTime(50));
  assert.ok(getBowCooldownTime(50) > 1.3, 'that is 1.327s at LiveSpeed 50');
  // ...and the guard really refuses the next draw until it expires
  assert.equal(machineAttack(m, 'StrikeUp'), false, 'no re-draw on the very next frame');
  m.now = m.cooldownUntil;
  assert.equal(machineAttack(m, 'StrikeUp'), true, 'and it opens again when the cooldown is up');
});
