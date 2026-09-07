// ENHANCED COMBAT VISUALS 1 (ECV1, 2026-09-07, Mac: "ill let you lead
// this. This can fold into a new toggle Enhanced Combat Visuals").
//
// THE PROBLEM IT ANSWERS. An imp casts Chameleon on itself (its classic
// spell list is Wizard's Fire, Free Action, Toxic Cloud and Chameleon -
// SPELLS.STD 0x2C, EnemyEntity.cs ImpSpells), and DFU's
// EntityConcealmentBehaviour.MakeConcealed then DISABLES the enemy's
// mesh renderer for any of the six concealment flags, normal or true
// power (EntityConcealmentBehaviour.cs:36-43, :56-62). The enemy keeps
// acting and its collider keeps taking hits; there is nothing on screen
// between the cast and its next landed blow (which breaks a normal-
// power concealment: EnemyAttack.cs:316-318 for a foe's blow on
// anything, :255-257 on the player; WeaponManager.cs:549-552 the
// player's). Mac: "the imp enemy type goes invisible and still can be
// attacked" - it reads as a bug.
// It is DFU's rule, kept 1:1 on the classic lane (the A5 skip in every
// foe draw). This is the ENHANCED lane's drawing of the same state.
//
// THE LAW. Nothing about the rules changes - the cast, the detection
// gate, the hits, the break. Only what is DRAWN for a concealed foe:
//   Invisibility  -> hidden, as DFU draws it (invisible means invisible;
//                    the Orc Shaman's spell stays stronger than the imp's)
//                    - except for the hit flash below, which shows an
//                    invisible foe too: the one place this departure
//                    hands the player something DFU's draw never does
//                    (where the blow landed), said so on the page
//   Chameleon     -> the sprite at low opacity with a slow shimmer and a
//                    ripple across it - blending in, trackable up close
//   Shadow        -> a dark translucent silhouette - a shade
//   any of them, just HIT -> a brief flash of the sprite at the impact,
//                    fading over REVEAL_SECONDS, so a connecting swing
//                    on an unseen foe reads as a hit and not a glitch
// The flags come from the entity's effects (systems/effects.js -
// DaggerfallEntity.IsInvisible / IsBlending / IsAShade); when two are
// up the stronger concealment wins, invisible over blending over shade.
// The player's own concealment keeps no visual: DFU draws none in first
// person and neither does the port.
//
// THE SWITCH. `enhancedCombatVisuals` in systems/uiPrefs.js (the
// Enhanced menu's row, on by default like the other enhanced visuals),
// live on the enhanced skin only; `?combatvisuals=off` is the kill
// switch. Off, or on the classic skin, every host takes the verbatim
// A5 skip - a concealed foe is not drawn.
//
// This module is PURE: the hosts hand it the flags, a clock and the
// last hit's stamp; the renderer draws what it returns.

import { isEnhanced } from './uiSkin.js';
import { getPref } from './uiPrefs.js';
import { concealmentFlags, isMagicallyConcealed } from './effects.js';

/** Chameleon: the base opacity, and the shimmer's swing and rate. */
export const BLEND_ALPHA = 0.22;
export const BLEND_SHIMMER = 0.08;
export const BLEND_HZ = 1.3;
/** Shadow: a dark silhouette - the opacity and how far the lit colour
 *  is pulled toward black (the shader's multiplier). */
export const SHADE_ALPHA = 0.55;
export const SHADE_DARK = 0.12;
/** The hit reveal: how long the flash lasts and how bright it starts. */
export const REVEAL_SECONDS = 0.35;
export const REVEAL_ALPHA = 0.8;
/** The billboard shader's mode codes (uConceal.x). */
export const CONCEAL_MODE = Object.freeze({ blend: 1, shade: 2, reveal: 3 });

/** The switch: the enhanced skin, the pref, and no kill switch on the
 *  URL. Injectable for tests. */
export function combatVisualsOn(search = globalThis.location?.search ?? '', pref = getPref('enhancedCombatVisuals')) {
  if (new URLSearchParams(search).get('combatvisuals') === 'off') return false;
  return isEnhanced(search) && !!pref;
}

/**
 * What a concealed foe's sprite should look like right now.
 *
 * @param {{invisible?: boolean, blending?: boolean, shade?: boolean}} flags
 * @param {{t: number, hitAt?: number, phase?: number}} clock - `t` the
 *   host's seconds, `hitAt` the seconds of the last landed hit (or none),
 *   `phase` a per-foe radian offset so a pack does not shimmer in step
 * @returns {null | {mode: number, alpha: number, t: number, phase: number}}
 *   null = hidden; else the draw the shader takes
 */
export function concealVisual(flags, { t, hitAt = -Infinity, phase = 0 }) {
  const { invisible = false, blending = false, shade = false } = flags ?? {};
  if (!invisible && !blending && !shade) return null;
  // The clock reaches the shader through sin(z * 7 + w): uploaded
  // wrapped to one turn so a long session never feeds float32 sin a
  // number it cannot resolve (7 * 2pi is a whole number of turns, so
  // the wrap is invisible to the ripple).
  const tz = t % (2 * Math.PI);
  const since = t - hitAt;
  if (since >= 0 && since < REVEAL_SECONDS) {
    return { mode: CONCEAL_MODE.reveal, alpha: REVEAL_ALPHA * (1 - since / REVEAL_SECONDS), t: tz, phase };
  }
  if (invisible) return null;
  if (blending) {
    return { mode: CONCEAL_MODE.blend, alpha: BLEND_ALPHA + BLEND_SHIMMER * Math.sin(2 * Math.PI * BLEND_HZ * t + phase), t: tz, phase };
  }
  return { mode: CONCEAL_MODE.shade, alpha: SHADE_ALPHA, t: tz, phase };
}

/**
 * The host's one question per foe per frame: draw it plain, draw it
 * concealed, or not at all. Reads the foe's entity, its hit stamp and
 * its phase - the phase minted only on the concealed draw, so the
 * plain and classic paths touch nothing.
 *
 * @param {{entity: object, _ecvHit?: number, _ecvPhase?: number}} foe
 * @returns {{kind: 'plain'} | {kind: 'hidden'} | {kind: 'conceal', visual: object}}
 */
export function foeDraw(foe, on, t) {
  if (!isMagicallyConcealed(foe.entity)) return PLAIN;
  if (!on) return HIDDEN;   // A5, verbatim: EntityConcealmentBehaviour disables the renderer
  const visual = concealVisual(concealmentFlags(foe.entity), { t, hitAt: foe._ecvHit ?? -Infinity, phase: foePhase(foe) });
  return visual ? { kind: 'conceal', visual } : HIDDEN;
}
const PLAIN = Object.freeze({ kind: 'plain' });
const HIDDEN = Object.freeze({ kind: 'hidden' });

/** A landed blow on a foe: stamp the host's clock so the reveal can
 *  show. Stamped for every hit; it only draws while the foe is
 *  concealed. */
export function markConcealedHit(foe, t) {
  foe._ecvHit = t;
}

/** A foe's shimmer phase, minted once, DETERMINISTICALLY: the golden
 *  angle times a running count spreads a pack around the circle with
 *  no random draw (the classic lane's Math.random sequence is not this
 *  feature's to consume). */
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
let _phaseCount = 0;
export function foePhase(foe) {
  if (foe._ecvPhase === undefined) foe._ecvPhase = (_phaseCount++ * GOLDEN_ANGLE) % (2 * Math.PI);
  return foe._ecvPhase;
}
