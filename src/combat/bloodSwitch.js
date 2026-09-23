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
// BLOOD AUDIT 4 said plainly that the capacity and the density were
// read from two keys no row wrote; BLOOD2g retired those keys for the
// one `blood-gore` tier below. Every key here has a registry row now.
import { getPref } from '../systems/uiPrefs.js';

export const BLOOD_PREF = 'blood-marks';
/** ON by default: the splash has always played, and the mark is what a
 *  player expects to still be there. `?blood=off` and the row both turn
 *  it off. */
export const bloodMarksOn = (search = globalThis.location?.search ?? '') =>
  getPref(BLOOD_PREF) !== false && new URLSearchParams(search).get('blood') !== 'off';   // BLOOD1 AUDIT 3: the door the comment above promised and nothing had built - windAudio.js's own shape

/** BLOOD2g - THE GORE DIAL. ONE key for how much blood there is,
 *  stepped, because that is the question a player asks; the two numbers
 *  under it - the particle-amount FRACTION the reference's slider was
 *  (`scaleRate`'s floor of one means less blood and never none, which
 *  is the whole reason that floor is there) and HOW MANY MARKS EXIST
 *  BEFORE YOURS IS REUSED (a count, not a lifetime; Blood-Arc.md's
 *  reading of the reference makes the same point about its own setting,
 *  whose text calls it a duration) - are the tier's, read here and
 *  nowhere else. BLOOD1 read them off two keys of their own that no row
 *  ever wrote (BLOOD AUDIT 4 said so plainly); those keys are retired,
 *  and the dial is the registry's `blood-gore` row.
 *
 *  The ring is ALLOCATED to the tier's count when a pool is first
 *  built and never grows, so the cost of blood is decided here and
 *  cannot rise during a fight: the amount takes effect at once, the
 *  count when the game is next reloaded (the streaming world, the
 *  exterior and the interiors build their pools once a page; a dungeon
 *  builds its own on entry and takes the tier then - BLOOD AUDIT 5). */
export const BLOOD_GORE_PREF = 'blood-gore';
export const GORE_TIERS = Object.freeze({
  light: Object.freeze({ density: 0.5, capacity: 300 }),
  normal: Object.freeze({ density: 1, capacity: 600 }),
  heavy: Object.freeze({ density: 1, capacity: 1500 }),
  abattoir: Object.freeze({ density: 1, capacity: 4000 }),
});
export const GORE_DEFAULT = 'normal';
/** The tiers' bounds. The ring is a vertex buffer built to the tier's
 *  count, and `bloodGore` answers only a tier NAME, so a hand-edited
 *  store cannot reach a number at all; the clamp below is belt and
 *  braces over that closed vocabulary, and the pin asserts the TABLE
 *  sits inside these (BLOOD AUDIT 5). */
export const BLOOD_CAPACITY_DEFAULT = GORE_TIERS[GORE_DEFAULT].capacity;
export const BLOOD_CAPACITY_MIN = 50;
export const BLOOD_CAPACITY_MAX = 4000;
/** The stored tier, or the default for anything that is not one. */
export function bloodGore() {
  const v = getPref(BLOOD_GORE_PREF);
  return typeof v === 'string' && Object.hasOwn(GORE_TIERS, v) ? v : GORE_DEFAULT;
}
export function bloodCapacity() {
  const v = Number(GORE_TIERS[bloodGore()].capacity);
  if (!Number.isFinite(v)) return BLOOD_CAPACITY_DEFAULT;
  return Math.max(BLOOD_CAPACITY_MIN, Math.min(BLOOD_CAPACITY_MAX, Math.round(v)));
}
export function bloodDensity() {
  const v = Number(GORE_TIERS[bloodGore()].density);
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

/** BLOOD2e - BLOOD ON THE LENS. A blow that takes a real share of the
 *  player's health in one frame throws a few drops onto the screen,
 *  which slide and fade. The port's own (the reference has no screen
 *  blood); ON by default, its own row because it is the one piece of
 *  blood that is in the player's face rather than on the floor. */
export const BLOOD_SCREEN_PREF = 'blood-screen';
export const bloodScreenOn = () => getPref(BLOOD_SCREEN_PREF) !== false;

/** The dep bag `createHitEffects` takes, built once so four hosts
 *  cannot each spell it differently (the FOUR HOSTS RULE's own
 *  hazard). */
export const bloodDecalDeps = Object.freeze({
  enabled: () => bloodMarksOn(),
  capacity: bloodCapacity,
  density: bloodDensity,
  overkill: bloodOverkillOn,
});
