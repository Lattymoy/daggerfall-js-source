// ARENA1 (2026-10-02): WHAT THE ARENA DISPLACES (Mac: "Move them to a new house"). A deed whose house stood in
// Daggerfall's cell (4,3) moves once to a house of its kind in the city, its scene with it, the bank's letter said
// (systems/arenaMove.js); every other record keyed there - a rented room, a repair ticket, a quest site, an inside
// save - names no building now (layoutPins.recordStands) and each system's own law for that takes it. And the
// gate's Herald speaks through the one box.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { arenaHouseFor, moveArenaRecords } from '../src/systems/arenaMove.js';
import { arenaRecordDisplaced, arenaGatePersonOf, ARENA_GATE_PEOPLE, ARENA_LOCATION_KEY } from '../src/world/arenaCity.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';
import { createSceneCache, cacheScene, addPermanentScene, interiorSceneName, layoutSceneName } from '../src/systems/sceneCache.js';
import { configureLayoutPins, recordStands, _resetLayoutPins } from '../src/systems/layoutPins.js';
import { findRentedRoom } from '../src/systems/tavern.js';
import { isBeingRepairedAt } from '../src/systems/repairService.js';
import { createHouses } from '../src/systems/banking.js';
import { makeBuildingKey } from '../src/systems/talkTopics.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { buildingSummaries } from '../src/world/buildingSummaries.js';
import { HAS_ARENA2, bootDoor } from './arena1Data.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const MAP = 1291010263;
const OLD = makeBuildingKey(4, 3, 5);
const keyOfMapId = (m) => (m === MAP ? ARENA_LOCATION_KEY : null);
const house = (x, y, r, t = BUILDING_TYPES.House2) => ({ buildingKey: makeBuildingKey(x, y, r), buildingType: t, name: `House ${x}${y}${r}` });
const CITY = [house(1, 1, 0), house(1, 1, 1), house(2, 5, 3), house(6, 2, 0, BUILDING_TYPES.House1), house(5, 6, 2), house(4, 3, 9)];

test('ARENA1 move: a record keyed to the arena\'s cell of Daggerfall is displaced; the same key in another town, or another cell, is not', () => {
  assert.equal(arenaRecordDisplaced({ mapId: MAP, buildingKey: OLD }, keyOfMapId), true);
  assert.equal(arenaRecordDisplaced({ mapID: MAP, buildingKey: OLD }, keyOfMapId), true, 'a questor\'s spelling');
  assert.equal(arenaRecordDisplaced({ mapId: 77, buildingKey: OLD }, keyOfMapId), false);
  assert.equal(arenaRecordDisplaced({ mapId: MAP, buildingKey: makeBuildingKey(4, 4, 5) }, keyOfMapId), false);
  assert.equal(arenaRecordDisplaced(null, keyOfMapId), false);
});

test('ARENA1 move: the new house - of the old one\'s type, never in the cell, never held, never a quest\'s; the market\'s generator, one answer', () => {
  const a = arenaHouseFor({ mapId: MAP, oldKey: OLD, oldType: BUILDING_TYPES.House2 }, CITY);
  assert.equal(a.buildingType, BUILDING_TYPES.House2);
  assert.notEqual(a.buildingKey, makeBuildingKey(4, 3, 9));
  assert.deepEqual(arenaHouseFor({ mapId: MAP, oldKey: OLD, oldType: BUILDING_TYPES.House2 }, [...CITY].reverse()), a, 'whatever order the city was read in');
  const held = new Set(CITY.filter((s) => s.buildingType === BUILDING_TYPES.House2 && s.buildingKey !== makeBuildingKey(5, 6, 2)).map((s) => s.buildingKey));
  assert.equal(arenaHouseFor({ mapId: MAP, oldKey: OLD, oldType: BUILDING_TYPES.House2 }, CITY, { held }).buildingKey, makeBuildingKey(5, 6, 2));
  assert.equal(arenaHouseFor({ mapId: MAP, oldKey: OLD, oldType: BUILDING_TYPES.House2 }, CITY, { held, isActiveQuestBuilding: (s) => s.buildingKey === makeBuildingKey(5, 6, 2) }).buildingType, BUILDING_TYPES.House1, 'none of its kind free: any house');
  assert.equal(arenaHouseFor({ mapId: MAP, oldKey: OLD, oldType: BUILDING_TYPES.House2 }, [house(4, 3, 1)]), null);
  // a different old key, a (likely) different house - the seed is the move's own
  const picks = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((r) => arenaHouseFor({ mapId: MAP, oldKey: makeBuildingKey(4, 3, r), oldType: BUILDING_TYPES.House2 }, CITY).buildingKey));
  assert.ok(picks.size > 1);
});

