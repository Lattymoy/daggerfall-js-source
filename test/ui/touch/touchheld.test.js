// AUDIT TECH-FEEDBACK II F6: the touch corner's held buttons, by action - the Martial technique ships with no key, so the
// weapon rig reads its button here (ui/touch/touchHeld.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTouchHeld, touchHeld, clearTouchHeld } from '../../../src/ui/touch/touchHeld.js';

test('AUDIT TECH-FEEDBACK II F6: a hold button holds its action until it comes up, or the corner lets every button go (mutants: never held; never let go; the corner\'s rebuild keeps one held)', () => {
  assert.equal(touchHeld('SignatureTechnique'), false);
  setTouchHeld('SignatureTechnique', true);
  assert.equal(touchHeld('SignatureTechnique'), true);
  assert.equal(touchHeld('Jump'), false, 'its own action alone');
  setTouchHeld('SignatureTechnique', false);
  assert.equal(touchHeld('SignatureTechnique'), false);
  setTouchHeld('SignatureTechnique', true);
  clearTouchHeld();
  assert.equal(touchHeld('SignatureTechnique'), false);
});
