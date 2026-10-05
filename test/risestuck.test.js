// RISE-STUCK (Discord, 2026-09-27, Ninilac: "Was fast travelling while playing online and my character just decided
// to climb a wall that was in the way and died. I clicked 'rise now' but the death screen didn't go away, so I waited
// for the timer and it still didn't go away when it reached 0").
//
// Two halves. A box PUSHED over the death screen buried it, and the online rise - which REPLACES the top - replaced
// the box, so the screen came back with its one reset spent (the stack's half: ui/windowStack.js holdsTop). And a
// Travel Options journey ran on under the death screen - its autopilot runs under any paused window - so its arrival
// could push that box, and the journey walked the respawned player on (the host's half: world.js's presenter).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { makeWindowStack } from '../src/ui/windowStack.js';
import { DeathScreen, ONLINE_RESPAWN_SECONDS } from '../src/ui/deathScreen.js';
import { ActionTextBox } from '../src/ui/actionText.js';
import { createTownTalk } from '../src/scenes/townTalk.js';
import { createTravelOptions, readTravelOptionsSettings } from '../src/systems/travelOptions.js';
import { TravelControlUI } from '../src/ui/travelControlUI.js';
import { TRAVEL_OPTIONS_TEXT } from '../src/systems/travelOptionsText.js';
import { mapPixelWorldOrigin } from '../src/systems/travelPaths.js';
import { rectOf } from '../src/systems/travelAutopilot.js';
import { modSetting } from '../src/systems/modSettings.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const talkHost = () => createTownTalk({
  renderer: { uploadTexture: () => ({}) }, canvas: { width: 640, height: 400 },
  fetchBytes: async () => { throw new Error('this pin loads no ARENA2'); },
  playerEntity: { name: 'T', stats: { personality: 50 }, skills: 30, skillUses: [] },
  regionIndex: 0,
});
/** The online screen, whichever page the suite runs on: the countdown is the rise's second door. */
const onlineDeath = (onReset) => {
  const ds = new DeathScreen({ eyeHeight: 1.6, capsuleHeight: 1.8, onReset });
  ds.online = true;
  return ds;
};

test('RISE-STUCK: a box pushed over the death screen waits BENEATH it - the countdown still rises, the rise takes the screen, and the box comes up after', () => {
  const host = talkHost();
  let resets = 0;
  const ds = onlineDeath(() => { resets++; });
  host.showOverlay(ds);
  const fired = [];
  const arrived = { lines: [TRAVEL_OPTIONS_TEXT.MsgArrived] };
  host.pushOverlay(arrived, () => fired.push('arrived'));
  assert.equal(host.overlay, ds, 'the death screen keeps the top - it used to be the box, over a screen the veil still painted');
  // the host ticks the TOP window alone (townTalk.frame): the countdown is the screen's, so it still runs out
  host.overlay.tick(ONLINE_RESPAWN_SECONDS);
  assert.equal(resets, 1, 'the countdown rose');
  // world.js respawnOnlinePlayer's tail: the risen line REPLACES the top
  host.showOverlay(new ActionTextBox(['You wake on the temple steps.']));
  assert.ok(host.overlay instanceof ActionTextBox, 'the rise took the death screen, not the box');
  host.closeOverlay();   // the line read
  assert.equal(host.overlay, arrived, 'the box raised while dead is read after the rise');
  assert.deepEqual(fired, [], 'and not yet closed');
  host.closeOverlay();
  assert.deepEqual(fired, ['arrived'], 'its own callback, once');
  assert.equal(host.overlay, null, 'the death screen never comes back with its reset spent');
});

