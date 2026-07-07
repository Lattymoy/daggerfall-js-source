// U5: the message queue - stacking cap, per-line life, fade window.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HudText, HUD_TEXT_SECONDS, HUD_TEXT_MAX } from '../src/ui/hudText.js';

test('hudText: stack cap, tick expiry, independent lifetimes', () => {
  const h = new HudText();
  for (let i = 0; i < 6; i++) h.add(`m${i}`);
  assert.equal(h.lines.length, HUD_TEXT_MAX);            // oldest dropped
  assert.equal(h.lines[0].text, 'm2');
  h.tick(HUD_TEXT_SECONDS - 0.5);
  assert.equal(h.lines.length, HUD_TEXT_MAX);            // all alive at 0.5s left
  h.add('late');
  h.tick(0.6);
  assert.equal(h.lines.length, 1);                       // the first four expired
  assert.equal(h.lines[0].text, 'late');
  h.tick(HUD_TEXT_SECONDS);
  assert.equal(h.lines.length, 0);
  h.tick(1);                                             // empty ticks safe
});
