// @ts-check
// RW1 (2026-10-09, Mac: "...allowing players to see inside/outside of house windows"): WHICH INTERIOR TEXELS ARE GLASS -
// the data side of the real windows (render/realWindows.js draws them). Inside a building the glass the view out cuts
// is DFU's own window table drawn indoors (the renderer's GLASS_EXTERIOR kind), the masks a context declares
// (renderer.uploadGlassMask), and - read here - the window record of a building interior set. Kept off the renderer's
// boot path: the climate tables are the data pipeline's, not the shader's.
//
// GLASS-ALL (2026-10-11, Mac: "Bruh all windows should be see through"): READ OFF THE DATA. RW1 took a record as glass
// when its bitmap carried the palette's 0xff (the exterior windows' index), a guess it marked unverified; against a real ARENA2
// (DaggerfallGameFiles, all nine building sets in the four climates an interior is laid out in - 0, 100, 300, 400) it
// found ONE window, the temple's stained glass, and took eight records of the paperdoll's clothing (TEXTURE.237 and
// .240, which share the sets' numbers). What the data says instead: every building interior set is a wall (records 0
// and 1, the same wall twice), a WINDOW WALL (record 2 - the same wall with a window in it), a floor and a ceiling. The
// glass is the window wall's new art (where it differs from its twin) painted in the palette's blue run (96-109: the
// sky's blue to the slate a pane is shaded with), and in the few that carry no glass the opening's own fill (a farm's
// and a village's hole in a desert wall, 222/223; a castle's arched opening, 86; its arrow slit, 216). The lead of a
// lattice and the frame are other colours and stay, so the street is seen through the panes. Two sets break the
// layout: the desert castle (011) has no window, and the mountain castle (111) has its window on record 1, its twin
// record 0. Not a DFU member: DFU lays every interior out under WindowStyle.Disabled and draws its glass as the picture.

import { BUILDING_INTERIOR_SETS } from '../climateSwaps.js';

/** The palette index that marks glass - getWindowColors32's own default (BaseImageFile.cs GetWindowColors32); the
 *  temple's stained glass is painted in it. */
export const GLASS_INDEX = 0xff;
/** GLASS-ALL: the palette indices a window wall's glass is painted in - the blue run (96-109), a castle's arched
 *  opening (86) and its slit (216), a hole in a mud wall (222, 223). Read off every building set's window record. */
export const GLASS_RAMP = Object.freeze([96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 86, 216, 222, 223]);
const RAMP = new Set(GLASS_RAMP);
/** GLASS-ALL: the window wall and the wall it is the twin of, in every building set but these. */
export const INTERIOR_WINDOW = Object.freeze({ record: 2, twin: 1 });
const WINDOW_EXCEPTIONS = new Map([[11, null], [111, Object.freeze({ record: 1, twin: 0 })]]);
/** The climate bases an interior is laid out in (ClimateSwaps.ApplyClimate: climateBase + set, no winter or rain for
 *  an interior) - 2xx is never a building's, and TEXTURE.237/.240 are the paperdoll's clothes. */
const INTERIOR_BASES = new Set([0, 1, 3, 4]);
/** The cleanup's numbers: the new art must be dense about a texel (this share of the square this far round it - the
 *  twin's wall differs from the window wall's by a speckle of noise), a glass texel is a pane's when this many of its
 *  eight neighbours are glass, panes join across lead this wide, and a window holds at least this many glass texels. */
export const GLASS_DENSE_RADIUS = 2;
export const GLASS_DENSE_SHARE = 0.8;
export const GLASS_CORE_NEIGHBOURS = 3;
export const GLASS_BRIDGE = 3;
export const GLASS_MIN_TEXELS = 24;

/** A building interior's texture archive, in a climate an interior is laid out in. */
export function isInteriorGlassArchive(archive) {
  return Number.isInteger(archive) && archive >= 0 && archive < 500 && INTERIOR_BASES.has(Math.trunc(archive / 100)) && BUILDING_INTERIOR_SETS.has(archive % 100);
}

/** The archive's window wall and its twin, or null (not a building set, or a set with no window). */
export function interiorWindowOf(archive) {
  if (!isInteriorGlassArchive(archive)) return null;
  return WINDOW_EXCEPTIONS.has(archive) ? WINDOW_EXCEPTIONS.get(archive) : INTERIOR_WINDOW;
}

/** The white texels of a color32 mask (getWindowColors32's shape: rgba, white where glass). */
export function glassTexelCount(mask) {
  const c = mask?.colors;
  if (!c) return 0;
  let n = 0;
  for (let i = 0; i < c.length; i += 4) if (c[i] > 127) n++;
  return n;
}

