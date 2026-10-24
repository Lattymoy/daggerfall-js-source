// @ts-check
// SPELL-HAND (2026-10-23, the owner: "Using the spell hand and any 1 handed weapon in tandem. Basically being able to cast
// one handed spells and visually seeing the one handed spell sprite hand/morrowind"; "Make the best decisions"). A SPELL IN
// THE FREE HAND, A WEAPON IN THE OTHER. Design and record: bible/05-Combat/Two-Hands.md "The spell hand".
//
// DFU is the reference and never mixes the two: a readied spell hides the weapon (WeaponManager's HasReadySpell leg) and
// FPSSpellCasting's own header says its hands "are never mixed with weapons directly on screen at same time" - both hands
// cast, the weapon down. Here, with a one-handed weapon in the hand that fights and nothing at all in the other, the spell
// takes the free hand ALONE and the weapon stays up:
//   - the WEAPON swings on the swing button (SwingWeapon) as it always does - the readied spell no longer eats that click
//     (scenes/hostMagic.js interceptAttack's swing door); the SPELL leaves on its own press, ActivateCenterObject (Mouse0 -
//     EntityEffectManager's own cast, systems/activateGate.js), the touch layer's cast and the hotbar's;
//   - THE HANDS TAKE TURNS: no swing starts while the cast's hands play (the rig's canAttack, DFU's own IsPlayingAnim leg),
//     and a cast pressed while the weapon is mid-blow waits for the blow to end, then leaves (hostMagic firePending - kept,
//     never dropped);
//   - one hand is drawn: the classic lane draws FPSSpellCasting's one picture (it IS a left hand: AlignLeftHand draws it
//     as painted, AlignRightHand its mirror - fpsSpellCasting.js RIGHT_HAND_UV) on the free hand's side alone, and the
//     Morrowind arm keeps the weapon in its hand through the spell stance and the cast (combat/fpArm.js setSpellHand);
//   - the guard (handsLaw.js GUARD, Mac's "the other weapon in hand should lower slightly"): while one hand strikes the
//     other lowers by GUARD.LOWER of its own drawn height - the weapon under the cast, the readied hand under a blow.
//
// What is the free hand: the hand that does not fight (DFU's used hand, `usingRightHand`, holds the weapon - H still
// swaps them), empty - no weapon, no shield, no light carried in it. Both hands taken (a pair, a shield, a light, a bow's
// or a staff's two hands) or no weapon in the hand that fights (sheathed, the fists, the beast - whose hands MorphSelf
// empties) is DFU's two-handed cast, untouched.

import { dualEligible, otherHand, GUARD } from './handsLaw.js';
import { spellHandRects, RIGHT_HAND_UV } from '../fpsSpellCasting.js';
import { weaponOffsetHeight } from '../../ui/hud/hudLarge.js';

/** @typedef {import('./handsLaw.js').HandDesc} HandDesc */

/**
 * THE LAW: may the hands hold a spell beside the weapon - the weapon hand and the spell hand, or null for DFU's two-handed
 * cast. Pure; `sheathed` and the readied spell are the callers' (the hands can fit with nothing readied: the rig asks it to
 * know whether drawing the weapon keeps a spell readied, and whether a cast just begun is one-handed).
 *   lead     - the hand that fights (DFU's used hand);
 *   right, left - each hand's item described (handsLaw.js HandDesc - a shield described as an item, `shield` set);
 *   leftBusy - a light carried in a hand (handsModeOf's word).
 * A pair or the fists never fit: a pair's other hand holds a weapon, the fists hold none to fight with.
 * @param {{ lead?: 'R'|'L', right?: HandDesc, left?: HandDesc, leftBusy?: boolean }} hands
 * @returns {{ weaponHand: 'R'|'L', spellHand: 'R'|'L' } | null}
 */
export function spellHandOf({ lead = 'R', right = null, left = null, leftBusy = false } = {}) {
  if (leftBusy) return null;
  const weaponHand = lead === 'L' ? 'L' : 'R', spellHand = otherHand(weaponHand);
  const weapon = weaponHand === 'R' ? right : left, free = spellHand === 'R' ? right : left;
  if (!dualEligible(weapon)) return null;   // a one-handed weapon fights: a blade or a Pistolet (never a bow's, a staff's)
  if (free?.item) return null;   // a weapon or a shield in the free hand
  return { weaponHand, spellHand };
}

