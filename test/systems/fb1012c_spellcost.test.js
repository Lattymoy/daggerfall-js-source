// SPELL-COST-PAST (FIELD BUGS 2026-10-12c, from the Discord: "dude is going around AoE buffing infinitely still -
// creating negative spell costs which makes things only cost 5"; bible/01-Overview/bugs/Field-Bugs-2026-10-12c.md).
//
// Both of DFU's cost formulas scale by (110 - skill): 10 at DFU's 100, nothing at 110, under nothing past it. A mastered
// school reads up to 140 in a formula (SOFTCAP1) and worn gear adds on top without bound, so past 110 an effect priced
// under nothing - it took its cost off the spell's other effects - and the cast fell to the floor of 5: an Area Around
// Caster Fortify for 5 magicka, cast as often as the hands move. Online, past 100 a spell costs what it costs at 100
// times 100 / skill now; offline and to 100, DFU's term stands.
//
// Driven on the producers: a chargen'd character mastered through masterSkills.js, priced through spellcost.js's own
// doors and the spell maker's.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SKILLS, skillValue } from '../../src/systems/skills.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { buildCustomCareer } from '../../src/systems/customClass.js';
import { masterSkill } from '../../src/systems/masterSkills.js';
import { playerEntity } from '../../src/characters/playerEntity.js';
import { effectCost, calculateCastCost, classicCastingCost, skillScaledCost, SPELL_COST_SKILL_REFERENCE, CAST_COST_FLOOR } from '../../src/systems/spellcost.js';
import { spellMakerCost, editedEffectCost } from '../../src/systems/spell/spellMaker.js';

const RESTO = SKILLS.Restoration;
const STATS = { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 };
const career = buildCustomCareer({
  name: 'Mage', hp: 8, stats: STATS,
  skills: [SKILLS.Restoration, SKILLS.Destruction, SKILLS.Alteration, SKILLS.Mysticism, SKILLS.Illusion, SKILLS.Thaumaturgy,
    SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Medical, SKILLS.Etiquette, SKILLS.Streetwise, SKILLS.Lockpicking],
});

/** A mage whose Restoration is mastered and stands at `value` - Master Skills in force, as online it always is. */
function mage(value) {
  const p = structuredClone(playerEntity);
  createCharacter(p, career, -1, { rolls: () => 0.5 });
  p._online = true;   // world.js stamps it
  p.skills[RESTO] = 100;
  assert.equal(masterSkill(p, RESTO).ok, true);
  p.skills[RESTO] = value;
  p.skills[SKILLS.Destruction] = 50;
  return p;
}
/** The page's own switch (onlineLane.js isOnlinePage), for the doors that read it themselves. */
function onlinePage(fn) {
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.location = { search: '?online' };
  try {
    return fn();
  } finally {
    if (had === undefined) delete globalThis.location; else globalThis.location = had;
  }
}

// Fortify Strength (9,0): duration (28,100) + magnitude (40,120) - 28*10 + 100*5 + 40*15 + 120*3 = 1740 gold
const FORTIFY = { type: 9, subType: 0, durationBase: 10, durationMod: 5, durationPerLevel: 1,
  magnitudeBaseLow: 10, magnitudeBaseHigh: 20, magnitudeLevelBase: 2, magnitudeLevelHigh: 4, magnitudePerLevel: 1 };
// Damage Health (4,0): magnitude (20,28) - 20*10 + 28*3 = 284 gold, Destruction
const DAMAGE = { type: 4, subType: 0, magnitudeBaseLow: 5, magnitudeBaseHigh: 15, magnitudeLevelBase: 6, magnitudeLevelHigh: 6, magnitudePerLevel: 2 };
const AREA = 3;

test('SPELL-COST-PAST: the field\'s Area Around Caster Fortify at a mastered Restoration - 5 magicka, now its price at 100 times 100 / skill', () => {
  const at = (raw, online) => {
    const p = mage(raw);
    return { eff: skillValue(p, RESTO), sp: effectCost(FORTIFY, (id) => skillValue(p, id), { online }).sp,
      cast: calculateCastCost({ rangeType: AREA, effects: [FORTIFY] }, p, { online }).sp };
  };
  // the root, in DFU's own numbers (offline, where they stand): past an effective 110 the effect prices under nothing
  assert.deepEqual(at(100, false), { eff: 100, sp: 43, cast: 86 });
  assert.deepEqual(at(150, false), { eff: 117, sp: -30, cast: CAST_COST_FLOOR });
  assert.deepEqual(at(200, false), { eff: 140, sp: -130, cast: CAST_COST_FLOOR });
  // online now: to 100 nothing moves; past it every point is still cheaper, and the cast never reaches the floor
  assert.deepEqual(at(100, true), { eff: 100, sp: 43, cast: 86 });
  assert.deepEqual(at(120, true), { eff: 105, sp: 41, cast: 82 });
  assert.deepEqual(at(150, true), { eff: 117, sp: 37, cast: 74 });
  assert.deepEqual(at(200, true), { eff: 140, sp: 31, cast: 62 });
  // through the doors that read the page themselves: the ready's price and the spell maker's two labels
  onlinePage(() => {
    const p = mage(200);
    assert.equal(calculateCastCost({ rangeType: AREA, effects: [FORTIFY] }, p).sp, 62);
    assert.equal(spellMakerCost({ rangeType: AREA, effects: [FORTIFY] }, p).sp, 62);
    const { type, subType, ...settings } = FORTIFY;
    assert.equal(editedEffectCost({ type, subType, settings }, p).sp, 31, 'the settings editor\'s label is never under nothing');
  });
});

