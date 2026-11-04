import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  setPref,
  getPref,
  isOfflineHousingActive,
} from '../../src/systems/uiPrefs.js';
import {
  createOfflineHomes,
  createOfflineDecor,
  isOfflineHouseOwned,
  offlineHomeStands,
  offlineHomesInRegion,
  _resetForTests,
  OFFLINE_HOMES_VENDOR,
} from '../../src/systems/offlineHomes.js';
import {
  modSaveRecords,
  restoreModSaveRecords,
} from '../../src/systems/modSaveData.js';
import {
  createHouses,
  isHouseOwned,
  isDfuHouseOwned,
  allocateHouseToPlayer,
  BANK_REGION_COUNT,
} from '../../src/systems/banking.js';
import { playerEntity } from '../../src/characters/playerEntity.js';
import { HOME_CAP, homeSaleRefund } from '../../src/net/homeLaw.js';
import { noteDecorGrants, decorMayRest } from '../../src/systems/decor/decorGrants.js';

test.beforeEach(() => {
  _resetForTests();
  setPref('offlineHousing', true);
  if (playerEntity) {
    playerEntity.houses = createHouses(BANK_REGION_COUNT);
  }
});

test.afterEach(() => {
  _resetForTests();
  setPref('offlineHousing', true);
});

test('OFFLINE-HOUSING: preferences toggle controls isOfflineHousingActive()', () => {
  assert.equal(getPref('offlineHousing'), true, 'default should be true');
  assert.equal(isOfflineHousingActive(), true);

  setPref('offlineHousing', false);
  assert.equal(getPref('offlineHousing'), false);
  assert.equal(isOfflineHousingActive(), false);

  setPref('offlineHousing', true);
  assert.equal(isOfflineHousingActive(), true);
});

test('OFFLINE-HOUSING: claiming, querying, and releasing offline homes', async () => {
  const homes = createOfflineHomes({ player: () => ({ name: 'Hero' }) });

  const claimRes = await homes.claim({
    mapId: 100,
    buildingKey: 42,
    region: 5,
    price: 10000,
  });
  assert.equal(claimRes.ok, true);
  assert.equal(claimRes.data.refund, 8500);

  // Verification of homeAt
  const h = homes.homeAt(100, 42);
  assert.ok(h);
  assert.equal(h.mine, true);
  assert.equal(h.own, true);
  assert.equal(h.entry, 'only-me');
  assert.equal(h.refund, 8500);

  // homeStands
  assert.equal(homes.homeStands(100, 42), true);
  assert.equal(isOfflineHouseOwned(100, 42), true);

  // Duplicate claim refused
  const dupRes = await homes.claim({
    mapId: 100,
    buildingKey: 42,
    region: 5,
    price: 10000,
  });
  assert.equal(dupRes.ok, false);
  assert.equal(dupRes.error, 'home-taken');

  // Change entry permissions
  const entryRes = await homes.setEntry(100, 42, 'public');
  assert.equal(entryRes.ok, true);
  assert.equal(homes.homeAt(100, 42).entry, 'public');

  // Release home
  const releaseRes = await homes.release(100, 42);
  assert.equal(releaseRes.ok, true);
  assert.equal(releaseRes.refund, 8500);
  assert.equal(homes.homeAt(100, 42), null);
  assert.equal(isOfflineHouseOwned(100, 42), false);
});

test('OFFLINE-HOUSING: regional cap of 3 homes per region is enforced', async () => {
  const homes = createOfflineHomes();
  const region = 12;

  assert.equal((await homes.claim({ mapId: 201, buildingKey: 1, region, price: 5000 })).ok, true);
  assert.equal((await homes.claim({ mapId: 202, buildingKey: 2, region, price: 6000 })).ok, true);
  assert.equal((await homes.claim({ mapId: 203, buildingKey: 3, region, price: 7000 })).ok, true);

  assert.equal(offlineHomesInRegion(region).length, 3);

  // 4th claim in the same region is rejected with 'home-cap'
  const fourthRes = await homes.claim({ mapId: 204, buildingKey: 4, region, price: 8000 });
  assert.equal(fourthRes.ok, false);
  assert.equal(fourthRes.error, 'home-cap');

  // Claim in a different region still succeeds
  const otherRegionRes = await homes.claim({ mapId: 301, buildingKey: 1, region: 13, price: 5000 });
  assert.equal(otherRegionRes.ok, true);
});