test('RISE-STUCK: a Resurrect closes the death screen through the slot door and hands the box beneath its OWN callback, not early', () => {
  const host = talkHost();
  const fired = [];
  const ds = onlineDeath(null);
  host.showOverlay(ds, () => fired.push('death'));
  host.pushOverlay({ name: 'trade ask' }, () => fired.push('box'));
  host.pushOverlay({ name: 'second box' }, () => fired.push('box2'));
  assert.equal(host.overlay, ds, 'still the top after two pushes');
  // world.js resurrectInPlace: `ov.restoreView(); townTalk.closeOverlay();`
  ds.restoreView();
  host.closeOverlay();
  assert.deepEqual(fired, ['death'], 'the slot\'s callback stayed the death screen\'s');
  assert.equal(host.overlay?.name, 'second box', 'the last one pushed is the nearest beneath');
  host.closeOverlay();
  assert.deepEqual(fired, ['death', 'box2']);
  assert.equal(host.overlay?.name, 'trade ask');
  host.closeOverlay();
  assert.deepEqual(fired, ['death', 'box2', 'box']);
  assert.equal(host.overlay, null);
});

test('RISE-STUCK: the stack\'s law - over a window that holds the top a push is suspended beneath it (the top, the slot and the pause unmoved); over any other it goes on top as DFU\'s PushWindow does', () => {
  let slot = null;
  const tops = [];
  const stack = makeWindowStack({ onTop: (w) => { slot = w; tops.push(w); } });
  const ds = { name: 'death', holdsTop: true };
  const box = { name: 'box', pauseWhileOpen: false, onPush() { this.pushed = true; } };
  stack.pushWindow(ds);
  assert.equal(stack.pushWindow(box), true);
  assert.equal(slot, ds);
  assert.equal(stack.topWindow(), ds);
  assert.deepEqual(tops, [ds], 'no top change was published');
  assert.equal(box.pushed, true, 'AddWindow\'s OnPush all the same');
  assert.equal(stack.paused(), true);
  const covered = [];
  stack.eachCoveredWindow((w) => covered.push(w));
  assert.deepEqual(covered, [box], 'beneath, where the draw chain paints it');
  stack.popWindow();
  assert.equal(slot, box, 'it comes up when the death screen goes');
  const over = { name: 'over' };
  stack.pushWindow(over);
  assert.equal(slot, over, 'a window that does not hold the top is covered as ever');
  // and the flag is the screen's own
  assert.equal(onlineDeath(null).holdsTop, true);
});

test('RISE-STUCK: the modal hosts\' door (reconcile the slot, then push) keeps a death screen written into the slot by hand on top - THE FOUR HOSTS', () => {
  let slot = null;
  const stack = makeWindowStack({ onTop: (w) => { slot = w; } });
  // worldModes' mountInterior and dungeonContext's pushDungeonWindow, verbatim shape
  const mount = (w) => { stack.reconcile(slot); if (stack.containsWindow(w)) return; stack.pushWindow(w); };
  mount({ name: 'the shop' });
  const ds = onlineDeath(null);
  slot = ds;   // presentInteriorDeath / the dungeon's presenter write the slot by hand
  mount({ name: 'a quest box' });
  assert.equal(slot, ds, 'the box went beneath the screen');
  const wm = src('src/scenes/worldModes.js');
  const dc = src('src/scenes/dungeonContext.js');
  assert.match(wm, /interiorWindows\.reconcile\(interiorOverlay\);[^\n]*\n\s*if \(interiorWindows\.containsWindow\(w\)\) return;[^\n]*\n\s*interiorWindows\.pushWindow\(w\);/, 'the interior door is that shape');
  assert.match(dc, /dungeonWindows\.reconcile\(activeOverlay\);[^\n]*\n\s*if \(dungeonWindows\.containsWindow\(win\)\) return true;\n\s*dungeonWindows\.pushWindow\(win\);/, 'and the dungeon\'s');
});

