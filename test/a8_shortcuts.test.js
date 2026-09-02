// A8 - the DialogShortcuts table and the windows that read it, against
// HotkeySequence.cs, DaggerfallShortcut.cs and
// StreamingAssets/Text/DialogShortcuts.txt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MOD, VIRTUAL_KEYS, HOTKEY_NONE, hotkeySequence, fromString, sequenceString,
  getKeyModifiers, keyboardModifiers, checkSetModifiers, keyCode, normalizeCode,
  shortcutBinding, hotkeyHit, firstHotkey, BUTTONS, SHORTCUT_TEXT,
} from '../src/systems/dialogShortcuts.js';
import { RestWindow } from '../src/ui/restWindow.js';
import { NativeTradeWindow } from '../src/ui/nativeTrade.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('A8: KeyModifiers is the [Flags] enum verbatim (HotkeySequence.cs:10-24)', () => {
  assert.deepEqual({ ...MOD }, {
    None: 0,
    LeftCtrl: 1, RightCtrl: 2, LeftShift: 4, RightShift: 8, LeftAlt: 16, RightAlt: 32,
    Ctrl: 64, Shift: 128, Alt: 256,
  });
  // virtualKeys (:33)
  assert.equal(VIRTUAL_KEYS, 64 | 128 | 256);
});

test('A8: the constructor INFERS the virtual from a named side (:47-53)', () => {
  const s = hotkeySequence('KeyK', MOD.LeftShift);
  assert.equal(s.modifiers, MOD.LeftShift | MOD.Shift);
  assert.equal(hotkeySequence('KeyK', MOD.RightAlt).modifiers, MOD.RightAlt | MOD.Alt);
  // a bare virtual infers nothing further
  assert.equal(hotkeySequence('KeyK', MOD.Ctrl).modifiers, MOD.Ctrl);
  assert.deepEqual({ ...HOTKEY_NONE }, { code: null, modifiers: 0 });
});

test('A8: FromString takes the LAST word as the key, in any modifier order (:71-94)', () => {
  assert.deepEqual({ ...fromString('T') }, { code: 'KeyT', modifiers: 0 });
  assert.deepEqual({ ...fromString('Ctrl-U') }, { code: 'KeyU', modifiers: MOD.Ctrl });
  // order does not matter, and ParseEnum is case-insensitive (:130-133)
  assert.equal(fromString('Ctrl-Shift-D').modifiers, MOD.Ctrl | MOD.Shift);
  assert.equal(fromString('shift-CTRL-D').modifiers, MOD.Ctrl | MOD.Shift);
  assert.equal(fromString('Ctrl-Shift-D').code, 'KeyD');
  // "None" returns the None instance (:73-75); a name this build has
  // no key for falls to the catch arm (:89-93), never throws
  assert.equal(fromString('None'), HOTKEY_NONE);
  assert.equal(fromString('Ctrl-Nonsense'), HOTKEY_NONE);
  assert.equal(fromString('Bogus-T'), HOTKEY_NONE);
  assert.equal(fromString(null), HOTKEY_NONE);
});

test('A8: KeyCode names translate to the port\'s browser codes', () => {
  assert.equal(keyCode('A'), 'KeyA');
  assert.equal(keyCode('F10'), 'F10');
  assert.equal(keyCode('DownArrow'), 'ArrowDown');
  assert.equal(keyCode('UpArrow'), 'ArrowUp');
  assert.equal(keyCode('Return'), 'Enter');
  assert.equal(keyCode('KeypadPlus'), 'NumpadAdd');
  assert.equal(keyCode('KeypadMinus'), 'NumpadSubtract');
  assert.equal(keyCode('KeypadMultiply'), 'NumpadMultiply');
  assert.equal(keyCode('KeypadDivide'), 'NumpadDivide');
  assert.equal(keyCode('PageUp'), 'PageUp');
  assert.equal(keyCode('Alpha7'), 'Digit7');
  assert.equal(keyCode('LeftShift'), 'ShiftLeft');
  assert.equal(keyCode('Nonsense'), null);
});

