// FIELD BUGS 2026-10-18f DUNGEON-DIGITS - Discord #bug-reports, Aspidichelon, "Usable items hotkeys do not function in
// dungeons": "1-9 works outside, but not in dungeons for some reason", over the use-magic-item list on the enhanced skin,
// each row numbered on the right. The list's own digits were never the defect (ui/listPicker.js input picks
// `scrollIndex + d - 1` in every host). The hotbar - the enhanced skin's default quickbar since HB-LYCFREE - takes the
// digits on the window's capture phase, ahead of every host's ladder, and stands down only while the HUD's last frame
// said the game is paused (enhancedHotbar.js onKey, AUDIT CONTRIB H1). Both dungeon hosts return above `drawFoes` while a
// window pauses the game, and `drawFoes` is their only drawHud: underground the bar heard the last frame of play for as
// long as the window stood, took the digit, and pressed its own slot behind the paused window. Driven on the real
// modules: the real drawHud and enhanced HUD over a page, the real hotbar and its listener, the real use-magic-item window
// in the dungeon's slot, the real key route (ui/input.js routeKey) and the real quickslot use.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakePage } from '../../hudPage.mjs';
import { createBindings, resetDefaults, setBinding } from '../../../src/systems/inputActions.js';
import { setBindings, routeKey, bindings } from '../../../src/ui/input.js';
import { drawHud, hideHudTextSurfaces } from '../../../src/ui/hud/hud.js';
import { HudText } from '../../../src/ui/hud/hudText.js';
import { createUseMagicItemWindow } from '../../../src/ui/useMagicItemWindow.js';
import { createPotion } from '../../../src/systems/loot/loot.js';
import { HEALING_RECIPE_KEY, MAGICKA_RECIPE_KEY } from '../../../src/systems/healingSupply.js';
import { setHotbarSlot, hotbarEntryForItem, clearHotbarSlot, useQuickslot } from '../../../src/systems/quickslots.js';
import { _resetForTests as resetPrefs } from '../../../src/systems/uiPrefs.js';
import { attachTouch } from '../../../src/ui/touch/touch.js';   // AUDIT FB1018f L2-5: the doors a host hands its input hooks
import { attachGamepad } from '../../../src/ui/gamepadInput.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

// THE PAGE: hudPage.mjs's (selectors, ids, the tree), with the few members the enhanced HUD and its bar write besides -
// a class list, an SVG node, the restart the caption plays - and the window whose listeners the browser would fire. ONE
// page for the file: the enhanced HUD and its bar are module state, built into the page their first frame finds.
const listeners = [];
let thePage = null;
function page() {
  if (thePage) { globalThis.document = thePage; globalThis.location = { search: '?skin=enhanced' }; globalThis.window = thePage.win; return thePage; }
  globalThis.location = { search: '?skin=enhanced' };
  const doc = fakePage();
  const make = doc.createElement;
  doc.createElement = (tag) => {
    const n = make(tag);
    const on = new Set();
    n.classList = {
      add: (...c) => c.forEach((x) => on.add(x)), remove: (...c) => c.forEach((x) => on.delete(x)),
      toggle: (c, v) => { const now = v ?? !on.has(c); if (now) on.add(c); else on.delete(c); return now; }, contains: (c) => on.has(c),
    };
    n.appendChild = (c) => { n.append(c); return c; };
    n.prepend = (...c) => n.append(...c);
    Object.defineProperty(n, 'parentNode', { get: () => n.parentElement });
    n.offsetWidth = 0;
    return n;
  };
  doc.createElementNS = (ns, tag) => doc.createElement(tag);
  doc.createTextNode = (t) => ({ textContent: String(t) });
  doc.documentElement = doc.createElement('html');
  doc.fonts = { add() {} };
  doc.win = { addEventListener: (type, fn, capture) => listeners.push({ type, fn, capture }), removeEventListener() {} };
  globalThis.document = doc;
  globalThis.window = doc.win;
  thePage = doc;
  return doc;
}
const hudRoot = (doc) => doc.body.children.find((n) => n.className === 'hud');
const keyOf = (code) => ({
  type: 'keydown', code, key: code.slice(-1), repeat: false, target: { tagName: 'CANVAS' },
  preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, stopImmediatePropagation() { this.stopped = true; },
});
/** One press as the browser delivers it: the window's capture listeners (the bar's), and - unless one stopped it - the
 *  host's own keydown, which hands the event to routeKey with its context (scenes/dungeon.js, worldModes' dungeon arm). */
