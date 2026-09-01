// AUDIT 18, systems-items lane. Pins for the nine parity gaps found
// in loot generation, the inventory rules, the shop shelf and the
// paperdoll art addressing. Every assertion here is a DFU literal
// (ItemBuilder.cs / LootTables.cs / DaggerfallLoot.cs /
// DaggerfallUnityItem.cs / ItemCollection.cs / FormulaHelper.cs), not
// a spot check of what the port happens to do.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  generateItems, generateRandomLoot, createRandomClothing, LOOT_MATRICES, BOOK_TEMPLATE,
} from '../src/systems/loot.js';
import { getRandomBookID } from '../src/systems/books.js';   // IM1: the mint's message roll
import {
  goldStack, GOLD_TEMPLATE, addItem, transferAll, itemWeight, totalWeight,
  isStackable, ARROW_TEMPLATE, OIL_TEMPLATE,
} from '../src/systems/inventory.js';
import { goldAmount } from '../src/systems/court.js';
import { stockShopShelf, randomizeArmorVariant } from '../src/systems/shopStock.js';
import { ITEM_TEMPLATES, inventoryItemImage } from '../src/systems/itemTemplates.js';
import { playerArchiveFor } from '../src/characters/paperdollArt.js';
import { CLOTHING_DYES, DYE_COLORS } from '../src/characters/dyes.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Exhausted seq HOLDS its last value (the loot.test.js convention).
const seq = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };
// A deterministic LCG for sweeps that need many draws.
const lcg = (s) => { let x = s >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; }; };

// ---------------------------------------------------------------
// 1. LootTables.GenerateRandomLoot -> ItemBuilder.CreateGoldPieces =
//    CreateItem(ItemGroups.Currency, (int)Currency.Gold_pieces).
//    The whole path, not the mint: generate -> take (addItem, the
//    dungeon takeLoot seam) / transferAll (the container seam) ->
//    goldAmount, which is what every spend reads.
// ---------------------------------------------------------------
test('audit18 items: looted gold carries the Currency template and merges into the player stack', () => {
  // key J at level 3, gold roll 0 -> MinGold 50 * 3 = 150, everything else misses.
  const looted = generateItems('J', { level: 3, gender: 'male' }, seq(0, 0.99));
  assert.deepEqual(looted, [{ group: 'Currency', templateIndex: GOLD_TEMPLATE, name: 'Gold Pieces', stackCount: 150 }]);
  assert.equal(GOLD_TEMPLATE, 276);

  // the container seam (worldModes transferAll)
  const player = { items: [goldStack(100)] };
  assert.equal(transferAll(looted, player.items), 1);
  assert.deepEqual(player.items, [{ group: 'Currency', templateIndex: GOLD_TEMPLATE, name: 'Gold Pieces', stackCount: 250 }]);
  assert.equal(player.items.filter((i) => i.group === 'Currency').length, 1);
  assert.equal(goldAmount(player), 250);

  // the corpse/pile seam (dungeonContext takeLoot uses addItem per row)
  const player2 = { items: [goldStack(100)] };
  for (const it of generateItems('J', { level: 3, gender: 'male' }, seq(0, 0.99))) addItem(player2.items, it);
  assert.equal(player2.items.length, 1);
  assert.equal(goldAmount(player2), 250);

  // the row really carries template 276: Gold Pieces weigh 0.0025 kg each
  assert.equal(ITEM_TEMPLATES[GOLD_TEMPLATE].baseWeight, 0.0025);
  assert.equal(itemWeight(player.items[0]), 0.0025 * 250);
});

