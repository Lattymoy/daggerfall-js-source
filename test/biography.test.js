// S3e: the chargen BIOGRAPHY - the BIOG*.TXT parser, the effect
// grammar, and the flow state. Synthetic pins always run; the corpus
// gate walks all 18 shipping files when ARENA2_PATH is set.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseBiog, biogFileName, BIOG_QUESTION_COUNT, DEFAULT_BACKSTORIES_START } from '../src/formats/biogFile.js';
import {
  applyBiographyEffect, applyBiographyEffects, biographySkillBonuses,
  weaponToArmorMaterial, tagEffect, ITEM_GROUP_BY_ID,
} from '../src/systems/biography.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { ChargenFlow } from '../src/ui/chargen.js';
import { biogButtonRect, BIOG_BUTTONS } from '../src/ui/chargenArt.js';
import { SKILLS, SKILL_COUNT } from '../src/systems/skills.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

// A file in the shipping shape: tab-indented continuations, "N." for
// questions and "a." for answers, effects on their own lines.
const CRAFT = [
  '1.\tFirst question line one',
  '\tline two',
  'a.\tAlpha',
  '\t#4150',
  '\t22 +6',
  'b.\tBeta',
  '\tGP +500',
  '',
  '2.\tSecond question, one line only',
  'a.\tOnly answer',
  '\tr4 +10',
  '',
].join('\r\n');

test('S3e: the BIOG walk - question lines, answers, effects', () => {
  // BiogFile.cs:92-125. A question's first line leads with "N." and
  // the text is everything after the FIRST dot; a second line is taken
  // only when it does not itself look like an answer or question.
  const { questions, backstoryId } = parseBiog(CRAFT, 3);
  assert.equal(backstoryId, DEFAULT_BACKSTORIES_START + 3, 'no # line -> the default base + class');
  assert.deepEqual(questions[0].text, ['First question line one', 'line two']);
  assert.deepEqual(questions[0].answers.map((a) => a.text), ['Alpha', 'Beta']);
  assert.deepEqual(questions[0].answers[0].effects, ['#4150', '22 +6']);
  assert.deepEqual(questions[0].answers[1].effects, ['GP +500']);
  assert.deepEqual(questions[1].text, ['Second question, one line only', ''], 'a one-line question leaves line two empty');
  assert.deepEqual(questions[1].answers[0].effects, ['r4 +10']);
});

test('S3e: a question keeps text past a second dot', () => {
  // C#'s Split('.', 2) keeps the remainder in the last element;
  // JavaScript's limit argument DISCARDS it, which would truncate any
  // question containing a second dot.
  const { questions } = parseBiog('1.\tWhat is it, Mr. Smith?\na.\tYes\n\t22 +1\n', 0);
  assert.equal(questions[0].text[0], 'What is it, Mr. Smith?');
});

test('S3e: the # backstory-id extension does not desync the walk', () => {
  const { backstoryId, questions } = parseBiog(`#9001\r\n\r\n${CRAFT}`, 0);
  assert.equal(backstoryId, 9001);
  assert.equal(questions[0].text[0], 'First question line one', 'question 1 still parses');
});

// ---- the effect grammar (BiogFile.ApplyPlayerEffect) ----
const entity = () => ({ skills: new Array(SKILL_COUNT).fill(30), items: [], gender: 'male', race: 'Breton' });

test('S3e: skill, gold and the gold quirks', () => {
  const e = entity();
  assert.equal(applyBiographyEffect(e, `${SKILLS.Destruction} +6`), 'skill');
  assert.equal(e.skills[SKILLS.Destruction], 36);
  assert.equal(applyBiographyEffect(e, `${SKILLS.Destruction} -4`), 'skill');
  assert.equal(e.skills[SKILLS.Destruction], 32);
  assert.equal(applyBiographyEffect(e, 'GP +500'), 'gold');
  assert.equal(e.items.find((i) => i.group === 'Currency').stackCount, 500);
  // "Correct GP commands with spaces between the sign and the amount"
  // (:271-275) - "+ 250" is ONE argument
  applyBiographyEffect(e, 'GP + 250');
  assert.equal(e.items.find((i) => i.group === 'Currency').stackCount, 750);
  // "The player can't carry negative gold pieces" (:288-289)
  applyBiographyEffect(e, 'GP -5000');
  assert.equal(e.items.find((i) => i.group === 'Currency').stackCount, 0);
});

