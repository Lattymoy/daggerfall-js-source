// AUDIT WW (2026-10-24, bible/03-World/World-Wide.md "The audit"): the world-wide arc's review - its findings, each
// pinned where it was fixed. F2, F3 and F6 (the lanes that stand, the spent word, a lane's pixel) are pinned in
// ww2_gates.test.js beside the lanes' own law; F9 (a band's hideout in its own province) in ww1_world.test.js beside
// the bands'.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnedHallMapId, isHallMapId, wdunHallOfRoom, WORLD_PIXEL_BOUND } from '../../../src/net/wire.js';
import { discoverLocation, hasDiscoveredLocationId, restoreDiscovery, snapshotDiscovery } from '../../../src/systems/discovery.js';
import { hasDock, nearDock, isCapital, isPlayerInTownForShips } from '../../../src/systems/immersiveTravel.js';
import { CAPITAL_MAP_IDS, LARGE_DOCK_MAP_IDS, DOCK_PIXEL_IDS } from '../../../src/systems/immersiveTravelTables.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { createEventToasts } from '../../../src/systems/eventBoard.js';
import { gateEventId } from '../../../src/systems/eventTimers.js';
import { gateNumber } from '../../../src/net/gate/gateLaw.js';
import { createLivingLanes } from '../../../src/scenes/livingWorld/livingLanes.js';
import { createZoneHalls } from '../../../src/scenes/zoneHallsHost.js';
import { groundWoods } from '../../../src/world/tamriel/tamrielGround.js';
import { setTamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { worldPixelKey } from '../../../src/world/worldWide/worldGrid.js';
import { PORT_ID_WORLD } from '../../../src/world/worldWide/worldPorts.js';
import { codeOnly } from '../../codeOnly.mjs';
import { hostText } from '../../hostText.mjs';   // AUDIT TESA II (lane K's K6): the negatives read the host WHOLE (HOST-SPLIT 2, the second read)

setTamrielTrace(null); setTamrielFit(null);   // the authored shape and fit: no player's picture in the suite
const src = (p) => codeOnly(readFileSync(new URL('../../../' + p, import.meta.url), 'utf8'));
/** The world host whole - its file and every module moved out of it - for a pin that finds NOTHING there (AUDIT HOST-SPLIT 2). */
const wholeWorld = () => codeOnly(hostText('src/scenes/world.js'));

/** A zone hall's map id whose low 20 bits are `low` - a Bay pixel id's, as 13 of a Cyrodiil day's 840 halls' are. */
function hallOver(low) {
  const x = (low & 0x3fff) - WORLD_PIXEL_BOUND, y = (low >>> 14) - WORLD_PIXEL_BOUND + 64 * 120;
  const id = spawnedHallMapId(x, y);
  assert.equal(id & 0xfffff, low, 'its low bits the Bay pixel\'s');
  return id;
}

test('AUDIT WW F1: A ZONE HALL\'S MAP ID IS NO BAY PIXEL\'S - known by its lane above every MAPS.BSA row\'s; never filed nor found in the discovered places (a hall entered named a Bay town found); never a dock, a large dock or a capital; never a carriage town (mutants: the lane test; the discovery guard; the docks\' guard; the carriage guard)', () => {
  for (const [x, y] of [[1400, -300], [-8192, -8192], [8191, 8191], [0, 0]]) {
    const id = spawnedHallMapId(x, y);
    assert.equal(isHallMapId(id), true, `${x},${y}`);
  }
  assert.equal(wdunHallOfRoom(`dungeon:m${spawnedHallMapId(1400, -300)}`), '1400,-300', 'the room reads its hall back through the one test');
  for (const id of [0, 1, (0x728 << 20) | 499999, 0x7283288c, (0xe << 28) >>> 0, -1, 2 ** 32, 0.5, NaN]) assert.equal(isHallMapId(id), false, String(id));
  // the discovered places: a hall over a Bay place's pixel id
  restoreDiscovery(null);
  const bayId = (7 << 20) | (240 * 1000 + 310), hall = hallOver(bayId & 0xfffff);
  assert.equal(discoverLocation(hall, { regionName: 'Cyrodiil', locationName: 'Elite hall' }), false, 'a hall is never filed');
  assert.equal(hasDiscoveredLocationId(bayId), false, 'the Bay place it masks to stays unfound');
  assert.deepEqual(snapshotDiscovery().locations, {});
  assert.equal(discoverLocation(bayId), true);
  assert.equal(hasDiscoveredLocationId(hall), false, 'and a found Bay place finds no hall');
  restoreDiscovery(null);
  // Immersive Travel's tables
  const dock = DOCK_PIXEL_IDS[0], cap = CAPITAL_MAP_IDS[0] & 0xfffff, large = LARGE_DOCK_MAP_IDS[0] & 0xfffff;
  assert.equal(hasDock(dock), true);
  assert.equal(hasDock(hallOver(dock)), false, 'no dock');
  assert.equal(nearDock(hallOver(dock)), false);
  assert.equal(nearDock(hallOver(dock + 1)), false, 'nor beside one');
  assert.equal(isCapital(CAPITAL_MAP_IDS[0]), true);
  assert.equal(isCapital(hallOver(cap)), false, 'no capital');
  const gps = (mapId) => ({ locationType: LOCATION_TYPES.DungeonKeep, mapId, regionIndex: 70 });
  assert.equal(isPlayerInTownForShips(gps(LARGE_DOCK_MAP_IDS[0])), true);
  assert.equal(isPlayerInTownForShips(gps(hallOver(large))), false, 'a hall is no large dock');
  // the carriage towns (scenes/world.js carriageTown - the Overworld's wheel)
  assert.match(src('src/scenes/world.js'), /if \(!immersiveTravelLoaded\(\) \|\| !Number\.isFinite\(mapId\) \|\| isHallMapId\(mapId\)\) return false;/);
});

test('AUDIT WW F4: THE GIANTS\' LOW GROUND IS THE CONTINENT\'S - the halls\' module answers the height the halls\' ground reads, a Bay-only client\'s the same as one that walks the continent; the host hands it to the giants (mutants: the host\'s own woods)', () => {
  const MAP_W = 1000, MAP_H = 500;
  const bay = { getHeightMapValue: (x, y) => 3 + ((Math.max(0, Math.min(MAP_W - 1, x)) + Math.max(0, Math.min(MAP_H - 1, y))) % 5) };
  const deps = (woods) => ({ maps: {}, woods, places: { at: () => null }, locationIndex: new Map(), isMainStory: () => false, dayNow: () => 1, indexMoved: () => {} });
  const bayOnly = createZoneHalls(deps(bay)), continent = createZoneHalls(deps(groundWoods(bay))), land = groundWoods(bay);
  let past = 0;
  for (const [x, y] of [[1400, -300], [1700, 200], [500, 250], [-40, 100], [2100, 600]]) {
    assert.equal(bayOnly.heightAt(x, y), land.getHeightMapValue(x, y), `${x},${y}`);
    assert.equal(continent.heightAt(x, y), bayOnly.heightAt(x, y));
    if (bayOnly.heightAt(x, y) !== bay.getHeightMapValue(x, y)) past++;
  }
  assert.ok(past > 0, 'past the Bay the clamp\'s answer is not the continent\'s');
  assert.equal(bayOnly.heightAt, bayOnly.heightAt, 'one function: the giants\' cache\'s key');
  assert.match(src('src/scenes/world.js'), /const _giantHeight = zoneHalls\.heightAt;/);
});

test('AUDIT WW F5: EVERY GATE\'S LINES ON ITS OWN CARD - the Bay\'s gate and a lane\'s are two cards, each line and announcement on its own gate\'s (its number\'s id, the Timers row\'s); the host says the omen\'s, the fall\'s and the rite\'s lines with the gate\'s number (mutants: the Bay\'s lines id-less; the fall\'s; the rite\'s)', () => {
  const bayN = gateNumber(900, 0), laneN = gateNumber(900, 3);
  assert.equal(gateEventId(bayN), 'gate:900');
  assert.equal(gateEventId(laneN), `gate:${laneN}`);
  assert.equal(gateEventId(null), null);
  const t = createEventToasts({ shown: 4 });
  t.note('gate', 'The sky over Daggerfall burns', 0, gateEventId(bayN));
  t.note('gate', 'The sky over Solitude burns', 0, gateEventId(laneN));
  t.announce({ id: gateEventId(laneN), kind: 'gate', phase: 'omen' });
  t.note('gate', 'The breach by Daggerfall opens', 1, gateEventId(bayN));
  const cards = t.cards();
  assert.equal(cards.length, 2, 'two gates, two cards');
  const bay = cards.find((c) => c.id === 'gate:900'), lane = cards.find((c) => c.id === `gate:${laneN}`);
  assert.deepEqual(bay?.notes, ['The sky over Daggerfall burns', 'The breach by Daggerfall opens']);
  assert.deepEqual(lane?.notes, ['The sky over Solitude burns']);
  assert.equal(lane?.phase, 'omen');
  const w = src('src/scenes/world.js');
  assert.equal(w.match(/say: \(text, n\) => eventNotice\('gate', text, gateLineId\(n\)\),/g)?.length, 2, 'the omen\'s lines and the rite\'s');
  assert.match(w, /top: f\.top \}\), gateLineId\(day\)\); \},/);
  assert.doesNotMatch(wholeWorld(), /eventNotice\('gate', [^,()]+\)/, 'no gate line id-less');   // PIN MOVED (AUDIT TESA II K6): the host whole
  assert.match(src('src/scenes/riteHost.js'), /say\(RITE_TEXT\.broken\(\{ near: C\.near, by: b\.by, n: b\.n \}\), C\.day\);/);
});

