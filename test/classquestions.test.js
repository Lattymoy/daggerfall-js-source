// U18: the CLASS QUESTIONS path - CreateCharChooseClassGen +
// CreateCharClassQuestions (MIT, Daggerfall Workshop), the wizard's
// GenerateClass stage. The library parse, the FALL.EXE answer table,
// the CLASSES.DAT results walk, the ten-unique pick, and the flow's
// two new states.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ANSWER_TABLE, QUESTION_COUNT, NO_CLASS_INDEX, QUESTION_LIBRARY_SIZE,
  parseQuestionLibrary, displayQuestion, pickQuestionIndices,
  answerWeightIndex, getHeaderIndex, getClassIndex, resolveClassIndex,
} from '../src/systems/classQuestions.js';
import { GfxFile } from '../src/formats/gfxFile.js';
import { TextRsc } from '../src/formats/textRsc.js';
import { ChargenFlow } from '../src/ui/chargen.js';
import { chargenHit, METHOD_PANEL, METHOD_CHOOSE_CLASS, METHOD_CHOOSE_QUESTIONS, QSCROLL_Y, QSCROLL_H, QSCROLL_TEXT_OFFSET, QSCROLL_FRAMES, QUESTION_ROW_H } from '../src/ui/chargenArt.js';
import { SKILLS } from '../src/systems/skills.js';

const ARENA2 = process.env.ARENA2_PATH;

// ---- the FALL.EXE answer table, pinned whole ----

test('U18: the answer table is FALL.EXE 0x0059820C, byte for byte', () => {
  // the DFU literal (CreateCharClassQuestions.cs:526-565) - deepEqual
  // against the source table, so ANY mutation of the module's copy
  // fails (the 17e pin rule)
  assert.deepEqual([...ANSWER_TABLE], [
    0, 2, 1, 0, 2, 1, 0, 1, 2, 2, 0, 1, 0, 1, 2, 1, 0, 2, 0, 1, 2, 2, 0, 1,
    0, 2, 1, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 2, 1, 0, 1, 2, 1, 0, 2, 1, 2, 0,
    2, 0, 1, 1, 0, 2, 0, 1, 2, 2, 0, 1, 1, 0, 2, 0, 1, 2, 0, 2, 1, 2, 1, 0,
    1, 0, 2, 0, 2, 1, 2, 1, 0, 2, 0, 1, 2, 1, 0, 2, 1, 0, 2, 0, 1, 1, 0, 2,
    0, 2, 1, 2, 1, 0, 1, 2, 0, 2, 0, 1, 2, 0, 1, 1, 2, 0, 0, 1, 2, 1, 2, 0,
  ]);
  // every question's three answers steer three DIFFERENT paths
  for (let q = 0; q < QUESTION_LIBRARY_SIZE; q++) {
    assert.deepEqual([...ANSWER_TABLE.slice(q * 3, q * 3 + 3)].sort(), [0, 1, 2], `question ${q + 1} covers all three paths`);
  }
  assert.equal(answerWeightIndex(3, 0), 2, 'question 4, answer a steers Mage');
  assert.equal(answerWeightIndex(3, 1), 0, '...answer b Warrior');
});

// ---- the ten-unique pick ----

test('U18: GetQuestions picks ten UNIQUE questions with a linear probe', () => {
  // rolls stuck at 0 would repeat index 0 forever without the probe -
  // DFU walks (index + 1) % count past already-picked ones (:243-246)
  const stuck = pickQuestionIndices(QUESTION_LIBRARY_SIZE, () => 0);
  assert.deepEqual(stuck, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  // and a spread of seeds never yields a duplicate or an out-of-range
  let x = 12345;
  const rolls = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x80000000; };
  for (let run = 0; run < 50; run++) {
    const picked = pickQuestionIndices(QUESTION_LIBRARY_SIZE, rolls);
    assert.equal(new Set(picked).size, QUESTION_COUNT);
    for (const i of picked) assert.ok(i >= 0 && i < QUESTION_LIBRARY_SIZE);
  }
});

