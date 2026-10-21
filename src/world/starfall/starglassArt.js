// @ts-check
// STAR7 (2026-10-20): STARGLASS'S OWN PICTURE - a sliver of the fallen star's glass, painted here in code under a
// pseudo-archive of its own (world/eliteGates/pseudoArchives.js) on the Hour's paint box (world/superDungeon/sdPixelKit.js): the
// stone's own glass ramp and its violet vein (world/starfall/starArt.js STAR_RAMPS), lit from the top-left through the
// ordered dither, a dark violet outline, its ground clear. Nothing ships and nothing is read from the player's data
// (Port-Doctrine: A RENDER OF GAME DATA IS GAME DATA): the same pixels every boot.
//
// It reaches every door an item's picture does as a STAND-IN of its archive (systems/textureReplacement.js
// addVendorTextures - `standIn`, `build`), the Weir Key's way (world/eliteGates/egKeyArt.js); systems/starfall/starglass.js
// registers it at its import.
//
// Pure but for its registration. Not a DFU member. Ledger A (STARFALL).
import { image, putTexel, ramp, paletteOf, quantize } from '../superDungeon/sdPixelKit.js';
import { STAR_RAMPS } from './starArt.js';

/** Starglass's pseudo-archive (registered in world/eliteGates/pseudoArchives.js), its one record. */
export const STARGLASS_ARCHIVE = 38302;
export const STARGLASS_ART = Object.freeze({ archive: STARGLASS_ARCHIVE, record: 0 });
/** Its size in texels: an upright sliver inside an item cell (ui/item/itemScroller.js CELL_W x SLOT_H, never enlarged). */
export const STARGLASS_ART_SIZE = Object.freeze({ w: 20, h: 22 });
/** The outline: the vein's darkest, darker. */
export const STARGLASS_OUTLINE = Object.freeze([34, 22, 70]);
/** The sliver's corners, in texels - broken at the top, a long point at the foot, leaning a little. */
const SHARD = Object.freeze([[8, 1], [13, 3], [16, 9], [13, 17], [9, 21], [5, 15], [3, 7]]);
/** The vein: a crack of the star's light from near its top to near its foot. */
const VEIN = Object.freeze([[10, 4], [9, 9], [11, 13], [9, 18]]);

/** Whether a point lies inside the sliver (the polygon's own crossing test). Pure. */
function inside(x, y) {
  let c = false;
  for (let i = 0, j = SHARD.length - 1; i < SHARD.length; j = i++) {
    const [xi, yi] = SHARD[i], [xj, yj] = SHARD[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
/** The distance from a point to the vein's line. */
function veinDist(x, y) {
  let best = Infinity;
  for (let i = 0; i + 1 < VEIN.length; i++) {
    const [ax, ay] = VEIN[i], [bx, by] = VEIN[i + 1], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return best;
}
/** What texel (x, y) is: 'vein', 'glass' or null (clear). Pure. */
export function starglassTexel(x, y) {
  const cx = x + 0.5, cy = y + 0.5;
  if (!inside(cx, cy)) return null;
  return veinDist(cx, cy) < 0.75 ? 'vein' : 'glass';
}

/**
 * STARGLASS'S PICTURE, painted (pure - the same pixels every call): `{ width, height, colors }`, rows top-down, RGBA. The
 * glass lighter toward its top-left facet and a step down toward its foot, the vein lit, a one-texel outline round the
 * sliver, the rest clear (alpha 0); every opaque texel in the glass's, the vein's or the outline's colours.
 */
export function starglassArt() {
  const { w, h } = STARGLASS_ART_SIZE;
  const img = image(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = starglassTexel(x, y);
      if (k === 'vein') putTexel(img, x, y, ramp(STAR_RAMPS.vein, 1 - veinDist(x + 0.5, y + 0.5) / 0.75, x, y));
      else if (k === 'glass') {
        const lit = starglassTexel(x - 1, y) == null || starglassTexel(x, y - 1) == null;   // the facet the light falls on
        putTexel(img, x, y, ramp(STAR_RAMPS.glass, lit ? 0.95 : 0.7 - (y / h) * 0.5, x, y));
      }
    }
  }
  const near = (x, y) => starglassTexel(x - 1, y) || starglassTexel(x + 1, y) || starglassTexel(x, y - 1) || starglassTexel(x, y + 1);
  const outline = new Set();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!starglassTexel(x, y) && near(x, y)) { outline.add(y * w + x); putTexel(img, x, y, [...STARGLASS_OUTLINE]); }
  quantize(img, paletteOf(STAR_RAMPS.glass, STAR_RAMPS.vein, [STARGLASS_OUTLINE]));
  // the ground clear again: quantize forces every texel's colour, the clear ones' too (their alpha it leaves at 0)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!starglassTexel(x, y) && !outline.has(y * w + x)) { const i = (y * w + x) * 4; img.colors[i] = 0; img.colors[i + 1] = 0; img.colors[i + 2] = 0; }
  return img;
}

let _registered = false;
/**
 * STARGLASS'S PICTURE ON THE TEXTURE DOOR, once: a stand-in of its archive, built when the archive is first asked (the Weir
 * Key's law). `addVendorTextures` is handed in, keeping this file free of the texture door's imports. Answers how many
 * were registered (0 the second time).
 * @param {(entries: any[]) => number} addVendorTextures
 */
export function registerStarglassArt(addVendorTextures) {
  if (_registered || typeof addVendorTextures !== 'function') return 0;
  _registered = true;
  return addVendorTextures([{
    archive: STARGLASS_ART.archive, record: STARGLASS_ART.record, frame: 0, standIn: true, fileName: `starglass-${STARGLASS_ART.archive}_${STARGLASS_ART.record}`,
    build: async () => { const img = starglassArt(); return { width: img.width, height: img.height, data: img.colors }; },
  }]);
}
/** Test seam: unregistered. */
export function _resetStarglassArt() { _registered = false; }
