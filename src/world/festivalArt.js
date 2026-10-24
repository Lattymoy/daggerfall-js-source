// @ts-check
// WITCH1 (2026-10-20, bible/06-Systems/Witches-Festival.md): THE WITCHES' FESTIVAL'S OWN PICTURES - painted here in code
// (Port-Doctrine: A RENDER OF GAME DATA IS GAME DATA - nothing is read from the player's data, nothing ships) through the
// Hour's paint box (world/superDungeon/sdPixelKit.js): ramps through the ordered dither, the light from the top-left, a dark
// outline, every texel forced into the picture's own ramps at the end. Daggerfall has no gourd, no straw man and no cake;
// the festival brings them, painted to stand beside its own candles and skulls.
//
// ONE ARCHIVE, FESTIVAL_ARCHIVE (world/eliteGates/pseudoArchives.js registers it), a record each picture
// (FESTIVAL_ART): the Soul Cake's and the Hearth Offering's item pictures, the offering as it stands at a door, and the
// towns' turnip lantern, straw effigy and ward-staff (world/witchesDecor.js stands them). Each reaches every door a picture
// does as a STAND-IN of its archive (systems/textureReplacement.js addVendorTextures - `standIn`, `build`), so an item list
// and a billboard batch ask `getTexture(archive)` as they ask any of Daggerfall's (world/eliteGates/egKeyArt.js's law).
//
// Not a DFU member. Ledger A (THE WITCHES' FESTIVAL).
import { image, putTexel, ramp, paletteOf, quantize } from './superDungeon/sdPixelKit.js';

/** The festival's archive: a block of nine, its records the pictures below (the rest held). */
export const FESTIVAL_ARCHIVE = 38291;
/** Each picture's record. */
export const FESTIVAL_ART = Object.freeze({ cake: 0, offeringIcon: 1, offering: 2, turnip: 3, effigy: 4, wardStaff: 5 });

// ── the ramps, darkest first ────────────────────────────────────────────────────────────────────────────────────────────
const CAKE = Object.freeze([[70, 36, 16], [112, 62, 26], [158, 98, 42], [196, 136, 64], [226, 178, 102]]);
const ICING = Object.freeze([[176, 160, 132], [222, 210, 182], [246, 240, 222]]);
const SPICE = Object.freeze([[46, 24, 12]]);
const CLAY = Object.freeze([[64, 28, 16], [104, 46, 24], [146, 70, 36], [184, 100, 56]]);
const TALLOW = Object.freeze([[150, 132, 96], [204, 188, 146], [236, 226, 192]]);
const FLAME = Object.freeze([[200, 74, 18], [242, 142, 34], [255, 214, 92], [255, 246, 196]]);
const WOOD = Object.freeze([[40, 26, 14], [74, 48, 26], [108, 74, 40], [140, 100, 58]]);
const IRON = Object.freeze([[24, 22, 24], [48, 46, 50], [80, 78, 84]]);
const TURNIP = Object.freeze([[84, 52, 92], [138, 96, 138], [196, 168, 186], [232, 220, 214]]);
const LEAF = Object.freeze([[28, 52, 22], [52, 88, 34], [86, 124, 48]]);
const STRAW = Object.freeze([[96, 70, 26], [146, 112, 44], [192, 156, 70], [226, 198, 112]]);
const CLOTH = Object.freeze([[28, 20, 40], [52, 36, 68], [78, 56, 96]]);
const BONE = Object.freeze([[120, 112, 96], [176, 168, 146], [222, 216, 196]]);
const WITCHFIRE = Object.freeze([[30, 96, 40], [64, 168, 64], [146, 226, 108], [214, 250, 176]]);
const OUTLINE = Object.freeze([18, 12, 8]);

/** @typedef {{ hit: (x: number, y: number) => boolean, ramp: ReadonlyArray<ReadonlyArray<number>>, light?: (x: number, y: number) => number, flat?: number[] }} Layer */

