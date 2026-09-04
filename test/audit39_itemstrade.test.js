// AUDIT 39 - THE ITEMS/TRADE GROUP (F102/F144 the trade window,
// F103 the mint's value, F104/F106 the shop shelf, F105 stacking,
// F156 PAINT.DAT's missing host).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NativeTradeWindow } from '../src/ui/nativeTrade.js';
import { tradeCost } from '../src/systems/tradeModes.js';
import { generateItems, createPotion, createRandomPotion, randomlyAddMap, randomlyAddPotionRecipe, setMagicItemTemplates, getMagicItemTemplates } from '../src/systems/loot.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { stockShopShelf, stockGuildMagicItems } from '../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { isStackable, stacksWith, addItem } from '../src/systems/inventory.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');

/** The middle of the first visible slot in each list (nativetrade's). */
const LOCAL_SLOT0 = [192, 48 + 20];
const MODE_ACTION = [226 + 15, 134 + 7];

/** THE HOST'S OWN SHAPE (scenes/worldModes.js:1247): packItems hands
 *  back a FRESH filtered array on every call, so the window's staging
 *  is a SELECTION over a pack it cannot splice. */
const selectionHooks = (mode, pack) => {
  const items = [...pack];
  const committed = [];
  return {
    items, committed, mode,
    shelfItems: () => [],
    packItems: () => items.filter((it) => !it.equipSlot),
    accepts: () => true,
    enchanted: () => true,
    priceCtx: () => ({ quality: 10, priceAdjustment: 1000, skills: { mercantile: 50, personality: 50 } }),
    gold: () => 0,
    rows: (id) => [{ text: `#${id}`, center: true }],
    weight: () => ({ carriedWeightKg: 0, maxEncumbranceKg: 1e9 }),
    commit: (m, staged, price) => { committed.push({ m, n: staged.length, price }); },
    icons: { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() },
  };
};

// ---------------------------------------------------------------
// F102 - the trade window staged a SELECTION and nothing left the
// list, so one item sold N times. DFU's TransferItem moves the item
// out of localItems at the click (DaggerfallTradeWindow.cs:780-797 ->
// DaggerfallInventoryWindow.cs:1456+), which is why FilterLocalItems
// (:672-703) needs no already-staged test.
// ---------------------------------------------------------------
test('AUDIT 39 F102: a staged item leaves the local list and cannot be staged twice', () => {
  const sword = { group: 'Weapons', templateIndex: 118, name: 'Longsword', value: 100, maxCondition: 10, currentCondition: 10 };
  const h = selectionHooks('Sell', [sword]);
  const w = new NativeTradeWindow(h);
  assert.equal(w.localList().length, 1, 'the pack shows on the left');

  w.click(...LOCAL_SLOT0);
  assert.equal(w.staged.length, 1, 'the click staged it');
  assert.equal(w.localList().length, 0, 'and it is GONE from the local list, as TransferItem leaves it');
  const once = w.cost().cost;
  assert.ok(once > 0);

  // the same slot again: there is nothing there to stage now
  w.click(...LOCAL_SLOT0);
  w.click(...LOCAL_SLOT0);
  assert.equal(w.staged.length, 1, 'no second reference - the sale is of ONE sword');
  assert.equal(w.cost().cost, once, 'and the strip does not multiply');
  assert.equal(w.staged.filter((it) => it === sword).length, 1);
});

test('AUDIT 39 F102: unstaging returns the item to the local list', () => {
  const book = { group: 'Books', templateIndex: 277, name: 'Book', value: 40, message: 7 };
  const h = selectionHooks('Sell', [book]);
  const w = new NativeTradeWindow(h);
  w.click(...LOCAL_SLOT0);
  assert.equal(w.localList().length, 0);
  w._pickRemote(0);                       // the staged lot clicks back out (:833-860)
  assert.equal(w.staged.length, 0);
  assert.deepEqual(w.localList(), [book], 'and the pack shows it again');
});

// ---------------------------------------------------------------
// F144 - DoModeAction opens on the SPELL (:955-995) and never reaches
// ShowTradePopup; UpdateCostAndGold's "Identify spell remains free"
// (:475-482) is the same flag one arm earlier.
// ---------------------------------------------------------------
const unidentified = () => ({ group: 'Jewellery', templateIndex: 133, name: 'Amulet', value: 500, magic: true, enchantments: [{ type: 1, param: 0 }] });

test('AUDIT 39 F144: the Identify SPELL is free and skips the gold gate entirely', () => {
  const item = unidentified();
  const h = selectionHooks('Identify', [item]);
  h.usingIdentifySpell = true;
  const w = new NativeTradeWindow(h);
  w.click(...LOCAL_SLOT0);
  assert.equal(w.staged.length, 1);

  const { cost, modeActionEnabled } = w.cost();
  assert.equal(cost, 0, 'the spell costs no gold (:479-481)');
  assert.equal(modeActionEnabled, true, 'the button still enables - the arm sets it before the price');

  w.click(...MODE_ACTION);
  assert.equal(w.box, null, 'no not-enough-gold box and no Yes/No: the spell path raises neither');
  assert.equal(h.committed.length, 1, 'it went straight to the commit');
  assert.equal(h.committed[0].n, 1);
  assert.equal(h.committed[0].price, 0);
  assert.equal(w.staged.length, 0, 'ClearSelectedItems + Refresh close the pass');
});

