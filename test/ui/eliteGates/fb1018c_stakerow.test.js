// FIELD BUGS 2026-10-18c, STAKE-ROW, and AUDIT STAKE-ROW (bible/01-Overview/bugs/Field-Bugs-2026-10-18c.md,
// bible/01-Overview/audits/Audit-Stake-Row.md; Mac: "The top option doesnt work when using the weird key", then "Weir key",
// then "It can be tapped"): the start window's word rows - the stake ("Weir Keys: 3 - one will be staked."), the keyless
// line and the quest warning - are words, not choices; picked, the port's list picker (ui/listPicker.js `_pick`) has
// already closed itself and the host drains it, so the window asks its list again - never no window and a flow that
// still asks. And the audit's siblings in the same flow: the question's No brings the list back (its box still holds the
// slot when it answers); a list put off the screen unpicked cancels the window once; the key used from the pack closes
// the pack, so its window has the screen.
//
// THE SHAPE THE PRODUCER MINTS (Home.md): the real townTalk (scenes/townTalk.js createTownTalk - the street's slot);
// worldModes.js's mountSpellWindow, closeSpellWindow and topWindow read out of the source and run over it in the street's
// arm; world.js's egWindowSlot and its start window's list and question doors read out of the source and run over those
// (ui/eliteGates/egStartWindow.js egStartListDoors over the real ListPickerWindow, egStartAsk over the real
// YesNoBoxWindow); keys through townTalk.keydown, and the enhanced skin's row press itself (ui/enhanced/enhancedPicker.js
// pickRow -> replayClick -> townTalk.pointerdown).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTownTalk } from '../../../src/scenes/townTalk.js';
import { ListPickerWindow, PICKER_X, PICKER_Y, PICKER_RECTS, _setListPickerArtForTests, listPickerArtLoaded } from '../../../src/ui/listPicker.js';
import { YesNoBoxWindow } from '../../../src/ui/yesNoBox.js';
import { pickRow } from '../../../src/ui/enhanced/enhancedPicker.js';
import { useResultAction } from '../../../src/ui/enhanced/enhancedInventory.js';
import { nativeMetrics } from '../../../src/ui/native/nativePanel.js';
import { openEgStartWindow, egStartAsk, egStartListDoors } from '../../../src/ui/eliteGates/egStartWindow.js';
import { EG_TEXT } from '../../../src/net/eliteGates/egLaw.js';
import { weirKeys, setWeirKeyOpener } from '../../../src/systems/eliteGates/weirKey.js';
import { useItem } from '../../../src/systems/useItem.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const WORLD = read('src/scenes/world.js');
const MODES = read('src/scenes/worldModes.js');
function grab(src, re, what) {
  const m = re.exec(src);
  assert.ok(m, `${what} is no longer where this pin reads it`);
  return m.slice(1);
}
const ME = 'acct-mac';
const tick = () => new Promise((r) => setImmediate(r));

/** The street: the real townTalk; worldModes.js's window doors over it (the street's arm), world.js's slot and the start
 *  window's doors over those - each read out of its source and run. `presses` is what the slot holds after each replayed
 *  press of a tap. */
