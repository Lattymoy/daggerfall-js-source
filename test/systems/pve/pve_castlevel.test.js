// SPELL-SKILL (bible/05-Combat/Fixed-PvE.md section 13): a player's effect reads its school's live skill / 2.2; past
// skill 100 damage climbs, heal and buff points climb at half speed, durations and chances stop; the cast's Magicka
// follows that power from the classic price at skill 50, less a skill discount, and never prices crit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  castLevelOf, timeLevel, pointsLevel, castLevels, castCostScale, isSpellDamage,
  CAST_LEVEL_TOP, CAST_COST_DISCOUNT, CAST_COST_SHARE, budgetEffect, skillCasts, SPELL_BUDGET, oneDamagePerKind, damageKind,
} from '../../../src/systems/spell/castLevel.js';
import { EFFECT_COST_TABLE } from '../../../src/systems/spellcost.js';
import { SKILLS } from '../../../src/systems/skills.js';

const fx = (o) => ({ durationBase: 1, durationMod: 1, durationPerLevel: 1, chanceBase: 1, chanceMod: 1, chancePerLevel: 1,
  magnitudeBaseLow: 1, magnitudeBaseHigh: 1, magnitudeLevelBase: 1, magnitudeLevelHigh: 1, magnitudePerLevel: 1, ...o });
const fireball = fx({ type: 4, subType: 0, magnitudeLevelHigh: 7 });          // SPELLS.STD 14's settings
const levitate = fx({ type: 14, subType: -1, durationBase: 2 });              // SPELLS.STD 4's
const heal = fx({ type: 10, subType: 8, magnitudeBaseHigh: 10, magnitudeLevelBase: 5, magnitudeLevelHigh: 5 });   // SPELLS.STD 64's
const disc = (s) => 1 - CAST_COST_DISCOUNT * Math.min(s, 100) / 100;

test('SPELL-SKILL: skill 100 casts at the top level; past it a duration stops and a buff climbs at half speed', () => {
  assert.equal(castLevelOf(100), CAST_LEVEL_TOP);
  assert.equal(castLevelOf(220), 100);
  assert.equal(castLevelOf(0), 1, 'never under 1');
  assert.equal(castLevelOf(NaN), 1);
  assert.equal(timeLevel(100), CAST_LEVEL_TOP);
  assert.equal(timeLevel(20), 20);
  assert.equal(pointsLevel(20), 20);
  assert.equal(pointsLevel(145), CAST_LEVEL_TOP + 50);
  assert.equal(isSpellDamage(fireball), true);
  assert.equal(isSpellDamage(fx({ type: 1, subType: 0 })), true, 'a burn');
  assert.equal(isSpellDamage(heal), false);
});

test('SPELL-SKILL: only my own player reads its school, and only with the switch on', () => {
  const me = { isPlayer: true, skillOverrides: { [SKILLS.Destruction]: 500 } };
  assert.deepEqual(castLevels(me, SKILLS.Destruction, { on: true }), { damage: 227, points: 136, time: CAST_LEVEL_TOP });
  assert.equal(castLevels(me, SKILLS.Destruction, { on: false }), null, 'switch off');
  assert.equal(castLevels(me, SKILLS.Destruction), null, 'off by default');
  assert.equal(castLevels({ ...me, peer: true }, SKILLS.Destruction, { on: true }), null, 'a peer\'s copy');
  assert.equal(castLevels({ skillOverrides: me.skillOverrides }, SKILLS.Destruction, { on: true }), null, 'a monster');
  assert.equal(castLevels(me, null, { on: true }), null, 'no school');
});

