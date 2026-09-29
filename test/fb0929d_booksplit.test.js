// BOOK-SPLIT (FIELD BUGS 2026-09-29d, Janome on Discord): "some of the books i would add to be sold would appear under
// the wrong title, and then i was able to remove them from the sell window to like, duplicate them? somehow?"
//
// Two faults, one on each side of the counter.
//   1. SplitStack (ItemCollection.cs:261-272) mints ItemBuilder.CreateItem(group, templateIndex) - a group and a
//      template and nothing else - so the part of a stack the how-many field put on the counter lost the three terms
//      FindExistingStack reads as identity (:708-713): a book's id (book 0, "The First Scroll of Baan Dar", at the
//      template's 2500 gold instead of its own file price), a potion's recipe, a conjured stack's expiry. DFU's own
//      split does the same; the port keeps the identity now (Port-Ledger A).
//   2. The counters took a lot back with a `push`, where DFU's every click-back and ClearSelectedItems go through
//      ItemCollection.Transfer -> AddItem (:473-480), which merges a lot into its own stack. So a book taken back sat
//      as a second row beside the stack it came from.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mountEnhancedTrade } from '../src/ui/enhancedTrade.js';
import { NativeTradeWindow } from '../src/ui/nativeTrade.js';
import { itemLine } from '../src/ui/enhancedInventory.js';
import { createBook, bookTitle, setBookPrice, clearBookPrices } from '../src/systems/books.js';
import { createPotion, CLASSIC_RECIPE_KEYS } from '../src/systems/loot.js';
import { addItem, splitStack, ARROW_TEMPLATE } from '../src/systems/inventory.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { withDom } from './invdrag.mjs';

const KIERAN = 1;   // "A Tale of Kieran"
const HAMMER = 7;   // "Oelander's Hammer"

/** Three Kierans and a Hammer, minted and stacked as the loot and the shelves mint them, the Kieran file priced. */
function pack() {
  clearBookPrices();
  setBookPrice(KIERAN, 450);
  setBookPrice(HAMMER, 610);
  const bag = [];
  for (let i = 0; i < 3; i++) addItem(bag, createBook(KIERAN));
  addItem(bag, createBook(HAMMER));
  return bag;
}
const rowsOf = (bag) => bag.map((it) => `${itemLine(it).name} x${it.stackCount ?? 1}`);

/** nativetrade.test.js's hooks, the Sell counter's shape. */
function hooks(bag) {
  return {
    mode: 'Sell', shelfItems: () => [], packItems: () => bag, accepts: () => true, enchanted: () => true,
    priceCtx: () => ({ quality: 10, skills: { mercantile: 50, personality: 50 } }), gold: () => 0,
    rows: (id) => [{ text: `#${id}`, center: true }], weight: () => ({ carriedWeightKg: 0, maxEncumbranceKg: 1e9 }),
    commit: () => {}, icons: { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() },
  };
}
const find = (root, sel, text = null) => root.querySelectorAll(sel).find((n) => text == null || n.textContent === text) ?? null;
const qtyInput = (root) => find(root, '.qtyfield')?.children.find((c) => c.tagName === 'INPUT') ?? null;
const rowName = (row) => row.querySelector('.itemname').children[0].textContent;

test('BOOK-SPLIT: the field\'s case - one Kieran of three on the enhanced counter is a Kieran, and taken back it is the third of its stack', () => {
  withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const bag = pack();
    assert.deepEqual(rowsOf(bag), ['A Tale of Kieran x3', 'Oelander\'s Hammer x1']);
    const view = mountEnhancedTrade(host, hooks(bag));
    find(host, '.packtab', 'Clothing & Misc').onclick();
    host.querySelectorAll('.itemrow')[0].onclick({ timeStamp: 1000 });
    const field = qtyInput(host);
    field.value = '1';
    field.oninput();
    find(host, '.act.primary', 'Sell').onclick();
    const counter = () => host.querySelector('.packremote').querySelectorAll('.itemrow');
    assert.deepEqual(counter().map(rowName), ['A Tale of Kieran'], 'the book on the counter wears its own title');
    assert.notEqual(bookTitle(0), 'A Tale of Kieran', 'and book 0 is another book - the title the field saw');
    assert.deepEqual(rowsOf(bag), ['A Tale of Kieran x2', 'Oelander\'s Hammer x1']);
    // taken back: the third of its own stack, one row
    counter()[0].onclick({ timeStamp: 5000 });
    counter()[0].onclick({ timeStamp: 5100 });
    assert.deepEqual(rowsOf(bag), ['A Tale of Kieran x3', 'Oelander\'s Hammer x1'], 'nothing new, nothing doubled');
    // and Clear (OnPop's ClearSelectedItems) returns a split lot the same way
    host.querySelectorAll('.itemrow')[0].onclick({ timeStamp: 9000 });
    const again = qtyInput(host);
    again.value = '2';
    again.oninput();
    find(host, '.act.primary', 'Sell').onclick();
    assert.equal(counter()[0] && rowName(counter()[0]), 'A Tale of Kieran ×2');
    find(host, '.act', 'Clear').onclick();
    assert.deepEqual(rowsOf(bag), ['A Tale of Kieran x3', 'Oelander\'s Hammer x1']);
    view.unmount();
  });
  clearBookPrices();
});

