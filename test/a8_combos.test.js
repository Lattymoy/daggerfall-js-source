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
  createBindings, resetDefaults, setBinding, clearBinding, loadKeyBinds,
  getBinding, actionForCode,
  comboCode, isCombo, getCombo, comboString, parseComboString,
  comboModifiers, pairedCodes, isPairedCode,
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
  // ROAD-Ar R9: this pin USED to read `isBoundCode(b, 'ShiftLeft+KeyK')
  // === true` and call it primarySecondaryKeybindDict's membership test.
  // It is not one: MapSecondaryBindings only ADDS through
  // `if (primKey != None && secKey != None)` (:1381-1384), so a code is
  // a key of that dict when its action is DOUBLE-bound and not before.
  // Jump holds the combo in the PRIMARY dict alone, so it pairs nothing.
  assert.equal(isPairedCode(b, 'ShiftLeft+KeyK'), false, 'single-bound - no pair');
  assert.equal(isPairedCode(b, 'ShiftLeft'), false, 'Run holds it in ONE dict');
  assert.equal(pairedCodes(b).size, 0, 'a defaults-only store pairs nothing at all');
  // give Jump a SECOND home and the pair appears, both ways round
  setBinding(b, 'KeyJ', 'Jump', false);
  assert.equal(pairedCodes(b).get('ShiftLeft+KeyK'), 'KeyJ', 'SetSecondaryBinding :1372');
  assert.equal(pairedCodes(b).get('KeyJ'), 'ShiftLeft+KeyK', ':1373 - the other way too');
  assert.equal(isPairedCode(b, 'ShiftLeft'), false, 'Run is still single-bound');
  // and dropping the second home detaches the pair entirely
  clearBinding(b, 'Jump', false);
  assert.equal(pairedCodes(b).size, 0, 'single-bound again');
  // modifierHeldFirstDict's key set, over BOTH dicts
  assert.deepEqual([...comboModifiers(b)], ['ShiftLeft']);
  setBinding(b, comboCode('AltLeft', 'KeyP'), 'AutoMap', false);
  assert.deepEqual([...comboModifiers(b)].sort(), ['AltLeft', 'ShiftLeft']);
  // and the cache tracks the writes rather than going stale
  setBinding(b, 'KeyP', 'AutoMap', false);
  assert.deepEqual([...comboModifiers(b)], ['ShiftLeft']);
});

test('ROAD-Ar R9: a SINGLE-bound combo suppresses no plain key - DFU\'s own inventory/jump case', () => {
  // GetUnaryKey's comment names this exact setup (:1681-1682): "space is
  // jump, LeftShift+Space opens inventory". But the suppression it
  // guards is `primarySecondaryKeybindDict.ContainsKey(...)`, and that
  // dict only ever gains a code through MapSecondaryBindings' both-arm
  // (:1381-1384) - so with Inventory bound ONLY in the primary dict,
  // ContainsKey is false, `hit = true`, and Jump still fires.
  const b = freshStore();
  setBinding(b, comboCode('ShiftLeft', 'Space'), 'Inventory');
  setBindings(b);
  assert.equal(getBinding(b, 'Jump'), 'Space', 'Jump keeps its default');
  assert.equal(isPairedCode(b, 'ShiftLeft+Space'), false);
  assert.equal(held(new Set(['ShiftLeft', 'Space']), 'Jump'), true,
    'DFU jumps here - the port used to kill this key');
  assert.equal(held(new Set(['ShiftLeft', 'Space']), 'Inventory'), true, 'and opens the window');
  // Give Inventory a second home and the combo code becomes a dict KEY,
  // which is the state DFU's comment is actually describing.
  setBinding(b, 'F6', 'Inventory', false);
  assert.equal(isPairedCode(b, 'ShiftLeft+Space'), true);
  // ROAD-GR: the latch is STORED (:1695-1708) and SetupActionKeyDict
  // re-seeds it false on every binding change (:1354-1358), so the
  // suppression bites from the next frame Shift stands CLEAN - it is
  // not a function of this Set. Poll Shift alone, then add the space.
  const keys = new Set(['ShiftLeft']);
  assert.equal(held(keys, 'Jump'), false, 'space is not down yet - and this frame raises the flag');
  keys.add('Space');
  assert.equal(held(keys, 'Jump'), false, 'NOW the jump is ignored');
  assert.equal(held(keys, 'Inventory'), true, 'and the window opens instead');
});

