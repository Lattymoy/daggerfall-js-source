// @ts-check
// ═══════════════════════════════════════════════════════════════════
// OWS2 - THE JOURNEY'S HAND ON THE HELM (bible/06-Systems/Travel-View.md,
// "OWS - the sea"). The player's ask: "You should transition to your boat
// if traveling across water then back onto land when hitting land".
//
// A journey's sea legs are sailed by Come Sail Away itself: this module
// decides only what a sailor's hands would do - the rudder keys held
// (MoveLeft / MoveRight), the sails raised or lowered (the ToggleSail
// key's edge) and the oars pulled (the autorun) - and the world host
// presses them through the helm's one input seam, as CSA-L's panel does.
// The boat's way, its turn, the wind's pull on its sails and the oars'
// fatigue are the mod's own, statement for statement; nothing here moves
// a boat.
//
// THE LAW, in order:
//   - the sails when the boat has any and the wind can fill them (a
//     wind under `calm` cannot), else the oars; the oars too while the
//     boat turns more than `sailTurnMax` onto its course (the mod turns a
//     boat under sail by the way it makes - TurnTarget is the speed times
//     the rudder over ten - so one head to wind never comes round, where
//     the oars turn it at 20 degrees a second), for a spell after the
//     sails made no way (`stall`), near a landfall's shore (`rowInM` - the
//     oars take it in, as a sailor lowers sail to come ashore), while land
//     stands close ahead (`avoidM`), and whenever a crew's oars are the
//     faster (`oarWay` over `sailWay`: the Large Galley's crew rows at
//     eight, its one square sail makes four or five - a crew rows for
//     nothing, a lone rower pays the fatigue, so a crewless boat sails);
//   - under sail, the course is the mark's bearing unless it lies inside
//     the rig's no-go cone about the wind's eye (35 degrees for a rig
//     with a lateen, 68 for square sails alone - where GetSailPower's
//     pull times the course's share toward the mark is best): then the
//     boat beats up on a tack, `noGo` off the eye, and goes about when
//     the mark's bearing has swung `laneDeg` past the eye to the other
//     side, so it zig-zags up a lane about the wind's line - SAIL-FREE
//     (2026-10-05, Mac's "No tacking, Black Flag"; systems/helmWay.js):
//     under the responsive helm (`free`) she makes the most of her way
//     sailing straight for it, so there is no cone and no tack;
//   - land close ahead turns the boat to the freer side (the host's
//     probe of the water ahead and to either hand);
//   - the rudder: held toward the course while the heading is more than
//     `deadDeg` off it.
//
// PURE: numbers in, keys out - pinned against the mod's own runtime
// sailing a real hull (test/ows2_crossing.test.js).
// ═══════════════════════════════════════════════════════════════════

export const SEA_HELM = Object.freeze({
  /** The heading within this of the course (degrees): the rudder let go. */
  deadDeg: 4,
  /** Beating: the mark's bearing may swing this far past the wind's eye (degrees) before the boat goes about. */
  laneDeg: 20,
  /** How close to the wind a rig with a lateen, a gaff or a staysail sails (degrees off its eye). */
  noGoFore: 35,
  /** ...and square sails alone: past 68 their pull falls faster than the course gains (GetSailPower's square law). */
  noGoSquare: 68,
  /** A wind shorter than this fills no sail (UpdateWind's 1-2, a tenth of it in fog). */
  calm: 0.25,
  /** Under sail, a way ahead slower than this (m/s)... */
  stallMps: 0.35,
  /** ...for this long (s) is no way made: the oars take over... */
  stallS: 8,
  /** ...for this long (s), and then the sails are tried again. */
  oarsS: 20,
  /** A landfall's shore this near ahead (m): the sails come down and the oars take the boat in. */
  rowInM: 120,
  /** Land this near ahead on a leg that does not land there (m): the oars, and the rudder to the freer side. */
  avoidM: 120,
  /** The heading more than this off the course (degrees): the oars turn the boat onto it, the sails wait. */
  sailTurnMax: 30,
});

/** An angle folded into (-180, 180]. */
export const foldDeg = (d) => { const a = ((d % 360) + 540) % 360 - 180; return a === -180 ? 180 : a; };
/** A flat direction's heading - degrees clockwise from north (+z), as the port's yaw counts. */
export const headingOf = (x, z) => (Math.atan2(x, z) * 180) / Math.PI;

