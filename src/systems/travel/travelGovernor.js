// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TV2 - THE LOAD GOVERNOR (bible/06-Systems/Travel-View.md).
//
// Mac's call on the speed: "Cap it to what loads cleanly." From the
// travel view a journey is WATCHED - the ground two and three leagues
// ahead is on the screen - and Travel Options will drive a traveller at
// up to a hundred times walking pace, faster than the streaming grid
// raises the pixels in front of them. Unbuilt ground from the air is a
// hole in the world, which is exactly what "cleanly" rules out.
//
// THE CAP IS MEASURED, ON THE PLAYER'S OWN MACHINE, EVERY JOURNEY. The
// design (TV0) said a probe would ride a long road and find the highest
// clean rate; the probe needs ARENA2, CI has none, and one number
// measured on one machine is the wrong answer on every slower one. So
// the measurement runs live instead: while the view is up and a journey
// drives, the host counts the pixels of the grid that it has not built -
// every ring but the outermost (AUDIT DEEP2 B-2: once the view's reach,
// measured down the top edge's middle, which missed the picture's
// corners) - and, of those, only the ones the stream is still building
// (LOAD-OWED: a pixel whose build threw is let go by the stream, and a
// count that kept it held the clock at x1 with nothing loading). Any for
// TV_GOV_HOLD_S and the ceiling HALVES (to a
// multiple of five, Travel Options' own spinner step - timeScale.js
// accelLimitOf), and again only after TV_GOV_SETTLE_S more (AUDIT DEEP2
// B-2); none for TV_GOV_CLEAR_S and it climbs back a step
// toward what the player asked for. Walking pace (x1) is the floor - the
// governor slows a journey, it never stops one (the ground gate,
// systems/travel/travelAutopilot.js travelDriveForward, already holds the feet
// at the edge of a hole).
//
// The spinner is the player's; the governor only CLAMPS what reaches
// the clock, and the travel panel says so ("x20 of x40").
//
// PURE: a clock and a count in, a ceiling out.
// ═══════════════════════════════════════════════════════════════════

/** How long unbuilt ground may stand in the view before the ceiling halves (s, real time). */
export const TV_GOV_HOLD_S = 0.25;
/** AUDIT DEEP2 B-2: after a cut, how long the hole must stay before the NEXT cut (s, real time) - the rate just cut needs
 *  time to show in the build; cutting again every TV_GOV_HOLD_S took x40 to x1 inside a second while one pixel built.
 *  In a toy of the host's own queue (reviewer B's, AUDIT DEEP2) 2 s gave the best clean average and half the time at x1
 *  of 1 s or none. The ordinary TV_GOV_HOLD_S returns after the next climb. */
export const TV_GOV_SETTLE_S = 2;
/** How long the view must stay clean before the ceiling climbs a step (s, real time). */
export const TV_GOV_CLEAR_S = 4;
/** A climb's step - Travel Options' own spinner step. */
export const TV_GOV_STEP = 5;
/** The floor: walking pace. */
export const TV_GOV_FLOOR = 1;

/** Down to a multiple of TV_GOV_STEP, never under the floor. */
export const stepDown = (n) => Math.max(TV_GOV_FLOOR, Math.floor(n / TV_GOV_STEP) * TV_GOV_STEP);

/**
 * @param {{ max?: number }} [opts] - the ceiling's top (timeScale.js MAX_TIME_SCALE)
 */
export function createLoadGovernor({ max = 100 } = {}) {
  let ceiling = max;
  let dirty = 0;
  let clear = 0;
  let settling = false;   // AUDIT DEEP2 B-2: a cut made, no climb since - the next cut waits TV_GOV_SETTLE_S
  return {
    get ceiling() { return ceiling; },
    /**
     * One frame: `dt` REAL seconds (the clock the player waits on, not the accelerated one), `unbuilt` the pixels in
     * the view's reach not yet built, `requested` the spinner's rate. Returns the rate the clock may run at.
     */
    step(dt, { unbuilt = 0, requested = 1 } = {}) {
      const want = Math.max(TV_GOV_FLOOR, requested);
      if (unbuilt > 0) {
        clear = 0;
        dirty += dt;
        // AUDIT DEEP T2-2: nothing is learned at walking pace - streaming's ordinary lag at x1 taught a ceiling of 1, and
        // the next journey's x40 then climbed from it for half a minute of clean view
        if (dirty >= (settling ? TV_GOV_SETTLE_S : TV_GOV_HOLD_S)) { if (want > TV_GOV_FLOOR) { ceiling = stepDown(Math.min(ceiling, want) / 2); settling = true; } dirty = 0; }
      } else {
        dirty = 0;
        if (ceiling < max) {
          clear += dt;
          // AUDIT DEEP T2-8: up the spinner's own steps - 1, 5, 10, 15 (it went 1, 6, 11)
          if (clear >= TV_GOV_CLEAR_S) { ceiling = Math.min(max, Math.floor(ceiling / TV_GOV_STEP) * TV_GOV_STEP + TV_GOV_STEP); clear = 0; settling = false; }
        }
      }
      return Math.min(want, ceiling);
    },
    /** A new journey, or the view gone: the ceiling forgets. */
    reset() { ceiling = max; dirty = 0; clear = 0; settling = false; },
  };
}

/**
 * THE VIEW'S REACH over flat ground, metres from the traveller: how far off the top edge of the picture meets the
 * ground from `height` up at `pitch` (radians, negative down) with a vertical field of `fovY`. The top edge at or
 * above the horizon sees as far as the grid reaches (`far`).
 */
export function viewReach({ height, pitch, fovY, back = 0, far = Infinity }) {
  const top = pitch + fovY / 2;
  if (top >= -1e-3) return far;
  return Math.min(far, height / Math.tan(-top) - back);
}

/** The pixels whose squares lie within `radius` (Chebyshev) of `center` that `isBuilt` says are not - the count the
 *  governor reads. LOAD-OWED: the host's `isBuilt` answers true for a pixel nothing is building, so the count is what the
 *  stream still owes (scenes/world.js travelViewGovern). */
export function unbuiltAround(center, radius, isBuilt) {
  let n = 0;
  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) if (!isBuilt(x, y)) n++;
  }
  return n;
}