/** An ellipse's test, centre (cx, cy), radii (rx, ry) - in texel centres. */
const ellipse = (/** @type {number} */ cx, /** @type {number} */ cy, /** @type {number} */ rx, /** @type {number} */ ry) => (/** @type {number} */ x, /** @type {number} */ y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
const rect = (/** @type {number} */ x0, /** @type {number} */ y0, /** @type {number} */ x1, /** @type {number} */ y1) => (/** @type {number} */ x, /** @type {number} */ y) => x >= x0 && x < x1 && y >= y0 && y < y1;
const and = (/** @type {Function} */ a, /** @type {Function} */ b) => (/** @type {number} */ x, /** @type {number} */ y) => a(x, y) && b(x, y);
const not = (/** @type {Function} */ a) => (/** @type {number} */ x, /** @type {number} */ y) => !a(x, y);
/** The light from the top-left, over a shape's own box: 1 at its top-left, 0 at its bottom-right. */
const litOver = (/** @type {number} */ x0, /** @type {number} */ y0, /** @type {number} */ w, /** @type {number} */ h, k = 1) => (/** @type {number} */ x, /** @type {number} */ y) => Math.max(0, Math.min(1, 1 - (((x - x0) / w) * 0.45 + ((y - y0) / h) * 0.55) * k));

/**
 * PAINT a picture of `w` x `h` from its layers, lowest first (a later layer over an earlier one): each texel its top
 * layer's ramp at the layer's light through the dither (or its flat colour), a one-texel outline round everything, the
 * rest clear; every opaque texel in the layers' colours. Pure: the same pixels every call. `{ width, height, colors }`.
 * @param {number} w @param {number} h @param {Layer[]} layers
 */
export function paintLayers(w, h, layers) {
  const img = image(w, h);
  /** @type {(Layer|null)[]} */
  const top = new Array(w * h).fill(null);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (const L of layers) if (L.hit(x, y)) top[y * w + x] = L;
  const solid = (/** @type {number} */ x, /** @type {number} */ y) => x >= 0 && y >= 0 && x < w && y < h && top[y * w + x] != null;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const L = top[y * w + x];
      if (!L) continue;
      putTexel(img, x, y, L.flat ? [...L.flat] : ramp(L.ramp, L.light ? L.light(x, y) : 0.6, x, y));
    }
  }
  const outline = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) outline.push([x, y]);
  for (const [x, y] of outline) putTexel(img, x, y, [...OUTLINE]);
  const palette = paletteOf(...new Set(layers.map((L) => L.ramp)), [OUTLINE], ...layers.filter((L) => L.flat).map((L) => [L.flat]));
  quantize(img, palette);
  // quantize forces every texel's colour, the clear ones' too - their alpha it leaves at 0, so clear them whole again
  const lined = new Set(outline.map(([x, y]) => y * w + x));
  for (let i = 0; i < w * h; i++) if (!top[i] && !lined.has(i)) img.colors.fill(0, i * 4, i * 4 + 4);
  return img;
}

/** THE SOUL CAKE (24 x 18): a domed spiced cake, its side a band darker, a cross of white icing over its top, spice
 *  flecked through it. */
export function soulCakeArt() {
  const top = ellipse(12, 7.5, 10.5, 5.2), side = and(rect(1.5, 7, 22.5, 14), not(top)), base = ellipse(12, 13.5, 10.5, 3.6);
  const cross = and(top, (x, y) => Math.abs(x + 0.5 - 12) < 1.2 || Math.abs(y + 0.5 - 7.5) < 0.8);
  const fleck = and(top, (x, y) => !cross(x, y) && ((x * 7 + y * 13) % 17 === 0));
  return paintLayers(24, 18, [
    { hit: (x, y) => side(x, y) || base(x, y), ramp: CAKE, light: (x) => 0.35 - x / 80 },
    { hit: top, ramp: CAKE, light: litOver(2, 2, 20, 11, 1.1) },
    { hit: cross, ramp: ICING, light: litOver(2, 2, 20, 11) },
    { hit: fleck, ramp: SPICE },
  ]);
}

/** A clay bowl heaped with three Soul Cakes, centred (cx, cy) with radii (rx, ry): each cake's dome, a dark seam
 *  between them, a cross of icing on each, the bowl's lower half and its lit rim - the tests the two offering pictures
 *  share. */
