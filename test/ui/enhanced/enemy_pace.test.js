// ENEMY-PACE: the slowest pace the clock runs at with enemies holding a journey. RATE-LAW (2026-10-04, Mac: "Remove
// travel options dials"): the pace is FIXED now - the panel's near-enemies stepper is gone - and the law has one home,
// systems/travel/travelThreat.js `foePaced`, which both of the host's governed paths call.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JOURNEY_FOE_PACE, foePaced } from '../../../src/systems/travel/travelThreat.js';
import { hostText } from '../../hostText.mjs';   // HOST-SPLIT 2 (AUDIT, the second read): its negatives read the host whole

const world = hostText('src/scenes/world.js');
const panel = readFileSync(new URL('../../../src/ui/enhanced/enhancedTravelControl.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../../src/ui/enhanced/enhancedStyle.js', import.meta.url), 'utf8');

test('ENEMY-PACE x RATE-LAW: the enemies\' cap is floored at the fixed pace on both governed paths, and no stepper is wired (mutants: a path left on the raw cap, the floor moved)', () => {
  // PIN MOVED (TIME-DILATION): through foeRate - the floor itself outside a hostile ship's hold (travelThreat.js), x1 inside it
  assert.match(world, /foeRate\(foes, travelAsked\)/, 'the classic skin\'s journey on the ground');
  assert.match(world, /foeRate\(foes, want\)/, 'under the view');
  assert.doesNotMatch(world, /foeFaster|foeSlower|tvFoeRate|foeLadder/, 'the stepper and its rate are gone');
  assert.equal(JOURNEY_FOE_PACE, 5, 'the stepper\'s own default, kept');
});

test('ENEMY-PACE x RATE-LAW: the panel draws no stepper - neither the general one nor the near-enemies one; Camp stays stacked above Exit in the dock', () => {
  assert.doesNotMatch(panel, /travelpanel-step|travelpanel-foe|data-act="(faster|slower|foeFaster|foeSlower)"/);
  assert.ok(panel.indexOf('data-act="camp"') < panel.indexOf('data-act="exit"'));
  assert.match(css, /tview-dock \.travelpanel-acts \{[^}]*flex-direction: column/);
  assert.doesNotMatch(css, /\.travelpanel-step|\.travelpanel-foe/, 'the stepper\'s rules went with it');
});

test('ENEMY-PACE floor arithmetic: eased toward the enemy, never under the pace, never over what was asked', () => {
  assert.equal(foePaced(1, 60), 5, 'an enemy inside its reach: the pace, not walking pace');
  assert.equal(foePaced(30, 100), 30, 'eased, not cut');
  assert.equal(foePaced(Infinity, 100), 100, 'nothing near: the ground\'s rate');
  assert.equal(foePaced(1, 3), 3, 'never above what was asked');
});
