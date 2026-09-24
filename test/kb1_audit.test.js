// AUDIT KB1 (2026-09-24, Mac: "Audit this before we merge"): THREE LENSES OVER THE KEYBINDING STANDARD, every
// finding paid and pinned here BY EXECUTION.
//
//  - the REGISTRY lens (systems/inputActions.js, systems/controlsConfig.js, the three Controls windows):
//      F1/F2 the v1 carry brought a mod's old key in BEFORE the standard's defaults stood, so it took a live
//            action's new key (a torch key saved as E took E from Interact; an old Travel Options G, the mod off, took
//            G from the torch drop) and the loser was never named;
//      F3    E let go of AbortSpell whether or not Backquote could take it - the abort lost without a word - and a
//            file with a hidden action on another key kept it there;
//      F4    Yes on the replace prompt left the old holder UNMARKED when it came later in ACTIONS than the new
//            action, so its default came back at the next boot;
//      F5    the prompt read "holds this key" as code equality, so a combo against a bare modifier (DFU's clash)
//            got the red colour instead of the question;
//      F6    a key moving between an action's own two slots read "used by Jump. Give it to Jump?";
//      +     the classic grid and the mouse popup still let a key be bound to the two HIDDEN actions.
//  - the UI lens (the windows, the pad, the chat):
//      1 the chat's claim on Enter stood for the panel's life, so with the chat HIDDEN Enter did nothing at all;
//      2 a held CastSpell flickered the enhanced book open-shut on the auto-repeat;
//      3 a window opened by a combo could not be closed by it (the bare code read);
//      4 Escape on the pane's prompt fell through to the menu's back stack and discarded every staged bind;
//      5 a hotbar slot bound to a mouse button never pressed;
//      6 the pad opened the classic pause / pack / rest windows and could not close them (the primary alone read);
//      7 a key's auto-repeat answered the classic windows' prompts.
//  - the HOSTS lens (the scenes, the listeners):
//      1 F8 in an automap changed its background AND took a screenshot (a listener of its own over every window);
//      2 the E that closed a mode window was also the next frame's Interact press - the window opened again;
//      3 the screenshot's blob URL was revoked at 0 ms;
//      4 the hotbar's and the screenshot's reads wrote the host's modifier latch from a made-up ring.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createBindings, resetDefaults, loadKeyBinds, serializeKeyBinds, migrateKeyBinds, getBinding, actionForCode,
  setBinding, comboCode, modifierHeldFirstDict, KEYBINDS_VERSION, loadOrCreateBindings,
} from '../src/systems/inputActions.js';
import {
  setBindings, eventAction, routeKey, setKeybindNoticeSink,
} from '../src/ui/input.js';
import {
  createUnsavedKeybinds, bindingHolders, replaceKeybindPromptRows, stageReplace, applyUnsavedKeybinds,
  currentDict, keybindCarryNotes,
} from '../src/systems/controlsConfig.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { hudTextWhenShown, hudText, registerPresenter, _resetNotifyForTests } from '../src/systems/notify.js';
import { bindCursorToggle, cursorActive, setCursorActive } from '../src/player/pointerLock.js';
import { createChatPanel } from '../src/ui/chatPanel.js';
import { ChatLog } from '../src/net/chat.js';
import { ControlsWindow } from '../src/ui/controlsWindow.js';
import { MouseControlsWindow, KEYBIND_ROWS, toNative } from '../src/ui/mouseControlsWindow.js';
import { PauseOptionsWindow } from '../src/ui/pauseWindow.js';
import { NativeInventoryWindow } from '../src/ui/nativeInventory.js';
import { takeScreenshot, REVOKE_AFTER_MS } from '../src/ui/screenshot.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const defaults = () => { const s = createBindings(); resetDefaults(s); return s; };

