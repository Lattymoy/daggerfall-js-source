// RPT1026-MISC TOAST-STALL (two private reports: several lines close together all stuck on the HUD; on a phone, lines that
// stood for many seconds). The HUD line's
// model is PopupText's ONE timer - the front row's (ui/hud/hudText.js) - and NOTICE-SPAM's repeat of the back line put
// that timer back on every repeat. With other rows queued ahead of the repeated one, a line said again inside every
// second (a state its producer keeps naming) held every row on the screen for as long as it went on; DFU's AddText adds
// the row (PopupText.cs:106-124), so its queue grows and the rubberband drains it, where the port's collapse added
// nothing and nothing ever drained. Driven through the real model, at the frame rate the hosts tick it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HudText, HUD_TEXT_POP_DELAY } from '../../../src/ui/hud/hudText.js';

/** `seconds` of frames at `fps`, the back line said again every `every` seconds (null: never). */
function run(h, seconds, { fps = 30, every = null, line = 'You are overburdened.' } = {}) {
  const dt = 1 / fps;
  let since = 0;
  for (let t = 0; t < seconds; t += dt) {
    h.tick(dt);
    since += dt;
    if (every != null && since >= every) { since = 0; h.add(line); }
  }
}

test('RPT1026-MISC TOAST-STALL: rows queued ahead of a line said again and again still leave the HUD in their own time, the repeated line last (mutant: rpt1026-misc-toast-repeat-refreshes-front)', () => {
  const h = new HudText('t');
  for (const l of ['You found 12 gold.', 'You found a Silver Dagger.', 'Your Short Blade skill has improved.', 'You are overburdened.']) h.add(l);
  assert.equal(h.lines.length, 4);
  run(h, 12, { every: 0.5 });   // twelve seconds, the back line repeated twice a second
  assert.deepEqual(h.lines.map((l) => l.text), ['You are overburdened.'], 'the three ahead of it went by; the line still said stands, once');
  // the same four with no repeat go in the same time: the repeat costs the rows ahead of it nothing
  const g = new HudText('u');
  for (const l of ['A', 'B', 'C', 'D']) g.add(l);
  run(g, 4 * 2 * HUD_TEXT_POP_DELAY + 0.5);
  assert.deepEqual(g.lines, [], 'four rows, two seconds each');
});

test('RPT1026-MISC TOAST-STALL: a lone line said again keeps its row up, as NOTICE-SPAM meant - its dwell is its own', () => {
  const h = new HudText('v');
  h.add('You are freezing.');
  run(h, 10, { every: 0.5, line: 'You are freezing.' });
  assert.deepEqual(h.lines.map((l) => l.text), ['You are freezing.'], 'still said, still shown');
  run(h, 2 * HUD_TEXT_POP_DELAY + 0.1);
  assert.deepEqual(h.lines, [], 'and gone once it is no longer said');
});