test('ARENA1 move (ARENA2 the fix): the deed moves once, its old scene EMPTIED into the new house - the chests\' things in its first chest, the furniture marks dropped, its other layouts\' visits with it - and the letter is said', () => {
  const houses = createHouses(62);
  Object.assign(houses[17], { mapId: MAP, buildingKey: OLD, location: 'Daggerfall' });
  const scenes = createSceneCache();
  const from = interiorSceneName(MAP, OLD);
  cacheScene(scenes, from, { decor: [{ id: 1, pos: [1, 2, 3], rot: [0, 0, 0, 1] }], hiddenBase: ['bed'], lootContainers: [{ key: 'container:0', items: [{ name: 'gold' }] }], droppedPiles: [{ pos: [0, 0, 0], items: [] }] });
  cacheScene(scenes, layoutSceneName(from, 'beautiful-cities@0.5.0'), { decor: [] });
  addPermanentScene(scenes, from);
  addPermanentScene(scenes, layoutSceneName(from, 'beautiful-cities@0.5.0'));
  const said = [];
  const r = moveArenaRecords({ houses, summaries: CITY, oldTypeOf: (k) => (k === OLD ? BUILDING_TYPES.House2 : null), scenes, displaced: (rec) => arenaRecordDisplaced(rec, keyOfMapId) }, {
    undiscoverCell: () => said.push('forget'), discover: (to) => said.push(`discover ${to.buildingKey}`), addNote: () => said.push('note'), notice: () => said.push('letter'),
  });
  assert.ok(r);
  assert.equal(r.from, OLD);
  assert.equal(houses[17].buildingKey, r.to);
  assert.equal(houses[17].mapId, MAP);
  const to = interiorSceneName(MAP, r.to);
  // ARENA2: the old house's places do not fit the new one - nothing of them is carried, only what they held
  assert.deepEqual(scenes.scenes.get(to).hiddenBase, [], 'the furniture taken out of the OLD house names nothing in the new');
  assert.equal(scenes.scenes.get(to).decor.length, 0, 'a placed piece never stands where the old room had floor');
  assert.deepEqual(scenes.scenes.get(to).lootContainers, [{ key: 'container:0', items: [{ name: 'gold' }], crate: true, stockedDate: 0 }]);
  assert.ok(!scenes.scenes.has(layoutSceneName(to, 'beautiful-cities@0.5.0')), 'the other layout\'s visit poured into the same chest');
  assert.ok(!scenes.scenes.has(from));
  assert.deepEqual([...scenes.permanent], [to]);
  assert.equal(r.crate, 1);
  assert.deepEqual(said, ['forget', `discover ${r.to}`, 'note', 'letter']);
  // once: the deed names a standing house now
  assert.equal(moveArenaRecords({ houses, summaries: CITY, scenes, displaced: (rec) => arenaRecordDisplaced(rec, keyOfMapId) }), null);
  // nothing moves for a deed elsewhere
  const h2 = createHouses(62);
  Object.assign(h2[17], { mapId: MAP, buildingKey: makeBuildingKey(1, 1, 0) });
  assert.equal(moveArenaRecords({ houses: h2, summaries: CITY, displaced: (rec) => arenaRecordDisplaced(rec, keyOfMapId) }), null);
});

