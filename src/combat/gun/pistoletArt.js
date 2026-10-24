// THE DWARVEN PISTOLET'S FIRST-PERSON ART - the owner's six frames, as the game draws them (PISTOLET, 2026-10-21;
// bible/05-Combat/Dwarven-Pistolet.md).
//
// combat/thunderlockArt.js's job for the second gun, and the same answer's shape (records, anchor, unionBox, muzzle), so
// the rig draws either through one door (combat/gun/gunViewmodel.js gunFrameRect). What differs is the art:
//
//   - A STRIP, NOT A SHEET. Six 88x113 frames side by side (public/art/pistol-frames.png), registered to each other by
//     their canvas - the forearm leaves every frame through the same corner - so they are cut at a fixed stride: no key,
//     no badge gutter. The pistol lab found this and wrote it; the strip's laws live in combat/gun/pistolStrip.js now
//     and the lab reads them back (src/tools/pistolLab.js), gunSheet.js's way for the Thunderlock.
//   - NATIVE SIZE. The frames are a WEAPON*.CIF record's size, so one art pixel is one design pixel times the owner's
//     scale (combat/gun/gunFeel.js PISTOLET_FEEL.scale) - no NATIVE_WIDTH guessed for a painting.
//   - THE 1-BIT CUT. The frames carry soft alpha; the screen quad discards under 0.5, so the cut is made here, once, at
//     the row's `alphaCut`, and the muzzle and the boxes are measured on what will actually be drawn.
//   - GILDED: the PISTOL's pixels, never the hand's (pistoletGildKeep, below) - found on EVERY frame, because the art
//     moves the pistol inside the canvas (the Thunderlock's sheet does not, so its keep is the idle frame's).

import { contentBox } from './gunSheet.js';
import { PISTOLET_FEEL } from './gunFeel.js';
import { decodePng } from '../../systems/textureReplacement.js';
import { toScreenOrder } from '../../formats/color32Order.js';   // FIELD-GUN3: a screen quad's PNG keeps its rows
import { WEAPON_TYPES, getWeaponAnims } from '../fpsWeapon.js';
import { APP_ROOT } from '../../systems/appRoot.js';   // AUDIT-THUNDERLOCK F7: the site root, not the document's
import { shimmer, gildFrame } from '../thunderlockArt.js';   // the Thunderlock's enchanted look and its gold - one home each

// the strip's laws live on a leaf (combat/gun/pistolStrip.js) so the pistol lab's own build reads them without this
// file's texture pipeline behind them - weaponAlign.js's reason for the Thunderlock's lab
export { PISTOL_STRIP, stripCellRect, hardenAlpha, PISTOL_BLEED, armLean, bleedArm, pistolFrameSet } from './pistolStrip.js';
import { PISTOL_STRIP, cutCell, cropImage, bleedArm, pistolFrameSet } from './pistolStrip.js';

