// FIELD BUGS 2026-10-04e - PAD-BINDS and PAD-ARRANGE (bible/01-Overview/Field-Bugs-2026-10-04e.md, report 1).
//
// Discord (Sir Timbers): "Overworld and Quick Dial are missing from the controller binding options ... Additionally,
// rearranging the hot bar icons on controller is not possible. Only current workaround is to swap to M&K hotbar,
// rearrange there, and swap back to controller hotbar ... Perhaps when adding a spell/item/etc to your hotbar it could
// prompt you by asking what hotbar button to apply to."
//
// PAD-BINDS: the Controller bindings window's rows and the d-pad's tap/hold choices offer both actions, and a d-pad
// choice whose action is on no key (TravelView ships unbound) reaches the host's own door rather than nothing.
// PAD-ARRANGE: under a window LT raises the tucked bar; A takes a slot in hand and puts it down; "Add to hotbar" with
// the pad in hand puts the new entry in hand, and a bumper + the slot's own button places it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBindings, resetDefaults, getBinding } from '../src/systems/inputActions.js';
import { applyPlusPadLayout, registerCrossbar, crossbarApi, registerQuickAct, quickActApi, setPlusDpad, plusDpadMap, DPAD_CHOICES, windowPrompts, HOTBAR_ARRANGE_CODE } from '../src/ui/plusPad.js';
import { bindPlusRow, PLUS_BIND_ROWS, rowCode } from '../src/ui/plusPadBinds.js';
import { setBindings } from '../src/ui/input.js';
import { attachGamepad } from '../src/ui/gamepadInput.js';
import { setPref, _resetForTests as resetPrefs } from '../src/systems/uiPrefs.js';
import { _resetForTests as resetSettings } from '../src/systems/settings.js';
import { setControllerLook } from '../src/player/lookFilter.js';
import { hotbarEntry, clearHotbar, setHotbarSlot, hotbarEntryForItem } from '../src/systems/quickslots.js';
import { fakeDom } from './invdrag.mjs';

const plusStore = () => { const s = createBindings(); resetDefaults(s); applyPlusPadLayout(s); return s; };
const noSave = { save() {} };
const newPad = () => ({ connected: true, mapping: 'standard', id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) });
const canvas = { dispatchEvent() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), style: {} };

test('PAD-BINDS: the Controller bindings window has an Overworld and a Quick dial row on the registry\'s own actions, and binding them writes the secondary dict; a row taking a button from one with none to give back says that row is unbound (mutants: either row gone; a row on the wrong action; the cleared row said to have taken the old button)', async () => {
  const ow = PLUS_BIND_ROWS.find((r) => r.id === 'overworld');
  const qd = PLUS_BIND_ROWS.find((r) => r.id === 'quickdial');
  assert.deepEqual(ow && { sec: ow.sec, label: ow.label, keep: !!ow.keep }, { sec: 'TravelView', label: 'Overworld', keep: false });
  assert.deepEqual(qd && { sec: qd.sec, label: qd.label, keep: !!qd.keep }, { sec: 'QuickDial', label: 'Quick dial', keep: false });
  const s = plusStore();
  assert.equal(rowCode(s, ow), null, 'the Overworld ships with no pad button');
  assert.equal(bindPlusRow(s, 'overworld', 'JoystickButton8', noSave).ok, true);
  assert.equal(getBinding(s, 'TravelView', false), 'JoystickButton8', 'L3 is the Overworld now');
  assert.equal(bindPlusRow(s, 'quickdial', 'JoystickButton9', noSave).ok, true);
  assert.equal(getBinding(s, 'QuickDial', false), 'JoystickButton9', 'R3 the quick dial');
  assert.equal(getBinding(s, 'QuickDial'), 'Tab', 'the keyboard keeps its own Tab');
  // a row with no button taking one another row holds: that row is left UNBOUND, and the window says so
  const jump = PLUS_BIND_ROWS.find((r) => r.id === 'jump');
  const jumpCode = rowCode(s, jump);
  assert.ok(jumpCode, 'Jump ships with a button');
  const t = plusStore();
  const r = bindPlusRow(t, 'overworld', jumpCode, noSave);
  assert.deepEqual({ ok: r.ok, swapped: r.swapped, cleared: r.cleared }, { ok: true, swapped: 'Jump', cleared: true });
  assert.equal(rowCode(t, jump), null, 'Jump has no button now');
  const r2 = bindPlusRow(t, 'jump', rowCode(t, PLUS_BIND_ROWS.find((x) => x.id === 'run')), noSave);
  assert.equal(r2.cleared, true, 'and the swap the other way is a clearing too, Jump having none');
  const r3 = bindPlusRow(t, 'jump', rowCode(t, PLUS_BIND_ROWS.find((x) => x.id === 'crouch')), noSave);
  assert.deepEqual({ swapped: r3.swapped, cleared: r3.cleared }, { swapped: 'Crouch', cleared: false }, 'a row with a button swaps it');
  const { readFileSync } = await import('node:fs');
  assert.match(readFileSync(new URL('../src/ui/plusPadBinds.js', import.meta.url), 'utf8'), /note = r\.ok \? \(r\.cleared \? `Bound\. \$\{r\.swapped\} is unbound now\.` : r\.swapped \? `Bound\. \$\{r\.swapped\} took the old button\.` : 'Bound\.'\)/, 'the note');
});