// ---------------------------------------------------------------
// 2. DaggerfallUnityItem.EffectiveUnitWeightInKg (:667-673) +
//    ItemCollection.GetWeight (:94-101).
// ---------------------------------------------------------------
test('audit18 items: hasNoEncumbrance zeroes the unit weight, stack and all', () => {
  // the flags as committed in itemTemplates.json == DFU ItemTemplates.txt
  assert.deepEqual(
    [93, 94, 131, 287].map((i) => [i, ITEM_TEMPLATES[i].name, ITEM_TEMPLATES[i].hasNoEncumbrance === true]),
    [[93, 'Small Cart', true], [94, 'Horse', true], [131, 'Arrow', true], [287, 'Map', true]],
  );
  assert.equal(itemWeight({ group: 'Transportation', templateIndex: 94 }), 0);            // was 800
  assert.equal(itemWeight({ group: 'Transportation', templateIndex: 93 }), 0);            // was 400
  assert.equal(itemWeight({ group: 'Weapons', name: 'Arrow', templateIndex: ARROW_TEMPLATE, material: 0, stackCount: 24 }), 0);   // was 6
  assert.equal(itemWeight({ group: 'Maps', templateIndex: 287 }), 0);                     // was 0.25
  // and NOT a blanket zero: the armor material laws still run
  assert.equal(itemWeight({ group: 'Armor', templateIndex: 102, material: 0x0201 }), 15.5);   // steel cuirass
  assert.equal(itemWeight({ group: 'Armor', templateIndex: 102, material: 0x0000 }), 6.25);   // leather cuirass
  // GetWeight sums stackCount * EffectiveUnitWeightInKg, so a horse
  // adds nothing to the character sheet's carried weight
  assert.equal(totalWeight([{ group: 'Transportation', templateIndex: 94 }, { group: 'Armor', templateIndex: 102, material: 0x0201 }]), 15.5);
});

// ---------------------------------------------------------------
// 3. FormulaHelper.IsItemStackable (:2096-2110): the ingredient arm is
//    the TEMPLATE's isIngredient bit (DaggerfallUnityItem.cs:250-253),
//    plus the Gold_pieces / Arrow / Oil IsOfTemplate arms.
// ---------------------------------------------------------------
test('audit18 items: IsItemStackable keys on the template isIngredient bit, and Oil stacks', () => {
  assert.equal(ITEM_TEMPLATES[1].isIngredient, true);     // Emerald  (Gems)
  assert.equal(ITEM_TEMPLATES[65].isIngredient, true);    // Mercury  (MetalIngredients)
  assert.equal(ITEM_TEMPLATES[11].isIngredient, true);    // PlantIngredients1
  assert.equal(OIL_TEMPLATE, 252);
  assert.deepEqual(
    [
      isStackable({ group: 'Gems', templateIndex: 1 }),
      isStackable({ group: 'MetalIngredients', templateIndex: 65 }),
      isStackable({ group: 'PlantIngredients1', templateIndex: 11 }),
      isStackable({ group: 'UselessItems2', templateIndex: OIL_TEMPLATE }),
      isStackable({ group: 'Weapons', templateIndex: ARROW_TEMPLATE }),
      isStackable({ group: 'Currency', templateIndex: GOLD_TEMPLATE }),
      // AUDIT 39 F105 MOVED THESE TWO UP from the negatives below: the
      // rule's own potion and Books arms are ported now, and the
      // identity terms that held them back (message, PotionRecipeKey)
      // live in stacksWith where FindExistingStack keeps them.
      isStackable({ group: 'UselessItems1', templateIndex: 83 }),            // IsPotion
      isStackable({ group: 'Books', templateIndex: BOOK_TEMPLATE }),
    ],
    [true, true, true, true, true, true, true, true],
  );
  // the negatives that stop a blanket true
  assert.deepEqual(
    [
      isStackable({ group: 'Armor', templateIndex: 102 }),
      isStackable({ group: 'Weapons', templateIndex: 120 }),
      isStackable({ group: 'UselessItems2', templateIndex: 279 }),          // Parchment
      isStackable({ group: 'Gems', templateIndex: 1, equipSlot: 0 }),
      isStackable({ group: 'Gems', templateIndex: 1, enchantments: [{ type: 1 }] }),
      isStackable({ group: 'Gems', templateIndex: 1, questItem: true }),
    ],
    [false, false, false, false, false, false],
  );
  // AddItem/FindExistingStack really merge them now
  const bag = [];
  for (const row of [
    { group: 'Gems', templateIndex: 1, name: 'Emerald' },
    { group: 'Gems', templateIndex: 1, name: 'Emerald' },
    { group: 'UselessItems2', templateIndex: OIL_TEMPLATE, name: 'Oil' },
    { group: 'UselessItems2', templateIndex: OIL_TEMPLATE, name: 'Oil' },
    { group: 'MetalIngredients', templateIndex: 65, name: 'Mercury' },
    { group: 'MetalIngredients', templateIndex: 65, name: 'Mercury' },
  ]) addItem(bag, row);
  assert.deepEqual(bag, [
    { group: 'Gems', templateIndex: 1, name: 'Emerald', stackCount: 2 },
    { group: 'UselessItems2', templateIndex: OIL_TEMPLATE, name: 'Oil', stackCount: 2 },
    { group: 'MetalIngredients', templateIndex: 65, name: 'Mercury', stackCount: 2 },
  ]);
});

