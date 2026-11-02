// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WW-C2 (2026-10-24, bible/03-World/World-Wide.md WW-C, bible/11-Multiplayer/Wild-Zone.md) - CYRODIIL, THE OPEN ZONE.
//
// The owner: "Cyrodil becomes the new open PvP area with the wrothgarian mountain area being retired in favor of this.
// Cryodil will be home to all abundent resources and everything else from the wrothgarian zone."
//
// THE ZONE IS THE PROVINCE, WHOLE: every map pixel the world's grid puts in the Imperial Province (world/worldWide/
// worldGrid.js theatreAt - theatre 9, the picker's own numbering) - no cut, no town kept out. Its mask is laid on a grid
// of CYRODIIL_CELL_PX-pixel cells (systems/wild/wildZone.js buildWildMask), the cells on one lattice over the world, each
// keeping its pixels (ZONE-LINE, below); a cell is inside, for the rings, the halls and the giants, where its middle pixel
// is. The province's border is the player's own traced picture (world/tamriel/tamrielLand.js), a picture unit some fifteen
// to eighteen map pixels - and every client with the same files cuts the same zone, its rings and its halls with it.
//
// ZONE-LINE (2026-10-26, the owner: "Also ensure the pvp border outlines cyrodil perfectly, currently it doesnt"): THE
// ZONE IS THE PROVINCE TO THE PIXEL. A cell had stood whole where its middle pixel stood, so the zone's edge was a 3.3 km
// staircase about the province's own (9,012 map pixels of the two apart on the freeware's picture, 4,078 of the zone's
// outside the province and 4,934 of the province's outside the zone), its red line that staircase smoothed, and the
// province's own line on the held map the picture's smoothed another way (up to 12 pixels off it at a corner). Now a map
// pixel is the zone's exactly when theatreAt puts it in the province, or it lies in water the province encloses
// (wildZone.js buildWildMask's `bits`: the cells a pre-test where they are whole) - 0 pixels apart - and the one line
// every map draws for the zone and for the province is the province's own outline on the traced picture (zoneLineOf): a
// map pixel is the zone's exactly when its middle lies inside it.
//
// KEPT WHILE THE PICTURE STANDS: the mask is built at the first ask and kept while the trace and the fit stand
// (tamrielLandVersion, tamrielFit); either moved, the next ask builds it again.
//
// ONLINE, THE TRACE'S ALONE (AUDIT TESA II Z8): with no trace installed the province is the authored rings' - 56% of the
// two shapes' union theirs alone on the freeware's picture - so a client whose trace had not landed yet (the boot's first
// frames), never asked for one (`?tamrieltrace=off`) or never got one (a file missing) cut another zone than everyone
// else's, its halls, rings, fees and fights with it. Online there is no zone until the trace lands, and none where it
// never does: such a client never says it stands in the zone, so the referee (net/wild/wildRef.js: a blow lands only
// where both fighters said so) keeps it out of every fight and nobody out of theirs. Offline (the maps' paint, the pins)
// the authored shape still stands in for a missing trace.
// ═══════════════════════════════════════════════════════════════════
import { buildWildMask, wildInside } from './wildZone.js';
import { lawLines, linkSteps, segKey, drain, squareEnds } from '../../world/tamriel/tamrielLines.js'; // SMOOTH-LAND: the land's own lines
import { theatreAt } from '../../world/worldWide/worldGrid.js';
import {
  IMPERIAL_ID,
  PROVINCE_OF_ID,
  provinceKeyAt,
  tamrielLandVersion,
  tamrielTrace,
} from '../../world/tamriel/tamrielLand.js';
import { isOnlinePage } from '../online/onlineLane.js'; // AUDIT TESA II Z8: online, the traced picture's zone alone
import { tamrielFit, pictureToBay, bayToPicture, PICTURE_W, PICTURE_H } from '../../world/tamriel/tamrielFrame.js';

/** The province's theatre (world/worldWide/worldGrid.js: the Imperial Province, the picker's 9). */
export const CYRODIIL_THEATRE = IMPERIAL_ID;
/** A cell of the zone's mask, map pixels a side. */
export const CYRODIIL_CELL_PX = 4;

/**
 * The province's box in map pixels, off the picture: every picture unit whose middle is the Imperial Province's, widened
 * a unit each way (a sliver of the border under a unit's middle is inside it) - `{ x0, y0, x1, y1 }`, or null where the
 * picture holds no such province.
 */
