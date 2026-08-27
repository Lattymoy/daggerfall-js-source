// U51 - THE PAUSE DOOR, pinned.
//
// Escape's screen is now a decision, and this file holds the decision
// and its edges. Two kinds of assertion, kept apart on purpose:
//
//   BEHAVIOUR - the fork itself runs in node. `?skin=` is a URL and
//   uiSkin reads one from an injected string, so both branches can be
//   taken here for real rather than read off the page.
//
//   SOURCE SWEEPS, and they say so. The enhanced screen is DOM and
//   the hosts are canvases; node can drive neither. What a sweep CAN
//   hold is the structure a browser check would not notice going
//   wrong - a second copy of the design, a host that slipped back to
//   importing the classic window directly, an eager import that makes
//   the classic skin pay for a module it never shows, or a listener
//   with no owner. The screen itself is proven in a real browser by
//   tools/enhancedPauseProbe.mjs.
//
// A PIN MUST FAIL: every assertion below dies under a one-character
// change to the law it names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { openPauseFlow, pauseDoorReady, pauseArtLoaded } from '../src/ui/pauseDoor.js';
import { _resetForTests } from '../src/systems/uiPrefs.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// uiSkin reads globalThis.location.search when it is given no string,
// and node has no location. Set one, and reset the stored pref so one
// test's choice never answers for the next.
const skin = (value) => { _resetForTests(); globalThis.location = { search: `?skin=${value}` }; };

// A DOCUMENT, JUST ENOUGH OF ONE. The fork's second clause is
// `typeof document !== 'undefined'`, and node has none - so a test that
// only sets the skin takes the CLASSIC branch on both skins and passes
// for the wrong reason. Mutation M4 (drop `isEnhanced()` from the
// condition) survived the first draft of this file for exactly that
// reason, which is the vacuous-pin shape AUDIT 17e Wave 3 went hunting.
//
// The enhanced branch touches four things before it goes async, and
// this is those four. The pending dynamic import lands after the test
// body; disposing the overlay synchronously makes its `if (fired)`
// guard take the early return, which is that guard's own pin.
function withDocument(fn) {
  const node = { id: '', style: {}, removed: false, remove() { this.removed = true; } };
  globalThis.document = { createElement: () => node, body: { append() {} } };
  try { return fn(node); } finally { delete globalThis.document; }
}

/** The same, held open across the lazy import. */
async function withDocumentAsync(fn) {
  const node = { id: '', style: {}, removed: false, remove() { this.removed = true; } };
  globalThis.document = { createElement: () => node, body: { append() {} } };
  try { return await fn(node); } finally { delete globalThis.document; }
}

/** Let the dynamic import in pauseDoor.js land. The module is warmed
 *  first so the import resolves from the registry rather than off the
 *  disk, then a few turns of the loop for the .then to run. */
async function settleImport() {
  await import('../src/ui/enhancedMenu.js');
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
}

// ── THE FORK ─────────────────────────────────────────────────────

test('U51: the classic skin still gets the classic window', () => {
  skin('classic');
  withDocument(() => {
    let shown = null;
    const win = openPauseFlow((w) => { shown = w; }, { exitToMenu() {} });
    assert.equal(win?.constructor?.name, 'PauseOptionsWindow',
      'a player who chose classic must get OPTN00I0, not the DOM screen');
    assert.equal(shown, win, 'and the host gets the same object the factory returns');
  });
});

test('U51: the enhanced skin gets the DOM screen, and the host holds it', () => {
  skin('enhanced');
  withDocument((node) => {
    let shown = null;
    const win = openPauseFlow((w) => { shown = w; }, {});
    assert.notEqual(win?.constructor?.name, 'PauseOptionsWindow',
      'the enhanced skin must not get the canvas window');
    assert.equal(shown, win, 'the host slot holds it - which is what stops the motor and the clock');
    assert.equal(win.done, false, 'a screen that reports done on arrival is torn down on arrival');
    assert.equal(node.id, 'enhanced-pause');
    assert.match(node.style.cssText, /position:fixed;inset:0/,
      'over the canvas, and opaque - the renderer clears to the Iliac Bay sky');
    // dispose BEFORE the lazy import lands: the mount must take its
    // early return rather than mounting into a div already removed.
    win.dispose();
    assert.equal(win.done, true, 'dispose closes the door');
    assert.equal(node.removed, true, 'and takes the div with it');
  });
});

