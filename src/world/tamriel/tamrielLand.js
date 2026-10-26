// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TAMRIEL3 (2026-10-08, bible/03-World/Tamriel.md) - THE LAND, FROM THE PLAYER'S OWN PICTURE.
//
// Mac: "Can we fix the map? It doesnt look like the map thats in daggerfall." It did not: TAMRIEL1's geography was
// drawn from memory of the lore map. Daggerfall carries its own map of Tamriel - TMAP00I0.IMG, the race screen's
// picture, and TAMRIEL2.IMG, its picker, whose palette index IS the province - and the port already traces the
// picker at runtime for the chargen's province map (ui/provinceMap.js). So the continent is TRACED from the player's
// own two files when the world boots (ui/tamrielTrace.js), and this module holds what the trace found: a land mask
// and a province mask on the picture's 320 x 200 grid, a distance-to-sea field over the land, and the FIT - where the
// Bay's own 1000 x 500 stands on that picture, found by laying the Bay's land (WOODS.WLD and CLIMATE.PAK's one water
// law) over the picture's and searching the offset and the scale that agree best.
//
// Everything that read the authored geography reads THIS module now - the ink (ui/tamrielInk.js), the ground beyond
// the Bay (world/tamriel/tamrielGround.js, on the main thread and in the terrain worker, which is handed the same arrays),
// the raster - and falls back to the authored shape where no trace is set (node, the pins, a data-free probe,
// `?tamrieltrace=off`). PURE: typed arrays in, answers out; the two IMG files are read by the ui module, never here.
// ═══════════════════════════════════════════════════════════════════
import { provinceAt, coastDistance, WATERFRONT_CANAL } from './tamrielGeography.js';
import { BAY_W, BAY_H, PICTURE_W, PICTURE_H, bayToPicture, pictureToBay, inBay, tamrielFit } from './tamrielFrame.js';

/** The picker's palette index is the race id (CreateCharRaceSelect.cs:30-31,64; systems/races.js RACE_TEMPLATES) and
 *  the race names the province; 9 is the Imperial Province, the picker's inert ninth (ui/provinceMap.js
 *  INERT_REGION), which the trace finds as the inland remainder. */
export const PROVINCE_OF_ID = Object.freeze({
  1: 'HighRock', 2: 'Hammerfell', 3: 'Skyrim', 4: 'Morrowind', 5: 'Sumurset', 6: 'Valenwood', 7: 'Elsweyr', 8: 'BlackMarsh', 9: 'Imperial',
});
export const IMPERIAL_ID = 9;

/** @typedef {{ w: number, h: number, land: Uint8Array, province: Uint8Array, dist?: Float32Array, relief?: Uint8Array|null }} TamrielTrace - `relief` the owner's heightmap's cells (TAMRIEL-RELIEF, world/tamriel/tamrielRelief.js) */

/** @type {TamrielTrace|null} */
let _trace = null;
let _version = 0;

/** The chamfer distance (3-4, over 3) from every land pixel to the nearest sea, picture units; 0 at sea. */
export function seaDistanceField(land, w, h) {
  const BIG = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = land[i] ? BIG : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      let b = d[i];
      if (x > 0) b = Math.min(b, d[i - 1] + 3);
      if (y > 0) { b = Math.min(b, d[i - w] + 3); if (x > 0) b = Math.min(b, d[i - w - 1] + 4); if (x < w - 1) b = Math.min(b, d[i - w + 1] + 4); }
      d[i] = b;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      let b = d[i];
      if (x < w - 1) b = Math.min(b, d[i + 1] + 3);
      if (y < h - 1) { b = Math.min(b, d[i + w] + 3); if (x < w - 1) b = Math.min(b, d[i + w + 1] + 4); if (x > 0) b = Math.min(b, d[i + w - 1] + 4); }
      d[i] = b;
    }
  }
  for (let i = 0; i < d.length; i++) d[i] = d[i] >= BIG ? 0 : d[i] / 3;
  return d;
}

/** Install a trace (or null: the authored shape again). Keeps its own distance field. */
export function setTamrielTrace(trace) {
  if (!trace || !trace.land || !trace.province || trace.w * trace.h !== trace.land.length) { _trace = null; _version++; return; }
  _trace = { w: trace.w, h: trace.h, land: trace.land, province: trace.province, dist: trace.dist ?? seaDistanceField(trace.land, trace.w, trace.h), relief: trace.relief ?? null };   // TAMRIEL-RELIEF: the heightmap's cells ride on the trace (world/tamriel/tamrielRelief.js)
  _version++;
}
export const tamrielTrace = () => _trace;
/** Moves on every install - the ink and the ground's cache key on it. */
export const tamrielLandVersion = () => _version;

