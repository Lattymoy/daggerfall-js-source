// S7: the effect spine - heal, continuous over rounds, duration
// arithmetic, expiry, save-once scaling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySpell, tickActiveEffects, rollDuration, isHealHealth } from '../src/systems/effects.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const T = () => ({ stats: { willpower: 50 }, career: {}, health: 30, maxHealth: 40 });

test('effects: HealHealth (10,8) instant; duration arithmetic verbatim', () => {
  const heal = { type: 10, subType: 8, magnitudeBaseLow: 5, magnitudeBaseHigh: 9, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 };
  assert.ok(isHealHealth(heal));
  let healed = 0;
  const r = applySpell({ element: 4, effects: [heal] }, 3, T(), { heal: (n) => { healed += n; } }, seq(0));
  assert.equal(healed, 5);                         // roll 0 -> baseLow
  assert.equal(r.healed, 5);
  // duration: base 3 + mod 2 x floor(7/3) = 7; per-0 guards to 1
  assert.equal(rollDuration({ durationBase: 3, durationMod: 2, durationPerLevel: 3 }, 7), 7);
  assert.equal(rollDuration({ durationBase: 1, durationMod: 4, durationPerLevel: 0 }, 5), 21);
});

test('effects: continuous (1,0) joins actives, ticks per round, expires; save scales every round', () => {
  const cont = { type: 1, subType: 0, magnitudeBaseLow: 10, magnitudeBaseHigh: 10, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
    durationBase: 2, durationMod: 0, durationPerLevel: 1 };
  const t = T();
  // save roll 0.39 vs saving 55 -> prorated 25%
  const r = applySpell({ element: 0, effects: [cont] }, 1, t, {}, seq(0.39));
  assert.equal(r.continuous, 1);
  assert.equal(t.activeEffects.length, 1);
  assert.equal(t.activeEffects[0].savePct, 25);
  let hurt = 0;
  tickActiveEffects(t, { hurt: (n) => { hurt += n; } }, seq(0));
  assert.equal(hurt, 2);                           // trunc(10 * 25 / 100)
  assert.equal(t.activeEffects[0].roundsRemaining, 1);
  tickActiveEffects(t, { hurt: (n) => { hurt += n; } }, seq(0));
  assert.equal(hurt, 4);
  assert.equal(t.activeEffects.length, 0);         // expired at 0
  tickActiveEffects(t, { hurt: () => { throw new Error('dead list ticked'); } });
  // a FAILED save (immune) never joins
  const imm = { stats: { willpower: 50 }, career: { immunityFlags: 8 } };
  applySpell({ element: 0, effects: [cont] }, 1, imm, {}, seq(0.99));
  assert.ok(!imm.activeEffects?.length);
});
