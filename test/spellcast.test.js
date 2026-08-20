// S4b: saving throw, magnitude, damage-family resolution, the
// CastSpell action cooldown - all verbatim, deterministic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  savingThrow, careerTolerance, rollMagnitude,
  isDamageHealthEffect, missileArchive, EFFECT_FLAGS,
  CASTSPELL_COOLDOWN_TICK, MISSILE_SPEED,
} from '../src/systems/spellcast.js';
import { applySpell } from '../src/systems/effects.js';
import { ActionSystem } from '../src/world/actionSystem.js';
import { ACTION_FLAGS } from '../src/world/rdbLayout.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

test('spellcast: saving throw verbatim (tolerances, clamp, proration)', () => {
  const T = { stats: { willpower: 50 }, career: {} };   // MagicResist 5, base 50 -> 55
  // roll 56 (> 55): full damage
  assert.equal(savingThrow(0, EFFECT_FLAGS.Fire, T, 0, seq(0.55)), 100);
  // roll 55 == saving: prorated 100 - 5*(55-55) = 100
  assert.equal(savingThrow(0, EFFECT_FLAGS.Fire, T, 0, seq(0.54)), 100);
  // roll 40: within 20 -> 100 - 5*15 = 25
  assert.equal(savingThrow(0, EFFECT_FLAGS.Fire, T, 0, seq(0.39)), 25);
  // roll 30: beyond 20 under -> 0
  assert.equal(savingThrow(0, EFFECT_FLAGS.Fire, T, 0, seq(0.29)), 0);
  // fire-immune career: +50 -> >= 100 pre-MagicResist -> perfect immunity 0
  const imm = { stats: { willpower: 50 }, career: { immunityFlags: EFFECT_FLAGS.Fire } };
  assert.equal(careerTolerance(imm.career, EFFECT_FLAGS.Fire), 'Immune');
  assert.equal(savingThrow(0, EFFECT_FLAGS.Fire, imm, 0, seq(0.99)), 0);
  // critical weakness: 50-50 = 0 -> +5 willpower -> clamp floor 5
  const weak = { stats: { willpower: 0 }, career: { criticalWeaknessFlags: EFFECT_FLAGS.Fire } };
  assert.equal(savingThrow(0, EFFECT_FLAGS.Fire, weak, 0, seq(0.05)), 100);   // roll 6 > 5
  // resistance precedence beats immunity in the same byte set
  const both = { resistanceFlags: EFFECT_FLAGS.Fire, immunityFlags: EFFECT_FLAGS.Fire };
  assert.equal(careerTolerance(both, EFFECT_FLAGS.Fire), 'Resistant');
});

test('spellcast: magnitude + damage-family resolution', () => {
  const e = { type: 4, subType: 0, magnitudeBaseLow: 5, magnitudeBaseHigh: 15, magnitudeLevelBase: 2, magnitudeLevelHigh: 4, magnitudePerLevel: 3 };
  // caster level 7: floor(7/3)=2; base roll 0 -> 5; plus roll 0 -> 2 -> 5 + 2*2 = 9
  assert.equal(rollMagnitude(e, 7, seq(0)), 9);
  assert.equal(rollMagnitude(e, 7, seq(0.999)), 15 + 4 * 2);
  assert.equal(rollMagnitude({ ...e, magnitudePerLevel: 0 }, 5, seq(0)), 5 + 2 * 5);   // per 0 guarded to 1
  assert.ok(isDamageHealthEffect({ type: 4, subType: 0 }));
  assert.ok(isDamageHealthEffect({ type: 1, subType: 0 }));
  assert.ok(!isDamageHealthEffect({ type: 4, subType: 1 }));
  assert.equal(missileArchive(0), 375);
  assert.equal(missileArchive(4), 379);
  // full apply, GetMagnitude order (S15): magnitude rolls 0,0 -> 9,
  // THEN the save (0.99 -> lands full). Create Item (2,255) is
  // still outside the library -> skipped (loud); type -1 just drops.
  // (The S19c cures took (3,0) INTO the library - the old fixture.)
  const spell = { element: 0, rangeType: 2, effects: [e, { type: 2, subType: 255 }, { type: -1, subType: -1 }] };
  const T = { stats: { willpower: 50 }, career: {} };
  let hurt = 0;
  const r = applySpell(spell, 7, T, { hurt: (n) => { hurt += n; } }, seq(0, 0, 0.99));
  assert.equal(hurt, 9);
  assert.equal(r.skipped, 1);
});

