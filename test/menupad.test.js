// PAD-DOOR + PAD-SETTINGS (2026-09-27, Discord - an AYN Thor: "i can login get to the main screen but im unable to
// select online, load game anything" - "doesnt seem to let me change controller sensitivity either, i press the 1.0
// to try and change it but it doesnt register"). The front door answers a controller (ui/menuPad.js - walked in a
// real page by tools/menuPadProbe.mjs), and the four gamepad settings are numbers with steppers, not readouts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PAD, STICK_DIRECTION, REPEAT_DELAY_MS, REPEAT_MS, REFOCUS_MS, padDirection, pickDoorPad, nextFocus, nearestTo,
  padDoorFrame, attachMenuPad, domDoorUi,
} from '../src/ui/menuPad.js';
import { widgetFor, formatValue, stepValue, NUMBER_LAW } from '../src/ui/settingsLaw.js';

const pad = (held = [], axes = [0, 0]) => ({
  mapping: 'standard', connected: true, axes,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: held.includes(i) })),
});

/** A page of controls in a grid of 100 px cells: [name, col, row]. */
function fakeUi(cells) {
  const els = cells.map(([name, col, row]) => ({ name, connected: true, rect: { x: col * 100, y: row * 100, w: 80, h: 40 }, steps: 0, steppable: name.startsWith('select') }));
  const ui = {
    els, focused: null, pressed: [], backs: 0,
    candidates: () => els.filter((e) => e.connected).map((e) => ({ el: e, rect: e.rect })),
    connected: (e) => e.connected,
    active: () => (ui.focused && ui.focused.connected ? ui.focused : null),
    focus: (e) => { ui.focused = e; },
    press: (e) => ui.pressed.push(e.name),
    back: () => { ui.backs++; },
    step: (e, dir) => { if (!e.steppable) return false; e.steps += dir === 'right' ? 1 : -1; return true; },
  };
  return ui;
}
const fresh = () => ({ confirm: false, back: false, dir: null, heldAt: 0, lastRepeat: 0, lastEl: null, lastRect: null, lostAt: null });

test('PAD-DOOR: the d-pad first, then the left stick past half-way; a standard pad is the one read', () => {
  assert.equal(padDirection(pad([PAD.UP])), 'up');
  assert.equal(padDirection(pad([PAD.DOWN])), 'down');
  assert.equal(padDirection(pad([PAD.LEFT])), 'left');
  assert.equal(padDirection(pad([PAD.RIGHT])), 'right');
  assert.equal(padDirection(pad([], [0, STICK_DIRECTION - 0.01])), null, 'inside half-way is no direction');
  assert.equal(padDirection(pad([], [0, 0.9])), 'down');
  assert.equal(padDirection(pad([], [-0.8, 0.3])), 'left', 'the larger axis wins');
  assert.equal(padDirection(pad([PAD.UP], [0, 0.9])), 'up', 'the d-pad before the stick');
  const odd = { ...pad(), mapping: '' };
  const std = pad();
  assert.equal(pickDoorPad([null, odd, std]), std);
  assert.equal(pickDoorPad([null, odd]), odd);
  assert.equal(pickDoorPad([null, undefined]), null);
});

test('PAD-DOOR: the focus goes to the nearest control THAT way, the one in line before the one off to the side', () => {
  const at = (x, y) => ({ rect: { x, y, w: 10, h: 10 } });
  const from = { x: 0, y: 0, w: 10, h: 10 };
  const inLine = at(0, 100), aside = at(60, 60), behind = at(0, -50);
  assert.equal(nextFocus(from, [aside, inLine, behind], 'down'), inLine, 'in line at 100 beats aside at 60 + 2x60');
  // the weight is what decides it: 50 ahead and 40 across is nearer as the crow flies (90 < 100), and still loses
  assert.equal(nextFocus(from, [at(40, 50), inLine], 'down'), inLine, 'across counts double: 50 + 2x40 = 130 > 100');
  assert.equal(nextFocus(from, [behind], 'down'), null, 'nothing that way');
  assert.equal(nextFocus(from, [behind, inLine], 'up'), behind);
  assert.equal(nextFocus(from, [aside], 'right'), aside);
  assert.equal(nextFocus(from, [aside], 'left'), null);
  assert.equal(nearestTo(from, [inLine, aside, behind]), behind);
});

