// AUDIT 68 (2026-09-24), cluster formats_a - src/formats arch3dFile..
// mwCharacter. ARCH3D.BSA wrapped and patched per record instead of copied
// whole; DFRandom and the DXT5 alpha selectors off BigInt; key segments
// found by binary search; one BuildingData and one people/flat reader;
// four uncalled DFU members gone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Arch3dFile } from '../src/formats/arch3dFile.js';
import { ARCH3D_PATCH } from '../src/formats/arch3dPatch.js';
import * as blocks from '../src/formats/blocksFile.js';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { MapsFile } from '../src/formats/mapsFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { srand, rand, getSeed } from '../src/formats/dfRandom.js';
import { dxtDecode } from '../src/formats/dxt.js';
import { parseNif } from '../src/formats/mwNifFile.js';
import { extractTracks, sampleTrack } from '../src/formats/mwAnim.js';
import { readBuildingRecords } from '../src/formats/saveTreeFile.js';

const src = (p) => readFileSync(new URL(`../src/formats/${p}`, import.meta.url), 'utf8');
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

/** A NumberRecord BSA (BsaFile.cs layout): int16 count, uint16 0x0200,
 *  the records packed from offset 4, then uint32 id + int32 size each. */
function numberBsa(sizes) {
  const data = sizes.reduce((a, b) => a + b, 0);
  const bytes = new Uint8Array(4 + data + 8 * sizes.length);
  const v = new DataView(bytes.buffer);
  v.setInt16(0, sizes.length, true);
  v.setUint16(2, 0x0200, true);
  for (let i = 4; i < 4 + data; i++) bytes[i] = (i * 7 + 3) & 0xff;
  let d = 4 + data;
  sizes.forEach((size, i) => {
    v.setUint32(d, 1000 + i, true);
    v.setInt32(d + 4, size, true);
    d += 8;
  });
  return bytes;
}

test('AUDIT 68 S10-arch3d-26mb-copy: load wraps the caller\'s archive instead of copying it', () => {
  const bytes = numberBsa([8]);
  const a = new Arch3dFile();
  assert.equal(a.load(bytes), true);
  assert.equal(a._bsa._bytes, bytes, 'ARCH3D.BSA is held once, not twice');
});

test('AUDIT 68 S10-arch3d-26mb-copy: every record reads the DFU-patched bytes, a split entry on both sides', () => {
  // ARCH3D_PATCH[0] = [14515830, [0, 252]]: record 0 ends between its two
  // bytes, so one entry patches the last byte of 0 and the first of 1.
  const [[split]] = ARCH3D_PATCH;
  const sizes = [split + 1 - 4, 4096, 64];
  const bytes = numberBsa(sizes);
  const pristine = bytes.slice();
  // DFU's own order: the whole buffer patched in table order.
  const want = bytes.slice();
  for (const [offset, data] of ARCH3D_PATCH) {
    for (let i = 0; i < data.length; i++) want[offset + i] = data[i];
  }
  const dirStart = bytes.length - 8 * sizes.length;
  assert.ok(Buffer.from(want.subarray(dirStart)).equals(Buffer.from(bytes.subarray(dirStart))),
    'fixture: no entry lands in the directory');

  const a = new Arch3dFile();
  assert.equal(a.load(bytes), true);
  const got = [];
  a._read = function (record) { got[record] = this._records[record].bytes; return false; };
  let pos = 4;
  sizes.forEach((size, r) => {
    a.loadRecord(r);
    assert.ok(Buffer.from(got[r]).equals(Buffer.from(want.subarray(pos, pos + size))), `record ${r}`);
    pos += size;
  });
  assert.deepEqual([got[0][sizes[0] - 1], got[1][0]], [0, 252]);
  assert.ok(Buffer.from(bytes).equals(Buffer.from(pristine)), 'the caller\'s buffer stays unpatched');
});

