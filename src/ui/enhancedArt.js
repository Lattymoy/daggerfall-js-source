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
import { requestIcon, requestFittedPicture } from './textureCanvas.js';
import { SPELL_ICON_COUNT, SPELL_ICON_ROW_COUNT } from './spellIcons.js';
import { screenDpr } from './iconFit.js';   // UI2: a spell's icon fitted to its slot

/** An item's icon as a data URL (null until it has loaded), and its name. */
export function itemIconUrl(item, identity = undefined) {
  const img = item ? inventoryItemImage(item, identity) : null;
  return img?.archive != null ? requestIcon(img.archive, img.record, { scale: 2, dye: img.dye, dyeTarget: img.dyeTarget }) : null;
}
export function itemName(item) {
  try { return itemLongName(item) || 'Item'; } catch { return 'Item'; }
}

// ── A SHEET IMG, CUT ───────────────────────────────────────────────
const sheets = new Map();   // name -> Promise<HTMLCanvasElement|null>
const cuts = new Map();     // `${name}:${x},${y},${w},${h}` -> dataURL | null
const cutWaiting = new Map();   // UI2: the same key -> the screens waiting on it, while its sheet loads
const CUT_WAKE_MAX = 8;

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
 *  null until it has loaded (the next draw asks again and gets it).
 *  UI2: `onReady` fires once when it lands, for every screen that asked while it loaded (a fitted spell icon is made
 *  from the cut at scale 1 - textureCanvas.js requestFittedPicture - and waits on it); a sheet that never comes tells
 *  no one. */
export function sheetCutUrl(name, [x, y, w, h], scale = 2, onReady = null) {
  const key = `${name}:${x},${y},${w},${h}@${scale}`;
  if (cuts.has(key)) {
    const wait = cutWaiting.get(key);
    if (onReady && wait && wait.size < CUT_WAKE_MAX) wait.add(onReady);
    return cuts.get(key);
  }
  cuts.set(key, null);
  const wake = new Set(onReady ? [onReady] : []);
  cutWaiting.set(key, wake);
  loadSheet(name).then((sheet) => {
    cutWaiting.delete(key);
    if (!sheet) return;
    const out = document.createElement('canvas');
    out.width = w * scale; out.height = h * scale;
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sheet, x, y, w, h, 0, 0, out.width, out.height);
    cuts.set(key, out.toDataURL('image/png'));
    for (const f of wake) { try { f(); } catch (e) { console.warn('[port] a screen would not repaint', e); } }
  });
  return null;
}

/** UI2: the ICON00I0 rectangle of spell icon `index` (20 to a row, 16px square), or null past the sheet. */
function spellIconRect(index) {
  if (!Number.isInteger(index) || index < 0 || index >= SPELL_ICON_COUNT) return null;
  const d = 16;
  return [(index % SPELL_ICON_ROW_COUNT) * d, Math.trunc(index / SPELL_ICON_ROW_COUNT) * d, d, d];
}

/** UI2: spell icon `index` FITTED to a slot's box (ui/iconFit.js) - `{ src, w, h, smooth }`, or null while the sheet
 *  loads (`onReady` fires when it lands) and for an index past it. The whole 16px tile, untrimmed, in whole pixels
 *  where they keep three quarters of the box: the hotbar's slot, the diamond's spell chip, the spellbook's drag. */
export function spellIconPicture(index, { box, dpr = screenDpr(), onReady = null } = /** @type {any} */ ({})) {
  const rect = spellIconRect(index);
  if (!rect) return null;
  return requestFittedPicture(`spellicon${index}`, (wake) => sheetCutUrl('ICON00I0.IMG', rect, 1, wake), { box, dpr, trim: false, onReady });
}

/** Spell icon `index` from ICON00I0 (20 to a row, square - the classic
 *  sheet's own 16px). */
export function spellIconUrl(index) {
  const rect = spellIconRect(index | 0);
  return rect ? sheetCutUrl('ICON00I0.IMG', rect, 2) : null;
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
