// FIX-F - THE ENHANCED SKIN'S REBINDING PANE, pinned.
//
// Mac: "changing keybinds in classic/enhanced do not work". The
// classic grid worked; the DEFAULT skin simply had no door to it, so
// on the skin almost everyone plays there was no way to rebind a key
// at all. src/ui/enhancedControls.js is that door.
//
// These are BEHAVIOURAL pins, not source sweeps, and they are driven
// against a minimal fake document — the same shape test/hitNumbers.js
// uses for the damage-number layer, grown the two methods this pane
// needs (a document that records addEventListener/removeEventListener,
// because the capture listener's LIFETIME is half the law here).
//
// What each pin holds, and why it is a pin rather than a reading:
//  - the pane is REGISTERED and REACHABLE, on the rail and in the
//    system-pane dispatch, because a pane function nobody can call is
//    exactly the bug being fixed;
//  - a bind goes through the STAGED dict and leaves the live registry
//    alone, which is what makes Cancel possible at all;
//  - the capture listener is capture:true, stops what it takes, and
//    is GONE the instant the key lands;
//  - duplicates block CONTINUE with the classic window's own words;
//  - CONTINUE reaches the live registry and raises OnSavedKeyBinds;
//  - leaving without CONTINUE discards.
//
// A PIN MUST FAIL: each assertion below dies under a one-line change
// to the law it names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  paneControls, discardControlsStaging, captureArmed, controlsStaging, controlsPromptOpen, dismissControlsPrompt,
  controlsDuplicates, shownGroups, MULTIPLE_ASSIGNMENTS, DEFAULTS_PROMPT, CONFIRM_LABEL, promptMarks,
} from '../src/ui/enhancedControls.js';
import { CATEGORY_IDS } from '../src/ui/settingsMap.js';   // AUDIT FT16 CTRL-a: the door the bindings live behind
import { SYSTEM_PANES } from '../src/ui/enhancedMenu.js';
import { KEYBIND_ROWS } from '../src/ui/mouseControlsWindow.js';
import { bindings, setBindings, isTextEntryTarget } from '../src/ui/input.js';
import {
  ACTIONS, createBindings, resetDefaults, getBinding, setBinding, onSavedKeyBinds, comboCode, ACTION_GROUPS, HIDDEN_ACTIONS,
} from '../src/systems/inputActions.js';
import { setModSetting, modSetting } from '../src/systems/modSettings.js';   // KB1: a mod's group follows its switch
import { currentDict, buttonText, floatHint, sharedFloatNote } from '../src/systems/controlsConfig.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ── A DOCUMENT, JUST ENOUGH OF ONE ───────────────────────────────

function fakeEl(tag) {
  const n = {
    tag,
    tagName: tag.toUpperCase(),   // isTextEntryTarget reads this (CG2)
    children: [], className: '', textContent: '', title: '',
    style: {}, dataset: {}, attrs: {},
    onclick: null, oncontextmenu: null,
    append(...cs) { for (const c of cs) { n.children.push(c); c.parent = n; } },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener() {}, removeEventListener() {},
  };
  return n;
}

function fakeDocument() {
  const listeners = [];
  return {
    listeners,
    createElement: (tag) => fakeEl(tag),
    addEventListener(type, fn, opts) { listeners.push({ type, fn, opts }); },
    removeEventListener(type, fn) {
      const i = listeners.findIndex((l) => l.type === type && l.fn === fn);
      if (i >= 0) listeners.splice(i, 1);
    },
  };
}

/** Every node under `n` carrying the class. */
function find(n, cls, out = []) {
  if (typeof n.className === 'string' && n.className.split(/\s+/).includes(cls)) out.push(n);
  for (const c of n.children ?? []) find(c, cls, out);
  return out;
}
const one = (n, cls) => find(n, cls)[0];
const textOf = (n, out = []) => {
  if (n.textContent) out.push(n.textContent);
  for (const c of n.children ?? []) textOf(c, out);
  return out;
};

/** A KeyboardEvent's two flags and the two calls the pane must make. */
const keyEvent = (code, mods = {}) => {
  const e = {
    code, prevented: false, stopped: false, ...mods,
    preventDefault() { e.prevented = true; },
    stopPropagation() { e.stopped = true; },
  };
  return e;
};

/**
 * A live store of DEFAULT bindings, a fake document, and the pane
 * mounted over both. `view.body` is always the LATEST tree - the pane
 * repaints through the shell's render, so every act rebuilds.
 */
function withPane(fn) {
  const store = createBindings();
  resetDefaults(store);
  setBindings(store);
  discardControlsStaging();
  const doc = fakeDocument();
  globalThis.document = doc;
  const view = { body: fakeEl('div') };
  const render = () => { view.body = fakeEl('div'); paneControls(view.body, { render }); };
  try {
    paneControls(view.body, { render });
    return fn({ doc, view, store, render });
  } finally {
    discardControlsStaging();
    delete globalThis.document;
  }
}

const keyBtn = (view, action) => find(view.body, 'ctl-key').find((b) => b.dataset.action === action);
/** KB1: a key NO default holds. The fixtures used KeyG as their free key; KB1 gave G to Handheld Torches' drop (one
 *  key, one action - every letter is somebody's now), and a taken key asks before it binds. */
const FREE = 'Semicolon';
const answer = (view, yes) => find(view.body, 'act').find((b) => b.textContent === (yes ? 'Yes' : 'No')).onclick();
const clearBtn = (view, action) => {
  const row = find(view.body, 'ctl-row').find((r) => one(r, 'ctl-key').dataset.action === action);
  return one(row, 'ctl-clear');
};

// ── THE PANE EXISTS WHERE A PLAYER CAN REACH IT ──────────────────

