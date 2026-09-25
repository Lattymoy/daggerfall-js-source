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
  INTERNAL_DUPE_COLOR, CROSS_DUPE_COLOR, SHARED_KEY_COLOR,
} from '../src/systems/controlsConfig.js';
import {
  createBindings, resetDefaults, setBinding, getBinding, actionForCode, actionsForCode, ACTIONS,
} from '../src/systems/inputActions.js';
import { KEY_GROUPS, KEY_BTN, TAB_RECTS, MLOOK_ALT_RECT, gridButtons } from '../src/ui/controlsWindow.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const freshStore = () => { const b = createBindings(); resetDefaults(b); return b; };

// A code NO default holds, for the fixtures that need one. It was
// written out as `KeyP` until QUICK-LOOT B4 gave P a default of its
// own, at which point two tests about staging a FREE code quietly
// became tests about a clash. Deriving it means a new default can
// never change what a test is asking again.
const freeCode = (store) => {
  // KB1: every letter is somebody's since the standard (the mods' keys joined the table), so the candidates
  // run on past the letters into keys no default holds
  const letters = [...'PYZXQKJUOBNM'.split('').map((c) => `Key${c}`), 'Semicolon', 'Quote', 'BracketLeft', 'BracketRight'];
  const free = letters.find((c) => !actionForCode(store, c));
  assert.ok(free, 'every candidate letter is spoken for - this fixture needs a new one');
  return free;
};

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
  const free = freeCode(store);
  setUnsavedBinding(u, 'MoveForwards', free);
  assert.equal(getBinding(store, 'MoveForwards'), 'KeyW', 'the LIVE registry is untouched');
  applyUnsavedKeybinds(store, u);
  assert.equal(getBinding(store, 'MoveForwards'), free, 'the apply lands it');
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

test('I4 + UXB1-S: the SAME key on two actions is a SHARE - marked, never blocking; DFU\'s law still finds, and blocks on, a combo against its own modifier - red inside the shown dict, blue across the two (:230-267)', () => {
  // UXB1-S (2026-09-25, the UX backlog: "So you wont add multiple key bindings even when asked? I dont care if it goes
  // against daggerfall"): the pin DFU's duplicate law held here is re-aimed, not dropped. Two actions on one code were
  // DFU's red clash and refused the exit; they are a share now, chosen and kept. What the law still refuses is the
  // clash no press can resolve - a combo whose modifier is bound bare - and that keeps both of DFU's colours.
  const store = freshStore();
  const u = createUnsavedKeybinds(store);
  assert.equal(checkDuplicates(u).ok, true, 'the defaults are clean');
  assert.equal(checkDuplicates(u).shared.size, 0, '...and share nothing');
  // two actions on one code, in the SHOWN dict: a share
  setUnsavedBinding(u, 'Rest', 'KeyW');
  let d = checkDuplicates(u);
  assert.equal(d.internal.size, 0, 'not a clash');
  assert.equal(d.shared.has('KeyW'), true, 'a share, and marked as one');
  assert.equal(d.ok, true, 'a share does not block the exit');
  assert.equal(internalDuplicatesExist(u), true, '(the raw same-code test still sees it - the pages ask checkDuplicates)');
  setUnsavedBinding(u, 'Rest', 'KeyR');
  assert.equal(checkDuplicates(u).shared.size, 0);
  // the same code in the OTHER dict: a share across the two, not DFU's blue
  u.secondary.set('Jump', 'KeyW');
  d = checkDuplicates(u);
  assert.equal(d.cross.size, 0);
  assert.equal(d.shared.has('KeyW'), true);
  assert.equal(d.ok, true);
  u.secondary.set('Jump', null);
  // ...and an action on one key in both its slots is that action twice, not a share
  u.secondary.set('MoveForwards', 'KeyW');
  assert.equal(checkDuplicates(u).shared.size, 0, 'one action, both slots: nothing shared');
  u.secondary.set('MoveForwards', null);
  // THE LAW STILL STANDING: a combo against its own modifier bound bare - Shift+T beside Run's bare Shift
  setUnsavedBinding(u, 'Rest', 'ShiftLeft+KeyT');
  d = checkDuplicates(u);
  assert.equal(d.internal.has('ShiftLeft+KeyT') && d.internal.has('ShiftLeft'), true, 'red, both of them');
  assert.equal(d.ok, false, 'and it blocks the exit');
  setUnsavedBinding(u, 'Rest', 'KeyR');
  u.secondary.set('Rest', 'ShiftLeft+KeyT');
  d = checkDuplicates(u);
  assert.equal(d.internal.size, 0, 'across the two dicts it is not red...');
  assert.equal(d.cross.has('ShiftLeft+KeyT'), true, '...it is blue');
  assert.equal(d.ok, false, 'DFU returns noRedDupes && cross == 0 - BOTH block');
  // unbound never counts, however many share it
  const u2 = createUnsavedKeybinds(store);
  setUnsavedBinding(u2, 'Rest', null);
  setUnsavedBinding(u2, 'Jump', null);
  assert.equal(checkDuplicates(u2).ok, true, 'two unbound actions are not duplicates');
  assert.equal(checkDuplicates(u2).shared.size, 0, '...nor a share');
  assert.equal(getDuplicates([null, null, 'KeyW']).size, 0);
  // the two colours are DFU's own; the share's is the port's, and neither of them
  assert.deepEqual([...INTERNAL_DUPE_COLOR], [1, 0, 0, 1]);
  assert.deepEqual(CROSS_DUPE_COLOR.slice(0, 3), [0, 0.58, 1]);
  assert.notDeepEqual([...SHARED_KEY_COLOR], [...INTERNAL_DUPE_COLOR]);
  assert.notDeepEqual([...SHARED_KEY_COLOR], [...CROSS_DUPE_COLOR]);
});

