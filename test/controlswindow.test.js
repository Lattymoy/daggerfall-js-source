// I4: the controls staging law + the rebinding window, against
// ControlsConfigManager.cs and DaggerfallControlsWindow.cs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createUnsavedKeybinds, currentDict, setUnsavedBinding, getDuplicates,
  internalDuplicatesExist, checkDuplicates, applyUnsavedKeybinds,
  resetUnsavedToDefaults, buttonText, MAX_BUTTON_TEXT, ELONGATED_TEXT,
  INTERNAL_DUPE_COLOR, CROSS_DUPE_COLOR,
} from '../src/systems/controlsConfig.js';
import {
  createBindings, resetDefaults, setBinding, getBinding, ACTIONS,
} from '../src/systems/inputActions.js';
import { KEY_GROUPS, KEY_BTN, TAB_RECTS, MLOOK_ALT_RECT, gridButtons } from '../src/ui/controlsWindow.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const freshStore = () => { const b = createBindings(); resetDefaults(b); return b; };

test('I4: the grid geometry is DFU\'s nine SetupKeybindButtons calls (:146-152)', () => {
  assert.deepEqual(KEY_GROUPS.map((g) => `${g.start}-${g.end}@${g.x},${g.y}`), [
    '2-8@57,13', '8-14@164,13', '14-20@270,13',
    '20-24@102,80', '24-27@102,125', '27-30@102,159',
    '30-32@270,80', '32-36@270,103', '36-40@270,148',
  ]);
  assert.deepEqual({ ...KEY_BTN }, { w: 47, h: 7, stride: 11 });
  assert.deepEqual({ ...TAB_RECTS }, {
    joystick: [0, 190, 80, 10], advanced: [80, 190, 80, 10],
    defaults: [160, 190, 80, 10], continue: [240, 190, 80, 10],
    whichDict: [268, 0, 50, 8],
  });
  assert.deepEqual([...MLOOK_ALT_RECT], [152, 100, 168, 45]);
  // Actions[2..40) - THIRTY-EIGHT buttons, and the six the grid does
  // not offer are DFU's own omission (Escape/ToggleConsole below the
  // range; QuickSave/QuickLoad/PrintScreen/AutoRun past its end).
  const btns = gridButtons();
  assert.equal(btns.length, 38);
  const offered = new Set(btns.map((b) => b.action));
  for (const a of ['Escape', 'ToggleConsole', 'QuickSave', 'QuickLoad', 'PrintScreen', 'AutoRun']) {
    assert.ok(!offered.has(a), `${a} is not rebindable in DFU's grid`);
  }
  assert.equal(offered.size, 38, 'no action appears twice');
  // the stack really is +11 down a column
  assert.deepEqual(btns.slice(0, 3).map((b) => [b.action, b.x, b.y]), [
    ['MoveForwards', 57, 13], ['MoveBackwards', 57, 24], ['TurnLeft', 57, 35],
  ]);
});

test('I4: staging copies BOTH dicts and writes nothing live until applied', () => {
  const store = freshStore();
  const u = createUnsavedKeybinds(store);
  assert.equal(u.usingPrimary, true);
  assert.equal(currentDict(u).get('MoveForwards'), 'KeyW');
  assert.equal(u.secondary.get('MoveForwards'), null, 'no secondary default exists');
  // a FREE code - KeyI belongs to Status, and applying a set where
  // two actions share a code is order-dependent by DFU's own design
  // (see the next test)
  setUnsavedBinding(u, 'MoveForwards', 'KeyP');
  assert.equal(getBinding(store, 'MoveForwards'), 'KeyW', 'the LIVE registry is untouched');
  applyUnsavedKeybinds(store, u);
  assert.equal(getBinding(store, 'MoveForwards'), 'KeyP', 'the apply lands it');
  assert.equal(checkDuplicates(createUnsavedKeybinds(store)).ok, true, 'and the result is clean');
  // an emptied PRIMARY slot is marked removed, so the autofill pass
  // cannot restore its default behind the player's back (:552-553)
  const u2 = createUnsavedKeybinds(store);
  setUnsavedBinding(u2, 'Rest', null);
  applyUnsavedKeybinds(store, u2);
  assert.equal(getBinding(store, 'Rest'), null);
  assert.equal(store.removedPrimary.has('Rest'), true);
  resetDefaults(store, true);
  assert.equal(getBinding(store, 'Rest'), null, 'and autofill honours the mark');
  // ...and the mark is a TRANSITION, not a state: an action already
  // unbound and left unbound gains nothing. DFU marks inside the
  // `curCode != code` arm (:550-553), so applying an unchanged set is
  // a no-op - which is what makes reopening the window and pressing
  // CONTINUE harmless. (This is the arm the M5 mutant walks.)
  const store2 = freshStore();
  const u3 = createUnsavedKeybinds(store2);
  setUnsavedBinding(u3, 'Jump', null);
  applyUnsavedKeybinds(store2, u3);
  assert.deepEqual([...store2.removedPrimary], ['Jump'], 'only the action that CHANGED is marked');
  const u4 = createUnsavedKeybinds(store2);   // Jump is already unbound
  store2.removedPrimary.clear();
  applyUnsavedKeybinds(store2, u4);
  assert.deepEqual([...store2.removedPrimary], [],
    'an unchanged set marks nothing - the mark rides the transition');
});

