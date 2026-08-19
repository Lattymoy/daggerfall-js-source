// C8 E3d: back-facing wheel (Unity rounding preserved), the backstab
// channels, FP pose composition.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBackFacing } from '../src/characters/enemyMotor.js';
import { calculateAttackDamage, backstabDamage } from '../src/combat/formulas.js';
import { PlayerWeapon } from '../src/combat/playerWeapon.js';
import { POSES } from '../src/characters/poses.js';
import { combinePose } from '../src/characters/animate.js';
import { WEAPONS } from '../src/characters/weapons.js';

const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const at = (deg) => {   // foe at origin facing +z (yaw 0); viewer placed at `deg` off the foe's forward
  const r = deg * Math.PI / 180;
  return isBackFacing(0, [0, 0, 0], [Math.sin(r) * 5, 0, Math.cos(r) * 5]);
};

test('isBackFacing: the 8-orientation wheel, records 3/4 = back, banker boundary', () => {
  assert.equal(at(0), false);       // dead ahead of the foe = front
  assert.equal(at(90), false);      // side (record 2)
  assert.equal(at(112.4), false);
  assert.equal(at(112.5), false);   // 2.5 rounds to EVEN 2 (Unity Mathf.RoundToInt)
  assert.equal(at(113), true);      // orientation 3 = back arc
  assert.equal(at(157.5), true);    // 3.5 rounds to EVEN 4
  assert.equal(at(180), true);      // dead behind
  assert.equal(at(-135), true);     // sign-symmetric
  assert.equal(at(-90), false);
});

test('backstab: chance rides chanceToHitMod, x3 rides the post-calc roll', () => {
  const A = { isPlayer: true, level: 1, skills: 30, stats: { strength: 50, agility: 50, luck: 50 } };
  const T = { isPlayer: false, isClass: false, careerIndex: 0, armor: 0, skills: 0, minMetalToHit: -1, stats: { strength: 50, agility: 50, luck: 50 } };
  const dagger = { templateIndex: WEAPONS.Dagger, material: 0, flags: 0x10 };
  // rolls: [struck, crit(fail .99), hitRoll, damageRoll, backstabRoll]
  // MEASURED chain (F1/F3): skill 30 + weaponToHit(iron -1 x10 = -10)
  // + adjustments(+40 monster - 50 = -10) = 10
  assert.equal(calculateAttackDamage(A, T, { weapon: dagger, rolls: seq(0, 0.99, 0.09, 0.999, 0.99) }), 5);   // 9 < 10 hits: 6 -1 iron
  assert.equal(calculateAttackDamage(A, T, { weapon: dagger, rolls: seq(0, 0.99, 0.10, 0, 0.99) }), 0);       // 10 misses
  // backstab 30 joins chanceToHitMod: 10 + 30 = 40 -> .30 hits
  const d = calculateAttackDamage(A, T, { weapon: dagger, backstabChance: 30, rolls: seq(0, 0.99, 0.30, 0.999, 0.10) });
  // dagger max 6, +0 str, -1 iron = 5; backstab roll .10 < 30 -> x3 = 15
  assert.equal(d, 15);
  const noTriple = calculateAttackDamage(A, T, { weapon: dagger, backstabChance: 30, rolls: seq(0, 0.99, 0.30, 0.999, 0.50) });
  assert.equal(noTriple, 5);
  assert.equal(backstabDamage(7, 0, 0.0), 7);   // no chance, no triple
});

test('FP pose: fpMelee1H base composited with the FP sweep on the machine clock', () => {
  const w = new PlayerWeapon({});
  assert.deepEqual(w.pose(), POSES.fpMelee1H);          // idle = the base
  w.gesture(0, 60, true, 0.016, 1000);                  // StrikeDown starts
  const p = w.pose();
  assert.notDeepEqual(p, POSES.fpMelee1H);              // clip deltas applied
  assert.equal(p.gaitArm, 0);                           // clips own the arms (couplings zeroed)
  // combinePose: deltas are additive and zero-safe
  const c = combinePose({ lean: 0.1, armL: { sw: 1, bd: 0 } }, { lean: 0.05, armL: { sw: -0.2 } });
  assert.ok(Math.abs(c.lean - 0.15) < 1e-9);
  assert.ok(Math.abs(c.armL.sw - 0.8) < 1e-9);
});