test('A8: ToString names a SIDE only when it is the only side (:96-128)', () => {
  assert.equal(sequenceString(fromString('Ctrl-Shift-D')), 'Ctrl-Shift-KeyD');
  assert.equal(sequenceString(hotkeySequence('KeyD', MOD.LeftCtrl)), 'LeftCtrl-KeyD');
  assert.equal(sequenceString(hotkeySequence('KeyD', MOD.LeftCtrl | MOD.RightCtrl)), 'Ctrl-KeyD');
  // Ctrl, then Alt, then Shift - the builder's order, not the enum's
  assert.equal(sequenceString(hotkeySequence('KeyD', MOD.Shift | MOD.Alt | MOD.Ctrl)),
    'Ctrl-Alt-Shift-KeyD');
  assert.equal(sequenceString(HOTKEY_NONE), 'None');
});

test('A8: GetKeyModifiers lights the virtual beside every side (:135-151)', () => {
  assert.equal(getKeyModifiers(true, false, false, false, false, false), MOD.LeftCtrl | MOD.Ctrl);
  assert.equal(getKeyModifiers(false, true, false, true, false, false),
    MOD.RightCtrl | MOD.Ctrl | MOD.RightShift | MOD.Shift);
  assert.equal(getKeyModifiers(false, false, false, false, false, false), MOD.None);
  // the port's two sources: a KeyboardEvent carries only the virtuals,
  // a held-keys Set carries the sides
  assert.equal(keyboardModifiers({ shiftKey: true }), MOD.Shift);
  assert.equal(keyboardModifiers(null, new Set(['ShiftLeft'])), MOD.LeftShift | MOD.Shift);
  assert.equal(keyboardModifiers(null, new Set(['AltRight', 'ControlLeft'])),
    MOD.RightAlt | MOD.Alt | MOD.LeftCtrl | MOD.Ctrl);
  assert.equal(keyboardModifiers(), MOD.None);
});

test('A8: CheckSetModifiers masks BOTH ways (:158-162)', () => {
  // all of triggering pressed...
  assert.equal(checkSetModifiers(MOD.Shift, MOD.Shift), true);
  assert.equal(checkSetModifiers(MOD.None, MOD.Shift), false);
  // ...and NO other virtual pressed - this is the half that keeps
  // Shift-F10 off F10's button and F10 off Shift-F10's
  assert.equal(checkSetModifiers(MOD.Shift, MOD.None), false);
  assert.equal(checkSetModifiers(MOD.Ctrl | MOD.Shift, MOD.Shift), false);
  assert.equal(checkSetModifiers(MOD.Ctrl | MOD.Shift, MOD.Ctrl | MOD.Shift), true);
  // a physical side is NOT a virtual, so it never trips the second mask
  assert.equal(checkSetModifiers(MOD.LeftShift | MOD.Shift, MOD.Shift), true);
});

test('A8: the table is DialogShortcuts.txt, row for row', () => {
  // every Buttons value has a row (CheckLoaded's else arm logs the
  // misses, :322-323 - the port has none) and nothing extra is here
  assert.equal(BUTTONS.length, 240);
  assert.equal(Object.keys(SHORTCUT_TEXT).length, 240);
  assert.deepEqual(BUTTONS.filter((b) => SHORTCUT_TEXT[b] === undefined), []);
  assert.deepEqual(Object.keys(SHORTCUT_TEXT).filter((b) => !BUTTONS.includes(b)), []);
  assert.equal(new Set(BUTTONS).size, BUTTONS.length, 'no button appears twice');
  // 'None' is the sentinel CheckLoaded skips (:314-315), not a row
  assert.ok(!BUTTONS.includes('None'));
  // spot rows across the file, including the ones the port's windows read
  assert.equal(SHORTCUT_TEXT.RestForAWhile, 'F');
  assert.equal(SHORTCUT_TEXT.RestUntilHealed, 'U');
  assert.equal(SHORTCUT_TEXT.RestLoiter, 'L');
  assert.equal(SHORTCUT_TEXT.RestStop, 'S');
  assert.equal(SHORTCUT_TEXT.InventoryWeapons, 'F1');
  assert.equal(SHORTCUT_TEXT.InventoryExit, 'X');
  assert.equal(SHORTCUT_TEXT.InventoryEquip, 'E');
  assert.equal(SHORTCUT_TEXT.TradeSell, 'L');
  assert.equal(SHORTCUT_TEXT.TradeExit, 'X');
  assert.equal(SHORTCUT_TEXT.ResetBonusPool, 'Ctrl-U');
  assert.equal(SHORTCUT_TEXT.Pause, 'Shift-Escape');
  assert.equal(SHORTCUT_TEXT.AutomapZoomIn, 'KeypadPlus');
  // the three rows the file's own '-' notes bend AWAY from the
  // obvious letter, because the letter is taken on that same screen
  assert.equal(SHORTCUT_TEXT.TalkCategoryWork, 'J');       // not W - TalkWhereIs holds it
  assert.equal(SHORTCUT_TEXT.TalkWhereIs, 'W');
  assert.equal(SHORTCUT_TEXT.CharacterSheetLevel, 'V');    // not L - the Logbook holds it
  assert.equal(SHORTCUT_TEXT.CharacterSheetLogbook, 'L');
  assert.equal(SHORTCUT_TEXT.CharacterSheetHistory, 'T');  // not H - Health holds it
  assert.equal(SHORTCUT_TEXT.CharacterSheetHealth, 'H');
  // every row parses to a real key - a typo in the table would show
  // here as a None
  for (const b of BUTTONS) assert.ok(shortcutBinding(b).code, `${b} parses`);
  assert.equal(shortcutBinding('NotAButton'), HOTKEY_NONE);   // GetBinding's miss (:328-335)
});

