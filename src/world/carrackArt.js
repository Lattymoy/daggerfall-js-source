// @ts-check
// SHIPS-2 (2026-10-07, Mac: "implement both of these new ship placement models, UV Map/Texture, and ensure it matches the
// love we gave the other new ship model we implemented"): THE NEW CARRACK'S OWN ART, MADE AT THE LOAD.
//
// Mac's export names the galleon's two pictures (Wood.png and floorboards.png) and carries neither, so she is painted
// here as the galleon is (world/galleonArt.js's law and its tools): pixels and numbers, no renderer and no GL, an atlas
// of the port's own under a pseudo-archive of hers (CARRACK_ARCHIVE), deterministic on fixed seeds so every client's
// carrack is the same ship, every picture 64 x 64 (GALLEON-2's size).
//
// WHAT EVERY SHIP OF THE PORT'S WEARS IS THE GALLEON'S PICTURE: her deck's pine, her ceiling planks, her trim, spars,
// iron, canvas, rope, gilt, gratings, the door, the beams' and her deck's underside, each under the galleon's own record
// number (`TEX`, pinned to world/galleonArt.js TEX's), painted by the galleon's own painter - so the parts every ship
// builds alike (a door, a gun, a wheel, a yard, a rope - world/galleonModel.js and world/galleonRig.js) wear the same
// numbers in her archive as in the galleon's.
//
// HER LIVERY IS A CARRACK'S OF THE BAY, NOT THE GALLEON'S, read on her heights (the boat's frame, metres over the sea -
// tools/bakeCarrack.mjs FRAME): the tarred and weeded bottom, a white-lead boot-top at the waterline, a black main wale,
// the gunport strake in Bay blue between ochre pin-stripes (her ports' sills 3.07, their heads 4.06), a black upper
// wale, oiled oak topsides with a blue line, and her bulwark's head painted black with an ochre bead - where her sheer
// rises to her bow (9.75, her waist's rail 8.63) that is a black-painted bow. Her transom carries the strake's blue up
// to a gallery of three leaded windows over her gun deck's after end, an ochre name board and a black cap; her three
// deckhouses are oiled clapboard on a tarred sill under a blue fascia, roofed in tarred plank; her quarter rail is blue
// panels framed in ochre under a black cap. Each livery is painted keel to rail (or sill to eaves) and CUT into 64-row
// slices by height (`BANDS`) - world/carrackModel.js cuts every face it lies on at the slices' heights (the galleon's
// R14 law, world/galleonModel.js bakedPartGeometry), so a band runs round her whatever face it falls on.
//
// Each picture is `{ width, height, data }`, RGBA top-down (a PNG's order) for textureReplacement.js's vendored-art door.
// Not a DFU member. Ledger A (SHIPS-2).
import {
  C, picture, put, get, mix, noise, planks, band, sliceOf, GALLEON_TEX_SIZE, TEX as GALLEON_TEX, GALLEON_TILE,
  hullBottomArt, hullInnerArt, deckArt, trimArt, sparArt, ironArt, canvasArt, ropeArt, giltArt, grateArt, lidArt, doorArt,
  beamsArt, darkArt, underDeckArt,
} from './galleonArt.js';

/** Her pseudo-archive: past the galleon's 38131. */
export const CARRACK_ARCHIVE = 38141;
/** The records, by what wears them: the galleon's numbers for every picture the fleet shares (world/galleonArt.js
 *  TEX), and hers - her side's livery top down (hullSide0 her rail's, hullSide4 her keel's), her transom's, her
 *  houses', her quarter rail's and her roofs'. */
export const TEX = Object.freeze({
  hullBottom: GALLEON_TEX.hullBottom, hullInner: GALLEON_TEX.hullInner, deck: GALLEON_TEX.deck, trim: GALLEON_TEX.trim,
  spar: GALLEON_TEX.spar, iron: GALLEON_TEX.iron, canvas: GALLEON_TEX.canvas, rope: GALLEON_TEX.rope, gilt: GALLEON_TEX.gilt,
  grate: GALLEON_TEX.grate, lid: GALLEON_TEX.lid, door: GALLEON_TEX.door, beams: GALLEON_TEX.beams, dark: GALLEON_TEX.dark,
  underDeck: GALLEON_TEX.underDeck,
  hullSide0: 0, hullSide1: 17, hullSide2: 18, hullSide3: 19, hullSide4: 23,
  transom0: 6, transom1: 21, house0: 5, quarterRail0: 20, roof: 24,
});
/** The pictures she shares with the galleon (painted by its own painters, under its numbers) - all but her shutter's
 *  and her ports' throats, which wear her strake's blue (`carrackArt`). */
