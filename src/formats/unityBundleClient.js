// ═══════════════════════════════════════════════════════════════════
// DW1 — A MOD'S BUNDLE, OPENED OFF THE MAIN THREAD.
//
// Diverse Weapons' `.dfmod` is 58 MB of LZ4 around 1.69 GB of pixels
// in one serialized file: indexing it is ~10 s of decompression, and
// the first weapon draw after the bundle is attached used to pay that
// on the frame. This client opens a bundle in a module Worker
// (unityBundleWorker.js) and answers the same three things the door
// read off `readUnityBundle` directly: the text assets (the manifest),
// the texture index by name, and one texture's RGBA on demand.
//
// The shape is terrainGenClient.js's, law for law:
//  - `new Worker(new URL(...))` stays in exactly that spelling
//    (eslint.config.js's note: Vite's static analysis matches the bare
//    constructor to bundle the worker entry).
//  - The factory is injectable, so node never evaluates `new Worker`
//    and a test drives a hand-rolled fake.
//  - The bytes are COPIED to the worker, never transferred: the copy
//    is one memcpy, and the caller's own bytes are what the fallback
//    reads if the worker dies before it answers.
//  - THE FALLBACK IS THE OLD PATH, NOT A FAILURE: no Worker (node, a
//    test, an old host), a factory that throws, a worker that dies
//    before its index lands, or ?bundlethread=off all open the bundle
//    on this thread with the same reader - the fallback costs the
//    stall and nothing else. A worker that dies AFTER the index landed
//    rejects the asks in flight and every ask after; the door treats a
//    rejected ask as that name missing, which is the classic frame.
// ═══════════════════════════════════════════════════════════════════

import { readUnityBundle } from './unityBundle.js';

const utf8 = (b) => new TextDecoder('utf-8').decode(b);

/** The escape hatch, read once per open (the ?terrainthread=off shape). */
export function bundleThreadDisabled(search = globalThis.location?.search) {
  try { return /[?&]bundlethread=off\b/.test(search ?? ''); }
  catch { return false; }
}

/** The one place the worker URL is spelled. Split out so tests can
 *  inject a factory and node never evaluates `new Worker`. */
function defaultWorkerFactory() {
  return new Worker(new URL('./unityBundleWorker.js', import.meta.url), { type: 'module' });
}

/** The same bundle, opened on this thread - the fallback, and node.
 *  Answers the client's shape over the reader's own objects. */
export function openBundleHere(bytes) {
  const bundle = readUnityBundle(bytes);
  const byName = new Map();
  for (const t of bundle.textures) if (!byName.has(t.name)) byName.set(t.name, t);
  return {
    onThread: true,
    textAssets: bundle.textAssets.map((t) => ({ name: t.name, bytes: t.bytes, get text() { return utf8(t.bytes); } })),
    textures: bundle.textures.map((t) => ({ name: t.name, width: t.width, height: t.height, format: t.format })),
    rgba: async (name) => { const tex = byName.get(name); return tex ? tex.rgba() : null; },
    close() { byName.clear(); },
  };
}

/**
 * Open a bundle: in a worker when one can be had, else here. Resolves
 * to `{ onThread, textAssets: [{ name, bytes, text }], textures:
 * [{ name, width, height, format }], rgba(name) -> Promise<{ width,
 * height, data } | null>, close() }` - `data` is the decoder's own
 * RGBA (Unity's bottom-up rows; the caller flips, as the door does).
 * Never rejects on the worker's account: a worker that cannot open
 * the bundle falls back to this thread, and only the reader's own
 * error on this thread is thrown.
 */
export async function openUnityBundle(bytes, { workerFactory = null } = {}) {
  const factory = workerFactory
    ?? ((bundleThreadDisabled() || typeof Worker === 'undefined') ? null : defaultWorkerFactory);
  if (!factory) return openBundleHere(bytes);
  let w = null;
  const pending = new Map();
  let nextId = 1;
  let dead = null;
  const down = (why) => {
    if (dead) return;   // once: onerror and the catch below both reach here
    dead = new Error(why);
    for (const p of pending.values()) p.reject(dead);
    pending.clear();
    try { w?.terminate?.(); } catch { /* already gone */ }
  };
  const ask = (msg, transfer = []) => new Promise((resolve, reject) => {
    if (dead) { reject(dead); return; }
    const id = nextId++;
    pending.set(id, { resolve, reject });
    try { w.postMessage({ ...msg, id }, transfer); }
    catch (e) { pending.delete(id); reject(e); }
  });
  try {
    w = factory();
    w.onerror = (e) => down(e?.message ?? 'unity bundle worker failed');
    w.onmessage = (ev) => {
      const m = ev.data ?? {};
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      if (m.t === 'error') p.reject(new Error(m.message)); else p.resolve(m);
    };
    // a COPY: the caller's bytes are the fallback's if this never answers
    const copy = bytes.slice();
    const opened = await ask({ t: 'open', bytes: copy }, [copy.buffer]);
    return {
      onThread: false,
      textAssets: opened.textAssets.map((t) => ({ name: t.name, bytes: t.bytes, get text() { return utf8(t.bytes); } })),
      textures: opened.textures,
      rgba: async (name) => (await ask({ t: 'rgba', name })).image ?? null,
      close() { try { w.postMessage({ t: 'close' }); } catch { /* gone */ } down('unity bundle worker closed'); },
    };
  } catch (e) {
    console.warn('[unity bundle] worker unavailable; opening on the main thread', e?.message ?? e);
    down(e?.message ?? 'unity bundle worker failed');
    return openBundleHere(bytes);
  }
}
