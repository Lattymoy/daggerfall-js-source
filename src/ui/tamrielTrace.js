// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TAMRIEL3 (2026-10-08, bible/03-World/Tamriel.md) - THE TRACE: Daggerfall's own map of Tamriel, read off the player's
// two files the way the chargen's province map reads them (ui/provinceMap.js, OVH-era: the picker traced at runtime).
//
//   TAMRIEL2.IMG - the race picker: its palette index at a pixel IS the race, and the race names the province
//                  (CreateCharRaceSelect.cs:30-31,64). Its eight masks are the eight homelands' own shapes, to the
//                  pixel: the Iliac Bay is the gap between the Breton and the Redguard mask, the Inner Sea the hole
//                  in the Dark Elf one.
//   TMAP00I0.IMG - the painting, on MAP.PAL (ImgFile's paletteName for it): a parchment whose sea is the parchment
//                  itself, and whose whole coast - the Imperial Province's too - is one thin BLUE line round the land.
//
// So a pixel is LAND of a province where the picker names the province (each mask's pieces off the picture's edge and
// no speck), and the Imperial Province, which no race claims, is the one region the masks and the coastline ENCLOSE:
// flood the picture from its edge over everything that is neither a mask nor the blue line, and the largest unclaimed
// region the flood never reached that touches a mask is the ninth province. The painting's own labels, borders, ships,
// helmet and compass never enter it: a label stands on a mask, the helmet touches no mask. Nothing of either file
// ships: the trace is made on the player's machine from the player's files, as the chargen's map is, and a render of
// it never leaves the session.
//
// THE FIRST SIGHT OF A REAL ARENA2 (2026-10-08, the same night): the law this module shipped with read the sea as blue
// (provinceMap's seaIndices, written before any ARENA2 was in reach) and the Imperial Province as provinceMap's
// inlandRemainder - on the real picture the sea is parchment and only the coastline is blue, so the first trace was
// the eight masks as islands with 280 pixels of Imperial Province. The law above is what the picture actually says.
// ═══════════════════════════════════════════════════════════════════
import { ImgFile } from '../formats/imgFile.js';
import { DFPalette } from '../formats/dfPalette.js';
import { seaIndices } from './provinceMap.js';
import { RACE_TEMPLATES } from '../systems/races.js';
import { IMPERIAL_ID } from '../world/tamrielLand.js';

/** A land piece smaller than this (picture pixels) is a painted word over the sea, not an island. */
export const SPECK_PX = 12;
/** TAMRIEL4: a hole in the land smaller than this (picture pixels) is a dab of the painting's blue - a road, a river's
 *  dot, a letter's fill - not a lake. The painting's smallest lake is ten pixels (Hammerfell's under the Bay, twenty;
 *  Lake Rumare's pieces eleven and forty-nine); its dabs are one to five. */
export const HOLE_PX = 6;

const n4 = (i, w, h) => { const x = i % w, y = (i / w) | 0; return [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]; };

/** The 4-connected pieces of a mask: [{ cells: number[], edge: boolean }]. */
export function pieces(mask, w, h) {
  const seen = new Uint8Array(w * h);
  const out = [];
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || seen[s]) continue;
    const stack = [s]; const cells = []; let edge = false;
    seen[s] = 1;
    while (stack.length) {
      const i = /** @type {number} */ (stack.pop());
      cells.push(i);
      const x = i % w, y = (i / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
      for (const k of n4(i, w, h)) {
        if (k >= 0 && mask[k] && !seen[k]) { seen[k] = 1; stack.push(k); }
      }
    }
    out.push({ cells, edge });
  }
  return out;
}

/**
 * THE ENCLOSED REMAINDER: the Imperial Province. `claimed` is the picker's data (0 where no race claims the pixel),
 * `coast` marks the painting's blue coastline. The barrier is the claimed pixels and the coastline, each grown by one
 * pixel (a hand-drawn line has one-pixel gaps); the picture is flooded from its edge over everything else; and the
 * largest unclaimed region the flood never reached that touches a claimed pixel is the remainder - the line's own
 * pixels never part of it, so a pocket inside a mask (the Inner Sea) and a ring in the sea (the helmet) stay sea.
 * Answers a mask over the grid, or null (a picture whose masks enclose nothing).
 */
