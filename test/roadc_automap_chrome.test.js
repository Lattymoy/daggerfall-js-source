// ROAD-C c2/S4: the shared native chrome and the pointer/hold seam.
//
// Two things are pinned here that nothing else can pin. First, every
// rect as a VALUE against the C# literal - both DFU windows lay out
// the identical nine buttons and the port must not drift by a pixel.
// Second, THE ROUTES: this project's dominant defect is a correct law
// whose caller does not deliver it, and a host that routes pointer
// `down` but not `up` latches an automap drag that spins the map
// forever with nothing to error on. So the source pins COUNT the
// routes per host instead of trusting four edits.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHROME_RECTS, HOVER_LABEL, CAPTION_STRIP, CAPTION_SWATCHES,
  DUNGEON_ACTIONS, EXTERIOR_ACTIONS, RIGHT_DOWN_GUARD,
  HOLD_BUTTONS, CLICK_BUTTONS, TOOL_TIP_DELAY, DOUBLE_CLICK_TIME,
  AutomapChrome, hitChrome, hitChromeAt, compassHeading01,
} from '../src/ui/automapChrome.js';
import { nativeMetrics } from '../src/ui/nativePanel.js';
import { SCROLL_FORWARD_BACKWARD_SPEED } from '../src/ui/automapCamera.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');

test('c2/S4 every rect as a VALUE - the two DFU windows lay out the identical panel', () => {
  assert.deepEqual({ ...CHROME_RECTS.panel }, { x: 1, y: 1, w: 318, h: 169 });
  assert.deepEqual({ ...CHROME_RECTS.microMap }, { x: 0, y: 52, w: 28, h: 28 });
  assert.deepEqual({ ...CHROME_RECTS.compass }, { x: 3, y: 172, w: 76, h: 17 });
  assert.deepEqual({ ...CHROME_RECTS.grid }, { x: 78, y: 171, w: 27, h: 19 });
  assert.deepEqual({ ...CHROME_RECTS.exit }, { x: 281, y: 171, w: 28, h: 19 });
  // EIGHT 21x19 buttons at y=171, at exactly these x's
  const xs = [105, 126, 149, 170, 193, 214, 237, 258];
  HOLD_BUTTONS.forEach((name, i) => {
    assert.deepEqual({ ...CHROME_RECTS[name] }, { x: xs[i], y: 171, w: 21, h: 19 }, name);
  });
  assert.equal(HOLD_BUTTONS.length, 8);
  assert.deepEqual([...CLICK_BUTTONS], ['grid', 'exit', 'compass']);
  assert.deepEqual({ ...HOVER_LABEL }, { y: 192, maxWidth: 320, maxCharacters: 64, centered: true });
  assert.deepEqual({ ...CAPTION_STRIP }, { x: 0, y: 190, w: 320, h: 10 });
  assert.deepEqual({ ...CAPTION_SWATCHES.temple }, { x: 97, y: 2, w: 5, h: 5 }, 'STRIP-LOCAL, not screen coords');
  assert.deepEqual({ ...CAPTION_SWATCHES.shop }, { x: 141, y: 2, w: 5, h: 5 });
  assert.deepEqual({ ...CAPTION_SWATCHES.tavern }, { x: 183, y: 2, w: 5, h: 5 });
  assert.equal(TOOL_TIP_DELAY, 1, 'toolTipDelay (:22)');
});

