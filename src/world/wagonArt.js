// @ts-check
// WAGONS1 (2026-10-09, Mac, sending his three wagons: "Here are 3 new models that will need to be textured"): THE
// WAGONS' OWN ART, MADE AT THE LOAD.
//
// world/carrackArt.js's law, for Mac's Wagon Cart, Open Wagon and Caravan (tools/bakeWagons.mjs): painted from numbers
// on fixed seeds under a pseudo-archive of their own (WAGON_ARCHIVE), every picture 64 x 64, the fleet's palette and
// tools (world/galleonArt.js) - so a wagon on a quay and the ship beside it are one hand's work. Nothing here is a
// render of game data (Port-Doctrine): every texel is a number below.
//
// THE PICTURES. A working wagon's: weathered oak sideboards nailed to their stakes, pine floorboards along the bed,
// dark oak for the running gear (axles, shafts, bench frames), an iron tyre round each wheel and a spoked wheel face
// (hub, seven spokes - Mac's wheels are heptagons - felloes). THE OPEN WAGON'S SIDE is one livery on its height (the
// wagon's frame, metres over the ground: its sides stand 0.94 to 3.06): its box of boards to its rail, the tilt's
// canvas over it, the hoops' shadows across it, and the tilt again over its roof, darker inside. THE CARAVAN wears a
// travelling family's livery: bottle-green boards picked out in oxblood and gilt, a shuttered window down each side,
// its front end a round window under a gilt sunburst, its rear end the DOOR it is entered by (world/wagonModels.js
// lays it on the rear face; scenes/caravanInterior.js is what it opens) and a painted roof of boards.
//
// Each picture is `{ width, height, data }`, RGBA top-down. Not a DFU member. Ledger A (WAGONS1).
import { C, picture, put, get, mix, shade, paintNoise as noise, paintBand as band, planks, GALLEON_TEX_SIZE, ironArt } from './galleonArt.js';
import { mulberry32 } from '../combat/bloodArt.js';

/** The wagons' pseudo-archive: past the large boat's 38171 (38151 collided once - largeBoatArt.js). */
export const WAGON_ARCHIVE = 38181;
/** The records, each a picture. */
export const TEX = Object.freeze({
  floor: 0, side: 1, inner: 2, beam: 3, bench: 4, tyre: 5, wheel: 6, iron: 7,
  openSide: 8, tilt: 9, tiltInner: 10,
  caravanSide: 11, caravanFront: 12, caravanRear: 13, caravanRoof: 14,
});
/** How far each tiling picture repeats (metres a tile, u then v - world/galleonMesh.js planarUv's); a livery's u alone
 *  (its v is its height, `BANDS`); 0 where the picture is laid whole on its face (a wheel's, an end's). */
export const WAGON_TILE = Object.freeze({
  floor: [1.6, 1.6], side: [1.6, 1.6], inner: [1.6, 1.6], beam: [1.2, 1.2], bench: [1.2, 1.2], tyre: [1.2, 1.2], wheel: [0, 0],
  iron: [1, 1], openSide: [1.3, 0], tilt: [1.3, 1.3], tiltInner: [1.3, 1.3], caravanSide: [2.9, 0], caravanFront: [0, 0],
  caravanRear: [0, 0], caravanRoof: [1.6, 1.6],
});
/** The two sides' liveries: one slice each over the wagons' side walls' height (both bodies stand 0.94 to 3.06 m - the
 *  bake's, test/wagons1.test.js pins it), `recs` top down. */
export const SIDE_Y0 = 0.94, SIDE_Y1 = 3.06;
export const BANDS = Object.freeze({
  openSide: Object.freeze({ y0: SIDE_Y0, y1: SIDE_Y1, recs: Object.freeze([TEX.openSide]) }),
  caravanSide: Object.freeze({ y0: SIDE_Y0, y1: SIDE_Y1, recs: Object.freeze([TEX.caravanSide]) }),
});
/** The open wagon's box: boards from its floor to its rail at this height (m); its tilt above. */
export const OPEN_RAIL_Y = 1.62;

