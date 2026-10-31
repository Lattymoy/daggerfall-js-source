// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WILD-INSURE (2026-10-26, the owner: "Overhauling the open PvP to be a bit more palatable, being able to insure gear on
// death ... while retaining its punishment"; asked, "Kept, policy spent" at "20% of worth") - A POLICY ON A PIECE OF GEAR,
// THE LAW (bible/11-Multiplayer/Wild-Zone.md section 4b). A leaf the account Worker bundles
// (server-account/src/wildInsure.js writes a policy, server-account/src/wild.js spends it): one law at both ends.
//
//  - WHAT MAY BE INSURED (INSURE-ALL, 2026-10-29, as the owner asked): any piece of
//    gear - a weapon, armour, a shield, jewellery, clothing - and any piece the ledger follows, that a death in the zone
//    could take (wildDropLaw.js wildCanLose), carried in the pack or worn. Never a stack, a bound or quest piece, or a
//    letter of credit: coin, which pays its tenth (LETTERS-TENTH). A policy names its piece by insureKeyOf.
//  - ITS PREMIUM: a fifth of the piece's worth (systems/item/itemLaw.js itemWorth - the judge's own measure) and the gold
//    the item maker took for its rows (wildMakerGold), rounded up, at least one gold - paid as it is written, as every
//    realm act pays (net/realm/realmGoldLaw.js payFromSave: the purse, its letters, then the bank).
//  - IN FORCE WILD_INSURE_SETTLE_S after it is written, against the fall's own signing (its receipt's `i`): the killer has
//    WILD_REF.pickMs to pick and the fall is signed after it, so a policy written on the death screen can never keep
//    from the death it was written over. The game writes one only outside the zone (net/wild/wildInsureBook.js), where
//    the walk in is longer than the wait.
//  - SPENT: a death at another player's hand in the zone keeps every insured piece carried or worn (wildDropLaw.js
//    takeWildDeath's `insured`), and spends the policy of each one it would have TAKEN (AUDIT PVP-EASE L1-3, L2-2, the
//    owner: "Only when it saved the piece" - takeWildDeath's `saved`): the worn piece the killer picked, and a bag piece
//    the drop would have carried into the remains. A policy on a worn piece no pick named, in a hall that searches no
//    body, or past the remains' bound stays in force. A death to a foe takes nothing and spends nothing (FOE-KEEPS), nor
//    does a kill the repeat shield keeps (REPEAT-SHIELD). A policy on a piece in the cart or a companion's pack is neither
//    needed nor spent: those are storage (STORE-KEEPS).
//  - LAPSED (AUDIT PVP-EASE L1-2): a policy whose piece the record holds nowhere any more lapses at the next insure
//    (wildPolicyHeld), and only the held count toward WILD_INSURE_MAX.
// Not a DFU member: Daggerfall Unity has no other players, and no zone.
// ═══════════════════════════════════════════════════════════════════
import { ledgerKeyOf, valuablePiece, mintItemId } from '../item/itemIds.js';
import { ITEM_UID_RE, PROVENANCE_RE, itemWorth } from '../item/itemLaw.js';
import { enchantmentRowCost, makerLaid, GOLD_PER_ENCHANTMENT_POINT } from '../enchanting.js'; // INSURE-ALL: the maker's rows, at their gold
import { TEMPLATES } from '../item/itemKinds.js';
import { wildCanLose } from './wildDropLaw.js';

/** The premium is a piece's worth over this, rounded up - a fifth (the owner: "20% of worth"). A divisor, as the zone's
 *  gold share is one (wildDropLaw.js WILD_GOLD_DIVISOR): `w / 5` is exact for every whole worth. */
export const WILD_INSURE_DIVISOR = 5;
/** Seconds after it is written that a policy is in force - past WILD_REF.pickMs and the fall's signing after it
 *  (test/systems/wild/wildinsure.test.js holds the two apart). */
export const WILD_INSURE_SETTLE_S = 120;
/** The most policies one character holds in force at once. */
export const WILD_INSURE_MAX = 32;
/** The most pieces one ask insures. */
export const WILD_INSURE_ASK_MAX = 8;

/** A policy's key as the wire carries it: a piece's insurance key (an id, or a crafted piece's provenance). */
export const wildPolicyKeyOk = (/** @type {unknown} */ k) =>
  typeof k === 'string' && (ITEM_UID_RE.test(k) || PROVENANCE_RE.test(k));

/** INSURE-ALL: the groups of gear - every piece a slot takes, by the group the record says (headless: no equip table). */
export const WILD_GEAR_GROUPS = Object.freeze(['Weapons', 'Armor', 'Jewellery', 'MensClothing', 'WomensClothing']);

/** May this piece be insured: gear or a piece the ledger follows, one piece (never a stack, a bound or quest piece), that
 *  a death in the zone could take, and no letter of credit. Its key may still be unminted (wildInsureKey). Where it lies is
 *  the asker's to say (the pack or worn: wildInsureTargets). @param {any} item */