test('c2/S4 hit testing at three integer scales, INCLUDING the one-pixel gaps between buttons', () => {
  // the gaps are real: 191..192 between right and rotateLeft, 235..236
  // between rotateRight and upstairs, 279..280 before exit
  assert.equal(hitChrome(190, 175), 'right');
  assert.equal(hitChrome(191, 175), null, 'the gap at 191 is not a button');
  assert.equal(hitChrome(192, 175), null);
  assert.equal(hitChrome(193, 175), 'rotateLeft');
  assert.equal(hitChrome(235, 175), null, 'and the gap at 235');
  assert.equal(hitChrome(236, 175), null);
  assert.equal(hitChrome(237, 175), 'upstairs');
  assert.equal(hitChrome(279, 175), null);
  assert.equal(hitChrome(281, 175), 'exit');
  assert.equal(hitChrome(105, 171), 'forward', 'the top-left corner is inside');
  assert.equal(hitChrome(126, 190), null, 'and the bottom edge is exclusive');
  assert.equal(hitChrome(160, 80), 'panel');
  assert.equal(hitChrome(10, 60), 'microMap', 'the micro-map overlay wins over the panel it sits on');
  assert.equal(hitChrome(40, 175), 'compass');
  assert.equal(hitChrome(-1, -1), null);
  assert.equal(hitChrome(null, null), null);

  for (const [w, h, s] of [[320, 200, 1], [640, 400, 2], [960, 600, 3]]) {
    const m = nativeMetrics({ width: w, height: h });
    assert.equal(m.s, s);
    const at = (nx, ny) => hitChromeAt(m, m.ox + nx * s + 0.5, m.oy + ny * s + 0.5);
    assert.equal(at(105, 175), 'forward', `scale ${s}`);
    assert.equal(at(191, 175), null, `the gap survives scale ${s}`);
    assert.equal(at(281, 175), 'exit', `scale ${s}`);
    assert.equal(at(160, 80), 'panel', `scale ${s}`);
  }
});

test('c2/S4 BOTH action tables, entry by entry - the same rect, two different verbs', () => {
  // the arrows: dungeon moves the pivot on the right button, the
  // exterior JUMPS to a location border
  assert.deepEqual({ ...DUNGEON_ACTIONS.forward }, { leftHold: 'ActionMoveForward', rightHold: 'ActionMoveRotationPivotAxisForward' });
  assert.deepEqual({ ...EXTERIOR_ACTIONS.forward }, { leftHold: 'ActionMoveForward', rightHold: 'ActionMoveToNorthLocationBorder' });
  assert.deepEqual({ ...DUNGEON_ACTIONS.backward }, { leftHold: 'ActionMoveBackward', rightHold: 'ActionMoveRotationPivotAxisBackward' });
  assert.deepEqual({ ...EXTERIOR_ACTIONS.backward }, { leftHold: 'ActionMoveBackward', rightHold: 'ActionMoveToSouthLocationBorder' });
  assert.deepEqual({ ...DUNGEON_ACTIONS.left }, { leftHold: 'ActionMoveLeft', rightHold: 'ActionMoveRotationPivotAxisLeft' });
  assert.deepEqual({ ...EXTERIOR_ACTIONS.left }, { leftHold: 'ActionMoveLeft', rightHold: 'ActionMoveToWestLocationBorder' });
  assert.deepEqual({ ...DUNGEON_ACTIONS.right }, { leftHold: 'ActionMoveRight', rightHold: 'ActionMoveRotationPivotAxisRight' });
  assert.deepEqual({ ...EXTERIOR_ACTIONS.right }, { leftHold: 'ActionMoveRight', rightHold: 'ActionMoveToEastLocationBorder' });
  // the rotates: about the camera itself vs about the player marker
  assert.deepEqual({ ...DUNGEON_ACTIONS.rotateLeft }, { leftHold: 'ActionRotateLeft', rightHold: 'ActionRotateCameraLeft' });
  assert.deepEqual({ ...EXTERIOR_ACTIONS.rotateLeft }, { leftHold: 'ActionRotateLeft', rightHold: 'ActionRotateAroundPlayerPosLeft' });
  assert.deepEqual({ ...DUNGEON_ACTIONS.rotateRight }, { leftHold: 'ActionRotateRight', rightHold: 'ActionRotateCameraRight' });
  assert.deepEqual({ ...EXTERIOR_ACTIONS.rotateRight }, { leftHold: 'ActionRotateRight', rightHold: 'ActionRotateAroundPlayerPosRight' });
  // the stairs: slice vs zoom
  assert.deepEqual({ ...DUNGEON_ACTIONS.upstairs }, { leftHold: 'ActionMoveUpstairs', rightHold: 'ActionIncreaseSliceLevel' });
  assert.deepEqual({ ...EXTERIOR_ACTIONS.upstairs }, { leftHold: 'ActionMoveUpstairs', rightHold: 'ActionApplyMaxZoom' });
  assert.deepEqual({ ...DUNGEON_ACTIONS.downstairs }, { leftHold: 'ActionMoveDownstairs', rightHold: 'ActionDecreaseSliceLevel' });
  assert.deepEqual({ ...EXTERIOR_ACTIONS.downstairs }, { leftHold: 'ActionMoveDownstairs', rightHold: 'ActionApplyMinZoom' });
  // the grid: only the DUNGEON one answers the wheel (the exterior
  // window registers no scroll handler on it at all)
  assert.equal(DUNGEON_ACTIONS.grid.leftClick, 'ActionChangeAutomapGridMode');
  assert.equal(DUNGEON_ACTIONS.grid.rightClick, 'ActionResetRotationPivotAxis');
  assert.equal(DUNGEON_ACTIONS.grid.wheelUp, 'ActionIncreaseCameraFieldOfView');
  assert.equal(DUNGEON_ACTIONS.grid.wheelDown, 'ActionDecreaseCameraFieldOfView');
  assert.equal(EXTERIOR_ACTIONS.grid.leftClick, 'ActionSwitchToNextExteriorAutomapViewMode');
  assert.equal(EXTERIOR_ACTIONS.grid.rightClick, 'ActionClickSoundOnly', 'the right click plays the sound and does NOTHING else (:1375-1381)');
  assert.equal(EXTERIOR_ACTIONS.grid.wheelUp, undefined);
  // the compass
  assert.deepEqual({ ...DUNGEON_ACTIONS.compass }, { leftClick: 'ActionSwitchFocusToNextBeaconObject', rightClick: 'ActionResetView' });
  assert.deepEqual({ ...EXTERIOR_ACTIONS.compass }, { leftClick: 'ActionFocusPlayerPosition', rightClick: 'ActionResetView' });
  assert.equal(DUNGEON_ACTIONS.exit.leftClick, 'ActionExit');
  assert.equal(EXTERIOR_ACTIONS.exit.leftClick, 'ActionExit');
  // and the two tables cover exactly the same rects
  assert.deepEqual(Object.keys(DUNGEON_ACTIONS).sort(), Object.keys(EXTERIOR_ACTIONS).sort());
});

