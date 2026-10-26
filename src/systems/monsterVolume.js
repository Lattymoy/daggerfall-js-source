// MONSTER-VOL (2026-10-20, the owner: "add an option under audio for it called Monster Volume with 0 - 100%"): the
// loudness of what a monster says - its attract call and its attack sound (hostCombat.js playEnemyClip, the one seam
// both ride) and its pain cry. A swing's impact and a parry are the weapon's, not the monster's, and stay on Sound
// Volume alone. The Audio tab's Volume row writes uiPrefs `monsterVolume` (0..1); the master bus still scales it.
import { getPref } from './uiPrefs.js';

/** A 0..1 volume off the shelf (1 when it holds nothing usable - 0 is a value, a muted volume). HORSE-VOL: animalVolume.js reads its
 *  two rows through it too. */
export const shelfVolume = (key) => { const v = Number(getPref(key)); return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1; };

/** The Audio tab's Monster Volume, 0..1 (1 when the shelf holds nothing usable). */
export function monsterVolume() {
  return shelfVolume('monsterVolume');
}

/** COMPANION-VOL (2026-10-23, the owner: "add companion moaning random screaming in idle volume option"): the Audio tab's
 *  Companion Idle Volume, 0..1 - how loud a companion's idle call is (the attract bark QUIET-COMPANIONS already slows:
 *  the moans and the cries a crew hand or a sworn revenant gives out while it walks with you, hostCombat.js
 *  tickEnemySound). It rides on top of Monster Volume (the same body's voice), so 0 here silences a companion's idle
 *  calls alone and its swings and pain cries keep Monster Volume's. uiPrefs `companionVolume`. */
export function companionVolume() {
  return shelfVolume('companionVolume');
}
