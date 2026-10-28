// HOUSES-3 (2026-10-27, the owner: "Up the house ownership limit to 3 houses per region"; bible/06-Systems/Online-Arc.md
// HOUSES-3): A REGION HOLDS THREE HOUSES - the bank's registry keeps the region's slot as its first deed and the others
// beside it (systems/banking.js, test/systems/houses.test.js), and every reader past the bank reads all three: the realm's
// gold, the town map's marks, the deeds the service holds, the arena's move, and the hosts' wiring.
// tools/mutants/houses3.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHouses, allocateHouseToPlayer } from '../../src/systems/banking.js';
import { deedsOf } from '../../src/net/realm/realmGoldLaw.js';
import { townHomeRows } from '../../src/ui/town/townMapMarks.js';
import { realmDeedsOf } from '../../src/systems/online/onlineHomes.js';
import { moveArenaRecords } from '../../src/systems/arena/arenaMove.js';
import { arenaRecordDisplaced, ARENA_LOCATION_KEY } from '../../src/world/arena/arenaCity.js';
import { makeBuildingKey } from '../../src/systems/talk/talkTopics.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** Three deeds in Wayrest's region (17), the third come through customs. */
function wayrest() {
  const houses = createHouses(62);
  for (const key of [10, 20, 30]) allocateHouseToPlayer(houses, 17, { buildingKey: key, mapId: 1017, location: 'Wayrest' });
  houses[17].more[1].crossed = true;
  return houses;
}

test('HOUSES-3 the readers past the bank read a region\'s three: the realm\'s gold counts each deed but a crossed one (realmGoldLaw.js deedsOf); the deeds the service holds are each one the realm gave (onlineHomes.js realmDeedsOf); the town map marks each house of the town (townMapMarks.js townHomeRows) (mutants: the first deed alone, at each)', () => {
  const houses = wayrest();
  assert.deepEqual(deedsOf({ houses, sceneCache: { scenes: [] } }).map((d) => d.slot.buildingKey), [10, 20], 'every deed of the region, the crossed one none');
  assert.deepEqual(realmDeedsOf(houses), [{ region: 17, mapId: 1017, buildingKey: 10 }, { region: 17, mapId: 1017, buildingKey: 20 }]);
  const rows = townHomeRows({ buildings: [{ buildingKey: 10 }, { buildingKey: 20 }, { buildingKey: 30 }, { buildingKey: 40 }], mapId: 1017, regionIndex: 17, houses });
  assert.deepEqual(rows.map((r) => [r.buildingKey, r.own]), [[10, true], [20, true], [30, true]], 'each of the town\'s three, a stranger\'s none');
  assert.deepEqual(townHomeRows({ buildings: [{ buildingKey: 10 }], mapId: 2017, regionIndex: 17, houses }), [], 'another town of the region: none');
});

const MAP = 1291010263;
const keyOfMapId = (m) => (m === MAP ? ARENA_LOCATION_KEY : null);
const house = (x, y, r, t = BUILDING_TYPES.House2) => ({ buildingKey: makeBuildingKey(x, y, r), buildingType: t, name: `House ${x}${y}${r}` });

test('HOUSES-3 the arena\'s move (arenaMove.js moveArenaRecords): every deed of the region the arena displaced moves, and never onto a house another of the region\'s deeds names (mutants: the first displaced alone; the own deeds\' houses free to the pick)', () => {
  const deeds = (h) => [h[17], ...(h[17].more ?? [])].map((d) => d.buildingKey);
  // two displaced, a city with room for both: both move, to two houses
  const a = createHouses(62);
  for (const k of [makeBuildingKey(4, 3, 5), makeBuildingKey(4, 3, 6)]) allocateHouseToPlayer(a, 17, { buildingKey: k, mapId: MAP, location: 'Daggerfall' });
  const r = moveArenaRecords({ houses: a, summaries: [house(1, 1, 0), house(2, 5, 3), house(5, 6, 2)], oldTypeOf: () => BUILDING_TYPES.House2, displaced: (rec) => arenaRecordDisplaced(rec, keyOfMapId) });
  assert.equal(r.from, makeBuildingKey(4, 3, 5), 'the answer is the first move\'s');
  assert.equal(deeds(a).filter((k) => ((k >> 16) === 4 && ((k >> 8) & 0xff) === 3)).length, 0, 'none left in the arena\'s cell');
  assert.equal(new Set(deeds(a)).size, 2, 'two houses');
  // one free house, and one the player owns already: the first moves to the free one; the second has nowhere and waits
  const b = createHouses(62);
  for (const k of [makeBuildingKey(4, 3, 5), makeBuildingKey(4, 3, 6), makeBuildingKey(1, 1, 0)]) allocateHouseToPlayer(b, 17, { buildingKey: k, mapId: MAP, location: 'Daggerfall' });
  moveArenaRecords({ houses: b, summaries: [house(1, 1, 0), house(5, 6, 2)], oldTypeOf: () => BUILDING_TYPES.House2, displaced: (rec) => arenaRecordDisplaced(rec, keyOfMapId) });
  assert.deepEqual(deeds(b), [makeBuildingKey(5, 6, 2), makeBuildingKey(4, 3, 6), makeBuildingKey(1, 1, 0)], 'never two deeds to one building');
});

test('HOUSES-3 the hosts, by source: the bank refuses at the region\'s three and offers the town\'s houses, each with its own price and customs\' words, selling the deed offered; the order gives one while the region holds fewer than three; the save copies each deed and the restore reads them all; the layout pins and the line\'s houses every deed (mutants: each wire)', () => {
  const M = rd('src/scenes/worldModes.js'), W = rd('src/scenes/world.js'), S = rd('src/systems/save/save.js');
  assert.match(M, /housesFull: \(\) => regionHousesFull\(playerEntity\.houses \?\? \[\], bankRegion\(\)\),/);
  assert.match(M, /housesFull: regionHousesFull\(playerEntity\.houses, region\),/);
  assert.match(M, /houseOffers: \(\) => townHouses\(\)\.map\(\(\{ deed, summary \}\) => \(\{\n\s*price: deedSellPrice\(summary\),\n\s*crossed: crossedDeedLines\('house', \{ houses: playerEntity\.houses, regionIndex: bankRegion\(\), player: playerEntity, deed \}\),/);
  assert.match(M, /const offered = townHouses\(\)\[i\] \?\? null;/);
  assert.match(M, /deed: offered\?\.deed \?\? null \}/);
  assert.match(S, /snap\.houses = \(entity\.houses \?\? \[\]\)\.map\(copyHouseSlot\);/);
  assert.match(S, /padRegionTable\(snap\.houses\.map\(copyHouseSlot\), blankHouse\)/);
  assert.match(S, /restoreDiscovery\(snap\.discovery, \{ houses: allDeeds\(entity\.houses\) \}\);/);
  assert.match(W, /houses: allDeeds\(playerEntity\.houses\), rooms: playerEntity\.rentedRooms,/);
  assert.match(W, /: allDeeds\(playerEntity\.houses\)\.filter\(deedStands\)\),/);
});
