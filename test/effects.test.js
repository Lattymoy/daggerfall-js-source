// S7/S13/S14/S15: the effect spine - heal, continuous over rounds,
// duration arithmetic, expiry, the GetMagnitude save gate, fortify,
// the attribute drain/heal/transfer families, fatigue, regenerate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applySpell, tickActiveEffects, rollDuration, healAttributeDamage,
  isHealHealth, isHealFatigue, isDamageSpellPoints, isContinuousDamageSpellPoints,
  isFortifyAttribute, isDrainAttribute, isHealAttribute, isTransferAttribute,
  isTransferHealth, isRegenerate, FATIGUE_MULTIPLIER, maxFatigue,
} from '../src/systems/effects.js';
import { liveStat } from '../src/systems/statMods.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const T = () => ({ stats: { willpower: 50 }, career: {}, health: 30, maxHealth: 40 });

test('effects: HealHealth (10,8) instant; duration arithmetic verbatim', () => {
  const heal = { type: 10, subType: 8, magnitudeBaseLow: 5, magnitudeBaseHigh: 9, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 };
  assert.ok(isHealHealth(heal));
  let healed = 0;
  // rangeType 0 (CasterOnly): GetMagnitude skips ModifyEffectAmount -
  // no save roll (S15); magnitude roll 0 -> baseLow
  const r = applySpell({ element: 4, rangeType: 0, effects: [heal] }, 3, T(), { heal: (n) => { healed += n; } }, seq(0));
  assert.equal(healed, 5);
  assert.equal(r.healed, 5);
  // duration: base 3 + mod 2 x floor(7/3) = 7; per-0 guards to 1
  assert.equal(rollDuration({ durationBase: 3, durationMod: 2, durationPerLevel: 3 }, 7), 7);
  assert.equal(rollDuration({ durationBase: 1, durationMod: 4, durationPerLevel: 0 }, 5), 21);
  // F11: the per-level multiplier CLAMPS AT 1 (DFU SetDuration) -
  // a level-1 caster with per-level 4 still gets base + mod x 1
  assert.equal(rollDuration({ durationBase: 3, durationMod: 2, durationPerLevel: 4 }, 1), 5);
});

test('effects: the GetMagnitude save gate (S15) - CasterOnly skips, ranged heals save too', () => {
  // A caster-only damage spell rolls NO save: seq(0) would prorate it
  // to zero if a save rolled (throw 55 vs roll 1) - it lands full.
  const dmg = { type: 4, subType: 0, magnitudeBaseLow: 10, magnitudeBaseHigh: 10, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0 };
  let hurt = 0;
  applySpell({ element: 0, rangeType: 0, effects: [dmg] }, 1, T(), { hurt: (n) => { hurt += n; } }, seq(0));
  assert.equal(hurt, 10);
  // A RANGED heal on a magic-immune target is fully saved to nothing
  // (DFU GetMagnitude applies ModifyEffectAmount to any non-CasterOnly
  // bundle - "Save versus spell made." fires on heals too).
  const heal = { type: 10, subType: 8, magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 };
  const imm = { stats: { willpower: 50 }, career: { immunityFlags: 2 } };   // Magic-immune
  let healed = 0;
  applySpell({ element: 4, rangeType: 2, effects: [heal] }, 1, imm, { heal: (n) => { healed += n; } }, seq(0));
  assert.equal(healed, 0);
});

test('effects: continuous (1,0) - initial round at cast, saves roll FRESH per round, DFU expiry', () => {
  const cont = { type: 1, subType: 0, magnitudeBaseLow: 10, magnitudeBaseHigh: 10, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
    durationBase: 2, durationMod: 0, durationPerLevel: 1 };
  const t = T();
  let hurt = 0;
  const sinks = { hurt: (n) => { hurt += n; } };
  // F17: the INITIAL magic round fires AT CAST - magnitude rolls (10..10)
  // then the save (verbatim GetMagnitude order): roll .39 -> 40 vs
  // throw 55, prorated 25%; trunc(10 * 25/100) = 2; round 1 consumed
  const r = applySpell({ element: 0, rangeType: 2, effects: [cont] }, 1, t, sinks, seq(0.39));
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
  applySpell({ element: 0, rangeType: 2, effects: [cont] }, 1, imm, { hurt: (n) => { immHurt += n; } }, seq(0.99));
  assert.equal(imm.activeEffects.length, 1);
  assert.equal(immHurt, 0);
});

