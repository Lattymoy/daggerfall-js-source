// OWN-WORK4 (2026-10-31; the owner: "A proper 1 to 1 recreation for everything"): OUR PICTURES FOR THE FOURTEEN
// ITEMS, at the names, sizes and doll places rriIndex.js keeps. The armour and the Hatchet are our variations of
// Daggerfall's matching paper-doll record, read from the player's ARENA2: its shape and light kept, our leather,
// fur, plates, wood and metals laid on. The Short Flail is drawn whole by our painter. No release pixel is read.
import { RAMP, ditherAt, grain, hex, createPainter, stroke, ellipse, poly, minus } from '../../art/ownPainter.js';
import { classicArt } from '../classicArt.js';
import { RRI_SPRITES } from './rriIndex.js';

/** Each picture's base, by `<archive>_<record>`: [TEXTURE archive, record, x, y]. The slot's record whose box is the
 *  picture's (a woman's body at 245 or 247, a man's at 251; the Hatchet the Battle Axe's), and where its top-left
 *  lands: its own doll place less the picture's, moved inside the picture where the record fits. */
export const RRI_ART_BASE = Object.freeze({
  '513_0': [234, 0, -2, 0], '513_1': [234, 1, 0, 1],
  '520_2': [247, 7, 0, 0], '520_6': [251, 7, 0, 0], '520_10': [247, 4, 0, 0], '520_14': [251, 6, 0, 0], '520_16': [247, 4, 0, 0], '520_17': [251, 6, 0, 0],
  '521_2': [247, 16, 0, 0], '521_6': [251, 16, 0, 0], '521_10': [247, 12, 0, 0], '521_14': [251, 12, 0, 0], '521_16': [247, 12, 0, 0], '521_17': [251, 12, 0, 0],
  '522_1': [245, 27, 3, 0], '522_2': [247, 27, 3, 0], '522_5': [251, 31, 0, 0], '522_6': [251, 31, 0, 0],
  '522_9': [251, 27, 0, 0], '522_10': [245, 27, 0, 0], '522_13': [251, 27, 0, 0], '522_14': [251, 27, 0, 0],
  '522_16': [245, 27, 0, 0], '522_17': [251, 27, 0, 0], '522_18': [245, 27, 0, 0], '522_19': [251, 27, 0, 0],
  '523_2': [247, 1, 0, 0], '523_6': [251, 1, 0, 0], '523_10': [247, 1, 1, 1], '523_14': [251, 1, 0, 1], '523_16': [247, 1, 1, 1], '523_17': [251, 1, 0, 1],
  '524_2': [247, 8, 0, 0], '524_6': [251, 8, 0, 0], '524_10': [247, 8, 0, 0], '524_14': [251, 8, 0, 0], '524_16': [247, 8, 0, 0], '524_17': [251, 8, 0, 0],
  '525_2': [247, 21, 0, 0], '525_6': [251, 21, 0, 0], '525_10': [247, 18, 0, 0], '525_14': [251, 18, 0, 0], '525_16': [247, 18, 0, 0], '525_17': [251, 18, 0, 0],
  '526_2': [247, 26, 0, 0], '526_6': [251, 26, 0, 0], '526_10': [247, 23, 0, 0], '526_14': [251, 23, 0, 0], '526_16': [247, 23, 0, 0], '526_17': [251, 22, 0, 0],
});
/** What a light-set record is (rriItems.js lightRecord, helmetRecord): fur-lined, plated or plain leather. */
export const RRI_ART_KIND = Object.freeze({
  light: Object.freeze({ 2: 'fur', 6: 'fur', 10: 'plated', 14: 'plated', 16: 'leather', 17: 'leather' }),
  cap: Object.freeze({ 1: 'fur', 2: 'fur', 5: 'fur', 6: 'fur', 9: 'plated', 10: 'plated', 13: 'plated', 14: 'plated', 16: 'leather', 17: 'leather', 18: 'leather', 19: 'leather' }),
});
/** The Hatchet: the Battle Axe at this size, about the hand that holds it (picture pixels, record 0 left, 1 right). */
export const RRI_HATCHET = Object.freeze({ scale: 0.88, hand: Object.freeze({ 0: Object.freeze([34, 4]), 1: Object.freeze([10, 5]) }) });
/** The Short Flail's hand on the left-hand picture; the right hand's is it turned about the picture's middle. */
export const RRI_FLAIL_HAND = Object.freeze([37.5, 4.5]);

