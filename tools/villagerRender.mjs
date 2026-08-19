// An OFFLINE render of the villager designs - a flat orthographic
// painter's-algorithm pass over the same faces the viewer draws, so
// the 25 can be eyeballed without a browser. The real editor is
// tools/neutral (Three.js, orbit); this is the still life.
//
// Usage: ARENA2_PATH=... node tools/villagerRender.mjs [out.png] [--back]
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { DFPalette } from '../src/formats/dfPalette.js';
import { buildNeutralBody } from '../src/characters/neutralBody.js';
import { VILLAGER_DESIGNS, designOpts, designDrape, RACE_TONE } from '../src/characters/villagerDesigns.js';
import { PALETTES } from '../src/characters/palettes.js';
import { drapedPiece } from '../src/characters/pieces/draped.js';
import { compress } from '../src/characters/pieces/pieceLoft.js';

const pal = new DFPalette();
pal.load(readFileSync(process.env.ARENA2_PATH + '/ART_PAL.COL'), 'ART_PAL.COL');
const BACK = process.argv.includes('--back');
// Skin comes from the SAME source the editor uses - palettes.js's
// human tones, picked by RACE_TONE - so the still life and the viewer
// agree. It matters: on one flat tan body for everybody, a Redguard in
// undyed linen read as nude, because the garment sat within a few ramp
// steps of the skin beneath it. That was the stand-in lying, not the
// design failing.
const BOOT = [[38, 30, 22], [70, 56, 42], [104, 84, 62], [138, 112, 84]];
const toneRamp = (race) => {
  const want = RACE_TONE[race];
  const e = PALETTES.human.find((t) => t.name === want) || PALETTES.human[2];
  return e.ramp;
};
const rampsFor = (race) => ({ skin: toneRamp(race), boot: BOOT });

const CELL_W = 150, CELL_H = 300, COLS = 5, SCALE = 130;
const ROWS = Math.ceil(VILLAGER_DESIGNS.length / COLS);
const png = new PNG({ width: CELL_W * COLS, height: CELL_H * ROWS });
for (let i = 0; i < png.data.length; i += 4) { png.data[i] = 20; png.data[i+1] = 22; png.data[i+2] = 26; png.data[i+3] = 255; }

const tri = (buf, zbuf, W, ax, ay, az, bx, by, bz, cx, cy, cz, col) => {
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxX = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy))), maxY = Math.ceil(Math.max(ay, by, cy));
  const d = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(d) < 1e-9) return;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const w0 = ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / d;
    const w1 = ((x - ax) * (cy - ay) - (y - ay) * (cx - ax)) / d;
    if (w0 < 0 || w1 < 0 || w0 + w1 > 1) continue;
    const z = az + (cz - az) * w0 + (bz - az) * w1;
    const o = y * W + x;
    if (o < 0 || o >= zbuf.length) continue;
    if (z <= zbuf[o]) continue;              // keep the nearest
    zbuf[o] = z; buf[o] = col;
  }
};

// HANGING CLOTH. A gown is not a cloth zone - see villagerDesigns.js -
// so a render that draws zones only shows 17 of the 25 as a tunic plus
// a pair of shorts, which is exactly the wrong picture. The drape is
// drawn at REST (drapedPiece is the unsimulated grid; clothSim only
// runs in the live viewer), which is what a still life wants anyway.
//
// draped.js works in the rig's UNCOMPRESSED space - its BODY_CORE tops
// out at y 1.55, the rig's own shoulder - while buildNeutralBody
// returns faces already through pieceLoft's HSCALE. Compressing the
// drape is what puts the two in the same space here.
const drapeFaces = (d) => {
  const dr = designDrape(d, pal);
  return dr ? compress(drapedPiece(dr.name, dr.ramp)) : [];
};

VILLAGER_DESIGNS.forEach((d, n) => {
  const faces = [...buildNeutralBody(rampsFor(d.race), designOpts(d, pal)), ...drapeFaces(d)];
  const W = CELL_W, H = CELL_H;
  const buf = new Int32Array(W * H).fill(-1), zbuf = new Float32Array(W * H).fill(-1e9);
  let minY = 1e9, maxY = -1e9;
  for (const f of faces) for (let i = 0; i < 4; i++) { const y = f.p[i*3+1]; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const cy = (minY + maxY) / 2, sc = SCALE / (maxY - minY);
  const flip = BACK ? -1 : 1;
  for (const f of faces) {
    // back-face cull against the view direction
    if ((BACK ? -f.n[2] : f.n[2]) <= 0) continue;
    const px = [], py = [], pz = [];
    for (let i = 0; i < 4; i++) {
      px.push(W / 2 + f.p[i*3] * sc * flip * 1.9);
      py.push(H / 2 - (f.p[i*3+1] - cy) * sc * 1.9);
      pz.push(f.p[i*3+2] * flip);
    }
    const col = (f.c[0] << 16) | (f.c[1] << 8) | f.c[2];
    tri(buf, zbuf, W, px[0], py[0], pz[0], px[1], py[1], pz[1], px[2], py[2], pz[2], col);
    tri(buf, zbuf, W, px[0], py[0], pz[0], px[2], py[2], pz[2], px[3], py[3], pz[3], col);
  }
  const ox = (n % COLS) * CELL_W, oy = ((n / COLS) | 0) * CELL_H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = buf[y * W + x];
    if (v < 0) continue;
    const o = ((oy + y) * png.width + ox + x) * 4;
    png.data[o] = (v >> 16) & 255; png.data[o+1] = (v >> 8) & 255; png.data[o+2] = v & 255; png.data[o+3] = 255;
  }
});
writeFileSync(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '/home/claude/villager-render.png', PNG.sync.write(png));
console.log('rendered', VILLAGER_DESIGNS.length, BACK ? '(back)' : '(front)');
