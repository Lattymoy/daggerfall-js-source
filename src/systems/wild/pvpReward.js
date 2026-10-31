// @ts-check
// PVP-REWARD (the PvP rework, 2026-10-29 - the owner: "they only get a piece that isnt insured", "random roll on uninsure
// peices", "random policy gold", "if gold will ovrweight a player u get a letter of credit", "get rid of the bag drop"):
// WHAT A KILL IN THE ZONE GIVES ITS KILLER. The account service rolls it on the fallen's record (server-account/src/
// wild.js), never the killer's game: one random worn piece no policy and no ledger hold keeps; else, every worn piece
// insured, the gold of one random policy, that policy spent and its piece kept. A leaf the account Worker bundles.
// A departure: DFU has no PvP.
import { wornOffer } from './wildDropLaw.js';
import { GOLD_PIECE_WEIGHT_KG, goldStack, isGoldPieces, letterOfCredit } from '../inventory.js';
import { wildInsuredBy, insureKeyOf } from './wildInsureLaw.js';

/** A whole number under `n` from `rand` (crypto's getRandomValues shape - the service's `ctx.rand`). */
export function pvpRollIndex(/** @type {(b: Uint8Array<ArrayBuffer>) => Uint8Array} */ rand, /** @type {number} */ n) {
  const b = rand(new Uint8Array(4));
  return (((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0) % n;
}

/** THE VILLAIN'S SEAM (PVP-VILLAIN, a later slice): a villain holds no insurance, so no policy keeps or pays at its fall.
 *  `keys` the policies in force; `among` the fallen's pieces (INSURE-ALL: a key two carry keeps neither). */
export const pvpInsuredFor = (
  /** @type {Iterable<string>} */ keys,
  { villain = false, among = /** @type {any[] | null} */ (null) } = {},
) => wildInsuredBy(villain ? [] : keys, among);

/**
 * THE ROLL over the fallen's worn pieces (`items`, wornOffer's order): `{ w }`, the place in wornOffer of one random piece
 * neither `insured` nor `keep` holds; else `{ policy }`, the key (insureKeyOf) of one random insured worn piece; else null.
 * `pick(n)` a whole number under n.
 * @param {any[]} items @param {{ insured?: (it: any) => boolean, keep?: (it: any) => boolean, pick: (n: number) => number }} o
 * @returns {{ w: number } | { policy: string } | null}
 */
export function pvpRewardRoll(items, { insured = () => false, keep = () => false, pick }) {
  const offer = wornOffer(items);
  const open = offer.map((it, w) => (insured(it) || keep(it) ? -1 : w)).filter((w) => w >= 0);
  if (open.length) return { w: open[pick(open.length)] };
  const keys = [
    ...new Set(
      offer
        .filter((it) => insured(it))
        .map(insureKeyOf)
        .filter((k) => k != null),
    ),
  ];
  return keys.length ? { policy: /** @type {string} */ (keys[pick(keys.length)]) } : null;
}

/** The policy's gold as the remains carry it, killer's alone: a coin pile of `n`. */
export const pvpPolicyGold = (/** @type {number} */ n) => goldStack(n);
/** A remains record's policy gold (a coin pile - a worn piece never is one), or 0. */
export const pvpPolicyGoldOf = (/** @type {any} */ rec) =>
  isGoldPieces(rec) && Number.isSafeInteger(rec.stackCount) && rec.stackCount > 0 ? rec.stackCount : 0;

/** HOW THE GOLD IS PAID - DFU's trade window's own law (tradeModes.js sellProceeds): coin when `n` pieces fit under the
 *  killer's `freeKg` (its game's MaxEncumbrance less its CarriedWeight), else a letter of credit for the whole. A tab that
 *  says no weight is paid a letter, which never overweights. */
export const pvpGoldPaid = (/** @type {number} */ n, /** @type {unknown} */ freeKg) =>
  typeof freeKg === 'number' && Number.isFinite(freeKg) && n * GOLD_PIECE_WEIGHT_KG <= freeKg ? 'gold' : 'letter';

/** The letter itself, its id `uid` (minted by the service). */
export const pvpLetterOf = (/** @type {number} */ n, /** @type {string} */ uid) => ({ ...letterOfCredit(n), uid });