test('U51: a host with no document keeps the canvas window, on either skin', () => {
  // The same guard chargenSession's fork carries, for the same reason:
  // node drives these hosts headless and must not have a special case
  // written for it. `document` is undefined here, so the enhanced
  // branch cannot be taken however the skin reads.
  skin('enhanced');
  assert.equal(typeof document, 'undefined', 'this test is only meaningful headless');
  const win = openPauseFlow(() => {}, {});
  assert.equal(win?.constructor?.name, 'PauseOptionsWindow');
});

// ── THE ART GATE MOVED WITH THE DOOR ─────────────────────────────
// The four hosts gate Escape on this predicate. Classic cannot draw
// one pixel of its panel without OPTN00I0.IMG; the enhanced screen
// needs no ARENA2 at all, which is the whole premise of U49's front
// door. Gating the enhanced screen on classic art would strand a
// player whose art load failed with no pause menu, no settings and no
// way out of a game that would have rendered perfectly.
test('U51: the door needs classic art only where the classic window draws it', () => {
  assert.equal(pauseArtLoaded(), false, 'no ARENA2 in this container - that is the point');
  skin('classic');
  assert.equal(pauseDoorReady(), false, 'classic with no OPTN00I0 has nothing to draw');
  skin('enhanced');
  assert.equal(pauseDoorReady(), true, 'the enhanced screen reads no game data at all');
});

test('U51: every host gates on the door, and not on the classic art', () => {
  for (const rel of ['scenes/world.js', 'scenes/exterior.js',
    'scenes/worldModes.js', 'scenes/dungeonContext.js']) {
    const src = read(`src/${rel}`);
    assert.match(src, /pauseDoorReady\(\)/, `${rel} must gate on the door`);
    assert.doesNotMatch(src, /pauseArtLoaded\(\)/,
      `${rel} must not gate the enhanced screen on classic art`);
    assert.match(src, /from '\.\.\/ui\/pauseDoor\.js'/,
      `${rel} reaches the pause screen through the ONE seam`);
    assert.doesNotMatch(src, /from '\.\.\/ui\/pauseWindow\.js'/,
      `${rel} must not import the classic window past the fork`);
  }
});