function press(code, ctx) {
  const e = keyOf(code);
  for (const l of listeners) if (l.type === 'keydown' && l.capture && !e.stopped) l.fn(e);
  if (!e.stopped) routeKey(e, ctx, null, new Set());
  return e;
}
/** The dungeon context's slot as routeKey reads it: dungeonContext.js's `uiOverlayActive`, `overlayIsNative` and
 *  `overlayInput` - a window in `activeOverlay`, a native one handed the raw code, the slot emptied when it is done. */
function dungeonSlot() {
  const slot = {
    win: null,
    get uiOverlayActive() { return !!slot.win; },
    get overlayIsNative() { return !!slot.win?.isChoiceWindow; },
    overlayInput(action, e = null) { slot.win.input(action, e); if (slot.win?.done) slot.win = null; },
  };
  return slot;
}
const CANVAS = { width: 1280, height: 800, clientWidth: 1280, clientHeight: 800 };
const renderer = () => ({ uploadTexture: () => 'tex', drawScreenQuad() {} });
const player = () => ({
  health: 50, maxHealth: 50, magicka: 20, maxMagicka: 20, fatigue: 6400, stats: { strength: 50, endurance: 50 },
  items: [createPotion(HEALING_RECIPE_KEY), createPotion(MAGICKA_RECIPE_KEY)], equip: { slots: {} }, activeEffects: [], spells: [],
});
/** The doors a host's drawHud hands the bar - here the consumable one, the dungeon's own shape
 *  (dungeonContext.js quickUse: `useQuickslot(n === 1 ? 'c1' : 'c2', ...)`, the pack's Use). */
const doorsOf = (me, pressed) => ({ quickUse: (n) => { pressed.push(n); useQuickslot(n === 1 ? 'c1' : 'c2', { entity: me, items: me.items }); return true; } });

function withPage(fn) {
  const had = { doc: globalThis.document, win: globalThis.window, loc: globalThis.location };
  const store = createBindings();
  resetDefaults(store);
  setBindings(store);
  resetPrefs();   // the shelf's defaults: the enhanced skin and its default quickbar, the hotbar
  try { return fn(page()); } finally {
    setBindings(null);
    resetPrefs();
    for (const [k, v] of [['document', had.doc], ['window', had.win], ['location', had.loc]]) {
      if (v === undefined) delete globalThis[k]; else globalThis[k] = v;
    }
  }
}

// FIRST in the file: the HUD is module state, built once by its first frame.
test('DUNGEON-DIGITS THE DOOR BUILDS NOTHING: the hide door a dungeon window takes before any HUD frame (a load\'s first window, the classic skin, which builds no enhanced HUD) mints no HUD and binds no key (mutant: the never-built guard dropped)', () => withPage((doc) => {
  hideHudTextSurfaces(new HudText('dungeon'));
  assert.equal(hudRoot(doc), undefined, 'no enhanced HUD minted by its hide door');
  assert.equal(listeners.filter((l) => l.type === 'keydown').length, 0, 'and no bar listening for a digit');
}));

