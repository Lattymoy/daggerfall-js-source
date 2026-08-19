import { TextureFile } from '../../../src/formats/textureFile.js';
import { DFPalette } from '../../../src/formats/dfPalette.js';
import { openOut, out, closeOut, read, files, S, pad, sha1, sha1Rgba } from './common.mjs';

openOut(process.argv[2]);
const pal = new DFPalette();
pal.load(read('ART_PAL.COL'), 'ART_PAL.COL');
for (const name of files(/^TEXTURE\./)) {
  const tf = new TextureFile();
  tf.palette = pal;
  const ok = tf.load(read(name), name, pal);
  const p0 = `tex.${name}.`;
  out(p0 + 'load', ok);
  if (!ok) continue;
  out(p0 + 'recordCount', tf.recordCount);
  out(p0 + 'description', S(tf.description));
  out(p0 + 'paletteName', S(tf.paletteName));
  for (let r = 0; r < tf.recordCount; r++) {
    const p = `${p0}${pad(r, 4)}.`;
    const sz = tf.getSize(r), sc = tf.getScale(r), off = tf.getOffset(r);
    const fc = tf.getFrameCount(r);
    out(p + 'frames', fc);
    out(p + 'w', sz.width); out(p + 'h', sz.height);
    out(p + 'scaleX', sc.width); out(p + 'scaleY', sc.height);
    out(p + 'offX', off.x); out(p + 'offY', off.y);
    for (let f = 0; f < fc; f++) {
      const bm = tf.getDFBitmap(r, f);
      const pf = `${p}f${pad(f, 3)}.`;
      out(pf + 'bw', bm.width); out(pf + 'bh', bm.height);
      out(pf + 'idx', bm.data ? sha1(bm.data) : 'null');
      const c = tf.getColor32(bm, -1, 0, -1, 255);
      out(pf + 'rgba', sha1Rgba(c.colors));
    }
  }
}
await closeOut();