/** The province key under a picture-grid point - the trace's where one is set, the authored rings' else; null at sea.
 *  NIBEN-SEA: and null on the Waterfront canal (waterfrontCanal), the trace's own water at the Bay's scale. */
export function provinceKeyAt(px, py) {
  if (_trace) {
    const x = Math.floor(px), y = Math.floor(py);
    if (x < 0 || y < 0 || x >= _trace.w || y >= _trace.h) return null;
    const i = y * _trace.w + x;
    if (!_trace.land[i]) return null;
    const c = waterfrontCanal();
    return c && px >= c.p0 && px < c.p1 && py >= c.q0 && py < c.q1 ? null : (PROVINCE_OF_ID[_trace.province[i]] ?? null);
  }
  return provinceAt(px, py)?.key ?? null;
}

/** @type {{ trace: object|null, fit: object|null, canal: ?{ x0: number, x1: number, y0: number, y1: number, p0: number, p1: number, q0: number, q1: number } }} */
const _canal = { trace: null, fit: null, canal: null };
/**
 * NIBEN-SEA: THE WATERFRONT CANAL (world/tamriel/tamrielGeography.js WATERFRONT_CANAL) on the installed trace and fit - the
 * Bay pixels x0..x1, y0..y1 (inclusive) from the row past the city's span's south edge to the last before the trace's
 * water, its middle column and `half` either side, and the same box on the picture (p0..p1, q0..q1: a point inside it is
 * the canal's) - or null: no trace, the city's span at its point not all its province's land (the capitals' own law would
 * stand it elsewhere, world/tamrielCapitals.js capitalPixel), or no row of the water within `reach`. Read off the trace's
 * own pixels (never provinceKeyAt, which reads it); kept a trace and a fit.
 */
export function waterfrontCanal() {
  const fit = tamrielFit();
  if (_canal.trace === _trace && _canal.fit === fit) return _canal.canal;
  _canal.trace = _trace; _canal.fit = fit; _canal.canal = null;
  const city = WATERFRONT_CANAL.city;
  if (!_trace || !city) return null;
  const { w, h, land, province } = _trace, { span, half, reach } = WATERFRONT_CANAL, r = (span - 1) / 2;
  const id = Number(Object.keys(PROVINCE_OF_ID).find((k) => PROVINCE_OF_ID[k] === city.province));
  const idAt = (bx, by) => {
    if (inBay(bx, by)) return -1;
    const [qx, qy] = bayToPicture(bx + 0.5, by + 0.5), x = Math.floor(qx), y = Math.floor(qy);
    return x >= 0 && y >= 0 && x < w && y < h && land[y * w + x] ? province[y * w + x] : 0;
  };
  const [ax, ay] = pictureToBay(city.at[0] + 0.5, city.at[1] + 0.5), cx = Math.floor(ax), cy = Math.floor(ay);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (idAt(cx + dx, cy + dy) !== id) return null;
  for (let y = cy + r + 1; y <= cy + r + reach; y++) {
    let wet = true;
    for (let dx = -half; dx <= half; dx++) if (idAt(cx + dx, y) !== 0) wet = false;
    if (!wet) continue;
    if (y === cy + r + 1) return null;   // the water at the city's edge: no canal to cut
    const x0 = cx - half, x1 = cx + half, y0 = cy + r + 1, y1 = y - 1;
    const [p0, q0] = bayToPicture(x0, y0), [p1, q1] = bayToPicture(x1 + 1, y1 + 1);
    return (_canal.canal = Object.freeze({ x0, x1, y0, y1, p0, p1, q0, q1 }));
  }
  return null;
}
/** AUDIT TESA II P12: THE PICTURE'S LAKES - its water no way of water joins to its border (the open sea: the picture's
 *  edge is the sea's, world/arenaPlaces.js pictureSea's own reading), eight ways round as the Bay's open sea is flooded
 *  (world/portSites.js openSeaOf): the lakes the trace encloses, kept a trace. A mask over the picture's pixels, 1 a
 *  lake's. TAMRIEL-DEEP: its one home here, where the Deep Waters worker reads it (world/tamrielWatersBake.js).
 *  @param {TamrielTrace} trace */