/** The wagons' own colours, beside the fleet's (galleonArt.js C). */
export const K = Object.freeze({
  green: [42, 74, 52], greenLit: [62, 100, 72], greenDark: [24, 44, 30],
  roof: [36, 48, 38], roofLit: [56, 70, 56],
  weather: [118, 108, 92], board: [112, 84, 56], boardDark: [78, 56, 36], nail: [40, 36, 34],
  hub: [58, 40, 24], felloe: [96, 68, 42], spoke: [122, 90, 56],
  lamp: [232, 196, 104],
});

const S = GALLEON_TEX_SIZE;
const line = (img, y, col, x0 = 0, x1 = img.width) => { for (let x = x0; x < x1; x++) put(img, x, y, col); };
const column = (img, x, col, y0 = 0, y1 = img.height) => { for (let y = y0; y < y1; y++) put(img, x, y, col); };
/** A livery's row for a height over the wagon's side (`SIDE_Y0` its foot, row 63; `SIDE_Y1` its head, row 0). */
export const sideRow = (y) => Math.max(0, Math.min(S - 1, Math.round(((SIDE_Y1 - y) / (SIDE_Y1 - SIDE_Y0)) * (S - 1))));

/** The bed's floorboards: pine, worn pale where the load is dragged, laid along the wagon (u fore and aft). */
function floorArt() {
  const img = picture(S, S), n = noise(0xa01, S, S, 8, 8);
  planks(img, { ph: 8, seed: 0xa02, base: (x, y) => mix(mix(C.pine, C.pineGrey, 0.4), K.weather, 0.3 * n(x, y)), tone: 0.1, grain: 0.14, trenail: K.nail });
  return img;
}

/** The sideboards outside: oak gone grey with weather, three boards a tile up its 1.6 m, nailed to a stake at each
 *  end of the tile, iron straps over the stakes. */
function sideArt() {
  const img = picture(S, S), n = noise(0xa11, S, S, 8, 8);
  planks(img, { ph: 11, lenMin: 64, lenMax: 64, seed: 0xa12, base: (x, y) => mix(K.board, K.weather, 0.35 + 0.3 * n(x, y)), tone: 0.12, grain: 0.16 });
  for (const sx of [0, 1, 2, 3]) column(img, sx, sx === 3 ? C.seam : mix(K.boardDark, C.oakDark, 0.5));   // the stake
  for (let y = 0; y < S; y += 11) for (const sx of [1, 2]) put(img, sx, y + 4, K.nail);
  for (let y = 0; y < S; y++) if (y % 11 === 5) { put(img, 6, y, K.nail); put(img, S - 3, y, K.nail); }
  for (const sy of [2, S - 4]) for (let x = 0; x < 9; x++) put(img, x, sy, x === 8 ? C.iron : C.ironLit);   // the straps
  return img;
}

/** The boards inside: the same oak, scuffed paler and darker, no paint, no strap. */
function innerArt() {
  const img = picture(S, S), n = noise(0xa21, S, S, 8, 8);
  planks(img, { ph: 11, lenMin: 64, lenMax: 64, seed: 0xa22, base: (x, y) => mix(mix(K.board, C.pine, 0.4), C.innerDark, 0.35 * n(x, y)), tone: 0.1, grain: 0.12 });
  return img;
}

/** The running gear's oak: dark, the grain along it (u), a little tar and wear. */
function beamArt() {
  const img = picture(S, S), n = noise(0xa31, S, S, 4, 16), r = mulberry32(0xa32);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let c = mix(C.oakDark, C.oak, 0.6 * n(x, y));
    if (((y * 7 + Math.floor(x / 9)) % 13) === 0) c = shade(c, 0.78);   // the grain's lines along it
    if (r() < 0.015) c = C.tar;
    put(img, x, y, c);
  }
  return img;
}

/** The driver's bench: oak boards polished by years of sitting, a dark seam between each. */
function benchArt() {
  const img = picture(S, S), n = noise(0xa41, S, S, 8, 8);
  planks(img, { ph: 16, lenMin: 64, lenMax: 64, seed: 0xa42, base: (x, y) => mix(C.oak, C.oakLit, 0.5 + 0.4 * n(x, y)), tone: 0.08, grain: 0.1 });
  return img;
}

