#!/usr/bin/env node
// SKIN2: THE CLASS SKINS' LISTING - the authority test/doctrine.test.js reads for vendor/class-skins/.
//
// Mac's ExistingClasses archive is a LOOSE-FILE pack (no .dfmod, so no manifest of its own), the GrimoireUI case: its
// authority is a listing generated from the archive. Unlike GrimoireUI's, these files were RENAMED on the way in -
// three sets carry no archive number in their names (given one here), one record's frames were numbered with a gap
// (renumbered in order), and one frame's name carries a stray underscore - so the listing maps every vendored name to the archive path it came from, and this tool
// PROVES it: each vendored file must be the source file's bytes, exactly.
//
//   node tools/classSkinsListing.mjs <unpacked sets dir> <ExistingClasses.rar> [--write]
//
// `<unpacked sets dir>` is the archive with each inner .rar unpacked into a folder of its own name (the archive is a
// RAR5 of RARs; `node-unrar-js` unpacks both). Without --write it only checks the committed listing.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const VENDOR = new URL('../vendor/class-skins/Textures/', import.meta.url);
const LISTING = new URL('../vendor/class-skins/class-skins.files.json', import.meta.url);

/** Each set: the archive the port draws it under, and the folder (inside the unpacked archive) it came from. */
const SETS = [
  [1523, 'Acrobate male/Acrobate male'], [1524, 'Acrobat Female/Acrobat Female'],
  [1536, 'Assassin Males/Males'], [1537, 'Assassin Female/Female'],
  [1538, 'Burglar male/Final'], [1539, 'Burglar Female/Final'],
  [1504, 'Male Bounty Hunter/KAMER - Bounty Hunter'], [1535, 'Dark Acolayed/Dark Acolayed'],
  [1513, 'DB Male/Finished'], [1514, 'DF Vanilla/DF Vanilla'],
  [1530, 'Healer male/Finished'], [1527, 'Healer male/Finished/Shield'], [1528, 'Healer Female/Finished'],
  [1519, 'Monk Male/Finished'], [1520, 'Monk Female/Final'],
  [1525, 'Nightblade Male/Male 2'], [1526, 'Nightblade Female/2'],
  [1529, 'Pirate_Male/Pirate_Male'], [1540, 'Sorccerer Male/Cape'], [1541, 'Sorccer Female/Final'],
];
/** `<archive>_<record>-<frame>.png`, the archive optional. A trailing `_` after the frame is the ARTIST'S TYPO, not a
 *  withdrawn frame: the pirate's `1529_3-1_.png` is the passing step of record 3's walk, between the strides 3-0 and
 *  3-2, exactly as record 2's 2-1 is (SKIN2's first cut skipped it, and the back three-quarter walked in three frames). */
const NAME = /^(?:(\d+)_)?(\d+)-(\d+)_?\.png$/i;
const sha = (b) => createHash('sha256').update(b).digest('hex');

/** vendored basename -> archive path, the frames of each record renumbered 0..n-1 in their own order. */
function mapping(setsDir) {
  const from = {};
  for (const [archive, folder] of SETS) {
    const dir = join(setsDir, folder);
    const byRecord = new Map();
    for (const f of readdirSync(dir)) {
      if (!statSync(join(dir, f)).isFile()) continue;   // a set's own sub-folders (the healer's Shield, Bonus) are not it
      const m = NAME.exec(f);
      if (!m) throw new Error(`${folder}/${f}: not a <record>-<frame>.png`);
      if (m[1] && Number(m[1]) !== archive) throw new Error(`${folder}/${f}: names archive ${m[1]}, the set is ${archive}`);
      const rec = Number(m[2]);
      if (!byRecord.has(rec)) byRecord.set(rec, []);
      byRecord.get(rec).push([Number(m[3]), f]);
    }
    for (const [rec, frames] of byRecord) {
      frames.sort((a, b) => a[0] - b[0]);
      frames.forEach(([, f], i) => { from[`${archive}_${rec}-${i}.png`] = `${folder}/${f}`; });
    }
  }
  return from;
}

const [setsDir, rar, flag] = process.argv.slice(2);
if (!setsDir || !rar) { console.error('usage: node tools/classSkinsListing.mjs <unpacked sets dir> <ExistingClasses.rar> [--write]'); process.exit(2); }
const from = mapping(setsDir);
const bad = [];
for (const [name, src] of Object.entries(from)) {
  const archive = name.split('_')[0];
  let mine;
  try { mine = readFileSync(new URL(`${archive}/${name}`, VENDOR)); } catch { bad.push(`${name}: not vendored`); continue; }
  if (sha(mine) !== sha(readFileSync(join(setsDir, src)))) bad.push(`${name}: not the bytes of ${src}`);
}
const vendored = readdirSync(VENDOR, { withFileTypes: true }).filter((d) => d.isDirectory())
  .flatMap((d) => readdirSync(new URL(`${d.name}/`, VENDOR)));
for (const f of vendored) if (!from[f]) bad.push(`${f}: vendored, and in no set`);
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
const listing = {
  ModTitle: 'Daggerfall class skins',
  Archive: 'ExistingClasses.rar',
  ArchiveSha256: sha(readFileSync(rar)),
  Note: 'A LOOSE-FILE pack: the archive carries no .dfmod and so no manifest of its own. This file is generated from the archive by tools/classSkinsListing.mjs, which proves every vendored file is the bytes of the archive path `From` names. Files are listed by their VENDORED names: three sets carry no archive number in the archive (1525, 1526, 1530 are the port’s), one record’s frames were numbered with a gap (the adventurer’s 3: 0, 1, 2, 4) and are renumbered in order, and the pirate’s 1529_3-1_.png is frame 3-1 (its underscore a typo).',
  Files: Object.keys(from).sort(),
  From: Object.fromEntries(Object.keys(from).sort().map((k) => [k, from[k]])),
};
const text = `${JSON.stringify(listing, null, 2)}\n`;
if (flag === '--write') { writeFileSync(LISTING, text); console.log(`wrote ${Object.keys(from).length} files`); }
else if (readFileSync(LISTING, 'utf8') !== text) { console.error('class-skins.files.json is not what the archive gives - run with --write'); process.exit(1); }
else console.log(`ok: ${Object.keys(from).length} files, every one the archive's bytes`);