/**
 * GLASS-ALL: the glass of a window wall, texel by texel in the bitmap's own rows (1 = glass): the glass index
 * anywhere, and the ramp's colours where the art is new against the twin and dense - then only the panes (a texel with
 * GLASS_CORE_NEIGHBOURS glass neighbours, joined across GLASS_BRIDGE, GLASS_MIN_TEXELS of them) and their edges. Pure.
 * @param {{ width: number, height: number, data: Uint8Array }} win
 * @param {{ width: number, height: number, data: Uint8Array } | null} twin
 */
export function windowGlassTexels(win, twin) {
  const W = win.width, H = win.height, d = win.data, n = W * H;
  const paired = !!twin && twin.width === W && twin.height === H;
  const fresh = new Uint8Array(n);
  if (paired) for (let i = 0; i < n; i++) fresh[i] = d[i] !== twin.data[i] ? 1 : 0;
  const R = GLASS_DENSE_RADIUS;
  const dense = (x, y) => {
    let k = 0, f = 0;
    for (let Y = Math.max(0, y - R); Y <= Math.min(H - 1, y + R); Y++) for (let X = Math.max(0, x - R); X <= Math.min(W - 1, x + R); X++) { k++; f += fresh[Y * W + X]; }
    return f >= GLASS_DENSE_SHARE * k;
  };
  const cand = new Uint8Array(n);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    cand[i] = d[i] === GLASS_INDEX || (fresh[i] && RAMP.has(d[i]) && dense(x, y)) ? 1 : 0;
  }
  const core = new Uint8Array(n);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!cand[y * W + x]) continue;
    let k = 0;
    for (let Y = Math.max(0, y - 1); Y <= Math.min(H - 1, y + 1); Y++) for (let X = Math.max(0, x - 1); X <= Math.min(W - 1, x + 1); X++) if ((X !== x || Y !== y) && cand[Y * W + X]) k++;
    core[y * W + x] = k >= GLASS_CORE_NEIGHBOURS ? 1 : 0;
  }
  const comp = new Int32Array(n).fill(-1), kept = [];
  for (let i0 = 0; i0 < n; i0++) {
    if (!core[i0] || comp[i0] >= 0) continue;
    const id = kept.length, stack = [i0];
    let size = 0;
    comp[i0] = id;
    while (stack.length) {
      const i = /** @type {number} */ (stack.pop()), x = i % W, y = (i - x) / W;
      size++;
      for (let Y = Math.max(0, y - GLASS_BRIDGE); Y <= Math.min(H - 1, y + GLASS_BRIDGE); Y++) for (let X = Math.max(0, x - GLASS_BRIDGE); X <= Math.min(W - 1, x + GLASS_BRIDGE); X++) {
        const j = Y * W + X;
        if (core[j] && comp[j] < 0) { comp[j] = id; stack.push(j); }
      }
    }
    kept.push(size >= GLASS_MIN_TEXELS);
  }
  const out = new Uint8Array(n);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!cand[y * W + x]) continue;
    for (let Y = Math.max(0, y - 1); Y <= Math.min(H - 1, y + 1) && !out[y * W + x]; Y++) for (let X = Math.max(0, x - 1); X <= Math.min(W - 1, x + 1); X++) {
      const j = Y * W + X;
      if (core[j] && kept[comp[j]]) { out[y * W + x] = 1; break; }
    }
  }
  return out;
}

/** THE INTERIOR'S GLASS: a building set's window wall's mask in getWindowColors32's shape (rgba, white where glass,
 *  rows bottom-up - the exterior arm's own mask) - else null (another record, no window, no glass found). `bitmapOf`
 *  reads another record of the same archive (the twin). The rule is one place: the data pipeline asks this, the scan
 *  tool asks this. */
export function interiorGlassMask(archive, record, bitmap, bitmapOf) {
  const win = interiorWindowOf(archive);
  if (!win || record !== win.record || !bitmap?.data) return null;
  const glass = windowGlassTexels(bitmap, bitmapOf(win.twin) ?? null);
  const { width, height } = bitmap;
  const colors = new Uint8ClampedArray(width * height * 4);
  let n = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!glass[y * width + x]) continue;
    n++;
    const o = ((height - 1 - y) * width + x) * 4;
    colors[o] = 255; colors[o + 1] = 255; colors[o + 2] = 255; colors[o + 3] = 255;
  }
  return n ? { colors, width, height } : null;
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
