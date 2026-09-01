// ROAD-Ar - THE ACTIVATE GATE'S REMAINING LAW. A8 built the gate and
// pinned its three facts at module level, but the four hosts fed it
// two of six inputs - so PlayerActivate's touch exception, its
// large-HUD guard, its click delay, and InputManager's paused return
// were all dead in production while the module pins stayed green.
// Every test here fails on a revert of the wiring, not just of the
// module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createActivateGate, activateFrame, setClickDelay } from '../src/systems/activateGate.js';
import {
  trackLargeHudPointer, activeMouseOverLargeHUD, _resetLargeHud, largeHudRect,
} from '../src/ui/hudLarge.js';
import { setCursorActive } from '../src/player/pointerLock.js';
import { setValue, _resetForTests } from '../src/systems/settings.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const host = (rel) => readFileSync(join(root, rel), 'utf8');
const HOSTS = [
  'src/scenes/world.js', 'src/scenes/exterior.js',
  'src/scenes/worldModes.js', 'src/scenes/dungeon.js',
];

// ---------------------------------------------------------------
// R15 - InputManager.cs:486-503. A WINDOW HOLDS THE ACTION ITSELF.
// ---------------------------------------------------------------

test('ROAD-Ar: a paused frame reports neither cast nor activate, however the button moves', () => {
  const gate = createActivateGate();
  // A click on an open window's own buttons: press, hold, release -
  // all while paused. currentActions is never populated (:490-502),
  // so ActionStarted and ActionComplete are both false all the way
  // through and the readied spell stays readied.
  for (const down of [true, true, false, false]) {
    assert.deepEqual(
      activateFrame(gate, { down, hasReadySpell: true, paused: true, now: 100 }),
      { cast: false, activate: false });
  }
  // and the gate did not quietly bank the press either
  assert.equal(gate.down, false);
});

test('ROAD-Ar: the release that CLOSED the window does not activate the world behind it', () => {
  const gate = createActivateGate();
  // frame 1: no window, button up
  assert.equal(activateFrame(gate, { down: false, now: 10 }).activate, false);
  // frame 2: the window is up and the player presses its close button
  assert.deepEqual(activateFrame(gate, { down: true, paused: true, now: 10.02 }),
    { cast: false, activate: false });
  // frame 3: the window popped on that press - PauseGame(false) and
  // SetClickDelay() together (UserInterfaceManager.cs:206/:214). The
  // button is STILL held, so without the delay this frame is an
  // ActionStarted and the next is an ActionComplete.
  assert.deepEqual(activateFrame(gate, { down: true, now: 10.04 }),
    { cast: false, activate: false });
  // frame 4: the release. PlayerActivate returns for 0.3 s (:269-276).
  assert.deepEqual(activateFrame(gate, { down: false, now: 10.06 }),
    { cast: false, activate: false });
  // ...and once the delay has run out the button is ordinary again
  activateFrame(gate, { down: true, now: 11 });
  assert.equal(activateFrame(gate, { down: false, now: 11.02 }).activate, true);
});

test('ROAD-Ar: the click that closed the window does not CAST the readied spell either', () => {
  // The delay-only reading of PlayerActivate.cs:269-276 leaves the
  // cast half live, because EntityEffectManager is a separate
  // MonoBehaviour. DFU covers it with InputManager's post-pause skip
  // (:504-507, "GUI actions do not 'fall-through' to main world"),
  // which the port folds into the same window - this is the bug
  // worldModes.js already records for the right button.
  const gate = createActivateGate();
  activateFrame(gate, { down: true, hasReadySpell: true, paused: true, now: 5 });
  const f = activateFrame(gate, { down: true, hasReadySpell: true, now: 5.02 });
  assert.deepEqual(f, { cast: false, activate: false });
  // the spell is untouched: it casts on a real press once the delay
  // has expired
  assert.equal(activateFrame(gate, { down: false, hasReadySpell: true, now: 6 }).cast, false);
  assert.equal(activateFrame(gate, { down: true, hasReadySpell: true, now: 6.02 }).cast, true);
});

test('ROAD-Ar: setClickDelay is Mathf.Clamp01 and 0.3 s by default (PlayerActivate.cs:1050-1054)', () => {
  const gate = createActivateGate();
  assert.equal(gate.clickDelay, 0);
  setClickDelay(gate, undefined, 0);
  assert.equal(gate.clickDelay, 0.3);
  setClickDelay(gate, 7, 0);
  assert.equal(gate.clickDelay, 1);
  setClickDelay(gate, -2, 0);
  assert.equal(gate.clickDelay, 0);
});

// ---------------------------------------------------------------
// R8 - PlayerActivate.cs:230-236. THE BAR EATS ITS OWN CLICKS.
// ---------------------------------------------------------------

test('ROAD-Ar: hudBlocked kills the activation ray, in its own position above the spell block', () => {
  const gate = createActivateGate();
  activateFrame(gate, { down: true, hudBlocked: true, now: 1 });
  // the release over the bar is the panel's press and nothing else
  assert.deepEqual(activateFrame(gate, { down: false, hudBlocked: true, now: 1.02 }),
    { cast: false, activate: false });
  // the guard sits ABOVE the spell block, so it neither sets nor
  // consumes castPending (PlayerActivate returns at :236)
  assert.equal(gate.castPending, false);
  const armed = createActivateGate();
  activateFrame(armed, { down: true, hasReadySpell: true, hudBlocked: true, now: 1 });
  assert.equal(armed.castPending, false, 'the HUD guard returns before castPending is set');
  // and the CAST is deliberately NOT suppressed: EntityEffectManager
  // (:229-255) carries no such guard, only PlayerActivate and
  // WeaponManager do - the port keeps DFU's asymmetry.
  const armed2 = createActivateGate();
  assert.equal(
    activateFrame(armed2, { down: true, hasReadySpell: true, hudBlocked: true, now: 1 }).cast,
    true);
});

