import { CifRciFile } from '../../../src/formats/cifRciFile.js';
import { DFPalette } from '../../../src/formats/dfPalette.js';
import { openOut, out, closeOut, read, files, S, pad, sha1, sha1Rgba } from './common.mjs';

openOut(process.argv[2]);
const pal = new DFPalette();
pal.load(read('ART_PAL.COL'), 'ART_PAL.COL');
const names = [...files(/\.CIF$/), ...files(/\.RCI$/)].sort();
for (const name of names) {
  const cf = new CifRciFile();
  const ok = cf.load(read(name), name, pal);
  const p0 = `cif.${name}.`;
  out(p0 + 'load', ok);
  if (!ok) continue;
  out(p0 + 'recordCount', cf.recordCount);
  out(p0 + 'paletteName', S(cf.paletteName));
  for (let r = 0; r < cf.recordCount; r++) {
    const p = `${p0}${pad(r, 3)}.`;
    const sz = cf.getSize(r), off = cf.getOffset(r);
    const fc = cf.getFrameCount(r);
    out(p + 'frames', fc);
    out(p + 'w', sz.width); out(p + 'h', sz.height);
    out(p + 'offX', off.x); out(p + 'offY', off.y);
    for (let f = 0; f < fc; f++) {
      const bm = cf.getDFBitmap(r, f);
      const pf = `${p}f${pad(f, 3)}.`;
      out(pf + 'bw', bm.width); out(pf + 'bh', bm.height);
      out(pf + 'idx', bm.data ? sha1(bm.data) : 'null');
      out(pf + 'rgba', sha1Rgba(cf.getColor32(bm, -1, 0, -1, 255).colors));
    }
  }
}
await closeOut();