test('PAD-BINDS: the d-pad offers Quick dial and Overworld for a tap or a hold - Quick dial presses its key, the Overworld (on no key) is the host\'s padAction (mutants: either choice gone; the unbound action dropped)', () => {
  assert.ok(DPAD_CHOICES.some(([a, w]) => a === 'QuickDial' && w === 'Quick dial'));
  assert.ok(DPAD_CHOICES.some(([a, w]) => a === 'TravelView' && w === 'Overworld'));
  const prev = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  resetPrefs(); resetSettings();
  setPref('plusPadLayout', 0);
  const store = plusStore(); setBindings(store);
  const wasXb = crossbarApi();   // the bar module's own, if it is loaded - put back for the tests that drive it
  registerCrossbar({ inForce: () => true, press() {}, setActive() {} });
  const events = []; const dispatch = (t, c) => events.push(`${t}:${c}`);
  const asked = [];
  const pad = newPad();
  const gp = attachGamepad(canvas, { overlayActive: () => false, paused: () => false, attack() {}, look() {}, padAction: (a) => { asked.push(a); return true; } },
    { getPads: () => [pad], dispatch, makeEvent: (type, init) => ({ type, ...init }) });
  const hold = (i, frames) => { pad.buttons[i] = { pressed: true, value: 1 }; for (let f = 0; f < frames; f++) gp.tick(1 / 60); pad.buttons[i] = { pressed: false, value: 0 }; gp.tick(1 / 60); gp.tick(1 / 60); };
  try {
    gp.tick(1 / 60);
    assert.equal(setPlusDpad('right', 'tap', 'QuickDial'), true);
    assert.equal(setPlusDpad('right', 'hold', 'TravelView'), true);
    assert.deepEqual(plusDpadMap().right, { tap: 'QuickDial', hold: 'TravelView' }, 'both are kept on the shelf');
    events.length = 0; hold(15, 3);
    assert.ok(events.includes('keydown:Tab'), `a tap of right is the quick dial's key: ${events}`);
    assert.deepEqual(asked, [], 'and not the Overworld');
    events.length = 0; hold(15, 40);
    assert.deepEqual(asked, ['TravelView'], 'held, it is the Overworld - the host\'s own door, once');
    assert.ok(!events.includes('keydown:Tab'), 'and not also the dial');
  } finally { gp.dispose(); registerCrossbar(wasXb); globalThis.window = prev; resetPrefs(); }
});

test('PAD-BINDS: the world host answers a pad action on no key with the one TravelView toggle its key arm also calls', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(src, /padAction: \(act\) => \{ if \(MODE_ACTIONS\[act\]\) return townTalk\.pickMode\(MODE_ACTIONS\[act\]\); if \(act !== 'TravelView' \|\| townTalk\.overlayActive\) return false; travelViewKey\(\); return true; \},/);   // MODE-WHEEL: an unbound mode action first
});