test('AUDIT WW F7: THE LIVING WORLD\'S LANES ARE MADE AGAIN WHEN THE WORLD MOVES - a port town\'s lanes and a port\'s berths when the world\'s lanes are a new list (a province\'s ports registered) or the places\' generation moves; the host\'s hideouts by both generations (mutants: the lanes\' list kept; the generation kept; the hideouts\' generation the roads\' alone)', () => {
  const port = (id, px, py) => ({ id, px, py });
  const bayA = { mapId: (3 << 20) | 100200, px: 200, py: 100, port: true }, bayB = { mapId: (3 << 20) | 110300, px: 300, py: 110, port: true };
  const far = { mapId: 7001, px: 1600, py: -400, port: true };
  const idA = bayA.mapId & 0xfffff, idB = bayB.mapId & 0xfffff, idFar = PORT_ID_WORLD + worldPixelKey(far.px, far.py);
  const towns = new Map([[idA, bayA], [idB, bayB], [idFar, far]]);
  let list = [{ key: 'ab', a: port(idA, 200, 100), b: port(idB, 300, 110) }], gen = 1, sailors = 0;
  const lanes = createLivingLanes({ lanes: () => list, way: () => ({ len: 7, pts: [{ x: 0, z: 0 }, { x: 7, z: 0 }] }), townOfPort: (id) => towns.get(id) ?? null, sailorsOf: () => { sailors++; return []; }, generation: () => gen });
  assert.deepEqual(lanes.from(bayA).map((l) => l.to.mapId), [bayB.mapId]);
  const book = lanes.berths(idFar);
  assert.equal(lanes.berths(idFar), book, 'kept while nothing moved');
  list = [...list, { key: 'af', a: port(idA, 200, 100), b: port(idFar, far.px, far.py) }];   // a province's port: a new list
  assert.deepEqual(lanes.from(bayA).map((l) => l.to.mapId), [bayB.mapId, far.mapId], 'the lane past the Bay joins');
  assert.notEqual(lanes.berths(idFar), book, 'the berths made again');
  const kept = lanes.berths(idFar);
  towns.set(idFar, { ...far, name: 'Solitude' });
  gen = 2;
  assert.equal(lanes.from(bayA)[1].to.name, 'Solitude', 'the places moved: the far port\'s town as it stands now');
  assert.notEqual(lanes.berths(idFar), kept);
  assert.equal(sailors, 3, 'the sailors asked again each time');
  const w = src('src/scenes/world.js');
  assert.match(w, /const livingLanes = createLivingLanes\(\{ lanes: \(\) => laneNet\(\), way: livingLaneWay, townOfPort: livingTownOfPort, sailorsOf: livingSailorsOf, generation: livingIndex\.generation \}\);/);
  assert.match(w, /generation: \(\) => `\$\{livingWays\.generation\}\|\$\{livingIndex\.generation\(\)\}`,/);
  assert.doesNotMatch(wholeWorld(), /_livingLanesFrom|_livingBerths|_livingLaneCounts/, 'no book of the host\'s own');   // PIN MOVED (AUDIT TESA II K6): the host whole
});

