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
  paneControls, discardControlsStaging, captureArmed, controlsStaging,
  controlsDuplicates, GRID_ACTIONS, ADVANCED_ROWS, MULTIPLE_ASSIGNMENTS, DEFAULTS_PROMPT,
} from '../src/ui/enhancedControls.js';
import { SYSTEM_PANES } from '../src/ui/enhancedMenu.js';
import { KEYBIND_ROWS } from '../src/ui/mouseControlsWindow.js';
import { bindings, setBindings, isTextEntryTarget } from '../src/ui/input.js';
import {
  ACTIONS, createBindings, resetDefaults, getBinding, onSavedKeyBinds, comboCode,
} from '../src/systems/inputActions.js';
import { currentDict, buttonText, removeKeybindPromptRows } from '../src/systems/controlsConfig.js';

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
const clearBtn = (view, action) => {
  const row = find(view.body, 'ctl-row').find((r) => one(r, 'ctl-key').dataset.action === action);
  return one(row, 'ctl-clear');
};

// ── THE PANE EXISTS WHERE A PLAYER CAN REACH IT ──────────────────

test('FIX-F: Controls is on both rails and in the system-pane dispatch', () => {
  const src = read('src/ui/enhancedMenu.js');
  // The registration itself - the same shape mods and about have.
  assert.deepEqual(SYSTEM_PANES.find(([id]) => id === 'controls'), ['controls', 'Controls'],
    'the pause window’s System page must carry a Controls row');
  const list = (name) => {
    const m = new RegExp(`const ${name} = \\[([^\\]]*)\\]`).exec(src);
    assert.ok(m, `${name} is gone`);
    return m[1].split(',').map((s2) => s2.trim().replace(/^'|'$/g, '')).filter(Boolean);
  };
  assert.ok(list('SECTIONS_PAUSE').includes('Controls'),
    'Escape must reach the key bindings - the whole of the bug');
  assert.ok(list('SECTIONS_BOOT').includes('Controls'),
    'and so must the front door, exactly as Settings/Mods/About do');
  // ...and a rail entry with no pane throws on the click: the dispatch
  // is a lookup, so a missing key is `undefined(body)`.
  assert.equal(src.match(/controls: paneControlsPane/g)?.length, 2,
    'both dispatches - the pause System page and the boot shell - must know the pane');
  assert.match(src, /const paneControlsPane = \(body\) => paneControls\(body, \{ render \}\)/,
    'the pane is handed the shell’s own repaint');
});

test('FIX-F: the pane offers the classic grid’s 38 actions and the ADVANCED six', () => {
  // The grid covers Actions[2..40) - ui/controlsWindow.js's KEY_GROUPS,
  // DFU's SetupKeybindButtons. Escape/ToggleConsole sit before it and
  // QuickSave/QuickLoad/PrintScreen/AutoRun past its end, which is why
  // those six live in the ADVANCED popup.
  assert.deepEqual([...GRID_ACTIONS], ACTIONS.slice(2, 40));
  assert.equal(GRID_ACTIONS.length, 38);
  // The six are mouseControlsWindow's own six, in its order, with its
  // labels - restated in the enhanced module so the skin does not pull
  // 600 lines of canvas drawing in for six strings, and pinned here so
  // the restatement cannot drift.
  assert.deepEqual(ADVANCED_ROWS.map((r) => [r.action, r.label]),
    KEYBIND_ROWS.map((r) => [r.action, r.label]));
  // together: every bindable action, none twice
  const all = [...GRID_ACTIONS, ...ADVANCED_ROWS.map((r) => r.action)];
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual([...all].sort(), [...ACTIONS].sort());
  withPane(({ view }) => {
    assert.equal(find(view.body, 'ctl-row').length, 44, 'a row for every action');
    for (const a of all) assert.ok(keyBtn(view, a), `${a} needs a row`);
  });
});

// ── THE CAPTURE ──────────────────────────────────────────────────

