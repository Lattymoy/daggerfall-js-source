// AUDIT 26 - the discovery/building cluster (F099, F061/F062, F209).
//
// F099: UndiscoverBuilding dropped ALL THREE of DFU's refusals
//       (PlayerGPS.cs:1006-1016) - a quest siting a tavern erased it
//       from the discovered store, and TG/DB hideouts lost their
//       protection.
// F061/F062: "the player's pixel has a location" was answering
//       IsPlayerInLocationRect at the crime clear and the encounter
//       roll - the rect is the town footprint widened by ONE city
//       block (PlayerGPS.cs:687-699), up to a seventh of the pixel.
// F209: StockHouseContainer was unported - every private house
//       container was permanently empty (DaggerfallLoot.cs:291-375).
//
// (F060 of the same cluster was found already fixed - AUDIT 26 wave 1
// deleted the exterior host's hardcoded inTownOutside with its twin;
// struck STALE in the ledger, not re-fixed.)

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  discoverBuilding, undiscoverBuilding, hasDiscoveredBuilding, restoreDiscovery,
} from '../src/systems/discovery.js';
import { clearCrimeOnLocationExit } from '../src/systems/court.js';
import { isInLocationRect } from '../src/world/streamingWorld.js';
import {
  stockHouseContainer,
  PRIVATE_PROPERTY_MODELS_0_TO_1, PRIVATE_PROPERTY_MODELS_2_TO_3,
  PRIVATE_PROPERTY_MODELS_4_TO_10, PRIVATE_PROPERTY_MODELS_11_TO_14,
  PRIVATE_PROPERTY_MODELS_15_AND_UP,
} from '../src/systems/shopStock.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

// ── F099 ──────────────────────────────────────────────────────────

const LOC = '17:Testtown';
const put = (buildingKey, over = {}) => discoverBuilding(LOC, {
  buildingKey, name: 'The Rusty Ogre', factionId: 0, buildingType: 17, ...over,
});

test('F099: onlyIfResidence refuses a non-residence', () => {
  restoreDiscovery(null);
  put(1, { buildingType: 0 });   // Alchemist - not House1..House4
  undiscoverBuilding(LOC, 1, true, 'The Rusty Ogre');
  assert.equal(hasDiscoveredBuilding(LOC, 1), true, 'a shop survives the residence-only sweep');
  put(2, { buildingType: 20 });   // House4 - the last residence type
  undiscoverBuilding(LOC, 2, true, 'The Rusty Ogre');
  assert.equal(hasDiscoveredBuilding(LOC, 2), false, 'a residence goes');
});

test('F099: TG/DB hideouts are shielded UNCONDITIONALLY', () => {
  restoreDiscovery(null);
  // FactionFile.cs:91/:135 - The_Thieves_Guild 42, The_Dark_Brotherhood 108.
  put(1, { factionId: 42 });
  put(2, { factionId: 108 });
  // ...even on the bank's house-sale call, which passes NO optionals
  // (DaggerfallBankManager.cs:460).
  undiscoverBuilding(LOC, 1);
  undiscoverBuilding(LOC, 2, true, 'The Rusty Ogre');
  assert.equal(hasDiscoveredBuilding(LOC, 1), true);
  assert.equal(hasDiscoveredBuilding(LOC, 2), true);
});

test('F099: a name mismatch refuses; a match (or no name) deletes', () => {
  restoreDiscovery(null);
  put(1);
  undiscoverBuilding(LOC, 1, true, 'Some Other House');
  assert.equal(hasDiscoveredBuilding(LOC, 1), true, 'the quest names a DIFFERENT building');
  undiscoverBuilding(LOC, 1, true, 'The Rusty Ogre');
  assert.equal(hasDiscoveredBuilding(LOC, 1), false, 'the named residence goes');
  put(2);
  undiscoverBuilding(LOC, 2);
  assert.equal(hasDiscoveredBuilding(LOC, 2), false, 'no optionals = the bank path deletes');
});

