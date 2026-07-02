import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { BsaFile, DIRECTORY_TYPES } from '../src/formats/bsaFile.js';

// Real-data tests run only when ARENA2_PATH points at the original game data
// (freeware, never committed - see .gitignore and Port-Doctrine.md).
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

function loadBsa(name) {
  return new BsaFile(new Uint8Array(readFileSync(join(ARENA2, name))));
}

// Asserts the packing invariant that proves directory parsing is correct:
// records fill [4, directoryStart) exactly, no gaps, no overlap.
function assertStructuralClosure(bsa, byteLength) {
  const last = bsa.count - 1;
  assert.equal(bsa.getRecordPosition(0), 4);
  const endOfData = bsa.getRecordPosition(last) + bsa.getRecordLength(last);
  assert.equal(endOfData, bsa.directoryStart);
  const entrySize = bsa.directoryType === DIRECTORY_TYPES.NameRecord ? 18 : 8;
  assert.equal(bsa.directoryStart + entrySize * bsa.count, byteLength);
}

// ---------------------------------------------------------------------------
// Synthetic archives - exercise parsing logic with no game data (CI-safe).
// ---------------------------------------------------------------------------

function buildNameBsa(records) {
  const dataSize = records.reduce((n, r) => n + r.bytes.length, 0);
  const out = new Uint8Array(4 + dataSize + 18 * records.length);
  const view = new DataView(out.buffer);
  view.setInt16(0, records.length, true);
  view.setUint16(2, DIRECTORY_TYPES.NameRecord, true);
  let pos = 4;
  for (const r of records) {
    out.set(r.bytes, pos);
    pos += r.bytes.length;
  }
  for (const r of records) {
    for (let i = 0; i < r.name.length; i++) out[pos + i] = r.name.charCodeAt(i);
    view.setInt32(pos + 14, r.bytes.length, true);
    pos += 18;
  }
  return out;
}

function buildNumberBsa(records) {
  const dataSize = records.reduce((n, r) => n + r.bytes.length, 0);
  const out = new Uint8Array(4 + dataSize + 8 * records.length);
  const view = new DataView(out.buffer);
  view.setInt16(0, records.length, true);
  view.setUint16(2, DIRECTORY_TYPES.NumberRecord, true);
  let pos = 4;
  for (const r of records) {
    out.set(r.bytes, pos);
    pos += r.bytes.length;
  }
  for (const r of records) {
    view.setUint32(pos, r.id, true);
    view.setInt32(pos + 4, r.bytes.length, true);
    pos += 8;
  }
  return out;
}

test('bsa: synthetic name-record archive round-trips', () => {
  const a = new Uint8Array([1, 2, 3]);
  const b = new Uint8Array([9, 8, 7, 6]);
  const bytes = buildNameBsa([
    { name: 'FIRST.RMB', bytes: a },
    { name: 'SECOND.RDB', bytes: b },
  ]);
  const bsa = new BsaFile(bytes);
  assert.equal(bsa.count, 2);
  assert.equal(bsa.directoryType, DIRECTORY_TYPES.NameRecord);
  assert.equal(bsa.getRecordName(0), 'FIRST.RMB');
  assert.equal(bsa.getRecordIndex('SECOND.RDB'), 1);
  assert.equal(bsa.getRecordIndex('MISSING'), -1);
  assert.deepEqual(bsa.getRecordBytes(0), a);
  assert.deepEqual(bsa.getRecordBytes(1), b);
  assert.equal(bsa.getRecordId(0), 0); // name directories have no ids
  assertStructuralClosure(bsa, bytes.byteLength);
});

test('bsa: synthetic number-record archive round-trips', () => {
  const a = new Uint8Array([5]);
  const b = new Uint8Array([1, 1]);
  const bytes = buildNumberBsa([
    { id: 44005, bytes: a },
    { id: 40000, bytes: b },
  ]);
  const bsa = new BsaFile(bytes);
  assert.equal(bsa.count, 2);
  assert.equal(bsa.directoryType, DIRECTORY_TYPES.NumberRecord);
  assert.equal(bsa.getRecordId(0), 44005);
  assert.equal(bsa.getRecordName(1), '40000');
  assert.equal(bsa.getRecordIndex('40000'), -1); // name lookup invalid on number dirs
  assert.deepEqual(bsa.getRecordBytes(1), b);
  assertStructuralClosure(bsa, bytes.byteLength);
});

test('bsa: invalid inputs rejected', () => {
  assert.throws(() => new BsaFile('not bytes'), TypeError);
  const bad = new Uint8Array([1, 0, 0x33, 0x03]); // count=1, type=0x0333 invalid
  assert.throws(() => new BsaFile(bad), /invalid DirectoryType/);
});

// ---------------------------------------------------------------------------
// Real ARENA2 data - values below observed from original files and
// cross-checked against dfworkshop documentation (62 regions x 4 = 248 MAPS
// records; 10251 ARCH3D records; 1295 blocks).
// ---------------------------------------------------------------------------

test('bsa: ARCH3D.BSA reads with structural closure', { skip: skipReal }, () => {
  const bytes = new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA')));
  const bsa = new BsaFile(bytes);
  assert.equal(bsa.count, 10251);
  assert.equal(bsa.directoryType, DIRECTORY_TYPES.NumberRecord);
  assert.equal(bsa.getRecordId(0), 44005);
  assert.equal(bsa.getRecordName(bsa.count - 1), '40000');
  assertStructuralClosure(bsa, bytes.byteLength);
});

test('bsa: BLOCKS.BSA reads with structural closure', { skip: skipReal }, () => {
  const bytes = new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA')));
  const bsa = new BsaFile(bytes);
  assert.equal(bsa.count, 1295);
  assert.equal(bsa.directoryType, DIRECTORY_TYPES.NameRecord);
  assert.equal(bsa.getRecordName(0), 'WALLAA03.RMB');
  assert.equal(bsa.getRecordName(bsa.count - 1), 'CARNAA07.RMB');
  // Every block record is an exterior (.RMB), dungeon (.RDB) or interior (.RDI)
  // block - except index 669, a junk record literally named "FOO" that ships in
  // the original BLOCKS.BSA. Real data quirk, not a parser bug.
  for (let i = 0; i < bsa.count; i++) {
    const name = bsa.getRecordName(i);
    if (i === 669) {
      assert.equal(name, 'FOO');
      continue;
    }
    assert.match(name, /\.(RMB|RDB|RDI)$/);
  }
  assertStructuralClosure(bsa, bytes.byteLength);
});

test('bsa: MAPS.BSA reads with structural closure', { skip: skipReal }, () => {
  const bytes = new Uint8Array(readFileSync(join(ARENA2, 'MAPS.BSA')));
  const bsa = new BsaFile(bytes);
  assert.equal(bsa.count, 248); // 62 regions x 4 record types
  assert.equal(bsa.directoryType, DIRECTORY_TYPES.NameRecord);
  assert.equal(bsa.getRecordName(0), 'MAPPITEM.000');
  assert.equal(bsa.getRecordName(bsa.count - 1), 'MAPNAMES.061');
  const idx = bsa.getRecordIndex('MAPNAMES.000');
  assert.equal(idx, 3);
  assert.equal(bsa.getRecordBytes(idx).length, bsa.getRecordLength(idx));
  assertStructuralClosure(bsa, bytes.byteLength);
});
