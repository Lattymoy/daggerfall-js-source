// U8a: the NATIVE PANEL idiom - real ARENA2 UI art on DFU's virtual
// 320x200 screen (DaggerfallUI/NativePanel semantics, MIT Daggerfall
// Workshop). Classic windows author in VIRTUAL pixels; the screen
// mapping is integer scale + centered letterbox (the hud.js scaling
// law). This is the foundation every window retrofit rides - the
// interim clean-text panels migrate onto it one window per slice.
//
// - loadImg: one IMG -> an uploaded texture + size (the hud.js
//   loader shape; ImgFile + palette come from the caller - the
//   scene layer owns data).
// - metrics: { s, ox, oy } - integer scale (min 1), centered.
// - drawImg/drawTexRect: virtual-rect draws through the mapping.
// - shadowText: DFU's AddDefaultShadowedTextLabel - the default
//   text color (243,239,44), shadow (93,77,12) at +1,+1 virtual px.
// - SCREEN_DIM: DFU's ScreenDimColor behind modal windows.
// - pointToNative: screen -> virtual for touch/click hit rects.

import { ImgFile } from '../formats/imgFile.js';
import { bitmapToColor32 } from './hud.js';
import { drawText, measureText } from './text.js';

export const NATIVE_W = 320;
export const NATIVE_H = 200;
export const DEFAULT_TEXT_COLOR = [243 / 255, 239 / 255, 44 / 255, 1];
export const DEFAULT_SHADOW_COLOR = [93 / 255, 77 / 255, 12 / 255, 1];
export const SCREEN_DIM = [0, 0, 0, 0.5];   // DaggerfallUI.ScreenDimColor

export function nativeMetrics(canvas) {
  const s = Math.max(1, Math.floor(Math.min(canvas.width / NATIVE_W, canvas.height / NATIVE_H)));
  return { s, ox: Math.floor((canvas.width - NATIVE_W * s) / 2), oy: Math.floor((canvas.height - NATIVE_H * s) / 2) };
}

/** One IMG as a texture: { tex, w, h } (throws on missing art -
 *  callers keep their text fallback). */
export async function loadImg({ renderer, fetchBytes, palette }, name) {
  const img = new ImgFile();
  img.load(await fetchBytes(name), name, palette);
  const bmp = img.getDFBitmap();
  return { tex: renderer.uploadTexture('img', name, bitmapToColor32(bmp, palette)), w: bmp.width, h: bmp.height };
}

/** Draw an IMG at a virtual position (its own size by default). */
export function drawImg(renderer, img, m, x, y, w = img.w, h = img.h) {
  renderer.drawScreenQuad(img.tex, { x: m.ox + x * m.s, y: m.oy + y * m.s, w: w * m.s, h: h * m.s });
}

/** A flat color rect in virtual coords. */
export function drawRect(renderer, m, x, y, w, h, color) {
  renderer.drawScreenQuad(null, { x: m.ox + x * m.s, y: m.oy + y * m.s, w: w * m.s, h: h * m.s }, undefined, color);
}

/** DFU's default shadowed label at a virtual position. align:
 *  'left' | 'center' (center within `w` virtual px, the stat-panel
 *  shape). Returns the text's virtual width. */
export function shadowText(renderer, font, text, m, x, y, { color = DEFAULT_TEXT_COLOR, align = 'left', w = 0 } = {}) {
  const tw = measureText(font.fnt, text);
  const ax = align === 'center' ? x + (w - tw) / 2 : x;
  drawText(renderer, font, text, m.ox + (ax + 1) * m.s, m.oy + (y + 1) * m.s, m.s, DEFAULT_SHADOW_COLOR);
  drawText(renderer, font, text, m.ox + ax * m.s, m.oy + y * m.s, m.s, color);
  return tw;
}

/** Screen point -> virtual (or null outside the panel). */
export function pointToNative(m, px, py) {
  const x = (px - m.ox) / m.s, y = (py - m.oy) / m.s;
  return x >= 0 && y >= 0 && x < NATIVE_W && y < NATIVE_H ? [x, y] : null;
}
