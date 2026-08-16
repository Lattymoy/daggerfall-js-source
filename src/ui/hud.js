// The classic HUD (UI arc, U1). Verbatim geometry from DFU
// HUDVitals.cs + HUDCompass.cs (MIT, Daggerfall Workshop), drawn in
// DFU's fullscreen style: vitals bottom-left, compass bottom-right.
//
//   Vitals: the classic bar art fills - MAIN03I0.IMG health,
//   MAIN04I0.IMG fatigue, MAIN05I0.IMG magicka - each cropped from
//   the BOTTOM by current/max (bottom-anchored, the
//   VerticalProgress shape). All three ride live entity stats
//   (fatigue joined in S15: current entity.fatigue over the derived
//   (Str+End) x 64 ceiling).
//   Compass: COMPBOX.IMG frame; a 64px window into COMPASS.IMG
//   scrolled by heading/360 x 258 (nonWrappedPart - the strip's tail
//   duplicates its head so no runtime wrap is needed), inset 2px
//   (boxOutlineSize), strip drawn first, frame over it.
//   Scale: classic pixels x floor(canvasHeight / 200) (the 320x200
//   reference), min 1 - integer scaling keeps the art crisp.

import { maxFatigue, maxBreath, liveStat } from '../systems/statMods.js';

export const COMPASS_BOX_OUTLINE = 2;
export const COMPASS_BOX_INTERIOR = 64;
export const COMPASS_NON_WRAPPED = 258;
export const HUD_BORDER = 10;   // HUDVitals borderSize

// P12: HUDBreathBar verbatim - a SOLID VerticalProgress, width 6
// classic px, height = LiveEndurance px, filled bottom-anchored by
// breath/MaxBreath. Yellow (247,239,41); short-on-breath dark red
// (148,12,0) when (LiveEndurance >> 3) + 4 > currentBreath. Layout:
// x offset 306 on the 320 screen = 14 from the RIGHT edge (right-
// anchored here, like the compass, so wide canvases keep the classic
// proportion); the bar's BOTTOM sits 92 + border above the canvas
// bottom (the -92 offset from the bottom-aligned parent panel).
// Drawn only while holding breath (Amount 0 draws nothing in DFU).
export const BREATH_BAR_WIDTH = 6;
export const BREATH_BAR_RIGHT = 320 - 306;   // 14
export const BREATH_BAR_BOTTOM = 92;
export const BREATH_COLOR_NORMAL = [247, 239, 41];
export const BREATH_COLOR_SHORT = [148, 12, 0];
export const breathShortThreshold = (liveEndurance) => (liveEndurance >> 3) + 4;

/** scroll = int(nonWrappedPart * heading01), verbatim. */
export const compassScroll = (heading01) =>
  Math.trunc(COMPASS_NON_WRAPPED * (((heading01 % 1) + 1) % 1));

/** Bottom-anchored fill: the drawn fraction and the source-V window
 *  (v grows downward; a half-full bar shows the LOWER half). */
export function barFill(current, max) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  return { ratio, v0: 1 - ratio, v1: 1 };
}

/** Classic-UI integer scale: FIT the 320x200 virtual screen inside
 *  the canvas (min axis), never overflow it. Height-only scaling blew
 *  classic layouts past the edges on portrait phones (2026-08-14 -
 *  Mac's report); on landscape desktop min() picks the same value the
 *  old formula did. */
export const hudScale = (canvasWidth, canvasHeight) =>
  Math.max(1, Math.floor(Math.min(canvasWidth / 320, canvasHeight / 200)));

/**
 * Load the five classic HUD images. Returns null (loudly, once) when
 * the art is absent - the HUD is data-gated like everything else.
 * ImgFile + palette come from the caller (scene layer owns data).
 */
export function bitmapToColor32(bmp, palette) {
  const colors = new Uint32Array(bmp.width * bmp.height);
  const u8 = new Uint8Array(colors.buffer);
  for (let i = 0; i < bmp.data.length; i++) {
    const idx = bmp.data[i];
    const o = i * 4;
    if (idx === 0) continue;   // classic IMG index 0 = transparent (the box corners)
    const c = palette.get(idx);
    u8[o] = c.r; u8[o + 1] = c.g; u8[o + 2] = c.b; u8[o + 3] = 255;
  }
  return { width: bmp.width, height: bmp.height, colors };
}

