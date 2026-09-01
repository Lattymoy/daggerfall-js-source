// A8 - KEY COMBOS: the pack (InputManager.cs:1165-1219), the modifier
// set (:1349-1358), TestSetBinding's modifier guard (:1416-1418),
// GetDuplicates' three phases (ControlsConfigManager.cs:144-215),
// GetButtonText's combo arm (:509-513), and GetUnaryKey's runtime
// read (:1670-1712).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createBindings, resetDefaults, setBinding, getBinding, actionForCode,
  comboCode, isCombo, getCombo, comboString, parseComboString,
  comboModifiers, isBoundCode,
} from '../src/systems/inputActions.js';
import {
  getDuplicates, checkDuplicates, createUnsavedKeybinds, setUnsavedBinding,
  buttonText, ELONGATED_TEXT,
} from '../src/systems/controlsConfig.js';
import { held, actionOf, setBindings } from '../src/ui/input.js';
import { comboFromEvent } from '../src/ui/controlsWindow.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const freshStore = () => { const b = createBindings(); resetDefaults(b); return b; };

test('A8: GetComboCode packs one code, and refuses a combo inside a combo', () => {
  assert.equal(comboCode('ShiftLeft', 'KeyT'), 'ShiftLeft+KeyT');
  assert.equal(isCombo('ShiftLeft+KeyT'), true);
  assert.equal(isCombo('KeyT'), false);
  assert.deepEqual(getCombo('ShiftLeft+KeyT'), ['ShiftLeft', 'KeyT']);
  assert.equal(getCombo('KeyT'), null);
  // the `x > 32767` guard: combo codes start past it, so no nesting
  assert.equal(comboCode('ShiftLeft+KeyT', 'KeyK'), null);
  assert.equal(comboCode('KeyK', 'ShiftLeft+KeyT'), null);
  assert.equal(comboCode(null, 'KeyT'), null);
  assert.equal(comboCode('KeyT', null), null);
  // GetComboString / GetComboCode(String) round trip (:1179-1219)
  assert.equal(comboString('ShiftLeft+KeyT'), 'ShiftLeft + KeyT');
  assert.equal(comboString('KeyT'), 'KeyT');
  assert.equal(comboString(null), 'None');
  assert.equal(parseComboString('ShiftLeft + KeyT'), 'ShiftLeft+KeyT');
  assert.equal(parseComboString('KeyT'), null);
});

test('A8: a combo is ONE dictionary entry - every existing reader still works', () => {
  const b = freshStore();
  setBinding(b, comboCode('ShiftLeft', 'KeyK'), 'Jump');
  assert.equal(getBinding(b, 'Jump'), 'ShiftLeft+KeyK');
  assert.equal(actionForCode(b, 'ShiftLeft+KeyK'), 'Jump');
  assert.equal(actionForCode(b, 'Space'), null, 'SetBinding cleared Jump\'s old code');
  assert.equal(isBoundCode(b, 'ShiftLeft+KeyK'), true);
  assert.equal(isBoundCode(b, 'ShiftLeft'), true, 'Run still holds it');
  // modifierHeldFirstDict's key set, over BOTH dicts
  assert.deepEqual([...comboModifiers(b)], ['ShiftLeft']);
  setBinding(b, comboCode('AltLeft', 'KeyP'), 'AutoMap', false);
  assert.deepEqual([...comboModifiers(b)].sort(), ['AltLeft', 'ShiftLeft']);
  // and the cache tracks the writes rather than going stale
  setBinding(b, 'KeyP', 'AutoMap', false);
  assert.deepEqual([...comboModifiers(b)], ['ShiftLeft']);
});

test('A8: the autofill pass will not steal a code serving as a combo modifier (:1416-1418)', () => {
  const b = createBindings();
  // a hand-made store where Shift heads a combo and Run is unbound
  setBinding(b, comboCode('ShiftLeft', 'KeyK'), 'Jump');
  resetDefaults(b, true);   // the startup autofill (:445-448)
  assert.equal(getBinding(b, 'Run'), null,
    'ShiftLeft is a combo modifier - the Run default must not take it');
  assert.equal(getBinding(b, 'Jump'), 'ShiftLeft+KeyK', 'and the combo survives');
  assert.equal(getBinding(b, 'MoveForwards'), 'KeyW', 'the rest of the defaults still land');
  // a FULL reset is DFU's own clear - the combo goes with it
  resetDefaults(b);
  assert.equal(getBinding(b, 'Run'), 'ShiftLeft');
});

