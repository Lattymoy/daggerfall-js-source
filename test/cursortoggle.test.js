// AUDIT 54 (f3/input) - ACTIVATECURSOR, ONE READER PER HOST.
//
// PlayerMouseLook.cs:190-198 reads Actions.ActivateCursor in exactly
// one place and flips `cursorActive` once per press, behind one guard:
//
//   if (!GameManager.IsGamePaused &&
//       InputManager.Instance.ActionStarted(InputManager.Actions.ActivateCursor))
//     ... cursorActive = !cursorActive;
//
// The port's `bindCursorToggle` installs a FRESH window keydown
// listener per call over a MODULE-global flag (player/pointerLock.js
// :54-81), so a host that calls it twice does not get a stronger
// binding - it gets ZERO net toggles per press. ?world and ?exterior
// did exactly that: the host bound it, and the mode machine those two
// hosts build unconditionally (scenes/worldModes.js) bound a second
// one. With no window up both guards answered false, one Enter ran
// both handlers, and `cursorActive()` could never rise in either
// shipping outdoor host - which makes the large HUD's eleven panels
// unreachable by mouse, since IsLargeHUDInteractable IS that flag
// (ui/hudLarge.js's activeMouseOverLargeHUD and routeLargeHudClick,
// PlayerActivate.cs:230-236). The second flip also ran releaseLook()
// then requestLook() back to back inside one event - the post-exit
// cooldown requestLook's own header says the browser refuses.
//
// The cure is structural: ONE registration per host, and the mode
// machine PUBLISHES its window predicate (`modalWindowUp`) for the
// host to OR into its single guard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bindCursorToggle, cursorActive, setCursorActive } from '../src/player/pointerLock.js';
import { actionOf, setBindings } from '../src/ui/input.js';
import { createBindings, resetDefaults } from '../src/systems/inputActions.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCENES = join(HERE, '..', 'src', 'scenes');
const src = (rel) => readFileSync(join(HERE, '..', 'src', rel), 'utf8');

// A window/document just real enough for pointerLock.js: it collects
// the keydown listeners so the pin can COUNT them, and it counts the
// lock transitions so the spurious request is visible.
function stubDom() {
  const saved = {
    add: globalThis.addEventListener, remove: globalThis.removeEventListener,
    doc: globalThis.document, hadDoc: 'document' in globalThis,
  };
  const keydowns = [];
  const dom = {
    keydowns, requests: 0, exits: 0,
    canvas: { requestPointerLock() { dom.requests++; return undefined; } },
    press(code) {
      let prevented = false;
      const e = { code, key: code, preventDefault() { prevented = true; } };
      for (const fn of [...keydowns]) fn(e);
      return prevented;
    },
    restore() {
      globalThis.addEventListener = saved.add;
      globalThis.removeEventListener = saved.remove;
      if (saved.hadDoc) globalThis.document = saved.doc; else delete globalThis.document;
    },
  };
  globalThis.addEventListener = (t, fn) => { if (t === 'keydown') keydowns.push(fn); };
  globalThis.removeEventListener = (t, fn) => { const i = keydowns.indexOf(fn); if (i >= 0) keydowns.splice(i, 1); };
  globalThis.document = {
    pointerLockElement: dom.canvas,
    addEventListener() {},
    exitPointerLock() { dom.exits++; globalThis.document.pointerLockElement = null; },
  };
  return dom;
}

test('AUDIT 54 (f3/input): ONE Enter is ONE toggle, and the composed guard is DFU’s !IsGamePaused', () => {
  const dom = stubDom();
  const b = createBindings(); resetDefaults(b); setBindings(b);
  setCursorActive(false);
  try {
    assert.equal(actionOf({ code: 'Enter' }), 'ActivateCursor', 'the default binding (InputManager.SetupDefaults)');
    // Exactly what world.js and exterior.js now register at boot: the
    // host's own gamePaused() OR the mode machine's modalWindowUp().
    let paused = false, modal = false;
    bindCursorToggle(dom.canvas, () => paused || modal, actionOf);
    assert.equal(dom.keydowns.length, 1, 'ONE reader of the action (PlayerMouseLook.cs:190-198)');

    assert.equal(dom.press('Enter'), true, 'the toggle consumes its key');
    assert.equal(cursorActive(), true, 'one press frees the mouse');
    assert.equal(dom.exits, 1, 'and releases the lock exactly once');
    assert.equal(dom.requests, 0, 'no lock is asked for on the SAME event - that is the cooldown requestLook refuses');

    assert.equal(dom.press('Enter'), true);
    assert.equal(cursorActive(), false, 'the second press takes it back');
    assert.equal(dom.requests, 1, 'and re-locks, once');

    // !GameManager.IsGamePaused: the host's own overlay half...
    paused = true;
    assert.equal(dom.press('Enter'), false, 'a townTalk window up refuses the toggle');
    assert.equal(cursorActive(), false);
    // ...and the mode machine's half, which now rides the SAME guard
    // rather than a listener of its own.
    paused = false; modal = true;
    assert.equal(dom.press('Enter'), false, 'a window the mode machine draws refuses it too');
    assert.equal(cursorActive(), false);
    modal = false;
    assert.equal(dom.press('Enter'), true);
    assert.equal(cursorActive(), true, 'and with nothing up it works again');
  } finally {
    setCursorActive(false); setBindings(null); dom.restore();
  }
});

