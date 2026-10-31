// SKILL-LEAN (bible/05-Combat/Fixed-PvE.md section 14): a template foe's weapons, armour, jewellery and clothing take their first
// skill lines on the killer's best skills - one line to level 11, two to 27, three from 28.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rollAffixes } from '../../../src/systems/loot/lootRarity.js';
import { leanLinesAt, withSkillLean, skillLean, registerLeanSkills, SKILL_LEAN_GROUPS, SKILL_LEAN_CHANCE } from '../../../src/systems/loot/lootSkillLean.js';
import { bestSkills } from '../../../src/systems/loot/lootPowers.js';
import { seededRng } from '../../../src/systems/wind/wind.js';
import { SKILLS } from '../../../src/systems/skills.js';

const BEST = [SKILLS.Destruction, SKILLS.Mysticism, SKILLS.Alteration];
const pieces = {
  Weapons: { name: 'Longsword', group: 'Weapons', templateIndex: 115, material: 0, maxCondition: 100, currentCondition: 100 },
  Armor: { name: 'Cuirass', group: 'Armor', templateIndex: 102, material: 0, maxCondition: 100, currentCondition: 100 },
  Jewellery: { name: 'Ring', group: 'Jewellery', templateIndex: 133, maxCondition: 100, currentCondition: 100 },
  MensClothing: { name: 'Cloak', group: 'MensClothing', templateIndex: 183, maxCondition: 100, currentCondition: 100 },
  WomensClothing: { name: 'Cloak', group: 'WomensClothing', templateIndex: 183, maxCondition: 100, currentCondition: 100 },
};
const skillsOf = (out) => out.filter((a) => a.id === 'skill').map((a) => a.param);

test('SKILL-LEAN: weapons, armour, jewellery and clothing; one line to level 11, two to 27, three from 28', () => {
  assert.deepEqual([1, 11, 12, 27, 28, 45].map(leanLinesAt), [1, 1, 2, 2, 3, 3]);
  assert.equal(leanLinesAt(undefined), 1);
  assert.deepEqual(SKILL_LEAN_GROUPS, ['Weapons', 'Armor', 'Jewellery', 'MensClothing', 'WomensClothing']);
});

test('SKILL-LEAN: inside the lean a piece\'s first lines are the roller\'s best skills, in order; outside, nothing leans', () => {
  for (const [group, item] of Object.entries(pieces)) {
    for (let s = 0; s < 40; s++) {
      const out = withSkillLean(45, () => rollAffixes(item, 'rare', seededRng(s)), BEST, 1);
      const lines = Math.min(3, out.length);
      assert.deepEqual(out.slice(0, lines).map((a) => [a.id, a.param]), BEST.slice(0, lines).map((p) => ['skill', p]), `${group} seed ${s}`);
      const low = withSkillLean(5, () => rollAffixes(item, 'rare', seededRng(s)), BEST, 1);
      assert.deepEqual([low[0].id, low[0].param], ['skill', BEST[0]]);
      assert.notDeepEqual(low.slice(1, 3).map((a) => a.param), BEST.slice(1, 3), 'one line only to 11');
    }
  }
  let hits = 0;
  for (let s = 0; s < 40; s++) if (skillsOf(rollAffixes(pieces.Armor, 'rare', seededRng(s)))[0] === BEST[0]) hits++;
  assert.ok(hits < 20, `no lean outside the scope (${hits})`);
  assert.equal(skillLean(), null);
  assert.equal(withSkillLean(45, () => skillLean(), BEST)?.lines, 3);
  const shield = { name: 'Kite Shield', group: 'Books', templateIndex: 0, maxCondition: 100, currentCondition: 100 };
  for (let s = 0; s < 10; s++) assert.deepEqual(withSkillLean(45, () => rollAffixes(shield, 'rare', seededRng(s)), BEST), rollAffixes(shield, 'rare', seededRng(s)), 'a group outside the five never leans');
});

test('LEAN-CHANCE: a leaning line lands on a best skill SKILL_LEAN_CHANCE of the time, else rolls as ever; at 0 nothing leans', () => {
  assert.equal(SKILL_LEAN_CHANCE, 0.25);
  let first = 0, none = 0;
  const N = 400;
  for (let s = 0; s < N; s++) {
    if (skillsOf(withSkillLean(5, () => rollAffixes(pieces.Armor, 'magic', seededRng(s)), BEST))[0] === BEST[0]) first++;
    if (skillsOf(withSkillLean(5, () => rollAffixes(pieces.Armor, 'magic', seededRng(s)), BEST, 0))[0] === BEST[0]) none++;
  }
  assert.ok(first / N > 0.18 && first / N < 0.35, `one leaning line on the best skill ${first}/${N}`);
  assert.ok(none / N < 0.1, `no lean at chance 0 (${none}/${N})`);
});

test('SKILL-LEAN: the registered roller answers when no skills are handed in; a rollerless scope leans nothing', () => {
  registerLeanSkills(() => [SKILLS.Archery]);
  try {
    assert.deepEqual(withSkillLean(20, () => skillLean()), { lines: 2, skills: [SKILLS.Archery], chance: SKILL_LEAN_CHANCE });
    registerLeanSkills(() => { throw new Error('no player'); });
    assert.equal(withSkillLean(30, () => skillLean()), null);
  } finally { registerLeanSkills(null); }
  assert.equal(withSkillLean(30, () => skillLean()), null);
  assert.throws(() => withSkillLean(30, async () => 1, BEST), /synchronous/);
  const me = { skillOverrides: { [SKILLS.Archery]: 90, [SKILLS.Stealth]: 70, [SKILLS.Dodging]: 70, [SKILLS.Running]: 10 } };
  assert.deepEqual(bestSkills(me), [SKILLS.Archery, Math.min(SKILLS.Stealth, SKILLS.Dodging), Math.max(SKILLS.Stealth, SKILLS.Dodging)]);
});

test('SKILL-LEAN WIRED: a template foe\'s body and kit roll inside the lean, at its own level', () => {
  const rar = readFileSync(new URL('../../../src/systems/loot/lootRarity.js', import.meta.url), 'utf8');
  assert.match(rar, /if \(entity\.pveTemplate\) withSkillLean\(entity\.level, roll\); else roll\(\);/);
  const cap = readFileSync(new URL('../../../src/systems/foeLootCap.js', import.meta.url), 'utf8');
  assert.match(cap, /const kit = entity\?\.pveTemplate \? withSkillLean\(entity\.level, draw\) : draw\(\);/);
  assert.match(readFileSync(new URL('../../../src/systems/loot/lootPowers.js', import.meta.url), 'utf8'), /registerLeanSkills\(\(\) => \{\s*const me = playerDoor\(\)\?\.player\?\.\(\);\s*return me \? bestSkills\(me\) : null;\s*\}\);/);
});

