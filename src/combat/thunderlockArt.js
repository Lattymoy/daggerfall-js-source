// THE DWARVEN THUNDERLOCK'S FIRST-PERSON ART.
//
// Every classic weapon's FP art is a WEAPON*.CIF out of the player's
// ARENA2, read by formats/cifRciFile.js and baked by
// fpsWeapon.loadFpsWeaponArt. This weapon is the port's own, so its
// art is OURS - the owner's seven frames under public/art (THUNDERLOCK-
// ART2, 2026-10-24; thunderlockFrames, below), shipped with the build.
//
// So this is loadFpsWeaponArt's other half: fetch, decode, cut, and hand
// back the SAME SHAPE the CIF path hands back -
//   { weaponType, anims, records: [{ width, height, frames: [tex] }] }
// - so drawFpsWeapon, the weapon rig and Weapon Widget's clone read it
// without any of them learning that a second kind of weapon art exists.
// TWO RECORDS, as the anim table names them: 0 is the idle pose (the rest
// frame), 1 is the seven fire frames. The six-frame contact sheet this
// file once sliced (FIELD-GUN's) is the gun lab's now (src/tools/gunLab.js,
// combat/gun/gunSheet.js), kept for it.

import { contentBox } from './gun/gunSheet.js';
import { stripCellRect, hardenAlpha, cropImage } from './gun/pistolStrip.js';   // THUNDERLOCK-ART2: the strip's cut - the Pistolet's laws, a leaf's
import { THUNDERLOCK_STRIP } from './gun/thunderlockStrip.js';   // the strip's shape, a leaf's (the anim table and the machine read it too)
import { FLASH_LUMA, flashMask, flashBodyPoint } from './gun/gunFlash.js';   // the flash's laws, the Pistolet's too - one home
import { decodePng } from '../systems/textureReplacement.js';
import { toScreenOrder } from '../formats/color32Order.js';   // FIELD-GUN3: HT3's law - a SCREEN QUAD's PNG keeps its rows
import { WEAPON_TYPES, getWeaponAnims } from './fpsWeapon.js';
import { GUN_FEEL } from './gun/gunFeel.js';   // FIELD-GUN7: the lab's settled pose, one home
import { APP_ROOT } from '../systems/appRoot.js';   // AUDIT-THUNDERLOCK F7: the SITE root, not the document's

/** The art, off the SITE ROOT rather than the document.
 *
 *  AUDIT-THUNDERLOCK F7: this resolved against `document.baseURI`,
 *  which is right on the lab's own page and WRONG in the game - the
 *  game's document is `/play/index.html`, so the browser would have
 *  asked for `/play/art/...`, been handed the page itself, failed to
 *  decode it, and drawn no weapon at all. That is not a guess: it is
 *  exactly what happened to the held map four weeks earlier (MAP-FIELD,
 *  "The sprite I gave to be used is nowhere to be seen at all"), and
 *  systems/appRoot.js is that fix's law, moved to a leaf so combat/ can
 *  afford to import it. */