test('ROAD-Ar R9: MapSecondaryBindings\' else arm - the detach keeps the key and drops its partner', () => {
  // A hand-edited KeyBindings.txt is the one way a code lands in BOTH
  // dicts under different actions (loadActionKeybinds is a raw map-set,
  // as DFU's LoadActionKeybinds is). Then the enum walk hits Jump first
  // (pairing Space<->KeyJ) and Crouch second, whose else arm blanks
  // KeyJ (:1392) and REMOVES the Space it was detached from (:1395).
  const b = createBindings();
  loadKeyBinds(b, {
    actionKeyBinds: { Space: 'Jump', KeyJ: 'Crouch' },
    secondaryActionKeyBinds: { KeyJ: 'Jump' },
  });
  const m = pairedCodes(b);
  assert.equal(m.has('KeyJ'), true, 'the surviving key stays, mapped to None (:1392)');
  assert.equal(m.get('KeyJ'), null);
  assert.equal(m.has('Space'), false, 'and its old partner is removed (:1395)');
  assert.equal(isPairedCode(b, 'KeyJ'), true, 'ContainsKey, not a non-None test');
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
  // GetUnaryKey's SUPPRESSION (:1683-1685). ROAD-Ar R9: the second
  // half of that test is `primarySecondaryKeybindDict.ContainsKey`, and
  // that dict pairs a PRIMARY with a SECONDARY - so a combo living in
  // one dict alone suppresses NOTHING, and this pin used to assert the
  // opposite (`held(Shift+K, 'Crouch') === false` off a single-bound
  // Shift+K), which is the port killing a plain key DFU still fires.
  setBinding(b, 'KeyK', 'Crouch');
  assert.equal(held(new Set(['KeyK']), 'Crouch'), true);
  assert.equal(held(new Set(['ShiftLeft', 'KeyK']), 'Crouch'), true,
    'Shift+K is bound in the PRIMARY dict only - it pairs nothing, so K still crouches');
  // double-bind Jump and the pair appears - NOW the suppression bites,
  // from the next frame the modifier stands clean. ROAD-GR: the flag is
  // STORED (:1695-1708) and a binding change re-seeds it false
  // (:1354-1358), so these reads are FRAMES in order, not bare Sets.
  setBinding(b, 'KeyJ', 'Jump', false);
  assert.equal(isPairedCode(b, 'ShiftLeft+KeyK'), true);
  const ring = new Set(['ShiftLeft']);
  assert.equal(held(ring, 'Jump'), false, 'K is not down - and this frame raises Shift\'s flag');
  ring.add('KeyK');
  assert.equal(held(ring, 'Crouch'), false,
    'the modifier latched and Shift+K is PAIRED - K alone must not fire');
  clearBinding(b, 'Jump', false);
  assert.equal(held(ring, 'Crouch'), true, 'and back again');
  assert.equal(held(ring, 'Jump'), true, 'the combo fires throughout');
  // ModifierOnlyHeld's second clause: another combo modifier held kills
  // the RAISE - but ROAD-G G3, as ROAD-GR corrected it, gave that clause
  // the shape it has in DFU. modifierHeldFirstDict[Shift] is a LATCH
  // (:1695-1708): it goes true on a frame Shift is held with nothing
  // disqualifying anywhere in the ring, stays true until Shift is
  // RELEASED - so a Ctrl pressed AFTERWARDS cannot lower it - and stays
  // FALSE while that Ctrl is held, because :1699 has no else. This pin
  // used to assert the port's orderless read, false whichever way the
  // two went down; the answer is the HISTORY's, not the Set's.
  setBinding(b, comboCode('ControlLeft', 'KeyM'), 'AutoMap');
  assert.equal(held(new Set(['ControlLeft', 'ShiftLeft', 'KeyK']), 'Jump'), false,
    'Ctrl is in the ring, so no frame came back clean - :1636-1637 disqualifies it');
  const later = new Set(['ShiftLeft']);
  assert.equal(held(later, 'Jump'), false, 'the clean frame that raises the flag');
  later.add('ControlLeft');
  assert.equal(held(later, 'Jump'), false, 'still no K down');
  later.add('KeyK');
  assert.equal(held(later, 'Jump'), true,
    'Shift latched alone; the Ctrl pressed afterwards does not lower the flag (:1704-1707 is the only lowering)');
  // an unrelated key held alongside changes nothing
  later.delete('ControlLeft');
  later.add('KeyW');
  assert.equal(held(later, 'Jump'), true);
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
