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

/**
 * THE FIT: where the Bay stands on the picture. The Bay's land (bayLand(x, y), Bay pixels, the one water law) is
 * laid on the picture's grid at each candidate scale (`ppus`, Bay pixels a picture pixel) and offset (picture pixels,
 * `span` each way round `around`), and the pair with the greatest FRACTION of cells agreeing wins (a count would favour the smallest scale). Answers { ox, oy, ppu, score, cells }
 * with ox, oy in PICTURE units (the frame takes them times ppu). Deterministic; ~40M compares at the defaults.
 * @param {{ bayLand: (x: number, y: number) => boolean, trace: TamrielTrace, around?: {ox: number, oy: number},
 *   span?: number, ppus?: number[] }} o
 */
export function fitBayToPicture({ bayLand, trace, around = { ox: 46, oy: 52 }, span = 24, ppus = [16, 16.5, 17, 17.5, 18, 18.5, 18.75, 19, 19.5, 20, 20.5, 21] }) {
  let best = null;
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
    for (let oy = around.oy - span; oy <= around.oy + span; oy++) {
      if (oy < 0 || oy + rows > trace.h) continue;
      for (let ox = around.ox - span; ox <= around.ox + span; ox++) {
        if (ox < 0 || ox + cols > trace.w) continue;
        let score = 0;
        for (let j = 0; j < rows; j++) {
          const row = (oy + j) * trace.w + ox, mrow = j * cols;
          for (let i = 0; i < cols; i++) if (mask[mrow + i] === trace.land[row + i]) score++;
        }
        // the FRACTION agreeing, not the count: a smaller scale lays more cells and would win on count alone
        if (!best || score * best.cells > best.score * cols * rows) best = { ox, oy, ppu, score, cells: cols * rows };
      }
    }
  }
  return best;
}