test('AUDIT 39 F144: the PAID service still prices, and still refuses a pauper', () => {
  const h = selectionHooks('Identify', [unidentified()]);   // gold() is 0
  const w = new NativeTradeWindow(h);
  w.click(...LOCAL_SLOT0);
  assert.ok(w.cost().cost > 0, 'the service charges CalculateItemIdentifyCost');
  w.click(...MODE_ACTION);
  assert.ok(w.box, 'and a buyer who cannot pay gets the two records');
  assert.equal(w.box.buttons, null);
  assert.equal(h.committed.length, 0);
});

test('AUDIT 39 F144: a refused commit leaves the lot staged (DoModeAction returns before ClearSelectedItems)', () => {
  const h = selectionHooks('Identify', [unidentified()]);
  h.usingIdentifySpell = true;
  h.commit = () => false;                 // the host's magicka refusal
  const w = new NativeTradeWindow(h);
  w.click(...LOCAL_SLOT0);
  w.click(...MODE_ACTION);
  assert.equal(w.staged.length, 1, 'nothing identified, nothing spent, nothing returned');
});

// ---------------------------------------------------------------
// F103 - SetItem writes `value = itemTemplate.basePrice` on EVERY
// item (DaggerfallUnityItem.cs:563); PotionRecipeKey's setter
// overwrites it with the recipe price (:387-399). The port minted
// most items without one, and tradeCost reads item.value raw.
// ---------------------------------------------------------------
test('AUDIT 39 F103: looted gear carries a value, and the cost walk is a NUMBER', () => {
  const items = generateItems('T', { level: 12, gender: 'male' }, () => 0.01);
  const gear = items.filter((it) => it.group !== 'Currency');
  assert.ok(gear.length > 0, 'matrix T mints weapons and armor');
  for (const it of gear) assert.equal(typeof it.value, 'number', `${it.name} minted without a value`);
  const { cost } = tradeCost('Sell', gear, { quality: 15, priceAdjustment: 1000 });
  assert.ok(Number.isFinite(cost) && cost > 0, `NaN here collapses to 0 gold through CalculateTradePrice's >>8 (cost=${cost})`);
});

test('AUDIT 39 F103: a potion and a recipe are priced by the RECIPE, not the bottle', () => {
  const potion = createPotion(221871);   // classicRecipeKeys[0]
  assert.ok(potion.value > 1, 'PotionRecipeKey sets value = potionRecipe.Price');
  const bag = [];
  randomlyAddPotionRecipe(100, bag, () => 0.0);
  assert.equal(bag.length, 1);
  assert.equal(bag[0].value, potion.value, 'CreateRandomRecipe sets the same key, so the same price');
  const rnd = createRandomPotion(() => 0.0);
  assert.equal(typeof rnd.value, 'number');
  const maps = [];
  randomlyAddMap(100, maps, () => 0.0);
  assert.equal(typeof maps[0].value, 'number', 'the map DaggerfallLoot news up inline (:92) is an item too');
});

test('AUDIT 39 F103: CreateWeapon prices both arms, and the guild spellbook is not free', () => {
  const arrow = createWeapon(131, 0, () => 0.5);
  const sword = createWeapon(118, 3, () => 0.5);
  assert.ok(arrow.value > 0 && sword.value > 0);
  assert.ok(sword.value > createWeapon(118, 0, () => 0.5).value,
    'SetItemPropertiesByMaterial multiplies by the material band (ItemBuilder.cs:649)');
  const prev = getMagicItemTemplates();
  try {
    setMagicItemTemplates(null);
    const shelf = stockGuildMagicItems({ quality: 4, gameMinutes: 0 });
    const book = shelf.find((it) => it.templateIndex === 132);
    assert.ok(book, 'the spellbook sits between the two guild runs');
    assert.ok(book.value > 0, 'CreateItem runs SetItem - a spellbook has a price');
  } finally { setMagicItemTemplates(prev); }
});

// ---------------------------------------------------------------
// F104 - the MagicItems mint belongs INSIDE StockShopShelf's
// per-template loop (DaggerfallLoot.cs:216-243), behind `rarity <=
// shopQuality` and the Dice100 stock roll.
// ---------------------------------------------------------------
const magicTemplate = [{ type: 0, group: 2, groupIndex: 0, enchantments: [{ type: 1, param: 0 }], uses: 100, value: 500 }];
const magicCount = (list) => list.filter((it) => it.magic).length;