test('c2/S4 the held-repeat integrator: 1.0s of held forward is exactly one second of the per-second speed', () => {
  const c = new AutomapChrome(DUNGEON_ACTIONS);
  const fwd = CHROME_RECTS.forward;
  c.pointer('down', fwd.x + 2, fwd.y + 2, 0);
  let travelled = 0;
  for (let i = 0; i < 60; i++) {
    const { verbs } = c.tick(1 / 60);
    assert.deepEqual(verbs, ['ActionMoveForward'], 'the verb fires EVERY frame while held (Update polls the flag)');
    travelled += SCROLL_FORWARD_BACKWARD_SPEED * (1 / 60);
  }
  assert.ok(Math.abs(travelled - 50) < 1e-9, 'one second of held forward is 50 units');
  c.pointer('up', fwd.x + 2, fwd.y + 2, 0);
  assert.deepEqual(c.tick(1 / 60).verbs, [], 'and the release really stops it');

  // one CLICK is one frame's worth, not a fixed step - the A1 stand-in
  // was a fixed step per press and this is what replaced it
  const c2 = new AutomapChrome(DUNGEON_ACTIONS);
  c2.pointer('down', fwd.x + 2, fwd.y + 2, 0);
  const one = c2.tick(1 / 60).verbs;
  c2.pointer('up', fwd.x + 2, fwd.y + 2, 0);
  assert.deepEqual(one, ['ActionMoveForward']);
  assert.deepEqual(c2.tick(1 / 60).verbs, []);

  // the right button on the same rect runs the OTHER verb
  const c3 = new AutomapChrome(DUNGEON_ACTIONS);
  c3.pointer('down', fwd.x + 2, fwd.y + 2, 2);
  assert.deepEqual(c3.tick(1 / 60).verbs, ['ActionMoveRotationPivotAxisForward']);
  // ...and the exterior table's other verb, from the identical gesture
  const c4 = new AutomapChrome(EXTERIOR_ACTIONS);
  c4.pointer('down', fwd.x + 2, fwd.y + 2, 2);
  assert.deepEqual(c4.tick(1 / 60).verbs, ['ActionMoveToNorthLocationBorder']);
});

