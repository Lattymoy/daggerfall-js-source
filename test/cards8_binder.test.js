// CARDS8 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 26): THE CARDS AND THE CARD BINDER AS ITEMS
// (systems/iliacItems.js) and THE CARDS PART of the Holdings rail's Collections page (ui/cardBinderPage.js). A card is
// one template named by its `card`: two of one card stack, two cards do not, and a split keeps it; its name is the
// catalog's. The binder is the Wallet's shape - one a character, bound, pack-only, holding the decks; every character is
// given it once with the starter deck's thirty cards. The pack shows the cards in the binder's sheet. The Cards part
// lists the collection (held and not), the decks with the rules' word on each, and builds a deck a press at a time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ILIAC_CARD_TEMPLATE, CARD_BINDER_TEMPLATE, mintIliacCard, mintBinder, isIliacCard, isCardBinder, binderOf, collectionOf, deckHeldRefusal,
  setBinderDeck, dropBinderDeck, giveBinder, giveBinderGift, BINDER_GIFT, BINDER_DECKS_MAX, iliacCardName, iliacCardLines,
} from '../src/systems/iliacItems.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { addItem, splitStack } from '../src/systems/inventory.js';
import { resolveItemName, survivalInfoTokens } from '../src/systems/itemInfo.js';
import { isBound, isPackOnly } from '../src/systems/itemBound.js';
import { BOUND_TEMPLATES } from '../src/net/realmTradeLaw.js';
import { ITEM_FIELDS, validBinderDeck } from '../src/systems/itemFields.js';
import { validLootItem } from '../src/systems/loot.js';
import { pageOf } from '../src/ui/packPages.js';
import { ILIAC_CARDS, STARTER_DECK, cardById } from '../src/net/iliacCards.js';
import { deckValid } from '../src/net/iliacHand.js';
import { drawCardsPart, cardsPartShown, resetCardsPart, deckCards, deckRefusal, DECK_REFUSAL_WORDS } from '../src/ui/cardBinderPage.js';
import { collectionsPageShown, collectionParts } from '../src/ui/collectionsPage.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const units = ILIAC_CARDS.filter((c) => c.kind === 'unit');
const [A, B] = [units[0].id, units[1].id];

test('CARDS8 the card: one template named by its card - two of one card stack, two cards never, a split keeps it; its name and lines the catalog\'s; weightless and free to trade', () => {
  const row = templateByIndex(ILIAC_CARD_TEMPLATE);
  assert.equal(row.stackable, true);
  assert.equal(row.hasNoEncumbrance, true);
  const pack = [];
  addItem(pack, mintIliacCard(A, 1)); addItem(pack, mintIliacCard(A, 2)); addItem(pack, mintIliacCard(B, 1));
  assert.deepEqual(pack.map((x) => [x.card, x.stackCount]), [[A, 3], [B, 1]], 'one stack a card');
  const part = splitStack(pack, pack[0], 1);
  assert.equal(part.card, A, 'the card split off is the card it was');
  addItem(pack, pack.pop());
  assert.equal(pack.length, 2, 'and it stacks back');
  assert.equal(resolveItemName(pack[0]), `Card: ${cardById(A).name}`);
  assert.equal(iliacCardName({ templateIndex: ILIAC_CARD_TEMPLATE, group: 'UselessItems2', card: 'no-such-card' }), 'Card');
  assert.ok(survivalInfoTokens(pack[0]).some((t) => t.text === cardById(A).text), 'its rules on its card');
  assert.ok(iliacCardLines(pack[0])[0].includes(String(cardById(A).power)));
  assert.equal(mintIliacCard('no-such-card'), null, 'a card the catalog does not know is never minted');
  assert.equal(isBound(pack[0]), false);
  assert.ok(!BOUND_TEMPLATES.includes(ILIAC_CARD_TEMPLATE));
  assert.equal(pageOf(pack[0]), 'books');
});

