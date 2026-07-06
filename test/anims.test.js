import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOUSE_DIRECTIONS, DIRECTION_TO_STRIKE, STRIKES, ATTACKS_1H, ATTACKS_2H, ATTACKS_RANGED, sampleClip } from '../src/characters/anims.js';
import { WEAPON_STATES, getMeleeWeaponAnimTime, getBowCooldownTime, gestureDirection, canChangeState, createWeaponMachine, machineAttack, machineStep, MELEE_NUM_FRAMES, HIT_FRAME_MELEE, HIT_FRAME_BOW, BOW_SOUND_FRAME, MAX_BOW_HELD_DRAWN_SECONDS, ATTACK_THRESHOLD, EQUIP_DELAY_TIMES, CLASSIC_FRAME_UPDATE, ARROW_MOVEMENT_SPEED, ARROW_ARM_LENGTH } from '../src/characters/weaponStates.js';

// Witness against DFU: WeaponManager.MouseDirections order and
// FPSWeapon.OnAttackDirection's switch (Up/UpLeft/UpRight -> StrikeUp).
test('anims: verbatim DFU direction mapping + well-formed clips', () => {
  assert.deepEqual([...MOUSE_DIRECTIONS], ['None', 'UpLeft', 'Up', 'UpRight', 'Left', 'Right', 'DownLeft', 'Down', 'DownRight']);
  assert.deepEqual(DIRECTION_TO_STRIKE, {
    Down: 'StrikeDown', DownLeft: 'StrikeDownLeft', Left: 'StrikeLeft',
    Right: 'StrikeRight', DownRight: 'StrikeDownRight',
    Up: 'StrikeUp', UpLeft: 'StrikeUp', UpRight: 'StrikeUp',
  });
  assert.deepEqual([...STRIKES].sort(), Object.keys(ATTACKS_1H).sort());
  assert.deepEqual([...STRIKES].sort(), Object.keys(ATTACKS_2H).sort());
  assert.deepEqual(Object.keys(ATTACKS_RANGED), ['Release']);   // bows: one direction-agnostic loose
  for (const [name, clip] of [...Object.entries(ATTACKS_1H), ...Object.entries(ATTACKS_2H), ...Object.entries(ATTACKS_RANGED)]) {
    assert.ok(clip.dur > 0.2 && clip.dur < 1.0, `${name} dur`);
    for (const [path, keys] of Object.entries(clip.tracks)) {
      assert.ok(keys.length >= 2, `${name}.${path} too few keys`);
      assert.equal(keys[0][1], 0, `${name}.${path} must start at 0 (delta clip)`);
      assert.equal(keys[keys.length - 1][1], 0, `${name}.${path} must end at 0`);
      let prev = -1;
      for (const [t, v, e] of keys) {
        assert.ok(t >= 0 && t <= 1 && t > prev, `${name}.${path} keys unsorted`);
        assert.ok(Number.isFinite(v) && Math.abs(v) < Math.PI, `${name}.${path} value ${v}`);
        if (e !== undefined) assert.ok(['smooth', 'snap', 'out', 'lin', 'hold'].includes(e), `${name}.${path} ease ${e}`);
        prev = t;
      }
    }
  }
});