test('c2/S4 the guards: a live panel drag swallows a button press, and alreadyIn blocks a second hold', () => {
  const c = new AutomapChrome(DUNGEON_ACTIONS);
  // start a drag on the render panel
  c.pointer('down', 160, 80, 0);
  assert.equal(c.inDragMode(), true);
  // now every button handler's first line refuses. The presses below
  // use the RIGHT button so they do not also end the left drag - a
  // release of a side always ends that side's panel drag (see the
  // recorded departure in automapChrome.js).
  assert.deepEqual(c.pointer('down', CHROME_RECTS.grid.x + 2, 175, 2).verbs, []);
  assert.deepEqual(c.pointer('up', CHROME_RECTS.grid.x + 2, 175, 2).verbs, [], 'the grid click is swallowed while dragging');
  assert.deepEqual(c.pointer('down', CHROME_RECTS.forward.x + 2, 175, 2).verbs, []);
  assert.deepEqual(c.tick(1 / 60).verbs, [], 'and so is a hold');
  c.pointer('up', 160, 80, 0);
  assert.equal(c.inDragMode(), false, 'the release ends the drag');
  // with the drag over, the same presses take
  c.pointer('down', CHROME_RECTS.forward.x + 2, 175, 0);
  assert.deepEqual(c.tick(1 / 60).verbs, ['ActionMoveForward'], 'and they work once it is over');
  c.pointer('up', CHROME_RECTS.forward.x + 2, 175, 0);

  // alreadyInMouseDown: a second LEFT hold cannot take while one holds
  const d = new AutomapChrome(DUNGEON_ACTIONS);
  d.pointer('down', CHROME_RECTS.forward.x + 2, 175, 0);
  d.pointer('down', CHROME_RECTS.left.x + 2, 175, 0);
  assert.deepEqual(d.tick(1 / 60).verbs, ['ActionMoveForward'], 'only the first hold took');
  // but a RIGHT hold on an arrow takes, because it checks its own flag
  d.pointer('down', CHROME_RECTS.backward.x + 2, 175, 2);
  assert.deepEqual(d.tick(1 / 60).verbs, ['ActionMoveForward', 'ActionMoveRotationPivotAxisBackward']);
});

test('c2/S4 THE DFU QUIRK: the rotate buttons\' RIGHT-down checks the LEFT already-in flag', () => {
  // DaggerfallAutomapWindow.cs:2188 and :2228 (and the exterior's
  // :1565, :1605) check `alreadyInMouseDown` where every other right
  // handler checks `alreadyInRightMouseDown`. Present in BOTH windows,
  // and it has real consequences. Ported verbatim.
  assert.deepEqual({ ...RIGHT_DOWN_GUARD }, {
    forward: 'right', backward: 'right', left: 'right', right: 'right',
    rotateLeft: 'left', rotateRight: 'left',
    upstairs: 'right', downstairs: 'right',
  });
  const c = new AutomapChrome(DUNGEON_ACTIONS);
  // a LEFT hold on any button now blocks a RIGHT hold on rotate-left
  c.pointer('down', CHROME_RECTS.forward.x + 2, 175, 0);
  c.pointer('down', CHROME_RECTS.rotateLeft.x + 2, 175, 2);
  assert.deepEqual(c.tick(1 / 60).verbs, ['ActionMoveForward'], 'the right-hold on rotate was refused by the LEFT flag');
  // and the reverse: a right-hold on rotate takes the LEFT flag
  const d = new AutomapChrome(DUNGEON_ACTIONS);
  d.pointer('down', CHROME_RECTS.rotateRight.x + 2, 175, 2);
  d.pointer('down', CHROME_RECTS.forward.x + 2, 175, 0);
  assert.deepEqual(d.tick(1 / 60).verbs, ['ActionRotateCameraRight'], 'a left hold cannot take after it');
  // the same quirk in the exterior table, from the same module
  const e = new AutomapChrome(EXTERIOR_ACTIONS);
  e.pointer('down', CHROME_RECTS.forward.x + 2, 175, 0);
  e.pointer('down', CHROME_RECTS.rotateLeft.x + 2, 175, 2);
  assert.deepEqual(e.tick(1 / 60).verbs, ['ActionMoveForward']);
});