test('AUDIT 68 S10-dfrandom-bigint: the uint32 state draws the classic sequence', () => {
  srand(-1);
  assert.deepEqual([rand(), rand(), rand(), rand(), rand()], [15929, 4409, 9862, 26718, 8713]);
  assert.equal(getSeed(), 571035320);
  srand(12345);
  assert.deepEqual([rand(), rand(), rand(), rand(), rand()], [21468, 9988, 22117, 3498, 16927]);
  assert.equal(getSeed(), 3256818826);
  assert.doesNotMatch(code('dfRandom.js'), /BigInt|\b\d+n\b/,
    'only the low 32 bits of DFU\'s ulong are observable - no BigInt per draw');
});

test('AUDIT 68 S10-dxt5-alpha-bigint: every 3-bit alpha selector, including those straddling bytes', () => {
  // The reference reads selector t bit by bit: bit t*3+b of bytes 2..7.
  const sel = (block, t) => {
    let s = 0;
    for (let b = 0; b < 3; b++) {
      const bit = t * 3 + b;
      s |= ((block[2 + (bit >> 3)] >> (bit & 7)) & 1) << b;
    }
    return s;
  };
  let seed = 7;
  const next = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) >>> 24;
  for (let n = 0; n < 64; n++) {
    const d5 = new Uint8Array(16).map(next);
    const pal = [d5[0], d5[1]];
    if (d5[0] > d5[1]) {
      for (let i = 1; i <= 6; i++) pal.push(Math.trunc(((7 - i) * d5[0] + i * d5[1]) / 7));
    } else {
      for (let i = 1; i <= 4; i++) pal.push(Math.trunc(((5 - i) * d5[0] + i * d5[1]) / 5));
      pal.push(0, 255);
    }
    const px = dxtDecode(d5, 4, 4, true);
    for (let t = 0; t < 16; t++) assert.equal(px[t * 4 + 3], pal[sel(d5, t)], `block ${n} texel ${t}`);
  }
  assert.doesNotMatch(code('dxt.js'), /BigInt/, 'two 24-bit words hold the 48 selector bits');
});

const ARMIDLE = new Uint8Array(readFileSync(new URL('./fixtures/mw/armidle.kf', import.meta.url)));

/** The producer's bip01 track (linear translations, Float32Array values)
 *  with its translation keys replaced by `times`. */
function bip01With(times) {
  const real = extractTracks(parseNif(ARMIDLE)).get('bip01');
  const [proto] = real.translations.keys;
  const keys = times.map((time, i) => ({ ...proto, time, value: Float32Array.from([i, -2 * i, 0.5 * i]) }));
  return { track: { ...real, translations: { ...real.translations, keys } }, keys };
}

test('AUDIT 68 S10-mwanim-linear-segment: a sample late in a long track reads a handful of keys', () => {
  const { track, keys } = bip01With(Array.from({ length: 4096 }, (_, i) => i / 15));
  let reads = 0;
  track.translations.keys = new Proxy(keys, {
    get(t, p, r) {
      if (typeof p === 'string' && /^\d+$/.test(p)) reads++;
      return Reflect.get(t, p, r);
    },
  });
  const { translation } = sampleTrack(track, 4090 / 15 + 0.01);
  assert.ok(Math.abs(translation[0] - 4090.15) < 1e-6);
  assert.ok(reads < 64, `${reads} key reads for one channel`);
});

test('AUDIT 68 S10-mwanim-linear-segment: the bracketing segment is the linear walk\'s, duplicate times too', () => {
  const times = [0, 0.5, 0.5, 0.5, 1, 1.25, 2, 2, 3, 3, 3.5];
  const { track, keys } = bip01With(times);
  // The pre-change walk, transcribed.
  const linear = (time) => {
    if (time <= keys[0].time) return [...keys[0].value];
    const last = keys.length - 1;
    if (time >= keys[last].time) return [...keys[last].value];
    let i = 0;
    while (keys[i + 1].time < time) i++;
    const span = keys[i + 1].time - keys[i].time;
    const u = span > 0 ? (time - keys[i].time) / span : 0;
    return [0, 1, 2].map((ax) => keys[i].value[ax] + (keys[i + 1].value[ax] - keys[i].value[ax]) * u);
  };
  const probes = [...times, -1, 4];
  for (let n = 0; n < 1000; n++) probes.push(((n * 7919) % 4000) / 1000 - 0.25);
  for (const time of probes) assert.deepEqual(sampleTrack(track, time).translation, linear(time), `t = ${time}`);
});

