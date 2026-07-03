// DAGGER_SPEC extraction (C6 restructure): derive the rig's proportion
// spec from the CLASSIC BODY - BODY{race}I{gender}.IMG, the canonical
// body every item sprite seats on. Per-row opaque-RUN analysis:
//   1 run  = head / neck / shoulders / hips (contiguous)
//   3 runs = arm | torso | arm  -> the middle run IS the torso width
//   2 runs = legs               -> crotch row + leg centres (hipX)
// Landmarks: shoulder peak (max width), neck (min 1-run width above
// shoulders), waist (min middle-run width), armpit (topmost 3-run
// row), crotch (first persistent 2-run row). Depth (rz) keeps
// Voxlight's per-prism rz/rx ratios - the sprite is a front view;
// that single documented assumption replaces every per-piece guess.
// Pixel aspect 1:1 (DFU paperdoll parity; classic CRT stretch noted).
// Usage: ARENA2_PATH=... node tools/paperdoll-spec.mjs [race] [gender01] [overlay.png]
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { ImgFile } from '../src/formats/imgFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';

const A = process.env.ARENA2_PATH;
const race = process.argv[2] ?? '00';
const gender = process.argv[3] ?? '0';
const overlayOut = process.argv[4];

const pal = new DFPalette();
pal.load(readFileSync(`${A}/ART_PAL.COL`), 'ART_PAL.COL');
const img = new ImgFile();
img.load(readFileSync(`${A}/BODY${race}I${gender}.IMG`), `BODY${race}I${gender}.IMG`, pal);
const bmp = img.getDFBitmap();
const { width: W, height: H, data } = bmp;

// Per-row runs of opaque pixels.
const rows = [];
for (let y = 0; y < H; y++) {
  const runs = [];
  let start = -1;
  for (let x = 0; x <= W; x++) {
    const on = x < W && data[y * W + x] !== 0;
    if (on && start < 0) start = x;
    if (!on && start >= 0) { runs.push([start, x - 1]); start = -1; }
  }
  rows.push(runs);
}
const width = (r) => r[1] - r[0] + 1;
const mid = (r) => (r[0] + r[1]) / 2;

// FINDING (checkpoint): BODY images are the classic CONTRAPPOSTO POSE -
// weight leg, asymmetric arms, forward foot. Symmetric per-row widths
// from this silhouette are invalid (the pose-measurement class again).
// This tool currently emits the RUN PROFILE + the overlay for study;
// spec derivation resumes on the pose decision (see Characters-Arc:
// pose-matched paperdoll stance vs pose-invariant landmark spec).
let out = '';
for (let y = 0; y < H; y++) {
  out += y + ': ' + rows[y].map((r) => r[0] + '-' + r[1]).join(' ') + '\n';
}
console.log(out);

if (overlayOut) {
  const png = new PNG({ width: W * 4, height: H * 4 });
  const put = (x, y, r, g, b) => { for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) { const o = ((y * 4 + sy) * W * 4 + x * 4 + sx) * 4; png.data[o] = r; png.data[o + 1] = g; png.data[o + 2] = b; png.data[o + 3] = 255; } };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const idx = data[y * W + x];
    const c = idx === 0 ? { r: 34, g: 34, b: 38 } : pal.get(idx);
    put(x, y, c.r, c.g, c.b);
  }
  writeFileSync(overlayOut, PNG.sync.write(png));
}
