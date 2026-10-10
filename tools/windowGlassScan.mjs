#!/usr/bin/env node
// RW1 (2026-10-09): WHICH INTERIOR TEXELS ARE GLASS - read off the player's own ARENA2, so the rule
// world/interiorGlass.js interiorGlassMask carries (FLAGGED: unverified without the data) can be checked by eye.
//
//     node tools/windowGlassScan.mjs /path/to/ARENA2            every building interior set's records
//     node tools/windowGlassScan.mjs /path/to/ARENA2 --all      and the exterior window table's records beside them
//
// For every TEXTURE.nnn of a building interior set (world/interiorGlass.js over climateSwaps BUILDING_INTERIOR_SETS, every climate's copy) it
// prints each record that carries the glass index (0xff, getWindowColors32's own): its texel count, its share of the
// picture, the box the glass texels span, and whether the rule takes it (TAKEN) or leaves it (too few / too many).
// With --all it prints DFU's own exterior window records the same way (isExteriorWindow - the R2 glass), so an
// interior record can be compared with a window the port already knows is one. Reads the player's files where they
// lie and writes nothing: no raster of game data leaves the machine (Port-Doctrine).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { isMain } from './lib/isMain.mjs';
import { TextureFile } from '../src/formats/textureFile.js';
import { isExteriorWindow } from '../src/world/climateSwaps.js';
import { isInteriorGlassArchive, interiorGlassMask, GLASS_INDEX, GLASS_MIN_TEXELS, GLASS_MAX_SHARE } from '../src/world/interiorGlass.js';

/** One record's glass: its count, share and box - and the rule's verdict (`taken`). Pure over a TextureFile. */
export function glassOfRecord(tf, archive, record) {
  const bm = tf.getDFBitmap(record, 0);
  if (!bm?.data?.length) return null;
  let n = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < bm.height; y++) for (let x = 0; x < bm.width; x++) {
    if (bm.data[y * bm.width + x] !== GLASS_INDEX) continue;
    n++;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (!n) return null;
  const share = n / bm.data.length;
  const taken = isInteriorGlassArchive(archive) && !!interiorGlassMask(archive, bm, () => true);
  const why = taken ? 'TAKEN' : !isInteriorGlassArchive(archive) ? 'not an interior set' : n < GLASS_MIN_TEXELS ? 'too few' : share > GLASS_MAX_SHARE ? 'too many' : '?';
  return { archive, record, width: bm.width, height: bm.height, glass: n, share, box: [x0, y0, x1, y1], taken, why };
}

/** Every record of one archive that carries glass. */
export function scanArchive(tf, archive) {
  const out = [];
  for (let r = 0; r < tf.recordCount; r++) { const g = glassOfRecord(tf, archive, r); if (g) out.push(g); }
  return out;
}

if (isMain(import.meta.url)) {
  const dir = process.argv[2];
  const all = process.argv.includes('--all');
  if (!dir || !existsSync(dir)) {
    console.log('usage: node tools/windowGlassScan.mjs /path/to/ARENA2 [--all]');
    process.exit(2);
  }
  const archives = readdirSync(dir).map((f) => /^TEXTURE\.(\d{3})$/i.exec(f)).filter(Boolean).map((m) => Number(m[1])).sort((a, b) => a - b);
  let taken = 0;
  for (const archive of archives) {
    const interior = isInteriorGlassArchive(archive);
    if (!interior && !all) continue;
    const tf = new TextureFile();
    const name = `TEXTURE.${String(archive).padStart(3, '0')}`;
    if (!tf.load(new Uint8Array(readFileSync(join(dir, name))), name)) { console.log(`${name}: did not load`); continue; }
    for (const g of scanArchive(tf, archive)) {
      const window = isExteriorWindow(archive, g.record);
      if (!interior && !window) continue;
      if (g.taken) taken++;
      console.log(`${name} #${String(g.record).padStart(2)}  ${g.width}x${g.height}  glass ${String(g.glass).padStart(5)} (${(g.share * 100).toFixed(1).padStart(5)}%)  box ${g.box.join(',')}  ${interior ? g.why : 'exterior window (DFU\'s table)'}`);
    }
  }
  console.log(`${taken} interior record(s) the rule takes as glass`);
}