test('F099: the talk bridge forwards TalkManager\'s exact arguments', () => {
  // TalkManager.cs:2958: UndiscoverBuilding(key, true, buildingName).
  // The bridge used to DROP the name and the flag, making every
  // refusal unreachable from the quest seam.
  const w = src('scenes/world.js');
  assert.ok(w.includes('undiscoverBuilding: (buildingKey, buildingName) =>'), 'the deps bridge takes both');
  assert.ok(w.includes('buildingKey, true, buildingName ?? null)'), 'and passes onlyIfResidence=true + the name');
});

// ── F061 / F062 ───────────────────────────────────────────────────

test('F061: the rect is the town footprint + one city block, not the pixel', () => {
  // PlayerGPS.cs:671, :687-699 - extraRect = 4096 = WORLD_MAP_RMB_DIM.
  const rect = { minX: 10000, maxX: 14096, minZ: 20000, maxZ: 24096 };
  assert.equal(isInLocationRect(12000, 22000, rect), true, 'inside the town');
  assert.equal(isInLocationRect(10000 - 4096, 22000, rect), true, 'the widened edge is IN');
  assert.equal(isInLocationRect(10000 - 4097, 22000, rect), false, 'one unit past the slack is OUT');
  assert.equal(isInLocationRect(12000, 24096 + 4096, rect), true);
  assert.equal(isInLocationRect(12000, 24096 + 4097, rect), false);
  assert.equal(isInLocationRect(12000, 22000, null), false, 'no location = never in rect');
});

test('F061: the encounter roll reads the rect thunk, not the pixel index', () => {
  const w = src('scenes/world.js');
  assert.ok(w.includes('inLocationRect: _musicInLocationRect(),'), 'IntermittentEnemySpawn branches on the RECT');
  assert.equal(w.includes('inLocationRect: locationIndex.has(key)'), false, 'the pixel answer is gone');
});

test('F062: the crime clears on the rect EDGE, once, like OnExitLocationRect', () => {
  const w = src('scenes/world.js');
  // the transition pair (PlayerGPS.cs:702-716), played after syncTopics
  assert.ok(w.includes('if (_wasInLocationRect && !_inRect) clearCrimeOnLocationExit(playerEntity);'),
    'edge-triggered exit fires the handler');
  assert.ok(w.includes('_wasInLocationRect = _inRect;'), 'the tracked bool advances');
  // the old pixel-crossing clear is GONE from syncTopics
  assert.equal(w.includes('clearCrimeOnLocationExit(playerEntity, _topicsKey, key)'), false,
    'a pixel border is not a rect exit');
  // ResetState (:398-401): teleport drops the flag WITHOUT firing exit
  assert.ok(w.includes('_wasInLocationRect = false;   // F062: ResetState'),
    'fast travel does not synthesize an exit-clear');
});

test('F062: the handler is DFU\'s verbatim clear, edge detection removed', () => {
  // PlayerEntity.cs:2449-2453 - the handler only CLEARS; PlayerGPS
  // owns the edge. The old (entity, prevKey, nextKey) shape gated on
  // pixel keys inside the callee.
  const e = { crimeCommitted: 5 };
  clearCrimeOnLocationExit(e);
  assert.equal(e.crimeCommitted, 0);
  assert.equal(clearCrimeOnLocationExit.length, 1, 'no key parameters left');
});

// ── F209 ──────────────────────────────────────────────────────────

