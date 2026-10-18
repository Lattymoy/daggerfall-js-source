// @ts-check
// THE ASCENT (LAW 9, 2026-10-16, Mac: "Something that isnt just a straight line from point A to point B";
// bible/11-Multiplayer/Elite-Gates-Ascent.md section 6): THE ROUTE'S PROOFS - THE LINKS' LAW.
//
//   THE TIMED SOLVER (net/eliteGates/egSpanLaw.js) proved a hall by z: every hall was one course along +z, so a road's crossing was its
//   course's pairs, each waited for in turn, and the still ground between them run. LAW 9's hall is a way (`spec.route` -
//   net/eliteGates/egRoute.js): its links walked, climbed, dropped and crossed in turn, a course of the span generator's pieces only on
//   its `span` links. So a road's crossing is its links' times along its path, each by its kind's law - this module's - and a
//   span link's by THE TIMED SOLVER on its own course (net/eliteGates/egSpanLaw.js chains the two: egRouteCross, THE MEDIAN over the
//   route, THE FAST BUILD's bound).
//
//   THE LINKS (a build `B` - `{ run, climb, start, rest, down, g, mantle }`, net/eliteGates/egSpanLaw.js's span build and fast build):
//   - a WALK and a BRIDGE: its walked length (`len`) at the build's run;
//   - a STAIR: up, at the motor's own pace on a slope - player/collider.js resolves a run into a slope along its plane, so the
//     body goes its pace x cos^2 of the slope in plan (measured on player/motor.js PlayerMotor up ramps of 11-45 degrees at
//     Speed 10 and 100, walked and run: 0.96 / 0.86 / 0.74 / 0.51 of the pace against cos^2's 0.96 / 0.86 / 0.73 / 0.50), its
//     time (plan^2 + rise^2) / (plan x run); down, its plan at the run (the motor runs a descent faster, gravity's - up to
//     1.42 x measured, EG_STAIR_DOWN_X for a lower bound) and never under its fall. A stair steeper than EG_ROUTE_STAIR_MAX is
//     no stair (the cos^2 law is measured to 45 degrees);
//   - a CLIMB: its climb's PITCHES (spec.climbs - its foot, its rest ledges, its lip), each the free climb's start
//     (EG_CLIMB_START_S, Forward held against the face), the wall climbed until the lip comes to the hands (its height less
//     EG_CLIMB_HANG_M, at the build's climb) and the mantle over it (parkour.js mantleDuration, egMantleS); on each rest ledge
//     the span build rests until the grip it spent is back (EG_GRIP_REGEN_S a whole grip - the feet on a floor);
//   - a DROP: its plan at the run, never under its fall (sqrt(2 x drop / g)).
//
//   THE GRIP (player/parkour.js, read whole): a fresh hold lasts gripSeconds(skill, fatigue) - 6 s at Climbing 0 to 30 at 100,
//   x 0.35 with fatigue spent: 2.1 s at Climbing 0 spent (EG_GRIP_S); the free climb spends it whole while it moves
//   (motor.js _wallStep - half held still, which the proof never asks), it comes back only with the feet on a floor or in the
//   water (motor.js: `grounded || swimming || sunk`, a whole grip in PARKOUR_GRIP_REGEN_S), and under PARKOUR_GRIP_MIN no hold is
//   taken. A pitch of height H is on the wall (H - EG_CLIMB_HANG_M) / EG_CLIMB_MPS - the climb holds the lip within the hang's
//   drop and 4 cm of the feet (motor.js _freeClimbStep's `level`), then the mantle spends none - so a pitch is PROVEN while that
//   is at most EG_GRIP_S less EG_GRIP_SLACK_S, each pitch on a fresh grip: every ledge between two pitches is a floor the body
//   stands on (EG_CLIMB_LEDGE_MIN_M deep - a shallower one is no rest, and the pitches either side of it are one). At
//   THE SPAN BUILD's climb (the walk's - EG_CLIMB_MPS) the longest proven pitch is 3.32 m; the real motor, at Climbing 0 with
//   its fatigue spent, climbs 3.37 m and falls from 3.38 (test/net/eliteGates/law9_proofs.test.js climbs both).
//
// Pure, transcendental-free (+, -, x, /, the square root: one answer on every engine - section 9's law clock), a leaf but for
// THE ROUTE (net/eliteGates/egRoute.js, itself a leaf). In the relay's bundle (net/eliteGates/egSpanLaw.js). The motor's numbers are restated, not
// imported (the relay's bundle carries no motor), and pinned equal to player/parkour.js and player/motor.js by
// test/net/eliteGates/law9_proofs.test.js. Not a DFU member. Ledger A (ELITE-GATES).
import { egRouteOf } from './egRoute.js';

