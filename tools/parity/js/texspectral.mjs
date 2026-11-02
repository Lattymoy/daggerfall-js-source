import { TextureFile } from '../../../src/formats/textureFile.js';
import { BaseImageFile } from '../../../src/formats/baseImageFile.js';
import { DFPalette } from '../../../src/formats/dfPalette.js';
import { openOut, out, closeOut, read, pad, sha1, sha1Rgba } from './common.mjs';
openOut(process.argv[2]);
const pal = new DFPalette();
pal.load(read('ART_PAL.COL'), 'ART_PAL.COL');
for (const archive of [273, 278, 473]) {
  const name = TextureFile.indexToFileName(archive);
  const tf = new TextureFile();
  if (!tf.load(read(name), name, pal)) { out(`spec.${name}.load`, 0); continue; }
  out(`spec.${name}.isSpectral`, TextureFile.isSpectralArchive(archive));
  for (let r = 0; r < tf.recordCount; r++) {
    for (let f = 0; f < tf.getFrameCount(r); f++) {
      const bm = tf.getDFBitmap(r, f);
      const copy = { width: bm.width, height: bm.height, data: bm.data.slice(), palette: bm.palette };
      tf.setSpectral(copy);
      const p = `spec.${name}.${pad(r, 3)}.f${pad(f, 3)}.`;
      out(p + 'idx', sha1(copy.data));
      out(p + 'albedo', sha1Rgba(tf.getColor32(copy, 0, 0, 247, 180).colors));
      out(p + 'albedoB2', sha1Rgba(tf.getColor32(copy, 0, 2, 247, 180).colors));
    }
  }
}
await closeOut();