test('DUNGEON-DIGITS THE REPORT: under a dungeon window the digit is the WINDOW\'S - the use-magic-item list\'s row 1 used, the bar\'s slot 1 (a potion) not drunk behind the paused game, the HUD hidden; the window gone, the next frame of play hands the digits back to the bar (mutants: the door says nothing to the enhanced HUD; the bar told the game runs; the HUD left shown)', () => withPage((doc) => {
  const me = player();
  const [heal, mana] = me.items;
  const pressed = [];
  setHotbarSlot(0, hotbarEntryForItem(heal));   // what a player puts on 1: a potion
  try {
    // THE LAST FRAME OF PLAY: drawFoes' drawHud, the slot empty (dungeonContext.js: `cursorActive: !!activeOverlay`).
    drawHud(renderer(), CANVAS, null, me, 0, 1 / 60, { cursorActive: false, ...doorsOf(me, pressed) });
    assert.equal(hudRoot(doc)?.style.display, '', 'the HUD stands in play');
    assert.equal(listeners.filter((l) => l.type === 'keydown' && l.capture).length, 1, 'the bar listens on the window\'s capture phase');
    // U: the dungeon's openUseMagicItem puts the list in its slot (the use runs the host's seam).
    const used = [];
    const slot = dungeonSlot();
    slot.win = createUseMagicItemWindow({ items: me.items, onUse: (item) => used.push(item) });
    assert.deepEqual(slot.win.items, ['Potion of Healing', 'Potion of Restore Power']);
    // THE FRAMES UNDER IT: both dungeon hosts return above drawFoes, and the one HUD call on that branch is the hide
    // door (`dungeonCtx.hideHudText`, which is `hideHudTextSurfaces(hudText)`).
    const popup = new HudText('dungeon');
    for (let i = 0; i < 3; i++) hideHudTextSurfaces(popup);
    assert.equal(hudRoot(doc).style.display, 'none', 'the HUD hidden under the window, as drawHud hides it under one in every other host');
    const one = press('Digit1', slot);
    assert.equal(!!one.stopped, false, 'the bar stood down: the digit reached the host\'s key route');
    assert.deepEqual(used, [heal], 'row 1 used - the list\'s own digit');
    assert.equal(slot.win, null, 'and the list closed, as a pick closes it');
    assert.deepEqual(pressed, [], 'the bar\'s slot 1 never pressed behind the window...');
    assert.deepEqual(me.items, [heal, mana], '...so its potion was not drunk through a paused game');
    // A second window, its second row.
    slot.win = createUseMagicItemWindow({ items: me.items, onUse: (item) => used.push(item) });
    hideHudTextSurfaces(popup);
    press('Digit2', slot);
    assert.deepEqual(used, [heal, mana], 'row 2 is 2');
    // THE WINDOW GONE: the next frame of play is drawFoes' again, and the bar has its digits back.
    drawHud(renderer(), CANVAS, null, me, 0, 1 / 60, { cursorActive: false, ...doorsOf(me, pressed) });
    assert.equal(hudRoot(doc).style.display, '', 'the HUD back in play');
    const back = press('Digit1', slot);
    assert.equal(back.stopped, true, 'in play the digit is the bar\'s, and no host ladder hears it');
    assert.deepEqual(pressed, [1], 'slot 1 pressed through the host\'s door');
    assert.deepEqual(me.items, [mana], 'and its potion drunk - in play, where a hotkey belongs');
  } finally { clearHotbarSlot(0); }
}));

