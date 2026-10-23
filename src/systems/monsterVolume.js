// MONSTER-VOL (2026-10-20, the owner: "add an option under audio for it called Monster Volume with 0 - 100%"): the
// loudness of what a monster says - its attract call and its attack sound (hostCombat.js playEnemyClip, the one seam
// both ride) and its pain cry. A swing's impact and a parry are the weapon's, not the monster's, and stay on Sound
// Volume alone. The Audio tab's Volume row writes uiPrefs `monsterVolume` (0..1); the master bus still scales it.
import { getPref } from './uiPrefs.js';

/** The Audio tab's Monster Volume, 0..1 (1 when the shelf holds nothing usable). */
export function monsterVolume() {
  const v = Number(getPref('monsterVolume'));
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
}
