// The classic mouse pointer (U arc). CURSOR.IMG decoded through the
// same ImgFile + ART_PAL.COL path every native window uses, upscaled
// nearest-neighbour and installed as the DOCUMENT cursor - one rule on
// <html> covers every surface (the game canvas, the folder picker, the
// error overlay), so all UI shows Daggerfall's arrow instead of the OS
// default. Hotspot is the arrow tip at (0,0), as DFU's SetCursor uses.
// NEVER TRAPS: a missing CURSOR.IMG leaves the OS cursor in charge.

import { ImgFile } from '../formats/imgFile.js';
import { DFPalette } from '../formats/dfPalette.js';
import { bitmapToColor32 } from './hud.js';

const SCALE = 2;   // the 32x16 source reads too small at modern DPI

export async function installCursor(fetchBytes) {
  try {
    const palette = new DFPalette();
    palette.load(await fetchBytes('ART_PAL.COL'), 'ART_PAL.COL');
    const img = new ImgFile();
    if (!img.load(await fetchBytes('CURSOR.IMG'), 'CURSOR.IMG', palette)) return false;
    const bmp = img.getDFBitmap();
    const { width, height, colors } = bitmapToColor32(bmp, palette);
    if (!width || !height) return false;
    const src = document.createElement('canvas');
    src.width = width; src.height = height;
    src.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(colors.buffer), width, height), 0, 0);
    const out = document.createElement('canvas');
    out.width = width * SCALE; out.height = height * SCALE;
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, out.width, out.height);
    document.documentElement.style.cursor = `url(${out.toDataURL()}) 0 0, auto`;
    return true;
  } catch (e) {
    console.warn('[cursor] CURSOR.IMG unavailable; the OS cursor stands in', e);
    return false;
  }
}
