// S24: SPELL ABSORPTION (EntityEffectManager.TryAbsorption /
// TryCareerBasedAbsorption / GetEffectCastingCost). spellAbsorptionFlags
// had zero consumers: the SORCERER ships absorb = Always AND
// NoRegenSpellPoints and only the penalty was live, so the class paid
// its whole cost and got nothing back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  SPELL_ABSORPTION, tryAbsorption, careerAbsorbs, effectCastingCost, isDestructionEffect,
} from '../src/systems/absorption.js';
import { applySpell, SPELL_ABSORBED_TEXT } from '../src/systems/effects.js';
import { CAST_COST_FLOOR } from '../src/systems/spellcost.js';
import { ClassFile } from '../src/formats/classFile.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

const damageEffect = (mag = 20) => ({
  type: 4, subType: 0,
  magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
});
const healEffect = () => ({
  type: 10, subType: 8,
  magnitudeBaseLow: 20, magnitudeBaseHigh: 20, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
});
/** an absorbing target with room in the pool */
const absorber = (flags = SPELL_ABSORPTION.Always, over = {}) => ({
  career: { spellAbsorptionFlags: flags },
  maxMagicka: 100, magicka: 0, level: 1,
  skills: new Array(40).fill(50), stats: { intelligence: 50, willpower: 50 },
  ...over,
});

test('S24: only DESTRUCTION magic is absorbed', () => {
  // :1168-1172 - DFU's own comment says why: absorption is tested
  // against EVERY incoming effect, so a benign self-heal would
  // otherwise be swallowed.
  assert.equal(isDestructionEffect(damageEffect()), true);
  assert.equal(isDestructionEffect(healEffect()), false, 'Restoration is not absorbed');
  const t = absorber();
  assert.ok(tryAbsorption(damageEffect(), 0, t) > 0);
  assert.equal(tryAbsorption(healEffect(), 0, t), 0, 'a heal passes through an Always absorber');
});

test('S24: the target must have ROOM in the pool', () => {
  // :1180-1184 - cost > (max - current) refuses. An absorber at FULL
  // magicka absorbs nothing at all, which is the throttle on the trait.
  const cost = effectCastingCost(damageEffect(), 0, absorber());
  assert.ok(cost > 0);
  assert.equal(tryAbsorption(damageEffect(), 0, absorber(SPELL_ABSORPTION.Always, { magicka: 100 })), 0,
    'full pool: nothing is absorbed');
  assert.equal(tryAbsorption(damageEffect(), 0, absorber(SPELL_ABSORPTION.Always, { magicka: 100 - cost })), cost,
    'exactly enough room: absorbed');
  assert.equal(tryAbsorption(damageEffect(), 0, absorber(SPELL_ABSORPTION.Always, { magicka: 100 - cost + 1 })), 0,
    'one point short: refused');
});

test('S24: the cost carries the target multiplier and the floor of 5', () => {
  // GetEffectCastingCost (:1238-1252). The floor is DFU's own guard
  // against an absorb draining the pool it is meant to fill.
  const t = absorber();
  const caster = effectCastingCost(damageEffect(), 0, t);      // CasterOnly x1.0
  const ranged = effectCastingCost(damageEffect(), 2, t);      // SingleTargetAtRange x1.5
  assert.ok(ranged > caster, 'the ranged multiplier raises the cost');
  // a trivially cheap effect still floors at 5
  const tiny = { ...damageEffect(0), magnitudeBaseLow: 0, magnitudeBaseHigh: 0 };
  assert.equal(effectCastingCost(tiny, 0, t), CAST_COST_FLOOR);
  assert.equal(CAST_COST_FLOOR, 5);
});

test('S24: the career branches - Always, InDarkness, InLight', () => {
  // TryCareerBasedAbsorption (:1294-1320). Darkness is inside-or-night,
  // light is outside-and-day - the same law rest.js's RapidHealing uses.
  const c = (f) => ({ spellAbsorptionFlags: f });
  for (const ctx of [{ day: true, inside: false }, { day: false, inside: true }, { day: true, inside: true }]) {
    assert.equal(careerAbsorbs(c(SPELL_ABSORPTION.Always), ctx), true, 'Always ignores context');
  }
  const dark = c(SPELL_ABSORPTION.InDarkness);
  assert.equal(careerAbsorbs(dark, { day: true, inside: true }), true, 'inside by day IS darkness');
  assert.equal(careerAbsorbs(dark, { day: false, inside: false }), true, 'outside at night too');
  assert.equal(careerAbsorbs(dark, { day: true, inside: false }), false, 'outside by day is NOT');
  const light = c(SPELL_ABSORPTION.InLight);
  assert.equal(careerAbsorbs(light, { day: true, inside: false }), true, 'outside by day IS light');
  assert.equal(careerAbsorbs(light, { day: true, inside: true }), false, 'inside is not, even by day');
  assert.equal(careerAbsorbs(light, { day: false, inside: false }), false, 'nor outside at night');
  // no flag, no absorption - and a career-less entity never throws
  assert.equal(careerAbsorbs(c(SPELL_ABSORPTION.None), { day: false, inside: true }), false);
  assert.equal(careerAbsorbs(null, {}), false);
});

