// PADPLUS1 (2026-09-25): the Enhanced Plus controller layer - the layout move, the crossbar (model, mapping and the
// poller's presses), run as a toggle, the menus' world codes standing down, the HD glyphs and the prompt rows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBindings, resetDefaults, setBinding, getBinding, getJoystickUIBinding, DEFAULT_SECONDARY_BINDINGS,
} from '../src/systems/inputActions.js';
import {
  applyPlusPadLayout, PLUS_PAD_LAYOUT, crossbarSlot, crossbarCodeOf, CROSSBAR_CODES, registerCrossbar, windowPrompts,
} from '../src/ui/plusPad.js';
import { hdGlyphSvg, hdGlyphMarkup, HD_GLYPH_CODES } from '../src/ui/padGlyphsHD.js';
import {
  HOTBAR_SIZE, HOTBAR_CAPACITY, setHotbarSlot, clearHotbar, firstFreeHotbarSlot, hotbarView, quickslotSaveData, restoreQuickslotSaveData, hotbarEntry,
} from '../src/systems/quickslots.js';
import { setBindings } from '../src/ui/input.js';
import { attachGamepad } from '../src/ui/gamepadInput.js';
import { setPref, _resetForTests as resetPrefs } from '../src/systems/uiPrefs.js';
import { _resetForTests as resetSettings, setValue } from '../src/systems/settings.js';

const pad1Store = () => { const s = createBindings(); resetDefaults(s); return s; };

test('PADPLUS1 layout: PAD1\'s untouched rows move to the Plus rows, RT becomes the RightClick attack, X loses autorun, LB/RB are free for the crossbar', () => {
  const s = pad1Store();
  assert.equal(getBinding(s, 'Jump', false), 'JoystickButton5', 'PAD1 jumps on RB');
  applyPlusPadLayout(s);
  for (const [code, action] of PLUS_PAD_LAYOUT) assert.equal(getBinding(s, action, false), code, `${action} on ${code}`);
  assert.equal(s.secondary.has('JoystickButton4'), false, 'LB free');
  assert.equal(s.secondary.has('JoystickButton5'), false, 'RB free');
  assert.equal(getJoystickUIBinding(s, 'RightClick'), 'JoystickAxis10Button0', 'RT is the attack');
  assert.notEqual(getJoystickUIBinding(s, 'MiddleClick'), 'JoystickButton2', 'X is no longer autorun');
  assert.equal(getJoystickUIBinding(s, 'LeftClick'), 'JoystickButton0');
  assert.equal(getJoystickUIBinding(s, 'Back'), 'JoystickButton1');
});

test('PADPLUS1 layout: the next boot\'s autofill does not put PAD1 back (mutant: SwingWeapon or MiddleClick refilled onto X/RT)', () => {
  const s = pad1Store();
  applyPlusPadLayout(s);
  resetDefaults(s, true);
  for (const [code, action] of PLUS_PAD_LAYOUT) assert.equal(getBinding(s, action, false), code, `${action} still on ${code}`);
  assert.equal(getBinding(s, 'SwingWeapon', false), null, 'no second swing row');
  assert.equal(getJoystickUIBinding(s, 'RightClick'), 'JoystickAxis10Button0');
  assert.notEqual(getJoystickUIBinding(s, 'MiddleClick'), 'JoystickButton2');
  for (const [code] of DEFAULT_SECONDARY_BINDINGS) if (!PLUS_PAD_LAYOUT.some(([c]) => c === code) && code !== 'JoystickAxis10Button0') assert.equal(s.secondary.has(code), false, `${code} stays free`);
});

test('PADPLUS1 layout: a pad button the player bound is theirs - not moved, and its Plus row is skipped; the reset (force) writes every row', () => {
  const s = pad1Store();
  setBinding(s, 'JoystickButton3', 'Sneak', false);   // the player put Sneak on Y
  applyPlusPadLayout(s);
  assert.equal(s.secondary.get('JoystickButton3'), 'Sneak', 'their Y stands');
  applyPlusPadLayout(s, { force: true });
  assert.equal(s.secondary.get('JoystickButton3'), 'Jump', 'the reset is the Plus layout whole');
});

