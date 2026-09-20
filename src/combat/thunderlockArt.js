// THE DWARVEN THUNDERLOCK'S FIRST-PERSON ART.
//
// Every classic weapon's FP art is a WEAPON*.CIF out of the player's
// ARENA2, read by formats/cifRciFile.js and baked by
// fpsWeapon.loadFpsWeaponArt. This weapon is the port's own, so its
// art is OURS - two files under public/art, shipped with the build -
// and it arrives as one contact sheet rather than as records.
//
// So this is loadFpsWeaponArt's other half: fetch, decode, slice
// (combat/gunSheet.js, the laws the gun lab settled), and hand back
// the SAME SHAPE the CIF path hands back -
//   { weaponType, anims, records: [{ width, height, frames: [tex] }] }
// - so drawFpsWeapon, the weapon rig and Weapon Widget's clone read it
// without any of them learning that a second kind of weapon art
// exists.
//
// TWO RECORDS, as the anim table names them: 0 is the idle pose (the
// sheet's first cell, which is the gun with no flash on it), 1 is the
// six fire frames. Every frame is cropped to ONE box - the union of
// all six - because the flash and the smoke grow up and to the left
// across the cycle, and six frames trimmed to their own content slide
// the weapon around under the player's hands. That reasoning, and the
// background key that has to kill a white page without eating a
// muzzle flash, are gunSheet.js's.

import { FIRE_FRAMES, cellRect, keyBackground, contentBox, unionBox } from './gunSheet.js';
import { decodePng } from '../systems/textureReplacement.js';
import { toScreenOrder } from '../formats/color32Order.js';   // FIELD-GUN3: HT3's law - a SCREEN QUAD's PNG keeps its rows
import { WEAPON_TYPES, getWeaponAnims } from './fpsWeapon.js';
import { GUN_FEEL } from './gunFeel.js';   // FIELD-GUN7: the lab's settled pose, one home
import { APP_ROOT } from '../systems/appRoot.js';   // AUDIT-THUNDERLOCK F7: the SITE root, not the document's

/** The sheet, off the SITE ROOT rather than the document.
 *
 *  AUDIT-THUNDERLOCK F7: this resolved against `document.baseURI`,
 *  which is right on the lab's own page and WRONG in the game - the
 *  game's document is `/play/index.html`, so the browser would have
 *  asked for `/play/art/gun-fire-sheet.webp`, been handed the page
 *  itself, failed to decode it, and drawn no weapon at all. That is
 *  not a guess: it is exactly what happened to the held map four
 *  weeks earlier (MAP-FIELD, "The sprite I gave to be used is nowhere
 *  to be seen at all"), and systems/appRoot.js is that fix's law,
 *  moved to a leaf so combat/ can afford to import it. */
export const SHEET_FILE = 'art/gun-fire-sheet.webp';
export const sheetUrl = (file = SHEET_FILE) =>
  new URL(file, APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/').href;

/** The key's defaults, the numbers the lab's slider settled on. */
export const KEY_THRESHOLD = 244, KEY_CHROMA = 10;

/**
 * THE ENCHANTED VARIANT.
 *
 * Every classic weapon has a second archive for this - WEAPON04.CIF
 * becomes WEAPO104.CIF, the same frames repainted with a glow - and
 * ItemHelper.ConvertItemToAPIWeaponType promotes an enchanted item to
 * the *_Magic type that reads it. This weapon has no second sheet, so
 * the promotion lands here instead: the SAME frames through a
 * shimmer.
 *
 * Not a hue rotation, which turns brass into a bruise. Luminance is
 * kept and the colour is pulled toward a cold Dwemer blue-violet, with
 * the BRIGHT parts pulled hardest - so the highlights read as charged
 * and the shadowed housing stays metal. The muzzle flash, already at
 * the top of the range, goes white-blue, which is what tells the
 * player at a glance that this one is enchanted.
 */
export const MAGIC_TINT = Object.freeze({ r: 0.42, g: 0.70, b: 1.85, lift: 64, pull: 0.88 });

export function shimmer(rgba) {
  const d = rgba.data;
  const { r: tr, g: tg, b: tb, lift, pull } = MAGIC_TINT;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const lum = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
    const k = pull * (0.35 + 0.65 * lum);   // the bright parts take it hardest
    const glow = lift * lum * lum;
    d[i] = d[i] * (1 - k) + (d[i] * tr + glow) * k;
    d[i + 1] = d[i + 1] * (1 - k) + (d[i + 1] * tg + glow) * k;
    d[i + 2] = d[i + 2] * (1 - k) + Math.min(255, d[i + 2] * tb + glow) * k;
  }
  return rgba;
}

