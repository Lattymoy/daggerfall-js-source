// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF7 (2026-09-29, Mac: "Do it") - HUNTING'S ACT, the Skinning Knife at
// a body the player's own blow felled, as a machine the host feeds a
// frame at a time (bible/06-Systems/Professions-Arc.md 5.2, 29; FORAGE0
// 14.4). Pure: the host hands in the frame's time, whether E is held
// (`held` - the use key, as the Sickle's steady hand holds it: attack held
// would be the weapon's, and DFU's swing modes hold the look still under
// it), and where the crosshair points on the carcass - `aim`, the view's
// bearing from the body's centre in degrees ({ yaw, pitch }), as the
// Pick-Axe's glint reads it (systems/mineAct.js); the machine answers
// where the act stands and, at its end, the report the harvest carries.
//
//   THE LINE. A dotted line of professionLaw tracePoints(tier) points (5
//   at tier 1 to 9) across the carcass, a zigzag its own each act.
//   THE TRACE. E held with the crosshair within TRACE_ACT.startDeg of the
//   first point starts it; held, the crosshair draws the knife
//   along the line, each point passed in its turn, to the last. Let go
//   before the last and the trace starts again (a slip). The crosshair,
//   not a cursor: the mouse, the right stick and a finger's swipe all
//   turn the view, so one trace serves the three (PROF0 5.2).
//   THE SCORE. 1 less the mean deviation from the line over the
//   tolerance (professionLaw traceTolerance: TRACE_ACT.tolDeg at Novice,
//   half again at Master, x the knife's band) - the deviation measured
//   along the line the crosshair drew, every TRACE_ACT.stepDeg of the
//   trace's PROGRESS (AUDIT 30 A1's law, the plane's: a jump between two
//   frames is scored along its chord). The line runs left to right, so
//   the progress is the yaw: AUDIT 32 L1 - a frame held still, a jitter or
//   a wiggle back over ground already drawn adds nothing, and the clock
//   starts at the first move along the line, not at the press. It counted
//   every frame as a sample and started at the press, so a press held
//   still on the first point and one flick to the last was a clean pelt
//   (97% of lines after a second's rest), and a hand's score hung on its
//   frame rate. A trace scoring TRACE_ACT.clean or more, drawn in minS to
//   maxS, is a CLEAN PELT; under TRACE_ACT.torn it is TORN. Neither fails
//   the harvest (PROF0 5.1: a missed moment gives less, never nothing).
//
// GENTLE ACTS (a setting, accessibility - PROF0 5.1): E held for
// TRACE_ACT.gentleS completes it plainly - no line to draw, no clean pelt,
// no tear.
//
// Esc (the host's `cancel`) ends it, nothing lost: the body lies, no tool
// wears, no harvest is asked.
// ═══════════════════════════════════════════════════════════════════
import { TRACE_ACT, tracePoints, traceTolerance } from '../net/professionLaw.js';

/** The angular distance between two bearings, degrees. @param {{ yaw: number, pitch: number }} a @param {readonly number[]} p */
const off = (a, p) => Math.hypot(a.yaw - p[0], a.pitch - p[1]);
/** The distance from (x, y) to the segment a-b, degrees. */
function toSegment(x, y, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}
/** The distance from (x, y) to the line through `points`, degrees. @param {readonly (readonly number[])[]} points */
export function toLine(x, y, points) {
  let d = Infinity;
  for (let i = 1; i < points.length; i++) d = Math.min(d, toSegment(x, y, points[i - 1], points[i]));
  return points.length === 1 ? Math.hypot(x - points[0][0], y - points[0][1]) : d;
}
/** A trace's line of `n` points: across the span left to right, the pitch a zigzag drawn by `rng`. */
export function traceLine(n, rng = Math.random) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = -TRACE_ACT.spanYawDeg / 2 + (TRACE_ACT.spanYawDeg * i) / Math.max(1, n - 1);
    out.push(Object.freeze([x, (rng() * 2 - 1) * TRACE_ACT.spanPitchDeg]));
  }
  return Object.freeze(out);
}

/**
 * @param {{ tier: number, rank?: number, band?: number, gentle?: boolean, rng?: () => number }} o `band` the knife's
 *   attribute band's widening (professionLaw knifeBand)
 */
