// @ts-check
// SHIPS-2 (2026-10-07, Mac: "implement both of these new ship placement models, UV Map/Texture, and ensure it matches the
// love we gave the other new ship model we implemented"): THE NEW LARGE BOAT'S OWN ART, MADE AT THE LOAD.
//
// world/carrackArt.js's law, for Mac's Tiny Ship (Come Sail Away's hull 1): painted from numbers on fixed seeds under a
// pseudo-archive of her own (LARGE_BOAT_ARCHIVE), every picture 64 x 64, the pictures every ship of the port's wears
// the galleon's (world/galleonArt.js, under its record numbers - `TEX`, pinned to its), and her livery her own.
//
// HER LIVERY IS A WORKING BOAT'S, CLINKER-BUILT, read on her heights (the boat's frame, metres over the sea -
// tools/bakeLargeBoat.mjs FRAME: her keel 0.615 under it, her deck 0.90 and her gunwale 2.25 over it): the tarred
// bottom, a white boot line at the waterline, oiled pine strakes each lapped over the one under it (its lower edge
// standing proud, lit, its shadow on the strake below), a sea-green sheer strake with a white line under it, and the
// black gunwale. Her transom carries her strakes round her stern, a carved ochre name board on them. Her livery is ONE
// slice (64 rows over her 2.92 m, 4.6 cm a texel - the galleon's side's density) and world/largeBoatModel.js lays v on
// her height.
//
// Each picture is `{ width, height, data }`, RGBA top-down. Not a DFU member. Ledger A (SHIPS-2).
import {
  C, picture, put, mix, paintNoise as noise, paintBand as band, planks, GALLEON_TEX_SIZE, TEX as GALLEON_TEX, GALLEON_TILE,
  hullBottomArt, hullInnerArt, deckArt, trimArt, sparArt, ironArt, canvasArt, ropeArt, giltArt, grateArt, lidArt, doorArt,
  beamsArt, darkArt, underDeckArt,
} from './galleonArt.js';

/** Her pseudo-archive: past the carrack's 38141. */
export const LARGE_BOAT_ARCHIVE = 38171;   // AUDIT SD IV (R6): it was 38151, the Shattered Hour's own (world/sdRealm.js SD_REALM_ARCHIVE) - a picture is kept by archive and record, so whichever went up first stood for both
/** The records: the galleon's numbers for every picture the fleet shares, and hers - her side's livery and her
 *  transom's. */
export const TEX = Object.freeze({
  hullBottom: GALLEON_TEX.hullBottom, hullInner: GALLEON_TEX.hullInner, deck: GALLEON_TEX.deck, trim: GALLEON_TEX.trim,
  spar: GALLEON_TEX.spar, iron: GALLEON_TEX.iron, canvas: GALLEON_TEX.canvas, rope: GALLEON_TEX.rope, gilt: GALLEON_TEX.gilt,
  grate: GALLEON_TEX.grate, lid: GALLEON_TEX.lid, door: GALLEON_TEX.door, beams: GALLEON_TEX.beams, dark: GALLEON_TEX.dark,
  underDeck: GALLEON_TEX.underDeck,
  hullSide0: 0, transom0: 6,
});
/** The pictures she shares with the galleon (painted by its own painters, under its numbers). */
const SHARED = Object.freeze(['hullBottom', 'hullInner', 'deck', 'trim', 'spar', 'iron', 'canvas', 'rope', 'gilt', 'grate', 'lid', 'door', 'beams', 'dark', 'underDeck']);

/** Her side's livery spans these heights (her frame): her keel (-0.615) to her gunwale's cap (2.249), one slice. */
const HULL_SIDE_Y0 = -0.66;
const HULL_SIDE_Y1 = 2.26;
/** The liveries as their slices (world/carrackArt.js BANDS's shape): her side's and her transom's, keel to gunwale. */
export const BANDS = Object.freeze({
  hullSide: Object.freeze({ y0: HULL_SIDE_Y0, y1: HULL_SIDE_Y1, recs: Object.freeze([TEX.hullSide0]) }),
  transom: Object.freeze({ y0: HULL_SIDE_Y0, y1: HULL_SIDE_Y1, recs: Object.freeze([TEX.transom0]) }),
});
/** How far each tiling picture repeats (metres a tile): the galleon's, a livery's its u alone (along her). */
export const LARGE_BOAT_TILE = Object.freeze({ ...GALLEON_TILE, hullSide: [2.4, 0], transom: [2.4, 0] });

/** Her palette's own: the sheer strake's sea green, the boot line's white, her name board's ochre. */
const K = Object.freeze({
  green: [58, 92, 70], greenLit: [80, 120, 92], greenDark: [34, 58, 44],
  white: [206, 200, 182], ochre: [176, 128, 48], ochreDark: [118, 82, 30], black: [24, 22, 21], blackLit: [60, 56, 50],
});

