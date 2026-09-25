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
// PERF-EXT-C5: the stream build's slices run in their own animation-frame
// callback AFTER a host's frameEnd, so no sample ever held them: frameCpu,
// the FPS counter's script ms and `?perf=cpu` all read a streaming frame
// as the frame alone. `lent` is what the breather reports between two
// samples, folded into the next one's busy.
let lent = 0;
let lastOwn = 0;       // PERF-EXT-C5: the last sample's own script, lent time excluded - what the next slice is sized against
const BEGINS = 15;     // PERF-EXT-C5: the frame intervals kept for their median
const intervals = new Float64Array(BEGINS);
let intervalCount = 0, intervalAt = 0, lastBegin = null;

/** The top of a host's frame callback. */
export function frameBegin(now) {
  // PERF-EXT-C5: the rAF stamps a frame apart - the display's own period
  // (16.7 at 60 Hz, 6.9 at 144), measured rather than assumed.
  if (lastBegin != null && now > lastBegin) {
    intervals[intervalAt] = now - lastBegin;
    intervalAt = (intervalAt + 1) % BEGINS;
    if (intervalCount < BEGINS) intervalCount++;
  }
  lastBegin = now;
  open = now;
}

/** PERF-EXT-C5: the median of the last BEGINS frame intervals, ms - 60 Hz's
 *  period until two frames have begun. */
export function frameInterval() {
  if (!intervalCount) return 1000 / 60;
  const s = sortedIntervals.subarray(0, intervalCount);
  s.set(intervals.subarray(0, intervalCount));
  s.sort();   // a typed array sorts by value
  return s[intervalCount >> 1];
}
const sortedIntervals = new Float64Array(BEGINS);   // frameInterval's scratch - asked once a build slice

/** PERF-EXT-C5: the last frame's own script ms (0 before any). */
export const lastBusy = () => lastOwn;

/** PERF-EXT-C5: work done between frames, on the frame's thread - a build
 *  slice - lent to the next sample, so the script time says what the main
 *  thread really spent. */
export function lendFrame(ms) { if (ms > 0) lent += ms; }

/**
 * THE FRAME IN FLIGHT, AS A TOKEN - or null between frames.
 *
 * AUDIT-WH P1. A reader that must not do the same work twice in one
 * frame needs to know which frame it is in, and this module is the one
 * that already knows: `frameBegin` stamps the rAF's `now` at the top
 * of every live frame in all three hosts (PERF1 pins that), and
 * `frameEnd` clears it. So the value changes exactly once a frame and
 * is NULL outside one - which is the important half, because a memo
 * keyed on it can never carry an answer from one frame into the next,
 * and a caller reached outside a frame (a test, a console) recomputes.
 *
 * AUDIT-WH2 L1-F4: AND THAT HALF WAS NOT TRUE WHEN IT WAS WRITTEN.
 *
 * P1 layered this token onto a clock whose own header, ten lines above,
 * says the opposite in as many words: "an early return between them is
 * a sample that is simply not taken". Every host has two such returns
 * and neither said `frameEnd` - and one of them, the modal return, is
 * taken on EVERY frame of every interior and dungeon visit under the
 * streaming host. So for a whole indoor session `open` stayed stamped
 * and this answered non-null in every gap between frames.
 *
 * It was not a wrong answer in a frame (`frameBegin` takes the rAF's
 * timestamp, so two frames can never share a mark), but it broke this
 * promise exactly where the promise was the point: `worldPlaqueOn()`'s
 * gate memo answered ENHANCED on a classic page when reached from
 * outside a frame, which is AUDIT 39's hazard shape; and worldModes'
 * `__exit` probe, which the tree itself documents as calling `tryExit`
 * OUTSIDE the frame loop, was served the previous frame's target list
 * instead of recomputing - the "a test, a console" case, named in this
 * very sentence and wrong.
 *
 * `frameAbort` below is the missing door. A skipped SAMPLE and a frame
 * that never closed are two different things, and PERF1 only ever
 * wanted the first.
 */
export const frameMark = () => open;

/**
 * CLOSE THE FRAME WITHOUT SAMPLING IT - what a host says when it
 * returns early.
 *
 * Deliberately not `frameEnd`: a frame that bailed at its second
 * statement did almost no work, and folding it into the window's mean
 * would make the script-time number say the main thread got cheaper
 * every time a modal went up. PERF1's measurement is unchanged; only
 * the token is cleared.
 */
export function frameAbort() { open = null; }

/** The bottom of the same callback, before it re-arms. `now` defaults
 *  to performance.now() - the end is measured, not the rAF's stamp. */
export function frameEnd(now = (typeof performance !== 'undefined' ? performance.now() : null)) {
  if (open == null || now == null) { open = null; return; }
  lastOwn = Math.max(0, now - open);
  const busy = lastOwn + lent;   // PERF-EXT-C5: and the stream's slices since the last sample
  lent = 0;
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

export function _resetFrameClock() { open = null; samples = []; lent = 0; lastOwn = 0; intervalCount = 0; intervalAt = 0; lastBegin = null; }
