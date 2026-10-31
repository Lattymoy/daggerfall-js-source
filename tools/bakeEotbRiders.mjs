// AUDIT-STOREFRONT (2026-10-29, the owner: "the horse designs are awful"; bible/06-Systems/Horse-Coats.md RIDERS):
// EACH MOUNTED PICTURE'S RIDER, FOUND BY THE OTHER FOUR SETS.
//
//     ARENA2_PATH=<arena2> node tools/bakeEotbRiders.mjs           write src/player/eyeOfTheBeholder/eotbRiderMasks.js
//     ARENA2_PATH=<arena2> node tools/bakeEotbRiders.mjs --check   say whether it is the pictures'
//
// Eye Of The Beholder's mounted sets (archives 112382-112386) are one horse under five riders, picture for picture.
// A coat or a mount look took a rider's skin for hide and his hair for points; no rule on one picture told them apart
// without flicker from frame to frame. Laid on each other (by their bottom row, then the offset that agrees most) the
// horse's pixels agree in three sets or more and a rider's in none: a pixel of a set that agrees with fewer than two
// others, and with no other set's sure horse there, is its rider's. Speckles of shading smaller than RIDER_SPECK are the horse's, and gaps in a rider smaller than
// RIDER_HOLE are his. The masks are runs, packed as below, read by eotbSprite.js riderSpareOf.
// NO-BETHESDA2 (2026-10-31): the five sets are Daggerfall's own TEXTURE.491-495, carried as specs, so the pictures are
// built from the player's ARENA2 (tools/lib/eotbPictures.mjs).
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from './lib/isMain.mjs';
import { eotbPictures } from './lib/eotbPictures.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/player/eyeOfTheBeholder/eotbRiderMasks.js');
/** The mounted sets, and their pictures: records 0-4 standing (one frame), 5-14 moving (eight). */
export const RIDER_SETS = Object.freeze([112382, 112383, 112384, 112385, 112386]);
export const RIDER_RECORDS = Object.freeze(Array.from({ length: 15 }, (_, r) => Array.from({ length: r < 5 ? 1 : 8 }, (_, f) => `${r}-${f}`)).flat());
/** Two pixels agree under this sum of channel differences. */
export const RIDER_TOL = 30;
/** How far (px) past the bottom rows' alignment the best offset is looked for. */
export const RIDER_SHIFT = 3;
/** A rider is a component this big at least (8-connected); a hole in one smaller than RIDER_HOLE (4-connected) is his. */
export const RIDER_SPECK = 10;
export const RIDER_HOLE = 8;

const same = (a, o, b, q) => Math.abs(a[o] - b[q]) + Math.abs(a[o + 1] - b[q + 1]) + Math.abs(a[o + 2] - b[q + 2]) < RIDER_TOL;
/** Where `b`'s pixel for `a`'s (x, y) is, (x + dx, y + dy): the offset agreeing most, near the bottoms aligned. */
function offsetOf(a, b) {
  const base = b.height - a.height;
  let best = { dx: 0, dy: base, n: -1 };
  for (let dy = base - RIDER_SHIFT; dy <= base + RIDER_SHIFT; dy++) for (let dx = -RIDER_SHIFT; dx <= RIDER_SHIFT; dx++) {
    let n = 0;
    for (let y = Math.max(0, -dy); y < Math.min(a.height, b.height - dy); y++) for (let x = Math.max(0, -dx); x < Math.min(a.width, b.width - dx); x++) {
      const o = (y * a.width + x) * 4, q = ((y + dy) * b.width + x + dx) * 4;
      if (a.data[o + 3] && b.data[q + 3] && same(a.data, o, b.data, q)) n++;
    }
    if (n > best.n) best = { dx, dy, n };
  }
  return best;
}
/** Components of `on` (4- or 8-connected); `keep(comp)` answers whether a component keeps its value. */
function components(on, w, h, eight, visit) {
  const seen = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!on(i) || seen[i]) continue;
    const comp = [i]; seen[i] = 1;
    for (let c = 0; c < comp.length; c++) {
      const p = comp[c], x = p % w, y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || (!eight && dx && dy)) continue;
        const X = x + dx, Y = y + dy, q = Y * w + X;
        if (X >= 0 && Y >= 0 && X < w && Y < h && on(q) && !seen[q]) { seen[q] = 1; comp.push(q); }
      }
    }
    visit(comp);
  }
}

/** One record's five pictures' riders: `[{ key, w, h, mask }]` by RIDER_SETS (rows top first, 1 a rider's pixel).
 *  `pictures` the sprites' reader (lib/eotbPictures.mjs). */
