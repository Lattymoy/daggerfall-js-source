import { SndFile } from '../../../src/formats/sndFile.js';
import { PakFile, PAK_WIDTH, PAK_HEIGHT } from '../../../src/formats/pakFile.js';
import { FntFile, FNT_GLYPH_COUNT } from '../../../src/formats/fntFile.js';
import { GfxFile } from '../../../src/formats/gfxFile.js';
import { SkyFile } from '../../../src/formats/skyFile.js';
import { DFPalette } from '../../../src/formats/dfPalette.js';
import { openOut, out, closeOut, read, files, pad, S, sha1 } from './common.mjs';
import fs from 'node:fs';
import path from 'node:path';

const ARENA2 = process.env.ARENA2_PATH || (process.env.ARENA2_PATH ?? '');
openOut(process.argv[2]);

// ---- SND ----
for (const name of files(/\.SND$/)) {
  const sf = new SndFile();
  const ok = sf.load(read(name));
  const p0 = `snd.${name}.`;
  out(p0 + 'load', ok);
  if (!ok) continue;
  out(p0 + 'count', sf.count);
  for (let i = 0; i < sf.count; i++) {
    const s = sf.getSound(i);
    const p = `${p0}${pad(i, 4)}.`;
    out(p + 'ok', s !== null);
    if (!s) continue;
    out(p + 'name', S(s.name));
    out(p + 'len', s.waveData === null ? -1 : s.waveData.length);
    out(p + 'sha', sha1(s.waveData));
    out(p + 'hdr', sha1(s.waveHeader));
    sf.discardSound(i);
  }
}
// ---- PAK ----
for (const name of files(/\.PAK$/)) {
  const pf = new PakFile();
  const ok = pf.load(read(name));
  const p0 = `pak.${name}.`;
  out(p0 + 'load', ok);
  if (!ok) continue;
  const vals = new Uint8Array(1001 * 500);
  let k = 0;
  for (let y = 0; y < 500; y++) for (let x = 0; x < 1001; x++) vals[k++] = pf.getValue(x, y) & 0xff;
  out(p0 + 'values.sha', sha1(vals));
  const bm = pf.getDFBitmap();
  out(p0 + 'bmp.w', bm.width); out(p0 + 'bmp.h', bm.height);
  out(p0 + 'bmp.sha', sha1(bm.data));
  for (let y = 0; y < 500; y += 41) for (let x = 0; x < 1001; x += 43)
    out(`${p0}v.${pad(x, 4)}.${pad(y, 4)}`, pf.getValue(x, y));
}
// ---- FNT ----
for (const name of files(/^FONT.*\.FNT$/)) {
  const ff = new FntFile();
  let ok = true;
  try { ff.load(read(name)); } catch (e) { ok = false; }
  const p0 = `fnt.${name}.`;
  out(p0 + 'load', ok);
  if (!ok) continue;
  for (let i = 0; i < FNT_GLYPH_COUNT; i++) {
    const p = `${p0}${pad(i, 3)}.`;
    out(p + 'width', ff.glyphWidth(i));
    out(p + 'bytes', sha1(ff.glyphs[i].data));
    out(p + 'pixels', sha1(ff.getGlyphPixels(i)));
  }
}
// ---- GFX ----
for (const name of files(/\.GFX$/)) {
  const gf = new GfxFile();
  const ok = gf.load(read(name), name);
  const p0 = `gfx.${name}.`;
  out(p0 + 'load', ok);
  if (!ok) continue;
  out(p0 + 'recordCount', 1);
  const p = `${p0}${pad(0, 3)}.`;
  out(p + 'w', gf.width); out(p + 'h', gf.height);
  out(p + 'frames', gf.getFrameCount());
  for (let f = 0; f < gf.getFrameCount(); f++) {
    const bm = gf.getDFBitmap(0, f);
    out(`${p}f${pad(f, 2)}.bw`, bm.width);
    out(`${p}f${pad(f, 2)}.bh`, bm.height);
    out(`${p}f${pad(f, 2)}.idx`, sha1(bm.data));
  }
}
// ---- SKY ----
for (let i = 0; i < 32; i++) {
  const name = SkyFile.indexToFileName(i);
  if (!fs.existsSync(path.join(ARENA2, name))) continue;
  const sk = new SkyFile();
  const ok = sk.load(read(name), name);
  const p0 = `sky.${name}.`;
  out(p0 + 'load', ok);
  if (!ok) continue;
  out(p0 + 'recordCount', sk.recordCount);
  out(p0 + 'frameCount', sk.getFrameCount(0));
  const sz = sk.getSize(0);
  out(p0 + 'w', sz.width); out(p0 + 'h', sz.height);
  for (let f = 0; f < sk.getFrameCount(0); f++) {
    const p = `${p0}f${pad(f, 2)}.`;
    out(p + 'pal', sha1(sk.getDFPalette(f).paletteBuffer));
    const bm = sk.getDFBitmap(0, f);
    out(p + 'bw', bm.width); out(p + 'bh', bm.height);
    out(p + 'idx', sha1(bm.data));
  }
}
// ---- PALETTES ----
for (const name of files(/\.COL$/)) {
  const dp = new DFPalette();
  const ok = dp.load(read(name), name);
  const p0 = `pal.${name}.`;
  out(p0 + 'load', ok);
  if (!ok) continue;
  out(p0 + 'headerLength', dp.headerLength);
  out(p0 + 'sha', sha1(dp.paletteBuffer));
  for (let i = 0; i < 256; i++)
    out(`${p0}${pad(i, 3)}`, `${dp.getRed(i)},${dp.getGreen(i)},${dp.getBlue(i)}`);
}
for (const name of files(/\.PAL$/)) {
  const dp = new DFPalette();
  const ok = dp.load(read(name), name);
  const p0 = `pal.${name}.`;
  out(p0 + 'load', ok);
  if (!ok) continue;
  out(p0 + 'headerLength', dp.headerLength);
  out(p0 + 'sha', sha1(dp.paletteBuffer));
}
// ---- CLASSES.DAT ----
{
  const p = path.join(ARENA2, 'CLASSES.DAT');
  if (fs.existsSync(p)) out('class.CLASSES.DAT.length', fs.statSync(p).size);
}
await closeOut();