test('PADPLUS1 crossbar mapping: two sets of eight - the d-pad keeps the diamond\'s order (slots 1-4), the face buttons Y B A X, RB adds eight', () => {
  assert.equal(CROSSBAR_CODES.length, 8);
  assert.equal(crossbarSlot(0, 'JoystickAxis7Button0'), 0, 'LB + up is slot 1');
  assert.equal(crossbarSlot(0, 'JoystickAxis6Button0'), 3, 'LB + right is slot 4 (QuickOffHand\'s)');
  assert.equal(crossbarSlot(0, 'JoystickButton3'), 4, 'LB + Y');
  assert.equal(crossbarSlot(1, 'JoystickButton0'), 14, 'RB + A');
  assert.equal(crossbarSlot(0, 'JoystickButton4'), -1, 'a bumper is no slot');
  for (let i = 0; i < 16; i++) assert.equal(crossbarSlot(Math.floor(i / 8), crossbarCodeOf(i)), i, `slot ${i} round-trips`);
});

test('PADPLUS1 model: sixteen slots, the keyboard\'s ten first; a free slot is looked for in the size asked; the save carries all sixteen', () => {
  assert.equal(HOTBAR_SIZE, 10); assert.equal(HOTBAR_CAPACITY, 16);
  clearHotbar();
  for (let i = 0; i < 10; i++) setHotbarSlot(i, { type: 'spell', index: i, name: `S${i}` });
  assert.equal(firstFreeHotbarSlot(), -1, 'the keyboard bar is full');
  assert.equal(firstFreeHotbarSlot(16), 10, 'the crossbar has room');
  setHotbarSlot(15, { type: 'spell', index: 99, name: 'Last' });
  assert.equal(hotbarView(null).length, 16);
  assert.equal(hotbarView(null, { size: 10 }).length, 10);
  const saved = quickslotSaveData();
  clearHotbar();
  restoreQuickslotSaveData(saved);
  assert.equal(hotbarEntry(15)?.name, 'Last', 'slot 16 survives a save');
  clearHotbar();
});

test('PADPLUS1 glyphs: vectors for every button in both families, sized as asked, cached; nothing for a keyboard code', () => {
  for (const fam of ['xbox', 'ps']) for (const c of HD_GLYPH_CODES) {
    const m = hdGlyphMarkup(fam, c, { size: 30 });
    assert.match(m, /^<svg [^>]*width="30"[^>]*viewBox="0 0 32 32"/, `${fam} ${c}`);
    assert.doesNotMatch(m, /NaN/, `${fam} ${c} draws finite numbers`);
  }
  assert.equal(hdGlyphSvg('xbox', 'KeyW'), null);
  assert.equal(hdGlyphSvg('xbox', 'JoystickButton0'), hdGlyphSvg('xbox', 'JoystickButton0'));
  assert.notEqual(hdGlyphSvg('xbox', 'JoystickButton0'), hdGlyphSvg('ps', 'JoystickButton0'), 'A and Cross differ');
});

test('PADPLUS1 prompts: Select, Options, Back always; Tabs only with a strip up', () => {
  assert.deepEqual(windowPrompts({ tabs: false }).map(([, w]) => w), ['Select', 'Options', 'Back', 'Jump to', 'Scroll']);
  assert.ok(windowPrompts({ tabs: true }).some(([c, w]) => w === 'Tabs' && c.join() === 'JoystickButton4,JoystickButton5'));
});