test('I4: the internal check dedupes each dict before the cross check (:256-258) - a combo clash inside one dict is read in both, as DFU\'s concatenation reads it', () => {
  // DFU's cross list is each dict DEDUPED then concatenated, so the same code twice in one dict never read as blue.
  // UXB1-S dedupes the union too (a code in both dicts is a share) - and a COMBO clash inside one dict is two DIFFERENT
  // codes, which DFU's concatenation carried into the cross list as well: red wins where both are drawn.
  const store = freshStore();
  const u = createUnsavedKeybinds(store);
  setUnsavedBinding(u, 'Rest', 'KeyW');        // a share, primary only
  let d = checkDuplicates(u);
  assert.equal(d.internal.has('KeyW'), false);
  assert.equal(d.cross.has('KeyW'), false, 'a share is neither colour');
  setUnsavedBinding(u, 'Rest', 'ShiftLeft+KeyT');   // a combo clash, primary only
  d = checkDuplicates(u);
  assert.equal(d.internal.has('ShiftLeft+KeyT'), true);
  assert.equal(d.cross.has('ShiftLeft+KeyT'), true, 'DFU\'s cross list carries it too; the draw puts red first');
});

test('I4 + UXB1-S: the apply writes what the staged set says - two actions staged on one key BOTH keep it (a share), and a key moved off its holder leaves it', () => {
  // DFU's SetKeyBindValues stole a code from whoever held it, so a set with two actions on one code applied
  // ORDER-DEPENDENTLY and only the exit gate kept that state from the registry. UXB1-S made that state a choice, so the
  // apply writes it: nobody the staged picture keeps on the key is stolen from, whatever order the walk meets them in.
  const store = freshStore();
  const u = createUnsavedKeybinds(store);
  setUnsavedBinding(u, 'MoveForwards', 'KeyI');   // KeyI is Status's default
  assert.equal(checkDuplicates(u).ok, true, 'a share: the gate lets it through');
  applyUnsavedKeybinds(store, u);
  assert.equal(getBinding(store, 'MoveForwards'), 'KeyI', 'the changed row has the key');
  assert.equal(getBinding(store, 'Status'), 'KeyI', 'and the untouched one keeps it - one key, both actions');
  assert.deepEqual(actionsForCode(store, 'KeyI'), ['Status', 'MoveForwards'], 'the holder first, the sharer beside it');
  assert.equal(actionForCode(store, 'KeyW'), null, 'MoveForwards let go of its old key');
  // ...and the replace answer (the holder staged elsewhere) still MOVES the key: the holder lets go of it
  const v = createUnsavedKeybinds(store);
  setUnsavedBinding(v, 'Rest', 'KeyI');
  setUnsavedBinding(v, 'Status', null);
  setUnsavedBinding(v, 'MoveForwards', 'KeyW');
  applyUnsavedKeybinds(store, v);
  assert.deepEqual(actionsForCode(store, 'KeyI'), ['Rest'], 'Status unbound and MoveForwards moved home: Rest alone');
  assert.equal(store.removedPrimary.has('Status'), true, 'the emptied row is marked, as ever (AUDIT KB1 F4)');
});