// ---------------------------------------------------------------
// 4. ItemBuilder.ApplyWeaponMaterial's tail (:408-417): "Female
//    characters use archive - 1 (i.e. 233 rather than 234)". Arrows
//    skip ApplyWeaponMaterial entirely (CreateWeapon :359-365).
// ---------------------------------------------------------------
test('audit18 items: the female weapon archive-1 rule reaches the item art', () => {
  const longsword = { group: 'Weapons', templateIndex: 120 };
  assert.equal(ITEM_TEMPLATES[120].playerTextureArchive, 234);
  assert.equal(playerArchiveFor(longsword, ITEM_TEMPLATES[120], { gender: 'male', race: 'Breton' }), 234);
  assert.equal(playerArchiveFor(longsword, ITEM_TEMPLATES[120], { gender: 'female', race: 'Breton' }), 233);
  // the archive is race-blind for weapons (SetRace only offsets clothing/armor)
  assert.equal(playerArchiveFor(longsword, ITEM_TEMPLATES[120], { gender: 'female', race: 'Argonian' }), 233);
  // and it reaches the inventory list / native trade window icon
  assert.deepEqual(inventoryItemImage(longsword, { gender: 'female', race: 'Breton' }), { archive: 233, record: 12 });
  assert.deepEqual(inventoryItemImage(longsword, { gender: 'male', race: 'Breton' }), { archive: 234, record: 12 });
  // arrows are untouched - they draw the world texture either way
  const arrow = { group: 'Weapons', templateIndex: ARROW_TEMPLATE };
  assert.equal(playerArchiveFor(arrow, ITEM_TEMPLATES[ARROW_TEMPLATE], { gender: 'female' }), ITEM_TEMPLATES[ARROW_TEMPLATE].playerTextureArchive);
  assert.deepEqual(
    inventoryItemImage(arrow, { gender: 'female', race: 'Breton' }),
    inventoryItemImage(arrow, { gender: 'male', race: 'Breton' }),
  );
  // armor and clothing keep their own rules
  assert.equal(playerArchiveFor({ group: 'Armor', templateIndex: 102 }, ITEM_TEMPLATES[102], { gender: 'female', race: 'Breton' }), 247);
  assert.equal(playerArchiveFor({ group: 'MensClothing', templateIndex: 166 }, ITEM_TEMPLATES[166], { gender: 'female', race: 'Breton' }), 241);
});

// ---------------------------------------------------------------
// 5. ItemBuilder.RandomizeArmorVariant (:813-844), the branch
//    ApplyArmorSettings takes for CreateArmor's default variant -1 -
//    i.e. DaggerfallLoot.cs:228's shop shelf.
// ---------------------------------------------------------------
test('audit18 items: RandomizeArmorVariant verbatim, and the shelf takes its roll', () => {
  const L = 0x0000, C = 0x0100, P = 0x0204;       // Leather / Chain / Dwarven plate
  // r -> the Range(lo, hi) draws, verbatim per template and family
  const table = (r) => [102, 103, 104, 105, 106, 107, 108, 109].map((t) => [
    randomizeArmorVariant(t, L, () => r), randomizeArmorVariant(t, C, () => r), randomizeArmorVariant(t, P, () => r),
  ]);
  assert.deepEqual(table(0), [
    [0, 0, 1],   // Cuirass:  plate Range(1,4)
    [0, 0, 0],   // Gauntlets: no arm
    [0, 0, 2],   // Greaves:  leather Range(0,2), plate Range(2,6)
    [0, 0, 1],   // Left Pauldron: plate Range(1,4)
    [0, 0, 1],   // Right Pauldron
    [0, 0, 0],   // Helm: Range(0, variants) for EVERY material
    [0, 0, 1],   // Boots: plate Range(1,3)
    [0, 0, 0],   // Buckler: no arm
  ]);
  assert.deepEqual(table(0.9), [
    [0, 0, 3],
    [0, 0, 0],
    [1, 0, 5],
    [0, 0, 3],
    [0, 0, 3],
    [5, 5, 5],   // Helm rolls over ItemTemplate.variants = 6
    [0, 0, 2],
    [0, 0, 0],
  ]);
  assert.equal(ITEM_TEMPLATES[107].variants, 6);

  // WIRING, constant stub: dice100(72, .5) stocks every rarity-3 piece,
  // randomArmorMaterial(.5) -> roll 51 -> Leather, so only Greaves
  // (Range(0,2)) and Helm (Range(0,6)) have a leather arm to roll.
  const shelf = stockShopShelf({ buildingType: BUILDING_TYPES.Armorer, quality: 20 }, { level: 5, gender: 'male' }, { rolls: () => 0.5 });
  assert.deepEqual(
    shelf.filter((i) => i.group === 'Armor').map((i) => [i.templateIndex, i.material, i.variant]),
    [[102, 0, 0], [103, 0, 0], [104, 0, 1], [105, 0, 0], [106, 0, 0], [107, 0, 3], [108, 0, 0], [109, 0, 0], [110, 0, 0], [111, 0, 0], [112, 0, 0]],
  );

  // ORDER: the material roll comes first (CreateArmor's argument),
  // the variant roll second (ApplyArmorSettings' tail).
  // .95 -> plate, .99 -> Dwarven (0x0204), .9 -> Range(1,4) = 3.
  const one = stockShopShelf({ buildingType: BUILDING_TYPES.Armorer, quality: 20 }, { level: 5, gender: 'male' }, { rolls: seq(0, 0.95, 0.99, 0.9, 0.999) });
  assert.deepEqual(one, [{ group: 'Armor', templateIndex: 102, material: 0x0204, variant: 3, name: 'Cuirass', value: 4800, maxCondition: 12288, currentCondition: 12288 }]);   // AUDIT 23 (items-5): plate scales 4096 x 12/4
});

