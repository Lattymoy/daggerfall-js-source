// E1: THE ENCHANTMENT SYSTEM - dispatcher, registry, fold and pump
// (DoItemEnchantmentPayloads + the Enchanting effect classes, MIT
// Daggerfall Workshop). The port's magic items have carried their
// MAGIC.DEF pairs since S1 and nothing ever read them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENCHANTMENT_TYPES as T, PAYLOAD, doItemEnchantmentPayloads,
  computeEnchantmentMods, enchantmentMagicRound, itemEnchantments,
  mobileAffinityMatches, enchantArmorMod, enchantChanceToHitMod,
  entityAbsorbsSpells, liveMaxMagicka, isEnchantedItem,
  POTENT_VS_DAMAGE, LOW_DAMAGE_VS, ENHANCE_SKILL_MOD, EXTRA_SPELL_PTS_MAX_INCREASE,
} from '../src/systems/enchantments.js';
import { calculateSuccessfulHit, calculateAttackDamage } from '../src/combat/formulas.js';
import { skillValue } from '../src/systems/skills.js';
import { tryAbsorption } from '../src/systems/absorption.js';
import { runMagicRoundsFor } from '../src/systems/worldTick.js';
import { equipItem, unequipSlot, lowerCondition } from '../src/systems/equip.js';
import { ITEM_GROUPS } from '../src/characters/equipRules.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';

const item = (type, param = -1, over = {}) => ({
  name: 'Test Item', templateIndex: 135, group: ITEM_GROUPS.Jewellery,
  currentCondition: 100, maxCondition: 100, equipSlot: 9,
  enchantments: [{ type, param }], ...over,
});
const wearer = (items, over = {}) => ({ name: 'W', health: 20, maxHealth: 30, items, level: 5, stats: {}, skills: [40, 40, 40, 40], ...over });

test('E1 registry: the item walk skips None and an EMPTY list answers null (GetCombinedEnchantmentSettings)', () => {
  assert.equal(itemEnchantments({ enchantments: [{ type: -1, param: 0 }] }), null);
  assert.equal(itemEnchantments({}), null);
  assert.equal(isEnchantedItem(item(T.PotentVs, 0)), true);
});

test('E1 dispatcher: THE UNKNOWN-KEY ABORT QUIRK - a VisionProblems slot stops the walk mid-item (:985-988)', () => {
  const it = item(T.VisionProblems, 0);
  it.enchantments.push({ type: T.PotentVs, param: 0 });   // Undead - would add +5
  const target = { mobileType: 15 };                      // Skeletal Warrior (Undead)
  const out = doItemEnchantmentPayloads(PAYLOAD.Strikes, it, { entity: wearer([]), target, damage: 10 });
  assert.equal(out, 10, 'the real enchantment behind the unknown key never ran - DFU returns damageOut mid-foreach');
  // reversed order: PotentVs first DOES run before the abort
  const it2 = item(T.PotentVs, 0);
  it2.enchantments.push({ type: T.VisionProblems, param: 0 });
  assert.equal(doItemEnchantmentPayloads(PAYLOAD.Strikes, it2, { entity: wearer([]), target, damage: 10 }), 10 + POTENT_VS_DAMAGE);
});

test('E1 strikes: PotentVs/LowDamageVs modulate by AFFINITY and the total clamps at 0 (:1011, :1030-1033)', () => {
  assert.equal(mobileAffinityMatches(15, 0), true, 'Skeletal Warrior is Undead');
  assert.equal(mobileAffinityMatches(140, 2), true, 'a class enemy (128+) is Human');
  const undead = { mobileType: 15 };
  assert.equal(doItemEnchantmentPayloads(PAYLOAD.Strikes, item(T.PotentVs, 0), { target: undead, damage: 3, entity: wearer([]) }), 3 + POTENT_VS_DAMAGE);
  assert.equal(doItemEnchantmentPayloads(PAYLOAD.Strikes, item(T.PotentVs, 1), { target: undead, damage: 3, entity: wearer([]) }), 3, 'Daedra param misses an undead');
  assert.equal(doItemEnchantmentPayloads(PAYLOAD.Strikes, item(T.LowDamageVs, 0), { target: undead, damage: 2, entity: wearer([]) }), Math.max(0, 2 + LOW_DAMAGE_VS), 'clamped at zero');
});

