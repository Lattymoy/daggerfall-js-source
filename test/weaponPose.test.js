import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerWeapon } from '../src/combat/playerWeapon.js';
import { EnemyAttack } from '../src/characters/enemyAttack.js';
import { POSES } from '../src/characters/poses.js';
import { ATTACKS_FP, ATTACKS_1H, sampleClip } from '../src/characters/anims.js';

// Units regression (audit 2026-08-16): sampleClip takes SECONDS
// (u = t / clip.dur; anims tests pin it) but the pose paths passed a
// 0..1 frame PHASE. With FP clip dur 0.50 every strike played its
// first half at 2x and frames 2-4 fell to the base pose; enemy 1H
// clips (dur 0.40-0.66) died at 40-66%. These tests pin the mapping
// phase * clip.dur across the FULL frame range.

test('playerWeapon FP pose: back-half frames sample the clip, not the base', () => {
  const base = POSES.fpMelee1H;
  const w = new PlayerWeapon({});
  w.machine.state = 'StrikeDown';
  for (const frame of [2, 3]) {   // the previously-dead half (phase 0.5, 0.75)
    w.machine.frame = frame;
    const p = w.pose();
    const moved = p.armL.handPitch !== base.armL.handPitch
      || p.armL.handYaw !== base.armL.handYaw
      || (p.lean ?? 0) !== (base.lean ?? 0);
    assert.ok(moved, `frame ${frame} must differ from the base pose`);
  }
  // And the mapping is exactly phase * dur: frame 2 == direct seconds sample.
  w.machine.frame = 2;
  const clip = ATTACKS_FP.StrikeDown;
  const direct = sampleClip(clip, 0.5 * clip.dur);
  assert.equal(w.pose().armL.handPitch, base.armL.handPitch + direct.armL.handPitch);
});

test('enemyAttack pose: late frames sample every 1H clip (short durs included)', () => {
  const a = new EnemyAttack({ liveSpeed: 50, playerLevel: 1, reflexes: 2 });
  for (const state of Object.keys(ATTACKS_1H)) {
    a.machine.state = state;
    a.machine.frame = 3;   // phase 0.75: null under the old phase-as-seconds call for every dur < 0.75
    const p = a.pose();
    assert.ok(p !== null, `${state} frame 3 must sample the clip`);
  }
});