// ---------------------------------------------------------------
// 6. DaggerfallLoot.cs:230-239 -> CreateMensClothing/CreateWomensClothing
//    (variant = Range(0, ItemTemplate.variants)) THEN
//    item.dyeColor = ItemBuilder.RandomClothingDye().
// ---------------------------------------------------------------
test('audit18 items: shop clothing rolls the template variant, then the dye', () => {
  // one row: dice .0 hits Straps(141, variants 4); variant roll .875
  // -> 3; dye roll .35 -> CLOTHING_DYES[3] = DarkBrown. Reversing the
  // two rolls would give variant 1 and dye Yellow.
  assert.equal(ITEM_TEMPLATES[141].variants, 4);
  const one = stockShopShelf({ buildingType: BUILDING_TYPES.ClothingStore, quality: 20 }, { level: 5, gender: 'male' }, { rolls: seq(0, 0.875, 0.35, 0.99) });
  assert.deepEqual(one, [{ group: 'MensClothing', templateIndex: 141, variant: 3, dye: DYE_COLORS.DarkBrown, name: 'Straps', value: 4, maxCondition: 200, currentCondition: 200 }]);   // AUDIT 23 (items-5): conditions mint with the item

  // the whole shelf: every garment dyed, every variant inside its own
  // template's count, and the 8-variant Short Shirt reaches past 3
  const shelf = stockShopShelf({ buildingType: BUILDING_TYPES.ClothingStore, quality: 20 }, { level: 5, gender: 'male' }, { rolls: lcg(99) });
  const garments = shelf.filter((i) => i.group === 'MensClothing' || i.group === 'WomensClothing');
  assert.ok(garments.length > 20, `only ${garments.length} garments stocked`);
  assert.ok(garments.every((g) => CLOTHING_DYES.includes(g.dye)));
  // Range(0, variants) with variants 0 yields 0, and SetVariant's
  // range check leaves CurrentVariant at 0 - so a 0-variant garment
  // (Armbands, Kimono, Shoes, ...) legitimately carries variant 0.
  assert.ok(garments.every((g) => Number.isInteger(g.variant) && g.variant < Math.max(1, ITEM_TEMPLATES[g.templateIndex].variants)));
  assert.equal(ITEM_TEMPLATES[166].variants, 8);
  const wide = [];
  for (let s = 1; s <= 40; s++) {
    const row = stockShopShelf({ buildingType: BUILDING_TYPES.ClothingStore, quality: 20 }, { level: 5, gender: 'male' }, { rolls: lcg(s) })
      .find((i) => i.templateIndex === 166);
    if (row) wide.push(row.variant);
  }
  assert.ok(wide.some((v) => v >= 4), `Short Shirt never rolled past the old hard-coded 4: ${wide}`);
});