/** THE ASCENT's spec law: from it a hall with a route is proven over THE ROUTE (net/eliteGates/egLaw.js EG_ASCENT_LAW, net/eliteGates/egWalkGraph.js
 *  EG_HEIGHT_LAW - pinned equal). */
export const EG_ROUTE_PROOF_LAW = 9;
/** A spec's law: its own `law` (spec law 9 says it), else its `v` (every spec law's number since spec law 4). */
const lawOf = (spec) => spec?.law ?? spec?.v ?? 0;
/** Is hall `spec` proven over its route - a hall of THE ASCENT's law whose spec lays a route THE ROUTE reads? Every hall of the
 *  laws before is proven by z, as it was. */
export const egRouted = (/** @type {any} */ spec) => lawOf(spec) >= EG_ROUTE_PROOF_LAW && egRouteOf(spec).line === 0;

// ── THE CLIMBING MOTOR'S NUMBERS (player/parkour.js, player/motor.js - restated, pinned equal) ─────────────────────────
/** THE SPAN BUILD's free climb (m/s): parkour.js freeClimbSpeed(walkSpeed(10), 0) - the classic climb's Speed / 3 (climbing.js
 *  climbingSpeed) over the walk of Speed 10 (motor.js walkSpeed: (10 + 150 - 0.5 x (100 - 30)) / 39.5), at Climbing 0's share
 *  (PARKOUR_CLIMB_MIN 0.7). The pace of a body that walked to the face - the slowest the build climbs (one that ran into it
 *  climbs at the run's, 1.28 m/s): the grip is proven at it, and the crossing timed at it (net/eliteGates/egRoomLaw.js EG_CLIMB_MMPS). */
export const EG_CLIMB_MPS = ((10 + 150 - 0.5 * (100 - 30)) / 39.5 / 3) * 0.7;
/** The free climb holds the lip that comes to its hands within the hang's drop (parkour.js PARKOUR_HANG_DROP 1.8) and 4 cm of
 *  the feet (motor.js _freeClimbStep's `level`): a pitch's wall is climbed for its height less this (m). */
export const EG_CLIMB_HANG_M = 1.8 + 0.04;
/** Forward held against the face this long starts the free climb (s - parkour.js freeStartSeconds(0)): on the floor, the grip
 *  unspent (and coming back). */
export const EG_CLIMB_START_S = 0.6;
/** THE GRIP at Climbing 0 with fatigue spent (s - parkour.js gripSeconds(0, 0): PARKOUR_GRIP_MIN_S 6 x PARKOUR_GRIP_TIRED
 *  0.35), and how long a whole grip takes to come back with the feet on a floor (PARKOUR_GRIP_REGEN_S). */
export const EG_GRIP_S = 6 * 0.35;
export const EG_GRIP_REGEN_S = 2.5;
/** The proof's margin on the grip (s): the closed form says a pitch of 3.39 m on a spent grip at THE SPAN BUILD's climb, the
 *  real motor climbs 3.37 and falls from 3.38 (the frames' step - a sixtieth of a second, 1.2 cm, and the catch's own); a
 *  pitch is proven with this to spare - 3.32 m the longest. */
export const EG_GRIP_SLACK_S = 0.1;
/** A rest ledge stands a body (m deep): the mantle lands it a body's radius and PARKOUR_TOP_INSET past the lip, or in the
 *  middle of a narrow top, and the next face stands behind it - measured on the motor, 0.8 m stands a body and 0.6 does not.
 *  A ledge said shallower rests nobody, and the pitches either side of it are one. */
export const EG_CLIMB_LEDGE_MIN_M = 0.8;
/** THE MANTLE's seconds (parkour.js mantleDuration): longer the higher the lip, a third quicker at Climbing 100 than at 0. */
export const egMantleS = (/** @type {number} */ rise, /** @type {number} */ skill) => (0.25 + 0.22 * Math.max(0, rise)) * (1.3 - 0.5 * Math.min(1, Math.max(0, skill / 100)));
/** THE FAST BUILD's climb over its run (m/s per m/s): climbing.js climbingSpeed's Speed / 3, doubled under the Climbing spell,
 *  CLIMB-PAST's x1.4 at the effective cap (systems/skillSoftcap.js overcapClimbSpeed), Climbing 100's share (PARKOUR_CLIMB_MAX
 *  1.3) - the fastest a body climbs (parkour.js freeClimbSpeed(run, 100, true, the cap)). */