test('E1 strikes: VampiricEffect WhenStrikes heals the wearer by the damage dealt; HealthLeech stamps and bills', () => {
  const w = wearer([]);
  doItemEnchantmentPayloads(PAYLOAD.Strikes, item(T.VampiricEffect, 1), { entity: w, target: { mobileType: 3 }, damage: 7 });
  assert.equal(w.health, 27);
  const hurt = [];
  const leech = item(T.HealthLeech, 0);   // WheneverUsed (HealthLeech.cs:132-136 - Params.WheneverUsed is 0)
  doItemEnchantmentPayloads(PAYLOAD.Strikes, leech, { entity: w, target: { mobileType: 3 }, damage: 1, nowMinutes: 555, ctx: { hurtSelf: (n) => hurt.push(n) } });
  assert.equal(leech.timeHealthLeechLastUsed, 555, 'the stamp fires on Strikes (HealthLeech.cs first gate)');
  assert.deepEqual(hurt, [8], 'leechWeaponAmount');
});

test('E1 pump: RegensHealth cadence + conditions; UserTakesDamage bills through the sink; the broken gate', () => {
  const all = item(T.RegensHealth, 0);
  const w = wearer([all]);
  for (let r = 1; r <= 8; r++) enchantmentMagicRound(w, r, {});
  assert.equal(w.health, 22, '+1 at rounds 4 and 8 (regeneratePerRounds = 4)');
  // InSunlight (1) with NO seam mounted idles - the headless charter
  const sun = wearer([item(T.RegensHealth, 1)]);
  for (let r = 1; r <= 8; r++) enchantmentMagicRound(sun, r, {});
  assert.equal(sun.health, 20);
  // ...and answers when the seam does
  const sun2 = wearer([item(T.RegensHealth, 1)]);
  for (let r = 1; r <= 8; r++) enchantmentMagicRound(sun2, r, { ctx: { inSunlight: () => true } });
  assert.equal(sun2.health, 22);
  // UserTakesDamage: -1 per 4 rounds in sunlight, through the sink
  const hurt = [];
  const utd = wearer([item(T.UserTakesDamage, 0)]);
  for (let r = 1; r <= 8; r++) enchantmentMagicRound(utd, r, { ctx: { inSunlight: () => true, hurtSelf: (n) => hurt.push(n) } });
  assert.deepEqual(hurt, [1, 1]);
  // the broken-item gate: condition 0 stops MagicRound (:1018) - no regen
  const broken = wearer([item(T.RegensHealth, 0, { currentCondition: 0 })]);
  for (let r = 1; r <= 8; r++) enchantmentMagicRound(broken, r, {});
  assert.equal(broken.health, 20);
});

test('E1 pump: CastWhenHeld wear (4 normal / 60 resting), HealthLeech\'s daily law, RepairsObjects\' one item', () => {
  // AUDIT 26 F126: the wear is the PLAYER's - activeMagicItemsInRound
  // is filled solely under `if (IsPlayerEntity)`
  // (EntityEffectManager.cs:1744-1755), so only a player's held item
  // takes it.
  const held = item(T.CastWhenHeld, 4);
  const w = wearer([held], { isPlayer: true });
  for (let r = 1; r <= 8; r++) enchantmentMagicRound(w, r, {});
  assert.equal(held.currentCondition, 98, '1 point per 4 rounds');
  const resting = item(T.CastWhenHeld, 4);
  const w2 = wearer([resting], { isPlayer: true });
  for (let r = 1; r <= 120; r++) enchantmentMagicRound(w2, r, { nowMinutes: r, ctx: { isResting: () => true } });
  assert.equal(resting.currentCondition, 98, '1 per 60 while resting');
  // ...and an ENEMY's identical item does NOT wear - it is looted at
  // its remaining condition rather than degrading and breaking.
  const foeHeld = item(T.CastWhenHeld, 4);
  const foe = wearer([foeHeld]);   // no isPlayer
  for (let r = 1; r <= 120; r++) enchantmentMagicRound(foe, r, {});
  assert.equal(foeHeld.currentCondition, 100, 'an enemy\'s held item never wears');
  // HealthLeech UnlessUsedDaily: silent inside a day of the stamp, 1/4 rounds past it
  const hurt = [];
  const leech = item(T.HealthLeech, 1, { timeHealthLeechLastUsed: 0 });   // UnlessUsedDaily = 1
  const w3 = wearer([leech]);
  enchantmentMagicRound(w3, 4, { nowMinutes: MINUTES_PER_DAY - 1, ctx: { hurtSelf: (n) => hurt.push(n) } });
  assert.deepEqual(hurt, [], 'used within the day - no leech');
  enchantmentMagicRound(w3, 8, { nowMinutes: MINUTES_PER_DAY + 2, ctx: { hurtSelf: (n) => hurt.push(n) } });
  assert.deepEqual(hurt, [1], 'past a day unused - the leech runs');
  // RepairsObjects: player only, first damaged item, enchanted skipped without the setting
  const damaged = { name: 'Sword', templateIndex: 120, currentCondition: 50, maxCondition: 100 };
  const enchDamaged = item(T.PotentVs, 0, { currentCondition: 10, equipSlot: null });
  const rep = wearer([enchDamaged, damaged, item(T.RepairsObjects, -1)], { isPlayer: true });
  enchantmentMagicRound(rep, 4, {});
  assert.equal(damaged.currentCondition, 51, 'the first repairable (mundane) item gains 1');
  assert.equal(enchDamaged.currentCondition, 10, 'enchanted skipped while AllowMagicRepairs is off');
});