test('c2/S4 click buttons fire on RELEASE over the same rect, both buttons, both tables', () => {
  const c = new AutomapChrome(DUNGEON_ACTIONS);
  const g = CHROME_RECTS.grid;
  assert.deepEqual(c.pointer('down', g.x + 2, g.y + 2, 0).verbs, [], 'nothing on the press');
  const up = c.pointer('up', g.x + 2, g.y + 2, 0);
  assert.deepEqual(up.verbs, ['ActionChangeAutomapGridMode']);
  assert.equal(up.sound, true, 'PlayOneShot(SoundClips.ButtonClick)');
  // a release somewhere else fires NOTHING (Unity's OnMouseClick)
  c.pointer('down', g.x + 2, g.y + 2, 0);
  assert.deepEqual(c.pointer('up', 160, 80, 0).verbs, [], 'released off the button');
  // the right click is the other verb
  c.pointer('down', g.x + 2, g.y + 2, 2);
  assert.deepEqual(c.pointer('up', g.x + 2, g.y + 2, 2).verbs, ['ActionResetRotationPivotAxis']);
  // the compass, both tables
  const comp = CHROME_RECTS.compass;
  c.pointer('down', comp.x + 2, comp.y + 2, 0);
  assert.deepEqual(c.pointer('up', comp.x + 2, comp.y + 2, 0).verbs, ['ActionSwitchFocusToNextBeaconObject']);
  const e = new AutomapChrome(EXTERIOR_ACTIONS);
  e.pointer('down', comp.x + 2, comp.y + 2, 0);
  assert.deepEqual(e.pointer('up', comp.x + 2, comp.y + 2, 0).verbs, ['ActionFocusPlayerPosition']);
  e.pointer('down', comp.x + 2, comp.y + 2, 2);
  assert.deepEqual(e.pointer('up', comp.x + 2, comp.y + 2, 2).verbs, ['ActionResetView']);
});

test('c2/S4 the drags on the render panel, the middle button included, and a double click', () => {
  const c = new AutomapChrome(DUNGEON_ACTIONS);
  c.pointer('down', 100, 80, 0);
  const m = c.pointer('move', 110, 90, 0);
  assert.deepEqual(m.drag, { kind: 'pan', dx: 10, dy: 10 }, 'the LEFT drag pans');
  const m2 = c.pointer('move', 105, 90, 0);
  assert.deepEqual(m2.drag, { kind: 'pan', dx: -5, dy: 0 }, 'deltas are per-move, not cumulative');
  c.pointer('up', 105, 90, 0);
  assert.equal(c.pointer('move', 200, 100, 0).drag, null, 'no drag after the release');

  const r = new AutomapChrome(DUNGEON_ACTIONS);
  r.pointer('down', 100, 80, 2);
  assert.deepEqual(r.pointer('move', 120, 80, 2).drag, { kind: 'rotate', dx: 20, dy: 0 }, 'the RIGHT drag rotates');
  const mid = new AutomapChrome(DUNGEON_ACTIONS);
  mid.pointer('down', 100, 80, 1);
  assert.deepEqual(mid.pointer('move', 100, 90, 1).drag, { kind: 'slice', dx: 0, dy: 10 }, 'the MIDDLE drag slices');

  // double click on the panel
  const d = new AutomapChrome(DUNGEON_ACTIONS);
  assert.equal(d.pointer('down', 100, 80, 0).doubleClick, false);
  d.pointer('up', 100, 80, 0);
  d.tick(0.1);
  assert.equal(d.pointer('down', 100, 80, 0).doubleClick, true, 'within the double-click window and slop');
  d.pointer('up', 100, 80, 0);
  d.tick(DOUBLE_CLICK_TIME + 0.1);
  assert.equal(d.pointer('down', 100, 80, 0).doubleClick, false, 'and not after it');
});