test('PAD-DOOR: A focuses the first control, then presses the focused one - once per press, however long it is held', () => {
  const ui = fakeUi([['Continue', 0, 0], ['Load Game', 0, 1]]);
  const s = fresh();
  padDoorFrame(pad([PAD.A]), ui, s, 0);
  assert.equal(ui.focused?.name, 'Continue', 'nothing focused: the first press focuses the first control');
  assert.deepEqual(ui.pressed, []);
  padDoorFrame(pad([PAD.A]), ui, s, 16);   // still held
  assert.deepEqual(ui.pressed, [], 'a held A is one press');
  padDoorFrame(pad([]), ui, s, 32);
  padDoorFrame(pad([PAD.A]), ui, s, 48);
  assert.deepEqual(ui.pressed, ['Continue']);
  padDoorFrame(pad([]), ui, s, 64);
  padDoorFrame(pad([PAD.START]), ui, s, 80);
  assert.deepEqual(ui.pressed, ['Continue', 'Continue'], 'Start presses too');
});

test('PAD-DOOR: B is the door\'s Escape, once per press', () => {
  const ui = fakeUi([['Continue', 0, 0]]);
  const s = fresh();
  padDoorFrame(pad([PAD.B]), ui, s, 0);
  padDoorFrame(pad([PAD.B]), ui, s, 16);
  assert.equal(ui.backs, 1);
  padDoorFrame(pad([]), ui, s, 32);
  padDoorFrame(pad([PAD.B]), ui, s, 48);
  assert.equal(ui.backs, 2);
});

test('PAD-DOOR: a held direction moves once, then repeats after the delay at the repeat rate', () => {
  const ui = fakeUi([['a', 0, 0], ['b', 0, 1], ['c', 0, 2], ['d', 0, 3], ['e', 0, 4], ['f', 0, 5]]);
  const s = fresh();
  ui.focused = ui.els[0];
  padDoorFrame(pad([PAD.DOWN]), ui, s, 0);
  assert.equal(ui.focused.name, 'b');
  padDoorFrame(pad([PAD.DOWN]), ui, s, REPEAT_DELAY_MS - 1);
  assert.equal(ui.focused.name, 'b', 'no repeat before the delay');
  padDoorFrame(pad([PAD.DOWN]), ui, s, REPEAT_DELAY_MS);
  assert.equal(ui.focused.name, 'c');
  padDoorFrame(pad([PAD.DOWN]), ui, s, REPEAT_DELAY_MS + REPEAT_MS - 1);
  assert.equal(ui.focused.name, 'c');
  padDoorFrame(pad([PAD.DOWN]), ui, s, REPEAT_DELAY_MS + REPEAT_MS);
  assert.equal(ui.focused.name, 'd');
  padDoorFrame(pad([]), ui, s, 2000);
  padDoorFrame(pad([PAD.UP]), ui, s, 2016);
  assert.equal(ui.focused.name, 'c', 'a new direction moves at once');
});

test('PAD-DOOR: left and right step a list box instead of leaving it; up and down still leave', () => {
  const ui = fakeUi([['select-skin', 0, 0], ['Next', 1, 0], ['Below', 0, 1]]);
  const s = fresh();
  ui.focused = ui.els[0];
  padDoorFrame(pad([PAD.RIGHT]), ui, s, 0);
  assert.equal(ui.focused.name, 'select-skin');
  assert.equal(ui.els[0].steps, 1);
  padDoorFrame(pad([]), ui, s, 16);
  padDoorFrame(pad([PAD.DOWN]), ui, s, 32);
  assert.equal(ui.focused.name, 'Below');
});

