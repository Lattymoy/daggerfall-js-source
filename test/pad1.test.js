// PAD1 (2026-09-21, Mac: "a comprehensive pass on m/kb keybinds and
// controller support. Ensuring all mods and keybinds are supported
// (including the quickbar)"). The map first: forty-nine actions in one
// registry, two dicts (DFU's primary and secondary), pad buttons as keys
// (GP1 synthesises a keydown by Unity name), a joystick UI dict for the
// clicks, two controls screens with the primary/secondary toggle, and
// five mod keys read as TextKeys through one KeyCode table. Four gaps:
//
//  A. THE ENHANCED PANE COULD NOT BIND A PAD BUTTON. The poller
//     dispatched its synthetic keydown on the WINDOW; the pane's capture
//     listens on the DOCUMENT. A window-targeted event has a path of one
//     and never reaches a document listener (proved in Chromium:
//     tools/padDispatchProbe.mjs). The hosts listen on the window and
//     saw every button, which is why nothing looked broken. Dispatch on
//     the document: its listeners first, then the window's by bubbling.
//  B. A MOD KEY COULD NOT NAME A PAD BUTTON. The KeyCode table carried no
//     JoystickButtonN, so the mod pane refused the capture as a key Unity
//     has no member for - false; Unity names twenty. Handheld Torches'
//     drop and throw and Eye of the Beholder's two keys had no pad at all.
//  C. NO PAD DEFAULTS FOR ANY ACTION (DFU's own state): a pad moved,
//     looked and clicked, and could not jump, crouch, pause, open the
//     pack, the spellbook or a quickslot until each was bound by hand.
//     Twelve rows in the SECONDARY dict now, filled by the autofill law
//     alone, with a removedSecondary mark mirroring DFU's removedPrimary
//     so a cleared row stays cleared. A Ledger A departure - DEFAULTS ONLY.
//  D. NO GLYPH FOR A D-PAD OR TRIGGER, so a quickslot on the d-pad would
//     have printed its raw axis-key name on the HUD.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACTIONS, DEFAULT_BINDINGS, DEFAULT_SECONDARY_BINDINGS, createBindings, resetDefaults, setBinding, clearBinding,
  getBinding, addRemovedSecondaryAction, serializeKeyBinds, loadKeyBinds,
} from '../src/systems/inputActions.js';

import { DEFAULT_JOYSTICK_UI, STANDARD_TO_UNITY_BUTTON, isAxisKeyName } from '../src/systems/gamepad.js';
import { domCodeForKeyCode, keyCodeForDomCode, isBindableKeyCode } from '../src/systems/keyCodes.js';
import { setBindings, held, QUICKSLOT_ACTIONS } from '../src/ui/input.js';
import { createUnsavedKeybinds, applyUnsavedKeybinds } from '../src/systems/controlsConfig.js';
import { PAD_GLYPHS, GLYPH_AXIS_KEYS, PAD_FAMILIES, GLYPH_SIZE, unityButtonGlyph } from '../src/ui/padGlyphs.js';
import { quickslotTag } from '../src/ui/quickslotTags.js';
import { attachGamepad } from '../src/ui/gamepadInput.js';
import { _resetForTests } from '../src/systems/settings.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const PAD_CODE = (c) => /^JoystickButton\d+$/.test(c) || isAxisKeyName(c);

