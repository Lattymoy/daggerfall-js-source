// @ts-check
// DF-ART (2026-10-14, Mac: "For all textures you implemented that are AI (Ships, wagons, caravans, etc) I want to instead
// use daggerfall textures instead of AI generated"; asked, the real-world things - the ships, the wagons and the caravan,
// the yards, the port, the LeFay monument and the town's hangings - every surface a Daggerfall texture, the painted
// liveries, name boards and signs Daggerfall has no picture of gone): THE PORT'S OWN MODELS WEAR DAGGERFALL'S TEXTURES.
//
// Each of those models still names its pictures under its own pseudo-archive and records (world/galleonArt.js TEX and
// the rest), so no mesh changes; what fills a record is no longer painted here from noise but READ from the player's own
// ARENA2 - the classic record this table names - at the load, as every other model's texture is. Nothing of
// Daggerfall's ships (Port-Doctrine: a render of game data is game data): the table names records, and the pixels are
// the player's. The ships' records are Come Sail Away's own choices for its hulls (vendor/come-sail-away/Models/
// prefabs.json - the planking every one of its hulls wears, its sails' cloth, its masts', its rope ladders', its doors',
// its iron), so the port's galleon sails beside the mod's in one hand; the rest are the nearest record Daggerfall has.
//
// A picture is built from its record whole (formats/derivedTexture.js buildDerivedPicture) and made OPAQUE: these are a
// model's faces, and the handful of index-0 texels a classic wall carries would read as holes in a hull.
//
// WAGON-TIMBER (2026-10-16, Mac, of the wagon's wood: "Ok so there is a separation of all the wooden parts which is cool.
// Lets make a selector for each of them and send them over the wire using the same system that already exists"): a
// record may also be DYE'D - `{ dyed: { from, dye } }`, read and put through the horse dye's own arithmetic
// (`dyeEveryTexel`, systems/horseCoats.js - hue, saturation and value, never a flat fill) as it is read here. It is a
// source kind, not a step, so every reader below takes it without knowing: the pool, the caravan's room and the item's
// icon all build through this file and none of them changed. NOT WRITTEN TO DISK - a dyed picture exists only as long
// as the upload that asked for it (Port-Doctrine: a render of game data is game data).

import { buildDerivedPicture } from '../formats/derivedTexture.js';
import { dyeEveryTexel } from '../systems/horseCoats.js';   // WAGON-TIMBER: one dye's arithmetic, shared with the horse's coat