const rowOf = (y) => Math.round(((HULL_SIDE_Y1 - y) / (HULL_SIDE_Y1 - HULL_SIDE_Y0)) * GALLEON_TEX_SIZE);
const line = (img, y, col) => { for (let x = 0; x < img.width; x++) put(img, x, y, col); };

/**
 * Clinker strakes over rows y0..y1: each strake `h` rows, its butts staggered along it, its lower edge proud (lit) and
 * its shadow on the strake under it - `base(x, y)` the wood's colour.
 */
function clinker(img, y0, y1, h, seed, base) {
  const W = img.width, n = noise(seed, W, 64, 8, 8);
  for (let y = y0; y < y1; y++) {
    const k = (y1 - 1 - y) % h, strake = Math.floor((y1 - 1 - y) / h);
    const butt = (strake * 23 + 11) % W;
    for (let x = 0; x < W; x++) {
      let c = mix(base(x, y), C.oakLit, 0.25 * n(x, y));
      if (k === 0) c = mix(c, [255, 255, 255], 0.12);   // the strake's lapped lower edge, catching the light
      if (k === h - 1) c = mix(c, C.seam, 0.6);         // the shadow of the strake over it
      if (x === butt && k > 0 && k < h - 1) c = C.seam; // its butt
      put(img, x, y, c);
    }
  }
}

/** Her side: 64 x 64 over her height - the tarred bottom, the white boot line, oiled pine clinker strakes, the green
 *  sheer strake with its white line, the black gunwale. */
function hullSideArt() {
  const S = GALLEON_TEX_SIZE, img = picture(S, S);
  const weed = noise(0xb51, S, S, 8, 8);
  const wl = rowOf(0);
  planks(img, { y0: rowOf(-0.03), y1: S, ph: 6, seed: 0xb52, base: (x, y) => mix(C.tar, C.weed, Math.max(0, 1 - (y - wl) / 16) * 0.8 * weed(x, y)), tone: 0.08, seamCol: [18, 16, 14] });
  band(img, rowOf(0.1), rowOf(-0.03), K.white, 0xb53, 0.04);
  const sheer = rowOf(1.72), cap = rowOf(2.12);
  clinker(img, sheer, rowOf(0.1), 5, 0xb54, () => mix(C.pine, C.oak, 0.45));
  band(img, cap, sheer, K.green, 0xb55, 0.06);
  line(img, sheer, K.white); line(img, sheer - 1, K.greenDark); line(img, cap, K.greenLit);
  band(img, 0, cap, K.black, 0xb56, 0.04);
  line(img, 0, K.blackLit);
  return img;
}

/** Her transom: her side's strakes round her stern, and a carved ochre name board on them. 64 x 64. */
function transomArt() {
  const img = hullSideArt();
  const y0 = rowOf(1.55), y1 = rowOf(1.2);
  for (let y = y0; y <= y1; y++) for (let x = 8; x < 56; x++) {
    const edge = y === y0 || y === y1 || x === 8 || x === 55;
    put(img, x, y, edge ? K.ochreDark : mix(K.ochre, [230, 190, 110], ((x * 5 + y * 3) % 9) / 18));
  }
  const ly = (y0 + y1) >> 1;
  for (let x = 12; x < 52; x++) if (x % 5 !== 4 && ((x * 11) % 7) > 1) put(img, x, ly, K.greenDark);
  return img;
}

/** Every picture she wears: `[record, picture]`, in record order - each 64 x 64. */
export function largeBoatArt() {
  const shared = { hullBottom: hullBottomArt, hullInner: hullInnerArt, deck: deckArt, trim: trimArt, spar: sparArt, iron: ironArt, canvas: canvasArt, rope: ropeArt, gilt: giltArt, grate: grateArt, lid: lidArt, door: doorArt, beams: beamsArt, dark: darkArt, underDeck: underDeckArt };
  return [...SHARED.map((key) => [TEX[key], shared[key]()]), [TEX.hullSide0, hullSideArt()], [TEX.transom0, transomArt()]].sort((x, y) => x[0] - y[0]);
}

let _registered = false;
/**
 * Once: every picture on the texture door as a STAND-IN of LARGE_BOAT_ARCHIVE, built when the archive is first asked
 * for (world/galleonArt.js registerGalleonArt's law). Returns how many were registered (0 the second time).
 * @param {(entries: any[]) => number} addVendorTextures
 */
export function registerLargeBoatArt(addVendorTextures) {
  if (_registered) return 0;
  _registered = true;
  const made = new Map();
  const art = (record) => { if (!made.size) for (const [r, p] of largeBoatArt()) made.set(r, p); return made.get(record) ?? null; };
  return addVendorTextures(Object.values(TEX).map((record) => ({
    archive: LARGE_BOAT_ARCHIVE, record, frame: 0, standIn: true, fileName: `largeboat-${LARGE_BOAT_ARCHIVE}_${record}`,
    build: async () => art(record),
  })));
}
/** Test seam: unregistered. */
export function _resetLargeBoatArt() { _registered = false; }