test('PAD1-A the poller dispatches its synthetic keys on the DOCUMENT when there is one, so a document-level capture (the enhanced pane) sees a pad button; a harness with no document takes the window', () => {
  const prev = { w: globalThis.window, d: globalThis.document, k: globalThis.KeyboardEvent };
  const docEvents = [], winEvents = [];
  globalThis.KeyboardEvent = class { constructor(type, init) { this.type = type; Object.assign(this, init); } };
  globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent: (e) => winEvents.push(e) };
  globalThis.document = { dispatchEvent: (e) => docEvents.push(e) };
  const store = createBindings(); resetDefaults(store); setBindings(store);
  const pad = { connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  try {
    _resetForTests();
    const gp = attachGamepad({}, {}, { getPads: () => [pad] });   // the REAL dispatch, not a test double
    pad.buttons[4].pressed = true;
    gp.tick(1 / 60);
    assert.ok(docEvents.some((e) => e.type === 'keydown' && e.code === 'JoystickButton4'), `the button lands on the document: ${JSON.stringify(docEvents.map((e) => e.code))}`);
    assert.equal(winEvents.length, 0, 'and is not dispatched a second time on the window (the document event BUBBLES there)');
    gp.dispose?.();
    // no document: the window
    delete globalThis.document;
    const gp2 = attachGamepad({}, {}, { getPads: () => [pad] });
    pad.buttons[5].pressed = true; pad.buttons[4].pressed = false;
    gp2.tick(1 / 60);
    assert.ok(winEvents.some((e) => e.code === 'JoystickButton5'), 'a node harness without a document dispatches on the window');
    gp2.dispose?.();
  } finally {
    globalThis.window = prev.w; if (prev.d === undefined) delete globalThis.document; else globalThis.document = prev.d; globalThis.KeyboardEvent = prev.k;
    _resetForTests();
  }
  // the pane's capture is a document listener, which is the half of this that makes it matter
  assert.match(rd('src/ui/enhancedControls.js'), /document\.addEventListener\('keydown', armedHandler, \{ capture: true \}\);/);
  assert.match(rd('src/ui/gamepadInput.js'), /\(globalThis\.document \?\? window\)\.dispatchEvent\(new KeyboardEvent\(type, \{ code, key: code, bubbles: true \}\)\);/);
});

test('PAD1-B every button name the poller can synthesise is a KeyCode a mod key can hold, both ways, and every vendored mod key default still binds', () => {
  for (let i = 0; i < 20; i++) {
    const name = `JoystickButton${i}`;
    assert.equal(domCodeForKeyCode(name), name, `${name} -> DOM code`);
    assert.equal(keyCodeForDomCode(name), name, `${name} <- DOM code`);
    assert.ok(isBindableKeyCode(name));
  }
  // derived: the names the standard mapping can press
  for (const u of Object.values(STANDARD_TO_UNITY_BUTTON)) assert.ok(isBindableKeyCode(`JoystickButton${u}`));
  assert.equal(isBindableKeyCode('JoystickButton20'), false, 'Unity names twenty');
  assert.equal(isBindableKeyCode('JoystickAxis7Button0'), false, 'an axis key is DFU\'s synthetic KeyCode, not a Unity name a mod parses');
  // every TextKey default a vendored mod ships parses to a real code
  let walked = 0;
  for (const mod of readdirSync(join(ROOT, 'vendor'))) {
    const f = join(ROOT, 'vendor', mod, 'modsettings.json');
    if (!existsSync(f)) continue;
    const j = JSON.parse(readFileSync(f, 'utf8').replace(/,(\s*[}\]])/g, '$1'));   // JSON.NET tolerates a trailing comma (unleveledLoot ships one); node does not
    // EOTB's ScrollableZOffsetAxis is a Unity INPUT AXIS name ('Mouse ScrollWheel'), not a key - skipped by name;
    // '' is Unity's None, a key the mod ships UNBOUND (Travel Options' custom follow key)
    const walk = (o) => { if (!o || typeof o !== 'object') return; if (typeof o.$type === 'string' && /TextKey$/.test(o.$type) && !/Axis$/.test(String(o.Name ?? o.name ?? ''))) { walked++; const v = String(o.Value ?? o.value ?? ''); assert.ok(v === '' || isBindableKeyCode(v), `${mod}: ${o.Name ?? o.name} = ${v}`); } for (const v of Object.values(o)) walk(v); };
    walk(j);
  }
  assert.ok(walked >= 3, `the mods' TextKeys were walked (${walked})`);
});

