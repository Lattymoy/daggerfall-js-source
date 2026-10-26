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
import { registerWorldDataPack, worldDataBlocksServing, _resetWorldDataReplacement } from '../../../src/formats/worldData/worldDataReplacement.js';

const NAMES = ['RESIAM10.RMB', 'TVRNAS08.RMB', 'MAGEAA12.RMB', 'GENRAS00.RMB'];
const BYTES = new Uint8Array(200 * 1024).map((_, i) => (i * 31) & 255);

/** A BLOCKS.BSA whose every read is counted; `order` the names at their indices (a pack's new blocks take theirs in the
 *  order the index meets them). A block's tiles are its name's. */
function blocksOf(bytes = BYTES, order = NAMES) {
  const index = new Map(order.map((n, i) => [n, i]));
  const reads = [];
  return {
    reads,
    bytes,
    checkName: (n) => (index.has(n) ? n : ''),
    getBlockIndex: (n) => index.get(n) ?? -1,
    getBlockName: (i) => order[i] ?? null,
    getBlock: (i) => {
      reads.push(i);
      const k = NAMES.indexOf(order[i]);
      const groundTiles = Array.from({ length: 16 }, (_, x) => Array.from({ length: 16 }, (_, y) => ({ tileBitfield: (x * 7 + y + k) & 63, textureRecord: x >= k % 9 && y >= (k * 3) % 7 ? 3 : 60, isRotated: false, isFlipped: false })));
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


test('FIRST-VISIT ground tiles: what the door serves blocks by reads the same whichever pack registered first, and moves with a pack\'s version or switch (mutants: registration order kept; the version left out)', () => {
  const packOf = (vendor, names, version = '1.0') => ({ vendor, mod: { version }, names: () => names, rebuild: () => ({}) });
  const villages = packOf('beautiful-villages', ['FIGHBM00.RMB.json', 'TEMPAA00.RMB.json']);
  const cities = packOf('beautiful-cities', ['FIGHBM00.RMB.json', 'WALLAA02.RMB.json']);
  const serving = (packs, on = () => true) => {
    _resetWorldDataReplacement();
    for (const [p, priority] of packs) registerWorldDataPack(p, () => on(p.vendor), { priority });
    return worldDataBlocksServing();
  };
  try {
    const a = serving([[villages, 10], [cities, 20]]);
    assert.equal(serving([[cities, 20], [villages, 10]]), a, 'the same whichever pack answered its fetch first');
    assert.notEqual(serving([[villages, 10], [packOf('beautiful-cities', ['FIGHBM00.RMB.json', 'WALLAA02.RMB.json'], '1.1'), 20]]), a, 'a pack updated');
    assert.notEqual(serving([[villages, 10], [cities, 20]], (v) => v !== 'beautiful-cities'), a, 'a mod switched off');
  } finally { _resetWorldDataReplacement(); }
});

test('FIRST-VISIT ground tiles: a block is kept by its name - the next launch\'s indices in another order read each block\'s own tiles (mutant: kept by index)', async () => {
  const store = storeOf();
  const first = await launch(store);
  const moved = blocksOf(BYTES, [...NAMES].reverse());
  const second = await launch(store, { blocks: moved });
  assert.equal(second.reads, 0, 'every block found by name');
  assert.deepEqual(second.rects, first.rects, 'the same town, the same rects');
  _resetGroundTiles();
});
