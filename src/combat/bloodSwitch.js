// BLOOD1 - THE ONE SWITCH, and the two numbers beside it.
//
// The same shape systems/survival/switch.js keeps: the row owns the key
// and the default (systems/features.js, RF4's law), this reads it
// through the prefs shelf, and it imports the shelf and NOTHING ELSE so
// the combat leaves can ask without a cycle.
//
// Blood is the port's own (bible/05-Combat/Blood-Arc.md) - no mod is
// vendored for it - so the row is an ENHANCED one rather than a mod
// row, and the key is the port's.
//
// BLOOD AUDIT 4, SAID PLAINLY: of the four keys below, only
// `blood-marks` and `blood-overkill` have a registry row today. The
// capacity and the density are read from keys nothing writes, so every
// player runs their defaults; a range control does not exist in the
// registry yet, and the gore slider that brings one is the next slice.
import { getPref } from '../systems/uiPrefs.js';

export const BLOOD_PREF = 'blood-marks';
/** ON by default: the splash has always played, and the mark is what a
 *  player expects to still be there. `?blood=off` and the row both turn
 *  it off. */
export const bloodMarksOn = (search = globalThis.location?.search ?? '') =>
  getPref(BLOOD_PREF) !== false && new URLSearchParams(search).get('blood') !== 'off';   // BLOOD1 AUDIT 3: the door the comment above promised and nothing had built - windAudio.js's own shape

/** HOW MANY MARKS EXIST BEFORE YOURS IS REUSED - a count, not a
 *  lifetime (Blood-Arc.md's reading of the reference makes the same
 *  point about its own setting, whose text calls it a duration).
 *  Allocated once at boot: the ring is built to this size and never
 *  grows, so the cost of blood is decided here and cannot rise during
 *  a fight. */
export const BLOOD_CAPACITY_PREF = 'blood-capacity';
export const BLOOD_CAPACITY_DEFAULT = 600;
export const BLOOD_CAPACITY_MIN = 50;
export const BLOOD_CAPACITY_MAX = 4000;
export function bloodCapacity() {
  const v = Number(getPref(BLOOD_CAPACITY_PREF));
  if (!Number.isFinite(v)) return BLOOD_CAPACITY_DEFAULT;
  return Math.max(BLOOD_CAPACITY_MIN, Math.min(BLOOD_CAPACITY_MAX, Math.round(v)));
}

/** The particle-amount slider as a FRACTION. `scaleRate`'s floor of one
 *  means a player who turns this right down gets less blood and never
 *  none, which is the whole reason that floor is there. */
export const BLOOD_DENSITY_PREF = 'blood-density';
export function bloodDensity() {
  const v = Number(getPref(BLOOD_DENSITY_PREF));
  if (!Number.isFinite(v)) return 1;
  return Math.max(0, Math.min(1, v));
}

/** BLOOD1b - THE OVERKILL SWITCH, the reference's `settingsAllowOverkill`.
 *  A blow for 175% of a body's health throws a second, far wider spray
 *  on top of the ordinary one; this is the row that says whether it
 *  does. ON by default, like the marks themselves: the threshold is
 *  high enough that an ordinary fight never reaches it, so what the
 *  row really turns off is the spectacle of a killing blow. */
export const BLOOD_OVERKILL_PREF = 'blood-overkill';
export const bloodOverkillOn = () => getPref(BLOOD_OVERKILL_PREF) !== false;

/** The dep bag `createHitEffects` takes, built once so four hosts
 *  cannot each spell it differently (the FOUR HOSTS RULE's own
 *  hazard). */
export const bloodDecalDeps = Object.freeze({
  enabled: () => bloodMarksOn(),
  capacity: bloodCapacity,
  density: bloodDensity,
  overkill: bloodOverkillOn,
});