test('SPELL-SKILL PRICE: damage pays for what its hold lets land, a duration stops costing more past 100, crit is never priced', () => {
  const dmg = EFFECT_COST_TABLE['4,0'], lev = EFFECT_COST_TABLE['14,255'], hp = EFFECT_COST_TABLE['10,8'];
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  near(castCostScale(fireball, dmg, 100), CAST_COST_SHARE * disc(100) / disc(50));
  near(castCostScale(fireball, dmg, 100), 0.5 * 0.75 / 0.875, 'half the price, a quarter off at skill 100 against an eighth at 50');
  near(castCostScale(fireball, dmg, 1000), CAST_COST_SHARE * Math.sqrt(10) * disc(100) / disc(50), 'held 150 against 15, its square root');
  near(castCostScale(fireball, dmg, 50), CAST_COST_SHARE * 0.5, 'held 7.5 against 15, at the classic skill, half paid');
  near(castCostScale(levitate, lev, 1000), castCostScale(levitate, lev, 100));
  const drain = fx({ type: 4, subType: 2, magnitudeLevelHigh: 7 });
  assert.ok(castCostScale(drain, EFFECT_COST_TABLE['4,2'], 1000) > castCostScale(fireball, dmg, 1000), 'a drain of magicka has no hold, so it pays for all it does');
  const k = castCostScale(heal, hp, 1000) / castCostScale(heal, hp, 100);
  assert.ok(k > Math.sqrt(5) && k < Math.sqrt(6), `a heal at half speed past 100 (level 249, not 454), priced at its root (x${k})`);
  assert.doesNotMatch(readFileSync(new URL('../../../src/systems/spell/castLevel.js', import.meta.url), 'utf8'), /CriticalStrike/, 'crit is not read');
});

