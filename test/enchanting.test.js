// M3: the enchanting law against DaggerfallItemMakerWindow's cost
// accounting and FormulaHelper's enchantment-power formulas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ENCHANTMENTS, GOLD_PER_ENCHANTMENT_POINT,
  WEAPON_ENCHANTMENT_MULTIPLIER, ARMOR_ENCHANTMENT_MULTIPLIER,
  weaponEnchantmentMultiplier, armorEnchantmentMultiplier,
  itemEnchantmentPower, enchantmentListCost, totalEnchantmentCost, totalGoldCost,
  enchantDecision, applyEnchantments, enchantmentCostLabel,
  NOT_ENOUGH_GOLD_TO_ENCHANT, BEYOND_ITEM_LIMIT, ITEM_ENCHANTED,
  openPickerDecision, ITEM_MUST_BE_SELECTED, NO_ENCHANTMENTS_PREPARED,
  CANNOT_ENCHANT_MORE_POWERS, NO_MORE_SIDE_EFFECTS,
} from '../src/systems/enchanting.js';
import { WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import {
  enchantmentCost, enchantmentParamValues, sideEffectTypes,
} from '../src/systems/enchantmentCatalogue.js';

/** A power costing n; `parent` makes it a FORCED enchantment. */
const power = (n, parent = 0) => ({ enchantCost: n, parentEnchantment: parent });

test('M3: the two material tables - the same progression, a bigger base set for armor', () => {
  // Steel is the weapons' base and Leather/Chain/Chain2/Steel are the
  // armor's - the one place the two tables genuinely differ
  assert.equal(WEAPON_ENCHANTMENT_MULTIPLIER[WEAPON_MATERIALS.Steel], 0);
  for (const m of ['Leather', 'Chain', 'Chain2', 'Steel']) {
    assert.equal(ARMOR_ENCHANTMENT_MULTIPLIER[ARMOR_MATERIAL[m]], 0, m);
  }
  // iron is the only NEGATIVE one, in both
  assert.equal(WEAPON_ENCHANTMENT_MULTIPLIER[WEAPON_MATERIALS.Iron], -0.25);
  assert.equal(ARMOR_ENCHANTMENT_MULTIPLIER[ARMOR_MATERIAL.Iron], -0.25);
  // the progression is NOT monotonic in material order - Silver and
  // Adamantium share +75%, Elven and Mithril share +25% - which is
  // why this is a table and not an index into a list
  assert.equal(WEAPON_ENCHANTMENT_MULTIPLIER[WEAPON_MATERIALS.Silver], 0.75);
  assert.equal(WEAPON_ENCHANTMENT_MULTIPLIER[WEAPON_MATERIALS.Adamantium], 0.75);
  assert.equal(WEAPON_ENCHANTMENT_MULTIPLIER[WEAPON_MATERIALS.Elven], 0.25);
  assert.equal(WEAPON_ENCHANTMENT_MULTIPLIER[WEAPON_MATERIALS.Mithril], 0.25);
  assert.ok(WEAPON_MATERIALS.Silver < WEAPON_MATERIALS.Dwarven);
  assert.ok(WEAPON_ENCHANTMENT_MULTIPLIER[WEAPON_MATERIALS.Silver]
    > WEAPON_ENCHANTMENT_MULTIPLIER[WEAPON_MATERIALS.Dwarven], 'silver beats dwarven despite coming first');
  assert.equal(WEAPON_ENCHANTMENT_MULTIPLIER[WEAPON_MATERIALS.Daedric], 2.0);

  // an UNKNOWN material falls to the BASE, not to zero power - DFU's
  // `default:` shares the Steel/Leather arm
  assert.equal(weaponEnchantmentMultiplier(999), 0);
  assert.equal(weaponEnchantmentMultiplier(undefined), 0);
  assert.equal(armorEnchantmentMultiplier(999), 0);
});

test('M3: the power formula FLOORS, and a negative multiplier rounds AWAY from zero (:2660-2678)', () => {
  // find a real template with enchantment points to work from
  const t = templateByIndex(0);
  assert.ok(t.enchantmentPoints > 0, 'Ruby carries enchantment points');

  // a non-weapon, non-armor item takes its base untouched
  assert.equal(itemEnchantmentPower({ group: 'Gems', templateIndex: 0 }), t.enchantmentPoints);
  // ...even with a material set, because the multiplier stays 0
  assert.equal(itemEnchantmentPower({ group: 'Gems', templateIndex: 0, material: WEAPON_MATERIALS.Daedric }),
    t.enchantmentPoints);

  // THE MODULE ITSELF, over real templates - not a local helper, which
  // would only assert my own arithmetic back at me. A Wakizashi carries
  // 450 enchantment points and 450 is not a multiple of four, so iron
  // is exactly where flooring and rounding part company.
  const WAKIZASHI = 117;
  const wak = (material) => itemEnchantmentPower({ group: 'Weapons', templateIndex: WAKIZASHI, material });
  assert.equal(templateByIndex(WAKIZASHI).enchantmentPoints, 450);
  assert.equal(wak(WEAPON_MATERIALS.Steel), 450, 'steel is the base');
  assert.equal(wak(WEAPON_MATERIALS.Daedric), 1350, 'daedric triples it');
  assert.equal(wak(WEAPON_MATERIALS.Ebony), 900);
  // 450 * -0.25 is -112.5; flooring gives -113, so the answer is 337.
  // ROUNDING would give 338 - and that is the mutant.
  // ...and the comparison has to be against the MUTANT'S OWN form.
  // JS rounds half UP, so Math.round(-112.5) is -112 and not -113 -
  // which means `base - round(base * 0.25)` agrees with flooring here
  // and proves nothing. `base + round(base * -0.25)` is the swap that
  // actually differs.
  assert.equal(wak(WEAPON_MATERIALS.Iron), 337);
  assert.equal(450 + Math.round(450 * -0.25), 338, 'the rounding mutant would say 338');
  assert.notEqual(wak(WEAPON_MATERIALS.Iron), 450 + Math.round(450 * -0.25));
  // the same parting on ARMOR, through its own table
  const GREAVES = 104;
  assert.equal(templateByIndex(GREAVES).enchantmentPoints, 50);
  const grv = (material) => itemEnchantmentPower({ group: 'Armor', templateIndex: GREAVES, material });
  assert.equal(grv(ARMOR_MATERIAL.Steel), 50);
  assert.equal(grv(ARMOR_MATERIAL.Iron), 37, 'not 38 - 50 * -0.25 floors to -13');
  assert.notEqual(grv(ARMOR_MATERIAL.Iron), 50 + Math.round(50 * -0.25));

  const pow = (b, mult) => b + Math.floor(b * mult);
  assert.equal(pow(100, 0), 100);
  assert.equal(pow(100, 2.0), 300, 'daedric triples it');
  assert.equal(pow(100, -0.25), 75);
  // THE QUIRK: flooring a NEGATIVE rounds away from zero, so an iron
  // item loses slightly MORE than a quarter whenever the base is not
  // a multiple of four. 101 - 25.25 should be 75.75; it is 75.
  assert.equal(pow(101, -0.25), 75, 'not 76 - the floor took the extra');
  assert.equal(pow(102, -0.25), 76, '102 - floor(25.5) is 102 - 26, not 102 - 25');
  // Rounding instead of flooring answers differently on 101 - and NOT
  // on 102, where Math.round(25.5) is 26 and the two agree. The
  // discriminating case is the one to assert; the other would be a
  // pin that passes for the wrong reason.
  assert.notEqual(pow(101, -0.25), 101 - Math.round(101 * 0.25));
  assert.equal(pow(102, -0.25), 102 - Math.round(102 * 0.25), 'they agree here');
  // ...and the loss really is MORE than a clean quarter, every time
  // the base is not a multiple of four
  for (const b of [101, 102, 103, 105, 106, 107]) {
    assert.ok(pow(b, -0.25) < b - b * 0.25, `base ${b} loses more than a quarter`);
  }
  assert.equal(pow(104, -0.25), 104 - 26, 'a multiple of four loses exactly a quarter');
  // and a POSITIVE multiplier floors toward zero, the ordinary way
  assert.equal(pow(101, 0.25), 101 + 25, 'floor(25.25) = 25');

  // a null item throws rather than answering 0 - DFU's own throw
  assert.throws(() => itemEnchantmentPower(null), /item is null/);
});

test('M3: TWO SUMS OVER OVERLAPPING SETS (:229-237)', () => {
  const powers = [power(10), power(20, 7)];        // the second is FORCED
  const sides = [power(5), power(3)];

  // the ENCHANTMENT cost adds BOTH lists and EXCLUDES forced
  assert.equal(totalEnchantmentCost(powers, sides), 10 + 5 + 3);
  // the GOLD cost adds the POWERS ONLY, INCLUDES forced, x10
  assert.equal(totalGoldCost(powers), (10 + 20) * GOLD_PER_ENCHANTMENT_POINT);
  assert.equal(GOLD_PER_ENCHANTMENT_POINT, 10);

  // so: a SIDE EFFECT lands in the point sum and never in the gold
  // one (its SIGN is the next test's business)...
  assert.equal(totalEnchantmentCost([], sides), 8);
  assert.equal(totalGoldCost([]), 0);
  // ...and a FORCED enchantment costs gold and no points. They are two
  // different walks, not one sum at two scales.
  const forcedOnly = [power(20, 7)];
  assert.equal(totalEnchantmentCost(forcedOnly, []), 0);
  assert.equal(totalGoldCost(forcedOnly), 200);

  // the list helper both ways
  assert.equal(enchantmentListCost(powers), 10);
  assert.equal(enchantmentListCost(powers, { countForced: true }), 30);
  assert.equal(enchantmentListCost([]), 0);
  // a missing cost reads as 0 rather than NaN
  assert.equal(enchantmentListCost([{}]), 0);
});

test('M3: THE SIGN IS THE MECHANIC - a side effect BUYS budget and costs no gold', () => {
  // M3's first header said a side effect "costs enchantment points".
  // It does not: every side effect's EnchantCost is NEGATIVE, so
  // summing it into the enchantment total REDUCES that total. Taking
  // a drawback BUYS you budget, and the gold walk skips it, so the
  // budget is free. Pinned against the CATALOGUE's real costs rather
  // than against invented ones, so the two modules cannot drift.
  const deteriorates = enchantmentCost('ItemDeteriorates', 0);
  const sunlight = enchantmentCost('UserTakesDamage', 0);
  const regens = enchantmentCost('RegensHealth', 0);
  assert.equal(deteriorates, -3000);
  assert.equal(sunlight, -6000);
  assert.equal(regens, 4000);

  const ench = (c) => ({ enchantCost: c, parentEnchantment: 0 });
  const powers = [ench(regens)];
  const alone = totalEnchantmentCost(powers, []);
  assert.equal(alone, 4000);

  // ADDING a drawback makes the total SMALLER, not larger. `-` in
  // place of `+` in totalEnchantmentCost is the mutant, and it would
  // answer 7000 here.
  const withDrawback = totalEnchantmentCost(powers, [ench(deteriorates)]);
  assert.equal(withDrawback, 1000);
  assert.ok(withDrawback < alone, 'a drawback REDUCES the enchantment total');
  assert.notEqual(withDrawback, alone - deteriorates);

  // ...and the GOLD is untouched by it, at either end
  assert.equal(totalGoldCost(powers), 40000);
  assert.equal(totalGoldCost([]), 0);

  // which is the whole trade: an item too weak to hold the power can
  // hold it once a drawback pays the difference - at the SAME gold.
  const item = { group: 'Weapons', templateIndex: 117, material: WEAPON_MATERIALS.Steel };
  assert.equal(itemEnchantmentPower(item), 450);
  const refused = enchantDecision(item, powers, [], { gold: 10 ** 9 });
  assert.equal(refused.kind, 'overLimit', '4000 points will not fit in 450');
  const allowed = enchantDecision(item, powers, [ench(sunlight)], { gold: 10 ** 9 });
  assert.equal(allowed.kind, 'enchant', 'the drawback bought the room');
  assert.equal(allowed.cost, -2000);
  assert.equal(allowed.goldCost, totalGoldCost(powers), 'and it cost nothing to buy');
  assert.equal(refused.goldCost, undefined, 'the overLimit arm quotes no gold at all');

  // every side effect in the catalogue prices this way round - none
  // of them is a positive charge dressed up as a drawback
  for (const type of sideEffectTypes()) {
    const costs = enchantmentParamValues(type).map((p) => enchantmentCost(type, p));
    assert.ok(costs.some((c) => c < 0), `${type} carries a negative cost`);
    assert.ok(costs.every((c) => c <= 0), `${type} never charges points`);
  }
});

test('M3: the GOLD is checked FIRST, so the poorer refusal wins (:727-746)', () => {
  const item = { group: 'Weapons', templateIndex: 0, material: WEAPON_MATERIALS.Iron };
  const pw = itemEnchantmentPower(item);

  // affordable and within the limit
  const ok = enchantDecision(item, [power(1)], [], { gold: 100000 });
  assert.equal(ok.kind, 'enchant');
  assert.equal(ok.text, ITEM_ENCHANTED);
  assert.equal(ok.goldCost, 10);
  assert.equal(ok.power, pw);

  // over the item's limit, with gold to spare
  const over = enchantDecision(item, [power(pw + 1)], [], { gold: 10 ** 9 });
  assert.equal(over.kind, 'overLimit');
  assert.equal(over.text, BEYOND_ITEM_LIMIT);
  assert.equal(over.cost, pw + 1);

  // no gold, within the limit
  const poor = enchantDecision(item, [power(1)], [], { gold: 0 });
  assert.equal(poor.kind, 'noGold');
  assert.equal(poor.text, NOT_ENOUGH_GOLD_TO_ENCHANT);

  // BOTH wrong: the GOLD refusal wins, because it is tested first.
  // Swapping the two arms is the mutant this kills.
  const both = enchantDecision(item, [power(pw + 1)], [], { gold: 0 });
  assert.equal(both.kind, 'noGold', 'told about the gold, not the limit');

  // exactly enough gold, and exactly at the limit, both pass
  assert.equal(enchantDecision(item, [power(1)], [], { gold: 10 }).kind, 'enchant');
  assert.equal(enchantDecision(item, [power(pw)], [], { gold: 10 ** 9 }).kind, 'enchant',
    'spending the last point is allowed - the test is power < cost');
});

test('M3: ten enchantments is a CAP, not a refusal (:1271-1280)', () => {
  assert.equal(MAX_ENCHANTMENTS, 10);
  const item = {};
  const twelve = Array.from({ length: 12 }, (_, i) => power(i + 1));
  applyEnchantments(item, twelve);
  assert.equal(item.enchantments.length, 10, 'the first ten are applied');
  assert.equal(item.enchantments[9].enchantCost, 10, 'and the rest are dropped SILENTLY');
  // the copies are detached
  twelve[0].enchantCost = 999;
  assert.equal(item.enchantments[0].enchantCost, 1);
  // an EMPTY list throws rather than making a plain item
  assert.throws(() => applyEnchantments({}, []), /cannot be null or empty/);
  assert.throws(() => applyEnchantments({}, null), /cannot be null or empty/);
});

test('M3: the cost label is used/available (:206)', () => {
  assert.equal(enchantmentCostLabel(30, 100), '30/100');
  assert.equal(enchantmentCostLabel(0, 0), '0/0');
});

test('M4: the enchant ladder has FIVE arms, and the two new ones come FIRST', () => {
  const item = { group: 'Weapons', templateIndex: 117, material: WEAPON_MATERIALS.Steel };

  // no item at all - and this outranks everything, including having
  // no gold and having prepared nothing
  const none = enchantDecision(null, [], [], { gold: 0 });
  assert.equal(none.kind, 'noItem');
  assert.equal(none.text, ITEM_MUST_BE_SELECTED);
  assert.equal(enchantDecision(null, [power(999999)], [], { gold: 0 }).kind, 'noItem');

  // an item, but nothing prepared - which outranks the gold check, so
  // a penniless player with an empty item hears about the item
  const empty = enchantDecision(item, [], [], { gold: 0 });
  assert.equal(empty.kind, 'noEnchantments');
  assert.equal(empty.text, NO_ENCHANTMENTS_PREPARED);
  // ...and note this arm has to come before the gold one to be
  // reachable at all: an empty powers list costs zero gold, so the
  // gold check would always pass and the sums would say 'enchant' on
  // an item with no enchantments.
  assert.equal(totalGoldCost([]), 0);
  assert.equal(totalEnchantmentCost([], []), 0);

  // a SIDE EFFECT alone is enough to count as prepared, even though
  // it costs no gold and REDUCES the point total
  const drawbackOnly = enchantDecision(item, [], [{ enchantCost: -3000, parentEnchantment: 0 }], { gold: 0 });
  assert.equal(drawbackOnly.kind, 'enchant');
  assert.equal(drawbackOnly.goldCost, 0);
  assert.equal(drawbackOnly.cost, -3000);

  // and the three old arms still run in their old order underneath
  assert.equal(enchantDecision(item, [power(1)], [], { gold: 0 }).kind, 'noGold');
  assert.equal(enchantDecision(item, [power(9999)], [], { gold: 10 ** 9 }).kind, 'overLimit');
  assert.equal(enchantDecision(item, [power(1)], [], { gold: 10 }).kind, 'enchant');
});

test('M4: the picker guard tests == 10, and nothing else caps the lists', () => {
  const item = { group: 'Weapons', templateIndex: 117 };
  const filler = (n) => Array.from({ length: n }, () => power(1));

  assert.equal(openPickerDecision(true, { item: null }).text, ITEM_MUST_BE_SELECTED);
  assert.equal(openPickerDecision(false, { item: null }).kind, 'refuse');
  assert.equal(openPickerDecision(true, { item }).kind, 'open');

  // the two buttons share the ladder and differ only in the line
  const full = { item, powers: filler(6), sideEffects: filler(4) };
  assert.equal(openPickerDecision(true, full).text, CANNOT_ENCHANT_MORE_POWERS);
  assert.equal(openPickerDecision(false, full).text, NO_MORE_SIDE_EFFECTS);
  // the count spans BOTH lists
  assert.equal(openPickerDecision(true, { item, powers: filler(10), sideEffects: [] }).kind, 'refuse');
  assert.equal(openPickerDecision(true, { item, powers: filler(9), sideEffects: [] }).kind, 'open');

  // THE QUIRK: the test is `== 10`, so ELEVEN walks straight past it.
  // Nothing else stops the lists growing - the picker's room check
  // runs only for a bound soul - so an item can be loaded past the
  // cap and M3's SetEnchantments truncation is what silently drops
  // the surplus. `>= 10` is the mutant, and it would refuse here.
  assert.equal(openPickerDecision(true, { item, powers: filler(11), sideEffects: [] }).kind, 'open',
    'eleven is not ten, so the guard does not match');
  assert.equal(openPickerDecision(true, { item, powers: filler(6), sideEffects: filler(6) }).kind, 'open');
  // and what an over-loaded item actually keeps is the first ten
  const twelve = Array.from({ length: 12 }, (_, i) => power(i + 1));
  assert.equal(applyEnchantments({}, twelve).enchantments.length, MAX_ENCHANTMENTS);
});