test('A8: GetDuplicates phase 1 - a modifier used as an independent bind', () => {
  // the C# comment's own example:
  //   "Action1: LeftShift + T" / "Action2: LeftShift"
  const d = getDuplicates(['ShiftLeft+KeyT', 'ShiftLeft']);
  assert.equal(d.has('ShiftLeft'), true, 'the bare modifier is a dupe');
  assert.equal(d.has('ShiftLeft+KeyT'), true, 'and so is the combo it heads');
  // source ORDER does not matter - the key selector records the
  // modifiers before the simple pass walks anything
  const rev = getDuplicates(['ShiftLeft', 'ShiftLeft+KeyT']);
  assert.deepEqual([...rev].sort(), ['ShiftLeft', 'ShiftLeft+KeyT']);
  // an untouched modifier is NOT a dupe
  assert.equal(getDuplicates(['ShiftLeft+KeyT', 'KeyT']).size, 0,
    'the combo\'d KEY may still be bound on its own');
});

test('A8: GetDuplicates phase 2 - the combo\'d key is someone else\'s modifier', () => {
  // "Action1: LeftShift + T" / "Action2: Z + LeftShift"
  const d = getDuplicates(['ShiftLeft+KeyT', 'KeyZ+ShiftLeft']);
  assert.equal(d.has('ShiftLeft+KeyT'), true);
  assert.equal(d.has('KeyZ+ShiftLeft'), true);
});

test('A8: the plain same-code phase still stands, and unbound never counts', () => {
  assert.deepEqual([...getDuplicates(['KeyT', 'KeyT', 'KeyU'])], ['KeyT']);
  assert.equal(getDuplicates([null, null, null]).size, 0);
  assert.equal(getDuplicates(['KeyT', null, 'KeyU']).size, 0);
  // two DIFFERENT combos on the same modifier are fine - that is the
  // whole point of a modifier
  assert.equal(getDuplicates(['ShiftLeft+KeyT', 'ShiftLeft+KeyU']).size, 0);
  // ...but the same combo twice is not
  assert.deepEqual([...getDuplicates(['ShiftLeft+KeyT', 'ShiftLeft+KeyT'])], ['ShiftLeft+KeyT']);
});

test('A8: the staged grid blocks CONTINUE on a combo clash', () => {
  const b = freshStore();
  const u = createUnsavedKeybinds(b);
  assert.equal(checkDuplicates(u).ok, true, 'the defaults are clean');
  // Run holds ShiftLeft by default; bind Jump to ShiftLeft+K and the
  // two clash exactly as DFU says they do
  setUnsavedBinding(u, 'Jump', comboCode('ShiftLeft', 'KeyK'));
  const d = checkDuplicates(u);
  assert.equal(d.ok, false, 'the window may not close');
  assert.equal(d.internal.has('ShiftLeft'), true);
  assert.equal(d.internal.has('ShiftLeft+KeyK'), true);
  // free the modifier and the clash goes
  setUnsavedBinding(u, 'Run', null);
  assert.equal(checkDuplicates(u).ok, true);
});

test('A8: GetButtonText\'s combo arm (:509-513) - each half, then the cap', () => {
  // each half goes through GetButtonText itself, so the classic names
  // apply on both sides
  assert.equal(buttonText('KeyZ+KeyT'), 'Z + T');                     // five, under the cap
  assert.equal(buttonText('ShiftLeft+KeyT'), 'LSHIFT + T');            // exactly ten
  assert.equal(buttonText('ControlLeft+F5'), 'LCTRL + F5');            // exactly ten
  assert.equal(buttonText('AltLeft+ArrowUp'), 'LALT + UP');
  // eleven characters and up is the '...' the tooltip stands behind
  assert.equal(buttonText('ShiftLeft+ArrowDown'), ELONGATED_TEXT);
  assert.equal(buttonText('ShiftLeft+ArrowDown', true), 'LSHIFT + DOWN');
  assert.equal(buttonText('ControlLeft+Backspace'), ELONGATED_TEXT);
  assert.equal(buttonText('ControlLeft+Backspace', true), 'LCTRL + BCKSPC');
  // the plain arms are unchanged
  assert.equal(buttonText(null), 'NONE');
  assert.equal(buttonText('KeyW'), 'W');
  assert.equal(buttonText('ShiftLeft'), 'LSHIFT');
});