export function enclosedRemainder(claimed, coast, w, h) {
  const n = w * h;
  const seed = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (claimed[i] || coast[i]) seed[i] = 1;
  const barrier = seed.slice();
  for (let i = 0; i < n; i++) if (seed[i]) for (const k of n4(i, w, h)) if (k >= 0) barrier[k] = 1;
  const outside = new Uint8Array(n); const stack = [];
  for (let i = 0; i < n; i++) {
    const x = i % w, y = (i / w) | 0;
    if ((x === 0 || y === 0 || x === w - 1 || y === h - 1) && !barrier[i]) { outside[i] = 1; stack.push(i); }
  }
  while (stack.length) {
    const i = /** @type {number} */ (stack.pop());
    for (const k of n4(i, w, h)) if (k >= 0 && !outside[k] && !barrier[k]) { outside[k] = 1; stack.push(k); }
  }
  // the candidates: unclaimed, never reached, and not the line itself (the line is the coast, not land)
  const cand = new Uint8Array(n);
  for (let i = 0; i < n; i++) cand[i] = !claimed[i] && !outside[i] && !coast[i] ? 1 : 0;
  let best = null;
  for (const p of pieces(cand, w, h)) {
    if (best && p.cells.length <= best.cells.length) continue;
    if (!p.cells.some((i) => n4(i, w, h).some((k) => k >= 0 && claimed[k]))) continue;
    best = p;
  }
  if (!best) return null;
  const mask = new Uint8Array(n);
  for (const i of best.cells) mask[i] = 1;
  return mask;
}

const n8 = (i, w) => [i - 1, i + 1, i - w, i + w, i - w - 1, i - w + 1, i + w - 1, i + w + 1];
/** The province most of a pixel's eight neighbours of land hold (the lower id on a tie), or 0. */
function neighbourProvince(i, w, land, province) {
  const count = new Map();
  for (const k of n8(i, w)) if (land[k]) count.set(province[k], (count.get(province[k]) ?? 0) + 1);
  let best = 0, bn = 0;
  for (const [p, n] of count) if (n > bn || (n === bn && p < best)) { best = p; bn = n; }
  return best;
}

/**
 * TAMRIEL4 - A BORDER IS LAND. The picker draws every border between two homelands as a one-pixel line no race claims
 * (the black between its masks - Skyrim's from Hammerfell's, Valenwood's from Elsweyr's, Morrowind's from Skyrim's and
 * from Black Marsh's), and TAMRIEL3 read the line as sea: a strait 15 km wide down every border, on the map and in the
 * streamed land. A pixel that is no land, with land of two DIFFERENT provinces on opposite sides of it (west and east,
 * or north and south), is the line: it is land, of the province most of its neighbours hold. Passes until none is left
 * (a line's corner is closed by the pass after its arms). A channel within one province (the Inner Sea's narrows) has
 * the same province on both sides and stays sea; and a coast's inner corner where two provinces meet it has sea on one
 * side of each pair, so a diagonal is never asked (it would fill that corner). Mutates `land` and `province`; answers
 * how many.
 */
export function closeBorderLines(land, province, w, h) {
  let filled = 0;
  for (let pass = 0; pass < 4; pass++) {
    const add = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (land[i]) continue;
        if (!((land[i - 1] && land[i + 1] && province[i - 1] !== province[i + 1]) || (land[i - w] && land[i + w] && province[i - w] !== province[i + w]))) continue;
        add.push([i, neighbourProvince(i, w, land, province)]);
      }
    }
    if (!add.length) break;
    for (const [i, p] of add) { land[i] = 1; province[i] = p; }
    filled += add.length;
  }
  return filled;
}

/**
 * TAMRIEL4 - A DAB IS NOT A LAKE. Every hole in the land (a piece of not-land touching no edge of the picture) smaller
 * than HOLE_PX is land, of the province most of its rim holds. Mutates `land` and `province`; answers how many pixels.
 */
