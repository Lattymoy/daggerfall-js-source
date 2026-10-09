// @ts-check
// CARDS8 (2026-10-08, Mac: "Tab + CARDS7 + CARDS8"; bible/11-Multiplayer/Tavern-Cards.md section 26): THE CARDS AND THE
// CARD BINDER AS ITEMS. Section 6.3, DECIDED: "a card is an item. It sits in the pack, weighs nothing, stacks, and is kept
// in a Card Binder (an item like the Wallet) that holds the collection and the decks."
//
//   THE CARD (template 581): one template for every card of the catalog (net/iliacCards.js), the card it is named by the
//     record's `card` (a catalog id) - two Rats stack, a Rat and a Lich do not (inventory.js stacksWith; splitStack keeps
//     it). Weightless, sold for a coin, tradeable (CARDS9 brings them into the trade and the market). Its name is the
//     catalog's ("Card: Rat", itemInfo.js resolveItemName), never stored - a split mints a fresh record from the template.
//   THE BINDER (template 582): the Wallet's shape (systems/walletItem.js, bible/06-Systems/Wallet.md) - one a character,
//     bound, pack-only. It ORGANIZES: the cards stay in the pack's own `items` (never a second list), and the binder
//     holds the DECKS (`decks: [{ name, cards: [ids] }]`), each replaced whole when it changes (the save's snapshot is a
//     shallow copy). Its Use opens its sheet in the pack, as the Wallet's does (the Collections page builds the decks).
//   THE GIFT: every character is given a binder and the starter deck's thirty cards once (`binderGift`, as the Wallet's
//     gift), the starter deck laid in the binder as its first deck - "a starter deck comes with the first binder".
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { registerCustomTemplates, setItemFields, mintCondition, registerItemUseHandler } from './itemTemplates.js';
import { validBinderDeck, BINDER_DECK_NAME_MAX } from './itemFields.js';
import { addItem } from './inventory.js';
import { cardById, STARTER_DECK } from '../net/iliacCards.js';

/** The card's and the binder's templates - the port's own, beside the Wallet's 580 and below the professions' 600. */
export const ILIAC_CARD_TEMPLATE = 581;
export const CARD_BINDER_TEMPLATE = 582;
const GROUP = 'UselessItems2';
/** The rows. Rarity 20: no shelf and no loot table rolls either. The card wears DFU's Parchment picture (TEXTURE.209
 *  record 8), the binder its Spellbook's (record 4) - the item's own picture; the card's face is painted in code
 *  (render/iliacCardFaces.js). */
export const ILIAC_CARD_ROW = Object.freeze({
  index: ILIAC_CARD_TEMPLATE, name: 'Card', baseWeight: 0, hitPoints: 0, capacityOrTarget: 0, basePrice: 1,
  enchantmentPoints: 0, rarity: 20, variants: 0, drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false,
  isOneHanded: false, isIngredient: false, worldTextureArchive: 209, worldTextureRecord: 8,
  playerTextureArchive: 0, playerTextureRecord: 0, stackable: true, hasNoEncumbrance: true,
});
export const CARD_BINDER_ROW = Object.freeze({
  index: CARD_BINDER_TEMPLATE, name: 'Card Binder', baseWeight: 0, hitPoints: 0, capacityOrTarget: 0, basePrice: 1,
  enchantmentPoints: 0, rarity: 20, variants: 0, drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false,
  isOneHanded: false, isIngredient: false, worldTextureArchive: 209, worldTextureRecord: 4,
  playerTextureArchive: 0, playerTextureRecord: 0, stackable: false, hasNoEncumbrance: true,
  bound: true, packOnly: true,
});
registerCustomTemplates([ILIAC_CARD_ROW, CARD_BINDER_ROW]);