test('BOOK-SPLIT: the classic counter - a Control split is the same book, and the click back rejoins its stack', () => {
  const bag = pack();
  const w = new NativeTradeWindow(hooks(bag));
  w.click(208, 5);   // clothingAndMiscRect (INV_RECTS.tabClothing [163, 0, 91, 10])
  assert.equal(w.tab, 'clothing');
  w.input('ControlLeft');
  w.click(192, 48 + 20);   // the first local slot
  assert.ok(w.inputBox, 'Control asks how many');
  w.inputBox.value = '1';
  w.input('Enter');
  w.keyup('ControlLeft');
  assert.equal(w.remoteItems.length, 1);
  assert.equal(w.remoteItems[0].message, KIERAN, 'the split is the same book');
  assert.equal(w.remoteItems[0].value, 450, 'at its own file price, not the template\'s');
  w.click(290, 48 + 20);   // the first remote slot: back to the pack
  assert.equal(w.remoteItems.length, 0);
  assert.deepEqual(rowsOf(bag), ['A Tale of Kieran x3', 'Oelander\'s Hammer x1']);
  clearBookPrices();
});

test('BOOK-SPLIT: SplitStack keeps what makes a stack one thing - a book\'s id and price, a potion\'s recipe, price and picture, a conjured expiry', () => {
  const books = pack();
  const kieran = books[0];
  const book = splitStack(books, kieran, 1);
  assert.equal(book.message, KIERAN);
  assert.equal(book.value, 450, 'CreateBook\'s `value = bookFile.Price`, not the template\'s 2500');
  assert.equal(templateByIndex(kieran.templateIndex).basePrice, 2500);
  clearBookPrices();

  const bottle = { ...createPotion(CLASSIC_RECIPE_KEYS[0]), stackCount: 4 };
  const shelf = [bottle];
  const potion = splitStack(shelf, bottle, 1);
  assert.equal(potion.potionRecipeKey, CLASSIC_RECIPE_KEYS[0], 'a split potion is that potion, not an empty bottle');
  assert.equal(potion.value, bottle.value);
  assert.notEqual(potion.value, templateByIndex(bottle.templateIndex).basePrice, 'the recipe\'s price, not the bottle\'s');
  assert.equal(potion.worldTextureRecord, bottle.worldTextureRecord, 'and the recipe\'s picture');

  const conjured = { group: 'Weapons', templateIndex: ARROW_TEMPLATE, material: 0, stackCount: 20, timeForItemToDisappear: 5000 };
  const quiver = [conjured];
  const arrows = splitStack(quiver, conjured, 5);
  assert.equal(arrows.timeForItemToDisappear, 5000, 'a split conjured arrow still vanishes with its spell');

  // the rest is still the fresh mint (A2): no identity priced a gem, and worn condition does not ride
  const gems = { group: 'Gems', templateIndex: 0, stackCount: 5, value: 99999, currentCondition: 3, maxCondition: 40 };
  const pouch = [gems];
  const gem = splitStack(pouch, gems, 2);
  assert.equal(gem.value, templateByIndex(0).basePrice);
  assert.equal(gem.currentCondition, templateByIndex(0).hitPoints);
});

test('BOOK-SPLIT: AddItem never merges a record with itself (FindExistingStack\'s `checkItem != item`)', () => {
  const quiver = [{ group: 'Weapons', templateIndex: ARROW_TEMPLATE, material: 0, stackCount: 10 }];
  const held = quiver[0];
  assert.equal(addItem(quiver, held), held);
  assert.equal(quiver.length, 1);
  assert.equal(held.stackCount, 10, 'a record already held is refused, not doubled');
});
