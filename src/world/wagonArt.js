// @ts-check
// WAGONS1 (2026-10-09, Mac, sending his three wagons: "Here are 3 new models that will need to be textured"): THE
// WAGONS' OWN ART, MADE AT THE LOAD.
//
// world/ships/carrackArt.js's law, for Mac's Wagon Cart, Open Wagon and Caravan (tools/bakeWagons.mjs): painted from numbers
// on fixed seeds under a pseudo-archive of their own (WAGON_ARCHIVE), every picture 64 x 64, the fleet's palette and
// tools (world/ships/galleonArt.js) - so a wagon on a quay and the ship beside it are one hand's work. Nothing here is a
// render of game data (Port-Doctrine): every texel is a number below.
//
// THE PICTURES. A working wagon's: weathered oak sideboards nailed to their stakes, pine floorboards along the bed,
// dark oak for the running gear (axles, shafts, bench frames), an iron tyre round each wheel and a spoked wheel face
// (hub, seven spokes - Mac's wheels are heptagons - felloes). THE OPEN WAGON'S SIDE is one livery on its height (the
// wagon's frame, metres over the ground: its sides stand 0.94 to 3.06): its box of boards to its rail, the tilt's
// canvas over it, the hoops' shadows across it, and the tilt again over its roof, darker inside. THE CARAVAN wears a
// travelling family's livery: bottle-green boards picked out in oxblood and gilt, a shuttered window down each side,
// its front end a round window under a gilt sunburst, its rear end the DOOR it is entered by (world/wagonModels.js
// lays it on the rear face; scenes/caravanRoom.js is what it opens) and a painted roof of boards.
//
// Each picture is `{ width, height, data }`, RGBA top-down. Not a DFU member. Ledger A (WAGONS1).
import { C, picture, put, get, mix, shade, paintNoise as noise, paintBand as band, planks, GALLEON_TEX_SIZE, ironArt } from './ships/galleonArt.js';
import { mulberry32 } from '../combat/blood/bloodArt.js';
import { dyeEveryTexel } from '../systems/horse/horseCoats.js';   // WAGON-TIMBER: the timber's dyes through the horse coat's own arithmetic
import { paintWagonEmblem, EMBLEM_CELL, EMBLEM_M } from './wagonEmblem.js';   // WAGON-EMBLEM: the guild arms over one cell of the open side
//
// WAGON-TIMBER (2026-10-16, Mac, of the wagon's wood and of its wheels: "Ok so there is a separation of all the wooden
// parts which is cool. Lets make a selector for each of them and send them over the wire using the same system that
// already exists"; "I want the wheel options to be separate from the wood options"; "Add a few more options for the
// wheels as well which I know are editable via hex color codes so come up with a few discrete options: couple different
// browns, a reddish one and a grey one if possible"): THE FOUR FIXED WOODEN RECORDS GET A DYE, AND THE WHEELS GET A
// FINISH. TEX.floor, TEX.inner, TEX.beam and TEX.bench wear painted woods and nothing else, so a choice over them goes
// through the horse coat's own arithmetic (systems/horse/horseCoats.js dyeEveryTexel over every texel - a hue/saturation/
// value SHIFT, so the painted grain and shading ride through it where a fill would flatten them). WOOD_DYES is that
// table, in the horse coat dye's own shape. The wheels are a separate table of finishes (WHEEL_FINISHES) read by the
// wheel painters below: a choice is a row of colours, never a new drawing. CART_DYES dyes the cart's own boards the
// same way, so the cart's paint keeps the grain with the colour on it.
//
// THE RECORDS. Both families take the paint's own LOOK_RECORD_STRIDE ladder (a record `r` at choice `i` is
// `r + LOOK_RECORD_STRIDE * i`), so a choice is remapped and uploaded by exactly the machinery a paint uses and
// nothing here had to be invented for it. LOOK_RECORDS names the timber's five lists beside the paint's, and
// TIMBER_LISTS maps each wooden part to its list. The wheels are their own list, never one of the wood's, which is
// what "the wheel options separate from the wood options" means in a source table.
//
// WAGON-EMBLEM (2026-10-16, Mac: "a guild master's emblem painted on the sides of their open wagon"; then, of the
// result, "Can we make it only show on the second iteration?"): THE OPEN WAGON'S OUTER SIDE WEARS GUILD ARMS. The side
// is four tiles wide (SIDE_CELLS of SIDE_TILE_M, its u running once over all four - world/wagonModels.js lays it
// un-flipped, so both walls read the same picture) and the arms are painted over ONE cell of it (the second -
// world/wagonEmblem.js paintWagonEmblem, the shield, over the arms the caller hands in). A painted choice's side is
// that composition; the built side is bare boards. Nothing of it rides the wire - no field, no PARK_WAGON_LOOK_MAX,
// and LOOK_COUNT is six still.
// Not a DFU member. Ledger A (WAGONS1, WAGON-TIMBER).
//
/** The wagons' pseudo-archive: past the large boat's 38171 (38151 collided once - largeBoatArt.js). */
export const WAGON_ARCHIVE = 38181;
/** The records, each a picture. */
export const TEX = Object.freeze({
  floor: 0, side: 1, inner: 2, beam: 3, bench: 4, tyre: 5, wheel: 6, iron: 7,
  openSide: 8, tilt: 9, tiltInner: 10,
  caravanSide: 11, caravanFront: 12, caravanRear: 13, caravanRoof: 14,
  roomSide: 15, roomFront: 16, roomRear: 17, roomCeiling: 18, roomFloor: 19,   // WAGONS2: the caravan's room (world/caravanRoomModel.js)
  harness: 20,   // WAGONS3: the traces and the reins (systems/wagon/wagonRopes.js)
});
/** THE LIVERY'S OWN REPEAT - a metre and three tenths of u along the open wagon's side, at the scale the boards
 *  have always worn. Nothing stretches it (WAGON-EMBLEM): the side's picture carries four of these tiles side by
 *  side, so its u spans all four cells once and a face walks over the picture a single time. */