export const stripUrl = (file = `art/${PISTOL_STRIP.file}`) =>
  new URL(file, APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/').href;

/** A pixel's class, for the gilding: the pistol's brass ('O') and teal grip ('T'), the steel and the outlines ('g', '#',
 *  '?'), and what is the HAND's - the leather and its shadows ('B'), the skin ('S'). Hue/lightness/saturation, read off
 *  the art's own palette (bible/05-Combat/Dwarven-Pistolet.md, "The gilded frames gild the pistol"). */
function pixelClass(d, o) {
  if (d[o + 3] < 128) return '.';
  const r = d[o] / 255, g = d[o + 1] / 255, b = d[o + 2] / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (l < 0.12) return '#';
  const delta = mx - mn;
  const s = delta === 0 ? 0 : (l > 0.5 ? delta / (2 - mx - mn) : delta / (mx + mn));
  if (s < 0.12) return 'g';
  let h = mx === r ? (g - b) / delta + (g < b ? 6 : 0) : mx === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  h *= 60;
  if (h > 150 && h < 210) return 'T';
  if (h > 15 && h < 55 && l > 0.45 && s > 0.45) return 'O';
  if (h > 15 && h < 45 && l < 0.45) return 'B';
  if (h > 15 && h < 55) return 'S';
  return '?';
}

/**
 * THE FLASH'S TEXELS on one frame (AUDIT PISTOLET B3): the white-hot core (FLASH_LUMA, flashPoint's own test) - its
 * largest connected body only, since a lone highlight elsewhere is the metal's - grown through the flame's glow: the
 * texels at full red (an additive flame burns the red channel out; the brass does not) and bright, that touch it. The
 * gold leaf never takes them - "the flash and the smoke stay the flash and the smoke" (GILDED1, the Thunderlock's rule).
 * Answers a 0/1 mask; empty on a frame with no flash.
 */
export function flashMask({ width: w, height: h, data }) {
  const luma = (i) => data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
  const lit = (i) => data[i * 4 + 3] >= 128;
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const flood = (seeds, into, ok) => {
    const st = [...seeds];
    for (const i of st) into[i] = 1;
    while (st.length) {
      const i = st.pop(), x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of NB) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (!into[j] && lit(j) && ok(j)) { into[j] = 1; st.push(j); }
      }
    }
    return into;
  };
  // the core's bodies, the largest kept
  const hot = (i) => luma(i) >= FLASH_LUMA;
  const seen = new Uint8Array(w * h);
  let body = null, size = 0;
  for (let i = 0; i < w * h; i++) {
    if (seen[i] || !lit(i) || !hot(i)) continue;
    const one = flood([i], new Uint8Array(w * h), hot);
    let n = 0;
    for (let k = 0; k < w * h; k++) if (one[k]) { seen[k] = 1; n++; }
    if (n > size) { size = n; body = one; }
  }
  const mask = new Uint8Array(w * h);
  if (!body) return mask;
  const seeds = [];
  for (let k = 0; k < w * h; k++) if (body[k]) seeds.push(k);
  return flood(seeds, mask, (j) => data[j * 4] >= 245 && luma(j) >= 150);
}

/**
 * THE PIXELS A GILDED PISTOLET GILDS, on one frame: the pistol's, never the hand's - nor the flash (flashMask). The leather bracer and its shadows
 * and the fingers are brown and skin, which no part of the pistol is drawn in but its own brass shadows - so those stay
 * as they are, which reads as shadow in gold. The grey sleeve shares the steel's greys, so it is told apart by WHERE it
 * is: the grey reached from the frame's bottom-right corner, where the forearm leaves every frame. Answers a 0/1 mask.
 */
export function pistoletGildKeep({ width: w, height: h, data }) {
  const cls = new Array(w * h);
  for (let i = 0; i < w * h; i++) cls[i] = pixelClass(data, i * 4);
  const sleeve = new Uint8Array(w * h);
  const stack = [];
  const corner = w * h - 1;
  if (cls[corner] === 'g') { sleeve[corner] = 1; stack.push(corner); }
  while (stack.length) {
    const i = stack.pop(), x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (!sleeve[j] && cls[j] === 'g') { sleeve[j] = 1; stack.push(j); }
    }
  }
  const flame = flashMask({ width: w, height: h, data });
  const keep = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const c = cls[i];
    keep[i] = !flame[i] && (c === 'O' || c === 'T' || ((c === 'g' || c === '#' || c === '?') && !sleeve[i])) ? 1 : 0;
  }
  return keep;
}

/** The strip's six frames, cut and hardened: `{ frames: [{width, height, data}], boxes }`. Pure - the lab and the
 *  game's loader read the same frames (PISTOL-EDGE: pistolStrip.js cutCell, the frame set's own cut). */
export function cutStrip(strip, cut = PISTOLET_FEEL.alphaCut) {
  const frames = [];
  for (let i = 0; i < PISTOL_STRIP.frames; i++) { const { width, height, data } = cutCell(strip, i, cut); frames.push({ width, height, data }); }
  return { frames, boxes: frames.map((f) => contentBox(f)) };
}

/**
 * WHERE THE BARREL ENDS, off the flash alone. The Thunderlock's reading (thunderlockArt.js muzzlePoint) is the
 * brightness the flash frame GAINED over the rest frame, which is right for a sheet whose gun stands still in it - and
 * wrong here: the owner's shot frame kicks the whole pistol and arm back inside the canvas, so "what got brighter" is the
 * moved arm as much as the fire (735 texels across the frame, centred on nothing). The flash is the one thing in the
 * strip drawn white-hot - no other frame has a texel at FLASH_LUMA - so its pixels are found by brightness alone, and
 * their centroid is where the shot leaves the barrel. Answers fractions of the union box, or null with no flash.
 */
