// RMB-CONTRACTS RMBC1 (bible/03-World/RMB-Contracts.md): A LEGACY TOWN AS A PLAN, on the player's own files - the city of
// Daggerfall as MAPS.BSA and BLOCKS.BSA hold it, and the same layout cloned under a Hammerfell town's id the way TESA7
// stands a town past the Bay (world/arenaLocations.js synthesizeArenaLocation). Every key the game's walk mints is the
// plan's, and both plans keep the contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HAS_ARENA2, loadMaps, loadBlocks } from '../../arena1Data.mjs';
import { layoutLocation } from '../../../src/world/locationLayout.js';
import { buildingSummaries } from '../../../src/world/buildingSummaries.js';
import { legacySettlementOf, directoryOf } from '../../../src/world/settlement/legacySettlement.js';
import { validateSettlement, keyBandOf } from '../../../src/world/settlement/settlementContract.js';
import { synthesizeArenaLocation, arenaPlaceId } from '../../../src/world/arenaLocations.js';
import { isMadePlaceId } from '../../../src/world/placeIds.js';

const skip = !HAS_ARENA2 && 'ARENA2_PATH not set - real-data validation skipped';
const HAMMERFELL_TOWN = { province: 'Hammerfell', provinceIndex: 1, id: 3, kind: 'city', name: 'Rmbc Test', bx: 1000, by: 200 };

test('RMBC1 legacy with ARENA2: Daggerfall\'s 647 buildings over 64 blocks, and its clone past the Bay, each a plan that keeps the contract with the walk\'s own keys', { skip }, () => {
  const maps = loadMaps(), blocks = loadBlocks();
  const city = maps.getLocation(17, 1231);
  assert.equal(city.name, 'Daggerfall');
  const clone = synthesizeArenaLocation(city, HAMMERFELL_TOWN);
  const keys = [];
  for (const [loc, origin] of [[city, { px: 207, py: 213, east: 0, north: 0 }], [clone, { px: 1000, py: 200, east: 0, north: 0 }]]) {
    const layout = layoutLocation(loc, maps, blocks);
    const summaries = buildingSummaries(loc.exterior.buildings, layout.blocks, { locationIndex: loc.locationIndex });
    const place = loc.mapTableData.mapId;
    const plan = legacySettlementOf({ place, origin, layout, summaries });
    assert.deepEqual(validateSettlement(plan), [], loc.name);
    assert.deepEqual([layout.blocks.length, plan.buildings.length, plan.buildings.filter((b) => b.interior).length], [64, 647, 632], loc.name);
    assert.deepEqual(plan.buildings.map((b) => b.key), summaries.map((s) => s.buildingKey));
    assert.equal(new Set(plan.buildings.map((b) => b.key)).size, 647, 'one key a building');
    assert.ok(plan.buildings.every((b) => keyBandOf(b.key) === 'rmb'));
    assert.deepEqual(directoryOf(plan).map((r) => r.rmb), summaries.map((s) => ({ blockX: s.blockX, blockY: s.blockY, recordIndex: s.recordIndex })));
    keys.push({ place, keys: plan.buildings.map((b) => b.key) });
  }
  assert.equal(keys[0].place, 1291010263);
  assert.equal(keys[1].place, arenaPlaceId(HAMMERFELL_TOWN));
  assert.ok(isMadePlaceId(keys[1].place));
  assert.deepEqual(keys[1].keys, keys[0].keys, 'one layout, one set of keys: the place tells them apart');
});
