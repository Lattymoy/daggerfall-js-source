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
  // AUDIT 28 W11: 0.05 is WeaponManager's FIELD default (:54); the live
  // gate is Settings.WeaponAttackThreshold (shipped 0.005), so these
  // trail-vs-sum pins pass the field constant explicitly.
  assert.equal(ATTACK_THRESHOLD, 0.05);
  // 55 right then 50 left: the trail is 105 (0.0875 > 0.05) and the SUM
  // is +5 - DFU swings Right; the old |sum| gate saw 5 and refused.
  assert.equal(pw.gesture(55, 0, true, 1 / 60, DIM, { attackThreshold: ATTACK_THRESHOLD }), null, '55/1200 is under the threshold');
  const strike = pw.gesture(-50, 0, true, 1 / 60, DIM, { attackThreshold: ATTACK_THRESHOLD });
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
  for (let i = 0; i < 60 && !fired; i++) fired = pw.gesture(0.9, 0, true, 1 / 60, DIM, { attackThreshold: ATTACK_THRESHOLD });
  assert.equal(fired, null, '54/1200 never crossed 0.05 in the first second');
  // then it quickens to 1.5px a frame. DFU's window still holds the
  // tail of the slow drag, so 54 + 0.6 per frame crosses 60 ten frames
  // in - at t = 1.167s, well before a from-scratch 60px could.
  let frames = 0;
  while (!fired && frames < 40) { fired = pw.gesture(1.5, 0, true, 1 / 60, DIM, { attackThreshold: ATTACK_THRESHOLD }); frames++; }
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

test('audit24 combat: the bow RISE edge, the tracking reset, and the angle sign', () => {
  // Four live mutants from the campaign, all in the gesture door.
  const DIM = 1200;

  // THE BOW EDGE is an AND: held AND not-already-held. C# fires only
  // "after the button was RELEASED since the last shot"
  // (lastAttackHand == Hand.None), so an OR - or a missing edge - turns
  // one held button into a machine gun.
  const bow = new PlayerWeapon({ weapon: { name: 'Long Bow', templateIndex: 130 }, liveSpeed: 50 });
  bow.sheathed = false;
  bow.update(0);
  assert.equal(bow.machine.isBow, true, 'a bow is a bow');
  assert.equal(bow.gesture(0, 0, true, 1 / 60, DIM), 'StrikeDown', 'the press fires');
  // and hold it for well past the cooldown (~1.33s at liveSpeed 50) -
  // the cooldown alone would mask a missing edge for the first second
  let extra = 0;
  for (let i = 0; i < 200; i++) {
    bow.update(1 / 60);
    if (bow.gesture(0, 0, true, 1 / 60, DIM)) extra++;
  }
  assert.equal(extra, 0, 'HOLDING it fires nothing more - the edge is the whole rule');
  // release, then press again
  assert.equal(bow.gesture(0, 0, false, 1 / 60, DIM), null, 'the release itself fires nothing');
  // the bow cooldown at liveSpeed 50 is ~1.33s - clear it properly
  for (let i = 0; i < 120; i++) bow.update(1 / 60);
  assert.equal(bow.gesture(0, 0, true, 1 / 60, DIM), 'StrikeDown', 'and the NEXT press fires again');

  // THE TRACKING RESET is `if (!this._tracking)` - the frame tracking
  // STARTS clears the trail, so motion from before the button went
  // down cannot count.
  //
  // AN HONEST NON-KILL: the campaign flips that `!`, and no test can
  // catch it. The un-held branch one line up ALREADY clears on every
  // frame the button is up, so the trail is always empty when tracking
  // starts and the second clear is defensive. It is kept because C#
  // keeps it (:312, :328 - "Reset tracking if user not holding down"),
  // not because anything can tell.
  const pw = new PlayerWeapon({ weapon: SABER, liveSpeed: 50 });
  pw.sheathed = false;
  pw.update(0);
  // drag with the button UP: nothing accumulates, nothing fires
  for (let i = 0; i < 30; i++) assert.equal(pw.gesture(20, 0, false, 1 / 60, DIM, { attackThreshold: ATTACK_THRESHOLD }), null);
  // now hold: the trail starts from zero on this frame, so one 20px
  // step is under the 60px gate
  assert.equal(pw.gesture(20, 0, true, 1 / 60, DIM, { attackThreshold: ATTACK_THRESHOLD }), null, 'the first held frame starts a FRESH trail');
  // and three more cross it - which is only possible if the clear does
  // NOT run again on frames two and three
  let fired = null;
  for (let i = 0; i < 3 && !fired; i++) fired = pw.gesture(20, 0, true, 1 / 60, DIM, { attackThreshold: ATTACK_THRESHOLD });
  assert.equal(fired, 'StrikeRight', 'the trail accumulates once tracking has started');

  // THE ANGLE is degrees: `atan2 * 180 / PI`, screen-up positive. The
  // bands are 15-degree sectors (`ceil(a / 15)`), so a 181 there
  // rotates every boundary by half a percent - invisible at a cardinal
  // and decisive at a SEAM. The Right/Up seam sits at exactly 15
  // degrees.
  const swipe = (dx, dy) => {
    const p = new PlayerWeapon({ weapon: SABER, liveSpeed: 50 });
    p.sheathed = false;
    p.update(0);
    let out = null;
    for (let i = 0; i < 8 && !out; i++) out = p.gesture(dx, dy, true, 1 / 60, DIM);
    return out;
  };
  assert.equal(swipe(20, 0), 'StrikeRight', 'right');
  assert.equal(swipe(-20, 0), 'StrikeLeft', 'left');
  // dy is SCREEN space (down positive), and the angle negates it
  assert.equal(swipe(0, 20), 'StrikeDown', 'a downward drag is a down strike');
  // 14.95 degrees: Right under 180, and Up under a 181 (14.95 * 181/180
  // = 15.033, over the seam)
  const rad = (14.95 * Math.PI) / 180;
  assert.equal(swipe(25 * Math.cos(rad), -25 * Math.sin(rad)), 'StrikeRight',
    'just under the 15-degree seam is still Right - a 181 would have made it Up');

  // THE CLEAR really zeroes the travel. The gate is
  // travel / longestDim < 0.05, so 60px on a 1200 dim; a clear that
  // left 1 behind would fire a swing one pixel early, every time.
  const edge = new PlayerWeapon({ weapon: SABER, liveSpeed: 50 });
  edge.sheathed = false;
  edge.update(0);
  let out = null;
  for (let i = 0; i < 7 && !out; i++) out = edge.gesture(8.5, 0, true, 1 / 60, DIM, { attackThreshold: ATTACK_THRESHOLD });
  assert.equal(out, null, '59.5px of trail is under the 60px gate - and 1 left over would not be');
  assert.equal(edge.gesture(1, 0, true, 1 / 60, DIM, { attackThreshold: ATTACK_THRESHOLD }), 'StrikeRight', 'and 60.5 crosses it');
});
