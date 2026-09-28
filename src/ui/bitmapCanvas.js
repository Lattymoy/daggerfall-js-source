// A PALETTIZED BITMAP, IN A CANVAS.
//
// The classic screens hand every DFBitmap to the GL renderer as a
// texture. The enhanced screens are DOM, so they need the same pixels
// as an <img>-shaped thing, and this is the whole of that: index
// through the palette, alpha from the cutout rule, ImageData into a
// canvas.
//
// THE CUTOUT RULE IS THE PORT'S OWN, and it is not a guess: a
// palettized IMG or CIF is a 1-BIT CUTOUT - index 0 is transparent and
// every other index is opaque (U21d wrote that down when the title
// screen needed the opposite law for a non-classic banner). So there
// is no blending to decide about here, and NEAREST scaling is right
// for the same reason: these are 1996 pixels and they should look it.
//
// No renderer, no GL, nothing to free. A canvas is garbage collected
// with the node that holds it, which is what makes it safe to hand
// straight to a screen that rebuilds its DOM on every repaint.

import { fitIcon, opaqueBounds, ICON_CAP } from './iconFit.js';   // UI1: the fit law, for fitCanvas below

/**
 * @param {{width:number,height:number,data:Uint8Array}} bmp
 * @param {(index:number)=>[number,number,number]} palette
 * @param {{scale?:number}} opts integer scale, NEAREST - a classic
 *        bitmap drawn at a fractional scale aliases, which is the
 *        exact mistake U21d had to give the renderer an opt-in for.
 * @returns {HTMLCanvasElement|null}
 */
export function bitmapCanvas(bmp, palette, { scale = 1 } = {}) {
  if (!bmp?.data?.length || !palette) return null;
  const { width: w, height: h, data } = bmp;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const idx = data[i];
    const o = i * 4;
    if (idx === 0) { img.data[o + 3] = 0; continue; }   // the cutout
    const [r, g, b] = palette(idx);
    img.data[o] = r;
    img.data[o + 1] = g;
    img.data[o + 2] = b;
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  if (scale === 1) return c;

  const out = document.createElement('canvas');
  out.width = w * scale;
  out.height = h * scale;
  const octx = out.getContext('2d');
  if (!octx) return c;
  octx.imageSmoothingEnabled = false;
  octx.drawImage(c, 0, 0, out.width, out.height);
  return out;
}


/**
 * SURV-ART: THE SAME THING FOR ART THAT NEVER HAD A PALETTE.
 *
 * A vendored mod's picture is a decoded PNG, not a palettized DFBitmap
 * - there is no index to look up and no cutout rule to apply, because
 * it carries its own alpha. It arrives in the port's color32 order
 * (`{ width, height, colors }`, row 0 the picture's BOTTOM - see
 * formats/color32Order.js), which is what the GL path wants and the
 * OPPOSITE of what a canvas wants, so the rows are reversed on the way
 * in. NEAREST scaling for the same reason as above.
 *
 * @param {{width:number,height:number,colors:Uint8ClampedArray|Uint8Array}} image
 * @param {{scale?:number}} opts
 * @returns {HTMLCanvasElement|null}
 */
export function color32Canvas(image, { scale = 1 } = {}) {
  const w = image?.width | 0, h = image?.height | 0;
  const src = image?.colors;
  if (!w || !h || !src || src.length < w * h * 4) return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(w, h);
  const row = w * 4;
  for (let y = 0; y < h; y++) {       // row 0 of `colors` is the picture's bottom
    const from = (h - 1 - y) * row;
    for (let i = 0; i < row; i++) img.data[y * row + i] = src[from + i];
  }
  ctx.putImageData(img, 0, 0);
  if (scale === 1) return c;

  const out = document.createElement('canvas');
  out.width = w * scale;
  out.height = h * scale;
  const octx = out.getContext('2d');
  if (!octx) return c;
  octx.imageSmoothingEnabled = false;
  octx.drawImage(c, 0, 0, out.width, out.height);
  return out;
}


// ── UI1: A PICTURE FITTED TO ITS SLOT (ui/iconFit.js's law, carried out) ──
//
// The two doors above draw a record at a WHOLE-NUMBER scale and stop; the sheet then capped what they drew at 30px,
// and a longsword's 176px canvas was crushed to 30 under `image-rendering: pixelated`, which at such a ratio drops
// pixels unevenly. This takes the record at its own size (a canvas either door drew at scale 1) and makes the picture
// the slot draws, at exactly the device size it is drawn at.

/** The alpha a pixel needs to count as drawn when a picture is trimmed: a replacement PNG's faint fringe is not its
 *  sprite (a classic record's cutout is 0 or 255 - U21d's 1-bit rule above). */
export const TRIM_ALPHA = 8;

/**
 * `src` (a canvas at the picture's own size) TRIMMED to its opaque pixels, grown by nearest neighbour to the law's
 * `prescale`, and - where the law says `smooth` - brought down to its size by smooth resampling, halving while it is
 * still twice too big (one bilinear pass over a larger ratio skips pixels: the unevenness this replaces).
 * `{ canvas, cssW, cssH, smooth }`, or null for a picture with nothing drawn or a page with no 2D canvas.
 * UI2: `trim: false` keeps the whole picture - a spell's icon is a square tile, its dark border part of it, and a
 * trimmed one would stand a different size from its neighbours.
 * @param {HTMLCanvasElement} src
 * @param {{ box: number, dpr?: number, cap?: number, trim?: boolean }} opts
 */
export function fitCanvas(src, { box, dpr = 1, cap = ICON_CAP, trim = true } = /** @type {any} */ ({})) {
  const w = src?.width | 0, h = src?.height | 0;
  const sctx = w && h ? src.getContext?.('2d') : null;
  if (!sctx) return null;
  const { data } = sctx.getImageData(0, 0, w, h);
  const b = trim ? opaqueBounds(w, h, (x, y) => data[(y * w + x) * 4 + 3] > TRIM_ALPHA) : { x: 0, y: 0, w, h };
  const f = b ? fitIcon(b.w, b.h, { box, dpr, cap }) : null;
  if (!b || !f) return null;
  const bigW = b.w * f.prescale, bigH = b.h * f.prescale;
  let cur = paintedCanvas(bigW, bigH, false, (c) => c.drawImage(src, b.x, b.y, b.w, b.h, 0, 0, bigW, bigH));
  if (cur && f.smooth) {
    while (cur && cur.width >= 2 * f.outW && cur.height >= 2 * f.outH) {
      const from = cur, hw = Math.ceil(from.width / 2), hh = Math.ceil(from.height / 2);
      cur = paintedCanvas(hw, hh, true, (c) => c.drawImage(from, 0, 0, hw, hh));
    }
    const from = cur;
    cur = from && paintedCanvas(f.outW, f.outH, true, (c) => c.drawImage(from, 0, 0, f.outW, f.outH));
  }
  return cur ? { canvas: cur, cssW: f.cssW, cssH: f.cssH, smooth: f.smooth } : null;
}

/** A `w` x `h` canvas painted by `paint`, nearest neighbour or smooth (the best the browser's smoothing has). */
function paintedCanvas(w, h, smooth, paint) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = smooth;
  if (smooth) ctx.imageSmoothingQuality = 'high';
  paint(ctx);
  return c;
}
