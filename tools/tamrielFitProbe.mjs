#!/usr/bin/env node
// TAMRIEL1 (2026-10-08, bible/03-World/Tamriel.md) - THE FIT PROBE: the authored continent laid over the player's own
// picture of it, and the Bay's edge measured against the data. LOCAL ONLY: it reads ARENA2 and writes a render of it,
// which never ships (Port-Doctrine, A RENDER OF GAME DATA IS GAME DATA) - the output directory is gitignored.
//
//   ARENA2_PATH=/path/to/arena2 node tools/tamrielFitProbe.mjs [--out tamriel-shots]
//
// Three readings, each a number the frame's authored constants (world/tamrielFrame.js BAY_ORIGIN,
// PIXELS_PER_PICTURE_UNIT) and the geography's vertices can be corrected by:
//
//   1. THE OVERLAY: TMAP00I0.IMG (320 x 200, the race screen's Tamriel) as grey, with the authored coast in white,
//      the borders in grey, the Bay's rectangle in black and every city as a dot - `overlay.ppm`. Open it and read
//      where the authored shore leaves the painted one.
//   2. THE PICKER: for each authored province's label and each city, which race TAMRIEL2.IMG's byte names at that
//      point (CreateCharRaceSelect's own law, ui/chargenArt.js raceAtPickerPoint). A label whose race is not its
//      province's is a vertex to move.
//   3. THE SEAM: along each of the Bay's four edges, the runs of land and water WOODS.WLD + CLIMATE.PAK say (the one
//      water law, ui/overworldModel.js isWaterPixel) beside the runs the authored rings say, and every run where they
//      disagree, in Bay pixels. The stitch (ui/tamrielInk.js) joins what agrees within STITCH_REACH; this lists the
//      rest, and where the Bay's own coast ends on its edge with no authored chain to meet it.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ImgFile } from '../src/formats/imgFile.js';
import { WoodsFile } from '../src/formats/woodsFile.js';
import { PakFile } from '../src/formats/pakFile.js';
import { raceAtPickerPoint } from '../src/ui/chargenArt.js';
import { isWaterPixel } from '../src/ui/overworldModel.js';
import { PROVINCES, CITIES, COAST, ISLANDS, BORDERS, closedRing, pts, provinceAt } from '../src/world/tamrielGeography.js';
import { bayPictureRect, bayToPicture, BAY_W, BAY_H, BAY_ORIGIN, PIXELS_PER_PICTURE_UNIT } from '../src/world/tamrielFrame.js';
import { buildTamrielInk, STITCH_REACH } from '../src/ui/tamrielInk.js';
import { landAt, coastChains } from '../src/ui/inkMap.js';

const A2 = process.env.ARENA2_PATH;
if (!A2 || !existsSync(A2)) { console.error('ARENA2_PATH not set or missing'); process.exit(2); }
const outDir = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'tamriel-shots';
mkdirSync(outDir, { recursive: true });
const file = (name) => {
  for (const n of [name, name.toLowerCase()]) { const p = join(A2, n); if (existsSync(p)) return readFileSync(p); }
  throw new Error(`${name} not in ${A2}`);
};

// ── 1. THE OVERLAY ───────────────────────────────────────────────
const picture = new ImgFile();
picture.load(file('TMAP00I0.IMG'), 'TMAP00I0.IMG');
const bmp = picture.getDFBitmap();
const W = bmp.width, H = bmp.height;
const rgb = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) { const g = bmp.data[i]; rgb[i * 3] = g; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = g; }
const plot = (x, y, r, g, b) => { const px = Math.round(x), py = Math.round(y); if (px < 0 || py < 0 || px >= W || py >= H) return; const i = (py * W + px) * 3; rgb[i] = r; rgb[i + 1] = g; rgb[i + 2] = b; };
const line = (a, b, r, g, bl) => { const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2)); for (let k = 0; k <= n; k++) plot(a.x + (b.x - a.x) * k / n, a.y + (b.y - a.y) * k / n, r, g, bl); };
for (const ring of [closedRing(COAST), ...Object.values(ISLANDS).map((r) => closedRing(r))]) for (let i = 0; i + 1 < ring.length; i++) line(ring[i], ring[i + 1], 255, 255, 255);
for (const b of Object.values(BORDERS)) { const run = pts(b.run); for (let i = 0; i + 1 < run.length; i++) line(run[i], run[i + 1], 160, 160, 160); }
const r = bayPictureRect();
for (const [a, b] of [[[r.x0, r.y0], [r.x1, r.y0]], [[r.x1, r.y0], [r.x1, r.y1]], [[r.x1, r.y1], [r.x0, r.y1]], [[r.x0, r.y1], [r.x0, r.y0]]]) line({ x: a[0], y: a[1] }, { x: b[0], y: b[1] }, 0, 0, 0);
for (const c of CITIES) plot(c.at[0], c.at[1], 255, 0, 0);
writeFileSync(join(outDir, 'overlay.ppm'), Buffer.concat([Buffer.from(`P6\n${W} ${H}\n255\n`), Buffer.from(rgb)]));
console.log(`overlay: ${join(outDir, 'overlay.ppm')} (${W}x${H}; the Bay's rectangle at x ${r.x0.toFixed(1)}..${r.x1.toFixed(1)}, y ${r.y0.toFixed(1)}..${r.y1.toFixed(1)})`);

