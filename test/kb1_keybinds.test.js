// KB1 (2026-09-23, Mac: "We have a lot of mods, a lot of keybinds. I really want to formalize a solid solution. Like
// what does need keybinds, what does, and ensuring keybinds are organized and working as intended"): THE KEYBINDING
// STANDARD, held by execution.
//
// The standard (bible/10-UI/Controls.md has it whole):
//   1. ONE REGISTRY owns every world key - DFU's actions, the port's, the hotbar's slots, the dial, E's Interact and
//      every vendored mod's keys (MOD_ACTIONS); Controls draws them grouped, a mod's under its name while it is on.
//   2. A WINDOW'S OWN KEYS stay the window's (Escape, Enter, arrows, its letters) and answer only while it is up.
//   3. ONE KEY, ONE ACTION - no default is shipped twice.
//   4. A HELD KEY IS ASKED FOR, never silently taken (the replace prompt, in every controls window).
//   5. EVERY KEY IS READ THROUGH THE REGISTRY - rebinds apply live, and a mod switched off answers nothing.
//   6. These tests, and a saved file carried forward once.
//
// Mac's four calls, 2026-09-23: E is Interact (AbortSpell moves to `); online Enter is the chat and Y frees the
// mouse, offline Enter frees it as in DFU; the digit row is the quickbar/hotbar (Horse Cart and Cargo moves to , and
// .); DFU's dead rows - build CenterView and PrintScreen, hide ToggleConsole and Slide and free their keys.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  ACTIONS, DEFAULT_BINDINGS, HIDDEN_ACTIONS, MOD_ACTIONS, ACTION_GROUPS, KEYBINDS_VERSION,
  createBindings, resetDefaults, loadKeyBinds, serializeKeyBinds, migrateKeyBinds, getBinding, actionForCode,
  setBinding, actionLive, actionLabel, loadOrCreateBindings,
} from '../src/systems/inputActions.js';
import {
  setBindings, held, pressed, actionOf, keyEdges, noteKeyDown, beginInputFrame, swingKeyHeld, swingHeld, routeKey,
} from '../src/ui/input.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { bindCursorToggle, claimCursorKey, cursorKeyClaimed, cursorActive, setCursorActive } from '../src/player/pointerLock.js';
import { setScreenshotCanvas, screenshotName } from '../src/ui/screenshot.js';
import { LookFilter, takeFrameLook } from '../src/player/lookFilter.js';
import { PauseOptionsWindow } from '../src/ui/pauseWindow.js';
import { NativeInventoryWindow } from '../src/ui/nativeInventory.js';
import { bindingHolders, createUnsavedKeybinds, replaceKeybindPromptRows, stageReplace, currentDict } from '../src/systems/controlsConfig.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const defaults = () => { const s = createBindings(); resetDefaults(s); return s; };

// ── THE TABLE ──────────────────────────────────────────────────────────

test('KB1 laws 1 and 3: every action is in one Controls group or hidden, no default ships twice, and every vendored mod\'s key is an action with a default', () => {
  const grouped = ACTION_GROUPS.flatMap((g) => g.rows.map((r) => r.action));
  assert.equal(new Set(grouped).size, grouped.length);
  assert.deepEqual([...grouped, ...HIDDEN_ACTIONS].sort(), [...ACTIONS].sort());
  const codes = DEFAULT_BINDINGS.map(([c]) => c);
  assert.deepEqual(codes.filter((c, i) => codes.indexOf(c) !== i), [], 'one key, one action');
  const shipped = new Map(DEFAULT_BINDINGS.map(([c, a]) => [a, c]));
  for (const a of HIDDEN_ACTIONS) assert.ok(!shipped.has(a), `${a} is hidden and ships no key`);
  for (const [vendor, rows] of Object.entries(MOD_ACTIONS)) {
    const grp = ACTION_GROUPS.find((g) => g.mod === vendor);
    assert.ok(grp, `${vendor} has its own Controls group`);
    for (const r of rows) assert.ok(shipped.has(r.action), `${vendor}: ${r.action} ships a key`);
  }
  // Mac's calls, as the table spells them
  assert.equal(shipped.get('Interact'), 'KeyE');
  assert.equal(shipped.get('AbortSpell'), 'Backquote');
  assert.equal(shipped.get('HorseMount'), 'Comma');
  assert.equal(shipped.get('HorseSummon'), 'Period');
  assert.equal(shipped.get('CenterView'), 'Home');
  assert.equal(shipped.get('PrintScreen'), 'F8');
  assert.equal(shipped.get('FreeMouse'), 'KeyY');
  assert.equal(shipped.get('ActivateCursor'), 'Enter');
  assert.deepEqual(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'].map((c) => actionForCode(defaults(), c)),
    ['QuickUse1', 'QuickUse2', 'QuickSpell', 'QuickOffHand', 'Hotbar5', 'Hotbar6', 'Hotbar7', 'Hotbar8', 'Hotbar9', 'Hotbar10']);
  assert.equal(actionLabel('HorseMount'), 'Mount or dismount (Horse Cart and Cargo)', 'a mod\'s key is named with its mod');
});

