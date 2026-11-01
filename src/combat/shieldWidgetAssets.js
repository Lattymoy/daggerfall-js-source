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
import { paintSteps } from '../art/ownPainter.js';
import { idleWork } from '../systems/idleWork.js';
import { paintShieldFace, SHIELD_GROUPS, SHIELD_TIERS } from './shieldFaces.js';
import { SHIELD_TEXTURE_COUNT, SHIELD_FRAMES, shieldTextureName } from './shieldWidget.js';

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
let _work = null; // the idle queue the slots are painted on (systems/idleWork.js): the page's, or a test's

/** Slot `index` queued for painting in the page's idle slices, once. */
function paintSlot(index) {
  if (!_images.has(index)) {
    const steps = paintSteps((queue) => paintShieldFace(index, shieldWidgetSize(index), queue));
    _images.set(
      index,
      new Promise((resolve) =>
        (_work ?? idleWork()).add(index, steps, (picture) => resolve(picture ? toScreenOrder(picture) : null)),
      ),
    );
  }
  return _images.get(index);
}

/** One sprite - `{ width, height, colors }` RGBA in the port's color32 shape, which is what `renderer.uploadTexture`
 *  reads (TEX1). The rows stay as the painting has them, a SCREEN quad's (HT3's law). Painted once per index, a few
 *  milliseconds at a time in the page's idle slices and never in the frame that asks: until it is ready the widget
 *  draws nothing (weaponRig.js shieldTextureFor). An ask puts its slot first. */
export function shieldWidgetImage(index) {
  if (!(index >= 0 && index < SHIELD_TEXTURE_COUNT)) return Promise.resolve(null);
  const picture = paintSlot(index);
  (_work ?? idleWork()).hurry(index);
  return picture;
}

/** A shield's slots warmed before they are drawn - its record's frames, then its other wear tiers' (a blow can batter
 *  it mid-fight) - from any one of them. The widget asks it as it takes a shield. */
export function warmShieldSlots(index) {
  if (!(index >= 0 && index < SHIELD_TEXTURE_COUNT)) return;
  const perTier = SHIELD_GROUPS * SHIELD_FRAMES;
  const tier = Math.floor(shieldTextureName(index).record / SHIELD_GROUPS);
  const first = index - (index % SHIELD_FRAMES) - tier * perTier;
  for (let k = 0; k < SHIELD_TIERS; k++)
    for (let frame = 0; frame < SHIELD_FRAMES; frame++)
      paintSlot(first + ((tier + k) % SHIELD_TIERS) * perTier + frame);
}

/** Test seam: the idle queue the slots are painted on, the painted ones forgotten. */
export function _setShieldPaintWorkForTests(work = null) {
  _work = work;
  _images.clear();
}

/** The widget's `textures` dep. */
export const shieldWidgetTextures = Object.freeze({
  size: shieldWidgetSize,
  image: shieldWidgetImage,
  warm: warmShieldSlots,
});

/** The four archives, for a probe or a pin. */
export const SHIELD_ARCHIVES = Object.freeze(Object.keys(SHIELD_ARCHIVE_SIZES).map(Number));
