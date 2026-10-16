// @ts-check
// DF-ART IV (2026-10-15, Mac: "Can we bring back the wheels we had before we replaced them"): THE WAGONS' OWN WHEELS -
// the two pictures a wheel wears, painted here again as WAGONS1 painted them (src/world/wagonArt.js before DF-ART, at
// 7c291d36b1), texel for texel: its face (hub, seven spokes - Mac's wheels are heptagons - felloes and the iron tyre's
// edge) and its tread (the tyre's iron, a rivet every so often, the road's dust on it). DF-ART had dressed them in
// Daggerfall's spoked wheel (TEXTURE.087 record 7) and its grey iron; every other surface of the wagons stays
// Daggerfall's (world/wagonArt.js WAGON_SOURCES, which names these two as painted sources - world/classicArt.js
// classicPicture's `painted` arm).
//
// The palette and the tools are the old ones (world/galleonArt.js's C, picture, put, mix, shade and value noise before
// DF-ART took them out with the ships' painted art), kept here so the wheels are their own. Each picture is 64 x 64, its
// `data` RGBA - the shape classicArt.js's readers answer, uploaded in color32 order as every wagon picture is.
//
// WAGON-TIMBER (2026-10-16, Mac, of the wagon's wood and of its wheels: "I want the wheel options to be separate from the
// wood options"; "Add a few more options for the wheels as well which I know are editable via hex color codes so come up
// with a few discrete options: couple different browns, a reddish one and a grey one if possible"): THE WHEELS GET A
// FINISH, AND A FINISH IS A ROW OF TABLE. There is no new drawing here - `mix`, `shade`, the noise and the seeds are
// exactly the ones DF-ART IV left, and the two exported functions read a row instead of a constant. WHEEL_FINISHES is
// that table: six rows of the SAME twelve triples, and the built row (`oak`) IS WHEEL_COLOURS, because the wheel that
// shipped is the wheel every other finish is measured from. The operator's "editable via hex color codes" is what the
// colours ARE; what they are used for is a row the drawing reads, key by key - move `felloe` and that one wheel's felloes
// move, and nothing else on it does.
//
// TWO THINGS A FINISH DOES NOT CARRY. The IRON is the iron in all six (44,44,48 and 74,74,80, exactly the built row's):
// a tyre is iron whichever timber is turned into spokes, and a wheel whose rim changed colour with its felloes would be
// a wheel with no rim. And `dust` is the ROAD'S, not the timber's alone: a silvered wheel gathers a pale grey dust and an
// ebony one a dark one, so the tread is a second picture of the finish rather than the built tread over new spokes.
//
// Not a DFU member. Ledger A (WAGONS1, WAGON-TIMBER).
import { mulberry32 } from '../combat/bloodArt.js';

/** A wheel picture's side, texels (the wagons' 64 - GALLEON_TEX_SIZE before DF-ART). */
export const WHEEL_ART_SIZE = 64;

/** The colours the wheels were painted in: the fleet's iron, oak and tar, the wagons' own wood for the felloes,
 *  the spokes and the hub, and (WAGON-TIMBER) the road's dust on the tread. This row IS the built finish: a wagon with
 *  no `wheels` chosen wears the wheel DF-ART IV painted, byte for byte. */
export const WHEEL_COLOURS = Object.freeze({
  iron: Object.freeze([44, 44, 48]), ironLit: Object.freeze([74, 74, 80]), rust: Object.freeze([96, 54, 32]),
  oak: Object.freeze([104, 72, 44]), oakDark: Object.freeze([70, 47, 29]), oakLit: Object.freeze([132, 96, 60]),
  tar: Object.freeze([30, 27, 24]), black: Object.freeze([20, 18, 17]),
  hub: Object.freeze([58, 40, 24]), felloe: Object.freeze([96, 68, 42]), spoke: Object.freeze([122, 90, 56]),
  dust: Object.freeze([120, 108, 88]),   // the road's dust on the tyre: the tread's own lift, out of the tread itself
});

/**
 * WAGON-TIMBER: THE FINISHES, one a name in systems/wagonTimber.js WHEEL_LOOKS and the first the wheel as DF-ART IV
 * painted it. Each row is a WHOLE row of RGB triples - the same twelve keys as WHEEL_COLOURS, none the drawing reads
 * missing - and `oak` is WHEEL_COLOURS ITSELF, so "the wheel that shipped" is one table row and not a second copy of it
 * that could drift.
 *
 * They are the operator's own list read out of the table, and the hues say how: `oak`, `walnut` and `ebony` are the
 * couple of different browns (felloe at hue 29, 24 and 25 degrees - the built row and two either side of it), `ash` the
 * weathered blond at 38, `mahogany` the reddish one at 14 with its saturation 0.70, and `silvered` the grey - hue 43 and
 * saturation 0.06, the colour nearly gone out of the timber. The hue stays the family's, as asked: the operator asked for
 * browns, a red and a grey, not a hue wheel, so a row is its timber's own hue at another light and another depth, which
 * is what makes six of them read as six timbers rather than six tints of one.
 *
 * `iron` and `ironLit` are the same in all six, deliberately (see the header): a rim is iron. `black` - the axle's end and
 * its pin, the one place a wheel is not timber - is each row's own `tar` carried to about seven tenths of it, which is
 * the built row's own relationship (`30,27,24` to `20,18,17`). `rust` is the iron's own, deeper and redder as the iron it
 * sits in grows old; `dust` is the road's on a wheel of that timber.
 */