test('CARDS8 the binder: the Wallet\'s shape - bound, pack-only, refused by the realm\'s trade; its decks declared item fields; every character given it once with the starter deck\'s thirty cards, the deck laid in it', () => {
  const b = mintBinder();
  assert.ok(isCardBinder(b) && isBound(b) && isPackOnly(b));
  assert.ok(BOUND_TEMPLATES.includes(CARD_BINDER_TEMPLATE), 'the realm\'s trade refuses it as the client does');
  assert.equal(pageOf(b), 'books');
  assert.ok(ITEM_FIELDS.card && ITEM_FIELDS.decks);
  const whole = validLootItem({ ...mintBinder([{ name: 'Starter Deck', cards: STARTER_DECK }]) });
  assert.deepEqual(whole?.decks, [{ name: 'Starter Deck', cards: [...STARTER_DECK] }], 'the item check keeps a binder\'s decks whole');
  assert.equal(validLootItem({ ...mintIliacCard(A, 2) })?.card, A, 'and a card\'s card');
  assert.equal(validBinderDeck({ name: 'x', cards: STARTER_DECK }), true);
  assert.equal(validBinderDeck({ name: 'x'.repeat(41), cards: [] }), false);
  const me = { items: [] };
  assert.equal(giveBinderGift(me), 1);
  assert.equal(me.binderGift, BINDER_GIFT);
  assert.equal(giveBinderGift(me), 0, 'once');
  assert.equal(giveBinder(me), 0, 'one a character');
  const had = { items: [], binderGift: BINDER_GIFT };
  assert.equal(giveBinderGift(had), 0, 'a character once given it is never given it again - no second starter deck');
  assert.equal(had.items.length, 0);
  const binder = binderOf(me.items);
  assert.deepEqual(binder.decks, [{ name: 'Starter Deck', cards: STARTER_DECK }]);
  const have = collectionOf(me.items);
  assert.equal([...have.values()].reduce((s, n) => s + n, 0), 30, 'the starter deck\'s thirty');
  assert.equal(deckValid(STARTER_DECK), null);
  assert.equal(deckHeldRefusal(STARTER_DECK, me.items), null, 'and the binder holds every card it names');
  assert.equal(deckHeldRefusal([...STARTER_DECK.slice(1), units.at(-1).id], me.items) === null, have.has(units.at(-1).id));
  // the save keeps the mark; an old save is given it once on load; a new character at chargen
  const save = read('src/systems/save.js'), chargen = read('src/systems/chargenSession.js');
  assert.match(save, /snap\.binderGift = Number\.isSafeInteger\(entity\.binderGift\) \? entity\.binderGift : BINDER_GIFT;/);
  assert.match(save, /entity\.binderGift = Number\.isSafeInteger\(snap\.binderGift\) \? snap\.binderGift : 0;/);
  assert.match(save, /giveWalletGift\(entity\);[^\n]*\n  giveBinderGift\(entity\);/);
  assert.equal((chargen.match(/giveBinderGift\(playerEntity\);/g) ?? []).length, 2, 'both chargen roads');
});

test('CARDS8 the decks: replaced whole when they change (the save\'s snapshot is shallow), at most BINDER_DECKS_MAX, taken apart by index', () => {
  const b = mintBinder([{ name: 'One', cards: STARTER_DECK }]);
  const before = b.decks;
  assert.equal(setBinderDeck(b, 1, { name: 'Two', cards: STARTER_DECK }), true);
  assert.notEqual(b.decks, before, 'a new list');
  assert.deepEqual(before.map((d) => d.name), ['One'], 'the old one untouched');
  for (let i = 2; i < BINDER_DECKS_MAX; i++) setBinderDeck(b, i, { name: `D${i}`, cards: [] });
  assert.equal(setBinderDeck(b, BINDER_DECKS_MAX, { name: 'too many', cards: [] }), false);
  assert.equal(dropBinderDeck(b, 0), true);
  assert.equal(b.decks[0].name, 'Two');
  assert.equal(setBinderDeck({}, 0, { name: 'x', cards: [] }), false, 'only a binder');
});

