// WG2 PHASE 3 EXIT (bible/03-World/World-2-Arc.md): SETTLEMENTS WITHOUT RMB - the five prototype towns the
// specification names, each made from its region's ground: every building a whole record with a door on a street, none
// floating or buried, every street joined to the plaza, the type's services standing, a water town's dock; the
// culture changes the geometry (stilts and boardwalks in Black Marsh, terraces and walls in the Dragontails); one
// district made again leaves the rest and their ids; a Daggerfall town's buildings read as records with their keys.
// Pins mutation-checked (tools/mutants/wg2.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readBake, BAKE_DIR } from '../../../tools/wg2Bake.mjs';
import { decodeBake } from '../../../src/world/gen2/bakeCodec.js';
import { regionSampler } from '../../../src/world/gen2/regionSampler.js';
import { generateSettlement } from '../../../src/world/gen2/settle/settlementGen.js';
import { settlementProblems } from '../../../src/world/gen2/settle/settlementValidate.js';
import { siteCandidates, siteNeeds } from '../../../src/world/gen2/settle/siteSelect.js';
import { TEST_SETTLEMENTS } from '../../../src/world/gen2/settle/testSettlements.js';
import { mintIds, buildingProblems, settlementMapId, parseBuildingId, legacyBuildingId, WG2_SETTLEMENT_LANE } from '../../../src/world/gen2/settle/buildingRecord.js';
import { legacyBuildings } from '../../../src/world/gen2/settle/rmbAdapter.js';
import { buildingSummaries } from '../../../src/world/buildingSummaries.js';
import { isMadePlaceId } from '../../../src/world/placeIds.js';
import { homeBuildingKeyOk, homeMapIdOk } from '../../../src/net/homeLaw.js';
import { CAPITAL_LANE } from '../../../src/world/capitalLane.js';

const S = {};
for (const id of ['hammerfell-test', 'blackmarsh-test']) S[id] = regionSampler(decodeBake(readBake(`${BAKE_DIR}/${id}.wg2.gz`)));
const towns = new Map();
const town = (spec) => {
  if (!towns.has(spec.id)) {
    const s = S[spec.region], c = spec.x ? spec : siteCandidates(s, spec.type, { step: 3, count: 1 })[0];
    towns.set(spec.id, generateSettlement(s, { ...spec, x: c.x, y: c.y }));
  }
  return towns.get(spec.id);
};

for (const [i, spec] of TEST_SETTLEMENTS.entries()) {
  test(`WG2 SETTLEMENT ${spec.name} (${spec.type}, ${spec.style}): sound - its buildings whole once minted, its doors on its streets, nothing floating, buried or in the water, its streets one network, its services and its dock standing; no RMB block read (mutants: the plinth, the door's street, the services, the dock)`, () => {
    const t = town(spec), s = S[spec.region];
    assert.deepEqual(settlementProblems(s, t), []);
    const { buildings } = mintIds(t.id, settlementMapId(i + 1), t.buildings);
    assert.deepEqual(settlementProblems(s, { ...t, buildings }, { minted: true }), []);
    assert.ok(buildings.length >= 10, `${buildings.length} buildings`);
    assert.ok(buildings.every((b) => b.prefab !== 'rmb' && !b.legacy && b.interior.kind !== 'rmb'));
    for (const b of buildings) if (b.home) assert.ok(homeBuildingKeyOk(b.home.key) && homeMapIdOk(b.home.mapId));
  });
}

test('WG2 SETTLEMENT: one spec makes one town, and the culture shapes it - stilts and boardwalk water in Black Marsh, terraces with their pads and walls in the Dragontails, never stilts under a Redguard roof (mutants: the stilts, the pad, the walls)', () => {
  const [tava, mine, hold, , hist] = TEST_SETTLEMENTS.map(town);
  assert.deepEqual(generateSettlement(S['hammerfell-test'], { ...TEST_SETTLEMENTS[0] }), tava);
  assert.ok(hist.buildings.filter((b) => b.ground.kind === 'stilts').length > hist.buildings.length / 2);
  assert.ok(hist.features.some((f) => f.kind === 'platform' && f.stilts > 0));
  for (const t of [tava, mine, hold]) assert.ok(t.buildings.every((b) => b.ground.kind !== 'stilts'));
  for (const t of [mine, hold]) {
    const terraced = t.buildings.filter((b) => b.ground.kind === 'terrace');
    assert.ok(terraced.length > 0 && terraced.every((b) => t.terrainOps.some((o) => o.kind === 'pad' && o.at[0] === b.at.x && o.level === b.at.z)));
  }
  assert.ok(hold.features.some((f) => f.kind === 'wall') && hold.features.filter((f) => f.kind === 'gate').length >= 2, 'a fortified town walls itself');
  assert.ok(tava.features.some((f) => f.kind === 'field'), 'an oasis farms');
});