export function cyrodiilBox() {
  const key = PROVINCE_OF_ID[IMPERIAL_ID];
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (let py = 0; py < PICTURE_H; py++) {
    for (let px = 0; px < PICTURE_W; px++) {
      if (provinceKeyAt(px + 0.5, py + 0.5) !== key) continue;
      if (px < x0) x0 = px;
      if (px > x1) x1 = px;
      if (py < y0) y0 = py;
      if (py > y1) y1 = py;
    }
  }
  if (x1 < x0) return null;
  const [ax, ay] = pictureToBay(x0 - 1, y0 - 1),
    [bx, by] = pictureToBay(x1 + 2, y1 + 2);
  return { x0: Math.floor(ax), y0: Math.floor(ay), x1: Math.ceil(bx), y1: Math.ceil(by) };
}

/** Is world map pixel (x, y) the Imperial Province's? */
export const inCyrodiil = (x, y) => theatreAt(Math.floor(x), Math.floor(y)) === CYRODIIL_THEATRE;

/** NIBEN-SEA: how far (picture units) a water pixel looks along its row and its column for the province's land each side. */
export const PROVINCE_WATER_REACH = 12;
/**
 * NIBEN-SEA (bible/03-World/Tamriel.md NIBEN-SEA; AUDIT TESA II Z4's law, kept): THE PROVINCE'S OWN WATER - a map pixel whose
 * picture pixel is water with the Imperial Province's land the nearest on both its sides, west and east or north and
 * south, within PROVINCE_WATER_REACH. Lake Rumare and the Niben were holes in the picture's land, and the zone took what
 * it enclosed (wildZone.js fillEnclosed); joined to the sea down the Niben (ui/tamrielTrace.js NIBEN_COURSE) they are
 * enclosed no more, and the sea would reach up the river to the Imperial City's isle - the city in The Borderlands, a
 * lake's water nobody's fight. The river's own banks keep them the zone's; its last reach, between Elsweyr's banks, is not.
 * Water by the land's own law (SMOOTH-LAND: provinceKeyAt's null - a sliver of a picture pixel of land past the smooth
 * coast is the water's, a sliver of water inside it the land's), its banks the picture's own pixels - so the Waterfront
 * canal's water (world/tamriel/tamrielLand.js canalAt), a picture pixel of the province's land between its own, is the
 * province's.
 */
export function provinceWaterAt(x, y) {
  const trace = tamrielTrace();
  if (!trace) return false;
  const [qx, qy] = bayToPicture(x + 0.5, y + 0.5);
  if (provinceKeyAt(qx, qy) !== null) return false; // land, by the land's own law (SMOOTH-LAND)
  const px = Math.floor(qx),
    py = Math.floor(qy),
    { w, h, land, province } = trace;
  if (px < 0 || py < 0 || px >= w || py >= h) return false;
  const bank = (dx, dy) => {
    for (let k = 1; k <= PROVINCE_WATER_REACH; k++) {
      const bx = px + dx * k,
        by = py + dy * k;
      if (bx < 0 || by < 0 || bx >= w || by >= h) return false;
      if (land[by * w + bx]) return province[by * w + bx] === IMPERIAL_ID;
    }
    return false;
  };
  return (bank(-1, 0) && bank(1, 0)) || (bank(0, -1) && bank(0, 1));
}

let _mask = /** @type {any} */ (null);
let _key = /** @type {string|null} */ (null);
/**
 * THE ZONE'S MASK - Cyrodiil's, on the cells' lattice over its box (null where the picture holds no Imperial Province -
 * AUDIT TESA II Z8: and online, while no trace is installed). Kept while the picture stands (the trace's version and the
 * fit); built again when either moves.
 */
export function cyrodiilMask() {
  if (isOnlinePage() && !tamrielTrace()) return null; // AUDIT TESA II Z8: no trace, no zone - never the authored rings' online
  const f = tamrielFit();
  const key = `${tamrielLandVersion()}:${f.ox}:${f.oy}:${f.ppu}`;
  if (_key === key) return _mask;
  _key = key;
  const box = cyrodiilBox();
  if (!box) return (_mask = null);
  const cell = CYRODIIL_CELL_PX;
  const ox = Math.floor(box.x0 / cell) * cell,
    oy = Math.floor(box.y0 / cell) * cell; // the world's one lattice
  const width = Math.ceil((box.x1 + 1 - ox) / cell),
    height = Math.ceil((box.y1 + 1 - oy) / cell);
  _mask = buildWildMask({
    width,
    height,
    ox,
    oy,
    cell,
    pixelIn: (x, y) => theatreAt(x, y) === CYRODIIL_THEATRE || provinceWaterAt(x, y),
  }); // ZONE-LINE: the province's own law, a pixel at a time; NIBEN-SEA: and its own water
  const trace = tamrielTrace();
  // ZONE-LINE: the line the maps draw (untraced, the zone's own pixel edge); SMOOTH-LAND: the law's own, made the first
  // time a map asks it (the mask is the boot's; the line the map's)
  const own = _mask;
  Object.defineProperty(own, 'line', {
    enumerable: true,
    configurable: true,
    get: () => (trace ? zoneLineOf(trace, own) : null),
  });
  return _mask;
}