/** Whether a record IS a card of the catalog (its template, its group, a card it names). */
export const isIliacCard = (/** @type {any} */ item) => item?.templateIndex === ILIAC_CARD_TEMPLATE && item?.group === GROUP && typeof item?.card === 'string';
/** Whether a record is the binder. */
export const isCardBinder = (/** @type {any} */ item) => item?.templateIndex === CARD_BINDER_TEMPLATE && item?.group === GROUP;
/** The pack's binder, or null. */
export const binderOf = (/** @type {any} */ items) => (Array.isArray(items) ? items.find(isCardBinder) ?? null : null);
/** A card's name in the pack: "Card: Rat" - the catalog's, or "Card" for one this build does not know. */
export const iliacCardName = (/** @type {any} */ item) => { const c = cardById(item?.card); return c ? `Card: ${c.name}` : 'Card'; };

/** A card's lines on its item card (systems/itemInfo.js): what it is in the game - its tier and kind, its cost and power,
 *  its rules, its flavor. */
export function iliacCardLines(/** @type {any} */ item) {
  const c = cardById(item?.card);
  if (!c) return ['A card this build does not know.'];
  const kind = { unit: 'Unit', spell: 'Spell', prince: 'Prince', location: 'Location' }[c.kind] ?? c.kind;
  const tier = c.tier.charAt(0).toUpperCase() + c.tier.slice(1);
  return [`${tier} ${kind}${c.kind === 'location' ? '' : ` - costs ${c.cost}`}${c.kind === 'unit' || c.kind === 'prince' ? `, power ${c.power}` : ''}`, c.text, ...(c.flavor ? [c.flavor] : [])];
}
/** The binder's card lines: what a binder is for. */
export const BINDER_CARD_LINES = Object.freeze([
  'Holds your Iliac Hand cards and your decks.',
  'Your collection is on the Holdings page, under Collections.',
]);

/** The most decks a binder keeps, and the longest name one may have (the loot clamp's string bound, itemFields.js). */
export const BINDER_DECKS_MAX = 12;
export const DECK_NAME_MAX = BINDER_DECK_NAME_MAX;   // AUDIT CARDS-5 C1: the item fields' own bound (itemFields.js validBinderDeck), one number

/** `count` cards of catalog id `id`, one stack - or null for an id the catalog does not know. */
export function mintIliacCard(/** @type {string} */ id, count = 1) {
  if (!cardById(id) || !(Number.isInteger(count) && count >= 1)) return null;
  const it = mintCondition(setItemFields({ group: GROUP, templateIndex: ILIAC_CARD_TEMPLATE }));
  it.card = id;
  it.stackCount = count;
  return it;
}
/** A binder, holding `decks`. */
export function mintBinder(/** @type {{name: string, cards: string[]}[]} */ decks = []) {
  const it = mintCondition(setItemFields({ group: GROUP, templateIndex: CARD_BINDER_TEMPLATE }));
  it.decks = decks.map((d) => ({ name: String(d.name).slice(0, DECK_NAME_MAX), cards: d.cards.slice() }));
  return it;
}

/** The pack's collection: catalog id -> how many the pack holds (its stacks summed). */
export function collectionOf(/** @type {any} */ items) {
  const out = new Map();
  for (const it of Array.isArray(items) ? items : []) if (isIliacCard(it)) out.set(it.card, (out.get(it.card) ?? 0) + Math.max(1, it.stackCount ?? 1));
  return out;
}
/** Why a deck cannot be kept in this binder - or null: more copies of a card than the pack holds ('not held'). The
 *  rules' own law (net/iliacHand.js deckValid) is the caller's to ask first. */
export function deckHeldRefusal(/** @type {string[]} */ cards, /** @type {any} */ items) {
  const have = collectionOf(items), need = new Map();
  for (const id of cards) need.set(id, (need.get(id) ?? 0) + 1);
  for (const [id, n] of need) if ((have.get(id) ?? 0) < n) return 'not held';
  return null;
}
/** A binder's decks a reader may trust: each a sound deck (itemFields.js validBinderDeck), no more than BINDER_DECKS_MAX
 *  (AUDIT CARDS-5 C1: a save's record is copied whole, and a malformed deck threw in the pack's sheet and the page). */
