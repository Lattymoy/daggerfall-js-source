// ═══════════════════════════════════════════════════════════════════
// DW1 — THE BUNDLE WORKER. The other half of unityBundleClient.js:
// one 'open' message hands it a mod's `.dfmod` bytes, it reads the
// UnityFS container and indexes the objects ONCE (readUnityBundle -
// for Diverse Weapons that is 25,868 objects behind 58 MB of LZ4,
// ~10 s the main thread could not afford), and answers the index:
// every TextAsset whole (a manifest is a few KB) and every Texture2D
// by name and size, no pixels. A 'rgba' message then decodes ONE
// texture by name and answers its RGBA with the buffer TRANSFERRED -
// the reader's blocks stay compressed on this side (unityBundle.js's
// blockStream), so a bundle open here is the bytes plus a few MB.
//
// The shape is terrainGenWorker.js's: one worker, one bundle, answers
// keyed by the client's ids, and this module may import ONLY pure,
// node-tested modules - no ui/, no scenes/, no render/ - because a
// worker has no DOM and the import graph is evaluated whole. `handle`
// is exported so node tests drive the wire without a Worker.
// ═══════════════════════════════════════════════════════════════════

import { readUnityBundle } from './unityBundle.js';

/** DFMOD2: a Blob as a byte source, read by range - FileReaderSync exists only in a worker, which is where a
 *  multi-gigabyte `.dfmod` is opened: only the header, the block directory and the blocks a picture spans are ever
 *  read, never the file whole. */
export function blobSource(blob, Reader = globalThis.FileReaderSync) {
  const fr = new Reader();
  return { size: blob.size, slice: (a, b) => new Uint8Array(fr.readAsArrayBuffer(blob.slice(a, Math.min(blob.size, b)))) };
}

/** DFMOD3: ONE WORKER, MANY BUNDLES. A message's `bid` names the bundle it is about (none = slot 0, the one-bundle
 *  shape every existing caller speaks). A player-attached mod set is ten-plus bundles, and a worker each was ten-plus
 *  V8 heaps in one tab, each growing on its own garbage before it collected - the "Array buffer allocation failed"
 *  a player hit with DREAM's HD set. The pool (unityBundlePool.js) opens every bundle in each of its few workers. */
const slots = new Map();   // bid -> { bundle, byName, maxTextureSize }

/** One message in, one message out through `post(msg, transfer)`. */
export function handle(m, post) {
  const bid = m.bid ?? 0;
  try {
    if (m.t === 'open') {
      const bytes = m.blob ? blobSource(m.blob) : m.bytes instanceof Uint8Array ? m.bytes : new Uint8Array(m.bytes);   // DFMOD2: a Blob by range
      const maxTextureSize = Number.isFinite(m.maxTextureSize) ? m.maxTextureSize : Infinity;
      const bundle = readUnityBundle(bytes, { maxTextureSize, knownTextures: m.knownTextures ?? null });   // DFMOD2: a stored index skips the heads
      const byName = new Map();   // texture name -> the index entry (first of a name wins, as the door's own index did)
      for (const t of bundle.textures) if (!byName.has(t.name)) byName.set(t.name, t);
      slots.set(bid, { bundle, byName, maxTextureSize });
      if (m.quiet) { post({ t: 'opened', id: m.id, textAssets: [], textures: [] }); return; }   // DFMOD3: the pool already holds the index
      const textAssets = bundle.textAssets.map((t) => ({ name: t.name, bytes: t.bytes.slice() }));
      const textures = bundle.textures.map((t) => ({ name: t.name, width: t.width, height: t.height, format: t.format }));
      const arrays = (bundle.arrays ?? []).map((a) => ({ name: a.name, width: a.width, height: a.height, depth: a.depth }));   // GROUND1
      post({ t: 'opened', id: m.id, textAssets, textures, arrays }, textAssets.map((t) => t.bytes.buffer));
      return;
    }
    if (m.t === 'layers') {   // GROUND1: every slice of a texture array (DREAM's terrain), top-down RGBA each
      const slot = slots.get(bid);
      const arr = slot?.bundle.arrays?.find((a) => a.name === m.name);
      if (!arr) { post({ t: 'layers', id: m.id, images: null }); return; }
      const images = arr.layers().map((img) => ({ width: img.width, height: img.height, data: img.data.byteOffset === 0 && img.data.byteLength === img.data.buffer.byteLength ? img.data : img.data.slice() }));
      post({ t: 'layers', id: m.id, images }, images.map((i) => i.data.buffer));
      return;
    }
    if (m.t === 'rgba') {
      const slot = slots.get(bid);
      const tex = slot?.byName.get(m.name);
      if (!tex) { post({ t: 'rgba', id: m.id, image: null }); return; }
      const img = tex.rgba({ maxSize: Number.isFinite(m.maxSize) ? m.maxSize : slot.maxTextureSize });   // DFMOD2: a smaller mip when asked
      // a fresh buffer of exactly the pixels: the decoder may answer a view
      const data = img.data.byteOffset === 0 && img.data.byteLength === img.data.buffer.byteLength ? img.data : img.data.slice();
      post({ t: 'rgba', id: m.id, image: { width: img.width, height: img.height, data } }, [data.buffer]);
      return;
    }
    if (m.t === 'close') { slots.delete(bid); return; }
    post({ t: 'error', id: m.id, message: `unity bundle worker: unknown message ${JSON.stringify(m.t)}` });
  } catch (e) {
    post({ t: 'error', id: m.id, message: e?.message ?? String(e) });
  }
}

globalThis.onmessage = (ev) => handle(ev.data ?? {}, (msg, transfer) => globalThis.postMessage(msg, transfer ?? []));