export async function ridersOfRecord(rec, pictures = eotbPictures()) {
  const pics = await Promise.all(RIDER_SETS.map((s) => pictures.picture(`${s}_${rec}`)));
  const off = pics.map((b) => offsetOf(pics[0], b));   // each set on the first
  /** `fn(j, q)` for each other set's pixel over set k's (x, y) that agrees with it. */
  const agreeing = (k, x, y, fn) => {
    const a = pics[k], o = (y * a.width + x) * 4;
    for (let j = 0; j < pics.length; j++) {
      if (j === k) continue;
      const b = pics[j], X = x + off[j].dx - off[k].dx, Y = y + off[j].dy - off[k].dy;
      if (X < 0 || Y < 0 || X >= b.width || Y >= b.height) continue;
      const q = Y * b.width + X;
      if (b.data[q * 4 + 3] && same(a.data, o, b.data, q * 4)) fn(j, q);
    }
  };
  // the horse for sure: three sets or more agree; then a pixel one sure pixel agrees with (the others' riders over it)
  const sure = pics.map((a, k) => {
    const out = new Uint8Array(a.width * a.height);
    for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) {
      if (!a.data[(y * a.width + x) * 4 + 3]) continue;
      let n = 0; agreeing(k, x, y, () => n++);
      if (n >= 2) out[y * a.width + x] = 1;
    }
    return out;
  });
  return pics.map((a, k) => {
    const { width: w, height: h } = a, n = w * h, cand = new Uint8Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!a.data[i * 4 + 3] || sure[k][i]) continue;
      let horse = false; agreeing(k, x, y, (j, q) => { if (sure[j][q]) horse = true; });
      if (!horse) cand[i] = 1;
    }
    const mask = new Uint8Array(n);
    components((i) => cand[i] === 1, w, h, true, (comp) => { if (comp.length >= RIDER_SPECK) for (const p of comp) mask[p] = 1; });
    // a hole: opaque, not his, and enclosed by him alone (no pixel of it beside a horse's, the air or the picture's edge)
    components((i) => !mask[i] && a.data[i * 4 + 3] > 0, w, h, false, (comp) => {
      if (comp.length >= RIDER_HOLE) return;
      const inside = comp.every((p) => { const x = p % w, y = (p - x) / w; return x > 0 && y > 0 && x < w - 1 && y < h - 1 && [p - 1, p + 1, p - w, p + w].every((q) => mask[q] || comp.includes(q)); });
      if (inside) for (const p of comp) mask[p] = 1;
    });
    return { key: `${RIDER_SETS[k]}_${rec}`, w, h, mask };
  });
}

/** A mask's runs (not his, his, ...; top row first), each a little-endian base-128 number, as base64. */
export function packMask(mask) {
  const bytes = [];
  let cur = 0, len = 0;
  const put = (v) => { while (v >= 128) { bytes.push((v & 127) | 128); v >>>= 7; } bytes.push(v); };
  for (let i = 0; i < mask.length; i++) { if (mask[i] !== cur) { put(len); len = 0; cur = mask[i]; } len++; }
  put(len);
  return Buffer.from(bytes).toString('base64');
}

/** The module's text, every record's every set. */
export async function riderMasksText(pictures = eotbPictures()) {
  const rows = [];
  for (const rec of RIDER_RECORDS) for (const r of await ridersOfRecord(rec, pictures)) rows.push(`  '${r.key}': '${r.w}x${r.h}:${packMask(r.mask)}',`);
  return `// GENERATED by tools/bakeEotbRiders.mjs (AUDIT-STOREFRONT, bible/06-Systems/Horse-Coats.md RIDERS) - do not edit by hand:
// run it, and \`--check\` to hold it. Each mounted picture's rider, \`<width>x<height>:<runs>\` (the tool's packMask),
// read by eotbSprite.js riderSpareOf - loaded on the first dye of a mounted picture, never at boot.
export const RIDER_MASKS = Object.freeze({
${rows.join('\n')}
});
`;
}

if (isMain(import.meta.url)) {
  if (!process.env.ARENA2_PATH) { console.error('ARENA2_PATH is not set: sh tools/fetch-data.sh, then point it at the arena2 folder'); process.exit(2); }
  const text = await riderMasksText();
  if (process.argv.includes('--check')) {
    if (readFileSync(OUT, 'utf8') !== text) { console.error('src/player/eyeOfTheBeholder/eotbRiderMasks.js is not the pictures\': run node tools/bakeEotbRiders.mjs'); process.exit(1); }
    console.log('eotbRiderMasks.js is the pictures\'');
  } else {
    writeFileSync(OUT, text);
    console.log(`wrote ${OUT} (${RIDER_RECORDS.length * RIDER_SETS.length} pictures, ${(text.length / 1024).toFixed(0)} KB)`);
  }
}