/** The Daggerfall records the port's models wear, by material: `[TEXTURE archive, record]`. */
export const DF = Object.freeze({
  // ── wood ── (Come Sail Away's hulls: vendor/come-sail-away/Models/prefabs.json)
  hullPlanks: Object.freeze([50, 6]),    // CSA: the Galleon's, the Trireme's and the Carrack's planking, laid along
  deck: Object.freeze([50, 0]),          // CSA: the same three's decks
  underDeck: Object.freeze([50, 1]),     // CSA: the Galleon's and the Carrack's, and their rudders
  spar: Object.freeze([67, 8]),          // CSA: every mast and boom
  oakPale: Object.freeze([67, 0]),       // CSA: hulls, anchors' stocks, lantern planks
  oak: Object.freeze([67, 4]),           // CSA: the Galleon, the Trireme's oars
  oakDark: Object.freeze([67, 3]),       // CSA: the Galleon, the Trireme, the Carrack
  board: Object.freeze([67, 5]),         // CSA: the Galleon, the Trireme, the Carrack - and a signboard Daggerfall has no sign for
  weathered: Object.freeze([67, 6]),     // CSA: the Dingy, the Old Skiff, every rudder and oar
  tarred: Object.freeze([67, 7]),        // the darkest of the 067 woods
  beam: Object.freeze([67, 10]),         // CSA: the Galleon's and the Carrack's beams
  panel: Object.freeze([171, 3]),        // CSA: the Galleon, the Trireme, the Carrack - upright boards
  hatch: Object.freeze([171, 0]),        // CSA: the same three - a boarded hatch
  barnPlanks: Object.freeze([54, 0]),    // a building's weathered planking, laid along
  shingles: Object.freeze([54, 31]),     // a roof's wooden shingles
  slate: Object.freeze([54, 30]),        // a roof's slates
  endGrain: Object.freeze([86, 0]),      // a sawn log's end
  bark: Object.freeze([166, 3]),         // grain along a trunk
  wheel: Object.freeze([87, 7]),         // a spoked wagon wheel
  door: Object.freeze([74, 0]),          // CSA: every ship's door
  grating: Object.freeze([66, 4]),       // slatted wood, laid on the bias
  // ── cloth, rope, straw ──
  sailcloth: Object.freeze([50, 7]),     // CSA: every sail
  rope: Object.freeze([85, 5]),          // CSA: the rope ladders and the hammocks
  straw: Object.freeze([169, 0]),        // thatch's straw - a bale's, and a joiner's curled shavings
  // ── tapestries and woven cloth (the town's hangings and rugs - world/townPictures.js) ── TEXTURE.057's eight
  // hangings, TEXTURE.049's woven patterns, TEXTURE.371's rug
  tapestryDragon: Object.freeze([57, 0]),
  tapestryMoon: Object.freeze([57, 1]),
  tapestryFlowers: Object.freeze([57, 2]),
  tapestryOrbs: Object.freeze([57, 3]),
  tapestryLion: Object.freeze([57, 4]),
  tapestryRaven: Object.freeze([57, 5]),
  tapestryLamps: Object.freeze([57, 6]),
  tapestryFire: Object.freeze([57, 7]),
  wovenBrown: Object.freeze([49, 0]),
  wovenTan: Object.freeze([49, 1]),
  wovenGreen: Object.freeze([49, 2]),
  wovenMoss: Object.freeze([49, 3]),
  wovenBlue: Object.freeze([49, 4]),
  wovenGold: Object.freeze([49, 5]),
  wovenRed: Object.freeze([49, 6]),
  wovenForest: Object.freeze([49, 7]),
  wovenChequer: Object.freeze([49, 8]),
  rug: Object.freeze([371, 0]),          // a woven rug
  // ── metal ──
  iron: Object.freeze([0, 111]),         // CSA: anchors and boarding planks' iron
  ironGrey: Object.freeze([0, 86]),      // CSA: anchors and lantern hooks
  gold: Object.freeze([449, 0]),         // gilding, worked in a pattern
  giltPlain: Object.freeze([0, 18]),     // plain gold - burnished gilt, a brass bell
  leather: Object.freeze([0, 75]),       // CSA: the Galleon's and the Carrack's brown
  tar: Object.freeze([1, 88]),           // CSA: the boarding planks' black
  // ── stone and ground ──
  stoneBlocks: Object.freeze([324, 0]),  // coursed grey stone
  whitewash: Object.freeze([41, 2]),     // pale lime
  cobbles: Object.freeze([85, 1]),       // a street's cobbles
  marble: Object.freeze([341, 1]),       // pale veined marble
  granite: Object.freeze([341, 3]),      // dark speckled stone
  dirt: Object.freeze([302, 1]),         // bare earth
  sand: Object.freeze([302, 54]),        // sandy earth
  grass: Object.freeze([302, 2]),        // green growth
  gravel: Object.freeze([302, 3]),       // grey stones
  water: Object.freeze([302, 0]),        // open water
  // ── paint and dyed cloth (a wagon's looks - systems/wagonLooks.js) ── Daggerfall's flat colour swatches (TEXTURE.000
  // and .001, which Come Sail Away paints with too) and its woven fabrics (TEXTURE.049)
  paintRed: Object.freeze([1, 117]),
  paintOxblood: Object.freeze([1, 120]),
  paintGreen: Object.freeze([1, 44]),
  paintBlue: Object.freeze([0, 105]),
  paintBlack: Object.freeze([1, 92]),
  paintWhite: Object.freeze([0, 113]),
  paintOchre: Object.freeze([0, 24]),
  clothRed: Object.freeze([49, 6]),
  clothBlue: Object.freeze([49, 4]),
  clothGreen: Object.freeze([49, 2]),
  clothOchre: Object.freeze([49, 5]),
  checker: Object.freeze([152, 1]),      // chequered tiles
  nightSky: Object.freeze([355, 0]),     // a starred night
  // ── glass, light, signs ──
  window: Object.freeze([54, 43]),       // a timber-framed window, leaded panes over plaster - its panes alone read as glass (isGlass)
  lampGlass: Object.freeze([0, 1]),      // pale warm yellow - a lantern's lit pane
  fireFlat: Object.freeze([210, 0]),     // a brazier's fire (a flat: its flames on nothing, the bowl under them)
  embers: Object.freeze([356, 2]),       // banked fire
  notices: Object.freeze([86, 2]),       // a parchment notice
  toolsSign: Object.freeze([333, 18]),   // a shop's sign: an axe and a sword
});

