// FOUNDATION F1 (bible/03-World/Foundation-Arc.md): THE ATLAS - each place one bundle, the blocks a vocabulary named and
// never copied, every name resolved when the atlas is filled, the parts of eight kinds, a region's places one query.
// Synthetic, so it runs everywhere; the same laws on the player's own data are f1_atlas_corpus.test.js. A place past the
// Bay (Skyrim's) stands beside the Bay's (TAMRIEL-WIDE). Pins mutation-checked (tools/mutants/foundation.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAtlas, fillAtlas, ATLAS_VERSION, PART_KINDS, blockKindOf } from '../../../src/world/atlas/atlas.js';
import { placeOfRow } from '../../../src/world/worldWide/worldPlaces.js';
import { SETTLEMENTS_SOURCE } from '../../../src/world/settlement/settlementPlaces.js';
import { districtOf, areaOfDistrict } from '../../../src/world/worldWide/worldGrid.js';
import { servedBlockOf } from '../../../src/world/atlas/atlasServed.js';
import { registerPortBlock, registerWorldDataAsset, setLayoutPinOracle, installWorldDataReplacement } from '../../../src/formats/worldData/worldDataReplacement.js';
import { setValue } from '../../../src/systems/settings/settings.js';

const [cx, cy] = districtOf(1500, -400);
const SKYRIM_AREA = areaOfDistrict(3, cx, cy);
const PLACES = [
  placeOfRow({ mapId: 1, name: 'Daggerfall', px: 207, py: 213, type: 0, region: 17, w: 2, h: 1 }, 'bay'),
  placeOfRow({ mapId: 2, name: 'Castle Necromoghan', px: 210, py: 220, type: 8, region: 17, hasDungeon: true }, 'bay'),
  placeOfRow({ mapId: 3, name: 'Skyrim town', px: 1500, py: -400, type: 2, area: SKYRIM_AREA, w: 2, h: 1 }, 'tesa'),
];
/** Locations as MapsFile.getLocation mints them: an exterior grid, buildings, doors, and a dungeon's blocks. The town
 *  carries a dungeon record its location does not have (DFLocation.HasDungeon false): no dungeon stands. */
const LOCS = {
  1: { exterior: { exteriorData: { width: 2, height: 1, blockNames: ['AAA.RMB', 'BBB.RMB'] }, buildings: [{ buildingType: 2, factionId: 41, quality: 9 }, { buildingType: 15, factionId: 0, quality: 3 }],
    recordElement: { doors: [{ buildingDataIndex: 0 }, { buildingDataIndex: 1 }, { buildingDataIndex: 1 }] } },
  dungeon: { blocks: [{ blockName: 'W0000009.RDB', x: 0, z: 0 }] } },
  2: { hasDungeon: true, exterior: { exteriorData: { width: 1, height: 1, blockNames: ['AAA.RMB'] }, buildings: [], recordElement: { doors: [] } },
    dungeon: { blocks: [{ blockName: 'B0000002.RDB', x: 1, z: 0 }, { blockName: 'N0000001.RDB', x: 0, z: 0, isStartingBlock: true }] } },
  3: { exterior: { exteriorData: { width: 2, height: 1, blockNames: ['AAX.RMB', 'GONE.RMB'] }, buildings: [{ buildingType: 2, factionId: 0, quality: 5 }], recordElement: { doors: [{ buildingDataIndex: 0 }] } } },
};
/** BLOCKS.BSA's answer: its own names, AAX.RMB resolving to AAA.RMB (the alternate match), GONE.RMB nothing. */
const SERVED = new Set(['AAA.RMB', 'BBB.RMB', 'CCC.RMB', 'N0000001.RDB', 'B0000002.RDB', 'W0000009.RDB']);
const resolveBlock = (n) => (SERVED.has(n) ? n : n === 'AAX.RMB' ? 'AAA.RMB' : '');
const filled = () => {
  const atlas = createAtlas({ resolveBlock });
  // a settlement past the Bay (Skyrim's), on the settlements' list - planned, never asked of `locate`
  const settled = placeOfRow({ mapId: 875036674, name: "Kolvar's Cut", px: 1501, py: -401, type: 2, area: SKYRIM_AREA }, SETTLEMENTS_SOURCE);
  const r = fillAtlas(atlas, [...PLACES, placeOfRow({ mapId: 4, name: 'Nowhere', px: 5, py: 5, type: 0, region: 1 }, 'bay'), settled], (p) => (p.source === SETTLEMENTS_SOURCE ? LOCS[1] : LOCS[p.mapId]));
  return { atlas, r };
};