// ---------------------------------------------------------------
// 7. ItemBuilder.CreateRandomClothing (:184-208): SetRace, THEN
//    dyeColor = RandomClothingDye(), THEN
//    SetVariant(Range(0, TotalVariants)) - the OPPOSITE roll order to
//    the shop shelf above. CreateRegularMagicItem's clothing arm
//    (:576) routes through the same method.
// ---------------------------------------------------------------
test('audit18 items: looted clothing rolls the dye, then the template variant', () => {
  // pick .5 -> MensClothing[20] = 161 (variants 2); dye .35 ->
  // CLOTHING_DYES[3]; variant .875 -> floor(.875*2) = 1.
  assert.equal(ITEM_TEMPLATES[161].variants, 2);
  assert.deepEqual(createRandomClothing('male', seq(0.5, 0.35, 0.875)), {
    group: 'MensClothing', templateIndex: 161, dye: DYE_COLORS.DarkBrown, variant: 1,
  });
  assert.deepEqual(createRandomClothing('female', seq(0.5, 0.35, 0.875)), {
    group: 'WomensClothing', templateIndex: 199, dye: DYE_COLORS.DarkBrown, variant: 2,
  });
  // and it reaches the loot table (key L carries CL 75)
  const rows = [];
  const rnd = lcg(12345);
  for (let i = 0; i < 60; i++) rows.push(...generateItems('L', { level: 2, gender: 'male' }, rnd));
  const cl = rows.filter((r) => r.group === 'MensClothing');
  assert.ok(cl.length > 10, `only ${cl.length} clothing drops`);
  assert.ok(cl.every((r) => CLOTHING_DYES.includes(r.dye)));
  assert.ok(cl.every((r) => Number.isInteger(r.variant) && r.variant < Math.max(1, ITEM_TEMPLATES[r.templateIndex].variants)));
  assert.ok(new Set(cl.map((r) => r.dye)).size > 1);
  assert.ok(cl.some((r) => r.variant > 0));
});

// ---------------------------------------------------------------
// 8. ItemBuilder.CreateRandomBook (:257-269):
//    book.CurrentVariant = Range(0, book.TotalVariants), and
//    TotalVariants is ItemTemplate.variants = 2 for template 277.
//    The "Range(0, 4)" the two producers were written from is the
//    count of Books ENUM NAMES (Book0..Book3), all valued 277.
// ---------------------------------------------------------------
test('audit18 items: book variant is Range(0, TotalVariants) = Range(0, 2)', () => {
  assert.equal(BOOK_TEMPLATE, 277);
  assert.equal(ITEM_TEMPLATES[BOOK_TEMPLATE].variants, 2);
  // loot: BK hit at roll .04, then IM1's CreateRandomBook order -
  // the message draw (.75 -> GetRandomBookID) BEFORE the variant
  // draw (.99 -> floor(.99*2) = 1). The mint carried no id at all
  // before IM1: no title on the panel, nothing for the reader.
  const k = generateRandomLoot(LOOT_MATRICES.K, { level: 1, gender: 'male' },
    seq(0, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.04, 0.75, 0.99, 0.99));
  // AUDIT 39 F103 added `value` to this row: SetItem writes the
  // template basePrice on every item (DaggerfallUnityItem.cs:563) and
  // the loot mint wrote none, so the trade window's cost walk read
  // undefined and paid 0. Template 277's basePrice is 2500 - the
  // book-FILE price classic uses is still the file's own loud pend.
  assert.deepEqual(k.find((i) => i.group === 'Books'), { group: 'Books', templateIndex: 277, message: getRandomBookID(() => 0.75), variant: 1, name: 'Book', value: 2500, maxCondition: 20, currentCondition: 20 });   // AUDIT 23 (items-5)
  // shop: the same draw, five rows off a quality-20 Bookseller
  const shelf = stockShopShelf({ buildingType: BUILDING_TYPES.Bookseller, quality: 20 }, { level: 5, gender: 'male' }, { rolls: () => 0.75 });
  const books = shelf.filter((i) => i.group === 'Books');
  assert.equal(books.length, 5);
  assert.deepEqual(books.map((b) => b.variant), [1, 1, 1, 1, 1]);
  // no producer can emit an out-of-range variant any more
  const rnd = lcg(7);
  const sweep = [];
  for (let i = 0; i < 40; i++) {
    sweep.push(...generateItems('P', { level: 3, gender: 'male' }, rnd).filter((r) => r.group === 'Books'));
    sweep.push(...stockShopShelf({ buildingType: BUILDING_TYPES.Bookseller, quality: 20 }, { level: 3 }, { rolls: rnd }).filter((r) => r.group === 'Books'));
  }
  assert.ok(sweep.length > 50);
  assert.ok(sweep.every((b) => b.variant >= 0 && b.variant < 2), `out-of-range book variants: ${[...new Set(sweep.map((b) => b.variant))]}`);
});