test('OFFLINE-HOUSING: save/load round-trip preserves homes, decor, and isolation from DFU', async () => {
  const homes = createOfflineHomes();
  const decor = createOfflineDecor();

  // Buy a house offline
  await homes.claim({ mapId: 555, buildingKey: 77, region: 2, price: 12000 });
  await decor.place({
    mapId: 555,
    buildingKey: 77,
    piece: { id: 'bench1', model: 41100, pos: [1, 0, 2], rot: [0, 0, 0] },
  });
  await decor.hidden({ mapId: 555, buildingKey: 77, keys: ['chair_base_1'] });

  // Allocate a DFU house in playerEntity.houses
  if (!playerEntity.houses) playerEntity.houses = createHouses(BANK_REGION_COUNT);
  allocateHouseToPlayer(playerEntity.houses, 2, { buildingKey: 999, mapId: 555 });

  // Snapshot mod data
  const snapshot = modSaveRecords();
  assert.ok(snapshot[OFFLINE_HOMES_VENDOR]);
  assert.equal(snapshot[OFFLINE_HOMES_VENDOR].homes.length, 1);
  assert.equal(snapshot[OFFLINE_HOMES_VENDOR].homes[0].buildingKey, 77);
  assert.equal(snapshot[OFFLINE_HOMES_VENDOR].homes[0].decor.length, 1);
  assert.equal(snapshot[OFFLINE_HOMES_VENDOR].homes[0].hidden.length, 1);

  // Reset state to simulate reloading a fresh game
  _resetForTests();
  assert.equal(isOfflineHouseOwned(555, 77), false);

  // Restore mod data
  restoreModSaveRecords(snapshot);

  assert.equal(isOfflineHouseOwned(555, 77), true);
  const decorList = await decor.list(555, 77);
  assert.equal(decorList.data.pieces.length, 1);
  assert.equal(decorList.data.pieces[0].id, 'bench1');
  assert.deepEqual(decorList.data.hidden, ['chair_base_1']);

  // DFU house 999 is still in playerEntity.houses
  assert.equal(isDfuHouseOwned(playerEntity.houses, 2, 999, 555), true);
  // And DFU house is NOT in offline homes
  assert.equal(isOfflineHouseOwned(555, 999), false);
});

test('OFFLINE-HOUSING: mutual toggle disables the other system while preserving data', async () => {
  const homes = createOfflineHomes();
  if (!playerEntity.houses) playerEntity.houses = createHouses(BANK_REGION_COUNT);

  // Player owns DFO home 101 and DFU home 202
  await homes.claim({ mapId: 1000, buildingKey: 101, region: 1, price: 8000 });
  allocateHouseToPlayer(playerEntity.houses, 1, { buildingKey: 202, mapId: 1000 });

  // 1. With offlineHousing: true
  setPref('offlineHousing', true);
  // DFO home is active
  assert.ok(homes.homeAt(1000, 101));
  assert.equal(isOfflineHouseOwned(1000, 101), true);
  // DFU home is dormant for playerEntity
  assert.equal(isHouseOwned(playerEntity.houses, 1, 202, 1000), false);
  // Pure fixture array without playerEntity context still evaluates
  assert.equal(isDfuHouseOwned(playerEntity.houses, 1, 202, 1000), true);

  // 2. Switch to offlineHousing: false (DFU mode)
  setPref('offlineHousing', false);
  // DFO home door interactions are disabled
  assert.equal(homes.homeAt(1000, 101), null);
  assert.equal(isOfflineHouseOwned(1000, 101), false);
  // DFU home is re-activated
  assert.equal(isHouseOwned(playerEntity.houses, 1, 202, 1000), true);

  // 3. Switch back to offlineHousing: true
  setPref('offlineHousing', true);
  // DFO home is accessible again
  assert.ok(homes.homeAt(1000, 101));
  assert.equal(isOfflineHouseOwned(1000, 101), true);
  // DFU home is dormant again
  assert.equal(isHouseOwned(playerEntity.houses, 1, 202, 1000), false);
});

