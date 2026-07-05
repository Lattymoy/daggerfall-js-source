import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOUSE_DIRECTIONS, DIRECTION_TO_STRIKE, STRIKES, ATTACKS_1H, sampleClip } from '../src/characters/anims.js';

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
  for (const [name, clip] of Object.entries(ATTACKS_1H)) {
    assert.ok(clip.dur > 0.2 && clip.dur < 1.0, `${name} dur`);
    for (const [path, keys] of Object.entries(clip.tracks)) {
      assert.ok(keys.length >= 2, `${name}.${path} too few keys`);
      assert.equal(keys[0][1], 0, `${name}.${path} must start at 0 (delta clip)`);
      assert.equal(keys[keys.length - 1][1], 0, `${name}.${path} must end at 0`);
      let prev = -1;
      for (const [t, v] of keys) {
        assert.ok(t >= 0 && t <= 1 && t > prev, `${name}.${path} keys unsorted`);
        assert.ok(Number.isFinite(v) && Math.abs(v) < Math.PI, `${name}.${path} value ${v}`);
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
  const mid = sampleClip(clip, 0.30 * clip.dur);
  assert.ok(Math.abs(mid.armL.handYaw - -1.15) < 1e-9, `keyframe hit: ${mid.armL.handYaw}`);
  assert.ok(Number.isFinite(mid.twist));
  assert.equal(sampleClip(clip, clip.dur), null);
  assert.equal(sampleClip(clip, clip.dur * 2), null);
});