// ---- displayQuestion: the lines and the a/b/c boundaries ----

test('U18: DisplayQuestion drops empty lines and finds the answer rows', () => {
  const q = ' first line of the question,\n continued.\n\n a) first answer\n    spilling over.\n b) second answer.\n c) third answer.\n \n';
  const d = displayQuestion(q);
  assert.deepEqual(d.lines.map((l) => l.trim())[0], 'first line of the question,');
  assert.equal(d.lines.length, 7, 'the blank rows drop ("Where(x => x != string.Empty)")');
  assert.equal(d.aIndex, 2);
  assert.equal(d.bIndex, 4, 'the b) row - a)\'s continuation belongs to a');
  assert.equal(d.cIndex, 5);
});

// ---- the flow: gender -> method -> questions -> confirm ----

const CAREER = {
  name: 'Mage', hitPointsPerLevel: 8, advancementMultiplier: 1,
  strength: 40, intelligence: 60, willpower: 72, agility: 48,
  endurance: 52, personality: 55, speed: 48, luck: 57,
  primarySkills: [SKILLS.Mysticism, SKILLS.Alteration, SKILLS.Thaumaturgy],
  majorSkills: [SKILLS.Illusion, SKILLS.Destruction, SKILLS.Restoration],
  minorSkills: [SKILLS.Medical, SKILLS.ShortBlade, SKILLS.BluntWeapon, SKILLS.Dragonish, SKILLS.Daedric, SKILLS.Dodging],
};

/** A crafted library: forty questions in the shipping shape. */
const craftedLibrary = () => Array.from({ length: 40 }, (_, i) =>
  `${i + 1}.  question ${i + 1} text\n a) alpha\n b) beta\n c) gamma`);

/** A crafted CLASSES.DAT: the real header shape with a known results
 *  table - triple (10,0,0) in slot 0, (7,1,2) in slot 8 (header slot
 *  2), (0,0,10) in slot 32 (header slot 8). */
function craftedClassesData() {
  const data = new Uint8Array(216);
  data.set([17, 16, 15, 14, 202, 199, 203, 201, 32, 35, 229, 36, 77, 76, 230, 200, 34, 33], 0);
  data.set([10, 0, 0], 18);            // slot 0 -> header 0 -> 17
  data.set([7, 1, 2], 18 + 8 * 3);     // slot 8 -> header 2 -> 15
  data.set([0, 5, 5], 18 + 12 * 3);    // slot 12 -> header 3 -> 14 (the all-c walk)
  data.set([0, 0, 10], 18 + 32 * 3);   // slot 32 -> header 8 -> 32 & 0x0F = 0
  return data;
}

const flowWithQuestions = (rolls = () => 0) => {
  const careers = Array.from({ length: 18 }, (_, i) => ({ name: `C${i}`, career: CAREER }));
  const f = new ChargenFlow(careers, rolls);
  f.questionLibrary = craftedLibrary();
  f.classesData = craftedClassesData();
  return f;
};

test('U18: the gender accept arm goes to the METHOD screen, not the list', () => {
  // GenderSelectWindow_OnClose -> SetChooseClassGenWindow (:305-316)
  const f = flowWithQuestions();
  f.state = 'gender';
  f.input('confirm');
  assert.equal(f.state, 'classMethod');
  // and the gender BUTTON closes to the same place (the U14 law)
  const g = flowWithQuestions();
  g.state = 'gender';
  g.applyHit({ setGender: 'female' });
  assert.equal(g.state, 'classMethod');
  assert.equal(g.gender, 'female');
});

