// ABSORB-NERF (2026-09-30, Discord: "Nerf spell absorption, it breaks the game"). A 100% AbsorbsSpells item (or a
// 100% crafted Spell Absorption) left its wearer all but immune to casters AND refilled their magicka off every bolt.
// The law now: the item enchantment is a 50% roll; the Spell Absorption effect's chance caps at 50% and the Spell
// Maker's chanceBase for it stops at 50; every absorb refunds HALF its points (floored); the career's Always keeps its
// 100% (the Sorcerer has no regen) but refunds half too; the Eye of Mora set is untouched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SPELL_ABSORPTION, tryAbsorption, spellAbsorptionChance, effectCastingCost, absorbRefund,
  ABSORB_ENCHANT_CHANCE, SPELL_ABSORPTION_CHANCE_CAP, ABSORB_REFUND_SCALE, registerAbsorptionChance,
} from '../../src/systems/absorption.js';
import { applySpell } from '../../src/systems/effects.js';
import {
  SPINNER_RANGES, spinnerRange, clampSetting, stepSetting, setSetting, buildCustomSpell, blankEffectSettings,
  SPELL_ABSORPTION_KEY, SPELL_ABSORPTION_CHANCE_BASE_MAX, _resetCustomIndexForTests,
} from '../../src/systems/spell/spellMaker.js';

const damageEffect = (mag = 20) => ({
  type: 4, subType: 0,
  magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
});
const target = (flags = SPELL_ABSORPTION.None, over = {}) => ({
  career: { spellAbsorptionFlags: flags },
  maxMagicka: 100, magicka: 0, level: 1,
  skills: new Array(40).fill(50), stats: { intelligence: 50, willpower: 50 },
  ...over,
});
/** a live Spell Absorption entry */
const absorbBuff = (chanceBase, chanceMod = 0, chancePerLevel = 1) =>
  ({ kind: 'spellAbsorption', chanceBase, chanceMod, chancePerLevel });
const roll = (v) => () => v;   // Math.floor(v * 100) is the d100 the absorb reads

test('ABSORB-NERF: the numbers', () => {
  assert.equal(ABSORB_ENCHANT_CHANCE, 50);
  assert.equal(SPELL_ABSORPTION_CHANCE_CAP, 50);
  assert.equal(ABSORB_REFUND_SCALE, 0.5);
  assert.equal(SPELL_ABSORPTION_CHANCE_BASE_MAX, 50);
});

test('ABSORB-NERF: the AbsorbsSpells enchantment is a 50% roll, not DFU\'s flat always', () => {
  const t = target();
  const cost = effectCastingCost(damageEffect(), 0, t);
  assert.equal(tryAbsorption(damageEffect(), 0, t, { absorbing: true, rolls: roll(0.49) }), cost, 'a 49 absorbs');
  assert.equal(tryAbsorption(damageEffect(), 0, t, { absorbing: true, rolls: roll(0.50) }), 0, 'a 50 passes through');
  assert.equal(tryAbsorption(damageEffect(), 0, t, { absorbing: true, rolls: roll(0.99) }), 0, 'a 99 passes through');
  assert.equal(tryAbsorption(damageEffect(), 0, t, { absorbing: false, rolls: roll(0) }), 0, 'no enchantment, no absorb');
});

test('ABSORB-NERF: the enchantment, live through applySpell (the entity\'s AbsorbsSpells fold)', () => {
  const spell = { element: 0, rangeType: 0, effects: [damageEffect(20)] };
  const hit = target(SPELL_ABSORPTION.None, { _enchantMods: { absorbsSpells: true }, health: 500, maxHealth: 500 });
  const passed = applySpell(spell, 1, hit, { hurt: () => {} }, () => 0.9, { name: 'caster' });
  assert.equal(passed.absorbed, undefined, 'a high roll: the bolt lands');
  assert.ok(passed.damage > 0);
  const kept = target(SPELL_ABSORPTION.None, { _enchantMods: { absorbsSpells: true } });
  const out = applySpell(spell, 1, kept, { hurt: () => {} }, () => 0, { name: 'caster' });
  assert.ok(out.absorbed > 0, 'a low roll: the bolt is absorbed');
});

