// S22: FreeAction (26,255) - the Restoration paralysis-immunity buff.
// Laws verbatim from FreeAction.cs + DaggerfallEntity.IsParalyzed +
// EntityEffectManager.AssignBundle: the duration incumbent with
// AddState stacking, the (20,8) Restoration cost, the READ-TIME
// immunity fold, and the AssignBundle hard-immune drop.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buffKind, hasActiveEffect, isImmuneToParalysis, entityIsParalyzed,
  applySpell, tickActiveEffects,
} from '../src/systems/effects.js';
import { EFFECT_COST_TABLE as SPELL_COST } from '../src/systems/spellcost.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const T = () => ({ stats: { willpower: 50 }, career: {}, health: 30, maxHealth: 40 });
const FREE = { type: 26, subType: 255, durationBase: 3, durationMod: 1, durationPerLevel: 1 };
const PARA = { type: 0, subType: 255, durationBase: 5, durationMod: 1, durationPerLevel: 1, chanceBase: 100, chanceMod: 1, chancePerLevel: 1 };

test('freeAction: the key, the Restoration (20,8) cost, and AddState stacking', () => {
  assert.equal(buffKind({ type: 26, subType: 255 }), 'freeAction');
  assert.equal(buffKind({ type: 26, subType: -1 }), 'freeAction');   // the sbyte spelling from real records
  assert.deepEqual(SPELL_COST['26,255'].duration, { A: 20, B: 8, offset: 0 });
  assert.equal(SPELL_COST['26,255'].skill, 23);   // Restoration
  const t = T();
  applySpell({ element: 4, rangeType: 0, effects: [FREE] }, 2, t, {}, seq(0));
  assert.ok(hasActiveEffect(t, 'freeAction'));
  assert.ok(isImmuneToParalysis(t));
  const r0 = t.activeEffects[0].roundsRemaining;
  applySpell({ element: 4, rangeType: 0, effects: [FREE] }, 2, t, {}, seq(0));
  assert.equal(t.activeEffects.length, 1, 'incumbent - not a second entry');
  assert.ok(t.activeEffects[0].roundsRemaining > r0, 'AddState stacks the rounds');
});

test('freeAction: the AssignBundle drop - an immune target sheds incoming Paralyze silently', () => {
  const t = T();
  applySpell({ element: 4, rangeType: 0, effects: [FREE] }, 2, t, {}, seq(0));
  // The paralyze is dropped BEFORE Start: no active entry, no chance
  // roll consumed (a throwing roll proves it), no failure message.
  const said = [];
  const r = applySpell({ element: 4, rangeType: 2, effects: [PARA] }, 2, t,
    { say: (l) => said.push(l) }, () => { throw new Error('rolled for a dropped effect'); });
  assert.ok(!hasActiveEffect(t, 'paralyze'));
  assert.equal(r.paralyzed ?? 0, 0);
  assert.equal(r.chanceFailed ?? 0, 0);
  assert.equal(said.length, 0);
});

test('freeAction: the READ-TIME fold - casting over a live paralysis frees NOW and it RESUMES', () => {
  // DaggerfallEntity.IsParalyzed = !IsImmuneToParalysis && isParalyzed:
  // the bundle is NOT cured - it ticks underneath and comes back if
  // FreeAction runs out first.
  const t = T();
  applySpell({ element: 4, rangeType: 2, effects: [PARA] }, 5, t, {}, seq(0.49, 0.99));   // chance passes, save FAILS -> lands
  assert.ok(entityIsParalyzed(t), 'paralyzed before FreeAction');
  const paraRounds = t.activeEffects.find((a) => a.kind === 'paralyze').roundsRemaining;
  const shortFree = { ...FREE, durationBase: 2, durationMod: 0, durationPerLevel: 1 };
  applySpell({ element: 4, rangeType: 0, effects: [shortFree] }, 1, t, {}, seq(0));
  const freeRounds = t.activeEffects.find((a) => a.kind === 'freeAction').roundsRemaining;
  assert.ok(freeRounds < paraRounds, `fixture: FreeAction (${freeRounds}) must expire before the paralysis (${paraRounds})`);
  assert.ok(!entityIsParalyzed(t), 'freed NOW - the bundle is not cured');
  assert.ok(hasActiveEffect(t, 'paralyze'), 'the paralysis keeps ticking underneath');
  // Tick FreeAction out (+the End-on-next-pass margin, the DFU
  // shape); the paralysis still has rounds - it RESUMES.
  assert.ok(paraRounds > freeRounds + 2, 'fixture: the paralysis must outlive the expiry margin');
  for (let i = 0; i < freeRounds + 2; i++) tickActiveEffects(t, {}, seq(0));
  assert.ok(!hasActiveEffect(t, 'freeAction'));
  assert.ok(entityIsParalyzed(t), 'the surviving paralysis resumes when FreeAction expires');
});