export const EG_FAST_CLIMB_X = (2 * 1.4 * 1.3) / 3;
/** A Drop on a proven road falls at most this (m - motor.js FALL_DAMAGE_THRESHOLD: a fall past it is billed). */
export const EG_ROUTE_FALL_MAX_M = 5;
/** A stair rises at most this a metre of plan (45 degrees - the motor's cos^2 law is measured to it; net/eliteGates/egRoomLaw.js lays
 *  3 in 5). */
export const EG_ROUTE_STAIR_MAX = 1;
/** THE FAST BUILD runs down a stair at most this many times its run in plan (measured: 1.42 the most - Speed 10's walk down 31
 *  degrees; 1.07 the fast build's run). */
export const EG_STAIR_DOWN_X = 1.5;
/** A span link's course: the pieces of its road standing within this of its line across (m - a passage's ledges, the Low
 *  Road's own line; net/eliteGates/egLaw.js lays a run's pieces within 2 m of one another) and this under and over its ends (a Drop's
 *  fall, a riser's rise). */
export const EG_ROUTE_COURSE_SIDE_M = 4;
export const EG_ROUTE_COURSE_RISE_M = 5;
/** A climb link's climb: the face its foot stands within this of in plan (m - the fair trail's EG_CLIMB_NEAR_M), its foot's and
 *  its lip's heights within this of the link's ends (m). */
export const EG_ROUTE_CLIMB_NEAR_M = 3;
export const EG_ROUTE_CLIMB_Y_M = 0.6;

const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const max0 = (v) => (v > 0 ? v : 0);

// ── A CLIMB ───────────────────────────────────────────────────────────────────────────────────────────────────
/** The squared distance in plan from (x, z) to the segment (ax, az)-(bx, bz). */
function segD2(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz, u = L2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)) : 0;
  const ex = x - (ax + dx * u), ez = z - (az + dz * u);
  return ex * ex + ez * ez;
}
/**
 * A CLIMB LINK'S CLIMB (`spec.climbs`): the one the link names (`climb`, its number), else the climb whose face its lower end
 * stands within EG_ROUTE_CLIMB_NEAR_M of in plan, its foot and its lip within EG_ROUTE_CLIMB_Y_M of the link's ends' heights -
 * the nearest; or null. Pure.
 * @param {any} spec @param {any} link @param {number[]} lo the link's lower end @param {number[]} hi its upper end
 */
export function egRouteClimbOf(spec, link, lo, hi) {
  const all = spec?.climbs ?? [];
  if (Number.isInteger(link?.climb) && all[link.climb]) return all[link.climb];
  let best = null, bd = EG_ROUTE_CLIMB_NEAR_M * EG_ROUTE_CLIMB_NEAR_M;
  for (const c of all) {
    if (!c || !fin(c.y0) || !fin(c.y1)) continue;
    if (Math.abs(c.y0 - lo[1]) > EG_ROUTE_CLIMB_Y_M || Math.abs(c.y1 - hi[1]) > EG_ROUTE_CLIMB_Y_M) continue;
    const d = segD2(lo[0], lo[2], c.x0, c.z0, c.x1, c.z1);
    if (d <= bd) { bd = d; best = c; }
  }
  return best;
}
/** A CLIMB'S PITCHES (m, foot to lip): its heights between its foot, its rest ledges (those strictly between, each a floor -
 *  none when the climb says its ledges shallower than EG_CLIMB_LEDGE_MIN_M) and its lip. */
export function egClimbPitches(/** @type {any} */ c) {
  const rests = fin(c.d) && c.d < EG_CLIMB_LEDGE_MIN_M ? [] : (c.ledges ?? []).filter((y) => fin(y) && y > c.y0 && y < c.y1);
  const ys = [c.y0, ...[...new Set(rests)].sort((a, b) => a - b), c.y1], out = [];
  for (let k = 1; k < ys.length; k++) out.push(ys[k] - ys[k - 1]);
  return out;
}
/** A pitch's time on the wall (s): its height less the hang's reach at climb `climb` (m/s - THE SPAN BUILD's by default). */
export const egPitchWallS = (/** @type {number} */ H, climb = EG_CLIMB_MPS) => max0(H - EG_CLIMB_HANG_M) / climb;
/**
 * THE GRIP'S PROOF of a climb: '' when every pitch is climbed on a fresh grip at Climbing 0 with fatigue spent - its wall
 * (egPitchWallS at THE SPAN BUILD's climb) at most EG_GRIP_S less EG_GRIP_SLACK_S - else why not. Pure.
 * @param {any} c
 */
