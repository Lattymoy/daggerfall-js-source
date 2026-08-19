// A colour proof of the 25 villager DESIGNS (villagerDesigns.js), in
// roster order: one card per variation, each material drawn as its
// resolved ART_PAL ramp so the palette can be judged before any
// geometry is built. The legend prints to stdout - pngjs has no font.
//
// Usage: ARENA2_PATH=... node tools/villagerDesignSheet.mjs [out.png]
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { DFPalette } from '../src/formats/dfPalette.js';
import { VILLAGER_DESIGNS, designOpts } from '../src/characters/villagerDesigns.js';

const pal = new DFPalette();
pal.load(readFileSync(process.env.ARENA2_PATH + '/ART_PAL.COL'), 'ART_PAL.COL');

const COLS = 5, CW = 240, BAR = 26, PAD = 10;
const maxMats = Math.max(...VILLAGER_DESIGNS.map((d) => Object.keys(d.mats).length));
const CH = PAD * 2 + maxMats * BAR + 16;
const ROWS = Math.ceil(VILLAGER_DESIGNS.length / COLS);
const png = new PNG({ width: CW * COLS, height: CH * ROWS });
for (let i = 0; i < png.data.length; i += 4) { png.data[i] = 22; png.data[i+1] = 24; png.data[i+2] = 28; png.data[i+3] = 255; }

const px = (x, y, c) => {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const o = (y * png.width + x) * 4;
  png.data[o] = c[0]; png.data[o+1] = c[1]; png.data[o+2] = c[2]; png.data[o+3] = 255;
};

VILLAGER_DESIGNS.forEach((d, i) => {
  const ox = (i % COLS) * CW, oy = ((i / COLS) | 0) * CH;
  const mats = designOpts(d, pal).mats;
  // a race stripe down the left edge so the three cultures read apart
  const stripe = { Redguard: [198, 140, 60], Nord: [110, 150, 130], Breton: [120, 130, 190], Guard: [150, 155, 165] }[d.race];
  for (let y = PAD; y < CH - PAD; y++) for (let x = 0; x < 5; x++) px(ox + PAD + x, oy + y, stripe);
  Object.values(mats).forEach((ramp, m) => {
    const y0 = oy + PAD + m * BAR;
    for (let s = 0; s < ramp.length; s++) {
      const w = Math.floor((CW - PAD * 3 - 8) / ramp.length);
      for (let y = 0; y < BAR - 5; y++) for (let x = 0; x < w; x++) {
        px(ox + PAD + 10 + s * w + x, y0 + y, ramp[s]);
      }
    }
  });
});
writeFileSync(process.argv[2] || '/home/claude/villager-designs.png', PNG.sync.write(png));
console.log('wrote', png.width + 'x' + png.height);
VILLAGER_DESIGNS.forEach((d, i) => console.log(
  String(i).padStart(2), String(d.archive).padStart(3), d.race.padEnd(9), d.gender.padEnd(6),
  d.name.padEnd(16), d.build.padEnd(8), Object.keys(d.mats).join('/')));
