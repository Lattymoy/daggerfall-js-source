// U17 - the class picker's real selection model, and the three skill
// spinners. Both are ListBox/rollout behaviour the port had collapsed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChargenFlow } from '../src/ui/chargen.js';
import { DOUBLE_CLICK_DELAY_MS } from '../src/ui/chargenArt.js';
import { SKILLS } from '../src/systems/skills.js';

const career = (name) => ({
  name, hitPointsPerLevel: 8, advancementMultiplier: 1,
  strength: 40, intelligence: 60, willpower: 72, agility: 48,
  endurance: 52, personality: 55, speed: 48, luck: 57,
  primarySkills: [SKILLS.Mysticism, SKILLS.Alteration, SKILLS.Thaumaturgy],
  majorSkills: [SKILLS.Illusion, SKILLS.Destruction, SKILLS.Restoration],
  minorSkills: [SKILLS.Medical, SKILLS.ShortBlade, SKILLS.BluntWeapon, SKILLS.Dragonish, SKILLS.Daedric, SKILLS.Dodging],
});
const CAREERS = ['Mage', 'Spellsword', 'Battlemage'].map((n) => ({ name: n, career: career(n) }));
/** at the class screen, with a description source attached */
function atClass({ describe = (i) => [{ text: `Class ${i} description`, center: false }] } = {}) {
  const f = new ChargenFlow(CAREERS, () => 0);
  f.input('confirm'); f.input('confirm');   // race -> gender -> class
  f.describeClass = describe;
  return f;
}

test('U17: a SINGLE click on a class row only selects it', () => {
  // ListBox.MouseClick (:500-504) sets selectedIndex and raises
  // OnSelectItem. It does not pick. The port picked outright and then
  // demanded a keyboard confirm the picker has no button for, so on a
  // phone the class screen was a dead end - which is the bug.
  const f = atClass();
  f.clickClassRow(2, 1000);
  assert.equal(f.classIndex, 2, 'the row is selected');
  assert.equal(f.state, 'class', 'and the screen has NOT moved on');
  assert.equal(f.classConfirm, null, 'nor has anything been picked');
});

test('U17: a DOUBLE click picks it, and opens the description box', () => {
  // ListBox.MouseDoubleClick (:507-512) -> UseSelectedItem ->
  // OnItemPicked -> the class description in a Yes/No box on
  // TEXT.RSC 2100 + index (CreateCharClassSelect.cs:84-93).
  const f = atClass();
  f.clickClassRow(1, 1000);
  f.clickClassRow(1, 1000 + DOUBLE_CLICK_DELAY_MS - 1);
  assert.ok(f.classConfirm, 'the description box is open');
  assert.equal(f.state, 'class', 'and Yes has not been pressed yet');
});

test('U17: the double-click window is DOUBLE_CLICK_DELAY_MS, on time alone', () => {
  // BaseScreenComponent.cs:54 doubleClickDelay = 0.3f, tested at :691
  // against time and nothing else.
  assert.equal(DOUBLE_CLICK_DELAY_MS, 300);
  const slow = atClass();
  slow.clickClassRow(1, 1000);
  slow.clickClassRow(1, 1000 + DOUBLE_CLICK_DELAY_MS);
  assert.equal(slow.classConfirm, null, 'one millisecond too late is two single clicks');

  // and the second click need NOT be the same row: MouseClick has
  // already moved the selection by the time MouseDoubleClick reads it
  const other = atClass();
  other.clickClassRow(0, 500);
  other.clickClassRow(2, 600);
  assert.ok(other.classConfirm, 'still a double click');
  assert.equal(other.classIndex, 2, 'and it picks the SECOND row');
});

test('U17: a third click does not re-trigger off the second', () => {
  // The clock resets when a double click fires, or three evenly
  // spaced clicks would pick twice.
  const f = atClass();
  f.clickClassRow(1, 100);
  f.clickClassRow(1, 200);
  assert.ok(f.classConfirm);
  f.classConfirm = null;
  f.clickClassRow(1, 300);
  assert.equal(f.classConfirm, null, 'the third click starts a new pair');
});