test('S3e: reputation - social groups land, factions queue', () => {
  const e = entity();
  assert.equal(applyBiographyEffect(e, 'r4 +10'), 'socialRep');
  assert.equal(e.sGroupReputations[4], 10);
  applyBiographyEffect(e, 'r4 -3');
  assert.equal(e.sGroupReputations[4], 7, 'social rep ACCUMULATES');
  assert.equal(applyBiographyEffect(e, 'rf42 +5'), 'factionRep');
  assert.deepEqual(e.pendingFactionRep, [{ id: 42, amount: 5 }]);
});

test('S3e: the six single-field mods ASSIGN, they do not accumulate', () => {
  // :351-423 every one of them reads `= parseResult`
  const e = entity();
  applyBiographyEffect(e, 'RP -10');
  applyBiographyEffect(e, 'RP -5');
  assert.equal(e.biographyResistPoisonMod, -5, 'the second assignment WINS');
  applyBiographyEffects(e, ['FT -5', 'RR -5', 'RD -5', 'MR -5', 'TH -5']);
  assert.equal(e.biographyFatigueMod, -5);
  assert.equal(e.biographyReactionMod, -5);
  assert.equal(e.biographyResistDiseaseMod, -5);
  assert.equal(e.biographyResistMagicMod, -5);
  assert.equal(e.biographyAvoidHitMod, -5);
});

test('S3e: items, and the weapon->armor material map', () => {
  // WeaponToArmorMaterialType (:490-517) - the same NAME on the armor
  // enum, which is the plate row.
  assert.equal(weaponToArmorMaterial(0), ARMOR_MATERIAL.Iron);
  assert.equal(weaponToArmorMaterial(9), ARMOR_MATERIAL.Daedric);
  assert.equal(weaponToArmorMaterial(99), ARMOR_MATERIAL.None);
  assert.equal(ITEM_GROUP_BY_ID[3], 'Weapons');
  assert.equal(ITEM_GROUP_BY_ID[2], 'Armor');
  const e = entity();
  assert.equal(applyBiographyEffect(e, 'IT 3 0 1'), 'item');
  assert.equal(e.items[0].group, 'Weapons');
  assert.equal(e.items[0].material, 1, 'a weapon keeps the weapon material');
  assert.ok(e.items[0].value > 0, 'and is priced, not left at 1');
  assert.equal(applyBiographyEffect(e, 'IT 2 0 0'), 'item');
  assert.equal(e.items[1].material, ARMOR_MATERIAL.Iron, 'armor is mapped through');
});

test('S3e: text commands, the unimplemented three, and the invalid one', () => {
  const e = entity();
  assert.equal(applyBiographyEffect(e, '#4150 0'), 'text');
  assert.equal(applyBiographyEffect(e, '!4156 0'), 'text');
  assert.equal(applyBiographyEffect(e, '?4160 0'), 'text');
  // DFU has never implemented these - applying a guess would be a
  // divergence, not a fix (:427-440)
  for (const c of ['AE 1', 'AF 2', 'AO 3']) assert.equal(applyBiographyEffect(e, c), 'unimplemented');
  // the bare '&' in six of the shipping files hits DFU's own
  // "Invalid command" branch
  assert.equal(applyBiographyEffect(e, '&'), null);
});

test('S3e: tagEffect stamps ONLY the text commands with the question', () => {
  assert.equal(tagEffect('#4150', 7), '#4150 7');
  assert.equal(tagEffect('!4156', 0), '!4156 0');
  assert.equal(tagEffect('22 +6', 7), '22 +6', 'a mechanical effect is untouched');
});

test('S3e: biographySkillBonuses sums only the skill lines', () => {
  const b = biographySkillBonuses([`${SKILLS.Destruction} +6`, 'GP +500', `${SKILLS.Destruction} +2`, '#4150 0']);
  assert.equal(b[SKILLS.Destruction], 8);
  assert.equal(b.length, SKILL_COUNT);
  assert.equal(b.reduce((a, n) => a + n, 0), 8, 'nothing else contributes');
});

