import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DFPalette } from '../src/formats/dfPalette.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

function loadPal(name) {
  const p = new DFPalette();
  const ok = p.load(new Uint8Array(readFileSync(join(ARENA2, name))), name);
  assert.equal(ok, true, `${name} should load`);
  return p;
}

// ---------------------------------------------------------------------------
// Synthetic - always run.
// ---------------------------------------------------------------------------

test('palette: unloaded palette is all red (DFU not-loaded marker)', () => {
  const p = new DFPalette();
  assert.deepEqual(p.get(0), { r: 255, g: 0, b: 0 });
  assert.deepEqual(p.get(255), { r: 255, g: 0, b: 0 });
});

test('palette: 768-byte raw and 776-byte headered files', () => {
  const raw = new Uint8Array(768);
  raw[0] = 1; raw[1] = 2; raw[2] = 3; // index 0
  raw[765] = 7; raw[766] = 8; raw[767] = 9; // index 255
  const p = new DFPalette();
  assert.equal(p.load(raw), true);
  assert.equal(p.headerLength, 0);
  assert.deepEqual(p.get(0), { r: 1, g: 2, b: 3 });
  assert.deepEqual(p.get(255), { r: 7, g: 8, b: 9 });

  const headered = new Uint8Array(776);
  headered[8] = 4; headered[9] = 5; headered[10] = 6; // index 0 after header
  const q = new DFPalette();
  assert.equal(q.load(headered), true);
  assert.equal(q.headerLength, 8);
  assert.deepEqual(q.get(0), { r: 4, g: 5, b: 6 });

  const bad = new DFPalette();
  assert.equal(bad.load(new Uint8Array(700)), false);
});

test('palette: MAP.PAL filename triggers x4 six-bit expansion', () => {
  const raw = new Uint8Array(768);
  raw[0] = 63; raw[1] = 3; raw[2] = 0;
  const p = new DFPalette();
  p.load(raw, 'MAP.PAL');
  assert.deepEqual(p.get(0), { r: 252, g: 12, b: 0 });
  // Other names untouched.
  const q = new DFPalette();
  q.load(raw, 'OLDMAP.PAL');
  assert.deepEqual(q.get(0), { r: 63, g: 3, b: 0 });
});

test('palette: set/get/find/fill/grayscale/setBuffer/clone', () => {
  const p = new DFPalette();
  p.fill(9, 9, 9);
  p.set(42, 10, 20, 30);
  assert.deepEqual(p.get(42), { r: 10, g: 20, b: 30 });
  assert.equal(p.getRed(42), 10);
  assert.equal(p.getGreen(42), 20);
  assert.equal(p.getBlue(42), 30);
  assert.equal(p.find(10, 20, 30), 42);
  assert.equal(p.find(1, 2, 3), -1);

  p.makeGrayscale();
  assert.deepEqual(p.get(128), { r: 128, g: 128, b: 128 });

  assert.throws(() => p.setBuffer(new Uint8Array(10)), /768 bytes/);
  const buf = new Uint8Array(768).fill(5);
  p.setBuffer(buf);
  assert.equal(p.headerLength, 0);
  assert.deepEqual(p.get(200), { r: 5, g: 5, b: 5 });

  p.set(0, 77, 78, 79);
  const c = p.clone();
  assert.deepEqual(c.get(0), { r: 77, g: 78, b: 79 });
  c.set(0, 1, 1, 1);
  assert.deepEqual(p.get(0), { r: 77, g: 78, b: 79 }); // deep copy
});

test('palette: readEmbedded reads 768 bytes at offset with header 8', () => {
  const container = new Uint8Array(1000);
  container[100] = 11; container[101] = 22; container[102] = 33;
  const p = new DFPalette();
  assert.equal(p.readEmbedded(container, 100), true);
  assert.equal(p.headerLength, 8);
  assert.deepEqual(p.get(0), { r: 11, g: 22, b: 33 });
  assert.equal(p.readEmbedded(container, 500), false); // would overrun
});

test('palette: makeAutomap building colours', () => {
  const p = new DFPalette();
  p.makeAutomap();
  assert.deepEqual(p.get(0), { r: 69, g: 60, b: 40 }); // common fill
  assert.deepEqual(p.get(12), { r: 69, g: 125, b: 195 }); // guild halls
  assert.deepEqual(p.get(16), { r: 85, g: 117, b: 48 }); // taverns
  assert.deepEqual(p.get(10), { r: 190, g: 85, b: 24 }); // general store
  assert.deepEqual(p.get(0xfb), { r: 0, g: 0, b: 0 }); // ground flats
});

// ---------------------------------------------------------------------------
// Real ARENA2 data - values observed from the original files. MAP.PAL values
// cross-check the multiply: raw six-bit magenta (63,0,63) appears in
// OLDMAP.PAL[1] and lands as (252,0,252) in MAP.PAL[255].
// ---------------------------------------------------------------------------

test('palette: all eight shipped palettes load with correct header detection', { skip: skipReal }, () => {
  for (const [name, hdr] of [
    ['PAL.PAL', 8], ['MAP.PAL', 0], ['OLDPAL.PAL', 0], ['OLDMAP.PAL', 0],
    ['ART_PAL.COL', 8], ['FMAP_PAL.COL', 8], ['NIGHTSKY.COL', 8], ['DANKBMAP.COL', 8],
  ]) {
    const p = loadPal(name);
    assert.equal(p.headerLength, hdr, name);
  }
});

test('palette: PAL.PAL pinned values', { skip: skipReal }, () => {
  const p = loadPal('PAL.PAL');
  assert.deepEqual(p.get(0), { r: 0, g: 0, b: 0 });
  assert.deepEqual(p.get(1), { r: 255, g: 0, b: 255 }); // magenta sentinel
  assert.deepEqual(p.get(255), { r: 48, g: 45, b: 45 });
  assert.equal(p.find(255, 0, 255), 1);
});

test('palette: ART_PAL.COL pinned values (standard texture palette)', { skip: skipReal }, () => {
  const p = loadPal('ART_PAL.COL');
  assert.deepEqual(p.get(0), { r: 0, g: 0, b: 0 });
  assert.deepEqual(p.get(1), { r: 255, g: 229, b: 129 });
  assert.deepEqual(p.get(112), { r: 220, g: 220, b: 220 });
  assert.deepEqual(p.get(255), { r: 0, g: 0, b: 0 });
});

test('palette: MAP.PAL multiplied against OLDMAP.PAL raw six-bit source', { skip: skipReal }, () => {
  const map = loadPal('MAP.PAL');
  const old = loadPal('OLDMAP.PAL');
  assert.deepEqual(map.get(0), { r: 12, g: 12, b: 12 });
  assert.deepEqual(map.get(255), { r: 252, g: 0, b: 252 });
  assert.deepEqual(old.get(1), { r: 63, g: 0, b: 63 }); // unexpanded six-bit magenta
});
