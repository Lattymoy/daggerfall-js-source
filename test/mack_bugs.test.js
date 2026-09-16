import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createMountRig } from '../src/player/mountRig.js';
import { TRANSPORT_MODES } from '../src/systems/transport.js';
import { MOUSE_CODES, mouseCode } from '../src/ui/input.js';
import { ControlsWindow } from '../src/ui/controlsWindow.js';
import { currentDict } from '../src/systems/controlsConfig.js';

// ═══ MAC-K: THREE THINGS MAC FOUND IN PLAY ════════════════════════
//
// 2026-09-15, verbatim:
//   1. Mouse keybindings not working properly
//   2. Logbook not reflecting quests
//   3. T to mount not working outside interiors
//
// Three reports, and the same shape under two of them: a seam wired in
// three of THE FOUR HOSTS and missing from the fourth, where no
// source-text pin aimed at one host could see it. The pins below are
// aimed at POPULATIONS for exactly that reason.
//
// K2's own pins live with what they moved - test/questbridge.test.js
// for the walk and test/enhancedChronicle.test.js for the window.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const HOSTS = ['exterior', 'world', 'worldModes', 'dungeonContext'];

// ── K1: the mouse ────────────────────────────────────────────────

test('MAC-K1: EVERY host that reads a held ACTION also feeds it the mouse', () => {
  // THE DEFECT. AUDIT 39r found that `keys` was fed by keydown alone,
  // so `held(keys, 'AutoRun')` - Mouse2 at the shipped bindings -
  // could never answer true, and it fixed world.js, exterior.js and
  // dungeon.js. It MISSED worldModes.js, the interior host, which
  // calls `held(keys, 'AutoRun')` every frame and `held(keys,
  // 'ActivateCenterObject')` for the drawn bow's un-draw. Both were
  // dead in every interior in the game for the whole arc.
  //
  // Derived, so a fifth host cannot repeat it: a file that resolves a
  // BINDING out of a held set must also put the three button codes
  // into that set.
  const files = [...HOSTS.map((h) => `src/scenes/${h}.js`), 'src/scenes/dungeon.js'];
  const readers = [];
  for (const f of files) {
    const src = rd(f);
    if (!/held\(keys,/.test(src)) continue;
    readers.push(f);
    assert.match(src, /const mc = mouseCode\(e\.button\);\s*\n?\s*if \(mc\) keys\.add\(mc\);/s,
      `${f} resolves held bindings, so a mouse press must reach its key set`);
    assert.match(src, /const mc = mouseCode\(e\.button\);\s*\n?\s*if \(mc\) keys\.delete\(mc\);/s,
      `${f} must also let the button GO - a stuck Mouse2 is a stuck AutoRun`);
  }
  assert.ok(readers.length >= 4, `at least the four hosts read held bindings (found ${readers.length})`);
  assert.ok(readers.includes('src/scenes/worldModes.js'), 'the interior host is one of them - it is the one that was missed');
});

test('MAC-K1: the crossed middle name is spelled ONCE, and the hosts read that table', () => {
  // Unity counts Mouse0/1/2 as left/RIGHT/middle; MouseEvent.button
  // counts left/MIDDLE/right. The two middle names cross, so a host
  // that spelled 'Mouse' + e.button would hand the wheel the right
  // button's action.
  assert.deepEqual([...MOUSE_CODES], ['Mouse0', 'Mouse2', 'Mouse1']);
  assert.equal(mouseCode(0), 'Mouse0', 'left');
  assert.equal(mouseCode(1), 'Mouse2', 'the DOM’s middle is Unity’s Mouse2');
  assert.equal(mouseCode(2), 'Mouse1', '...and the DOM’s right is Unity’s Mouse1');
  assert.equal(mouseCode(3), null, 'a fourth button is not a KeyCode');
  assert.equal(mouseCode(-1), null);
  for (const f of [...HOSTS.map((h) => `src/scenes/${h}.js`), 'src/scenes/dungeon.js',
    'src/ui/controlsWindow.js', 'src/ui/enhancedControls.js']) {
    const src = rd(f);
    if (!src.includes('mouseCode')) continue;
    assert.ok(!/['"`]Mouse['"`]\s*\+/.test(src), `${f} must not spell the crossing a second time`);
  }
});

test('MAC-K1: BOTH controls skins can capture a mouse button, which is what "not working properly" was', () => {
  // The registry has carried Mouse0/1/2 since AUDIT 39r - three of the
  // shipped defaults ARE mouse buttons - and every runtime reader took
  // them. The one door a player uses could not: both skins' capture
  // listened for a KEY. So an action could never be moved onto a
  // button, and one cleared off a button could never be put back.
  //
  // DFU's WaitForKeyPress is `Input.GetKeyDown` walked over every
  // KeyCode, and Mouse0/1/2 are KeyCodes like any other.
  const enh = rd('src/ui/enhancedControls.js');
  assert.match(enh, /document\.addEventListener\('mousedown', armedMouse, \{ capture: true \}\);/);
  assert.match(enh, /document\.removeEventListener\('mousedown', armedMouse, \{ capture: true \}\);/,
    'and it leaves with the capture - a listener outliving its screen is its own bug');
  assert.match(enh, /const code = mouseCode\(e\.button\);\s*\n\s*if \(code == null\) return;/,
    'a fourth button is not a binding, and must not end the capture with nothing written');

  const classic = rd('src/ui/controlsWindow.js');
  assert.match(classic, /click\(vx, vy, right = false, middle = false\) \{/,
    'the classic grid needed the button to reach it at all');

  // ...AND IT IS DRIVEN, not read. THE CAMPAIGN'S OWN LESSON, for the
  // sixth time in this port: the first cut of this pin grepped for the
  // binding line, and a mutant that put the old `return true` back and
  // left the new arm under `if (false)` SURVIVED it - the text was
  // still there. A source-text pin cannot tell a live branch from a
  // dead one. This one arms a real capture and clicks.
  const win = new ControlsWindow();
  const jump = win.buttons.find((b) => b.action === 'Jump');
  assert.ok(jump, 'the grid offers Jump');
  const hit = (right, middle) => win.click(jump.x + 1, jump.y + 1, right, middle);
  hit(false, false);                       // the left click that ARMS
  assert.equal(win.capture, 'Jump', 'a left click on the row arms the capture');
  hit(false, false);                       // the NEXT press binds
  assert.equal(currentDict(win.unsaved).get('Jump'), 'Mouse0', 'the left button binds');
  assert.equal(win.capture, null, 'and one press ends it');

  hit(false, false);
  hit(true, false);
  assert.equal(currentDict(win.unsaved).get('Jump'), 'Mouse1',
    'the RIGHT button is Unity\u2019s Mouse1 - the crossed middle name, read off the one table');
  hit(false, false);
  hit(false, true);
  assert.equal(currentDict(win.unsaved).get('Jump'), 'Mouse2', 'and the wheel press is Mouse2');

  // the remove gesture is still the remove gesture when NOTHING is armed
  assert.equal(win.capture, null);
  const before = currentDict(win.unsaved).get('Jump');
  win.click(0, 0, true);                   // a right click on dead space
  assert.equal(currentDict(win.unsaved).get('Jump'), before, 'and it did not bind anything');
  // ...and the host really passes the third and fourth arguments, or
  // the grid's `middle` is a parameter nothing ever fills.
  assert.match(rd('src/scenes/townTalk.js'),
    /overlay\.click\?\.\(v\[0\], v\[1\], e\.button === 2, e\.button === 1\)/,
    'the overlay seam carries the button, which is what makes the grid’s arm reachable');
});

// ── K3: the mount ────────────────────────────────────────────────

test('MAC-K3: the picker refuses AIRBORNE in silence, and opens grounded', () => {
  // dfuiOpenTransportWindow (DaggerfallUI.cs:690-700): `if
  // (isGrounded)` with NO else. Airborne is not a refusal line, it is
  // nothing at all.
  const shown = [];
  const player = { grounded: false, transportMode: TRANSPORT_MODES.Foot, setTransportMode() {} };
  const rig = createMountRig({
    renderer: {}, canvas: {}, fetchBytes: async () => new Uint8Array(),
    palette: null, audio: { playOneShot() {}, setLoop() {} },
    player, playerEntity: { items: [] },
    showOverlay: (w) => shown.push(w),
  });
  rig.open();
  assert.equal(shown.length, 0, 'airborne: nothing, and no line either');
  // grounded, but the picker's own ART is not loaded in node, so the
  // second half of the gate still refuses - which is the honest answer
  // and is why this pin asserts the GATE rather than a window object
  player.grounded = true;
  rig.open();
  assert.equal(shown.length, 0, 'grounded but artless: still nothing to show');
});

test('MAC-K3: setMode is the ONE motor call, and it drops the art before it loads the new mount', () => {
  // HC1 (2026-09-14, Mac: "audit the horse and cart ... the sprites
  // actually show"): the art loads where the MODE changes, not on the
  // T-key pick alone - three other paths set it (a loaded save on
  // horseback, the Test Room's ride out, the ship's landing) and each
  // used to leave a rider with no horse under them.
  const calls = [];
  const player = { grounded: true, transportMode: TRANSPORT_MODES.Foot, standing: true, isRunning: false, movingLessThanHalfSpeed: false,
    setTransportMode(m) { calls.push(m); this.transportMode = m; } };
  const rig = createMountRig({
    renderer: {}, canvas: {}, fetchBytes: async () => { throw new Error('no ARENA2 here'); },
    palette: null, audio: { playOneShot() {}, setLoop() {} },
    player, playerEntity: { items: [] }, showOverlay: () => {},
  });
  rig.setMode(TRANSPORT_MODES.Horse);
  assert.deepEqual(calls, [TRANSPORT_MODES.Horse], 'the motor is told, once');
  assert.equal(rig.loaded(), false, 'and a failed art load leaves NO mount rather than a stale one');
  rig.setMode(TRANSPORT_MODES.Foot);
  assert.deepEqual(calls, [TRANSPORT_MODES.Horse, TRANSPORT_MODES.Foot]);
});

test('MAC-K3: a frame while dismounted draws nothing, and cannot reach a canvas it has not got', () => {
  // The draw is gated on `isRiding` AND on the art being up, so the
  // per-frame call is safe on foot - which matters because the fixed-
  // city host now runs it every frame and had never run it before.
  let drew = 0;
  const player = { grounded: true, transportMode: TRANSPORT_MODES.Foot, standing: true, isRunning: false, movingLessThanHalfSpeed: false, setTransportMode() {} };
  const rig = createMountRig({
    renderer: { drawScreenQuad: () => { drew++; } },
    canvas: null,                       // deliberately: nothing may reach it
    fetchBytes: async () => new Uint8Array(), palette: null,
    audio: { playOneShot() {}, setLoop() {} },
    player, playerEntity: { items: [] }, showOverlay: () => {},
  });
  rig.frame(1 / 60);
  assert.equal(drew, 0, 'on foot, nothing is drawn');
});
