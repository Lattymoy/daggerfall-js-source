// E1 economy: item templates + StockShopShelf + CalculateCost
// (DFU ItemHelper / DaggerfallLoot / FormulaHelper, verbatim).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ITEM_TEMPLATES, GROUP_TEMPLATE_INDICES, templateFor, groupTemplates, itemBaseValue,
} from '../src/systems/itemTemplates.js';
import {
  SHOP_ITEM_GROUPS, isShop, isShopShelfModel, stockShopShelf, calculateCost,
  calculateTradePrice, regionPriceAdjustment, TRANSPORT_HORSE, TRANSPORT_SMALL_CART,
} from '../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';

test('itemTemplates: the 288-row table + group enum mapping + material values', () => {
  assert.equal(ITEM_TEMPLATES.length, 288);
  // spot pins against ItemTemplates.txt
  assert.deepEqual({ name: ITEM_TEMPLATES[0].name, basePrice: ITEM_TEMPLATES[0].basePrice, rarity: ITEM_TEMPLATES[0].rarity }, { name: 'Ruby', basePrice: 250, rarity: 10 });
  assert.equal(ITEM_TEMPLATES[94].name, 'Horse');
  assert.equal(ITEM_TEMPLATES[277].name, 'Book');
  // the enum VALUES are template indices: Armor = 102..112, Weapons start at Dagger 113
  assert.deepEqual([...GROUP_TEMPLATE_INDICES.Armor], [102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112]);
  assert.equal(GROUP_TEMPLATE_INDICES.Weapons[0], 113);
  assert.equal(templateFor('Weapons', 0).name, 'Dagger');
  assert.equal(groupTemplates('Gems').length, 8);
  // ItemBuilder value laws: weapon basePrice*3*mult; chain x2; plate *3*mult; leather flat
  const daggerBase = ITEM_TEMPLATES[113].basePrice;
  assert.equal(itemBaseValue({ group: 'Weapons', templateIndex: 113, material: 0 }), daggerBase * 3);
  assert.equal(itemBaseValue({ group: 'Weapons', templateIndex: 113, material: 9 }), daggerBase * 3 * 512);
  const cuirassBase = ITEM_TEMPLATES[102].basePrice;
  assert.equal(itemBaseValue({ group: 'Armor', templateIndex: 102, material: 0x0000 }), cuirassBase);
  assert.equal(itemBaseValue({ group: 'Armor', templateIndex: 102, material: 0x0100 }), cuirassBase * 2);
  assert.equal(itemBaseValue({ group: 'Armor', templateIndex: 102, material: 0x0202 }), cuirassBase * 3 * 4);
  assert.equal(itemBaseValue({ group: 'Gems', templateIndex: 0 }), 250);
});