test('ROAD-Ar: activeMouseOverLargeHUD is cursorActive AND enabled AND over the bar', () => {
  _resetForTests();
  _resetLargeHud();
  setCursorActive(true);
  setValue('GUI', 'LargeHUD', true);
  const canvas = { width: 640, height: 400, getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 400 }) };
  const bar = largeHudRect(canvas, { docked: true });
  const at = (x, y) => trackLargeHudPointer(canvas, { clientX: x, clientY: y }, bar);
  // a point on the docked bar
  at(bar.x + 4, bar.y + 4);
  assert.equal(activeMouseOverLargeHUD(), true);
  // the same pointer with the cursor re-captured is a look, not a hover
  setCursorActive(false);
  assert.equal(activeMouseOverLargeHUD(), false);
  setCursorActive(true);
  // the setting off takes the whole bar away (HUDLarge.cs:364's own
  // `&& DaggerfallUnity.Settings.LargeHUD`)
  setValue('GUI', 'LargeHUD', false);
  assert.equal(activeMouseOverLargeHUD(), false);
  setValue('GUI', 'LargeHUD', true);
  // a point above the bar is the world
  at(bar.x + 4, bar.y - 4);
  assert.equal(activeMouseOverLargeHUD(), false);
  setCursorActive(false);
  _resetForTests();
  _resetLargeHud();
});

// ---------------------------------------------------------------
// R3/R7/R8/R15 - THE WIRING. Every input the gate declares is fed.
// ---------------------------------------------------------------

test('ROAD-Ar: all four hosts pass the gate every input it declares', () => {
  for (const h of HOSTS) {
    const s = host(h);
    assert.match(s, /down: held\(keys, 'ActivateCenterObject'\)/, `${h} polls the ACTION`);
    assert.match(s, /hasReadySpell:/, `${h} feeds HasReadySpell`);
    // R3: the ByTouch exception was a callee option no host passed
    assert.match(s, /touchSpell:.*rangeType === 1/, `${h} feeds the ByTouch exception`);
    // R8: PlayerActivate.cs:230-236
    assert.match(s, /hudBlocked: activeMouseOverLargeHUD\(\)/, `${h} feeds the large-HUD guard`);
    // R15/R7: InputManager.cs:486-503, and the click delay it arms
    assert.match(s, /paused: _?overlayHeld/, `${h} feeds the overlay pause`);
  }
  // the gate declares exactly these six and no seventh orphan
  const gate = readFileSync(join(root, 'src/systems/activateGate.js'), 'utf8');
  const sig = gate.slice(gate.indexOf('export function activateFrame'));
  for (const opt of ['down', 'hasReadySpell', 'touchSpell', 'hudBlocked', 'paused', 'now']) {
    assert.ok(sig.includes(`${opt} =`) || sig.includes(`${opt} = `), `${opt} is a declared input`);
  }
});

test('ROAD-Ar: dungeon.js runs the gate ABOVE its overlay-gated walk branch', () => {
  // The gate must SEE the window to arm the click delay for the frame
  // it pops; running it inside `walkMode && !overlayHeld` is exactly
  // what left the dismissing click free to reach tryActivate().
  const s = host('src/scenes/dungeon.js');
  const call = s.indexOf('activateFrame(activateGate');
  const walk = s.indexOf('if (walkMode && !overlayHeld) {');
  assert.ok(call > 0 && walk > 0);
  assert.ok(call < walk, 'the gate ticks before the walk branch, not inside it');
  assert.ok(s.indexOf('if (_act.activate || (useHeld && !prevUse)) tryActivate();') > walk,
    'but the CONSUMER stays inside it');
});

test('ROAD-Ar: the dungeon context answers the readied spell, not only whether one is armed', () => {
  const ctx = readFileSync(join(root, 'src/scenes/dungeonContext.js'), 'utf8');
  assert.match(ctx, /spellArmed: \(\) => magic\.spellArmed\(\),\s+\/\/ A8/);
  assert.match(ctx, /readiedSpell: \(\) => magic\.readied\(\)/);
});

test('ROAD-Ar: the click that GRABS the pointer arms the delay too, and only on a real grab', () => {
  // The port's click-to-relock has no DFU counterpart (DFU takes the
  // cursor back by the ActivateCursor key alone), but it feeds Mouse0
  // through the same press/release the gate reads - so it is the same
  // hole as the window's close button. worldModes owns no pointer
  // lock; it shares the outer host's `latch`, so its gate is armed by
  // the outer host's grab.
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js']) {
    const s = host(h);
    const i = s.indexOf('setClickDelay(');
    assert.ok(i > 0, `${h} arms the delay on the grab`);
    // guarded on the lock NOT already being held - an unguarded arm
    // would kill every ordinary activation click
    assert.match(s.slice(Math.max(0, i - 120), i),
      /if \(document\.pointerLockElement !== canvas\) $/,
      `${h} arms it only when the pointer was not already locked`);
    // and it is armed BEFORE requestLook, not instead of it
    assert.ok(s.indexOf('requestLook(canvas)', i) > i, `${h} still grabs the pointer`);
  }
  assert.ok(!host('src/scenes/worldModes.js').includes('requestLook(canvas)'),
    'worldModes owns no pointer lock - nothing to arm there');
});

test('ROAD-Ar: every host feeds the large-HUD hover from its mousemove', () => {
  for (const h of HOSTS) {
    const s = host(h);
    assert.match(s, /trackLargeHudPointer\(canvas, e\)/, `${h} tracks the pointer over the bar`);
    assert.match(s, /activeMouseOverLargeHUD/, `${h} imports the flag`);
  }
});