test('OFFLINE-HOUSING: settlement quest system excludes houses from BOTH systems', async () => {
  const homes = createOfflineHomes({ player: () => playerEntity });
  if (!playerEntity.houses) playerEntity.houses = createHouses(BANK_REGION_COUNT);

  // Player owns DFO home 301 and DFU home 302
  await homes.claim({ mapId: 888, buildingKey: 301, region: 0, price: 10000 });
  allocateHouseToPlayer(playerEntity.houses, 0, { buildingKey: 302, mapId: 888 });

  // In quest place selection:
  // Both systems must be excluded regardless of mode!
  // Case A: offlineHousing: true
  setPref('offlineHousing', true);
  assert.equal(homes.homeStands(888, 301), true, 'DFO home must stand');
  assert.equal(homes.homeStands(888, 302), true, 'DFU home must also stand via homes adapter');
  assert.equal(offlineHomeStands(888, 301), true);

  // Case B: offlineHousing: false
  setPref('offlineHousing', false);
  // DFU isHouseOwned returns true for 302
  assert.equal(isHouseOwned(playerEntity.houses, 0, 302, 888), true);
  // offlineHomeStands still returns true for 301
  assert.equal(offlineHomeStands(888, 301), true);
  assert.equal(homes.homeStands(888, 301), true);
});

test('OFFLINE-HOUSING: decor door handles grants, use, batching, and revisions without crashing', async () => {
  const homes = createOfflineHomes();
  const decor = createOfflineDecor();

  await homes.claim({ mapId: 777, buildingKey: 10, region: 1, price: 15000 });

  // Place a storage chest piece and a regular chair
  await decor.place({
    mapId: 777,
    buildingKey: 10,
    piece: { id: 'chest1', storage: true, model: 41800, pos: [0, 0, 0] },
  });
  await decor.place({
    mapId: 777,
    buildingKey: 10,
    piece: { id: 'chair1', model: 41101, pos: [2, 0, 2] },
  });

  // Verify list() returns rev and pieces
  const listRes = await decor.list(777, 10);
  assert.equal(listRes.ok, true);
  assert.equal(listRes.data.pieces.length, 2);
  assert.ok(Number.isSafeInteger(listRes.data.rev));

  // Verify rev()
  const revRes = await decor.rev(777, 10);
  assert.equal(revRes.ok, true);
  assert.equal(revRes.data.rev, listRes.data.rev);

  // Verify use({ op: 'grants' }) returns populated data.storage and data.rest
  const grantsRes = await decor.use({ mapId: 777, buildingKey: 10, op: 'grants' });
  assert.equal(grantsRes.ok, true);
  assert.ok(grantsRes.data);
  assert.deepEqual(grantsRes.data.storage, ['chest1']);
  assert.equal(grantsRes.data.rest, true);

  // Verify noteDecorGrants integration does not throw
  noteDecorGrants(decor, 777, 10, 'hero', null, playerEntity);
  // Allow promise to resolve
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(decorMayRest(777, 10), true);

  // Verify batch() updates pieces and increments revision
  const batchRes = await decor.batch({
    mapId: 777,
    buildingKey: 10,
    put: [{ id: 'table1', model: 41105, pos: [1, 0, 1] }],
    drop: ['chair1'],
  });
  assert.equal(batchRes.ok, true);
  assert.ok(batchRes.data.rev > listRes.data.rev);

  const updatedList = await decor.list(777, 10);
  assert.equal(updatedList.data.pieces.length, 2);
  assert.ok(updatedList.data.pieces.some((p) => p.id === 'table1'));
  assert.ok(!updatedList.data.pieces.some((p) => p.id === 'chair1'));
});