export const SHARED = Object.freeze(['hullBottom', 'hullInner', 'deck', 'trim', 'spar', 'iron', 'canvas', 'rope', 'gilt', 'grate', 'door', 'beams', 'underDeck']);

/** Her side's livery spans these heights (her frame), keel to her bow's rail: five slices of 2.9 m, the galleon's
 *  density (her keel 4.588 under the sea, her bow's rail 9.748 over it). */
export const HULL_SIDE_Y0 = -4.7;
export const HULL_SIDE_Y1 = 9.8;
/** The liveries as their slices: `y0..y1` cut into `recs.length` bands of 64 rows each, `recs` top down. The transom's
 *  over her upper stern (its faces 3.56 to 8.63); a house's from under its sill to over its eaves (7.735 to 10.9); the
 *  quarter rail's over the rail (7.957 to 9.557). */
export const BANDS = Object.freeze({
  hullSide: Object.freeze({ y0: HULL_SIDE_Y0, y1: HULL_SIDE_Y1, recs: Object.freeze([TEX.hullSide0, TEX.hullSide1, TEX.hullSide2, TEX.hullSide3, TEX.hullSide4]) }),
  transom: Object.freeze({ y0: 3.4, y1: 9.2, recs: Object.freeze([TEX.transom0, TEX.transom1]) }),
  house: Object.freeze({ y0: 7.6, y1: 11.0, recs: Object.freeze([TEX.house0]) }),
  quarterRail: Object.freeze({ y0: 7.9, y1: 9.6, recs: Object.freeze([TEX.quarterRail0]) }),
});
/** How far each tiling picture repeats (metres a tile, u then v): the galleon's for the pictures she shares, a livery's
 *  its u alone (along her), her roof's planks two metres. */
export const CARRACK_TILE = Object.freeze({
  ...GALLEON_TILE, hullSide: [2.8, 0], transom: [2.6, 0], house: [2.6, 0], quarterRail: [2.6, 0], roof: [2, 2],
});

/** Her palette: the galleon's earths and her own three - Bay blue, ochre, white lead. */
const K = Object.freeze({
  blue: [46, 66, 94], blueLit: [66, 90, 124], blueDark: [30, 44, 64],
  ochre: [176, 128, 48], ochreLit: [214, 166, 78], ochreDark: [118, 82, 30],
  whiteLead: [198, 192, 172], black: [24, 22, 21], blackLit: [58, 54, 50],
});

/** A row's height in a livery `H` rows tall spanning y0..y1 (row 0 at y1). */
const rowAt = (y, y0, y1, H) => Math.round(((y1 - y) / (y1 - y0)) * H);
/** A full-width line of one colour at row `y`. */
const line = (img, y, col) => { for (let x = 0; x < img.width; x++) put(img, x, y, col); };