test('anims: sampler is a continuous delta (zero at entry, null past dur)', () => {
  const clip = ATTACKS_1H.StrikeRight;
  const start = sampleClip(clip, 0);
  for (const k of ['twist', 'lean']) if (k in start) assert.equal(start[k], 0);
  for (const limb of ['armL', 'armR']) if (start[limb]) for (const v of Object.values(start[limb])) assert.equal(v, 0);
  const held = sampleClip(clip, 0.28 * clip.dur);   // inside the loaded beat (0.24..0.32)
  assert.ok(Math.abs(held.armL.handYaw - -0.565) < 0.01, `hold value: ${held.armL.handYaw}`);
  // 'snap' (u^3) back-loads the segment: just past the beat the value
  // has barely moved; near the impact key it has nearly arrived.
  const early = sampleClip(clip, 0.36 * clip.dur).armL.handYaw;
  const late = sampleClip(clip, 0.475 * clip.dur).armL.handYaw;
  assert.ok(Math.abs(early - -0.58) < 0.05, `snap should idle early: ${early}`);
  assert.ok(late > 0.30, `snap should arrive late: ${late}`);
  // root motion is real: the thrust's lunge peaks past 0.20 forward
  const lunge = sampleClip(ATTACKS_1H.StrikeUp, 0.46 * ATTACKS_1H.StrikeUp.dur).rootZ;
  assert.ok(lunge > 0.20, `thrust lunge: ${lunge}`);
  // 2H: the ram lunges harder, and the SOLVED armR track is live
  // mid-clip (station-coupled off hand, not a frozen arm).
  const ram = sampleClip(ATTACKS_2H.StrikeUp, 0.49 * ATTACKS_2H.StrikeUp.dur);
  assert.ok(ram.rootZ > 0.24, `ram lunge: ${ram.rootZ}`);
  assert.ok(Number.isFinite(ram.armR.sw) && Math.abs(ram.armR.sw) > 0.05, `solved armR mid-clip: ${ram.armR.sw}`);
  // DFU-VERBATIM weapon-state machine (WeaponManager/FPSWeapon/
  // FormulaHelper): tick + cooldown formulas, gesture radials, hit
  // frames, the interrupt rule, the bow draw-hold-loose-cooldown arc.
  assert.deepEqual(WEAPON_STATES, ['Idle', 'StrikeDown', 'StrikeDownLeft', 'StrikeLeft', 'StrikeRight', 'StrikeDownRight', 'StrikeUp']);
  assert.equal(CLASSIC_FRAME_UPDATE, 980);
  assert.ok(Math.abs(getMeleeWeaponAnimTime(50) - 0.19898) < 1e-4);
  assert.ok(Math.abs(getBowCooldownTime(50) - 1300 / 980) < 1e-4);
  assert.equal(ATTACK_THRESHOLD, 0.05);
  assert.equal(EQUIP_DELAY_TIMES.length, 18);
  assert.deepEqual([0, 90, 180, 220, 270, 320].map(gestureDirection), ['Right', 'Up', 'Left', 'DownLeft', 'Down', 'DownRight']);
  assert.equal(MELEE_NUM_FRAMES.StrikeRight, 5);
  assert.deepEqual([HIT_FRAME_MELEE, HIT_FRAME_BOW, BOW_SOUND_FRAME, MAX_BOW_HELD_DRAWN_SECONDS], [2, 5, 4, 10]);
  assert.equal(canChangeState(false, 'StrikeDown', 'StrikeLeft'), false);   // one-shots don't interrupt
  assert.equal(canChangeState(true, 'StrikeUp', 'StrikeDown'), true);       // except the bow release
  const wmc = createWeaponMachine(false);
  machineAttack(wmc, 'StrikeRight');
  const seen = [];
  let simT = 0;
  while (wmc.state !== 'Idle' && simT < 3) { for (const e of machineStep(wmc, 0.01, 50)) seen.push([e, +simT.toFixed(2)]); simT += 0.01; }
  assert.equal(seen[0][0], 'hit');
  assert.ok(Math.abs(seen[0][1] - 2 * getMeleeWeaponAnimTime(50)) < 0.02, `hit at ${seen[0][1]}`);   // frame 2 arrives ON the 2nd tick (DFU waits a tick, then steps)
  assert.ok(Math.abs(simT - 5 * getMeleeWeaponAnimTime(50)) < 0.03, `strike ${simT}`);
  const bmc = createWeaponMachine(true);
  machineAttack(bmc, 'StrikeUp');
  for (let k = 0; k < 30; k++) machineStep(bmc, 0.0625, 50);
  assert.equal(bmc.frame, 3);                                               // drawn, holding
  machineAttack(bmc, 'StrikeDown');
  const bev = [];
  for (let k = 0; k < 12 && bmc.state !== 'Idle'; k++) bev.push(...machineStep(bmc, 0.0625, 50));
  assert.deepEqual(bev, ['bowSound', 'hit', 'done']);
  assert.equal(machineAttack(bmc, 'StrikeUp'), false);                      // cooldown blocks
  for (let k = 0; k < 40; k++) machineStep(bmc, 0.05, 50);                  // the clock runs while Idle - the cooldown EXPIRES
  assert.equal(machineAttack(bmc, 'StrikeUp'), true);
  // DaggerfallMissile verbatim
  assert.equal(ARROW_MOVEMENT_SPEED, 25.0);
  assert.equal(ARROW_ARM_LENGTH, 0.9);
  assert.ok(Number.isFinite(held.twist));
  assert.equal(sampleClip(clip, clip.dur), null);
  assert.equal(sampleClip(clip, clip.dur * 2), null);
});
