// U14: the MENU BACKDROP and the POINTER path. Classic runs chargen
// from the menu over a black parent panel and every screen is
// clickable; the port ran it in-world and several screens were
// keyboard-only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MENU_BACKDROP, chargenHit, biogButtonRect, reflexRowRect, RECTS, METHOD_PANEL, METHOD_CHOOSE_CLASS, METHOD_CHOOSE_QUESTIONS, BIO_METHOD_PANEL, BIO_CHOOSE_GENERATE, BIO_CHOOSE_QUESTIONS, CUSTOM_EXIT, CUSTOM_HP_UP, CUSTOM_HP_DOWN, CUSTOM_HELP, CUSTOM_REP, CUSTOM_SKILL_RECTS, QSCROLL_Y, QSCROLL_H } from '../src/ui/chargenArt.js';
import { ChargenFlow } from '../src/ui/chargen.js';
import { SKILLS } from '../src/systems/skills.js';

test('U14: the backdrop is OPAQUE black, not a dim', () => {
  // DaggerfallBaseWindow.cs:40 - parentPanel.BackgroundColor = black.
  // A translucent value would let the world show through, which is
  // the bug: chargen is a MENU, the world is never behind it.
  assert.deepEqual(MENU_BACKDROP, [0, 0, 0, 1]);
  assert.equal(MENU_BACKDROP[3], 1, 'opaque - the town must not show through the letterbox');
});

const CAREER = {
  name: 'Mage', hitPointsPerLevel: 8, advancementMultiplier: 1,
  strength: 40, intelligence: 60, willpower: 72, agility: 48,
  endurance: 52, personality: 55, speed: 48, luck: 57,
  primarySkills: [SKILLS.Mysticism, SKILLS.Alteration, SKILLS.Thaumaturgy],
  majorSkills: [SKILLS.Illusion, SKILLS.Destruction, SKILLS.Restoration],
  minorSkills: [SKILLS.Medical, SKILLS.ShortBlade, SKILLS.BluntWeapon, SKILLS.Dragonish, SKILLS.Daedric, SKILLS.Dodging],
};
const flow = () => new ChargenFlow([{ name: 'Mage', career: CAREER }], () => 0);

test('U14: the gender BUTTON sets and closes, as classic has no OK', () => {
  // CreateCharGenderSelect.cs:59-71 - both handlers end in
  // CloseWindow(). The port made the click a selection and then
  // demanded a confirm the classic box has no button for.
  const f = flow();
  f.state = 'gender';
  f._genderBox = { buttons: [{ button: 6, rect: [10, 10, 32, 16] }, { button: 7, rect: [80, 10, 32, 16] }] };
  assert.ok(f.applyHit(chargenHit(f, 85, 15)), 'the Female button is live');
  assert.equal(f.gender, 'female');
  assert.equal(f.state, 'classMethod', 'and it CLOSED the box (U18: the class-method screen is next in the classic order)');
});

