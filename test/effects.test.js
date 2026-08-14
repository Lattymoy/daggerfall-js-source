// S7: the effect spine - heal, continuous over rounds, duration
// arithmetic, expiry, save-once scaling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySpell, tickActiveEffects, rollDuration, isHealHealth, isHealSpellPoints, isDamageSpellPoints, isContinuousDamageSpellPoints } from '../src/systems/effects.js';
import { isFortifyAttribute } from '../src/systems/effects.js';
import { liveStat } from '../src/systems/statMods.js';

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
  // F11: the per-level multiplier CLAMPS AT 1 (DFU SetDuration) -
  // a level-1 caster with per-level 4 still gets base + mod x 1
  assert.equal(rollDuration({ durationBase: 3, durationMod: 2, durationPerLevel: 4 }, 1), 5);
});

test('effects: continuous (1,0) - initial round at cast, saves roll FRESH per round, DFU expiry', () => {
  const cont = { type: 1, subType: 0, magnitudeBaseLow: 10, magnitudeBaseHigh: 10, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
    durationBase: 2, durationMod: 0, durationPerLevel: 1 };
  const t = T();
  let hurt = 0;
  const sinks = { hurt: (n) => { hurt += n; } };
  // F17: the INITIAL magic round fires AT CAST - save roll .39 ->
  // throw 55, prorated 25%; trunc(10 * 25/100) = 2; round 1 consumed
  const r = applySpell({ element: 0, effects: [cont] }, 1, t, sinks, seq(0.39));
  assert.equal(r.continuous, 1);
  assert.equal(t.activeEffects.length, 1);
  assert.equal(hurt, 2);
  assert.equal(t.activeEffects[0].roundsRemaining, 1);
  assert.equal(t.activeEffects[0].savePct, undefined);   // F10: no held percent
  // round 2: the save rolls FRESH - .44 -> roll 45 -> 100-5*(55-45) = 50%
  tickActiveEffects(t, sinks, seq(0.44));
  assert.equal(hurt, 7);                                 // +trunc(10 * 50/100)
  assert.equal(t.activeEffects[0].roundsRemaining, 0);   // survives THIS pass at 0 (DFU End() is next pass)
  tickActiveEffects(t, { hurt: () => { throw new Error('expired entry acted'); } });
  assert.equal(t.activeEffects.length, 0);               // End() removed it without acting
  tickActiveEffects(t, { hurt: () => { throw new Error('dead list ticked'); } });
  // an IMMUNE target still receives the effect (DFU assigns the
  // bundle; every round's save returns 0) - it just never damages
  const imm = { stats: { willpower: 50 }, career: { immunityFlags: 8 } };
  let immHurt = 0;
  applySpell({ element: 0, effects: [cont] }, 1, imm, { hurt: (n) => { immHurt += n; } }, seq(0.99));
  assert.equal(imm.activeEffects.length, 1);
  assert.equal(immHurt, 0);
});

test('effects: S8 buff families - kinds, incumbent renew, the query', async () => {
  const { buffKind, hasActiveEffect } = await import('../src/systems/effects.js');
  assert.equal(buffKind({ type: 25, subType: 255 }), 'slowfall');
  assert.equal(buffKind({ type: 31, subType: 255 }), 'waterWalking');
  assert.equal(buffKind({ type: 23, subType: 0 }), 'chameleonNormal');
  assert.equal(buffKind({ type: 4, subType: 0 }), null);
  const slow = { type: 25, subType: 255, durationBase: 3, durationMod: 1, durationPerLevel: 1 };
  const t = T();
  applySpell({ element: 4, effects: [slow] }, 2, t, {}, seq(0));
  assert.ok(hasActiveEffect(t, 'slowfall'));
  assert.equal(t.activeEffects[0].roundsRemaining, 4);       // 3 + 1*2, round 1 consumed at cast (F17)
  tickActiveEffects(t, {});
  assert.equal(t.activeEffects[0].roundsRemaining, 3);
  // F12: a re-cast STACKS its rounds onto the incumbent (no initial
  // round for the joining instance): 3 + 5 = 8, still one entry
  applySpell({ element: 4, effects: [slow] }, 2, t, {}, seq(0));
  assert.equal(t.activeEffects.length, 1);
  assert.equal(t.activeEffects[0].roundsRemaining, 8);
  for (let i = 0; i < 8; i++) tickActiveEffects(t, {});
  assert.ok(hasActiveEffect(t, 'slowfall'));                 // at 0: Ends NEXT pass (DFU shape)
  tickActiveEffects(t, {});
  assert.ok(!hasActiveEffect(t, 'slowfall'));                // expired
});

test('effects: HealSpellPoints (10,9) instant magicka gain', () => {
  const heal = { type: 10, subType: 9, magnitudeBaseLow: 5, magnitudeBaseHigh: 9, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 };
  assert.ok(isHealSpellPoints(heal));
  let restored = 0;
  const r = applySpell({ element: 4, effects: [heal] }, 3, T(), { restoreMagicka: (n) => { restored += n; } }, seq(0));
  assert.equal(restored, 5);                        // roll 0 -> baseLow, IncreaseMagicka(5)
  assert.equal(r.magickaHealed, 5);
});

