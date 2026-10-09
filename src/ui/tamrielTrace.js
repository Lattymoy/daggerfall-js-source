// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TAMRIEL3 (2026-10-08, bible/03-World/Tamriel.md) - THE TRACE: Daggerfall's own map of Tamriel, read off the player's
// two files the way the chargen's province map reads them (ui/provinceMap.js, OVH-era: the picker traced at runtime).
//
//   TAMRIEL2.IMG - the race picker: its palette index at a pixel IS the race, and the race names the province
//                  (CreateCharRaceSelect.cs:30-31,64). Its eight masks are CLICK targets, generous past the coast.
//   TMAP00I0.IMG - the painting: its sea is blue by a clear margin on the palette (provinceMap seaIndices), its
//                  parchment runs to the picture's edge (the no-edge clause), and the Imperial Province is the one
//                  inland patch no homeland claims (inlandRemainder).
//
// So a pixel is LAND of a province where the picker names the province and the painting is not sea; the Imperial
// Province is the remainder; and a province's land keeps only the pieces that touch no edge of the picture (the
// picker's generous blob over the parchment border is not land) and are no speck (a painted label over the sea is
// not an island). Nothing of either file ships: the trace is made on the player's machine from the player's files,
// as the chargen's map is, and a render of it never leaves the session.
// ═══════════════════════════════════════════════════════════════════
import { ImgFile } from '../formats/imgFile.js';
import { seaIndices, inlandRemainder } from './provinceMap.js';
import { RACE_TEMPLATES } from '../systems/races.js';
import { IMPERIAL_ID } from '../world/tamrielLand.js';

/** A land piece smaller than this (picture pixels) is a painted word over the sea, not an island. */
export const SPECK_PX = 12;

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
      for (const k of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (k >= 0 && mask[k] && !seen[k]) { seen[k] = 1; stack.push(k); }
      }
    }
    out.push({ cells, edge });
  }
  return out;
}

/**
 * The trace over the two bitmaps (ImgFile.getDFBitmap's shape) and the painting's palette ((i) => [r, g, b]).
 * Answers { w, h, land, province } - province 1..8 the race ids, IMPERIAL_ID the remainder, 0 at sea - or null
 * when the picker is not the 320 x 200 the law reads.
 */
export function traceTamrielPicture(picker, picture, palette) {
  if (!picker?.data?.length || !picture?.data?.length || picker.data.length !== picture.data.length) return null;
  const { width: w, height: h, data } = picker;
  const sea = seaIndices(palette);
  const land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  for (const race of RACE_TEMPLATES) {
    const mask = new Uint8Array(w * h);
    let n = 0;
    for (let i = 0; i < data.length; i++) if (data[i] === race.id && !sea[picture.data[i]]) { mask[i] = 1; n++; }
    if (!n) continue;
    const ps = pieces(mask, w, h);
    const inland = ps.filter((p) => !p.edge);
    // the province's land: its pieces off the picture's edge (all of them, when every piece touches it - a map painted
    // to the border), each at least a speck
    const kept = (inland.length ? inland : ps).filter((p) => p.cells.length >= SPECK_PX);
    for (const p of kept) for (const i of p.cells) { land[i] = 1; province[i] = race.id; }
  }
  const rem = inlandRemainder(data, w, h, picture, palette);
  if (rem) for (let i = 0; i < rem.mask.length; i++) if (rem.mask[i] && !land[i]) { land[i] = 1; province[i] = IMPERIAL_ID; }
  return { w, h, land, province };
}

/** The palette as the tracer reads it: (index) => [r, g, b], off a DFPalette. */
export const paletteReader = (pal) => (i) => [pal.getRed(i), pal.getGreen(i), pal.getBlue(i)];

/**
 * Read the two files off the data source and trace them. `fetchBytes(name)` and `palette` (ART_PAL's DFPalette) are
 * the world host's own, as every classic art preload takes them. Answers the trace, or null when a file is missing
 * (the authored shape stands, and the console says so).
 */
export async function preloadTamrielTrace({ fetchBytes, palette }) {
  const picture = new ImgFile();
  picture.load(await fetchBytes('TMAP00I0.IMG'), 'TMAP00I0.IMG', palette);
  const picker = new ImgFile();
  picker.load(await fetchBytes('TAMRIEL2.IMG'), 'TAMRIEL2.IMG', palette);
  const pic = picture.getDFBitmap();
  return traceTamrielPicture(picker.getDFBitmap(), pic, paletteReader(picture.palette ?? palette));
}