const ramp = (...colours) => Object.freeze(colours.map((colour) => Object.freeze(hex(colour))));
/** Our metals, dark to light, by the dye a name carries; a bare name is Silver (DyeColors.Unchanged). */
export const RRI_METALS = Object.freeze({
  Silver: ramp('#2a2a30', '#4e4e56', '#7a7a84', '#a8a8b2', '#d0d0d8', '#f2f2f6'),
  Iron: RAMP.iron,
  Steel: RAMP.steel,
  Elven: ramp('#1f2a26', '#3a4d45', '#5d7a6c', '#86a595', '#b3cdbf', '#e0f0e6'),
  Dwarven: RAMP.bronze,
  Mithril: ramp('#1a2230', '#2f3e55', '#4d6280', '#7590ad', '#a3bdd4', '#d4e6f4'),
  Adamantium: ramp('#14171a', '#262c30', '#3b4549', '#55625f', '#73827c', '#98a69e'),
  Ebony: ramp('#060608', '#101016', '#1c1c26', '#2c2c3a', '#424256', '#62627c'),
  Orcish: RAMP.green,
  Daedric: RAMP.red,
});

/** The recipe for picture `name`, or null where it is not one of the release's names. */
export function rriArtRecipe(name) {
  const parts = /^(\d{3})_(\d+)-0(?:_(?!Mask)([A-Z][a-z]+))?(_Mask)?$/.exec(name);
  if (!parts || !RRI_SPRITES[name] || (parts[3] && !RRI_METALS[parts[3]])) return null;
  const piece = Number(parts[1]), record = Number(parts[2]), [width, height] = RRI_SPRITES[name];
  const metal = parts[3] ?? 'Silver', seed = piece * 32 + record;
  if (piece === 514) return { name, width, height, kind: 'flail', hand: record, metal, seed };
  const base = RRI_ART_BASE[`${piece}_${record}`];
  if (!base) return null;
  if (piece === 513) return { name, width, height, kind: 'hatchet', base, hand: RRI_HATCHET.hand[record], metal, seed };
  const kind = parts[4] ? 'mask' : (piece === 522 ? RRI_ART_KIND.cap : RRI_ART_KIND.light)[record];
  return kind ? { name, width, height, kind, base, metal, seed } : null;
}

/** Our picture `name`, top-down RGBA. The Short Flail needs nothing; the rest read their base through `art`
 *  (systems/classicArt.js, or a test's) and reject where the player's data has no such record. */
export async function rriOwnPicture(name, art = classicArt()) {
  const recipe = rriArtRecipe(name);
  if (!recipe) throw new Error(`${name}: no recipe of ours`);
  if (recipe.kind === 'flail') return paintRriFlail(recipe);
  const [archive, record] = recipe.base;
  const classic = await art.picture(archive, record, 0);
  if (!classic?.width) throw new Error(`${name}: TEXTURE.${archive} record ${record} is not in the player's data`);
  return paintRriPicture(classic, recipe);
}

const clamp01 = (light) => (light < 0 ? 0 : light > 1 ? 1 : light);
/** A ramp's colour at `light`, ordered-dithered at (x, y) as the painter lays a ramp. */
const tint = (colours, light, x, y) =>
  colours[Math.max(0, Math.min(colours.length - 1, Math.floor(clamp01(light) * (colours.length - 1) + ditherAt(x, y))))];
/** ART_PAL's index 255, a classic helm's hair mask, reads opaque black; index 0 is the clear. */
const isMaskTexel = (rgba, at) => rgba[at + 3] !== 0 && rgba[at] === 0 && rgba[at + 1] === 0 && rgba[at + 2] === 0;

/** `classic` laid with its top-left at (left, top) on a `w` x `height` picture, drawn `scale` times its size about
 *  `pivot`. Pure. */
export function placeRecord(classic, w, height, left, top, scale = 1, pivot = [0, 0]) {
  const data = new Uint8Array(w * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < w; x++) {
      const fromX = Math.floor((x + 0.5 - pivot[0]) / scale + pivot[0] - left);
      const fromY = Math.floor((y + 0.5 - pivot[1]) / scale + pivot[1] - top);
      if (fromX < 0 || fromY < 0 || fromX >= classic.width || fromY >= classic.height) continue;
      const from = (fromY * classic.width + fromX) * 4;
      data.set(classic.data.subarray(from, from + 4), (y * w + x) * 4);
    }
  }
  return { width: w, height, data };
}