/** A journey over a table, the world host's wiring: the panel's CAMP is InterruptTravel (world.js onClose). */
function journey() {
  const state = { pos: { x: mapPixelWorldOrigin(500, 250).x + 16384, z: mapPixelWorldOrigin(500, 250).z + 16384 }, pixel: { x: 500, y: 250 } };
  const boxed = [], scales = [];
  let to = null;
  const ui = new TravelControlUI({ defaultStartingAccel: 10, accelerationLimit: 60, onClose: () => to?.interruptTravel() });
  const settings = readTravelOptionsSettings((vendor, key) => (vendor === 'roads-hazelnut' ? false : modSetting(vendor, key)));
  to = createTravelOptions({
    settings, ui,
    roads: () => null,
    worldPos: () => state.pos,
    mapPixel: () => state.pixel,
    yaw: () => 0,
    setFacing: () => {},
    currentLocation: () => null,
    hasCurrentLocation: () => false,
    climateIndex: () => 231,
    entity: () => ({ health: 50, maxHealth: 50, fatigue: 64 * 50, luck: 50, stealth: 50 }),
    enemiesNearby: () => false,
    diseaseCount: () => 0,
    messageBox: (l) => boxed.push(l),
    setTimeScale: (n) => scales.push(n),
    now: () => 0,
    worldTimeNow: () => 0,
    pushWindow: (w) => w.show(),   // world.js: the panel is a HUD readout, shown - not an overlay
    locationWorldRect: (s) => { const o = mapPixelWorldOrigin(s.pixel.x, s.pixel.y); return rectOf(o.x + 16000, o.z + 16000, 768, 768); },
    locationTileRect: () => null,
  });
  to.beginTravel({ pixel: { x: 502, y: 250 }, name: 'Daggerfall', mapId: 199102 }, false);
  /** The respawn's teleport, as the autopilot reads it: the player's world position inside the destination. */
  const intoDestination = () => {
    const o = mapPixelWorldOrigin(502, 250);
    state.pixel = { x: 502, y: 250 };
    state.pos = { x: o.x + 16100, z: o.z + 16100 };
  };
  return { to, ui, boxed, scales, intoDestination };
}
/** The frame under the death screen: the game paused, the travel panel not the top window. */
const underTheDeathScreen = { gamePaused: true, topWindowIsTravelUI: false, isPlayerOnHUD: false, inputPaused: true };

test('RISE-STUCK: the mechanism - under a paused window a journey\'s autopilot still arrives, and its arrival pushes a box', () => {
  const { to, boxed, intoDestination } = journey();
  intoDestination();
  to.update(underTheDeathScreen);
  to.update(underTheDeathScreen);
  assert.deepEqual(boxed, [TRAVEL_OPTIONS_TEXT.MsgArrived], 'TravelOptionsMod.Update :1343-1345 - the autopilot runs under the travel map, and so under anything that pauses');
});