/** DF-ART (Mac: "windows should always be see through"): Daggerfall's leaded window as a model's window - its frame
 *  and its left half to the mullion (columns 0-37, rows 0-57: the plaster under it left off), made whole by its mirror,
 *  its glass cut out between its leads, uploaded a cut-out, so whatever stands behind it is seen through it: the
 *  caravan's (world/wagonArt.js, laid into its walls), the galleon's stern gallery, the carrack's transom. */
export const SEE_THROUGH_WINDOW = Object.freeze({ from: DF.window, crop: Object.freeze([0, 0, 37, 57]), mirror: true, glass: true });
/** The same window LIT (Mac, of the ships: "See-through by day, lit at night"): framed whole as SEE_THROUGH_WINDOW is, its
 *  glass whole - worn at night in its place, its panes glowing (`paneGlow`, the stand-ins' `glowRecs`). */
export const LIT_WINDOW = Object.freeze({ from: DF.window, crop: Object.freeze([0, 0, 37, 57]), mirror: true });

/** A picture made opaque - a model's face, never a cutout. Returns a new picture. */
export const opaque = (/** @type {{width:number,height:number,data:Uint8Array}} */ pic) => {
  const data = pic.data.slice();
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { width: pic.width, height: pic.height, data };
};

/** Whether a texel of a classic window is its pane - its glass or its leading: Daggerfall's panes are cool greys and
 *  blues, its frames and walls warm - a texel no redder than it is blue, and not black. */
export const isPane = (r, g, b) => b >= r && r + g + b > 60;
/** The warm light lit glass gives off at night (the ships' backlit windows - the painted panes' glow, kept). */
export const PANE_GLOW = Object.freeze([255, 186, 96]);

// ── COMPOSED pictures: a face that holds a window or a door where the model's own stands (the caravan's sides and
// ends - world/wagonArt.js) is one Daggerfall record laid whole and another laid over it, nothing painted ──

/** The size a composed picture is laid out at: its layout is in a 64-texel picture's texels (the painted art's - so a
 *  window still stands where the model's room meets it), four texels to each, so an inset keeps its leading. */
export const COMPOSE = 256;
const LAYOUT = 64;
/** A picture resampled to `w` x `h`, nearest texel - a record laid whole on a face of another shape. */
export function resample(/** @type {{width:number,height:number,data:Uint8Array}} */ src, w, h) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(src.height - 1, Math.floor((y * src.height) / h));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x * src.width) / w)), s = (sy * src.width + sx) * 4, d = (y * w + x) * 4;
      data[d] = src.data[s]; data[d + 1] = src.data[s + 1]; data[d + 2] = src.data[s + 2]; data[d + 3] = src.data[s + 3];
    }
  }
  return { width: w, height: h, data };
}
/** Columns x0-x1 and rows y0-y1 (inclusive) of a picture, as their own - held inside the picture (a player's record
 *  smaller than the one the numbers were read off gives what it has). */
export function crop(/** @type {{width:number,height:number,data:Uint8Array}} */ src, /** @type {readonly number[]} */ box) {
  const x0 = Math.min(box[0], src.width - 1), y0 = Math.min(box[1], src.height - 1), x1 = Math.min(box[2], src.width - 1), y1 = Math.min(box[3], src.height - 1);
  const w = x1 - x0 + 1, h = y1 - y0 + 1, data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) data.set(src.data.subarray(((y0 + y) * src.width + x0) * 4, ((y0 + y) * src.width + x1 + 1) * 4), y * w * 4);
  return { width: w, height: h, data };
}
/** A picture beside its own mirror image (twice as wide): half a window, its post and its mullion, made whole. */
export function mirrored(/** @type {{width:number,height:number,data:Uint8Array}} */ src) {
  const w = src.width * 2, data = new Uint8Array(w * src.height * 4);
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const s = (y * src.width + x) * 4;
    for (const tx of [x, w - 1 - x]) { const d = (y * w + tx) * 4; data[d] = src.data[s]; data[d + 1] = src.data[s + 1]; data[d + 2] = src.data[s + 2]; data[d + 3] = src.data[s + 3]; }
  }
  return { width: w, height: src.height, data };
}
/** How light a window's leading is: a pane texel this light or lighter (r + g + b) is its lead, kept; a darker one its
 *  glass (54_43's panes are 166, its leads 322). */