test('U18: the method screen - list, questions, and the no-cancel-arm law', () => {
  // ChooseClassGen_OnClose has NO cancelled arm (:318-328): any close
  // that is not ChoseGenerate goes to the class list - Escape included
  const f = flowWithQuestions();
  f.state = 'classMethod';
  f.input('confirm');   // cursor 0 = choose from a list
  assert.equal(f.state, 'class');
  const g = flowWithQuestions();
  g.state = 'classMethod';
  g.input('down');
  g.input('confirm');   // cursor 1 = answer questions
  assert.equal(g.state, 'classQuestions');
  assert.equal(g.qAnswered, 0);
  assert.equal(g.qDisplay.lines.length, 4);
  const h = flowWithQuestions();
  h.state = 'classMethod';
  h.input('back');
  assert.equal(h.state, 'class', 'Escape closes to the LIST, the OnClose law');
});

test('U18: without TEXT.RSC 9000 or CLASSES.DAT the questions arm falls to the list', () => {
  const f = flowWithQuestions();
  f.questionLibrary = null;
  f.state = 'classMethod';
  f.methodCursor = 1;
  f.input('confirm');
  assert.equal(f.state, 'class', 'never traps');
});

test('U18: ten answers accumulate weights through the FALL.EXE table and resolve the class', () => {
  // rolls stuck at 0 -> questions 0..9; all a) answers -> table rows
  // 0..9 column 0 = [0,0,0,2,0,1,0,2,0,0] -> weights [7,1,2]
  const f = flowWithQuestions();
  f._enterClassMethod();
  f.input('down'); f.input('confirm');
  for (let i = 0; i < QUESTION_COUNT; i++) assert.ok(f.answerClassQuestion(0), `answer ${i} lands`);
  assert.deepEqual(f.qWeights, [7, 1, 2]);
  // (7,1,2) sits in results slot 8 -> header slot 2 -> class 15
  assert.equal(f.qClassIndex, 15);
  // no description source in a bare test -> the pick stands at once
  assert.equal(f.classIndex, 15, 'the generated index becomes the class');
  assert.equal(f.state, 'name', 'and the flow moved on (no biography source here)');
  // an eleventh answer is inert
  assert.equal(f.answerClassQuestion(0), false);
});

test('U18: the description box - Yes adopts, No falls to the list, modal throughout', () => {
  const f = flowWithQuestions();
  f.describeClass = (i) => [{ text: `class ${i}`, center: false }];
  f._enterClassQuestions();
  for (let i = 0; i < QUESTION_COUNT; i++) f.answerClassQuestion(2);   // all c
  assert.ok(f.qConfirm, 'EndQuestions opens the description (TEXT.RSC 2100 + index)');
  const idx = f.qClassIndex;
  assert.notEqual(idx, NO_CLASS_INDEX);
  // keyboard No (ConfirmDialog_OnButtonClick :424-430)
  f.input('back');
  assert.equal(f.state, 'class', 'No -> SetClassSelectWindow');
  assert.equal(f.qClassIndex, NO_CLASS_INDEX, 'and the pick is dropped');
  // Yes on a fresh run
  const g = flowWithQuestions();
  g.describeClass = (i) => [{ text: `class ${i}`, center: false }];
  g._enterClassQuestions();
  for (let i = 0; i < QUESTION_COUNT; i++) g.answerClassQuestion(2);
  g.input('confirm');
  assert.equal(g.classIndex, idx, 'Yes adopts the generated class');
});

test('U18: re-entry constructs FRESH questions - SetClassQuestionsWindow has no null guard', () => {
  const f = flowWithQuestions();
  f._enterClassQuestions();
  f.answerClassQuestion(0);
  f.answerClassQuestion(1);
  assert.equal(f.qAnswered, 2);
  f._enterClassQuestions();   // the wizard news the window every time (:150-156)
  assert.equal(f.qAnswered, 0);
  assert.deepEqual(f.qWeights, [0, 0, 0]);
});

test('U18: the constellation blues - 8 at rest, +24 per answer on that path', () => {
  // rogueBlue/mageBlue/warriorBlue = 8 (:56-58),
  // constellationBrightnessIncrement = 24 (:51)
  const f = flowWithQuestions();
  f._enterClassQuestions();
  assert.deepEqual(f.constellationBlues(), [8, 8, 8]);
  f.answerClassQuestion(0);   // question 0, a -> Warrior
  assert.deepEqual(f.constellationBlues(), [32, 8, 8]);
  f.answerClassQuestion(0);   // question 1, a -> Warrior again
  assert.deepEqual(f.constellationBlues(), [56, 8, 8]);
});