/** The helm's memory between frames: the tack held, the stall's clock, the oars' spell. */
export const createSeaHelm = () => ({ tack: 0, stall: 0, oars: 0 });

/**
 * One frame of the journey's hand on the helm.
 * @param {{ tack: number, stall: number, oars: number }} st
 * @param {{ heading: number, bearing: number, wind: number[], hasSails: boolean, squareOnly?: boolean, sailsUp: boolean,
 *   canSail: boolean, way: number, dt: number, landfall?: boolean, landAhead?: number, freer?: number, crewed?: boolean,
 *   oarWay?: number, sailWay?: number, free?: boolean }} q
 *   `heading` the bow's and `bearing` the mark's (degrees, clockwise from north); `wind` the wind's flat vector (where
 *   it blows); `way` the boat's speed along its bow (m/s, astern negative); `landAhead` the metres to land along the
 *   bow (Infinity: none seen); `freer` the hand with more water (-1 left, 1 right); `landfall` this leg ends ashore;
 *   `crewed` a crew at the oars, whose speed is `oarWay` against the sails' `sailWay` in this wind (m/s); `free` the
 *   responsive helm's SAIL-FREE, under which no course is too near the wind to sail.
 * @returns {{ turn: -1|0|1, sails: 'raise'|'lower'|null, row: boolean, course: number }}
 */
export function seaHelmStep(st, q) {
  const H = SEA_HELM;
  const windLen = Math.hypot(q.wind[0] ?? 0, q.wind[1] ?? 0);
  const ahead = q.landAhead ?? Infinity;
  const avoiding = !q.landfall && ahead <= H.avoidM;
  const rowingIn = !!q.landfall && ahead <= H.rowInM;
  if (st.oars > 0) st.oars = Math.max(0, st.oars - q.dt);
  const crewRows = !!q.crewed && (q.oarWay ?? 0) >= (q.sailWay ?? 0);
  const sailable = q.hasSails && windLen >= H.calm && !rowingIn && !avoiding && !crewRows;
  let course = foldDeg(q.bearing);
  if (sailable) {
    const eye = headingOf(-(q.wind[0] ?? 0), -(q.wind[1] ?? 0));   // where the wind comes from
    const noGo = q.free ? 0 : q.squareOnly ? H.noGoSquare : H.noGoFore;   // SAIL-FREE: the responsive helm sails straight up
    const off = foldDeg(q.bearing - eye);
    if (Math.abs(off) < noGo) {
      if (st.tack === 0) st.tack = off >= 0 ? 1 : -1;
      else if (st.tack * off < -H.laneDeg) st.tack = -st.tack;   // the mark swung past the eye: go about
      course = foldDeg(eye + st.tack * noGo);
    } else st.tack = 0;
  } else st.tack = 0;
  if (avoiding) course = foldDeg(q.heading + (q.freer ?? 1) * 90);   // land close ahead: hard over to the freer hand
  const err = foldDeg(course - q.heading);
  // the stall: under sail, on the course, and making no way ahead
  if (q.sailsUp && q.way < H.stallMps && Math.abs(err) <= H.sailTurnMax) {
    st.stall += q.dt;
    if (st.stall >= H.stallS) { st.stall = 0; st.oars = H.oarsS; }
  } else st.stall = 0;
  const sailsWanted = sailable && st.oars <= 0 && Math.abs(err) <= H.sailTurnMax;
  const sails = sailsWanted && !q.sailsUp && q.canSail ? 'raise' : !sailsWanted && q.sailsUp ? 'lower' : null;
  const turn = err > H.deadDeg ? 1 : err < -H.deadDeg ? -1 : 0;
  return { turn, sails, row: !sailsWanted, course };
}

/**
 * The rig's law for the no-go cone: square sails alone beat at `noGoSquare`; a lateen, a gaff or a staysail aboard at
 * `noGoFore`. `boat` is Come Sail Away's Boat (its sails' lists).
 * @param {{ Sails?: any[], SailsSquare?: any[] }} boat
 */
export const squareOnly = (boat) => (boat?.Sails?.length ?? 0) > 0 && (boat?.SailsSquare?.length ?? 0) === (boat?.Sails?.length ?? 0);