export const LEAD_LIGHT = 200;
/** Whether a texel of a classic window is glass to be seen through: a pane, darker than its leading. */
export const isGlass = (r, g, b) => isPane(r, g, b) && r + g + b < LEAD_LIGHT;
/** A LIT window's night glow (renderer.uploadEmissionTexture): its glass PANE_GLOW (`isGlass` - the leads stand dark
 *  against it, as a lit leaded window's do), everything else black, every texel whole. */
export function paneGlow(/** @type {{width:number,height:number,data:Uint8Array}} */ pic) {
  const data = new Uint8Array(pic.data.length);
  for (let i = 0; i < data.length; i += 4) {
    if (isGlass(pic.data[i], pic.data[i + 1], pic.data[i + 2])) { data[i] = PANE_GLOW[0]; data[i + 1] = PANE_GLOW[1]; data[i + 2] = PANE_GLOW[2]; }
    data[i + 3] = 255;
  }
  return { width: pic.width, height: pic.height, data };
}
/** A window picture with its glass a hole (alpha 0 - uploaded as a cut-out, the eye sees through it). Returns a new one. */
export function cutGlass(/** @type {{width:number,height:number,data:Uint8Array}} */ pic) {
  const data = pic.data.slice();
  for (let i = 0; i < data.length; i += 4) if (isGlass(data[i], data[i + 1], data[i + 2])) data[i + 3] = 0;
  return { width: pic.width, height: pic.height, data };
}

/**
 * A DYE'D RECORD (WAGON-TIMBER): one Daggerfall record (`from`) read and made whole, then EVERY texel of it put through
 * a dye (world/wagonArt.js WOOD_DYES - the arithmetic systems/horseCoats.js COAT_DYES already owns, `dyeEveryTexel`).
 * It is its own arm rather than a `composedPicture` because the picture must keep the base record's OWN SIZE: a composed
 * picture is laid out at COMPOSE, so a 64-texel deck resampled to 256 would come back with four times the texels of
 * the built record standing on the same metre of floor - a resolution change between choice 0 and choice 1, which is a
 * change of wagon rather than of colour. Read, dyed, same shape. Returns a new picture; the pixels read are untouched.
 * @param {{ from: readonly number[], dye: { hue: number | null, sat: readonly [string, number], val: readonly [number, number] } }} spec
 * @param {(archive: number, record: number, frame?: number) => Promise<any>} classicRgba
 */
export async function dyedPicture(spec, classicRgba) {
  const base = opaque(await buildDerivedPicture({ from: [spec.from[0], spec.from[1]] }, classicRgba));
  if (!base?.width) throw new Error(`classic art: ${spec.from[0]}_${spec.from[1]} is not in the player's data`);
  return { width: base.width, height: base.height, data: /** @type {Uint8Array} */ (dyeEveryTexel(base.data, base.data.slice(), spec.dye)) };
}

/**
 * A PICTURE BESIDE ITS OWN COPIES - `src` laid `n` times across, as wide again: the one cell of a livery a face
 * walks over four times without the face's own u repeating (WAGON-EMBLEM, world/wagonArt.js's open wagon's side).
 * NEAREST, no seam and no blend: the copies are the same bytes, so the cloth a repeated cell wears is the cloth it
 * wore when the texture itself repeated - which is the whole of the point, and the reason this is here rather than a
 * stretched body.
 * @param {{width:number,height:number,data:Uint8Array}} src @param {number} n
 */
export function repeated(/** @type {{width:number,height:number,data:Uint8Array}} */ src, n) {
  const w = src.width * n, data = new Uint8Array(w * src.height * 4);
  for (let y = 0; y < src.height; y++)
    for (let k = 0; k < n; k++) data.set(src.data.subarray(y * src.width * 4, (y + 1) * src.width * 4), (y * w + k * src.width) * 4);
  return { width: w, height: src.height, data };
}

/** A picture repeated at its own texel size over `w` x `h` - a tiling record laid on a face bigger than itself. */
export function tiled(/** @type {{width:number,height:number,data:Uint8Array}} */ src, w, h) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = (((y % src.height) * src.width) + (x % src.width)) * 4, d = (y * w + x) * 4;
    data[d] = src.data[s]; data[d + 1] = src.data[s + 1]; data[d + 2] = src.data[s + 2]; data[d + 3] = src.data[s + 3];
  }
  return { width: w, height: h, data };
}

