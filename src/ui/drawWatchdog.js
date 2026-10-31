// @ts-check
// DISC29-D (2026-09-28, Skeptikali on Discord: a dungeon at 99.9% CPU, its animation-frame handlers taking 68-203 ms
// and the DOM node count climbing from ~1,700 past 3,000) - A DRAW'S WATCHDOG COUNTS FRAMES, NOT MILLISECONDS.
//
// Eight DOM faces are drawn per frame by their owners and have no close of their own for a host that simply stops
// drawing them - the notice stack (message boxes and HUD toasts), the Yes/No dialog and the keyed choice menu, the
// list picker, a ported window, the input box, the Yes/No face, the world plaque and the death layer. Each re-armed
// a wall-clock timer on every draw and took itself down when the timer fired: "the draws stopped". Measured in
// milliseconds, a frame SLOWER than the timer read as stopped - at 150-400 ms frames the face was torn down and built
// again every frame, a forced layout each time and the old nodes left as garbage for the collector (the climbing
// count), which made the slow frame slower still.
//
// The draws have stopped when an animation frame has come and gone WITHOUT one - so this counts the frames. A small
// ticker of its own (requestAnimationFrame, running only while a face is armed) advances a count; a draw marks it.
// Two ticks past the mark is at least one whole frame with no draw, whichever order the ticker and the owner's loop
// run in within a frame (every loop that draws a face counts, not only the three hosts that stamp frameClock). No
// frame at all for DRAW_STALL_MS - a hidden tab, a display asleep - releases too, as the timer always did: a face is
// never kept for good. At a normal frame rate the release lands where it did: the timer's own ms, a frame or two on.

export const DRAW_STALL_MS = 3000;
/** Ticks past the draw's mark that prove a frame went by undrawn (see the header: the ticker's order in the frame). */
export const DRAW_FRAMES_UNDRAWN = 2;

let ticks = 0;
let armed = 0;
let running = false;
let raf = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : null);
let wall = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const defaultSchedule = (fn, ms) => (typeof setTimeout === 'function' ? setTimeout(fn, ms) : null);
const defaultCancel = (t) => { if (t != null && typeof clearTimeout === 'function') clearTimeout(t); };

function tick() {
  ticks++;
  if (armed > 0 && raf(tick) != null) return;
  running = false;
}
function startTicking() {
  if (running) return;
  running = raf(tick) != null;
}

/**
 * Arm the watchdog of a draw made now: `release()` runs once the owner has STOPPED drawing - an animation frame came
 * and went without it (DRAW_FRAMES_UNDRAWN ticks past this draw), or no frame at all for DRAW_STALL_MS. A frame
 * slower than `ms` is not a stop: the check re-arms. Every draw disarms the last handle before it arms its own
 * (disarmDraw). `schedule`/`cancel` are the owner's timer seams (a suite's hand-turned clock).
 * @param {number} ms
 * @param {() => void} release
 * @param {{ schedule?: (fn: () => void, ms: number) => any, cancel?: (t: any) => void }} [seams]
 */
export function armDrawWatchdog(ms, release, { schedule = defaultSchedule, cancel = defaultCancel } = {}) {
  const h = { t: null, cancel, live: true, mark: ticks, at: wall() };
  armed++;
  startTicking();
  const check = () => {
    h.t = null;
    if (!h.live) return;
    if (ticks - h.mark >= DRAW_FRAMES_UNDRAWN || wall() - h.at >= DRAW_STALL_MS) {
      disarmDraw(h);
      release();
      return;
    }
    h.t = schedule(check, ms);
  };
  h.t = schedule(check, ms);
  return h;
}

/** Cancel a draw's watchdog (the next draw's, or the face's own close). Safe on null and twice. */
export function disarmDraw(h) {
  if (!h || !h.live) return;
  h.live = false;
  armed--;
  if (h.t != null) { h.cancel(h.t); h.t = null; }
}

/** Tests only: the frame source and the wall clock. `raf: null` stops the ticker (a suite advances frames with
 *  _frameForTests). Answers the live counts.
 *  @param {{ raf?: ((fn: () => void) => any) | null, wall?: (() => number) | null }} [seams] */
export function _setDrawWatchdogForTests({ raf: r, wall: w } = {}) {
  if (r !== undefined) { raf = r ?? (() => null); running = false; }
  if (w !== undefined) wall = w ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  return { ticks, armed };
}
/** Tests only: one animation frame, as the ticker counts one. */
export function _frameForTests(n = 1) { ticks += n; }
