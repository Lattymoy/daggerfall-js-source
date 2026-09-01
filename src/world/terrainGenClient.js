// ═══════════════════════════════════════════════════════════════════
// EV7 — TERRAIN GENERATION, OFF THE MAIN THREAD. buildPixel's kernel
// (terrainGen.js - the ~84,000 perlin calls per pixel) runs in a
// module Worker so the frame keeps painting while a map-pixel
// crossing streams its up-to-13 new pixels in; the browser could not
// paint through the old single-task build, so a healthy crossing read
// as a stutter.
//
// The shape is the RA1 road-bake client's, recovered law for law:
//  - `new Worker(new URL(...))` stays in exactly that spelling
//    (eslint.config.js's own note: Vite's static analysis matches the
//    bare constructor to bundle the worker entry).
//  - The factory is split out and injectable so node never evaluates
//    `new Worker` and tests drive a hand-rolled fake.
//  - The WOODS bytes are COPIED to the worker, never transferred -
//    the reader's own buffer is what heightAt, the ghost rows and the
//    travel map keep reading for the rest of the session, and a
//    transfer would detach it.
//  - THE FALLBACK IS THE OLD PATH, NOT A FAILURE: no Worker (node, a
//    test, an ancient host), a factory that throws, a worker that
//    dies mid-job, or ?terrainthread=off all run the same kernel on
//    this thread - every law lives in modules this thread already
//    holds, so the fallback costs the stall and nothing else.
//  - A FIFO, not a single slot: pump() serializes the streaming
//    queue, but the teleport core builds its destination pixel
//    directly and can overlap a pump build mid-flight.
// ═══════════════════════════════════════════════════════════════════

import { generatePixelTerrain } from './terrainGen.js';

/** The escape hatch, read once at scene build (the ?cull=off shape). */
export function terrainThreadDisabled(search = globalThis.location?.search) {
  try { return /[?&]terrainthread=off\b/.test(search ?? ''); }
  catch { return false; }
}

/** The one place the worker URL is spelled. Split out so tests can
 *  inject a factory and node never evaluates `new Worker`. */
function defaultWorkerFactory() {
  return new Worker(new URL('./terrainGenWorker.js', import.meta.url), { type: 'module' });
}

export class TerrainGenClient {
  /**
   * @param {object} deps
   * @param {object} deps.woods - the MAIN thread's WoodsFile (the
   *   fallback kernel runs over it; never handed to the worker).
   * @param {Uint8Array} [deps.woodsBytes] - the raw WOODS.WLD bytes;
   *   a COPY crosses to the worker once. Absent = same-thread only.
   * @param {?Function} [deps.workerFactory] - test seam.
   */
  constructor({ woods, woodsBytes = null, workerFactory = null } = {}) {
    this._woods = woods;
    this._worker = null;
    this._fifo = [];   // {job, resolve} - the worker answers in arrival order
    const factory = workerFactory
      ?? ((terrainThreadDisabled() || typeof Worker === 'undefined' || !woodsBytes)
        ? null : defaultWorkerFactory);
    if (!factory) return;
    let w = null;
    try {
      w = factory();
      w.onerror = (e) => this._down(e?.message ?? 'terrain worker failed');
      w.onmessage = (ev) => this._answer(ev.data ?? {});
      // a COPY - transferring the reader's own bytes would detach the
      // buffer the rest of the session still reads (the RA1 law)
      const bytes = woodsBytes.slice();
      w.postMessage({ t: 'init', woodsBytes: bytes }, [bytes.buffer]);
      this._worker = w;
    } catch (e) {
      console.warn('[terrain] worker unavailable; generating on the main thread', e);
      // AUDIT EV F-SIM4: a factory that SPAWNED but whose init post
      // threw would otherwise strand a live idle worker for the page
      try { w?.terminate?.(); } catch { /* never spawned or already gone */ }
      this._worker = null;
    }
  }

  /** The kernel's answer, produced off this thread when a worker is
   *  up and on it when one is not. The job's tilemap is CLONED to the
   *  worker (16 KB - and the original must survive for the fallback a
   *  dying worker falls back to); the reply's big arrays arrive
   *  TRANSFERRED. Always resolves - a worker failure resolves through
   *  the same-thread kernel, never rejects. */
  /** ROADS 3: hand the network to both kernels - the worker gets a
   *  COPY (the RA1 law: the arrays this thread keeps are the fallback's)
   *  and this thread keeps its own for the same-thread path. null
   *  clears both. */
  setRoads(net) {
    this._roads = net ? { roads: net.roads, tracks: net.tracks } : null;
    if (this._worker) {
      const copy = this._roads ? { roads: this._roads.roads.slice(), tracks: this._roads.tracks.slice() } : null;
      this._worker.postMessage({ t: 'roads', roads: copy }, copy ? [copy.roads.buffer, copy.tracks.buffer] : []);
    }
  }

  generate(job) {
    if (!this._worker) {
      return Promise.resolve(generatePixelTerrain({ woods: this._woods, roads: this._roads ?? null, ...job }));
    }
    return new Promise((resolve) => {
      this._fifo.push({ job, resolve });
      this._worker.postMessage({ t: 'job', ...job });
    });
  }

  _answer(m) {
    if (m.t !== 'done' && m.t !== 'error') return;
    const p = this._fifo.shift();
    if (!p) return;
    if (m.t === 'error') {
      // this job's inputs are still whole on this side - run them here
      console.warn('[terrain] worker job failed; generating on the main thread -', m.message);
      p.resolve(generatePixelTerrain({ woods: this._woods, roads: this._roads ?? null, ...p.job }));
      return;
    }
    // The reply crosses WHOLE, like the job: the envelope tag comes
    // off and the rest of the kernel's result passes through untouched,
    // so a new generatePixelTerrain output can never be dropped on the
    // worker path alone - the fallback arms resolve the whole object,
    // and node always takes the fallback.
    const { t: _tag, ...out } = m;
    p.resolve(out);
  }

  _down(message) {
    console.warn('[terrain] worker died; generating on the main thread -', message);
    const pending = this._fifo;
    this._fifo = [];
    try { this._worker?.terminate?.(); } catch { /* already gone */ }
    this._worker = null;
    for (const p of pending) p.resolve(generatePixelTerrain({ woods: this._woods, roads: this._roads ?? null, ...p.job }));
  }
}
