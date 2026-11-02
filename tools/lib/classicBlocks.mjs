// CSA-A (2026-09-27): IS A LARGE PICTURE BUILT OUT OF CLASSIC TEXTURES?
//
// The classic-record search (tools/lib/classicSource.mjs findClassicSource)
// asks whether ONE classic record covers a picture of about its own size. A
// mod's 640x640 animation frame is no record's size, so that search passes
// it without looking. This one looks: the picture is cut into aligned blocks
// of each square record size the TEXTURE files use (32, 64, 128), and every
// record of that size is laid on every block; the best share of a block's
// VISIBLE pixels a record matches exactly (RGB; a clear pixel never draws,
// so it is neither a match nor a miss) is the answer. A block less than a
// quarter visible is not judged - a few pixels agree with anything. The search's bar, DERIVED_SHARE of the block,
// is the line between a picture that happens to share a palette's greys and
// one made of a record.
//
// Laid naively that is billions of comparisons, so a record is first bounded
// by colour: it can match no more of a block than the pixels whose colours it
// has at all, counted with their multiplicity on both sides. A record whose
// bound is under the bar is skipped unread.
//
// A FLAT RECORD PROVES NOTHING, so it is not laid at all. TEXTURE.000 is a
// shelf of single-colour swatches (the flat faces of Daggerfall's models),
// and a block that is mostly one grey of the palette "matches" the swatch of
// that grey as far as it is that grey - Come Sail Away's waves reach 59% of a
// 32x32 block against TEXTURE.000 record 119 that way. A record one colour
// covers FLAT_SHARE of is a swatch, and the search says which it skipped.

import { DERIVED_SHARE } from './classicSource.mjs';

const rgbAt = (d, i) => (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];

/** A record one colour covers this much of is a flat swatch, not a picture. */
export const FLAT_SHARE = 0.9;

/** A record's pixels as packed RGB, with its colour counts. */
function prepare(rec) {
  const { width: w, data } = rec.rgba;
  const px = new Int32Array(w * w);
  const counts = new Map();
  for (let i = 0; i < w * w; i++) {
    const c = rgbAt(data, i * 4);
    px[i] = c;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const top = Math.max(...counts.values());
  return { ...rec, w, px, counts, flat: top >= FLAT_SHARE * w * w };
}

/**
 * The best exact match any square classic record that is not a flat swatch
 * makes on an aligned block of `pic` ({ width, height, data } RGBA, rows
 * top-down as the records are).
 * @returns {{ archive:number, record:number, frame:number, size:number, at:[number,number], share:number, flatsSkipped:number } | null}
 */
export function bestClassicBlock(pic, records, sizes = [32, 64, 128]) {
  const prepared = new Map(sizes.map((s) => [s, []]));
  let flats = 0;
  for (const r of records) {
    const { width, height } = r.rgba;
    if (width !== height || !prepared.has(width)) continue;
    const p = prepare(r);
    if (p.flat) flats++;
    else prepared.get(width).push(p);
  }
  let best = null;
  for (const [w, recs] of prepared) {
    for (let by = 0; by + w <= pic.height; by += w) {
      for (let bx = 0; bx + w <= pic.width; bx += w) {
        const block = new Int32Array(w * w);
        const counts = new Map();
        let visible = 0;
        for (let y = 0; y < w; y++) {
          for (let x = 0; x < w; x++) {
            const i = ((by + y) * pic.width + bx + x) * 4;
            if (pic.data[i + 3] === 0) {
              block[y * w + x] = -1;
              continue;
            } // clear: no packed RGB is -1
            const c = rgbAt(pic.data, i);
            block[y * w + x] = c;
            counts.set(c, (counts.get(c) ?? 0) + 1);
            visible++;
          }
        }
        if (visible < (w * w) / 4) continue;
        const floor = Math.max(best?.share ?? 0, 0) * visible;
        for (const r of recs) {
          let bound = 0;
          for (const [c, n] of counts) {
            const m = r.counts.get(c);
            if (m) bound += Math.min(n, m);
          }
          if (bound <= floor) continue;
          let same = 0;
          for (let i = 0; i < w * w; i++) if (block[i] === r.px[i]) same++;
          const share = same / visible;
          if (!best || share > best.share)
            best = { archive: r.archive, record: r.record, frame: r.frame, size: w, at: [bx, by], share };
        }
      }
    }
  }
  return best && { ...best, flatsSkipped: flats };
}

/** A picture cut to the box its visible pixels fill - a small sprite pasted on a clear canvas is judged at its own size. */
export function cropToVisible(pic) {
  let x0 = pic.width,
    y0 = pic.height,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < pic.height; y++) {
    for (let x = 0; x < pic.width; x++) {
      if (pic.data[(y * pic.width + x) * 4 + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1,
    h = y1 - y0 + 1;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    data.set(pic.data.subarray(((y0 + y) * pic.width + x0) * 4, ((y0 + y) * pic.width + x1 + 1) * 4), y * w * 4);
  return { width: w, height: h, data, at: [x0, y0] };
}

/** Whether a block match is a derivation by the search's bar. */
export const isDerivedBlock = (m) => !!m && m.share >= DERIVED_SHARE;
