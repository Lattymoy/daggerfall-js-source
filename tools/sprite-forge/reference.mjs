// The forge's reference: one classic sprite archive's outlines (alpha only) from the player's own ARENA2, written to
// a file outside the repo for `forge.py --register` to place the forge's body in each record's canvas. The outlines
// are game data: they never enter the repo.
//   ARENA2_PATH=... node tools/sprite-forge/reference.mjs 488 /tmp/forge-ref-488.json
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { TextureFile, texName } from '../../src/formats/textureFile.js';

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
const tf = new TextureFile();
const name = texName(Number(archive));
tf.load(new Uint8Array(readFileSync(join(arena2, name))), name);
const records = [];
for (let r = 0; r < tf.recordCount; r++) {
  const frames = [];
  for (let f = 0; f < tf.getFrameCount(r); f++) {
    const bm = tf.getDFBitmap(r, f);
    // index 0 is a sprite's clear texel
    frames.push(Array.from(bm.data, (v) => (v ? 1 : 0)).join(''));
  }
  const { width, height } = tf.getSize(r);
  records.push({ canvas: [width, height], frames });
}
writeFileSync(out, JSON.stringify({ archive: Number(archive), records }));
console.log(`${name}: ${records.length} records -> ${out}`);