test('SPELL-SKILL WIRED: applySpell reads the effect\'s levels, a player\'s price reads the skill price', () => {
  const eff = readFileSync(new URL('../../../src/systems/effects.js', import.meta.url), 'utf8');
  const body = eff.slice(eff.indexOf('export function applySpell('), eff.indexOf('export function effectActiveIdentity('));
  assert.match(body, /const levelsOf = \(e\) => \(noSchool \? null : castLevels\(caster\?\.entity \?\? null, schoolOf\(e\)\)\);/);
  assert.doesNotMatch(body, /rollDuration\(e, casterLevel\)|chanceValue\(e, casterLevel\)|effectMagnitude\(e, casterLevel,|effect: e, casterLevel,/, 'every read through the effect\'s level');
  const cost = readFileSync(new URL('../../../src/systems/spellcost.js', import.meta.url), 'utf8');
  assert.match(cost, /castLevels\(casterEntity, castSchool\(casterEntity, spell, e\)\)\s*\? skillPricedCost\(e, skillOf, \{ online \}\)\s*: effectCost\(e, skillOf, \{ online \}\)/);
});

test('SPELL-SKILL BUDGET: no effect grows faster per level than the fastest stock spell; base settings stay free', () => {
  const ok = fx({ type: 10, subType: 8, magnitudeBaseLow: 100, magnitudeBaseHigh: 100, magnitudeLevelBase: 5, magnitudeLevelHigh: 10 });
  assert.equal(budgetEffect(ok), ok, 'inside: itself');
  const big = fx({ type: 10, subType: 8, magnitudeLevelBase: 100, magnitudeLevelHigh: 100, durationMod: 60, chanceMod: 100 });
  const b = budgetEffect(big);
  assert.deepEqual([b.magnitudeLevelBase, b.magnitudeLevelHigh, b.durationMod, b.chanceMod], [SPELL_BUDGET.magnitude, SPELL_BUDGET.magnitude, SPELL_BUDGET.duration, SPELL_BUDGET.chance]);
  assert.equal(big.magnitudeLevelHigh, 100, 'the record is never rewritten');
  const slow = budgetEffect(fx({ type: 10, subType: 8, magnitudeLevelBase: 100, magnitudeLevelHigh: 100, magnitudePerLevel: 20 }));
  assert.equal(slow.magnitudeLevelHigh, 100, '+100 per 20 levels is 5 a level: inside');
  assert.equal(budgetEffect(fx({ type: -1 })).type, -1);
  const eff = readFileSync(new URL('../../../src/systems/effects.js', import.meta.url), 'utf8');
  assert.match(eff, /if \(ctx\.heldItem == null && spell\?\.pvpKit == null && skillCasts\(caster\?\.entity \?\? null\)\) spell = \{ \.\.\.spell, effects: oneDamagePerKind\(spell\.effects\)\.map\(budgetEffect\) \};/);
  assert.match(readFileSync(new URL('../../../src/systems/spellcost.js', import.meta.url), 'utf8'), /const e = budgetEffect\(made\);/);
  assert.equal(skillCasts({ isPlayer: true }, { on: true }), true);
  assert.equal(skillCasts({ isPlayer: true }), false, 'off with the switch');
});

test('ONE DAMAGE OF A KIND: health, fatigue and magicka once each; a second of a kind is left out of the cast and its price', () => {
  const hit = fx({ type: 4, subType: 0 }), burn = fx({ type: 1, subType: 0 }), tire = fx({ type: 4, subType: 1 }), drain = fx({ type: 1, subType: 2 });
  assert.deepEqual([hit, burn, tire, drain, heal].map(damageKind), ['health', 'health', 'fatigue', 'magicka', null]);
  assert.deepEqual(oneDamagePerKind([hit, tire, drain]), [hit, tire, drain], 'three kinds stand');
  const twice = oneDamagePerKind([hit, burn, hit]);
  assert.deepEqual(twice.map((e) => e.type), [4, -1, -1], 'a burn beside a hit is a second health damage');
  assert.equal(burn.type, 1, 'the record is never rewritten');
  assert.deepEqual(oneDamagePerKind([heal, hit]), [heal, hit]);
  assert.equal(damageKind({ type: 4, subType: 0, key: 'Damage-Health' }), null, 'a DFU EffectEntry rides its own law');
  const cost = readFileSync(new URL('../../../src/systems/spellcost.js', import.meta.url), 'utf8');
  assert.match(cost, /for \(const e of skillCasts\(casterEntity\) \? oneDamagePerKind\(spell\.effects\) : spell\.effects\)/);
});

test('SPELL-SKILL POOL: my pool gains half a per cent of its own maximum for each point of my best magic school', async () => {
  const { skillPoolMp, bestSchool, POOL_PER_SKILL } = await import('../../../src/systems/spell/skillPool.js');
  const me = { isPlayer: true, stats: { intelligence: 100 }, career: { abilityFlagsAndSpellPointsBitfield: 0x1000 },
    skillOverrides: { [SKILLS.Destruction]: 200, [SKILLS.Restoration]: 400 } };
  assert.equal(bestSchool(me), 400);
  assert.equal(POOL_PER_SKILL, 0.005);
  assert.equal(skillPoolMp(me, { on: true }), Math.trunc(100 * 0.005 * 400), 'x1 career, Intelligence 100: +200');
  assert.equal(skillPoolMp(me), 0, 'off with the switch');
  assert.equal(skillPoolMp({ ...me, career: null }, { on: true }), 0, 'no career: a foe\'s stored pool');
  assert.equal(skillPoolMp({ ...me, peer: true }, { on: true }), 0);
  assert.match(readFileSync(new URL('../../../src/systems/arcanePowers.js', import.meta.url), 'utf8'), /^import '\.\/spell\/skillPool\.js';/m, 'the fold loads with the game');
});

test('SPELL-SKILL SIM: asked, the simulator pays each spell from the pool; a dry mage strikes nothing, a dry battlemage its weapon', async () => {
  const { simulate, probeTemplate } = await import('../../../src/systems/pve/pveSim.js');
  const { buildAt } = await import('../../../src/systems/pve/pveBuilds.js');
  const mage = buildAt('mage', 30), foe = probeTemplate(30);
  assert.ok(mage.magicka / mage.castCost > 15, `a full pool holds a fight's casts (${(mage.magicka / mage.castCost).toFixed(1)})`);
  const dry = { ...mage, magicka: 0 };
  assert.equal(simulate({ party: [dry], foes: [foe], magicka: true }).win, false, 'no Magicka, no spell');
  assert.equal(simulate({ party: [dry], foes: [foe] }).win, true, 'not asked: spells are free, as the stage 3 report reads them');
  const bm = buildAt('battlemage', 30);
  assert.ok(bm.weaponBlow > 0 && bm.weaponBlow < bm.blow);
});
