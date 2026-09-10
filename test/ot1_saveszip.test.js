// OT1 (2026-09-10) - THE SAVES PICKER'S PHONE PATH: Ledger row :601's
// last residue.
//
// `pickClassicSaveFiles` (scenes/menu.js) was a directory picker and a
// directory drop - two gestures a phone does not have. iOS Safari has
// no directory picker, which is exactly why the ARENA2 door grew its
// zip input on 2026-08-13; the saves door never did, and the row
// recorded it as "desktop-first charter". The charter's mobile approval
// (Port-Doctrine, TI1) has since shipped a whole touch layer, so the
// door takes the same arm: a zipped Daggerfall folder (or a zipped
// SAVE# folder) through the ARENA2 door's own zip walk.
//
// Two pure pieces carry it and are pinned here without a DOM:
//   - `readZipEntries` (dataSource.js) is the central-directory walk with
//     the entry NAMES KEPT and a `pick` over them that runs BEFORE any
//     inflate - readZip's skip-before-inflate, generalised, and readZip
//     is rebuilt on it (datasource.test.js still pins its diet).
//   - `collectClassicSaveFiles` / `classicSaveFilesFromZip` (menu.js):
//     the SaveGames Directory.GetDirectories walk as one collector both
//     gestures feed, and the zip entries shaped as the file-likes the
//     picker's ingest already reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readZipEntries, readZip } from '../src/scenes/dataSource.js';
import { collectClassicSaveFiles, classicSaveFilesFromZip } from '../src/scenes/menu.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => readFileSync(join(root, rel), 'utf8');

/** A zip with the given files: method 8 (deflate-raw) unless `store`,
 *  and `rawDeflate` lets a test plant bytes that are NOT valid deflate
 *  under method 8 - so an entry that must never inflate can prove it by
 *  not throwing. datasource.test.js's crafter, one knob wider. */
function craftZip(files) {
  const locals = [], centrals = [];
  let off = 0;
  for (const f of files) {
    const isDir = f.name.endsWith('/');
    const raw = isDir ? Buffer.alloc(0) : f.data;
    const comp = f.rawDeflate ?? (isDir || f.store ? raw : deflateRawSync(raw));
    const method = isDir || f.store ? 0 : 8;
    const name = Buffer.from(f.name);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(method, 8);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(name.length, 26);
    locals.push(lh, name, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(off, 42);
    centrals.push(ch, name);
    off += 30 + name.length + comp.length;
  }
  const central = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, central, eocd]);
}
const asFile = (buf) => ({ name: 'saves.zip', arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) });
const bytes = (ab) => Buffer.from(ab);

const TREE = Buffer.from('SAVETREE-'.repeat(30));
const VARS = Buffer.from([0x11, 0x22, 0x33, 0x44]);
const GARBAGE = Buffer.from('this is not deflate data at all');