/** A wheel's iron tyre round its tread: the iron, a rivet every so often, the road's dust on it. */
function tyreArt() {
  const img = ironArt();
  const n = noise(0xa51, S, S, 8, 8);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) put(img, x, y, mix(get(img, x, y), [120, 108, 88], 0.25 * n(x, y)));
  for (let x = 4; x < S; x += 16) for (const y of [8, 40]) { put(img, x, y, C.ironLit); put(img, x + 1, y, C.iron); }
  return img;
}

/** A wheel's face, laid whole on it (world/wagonModels.js wheelUv: the picture's centre the hub's): its felloes round a
 *  rim, seven spokes (Mac's wheels have seven sides) from a turned hub with an iron hoop and its linchpin. */
function wheelArt() {
  const img = picture(S, S), n = noise(0xa61, S, S, 8, 8);
  const c = (S - 1) / 2;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x - c, dy = y - c, r = Math.hypot(dx, dy) / c, a = Math.atan2(dy, dx);
    let col;
    if (r > 0.86) col = mix(C.iron, C.ironLit, 0.4 * n(x, y));                       // the tyre's edge
    else if (r > 0.66) col = mix(K.felloe, C.oakDark, ((Math.floor(((a + Math.PI) / (2 * Math.PI)) * 7) % 2) ? 0.25 : 0) + 0.2 * n(x, y));   // the felloes, each its own tone
    else if (r > 0.3) {
      const k = (((a + Math.PI) / (2 * Math.PI)) * 7) % 1;                            // where between two spokes
      const w = 0.09 + 0.05 * (1 - r);                                               // the spoke, thicker at the hub
      col = k < w || k > 1 - w ? mix(K.spoke, C.oakLit, 0.3 * n(x, y)) : shade(mix(C.oakDark, C.tar, 0.5), 0.7);   // between them, the shadow inside the wheel
    } else if (r > 0.22) col = mix(C.iron, C.ironLit, 0.5);                           // the hub's iron hoop
    else if (r > 0.08) col = mix(K.hub, C.oak, 0.5 * n(x, y));                         // the hub
    else col = C.black;                                                                // the axle's end and its pin
    put(img, x, y, col);
  }
  return img;
}

/** The open wagon's side, its height from its foot (row 63) to the tilt's eaves (row 0): its box of three boards to a
 *  rail at OPEN_RAIL_Y, and over it the tilt's canvas, weathered down from its eaves, a hoop's shadow at each tile's end
 *  (the hoops 1.3 m apart - WAGON_TILE.openSide) and the tilt's cord laced to the rail. */
function openSideArt() {
  const img = picture(S, S), n = noise(0xa71, S, S, 8, 8);
  const rail = sideRow(OPEN_RAIL_Y);
  for (let y = 0; y < rail; y++) for (let x = 0; x < S; x++) {
    let c = mix(C.canvas, C.canvasDirt, 0.2 + 0.25 * n(x, y) + 0.3 * (y / rail));
    if (x === 0 || x === 1) c = shade(c, 0.8);   // the hoop under it
    if (x === S - 1) c = shade(c, 0.9);
    if (y === rail - 2 && x % 6 === 3) c = C.ropeDark;   // the lacing to the rail
    put(img, x, y, c);
  }
  planks(img, { y0: rail + 2, y1: S, ph: 7, lenMin: 64, lenMax: 64, seed: 0xa72, base: (x, y) => mix(K.board, K.weather, 0.35 + 0.3 * n(x, y)), tone: 0.12, grain: 0.15 });
  line(img, rail, C.oakLit); line(img, rail + 1, C.oakDark);   // the rail
  for (const sx of [0, 1, 2]) column(img, sx, mix(K.boardDark, C.oakDark, 0.5), rail, S);   // the stake under each hoop
  return img;
}

