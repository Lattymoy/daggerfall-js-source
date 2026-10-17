// @ts-check
// EG-H3 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 7 and 31, EG10): THE
// SWAP'S BUILD ON THIS SCREEN - the next circle's made level built while the Court rests, so the step into it stands a
// level already made. A helper the mode machine calls (scenes/worldModes.js egPrebuild, egSwapCircle), not a fifth host.
//
//   ONE BUILD AT A TIME, ITS KEY THE CIRCLE'S (world/eliteGates/egCircleParts.js egCircleKey: the breach's seed, the circle, its
//     ground): asking for another drops the one held (at most two circles are ever resident - the one stood and the one
//     built), asking again for the same is nothing.
//   OFF THE MAIN THREAD (world/eliteGates/egCircleWorker.js): the build never lands in a frame. `new Worker(new URL(...))` stays in
//     exactly that spelling for Vite (ai/nav/navClient.js, AUDIT 59 F1); the factory is injectable so node never evaluates it.
//   UNDER ANOTHER LAW, THE HALLS GIVEN (AUDIT EG V, E NEW-2): a build asked with the halls a breach's room gave (`given`)
//     hands them to the worker, which holds no other - a build asked without them is another build of the same circle.
//   THE FALLBACK IS TODAY'S STEP: no Worker, a factory that throws, a worker that errors - no build is offered (`state`
//     null) and the client steps into the new circle under the veil as it always did (scenes/eliteGates/egClient.js swapTo). The
//     build is never made on this thread: a hitch in the rest is worse than the step it would save.
//   EVERY ALLOCATION HAS AN OWNER: `drop()` forgets the build and ends the worker (the breach's end - every way out).
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { egCircleKey } from '../../world/eliteGates/egCircleParts.js';

/** How long the step into a new circle waits on its build still in flight before it steps the old way (ms) - the
 *  arrival holds for a slow machine's loading (section 6.2), and a worker's build is a tenth of this (a fifth to a
 *  quarter when it paints a new band's dress with it - AUDIT EG V L6-9, asked at the rest's start). */
export const EG_SWAP_WAIT_MS = 1500;

function defaultWorkerFactory() {
  return new Worker(new URL('../../world/eliteGates/egCircleWorker.js', import.meta.url), { type: 'module' });
}

/**
 * The swap's build. `workerFactory` - test seam; null forces no worker (no build is ever offered).
 * @param {{ workerFactory?: (() => any) | null }} [deps]
 */
export function createEgSwap({ workerFactory = undefined } = {}) {
  const factory = workerFactory === undefined ? (typeof Worker === 'undefined' ? null : defaultWorkerFactory) : workerFactory;
  let worker = null, dead = !factory, nextId = 1;
  /** @type {{ key: string, id: number, parts: any, g: boolean } | null} the build asked: its circle, its job, what came back,
   *  whether it was asked with the halls given */
  let job = null;
  const fail = () => { dead = true; job = null; try { worker?.terminate?.(); } catch { /* gone */ } worker = null; };
  function ensure() {
    if (worker || dead) return worker;
    try { worker = factory(); } catch { fail(); return null; }
    worker.onmessage = (ev) => {
      const m = ev?.data ?? {};
      if (!job || m.id !== job.id) return;   // an answer for a build since dropped
      if (m.t === 'built' && m.parts?.key === job.key) job.parts = m.parts;
      else fail();
    };
    worker.onerror = () => fail();
    return worker;
  }
  const stateOf = (key) => (!job || job.key !== key ? null : job.parts ? 'ready' : 'building');   // a failed worker holds no job (fail)
  return {
    /** Ask for circle `c`'s level (`seed`, `geo`) - nothing if it is the one asked already; answers its state. AUDIT EG V
     *  (L6-9): `band` (0-3) has the worker paint that band's dress with it (world/eliteGates/egCircleParts.js egCircleBuild); -1 none.
     *  (E NEW-2): `given` - the circle's halls as a breach of another law's room gave them, handed to the worker. EG-LOOK:
     *  `lite` the phones' tier for the ruin and the wreck it builds with them. */
    want(seed, c, geo = 0, band = -1, given = null, lite = false) {
      const key = egCircleKey(seed, c, geo), g = !!given;
      if (dead) return null;
      if (job?.key === key && job.g === g) return stateOf(key);
      const w = ensure();
      if (!w) return null;
      job = { key, id: nextId++, parts: null, g };
      try { w.postMessage({ t: 'build', id: job.id, seed: seed >>> 0, c, geo: geo || 0, band, given: given ?? null, lite: !!lite }); } catch { fail(); return null; }
      return stateOf(key);   // a worker may have answered already
    },
    /** AUDIT EG V (L6-8, L6-9): the built level for that circle, read while it waits to be handed over (its specs and its
     *  dress fed to the page through the rest), or null. */
    peek(seed, c, geo = 0) { return stateOf(egCircleKey(seed, c, geo)) === 'ready' ? job.parts : null; },
    /** `'ready'` (built), `'building'` (asked, not back) or null (not asked - or no build is offered). */
    state(seed, c, geo = 0) { return stateOf(egCircleKey(seed, c, geo)); },
    /** The built level for that circle, handed over once (null when it is not built). */
    take(seed, c, geo = 0) {
      if (stateOf(egCircleKey(seed, c, geo)) !== 'ready') return null;
      const parts = job.parts;
      job = null;
      return parts;
    },
    /** Forget the build and end the worker (a next breach starts a new one). */
    drop() { job = null; try { worker?.terminate?.(); } catch { /* gone */ } worker = null; dead = !factory; },
    /** Whether a build can be offered at all. */
    get offered() { return !dead; },
  };
}