/** Her side's livery: 64 x 320, its rows her height from HULL_SIDE_Y1 (row 0) to HULL_SIDE_Y0 - worn as its five slices. */
export function hullSideLivery() {
  const W = 64, H = 64 * BANDS.hullSide.recs.length;
  const img = picture(W, H);
  const rowOf = (y) => rowAt(y, HULL_SIDE_Y0, HULL_SIDE_Y1, H);
  const n = (/** @type {number} */ seed) => noise1(seed, W, H);
  const weed = n(0xc51);
  // the bottom: tarred planks, weed greening them toward the waterline
  const wl = rowOf(0);
  planks(img, { y0: rowOf(-0.05), y1: H, ph: 7, seed: 0xc52, base: (x, y) => mix(C.tar, C.weed, Math.max(0, 1 - (y - wl) / 44) * 0.8 * weed(x, y)), tone: 0.08, seamCol: [18, 16, 14] });
  // the boot-top in white lead
  band(img, rowOf(0.3), rowOf(-0.05), K.whiteLead, 0xc53, 0.04);
  // the lower hull: oak planks tarred dark
  planks(img, { y0: rowOf(2.25), y1: rowOf(0.3), ph: 7, seed: 0xc54, base: () => mix(C.oakDark, C.tar, 0.4), tone: 0.1, trenail: C.seam });
  // the main wale, lit along its top
  const mw0 = rowOf(2.75), mw1 = rowOf(2.25);
  band(img, mw0, mw1, K.black, 0xc55, 0.05);
  line(img, mw0, K.blackLit); line(img, mw1 - 1, [14, 13, 12]);
  // the gunport strake: Bay blue planks, an ochre pin-stripe above and below
  const s0 = rowOf(4.55), s1 = mw0;
  const sb = n(0xc56);
  planks(img, { y0: s0 + 2, y1: s1 - 2, ph: 7, seed: 0xc57, base: (x, y) => mix(K.blue, K.blueLit, 0.35 * sb(x, y)), tone: 0.07, seamCol: K.blueDark, trenail: K.blueDark });
  line(img, s0, K.ochreDark); line(img, s0 + 1, K.ochre); line(img, s1 - 2, K.ochre); line(img, s1 - 1, K.ochreDark);
  // the upper wale
  const uw0 = rowOf(5.0);
  band(img, uw0, s0, K.black, 0xc58, 0.05);
  line(img, uw0, K.blackLit);
  // the topsides: oiled oak, a blue line with an ochre bead through them
  const t0 = rowOf(8.45);
  const ob = n(0xc59);
  planks(img, { y0: t0, y1: uw0, ph: 7, seed: 0xc5a, base: (x, y) => mix(C.oak, C.oakLit, 0.4 * ob(x, y)), tone: 0.12, trenail: C.oakDark });
  const bl = rowOf(6.9);
  line(img, bl - 1, K.ochre); line(img, bl, K.blue); line(img, bl + 1, K.blue); line(img, bl + 2, K.blueDark);
  // her bulwark's head, black to her bow's rail, an ochre bead under it and two more up the bow
  band(img, 0, t0, K.black, 0xc5b, 0.05);
  line(img, t0 - 1, K.ochre); line(img, t0, K.ochreDark);
  for (const y of [8.95, 9.45]) line(img, rowOf(y), K.ochreDark);
  line(img, 0, K.blackLit);
  return img;
}

/** The galleon's tileable value noise (world/galleonArt.js noise) over a picture, 8 cells across and one every 8 rows. */
const noise1 = (seed, W, H) => noise(seed, W, H, 8, Math.max(8, H / 8));

/** Her side, slice `k` of five (0 her rail's, 4 her keel's): 64 x 64. */
export const hullSideArt = (k) => sliceOf(hullSideLivery(), k);

/** Her transom's livery: 64 x 128, its rows from BANDS.transom.y1 down - the strake's blue carried up her stern, a
 *  gallery of leaded windows (a gilt frame each, the glass dark by day) over her gun deck's after end, an ochre name
 *  board, a black cap. */
export function transomLivery() {
  const { y0, y1, recs } = BANDS.transom;
  const W = 64, H = 64 * recs.length;
  const img = picture(W, H);
  const rowOf = (y) => rowAt(y, y0, y1, H);
  const sb = noise1(0xc61, W, H);
  planks(img, { ph: 7, seed: 0xc62, base: (x, y) => mix(K.blue, K.blueLit, 0.3 * sb(x, y)), tone: 0.06, seamCol: K.blueDark });
  // the upper wale's black across her stern at the strake's head, and her cap
  band(img, rowOf(5.0), rowOf(4.55), K.black, 0xc63, 0.05);
  band(img, 0, rowOf(8.45), K.black, 0xc64, 0.05);
  line(img, rowOf(8.45) - 1, K.ochre);
  // the gallery: two windows to a tile, each a gilt frame, leaded panes and an arched head
  const top = rowOf(6.05), bot = rowOf(5.1);
  for (const px of [0, 32]) {
    const xa = px + 7, xb = px + 24;
    for (let y = top; y <= bot; y++) for (let x = xa; x <= xb; x++) {
      const frame = x === xa || x === xb || y === top || y === bot;
      const lead = !frame && ((x - xa) % 4 === 0 || (y - top) % 5 === 0);
      const glint = !frame && !lead && (x - xa) % 4 === 1 && (y - top) % 5 === 1;
      put(img, x, y, frame ? K.ochreLit : lead ? C.lead : glint ? C.glassLit : C.glass);
    }
    for (let x = xa; x <= xb; x++) {
      const t = ((x - xa) / (xb - xa)) * 2 - 1;
      put(img, x, top - 1 - Math.round(2 * Math.sqrt(Math.max(0, 1 - t * t))), K.ochre);
    }
  }
  // the name board: ochre, framed, its letters a dark run along it
  const nb0 = rowOf(7.5), nb1 = rowOf(6.85);
  for (let y = nb0; y <= nb1; y++) for (let x = 0; x < W; x++) {
    const edge = y === nb0 || y === nb1;
    put(img, x, y, edge ? K.ochreDark : mix(K.ochre, K.ochreLit, ((x * 7 + y * 3) % 11) / 22));
  }
  const ly = (nb0 + nb1) >> 1;
  for (let x = 4; x < W - 4; x++) if (x % 6 !== 5 && ((x * 13) % 7) > 1) { put(img, x, ly, K.blueDark); if (x % 3 === 0) put(img, x, ly - 1, K.blueDark); }
  return img;
}
/** Her transom, slice `k` of two (0 the cap's): 64 x 64. */
export const transomArt = (k) => sliceOf(transomLivery(), k);