test('U18: the scroll law - one pixel, frame in step, clamped both ways', () => {
  const f = flowWithQuestions();
  f._enterClassQuestions();
  // a 4-line question fits the 48px window: no scroll possible
  assert.equal(f.qLabelY, QSCROLL_TEXT_OFFSET);
  f.scrollQuestion(1);
  assert.equal(f.qLabelY, QSCROLL_TEXT_OFFSET, 'down blocked: the label bottom is inside the window');
  f.scrollQuestion(-1);
  assert.equal(f.qLabelY, QSCROLL_TEXT_OFFSET, 'up blocked at the top offset');
  // an oversized question scrolls - and the parchment frame advances
  f.qDisplay = { lines: Array.from({ length: 21 }, (_, i) => `row ${i}`), aIndex: 10, bIndex: 14, cIndex: 17 };
  f.scrollQuestion(1);
  assert.equal(f.qLabelY, QSCROLL_TEXT_OFFSET - 1);
  assert.equal(f.qScrollFrame, 1);
  f.scrollQuestion(-1);
  assert.equal(f.qLabelY, QSCROLL_TEXT_OFFSET);
  assert.equal(f.qScrollFrame, 0);
  // the frame wraps over all sixteen
  f.qScrollFrame = QSCROLL_FRAMES - 1;
  f.qLabelY = -50;
  f.scrollQuestion(1);
  assert.equal(f.qScrollFrame, 0, '(15 + 1) % 16');
});

// ---- the pointer path ----

test('U18: the method screen answers clicks on both DFU rects and nowhere else', () => {
  const f = flowWithQuestions();
  f.state = 'classMethod';
  const at = (r, dx = 2, dy = 2) => [METHOD_PANEL[0] + r[0] + dx, METHOD_PANEL[1] + r[1] + dy];
  assert.deepEqual(chargenHit(f, ...at(METHOD_CHOOSE_CLASS)), { classMethod: 'list' });
  assert.deepEqual(chargenHit(f, ...at(METHOD_CHOOSE_QUESTIONS)), { classMethod: 'questions' });
  assert.equal(chargenHit(f, METHOD_PANEL[0] + 2, METHOD_PANEL[1] + 2), null, 'the panel outside the buttons is dead');
  // and the hits apply
  assert.ok(f.applyHit({ classMethod: 'questions' }));
  assert.equal(f.state, 'classQuestions');
});

test('U18: the scroll clicks - margins scroll, answer rows answer, no x test', () => {
  const f = flowWithQuestions();
  f._enterClassQuestions();
  // top and bottom margins (QuestionScroll_OnMouseDown :452-466)
  assert.deepEqual(chargenHit(f, 160, QSCROLL_Y + 2), { qScroll: -1 });
  assert.deepEqual(chargenHit(f, 160, QSCROLL_Y + QSCROLL_H - 2), { qScroll: 1 });
  // the crafted question: line 0 text, 1 a), 2 b), 3 c) - each row 7px
  // from qLabelY 16; x is IRRELEVANT (:475-476 tests y alone)
  const rowY = (i) => QSCROLL_Y + f.qLabelY + i * QUESTION_ROW_H + 3;
  assert.deepEqual(chargenHit(f, 5, rowY(1)), { answerClass: 0 });
  assert.deepEqual(chargenHit(f, 315, rowY(2)), { answerClass: 1 });
  assert.deepEqual(chargenHit(f, 160, rowY(3)), { answerClass: 2 });
  assert.equal(chargenHit(f, 160, rowY(0)), null, 'the question body answers nothing');
  // the confirm box is modal: without its geometry nothing answers
  f.qConfirm = [{ text: 'x', center: false }];
  f._qBox = null;
  assert.equal(chargenHit(f, 160, rowY(1)), null);
});

