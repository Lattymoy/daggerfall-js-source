// OT1 - A TAP OUTSIDE ANY UI CLOSES IT (2026-09-12).
//
// Mac: "make it where tapping outside of any UI closes the UI."
//
// One helper on the overlay registry, wired on every enhanced window
// that stands in a scrim: the pause window, the pack, the spellbook,
// the chronicle, the talk panel. The book and the dial already closed
// on a tap beside them. The front door has no scrim and nothing to
// close.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { closeOnOutsideTap } from '../src/ui/enhancedOverlays.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** A shell with one listener slot, and targets that answer closest(). */
const shellOf = () => {
  const shell = { handlers: {}, addEventListener(t, fn) { this.handlers[t] = fn; }, removeEventListener(t) { delete this.handlers[t]; } };
  const inside = { closest: (sel) => (sel.includes('.px-win') ? {} : null) };
  const outside = { closest: () => null };
  return { shell, inside, outside };
};

test('OT1 helper: a primary press on the shell outside the kept selector closes; inside, a drag button, or a bare shell miss does not', () => {
  const { shell, inside, outside } = shellOf();
  let closed = 0, prevented = 0;
  const off = closeOnOutsideTap(shell, '.px-win, .px-foot', () => { closed++; });
  const fire = (target, button = 0) => shell.handlers.pointerdown({ target, button, preventDefault: () => { prevented++; } });
  fire(inside);
  assert.equal(closed, 0, 'inside the window: the window\'s own');
  fire(outside);
  assert.equal(closed, 1, 'on the scrim: closed');
  assert.equal(prevented, 1, 'and the press is consumed');
  fire(shell);
  assert.equal(closed, 2, 'the shell itself is outside');
  fire(outside, 2);
  assert.equal(closed, 2, 'a secondary button is not a tap');
  off();
  assert.equal(shell.handlers.pointerdown, undefined, 'unwired');
  assert.equal(typeof closeOnOutsideTap(null, '.x', () => {}), 'function', 'no shell: a no-op unwire');
});

test('OT1 wiring: every scrimmed enhanced window closes on a tap outside, the front door\'s account window included', () => {
  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /stage\.append\(pauseWindow\(\)\);\s*\n\s*home\.append\(stage\);\s*\n(\s*\/\/[^\n]*\n)*\s*closeOnOutsideTap\(home, '\.px-win, \.px-clock, \.px-foot', \(\) => onAction\('resume'\)\);/, 'the pause window resumes on the scrim, and keeps its clock and foot');
  // ACC1f: TWICE NOW, and the second one is why this line changed
  // rather than being relaxed. It used to read "once: the pause face
  // only - the front door has no scrim", which was true until the
  // account window arrived: Mac asked for the online details to live
  // "as a popup on main menu startup", so the door has a scrim exactly
  // when that window is open, and the law this file holds - a scrimmed
  // window closes on a tap outside - applies to it like every other.
  //
  // Both are NAMED rather than counted loosely, so a third scrim added
  // without its own outside-tap still reddens here.
  const taps = menu.match(/closeOnOutsideTap\(home, '([^']+)'/g) ?? [];
  assert.deepEqual(taps, [
    "closeOnOutsideTap(home, '.px-win, .px-clock, .px-foot'",
    "closeOnOutsideTap(home, '.px-win'",
  ], 'the door wires exactly two scrims: the pause face, and the account window');
  assert.equal((menu.match(/closeOnOutsideTap\(/g) ?? []).length, taps.length, 'a scrim was wired somewhere this pin is not looking');
  // ...and the account window's is guarded by the flag that opens it,
  // so the door with no window open wires nothing and a tap on the
  // front door goes on doing nothing at all.
  assert.match(menu, /if \(accountOpen\) \{[\s\S]{0,600}?closeOnOutsideTap\(home, '\.px-win', \(\) => \{ accountOpen = false; render\(\); \}\);/,
    'the account scrim is wired unconditionally - the front door would close on every tap');
  const inv = read('src/ui/enhancedInventory.js');
  assert.match(inv, /host\.append\(shell\);\s*\n(\s*\/\/[^\n]*\n)*\s*closeOnOutsideTap\(shell, '\.pack-win, \.loot-win', \(\) => onExit\(\)\);/, 'the pack closes through its own exit, so the drop and the equip cue run');
  const sb = read('src/ui/enhancedSpellbook.js');
  assert.equal((sb.match(/closeOnOutsideTap\(shell, '\.px-win', \(\) => onExit\(\)\);/g) ?? []).length, 2, 'the book, empty or not');
  assert.match(sb, /win\.append\(deleteScrim\(\)\);/, 'the YesNo stands INSIDE the window, so a press on it is not outside');
  assert.match(read('src/ui/enhancedChronicle.js'), /closeOnOutsideTap\(shell, '\.px-win', \(\) => onExit\(\)\);/);
  assert.match(read('src/ui/enhancedTalk.js'), /closeOnOutsideTap\(shell, '\.talk-panel', \(\) => act\(\(\) => model\.press\('goodbye'\)\)\);/, 'goodbye through the model, the relock riding the tap');
  // the two that already closed on a tap beside them
  assert.match(read('src/ui/pixelDial.js'), /root\.onclick = \(e\) => \{ if \(e\.target === root\) close\(\); \};/);
  assert.match(read('src/ui/enhancedBook.js'), /if \(hit === 'outside'\) \{ exit\(\); return; \}/);
});