export async function loadHud({ fetchBytes, ImgFile, palette, renderer }) {
  const load = async (name) => {
    const img = new ImgFile();
    img.load(await fetchBytes(name), name, palette);
    const bmp = img.getDFBitmap();
    return { tex: renderer.uploadTexture('img', name, bitmapToColor32(bmp, palette)), w: bmp.width, h: bmp.height };
  };
  try {
    const [health, fatigue, magicka, compass, compassBox] = await Promise.all([
      load('MAIN03I0.IMG'), load('MAIN04I0.IMG'), load('MAIN05I0.IMG'),
      load('COMPASS.IMG'), load('COMPBOX.IMG'),
    ]);
    // P12: the breath bar is SOLID color (VerticalProgress), no art -
    // two generated 1x1 textures.
    const solid = ([r, g, b], name) => {
      const colors = new Uint32Array(1);
      const u8 = new Uint8Array(colors.buffer);
      u8[0] = r; u8[1] = g; u8[2] = b; u8[3] = 255;
      return { tex: renderer.uploadTexture('img', name, { width: 1, height: 1, colors }), w: 1, h: 1 };
    };
    return {
      health, fatigue, magicka, compass, compassBox,
      breathNormal: solid(BREATH_COLOR_NORMAL, 'hud-breath-normal'),
      breathShort: solid(BREATH_COLOR_SHORT, 'hud-breath-short'),
    };
  } catch {
    console.warn('[hud] classic HUD art unavailable; HUD disabled');
    return null;
  }
}

/** Draw the HUD. vitals = { health, maxHealth, magicka, maxMagicka };
 *  heading01 = camera yaw / 2pi with 0 facing +z. */
export function drawHud(renderer, canvas, art, vitals, heading01) {
  if (!art) return;
  const s = hudScale(canvas.width, canvas.height);
  const bottom = canvas.height - HUD_BORDER * s;
  // Vitals, left to right: health, fatigue, magicka (classic order),
  // 2px gaps at scale.
  let x = HUD_BORDER * s;
  const bars = [
    [art.health, vitals.health, vitals.maxHealth],
    [art.fatigue, vitals.fatigue ?? 0, maxFatigue(vitals) || 1],   // S15: the live fatigue stat ((Str+End) x 64 ceiling)
    [art.magicka, vitals.magicka ?? 0, vitals.maxMagicka ?? 1],
  ];
  for (const [img, cur, max] of bars) {
    const { ratio, v0, v1 } = barFill(cur, max);
    const w = img.w * s, hFull = img.h * s, h = hFull * ratio;
    if (h > 0) renderer.drawScreenQuad(img.tex, { x, y: bottom - h, w, h }, { u0: 0, v0, u1: 1, v1 });
    x += w + 2 * s;
  }
  // P12: the breath bar (HUDBreathBar verbatim geometry) - only
  // while holding breath.
  const breath = vitals.currentBreath ?? 0;
  if (breath > 0 && art.breathNormal) {
    const liveEnd = liveStat(vitals, 'endurance');
    const mb = maxBreath(vitals) || 1;
    const bh = liveEnd * s;
    const fill = Math.max(0, Math.min(1, breath / mb)) * bh;
    const bx2 = canvas.width - BREATH_BAR_RIGHT * s - BREATH_BAR_WIDTH * s;
    const bBottom = canvas.height - (BREATH_BAR_BOTTOM + HUD_BORDER) * s;
    const img = breathShortThreshold(liveEnd) > breath ? art.breathShort : art.breathNormal;
    if (fill > 0) renderer.drawScreenQuad(img.tex, { x: bx2, y: bBottom - fill, w: BREATH_BAR_WIDTH * s, h: fill });
  }
  // Compass, bottom-right: strip window first, frame over it.
  const box = art.compassBox;
  const bw = box.w * s, bh = box.h * s;
  const bx = canvas.width - HUD_BORDER * s - bw;
  const by = canvas.height - HUD_BORDER * s - bh;
  const scroll = compassScroll(heading01);
  const stripH = art.compass.h * s;
  renderer.drawScreenQuad(art.compass.tex,
    { x: bx + COMPASS_BOX_OUTLINE * s, y: by + COMPASS_BOX_OUTLINE * s, w: bw - COMPASS_BOX_OUTLINE * 2 * s, h: stripH },
    { u0: scroll / art.compass.w, v0: 0, u1: (scroll + COMPASS_BOX_INTERIOR) / art.compass.w, v1: 1 });
  renderer.drawScreenQuad(box.tex, { x: bx, y: by, w: bw, h: bh });
}