test('PAD-ARRANGE prompts: a window with a bar to arrange shows LT; in hand on the crossbar the bumpers place, never turn the tabs (mutants: no LT row; Tabs kept in hand)', () => {
  const words = (o) => windowPrompts(o).map(([c, w]) => `${c.join('+')}:${w}`);
  assert.deepEqual(words({ tabs: false }), ['JoystickButton0:Select', 'JoystickButton3:Options', 'JoystickButton1:Back', 'Dpad:Jump to', 'StickR:Scroll'], 'no bar: unchanged');
  assert.ok(words({ hotbar: 'off' }).includes(`${HOTBAR_ARRANGE_CODE}:Arrange hotbar`));
  assert.ok(words({ hotbar: 'on' }).includes(`${HOTBAR_ARRANGE_CODE}:Hotbar done`));
  const xb = words({ tabs: true, hotbar: 'handxb' });
  assert.ok(xb.includes('JoystickButton4+JoystickButton5:Hold + a slot\'s button: put it there'));
  assert.ok(!xb.some((w) => /Tabs/.test(w)), 'the bumpers are the bar\'s while something is in hand');
  assert.ok(words({ tabs: true, hotbar: 'hand' }).some((w) => /Tabs/.test(w)), 'on the row of ten there is no button to place with');
  assert.equal(HOTBAR_ARRANGE_CODE, 'JoystickAxis9Button0', 'LT');
});

