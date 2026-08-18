// AUDIT 17m: the class LIST's selection vs the DOCUMENT's class index.
//
// DFU carries two members and the port had collapsed them into one:
//
//   characterDocument.classIndex   - the document's class, written at
//     DaggerfallStartNewGameWizard.cs:343 (the questions path), :364
//     (a list pick) and :382 (a custom class's biography AFFINITY).
//   listBox.SelectedIndex          - CreateCharClassSelect's own
//     highlighted row. The wizard NEVER writes it, and it survives
//     across visits because SetClassSelectWindow (:158-167) REUSES the
//     window behind a `== null` guard (unlike SetCustomClassWindow at
//     :170-175, which reconstructs).
//
// With one field, writing the affinity in customExit ALSO moved the
// picker, so a player who built a custom class and stepped back to the
// list found a standard class highlighted - and confirming there ran
// _acceptStandardClass and threw the built career away.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChargenFlow } from '../src/ui/chargen.js';
import { SKILLS } from '../src/systems/skills.js';
import { STAT_KEYS_ORDER } from '../src/systems/chargen.js';
import { readFileSync } from 'node:fs';

const CAREER = {
  name: 'C', hitPointsPerLevel: 8,
  primarySkills: [SKILLS.Archery, SKILLS.LongBlade, SKILLS.CriticalStrike],
  majorSkills: [SKILLS.Dodging, SKILLS.Running, SKILLS.Stealth],
  minorSkills: [SKILLS.Climbing, SKILLS.Jumping, SKILLS.Swimming, SKILLS.Medical, SKILLS.Etiquette, SKILLS.Streetwise],
};
const CAREERS = Array.from({ length: 18 }, (_, i) => ({ name: `C${i}`, career: { ...CAREER, name: `C${i}` } }));
const twelve = [
  SKILLS.Archery, SKILLS.LongBlade, SKILLS.CriticalStrike,
  SKILLS.Dodging, SKILLS.Running, SKILLS.Stealth,
  SKILLS.Climbing, SKILLS.Jumping, SKILLS.Swimming,
  SKILLS.Medical, SKILLS.Etiquette, SKILLS.Streetwise,
];
const flow = () => {
  const f = new ChargenFlow(CAREERS, () => 0);
  f.describeText = (id) => [{ text: `record ${id}`, center: true }];
  return f;
};
/** a finished custom class, sitting on the biography-method screen */
const builtCustom = () => {
  const f = flow();
  // a biography source, so the accept arm lands on U19's method screen
  // (SetChooseBioWindow) rather than skipping it for want of questions
  f.biogFor = () => ({ questions: [{ text: ['q', ''], answers: [{ text: 'a', effects: [] }] }] });
  f.state = 'class';
  f.classListIndex = CAREERS.length;   // the Custom row
  f.useClass();
  f.custom.className = 'Scout';
  twelve.forEach((id, i) => { f.custom.skills[i] = id; });
  f.customExit();
  return f;
};

test('17m: customExit writes the AFFINITY onto the document and leaves the LIST alone', () => {
  // CreateCharCustomClassWindow_OnClose (:378-382) touches
  // characterDocument.classIndex and reads createCharClassSelectWindow
  // only for its .ClassList. The picker's own selection is not in that
  // handler at all.
  const f = builtCustom();
  assert.equal(f.state, 'bioMethod', 'SetChooseBioWindow');
  assert.equal(f.classListIndex, CAREERS.length, 'the picker is STILL on the Custom row');
  assert.equal(f.classIndex, 0, 'while the document took the affinity index');
  assert.equal(f.career.name, 'Scout', 'and the built career is what the getter serves');
});