test('I4: duplicates - red inside the shown dict, blue across the two (:230-267)', () => {
  const store = freshStore();
  const u = createUnsavedKeybinds(store);
  assert.equal(checkDuplicates(u).ok, true, 'the defaults are clean');
  // two actions on one code, in the SHOWN dict: internal (red)
  setUnsavedBinding(u, 'Rest', 'KeyW');
  let d = checkDuplicates(u);
  assert.equal(d.internal.has('KeyW'), true);
  assert.equal(d.ok, false, 'an internal clash blocks the exit');
  assert.equal(internalDuplicatesExist(u), true);
  setUnsavedBinding(u, 'Rest', 'KeyR');
  assert.equal(checkDuplicates(u).ok, true);
  // the same code in the OTHER dict: cross (blue), and it blocks too
  u.secondary.set('Jump', 'KeyW');
  d = checkDuplicates(u);
  assert.equal(d.internal.size, 0, 'not an internal clash');
  assert.equal(d.cross.has('KeyW'), true);
  assert.equal(d.ok, false, 'DFU returns noRedDupes && cross == 0 - BOTH block');
  // unbound never counts, however many share it
  const u2 = createUnsavedKeybinds(store);
  setUnsavedBinding(u2, 'Rest', null);
  setUnsavedBinding(u2, 'Jump', null);
  assert.equal(checkDuplicates(u2).ok, true, 'two unbound actions are not duplicates');
  assert.equal(getDuplicates([null, null, 'KeyW']).size, 0);
  // the two colours are DFU's own
  assert.deepEqual([...INTERNAL_DUPE_COLOR], [1, 0, 0, 1]);
  assert.deepEqual(CROSS_DUPE_COLOR.slice(0, 3), [0, 0.58, 1]);
});

test('I4: the internal check dedupes each dict before the cross check (:256-258)', () => {
  // Without the per-dict dedupe an INTERNAL pair would also read as a
  // cross clash - the two lists concatenated would carry KeyW twice
  // from the primary side alone. The mutation that removes the
  // `new Set(...)` wrappers is what this pins.
  const store = freshStore();
  const u = createUnsavedKeybinds(store);
  setUnsavedBinding(u, 'Rest', 'KeyW');        // internal clash, primary only
  const d = checkDuplicates(u);
  assert.equal(d.internal.has('KeyW'), true);
  assert.equal(d.cross.has('KeyW'), false, 'an internal pair is NOT a cross clash');
});

test('I4: the apply CONTRACT - a clashing set is order-dependent, and the gate is what prevents it', () => {
  // SetBinding steals a code from whoever holds it, so applying a set
  // where two actions share one code leaves the EARLIER action
  // unbound - DFU's SetKeyBindValues has exactly this shape
  // (:541-559). It is never reached because the window refuses to
  // close while duplicates exist; this pins BOTH halves, so nobody
  // "fixes" the apply and quietly retires the gate that guards it.
  const store = freshStore();
  const u = createUnsavedKeybinds(store);
  setUnsavedBinding(u, 'MoveForwards', 'KeyI');   // KeyI is Status's default
  assert.equal(checkDuplicates(u).ok, false, 'the gate SEES it, and blocks the close');
  applyUnsavedKeybinds(store, u);
  assert.equal(getBinding(store, 'MoveForwards'), null, 'the earlier action loses the code');
  assert.equal(getBinding(store, 'Status'), 'KeyI', 'the later one keeps it');
});