test('F209: the five tables are DaggerfallLootDataTables.cs verbatim (spot rows + shape)', () => {
  for (const t of [PRIVATE_PROPERTY_MODELS_0_TO_1, PRIVATE_PROPERTY_MODELS_2_TO_3,
    PRIVATE_PROPERTY_MODELS_4_TO_10, PRIVATE_PROPERTY_MODELS_11_TO_14,
    PRIVATE_PROPERTY_MODELS_15_AND_UP]) {
    assert.equal(t.length, 24, 'one row per buildingType 0..Town23');
  }
  // :64 row 0 - a bedroom chest holds clothing
  assert.deepEqual(PRIVATE_PROPERTY_MODELS_0_TO_1[0], [0x06, 0x0C]);
  // :99 row 4 - the Bank row is the 12-group hoard
  assert.deepEqual(PRIVATE_PROPERTY_MODELS_2_TO_3[4],
    [0x09, 0x0A, 0x0B, 0x0D, 0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13, 0x14, 0x19]);
  // :121 row 0 - Alchemist's crates carry ingredients
  assert.deepEqual(PRIVATE_PROPERTY_MODELS_4_TO_10[0], [0x07, 0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13, 0x15]);
  // :156 row 8 - note 0x15 BEFORE 0x0E, the C#'s own order
  assert.deepEqual(PRIVATE_PROPERTY_MODELS_11_TO_14[8], [0x03, 0x09, 0x15, 0x0E]);
  // :179 row 4 - the Bank's big furniture, 11 groups
  assert.deepEqual(PRIVATE_PROPERTY_MODELS_15_AND_UP[4],
    [0x02, 0x03, 0x04, 0x0D, 0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13, 0x15]);
  // :166 row 16 starts 0x04 MagicItems - the tavern's rare cupboard
  assert.deepEqual(PRIVATE_PROPERTY_MODELS_11_TO_14[16], [0x04, 0x07, 0x09, 0x0D, 0x19]);
});

test('F209: the model-tier ladder picks the C# table boundaries', () => {
  // buildingType 3 (Bank) has a DISTINCT row in every tier:
  // 0to1 [6,12] / 2to3 [7,9,11] / 4to10 [7,25] / 11to14 [9,13,14] / 15AndUp [13,25].
  // rolls()=0 picks the first group of each row; contRand=99 stops
  // after the mandatory first item.
  const first = (record) => stockHouseContainer(
    { buildingType: 3, record }, { level: 1, gender: 'male' },
    { rolls: () => 0, contRand: () => 99 })[0];
  assert.equal(first(0).group, 'MensClothing');
  assert.equal(first(1).group, 'MensClothing', '1 still reads the 0to1 table');
  assert.equal(first(2).group, 'Books', '2 crosses into 2to3');
  assert.equal(first(3).group, 'Books');
  assert.equal(first(4).group, 'Books', '4 crosses into 4to10 (row starts 0x07)');
  assert.equal(first(10).group, 'Books');
  assert.equal(first(11).group, 'UselessItems2', '11 crosses into 11to14 (row starts 0x09)');
  assert.equal(first(14).group, 'UselessItems2');
  assert.equal(first(15).group, 'Paintings', '15 and up (row starts 0x0D)');
  assert.equal(first(99).group, 'Paintings');
  // buildingType 3's 2to3 and 4to10 rows BOTH start 0x07, so the
  // 4-boundary needs a row pair that differs: buildingType 0 reads
  // [0x06,...] in 2to3 and [0x07,...] in 4to10.
  const first0 = (record) => stockHouseContainer(
    { buildingType: 0, record }, { level: 1, gender: 'male' },
    { rolls: () => 0, contRand: () => 99 })[0];
  assert.equal(first0(3).group, 'MensClothing', '3 is still the 2to3 tier');
  assert.equal(first0(4).group, 'Books', '4 crosses at exactly >= 4');
});

test('F209: past Town23 stocks NOTHING - and Town23 itself stocks', () => {
  // DaggerfallLoot.cs:303 `if (buildingType <= Town23)`.
  assert.deepEqual(stockHouseContainer({ buildingType: 24, record: 0 }, {}, { rolls: () => 0, contRand: () => 99 }), []);
  assert.ok(stockHouseContainer({ buildingType: 23, record: 0 }, { gender: 'male' }, { rolls: () => 0, contRand: () => 99 }).length >= 1);
});