/** How far each drawn texel is from the clear or the picture's edge (1 to 3), 0 where clear. */
function rimDepth(w, height, solid) {
  const out = new Uint8Array(w * height);
  const clear = (x, y) => x < 0 || y < 0 || x >= w || y >= height || !solid[y * w + x];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < w; x++) {
      if (clear(x, y)) continue;
      let depth = 3;
      for (let k = 1; k < 3 && depth === 3; k++)
        for (let dy = -k; dy <= k && depth === 3; dy++) for (let dx = -k; dx <= k; dx++) if (clear(x + dx, y + dy)) { depth = k; break; }
      out[y * w + x] = depth;
    }
  }
  return out;
}
/** The texels within `reach` of the clear straight above or below: where a garment opens, at its collar, cuffs and
 *  hem. */
function hemOf(w, height, solid, reach = 2) {
  const out = new Uint8Array(w * height);
  const clear = (x, y) => y < 0 || y >= height || !solid[y * w + x];
  for (let i = 0; i < w * height; i++) {
    if (!solid[i]) continue;
    const x = i % w, y = (i / w) | 0;
    for (let k = 1; k <= reach && !out[i]; k++) if (clear(x, y - k) || clear(x, y + k)) out[i] = 1;
  }
  return out;
}
/** A light map's box blur of radius 2 over the drawn texels: a record's form without its mail or its seams. */
function softLight(w, height, solid, light) {
  const out = new Float32Array(w * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid[y * w + x]) continue;
      let sum = 0, n = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nearX = x + dx, nearY = y + dy;
          if (nearX < 0 || nearY < 0 || nearX >= w || nearY >= height || !solid[nearY * w + nearX]) continue;
          sum += light[nearY * w + nearX];
          n++;
        }
      }
      out[y * w + x] = sum / n;
    }
  }
  return out;
}

const LEATHER = RAMP.leather, LINING = RAMP.brown, THREAD = RAMP.rope, WOOD = RAMP.wood;
/** Our fur, dark to light. */
export const RRI_FUR = ramp('#2e2620', '#4f4236', '#74644f', '#9a8a70', '#bfb095', '#ddd2bb');
/** One texel of the light set: `depth` its rim depth, `hem` whether the garment opens there, `light` the record's. */
function pieceTexel(kind, x, y, depth, hem, light, metal, seed) {
  if (kind === 'leather') {
    if (depth === 1) return tint(LEATHER, light * 0.55, x, y);
    if (depth === 2 && (x + y) % 2 === 0) return tint(THREAD, 0.3 + light * 0.5, x, y); // a stitched seam round the edge
    return tint(LEATHER, 0.1 + light * 0.85, x, y);
  }
  if (kind === 'fur') {
    if (hem) return tint(RRI_FUR, 0.2 + light * 0.6 + (grain(x, y, seed) - 0.5) * 0.45, x, y); // the fur at collar, cuffs and hem
    return tint(LINING, depth === 1 ? light * 0.5 : 0.2 + light * 0.75, x, y);
  }
  // plated: overlapping scales of the metal on leather, staggered, a leather binding at the edge
  if (depth === 1) return tint(LEATHER, light * 0.5, x, y);
  const row = y % 3, column = (x + (Math.floor(y / 3) % 2) * 2) % 4;
  if (row === 2 && (column === 0 || column === 3)) return tint(LEATHER, light * 0.35, x, y);
  if (row === 0) return tint(metal, light * 0.6, x, y); // in the shadow of the row above
  return tint(metal, 0.2 + light * 0.75 + (row === 2 ? 0.1 : 0), x, y);
}