export const sheetUrl = (file = `art/${THUNDERLOCK_STRIP.file}`) =>
  new URL(file, APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/').href;

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

/** GILDED1 (2026-10-07): the gun in gold leaf, the hand that holds it left as it is - a whole-sprite recolour would gild
 *  the glove too, and a gold-plated fist is not a gilded gun. Which pixels are the gun's is the art's own question
 *  (thunderlockGildKeep, below; the Pistolet's pistoletGildKeep); this is the gold they are laid in. */
/** GOLD LEAF, darkest to brightest - the Gilded rung's ramp (tools/gunIcons.mjs carries the list pictures' own). */
export const GILD_RAMP = Object.freeze([[52, 30, 4], [110, 72, 10], [172, 122, 24], [226, 176, 46], [252, 214, 90], [255, 240, 160], [255, 255, 236]]);
const goldAt = (t, out) => {
  const u = Math.max(0, Math.min(1, t)) * (GILD_RAMP.length - 1);
  const i = Math.min(GILD_RAMP.length - 2, Math.floor(u)), f = u - i;
  for (let k = 0; k < 3; k++) out[k] = GILD_RAMP[i][k] * (1 - f) + GILD_RAMP[i + 1][k] * f;
  return out;
};
/** GILD one frame IN PLACE: every pixel `keep` names (the gun's own) pulled toward the gold ramp by its lightness, the
 *  bright parts pulled hardest; alpha is never written. Answers the frame. */
export function gildFrame(rgba, keep) {
  const d = rgba.data, c = [0, 0, 0];
  for (let i = 0, n = rgba.width * rgba.height; i < n; i++) {
    const o = i * 4;
    if (!keep[i] || d[o + 3] === 0) continue;
    const lum = (d[o] * 0.299 + d[o + 1] * 0.587 + d[o + 2] * 0.114) / 255;
    const k = 0.55 + 0.45 * lum;
    goldAt(0.02 + 1.08 * lum ** 0.9, c);
    d[o] = d[o] * (1 - k) + c[0] * k;
    d[o + 1] = d[o + 1] * (1 - k) + c[1] * k;
    d[o + 2] = d[o + 2] * (1 - k) + c[2] * k;
  }
  return rgba;
}
/**
 * THUNDERLOCK-ART2 (2026-10-24, the owner: "Heres the new thunderlock sprite replacement"; bible/05-Combat/
 * Dwarven-Thunderlock.md "THUNDERLOCK-ART2"): THE OWNER'S SEVEN FRAMES, the Pistolet's way (combat/gun/pistoletArt.js).
 *
 *   - A STRIP, NOT A SHEET. Seven 160x98 frames side by side (public/art/thunderlock-frames.png): the rest frame, the
 *     shot (its flash and the Dweamer's bolt), two of smoke and three settling, the fifth held a beat. Each is registered
 *     to the others by its canvas, so they are cut at a fixed stride: no key, no badge gutter, no crop to content.
 *   - NATIVE SIZE, THE CANVAS THE ANCHOR. A frame is a WEAPON*.CIF record's size and the owner placed the gun in it, both
 *     forearms leaving through its foot, so the canvas is what is seated on the screen's corner (AlignRight), at
 *     THUNDERLOCK_ART.scale design pixels a texel - 160 of the surface's 320, where the old sheet's gun took 0.49.
 *   - THE 1-BIT CUT at THUNDERLOCK_ART.alphaCut (the screen quad discards under 0.5), made once, here.
 *   - SEATED, NEVER STRETCHED (the owner, of a first cut that carried the forearms on below the foot: "Why is it
 *     stretched at the bottom. You need to place it correctly"): the frames are drawn exactly as drawn, and the canvas is
 *     seated the kick's height (GUN_FEEL.kick) below the screen's foot - Weapon Widget's transform never lifts the foot
 *     off the screen (its floor), and the shot's kick, applied after it, lifts it at most that far - so the cut never
 *     shows and nothing is invented under it.
 *   - GILDED: the GUN's brass, found on EVERY frame (thunderlockGildKeep) - the shot kicks the gun inside the canvas;
 *     ENCHANTED: the shimmer on the gun and what is drawn bright, the hands left be (thunderlockShimmer).
 */
export { THUNDERLOCK_STRIP };
export const THUNDERLOCK_ART = Object.freeze({ scale: 1, raise: -GUN_FEEL.kick, alphaCut: 128 });
const hsl = (d, o) => {
  const r = d[o] / 255, g = d[o + 1] / 255, b = d[o + 2] / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dl = mx - mn;
  if (!dl) return [0, 0, l];
  const s = l > 0.5 ? dl / (2 - mx - mn) : dl / (mx + mn);
  const h = (mx === r ? (g - b) / dl + (g < b ? 6 : 0) : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4) * 60;
  return [h, s, l];
};
const luma = (d, o) => d[o] * 0.299 + d[o + 1] * 0.587 + d[o + 2] * 0.114;

/** THE GOLD'S KEEP on one frame: the gun's brass alone - hue 32-60, saturated, lit (the gloves are as warm but duller
 *  and darker, the sleeve grey) - never the flash: its white-hot texels, nor the flame grown out of its core (flashMask -
 *  the painted orange glow round the ball reads as brass by hue alone), nor the smoke. Pure. */
export function thunderlockGildKeep(img) {
  const { width: w, height: h, data } = img, flame = flashMask(img);
  const keep = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    if (data[o + 3] < 128 || flame[i] || luma(data, o) >= FLASH_LUMA) continue;
    const [hue, s, l] = hsl(data, o);
    keep[i] = hue >= 32 && hue <= 60 && s >= 0.5 && l >= 0.32 ? 1 : 0;
  }
  return keep;
}

/** THE ENCHANTED LOOK on one frame, IN PLACE: the shimmer (above) on the gun's brass and on everything drawn bright - the
 *  flash, the bolt, the smoke - never the gloves or the grey sleeve, which a whole-frame shimmer turned blue. Answers it. */
export const TL_SHIMMER_LUMA = 160;
export function thunderlockShimmer(img) {
  const keep = thunderlockGildKeep(img), d = img.data;
  const sh = shimmer({ width: img.width, height: img.height, data: new Uint8ClampedArray(d) }).data;
  for (let i = 0, n = img.width * img.height; i < n; i++) {
    const o = i * 4;
    if (d[o + 3] && (keep[i] || luma(d, o) >= TL_SHIMMER_LUMA)) { d[o] = sh[o]; d[o + 1] = sh[o + 1]; d[o + 2] = sh[o + 2]; }
  }
  return img;
}