test('PADPLUS1 poller under Plus: LB + A presses crossbar slot 7 and NOT activate; letting LB go first leaks nothing; L3 latches Run until the stick rests; a window stands the world codes down', () => {
  const prev = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  resetPrefs(); resetSettings();
  setPref('plusPadLayout', 0);
  const store = pad1Store(); setBindings(store);
  const pressed = [], sets = [];
  registerCrossbar({ inForce: () => true, press: (i) => pressed.push(i), setActive: (s) => sets.push(s) });
  const events = []; const dispatch = (t, c) => events.push(`${t}:${c}`);
  let overlay = false, paused = false;
  const pad = { connected: true, mapping: 'standard', id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  try {
    const canvas = { dispatchEvent() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), style: {} };
    const gp = attachGamepad(canvas, { overlayActive: () => overlay, paused: () => paused, attack() {}, look() {} }, { getPads: () => [pad], dispatch, makeEvent: (type, init) => ({ type, ...init }) });
    gp.tick(1 / 60);
    assert.equal(getBinding(store, 'Jump', false), 'JoystickButton3', 'the layout moved on the first Plus frame');
    // LB held, then A
    pad.buttons[4].pressed = true; gp.tick(1 / 60);
    assert.equal(sets.at(-1), 0, 'the left set lights');
    assert.ok(!events.includes('keydown:JoystickButton4'), 'LB is the crossbar\'s alone');
    pad.buttons[0].pressed = true; gp.tick(1 / 60);
    assert.deepEqual(pressed, [6], 'LB + A = slot 7');
    assert.ok(!events.includes('keydown:Mouse0') && !events.includes('keydown:JoystickButton0'), `A did not also activate: ${events}`);
    pad.buttons[4].pressed = false; gp.tick(1 / 60);
    assert.ok(!events.includes('keydown:Mouse0'), 'LB let go first: A still held, still swallowed');
    pad.buttons[0].pressed = false; gp.tick(1 / 60);
    assert.equal(sets.at(-1), null);
    // RB + d-pad down
    pad.buttons[5].pressed = true; pad.buttons[13].pressed = true; pad.buttons[13].value = 1; gp.tick(1 / 60);
    assert.deepEqual(pressed, [6, 9], 'RB + down = slot 10');
    pad.buttons[5].pressed = false; pad.buttons[13].pressed = false; pad.buttons[13].value = 0; gp.tick(1 / 60);
    // run toggle
    events.length = 0;
    pad.axes[1] = -0.9;                                    // walking forward
    pad.buttons[10].pressed = true; gp.tick(1 / 60);
    assert.ok(events.includes('keydown:JoystickButton8'), 'L3 latches Run');
    pad.buttons[10].pressed = false; gp.tick(1 / 60);
    assert.ok(!events.includes('keyup:JoystickButton8'), 'still running with L3 released');
    pad.axes[1] = 0;
    for (let i = 0; i < 40; i++) gp.tick(1 / 60);
    assert.ok(events.includes('keyup:JoystickButton8'), 'the stick at rest lets Run go');
    // a window: B is Back (Escape), not the pack; Y does not jump
    events.length = 0; overlay = true; gp.tick(1 / 60);   // the window opens first; a press after it
    pad.buttons[1].pressed = true; pad.buttons[3].pressed = true; gp.tick(1 / 60);
    assert.ok(!events.includes('keydown:JoystickButton1') && !events.includes('keydown:JoystickButton3'), `world codes stand down: ${events}`);
    assert.ok(events.includes(`keydown:${getBinding(store, 'Escape')}`), 'B is Back');
    // PADPLUS2: a dungeon's window - the town slot empty, the host paused - is a window to the pad too
    pad.buttons[1].pressed = false; pad.buttons[3].pressed = false; gp.tick(1 / 60);
    events.length = 0; overlay = false; paused = true;
    pad.buttons[1].pressed = true; gp.tick(1 / 60);
    assert.ok(!events.includes('keydown:JoystickButton1'), `B does not open the pack under a dungeon window: ${events}`);
    assert.ok(events.includes(`keydown:${getBinding(store, 'Escape')}`), 'B is Back there too');
    gp.dispose();
  } finally {
    registerCrossbar(null);
    globalThis.window = prev;
    resetPrefs();
  }
});