test('spellcast: the CastSpell action cooldown gate fires through the sink', () => {
  const fired = [];
  const sys = new ActionSystem({ addMesh() {}, removeMesh() {}, removeBucket() {} }, {
    castSpell: (index, origin) => fired.push([index, origin]),
  });
  const o = sys.addEffect(0, 5, { actionFlag: ACTION_FLAGS.CastSpell, index: 12, magnitude: 0, axisRaw: 0, isFlat: false, nextObject: -1 }, [1, 2, 3]);
  sys.receive(o);
  assert.deepEqual(fired, [[12, [1, 2, 3]]]);            // one tick of 45.45 crosses 0 from 0
  assert.ok(CASTSPELL_COOLDOWN_TICK > 45 && MISSILE_SPEED === 25);
  // Verbatim RESET (audit 2026-08-16): the fire sets cooldown back to
  // 1000, so the next fires land on activations 23 and 45 (22 ticks of
  // 45.454546 cross zero: 1000 - 22*45.454546 = -1.2e-5) - NOT on every
  // activation, which the missing reset produced.
  for (let i = 2; i <= 45; i++) sys.receive(o);
  assert.equal(fired.length, 3);
  assert.equal(o.activationCount, 45);
});

test('spellcast: TARGET_TYPES verbatim + resolve vs a foe-shaped entity', async () => {
  const { TARGET_TYPES, EFFECT_FLAGS: EF } = await import('../src/systems/spellcast.js');
  const { applySpell: r } = await import('../src/systems/effects.js');
  assert.deepEqual([...TARGET_TYPES], ['CasterOnly', 'ByTouch', 'SingleTargetAtRange', 'AreaAroundCaster', 'AreaAtRange']);
  // a fire-immune FOE entity (CFG career bytes) shrugs the fireball
  const foe = { stats: { willpower: 50 }, career: { immunityFlags: EF.Fire } };
  const e = { type: 4, subType: 0, magnitudeBaseLow: 10, magnitudeBaseHigh: 10, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 };
  let a = 0;
  r({ element: 0, rangeType: 2, effects: [e] }, 5, foe, { hurt: (n) => { a += n; } }, seq(0, 0, 0.99));
  assert.equal(a, 0);                                    // fire-immune: nothing lands
  const soft = { stats: { willpower: 0 }, career: {} };
  r({ element: 0, rangeType: 2, effects: [e] }, 5, soft, { hurt: (n) => { a += n; } }, seq(0, 0, 0.99));
  assert.ok(a > 0);
});

test('spellcast: cast ranges II - the AIM-DIRECTED touch cast + area sweep (pure)', async () => {
  // L2-slice (AUDIT 23 magic-7): ByTouch is a 0.25-radius sphere-cast
  // 3.0 units ALONG THE AIM (DaggerfallMissile.cs:61-62, :409-425),
  // not a nearest-in-any-direction radius pick.
  const { pickTouchTarget, sweepFoes, EXPLOSION_RADIUS, TOUCH_RANGE, TOUCH_SPHERE_CAST_RADIUS } = await import('../src/systems/spellcast.js');
  assert.equal(EXPLOSION_RADIUS, 4.0);
  assert.equal(TOUCH_RANGE, 3.0);
  assert.equal(TOUCH_SPHERE_CAST_RADIUS, 0.25);
  const mk = (x, z, dead = false) => ({ dead, ai: { feet: [x, 0, z] } });
  const eye = [0, 0.9, 0], fwd = [0, 0, 1];     // mid-capsule height: foes' centers sit at y 0.9 too
  const ahead = mk(0, 2), far = mk(0, 6), corpse = mk(0, 1, true), nearer = mk(0, 1.5);
  assert.equal(pickTouchTarget(eye, fwd, [far]), null, 'beyond the 3.0 range');
  // the FIRST hit along the ray wins; corpses skip
  assert.equal(pickTouchTarget(eye, fwd, [ahead, nearer, corpse]), nearer);
  // THE law the old radius pick got wrong: a foe BEHIND the caster is
  // within 2.5 units but the aim ray never touches it
  const behind = mk(0, -1.5);
  assert.equal(pickTouchTarget(eye, fwd, [behind]), null, 'touch reaches along the AIM only');
  // off-axis: inside the swept cylinder (0.25 + the 0.45 body) hits,
  // outside misses
  assert.ok(pickTouchTarget(eye, fwd, [mk(0.5, 2)]), '0.5 off-axis sits inside 0.7');
  assert.equal(pickTouchTarget(eye, fwd, [mk(1.0, 2)]), null, '1.0 off-axis is outside the sweep');
  assert.equal(pickTouchTarget(eye, fwd, [ahead], () => false), null, 'LOS gate holds');
  const hits = sweepFoes([0, 0.9, 0], EXPLOSION_RADIUS, [ahead, far, corpse, nearer]);
  assert.deepEqual(hits, [ahead, nearer]);                                    // 2 and 1.5 in; 6 out; dead out
});
