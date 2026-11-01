// @ts-check
// OWN-WORK4 (2026-10-31, the owner: "A proper 1 to 1 recreation for everything"): THE BOATS' OWN PICTURES - what our
// five hulls wear (world/ships/ownBoats/ownBoatFiles.js). Come Sail Away 2.1's hulls wore Daggerfall's TEXTURE records;
// ours wear these, painted from numbers on fixed seeds under a pseudo-archive of their own (OWN_BOAT_ARCHIVE), so none
// needs ARENA2. The fleet's painters (world/ships/galleonArt.js) paint the woods, iron, rope and canvas; the hull's
// side, the awning, the crate and the oar's blade are painted here. Every picture is 64 x 64, RGBA top-down. Not a DFU
// member.
import {
  C,
  picture,
  put,
  mix,
  shade,
  paintNoise as noise,
  planks,
  hullBottomArt,
  hullInnerArt,
  deckArt,
  trimArt,
  sparArt,
  ironArt,
  canvasArt,
  ropeArt,
  giltArt,
  grateArt,
  doorArt,
  beamsArt,
  underDeckArt,
  darkArt,
  shipStandIns,
  GALLEON_TILE,
} from '../galleonArt.js';

/** The boats' pseudo-archive (world/eliteGates/pseudoArchives.js): between the large boat's 38171 and the wagons' 38181. */
export const OWN_BOAT_ARCHIVE = 38176;
/** The records, by what wears them: the fleet's numbers for the pictures it shares (world/ships/galleonArt.js TEX, as
 *  every ship's archive carries them), ours from 30. */
export const OWN_TEX = Object.freeze({
  side: 0,
  bottom: 1,
  inner: 2,
  deck: 3,
  trim: 4,
  spar: 7,
  iron: 8,
  canvas: 9,
  rope: 10,
  gilt: 11,
  grate: 12,
  door: 14,
  beams: 15,
  dark: 16,
  underDeck: 22,
  awning: 30,
  crate: 31,
  blade: 32,
});
/** The records a livery's stain lies over (scenes/comeSailAway/shipLiveryPaint.js): the hull's woods. */
export const OWN_WOOD_RECORDS = Object.freeze([OWN_TEX.side, OWN_TEX.inner, OWN_TEX.deck, OWN_TEX.trim, OWN_TEX.blade]);
/** How far each tiling picture repeats (metres a tile, u then v): the fleet's, and ours. */
export const OWN_TILE = Object.freeze({
  side: [2.4, 1.6],
  bottom: GALLEON_TILE.hullBottom,
  inner: GALLEON_TILE.hullInner,
  deck: GALLEON_TILE.deck,
  trim: GALLEON_TILE.trim,
  spar: GALLEON_TILE.spar,
  iron: GALLEON_TILE.iron,
  rope: [1, 0.5],
  grate: GALLEON_TILE.grate,
  beams: GALLEON_TILE.beams,
  dark: GALLEON_TILE.dark,
  awning: [2, 2],
  crate: [1, 1],
  underDeck: GALLEON_TILE.underDeck,
  gilt: GALLEON_TILE.gilt,
  blade: [1, 1],
});

/** Our palette's own: a hull's ochre wale and her blue strake. */
const COLOURS = Object.freeze({
  wale: [150, 104, 44],
  waleDark: [96, 64, 26],
  strake: [52, 70, 96],
  strakeLit: [72, 94, 124],
  awningA: [168, 52, 40],
  awningB: [212, 196, 160],
});