test('E1 pump: Good/BadRepWith re-apply into the CLEARED reaction mods each round (DoMagicRound:1710-1714)', () => {
  const good = item(T.GoodRepWith, 5);   // All
  const w = wearer([good], { isPlayer: true });
  enchantmentMagicRound(w, 1, {});
  assert.deepEqual(w.reactionMods, [10, 10, 10, 10, 10]);
  enchantmentMagicRound(w, 2, {});
  assert.deepEqual(w.reactionMods, [10, 10, 10, 10, 10], 'cleared and re-applied - never stacking');
  w.items = [];   // taken off: the next round clears and nothing re-applies
  enchantmentMagicRound(w, 3, {});
  assert.deepEqual(w.reactionMods, [0, 0, 0, 0, 0]);
});

test('E1 pump: VampiricEffect AtRange drains every foe inside 2.25 through the pool sinks', () => {
  const w = wearer([item(T.VampiricEffect, 0)], { health: 10 });
  const drained = [];
  const ctx = { nearbyFoes: (range) => { assert.equal(range, 2.25); return [{ mobileType: 3, hurt: (n) => drained.push(n) }, { mobileType: 7, hurt: (n) => drained.push(n) }]; } };
  enchantmentMagicRound(w, 4, { ctx });
  assert.deepEqual(drained, [1, 1]);
  assert.equal(w.health, 12);
});

test('E1 fold: the channels reach their formulas - armour, chance-to-hit, skills, absorption, max magicka', () => {
  const w = wearer([item(T.StrengthensArmor, -1), item(T.EnhancesSkill, 2)], { isPlayer: true });
  computeEnchantmentMods(w);
  assert.equal(enchantArmorMod(w), -5);
  assert.equal(skillValue(w, 2), 40 + ENHANCE_SKILL_MOD, 'SetSkillMod through the live read');
  // BadReactionsFrom: near humanoids = -5 armour AND -5 to-hit (its
  // constant is the ONE core writer of ChanceToHitModifier, :814)
  const bad = wearer([item(T.BadReactionsFrom, 0)]);
  computeEnchantmentMods(bad, { nearbyFoes: () => [{ mobileType: 140 }] });   // a class enemy = Human
  assert.equal(enchantChanceToHitMod(bad), -5);
  assert.equal(enchantArmorMod(bad), -5);
  // ...and the armour channel lands in calculateSuccessfulHit: a
  // stronger armour (-5) shifts the hit threshold by EXACTLY 5 points
  // - probe the dice threshold on both targets rather than guessing
  // the absolute chance
  const attacker = { stats: {}, skills: [], level: 1 };
  const targetBase = { armorValues: new Array(7).fill(60), stats: {}, skills: [], level: 1 };
  // F122: built through the FOLD, not by hand - the bag has two
  // armour channels now and a hand-written one can spell either.
  const targetStrong = { ...targetBase, items: [item(T.StrengthensArmor, -1)] };
  computeEnchantmentMods(targetStrong);
  const threshold = (target) => {
    for (let r = 0; r < 100; r++) {
      if (!calculateSuccessfulHit(attacker, target, 0, 0, () => r / 100)) return r;
    }
    return 100;
  };
  assert.equal(threshold(targetBase) - threshold(targetStrong), 5, 'the -5 armour mod moves the threshold by exactly 5');
  // AbsorbsSpells: the fold turns the absorption gate on
  const abs = wearer([item(T.AbsorbsSpells, -1)], { maxMagicka: 200, magicka: 0, career: {}, level: 1 });   // room for the cost - cost > available refuses, the law's own gate
  computeEnchantmentMods(abs);
  assert.equal(entityAbsorbsSpells(abs), true);
  // a real destruction record (the absorption suite's own fixture
  // shape): with the fold's absorbing flag the whole cost absorbs,
  // and with the item off it passes through - the F-gap closed
  const effect = {
    type: 4, subType: 0,
    magnitudeBaseLow: 20, magnitudeBaseHigh: 20, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
    durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
  };
  assert.ok(tryAbsorption(effect, 1, abs, { absorbing: entityAbsorbsSpells(abs) }) > 0, 'the AbsorbsSpells fold absorbs');
  assert.equal(tryAbsorption(effect, 1, abs, { absorbing: false }), 0, 'no ring, no absorption');
  // ExtraSpellPts: the season arm + liveMaxMagicka
  const esp = wearer([item(T.ExtraSpellPts, 0)], { maxMagicka: 25 });   // DuringWinter
  computeEnchantmentMods(esp, { season: () => 0 });
  assert.equal(liveMaxMagicka(esp), 25 + EXTRA_SPELL_PTS_MAX_INCREASE);
  computeEnchantmentMods(esp, { season: () => 2 });
  assert.equal(liveMaxMagicka(esp), 25, 'out of season the bonus drops');
});