test('effects: S8 buff families - kinds, incumbent renew, the query', async () => {
  const { buffKind, hasActiveEffect } = await import('../src/systems/effects.js');
  assert.equal(buffKind({ type: 25, subType: 255 }), 'slowfall');
  assert.equal(buffKind({ type: 31, subType: 255 }), 'waterWalking');
  assert.equal(buffKind({ type: 23, subType: 0 }), 'chameleonNormal');
  assert.equal(buffKind({ type: 4, subType: 0 }), null);
  // Parity fix 2026-08-16d: REAL records read subType 0xFF as -1
  // (verbatim sbyte decode) and DFU keys on the BYTE cast - the door
  // must accept both spellings (SPELLS.STD Levitate index 4 reads
  // { type: 14, subType: -1 } through our reader)
  assert.equal(buffKind({ type: 14, subType: -1 }), 'levitate');
  assert.equal(buffKind({ type: 25, subType: -1 }), 'slowfall');
  const { isRegenerate: isRegen } = await import('../src/systems/effects.js');
  assert.ok(isRegen({ type: 18, subType: -1 }));
  assert.ok(isRegen({ type: 18, subType: 255 }));
  const slow = { type: 25, subType: 255, durationBase: 3, durationMod: 1, durationPerLevel: 1 };
  const t = T();
  applySpell({ element: 4, rangeType: 0, effects: [slow] }, 2, t, {}, seq(0));
  assert.ok(hasActiveEffect(t, 'slowfall'));
  assert.equal(t.activeEffects[0].roundsRemaining, 4);       // 3 + 1*2, round 1 consumed at cast (F17)
  tickActiveEffects(t, {});
  assert.equal(t.activeEffects[0].roundsRemaining, 3);
  // F12: a re-cast STACKS its rounds onto the incumbent (no initial
  // round for the joining instance): 3 + 5 = 8, still one entry
  applySpell({ element: 4, rangeType: 0, effects: [slow] }, 2, t, {}, seq(0));
  assert.equal(t.activeEffects.length, 1);
  assert.equal(t.activeEffects[0].roundsRemaining, 8);
  for (let i = 0; i < 8; i++) tickActiveEffects(t, {});
  assert.ok(hasActiveEffect(t, 'slowfall'));                 // at 0: Ends NEXT pass (DFU shape)
  tickActiveEffects(t, {});
  assert.ok(!hasActiveEffect(t, 'slowfall'));                // expired
});

test('effects: HealFatigue (10,9) instant x64 - the S15 parity fix of the S13 key', () => {
  // DFU HealFatigue.ClassicKey = (10, 9); Heal-SpellPoints is
  // potion-only with NO classic key (the S13 slice had this wrong).
  const heal = { type: 10, subType: 9, magnitudeBaseLow: 5, magnitudeBaseHigh: 9, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 };
  assert.ok(isHealFatigue(heal));
  assert.equal(FATIGUE_MULTIPLIER, 64);
  let restored = 0;
  const r = applySpell({ element: 4, rangeType: 0, effects: [heal] }, 3, T(), { restoreFatigue: (n) => { restored += n; } }, seq(0));
  assert.equal(restored, 5 * 64);                   // IncreaseFatigue(mag, assignMultiplier: true)
  assert.equal(r.fatigueHealed, 1);
  // MaxFatigue = (LiveStrength + LiveEndurance) x 64, fortify-aware
  const ent = { stats: { strength: 50, endurance: 40 } };
  assert.equal(maxFatigue(ent), 90 * 64);
  ent.activeEffects = [{ kind: 'fortifyAttribute', stat: 'strength', magnitude: 10, roundsRemaining: 2 }];
  assert.equal(maxFatigue(ent), 100 * 64);
});

