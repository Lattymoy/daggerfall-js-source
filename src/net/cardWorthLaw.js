// @ts-check
// CARDS9 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 28; Mac: "Lets build every inch of this"): A CARD'S
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
/** A card record's whole worth: its card's, times the stack. */
export const cardRecordWorth = (/** @type {any} */ rec) => (isCardRecord(rec) ? cardWorth(rec.card) * Math.max(1, Math.trunc(rec.stackCount ?? 1) || 1) : 0);
/** Every card a save carries, at its worth - every list customs reads (carriedItemLists). */
export function cardWorthOf(/** @type {any} */ snap) {
  let n = 0;
  for (const list of carriedItemLists(snap)) for (const rec of list) n += cardRecordWorth(rec);
  return n;
}
/** The starter deck's worth - what the binder's gift hands every character. */
export const STARTER_DECK_WORTH = STARTER_DECK.reduce((s, id) => s + cardWorth(id), 0);
/** OPEN (CARDS9): the card worth customs admits a level, above the starter deck's. */
export const CUSTOMS_CARD_WORTH_PER_LEVEL = 150;
/** The card worth an offline character may bring into the realm at a level (the gold allowance's level law). */
export const customsCardAllowance = (/** @type {number} */ level) => STARTER_DECK_WORTH + CUSTOMS_CARD_WORTH_PER_LEVEL * Math.max(1, Math.trunc(level) || 1);