/** One cell of the sheet, decoded and keyed, as RGBA + its content box. */
function bakeCell(sheet, i) {
  const r = cellRect(i, sheet.width, sheet.height);
  const out = new Uint8ClampedArray(r.w * r.h * 4);
  for (let y = 0; y < r.h; y++) {
    const src = ((y + r.y) * sheet.width + r.x) * 4;
    out.set(sheet.data.subarray(src, src + r.w * 4), y * r.w * 4);
  }
  const img = { width: r.w, height: r.h, data: out };
  keyBackground(img, KEY_THRESHOLD, KEY_CHROMA);
  return { img, box: contentBox(img) };
}

/** Crop to a box, in the shape the upload door reads. */
function crop(img, box) {
  const out = new Uint8ClampedArray(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++) {
    const src = ((y + box.y) * img.width + box.x) * 4;
    out.set(img.data.subarray(src, src + box.w * 4), y * box.w * 4);
  }
  return { width: box.w, height: box.h, data: out };
}

/**
 * THE SPRITE'S SIZE ON THE 320x200 SURFACE.
 *
 * A CIF record carries its own native size and FPSWeapon draws it at
 * that size times the screen's scale; a 586x333 sheet cell has no such
 * number, and drawn at face value it would be twice the design
 * surface. `NATIVE_WIDTH` is the answer the lab arrived at - 54% of
 * the surface's width, Mac's own slider - expressed once, here, as
 * the width the gun's own box takes in native pixels.
 */
// FIELD-GUN7: 0.49, not 0.54. The lab's panel ended at SIZE 49 -
// Mac's last word on it was "Size: 49" - and this was written from
// the screenshot before that, so the gun has been drawn a tenth too
// big in the game since the day it was integrated. It reads the one
// home now, so the lab's slider and the game's sprite cannot part.
export const NATIVE_WIDTH = GUN_FEEL.widthPct * 320;

/**
 * Load it. `fetchBytes` is the door a test comes through; by default
 * the sheet is fetched from the build beside the page.
 * @returns the same shape loadFpsWeaponArt answers, or null.
 */
