// AUDIT LOCKPICK, LANE C (2026-10-26, the owner: "Also ensure this is enhanced ui plus" - bible/01-Overview/audits/
// Audit-Lockpick.md): THE LOCK'S WINDOW IN THE KIT. The real window (ui/lockpickWindow.js) behind the real door
// (ui/lockpickDoor.js) over test/lockDom.mjs, and the real Plus pad poller (ui/gamepadInput.js attachGamepad):
//   C1 - the window is the stone-and-brass kit's by role (FRAME_ROLES), its layout the Plus sheet's, the pixel face; on
//        the classic skin it lays the layout and the kit cut to its own selectors, and nothing of another surface.
//   C2 - it never stands past a short screen: it scrolls, and a phone on its side lays the lock beside its words.
//   C3 - the pad: under Plus the d-pad moves the pick and brings the cursor to its chamber, A presses that pin, X is the
//        Auto attempt and the prompt bar says so; the classic pad's d-pad and X arrive as keys and are read; a host's
//        raw code is read at the door.
//   C4 - Enter on a focused press is the press's; S1 - a field's typing is the field's.
//   C5 - a chamber's target is its whole pitch, and a tap off every chamber presses nothing.
//   C6/C7 - the Auto attempt is the kit's warn press and says what it costs; a refused press says why; Gentle work's
//        timing press says why it does nothing, and no binding pin is lit under it.
//   C9 - plain words: no dash asides, the keys told apart from the presses' names, the pins' count in the keys line.
//   C12 - the canvas's backing store is at the screen's density.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from '../../lockDom.mjs';
import { FRAME_ROLES, frameCss } from '../../../src/ui/enhanced/enhancedFrame.js';
import { LOCK_CSS, PLUS_CSS } from '../../../src/ui/enhanced/enhancedPlusStyle.js';
import { PIXEL_STACK } from '../../../src/ui/pixelifyFive.js';
import { setUiSkin } from '../../../src/systems/uiSkin.js';
import { createLockpickAct, PIN } from '../../../src/systems/lockpick/lockpickAct.js';
import { createLockpickOverlay } from '../../../src/ui/lockpickDoor.js';
import { LOCK_WORDS, LOCK_W, LOCK_GEOM, chamberX, chamberAt, lockKeyAct, lockSkinCss, LOCK_SKIN_STYLE_ID } from '../../../src/ui/lockpickWindow.js';
import { lockArm, lockPrompts } from '../../../src/ui/plus/plusPad.js';
import { createBindings, resetDefaults } from '../../../src/systems/inputActions.js';
import { setBindings } from '../../../src/ui/input.js';
import { attachGamepad } from '../../../src/ui/gamepadInput.js';
import { setPref, _resetForTests as resetPrefs } from '../../../src/systems/uiPrefs.js';
import { _resetForTests as resetSettings } from '../../../src/systems/settings/settings.js';

const dom = installDom();
const find = (cls) => dom.doc.body.find((e) => e.className.split(' ').includes(cls));
/** The real door over a six-pin lock (lock 16), its act's dice `rng`. */
function stand({ gentle = false, rng = () => 0.5, picks = 3 } = {}) {
  const act = createLockpickAct({ lock: 16, chance: 30, seed: 7, skill: 60, rng });
  const answers = [];
  const ov = createLockpickOverlay({ act, what: 'the door', seed: 7, skill: 60, gentle, reduced: () => false, difficulty: '', picks: () => picks,
    onAnswer: (a) => answers.push(a), onClose: () => {} });
  return { act, ov, answers, word: () => find('lk-word').textContent, canvas: find('lk-canvas') };
}
const pointer = (canvas, type, x) => canvas.dispatchEvent({ type, button: 0, clientX: x * (520 / LOCK_W), clientY: 150, preventDefault() {} });