test('AUDIT WW F10-F13: the nearest port reads the lanes\' book of the Bay\'s ports; a lane\'s site word arms its own lane\'s herald alone; the waters read once for a crew and a ship\'s names; the compass\'s words and the ring\'s law one copy each (mutants: none - the wiring)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /return worldPorts\.nearestNamed\(here, worldLanes\.bayPorts\(\) \?\? \[\]\);/);
  assert.doesNotMatch(wholeWorld(), /const COMPASS_WAYS = /, 'the compass\'s words world/worldWide/worldPorts.js\'s');   // PIN MOVED (AUDIT TESA II K6): the host whole
  const relay = src('server/src/index.js');
  assert.match(relay, /if \(lane && this\._heraldOf\(\)\) await this\._heraldLaneArm\(lane, now\);/);
  assert.match(relay, /for \(const lane of GATE_LANES_OPEN\) await this\._heraldLaneArm\(lane, now\);/);
  const naval = src('src/scenes/naval/navalHost.js');
  assert.match(naval, /\.\.\.watersFolk\(where\(\)\), record: saved\?\.mates \?\? null \}\);/);
  assert.match(naval, /const names = shipNames\(cls, seed, watersFolk\(where\(\)\)\);/);
  assert.match(src('src/systems/wild/wildDungeons.js'), /const ringOf = \(mask, i\) => ringOfDepth\(mask, mask\.depth\?\.\[i\] \?\? 0\);/);
});