test('A8: the adapter reads BOTH host alphabets', () => {
  // a native window is handed the raw code; the dungeon overlay seam
  // is handed ui/input.js's 'char:<k>' action (input.js:70-76)
  assert.equal(normalizeCode('KeyF'), 'KeyF');
  assert.equal(normalizeCode('char:f'), 'KeyF');
  assert.equal(normalizeCode('char:F'), 'KeyF');
  assert.equal(normalizeCode('char:3'), 'Digit3');
  assert.equal(normalizeCode('confirm'), 'Enter');
  assert.equal(normalizeCode('back'), 'Escape');
  assert.equal(normalizeCode(null), null);
  // so one table read answers under either host
  assert.equal(hotkeyHit('RestForAWhile', 'KeyF'), true);
  assert.equal(hotkeyHit('RestForAWhile', 'char:f'), true);
  assert.equal(hotkeyHit('RestForAWhile', 'KeyU'), false);
  // and the modifier mask rides along
  assert.equal(hotkeyHit('LargeHUDToggle', 'F10'), true);
  assert.equal(hotkeyHit('LargeHUDToggle', 'F10', { shiftKey: true }), false);
  assert.equal(hotkeyHit('HUDToggle', 'F10', { shiftKey: true }), true);
  assert.equal(hotkeyHit('HUDToggle', 'F10'), false);
  assert.equal(hotkeyHit('ResetBonusPool', 'KeyU', { ctrlKey: true }), true);
  assert.equal(hotkeyHit('ResetBonusPool', 'KeyU'), false);
  // firstHotkey is Panel.ProcessHotkeySequences' first-Handled walk
  assert.equal(firstHotkey(['TradeExit', 'TradeClear'], 'KeyC'), 'TradeClear');
  assert.equal(firstHotkey(['TradeExit', 'TradeClear'], 'KeyQ'), null);
});

// ── the windows that read it ────────────────────────────────────────

const restDeps = () => ({
  endLines: () => ['finished'],
  onClose: () => {},
  entity: { stats: {}, skills: {} },
});

test('A8: the rest window\'s four buttons answer the TABLE, not four literals', () => {
  // DaggerfallRestWindow.cs:149/152/155/173
  const a = new RestWindow(restDeps());
  a.input('char:f');
  assert.equal(a.state, 'hours', 'F is RestForAWhile - the hours prompt');
  assert.equal(a.mode, 'timed');
  // the invented letter it replaced is now inert on this page
  const stale = new RestWindow(restDeps());
  stale.input('char:r');
  assert.equal(stale.state, 'selection', 'R was the port\'s own guess; DFU\'s RestForAWhile is F');
  // U is RestUntilHealed, which starts a rest outright rather than
  // asking for hours
  const b = new RestWindow(restDeps());
  b.input('char:u');
  assert.notEqual(b.state, 'selection');
  assert.notEqual(b.state, 'hours');
  // L is RestLoiter
  const c = new RestWindow(restDeps());
  c.input('char:l');
  assert.equal(c.state, 'hours');
  assert.equal(c.mode, 'loiter');
  // the port's own digit row survives beside them
  const d = new RestWindow(restDeps());
  d.input('char:1');
  assert.equal(d.state, 'hours');
  assert.equal(d.mode, 'timed');
});