/** A hull's side: oak strakes, a blue strake under an ochre wale, tarred at its foot. One tile is 1.6 m of height. */
function sideArt() {
  const img = picture(64, 64);
  const n = noise(0x0b1, 64, 64, 8, 8);
  planks(img, {
    ph: 8,
    seed: 0x0b2,
    base: (x, y) => mix(C.oak, C.oakLit, 0.35 * n(x, y)),
    tone: 0.1,
    trenail: C.oakDark,
  });
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 64; x++) put(img, x, y, shade(y < 2 ? COLOURS.wale : COLOURS.waleDark, 1 - 0.05 * n(x, y)));
  for (let y = 8; y < 22; y++)
    for (let x = 0; x < 64; x++)
      put(img, x, y, mix(COLOURS.strake, COLOURS.strakeLit, (y % 7 === 0 ? 0.6 : 0.2) * n(x, y)));
  for (let y = 56; y < 64; y++) for (let x = 0; x < 64; x++) put(img, x, y, mix(C.tar, C.weed, 0.5 * n(x, y)));
  return img;
}

/** An awning's canvas, striped red and cream, its seams sewn along the stripes. */
function awningArt() {
  const img = picture(64, 64);
  const n = noise(0x0a1, 64, 64, 8, 8);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const colour = Math.floor(x / 8) % 2 ? COLOURS.awningB : COLOURS.awningA;
      put(img, x, y, x % 8 === 0 ? shade(colour, 0.75) : shade(colour, 0.92 + 0.12 * n(x, y)));
    }
  return img;
}

/** A crate's face: boards across, a dark frame round it and a brace corner to corner. */
function crateArt() {
  const img = picture(64, 64);
  planks(img, { ph: 16, lenMin: 64, lenMax: 64, seed: 0x0c1, base: () => C.pine, tone: 0.08, seamCol: C.pineDark });
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const frame = x < 5 || x > 58 || y < 5 || y > 58;
      const brace = Math.abs(x - y) < 4 && !frame;
      if (frame || brace) put(img, x, y, frame ? C.oakDark : mix(C.oak, C.oakDark, 0.4));
    }
  return img;
}

/** An oar's blade: ash, pale, its tip worn dark by the sea. */
function bladeArt() {
  const img = picture(64, 64);
  const n = noise(0x0d1, 64, 64, 4, 16);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) put(img, x, y, mix(mix(C.pine, C.pineGrey, n(x, y)), C.tar, x > 52 ? 0.5 : 0));
  return img;
}

/** Every picture the boats wear: `[record, picture]`, in record order.
 *  @returns {[number, { width: number, height: number, data: Uint8Array }][]} */
export function ownBoatArt() {
  const by = {
    side: sideArt,
    bottom: hullBottomArt,
    inner: hullInnerArt,
    deck: deckArt,
    trim: trimArt,
    spar: sparArt,
    iron: ironArt,
    canvas: canvasArt,
    rope: ropeArt,
    grate: grateArt,
    door: doorArt,
    beams: beamsArt,
    dark: () => darkArt(C.oak, C.oakLit, C.seam, C.oakDark),
    awning: awningArt,
    crate: crateArt,
    underDeck: underDeckArt,
    gilt: giltArt,
    blade: bladeArt,
  };
  return Object.entries(OWN_TEX)
    .map(([k, record]) => /** @type {[number, any]} */ ([record, by[k]()]))
    .sort((a, b) => a[0] - b[0]);
}

let _registered = false;
/**
 * Once: every picture on the texture door as a STAND-IN of OWN_BOAT_ARCHIVE (world/ships/galleonArt.js
 * registerGalleonArt's law), built when the archive is first asked for. Not kept across launches: eighteen small
 * pictures paint in a few milliseconds. Returns how many were registered (0 the second time).
 * @param {(entries: any[]) => number} addVendorTextures
 */
export function registerOwnBoatArt(addVendorTextures) {
  if (_registered) return 0;
  _registered = true;
  const made = new Map();
  const art = (record) => {
    if (!made.size) for (const [record, picture] of ownBoatArt()) made.set(record, picture);
    return made.get(record) ?? null;
  };
  return addVendorTextures(
    shipStandIns({
      archive: OWN_BOAT_ARCHIVE,
      name: 'ownboat',
      records: Object.values(OWN_TEX),
      art,
      night: {},
      glow: () => null,
    }),
  );
}
/** Test seam: unregistered. */
export function _resetOwnBoatArt() {
  _registered = false;
}
