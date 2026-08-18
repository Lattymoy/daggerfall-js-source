// U15: THE CLASSIC WIZARD ORDER + the random-name button. The order
// was flagged from S3c on and was finally FORCED: CreateCharNameSelect
// disables the random button without a race template, so the name
// screen cannot precede the race and still be classic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChargenFlow } from '../src/ui/chargen.js';
import { chargenHit, RECTS, RANDOM_BUTTON_BG, RANDOM_LABEL } from '../src/ui/chargenArt.js';
import { getNameBank, BANK_TYPES, fullName, GENDERS } from '../src/characters/nameHelper.js';
import { srand } from '../src/formats/dfRandom.js';
import { SKILLS } from '../src/systems/skills.js';

const CAREER = {
  name: 'Mage', hitPointsPerLevel: 8, advancementMultiplier: 1,
  strength: 40, intelligence: 60, willpower: 72, agility: 48,
  endurance: 52, personality: 55, speed: 48, luck: 57,
  primarySkills: [SKILLS.Mysticism, SKILLS.Alteration, SKILLS.Thaumaturgy],
  majorSkills: [SKILLS.Illusion, SKILLS.Destruction, SKILLS.Restoration],
  minorSkills: [SKILLS.Medical, SKILLS.ShortBlade, SKILLS.BluntWeapon, SKILLS.Dragonish, SKILLS.Daedric, SKILLS.Dodging],
};
const flow = () => new ChargenFlow([{ name: 'Mage', career: CAREER }], () => 0);

test('U15: the wizard runs in DFU\'s own order', () => {
  // WizardStages:63-79 - SelectRace, SelectGender, SelectClass*,
  // BiographyQuestions, SelectName, SelectFace, AddBonusStats,
  // AddBonusSkills, SelectReflexes. The port asked the NAME first.
  const f = flow();
  const walked = [f.state];
  f.input('confirm');                       // race (no description) -> gender
  walked.push(f.state);
  f.input('confirm');                       // gender -> class
  walked.push(f.state);
  f.input('confirm');                       // class, no biography set -> name
  walked.push(f.state);
  for (const c of 'Mac') f.input('char:' + c);
  f.input('confirm');                       // name -> face
  walked.push(f.state);
  f.input('confirm');                       // face -> stats
  walked.push(f.state);
  assert.deepEqual(walked, ['race', 'gender', 'class', 'name', 'face', 'stats']);
});

test('U15: RACE is the first screen and BACK cannot leave it', () => {
  const f = flow();
  assert.equal(f.state, 'race');
  f.input('back');
  assert.equal(f.state, 'race', 'there is nothing before it to go back to');
});

// AUDIT 17j F2: this pin USED to assert class -> gender, which is the
// STATES order read backwards, not DFU's handler table. DFU skips the
// gender screen: ClassSelectWindow_OnClose's cancel arm calls
// SetRaceSelectWindow. The pin asserted the bug.
test('U15/17j: BACK follows DFU\'s cancel arms, not the STATES order', () => {
  const f = flow();
  f.input('confirm'); f.input('confirm');    // -> class
  assert.equal(f.state, 'class');
  f.input('back');
  assert.equal(f.state, 'race', 'ClassSelectWindow_OnClose cancels to the RACE screen, skipping gender');
  // and the gender screen itself does step back one, because its own
  // cancel arm names the race window too (GenderSelectWindow_OnClose)
  const g = flow();
  g.input('confirm');
  assert.equal(g.state, 'gender');
  g.input('back');
  assert.equal(g.state, 'race');
});

test('U15: the name banks map by race, with the Argonian quirk', () => {
  // MacroHelper.cs:344-366. DFU's own enum comment: "Imperial names
  // appear where one would expect Argonian names."
  assert.equal(getNameBank('Breton'), BANK_TYPES.Breton);
  assert.equal(getNameBank('Redguard'), BANK_TYPES.Redguard);
  assert.equal(getNameBank('Nord'), BANK_TYPES.Nord);
  assert.equal(getNameBank('DarkElf'), BANK_TYPES.DarkElf);
  assert.equal(getNameBank('HighElf'), BANK_TYPES.HighElf);
  assert.equal(getNameBank('WoodElf'), BANK_TYPES.WoodElf);
  assert.equal(getNameBank('Khajiit'), BANK_TYPES.Khajiit);
  assert.equal(getNameBank('Argonian'), BANK_TYPES.Imperial, 'the quirk');
  assert.equal(getNameBank('Vampire'), BANK_TYPES.Breton, "C#'s default shares the Breton arm");
});

test('U15: the RANDOM button fills the name from the race bank', () => {
  const f = flow();
  f.raceIndex = 6;                           // Khajiit
  f.gender = 'female';
  f.state = 'name';
  assert.equal(f.name, '');
  const hit = chargenHit(f, RECTS.randomName[0] + 2, RECTS.randomName[1] + 2);
  assert.deepEqual(hit, { randomName: true }, 'the button is live, not inert');
  // seed the shared DFRandom stream so the button and the direct call
  // draw the SAME name - the strongest statement that the button runs
  // NameHelper.FullName over this race's bank and nothing else
  srand(12345);
  f.applyHit(hit);
  assert.ok(f.name.length > 0, 'a name lands');
  srand(12345);
  assert.equal(f.name, fullName(getNameBank('Khajiit'), GENDERS.Female));
  // a different RACE draws from a different bank
  const g = flow();
  g.raceIndex = 1;                           // Redguard
  g.gender = 'male';
  g.state = 'name';
  srand(999);
  g.applyHit({ randomName: true });
  srand(999);
  assert.equal(g.name, fullName(getNameBank('Redguard'), GENDERS.Male));
  assert.equal(g.name.includes(' '), false, 'a Redguard has a single name, verbatim');
});

test('U15: the button carries its own classic colours', () => {
  // CreateCharNameSelect.cs:79-81 - a grey 0.75-alpha backing with a
  // black-shadowed label.
  assert.deepEqual(RANDOM_BUTTON_BG, [0.5, 0.5, 0.5, 0.75]);
  assert.equal(RANDOM_LABEL, 'Random');
  assert.deepEqual(RECTS.randomName, [279, 3, 36, 10]);
});