/** A v1 file (no version field): the DFU rows the standard moved, the port rows it added not yet there. */
function v1File(edit = () => {}) {
  const s = createBindings();
  resetDefaults(s);
  for (const code of ['KeyE', 'Tab', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'KeyO', 'KeyG', 'KeyX', 'KeyB', 'NumpadAdd', 'KeyK', 'Comma', 'Period', 'Backquote']) s.primary.delete(code);
  s.primary.set('KeyE', 'AbortSpell'); s.primary.set('Backquote', 'ToggleConsole'); s.primary.set('ControlLeft', 'Slide');
  edit(s);
  const file = serializeKeyBinds(s);
  delete file.version;
  return file;
}
function withLocalStorage(fn) {
  const prev = globalThis.localStorage;
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  try { _resetModSettings(); return fn(store); } finally {
    _resetModSettings();
    if (prev === undefined) delete globalThis.localStorage; else globalThis.localStorage = prev;
  }
}
const carry = (file) => { const s = createBindings(); loadKeyBinds(s, file); const r = migrateKeyBinds(s, 1); resetDefaults(s, true); return [s, r]; };

// ── THE REGISTRY LENS ──────────────────────────────────────────────────

test('AUDIT KB1 F1/F2: a mod\'s old key comes in AFTER the standard\'s defaults, onto a key still free - it never takes a live action\'s key, and the choice that could not land is reported (mutants: the carry before the autofill; the kept report dropped)', () => {
  withLocalStorage((ls) => {
    ls.set('dfjs-mod-settings', JSON.stringify({
      'handheld-torches': { 'Handling.ToggleLightInput': 'E', 'Handling.ManualDropInput': 'Tab' },   // E: Interact's now; Tab: a value the PORT shipped (HT4), no choice of the player's - nothing to carry, nothing to say
      'travel-options': { Enabled: false, 'RoadsIntegration.FollowPathsKey': 2 }, // G: the torch drop's, the mod off
      'horse-cart-and-cargo': { 'Hotkeys.QuickMountDismount': 'Alpha7' },       // 7: Hotbar7's
    }));
    const [s, r] = carry(v1File());
    assert.equal(actionForCode(s, 'KeyE'), 'Interact', 'E interacts - the torch did not take it');
    assert.equal(getBinding(s, 'TorchToggleLight'), 'KeyO', '...the torch keeps its new default');
    assert.equal(actionForCode(s, 'KeyG'), 'TorchDrop', 'G drops the torch - a switched-off mod\'s old key took nothing');
    assert.equal(actionForCode(s, 'Digit7'), 'Hotbar7');
    assert.equal(getBinding(s, 'HorseMount'), 'Comma');
    assert.deepEqual(r.kept.map((k) => [k.action, k.code, k.holder]).sort(), [
      ['FollowPaths', 'KeyG', 'TorchDrop'], ['HorseMount', 'Digit7', 'Hotbar7'], ['TorchToggleLight', 'KeyE', 'Interact'],
    ], 'every choice that could not land is named, with who holds its key - and a shipped value is no choice, so it is not');
    assert.deepEqual(r.lost, [], 'and no action is left keyless');
  });
});

test('AUDIT KB1 F3: an action the carry leaves keyless is REPORTED - the abort when Backquote is the player\'s, the dial when Tab is - and a hidden action lets go of ANY key (mutants: E freed silently; the hidden release limited to its old default)', () => {
  withLocalStorage(() => {
    const [s, r] = carry(v1File((f) => { f.primary.delete('Backquote'); f.primary.set('Backquote', 'QuickSave'); f.primary.delete('F9'); f.primary.set('Tab', 'AutoMap'); f.primary.delete('KeyM'); }));
    assert.equal(actionForCode(s, 'KeyE'), 'Interact', 'E still interacts (Mac\'s call)');
    assert.equal(actionForCode(s, 'Backquote'), 'QuickSave', 'the player\'s own Backquote is theirs');
    assert.deepEqual(r.lost.find((l) => l.action === 'AbortSpell'), { action: 'AbortSpell', code: 'Backquote', holder: 'QuickSave' });
    assert.deepEqual(r.lost.find((l) => l.action === 'QuickDial'), { action: 'QuickDial', code: 'Tab', holder: 'AutoMap' });
    const [s2, r2] = carry(v1File((f) => { f.primary.delete('Tab'); f.primary.set('Tab', 'ToggleConsole'); f.primary.delete('Backquote'); }));
    assert.equal(getBinding(s2, 'ToggleConsole'), null, 'the console lets go of Tab...');
    assert.equal(actionForCode(s2, 'Tab'), 'QuickDial', '...and the dial lands where it stood');
    assert.ok(r2.moved.includes('ToggleConsole off Tab'));
    assert.equal(r2.lost.length, 0);
  });
});