test('A8: the runtime read - a combo walks, and its plain half does not', () => {
  const b = freshStore();
  setBinding(b, comboCode('ShiftLeft', 'KeyK'), 'Jump');
  setBindings(b);
  // Space no longer jumps: SetBinding cleared it when the combo landed
  assert.equal(held(new Set(['Space']), 'Jump'), false);
  // K alone does nothing; Shift+K jumps
  assert.equal(held(new Set(['KeyK']), 'Jump'), false);
  assert.equal(held(new Set(['ShiftLeft', 'KeyK']), 'Jump'), true);
  // GetUnaryKey's SUPPRESSION (:1683-1685): bind K to something of its
  // own and the combo's modifier being down silences it
  setBinding(b, 'KeyK', 'Crouch');
  assert.equal(held(new Set(['KeyK']), 'Crouch'), true);
  assert.equal(held(new Set(['ShiftLeft', 'KeyK']), 'Crouch'), false,
    'the modifier is down and Shift+K is bound - K alone must not fire');
  assert.equal(held(new Set(['ShiftLeft', 'KeyK']), 'Jump'), true, 'the combo does');
  // ModifierOnlyHeld's second clause: another combo modifier down kills it
  setBinding(b, comboCode('ControlLeft', 'KeyM'), 'AutoMap');
  assert.equal(held(new Set(['ShiftLeft', 'ControlLeft', 'KeyK']), 'Jump'), false);
  // an unrelated key held alongside changes nothing
  assert.equal(held(new Set(['ShiftLeft', 'KeyK', 'KeyW']), 'Jump'), true);
  // a store with NO combos answers exactly as it always did
  const plain = freshStore();
  setBindings(plain);
  assert.equal(held(new Set(['ShiftLeft']), 'Run'), true);
  assert.equal(held(new Set(['KeyW']), 'MoveForwards'), true);
  assert.equal(held(new Set(['Space']), 'Jump'), true);
});

test('A8: actionOf resolves a combo when the host hands in its held set', () => {
  const b = freshStore();
  setBinding(b, comboCode('ShiftLeft', 'KeyM'), 'LogBook');
  setBindings(b);
  // without the set, the old single-code answer stands (every existing
  // caller keeps its behaviour)
  assert.equal(actionOf({ code: 'KeyM' }), 'AutoMap');
  // with it, the modifier decides
  assert.equal(actionOf({ code: 'KeyM' }, new Set()), 'AutoMap');
  assert.equal(actionOf({ code: 'KeyM' }, new Set(['ShiftLeft'])), 'LogBook');
  // and the plain binding under a held modifier is suppressed, not
  // silently fired
  setBinding(b, comboCode('ShiftLeft', 'KeyV'), 'NoteBook');
  assert.equal(actionOf({ code: 'KeyV' }, new Set()), 'TravelMap');
  assert.equal(actionOf({ code: 'KeyV' }, new Set(['ShiftLeft'])), 'NoteBook');
  assert.equal(actionOf({ code: 'KeyW' }, new Set(['ShiftLeft'])), 'MoveForwards',
    'a key with no combo on that modifier is untouched');
});

test('A8: the controls window builds a combo from a modified keydown', () => {
  assert.equal(comboFromEvent('KeyT', { shiftKey: true }), 'ShiftLeft+KeyT');
  assert.equal(comboFromEvent('KeyT', { ctrlKey: true }), 'ControlLeft+KeyT');
  assert.equal(comboFromEvent('KeyT', { altKey: true }), 'AltLeft+KeyT');
  assert.equal(comboFromEvent('KeyT', {}), null, 'an unmodified press binds the single code');
  assert.equal(comboFromEvent('KeyT', null), null);
  // pressing a modifier alone binds THAT key, never a combo with itself
  assert.equal(comboFromEvent('ShiftLeft', { shiftKey: true }), null);
  assert.equal(comboFromEvent('ShiftRight', { shiftKey: true }), null);
  assert.equal(comboFromEvent('ControlLeft', { ctrlKey: true }), null);
});

test('A8: the combo flags that stood in the source are retired, not orphaned', () => {
  const ia = readFileSync(join(root, 'src/systems/inputActions.js'), 'utf8');
  assert.ok(!/without the engine half[\s\S]{0,80}combos/.test(ia)
    || /RETIRED THE COMBO FLAG/.test(ia), 'the header no longer claims no combos');
  assert.match(ia, /A8 RETIRED THE COMBO FLAG/);
  assert.ok(!/the port has no combos/.test(ia));
  const cc = readFileSync(join(root, 'src/systems/controlsConfig.js'), 'utf8');
  assert.match(cc, /A8 RETIRED THE COMBO FLAG/);
  assert.ok(!/The port has no key combos/.test(cc));
  const cw = readFileSync(join(root, 'src/ui/controlsWindow.js'), 'utf8');
  assert.ok(!/both flagged with I1's combo flag/.test(cw));
  // ...and what is genuinely still missing is NAMED rather than dropped
  assert.match(ia, /heldKeys/, 'the held-ORDER remainder is recorded');
  assert.match(cw, /MOUSE BUTTONS/, 'the mouse-button capture remainder is recorded');
});
