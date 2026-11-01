#!/usr/bin/env node
// WL1 (2026-10-29): WHICH OF DFU'S WINDOW RECORDS CARRY GLASS - read off the player's own ARENA2, so the rule
// world/exteriorGlass.js carries can be checked against the data.
//
//     node tools/exteriorGlassScan.mjs /path/to/ARENA2
//
// Every record climateSwaps.isExteriorWindow names in a building's set, in the four climates a town is laid out in, and
// DFU's named exceptions: its 0xff texels (the glass GetWindowColors32 finds) and the glass exteriorWindowMask finds.
// Reads the player's files where they lie and writes nothing: no raster of game data leaves the machine (Port-Doctrine).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { isMain } from './lib/isMain.mjs';
import { TextureFile } from '../src/formats/textureFile.js';
import { isExteriorWindow } from '../src/world/climateSwaps.js';
import { exteriorWindowMask, exteriorGlassIndices } from '../src/world/exteriorGlass.js';

/** The building sets whose window record climbs with the climate (ApplyClimate: base + set), and the ones it never
 *  rebases (75-83 keep their archive in every climate). */
const CLIMBING = [9, 10, 12, 13, 14, 15, 26, 27, 35, 36, 38, 39, 42, 43, 58, 59, 61, 62, 64, 65];
const FIXED = [75, 76, 77, 79, 80, 82, 83];
/** DFU's named exceptions (ClimateSwaps.IsExteriorWindow's first arm). */
const NAMED = [
  [36, 2],
  [151, 3],
  [154, 3],
  [351, 3],
  [171, 2],
  [172, 3],
  [173, 3],
];

/** The archives a building's window can be read from. */
export function windowArchives() {
  const out = new Set(FIXED);
  for (const b of [0, 100, 300, 400]) for (const s of CLIMBING) out.add(b + s);
  for (const [a] of NAMED) out.add(a);
  return [...out].sort((a, b) => a - b);
}

/** One archive's window records: { archive, record, ff, glass, named } each - `ff` the texels DFU finds, `glass` the
 *  texels exteriorWindowMask finds, `named` whether world/exteriorGlass.js names its colour. Pure over a TextureFile. */
export function windowRecordsOf(tf, archive) {
  const out = [];
  for (let record = 0; record < tf.recordCount; record++) {
    if (!isExteriorWindow(archive, record)) continue;
    const bm = tf.getDFBitmap(record, 0);
    if (!bm?.data) continue;
    let ff = 0;
    for (const v of bm.data) if (v === 0xff) ff++;
    const mask = exteriorWindowMask(archive, record, bm, tf);
    let glass = 0;
    for (let i = 0; i < mask.colors.length; i += 4) if (mask.colors[i] > 127) glass++;
    out.push({ archive, record, ff, glass, named: !!exteriorGlassIndices(archive, record) });
  }
  return out;
}

/** Every window record of the building archives under `dir`. */
export function scanWindows(dir) {
  const rows = [];
  for (const archive of windowArchives()) {
    const name = `TEXTURE.${String(archive).padStart(3, '0')}`;
    if (!existsSync(join(dir, name))) continue;
    const tf = new TextureFile();
    if (!tf.load(new Uint8Array(readFileSync(join(dir, name))), name)) continue;
    rows.push(...windowRecordsOf(tf, archive));
  }
  return rows;
}

if (isMain(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir || !existsSync(dir)) {
    console.log('usage: node tools/exteriorGlassScan.mjs /path/to/ARENA2');
    process.exit(2);
  }
  const rows = scanWindows(dir);
  for (const r of rows)
    console.log(
      `TEXTURE.${String(r.archive).padStart(3, '0')} #${r.record}  0xff ${String(r.ff).padStart(5)}  glass ${String(r.glass).padStart(5)}${r.named ? '  (its own colour)' : ''}${r.glass ? '' : '  NONE'}`,
    );
  console.log(`${rows.filter((r) => r.glass).length} of ${rows.length} window record(s) have glass`);
}