test('PAD-DOOR: a press that redraws the menu puts the focus back on the control now standing there - and a new screen starts over', () => {
  const ui = fakeUi([['Continue', 0, 0], ['Online', 0, 3]]);
  const s = fresh();
  padDoorFrame(pad([PAD.DOWN]), ui, s, 0);            // focuses Continue (nothing was)
  padDoorFrame(pad([]), ui, s, 16);
  padDoorFrame(pad([PAD.DOWN]), ui, s, 32);           // -> Online
  assert.equal(ui.focused.name, 'Online');
  // the press redraws: the rail button is replaced by a new one at the same place
  ui.els[1].connected = false;
  const redrawn = { name: 'Online (redrawn)', connected: true, rect: { x: 2, y: 301, w: 80, h: 40 } };
  ui.els.push(redrawn);
  padDoorFrame(pad([]), ui, s, 48);
  assert.equal(ui.focused, redrawn, 'the same button, redrawn, holds the focus again');
  // a different screen: nothing where it stood, and after the grace nothing is resumed
  const ui2 = fakeUi([['Begin', 3, 2]]);
  const s2 = fresh();
  padDoorFrame(pad([PAD.A]), ui2, s2, 0);            // focus Begin
  ui2.els[0].connected = false;
  ui2.els.push({ name: 'Continue', connected: true, rect: { x: 0, y: 0, w: 80, h: 40 } }, { name: 'About', connected: true, rect: { x: 600, y: 400, w: 80, h: 40 } });
  padDoorFrame(pad([]), ui2, s2, 16);
  assert.equal(ui2.active(), null, 'no control stands where Begin stood');
  padDoorFrame(pad([]), ui2, s2, 16 + REFOCUS_MS + 1);
  assert.equal(s2.lastEl, null, 'the grace ends: nothing to resume');
  padDoorFrame(pad([PAD.DOWN]), ui2, s2, 16 + REFOCUS_MS + 20);
  assert.equal(ui2.focused.name, 'Continue', 'the first control, as on a fresh page - not the one nearest where Begin was');
});

test('PAD-DOOR: main.js attaches it around the front door and stops it when a game is chosen; no page, no loop', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /const \{ attachMenuPad \} = await import\('\.\/ui\/menuPad\.js'\);\s*\n\s*const detachMenuPad = attachMenuPad\(\);/);
  assert.match(main, /choice = await runCinematicFrontDoor\([\s\S]{0,900}?\}\)\.finally\(detachMenuPad\);/,
    'the door\'s pad stops with the choice, before the scene\'s pad starts');
  assert.equal(typeof attachMenuPad({ doc: null }), 'function', 'without a page it answers a no-op detach');
});

test('PAD-SETTINGS: the four gamepad settings are numbers with steppers, over their consumer\'s own clamps', () => {
  const pads = readFileSync(new URL('../src/systems/gamepad.js', import.meta.url), 'utf8');
  for (const [key, fmt, shown] of [
    ['Controls/JoystickLookSensitivity', 'mult', 'x1.0'],
    ['Controls/JoystickCursorSensitivity', 'mult', 'x1.0'],
    ['Controls/JoystickMovementThreshold', 'pct', '90%'],
    ['Controls/JoystickDeadzone', 'pct', '10%'],
  ]) {
    assert.equal(widgetFor(key), 'number', `${key} is a control, not a readout`);
    const law = NUMBER_LAW[key];
    assert.equal(law.format, fmt);
    const m = pads.match(new RegExp(`getFloat\\('Controls', '${key.split('/')[1]}', ([\\d.]+), ([\\d.]+)\\)`));
    assert.ok(m, `${key}: the consumer's clamp`);
    assert.deepEqual([law.min, law.max], [Number(m[1]), Number(m[2])], `${key}: range equals clamp`);
    assert.equal(formatValue(key, fmt === 'mult' ? '1.0' : key.endsWith('Deadzone') ? '0.1' : '0.9'), shown);
    assert.ok(stepValue(key, String(law.min), +1, false) !== null, `${key}: the stepper steps`);
  }
});

// ─── AUDIT (the batch's audit, agent A) ────────────────────────────────────────────────────────────────────────────

test('AUDIT PAD-DOOR A6: a stick held near a diagonal keeps the way it went while that axis still leans past half-way - the larger axis alone flipped on a tremor and every flip fired a move; a new way is taken when the old one lets go (mutants: the larger axis alone)', () => {
  assert.equal(padDirection(pad([], [0.62, 0.64]), 'right'), 'right', 'right held, down now a hair larger: still right');
  assert.equal(padDirection(pad([], [0.64, 0.62]), 'down'), 'down', 'and the other way round');
  assert.equal(padDirection(pad([], [0.3, 0.9]), 'right'), 'down', 'right let go past the threshold: down');
  assert.equal(padDirection(pad([], [0.62, 0.64])), 'down', 'no way held before: the larger axis');
  assert.equal(padDirection(pad([PAD.LEFT], [0.9, 0]), 'right'), 'left', 'the d-pad before the stick, held way or not');
  // driven: a tremor about the diagonal fires once, not every frame
  const ui = fakeUi([['a', 0, 0], ['b', 1, 0], ['c', 0, 1], ['d', 1, 1], ['e', 2, 2]]);
  const s = fresh();
  padDoorFrame(pad([PAD.A]), ui, s, 0);
  padDoorFrame(pad([]), ui, s, 8);
  let moves = 0, was = ui.focused;
  for (let t = 16; t < 300; t += 16) {
    padDoorFrame(pad([], (t / 16) % 2 ? [0.62, 0.64] : [0.64, 0.62]), ui, s, t);
    if (ui.focused !== was) { moves++; was = ui.focused; }
  }
  assert.equal(moves, 1, 'one move for the one lean, inside the repeat delay');
});