test('OT1: readZipEntries keeps the archive paths, skips directories, and inflates only what pick answers', async () => {
  const zip = craftZip([
    { name: 'DAGGER/', data: Buffer.alloc(0) },
    { name: 'DAGGER/SAVE0/SAVETREE.DAT', data: TREE },                 // deflate
    { name: 'DAGGER/SAVE0/SAVEVARS.DAT', data: VARS, store: true },   // store
    { name: 'DAGGER/DAGGER.EXE', data: GARBAGE, rawDeflate: GARBAGE },   // method 8 with bytes that cannot inflate
  ]);
  // Unpicked, the garbage would throw in DecompressionStream - so a
  // green run here IS the proof the filter ran before the inflate.
  const seen = [];
  const entries = await readZipEntries(asFile(zip), {
    pick: (names) => { seen.push(...names); return names.filter((n) => /\/SAVE0\//.test(n)); },
  });
  assert.deepEqual(seen, ['DAGGER/SAVE0/SAVETREE.DAT', 'DAGGER/SAVE0/SAVEVARS.DAT', 'DAGGER/DAGGER.EXE'],
    'pick sees every FILE name in archive order, directories already gone');
  assert.deepEqual(entries.map((e) => e.name), ['DAGGER/SAVE0/SAVETREE.DAT', 'DAGGER/SAVE0/SAVEVARS.DAT'], 'names kept verbatim - the SAVE# segment survives');
  assert.equal(Buffer.compare(bytes(entries[0].data), TREE), 0, 'deflate path byte-exact');
  assert.equal(Buffer.compare(bytes(entries[1].data), VARS), 0, 'store path byte-exact');
  // and with the garbage picked the walk throws - the garbage is real
  await assert.rejects(readZipEntries(asFile(zip), { pick: (names) => names }), 'inflating the planted bytes must fail, or the pin above proves nothing');
  // the default pick is everything, so a plain archive round-trips
  const plain = await readZipEntries(asFile(craftZip([{ name: 'a/b.txt', data: VARS, store: true }])));
  assert.deepEqual(plain.map((e) => e.name), ['a/b.txt']);
});

test('OT1: readZip is the same diet over the new walk - flattened keys, arena2/ alone, KEEP before inflate', async () => {
  // datasource.test.js pins the diet in full; this pins that rebuilding
  // readZip on readZipEntries changed neither its shape nor its
  // skip-before-inflate: a diet-excluded VID planted with garbage
  // bytes never reaches the decompressor.
  const zip = craftZip([
    { name: 'arena2/MAPS.BSA', data: TREE },
    { name: 'arena2/ANIM0000.VID', data: GARBAGE, rawDeflate: GARBAGE },
    { name: 'DAGGER/SAVE0/SAVETREE.DAT', data: TREE, store: true },   // a sibling of arena2/: filtered
  ]);
  const entries = await readZip(asFile(zip));
  assert.deepEqual(entries.map(([k]) => k), ['MAPS.BSA'], '[key, ArrayBuffer] pairs, the store\'s own shape');
  assert.equal(Buffer.compare(bytes(entries[0][1]), TREE), 0);
});

test('OT1: collectClassicSaveFiles is the SaveGames walk - SAVE0-SAVE5 segments, the seven names, case-folded', () => {
  const f = (path) => ({ webkitRelativePath: path, arrayBuffer: async () => new ArrayBuffer(0) });
  const saves = collectClassicSaveFiles([
    f('Dagger/save0/savetree.dat'),          // lower case: the user's folder, not ARENA2's
    f('DAGGER/SAVE0/SAVEVARS.DAT'),
    f('DAGGER/SAVE0/README.TXT'),            // not one of the seven
    f('SAVE3/SAVENAME.TXT'),                 // a SAVE# folder picked directly
    f('DAGGER/SAVE6/SAVETREE.DAT'),          // no such slot
    f('DAGGER/DAGGER.EXE'),                  // no SAVE# segment
    { name: 'SAVETREE.DAT', arrayBuffer: async () => new ArrayBuffer(0) },   // a bare file: no segment to key on
  ]);
  assert.deepEqual(Object.keys(saves).sort(), ['0', '3']);
  assert.deepEqual(Object.keys(saves[0]).sort(), ['SAVETREE.DAT', 'SAVEVARS.DAT']);
  assert.deepEqual(Object.keys(saves[3]), ['SAVENAME.TXT']);
});

test('OT1: a zipped Daggerfall folder reaches the collector as the same file-likes, inflating only the save files', async () => {
  const zip = craftZip([
    { name: 'Daggerfall/SAVE0/SAVETREE.DAT', data: TREE },
    { name: 'Daggerfall/SAVE0/SAVENAME.TXT', data: Buffer.from('Nyra'), store: true },
    { name: 'Daggerfall/SAVE0/SAVE.LOG', data: GARBAGE, rawDeflate: GARBAGE },        // not one of the seven: never inflates
    { name: 'Daggerfall/DAGGER.EXE', data: GARBAGE, rawDeflate: GARBAGE },           // the rest of a zipped game folder: never inflates
    { name: 'Daggerfall/SAVE5/SAVEVARS.DAT', data: VARS, store: true },
  ]);
  const files = await classicSaveFilesFromZip(asFile(zip));
  assert.deepEqual(files.map((x) => x.webkitRelativePath), ['Daggerfall/SAVE0/SAVETREE.DAT', 'Daggerfall/SAVE0/SAVENAME.TXT', 'Daggerfall/SAVE5/SAVEVARS.DAT']);
  const saves = collectClassicSaveFiles(files);
  assert.deepEqual(Object.keys(saves).sort(), ['0', '5']);
  // the picker's ingest reads `new Uint8Array(await file.arrayBuffer())` - the same door
  assert.equal(Buffer.compare(bytes(await saves[0]['SAVETREE.DAT'].arrayBuffer()), TREE), 0);
  assert.equal(Buffer.from(await saves[0]['SAVENAME.TXT'].arrayBuffer()).toString(), 'Nyra');
  assert.equal(Buffer.compare(bytes(await saves[5]['SAVEVARS.DAT'].arrayBuffer()), VARS), 0);
  // a zip of ONE save folder works too - the segment is the folder's own name
  const one = await classicSaveFilesFromZip(asFile(craftZip([{ name: 'SAVE2/SAVETREE.DAT', data: TREE, store: true }])));
  assert.deepEqual(Object.keys(collectClassicSaveFiles(one)), ['2']);
});

test('OT1: the picker offers the zip door beside the directory one, and a dropped .zip takes the same arm', () => {
  const menu = src('src/scenes/menu.js');
  // the ARENA2 door's own shape: a second file input, accept-gated, with the phone line above it
  assert.match(menu, /<input type="file" id="picksaves" webkitdirectory multiple[^>]*>\s*<p[^>]*>on a phone: pick a <b>\.zip<\/b> instead/, 'the phone line sits under the directory input');
  assert.match(menu, /<input type="file" id="picksaveszip" accept="\.zip,application\/zip"/, 'the zip input is accept-gated');
  assert.match(menu, /querySelector\('#picksaveszip'\)\.addEventListener\('change'[\s\S]{0,400}await ingest\(await classicSaveFilesFromZip\(f\)\)/, 'the zip input feeds the SAME ingest as the directory pick');
  assert.match(menu, /if \(\/\\\.zip\$\/i\.test\(entry\.name\)\) \{ files\.push\(\.\.\.await classicSaveFilesFromZip\(f\)\); return; \}/, 'a dropped .zip expands in the directory walk');
  // one collector: the directory pick, the drop and the zip all land in it
  assert.match(menu, /const saves = collectClassicSaveFiles\(files\);/);
  assert.equal((menu.match(/SAVE\(\[0-5\]\)/g) || []).length, 1, 'the SAVE# rule is written once (classicSaveSlot)');
});