function street() {
  _setListPickerArtForTests({ base: {} });
  let tt = null;
  const presses = [];
  const canvas = { width: 320, height: 200, getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 200 }), requestPointerLock() {},
    dispatchEvent: (e) => { if (e.type === 'pointerdown') { tt.pointerdown(e); presses.push({ win: tt.overlay, done: !!tt.overlay?.done, sel: tt.overlay?.selectedIndex }); } },
    ownerDocument: { defaultView: { dispatchEvent() {} } } };
  tt = createTownTalk({ renderer: { uploadTexture: () => ({}) }, canvas, fetchBytes: async () => { throw new Error('this pin loads no ARENA2'); },
    playerEntity: { name: 'T', stats: { personality: 50 }, skills: 30, skillUses: [] }, regionIndex: 0 });
  const [mount] = grab(MODES, /\n(  function mountSpellWindow\(win\) \{[\s\S]*?\n  \})\n/, 'mountSpellWindow');
  const [close] = grab(MODES, /\n(  function closeSpellWindow\(win\) \{[\s\S]*?\n  \})\n/, 'closeSpellWindow');
  const [top] = grab(MODES, /\n\s*topWindow: (\(\) => \(mode === 'dungeon'[^\n]*\)),\n/, 'topWindow');
  const modes = new Function('townTalk', 'mode', 'dungeonCtx', 'interiorOverlay',
    `${mount}\n${close}\nreturn { topWindow: ${top}, mountWindow: (win) => mountSpellWindow(win), closeWindow: (win) => closeSpellWindow(win) };`)(tt, 'exterior', null, null);
  const [slot] = grab(WORLD, /\n\s*(const egWindowSlot = [^\n]*)\n/, 'egWindowSlot');
  const [doors, ask] = grab(WORLD, /const egStartWindow = \(o\) => openEgStartWindow\(\{\n\s*\.\.\.o,\n\s*board: [^\n]*\n\s*\.\.\.(egStartListDoors\(\{[^\n]*\}\)),\n\s*ask: (egStartAsk\([^\n]*?\)\)),/, "the start window's doors");
  const hostDoors = new Function('modes', 'townTalk', 'listPickerArtLoaded', 'ListPickerWindow', 'YesNoBoxWindow', 'egStartListDoors', 'egStartAsk',
    `${slot}\nreturn { ...${doors}, ask: ${ask} };`)(modes, tt, listPickerArtLoaded, ListPickerWindow, YesNoBoxWindow, egStartListDoors, egStartAsk);
  const log = [];
  const open = (o = {}) => openEgStartWindow({ keys: 3, me: ME, members: [{ sub: ME, name: 'Mac' }], starts: { [ME]: [7, 0] }, rehearsal: true, questDue: false, ...o,
    ...hostDoors, onChoose: (c) => log.push(['choose', c]), onCancel: () => log.push('cancel') });
  const key = (code) => tt.keydown({ code, key: code, preventDefault() {}, target: null });
  /** The enhanced row press on row `i` of the list in the slot: pickRow's two replayed presses (PointerEvent stood in). */
  const tap = (i) => {
    const P = globalThis.PointerEvent;
    globalThis.PointerEvent = class { constructor(type, init) { this.type = type; Object.assign(this, init); } };
    try { pickRow({ picker: tt.overlay, canvas, m: nativeMetrics(canvas) }, i, { x: PICKER_X, y: PICKER_Y, list: PICKER_RECTS.list }); } finally { globalThis.PointerEvent = P; }
  };
  return { tt, log, open, key, tap, presses };
}

test('STAKE-ROW: the stake picked - a tap (the enhanced row press: its first press selects, its second uses), on a list undrawn and on one drawn in FONT0003, Enter on the first selection, `1`, Up then Enter - leaves a new list in the slot, the window still asking, nothing chosen or cancelled; Hall 1 picked after it is the choice (mutants: the bare return - no window, the flow left asking; pickRow\'s point a row low; one press)', async () => {
  const drives = {
    'a tap': (h) => h.tap(0),
    'a tap on a drawn list': (h) => { h.tt.overlay._font = { fnt: { fixedHeight: 7 } }; h.tap(0); },   // FONT0003's rows: draw latches the host's font
    Enter: (h) => h.key('Enter'),
    '1': (h) => h.key('Digit1'),
    'Up then Enter': (h) => { h.key('ArrowUp'); h.key('Enter'); },
  };
  for (const [name, drive] of Object.entries(drives)) {
    const h = street();
    const w = h.open();
    const first = h.tt.overlay;
    assert.ok(first instanceof ListPickerWindow, `${name}: the list in the slot`);
    assert.equal(first.items[0], EG_TEXT.stake(3), 'the top row is the stake');
    assert.equal(first.selectedIndex, 0, 'the picker opens on its first row');
    drive(h);
    if (name.startsWith('a tap')) {
      assert.equal(h.presses.length, 2, `${name}: two presses`);
      assert.deepEqual(h.presses[0], { win: first, done: false, sel: 0 }, `${name}: the first press only selects the stake`);
    }
    await tick();
    assert.equal(first.done, true, `${name}: the picker closed itself on the pick`);
    const again = h.tt.overlay;
    assert.ok(again instanceof ListPickerWindow && again !== first && !again.done, `${name}: a list in the slot again`);
    assert.deepEqual(again.items, first.items, 'the same rows');
    assert.equal(w.state().done, false, 'the window still asks');
    assert.deepEqual(h.log, [], 'nothing chosen, nothing cancelled');
    h.key('ArrowDown'); h.key('ArrowDown'); h.key('Enter');
    await tick();
    assert.deepEqual(h.log, [['choose', { ew: 0, wg: [], rh: false }]], `${name}: Hall 1 after it is the choice`);
    assert.equal(h.tt.overlay, null, 'the slot empty');
  }
});

test('STAKE-ROW: the keyless line and the quest warning are words as the stake is - picked, the list again; Escape after it is the cancel, told once however many doors call it (mutant: the cancel unguarded)', async () => {
  for (const o of [{ keys: 0 }, { questDue: true }]) {
    const h = street();
    const w = h.open(o);
    const first = h.tt.overlay;
    const row = o.keys === 0 ? 0 : 1;
    assert.equal(first.items[row], o.keys === 0 ? EG_TEXT.noKeys : EG_TEXT.questDue);
    for (let i = 0; i < row; i++) h.key('ArrowDown');
    h.key('Enter');
    await tick();
    assert.ok(h.tt.overlay instanceof ListPickerWindow && h.tt.overlay !== first && !h.tt.overlay.done, 'a list in the slot again');
    assert.equal(w.state().done, false);
    h.key('Escape');
    await tick();
    assert.deepEqual(h.log, ['cancel']);
    first.onCancel();   // the old list's door, called late
    assert.deepEqual(h.log, ['cancel'], 'told once');
    assert.equal(h.tt.overlay, null);
    assert.equal(w.state().done, true);
  }
});