test('PAD-ARRANGE poller: under a window LT asks the bar to arrange; with something in hand on the crossbar LB + A places slot 7 and A never also clicks, LB + X places and never quick-acts, and the bumper turns no tab - on the row of ten it still does (mutants: LT ignored; the place swallowed nothing; the bumper still a tab; the row of ten\'s tabs taken)', () => {
  const prev = globalThis.window, prevDoc = globalThis.document;
  globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  // a pack window's two category tabs (plusPad.js TAB_GROUPS' first strip), each click logged
  const tabsClicked = [];
  const tab = (k) => ({ getClientRects: () => [1], classList: { contains: () => false }, getAttribute: () => null, closest: () => null, click: () => tabsClicked.push(k) });
  const tabs = [tab(0), tab(1)];
  const strip = { getClientRects: () => [1], closest: () => null, querySelectorAll: (sel) => (sel === '.packtab' ? tabs : []) };
  globalThis.document = { querySelectorAll: (sel) => (sel === '.packtabs' ? [strip] : []), elementFromPoint: () => null };
  resetPrefs(); resetSettings();
  setPref('plusPadLayout', 0);
  const store = plusStore(); setBindings(store);
  let holding = false, arranged = 0, onCrossbar = true, quick = 0;
  const placed = [], clicks = [];
  const wasXb = crossbarApi(), wasQuick = quickActApi();
  registerCrossbar({ inForce: () => false, press() {}, setActive() {}, canArrange: () => true, arranging: () => holding, arrange: () => { arranged++; }, holding: () => holding, crossbar: () => onCrossbar, place: (i) => { placed.push(i); holding = false; } });
  registerQuickAct({ available: () => true, act: () => { quick++; } });
  const pad = newPad();
  const gp = attachGamepad(canvas, { overlayActive: () => true, paused: () => false, attack() {}, look() {} },
    { getPads: () => [pad], dispatch() {}, makeEvent: (type, init) => { if (type === 'pointerdown') clicks.push(init.button); return { type, ...init }; } });
  const tick = (n = 1) => { for (let i = 0; i < n; i++) gp.tick(1 / 60); };
  try {
    tick(3);
    pad.buttons[6] = { pressed: true, value: 1 }; tick();
    assert.equal(arranged, 1, 'LT under a window: arrange');
    tick(5);
    assert.equal(arranged, 1, 'once a press');
    pad.buttons[6] = { pressed: false, value: 0 }; tick();
    holding = true;
    pad.buttons[4] = { pressed: true, value: 1 }; tick();
    pad.buttons[0] = { pressed: true, value: 1 }; tick();
    assert.deepEqual(placed, [6], 'LB + A = slot 7, as the crossbar presses it');
    assert.deepEqual(clicks, [], 'A was the bar\'s, not a click at the cursor');
    pad.buttons[4] = { pressed: false, value: 0 }; tick();
    assert.deepEqual(clicks, [], 'LB let go first: A, still held, is still the bar\'s');
    pad.buttons[0] = { pressed: false, value: 0 }; tick();
    pad.buttons[0] = { pressed: true, value: 1 }; tick();
    assert.deepEqual(clicks, [0], 'a fresh A with nothing in hand is a click again');
    pad.buttons[0] = { pressed: false, value: 0 }; tick();
    assert.deepEqual(tabsClicked, [], 'the bumper held to place turned no tab');
    // LB + X: X's own crossbar slot, never the quick act at the cursor
    holding = true;
    pad.buttons[4] = { pressed: true, value: 1 }; tick();
    pad.buttons[2] = { pressed: true, value: 1 }; tick();
    assert.equal(placed.length, 2, 'LB + X placed');
    assert.equal(quick, 0, 'and X was not also the quick act');
    pad.buttons[2] = { pressed: false, value: 0 }; pad.buttons[4] = { pressed: false, value: 0 }; tick();
    pad.buttons[2] = { pressed: true, value: 1 }; tick();
    assert.equal(quick, 1, 'a fresh X with nothing in hand is the quick act again');
    pad.buttons[2] = { pressed: false, value: 0 }; tick();
    // nothing in hand: the bumpers turn the tabs
    pad.buttons[5] = { pressed: true, value: 1 }; tick();
    pad.buttons[5] = { pressed: false, value: 0 }; tick();
    assert.deepEqual(tabsClicked, [1], 'RB with nothing in hand: the next tab');
    // in hand on the row of ten: nothing to place with, so the bumpers stay the tabs'
    holding = true; onCrossbar = false;
    pad.buttons[4] = { pressed: true, value: 1 }; tick();
    pad.buttons[4] = { pressed: false, value: 0 }; tick();
    assert.deepEqual(tabsClicked, [1, 1], 'LB on the row of ten: the tab before');
    assert.equal(placed.length, 2, 'and nothing placed');
  } finally { gp.dispose(); registerCrossbar(wasXb); registerQuickAct(wasQuick); globalThis.window = prev; globalThis.document = prevDoc; resetPrefs(); }
});

/** The bar's module, mounted on a fake page whose nodes keep their listeners (a slot is pressed by its own). */
async function withBar(fn) {
  const dom = fakeDom();
  const mk = dom.doc.createElement;
  dom.doc.createElement = (tag) => {
    const n = mk(tag);
    const ls = {};
    n.addEventListener = (t, f) => { (ls[t] ??= []).push(f); };
    n.fire = (t, e) => { for (const f of ls[t] ?? []) f(e); };
    n.removeAttribute = (k) => { delete n.attrs[k]; };
    n.after = (x) => { x.remove?.(); const p = n.parent; const at = p.children.indexOf(n); x.parent = p; p.children.splice(at + 1, 0, x); };
    return n;
  };
  const saved = { doc: globalThis.document, win: globalThis.window, loc: globalThis.location };
  globalThis.document = dom.doc;
  globalThis.window = { addEventListener: dom.win.addEventListener, removeEventListener: dom.win.removeEventListener, dispatchEvent() {} };
  globalThis.location = { search: '?skin=enhanced' };
  resetPrefs();
  setPref('quickbarStyle', 'hotbar');
  setPref('plusCrossbar', 'on');
  try {
    const hb = await import('../src/ui/enhancedHotbar.js');
    const dock = dom.mk('div');
    dom.body.append(dock);
    hb.mountHotbarDock(dock);
    clearHotbar();
    return await fn({ hb, dom, slot: (i) => dom.all(dom.body).find((n) => n.classList.contains('hb-slot') && n.dataset.slot === String(i)) });
  } finally {
    clearHotbar(); setControllerLook(false); resetPrefs();
    globalThis.document = saved.doc; globalThis.window = saved.win; globalThis.location = saved.loc;
  }
}
const sword = () => ({ name: 'Longsword', shortName: 'Longsword', itemGroup: 3, groupIndex: 6, templateIndex: 6, stackCount: 1, currentCondition: 100, maxCondition: 100 });
const potion = () => ({ name: 'Potion of Healing', shortName: 'Potion of Healing', itemGroup: 21, groupIndex: 0, templateIndex: 0, stackCount: 1 });
const press = (n, button = 0) => n.fire('pointerdown', { button, pointerId: 1, clientX: 5, clientY: 5, pointerType: 'mouse', preventDefault() {} });
/** A whole press with something in hand: down, and the click its release makes - the click puts it down. */
const choose = (n) => { press(n); n.fire('click', { stopPropagation() {} }); };

