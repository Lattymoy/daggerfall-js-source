// @ts-check
// TESA-LANDS (bible/03-World/Tamriel-Lands.md, "The ground", AUDIT: the dress's cost) - THE PAGE'S SIDE OF THE DRESS'S
// WORKER (world/tamriel/groundDressWorker.js): a set's layers handed over as copies (the set as drawn stays the page's -
// its puddles' and its grass's reads), the dressed set handed back. The worker laws the other clients keep
// (world/imperialPrebuildClient.js, world/tamrielRoadsClient.js): `new Worker(new URL(...))` in exactly that spelling for
// Vite; the factory injectable, so node never evaluates `new Worker`; THE FALLBACK IS THE SAME WORK - no Worker, a factory
// that throws, a worker that errors: the set is dressed on the page's thread a band of a record a breath, as it was.
import { dressLayersSteps } from './groundDress.js';
import { stepsBreathing } from '../puddleMask.js';

/** The dress's worker, as Vite bundles it - `new Worker(new URL(...))` in exactly that spelling; none where the page has no
 *  Worker (node). */
export function defaultDressWorker() {
  if (typeof Worker === 'undefined') return null;
  return new Worker(new URL('./groundDressWorker.js', import.meta.url), { type: 'module' });
}

/** A layer as the worker is handed it: its fields, and its colours a copy of its own (whose buffer is moved). */
const copyOf = (/** @type {any} */ l) => (l?.colors ? { ...l, colors: Uint8Array.from(l.colors) } : l);
/** TESA-LANDS' second audit (lane C): how many dress workers may die in a client's life before it dresses on the page's
 *  thread for good - a dead one is let go and the next dress makes another, as the roads' client does
 *  (world/tamrielRoadsClient.js WORKER_DEATHS); one failure had sent the session's every dress to the page. */
export const DRESS_WORKER_DEATHS = 3;
/** ...and how long a dress may go unanswered before its worker is counted dead (a set's dress is a second of a core,
 *  a few queued a few): a reply lost (a message the page could not read) had held its set, and every pixel that wears
 *  it, for the scene. */
export const DRESS_ANSWER_MS = 60000;

/**
 * @param {{ makeWorker?: () => any, log?: { warn: Function }, timer?: ?((fn: () => void, ms: number) => any),
 *   untimer?: ?((handle: any) => void) }} [o] `timer` / `untimer` the watchdog's clock (setTimeout's; null: none)
 */
export function createDressClient({
  makeWorker = defaultDressWorker,
  log = console,
  timer = globalThis.setTimeout?.bind(globalThis) ?? null,
  untimer = globalThis.clearTimeout?.bind(globalThis) ?? null,
} = {}) {
  /** @type {any} */
  let worker = null;
  let deaths = 0,
    done = false,
    next = 0,
    dressed = 0;
  /** the dresses asked and not answered, by id: their inputs kept (the set as drawn - its copies' buffers are the
   *  worker's), so a worker that fails hands them to the fallback */
  const pending = new Map();
  const here = (/** @type {any} */ job) =>
    stepsBreathing(dressLayersSteps(job.layers, job.dress, job.exposure), job.breathe);
  const unwatch = (/** @type {any} */ job) => {
    if (job.watch != null) untimer?.(job.watch);
    job.watch = null;
  };
  /** The worker, made where there is none and deaths allow. */
  const make = () => {
    if (worker || done || deaths >= DRESS_WORKER_DEATHS) return worker;
    let w = null;
    try {
      w = makeWorker();
    } catch (e) {
      log.warn("[lands] no worker for the ground's dress - it is dressed on the page's thread", e);
    }
    if (!w) {
      done = true;
      return null;
    }
    w.onmessage = (/** @type {MessageEvent} */ e) => {
      if (worker !== w) return;
      const m = e.data,
        job = pending.get(m?.id);
      if (!job) return;
      pending.delete(m.id);
      unwatch(job);
      if (m.t === 'dressed') {
        dressed++;
        job.resolve(m.layers);
      } else here(job).then(job.resolve, job.reject); // a dress that threw: the page's own
    };
    w.onerror = (/** @type {any} */ e) => died(w, e?.message ?? e);
    w.onmessageerror = () => died(w, 'an answer it could not hand back');
    return (worker = w);
  };
  /** The worker let go: what it held the page's to dress. */
  const letGo = (/** @type {any} */ w) => {
    try {
      w.terminate?.();
    } catch {
      /* gone */
    }
    worker = null;
    const jobs = [...pending.values()];
    pending.clear();
    for (const job of jobs) {
      unwatch(job);
      here(job).then(job.resolve, job.reject);
    }
  };
  /** A worker failed: let go, and the next dress makes another while deaths allow. */
  const died = (/** @type {any} */ w, /** @type {any} */ why) => {
    if (worker !== w) return;
    deaths++;
    log.warn(
      `[lands] the dress's worker failed (${deaths} of ${DRESS_WORKER_DEATHS}) - what it held is dressed on the page's thread`,
      why,
    );
    letGo(w);
  };
  make();
  return {
    /**
     * A set dressed (groundDress.js dressLayersSteps' answer): on the worker, else on the page's thread through `breathe`
     * (the stream's breather). `layers` are not written.
     * @param {ReadonlyArray<any>} layers @param {any} dress @param {number} exposure @param {() => Promise<void>} breathe
     * @returns {Promise<any[]>}
     */
    dress(layers, dress, exposure, breathe) {
      const w = make();
      if (!w) return here({ layers, dress, exposure, breathe });
      return new Promise((resolve, reject) => {
        const id = ++next,
          copies = layers.map(copyOf),
          job = { layers, dress, exposure, breathe, resolve, reject, watch: null };
        pending.set(id, job);
        try {
          w.postMessage(
            { t: 'dress', id, layers: copies, dress, exposure },
            copies.flatMap((l) => (l?.colors ? [l.colors.buffer] : [])),
          );
        } catch (e) {
          // the second audit: a post that throws (a clone refused, no memory for it) is the page's to dress - it had been
          // rejected outright, and its set held in `pending` until the worker died
          pending.delete(id);
          log.warn(
            "[lands] a dress could not be handed to its worker - it is dressed on the page's thread",
            /** @type {any} */ (e)?.message ?? e,
          );
          here(job).then(resolve, reject);
          return;
        }
        if (timer) {
          job.watch = timer(() => {
            if (pending.get(id) === job) died(w, `no answer in ${DRESS_ANSWER_MS / 1000} s`);
          }, DRESS_ANSWER_MS);
          job.watch?.unref?.();
        } // node's: the watch holds no process open
      });
    },
    get alive() {
      return !!worker;
    },
    /** the sets the worker dressed (the probe's read) */
    get dressed() {
      return dressed;
    },
    /** the workers that died */
    get deaths() {
      return deaths;
    },
    /** No worker again: the one there is let go, what it held the page's. */
    dispose() {
      done = true;
      if (worker) letGo(worker);
    },
  };
}

/** @type {ReturnType<typeof createDressClient> | null} */
let shared = null;
/** The page's one dress client, made at its first dress (a module's, so no host wires it - HOST-SPLIT). */
export function dressClient() {
  shared ??= createDressClient();
  return shared;
}
