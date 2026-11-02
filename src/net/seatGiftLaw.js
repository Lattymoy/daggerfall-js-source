// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DOMAIN1 (2026-10-24, the owner: "Allowing guild mates to contribute to
// town material storage with gathered items/their store") - A GIFT TO THE
// TOWN: a member's fortification materials put into the guild's stockpile
// where it holds the seat, or its Siege Camp where it pledged it this
// week (bible/11-Multiplayer/Domains.md section 5).
//
// A GIFT IS A DELIVERY WITH NO PAY (Domains law 2): what a seat writ may
// ask (fortLaw.js FORT_MATERIALS, a Ram Kit a camp's alone), from the
// Stores' spendable units (own and bought, never gold's or loose), its
// influence the writ's (seatInfluence.js creditSeatWrit) - and nothing
// paid, so every rank may give, the Guildmaster and the Officers too
// (a writ's delivery stays barred to them, AUDIT 31 S6).
//
// Pure, and no words: the account service (server-account/src/seatGifts.js),
// the seats' book (net/townSeatBook.js) and the Seat tab (ui/seatWorks.js,
// which says it in the player's language) read it.
// ═══════════════════════════════════════════════════════════════════
import { FORT_MATERIALS, RAM_KIT_KEY } from './fortLaw.js';
import { STORES_MAX } from './professionLaw.js';

/** The most units one gift moves - a whole Stores' material (professionLaw.js STORES_MAX). */
export const GIFT_UNITS_MAX = STORES_MAX;
/** The gifts the board names under the stockpile, newest first. */
export const GIFTS_SHOWN = 5;
/** The places a gift goes: the holder's stockpile, a pledged guild's Siege Camp this seat week. */
export const GIFT_PLACES = Object.freeze(['stockpile', 'camp']);

/** A whole count of units a gift may move. */
export const giftUnitsOk = (n) => Number.isSafeInteger(n) && n >= 1 && n <= GIFT_UNITS_MAX;
/** Whether `key` may be given to `place`: a fortification's material to either, a Ram Kit to a Siege Camp alone (a
 *  seat writ's own rule - writs.js postGuildWrit). */
export const giftMaterialOk = (key, place) => FORT_MATERIALS.includes(key) || (place === 'camp' && key === RAM_KIT_KEY);
/** The materials a gift to `place` may carry, in the order the board lists them. */
export const giftMaterials = (place) => (place === 'camp' ? [...FORT_MATERIALS, RAM_KIT_KEY] : [...FORT_MATERIALS]);
/**
 * What the board offers to give - each material of `place` the giver holds any of, `{ key, stores, bag, most }`: its
 * spendable Stores (own and bought), the bag's counted units, and the most one gift may move (their sum, under
 * GIFT_UNITS_MAX). Pure over the two reads (`stores(key)`, `bag(key)`), in giftMaterials' order.
 * @param {string} place @param {(key: string) => number} stores @param {(key: string) => number} bag
 */
export function giftChoices(place, stores, bag) {
  const out = [];
  for (const key of giftMaterials(place)) {
    const s = Math.max(0, Math.floor(Number(stores(key)) || 0)),
      b = Math.max(0, Math.floor(Number(bag(key)) || 0));
    if (s + b > 0) out.push({ key, stores: s, bag: b, most: Math.min(GIFT_UNITS_MAX, s + b) });
  }
  return out;
}