test('AUDIT KB1 F3: the report reaches the PLAYER - one HUD line per action, a mod\'s only while it is on, and a line said before any host stands waits for the first one (mutants: the lines to the console only; the wait dropped)', () => {
  const lines = keybindCarryNotes({
    lost: [{ action: 'AbortSpell', code: 'Backquote', holder: 'QuickSave' }],
    kept: [{ action: 'TorchToggleLight', code: 'KeyE', holder: 'Interact' }, { action: 'HorseMount', code: 'Digit7', holder: 'Hotbar7' }],
  }, (a) => a !== 'HorseMount');
  assert.equal(lines.length, 2, 'the switched-off mod\'s line is not said');
  assert.match(lines[0], /^Drop the readied spell has no key: .* is Quick save's\. Set one in Controls\.$/);
  assert.match(lines[1], /^Light or douse \(Handheld Torches\) stays on its new key: E is Interact's\. Change it in Controls\.$/);
  _resetNotifyForTests();
  try {
    hudTextWhenShown('first'); hudTextWhenShown('second');
    const said = [];
    registerPresenter({ hudText: (t) => { said.push(t); return true; } });
    assert.deepEqual(said, ['first', 'second'], 'spoken, in order, at the first host that can');
    hudText('third');
    assert.deepEqual(said, ['first', 'second', 'third'], 'and never twice');
  } finally { _resetNotifyForTests(); }
  // the loader leaves the report on the store, and the sink hands it over ONCE
  withLocalStorage((ls) => {
    ls.set('dagger.keybinds', JSON.stringify(v1File((f) => { f.primary.delete('Backquote'); f.primary.set('Backquote', 'QuickSave'); f.primary.delete('F9'); })));
    const info = console.info; console.info = () => {};
    try {
      const s = loadOrCreateBindings();
      assert.equal(JSON.parse(ls.get('dagger.keybinds')).version, KEYBINDS_VERSION);
      assert.ok(s.carried?.lost.some((l) => l.action === 'AbortSpell'));
      setBindings(s);
      const got = [];
      setKeybindNoticeSink((r) => got.push(r));
      setKeybindNoticeSink((r) => got.push(r));
      assert.equal(got.length, 1, 'delivered once');
    } finally { console.info = info; setKeybindNoticeSink(null); setBindings(null); }
  });
  assert.match(rd('src/main.js'), /input\.setKeybindNoticeSink\(\(report\) => \{ for \(const line of cfg\.keybindCarryNotes\(report\)\) notify\.hudTextWhenShown\(line, 12\); \}\)/, 'the composition root wires the report to the HUD');
});

test('AUDIT KB1 F4: Yes on the replace prompt keeps the old holder unbound across a reboot, whatever order ACTIONS walks them in (mutant: "differs" read off the half-applied store)', () => {
  const store = defaults();
  const u = createUnsavedKeybinds(store);
  const holders = bindingHolders(u, 'Jump', 'KeyE');
  assert.deepEqual(holders, [{ action: 'Interact', primary: true }]);
  stageReplace(u, 'Jump', 'KeyE', holders);   // Jump is early in ACTIONS, Interact late
  applyUnsavedKeybinds(store, u);
  assert.equal(getBinding(store, 'Jump'), 'KeyE');
  assert.equal(getBinding(store, 'Interact'), null);
  assert.ok(store.removedPrimary.has('Interact'), 'marked, so the autofill leaves it be');
  const next = createBindings();
  loadKeyBinds(next, serializeKeyBinds(store));
  resetDefaults(next, true);
  assert.equal(getBinding(next, 'Interact'), null, 'the next boot does not bring it back');
});

test('AUDIT KB1 F5/F6: the prompt asks under DFU\'s own clash law - a combo against a bare modifier, both ways, every holder named and cleared - and a key moving between an action\'s own slots says so (mutants: code equality; one holder kept)', () => {
  const store = defaults();
  const u = createUnsavedKeybinds(store);
  assert.deepEqual(bindingHolders(u, 'Inventory', comboCode('ShiftLeft', 'KeyT')), [{ action: 'Run', primary: true }], 'Shift+T against Run\'s bare Shift');
  u.primary.set('Inventory', comboCode('ControlLeft', 'KeyT'));
  u.primary.set('Status', comboCode('ControlLeft', 'KeyY'));
  const both = bindingHolders(u, 'Sneak', 'ControlLeft');
  assert.deepEqual(both.map((h) => h.action).sort(), ['Inventory', 'Status'], 'a bare modifier against every combo it heads');
  assert.deepEqual(replaceKeybindPromptRows('Sneak', 'ControlLeft', both).length, 2);
  stageReplace(u, 'Sneak', 'ControlLeft', both);
  assert.equal(u.primary.get('Inventory'), null); assert.equal(u.primary.get('Status'), null);
  u.usingPrimary = false;
  const own = bindingHolders(u, 'Jump', 'Space');
  assert.deepEqual(own, [{ action: 'Jump', primary: true }]);
  assert.deepEqual(replaceKeybindPromptRows('Jump', 'Space', own, false), ['SPACE is already Jump\'s primary key.', 'Make it the secondary key instead?']);
});

test('AUDIT KB1: the classic grid and the mouse popup draw no bindable slot for the two HIDDEN actions (mutant: the filter dropped)', () => {
  setBindings(defaults());
  try {
    const grid = new ControlsWindow({});
    assert.equal(grid.buttons.some((b) => b.action === 'Slide'), false, 'Slide has no button');
    const pop = new MouseControlsWindow(createUnsavedKeybinds(defaults()));
    const row = KEYBIND_ROWS.find((r) => r.action === 'ToggleConsole');
    const [x, y, w, h] = toNative(MouseControlsWindow.rowButtonRect(row));
    pop.click(x + w / 2, y + h / 2);
    assert.equal(pop.capture, null, 'the Console row arms no capture');
  } finally { setBindings(null); }
});

// ── THE UI LENS ────────────────────────────────────────────────────────

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '',
    style: {}, dataset: {}, attrs: {}, listeners: new Map(), focused: false, scrollTop: 0, scrollHeight: 100, clientHeight: 100,
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener() {},
    focus() { n.focused = true; doc.activeElement = n; },
    blur() { n.focused = false; },
    remove() { n.removed = true; },
  };
  return n;
}
function fakeDocument() {
  const doc = { activeElement: null };
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  doc.getElementById = () => null;
  return doc;
}

