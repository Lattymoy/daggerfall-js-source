// AUDIT VE P1 - THE SHIPPED PACK'S PICTURES, MADE OFF THE MAIN THREAD.
// OWN-WORK4: a pack's picture is built here - the page posts the player's classic record and its spec, and
// this runs our rule (systems/ownTextures/ownTextureRules.js applyOwnRule), the same pixels the page's fallback makes.
// FIRST-VISIT: a served PNG is decoded and fitted here (mipFitSize, resampleRgba). The pixels come back moved.
//
// Protocol: in `{ id, url, maxSize }` (a PNG to decode and fit) or `{ id, build, source }` (a spec and its classic
// record); out `{ id, width, height, data }` (data transferred) or `{ id, error, unsupported }` - `unsupported` when this
// browser has no OffscreenCanvas in a worker, and the page decodes on its own thread instead.
import { resampleRgba, mipFitSize } from '../../formats/resample.js';
import { applyOwnRule } from '../ownTextures/ownTextureRules.js';

globalThis.onmessage = async (ev) => {
  const { id, url, maxSize = Infinity, build, source } = ev.data ?? {};
  try {
    if (build) {
      const pic = applyOwnRule(build, source);
      const data = pic.data instanceof Uint8Array ? pic.data : new Uint8Array(pic.data.buffer);
      globalThis.postMessage({ id, width: pic.width, height: pic.height, data }, [data.buffer]);
      return;
    }
    if (typeof OffscreenCanvas !== 'function' || typeof createImageBitmap !== 'function') {
      globalThis.postMessage({ id, error: 'no OffscreenCanvas in a worker', unsupported: true });
      return;
    }
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    const bmp = await createImageBitmap(await r.blob());
    const ctx = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
    bmp.close?.();
    let out = { width: img.width, height: img.height, data: new Uint8Array(img.data.buffer) };
    const [w, h] = mipFitSize(out.width, out.height, maxSize);
    if (w !== out.width || h !== out.height) {
      const s = resampleRgba(out, w, h);
      out = { width: s.width, height: s.height, data: new Uint8Array(s.data.buffer) };
    }
    globalThis.postMessage({ id, width: out.width, height: out.height, data: out.data }, [out.data.buffer]);
  } catch (e) {
    globalThis.postMessage({ id, error: String(e?.message ?? e), unsupported: false });
  }
};
