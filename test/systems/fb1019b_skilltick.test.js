// SKILL-TICK (2026-10-19, Discord #suggestions "Show current XP towards skill/next skill level up ticker, QoL", Cruor,
// through Mac): "An EXP ticker when you mouse over a skill that shows out of whatever XP is needed for the skill, to
// improve it on rest. So if you are 20/100, you can see and know how close you are to leveling it ... 'your skills can
// be improved' notification to let players know they should probably rest, since XP does not hang over". The Stats
// page's skill rows carry the uses toward the next point beside what it costs, and the HUD strip a standing line while
// any skill is ready - both read off raiseSkills' own test (advancement.js skillAdvanceProgress).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skillAdvanceProgress, skillsReadyToImprove, skillUsesForAdvancement, raiseSkills, SKILL_ADVANCEMENT_MULTIPLIER } from '../../src/systems/advancement.js';
import { SKILLS } from '../../src/systems/skills.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { CLASSIC_GAME_START_TIME as T0 } from '../../src/systems/gameDate.js';
import { softcapCostMultiplier } from '../../src/systems/skillSoftcap.js';
import { LevelNotices, NOTICE_IMPROVE, NOTICE_LEVEL, ANNOUNCE_MS } from '../../src/ui/levelUp/levelNotice.js';
import { skillTickText } from '../../src/ui/enhanced/enhancedMenu.js';
import { TUTORIALS } from '../../src/systems/tutorialCatalogue.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const career = {
  name: 'W', hitPointsPerLevel: 12, advancementMultiplier: 1.5,
  strength: 60, intelligence: 40, willpower: 45, agility: 55, endurance: 60, personality: 40, speed: 50, luck: 50,
  primarySkills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.CriticalStrike],
  majorSkills: [SKILLS.BluntWeapon, SKILLS.Dodging, SKILLS.Jumping],
  minorSkills: [SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Running, SKILLS.Swimming, SKILLS.Climbing, SKILLS.Medical],
};
const fresh = (reflexes = 2) => { const p = { isPlayer: true, reflexes, items: [] }; createCharacter(p, career, 16, { rolls: seq(0) }); p.level = 7; return p; };
/** A small LCG, so the sweep is the same sweep every run. */
const lcg = (seed) => () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);

test('SKILL-TICK: a skill\'s line is raiseSkills\' own number - the uses as Reflexes scales them against GetSkillAdvancementRequirement\'s, the class\'s multiplier and the level in it (mutants: the reflexes shift dropped, the requirement off the level 1 price)', () => {
  const p = fresh(0);   // Reflexes Very High: 0x14000, uses x1.25
  const lb = SKILLS.LongBlade;
  p.skillUses[lb] = 40;
  const need = skillUsesForAdvancement(p.skills[lb], SKILL_ADVANCEMENT_MULTIPLIER[lb], 1.5, 7);
  assert.deepEqual(skillAdvanceProgress(p, lb), { have: 50, need, ready: 50 >= need, held: null, wait: 0 });
});

test('SKILL-TICK: ready is exactly what the next pass raises - a seeded sweep of skills, tallies, Reflexes, the 95 lock, the cap at 100, Master Skills\' climb and its banked progress (mutants: ready read below the requirement, the lock forgotten, the cap forgotten, the bank forgotten)', () => {
  const rnd = lcg(1019);
  const values = [12, 40, 94, 95, 97, 100, 104, 150, 199, 200];
  let agreed = 0, raisedAny = 0;
  for (let trial = 0; trial < 160; trial++) {
    const p = fresh(Math.floor(rnd() * 5));
    if (rnd() < 0.5) { p.masterSkills = true; p.masteredSkills = [SKILLS.LongBlade, SKILLS.BluntWeapon]; }
    p.skillProgress = new Array(p.skillUses.length).fill(0);
    for (let i = 0; i < p.skillUses.length; i++) {
      p.skills[i] = values[Math.floor(rnd() * values.length)];
      if (p.career.primarySkills.includes(i) && p.skills[i] === 99) p.skills[i] = 98;   // a mid-pass mastery moves the lock - the one thing a reading taken before the pass cannot see
      const need = skillUsesForAdvancement(p.skills[i], SKILL_ADVANCEMENT_MULTIPLIER[i], 1.5, 7);
      p.skillUses[i] = Math.min(20000, Math.floor(rnd() * 2.2 * need));
      if (p.skills[i] >= 100 && rnd() < 0.5) p.skillProgress[i] = rnd() * 0.99;
    }
    // the lock can only move mid-pass when a primary rises to 100 in it; none starts at 99, so the reading is the pass's
    const ready = skillsReadyToImprove(p);
    const raised = raiseSkills(p, T0 + 361 + trial, seq(0), () => {});
    assert.deepEqual(raised, ready, `trial ${trial}`);
    agreed++; if (raised.length) raisedAny++;
  }
  assert.equal(agreed, 160); assert.ok(raisedAny > 100, 'the sweep raises skills, not just refuses them');
});

