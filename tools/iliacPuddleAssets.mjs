#!/usr/bin/env node
// DW-E3 (2026-09-25): ILIAC PUDDLE NO MORE 1.2.2 (jet082) - THE FISH'S
// VENDORED FILES, OUT OF THE SHIPPED BUNDLE.
//
//   node tools/iliacPuddleAssets.mjs "<path-to>/iliac puddle no more.dfmod" [outDir]
//
// Default outDir is vendor/iliac-puddle-no-more. What it writes:
//
// - `Flats/<name>.png` - the seven fish, the author's own pictures: the
//   bundle's Texture2D (DXT5, as Unity imported the author's PNGs - the
//   import rounds each to a power of two, which is why the mod restores
//   the icon's aspect at run time) decoded at its first mip, every pixel
//   the game samples there. None is a classic record: each is measured
//   against every record of every TEXTURE file (--arena2) by the search
//   tools/detailedShipsAssets.mjs puts its pictures through, and the tool
//   refuses to write one a record covers.
// - `ItemTemplates.json` - the mod's seven item templates, the bundle's
//   text verbatim.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { isMain } from './lib/isMain.mjs';
import { readUnityBundle } from '../src/formats/unityBundle.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { classicRecords, findClassicSource } from './detailedShipsAssets.mjs';   // DS1's search: a record within a pixel of the picture's size, at every offset

/** The seven pictures PassiveFishSpeciesCatalog loads, by their bundle names. */
export const FISH_TEXTURES = Object.freeze(['longnose_butterflyfish', 'largemouth_bass', 'canary_rockfish', 'crucian_carp', 'mackerel', 'white_zebra_angelfish', 'finulon']);

/** The bundle's fish and templates. @param {Uint8Array} bundleBytes */
export function fishAssets(bundleBytes) {
  const b = readUnityBundle(bundleBytes);
  const pictures = FISH_TEXTURES.map((name) => {
    const t = b.textures.find((x) => x.name === name);
    if (!t) throw new Error(`the bundle has no ${name}`);
    const { width, height, data } = t.rgba();
    return { name, width, height, data: new Uint8Array(data) };
  });
  const templates = b.textAssets.find((t) => t.name === 'ItemTemplates');
  if (!templates) throw new Error('the bundle has no ItemTemplates');
  return { pictures, itemTemplates: templates.text };
}

/** A bundle picture as a PNG - rgba() hands its rows top-down, as a PNG holds them. */
function toPng(pic) {
  const png = new PNG({ width: pic.width, height: pic.height });
  png.data = Buffer.from(pic.data);
  return PNG.sync.write(png);
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const arenaAt = args.indexOf('--arena2');
  const arena2 = arenaAt >= 0 ? args.splice(arenaAt, 2)[1] : process.env.ARENA2_PATH;
  const [bundlePath, outDir = join(fileURLToPath(new URL('..', import.meta.url)), 'vendor/iliac-puddle-no-more')] = args;
  if (!bundlePath || !arena2) {
    console.error('usage: node tools/iliacPuddleAssets.mjs "<iliac puddle no more.dfmod>" [outDir] --arena2 <ARENA2>');
    process.exit(2);
  }
  const { pictures, itemTemplates } = fishAssets(new Uint8Array(readFileSync(bundlePath)));
  const palette = new DFPalette();
  palette.load(new Uint8Array(readFileSync(join(arena2, 'ART_PAL.COL'))));
  const records = [...classicRecords(arena2, palette)];
  mkdirSync(join(outDir, 'Flats'), { recursive: true });
  for (const pic of pictures) {
    const src = findClassicSource(pic, records);
    if (src) throw new Error(`${pic.name}: TEXTURE.${src.archive} record ${src.record} covers it - not the author's own picture`);
    writeFileSync(join(outDir, 'Flats', `${pic.name}.png`), toPng(pic));
    console.log(`Flats/${pic.name}.png ${pic.width}x${pic.height} - no classic record covers it`);
  }
  writeFileSync(join(outDir, 'ItemTemplates.json'), itemTemplates);
  console.log('ItemTemplates.json', itemTemplates.length, 'bytes');
}