test('A8: RestStop ends a running rest from the keyboard (:173)', () => {
  const w = new RestWindow(restDeps());
  w.input('char:2');   // rest until healed - the running page
  assert.equal(w.state, 'resting');
  // ROAD-E E1: StopButton_OnKeyboardEvent is two phases (:714-726) -
  // KeyDown plays ButtonClick and defers, KeyUp ends the rest.
  w.input('char:s');
  assert.equal(w.state, 'resting', 'the press only defers (:717-719)');
  assert.equal(w.isCloseWindowDeferred, true);
  w.keyup('char:s');
  assert.notEqual(w.state, 'resting', 'S is RestStop');
});

const tradeHooks = (mode) => ({
  mode,
  shelfItems: () => [],
  packItems: () => [],
  accepts: () => true,
  enchanted: () => true,
  priceCtx: () => ({ quality: 10, skills: {} }),
  gold: () => 1000,
  rows: (id) => [{ text: `#${id}`, center: true }],
  weight: () => ({ carriedWeightKg: 0, maxEncumbranceKg: 1e9 }),
  commit: () => {},
  icons: { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() },
});

test('A8: the trade window exits on X, and its mode action wears the MODE\'s letter', () => {
  // TradeExit is X (:249) - E is InventoryEquip's letter and never
  // closed anything in DFU
  const x = new NativeTradeWindow(tradeHooks('Buy'));
  x.input('KeyX');
  assert.equal(x.done, true);
  const e = new NativeTradeWindow(tradeHooks('Buy'));
  e.input('KeyE');
  assert.equal(e.done, false, 'E is not an exit on this screen');
  // Escape still closes: that is the overlay seam's, not the table's
  const esc = new NativeTradeWindow(tradeHooks('Buy'));
  esc.input('Escape');
  assert.equal(esc.done, true);
  // the mode action button's letter is chosen by WindowMode (:325-344)
  const acted = [];
  const armed = (mode) => {
    const w = new NativeTradeWindow(tradeHooks(mode));
    w._modeAction = () => acted.push(mode);
    return w;
  };
  armed('Buy').input('KeyB');
  armed('Identify').input('KeyD');
  armed('Repair').input('KeyR');
  armed('Sell').input('KeyL');
  armed('SellMagic').input('KeyL');
  assert.deepEqual(acted, ['Buy', 'Identify', 'Repair', 'Sell', 'SellMagic']);
  // and only that mode's letter - Buy's B does nothing in Repair mode
  const none = [];
  const r = new NativeTradeWindow(tradeHooks('Repair'));
  r._modeAction = () => none.push('acted');
  r.input('KeyB');
  assert.deepEqual(none, []);
});

// ── source pins: the wiring, where the behaviour is host-side ───────

test('A8: the four wired windows read the table rather than literals', () => {
  const inv = readFileSync(join(root, 'src/ui/nativeInventory.js'), 'utf8');
  assert.match(inv, /from '\.\.\/systems\/dialogShortcuts\.js'/);
  // the interim digit-tab accelerator is gone: DFU's tabs are F1-F4
  assert.ok(!/digits jump tabs/.test(inv), 'the interim tab comment is retired');
  assert.ok(!/Digit\(\[1-4\]\)/.test(inv), 'the digit tab arm is retired');
  // ...and E no longer closes the inventory, because E is Equip
  assert.ok(!/code === 'KeyE'/.test(inv), 'E is InventoryEquip, not an exit');
  const trade = readFileSync(join(root, 'src/ui/nativeTrade.js'), 'utf8');
  assert.match(trade, /from '\.\.\/systems\/dialogShortcuts\.js'/);
  assert.ok(!/code === 'KeyE'/.test(trade));
  const travel = readFileSync(join(root, 'src/ui/travelPopUp.js'), 'utf8');
  assert.match(travel, /firstHotkey\(TRAVEL_BUTTONS/);
  const rest = readFileSync(join(root, 'src/ui/restWindow.js'), 'utf8');
  assert.match(rest, /hotkeyHit/);
  // nothing in the table module invents a row: it is a transcription,
  // so every value is a string the parser accepts
  const src = readFileSync(join(root, 'src/systems/dialogShortcuts.js'), 'utf8');
  assert.match(src, /DialogShortcuts\.txt/);
});