/** The glow her stern gallery's glass gives off at night: its panes alone, warm, on black (renderer.uploadEmissionTexture)
 *  - the transom's livery's, cut as its picture is (`carrackGlow`). */
export function transomGlowLivery() {
  const img = transomLivery();
  const out = picture(img.width, img.height);
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const c = get(img, x, y);
    const glassy = (c[0] === C.glass[0] && c[1] === C.glass[1]) || (c[0] === C.glassLit[0] && c[1] === C.glassLit[1]);
    put(out, x, y, glassy ? [255, 186, 96] : [0, 0, 0]);
  }
  return out;
}

/** A deckhouse's side: 64 x 64 over its height (BANDS.house) - a tarred sill on her deck, oiled oak clapboard (each
 *  board's lower edge standing proud and shadowed under), a blue fascia with an ochre bead under its eaves. */
export function houseArt() {
  const { y0, y1 } = BANDS.house;
  const S = GALLEON_TEX_SIZE, img = picture(S, S);
  const rowOf = (y) => rowAt(y, y0, y1, S);
  const n = noise1(0xc71, S, S);
  const sill = rowOf(7.95), fascia = rowOf(10.4);
  // the clapboard: boards 5 rows tall, each lit along its proud lower edge, its shadow under it
  for (let y = fascia; y < sill; y++) {
    const k = (sill - 1 - y) % 5;
    for (let x = 0; x < S; x++) {
      let c = mix(C.oak, C.oakLit, 0.45 * n(x, y));
      if (k === 0) c = mix(c, [255, 255, 255], 0.1);   // the board's lower edge, catching the light
      if (k === 4) c = mix(c, C.seam, 0.55);           // the shadow of the board over it
      put(img, x, y, c);
    }
  }
  band(img, sill, S, C.tar, 0xc72, 0.05);
  line(img, sill, C.oakDark);
  band(img, 0, fascia, K.blue, 0xc73, 0.05);
  line(img, fascia - 1, K.ochre); line(img, fascia - 2, K.ochreDark); line(img, 0, K.blueDark);
  // the corner posts' shade at the tile's ends, so a long wall reads as framed bays
  for (let y = fascia; y < sill; y++) { put(img, 0, y, C.oakDark); put(img, S - 1, y, C.oakDark); }
  return img;
}

/** Her quarter rail's outer face: 64 x 64 over its height (BANDS.quarterRail) - blue panels framed in ochre, two to a
 *  tile, under a black cap and over a black foot. */
