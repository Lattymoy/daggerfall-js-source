#!/usr/bin/env node
// DW-E3 (2026-09-25): ILIAC PUDDLE NO MORE 1.2.2 (jet082) - THE FISH'S
// VENDORED FILES, OUT OF THE SHIPPED BUNDLE.
//
//   node tools/iliacPuddleAssets.mjs "<path-to>/iliac puddle no more.dfmod" [outDir]
//   node tools/iliacPuddleAssets.mjs --listing [outDir]   (the listing alone, from the pictures already there)
//
// Default outDir is vendor/iliac-puddle-no-more. What it writes:
//
// - `Flats/<name>.png` - the seven fish, the author's own pictures: the
//   bundle's Texture2D (DXT5, as Unity imported the author's PNGs - the
//   import rounds each to a power of two, which is why the mod restores
//   the icon's aspect at run time) decoded at its first mip, every pixel
//   the game samples there. None is a classic record: each is measured
//   against every record of every TEXTURE file (--arena2) by the search
//   tools/lib/classicSource.mjs runs, and the tool
//   refuses to write one a record covers.
// - `iliac-puddle-no-more.files.json` - our listing of those pictures, each
//   with its sha256: what test/tooling/doctrine.test.js admits under Flats/.
//   OWN-WORK3 (2026-10-31): the mod's item templates are no longer written;
//   the fish rows are our own (src/systems/deepWater/deepWatersFishRows.js).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { isMain } from './lib/isMain.mjs';
import { readUnityBundle } from '../src/formats/unity/unityBundle.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { classicRecords, findClassicSource } from './lib/classicSource.mjs';   // a record within a pixel of the picture's size, at every offset

/** The seven pictures PassiveFishSpeciesCatalog loads, by their bundle names. */
export const FISH_TEXTURES = Object.freeze(['longnose_butterflyfish', 'largemouth_bass', 'canary_rockfish', 'crucian_carp', 'mackerel', 'white_zebra_angelfish', 'finulon']);

/** The bundle's fish pictures. @param {Uint8Array} bundleBytes */
export function fishAssets(bundleBytes) {
  const b = readUnityBundle(bundleBytes);
  const pictures = FISH_TEXTURES.map((name) => {
    const t = b.textures.find((x) => x.name === name);
    if (!t) throw new Error(`the bundle has no ${name}`);
    const { width, height, data } = t.rgba();
    return { name, width, height, data: new Uint8Array(data) };
  });
  return { pictures };
}

/** Our listing of the pictures, in the catalog's order, each by its sha256. @param {(name: string) => Uint8Array} pngOf */
export function fishListing(pngOf) {
  const files = FISH_TEXTURES.map((n) => `Flats/${n}.png`);
  return `${JSON.stringify({
    ModTitle: 'Iliac Puddle No More', ModVersion: '1.2.2', ModAuthor: 'jet082', Source: 'https://www.nexusmods.com/daggerfallunity/mods/1304',
    Archive: 'Iliac_Puddle_No_More_1304_1.2.2_2026-07-11T17-49Z_psKKacHpq.7z',
    Note: 'Written by tools/iliacPuddleAssets.mjs, not by hand: the seven fish pictures under Flats/, the author\'s own, and the sha256 of each. The authority test/tooling/doctrine.test.js reads for what may stand there. The rest of the mod is our own code now (OWN-WORK3).',
    Files: files,
    Sha256: Object.fromEntries(files.map((f, i) => [f, createHash('sha256').update(pngOf(FISH_TEXTURES[i])).digest('hex')])),
  }, null, 2)}\n`;
}

/** A bundle picture as a PNG - rgba() hands its rows top-down, as a PNG holds them. */
function toPng(pic) {
  const png = new PNG({ width: pic.width, height: pic.height });
  png.data = Buffer.from(pic.data);
  return PNG.sync.write(png);
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args[0] === '--listing') {
    const dir = args[1] ?? join(fileURLToPath(new URL('..', import.meta.url)), 'vendor/iliac-puddle-no-more');
    writeFileSync(join(dir, 'iliac-puddle-no-more.files.json'), fishListing((n) => readFileSync(join(dir, 'Flats', `${n}.png`))));
    console.log('iliac-puddle-no-more.files.json');
    process.exit(0);
  }
  const arenaAt = args.indexOf('--arena2');
  const arena2 = arenaAt >= 0 ? args.splice(arenaAt, 2)[1] : process.env.ARENA2_PATH;
  const [bundlePath, outDir = join(fileURLToPath(new URL('..', import.meta.url)), 'vendor/iliac-puddle-no-more')] = args;
  if (!bundlePath || !arena2) {
    console.error('usage: node tools/iliacPuddleAssets.mjs "<iliac puddle no more.dfmod>" [outDir] --arena2 <ARENA2>');
    process.exit(2);
  }
  const { pictures } = fishAssets(new Uint8Array(readFileSync(bundlePath)));
  const palette = new DFPalette();
  palette.load(new Uint8Array(readFileSync(join(arena2, 'ART_PAL.COL'))));
  const records = [...classicRecords(arena2, palette)];
  mkdirSync(join(outDir, 'Flats'), { recursive: true });
  const pngs = new Map();
  for (const pic of pictures) {
    const src = findClassicSource(pic, records);
    if (src) throw new Error(`${pic.name}: TEXTURE.${src.archive} record ${src.record} covers it - not the author's own picture`);
    pngs.set(pic.name, toPng(pic));
    writeFileSync(join(outDir, 'Flats', `${pic.name}.png`), pngs.get(pic.name));
    console.log(`Flats/${pic.name}.png ${pic.width}x${pic.height} - no classic record covers it`);
  }
  writeFileSync(join(outDir, 'iliac-puddle-no-more.files.json'), fishListing((n) => pngs.get(n)));
  console.log('iliac-puddle-no-more.files.json');
}
