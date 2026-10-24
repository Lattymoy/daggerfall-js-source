// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TAMRIEL-RELIEF (2026-10-24, bible/03-World/Tamriel.md TAMRIEL-RELIEF; the owner, with a heightmap of the whole continent:
// "Heres the entire tamriel height map btw", then "This is the heightmap. Use it") - THE CONTINENT'S OWN RELIEF: the
// owner's heightmap laid on the trace of Daggerfall's own map (tools/bakeTamrielRelief.mjs - its land fitted and warped
// onto the trace's, its brightness made WOODS' bytes by the Bay's own ranks), a height a cell, two cells a picture unit
// (tamrielReliefData.js). PURE over the trace: the terrain worker and the roads worker hold the same module.
//
//   - IT RIDES ON THE TRACE. The cells are the trace's `relief` (ui/tamrielTrace.js preloadTamrielTrace loads them - the
//     data is its own chunk, fetched once with the player's two files, never in the boot chunk or a worker's - and every
//     copy of the trace carries them: world/tamriel/tamrielLand.js setTamrielTrace, the terrain worker's message, the roads
//     worker's). The heightmap was laid on the picture the trace reads (TMAP00I0 and TAMRIEL2, 320 x 200), so it answers
//     only while such a trace stands with them; with none (`?tamrieltrace=off`, a picture that reads wrong, a pin's own
//     trace) the authored law stands, ranges and all (world/tamriel/tamrielGround.js authoredHeightByte).
//   - THE COAST IS THE TRACE'S: a cell at sea on the trace is 0, so the relief never makes land or water - it only says
//     how high the land the trace draws stands.
//   - THE PEAKS (world/tamriel/tamrielBiomes.js): a province's peaks zone is its highest PEAKS_SHARE of land, never under
//     PEAKS_FLOOR (`peaksLine`); a range a zone names (Red Mountain) stands at the heightmap's summit nearest the range's
//     authored place, within NAMED_SEEK (`namedSummit`) - the authored spines were drawn from memory on the lore map,
//     and on the trace Red Mountain's lies in the sea and the Throat of the World's on Skyrim's north shore.
// ═══════════════════════════════════════════════════════════════════
import { tamrielTrace, tamrielLandVersion, provinceKeyAt } from './tamrielLand.js';

/** How far inland (picture units) the land takes to rise from the shore to the relief's own height - the heightmap's
 *  coast is near the trace's, not on it, so its height is eased in rather than standing as a cliff at the water. */
export const RELIEF_COAST_REACH = 1;
/** A province's peaks: its highest share of land (by the relief), and never land under this byte. */
export const PEAKS_SHARE = 0.08;
export const PEAKS_FLOOR = 40;
/** A named range's summit is sought this far (picture units) from its authored spine; its zone is the peaks within
 *  NAMED_REACH of the summit. */
export const NAMED_SEEK = 30;
export const NAMED_REACH = 10;

/** Cells a picture unit, each way (the bake's RELIEF_SCALE). */
export const RELIEF_SCALE = 2;

/** THE CELLS from the data module's run-length code (a 0 and a count is that many cells at sea), base64. Pure.
 *  @param {{ w: number, h: number, scale: number, cells: string }} data */
export function decodeRelief(data) {
  const bin = globalThis.atob(data.cells), cells = new Uint8Array(data.w * data.h);
  for (let i = 0, k = 0; i < bin.length;) {
    const v = bin.charCodeAt(i);
    if (v === 0) { k += bin.charCodeAt(i + 1); i += 2; } else { cells[k++] = v; i++; }
  }
  return cells;
}
/** THE RELIEF FOR A TRACE: its cells when the trace is of the picture the heightmap was laid on, else null - the data
 *  module fetched once, its own chunk (ui/tamrielTrace.js preloadTamrielTrace hangs the answer on the trace).
 *  @param {{ w: number, h: number }} trace */