test('U17: Yes leaves the screen, No returns to the list', () => {
  // ConfirmClassPopup_OnButtonClick (:99-113): Yes closes both
  // windows, No drops the selection and cancels the box.
  const yes = atClass();
  yes.useClass();
  assert.ok(yes.classConfirm);
  yes.applyHit({ confirmClass: true });
  assert.equal(yes.classConfirm, null);
  assert.notEqual(yes.state, 'class', 'Yes leaves the picker');

  const no = atClass();
  no.useClass();
  no.applyHit({ cancelClass: true });
  assert.equal(no.classConfirm, null, 'the box closes');
  assert.equal(no.state, 'class', 'and the list is still there');
});

test('U17: Return uses the selected item, the same door as the double click', () => {
  // ListBox.cs:296-297.
  const f = atClass();
  f.classIndex = 2;
  f.input('confirm');
  assert.ok(f.classConfirm, 'Enter opens the same box');
  f.input('back');
  assert.equal(f.classConfirm, null);
  assert.equal(f.state, 'class');
  f.input('confirm');
  f.input('confirm');                       // Yes
  assert.notEqual(f.state, 'class');
});

test('U17: with no description available the pick simply stands', () => {
  // TEXT.RSC may not be loaded (the art-less fallback). A missing
  // description must not strand the player on the picker.
  const f = atClass();
  f.describeClass = () => null;
  f.useClass();
  assert.equal(f.classConfirm, null);
  assert.notEqual(f.state, 'class', 'the flow moves on rather than hanging');
});

test('U17: each skill GROUP has its own spinner selection', () => {
  // SkillsRollout.cs:44-46 keeps three selected indices and :240-262
  // builds three spinners, each positioned at (203, top + 10*index)
  // by its own SelectXSkill (:356-372). The port drew ONE spinner on a
  // shared row, so two of the three pools were invisible until the
  // cursor walked into them.
  const f = new ChargenFlow(CAREERS, () => 0);
  f.state = 'skills';
  f._enterSkills(true);
  assert.deepEqual(f.skillSel, { primary: 0, major: 0, minor: 0 });

  // walking the flat keyboard cursor onto a row selects it WITHIN its group
  f.input('down');                          // primary row 1
  assert.deepEqual(f.skillSel, { primary: 1, major: 0, minor: 0 });
  for (let i = 0; i < 3; i++) f.input('down');   // through primary 2, into major 0 then 1
  assert.equal(f.skillCursor, 4);
  assert.deepEqual(f.skillSel, { primary: 2, major: 1, minor: 0 },
    'primary keeps the LAST primary row walked while major moves on');

  // A pointer JUMPS rather than walking, which is how DFU's own rows
  // are reached - and then a group the cursor never touched keeps its
  // selection. (Walking necessarily re-selects every row it passes
  // through, which is the flat keyboard cursor's own consequence and
  // not something DFU has an opinion about: classic has no keyboard
  // on this screen at all.)
  f.applyHit({ setSkillCursor: 8 });          // flat 8 = minor row 2 (3 primary + 3 major before it)
  assert.deepEqual(f.skillSel, { primary: 2, major: 1, minor: 2 },
    'the jump touched only minor; primary and major stand');
});

test('U17: a group spinner spends that group\'s pool, not the cursor\'s', () => {
  const f = new ChargenFlow(CAREERS, () => 0);
  f.state = 'skills';
  f._enterSkills(true);
  const pools = { ...f.pools };
  // the cursor sits in primary; click the MINOR group's spinner
  assert.equal(f.skillCursor, 0);
  f.applyHit({ skillStep: 1, group: 'minor' });
  assert.equal(f.pools.minor, pools.minor - 1, 'the minor pool paid');
  assert.equal(f.pools.primary, pools.primary, 'and primary was untouched');
  // it spent the MINOR group's own selected skill
  const minorIds = f.skillRows().find(([g]) => g === 'minor')[1];
  assert.equal(f.skills[minorIds[0]], f.rolledSkills[minorIds[0]] + 1);
});

test('U17: re-entering the skills screen resets all three selections', () => {
  // SelectPrimarySkill(0) and its two siblings run at construction
  // (SkillsRollout.cs:245 and the two after it).
  const f = new ChargenFlow(CAREERS, () => 0);
  f.state = 'skills';
  f._enterSkills(true);
  f.skillSel = { primary: 2, major: 1, minor: 4 };
  f.classIndex = 1;                          // a different class forces the reroll
  f._enterSkills();
  assert.deepEqual(f.skillSel, { primary: 0, major: 0, minor: 0 });
});
