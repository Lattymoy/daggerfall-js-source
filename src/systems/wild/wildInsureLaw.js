// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WILD-INSURE (2026-10-26, the owner: "Overhauling the open PvP to be a bit more palatable, being able to insure gear on
// death ... while retaining its punishment"; asked, "Kept, policy spent" at "20% of worth") - A POLICY ON A PIECE OF GEAR,
// THE LAW (bible/11-Multiplayer/Wild-Zone.md section 4b). A leaf the account Worker bundles
// (server-account/src/wildInsure.js writes a policy, server-account/src/wild.js spends it): one law at both ends.
//
//  - WHAT MAY BE INSURED: a piece the ledger follows (systems/item/itemIds.js ledgerKeyOf - Magic tier and up, a DFU magic
//    item or artifact, a crafted piece: a policy names its piece by that key, as the ledger does) that a death in the
//    zone could take (wildDropLaw.js wildCanLose), carried in the pack or worn. Never a letter of credit: it is coin, and
//    pays its tenth (LETTERS-TENTH).
//  - ITS PREMIUM: a fifth of the piece's worth (systems/item/itemLaw.js itemWorth - the judge's own measure), rounded up, at
//    least one gold - paid as it is written, as every realm act pays (net/realm/realmGoldLaw.js payFromSave: the purse,
//    its letters, then the bank). Five deaths' premiums buy the piece again.
//  - IN FORCE WILD_INSURE_SETTLE_S after it is written, against the fall's own signing (its receipt's `i`): the killer has
//    WILD_REF.pickMs to pick and the fall is signed after it, so a policy written on the death screen can never keep
//    from the death it was written over. The game writes one only outside the zone (net/wild/wildInsureBook.js), where
//    the walk in is longer than the wait.
//  - SPENT: a death at another player's hand in the zone keeps every insured piece carried or worn (wildDropLaw.js
//    takeWildDeath's `insured`), and spends every one of those policies - insure only what you would hate to lose. A death
//    to a foe takes nothing and spends nothing (FOE-KEEPS), nor does a kill the repeat shield keeps (REPEAT-SHIELD). A
//    policy on a piece in the cart or a companion's pack is neither needed nor spent: those are storage (STORE-KEEPS).
// Not a DFU member: Daggerfall Unity has no other players, and no zone.
// ═══════════════════════════════════════════════════════════════════
import { ledgerKeyOf } from '../item/itemIds.js';
import { ITEM_UID_RE, PROVENANCE_RE, itemWorth } from '../item/itemLaw.js';
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

/** A policy's key as the wire carries it: a piece's ledger key (an id, or a crafted piece's provenance). */
export const wildPolicyKeyOk = (/** @type {unknown} */ k) => typeof k === 'string' && (ITEM_UID_RE.test(k) || PROVENANCE_RE.test(k));

/** May this piece be insured: the ledger follows it, a death in the zone could take it, and it is no letter of credit.
 *  Where it lies is the asker's to say (the pack or worn: wildInsureTargets). @param {any} item */
export function wildInsurable(item) {
  if (!item || typeof item !== 'object' || item.templateIndex === TEMPLATES.Letter_of_credit) return false;
  return ledgerKeyOf(item) != null && wildCanLose(item);
}

/** A policy's premium on `item`: a fifth of its worth, rounded up, at least one gold. @param {any} item */
export const wildPremium = (item) => Math.max(1, Math.ceil(itemWorth(item) / WILD_INSURE_DIVISOR));

/** Whether a policy written at `at` (epoch seconds) is in force for a fall signed at `fallAt`. */
export const wildPolicyInForce = (/** @type {number} */ at, /** @type {number} */ fallAt) => Number.isSafeInteger(at) && Number.isSafeInteger(fallAt) && at + WILD_INSURE_SETTLE_S <= fallAt;

/** THE PREDICATE A DEATH KEEPS BY (wildDropLaw.js takeWildDeath's and wornOffer's `insured`): a piece whose ledger key is
 *  one of `keys`. @param {Iterable<string> | null | undefined} keys @returns {(item: any) => boolean} */
export function wildInsuredBy(keys) {
  const set = new Set(keys ?? []);
  if (!set.size) return () => false;
  return (item) => { const k = ledgerKeyOf(item); return k != null && set.has(k); };
}

/** The pieces of `entity` a policy may be written on - in its pack, worn or not (never the cart's or a companion's:
 *  storage, which no death takes) - each insurable. @param {any} entity @returns {any[]} */
export const wildInsureTargets = (entity) => (Array.isArray(entity?.items) ? entity.items.filter(wildInsurable) : []);

/** THE POLICIES A DEATH SPENDS: the keys of `entity`'s pieces in its pack, worn or not, that `insured` keeps - each kept
 *  from the death, each policy used. @param {any} entity @param {(item: any) => boolean} insured @returns {string[]} */
export function wildPoliciesSpent(entity, insured) {
  const out = new Set();
  for (const it of Array.isArray(entity?.items) ? entity.items : []) {
    if (!insured(it) || !wildCanLose(it)) continue;
    const k = ledgerKeyOf(it);
    if (k != null) out.add(k);
  }
  return [...out];
}