export async function loadRelief(trace) {
  const { RELIEF_DATA } = await import('./tamrielReliefData.js');
  if (RELIEF_DATA.scale !== RELIEF_SCALE || trace.w * RELIEF_SCALE !== RELIEF_DATA.w || trace.h * RELIEF_SCALE !== RELIEF_DATA.h) return null;
  return decodeRelief(RELIEF_DATA);
}

/** The installed trace's cells, or null. */
const reliefCells = () => /** @type {Uint8Array|null} */ (tamrielTrace()?.relief ?? null);
/** Whether the relief stands: the installed trace carries cells of its own size. */
export function reliefStands() {
  const t = tamrielTrace();
  return !!t?.relief && t.relief.length === t.w * RELIEF_SCALE * t.h * RELIEF_SCALE;
}

/** THE RELIEF at a picture point (units), in WOODS bytes - bilinear between the cells' centres, a cell at sea 0 (so the
 *  height falls toward a coast between its last two cells), 0 off the grid or with no relief standing. */
export function reliefAt(px, py) {
  const t = tamrielTrace(), cells = reliefCells();
  if (!t || !cells) return 0;
  const s = RELIEF_SCALE, w = t.w * s, h = t.h * s;
  const fx = px * s - 0.5, fy = py * s - 0.5;
  const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : cells[y * w + x]);
  return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
}

let _linesFor = -1;
/** @type {Map<string, number>} */
const _lines = new Map();
/** @type {Map<string, [number, number]|null>} */
const _summits = new Map();
const fresh = () => {
  const v = tamrielLandVersion();
  if (v === _linesFor) return;
  _linesFor = v; _lines.clear(); _summits.clear();
};

/** THE PEAKS' LINE of a province (its key): the relief its highest PEAKS_SHARE of land stands at or over, never under
 *  PEAKS_FLOOR - every province's made in one pass over the trace's cells, once a trace; 256 (none) with no relief. */
export function peaksLine(province) {
  fresh();
  if (!_lines.size) {
    const t = tamrielTrace(), cells = reliefCells();
    if (!t || !cells) return 256;
    const s = RELIEF_SCALE, w = t.w * s;
    /** @type {Map<string, Uint32Array>} */ const counts = new Map();
    for (let i = 0; i < cells.length; i++) {
      if (!cells[i]) continue;
      const x = i % w, y = (i - x) / w, key = provinceKeyAt((x + 0.5) / s, (y + 0.5) / s);
      if (!key) continue;
      let c = counts.get(key);
      if (!c) counts.set(key, (c = new Uint32Array(257)));
      c[cells[i]]++; c[256]++;
    }
    for (const [key, c] of counts) {
      let line = 256;
      for (let v = 255, above = 0; v >= 0; v--) { above += c[v]; if (above > c[256] * PEAKS_SHARE) { line = v; break; } }
      _lines.set(key, Math.max(PEAKS_FLOOR, line));
    }
  }
  return _lines.get(province) ?? 256;
}

/** THE SUMMIT OF A NAMED RANGE: the highest cell of `province` within NAMED_SEEK of the range's authored spine (`pts`,
 *  picture units), [px, py] - or null where the province holds none there. Made once a trace and a range. */
export function namedSummit(province, name, pts) {
  fresh();
  const key = `${province}|${name}`;
  if (_summits.has(key)) return _summits.get(key) ?? null;
  const t = tamrielTrace(), cells = reliefCells();
  if (!t || !cells) return null;
  const s = RELIEF_SCALE, w = t.w * s, h = t.h * s;
  let best = 0, at = /** @type {[number, number]|null} */ (null);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = cells[y * w + x];
    if (v <= best) continue;
    const px = (x + 0.5) / s, py = (y + 0.5) / s;
    if (!pts.some(([qx, qy]) => Math.hypot(px - qx, py - qy) <= NAMED_SEEK) || provinceKeyAt(px, py) !== province) continue;
    best = v; at = [px, py];
  }
  _summits.set(key, at);
  return at;
}