test('S24: an absorbed effect does NOT land, and the points are credited', () => {
  // :510-517 - the absorbed effect `continue`s, so no damage is dealt
  // at all; :606 credits the pool.
  const spell = { element: 0, rangeType: 0, effects: [damageEffect(20)] };
  const target = absorber();
  const said = [];
  const hurt = [];
  const out = applySpell(spell, 1, target, { hurt: (n) => hurt.push(n), say: (m) => said.push(m) },
    () => 0, { name: 'caster' }, { day: false, inside: true });
  assert.equal(out.damage, 0, 'the damage branch never ran');
  assert.deepEqual(hurt, [], 'and nothing reached the hurt sink');
  assert.ok(out.absorbed > 0, 'the points are reported');
  assert.equal(target.magicka, out.absorbed, 'and credited to the pool');
  assert.deepEqual(said, [SPELL_ABSORBED_TEXT]);
});

test('S24: a NON-absorbing target takes the spell normally', () => {
  // the negative half - the hook must not swallow ordinary spells
  const spell = { element: 0, rangeType: 0, effects: [damageEffect(20)] };
  const target = absorber(SPELL_ABSORPTION.None);
  const hurt = [];
  const out = applySpell(spell, 1, target, { hurt: (n) => hurt.push(n) }, () => 0, { name: 'caster' });
  assert.ok(out.damage > 0, 'the damage lands');
  assert.equal(hurt.length, 1);
  assert.equal(target.magicka, 0, 'and nothing is credited');
  assert.equal(out.absorbed, undefined);
});

test('S24: with no caster entity there is no absorption at all', () => {
  // :505 - the whole absorb/reflect/resist block sits behind
  // `if (sourceBundle.CasterEntityBehaviour)`.
  const spell = { element: 0, rangeType: 0, effects: [damageEffect(20)] };
  const target = absorber();
  const out = applySpell(spell, 1, target, {}, () => 0, null);
  assert.ok(out.damage > 0, 'a casterless bundle is not absorbed');
  assert.equal(target.magicka, 0);
});

test('S24: a SELF-cast cannot refund more than it cost', () => {
  // :598-605 - absorption is tallied per effect and can exceed the
  // spell's own price; the cap applies ONLY when caster === target.
  const spell = { element: 0, rangeType: 0, effects: [damageEffect(20), damageEffect(20)] };
  const target = absorber();
  const uncapped = applySpell(spell, 1, target, {}, () => 0, { name: 'other' }, { inside: true });
  const both = uncapped.absorbed;
  assert.ok(both > 0);

  const selfTarget = absorber();
  // AUDIT 23 (magic-5): the caster rides the {entity, sinks} WRAPPER -
  // the shape every live producer mints (playerCaster(), the foe
  // wrappers). The old raw-entity fixture never matched in production.
  const selfOut = applySpell(spell, 1, selfTarget, {}, () => 0, { entity: selfTarget, sinks: {} }, { inside: true, selfCastCost: 3 });
  assert.equal(selfOut.absorbed, 3, 'a self-cast is capped at what it cost');
  assert.equal(selfTarget.magicka, 3);
  // and the cap does not apply to another entity's spell
  assert.equal(both > 3, true, 'the same spell from another caster refunds the full tally');
});

test('S24: the SORCERER absorbs - the trait it had been paying for', { skip: skipReal }, () => {
  // The point of the slice. CLASS03.CFG ships spellAbsorptionFlags = 4
  // (Always) alongside NoRegenSpellPoints, and only the penalty was
  // live. This pin fails if the corpus ever disagrees.
  const cf = new ClassFile();
  cf.load(new Uint8Array(readFileSync(join(ARENA2, 'CLASS03.CFG'))));
  const career = cf.career;
  assert.equal(career.name, 'Sorcerer');
  assert.equal(career.spellAbsorptionFlags, SPELL_ABSORPTION.Always);
  assert.equal(careerAbsorbs(career, { day: true, inside: false }), true, 'anywhere, any time');
  // through the whole path, on the entity shape chargen mints
  const target = { career, maxMagicka: 100, magicka: 0, level: 1, skills: new Array(40).fill(50), stats: {} };
  const out = applySpell({ element: 0, rangeType: 2, effects: [damageEffect(20)] }, 1, target, {}, () => 0, { name: 'foe' });
  assert.equal(out.damage, 0, 'a Sorcerer takes no damage from an absorbed bolt');
  assert.ok(target.magicka > 0, 'and gains the spell points instead');
});