/**
 * A COMPOSED picture: `body` (a Daggerfall record) laid whole over `size` (COMPOSE x COMPOSE unless given) - or
 * repeated at its own texel size (`tile`) - then `repeat` COPIES of it side by side across (WAGON-EMBLEM: the open
 * wagon's side wears one cell of cloth four times inside its own picture, so the emblem on one of the cells is the
 * only one on the wagon; the layout stays a cell's, `kx`, so an inset still lands where the 64-texel picture put it)
 * - then each inset laid over it: a Daggerfall record, `crop`ped, `mirror`ed whole, its `glass` cut out, laid over the
 * layout's columns and rows `at` ({x0, y0, x1, y1}, inclusive, in a 64-texel picture's texels) or over the picture's
 * own texels `px`; a `clear` inset keeps its clear texels clear and lays the rest over the body (a flat's subject on a
 * board). Last, `paint` (the WHOLE picture, top-down, all of it across) - a sign's word lettered on
 * (world/merchantYardArt.js), a wagon's guild arms (world/wagonEmblem.js).
 * @param {{ body: readonly number[], size?: readonly number[], tile?: boolean, repeat?: number, paint?: (pic: {width:number,height:number,data:Uint8Array}) => void,
 *   insets?: ReadonlyArray<{ from: readonly number[], at?: {x0:number,y0:number,x1:number,y1:number}, px?: {x0:number,y0:number,x1:number,y1:number}, crop?: readonly number[], mirror?: boolean, glass?: boolean, clear?: boolean }> }} spec
 * @param {(archive: number, record: number, frame?: number) => Promise<any>} classicRgba
 */
export async function composedPicture(spec, classicRgba) {
  const read = async (/** @type {readonly number[]} */ from, clear = false) => {
    const src = await classicRgba(from[0], from[1], 0);
    if (!src?.width) throw new Error(`classic art: ${from[0]}_${from[1]} is not in the player's data`);
    return clear ? src : opaque(src);
  };
  const [W, H] = spec.size ?? [COMPOSE, COMPOSE], body = await read(spec.body);
  const N = Math.max(1, Math.floor(spec.repeat ?? 1)), RW = W * N;
  const pic = spec.tile ? tiled(body, RW, H) : repeated(resample(body, W, H), N), kx = W / LAYOUT, ky = H / LAYOUT;
  for (const ins of spec.insets ?? []) {
    let src = await read(ins.from, !!ins.clear);
    if (ins.crop) src = crop(src, ins.crop);
    if (ins.mirror) src = mirrored(src);
    if (ins.glass) src = cutGlass(src);
    const r = ins.px ?? { x0: ins.at.x0 * kx, y0: ins.at.y0 * ky, x1: (ins.at.x1 + 1) * kx - 1, y1: (ins.at.y1 + 1) * ky - 1 };
    const x0 = r.x0, y0 = r.y0, w = r.x1 + 1 - x0, h = r.y1 + 1 - y0;
    const laid = resample(src, w, h);
    if (!ins.clear) { for (let y = 0; y < h; y++) pic.data.set(laid.data.subarray(y * w * 4, (y + 1) * w * 4), ((y0 + y) * RW + x0) * 4); continue; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      if (laid.data[s + 3] >= 128) pic.data.set(laid.data.subarray(s, s + 3), ((y0 + y) * RW + x0 + x) * 4);
    }
  }
  spec.paint?.(pic);
  return pic;
}

/**
 * A CUT picture: one Daggerfall record (`from`), `crop`ped and `mirror`ed whole - opaque, or with its clear texels
 * kept clear (`clear`: a cut-out, a flat's flames on nothing), or with its window's `glass` cut out (a window seen
 * through - Mac: "windows should always be see through").
 * @param {{ from: readonly number[], crop?: readonly number[], mirror?: boolean, clear?: boolean, glass?: boolean }} spec
 * @param {(archive: number, record: number, frame?: number) => Promise<any>} classicRgba
 */