test('E1 equip edge: the fold follows the worn set immediately, and the break edge fires the Breaks payload', () => {
  const ring = item(T.StrengthensArmor, -1, { equipSlot: undefined });
  const w = wearer([ring], { career: {} });
  delete ring.equipSlot;
  equipItem(w, ring);
  assert.equal(enchantArmorMod(w), -5, 'equipItem re-folds through the hook - no round of lag');
  unequipSlot(w, ring.equipSlot);
  assert.equal(enchantArmorMod(w), 0, 'and unequip clears it');
  // the Breaks edge: SoulBound releases its soul where a ctx provides
  // the spawner; the lowerCondition zero edge is the one home
  const bound = item(T.SoulBound, 9);
  const spawned = [];
  doItemEnchantmentPayloads(PAYLOAD.Breaks, bound, { ctx: { spawnFoe: (t) => spawned.push(t) } });
  assert.deepEqual(spawned, [9]);
  const plain = item(T.CastWhenHeld, 4, { currentCondition: 1 });
  assert.equal(lowerCondition(plain, 5, null, null), true, 'the zero edge reports the break');
});

test('E1 one home: runMagicRoundsFor drives the pump for every subscriber', () => {
  const regen = item(T.RegensHealth, 0);
  const w = wearer([regen], { activeEffects: [] });
  const rounds = runMagicRoundsFor(w, 0, 8, { sinks: { hurt: () => {} } });
  assert.equal(rounds, 8);
  assert.equal(w.health, 22, 'the enchantment pump rode the same rounds diseases and effects do');
});

test('E1 strikes wiring: calculateAttackDamage runs the payload with the ASYMMETRIC gates (WeaponManager vs EnemyAttack)', () => {
  // the player's zero-damage swing still stamps HealthLeech
  const leech = item(T.HealthLeech, 0, { group: ITEM_GROUPS.Weapons, templateIndex: 113, material: 2 });
  const player = { isPlayer: true, stats: {}, skills: [], level: 1, career: {} };
  const foe = { stats: {}, skills: [], level: 1, armorValues: new Array(7).fill(0), minMetalToHit: -1, mobileType: 3 };
  calculateAttackDamage(player, foe, { weapon: leech, rolls: () => 0.99, enchantCtx: { nowMinutes: 777 } });
  assert.equal(leech.timeHealthLeechLastUsed, 777, 'player side: the payload runs on ANY hit resolution (WeaponManager.cs:618)');
  // the enemy side gates on damage > 0 (EnemyAttack.cs:263)
  const leech2 = item(T.HealthLeech, 0, { group: ITEM_GROUPS.Weapons, templateIndex: 113, material: 2 });
  const enemy = { stats: {}, skills: [], level: 1, career: {} };
  calculateAttackDamage(enemy, foe, { weapon: leech2, rolls: () => 0.99, enchantCtx: { nowMinutes: 777 } });
  assert.equal(leech2.timeHealthLeechLastUsed ?? 0, 0, 'enemy side: a zero-damage strike runs no payload');
});