export function egClimbGrip(c) {
  if (!c) return 'a climb with no face to climb';
  if (!(c.y1 > c.y0)) return `a climb from ${c.y0} m to ${c.y1} m`;
  for (const H of egClimbPitches(c)) {
    const wall = egPitchWallS(H);
    if (wall > EG_GRIP_S - EG_GRIP_SLACK_S) return `a pitch of ${H.toFixed(2)} m holds the wall ${wall.toFixed(2)} s, past the grip at Climbing 0 with fatigue spent (${EG_GRIP_S.toFixed(1)} s less ${EG_GRIP_SLACK_S})`;
  }
  return '';
}

// ── A ROAD'S LEGS ─────────────────────────────────────────────────────────────────────────────────────────────
/**
 * @typedef {{ i: number, kind: string, road: number, from: number[], to: number[], rise: number, plan: number, len: number,
 *   climb: any, steps: any[], z0: number, z1: number }} Leg
 */
/** @type {WeakMap<object, Leg[][]>} */
const _legs = new WeakMap();
/** THE STEPS A SPAN LINK CROSSES: its road's pieces (an alcove's side way's never) whose rest stands between its ends along z,
 *  within EG_ROUTE_COURSE_SIDE_M of its line across and EG_ROUTE_COURSE_RISE_M of its ends' heights - in the hall's count. */
export function egRouteSpanSteps(/** @type {any} */ spec, /** @type {number[]} */ A, /** @type {number[]} */ B, road = 0) {
  const z0 = Math.min(A[2], B[2]), z1 = Math.max(A[2], B[2]), y0 = Math.min(A[1], B[1]) - EG_ROUTE_COURSE_RISE_M, y1 = Math.max(A[1], B[1]) + EG_ROUTE_COURSE_RISE_M;
  const dz = B[2] - A[2], dx = B[0] - A[0];
  // (THE BROKEN WAY - spec law 10: a link along x - a broken bridge turned - takes the pieces along its line across x)
  if (dz === 0 && dx !== 0) {
    const x0 = Math.min(A[0], B[0]), x1 = Math.max(A[0], B[0]);
    return (spec?.steps ?? []).filter((s) => (s.road ?? 0) === road && s.hd % 2 === 1 && s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1 && Math.abs(s.z - A[2]) <= EG_ROUTE_COURSE_SIDE_M);
  }
  return (spec?.steps ?? []).filter((s) => {
    if ((s.road ?? 0) !== road || s.hd % 2 === 1 || s.z < z0 || s.z > z1 || s.y < y0 || s.y > y1) return false;   // (THE AUDIT: a link along z takes no piece turned along x)
    const x = dz !== 0 ? A[0] + ((B[0] - A[0]) * (s.z - A[2])) / dz : A[0];
    return Math.abs(s.x - x) <= EG_ROUTE_COURSE_SIDE_M;
  });
}
/**
 * A ROUTED HALL'S ROAD AS ITS LEGS (`road` 0 the main way, 1 THE FORK's other): each link of its path in order, taken from the
 * node it is reached at to the next - `{ i, kind, road, from, to, rise, plan, len, climb, steps, z0, z1 }`: the link's number,
 * kind and road, its ends as walked (m), its rise, its plan, its walked length (`len`, else its length in space), a climb
 * link's climb (egRouteClimbOf), a span link's pieces (egRouteSpanSteps) and the z it enters and leaves its course at. Kept
 * per spec. Pure.
 * @param {any} spec @param {number} [road]
 * @returns {Leg[]}
 */
export function egRouteLegs(spec, road = 0) {
  let kept = _legs.get(spec);
  if (!kept) {
    const R = egRouteOf(spec);
    kept = [0, 1].map((r) => R.ways[r].map((i, k) => {
      const l = R.links[i], from = R.nodes[R.paths[r][k]], to = R.nodes[R.paths[r][k + 1]];
      const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2], plan = Math.sqrt(dx * dx + dz * dz);
      const kind = l.kind ?? 'walk', len = fin(l.len) && l.len >= 0 ? l.len : Math.sqrt(dx * dx + dy * dy + dz * dz), lr = Math.max(0, Math.min(2, (l.road ?? 0) | 0));
      const lo = dy >= 0 ? from : to, hi = dy >= 0 ? to : from;
      return { i, kind, road: lr, from, to, rise: dy, plan, len, climb: kind === 'climb' ? egRouteClimbOf(spec, l, lo, hi) : null,
        steps: kind === 'span' ? egRouteSpanSteps(spec, from, to, lr) : [], z0: Math.min(from[2], to[2]), z1: Math.max(from[2], to[2]) };
    }));
    _legs.set(spec, kept);
  }
  return kept[road === 1 ? 1 : 0];
}
/** THE ROADS A ROUTED HALL PROVES: the main way, and THE FORK's other where the route lays a way of its own (a road-1 link on
 *  its path) - a side way (road 2) is never proven nor required. */