export function wildInsurable(item) {
  if (!item || typeof item !== 'object' || item.templateIndex === TEMPLATES.Letter_of_credit) return false;
  if (item.bound === true || item.questItem === true || (Number.isInteger(item.stackCount) && item.stackCount > 1))
    return false;
  return (valuablePiece(item) || WILD_GEAR_GROUPS.includes(item.group)) && wildCanLose(item);
}

/** INSURE-ALL: THE KEY A POLICY NAMES ITS PIECE BY - its ledger key (itemIds.js ledgerKeyOf), or a plain piece of gear's
 *  own id. That id is the piece's alone: no ledger reads it (ledgerKeyOf answers null for it), so a forged one keys only
 *  its own record's policy (wildInsuredBy keeps no piece by a key two pieces share). @param {any} item */
export function insureKeyOf(item) {
  const k = ledgerKeyOf(item);
  if (k != null || !wildInsurable(item)) return k;
  return typeof item.uid === 'string' && ITEM_UID_RE.test(item.uid) ? item.uid : null;
}

/** INSURE-ALL: `item`'s key, its id minted first where it has none - an old piece, a plain one (as the realm checkpoint
 *  mints a valuable piece's: itemIds.js stampItemIds). Null for a piece no policy may name.
 *  @param {any} item @param {(b: Uint8Array<ArrayBuffer>) => Uint8Array} [rand] */
export function wildInsureKey(item, rand) {
  if (!wildInsurable(item)) return null;
  if (insureKeyOf(item) == null && Object.isExtensible(item)) item.uid = mintItemId(rand);
  return insureKeyOf(item);
}

/** INSURE-ALL: the gold the item maker took for the rows it laid on `item` (enchanting.js makerLaid) - each row at the
 *  catalogue's cost, never the cost the row says of itself, a side effect at none (totalGoldCost's law). itemWorth leaves
 *  it out (the maker writes no `value`), so a Rare enchanted to its full points priced as it was found. @param {any} item */
export function wildMakerGold(item) {
  const rows = Array.isArray(item?.enchantments) ? item.enchantments.filter(makerLaid) : [];
  return rows.reduce((g, e) => g + Math.max(0, enchantmentRowCost(e) ?? 0), 0) * GOLD_PER_ENCHANTMENT_POINT;
}

/** A policy's premium on `item`: a fifth of its worth and its maker's gold, rounded up, at least one gold. @param {any} item */
export const wildPremium = (item) =>
  Math.max(1, Math.ceil((itemWorth(item) + wildMakerGold(item)) / WILD_INSURE_DIVISOR));

/** Whether a policy written at `at` (epoch seconds) is in force for a fall signed at `fallAt`. */
export const wildPolicyInForce = (/** @type {number} */ at, /** @type {number} */ fallAt) =>
  Number.isSafeInteger(at) && Number.isSafeInteger(fallAt) && at + WILD_INSURE_SETTLE_S <= fallAt;

/** THE PREDICATE A DEATH KEEPS BY (wildDropLaw.js takeWildDeath's `insured`): a piece whose insurance key is one of
 *  `keys`. INSURE-ALL: `among` the fallen's pieces - a key two of them carry keeps neither, so an id copied onto a second
 *  piece buys that piece nothing. @param {Iterable<string> | null | undefined} keys @param {any[] | null} [among]
 *  @returns {((item: any) => boolean) & { keyOf: (item: any) => string | null }} */
export function wildInsuredBy(keys, among = null) {
  const set = new Set(keys ?? []);
  const seen = new Set();
  for (const it of Array.isArray(among) ? among : []) {
    const k = insureKeyOf(it);
    if (k == null || (!set.has(k) && !seen.has(k))) continue;
    if (seen.has(k)) set.delete(k);
    seen.add(k);
  }
  // the rule rides the predicate: wildDropLaw.js names what it saved by it, and cannot import this leaf (its cycle)
  const by = set.size
    ? (/** @type {any} */ item) => {
        const k = insureKeyOf(item);
        return k != null && set.has(k);
      }
    : () => false;
  return Object.assign(by, { keyOf: insureKeyOf });
}

/** The pieces of `entity` a policy may be written on - in its pack, worn or not (never the cart's or a companion's:
 *  storage, which no death takes) - each insurable. @param {any} entity @returns {any[]} */
export const wildInsureTargets = (entity) => (Array.isArray(entity?.items) ? entity.items.filter(wildInsurable) : []);

/** AUDIT PVP-EASE L1-2: WHETHER A POLICY'S PIECE IS STILL THE CHARACTER'S - its key (insureKeyOf) anywhere in the record `save`
 *  (the pack, the cart, a companion's pack, a hold: wherever it was stored). Read by the key's own quoted text, so a
 *  piece in any list the record grows keeps its policy - a lapse is only ever a policy whose piece is gone for certain.
 *  @param {any} save @param {string} key */
export function wildPolicyHeld(save, key) {
  let text = '';
  try {
    text = JSON.stringify(save) ?? '';
  } catch {
    return true;
  }
  return text.includes(JSON.stringify(key));
}