test('AUDIT KB1 (UI 1): online, Enter opens the chat and leaves the mouse; with the chat HIDDEN it frees the mouse as DFU\'s Enter does - the claim is per press (mutant: the claim for the panel\'s life)', () => {
  setBindings(defaults());
  const listeners = [];
  const prevAdd = globalThis.addEventListener;
  // ONE window, both listeners on its capture phase in registration order - the toggle first (host boot), the chat after
  globalThis.addEventListener = (t, fn, cap) => { if (t === 'keydown') listeners.push({ fn, cap: !!cap }); };
  const win = { addEventListener: (t, fn, cap) => { if (t === 'keydown') listeners.push({ fn, cap: !!cap }); }, removeEventListener() {} };
  const fire = (code) => {
    const ev = { code, key: code, isTrusted: true, target: { tagName: 'CANVAS' }, stopped: false, immediate: false,
      preventDefault() {}, stopPropagation() { ev.stopped = true; }, stopImmediatePropagation() { ev.stopped = ev.immediate = true; } };
    for (const l of listeners) { if (ev.immediate) break; if (l.cap) l.fn(ev); }
    return ev;
  };
  try {
    bindCursorToggle({ requestPointerLock() { return Promise.resolve(); } }, () => false, (e) => (e.code === 'Enter' ? 'ActivateCursor' : e.code === 'KeyY' ? 'FreeMouse' : null));
    const log = new ChatLog();
    const panel = createChatPanel({ log, onSend() {}, action: (e) => (e.code === 'Enter' ? 'ActivateCursor' : null), overlay: () => false, doc: fakeDocument(), win, touch: false });
    setCursorActive(false);
    fire('Enter');
    assert.equal(log.open, true, 'the chat opened');
    assert.equal(cursorActive(), false, 'and the mouse did not also free');
    panel.setHidden(true);
    assert.equal(log.open, false);
    fire('Enter');
    assert.equal(log.open, false, 'hidden: the chat stays put away (CHAT-R2)...');
    assert.equal(cursorActive(), true, '...and Enter is the game\'s again - the mouse frees');
    panel.destroy();
  } finally {
    if (prevAdd === undefined) delete globalThis.addEventListener; else globalThis.addEventListener = prevAdd;
    setCursorActive(false);
    setBindings(null);
  }
});