test('I4: Default resets the live registry and re-stages from it', () => {
  const store = freshStore();
  const free = freeCode(store);
  setBinding(store, free, 'Rest');
  const u = createUnsavedKeybinds(store);
  assert.equal(currentDict(u).get('Rest'), free);
  resetUnsavedToDefaults(store, u);
  assert.equal(getBinding(store, 'Rest'), 'KeyR', 'the LIVE registry is back on defaults');
  assert.equal(currentDict(u).get('Rest'), 'KeyR', 'and the staged copy tracks it');
});

test('I4: GetButtonText\'s classic table and FormatButtonText (:322-410, :561-568)', () => {
  // NT3 (F082): the classic-font tail UPPERCASES everything the table
  // does not already answer in caps (`SDFFontRendering ? text :
  // text.ToUpper()`, :521) - the port draws the classic font.
  assert.equal(buttonText(null), 'NONE');
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
  assert.equal(buttonText('Space'), 'SPACE');
  assert.equal(buttonText('Enter'), 'ENTER');
  // NT3 (F082): the arrows take the friendly switch's names - "Left",
  // not "Left Arrow" (:474-479) - and the tail caps them
  assert.equal(buttonText('ArrowLeft'), 'LEFT');
  assert.equal(buttonText('ArrowDown'), 'DOWN');
  // camel case splits (then caps); past the 10-char cap the elongation
  // stands in ("PrintScreen" splits to 12 and shows '...', verbatim)
  assert.equal(buttonText('NumLock'), 'NUM LOCK');
  assert.equal(buttonText('PrintScreen'), ELONGATED_TEXT);
  assert.equal(buttonText('SomethingVeryLongIndeed'), ELONGATED_TEXT);
  assert.equal(buttonText('SomethingVeryLongIndeed', true), 'SOMETHING VERY LONG INDEED',
    'the full-string arm skips the cap - and still rides the classic ToUpper tail (:521 applies to every return)');
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
  // DISC22-B: through classicPauseWithSettings, which hands the classic window the settings screen for CONTROLS
  assert.match(code('ui/pauseDoor.js'), /return classicPauseWithSettings\(show, hooks\);/,
    'the classic skin must still get the classic window');
  assert.match(code('ui/pauseDoor.js'), /return openClassicPauseFlow\(show, \{ \.\.\.hooks, openSettings \}\);/);
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
  // ROAD-G G5 put the MIDDLE button beside it, for the inventory's
  // drop-icon panel (RemoteTargetIconPanel_OnMiddleMouseClick,
  // DaggerfallInventoryWindow.cs:2104-2113) - so both flags are pinned.
  assert.match(code('scenes/townTalk.js'), /overlay\.click\?\.\(v\[0\], v\[1\], e\.button === 2, e\.button === 1\)/);
  assert.match(code('scenes/worldModes.js'), /interiorOverlay\?\.click\?\.\(v\[0\], v\[1\], e\.button === 2, e\.button === 1\)/);   // STATUS-LIVE: the arm's gate is interiorPaused() now, so the slot read inside it is optional-chained
  // ...and the guard is on the window in BOTH, which is the defect
  // routed 62 named: a window with no click handler must still eat
  // the pointer, or the host grabs pointer lock behind the menu.
  // STATUS-LIVE (2026-09-22): the guard is still on the WINDOW - what it
  // asks is the PAUSE. A press under a box the game is not stopped for
  // (the status readout, ui/statusBox.js) belongs to the world, and the
  // box declines `click()` itself.
  assert.match(code('scenes/townTalk.js'), /if \(!overlay \|\| !talkPaused\(\)\) return false;/);
  assert.match(code('scenes/dungeonContext.js'), /overlayClick\(vx, vy, right = false, middle = false\)/);
  // and a right-click on an OPEN window is never also a swing
  assert.match(code('scenes/dungeon.js'), /isSwingButton\(e\.button\) && !ctx\.uiOverlayActive/);   // FIX-F: the swing's button is the registry's
});