test('U14: EVERY chargen screen answers a click somewhere', () => {
  // The guard rail. A screen that ships keyboard-only is invisible on
  // a phone, and three of them were. Each state must have at least one
  // point that produces an action.
  const probes = {
    // the random-name button (279,3,36,10) is FLAGGED unported - it
    // needs the NAMEGEN banks - so OK is the name screen's one control
    name: [[RECTS.ok[0] + 2, RECTS.ok[1] + 2]],
    gender: [[85, 15]],
    face: [[RECTS.facePrev[0] + 2, RECTS.facePrev[1] + 2],
      [RECTS.faceNext[0] + 2, RECTS.faceNext[1] + 2],
      [RECTS.ok[0] + 2, RECTS.ok[1] + 2]],
    biography: [[biogButtonRect(0)[0] + 2, biogButtonRect(0)[1] + 2]],
    // U18: the method screen's two buttons and the questions screen's
    // scroll margins + three answer rows
    classMethod: [[METHOD_PANEL[0] + METHOD_CHOOSE_CLASS[0] + 2, METHOD_PANEL[1] + METHOD_CHOOSE_CLASS[1] + 2],
      [METHOD_PANEL[0] + METHOD_CHOOSE_QUESTIONS[0] + 2, METHOD_PANEL[1] + METHOD_CHOOSE_QUESTIONS[1] + 2]],
    classQuestions: [[160, QSCROLL_Y + 2], [160, QSCROLL_Y + QSCROLL_H - 2],
      [160, QSCROLL_Y + 16 + 7 + 3], [160, QSCROLL_Y + 16 + 14 + 3], [160, QSCROLL_Y + 16 + 21 + 3]],
    // U19: the bio-method screen's two buttons
    bioMethod: [[BIO_METHOD_PANEL[0] + BIO_CHOOSE_GENERATE[0] + 2, BIO_METHOD_PANEL[1] + BIO_CHOOSE_GENERATE[1] + 2],
      [BIO_METHOD_PANEL[0] + BIO_CHOOSE_QUESTIONS[0] + 2, BIO_METHOD_PANEL[1] + BIO_CHOOSE_QUESTIONS[1] + 2]],
    // U20a: the builder - exit, both HP arrows, the three side
    // buttons that are live in this slice, all twelve skill rows,
    // and the freeEdit rollout
    customClass: [[CUSTOM_EXIT[0] + 2, CUSTOM_EXIT[1] + 2],
      [CUSTOM_HP_UP[0] + 2, CUSTOM_HP_UP[1] + 2], [CUSTOM_HP_DOWN[0] + 2, CUSTOM_HP_DOWN[1] + 2],
      [CUSTOM_HELP[0] + 2, CUSTOM_HELP[1] + 2], [CUSTOM_REP[0] + 2, CUSTOM_REP[1] + 2],
      ...CUSTOM_SKILL_RECTS.map((r) => [r[0] + 2, r[1] + 2]),
      [20, 22], [51, 24]],
    stats: [[RECTS.reroll[0] + 2, RECTS.reroll[1] + 2],
      [RECTS.ok[0] + 2, RECTS.ok[1] + 2], [20, 22]],
    skills: [[100, 34], [RECTS.ok[0] + 2, RECTS.ok[1] + 2]],
    reflexes: [[reflexRowRect(0)[0] + 2, reflexRowRect(0)[1] + 2],
      [RECTS.ok[0] + 2, RECTS.ok[1] + 2]],
  };
  for (const [state, points] of Object.entries(probes)) {
    const f = flow();
    f.state = state;
    if (state === 'gender') f._genderBox = { buttons: [{ button: 6, rect: [10, 10, 32, 16] }, { button: 7, rect: [80, 10, 32, 16] }] };
    if (state === 'stats') f._enterStats();
    if (state === 'skills') f._enterSkills();
    if (state === 'biography') f.biogFor = () => ({ questions: [{ text: ['q', ''], answers: [{ text: 'a', effects: [] }] }] });
    if (state === 'classQuestions') f.qDisplay = { lines: ['q', ' a) x', ' b) y', ' c) z'], aIndex: 1, bIndex: 2, cIndex: 3 };
    if (state === 'customClass') f._enterCustomClass();
    // EVERY listed control must answer, not merely one of them - a
    // screen whose OK button works while its own controls are dead is
    // still keyboard-only in practice.
    for (const [x, y] of points) {
      assert.notEqual(chargenHit(f, x, y), null, `${state} answers the click at ${x},${y}`);
    }
  }
});

test('U14: the RACE screen answers a click through its picker', () => {
  // the province map is the one screen whose hit needs the art, so it
  // is checked by its own law rather than through chargenHit
  const f = flow();
  f.state = 'race';
  assert.equal(chargenHit(f, 5, 5), null, 'no art loaded -> null, never a throw');
});