test('SKILL-TICK: held skills say why their uses go - 100 unmastered, the hard cap, DFU\'s 95 lock; past 100 a mastered skill counts its bank and the ladder\'s price (mutants: the held words swapped)', () => {
  const p = fresh();
  p.skills[SKILLS.Axe] = 100; p.skillUses[SKILLS.Axe] = 500;
  assert.equal(skillAdvanceProgress(p, SKILLS.Axe).held, 'cap', 'offline, Master Skills off: no mastery to be had');
  p.skills[SKILLS.LongBlade] = 100;
  p.skills[SKILLS.BluntWeapon] = 96; p.skillUses[SKILLS.BluntWeapon] = 20000;
  assert.equal(skillAdvanceProgress(p, SKILLS.BluntWeapon).held, 'lock', 'a primary at 100 holds the rest at 95');
  assert.equal(skillAdvanceProgress(p, SKILLS.BluntWeapon).ready, false);
  p.masterSkills = true; p.masteredSkills = [SKILLS.LongBlade];
  assert.equal(skillAdvanceProgress(p, SKILLS.BluntWeapon).held, null, 'Master Skills lifts the lock');
  p.skills[SKILLS.LongBlade] = 120; p.skillUses[SKILLS.LongBlade] = 10; p.skillProgress = new Array(35).fill(0); p.skillProgress[SKILLS.LongBlade] = 0.5;
  const cost = skillUsesForAdvancement(120, 2, 1.5, 7) * softcapCostMultiplier(120);
  assert.deepEqual(skillAdvanceProgress(p, SKILLS.LongBlade), { have: Math.floor(0.5 * cost) + 10, need: cost, ready: false, held: null, wait: 0 });
  p.skills[SKILLS.LongBlade] = 200;
  assert.equal(skillAdvanceProgress(p, SKILLS.LongBlade).held, 'cap', 'the hard cap');
  assert.equal(skillTickText({ have: 3, need: 40, ready: false, held: null }), '3 / 40 uses to the next point');
  assert.equal(skillTickText({ have: 40, need: 40, ready: true, held: null }), 'Ready - rest or travel to raise it');
  assert.equal(skillTickText({ have: 9, need: 4, ready: false, held: 'cap' }), 'At its limit - uses are not kept');
  assert.equal(skillTickText({ have: 9, need: 4, ready: false, held: 'lock' }), 'Held while a primary skill is at 100 - uses are not kept');   // AUDIT SUGGESTIONS-1019 L3-3
  assert.deepEqual(skillsReadyToImprove({ ...p, chargenDone: false }), [], 'none before chargen is done');
});

test('SKILL-TICK: the HUD strip\'s standing line - there while any skill is ready, says how many, never news that fades, just above a level\'s row and gone when nothing is ready (mutants: the line never drawn, ranked under the level\'s)', () => {
  const n = new LevelNotices();
  assert.deepEqual(n.frame(0, { improvable: 0 }), []);
  const one = n.frame(ANNOUNCE_MS * 10, { improvable: 1 });
  assert.equal(one.length, 1);
  assert.equal(one[0].kind, NOTICE_IMPROVE); assert.equal(one[0].standing, true);
  assert.equal(one[0].title, 'Skills can be improved');
  assert.equal(one[0].sub, '1 skill is ready. Rest or travel to raise it');   // AUDIT SUGGESTIONS-1019 L6-6
  const both = n.frame(10, { improvable: 3, owed: true });
  assert.deepEqual(both.slice(-2).map((r) => r.kind), [NOTICE_IMPROVE, NOTICE_LEVEL], 'the level\'s row last, the skills\' just above');
  assert.equal(both.at(-2).sub, '3 skills are ready. Rest or travel to raise them');
});

test('SKILL-TICK: the tutorial says when a used skill goes up and where to look', () => {
  const page = TUTORIALS.find((p) => p.id === 'character-sheet');
  assert.match(page.body.join(' '), /rest or travel, at most once every 6 hours/);
});

test('SKILL-TICK: the Stats page\'s model hands each row its reading, and the row draws it under the bar (mutant: the model\'s reading dropped)', async () => {
  const { sheetModel } = await import('../../src/ui/enhanced/enhancedCharSheet.js');
  const p = fresh();
  p.skillUses[SKILLS.Axe] = 7;
  assert.deepEqual(sheetModel(p).progress(SKILLS.Axe), skillAdvanceProgress(p, SKILLS.Axe));
  const src = (await import('node:fs')).readFileSync(new URL('../../src/ui/enhanced/enhancedMenu.js', import.meta.url), 'utf8');
  const rows = src.slice(src.indexOf('function statsSkills(detail, m) {'), src.indexOf('/** ADVANTAGES: GetClassSpecials'));
  assert.match(rows, /const tick = m\.progress \? skillTickText\(m\.progress\(id, ownMinutes\(\)\)\) : '';/);
  assert.match(rows, /if \(tick\) r\.append\(el\('div', 'px-skilltick', tick\)\);/);
});
