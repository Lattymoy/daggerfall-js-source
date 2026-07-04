// C6u: the back sheet, shaded THE SAME WAY AS THE FRONT - fully
// derived, nothing invented. Per back pixel: mirror to front space,
// find the owning part from the measured traces (hair band / torso
// rows / arm rows / leg rows), compute the loft cross-section normal
// at that column, light it with the sprite convention (view-relative
// upper-right key, same as the front's), and quantize through the
// FRONT'S OWN palette ramp for that region (skin / hair / boot index
// sets measured from the front sprite itself).
// Usage: ARENA2_PATH=... node tools/gen-back-sheet.mjs
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ImgFile } from '../src/formats/imgFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';

const A = process.env.ARENA2_PATH;
const pal = new DFPalette();
pal.load(readFileSync(`${A}/ART_PAL.COL`), 'ART_PAL.COL');
const img = new ImgFile();
img.load(readFileSync(`${A}/BODY00I0.IMG`), 'BODY00I0.IMG', pal);
const { width: W, height: H, data } = img.getDFBitmap();
const M = JSON.parse(execFileSync('node', ['tools/body-measure.mjs', '00', '0'], { env: process.env }).toString());
const u = M.unit, headCx = M.headCxCol - 0.5; // colOffset carries +0.5
const lum = (i) => { const c = pal.get(i); return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b; };
const yOfRow = (row) => (144 - row + 0.5) * u;

// Region ramps FROM THE FRONT (sorted dark -> bright).
const rampOf = (pxs) => {
  const set = new Map();
  for (const i of pxs) set.set(i, lum(i));
  return [...set.entries()].sort((a, b) => a[1] - b[1]).map((e) => e[0]);
};
const collect = (r0, r1, keep) => {
  const out = [];
  for (let y = r0; y <= r1; y++) for (let x = 0; x < W; x++) {
    const i = data[y * W + x];
    if (i && (!keep || keep(x, y))) out.push(i);
  }
  return out;
};
const skinRamp = rampOf(collect(40, 60, (x) => Math.abs(x - headCx) < 14));
const hairRamp = rampOf(collect(2, 18));
const bootRamp = rampOf(collect(132, 144));

// Part lookup per FRONT row/col, from the measured traces.
const armAt = (side, y) => {
  let best = null;
  for (const r of M.armRows[side]) if (!best || Math.abs(r.y - y) < Math.abs(best.y - y)) best = r;
  return best && Math.abs(best.y - y) < u * 0.8 ? best : null;
};
const rowsAt = (list, y) => {
  let best = null;
  for (const r of list) if (!best || Math.abs(r.y - y) < Math.abs(best.y - y)) best = r;
  return best && Math.abs(best.y - y) < u * 0.8 ? best : null;
};
function partAt(col, row) {
  const y = yOfRow(row);
  const rx0 = (col + 0.5 - headCx) * u; // front-space rig x
  for (const side of ['left', 'right']) {
    const a = armAt(side, y);
    if (a && Math.abs(rx0 - a.cx) <= a.rx) return { ramp: skinRamp, cx: a.cx, rx: a.rx };
  }
  const lw = rowsAt(M.legRows.weight, y), lf = rowsAt(M.legRows.free, y);
  if (lw && Math.abs(rx0 - lw.cx) <= lw.rx) return { ramp: row >= 128 ? bootRamp : skinRamp, cx: lw.cx, rx: lw.rx };
  if (lf && Math.abs(rx0 - lf.cx) <= lf.rx) return { ramp: row >= 128 ? bootRamp : skinRamp, cx: lf.cx, rx: lf.rx };
  const t = M.torsoProfile.find((p) => Math.abs(p.yRig - y) < u * 0.8);
  if (t && Math.abs(rx0 - t.centerRig) <= t.halfW) return { ramp: skinRamp, cx: t.centerRig, rx: t.halfW };
  const h = M.hairRows.find((p) => Math.abs(p.y - y) < u * 0.8);
  if (h && Math.abs(rx0 - h.cx) <= h.halfW) return { ramp: hairRamp, cx: h.cx, rx: h.halfW };
  // silhouette pixel with no owning trace row: nearest fallback = skin mid
  return { ramp: skinRamp, cx: rx0, rx: 1 };
}

// View-relative key light, same convention as the front (upper right).
const L = (() => { const v = [0.5, 0.55, 0.67]; const n = Math.hypot(...v); return v.map((k) => k / n); })();
const png = new PNG({ width: W, height: H });
for (let row = 0; row < H; row++) for (let bx = 0; bx < W; bx++) {
  const fcol = W - 1 - bx; // back sheet is rear-view: mirror to front space
  const o = (row * W + bx) * 4;
  if (!data[row * W + fcol]) { png.data[o + 3] = 0; continue; }
  const p = partAt(fcol, row);
  // Back-view lateral offset: viewer-left on the back = body-right.
  const rx0 = (fcol + 0.5 - headCx) * u;
  const dx = Math.max(-1, Math.min(1, (rx0 - p.cx) / Math.max(1e-4, p.rx)));
  const nx = -dx; // mirrored view flips lateral normal
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx));
  const it = Math.max(0.06, nx * L[0] + 0.12 * L[1] + nz * L[2]);
  // Continuous ramp: LERP between adjacent ramp colours instead of
  // snapping to one index - snapping banded the back into ~14 flat
  // blocks (the blocky relief), the front reads continuous sprite
  // luminance and stays smooth. Endpoints stay palette-exact.
  const f = (1 - it) * (p.ramp.length - 1);
  const k = Math.max(0, Math.min(p.ramp.length - 2, Math.floor(f)));
  const frac = Math.max(0, Math.min(1, f - k));
  const c0 = pal.get(p.ramp[k]), c1 = pal.get(p.ramp[k + 1]);
  const c = { r: Math.round(c0.r + (c1.r - c0.r) * frac), g: Math.round(c0.g + (c1.g - c0.g) * frac), b: Math.round(c0.b + (c1.b - c0.b) * frac) };
  png.data[o] = c.r; png.data[o + 1] = c.g; png.data[o + 2] = c.b; png.data[o + 3] = 255;
}
writeFileSync('src/characters/paint/body-back.png', PNG.sync.write(png));
console.log('back sheet shaded | ramp sizes skin/hair/boot:', skinRamp.length, hairRamp.length, bootRamp.length);