/**
 * THE SEVEN FRAMES AS THEY ARE DRAWN: cut at the stride and hardened, in their look (the gold on each frame's own
 * brass; the shimmer on the gun and the bright). `anchor` and `union` are both the owner's canvas, `muzzle` read off the
 * plain shot frame. Pure; null for a strip that is not exactly seven 160x98 frames or whose rest frame is empty.
 * @param {{ width: number, height: number, data: ArrayLike<number> }} strip
 */
export function thunderlockFrames(strip, { gilded = false, magic = false } = {}) {
  const S = THUNDERLOCK_STRIP, A = THUNDERLOCK_ART;
  if (!strip?.data || strip.width !== S.frames * S.cellW || strip.height !== S.cellH) return null;   // exactly the owner's seven - an eighth frame or a padded strip is refused, never cut short
  const cells = Array.from({ length: S.frames }, (_, i) => { const c = cropImage(strip, stripCellRect(i, S)); hardenAlpha(c, A.alphaCut); return c; });
  if (!contentBox(cells[0])) return null;
  const frames = cells.map((c) => {
    const own = gilded || magic ? { width: c.width, height: c.height, data: new Uint8ClampedArray(c.data) } : c;
    return gilded ? gildFrame(own, thunderlockGildKeep(own)) : magic ? thunderlockShimmer(own) : own;
  });
  const canvas = { x: 0, y: 0, w: S.cellW, h: S.cellH };
  // the muzzle: the flash's ball - the largest white-hot body (gunFlash.js flashBodyPoint), never the bolt's sparks down the barrel
  return { frames, anchor: canvas, union: { ...canvas }, muzzle: flashBodyPoint(cells[1]) };
}

/**
 * Load it. `fetch` is the door a test comes through; by default the strip is fetched from the build beside the page.
 * The answer is loadFpsWeaponArt's shape and the Pistolet's (combat/gun/pistoletArt.js): `records` (0 the idle, 1 the
 * seven-frame cycle) at the CANVAS's size in design pixels, `anchor` and `unionBox` for gunFrameRect, `native` the
 * textures' own size, `muzzle`, and `pose` - the width and raise the rig places it by.
 * @returns the art, or null.
 */
export async function loadThunderlockArt(renderer, { fetch: fetchStrip = null, decode = decodePng, magic = false, gilded = false } = {}) {
  const file = `art/${THUNDERLOCK_STRIP.file}`;
  const bytes = fetchStrip
    ? await fetchStrip(file)
    : await (async () => {
      const r = await fetch(sheetUrl(file));
      if (!r.ok) throw new Error(`${file}: ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    })();
  const set = thunderlockFrames(await decode(bytes), { gilded, magic });
  if (!set) return null;
  const { frames, anchor, union, muzzle } = set, k = THUNDERLOCK_ART.scale;
  const type = magic ? WEAPON_TYPES.Thunderlock_Magic : WEAPON_TYPES.Thunderlock;
  const look = gilded ? ':gilded' : magic ? ':magic' : '';
  // FIELD-GUN3 (Mac, from play: "The sprite is upside down"): HT3's law - drawFpsWeapon ends in drawScreenQuad, whose
  // rect's top takes v0 with no flip at upload, so a decoded PNG keeps its rows (toScreenOrder, never toColor32's flip)
  const textures = frames.map((rgba, i) => renderer.uploadTexture('img', `thunderlock${look}:${i}`, toScreenOrder(rgba)));
  const anchorW = anchor.w * k, anchorH = anchor.h * k;
  return {
    weaponType: type,
    anims: getWeaponAnims(type),
    // FIELD-GUN11: THE RECORD IS THE GUN, NOT THE GUN PLUS WHAT HANGS OFF IT - the anchor's size; both draw sites expand
    // it back to the union at the moment of drawing (gunFrameRect)
    records: [
      { width: anchorW, height: anchorH, frames: [textures[0]] },   // 0: idle
      { width: anchorW, height: anchorH, frames: textures },        // 1: the fire cycle
    ],
    anchor: { x: anchor.x * k, y: anchor.y * k, w: anchorW, h: anchorH },
    unionBox: { x: 0, y: 0, w: union.w * k, h: union.h * k },
    native: { w: union.w, h: union.h },   // the glow's field is laid in the textures' own texels (AUDIT PISTOLET B4's law)
    // FIELD-GUN17: where the barrel ends, as fractions of the UNION box
    muzzle,
    pose: { widthPct: anchorW / 320, raise: THUNDERLOCK_ART.raise },
  };
}
