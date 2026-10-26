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
import { buildWildMask, fillEnclosed, linkEdges } from './wildZone.js';
import { theatreAt } from '../../world/worldWide/worldGrid.js';
import { IMPERIAL_ID, PROVINCE_OF_ID, provinceKeyAt, tamrielLandVersion, tamrielTrace } from '../../world/tamriel/tamrielLand.js';
import { isOnlinePage } from '../online/onlineLane.js';   // AUDIT TESA II Z8: online, the traced picture's zone alone
import { tamrielFit, pictureToBay, PICTURE_W, PICTURE_H } from '../../world/tamriel/tamrielFrame.js';

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
  const cell = CYRODIIL_CELL_PX;
  const ox = Math.floor(box.x0 / cell) * cell, oy = Math.floor(box.y0 / cell) * cell;   // the world's one lattice
  const width = Math.ceil((box.x1 + 1 - ox) / cell), height = Math.ceil((box.y1 + 1 - oy) / cell);
  _mask = buildWildMask({ width, height, ox, oy, cell, pixelIn: (x, y) => theatreAt(x, y) === CYRODIIL_THEATRE });   // ZONE-LINE: the province's own law, a pixel at a time
  const trace = tamrielTrace();
  _mask.line = trace ? zoneLineOf(trace) : null;   // ZONE-LINE: the line the maps draw (untraced, the zone's own pixel edge)
  return _mask;
}

/**
 * ZONE-LINE: CYRODIIL'S OUTLINE ON THE TRACED PICTURE - the one line the maps draw for the zone and for the province.
 * `own(x, y)`: is picture pixel (x, y) the zone's - the Imperial Province's land, or water it encloses (AUDIT TESA II Z4,
 * read at the picture: a picture pixel's sides alone a way out). Its edges against the rest, clockwise, laid on the world
 * (pictureToBay): `chains` the whole outline, closed (the red line, the fog's cut, the zone map's ring and wash); `coast`
 * and `borders` the same edges in runs by what lies past them - the sea, or another province's land - for the province's
 * own ink, which draws them in place of its own there (ui/tamrielInk.js tracedChains: `keeps`, `cutCoast`). THE ONE LAW:
 * theatreAt reads the picture at a map pixel's middle, so a map pixel is the zone's exactly when its middle lies inside
 * `chains`. Kept while the trace and the fit stand.
 * @param {{ w: number, h: number, land: Uint8Array, province: Uint8Array }} trace
 */
export function zoneLineOf(trace) {
  const f = tamrielFit();
  const key = `${f.ox}:${f.oy}:${f.ppu}`;
  if (_line?.land === trace.land && _line.province === trace.province && _line.key === key) return _line.line;   // the picture's own arrays (tamrielLand.js setTamrielTrace keeps them)
  const { w, h, land, province } = trace;
  const owned = new Uint8Array(w * h);
  for (let i = 0; i < owned.length; i++) owned[i] = land[i] && province[i] === CYRODIIL_THEATRE ? 1 : 0;
  fillEnclosed(owned, w, h);
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const own = (x, y) => on(x, y) && owned[y * w + x] === 1;
  const isLand = (x, y) => on(x, y) && land[y * w + x] === 1;
  const toWorld = (x, y) => pictureToBay(x, y);
  /** @param {(x: number, y: number) => boolean} past what lies past an edge for the edge to be laid */
  const edges = (past) => linkEdges((add) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!owned[y * w + x]) continue;
        if (!own(x, y - 1) && past(x, y - 1)) add(x, y, x + 1, y);
        if (!own(x + 1, y) && past(x + 1, y)) add(x + 1, y, x + 1, y + 1);
        if (!own(x, y + 1) && past(x, y + 1)) add(x + 1, y + 1, x, y + 1);
        if (!own(x - 1, y) && past(x - 1, y)) add(x, y + 1, x, y);
      }
    }
  }, toWorld);
  const line = {
    own,
    chains: edges(() => true),
    coast: edges((x, y) => !isLand(x, y)),
    borders: edges(isLand),
    /** The province ink's border between picture pixels (ax, ay) and (bx, by) is its own to draw - never on the outline. */
    keeps: (ax, ay, bx, by) => own(ax, ay) === own(bx, by),
    /**
     * The province ink's coast (its contour's segments, `[x0, y0, x1, y1]` in picture units - each in the square of four
     * pixel middles it crosses, ui/tamrielInk.js contourSegments) with the outline's stretch left to the outline: in a
     * square the outline crosses, the coast is the pixels' own sides from the square's middle - the picture's corner
     * the outline passes - and only those the outline is not (a lake's shore, another province's coast to its end).
     * @param {number[][]} segs
     */
    cutCoast: (segs) => {
      const out = [], mixed = new Set();
      for (const s of segs) {
        const bx = Math.floor((s[0] + s[2]) / 2 - 0.5), by = Math.floor((s[1] + s[3]) / 2 - 0.5);
        const o = own(bx, by);
        if (o === own(bx + 1, by) && o === own(bx + 1, by + 1) && o === own(bx, by + 1)) { out.push(s); continue; }
        const k = `${bx},${by}`;
        if (mixed.has(k)) continue;
        mixed.add(k);
        const cx = bx + 1, cy = by + 1;
        const half = (ax, ay, qx, qy, ex, ey) => { if (isLand(ax, ay) !== isLand(qx, qy) && own(ax, ay) === own(qx, qy)) out.push([ex, ey, cx, cy]); };
        half(bx, by, bx + 1, by, cx, cy - 0.5);   // the top half-side, between the two upper pixels
        half(bx + 1, by, bx + 1, by + 1, cx + 0.5, cy);   // the right
        half(bx, by + 1, bx + 1, by + 1, cx, cy + 0.5);   // the bottom
        half(bx, by, bx, by + 1, cx - 0.5, cy);   // the left
      }
      return out;
    },
  };
  _line = { land, province, key, line };
  return line;
}
let _line = /** @type {{ land: Uint8Array, province: Uint8Array, key: string, line: any }|null} */ (null);
