// Vendor the Pegas Horse Ranch files the enhanced ride needs into
// vendor/pegas-horse/, VERBATIM, from an extracted copy of the mod -
// WITH THE AUTHOR'S WRITTEN CONSENT (MW-D50; see the vendor README).
// Run:
//   node scripts/vendorPegas.mjs <extracted mod dir> [--variants 1,2,...]
// The dir is wherever the RAR was unpacked; the script finds the
// data-files frame itself (mwLoosePath slices from the first known
// asset root, exactly as the in-game attach door does), so wrapper
// folders do not matter.
//
// WHAT IT TAKES, AND WHY ONLY THAT. The ride draws ONE coat variant
// (1 by default; MW-D42 records the other nineteen as unbuilt), and a
// variant is exactly the set pegasHorse.js resolves: the mesh, its
// clips, the coat the mesh names (read out of the .nif, not guessed
// from a filename), and the four hoof/voice clips. Nothing else in the
// mod - the ranch, the stables, the saddle skirts, the unicorn, the
// books, the plugins - is used by the port, so none of it is carried.
// The mod's readmes come across whole beside the files, because the
// readme's own condition on redistribution is "kept original and
// intact" and the credits it carries are the author's to state.
//
// SHIP ONLY WHEN PROVEN. Before a byte is written the script assembles
// the horse from the selected files through the exact runtime path -
// assembleVendoredArchive -> loadPegasHorse over a stub renderer - and
// refuses unless the horse stands with its coat hung and all three
// gaits armed. A vendor tree that cannot ride is not a vendor tree.
//
// THE MANIFEST. manifest.json lists every vendored asset with its size
// and sha256; mwd50_vendoredhorse.test.js pins the tree to it both ways
// (nothing listed is missing or altered, nothing present is unlisted),
// so "verbatim" is a checked claim, not a hope.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { mwLoosePath } from '../src/scenes/dataSource.js';
import {
  assembleVendoredArchive, loadPegasHorse, horseMeshPath, horseKfPath, horseCoatPath, HORSE_SOUNDS, HORSE_CLIPS,
} from '../src/systems/pegasHorse.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'vendor/pegas-horse');
const LOOSE = /\.(nif|kf|dds|tga|wav)$/i;

const args = process.argv.slice(2);
const src = args.find((a) => !a.startsWith('--'));
const variantsArg = args.includes('--variants') ? args[args.indexOf('--variants') + 1] : '1';
if (!src) {
  console.error('usage: node scripts/vendorPegas.mjs <extracted mod dir> [--variants 1,2,...]');
  process.exit(2);
}
const variants = variantsArg.split(',').map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0);
if (!variants.length) { console.error(`bad --variants "${variantsArg}"`); process.exit(2); }

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

// Every loose file in the extracted tree, keyed by its canonical
// data-files path - the same key the attach door would give it.
const all = walk(resolve(src));
const byPath = new Map();
for (const p of all) if (LOOSE.test(p)) byPath.set(mwLoosePath(p.slice(resolve(src).length + 1)), p);
const readmes = all.filter((p) => /readme.*\.txt$/i.test(basename(p)));
if (!byPath.size) { console.error(`no loose Morrowind files under ${src}`); process.exit(1); }
const has = (p) => byPath.has(String(p).replace(/\\/g, '/').toLowerCase());
const bytesOf = (p) => new Uint8Array(readFileSync(byPath.get(p)));

// The selection: per variant, the set the ride resolves - and the
// coat read out of the mesh through the runtime's own path law.
const selected = new Map();   // canonical path -> source file
for (const v of variants) {
  for (const p of [horseMeshPath(v), horseKfPath(v)]) {
    if (!has(p)) { console.error(`variant ${v}: ${p} is not in the mod`); process.exit(1); }
    selected.set(p, byPath.get(p));
  }
  const coat = horseCoatPath(bytesOf(horseMeshPath(v)), has);
  if (!coat) { console.error(`variant ${v}: the mesh names no coat the mod carries`); process.exit(1); }
  selected.set(coat, byPath.get(coat));
}
for (const p of Object.values(HORSE_SOUNDS)) {
  if (!has(p)) { console.error(`${p} is not in the mod`); process.exit(1); }
  selected.set(p, byPath.get(p));
}

// The proof, through the runtime path, before anything is written.
const stubRenderer = {
  gl: { deleteVertexArray() {}, deleteBuffer() {}, deleteTexture() {} },
  createCharacterMesh: (packed) => ({ vao: {}, buffers: [{}], floats: packed.length }),
  createCharacterTexture: (mips) => ({ mips: mips.length }),
  updateCharacterMesh() {},
};
for (const v of variants) {
  const archive = await assembleVendoredArchive({
    manifest: selected.keys(), fetchBytes: (p) => new Uint8Array(readFileSync(selected.get(p))), variant: v,
  });
  if (!archive) { console.error(`variant ${v}: the vendored set does not assemble`); process.exit(1); }
  const horse = loadPegasHorse({ renderer: stubRenderer, archives: [archive], variant: v });
  if (!horse.ok) { console.error(`variant ${v}: the horse refuses at stage ${horse.stage}: ${horse.error ?? ''}`); process.exit(1); }
  if (horse.notes.length) { console.error(`variant ${v}: the horse stands but degraded - ${horse.notes.join('; ')}`); process.exit(1); }
  if (!horse.mesh.ranges.every((r) => r.tex)) { console.error(`variant ${v}: the coat did not hang`); process.exit(1); }
  for (const clip of Object.values(HORSE_CLIPS)) {
    if (!horse.setClip(clip)) { console.error(`variant ${v}: the .kf has no ${clip} group`); process.exit(1); }
  }
  horse.advance(0.1);
  console.log(`variant ${v}: proven - ${horse.groups.length} clip groups, coat hung, ${Object.values(HORSE_CLIPS).join('/')} armed`);
}

// Write: the old asset tree goes whole (a re-run with fewer variants
// must not leave stragglers the manifest disowns), the README stays.
for (const name of readdirSync(OUT, { withFileTypes: true })) {
  if (name.isDirectory() || name.name === 'manifest.json' || /\.txt$/i.test(name.name)) rmSync(join(OUT, name.name), { recursive: true, force: true });
}
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const files = [];
for (const [canon, from] of [...selected].sort((a, b) => a[0].localeCompare(b[0]))) {
  const to = join(OUT, canon);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  files.push({ path: canon, bytes: statSync(from).size, sha256: sha(from) });
}
const readmeNames = [];
for (const r of readmes) {
  copyFileSync(r, join(OUT, basename(r)));
  readmeNames.push(basename(r));
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({
  mod: 'Pegas Horse Ranch v3.1 (MADMAX and Team, 2004; horse model by Cait)',
  consent: 'the author\'s written consent, confirmed by Mac 2026-09-03 - see README.md',
  vendored: new Date().toISOString().slice(0, 10),
  variants,
  readmes: readmeNames,
  files,
}, null, 2) + '\n');
console.log(`vendored ${files.length} files (${files.reduce((n, f) => n + f.bytes, 0)} bytes) + ${readmeNames.length} readme(s) into ${OUT}`);
if (!existsSync(join(OUT, 'README.md'))) console.warn('NOTE: vendor/pegas-horse/README.md is missing - the permission record belongs there');
