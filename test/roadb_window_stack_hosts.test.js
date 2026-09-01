// ROAD TO 1:1, WAVE B / B1 - THE HOSTS ADOPT THE STACK.
//
// The law is next door in roadb_window_stack.test.js; this file is the
// ADOPTION: that each modal host's one overlay slot is now the TOP of a
// real stack, and that the case the whole item exists for works -
//
//   A MESSAGE BOX OVER A RUNNING REST WINDOW.
//
// DaggerfallRestWindow.TickRest returns without advancing while
// `uiManager.TopWindow != this` (:364, and again at :399 because "quest
// tick above can perfectly align with rest ending"), and resumes when
// the window on top pops. With ONE slot per host the port could not do
// that: the incoming box replaced the rest, which worldModes'
// mountInterior carried a FLAG about in so many words. The stack is
// that FLAG's answer, so the pins here are what the flag promised.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { makeWindowStack } from '../src/ui/windowStack.js';
import { RestWindow } from '../src/ui/restWindow.js';
import { createRestDeps } from '../src/scenes/shared.js';
import { createTownTalk } from '../src/scenes/townTalk.js';
import { REST_WAIT_PER_HOUR } from '../src/systems/restSession.js';
import { SKILLS } from '../src/systems/skills.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const sleeper = () => ({
  isPlayer: true, level: 1, health: 5, maxHealth: 50, magicka: 0, maxMagicka: 8,
  fatigue: 0, stats: { strength: 50, endurance: 50, willpower: 50 }, skills: 20,
  career: {}, skillUses: { [SKILLS.Medical]: 0 },
});

/** One hour of DaggerfallRestWindow.Update, driven the way every host
 *  drives it: the TOP WINDOW gets the tick and nobody else. */
const hourOnTop = (top) => { for (let i = 0; i < 12; i++) top?.tick?.(REST_WAIT_PER_HOUR / 10 + 1e-9); };

// ---------------------------------------------------------------------
// THE TWO-DEEP CASE, on the modal hosts' shape (worldModes'
// mountInterior / dungeonContext's showOverlay are the same three lines).
// ---------------------------------------------------------------------

test('B1: a message box pushed over a running rest PAUSES it, and popping RESUMES it', () => {
  const e = sleeper();
  let slot = null;
  const stack = makeWindowStack({ onTop: (w) => { slot = w; } });
  // mountInterior / dungeonContext.showOverlay, verbatim shape
  const mount = (w) => {
    if (!w) return;
    stack.reconcile(slot);
    if (stack.containsWindow(w)) return;
    stack.pushWindow(w);
  };

  mount(new RestWindow(createRestDeps(e, { advanceMinutes() {}, endLines: (id) => [`x${id}`] })));
  const rest = slot;
  rest.input('char:1'); rest.input('char:9'); rest.input('confirm');   // rest for a while, 9 hours
  assert.equal(rest.state, 'resting');
  assert.equal(stack.paused(), true, 'PauseWhileOpen defaults true - the world is stopped');

  hourOnTop(slot);
  const restedAlone = rest.session.totalHours;
  assert.ok(restedAlone >= 1, 'the rest advances while it IS the top window');

  // ...a quest popup arrives. QuestMachine.Tick runs inside the rest's
  // own sub-tick, which is exactly why DFU checks TopWindow twice.
  mount({ isQuestBox: true });
  assert.equal(slot.isQuestBox, true, 'the box is the top window');
  assert.equal(stack.containsWindow(rest), true, 'and the rest is still ON the stack');
  assert.equal(e.isResting, true, 'IsResting is untouched - DFU does not end the rest, it pauses it');

  for (let i = 0; i < 5; i++) hourOnTop(slot);   // five hours of frames on the BOX
  assert.equal(rest.session.totalHours, restedAlone,
    'not one hour passed while the rest was not the top window (TickRest :364)');

  // The box closes - the host nulls its slot, which is PopWindow.
  slot = null;
  stack.reconcile(slot);
  assert.equal(slot, rest, 'the rest window has the screen back');
  assert.equal(rest.state, 'resting', 'and it is still the SAME live rest');

  hourOnTop(slot);
  assert.ok(rest.session.totalHours > restedAlone, 'which resumes where it left off');
});

