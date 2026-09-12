// MAC'S FIVE (2026-09-12): "1. All mods should be enabled by default
// 2. Bring back the pixelated sky we removed in a past commit. On by
// default and apart of a new toggle within enhanced environments 3. I
// wanna push the draw distance as far as we can push it while keeping
// performance perfect 4. The mouse pointer can still get stuck outside
// of the game, not allowing you to interact with the game unless
// refreshing 5. 3D geometry has this issue where while it has
// collision, you can immediately walk over things (like interior
// tables, tree trunks, etc)". MO1, PS1, LV1, PL3, SH1 - one pin each,
// and the seams by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MOD_SETTINGS, modSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { RETRO, retroFor } from '../src/render/enhancedSky.js';
import { landViewDistance, LAND_VIEW_TIERS, LAND_VIEW_MAX, LAND_VIEW_DEFAULT, LAND_VIEW_DFU_MAX } from '../src/world/landView.js';
import { TERRAIN_DISTANCE } from '../src/world/streamingWorld.js';
import { bindCursorToggle, makeLookGate, requestLook, cursorActive, setCursorActive, RELOCK_GRACE_MS } from '../src/player/pointerLock.js';
import { registerOverlay } from '../src/ui/enhancedOverlays.js';
import { Collider } from '../src/player/collider.js';
import { STEP_OFFSET } from '../src/player/motor.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('MO1: every mod with a switch ships ON - the Mods pane is where one is turned off', () => {
  _resetModSettings();
  const switched = Object.entries(MOD_SETTINGS).filter(([, def]) => def.keys.Enabled);
  assert.ok(switched.length >= 5, `the vendored mods with a switch: ${switched.map(([k]) => k).join(', ')}`);
  for (const [vendor, def] of switched) {
    assert.equal(def.keys.Enabled.default, true, `${vendor} ships on`);
    assert.equal(modSetting(vendor, 'Enabled'), true, `${vendor} reads on with nothing stored`);
  }
  assert.equal(MOD_SETTINGS['roads-hazelnut'].keys.Enabled, undefined, 'Basic Roads has no switch - it is the road network itself');
  // the DFU-verbatim suites state their precondition (the game without its mods) through one helper
  assert.match(read('test/modsOff.js'), /if \(def\.keys\.Enabled\) setModSetting\(vendor, 'Enabled', false\)/);
  assert.match(read('test/audit18_combat.test.js'), /^import '\.\/modsOff\.js';/m, 'the formula suite runs without the mods');
});

