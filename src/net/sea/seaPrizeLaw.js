// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SHIP-PVP (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected" - a captain's hold
// as a prize; bible/03-World/Eltheric-Ocean.md SHIP-PVP) - A WRECK'S PRIZE, the law both ends read: the service takes it
// off the wrecked captain's judged record (server-account/src/seaWreck.js) and the wrecked captain's game takes the same
// pieces out of her hold (scenes/seaWreckHost.js) by the places this answers.
//
// THE PRIZE of a ship wrecked at another captain's guns AND BOARDED by them (the relay's `n1`, `b` 1) is a share of her
// hold - the boat the wreck names by her uid (Come Sail Away's `placedBoats[].Items`): her most valuable pieces first, as
// many as come to SEA_PRIZE_SHARE of the worth of what she could give (her best piece always, if she holds any),
// SEA_PRIZE_PIECES_MAX at most. Never a piece the record may not hand on - nor is one counted toward the share: one the ledger keeps back (a copy, a claim waiting - the caller's
// `keep`), a classic save's own (itemLaw.js classicPiece - "Keep all, can't sell"), a locked one, a bound one, and none the
// realm never lets pass between players (net/realm/realmTradeLaw.js tradeableRecord - AUDIT SEA VENTURES E5/B1: a quest's
// piece, a summoned one, a boat's deed or parts - a deed handed on stood a second ship, parts left their cargo behind - a
// Materials Bag, whose list stays in its owner's save). The rest of
// her hold, her captain's bag, purse and gear stay - a wreck is no death (THE HOLD IS KEPT through a death at sea).
// Her game finds what was taken by each piece's own marks (seaPrizeTook), never by its place in her hold.
//
// Pure: the numbers, and the take over a save as the service holds it.
// ═══════════════════════════════════════════════════════════════════
import { itemWorth, classicPiece } from '../../systems/item/itemLaw.js';
import { isLocked } from '../../systems/item/itemLock.js';
import { wildTookOf } from '../../systems/wild/wildDropLaw.js';
import { tradeableRecord } from '../realm/realmTradeLaw.js';

/** The share of her hold's worth a boarded wreck gives up. */
export const SEA_PRIZE_SHARE = 1 / 3;
/** The most pieces one prize takes. */
export const SEA_PRIZE_PIECES_MAX = 8;
/** How long the service holds a prize for its killer to collect before it goes back to the wrecked captain, s. */
export const SEA_PRIZE_HOLD_S = 3 * 86_400;
/** The save's Come Sail Away record (systems/comeSailAway/comeSailAway.js getSaveData's vendor - pinned equal). */
export const SEA_HOLD_VENDOR = 'come-sail-away';
/** Where a prize's piece lay, as her game names the list it takes it from (wildDropLaw.js wildTakeTook's pack word). */
export const SEA_HOLD_F = 'hold';

/** May a piece of her hold be a prize? - a record of the law's, worth something, never classic or locked, and one the realm
 *  lets pass between players (tradeableRecord - never bound, by its mark or its row's; a hold's piece is worn by no one). */
export const prizeable = (/** @type {any} */ it) => !!it && typeof it === 'object' && !classicPiece(it) && !isLocked(it) && itemWorth(it) > 0
  && tradeableRecord({ ...it, equipSlot: undefined });

/** Her hold in a save: the Items of the placed boat whose uid is `uid` - or null. */
export function seaHoldOf(/** @type {any} */ save, /** @type {number} */ uid) {
  const boats = save?.modData?.[SEA_HOLD_VENDOR]?.placedBoats;
  if (!Array.isArray(boats) || !Number.isSafeInteger(uid) || uid < 1) return null;
  const boat = boats.find((b) => b && typeof b === 'object' && b.UID === uid);
  return boat && Array.isArray(boat.Items) ? boat.Items : null;
}

/**
 * THE PRIZE CHOSEN (pure - the save untouched): the places in her hold, in the hold's own order, of the pieces a boarded
 * wreck takes - her most valuable prizeable pieces (and not `keep`'s) while they come to SEA_PRIZE_SHARE of the worth of
 * all of those (a piece she may not give swells no share of the rest), her best always, SEA_PRIZE_PIECES_MAX at most.
 * Answers `[]` for a hold that holds none.
 * @param {any[]} hold @param {(it: any) => boolean} [keep]
 */
export function seaPrizePlaces(hold, keep = () => false) {
  if (!Array.isArray(hold)) return [];
  const ranked = hold.map((it, i) => ({ i, w: itemWorth(it), it })).filter((x) => prizeable(x.it) && !keep(x.it)).sort((a, b) => b.w - a.w || a.i - b.i);
  const whole = ranked.reduce((n, x) => n + x.w, 0);
  const out = [];
  let taken = 0;
  for (const x of ranked) {
    if (out.length >= SEA_PRIZE_PIECES_MAX) break;
    if (out.length > 0 && taken + x.w > whole * SEA_PRIZE_SHARE) continue;
    out.push(x.i);
    taken += x.w;
  }
  return out.sort((a, b) => a - b);
}

/**
 * THE PRIZE AS HER GAME FINDS IT AGAIN (the service's answer, `took`): each piece taken by its own marks - its id, its
 * craft's provenance, else its group, template, material and stack (systems/wild/wildDropLaw.js wildTookOf) - in her hold.
 * Never its place: her hold in her game need not stand as her record did (AUDIT INT9 - the fall's lesson: a place found
 * another piece, and a piece the record kept went with it).
 * @param {any[]} taken
 */
export const seaPrizeTook = (taken) => wildTookOf(taken, taken.map(() => SEA_HOLD_F));

/**
 * THE PRIZE TAKEN off a save, in place: her hold's pieces at `places` (seaPrizePlaces') out of it. Answers the pieces,
 * in the hold's order - or null when the hold is not there, or a place is no piece of it (nothing changed).
 * @param {any} save @param {number} uid @param {number[]} places
 */
export function takeSeaPrize(save, uid, places) {
  const hold = seaHoldOf(save, uid);
  if (!hold || !Array.isArray(places) || places.some((i) => !Number.isSafeInteger(i) || i < 0 || i >= hold.length)) return null;
  const set = new Set(places);
  const taken = hold.filter((_, i) => set.has(i));
  const kept = hold.filter((_, i) => !set.has(i));
  hold.length = 0;
  hold.push(...kept);
  return taken;
}
