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

/**
 * @param {{ makeWorker?: () => any, log?: { warn: Function } }} [o]
 */
export function createDressClient({ makeWorker = defaultDressWorker, log = console } = {}) {
  /** @type {any} */
  let worker = null;
  try { worker = makeWorker(); } catch (e) { log.warn('[lands] no worker for the ground\'s dress - it is dressed on the page\'s thread', e); }
  /** the dresses asked and not answered, by id: their inputs kept (the set as drawn - its copies' buffers are the
   *  worker's), so a worker that fails hands them to the fallback */
  const pending = new Map();
  let next = 0, dressed = 0;
  const here = (/** @type {any} */ job) => stepsBreathing(dressLayersSteps(job.layers, job.dress, job.exposure), job.breathe);
  const stop = () => {
    try { worker?.terminate?.(); } catch { /* gone */ }
    worker = null;
    for (const job of pending.values()) here(job).then(job.resolve, job.reject);
    pending.clear();
  };
  if (worker) {
    worker.onmessage = (/** @type {MessageEvent} */ e) => {
      const m = e.data, job = pending.get(m?.id);
      if (!job) return;
      pending.delete(m.id);
      if (m.t === 'dressed') { dressed++; job.resolve(m.layers); } else here(job).then(job.resolve, job.reject);   // a dress that threw: the page's own
    };
    worker.onerror = (/** @type {any} */ e) => { log.warn('[lands] the dress\'s worker failed - the ground is dressed on the page\'s thread', e?.message ?? e); stop(); };
  }
  return {
    /**
     * A set dressed (groundDress.js dressLayersSteps' answer): on the worker, else on the page's thread through `breathe`
     * (the stream's breather). `layers` are not written.
     * @param {ReadonlyArray<any>} layers @param {any} dress @param {number} exposure @param {() => Promise<void>} breathe
     * @returns {Promise<any[]>}
     */
    dress(layers, dress, exposure, breathe) {
      if (!worker) return here({ layers, dress, exposure, breathe });
      return new Promise((resolve, reject) => {
        const id = ++next, copies = layers.map(copyOf);
        pending.set(id, { layers, dress, exposure, breathe, resolve, reject });
        worker.postMessage({ t: 'dress', id, layers: copies, dress, exposure }, copies.flatMap((l) => (l?.colors ? [l.colors.buffer] : [])));
      });
    },
    get alive() { return !!worker; },
    /** the sets the worker dressed (the probe's read) */
    get dressed() { return dressed; },
    dispose: stop,
  };
}

/** @type {ReturnType<typeof createDressClient> | null} */
let shared = null;
/** The page's one dress client, made at its first dress (a module's, so no host wires it - HOST-SPLIT). */
export function dressClient() {
  shared ??= createDressClient();
  return shared;
}