// ---------------------------------------------------------------
// 9. DaggerfallUnityItem.ItemName is ItemTemplate.name for every plain
//    item; the port's item lists fall back to the GROUP when the row
//    carries no name.
// ---------------------------------------------------------------
test('audit18 items: every minted shop/loot row carries the template ItemName', () => {
  const rnd = lcg(2024);
  const rows = [];
  for (const key of ['K', 'L', 'N', 'Q', 'S', 'U']) {
    for (let i = 0; i < 12; i++) rows.push(...generateItems(key, { level: 4, gender: 'female' }, rnd));
  }
  for (const b of [BUILDING_TYPES.Alchemist, BUILDING_TYPES.GeneralStore, BUILDING_TYPES.PawnShop, BUILDING_TYPES.GemStore, BUILDING_TYPES.Armorer, BUILDING_TYPES.ClothingStore]) {
    rows.push(...stockShopShelf({ buildingType: b, quality: 20 }, { level: 4, gender: 'female' }, { rolls: rnd }));
  }
  assert.ok(rows.length > 200, `only ${rows.length} rows swept`);
  const unnamed = rows.filter((r) => typeof r.name !== 'string' || !r.name.length);
  assert.deepEqual(unnamed, []);
  // and the name is the TEMPLATE's, not something invented
  const wrong = rows.filter((r) => r.group !== 'Weapons' && r.name !== ITEM_TEMPLATES[r.templateIndex]?.name);
  assert.deepEqual(wrong, []);
  // spot pins straight off ItemTemplates.txt
  const gs = stockShopShelf({ buildingType: BUILDING_TYPES.GeneralStore, quality: 20 }, { level: 5, gender: 'male' }, { rolls: () => 0.4 });
  assert.equal(gs.find((i) => i.templateIndex === OIL_TEMPLATE).name, 'Oil');
  assert.equal(gs.find((i) => i.templateIndex === 94).name, 'Horse');
});

// ---------------------------------------------------------------
// 10. RETIRING A FLAG DELETES THE SENTENCE. inventory.js:12 claimed
//     "Armor material weight pends S2b (FLAGGED - leather/chain/plate
//     multipliers)" while the file implemented all three 130 lines
//     below, and bible/Home.md's Open-flags ledger carried the row.
//     loot.js's header claimed CL clothing carries a variant only.
// ---------------------------------------------------------------
test('audit18 items: the retired flags are gone from source and from Home.md', () => {
  const inv = readFileSync(join(ROOT, 'src/systems/inventory.js'), 'utf8');
  assert.ok(!inv.includes('pends S2b'), 'inventory.js still claims armor weight pends S2b');
  assert.ok(!inv.includes('FLAGGED - leather/chain/plate'), 'inventory.js still carries the retired weight flag');
  assert.ok(!/Potions\/oil don't exist as items yet/.test(inv), 'inventory.js still claims oil does not exist');

  const loot = readFileSync(join(ROOT, 'src/systems/loot.js'), 'utf8');
  assert.ok(!/CL clothing carries\s*\n?\/\/ group \+ index \+ variant only/.test(loot.replace(/\r/g, '')), 'loot.js still claims CL carries a variant only');
  assert.ok(!loot.includes('variant Range(0, 4)'), 'loot.js still asserts the false Range(0, 4) for books');

  const shop = readFileSync(join(ROOT, 'src/systems/shopStock.js'), 'utf8');
  assert.ok(!shop.includes('dye/variant paperdoll pends'), 'shopStock.js still claims the clothing dye/variant pends');

  const home = readFileSync(join(ROOT, 'bible/Home.md'), 'utf8');
  assert.equal(home.split('\n').filter((l) => /src\/systems\/inventory\.js:12/.test(l)).length, 0);
  assert.equal(home.split('\n').filter((l) => /weight pends S2b/.test(l)).length, 0);
});