test('effects: DamageFatigue (4,1) + ContinuousDamageFatigue (1,1) drain x64 through the sink', () => {
  const dmg = { type: 4, subType: 1, magnitudeBaseLow: 2, magnitudeBaseHigh: 2, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0 };
  let drained = 0;
  const sinks = { drainFatigue: (n) => { drained += n; } };
  applySpell({ element: 0, rangeType: 2, effects: [dmg] }, 1, T(), sinks, seq(0.99));   // save .99 -> 100%
  assert.equal(drained, 2 * 64);
  // continuous: initial round at cast (F17), per-round fresh roll (F10)
  const cont = { ...dmg, type: 1, durationBase: 2, durationMod: 0, durationPerLevel: 0 };
  const t = T();
  drained = 0;
  const r = applySpell({ element: 0, rangeType: 2, effects: [cont] }, 1, t, sinks, seq(0.99));
  assert.equal(r.continuous, 1);
  assert.equal(t.activeEffects[0].kind, 'continuousDamageFatigue');
  assert.equal(drained, 128);
  tickActiveEffects(t, sinks, seq(0.99));
  assert.equal(drained, 256);
});

test('effects: DamageSpellPoints (4,2) instant, saving-throw scaled', () => {
  const dmg = { type: 4, subType: 2, magnitudeBaseLow: 10, magnitudeBaseHigh: 10, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0 };
  assert.ok(isDamageSpellPoints(dmg));
  let drained = 0;
  // element 0 (Fire) vs a target with no resistance -> full magnitude
  const r = applySpell({ element: 0, rangeType: 2, effects: [dmg] }, 1, T(), { drainMagicka: (n) => { drained += n; } }, seq(0.99));
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
  const r = applySpell({ element: 0, rangeType: 2, effects: [cont] }, 1, t, sinks, seq(0.99));
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
  const r = applySpell({ element: 4, rangeType: 0, effects: [fort] }, 1, t, {}, seq(0.99));
  assert.equal(r.fortified, 1);
  assert.equal(t.activeEffects.length, 1);
  assert.equal(t.activeEffects[0].kind, 'fortifyAttribute');
  assert.equal(t.activeEffects[0].roundsRemaining, 2);  // 3, round 1 consumed at cast (F17)
  assert.equal(liveStat(t, 'strength'), 60);            // base 50 + fortify 10
  assert.equal(liveStat(t, 'agility'), 0);              // untouched stat -> base (absent -> 0)
  // F12: a like-kind re-cast (same stat + SAME settings) STACKS its
  // rounds onto the incumbent and keeps the incumbent's magnitude
  applySpell({ element: 4, rangeType: 0, effects: [fort] }, 1, t, {}, seq(0.99));
  assert.equal(t.activeEffects.length, 1);
  assert.equal(t.activeEffects[0].roundsRemaining, 5);  // 2 + 3
  assert.equal(liveStat(t, 'strength'), 60);
  // a DIFFERENT-settings fortify of the same stat is NOT like-kind:
  // it coexists as its own instance and the mods SUM (DFU parallel)
  const fort2 = { ...fort, magnitudeBaseLow: 5, magnitudeBaseHigh: 5, durationBase: 2 };
  applySpell({ element: 4, rangeType: 0, effects: [fort2] }, 1, t, {}, seq(0.99));
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

test('effects: DrainAttribute (7,s) - permanent until healed, incumbent magnitude, the 1-floor clamp', () => {
  const drain = { type: 7, subType: 0, magnitudeBaseLow: 10, magnitudeBaseHigh: 10, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0 };
  assert.ok(isDrainAttribute(drain));
  const t = { stats: { strength: 50, willpower: 50 }, career: {} };
  const r = applySpell({ element: 4, rangeType: 2, effects: [drain] }, 1, t, {}, seq(0.99));   // save .99 -> lands full
  assert.equal(r.drained, 1);
  assert.equal(t.activeEffects.length, 1);
  assert.equal(t.activeEffects[0].permanent, true);
  assert.equal(liveStat(t, 'strength'), 40);
  // permanent: ticks neither count down nor act - the drain persists
  for (let i = 0; i < 5; i++) tickActiveEffects(t, { hurt: () => { throw new Error('drain acted'); } });
  assert.equal(t.activeEffects.length, 1);
  assert.equal(liveStat(t, 'strength'), 40);
  // a re-cast is incumbent by STAT (settings-blind): magnitude ADDS
  applySpell({ element: 4, rangeType: 2, effects: [drain] }, 1, t, {}, seq(0.99));
  assert.equal(t.activeEffects.length, 1);
  assert.equal(liveStat(t, 'strength'), 30);
  // IncreaseMagnitude clamp: never below 1 relative to the PERMANENT
  // value - a huge roll pins magnitude at permanent - 1
  const big = { ...drain, magnitudeBaseLow: 100, magnitudeBaseHigh: 100 };
  applySpell({ element: 4, rangeType: 2, effects: [big] }, 1, t, {}, seq(0.99));
  assert.equal(t.activeEffects[0].magnitude, 49);
  assert.equal(liveStat(t, 'strength'), 1);
});

test('effects: HealAttribute (10,s) heals DRAIN damage only; drained-to-zero entries End', () => {
  const drain = { type: 7, subType: 0, magnitudeBaseLow: 10, magnitudeBaseHigh: 10, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0 };
  const healA = { type: 10, subType: 0, magnitudeBaseLow: 6, magnitudeBaseHigh: 6, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0 };
  assert.ok(isHealAttribute(healA));
  const t = { stats: { strength: 50, willpower: 50 }, career: {} };
  applySpell({ element: 4, rangeType: 2, effects: [drain] }, 1, t, {}, seq(0.99));
  assert.equal(liveStat(t, 'strength'), 40);
  // partial heal: 10 - 6 = 4 drained remains
  applySpell({ element: 4, rangeType: 0, effects: [healA] }, 1, t, {}, seq(0));
  assert.equal(liveStat(t, 'strength'), 46);
  // overheal: clamps at the base (never fortifies) and ENDS the drain -
  // the next tick pass removes the entry (forcedRoundsRemaining = 0)
  applySpell({ element: 4, rangeType: 0, effects: [{ ...healA, magnitudeBaseLow: 100, magnitudeBaseHigh: 100 }] }, 1, t, {}, seq(0));
  assert.equal(liveStat(t, 'strength'), 50);
  assert.equal(t.activeEffects.length, 1);
  tickActiveEffects(t, {});
  assert.equal(t.activeEffects.length, 0);
  // healing an undrained stat is a no-op (manager walk finds no
  // negative mod)
  healAttributeDamage(t, 'strength', 25);
  assert.equal(liveStat(t, 'strength'), 50);
});

test('effects: Transfer family (11) - attribute steal, TransferHealth both directions, caster required', () => {
  // Transfer{Attribute}: drains the target AND heals the caster's own
  // drained stat by the pre-clamp roll; incumbent SEPARATELY from
  // Drain (a Drain is never like-kind for a Transfer).
  const tr = { type: 11, subType: 0, magnitudeBaseLow: 8, magnitudeBaseHigh: 8, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0 };
  assert.ok(isTransferAttribute(tr));
  const target = { stats: { strength: 50, willpower: 50 }, career: {} };
  const casterEnt = { stats: { strength: 50 }, activeEffects: [{ kind: 'drainAttribute', stat: 'strength', magnitude: 5, permanent: true }] };
  assert.equal(liveStat(casterEnt, 'strength'), 45);
  applySpell({ element: 4, rangeType: 2, effects: [tr] }, 1, target, {}, seq(0.99), { entity: casterEnt, sinks: {} });
  assert.equal(liveStat(target, 'strength'), 42);
  assert.equal(target.activeEffects[0].kind, 'transferAttribute');
  assert.equal(liveStat(casterEnt, 'strength'), 50);          // the caster's drain healed (5 of the 8)
  // a Drain of the same stat coexists with the Transfer (two entries)
  const drain = { ...tr, type: 7, magnitudeBaseLow: 10, magnitudeBaseHigh: 10 };
  applySpell({ element: 4, rangeType: 2, effects: [drain] }, 1, target, {}, seq(0.99));
  assert.equal(target.activeEffects.length, 2);
  assert.equal(liveStat(target, 'strength'), 32);
  // TransferHealth (11,8): instant hurt target / heal caster; a
  // missing caster no-ops the whole effect (DFU returns before acting)
  const th = { type: 11, subType: 8, magnitudeBaseLow: 7, magnitudeBaseHigh: 7, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0 };
  assert.ok(isTransferHealth(th));
  let hurt = 0, casterHealed = 0;
  applySpell({ element: 4, rangeType: 2, effects: [th] }, 1, T(), { hurt: (n) => { hurt += n; } }, seq(0.99), { entity: casterEnt, sinks: { heal: (n) => { casterHealed += n; } } });
  assert.equal(hurt, 7);
  assert.equal(casterHealed, 7);
  hurt = 0;
  applySpell({ element: 4, rangeType: 2, effects: [th] }, 1, T(), { hurt: (n) => { hurt += n; } }, seq(0.99));
  assert.equal(hurt, 0);                                       // no caster -> nothing
  // TransferFatigue (11,9): x64 both directions
  const tf = { ...th, subType: 9, magnitudeBaseLow: 3, magnitudeBaseHigh: 3 };
  let fDrained = 0, fRestored = 0;
  applySpell({ element: 4, rangeType: 2, effects: [tf] }, 1, T(), { drainFatigue: (n) => { fDrained += n; } }, seq(0.99), { entity: casterEnt, sinks: { restoreFatigue: (n) => { fRestored += n; } } });
  assert.equal(fDrained, 3 * 64);
  assert.equal(fRestored, 3 * 64);
});

test('effects: Regenerate (18,255) heals per round; settings-keyed incumbent stacks', () => {
  const reg = { type: 18, subType: 255, magnitudeBaseLow: 4, magnitudeBaseHigh: 4, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0, durationBase: 3, durationMod: 0, durationPerLevel: 0 };
  assert.ok(isRegenerate(reg));
  const t = T();
  let healed = 0;
  const sinks = { heal: (n) => { healed += n; } };
  const r = applySpell({ element: 4, rangeType: 0, effects: [reg] }, 1, t, sinks, seq(0));
  assert.equal(r.continuous, 1);
  assert.equal(t.activeEffects[0].kind, 'regenerate');
  assert.equal(healed, 4);                             // initial round at cast (F17)
  assert.equal(t.activeEffects[0].roundsRemaining, 2);
  tickActiveEffects(t, sinks, seq(0));                 // magnitude rolls FRESH per round
  assert.equal(healed, 8);
  // a same-settings re-cast stacks rounds (CompareSettings like-kind)
  applySpell({ element: 4, rangeType: 0, effects: [reg] }, 1, t, sinks, seq(0));
  assert.equal(t.activeEffects.length, 1);
  assert.equal(t.activeEffects[0].roundsRemaining, 4); // 1 + 3
  assert.equal(healed, 8);                             // no initial round for the joiner
  // different settings -> a second instance
  applySpell({ element: 4, rangeType: 0, effects: [{ ...reg, magnitudeBaseLow: 2, magnitudeBaseHigh: 2 }] }, 1, t, sinks, seq(0));
  assert.equal(t.activeEffects.length, 2);
  assert.equal(healed, 10);
});

test('effects: a fortified stat raises combat output (liveStat fronts the formulas)', async () => {
  const { statsToHit } = await import('../src/combat/formulas.js');
  const base = { stats: { luck: 50, agility: 50 } };
  const foe = { stats: { luck: 50, agility: 50 } };
  assert.equal(statsToHit(base, foe), 0);               // equal stats -> 0
  // fortify the attacker's agility +20 -> statsToHit gains floor(20/10)=2
  base.activeEffects = [{ kind: 'fortifyAttribute', stat: 'agility', magnitude: 20, roundsRemaining: 5 }];
  assert.equal(statsToHit(base, foe), 2);
  // a DRAINED agility lowers it the same way (S15)
  base.activeEffects = [{ kind: 'drainAttribute', stat: 'agility', magnitude: 20, permanent: true }];
  assert.equal(statsToHit(base, foe), -2);
});
