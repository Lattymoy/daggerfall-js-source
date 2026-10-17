// GHOST-CAP and GHOST-DIM (2026-10-02, Discord "Fatigue Bar": "When you get your Fatigue damaged while fighting
// Daedra, the pending change on the fatigue bar is white. It's really hard to see it if you are not looking at it
// directly, and you can die from it while fighting. Please lower the opacity for the damaged part of the bar.") -
// every fresh loss restarted the strip's hold, so a bar losing a little every few frames never drained it: fatigue
// through a fight read as the fight's first level, in the bar's palest tone under a cream line at 0.55 - a white bar
// still full. Now the strip stands GHOST_HOLD_MAX at the most, however the losses come, and wears the bar's own body
// tone, faint (ui/barLoss.js stepGhost, ui/enhanced/enhancedPlusStyle.js VITALS_CSS). Each pin is red on the record's code
// (42e50765).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepGhost, GHOST_HOLD, GHOST_HOLD_MAX, GHOST_RATE } from '../../src/ui/barLoss.js';
import { VITALS_CSS } from '../../src/ui/enhanced/enhancedPlusStyle.js';

test('GHOST-CAP A STEADY DRAIN DRAINS ITS STRIP: a bar losing a little every frame holds its strip GHOST_HOLD_MAX at the most, then the strip follows it down - it stood at the first level for as long as the losses came (mutants: the cap unread, the stood clock never kept)', () => {
  const dt = 1 / 60;
  let g = stepGhost(null, 100, 0), pct = 100, t = 0;
  while (t < GHOST_HOLD_MAX - 2 * dt) { pct -= 0.05; t += dt; g = stepGhost(g, pct, dt); }
  assert.equal(g.at, 100, 'held under the cap');
  for (let i = 0; i < 6; i++) { pct -= 0.05; t += dt; g = stepGhost(g, pct, dt); }
  assert.ok(g.at < 100, 'past the cap it drains, though the losses still come');
  for (let i = 0; i < 60; i++) { pct -= 0.05; t += dt; g = stepGhost(g, pct, dt); }
  assert.ok(g.at - pct < 0.05 * 60 * GHOST_HOLD_MAX + 1e-9, `the strip never more than a cap's worth of the drain over the bar: ${g.at - pct}`);
  assert.ok(GHOST_HOLD_MAX > GHOST_HOLD, 'a flurry still reads as one run of damage');
});

test('GHOST-CAP A FLURRY STILL HOLDS: blows GHOST_HOLD apart inside the cap keep the strip where the bar was; a gain snaps it; a fresh run after it caught up holds again (the record\'s VB2 law within the cap)', () => {
  let g = stepGhost(null, 80, 0);
  g = stepGhost(g, 70, 0.016);
  g = stepGhost(g, 70, GHOST_HOLD * 0.9);
  g = stepGhost(g, 60, 0.016);
  assert.equal(g.at, 80, 'the second blow restarts the hold');
  assert.equal(g.hold, GHOST_HOLD);
  for (let i = 0; i < 100; i++) g = stepGhost(g, 60, 0.1);
  assert.equal(g.at, 60, 'drained to the bar');
  g = stepGhost(g, 40, 0.016);
  assert.deepEqual([g.at, g.hold], [60, GHOST_HOLD], 'caught up: the next run holds afresh');
  g = stepGhost(g, 40, GHOST_HOLD + 0.01);
  g = stepGhost(g, 40, 0.1);
  assert.equal(g.at, 60 - GHOST_RATE * 0.1);
  assert.equal(stepGhost(g, 90, 0.016).at, 90, 'a gain snaps it');
});

test('GHOST-DIM THE STRIP IS FAINT: the vitals\' strip wears the bar\'s own body tone at 0.35 - no cream line, not its palest tone (mutants: the record\'s rule)', () => {
  const rule = VITALS_CSS.match(/\.hud-vital \.hud-ghost \{[^}]*\}/)?.[0];
  assert.ok(rule, 'the rule');
  assert.match(rule, /background: var\(--v-body\); opacity: 0\.35; \}$/);
  assert.doesNotMatch(rule, /#fff6e4|--v-hi/);
});