function heaped(/** @type {number} */ cx, /** @type {number} */ cy, /** @type {number} */ rx, /** @type {number} */ ry) {
  const k = rx / 11;
  const domes = [[-5.2, -2.6, 3.8, 3], [0.6, -3.6, 4.2, 3.4], [5.8, -2.2, 3.6, 2.8]].map(([dx, dy, a, b]) => ({ x: cx + dx * k, y: cy + dy * k, rx: a * k, ry: b * k }));
  const inDome = (/** @type {any} */ d, /** @type {number} */ x, /** @type {number} */ y) => ((x + 0.5 - d.x) / d.rx) ** 2 + ((y + 0.5 - d.y) / d.ry) ** 2 <= 1;
  const above = (/** @type {number} */ y) => y < cy;
  const cakes = (/** @type {number} */ x, /** @type {number} */ y) => above(y) && domes.some((d) => inDome(d, x, y));
  // a seam: a texel of one cake that touches another's
  const gaps = (/** @type {number} */ x, /** @type {number} */ y) => above(y) && domes.filter((d) => inDome(d, x, y) || inDome(d, x - 1, y) || inDome(d, x + 1, y)).length > 1;
  const crosses = (/** @type {number} */ x, /** @type {number} */ y) => above(y) && domes.some((d) => inDome(d, x, y) && ((Math.abs(x + 0.5 - d.x) < 0.6 && Math.abs(y + 0.5 - d.y) < d.ry * 0.6) || (Math.abs(y + 0.5 - d.y) < 0.6 && Math.abs(x + 0.5 - d.x) < d.rx * 0.55)));
  const bowl = and(ellipse(cx, cy, rx, ry), rect(0, cy - 0.5, 999, 999));
  const rim = and(ellipse(cx, cy - 0.5, rx, 2.2 * k), not(ellipse(cx, cy - 0.8, rx - 1.8 * k, 1.4 * k)));
  return { cakes, crosses, gaps, bowl, rim };
}

/** THE HEARTH OFFERING'S ITEM PICTURE (28 x 24): a clay bowl heaped with three cakes, a tallow candle lit at its rim. */
export function offeringIconArt() {
  const { cakes, crosses, gaps, bowl, rim } = heaped(13, 15, 11, 7);
  const candle = rect(23, 6, 26, 15), wick = rect(24, 4, 25, 6), flame = ellipse(24.5, 3, 1.8, 2.8);
  return paintLayers(28, 24, [
    { hit: candle, ramp: TALLOW, light: (x) => 1 - (x - 23) / 3 },
    { hit: wick, ramp: SPICE },
    { hit: flame, ramp: FLAME, light: (x, y) => 1 - y / 6 },
    { hit: bowl, ramp: CLAY, light: litOver(2, 14, 22, 9, 1.2) },
    { hit: cakes, ramp: CAKE, light: litOver(4, 7, 20, 9) },
    { hit: gaps, ramp: CAKE, light: () => 0 },
    { hit: crosses, ramp: ICING, light: () => 0.8 },
    { hit: rim, ramp: CLAY, light: () => 0.95 },
  ]);
}

/** THE HEARTH OFFERING AS IT STANDS AT A DOOR (40 x 56): a three-legged stool, on it the clay bowl of cakes, and behind
 *  it a tallow lantern hung from a crook - its candle lit behind iron bars. */
export function offeringArt() {
  const seat = rect(8, 34, 32, 37), legs = (/** @type {number} */ x, /** @type {number} */ y) => y >= 37 && y < 56 && (Math.abs(x - 10 - (y - 37) * -0.15) < 1.4 || Math.abs(x - 20) < 1.2 || Math.abs(x - 30 - (y - 37) * 0.15) < 1.4);
  const { cakes, crosses, gaps, bowl, rim } = heaped(20, 30, 11, 6);
  const pole = rect(33, 4, 35, 56), crook = rect(26, 4, 35, 6), chain = rect(27, 6, 28, 9);
  const cage = and(rect(23, 9, 32, 21), (x, y) => y === 9 || y === 20 || x === 23 || x === 31 || x === 27);
  const glow = rect(24, 10, 31, 20), candle = rect(26, 14, 29, 20), flame = ellipse(27.5, 12.3, 1.6, 2.4);
  return paintLayers(40, 56, [
    { hit: pole, ramp: WOOD, light: (x) => (x === 33 ? 0.8 : 0.3) },
    { hit: (x, y) => crook(x, y) || chain(x, y), ramp: IRON, light: () => 0.6 },
    { hit: glow, ramp: FLAME, light: (x, y) => 0.55 - Math.hypot(x - 27.5, y - 15) / 14 },
    { hit: candle, ramp: TALLOW, light: (x) => 1 - (x - 26) / 3 },
    { hit: flame, ramp: FLAME, light: (x, y) => 1 - (y - 9) / 6 },
    { hit: cage, ramp: IRON, light: litOver(23, 9, 9, 12) },
    { hit: (x, y) => seat(x, y) || legs(x, y), ramp: WOOD, light: litOver(8, 34, 24, 22) },
    { hit: bowl, ramp: CLAY, light: litOver(9, 29, 22, 7, 1.2) },
    { hit: cakes, ramp: CAKE, light: litOver(10, 22, 20, 9) },
    { hit: gaps, ramp: CAKE, light: () => 0 },
    { hit: crosses, ramp: ICING, light: () => 0.8 },
    { hit: rim, ramp: CLAY, light: () => 0.95 },
  ]);
}

