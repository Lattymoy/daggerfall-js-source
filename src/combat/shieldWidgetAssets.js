// @ts-check
// SW1: SHIELD WIDGET'S SPRITES. OWN-WORK4 (2026-10-31): the mod's 600 pictures are retired; each slot is our own
// painting (combat/shieldFaces.js), made in code the first time the widget asks for it. Four archives (112360
// Buckler, 112361 Round, 112362 Kite, 112363 Tower), thirty records each (a material group and a wear tier), five
// frames each: the slots, the sizes and the frames the widget plays are the mod's, the pictures ours.
//
// SW4 (2026-09-19, Mac: "the new shield mod we integrated shows the shields upside down"): a held shield's forearm
// runs off the BOTTOM edge and the top edge is clear. The door hands the painting's top-down rows to a screen quad
// through toScreenOrder, never toColor32, which would flip them.

import { toScreenOrder } from '../formats/color32Order.js';
import { paintShieldFace } from './shieldFaces.js';
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

// ---- the registry ----------------------------------------------------

/** Every sprite's size, by archive: the widget's rect maths measures a
 *  sprite BEFORE any texture is uploaded - a shield with no measured size
 *  draws nothing. The mod's own sizes, which our paintings take. */
export const SHIELD_ARCHIVE_SIZES = Object.freeze({
  112360: Object.freeze({ width: 134, height: 131 }), // Buckler
  112361: Object.freeze({ width: 157, height: 132 }), // Round
  112362: Object.freeze({ width: 157, height: 125 }), // Kite
  112363: Object.freeze({ width: 196, height: 146 }), // Tower
});

/** The sprite's size. Known up front for every one of the 600. */
export function shieldWidgetSize(index) {
  if (!(index >= 0 && index < SHIELD_TEXTURE_COUNT)) return null;
  return SHIELD_ARCHIVE_SIZES[shieldTextureName(index).archive] ?? null;
}

const _images = new Map(); // flat index -> Promise<image | null>

/** One sprite - `{ width, height, colors }` RGBA in the port's color32 shape, which is what `renderer.uploadTexture`
 *  reads (TEX1). The rows stay as the painting has them, a SCREEN quad's (HT3's law). Painted once per index. */
export function shieldWidgetImage(index) {
  if (!(index >= 0 && index < SHIELD_TEXTURE_COUNT)) return Promise.resolve(null);
  if (!_images.has(index)) {
    _images.set(
      index,
      (async () => {
        const picture = paintShieldFace(index, shieldWidgetSize(index));
        return picture ? toScreenOrder(picture) : null;
      })(),
    );
  }
  return _images.get(index);
}

/** The widget's `textures` dep. */
export const shieldWidgetTextures = Object.freeze({ size: shieldWidgetSize, image: shieldWidgetImage });

/** The four archives, for a probe or a pin. */
export const SHIELD_ARCHIVES = Object.freeze(Object.keys(SHIELD_ARCHIVE_SIZES).map(Number));

/** OWN-WORK4: our presets, in this store's keys (modSettings.js 'shield-widget'), by one rule: each sets one section
 *  to its defaults, or moves every slider of it half the way from its default toward one end of its range. */
export const SHIELD_WIDGET_PRESETS = Object.freeze([
  { title: 'Position - Default', values: { 'Shield.OffsetHorizontal': 0.5, 'Shield.OffsetVertical': 0.5 } },
  { title: 'Position - Low', values: { 'Shield.OffsetHorizontal': -0.25, 'Shield.OffsetVertical': -0.25 } },
  { title: 'Position - High', values: { 'Shield.OffsetHorizontal': 0.75, 'Shield.OffsetVertical': 0.75 } },
  { title: 'Bob - Default', values: { 'Modules.Bob': true, 'Bob.SizeX': 1, 'Bob.SizeY': 1 } },
  { title: 'Bob - Wide', values: { 'Modules.Bob': true, 'Bob.SizeX': 1.5, 'Bob.SizeY': 0.5 } },
  { title: 'Bob - Tall', values: { 'Modules.Bob': true, 'Bob.SizeX': 0.5, 'Bob.SizeY': 1.5 } },
  {
    title: 'Inertia - Default',
    values: {
      'Modules.Inertia': true,
      'Inertia.Scale': 1,
      'Inertia.Speed': 1,
      'Inertia.ForwardDepth': 1,
      'Inertia.ForwardSpeed': 1,
    },
  },
  {
    title: 'Inertia - Light',
    values: {
      'Modules.Inertia': true,
      'Inertia.Scale': 0.5,
      'Inertia.Speed': 1.5,
      'Inertia.ForwardDepth': 0.5,
      'Inertia.ForwardSpeed': 1.5,
    },
  },
  {
    title: 'Inertia - Heavy',
    values: {
      'Modules.Inertia': true,
      'Inertia.Scale': 1.5,
      'Inertia.Speed': 0.5,
      'Inertia.ForwardDepth': 1.5,
      'Inertia.ForwardSpeed': 0.5,
    },
  },
]);
