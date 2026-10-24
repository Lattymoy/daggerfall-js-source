// @ts-check
// SOUNDSCAPE (2026-10-24): THE SOUNDS THE PORT MAKES, MADE AND REGISTERED - a bed of soundBeds.js, a town's murmur or its
// tavern (townBeds.js) - each made once and registered on the engine under its key (audio.registerSamples), so every entry
// point takes the key as a clip.
//
// AUDIT SOUNDSCAPE W4 + S5 (2026-10-24): MADE OFF THE MAIN THREAD. The first cut made each in the page's idle time, as one
// call - but an idle callback with a timeout runs as an ordinary task on a busy page and never yields, so each was one
// stall of 15 to 170 ms all the same, and a page with no idle callbacks made all three of a deck's at once inside its
// first frame. Now a job goes to a module worker (soundWorker.js - spelled the way Vite bundles one, as the nav and the
// terrain workers are) and its samples come back; where no worker can be had (a test, a page refused one) it is made in
// the page's idle time, and where there is none of that either, at once. One at a time, always. A maker that throws is
// given up for the session (it threw every frame's retry), never asked again; a job with nothing to make it of yet (the
// player's archive not read) is asked again next frame. Its samples are let go once the engine holds the buffer (the
// buffer is the engine's own copy: a town's two beds held 690 KiB each twice over).
import { SOUND_BEDS, bedSamples } from './soundBeds.js';
import { murmurSamples, tavernSamples } from './townBeds.js';

/**
 * A job - what is to be made: `{ kind: 'bed', key }` a bed of SOUND_BEDS, `{ kind: 'murmur' | 'tavern', voices }` a
 * town's bed out of the people's samples. Its samples, made. Pure - the worker and the main thread both run it.
 * @param {{ kind: string, key?: string, voices?: Float32Array[] }} job
 * @returns {Float32Array | null}
 */
export function runJob(job) {
  if (job?.kind === 'bed') { const spec = /** @type {Record<string, any>} */ (SOUND_BEDS)[/** @type {string} */ (job.key)]; return spec ? bedSamples(spec) : null; }
  if (job?.kind === 'murmur' && job.voices?.length) return murmurSamples(job.voices);
  if (job?.kind === 'tavern' && job.voices?.length) return tavernSamples(job.voices);
  return null;
}

/** @type {Map<string, Float32Array>} samples made and not yet registered */
const _made = new Map();
/** @type {WeakMap<object, Set<string>>} the keys each engine holds */
const _on = new WeakMap();
/** @type {Set<string>} the jobs given up (their maker threw) */
const _failed = new Set();
/** The job being made, or null - one at a time. */
let _making = /** @type {string | null} */ (null);
let _nextId = 1;
/** @type {Map<number, { key: string, job: any }>} the jobs at the worker */
const _pending = new Map();
/** The worker: undefined untried, null none to be had. @type {any} */
let _worker;

/** The jobs at a worker that failed (its module would not load), made on the main thread instead - a bed's; a town's
 *  handed the worker its voices (transferred, so gone from here) and is asked again by its driver's next frame. */
function workerFailed() {
  _worker = null;
  const jobs = [..._pending.values()];
  _pending.clear();
  _making = null;
  for (const { key, job } of jobs) if (!job.voices) settle(key, () => runJob(job));
}
/** A job's samples, kept for the next frame's registration - or the job given up when its maker threw. */
function settle(key, make) {
  try { const s = make(); if (s) _made.set(key, s); } catch (err) { _failed.add(key); console.warn(`[soundscape] ${key} could not be made:`, err); }
  if (_making === key) _making = null;
}

/**
 * THE DEFAULT WORKER, made the first time a job is posted - null where none can be had. `WorkerCtor` the tests' double
 * (built with the module option and no second URL for the bundler to emit).
 * @param {any} [WorkerCtor]
 */
export function soundWorker(WorkerCtor = /** @type {any} */ (globalThis).Worker) {
  if (_worker !== undefined) return _worker;
  try {
    _worker = typeof WorkerCtor !== 'function' ? null
      : WorkerCtor === /** @type {any} */ (globalThis).Worker
        ? new Worker(new URL('./soundWorker.js', import.meta.url), { type: 'module' })
        : new WorkerCtor('./soundWorker.js', { type: 'module' });
  } catch { _worker = null; }
  if (_worker) {
    _worker.onmessage = (/** @type {MessageEvent} */ e) => {
      const { id, samples, error } = e.data ?? {};
      const p = _pending.get(id);
      if (!p) return;
      _pending.delete(id);
      settle(p.key, () => { if (error) throw new Error(error); return samples ?? null; });
    };
    _worker.onerror = () => workerFailed();
  }
  return _worker;
}

/**
 * A SOUND THE PORT MAKES on `engine` under `key` at `rate`: true once the engine holds it. `job()` the job (runJob's), or
 * null while what it is made of is not there yet. False until it stands - the driver asks again next frame.
 * @param {{ registerSamples?: (key: string, samples: Float32Array, rate: number) => boolean }} engine
 * @param {string} key @param {() => any} job @param {number} rate
 * @param {{ worker?: (() => any) | null, idle?: ((fn: () => void, opts: { timeout: number }) => unknown) | null }} [opts]
 */
export function ensureMade(engine, key, job, rate, { worker = soundWorker, idle = /** @type {any} */ (globalThis).requestIdleCallback ?? null } = {}) {
  if (!engine?.registerSamples) return false;
  let on = _on.get(engine);
  if (on?.has(key)) return true;
  const have = _made.get(key);
  if (have) {
    if (!engine.registerSamples(key, have, rate)) return false;   // no context to register it on yet
    if (!on) _on.set(engine, (on = new Set()));
    on.add(key);
    _made.delete(key);
    return true;
  }
  if (_failed.has(key) || _making != null) return false;
  const j = job();
  if (!j) return false;
  const w = typeof worker === 'function' ? worker() : null;
  if (w) {
    const id = _nextId++;
    _making = key;
    _pending.set(id, { key, job: j });
    w.postMessage({ id, job: j }, (j.voices ?? []).map((/** @type {Float32Array} */ v) => v.buffer));
    return false;
  }
  if (typeof idle === 'function') {
    _making = key;
    idle(() => settle(key, () => runJob(j)), { timeout: 1000 });
    return false;
  }
  settle(key, () => runJob(j));
  return ensureMade(engine, key, () => null, rate, { worker: null, idle: null });
}

/** A bed of SOUND_BEDS on the engine under its key (ensureMade's law). @param {any} engine @param {string} key @param {any} [opts] */
export function ensureBed(engine, key, opts) {
  const spec = /** @type {Record<string, any>} */ (SOUND_BEDS)[key];
  return !!spec && ensureMade(engine, key, () => ({ kind: 'bed', key }), spec.rate, opts);
}

/** Test seam: everything made, held, given up and posted forgotten, and the worker let go. */
export function _resetMade() { _made.clear(); _failed.clear(); _pending.clear(); _making = null; _worker = undefined; }
