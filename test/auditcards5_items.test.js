// AUDIT CARDS-5 (2026-10-08, bible/01-Overview/Audit-Cards-5.md) lane C: THE CARDS AND THE BINDER AS ITEMS, again. A
// binder's decks from an old or edited save made sound (C1); no shop buys a card (C2); the hotbar tells one card from
// another (C3); chargen gives the binder whatever mark an entity carries (C4); the binder's Use opens its sheet (C5);
// and the survivors of the lane's mutants: the card test, its lines by kind, its price, the mints' bounds, a two-copy
// deck the pack cannot back, the decks replaced whole, the gift merged into the pack's stacks, the field check, the pack's
// sheet driven whole.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ILIAC_CARD_TEMPLATE, CARD_BINDER_TEMPLATE, mintIliacCard, mintBinder, isIliacCard, binderOf, binderDecks, cleanBinders, collectionOf,
  deckHeldRefusal, setBinderDeck, dropBinderDeck, giveBinder, giveBinderGift, giveBinderAtChargen, BINDER_GIFT, BINDER_DECKS_MAX, DECK_NAME_MAX,
  iliacCardLines, BINDER_CARD_LINES,
} from '../src/systems/iliacItems.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { useItem } from '../src/systems/useItem.js';
import { resolveItemName, survivalInfoTokens } from '../src/systems/itemInfo.js';
import { validBinderDeck, BINDER_DECK_NAME_MAX } from '../src/systems/itemFields.js';
import { quickslotKey } from '../src/systems/quickslots.js';
import { shopBuysItem } from '../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { ILIAC_CARDS, ILIAC_LOCATIONS, STARTER_DECK, cardById } from '../src/net/iliacCards.js';
import { packModel, mountEnhancedInventory, useResultAction } from '../src/ui/enhancedInventory.js';
import { withDom } from './invdrag.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const units = ILIAC_CARDS.filter((c) => c.kind === 'unit');
const [A, B] = [units[0].id, units[1].id];

test('AUDIT CARDS-5 C1: a binder\'s decks from an old, foreign or edited save made sound on the load - no malformed deck, no more than the cap - and every reader reads the sound ones', () => {
  const b = mintBinder([{ name: 'Good', cards: [A] }]);
  b.decks = [{ name: 'Good', cards: [A] }, null, { name: 'no cards' }, { name: 'x'.repeat(DECK_NAME_MAX + 1), cards: [] }, ...Array.from({ length: BINDER_DECKS_MAX + 2 }, (_, i) => ({ name: `D${i}`, cards: [] }))];
  assert.equal(binderDecks(b).length, BINDER_DECKS_MAX, 'the readers\' list: sound, and capped');
  assert.ok(binderDecks(b).every(validBinderDeck));
  cleanBinders([b]);
  assert.equal(b.decks.length, BINDER_DECKS_MAX);
  assert.equal(b.decks[0].name, 'Good');
  assert.equal(DECK_NAME_MAX, BINDER_DECK_NAME_MAX, 'one bound');
  assert.match(read('src/systems/save.js'), /cleanBinders\(entity\.items\);/);
  // the pack's sheet reads the sound decks (a malformed one threw there)
  withDom((dom) => {
    const host = dom.mk('div'); dom.body.append(host);
    const e = { items: [], goldPieces: 0 };
    giveBinder(e);
    binderOf(e.items).decks = [null, { name: 'no cards' }, { name: 'Real', cards: [A] }];
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {} });
    const text = (n) => [n.textContent, ...n.children.map(text)].join(' ');
    host.querySelectorAll('button').find((x) => /^\s*Books/.test(text(x))).onclick({});
    host.querySelectorAll('button').find((x) => /Card Binder/.test(text(x))).onclick({});
    const sheet = host.querySelector('.bindersheet');
    assert.ok(sheet, 'the sheet drawn');
    assert.deepEqual(sheet.querySelectorAll('.wallet-row').map((r) => r.children[0].textContent), ['Real']);
    view.unmount();
  });
});

