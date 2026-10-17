// @ts-check
// EG-ZH (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 5 and 25.1): THE WEIR
// KEY'S OWN PICTURE - painted here in code into the Spire's held archive block (world/eliteGates/pseudoArchives.js EG_ARCH_BLOCK.key,
// 38282: "the arch, the key and the beacon", in the page's order), where EG-PLAY's key wore DFU's Talisman (TEXTURE.211
// record 50). Nothing ships and nothing is read from the player's data (Port-Doctrine: A RENDER OF GAME DATA IS GAME DATA):
// the same pixels every boot, through the Hour's paint box (world/superDungeon/sdPixelKit.js) - a ramp through the ordered dither, the
// light from the top-left, a dark outline, and every texel forced into the picture's own ramps at the end.
//
// THE KEY: a Battlemage's key in the Galleries' gold leaf (world/eliteGates/egBandArt.js EG_BAND_RAMPS[0].metal - the Hour's brass,
// reused), its bow a ring round a Battlemage-blue stone lit from within (the same band's accent), its shaft to the right,
// a collar at the bow and a two-step bit hanging from its end. EG_KEY_ART_SIZE texels, the cell an item list draws it in
// (ui/item/itemScroller.js CELL_W x SLOT_H, never enlarged), its ground clear.
//
// It reaches every door an item's picture does as a STAND-IN of its archive (systems/textureReplacement.js
// addVendorTextures - `standIn`, `build`): the lists' icon drawer asks `getTexture(archive)`, the pipeline stands the
// shell in, and the swap arm uploads this picture (systems/eliteGates/weirKey.js registers it at its import).
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { image, putTexel, ramp, paletteOf, quantize } from '../superDungeon/sdPixelKit.js';
import { EG_BAND_RAMPS } from './egBandArt.js';
import { EG_ARCH_BLOCK } from './pseudoArchives.js';

/** Where the key's picture is kept: the arch's block's second number, record 0. */
export const WEIR_KEY_ART = Object.freeze({ archive: EG_ARCH_BLOCK.key, record: 0 });
/** Its size (texels): wide as a key lies, inside an item cell. */
export const EG_KEY_ART_SIZE = Object.freeze({ w: 32, h: 22 });
/** The outline's colour - the gold's own shadow, darker. */
export const EG_KEY_OUTLINE = Object.freeze([40, 26, 10]);
const GOLD = EG_BAND_RAMPS[0].metal, BLUE = EG_BAND_RAMPS[0].accent;
/** The stone's light at its heart (a step past the accent's top, as soul-light is past the Cairn's stone). */
const STONE_GLINT = Object.freeze([168, 196, 240]);

/** The bow's ring and stone (centre, outer and inner radius), the shaft, the collar and the bit - in texels. */
const BOW = Object.freeze({ x: 7.5, y: 10.5, r0: 7, r1: 3.6 });
const SHAFT = Object.freeze({ x0: 14, x1: 30, y0: 9, y1: 12 });
const COLLAR = Object.freeze({ x0: 14, x1: 16, y0: 7, y1: 14 });
const BIT = Object.freeze([Object.freeze({ x0: 22, x1: 25, y0: 12, y1: 16 }), Object.freeze({ x0: 26, x1: 30, y0: 12, y1: 19 })]);

/** What texel (x, y) is: 'stone', 'gold' or null (clear). Pure. */
export function egKeyTexel(x, y) {
  const cx = x + 0.5, cy = y + 0.5, d = Math.hypot(cx - BOW.x, cy - BOW.y);
  if (d <= BOW.r1) return 'stone';
  if (d <= BOW.r0) return 'gold';
  const inBox = (b) => x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1;
  if (inBox(SHAFT) || inBox(COLLAR) || BIT.some(inBox)) return 'gold';
  return null;
}

/**
 * THE WEIR KEY'S PICTURE, painted (pure - the same pixels every call): `{ width, height, colors }` (the paint box's image,
 * rows top-down, RGBA). The gold lit from the top-left through the ordered dither (its far side and underside a step down),
 * the stone dark at its rim and lit at its heart, a one-texel outline round everything, the rest clear (alpha 0); every
 * opaque texel in the gold's, the blue's or the outline's colours.
 */
export function egKeyArt() {
  const { w, h } = EG_KEY_ART_SIZE;
  const img = image(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = egKeyTexel(x, y);
      if (k === 'stone') {
        const d = Math.hypot(x + 0.5 - (BOW.x - 0.8), y + 0.5 - (BOW.y - 0.8)) / BOW.r1;   // lit from the top-left
        putTexel(img, x, y, d < 0.35 ? [...STONE_GLINT] : ramp(BLUE, 1 - d, x, y));
      } else if (k === 'gold') {
        // the light from the top-left: lighter toward the top of each part and its left; the underside a step down
        const up = egKeyTexel(x, y - 1) == null, down = egKeyTexel(x, y + 1) == null, left = egKeyTexel(x - 1, y) == null;
        const t = up || left ? 0.95 : down ? 0.15 : 0.62 - (x / w) * 0.25;
        putTexel(img, x, y, ramp(GOLD, t, x, y));
      }
    }
  }
  // the outline: every clear texel that touches the key on a side
  const near = (x, y) => egKeyTexel(x - 1, y) || egKeyTexel(x + 1, y) || egKeyTexel(x, y - 1) || egKeyTexel(x, y + 1);
  const outline = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!egKeyTexel(x, y) && near(x, y)) outline.push([x, y]);
  for (const [x, y] of outline) putTexel(img, x, y, [...EG_KEY_OUTLINE]);
  quantize(img, paletteOf(GOLD, BLUE, [STONE_GLINT], [EG_KEY_OUTLINE]));
  // the ground clear again: quantize forces every texel's colour, the clear ones' too (their alpha it leaves at 0)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!egKeyTexel(x, y) && !outline.some((p) => p[0] === x && p[1] === y)) { const i = (y * w + x) * 4; img.colors[i] = 0; img.colors[i + 1] = 0; img.colors[i + 2] = 0; }
  return img;
}

/**
 * THE KEY'S PICTURE ON THE TEXTURE DOOR, once: a stand-in of its archive (no TEXTURE file is it), built when the archive is
 * first asked (world/ships/galleonArt.js registerGalleonArt's law). `addVendorTextures` is handed in (systems/
 * textureReplacement.js's), keeping this file free of the texture door's imports. Answers how many were registered (0 the
 * second time).
 * @param {(entries: any[]) => number} addVendorTextures
 */
let _registered = false;
export function registerWeirKeyArt(addVendorTextures) {
  if (_registered || typeof addVendorTextures !== 'function') return 0;
  _registered = true;
  return addVendorTextures([{
    archive: WEIR_KEY_ART.archive, record: WEIR_KEY_ART.record, frame: 0, standIn: true, fileName: `weir-key-${WEIR_KEY_ART.archive}_${WEIR_KEY_ART.record}`,
    build: async () => { const img = egKeyArt(); return { width: img.width, height: img.height, data: img.colors }; },
  }]);
}
/** Test seam: unregistered. */
export function _resetWeirKeyArt() { _registered = false; }