const mkEl = (tag = 'div') => ({
  tag, tagName: tag.toUpperCase(), className: '', textContent: '', id: '', children: [], dataset: {}, onclick: null, alt: '', draggable: true,
  get innerHTML() { return ''; }, set innerHTML(v) { this.children = []; },
  style: { setProperty() {}, removeProperty() {} },
  classList: { _s: new Set(), add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); }, toggle(c, on) { return !!on; }, contains(c) { return this._s.has(c); } },
  attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; }, removeAttribute() {}, remove() {},
  append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; }, replaceChildren(...c) { this.children = c; },
  addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, focus() {}, contains() { return false; },
});
function withDom(fn) {
  const wl = [];
  const prevDoc = globalThis.document; const prevWin = globalThis.window;
  globalThis.document = { createElement: mkEl, createTextNode: (t) => ({ text: t }), getElementById: () => null, head: mkEl('head'), body: mkEl('body'), fonts: { add() {} }, addEventListener() {}, removeEventListener() {}, pointerLockElement: null };
  globalThis.window = { addEventListener: (t, f) => wl.push({ t, f }), removeEventListener() {} };
  return Promise.resolve(fn(wl)).finally(() => {
    if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
    if (prevWin === undefined) delete globalThis.window; else globalThis.window = prevWin;
  });
}
const keyEv = (code, extra = {}) => ({ code, key: code, repeat: false, target: { tagName: 'CANVAS' }, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, stopImmediatePropagation() { this.stopped = true; }, ...extra });

// (before the book: the enhanced book registers as a drop owner of the bar, and a drop owner stands the bar's keys
// down - the order the real game has too, where the book is never up while the world has the mouse)
test('AUDIT KB1 (UI 5): a hotbar slot bound to a mouse button presses it while the game has the mouse, and the hosts never see that button (mutants: no mouse listener; the press through a freed cursor)', async () => {
  const store = defaults();
  setBinding(store, 'Mouse2', 'Hotbar7');
  setBindings(store);
  const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
  try {
    await withDom(async (wl) => {
      _resetForTests();
      setPref('quickbarStyle', 'hotbar');
      const hb = await import('../src/ui/enhancedHotbar.js');
      hb.mountHotbarDock(mkEl('div'));
      hb.drawEnhancedHotbar(null, { paused: false });
      const down = wl.filter((l) => l.t === 'mousedown');
      assert.equal(down.length, 1, 'the bar listens for buttons');
      const ev = (extra = {}) => ({ button: 1, preventDefault() {}, stopImmediatePropagation() { this.stopped = true; }, ...extra });
      const freed = ev();
      down[0].f(freed);
      assert.equal(freed.stopped, undefined, 'a click with the cursor free is the page\'s');
      globalThis.document.pointerLockElement = {};
      const locked = ev();
      down[0].f(locked);
      assert.equal(locked.stopped, true, 'locked: the middle button is slot 7\'s, and the hosts never see it');
      const other = ev({ button: 0 });
      down[0].f(other);
      assert.equal(other.stopped, undefined, 'a button that is no slot is left alone');
    });
  } finally { _resetForTests(); setBindings(null); }
});

