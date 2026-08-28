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
// AUDIT 24 ui: there is no DaggerfallUI.ScreenDimColor - the field lives
// on DaggerfallPopupWindow (:27) and it is Color.clear. The old
// `new Color32(0, 0, 0, 128)` is COMMENTED OUT one line above it, the
// property setter discards whatever it is handed (`set { screenDimColor
// = Color.clear;/*value*/; }`, :34), and the constructor forces
// `screenDimColor.a = 0` (:57). So every `parentPanel.BackgroundColor =
// ScreenDimColor` in DFU means "paint nothing at all": the window under
// a popup is NOT dimmed, and the eighteen windows that assign it to
// their parent panel do not paint their letterbox either.
export const SCREEN_DIM = [0, 0, 0, 0];   // DaggerfallPopupWindow.ScreenDimColor = Color.clear

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

/** Draw an IMG at a virtual position (its own size by default).
 *  CG1: `color` is the optional tint x alpha and `opts` passes through
 *  to drawScreenQuad ({ blend: true } for real alpha) - the dagger
 *  trail's BackgroundColor fade rides both. */
export function drawImg(renderer, img, m, x, y, w = img.w, h = img.h, color = undefined, opts = undefined) {
  renderer.drawScreenQuad(img.tex, { x: m.ox + x * m.s, y: m.oy + y * m.s, w: w * m.s, h: h * m.s }, undefined, color, opts);
}

/** Draw a SUBREGION of an IMG at its own virtual position (DFU's
 *  ImageReader.GetSubTexture idiom - the INVE01I0 selected-state
 *  overlays are subrects of a full 320x200 sheet drawn back over the
 *  base at the same rect). IMG textures are TOP-DOWN, so the source
 *  UVs map straight. */
export function drawImgSub(renderer, img, m, x, y, w, h) {
  renderer.drawScreenQuad(img.tex, { x: m.ox + x * m.s, y: m.oy + y * m.s, w: w * m.s, h: h * m.s },
    { u0: x / img.w, v0: y / img.h, u1: (x + w) / img.w, v1: (y + h) / img.h });
}

/** Blit an arbitrary SOURCE rect of an IMG to an arbitrary
 *  DESTINATION rect (ImageReader.GetSubTexture into a differently
 *  placed panel - U25's item info panel is a 50x37 cutout of
 *  ITEM00I0 drawn into a 37x32 rect). drawImgSub above is the special
 *  case where source and destination coincide. */
export function drawImgCrop(renderer, img, m, [sx, sy, sw, sh], [dx, dy, dw, dh]) {
  renderer.drawScreenQuad(img.tex, { x: m.ox + dx * m.s, y: m.oy + dy * m.s, w: dw * m.s, h: dh * m.s },
    { u0: sx / img.w, v0: sy / img.h, u1: (sx + sw) / img.w, v1: (sy + sh) / img.h });
}

/** A flat color rect in virtual coords. */
export function drawRect(renderer, m, x, y, w, h, color) {
  renderer.drawScreenQuad(null, { x: m.ox + x * m.s, y: m.oy + y * m.s, w: w * m.s, h: h * m.s }, undefined, color);
}

/** DFU's default shadowed label at a virtual position. align:
 *  'left' | 'center' (center within `w` virtual px, the stat-panel
 *  shape). `shadow` overrides the default shadow colour - U10: the
 *  chargen rollouts use DaggerfallAlternateShadowColor1, and the
 *  colour belongs in the ONE label helper, not a copy per window.
 *  Returns the text's virtual width. */
export function shadowText(renderer, font, text, m, x, y, { color = DEFAULT_TEXT_COLOR, align = 'left', w = 0, shadow = DEFAULT_SHADOW_COLOR } = {}) {
  const tw = measureText(font.fnt, text);
  const ax = align === 'center' ? x + (w - tw) / 2 : x;
  drawText(renderer, font, text, m.ox + (ax + 1) * m.s, m.oy + (y + 1) * m.s, m.s, shadow);
  drawText(renderer, font, text, m.ox + ax * m.s, m.oy + y * m.s, m.s, color);
  return tw;
}

/** Screen point -> virtual (or null outside the panel). */
export function pointToNative(m, px, py) {
  const x = (px - m.ox) / m.s, y = (py - m.oy) / m.s;
  return x >= 0 && y >= 0 && x < NATIVE_W && y < NATIVE_H ? [x, y] : null;
}