test('RISE-STUCK: a death ends the journey through the mod\'s own pauseTravel - the panel down, the scale back to one, no autopilot left to arrive, the destination kept for the map', () => {
  const { to, ui, boxed, scales, intoDestination } = journey();
  assert.equal(to.isTravelActive, true);
  to.messages.pauseTravel();   // the world host's presenter, below
  assert.equal(ui.isShowing, false, 'the panel is down');
  assert.equal(scales.at(-1), 1, 'InterruptTravel\'s SetTimeScale(1)');
  assert.equal(to.state.autopilot, null);
  assert.equal(to.destinationName, 'Daggerfall', 'CAMP, not EXIT - the map\'s resume prompt can take it up again');
  intoDestination();
  to.update(underTheDeathScreen);
  to.update(underTheDeathScreen);
  assert.deepEqual(boxed, [], 'nothing arrives under the death screen');
  // ...and the world host sends it as the death is presented - AUDIT RISE-REST F4: AFTER the screen is up, and
  // guarded, because the presenter runs inside the one damage door and a throw raised before the screen left a dead
  // player standing with none
  const w = src('src/scenes/world.js');
  const at = w.indexOf('setDeathPresenter(() => {');
  const presenter = w.slice(at, w.indexOf('\n  });', at));
  assert.match(presenter, /if \(!\(townTalk\.overlay instanceof DeathScreen\)\) \{[\s\S]*?\n\s*townTalk\.showOverlay\(new DeathScreen\([^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*try \{ travelOptions\?\.messages\.pauseTravel\(\); \} catch \(e\) \{ console\.error\(/, 'once a death, after the screen, guarded');
  assert.equal((presenter.match(/pauseTravel\(\)/g) ?? []).length, 1, 'and nowhere else in it');
});

test('RISE-STUCK: a respawn that throws still takes the death screen down - its reset is spent, and nothing else would', () => {
  const w = src('src/scenes/world.js');
  const ri = w.indexOf('function respawnOnlinePlayer()');
  const code = w.slice(ri, w.indexOf('\n  }\n', ri)).split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  // PIN MOVED (RVN8: a revenant's theft rides the same box, after the price - bible/12-Enhanced-AI/Feud-Arc.md 19)
  assert.match(code, /townTalk\.showOverlay\(new ActionTextBox\(\[respawnFlavorText\(kind\)(?:, deathPenaltyText\(goldLost\)(?:, took\?\.line)?\]\.filter\(Boolean\)|\])\)\);[^\n]*\n\s*\}\)\.catch\(\(e\) => \{\n[^\n]*console\.error\([^\n]*\n\s*closeDeathScreen\(\);[^\n]*\n\s*\}\)\.finally\(\(\) => \{ _respawning = false; \}\);/,
    'the chain catches, closes the screen it finds and still frees the latch');
  // AUDIT RISE-REST F1: WHICHEVER HOST HOLDS IT. A death in a building or a dungeon stands in the mode's own slot, and
  // a rise that threw before (or inside) forceExitToExterior left it there - the catch read townTalk's slot alone.
  // One door, shared with the Resurrect (which always knew both).
  const fn = w.slice(w.indexOf('function closeDeathScreen() {'), w.indexOf('\n  }\n', w.indexOf('function closeDeathScreen() {')));
  assert.match(fn, /const ov = townTalk\.overlay;\n\s*if \(ov instanceof DeathScreen\) \{ ov\.restoreView\(\); townTalk\.closeOverlay\(ov\); \}\n\s*else modes\?\.clearDeath\?\.\(\);$/, 'townTalk\'s slot, else the mode\'s');
  const rez = w.slice(w.indexOf('function resurrectInPlace(rez) {'), w.indexOf('\n  }\n', w.indexOf('function resurrectInPlace(rez) {')));
  assert.match(rez, /\n\s*closeDeathScreen\(\);\n/, 'the Resurrect closes through the same door');
  assert.equal((w.match(/instanceof DeathScreen\) \{ ov\.restoreView\(\);/g) ?? []).length, 1, 'and no second copy of the close stands anywhere in the host');
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /clearDeath\(\) \{\n\s*if \(mode === 'dungeon'\) \{ dungeonCtx\?\.clearDeathOverlay\?\.\(\); return; \}\n\s*if \(interiorOverlay instanceof DeathScreen\) \{ interiorOverlay\.restoreView\(\); interiorOverlay = null; \}/, 'which reaches the building and the dungeon');
});

test('RISE-STUCK / AUDIT RISE-REST F3: nothing is painted beneath a window that holds the top - a box waiting under the death screen neither shows through the wash nor floats its notice over the veil', () => {
  let slot = null;
  const stack = makeWindowStack({ onTop: (w) => { slot = w; } });
  const shop = { name: 'shop' }, box = { name: 'box' }, ds = { name: 'death', holdsTop: true };
  stack.pushWindow(shop);
  stack.pushWindow(ds);
  stack.pushWindow(box);   // beneath the screen
  const painted = [];
  stack.eachPaintedBeneath((w) => painted.push(w.name));
  assert.deepEqual(painted, [], 'the death screen is the whole screen');
  const covered = [];
  stack.eachCoveredWindow((w) => covered.push(w.name));
  assert.deepEqual(covered, ['shop', 'box'], 'though both are still in the stack, in order');
  stack.popWindow();   // the screen goes
  assert.equal(slot, box);
  stack.eachPaintedBeneath((w) => painted.push(w.name));
  assert.deepEqual(painted, ['shop'], 'and the chain paints again under an ordinary top');
  assert.match(src('src/scenes/townTalk.js'), /if \(overlay && font\) \{\n\s*windows\.eachPaintedBeneath\(\(w\) => w\.draw\(renderer, canvas, font, s\)\);[^\n]*\n\s*overlay\.draw\(renderer, canvas, font, s\);/, 'townTalk paints through it');
  assert.doesNotMatch(src('src/scenes/townTalk.js'), /eachCoveredWindow\(\(w\) => w\.draw/, 'and through nothing else');
});