test('c2/S4 tooltips: ToolTipDelay 1s of hover, and SuppressToolTip while the button is held', () => {
  const c = new AutomapChrome(DUNGEON_ACTIONS);
  const g = CHROME_RECTS.grid;
  c.pointer('move', g.x + 2, g.y + 2, 0);
  assert.equal(c.tick(0.5).tooltip, null, 'not yet');
  assert.equal(c.tick(0.6).tooltip, 'grid', 'after ToolTipDelay seconds');
  // moving to another rect restarts the delay
  c.pointer('move', CHROME_RECTS.exit.x + 2, 175, 0);
  assert.equal(c.tick(0.5).tooltip, null);
  assert.equal(c.tick(0.6).tooltip, 'exit');
  // and holding a button suppresses ITS tooltip for as long as it is held
  const h = new AutomapChrome(DUNGEON_ACTIONS);
  const f = CHROME_RECTS.forward;
  h.pointer('move', f.x + 2, f.y + 2, 0);
  h.pointer('down', f.x + 2, f.y + 2, 0);
  assert.equal(h.tick(5).tooltip, null, 'SuppressToolTip = true while held');
  h.pointer('up', f.x + 2, f.y + 2, 0);
  assert.equal(h.tick(1.1).tooltip, 'forward', 'and it comes back after the release');
  // hovering nothing shows nothing
  h.pointer('move', -1, -1, 0);
  assert.equal(h.tick(5).tooltip, null);
});

test('c2/S4 releaseAll clears every latch, and the compass reads the MAP camera yaw', () => {
  const c = new AutomapChrome(DUNGEON_ACTIONS);
  c.pointer('down', 100, 80, 0);
  c.pointer('down', CHROME_RECTS.forward.x + 2, 175, 2);
  assert.equal(c.inDragMode(), true);
  c.releaseAll();
  assert.equal(c.inDragMode(), false);
  assert.deepEqual(c.tick(1 / 60).verbs, [], 'no hold survives a releaseAll');
  assert.equal(c.alreadyIn.left, false);
  assert.equal(c.alreadyIn.right, false);

  // the compass strip is registered to the AUTOMAP camera, not the
  // player - the map's own yaw drives it
  assert.equal(compassHeading01(0), 0);
  assert.equal(compassHeading01(90), 0.25);
  assert.equal(compassHeading01(-90), 0.75, 'a negative yaw wraps');
  assert.equal(compassHeading01(450), 0.25);

  // the wheel: only the dungeon grid answers one
  const w = new AutomapChrome(DUNGEON_ACTIONS);
  assert.equal(w.wheel(CHROME_RECTS.grid.x + 2, 175, -1), 'ActionIncreaseCameraFieldOfView');
  assert.equal(w.wheel(CHROME_RECTS.grid.x + 2, 175, +1), 'ActionDecreaseCameraFieldOfView');
  assert.equal(w.wheel(160, 80, -1), null, 'the panel has no wheel verb in the table');
  const we = new AutomapChrome(EXTERIOR_ACTIONS);
  assert.equal(we.wheel(CHROME_RECTS.grid.x + 2, 175, -1), null, 'the exterior grid registers no scroll handler');
  // and a live drag swallows the wheel too (every handler's first line)
  w.pointer('down', 160, 80, 0);
  assert.equal(w.wheel(CHROME_RECTS.grid.x + 2, 175, -1), null);
});

