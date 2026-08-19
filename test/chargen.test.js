// Systems S3: character creation verbatim - roll bounds, tiers, HP,
// the interim pool policy, weapon-skill mapping, dual-shape reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, SKILL_COUNT, WEAPON_SKILL, skillValue, tallySkill } from '../src/systems/skills.js';
import {
  rollStats, rollSkills, hitPointsModifier, rollMaxHealthLevel1,
  hitPointsPerLevelUp, spendPoolLowest, createCharacter, CLASS_CAREERS,
} from '../src/systems/chargen.js';
import { calculateAttackDamage } from '../src/combat/formulas.js';
import { WEAPONS } from '../src/characters/weapons.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const career = {
  name: 'Warrior', hitPointsPerLevel: 12,
  strength: 60, intelligence: 40, willpower: 45, agility: 55,
  endurance: 60, personality: 40, speed: 50, luck: 50,
  primarySkills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.CriticalStrike],
  majorSkills: [SKILLS.BluntWeapon, SKILLS.Dodging, SKILLS.Jumping],
  minorSkills: [SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Running, SKILLS.Swimming, SKILLS.Climbing, SKILLS.Medical],
};

test('chargen: stat rolls (base + 0..10), pool 6..14, skill tiers verbatim', () => {
  const lo = rollStats(career, seq(0));
  assert.equal(lo.stats.strength, 60);
  assert.equal(lo.bonusPool, 6);
  const hi = rollStats(career, seq(0.999));
  assert.equal(hi.stats.strength, 70);          // +10 inclusive
  assert.equal(hi.bonusPool, 14);
  const sk = rollSkills(career, seq(0));
  assert.equal(sk.skills[SKILLS.LongBlade], 28);
  assert.equal(sk.skills[SKILLS.Dodging], 18);
  assert.equal(sk.skills[SKILLS.ShortBlade], 13);
  assert.equal(sk.skills[SKILLS.Etiquette], 3);  // default floor
  const skHi = rollSkills(career, seq(0.999));
  assert.equal(skHi.skills[SKILLS.LongBlade], 31);   // +3 inclusive
  assert.equal(skHi.skills[SKILLS.Etiquette], 6);
  assert.equal(hitPointsModifier(60), 1);
  assert.equal(hitPointsModifier(45), -1);       // floor(4.5)-5
  assert.equal(rollMaxHealthLevel1(career), 37); // 25 + 12
  assert.equal(hitPointsPerLevelUp(career, 60, seq(0)), 7);       // 6 + 1
  assert.equal(hitPointsPerLevelUp({ hitPointsPerLevel: 2 }, 10, seq(0)), 1);   // floors at 1
});

test('chargen: the interim lowest-first pool policy + full create', () => {
  const vals = { a: 5, b: 3, c: 9 };
  spendPoolLowest(vals, ['a', 'b', 'c'], 4);
  assert.deepEqual(vals, { a: 6, b: 6, c: 9 });   // b,b,a,(a|b tie->a first key), order: 3->4->4? deterministic first-lowest
  const p = { isPlayer: true, reflexes: 2, items: [] };
  createCharacter(p, career, 16, { rolls: seq(0) });
  assert.equal(p.chargenDone, true);
  assert.equal(p.level, 1);
  assert.equal(p.maxHealth, 37);
  assert.equal(p.health, 37);
  // stat pool 6 spent into the lowest stats (int 40, per 40 climb)
  assert.ok(p.stats.intelligence >= 40 && p.stats.personality >= 40);
  const total = Object.values(p.stats).reduce((a, b) => a + b, 0);
  assert.equal(total, 60 + 40 + 45 + 55 + 60 + 40 + 50 + 50 + 6);   // bases + pool
  // skill groups: each pool of 6 lands inside its own group
  assert.ok(p.skills[SKILLS.LongBlade] >= 28);
  assert.equal(p.skills.length, SKILL_COUNT);
  tallySkill(p, SKILLS.LongBlade);
  assert.equal(p.skillUses[SKILLS.LongBlade], 1);
});

test('chargen: skillValue dual shape + formulas consume real skills', () => {
  assert.equal(skillValue({ skills: 35 }, SKILLS.Dodging), 35);       // flat enemy path
  const arr = new Array(SKILL_COUNT).fill(5); arr[SKILLS.LongBlade] = 40; arr[SKILLS.HandToHand] = 20;
  const player = { isPlayer: true, level: 1, skills: arr, armor: 0, stats: { strength: 50, agility: 50, luck: 50 } };
  const foe = { isPlayer: false, isClass: false, careerIndex: 0, armor: 0, skills: 0, minMetalToHit: -1, stats: { strength: 50, agility: 50, luck: 50 } };
  const sword = { name: 'Longsword', templateIndex: WEAPONS.Longsword, material: 0, flags: 0x10 };
  // MEASURED (F1/F3): weapon = LongBlade 40 - 10 (iron x10) - 10
  // (+40 monster - 50) = 20; unarmed = HandToHand 20 - 10 = 10.
  // The SAME roll .15 hits with the sword, misses barehanded -
  // the weapon's own skill drives the outcome.
  // rolls: [struck, crit(.99 fail), hit .15, damage 0]
  const d = calculateAttackDamage(player, foe, { weapon: sword, rolls: seq(0, 0.99, 0.15, 0) });
  assert.ok(d >= 1, `weapon skill drives the hit (${d})`);
  const h = calculateAttackDamage(player, foe, { rolls: seq(0, 0.99, 0.15, 0) });
  assert.equal(h, 0);
  assert.equal(WEAPON_SKILL['Dai-Katana'], SKILLS.LongBlade);
  assert.equal(WEAPON_SKILL.Warhammer, SKILLS.BluntWeapon);
  assert.equal(CLASS_CAREERS[16], 'Warrior');
});

test('chargen: the verbatim starting-spell sets (S6)', async () => {
  const { STARTING_SPELL_SETS, startingSpells } = await import('../src/systems/chargen.js');
  assert.deepEqual(STARTING_SPELL_SETS[0], [1, 37, 2, 97, 8]);   // Mage
  assert.deepEqual(STARTING_SPELL_SETS[3], [1, 37, 2, 97, 8]);   // Sorcerer shares the Mage set
  assert.deepEqual(STARTING_SPELL_SETS[6], [37]);                // Bard
  assert.equal(STARTING_SPELL_SETS[7], undefined);               // index > 6: no spells
  const byIndex = new Map([[8, { index: 8, name: 'Shock' }], [44, { index: 44, name: 'Chameleon' }], [37, { index: 37, name: 'Slowfalling' }]]);
  const sw = startingSpells(1, byIndex);                         // Spellsword [8, 44, 37]
  assert.deepEqual(sw.map((s) => s.name), ['Shock', 'Chameleon', 'Slowfalling']);
  assert.deepEqual(startingSpells(16, byIndex), []);             // Warrior: none
  assert.equal(startingSpells(0, byIndex).length, 2);            // 1,2,97 missing skip loudly; 37+8 resolve
  assert.deepEqual(startingSpells(0, null), []);
});
