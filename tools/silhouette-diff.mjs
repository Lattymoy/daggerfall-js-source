// C6k diagnostic: per-region silhouette loss. Rasterizes the model
// exactly as the IoU gate does, then reports intersection / sprite-
// only (model MISSING) / model-only (model EXCESS) per body zone, and
// writes a 4x diff PNG (grey = match, red = missing, blue = excess).
// Usage: ARENA2_PATH=... node tools/silhouette-diff.mjs [out.png]
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { buildBody, BARE_PLUGS } from '../src/characters/rewrite/body.js';
import { DAGGER_SPEC } from '../src/characters/daggerBodySpec.js';
import { PAPERDOLL_POSE } from '../src/characters/paperdollPose.js';
import { ImgFile } from '../src/formats/imgFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';

const A = process.env.ARENA2_PATH;
const out = process.argv[2] || '/tmp/sil-diff.png';
const pal = new DFPalette();
pal.load(readFileSync(`${A}/ART_PAL.COL`), 'ART_PAL.COL');
const img = new ImgFile();
img.load(readFileSync(`${A}/BODY00I0.IMG`), 'BODY00I0.IMG', pal);
const bmp = img.getDFBitmap();
const { width: W, height: H, data } = bmp;

const faces = buildBody(
  { loco: 'stand', hold: 'idle', phase: 0, weapon: 'none', paperdoll: PAPERDOLL_POSE },
  BARE_PLUGS, DAGGER_SPEC);
const TM = DAGGER_SPEC.traceMap;
const toCol = (x) => x / TM.u + TM.colOffset;
const toRow = (y) => (H - 0.5) - y / TM.u - TM.rowTop;
const grid = new Uint8Array(W * H);
const tri = (ax, ay, bx, by, cx, cy) => {
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(area) < 1e-9) return;
  for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
    const x = px + 0.5, y = py + 0.5;
    const w0 = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    const w1 = (cx - bx) * (y - by) - (cy - by) * (x - bx);
    const w2 = (ax - cx) * (y - cy) - (ay - cy) * (x - cx);
    const s = Math.sign(area);
    if (w0 * s >= 0 && w1 * s >= 0 && w2 * s >= 0) grid[py * W + px] = 1;
  }
};
for (const f of faces) {
  const np = f.p.length / 3;
  const px = [], py = [];
  for (let i = 0; i < np; i++) { px.push(toCol(f.p[i * 3])); py.push(toRow(f.p[i * 3 + 1])); }
  tri(px[0], py[0], px[1], py[1], px[2], py[2]);
  if (np === 4) tri(px[0], py[0], px[2], py[2], px[3], py[3]);
}

// Zones by row (from the measurement landmarks) + arm columns split
// inside the torso band.
const ZONES = [
  ['head+hair 0-20', 0, 20],
  ['shoulders 21-36', 21, 36],
  ['upper torso 37-52', 37, 52],
  ['lower torso 53-70', 53, 70],
  ['legs 71-125', 71, 125],
  ['feet 126-144', 126, 144],
];
console.log('zone                | inter | MISSING | EXCESS | zoneIoU');
let ti = 0, tu = 0;
for (const [name, y0, y1] of ZONES) {
  let inter = 0, miss = 0, ex = 0;
  for (let y = y0; y <= y1; y++) for (let x = 0; x < W; x++) {
    const s = data[y * W + x] ? 1 : 0, m = grid[y * W + x];
    if (s && m) inter++;
    else if (s) miss++;
    else if (m) ex++;
  }
  ti += inter; tu += inter + miss + ex;
  console.log(`${name.padEnd(19)} | ${String(inter).padStart(5)} | ${String(miss).padStart(7)} | ${String(ex).padStart(6)} | ${(inter / (inter + miss + ex)).toFixed(3)}`);
}
console.log('TOTAL IoU', (ti / tu).toFixed(4));

const png = new PNG({ width: W * 4, height: H * 4 });
for (let y = 0; y < H * 4; y++) for (let x = 0; x < W * 4; x++) {
  const sx = (x / 4) | 0, sy = (y / 4) | 0;
  const s = data[sy * W + sx] ? 1 : 0, m = grid[sy * W + sx];
  let c = [24, 24, 28];
  if (s && m) c = [150, 150, 150];
  else if (s) c = [220, 60, 60];
  else if (m) c = [70, 110, 230];
  const o = (y * W * 4 + x) * 4;
  png.data[o] = c[0]; png.data[o + 1] = c[1]; png.data[o + 2] = c[2]; png.data[o + 3] = 255;
}
writeFileSync(out, PNG.sync.write(png));