test('ARENA1 move: every other record keyed there names no building - a room at any inn of the city, a ticket at any smith', () => {
  _resetLayoutPins();
  configureLayoutPins({ locationKeyOfMapId: keyOfMapId, recordDisplaced: (rec) => arenaRecordDisplaced(rec, keyOfMapId) });
  try {
    const room = { mapId: MAP, buildingKey: OLD };
    assert.equal(recordStands(room), false);
    assert.equal(recordStands({ mapId: MAP, buildingKey: makeBuildingKey(4, 4, 0) }), true);
    assert.equal(findRentedRoom([room], MAP, makeBuildingKey(4, 4, 7)), room, 'honoured at another inn of the city');
    assert.equal(findRentedRoom([room], MAP, makeBuildingKey(4, 4, 7), false), null, 'never a stranger\'s bed by the key');
    const item = { repairData: { mapId: MAP, buildingKey: OLD } };
    assert.equal(isBeingRepairedAt(item, makeBuildingKey(4, 4, 2), MAP), true);
  } finally { _resetLayoutPins(); }
  // a quest site there is chosen again (Place.reseatMovedSite asks recordStands); an inside save stands outside
  assert.match(read('src/systems/quest/place.js'), /if \(sd\?\.siteType !== SITE_TYPES\.Building \|\| !\(sd\.buildingKey > 0\) \|\| recordStands\(sd\)\) return false;/);
  assert.match(read('src/systems/layoutPins.js'), /if \(_displaced\(rec\)\) return false;\n\s*return layoutsMatch\(rec\.layout, layoutStampOfMapId\(rec\.mapId\)\);/);
  assert.match(read('src/scenes/worldModes.js'), /if \(d\.buildingKey && arenaRecordDisplaced\(\{ mapId: questSceneCtx\?\.\(\)\?\.mapId \?\? 0, buildingKey: d\.buildingKey \}\)\) \{/);
  const w = read('src/scenes/world.js');
  assert.match(w, /if \(!homeLayoutsOnline\) moveArenaDeed\(\);/, 'offline, before the pins are read');
  assert.match(w, /notice: \(\) => \{ const show = \(\) => \{ try \{ townTalk\.showOverlay\(new ActionTextBox\(\[\.\.\.ARENA_TEXT\.deedMoved\]\)\); \}/);
});

test('ARENA1 gate: the Herald is known by his record, and his click opens the notice; the others talk as the city\'s people do', () => {
  const h = ARENA_GATE_PEOPLE[0];
  assert.equal(arenaGatePersonOf({ position: h.position, textureArchive: h.archive, textureRecord: h.record }).role, 'herald');
  assert.equal(arenaGatePersonOf({ position: h.position, textureArchive: h.archive, textureRecord: h.record + 1 }), null);
  assert.equal(arenaGatePersonOf(null), null);
  assert.ok(Object.isFrozen(ARENA_TEXT) && Object.isFrozen(ARENA_TEXT.heraldNotice));
  assert.equal(ARENA_TEXT.heraldNotice[0], 'The Arena of Daggerfall');
  assert.match(ARENA_TEXT.heraldNotice.join(' '), /Bouts begin soon/);
  // ARENA2: his choice now (the host's - scenes/world.js arenaHerald); a host with no arena driver keeps the notice
  assert.match(read('src/scenes/worldModes.js'), /if \(!info && arenaGatePersonOf\(pn\)\?\.role === 'herald'\) \{ if \(!host\.arenaHerald\?\.\(\)\) townTalk\?\.showOverlay\?\.\(new ActionTextBox\(\[\.\.\.ARENA_TEXT\.heraldNotice\]\)\); return; \}/);
});

test('ARENA1 move (ARENA2): a deed to a GEMSAL03 house moves to a house of its kind standing in Daggerfall, in both layouts', { skip: !HAS_ARENA2 && 'ARENA2_PATH not set' }, async () => {
  for (const packs of [false, true]) {
    const { maps, blocks } = await bootDoor({ packs, arena: true });
    const city = maps.getLocation(17, 1231);
    const took = blocks.getBlockByName(city.exterior.exteriorData.arenaTook);
    const rec = took.rmbBlock.fldHeader.buildingDataList.findIndex((d, i) => i < took.rmbBlock.subRecords.length && d.buildingType === BUILDING_TYPES.House2);
    assert.ok(rec >= 0, 'GEMSAL03 stands a House2');
    const e = city.exterior.exteriorData;
    const list = [];
    for (let y = 0; y < e.height; y++) for (let x = 0; x < e.width; x++) { const b = blocks.getBlockByName(maps.getRmbBlockName(city, x, y)); if (b) list.push({ dfBlock: b, x, y }); }
    const summaries = buildingSummaries(city.exterior.buildings, list, { locationIndex: city.locationIndex });
    const houses = createHouses(62);
    const mapId = city.mapTableData.mapId;
    Object.assign(houses[17], { mapId, buildingKey: makeBuildingKey(4, 3, rec) });
    const r = moveArenaRecords({
      houses, summaries, oldTypeOf: (k) => took.rmbBlock.fldHeader.buildingDataList[k & 0xff].buildingType,
      displaced: (x) => arenaRecordDisplaced(x, (m) => (m === mapId ? ARENA_LOCATION_KEY : null)),
    });
    assert.ok(r, packs ? 'Beautiful Cities' : 'classic');
    const to = summaries.find((s) => s.buildingKey === r.to);
    assert.equal(to.buildingType, BUILDING_TYPES.House2);
    assert.ok(!((r.to >> 16) === 4 && ((r.to >> 8) & 0xff) === 3));
  }
});