export const WHEEL_FINISHES = Object.freeze({
  oak: WHEEL_COLOURS,
  ash: Object.freeze({
    iron: Object.freeze([44, 44, 48]), ironLit: Object.freeze([74, 74, 80]), rust: Object.freeze([110, 78, 58]),
    oak: Object.freeze([178, 156, 116]), oakDark: Object.freeze([140, 120, 88]), oakLit: Object.freeze([206, 188, 152]),
    tar: Object.freeze([86, 76, 58]), black: Object.freeze([60, 53, 41]),
    hub: Object.freeze([128, 110, 80]), felloe: Object.freeze([168, 146, 108]), spoke: Object.freeze([192, 172, 134]),
    dust: Object.freeze([150, 142, 124]),
  }),
  walnut: Object.freeze({
    iron: Object.freeze([44, 44, 48]), ironLit: Object.freeze([74, 74, 80]), rust: Object.freeze([84, 52, 34]),
    oak: Object.freeze([78, 52, 34]), oakDark: Object.freeze([52, 34, 22]), oakLit: Object.freeze([100, 70, 46]),
    tar: Object.freeze([26, 19, 13]), black: Object.freeze([18, 13, 9]),
    hub: Object.freeze([46, 30, 20]), felloe: Object.freeze([72, 48, 32]), spoke: Object.freeze([92, 64, 42]),
    dust: Object.freeze([104, 92, 74]),
  }),
  mahogany: Object.freeze({
    iron: Object.freeze([44, 44, 48]), ironLit: Object.freeze([74, 74, 80]), rust: Object.freeze([110, 48, 26]),
    oak: Object.freeze([116, 54, 34]), oakDark: Object.freeze([78, 34, 21]), oakLit: Object.freeze([146, 72, 46]),
    tar: Object.freeze([34, 17, 11]), black: Object.freeze([24, 12, 8]),
    hub: Object.freeze([68, 30, 18]), felloe: Object.freeze([108, 50, 32]), spoke: Object.freeze([134, 66, 42]),
    dust: Object.freeze([128, 92, 72]),
  }),
  silvered: Object.freeze({
    iron: Object.freeze([44, 44, 48]), ironLit: Object.freeze([74, 74, 80]), rust: Object.freeze([96, 72, 54]),
    oak: Object.freeze([126, 124, 118]), oakDark: Object.freeze([92, 90, 86]), oakLit: Object.freeze([156, 154, 148]),
    tar: Object.freeze([56, 55, 53]), black: Object.freeze([39, 38, 37]),
    hub: Object.freeze([92, 90, 87]), felloe: Object.freeze([118, 116, 111]), spoke: Object.freeze([138, 136, 131]),
    dust: Object.freeze([138, 136, 130]),
  }),
  ebony: Object.freeze({
    iron: Object.freeze([44, 44, 48]), ironLit: Object.freeze([74, 74, 80]), rust: Object.freeze([70, 48, 34]),
    oak: Object.freeze([48, 40, 34]), oakDark: Object.freeze([32, 27, 23]), oakLit: Object.freeze([66, 56, 47]),
    tar: Object.freeze([18, 15, 13]), black: Object.freeze([13, 11, 9]),
    hub: Object.freeze([28, 24, 21]), felloe: Object.freeze([44, 37, 32]), spoke: Object.freeze([58, 50, 43]),
    dust: Object.freeze([86, 80, 72]),
  }),
});

/**
 * WAGON-TIMBER: THE FINISH A DRAWING WEARS. A row of WHEEL_FINISHES - `f.felloe` and `f.dust` are what say "this is a
 * finish" and not some other shape of object, and either missing falls back to the built row, so a caller's no-arg draw
 * and a caller's `WHEEL_FINISHES.oak` are the same picture. The drawing reads `C` (the built row's own name here) and
 * nothing else knows which row it has.
 * @param {any} f
 */
const finishOf = (f) => (f && f.felloe && f.dust ? f : WHEEL_COLOURS);