test('c2/S4 SOURCE PINS: ALL FOUR HOSTS route down, move AND up - a missing up latches the drag forever', () => {
  const ctx = src('src/scenes/dungeonContext.js');
  assert.match(ctx, /overlayPointer\(phase, vx, vy, button = 0\)/, 'the seam exists beside click/hover/wheel');
  assert.match(ctx, /activeOverlay\?\.pointer\?\.\(phase, vx, vy, button\)/);
  for (const seam of ['overlayClick(', 'overlayHover(', 'overlayWheel(', 'overlayPointer(']) {
    assert.ok(ctx.includes(seam), `${seam} is on the context`);
  }

  // HOST 1: dungeon.js - its own listeners
  const dj = src('src/scenes/dungeon.js');
  for (const phase of ['down', 'move', 'up']) {
    assert.ok(new RegExp(`overlayPointer\\?\\.\\('${phase}'`).test(dj), `dungeon.js routes '${phase}'`);
  }
  assert.match(dj, /addEventListener\('pointerup'/, 'dungeon.js listens for the release');

  // HOST 2: worldModes.js - the dungeon/interior mode machine
  const wm = src('src/scenes/worldModes.js');
  for (const phase of ['down', 'move', 'up']) {
    assert.ok(new RegExp(`overlayPointer\\?\\.\\('${phase}'`).test(wm), `worldModes routes '${phase}'`);
  }
  assert.match(wm, /\n    pointermove,/, 'and exports the move route for its outer hosts');
  assert.match(wm, /\n    pointerup,/, 'and the up route');

  // HOSTS 3 and 4: world.js and exterior.js own the DOM listeners for
  // worldModes, so they must deliver all three phases into it
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const body = src(f);
    assert.match(body, /modes\?\.pointerdown\?\.\(e\)/, `${f} routes down`);
    assert.match(body, /addEventListener\('pointermove', \(e\) => \{ modes\?\.pointermove\?\.\(e\); \}\)/, `${f} routes move`);
    // c2/S10 hung townTalk's own release on the SAME listener (its slot
    // holds the town map, whose chrome is this same machine), so the
    // pin reads the listener's BODY rather than its exact spelling -
    // what matters is that a release reaches the mode machine.
    const up = body.match(/addEventListener\('pointerup', \(e\) => \{([^}]*)\}\)/);
    assert.ok(up && /modes\?\.pointerup\?\.\(e\)/.test(up[1]), `${f} routes up`);
    assert.ok(/townTalk\.pointer\('up', e\)/.test(up[1]),
      `${f} routes up into townTalk's slot too - the town map drags there`);
  }

  // THE COUNT, not the spelling: three phases in each of the four hosts
  const hosts = ['src/scenes/dungeon.js', 'src/scenes/worldModes.js', 'src/scenes/world.js', 'src/scenes/exterior.js'];
  for (const f of hosts) {
    const body = src(f);
    const routes = (body.match(/overlayPointer\?\.\(|pointermove\?\.\(e\)|pointerup\?\.\(e\)|pointerdown\?\.\(e\)/g) ?? []).length;
    assert.ok(routes >= 3, `${f} carries at least three pointer routes (found ${routes})`);
  }

  // POINTER LOCK: an open overlay must never grab the pointer behind
  // itself, in the hosts that hold the lock - the drag has to work with
  // the lock released while an overlay holds the slot.
  assert.match(dj, /a window is up: never grab the pointer behind it/);
  assert.match(wm, /an open window withholds the pointer lock, as in dungeon\.js/);

  // and the chrome module really is ONE module with TWO TABLES
  const chrome = src('src/ui/automapChrome.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');   // comments describe the rule; the CODE must obey it
  assert.equal(/if \(.*exterior/i.test(chrome), false, 'no if(exterior) ladder inside the module');
  assert.equal(/isExterior|isDungeon/.test(chrome), false, 'and no per-window flag either - the table IS the difference');
  assert.ok(chrome.includes('DUNGEON_ACTIONS') && chrome.includes('EXTERIOR_ACTIONS'), 'two tables, one machine');
});