test('PADPLUS2 RT under Plus: the right stick keeps looking while RT is held - Click-or-Hold (the default) holds the attack; gesture mode draws a one-frame stroke, repeated while held, leaning with the left stick', () => {
  const prev = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  resetPrefs(); resetSettings();
  setPref('plusPadLayout', 0);
  const store = pad1Store(); setBindings(store);
  const looks = [], attacks = [];
  const pad = { connected: true, mapping: 'standard', id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  try {
    const canvas = { dispatchEvent() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), style: {} };
    const gp = attachGamepad(canvas, { overlayActive: () => false, paused: () => false, attack: (dx, dy, h) => attacks.push([dx, dy, h]), look: (dx, dy) => looks.push([dx, dy]) },
      { getPads: () => [pad], dispatch() {}, makeEvent: (type, init) => ({ type, ...init }) });
    gp.tick(1 / 60);
    // the shipped Click-or-Hold mode: RT held is the swing held, and the camera keeps turning
    pad.buttons[7] = { pressed: true, value: 1 }; pad.axes[2] = 0.9;
    for (let i = 0; i < 20; i++) gp.tick(1 / 60);
    assert.equal(looks.length, 20, 'the camera turns every frame with RT held');
    assert.equal(attacks.length, 1, 'one press, held');
    assert.equal(attacks[0][2], true);
    assert.ok(attacks.every(([, , h]) => h), 'no drag stolen from the right stick');
    pad.buttons[7] = { pressed: false, value: 0 }; gp.tick(1 / 60);
    assert.deepEqual(attacks.at(-1), [0, 0, false], 'let go with RT');
    // gesture mode: a stroke pressed for one frame, again while held
    setValue('Controls', 'WeaponSwingMode', '0');
    attacks.length = 0; looks.length = 0;
    pad.buttons[7] = { pressed: true, value: 1 };
    gp.tick(1 / 60);
    const press = attacks.at(-1);
    assert.equal(press[2], true);
    assert.ok(Math.hypot(press[0], press[1]) > 20, `a stroke long enough to swing: ${press}`);
    gp.tick(1 / 60);
    assert.deepEqual(attacks.at(-1), [0, 0, false], 'let go the next frame - the host never holds a gesture swing, so the look is not dropped');
    for (let i = 0; i < 30; i++) gp.tick(1 / 60);
    assert.equal(looks.length, 32, 'still looking every frame');
    assert.ok(attacks.filter((a) => a[2]).length >= 2, 'held RT swings again');
    attacks.length = 0; pad.axes[1] = -0.9;   // lean forward: a thrust, up the screen
    for (let i = 0; i < 30; i++) gp.tick(1 / 60);
    const up = attacks.find((a) => a[2]);
    assert.ok(up && up[1] < 0 && Math.abs(up[0]) < 1, `forward is up the screen: ${up}`);
    gp.dispose();
  } finally { globalThis.window = prev; resetPrefs(); resetSettings(); }
});

test('PADPLUS3: B opens the pack and closes it and neither press leaks into the other state; the bare d-pad is swap hands / map / log / rest and never a crossbar slot', () => {
  const prev = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  resetPrefs(); resetSettings();
  setPref('plusPadLayout', 0);
  const store = pad1Store(); setBindings(store);
  const pressed = [];
  registerCrossbar({ inForce: () => true, press: (i) => pressed.push(i), setActive() {} });
  const events = []; const dispatch = (t, c) => events.push(`${t}:${c}`);
  let overlay = false;
  const pad = { connected: true, mapping: 'standard', id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const esc = () => `keydown:${getBinding(store, 'Escape')}`;
  try {
    const canvas = { dispatchEvent() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), style: {} };
    const gp = attachGamepad(canvas, { overlayActive: () => overlay, paused: () => false, attack() {}, look() {} }, { getPads: () => [pad], dispatch, makeEvent: (type, init) => ({ type, ...init }) });
    gp.tick(1 / 60);
    // B in the world: the pack
    pad.buttons[1].pressed = true; gp.tick(1 / 60);
    assert.ok(events.includes('keydown:JoystickButton1'), 'B opens the pack');
    events.length = 0; overlay = true;                       // the pack is up, B still held
    for (let i = 0; i < 5; i++) gp.tick(1 / 60);
    assert.ok(!events.includes(esc()), `the opening press is not also Back: ${events}`);
    pad.buttons[1].pressed = false; gp.tick(1 / 60);
    pad.buttons[1].pressed = true; gp.tick(1 / 60);
    assert.ok(events.includes(esc()), 'a new B is Back');
    events.length = 0; overlay = false;                      // the pack closed, B still held
    for (let i = 0; i < 5; i++) gp.tick(1 / 60);
    assert.ok(!events.includes('keydown:JoystickButton1'), `the closing press does not reopen it: ${events}`);
    pad.buttons[1].pressed = false; gp.tick(1 / 60);
    // the bare d-pad
    events.length = 0;
    pad.buttons[12] = { pressed: true, value: 1 }; gp.tick(1 / 60);
    assert.deepEqual(pressed, [], 'no slot without a bumper');
    // PADPLUS10: up has a hold now (the next interaction mode), so its tap fires on the RELEASE
    assert.ok(!events.includes(`keydown:${getBinding(store, 'SwitchHand')}`), 'the press alone swaps nothing yet - it might be a hold');
    pad.buttons[12] = { pressed: false, value: 0 }; gp.tick(1 / 60);
    assert.ok(events.includes(`keydown:${getBinding(store, 'SwitchHand')}`), `a tap of up swaps hands: ${events}`);
    assert.ok(!events.includes('keydown:JoystickAxis7Button0'), 'the quickslot row does not also fire');
    gp.tick(1 / 60);
    assert.ok(events.includes(`keyup:${getBinding(store, 'SwitchHand')}`), 'one press');
    pad.buttons[4].pressed = true; gp.tick(1 / 60);
    pad.buttons[12] = { pressed: true, value: 1 }; gp.tick(1 / 60);
    assert.deepEqual(pressed, [0], 'LB + up is slot 1');
    // PADPLUS8: the bare d-pad right is Rest
    pad.buttons[12] = { pressed: false, value: 0 }; pad.buttons[4].pressed = false; gp.tick(1 / 60);
    events.length = 0;
    pad.buttons[15] = { pressed: true, value: 1 }; gp.tick(1 / 60);
    assert.ok(getBinding(store, 'Rest'), 'Rest has a key');
    assert.ok(events.includes(`keydown:${getBinding(store, 'Rest')}`), `right rests: ${events}`);
    assert.ok(!events.includes(`keydown:${getBinding(store, 'CharacterSheet')}`), 'and is no longer the sheet');
    gp.dispose();
  } finally { registerCrossbar(null); globalThis.window = prev; resetPrefs(); }
});