// ---- CLASSES.DAT: the crafted walk and the real file ----

test('U18: the header nibble law - slots past 3 zero their left nibble', () => {
  const data = craftedClassesData();
  assert.equal(getClassIndex(0, data), 17, 'slot 0 unmasked');
  assert.equal(getClassIndex(3, data), 14, 'slot 3 unmasked');
  assert.equal(getClassIndex(4, data), 202 & 0x0f, 'slot 4 masks: 202 -> 10');
  assert.equal(getClassIndex(8, data), 0, 'slot 8: 32 -> 0');
});

test('U18: the results walk matches triples from offset 18, four slots per class', () => {
  const data = craftedClassesData();
  assert.equal(getHeaderIndex(data, [10, 0, 0]), 0);
  assert.equal(getHeaderIndex(data, [7, 1, 2]), 2, 'slot 8 / weightSetsPerClass 4');
  assert.equal(getHeaderIndex(data, [0, 0, 10]), 8);
  assert.equal(getHeaderIndex(data, [9, 9, 9]), -1, 'no match -> -1 (DFU throws)');
  assert.equal(resolveClassIndex(data, [9, 9, 9]), null);
  assert.equal(resolveClassIndex(data, [7, 1, 2]), 15);
});

// ---- ARENA2 corpus gates ----

test('U18 corpus: TEXT.RSC 9000 parses to forty questions that fit the scroll law', (t) => {
  if (!ARENA2) return t.skip('ARENA2_PATH not set');
  const rsc = new TextRsc().load(readFileSync(join(ARENA2, 'TEXT.RSC')));
  const library = parseQuestionLibrary(rsc);
  assert.equal(library.length, QUESTION_LIBRARY_SIZE);
  for (let i = 0; i < library.length; i++) {
    const d = displayQuestion(library[i]);
    assert.ok(d.lines.length >= 4, `question ${i + 1} has a body and three answers`);
    assert.ok(!/^\s*\d+[.]/.test(d.lines[0]), `question ${i + 1} lost its leading number`);
    assert.ok(d.aIndex > 0, `question ${i + 1} finds a)`);
    assert.ok(d.bIndex > d.aIndex, `question ${i + 1}: b) after a)`);
    assert.ok(d.cIndex > d.bIndex, `question ${i + 1}: c) after b)`);
  }
});

test('U18 corpus: CLASSES.DAT resolves every possible ten-answer outcome', (t) => {
  if (!ARENA2) return t.skip('ARENA2_PATH not set');
  const data = readFileSync(join(ARENA2, 'CLASSES.DAT'));
  assert.equal(data.length, 216, '18 header bytes + 66 triples');
  // the classic anchors: all-warrior is the Knight, all-rogue the
  // Thief, all-mage the Mage
  assert.equal(resolveClassIndex(data, [10, 0, 0]), 17);
  assert.equal(resolveClassIndex(data, [0, 10, 0]), 10);
  assert.equal(resolveClassIndex(data, [0, 0, 10]), 0);
  // EVERY triple summing to ten resolves to a real class file index
  for (let w = 0; w <= 10; w++) {
    for (let r = 0; r <= 10 - w; r++) {
      const m = 10 - w - r;
      const idx = resolveClassIndex(data, [w, r, m]);
      assert.notEqual(idx, null, `(${w},${r},${m}) resolves`);
      assert.ok(idx >= 0 && idx <= 17, `(${w},${r},${m}) -> CLASS${idx} exists`);
    }
  }
});