test('FIX-F: arming then a keydown binds through the STAGED dict, and the listener leaves', () => {
  withPane(({ doc, view, store }) => {
    const b = keyBtn(view, 'MoveForwards');
    assert.equal(b.textContent, 'W', 'the row shows the display helper’s text');
    assert.equal(doc.listeners.length, 0, 'nothing listens until a capture is armed');

    b.onclick();
    assert.equal(captureArmed(), 'MoveForwards');
    assert.equal(doc.listeners.length, 1, 'exactly one listener while armed');
    const l = doc.listeners[0];
    assert.equal(l.type, 'keydown', 'a keydown - not keyup, not keypress');
    assert.deepEqual(l.opts, { capture: true },
      'capture, so the host’s bubble-phase ladder never sees the key');
    assert.equal(keyBtn(view, 'MoveForwards').textContent, 'PRESS A KEY');

    const e = keyEvent('KeyG');
    l.fn(e);
    assert.equal(e.prevented, true, 'the captured key must not do its browser default');
    assert.equal(e.stopped, true, 'and world.js/exterior.js/worldModes.js must never see it');
    assert.equal(captureArmed(), null, 'one key ends the capture');
    assert.equal(doc.listeners.length, 0, 'and the listener is removed with it');

    // THE STAGED WRITE, and only the staged write.
    assert.equal(currentDict(controlsStaging()).get('MoveForwards'), 'KeyG');
    assert.equal(getBinding(store, 'MoveForwards', true), 'KeyW',
      'the LIVE registry is untouched until CONTINUE - that is what staging is');
    assert.equal(keyBtn(view, 'MoveForwards').textContent, 'G', 'and the repaint shows it');
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
    assert.equal(currentDict(controlsStaging()).get('Jump'), 'Escape');
  });
});