test('AUDIT 68 S10-rmb-record-readers-dup: one BuildingData reader, shared by RMB, MAPS and SAVETREE', () => {
  assert.equal(typeof blocks.readBuildingData, 'function');
  assert.equal(blocks.BUILDING_DATA_SIZE, 26);
  const rec = new Uint8Array(4 + 26);
  const v = new DataView(rec.buffer);
  v.setInt32(0, 26, true);
  v.setUint16(4, 0xbeef, true);
  v.setUint32(6, 0xdeadbeef, true);
  v.setUint16(10, 2, true);
  v.setUint16(12, 3, true);
  v.setUint32(14, 0x80000004, true);
  v.setUint32(18, 5, true);
  v.setUint16(22, 0xfffe, true);
  v.setInt16(24, -2, true);
  v.setUint16(26, 7778, true);
  rec[28] = 13;
  rec[29] = 250;
  const want = {
    nameSeed: 0xbeef, serviceTimeLimit: 0xdeadbeef,
    unknown: 2, unknown2: 3, unknown3: 0x80000004, unknown4: 5,
    factionId: 0xfffe, sector: -2, locationId: 7778,
    buildingType: 13, quality: 250,
  };
  assert.deepEqual(blocks.readBuildingData(v, 4), want);
  assert.deepEqual(readBuildingRecords(rec, 0).record.recordData, [want]);
  const decoders = ['blocksFile.js', 'mapsFile.js', 'saveTreeFile.js']
    .reduce((n, f) => n + (src(f).match(/serviceTimeLimit: \w+\.getUint32/g) ?? []).length, 0);
  assert.equal(decoders, 1, 'DFLocation.BuildingData has one reader');
});

test('AUDIT 68 S10-rmb-record-readers-dup: a people record decodes as the 17-byte flat record', () => {
  // A block sub-record: its 17-byte header (one people record, nothing
  // else), then the record.
  const bytes = new Uint8Array(17 + 17);
  const v = new DataView(bytes.buffer);
  bytes[3] = 1;
  v.setInt32(17, -100, true);
  v.setInt32(21, 200, true);
  v.setInt32(25, -300, true);
  v.setUint16(29, (182 << 7) | 5, true);
  v.setInt16(31, -9, true);
  bytes[33] = 0x81;
  const r = { pos: 0 };
  const sub = new BlocksFile()._readRmbBlockSubRecord(r, { bytes, view: v });
  assert.equal(r.pos, 34);
  assert.deepEqual(sub.blockPeopleRecords, [{
    position: 17, xPos: -100, yPos: 200, zPos: -300,
    textureBitfield: (182 << 7) | 5, textureArchive: 182, textureRecord: 5,
    factionID: -9, flags: 0x81,
  }]);
  assert.equal((src('blocksFile.js').match(/textureRecord: textureBitfield & 0x7f/g) ?? []).length, 1,
    'people and flats share _readRmbFlatObjectRecords');
});

test('AUDIT 68 S10-dead-discard-makeRandom: the uncalled DFU members are gone', () => {
  assert.equal(DFPalette.prototype.makeRandom, undefined);
  assert.equal(BlocksFile.prototype.discardAllBlocks, undefined);
  assert.equal(Arch3dFile.prototype.discardAllRecords, undefined);
  assert.equal(MapsFile.prototype.discardAllRegions, undefined);
});
