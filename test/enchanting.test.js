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
} from '../src/systems/enchanting.js';
import { WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';

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

  // so: a SIDE EFFECT costs points and no gold...
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