test('FIX-F: a key held under a modifier binds the COMBO', () => {
  withPane(({ doc, view }) => {
    keyBtn(view, 'Inventory').onclick();
    doc.listeners[0].fn(keyEvent('KeyT', { shiftKey: true }));
    const code = currentDict(controlsStaging()).get('Inventory');
    assert.equal(code, comboCode('ShiftLeft', 'KeyT'),
      'comboFromEvent maps the event’s virtual flag onto the LEFT physical key');
    assert.equal(keyBtn(view, 'Inventory').textContent, buttonText(code, true));
    assert.equal(keyBtn(view, 'Inventory').textContent, 'LSHIFT + T');
    // ...and a modifier pressed ALONE binds itself, never a combo of
    // itself (EVENT_MODIFIERS excludes its own two codes).
    keyBtn(view, 'Sneak').onclick();
    doc.listeners[0].fn(keyEvent('ShiftLeft', { shiftKey: true }));
    assert.equal(currentDict(controlsStaging()).get('Sneak'), 'ShiftLeft');
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

test('FIX-F: arming from a click cannot itself be the bound key', () => {
  // The listener is added BY the click handler and only ever answers
  // `keydown`; a pointer gesture produces none. The pin is that the
  // arming leaves the staged dict alone until a key actually arrives.
  withPane(({ doc, view }) => {
    const before = currentDict(controlsStaging()).get('MoveForwards');
    keyBtn(view, 'MoveForwards').onclick();
    assert.equal(currentDict(controlsStaging()).get('MoveForwards'), before,
      'arming binds nothing');
    assert.deepEqual(doc.listeners.map((l) => l.type), ['keydown'],
      'and it listens for keys only - no click, no mousedown');
  });
});

test('FIX-F: while a capture is armed EVERY other control is inert (:281 etc.)', () => {
  // DaggerfallControlsWindow heads all seven handlers with
  // `if (waitingForInput) return;` — Joystick (:281), Mouse (:290),
  // Defaults (:299), Continue (:321), CurrentBindings (:338), the
  // keybind button (:361) and the right-click remove (:372, ANDed
  // with the unbound refusal). The classic grid carries it in one
  // line (ui/controlsWindow.js:323 `if (this.capture) return true;`);
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
      const armedListener = doc.listeners[0];
      const still = (what) => {
        assert.equal(captureArmed(), 'MoveForwards', `${what} must not touch the capture`);
        assert.equal(controlsStaging().usingPrimary, true, `${what} must not flip the dict`);
        assert.equal(saved, 0, `${what} must not reach saveKeyBinds`);
        assert.equal(doc.listeners.length, 1, `${what} must leave the one capture standing`);
        assert.equal(doc.listeners[0], armedListener, `${what} must not re-arm`);
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
      armedListener.fn(keyEvent('KeyG'));
      assert.equal(captureArmed(), null);
      assert.equal(currentDict(controlsStaging()).get('MoveForwards'), 'KeyG');
      assert.equal(controlsStaging().usingPrimary, true);
    } finally { off(); }
  });
});

// ── DUPLICATES, DEFAULTS, REMOVE ─────────────────────────────────

test('FIX-F: duplicates are flagged and BLOCK Continue with the classic window’s words', () => {
  withPane(({ doc, view, store }) => {
    // KeyS is MoveBackwards' default; putting it on MoveForwards is an
    // internal clash inside the shown dict.
    keyBtn(view, 'MoveForwards').onclick();
    doc.listeners[0].fn(keyEvent('KeyS'));
    assert.equal(controlsDuplicates().ok, false);
    assert.ok(controlsDuplicates().internal.has('KeyS'));
    const flagged = find(view.body, 'ctl-dupe').map((b) => b.dataset.action).sort();
    assert.deepEqual(flagged, ['MoveBackwards', 'MoveForwards'],
      'both holders of the clashing code are marked, as the grid colours them');

    one(view.body, 'ctl-continue').onclick();
    const notices = find(view.body, 'ctl-notice').map((n) => n.textContent);
    assert.ok(notices.includes(MULTIPLE_ASSIGNMENTS),
      'the refusal is the classic window’s own line, not a rewording');
    assert.equal(MULTIPLE_ASSIGNMENTS, 'You have multiple assignments...');
    assert.match(read('src/ui/controlsWindow.js'), /'You have multiple assignments\.\.\.'/,
      'and the two windows say the same thing because it is the same refusal');
    // ...and NOTHING reached the registry.
    assert.equal(getBinding(store, 'MoveForwards', true), 'KeyW');
    assert.equal(getBinding(store, 'MoveBackwards', true), 'KeyS');
  });
});

test('FIX-F: CONTINUE applies to the live registry and saves', () => {
  withPane(({ doc, view, store }) => {
    let saved = 0;
    const off = onSavedKeyBinds(() => { saved++; });
    try {
      keyBtn(view, 'MoveForwards').onclick();
      doc.listeners[0].fn(keyEvent('KeyG'));
      assert.equal(getBinding(store, 'MoveForwards', true), 'KeyW', 'still staged');

      one(view.body, 'ctl-continue').onclick();
      assert.equal(getBinding(store, 'MoveForwards', true), 'KeyG',
        'applyUnsavedKeybinds pushes the staged dicts into the registry');
      assert.equal(store.primary.get('KeyG'), 'MoveForwards', 'and the code answers the action');
      assert.equal(store.primary.has('KeyW'), false, 'the old code is gone with it');
      assert.equal(saved, 1, 'saveKeyBinds ran - OnSavedKeyBinds is raised inside it');
      assert.ok(find(view.body, 'ctl-notice').some((n) => n.textContent === 'Controls saved.'));
    } finally { off(); }
  });
});

test('FIX-F: leaving without CONTINUE discards', () => {
  withPane(({ doc, view, store, render }) => {
    keyBtn(view, 'MoveForwards').onclick();
    doc.listeners[0].fn(keyEvent('KeyG'));
    assert.equal(currentDict(controlsStaging()).get('MoveForwards'), 'KeyG');

    discardControlsStaging();          // what the rail, go() and unmount call
    assert.equal(controlsStaging(), null, 'the staged copy is dropped whole');
    assert.equal(captureArmed(), null);
    assert.equal(doc.listeners.length, 0, 'and any armed listener goes with it');

    render();                          // the player comes back
    assert.equal(currentDict(controlsStaging()).get('MoveForwards'), 'KeyW',
      're-staged from the LIVE registry, which never heard about KeyG');
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
});

test('FIX-F: the ✕ prompts to remove, refuses an unbound slot, and Yes stages null', () => {
  withPane(({ view }) => {
    clearBtn(view, 'MoveForwards').onclick();
    const lines = textOf(one(view.body, 'ctl-prompt'));
    for (const row of removeKeybindPromptRows('MoveForwards', 'KeyW')) {
      assert.ok(lines.includes(row), `the prompt is PromptRemoveKeybindMessage’s: ${row}`);
    }
    // No leaves it bound; Yes stages the clear.
    find(view.body, 'act').find((b) => b.textContent === 'No').onclick();
    assert.equal(currentDict(controlsStaging()).get('MoveForwards'), 'KeyW');

    clearBtn(view, 'MoveForwards').onclick();
    find(view.body, 'act').find((b) => b.textContent === 'Yes').onclick();
    assert.equal(currentDict(controlsStaging()).get('MoveForwards'), null);
    assert.equal(keyBtn(view, 'MoveForwards').textContent, 'NONE');

    // PromptRemoveKeybindMessage refuses on a slot that carries
    // nothing (:292) - the pane must stay the pane.
    clearBtn(view, 'MoveForwards').onclick();
    assert.equal(one(view.body, 'ctl-prompt'), undefined);
    assert.ok(one(view.body, 'ctl-head'), 'no prompt, no state change');

    // ...and the right-click gesture is the same door.
    const e = { prevented: false, preventDefault() { e.prevented = true; } };
    keyBtn(view, 'Jump').oncontextmenu(e);
    assert.equal(e.prevented, true, 'the browser menu must not open over the pane');
    assert.ok(one(view.body, 'ctl-prompt'), 'a right-click prompts exactly as the grid does');
  });
});

test('FIX-F: DEFAULTS resets behind a confirm, through the registry’s own law', () => {
  withPane(({ doc, view, store }) => {
    keyBtn(view, 'MoveForwards').onclick();
    doc.listeners[0].fn(keyEvent('KeyG'));

    one(view.body, 'ctl-defaults').onclick();
    assert.ok(textOf(one(view.body, 'ctl-prompt')).includes(DEFAULTS_PROMPT));
    find(view.body, 'act').find((b) => b.textContent === 'No').onclick();
    assert.equal(currentDict(controlsStaging()).get('MoveForwards'), 'KeyG', 'No changes nothing');

    one(view.body, 'ctl-defaults').onclick();
    find(view.body, 'act').find((b) => b.textContent === 'Yes').onclick();
    assert.equal(currentDict(controlsStaging()).get('MoveForwards'), 'KeyW');
    // SetDefaults (:296-317) resets the LIVE registry and saves there
    // and then - DFU's own order, not the staged-only reset it looks like.
    assert.equal(getBinding(store, 'MoveForwards', true), 'KeyW');
    assert.equal(keyBtn(view, 'MoveForwards').textContent, 'W');
  });
});

test('FIX-F: the PRIMARY/SECONDARY toggle is refused while the shown dict clashes', () => {
  withPane(({ doc, view }) => {
    assert.equal(controlsStaging().usingPrimary, true);
    one(view.body, 'ctl-which').onclick();
    assert.equal(controlsStaging().usingPrimary, false, 'the secondary dict is editable');
    assert.equal(keyBtn(view, 'MoveForwards').textContent, 'NONE', 'and it starts empty');
    one(view.body, 'ctl-which').onclick();

    keyBtn(view, 'MoveForwards').onclick();
    doc.listeners[0].fn(keyEvent('KeyS'));
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
    'applyUnsavedKeybinds', 'resetUnsavedToDefaults', 'comboFromEvent', 'buttonText']) {
    assert.ok(src.includes(fn), `${fn} must be driven, not reimplemented`);
  }
  const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  assert.ok(imports.includes('../systems/controlsConfig.js'));
  assert.deepEqual(imports.sort(),
    ['../systems/controlsConfig.js', '../systems/inputActions.js', './input.js'],
    'the enhanced pane drives the LAW modules and nothing else - dragging the '
    + 'classic canvas windows (controlsWindow/mouseControlsWindow/nativePanel) in '
    + 'would make the enhanced skin pay for art it never draws');
});