test('B1: the pause LATCHES through the two-deep case', () => {
  // AddWindow raises the pause for the pushed window (:183-184) and
  // RemoveWindow only lowers it when the stack drains (:201-215), so
  // the world never runs for a frame between a box closing and the
  // window under it coming back.
  let slot = null;
  const stack = makeWindowStack({ onTop: (w) => { slot = w; } });
  stack.pushWindow({ name: 'rest' });
  stack.pushWindow({ name: 'box' });
  assert.equal(stack.paused(), true);
  slot = null;
  stack.reconcile(slot);
  assert.equal(stack.paused(), true, 'still paused - the rest is up again');
  slot = null;
  stack.reconcile(slot);
  assert.equal(stack.paused(), false, 'and only the empty stack is gameplay');
});

// ---------------------------------------------------------------------
// townTalk - the OUTDOOR hosts' slot (world.js and exterior.js both
// draw it), where a rest taken in the street lives.
// ---------------------------------------------------------------------

const talkHost = () => createTownTalk({
  renderer: { uploadTexture: () => ({}) }, canvas: { width: 640, height: 400 },
  fetchBytes: async () => { throw new Error('this pin loads no ARENA2'); },
  playerEntity: { name: 'T', stats: { personality: 50 }, skills: 30, skillUses: [] },
  regionIndex: 0,
});

test('B1: townTalk.pushOverlay suspends the open window; showOverlay still REPLACES it', () => {
  const host = talkHost();
  const a = { name: 'a', dispose() { this.disposed = true; } };
  const b = { name: 'b' };
  const c = { name: 'c', dispose() { this.disposed = true; } };

  // The dispatch door is unchanged: this host's windows hand over to
  // one another, and DFU's own hand-over is CloseWindow-then-Push,
  // which nets to a replacement - so the outgoing window is disposed.
  host.showOverlay(a);
  host.showOverlay(c);
  assert.equal(a.disposed, true, 'showOverlay still frees what it replaces');
  assert.equal(host.overlay, c);

  // The stacking door is the new one.
  host.pushOverlay(b);
  assert.equal(host.overlay, b, 'the pushed box is on top');
  assert.equal(c.disposed, undefined, 'and the window under it was NOT disposed');
  host.closeOverlay(b);
  assert.equal(host.overlay, c, 'closing the box hands the slot back');
});

test('B1: a rest in the STREET survives a quest box - the world.js fall-through', () => {
  // world.js's showQuestBox lands in this slot whenever the player is
  // outdoors. It used to call showOverlay, which threw the rest away.
  const host = talkHost();
  const e = sleeper();
  host.showOverlay(new RestWindow(createRestDeps(e, { advanceMinutes() {}, endLines: (id) => [`x${id}`] })));
  const rest = host.overlay;
  rest.input('char:1'); rest.input('char:9'); rest.input('confirm');
  hourOnTop(host.overlay);
  const before = rest.session.totalHours;
  assert.ok(before >= 1);

  host.pushOverlay({ isQuestBox: true });
  for (let i = 0; i < 5; i++) hourOnTop(host.overlay);   // the host ticks the TOP window only
  assert.equal(rest.session.totalHours, before, 'the covered rest does not advance');
  assert.equal(e.isResting, true, 'nor is it ended behind the box');

  host.closeOverlay();
  assert.equal(host.overlay, rest, 'the rest window is back in the slot');
  hourOnTop(host.overlay);
  assert.ok(rest.session.totalHours > before, 'and running again');

  // ...and the source says so, so a future edit that reverts the door
  // fails here rather than silently losing a night's sleep.
  assert.match(src('src/scenes/world.js'), /if \(modes\?\.showQuestOverlay\?\.\(win\)\) return;[\s\S]{0,700}\n\s*townTalk\.pushOverlay\(win\);/,
    'the quest box pushes into the outdoor slot rather than replacing it');
});

test('B1: a push suspends the covered window\'s close callback with it', () => {
  // townTalk carries ONE `_onOverlayClosed` for the top window (the G2
  // arrest/court flows arm it). A push must not clobber the covered
  // window's, and a pop must not fire the wrong one.
  const host = talkHost();
  const fired = [];
  host.showOverlay({ name: 'under' }, () => fired.push('under'));
  host.pushOverlay({ name: 'over' }, () => fired.push('over'));
  host.closeOverlay();
  assert.deepEqual(fired, ['over'], 'only the window that actually closed fired');
  host.closeOverlay();
  assert.deepEqual(fired, ['over', 'under'], 'and the suspended callback came back with its window');
});

// ---------------------------------------------------------------------
// The adoption itself, in the three hosts.
// ---------------------------------------------------------------------

