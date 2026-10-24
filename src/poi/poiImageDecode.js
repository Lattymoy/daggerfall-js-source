// @ts-check
// POI-2 (2026-10-14): A POI'S PICTURE, DECODED BY THE BROWSER THAT DRAWS IT - a PNG, JPEG or WebP (poi/poiImage.js knew
// it by its header before it was stored) to an RGBA raster, TOP row first, as a browser decodes one; poi/poiRuntime.js
// bakeAlbedo turns it to the port's color32 order. The pixels as stored: no premultiplied alpha (a cutout's edge and a
// glass's alpha are the file's own) and no colour-space conversion (the file's numbers are the material's).
//
// AUDIT POI R9: NOT THROUGH A 2D CANVAS. A 2D canvas keeps its pixels premultiplied, whatever the bitmap drawn into it was
// asked to be, so getImageData hands a clear texel back black and a nearly clear one's colour quantised (measured in
// Chromium: a red texel at alpha 0 read 0,0,0,0; (10, 20, 250) at alpha 3 read 0,0,255) - and a filtered cutout's edge
// went dark. The bitmap (premultiplyAlpha 'none', colorSpaceConversion 'none') is uploaded to a WebGL2 texture - an
// ImageBitmap's upload follows the bitmap's own options, so its texels go up as the file has them - and read back through
// a framebuffer (`readPixels`, RGBA bytes): the file's own numbers (the same probe read every one of them back). Where
// WebGL2 is not to be had (no OffscreenCanvas, no context, a lost one, a picture past its MAX_TEXTURE_SIZE) the 2D
// canvas is the fallback, and its loss stands as said; bakeAlbedo's bleed gives every clear texel its neighbours' colour
// whichever way the picture came, so no edge filters dark.
//
// AUDIT POI R8: `decodePoiImageSteps` reads it back in bands - a yield every POI_STEP_UNITS texels - so the POI host runs
// a big picture's readback a time slice a frame; `decodePoiImage` is the whole decode, for the editor's panels.
import { POI_STEP_UNITS } from './poiRuntime.js';

/** The one WebGL2 context pictures are read back through, made at the first: undefined not yet asked, null none. */
let readback;
function readbackGl() {
  if (readback === undefined) {
    try {
      const c = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(1, 1) : null;
      readback = /** @type {any} */ (c?.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false })) ?? null;
    } catch { readback = null; }
  }
  return readback && !readback.isContextLost?.() ? readback : null;
}

/**
 * A picture's steps (AUDIT POI R8): yields the bitmap's promise (the host waits on it), then a bare yield before each
 * band of the readback; returns `{ width, height, data }`. `gl` and `bitmap` are the context and the decoder (a test's own).
 * @param {Uint8Array} bytes
 * @param {{ gl?: any, bitmap?: (blob: Blob, o: any) => Promise<any> }} [o]
 */
export function* decodePoiImageSteps(bytes, { gl = readbackGl(), bitmap = (blob, o) => createImageBitmap(blob, o) } = {}) {
  // a copy the Blob owns (a view over a shared or larger buffer is not a BlobPart)
  const bmp = yield bitmap(new Blob([bytes.slice()]), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  try {
    let read = null;
    if (gl) { try { read = yield* readThroughGl(gl, bmp); } catch { read = null; } }   // a context that throws: the canvas
    return read ?? throughCanvas(bmp);
  } finally {
    bmp.close?.();
  }
}

/** The whole decode, waited on (the editor's panels): `{ width, height, data }`. @param {Uint8Array} bytes */
export async function decodePoiImage(bytes) {
  const it = decodePoiImageSteps(bytes);
  let r = it.next();
  while (!r.done) {
    const v = r.value;
    if (v && typeof v.then === 'function') {
      let got;
      try { got = await v; } catch (e) { r = it.throw(e); continue; }
      r = it.next(got);
    } else r = it.next();
  }
  return r.value;
}

/** The bitmap through a WebGL2 texture and back, a band of rows a step - or null where the context cannot (the 2D
 *  canvas then). Every object it makes is deleted. */
function* readThroughGl(gl, bmp) {
  const w = bmp.width, h = bmp.height;
  if (!(w > 0 && h > 0) || w > gl.getParameter(gl.MAX_TEXTURE_SIZE) || h > gl.getParameter(gl.MAX_TEXTURE_SIZE)) return null;
  const tex = gl.createTexture(), fb = gl.createFramebuffer();
  try {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // an ImageBitmap's upload reads its own options (premultiplyAlpha, colorSpaceConversion, imageOrientation) and not
    // these; set anyway, so no other source could ever go up premultiplied, converted or flipped through here
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bmp);   // row 0 the picture's top, as uploaded
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return null;
    gl.pixelStorei(gl.PACK_ALIGNMENT, 1);
    const data = new Uint8Array(w * h * 4);
    const band = Math.max(1, Math.floor(POI_STEP_UNITS / w));
    for (let y = 0; y < h; y += band) {
      yield null;
      gl.readPixels(0, y, w, Math.min(band, h - y), gl.RGBA, gl.UNSIGNED_BYTE, data, y * w * 4);
    }
    if (gl.getError() !== gl.NO_ERROR || gl.isContextLost?.()) return null;   // an upload refused, a context lost: the canvas
    return { width: w, height: h, data };
  } finally {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
    gl.deleteTexture(tex);
  }
}

/** The 2D canvas's read (the fallback): premultiplied underneath - a clear texel comes back black, a nearly clear one's
 *  colour quantised; a canvas made to be read is asked for as one (systems/textureReplacement.js decodePng's FIELD
 *  2026-09-27 lesson). */
function throughCanvas(bmp) {
  const canvas = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('poi image: no 2d context');
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
  return { width: img.width, height: img.height, data: new Uint8Array(img.data.buffer) };
}