test('AUDIT STAKE-ROW L1-1: "Go without Mara?" answered No brings the list back - its box still holds the slot as it answers, and the list\'s door gives a finished window up before it mounts; Yes is the choice (mutant: no give-up - the list refused, the window cancelled unsaid)', async () => {
  const h = street();
  const w = h.open({ members: [{ sub: ME, name: 'Mac' }, { sub: 'acct-mara', name: 'Mara' }], starts: { [ME]: [7, 0], 'acct-mara': [0] } });
  assert.equal(h.tt.overlay.items[1], 'Redoubt 7 - the Soul Cairn [+x]');
  h.key('ArrowDown'); h.key('Enter');
  await tick();
  assert.ok(h.tt.overlay instanceof YesNoBoxWindow, 'asked');
  assert.deepEqual(h.tt.overlay.rows, ['Go without Mara?']);
  h.key('KeyN');
  await tick();
  assert.ok(h.tt.overlay instanceof ListPickerWindow && !h.tt.overlay.done, 'No: the list again');
  assert.equal(w.state().done, false);
  assert.deepEqual(h.log, []);
  h.key('ArrowDown'); h.key('Enter');
  await tick();
  h.key('KeyY');
  await tick();
  assert.deepEqual(h.log, [['choose', { ew: 7, wg: [], rh: false }]], 'Yes: the choice');
  assert.equal(h.tt.overlay, null);
});

test('AUDIT STAKE-ROW L1-U1, L2-3: the list\'s doors - a list put off the screen unpicked cancels the window once; a mount refused, or no list to ask with, cancels it on the next tick (mutants: no leave guard; a refused mount or a missing list said nothing)', async () => {
  let h = street();
  let w = h.open();
  const first = h.tt.overlay;
  const other = { draw() {}, input() {}, done: false };
  h.tt.showOverlay(other);   // another window takes the slot (townTalk disposes the outgoing occupant and tells it nothing)
  assert.deepEqual(h.log, ['cancel'], 'put off the screen: the window cancelled');
  assert.equal(w.state().done, true);
  assert.equal(h.tt.overlay, other, 'the other window keeps its slot');
  first.dispose();
  assert.deepEqual(h.log, ['cancel'], 'once');
  // ...and once at the door itself, whatever its occupant guards
  let told = 0;
  const lone = egStartListDoors({ ready: () => true, makeList: () => ({}), slot: { top: () => null, mount: () => true, close() {} } }).openList([], () => {}, () => told++);
  lone.dispose(); lone.dispose();
  assert.equal(told, 1, 'the door tells a leave once');
  h = street();
  h.tt.showOverlay({ draw() {}, input() {}, done: false });   // a live window holds the screen
  w = h.open();
  assert.deepEqual(h.log, [], 'refused: nothing yet');
  await tick();
  assert.deepEqual(h.log, ['cancel'], 'a refused mount cancels the window on the next tick');
  assert.equal(w.state().done, true);
  h = street();
  _setListPickerArtForTests(null);
  w = h.open();
  await tick();
  assert.deepEqual(h.log, ['cancel'], 'no list to ask with: cancelled');
  assert.equal(h.tt.overlay, null);
});

test('AUDIT STAKE-ROW L1-2: the Weir Key used from the pack closes the pack when its start window will ask (the opener\'s empty line), so the window has the screen; a line said leaves the pack up, and the enhanced pack reads the close (mutant: the pack left up - the window refused, unsaid)', () => {
  const entity = { items: [], wagonItems: [] };
  const use = () => useItem(weirKeys(1), entity.items, { entity });
  try {
    setWeirKeyOpener(() => '');
    assert.deepEqual(use(), { kind: 'text', text: '', closesWindow: true }, 'the window will ask: the pack closes');
    setWeirKeyOpener(() => EG_TEXT.opening);
    assert.deepEqual(use(), { kind: 'text', text: EG_TEXT.opening, closesWindow: false }, 'a line: the pack shows it');
    setWeirKeyOpener(null);
    assert.deepEqual(use(), { kind: 'text', text: EG_TEXT.cold, closesWindow: false }, 'no opener: cold');
    setWeirKeyOpener(() => '');
    assert.equal(useResultAction(use()).closesWindow, true, 'the enhanced pack closes on it');
  } finally { setWeirKeyOpener(null); }
});