export async function cutPicture(spec, classicRgba) {
  let pic = await buildDerivedPicture({ from: [spec.from[0], spec.from[1]] }, classicRgba);
  if (spec.crop) pic = crop(pic, spec.crop);
  if (spec.mirror) pic = mirrored(pic);
  if (spec.clear) return pic;
  return spec.glass ? cutGlass(opaque(pic)) : opaque(pic);
}

/** Whether a source's picture holds glass to see through (a cut window, or a wall with one laid in) - uploaded as a
 *  cut-out, so the eye sees through it. */
export const hasGlass = (/** @type {any} */ from) => !!from && !Array.isArray(from) && !!(from.glass || from.insets?.some((/** @type {any} */ i) => i.glass));

/** One record's picture from its Daggerfall source - a record (`[archive, record]`), opaque; a composed spec
 *  (`{ body, insets }` - composedPicture); or a cut one (`{ from, ... }` - cutPicture). `classicRgba` is the pipeline's
 *  reader (systems/textureReplacement.js's `ctx.classicRgba`, or `classicRgbaOf` for a host that uploads its own).
 *  DF-ART IV: or the port's own picture Mac asked back (`{ painted }` - world/wagonWheelArt.js's wheels), its `painted()`
 *  the picture in these readers' shape, read from no data; WAGON-TIMBER: or one record DYE'D whole (`{ dyed }` -
 *  `dyedPicture` - the wagon's wood put through the horse dye's own arithmetic as it is read). */
export async function classicPicture(/** @type {any} */ from, /** @type {any} */ classicRgba) {
  if (Array.isArray(from)) return opaque(await buildDerivedPicture({ from: [from[0], from[1]] }, classicRgba));
  if (from?.dyed) return dyedPicture(from.dyed, classicRgba);
  if (typeof from?.painted === 'function') return from.painted();
  return from.body ? composedPicture(from, classicRgba) : cutPicture(from, classicRgba);
}

/** A picture in the rows the port's own art is uploaded in (world/merchantYardArt.js, world/portArt.js,
 *  world/lefayArt.js: `{ width, height, colors }`, row 0 its TOP - their models' uvs lay it so). */
export const asPortRows = (/** @type {{width:number,height:number,data:Uint8Array}} */ pic) => ({ width: pic.width, height: pic.height, colors: pic.data });

/**
 * A model's pictures as STAND-INS on the texture door (systems/textureReplacement.js addVendorTextures): each record of
 * `archive` built from the Daggerfall record `sources` names for it, the first time the archive is asked for; `cut`
 * answers whether a record holds glass to see through (hasGlass - its host uploads it a cut-out); a record in `glowRecs`
 * (a LIT window) keeps its night glow (`glow(record)`, cut as it is built - null until then). A loose pack's
 * `<archive>_<record>-0.png` still overrides a record, as it overrides any.
 * @param {{ archive: number, name: string, sources: Readonly<Record<number, any>>, glowRecs?: readonly number[] }} o
 */
export function classicStandIns({ archive, name, sources, glowRecs = [] }) {
  const glows = new Map();
  const entries = Object.entries(sources).map(([rec, from]) => {
    const record = Number(rec);
    return {
      archive, record, frame: 0, standIn: true, fileName: `${name}-${archive}_${rec}`,
      build: async (/** @type {any} */ ctx) => {
        const pic = await classicPicture(from, ctx.classicRgba);
        if (glowRecs.includes(record)) glows.set(record, paneGlow(pic));
        return pic;
      },
    };
  });
  return {
    entries, cut: (/** @type {number} */ record) => hasGlass(sources[record]),
    glow: (/** @type {number} */ record) => glows.get(record) ?? null, reset: () => glows.clear(),
  };
}

/**
 * The pictures for a host that uploads them itself: `[record, picture]` for every record `sources` names, each read
 * from the player's ARENA2 through `classicRgba` - a record the data lacks is left out (its faces draw untextured, as a
 * classic model's would), never a thrown scene.
 * @param {Readonly<Record<number, any>>} sources
 * @param {(archive: number, record: number, frame?: number) => Promise<any>} classicRgba
 * @returns {Promise<Array<[number, {width:number,height:number,data:Uint8Array}]>>}
 */
export async function classicPictures(sources, classicRgba) {
  const out = [];
  for (const [rec, from] of Object.entries(sources)) {
    try { out.push(/** @type {[number, any]} */ ([Number(rec), await classicPicture(from, classicRgba)])); } catch { /* not in the player's data */ }
  }
  return out;
}
