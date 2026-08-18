// U19: the biography-METHOD screen - CreateCharChooseBio (MIT,
// Daggerfall Workshop) + the wizard's CreateCharChooseBioWindow_OnClose
// arms. The last WizardStages entry the port skipped: every
// class-accept arm goes to SetChooseBioWindow, the GENERATE arm
// auto-answers the questions at rand.Next(0, Count) each, and the
// name screen's cancel returns HERE.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChargenFlow } from '../src/ui/chargen.js';
import { chargenHit, BIO_METHOD_PANEL, BIO_CHOOSE_GENERATE, BIO_CHOOSE_QUESTIONS } from '../src/ui/chargenArt.js';
import { SKILLS } from '../src/systems/skills.js';

const CAREER = {
  name: 'Mage', hitPointsPerLevel: 8, advancementMultiplier: 1,
  strength: 40, intelligence: 60, willpower: 72, agility: 48,
  endurance: 52, personality: 55, speed: 48, luck: 57,
  primarySkills: [SKILLS.Mysticism, SKILLS.Alteration, SKILLS.Thaumaturgy],
  majorSkills: [SKILLS.Illusion, SKILLS.Destruction, SKILLS.Restoration],
  minorSkills: [SKILLS.Medical, SKILLS.ShortBlade, SKILLS.BluntWeapon, SKILLS.Dragonish, SKILLS.Daedric, SKILLS.Dodging],
};

/** Three questions, two answers each, every effect distinct - so a
 *  pick sequence is READABLE from the collected effects. */
const BIOG = {
  backstoryId: 0,
  questions: [
    { text: ['Q1', ''], answers: [{ text: 'a', effects: ['A0'] }, { text: 'b', effects: ['A1', 'A1b'] }] },
    { text: ['Q2', ''], answers: [{ text: 'a', effects: ['B0'] }, { text: 'b', effects: ['B1'] }] },
    { text: ['Q3', ''], answers: [{ text: 'a', effects: ['C0'] }, { text: 'b', effects: ['C1'] }] },
  ],
};

const flow = (rolls = () => 0) => {
  const f = new ChargenFlow([{ name: 'Mage', career: CAREER }], rolls);
  f.biogFor = () => BIOG;
  return f;
};

test('U19: every class-accept arm lands on the METHOD screen, none on the questions', () => {
  // ClassSelectWindow_OnClose (:365), the custom arm (:401) and the
  // questions arm (:344) all call SetChooseBioWindow.
  const f = flow();
  f.state = 'class';
  f.input('confirm');                        // Return uses the row; no description source -> the pick stands
  assert.equal(f.state, 'bioMethod');
  // and with NO question set the stage is skipped rather than trapping
  const g = flow();
  g.biogFor = () => null;
  g.state = 'class';
  g.input('confirm');
  assert.equal(g.state, 'name');
});

test('U19: the QUESTIONS arm enters the biography over a fresh reset', () => {
  const f = flow();
  f.state = 'bioMethod';
  f.biographyEffects = ['stale'];
  f.input('down');                           // cursor 1 = answer questions (the bottom button)
  f.input('confirm');
  assert.equal(f.state, 'biography');
  assert.deepEqual(f.biographyEffects, [], 'a fresh BiogFile - the stale answers are gone');
  assert.equal(f.biogQuestionIndex, 0);
});

test('U19: the GENERATE arm answers every question at rand.Next(0, Count)', () => {
  // CreateCharChooseBioWindow_OnClose (:427-441): a fresh BiogFile,
  // `rand.Next(0, answers.Count)` per question, every chosen answer's
  // effects added tagged with its question index - the engine PRNG
  // rides the flow's injectable rolls (Ledger A).
  const low = flow(() => 0);
  low.state = 'bioMethod';
  low.input('confirm');                      // cursor 0 = generate (the top button)
  assert.deepEqual(low.biographyEffects, ['A0', 'B0', 'C0'], 'rolls 0 picks answer a everywhere');
  assert.equal(low.state, 'name', 'no reputation-box rows without art -> straight to the name screen');
  assert.ok(low.repChanges, 'and the rep totals digested (DigestRepChanges)');

  const high = flow(() => 0.999);
  high.state = 'bioMethod';
  high.input('confirm');
  assert.deepEqual(high.biographyEffects, ['A1', 'A1b', 'B1', 'C1'],
    'rolls .999 picks the LAST answer everywhere - floor(r * Count) - and EVERY effect of a multi-effect answer lands, tagged through the same tagEffect the manual path uses');
});

test('U19: generating twice cannot double-apply', () => {
  const f = flow(() => 0);
  f.state = 'bioMethod';
  f.input('confirm');
  assert.equal(f.biographyEffects.length, 3);
  f._enterBioMethod();
  f.input('confirm');
  assert.equal(f.biographyEffects.length, 3, 'the reset rides EVERY arm (the fresh-BiogFile law)');
});

test('U19: Escape falls to the class LIST, and the name cancel returns HERE', () => {
  // the cancel arm (:458-461) is SetClassSelectWindow
  const f = flow();
  f.state = 'bioMethod';
  f.input('back');
  assert.equal(f.state, 'class');
  // NameSelectWindow_OnClose (:483-493) cancels to SetChooseBioWindow
  const g = flow();
  g.state = 'name';
  g._nameRaceId = g.race.id; g._nameGender = g.gender;
  g.input('back');
  assert.equal(g.state, 'bioMethod', 'the method screen, not the questions the port had collapsed onto');
  // and the BIOGRAPHY's own cancel comes here too (:477-480)
  const h = flow();
  h.state = 'biography';
  h.input('back');
  assert.equal(h.state, 'bioMethod');
});

test('U19: the pointer path - both DFU rects, the dead zone, the modal box', () => {
  const f = flow();
  f.state = 'bioMethod';
  const at = (r) => [BIO_METHOD_PANEL[0] + r[0] + 2, BIO_METHOD_PANEL[1] + r[1] + 2];
  assert.deepEqual(chargenHit(f, ...at(BIO_CHOOSE_GENERATE)), { bioMethod: 'generate' });
  assert.deepEqual(chargenHit(f, ...at(BIO_CHOOSE_QUESTIONS)), { bioMethod: 'questions' });
  assert.equal(chargenHit(f, BIO_METHOD_PANEL[0] + 2, BIO_METHOD_PANEL[1] + 2), null, 'the panel outside the buttons is dead');
  // the buttons apply - the click chooses AND closes
  assert.ok(f.applyHit({ bioMethod: 'questions' }));
  assert.equal(f.state, 'biography');
  // the reputation box is modal over this screen and ClickAnywhereToClose
  const g = flow(() => 0);
  g.state = 'bioMethod';
  g.biogRepBox = [{ text: 'Commoners: -5', center: false }];
  assert.equal(chargenHit(g, ...at(BIO_CHOOSE_GENERATE)), 'confirm', 'the box eats the buttons');
  g.applyHit('confirm');
  assert.equal(g.biogRepBox, null);
  assert.equal(g.state, 'name', 'closing the box goes to the name screen (ReputationBox_OnClose)');
});
