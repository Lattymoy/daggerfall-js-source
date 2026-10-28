// FIRST-VISIT (2026-10-25, bible/07-Rendering/Performance-Priority.md FIRST-VISIT) - the ships' painted pictures kept
// across launches (world/ships/standInsKept.js, asked by galleonArt.js shipStandIns for the three port ships). Held
// here: a kept picture equals the painted one and nothing is painted for it; another palette refuses it; a malformed
// record is refused; a ship's art that is not marked kept (the studio's) is painted every time and never stored.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shipStandIns } from '../../../src/world/ships/galleonArt.js';
import { setDfLookPalette } from '../../../src/world/dfLook.js';
import { standInKey, _setStandInStoreForTests } from '../../../src/world/ships/standInsKept.js';

const paletteOf = (shift) => ({ getRed: (i) => (i * 3 + shift) & 255, getGreen: (i) => (i * 5) & 255, getBlue: (i) => (i * 7) & 255 });
function storeOf() {
  const m = new Map();
  return { m, sets: 0, async get(k) { return m.get(k) ?? null; }, async set(k, v) { this.sets++; m.set(k, structuredClone(v)); return true; } };
}
/** One ship of two records, its painting counted. */
function shipOf(kept = true) {
  let painted = 0;
  const art = (record) => {
    painted++;
    const data = new Uint8Array(8 * 4 * 4).map((_, i) => (i * 13 + record) & 255);
    return { width: 8, height: 4, data };
  };
  const entries = shipStandIns({ archive: 38131, name: 'test', records: [1, 2], art, night: {}, glow: () => null, kept });
  return { entries, painted: () => painted };
}
const built = (ship) => Promise.all(ship.entries.map((e) => e.build()));

test('FIRST-VISIT ship pictures: a kept picture is the painted one, and nothing is painted for it (mutant: the kept picture ignored)', async () => {
  const store = storeOf();
  _setStandInStoreForTests(store);
  setDfLookPalette(paletteOf(0));
  try {
    const first = shipOf();
    const want = await built(first);
    assert.equal(first.painted(), 2);
    assert.equal(store.m.size, 2);
    const second = shipOf();
    assert.deepEqual(await built(second), want);
    assert.equal(second.painted(), 0, 'read back, not painted');
  } finally { _setStandInStoreForTests(null); setDfLookPalette(null); }
});

test('FIRST-VISIT ship pictures: another palette refuses the kept picture; a malformed record is refused; a ship not marked kept never reaches the store (mutants: the palette left out of the key; any object taken; kept for every caller)', async () => {
  const store = storeOf();
  _setStandInStoreForTests(store);
  try {
    setDfLookPalette(paletteOf(0));
    await built(shipOf());
    const k = standInKey('test-38131_1');
    setDfLookPalette(paletteOf(1));
    assert.notEqual(standInKey('test-38131_1'), k);
    const other = shipOf();
    await built(other);
    assert.equal(other.painted(), 2, 'painted again for the other palette');
    store.m.set(standInKey('test-38131_1'), { width: 8, height: 4, data: new Uint8Array(3) });
    const bad = shipOf();
    await built(bad);
    assert.equal(bad.painted(), 1, 'the malformed one painted again');
    const sets = store.sets;
    const studio = shipOf(false);
    await built(studio);
    await built(studio);
    assert.equal(studio.painted(), 4);
    assert.equal(store.sets, sets, 'nothing stored');
  } finally { _setStandInStoreForTests(null); setDfLookPalette(null); }
});
