// @ts-check
// EG-MIGHT (2026-10-31, bible/11-Multiplayer/Elite-Gates.md section 21.1): A MEMBER'S MIGHT IN THE SPIRE. The trust law's
// purse (net/gate/gateBrain.js spendPurse) grows by the might the member's token signs (net/mightLaw.js), so a blow lands up
// to that many times the gate's reference; the health a member brings to every body the hall sizes by its company grows
// by the might's square root, so a geared company kills faster, never as fast as its numbers grow. Not a DFU member.
import { dpsRef, clampLv } from '../gate/gateBrain.js';
import { mightOk, mightX } from '../mightLaw.js';

/** How much of a member's might the health it brings takes (0: none, 1: all - every kill as long as without it). */
export const EG_MIGHT_HEALTH_EXP = 0.5;
/** The factor a member's purse grows by: its might's whole. */
export const egPurseX = (mg) => mightX(mg);
/** The reference damage a member's health share is counted in: the gate's at its level, grown by its might's root. */
export const egHealthRef = (lv, mg) => dpsRef(clampLv(lv)) * mightX(mg) ** EG_MIGHT_HEALTH_EXP;
/** What a breach member's socket carries of its token: its character level (EG-PLAY) and its kit's might. */
export const egTokenAtt = (/** @type {any} */ who) => ({
  ...(Number.isSafeInteger(who?.cl) && who.cl >= 1 ? { cl: who.cl } : {}),
  ...(mightOk(who?.mg) ? { mg: who.mg } : {}),
});