export async function loadThunderlockArt(renderer, { fetch: fetchSheet = null, decode = decodePng, magic = false } = {}) {
  const bytes = fetchSheet
    ? await fetchSheet(SHEET_FILE)
    : await (async () => {
      const r = await fetch(sheetUrl());
      if (!r.ok) throw new Error(`${SHEET_FILE}: ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    })();
  const sheet = await decode(bytes);
  if (!sheet?.width) return null;

  const baked = [];
  for (let i = 0; i < FIRE_FRAMES; i++) baked.push(bakeCell(sheet, i));
  const boxes = baked.map((b) => b.box);
  const union = unionBox(boxes);
  if (!union) return null;
  const anchor = boxes[0] ?? union;   // frame 1: the gun with no flash on it

  // the drawn size: the GUN's box takes NATIVE_WIDTH, and the union
  // box - flash and all - keeps the same scale around it
  const scale = NATIVE_WIDTH / anchor.w;
  const width = Math.round(union.w * scale);
  const height = Math.round(union.h * scale);
  // FIELD-GUN11: the gun's own box at the same scale - what the
  // records carry, and what the transforms are applied to
  const anchorW = Math.round(anchor.w * scale);
  const anchorH = Math.round(anchor.h * scale);

  const type = magic ? WEAPON_TYPES.Thunderlock_Magic : WEAPON_TYPES.Thunderlock;
  // FIELD-GUN3 (Mac, from play: "The sprite is upside down"). HT3's
  // law, and the THIRD time this port has paid it: `toColor32` is a
  // FLIP, right for a Unity texture whose rows are stored bottom-up
  // and WRONG for a decoded PNG, whose row 0 already is the picture's
  // top. Which one is right depends on where it is drawn, and the two
  // answers are opposite - a world billboard samples v with 0 at the
  // bottom and wants the flip; a SCREEN QUAD does not, because
  // `drawScreenQuad` hands the rect's top the pair `v0` and nothing
  // flips at upload.
  //
  // This weapon is drawn by `drawFpsWeapon`, which ends in
  // `renderer.drawScreenQuad`. So it is a screen sprite from a PNG
  // and it wants its rows exactly as they came: `toScreenOrder`, the
  // same door the held torch and the weapon widget's loose arm take.
  // The held torch (HT3) and the shield mod (SW4) each found this the
  // same way - a person looking at the picture.
  // FIELD-GUN17: THE MUZZLE, MEASURED OFF THE ART. Kept before the
  // upload because it wants the PIXELS, and after this loop they are
  // GL handles.
  const cropped = baked.map((b) => crop(b.img, union));
  const muzzle = muzzlePoint(cropped[0], cropped[1]);
  const frames = cropped.map((rgba, i) =>
    renderer.uploadTexture('img', `thunderlock${magic ? ':magic' : ''}:${i}`,
      toScreenOrder(magic ? shimmer(rgba) : rgba)));

  return {
    weaponType: type,
    anims: getWeaponAnims(type),
    // FIELD-GUN11: THE RECORD IS THE GUN, NOT THE GUN PLUS ITS SMOKE.
    //
    // This used to be the UNION's size, and it is the last structural
    // difference between this weapon in the lab and in the game. The
    // lab places and TRANSFORMS the anchor box - the gun with no
    // flash on it - and only then derives the rect the full image is
    // drawn at (`unionDrawRect`). The game handed the union to
    // Weapon Widget's transform instead, and anything in that
    // transform proportional to the rect's height - the Offset
    // module's slide most of all - came out 6% large, because the
    // union is 21 native pixels taller than the gun.
    //
    // The lab's own header says why the anchor is the right box to
    // lay out from: "Lay the screen rect out from the union box and
    // Center puts the SMOKE in the middle of the screen and the
    // weapon off to the right." The same is true of everything else
    // that measures the rect.
    //
    // So the record is the ANCHOR now and both draw sites expand it
    // back to the union at the moment of drawing, which is exactly
    // the shape the lab has always had.
    records: [
      { width: anchorW, height: anchorH, frames: [frames[0]] },   // 0: idle
      { width: anchorW, height: anchorH, frames },                // 1: the fire cycle
    ],
    // the gun's own box inside the union, and the union around it -
    // what a caller needs to turn a transformed ANCHOR rect into the
    // rect the whole image is drawn at
    anchor: { x: (anchor.x - union.x) * scale, y: (anchor.y - union.y) * scale, w: anchor.w * scale, h: anchor.h * scale },
    unionBox: { x: 0, y: 0, w: width, h: height },
    // FIELD-GUN17: where the barrel ends, as fractions of the UNION
    // box - so a caller that knows where the union is drawn knows
    // where the muzzle is. Null if the art has no flash to measure.
    muzzle,
  };
}

/**
 * WHERE THE BARREL ENDS - and the art answers it, so nobody types a
 * number.
 *
 * FIELD-GUN17 (2026-09-20, Mac: "the orb doesnt allign with the barrel
 * when firing. Its above the barrel").
 *
 * It was above the barrel because the shot left the BOW'S HAND. The
 * Thunderlock rides the ranged lane, and that lane's origin is
 * `playerArrowOrigin` - DFU's GetAimPosition, 0.11 below the eye and
 * 0.15 to the side, which is where a drawn bow's nock is. This gun is
 * drawn low and to the right with its barrel lower still, so a shot
 * from the bow's nock came out well above it. FIELD-GUN14's own
 * sentence, one field further along: the lane was written for the one
 * ranged weapon Daggerfall has.
 *
 * THE FLASH IS THE MEASUREMENT. Frame 1 is the gun with the muzzle
 * flash on it and frame 0 is the gun without; the pixels frame 1
 * GAINED are the flash, and their brightness-weighted centroid is
 * where it comes out of the barrel. Weighted by the gain rather than
 * counted, so the bright core near the muzzle outvotes the plume that
 * spreads away from it.
 *
 * Answers fractions of the union box (x from its left, y from its
 * TOP), which is the frame `unionDrawRect` hands back - or null if the
 * two frames differ nowhere bright enough to be a flash, in which case
 * the caller keeps whatever origin it had.
 */
export const MUZZLE_GAIN = 60;   // how much brighter a texel must get to count as flash, 0..255
export function muzzlePoint(dark, lit) {
  if (!dark?.data || !lit?.data || dark.width !== lit.width || dark.height !== lit.height) return null;
  const { width: w, height: h } = dark;
  let sx = 0, sy = 0, total = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!lit.data[i + 3]) continue;
      const l1 = (lit.data[i] + lit.data[i + 1] + lit.data[i + 2]) / 3;
      const l0 = dark.data[i + 3] ? (dark.data[i] + dark.data[i + 1] + dark.data[i + 2]) / 3 : 0;
      const gain = l1 - l0;
      if (gain <= MUZZLE_GAIN) continue;
      sx += x * gain; sy += y * gain; total += gain;
    }
  }
  if (!total) return null;
  // `crop` answers a PNG-ordered buffer (row 0 is the picture's top),
  // which is the order the union rect is drawn in - so no flip here.
  // The one that needs it is `toScreenOrder` above, on the way to GL.
  return { x: (sx / total) / w, y: (sy / total) / h };
}