// ---- the flow ----
const CAREER = {
  name: 'Mage', hitPointsPerLevel: 8, advancementMultiplier: 1,
  strength: 40, intelligence: 60, willpower: 72, agility: 48,
  endurance: 52, personality: 55, speed: 48, luck: 57,
  primarySkills: [SKILLS.Mysticism, SKILLS.Alteration, SKILLS.Thaumaturgy],
  majorSkills: [SKILLS.Illusion, SKILLS.Destruction, SKILLS.Restoration],
  minorSkills: [SKILLS.Medical, SKILLS.ShortBlade, SKILLS.BluntWeapon, SKILLS.Dragonish, SKILLS.Daedric, SKILLS.Dodging],
};
const flowWithBiog = (biog) => {
  const f = new ChargenFlow([{ name: 'Mage', career: CAREER }], () => 0);
  f.biogFor = () => biog;
  f.state = 'class';
  return f;
};

test('S3e: the flow walks the questions and ends in stats', () => {
  const biog = parseBiog(CRAFT, 0);
  const f = flowWithBiog(biog);
  f.input('confirm');                       // class -> biography
  assert.equal(f.state, 'biography');
  assert.equal(f.biogQuestion().text[0], 'First question line one');
  // an index past THIS question's answers is inert (:121-124)
  assert.equal(f.answerBiography(9), false);
  assert.equal(f.biogQuestionIndex, 0, 'and does not advance');
  f.answerBiography(1);                      // Beta
  assert.equal(f.biogQuestionIndex, 1);
  assert.deepEqual(f.biographyEffects, ['GP +500']);
  f.answerBiography(0);                      // the LAST question
  assert.equal(f.state, 'stats', 'the last answer leaves the screen');
  assert.deepEqual(f.biographyEffects, ['GP +500', 'r4 +10']);
  assert.ok(f.result().biographyEffects.length, 'and the result carries them to finishChargen');
});

test('S3e: text effects reach the result TAGGED with their question', () => {
  const f = flowWithBiog(parseBiog(CRAFT, 0));
  f.input('confirm');
  f.answerBiography(0);                      // Alpha: '#4150' + '22 +6'
  assert.deepEqual(f.biographyEffects, ['#4150 0', '22 +6']);
});

test('S3e: no question set must SKIP the screen, never trap the flow', () => {
  const f = flowWithBiog(null);
  f.input('confirm');
  assert.equal(f.state, 'stats');
  const g = flowWithBiog({ questions: [] });
  g.input('confirm');
  assert.equal(g.state, 'stats');
});

test('S3e: the ten answer buttons, two columns of five', () => {
  // CreateCharBiography.cs:83-92 - even left, odd right, a row every
  // TWO, 149x24 from (10,71).
  assert.equal(BIOG_BUTTONS, 10);
  assert.deepEqual(biogButtonRect(0), [10, 71, 149, 24]);
  assert.deepEqual(biogButtonRect(1), [159, 71, 149, 24]);
  assert.deepEqual(biogButtonRect(2), [10, 95, 149, 24]);
  assert.deepEqual(biogButtonRect(9), [159, 167, 149, 24]);
});

// ---- corpus gate ----
test('S3e: every shipping BIOG file parses to twelve full questions', { skip: skipReal }, () => {
  for (let c = 0; c < 18; c++) {
    const name = biogFileName(c);
    const txt = readFileSync(join(ARENA2, name), 'latin1');
    const { questions } = parseBiog(txt, c);
    assert.equal(questions.length, BIOG_QUESTION_COUNT, name);
    for (const [i, q] of questions.entries()) {
      assert.ok(q.text[0].length, `${name} q${i} has text`);
      assert.ok(q.answers.length > 0, `${name} q${i} has answers`);
      assert.ok(q.answers.length <= BIOG_BUTTONS, `${name} q${i} fits the ten buttons`);
      for (const a of q.answers) assert.ok(a.text.length, `${name} q${i} answer text`);
    }
  }
});

test('S3e: every effect in the corpus is a command we implement', { skip: skipReal }, () => {
  // The only strings that may fall through are the twelve bare '&'
  // lines, which DFU rejects too.
  const warn = console.warn, log = console.log;
  const unknown = [];
  console.warn = (m) => { if (String(m).includes('Invalid command')) unknown.push(String(m)); };
  console.log = () => {};
  try {
    for (let c = 0; c < 18; c++) {
      const txt = readFileSync(join(ARENA2, biogFileName(c)), 'latin1');
      for (const q of parseBiog(txt, c).questions) {
        for (const a of q.answers) applyBiographyEffects(entity(), a.effects);
      }
    }
  } finally { console.warn = warn; console.log = log; }
  assert.equal(unknown.length, 12, 'exactly the twelve bare & lines');
  assert.ok(unknown.every((m) => m.endsWith('&')));
});
