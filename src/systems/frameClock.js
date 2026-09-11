// PERF1 - THE FRAME CLOCK (2026-09-11, RookieG via Mac: "its like 45fps
// on the outside"). The FPS counter measures the browser's cadence;
// this measures the MAIN THREAD's share of it - the milliseconds
// between a host's frame callback starting and its last statement -
// so the two numbers side by side say which side the frame is
// spending: a 22 ms frame with 6 ms of script is the GPU's (the
// grass, the clouds, the water), a 22 ms frame with 20 ms of script
// is ours. Each host stamps begin at the top of its rAF callback and
// end before it re-arms; an early return between them is a sample
// that is simply not taken.
//
// Pure: the samples are the last second's, the clock the caller's.

const WINDOW_MS = 1000;

let open = null;       // the frame in flight: its start, ms
let samples = [];      // [end ms, busy ms] within the window

/** The top of a host's frame callback. */
export function frameBegin(now) { open = now; }

/** The bottom of the same callback, before it re-arms. `now` defaults
 *  to performance.now() - the end is measured, not the rAF's stamp. */
export function frameEnd(now = (typeof performance !== 'undefined' ? performance.now() : null)) {
  if (open == null || now == null) { open = null; return; }
  const busy = Math.max(0, now - open);
  open = null;
  samples.push([now, busy]);
  const cut = now - WINDOW_MS;
  let i = 0;
  while (i < samples.length && samples[i][0] < cut) i++;
  if (i) samples = samples.slice(i);
}

/** The last second's script time: mean and worst frame, ms; null
 *  before any frame has been stamped. */
export function frameCpu() {
  if (!samples.length) return null;
  let sum = 0, worst = 0;
  for (const [, b] of samples) { sum += b; if (b > worst) worst = b; }
  return { meanMs: sum / samples.length, worstMs: worst, frames: samples.length };
}

export function _resetFrameClock() { open = null; samples = []; }
