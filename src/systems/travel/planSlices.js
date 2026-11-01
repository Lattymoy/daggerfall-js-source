// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PLAN-SLICES (2026-10-26, the owner: "No band aids"; bible/06-Systems/Travel-View.md PLAN-SLICES) - A JOURNEY'S PLAN IN
// SLICES OF CELLS, NEVER ONE LONG TASK. The Overworld's planner (systems/travel/travelRoute.js planRoute) ran as one call:
// a plan past the Bay that found no way spent its whole count of cells (up to 300,000, seconds on a loaded machine) inside
// one frame. Its body is a generator now (planRouteSteps, yielding every PLAN_YIELD_CELLS cells), and a journey the world
// host begins (scenes/world.js travelViewRouteTo, travelViewWalkTo) runs through here:
//   - `journey(run)` runs the journey's own function; each plan it asks (`plan`, planRoute's arguments) runs a slice of
//     PLAN_FRAME_CELLS cells at once - the Bay's plans, and most past it, end inside that first slice and the journey
//     goes on in the same call, as it always did;
//   - a plan its slice does not finish stops the journey (PLAN_PENDING, before anything of it is done - the plans come
//     first in the host's journeys), the view is told it is planning (`onPending`, once), and the plan goes on a slice a
//     frame (`schedule`); when it ends the journey's function runs again from its start, each plan it had already asked
//     answered at once, and goes on;
//   - a journey begun while one is planning takes its place.
// The plan answered is the generator run to its end - the very plan planRoute answers (drainPlan), cell for cell.
// ═══════════════════════════════════════════════════════════════════
import { planRouteSteps, drainPlan } from './travelRoute.js';

/** The cells a journey's plan may expand in one slice - one frame's share. */
export const PLAN_FRAME_CELLS = 20000;
/** What a plan its slice did not finish throws through the journey's function. */
export const PLAN_PENDING = Object.freeze({ planPending: true });

/** A plan's ask as a key: its goal, the roads and tracks it is handed, the sea's ask, the goal's exemption - never its
 *  start, which a traveller still walking moves while the plan is made (the plan from where the journey was asked). */
const keyOf = (from, to, o = {}) =>
  `${to?.x},${to?.y}|${o.roads ? 'r' : ''}${o.tracks ? 't' : ''}|${o.sea ? `${o.sea.start}/${o.sea.goal}/${!!o.sea.again}/${!!o.sea.voyage}` : '-'}|${o.goalExempt ?? ''}|${o.lanes ?? ''}`;

const nextFrame = (fn) =>
  typeof globalThis.requestAnimationFrame === 'function' ? globalThis.requestAnimationFrame(fn) : setTimeout(fn, 0);

/**
 * @param {{ budget?: number, schedule?: (fn: () => void) => any, onPending?: (() => void) | null }} [o]
 */
export function createPlanSlices({ budget = PLAN_FRAME_CELLS, schedule = nextFrame, onPending = null } = {}) {
  /** @type {null | { run: () => any, plans: any[], k: number, waiting: boolean, slices: number }} */
  let live = null;
  /** @type {null | { run: () => any, plans: any[], k: number, waiting: boolean, slices: number }} */
  let current = null;
  /** One slice of a plan: up to `budget` cells. */
  function slice(p) {
    const start = p.tally.n;
    p.slices++;
    for (;;) {
      const r = p.it.next();
      if (r.done) {
        p.done = true;
        p.value = r.value;
        return;
      }
      if (p.tally.n - start >= budget) return;
    }
  }
  function go(j) {
    current = j;
    j.k = 0;
    try {
      const v = j.run();
      current = null;
      if (live === j) live = null;
      return v;
    } catch (e) {
      current = null;
      if (e !== PLAN_PENDING) {
        if (live === j) live = null;
        throw e;
      }
      if (!j.waiting) {
        j.waiting = true;
        onPending?.();
      }
      schedule(() => {
        if (live === j) go(j);
      });
      return true;
    }
  }
  return {
    /**
     * A journey: `run` its own function, asking its plans through `plan`. Answers what `run` answers - or true while its
     * plan is still being made (the journey taken up; it goes on when the plan lands).
     * @template T @param {() => T} run @returns {T | true}
     */
    journey(run) {
      if (current) return run(); // asked from inside a journey: its own
      const j = { run, plans: [], k: 0, waiting: false, slices: 0 };
      live = j;
      return go(j);
    },
    /** planRoute's own ask (`from`, `to`, its options): inside a journey, a slice at a time; outside one, the one call's. */
    plan(from, to, opts = {}) {
      const j = current;
      if (!j) return drainPlan(planRouteSteps(from, to, opts));
      const k = j.k++,
        key = keyOf(from, to, opts);
      let p = j.plans[k];
      if (!p || p.key !== key) {
        const tally = { n: 0 };
        p = { key, tally, it: planRouteSteps(from, to, { ...opts, tally }), done: false, value: null, slices: 0 };
        j.plans[k] = p;
        j.plans.length = k + 1;
      }
      if (!p.done) {
        slice(p);
        j.slices++;
        if (!p.done) throw PLAN_PENDING;
      }
      return p.value;
    },
    /** Whether a journey's plan is being made. */
    planning: () => !!live,
    /** The journey being planned let go (its plan never lands). */
    cancel() {
      live = null;
    },
  };
}

// ── THE WORLD'S ONE ─────────────────────────────────────────────
// The world host's journeys plan through this one slicer: `planRouteSliced` its planner (its `planRoute`) (the one call's outside a journey),
// `planJourney` its two journeys' runner, `planning` whether one is being planned - the Travel View's readout says so
// (scenes/travelView.js).
const _world = createPlanSlices();
/** planRoute, a slice at a time inside a journey (planJourney), the one call's outside one. @type {typeof import('./travelRoute.js').planRoute} */
export const planRouteSliced = (from, to, opts = {}) => _world.plan(from, to, opts);
/** @template T @param {() => T} run @returns {T | true} */
export const planJourney = (run) => _world.journey(run);
export const planning = () => _world.planning();
