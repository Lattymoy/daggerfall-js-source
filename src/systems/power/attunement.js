// @ts-check
// PWR2 (2026-10-23, bible/05-Combat/Power-Arc.md section 5; Mac, asked: "3, swap out of combat", "2 sets, 2 combat
// keystones", "Nothing taken, extras sleep"): ATTUNEMENT - the law of which powers are awake.
//
// THE CAUSE. Every power a worn piece carried was live at once: BAL7's kit wore twelve - Ansei's Edge, four Legendary
// armour powers, three Rares imprinted, four Legendary jewels - and taking any one away left it at fifty kills and a
// hurt under one percent (Power-Arc.md section 2). PWR1's budget sums what is a number; a power that is an EVENT - a
// blow turned whole, a death cheated, a heal on a timer - is no number to sum. The answer is how many may be awake.
//
// THE LAW.
//   - A PIECE THAT CARRIES A POWER - a Legendary's record, a Rare's imprint, a Gilded record, or (with the ladder on) one
//     of Daggerfall's own artifacts - wakes only ATTUNED, and a character holds at most ATTUNE_MOST attuned at once (Mac:
//     "3"). Its lines - the numbers a piece rolled (PWR1's channels) - are the piece's and never sleep; its POWER is what
//     attunement wakes. A piece with no power needs none.
//   - Attunement is a stamp on the piece (`attuned`, the order it was given in - systems/item/itemFields.js), the
//     RECEIVER's mark (net/realm/realmTradeLaw.js RECEIVER_MARKS): a piece given away comes to its new owner unattuned.
//     Of the pieces a character holds, the ATTUNE_MOST with the latest stamps are awake; an older stamp is stale (a piece
//     put down in a chest while three others were attuned, taken up again) and sleeps (attuneActions.js clears it).
//   - Choosing is done out of combat (Mac: "swap out of combat") - systems/power/attuneActions.js, the doors.
//   - TWO SETS awake (Mac: "2 sets"): systems/sigil/sigilSets.js wornSets wakes the two with the most pieces worn, then
//     the higher stage, then the registry's order; the third sleeps and its card says why.
//   - TWO COMBAT KEYSTONES awake (Mac: "2 combat keystones"): net/firmament/firmamentLaw.js - the sky's own law, which the
//     account service judges too.
//
// With the ladder off (Settings > Features, Loot Rarity) nothing here binds: Daggerfall's artifacts are Daggerfall's
// own and the ladder's powers sleep already (systems/loot/lootPowers.js wornPowers). The doors register the switch here
// as they load (systems/power/attuneActions.js - the ladder's word, and only where something can attune), so this file
// stays a leaf and enchantments.js may read it.
//
// Not a DFU member but for the artifacts' arm, which departs from EntityEffectManager (an artifact's enchantments live
// whenever it is equipped there): Ledger A (PWR2).

/** The most pieces a character holds attuned at once (Mac: "3"). */
export const ATTUNE_MOST = 3;
/** The most sigil sets awake at once (Mac: "2 sets"). */
export const SETS_AWAKE_MOST = 2;

let _on = () => false;
/** The ladder's word that attunement binds (systems/power/attuneActions.js registers it as it loads). */
export function registerAttunementSwitch(/** @type {(() => boolean) | null} */ fn) { _on = typeof fn === 'function' ? fn : () => false; }
/** Whether attunement binds now. */
export const attunementOn = () => { try { return !!_on(); } catch { return false; } };

/** Whether a piece carries a power attunement wakes: a Legendary's record, a Rare's imprint, a Gilded record, or one of
 *  Daggerfall's artifacts. */
export function attunable(/** @type {any} */ item) {
  if (!item || typeof item !== 'object') return false;
  if (item.artifact === true) return true;
  if (item.rarity === 'legendary') return typeof item.legendary === 'string';
  if (item.rarity === 'rare') return typeof item.imprint === 'string';
  if (item.rarity === 'gilded') return typeof item.gilded === 'string';
  return false;
}
/** A piece's attunement stamp, or 0. */
export const attunedStamp = (/** @type {any} */ item) => (Number.isSafeInteger(item?.attuned) && item.attuned > 0 ? item.attuned : 0);

/** The pieces `entity` holds that carry a stamp, latest first. */
export function stampedPieces(/** @type {any} */ entity) {
  const items = Array.isArray(entity?.items) ? entity.items : [];
  return items.filter((it) => attunable(it) && attunedStamp(it) > 0).sort((a, b) => attunedStamp(b) - attunedStamp(a));
}
/** The pieces `entity` holds attuned and AWAKE: the ATTUNE_MOST latest stamps. */
export function attunedPieces(/** @type {any} */ entity) { return stampedPieces(entity).slice(0, ATTUNE_MOST); }

/**
 * THE QUESTION EVERY POWER ASKS: is this piece's power awake for `entity`? A piece with no power answers true (nothing
 * to wake); with attunement off, true; else whether it is among the wearer's attuned pieces. With no wearer in hand
 * (an enchantment pump that knows only the item), its own stamp answers - the wearer's settle (attuneActions.js) keeps
 * stale stamps cleared, so a stamp in the hand of its holder is a live one.
 */
export function powerAwake(/** @type {any} */ entity, /** @type {any} */ item) {
  if (!attunable(item) || !attunementOn()) return true;
  if (!entity || !Array.isArray(entity.items) || !entity.items.includes(item)) return attunedStamp(item) > 0;   // a view no one holds (attunePreview's) - its own stamp
  return attunedPieces(entity).includes(item);
}
/** THE PIECE AS WEARING IT WOULD LEAVE IT - for a comparison's view (ui/armourCard.js wearComparison): a piece with a
 *  power, unstamped, that `entity` has room to attune comes back as a copy stamped awake (putting it on out of combat
 *  attunes it - attuneActions.js settleAttunement); anything else as it is. Never the piece itself changed. */
export function attunePreview(/** @type {any} */ entity, /** @type {any} */ item) {
  if (!attunable(item) || !attunementOn() || attunedStamp(item) > 0 || attuneRoom(entity) <= 0) return item;
  return { ...item, attuned: Number.MAX_SAFE_INTEGER };
}
/** How many pieces `entity` holds attuned and awake, and how many more it may attune. */
export const attunedCount = (/** @type {any} */ entity) => attunedPieces(entity).length;
export const attuneRoom = (/** @type {any} */ entity) => Math.max(0, ATTUNE_MOST - attunedCount(entity));

/** PWR4 (bible/05-Combat/Power-Arc.md section 7): the attunement sets the skies kept aside carry (systems/power/
 *  attuneActions.js swapAttunementSet), as a save holds them - `{ 1: [uid], 2: [uid] }`, each the pieces' ids, three at
 *  most; anything else read as none. */
export function attuneSkiesOf(/** @type {any} */ v) {
  /** @type {Record<number, string[]>} */
  const out = {};
  for (const k of [1, 2]) {
    const a = v?.[k];
    if (Array.isArray(a)) out[k] = a.filter((u) => typeof u === 'string' && u.length > 0 && u.length <= 64).slice(0, ATTUNE_MOST);
  }
  return out;
}
