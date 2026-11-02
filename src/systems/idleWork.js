// @ts-check
// WORK THE PAGE DOES WHEN IT IS IDLE. A job is a generator whose steps are each a few milliseconds; the queue runs them
// in the browser's idle callbacks - while the callback leaves time, and for FORCED_SLICE_MS when its wait ran out, so a
// page that never idles still finishes - never inside a frame. A page with no idle callback (Safari) takes forced
// slices on a timer; with no page (node) a job runs whole on the next task.

/** The idle time a slice leaves unspent (ms), how long an ask waits for an idle moment before it is forced, and how
 *  long a forced slice works (at least one step). */
export const IDLE_SPARE_MS = 3;
export const IDLE_WAIT_MS = 50;
export const FORCED_SLICE_MS = 2;

/** The page's idle callback, a timer standing in where it has none, or null where there is no page. */
export function pageIdleCallback(page = /** @type {any} */ (globalThis)) {
  if (typeof page.requestIdleCallback === 'function') return (fn, options) => page.requestIdleCallback(fn, options);
  if (typeof page.document !== 'undefined' && typeof page.setTimeout === 'function')
    return (fn) => page.setTimeout(() => fn({ didTimeout: true, timeRemaining: () => 0 }), 16);
  return null;
}

/**
 * A queue of jobs run in idle slices. `add(key, steps, done)` queues `steps` (an iterator: each `next()` one step, its
 * end's `value` the answer) and calls `done(answer, error)` when it ends; `hurry(key)` moves a queued job to the front.
 * @param {{ idle?: ((fn: (deadline: any) => void, o?: { timeout?: number }) => void) | null, now?: () => number }} [o]
 */
export function createIdleWork({ idle = pageIdleCallback(), now = () => performance.now() } = {}) {
  /** @type {{ key: any, steps: Iterator<any, any>, done: (value: any, error?: any) => void }[]} */
  const jobs = [];
  let asked = false;
  function step() {
    const job = jobs[0];
    let next;
    try {
      next = job.steps.next();
    } catch (e) {
      jobs.shift();
      job.done(null, e);
      return;
    }
    if (next.done) {
      jobs.shift();
      job.done(next.value);
    }
  }
  function slice(/** @type {any} */ deadline) {
    asked = false;
    const forced = !!deadline?.didTimeout || !deadline?.timeRemaining,
      until = forced ? now() + FORCED_SLICE_MS : 0;
    do step();
    while (jobs.length && (forced ? now() < until : deadline.timeRemaining() > IDLE_SPARE_MS));
    ask();
  }
  function ask() {
    if (asked || !jobs.length) return;
    asked = true;
    if (idle) idle(slice, { timeout: IDLE_WAIT_MS });
    else
      setTimeout(() => {
        asked = false;
        while (jobs.length) step();
      }, 0);
  }
  return {
    /** @param {any} key @param {Iterator<any, any>} steps @param {(value: any, error?: any) => void} done */
    add(key, steps, done) {
      jobs.push({ key, steps, done });
      ask();
    },
    /** @param {any} key */
    hurry(key) {
      const at = jobs.findIndex((job) => job.key === key);
      if (at > 0) jobs.unshift(...jobs.splice(at, 1));
    },
    get pending() {
      return jobs.length;
    },
  };
}

/** @type {ReturnType<typeof createIdleWork> | null} */
let _shared = null;
/** The page's one queue. */
export const idleWork = () => (_shared ??= createIdleWork());