test('17m: backing out of a finished custom class re-opens the builder, not a standard class', () => {
  // The bug end to end. CreateCharChooseBioWindow_OnClose's cancelled
  // arm (:458-461) calls SetClassSelectWindow, which REUSES the window
  // - so the Custom row is still selected and Return re-enters the
  // builder. With one field the list came back on the affinity row and
  // Return made the player that class instead.
  const f = builtCustom();
  const built = f.career;
  f.input('back');                       // the biography method's cancel arm
  assert.equal(f.state, 'class');
  assert.equal(f.classListIndex, CAREERS.length, 'the Custom row is still the selection');
  f.input('confirm');                    // ListBox.cs:296-297 - Return USES it
  assert.equal(f.state, 'customClass', 'which re-opens the BUILDER');
  assert.equal(f.classConfirm, null, 'no standard class description was opened');
  assert.equal(f.career, built, 'and the built career was never discarded');
});

test('17m: a list pick copies the row onto the document, and only then', () => {
  // ClassSelectWindow_OnClose's else arm (:363-364):
  //   characterDocument.classIndex = ...SelectedClassIndex
  const f = flow();
  f.state = 'class';
  f.describeClass = () => null;          // no art -> the pick stands at once
  f.input('down'); f.input('down');      // the LIST walks to row 2
  assert.equal(f.classListIndex, 2);
  assert.equal(f.classIndex, 0, 'browsing does NOT move the document');
  f.input('confirm');
  assert.equal(f.classIndex, 2, 'accepting does');
  assert.equal(f.career.name, 'C2');
});

test('17m: the questions path writes the document without touching the picker', () => {
  // CreateCharClassQuestions_OnClose (:341-344) assigns career and
  // classIndex, then SetChooseBioWindow. The picker is not in it.
  const f = flow();
  f.state = 'class';
  f.classListIndex = 7;                  // the player had browsed to row 7
  f.qClassIndex = 15;
  f.qConfirm = [{ text: 'x', center: true }];
  f._acceptQuestionClass();
  assert.equal(f.classIndex, 15, 'the generated class lands on the document');
  assert.equal(f.classListIndex, 7, 'and the picker keeps its own row');
});

test('17m: the builder has NO keyboard stat control - the pool moves by click only', () => {
  // DFU's stat steps are UpDownSpinner *Button* handlers (StatsRollout
  // .cs:231-256, :259-281) - mouse only. The name TextBox holds focus
  // with no character filter (CreateCharCustomClass.cs:156-158), so a
  // typed '-' becomes part of the CLASS NAME. The port had a live
  // 'plus' arm against a DEAD 'minus' one (the shared overlay table
  // matches '-' as a character first), so a keyboard could spend from
  // the freeEdit pool and never refund it.
  const f = flow();
  f.state = 'class';
  f.classListIndex = CAREERS.length;
  f.useClass();
  const c = f.custom;
  const before = { ...c.stats };
  const pool = c.statPool;
  f.input('plus'); f.input('plus');
  assert.deepEqual(c.stats, before, 'plus does not spend');
  assert.equal(c.statPool, pool, 'and the ledger does not move');
  f.input('char:-');
  assert.equal(c.statPool, pool, 'nor does the hyphen');
  assert.ok(c.className.endsWith('-'), 'it types into the class name, as DFU\'s TextBox does');
  // the CLICK seam is the one that moves it (CUSTOM stat step)
  f.applyHit({ customStatStep: 1 });
  assert.notDeepEqual(c.stats, before, 'a click still spends');
});

test('17m: no source still treats the picker row as the document class', () => {
  // THE RULE, swept rather than remembered: customExit must not write
  // the picker's selection, and the picker's own walk must not write
  // the document's index. Both regressions are one-word edits.
  const src = readFileSync(new URL('../src/ui/chargen.js', import.meta.url), 'utf8');
  const exitBody = src.slice(src.indexOf('  customExit()'), src.indexOf('  customRepExit()'));
  assert.ok(!/this\.classListIndex\s*=/.test(exitBody),
    'customExit must not move the class picker (:378-382 touches the document only)');
  assert.ok(/this\.classIndex\s*=\s*classAffinityIndex/.test(exitBody),
    'and it must still put the affinity on the document');
  // the art reads the picker's row for the highlight, never the document's
  const art = readFileSync(new URL('../src/ui/chargenArt.js', import.meta.url), 'utf8');
  assert.ok(!/drawListPicker\([^)]*flow\.classIndex/.test(art),
    'the class list draws flow.classListIndex, not the document index');
});