test('PAD1-C the pad layout: pad-only codes, one action each, none the UI dict spends, every quickslot on the d-pad, every action real', () => {
  const codes = DEFAULT_SECONDARY_BINDINGS.map(([c]) => c);
  const actions = DEFAULT_SECONDARY_BINDINGS.map(([, a]) => a);
  assert.equal(new Set(codes).size, codes.length, 'no code twice');
  assert.equal(new Set(actions).size, actions.length, 'no action twice');
  for (const c of codes) assert.ok(PAD_CODE(c), `${c} is a pad code`);
  for (const a of actions) assert.ok(ACTIONS.includes(a), `${a} is an action`);
  const ui = new Set(DEFAULT_JOYSTICK_UI.map(([c]) => c));
  for (const c of codes) assert.ok(!ui.has(c), `${c} is not a UI click button (A/B/X/Y keep DFU's clicks)`);
  const kb = new Set(DEFAULT_BINDINGS.map(([c]) => c));
  for (const c of codes) assert.ok(!kb.has(c), 'no keyboard default is touched');
  for (const q of QUICKSLOT_ACTIONS) {
    if (q === 'QuickSwap') continue;   // QS6: the swap gave up its default key; the cell it is drawn in is the off hand's
    const row = DEFAULT_SECONDARY_BINDINGS.find(([, a]) => a === q);
    assert.ok(row && /^JoystickAxis[67]Button[01]$/.test(row[0]), `${q} is on the d-pad`);
  }
  for (const a of ['Jump', 'Crouch', 'Escape', 'Inventory', 'CastSpell', 'SwingWeapon', 'ReadyWeapon', 'Run']) assert.ok(actions.includes(a), `${a} has a pad row`);
});

test('PAD1-C the store: a full reset and the load-time autofill both FILL the pad rows and never overwrite a player\'s secondary; a cleared row is remembered, saved, loaded and not resurrected; a full reset forgets the mark', () => {
  const s = createBindings();
  resetDefaults(s);
  for (const [code, action] of DEFAULT_SECONDARY_BINDINGS) assert.equal(s.secondary.get(code), action, `${code} -> ${action}`);
  assert.equal(getBinding(s, 'Jump'), 'Space', 'the keyboard primary stands beside it');
  // the player's own secondary stands through a full reset and an autofill.
  //
  // The code is DERIVED rather than written out: it was `KeyJ` until
  // QUICK-LOOT B4 gave J a primary default, and a reset then took the
  // secondary back to the pad button - so the test stopped asking what
  // it says it asks. A code no default holds, in EITHER dict, is what
  // this fixture has always meant.
  const own = 'PYZXQKJUOBNM'.split('').map((c) => `Key${c}`)
    .find((c) => !DEFAULT_BINDINGS.some(([code]) => code === c)
      && !DEFAULT_SECONDARY_BINDINGS.some(([code]) => code === c));
  assert.ok(own, 'every candidate letter is spoken for - this fixture needs a new one');
  setBinding(s, own, 'Jump', false);
  assert.equal(s.secondary.has('JoystickButton5'), false, 'a secondary bind steals the action\'s old secondary (DFU\'s single-bind law)');
  resetDefaults(s);
  assert.equal(getBinding(s, 'Jump', false), own, 'a full reset leaves the player\'s secondary');
  resetDefaults(s, true);
  assert.equal(getBinding(s, 'Jump', false), own, 'and so does the autofill');
  // a cleared pad row stays cleared
  clearBinding(s, 'Crouch', false); addRemovedSecondaryAction(s, 'Crouch');
  resetDefaults(s, true);
  assert.equal(getBinding(s, 'Crouch', false), null, 'marked removed: the autofill leaves it');
  const data = serializeKeyBinds(s);
  assert.deepEqual(data.removedSecondaryActions, ['Crouch']);
  const t = createBindings(); loadKeyBinds(t, data); resetDefaults(t, true);
  assert.equal(getBinding(t, 'Crouch', false), null, 'the mark loads and holds through the startup autofill');
  assert.equal(getBinding(t, 'Jump', false), own);
  assert.equal(getBinding(t, 'QuickUse1', false), 'JoystickAxis7Button0');
  // a mark for an action that is BOUND somewhere is read as the binding (the same law as removedPrimary)
  const u = createBindings(); loadKeyBinds(u, { actionKeyBinds: {}, secondaryActionKeyBinds: { JoystickButton4: 'Crouch' }, removedSecondaryActions: ['Crouch', 'Nonsense'] });
  assert.equal(u.removedSecondary.has('Crouch'), false);
  // an OLD file (no secondary rows at all) gains the layout at the next boot
  const old = createBindings(); loadKeyBinds(old, { actionKeyBinds: { KeyW: 'MoveForwards', Space: 'Jump' } }); resetDefaults(old, true);
  assert.equal(getBinding(old, 'Jump', false), 'JoystickButton5');
  // a REBIND clears the mark: a player who puts the row back by hand is not asking to keep it unbound
  setBinding(s, 'JoystickButton4', 'Crouch', false);
  assert.equal(s.removedSecondary.has('Crouch'), false, 'binding the secondary again lifts the mark');
  clearBinding(s, 'Crouch', false);   // cleared WITHOUT the mark (a code steal, not the screens' remove)
  resetDefaults(s, true);
  assert.equal(getBinding(s, 'Crouch', false), 'JoystickButton4', 'and an unmarked gap fills again');
  // a full reset forgets the mark and refills
  addRemovedSecondaryAction(s, 'Crouch'); clearBinding(s, 'Crouch', false);
  resetDefaults(s);
  assert.equal(getBinding(s, 'Crouch', false), 'JoystickButton4');
});