test('AUDIT 39 F104: the shelf magic item is gated on rarity and the stock roll', () => {
  const prev = getMagicItemTemplates();
  try {
    setMagicItemTemplates(magicTemplate);
    const pawn = (q, roll) => stockShopShelf({ buildingType: BUILDING_TYPES.PawnShop, quality: q }, { level: 5 }, { rolls: () => roll });
    // GetItemTemplate(MagicItems, 0) is template 0 - Ruby, rarity 10.
    assert.equal(magicCount(pawn(9, 0.0)), 0, 'rarity 10 > quality 9: no roll, no item');
    assert.equal(magicCount(pawn(10, 0.0)), 1, 'quality 10 clears the rarity gate and the roll passes');
    // pawn chanceMod 0x0A -> stockChance = 10*5*(21-10)/100 = 5
    assert.equal(magicCount(pawn(20, 0.99)), 0, 'a failing Dice100 stocks nothing');
    // general store's MagicItems pair is (0x04, 0x00): chanceMod 0,
    // and Dice100.SuccessRoll(0) is never true.
    const gs = stockShopShelf({ buildingType: BUILDING_TYPES.GeneralStore, quality: 20 }, { level: 5 }, { rolls: () => 0.0 });
    assert.equal(magicCount(gs), 0, 'DFU never shelves a magic item in a general store');
  } finally { setMagicItemTemplates(prev); }
});

// ---------------------------------------------------------------
// F106 - the file header swore two shipped arms were still pending.
// ---------------------------------------------------------------
test('AUDIT 39 F106: shopStock\'s INTERIM header names only live pends', () => {
  const s = rd('src/systems/shopStock.js');
  const header = s.slice(0, s.indexOf('\nimport '));
  assert.doesNotMatch(header, /MagicItems stock is SKIPPED/, 'the MagicItems clause shipped at F130');
  assert.doesNotMatch(header, /potion recipe pends/, 'the Alchemist\'s 25% roll shipped at F129');
  // PIN MOVED at A2 (ROAD TO 1:1): the header's last two open clauses
  // SHIPPED, and F106's whole point is that a pend list naming closed
  // work is worse than no list - so the pin flips to the same shape
  // the other two carry. The book price is books.createRandomBook's
  // `value = bookFile.Price`; the restock is createStockedDate below.
  assert.doesNotMatch(header, /book items carry the template price/, 'the book-file price shipped at A2');
  assert.doesNotMatch(header, /INTERIM \(loud\)/, 'and with it the last INTERIM clause in this header');
  const s2 = rd('src/systems/shopStock.js');
  assert.match(s2, /export const createStockedDate =/, 'CreateStockedDate is the member, not a pend');
});

// ---------------------------------------------------------------
// F105 - IsItemStackable's potion and book arms (FormulaHelper.cs:
// 2103-2106) behind FindExistingStack's identity terms
// (ItemCollection.cs:699-718).
// ---------------------------------------------------------------
const book = (message) => ({ group: 'Books', templateIndex: 277, message, stackCount: 1 });
const potion = (key) => ({ group: 'UselessItems1', templateIndex: 83, potionRecipeKey: key, stackCount: 1 });

test('AUDIT 39 F105: potions and books are stackable', () => {
  assert.equal(isStackable(potion(221871)), true, 'item.IsPotion');
  assert.equal(isStackable(book(12)), true, 'ItemGroup == ItemGroups.Books');
});

test('AUDIT 39 F105: but only with their OWN kind - message and potionRecipeKey', () => {
  assert.equal(stacksWith(book(12), book(12)), true);
  assert.equal(stacksWith(book(12), book(13)), false, 'two different books never merge (:706-713)');
  assert.equal(stacksWith(potion(221871), potion(221871)), true);
  assert.equal(stacksWith(potion(221871), potion(239524)), false, 'nor two different potions');

  const bag = [potion(221871)];
  addItem(bag, potion(221871));
  addItem(bag, potion(239524));
  assert.equal(bag.length, 2, 'the like pair merged, the unlike one appended');
  assert.equal(bag[0].stackCount, 2);
});

// ---------------------------------------------------------------
// F156 - PAINT.DAT had no host: setPaintFile was called from nowhere
// in src, so every painting read TEXT.RSC 250 with five blank macros.
// ---------------------------------------------------------------
test('AUDIT 39 F156: PAINT.DAT is loaded at host boot, beside the magic registries', () => {
  const s = rd('src/scenes/shared.js');
  assert.match(s, /import \{ PaintFile \} from '\.\.\/formats\/paintFile\.js'/, 'the reader has an importer at last');
  assert.match(s, /setPaintFile\(paintFile\)/);
  assert.match(s, /new PaintFile\(await fetch\('PAINT\.DAT'\)\)/);
  // its OWN try block - AUDIT 18's lesson: one bad file must not take
  // the other registries down with it.
  const block = s.slice(s.indexOf('let paintFile = null;'), s.indexOf('return { spellsByIndex'));
  assert.match(block, /try \{/);
  assert.match(block, /\} catch \{/);
  // and the one call every host boot already makes carries it
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js']) {
    assert.match(rd(host), /loadMagicRegistries\(fetchBytes\)/, `${host} boots the registries`);
  }
});
