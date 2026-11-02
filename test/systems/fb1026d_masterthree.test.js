// MASTER-THREE (2026-10-26, Discord #feature-feedback "Let us master all three primary skills";
// bible/01-Overview/bugs/Field-Bugs-2026-10-26d.md): every primary skill may be mastered - 3 primary, 2 major, 1 minor.
// Mutants: tools/mutants/fb1026d_masterthree.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playerEntity } from '../../src/characters/playerEntity.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { SKILLS } from '../../src/systems/skills.js';
import {
  MASTERY_SLOTS, masterSkill, masterySlots, masteryRefusal, masteryChoiceRows, MASTER_SKILLS_ABOUT, MASTER_SKILLS_OFFER_ROWS, MASTER_SKILLS_INFO_ROWS,
} from '../../src/systems/masterSkills.js';
import { skillAdvanceProgress } from '../../src/systems/advancement.js';
import * as MP from '../../src/systems/martialPaths.js';

const { LongBlade: LB, ShortBlade: SB, Archery: AR, Axe: AX, BluntWeapon: BL, Dodging: DO, Running: RU, Medical: MD, Stealth: SE, Swimming: SW, Climbing: CL, Jumping: JU } = SKILLS;

/** A made character online (Master Skills in force), every skill at 30, then each of `atHundred` at 100. */
function hero({ primary, major, minor, atHundred = [] }) {
  const p = structuredClone(playerEntity);
  createCharacter(p, { name: 'Tester', hp: 12, primarySkills: primary, majorSkills: major, minorSkills: minor,
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 } }, -1, { rolls: () => 0.5 });
  p.career = { ...p.career, primarySkills: primary, majorSkills: major, minorSkills: minor };
  p._online = true; p.level = 20;
  p.skills = p.skills.map(() => 30);
  for (const s of atHundred) p.skills[s] = 100;
  return p;
}

test('MASTER-THREE THE SLOTS: 3 primary, 2 major, 1 minor - every primary masters, the third major and the second minor are refused (mutants: the primary\'s third slot taken back; the majors\' widened)', () => {
  assert.deepEqual({ ...MASTERY_SLOTS }, { primary: 3, major: 2, minor: 1 });
  const p = hero({ primary: [LB, AX, AR], major: [BL, DO, RU], minor: [SB, MD, SE, SW, CL, JU], atHundred: [LB, AX, AR, BL, DO, RU, SB, MD] });
  for (const s of [LB, AX, AR]) assert.equal(masterSkill(p, s).ok, true, `primary ${s}`);
  assert.deepEqual(masterySlots(p, 'primary'), { used: 3, max: 3, left: 0 });
  assert.equal(masterSkill(p, BL).ok, true); assert.equal(masterSkill(p, DO).ok, true);
  assert.equal(masteryRefusal(p, RU), 'All 2 major masteries are chosen.');
  assert.equal(masterSkill(p, SB).ok, true);
  assert.equal(masteryRefusal(p, MD), 'All 1 minor masteries are chosen.');
  assert.equal(skillAdvanceProgress(p, AR).held, null, 'the third primary climbs past 100');
});

test('MASTER-THREE A MARTIAL CLASS: a warrior with two primary weapons and a third primary skill no longer has to choose between them - two weapons and Dodging, all three mastered, and a path opens on the weapons (mutant: the primary\'s third slot taken back)', () => {
  const p = hero({ primary: [LB, DO, AR], major: [BL, RU, JU], minor: [SB, MD, SE, SW, CL, AX], atHundred: [LB, DO, AR] });
  for (const s of [DO, LB]) assert.equal(masterSkill(p, s).ok, true);
  const rows = masteryChoiceRows(p, AR, { [AR]: 'Archery' });
  assert.equal(rows.at(-2), 'Primary skills: you can master 3.');
  assert.equal(rows.at(-1), 'This would be your last primary mastery.');
  assert.equal(masterSkill(p, AR).ok, true, 'Dodging and Long Blade mastered, Archery still can be');
  // AUDIT FB1026d II C5: the path the third mastery opens - Long Blade and Archery, the two primary weapons (martialPossible
  // alone held under 2/2/1 too: Blunt Weapon and Axe kept a path possible)
  const both = MP.martialOfPair(LB, AR);
  assert.ok(both, 'Long Blade and Archery are a path');
  assert.ok(MP.martialChoices(p).includes(both), `and it is offered (${MP.martialChoices(p).map((x) => x.id)})`);
});

test('MASTER-THREE THE WORDS: every Master Skills text says 3 primary (mutant: a box left saying 2)', () => {
  assert.match(MASTER_SKILLS_ABOUT[0], /You can master 3 primary, 2 major and 1 minor skill/);
  assert.ok(MASTER_SKILLS_OFFER_ROWS.includes('You can master 3 primary, 2 major and 1 minor'));
  assert.ok(MASTER_SKILLS_INFO_ROWS.includes('You can now master 3 primary, 2 major and'));
  for (const rows of [MASTER_SKILLS_ABOUT, MASTER_SKILLS_OFFER_ROWS, MASTER_SKILLS_INFO_ROWS]) for (const r of rows) assert.doesNotMatch(r, /master 2 primary/);
});