test('I4: Default resets the live registry and re-stages from it', () => {
  const store = freshStore();
  setBinding(store, 'KeyP', 'Rest');
  const u = createUnsavedKeybinds(store);
  assert.equal(currentDict(u).get('Rest'), 'KeyP');
  resetUnsavedToDefaults(store, u);
  assert.equal(getBinding(store, 'Rest'), 'KeyR', 'the LIVE registry is back on defaults');
  assert.equal(currentDict(u).get('Rest'), 'KeyR', 'and the staged copy tracks it');
});

test('I4: GetButtonText\'s classic table and FormatButtonText (:322-410, :561-568)', () => {
  assert.equal(buttonText(null), 'None');
  assert.equal(buttonText('AltLeft'), 'LALT');
  assert.equal(buttonText('ShiftLeft'), 'LSHIFT');
  assert.equal(buttonText('ControlRight'), 'RCTRL');
  assert.equal(buttonText('PageUp'), 'PG UP');
  assert.equal(buttonText('Backspace'), 'BCKSPC');
  assert.equal(buttonText('Delete'), 'DEL');
  assert.equal(buttonText('Backquote'), '`');
  assert.equal(buttonText('Digit4'), 'A4', 'Alpha4 -> A4');
  assert.equal(buttonText('Numpad7'), 'KPAD7');
  assert.equal(buttonText('KeyW'), 'W', 'a letter key is its letter');
  assert.equal(buttonText('Space'), 'Space');
  // camel case splits, and past the cap the elongation stands in
  assert.equal(buttonText('ArrowLeft'), 'Left Arrow');
  assert.ok('Left Arrow'.length <= MAX_BUTTON_TEXT);
  assert.equal(buttonText('SomethingVeryLongIndeed'), ELONGATED_TEXT);
  assert.equal(buttonText('SomethingVeryLongIndeed', true), 'Something Very Long Indeed',
    'the full-string arm skips the cap');
});

test('I4: the window wiring - one flow factory, the right-click seam, both panels warm', () => {
  const code = (rel) => readFileSync(join(root, 'src', rel), 'utf8');
  // ONE construction seam for the pause -> controls -> pause trip.
  // U51 re-aimed this pair: the seam is unchanged and so is the round
  // trip, but the CLASSIC flow is now `openClassicPauseFlow` - the
  // plain name belongs to ui/pauseDoor.js, which picks the skin in
  // front of it. Two modules exporting one name is what the
  // audit24_onehome ratchet is for.
  assert.match(code('ui/pauseWindow.js'), /export function openClassicPauseFlow\(show, hooks = \{\}\)/);
  assert.match(code('ui/pauseWindow.js'), /new ControlsWindow\(\{ onBack: \(\) => openClassicPauseFlow\(show, hooks\) \}\)/);
  // ...and the door in front of it reaches the classic flow on the
  // classic skin, or the fork is a wall.
  assert.match(code('ui/pauseDoor.js'), /return openClassicPauseFlow\(show, hooks\);/,
    'the classic skin must still get the classic window');
  for (const rel of ['scenes/world.js', 'scenes/exterior.js', 'scenes/worldModes.js', 'scenes/dungeonContext.js']) {
    assert.match(code(rel), /openPauseFlow\(/, `${rel} mounts through the factory`);
    assert.match(code(rel), /preloadPauseFlowArt\(/, `${rel} warms BOTH panels`);
    assert.doesNotMatch(code(rel), /new PauseOptionsWindow\(/,
      `${rel} must not hand-roll the window past the factory`);
  }
  // the remove gesture reaches a window through every overlay channel
  // U47 made townTalk's guard match worldModes' - the WINDOW, not its
  // click method - so the call is optional-chained here too and the
  // pin follows it. What it is really watching is that the right
  // button reaches the window at all, and it still does.
  assert.match(code('scenes/townTalk.js'), /overlay\.click\?\.\(v\[0\], v\[1\], e\.button === 2\)/);
  assert.match(code('scenes/worldModes.js'), /interiorOverlay\.click\?\.\(v\[0\], v\[1\], e\.button === 2\)/);
  // ...and the guard is on the window in BOTH, which is the defect
  // routed 62 named: a window with no click handler must still eat
  // the pointer, or the host grabs pointer lock behind the menu.
  assert.match(code('scenes/townTalk.js'), /if \(!overlay\) return false;/);
  assert.match(code('scenes/dungeonContext.js'), /overlayClick\(vx, vy, right = false\)/);
  // and a right-click on an OPEN window is never also a swing
  assert.match(code('scenes/dungeon.js'), /e\.button === 2 && !ctx\.uiOverlayActive/);
});
