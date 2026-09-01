// ROAD TO 1:1, wave A, group a2 - ITEMS + ECONOMY.
//
// Four laws the port had approximated:
//   1. DaggerfallLoot.CreateStockedDate (:68-71) and the day
//      comparison PlayerActivate makes on every loot activation
//      (:881-886, :905-915) - shelves and house containers restock
//      when the game DAY moves on, not once per interior build.
//   2. ItemBuilder.CreateBook / CreateRandomBook (:237-270) - a book's
//      value is the BOOK FILE's price, not the template's 2500.
//   3. ItemBuilder.CreateWeapon's arrow arm (:359-364) at the SHELF
//      site - currentCondition 0, and the material argument that C#
//      evaluates before the call either way.
//   4. ItemCollection.SplitStack (:261-272) - the picked stack is a
//      FRESH template mint (ItemBuilder.CreateItem), never a copy of
//      the record it came out of.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createStockedDate, needsRestock, stockShopShelf, stockHouseContainer,
} from '../src/systems/shopStock.js';
import {
  createRandomBook, createBook, setBookPrice, clearBookPrices, bookFilePrice,
  bookValue, bookPriceCount, loadBookPrices, BOOK_TEMPLATE,
} from '../src/systems/books.js';
import { BOOK_ID_TITLES } from '../src/systems/booksData.js';
import { splitStack, addItem, ARROW_TEMPLATE } from '../src/systems/inventory.js';
import { ITEM_TEMPLATES, templateByIndex } from '../src/systems/itemTemplates.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { BookFile } from '../src/formats/bookFile.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, 'src', p), 'utf8');

// ---------------------------------------------------------------
// 1. CreateStockedDate and the restock gate
// ---------------------------------------------------------------

test('A2: CreateStockedDate is (Year * 1000) + DayOfYear, verbatim (DaggerfallLoot.cs:68-71)', () => {
  // DayOfYear is 1-based: (Month * 30) + (Day + 1), so month 0 day 0
  // is day 1 of the year - NOT day 0 (DaggerfallDateTime:629-633).
  assert.equal(createStockedDate({ year: 405, month: 0, day: 0 }), 405001);
  assert.equal(createStockedDate({ year: 405, month: 0, day: 1 }), 405002);
  assert.equal(createStockedDate({ year: 405, month: 1, day: 0 }), 405031);
  // the last day of the year still fits inside the thousand, which is
  // what keeps two adjacent years from colliding
  assert.equal(createStockedDate({ year: 405, month: 11, day: 29 }), 405360);
  assert.ok(createStockedDate({ year: 406, month: 0, day: 0 }) > createStockedDate({ year: 405, month: 11, day: 29 }));
});

test('A2: the restock gate is a DAY comparison, and an owned container\'s literal 1 never trips it', () => {
  const today = createStockedDate({ year: 405, month: 5, day: 10 });
  assert.equal(needsRestock({}, today), true, 'a container never stocked (stockedDate 0) stocks');
  assert.equal(needsRestock({ stockedDate: 0 }, today), true);
  assert.equal(needsRestock({ stockedDate: today }, today), false, 'stocked today does NOT reroll');
  assert.equal(needsRestock({ stockedDate: today - 1 }, today), true, 'yesterday does');
  // PlayerActivate:907 stamps a literal 1 on an owned house's own
  // furniture. It is above 0, so the container serialises; it is below
  // every real date, but the owned arm never reaches the gate at all -
  // which is why the player's own storage is never emptied.
  assert.equal(needsRestock({ stockedDate: 1 }, today), true,
    'the literal 1 is a serialisation marker, not a stocking date - the OWNED arm short-circuits before the gate');
});

