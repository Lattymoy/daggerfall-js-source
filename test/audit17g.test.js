// AUDIT 17g: the deep parity pass over U10 (chargen art) and U11 (the
// parchment message box). Every pin fails under a one-character
// mutation of the law it names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutMessageBox, drawMessageBox, MB_BUTTONS, BUTTON_TEXT_DISTANCE } from '../src/ui/messageBox.js';
import { chargenHit, CLASS_LIST_ROWS } from '../src/ui/chargenArt.js';
import { ChargenFlow } from '../src/ui/chargen.js';
import { TextRsc, RSC } from '../src/formats/textRsc.js';
import { SKILLS } from '../src/systems/skills.js';

const font = (w = 4, h = 9) => ({ fnt: { fixedHeight: h, fixedWidth: w, glyphWidth: () => w } });

// ---- F2: per-row alignment ----
test('17g F2: a box keeps each row\'s OWN alignment', () => {
  // MultiFormatTextLabel.cs:341-344 sets HorizontalAlignment.Center on
  // rows a JustifyCenter closed and leaves the rest LEFT. The box
  // centred everything, which draws 80 of TEXT.RSC's 676 multi-row
  // records wrong (53 are entirely left, 27 mix the two).
  const rows = [{ text: 'wide left row here', center: false }, { text: 'mid', center: true }];
  const box = layoutMessageBox(font(), rows);
  assert.equal(box.rows.length, 2);
  assert.deepEqual(box.rows.map((r) => r.center), [false, true]);
  // a bare STRING still centres - that is what a caller composing its
  // own prompt (the gender box) wants
  assert.deepEqual(layoutMessageBox(font(), ['hi']).rows, [{ text: 'hi', center: true }]);
});

test('17g F2: TEXT.RSC really does mix the two alignments', () => {
  // the pin above is only worth having because records do this - one
  // record with a JustifyLeft row and a JustifyCenter row. Crafted in
  // the shape the reader parses (headerLength then id/offset pairs).
  const ch = (str) => [...str].map((c) => c.charCodeAt(0));
  const body = ch('L').concat([RSC.JustifyLeft], ch('C'), [RSC.JustifyCenter, RSC.EndOfRecord]);
  const head = [12, 0, /* id 700 */ 188, 2, 12, 0, 0, 0];
  const bytes = new Uint8Array(12 + body.length);
  bytes.set(head, 0);
  bytes.set(body, 12);
  const t = new TextRsc().load(bytes);
  assert.deepEqual(t.linesById(700), [{ text: 'L', center: false }, { text: 'C', center: true }]);
});

// ---- F3: the hit path must never throw ----
test('17g F3: chargenHit returns null without art instead of throwing', () => {
  // every branch but `class` already did; that one derefed the art
  // directly, so the ONE state that needs it was the one that crashed.
  const flow = { state: 'class', careers: [{ name: 'Mage' }], classListIndex: 0, classScroll: 0 };
  assert.equal(chargenHit(flow, 100, 100), null);
  for (const state of ['name', 'race', 'gender', 'face', 'stats', 'skills', 'done']) {
    assert.doesNotThrow(() => chargenHit({ ...flow, state, skillRows: () => [], cursor: 0 }, 100, 100), state);
  }
});

// ---- F4: the input box must not resize as you type ----
test('17g F4: sizingRows fixes the box at its widest', () => {
  const f = font();
  const short = layoutMessageBox(f, ['prompt', ' > a_'], [], { sizingRows: ['prompt', ` > ${'M'.repeat(20)}_`] });
  const long = layoutMessageBox(f, ['prompt', ` > ${'M'.repeat(20)}_`], [], { sizingRows: ['prompt', ` > ${'M'.repeat(20)}_`] });
  assert.equal(short.w, long.w, 'the parchment must not grow a slice mid-word');
  assert.equal(short.h, long.h);
  // and WITHOUT the option it does grow, which is the bug
  assert.ok(layoutMessageBox(f, ['prompt', ' > a_']).w < long.w);
});

// ---- F6: the class list scrolls MINIMALLY ----
const CAREER = {
  name: 'C', hitPointsPerLevel: 8, advancementMultiplier: 1,
  strength: 40, intelligence: 60, willpower: 72, agility: 48,
  endurance: 52, personality: 55, speed: 48, luck: 57,
  primarySkills: [SKILLS.Mysticism, SKILLS.Alteration, SKILLS.Thaumaturgy],
  majorSkills: [SKILLS.Illusion, SKILLS.Destruction, SKILLS.Restoration],
  minorSkills: [SKILLS.Medical, SKILLS.ShortBlade, SKILLS.BluntWeapon, SKILLS.Dragonish, SKILLS.Daedric, SKILLS.Dodging],
};
const flowAtClass = () => {
  const careers = Array.from({ length: 18 }, (_, i) => ({ name: `c${i}`, career: CAREER }));
  const f = new ChargenFlow(careers, () => 0);
  f.state = 'class';
  return f;
};

test('17g F6: the class list window moves only when the selection leaves it', () => {
  // ListBox.cs:709-730 - SelectPrevious pulls the window up only when
  // the selection falls above it, SelectNext pushes it down only when
  // it falls below. The port recomputed a CENTRED window at draw time,
  // so the whole list jumped on every arrow.
  const f = flowAtClass();
  assert.equal(CLASS_LIST_ROWS, 9);
  assert.equal(f.classScroll, 0);
  for (let i = 0; i < 8; i++) f.input('down');      // to index 8, the last visible row
  assert.equal(f.classListIndex, 8);
  assert.equal(f.classScroll, 0, 'still inside the window: no scroll at all');
  f.input('down');                                   // index 9 falls below
  assert.equal(f.classScroll, 1, 'and the window moves by exactly one');
  for (let i = 0; i < 4; i++) f.input('up');         // back to 5, inside again
  assert.equal(f.classListIndex, 5);
  assert.equal(f.classScroll, 1, 'coming back does NOT pull the window');
  f.input('up'); f.input('up');                      // 3, still >= scroll
  assert.equal(f.classScroll, 1);
  f.input('up'); f.input('up'); f.input('up');       // 0, now above
  assert.equal(f.classListIndex, 0);
  assert.equal(f.classScroll, 0);
  // and the window never runs past the end
  for (let i = 0; i < 17; i++) f.input('down');
  assert.equal(f.classListIndex, 17);
  assert.equal(f.classScroll, 18 - CLASS_LIST_ROWS);
});

// ---- F5: both confirm paths open the same box ----
test('17g F5: a keyboard confirm opens the race box, not a silent skip', () => {
  const f = new ChargenFlow([{ name: 'C', career: CAREER }], () => 0);
  f.state = 'race';
  // the description source is the seam; with rows it must OPEN the box
  f.describeRace = () => [{ text: 'a race', center: true }];
  f.input('confirm');
  assert.equal(f.state, 'race', 'the box is modal - the screen has not advanced');
  assert.ok(f.raceConfirm?.length);
  f.input('back');                                   // NO
  assert.equal(f.raceConfirm, null);
  assert.equal(f.state, 'race');
  f.input('confirm');                                // reopen
  f.input('confirm');                                // YES
  assert.equal(f.state, 'gender');
  // with NO description (art-less), confirm must still advance
  const g = new ChargenFlow([{ name: 'C', career: CAREER }], () => 0);
  g.state = 'race';
  g.describeRace = () => [];
  g.input('confirm');
  assert.equal(g.state, 'gender', 'no art must never trap the flow');
});