test('U18 corpus: the SCRL GFX pair decodes to sixteen full parchment frames', (t) => {
  if (!ARENA2) return t.skip('ARENA2_PATH not set');
  let frames = 0;
  for (const name of ['SCRL00I0.GFX', 'SCRL01I0.GFX']) {
    const gfx = new GfxFile();
    assert.ok(gfx.load(readFileSync(join(ARENA2, name)), name));
    assert.equal(gfx.getFrameCount(), 8, `${name}: FrameCount always 8`);
    for (let i = 0; i < 8; i++) {
      const bmp = gfx.getDFBitmap(0, i);
      assert.equal(bmp.width, 320);
      assert.equal(bmp.height, 80);
      assert.equal(bmp.data.length, 25600, 'PixelDataLength 320*80');
      assert.ok(bmp.data.some((b) => b !== 0), `${name} frame ${i} decoded pixels`);
      frames++;
    }
  }
  assert.equal(frames, QSCROLL_FRAMES, 'one contiguous list of 16');
});

// ---- the GFX RLE, provable without data ----

test('U18: the GFX row RLE - runs, raws, and uncompressed rows byte-exact', () => {
  // a crafted 2-frames x 2-rows x 6-wide file: frame 0 row 0 RLE (a
  // run of 4 sevens + 2 raw bytes), row 1 raw; frame 1 both raw
  const width = 6, height = 2, frames = 2;
  const header = [frames & 0xff, 0, width & 0xff, 0, height & 0xff, 0, (width * height) & 0xff, 0, 1, 0, 0, 0, 0, 0];
  const rowTable = 14, rowCount = height * frames;
  const dataStart = rowTable + rowCount * 4;
  const rle = [6, 0, 0xfc, 0xff, 7, 2, 0, 8, 9];   // width 6; -4 -> 7x4; +2 -> 8,9
  const raw1 = [1, 2, 3, 4, 5, 6];
  const raw2 = [9, 8, 7, 6, 5, 4];
  const raw3 = [11, 12, 13, 14, 15, 16];
  const bytes = new Uint8Array(dataStart + rle.length + 18);
  bytes.set(header, 0);
  const offs = [dataStart, dataStart + rle.length, dataStart + rle.length + 6, dataStart + rle.length + 12];
  const encodings = [0x8000, 0, 0, 0];
  const v = new DataView(bytes.buffer);
  for (let i = 0; i < 4; i++) {
    v.setUint16(rowTable + i * 4, offs[i], true);
    v.setUint16(rowTable + i * 4 + 2, encodings[i], true);
  }
  bytes.set(rle, offs[0]);
  bytes.set(raw1, offs[1]);
  bytes.set(raw2, offs[2]);
  bytes.set(raw3, offs[3]);
  const gfx = new GfxFile();
  assert.ok(gfx.load(bytes, 'CRAFT.GFX'));
  assert.deepEqual([...gfx.getDFBitmap(0, 0).data], [7, 7, 7, 7, 8, 9, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...gfx.getDFBitmap(0, 1).data], [9, 8, 7, 6, 5, 4, 11, 12, 13, 14, 15, 16]);
  assert.equal(gfx.load(bytes, 'CRAFT.IMG'), false, 'the extension gate');
});

// ---- F2: the constellation animations gate the next question ----
// The flow's `constellationAnim` is injectable exactly as describeClass
// is, so the whole law drives headless with no renderer and no CEL.
const fakeAnim = (secs = 1) => {
  let left = 0;
  return {
    started: [],
    stops: 0,
    start(i) { this.started.push(i); left = secs; return secs; },
    tick(dt) { left -= dt; return left > 0; },
    stop() { this.stops++; left = 0; },
  };
};

test('F2: an answer LIGHTS its constellation and the next question waits it out', () => {
  const f = flowWithQuestions();
  f._enterClassQuestions();
  const anim = fakeAnim(1);
  f.constellationAnim = anim;
  const shown = f.qDisplay;

  assert.equal(f.answerClassQuestion(0), true);
  assert.equal(f.qAnswered, 1, 'the weight and the count land SYNCHRONOUSLY');
  assert.deepEqual(anim.started, [0], 'the answered constellation started');
  assert.equal(f.qDisplay, shown, 'the next question has NOT shown yet');
  assert.equal(f.answerClassQuestion(0), false, 'input is locked while it plays');

  f.tick(0.5);
  assert.equal(f.qDisplay, shown, 'still playing, still waiting');
  f.tick(0.6);
  assert.notEqual(f.qDisplay, shown, 'the animation ended and the next question showed');
  assert.equal(f.qAnimIndex, -1);
  assert.equal(f.answerClassQuestion(0), true, 'and the screen answers again');
});