/**
 * ZONE-LINE: CYRODIIL'S OUTLINE - the one line the maps draw for the zone and for the province. SMOOTH-LAND (2026-10-26,
 * bible/03-World/Tamriel.md SMOOTH-LAND): the land's smooth law's own pieces (world/tamriel/tamrielLines.js lawLines)
 * where the zone's pixels (the mask's: the Imperial Province's land and the water it encloses) meet the rest - each piece
 * of a square whose edge the zone changes across, the same crossings, the same points where three labels meet - so a map
 * pixel is the zone's exactly when its middle lies inside `chains`, and the held map's coast and border lines stop on
 * it, not beside it (ui/tamrielInk.js tracedChains: `keys`, the pieces it draws in place of its own). `chains` the whole outline, closed
 * (the red line, the fog's cut, the zone map's ring and wash); `coast` and `borders` its runs by what lies past them - the
 * water the zone does not enclose, or another province's land. Kept while the picture's arrays, the fit and the mask
 * stand; null with no mask.
 * @param {{ w: number, h: number, land: Uint8Array, province: Uint8Array }} trace
 * @param {any} [mask] the zone's (cyrodiilMask's own)
 */
export function zoneLineOf(trace, mask = cyrodiilMask()) {
  if (!mask) return null;
  return drain(zoneLineSteps(trace, mask));
}
/** AUDIT RELEASE R4-7: how many candidate map squares the zone's line asks between two steps. */
export const ZONE_LINE_STEP = 4096;
/**
 * zoneLineOf as steps (AUDIT RELEASE R4-7): a step every ZONE_LINE_STEP candidate squares and in the linking
 * (tamrielLines.js linkSteps) - the same line, kept the same way; ui/tamrielInk.js's idle job walks it a budget at a time.
 * @param {{ w: number, h: number, land: Uint8Array, province: Uint8Array }} trace @param {any} mask
 * @returns {Generator<undefined, any, unknown>}
 */