test('PAD-ARRANGE bar: with the pad in hand "Add to hotbar" puts the entry IN HAND and raises the tucked bar; A on a slot puts it there; the mouse still takes the first free slot (mutants: the first free slot with the pad; the bar left tucked)', async () => {
  await withBar(async ({ hb, dom, slot }) => {
    const it = sword();
    if (!hotbarEntryForItem(it)) return assert.fail('the fixture item must be one the bar takes');
    hb.setHotbarDropMode('pack', true, { items: [it] });
    const bar = dom.all(dom.body).find((n) => n.classList.contains('hb'));
    assert.ok(bar.classList.contains('tuck') && !bar.classList.contains('dragging'), 'under a window the bar is tucked');
    setControllerLook(true);
    assert.equal(hb.toggleHotbarItem(it), hb.PAD_ARRANGE_TEXT.choose(hotbarEntryForItem(it).name), 'the pad: the player is asked');
    assert.equal(hotbarEntry(0), null, 'nothing taken the first free slot');
    assert.deepEqual(hb.hotbarHand(), { kind: 'item', name: hotbarEntryForItem(it).name, slot: null });
    assert.ok(bar.classList.contains('dragging'), 'the bar is up to be reached');
    assert.equal(crossbarApi().holding(), true, 'the pad layer sees the hand');
    press(slot(11));
    assert.equal(hotbarEntry(11), null, 'the press alone puts nothing down - the bar stays raised under the cursor for its release');
    assert.ok(bar.classList.contains('dragging'));
    slot(11).fire('click', { stopPropagation() {} });
    assert.equal(hotbarEntry(11)?.name, hotbarEntryForItem(it).name, 'A on crossbar slot 12 put it there, on the press\'s click');
    assert.equal(hb.hotbarHand(), null);
    assert.ok(!bar.classList.contains('dragging'), 'and the bar tucks again');
    // the mouse: unchanged
    setControllerLook(false);
    const p = potion();
    assert.ok(hotbarEntryForItem(p), 'the fixture potion is one the bar takes');
    hb.toggleHotbarItem(p);
    assert.equal(hotbarEntry(0)?.name, hotbarEntryForItem(p).name, 'the mouse\'s Add takes the first free slot, as always');
    hb.setHotbarDropMode('pack', false);
  });
});