export function createTraceAct({ tier, rank = 0, band = 1, gentle = false, rng = Math.random }) {
  const points = traceLine(tracePoints(tier), rng);
  const endYaw = points[points.length - 1][0];
  const st = {
    kind: 'trace',
    points,
    tol: traceTolerance(rank, band),
    gentle,
    t: 0,
    done: false,
    cancelled: false,
    /** the trace under way: started at the first point, its clock (its first move along the line - AUDIT 32 L1), the
     *  points passed (the index of the last), the furthest yaw the deviations have measured, the deviations */
    tracing: false,
    t0: /** @type {number|null} */ (null),
    reached: 0,
    far: 0,
    devs: /** @type {number[]} */ ([]),
    /** where the crosshair was last frame, and the path drawn this trace (the meter's) */
    last: /** @type {{ yaw: number, pitch: number }|null} */ (null),
    path: /** @type {number[][]} */ ([]),
    aim: /** @type {{ yaw: number, pitch: number }|null} */ (null),
    /** traces let go before the last point; Gentle acts' hold; the finished trace's measure */
    slips: 0,
    held: 0,
    score: 0,
    seconds: 0,
  };
  const reset = () => {
    st.tracing = false;
    st.t0 = null;
    st.devs = [];
    st.reached = 0;
    st.last = null;
    st.path = [];
  };
  /**
   * The crosshair drawn from `a` to `b`: the points passed in turn (the chord's nearest approach to each next point), and
   * the deviation every stepDeg of NEW progress along the chord - the yaw past the furthest measured, to the line's end
   * (AUDIT 32 L1, the plane's law; and L5: a chord across the world walks no further than the line).
   */
  function draw(a, b, step) {
    const pa = [a.yaw, a.pitch],
      pb = [b.yaw, b.pitch];
    for (
      let next = points[st.reached + 1];
      next && toSegment(next[0], next[1], pa, pb) <= TRACE_ACT.startDeg;
      next = points[st.reached + 1]
    )
      st.reached++;
    const hi = Math.min(b.yaw, endYaw);
    if (hi > st.far) {
      if (st.t0 == null) st.t0 = st.t - step; // the first move along the line starts the clock: the frame it began in
      const lo = st.far,
        n = Math.ceil((hi - lo) / TRACE_ACT.stepDeg - 1e-9);
      for (let i = 1; i <= n; i++) {
        const x = lo + ((hi - lo) * i) / n;
        const y = b.yaw === a.yaw ? b.pitch : a.pitch + ((b.pitch - a.pitch) * (x - a.yaw)) / (b.yaw - a.yaw);
        st.devs.push(toLine(x, y, points));
      }
      st.far = hi;
    }
    if (b.yaw !== a.yaw || b.pitch !== a.pitch) st.path.push(pb);
  }
  return {
    state: st,
    /** How far the trace has come, 0 to 1 - the points passed against the line's. */
    get progress() {
      return st.done
        ? 1
        : gentle
          ? Math.min(1, st.held / TRACE_ACT.gentleS)
          : st.reached / Math.max(1, points.length - 1);
    },
    /**
     * One frame. `held` - E held; `aim` - the crosshair's bearing from the body's centre, degrees.
     * @param {number} dt @param {{ held?: boolean, aim?: { yaw: number, pitch: number }|null }} input
     */
    tick(dt, { held = false, aim: given = null } = {}) {
      if (st.done || st.cancelled) return;
      const step = Math.max(0, Math.min(0.25, Number(dt) || 0));
      st.t += step;
      // AUDIT 32 L5: a bearing that is not a number is no bearing (it hung the chord's walk, or dropped its samples)
      const aim = given && Number.isFinite(given.yaw) && Number.isFinite(given.pitch) ? given : null;
      st.aim = aim;
      if (gentle) {
        st.held = held ? st.held + step : 0;
        if (st.held >= TRACE_ACT.gentleS) st.done = true;
        return;
      }
      if (!st.tracing) {
        if (held && aim && off(aim, points[0]) <= TRACE_ACT.startDeg) {
          st.tracing = true;
          st.t0 = null;
          st.far = aim.yaw;
          st.devs = [toLine(aim.yaw, aim.pitch, points)];
          st.reached = 0;
          st.last = aim;
          st.path = [[aim.yaw, aim.pitch]];
        }
        return;
      }
      if (!held || !aim) {
        reset();
        st.slips++;
        return;
      } // let go before the last point: start again
      draw(/** @type {{ yaw: number, pitch: number }} */ (st.last), aim, step);
      st.last = aim;
      if (st.reached >= points.length - 1) {
        st.done = true;
        st.tracing = false;
        st.seconds = st.t - (st.t0 ?? st.t);
        const dev = st.devs.reduce((s, d) => s + d, 0) / st.devs.length;
        st.score = Math.max(0, 1 - dev / st.tol);
      }
    },
    /** Esc: ended, nothing lost. */
    cancel() {
      st.cancelled = true;
      st.tracing = false;
    },
    /** The act's report, once it is done: `{ score, clean, torn, seconds, slips }`. */
    report() {
      if (!st.done) return null;
      if (gentle) return { score: 0, clean: false, torn: false, seconds: 0, slips: 0 };
      const steady = st.seconds >= TRACE_ACT.minS && st.seconds <= TRACE_ACT.maxS;
      return {
        score: Math.round(st.score * 100) / 100,
        clean: steady && st.score >= TRACE_ACT.clean,
        torn: st.score < TRACE_ACT.torn,
        seconds: st.seconds,
        slips: st.slips,
      };
    },
  };
}
