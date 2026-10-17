#!/usr/bin/env node
// RW1 (2026-10-09), GLASS-ALL (2026-10-11): WHICH INTERIOR TEXELS ARE GLASS - read off the player's own ARENA2, so the
// rule world/interior/interiorGlass.js interiorGlassMask carries can be checked against the data.
//
//     node tools/windowGlassScan.mjs /path/to/ARENA2            every building interior set's window wall
//     node tools/windowGlassScan.mjs /path/to/ARENA2 --all      and every record of those sets carrying the glass index
//
// For every TEXTURE.nnn of a building interior set in a climate an interior is laid out in (interiorGlass.js
// isInteriorGlassArchive) it prints the set's window wall (interiorWindowOf - record 2 against its twin, record 1, but
// for the two castles) and the glass the rule finds in it: its texel count, its share of the picture and the box it
// spans. With --all it prints every record of those archives that carries the palette's 0xff, the index RW1 read glass
// off, beside them. Reads the player's files where they lie and writes nothing: no raster of game data leaves the
// machine (Port-Doctrine).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { isMain } from './lib/isMain.mjs';
import { TextureFile } from '../src/formats/textureFile.js';
import { isInteriorGlassArchive, interiorWindowOf, interiorGlassMask, GLASS_INDEX } from '../src/world/interior/interiorGlass.js';

/** One archive's window wall and the glass the rule finds in it ({ glass: 0 } when it finds none), or null when the
 *  archive is not a building set or its set has no window. Pure over a TextureFile. */
export function windowOfArchive(tf, archive) {
  const win = interiorWindowOf(archive);
  if (!win || win.record >= tf.recordCount) return null;
  const bm = tf.getDFBitmap(win.record, 0);
  const mask = interiorGlassMask(archive, win.record, bm, (r) => (r < tf.recordCount ? tf.getDFBitmap(r, 0) : null));
  let n = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  if (mask) for (let y = 0; y < mask.height; y++) for (let x = 0; x < mask.width; x++) {
    if (mask.colors[(y * mask.width + x) * 4] < 128) continue;
    n++;
    const yy = mask.height - 1 - y;   // the mask's rows are bottom-up (getWindowColors32's shape); the box is the bitmap's
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
  }
  return { archive, record: win.record, twin: win.twin, width: bm.width, height: bm.height, glass: n, share: n / (bm.width * bm.height), box: n ? [x0, y0, x1, y1] : null };
}

/** Every record of one archive carrying the glass index: { record, count }. */
export function glassIndexRecords(tf) {
  const out = [];
  for (let r = 0; r < tf.recordCount; r++) {
    const d = tf.getDFBitmap(r, 0)?.data;
    if (!d) continue;
    let n = 0;
    for (let i = 0; i < d.length; i++) if (d[i] === GLASS_INDEX) n++;
    if (n) out.push({ record: r, count: n });
  }
  return out;
}

if (isMain(import.meta.url)) {
  const dir = process.argv[2];
  const all = process.argv.includes('--all');
  if (!dir || !existsSync(dir)) {
    console.log('usage: node tools/windowGlassScan.mjs /path/to/ARENA2 [--all]');
    process.exit(2);
  }
  const archives = readdirSync(dir).map((f) => /^TEXTURE\.(\d{3})$/i.exec(f)).filter(Boolean).map((m) => Number(m[1])).filter(isInteriorGlassArchive).sort((a, b) => a - b);
  let found = 0;
  for (const archive of archives) {
    const tf = new TextureFile();
    const name = `TEXTURE.${String(archive).padStart(3, '0')}`;
    if (!tf.load(new Uint8Array(readFileSync(join(dir, name))), name)) { console.log(`${name}: did not load`); continue; }
    const w = windowOfArchive(tf, archive);
    if (!w) console.log(`${name}  no window wall in this set`);
    else {
      if (w.glass) found++;
      console.log(`${name} #${w.record} (twin #${w.twin})  ${w.width}x${w.height}  glass ${String(w.glass).padStart(5)} (${(w.share * 100).toFixed(1).padStart(5)}%)${w.box ? `  box ${w.box.join(',')}` : '  NONE FOUND'}`);
    }
    if (all) for (const g of glassIndexRecords(tf)) console.log(`    #${g.record} carries 0xff x${g.count}`);
  }
  console.log(`${found} of ${archives.length} building interior archive(s) have glass the rule finds`);
}