export function* zoneLineSteps(trace, mask) {
  const f = tamrielFit();
  const key = `${f.ox}:${f.oy}:${f.ppu}`;
  if (_line?.land === trace.land && _line.province === trace.province && _line.mask === mask && _line.key === key)
    return _line.line; // the picture's own arrays (tamrielLand.js setTamrielTrace keeps them)
  const lines = lawLines(trace);
  const inside = (/** @type {number} */ x, /** @type {number} */ y) => wildInside(mask, x, y);
  /** @type {import('../../world/tamriel/tamrielLines.js').Seg[]} */
  const segs = [];
  // the squares the zone's outline can cross: those about every cell of the mask that is neither whole nor empty, or
  // whose neighbour east or south is otherwise - each asked of the law's lines once (its labels and its crossings)
  const { width, height, cell, bits } = mask,
    full = (1 << (cell * cell)) - 1,
    asked = new Set();
  /** NIBEN-SEA: a dam's own crossings (an edge between two pixels of one label - the law has none there): its middle. */
  const own = new Map(),
    points = { get: (/** @type {number} */ id) => own.get(id) ?? lines.points.get(id) };
  /** NIBEN-SEA: A DAM - a square the zone changes across where the law's label does not: its pieces the zone's own
   *  marching case, each edge crossed at the law's crossing where its labels differ and at its middle where they do not
   *  (a saddle's two zone pixels joined), `kind` 'water' - the red line's, never the held map's coast or border. */
  const dam = (/** @type {number} */ bx, /** @type {number} */ by, /** @type {boolean[]} */ [a, b, c, d]) => {
    const { top, right, bottom, left } = squareEnds(bx, by);
    const E = [
      [a !== b, top, bx + 1, by + 0.5, [bx, by, bx + 1, by]],
      [b !== c, right, bx + 1.5, by + 1, [bx + 1, by, bx + 1, by + 1]],
      [d !== c, bottom, bx + 1, by + 1.5, [bx, by + 1, bx + 1, by + 1]],
      [a !== d, left, bx + 0.5, by + 1, [bx, by, bx, by + 1]],
    ];
    for (const [cut, id, x, y] of E)
      if (cut && !lines.points.has(/** @type {number} */ (id)) && !own.has(id)) own.set(id, { x, y });
    const piece = (/** @type {number} */ i, /** @type {number} */ j) =>
      segs.push({
        a: /** @type {number} */ (E[i][1]),
        b: /** @type {number} */ (E[j][1]),
        kind: 'water',
        pair: 0,
        side: /** @type {number[]} */ (E[i][4]),
      });
    const cuts = [0, 1, 2, 3].filter((k) => E[k][0]);
    if (cuts.length === 2) piece(cuts[0], cuts[1]);
    else if (a) {
      piece(0, 1);
      piece(3, 2);
    } // a saddle, a and c the zone's: b's corner and d's cut off
    else {
      piece(0, 3);
      piece(1, 2);
    }
  };
  /** @type {Array<[number, number]>} */
  const cand = [];
  const fill = (/** @type {number} */ cx, /** @type {number} */ cy) =>
    cx < 0 || cy < 0 || cx >= width || cy >= height ? 0 : bits[cy * width + cx];
  for (let cy = -1; cy <= height; cy++) {
    for (let cx = -1; cx <= width; cx++) {
      const v = fill(cx, cy);
      if ((v === 0 || v === full) && fill(cx + 1, cy) === v && fill(cx, cy + 1) === v && fill(cx + 1, cy + 1) === v)
        continue;
      const x0 = mask.ox + cx * cell,
        y0 = mask.oy + cy * cell;
      for (let by = y0; by < y0 + cell; by++)
        for (let bx = x0; bx < x0 + cell; bx++) {
          const k = `${bx},${by}`;
          if (!asked.has(k)) {
            asked.add(k);
            cand.push([bx, by]);
          }
        }
    }
    yield; // a row of cells a step
  }
  for (let n = 0; n < cand.length; n++) {
    if (n % ZONE_LINE_STEP === ZONE_LINE_STEP - 1) yield;
    const [bx, by] = cand[n];
    const ia = inside(bx, by),
      ib = inside(bx + 1, by),
      ic = inside(bx + 1, by + 1),
      id = inside(bx, by + 1);
    if (ia === ib && ia === ic && ia === id) continue;
    const rec = lines.square(bx, by);
    // NIBEN-SEA: the zone changes where the law's label does not - its own water (provinceWaterAt) against the sea's, a
    // river where its banks stop being the province's: the square is the zone's own marching case (`dam`)
    const one = (
      /** @type {number} */ x,
      /** @type {number} */ y,
      /** @type {number} */ qx,
      /** @type {number} */ qy,
    ) => lines.label(x, y) === lines.label(qx, qy);
    if (
      (ia !== ib && one(bx, by, bx + 1, by)) ||
      (ib !== ic && one(bx + 1, by, bx + 1, by + 1)) ||
      (id !== ic && one(bx, by + 1, bx + 1, by + 1)) ||
      (ia !== id && one(bx, by, bx, by + 1))
    ) {
      dam(bx, by, [ia, ib, ic, id]);
      continue;
    }
    if (!rec) continue; // never: the zone changes only where the law's label does, or a dam's
    // the law's own pieces of the square the zone's outline is: those the zone changes across (its two pixels one in the
    // zone, one out), each by what lies past the zone there - the water it does not enclose (a coast), or another
    // province's land (a border)
    for (const s of rec.segs) {
      const [x, y, qx, qy] = s.side,
        i0 = inside(x, y);
      if (i0 === inside(qx, qy)) continue;
      const past = i0 ? lines.label(qx, qy) : lines.label(x, y);
      segs.push({ a: s.a, b: s.b, kind: past === 0 ? 'coast' : 'border', pair: 0, side: s.side });
    }
  }
  const chains = yield* linkSteps(segs, /** @type {any} */ (points));
  const coast = yield* linkSteps(
    segs.filter((s) => s.kind === 'coast'),
    lines.points,
  );
  const borders = yield* linkSteps(
    segs.filter((s) => s.kind === 'border'),
    lines.points,
  );
  const line = {
    chains,
    coast,
    borders,
    /** The pieces the outline draws (tamrielLines.js segKey): the province ink's own are left off where they are these. */
    keys: new Set(segs.filter((s) => s.kind !== 'water').map(segKey)), // NIBEN-SEA: a dam's never the ink's to leave off
  };
  _line = { land: trace.land, province: trace.province, mask, key, line };
  return line;
}
let _line = /** @type {{ land: Uint8Array, province: Uint8Array, mask: any, key: string, line: any }|null} */ (null);
