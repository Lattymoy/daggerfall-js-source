// @ts-check
// CARDS9 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 32; Mac: "Lets build every inch of this"): A CARD'S
// WORTH AND ITS CUSTOMS - pure, one home for the client and the account service (the Worker bundles net/ and never
// systems/, so the card's template and its worth live here, and systems/iliacItems.js re-exports them).
//
// THE WORTH. Section 26 left a card "worth a coin" until CARDS9 gave it sources; now it has them, and a card is worth
// what its tier is worth (CARD_WORTH, MEASURE): a common five gold, an aetheric boss's own twelve hundred. The worth is
// the item's `value` (what the item card and the market's fee read). NO SHOP BUYS A CARD (AUDIT CARDS-5 C2, kept): the
// worth is never gold at a counter, so a card is no road from a pack to a purse.
//
// THE CUSTOMS (section 26: "CARDS9 decides its customs before cards have any source but the starter gift"). Cards are
// minted on the device - a foe's drop, a pack opened, a regular's forfeit - as every item is; what the realm cannot see
// it can still bound at its one door. An offline character coming into the realm brings cards worth no more than
// `customsCardAllowance(level)` - the starter deck's worth and CUSTOMS_CARD_WORTH_PER_LEVEL a level (OPEN, as every
// realm number is) - and customs takes the dearest past it (systems/realmCustoms.js); the service holds a customs
// character's first save to the same bound ('customs-cards') and a character born online to the starter deck's worth
// ('realm-birth'). Every list the save carries counts (realmGoldLaw.js carriedItemLists - the stashes, the wagon, the
// bag, the pack), as customs' gold does.
//
// AUDIT CARDS-6 A1: AND A SEALED PACK, at CARD_PACK_WORTH. The law counted template 581 alone, so a pack (583) crossed
// customs and both of the service's bounds uncounted and opened online - four hundred packs bought offline for gold came
// to fifty-nine times a level-5 allowance in realm cards, sold on the realm's market for gold. A pack is worth what its five
// cards come to on the average; customs takes it as a card, the dearest first, and a character born online holds none.
// AUDIT CARDS-6 A2: AND THE OWNER'S OWN DECOR (DECOR2a `decorOwn` - a card or a pack set down in an offline house or
// ship): online, the piece taken down or the house sold hands it back to the pack (sceneCache.js takeSceneOwn), so
// customs reads it beside the lists (decorOwnOf) and takes from it as from them.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { cardById, STARTER_DECK } from './iliacCards.js';
import { carriedItemLists } from './realmGoldLaw.js';

/** The card's template (systems/iliacItems.js ILIAC_CARD_TEMPLATE, pinned equal: the Worker bundles no systems/). */
export const ILIAC_CARD_TEMPLATE = 581;
/** MEASURE (CARDS9): a card's worth in gold by its tier. */
export const CARD_WORTH = Object.freeze({ common: 5, magic: 20, rare: 75, legendary: 300, aetheric: 1200, artifact: 2500, gilded: 5000 });
/** A card's worth by its catalog id - nothing for one the catalog does not know. */
export const cardWorth = (/** @type {any} */ id) => CARD_WORTH[cardById(id)?.tier] ?? 0;
/** Whether a save's record is a card (the template and a card it names - the group is the client's to check). */
export const isCardRecord = (/** @type {any} */ rec) => rec?.templateIndex === ILIAC_CARD_TEMPLATE && typeof rec?.card === 'string';
/** AUDIT CARDS-6 A1: the sealed pack's template (systems/iliacItems.js CARD_PACK_TEMPLATE, the law's own handed on, as
 *  the card's is - the account service reads it here). */
export const CARD_PACK_TEMPLATE = 583;
/** AUDIT CARDS-6 A1: whether a save's record is a sealed pack (its template - the group is the client's to check). */
export const isPackRecord = (/** @type {any} */ rec) => rec?.templateIndex === CARD_PACK_TEMPLATE;
/** AUDIT CARDS-6 A1, MEASURE: A SEALED PACK'S WORTH - what its five cards come to on the average, rounded up to the
 *  gold: four slots of systems/cardSources.js PACK_SLOT_TIERS and a last of PACK_TOP_TIERS, each tier at CARD_WORTH,
 *  is 170.05 (pinned equal to the tables: the Worker bundles no systems/). The mean and not the pack's top (2,580 - an
 *  artifact on top): a pack is counted at what it holds, so a character's allowance brought as packs is the cards it
 *  would bring opened, and a pack at its top would be worth more than a whole level-15 allowance. */
