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

let bundle = null;
let byName = null;   // texture name -> the index entry (first of a name wins, as the door's own index did)

/** One message in, one message out through `post(msg, transfer)`. */
export function handle(m, post) {
  try {
    if (m.t === 'open') {
      const bytes = m.bytes instanceof Uint8Array ? m.bytes : new Uint8Array(m.bytes);
      bundle = readUnityBundle(bytes);
      byName = new Map();
      for (const t of bundle.textures) if (!byName.has(t.name)) byName.set(t.name, t);
      const textAssets = bundle.textAssets.map((t) => ({ name: t.name, bytes: t.bytes.slice() }));
      const textures = bundle.textures.map((t) => ({ name: t.name, width: t.width, height: t.height, format: t.format }));
      post({ t: 'opened', id: m.id, textAssets, textures }, textAssets.map((t) => t.bytes.buffer));
      return;
    }
    if (m.t === 'rgba') {
      const tex = byName?.get(m.name);
      if (!tex) { post({ t: 'rgba', id: m.id, image: null }); return; }
      const img = tex.rgba();
      // a fresh buffer of exactly the pixels: the decoder may answer a view
      const data = img.data.byteOffset === 0 && img.data.byteLength === img.data.buffer.byteLength ? img.data : img.data.slice();
      post({ t: 'rgba', id: m.id, image: { width: img.width, height: img.height, data } }, [data.buffer]);
      return;
    }
    if (m.t === 'close') { bundle = null; byName = null; return; }
    post({ t: 'error', id: m.id, message: `unity bundle worker: unknown message ${JSON.stringify(m.t)}` });
  } catch (e) {
    post({ t: 'error', id: m.id, message: e?.message ?? String(e) });
  }
}

globalThis.onmessage = (ev) => handle(ev.data ?? {}, (msg, transfer) => globalThis.postMessage(msg, transfer ?? []));
