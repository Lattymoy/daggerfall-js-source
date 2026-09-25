// PORT1: CLASSIC ART, FOR THE DOM - the pictures the ported windows show.
//
// The ported windows (ui/enhancedPorts.js) draw no canvas, but a spell
// is still chosen by its icon, an ingredient is still a picture, and a
// summoned daedra is still an animation. The item icons already have a
// DOM door (ui/textureCanvas.js requestIcon, the one the enhanced shop
// and pack use); this adds the two the ports need beside it: a sheet
// IMG cut into icons (ICON00I0's spell icons), and a raw frame
// ({ width, height, colors }, what the FLC player hands out) painted
// into a canvas. Both are OPTIONAL in the way requestIcon is: a missing
// file answers null, the window draws its words, and nothing throws.

import { inventoryItemImage } from '../systems/itemTemplates.js';
import { itemLongName } from '../systems/itemInfo.js';   // RF6: the one resolver - the name every other enhanced list reads
import { requestIcon } from './textureCanvas.js';
import { SPELL_ICON_COUNT, SPELL_ICON_ROW_COUNT } from './spellIcons.js';

/** An item's icon as a data URL (null until it has loaded), and its name. */
export function itemIconUrl(item, identity = undefined) {
  const img = item ? inventoryItemImage(item, identity) : null;
  return img?.archive != null ? requestIcon(img.archive, img.record, { scale: 2, dye: img.dye }) : null;
}
export function itemName(item) {
  try { return itemLongName(item) || 'Item'; } catch { return 'Item'; }
}

// ── A SHEET IMG, CUT ───────────────────────────────────────────────
const sheets = new Map();   // name -> Promise<HTMLCanvasElement|null>
const cuts = new Map();     // `${name}:${x},${y},${w},${h}` -> dataURL | null

function loadSheet(name) {
  if (sheets.has(name)) return sheets.get(name);
  const p = (async () => {
    try {
      const [{ ImgFile }, { DFPalette }, { getBytes }, { bitmapToColor32 }] = await Promise.all([
        import('../formats/imgFile.js'), import('../formats/dfPalette.js'),
        import('../scenes/dataSource.js'), import('../formats/color32Order.js'),
      ]);
      const pal = new DFPalette();
      pal.load(await getBytes('ART_PAL.COL'), 'ART_PAL.COL');
      const img = new ImgFile();
      if (!img.load(await getBytes(name), name, pal)) return null;
      const { width, height, colors } = bitmapToColor32(img.getDFBitmap(), pal);
      const cv = document.createElement('canvas');
      cv.width = width; cv.height = height;
      cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(colors.buffer), width, height), 0, 0);
      return cv;
    } catch (e) {
      console.warn(`[port] ${name} unavailable; the window shows words`, e);
      return null;
    }
  })();
  sheets.set(name, p);
  return p;
}

/** A sub-rect of a sheet IMG as a data URL, scaled up by whole pixels;
 *  null until it has loaded (the next draw asks again and gets it). */
export function sheetCutUrl(name, [x, y, w, h], scale = 2) {
  const key = `${name}:${x},${y},${w},${h}@${scale}`;
  if (cuts.has(key)) return cuts.get(key);
  cuts.set(key, null);
  loadSheet(name).then((sheet) => {
    if (!sheet) return;
    const out = document.createElement('canvas');
    out.width = w * scale; out.height = h * scale;
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sheet, x, y, w, h, 0, 0, out.width, out.height);
    cuts.set(key, out.toDataURL('image/png'));
  });
  return null;
}

/** Spell icon `index` from ICON00I0 (20 to a row, square - the classic
 *  sheet's own 16px). */
export function spellIconUrl(index) {
  const i = index | 0;
  if (i < 0 || i >= SPELL_ICON_COUNT) return null;
  const d = 16;
  return sheetCutUrl('ICON00I0.IMG', [(i % SPELL_ICON_ROW_COUNT) * d, Math.trunc(i / SPELL_ICON_ROW_COUNT) * d, d, d], 2);
}

/** Paint a raw { width, height, colors } frame into `cv`, once per frame object. */
export function paintFrame(cv, frame) {
  if (!cv || !frame?.width || !frame?.colors) return;
  if (cv._frame === frame) return;
  cv._frame = frame;
  if (cv.width !== frame.width) cv.width = frame.width;
  if (cv.height !== frame.height) cv.height = frame.height;
  const bytes = frame.colors instanceof Uint8ClampedArray ? frame.colors : new Uint8ClampedArray(frame.colors.buffer ?? frame.colors);
  try { cv.getContext('2d').putImageData(new ImageData(bytes, frame.width, frame.height), 0, 0); } catch { /* a malformed frame stays unpainted */ }
}
