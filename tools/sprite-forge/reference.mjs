// The forge's reference: one classic sprite archive's outlines and colour classes from the player's own ARENA2,
// written to a file outside the repo for `forge.py --register` (placing the body in each record's canvas) and
// `fit.py` (fitting each frame's pose and the materials' colours). Each texel is a digit: 0 clear, 1 other, 2 skin,
// 3 boot teal, 4 cloth green; `rgb` holds each texel's colour as six hex digits. All of it is game data: it never
// enters the repo.
//   ARENA2_PATH=... node tools/sprite-forge/reference.mjs 488 /tmp/forge-ref-488.json
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { TextureFile, texName } from '../../src/formats/textureFile.js';
import { DFPalette } from '../../src/formats/dfPalette.js';

/** A texel's class from its colour. */
export function colourClass(r, g, b) {
  if (g > r + 20 && b > r + 20) return 3;
  if (g > r + 12 && g > b + 15) return 4;
  if (r > g + 25 && r > b + 35 && r > 70) return 2;
  return 1;
}

const [archive, out] = process.argv.slice(2);
const arena2 = process.env.ARENA2_PATH;
if (!arena2 || !archive || !out) {
  console.error('usage: ARENA2_PATH=<arena2> node tools/sprite-forge/reference.mjs <archive> <out.json>');
  process.exit(2);
}
if (resolve(out).startsWith(resolve(import.meta.dirname, '../..'))) {
  console.error('write the reference outside the repo: it holds game data');
  process.exit(2);
}
const pal = new DFPalette();
pal.load(new Uint8Array(readFileSync(join(arena2, 'ART_PAL.COL'))));
const tf = new TextureFile();
const name = texName(Number(archive));
tf.load(new Uint8Array(readFileSync(join(arena2, name))), name);
const records = [];
for (let r = 0; r < tf.recordCount; r++) {
  const frames = [];
  const rgb = [];
  const hex = (v) => [pal.getRed(v), pal.getGreen(v), pal.getBlue(v)].map((c) => c.toString(16).padStart(2, '0')).join('');
  for (let f = 0; f < tf.getFrameCount(r); f++) {
    const bm = tf.getDFBitmap(r, f);
    // index 0 is a sprite's clear texel
    frames.push(Array.from(bm.data, (v) => (v ? colourClass(pal.getRed(v), pal.getGreen(v), pal.getBlue(v)) : 0)).join(''));
    rgb.push(Array.from(bm.data, hex).join(''));
  }
  const { width, height } = tf.getSize(r);
  records.push({ canvas: [width, height], frames, rgb });
}
writeFileSync(out, JSON.stringify({ archive: Number(archive), records }));
console.log(`${name}: ${records.length} records -> ${out}`);
