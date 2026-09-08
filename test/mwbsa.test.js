import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { MwBsaFile, normalizeBsaPath } from '../src/formats/mwBsaFile.js';

// fixture.bsa is written by test/fixtures/mw/generate.py - an independent
// struct-level writer of the documented v0x100 layout.
const ARCHIVE = new Uint8Array(readFileSync(new URL('./fixtures/mw/fixture.bsa', import.meta.url)));
const MESH = new Uint8Array(readFileSync(new URL('./fixtures/mw/mesh.nif', import.meta.url)));
const SKINNED = new Uint8Array(
  readFileSync(new URL('./fixtures/mw/skinned.nif', import.meta.url)),
);
const DDS = new Uint8Array(readFileSync(new URL('./fixtures/mw/fixture.dds', import.meta.url)));

test('mwbsa: normalizeBsaPath lowercases and forward-slashes', () => {
  assert.equal(normalizeBsaPath('Meshes\\B\\Foo.NIF'), 'meshes/b/foo.nif');
  assert.equal(normalizeBsaPath('textures/fixture.dds'), 'textures/fixture.dds');
});

test('mwbsa: directory, listing, and byte-exact retrieval', () => {
  const bsa = new MwBsaFile(ARCHIVE);
  assert.equal(bsa.fileCount, 8);
  assert.deepEqual(bsa.list(), [
    'meshes/fixture/mesh.nif',
    'meshes/fixture/skinned.nif',
    'meshes/fixture/plain.nif',
    'meshes/fixture/animated.nif',
    'meshes/fixture/xfixture.kf',
    'meshes/fixture/part.nif',
    'meshes/base_anim.nif',
    'textures/fixture.dds',
  ]);
  // Retrieval is case/slash-insensitive and byte-exact against the loose
  // fixtures the archive was packed from.
  assert.deepEqual(bsa.get('Meshes\\Fixture\\MESH.NIF'), MESH);
  assert.deepEqual(bsa.get('meshes/fixture/skinned.nif'), SKINNED);
  assert.deepEqual(bsa.get('textures\\fixture.dds'), DDS);
  assert.equal(bsa.has('textures/fixture.dds'), true);
  assert.equal(bsa.has('textures/absent.dds'), false);
});

test('mwbsa: rejects junk and missing entries', () => {
  assert.throws(() => new MwBsaFile(new Uint8Array([1, 2, 3])), /too small/);
  const badMagic = new Uint8Array(16);
  badMagic[0] = 0x42;
  assert.throws(() => new MwBsaFile(badMagic), /bad magic/);
  const bsa = new MwBsaFile(ARCHIVE);
  assert.throws(() => bsa.get('nope.nif'), /no such file/);
});

// ---------------------------------------------------------------------------
// Real-data validation - runs when MW_DATA_PATH points at a Morrowind
// "Data Files" directory (same pattern as the ARENA2_PATH gate).
// ---------------------------------------------------------------------------

const MW = process.env.MW_DATA_PATH;
const retailBsa = MW ? join(MW, 'Morrowind.bsa') : null;
const skipReal =
  !retailBsa || !existsSync(retailBsa)
    ? 'MW_DATA_PATH not set or Morrowind.bsa missing - real-data validation skipped'
    : false;

test('mwbsa: retail Morrowind.bsa opens and looks sane', { skip: skipReal }, () => {
  const bsa = new MwBsaFile(new Uint8Array(readFileSync(retailBsa)));
  // Retail archive holds thousands of files; every name normalized, every
  // entry inside the archive bounds (get() checks the bound).
  assert.ok(bsa.fileCount > 1000, `fileCount ${bsa.fileCount}`);
  const names = bsa.list();
  assert.ok(names.every((n) => n === normalizeBsaPath(n)));
  for (const n of names) assert.ok(bsa.get(n).byteLength >= 0);
});

// ── MW-LOAD (2026-09-08, Mac: "improve the load time when Morrowind assets
// are enabled"): THE ARCHIVE OPENS OFF A BLOB, BY RANGE. The store used to
// hand back each archive as a whole ArrayBuffer - a structured clone of
// 150-300 MB per archive, one to three seconds each measured - before a
// mesh was asked for. Off a Blob the directory is a few-megabyte range
// and an entry is a range of its own size. `get` stays synchronous and
// answers only what `load` brought in; that contract is what every
// reader speaks, and a reader that forgot to load is told so.
test('MW-LOAD: open(blob) reads the directory by range and nothing else; load brings an entry in; get answers only what is loaded', async () => {
  const reads = [];
  const blob = new Blob([ARCHIVE]);
  const spy = { size: blob.size, slice: (a, b) => { reads.push([a, b]); return blob.slice(a, b); } };
  const a = await MwBsaFile.open(spy);
  const whole = new MwBsaFile(ARCHIVE);
  assert.equal(a.lazy, true); assert.equal(whole.lazy, false);
  assert.deepEqual(a.list(), whole.list(), 'the same directory as the whole-buffer reader');
  assert.equal(reads.length, 2, 'the header, then the directory + hash table - two ranges');
  assert.deepEqual(reads[0], [0, 12]);
  assert.ok(reads[1][1] < ARCHIVE.byteLength, 'the directory range stops short of the data buffer');
  const name = whole.list()[0];
  assert.equal(a.has(name), true);
  assert.equal(a.loaded(name), false);
  assert.throws(() => a.get(name), /not loaded - await load/, 'a reader that did not load is told, not handed garbage');
  const bytes = await a.load(name);
  assert.deepEqual([...bytes], [...whole.get(name)], 'the range is the entry');
  assert.equal(a.loaded(name), true);
  assert.equal(a.get(name), bytes, 'get answers the loaded copy');
  assert.equal(await a.load(name), bytes, 'a second load is the first’s answer - one range read');
  assert.equal(reads.length, 3, 'one entry, one range');
  await a.loadAll([name, 'not/in/here.nif']);
  assert.equal(reads.length, 3, 'loadAll loads what the archive carries and skips what it does not, without re-reading');
  a.release();
  assert.equal(a.loaded(name), false, 'released');
  await assert.rejects(() => a.load('no/such.nif'), /no such file/);
  // the whole-buffer reader speaks the same doors
  assert.equal(whole.loaded(name), true);
  assert.deepEqual([...await whole.load(name)], [...whole.get(name)]);
  await assert.rejects(() => MwBsaFile.open({ size: 4, slice: () => blob.slice(0, 4) }), /too small/);
  await assert.rejects(() => MwBsaFile.open(null), /expects a Blob/);
});