test('effects: DamageSpellPoints (4,2) instant, saving-throw scaled', () => {
  const dmg = { type: 4, subType: 2, magnitudeBaseLow: 10, magnitudeBaseHigh: 10, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0 };
  assert.ok(isDamageSpellPoints(dmg));
  let drained = 0;
  // element 0 (Fire) vs a target with no resistance -> full magnitude
  const r = applySpell({ element: 0, effects: [dmg] }, 1, T(), { drainMagicka: (n) => { drained += n; } }, seq(0.99));
  assert.equal(drained, 10);
  assert.equal(r.magickaDrained, 10);
});

test('effects: ContinuousDamageSpellPoints (1,2) joins activeEffects and drains per round', () => {
  const cont = { type: 1, subType: 2, magnitudeBaseLow: 3, magnitudeBaseHigh: 3, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0, durationBase: 2, durationMod: 0, durationPerLevel: 0 };
  assert.ok(isContinuousDamageSpellPoints(cont));
  const t = T();
  let drained = 0;
  const sinks = { drainMagicka: (n) => { drained += n; } };
  // .99 save roll -> 100% lands; the initial round drains AT CAST (F17)
  const r = applySpell({ element: 0, effects: [cont] }, 1, t, sinks, seq(0.99));
  assert.equal(r.continuous, 1);
  assert.equal(t.activeEffects.length, 1);
  assert.equal(t.activeEffects[0].kind, 'continuousDamageSpellPoints');
  assert.equal(drained, 3);
  assert.equal(t.activeEffects[0].roundsRemaining, 1);
  tickActiveEffects(t, sinks, seq(0.99));            // round 2, fresh save (F10)
  assert.equal(drained, 6);
  assert.equal(t.activeEffects[0].roundsRemaining, 0);
});

test('effects: FortifyAttribute (type 9) - live mod, like-kind stacks, unlike coexists, DFU expiry', () => {
  // subType 0 = Strength. Fortify +magnitude for a duration.
  const fort = { type: 9, subType: 0, magnitudeBaseLow: 10, magnitudeBaseHigh: 10, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0, durationBase: 3, durationMod: 0, durationPerLevel: 0 };
  assert.ok(isFortifyAttribute(fort));
  const t = { stats: { strength: 50 }, career: {}, health: 30, maxHealth: 40 };
  const r = applySpell({ element: 4, effects: [fort] }, 1, t, {}, seq(0.99));
  assert.equal(r.fortified, 1);
  assert.equal(t.activeEffects.length, 1);
  assert.equal(t.activeEffects[0].kind, 'fortifyAttribute');
  assert.equal(t.activeEffects[0].roundsRemaining, 2);  // 3, round 1 consumed at cast (F17)
  assert.equal(liveStat(t, 'strength'), 60);            // base 50 + fortify 10
  assert.equal(liveStat(t, 'agility'), 0);              // untouched stat -> base (absent -> 0)
  // F12: a like-kind re-cast (same stat + SAME settings) STACKS its
  // rounds onto the incumbent and keeps the incumbent's magnitude
  applySpell({ element: 4, effects: [fort] }, 1, t, {}, seq(0.99));
  assert.equal(t.activeEffects.length, 1);
  assert.equal(t.activeEffects[0].roundsRemaining, 5);  // 2 + 3
  assert.equal(liveStat(t, 'strength'), 60);
  // a DIFFERENT-settings fortify of the same stat is NOT like-kind:
  // it coexists as its own instance and the mods SUM (DFU parallel)
  const fort2 = { ...fort, magnitudeBaseLow: 5, magnitudeBaseHigh: 5, durationBase: 2 };
  applySpell({ element: 4, effects: [fort2] }, 1, t, {}, seq(0.99));
  assert.equal(t.activeEffects.length, 2);
  assert.equal(liveStat(t, 'strength'), 65);            // 50 + 10 + 5
  // tick to expiry: fort2 (1 round left) Ends after the next pass
  tickActiveEffects(t, {}, seq(0.99));                  // fort: 4, fort2: 0 (kept this pass)
  assert.equal(liveStat(t, 'strength'), 65);            // the mod survives the pass it expires in
  tickActiveEffects(t, {}, seq(0.99));                  // fort2 Ends; fort: 3
  assert.equal(t.activeEffects.length, 1);
  assert.equal(liveStat(t, 'strength'), 60);
  for (let i = 0; i < 4; i++) tickActiveEffects(t, {}, seq(0.99));
  assert.equal(t.activeEffects.length, 0);
  assert.equal(liveStat(t, 'strength'), 50);
});

test('effects: a fortified stat raises combat output (liveStat fronts the formulas)', async () => {
  const { statsToHit } = await import('../src/combat/formulas.js');
  const base = { stats: { luck: 50, agility: 50 } };
  const foe = { stats: { luck: 50, agility: 50 } };
  assert.equal(statsToHit(base, foe), 0);               // equal stats -> 0
  // fortify the attacker's agility +20 -> statsToHit gains floor(20/10)=2
  base.activeEffects = [{ kind: 'fortifyAttribute', stat: 'agility', magnitude: 20, roundsRemaining: 5 }];
  assert.equal(statsToHit(base, foe), 2);
});
