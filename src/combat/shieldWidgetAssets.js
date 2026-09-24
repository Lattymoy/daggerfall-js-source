// @ts-check
// SW1: SHIELD WIDGET'S SPRITES, vendored.
//
// 600 of them - four archives (112360 Buckler, 112361 Round, 112362
// Kite, 112363 Tower), thirty records each, five frames each. A record
// is a MATERIAL GROUP plus a CONDITION TIER, so the set is the mod's own
// art for every shield in every metal at three states of wear.
//
// THEY ARE THE MODDER'S OWN ART, NOT A RENDER OF ARENA2. Classic
// Daggerfall draws no first-person shield at all - there is no original
// for these to be a repaint of. That is what separates them from Weapon
// Widget's 173 (repaints of the classic WEAPON*.CIF frames) and from
// Seasons of the Iliac Bay's flats, which the doctrine
// (bible/01-Overview/Port-Doctrine.md: A RENDER OF GAME DATA IS GAME
// DATA) keeps out of this repository and reads from the player's own
// copy of the mod. This art is carried, the way Eye of the Beholder's
// 3035 sprites and Handheld Torches' are, and the mod works out of the
// box with nothing to attach.
//
// RE-ENCODED, and measured over all 600 rather than sampled:
//   - every pixel's alpha is 0 or 255 - the classic 1-bit cutout, which
//     is the port's own law (`if (t.a < 0.5) discard`);
//   - no sprite holds more than 84 distinct colours once the
//     transparent pixels are counted as one.
// So each is written as an indexed PNG with an exact palette and a
// single transparent index: 49.51 MB of RGBA becomes 2.02 MB on disk,
// verified per sprite, all 600 - every DRAWN pixel identical, every
// hidden pixel still hidden. Lossless for everything that reaches a
// screen; not byte-lossless, because the ghost colour the author's
// export left UNDER the transparent pixels collapses to one index.
// Nothing visible changes; the bytes under the cutout do.
//
// SW4 (2026-09-19, Mac: "the new shield mod we integrated shows the
// shields upside down") - AND REVERSED, ONCE, ON DISK. The 600 came out
// of the mod's Unity texture buffer without the flip a PNG's top-down
// rows need - a Texture2D is stored bottom-up - so every sprite shipped
// vertically mirrored and the arm reached DOWN into the shield out of
// the sky. The rows were reversed in place, palette and transparent
// index carried over byte for byte, each file checked by flipping the
// output back to the input. The door below is unchanged, because the
// door was never what was wrong: see bible/05-Combat/Shield-Widget.md.

import { toScreenOrder } from '../formats/color32Order.js';
import { decodePng } from '../systems/textureReplacement.js';
import { SHIELD_TEXTURE_COUNT, shieldTextureName } from './shieldWidget.js';

export const SHIELD_WIDGET_MOD = Object.freeze({
  guid: 'e59d8114-e9a2-4e8e-84e8-4666475dbb9f',
  title: 'Shield Widget',
  version: '1.6',
  author: 'RedRoryOTheGlen',
});

/** TextureReplacement's own spelling, which is what the files are named. */
export function shieldTextureFileName(index) {
  const { archive, record, frame } = shieldTextureName(index);
  return `${archive}_${record}-${frame}`;
}

/** The sprite's path in the repository, which is what the pins read. */
export const shieldSpritePath = (index) => `vendor/shield-widget/Textures/${shieldTextureFileName(index)}.png`;

/** The vendored sprite's URL - the shape handheldTorches.js uses for its
 *  own, which is what lets the bundler carry them. The archive, record
 *  and frame are interpolated separately, as that door does: measured
 *  over a real build, all 600 names reach the bundle. INLINE1
 *  (2026-09-20): ALL 600 AS FILES. This used to read "201 as files and
 *  the rest inlined under Vite's 4 KB limit, which is the project's
 *  setting and not this mod's business" - and that deference is exactly
 *  how 275 of these went into the boot chunk as 1.34 MB of base64. The
 *  project's setting now refuses to inline anything under vendor/
 *  (vite.config.js, test/vendorinline.test.js). */
export const shieldSpriteUrl = (index) => {
  const { archive, record, frame } = shieldTextureName(index);
  return new URL(`../../vendor/shield-widget/Textures/${archive}_${record}-${frame}.png`, import.meta.url).href;
};

// ---- the registry ----------------------------------------------------

/** Every sprite's size, keyed by flat index. Written once by
 *  `SHIELD_SPRITE_SIZES` below, because the widget's rect maths measures
 *  a sprite BEFORE any texture is uploaded - a shield with no measured
 *  size draws nothing. The four archives each hold one size, so the
 *  table is four rows and not six hundred. */
export const SHIELD_ARCHIVE_SIZES = Object.freeze({
  112360: Object.freeze({ width: 134, height: 131 }),   // Buckler
  112361: Object.freeze({ width: 157, height: 132 }),   // Round
  112362: Object.freeze({ width: 157, height: 125 }),   // Kite
  112363: Object.freeze({ width: 196, height: 146 }),   // Tower
});

/** The sprite's size. Known up front for every one of the 600. */
export function shieldWidgetSize(index) {
  if (!(index >= 0 && index < SHIELD_TEXTURE_COUNT)) return null;
  return SHIELD_ARCHIVE_SIZES[shieldTextureName(index).archive] ?? null;
}

const _images = new Map();   // flat index -> Promise<image | null>

/** One sprite - `{ width, height, colors }` RGBA in the port's color32
 *  shape, which is what `renderer.uploadTexture` reads (TEX1). The rows
 *  stay as the PNG has them: this is a SCREEN quad, so it takes
 *  `toScreenOrder` and not `toColor32`'s flip (HT3's law, and WW3's
 *  crash is why the SHAPE is named here too). Cached per index, misses
 *  included. */
export function shieldWidgetImage(index) {
  if (!(index >= 0 && index < SHIELD_TEXTURE_COUNT)) return Promise.resolve(null);
  if (!_images.has(index)) {
    _images.set(index, (async () => {
      try {
        const res = await fetch(shieldSpriteUrl(index));
        if (!res.ok) return null;
        return toScreenOrder(await decodePng(new Uint8Array(await res.arrayBuffer())));
      } catch (e) {
        console.warn(`[shield widget] ${shieldTextureFileName(index)} would not load:`, e?.message ?? e);
        return null;
      }
    })());
  }
  return _images.get(index);
}

/** The widget's `textures` dep. */
export const shieldWidgetTextures = Object.freeze({ size: shieldWidgetSize, image: shieldWidgetImage });

/** The four archives, for a probe or a pin. */
export const SHIELD_ARCHIVES = Object.freeze(Object.keys(SHIELD_ARCHIVE_SIZES).map(Number));