test('AUDIT PAD-DOOR A5: the last focused control gone and the PAGE holding the focus (a redraw\'s own focus, the intro\'s end) - that is the focus now, and the frames stop walking the page for a lost one (mutants: the lost control kept)', () => {
  const ui = fakeUi([['arrow', 0, 0], ['panel', 1, 0], ['other', 0, 1]]);
  const s = fresh();
  padDoorFrame(pad([PAD.A]), ui, s, 0);
  padDoorFrame(pad([]), ui, s, 8);
  assert.equal(s.lastEl.name, 'arrow');
  ui.els[0].connected = false;                  // the page redraws the arrow away...
  ui.focused = ui.els[1];                       // ...and focuses its panel itself
  let scans = 0;
  const cand = ui.candidates;
  ui.candidates = () => { scans++; return cand(); };
  padDoorFrame(pad([]), ui, s, 16);
  assert.equal(s.lastEl.name, 'panel', 'the page\'s focus is the pad\'s');
  scans = 0;
  for (let t = 32; t < 32 + 60 * 16; t += 16) padDoorFrame(pad([]), ui, s, t);
  assert.equal(scans, 0, 'a second of idle frames walks nothing');
});

test('AUDIT PAD-DOOR A2: B on a text field - the menu\'s Escape skips a field\'s keys - lets the field go and the page hears Escape; on anything else the focused control hears it as before (mutants: dispatched on the field)', () => {
  class KeyboardEvent { constructor(type, init) { this.type = type; Object.assign(this, init); } }
  const heard = [];
  const node = (name, tag) => ({ name, tagName: tag, dispatchEvent: (e) => heard.push([name, e.key]) });
  const doc = { defaultView: { KeyboardEvent }, body: node('body', 'BODY') };
  const field = { ...node('field', 'INPUT'), blur() { doc.activeElement = doc.body; heard.push(['field', 'blur']); } };
  doc.activeElement = field;
  domDoorUi(doc).back();
  assert.deepEqual(heard, [['field', 'blur'], ['body', 'Escape']]);
  heard.length = 0;
  doc.activeElement = node('button', 'BUTTON');
  domDoorUi(doc).back();
  assert.deepEqual(heard, [['button', 'Escape']]);
  heard.length = 0;
  doc.activeElement = { ...node('note', 'DIV'), isContentEditable: true, blur() { doc.activeElement = doc.body; } };
  domDoorUi(doc).back();
  assert.deepEqual(heard, [['body', 'Escape']], 'an editable box is a field too');
});

test('AUDIT PAD-SETTINGS A3 + A9: the Stick Deadzone stops at DFU\'s 0.9 - at 1.0 both sticks were dead - in the row and the clamp alike; the movement threshold is called what it is (mutants: the row to 1.0; the clamp to 1.0)', () => {
  assert.deepEqual([NUMBER_LAW['Controls/JoystickDeadzone'].min, NUMBER_LAW['Controls/JoystickDeadzone'].max], [0, 0.9]);
  assert.match(readFileSync(new URL('../src/systems/gamepad.js', import.meta.url), 'utf8'), /deadzone: getFloat\('Controls', 'JoystickDeadzone', 0, 0\.9\),/);
  assert.equal(stepValue('Controls/JoystickDeadzone', '0.85', +1, false), '0.9', 'the stepper stops there');
  assert.equal(stepValue('Controls/JoystickDeadzone', '0.9', +1, false), '0.9');
  assert.match(readFileSync(new URL('../src/ui/settingsCopy.js', import.meta.url), 'utf8'), /"Controls\/JoystickMovementThreshold": "Gamepad Movement Threshold",/, 'DFU\'s "Maximum Movement Threshold" - the lean at full speed, no deadzone');
});