// ── 2. THE PICKER ────────────────────────────────────────────────
const picker = new ImgFile();
picker.load(file('TAMRIEL2.IMG'), 'TAMRIEL2.IMG');
const pick = picker.getDFBitmap();
let off = 0;
for (const p of PROVINCES) {
  const race = raceAtPickerPoint(pick, p.label[0], p.label[1]);
  const ok = p.race === null ? race === null : race?.key === p.race;
  if (!ok) off++;
  console.log(`${ok ? 'ok  ' : 'OFF '} ${p.name.padEnd(18)} label (${p.label}) -> picker says ${race?.key ?? 'none'}, authored ${p.race ?? 'none'}`);
}
for (const c of CITIES) {
  const race = raceAtPickerPoint(pick, c.at[0], c.at[1]);
  const want = PROVINCES.find((p) => p.key === c.province)?.race ?? null;
  const ok = want === null ? race === null : race?.key === want;
  if (!ok) { off++; console.log(`OFF  ${c.name.padEnd(14)} (${c.at}) -> picker says ${race?.key ?? 'none'}, authored ${c.province}`); }
}
console.log(`picker: ${off} off`);

// ── 3. THE SEAM ──────────────────────────────────────────────────
const woods = new WoodsFile();
woods.load(file('WOODS.WLD'));
const climate = new PakFile();
climate.load(file('CLIMATE.PAK'));
const heightBytes = woods.heightMapBuffer;
const climateAt = (x, y) => climate.getValue(x + 1, y);   // MapsFile.getClimateIndex's own +1 column
const dataLand = landAt({ heightBytes, width: BAY_W, climateAt });
const authoredLand = (x, y) => { const [px, py] = bayToPicture(x, y); return provinceAt(px, py) !== null; };
const edges = {
  north: (i) => [i, 0], south: (i) => [i, BAY_H - 1], west: (i) => [0, i], east: (i) => [BAY_W - 1, i],
};
let disagree = 0;
for (const [name, at] of Object.entries(edges)) {
  const n = name === 'north' || name === 'south' ? BAY_W : BAY_H;
  const runs = [];
  let cur = null;
  for (let i = 0; i < n; i++) {
    const [x, y] = at(i);
    const d = dataLand(x, y), a = authoredLand(x + 0.5, y + 0.5);
    const k = `${d ? 'land' : 'water'}/${a ? 'land' : 'water'}`;
    if (cur && cur.k === k) cur.to = i; else { cur = { k, from: i, to: i }; runs.push(cur); }
  }
  for (const run of runs) {
    const [d, a] = run.k.split('/');
    const len = run.to - run.from + 1;
    if (d !== a) disagree += len;
    console.log(`${name.padEnd(6)} ${run.from.toString().padStart(4)}..${run.to.toString().padEnd(4)} data ${d.padEnd(5)} authored ${a.padEnd(5)} ${d !== a ? `DISAGREE ${len} px (${(len * 0.8192).toFixed(0)} km)` : ''}`);
  }
}
const bayCoast = coastChains({ heightBytes, width: BAY_W, height: BAY_H, climateAt });
const ink = buildTamrielInk({ bayCoast });
console.log(`seam: ${disagree} edge pixels disagree; the Bay's coast ends on its edge: ${ink.bayEnds}, joined within ${STITCH_REACH} px: ${ink.joined}`);
console.log(`frame: BAY_ORIGIN (${BAY_ORIGIN.x}, ${BAY_ORIGIN.y}) at ${PIXELS_PER_PICTURE_UNIT} Bay px a picture px - move these in world/tamrielFrame.js if the overlay says so`);
