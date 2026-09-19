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
import { toColor32 } from '../formats/color32Order.js';   // WW3: the ORDER *and* the shape uploadTexture reads
import { WEAPON_TYPES, getWeaponAnims } from './fpsWeapon.js';

/** The sheet, beside the page that ships it - relative to the
 *  document, so the same build serves from a site root and from a
 *  preview directory (the gun lab's own lesson). */
export const SHEET_FILE = 'art/gun-fire-sheet.webp';
export const sheetUrl = (file = SHEET_FILE) =>
  new URL(file, globalThis.document?.baseURI ?? 'http://localhost/').href;

/** The key's defaults, the numbers the lab's slider settled on. */
export const KEY_THRESHOLD = 244, KEY_CHROMA = 10;

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

/** Crop to a box, in the shape toColor32 reads. */
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
export const NATIVE_WIDTH = 0.54 * 320;

/**
 * Load it. `fetchBytes` is the door a test comes through; by default
 * the sheet is fetched from the build beside the page.
 * @returns the same shape loadFpsWeaponArt answers, or null.
 */
export async function loadThunderlockArt(renderer, { fetch: fetchSheet = null, decode = decodePng } = {}) {
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

  const frames = baked.map((b, i) =>
    renderer.uploadTexture('img', `thunderlock:${i}`, toColor32(crop(b.img, union))));

  return {
    weaponType: WEAPON_TYPES.Thunderlock,
    anims: getWeaponAnims(WEAPON_TYPES.Thunderlock),
    records: [
      { width, height, frames: [frames[0]] },   // 0: idle
      { width, height, frames },                // 1: the fire cycle
    ],
    // what the CIF path has no need of, and the rig does: the gun's
    // own box inside the union, for a caller that wants to place the
    // WEAPON rather than the smoke
    anchor: { x: (anchor.x - union.x) * scale, y: (anchor.y - union.y) * scale, w: anchor.w * scale, h: anchor.h * scale },
  };
}