// ── ONE SCREEN, TWO MODES ────────────────────────────────────────
// The obvious build was a second enhanced screen for the pause menu,
// and it is the wrong one: the front door and the pause door would
// then own two copies of a settings view, which is the exact
// divergence U49 collapsed four boot screens to avoid.
test('U51: the fork asks the SKIN, not only the document', () => {
  // The behaviour pins above take both branches, and this holds the
  // condition itself: `typeof document` alone would send a classic
  // player to the DOM screen in every real browser there is.
  const src = read('src/ui/pauseDoor.js');
  assert.match(src, /if \(isEnhanced\(\) && typeof document !== 'undefined'\) return enhancedPauseOverlay\(/,
    'both clauses, in that order');
});

test('PX2: both doors open on the pixel home', () => {
  // U51's pause law was 'open on Save Game - what Escape was pressed
  // for'. PX2 replaced it deliberately (Mac's adopted face): pause
  // opens on the SAME pixel home as boot, Save Game one visible press
  // away, and Escape on the face resumes. The MEASURED half below
  // holds the resume arm - a home that cannot resume is a trap.
  const src = read('src/ui/enhancedMenu.js');
  assert.match(src, /^  section = 'home';$/m);
  assert.match(src, /mode === 'pause' \? \(\) => onAction\('resume'\)/,
    'Escape on the pause face must resume');
});

test('U51: the pause door mounts the FRONT DOOR, not a second design', () => {
  const src = read('src/ui/pauseDoor.js');
  assert.match(src, /import\('\.\/enhancedMenu\.js'\)/,
    'the pause screen IS ui/enhancedMenu.js');
  assert.match(src, /mountEnhancedMenu\(host, \{ mode: 'pause', hooks, onAction: act \}\)/,
    'mounted in pause mode with the host’s own hooks');
  // and it carries no design of its own, exactly as menu.html carries
  // none - the tokens and the layout live in ui/enhancedStyle.js
  assert.ok(!/--brass|--verdigris|\.railbtn|grid-template-columns/.test(src),
    'ui/pauseDoor.js must hold no layout - one design language, one home');
});

// THE RACE THE GUARD IS FOR. The screen mounts asynchronously and a
// host can tear its overlay out before the module lands - the death
// sequence and a scene change both do exactly that. Without the guard
// the mount runs into a div that is already off the document, and the
// menu it builds has no owner: `close()` has already fired, so the
// unmount that would remove its capture keydown never runs, and Escape
// is swallowed for the rest of the session by a screen nobody can see.
test('U51: a dispose before the module lands mounts nothing at all', async () => {
  skin('enhanced');
  const warns = [];
  const real = console.warn;
  console.warn = (...a) => warns.push(a.map(String).join(' '));
  try {
    await withDocumentAsync(async (node) => {
      const win = openPauseFlow(() => {}, {});
      win.dispose();
      assert.equal(node.removed, true, 'the div goes with the dispose');
      await settleImport();
      assert.deepEqual(warns, [],
        'the mount must take its early return - a mount attempt into a removed div '
        + 'is the leaked-listener path, and it announces itself through the catch');
      assert.equal(globalThis.__menu, undefined, 'and it built no screen');
    });
  } finally { console.warn = real; }
});

test('U51: the enhanced screen is a DYNAMIC import - classic pays nothing', () => {
  const src = read('src/ui/pauseDoor.js');
  assert.doesNotMatch(src, /^import .*enhancedMenu\.js/m,
    'a static import would load the whole enhanced design for a player who chose classic');
  assert.match(src, /\.catch\(\(e\) => \{[^]*?host\.remove\(\)/,
    'a failed load must take its empty div with it, or the host holds an overlay '
    + 'that never reports done - a frozen game');
});

// ── THE OVERLAY CONTRACT ─────────────────────────────────────────
test('U51: done goes true only after the view is down', () => {
  const src = read('src/ui/pauseDoor.js');
  const close = src.slice(src.indexOf('const close = ()'), src.indexOf('const overlay = {'));
  const unmountAt = close.indexOf('view?.unmount()');
  const removeAt = close.indexOf('host.remove()');
  const firedAt = close.indexOf('fired = true');
  assert.ok(unmountAt > 0 && removeAt > unmountAt && firedAt > removeAt,
    'the hosts tear an overlay out the moment it reports done, and a DOM node '
    + 'outlives the object reporting it: unmount, remove, THEN fire');
});

test('U51: every exit takes the screen down before it acts', () => {
  // Classic's own order (pauseWindow.js - `_closeWith()` then the
  // hook), and it matters more here: the port answers a save or a load
  // with a HUD line, and this screen is an opaque div over the whole
  // canvas, so a hook fired under a live door hides its own answer.
  const src = read('src/ui/pauseDoor.js');
  const act = src.slice(src.indexOf('const act = (action)'), src.indexOf('show(overlay);'));
  const closeAt = act.indexOf('close();');
  const saveAt = act.indexOf('quickSave');
  assert.ok(closeAt > 0, 'the exits must close the screen at all');
  assert.ok(saveAt > closeAt, 'close first, then save');
  for (const hook of ['quickSave', 'quickLoad', 'exitToMenu']) {
    assert.ok(act.includes(`hooks.${hook}?.()`), `${hook} is optional - two hosts hand none`);
  }
});

// ── THE SCREEN'S OWN INPUT ───────────────────────────────────────
test('U51: the host arms are no-ops BY DESIGN, and say so', () => {
  const src = read('src/ui/pauseDoor.js');
  // A silently empty input() here is indistinguishable from a broken
  // one, which is why the wizard's arms carry the same sentences.
  for (const arm of ['input', 'click', 'wheel', 'tick', 'draw']) {
    assert.match(src, new RegExp(`${arm}\\(\\) \\{ /\\*`),
      `${arm}() must say why it does nothing`);
  }
});

test('U51: Escape closes the pause door, through the shared table', () => {
  const src = read('src/ui/enhancedMenu.js');
  assert.match(src, /import \{ overlayAction \} from '\.\/input\.js'/,
    'not a second key map - the same table every other window answers through');
  const onKey = src.slice(src.indexOf('function onKey(e)'), src.indexOf('function releaseLock()'));
  assert.match(onKey, /overlayAction\(e\) !== 'back'/, 'Escape and nothing else');
  assert.match(onKey, /e\.stopPropagation\(\)/,
    'a modal overlay owns its input - the host walks the player on the keys underneath it');
  // THE BACK STACK, innermost first: a confirm card and a phone's help
  // sheet are both things Escape closes before it closes the screen,
  // or the one press meaning "not that" quits the game.
  const confirmAt = onKey.indexOf('confirming ?');
  const sheetAt = onKey.indexOf('sheetOpen ?');
  const resumeAt = onKey.indexOf("onAction('resume')");
  assert.ok(confirmAt > 0 && sheetAt > confirmAt && resumeAt > sheetAt,
    'confirm, then sheet, then the screen itself');
  assert.match(onKey, /mode === 'pause'/,
    'at boot there is nothing behind the front door to go back to');
  // ...and a key this screen did NOT use stays the page's: at boot
  // with nothing open, Escape is not claimed at all. The wizard's own
  // rule - preventDefault on an unused key stops Tab moving focus.
  const bailAt = onKey.indexOf('if (!back) return;');
  const claimAt = onKey.indexOf('e.preventDefault()');
  // -1 < anything, so the needle has to be PROVEN present before its
  // position means a thing. Mutation M13 (delete the bail) survived
  // the first draft of this assertion on exactly that.
  assert.ok(bailAt > 0, 'the unused-key bail is gone');
  assert.ok(claimAt > bailAt, 'the screen decides it used the key BEFORE it claims it');
});

test('U51: every listener has an owner', () => {
  // A window-level keydown outlives the DOM it was mounted for. On the
  // pause door that is not a leak, it is a game that can never be
  // paused again: the dead listener keeps swallowing Escape.
  const src = read('src/ui/enhancedMenu.js');
  const unmount = src.slice(src.indexOf('    unmount() {'));
  assert.match(unmount, /removeEventListener\('keydown', keyHandler, \{ capture: true \}\)/);
  assert.match(unmount, /removeEventListener\('pointerlockchange', lockHandler\)/);
  assert.match(unmount, /keyHandler = null/);
});

test('U51: the pointer lock is dropped, and kept dropped', () => {
  // Mouselook is the port's resting state, so the pause screen always
  // mounts over a LOCKED pointer - and a locked pointer does not
  // travel through the DOM at all: every mouse event goes to the
  // locked element as a movement delta, so a fixed div is invisible to
  // it however high its z-index.
  const src = read('src/ui/enhancedMenu.js');
  assert.match(src, /document\.exitPointerLock\(\)/);
  assert.match(src, /addEventListener\('pointerlockchange', lockHandler\)/,
    'a host that re-takes the lock must have it taken back');
});

// ── THE PANES TELL THE TRUTH ABOUT WHAT THE HOST WILL DO ─────────
// Two of the four hosts hand `savingPrevented: () => true` and no save
// or load hook at all. A Save button drawn there would be the lie the
// anti-lie law forbids, and a rail with the row removed would teach
// the player the door was never there.
test('U51: save and load answer the host, not the rail', () => {
  const src = read('src/ui/enhancedMenu.js');
  const save = src.slice(src.indexOf('function paneSave(body)'), src.indexOf('function paneExit(body)'));
  assert.match(save, /hooks\.savingPrevented\?\.\(\) \|\| typeof hooks\.quickSave !== 'function'/,
    'the classic gate, plus a host that hands no hook at all');
  assert.match(save, /You cannot save now\./,
    'the game’s own recovered string, not a rewording of it');
  const load = src.slice(src.indexOf('function paneLoad(body)'), src.indexOf('function paneSave(body)'));
  assert.match(load, /typeof hooks\.quickLoad === 'function'/, 'no hook, no button');
  // ...and the mount has to KEEP what the door handed it. Dropping the
  // trio here is silent: every pane falls back to its refusal text, so
  // all four hosts lose save, load and exit at once and each one says
  // politely that this part of the game has no door.
  assert.match(src, /^  hooks = h \?\? \{\};$/m,
    "the host's own hooks, stored - not the empty object the panes read as a refusal");
  // and both rows stay on the rail wherever they are refused
  assert.match(src, /const SECTIONS_PAUSE = \['Resume', 'Save Game', 'Load Game'/);
});