export const SIDE_TILE_M = 1.3;
/** How many of those tiles one side's picture holds (WAGON-EMBLEM): four cells wide, and the face's u runs once over
 *  all four - so the cell boundaries stand at 1.3 m, 2.6 m and 3.9 m, and an emblem painted on ONE cell is the only
 *  one on the wagon. */
export const SIDE_CELLS = 4;
/** How far each tiling picture repeats (metres a tile, u then v - world/ships/galleonMesh.js planarUv's); a livery's u alone
 *  (its v is its height, `BANDS`); 0 where the picture is laid whole on its face (a wheel's, an end's). The open
 *  wagon's side is the odd one out: its u spans all four of its cells, so a face walks over the picture once. */export const WAGON_TILE = Object.freeze({
  floor: [1.6, 1.6], side: [1.6, 1.6], inner: [1.6, 1.6], beam: [1.2, 1.2], bench: [1.2, 1.2], tyre: [1.2, 1.2], wheel: [0, 0],
  iron: [1, 1], openSide: [SIDE_CELLS * SIDE_TILE_M, 0], tilt: [1.3, 1.3], tiltInner: [1.3, 1.3], caravanSide: [2.9, 0], caravanFront: [0, 0],
  caravanRear: [0, 0], caravanRoof: [1.6, 1.6],
  roomSide: [2.9, 0], roomFront: [0, 0], roomRear: [0, 0], roomCeiling: [1.6, 1.6], roomFloor: [1.6, 1.6],
  harness: [0, 0.5],   // WAGONS3: round the strap once, half a metre of it a tile along it
});
/** A side band's u over the WHOLE of its picture, laid the SAME WAY ON BOTH SIDES (WAGON-EMBLEM): metres from the
 *  body's rear over `tileM`. `planarUv` flips u on the far side - world/ships/galleonMesh.js's own line, "a side" - which
 *  mirrors a side's picture about the wagon's middle. That is free on cloth, whose weave has no handedness, and it was
 *  the law that put the arms a whole tile apart on the two sides of the same wagon: the near side read z 1.3 to 2.6 m
 *  and the far side read the same texels at z 2.6 to 3.9 m. Un-flipped, the arms stand at the same place on both. */
export const sideBandU = (/** @type {readonly number[]} */ p, tileM) => p[2] / tileM;
/** The two sides' liveries: one slice each over the wagons' side walls' height (both bodies stand 0.94 to 3.06 m - the
 *  bake's, test/systems/item/wagons1.test.js pins it), `recs` top down. */