export function egRouteRoads(/** @type {any} */ spec) {
  return egRouteLegs(spec, 1).some((g) => g.road === 1) ? [0, 1] : [0];
}

// ── A LEG'S LAW ───────────────────────────────────────────────────────────────────────────────────────────────
/**
 * WHY A LEG IS NO WAY on a proven road ('' - it is): a kind the route does not know; a stair steeper than EG_ROUTE_STAIR_MAX;
 * a Drop taken upward or past EG_ROUTE_FALL_MAX_M; a climb taken downward, with no face, or past the grip (egClimbGrip). Pure.
 * @param {Leg} g
 */
export function egLegRefusal(g) {
  const h = Math.abs(g.rise);
  if (g.kind === 'walk' || g.kind === 'bridge' || g.kind === 'span') return '';
  if (g.kind === 'stair') {
    const plan = Math.sqrt(max0(g.len * g.len - h * h));
    return h > EG_ROUTE_STAIR_MAX * plan + 1e-9 ? `a stair of ${h.toFixed(2)} m over ${plan.toFixed(2)} m, steeper than the motor walks` : '';
  }
  if (g.kind === 'drop') return g.rise > 1e-9 ? 'a Drop taken upward' : h > EG_ROUTE_FALL_MAX_M ? `a Drop of ${h.toFixed(2)} m, past the ${EG_ROUTE_FALL_MAX_M} m a fall is billed at` : '';
  if (g.kind === 'climb') return g.rise < -1e-9 ? 'a climb taken downward' : egClimbGrip(g.climb);
  return `a link of kind '${g.kind}'`;
}
/**
 * A CLIMB'S SECONDS at build `B`: its plan run, and each pitch's start (`B.start`), wall (at `B.climb`) and mantle (`B.mantle`)
 * - on each rest ledge, at THE SPAN BUILD (`B.rest`), the grip the pitch before spent come back first. A climb with no face is
 * one pitch of its rise. Pure.
 * @param {Leg} g @param {any} B
 */
export function egClimbSeconds(g, B) {
  const P = g.climb ? egClimbPitches(g.climb) : [max0(g.rise)];
  let s = g.plan / B.run;
  P.forEach((H, k) => {
    if (k > 0 && B.rest) s += (egPitchWallS(P[k - 1]) / EG_GRIP_S) * EG_GRIP_REGEN_S;
    s += B.start + max0(H - EG_CLIMB_HANG_M) / B.climb + B.mantle(H);
  });
  return s;
}
/** The grip a climb's last pitch leaves spent, as the seconds it takes to come back (THE SPAN BUILD; 0 for any other leg). */
export const egLegGripOwed = (/** @type {Leg} */ g) => {
  if (g.kind !== 'climb') return 0;
  const P = g.climb ? egClimbPitches(g.climb) : [max0(g.rise)];
  return (egPitchWallS(P[P.length - 1]) / EG_GRIP_S) * EG_GRIP_REGEN_S;
};
/**
 * A LEG'S SECONDS at build `B` by its kind's law (a span leg: its walked length at the run - THE TIMED SOLVER adds its waits,
 * net/eliteGates/egSpanLaw.js): a walk and a bridge at the run; a stair up at the motor's cos^2 pace, down at `B.down` x the run and
 * never under its fall; a Drop its plan at the run and never under its fall; a climb by egClimbSeconds. Pure.
 * @param {Leg} g @param {any} B
 */
export function egLegSeconds(g, B) {
  const h = Math.abs(g.rise), fall = Math.sqrt((2 * h) / B.g);
  if (g.kind === 'stair') {
    const plan = Math.sqrt(max0(g.len * g.len - h * h));
    if (g.rise >= 0) return plan > 0 ? (plan * plan + h * h) / (plan * B.run) : Infinity;
    return Math.max(plan / (B.run * B.down), fall);
  }
  if (g.kind === 'drop') return Math.max(g.plan / B.run, fall);
  if (g.kind === 'climb') return egClimbSeconds(g, B);
  return g.len / B.run;
}
