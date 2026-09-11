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

/**
 * @param {{now?: () => number, raf?: (fn: () => void) => unknown, sliceMs?: number}} [opts]
 * @returns {{breathe: () => Promise<void>, reset: () => void, yields: number}}
 */
export function createBreather({
  now = () => performance.now(),
  raf = (fn) => requestAnimationFrame(fn),
  sliceMs = BUILD_SLICE_MS,
} = {}) {
  let sliceStart = now();
  const b = {
    yields: 0,
    /** Call between units of work. Resolves at once while the slice has budget; otherwise on the next frame. */
    async breathe() {
      if (now() - sliceStart < sliceMs) return;
      b.yields++;
      await new Promise((resolve) => raf(resolve));
      sliceStart = now();
    },
    /** A new build starts a fresh slice (the awaits before it were someone else's). */
    reset() { sliceStart = now(); },
  };
  return b;
}