export const FLASH_LUMA = 215;
export function flashPoint(lit) {
  if (!lit?.data) return null;
  const { width: w, height: h, data } = lit;
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (!data[o + 3] || data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114 < FLASH_LUMA) continue;
      sx += x + 0.5; sy += y + 0.5; n++;
    }
  }
  return n ? { x: sx / n / w, y: sy / n / h } : null;
}

/**
 * PISTOL-EDGE (combat/gun/pistolStrip.js bleedArm): THE SIX FRAMES AS THEY ARE DRAWN - cut and hardened (cutStrip), in
 * their look on the frame's own canvas (the gold's keep reads the sleeve from the canvas's corner, the shimmer every
 * texel), then each forearm carried on past the cut along the rest frame's lean, and the six cropped to the union of
 * what they now hold. `anchor` is the REST frame's own box as the owner drew it - never the bled one's - so the gun is
 * seated where it always was and everything the bleed added hangs past the screen's corner; `muzzle` is read off the
 * plain shot frame, bled and cropped as drawn (flashPoint - fractions of the union). Pure: the lab's page and the game's
 * loader call this one function. Null for a strip with nothing on it.
 * @param {{ width: number, height: number, data: Uint8ClampedArray }} strip
 */
export function bledFrames(strip, { gilded = false, magic = false, cut = PISTOLET_FEEL.alphaCut } = {}) {
  const set = pistolFrameSet(strip, cut);
  if (!set?.union) return null;
  const { cells, anchor, lean, bled, union } = set;
  const looked = cells.map((f, i) => {
    if (!gilded && !magic) return bled[i];
    const own = { width: f.width, height: f.height, data: new Uint8ClampedArray(f.data) };
    return bleedArm(gilded ? gildFrame(own, pistoletGildKeep(own)) : shimmer(own), lean);
  });
  return { union, anchor, lean, frames: looked.map((f) => cropImage(f, union)), muzzle: flashPoint(cropImage(bled[1], union)) };
}

/**
 * Load it - loadThunderlockArt's shape: `records` (0 the idle, 1 the six-frame cycle) at the ANCHOR's size in design
 * pixels, `anchor` and `unionBox` for gunFrameRect, `muzzle` measured off the flash alone (flashPoint, below - never what
 * the shot frame gained over the rest frame), and `pose` - the width and raise gunFrameRect places it by, so the rig asks the art rather than a table.
 * @returns the art, or null.
 */
export async function loadPistoletArt(renderer, { fetch: fetchStrip = null, decode = decodePng, magic = false, gilded = false } = {}) {
  const file = `art/${PISTOL_STRIP.file}`;
  const bytes = fetchStrip
    ? await fetchStrip(file)
    : await (async () => {
      const r = await fetch(stripUrl(file));
      if (!r.ok) throw new Error(`${file}: ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    })();
  const strip = await decode(bytes);
  if (!strip?.width) return null;
  const { union, anchor, frames: cropped, muzzle } = bledFrames(strip, { gilded, magic }) ?? {};
  if (!union) return null;
  const scale = PISTOLET_FEEL.scale;   // design pixels per art pixel - NATIVE, times the owner's size
  const type = magic ? WEAPON_TYPES.Pistolet_Magic : WEAPON_TYPES.Pistolet;
  const look = gilded ? ':gilded' : magic ? ':magic' : '';
  const textures = cropped.map((rgba, i) => renderer.uploadTexture('img', `pistolet${look}:${i}`, toScreenOrder(rgba)));
  const anchorW = anchor.w * scale, anchorH = anchor.h * scale;
  return {
    weaponType: type,
    anims: getWeaponAnims(type),
    records: [
      { width: anchorW, height: anchorH, frames: [textures[0]] },   // 0: idle
      { width: anchorW, height: anchorH, frames: textures },        // 1: the fire cycle
    ],
    anchor: { x: (anchor.x - union.x) * scale, y: (anchor.y - union.y) * scale, w: anchorW, h: anchorH },
    unionBox: { x: 0, y: 0, w: union.w * scale, h: union.h * scale },
    native: { w: union.w, h: union.h },   // AUDIT PISTOLET B4: the textures' own size - the glow's field is laid in it, not in design pixels
    muzzle,
    pose: { widthPct: anchorW / 320, raise: PISTOLET_FEEL.raise, offset: PISTOLET_FEEL.offset },   // AUDIT PISTOLET B5: the offset too - a tuned one moves the game, not only the lab
  };
}
