// @ts-check
// LOOP-ALIVE (FIELD BUGS 2026-10-28, "chopping trees and general interaction outside the bay can lock up your
// character"): a host's frame loop re-arms at its foot, so one throw anywhere in a frame ended the loop for good - the
// game stood still under the CRASH report. The four frame hosts import this as their `requestAnimationFrame`: a loop
// that has armed itself once and then throws is armed again and its fault said. A loop's first frame, or a callback
// that never armed itself, throws as before.
import { frameAbort } from '../systems/frameClock.js';

/** Callbacks seen arming themselves from inside their own run - a frame loop. */
const loops = new WeakSet();
/** The callback running now, and whether it armed itself during this run. */
let running = null, armed = false;
/** AUDIT LOOP-ALIVE A2/A3: each loop's faults said, by message and the line that threw - at most SAID_MAX a loop, so a
 *  message that changes every frame cannot report every frame. */
const said = new WeakMap();
export const SAID_MAX = 8;

/** A fault's key: its message and the first frame of its stack. AUDIT A1: any thrown value, even one with no string. */
function keyOf(e) {
  try {
    const top = String(e?.stack ?? '').split('\n').find((l) => /^\s*at |@/.test(l)) ?? '';
    return `${String(e?.message ?? e)}\n${top}`;
  } catch { return '?'; }
}

/** A loop's fault said where the page says a throw (main.js's report, with its Dismiss) - the stack unwound. */
function say(cb, e) {
  let mine = said.get(cb);
  if (!mine) said.set(cb, (mine = new Set()));
  const key = keyOf(e);
  if (mine.has(key) || mine.size >= SAID_MAX) return;
  mine.add(key);
  try { console.error('[frame] a frame threw - the loop goes on', e); } catch { /* a console that cannot print it */ }
  if (typeof globalThis.reportError === 'function') globalThis.reportError(e);
  else setTimeout(() => { throw e; });   // AUDIT A8: frameCap.js's own way, where reportError is missing
}

/** `requestAnimationFrame`, for a host's frame loop. @param {FrameRequestCallback} cb */
export function loopFrame(cb) {
  if (running === cb) { loops.add(cb); armed = true; }
  return globalThis.requestAnimationFrame((now) => runFrame(cb, now));
}

/** One frame of `cb`: a loop that throws before it re-arms is armed again. @param {FrameRequestCallback} cb
 *  @param {number} now */
export function runFrame(cb, now) {
  running = cb; armed = false;
  try {
    cb(now);
  } catch (e) {
    if (!loops.has(cb)) throw e;
    if (!armed) loopFrame(cb);   // AUDIT A1: armed before anything that could throw again
    frameAbort();   // the frame's open sample closed: it ended here, not at its foot
    say(cb, e);
  } finally {
    running = null;
  }
}