/** The tilt over the open wagon's roof: canvas, its cloths' seams across it, a hoop's shadow each 1.3 m (u along it). */
function tiltArt(inside = false) {
  const img = picture(S, S), n = noise(inside ? 0xa82 : 0xa81, S, S, 8, 8);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let c = mix(C.canvas, C.canvasDirt, 0.2 + 0.3 * n(x, y));
    if (y % 16 === 0) c = C.canvasSeam;                     // the cloths
    if (x === 0 || x === 1) c = inside ? mix(C.oak, C.oakDark, 0.5) : shade(c, 0.8);   // the hoop: its wood seen inside, its shadow out
    if (inside) c = shade(c, 0.62);                         // the light through it, from inside
    put(img, x, y, c);
  }
  return img;
}

/** The caravan's side: its height from its foot (row 63) to its eaves (row 0), one window to a tile (2.9 m along it):
 *  an oxblood skirt with a gilt line over it, bottle-green boards, a shuttered window with a gilt frame, and a carved
 *  oxblood cornice under the eaves. */
function caravanSideArt() {
  const img = picture(S, S), n = noise(0xa91, S, S, 8, 8);
  const skirt = sideRow(1.32), cornice = sideRow(2.86);
  planks(img, { y0: 0, y1: S, ph: 6, lenMin: 64, lenMax: 64, seed: 0xa92, base: (x, y) => mix(K.green, K.greenLit, 0.35 * n(x, y)), seamCol: K.greenDark, tone: 0.06, grain: 0.06 });
  band(img, skirt + 1, S, C.oxblood, 0xa93, 0.06);
  line(img, skirt, C.gilt); line(img, skirt + 1, C.giltDark);
  band(img, 0, cornice, C.oxblood, 0xa94, 0.05);
  line(img, cornice, C.gilt);
  for (let x = 0; x < S; x += 4) put(img, x + 1, cornice - 2, C.giltLit);   // the cornice's carving, picked out
  // the window: its glass behind a gilt frame, a shutter folded back each side
  const wy0 = sideRow(2.62), wy1 = sideRow(1.78), wx0 = 22, wx1 = 42;
  for (let y = wy0; y <= wy1; y++) for (let x = wx0; x <= wx1; x++) {
    const edge = y === wy0 || y === wy1 || x === wx0 || x === wx1;
    const bar = x === ((wx0 + wx1) >> 1) || y === ((wy0 + wy1) >> 1);
    put(img, x, y, edge ? C.gilt : bar ? C.lead : mix(C.glass, C.glassLit, ((x - wx0) + (wy1 - y)) / ((wx1 - wx0) + (wy1 - wy0)) * 0.7));
  }
  for (const [x0, x1] of [[wx0 - 9, wx0 - 1], [wx1 + 1, wx1 + 9]]) for (let y = wy0; y <= wy1; y++) for (let x = x0; x <= x1; x++) {
    put(img, x, y, (x === x0 || x === x1 || y === wy0 || y === wy1) ? C.oxbloodLit : (y - wy0) % 4 === 0 ? K.greenDark : mix(K.greenLit, K.green, 0.4));
  }
  return img;
}

/** One of the caravan's ends, laid whole on it (x across it, its foot to its gable's peak up it - world/wagonModels.js
 *  endUv): boards to the eaves, the gable over them with a gilt sunburst, and either the front's round window or the
 *  rear's DOOR - planked oak in a gilt-edged frame, its iron hinges and ring, a lantern beside it. */
