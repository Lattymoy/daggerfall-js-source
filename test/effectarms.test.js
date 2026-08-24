// X1: THE EFFECT LIBRARY'S MISSING ARMS - the effects the spell maker
// could sell but the runtime could not honour. Each slice moves rows
// out of spellEffects.js's inert set, so the maker's "(no effect
// yet)" marks disappear as the arms land.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySpell } from '../src/systems/effects.js';
import { jumpSpeedMultiplier, JUMP_SPELL_MULTIPLIER } from '../src/systems/skills.js';
import { climbingDeps } from '../src/scenes/shared.js';
import { buildCustomSpell, blankEffectSettings } from '../src/systems/spellMaker.js';
import { effectByKey } from '../src/systems/spellEffects.js';

const entity = () => ({
  stats: { luck: 50, willpower: 50 }, skills: [], activeEffects: [],
  race: 'Breton', level: 1, health: 20, maxHealth: 20,
});
const castSelf = (ent, type, subType = 255, settings = {}) => applySpell(
  buildCustomSpell({ slots: [{ type, subType, settings: { ...blankEffectSettings(), durationBase: 10, ...settings } }], rangeType: 0 }),
  1, ent, {}, () => 0.5, null, {});

test('X1 Jumping: the spell adds AcrobatMotor\'s +0.6, on top of the skill term', () => {
  const e = entity();
  assert.equal(JUMP_SPELL_MULTIPLIER, 0.6, 'jumpSpellMultiplier (AcrobatMotor.cs:16)');
  const base = jumpSpeedMultiplier(e);
  assert.equal(base, 1, 'a skill-less Breton jumps at 1.0');
  const out = castSelf(e, 27);
  assert.equal(out.skipped, 0, 'the library honours it now');
  assert.equal(out.buffs, 1);
  assert.deepEqual(e.activeEffects.map((a) => a.kind), ['jumping']);
  assert.equal(jumpSpeedMultiplier(e), base + 0.6, 'IsEnhancedJumping adds the spell term (:104-105)');
  // and it leaves when the effect does
  e.activeEffects.length = 0;
  assert.equal(jumpSpeedMultiplier(e), base, 'End() clears it');
});

test('X1 Climbing: the spell doubles the effective skill, through the seam that was hardcoded false', () => {
  const e = entity();
  assert.equal(climbingDeps(e).inputs().enhanced, false);
  const out = castSelf(e, 28);
  assert.equal(out.skipped, 0);
  assert.deepEqual(e.activeEffects.map((a) => a.kind), ['climbing']);
  assert.equal(climbingDeps(e).inputs().enhanced, true,
    'FormulaHelper.cs:304-306 doubles the skill; climbing.js reads `enhanced`');
  e.activeEffects.length = 0;
  assert.equal(climbingDeps(e).inputs().enhanced, false);
});

test('X1 both buffs stack their rounds like every other incumbent, and the catalog marks them live', () => {
  const e = entity();
  castSelf(e, 27);
  const first = e.activeEffects[0].roundsRemaining;
  castSelf(e, 27);
  assert.equal(e.activeEffects.length, 1, 'one incumbent, not two');
  assert.ok(e.activeEffects[0].roundsRemaining > first, 'a recast STACKS the rounds (the port\'s incumbent law)');
  // the spell maker no longer warns about these two
  assert.equal(effectByKey('27,255').ported, true);
  assert.equal(effectByKey('28,255').ported, true);
});