test('AUDIT LOCKPICK C1: the window is the kit\'s by role - its frame, header, well, presses and readouts - its layout the Plus sheet\'s in the pixel face and no paint of its own; the classic skin lays the layout and the kit cut to the lock\'s selectors alone (mutants: a role dropped; the layout off the Plus sheet; the classic sheet unlaid; the cut taking another surface\'s rules)', () => {
  for (const [role, sel] of [['window', 'body .lk-win'], ['header', 'body .lk-head'], ['well', 'body .lk-canvas'], ['button', 'body .lk-acts button'],
    ['warn', 'body .lk-acts .lk-auto'], ['chip', 'body .lk-meta > span']]) assert.ok(FRAME_ROLES[role].includes(sel), `${role}: ${sel}`);
  assert.ok(!FRAME_ROLES.warn.some((s) => s.includes('lk-leave')), 'Leave is a plain press - leaving costs nothing (C6)');
  assert.ok(frameCss().includes('body .lk-win'), 'the kit paints the frame');
  assert.ok(PLUS_CSS.includes(LOCK_CSS), 'the layout rides the Plus sheet');
  assert.ok(LOCK_CSS.includes(PIXEL_STACK), 'the pixel face');
  assert.doesNotMatch(LOCK_CSS, /Georgia|serif/);
  for (const sel of ['.lk-win', '.lk-head', '.lk-canvas', '.lk-acts button', '.lk-meta > span']) {
    const rule = LOCK_CSS.match(new RegExp(`\\n${sel.replace(/[.>]/g, (c) => `\\${c}`)} \\{[^}]*\\}`))?.[0];
    assert.ok(rule, sel);
    assert.doesNotMatch(rule, /background|border-color|box-shadow|border-image/, `${sel}: the kit paints it`);
  }
  // the classic skin's own sheet
  const sheet = lockSkinCss();
  assert.ok(sheet.includes(LOCK_CSS) && sheet.includes('.lk-win'), 'the layout and the kit\'s frame for it');
  const kitPart = sheet.slice(sheet.indexOf(LOCK_CSS) + LOCK_CSS.length);
  assert.ok(kitPart.length > 200, 'the kit cut to the lock');
  for (const m of kitPart.matchAll(/([^{}]+)\{/g)) {
    const prelude = m[1].trim();
    if (prelude.startsWith('@') || /^(from|to|[\d.]+%)$/.test(prelude)) continue;   // the kit's at-rules ride whole (scopeRules), their rules scoped
    assert.ok(prelude.split(',').every((s) => s.includes('.lk-')), `only the lock's selectors: ${prelude}`);
  }
  try {
    setUiSkin('classic');
    const { ov } = stand();
    assert.equal(dom.doc.getElementById(LOCK_SKIN_STYLE_ID)?.textContent, sheet, 'classic: the window lays its own sheet');
    ov.dispose();
  } finally { setUiSkin('enhanced'); }
});

test('AUDIT LOCKPICK C2: never past a short screen - the window scrolls, the lock alone takes a finger\'s drag, and a phone on its side lays the lock beside its words (mutant: the window\'s height unbounded)', () => {
  const win = LOCK_CSS.match(/\.lk-win \{[^}]*\}/)[0];
  assert.match(win, /max-height: calc\(100dvh - 16px\)/);
  assert.match(win, /overflow-y: auto/);
  assert.doesNotMatch(win, /touch-action/, 'the window scrolls under a finger');
  assert.match(LOCK_CSS.match(/\.lk-canvas \{[^}]*\}/)[0], /touch-action: none/);
  assert.match(LOCK_CSS, /@media \(max-height: 520px\) \{[^@]*grid-template-areas: "head head" "lock word" "lock meta" "lock acts"/);
  assert.match(LOCK_CSS, /@media \(pointer: coarse\) \{[^@]*\.lk-acts button \{ min-height: 44px/, 'a finger\'s press (C5)');
  assert.match(LOCK_CSS, /html\.plus-pad-prompts-visible \.lk-win \{ max-height: calc\(100dvh - var\(--plus-pad-clearance, 0px\) - 16px\); \}/, 'S3: above the pad\'s prompt bar, never under it');
});

test('AUDIT LOCKPICK B3: a snapped pick\'s count reads right at one, a few and many in every language, through the real t() over each real table (a table\'s plural dropped fails it)', async () => {
  const { readFileSync } = await import('node:fs');
  const tm = await import('../../../src/systems/textManager.js');
  const want = { es: ['Queda 1.', 'Quedan 2.'], it: ['Ne resta 1.', 'Ne restano 2.'], 'pt-BR': ['Resta 1.', 'Restam 2.'], bg: ['Остава 1.', 'Остават 2.'],
    cs: ['Zbývá 1.', 'Zbývají 2.', 'Zbývá 5.'], ru: ['Осталась 1.', 'Осталось 2.', 'Осталось 5.'] };
  try {
    for (const [lang, w] of Object.entries(want)) {
      tm.patchLocaleTable(lang, 'Port_Strings', tm.parseStringTableCsv(readFileSync(new URL(`../../../locales/${lang}/Port_Strings.csv`, import.meta.url), 'utf8')));
      tm.setLocale(lang);
      [1, 2, 5].slice(0, w.length).forEach((n, i) => assert.ok(LOCK_WORDS.break(n).endsWith(w[i]), `${lang} ${n}: ${LOCK_WORDS.break(n)}`));
    }
  } finally { tm.setLocale('en'); }
  assert.equal(LOCK_WORDS.break(2), 'Your lockpick snaps! 2 left.');
});

test('AUDIT LOCKPICK C3: the classic pad\'s d-pad and X, and a host\'s raw code, are read - the pick moves, a pin lifts, the Auto attempt rolls (mutants: the pad codes unread; the door\'s input deaf to codes)', () => {
  assert.equal(lockKeyAct('JoystickAxis6Button0'), 'right'); assert.equal(lockKeyAct('JoystickAxis6Button1'), 'left');
  assert.equal(lockKeyAct('JoystickAxis7Button0'), 'press'); assert.equal(lockKeyAct('JoystickButton2'), 'auto');
  assert.equal(lockKeyAct('Digit3'), 'pin:2'); assert.equal(lockKeyAct('JoystickButton0'), null, 'A is the cursor\'s click - never a second press');
  const { act, ov, answers } = stand();
  dom.key('JoystickAxis6Button0'); dom.key('JoystickAxis6Button0');
  assert.equal(act.state.pos, 2, 'the classic pad\'s d-pad, at the window\'s capture');
  ov.input('ArrowLeft');
  assert.equal(act.state.pos, 1, 'a host\'s raw code at the door');
  ov.input('JoystickAxis7Button0');
  assert.notEqual(act.state.pins[1].phase, PIN.rest, 'a pin lifted');
  dom.key('JoystickButton2');
  assert.ok(answers.length >= 2 && ['open', 'break'].includes(answers.at(-1)), `X rolled: ${answers}`);
  ov.input('Escape');
  assert.equal(ov.done, true);
});

test('AUDIT LOCKPICK C3: under Plus the real poller\'s d-pad moves the pick and brings the cursor to its chamber, A presses that pin, X is the Auto attempt, and the prompt bar is the lock\'s own; shut, the arm is gone (mutants: the d-pad the window\'s jump; X the quick act; the window\'s prompts; the arm left registered)', () => {
  const prevW = globalThis.window;
  resetPrefs(); resetSettings(); setPref('plusPadLayout', 0);
  const store = createBindings(); resetDefaults(store); setBindings(store);
  const { act, ov, answers, canvas } = stand({ rng: () => 0 });
  assert.ok(lockArm(), 'the arm stands while the window does');
  dom.doc.querySelectorAll = () => []; dom.doc.querySelector = () => null;
  dom.doc.elementFromPoint = (x, y) => (x >= 0 && x <= 520 && y >= 0 && y <= 260 ? canvas : null);
  const pad = { connected: true, mapping: 'standard', id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const btn = (i, on) => { pad.buttons[i].pressed = on; pad.buttons[i].value = on ? 1 : 0; };
  const prompts = () => (dom.doc.body.find((e) => e.id === 'plus-pad-prompts')?.children ?? []).map((p) => p.children.at(-1)?.textContent);
  try {
    const host = { dispatchEvent() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), style: {} };
    const gp = attachGamepad(host, { overlayActive: () => true, paused: () => false, attack() {}, look() {} },
      { getPads: () => [pad], dispatch() {}, makeEvent: (type, init) => ({ type, ...init, preventDefault() {} }) });
    pad.axes[0] = 0.9; gp.tick(1 / 60); pad.axes[0] = 0; gp.tick(1 / 60); gp.tick(1 / 60);   // the pad is live: the cursor is born
    assert.deepEqual(prompts(), lockPrompts().map(([, w]) => w), 'the lock\'s prompt row');
    btn(15, true); gp.tick(1 / 60); btn(15, false); gp.tick(1 / 60);
    btn(15, true); gp.tick(1 / 60); btn(15, false); gp.tick(1 / 60);
    assert.equal(act.state.pos, 2, 'd-pad right twice: the pick is two pins along');
    btn(0, true); gp.tick(1 / 60); btn(0, false); gp.tick(1 / 60);
    assert.equal(answers.length, 1, 'A pressed a pin - the cursor stood on its chamber');
    assert.equal(act.state.pos, 2, 'the one the pick is under');
    btn(2, true); gp.tick(1 / 60); btn(2, false); gp.tick(1 / 60);
    assert.equal(answers.at(-1), 'open', 'X: the Auto attempt (dice nought)');
    gp.dispose();
  } finally { globalThis.window = prevW; resetPrefs(); delete dom.doc.elementFromPoint; }
  ov.dispose();
  assert.equal(lockArm(), null, 'shut: no arm');
  assert.deepEqual(lockPrompts({ gentle: true }).map(([, w]) => w), ['Auto attempt', 'Leave'], 'Gentle work: no pin to choose');
});

test('AUDIT LOCKPICK C4, S1: Enter on a focused press is the press\'s, never a pin\'s; a field\'s typing is the field\'s (mutants: the capture takes the button\'s Enter; the capture takes a field\'s keys)', () => {
  const { act, ov } = stand();
  const auto = find('lk-auto');
  const rest = JSON.stringify(act.state.pins.map((p) => p.phase));
  const r = dom.key('Enter', { target: auto });
  assert.equal(JSON.stringify(act.state.pins.map((p) => p.phase)), rest, 'no pin pressed under the button');
  assert.deepEqual(r, { stopped: true, prevented: false }, 'the button\'s own click stands; no host is handed it again');
  const field = dom.doc.createElement('input'); dom.doc.body.append(field);
  for (const k of ['KeyD', 'KeyW', 'Space', 'Digit3', 'KeyQ']) assert.deepEqual(dom.key(k, { target: field }), { stopped: false, prevented: false }, k);
  assert.equal(act.state.pos, 0); assert.equal(JSON.stringify(act.state.pins.map((p) => p.phase)), rest);
  field.remove(); ov.dispose();
});

test('AUDIT LOCKPICK C5: a chamber\'s target is its whole pitch, and a tap off every chamber presses nothing (mutants: the old narrow target; the press under any tap)', () => {
  for (let n = 2; n <= 6; n++) {
    const pitch = chamberX(n, 1) - chamberX(n, 0);
    for (let i = 0; i < n - 1; i++) {
      const mid = (chamberX(n, i) + chamberX(n, i + 1)) / 2;
      assert.ok(chamberAt(n, mid - 0.5) === i && chamberAt(n, mid + 0.5) === i + 1, `${n} pins: no gap between ${i} and ${i + 1}`);
    }
    assert.ok(pitch / 2 > LOCK_GEOM.chamber * 0.9 || n === 6, 'wider than the chamber drawn');
  }
  const { act, ov, answers, canvas } = stand();
  pointer(canvas, 'pointerdown', 20);   // the wrench, off the housing
  assert.deepEqual(answers, [], 'a stray tap presses nothing');
  pointer(canvas, 'pointerdown', chamberX(act.state.n, 3) + 2);
  assert.equal(act.state.pos, 3); assert.equal(answers.length, 1, 'a tap on a chamber presses its pin');
  ov.dispose();
});

test('AUDIT LOCKPICK C6, C7: the Auto attempt says what it costs; refused, it takes the press and says why; Gentle work\'s timing press says why it does nothing (mutants: the refusal `disabled` and silent; Gentle\'s press silent)', () => {
  const { ov, word } = stand();
  const auto = find('lk-auto');
  assert.match(auto.getAttribute('title'), /snaps a pick/);
  assert.equal(auto.getAttribute('aria-disabled'), 'false');
  ov.out();
  assert.equal(auto.disabled, false, 'never `disabled` - a finger\'s tap is taken');
  assert.equal(auto.getAttribute('aria-disabled'), 'true');
  find('lk-word').textContent = '';
  dom.click(auto);
  assert.equal(word(), LOCK_WORDS.none(), 'pressed, it says why');
  ov.dispose();
  const g = stand({ gentle: true });
  assert.equal(g.word(), LOCK_WORDS.gentle());
  assert.match(LOCK_WORDS.gentle(), /snaps a pick/, 'the gentle line never promises the lock');
  for (const k of ['Space', 'ArrowRight', 'Digit2']) { find('lk-word').textContent = ''; dom.key(k); assert.equal(g.word(), LOCK_WORDS.gentlePress(), k); }
  assert.equal(find('lk-keys').textContent, LOCK_WORDS.keysGentle(), 'and the keys line offers no lift');
  g.ov.dispose();
});

test('AUDIT LOCKPICK C9, C12: plain words - no dash asides, the presses named without their keys, the keys line counts the lock\'s own pins; the canvas at the screen\'s density (mutants: a dash aside back; the key in the name; 1-6 for every lock; the canvas at one)', () => {
  for (const [k, f] of Object.entries(LOCK_WORDS)) {
    const s = f.length ? f(2, 6) : f();
    assert.doesNotMatch(s, / - /, `${k}: no dash aside`);
  }
  assert.equal(LOCK_WORDS.auto(), 'Auto attempt'); assert.equal(LOCK_WORDS.leave(), 'Leave');
  assert.match(LOCK_WORDS.keys(4), /1-4/); assert.match(LOCK_WORDS.keys(4), /Enter/);
  assert.equal(LOCK_WORDS.break(1), 'Your lockpick snaps! 1 left.');
  const prev = globalThis.devicePixelRatio;
  globalThis.devicePixelRatio = 2;
  try {
    const { ov, canvas } = stand();
    assert.equal(canvas.width, LOCK_W * 2, 'the backing store at twice');
    assert.deepEqual([find('lk-auto').textContent, find('lk-leave').textContent], ['Auto attempt', 'Leave'], 'no key in a press\'s name - Leave is the Grimoire\'s way out');
    assert.match(find('lk-keys').textContent, /1-6/, 'six pins, 1-6');
    ov.dispose();
  } finally { globalThis.devicePixelRatio = prev; }
});
