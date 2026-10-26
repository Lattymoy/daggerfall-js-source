// @ts-check
// LOCKPICK (2026-10-26; bible/06-Systems/Lockpicking.md): THE LOCKPICK'S OWN PICTURE - a hook pick with a leather-wrapped
// grip laid across an L-shaped tension wrench, painted here in code under a pseudo-archive of its own
// (world/eliteGates/pseudoArchives.js) on the Hour's paint box (world/superDungeon/sdPixelKit.js): steel lit from the
// top-left through the ordered dither, the grip's wraps banded, a dark outline, its ground clear. Nothing ships and nothing
// is read from the player's data (Port-Doctrine: A RENDER OF GAME DATA IS GAME DATA): the same pixels every boot.
//
// It reaches every door an item's picture does as a STAND-IN of its archive (systems/textureReplacement.js
// addVendorTextures - `standIn`, `build`), Starglass's way (world/starfall/starglassArt.js); systems/lockpick/lockpickItem.js
// registers it at its import.
//
// Pure but for its registration. Not a DFU member. Ledger A (LOCKPICK).
import { image, putTexel, ramp, paletteOf, quantize } from '../../world/superDungeon/sdPixelKit.js';

/** The lockpick's pseudo-archive (registered in world/eliteGates/pseudoArchives.js), its one record. */
export const LOCKPICK_ARCHIVE = 38321;
export const LOCKPICK_ART = Object.freeze({ archive: LOCKPICK_ARCHIVE, record: 0 });
/** Its size in texels: inside an item cell (ui/item/itemScroller.js CELL_W x SLOT_H, never enlarged). */
export const LOCKPICK_ART_SIZE = Object.freeze({ w: 22, h: 22 });
/** The ramps: the picks' steel, dark to bright; the grip's leather; the outline. */
export const LOCKPICK_RAMPS = Object.freeze({
  steel: Object.freeze([[64, 68, 78], [104, 110, 122], [150, 156, 168], [198, 202, 212], [236, 238, 244]]),
  leather: Object.freeze([[44, 28, 18], [72, 46, 28], [102, 68, 42]]),
});
export const LOCKPICK_OUTLINE = Object.freeze([22, 20, 26]);
/** The strokes, in texels: [x0, y0, x1, y1, half width, material]. The pick - its grip low on the left, its shaft rising
 *  to the right and its hook bent down at the tip - laid over the wrench's long arm and its short leg. */
const STROKES = Object.freeze([
  Object.freeze([5, 18.5, 17.5, 18.5, 0.75, 'steel']),
  Object.freeze([17.5, 18.5, 17.5, 15.2, 0.75, 'steel']),
  Object.freeze([2.6, 19.4, 8.2, 13.8, 1.35, 'leather']),
  Object.freeze([8.2, 13.8, 17.6, 4.4, 0.62, 'steel']),
  Object.freeze([17.6, 4.4, 19.4, 3.6, 0.62, 'steel']),
  Object.freeze([19.4, 3.6, 19.4, 5.6, 0.6, 'steel']),
]);

/** The distance from a point to a stroke's line, and how far along it the point stands (0..1). */
function along(x, y, s) {
  const [ax, ay, bx, by] = /** @type {number[]} */ (s), dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return [Math.hypot(x - (ax + t * dx), y - (ay + t * dy)), t];
}
/** What texel (x, y) is: 'steel', 'leather' or null (clear) - the last stroke that covers it, so the pick lies over the
 *  wrench. Pure. */
export function lockpickTexel(x, y) {
  const cx = x + 0.5, cy = y + 0.5;
  let k = null;
  for (const s of STROKES) if (along(cx, cy, s)[0] <= Number(s[4])) k = s[5];
  return k;
}

/**
 * THE LOCKPICK'S PICTURE, painted (pure - the same pixels every call): `{ width, height, colors }`, rows top-down, RGBA.
 * The steel brighter where the light falls (a texel with clear ground above it or to its left), the grip's wraps banded
 * along its length, a one-texel outline round the two pieces, the rest clear (alpha 0).
 */
export function lockpickArt() {
  const { w, h } = LOCKPICK_ART_SIZE;
  const img = image(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = lockpickTexel(x, y);
      if (!k) continue;
      const lit = lockpickTexel(x - 1, y) == null || lockpickTexel(x, y - 1) == null;
      if (k === 'leather') {
        const [, t] = along(x + 0.5, y + 0.5, STROKES[2]);
        const band = Math.floor(t * 7) % 2 === 0;   // the wraps
        putTexel(img, x, y, ramp(LOCKPICK_RAMPS.leather, (band ? 0.75 : 0.35) + (lit ? 0.2 : 0), x, y));
      } else putTexel(img, x, y, ramp(LOCKPICK_RAMPS.steel, lit ? 0.92 : 0.45 + (1 - y / h) * 0.25, x, y));
    }
  }
  const near = (x, y) => lockpickTexel(x - 1, y) || lockpickTexel(x + 1, y) || lockpickTexel(x, y - 1) || lockpickTexel(x, y + 1);
  const outline = new Set();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!lockpickTexel(x, y) && near(x, y)) { outline.add(y * w + x); putTexel(img, x, y, [...LOCKPICK_OUTLINE]); }
  quantize(img, paletteOf(LOCKPICK_RAMPS.steel, LOCKPICK_RAMPS.leather, [LOCKPICK_OUTLINE]));
  // the ground clear again: quantize forces every texel's colour, the clear ones' too (their alpha it leaves at 0)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!lockpickTexel(x, y) && !outline.has(y * w + x)) { const i = (y * w + x) * 4; img.colors[i] = 0; img.colors[i + 1] = 0; img.colors[i + 2] = 0; }
  return img;
}

let _registered = false;
/**
 * THE LOCKPICK'S PICTURE ON THE TEXTURE DOOR, once: a stand-in of its archive, built when the archive is first asked
 * (Starglass's law). `addVendorTextures` is handed in, keeping this file free of the texture door's imports. Answers how
 * many were registered (0 the second time).
 * @param {(entries: any[]) => number} addVendorTextures
 */
export function registerLockpickArt(addVendorTextures) {
  if (_registered || typeof addVendorTextures !== 'function') return 0;
  _registered = true;
  return addVendorTextures([{
    archive: LOCKPICK_ART.archive, record: LOCKPICK_ART.record, frame: 0, standIn: true, fileName: `lockpick-${LOCKPICK_ART.archive}_${LOCKPICK_ART.record}`,
    build: async () => { const img = lockpickArt(); return { width: img.width, height: img.height, data: img.colors }; },
  }]);
}
/** Test seam: unregistered. */
export function _resetLockpickArt() { _registered = false; }
