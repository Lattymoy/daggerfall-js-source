// LEGEND-HELD (FIELD BUGS 2026-10-11b, bible/01-Overview/bugs/Field-Bugs-2026-10-11b.md; the Discord's "Equipping legendary
// shield Aegis of Dawn damage it by 1/3 of its durability"; Mac: "I dont care about DFU parity"). A departure
// (Port-Ledger A): DFU bills a Cast-When-Held spell's whole casting cost in condition when the piece goes on
// (CastWhenHeld.cs; HELD-REWEAR made a re-wear inside six hours free and the bill stop at 1), and the Aegis of Dawn's
// Spell Resistance cost a leather buckler a third of its condition at its first equip. A Legendary now pays nothing to
// go on; every other held piece keeps the bill. Fixtures are the producers': the loot ladder's Aegis of Dawn
// (lootRarity.js applyRarity over its own record) on a leather Buckler (itemTemplates.js), and a Rare amulet's held
// Fortify (test/systems/fb1009f.test.js's record). Pure: no game data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENCHANTMENT_TYPES as T, setDefaultEnchantCtx, heldEquipBill } from '../../src/systems/enchantments.js';
import '../../src/systems/effects.js';
import { equipItem, unequipSlot } from '../../src/systems/equip.js';
import { ITEM_GROUPS } from '../../src/characters/equipRules.js';
import { classicCastingCost } from '../../src/systems/spellcost.js';
import { LEGENDARIES, applyRarity } from '../../src/systems/loot/lootRarity.js';
import { setItemFields, mintCondition } from '../../src/systems/item/itemTemplates.js';
import { seededRng } from '../../src/systems/wind/wind.js';

const BUCKLER = 109;
// a held spell as the CasterOnly Fortify of fb1009f (49 classic points at skill 40), standing at both params
const spell = (index) => ({ index, name: 'Held', rangeType: 0, effects: [{ type: 9, subType: 0, durationBase: 3, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1, magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 }, { type: -1 }, { type: -1 }] });
const wearer = (items) => ({ name: 'W', isPlayer: true, health: 20, maxHealth: 30, items, level: 5, stats: {}, skills: 40, career: {} });
const AEGIS = LEGENDARIES.find((r) => r.id === 'aegis-of-dawn');
/** The ladder's Aegis of Dawn on a leather Buckler, as a drop mints it. */
const aegis = () => applyRarity(mintCondition(setItemFields({ group: 'Armor', templateIndex: BUCKLER, material: 0 })), 'legendary', seededRng(7), [AEGIS]);
function withClock(fn) {
  const clock = { now: 100_000 };
  setDefaultEnchantCtx({ spellsByIndex: () => new Map([[AEGIS.enchantment.param, spell(AEGIS.enchantment.param)], [4, spell(4)]]), now: () => clock.now });
  try { fn(clock); } finally { setDefaultEnchantCtx(null); }
}

test('LEGEND-HELD: the Aegis of Dawn goes on at the condition it had - its held spell cast, nothing billed; on, off and on again a day later, still nothing', () => withClock((clock) => {
  const s = aegis();
  assert.equal(s.legendary, 'aegis-of-dawn');
  assert.equal(s.rarity, 'legendary');
  assert.ok(s.enchantments.some((e) => e.type === T.CastWhenHeld), 'its held spell, the record\'s');
  const max = s.maxCondition;
  assert.ok(max > 0 && s.currentCondition === max, 'minted whole');
  const w = wearer([s]);
  equipItem(w, s);
  assert.ok(Number.isFinite(s.timeEffectsLastRerolled), 'the spell was cast');
  assert.equal(s.currentCondition, max, 'nothing billed for going on');
  unequipSlot(w, s.equipSlot);
  clock.now += 24 * 60;
  equipItem(w, s);
  assert.equal(s.currentCondition, max, 'nor past the six hours');
}));

test('LEGEND-HELD: only a Legendary - a Rare\'s held amulet still pays its casting cost, and the bill still stops at 1', () => withClock(() => {
  const cost = classicCastingCost(spell(4), () => 40);
  assert.ok(cost > 0);
  const a = { name: 'Amulet', templateIndex: 133, group: ITEM_GROUPS.Jewellery, rarity: 'rare', currentCondition: 800, maxCondition: 800, enchantments: [{ type: T.CastWhenHeld, param: 4 }] };
  equipItem(wearer([a]), a);
  assert.equal(a.currentCondition, 800 - cost);
  assert.equal(heldEquipBill({ currentCondition: 10, maxCondition: 800 }, 49), 9);
  assert.equal(heldEquipBill({ rarity: 'legendary', currentCondition: 10, maxCondition: 800 }, 49), 0);
}));