test('F1 the surface: version 1 and the closed set of eight part kinds; a kind outside it throws (mutants: a kind added or dropped, the guard gone)', () => {
  assert.equal(ATLAS_VERSION, 1);
  assert.deepEqual(PART_KINDS, ['place', 'exterior', 'dungeon', 'building', 'door', 'rmb', 'rdb', 'region']);
  assert.ok(Object.isFrozen(PART_KINDS));
  const { atlas } = filled();
  assert.throws(() => [...atlas.parts('flat')], RangeError);
  assert.deepEqual([blockKindOf('AAA.RMB'), blockKindOf('n0000001.rdb'), blockKindOf('FOO')], ['rmb', 'rdb', null]);
});

test('F1 one bundle a place: identity is the registry\'s, the grid and the plan by the vocabulary\'s ids, buildings and doors whole; a place no location answers is counted, not bundled; a second add keeps the first (mutants: the identity copied, the start lost, the doors\' building dropped, the keep, the dungeon ungated)', () => {
  const { atlas, r } = filled();
  assert.deepEqual(r, { added: 3, unlocated: [4], planned: [875036674] });   // the settlement place planned, never located
  const town = atlas.place(1);
  assert.equal(town.place, PLACES[0], 'the registry\'s own record, not a copy');
  assert.deepEqual([town.exterior.w, town.exterior.h, [...town.exterior.blocks]], [2, 1, [0, 1]]);
  assert.deepEqual([[...town.buildings.type], [...town.buildings.faction], [...town.buildings.quality]], [[2, 15], [41, 0], [9, 3]]);
  assert.deepEqual([...town.doors], [0, 1, 1]);
  assert.equal(town.dungeon, null, 'a dungeon record without HasDungeon stands no dungeon');
  const keep = atlas.place(2);
  assert.deepEqual([[...keep.dungeon.blocks], [...keep.dungeon.x], [...keep.dungeon.z], keep.dungeon.start], [[2, 3], [1, 0], [0, 0], 1]);
  assert.equal(atlas.add(PLACES[1], LOCS[1]), keep, 'a place in the atlas is kept as it is');
  assert.equal(atlas.place(4), null);
});

test('F1 the vocabulary: a block named by three places is one word used three times, never copied; an alternate name is the block it resolves to; what resolves to nothing is a problem, found at the fill (mutants: the resolve skipped, the uses uncounted, the problem unrecorded)', () => {
  const { atlas } = filled();
  assert.deepEqual(atlas.words(), [
    { name: 'AAA.RMB', kind: 'rmb', uses: 3 },
    { name: 'BBB.RMB', kind: 'rmb', uses: 1 },
    { name: 'B0000002.RDB', kind: 'rdb', uses: 1 },
    { name: 'N0000001.RDB', kind: 'rdb', uses: 1 },
  ]);
  assert.deepEqual(atlas.usersOf('AAA.RMB'), [1, 2, 3]);
  assert.deepEqual(atlas.usersOf('AAX.RMB'), [1, 2, 3], 'asked by the alternate name, the block it serves');
  assert.deepEqual(atlas.usersOf('CCC.RMB'), []);
  assert.deepEqual(atlas.problems(), [
    { place: 3, part: 'exterior', name: 'AAX.RMB', why: 'aliased', as: 'AAA.RMB' },
    { place: 3, part: 'exterior', name: 'GONE.RMB', why: 'unresolved' },
  ]);
  assert.deepEqual([...atlas.place(3).exterior.blocks], [0, -1]);
  assert.deepEqual(atlas.unused([...SERVED], 'rmb'), ['CCC.RMB']);
  assert.deepEqual(atlas.unused([...SERVED], 'rdb'), ['W0000009.RDB']);
});

