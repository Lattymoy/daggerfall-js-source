// ═══════════════════════════════════════════════════════════════════
// MW-TEXTHREAD — THE TEXTURE WORKER. The other half of
// mwTextureClient.js: one 'decode' message hands it a texture file's
// bytes and its archive path, it runs the SAME decoder the main thread
// runs (mwTexture.js decodeTextureImage - the extension picks DDS, TGA
// or BMP) and answers the image with every mip level's pixels
// TRANSFERRED. A 1024x1024 DXT texture with its chain is 55-59 ms of
// decode (Morrowind-Assets.md, MW-LOAD's measurement), and a body build
// decodes dozens of them on the thread that draws the frame.
//
// The shape is unityBundleWorker.js's: answers keyed by the client's
// ids, and this module may import ONLY pure, node-tested modules - no
// ui/, no scenes/, no render/ - because a worker has no DOM and the
// import graph is evaluated whole. `handleDecode` is exported so node
// tests drive the wire without a Worker (named for its one message: the
// one-home scan counts exported names, and unityBundleWorker.js already
// exports a `handle`).
// ═══════════════════════════════════════════════════════════════════

import { decodeTextureImage } from './mwTexture.js';

/** One message in, one message out through `post(msg, transfer)`. */
export function handleDecode(m, post) {
  try {
    if (m.t !== 'decode') throw new Error(`mw texture worker: unknown message ${JSON.stringify(m.t)}`);
    const bytes = m.bytes instanceof Uint8Array ? m.bytes : new Uint8Array(m.bytes);
    const image = decodeTextureImage(m.path, bytes, m.levels == null ? undefined : { levels: m.levels });
    // every level's pixels cross by transfer: the decoder mints a fresh buffer per level
    post({ t: 'image', id: m.id, image }, image.mips.map((l) => l.rgba.buffer));
  } catch (e) {
    post({ t: 'error', id: m.id, message: e?.message ?? String(e) });
  }
}

globalThis.onmessage = (ev) => handleDecode(ev.data ?? {}, (msg, transfer) => globalThis.postMessage(msg, transfer ?? []));
