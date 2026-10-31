// RMB-CONTRACTS RMBC1 (bible/03-World/RMB-Contracts.md): A LEGACY TOWN AS A PLAN - built from what the game's own building
// walk mints (world/buildingSummaries.js), every key kept as BuildingDirectory.MakeBuildingKey gave it, every building where
// RMBLayout.GetBuildingData stands it, its record its walls and rooms; and the directory read back from the plan. Synthetic,
// so it runs everywhere: a town past the Bay (a cloned layout under a Hammerfell town's id) beside the Bay's. The player's
// own files are rmbc1_legacy_corpus.test.js. Pins mutation-checked (tools/mutants/rmbc1.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { legacySettlementOf, directoryOf, LEGACY_PAD } from '../../../src/world/settlement/legacySettlement.js';
import { validateSettlement, keyBandOf, MINTED_KEY_MIN } from '../../../src/world/settlement/settlementContract.js';
import { buildingSummaries } from '../../../src/world/buildingSummaries.js';
import { makeBuildingKey } from '../../../src/systems/talk/talkTopics.js';
import { RMB_SIDE } from '../../../src/world/locationLayout.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { arenaPlaceId } from '../../../src/world/arenaLocations.js';

const T = BUILDING_TYPES;
/** A block as BlocksFile mints it: its building list and one subrecord a building, the second with a room. */
const block = (name, kinds) => ({
  name,
  rmbBlock: {
    fldHeader: { numBlockDataRecords: kinds.length, buildingDataList: kinds.map((t, i) => ({ buildingType: t, factionId: 0, quality: 4 + i, nameSeed: 100 + i })) },
    subRecords: kinds.map((_, i) => ({ xPos: 1000 + 400 * i, zPos: 2000, yRotation: 512 * i, interior: { header: { num3dObjectRecords: i } } })),
  },
});
const LAYOUT = { width: 2, height: 1, blocks: [{ x: 0, y: 0, blockName: 'AAA.RMB' }, { x: 1, y: 0, blockName: 'BBB.RMB' }] };
const BLOCKS = [{ x: 0, y: 0, dfBlock: block('AAA.RMB', [T.House1, T.Tavern]) }, { x: 1, y: 0, dfBlock: block('BBB.RMB', [T.Armorer]) }];
const summaries = buildingSummaries([], BLOCKS);
const PLACES = [['the Bay', 1, { px: 207, py: 213, east: 307.2, north: 358.4 }], ['past the Bay', arenaPlaceId({ provinceIndex: 1, id: 3 }), { px: 1000, py: 200, east: 307.2, north: 358.4 }]];

for (const [where, place, origin] of PLACES) {
  test(`RMBC1 legacy (${where}): every building keeps its minted key and stands where its record puts it; the plan keeps the contract (mutants: a key re-minted, a block origin dropped)`, () => {
    const plan = legacySettlementOf({ place, origin, layout: LAYOUT, summaries });
    assert.deepEqual(validateSettlement(plan), []);
    assert.equal(plan.place, place);
    assert.deepEqual(plan.buildings.map((b) => b.key), [makeBuildingKey(0, 0, 0), makeBuildingKey(0, 0, 1), makeBuildingKey(1, 0, 0)]);
    assert.deepEqual(plan.buildings.map((b) => b.key), summaries.map((s) => s.buildingKey), 'the walk\'s own keys');
    assert.ok(plan.buildings.every((b) => keyBandOf(b.key) === 'rmb' && b.source === 'legacy'));
    assert.deepEqual(plan.buildings[2].at, [RMB_SIDE + 1000 * 0.025, (4096 - 2000) * 0.025], 'the second block is RMB_SIDE east');
    assert.deepEqual(plan.buildings.map((b) => b.anchor), ['rmb:0,0.0', 'rmb:0,0.1', 'rmb:1,0.0']);
    assert.deepEqual(plan.buildings.map((b) => b.exterior), [{ kind: 'rmb', block: 'AAA.RMB', record: 0 }, { kind: 'rmb', block: 'AAA.RMB', record: 1 }, { kind: 'rmb', block: 'BBB.RMB', record: 0 }]);
    assert.deepEqual(plan.buildings.map((b) => b.interior?.record ?? null), [null, 1, null], 'a room where the record has one');
    assert.deepEqual(plan.buildings.map((b) => b.access), ['private', 'public', 'public'], 'a house is private');
    assert.deepEqual(plan.buildings.map((b) => b.yaw), summaries.map((s) => s.rotationY));
    assert.deepEqual(plan.pads, [{ id: LEGACY_PAD, poly: [[0, 0], [2 * RMB_SIDE, 0], [2 * RMB_SIDE, RMB_SIDE], [0, RMB_SIDE]], y: 0, rim: 'grade' }], 'one flat pad: today\'s town');
  });
}

test('RMBC1 the directory: the plan read back as the building lists read it; an RMB key carries its cell, a minted key none (mutant: a minted key decoded)', () => {
  const plan = legacySettlementOf({ place: 1, origin: PLACES[0][2], layout: LAYOUT, summaries });
  const rows = directoryOf(plan);
  assert.deepEqual(rows.map((r) => [r.buildingKey, r.buildingType, r.quality, r.nameSeed]), summaries.map((s) => [s.buildingKey, s.buildingType, s.quality, s.nameSeed]));
  assert.deepEqual(rows.map((r) => r.rmb), summaries.map((s) => ({ blockX: s.blockX, blockY: s.blockY, recordIndex: s.recordIndex })));
  assert.deepEqual(rows[2].position, [RMB_SIDE + 1000 * 0.025, 0, (4096 - 2000) * 0.025]);
  plan.pads[0].y = 2;
  plan.buildings.push({ ...plan.buildings[1], key: MINTED_KEY_MIN, source: 'authored', anchor: 'new' });
  const after = directoryOf(plan);
  assert.equal(after[3].rmb, null, 'a minted key names no block cell');
  assert.equal(after[3].position[1], 2, 'a floor stands on its pad');
  assert.ok(Object.isFrozen(after[3]));
});