test('PAD-ARRANGE bar: LT raises the bar; A takes a slot in hand and A on another swaps them; the crossbar API places too; the last window closing lets go (mutants: the tap picks nothing; the hand kept past the window)', async () => {
  await withBar(async ({ hb, dom, slot }) => {
    const a = sword(), b = potion();
    setHotbarSlot(0, hotbarEntryForItem(a));
    setHotbarSlot(3, hotbarEntryForItem(b));
    const nameA = hotbarEntry(0).name, nameB = hotbarEntry(3).name;
    hb.setHotbarDropMode('pack', true, { items: [a, b] });
    const bar = dom.all(dom.body).find((n) => n.classList.contains('hb'));
    setControllerLook(true);
    assert.equal(crossbarApi().canArrange(), true);
    crossbarApi().arrange();
    assert.ok(bar.classList.contains('dragging') && hb.hotbarArranging(), 'LT: the bar is up');
    // A on slot 1: a press that never moves, let go
    press(slot(0));
    dom.win.fire('pointerup', { pointerId: 1, clientX: 5, clientY: 5 });
    assert.deepEqual(hb.hotbarHand(), { kind: 'slot', name: nameA, slot: 0 }, 'A took slot 1 in hand');
    assert.ok(slot(0).classList.contains('hb-inhand'), 'and it shows');
    choose(slot(3));
    assert.equal(hotbarEntry(3)?.name, nameA, 'A on slot 4 put it there');
    assert.equal(hotbarEntry(0)?.name, nameB, 'the two swapped');
    // the crossbar's own button
    press(slot(3));
    dom.win.fire('pointerup', { pointerId: 1, clientX: 5, clientY: 5 });
    assert.equal(crossbarApi().holding(), true);
    assert.equal(crossbarApi().place(9), true);
    assert.equal(hotbarEntry(9)?.name, nameA, 'LB/RB + its button: slot 10');
    // a hand left when the window shuts
    press(slot(9));
    dom.win.fire('pointerup', { pointerId: 1, clientX: 5, clientY: 5 });
    assert.ok(hb.hotbarHand());
    hb.setHotbarDropMode('pack', false);
    assert.equal(hb.hotbarHand(), null, 'the last window lets go of the hand');
    assert.equal(hb.hotbarArranging(), false);
    assert.equal(hotbarEntry(9)?.name, nameA, 'and the slot it held is where it was');
  });
});

test('PAD-ARRANGE bar: the hand is put down only by the click of a press that began on that slot; Y (the context press) on the slot in hand clears it and lets go; the mouse taking the hands back drops the hand and lowers the bar (mutants: put down on the press; any click places; the cleared slot kept in hand; the hand kept off the pad)', async () => {
  await withBar(async ({ hb, dom, slot }) => {
    const a = sword(), b = potion();
    setHotbarSlot(0, hotbarEntryForItem(a));
    setHotbarSlot(5, hotbarEntryForItem(b));
    const nameA = hotbarEntry(0).name;
    hb.setHotbarDropMode('pack', true, { items: [a, b] });
    const bar = dom.all(dom.body).find((n) => n.classList.contains('hb'));
    setControllerLook(true);
    crossbarApi().arrange();
    press(slot(0));
    dom.win.fire('pointerup', { pointerId: 1, clientX: 5, clientY: 5 });
    assert.equal(hb.hotbarHand()?.slot, 0, 'slot 1 in hand');
    // a press on slot 3 whose click lands on slot 4: neither is chosen
    press(slot(2));
    slot(3).fire('click', { stopPropagation() {} });
    assert.equal(hb.hotbarHand()?.slot, 0, 'still in hand');
    assert.equal(hotbarEntry(3), null);
    assert.equal(hotbarEntry(2), null);
    // Y on the slot in hand: cleared, and nothing left in hand
    slot(0).fire('contextmenu', { preventDefault() {} });
    assert.equal(hotbarEntry(0), null, 'Y cleared slot 1');
    assert.equal(hb.hotbarHand(), null, 'and the hand that held it is empty');
    // the mouse takes the hands back: the pad's hand goes and the bar lowers
    press(slot(5));
    dom.win.fire('pointerup', { pointerId: 1, clientX: 5, clientY: 5 });
    assert.equal(hb.hotbarHand()?.slot, 5);
    setControllerLook(false);
    hb.setHotbarDropMode('chest', true);   // any repaint
    assert.equal(hb.hotbarHand(), null, 'off the pad, no hand');
    assert.equal(hb.hotbarArranging(), false);
    assert.ok(!bar.classList.contains('dragging'), 'the bar tucked again');
    assert.equal(hotbarEntry(5)?.name, hotbarEntryForItem(b).name, 'the slot where it was');
    assert.notEqual(nameA, null);
    hb.setHotbarDropMode('chest', false); hb.setHotbarDropMode('pack', false);
  });
});
