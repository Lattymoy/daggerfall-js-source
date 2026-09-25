// PERF7 - THE STREAM BUILD BREATHES (2026-09-11). A streamed pixel is
// built by an async function that awaits per model, and an await on a
// promise that is already settled continues as a MICROTASK - it never
// gives the frame back. On a cold load the fetches are real and the
// build spreads itself; on a warm one (every model cached, which is
// every pixel after the first few) a city pixel's whole loop - three
// thousand models, each a collider insert of hundreds of triangles -
// runs in one task, and the frame loop waits hundreds of milliseconds
// for it. That is the hitch on the road into a town.
//
// The breather is a cooperative yield: the build calls it between
// models, and when the current slice has used its budget it awaits the
// next animation frame - the frame loop runs, draws, and the build
// resumes after. The pixel appears a few frames later than it would
// have and every frame in between is drawn. Nothing about the pixel
// changes; a partially built pixel is not in `built` and draws
// nothing, as a cold-load pixel never did either.
//
// Pure in its seams: the clock and the frame request are injected so
// test/perf7.test.js can drive it.

/** Milliseconds of build work a frame lends before the yield. Under a
 *  16.7 ms frame this leaves the draw its share; the pixel arrives a
 *  little later, and the road is smooth. */
export const BUILD_SLICE_MS = 6;

/** PERF-EXT-C5: the least a slice lends while the frame is heavy - the
 *  prover's floor, not the hunter's 1 ms, so the stream keeps half its
 *  pace at worst. */
export const BUILD_SLICE_FLOOR_MS = 3;
/** PERF-EXT-C5: what a frame keeps for itself past its own script - the
 *  browser's share of the rendering opportunity. */
export const BUILD_SLICE_MARGIN_MS = 2.5;
/** PERF-EXT-C5: a stream that has been at it this long gets the whole
 *  slice again - the bound on how much later a pixel can arrive. */
export const BUILD_STREAM_AGE_MS = 2000;

/**
 * PERF-EXT-C5 (2026-09-25, the players: "fps issues in the exterior but
 * fine in the interior", "me too my friend.. don't know why. I got a
 * RX6600"): THE SLICE IS WHAT THE FRAME LEFT. The breather resumes inside
 * its own animation-frame callback - the SAME rendering opportunity as the
 * frame's (60 of 60 resumptions carried the frame's timestamp in headless
 * Chromium) - so a flat 6 ms slice sat on top of a frame that had already
 * spent its 16.7 ms, and every frame that streamed missed vsync: 12 ms of
 * frame JS ran at 55 fps while a pixel built, 14 ms at 50, 18 ms at 41.
 * The slice is the median frame interval less the frame's own script less
 * a margin, between BUILD_SLICE_FLOOR_MS and BUILD_SLICE_MS. A light frame
 * lends the whole 6 ms as before; a heavy one lends 3 and the stream runs
 * at half pace - a pixel arrives up to twice as late, which in clear
 * weather holds the far ring's hole at the fog's edge open longer. So a
 * stream that has run BUILD_STREAM_AGE_MS gets the whole slice again, and
 * a build something is waiting on (the boot's, a teleport's) always does.
 * Pure: every input is an argument.
 * @param {{ intervalMs: number, busyMs: number, streamingMs?: number, awaited?: boolean }} frame
 * @returns {number} this slice's milliseconds
 */
export function frameFitBudget({ intervalMs, busyMs, streamingMs = 0, awaited = false }) {
  if (awaited || streamingMs > BUILD_STREAM_AGE_MS) return BUILD_SLICE_MS;
  const left = intervalMs - busyMs - BUILD_SLICE_MARGIN_MS;
  if (Number.isNaN(left)) return BUILD_SLICE_MS;   // a NaN in is the old slice out, never a stall
  return Math.max(BUILD_SLICE_FLOOR_MS, Math.min(BUILD_SLICE_MS, left));
}

/**
 * @param {{now?: () => number, raf?: (fn: () => void) => unknown, sliceMs?: number, budget?: ?(() => number), onSlice?: ?((ms: number) => void)}} [opts]
 *   PERF-EXT-C5: `budget` answers each slice's milliseconds as the slice
 *   begins (frameFitBudget, in the world host); absent, every slice is
 *   `sliceMs`, as before. `onSlice` hears each slice that ended in a
 *   yield, with its milliseconds - the host lends them to the frame clock
 *   and the `?perf=cpu` meter, which had never seen the stream at all.
 * @returns {{breathe: () => Promise<void>, reset: () => void, yields: number}}
 */
export function createBreather({
  now = () => performance.now(),
  raf = (fn) => requestAnimationFrame(fn),
  sliceMs = BUILD_SLICE_MS,
  budget = null,
  onSlice = null,
} = {}) {
  let sliceStart = now();
  let sliceBudget = budget ? budget() : sliceMs;   // PERF-EXT-C5: asked once a slice, not once a breath
  const b = {
    yields: 0,
    /** Call between units of work. Resolves at once while the slice has budget; otherwise on the next frame. */
    async breathe() {
      const spent = now() - sliceStart;
      if (spent < sliceBudget) return;
      b.yields++;
      onSlice?.(spent);
      await new Promise((resolve) => raf(resolve));
      sliceStart = now();
      sliceBudget = budget ? budget() : sliceMs;
    },
    /** A new build starts a fresh slice (the awaits before it were someone else's). */
    reset() { sliceStart = now(); sliceBudget = budget ? budget() : sliceMs; },
  };
  return b;
}
