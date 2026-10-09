// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WILD-WAYPOINT (2026-10-09, the owner: "when i die ... [my pile] also should be visible on the overworld map and has a
// waypoint"). MY REMAINS, A FLAG I FOLLOW.
//
// A death in the open zone leaves my bag's things on the ground for WILD_REMAINS_MS (net/wildRemains.js), and the held
// map rang them (ui/wildMapInk.js) - the Overworld knew nothing of them, and nothing pointed the way back. Now the death
// plants one personal waypoint where they lie (systems/mapWaypoints.js - the store BOTH maps draw), named so, in red,
// and FOLLOWED: the Overworld keeps it on the screen's edge with its distance wherever I stand. It goes by itself - when
// the remains' time is up, when the room says they are gone (all taken, by me or another), or at the next death's own
// flag - and it is remembered with its end on this device, so a game closed and opened again inside the ten minutes
// still points the way, and one opened after them takes it down.
//
// A LEAF over the waypoint store and the app's storage, so the pins drive it with the real store.
// ═══════════════════════════════════════════════════════════════════
import { addWaypoint, removeWaypoint, setWaypointFollowed, waypointById } from './mapWaypoints.js';
import { appStorage } from './appStorage.js';

/** Where the flag's id and its end are kept on this device. */
export const WILD_WP_KEY = 'dfjs.wild.remainsWp';
/** The flag's name and colour. */
export const WILD_WP_NAME = 'My remains';
export const WILD_WP_COLOR = 'red';

/** The record as this session holds it - the device's word when it has storage, this alone when it has none. */
let held = null;
/** @returns {{ id: string, until: number, r: string|null } | null} */
function readMark() {
  let raw = null;
  try { raw = appStorage()?.getItem(WILD_WP_KEY) ?? null; } catch { raw = null; }
  if (!raw) return held;
  try {
    const v = JSON.parse(raw);
    return typeof v?.id === 'string' && Number.isFinite(v?.until) ? { id: v.id, until: v.until, r: typeof v.r === 'string' ? v.r : null } : null;
  } catch { return null; }
}
function writeMark(v) {
  held = v ? { ...v } : null;
  try { if (v) appStorage()?.setItem(WILD_WP_KEY, JSON.stringify(v)); else appStorage()?.removeItem(WILD_WP_KEY); } catch { /* held for the session */ }
}

/** The flag standing now, or null. */
export function remainsMark() {
  const m = readMark();
  return m && waypointById(m.id) ? m : null;
}

/** Take my remains' flag down (if one stands); true when one did. */
export function clearRemainsMark() {
  const m = readMark();
  writeMark(null);
  return !!m && removeWaypoint(m.id, { quiet: true });
}

/**
 * Plant my remains' flag at map point (mx, my) - map pixels, floats, the held map's own unit - until `until` (epoch ms),
 * for remains `r`; the last death's flag goes first. Answers the flag's id, or null for a point off the map.
 * @param {{ mx: number, my: number, until: number, r?: string|null }} o
 */
export function markRemains({ mx, my, until, r = null }) {
  clearRemainsMark();
  if (!Number.isFinite(until)) return null;
  const got = addWaypoint({ kind: 'personal', mx, my, name: WILD_WP_NAME, color: WILD_WP_COLOR });
  if (!got) return null;
  setWaypointFollowed(got.waypoint.id, true);
  writeMark({ id: got.waypoint.id, until, r });
  return got.waypoint.id;
}

/** The host's frame: the flag goes when its remains' time is up (or its waypoint was removed by hand). */
export function remainsMarkTick(now) {
  const m = readMark();
  if (!m) return false;
  if (now >= m.until || !waypointById(m.id)) { clearRemainsMark(); return true; }
  return false;
}

/** The room said remains `r` are gone (all taken, or let go): their flag goes. */
export function remainsGone(r) {
  const m = readMark();
  return !!m && m.r != null && m.r === r ? clearRemainsMark() : false;
}