// THE CONSEQUENCE, stated. pairedCodes (InputManager.MapSecondaryBindings
// :1372-1384) reads an action bound in BOTH dicts as double-bound, and a
// double-bound combo takes DFU's modifier-first law (:1636): the plain key
// under a held modifier is suppressed, and the combo fires only from a
// frame where the modifier stood clean. Before PAD1 every default action
// was single-bound, so a keyboard player's "Shift+Space opens the pack"
// also jumped (R9, DFU's own quirk). With Inventory holding View on the
// pad, that same combo is double-bound: Shift held first, then Space,
// opens the pack and does NOT jump. This is DFU's law over DFU's data
// model - a DFU player with a pad secondary on Inventory gets exactly
// this - and it is what the pad layout changes for a keyboard player who
// binds a combo on a pad-defaulted action. Recorded in the Ledger row.
test('PAD1-C the consequence: a combo bound on a pad-defaulted action is DOUBLE-bound, so the modifier-first law applies where the single-bound quirk used to', () => {
  const b = createBindings(); resetDefaults(b);
  setBinding(b, 'ShiftLeft+Space', 'Inventory', true);
  setBindings(b);
  try {
    assert.equal(getBinding(b, 'Inventory', false), 'JoystickButton6', 'View is the pad secondary');
    assert.equal(held(new Set(['ShiftLeft', 'Space']), 'Inventory'), false, 'both down in one frame: the modifier did not stand clean first');
    // the latch: Shift alone for a frame, then Space
    assert.equal(held(new Set(['ShiftLeft']), 'Jump'), false);
    assert.equal(held(new Set(['ShiftLeft', 'Space']), 'Inventory'), true, 'modifier first: the combo fires');
    assert.equal(held(new Set(['ShiftLeft', 'Space']), 'Jump'), false, 'and the plain Space is suppressed under it (double-bound)');
    // clear the pad row and the old single-bound quirk is back, byte for byte
    clearBinding(b, 'Inventory', false);
    assert.equal(held(new Set(['ShiftLeft', 'Space']), 'Jump'), true, 'single-bound again: Space still jumps under Shift (R9)');
  } finally { setBindings(null); }
});

test('PAD1-C the controls screens: clearing a pad row through the staged apply marks it removed, exactly as the primary\'s clear does', () => {
  const s = createBindings(); resetDefaults(s);
  const u = createUnsavedKeybinds(s);
  u.secondary.set('Jump', null);
  applyUnsavedKeybinds(s, u);
  assert.equal(getBinding(s, 'Jump', false), null);
  assert.ok(s.removedSecondary.has('Jump'));
  resetDefaults(s, true);
  assert.equal(getBinding(s, 'Jump', false), null, 'and the next boot does not put it back');
});