test('ABSORB-NERF: the Spell Absorption effect\'s chance caps at 50%', () => {
  assert.equal(spellAbsorptionChance(target(0, { activeEffects: [absorbBuff(100)] })), 50, 'a 100% buff reads 50');
  assert.equal(spellAbsorptionChance(target(0, { level: 30, activeEffects: [absorbBuff(10, 10, 1)] })), 50,
    'a buff that grows past 50 with level stops at 50');
  assert.equal(spellAbsorptionChance(target(0, { activeEffects: [absorbBuff(30)] })), 30, 'under the cap, untouched');
  assert.equal(spellAbsorptionChance(target(0, { activeEffects: [{ kind: 'spellAbsorption', chance: 95 }] })), 50,
    'a pre-X2 frozen chance is capped too');
  const t = target(0, { activeEffects: [absorbBuff(100)] });
  assert.ok(tryAbsorption(damageEffect(), 0, t, { rolls: roll(0.49) }) > 0);
  assert.equal(tryAbsorption(damageEffect(), 0, t, { rolls: roll(0.50) }), 0, 'a 100% buff no longer always absorbs');
});

test('ABSORB-NERF: the Spell Maker\'s chanceBase for Spell Absorption stops at 50; every other range stands', () => {
  assert.equal(SPELL_ABSORPTION_KEY, '20,255');
  assert.deepEqual(spinnerRange('chanceBase', '20,255'), [1, 50]);
  assert.deepEqual(spinnerRange('chanceBase', '21,255'), [1, 100], 'Spell Reflection keeps 100');
  assert.deepEqual(spinnerRange('chanceBase'), [1, 100]);
  assert.deepEqual(spinnerRange('chanceMod', '20,255'), SPINNER_RANGES.chanceMod, 'only the base moves');
  assert.deepEqual(SPINNER_RANGES.chanceBase, [1, 100], 'the shared table is untouched');
  assert.equal(clampSetting('chanceBase', 90, '20,255'), 50);
  assert.equal(clampSetting('chanceBase', 90, '4,0'), 90);
  assert.equal(setSetting(blankEffectSettings(), 'chanceBase', 100, '20,255').chanceBase, 50, 'typed 100 reads 50');
  assert.equal(stepSetting({ ...blankEffectSettings(), chanceBase: 50 }, 'chanceBase', 1, '20,255').chanceBase, 50,
    'a step past 50 holds');
  assert.equal(stepSetting({ ...blankEffectSettings(), chanceBase: 50 }, 'chanceBase', 1, '21,255').chanceBase, 51);
  _resetCustomIndexForTests();
  const sp = buildCustomSpell({ slots: [{ type: 20, subType: 255, settings: { chanceBase: 100 } }, { type: 21, subType: 255, settings: { chanceBase: 100 } }] });
  assert.equal(sp.effects[0].chanceBase, 50, 'a built Spell Absorption record carries 50 at most');
  assert.equal(sp.effects[1].chanceBase, 100, 'the Spell Reflection beside it keeps 100');
});

test('ABSORB-NERF: the refund is half the points, floored (a 0 refund is fine)', () => {
  assert.equal(absorbRefund(20), 10);
  assert.equal(absorbRefund(21), 10);
  assert.equal(absorbRefund(1), 0);
  assert.equal(absorbRefund(0), 0);
  const spell = { element: 0, rangeType: 0, effects: [damageEffect(20)] };
  const t = target(SPELL_ABSORPTION.Always);
  const out = applySpell(spell, 1, t, { hurt: () => {} }, () => 0, { name: 'caster' }, { inside: true });
  assert.ok(out.absorbed > 0, 'the Always career still absorbs');
  assert.equal(t.magicka, Math.floor(out.absorbed / 2), 'and is credited half the points');
});

test('ABSORB-NERF: the career\'s Always keeps its 100% (the Sorcerer lives on it)', () => {
  const t = target(SPELL_ABSORPTION.Always);
  const cost = effectCastingCost(damageEffect(), 0, t);
  for (const r of [0, 0.5, 0.99]) assert.equal(tryAbsorption(damageEffect(), 0, t, { rolls: roll(r) }), cost, `roll ${r}`);
});

test('ABSORB-NERF: the Eye of Mora set\'s own chance is untouched (only its refund halves)', () => {
  registerAbsorptionChance('absorbNerfProbe', () => 30);
  try {
    const t = target();
    assert.ok(tryAbsorption(damageEffect(), 0, t, { rolls: roll(0.29) }) > 0, 'a registered 30% absorbs on 29');
    assert.equal(tryAbsorption(damageEffect(), 0, t, { rolls: roll(0.30) }), 0);
  } finally {
    registerAbsorptionChance('absorbNerfProbe', null);
  }
});