/** A TURNIP LANTERN (24 x 26) - the Bay's own, before any pumpkin crossed the sea: a pale turnip hollowed and carved, a
 *  face of tallow light, its leaves still on. */
export function turnipArt() {
  const bulb = ellipse(12, 15.5, 10, 9.5), root = and(ellipse(12, 24.5, 2.2, 2.4), rect(0, 23, 24, 26));
  const leaves = (/** @type {number} */ x, /** @type {number} */ y) => y < 8 && (Math.abs(x + 0.5 - (12 - (8 - y) * 0.7)) < 1.1 || Math.abs(x + 0.5 - 12) < 1 || Math.abs(x + 0.5 - (12 + (8 - y) * 0.8)) < 1.1);
  const eyes = (/** @type {number} */ x, /** @type {number} */ y) => (y >= 11 && y < 14 && ((x >= 6 && x < 10 && y - 11 <= x - 6) || (x >= 14 && x < 18 && y - 11 <= 17 - x)));
  const mouth = (/** @type {number} */ x, /** @type {number} */ y) => y >= 17 && y < 21 && x >= 6 && x < 18 && (y < 19 || (x % 3 !== 0)) && Math.abs(x + 0.5 - 12) < 6.5 - (y - 17) * 0.8;
  return paintLayers(24, 26, [
    { hit: leaves, ramp: LEAF, light: (x) => 0.7 - x / 40 },
    { hit: (x, y) => bulb(x, y) || root(x, y), ramp: TURNIP, light: litOver(2, 6, 20, 19, 1.1) },
    { hit: (x, y) => eyes(x, y) || mouth(x, y), ramp: FLAME, light: (x, y) => 0.95 - Math.abs(x - 12) / 22 - (y - 11) / 40 },
  ]);
}

/** A STRAW EFFIGY (32 x 64) - the wicker man the covens' fires are lit under: a cross of poles, a body of bound straw
 *  belted with cord, arms of straw, a round straw head under a dark hood. */
export function effigyArt() {
  const pole = rect(15, 8, 17, 64), arms = (/** @type {number} */ x, /** @type {number} */ y) => y >= 18 && y < 23 && x >= 2 && x < 30;
  const body = (/** @type {number} */ x, /** @type {number} */ y) => y >= 17 && y < 46 && Math.abs(x + 0.5 - 16) < 4.5 + (y - 17) * 0.12;
  const skirt = (/** @type {number} */ x, /** @type {number} */ y) => y >= 40 && y < 50 && Math.abs(x + 0.5 - 16) < 6 + (y - 40) * 0.25 && (y < 48 || x % 2 === 0);
  const head = ellipse(16, 11, 5.2, 5.6), hood = and(ellipse(16, 10, 6.4, 6.4), (x, y) => y < 10 || Math.abs(x + 0.5 - 16) > 3.6);
  const belt = (/** @type {number} */ x, /** @type {number} */ y) => (y === 33 || y === 34) && body(x, y);
  const strands = (/** @type {number} */ x, /** @type {number} */ y) => (x * 5 + y * 3) % 7 === 0;
  return paintLayers(32, 64, [
    { hit: pole, ramp: WOOD, light: (x) => (x === 15 ? 0.8 : 0.3) },
    { hit: (x, y) => arms(x, y) || body(x, y) || skirt(x, y), ramp: STRAW, light: (x, y) => litOver(2, 17, 28, 33)(x, y) - (strands(x, y) ? 0.3 : 0) },
    { hit: belt, ramp: CLOTH, light: () => 0.5 },
    { hit: head, ramp: STRAW, light: litOver(11, 5, 10, 11) },
    { hit: hood, ramp: CLOTH, light: litOver(9, 3, 14, 14) },
    // two stitched eyes and a stitched mouth, in the hood's dark cord
    { hit: (x, y) => (y === 10 && (x === 13 || x === 18)) || (y === 13 && x >= 14 && x <= 17 && x % 2 === 0), ramp: CLOTH, light: () => 0 },
  ]);
}