test('SPELL-COST-PAST: online the skill term never prices under nothing, never rises with the skill, is DFU\'s to 100 and 100 / skill past it', () => {
  assert.equal(SPELL_COST_SKILL_REFERENCE, 100, 'DFU\'s maximum skill');
  let checked = 0;
  for (const divisor of [400, 100]) {   // CalculateEffectCosts' and CalculateCastingCost's
    for (const value of [0, 1, 39, 40, 41, 284, 1740, 9999, 250000]) {
      const at100 = skillScaledCost(value, 100, divisor, { online: true });
      let last = Infinity;
      for (let skill = -50; skill <= 2000; skill++) {
        const on = skillScaledCost(value, skill, divisor, { online: true });
        const off = skillScaledCost(value, skill, divisor, { online: false });
        const dfu = Math.trunc(value * (110 - skill) / divisor);
        const where = `value ${value} /${divisor} skill ${skill}`;
        assert.equal(off, dfu, `${where}: offline is DFU's`);
        assert.ok(on >= 0 && on <= last, `${where}: ${on}, ${last} a point below`);
        assert.equal(on, skill <= 100 ? dfu : Math.trunc((value * 10 * 100) / (skill * divisor)), where);
        last = on;
        checked++;
      }
      assert.equal(skillScaledCost(value, 200, divisor, { online: true }), Math.trunc(at100 / 2), 'half at 200');
    }
  }
  assert.ok(checked > 30000);
  // the page's own switch is the default
  assert.equal(skillScaledCost(1740, 140, 400), -130);
  onlinePage(() => assert.equal(skillScaledCost(1740, 140, 400), 31));
});

test('SPELL-COST-PAST: online an effect never takes cost off another - a spell with more effects never casts cheaper, and an item\'s held-spell bill is never under the floor', () => {
  const p = mage(200);
  const skillOf = (id) => skillValue(p, id);
  const cost = (effects, online) => calculateCastCost({ rangeType: AREA, effects }, p, { online }).sp;
  // offline (DFU's own): the mastered Fortify's -130 is subtracted from the Destruction effect's 42, and the pair costs the floor
  assert.equal(effectCost(DAMAGE, skillOf, { online: false }).sp, 42);
  assert.equal(cost([DAMAGE], false), 84);
  assert.equal(cost([DAMAGE, FORTIFY], false), CAST_COST_FLOOR, 'the second effect made the spell cheaper');
  // online: each effect adds what it costs
  assert.equal(cost([DAMAGE], true), 84);
  assert.equal(cost([DAMAGE, FORTIFY], true), 2 * (42 + 31));
  for (const raw of [100, 110, 125, 150, 175, 200]) {
    const q = mage(raw);
    const c = (effects) => calculateCastCost({ rangeType: AREA, effects }, q, { online: true }).sp;
    assert.ok(c([DAMAGE, FORTIFY]) >= Math.max(c([DAMAGE]), c([FORTIFY])), `Restoration ${raw}`);
  }
  // CalculateCastingCost (the classic-reversed formula, CastWhenHeld's equip bill) reads the same term
  const record = { rangeType: 0, effects: [FORTIFY, DAMAGE] };
  assert.equal(classicCastingCost(record, skillOf, { online: false }), 5, 'DFU\'s own: the floor');
  const online = classicCastingCost(record, skillOf, { online: true });
  const fortifyAlone = classicCastingCost({ rangeType: 0, effects: [FORTIFY] }, skillOf, { online: true });
  assert.ok(online > fortifyAlone && fortifyAlone > 5, `the bill ${online}, the Fortify alone ${fortifyAlone}`);
  onlinePage(() => assert.equal(classicCastingCost(record, skillOf), online, 'the page\'s own switch is the default'));
  assert.equal(classicCastingCost(record, null, { online: true }), classicCastingCost(record, null, { online: false }), 'the enchantment arm reads 50 - unmoved');
});
