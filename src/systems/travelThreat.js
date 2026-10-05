// @ts-check
// ═══════════════════════════════════════════════════════════════════
// OW6 - THE JOURNEY SLOWS AS ENEMIES CLOSE (bible/06-Systems/Travel-View.md, OW6; 2026-09-29, the player: "If a player
// is traveling very fast, they should slow if enemies become close").
//
// Travel Options drives a traveller at up to a hundred times their own pace, and the port runs the world's foes at
// theirs (TO1's one departure, Travel-Options.md): at x40 a rider crossed a band's whole sight in a breath, and what
// stood in the road was met in no time at all - Mac's "U run thru them" (AUDIT OW5b). AUDIT OW5b E1 made the meeting stop
// the journey the frame it comes; this makes the journey SLOW AS IT COMES. The clock is held so that the traveller takes
// at least THREAT_WARN_S of real time to reach the nearest enemy's REACH along their way - the circle it sees in (a
// band's sight, a ship's lookout, a foe's sight: sixty metres for a camp's) or, for one already chasing, its contact
// ring, closing from any side at its own pace too. An enemy whose reach the way never enters is passed at full pace;
// one the traveller is inside holds the journey at walking pace until they leave it. The governor slows a journey, it
// never stops one (the encounter does that - travelOptions.js `encounter`).
//
// The ground's rate stays the journey's (RATE-LAW, systems/timeScale.js travelRateOf): the host clamps what reaches the
// clock (TV2's own law, systems/travelGovernor.js - the lower of the two holds), and the travel panel says it is held,
// and why.
//
// PURE: where the enemies are, the way and the pace in; a cap out. Metres, relative to the traveller's feet, in the
// scene's axes (a heading's forward is (sin yaw, cos yaw), as the drive's own yaw).
// ═══════════════════════════════════════════════════════════════════

/** Real seconds of warning the traveller always has before an enemy's reach. OW6-LATE (2026-09-29, the player: "when you
 *  go near enemies it slows you down waaaay to early - its good that it does it but still"): 2, was 5 - the hold begins
 *  2.5x nearer at every pace (a rider at x40 held from 1.3 km short of a band's sight, not 3.2 km), and the traveller
 *  still meets the reach at walking pace. OW6-NEAR (FIELD BUGS 2026-09-29g, ! OG: "reduce the encounter speed slowing
 *  distance by like 40% to start"): 1.2 - the lead-in before every reach 40% shorter at every pace (a rider at x40 held
 *  from 768 m short of a band's sight, not 1280), no enemy's sight or chase moved. OW6-HALF (2026-10-01, Mac: "We also
 *  need to reduce the distance at which overworld enemies slow the user down"): 0.6 - the lead-in halved again at every
 *  pace (a rider at x40 held from 384 m short of a band's sight, not 768; on foot 84 m, not 168), the reach still met at
 *  walking pace. */
export const THREAT_WARN_S = 0.6;

/**
 * Metres along the way (`heading`, a unit {x, z}, or null when there is no way - a traveller standing) before the point
 * (dx, dz) is within `reach`: 0 inside it already (unless the way leads out - a traveller leaving is not held); Infinity
 * when the way never comes within it, or it lies behind. With no way, the straight distance to the reach's edge.
 * @param {number} dx @param {number} dz @param {number} reach
 * @param {{x: number, z: number} | null} heading
 */
export function metresToReach(dx, dz, reach, heading) {
  const d = Math.hypot(dx, dz);
  if (!heading) return Math.max(0, d - reach);
  const along = dx * heading.x + dz * heading.z;   // how far ahead the enemy is along the way
  if (d <= reach) return along >= 0 ? 0 : Infinity;   // inside: held while the way goes deeper, free as it leads out
  const disc = along * along - (d * d - reach * reach);
  if (disc < 0) return Infinity;   // the way passes it by
  const enter = along - Math.sqrt(disc);
  return enter >= 0 ? enter : Infinity;   // both crossings behind: it is behind the traveller
}

/** Down to the old spinner's own ladder - 1, 2, 3, 4, 5, then fives - never under walking pace. */
export const threatStep = (n) => (n >= 5 ? Math.floor(n / 5) * 5 : Math.max(1, Math.floor(n)));

/** ENEMY-PACE (the player: "a second time multiplier for when you're near an enemy"), FIXED BY RATE-LAW (2026-10-04,
 *  Mac: "Remove travel options dials"): the slowest pace the clock runs at with an enemy holding it - the enemies' cap
 *  still eases a journey down toward them, never under this. It was the panel's second stepper, whose own default it
 *  keeps; the stepper is gone. */
export const JOURNEY_FOE_PACE = 5;
/** The enemies' cap on the rate asked (`want`), floored at JOURNEY_FOE_PACE and never over the ask. */
export const foePaced = (cap, want) => Math.min(want, Math.max(cap, JOURNEY_FOE_PACE));

/**
 * THE CAP: the highest time scale at which the traveller, at `speedMps` (their own unscaled pace, the motor's), takes
 * `warnS` real seconds or more to reach the nearest enemy's reach along their way.
 * @param {{ threats: Array<{ dx: number, dz: number, reach: number, chasing?: boolean, mps?: number }>,
 *   heading?: {x: number, z: number} | null, speedMps: number, warnS?: number }} q  a threat's `chasing`: it closes
 *   from any side (its straight distance to the ring, never "behind"); `mps` its own pace toward the traveller
 * @returns {{ cap: number, threat: object | null, metres: number }} Infinity and null when nothing near asks for less
 */
export function threatCap({ threats, heading = null, speedMps, warnS = THREAT_WARN_S }) {
  let best = Infinity, near = null, rate = 0;
  if (!(speedMps > 0)) return { cap: Infinity, threat: null, metres: Infinity };
  for (const t of threats ?? []) {
    const m = t.chasing ? Math.max(0, Math.hypot(t.dx, t.dz) - t.reach) : metresToReach(t.dx, t.dz, t.reach, heading);
    const closing = speedMps + (t.mps > 0 ? t.mps : 0);
    // the time it takes at x1, against the warning: the lowest ratio is the enemy that asks the most of the clock
    if (!Number.isFinite(m)) continue;
    const r = m / (warnS * closing);
    if (near === null || r < rate) { rate = r; best = m; near = t; }
  }
  if (near === null) return { cap: Infinity, threat: null, metres: Infinity };
  return { cap: threatStep(rate), threat: near, metres: best };
}
