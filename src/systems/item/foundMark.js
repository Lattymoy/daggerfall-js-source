// ═══════════════════════════════════════════════════════════════════
// A FOUND PIECE'S MARK, AND WHAT ITS OWNER MENDED PAST IT - the one home of the law a sale reads a found piece's
// condition by (SELL-AS-FOUND, AUDIT ECON O1; MEND-THIRD and AUDIT MEND-THIRD, 2026-10-19; bible/06-Systems/Economy-Arc.md).
//
// A piece the world hands over worn carries `foundCondition`, the condition it was handed over at: Roleplay & Realism:
// Items' rolls on a pile, a body and a shelf, Unleveled Loot's death drops, a bounty, a foe's worn kit and a new
// character's. `selfMended` counts the points its owner's OWN mends - a Repair Kit, Repairs Objects, the Varla Stone -
// put above that mark (creditOwnMend); a smith's paid repair adds none. Online a counter reads a marked piece at its mark and
// MEND_SALE_SHARE of what its owner's own mends hold above it (foundSalePercentage) - so a paid repair is for using a
// piece, never for selling it, whatever the counter, the region or the guild's discount (AUDIT MEND-THIRD L1-1, L1-2:
// a third of a smith's mend paid at a cheap smith and sold at a dear counter, or at the Fighters Guild's rank discount).
//
// The client's counter (tradeModes.js saleConditionPercentage), the patrons' law (net/patronLaw.js, which the account
// service bundles) and every writer of a found piece's condition read and write it here.
// ═══════════════════════════════════════════════════════════════════

import { conditionPercentage } from './itemTemplates.js';

/** MEND-THIRD (2026-10-19, the Discord's #feature-feedback "Bring back loot price based on the condition!", through Mac:
 *  "Do it"; AUDIT MEND-THIRD, Mac: "Only your own mends", "Keep a third"): the share of its owner's own mends past a
 *  piece's mark that a sale credits. */
export const MEND_SALE_SHARE = 1 / 3;

/** Whether `item` carries a found piece's mark. @param {any} item */
export const isFoundMarked = (item) => Number.isInteger(item?.foundCondition);

/** THE CONDITION A SALE READS A FOUND PIECE AT, as a percentage: worn at or below its mark, or unmarked, its own
 *  condition; mended past it, the mark and MEND_SALE_SHARE of what its owner's own mends hold above it - never more than
 *  the piece holds above the mark, and nothing of what a paid repair put there. Rounded down, twice: the share's points,
 *  then ConditionPercentage's.
 * @param {any} item @returns {number} */
export function foundSalePercentage(item) {
  const found = item?.foundCondition;
  const current = item?.currentCondition ?? 0;
  if (!Number.isInteger(found) || !(found < current)) return conditionPercentage(item);
  const own = Math.min(Number.isInteger(item.selfMended) ? item.selfMended : 0, current - found);
  return conditionPercentage({ currentCondition: found + Math.trunc(own * MEND_SALE_SHARE), maxCondition: item.maxCondition });
}

/** AN OWNER'S OWN MEND, CREDITED (a Repair Kit, a tick of Repairs Objects, the Varla Stone - each writes the condition
 *  its own way, then calls this with where the piece stood): on a found piece the part of the mend above its mark - above
 *  `from`, or the mark if the piece stood below it - counted to `selfMended`, never past what the piece can hold above
 *  its mark. A smith's paid repair never calls it.
 * @param {any} item @param {number} from the condition before the mend @returns {any} the item */
export function creditOwnMend(item, from) {
  if (!isFoundMarked(item)) return item;
  const above = (item.currentCondition ?? 0) - Math.max(from ?? 0, item.foundCondition);
  if (above > 0) {
    const room = Math.max(0, (item.maxCondition ?? 0) - item.foundCondition);
    item.selfMended = Math.min(room, (Number.isInteger(item.selfMended) ? item.selfMended : 0) + above);
  }
  return item;
}

/** The mark and the owner's mends moved with a piece's maximum (WEAPON-POOL's repool, a temper): the same share of the
 *  new maximum, rounded, as the piece's condition is.
 * @param {any} item @param {number} oldMax @param {number} newMax */
export function scaleFoundMark(item, oldMax, newMax) {
  if (!(oldMax > 0) || oldMax === newMax) return;
  const share = (/** @type {number} */ n) => Math.round((n * newMax) / oldMax);
  if (isFoundMarked(item)) item.foundCondition = share(item.foundCondition);
  if (Number.isInteger(item.selfMended)) item.selfMended = share(item.selfMended);
}

/** A piece handed over whole after all (There's a Hole in the Bottom of the Ocean's re-mint): no mark, nothing mended
 *  past one. @param {any} item */
export function dropFoundMark(item) {
  delete item.foundCondition;
  delete item.selfMended;
}

/** The stackable pieces whose condition a found mark prices: books. Roleplay & Realism: Items' roll wears and marks the
 *  other stackable it reaches too - the arrow - but an arrow is never mended (repairService.js repairRefusal, the kit's
 *  and the ring's own refusals), so its mark buys nothing, and a quiver must still take every arrow found. */
const markedStack = (/** @type {any} */ it) => it?.group === 'Books';

/** A found book stacks only with its like - the same condition, mark and own mends - so a worn found copy joined to a
 *  whole one is not sold whole (AUDIT MEND-THIRD L1-5, L3-3); every other stack as before.
 * @param {any} a @param {any} b @returns {boolean} */
export const sameFoundMark = (a, b) => !markedStack(a) || (!isFoundMarked(a) && !isFoundMarked(b))
  || (a.foundCondition === b.foundCondition && a.currentCondition === b.currentCondition && (a.selfMended ?? 0) === (b.selfMended ?? 0));

/** What a found book's split-off part keeps of its stack: its condition, maximum, mark and own mends (DFU's split mints
 *  the part whole, which handed a worn found book over whole - AUDIT MEND-THIRD L3-3). Every other stack keeps DFU's mint.
 * @param {any} stack @param {any} picked */
export function carryFoundMark(stack, picked) {
  if (!markedStack(stack) || !isFoundMarked(stack)) return;
  picked.currentCondition = stack.currentCondition;
  picked.maxCondition = stack.maxCondition;
  picked.foundCondition = stack.foundCondition;
  if (Number.isInteger(stack.selfMended)) picked.selfMended = stack.selfMended;
}

/** Mark a piece handed over worn as found at its condition (a foe's worn kit, a new character's).
 * @param {any} item @returns {any} the item */
export function markFound(item) {
  if (Number.isFinite(item?.currentCondition) && (item.maxCondition ?? 0) > 0) item.foundCondition = Math.max(0, Math.trunc(item.currentCondition));
  return item;
}