// FT16 (2026-09-15, Mac: "the control menu option needs to be within
// settings"): THE BINDINGS ARE THE CONTROLS CATEGORY OF SETTINGS.
//
// FIX-F put Controls on both rails because it was reachable from
// neither - the right fix for that bug, and one door too many for the
// subject: Settings ALREADY had a Controls category holding DFU's
// Controls/* keys (the mouse sensitivity, the swing mode, the
// controller), so a player asking "how do I rebind jump" had two
// plausible doors and one of them was wrong. One door now.
//
// FIX-F's law survives the move and this pin holds it: the bindings
// must be reachable from the FRONT door and from ESCAPE, which they
// are, because Settings is on both rails. What changed is the address,
// not the reachability - so the pin walks the two places that render
// them rather than the two rails that used to carry them.
test('FT16: the key bindings live inside Settings, and both doors still reach them', () => {
  const src = read('src/ui/enhancedMenu.js');
  const list = (name) => {
    const m = new RegExp(`const ${name} = \\[([^\\]]*)\\]`).exec(src);
    assert.ok(m, `${name} is gone`);
    return m[1].split(',').map((s2) => s2.trim().replace(/^'|'$/g, '')).filter(Boolean);
  };
  // the door that carries them is on BOTH rails - that IS FIX-F's law
  assert.ok(list('SECTIONS_PAUSE').includes('Settings'),
    'Escape must reach the key bindings - the whole of FIX-F\'s bug');
  assert.ok(list('SECTIONS_BOOT').includes('Settings'), 'and so must the front door');
  // AUDIT FT16 CTRL-a: the bindings are reachable only through a
  // Settings CATEGORY now, and nothing held that the category EXISTS -
  // deleting `controls` from CATEGORIES makes them unreachable from the
  // front door, which is FIX-F's original bug restored, and this pin
  // (which inherited FIX-F's law) sailed past it. The door and the
  // renderer are both held now.
  assert.ok(CATEGORY_IDS.includes('controls'),
    'FIX-F: there is a category to reach the bindings THROUGH - a renderer with no door is the bug this law is about');

  // and Controls is no longer a door of its own, on any rail or in the
  // pause window's System page
  for (const r of ['SECTIONS_BOOT', 'SECTIONS_CLASSIC', 'SECTIONS_PAUSE']) {
    assert.ok(!list(r).includes('Controls'), `${r} must not carry a second door to one subject`);
  }
  assert.equal(SYSTEM_PANES.find(([id]) => id === 'controls'), undefined,
    'the pause System page reaches the bindings through its Settings row');
  // a dispatch is a LOOKUP, so a dead key is `undefined(body)` - the
  // wrapper and both table entries must be gone together
  assert.equal(src.match(/controls: paneControlsPane/g), null, 'no dispatch entry survives the move');
  assert.doesNotMatch(src, /paneControlsPane/, 'and neither does the wrapper it pointed at');

  // THE TWO RENDERERS. The full pane draws them under the Controls
  // category; the condensed pause pane has no category rail, so they
  // ride the end of its one scroll. Dropping either is FIX-F's bug.
  const full = src.slice(src.indexOf('function paneSettings('), src.indexOf('function paneQuickSettings('));
  assert.match(full, /if \(category === 'controls'\) \{[\s\S]{0,120}paneControls\(list, \{ render \}\)/,
    'the full Settings pane draws the bindings in the Controls category');
  const quick = src.slice(src.indexOf('function paneQuickSettings('));
  assert.match(quick.slice(0, 2600), /paneControls\(list, \{ render \}\)/,
    'and the condensed pause Settings draws them too');

  // AND THE STAGING FOLLOWS THE ADDRESS. "Leave this page and your
  // changes are dropped" was enforced by the section rail; the category
  // rail has to enforce it now, or a staged bind survives a hop to
  // Audio and back and lands on a Continue the player never meant.
  assert.match(full, /else \{ discardControlsStaging\(\);/,
    'a category change drops the staged dicts');
});

test('KB1: the pane draws the standard\'s groups - every action once, the two DFU leaves nothing reads never, a mod\'s group only while that mod is on (mutant: draw the classic grid slice again)', () => {
  // FIX-F built this pane as the classic window's second face - DFU's 38-button grid slice, the ADVANCED popup's
  // six, then the port's rows under four more headings (SOC5, QS2, QUICK-LOOT B4, FREEMOUSE each widened it). KB1
  // (Mac: "ensuring keybinds are organized") replaced the faces with the one table a player reads: Movement,
  // Combat, Magic, Interaction, Windows, Quickslots and hotbar, Mouse, Online, Game, and one group per vendored mod.
  // The coverage rule the old pin held - every bindable action has a row, none twice - is held of that table.
  const all = ACTION_GROUPS.flatMap((g) => g.rows.map((r) => r.action));
  assert.equal(new Set(all).size, all.length, 'no action in two groups');
  assert.deepEqual([...all, ...HIDDEN_ACTIONS].sort(), [...ACTIONS].sort(), 'every action is in a group, or hidden');
  assert.deepEqual([...HIDDEN_ACTIONS], ['ToggleConsole', 'Slide'], 'hidden: DFU\'s console key (no console) and Slide (read by nothing in DFU either)');
  assert.deepEqual(ACTION_GROUPS.filter((g) => g.mod).map((g) => g.mod), ['handheld-torches', 'eye-of-the-beholder', 'travel-options', 'horse-cart-and-cargo']);
  const torches = 'handheld-torches';
  const was = modSetting(torches, 'Enabled');
  try {
    setModSetting(torches, 'Enabled', true);
    withPane(({ view }) => {
      const shown = shownGroups().flatMap((g) => g.rows.map((r) => r.action));
      assert.equal(find(view.body, 'ctl-row').length, shown.length, 'a row for every action the shown groups hold');
      for (const a of shown) assert.ok(keyBtn(view, a), `${a} needs a row`);
      for (const a of HIDDEN_ACTIONS) assert.ok(!keyBtn(view, a), `${a} is not drawn`);
      assert.ok(keyBtn(view, 'TorchDrop'), 'the torch mod on: its keys are on the page');
    });
    setModSetting(torches, 'Enabled', false);
    withPane(({ view }) => {
      assert.ok(!keyBtn(view, 'TorchDrop'), 'the torch mod off: its group is not drawn');
      assert.ok(keyBtn(view, 'MoveForwards'));
    });
  } finally { setModSetting(torches, 'Enabled', was); }
});

// ── THE CAPTURE ──────────────────────────────────────────────────

test('FIX-F: arming then a keydown binds through the STAGED dict, and the listener leaves', () => {
  withPane(({ doc, view, store }) => {
    const b = keyBtn(view, 'MoveForwards');
    assert.equal(b.textContent, 'W', 'the row shows the display helper’s text');
    assert.equal(doc.listeners.length, 0, 'nothing listens until a capture is armed');

    b.onclick();
    assert.equal(captureArmed(), 'MoveForwards');
    // MAC-K1: TWO doors, one arm. DFU's WaitForKeyPress walks EVERY
    // KeyCode and Mouse0/1/2 are KeyCodes - which is how three of its
    // own defaults are mouse buttons. This pane listened for `keydown`
    // alone, so no action could be moved onto a button and one cleared
    // off a button could never be put back.
    assert.deepEqual(doc.listeners.map((l) => l.type).sort(), ['keydown', 'mousedown'],
      'the capture has both doors while armed, and nothing else');
    for (const l of doc.listeners) {
      assert.deepEqual(l.opts, { capture: true },
        'capture, so the host’s bubble-phase ladder never sees the key');
    }
    const l = doc.listeners.find((x) => x.type === 'keydown');
    assert.equal(keyBtn(view, 'MoveForwards').textContent, 'PRESS A KEY OR BUTTON');

    const e = keyEvent(FREE);
    l.fn(e);
    assert.equal(e.prevented, true, 'the captured key must not do its browser default');
    assert.equal(e.stopped, true, 'and world.js/exterior.js/worldModes.js must never see it');
    assert.equal(captureArmed(), null, 'one key ends the capture');
    assert.equal(doc.listeners.length, 0, 'and BOTH listeners leave with it - a half-disarm is a live listener outliving its screen');

    // THE STAGED WRITE, and only the staged write.
    assert.equal(currentDict(controlsStaging()).get('MoveForwards'), FREE);
    assert.equal(getBinding(store, 'MoveForwards', true), 'KeyW',
      'the LIVE registry is untouched until CONTINUE - that is what staging is');
    assert.equal(keyBtn(view, 'MoveForwards').textContent, buttonText(FREE, true), 'and the repaint shows it');
  });
});

test('FIX-F: Escape binds like any other key, and the shell stands down for it', () => {
  // ReservedKeys is empty in DFU (InputManager.cs:73 `new KeyCode[] { }`,
  // exposed :174-177), so the capture gate that consults it
  // (DaggerfallControlsWindow.cs:410) never refuses a key - Escape
  // included. The shell's own Escape handler stands down for it.
  assert.match(read('src/ui/enhancedMenu.js'), /if \(captureArmed\(\)\) return;/,
    'ui/enhancedMenu.js’s onKey must stand down while a rebind is armed');
  withPane(({ doc, view }) => {
    keyBtn(view, 'Jump').onclick();
    doc.listeners[0].fn(keyEvent('Escape'));
    // KB1: Escape is the pause's, so the pane ASKS (law 4) - it is still a key like any other, not refused
    assert.ok(textOf(one(view.body, 'ctl-prompt')).some((t) => /is used by Pause menu/.test(t)), 'the replace prompt names the holder');
    answer(view, true);
    assert.equal(currentDict(controlsStaging()).get('Jump'), 'Escape');
    assert.equal(currentDict(controlsStaging()).get('Escape'), null, 'and the holder gave it up - one key, one action');
  });
});

test('FIX-F: a key held under a modifier binds the COMBO', () => {
  withPane(({ doc, view }) => {
    keyBtn(view, 'Inventory').onclick();
    doc.listeners[0].fn(keyEvent('KeyT', { shiftKey: true }));
    // AUDIT KB1 F5: Run holds Left Shift bare, and DFU's combo law (GetDuplicates :188-196) makes that a clash - so
    // the combo is ASKED for, like any held key, and Yes lands it with Run staged unbound.
    assert.ok(!captureArmed() && find(view.body, 'act').some((b) => b.textContent === 'Yes'), 'the prompt stands');
    answer(view, true);
    assert.equal(currentDict(controlsStaging()).get('Run'), null, 'the bare modifier\'s holder gives it up');
    const code = currentDict(controlsStaging()).get('Inventory');
    assert.equal(code, comboCode('ShiftLeft', 'KeyT'),
      'comboFromEvent maps the event’s virtual flag onto the LEFT physical key');
    assert.equal(keyBtn(view, 'Inventory').textContent, buttonText(code, true));
    assert.equal(keyBtn(view, 'Inventory').textContent, 'LSHIFT + T');
    // ...and a modifier pressed ALONE binds itself, never a combo of
    // itself (EVENT_MODIFIERS excludes its own two codes).
    keyBtn(view, 'Sneak').onclick();
    doc.listeners[0].fn(keyEvent('ControlLeft', { ctrlKey: true }));   // KB1: Left Ctrl is free since Slide shipped unbound
    assert.equal(currentDict(controlsStaging()).get('Sneak'), 'ControlLeft');
  });
});

test('FIX-F: the capture target is a <button>, so isTextEntryTarget stays false (CG2)', () => {
  withPane(({ view }) => {
    const b = keyBtn(view, 'MoveForwards');
    assert.equal(b.tag, 'button');
    assert.equal(isTextEntryTarget(b), false,
      'an <input> here would make every host’s router read the pane as a typing surface');
    const tags = new Set();
    const walk = (n) => { tags.add(n.tag); for (const c of n.children ?? []) walk(c); };
    walk(view.body);
    assert.ok(!tags.has('input') && !tags.has('textarea'), 'no text entry anywhere on the pane');
  });
});

test('MAC-K1: arming from a click cannot itself be the bound BUTTON, but the next press is', () => {
  // THE REASON THIS PIN HAD TO CHANGE. It used to read "the listener
  // only ever answers `keydown`; a pointer gesture produces none" -
  // true, and the whole defect: a player could not bind a mouse button
  // at all. The listener now answers `mousedown` too, so the guard has
  // to be the real one rather than an accident of which event was
  // listened for.
  //
  // And it IS real: `arm()` runs from the row button's `onclick`,
  // which the browser fires after that press has come and gone, so the
  // listener added inside it can only ever see the NEXT press.
  withPane(({ doc, view }) => {
    const before = currentDict(controlsStaging()).get('MoveForwards');
    keyBtn(view, 'MoveForwards').onclick();
    assert.equal(currentDict(controlsStaging()).get('MoveForwards'), before,
      'arming binds nothing - the click that armed is not the click that binds');
    assert.equal(captureArmed(), 'MoveForwards', 'and the capture is still waiting');

    // the NEXT press binds, and it is the registry's code for that
    // button - Unity counts Mouse0/1/2 as left/RIGHT/middle where
    // MouseEvent.button counts left/MIDDLE/right, so button 2 is
    // 'Mouse1' and a host that spelled 'Mouse' + e.button would hand
    // the wheel the right button's action
    const down = doc.listeners.find((l) => l.type === 'mousedown');
    const e = { button: 2, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
    down.fn(e);
    assert.equal(e.prevented, true, 'the captured press must not do its browser default');
    assert.equal(e.stopped, true, 'and no host ladder may see it');
    assert.equal(captureArmed(), null, 'one press ends the capture');
    assert.equal(doc.listeners.length, 0, 'and both listeners leave');
    // KB1: all three buttons are somebody's (Mouse1 is the swing), so the press asks before it moves (law 4)
    assert.ok(textOf(one(view.body, 'ctl-prompt')).some((t) => /is used by Swing weapon/.test(t)));
    answer(view, true);
    assert.equal(currentDict(controlsStaging()).get('MoveForwards'), 'Mouse1');
    assert.equal(keyBtn(view, 'MoveForwards').textContent, buttonText('Mouse1', true));
  });
});

test('MAC-K1: a FOURTH button is not a binding, and the capture stays armed for one that is', () => {
  // mouseCode answers null past the third button (ui/input.js's
  // MOUSE_CODES is three long, as Unity's KeyCode list is). A thumb
  // button must not silently bind nothing and end the capture - the
  // row would go blank and the player would never know why.
  withPane(({ doc, view }) => {
    keyBtn(view, 'Jump').onclick();
    const down = doc.listeners.find((l) => l.type === 'mousedown');
    down.fn({ button: 3, preventDefault() {}, stopPropagation() {} });
    assert.equal(captureArmed(), 'Jump', 'the fourth button is not a KeyCode: the capture waits on');
    assert.equal(currentDict(controlsStaging()).get('Jump'), 'Space', 'and nothing was written');
    down.fn({ button: 0, preventDefault() {}, stopPropagation() {} });
    answer(view, true);   // KB1: the left button is the activate's - asked, then given
    assert.equal(currentDict(controlsStaging()).get('Jump'), 'Mouse0', 'the left button still binds');
  });
});

test('MAC-K1: a button pressed under a modifier binds the COMBO, as a key does', () => {
  withPane(({ doc, view }) => {
    keyBtn(view, 'Inventory').onclick();
    doc.listeners.find((l) => l.type === 'mousedown')
      .fn({ button: 1, shiftKey: true, preventDefault() {}, stopPropagation() {} });
    answer(view, true);   // AUDIT KB1 F5: Run's bare Left Shift heads the combo - asked, then given
    assert.equal(currentDict(controlsStaging()).get('Inventory'), comboCode('ShiftLeft', 'Mouse2'),
      'one combo law, whichever door the code came through');
  });
});

test('FIX-F: while a capture is armed EVERY other control is inert (:281 etc.)', () => {
  // DaggerfallControlsWindow heads all seven handlers with
  // `if (waitingForInput) return;` — Joystick (:281), Mouse (:290),
  // Defaults (:299), Continue (:321), CurrentBindings (:338), the
  // keybind button (:361) and the right-click remove (:372, ANDed
  // with the unbound refusal). The classic grid carries it in one
  // line (ui/controlsWindow.js:383 `if (this.capture) return true;`);
  // this face carries it as the `act` wrapper. Without it CONTINUE
  // saves and re-stages under a LIVE capture, and the Primary toggle
  // flips the dict the pending keystroke is about to be written into.
  withPane(({ doc, view, store }) => {
    let saved = 0;
    const off = onSavedKeyBinds(() => { saved++; });
    try {
      keyBtn(view, 'MoveForwards').onclick();
      assert.equal(captureArmed(), 'MoveForwards');
      assert.equal(controlsStaging().usingPrimary, true);
      const armedListeners = [...doc.listeners];
      const still = (what) => {
        assert.equal(captureArmed(), 'MoveForwards', `${what} must not touch the capture`);
        assert.equal(controlsStaging().usingPrimary, true, `${what} must not flip the dict`);
        assert.equal(saved, 0, `${what} must not reach saveKeyBinds`);
        assert.equal(doc.listeners.length, armedListeners.length, `${what} must leave the capture standing`);
        assert.deepEqual(doc.listeners, armedListeners, `${what} must not re-arm`);
        assert.equal(one(view.body, 'ctl-prompt'), undefined, `${what} must open no prompt`);
      };

      one(view.body, 'ctl-continue').onclick();     // :321
      still('CONTINUE');
      assert.equal(getBinding(store, 'MoveForwards', true), 'KeyW',
        'and nothing was applied to the live registry either');

      one(view.body, 'ctl-which').onclick();        // :338
      still('the Primary/Secondary toggle');

      one(view.body, 'ctl-defaults').onclick();     // :299
      still('DEFAULTS');

      keyBtn(view, 'Jump').onclick();               // :361 - a second row
      still('a second row’s binding');

      clearBtn(view, 'Jump').onclick();             // :372 - its ✕
      still('a second row’s ✕');

      // The right-click half keeps DFU's refusal AND the browser's
      // menu suppressed: the preventDefault sits outside the guard.
      const e = { prevented: false, preventDefault() { e.prevented = true; } };
      assert.equal(keyBtn(view, 'Jump').oncontextmenu(e), false);
      assert.equal(e.prevented, true,
        'a refused right-click must still swallow the browser menu');
      still('a second row’s right-click');

      // ...and the capture the player actually armed is still the one
      // live gesture on the screen, landing where they aimed it.
      armedListeners.find((l) => l.type === 'keydown').fn(keyEvent(FREE));
      assert.equal(captureArmed(), null);
      assert.equal(currentDict(controlsStaging()).get('MoveForwards'), FREE);
      assert.equal(controlsStaging().usingPrimary, true);
    } finally { off(); }
  });
});

// ── DUPLICATES, DEFAULTS, REMOVE ─────────────────────────────────

test('KB1: a key another action holds ASKS before it moves (law 4) - No stages nothing, Yes gives it over and clears the holder', () => {
  withPane(({ doc, view, store }) => {
    // KeyS is MoveBackwards' default. FIX-F staged it onto MoveForwards and coloured both rows red; KB1 asks.
    keyBtn(view, 'MoveForwards').onclick();
    doc.listeners[0].fn(keyEvent('KeyS'));
    const lines = textOf(one(view.body, 'ctl-prompt'));
    assert.ok(lines.includes('S is used by Move backwards.'), 'the prompt names the key and its holder in the player\'s words');
    assert.ok(lines.includes('Give it to Move forwards instead?'));
    answer(view, false);
    assert.equal(currentDict(controlsStaging()).get('MoveForwards'), 'KeyW', 'No: nothing moved');
    assert.equal(currentDict(controlsStaging()).get('MoveBackwards'), 'KeyS');
    keyBtn(view, 'MoveForwards').onclick();
    doc.listeners[0].fn(keyEvent('KeyS'));
    answer(view, true);
    assert.equal(currentDict(controlsStaging()).get('MoveForwards'), 'KeyS');
    assert.equal(currentDict(controlsStaging()).get('MoveBackwards'), null, 'Yes: the holder is staged unbound');
    assert.equal(controlsDuplicates().ok, true, 'and there is no clash to colour');
    assert.equal(getBinding(store, 'MoveForwards', true), 'KeyW', 'still only staged');
    // a mod's key names its mod
    keyBtn(view, 'Jump').onclick();
    doc.listeners[0].fn(keyEvent('KeyG'));
    assert.ok(textOf(one(view.body, 'ctl-prompt')).includes('G is used by Drop the light (Handheld Torches).'));
    answer(view, false);
  });
});

test('FIX-F: duplicates are flagged and BLOCK Continue with the classic window’s words', () => {
  withPane(({ view, store, render }) => {
    // KB1 + AUDIT KB1 F5: every capture ASKS now, exact codes and DFU's combo law alike, so a clash reaches the pane
    // only from the FILE - a hand-edited one, or one saved before the prompt existed. Here the live registry holds
    // Inventory on Shift+T while Run holds Left Shift bare (GetDuplicates' second phase, :188-196), and the pane
    // stages what it is handed.
    setBinding(store, comboCode('ShiftLeft', 'KeyT'), 'Inventory');
    discardControlsStaging();
    render();
    assert.equal(controlsDuplicates().ok, false);
    assert.ok(controlsDuplicates().internal.has(comboCode('ShiftLeft', 'KeyT')));
    const flagged = find(view.body, 'ctl-dupe').map((b) => b.dataset.action).sort();
    assert.deepEqual(flagged, ['Inventory', 'Run'],
      'both halves of the clash are marked, as the grid colours them');

    one(view.body, 'ctl-continue').onclick();
    const notices = find(view.body, 'ctl-notice').map((n) => n.textContent);
    assert.ok(notices.includes(MULTIPLE_ASSIGNMENTS),
      'the refusal is the classic window’s own line, not a rewording');
    assert.equal(MULTIPLE_ASSIGNMENTS, 'You have multiple assignments...');
    assert.match(read('src/ui/controlsWindow.js'), /'You have multiple assignments\.\.\.'/,
      'and the two windows say the same thing because it is the same refusal');
    // ...and NOTHING reached the registry: it holds what it held.
    assert.equal(getBinding(store, 'Inventory', true), comboCode('ShiftLeft', 'KeyT'));
    assert.equal(getBinding(store, 'Run', true), 'ShiftLeft');
  });
});

test('FIX-F: CONTINUE applies to the live registry and saves', () => {
  withPane(({ doc, view, store }) => {
    let saved = 0;
    const off = onSavedKeyBinds(() => { saved++; });
    try {
      keyBtn(view, 'MoveForwards').onclick();
      doc.listeners[0].fn(keyEvent(FREE));
      assert.equal(getBinding(store, 'MoveForwards', true), 'KeyW', 'still staged');

      one(view.body, 'ctl-continue').onclick();
      assert.equal(getBinding(store, 'MoveForwards', true), FREE,
        'applyUnsavedKeybinds pushes the staged dicts into the registry');
      assert.equal(store.primary.get(FREE), 'MoveForwards', 'and the code answers the action');
      assert.equal(store.primary.has('KeyW'), false, 'the old code is gone with it');
      assert.equal(saved, 1, 'saveKeyBinds ran - OnSavedKeyBinds is raised inside it');
      assert.ok(find(view.body, 'ctl-notice').some((n) => n.textContent === 'Controls saved.'));
    } finally { off(); }
  });
});

test('FIX-F: leaving without CONTINUE discards', () => {
  withPane(({ doc, view, store, render }) => {
    keyBtn(view, 'MoveForwards').onclick();
    doc.listeners[0].fn(keyEvent(FREE));
    assert.equal(currentDict(controlsStaging()).get('MoveForwards'), FREE);

    discardControlsStaging();          // what the rail, go() and unmount call
    assert.equal(controlsStaging(), null, 'the staged copy is dropped whole');
    assert.equal(captureArmed(), null);
    assert.equal(doc.listeners.length, 0, 'and any armed listener goes with it');

    render();                          // the player comes back
    assert.equal(currentDict(controlsStaging()).get('MoveForwards'), 'KeyW',
      're-staged from the LIVE registry, which never heard about the staged key');
    assert.equal(getBinding(store, 'MoveForwards', true), 'KeyW');
    assert.equal(keyBtn(view, 'MoveForwards').textContent, 'W');
  });
  // ...and the shell calls it on every way out.
  const src = read('src/ui/enhancedMenu.js');
  assert.equal((src.match(/discardControlsStaging\(\)/g) ?? []).length >= 5, true,
    'the rail, the tabs, go(), the mount reset and the unmount all drop the staging');
  const unmount = src.slice(src.indexOf('    unmount() {'));
  assert.match(unmount, /discardControlsStaging\(\);/,
    'a document listener that outlives its screen is the bug the unmount note names');

  // AUDIT FT16 F10: ...on every way OUT, and nowhere else. FIX-F guarded
  // this with `id !== 'controls'` - Controls was its own section, so a
  // click on the section you stood in kept your staging. FT16 folded
  // Controls into a Settings category and dropped the guard with the
  // section, so clicking the Settings rail row WHILE REBINDING (the row
  // is right there, and it is the section you are in) threw the staged
  // binds away. The discard belongs to a section CHANGE.
  const goBody = src.slice(src.indexOf('function go(id) {'), src.indexOf('// ── PX1'));
  const goCode = goBody.replace(/\/\/[^\n]*/g, '');
  assert.match(goCode, /if \(id !== section\) discardControlsStaging\(\);/,
    'go() drops the staging when the section actually changes - not when the rail row is the section you are in');
  assert.doesNotMatch(goCode, /^\s*discardControlsStaging\(\);/m,
    'and never unconditionally (AUDIT FT16 F10)');
  // the category tabs keep their own unconditional drop - THAT switch is
  // a walk away from the bindings even though the section does not change
  const tabs = src.slice(src.indexOf('if (on) { pickedKey = null; sheetOpen = true; }'));
  assert.match(tabs.slice(0, 200), /discardControlsStaging\(\); category = cat\.id;/,
    'leaving the controls CATEGORY still discards');
});

test('UXB1-C: the ✕ and the right-click CLEAR AT ONCE - no question, staged like every edit, refused on an unbound slot', () => {
  // DFU asks (PromptRemoveKeybindMessage :290-320) and FIX-F asked with it, in a card drawn in place of the whole
  // list - so every answer threw the player back to the top of the page. The clear is staged like every other edit
  // (nothing reaches the registry until Confirm, and leaving drops it), so the question guarded nothing.
  withPane(({ view, store, render }) => {
    clearBtn(view, 'MoveForwards').onclick();
    assert.equal(one(view.body, 'ctl-prompt'), undefined, 'no question is asked');
    assert.equal(controlsPromptOpen(), false);
    assert.equal(currentDict(controlsStaging()).get('MoveForwards'), null, 'the clear is staged at once');
    assert.equal(keyBtn(view, 'MoveForwards').textContent, 'NONE');
    assert.equal(getBinding(store, 'MoveForwards', true), 'KeyW', 'and ONLY staged: the registry holds W until Confirm');

    // PromptRemoveKeybindMessage's refusal on a slot that carries nothing (:292) - the pane stays the pane.
    clearBtn(view, 'MoveForwards').onclick();
    assert.equal(one(view.body, 'ctl-prompt'), undefined);
    assert.ok(one(view.body, 'ctl-head'), 'no prompt, no state change');

    // ...and the right-click gesture is the same door.
    const e = { prevented: false, preventDefault() { e.prevented = true; } };
    keyBtn(view, 'Jump').oncontextmenu(e);
    assert.equal(e.prevented, true, 'the browser menu must not open over the pane');
    assert.equal(one(view.body, 'ctl-prompt'), undefined, 'a right-click asks nothing either');
    assert.equal(currentDict(controlsStaging()).get('Jump'), null);

    // Leaving drops the clears - the undo the question was standing in for.
    discardControlsStaging();
    render();
    assert.equal(currentDict(controlsStaging()).get('MoveForwards'), 'KeyW');
    assert.equal(currentDict(controlsStaging()).get('Jump'), getBinding(store, 'Jump', true));
  });
  // The classic grid and its ADVANCED popup keep DFU's question: the departure is this pane's alone.
  for (const f of ['src/ui/controlsWindow.js', 'src/ui/mouseControlsWindow.js']) {
    assert.match(read(f), /removeKeybindPromptRows\(this\._removeAction/, `${f} still asks`);
  }
});

test('UXB1-B: the commit button says Confirm, head and foot, and the page says to press it', () => {
  withPane(({ view }) => {
    const conts = find(view.body, 'ctl-continue');
    assert.equal(conts.length, 2, 'head and foot');
    for (const b of conts) assert.equal(b.textContent, CONFIRM_LABEL);
    assert.equal(CONFIRM_LABEL, 'Confirm');
    assert.ok(textOf(one(view.body, 'ctl-head')).some((t) => t.includes('Nothing is saved until you press Confirm, Defaults included.')));
    assert.ok(!textOf(view.body).some((t) => /\bContinue\b/.test(t)), 'the old word is nowhere on the page');
  });
});

test('UXB1-D: a replace prompt stands in the HEAD over the list it leaves in place, marks the rows it is about, and the list is inert under it', () => {
  withPane(({ doc, view, store }) => {
    const rowOf = (action) => find(view.body, 'ctl-row').find((r) => one(r, 'ctl-key').dataset.action === action);
    const classes = (n) => n.className.split(/\s+/);
    keyBtn(view, 'MoveForwards').onclick();
    doc.listeners[0].fn(keyEvent('KeyS'));   // MoveBackwards' default
    const head = one(view.body, 'ctl-head');
    assert.ok(one(head, 'ctl-prompt'), 'the question is inside the sticky head');
    assert.ok(classes(head).includes('ctl-asking'));
    assert.ok(keyBtn(view, 'MoveForwards'), 'and the list is still drawn under it, so the scroll has somewhere to stay');
    assert.ok(classes(rowOf('MoveForwards')).includes('ctl-want'), 'the row the key would go to is marked');
    assert.ok(classes(rowOf('MoveBackwards')).includes('ctl-holder'), 'the row that holds it now is marked');
    assert.equal(find(view.body, 'ctl-holder').length, 1, 'and no other');
    assert.equal(find(view.body, 'ctl-want').length, 1);

    // Inert: a key and a ✕ under the question do nothing.
    keyBtn(view, 'Jump').onclick();
    assert.equal(captureArmed(), null, 'no capture arms under a prompt');
    clearBtn(view, 'Jump').onclick();
    assert.equal(currentDict(controlsStaging()).get('Jump'), getBinding(store, 'Jump', true), 'no clear lands under a prompt');
    assert.equal(controlsPromptOpen(), true, 'the question still stands');

    answer(view, false);
    assert.equal(find(view.body, 'ctl-holder').length, 0, 'answered: the marks go with it');
    assert.equal(find(view.body, 'ctl-want').length, 0);
    assert.equal(one(view.body, 'ctl-prompt'), undefined);
  });
  // a holder in the OTHER set is named by the prompt, not marked on a page that does not show it
  const marks = promptMarks({ kind: 'replace', action: 'Jump', holders: [{ action: 'Run', primary: false }, { action: 'Sneak', primary: true }] }, true);
  assert.equal(marks.want, 'Jump');
  assert.deepEqual([...marks.holders], ['Sneak']);
  assert.deepEqual([...promptMarks({ kind: 'defaults' }, true).holders], []);
});

test('UXB1-D: Float up and Float down say Jump and Crouch move you too, in the live keys - and giving Jump\'s key to Float up says neither is needed', () => {
  withPane(({ doc, view, store }) => {
    const rowText = (action) => textOf(find(view.body, 'ctl-row').find((r) => one(r, 'ctl-key').dataset.action === action));
    const jump = buttonText(getBinding(store, 'Jump', true), true);
    const crouch = buttonText(getBinding(store, 'Crouch', true), true);
    assert.ok(rowText('FloatUp').includes(`Jump (${jump}) rises too while you swim or levitate.`));
    assert.ok(rowText('FloatDown').includes(`Crouch (${crouch}) sinks too while you swim or levitate.`));
    assert.ok(!rowText('Jump').some((t) => /swim or levitate/.test(t)), 'only the two float rows carry it');

    keyBtn(view, 'FloatUp').onclick();
    doc.listeners[0].fn(keyEvent(getBinding(store, 'Jump', true)));
    const lines = textOf(one(view.body, 'ctl-prompt'));
    assert.ok(lines.includes(`${jump} is used by Jump.`));
    assert.ok(lines.includes(sharedFloatNote('FloatUp', [{ action: 'Jump', primary: true }], true)), 'the prompt says the key already does both');
    answer(view, false);

    // an ordinary clash carries no such line
    keyBtn(view, 'FloatUp').onclick();
    doc.listeners[0].fn(keyEvent('KeyS'));
    assert.ok(!textOf(one(view.body, 'ctl-prompt')).some((l) => /already rises/.test(l)));
    answer(view, false);
  });
  const dict = new Map([['Jump', 'Space'], ['Crouch', null]]);
  assert.equal(floatHint('FloatDown', dict), null, 'an unbound partner says nothing');
  assert.equal(floatHint('Jump', dict), null);
  assert.equal(sharedFloatNote('FloatUp', [{ action: 'Jump', primary: true }, { action: 'Run', primary: true }]), null,
    'a key someone else holds too is an ordinary clash');
  assert.equal(sharedFloatNote('FloatDown', [{ action: 'Jump', primary: true }]), null, 'Jump is not Float down\'s partner');
  assert.match(sharedFloatNote('FloatDown', [{ action: 'Crouch', primary: false }], false), /Crouch already sinks .* keep it on Crouch \(secondary\)\./);
  // the hint is the motor's law, in every host that drives the levitate motor (LevitateMotor.cs:86-89)
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeon.js']) {
    const src = read(host);
    assert.match(src, /up: jumpHeld \|\| held\(keys, 'FloatUp'\),/, `${host} rises on Jump`);
    assert.match(src, /down: crouchHeld \|\| held\(keys, 'FloatDown'\),/, `${host} sinks on Crouch`);
  }
});

test('FIX-F / KB1: DEFAULTS resets behind a confirm, through the registry’s own law - STAGED, as the page says, and committed by Continue', () => {
  withPane(({ doc, view, store }) => {
    keyBtn(view, 'MoveForwards').onclick();
    doc.listeners[0].fn(keyEvent(FREE));
    one(view.body, 'ctl-continue').onclick();
    assert.equal(getBinding(store, 'MoveForwards', true), FREE, 'a live rebind to reset from');
    store.removedPrimary.add('QuickSwap');

    one(view.body, 'ctl-defaults').onclick();
    assert.ok(textOf(one(view.body, 'ctl-prompt')).includes(DEFAULTS_PROMPT));
    answer(view, false);
    assert.equal(currentDict(controlsStaging()).get('MoveForwards'), FREE, 'No changes nothing');

    one(view.body, 'ctl-defaults').onclick();
    answer(view, true);
    assert.equal(currentDict(controlsStaging()).get('MoveForwards'), 'KeyW', 'the defaults are STAGED');
    // KB1: the page says "Nothing is saved until you press Continue", and DFU's SetDefaults (:296-317) reset the
    // live registry and saved it on the spot - so the sentence lied. The reset is staged off a copy now.
    assert.equal(getBinding(store, 'MoveForwards', true), FREE, 'the live registry is untouched until Continue');
    assert.equal(keyBtn(view, 'MoveForwards').textContent, 'W');
    one(view.body, 'ctl-continue').onclick();
    assert.equal(getBinding(store, 'MoveForwards', true), 'KeyW', 'Continue commits it');
    assert.equal(store.removedPrimary.has('QuickSwap'), false, 'with the live reset\'s own law - the removal marks go too');
  });
  assert.match(read('src/ui/enhancedControls.js'), /if \(pendingDefaults\) \{ resetDefaults\(bindings\(\)\); pendingDefaults = false; \}/);
});

test('FIX-F: the PRIMARY/SECONDARY toggle is refused while the shown dict clashes', () => {
  withPane(({ view, store, render }) => {
    assert.equal(controlsStaging().usingPrimary, true);
    one(view.body, 'ctl-which').onclick();
    assert.equal(controlsStaging().usingPrimary, false, 'the secondary dict is editable');
    assert.equal(keyBtn(view, 'MoveForwards').textContent, 'NONE', 'and it starts empty');
    one(view.body, 'ctl-which').onclick();

    // AUDIT KB1 F5: every capture asks, so the clash comes from the file (the combo law against Run's Left Shift)
    setBinding(store, comboCode('ShiftLeft', 'KeyT'), 'Inventory');
    discardControlsStaging();
    render();
    one(view.body, 'ctl-which').onclick();
    assert.equal(controlsStaging().usingPrimary, true,
      'DaggerfallControlsWindow refuses the switch while the shown dict clashes (:337-343)');
    assert.ok(find(view.body, 'ctl-notice').some((n) => n.textContent === MULTIPLE_ASSIGNMENTS));
  });
});

// ── AND THE PANE IS PAINTED IN THE SKIN, NOT BESIDE IT ───────────

test('FIX-F: the pane wears the skin’s own classes and adds no face of its own', () => {
  const css = read('src/ui/enhancedStyle.js');
  for (const rule of ['.ctl-key {', '.ctl-key.ctl-dupe {', '.ctl-key.ctl-cross {',
    '.ctl-notice.bad {', '.px-sys .ctl-key {']) {
    assert.ok(css.includes(rule), `enhancedStyle.js must carry ${rule}`);
  }
  const block = css.slice(css.indexOf('/* ── FIX-F: THE CONTROLS PANE'), css.indexOf('.px-qdetail {'));
  assert.ok(!/font-family/.test(block),
    'the shell and the pause window already put Pixelify over everything inside them');
  const src = read('src/ui/enhancedControls.js');
  assert.ok(!/style\.cssText|\.style\./.test(src), 'no inline styling - the sheet is the one place a media query can see');
  // and the law is BORROWED, never restated
  for (const fn of ['createUnsavedKeybinds', 'setUnsavedBinding', 'checkDuplicates',
    'applyUnsavedKeybinds', 'stagedDefaults', 'comboFromEvent', 'buttonText', 'bindingHolder', 'stageReplace']) {
    assert.ok(src.includes(fn), `${fn} must be driven, not reimplemented`);
  }
  const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  assert.ok(imports.includes('../systems/controlsConfig.js'));
  assert.deepEqual(imports.sort(),
    ['../systems/controlsConfig.js', '../systems/inputActions.js', '../systems/modSettings.js', './input.js'],
    'the enhanced pane drives the LAW modules and nothing else - dragging the '
    + 'classic canvas windows (controlsWindow/mouseControlsWindow/nativePanel) in '
    + 'would make the enhanced skin pay for art it never draws');
});

test('AUDIT KB1 (UI 4): Escape on the replace prompt answers No and KEEPS the staged binds - the menu\'s back stack asks the pane first (mutant: the prompt not reported open, so the section is left and the staging discarded)', () => {
  withPane(({ doc, view }) => {
    keyBtn(view, 'MoveForwards').onclick();
    doc.listeners[0].fn(keyEvent(FREE));
    assert.equal(currentDict(controlsStaging()).get('MoveForwards'), FREE, 'a staged bind');
    keyBtn(view, 'Jump').onclick();
    doc.listeners[0].fn(keyEvent('KeyE'));
    assert.equal(controlsPromptOpen(), true, 'E is Interact\'s - the prompt stands');
    dismissControlsPrompt();   // what the back stack's Escape now calls
    assert.equal(controlsPromptOpen(), false);
    assert.equal(currentDict(controlsStaging()).get('Jump'), 'Space', 'No: nothing moved');
    assert.equal(currentDict(controlsStaging()).get('MoveForwards'), FREE, 'and the earlier staged bind is still there');
  });
});