test('F209: the halving loop - item lands AFTER the continue test, so never zero items', () => {
  // continueChance >>= 1 first: 50, 25, 12, ... The roll sequence
  // [0, 0, 60] survives 50 and 25 and dies on 12 - three items, the
  // third pushed on the killing pass (DaggerfallLoot.cs:369-372).
  const seq = (vals) => { let i = 0; return () => vals[i++] ?? 99; };
  const items = stockHouseContainer(
    { buildingType: 7, record: 4 },   // 4to10 row 7 = [0x09] only - deterministic group
    { level: 1 }, { rolls: () => 0, contRand: seq([0, 0, 60]) });
  assert.equal(items.length, 3);
  for (const it of items) {
    assert.equal(it.group, 'UselessItems2');
    assert.ok(it.name, 'named off the template, the shelf add() shape');
    assert.ok(it.templateIndex != null);
  }
  // the mandatory single item: an instant kill still pushes one
  const one = stockHouseContainer({ buildingType: 7, record: 4 }, {}, { rolls: () => 0, contRand: () => 99 });
  assert.equal(one.length, 1);
  // the comparison is STRICT `>` (:370): a roll equal to the chance
  // continues - seq [50] survives chance 50 and dies on 25 via the 99
  // fallback, two items.
  const eq = stockHouseContainer({ buildingType: 7, record: 4 }, {}, { rolls: () => 0, contRand: seq([50]) });
  assert.equal(eq.length, 2);
});

test('F209: the group arms dispatch like the C# chain', () => {
  const opts = { rolls: () => 0, contRand: () => 99 };
  // clothing arm - 0to1 row 0 [0x06, 0x0C]; the arm calls
  // CreateRandomClothing on the PLAYER's gender, not the drawn id
  const her = stockHouseContainer({ buildingType: 0, record: 0 }, { gender: 'female' }, opts)[0];
  assert.equal(her.group, 'WomensClothing');
  assert.ok(her.dye != null, 'CreateRandomClothing mints dye + variant');
  // weapons arm - 11to14 row 18 = [0x03, 0x09]
  const w = stockHouseContainer({ buildingType: 18, record: 11 }, { level: 5 }, opts)[0];
  assert.equal(w.group, 'Weapons');
  // books arm - 2to3 row 3 = [0x07, ...]: template 277 with a book id
  const b = stockHouseContainer({ buildingType: 3, record: 2 }, {}, opts)[0];
  assert.equal(b.templateIndex, 277);
  assert.ok(b.message != null, 'CreateRandomBook stamps the book id');
});

test('F209: the latch and the owned-house guard are wired', () => {
  // interiorContext births containers `items: null` - the stock-once
  // latch the scene cache preserves (the shelf idiom).
  const ic = src('scenes/interiorContext.js');
  assert.ok(ic.includes('containers.push({ cpu, matrix, items: null, record: containerTextureRecord(p.modelIdNum) });'));
  // worldModes stocks on first access - and an OWNED house never
  // stocks (PlayerActivate.cs:905-913: your own furniture is empty).
  const wm = src('scenes/worldModes.js');
  assert.ok(wm.includes('c.items ??= stockHouseContainer({ buildingType: b?.buildingType, record: c.record }, playerEntity);'));
  const arm = wm.slice(wm.indexOf("if (key.startsWith('container:')) {"));
  assert.ok(arm.slice(0, 1200).includes('isHouseOwned(playerEntity.houses ?? []'), 'the owner guard sits in the arm');
  assert.ok(arm.slice(0, 1200).includes('c.items ??= [];'), 'owned = empty, stockedDate-serialized in DFU');
  // the continue roll defaults to the CLASSIC stream - DaggerfallLoot's
  // one DFRandom draw (:370) - while everything else is engine RNG.
  const ss = src('systems/shopStock.js');
  assert.ok(ss.includes('contRand = rand }'), 'the default continue roll is dfRandom.rand');
});