test('PADPLUS4: the damage numbers\' layer (click-through, full screen) is not a window; a door host that takes the pointer is; the pad in hand hides the mouse pointer', () => {
  const prevW = globalThis.window, prevD = globalThis.document, prevCS = globalThis.getComputedStyle;
  const mkEl = (tag) => {
    const el = { tagName: tag, style: {}, children: [], textContent: '', classList: new Set(), attrs: {},
      setAttribute(k, v) { this.attrs[k] = v; }, append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); },
      remove() {}, getClientRects: () => [1], isConnected: true };
    el.classList.toggle = (c, on) => { if (on ?? !el.classList.has(c)) el.classList.add(c); else el.classList.delete(c); };
    el.classList.contains = (c) => el.classList.has(c);
    return el;
  };
  const hitnums = { ...mkEl('div'), id: 'enhanced-hitnums', pe: 'none' };
  const root = mkEl('html');
  const doc = { documentElement: root, head: mkEl('head'), body: { ...mkEl('body'), children: [hitnums] },
    getElementById: () => null, createElement: mkEl, dispatchEvent() {}, elementFromPoint: () => null, querySelectorAll: () => [] };
  globalThis.document = doc;
  globalThis.getComputedStyle = (n) => ({ display: 'block', visibility: 'visible', pointerEvents: n.pe ?? 'auto' });
  globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  resetPrefs(); resetSettings();
  setPref('plusPadLayout', 0);
  const store = pad1Store(); setBindings(store);
  const events = []; const dispatch = (t, c) => events.push(`${t}:${c}`);
  const pad = { connected: true, mapping: 'standard', id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  try {
    const canvas = { dispatchEvent() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), style: {} };
    const gp = attachGamepad(canvas, { overlayActive: () => false, paused: () => false, attack() {}, look() {} }, { getPads: () => [pad], dispatch, makeEvent: (type, init) => ({ type, ...init }) });
    gp.tick(1 / 60);
    pad.axes[0] = 0.9; for (let i = 0; i < 3; i++) gp.tick(1 / 60); pad.axes[0] = 0;   // the stick: the pad is the live device
    gp.tick(1 / 60);
    assert.ok(root.classList.has('plus-padhide'), 'the mouse pointer is hidden while the pad is in hand');
    pad.buttons[1].pressed = true; gp.tick(1 / 60);
    assert.ok(events.includes('keydown:JoystickButton1'), `the hit numbers are no window - B opens the pack: ${events}`);
    pad.buttons[1].pressed = false; gp.tick(1 / 60);
    // a real door: full screen and it takes the pointer
    doc.body.children.push({ ...mkEl('div'), id: 'enhanced-inventory' });
    for (let i = 0; i < 20; i++) gp.tick(1 / 60);            // past the 0.2 s look
    events.length = 0;
    pad.buttons[1].pressed = true; gp.tick(1 / 60);
    assert.ok(!events.includes('keydown:JoystickButton1'), 'under the door B is not the pack');
    assert.ok(events.includes(`keydown:${getBinding(store, 'Escape')}`), 'it is Back');
    gp.dispose();
    assert.ok(!root.classList.has('plus-padhide'), 'the pointer comes back when the layer goes');
  } finally { globalThis.window = prevW; globalThis.document = prevD; globalThis.getComputedStyle = prevCS; resetPrefs(); }
});