test('AUDIT CARDS-5 C2/C3/C4/C5: no shop buys a card; the hotbar tells one card from another; chargen gives the binder whatever mark the entity carries; the binder\'s Use opens its sheet', () => {
  const card = mintIliacCard(A, 3);
  for (const t of [BUILDING_TYPES.GeneralStore, BUILDING_TYPES.PawnShop]) {
    assert.equal(shopBuysItem(t, card), false, 'a card is no shelf\'s');
    assert.equal(shopBuysItem(t, { group: 'UselessItems2', templateIndex: 0 }), true, 'the group still sells');
  }
  assert.notEqual(quickslotKey(mintIliacCard(A, 1)), quickslotKey(mintIliacCard(B, 1)), 'two cards, two kinds');
  assert.equal(quickslotKey(mintIliacCard(A, 1)), quickslotKey(mintIliacCard(A, 2)), 'one card, one kind');
  assert.equal(quickslotKey({ group: 'UselessItems1', templateIndex: 1 }).includes('|c'), false, 'every other key stands');
  const stale = { items: [], binderGift: BINDER_GIFT };
  assert.equal(giveBinderAtChargen(stale), 1, 'a stale mark never takes a new character\'s binder');
  assert.equal(stale.binderGift, BINDER_GIFT);
  assert.equal(giveBinderAtChargen(stale), 0, 'one a character');
  const binder = mintBinder();
  assert.deepEqual(useItem(binder, [binder]), { kind: 'binder', item: binder });
  assert.deepEqual(useResultAction({ kind: 'binder', item: 'b' }), { kind: 'pickWallet', item: 'b' });
  assert.match(read('src/ui/nativeInventory.js'), /if \(r\.kind === 'binder'\) \{ this\.boxes = \[\{ rows: BINDER_CARD_LINES\.map/);
});

test('AUDIT CARDS-5 C lane\'s survivors: a card is a card only with its card; its lines by kind; worth a coin; the mints bounded and their lists their own; a two-copy deck the binder cannot back; a deck list replaced and never a hole; the gift merged into the pack\'s stacks; no pack, no throw', () => {
  assert.equal(isIliacCard({ templateIndex: ILIAC_CARD_TEMPLATE, group: 'UselessItems2' }), false, 'no card named: no card');
  assert.equal(templateByIndex(ILIAC_CARD_TEMPLATE).basePrice, 1);
  assert.equal(templateByIndex(CARD_BINDER_TEMPLATE).basePrice, 1);
  // the lines, by kind
  const unit = units.find((c) => c.flavor), spell = ILIAC_CARDS.find((c) => c.kind === 'spell'), prince = ILIAC_CARDS.find((c) => c.kind === 'prince');
  assert.deepEqual(iliacCardLines(mintIliacCard(unit.id)), [`${unit.tier[0].toUpperCase()}${unit.tier.slice(1)} Unit - costs ${unit.cost}, power ${unit.power}`, unit.text, unit.flavor]);
  assert.equal(iliacCardLines(mintIliacCard(spell.id))[0], `${spell.tier[0].toUpperCase()}${spell.tier.slice(1)} Spell - costs ${spell.cost}`);
  assert.match(iliacCardLines(mintIliacCard(prince.id))[0], new RegExp(`Prince - costs ${prince.cost}, power ${prince.power}$`));
  assert.deepEqual(iliacCardLines({ templateIndex: ILIAC_CARD_TEMPLATE, group: 'UselessItems2', card: 'nothing' }), ['A card this build does not know.']);
  void ILIAC_LOCATIONS;
  const info = survivalInfoTokens(mintIliacCard(unit.id)).map((t) => t.text);
  assert.equal(info[0], `Card: ${unit.name}`);
  assert.deepEqual(survivalInfoTokens(mintBinder()).slice(2).map((t) => t.text), [...BINDER_CARD_LINES]);
  assert.equal(resolveItemName(mintBinder()), 'Card Binder');
  // the mints
  assert.equal(mintIliacCard(A, 0), null);
  assert.equal(mintIliacCard(A, 1.5), null);
  const list = [A, B];
  const mb = mintBinder([{ name: 'n'.repeat(80), cards: list }]);
  list.push(A);
  assert.equal(mb.decks[0].name.length, DECK_NAME_MAX);
  assert.deepEqual(mb.decks[0].cards, [A, B], 'its own list');
  // a two-copy deck the binder backs with one
  const one = [mintIliacCard(A, 1)];
  assert.equal(deckHeldRefusal([A], one), null);
  assert.equal(deckHeldRefusal([A, A], one), 'not held');
  // the decks: replaced whole, named within bounds, never a hole, only a binder's
  const b = mintBinder([{ name: 'One', cards: [A] }]);
  const snap = b.decks;
  const cards = [A, B];
  setBinderDeck(b, 1, { name: 'm'.repeat(80), cards });
  cards.push(A);
  assert.equal(b.decks[1].name.length, DECK_NAME_MAX);
  assert.deepEqual(b.decks[1].cards, [A, B], 'its own list');
  assert.equal(setBinderDeck(b, 3, { name: 'hole', cards: [] }), false, 'never past the end');
  dropBinderDeck(b, 0);
  assert.deepEqual(snap.map((d) => d.name), ['One'], 'an earlier snapshot untouched');
  assert.equal(dropBinderDeck({ decks: [{ name: 'x', cards: [] }] }, 0), false, 'only a binder');
  // the gift: merged into the stacks the pack holds; no pack, no throw
  const p = { items: [mintIliacCard(STARTER_DECK[0], 1)] };
  giveBinder(p);
  assert.equal(p.items.filter((it) => it.card === STARTER_DECK[0]).length, 1, 'one stack a card');
  assert.equal(collectionOf(p.items).get(STARTER_DECK[0]), STARTER_DECK.filter((x) => x === STARTER_DECK[0]).length + 1);
  const bare = {};
  assert.equal(giveBinder(bare), 1);
  assert.ok(binderOf(bare.items));
  assert.equal(giveBinderGift(null), 0);
  // the field check
  assert.equal(validBinderDeck({ name: 'x', cards: Array(41).fill(A) }), false);
  assert.equal(validBinderDeck({ name: 'x', cards: [''] }), false);
  assert.equal(validBinderDeck({ name: 'x', cards: ['y'.repeat(41)] }), false);
  assert.equal(validBinderDeck([{ name: 'x', cards: [] }]), false);
  void cardById;
});

test('AUDIT CARDS-5 C lane\'s pack survivors, driven: a binder carried takes the cards off the pages into its sheet, each a row whose card has its acts and the way back; none carried, the cards on Books', () => {
  const e = { items: [], goldPieces: 0 };
  giveBinder(e);
  const m = packModel({ entity: e, items: () => e.items });
  const paged = m.tabs.flatMap((t) => t.items);
  assert.equal(paged.filter(isIliacCard).length, 0, 'no card on a page');
  assert.equal(m.binder.held.length, e.items.filter(isIliacCard).length, 'every card in the binder');
  const none = { items: e.items.filter((it) => isIliacCard(it)), goldPieces: 0 };
  assert.equal(packModel({ entity: none, items: () => none.items }).tabs.find((t) => t.tab === 'books').items.length, none.items.length, 'no binder: every card on Books');
  withDom((dom) => {
    const host = dom.mk('div'); dom.body.append(host);
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {} });
    const text = (n) => [n.textContent, ...n.children.map(text)].join(' ');
    const press = (re) => { const b = host.querySelectorAll('button').find((x) => re.test(text(x))); assert.ok(b, `a button ${re}`); b.onclick({}); };
    press(/^\s*Books/);
    press(/Card Binder/);
    const sheet = host.querySelector('.bindersheet');
    assert.ok(sheet, 'the sheet');
    const rows = sheet.querySelectorAll('button');
    assert.equal(rows.length, m.binder.held.length, 'a row a card');
    rows[0].onclick({});
    assert.equal(host.querySelector('.bindersheet'), null, 'the card\'s own card');
    press(/^\s*Binder\s*$/);
    assert.ok(host.querySelector('.bindersheet'), 'and back to the binder');
    view.unmount();
  });
});

test('AUDIT CARDS-5 C3 (lane C\'s aside): two books are two keys on the bar, and a book slotted under the old bare key is found again by its title', async () => {
  const q = await import('../src/systems/quickslots.js');
  const { itemLongName } = await import('../src/systems/itemInfo.js');
  const book = (message) => ({ group: 'Books', templateIndex: 277, name: 'Book', message, stackCount: 1 });
  const other = book(7), doors = book(417);   // 417: a port book, titled without the game's data
  assert.notEqual(q.quickslotKey(other), q.quickslotKey(doors), 'a book is keyed by its text');
  assert.equal(q.quickslotKey({ group: 'Books', templateIndex: 277 }), 'Books|277|||||||', 'a record with no text keeps the bare key');
  const title = itemLongName(doors);
  assert.notEqual(title, itemLongName(other));
  const old = q.quickslotKey({ ...doors, message: undefined });
  q.restoreQuickslotSaveData({ hotbar: [{ type: 'item', kind: 'use', key: old, name: title }] });
  const view = q.hotbarView({ items: [other, doors] });
  assert.equal(view[0].item, doors, 'the titled book, not the first book in the pack');
  assert.equal(q.quickslotSaveData().hotbar[0].key, q.quickslotKey(doors), 'and saved under its new key');
  q.restoreQuickslotSaveData({ hotbar: [{ type: 'item', kind: 'use', key: old, name: 'A Title Not Carried' }] });
  assert.equal(q.hotbarView({ items: [other, doors] })[0].ghost, true, 'a title not carried stays a ghost');
  q.clearQuickslots();
});

test('AUDIT CARDS-5 lane C\'s survivors (second pass): the binder is the binder only in its group; a holding costs nothing said; each wears its own picture; twelve decks at most; a card-less stack still stacks; a card\'s and the binder\'s lines on the info card and the stat panel; an array is no deck; the sheet counts copies', async () => {
  const { isCardBinder, ILIAC_CARD_ROW } = await import('../src/systems/iliacItems.js');
  const { itemInfoRows, itemStatRows } = await import('../src/systems/itemInfo.js');
  const { addItem, stacksWith } = await import('../src/systems/inventory.js');
  const { inventoryItemImage } = await import('../src/systems/itemTemplates.js');
  // the binder's group
  assert.equal(isCardBinder({ templateIndex: CARD_BINDER_TEMPLATE, group: 'Books' }), false, 'another group: no binder');
  assert.equal(binderOf([{ templateIndex: CARD_BINDER_TEMPLATE, group: 'Books' }]), null);
  assert.equal(isCardBinder(mintBinder()), true);
  // a holding's line: its tier and kind, no cost
  const loc = ILIAC_LOCATIONS[0];
  assert.equal(iliacCardLines(mintIliacCard(loc.id))[0], `${loc.tier[0].toUpperCase()}${loc.tier.slice(1)} Location`);
  // the pictures: the binder the Spellbook's (209/4), the card the Parchment's (209/8)
  const bi = inventoryItemImage(mintBinder()), ci = inventoryItemImage(mintIliacCard(A));
  assert.deepEqual([bi.archive, bi.record], [209, 4]);
  assert.deepEqual([ci.archive, ci.record], [209, ILIAC_CARD_ROW.worldTextureRecord]);
  // twelve decks at most: the readers' list, and no thirteenth added
  assert.equal(BINDER_DECKS_MAX, 12);
  const full = mintBinder(Array.from({ length: 13 }, (_, i) => ({ name: `D${i}`, cards: [] })));
  assert.equal(binderDecks(full).length, 12);
  full.decks = full.decks.slice(0, 12);
  assert.equal(setBinderDeck(full, 12, { name: 'more', cards: [] }), false, 'a full binder takes no thirteenth');
  // a stack with no card still merges with its own kind
  const book = () => ({ group: 'Books', templateIndex: 277, message: 7, stackCount: 1 });
  assert.equal(stacksWith(book(), book()), true);
  const list = [];
  addItem(list, book()); addItem(list, book());
  assert.equal(list.length, 1, 'two of one book: one stack');
  assert.equal(stacksWith(mintIliacCard(A), mintIliacCard(B)), false, 'two cards stay two');
  // the info card's rows and the stat panel's lines
  for (const it of [mintIliacCard(A), mintBinder()]) {
    const want = survivalInfoTokens(it).map((t) => t.text);
    assert.deepEqual(itemInfoRows(it, () => null).map((r) => r.text), want, 'the card\'s own tokens, never a record lookup');
    assert.deepEqual(itemStatRows(it).filter((r) => r.label === '').map((r) => r.text), want.slice(2), 'its lines on the stat panel');
  }
  // an array is no deck, however it is dressed
  const arr = /** @type {any} */ ([]);
  arr.name = 'x'; arr.cards = [];
  assert.equal(validBinderDeck(arr), false);
  // the sheet's head: copies of kinds
  withDom((dom) => {
    const host = dom.mk('div'); dom.body.append(host);
    const e = { items: [], goldPieces: 0 };
    giveBinder(e);
    e.items.push(mintIliacCard(units.find((c) => !STARTER_DECK.includes(c.id)).id, 3));
    const have = collectionOf(e.items);
    const copies = [...have.values()].reduce((s, n) => s + n, 0);
    assert.notEqual(copies, have.size);
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {} });
    const text = (n) => [n.textContent, ...n.children.map(text)].join(' ');
    host.querySelectorAll('button').find((x) => /^\s*Books/.test(text(x))).onclick({});
    host.querySelectorAll('button').find((x) => /Card Binder/.test(text(x))).onclick({});
    assert.equal(host.querySelector('.bindersheet').querySelector('.wallet-head').textContent, `${copies} cards of ${have.size} kinds`);
    view.unmount();
  });
});
