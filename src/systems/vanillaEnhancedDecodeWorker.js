// AUDIT VE P1 (2026-10-05, Mac: "performance isn't affected") - THE SHIPPED PACK'S PICTURES, DECODED OFF THE MAIN THREAD.
//
// An attached .dfmod decodes in its bundle worker (formats/unityBundleWorker.js). The shipped pack's PNGs were decoded on
// the page's own thread: createImageBitmap's decode is the browser's, but the readback (drawImage and getImageData, about
// 1.7 ms for a 256-pixel tile) and the texture detail's box filter (resampleRgba - tens of ms for a 726x941 tree) were the
// main thread's, in the middle of frames while the world streams. Here they are this worker's: it fetches the file,
// decodes it, fits it to the detail as a mip chain would (mipFitSize), and hands the pixels back without a copy. The
// pixels are decodePng's and resampleRgba's, the same as the page's own fallback draws.
//
// Protocol: in `{ id, url, maxSize }`; out `{ id, width, height, data }` (data transferred) or `{ id, error, unsupported }`
// - `unsupported` when this browser has no OffscreenCanvas in a worker, and the page decodes on its own thread instead.
import { resampleRgba, mipFitSize } from '../formats/resample.js';

globalThis.onmessage = async (ev) => {
  const { id, url, maxSize = Infinity } = ev.data ?? {};
  try {
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