test('AUDIT KB1 (UI 2/3): the enhanced book closes on its key\'s PRESS - a held key\'s repeat is swallowed, not an open-shut flicker - and on a combo it was opened by (mutants: the repeat closes; the bare code read)', async () => {
  const store = defaults();
  setBindings(store);
  try {
    await withDom(async (wl) => {
      const { mountEnhancedSpellbook } = await import('../src/ui/enhancedSpellbook.js');
      let exits = 0;
      mountEnhancedSpellbook(mkEl('div'), { spells: () => [], castCost: () => 0, entity: { magicka: 1 }, onExit: () => { exits++; } });
      const send = (ev) => { for (const l of wl) if (l.t === 'keydown') l.f(ev); return ev; };
      const rep = send(keyEv('Backspace', { repeat: true }));
      assert.equal(exits, 0, 'the repeat closes nothing...');
      assert.equal(rep.stopped, true, '...and is swallowed, so the host cannot re-open under it');
      send(keyEv('Backspace'));
      assert.equal(exits, 1, 'the press closes');
      setBinding(store, comboCode('ShiftLeft', 'KeyB'), 'CastSpell');
      const n = wl.length;
      mountEnhancedSpellbook(mkEl('div'), { spells: () => [], castCost: () => 0, entity: { magicka: 1 }, onExit: () => { exits++; } });
      for (const l of wl.slice(n)) if (l.t === 'keydown') l.f(keyEv('KeyB', { shiftKey: true }));   // the second mount's own listener (this fake window never removes the first's)
      assert.equal(exits, 2, 'Shift+B closes the book Shift+B opened');
    });
  } finally { setBindings(null); }
});

test('AUDIT KB1 (UI 3 + hosts 4): eventAction reads the event\'s own flags and both dicts, and writes NOTHING - the host\'s modifier latch is the host\'s (mutants: the bare code read; a made-up ring handed to the latch)', () => {
  const store = defaults();
  setBinding(store, comboCode('ShiftLeft', 'KeyQ'), 'QuickDial');
  setBindings(store);
  try {
    const before = JSON.stringify([...modifierHeldFirstDict(store)]);
    assert.equal(eventAction({ code: 'KeyQ', shiftKey: true }), 'QuickDial', 'the combo');
    assert.equal(eventAction({ code: 'KeyQ' }), 'RecastSpell', 'the bare key');
    assert.equal(eventAction({ code: 'JoystickButton6' }), 'Inventory', 'a pad button (a secondary)');
    assert.equal(eventAction({ code: 'KeyZ', shiftKey: true }), 'ReadyWeapon', 'a modifier with no combo bound leaves the plain key');
    assert.equal(JSON.stringify([...modifierHeldFirstDict(store)]), before, 'the latch is untouched');
    for (const f of ['src/ui/enhancedHotbar.js', 'src/ui/pixelDial.js', 'src/ui/enhancedOverlays.js', 'src/ui/enhancedSpellbook.js', 'src/ui/enhancedChronicle.js', 'src/ui/charSheetDoor.js', 'src/ui/enhancedInventory.js']) {
      assert.doesNotMatch(rd(f), /actionOf\(e(, eventModifiers\(e\))?\)/, `${f} reads the event through eventAction`);
    }
  } finally { setBindings(null); }
});

test('AUDIT KB1 (UI 4): Escape on the Controls pane\'s prompt answers No - the menu\'s back stack asks the pane before it leaves the section (mutant: the arm dropped, so Escape discards every staged bind)', () => {
  const m = rd('src/ui/enhancedMenu.js');
  const arm = m.indexOf(': controlsPromptOpen() ? () => dismissControlsPrompt()');
  assert.ok(arm > 0 && arm < m.indexOf(": section !== 'home' ? () => go('home')"), 'the prompt is answered before the section is left');
});

test('AUDIT KB1 (UI 6): the pad\'s button closes the classic window it opened - the pause on Menu, the pack on View (mutant: the primary alone read)', () => {
  setBindings(defaults());
  try {
    const pause = new PauseOptionsWindow({});
    pause.input('JoystickButton7'); pause.keyup('JoystickButton7');
    assert.equal(pause.done, true, 'Menu closes the pause');
    const inv = new NativeInventoryWindow({ items: () => [], entity: { items: [], equip: { slots: {} } } });
    inv.input('JoystickButton6');
    assert.equal(inv.done, true, 'View closes the pack');
    assert.match(rd('src/ui/restWindow.js'), /this\.toggleClosedSecondary = getBinding\(bindings\(\), 'Rest', false\);/, 'and the rest window the same way');
  } finally { setBindings(null); }
});

