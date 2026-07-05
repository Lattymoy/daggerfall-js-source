import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POSES } from '../src/characters/poses.js';

// The pose transform contract (see poses.js): sagittal angles in
// radians, sw about the limb root, bd about the mid joint. Guard the
// table shape + sane ranges so a bad edit can't ship a folded rig.
test('poses: melee1H is well-formed within joint ranges', () => {
  const p = POSES.melee1H;
  assert.ok(p, 'melee1H missing');
  for (const limb of ['armL', 'armR', 'legL', 'legR']) {
    const a = p[limb];
    assert.ok(a, `melee1H.${limb} missing`);
    assert.ok(Number.isFinite(a.sw) && Number.isFinite(a.bd), `${limb} non-finite`);
    assert.ok(Math.abs(a.sw) < Math.PI / 2, `${limb}.sw out of range: ${a.sw}`);
    assert.ok(a.bd >= 0 && a.bd < Math.PI, `${limb}.bd out of range: ${a.bd}`);
    for (const k of ['spread', 'handRoll', 'handPitch', 'handYaw'])
      if (k in a) assert.ok(Number.isFinite(a[k]) && Math.abs(a[k]) <= Math.PI, `${limb}.${k} out of range`);
  }
  for (const k of ['lean', 'gaitArm', 'gaitElbow'])
    if (k in p) assert.ok(Number.isFinite(p[k]) && Math.abs(p[k]) <= 1, `pose.${k} out of range`);
});
