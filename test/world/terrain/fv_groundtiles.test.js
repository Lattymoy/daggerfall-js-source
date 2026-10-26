// FIRST-VISIT (2026-10-25, bible/07-Rendering/Performance-Priority.md FIRST-VISIT) - the boot walks' ground tiles kept
// across launches (world/terrain/groundTilesKept.js, read by terrainTiles.js locationRectReader). Held here: a launch
// whose record is stored reads no block and answers the rects a launch without one computes; a changed BLOCKS.BSA, a
// changed door and another walk each refuse the stored record; a malformed record is refused; a set block variant
// reads through.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { locationRectReader } from '../../../src/world/terrain/terrainTiles.js';
import { MapsFile } from '../../../src/formats/mapsFile.js';
import { setWorldDataDoor } from '../../../src/formats/worldData/worldDataDoor.js';
import { prefetchGroundTiles, groundTilesKey, _flushGroundTiles, _resetGroundTiles } from '../../../src/world/terrain/groundTilesKept.js';
import { setBlockVariant, clearWorldDataVariants } from '../../../src/systems/worldDataVariants.js';

const NAMES = ['RESIAM10.RMB', 'TVRNAS08.RMB', 'MAGEAA12.RMB', 'GENRAS00.RMB'];
const BYTES = new Uint8Array(200 * 1024).map((_, i) => (i * 31) & 255);

/** A BLOCKS.BSA whose every read is counted. */
function blocksOf(bytes = BYTES) {
  const index = new Map(NAMES.map((n, i) => [n, i]));
  const reads = [];
  return {
    reads,
    bytes,
    checkName: (n) => (index.has(n) ? n : ''),
    getBlockIndex: (n) => index.get(n) ?? -1,
    getBlock: (i) => {
      reads.push(i);
      const groundTiles = Array.from({ length: 16 }, (_, x) => Array.from({ length: 16 }, (_, y) => ({ tileBitfield: (x * 7 + y + i) & 63, textureRecord: x >= i % 9 && y >= (i * 3) % 7 ? 3 : 60, isRotated: false, isFlipped: false })));
      return { rmbBlock: { fldHeader: { groundData: { groundTiles } } } };
    },
  };
}
const town = (r, l, w, h, names) => ({ regionIndex: r, locationIndex: l, exterior: { exteriorData: { width: w, height: h, blockNames: names } }, mapTableData: { locationType: 0 } });
const WALK = [town(17, 40, 2, 2, NAMES), town(17, 41, 1, 2, [NAMES[1], NAMES[3]]), town(23, 7, 2, 1, [NAMES[2], NAMES[0]])];

/** The player's derived store, as a Map - every get and set counted. */
function storeOf() {
  const m = new Map();
  return { m, gets: 0, sets: 0, async get(k) { this.gets++; return m.get(k) ?? null; }, async set(k, v) { this.sets++; m.set(k, structuredClone(v)); return true; } };
}
/** One launch: fetch the record, walk, write back. Answers the rects and the blocks read. */
async function launch(store, { serving = 'open|A', blocks = blocksOf(), as = null } = {}) {
  _resetGroundTiles();
  setWorldDataDoor(null);
  const found = await prefetchGroundTiles({ blocksBytes: blocks.bytes, serving, store });
  const rectOf = locationRectReader(new MapsFile(), blocks, as);
  const rects = WALK.map((loc) => rectOf(loc));
  await _flushGroundTiles();
  return { found, rects, reads: blocks.reads.length };
}

test('FIRST-VISIT ground tiles: a launch with the record stored reads no block and answers the rects a launch without one computed (mutant: the kept tiles ignored)', async () => {
  const store = storeOf();
  const first = await launch(store);
  assert.equal(first.found, false);
  assert.equal(first.reads, NAMES.length, 'the first launch reads each block once');
  assert.equal(store.m.size, 1, 'one record kept');
  const second = await launch(store);
  assert.equal(second.found, true);
  assert.equal(second.reads, 0, 'the second reads none');
  assert.deepEqual(second.rects, first.rects);
  _resetGroundTiles();
});

test('FIRST-VISIT ground tiles: another BLOCKS.BSA, another door or another walk refuses the stored tiles - worked out again (mutants: the stamp or the serving left out of the key; one record for every walk)', async () => {
  const store = storeOf();
  await launch(store);
  const other = new Uint8Array(BYTES); other[5] ^= 1;
  assert.notEqual(groundTilesKey(other, 'open|A'), groundTilesKey(BYTES, 'open|A'));
  for (const o of [{ blocks: blocksOf(other) }, { serving: 'open|B' }, { as: { regionIndex: 61, locationIndex: -1000 } }]) {
    const r = await launch(store, o);
    assert.equal(r.reads, NAMES.length, JSON.stringify(Object.keys(o)));
  }
  _resetGroundTiles();
});

test('FIRST-VISIT ground tiles: a malformed record is refused; a set block variant reads through and keeps nothing (mutants: any Map taken; the variant unasked)', async () => {
  const store = storeOf();
  store.m.set(groundTilesKey(BYTES, 'open|A'), new Map([['', new Map([[0, new Int32Array(3)]])]]));
  const bad = await launch(store);
  assert.equal(bad.found, false);
  assert.equal(bad.reads, NAMES.length);
  setBlockVariant(NAMES[0], '_v1');
  try {
    const v = await launch(store);
    assert.equal(v.reads, NAMES.length, 'a variant reads every block through');
  } finally { clearWorldDataVariants(); }
  _resetGroundTiles();
});