/** Our picture over the classic record `classic` (top-down RGBA, ART_PAL), by `recipe`. Pure. */
export function paintRriPicture(classic, recipe) {
  const { width: w, height, kind, base } = recipe;
  const hatchet = kind === 'hatchet';
  const placed = hatchet
    ? placeRecord(classic, w, height, base[2], base[3], RRI_HATCHET.scale, recipe.hand)
    : placeRecord(classic, w, height, base[2], base[3]);
  const from = placed.data, out = new Uint8Array(w * height * 4);
  if (kind === 'mask') {
    for (let at = 0; at < from.length; at += 4) if (isMaskTexel(from, at)) out.fill(255, at, at + 4);
    return { width: w, height, data: out };
  }
  const solid = new Uint8Array(w * height), light = new Float32Array(w * height);
  let lo = 255, hi = 0;
  for (let i = 0; i < w * height; i++) {
    if (!from[i * 4 + 3] || isMaskTexel(from, i * 4)) continue;
    solid[i] = 1;
    light[i] = 0.299 * from[i * 4] + 0.587 * from[i * 4 + 1] + 0.114 * from[i * 4 + 2];
    lo = Math.min(lo, light[i]);
    hi = Math.max(hi, light[i]);
  }
  const depth = rimDepth(w, height, solid), hem = hemOf(w, height, solid), soft = softLight(w, height, solid, light);
  const metal = RRI_METALS[recipe.metal];
  const share = kind === 'fur' ? 1 : hatchet ? 0 : 0.45; // how much of the light is the record's form alone
  for (let i = 0; i < w * height; i++) {
    if (!solid[i]) continue;
    const x = i % w, y = (i / w) | 0, at = i * 4;
    const shade = (light[i] * (1 - share) + soft[i] * share - lo) / (hi - lo || 1);
    let colour;
    if (hatchet) {
      const top = Math.max(from[at], from[at + 1], from[at + 2]);
      const grey = !top || (top - Math.min(from[at], from[at + 1], from[at + 2])) / top < 0.25;
      if (grey) colour = tint(metal, shade, x, y); // the head and the butt's cap
      else if (Math.hypot(x - recipe.hand[0], y - recipe.hand[1]) < 7)
        colour = (x + y) % 3 === 0 ? LEATHER[1] : tint(LEATHER, 0.2 + shade * 0.6, x, y); // our grip wrap
      else colour = tint(WOOD, 0.1 + shade * 0.85, x, y);
    } else colour = pieceTexel(kind, x, y, depth[i], hem[i], shade, metal, recipe.seed);
    out.set(colour, at);
    out[at + 3] = 255;
  }
  return { width: w, height, data: out };
}

/** The Short Flail, drawn whole: a short haft from the hand, a ring, a chain and a spiked ball hanging below. Pure. */
export function paintRriFlail({ width: w, height, hand, metal: metalName }) {
  const painter = createPainter(w, height), metal = RRI_METALS[metalName];
  const turned = (x) => (hand === 1 ? w - x : x); // the right hand's picture is the left's turned about
  const point = (x, y) => [turned(x), y];
  const [handX, handY] = RRI_FLAIL_HAND, chainX = 15.5, ballY = height - 11;
  painter.fill(stroke([point(handX - 3, handY + 2), point(chainX + 1.5, 16.5)], 1.6), WOOD); // the haft, from past the fist
  painter.fill(stroke([point(handX + 4, handY - 2), point(handX + 7.5, handY - 3.7)], 1.3), WOOD); // its butt beyond the fist
  painter.fill(ellipse(turned(chainX), ballY, 7.8, 7.8), metal, { gain: 1.2 });
  painter.outline({ keep: 0.35 });
  // the spikes, the chain and the fittings after the rim, so a thin part keeps its light
  for (let k = 0; k < 8; k++) {
    const angle = ((k + 0.5) * Math.PI) / 4, alongX = Math.cos(angle), alongY = Math.sin(angle);
    const spike = (out, across) => [turned(chainX + alongX * out - alongY * across), ballY + alongY * out + alongX * across];
    painter.fill(poly([spike(7, -1.7), spike(7, 1.7), spike(10.4, 0)]), metal, { bias: 0.2, under: true });
  }
  for (let y = 21, i = 0; y < ballY - 8; y += 4, i++) {
    if (i % 2) painter.fill(ellipse(turned(chainX), y, 1, 2.4), metal);
    else painter.fill(minus(ellipse(turned(chainX), y, 2.2, 2.7), ellipse(turned(chainX), y, 0.8, 1.2)), metal, { bias: 0.15 });
  }
  painter.fill(ellipse(...point(handX + 8, 1), 1.4, 1.4), metal, { bias: 0.1 });
  painter.fill(ellipse(...point(chainX, 17.5), 2.4, 2), metal, { bias: 0.1 });
  return painter.picture();
}
