// C6L: hand-shading kit for Mac. Exports the two paintable sheets in
// classic sprite space (69x145, 1:1 pixels - the doctrine resolution):
//   body-front.png - STARTER = the classic BODY00I0 itself (edit or keep)
//   body-back.png  - STARTER = the mirrored front as an underlay guide
//     (repaint the content; the SILHOUETTE must stay - pixels outside
//     the front mask are ignored by the loader)
// Plus 4x previews for eyeballing. The engine samples these per face
// (front/back by normal); transparent pixel 0 = fall through to the
// classic projection.
// Usage: ARENA2_PATH=... node tools/export-paint-sheets.mjs [outdir]
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ImgFile } from '../src/formats/imgFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';

const A = process.env.ARENA2_PATH;
const OUT = resolve(process.argv[2] || 'src/characters/paint');
mkdirSync(OUT, { recursive: true });
const pal = new DFPalette();
pal.load(readFileSync(`${A}/ART_PAL.COL`), 'ART_PAL.COL');
const img = new ImgFile();
img.load(readFileSync(`${A}/BODY00I0.IMG`), 'BODY00I0.IMG', pal);
const { width: W, height: H, data } = img.getDFBitmap();

const write = (name, pick, scale = 1) => {
  const png = new PNG({ width: W * scale, height: H * scale });
  for (let y = 0; y < H * scale; y++) for (let x = 0; x < W * scale; x++) {
    const sx = (x / scale) | 0, sy = (y / scale) | 0;
    const [r, g, b, a] = pick(sx, sy);
    const o = (y * W * scale + x) * 4;
    png.data[o] = r; png.data[o + 1] = g; png.data[o + 2] = b; png.data[o + 3] = a;
  }
  writeFileSync(resolve(OUT, name), PNG.sync.write(png));
  console.log(name, `${W * scale}x${H * scale}`);
};
const front = (x, y) => {
  const i = data[y * W + x];
  if (!i) return [0, 0, 0, 0];
  const c = pal.get(i);
  return [c.r, c.g, c.b, 255];
};
// The back is NOT a mirrored front (Mac): the starter is a FLAT
// mid-tone silhouette - the back's own detail is hand-authored via
// the paint sheet, and back relief stays empty until then. Mid-tone =
// the front's median opaque luminance mapped back to its palette
// index, so painted-over strokes sit in the same value range.
let midIdx = 0;
{
  const ls = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = data[y * W + x]; if (i) ls.push({ i, l: (() => { const c = pal.get(i); return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b; })() }); }
  ls.sort((a, b) => a.l - b.l);
  midIdx = ls[(ls.length / 2) | 0].i;
}
const back = (x, y) => {
  const i = data[y * W + (W - 1 - x)]; // mirror only the SILHOUETTE mask
  if (!i) return [0, 0, 0, 0];
  const c = pal.get(midIdx);
  return [c.r, c.g, c.b, 255];
};
write('body-front.png', front);
write('body-back.png', back);
write('body-front-4x.png', front, 4);
write('body-back-4x.png', back, 4);
console.log('paint at 1x; the 4x files are previews only. Silhouette is the law: pixels outside the mask are ignored.');