export function fillSpecks(land, province, w, h, maxPx = HOLE_PX) {
  const water = new Uint8Array(w * h);
  for (let i = 0; i < water.length; i++) water[i] = land[i] ? 0 : 1;
  let filled = 0;
  for (const p of pieces(water, w, h)) {
    if (p.edge || p.cells.length >= maxPx) continue;
    const prov = new Map();
    for (const i of p.cells) { const q = neighbourProvince(i, w, land, province); if (q) prov.set(q, (prov.get(q) ?? 0) + 1); }
    let best = 0, bn = 0;
    for (const [q, n] of prov) if (n > bn || (n === bn && q < best)) { best = q; bn = n; }
    if (!best) continue;
    for (const i of p.cells) { land[i] = 1; province[i] = best; }
    filled += p.cells.length;
  }
  return filled;
}

/**
 * The trace over the two bitmaps (ImgFile.getDFBitmap's shape) and the painting's palette ((i) => [r, g, b]).
 * Answers { w, h, land, province } - province 1..8 the race ids, IMPERIAL_ID the remainder, 0 at sea - or null
 * when the two files do not share a grid.
 */
export function traceTamrielPicture(picker, picture, palette) {
  if (!picker?.data?.length || !picture?.data?.length || picker.data.length !== picture.data.length) return null;
  const { width: w, height: h, data } = picker;
  const land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  for (const race of RACE_TEMPLATES) {
    const mask = new Uint8Array(w * h);
    let n = 0;
    for (let i = 0; i < data.length; i++) if (data[i] === race.id) { mask[i] = 1; n++; }
    if (!n) continue;
    const ps = pieces(mask, w, h);
    const inland = ps.filter((p) => !p.edge);
    // the province's land: its pieces off the picture's edge (all of them, when every piece touches it - a map painted
    // to the border), each at least a speck
    const kept = (inland.length ? inland : ps).filter((p) => p.cells.length >= SPECK_PX);
    for (const p of kept) for (const i of p.cells) { land[i] = 1; province[i] = race.id; }
  }
  const blue = seaIndices(palette);
  const coast = new Uint8Array(w * h);
  for (let i = 0; i < coast.length; i++) if (blue[picture.data[i]]) coast[i] = 1;
  const rem = enclosedRemainder(data, coast, w, h);
  if (rem) for (let i = 0; i < rem.length; i++) if (rem[i] && !land[i]) { land[i] = 1; province[i] = IMPERIAL_ID; }
  closeBorderLines(land, province, w, h);   // TAMRIEL4: the picker's border lines are land, not straits
  fillSpecks(land, province, w, h);   // TAMRIEL4: and the painting's dabs of blue in the land are not lakes
  return { w, h, land, province };
}

/** The palette as the tracer reads it: (index) => [r, g, b], off a DFPalette. */
export const paletteReader = (pal) => (i) => [pal.getRed(i), pal.getGreen(i), pal.getBlue(i)];

/**
 * Read the two files off the data source and trace them. `fetchBytes(name)` and `palette` (ART_PAL's DFPalette) are
 * the world host's own, as every classic art preload takes them. The painting is read on ITS palette (MAP.PAL,
 * ImgFile's paletteName for it, the way scenes/shared.js reads a sky's) - the given one stands in when that file is
 * missing. Answers the trace, or null when the files do not share a grid; a missing IMG rejects (the host says so).
 */
export async function preloadTamrielTrace({ fetchBytes, palette }) {
  const picture = new ImgFile();
  picture.load(await fetchBytes('TMAP00I0.IMG'), 'TMAP00I0.IMG', palette);
  let pal = palette;
  if (picture.paletteName) {
    try { const own = new DFPalette(); own.load(await fetchBytes(picture.paletteName), picture.paletteName); pal = own; } catch { /* the given palette stands */ }
  }
  const picker = new ImgFile();
  picker.load(await fetchBytes('TAMRIEL2.IMG'), 'TAMRIEL2.IMG', palette);
  return traceTamrielPicture(picker.getDFBitmap(), picture.getDFBitmap(), paletteReader(pal));
}
