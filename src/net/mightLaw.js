// @ts-check
// EG-MIGHT (2026-10-31, the owner: "Address DMG cap in Elite Breach. It's not engaging to see 45 DMG when you're well
// geared"; asked, "Gear-aware purse"; bible/11-Multiplayer/Elite-Gates.md section 21.1): A KIT'S MIGHT ON THE WIRE - how
// much harder a realm character's judged gear can make a blow than the gate's reference (net/gate/gateBrain.js dpsRef),
// in whole per cent (100: none). The account service's judge reads it (net/kitMight.js), the identity mint signs it (`mg`)
// with the Renown's sky, and the Elite Breach's relay grows a member's purse by it. A leaf: the relay and the mint read it.
import { BLOW_TOPS } from '../systems/powerCeiling.js';

/** No might: the gate's reference alone. */
export const MIGHT_NONE = 100;
/** The most a might is: ten times the reference. A stand-in's whole grows by it and stays under the least wire ceiling
 *  nobody clamps (world/gate/gateBoss.js STAND_IN_WHOLE, a bout's 10,000). */
export const MIGHT_MOST = 1000;

/** A might a token may carry: a whole per cent, MIGHT_NONE..MIGHT_MOST. */
export const mightOk = (gm) => Number.isSafeInteger(gm) && gm >= MIGHT_NONE && gm <= MIGHT_MOST;
/** The factor a might grows a purse by (1 where none is signed). */
export const mightX = (gm) => (mightOk(gm) ? gm / MIGHT_NONE : 1);
/** Per cents onto a blow, multiplied, as a whole might within its bounds. */
export const mightOf = (pcts) => Math.max(MIGHT_NONE, Math.min(MIGHT_MOST, Math.round(MIGHT_NONE * pcts.reduce((k, p) => k * (1 + Math.max(0, p) / 100), 1))));

/** THE RENOWN'S SKY: the Firmament's blow stars come with Renown, so its part is its top at the Renown's share of
 *  `renownMax` (net/identityToken.js RENOWN_MAX, handed in by the mint). */
export const firmamentPart = (renown, renownMax) => (Number.isSafeInteger(renown) && renown > 0 && renownMax > 0 ? (BLOW_TOPS.firmament * Math.min(renown, renownMax)) / renownMax : 0);

/** WHAT THE MINT SIGNS (`mg`): the kit's judged might grown by the Renown's sky; null where no kit was judged. */
export function mightSigned(/** @type {unknown} */ kit, /** @type {unknown} */ renown, /** @type {number} */ renownMax) {
  if (!mightOk(kit)) return null;
  return mightOf([(/** @type {number} */ (kit) / MIGHT_NONE - 1) * 100, firmamentPart(renown, renownMax)]);
}