test('AUDIT KB1 (UI 7): a key\'s auto-repeat does not answer the classic windows\' prompt - the PRESS does (mutant: the repeat guard dropped)', () => {
  setBindings(defaults());
  try {
    const grid = new ControlsWindow({});
    const jump = grid.buttons.find((b) => b.action === 'Jump');
    grid.click(jump.x + 1, jump.y + 1);
    grid.input('KeyE');
    assert.equal(grid.top, 'replace', 'E is Interact\'s - asked');
    grid.input('KeyY', { repeat: true });
    grid.input('Escape', { repeat: true });
    assert.equal(grid.top, 'replace', 'repeats answer nothing');
    grid.input('KeyN');
    assert.equal(grid.top, null, 'the press does');
    assert.equal(currentDict(grid.unsaved).get('Interact'), 'KeyE');
  } finally { setBindings(null); }
});

// ── THE HOSTS LENS ─────────────────────────────────────────────────────

test('AUDIT KB1 (hosts 1): F8 under a window is the window\'s - the automap\'s third background - and routed actions answer the PRESS only (mutants: a screenshot listener over every window; the repeat routed)', () => {
  setBindings(defaults());
  try {
    const under = [];
    assert.equal(routeKey(keyEv('F8'), { uiOverlayActive: true, overlayIsNative: true, overlayInput: (c) => under.push(c) }), true);
    assert.deepEqual(under, ['F8']);
    let saves = 0;
    const world = { uiOverlayActive: false, quickSave: () => { saves++; } };
    routeKey(keyEv('F9'), world);
    routeKey(keyEv('F9', { repeat: true }), world);
    routeKey(keyEv('F9', { repeat: true }), world);
    assert.equal(saves, 1, 'a held F9 saves once');
    assert.equal(rd('src/ui/screenshot.js').includes("addEventListener('keydown'"), false, 'no listener of its own');
    for (const h of ['world.js', 'exterior.js']) {
      assert.match(rd(`src/scenes/${h}`), /else if \(e\.repeat\) \{ e\.preventDefault\(\); return; \}[^\n]*\n\s*else if \(routeAction\(act, hudCtx\)\)/, `${h}'s own ladder takes the press alone`);
    }
  } finally { setBindings(null); }
});

test('AUDIT KB1 (hosts 2): a key a window takes joins no ring - the E that closes a shop is not the next frame\'s Interact (mutant: the ring filled under the mode\'s window)', () => {
  for (const h of ['world.js', 'exterior.js']) {
    assert.match(rd(`src/scenes/${h}`), /if \(!modes\?\.overlayHeld\) \{\n\s*keys\.add\(e\.code\);\n\s*noteKeyDown\(latch\.edge, e\.code, e\.repeat\);/, `${h}`);
  }
  assert.match(rd('src/scenes/dungeon.js'), /if \(!ctx\.uiOverlayActive\) \{\n\s*keys\.add\(e\.code\);\n\s*noteKeyDown\(keyEdge, e\.code, e\.repeat\);/, 'dungeon.js');
});

test('AUDIT KB1 (hosts 3): the screenshot\'s blob URL outlives the download\'s start (mutant: revoked at 0 ms)', async () => {
  const prevURL = globalThis.URL;
  const delays = [];
  globalThis.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
  try {
    const doc = { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } };
    const name = await takeScreenshot({ toBlob: (cb) => cb({}) }, { raf: null, doc, later: (fn, ms) => delays.push(ms) });
    assert.match(name, /^daggerfall-\d{8}-\d{6}\.png$/);
    assert.deepEqual(delays, [REVOKE_AFTER_MS]);
    assert.ok(REVOKE_AFTER_MS >= 30_000);
  } finally { globalThis.URL = prevURL; }
});