export function quarterRailArt() {
  const { y0, y1 } = BANDS.quarterRail;
  const S = GALLEON_TEX_SIZE, img = picture(S, S);
  const rowOf = (y) => rowAt(y, y0, y1, S);
  const sb = noise1(0xc81, S, S);
  const cap = rowOf(9.45), foot = rowOf(8.12);
  planks(img, { y0: cap, y1: foot, ph: 8, seed: 0xc82, base: (x, y) => mix(K.blue, K.blueLit, 0.3 * sb(x, y)), tone: 0.05, seamCol: K.blueDark });
  band(img, 0, cap, K.black, 0xc83, 0.04);
  band(img, foot, S, K.black, 0xc84, 0.04);
  line(img, 0, K.blackLit);
  for (const px of [0, 32]) {
    const xa = px + 3, xb = px + 28, ya = cap + 5, yb = foot - 5;
    for (let x = xa; x <= xb; x++) { put(img, x, ya, K.ochreLit); put(img, x, yb, K.ochreDark); }
    for (let y = ya; y <= yb; y++) { put(img, xa, y, K.ochreLit); put(img, xb, y, K.ochreDark); }
    for (let x = xa + 2; x <= xb - 2; x++) { put(img, x, ya + 2, K.ochreDark); put(img, x, yb - 2, K.ochre); }
    for (let y = ya + 2; y <= yb - 2; y++) { put(img, xa + 2, y, K.ochreDark); put(img, xb - 2, y, K.ochre); }
  }
  return img;
}

/** A deckhouse's roof: tarred plank laid down the slope, a darker seam each board, weathered toward its eaves. 64 x 64,
 *  two metres a tile. */
export function roofArt() {
  const S = GALLEON_TEX_SIZE, img = picture(S, S);
  const n = noise1(0xc91, S, S);
  planks(img, { ph: 8, lenMin: 30, lenMax: 60, seed: 0xc92, base: (x, y) => mix(C.tar, C.wale, 0.5 + 0.5 * n(x, y)), tone: 0.1, grain: 0.12, seamCol: [14, 12, 11], vertical: true });
  return img;
}

/** Every picture she wears: `[record, picture]`, in record order - each 64 x 64, the liveries as their slices, the
 *  fleet's shared ones painted by the galleon's own painters. */
export function carrackArt() {
  const cut = (b, livery) => b.recs.map((rec, k) => [rec, sliceOf(livery, k)]);
  const shared = { hullBottom: hullBottomArt, hullInner: hullInnerArt, deck: deckArt, trim: trimArt, spar: sparArt, iron: ironArt, canvas: canvasArt, rope: ropeArt, gilt: giltArt, grate: grateArt, door: doorArt, beams: beamsArt, underDeck: underDeckArt };
  return [
    ...SHARED.map((key) => [TEX[key], shared[key]()]),
    // her shutters and her ports' throats in her strake's blue, by the galleon's painters (in its oxblood they read as
    // another ship's red over her blue)
    [TEX.lid, lidArt(K.blue, K.blueDark)], [TEX.dark, darkArt(K.blue, K.blueLit, [18, 26, 38], [26, 36, 52])],
    ...cut(BANDS.hullSide, hullSideLivery()), ...cut(BANDS.transom, transomLivery()),
    [TEX.house0, houseArt()], [TEX.quarterRail0, quarterRailArt()], [TEX.roof, roofArt()],
  ].sort((x, y) => x[0] - y[0]);
}

/** A record's night glow (its emission mask, top-down like its picture), or null: her transom's gallery glass alone,
 *  each slice its own cut of the glow. Made once (the pool's preload makes it). */
let _glow = null;
export function carrackGlow(record) {
  const k = BANDS.transom.recs.indexOf(record);
  if (k < 0) return null;
  _glow ??= (() => { const g = transomGlowLivery(); return BANDS.transom.recs.map((_, i) => sliceOf(g, i)); })();
  return _glow[k];
}

let _registered = false;
/**
 * Once: every picture on the texture door as a STAND-IN of CARRACK_ARCHIVE, built when the archive is first asked for
 * (the pool's preload asks) - world/galleonArt.js registerGalleonArt's law. Returns how many were registered (0 the
 * second time).
 * @param {(entries: any[]) => number} addVendorTextures
 */
export function registerCarrackArt(addVendorTextures) {
  if (_registered) return 0;
  _registered = true;
  const made = new Map();
  const art = (record) => { if (!made.size) for (const [r, p] of carrackArt()) made.set(r, p); return made.get(record) ?? null; };
  return addVendorTextures(Object.values(TEX).map((record) => ({
    archive: CARRACK_ARCHIVE, record, frame: 0, standIn: true, fileName: `carrack-${CARRACK_ARCHIVE}_${record}`,
    build: async () => art(record),
  })));
}
/** Test seam: unregistered, her glow uncut. */
export function _resetCarrackArt() { _registered = false; _glow = null; }