test('shopStock: the stock law - rarity gate, chance, gender swap, horse+cart', () => {
  assert.ok(isShop(BUILDING_TYPES.WeaponSmith));
  assert.ok(!isShop(BUILDING_TYPES.Tavern));
  // shelf models: 41005 yes, 41000 no, 41808 yes
  assert.ok(isShopShelfModel(41005));
  assert.ok(!isShopShelfModel(41000));
  assert.ok(isShopShelfModel(41808));
  // rolls always 0 -> every Dice100 passes -> a weaponsmith at quality
  // 21 stocks EVERY weapon and armor template (rarity <= 21 always)
  const all = stockShopShelf({ buildingType: BUILDING_TYPES.WeaponSmith, quality: 21 }, { level: 1 }, { rolls: () => 0 });
  const weaponCount = all.filter((it) => it.group === 'Weapons').length;
  const armorCount = all.filter((it) => it.group === 'Armor').length;
  assert.equal(weaponCount, GROUP_TEMPLATE_INDICES.Weapons.length);
  assert.equal(armorCount, GROUP_TEMPLATE_INDICES.Armor.length);
  for (const it of all) assert.ok(it.value >= 1, `every shelf item carries a value: ${JSON.stringify(it)}`);
  // rolls always ~1 -> nothing stocks (chance*5*(21-rarity)/100 < 100)
  const none = stockShopShelf({ buildingType: BUILDING_TYPES.WeaponSmith, quality: 21 }, { level: 1 }, { rolls: () => 0.999 });
  assert.equal(none.length, 0);
  // the rarity gate: quality 1 refuses templates rarer than 1
  const q1 = stockShopShelf({ buildingType: BUILDING_TYPES.WeaponSmith, quality: 1 }, { level: 1 }, { rolls: () => 0 });
  for (const it of q1) {
    const t = ITEM_TEMPLATES[it.templateIndex];
    assert.ok(t.rarity <= 1, `${t.name} rarity ${t.rarity} on a quality-1 shelf`);
  }
  // general stores ALWAYS shelve the horse + small cart - and books
  // ride the quality ladder with NO Dice100 gate (q5 -> 3 books)
  const gs = stockShopShelf({ buildingType: BUILDING_TYPES.GeneralStore, quality: 5 }, { level: 1 }, { rolls: () => 0.999 });
  assert.deepEqual(gs.map((it) => it.templateIndex), [TRANSPORT_HORSE, TRANSPORT_SMALL_CART, 277, 277, 277]);
  // the gender swap: a female player sees WomensClothing at the clothier
  const cs = stockShopShelf({ buildingType: BUILDING_TYPES.ClothingStore, quality: 21 }, { level: 1, gender: 'female' }, { rolls: () => 0 });
  assert.ok(cs.some((it) => it.group === 'WomensClothing'));
  assert.ok(!cs.some((it) => it.group === 'MensClothing'));
  // the bookseller quality ladder: q7 -> (7+3)/5 = 2 -> +1 -> j 0..3 = 4 books
  const books = stockShopShelf({ buildingType: BUILDING_TYPES.Bookseller, quality: 7 }, { level: 1 }, { rolls: () => 0.999 });
  assert.equal(books.filter((it) => it.group === 'Books').length, 4);
  // the >= 4 step-down: q20 -> (20+3)/5 = 4 -> 3 -> +1 -> 5 books (not 6)
  const books20 = stockShopShelf({ buildingType: BUILDING_TYPES.Bookseller, quality: 20 }, { level: 1 }, { rolls: () => 0.999 });
  assert.equal(books20.filter((it) => it.group === 'Books').length, 5);
  // SHOP_ITEM_GROUPS carries the verbatim pair tables
  assert.deepEqual([...SHOP_ITEM_GROUPS[BUILDING_TYPES.WeaponSmith]], [0x02, 0x1E, 0x03, 0x46]);
});

test('shopStock: CalculateCost verbatim + the regional price band', () => {
  // neutral region (1000): cost = 2*(v*(q-10)/100 + v), C# int division
  assert.equal(calculateCost(100, 10), 200);          // quality 10: exactly 2x
  assert.equal(calculateCost(100, 20), 220);          // +10%: 2*(10+100)
  assert.equal(calculateCost(100, 5), 190);           // -5%: 2*(trunc(-5)+100)
  assert.equal(calculateCost(0, 10), 2);              // value clamps to 1
  assert.equal(calculateCost(7, 5), 14);              // trunc(7*-5/100) = 0 (toward zero)
  // the regional adjustment applies FIRST: 100*750/1000 = 75 -> 2*(75*10/100+75) = 164
  assert.equal(calculateCost(100, 20, 750), 164);
  // the lazy per-region init lands in 750..1250 and sticks
  const player = {};
  const a = regionPriceAdjustment(player, 17, () => 0);
  assert.equal(a, 750);
  assert.equal(regionPriceAdjustment(player, 17, () => 0.999), 750, 'initialized once, stable');
  assert.equal(regionPriceAdjustment(player, 18, () => 0.999), 1250);
});

test('shopStock: CalculateTradePrice verbatim fixed-point (E2)', () => {
  // Hand-reproduced at quality 10 (merchant level 50), skill 50/50:
  // dm = (64+128)*(64+128)>>8 = 144; dp = 144<<6 = 9216;
  // buy = ((192*144)>>8 + (9216>>8)) * cost >> 8 = (108+36)*cost>>8
  assert.equal(calculateTradePrice(256, 10, { mercantile: 50, personality: 50 }, false), 144);
  // selling always yields less than buying costs
  const buy = calculateTradePrice(1000, 10, { mercantile: 50, personality: 50 }, false);
  const sell = calculateTradePrice(1000, 10, { mercantile: 50, personality: 50 }, true);
  assert.ok(sell < buy, `sell ${sell} < buy ${buy}`);
  // higher Mercantile lowers buys and raises sells
  assert.ok(calculateTradePrice(1000, 10, { mercantile: 100, personality: 50 })
    < calculateTradePrice(1000, 10, { mercantile: 0, personality: 50 }));
  assert.ok(calculateTradePrice(1000, 10, { mercantile: 100, personality: 50 }, true)
    > calculateTradePrice(1000, 10, { mercantile: 0, personality: 50 }, true));
  // a better shop (higher quality) charges more for the same cost
  assert.ok(calculateTradePrice(1000, 20, { mercantile: 50, personality: 50 })
    > calculateTradePrice(1000, 5, { mercantile: 50, personality: 50 }));
});
