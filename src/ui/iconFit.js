// UI1 (2026-09-27, the Plus UI pass - bible/10-UI/Slots-Hotbar-Status.md; Mac: "make the actual inventory plots have
// the rarity frame with sprites enlarged properly, instead of the inventory icon just plopping into a slot"):
// THE FIT LAW - how big an item's picture is drawn in its slot, and how.
//
// Pure: the numbers alone. The canvas that carries them out is bitmapCanvas.js's `fitCanvas`, the cache
// textureCanvas.js's `requestFittedIcon`, the element enhancedInventory.js's `fittedImg`.
//
// UI0 measured the records the game mints: a weapon's longest side is 86px at the median (a staff 141), armour 57,
// clothing 62, a gem 11. Every one was made at twice its size and then CAPPED by the sheet at 30px - a longsword
// crushed nearly six times, under `image-rendering: pixelated`, which at such a ratio drops pixels unevenly; a gem left
// at 18px in a 56px slot. So a picture is fitted to its slot's BOX in DEVICE pixels, and made at exactly that size:
//   - its transparent margin is trimmed first (`opaqueBounds`) - the margin is not the sprite;
//   - its longest side is scaled to the box, never past ICON_CAP CSS pixels a source pixel (a gem is not a boulder);
//   - a WHOLE-number scale is nearest neighbour alone - each source pixel exactly `k` device pixels - and the scale is
//     SNAPPED down to the whole number under it when that keeps at least SNAP of the size (a 20px ring in a 48px box
//     is 40px of whole pixels, not 48 of resampled ones);
//   - any other scale over one is sharp bilinear: nearest neighbour up to the next whole number (`prescale`), then one
//     smooth resample down to the size - crisp pixels without the uneven drops;
//   - a scale UNDER one is a smooth, area-averaged reduction, never a pixelated one.

/** The most CSS pixels one source pixel may grow to: a 9px gem in a 48px box stands 36px tall, not 48. */
export const ICON_CAP = 4;
/** The share of the fitted size a whole-number scale must keep to be taken instead: whole pixels over a few more. */
export const SNAP = 0.75;
/** The device pixel ratios the law honours: a browser zoomed out reports under one (67% is 0.67 on a plain screen)
 *  and is drawn at it down to a half; a page zoomed past four draws what four draws. */
const DPR_MIN = 0.5, DPR_MAX = 8;   // AUDIT UI A6: 8, not 4 - a 3x phone at HUD scale 1.5 draws at 4.5, and 4 made it 1.125 too small

/** A usable device pixel ratio: finite, within [0.5, 8] (a screen's ratio times the HUD's scale); anything else reads as 1. */
export const clampDpr = (dpr) => (Number.isFinite(dpr) && dpr > 0 ? Math.min(DPR_MAX, Math.max(DPR_MIN, dpr)) : 1);

/**
 * A picture of `w` x `h` source pixels fitted to a box `box` CSS pixels a side, at `dpr`: `{ prescale, outW, outH,
 * smooth, cssW, cssH }` - nearest neighbour to `prescale` times the source, then (when `smooth`) a smooth resample to
 * `outW` x `outH` device pixels, drawn at `cssW` x `cssH` CSS pixels. Null for a picture or a box with no size.
 * @param {number} w @param {number} h @param {{ box: number, dpr?: number, cap?: number }} opts
 */
export function fitIcon(w, h, { box, dpr = 1, cap = ICON_CAP } = /** @type {any} */ ({})) {
  if (!(w > 0) || !(h > 0) || !(box > 0)) return null;
  const r = clampDpr(dpr);
  const boxDev = Math.max(1, Math.floor(box * r));
  const side = Math.max(w, h);
  const s = Math.min(boxDev / side, (cap > 0 ? cap : ICON_CAP) * r);   // device pixels a source pixel
  const whole = Math.floor(s + 1e-9);
  if (whole >= 1 && whole / s >= SNAP) {
    return { prescale: whole, outW: w * whole, outH: h * whole, smooth: false, cssW: (w * whole) / r, cssH: (h * whole) / r };
  }
  const outW = Math.max(1, Math.round(w * s)), outH = Math.max(1, Math.round(h * s));
  return { prescale: s > 1 ? Math.ceil(s) : 1, outW, outH, smooth: true, cssW: outW / r, cssH: outH / r };
}

/**
 * The opaque part of a picture `w` x `h`: `{ x, y, w, h }` in its own pixels, or null when nothing is drawn.
 * `drawn(x, y)` answers whether a pixel is opaque (an index that is not the cutout, an alpha over nothing).
 * @param {number} w @param {number} h @param {(x: number, y: number) => boolean} drawn
 */
export function opaqueBounds(w, h, drawn) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!drawn(x, y)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * THE BOXES, one a surface, in CSS pixels - the picture's room in its slot: the room inside the slot's frame, less two
 * pixels a side, so a sprite never touches its frame (each pinned against its sheet's numbers: test/ui1_slots.test.js).
 * A slot the page draws smaller than its box (a worn pair's half, a narrow shelf) shrinks the picture whole and
 * smoothly (ui/textureCanvas.js fittedImg).
 */
export const SLOT_BOX = Object.freeze({
  grid: 48,           // the pack's grid: a 64px slot framed round a 52px room
  gridPhone: 40,      // ...a phone's: a 56px slot round a 44px room, so a 390px screen keeps six a row
  worn: 28,           // a worn panel's picture below a desktop: a 34px tile with no edge of its own (the panel is the frame) - three a side
  wornHalf: 22,       // ...a half panel's there: a 28px tile over its name
  wornWide: 48,       // a desktop's panel: a room up to 56px (54 inside its edge) - the grid's own box, one picture for both
  wornHalfWide: 38,   // a desktop's half panel: a room up to 44px, over its name
  loot: 30,           // a loot row's picture: a 38px tile in its frame
  row: 26,            // the shop's and a player trade's rows: a 34px tile in its frame
  socket: 32,         // the accessory shelf's socket: 44px on a desktop's shelf, 36 inside its frame and padding
  card: 96,           // the hover card and the pack's detail card: the picture's own 96px box, no frame
  broker: 32,         // the Sigil Broker's offer: a 36px tile inside its 44px frame
});
/** The pack's own phone line (ui/enhancedStyle.js's `@media (max-width: 640px)`). */
export const PHONE_QUERY = '(max-width: 640px)';
/** The screen's device pixel ratio, as the law honours it. */
export const screenDpr = () => clampDpr(globalThis.devicePixelRatio);
/** The pack grid's box on this screen: a phone's slot is smaller. A page with no `matchMedia` (node) is a desktop. */
export const gridBox = () => (globalThis.matchMedia?.(PHONE_QUERY)?.matches ? SLOT_BOX.gridPhone : SLOT_BOX.grid);
/** The pack's desktop line (ui/enhancedStyle.js's `@media (min-width: 1000px)`): the body's slots are plates there. */
export const WIDE_QUERY = '(min-width: 1000px)';
/** A worn panel's box on this screen - `half`, a split panel's. A page with no `matchMedia` (node) is not wide. */
export const wornBox = (half = false) => (globalThis.matchMedia?.(WIDE_QUERY)?.matches
  ? (half ? SLOT_BOX.wornHalfWide : SLOT_BOX.wornWide) : (half ? SLOT_BOX.wornHalf : SLOT_BOX.worn));
