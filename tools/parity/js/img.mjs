import { ImgFile } from '../../../src/formats/imgFile.js';
import { DFPalette } from '../../../src/formats/dfPalette.js';
import { openOut, out, closeOut, read, files, S, sha1, sha1Rgba } from './common.mjs';

openOut(process.argv[2]);
const artPal = read('ART_PAL.COL');
for (const name of files(/\.IMG$/)) {
  const pal = new DFPalette();
  pal.load(artPal, 'ART_PAL.COL');
  const im = new ImgFile();
  const ok = im.load(read(name), name, pal);
  const p0 = `img.${name}.`;
  out(p0 + 'load', ok);
  if (!ok) continue;
  out(p0 + 'paletteName', S(im.paletteName));
  out(p0 + 'recordCount', im.recordCount);
  out(p0 + 'frames', im.getFrameCount(0));
  const sz = im.getSize(0);
  out(p0 + 'w', sz.width); out(p0 + 'h', sz.height);
  out(p0 + 'isPalettized', im.isPalettized);
  out(p0 + 'offX', im.imageOffset.x); out(p0 + 'offY', im.imageOffset.y);
  const bm = im.getDFBitmap(0, 0);
  out(p0 + 'bw', bm.width); out(p0 + 'bh', bm.height);
  out(p0 + 'idx', bm.data ? sha1(bm.data) : 'null');
  out(p0 + 'rgba', sha1Rgba(im.getColor32(bm, -1, 0, -1, 255).colors));
}
await closeOut();