test('WG2 SITES: each type finds its own ground - the mine by the ore, the fortress on its height, the stilt village at the water\'s edge (mutants: a type\'s weights, the water town\'s reach)', () => {
  const [, mine, hold, , hist] = TEST_SETTLEMENTS.map(town), H = S['hammerfell-test'];
  assert.ok(siteNeeds(H, mine.centre.x, mine.centre.y).ore > 0.5);
  assert.ok(siteNeeds(H, hold.centre.x, hold.centre.y).defense > 0.2);
  assert.ok(siteNeeds(S['blackmarsh-test'], hist.centre.x, hist.centre.y).water > 0.8);
});

test('WG2 REGENERATE: one district made again leaves every other district\'s buildings where they stood with their ids; a retired id is never given again (mutants: the kept districts, the id book)', () => {
  const spec = TEST_SETTLEMENTS[2], t = town(spec), mapId = settlementMapId(3);
  const first = mintIds(t.id, mapId, t.buildings);
  const tally = new Map();
  for (const b of t.buildings) tally.set(b.district, (tally.get(b.district) ?? 0) + 1);
  const d = [...tally.keys()].sort((a, b) => tally.get(b) - tally.get(a) || (a < b ? -1 : 1))[0];   // the busiest district
  assert.ok(tally.size > 1, 'more than one district to keep');
  const kept = { ...t, buildings: first.buildings };
  const again = generateSettlement(S[spec.region], { ...spec, x: t.centre.x, y: t.centre.y, regenerate: [d], keep: kept, seed: spec.seed + 1 });
  const second = mintIds(t.id, mapId, again.buildings, first.book);
  const before = first.buildings.filter((b) => b.district !== d), after = second.buildings.filter((b) => b.district !== d);
  assert.deepEqual(after.map((b) => [b.id, b.at]), before.map((b) => [b.id, b.at]));
  const fresh = second.buildings.filter((b) => b.district === d).map((b) => b.id);
  for (const id of fresh) assert.ok(!second.book.retired.includes(id), id);
  assert.ok(new Set(second.buildings.map((b) => b.id)).size === second.buildings.length, 'every id once');
});

test('WG2 LEGACY: a Daggerfall town\'s buildings read as records - the key and the layout kept in the id, the block and the record pointed at, the role read from the building type; a record of a new building can never parse as a legacy one (mutants: the layout in the id, the role of a tavern)', () => {
  const block = { x: 1, y: 0, dfBlock: { rmbBlock: {
    fldHeader: { numBlockDataRecords: 2, buildingDataList: [{ buildingType: 15, nameSeed: 1, factionId: 0, quality: 10 }, { buildingType: 17, nameSeed: 2, factionId: 0, quality: 4 }] },
    subRecords: [{ xPos: 2048, zPos: 1024, yRotation: 0, exterior: { block3dObjectRecords: [] }, interior: {} }, { xPos: 512, zPos: 3072, yRotation: 0, exterior: { block3dObjectRecords: [] }, interior: {} }],
  } } };
  const rows = buildingSummaries([{ buildingType: 15, nameSeed: 1, factionId: 0, quality: 10 }], [block], {});
  const recs = legacyBuildings({ mapId: 1234567, layout: 'beautiful-cities@1.2' }, rows);
  assert.equal(recs.length, 2);
  assert.deepEqual(recs.map((r) => r.id), rows.map((r) => legacyBuildingId(1234567, r.buildingKey, 'beautiful-cities@1.2')));
  assert.deepEqual(recs.map((r) => r.role), ['tavern', 'house']);
  for (const r of recs) assert.deepEqual(buildingProblems(r), [], r.id);
  assert.deepEqual(parseBuildingId(recs[0].id), { legacy: true, mapId: 1234567, key: rows[0].buildingKey, layout: 'beautiful-cities@1.2' });
  assert.notEqual(legacyBuildingId(1, 2, 'classic'), legacyBuildingId(1, 2, 'beautiful-cities@1.2'), 'a pack\'s layout is another building');
  assert.equal(parseBuildingId('set-tava-wells/b3').legacy, false);
  assert.equal(parseBuildingId('rmb:1:2'), null, 'no layout, no legacy id');
  assert.equal(settlementMapId(1) >>> 20, WG2_SETTLEMENT_LANE);
  assert.ok(WG2_SETTLEMENT_LANE !== CAPITAL_LANE && isMadePlaceId(settlementMapId(1)), 'its own lane, past every Bay pixel id');
});