test('PADPLUS5: in a window X is the quick act on what is under the cursor, and the prompt bar names it while the pack is up', async () => {
  const { registerQuickAct } = await import('../src/ui/plusPad.js');
  assert.ok(windowPrompts({ quick: true }).some(([c, w]) => c[0] === 'JoystickButton2' && /Equip/.test(w)));
  assert.ok(!windowPrompts({ quick: false }).some(([c]) => c[0] === 'JoystickButton2'));
  const prevW = globalThis.window, prevD = globalThis.document;
  const target = { id: 'row' };
  globalThis.document = { elementFromPoint: () => target, body: null, querySelectorAll: () => [], getElementById: () => null };
  globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  resetPrefs(); resetSettings();
  setPref('plusPadLayout', 0);
  setBindings(pad1Store());
  const acted = [];
  registerQuickAct({ act: (t) => { acted.push(t); return true; }, available: () => true });
  const pad = { connected: true, mapping: 'standard', id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  let overlay = false;
  try {
    const canvas = { dispatchEvent() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), style: {} };
    const gp = attachGamepad(canvas, { overlayActive: () => overlay, paused: () => false, attack() {}, look() {} }, { getPads: () => [pad], dispatch() {}, makeEvent: (type, init) => ({ type, ...init }) });
    pad.axes[0] = 0.9; gp.tick(1 / 60); pad.axes[0] = 0; gp.tick(1 / 60);   // the pad is live: the cursor is born
    overlay = true; gp.tick(1 / 60);
    pad.buttons[2].pressed = true; gp.tick(1 / 60); gp.tick(1 / 60);
    assert.deepEqual(acted, [target], 'one X, one act, on the element under the cursor');
    gp.dispose();
  } finally { registerQuickAct(null); globalThis.window = prevW; globalThis.document = prevD; resetPrefs(); }
});

test('PADPLUS6: looking at loot, d-pad up/down move the plaque\'s highlight (held, it repeats), right is Take all, left is Open - and the bare d-pad\'s map / log / sheet / swap hands stay shut', async () => {
  const QL = await import('../src/systems/quickLoot.js');
  const prevW = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  resetPrefs(); resetSettings();
  setPref('plusPadLayout', 0);
  const store = pad1Store(); setBindings(store);
  registerCrossbar({ inForce: () => true, press() {}, setActive() {} });
  const events = []; const dispatch = (t, c) => events.push(`${t}:${c}`);
  const frame = { kind: 'actions', key: 'corpse', rows: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] };
  const pad = { connected: true, mapping: 'standard', id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const tick = (gp) => { gp.tick(1 / 60); QL.foldQuickLoot(frame); };
  try {
    QL.resetQuickLoot();
    QL.foldQuickLoot(frame);
    assert.ok(QL.quickLootSelection(), 'the plaque lists rows');
    const row0 = QL.quickLootSelection().row;
    const canvas = { dispatchEvent() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), style: {} };
    const gp = attachGamepad(canvas, { overlayActive: () => false, paused: () => false, attack() {}, look() {} }, { getPads: () => [pad], dispatch, makeEvent: (type, init) => ({ type, ...init }) });
    tick(gp);
    pad.buttons[13] = { pressed: true, value: 1 }; tick(gp);                    // d-pad down
    assert.equal(QL.quickLootSelection().row, row0 + 1, 'down moves the highlight one row');
    assert.ok(!events.includes(`keydown:${getBinding(store, 'AutoMap')}`), 'and does not open the map');
    for (let i = 0; i < 40; i++) tick(gp);                                         // held: it repeats
    assert.ok(QL.quickLootSelection().row > row0 + 1, 'held, it keeps going');
    pad.buttons[13] = { pressed: false, value: 0 }; tick(gp);
    pad.buttons[15] = { pressed: true, value: 1 }; tick(gp);                     // d-pad right
    assert.ok(events.includes(`keydown:${getBinding(store, 'QuickLootAll')}`), 'right is Take all');
    assert.ok(!events.includes(`keydown:${getBinding(store, 'Rest')}`), 'not rest');
    pad.buttons[15] = { pressed: false, value: 0 }; tick(gp);
    // looking away: the d-pad is the d-pad again
    QL.resetQuickLoot(); gp.tick(1 / 60);
    events.length = 0;
    pad.buttons[13] = { pressed: true, value: 1 }; gp.tick(1 / 60);
    pad.buttons[13] = { pressed: false, value: 0 }; gp.tick(1 / 60);   // PADPLUS9: a tap is the map on its release
    assert.ok(events.includes(`keydown:${getBinding(store, 'AutoMap')}`), 'with no loot in front, down is the map');
    gp.dispose();
  } finally { QL.resetQuickLoot(); registerCrossbar(null); globalThis.window = prevW; resetPrefs(); }
});

