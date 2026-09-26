// ═══════════════════════════════════════════════════════════════════
// MW-TEXTHREAD — MORROWIND TEXTURES, DECODED OFF THE MAIN THREAD, IN
// PARALLEL.
//
// A Morrowind build decodes every texture its pieces name - the arms,
// the third-person body's skin and clothes and armour, the weapon - and
// MW-LOAD measured the decoder at 55-59 ms for one 1024x1024 DXT
// texture with its mip chain, 11-13 ms at 512 (Morrowind-Assets.md).
// Each of them ran on the thread that draws the frame, one after
// another, while the world was loading around the player. This client
// hands them to a small pool of module Workers (mwTextureWorker.js)
// that run the SAME decoder, several at once, and answers the SAME
// image - `{ width, height, mips: [{ width, height, rgba }] }`, the
// pixels transferred back.
//
// The shape is unityBundleClient.js's, law for law:
//  - `new Worker(new URL(...))` stays in exactly that spelling
//    (eslint.config.js's note: Vite's static analysis matches the bare
//    constructor to bundle the worker entry).
//  - The factory is injectable, so node never evaluates `new Worker`
//    and a test drives a hand-rolled fake.
//  - The bytes are COPIED to the worker, never transferred: the
//    caller's own bytes are what the fallback reads if the worker dies
//    before it answers.
//  - THE FALLBACK IS THE OLD PATH, NOT A FAILURE: no Worker (node, a
//    test, an old host), a factory that throws, a worker that dies, or
//    ?texturethread=off decode on this thread with the same decoder -
//    the fallback costs the stall and nothing else.
//  - A DECODER ERROR IS NOT A DEAD WORKER: the worker answered, the
//    decoder is pure, and the same bytes would fail here too - the
//    error is the answer (rejected, `decoderError` set), and the file
//    is not decoded twice.
// ═══════════════════════════════════════════════════════════════════

import { decodeTextureImage } from './mwTexture.js';

/** The most workers the pool opens. A build asks for dozens of decodes
 *  at once; past a few the cores are the limit, not the pool. */
export const TEXTURE_WORKERS_MAX = 4;

/** The escape hatch, read once per pool (the ?terrainthread=off shape). */
export function textureThreadDisabled(search = globalThis.location?.search) {
  try { return /[?&]texturethread=off\b/.test(search ?? ''); }
  catch { return false; }
}

/** The one place the worker URL is spelled. Split out so tests can
 *  inject a factory and node never evaluates `new Worker`. */
function defaultWorkerFactory() {
  return new Worker(new URL('./mwTextureWorker.js', import.meta.url), { type: 'module' });
}

/** How many workers: one core is the frame's, and never more than the cap. */
export function texturePoolSize(cores = globalThis.navigator?.hardwareConcurrency) {
  const n = Number.isFinite(cores) && cores > 0 ? Math.floor(cores) : 2;
  return Math.max(1, Math.min(TEXTURE_WORKERS_MAX, n - 1));
}

/**
 * A pool of texture workers. `decode(path, bytes, { levels })` resolves
 * the decoder's image, off this thread when a worker can be had and on
 * it when not; a decoder error rejects with `decoderError: true`
 * whichever thread ran it. A worker that dies takes the jobs it held
 * back to this thread and leaves the pool; a pool whose every worker
 * died (or whose factory throws) decodes here from then on.
 */
export function createTexturePool({ workerFactory = null, size = texturePoolSize() } = {}) {
  const factory = workerFactory
    ?? ((textureThreadDisabled() || typeof Worker === 'undefined') ? null : defaultWorkerFactory);
  const here = (path, bytes, levels) => {
    try { return Promise.resolve(decodeTextureImage(path, bytes, levels == null ? undefined : { levels })); }
    catch (e) { return Promise.reject(Object.assign(e instanceof Error ? e : new Error(String(e)), { decoderError: true })); }
  };
  const slots = [];   // { w, jobs: Map<id, {path, bytes, levels, resolve, reject}> }
  let dead = !factory;
  let opened = 0;
  let nextId = 1;
  const stats = { offThread: 0, onThread: 0, workers: 0 };

  const drop = (slot, why) => {
    const i = slots.indexOf(slot);
    if (i < 0) return;   // once: onerror and a failed post both reach here
    slots.splice(i, 1);
    try { slot.w.terminate?.(); } catch { /* already gone */ }
    // the jobs it held go back to this thread - the caller's bytes are still whole
    for (const j of slot.jobs.values()) { stats.onThread++; here(j.path, j.bytes, j.levels).then(j.resolve, j.reject); }
    slot.jobs.clear();
    if (!slots.length && opened >= size) { dead = true; console.warn('[mw textures] workers unavailable; decoding on the main thread -', why); }
  };
  const open = () => {
    opened++;
    const slot = { w: null, jobs: new Map() };
    try {
      slot.w = factory();
      slot.w.onerror = (e) => drop(slot, e?.message ?? 'mw texture worker failed');
      slot.w.onmessage = (ev) => {
        const m = ev.data ?? {};
        const j = slot.jobs.get(m.id);
        if (!j) return;
        slot.jobs.delete(m.id);
        if (m.t === 'image') j.resolve(m.image);
        else j.reject(Object.assign(new Error(m.message ?? 'mw texture worker error'), { decoderError: true }));
      };
      slots.push(slot);
      stats.workers = slots.length;
      return slot;
    } catch (e) {
      try { slot.w?.terminate?.(); } catch { /* never spawned */ }
      if (!slots.length) { dead = true; console.warn('[mw textures] workers unavailable; decoding on the main thread -', e?.message ?? e); }
      return null;
    }
  };
  /** The least-busy worker; a new one while the pool is short and every open one is busy. */
  const pick = () => {
    let best = null;
    for (const s of slots) if (!best || s.jobs.size < best.jobs.size) best = s;
    if ((!best || best.jobs.size > 0) && opened < size) return open() ?? best;
    return best;
  };

  return {
    stats,
    /** @returns {Promise<{width:number, height:number, mips:{width:number, height:number, rgba:Uint8Array}[]}>} */
    decode(path, bytes, { levels = null } = {}) {
      const slot = dead ? null : pick();
      if (!slot) { stats.onThread++; return here(path, bytes, levels); }
      return new Promise((resolve, reject) => {
        const id = nextId++;
        slot.jobs.set(id, { path, bytes, levels, resolve, reject });
        // a COPY: the caller's bytes are the fallback's if this never answers
        const copy = bytes.slice();
        try { slot.w.postMessage({ t: 'decode', id, path, bytes: copy, levels }, [copy.buffer]); stats.offThread++; }
        catch (e) { drop(slot, e?.message ?? 'mw texture worker refused a job'); }
      });
    },
    /** Close every worker; later decodes run on this thread. */
    close() { dead = true; for (const s of [...slots]) { slots.splice(slots.indexOf(s), 1); try { s.w.terminate?.(); } catch { /* gone */ } for (const j of s.jobs.values()) here(j.path, j.bytes, j.levels).then(j.resolve, j.reject); } },
  };
}

/** The page's one pool, opened on the first decode. */
let _pool = null;
export function decodeTextureOffThread(path, bytes, opts) {
  _pool ??= createTexturePool();
  return _pool.decode(path, bytes, opts);
}
/** Test seams: drop the page's pool (the next decode opens a fresh one), or stand one in its place. */
export function _resetTexturePool() { try { _pool?.close(); } catch { /* gone */ } _pool = null; }
export function _useTexturePool(pool) { _resetTexturePool(); _pool = pool; }