test('PAD1-C the frame: a d-pad key in the host\'s held set reads as the quickslot action through the registry, a trigger as the swing', () => {
  const s = createBindings(); resetDefaults(s); setBindings(s);
  assert.equal(held(new Set(['JoystickAxis7Button0']), 'QuickUse1'), true);
  assert.equal(held(new Set(['JoystickAxis7Button1']), 'QuickUse2'), true);
  assert.equal(held(new Set(['JoystickAxis6Button1']), 'QuickSpell'), true);
  assert.equal(held(new Set(['JoystickAxis6Button0']), 'QuickOffHand'), true);
  assert.equal(held(new Set(['JoystickAxis10Button0']), 'SwingWeapon'), true, 'RT swings');
  assert.equal(held(new Set(['Mouse1']), 'SwingWeapon'), true, 'and so does Y, through the UI dict\'s right-click');
  assert.equal(held(new Set(['JoystickButton7']), 'Escape'), true, 'Menu pauses');
  assert.equal(held(new Set(['JoystickButton4']), 'Jump'), false, 'LB is not jump');
});

test('PAD1-D the glyphs: the four d-pad directions and the two triggers, square, in both families, each direction its own picture; the quickslot tag shows the d-pad while the pad is live', () => {
  assert.deepEqual([...GLYPH_AXIS_KEYS].sort(), ['JoystickAxis10Button0', 'JoystickAxis6Button0', 'JoystickAxis6Button1', 'JoystickAxis7Button0', 'JoystickAxis7Button1', 'JoystickAxis9Button0']);
  for (const f of PAD_FAMILIES) for (const code of GLYPH_AXIS_KEYS) {
    const rows = unityButtonGlyph(f, code);
    assert.ok(rows && rows.length === GLYPH_SIZE && rows.every((r) => r.length === GLYPH_SIZE && /^[.#o]+$/.test(r)), `${f}/${code}`);
    assert.ok(rows.some((r) => r.includes('o')), `${f}/${code} marks the pressed arm or the letters`);
  }
  const dirs = ['JoystickAxis7Button0', 'JoystickAxis7Button1', 'JoystickAxis6Button1', 'JoystickAxis6Button0'].map((c) => PAD_GLYPHS.xbox[c].join('\n'));
  assert.equal(new Set(dirs).size, 4, 'four different d-pad pictures');
  // up marks the top arm, right the right arm - the axis sign convention of unityAxes (up and right positive)
  assert.ok(PAD_GLYPHS.xbox.JoystickAxis7Button0[1].includes('o') && !PAD_GLYPHS.xbox.JoystickAxis7Button0[9].includes('o'), 'up is up');
  assert.ok(/^#\.\.\.\.\.\.ooo#$/.test(PAD_GLYPHS.xbox.JoystickAxis6Button0[5]), 'right is right');
  assert.notDeepEqual(PAD_GLYPHS.xbox.JoystickAxis9Button0, PAD_GLYPHS.ps.JoystickAxis9Button0, 'LT is not L2');
  assert.deepEqual(PAD_GLYPHS.xbox.JoystickAxis7Button0, PAD_GLYPHS.ps.JoystickAxis7Button0, 'a d-pad is a d-pad');
  const s = createBindings(); resetDefaults(s);
  assert.deepEqual(quickslotTag('QuickUse1', { bindings: s, controller: true, family: 'xbox' }), { kind: 'glyph', family: 'xbox', code: 'JoystickAxis7Button0' });
  assert.deepEqual(quickslotTag('QuickUse1', { bindings: s, controller: false, family: 'xbox' }), { kind: 'key', text: '1' }, 'the digit while the keyboard is live');
});

// THE DERIVED LAW: every action in the registry is read by something in
// src/ outside the registry and the screens that edit it - or is one of
// the four the record names as consumed by nothing (DFU's console, the
// legacy Slide, CenterView, PrintScreen). A new action nobody routes, or
// one of the four gaining a reader, both land here.
test('PAD1-E every registry action has a consumer, or is on the recorded list of four (derived)', () => {
  const EDITORS = new Set(['src/systems/inputActions.js', 'src/ui/controlsWindow.js', 'src/ui/enhancedControls.js', 'src/systems/controlsConfig.js', 'src/ui/joystickControlsWindow.js', 'src/ui/mouseControlsWindow.js', 'src/ui/quickslotTags.js', 'src/ui/padGlyphs.js', 'src/systems/dialogShortcuts.js', 'src/systems/gamepad.js', 'src/systems/keyCodes.js']);
  // CODE, not prose: a comment naming DFU's ConsoleUI.ToggleConsole is not a reader of the action
  const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  const files = [];
  const walk = (d) => { for (const e of readdirSync(join(ROOT, d), { withFileTypes: true })) { const p = `${d}/${e.name}`; if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js') && !EDITORS.has(p)) files.push([p, stripComments(readFileSync(join(ROOT, p), 'utf8'))]); } };
  walk('src');
  const unread = ACTIONS.filter((a) => !files.some(([, src]) => new RegExp(`(?<![A-Za-z0-9_])${a}(?![A-Za-z0-9_])`).test(src)));
  assert.deepEqual(unread.sort(), ['CenterView', 'PrintScreen', 'Slide', 'ToggleConsole'], `unrouted: ${unread}`);
});

// Mac, on PAD1: "changing the keybind on the quick pane should change the
// glyph also". It does, and this is the seam that makes it so: the HUD's
// diamond reads `bindings()` - the live registry - EVERY frame, the pane's
// CONTINUE applies its staged copy into that same registry, and the chip's
// repaint key folds the bound code (or the key's text) in, so a rebind is
// a new key and a new picture on the next frame - the pad's glyph when the
// pad is the live device, the key's name otherwise.
test('PAD1-F a rebind through the controls pane changes the quickslot chip: the tag follows the live registry and its repaint key is the code', () => {
  const store = createBindings(); resetDefaults(store);
  const pad = { bindings: store, controller: true, family: 'xbox' };
  assert.deepEqual(quickslotTag('QuickUse1', pad), { kind: 'glyph', family: 'xbox', code: 'JoystickAxis7Button0' });
  // the pane's apply, exactly: stage, move the secondary, apply into the registry
  const u = createUnsavedKeybinds(store);
  u.secondary.set('QuickUse1', 'JoystickButton5');
  applyUnsavedKeybinds(store, u);
  assert.deepEqual(quickslotTag('QuickUse1', pad), { kind: 'glyph', family: 'xbox', code: 'JoystickButton5' }, 'the chip is the new button');
  assert.equal(getBinding(store, 'Jump', false), null, 'RB was Jump\'s; DFU\'s single-bind law took it (the pane\'s duplicate check would have said so first)');
  // and on the keyboard side
  u.primary.set('QuickUse1', 'KeyG');
  applyUnsavedKeybinds(store, u);
  assert.deepEqual(quickslotTag('QuickUse1', { ...pad, controller: false }), { kind: 'key', text: 'G' });
  // the HUD's frame reads the LIVE store and keys its repaint on the tag
  const hud = rd('src/ui/enhancedHud.js');
  assert.match(hud, /const tagOpts = \{ bindings: bindings\(\), controller, family: family \?\? 'xbox' \};/, 'the registry, read in the frame - never captured at build');
  assert.match(hud, /\.\.\.\['main', 'off', 'c1', 'c2'\]\.map\(\(k\) => tagKey\(tags\[k\]\)\),/, 'the tags are in the block\'s signature');
  assert.match(rd('src/ui/quickslotTags.js'), /export const tagKey = \(t\) => \(t \? \(t\.kind === 'glyph' \? `g:\$\{t\.family\}:\$\{t\.code\}` : `k:\$\{t\.text\}`\) : ''\);/, 'the key carries the code');
  assert.match(rd('src/ui/enhancedControls.js'), /applyUnsavedKeybinds\(bindings\(\), unsaved\);/, 'the pane writes the same registry');
});
