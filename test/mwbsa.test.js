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

test('mwbsa: normalizeBsaPath lowercases and forward-slashes', () => {
  assert.equal(normalizeBsaPath('Meshes\\B\\Foo.NIF'), 'meshes/b/foo.nif');
  assert.equal(normalizeBsaPath('textures/fixture.dds'), 'textures/fixture.dds');
});

test('mwbsa: directory, listing, and byte-exact retrieval', () => {
  const bsa = new MwBsaFile(ARCHIVE);
  assert.equal(bsa.fileCount, 3);
  assert.deepEqual(bsa.list(), [
    'meshes/fixture/mesh.nif',
    'meshes/fixture/skinned.nif',
    'textures/fixture.dds',
  ]);
  // Retrieval is case/slash-insensitive and byte-exact against the loose
  // fixtures the archive was packed from.
  assert.deepEqual(bsa.get('Meshes\\Fixture\\MESH.NIF'), MESH);
  assert.deepEqual(bsa.get('meshes/fixture/skinned.nif'), SKINNED);
  assert.deepEqual(bsa.get('textures\\fixture.dds'), new Uint8Array([1, 2, 3, 4, 5]));
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