test('F1 the parts: every kind one query - the places, the grids and plans by name, each building and door, the words, the regions with a province\'s beside the Bay\'s (mutants: a part kind\'s record, the region index)', () => {
  const { atlas } = filled();
  assert.deepEqual([...atlas.parts('place')].map((p) => [p.id, p.name, p.region, p.theatre]), [[1, 'Daggerfall', 17, 0], [2, 'Castle Necromoghan', 17, 0], [3, 'Skyrim town', 64, 3]]);
  assert.deepEqual([...atlas.parts('exterior')], [
    { kind: 'exterior', place: 1, w: 2, h: 1, blocks: ['AAA.RMB', 'BBB.RMB'] },
    { kind: 'exterior', place: 2, w: 1, h: 1, blocks: ['AAA.RMB'] },
    { kind: 'exterior', place: 3, w: 2, h: 1, blocks: ['AAA.RMB', ''] },
  ]);
  assert.deepEqual([...atlas.parts('dungeon')], [{ kind: 'dungeon', place: 2, start: 1, blocks: [{ name: 'B0000002.RDB', x: 1, z: 0 }, { name: 'N0000001.RDB', x: 0, z: 0 }] }]);
  assert.deepEqual([...atlas.parts('building')].map((b) => [b.place, b.index, b.type, b.faction, b.quality]), [[1, 0, 2, 41, 9], [1, 1, 15, 0, 3], [3, 0, 2, 0, 5]]);
  assert.deepEqual([...atlas.parts('door')].map((d) => [d.place, d.index, d.building]), [[1, 0, 0], [1, 1, 1], [1, 2, 1], [3, 0, 0]]);
  assert.deepEqual([...atlas.parts('rmb')], [{ kind: 'rmb', name: 'AAA.RMB', uses: 3, places: 3 }, { kind: 'rmb', name: 'BBB.RMB', uses: 1, places: 1 }]);
  assert.deepEqual([...atlas.parts('rdb')].map((w) => w.name), ['B0000002.RDB', 'N0000001.RDB']);
  assert.deepEqual([...atlas.parts('region')], [{ kind: 'region', region: 17, places: 2 }, { kind: 'region', region: 64, places: 1 }]);
  assert.deepEqual(atlas.inRegion(64).map((b) => b.id), [3], 'Skyrim\'s town is Skyrim\'s, region 64');
  assert.deepEqual(atlas.inRegion(17).map((b) => b.id), [1, 2]);
  assert.deepEqual(atlas.inRegion(5), []);
});

test('F1 the counts: the sizes the measurement reports, summed over the bundles (mutant: a sum dropped)', () => {
  const { atlas } = filled();
  assert.deepEqual(atlas.counts(), { places: 3, buildings: 3, doors: 4, dungeons: 1, exteriorSlots: 5, rmb: 2, dungeonSlots: 2, rdb: 2, regions: 2 });
});

test('F1 served: a name resolves as the layout reads it - BLOCKS.BSA\'s alternate match, a record of BLOCKS.BSA, and past it only a block the world-data door serves; an index a location was given with nothing behind it is unresolved (mutant: the door unasked)', () => {
  const INDEX = { 'AAA.RMB': 4, 'NEWB0001.RMB': 1400, 'PORTZ001.RMB': 950001 };
  const blocks = { count: 1295, checkName: (n) => (n === 'AAX.RMB' ? 'AAA.RMB' : n in INDEX ? n : ''), getBlockIndex: (n) => INDEX[n] ?? -1 };
  registerPortBlock('PORTZ001.RMB', { Name: 'PORTZ001.RMB' }, 950001);
  const served = servedBlockOf(blocks);
  assert.deepEqual(['AAA.RMB', 'AAX.RMB', 'NEWB0001.RMB', 'PORTZ001.RMB', 'NONE.RMB'].map(served), ['AAA.RMB', 'AAA.RMB', '', 'PORTZ001.RMB', '']);
  // AUDIT FOUNDATION II A3: a mod's block is served as at a town no save pinned - the pin of the town read last (here
  // every town's, out of the mod) is never the door's answer
  installWorldDataReplacement();
  setValue('Enhancements', 'AssetInjection', 'True');
  registerWorldDataAsset('NEWB0001.RMB.json', { Name: 'NEWB0001.RMB' }, null, { vendor: 'beautiful-villages' });
  setLayoutPinOracle(() => ({ out: new Set(['beautiful-villages']), in: new Set() }));
  try { assert.equal(served('NEWB0001.RMB'), 'NEWB0001.RMB'); } finally { setLayoutPinOracle(null); setValue('Enhancements', 'AssetInjection', 'False'); }
});