export function binderDecks(/** @type {any} */ binder) {
  return Array.isArray(binder?.decks) ? binder.decks.filter(validBinderDeck).slice(0, BINDER_DECKS_MAX) : [];
}
/** Every binder of a list made sound in place - its decks replaced by the ones a reader may trust (a load's, save.js). */
export function cleanBinders(/** @type {any} */ items) {
  for (const it of Array.isArray(items) ? items : []) {
    if (!isCardBinder(it)) continue;
    const ok = binderDecks(it);
    if (!Array.isArray(it.decks) || ok.length !== it.decks.length) it.decks = ok;
  }
}
/** The binder's deck `i` replaced (or added at the end, `i` past them), the list replaced whole. False when it cannot. */
export function setBinderDeck(/** @type {any} */ binder, /** @type {number} */ i, /** @type {{name: string, cards: string[]}} */ deck) {
  if (!isCardBinder(binder)) return false;
  const decks = binderDecks(binder);
  if (!(Number.isInteger(i) && i >= 0 && i <= decks.length) || (i === decks.length && decks.length >= BINDER_DECKS_MAX)) return false;
  decks[i] = { name: String(deck.name || 'Deck').slice(0, DECK_NAME_MAX), cards: deck.cards.slice() };
  binder.decks = decks;
  return true;
}
/** The binder's deck `i` taken out, the list replaced whole. */
export function dropBinderDeck(/** @type {any} */ binder, /** @type {number} */ i) {
  const decks = binderDecks(binder);
  if (!isCardBinder(binder) || !decks[i]) return false;
  binder.decks = decks.filter((_, k) => k !== i);
  return true;
}

/** A character with no binder is given one, the starter deck's cards with it and the deck laid in it. 1 given, 0 not. */
export function giveBinder(/** @type {any} */ entity) {
  if (!entity || typeof entity !== 'object') return 0;
  if (!Array.isArray(entity.items)) entity.items = [];
  if (binderOf(entity.items)) return 0;
  addItem(entity.items, mintBinder([{ name: 'Starter Deck', cards: [...STARTER_DECK] }]));
  const n = new Map();
  for (const id of STARTER_DECK) n.set(id, (n.get(id) ?? 0) + 1);
  for (const [id, count] of n) { const c = mintIliacCard(id, count); if (c) addItem(entity.items, c); }
  return 1;
}
/** The gift's mark: a save whose `binderGift` is below this gives every character its binder once (the Wallet's way). */
export const BINDER_GIFT = 1;
/** The gift, once: a binder given unless the character has had it. Answers 1 for a binder given now. */
export function giveBinderGift(/** @type {any} */ entity) {
  if (!entity || typeof entity !== 'object') return 0;
  // AUDIT CARDS-5 C8, RECORDED: the Wallet's law - once given, never again (no door loses a bound, pack-only binder)
  if ((Number.isSafeInteger(entity.binderGift) ? entity.binderGift : 0) >= BINDER_GIFT) return 0;
  entity.binderGift = BINDER_GIFT;
  return giveBinder(entity);
}
/** CARDS8 at chargen: the binder and the starter deck given, the mark set - ungated, as the wallet's kit is (AUDIT
 *  CARDS-5 C4: an entity still carrying another character's mark took no binder). Answers giveBinder's count. */
export function giveBinderAtChargen(/** @type {any} */ entity) {
  if (!entity || typeof entity !== 'object') return 0;
  const n = giveBinder(entity);
  entity.binderGift = BINDER_GIFT;
  return n;
}

/** The pack's Use: the binder picked - its sheet in the pack's detail column (the Wallet's 'pickWallet' road), its lines
 *  in the classic window's box (AUDIT CARDS-5 C5: it had no Use, and the pad's quick act opened nothing). */
registerItemUseHandler(CARD_BINDER_TEMPLATE, (item) => ({ kind: 'binder', item }));
