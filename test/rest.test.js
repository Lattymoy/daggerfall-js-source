// S20: rest recovery rates + the exhaustion collapse outcome.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SPECIAL_ABILITY, RAPID_HEALING, hasSpecialAbility, healingRateModifier,
  healthRecoveryRate, fatigueRecoveryRate, spellPointRecoveryRate,
  exhaustionOutcome, EXHAUSTED_SAFE_TEXT_ID, EXHAUSTED_ENEMIES_TEXT_ID,
} from '../src/systems/rest.js';

const P = (over = {}) => ({
  isPlayer: true, level: 5, maxHealth: 50, maxMagicka: 40, fatigue: 0,
  stats: { strength: 50, endurance: 50, willpower: 50 },
  skills: 30, career: {}, ...over,
});

test('rest: the three per-hour rates, verbatim', () => {
  // HealingRateModifier: floor(END/10) - 5 (the classic negative-mod
  // bug deliberately not recreated, following DFU)
  assert.equal(healingRateModifier(50), 0);
  assert.equal(healingRateModifier(39), -2);
  assert.equal(healingRateModifier(100), 5);
  // Health: max(floor(mod + (medical + 60) x maxHealth / 1000), 1) -
  // flat skills 30, END 50 -> floor(0 + 90*50/1000) = 4
  assert.equal(healthRecoveryRate(P()), 4);
  // RapidHealing Always -> the add becomes 100: floor(130*50/1000) = 6
  assert.equal(healthRecoveryRate(P({ career: { rapidHealing: RAPID_HEALING.Always } })), 6);
  // InDarkness applies when NOT (day && outside); InLight needs both
  assert.equal(healthRecoveryRate(P({ career: { rapidHealing: RAPID_HEALING.InDarkness } }), { day: false, inside: true }), 6);
  assert.equal(healthRecoveryRate(P({ career: { rapidHealing: RAPID_HEALING.InLight } }), { day: true, inside: false }), 6);
  assert.equal(healthRecoveryRate(P({ career: { rapidHealing: RAPID_HEALING.InLight } }), { day: false, inside: true }), 4);
  // The floor of 1: a dying-endurance low-health entity still gets 1
  assert.equal(healthRecoveryRate(P({ maxHealth: 1, stats: { endurance: 10 } })), 1);
  // Fatigue: max(floor(maxFatigue/8), 1) in STORED x64 units
  assert.equal(fatigueRecoveryRate(6400), 800);
  assert.equal(fatigueRecoveryRate(4), 1);
  // Spell points: maxMagicka/8, zeroed by NoRegenSpellPoints (the
  // ability bit rides the bitfield's LOW byte, verbatim cast)
  assert.equal(spellPointRecoveryRate(P()), 5);
  assert.ok(hasSpecialAbility({ abilityFlagsAndSpellPointsBitfield: 8 }, SPECIAL_ABILITY.NoRegenSpellPoints));
  assert.ok(!hasSpecialAbility({ abilityFlagsAndSpellPointsBitfield: 0x100 }, SPECIAL_ABILITY.NoRegenSpellPoints));
  assert.equal(spellPointRecoveryRate(P({ career: { abilityFlagsAndSpellPointsBitfield: 8 } })), 0);
});

test('rest: the exhaustion outcome - a safe collapse rests an hour, enemies or water kill', () => {
  // Safe: one hour's worth of each pool + the 1071 text
  const safe = exhaustionOutcome({ enemiesNearby: false, swimming: false, entity: P() });
  assert.equal(safe.kind, 'rest');
  assert.equal(safe.textId, EXHAUSTED_SAFE_TEXT_ID);
  assert.equal(safe.health, 4);
  assert.equal(safe.fatigue, 800);   // maxFatigue (50+50)*64 = 6400 -> /8
  assert.equal(safe.magicka, 5);
  // Enemies nearby: death with the 1072 text
  const near = exhaustionOutcome({ enemiesNearby: true, swimming: false, entity: P() });
  assert.equal(near.kind, 'death');
  assert.equal(near.textId, EXHAUSTED_ENEMIES_TEXT_ID);
  assert.ok(!near.inWater);
  // In water: death by drowning line (no RSC record - the localized
  // string), even with no enemies around
  const wet = exhaustionOutcome({ enemiesNearby: false, swimming: true, entity: P() });
  assert.equal(wet.kind, 'death');
  assert.equal(wet.textId, null);
  assert.ok(wet.inWater);
});