test('A2: the host takes the day comparison on all three loot arms, not a stock-once latch', () => {
  const wm = src('scenes/worldModes.js');
  // the member is spelled once in the host
  assert.match(wm, /const stockedToday = \(\) => createStockedDate\(gameDate\(\)\);/,
    'CreateStockedDate over the live date, one home');
  // the SHELF arm (:881-886)
  assert.match(wm, /if \(needsRestock\(shelf, today\)\) \{\s*\n\s*shelf\.stockedDate = today;\s*\n\s*shelf\.items = stockShopShelf\(/,
    'the shelf stamps the day and re-mints - `items.Clear()` then StockShopShelf');
  // the HOUSE CONTAINER arm (:910-915) and the owned latch (:907)
  assert.match(wm, /c\.stockedDate = 1;/, 'the owned arm stamps DFU\'s literal 1');
  assert.match(wm, /if \(needsRestock\(c, today\)\) \{\s*\n\s*c\.stockedDate = today;\s*\n\s*c\.items = stockHouseContainer\(/,
    'the stranger arm takes the same gate');
  // and nothing in the host stocks through the old null latch any more
  assert.doesNotMatch(wm, /items \?\?= stockShopShelf\(/, 'the stock-once latch is gone from the shelf arms');
  assert.doesNotMatch(wm, /items \?\?= stockHouseContainer\(/, 'and from the container arm');
});

test('A2: stockedDate rides the scene cache, as SerializableLootContainer round-trips it (:72, :151)', () => {
  const wm = src('scenes/worldModes.js');
  assert.match(wm, /key: `shelf:\$\{i\}`, items: sh\.items \?\? null,\s*\n\s*stockedDate: sh\.stockedDate \?\? 0,/,
    'a cached shelf carries the day it was stocked');
  assert.match(wm, /key: `container:\$\{i\}`, items: c\.items \?\? null,\s*\n\s*stockedDate: c\.stockedDate \?\? 0,/,
    'and so does a cached house container');
  assert.match(wm, /if \(target\) target\.stockedDate = c\.stockedDate \?\? 0;/,
    'and the restore puts it back - a record cached before A2 reads as DFU\'s 0');
});

// ---------------------------------------------------------------
// 2. The book price - CreateBook / CreateRandomBook
// ---------------------------------------------------------------

test('A2: a minted book is priced from the BOOK FILE, not the template (ItemBuilder.cs:262-268)', (t) => {
  t.after(clearBookPrices);
  clearBookPrices();
  const templatePrice = ITEM_TEMPLATES[BOOK_TEMPLATE].basePrice;
  assert.equal(templatePrice, 2500, 'the template the port used to price every book at');

  // The registry unwarmed: the loud fallback, and it is the template
  // price rather than DFU's literal 0 on a failed open (recorded
  // departure - see books.js).
  assert.equal(bookFilePrice(9), null);
  assert.equal(bookValue(9), templatePrice);

  // Warmed - a stubbed BookFile price, since ARENA2 is absent here.
  const id = [...BOOK_ID_TITLES.keys()][0];
  setBookPrice(id, 437);
  assert.equal(bookFilePrice(id), 437);
  const book = createRandomBook(() => 0);   // roll 0 always -> the FIRST mapped id
  assert.equal(book.message, id, 'GetRandomBookID drew the first id');
  assert.equal(book.value, 437, 'and the value is the file price, not 2500');
  assert.equal(book.group, 'Books');
  assert.equal(book.templateIndex, BOOK_TEMPLATE);
  assert.equal(book.name, templateByIndex(BOOK_TEMPLATE).name);
  assert.equal(book.currentCondition, templateByIndex(BOOK_TEMPLATE).hitPoints, 'SetItem mints the condition too');
});

test('A2: the shop shelf and the house container both sell the FILE price', (t) => {
  t.after(clearBookPrices);
  clearBookPrices();
  const id = [...BOOK_ID_TITLES.keys()][0];
  setBookPrice(id, 612);
  const shelf = stockShopShelf({ buildingType: BUILDING_TYPES.Bookseller, quality: 20 }, { level: 1 }, { rolls: () => 0 })
    .filter((it) => it.group === 'Books');
  assert.ok(shelf.length > 0, 'the bookseller shelved books');
  for (const b of shelf) {
    assert.equal(b.value, 612, 'every shelved book carries the book file\'s price');
    assert.equal(b.message, id, 'and its id');
  }
  // the house container's Books arm is the same member
  const held = stockHouseContainer({ buildingType: 3, record: 2 }, {}, { rolls: () => 0, contRand: () => 99 })
    .filter((it) => it.group === 'Books');
  for (const b of held) assert.equal(b.value, 612);
});

test('A2: CreateBook(id) is the NAMED book - the file price, and null for an id no book backs', (t) => {
  t.after(clearBookPrices);
  clearBookPrices();
  const id = [...BOOK_ID_TITLES.keys()][1];
  setBookPrice(id, 301);
  const named = createBook(id);
  assert.equal(named.message, id, '`message = id`, verbatim');
  assert.equal(named.value, 301);
  assert.equal(named.variant, undefined, 'CreateBook rolls NO variant - only CreateRandomBook does (:262)');
  assert.equal(createBook(999999), null, 'DFU\'s null for a book file that will not open');
});

test('A2: the book-price warm is wired to the one books boot all three hosts call', () => {
  const br = src('ui/bookReader.js');
  assert.match(br, /loadBookPrices\(deps\?\.fetchBytes\)/, 'preloadBookArt warms the prices');
  for (const host of ['scenes/world.js', 'scenes/exterior.js', 'scenes/dungeonContext.js']) {
    assert.match(src(host), /preloadBookArt\(\{ renderer, fetchBytes, palette \}\)/, `${host} calls the books boot`);
  }
  // and the four mint sites share ONE member
  assert.match(src('systems/shopStock.js'), /add\(createRandomBook\(rolls\)\)/);
  assert.match(src('systems/loot.js'), /halving\(matrix\.BK, \(\) => createRandomBook\(rolls\)\)/);
  assert.match(src('systems/biography.js'), /if \(group === 'Books'\) return createRandomBook\(rolls\);/);
  assert.match(src('systems/quest/item.js'), /: createRandomBook\(rolls\);/);
});

test('A2 (data-gated): the real BOOKS files price 300..800 off their own first four bytes', async (t) => {
  const ARENA2 = process.env.ARENA2_PATH;
  if (!ARENA2) return;   // corpus-gated, the repo idiom
  t.after(clearBookPrices);
  clearBookPrices();
  const fetchBytes = async (name) => new Uint8Array(readFileSync(join(ARENA2, 'BOOKS', name)));
  const n = await loadBookPrices(fetchBytes);
  assert.ok(n > 0, 'the warm registered prices');
  assert.equal(bookPriceCount(), n);
  for (const id of BOOK_ID_TITLES.keys()) {
    const price = bookFilePrice(id);
    if (price == null) continue;
    assert.ok(price >= 300 && price <= 800, `book ${id} priced ${price} outside DFRandom's 300..800`);
  }
  // and the value is a pure function of the file's first four bytes -
  // BookFile's own randomPrice law (BookFile.cs:181-188)
  const first = [...BOOK_ID_TITLES.keys()][0];
  const bf = new BookFile();
  const name = `BOK${String(first & 0xff).padStart(5, '0')}.TXT`;
  bf.load(await fetchBytes(name), name);
  assert.equal(bookFilePrice(first), bf.price);
});

// ---------------------------------------------------------------
// 3. Shelf arrows - CreateWeapon's arrow arm, not a copy of it
// ---------------------------------------------------------------

test('A2: a shelved arrow mints at currentCondition 0 (ItemBuilder.cs:359-364)', () => {
  // A weaponsmith at quality 21 with a rolls stream of 0 stocks every
  // weapon template, arrows included.
  const shelf = stockShopShelf({ buildingType: BUILDING_TYPES.WeaponSmith, quality: 21 }, { level: 1 }, { rolls: () => 0 });
  const arrows = shelf.filter((it) => it.templateIndex === ARROW_TEMPLATE);
  assert.equal(arrows.length, 1, 'the shelf carries arrows');
  const arrow = arrows[0];
  assert.equal(arrow.currentCondition, 0, '"not sure if this is necessary, but classic does it"');
  assert.equal(arrow.material, 0, 'nativeMaterialValue = 0 whatever material was passed');
  assert.ok(arrow.stackCount >= 1 && arrow.stackCount <= 20, 'Range(1, 20 + 1)');
  assert.equal(arrow.value, ITEM_TEMPLATES[ARROW_TEMPLATE].basePrice, 'and no material multiplier');
  // maxCondition stays the template's hitPoints - the material pass
  // that would have scaled it never runs on the arrow arm
  assert.equal(arrow.maxCondition, ITEM_TEMPLATES[ARROW_TEMPLATE].hitPoints);
  // ...which is what lets a bought stack merge with a looted one
  const bag = [{ group: 'Weapons', templateIndex: ARROW_TEMPLATE, material: 0, stackCount: 6, currentCondition: 0, maxCondition: arrow.maxCondition }];
  addItem(bag, { ...arrow });
  assert.equal(bag.length, 1, 'the two stacks merged');
});

test('A2: the shelf draws RandomMaterial for an arrow too - C# evaluates the ARGUMENT (DaggerfallLoot.cs:227)', () => {
  // `ItemBuilder.CreateWeapon(j + Weapons.Dagger, RandomMaterial(level))`
  // - the material roll happens before control ever enters CreateWeapon,
  // so the arrow arm ignoring the material does NOT mean the shelf
  // skips the draw. The port used to skip it, which put every draw
  // after the arrow one place early in the stream.
  //
  // A weaponsmith at quality 21 with an all-zero stream stocks
  // everything, so the count is exactly derivable:
  //   ARMOR (11 templates)  11 Dice100
  //                       + 11 RandomArmorMaterial (roll 0 -> Leather,
  //                         one draw, no nested RandomMaterial)
  //                       +  2 RandomizeArmorVariant - Greaves takes
  //                         the leather range and Helm always rolls;
  //                         no other piece rolls at Leather
  //   WEAPONS (19 templates) 19 Dice100
  //                       + 19 RandomMaterial - the ARROW included
  //                       +  1 the arrow's Range(1, 20 + 1) stack
  const armorDraws = 11 + 11 + 2;
  const weaponDraws = 19 + 19 + 1;
  let n = 0;
  const counting = () => { n++; return 0; };
  const shelf = stockShopShelf({ buildingType: BUILDING_TYPES.WeaponSmith, quality: 21 }, { level: 1 }, { rolls: counting });
  assert.equal(n, armorDraws + weaponDraws,
    'one material draw per WEAPON template, arrows included - drop the arrow\'s and this is 62');
  assert.equal(shelf.filter((it) => it.group === 'Weapons').length, 19);
  assert.equal(shelf.filter((it) => it.group === 'Armor').length, 11);
  // and the site is ONE CreateWeapon call, not a re-spelling of its
  // arrow branch (ONE DFU MEMBER, ONE EXPORT)
  assert.match(src('systems/shopStock.js'),
    /const material = randomMaterial\(level, rolls\);[^\n]*\n\s*add\(createWeapon\(templateIndex, material, rolls\)\);/,
    'one CreateWeapon call for every weapon, the material drawn as its argument');
});

// ---------------------------------------------------------------
// 4. SplitStack mints a fresh template item
// ---------------------------------------------------------------

test('A2: SplitStack mints a FRESH template item (ItemCollection.cs:267 -> ItemBuilder.CreateItem)', () => {
  const gem = () => ({
    group: 'Gems', templateIndex: 0, name: 'Ruby', stackCount: 5,
    value: 99999, material: 7, variant: 3, flags: 4, message: 12345,
    currentCondition: 3, maxCondition: 40,
    enchantments: [{ type: 11, param: -1 }],
    potionRecipeKey: 221871, timeForItemToDisappear: 700,
  });
  const stack = gem();
  const list = [stack];
  const picked = splitStack(list, stack, 2);

  assert.equal(stack.stackCount, 3, 'the source keeps the remainder');
  assert.equal(picked.stackCount, 2, 'and the pick carries the count');
  assert.equal(list.length, 2, 'AddItem(noStack: true) - it lands unstacked beside its source');
  assert.equal(list[1], picked);

  // SetItem (DaggerfallUnityItem.cs:550-572) writes the TEMPLATE row
  // over every one of these.
  const t = ITEM_TEMPLATES[0];
  assert.equal(picked.value, t.basePrice, 'value = itemTemplate.basePrice');
  assert.equal(picked.material, 0, 'nativeMaterialValue = 0');
  assert.equal(picked.variant, 0, 'currentVariant = 0');
  assert.equal(picked.flags, 0, 'flags = 0');
  assert.equal(picked.message, 0, 'message = 0 (a Paintings mint would roll instead)');
  assert.equal(picked.currentCondition, t.hitPoints, 'currentCondition = itemTemplate.hitPoints');
  assert.equal(picked.maxCondition, t.hitPoints, 'maxCondition too');
  assert.equal(picked.enchantmentPoints, t.enchantmentPoints);
  assert.equal(picked.name, t.name, 'shortName off the template');

  // and the per-item state the port used to carry across is GONE
  assert.equal(picked.enchantments, undefined,
    'enchantments are NOT duplicated - the item maker splits one off a stack precisely so the rest stay plain');
  assert.equal(picked.potionRecipeKey, undefined);
  assert.equal(picked.timeForItemToDisappear, undefined);
  assert.notEqual(picked, stack);
  assert.deepEqual(stack.enchantments, [{ type: 11, param: -1 }], 'the source is untouched');
});

test('A2: SplitStack\'s guards are unchanged - whole stack, bad count, foreign stack, single', () => {
  const stack = { group: 'Gems', templateIndex: 0, stackCount: 4 };
  const list = [stack];
  assert.equal(splitStack(list, stack, 4), stack, 'numberToPick == stackCount answers the stack itself');
  assert.equal(list.length, 1, 'and mints nothing');
  assert.equal(splitStack(list, stack, 5), null, 'numberToPick > stackCount');
  assert.equal(splitStack(list, stack, 0), null, 'numberToPick < 1');
  assert.equal(splitStack(list, { group: 'Gems', templateIndex: 0, stackCount: 3 }, 1), null, '!Contains(stack)');
  const one = { group: 'Gems', templateIndex: 0, stackCount: 1 };
  assert.equal(splitStack([one], one, 1), null, '!IsAStack() - stackCount > 1 (DaggerfallUnityItem.cs:701-704)');
});

test('A2: a split ARROW stack comes off at the template condition the fresh mint gives it', () => {
  const stack = { group: 'Weapons', templateIndex: ARROW_TEMPLATE, material: 0, stackCount: 30, currentCondition: 0, maxCondition: 1 };
  const list = [stack];
  const picked = splitStack(list, stack, 10);
  assert.equal(picked.stackCount, 10);
  assert.equal(picked.material, 0);
  assert.equal(picked.currentCondition, ITEM_TEMPLATES[ARROW_TEMPLATE].hitPoints,
    'SetItem, not the arrow arm - CreateItem never runs CreateWeapon');
});