// ── LAW 5: THE READERS ─────────────────────────────────────────────────

test('KB1 law 5: a mod switched off answers nothing on its keys - held, pressed and actionOf alike - and switched on again finds its key still bound (mutant: actionLive answers true)', () => {
  _resetModSettings();
  const store = defaults();
  setBindings(store);
  const keys = new Set(['KeyG']);
  const edge = keyEdges(); noteKeyDown(edge, 'KeyG'); beginInputFrame(edge);
  const V = 'handheld-torches';
  try {
    setModSetting(V, 'Enabled', true);
    assert.equal(actionLive('TorchDrop'), true);
    assert.equal(held(keys, 'TorchDrop'), true);
    assert.equal(pressed(edge, keys, 'TorchDrop'), true);
    assert.equal(actionOf({ code: 'KeyG' }), 'TorchDrop');
    setModSetting(V, 'Enabled', false);
    assert.equal(actionLive('TorchDrop'), false);
    assert.equal(held(keys, 'TorchDrop'), false);
    assert.equal(pressed(edge, keys, 'TorchDrop'), false);
    assert.equal(actionOf({ code: 'KeyG' }), null, 'the key means nothing while the mod is off');
    assert.equal(getBinding(store, 'TorchDrop'), 'KeyG', '...and it is still bound - switching the mod on must not find it given away');
    assert.equal(actionLive('Jump'), true, 'the game\'s own actions always answer');
  } finally { _resetModSettings(); setBindings(null); }
  assert.match(rd('src/ui/input.js'), /export function held\(keys, action\) \{\s*\n\s*if \(!actionLive\(action\)\) return false;/);
});

test('KB1: RT swings beside the mouse - a non-mouse code bound to SwingWeapon is read whether or not a button holds the other slot (mutant: swingKeyHeld only when no mouse button is bound)', () => {
  const store = defaults();
  setBindings(store);
  assert.equal(getBinding(store, 'SwingWeapon'), 'Mouse1');
  assert.equal(getBinding(store, 'SwingWeapon', false), 'JoystickAxis10Button0', 'the shipped pad row: RT');
  assert.equal(swingKeyHeld(new Set(['JoystickAxis10Button0'])), true, 'RT held swings - it never did while Mouse1 held the primary');
  assert.equal(swingKeyHeld(new Set(['Mouse1'])), false, 'the mouse is the mouse handlers\' own press - not fed twice');
  assert.equal(swingHeld(0, new Set(['JoystickAxis10Button0'])), true, 'and the look-suppression read agrees');
  assert.equal(swingHeld(2, new Set()), true, 'the right button still reads through its bit');
  setBindings(null);
});

test('KB1: the dial is QuickDial wherever it is bound, and a key a routeAction arm has no door for is left to the next ladder (mutants: a literal Tab back; `return true` with no door)', () => {
  const store = defaults();
  setBindings(store);
  let dials = 0;
  const ctx = { uiOverlayActive: false, toggleDial: () => { dials++; return true; } };
  assert.equal(routeKey({ code: 'Tab', key: 'Tab' }, ctx, null, new Set(['Tab'])), true);
  assert.equal(dials, 1);
  setBinding(store, 'Backslash', 'QuickDial');
  assert.equal(routeKey({ code: 'Backslash', key: '\\' }, ctx, null, new Set(['Backslash'])), true, 'moved, the new key raises it');
  assert.equal(routeKey({ code: 'Tab', key: 'Tab' }, ctx, null, new Set(['Tab'])), false, '...and Tab no longer does');
  assert.equal(dials, 2);
  assert.equal(routeKey({ code: 'KeyR', key: 'r' }, { uiOverlayActive: false }, null, new Set(['KeyR'])), false, 'R with no rest door is not swallowed');
  setBindings(null);
});

// ── ENTER ONLINE ───────────────────────────────────────────────────────

test('KB1 (Mac: "Enter = chat"): while a chat panel claims the key, Enter opens the chat and does NOT free the mouse; Y still does; offline Enter frees it as in DFU (mutant: the claim ignored - one Enter did both)', () => {
  const store = defaults();
  setBindings(store);
  const listeners = [];
  const prevAdd = globalThis.addEventListener;
  globalThis.addEventListener = (type, fn) => { if (type === 'keydown') listeners.push(fn); };
  const canvas = { requestPointerLock() { return Promise.resolve(); } };
  try {
    bindCursorToggle(canvas, () => false, (e) => actionOf(e));
    const fire = (code) => { for (const fn of listeners) fn({ code, key: code, target: { tagName: 'CANVAS' }, preventDefault() {} }); };
    setCursorActive(false);
    fire('Enter');
    assert.equal(cursorActive(), true, 'offline: Enter frees the mouse (PlayerMouseLook.cs:190)');
    setCursorActive(false);
    const release = claimCursorKey();
    assert.equal(cursorKeyClaimed(), true);
    fire('Enter');
    assert.equal(cursorActive(), false, 'online: Enter is the chat\'s, the mouse stays');
    fire('KeyY');
    assert.equal(cursorActive(), true, 'Y (FreeMouse) frees it');
    release(); release();
    assert.equal(cursorKeyClaimed(), false, 'the release is once-only, and the claim is gone');
  } finally {
    if (prevAdd === undefined) delete globalThis.addEventListener; else globalThis.addEventListener = prevAdd;
    setCursorActive(false);
    setBindings(null);
  }
  assert.match(rd('src/ui/chatPanel.js'), /const releaseCursorKey = claimCursorKey\(takesKey\);/, 'the chat panel claims it for as long as it stands - AUDIT KB1: press by press, on its own handler\'s word');
});

// ── DFU'S DEAD ROWS, BUILT ─────────────────────────────────────────────

test('KB1 (Mac: "build 2") + AUDIT KB1: PrintScreen takes a screenshot - F8 by default, wherever it is rebound, routed like every world action: never under a window, never from a text field, never on a repeat (mutants: the arm missing; the repeat routed)', () => {
  const store = defaults();
  setBindings(store);
  const shots = [];
  setScreenshotCanvas({ id: 'c' }, { shoot: (c) => shots.push(c) });
  try {
    const key = (code, extra = {}) => ({ code, key: code, repeat: false, target: { tagName: 'CANVAS' }, preventDefault() { this.prevented = true; }, ...extra });
    const world = { uiOverlayActive: false };
    assert.equal(routeKey(key('F8'), world), true);
    assert.equal(shots.length, 1, 'F8 shoots');
    routeKey(key('F8', { target: { tagName: 'INPUT' } }), world);
    assert.equal(routeKey(key('F8', { repeat: true }), world), true, 'a repeat is swallowed...');
    assert.equal(shots.length, 1, '...and shoots nothing; nor does a field');
    const under = [];
    routeKey(key('F8'), { uiOverlayActive: true, overlayIsNative: true, overlayInput: (c) => under.push(c) });
    assert.deepEqual(under, ['F8'], 'a window up takes F8 (the automaps\' third background, AUDIT KB1)');
    assert.equal(shots.length, 1, '...and no screenshot is taken under it');
    setBinding(store, 'F12', 'PrintScreen');
    routeKey(key('F8'), world);
    assert.equal(shots.length, 1, 'rebound, F8 no longer shoots');
    routeKey(key('F12'), world);
    assert.equal(shots.length, 2, '...and the new key does');
    assert.match(screenshotName(new Date(2026, 8, 23, 14, 5, 9)), /^daggerfall-20260923-140509\.png$/);
    assert.match(rd('src/main.js'), /setScreenshotCanvas\(canvas\);/, 'the canvas handed in once, at boot');
  } finally {
    setScreenshotCanvas(null);
    setBindings(null);
  }
});

test('KB1 (Mac: "build 2"): CenterView levels the view through the look filter - the owed pitch replaced, paid out smoothly, and never latched as a hand\'s look (mutant: pitch snapped, or fed through add())', () => {
  const f = new LookFilter();
  const cam = { yaw: 0, pitch: 0.6 };
  takeFrameLook();
  f.centerPitch(cam);
  assert.equal(f.residualPitch, -0.6);
  assert.deepEqual(takeFrameLook(), [0, 0], 'not latched as the frame\'s look - the weapon widget does not sway to a key');
  for (let i = 0; i < 240; i++) f.tick(1 / 60, cam, { smoothing: 0.5 });
  assert.ok(Math.abs(cam.pitch) < 1e-3, `levelled: ${cam.pitch}`);
  for (const h of ['world.js', 'exterior.js', 'dungeon.js']) {
    assert.match(rd(`src/scenes/${h}`), /if \(pressed\((?:latch\.edge|keyEdge), keys, 'CenterView'\)\) lookFilter\.centerPitch\(cam\);/, `${h} reads Home`);
  }
});

// ── A WINDOW CLOSES ON ITS OWN KEY ─────────────────────────────────────

test('KB1: a window closes on the key that opened it, wherever it is bound - the pause on Escape\'s binding, the pack on Inventory\'s (mutants: the literal Escape / F6 back)', () => {
  const store = defaults();
  setBinding(store, 'KeyP', 'Escape');
  setBinding(store, 'KeyI', 'Inventory');
  setBindings(store);
  const pause = new PauseOptionsWindow({});
  pause.input('KeyP');
  pause.keyup('KeyP');
  assert.equal(pause.done, true, 'the pause closes on its own key\'s release');
  const back = new PauseOptionsWindow({});
  back.input('Escape'); back.keyup('Escape');
  assert.equal(back.done, true, 'and on the back button, as DFU\'s GetBackButtonUp');
  const inv = new NativeInventoryWindow({ items: () => [], entity: { items: [], equip: { slots: {} } } });
  inv.input('F6');
  assert.equal(inv.done, false, 'F6 is nobody\'s now');
  inv.input('KeyI');
  assert.equal(inv.done, true, 'the pack closes on Inventory\'s key');
  setBindings(null);
  assert.match(rd('src/ui/enhancedSpellbook.js'), /if \(overlayAction\(e\) !== 'back' && !eventMeans\(e, 'CastSpell'\)\) return;/, 'the enhanced book on its own key too (AUDIT KB1: the event\'s own read; UXB1-S: shared or not)');
});

// ── LAW 4: ASKED, NOT TAKEN ────────────────────────────────────────────

test('KB1 law 4: a held key names its holder - across both dicts - and Yes gives it over, holder cleared (mutants: the other dict not asked; the holder left bound)', () => {
  const store = defaults();
  const u = createUnsavedKeybinds(store);
  assert.deepEqual(bindingHolders(u, 'Jump', 'KeyG'), [{ action: 'TorchDrop', primary: true }]);
  assert.deepEqual(replaceKeybindPromptRows('Jump', 'KeyG', [{ action: 'TorchDrop', primary: true }]),
    ['G is used by Drop the light (Handheld Torches).', 'Give it to Jump instead?']);
  assert.deepEqual(bindingHolders(u, 'Jump', 'Space'), [], 'an action\'s own key is no clash');
  u.usingPrimary = false;
  assert.deepEqual(bindingHolders(u, 'Jump', 'KeyG'), [{ action: 'TorchDrop', primary: true }], 'the primary is asked from the secondary side too');
  stageReplace(u, 'Jump', 'KeyG', [{ action: 'TorchDrop', primary: true }]);
  assert.equal(u.primary.get('TorchDrop'), null);
  assert.equal(currentDict(u).get('Jump'), 'KeyG');
  for (const f of ['src/ui/enhancedControls.js', 'src/ui/controlsWindow.js', 'src/ui/mouseControlsWindow.js']) {
    assert.match(rd(f), /bindingHolders\(/, `${f} asks`);
  }
});

// ── THE CARRY ──────────────────────────────────────────────────────────

test('KB1 law 6: a v1 file comes forward ONCE - the three moved DFU defaults let go only where they still stood, the new rows land, a player\'s own E stays theirs (mutants: the carry skipped, so E aborts spells and nothing interacts; a player\'s E taken)', () => {
  // a v1 file: DFU's old rows, written before the standard
  const v1 = createBindings();
  resetDefaults(v1);
  for (const code of ['KeyE', 'Tab', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'KeyO', 'KeyG', 'KeyX', 'KeyB', 'NumpadAdd', 'KeyK', 'Comma', 'Period', 'Backquote']) v1.primary.delete(code);
  v1.primary.set('KeyE', 'AbortSpell'); v1.primary.set('Backquote', 'ToggleConsole'); v1.primary.set('ControlLeft', 'Slide');
  const file = serializeKeyBinds(v1);
  delete file.version;
  const s = createBindings();
  loadKeyBinds(s, file);
  const { moved } = migrateKeyBinds(s, 1);
  resetDefaults(s, true);
  assert.ok(moved.includes('AbortSpell off KeyE') && moved.includes('ToggleConsole off Backquote') && moved.includes('Slide off ControlLeft'));
  assert.equal(getBinding(s, 'Interact'), 'KeyE', 'E interacts');
  assert.equal(getBinding(s, 'AbortSpell'), 'Backquote', 'the abort lands where the console was');
  assert.equal(getBinding(s, 'ToggleConsole'), null);
  assert.equal(getBinding(s, 'Slide'), null);
  assert.equal(actionForCode(s, 'ControlLeft'), null, 'Left Ctrl is free');
  assert.equal(getBinding(s, 'QuickDial'), 'Tab');
  assert.equal(getBinding(s, 'HorseMount'), 'Comma');
  assert.deepEqual(migrateKeyBinds(s, KEYBINDS_VERSION), { moved: [], kept: [], lost: [] }, 'a v2 file is never carried twice');
  // a player who had put Rest on E keeps it; Interact waits, rebindable
  const mine = createBindings();
  loadKeyBinds(mine, file);
  mine.primary.set('KeyE', 'Rest');
  const told = migrateKeyBinds(mine, 1);
  resetDefaults(mine, true);
  assert.equal(actionForCode(mine, 'KeyE'), 'Rest');
  assert.equal(getBinding(mine, 'Interact'), null, 'the new action waits rather than fighting for the key');
  assert.deepEqual(told.lost.find((l) => l.action === 'Interact'), { action: 'Interact', code: 'KeyE', holder: 'Rest' }, 'AUDIT KB1 F3: ...and the player is told so');
  assert.equal(getBinding(mine, 'AbortSpell'), 'Backquote', 'the abort still moves - E was not its to keep');
});

test('KB1 law 6: a mod key the player SAVED is carried into the registry; a shipped value is left to the new default; None stays unbound; Travel Options\' choice list and custom bind are read as the mod read them (mutants: shipped values carried; None bound; the choice index read as a name)', () => {
  const prevLs = globalThis.localStorage;
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  try {
    _resetModSettings();
    store.set('dfjs-mod-settings', JSON.stringify({
      'handheld-torches': { 'Handling.ToggleLightInput': 'L', 'Handling.ManualDropInput': 'Tab', 'Throwing.ThrowTorchInput': 'None' },
      'eye-of-the-beholder': { 'Camera.SwitchShoulder': 'B' },
      'travel-options': { 'RoadsIntegration.FollowPathsKey': 6, 'RoadsIntegration.FollowPathsCustomKeyBind': 'Semicolon' },
      'horse-cart-and-cargo': { 'Hotkeys.QuickMountDismount': 'Keypad5' },
    }));
    const s = createBindings();
    resetDefaults(s);
    for (const [c, a] of [...s.primary]) if (['TorchToggleLight', 'TorchDrop', 'TorchThrow', 'ShoulderSwitch', 'AutoPerspective', 'FollowPaths', 'HorseMount', 'HorseSummon', 'Interact', 'QuickDial'].includes(a)) s.primary.delete(c);
    s.primary.delete('KeyL'); s.removedPrimary.add('LogBook');   // the player had cleared LogBook's L in Controls - free for the carry (AUDIT KB1: a real v1 file marks the removal, and the carry runs after the autofill)
    const { moved } = migrateKeyBinds(s, 1);
    resetDefaults(s, true);
    assert.equal(getBinding(s, 'TorchToggleLight'), 'KeyL', 'a key they chose is theirs');
    assert.equal(getBinding(s, 'TorchDrop'), 'KeyG', 'Tab was the mod\'s own shipped value - the new default stands');
    assert.equal(getBinding(s, 'TorchThrow'), null, 'None: they had cleared it');
    assert.ok(s.removedPrimary.has('TorchThrow'), '...and it is marked, so the autofill does not bring it back');
    assert.equal(getBinding(s, 'ShoulderSwitch'), 'KeyB', 'B was shipped - the default (also B) stands');
    assert.equal(getBinding(s, 'FollowPaths'), 'Semicolon', 'past the six, the custom bind');
    assert.equal(getBinding(s, 'HorseMount'), 'Numpad5');
    assert.ok(moved.includes('TorchToggleLight on KeyL') && moved.includes('TorchThrow unbound'));
  } finally {
    _resetModSettings();
    if (prevLs === undefined) delete globalThis.localStorage; else globalThis.localStorage = prevLs;
  }
});

test('KB1 law 6: loadOrCreateBindings writes a carried file back as v2 at once, so the carry runs exactly once', () => {
  const prevLs = globalThis.localStorage;
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const info = console.info; console.info = () => {};
  try {
    const v1 = createBindings(); resetDefaults(v1);
    v1.primary.delete('KeyE'); v1.primary.set('KeyE', 'AbortSpell');
    const file = serializeKeyBinds(v1); delete file.version;
    store.set('dagger.keybinds', JSON.stringify(file));
    const s = loadOrCreateBindings();
    assert.equal(getBinding(s, 'Interact'), 'KeyE');
    assert.equal(JSON.parse(store.get('dagger.keybinds')).version, KEYBINDS_VERSION, 'saved as v2');
  } finally {
    console.info = info;
    if (prevLs === undefined) delete globalThis.localStorage; else globalThis.localStorage = prevLs;
  }
});

// ── LAW 5, SWEPT: NO RAW READ OF A BOUND KEY ───────────────────────────

test('KB1 law 5, swept: no gameplay code reads a key the registry binds by its raw code - every one left is a window\'s own or a named reservation (mutant: any `e.code === \'KeyE\'` or `pressedCode(` back in a host)', () => {
  const bound = new Set(DEFAULT_BINDINGS.map(([c]) => c));
  // Each reservation is a key read raw ON PURPOSE, with its reason. A new raw read is a decision this list must
  // record, or a rebind silently stops reaching it.
  const RESERVED = {
    'src/scenes/world.js': { Escape: 'the back-button latch the accelerator reads (DFU GetBackButton is the literal Escape)', AltLeft: 'preventDefault only - the browser menu steals focus on Alt', KeyH: 'Travel Options\' help, the travel panel\'s own key while it is up' },
    'src/scenes/exterior.js': { Escape: 'the back-button latch', AltLeft: 'preventDefault only' },
    'src/scenes/dungeon.js': { AltLeft: 'preventDefault only' },
    'src/scenes/townTalk.js': { KeyE: 'an open talk window\'s confirm alias - the window\'s key, while it is up' },
  };
  const files = [];
  const walk = (d) => { for (const e of readdirSync(new URL(`../${d}`, import.meta.url), { withFileTypes: true })) { const p = `${d}/${e.name}`; if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) files.push(p); } };
  for (const d of ['src/scenes', 'src/player', 'src/combat', 'src/systems']) walk(d);
  const offenders = [];
  for (const f of files) {
    if (f === 'src/scenes/interior.js') continue;   // the standalone block viewer - a dev surface with no player
    rd(f).split('\n').forEach((line, i) => {
      if (/fly-cam \(dev\)/.test(line)) return;   // the developer's free camera
      if (/pressedCode\(/.test(line)) offenders.push(`${f}:${i + 1} pressedCode`);
      for (const m of line.matchAll(/(?:e|ev|event)\.code === '([A-Za-z0-9]+)'|keys\.has\('([A-Za-z0-9]+)'\)/g)) {
        const code = m[1] ?? m[2];
        if (!bound.has(code)) continue;
        if (RESERVED[f]?.[code]) continue;
        offenders.push(`${f}:${i + 1} reads ${code} raw`);
      }
    });
  }
  assert.deepEqual(offenders, []);
});