export function pictureLakes(trace) {
  let lakes = _lakes.get(trace);
  if (lakes) return lakes;
  const { w, h, land } = trace, open = new Uint8Array(w * h), stack = [];
  const reach = (x, y) => { const i = y * w + x; if (!land[i] && !open[i]) { open[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { reach(x, 0); reach(x, h - 1); }
  for (let y = 0; y < h; y++) { reach(0, y); reach(w - 1, y); }
  while (stack.length) {
    const i = /** @type {number} */ (stack.pop()), x = i % w, y = (i - x) / w;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w && ny < h) reach(nx, ny); }
  }
  lakes = new Uint8Array(w * h);
  for (let i = 0; i < lakes.length; i++) if (!land[i] && !open[i]) lakes[i] = 1;
  _lakes.set(trace, lakes);
  return lakes;
}
/** @type {WeakMap<object, Uint8Array>} */
const _lakes = new WeakMap();
/** NIBEN-SEA: is a Bay pixel the Waterfront canal's. */
export const canalAt = (bx, by) => { const c = waterfrontCanal(); return !!c && bx >= c.x0 && bx <= c.x1 && by >= c.y0 && by <= c.y1; };
/** TESA3 (bible/03-World/Arena-Provinces.md): the province a Bay pixel past the Bay stands on - its centre's
 *  provinceKeyAt - or null: the Bay's own pixels (Daggerfall's regions answer there), and the sea. */
export function provinceKeyBeyondBay(px, py) {
  if (inBay(px, py)) return null;
  return provinceKeyAt(...bayToPicture(px + 0.5, py + 0.5));
}
/** Distance from a picture-grid point to the nearest coast, picture units - the trace's field (bilinear) or the
 *  authored edges'. */
export function coastDistanceAt(px, py) {
  if (!_trace) return coastDistance(px, py);
  const { w, h, dist } = _trace;
  const cx = Math.min(w - 1, Math.max(0, px - 0.5)), cy = Math.min(h - 1, Math.max(0, py - 0.5));
  const x0 = Math.floor(cx), y0 = Math.floor(cy), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
  const fx = cx - x0, fy = cy - y0;
  const d = /** @type {Float32Array} */ (dist);
  return (d[y0 * w + x0] * (1 - fx) + d[y0 * w + x1] * fx) * (1 - fy) + (d[y1 * w + x0] * (1 - fx) + d[y1 * w + x1] * fx) * fy;
}

/** TAMRIEL4: the fit's scales, Bay pixels a picture pixel - every quarter from 15 to 21 (TAMRIEL3's twelve, 16 to 21,
 *  left the seam's own best, 15.5, outside them). */
export const FIT_PPUS = Object.freeze(Array.from({ length: 25 }, (_, i) => 15 + i / 4));
/** TAMRIEL4: how much the agreement INSIDE the Bay weighs beside the agreement along its EDGE. */
export const FIT_AREA_WEIGHT = 0.25;

/** FIT-BITS: the set bits of a 32-bit word. @param {number} x */
const popcount = (x) => {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return Math.imul((x + (x >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24;
};

/**
 * THE FIT: where the Bay stands on the picture. The Bay's land (bayLand(x, y), Bay pixels, the one water law) is
 * laid on the picture's grid at each candidate scale (`ppus`, Bay pixels a picture pixel) as cells, four samples a cell
 * and the majority, and at each offset (picture pixels, `span` each way round `around`).
 *
 * TAMRIEL4 - THE SEAM FIRST. TAMRIEL3 scored the cells INSIDE the Bay alone, and the picture's own Bay is a cruder,
 * more diagonal inlet than WOODS.WLD's: its best inside (77% of the cells) left High Rock's and Hammerfell's painted
 * west coasts 100-200 Bay pixels past the data's, and the coast the player followed out of the Bay ran off the edge of
 * the data into nothing (516 edge pixels of 3,000 disagreeing). But inside the Bay the picture is never drawn - the
 * data is - so what the fit owes the map is the JOIN: the Bay's edge cells against the picture's pixels just beyond
 * them, the fraction agreeing, with the inside's fraction beside it at FIT_AREA_WEIGHT (a fraction, not a count: a
 * smaller scale lays more cells). On the freeware data the Bay stands at (38, 57) x15.5: 190 of its 192 edge cells
 * agree (231 edge pixels, 139 of them where the painting's Hammerfell reaches past the west edge), 75% inside. A
 * candidate keeps a pixel of picture round it, or it is skipped.
 *
 * Answers { ox, oy, ppu, score, cells, seam, edge } - ox, oy in PICTURE units (the frame takes them times ppu); `score`
 * of `cells` agreeing inside, `seam` of `edge` along it - or null. Deterministic; ~0.4 s at the defaults.
 * @param {{ bayLand: (x: number, y: number) => boolean, trace: TamrielTrace, around?: {ox: number, oy: number},
 *   span?: number, ppus?: readonly number[] }} o
 */
export function fitBayToPicture({ bayLand, trace, around = { ox: 46, oy: 52 }, span = 24, ppus = FIT_PPUS }) {
  let best = null, bestValue = -Infinity;
  const { w, land } = trace;
  // FIT-BITS (2026-10-20, bible/07-Rendering/Performance-Priority.md FIT-BITS): the inside's score counted 32 cells a
  // word - the picture's rows as two bitsets (its pixels that ARE 1, and that ARE 0: a cell agrees only with its own
  // value, whatever else a picture holds), a cell agreeing where the mask's bit meets the one and its clear bit the
  // zero. The same counts as a cell at a time, so the same fit: the boot paid ~0.8 s of its first world frame for the
  // cell-at-a-time walk (25 scales, 49 x 49 offsets, up to 2,178 cells each).
  const words = (w + 31) >>> 5;
  const ones = new Uint32Array(words * trace.h + 1), zeros = new Uint32Array(words * trace.h + 1);
  for (let y = 0; y < trace.h; y++) {
    for (let x = 0; x < w; x++) {
      const v = land[y * w + x], bit = 1 << (x & 31), at = y * words + (x >>> 5);
      if (v === 1) ones[at] |= bit;
      else if (v === 0) zeros[at] |= bit;
    }
  }
  for (const ppu of ppus) {
    const cols = Math.floor(BAY_W / ppu), rows = Math.floor(BAY_H / ppu);
    const mask = new Uint8Array(cols * rows);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        // four samples a cell, the majority: a 15 km cell is not one pixel's word
        let n = 0;
        for (const [dx, dy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) if (bayLand(Math.floor((i + dx) * ppu), Math.floor((j + dy) * ppu))) n++;
        mask[j * cols + i] = n >= 2 ? 1 : 0;
      }
    }
    const mw = (cols + 31) >>> 5, tail = cols & 31 ? 2 ** (cols & 31) - 1 : 0xffffffff;
    const bits = new Uint32Array(mw * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (mask[j * cols + i] === 1) bits[j * mw + (i >>> 5)] |= 1 << (i & 31);
    const edge = 2 * (cols + rows);
    for (let oy = around.oy - span; oy <= around.oy + span; oy++) {
      if (oy < 1 || oy + rows + 1 > trace.h) continue;
      for (let ox = around.ox - span; ox <= around.ox + span; ox++) {
        if (ox < 1 || ox + cols + 1 > w) continue;
        let score = 0;
        for (let j = 0; j < rows; j++) {
          const row = (oy + j) * words, mrow = j * mw;
          for (let k = 0; k < mw; k++) {
            // the picture's 32 pixels from ox + 32k, as one word (a word past the window's last pixel is the tail's to clear)
            const b = ox + (k << 5), at = row + (b >>> 5), s = b & 31;
            const one = s ? (ones[at] >>> s) | (ones[at + 1] << (32 - s)) : ones[at];
            const zero = s ? (zeros[at] >>> s) | (zeros[at + 1] << (32 - s)) : zeros[at];
            const m = bits[mrow + k];
            score += popcount((m & one) | (~m & zero & (k === mw - 1 ? tail : 0xffffffff)));
          }
        }
        // the seam: each edge cell against the picture's pixel beyond it
        let seam = 0;
        for (let i = 0; i < cols; i++) {
          if (mask[i] === land[(oy - 1) * w + ox + i]) seam++;
          if (mask[(rows - 1) * cols + i] === land[(oy + rows) * w + ox + i]) seam++;
        }
        for (let j = 0; j < rows; j++) {
          if (mask[j * cols] === land[(oy + j) * w + ox - 1]) seam++;
          if (mask[j * cols + cols - 1] === land[(oy + j) * w + ox + cols]) seam++;
        }
        const value = seam / edge + (FIT_AREA_WEIGHT * score) / (cols * rows);
        if (value > bestValue) { bestValue = value; best = { ox, oy, ppu, score, cells: cols * rows, seam, edge }; }
      }
    }
  }
  return best;
}
