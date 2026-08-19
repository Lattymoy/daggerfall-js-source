// U5: the message queue - PopupText's single-timer model (AUDIT 18
// ui-native: the old per-line 2.0 s countdown and 4-row cap were the
// port's, not DFU's).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HudText, HUD_TEXT_POP_DELAY, HUD_TEXT_MAX_ROWS, HUD_TEXT_RUBBERBAND } from '../src/ui/hudText.js';

test('hudText: PopupText.AddText/Update - the queue never caps, the timer pops', () => {
  const h = new HudText();
  for (let i = 0; i < 6; i++) h.add(`m${i}`);
  // AddText queues unconditionally - nothing is dropped on add
  assert.equal(h.lines.length, 6);
  assert.equal(h.lines[0].text, 'm0');
  assert.equal(h.timer, HUD_TEXT_POP_DELAY);
  // timer must fall below -popDelay before the FIRST row pops
  h.tick(HUD_TEXT_POP_DELAY * 2 - 0.01);
  assert.equal(h.lines.length, 6);
  h.tick(0.02);
  assert.equal(h.lines.length, 5);
  assert.equal(h.lines[0].text, 'm1');
  // one pop per popDelay of further drain
  h.tick(HUD_TEXT_POP_DELAY);
  assert.equal(h.lines.length, 4);
  h.tick(10);
  assert.equal(h.lines.length, 0);
  h.tick(1);                                             // empty ticks safe
});

test('hudText: the rubberband speedup only engages past maxRows', () => {
  const under = new HudText();
  for (let i = 0; i < HUD_TEXT_MAX_ROWS; i++) under.add(`m${i}`);
  under.tick(0.5);
  assert.equal(under.timer, HUD_TEXT_POP_DELAY - 0.5);
  const over = new HudText();
  for (let i = 0; i < HUD_TEXT_MAX_ROWS + 3; i++) over.add(`m${i}`);
  over.tick(0.5);
  assert.equal(over.timer, HUD_TEXT_POP_DELAY - 0.5 * (1 + HUD_TEXT_RUBBERBAND * 3));
});