test('PS1: the pixelated sky is the dome\'s default again, the Enhanced pane\'s switch, the URL doors still win', () => {
  assert.deepEqual(RETRO, { step: Math.PI / 512, levels: 26 }, 'ES1e\'s pixel and palette, unchanged');
  assert.equal(retroFor(''), RETRO, 'silent URL, switch on (the default)');
  assert.equal(retroFor('', true), RETRO);
  assert.equal(retroFor('', false), null, 'the switch off is the smooth dome');
  assert.equal(retroFor('?sky=smooth', true), null, '?sky=smooth wins over the switch');
  assert.equal(retroFor('?sky=retro', false), RETRO, '?sky=retro wins the other way');
  assert.match(read('src/systems/uiPrefs.js'), /pixelatedSky: true,/, 'on by default');
  assert.match(read('src/ui/enhancedMenu.js'), /prefRow\('pixelatedSky', 'Pixelated sky',/, 'a row in the Enhanced pane beside Enhanced environments');
  assert.match(read('src/scenes/shared.js'), /enhancedSky\.retro = retroFor\(params\.toString\(\), getPref\('pixelatedSky'\)\);/, 'the host reads the switch through the one door');
});

test('LV1: the enhanced lane streams its own radius - 5 by default, 6 at most - and the 1:1 lane keeps DFU\'s 1..4', () => {
  assert.equal(TERRAIN_DISTANCE, 3, 'StreamingWorld.cs:56, untouched');
  assert.equal(LAND_VIEW_DFU_MAX, 4); assert.equal(LAND_VIEW_MAX, 6); assert.equal(LAND_VIEW_DEFAULT, 5);
  assert.equal(landViewDistance({ enhanced: false, pref: 6, setting: 3 }), 3, 'the 1:1 lane is DFU\'s setting, whatever the pane says');
  assert.equal(landViewDistance({ enhanced: false, pref: 6, setting: 9 }), 4, 'clamped to DFU\'s [Range(1,4)]');
  assert.equal(landViewDistance({ enhanced: true, pref: 5, setting: 3 }), 5, 'the enhanced lane is the pane\'s');
  assert.equal(landViewDistance({ enhanced: true, pref: 9, setting: 3 }), 6, 'clamped to the enhanced ceiling');
  assert.equal(landViewDistance({ enhanced: true, pref: 'x', setting: 3 }), LAND_VIEW_DEFAULT, 'a bad pref is the default');
  assert.equal(landViewDistance({ enhanced: true, pref: 0, setting: 3 }), 1);
  assert.deepEqual(LAND_VIEW_TIERS.map(([v]) => v), [3, 4, 5, 6]);
  assert.match(read('src/systems/uiPrefs.js'), /landViewDistance: 5,/);
  const world = read('src/scenes/world.js');
  assert.match(world, /const fogDistance = landViewDistance\(\{/, 'ONE read for the fog scale and the grid');
  assert.match(world, /new StreamingWorldState\(fogDistance\)/);
  assert.match(read('src/ui/enhancedMenu.js'), /choiceRow\('landViewDistance', 'Land view distance',[\s\S]{0,600}LAND_VIEW_TIERS\)\);/);
});

// A window/document just real enough for pointerLock.js's toggle and net.
function stubDom() {
  const saved = { add: globalThis.addEventListener, remove: globalThis.removeEventListener, doc: globalThis.document, hadDoc: 'document' in globalThis };
  const keydowns = []; const downs = [];
  const dom = {
    requests: 0, exits: 0,
    canvas: { requestPointerLock() { dom.requests++; globalThis.document.pointerLockElement = dom.canvas; return undefined; } },
    press(code, target = null) {
      let prevented = false;
      const e = { code, key: code, target, preventDefault() { prevented = true; } };
      for (const fn of [...keydowns]) fn(e);
      return prevented;
    },
    click(target, pointerType = 'mouse') { for (const fn of [...downs]) fn({ target, pointerType }); },
    restore() {
      globalThis.addEventListener = saved.add; globalThis.removeEventListener = saved.remove;
      if (saved.hadDoc) globalThis.document = saved.doc; else delete globalThis.document;
    },
  };
  globalThis.addEventListener = (t, fn) => { if (t === 'keydown') keydowns.push(fn); };
  globalThis.removeEventListener = (t, fn) => { const i = keydowns.indexOf(fn); if (i >= 0) keydowns.splice(i, 1); };
  globalThis.document = {
    pointerLockElement: null, body: { tag: 'body' }, documentElement: { tag: 'html' },
    addEventListener(t, fn) { if (t === 'pointerdown') downs.push(fn); },
    removeEventListener(t, fn) { const i = downs.indexOf(fn); if (i >= 0) downs.splice(i, 1); },
    exitPointerLock() { dom.exits++; globalThis.document.pointerLockElement = null; },
  };
  return dom;
}
const actionOf = (e) => (e.code === 'Enter' ? 'ActivateCursor' : null);

test('PL3: the bind resets the latch, an enhanced overlay owns Enter, and a click on the page takes the lock back', () => {
  const dom = stubDom();
  try {
    setCursorActive(true);   // latched by an earlier host, the way it was left
    const off = bindCursorToggle(dom.canvas, () => false, actionOf);
    assert.equal(cursorActive(), false, 'a host boot is a fresh PlayerMouseLook - the latch is gone');
    // the dial (or the pack it opened) is up: Enter is its commit, not the toggle
    const unregister = registerOverlay(() => {});
    assert.equal(dom.press('Enter'), false, 'not the toggle while an overlay stands');
    assert.equal(cursorActive(), false);
    // the net: a click on the page with nothing up and no lock relocks - not while an overlay stands
    dom.click(dom.canvas);
    assert.equal(dom.requests, 0, 'an overlay up: the click is the overlay\'s');
    unregister();
    dom.click({ tag: 'button' });
    assert.equal(dom.requests, 0, 'a click on the page\'s UI is that element\'s');
    dom.click(globalThis.document.body);
    assert.equal(dom.requests, 1, 'a click on the body beside the canvas takes the lock');
    dom.click(dom.canvas);
    assert.equal(dom.requests, 1, 'already held: nothing to ask for');
    globalThis.document.pointerLockElement = null;
    dom.click(dom.canvas, 'touch');
    assert.equal(dom.requests, 1, 'a finger never holds a lock');
    assert.equal(dom.press('Enter'), true, 'with nothing up, Enter is the toggle');
    assert.equal(cursorActive(), true);
    dom.click(dom.canvas);
    assert.equal(dom.requests, 1, 'the activated cursor keeps its precedence over a click (DFU\'s own distinction)');
    off();
    dom.click(dom.canvas);
    assert.equal(dom.requests, 1, 'the unbind removes the net');
  } finally { setCursorActive(false); dom.restore(); }
});

test('PL3: the look gate holds a lock a door just won inside its gesture, and releases a window that is really up', () => {
  const dom = stubDom();
  try {
    setCursorActive(false);
    const gate = makeLookGate(dom.canvas);
    gate(true);
    assert.equal(dom.exits, 0, 'nothing held, nothing to release');
    requestLook(dom.canvas);   // the door's relock, inside the Resume click
    gate(true);                 // the frame after: the overlay slot has not drained yet
    assert.equal(dom.exits, 0, 'within the grace the lock the gesture won is kept');
    assert.equal(globalThis.document.pointerLockElement, dom.canvas);
    gate(false);
    assert.equal(dom.requests, 2, 'the falling edge asks again - the browser answers a held lock with nothing');
    assert.ok(RELOCK_GRACE_MS < 250, 'a grace, not a hold: a window that really opens releases on the next frame past it');
    assert.match(read('src/player/pointerLock.js'), /if \(held\) \{ if \(nowMs\(\) - _lastRequestAt > RELOCK_GRACE_MS\) releaseLook\(\); \}/);
    // the seams by source
    assert.match(read('src/scenes/world.js'), /onOpen: \(\) => \{ setCursorActive\(false\); releaseLook\(\); \},/, 'the Enter that opens the chat is the chat\'s');
    assert.match(read('src/ui/pixelDial.js'), /onClose: \(\) => \{ _open = null; if \(lockEl\) requestLook\(lockEl\); \},/, 'the dial gives the pointer back');
    assert.match(read('src/main.js'), /z-index:20;white-space:pre-wrap;pointer-events:none'/, 'the crash report is not a wall over the canvas');
  } finally { setCursorActive(false); dom.restore(); }
});

// ---- SH1: a table is a wall, a step is a step ----
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const quad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) => ({ positions: [ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz], indices: [0, 1, 2, 0, 2, 3] });
function boxWorld(h, { z0 = 3, z1 = 6, hw = 3 } = {}) {
  const col = new Collider(() => 0);
  const add = (q) => col.addMesh('m', q.positions, q.indices, I);
  add(quad(-10, 0, -10, 10, 0, -10, 10, 0, 30, -10, 0, 30));
  add(quad(-hw, 0, z0, hw, 0, z0, hw, h, z0, -hw, h, z0));       // the face the player walks into
  add(quad(-hw, h, z0, hw, h, z0, hw, h, z1, -hw, h, z1));       // the top
  add(quad(hw, 0, z1, -hw, 0, z1, -hw, h, z1, hw, h, z1));
  add(quad(-hw, 0, z1, -hw, 0, z0, -hw, h, z0, -hw, h, z1));
  add(quad(hw, 0, z0, hw, 0, z1, hw, h, z1, hw, h, z0));
  return col;
}
/** Walk +z into the box at a walking pace for `frames` 60 Hz steps; a
 *  grounded frame presses down a hair, an airborne one falls. */
function walkInto(col, frames = 240) {
  const feet = [0, 0, 0]; let vy = 0; let grounded = true; let maxY = 0; let airborne = 0;
  for (let f = 0; f < frames; f++) {
    const dy = grounded ? -0.001 : (vy -= 9.81 / 3600);
    const r = col.move(feet, 0, dy, 0.05, 1.8, true);
    grounded = r.grounded; if (grounded) vy = 0;
    maxY = Math.max(maxY, feet[1]); if (!grounded && feet[1] > 0.05) airborne++;
  }
  return { y: feet[1], z: feet[2], maxY, airborne };
}

test('SH1: a box taller than stepOffset is a wall - the player slides along it and never mounts it; a lower one is a step', () => {
  assert.equal(STEP_OFFSET, 0.5);
  for (const h of [0.55, 0.6, 0.7, 0.9, 1.2]) {
    const r = walkInto(boxWorld(h));
    assert.ok(r.maxY < 1e-3, `a ${h} box (a table, a trunk) is never mounted (maxY ${r.maxY.toFixed(3)})`);
    assert.ok(r.z < 3, `and blocks (z ${r.z.toFixed(2)})`);
    assert.equal(r.airborne, 0, 'no hover at the edge, no bob');
  }
  for (const h of [0.3, 0.4]) {
    const r = walkInto(boxWorld(h));
    assert.ok(r.maxY >= h - 1e-3 && r.z > 6, `a ${h} box is stepped onto and walked across (maxY ${r.maxY.toFixed(3)}, z ${r.z.toFixed(2)})`);
  }
  // the ladder's law by source: the cap and the down leg
  const src = read('src/player/collider.js');
  assert.match(src, /if \(retry\[1\] > standCeil \+ 1e-4\) continue;/);
  assert.match(src, /const standCeil = entryY \+ STEP_OFFSET;/);
  assert.match(src, /const wallAbove = dy > 0 && center\[1\] - dy > standCeil;/);
});