test('AUDIT 54 (f3/input): TWO registrations is the defect - one press, two flips, net ZERO', () => {
  // The shape ?world and ?exterior shipped, kept here as the reason the
  // count below is a law and not a tidiness rule. This is the finding's
  // own reproduction, run against the real module.
  const dom = stubDom();
  const b = createBindings(); resetDefaults(b); setBindings(b);
  setCursorActive(false);
  try {
    bindCursorToggle(dom.canvas, () => false, actionOf);   // the host's
    bindCursorToggle(dom.canvas, () => false, actionOf);   // the mode machine's
    assert.equal(dom.keydowns.length, 2, 'bindCursorToggle never dedupes - it adds a listener per call');
    dom.press('Enter');
    assert.equal(cursorActive(), false, 'ONE press, flipped twice, nets nothing');
    assert.equal(dom.requests, 1, 'and fires a lock request inside the very event that just released it');
  } finally {
    setCursorActive(false); setBindings(null); dom.restore();
  }
});

test('AUDIT 54 (f3/input): every ENTRY host binds ActivateCursor at most once (THE FOUR HOSTS RULE)', () => {
  // DISCOVERED, not enumerated - the same lesson as the U47 host sweep
  // in test/nativeinventory.test.js. The entry hosts are whatever
  // src/main.js boots, and the registrations that reach one of them are
  // whatever its scenes/ import closure calls.
  const main = readFileSync(join(HERE, '..', 'src', 'main.js'), 'utf8');
  const hosts = [...main.matchAll(/import \{ boot\w+ \} from '\.\/scenes\/(\w+\.js)'/g)].map((m) => m[1]);
  assert.deepEqual(hosts.sort(), ['dungeon.js', 'exterior.js', 'interior.js', 'world.js'],
    'the hosts main.js boots - a fifth joins this sweep by existing, not by being remembered');

  const all = new Set(readdirSync(SCENES).filter((f) => f.endsWith('.js')));
  const body = (f) => readFileSync(join(SCENES, f), 'utf8');
  const closure = (entry) => {
    const seen = new Set(); const stack = [entry];
    while (stack.length) {
      const f = stack.pop();
      if (seen.has(f) || !all.has(f)) continue;
      seen.add(f);
      for (const m of body(f).matchAll(/from '\.\/([\w.-]+\.js)'/g)) stack.push(m[1]);
    }
    return seen;
  };
  const binds = (f) => (body(f).match(/^\s*bindCursorToggle\(/gm) ?? []).length;
  const reach = {};
  for (const h of hosts) reach[h] = [...closure(h)].reduce((n, f) => n + binds(f), 0);
  for (const [h, n] of Object.entries(reach)) {
    assert.ok(n <= 1, `scenes/${h}: ${n} ActivateCursor readers - DFU has one (PlayerMouseLook.cs:190-198)`);
  }
  assert.deepEqual(reach, { 'world.js': 1, 'exterior.js': 1, 'dungeon.js': 1, 'interior.js': 0 },
    'the three play hosts bind it once each; ?interior is the map-viewer host and binds none');
  // ...and worldModes carries NONE of its own: it publishes the guard.
  const wm = src('scenes/worldModes.js');
  assert.equal((wm.match(/^\s*bindCursorToggle\(/gm) ?? []).length, 0,
    'the mode machine registers no listener - both outdoor hosts build it unconditionally');
  assert.doesNotMatch(wm, /bindCursorToggle \} from '\.\.\/player\/pointerLock\.js'/, 'and does not import it');
  assert.match(wm, /^ {4}modalWindowUp,$/m, 'it publishes its window predicate instead');
  for (const host of ['scenes/world.js', 'scenes/exterior.js']) {
    assert.match(src(host), /bindCursorToggle\(canvas, \(\) => gamePaused\(\) \|\| \(modes\?\.modalWindowUp\?\.\(\) \?\? false\), actionOf\);/,
      `${host}: one binding, and the mode machine's guard is OR'd into it rather than lost`);
  }
  assert.match(src('scenes/dungeon.js'), /bindCursorToggle\(canvas, \(\) => ctx\.uiOverlayActive, actionOf\);/,
    'the standalone dungeon host is the control case - it always had exactly one');
});