// ---- THE LIVE WORD (one player, one pair of hands) ------------------------------------------------------------------

/**
 * Whether the spell hand is up this frame and whether its weapon is mid-blow - written by the rig that steps the frame
 * (combat/weapon/weaponRig.js), read by the cast's doors (scenes/hostMagic.js). A singleton for the reason
 * fpsSpellCasting is one: the player has one pair of hands, the four hosts each hold a rig, and the magic engine a building
 * shares with its street reads whichever rig owns the frame.
 */
const live = { up: false, fits: false, busy: false, pending: false };
/** The spell hand is up: a spell readied (or casting) in the free hand, the weapon drawn in the other. */
export const spellHandUp = () => live.up;
/** AUDIT SPELL-HAND L2-2: the weapon hand is mid-blow where a spell would go in the free hand - a spell readied there, or
 *  one readied THIS moment (the hotbar's ready-and-cast, a CasterOnly's instant cast) that the rig has not yet seen: a
 *  cast pressed now waits for the blow. */
export const spellHandBusy = () => (live.up || live.fits) && live.busy;
/** AUDIT SPELL-HAND L4-1: a cast press is waiting for the weapon's blow - the rig starts no new blow while it does, so a
 *  held swing button never starves the cast (the hands take turns: the blow, the cast, then the blows again). */
export const castPending = () => live.pending;
/** The rig's word, once a frame and again as a strike begins: `fits` - the hands would hold a spell beside the drawn
 *  weapon (whether or not one is readied); `up` - one is; `busy` - a strike is in flight. */
export function tellSpellHand({ up = false, fits = false, busy = false } = {}) { live.up = !!up; live.fits = !!fits || !!up; live.busy = !!busy; }
/** SPELL-HAND: a CAST's own press, as the hosts hand it to the cast's door (scenes/hostMagic.js interceptAttack) - one frozen
 *  word, imported, so no host grows by an entry for it (HOST-SPLIT: test/scenes/hostceiling.test.js counts entries). */
export const CAST_PRESS = Object.freeze({ cast: true });
/** The magic engine's word: a cast press waits (scenes/hostMagic.js firePending). */
export function tellCastPending(on) { live.pending = !!on; }
/** The pins' reset. */
export function _resetSpellHand() { live.up = false; live.fits = false; live.busy = false; live.pending = false; }

// ---- THE PICTURE (the classic lane) ---------------------------------------------------------------------------------

/**
 * ONE OF FPSSPELLCASTING'S TWO HANDS - the cast's frame (or the readied hands' frame 0) on the free hand's side alone,
 * placed exactly as UpdateSpellCast places that hand (spellHandRects: AlignLeftHand's rect as painted, AlignRightHand's
 * mirrored), lowered by its guard (`guard`, the weight - guardDrop of its own drawn height). `side` is the screen side the
 * spell hand is drawn on - the side the weapon is NOT (the caller's: a left-handed player's weapon is on the left). True
 * when it drew.
 * @param {any} renderer
 * @param {{ width: number, height: number }} canvas
 * @param {any} art the element's casting art (fpsSpellCasting.js loadSpellCastArt)
 * @param {number} frameIndex
 * @param {{ side?: 'left'|'right', tint?: number[] | null, offsetHeight?: number, guard?: number }} [o]
 */
export function drawSpellHand(renderer, canvas, art, frameIndex, { side = 'left', tint = null, offsetHeight = weaponOffsetHeight(), guard = 0 } = {}) {
  if (!renderer || !canvas || !art || frameIndex < 0) return false;
  const rec = art.records[frameIndex];
  if (!rec || !rec.width || !rec.height) return false;
  const rects = spellHandRects(canvas, rec, { frameIndex, element: art.element, offsetHeight });
  const r = side === 'right' ? rects.right : rects.left;
  renderer.drawScreenQuad(rec.tex, { ...r, y: r.y + guardDrop(guard, r.h) }, side === 'right' ? RIGHT_HAND_UV : undefined, tint ?? undefined);
  return true;
}

/** The guard's drop in canvas pixels for a picture `h` pixels tall at guard weight `g` (handsLaw.js GUARD.LOWER - a pair's
 *  resting weapon's own share, so the two hands lower alike). */
export const guardDrop = (g, h) => (g > 0 && h > 0 ? g * GUARD.LOWER * h : 0);