function caravanEndArt(door) {
  const img = picture(S, S), n = noise(door ? 0xab1 : 0xaa1, S, S, 8, 8);
  planks(img, { ph: 5, lenMin: 64, lenMax: 64, seed: door ? 0xab2 : 0xaa2, base: (x, y) => mix(K.green, K.greenLit, 0.35 * n(x, y)), seamCol: K.greenDark, tone: 0.05, grain: 0.05 });
  // rows: the end runs 0.94 (row 63) to 3.52 (row 0); its eaves at 3.06, its skirt's head at 1.32
  const row = (y) => Math.max(0, Math.min(S - 1, Math.round(((3.52 - y) / (3.52 - 0.94)) * (S - 1))));
  const eaves = row(3.06), skirt = row(1.32);
  band(img, skirt + 1, S, C.oxblood, 0xaa3, 0.06); line(img, skirt, C.gilt);
  line(img, eaves, C.gilt); line(img, eaves - 1, C.oxbloodLit);
  // the gable's sunburst: gilt rays from the middle of the eaves
  const cx = (S - 1) / 2;
  for (let y = 0; y < eaves - 1; y++) for (let x = 0; x < S; x++) {
    const a = Math.atan2(eaves - y, x - cx), r = Math.hypot(x - cx, eaves - y);
    if (r < 4) put(img, x, y, C.giltLit);
    else if (r < 14 && Math.floor((a / Math.PI) * 12) % 2 === 0) put(img, x, y, mix(C.gilt, C.giltDark, r / 14));
  }
  if (!door) {
    // the front's round window, high in the end over the driver's head
    const wy = row(2.55);
    for (let y = wy - 7; y <= wy + 7; y++) for (let x = Math.round(cx) - 7; x <= Math.round(cx) + 7; x++) {
      const r = Math.hypot(x - cx, y - wy);
      if (r <= 6.5) put(img, x, y, r > 5.4 ? C.gilt : (Math.abs(x - cx) < 0.6 || Math.abs(y - wy) < 0.6) ? C.lead : mix(C.glassLit, C.glass, r / 6));
    }
    return img;
  }
  // the rear's door: 0.86 m wide by 1.95 m, from its sill on the floor
  const dy0 = row(2.9), dy1 = row(0.98), dx0 = Math.round(cx - 10), dx1 = Math.round(cx + 10);
  const grain = noise(0xab3, S, S, 16, 4);
  for (let y = dy0; y <= dy1; y++) for (let x = dx0; x <= dx1; x++) {
    put(img, x, y, shade(mix(C.oak, C.oakDark, 0.3 + 0.4 * grain(x, y)), 1 + 0.06 * (((x - dx0) / 5 | 0) % 2)));   // its boards, the grain up them
    if ((x - dx0) % 5 === 0) put(img, x, y, C.seam);                            // its boards' seams
    if (y === dy0 || y === dy1 || x === dx0 || x === dx1) put(img, x, y, C.gilt);   // its frame
  }
  for (const hy of [dy0 + 6, dy1 - 6]) line(img, hy, C.iron, dx0 + 1, dx0 + 10);   // the hinges
  const ry = (dy0 + dy1) >> 1;
  for (const [x, y] of [[dx1 - 4, ry - 1], [dx1 - 5, ry], [dx1 - 3, ry], [dx1 - 4, ry + 1]]) put(img, x, y, C.ironLit);   // the ring
  for (let y = ry - 9; y <= ry - 5; y++) for (let x = dx1 + 4; x <= dx1 + 6; x++) put(img, x, y, y === ry - 9 ? C.iron : K.lamp);   // the lantern
  return img;
}

/** The caravan's roof: painted boards along it, the green gone dark with weather, a lighter board at each seam. */
function caravanRoofArt() {
  const img = picture(S, S), n = noise(0xac1, S, S, 8, 8);
  planks(img, { ph: 8, seed: 0xac2, base: (x, y) => mix(K.roof, K.roofLit, 0.4 * n(x, y)), seamCol: C.tar, tone: 0.08, grain: 0.08 });
  return img;
}

/** Every picture the wagons wear: `[record, picture]`, in record order - each 64 x 64. */
export function wagonArt() {
  const painters = {
    floor: floorArt, side: sideArt, inner: innerArt, beam: beamArt, bench: benchArt, tyre: tyreArt, wheel: wheelArt, iron: ironArt,
    openSide: openSideArt, tilt: () => tiltArt(false), tiltInner: () => tiltArt(true),
    caravanSide: caravanSideArt, caravanFront: () => caravanEndArt(false), caravanRear: () => caravanEndArt(true), caravanRoof: caravanRoofArt,
  };
  return Object.entries(TEX).map(([key, rec]) => /** @type {[number, any]} */ ([rec, painters[key]()])).sort((a, b) => a[0] - b[0]);
}