test('F2: the chart repaints at the animation END, never at the answer', () => {
  // CEL_OnAnimEnd (:504-513) writes the brightened slots; the ANSWER
  // only increments the weight. Before F2 the port painted at the
  // answer, which is what the old comment claimed DFU did.
  const f = flowWithQuestions();
  f._enterClassQuestions();
  f.constellationAnim = fakeAnim(1);
  assert.equal(f.qPaintBlues, null, 'a fresh screen paints the PRISTINE chart');
  f.answerClassQuestion(0);
  assert.equal(f.qPaintBlues, null, 'the answer alone does not repaint');
  f.tick(2);
  assert.deepEqual(f.qPaintBlues, f.constellationBlues(), 'the END repaints');
});

test('F2: the tenth answer ENDS the screen only when its animation ends', () => {
  // EndQuestions runs from CEL_OnAnimEnd, so the last constellation
  // plays out before the screen resolves. (This fixture has no
  // describeClass art, so EndQuestions falls straight through to the
  // accept arm - the existing ten-answer pin above asserts that.)
  const f = flowWithQuestions();
  f._enterClassQuestions();
  f.constellationAnim = fakeAnim(1);
  for (let i = 0; i < QUESTION_COUNT - 1; i++) { f.answerClassQuestion(0); f.tick(2); }
  f.answerClassQuestion(0);
  assert.equal(f.qAnswered, QUESTION_COUNT);
  assert.equal(f.state, 'classQuestions', 'the screen waits for the last constellation');
  f.tick(2);
  assert.notEqual(f.state, 'classQuestions', 'and resolves when it ends');
});

test('F2: a STUCK animation can never make a character uncreatable', () => {
  // The catastrophic case: a host that never ticks the flow, or a CEL
  // that stalls. The deadline releases the lock and the screen
  // degrades to the pre-F2 instant advance rather than dying.
  const f = flowWithQuestions();
  f._enterClassQuestions();
  f.constellationAnim = { start: () => 1, tick: () => true, stop: () => {} };   // never ends
  let clock = 0;
  f._now = () => clock;
  assert.equal(f.answerClassQuestion(0), true);
  assert.equal(f.answerClassQuestion(0), false, 'locked while inside the deadline');
  clock += 60_000;   // a minute later, nothing has ticked
  assert.equal(f.answerClassQuestion(0), true, 'the deadline releases the screen');
  assert.equal(f.qAnswered, 2, 'and the answer counted');
});

test('F2: re-entering the screen drops an in-flight animation', () => {
  const f = flowWithQuestions();
  f._enterClassQuestions();
  const anim = fakeAnim(5);
  f.constellationAnim = anim;
  f.answerClassQuestion(0);
  assert.equal(f.qAnimIndex, 0);
  f._enterClassQuestions();
  assert.equal(f.qAnimIndex, -1, 'no stale animation end can land on the new run');
  assert.equal(f.qPaintBlues, null, 'and it draws the PRISTINE chart again');
  assert.equal(f.qAnswered, 0);
  assert.ok(anim.stops > 0);
});

test('F2: the overlay wrapper forwards the clock (the four-hosts seam)', async () => {
  // dungeonContext holds the RAW flow; the townTalk hosts hold this
  // wrapper - so the wrapper must pass dt through or chargen animates
  // in one host and hangs on its deadline in the other two.
  const { createChargenWindow } = await import('../src/systems/chargenSession.js');
  const f = flowWithQuestions();
  let ticked = 0;
  f.tick = (dt) => { ticked += dt; };
  createChargenWindow(f, {}).tick(0.25);
  assert.equal(ticked, 0.25);
});