test('CARDS8 the pack: while a binder is carried its cards leave the pages for its sheet - the Wallet\'s partition; a card\'s way back to the binder', () => {
  const inv = read('src/ui/enhancedInventory.js');
  assert.match(inv, /const binder = binderItem \? \{ item: binderItem, held: items\.filter\(\(it\) => isIliacCard\(it\) && !isEquipped\(it\)\) \} : null;/);
  assert.match(inv, /const held = new Set\(\[\.\.\.\(wallet\?\.held \?\? \[\]\), \.\.\.\(binder\?\.held \?\? \[\]\)\]\);/);
  assert.match(inv, /if \(side === 'local' && model\?\.binder && picked === model\.binder\.item\) \(c\.querySelector\('\.card-body'\) \?\? c\)\.append\(binderSheet\(model\.binder\)\);/);
  assert.match(inv, /if \(side === 'local' && model\?\.binder\?\.held\.includes\(picked\)\) acts\.append\(binderBack\(model\.binder\.item\)\);/);
});

// ── the Cards part ───────────────────────────────────────────────────────────────────────────────────────────────────
function fakeEl(tag) {
  const classes = new Set();
  const n = {
    tag, children: [], attrs: {}, dataset: {}, title: '', value: '', type: '', disabled: false, maxLength: 0,
    get className() { return [...classes].join(' '); }, set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    classList: { contains: (c) => classes.has(c) },
    _text: '', get textContent() { return n._text + n.children.map((c) => c.textContent ?? '').join(''); }, set textContent(v) { n._text = String(v ?? ''); },
    append(...cs) { for (const c of cs) n.children.push(c); },
    setAttribute(k, v) { n.attrs[k] = v; },
  };
  return n;
}
const el = (t, cls, text) => { const n = fakeEl(t); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const kit = (player) => ({ el, divider: (t) => el('h4', 'px-divider', t), player });
const all = (root, f) => { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (f(c)) out.push(c); walk(c); } }; walk(root); return out; };
const button = (root, label) => all(root, (c) => c.tag === 'button' && c.textContent === label)[0];

test('CARDS8 the Cards part: the collection held and not, the decks with the rules\' word, a deck built a press at a time and kept once it can be played', () => {
  globalThis.document = undefined;
  resetCardsPart();
  const me = { items: [] };
  assert.equal(cardsPartShown(me), false);
  giveBinder(me);
  assert.equal(cardsPartShown(me), true);
  assert.ok(collectionsPageShown(me) && collectionParts(me).some(([id]) => id === 'cards'));
  let root = el('div');
  const draw = () => { root = el('div'); drawCardsPart(root, draw, kit(me)); };
  draw();
  const tiles = all(root, (c) => c.dataset?.card && c.classList.contains('binder-tile'));
  assert.equal(tiles.length, deckCards().length, 'every deck card, held or not');
  assert.ok(deckCards().every((c) => c.kind !== 'location'), 'no location is a deck\'s');
  const held = collectionOf(me.items);
  assert.ok(tiles.every((t) => t.classList.contains('unheld') === !held.has(t.dataset.card)), 'the unheld dim');
  assert.ok(all(root, (c) => c.classList?.contains('ok')).some((c) => c.textContent.includes('ready')), 'the starter deck ready');
  // a new deck: built a press at a time
  button(root, 'New deck').onclick();
  assert.match(root.textContent, /Building - 0 of 30/);
  assert.equal(button(root, 'Keep deck').disabled, true, 'not yet a deck');
  const press = (id) => all(root, (c) => c.dataset?.card === id && c.classList.contains('binder-tile'))[0].onclick();
  for (const id of STARTER_DECK) press(id);
  assert.match(root.textContent, /Building - 30 of 30/);
  const one = STARTER_DECK[0];
  const before = all(root, (c) => c.classList?.contains('binder-chip')).length;
  press(one);
  assert.match(root.textContent, /all of them are in this deck|Building - 30 of 30/, 'no more of a card than the binder holds');
  assert.equal(button(root, 'Keep deck').disabled, false);
  button(root, 'Keep deck').onclick();
  assert.equal(binderOf(me.items).decks.length, 2, 'kept');
  assert.ok(before > 0);
  // a deck taken apart on a second press
  button(root, 'Delete').onclick();
  button(root, 'Delete it').onclick();
  assert.equal(binderOf(me.items).decks.length, 1);
  assert.equal(deckRefusal(STARTER_DECK.slice(1), me.items), 'size');
  assert.ok(DECK_REFUSAL_WORDS.size && DECK_REFUSAL_WORDS['not held']);
});
