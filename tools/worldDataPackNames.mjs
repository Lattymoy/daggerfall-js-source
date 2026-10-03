// AUDIT WD3 P5 (2026-10-02, Mac: "Fix anything. This needs to be perfect"): THE CLASSIC BLOCK NAMES A PACK'S `$c`
// REFERENCES READ, written into a vendored pack - what tools/worldDataPackBuild.mjs now writes into every pack it builds,
// laid into the two it built before it did. A `$c` names a classic block by INDEX; with its name beside it the reader
// refuses a BLOCKS.BSA in another order (formats/worldDataPack.js) instead of reading another block's pieces. Nothing
// else of the pack changes: its files, nodes and bases are written back as they were read.
//
//   node tools/worldDataPackNames.mjs <arena2> <vendor/<mod>/WorldDataPack/<mod>.pack.json.gz>...
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import zlib from 'node:zlib';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { classicIndicesOf } from '../src/formats/worldDataPack.js';
import { isMain } from './lib/isMain.mjs';

/** The pack's text with `classicNames` laid in after `bases` (the builder's own order), from `blockName(index)`. */
export function withClassicNames(text, blockName) {
  const pack = JSON.parse(text);
  const names = Object.fromEntries(classicIndicesOf(pack).map((i) => [i, blockName(i)]));
  const { format, vendor, mod, bases, files, nodes } = pack;
  return JSON.stringify({ format, vendor, mod, bases, classicNames: names, files, nodes });
}

if (isMain(import.meta.url)) {
  const [arena2, ...packs] = process.argv.slice(2);
  if (!arena2 || !packs.length) { console.error('usage: node tools/worldDataPackNames.mjs <arena2> <pack.json.gz>...'); process.exit(1); }
  const blocks = new BlocksFile();
  if (!blocks.load(new Uint8Array(readFileSync(join(arena2, 'BLOCKS.BSA'))))) throw new Error('BLOCKS.BSA did not load');
  for (const file of packs) {
    const text = withClassicNames(zlib.gunzipSync(readFileSync(file)).toString('utf8'), (i) => blocks.getBlockName(i));
    writeFileSync(file, zlib.gzipSync(Buffer.from(text, 'utf8'), { level: 9 }));
    console.log(`${file}: ${Object.keys(JSON.parse(text).classicNames).length} classic blocks named`);
  }
}
