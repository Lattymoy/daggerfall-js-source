// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WW-C2 (2026-10-24, bible/03-World/World-Wide.md WW-C, bible/11-Multiplayer/Wild-Zone.md) - CYRODIIL, THE OPEN ZONE.
//
// The owner: "Cyrodil becomes the new open PvP area with the wrothgarian mountain area being retired in favor of this.
// Cryodil will be home to all abundent resources and everything else from the wrothgarian zone."
//
// THE ZONE IS THE PROVINCE, WHOLE: every map pixel the world's grid puts in the Imperial Province (world/worldWide/
// worldGrid.js theatreAt - theatre 9, the picker's own numbering) - no cut, no town kept out. Its mask is laid on a grid
// of CYRODIIL_CELL_PX-pixel cells (systems/wild/wildZone.js buildWildMask), the cells on one lattice over the world: a
// cell is the zone's where its middle pixel is the province's. The province's border is the player's own traced picture
// (world/tamriel/tamrielLand.js), a picture unit some eighteen map pixels, so a cell of four is finer than the border it
// follows - and every client with the same files cuts the same zone, its rings and its halls with it.
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
import { buildWildMask } from './wildZone.js';
import { theatreAt } from '../../world/worldWide/worldGrid.js';
import { IMPERIAL_ID, PROVINCE_OF_ID, provinceKeyAt, tamrielLandVersion, tamrielTrace } from '../../world/tamriel/tamrielLand.js';
import { isOnlinePage } from '../online/onlineLane.js';   // AUDIT TESA II Z8: online, the traced picture's zone alone
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
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let py = 0; py < PICTURE_H; py++) {
    for (let px = 0; px < PICTURE_W; px++) {
      if (provinceKeyAt(px + 0.5, py + 0.5) !== key) continue;
      if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
    }
  }
  if (x1 < x0) return null;
  const [ax, ay] = pictureToBay(x0 - 1, y0 - 1), [bx, by] = pictureToBay(x1 + 2, y1 + 2);
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
 * The Waterfront canal's water is a picture pixel of land (world/tamriel/tamrielLand.js waterfrontCanal) - the province's.
 */
export function provinceWaterAt(x, y) {
  const trace = tamrielTrace();
  if (!trace) return false;
  const [qx, qy] = bayToPicture(x + 0.5, y + 0.5), px = Math.floor(qx), py = Math.floor(qy), { w, h, land, province } = trace;
  if (px < 0 || py < 0 || px >= w || py >= h) return false;
  if (land[py * w + px]) return provinceKeyAt(qx, qy) === null;   // the canal's (a pixel of land on the picture, water at the Bay's scale)
  const bank = (dx, dy) => {
    for (let k = 1; k <= PROVINCE_WATER_REACH; k++) {
      const bx = px + dx * k, by = py + dy * k;
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
  if (isOnlinePage() && !tamrielTrace()) return null;   // AUDIT TESA II Z8: no trace, no zone - never the authored rings' online
  const f = tamrielFit();
  const key = `${tamrielLandVersion()}:${f.ox}:${f.oy}:${f.ppu}`;
  if (_key === key) return _mask;
  _key = key;
  const box = cyrodiilBox();
  if (!box) return (_mask = null);
  const cell = CYRODIIL_CELL_PX, mid = Math.floor(cell / 2);
  const ox = Math.floor(box.x0 / cell) * cell, oy = Math.floor(box.y0 / cell) * cell;   // the world's one lattice
  const width = Math.ceil((box.x1 + 1 - ox) / cell), height = Math.ceil((box.y1 + 1 - oy) / cell);
  const inZone = (/** @type {number} */ x, /** @type {number} */ y) => theatreAt(x, y) === CYRODIIL_THEATRE || provinceWaterAt(x, y);   // NIBEN-SEA: and the province's own water
  _mask = buildWildMask({ width, height, ox, oy, cell, inZone: (cx, cy) => inZone(ox + cx * cell + mid, oy + cy * cell + mid) });
  return _mask;
}
