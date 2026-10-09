// @ts-check
// ═══════════════════════════════════════════════════════════════════
// INT4 (2026-10-09, the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md): A VALUABLE PIECE'S ID. Realm-Arc section 4
// planned it - "Valuable items get a service-issued id ... The same id in two records freezes both for review" - and
// the port's items had none ("the port's item IS its UID", inventory.js): a copy and its original were the same record
// twice, and nothing could tell a piece given away from a piece kept and given.
//
// WHERE IT IS MINTED. Not at the hundred doors a piece comes through (acquireWatch.js names the problem: "There is no one
// door an item comes through") but where a realm character's save is composed for the service - each checkpoint stamps
// every valuable piece in the character's own lists that carries none yet (scenes/world.js realmCheckpoint). The id
// rides the record from then on: through the save, the wire (it is a declared field, and the wire carries it - it is the
// piece's, never the receiver's like `acquired`), a trade, the market and a chest.
//
// WHY THE CLIENT MINTS IT. A modified client chooses its ids, and that buys it nothing: a copy keeps its original's id and
// the ledger sees both (server-account/src/verdict.js ledgerStep); a copy given a fresh id is a NEW piece, which the
// wealth budget charges as any find (budget.js). The service never has to trust one.
//
// WHAT IS VALUABLE: a piece that does not stack and wears a tier the ladder rolls or records (Magic and up, an
// Aetheric, a Gilded), a DFU magic item or artifact, a crafted piece, or a letter of credit (its value IS gold). Never a
// stack - a split mints a record its original never was, and a merge loses one - and never a bound piece, which leaves
// its owner by no route.
// ═══════════════════════════════════════════════════════════════════

import { ITEM_UID_RE, lawTemplate } from './itemLaw.js';
import { LETTER_OF_CREDIT_TEMPLATE } from './inventory.js';
/** The tiers a piece wears that make it valuable (rarityTier.js ROLLED_TIERS, and the two minted whole). */
const VALUABLE_TIERS = Object.freeze(['magic', 'rare', 'legendary', 'aetheric', 'gilded']);

/** Whether a piece earns an id. */
export function valuablePiece(/** @type {any} */ it) {
  if (!it || typeof it !== 'object' || it.bound === true || it.questItem === true) return false;
  if (Number.isInteger(it.stackCount) && it.stackCount > 1) return false;
  if (it.templateIndex === LETTER_OF_CREDIT_TEMPLATE) return true;
  return VALUABLE_TIERS.includes(it.rarity) || it.magic === true || it.artifact === true || typeof it.provenance === 'string';
}

/** A fresh id: 16 hex from 8 random bytes - the platform's CSPRNG unless a test hands its own. */
export function mintItemId(/** @type {((b: Uint8Array<ArrayBuffer>) => Uint8Array) | undefined} */ rand = undefined) {
  const bytes = new Uint8Array(8);
  return [...(rand ? rand(bytes) : globalThis.crypto.getRandomValues(bytes))].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * STAMP THE CHARACTER'S OWN LISTS, in place: every valuable piece in the pack, the wagon, the Materials Bag, the
 * furnisher's and the repairer's lists that carries no well-formed id is given one. Answers how many were stamped. A
 * piece already carrying one keeps it - the id is the piece's from its first checkpoint to its last.
 * @param {any} entity @param {(b: Uint8Array<ArrayBuffer>) => Uint8Array} [rand]
 */
export function stampItemIds(entity, rand) {
  let n = 0;
  for (const list of [entity?.items, entity?.wagonItems, entity?.bagItems, entity?.furnishings, entity?.otherItems]) {
    if (!Array.isArray(list)) continue;
    for (const it of list) {
      if (!valuablePiece(it) || (typeof it.uid === 'string' && ITEM_UID_RE.test(it.uid)) || !Object.isExtensible(it)) continue;
      it.uid = mintItemId(rand);
      n++;
    }
  }
  return n;
}

// ── INT3: what the player is told ────────────────────────────────────

/** The hold, as its player hears it (server-account/src/verdict.js holdOf's reasons). */
export const TRADE_HELD_NOTICES = Object.freeze({
  law: 'The realm is reviewing this character: something it carries is not as the game makes it. Trading is frozen until it is gone.',
  dupe: 'The realm is reviewing this character: copies of an item were found. Trading is frozen until staff have looked.',
  budget: 'The realm is reviewing this character: its wealth rose faster than play could earn it. Trading is frozen until play catches up.',
  staff: 'The realm\'s staff have frozen this character\'s trading.',
});
export const TRADE_OPEN_NOTICE = 'This character\'s trading is open again.';
/** The law's hold, naming the piece it found (`name`, its template's). */
export const tradeHeldLawNotice = (/** @type {string} */ name) => `The realm is reviewing this character: a ${name} it carries is not as the game makes it. Trading is frozen until it is gone.`;
/** What to say when a checkpoint's answer moves the hold from `prev` to `now` (each a reason or null) - a notice, or
 *  null when nothing changed or nothing is known (`undefined`: no answer that says). `why`: the first thing the law found
 *  (`{ t }`, its template) - the notice names it, so a player held over a piece can find it. */
export function tradeHeldNotice(/** @type {string | null | undefined} */ prev, /** @type {string | null | undefined} */ now, /** @type {{ t?: number } | null} */ why = null) {
  if (now === undefined || now === prev) return null;
  if (now == null) return prev ? TRADE_OPEN_NOTICE : null;
  const name = now === 'law' && why ? lawTemplate(why.t)?.name : null;
  if (typeof name === 'string' && name) return tradeHeldLawNotice(name);
  return /** @type {any} */ (TRADE_HELD_NOTICES)[now] ?? TRADE_HELD_NOTICES.law;
}
