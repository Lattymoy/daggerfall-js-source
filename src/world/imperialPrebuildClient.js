// @ts-check
// IC-GRAND's perf pass (bible/03-World/Arena-Provinces.md IC-GRAND, "Off the page's thread") - THE PAGE'S SIDE OF THE
// IMPERIAL CITY'S WORKER (world/imperialPrebuild.js says what and why; world/imperialPrebuildWorker.js makes the pieces).
// It tells the worker which slices are wanted, nearest first (`want`), holds what comes back a bounded number at a time,
// and hands a piece over once (`takeBlock`, `takeModel`) - the world-data door and the models' family ask it before they
// make a piece themselves (world/capitalModels.js), and a piece asked before the worker made it is made on this thread
// and the worker told to skip it (`made`). The worker laws the other clients keep (world/tamrielRoadsClient.js,
// world/deepWater/deepWatersClient.js): `new Worker(new URL(...))` in exactly that spelling for Vite; the factory
// injectable, so node never evaluates `new Worker`; THE FALLBACK IS THE SAME WORK - no Worker, a factory that throws, a
// worker that errors: nothing is held, and every piece is made on this thread as it always was.
import { setImperialPrebuild, imperialPrebuilt } from './imperialPrebuild.js';

/** The city's worker, as Vite bundles it - `new Worker(new URL(...))` in exactly that spelling. */
export function defaultPrebuildWorker() {
  return new Worker(new URL('./imperialPrebuildWorker.js', import.meta.url), { type: 'module' });
}
/** How many made pieces are held for the build to take: a near ring's blocks and models (nine slices, ~125 pieces each) and
 *  the next ring's far blocks - each taken once and let go. */
export const PREBUILD_KEEP = 2400;

/**
 * @param {{ makeWorker?: () => any, keep?: number, log?: { warn: Function } }} [o]
 */
export function createImperialPrebuild({ makeWorker = defaultPrebuildWorker, keep = PREBUILD_KEEP, log = console } = {}) {
  /** @type {any} */
  let worker = null;
  try { worker = makeWorker(); } catch (e) { log.warn('[imperial] no worker for the city\'s blocks - they are made on the page\'s thread', e); }
  /** @type {Map<string, any>} */
  const held = new Map();
  const put = (k, v) => { held.delete(k); held.set(k, v); if (held.size > keep) held.delete(/** @type {string} */ (held.keys().next().value)); };
  let lastWant = '', taken = 0, missed = 0;
  const stop = () => { try { worker?.terminate?.(); } catch { /* gone */ } worker = null; held.clear(); };
  if (worker) {
    worker.onmessage = (/** @type {MessageEvent} */ e) => {
      const m = e.data;
      if (m?.t === 'block' && m.json) put(`b:${m.name}`, m.json);
      else if (m?.t === 'model') put(`m:${m.id}`, m.model ?? null);
    };
    worker.onerror = (/** @type {any} */ e) => { log.warn('[imperial] the city\'s worker failed - its blocks are made on the page\'s thread', e?.message ?? e); stop(); };
  }
  const client = {
    /** The slices wanted now, in order (`[{ s, near }]`) - said to the worker when the list changes. */
    want(/** @type {Array<{ s: number, near: boolean }>} */ slices) {
      if (!worker) return;
      const k = slices.map((w) => `${w.s}${w.near ? 'n' : 'f'}`).join(',');
      if (k === lastWant) return;
      lastWant = k;
      worker.postMessage({ t: 'want', slices });
    },
    /** A block's JSON the worker made, handed over once - or null (the page makes it, and the worker is told). */
    takeBlock(/** @type {string} */ name) {
      const k = `b:${name}`;
      if (!held.has(k)) { missed++; client.made(k); return null; }
      const v = held.get(k);
      held.delete(k);
      taken++;
      return v;
    },
    /** A model the worker made (null: none in that cell), handed over once - or undefined (the page makes it). */
    takeModel(/** @type {number} */ id) {
      const k = `m:${id}`;
      if (!held.has(k)) { missed++; client.made(k); return undefined; }
      const v = held.get(k);
      held.delete(k);
      taken++;
      return v;
    },
    /** A piece the page made itself: the worker skips it. */
    made(/** @type {string} */ key) { worker?.postMessage({ t: 'made', key }); },
    /** The worker let go (out of the city's reach): nothing held, nothing wanted. */
    dispose() { stop(); lastWant = ''; if (imperialPrebuilt() === client) setImperialPrebuild(null); },
    get held() { return held.size; },
    get alive() { return !!worker; },
    /** The pieces handed over, and the ones asked before the worker made them (the probe's read). */
    get taken() { return taken; },
    get missed() { return missed; },
  };
  setImperialPrebuild(client);
  return client;
}