export const SIDE_Y0 = 0.94, SIDE_Y1 = 3.06;
export const BANDS = Object.freeze({
  openSide: Object.freeze({ y0: SIDE_Y0, y1: SIDE_Y1, recs: Object.freeze([TEX.openSide]) }),
  caravanSide: Object.freeze({ y0: SIDE_Y0, y1: SIDE_Y1, recs: Object.freeze([TEX.caravanSide]) }),
  roomSide: Object.freeze({ y0: SIDE_Y0, y1: SIDE_Y1, recs: Object.freeze([TEX.roomSide]) }),   // WAGONS2: on the caravan's side's own heights, so the windows meet
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

// ── WAGONS2: the paints (systems/wagon/wagonLooks.js is their law) ───────────────────────────────────────────

/** A painted body's colours, [base, lit, dark] - each paint the law names that is a colour (the built ones - the cart's
 *  oak, the tilt's cream - are null: their pictures as WAGONS1 painted them). */
export const PAINTS = Object.freeze({
  oak: null, cream: null,
  red: Object.freeze([[138, 38, 30], [166, 56, 42], [92, 24, 18]]),
  blue: Object.freeze([[40, 58, 98], [60, 82, 128], [24, 34, 62]]),
  green: Object.freeze([K.green, K.greenLit, K.greenDark]),
  black: Object.freeze([[34, 32, 32], [56, 52, 50], [16, 14, 14]]),
  white: Object.freeze([[200, 194, 178], [226, 220, 204], [148, 142, 126]]),
  ochre: Object.freeze([[156, 114, 42], [184, 140, 60], [108, 76, 26]]),
  oxblood: Object.freeze([C.oxblood, C.oxbloodLit, [70, 20, 16]]),
  whitewash: Object.freeze([[214, 208, 192], [232, 228, 214], [170, 164, 148]]),
});
/** A dyed tilt's canvas, [cloth, dirt, seam] - the open wagon's paints (cream is the canvas as built). */
export const DYES = Object.freeze({
  red: Object.freeze([[178, 66, 54], [148, 60, 48], [128, 44, 36]]),
  blue: Object.freeze([[78, 100, 146], [70, 86, 116], [52, 70, 108]]),
  green: Object.freeze([[86, 122, 86], [80, 102, 74], [60, 88, 62]]),
  ochre: Object.freeze([[202, 158, 80], [170, 136, 82], [160, 118, 54]]),
  black: Object.freeze([[58, 56, 54], [70, 64, 58], [36, 34, 32]]),
});
/** The trim a caravan body wears: oxblood, but green on an oxblood body and blue on a white one. */
const trimFor = (paint) => (paint === 'oxblood' ? [K.green, K.greenLit] : paint === 'white' ? [PAINTS.blue[0], PAINTS.blue[1]] : [C.oxblood, C.oxbloodLit]);
/** A texel of glass: its colour kept for a renderer that draws it whole, its alpha 0 - a hole the eye sees through
 *  wherever the picture is uploaded as a cut-out (the caravan's windows, outside and in). */
const glass = (img, x, y, rgb) => { put(img, x, y, rgb); img.data[(y * img.width + x) * 4 + 3] = 0; };

/** How far a look's records stand from the built ones' (a record `r` painted with a list's `i`th choice is
 *  `r + LOOK_RECORD_STRIDE * i`; the built choice, 0, is `r` itself). */
export const LOOK_RECORD_STRIDE = 100;
/** Which built records each choice repaints: a kind's outside, the caravan's inside parts, and (WAGON-TIMBER) the four
 *  fixed wooden records and the wheels. The list's NAME is what a caller passes to wagonLookArt - a kind, one of the
 *  caravan's inside parts, or one of TIMBER_LISTS' five. */
export const LOOK_RECORDS = Object.freeze({
  cart: Object.freeze([TEX.side]),
  openWagon: Object.freeze([TEX.openSide, TEX.tilt, TEX.tiltInner]),
  caravan: Object.freeze([TEX.caravanSide, TEX.caravanFront, TEX.caravanRear, TEX.caravanRoof]),
  walls: Object.freeze([TEX.roomSide, TEX.roomFront, TEX.roomRear]),
  floor: Object.freeze([TEX.roomFloor]),
  ceiling: Object.freeze([TEX.roomCeiling]),
  timberFloor: Object.freeze([TEX.floor]), timberInner: Object.freeze([TEX.inner]), timberBeam: Object.freeze([TEX.beam]),
  timberBench: Object.freeze([TEX.bench]), wheels: Object.freeze([TEX.tyre, TEX.wheel]),
});
/** WAGON-TIMBER: each wooden part's item field (systems/wagonTimber.js TIMBER_PARTS) against the LIST NAME that chooses
 *  it here - `floor` the part against `floor` the caravan's paint is the collision this table steps around. */
export const TIMBER_LISTS = Object.freeze({
  floor: 'timberFloor', inner: 'timberInner', beam: 'timberBeam', bench: 'timberBench', wheels: 'wheels',
});
/** The record `rec` wears under choice `i`. */
export const lookRecord = (rec, i) => rec + LOOK_RECORD_STRIDE * (Number.isInteger(i) && i > 0 ? i : 0);

/** The bed's floorboards: pine, worn pale where the load is dragged, laid along the wagon (u fore and aft). */
function floorArt() {
  const img = picture(S, S), n = noise(0xa01, S, S, 8, 8);
  planks(img, { ph: 8, seed: 0xa02, base: (x, y) => mix(mix(C.pine, C.pineGrey, 0.4), K.weather, 0.3 * n(x, y)), tone: 0.1, grain: 0.14, trenail: K.nail });
  return img;
}
/** The sideboards outside: oak gone grey with weather, three boards a tile up its 1.6 m, nailed to a stake at each
 *  end of the tile, iron straps over the stakes. WAGONS2: `paint` a PAINTS colour laid over the boards, worn through
 *  to the oak where the weather has had it (null: the oak as built). */
function sideArt(paint = null) {
  const img = picture(S, S), n = noise(0xa11, S, S, 8, 8);
  const board = (x, y) => mix(K.board, K.weather, 0.35 + 0.3 * n(x, y));
  planks(img, { ph: 11, lenMin: 64, lenMax: 64, seed: 0xa12, base: paint ? (x, y) => mix(mix(paint[0], paint[1], 0.4 * n(x, y)), board(x, y), 0.18 * n(x, y)) : board, tone: 0.12, grain: paint ? 0.08 : 0.16 });
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

/** WAGONS3: the harness's leather - traces and reins, laid round each strap (u) and along it (v): a tanned brown, darker
 *  at its edges where it folds, a stitched seam down it and the wear of the road. */
function harnessArt() {
  const img = picture(S, S), n = noise(0xa71, S, S, 4, 16);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const edge = Math.min(x, S - 1 - x) < 6 ? 0.72 : 1;
    let c = shade(mix([92, 58, 32], [128, 84, 48], 0.55 * n(x, y)), edge);
    if ((x === 20 || x === 43) && y % 6 < 3) c = [176, 150, 108];   // the stitching
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

/** A wheel's iron tyre round its tread: the iron, a rivet every so often, the road's dust on it.
 *  WAGON-TIMBER: `finish` a WHEEL_FINISHES row - the tread's dust the finish's own, its rust flecked over the iron
 *  (null: the wheel as painted, byte for byte). */
export function tyreArt(finish = null) {
  const F = finish ?? WHEEL_FINISHES.oak;
  const img = ironArt();
  const n = noise(0xa51, S, S, 8, 8);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) put(img, x, y, mix(get(img, x, y), F.dust, 0.25 * n(x, y)));
  for (let x = 4; x < S; x += 16) for (const y of [8, 40]) { put(img, x, y, F.ironLit); put(img, x + 1, y, F.iron); }
  if (finish) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (n(x, y) > 0.94) put(img, x, y, F.rust);   // the iron's age, in its own red
  return img;
}

/** A wheel's face, laid whole on it (world/wagonModels.js wheelUv: the picture's centre the hub's): its felloes round a
 *  rim, seven spokes (Mac's wheels have seven sides) from a turned hub with an iron hoop and its linchpin. */
/** WAGON-TIMBER: `finish` a WHEEL_FINISHES row - the wheel turned and fitted in it (null: as painted). */
export function wheelArt(finish = null) {
  const F = finish ?? WHEEL_FINISHES.oak;
  const img = picture(S, S), n = noise(0xa61, S, S, 8, 8);
  const c = (S - 1) / 2;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x - c, dy = y - c, r = Math.hypot(dx, dy) / c, a = Math.atan2(dy, dx);
    let col;
    if (r > 0.86) col = mix(F.iron, F.ironLit, 0.4 * n(x, y));                       // the tyre's edge
    else if (r > 0.66) col = mix(F.felloe, F.oakDark, ((Math.floor(((a + Math.PI) / (2 * Math.PI)) * 7) % 2) ? 0.25 : 0) + 0.2 * n(x, y));   // the felloes, each its own tone
    else if (r > 0.3) {
      const k = (((a + Math.PI) / (2 * Math.PI)) * 7) % 1;                            // where between two spokes
      const w = 0.09 + 0.05 * (1 - r);                                               // the spoke, thicker at the hub
      col = k < w || k > 1 - w ? mix(F.spoke, F.oakLit, 0.3 * n(x, y)) : shade(mix(F.oakDark, F.tar, 0.5), 0.7);   // between them, the shadow inside the wheel
    } else if (r > 0.22) col = mix(F.iron, F.ironLit, 0.5);                           // the hub's iron hoop
    else if (r > 0.08) col = mix(F.hub, F.oak, 0.5 * n(x, y));                         // the hub
    else col = F.black;                                                                // the axle's end and its pin
    put(img, x, y, col);
  }
  return img;
}

/** The open wagon's side, its height from its foot (row 63) to the tilt's eaves (row 0): its box of three boards to a
 *  rail at OPEN_RAIL_Y, and over it the tilt's canvas, weathered down from its eaves, a hoop's shadow at each tile's end
 *  (the hoops 1.3 m apart - WAGON_TILE.openSide) and the tilt's cord laced to the rail. */
function openSideTile(dye = null) {
  const img = picture(S, S), n = noise(0xa71, S, S, 8, 8);
  const rail = sideRow(OPEN_RAIL_Y);
  const [cloth, dirt] = dye ?? [C.canvas, C.canvasDirt];   // WAGONS2: the tilt dyed (DYES; null the cream it was built in)
  for (let y = 0; y < rail; y++) for (let x = 0; x < S; x++) {
    let c = mix(cloth, dirt, 0.2 + 0.25 * n(x, y) + 0.3 * (y / rail));
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
/** WAGON-EMBLEM: the open wagon's side whole - FOUR tiles of its canvas side by side (SIDE_CELLS of SIDE_TILE_M),
 *  so the face's u runs once over all four and the arms stand on one cell of it. The tile repeats byte-identical
 *  (the texture's own REPEAT stood the same seams every 1.3 m), so the wide picture reads as the same boards. */
function openSideArt(dye = null) {
  const tile = openSideTile(dye), W = S * SIDE_CELLS;
  const img = picture(W, S);
  for (let t = 0; t < SIDE_CELLS; t++)
    for (let y = 0; y < S; y++) img.data.set(tile.data.subarray(y * S * 4, (y + 1) * S * 4), (y * W + t * S) * 4);
  return img;
}

/** The tilt over the open wagon's roof: canvas, its cloths' seams across it, a hoop's shadow each 1.3 m (u along it). */
function tiltArt(inside = false, dye = null) {
  const img = picture(S, S), n = noise(inside ? 0xa82 : 0xa81, S, S, 8, 8);
  const [cloth, dirt, seam] = dye ?? [C.canvas, C.canvasDirt, C.canvasSeam];   // WAGONS2: dyed as its side is
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let c = mix(cloth, dirt, 0.2 + 0.3 * n(x, y));
    if (y % 16 === 0) c = seam;                             // the cloths
    if (x === 0 || x === 1) c = inside ? mix(C.oak, C.oakDark, 0.5) : shade(c, 0.8);   // the hoop: its wood seen inside, its shadow out
    if (inside) c = shade(c, 0.62);                         // the light through it, from inside
    put(img, x, y, c);
  }
  return img;
}

/** The caravan's side: its height from its foot (row 63) to its eaves (row 0), one window to a tile (2.9 m along it):
 *  an oxblood skirt with a gilt line over it, bottle-green boards, a shuttered window with a gilt frame, and a carved
 *  oxblood cornice under the eaves. WAGONS2: `paint` the body's colours (PAINTS - green as built, `name` its paint for
 *  the trim it takes), and the window's GLASS a hole (alpha 0 - `glass`): the room inside is seen through it. */
function caravanSideArt(paint = PAINTS.green, name = 'green') {
  const img = picture(S, S), n = noise(0xa91, S, S, 8, 8);
  const [body, bodyLit, bodyDark] = paint, [trim, trimLit] = trimFor(name);
  const skirt = sideRow(CARAVAN_SKIRT_Y), cornice = sideRow(CARAVAN_CORNICE_Y);
  planks(img, { y0: 0, y1: S, ph: 6, lenMin: 64, lenMax: 64, seed: 0xa92, base: (x, y) => mix(body, bodyLit, 0.35 * n(x, y)), seamCol: bodyDark, tone: 0.06, grain: 0.06 });
  band(img, skirt + 1, S, trim, 0xa93, 0.06);
  line(img, skirt, C.gilt); line(img, skirt + 1, C.giltDark);
  band(img, 0, cornice, trim, 0xa94, 0.05);
  line(img, cornice, C.gilt);
  for (let x = 0; x < S; x += 4) put(img, x + 1, cornice - 2, C.giltLit);   // the cornice's carving, picked out
  // the window: its glass behind a gilt frame, a shutter folded back each side
  const { y0: wy0, y1: wy1, x0: wx0, x1: wx1 } = CARAVAN_SIDE_WINDOW;
  for (let y = wy0; y <= wy1; y++) for (let x = wx0; x <= wx1; x++) {
    const edge = y === wy0 || y === wy1 || x === wx0 || x === wx1;
    const bar = x === ((wx0 + wx1) >> 1) || y === ((wy0 + wy1) >> 1);
    if (edge || bar) put(img, x, y, edge ? C.gilt : C.lead);
    else glass(img, x, y, mix(C.glass, C.glassLit, ((x - wx0) + (wy1 - y)) / ((wx1 - wx0) + (wy1 - wy0)) * 0.7));
  }
  for (const [x0, x1] of [[wx0 - 9, wx0 - 1], [wx1 + 1, wx1 + 9]]) for (let y = wy0; y <= wy1; y++) for (let x = x0; x <= x1; x++) {
    put(img, x, y, (x === x0 || x === x1 || y === wy0 || y === wy1) ? trimLit : (y - wy0) % 4 === 0 ? bodyDark : mix(bodyLit, body, 0.4));
  }
  return img;
}

/** The caravan side's two gilt lines (m over the ground): its skirt's head and its cornice's foot. */
export const CARAVAN_SKIRT_Y = 1.32, CARAVAN_CORNICE_Y = 2.86;
/** The caravan's side window, in its side's picture (and its room's - the two meet): rows top to bottom, columns.
 *  WAGON-UV (2026-10-10, from play: "the windows on the wagon arent centered properly"): its 0.84 m centred between
 *  the skirt and the cornice - it stood at 1.78-2.62 m, six rows under the cornice and thirteen over the skirt. */
export const CARAVAN_SIDE_WINDOW = Object.freeze({
  y0: sideRow((CARAVAN_SKIRT_Y + CARAVAN_CORNICE_Y + 0.84) / 2), y1: sideRow((CARAVAN_SKIRT_Y + CARAVAN_CORNICE_Y - 0.84) / 2), x0: 22, x1: 42,
});
/** The side window's middle across its picture (u: texel x spans x/64 to (x+1)/64) - where world/wagonModels.js
 *  caravanSideU stands each window's middle on the side. */
export const CARAVAN_SIDE_WINDOW_U = (CARAVAN_SIDE_WINDOW.x0 + CARAVAN_SIDE_WINDOW.x1 + 1) / 2 / S;
/** An end's row for a height (the end runs 0.94 - row 63 - to 3.52 - row 0; world/wagonModels.js endUv lays it so). */
export const endRow = (y) => Math.max(0, Math.min(S - 1, Math.round(((3.52 - y) / (3.52 - 0.94)) * (S - 1))));
/** The front's round window, in the front end's picture (and its room's): its centre and radius (texels). */
export const CARAVAN_FRONT_WINDOW = Object.freeze({ cx: (S - 1) / 2, cy: endRow(2.55), r: 6.5, glassR: 5.4 });
/** The rear's door, in the rear end's picture (and its room's): rows top to bottom, columns. */
export const CARAVAN_DOOR = Object.freeze({ y0: endRow(2.9), y1: endRow(0.98), x0: Math.round((S - 1) / 2 - 10), x1: Math.round((S - 1) / 2 + 10) });

/** One of the caravan's ends, laid whole on it (x across it, its foot to its gable's peak up it - world/wagonModels.js
 *  endUv): boards to the eaves, the gable over them with a gilt sunburst, and either the front's round window or the
 *  rear's DOOR - planked oak in a gilt-edged frame, its iron hinges and ring, a lantern beside it. WAGONS2: painted as
 *  its sides are, and the round window's glass a hole. */
function caravanEndArt(door, paint = PAINTS.green, name = 'green') {
  const img = picture(S, S), n = noise(door ? 0xab1 : 0xaa1, S, S, 8, 8);
  const [body, bodyLit, bodyDark] = paint, [trim, trimLit] = trimFor(name);
  planks(img, { ph: 5, lenMin: 64, lenMax: 64, seed: door ? 0xab2 : 0xaa2, base: (x, y) => mix(body, bodyLit, 0.35 * n(x, y)), seamCol: bodyDark, tone: 0.05, grain: 0.05 });
  // rows: the end runs 0.94 (row 63) to 3.52 (row 0); its eaves at 3.06, its skirt's head at 1.32
  const eaves = endRow(3.06), skirt = endRow(1.32);
  band(img, skirt + 1, S, trim, 0xaa3, 0.06); line(img, skirt, C.gilt);
  line(img, eaves, C.gilt); line(img, eaves - 1, trimLit);
  // the gable's sunburst: gilt rays from the middle of the eaves
  const cx = (S - 1) / 2;
  for (let y = 0; y < eaves - 1; y++) for (let x = 0; x < S; x++) {
    const a = Math.atan2(eaves - y, x - cx), r = Math.hypot(x - cx, eaves - y);
    if (r < 4) put(img, x, y, C.giltLit);
    else if (r < 14 && Math.floor((a / Math.PI) * 12) % 2 === 0) put(img, x, y, mix(C.gilt, C.giltDark, r / 14));
  }
  if (!door) {
    // the front's round window, high in the end over the driver's head
    const { cy: wy, r: wr, glassR } = CARAVAN_FRONT_WINDOW;
    for (let y = wy - 7; y <= wy + 7; y++) for (let x = Math.round(cx) - 7; x <= Math.round(cx) + 7; x++) {
      const r = Math.hypot(x - cx, y - wy);
      if (r > wr) continue;
      if (r > glassR) put(img, x, y, C.gilt);
      else if (Math.abs(x - cx) < 0.6 || Math.abs(y - wy) < 0.6) put(img, x, y, C.lead);
      else glass(img, x, y, mix(C.glassLit, C.glass, r / 6));
    }
    return img;
  }
  // the rear's door: 0.86 m wide by 1.95 m, from its sill on the floor
  const { y0: dy0, y1: dy1, x0: dx0, x1: dx1 } = CARAVAN_DOOR;
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

/** The caravan's roof: painted boards along it, the green gone dark with weather, a lighter board at each seam.
 *  WAGONS2: its body's paint, gone dark the same way. */
function caravanRoofArt(paint = null) {
  const img = picture(S, S), n = noise(0xac1, S, S, 8, 8);
  const [roof, roofLit] = paint ? [mix(paint[0], C.tar, 0.4), mix(paint[1], C.tar, 0.3)] : [K.roof, K.roofLit];
  planks(img, { ph: 8, seed: 0xac2, base: (x, y) => mix(roof, roofLit, 0.4 * n(x, y)), seamCol: C.tar, tone: 0.08, grain: 0.08 });
  return img;
}

// ── WAGONS2: the caravan's room (world/caravanRoomModel.js lays them) ───────────────────────────────────

/** A wall's boards under a paint: oak (natural) or a PAINTS colour, a wainscot of dark oak to the skirt's height with
 *  a rail over it - the room's own side of the caravan's skirt line. */
function roomBoards(img, wall, seed, rows) {
  const n = noise(seed, S, S, 8, 8);
  const paint = PAINTS[wall];
  const base = paint ? (x, y) => mix(paint[0], paint[1], 0.3 * n(x, y)) : (x, y) => mix(C.oak, C.oakLit, 0.45 * n(x, y));
  planks(img, { ph: 6, lenMin: 64, lenMax: 64, seed: seed + 1, base, seamCol: paint ? paint[2] : C.seam, tone: 0.05, grain: paint ? 0.04 : 0.1 });
  const rail = rows(1.32);
  planks(img, { y0: rail + 1, y1: S, ph: 5, lenMin: 64, lenMax: 64, seed: seed + 2, base: (x, y) => mix(C.oakDark, C.oak, 0.4 * n(x, y)), tone: 0.06, grain: 0.1 });
  line(img, rail, C.oakLit); line(img, rail - 1, C.oakDark);
}
/** The curtains a window is hung with inside: a colour beside the walls'. */
const curtainOf = (wall) => (wall === 'oxblood' || wall === 'ochre' ? K.green : wall === 'blue' ? C.gilt : C.oxblood);

/** The room's side wall, on the caravan's side's own heights and tile (BANDS.roomSide): the boards, and the window
 *  where the side's own is (CARAVAN_SIDE_WINDOW) - an oak frame, its lead, its glass a hole, a curtain drawn back
 *  each side. */
function roomSideArt(wall = 'green') {
  const img = picture(S, S);
  roomBoards(img, wall, 0xb01, sideRow);
  const { y0: wy0, y1: wy1, x0: wx0, x1: wx1 } = CARAVAN_SIDE_WINDOW;
  for (let y = wy0; y <= wy1; y++) for (let x = wx0; x <= wx1; x++) {
    const edge = y === wy0 || y === wy1 || x === wx0 || x === wx1;
    const bar = x === ((wx0 + wx1) >> 1) || y === ((wy0 + wy1) >> 1);
    if (edge || bar) put(img, x, y, edge ? C.oakLit : C.lead);
    else glass(img, x, y, mix(C.glass, C.glassLit, 0.4));
  }
  const cur = curtainOf(wall);
  for (const [x0, x1] of [[wx0 - 6, wx0 - 1], [wx1 + 1, wx1 + 6]]) for (let y = wy0 - 2; y <= wy1 + 3; y++) for (let x = x0; x <= x1; x++) {
    put(img, x, y, shade(cur, (x - x0) % 2 ? 0.82 : 1));   // its folds
  }
  line(img, wy0 - 3, C.iron, wx0 - 7, wx1 + 8);   // the curtain's rod
  return img;
}

/** One of the room's ends, laid whole as the caravan's are (endUv - so its round window or its door meets the end's
 *  own): the boards, and the front's round window with its glass a hole, or the rear door's inside - its planks, its
 *  frame, its latch and its hinges. */
function roomEndArt(door, wall = 'green') {
  const img = picture(S, S);
  roomBoards(img, wall, door ? 0xb21 : 0xb11, endRow);
  const cx = (S - 1) / 2;
  if (!door) {
    const { cy: wy, r: wr, glassR } = CARAVAN_FRONT_WINDOW;
    for (let y = wy - 7; y <= wy + 7; y++) for (let x = Math.round(cx) - 7; x <= Math.round(cx) + 7; x++) {
      const r = Math.hypot(x - cx, y - wy);
      if (r > wr) continue;
      if (r > glassR) put(img, x, y, C.oakLit);
      else if (Math.abs(x - cx) < 0.6 || Math.abs(y - wy) < 0.6) put(img, x, y, C.lead);
      else glass(img, x, y, mix(C.glassLit, C.glass, 0.5));
    }
    return img;
  }
  const { y0: dy0, y1: dy1, x0: dx0, x1: dx1 } = CARAVAN_DOOR;
  const grain = noise(0xb23, S, S, 16, 4);
  for (let y = dy0; y <= dy1; y++) for (let x = dx0; x <= dx1; x++) {
    put(img, x, y, mix(C.oak, C.oakDark, 0.25 + 0.4 * grain(x, y)));
    if ((x - dx0) % 5 === 0) put(img, x, y, C.seam);
    if (y === dy0 || y === dy1 || x === dx0 || x === dx1) put(img, x, y, C.oakDark);
  }
  for (const by of [dy0 + 8, dy1 - 8]) line(img, by, C.oakDark, dx0 + 1, dx1);   // the ledges across its boards
  const ry = (dy0 + dy1) >> 1;
  for (let x = dx0 + 2; x <= dx0 + 6; x++) put(img, x, ry, C.ironLit);   // the latch, on the hinge's far side from outside
  put(img, dx0 + 2, ry - 1, C.iron); put(img, dx0 + 2, ry + 1, C.iron);
  for (const hy of [dy0 + 6, dy1 - 6]) line(img, hy, C.iron, dx1 - 9, dx1);   // the hinges' straps, seen from inside
  return img;
}

/** The room's ceiling, under the caravan's rounded roof (tiled along it): painted boards as built, whitewash, a night
 *  sky of stars, or boards in a colour. */
function roomCeilingArt(ceiling = 'boards') {
  const img = picture(S, S), n = noise(0xb31, S, S, 8, 8);
  if (ceiling === 'night') {
    const r = mulberry32(0xb32);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) put(img, x, y, mix([18, 24, 52], [30, 38, 76], 0.5 * n(x, y)));
    for (let k = 0; k < 40; k++) { const x = Math.floor(r() * S), y = Math.floor(r() * S); put(img, x, y, r() < 0.2 ? C.giltLit : [220, 222, 236]); }
    return img;
  }
  const paint = ceiling === 'boards' ? [K.roof, K.roofLit, C.tar] : ceiling === 'oak' ? [C.oak, C.oakLit, C.seam] : PAINTS[ceiling] ?? [K.roof, K.roofLit, C.tar];
  planks(img, { ph: 8, seed: 0xb33, base: (x, y) => mix(paint[0], paint[1], 0.35 * n(x, y)), seamCol: paint[2], tone: 0.05, grain: 0.05 });
  for (let x = 0; x < S; x += 32) column(img, x, C.oakDark);   // the roof's ribs across it
  return img;
}

/** The room's floor (tiled along it): pine boards as built, oak, dark boards, a red or a blue rug, or chequered tiles. */
function roomFloorArt(floor = 'pine') {
  const img = picture(S, S), n = noise(0xb41, S, S, 8, 8);
  if (floor === 'redRug' || floor === 'blueRug') {
    const [a, b] = floor === 'redRug' ? [[128, 36, 30], [176, 132, 64]] : [[38, 52, 96], [196, 170, 110]];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const d = Math.max(Math.abs(x - 31.5), Math.abs(y - 31.5));
      let c = mix(a, shade(a, 0.8), 0.4 * n(x, y));
      if (d > 28 || (d > 13 && d < 16) || ((x + y) % 16 === 0 && d < 13) || ((x - y + 64) % 16 === 0 && d < 13)) c = mix(b, a, 0.25 * n(x, y));   // its border and its lozenges
      put(img, x, y, c);
    }
    return img;
  }
  if (floor === 'checker') {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) put(img, x, y, (((x >> 4) + (y >> 4)) % 2 ? mix([40, 36, 34], [58, 52, 48], n(x, y)) : mix([200, 190, 166], [220, 212, 190], n(x, y))));
    return img;
  }
  const wood = floor === 'oak' ? [C.oak, C.oakLit] : floor === 'dark' ? [[60, 44, 30], [80, 60, 40]] : [C.pine, C.pineGrey];
  planks(img, { ph: 8, seed: 0xb42, base: (x, y) => mix(wood[0], wood[1], 0.4 * n(x, y)), tone: 0.08, grain: 0.12, trenail: K.nail });
  return img;
}

/** Every picture the wagons wear: `[record, picture]`, in record order - each 64 x 64. */
export function wagonArt() {
  const painters = {
    floor: floorArt, side: sideArt, inner: innerArt, beam: beamArt, bench: benchArt, tyre: tyreArt, wheel: wheelArt, iron: ironArt,
    openSide: openSideArt, tilt: () => tiltArt(false), tiltInner: () => tiltArt(true),
    caravanSide: () => caravanSideArt(), caravanFront: () => caravanEndArt(false), caravanRear: () => caravanEndArt(true), caravanRoof: () => caravanRoofArt(),
    roomSide: () => roomSideArt(), roomFront: () => roomEndArt(false), roomRear: () => roomEndArt(true), roomCeiling: () => roomCeilingArt(), roomFloor: () => roomFloorArt(),
    harness: harnessArt,
  };
  return Object.entries(TEX).map(([key, rec]) => /** @type {[number, any]} */ ([rec, painters[key]()])).sort((a, b) => a[0] - b[0]);
}

/**
/**
 * WAGON-TIMBER: the dyes a wooden part may wear, by name (systems/wagonTimber.js TIMBER_LOOKS), in the horse coat
 * dye's own shape (`hue` degrees or null for the art's own; `sat` ['mul', k] or ['abs', s]; `val` [lift, scale]) -
 * the same `dyeInto` does the work for both animals, which is why a wagon's boards shift hue rather than take a hex
 * stamp. Tuned by eye against the four painted woods' own light: `oak` is the identity (choice 0, which the law never
 * asks for - a built record wears its own), the rest spaced in hue and lightness so the four parts read as four
 * timbers rather than four tints of one: pine pale, walnut dark, mahogany red, ebony near black, ash the grey-blond of
 * weathered boards. A dye runs over EVERY texel of the record, so the saturation is absolute rather than relative
 * wherever the wood is pale enough that its own is nearly nothing.
 */
export const WOOD_DYES = Object.freeze({
  oak: Object.freeze({ hue: null, sat: Object.freeze(['mul', 1]), val: Object.freeze([0, 1]) }),
  pine: Object.freeze({ hue: 40, sat: Object.freeze(['abs', 0.34]), val: Object.freeze([0.16, 1.0]) }),
  walnut: Object.freeze({ hue: 20, sat: Object.freeze(['abs', 0.5]), val: Object.freeze([0, 0.68]) }),
  mahogany: Object.freeze({ hue: 8, sat: Object.freeze(['abs', 0.55]), val: Object.freeze([0, 0.78]) }),
  ebony: Object.freeze({ hue: 12, sat: Object.freeze(['abs', 0.3]), val: Object.freeze([0, 0.36]) }),
  ash: Object.freeze({ hue: 34, sat: Object.freeze(['abs', 0.14]), val: Object.freeze([0.26, 0.95]) }),
});
/** WAGON-TIMBER PASS 3 (2026-10-16, operator: the cart's paint reads flat beside the timber's grain): THE CART'S
 *  PAINTS AS DYES, in WOOD_DYES' own shape - the cart's boards keep the painted grain with the colour on it, where a
 *  flat swatch would lay a coloured plane over them. Tuned by eye against what the swatches read as: each hue at its
 *  family's (red near mahogany's, blue and green mid, black warm-dark like ebony, white a warm lift), every saturation
 *  absolute so the pale grain stays paler than the flank, the value scaled under the raw boards for the paints and
 *  lifted for the whitewash - the grain's own light still its own light.
 *  `oak` is the identity (choice 0, which the law never asks for) and the unknown-name fallback. */
export const CART_DYES = Object.freeze({
  oak: Object.freeze({ hue: null, sat: Object.freeze(['mul', 1]), val: Object.freeze([0, 1]) }),
  red: Object.freeze({ hue: 2, sat: Object.freeze(['abs', 0.55]), val: Object.freeze([0.03, 0.9]) }),
  blue: Object.freeze({ hue: 214, sat: Object.freeze(['abs', 0.5]), val: Object.freeze([0.03, 0.88]) }),
  green: Object.freeze({ hue: 132, sat: Object.freeze(['abs', 0.45]), val: Object.freeze([0.03, 0.85]) }),
  black: Object.freeze({ hue: 20, sat: Object.freeze(['abs', 0.15]), val: Object.freeze([0, 0.32]) }),
  white: Object.freeze({ hue: 45, sat: Object.freeze(['abs', 0.07]), val: Object.freeze([0.55, 0.9]) }),
});
/**
 * WAGON-TIMBER: THE FINISHES, one a name in systems/wagonTimber.js WHEEL_LOOKS and the first the wheel as painted.
 * Each row is a WHOLE row of RGB triples - the same keys the wheel painters read - and `oak` is the fleet's own
 * colours (C, K), so the wheel that shipped is one table row and not a second copy of it that could drift. The hues
 * say how: `oak`, `walnut` and `ebony` the couple of different browns (felloe at hue 29, 24 and 25 degrees), `ash` the
 * weathered blond at 38, `mahogany` the reddish one at 14 with its saturation 0.70, `silvered` the grey - hue 43,
 * saturation 0.06, the colour nearly gone out of the timber. `iron` and `ironLit` are the same in all six: a rim is
 * iron. `black` is each row's own `tar` carried down - the built row's own relationship. `rust` is the iron's own,
 * deeper and redder as the iron it sits in grows old; `dust` the road's on a wheel of that timber.
 */
export const WHEEL_FINISHES = Object.freeze({
  oak: Object.freeze({
    iron: C.iron, ironLit: C.ironLit, rust: C.rust,
    oak: C.oak, oakDark: C.oakDark, oakLit: C.oakLit, tar: C.tar, black: C.black,
    hub: K.hub, felloe: K.felloe, spoke: K.spoke,
    dust: Object.freeze([120, 108, 88]),
  }),
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
/** A picture dyed whole - `dye` over every texel, the horse coat dye's own arithmetic (systems/horse/horseCoats.js
 *  dyeEveryTexel), the old bytes untouched. WAGON-TIMBER: the timber's and the cart's door into a painted picture. */
const dyedPic = (pic, dye) => ({ width: pic.width, height: pic.height, data: dyeEveryTexel(pic.data, pic.data.slice(), dye) });

/**
 * WAGONS2: THE PICTURES A PAINT WEARS - `[record, picture]` for a list's `i`th choice (systems/wagon/wagonLooks.js): `list`
 * a kind (its outside) or one of the caravan's inside parts ('walls', 'floor', 'ceiling'), `name` the choice's name.
 * The built choice (0) wears the built records (wagonArt) and paints none here.
 *
 * WAGON-TIMBER: the five lists of TIMBER_LISTS answer here too, and by the same two rules - choice 0 names nothing
 * (the built record is its own), and a choice gets its records a stride apart. `timberFloor`/`timberInner`/
 * `timberBeam`/`timberBench` each dye their ONE base picture (WOOD_DYES over the painter's own); `wheels` takes its
 * TWO (the tread and the face) from WHEEL_FINISHES' one finish. Neither family touches the other's records, which is
 * what "the wheel options separate from the wood options" means in a picture table.
 *
 * WAGON-EMBLEM: `arms` a resolved heraldry (or null) - the open wagon's side wears it over one cell of its four
 * (openSideArms); null leaves the boards bare. A paint is not a guild: the arms sit over whatever cloth the choice
 * chose, and the tilt and its inner face stay bare records.
 */
export function wagonLookArt(list, i, name, arms = null) {
  if (!(Number.isInteger(i) && i > 0) || !LOOK_RECORDS[list]) return [];
  const r = (rec) => lookRecord(rec, i);
  if (list === 'cart') { const pic = dyedPic(sideArt(null), CART_DYES[name] ?? CART_DYES.oak); return [[r(TEX.side), pic]]; }
  if (list === 'openWagon') {
    const d = DYES[name] ?? null;
    const side = arms ? openSideArms(d, arms) : openSideArt(d);
    return [[r(TEX.openSide), side], [r(TEX.tilt), tiltArt(false, d)], [r(TEX.tiltInner), tiltArt(true, d)]];
  }
  if (list === 'caravan') {
    const p = PAINTS[name] ?? PAINTS.green;
    return [[r(TEX.caravanSide), caravanSideArt(p, name)], [r(TEX.caravanFront), caravanEndArt(false, p, name)], [r(TEX.caravanRear), caravanEndArt(true, p, name)], [r(TEX.caravanRoof), caravanRoofArt(p)]];
  }
  if (list === 'walls') return [[r(TEX.roomSide), roomSideArt(name)], [r(TEX.roomFront), roomEndArt(false, name)], [r(TEX.roomRear), roomEndArt(true, name)]];
  if (list === 'floor') return [[r(TEX.roomFloor), roomFloorArt(name)]];
  if (list === 'ceiling') return [[r(TEX.roomCeiling), roomCeilingArt(name)]];
  if (list === 'timberFloor') return [[r(TEX.floor), dyedPic(floorArt(), WOOD_DYES[name] ?? WOOD_DYES.oak)]];
  if (list === 'timberInner') return [[r(TEX.inner), dyedPic(innerArt(), WOOD_DYES[name] ?? WOOD_DYES.oak)]];
  if (list === 'timberBeam') return [[r(TEX.beam), dyedPic(beamArt(), WOOD_DYES[name] ?? WOOD_DYES.oak)]];
  if (list === 'timberBench') return [[r(TEX.bench), dyedPic(benchArt(), WOOD_DYES[name] ?? WOOD_DYES.oak)]];
  if (list === 'wheels') { const f = WHEEL_FINISHES[name] ?? WHEEL_FINISHES.oak; return [[r(TEX.tyre), tyreArt(f)], [r(TEX.wheel), wheelArt(f)]]; }
  return [];
}
/**
 * WAGON-EMBLEM: the open wagon's side with guild arms - the painted side, four cells wide, with `arms` stamped over
 * its second cell (world/wagonEmblem.js paintWagonEmblem: the shield, a metre across one 1.3 m cell). `dye` the tilt's
 * canvas (as openSideArt takes it); null the built boards. The arms are paint on cloth, never a hole: the picture
 * uploads opaque like every other side.
 */
export function openSideArms(dye, arms) {
  const pic = openSideArt(dye);
  paintWagonEmblem(pic, SIDE_TILE_M, SIDE_Y1 - SIDE_Y0, EMBLEM_CELL, S, EMBLEM_M, arms);
  return pic;
}
/** Which of the wagons' pictures have glass in them - uploaded as cut-outs, so the eye sees through their windows
 *  (a built record, or any choice's - LOOK_RECORD_STRIDE apart). */
export const isGlassRecord = (rec) => /** @type {number[]} */ ([TEX.caravanSide, TEX.caravanFront, TEX.roomSide, TEX.roomFront]).includes(rec % LOOK_RECORD_STRIDE);