test('PADPLUS7: every carry out of the pack raises the tucked bar - the ghost starts it and ends it, so a mouse or pad drag (no finger hold, no drag lock) does too', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/ui/enhancedInventory.js', import.meta.url), 'utf8');
  const start = src.slice(src.indexOf('function ghostStart(item) {'), src.indexOf('}', src.indexOf('document.body?.appendChild(ghost);')) + 1);
  assert.match(start, /setHotbarDragging\(true\)/, 'the ghost raises it');
  assert.match(src, /const ghostEnd = \(\) => \{[^\n]*setHotbarDragging\(false\)/, 'and its end lowers it');
  const onMove = src.slice(src.indexOf('const onDragMove = (e) => {'), src.indexOf('dragTo(e.clientX, e.clientY);', src.indexOf('const onDragMove = (e) => {')));
  assert.match(onMove, /ghostStart\(drag\.item\)/, 'the mouse arm starts the ghost - the path PADPLUS5 missed');
  const hb = readFileSync(new URL('../src/ui/enhancedHotbar.js', import.meta.url), 'utf8');
  assert.match(hb, /function arm\(\) \{[\s\S]{0,120}bar\?\.classList\.add\('dragging'\)/, 'a spell or slot carried out of the book raises it too');
});

test('PADPLUS9: d-pad down - a tap is the map (on release), a hold is the travel map, and down again closes the map it opened', () => {
  const prev = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  resetPrefs(); resetSettings();
  setPref('plusPadLayout', 0);
  const store = pad1Store(); setBindings(store);
  registerCrossbar({ inForce: () => true, press() {}, setActive() {} });
  const events = []; const dispatch = (t, c) => events.push(`${t}:${c}`);
  let overlay = false;
  const pad = { connected: true, mapping: 'standard', id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const key = (a) => `keydown:${getBinding(store, a)}`;
  const down = (on) => { pad.buttons[13] = { pressed: on, value: on ? 1 : 0 }; };
  try {
    const canvas = { dispatchEvent() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), style: {} };
    const gp = attachGamepad(canvas, { overlayActive: () => overlay, paused: () => false, attack() {}, look() {} }, { getPads: () => [pad], dispatch, makeEvent: (type, init) => ({ type, ...init }) });
    const tick = (n = 1) => { for (let i = 0; i < n; i++) gp.tick(1 / 60); };
    tick();
    // a tap
    down(true); tick(3);
    assert.ok(!events.includes(key('AutoMap')), 'the press alone opens nothing yet - it might be a hold');
    down(false); tick();
    assert.ok(events.includes(key('AutoMap')), `the release of a tap is the map: ${events}`);
    assert.ok(!events.includes(key('TravelMap')), 'and not the travel map');
    // the map comes up; down again closes it
    tick(); overlay = true; tick(2);
    events.length = 0;
    down(true); tick();
    assert.ok(events.includes(key('Escape')), `down again closes the map: ${events}`);
    down(false); tick();
    overlay = false; tick(3);
    // a hold
    events.length = 0;
    down(true); tick(40);
    assert.equal(events.filter((e) => e === key('TravelMap')).length, 1, `held, it is the travel map, once: ${events}`);
    down(false); tick();
    assert.ok(!events.includes(key('AutoMap')), 'and letting go after a hold is not also the map');
    // the travel map up: down is the cursor's, not a close
    overlay = true; tick(2); events.length = 0;
    down(true); tick(); down(false); tick();
    assert.ok(!events.includes(key('Escape')), 'down does not close the travel map - it has controls below controls');
    gp.dispose();
  } finally { registerCrossbar(null); globalThis.window = prev; resetPrefs(); }
});
