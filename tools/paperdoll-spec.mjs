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
// Pose-invariant landmarks (fork step 1). Vertical rows + stance +
// limb thickness survive the contrapposto; torso WIDTHS do not (arms
// overlap the trunk) - those wait for the pose-matched stance (step 2).
let top = 0;
while (!rows[top].length) top++;
let feet = H - 1;
while (!rows[feet].length) feet--;
// Crotch: first 2-run row whose runs BOTH sit inside the torso band
// (arm-gap rows have a far-left arm run; legs split near centre).
let crotch = -1;
for (let y = top; y < H; y++) {
  const r = rows[y];
  if (r.length === 2 && r[0][0] > 14 && r[1][1] < W - 8
    && Math.abs(width(r[0]) - width(r[1])) < 12) { crotch = y; break; }
}
// First arm separation from the top = the armpit line.
let armpit = -1;
for (let y = top; y < crotch; y++) if (rows[y].length >= 2) { armpit = y; break; }
// Shoulder: widest span above the armpit.
let shoulder = top, shoulderW = 0;
for (let y = top; y <= armpit; y++) {
  if (!rows[y].length) continue;
  const span = rows[y][rows[y].length - 1][1] - rows[y][0][0] + 1;
  if (span > shoulderW) { shoulderW = span; shoulder = y; }
}
// Legs: thickness + stance from a row a few below the crotch.
const legRow = Math.min(H - 1, crotch + 4);
const [L, R] = rows[legRow];
const thighPx = (width(L) + width(R)) / 2;
const hipXpx = Math.abs(mid(R) - mid(L)) / 2;

const RIG_H = 1.922;
const u = RIG_H / (feet - top + 1);
const yRig = (row) => +((feet - row + 0.5) * u).toFixed(4);
const landmarks = {
  imageRows: { top, shoulder, armpit, crotch, feet, W, H },
  rig: {
    pelvisY: yRig(crotch),
    armpitY: yRig(armpit),
    shoulderY: yRig(shoulder),
    hipX: +(hipXpx * u).toFixed(4),
    thighR: +((thighPx / 2) * u).toFixed(4),
    legLen: yRig(crotch),
    unit: +u.toFixed(5),
  },
};
console.log(JSON.stringify(landmarks, null, 1));

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
