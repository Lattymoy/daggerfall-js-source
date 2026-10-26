// @ts-check
// ═══════════════════════════════════════════════════════════════════
// OW-PATH - HOW THE OVERWORLD'S CLICKS TRAVEL (bible/06-Systems/Travel-View.md).
//
// The player's ask (2026-09-29): "it also needs a prefer streets and freewalk button. also when moving near cities it
// always dictates me going right into the city iam not able to fine move around a city on the overworld map."
//
// TWO MODES, ONE SWITCH on the Overworld's bar:
//  - ROADS (the default, the view as it shipped): a town is reached by the roads, a spot by the way the roads help.
//  - FREE: every journey goes across country - never onto a road it does not need (MOUNTAINS WALKABLE, the owner, the
//    Wrothgarian zone's merge: over the mountains too). A journey with no free way falls back to the roads, and says so.
//
// AND THE SNAP. A click near a town's walls was a click ON the town (TV_PLACE_GROW) - right from afar, where a town is
// a few pixels from 450 m up, and wrong beside it, where every click round its walls walked the traveller in through
// the gate. A ground click is the town's only when `pickTakesPlace` says so: in ROADS mode, from outside the town's
// own neighbourhood, and never with the fine-move modifier (Shift or Alt) held. A plate's click is always the town's.
//
// The choice is the device's, as "Show me to travellers" is: kept through the one storage seam (appStorage).
// ═══════════════════════════════════════════════════════════════════
import { appStorage } from '../appStorage.js';

export const TRAVEL_PATH_MODES = Object.freeze(['roads', 'free']);
export const TRAVEL_PATH_DEFAULT = 'roads';
export const TRAVEL_PATH_STORE_KEY = 'dfjs.overworld.pathMode';

/** The switch's words: its two faces, what each does under the pointer, and the fallback's line. */
export const TRAVEL_PATH_TEXT = Object.freeze({
  roads: 'Roads',
  free: 'Free',
  label: 'Path',
  tipRoads: 'Follow roads to reach towns. Shift-click to walk to an exact spot.',
  tipFree: 'Walk straight across country. Clicks near a town go to the exact spot.',   // MOUNTAINS WALKABLE: no longer round them
  fellBack: 'There is no open way there, so you take the roads.',
});

let mode = null;
const listeners = new Set();

/** The mode now: 'roads' or 'free' (read once from the device, then held). */
export function travelPathMode() {
  if (mode) return mode;
  let v = null;
  try { v = appStorage()?.getItem(TRAVEL_PATH_STORE_KEY) ?? null; } catch { v = null; }
  mode = TRAVEL_PATH_MODES.includes(/** @type {string} */ (v)) ? /** @type {string} */ (v) : TRAVEL_PATH_DEFAULT;
  return mode;
}

/** Set it (an unknown word is refused), keep it on the device, tell whoever listens. Returns the mode now. */
export function setTravelPathMode(next) {
  if (!TRAVEL_PATH_MODES.includes(next)) return travelPathMode();
  if (travelPathMode() === next) return next;
  mode = next;
  try { appStorage()?.setItem(TRAVEL_PATH_STORE_KEY, next); } catch { /* no storage: held for the session */ }
  for (const fn of [...listeners]) { try { fn(next); } catch { /* a listener's own fault */ } }
  return next;
}

/** The other mode (the switch's single press on a keyboard or a pad). */
export const toggleTravelPathMode = () => setTravelPathMode(travelPathMode() === 'roads' ? 'free' : 'roads');

/** Hear the mode change; returns the way to stop hearing it. */
export function onTravelPathMode(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** A journey in this mode takes the roads. */
export const travelPathUsesRoads = (m = travelPathMode()) => m !== 'free';

/**
 * IS A GROUND CLICK ON A TOWN THE TOWN'S JOURNEY? `hit` - the click landed inside the town's (grown) rect; `nearby` -
 * the traveller already stands in the town's neighbourhood; `fine` - the fine-move modifier was held. Only in ROADS
 * mode, from outside the neighbourhood, without the modifier: everywhere else the click is the spot it landed on.
 * @param {{ hit: boolean, nearby?: boolean, fine?: boolean, mode?: string }} q
 */
export function pickTakesPlace({ hit, nearby = false, fine = false, mode: m = travelPathMode() }) {
  return !!hit && travelPathUsesRoads(m) && !nearby && !fine;
}

/** OW-TOWN-ROUND (2026-10-23, the owner: "Overworld pathing always wants to walk into the middle of the town let the player
 *  always go around it if not clicking vaguely in the middle of the city"): THE TOWN'S JOURNEY IS ASKED AT ITS MIDDLE. A
 *  click anywhere in a town's grown rect took the town (and walked to its middle); now only one in the middle of it does
 *  - within PLACE_MIDDLE_SHARE of its half-width each way, never less than PLACE_MIDDLE_MIN (native units, about 75 m: a
 *  hamlet of one block is all middle). Anywhere else on it is the spot, walked round the town (travelRoute.js routeLegs).
 *  `p` native {x, z}; `rect` the view's grown place rect ({minX, maxX, minZ, maxZ, cx, cz}), `grow` what it was grown by. */
export const PLACE_MIDDLE_SHARE = 0.4;
export const PLACE_MIDDLE_MIN = 3072;
export function pickNearPlaceMiddle(p, rect, grow = 0) {
  if (!p || !rect) return false;
  const hx = Math.max(0, (rect.maxX - rect.minX) / 2 - grow), hz = Math.max(0, (rect.maxZ - rect.minZ) / 2 - grow);
  const rx = Math.max(PLACE_MIDDLE_MIN, hx * PLACE_MIDDLE_SHARE), rz = Math.max(PLACE_MIDDLE_MIN, hz * PLACE_MIDDLE_SHARE);
  return Math.abs(p.x - rect.cx) <= rx && Math.abs(p.z - rect.cz) <= rz;
}

/** The fine-move modifier on a pointer event: Shift or Alt. */
export const fineMoveHeld = (e) => !!(e && (e.shiftKey || e.altKey));

/** Pins: back to the device's word. */
export function _resetTravelPathMode() { mode = null; listeners.clear(); }
