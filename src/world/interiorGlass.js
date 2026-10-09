// @ts-check
// RW1 (2026-10-09, Mac: "...allowing players to see inside/outside of house windows"): WHICH INTERIOR TEXELS ARE GLASS -
// the data side of the real windows (render/realWindows.js draws them). Inside a building the glass the view out cuts
// is DFU's own window table drawn indoors (the renderer's GLASS_EXTERIOR kind), the masks a context declares
// (renderer.uploadGlassMask), and - read here - a building interior set's own record that carries the palette's glass
// index. Kept off the renderer's boot path: the climate tables are the data pipeline's, not the shader's.
//
// Not a DFU member: DFU lays every interior out under WindowStyle.Disabled and draws its glass as the picture it is.

import { BUILDING_INTERIOR_SETS } from './climateSwaps.js';

/** The palette index that marks glass - getWindowColors32's own default (BaseImageFile.cs GetWindowColors32). */
export const GLASS_INDEX = 0xff;
/** An interior record is glass when at least this many of its texels are the glass index, and no more than this share
 *  of it - a picture that is mostly 0xff is a colour, not a pane. */
export const GLASS_MIN_TEXELS = 24;
export const GLASS_MAX_SHARE = 0.6;

/** A building interior's texture archive (BUILDING_INTERIOR_SETS, by archive % 100 as every climate set is read). */
export function isInteriorGlassArchive(archive) {
  return Number.isInteger(archive) && archive >= 0 && archive < 500 && BUILDING_INTERIOR_SETS.has(archive % 100);
}

/** The white texels of a color32 mask (getWindowColors32's shape: rgba, white where glass). */
export function glassTexelCount(mask) {
  const c = mask?.colors;
  if (!c) return 0;
  let n = 0;
  for (let i = 0; i < c.length; i += 4) if (c[i] > 127) n++;
  return n;
}

// FLAGGED (unverified without the player's data): interior glass is read off palette index 0xff in a building interior's own records - tools/windowGlassScan.mjs lists the candidates from a real ARENA2 folder.
/** THE INTERIOR'S GLASS: a building interior's record whose bitmap carries the glass index - its mask (`windowColors`
 *  is TextureFile.getWindowColors32, the exterior arm's own reader) when the count and share say pane, else null. The
 *  rule is one place: the data pipeline asks this, the scan tool asks this. */
export function interiorGlassMask(archive, bitmap, windowColors) {
  if (!isInteriorGlassArchive(archive) || !bitmap?.data) return null;
  let n = 0;
  const data = bitmap.data;
  for (let i = 0; i < data.length; i++) if (data[i] === GLASS_INDEX) n++;
  if (n < GLASS_MIN_TEXELS || n > GLASS_MAX_SHARE * data.length) return null;
  return windowColors(bitmap);
}

/** A cutout picture's holes as a glass mask (white where alpha is under a half) - for a context that would rather
 *  declare glass than cut it (renderer.uploadGlassMask). */
export function glassMaskFromAlpha(color32) {
  const src = color32.colors, out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    if (src[i + 3] < 128) { out[i] = 255; out[i + 1] = 255; out[i + 2] = 255; out[i + 3] = 255; }
  }
  return { colors: out, width: color32.width, height: color32.height };
}