/** A WARD-STAFF (24 x 56) - a witch's ward at a door: a staff driven into the ground, a star of bound twigs on its head
 *  and a small skull of bone hung under it, a green witchfire caught in the star's heart. */
export function wardStaffArt() {
  const staff = rect(11, 20, 13, 56);
  const twig = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ ax, /** @type {number} */ ay, /** @type {number} */ bx, /** @type {number} */ by) => {
    const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x + 0.5 - (ax + dx * t), y + 0.5 - (ay + dy * t)) < 0.95;
  };
  // a five-pointed star round (12, 9.5), radius 9: its points, every second joined
  const P = Array.from({ length: 5 }, (_, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; return [12 + Math.cos(a) * 9, 9.5 + Math.sin(a) * 9]; });
  const star = (/** @type {number} */ x, /** @type {number} */ y) => P.some((a, i) => { const b = P[(i + 2) % 5]; return twig(x, y, a[0], a[1], b[0], b[1]); });
  const heart = ellipse(12, 10, 2.4, 2.4), skull = ellipse(12, 24.5, 3, 2.6), jaw = rect(10, 26, 14, 28), cord = rect(12, 19, 13, 22);
  return paintLayers(24, 56, [
    { hit: staff, ramp: WOOD, light: (x) => (x === 11 ? 0.8 : 0.3) },
    { hit: star, ramp: WOOD, light: (x, y) => 0.75 - y / 40 },
    { hit: heart, ramp: WITCHFIRE, light: (x, y) => 1 - Math.hypot(x - 12, y - 10) / 3.2 },
    { hit: cord, ramp: CLOTH, light: () => 0.6 },
    { hit: (x, y) => skull(x, y) || jaw(x, y), ramp: BONE, light: litOver(9, 22, 6, 6) },
    { hit: (x, y) => (x === 10 || x === 13) && y === 24, ramp: SPICE },
  ]);
}

/** Every picture, by its record. */
export const FESTIVAL_PAINTERS = Object.freeze({
  [FESTIVAL_ART.cake]: soulCakeArt, [FESTIVAL_ART.offeringIcon]: offeringIconArt, [FESTIVAL_ART.offering]: offeringArt,
  [FESTIVAL_ART.turnip]: turnipArt, [FESTIVAL_ART.effigy]: effigyArt, [FESTIVAL_ART.wardStaff]: wardStaffArt,
});

/**
 * THE PICTURES ON THE TEXTURE DOOR, once: each a stand-in of the festival's archive, built when it is first asked (the
 * Weir Key's law, egKeyArt.js registerWeirKeyArt). `addVendorTextures` is handed in (systems/textureReplacement.js's).
 * Answers how many were registered (0 the second time).
 * @param {(entries: any[]) => number} addVendorTextures
 */
let _registered = false;
export function registerFestivalArt(addVendorTextures) {
  if (_registered || typeof addVendorTextures !== 'function') return 0;
  _registered = true;
  return addVendorTextures(Object.entries(FESTIVAL_PAINTERS).map(([record, paint]) => ({
    archive: FESTIVAL_ARCHIVE, record: Number(record), frame: 0, standIn: true, fileName: `witches-festival-${FESTIVAL_ARCHIVE}_${record}`,
    build: async () => { const img = paint(); return { width: img.width, height: img.height, data: img.colors }; },
  })));
}
/** Test seam: unregistered. */
export function _resetFestivalArt() { _registered = false; }
