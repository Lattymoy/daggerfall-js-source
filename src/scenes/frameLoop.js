// @ts-check
// LOOP-ALIVE (FIELD BUGS 2026-10-28, "chopping trees and general interaction outside the bay can lock up your
// character"): a host's frame loop re-arms at its foot, so one throw anywhere in a frame ended the loop for good - the
// game stood still under the CRASH report. The hosts import this as their `requestAnimationFrame`: a loop that threw
// is said (main.js's report, once a message) and armed again; a callback that never re-armed itself throws as before.
import { frameAbort } from '../systems/frameClock.js';

/** Callbacks seen arming themselves from inside their own run - a frame loop. */
const loops = new WeakSet();
/** The callback running now, and whether it armed itself during this run. */
let running = null, armed = false;
/** Each fault's message, said once a session. */
const said = new Set();

/** A fault said where the page says a throw (main.js's `error` listener: the report, with its Dismiss) - the stack
 *  unwound, so the loop goes on. */
function say(e) {
  const key = String(e?.message ?? e);
  if (said.has(key)) return;
  said.add(key);
  console.error('[frame] a frame threw - the loop goes on', e);
  try { globalThis.reportError?.(e); } catch { /* no page to say it on */ }
}

/** `requestAnimationFrame`, for a host's frame loop. @param {FrameRequestCallback} cb */
export function loopFrame(cb) {
  if (running === cb) { loops.add(cb); armed = true; }
  return globalThis.requestAnimationFrame((now) => runFrame(cb, now));
}

/** One frame of `cb`: a loop that throws before it re-arms is armed again. @param {FrameRequestCallback} cb
 *  @param {number} now */
export function runFrame(cb, now) {
  const outer = running, outerArmed = armed;
  running = cb; armed = false;
  try {
    cb(now);
  } catch (e) {
    if (!loops.has(cb)) throw e;
    frameAbort();   // the frame's open sample closed: it ended here, not at its foot
    say(e);
    if (!armed) loopFrame(cb);
  } finally {
    running = outer; armed = outerArmed;
  }
}

/** Tests: forget the messages said. */
export function _resetFrameLoopForTests() { said.clear(); }