test('B1: each modal host builds a stack under its slot and reconciles it', () => {
  const wm = src('src/scenes/worldModes.js');
  const dc = src('src/scenes/dungeonContext.js');
  const tt = src('src/scenes/townTalk.js');

  assert.match(wm, /const interiorWindows = makeWindowStack\(\{ onTop: \(w\) => \{ interiorOverlay = w; \} \}\);/);
  assert.match(dc, /const dungeonWindows = makeWindowStack\(\{ onTop: \(w\) => \{ activeOverlay = w; \} \}\);/);
  assert.match(tt, /const windows = makeWindowStack\(\{ onTop: \(w\) => \{ overlay = w; \} \}\);/);

  // The frame seams read the slot back, or the hand-written
  // `... = null` close paths never become pops.
  assert.match(wm, /if \(mode === 'interior'\) interiorWindows\.reconcile\(interiorOverlay\);\n\s*const overlayHeld =/,
    'the interior frame reconciles BEFORE anything reads overlayHeld');
  assert.match(wm, /if \(w\.done\) \{ w\.dispose\?\.\(\); if \(interiorOverlay === w\) interiorOverlay = null; \}\n[\s\S]{0,400}interiorWindows\.reconcile\(interiorOverlay\);/,
    'and again after the done-drain, so the uncovered window is what this frame paints');
  assert.match(dc, /tickOverlay\(dt\) \{\n[\s\S]{0,400}dungeonWindows\.reconcile\(activeOverlay\);\n\s*if \(!activeOverlay\) return;/,
    'the dungeon ticks its stack up to date before the early return');

  // ...and the EVENT drains too, or a key that closes the top window
  // leaves the uncovered one out of the slot until the next frame -
  // long enough for the host's own pointer-lock grab to run under it.
  assert.match(wm, /overlayInput\(code, e\) \{[\s\S]{0,400}interiorWindows\.reconcile\(interiorOverlay\);/,
    'the interior key seam reconciles its drain');
  assert.match(wm, /if \(interiorOverlay\?\.done\) interiorOverlay = null;\n\s*interiorWindows\.reconcile\(interiorOverlay\);/,
    'so does the interior click seam');
  assert.match(dc, /overlayInput\(action, e = null\) \{[\s\S]{0,1000}dungeonWindows\.reconcile\(activeOverlay\);/,
    'and the dungeon key seam');
  assert.match(dc, /overlayClick\(vx, vy, right = false\) \{[\s\S]{0,1000}dungeonWindows\.reconcile\(activeOverlay\);/,
    'and the dungeon click seam');
  // The getters those handlers feed answer the DEPTH, not just the slot.
  assert.match(wm, /get overlayHeld\(\) \{ return \(mode === 'interior' && \(!!interiorOverlay \|\| interiorWindows\.depth\(\) > 0\)\)/);
  assert.match(dc, /get uiOverlayActive\(\) \{ return !!activeOverlay \|\| dungeonWindows\.depth\(\) > 0; \}/);

  // A teardown drops the WHOLE stack, disposing each window - OnPop
  // (UserInterfaceManager.cs:189-196), which is where RestWindow
  // clears IsResting.
  for (const [name, text] of [['worldModes', wm], ['dungeonContext', dc]]) {
    assert.ok(/\.clear\(\(w\) => w\.dispose\?\.\(\)\);/.test(text), `${name} drains its stack on teardown`);
  }
});

test('B1: the mountInterior FLAG is retired, not merely reworded', () => {
  // It read: "FLAGGED: pause-and-resume is the DFU behaviour and a
  // single-slot host cannot have it; ending cleanly is the honest
  // approximation, not a claim to have ported it." The single slot is
  // gone, so the flag goes with it - and the door is a PushWindow.
  const wm = src('src/scenes/worldModes.js');
  assert.equal(/single-slot host cannot have it/.test(wm), false,
    'the FLAG text must not survive the thing it flagged');
  assert.equal(/A single overlay slot cannot\s+\*?\s*stack/.test(wm), false);
  assert.match(wm, /const mountInterior = \(w\) => \{\n\s+if \(!w\) return;\n\s+interiorWindows\.reconcile\(interiorOverlay\);[^\n]*\n\s+if \(interiorWindows\.containsWindow\(w\)\) return;[^\n]*\n\s+interiorWindows\.pushWindow\(w\);\n\s*\};/,
    'mountInterior is PushWindow');
  // ...and nothing is disposed on the way IN any more: the window it
  // covers is coming back.
  assert.equal(/if \(interiorOverlay && interiorOverlay !== w\) interiorOverlay\.dispose\?\.\(\);/.test(wm), false,
    'the replace-and-dispose is gone');
});
