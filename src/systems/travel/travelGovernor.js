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
    step(dt, { unbuilt = 0, requested = 1, owed = null, feet = null, speedMps = 0 } = {}) {
      const want = Math.max(TV_GOV_FLOOR, requested);
      // OW-LEAD: handed the pixels owed and where the traveller stands, the cap is how NEAR the nearest of them is - the
      // halving below is what it replaces on the host (and still answers a bare count)
      if (owed) { ceiling = max; dirty = 0; clear = 0; settling = false; return Math.min(want, leadCap(owedMetres(feet, owed), speedMps)); }
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

/** PERF-TV: the host's record of its last count - what it counted (`gen`, the pixel `x`/`y`, the `radius`), the count
 *  `n`, and OW-LEAD's `owed`, the pixels themselves (unbuiltAround's `out`). Made here, beside the count it keeps, so the
 *  host holds one line of it (HOST-SPLIT, at the merge of LAYERED-GEAR). */
export const unbuiltCount = () => ({ gen: -1, x: NaN, y: NaN, r: -1, n: 0, owed: [] });

/** The pixels whose squares lie within `radius` (Chebyshev) of `center` that `isBuilt` says are not - the count the
 *  governor reads. LOAD-OWED: the host's `isBuilt` answers true for a pixel nothing is building, so the count is what the
 *  stream still owes (scenes/world.js travelViewGovern). OW-LEAD: `out`, when handed, is emptied and then gets each of
 *  them as [x, y] - the host's list of the owed pixels themselves (`uc.owed`; the cap is how near the nearest is). */
export function unbuiltAround(center, radius, isBuilt, out = null) {
  if (out) out.length = 0;
  let n = 0;
  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) if (!isBuilt(x, y)) { n++; out?.push([x, y]); }
  }
  return n;
}

// ═══════════════════════════════════════════════════════════════════
// OW-LEAD (2026-10-17, the player: "the overworld travel randomly slows down from speed multiplier even without enemies
// nearby ... it almost always [goes] down to 1x and after a while it goes up again"). THE LAND'S HOLD IS HOW NEAR THE
// HOLE IS, NOT HOW LONG IT HAS STOOD. The halving above cut the clock again every TV_GOV_SETTLE_S while ANY pixel of the
// counted grid was still building - and a slower clock builds nothing faster, so a crossing's row that took the pump
// eight seconds (a town or two in it: a second or more each) took every journey from x100 to x1 (50, 25, 10, 5, 1), and
// the climb back is a step every TV_GOV_CLEAR_S - eighty seconds to x100, and the next crossing's row did it again.
// What slowing buys is the traveller NOT REACHING a pixel before it stands: so the clock is held to the rate at which
// the traveller, at their own pace, takes TV_GOV_LEAD_S of real time or more to reach the nearest owed pixel's square
// (OW6's law for an enemy's reach, travelThreat.js threatCap, with the stream's books for the enemies). A row two pixels
// out holds a rider to x25, never to a crawl; the nearer the hole, the slower, down to walking pace at its edge; and
// the hold is gone the frame the last build stands.
// ═══════════════════════════════════════════════════════════════════
/** Real seconds the traveller always has before the nearest pixel the stream still owes. 4: run on the host's own code
 *  (test/systems/travel/ow_lead.test.js) over builds of 0.3 - 3 s each, a rider and a walker, it kept nearly every bit of 2's pace where
 *  the builds are quick and, where they are slow (a slow machine), held a deep queue off the traveller - no hole met, a
 *  few seconds at walking pace where 2 had most of a minute. */
export const TV_GOV_LEAD_S = 4;
const PIXEL_N = 32768;   // native units a map pixel (streamingWorld.js NATIVE_PIXEL)
const N_PER_M = PIXEL_N / 819.2;   // native units a metre
/** Metres from `feet` (native world {x, z}, StreamingWorldState.worldCoords) to the nearest square of `owed` ([x, y] map
 *  pixels; y counts north from 499, streamingWorld.js worldCoordToMapPixel): 0 inside one, Infinity with none. */
export function owedMetres(feet, owed) {
  if (!owed?.length) return Infinity;
  if (!feet) return 0;
  let best = Infinity;
  for (const [x, y] of owed) {
    const x0 = x * PIXEL_N, z0 = (499 - y) * PIXEL_N;
    const dx = Math.max(x0 - feet.x, 0, feet.x - (x0 + PIXEL_N)), dz = Math.max(z0 - feet.z, 0, feet.z - (z0 + PIXEL_N));
    best = Math.min(best, Math.hypot(dx, dz));
  }
  return best / N_PER_M;
}
/** The highest rate at which `metres` takes `leadS` real seconds or more at `speedMps` (the motor's own pace) - on the
 *  spinner's ladder (1, 2, 3, 4, 5, then fives), never under walking pace; Infinity with no owed pixel or no pace. */
export function leadCap(metres, speedMps, leadS = TV_GOV_LEAD_S) {
  if (!Number.isFinite(metres) || !(speedMps > 0)) return Infinity;
  const n = metres / (speedMps * leadS);
  return n >= TV_GOV_STEP ? Math.floor(n / TV_GOV_STEP) * TV_GOV_STEP : Math.max(TV_GOV_FLOOR, Math.floor(n));
}