test('DUNGEON-DIGITS WHY OUTSIDE WORKED: the street\'s and a building\'s frames DO reach drawHud under a window - told the game is paused, the bar stands down and the list hears its digit; the four hosts\' HUD calls, read (mutants: a host\'s pause dropped from its HUD call; the dungeon branch\'s door dropped)', () => withPage((doc) => {
  const me = player();
  const [heal] = me.items;
  const pressed = [];
  setHotbarSlot(0, hotbarEntryForItem(heal));
  try {
    drawHud(renderer(), CANVAS, null, me, 0, 1 / 60, { cursorActive: false, ...doorsOf(me, pressed) });
    const used = [];
    const slot = dungeonSlot();   // the street's and the building's slots route a native window the raw code alike
    slot.win = createUseMagicItemWindow({ items: me.items, onUse: (item) => used.push(item) });
    // world.js, exterior.js: `cursorActive: gamePaused()`; worldModes' interior arm: `cursorActive: overlayHeld` - both
    // true with a window up, on every frame, because neither host returns above its drawHud.
    drawHud(renderer(), CANVAS, null, me, 0, 1 / 60, { cursorActive: true, ...doorsOf(me, pressed) });
    assert.equal(hudRoot(doc).style.display, 'none');
    assert.equal(!!press('Digit1', slot).stopped, false);
    assert.deepEqual([used, pressed], [[heal], []], 'the list\'s row 1, never the bar\'s slot');
  } finally { clearHotbarSlot(0); }
  // THE FOUR HOSTS, as they stand. The street and the bench pass the game's pause on every frame; the building's arm
  // passes its own; the dungeon context's drawHud is drawFoes', and both hosts that mount it return above drawFoes
  // under a window with the hide door on the branch's first line.
  const hud = (f) => { const s = rd(f); const at = s.indexOf('drawHud(renderer, canvas, hudArt, playerEntity,'); assert.ok(at > 0, f); return s.slice(at, at + 4000); };
  assert.match(hud('src/scenes/world.js'), /cursorActive: gamePaused\(\),/, 'world.js');
  assert.match(hud('src/scenes/exterior.js'), /cursorActive: gamePaused\(\),/, 'exterior.js');
  assert.match(hud('src/scenes/worldModes.js'), /cursorActive: overlayHeld,/, 'worldModes.js, the interior arm');
  assert.match(hud('src/scenes/dungeonContext.js'), /cursorActive: !!activeOverlay,/, 'dungeonContext.js, drawFoes\' own');
  assert.match(rd('src/scenes/worldModes.js'), /if \(dungeonCtx\.uiOverlayActive\) \{ dungeonCtx\.hideHudText\?\.\(\); hideWorldPlaque\(\); dungeonCtx\.tickOverlay\(dt\);/, 'worldModes.js, the dungeon arm\'s window branch');
  assert.match(rd('src/scenes/dungeon.js'), /if \(ctx\.uiOverlayActive\) \{\n\s+ctx\.hideHudText\?\.\(\); hideWorldPlaque\(\); ctx\.tickOverlay\(dt\); ctx\.drawOverlay\(canvas\);/, 'dungeon.js');
  assert.match(rd('src/scenes/dungeonContext.js'), /hideHudText: \(\) => hideHudTextSurfaces\(hudText\),/, 'the context\'s door is hud.js\'s');
  assert.match(rd('src/scenes/dungeonContext.js'), /get overlayIsNative\(\) \{ return !!activeOverlay\?\.isChoiceWindow; \},/, 'the slot this test stands for: a native window is handed the raw code');
}));

// AUDIT FB1018f L2-5 / L2-6 - LAST in the file: they hand the page a host's input hooks (ui/input.js noteHostInput), and
// each lets them go (an object with no `paused` is no host) so nothing after reads them.
test('AUDIT FB1018f L2-5 THE PAUSE AT THE PRESS: a window opened by one key and a digit before the next frame - the digit is the window\'s, asked of the host\'s own hooks (the ones it hands the finger), never the HUD\'s last frame of play, and so is a slot\'s mouse button; the window gone, a digit before the next frame is the bar\'s again (mutants: the keys reading the last frame\'s word; the mouse slot reading it; the touch door noting nothing)', () => withPage((doc) => {
  const me = player();
  const [heal, mana] = me.items;
  const pressed = [];
  setHotbarSlot(0, hotbarEntryForItem(heal));
  const slot = dungeonSlot();
  // dungeon.js's hooks, as it hands them to attachTouch and attachGamepad: `paused: () => !!ctx.uiOverlayActive`
  attachTouch(null, { paused: () => !!slot.uiOverlayActive });
  try {
    // THE LAST FRAME OF PLAY, then U: the host's route puts the list in the slot - and no frame runs before the digit
    drawHud(renderer(), CANVAS, null, me, 0, 1 / 60, { cursorActive: false, ...doorsOf(me, pressed) });
    const used = [];
    slot.win = createUseMagicItemWindow({ items: me.items, onUse: (item) => used.push(item) });
    const one = press('Digit1', slot);
    assert.equal(!!one.stopped, false, 'the bar stood down at the press: the host says a window is up');
    assert.deepEqual(used, [heal], 'the list\'s row 1');
    assert.deepEqual(pressed, [], 'the bar\'s slot 1 never pressed behind the window...');
    assert.deepEqual(me.items, [heal, mana], '...its potion not drunk');
    // A SLOT ON A MOUSE BUTTON (AUDIT KB1: the middle button on slot 7, the game holding the mouse) asks the same gate
    setBinding(bindings(), 'Mouse2', 'Hotbar7');
    doc.pointerLockElement = {};
    try {
      slot.win = createUseMagicItemWindow({ items: me.items, onUse: (item) => used.push(item) });
      const click = { type: 'mousedown', button: 1, preventDefault() {}, stopImmediatePropagation() { this.stopped = true; } };
      for (const l of listeners) if (l.type === 'mousedown' && l.capture) l.fn(click);
      assert.equal(!!click.stopped, false, 'the button left to the window, as the digit was');
    } finally { doc.pointerLockElement = null; }
    // THE OTHER EDGE: a frame under a window (the hide door's word, paused), the window closed, a digit before the next
    // frame - the game runs, and the key is the bar's
    slot.win = createUseMagicItemWindow({ items: me.items, onUse: (item) => used.push(item) });
    hideHudTextSurfaces(new HudText('dungeon'));
    slot.win = null;
    const back = press('Digit1', slot);
    assert.equal(back.stopped, true, 'the window gone: the bar\'s digit at once');
    assert.deepEqual(pressed, [1], 'slot 1 pressed through the doors of the last frame of play');
    assert.deepEqual(me.items, [mana]);
  } finally { clearHotbarSlot(0); attachTouch(null, {}); }
}));

test('AUDIT FB1018f L2-6 A WINDOW NO DUNGEON FRAME SEES: over ?world\'s dungeon arm a window in the street\'s slot (Recall\'s prompt) stands while drawFoes\' HUD frame says play (its own slot empty) - the bar stands down by the world host\'s hooks, which the pad\'s crossbar reads too; the hosts\' hooks, read (mutants: the pad door noting nothing; the bar reading the last frame\'s word)', () => withPage(() => {
  const me = player();
  const [heal, mana] = me.items;
  const pressed = [];
  setHotbarSlot(0, hotbarEntryForItem(heal));
  const dungeon = dungeonSlot();
  let street = false;   // townTalk's slot
  // world.js's hooks (`paused: () => gamePaused()`: the street's slot and every mode's stack), handed to the pad
  attachGamepad(null, { paused: () => street || dungeon.uiOverlayActive, overlayActive: () => street || dungeon.uiOverlayActive }, { getPads: () => [] });
  try {
    drawHud(renderer(), CANVAS, null, me, 0, 1 / 60, { cursorActive: !!dungeon.win, ...doorsOf(me, pressed) });   // drawFoes' own word
    street = true;   // the prompt raised in the street's slot; the dungeon arm's frames run on, and say play
    drawHud(renderer(), CANVAS, null, me, 0, 1 / 60, { cursorActive: !!dungeon.win, ...doorsOf(me, pressed) });
    const e = press('Digit1', dungeon);
    assert.equal(!!e.stopped, false, 'the digit left to the hosts (worldModes\' keydown hands the street\'s window its keys)');
    assert.deepEqual([pressed, me.items], [[], [heal, mana]], 'and never the bar\'s slot under the prompt');
    street = false;
    assert.equal(press('Digit1', dungeon).stopped, true, 'the prompt answered: the bar\'s again');
    assert.deepEqual(pressed, [1]);
  } finally { clearHotbarSlot(0); attachTouch(null, {}); }
  // THE HOSTS' HOOKS: each hands the one object to the finger and the pad, its `paused` the game's pause - the street's
  // slot and every mode's stack in the world host, the context's in the standalone dungeon
  for (const [f, paused] of [['src/scenes/world.js', 'paused: () => gamePaused(),'], ['src/scenes/exterior.js', 'paused: () => gamePaused(),'], ['src/scenes/dungeon.js', 'paused: () => !!ctx.uiOverlayActive,']]) {
    const s = rd(f);
    const at = s.indexOf('const inputHooks = {');
    const end = s.indexOf('const gamepad = attachGamepad(canvas, inputHooks);', at);
    assert.ok(at > 0 && end > at, `${f}: its hooks handed to the pad`);
    const hooks = s.slice(at, end);
    assert.ok(hooks.includes(`\n    ${paused}`), `${f}: ${paused}`);
    assert.match(hooks, /const touch = attachTouch\(canvas, inputHooks\);\s*$/, `${f}: and to the finger`);
  }
  assert.match(rd('src/scenes/world.js'), /const gamePaused = \(\) => staffTeleportHeld \|\| townTalk\.overlayActive \|\| \(modes\?\.overlayHeld \?\? false\);/, 'the world host\'s pause: the street\'s slot and the modes\' stacks');
}));
