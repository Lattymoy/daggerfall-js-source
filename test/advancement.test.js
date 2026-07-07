// S3b: advancement verbatim - uses-needed, reflexes bit math, the
// 360-minute gate, mastery caps, the level-up sum + leveling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SKILL_ADVANCEMENT_MULTIPLIER, skillUsesForAdvancement, calculatePlayerLevel,
  levelUpSkillSum, raiseSkills, alreadyMasteredASkill,
} from '../src/systems/advancement.js';
import { SKILLS } from '../src/systems/skills.js';
import { createCharacter } from '../src/systems/chargen.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const career = {
  name: 'W', hitPointsPerLevel: 12, advancementMultiplier: 1.0,
  strength: 60, intelligence: 40, willpower: 45, agility: 55,
  endurance: 60, personality: 40, speed: 50, luck: 50,
  primarySkills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.CriticalStrike],
  majorSkills: [SKILLS.BluntWeapon, SKILLS.Dodging, SKILLS.Jumping],
  minorSkills: [SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Running, SKILLS.Swimming, SKILLS.Climbing, SKILLS.Medical],
};

test('advancement: the tables + formulas verbatim', () => {
  assert.equal(SKILL_ADVANCEMENT_MULTIPLIER.length, 35);
  assert.equal(SKILL_ADVANCEMENT_MULTIPLIER[SKILLS.Running], 50);
  assert.equal(SKILL_ADVANCEMENT_MULTIPLIER[SKILLS.Medical], 12);
  assert.equal(SKILL_ADVANCEMENT_MULTIPLIER[SKILLS.LongBlade], 2);
  assert.equal(SKILL_ADVANCEMENT_MULTIPLIER[SKILLS.Daedric], 15);
  // floor(30 * 2 * 1.0 * 1.04 * 2/5) + 1 = floor(24.96) + 1 = 25
  assert.equal(skillUsesForAdvancement(30, 2, 1.0, 1), 25);
  assert.equal(calculatePlayerLevel(88, 88), 1);       // (0+28)/15 -> 1
  assert.equal(calculatePlayerLevel(88, 88 + 17), 3);  // 45/15
});

test('advancement: raise flow - gate, reflexes bits, cap, mastery rule', () => {
  const p = { isPlayer: true, reflexes: 2, items: [] };
  createCharacter(p, career, 16, { rolls: seq(0) });
  const lb = SKILLS.LongBlade;
  const startLb = p.skills[lb];
  const needed = skillUsesForAdvancement(startLb, 2, 1.0, 1);
  p.skillUses[lb] = needed;                     // reflexes 2 -> mod 0x10000, calc == uses
  assert.deepEqual(raiseSkills(p, 100), []);    // gate: <= 360 since check 0
  const raised = raiseSkills(p, 361);
  assert.deepEqual(raised, [lb]);
  assert.equal(p.skills[lb], startLb + 1);
  assert.equal(p.skillUses[lb], 0);
  // reflexes bit math: VeryHigh (0) -> mod 0x14000 -> uses scale UP 1.25x
  const q = { isPlayer: true, reflexes: 0, items: [] };
  createCharacter(q, career, 16, { rolls: seq(0) });
  const need2 = skillUsesForAdvancement(q.skills[lb], 2, 1.0, 1);
  q.skillUses[lb] = Math.ceil(need2 / 1.25);
  assert.deepEqual(raiseSkills(q, 400), [lb]);
  // mastery rule: a mastered primary caps the others at 94->95 boundary
  const m = { isPlayer: true, reflexes: 2, items: [] };
  createCharacter(m, career, 16, { rolls: seq(0) });
  m.skills[SKILLS.LongBlade] = 100;
  assert.ok(alreadyMasteredASkill(m));
  m.skills[SKILLS.Axe] = 95;
  m.skillUses[SKILLS.Axe] = 20000;   // the verbatim tally clamp; 99999 overflows the int32 shift (the clamp is WHY the source shift is safe)
  assert.deepEqual(raiseSkills(m, 500), []);    // 95 with a master: blocked
  m.skills[SKILLS.Axe] = 94;
  m.skillUses[SKILLS.Axe] = 20000;   // the verbatim tally clamp; 99999 overflows the int32 shift (the clamp is WHY the source shift is safe)
  assert.deepEqual(raiseSkills(m, 900), [SKILLS.Axe]);   // 94 -> 95 allowed
});

test('advancement: the level-up sum shape + headless leveling applies HP + pool', () => {
  const p = { isPlayer: true, reflexes: 2, items: [] };
  createCharacter(p, career, 16, { rolls: seq(0) });
  // sum = primaries + majors - lowest major + highest minor
  const c = p.career;
  let expect = 0, lo = Infinity, hi = -Infinity;
  for (const id of c.primarySkills) expect += p.skills[id];
  for (const id of c.majorSkills) { expect += p.skills[id]; lo = Math.min(lo, p.skills[id]); }
  for (const id of c.minorSkills) hi = Math.max(hi, p.skills[id]);
  assert.equal(levelUpSkillSum(p), expect - lo + hi);
  assert.equal(p.startingLevelUpSkillSum, levelUpSkillSum(p));
  // force +17 across counted skills -> level 3
  const before = { hp: p.maxHealth, str: { ...p.stats } };
  for (let k = 0; k < 17; k++) p.skills[SKILLS.LongBlade] += 1;
  p.skillUses[SKILLS.Axe] = 20000;              // any raise recomputes + levels
  raiseSkills(p, 500, seq(0));
  assert.equal(p.level, 3);
  assert.ok(p.maxHealth > before.hp);           // HP applied
  const statTotal = Object.values(p.stats).reduce((a, b) => a + b, 0);
  const beforeTotal = Object.values(before.str).reduce((a, b) => a + b, 0);
  assert.equal(statTotal, beforeTotal + 4);     // pool 4 (roll 0) spent
});