/** @param {number} w @param {number} h */
const picture = (w, h) => ({ width: w, height: h, data: new Uint8Array(w * h * 4) });
const clamp8 = (/** @type {number} */ v) => Math.max(0, Math.min(255, Math.round(v)));
/** @param {{width:number,height:number,data:Uint8Array}} img @param {number} x @param {number} y @param {ArrayLike<number>} rgb */
const put = (img, x, y, rgb) => {
  const w = img.width, h = img.height;
  const i = ((((y % h) + h) % h) * w + (((x % w) + w) % w)) * 4;
  img.data[i] = clamp8(rgb[0]); img.data[i + 1] = clamp8(rgb[1]); img.data[i + 2] = clamp8(rgb[2]); img.data[i + 3] = 255;
};
/** @param {{width:number,height:number,data:Uint8Array}} img @param {number} x @param {number} y */
const get = (img, x, y) => {
  const w = img.width, h = img.height;
  const i = ((((y % h) + h) % h) * w + (((x % w) + w) % w)) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
};
/** @param {ArrayLike<number>} a @param {ArrayLike<number>} b @param {number} t */
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** @param {ArrayLike<number>} c @param {number} k */
const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

/** Tileable value noise over a w x h picture, `cx` by `cy` lattice cells across it. */
function noise(/** @type {number} */ seed, /** @type {number} */ w, /** @type {number} */ h, /** @type {number} */ cx, /** @type {number} */ cy) {
  const r = mulberry32(seed);
  const lat = Float32Array.from({ length: cx * cy }, () => r());
  const at = (/** @type {number} */ i, /** @type {number} */ j) => lat[(((j % cy) + cy) % cy) * cx + (((i % cx) + cx) % cx)];
  const sm = (/** @type {number} */ t) => t * t * (3 - 2 * t);
  return (/** @type {number} */ x, /** @type {number} */ y) => {
    const fx = (x / w) * cx, fy = (y / h) * cy;
    const i = Math.floor(fx), j = Math.floor(fy);
    const tx = sm(fx - i), ty = sm(fy - j);
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
}

/** The iron the tyre is made of: blackened, speckled, a little rust (the fleet's gun iron, as the tyre was painted on).
 *  `C` the finish's row, so the rust in the iron is the finish's rust. */
function ironArt(/** @type {any} */ C) {
  const S = WHEEL_ART_SIZE, img = picture(S, S);
  const n = noise(0x1e1, S, S, 16, 16);
  const r = mulberry32(0x1e2);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    /** @type {ArrayLike<number>} */
    let c = mix(C.iron, C.ironLit, 0.5 * n(x, y));
    if (r() < 0.04) c = C.rust;
    put(img, x, y, c);
  }
  return img;
}

/** A wheel's iron tyre round its tread: the iron, a rivet every so often, the road's dust on it - the dust the FINISH's
 *  own (`C.dust`), so a tread is a picture of its finish and not of the wheel that was built with the same spokes.
 *  `fin` a row of WHEEL_FINISHES; the built wheel the answer with no row at all. */
export function wagonTyreArt(/** @type {any} */ fin = WHEEL_FINISHES.oak) {
  const C = finishOf(fin), S = WHEEL_ART_SIZE, img = ironArt(C);
  const n = noise(0xa51, S, S, 8, 8);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) put(img, x, y, mix(get(img, x, y), C.dust, 0.25 * n(x, y)));
  for (let x = 4; x < S; x += 16) for (const y of [8, 40]) { put(img, x, y, C.ironLit); put(img, x + 1, y, C.iron); }
  return img;
}

/** A wheel's face, laid whole on it (world/wagonModels.js wheelUv: the picture's centre the hub's): its felloes round a
 *  rim, seven spokes (Mac's wheels have seven sides) from a turned hub with an iron hoop and its linchpin. `fin` a row of
 *  WHEEL_FINISHES; the built wheel the answer with no row at all, and the two are the same picture byte for byte. */
export function wagonWheelArt(/** @type {any} */ fin = WHEEL_FINISHES.oak) {
  const C = finishOf(fin), S = WHEEL_ART_SIZE, img = picture(S, S), n = noise(0xa61, S, S, 8, 8);
  const c = (S - 1) / 2;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x - c, dy = y - c, r = Math.hypot(dx, dy) / c, a = Math.atan2(dy, dx);
    let col;
    if (r > 0.86) col = mix(C.iron, C.ironLit, 0.4 * n(x, y));                       // the tyre's edge
    else if (r > 0.66) col = mix(C.felloe, C.oakDark, ((Math.floor(((a + Math.PI) / (2 * Math.PI)) * 7) % 2) ? 0.25 : 0) + 0.2 * n(x, y));   // the felloes, each its own tone
    else if (r > 0.3) {
      const k = (((a + Math.PI) / (2 * Math.PI)) * 7) % 1;                            // where between two spokes
      const w = 0.09 + 0.05 * (1 - r);                                               // the spoke, thicker at the hub
      col = k < w || k > 1 - w ? mix(C.spoke, C.oakLit, 0.3 * n(x, y)) : shade(mix(C.oakDark, C.tar, 0.5), 0.7);   // between them, the shadow inside the wheel
    } else if (r > 0.22) col = mix(C.iron, C.ironLit, 0.5);                           // the hub's iron hoop
    else if (r > 0.08) col = mix(C.hub, C.oak, 0.5 * n(x, y));                         // the hub
    else col = C.black;                                                                // the axle's end and its pin
    put(img, x, y, col);
  }
  return img;
}