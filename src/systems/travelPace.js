// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PACE-DIALS (2026-10-06, the player: "Revert back to the overworld timer multiplier for ppl to set to 60x and 100x on
// roads and the nearby enemy timer to set to 60x max. Those options should also be available when the player stands
// still on the overworld map."; then: "speed settings should be 5x 10x 20x 30x 40x 60x and 100x should be only setable
// when on a road and it has to go to 60 instantly again when leaving the road. Same for enemies nearby multiplier and
// same rules. The multipliers ... should have the same rules in other uis in online mode").
//
// TWO DIALS, ONE LADDER (PACE_STEPS: 5, 10, 20, 30, 40, 60, 100):
//   speed - the rate a fast journey (and the Overworld's own walk) runs at
//   foe   - the slowest the clock runs while an enemy holds it (ENEMY-PACE's floor)
// THE ROAD RULE, for both: x100 may be chosen only while the traveller stands on a road or a track; the moment they
// leave it, a dial at x100 goes to x60 - kept so (it does not climb back by itself on the next road). Off the road the
// ladder ends at x60.
//
// THE RULE LIVES HERE, NOT IN A PANEL: every reader asks this module (systems/timeScale.js travelRateOf, travelThreat.js
// foePaced), and the host tells it the ground each frame a journey or the Overworld runs (`setPaceGround`) - so every
// skin, the classic strip's box as much as the Overworld's block, and an online session as much as an offline one, run
// under the same law. Kept on the device, never in a save (the mod saved no travel state, Travel-Options.md).
// ═══════════════════════════════════════════════════════════════════
import { appStorage } from './appStorage.js';

export const TRAVEL_PACE_STORE_KEY = 'dfjs.travel.pace2';
/** The ladder every dial steps along. */
export const PACE_STEPS = Object.freeze([5, 10, 20, 30, 40, 60, 100]);
/** The top of the ladder (a road's alone), and the top off the road - RATE-LAW's two rates, declared here once
 *  (systems/timeScale.js TRAVEL_ROAD_RATE and TRAVEL_OPEN_RATE read them; this leaf cannot read that module, which reads
 *  it). The road's top is the mod's AccelerationLimit, timeScale.js MAX_TIME_SCALE - pinned equal. */
export const ROAD_PACE_MAX = 100;
export const OPEN_PACE_MAX = 60;
/** The two dials, in the panels' order. */
export const TRAVEL_PACE_DIALS = Object.freeze(['speed', 'foe']);
/** The defaults: the open ground's top for the journey (x100 is the player's to choose on a road), ENEMY-PACE's x5. */
export const TRAVEL_PACE_DEFAULT = Object.freeze({ speed: OPEN_PACE_MAX, foe: 5 });
/** The words the panels say. */
export const TRAVEL_PACE_TEXT = Object.freeze({
  title: 'Travel speed',
  speed: 'Speed',
  foe: 'Near enemies',
  tip: {
    speed: `How fast a journey runs (×${ROAD_PACE_MAX} on a road only - leaving it drops to ×${OPEN_PACE_MAX})`,
    foe: `The slowest the clock runs while enemies are near (×${ROAD_PACE_MAX} on a road only)`,
  },
  roadOnly: `×${ROAD_PACE_MAX} only on a road`,
  slower: 'Slower',
  faster: 'Faster',
});

/** A rate held to the ladder (rounded down onto it) and to the ground's top. */
export function clampPace(n, onRoad = false) {
  const v = Number(n);
  const top = onRoad ? ROAD_PACE_MAX : OPEN_PACE_MAX;
  if (!Number.isFinite(v)) return PACE_STEPS[0];
  let best = PACE_STEPS[0];
  for (const s of PACE_STEPS) if (s <= v && s <= top) best = s;
  return best;
}

let pace = null;
let ground = false;   // the host's last word: on a road or a track
/** WILD3 (the owner: "Youre also slower in this zone max 20x in the wilds and 40x on the roads"): THE ZONE'S CAP - while
 *  the host says the traveller stands in the open PvP zone, the ground's top is the zone's (`WILD_PACE_CAP`). A cap,
 *  never a write: the dials keep the player's choice and run under it, and leaving the zone gives it back at once. */
