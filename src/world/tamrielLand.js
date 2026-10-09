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
// the Bay (world/tamrielGround.js, on the main thread and in the terrain worker, which is handed the same arrays),
// the raster - and falls back to the authored shape where no trace is set (node, the pins, a data-free probe,
// `?tamrieltrace=off`). PURE: typed arrays in, answers out; the two IMG files are read by the ui module, never here.
// ═══════════════════════════════════════════════════════════════════
import { provinceAt, coastDistance } from './tamrielGeography.js';
import { BAY_W, BAY_H, PICTURE_W, PICTURE_H } from './tamrielFrame.js';

/** The picker's palette index is the race id (CreateCharRaceSelect.cs:30-31,64; systems/races.js RACE_TEMPLATES) and
 *  the race names the province; 9 is the Imperial Province, the picker's inert ninth (ui/provinceMap.js
 *  INERT_REGION), which the trace finds as the inland remainder. */
export const PROVINCE_OF_ID = Object.freeze({
  1: 'HighRock', 2: 'Hammerfell', 3: 'Skyrim', 4: 'Morrowind', 5: 'Sumurset', 6: 'Valenwood', 7: 'Elsweyr', 8: 'BlackMarsh', 9: 'Imperial',
});
export const IMPERIAL_ID = 9;

/** @typedef {{ w: number, h: number, land: Uint8Array, province: Uint8Array, dist?: Float32Array }} TamrielTrace */

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
  _trace = { w: trace.w, h: trace.h, land: trace.land, province: trace.province, dist: trace.dist ?? seaDistanceField(trace.land, trace.w, trace.h) };
  _version++;
}
export const tamrielTrace = () => _trace;
/** Moves on every install - the ink and the ground's cache key on it. */
export const tamrielLandVersion = () => _version;

/** The province key under a picture-grid point - the trace's where one is set, the authored rings' else; null at sea. */
export function provinceKeyAt(px, py) {
  if (_trace) {
    const x = Math.floor(px), y = Math.floor(py);
    if (x < 0 || y < 0 || x >= _trace.w || y >= _trace.h) return null;
    const i = y * _trace.w + x;
    return _trace.land[i] ? (PROVINCE_OF_ID[_trace.province[i]] ?? null) : null;
  }
  return provinceAt(px, py)?.key ?? null;
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
    const edge = 2 * (cols + rows);
    for (let oy = around.oy - span; oy <= around.oy + span; oy++) {
      if (oy < 1 || oy + rows + 1 > trace.h) continue;
      for (let ox = around.ox - span; ox <= around.ox + span; ox++) {
        if (ox < 1 || ox + cols + 1 > w) continue;
        let score = 0;
        for (let j = 0; j < rows; j++) {
          const row = (oy + j) * w + ox, mrow = j * cols;
          for (let i = 0; i < cols; i++) if (mask[mrow + i] === land[row + i]) score++;
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