export const CARD_PACK_WORTH = 171;
const stackOf = (/** @type {any} */ rec) => Math.max(1, Math.trunc(rec.stackCount ?? 1) || 1);
/** A record's worth to the cards' customs, times its stack: a card's its card's, a sealed pack's CARD_PACK_WORTH (AUDIT
 *  CARDS-6 A1) - anything else none. */
export const cardRecordWorth = (/** @type {any} */ rec) => (isCardRecord(rec) ? cardWorth(rec.card) * stackOf(rec) : isPackRecord(rec) ? CARD_PACK_WORTH * stackOf(rec) : 0);
/**
 * AUDIT CARDS-6 A2: THE OWNER'S OWN THINGS STANDING IN A ROOM - each cached scene's DECOR2a `decorOwn` (one item a piece,
 * by the piece's id), as `{ scene, id, rec }`: what the cards' customs reads beside every list (carriedItemLists). Gold's
 * customs never reads them - no coin and no letter of credit stands (systems/decorItems.js DECOR_OWN_KEPT_BACK) - but a
 * card and a pack do, and come back to the pack online.
 * @param {any} snap @returns {{ scene: any, id: string, rec: any }[]}
 */
export function decorOwnOf(snap) {
  const out = [];
  for (const scene of Array.isArray(snap?.sceneCache?.scenes) ? snap.sceneCache.scenes : []) {
    const own = scene?.decorOwn && typeof scene.decorOwn === 'object' ? scene.decorOwn : null;
    for (const id of own ? Object.keys(own) : []) if (own[id] && typeof own[id] === 'object') out.push({ scene, id, rec: own[id] });
  }
  return out;
}
/** Every card and sealed pack a save carries, at its worth - every list customs reads (carriedItemLists) and (AUDIT
 *  CARDS-6 A2) the owner's own decor (decorOwnOf). */
export function cardWorthOf(/** @type {any} */ snap) {
  let n = 0;
  for (const list of carriedItemLists(snap)) for (const rec of list) n += cardRecordWorth(rec);
  for (const { rec } of decorOwnOf(snap)) n += cardRecordWorth(rec);
  return n;
}
/** AUDIT CARDS-6 A1: the sealed packs a save carries, wherever customs reads (the lists and the decor), each stack
 *  counted - what a character born online holds none of (server-account/src/realm.js firstSaveRefusal, 'realm-birth'). */
export function cardPacksOf(/** @type {any} */ snap) {
  let n = 0;
  for (const list of carriedItemLists(snap)) for (const rec of list) if (isPackRecord(rec)) n += stackOf(rec);
  for (const { rec } of decorOwnOf(snap)) if (isPackRecord(rec)) n += stackOf(rec);
  return n;
}
/** The starter deck's worth - what the binder's gift hands every character. */
export const STARTER_DECK_WORTH = STARTER_DECK.reduce((s, id) => s + cardWorth(id), 0);
/** OPEN (CARDS9): the card worth customs admits a level, above the starter deck's. */
export const CUSTOMS_CARD_WORTH_PER_LEVEL = 150;
/** The card worth an offline character may bring into the realm at a level (the gold allowance's level law). */
export const customsCardAllowance = (/** @type {number} */ level) => STARTER_DECK_WORTH + CUSTOMS_CARD_WORTH_PER_LEVEL * Math.max(1, Math.trunc(level) || 1);

/** CARDS10: the cards a save holds, by id - every list it carries (carriedItemLists), each record's stack counted. */
export function cardCountsOf(/** @type {any} */ snap) {
  const n = new Map();
  for (const list of carriedItemLists(snap)) for (const rec of list) if (isCardRecord(rec)) n.set(rec.card, (n.get(rec.card) ?? 0) + Math.max(1, Math.trunc(rec.stackCount ?? 1) || 1));
  return n;
}
/** CARDS10: the first card of `deck` the save holds too few of for it (a ranked seat's deck order - the service's
 *  word that the character holds every card it plays), or null. */
export function deckShortOf(/** @type {any} */ snap, /** @type {string[]} */ deck) {
  const have = cardCountsOf(snap), want = new Map();
  for (const id of deck) want.set(id, (want.get(id) ?? 0) + 1);
  for (const [id, k] of want) if ((have.get(id) ?? 0) < k) return id;
  return null;
}