export const WILD_PACE_CAP = Object.freeze({ road: 40, open: 20 });
let zoneCap = null;
/** The ground's top in force: the road's or the open's, under the zone's cap while one stands. */
const topOn = (onRoad) => {
  const t = onRoad ? ROAD_PACE_MAX : OPEN_PACE_MAX;
  return zoneCap ? Math.min(t, onRoad ? zoneCap.road : zoneCap.open) : t;
};
/** The host's word on the zone, each frame (scenes/world.js wildFrame): `cap` the zone's tops, or null outside it. */
export function setPaceZoneCap(cap) {
  const next = cap ? { road: Number(cap.road) || WILD_PACE_CAP.road, open: Number(cap.open) || WILD_PACE_CAP.open } : null;
  if ((next?.road ?? 0) === (zoneCap?.road ?? 0) && (next?.open ?? 0) === (zoneCap?.open ?? 0)) return;
  zoneCap = next;
  const cur = travelPace();
  for (const fn of [...listeners]) { try { fn(cur, 'zone'); } catch { /* a listener's own fault */ } }   // a running journey asks its clock again
}
/** The zone's cap in force, or null. */
export const paceZoneCap = () => zoneCap;
const listeners = new Set();

function read() {
  const p = { ...TRAVEL_PACE_DEFAULT };
  let raw = null;
  try { raw = appStorage()?.getItem(TRAVEL_PACE_STORE_KEY) ?? null; } catch { raw = null; }
  if (raw) {
    try {
      const v = JSON.parse(raw);
      for (const k of TRAVEL_PACE_DIALS) if (Number.isFinite(v?.[k])) p[k] = clampPace(v[k], false);   // a boot is on no known road: x100 is chosen again on one
    } catch { /* a bad word: the defaults */ }
  }
  return p;
}
function write(next, which) {
  pace = next;
  try { appStorage()?.setItem(TRAVEL_PACE_STORE_KEY, JSON.stringify(pace)); } catch { /* held for the session */ }
  for (const fn of [...listeners]) { try { fn(pace, which); } catch { /* a listener's own fault */ } }
}

/** The dials as stored: { speed, foe }. */
export function travelPace() {
  pace ??= read();
  return pace;
}
/** Whether the host last said the traveller stands on a road. */
export const paceOnRoad = () => ground;

/** THE ROAD RULE'S DOOR: the host's word on the ground, each frame a journey or the Overworld runs. Leaving a road takes
 *  every dial at x100 down to x60 at once (told to the listeners, so a running journey asks its clock again). */
export function setPaceGround(onRoad) {
  const was = ground;
  ground = !!onRoad;
  if (was === ground) return;
  const cur = travelPace();
  if (!ground && (cur.speed > OPEN_PACE_MAX || cur.foe > OPEN_PACE_MAX)) {
    write({ speed: Math.min(cur.speed, OPEN_PACE_MAX), foe: Math.min(cur.foe, OPEN_PACE_MAX) }, 'ground');
    return;
  }
  // the ground moved and no dial did: the panels' + is told (x100 offered on a road, refused off it)
  for (const fn of [...listeners]) { try { fn(cur, 'ground'); } catch { /* a listener's own fault */ } }
}

/** A dial's rate in force now (the stored one, under the ground's top). */
export function paceNow(which) {
  const v = travelPace()[which] ?? TRAVEL_PACE_DEFAULT[which];
  return Math.min(v, topOn(ground));   // WILD3: under the zone's cap too
}
/** The journey's rate on a ground (systems/timeScale.js travelRateOf asks). */
export const paceRateOn = (onRoad) => Math.min(topOn(onRoad), travelPace().speed);   // WILD3: the zone's top where it stands

/** Set one dial - onto the ladder, under the ground's top (x100 refused off the road). Returns the rate set. */
export function setTravelPace(which, n) {
  if (!TRAVEL_PACE_DIALS.includes(which)) return null;
  const v = clampPace(n, ground);
  const cur = travelPace();
  if (cur[which] !== v) write({ ...cur, [which]: v }, which);
  return v;
}

/** One step along the ladder: `dir` +1 faster, -1 slower (never past the ground's top). Returns the rate set. */
export function stepTravelPace(which, dir) {
  if (!TRAVEL_PACE_DIALS.includes(which)) return null;
  const cur = paceNow(which);
  let i = PACE_STEPS.indexOf(clampPace(cur, true));
  i = Math.max(0, Math.min(PACE_STEPS.length - 1, i + (dir > 0 ? 1 : -1)));
  return setTravelPace(which, PACE_STEPS[i]);
}

/** Whether a dial can step up from where it stands, on this ground. */
export function paceCanRise(which) {
  return paceNow(which) < topOn(ground);
}

/** Hear a change; returns the way to stop hearing it. */
export function onTravelPace(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Pins: back to the device's word. */
export function _resetTravelPace() { pace = null; ground = false; zoneCap = null; listeners.clear(); }
