import { TextureFile } from '../../../src/formats/textureFile.js';
import { DFPalette } from '../../../src/formats/dfPalette.js';
import { openOut, out, closeOut, read, files, pad, sha1Rgba } from './common.mjs';
openOut(process.argv[2]);
const pal = new DFPalette();
pal.load(read('ART_PAL.COL'), 'ART_PAL.COL');
for (const name of files(/^TEXTURE\./)) {
  const tf = new TextureFile();
  if (!tf.load(read(name), name, pal)) continue;
  for (let r = 0; r < tf.recordCount; r++) {
    const fc = tf.getFrameCount(r);
    for (let f = 0; f < fc; f++) {
      const bm = tf.getDFBitmap(r, f);
      const p = `tp.${name}.${pad(r, 4)}.f${pad(f, 3)}.`;
      let c;
      c = tf.getColor32(bm, 0, 0, -1, 255); out(p + 'a0b0', sha1Rgba(c.colors));
      c = tf.getColor32(bm, 0, 2, -1, 255); out(p + 'a0b2.w', c.width); out(p + 'a0b2.h', c.height); out(p + 'a0b2', sha1Rgba(c.colors));
      c = tf.getColor32(bm, 0, 3, 255, 128); out(p + 'a0b3e255c128', sha1Rgba(c.colors));
      c = tf.getColor32(bm, -1, 1, 0, 64); out(p + 'am1b1e0c64', sha1Rgba(c.colors));
      out(p + 'win', sha1Rgba(tf.getWindowColors32(bm).colors));
      out(p + 'win12', sha1Rgba(tf.getWindowColors32(bm, 12).colors));
    }
  }
}
await closeOut();
