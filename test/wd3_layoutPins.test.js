// WD3 (2026-10-01, Mac: "ensure this doesn't conflict or regress anything (For example housing customization)") - THE
// HOUSING PROMISE: a town keeps the layout a save's things were made in (src/systems/layoutPins.js). Beautiful Villages
// and Beautiful Cities REPLACE Daggerfall's towns, and a building is known by its key - where it stands - so the house
// bought, the room rented, the quest's building, the item at the smith, the anchor set indoors and the save made
// inside are each stamped with their town's layout when they are made, and a load keeps each town its records hold in
// that layout.
//
// Held here: the stamp's spelling and reading (versions carried, ignored when two layouts are compared, classic as no
// field); which mods CHANGE a town (its location file, a block its grid names; the safe answer for a town the host
// cannot say); the layout a town is served in now (the latch, the pin out, the pin in); the pins a save asks for (the
// strongest record decides; a mod that changes nothing there pins nothing; a town already in its layout needs none);
// the pins installed (the towns whose answer changed); the records read off a save; and every record stamped where it
// is made - the deed, the room, the repair ticket, the anchor, the quest's building site, the cached interior, the
// discoveries (stamped, saved, restored, and forgotten where the layout moved).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  LAYOUT_MODS, CLASSIC_LAYOUT, HOME_LAYOUTS_WAIT_MS, HOME_LAYOUTS_RETRIES, RECORD_WEIGHT, configureLayoutPins, layoutModTouches, layoutStampOf,
  stampVendors, pinAt, layoutStampAt, layoutStampOfMapId, layoutStampOfPixel, layoutsMatch, layoutStampOfTown, stampLayout,
  layoutLocationKeyOfMapId, pinsFrom, setLayoutPins, vendorsPinnedIn, layoutPins, layoutRecordsOf, _resetLayoutPins,
} from '../src/systems/layoutPins.js';
import { registerWorldDataAsset, _resetWorldDataReplacement, installWorldDataReplacement } from '../src/formats/worldDataReplacement.js';
import { makeLocationKey } from '../src/systems/worldDataVariants.js';
import { HOME_LAYOUT_MODS, homeLayoutOk } from '../src/net/homeLaw.js';
import { allocateHouseToPlayer } from '../src/systems/banking.js';
import { rentRoom } from '../src/systems/tavern.js';
import { leaveForRepair } from '../src/systems/repairService.js';
import { makeAnchor, WORLD_CONTEXT } from '../src/systems/teleportAnchor.js';
import { discoverBuilding, discoveredBuildings, snapshotDiscovery, restoreDiscovery, pruneDiscoveryLayouts } from '../src/systems/discovery.js';
import { createSceneCache, cacheScene, restoreCachedScene, snapshotSceneCache, restoreSceneCache, addPermanentScene, removePermanentScene, layoutSceneName } from '../src/systems/sceneCache.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const BV = 'beautiful-villages', BC = 'beautiful-cities';
const VILLAGE = makeLocationKey(17, 958), CITY = makeLocationKey(17, 4), TAVERN = makeLocationKey(23, 210), DUNGEON = makeLocationKey(17, 3);
const MAP_IDS = new Map([[1001, VILLAGE], [1002, CITY], [1003, TAVERN], [1004, DUNGEON]]);
const PIXELS = new Map([['100,200', VILLAGE], ['101,200', CITY], ['102,200', TAVERN]]);
const TOWNS = new Map([['17:Aldleigh', VILLAGE], ['17:Daggerfall', CITY], ['23:The Rusty Mug', TAVERN]]);
const GRIDS = new Map([[VILLAGE, ['FARMAA01.RMB']], [CITY, ['FIGHBM00.RMB', 'TEMPAAH0.RMB']], [TAVERN, ['TVRNAL01.RMB', 'CUSTAA06.RMB']], [DUNGEON, ['GRVEAS01.RMB']]]);

/** The door holding what each mod carries - Villages the village's location and the tavern's block, Cities the city's
 *  location and the shared FIGHBM00 - and the hosts' resolvers; `on` the mods loaded for the game. */
function world({ on = [BV, BC], versions = { [BV]: '1.4.2', [BC]: '0.5.0' } } = {}) {
  _resetLayoutPins(); _resetWorldDataReplacement(); installWorldDataReplacement();
  registerWorldDataAsset('location-17-958.json', {}, null, { priority: 10, vendor: BV });
  registerWorldDataAsset('TVRNAL01.RMB.json', {}, null, { priority: 10, vendor: BV });
  registerWorldDataAsset('FIGHBM00.RMB.json', {}, null, { priority: 10, vendor: BV });
  registerWorldDataAsset('location-17-4.json', {}, null, { priority: 20, vendor: BC });
  registerWorldDataAsset('FIGHBM00.RMB.json', {}, null, { priority: 20, vendor: BC });
  configureLayoutPins({
    vendorOn: (v) => on.includes(v), vendorVersion: (v) => versions[v] ?? '',
    locationKeyOfMapId: (id) => MAP_IDS.get(id) ?? null, locationKeyOfPixel: (x, y) => PIXELS.get(`${x},${y}`) ?? null,
    gridOf: (k) => GRIDS.get(k) ?? null, locationKeyOfTown: (r, name) => TOWNS.get(`${r}:${name}`) ?? null,
  });
}
const pin = (out = [], inn = [], stamp = CLASSIC_LAYOUT, why = 'house') => ({ out: new Set(out), in: new Set(inn), stamp, why });

test('WD3 the stamp: the layout mods serving a town, `vendor@version` sorted and joined by +, the classic town no field at all; read back as its mods, two stamps one layout whatever versions they name; the service\'s law takes every stamp the pins write', () => {
  world();
  assert.deepEqual(LAYOUT_MODS, [BV, BC]);
  assert.deepEqual(HOME_LAYOUT_MODS, LAYOUT_MODS, 'the service\'s list is the pins\' (net/homeLaw.js)');
  assert.equal(CLASSIC_LAYOUT, 'classic');
  assert.equal(layoutStampOf([BV]), 'beautiful-villages@1.4.2');
  assert.equal(layoutStampOf([BV, BC]), 'beautiful-cities@0.5.0+beautiful-villages@1.4.2', 'sorted - one spelling a layout');
  assert.equal(layoutStampOf([BC, BV, 'detailed-ships']), layoutStampOf([BV, BC]), 'a mod that moves no building is no part of a layout');
  assert.equal(layoutStampOf([]), CLASSIC_LAYOUT);
  configureLayoutPins({ vendorVersion: () => '' });
  assert.equal(layoutStampOf([BV]), 'beautiful-villages@?', 'a version the loader could not say');
  for (const s of [layoutStampOf([BV]), layoutStampOf([BV, BC]), 'beautiful-villages@?']) assert.equal(homeLayoutOk(s), true, s);
  assert.equal(homeLayoutOk(null), true, 'Daggerfall\'s own town');
  for (const bad of ['classic', '', 'beautiful-villages', 'detailed-ships@1.0.0', 'beautiful-villages@1+beautiful-villages@2', 'a'.repeat(97), 42]) assert.equal(homeLayoutOk(bad), false, JSON.stringify(bad));
  assert.deepEqual([...stampVendors('beautiful-cities@0.5.0+beautiful-villages@1.4.2')].sort(), [BC, BV]);
  for (const none of [undefined, null, '', CLASSIC_LAYOUT, 'detailed-ships@1.0.0']) assert.equal(stampVendors(none).size, 0, String(none));
  assert.equal(layoutsMatch('beautiful-villages@1.4.2', 'beautiful-villages@1.5.0'), true, 'a mod updated is the same layout\'s mod');
  assert.equal(layoutsMatch(undefined, CLASSIC_LAYOUT), true, 'a record from before WD3 is classic');
  assert.equal(layoutsMatch('beautiful-villages@1.4.2', CLASSIC_LAYOUT), false);
  assert.equal(layoutsMatch('beautiful-villages@1.4.2', 'beautiful-cities@0.5.0+beautiful-villages@1.4.2'), false);
  const rec = { a: 1 };
  assert.equal(stampLayout(rec, 'beautiful-villages@1.4.2'), rec);
  assert.equal(rec.layout, 'beautiful-villages@1.4.2');
  stampLayout(rec, CLASSIC_LAYOUT);
  assert.equal('layout' in rec, false, 'the classic town writes nothing - a game without the mods saves what it saved before');
  assert.equal(stampLayout(null, 'x'), null);
});

test('WD3 which mods CHANGE a town: the one carrying its location file, or a block its grid names - a mod that changes nothing there is no part of its stamp; a town the host cannot say is changed by every mod (the safe answer)', () => {
  world();
  assert.equal(layoutModTouches(BV, VILLAGE), true, 'its location file');
  assert.equal(layoutModTouches(BC, VILLAGE), false, 'Cities carries neither the village nor a block of it');
  assert.equal(layoutModTouches(BC, CITY), true);
  assert.equal(layoutModTouches(BV, CITY), true, 'Villages carries FIGHBM00, which the city\'s grid names');
  assert.equal(layoutModTouches(BV, TAVERN), true, 'a roadside tavern changes through its block alone');
  assert.equal(layoutModTouches(BC, TAVERN), false);
  assert.equal(layoutModTouches(BV, DUNGEON), false, 'a graveyard neither touches');
  assert.equal(layoutModTouches(BV, makeLocationKey(40, 9)), true, 'a town whose grid the host cannot say');
  assert.equal(layoutModTouches(BV, null), true);
  assert.equal(layoutModTouches('detailed-ships', VILLAGE), false, 'a mod that is not on the door carries nothing');
});

test('WD3 the layout a town is served in now: the mods loaded for the game that change it - less a pin out, plus a pin in; a map id, a pixel and a discovered town each resolve to it, and a town the host cannot place to the mods as loaded', () => {
  world();
  assert.equal(layoutStampAt(VILLAGE), 'beautiful-villages@1.4.2');
  assert.equal(layoutStampAt(CITY), 'beautiful-cities@0.5.0+beautiful-villages@1.4.2', 'both change the city (its file, and FIGHBM00)');
  assert.equal(layoutStampAt(DUNGEON), CLASSIC_LAYOUT);
  assert.equal(layoutStampOfMapId(1001), layoutStampAt(VILLAGE));
  assert.equal(layoutStampOfPixel(102, 200), 'beautiful-villages@1.4.2');
  assert.equal(layoutStampOfTown('17:Daggerfall'), layoutStampAt(CITY));
  assert.equal(layoutStampOfTown('17:Nowhere'), null, 'a town the host cannot place: neither stamped nor pruned');
  assert.equal(layoutStampOfTown('garbage'), null);
  assert.equal(layoutStampOfMapId(0), layoutStampOf([BV, BC]), 'no town: as the mods loaded serve every town');
  assert.equal(layoutStampOfPixel(NaN, 1), layoutStampOf([BV, BC]));
  assert.equal(layoutLocationKeyOfMapId(1002), CITY); assert.equal(layoutLocationKeyOfMapId(0), null); assert.equal(layoutLocationKeyOfMapId(9), null);
  setLayoutPins(new Map([[CITY, pin([BC])], [VILLAGE, pin([BV])]]));
  assert.equal(layoutStampAt(CITY), 'beautiful-villages@1.4.2', 'a pin out');
  assert.equal(layoutStampAt(VILLAGE), CLASSIC_LAYOUT);
  assert.deepEqual(pinAt(CITY).out, new Set([BC])); assert.equal(pinAt(TAVERN), null);
  world({ on: [] });
  assert.equal(layoutStampAt(VILLAGE), CLASSIC_LAYOUT, 'no mod loaded');
  setLayoutPins(new Map([[VILLAGE, pin([], [BV])]]));
  assert.equal(layoutStampAt(VILLAGE), 'beautiful-villages@1.4.2', 'a pin in - the house bought in the village keeps its village');
  assert.equal(layoutStampAt(TAVERN), CLASSIC_LAYOUT);
});

test('WD3 the pins a save asks for: the strongest record of a town decides (a house, a room, a quest site, an inside save or an anchor, a repair ticket); a town already in its layout needs none; a mod pinned out only where it changes the town, in only where the stamp names it', () => {
  world();
  assert.deepEqual(RECORD_WEIGHT, { house: 5, room: 4, quest: 3, questor: 3, inside: 2, anchor: 2, repair: 1 });
  const v = 'beautiful-villages@1.4.2', both = 'beautiful-cities@0.5.0+beautiful-villages@1.4.2';
  // everything made in the towns as the mods serve them now: nothing to pin
  assert.equal(pinsFrom([{ locationKey: VILLAGE, stamp: v, kind: 'house' }, { locationKey: CITY, stamp: both, kind: 'room' }, { locationKey: DUNGEON, stamp: undefined, kind: 'quest' }]).size, 0);
  // a house bought in the classic village before the mod: the mod pinned out
  let pins = pinsFrom([{ locationKey: VILLAGE, stamp: undefined, kind: 'house' }]);
  assert.deepEqual([...pins.keys()], [VILLAGE]);
  assert.deepEqual(pins.get(VILLAGE), pin([BV], [], CLASSIC_LAYOUT, 'house'));
  // the strongest record wins: a house (classic) over a repair ticket (made since, in the village)
  pins = pinsFrom([{ locationKey: VILLAGE, stamp: v, kind: 'repair' }, { locationKey: VILLAGE, stamp: undefined, kind: 'house' }, { locationKey: VILLAGE, stamp: v, kind: 'room' }]);
  assert.deepEqual(pins.get(VILLAGE).out, new Set([BV]));
  assert.equal(pins.get(VILLAGE).why, 'house');
  pins = pinsFrom([{ locationKey: CITY, stamp: v, kind: 'anchor' }, { locationKey: CITY, stamp: both, kind: 'quest' }]);
  assert.equal(pins.size, 0, 'the quest site outranks the anchor, and it stands in the city as served');
  // a city room from Villages-only days: Cities pinned out, Villages kept
  pins = pinsFrom([{ locationKey: CITY, stamp: v, kind: 'room' }]);
  assert.deepEqual(pins.get(CITY), pin([BC], [], v, 'room'));
  // a tavern record made classic: only Villages changes it, so only Villages is pinned out
  assert.deepEqual(pinsFrom([{ locationKey: TAVERN, stamp: CLASSIC_LAYOUT, kind: 'inside' }]).get(TAVERN).out, new Set([BV]));
  // records of no town, or of a town the host cannot place, ask nothing
  assert.equal(pinsFrom([{ locationKey: null, stamp: undefined, kind: 'house' }, { locationKey: -1, kind: 'house' }, null]).size, 0);
  assert.equal(pinsFrom(undefined).size, 0);
  // the mods switched off since: a house bought in the village pins Villages IN, and only Villages
  world({ on: [] });
  pins = pinsFrom([{ locationKey: VILLAGE, stamp: v, kind: 'house' }, { locationKey: CITY, stamp: both, kind: 'house' }, { locationKey: DUNGEON, stamp: undefined, kind: 'house' }]);
  assert.deepEqual(pins.get(VILLAGE), pin([], [BV], v, 'house'));
  assert.deepEqual(pins.get(CITY).in, new Set([BV, BC]));
  assert.equal(pins.has(DUNGEON), false);
});

test('WD3 the pins installed: the towns whose answer changed - pinned, released, pinned otherwise - and no others; the packs a pin lets in; the door\'s oracle is the module\'s', () => {
  world();
  let changed = setLayoutPins(new Map([[VILLAGE, pin([BV])], [CITY, pin([BC])]]));
  assert.deepEqual([...changed].sort(), [VILLAGE, CITY].sort());
  changed = setLayoutPins(new Map([[VILLAGE, pin([BV])], [CITY, pin([BC])]]));
  assert.equal(changed.size, 0, 'the same pins again: nothing to read again');
  changed = setLayoutPins(new Map([[VILLAGE, pin([BV])], [CITY, pin([BC, BV])], [TAVERN, pin([], [BV])]]));
  assert.deepEqual([...changed].sort(), [CITY, TAVERN].sort());
  assert.deepEqual([...vendorsPinnedIn()], [BV]);
  changed = setLayoutPins(new Map());
  assert.deepEqual([...changed].sort(), [VILLAGE, CITY, TAVERN].sort(), 'released');
  assert.equal(layoutPins().size, 0);
  assert.equal(setLayoutPins(null).size, 0);
  assert.match(src('src/systems/layoutPins.js'), /export const pinAt = \(locationKey\) => _pins\.get\(locationKey\) \?\? curatedPin\(locationKey\);\nsetLayoutPinOracle\(pinAt\);/, 'the door asks this module');
  assert.equal(HOME_LAYOUTS_WAIT_MS, 6000); assert.equal(HOME_LAYOUTS_RETRIES, 4);
});

test('WD3 a save\'s building-keyed records, as the pins read them: deeds, rooms, quest sites, questors met indoors and repair tickets by their town\'s map id (a key and a town each, or nothing), an anchor only inside a building, the save itself made inside one', () => {
  world();
  const houses = [{ mapId: 1001, buildingKey: 0x10203, layout: 'beautiful-villages@1.4.2' }, { mapId: 0, buildingKey: 0 }, { mapId: 1002, buildingKey: 0 }, null];
  const rooms = [{ mapId: 1003, buildingKey: 0x305 }];
  const sites = [{ mapId: 1002, buildingKey: 0x10101, layout: 'beautiful-cities@0.5.0' }, { mapId: 1002, buildingKey: 0 }];
  const repairs = [{ buildingKey: 9, mapId: 1001 }, { buildingKey: 9 }];
  const questors = [{ mapID: 1003, buildingKey: 0x40, nameSeed: 5, hash: 1, layout: 'beautiful-villages@1.4.2' }, { mapID: 1003, buildingKey: 0 }];   // AUDIT WD3 S3
  const recs = layoutRecordsOf({ houses, rooms, sites, questors, repairs, anchor: { insideBuilding: true, pixel: { x: 101, y: 200 }, layout: 'x' }, inside: { pixel: { x: 102, y: 200 } } });
  assert.deepEqual(recs, [
    { locationKey: VILLAGE, stamp: 'beautiful-villages@1.4.2', kind: 'house' },
    { locationKey: TAVERN, stamp: undefined, kind: 'room' },
    { locationKey: CITY, stamp: 'beautiful-cities@0.5.0', kind: 'quest' },
    { locationKey: TAVERN, stamp: 'beautiful-villages@1.4.2', kind: 'questor' },
    { locationKey: VILLAGE, stamp: undefined, kind: 'repair' },
    { locationKey: CITY, stamp: 'x', kind: 'anchor' },
    { locationKey: TAVERN, stamp: undefined, kind: 'inside' },
  ]);
  assert.deepEqual(layoutRecordsOf({ anchor: { insideBuilding: false, pixel: { x: 1, y: 1 } } }), [], 'an anchor outdoors names no building');
  assert.deepEqual(layoutRecordsOf(), []);
  assert.deepEqual(layoutRecordsOf({ houses: [{ mapId: 5, buildingKey: 1 }] }, { locationKeyOfMapId: () => 77 }), [{ locationKey: 77, stamp: undefined, kind: 'house' }], 'the resolvers may be handed in');
});

test('WD3 every record is stamped where it is made: the deed, the room, the repair ticket (its town beside its key), the anchor set indoors - each with its town\'s layout now, and nothing at all in a classic town', () => {
  world();
  const houses = [{}, {}];
  const slot = allocateHouseToPlayer(houses, 1, { buildingKey: 0x10203, mapId: 1001, location: 'Aldleigh' });
  assert.equal(slot.layout, 'beautiful-villages@1.4.2');
  assert.equal('layout' in allocateHouseToPlayer([{}], 0, { buildingKey: 7, mapId: 1004 }), false, 'a classic town\'s deed is the deed it always was');
  const rooms = [];
  const room = rentRoom(rooms, { days: 1, nowMinutes: 0, mapId: 1002, buildingKey: 0x305, name: 'The Rusty Mug', rolls: () => 0 });
  assert.equal(room.layout, 'beautiful-cities@0.5.0+beautiful-villages@1.4.2');
  const renewed = rentRoom(rooms, { room, days: 1, nowMinutes: 0 });
  assert.equal(renewed.layout, room.layout, 'a renewal keeps the stamp the room was let under');
  const item = {};
  leaveForRepair(item, 0x10203, 60, 100, 1003);
  assert.deepEqual(item.repairData, { buildingKey: 0x10203, timeStarted: 100, repairTime: 60, mapId: 1003, layout: 'beautiful-villages@1.4.2' });
  const old = {};
  leaveForRepair(old, 0x10203, 60, 100);
  assert.deepEqual(old.repairData, { buildingKey: 0x10203, timeStarted: 100, repairTime: 60 }, 'a caller with no town: a ticket that holds none');
  const inside = makeAnchor({ worldContext: WORLD_CONTEXT.Interior, pixel: { x: 101, y: 200 }, nativeX: 0, nativeZ: 0, buildingKey: 0x10101 });
  assert.equal(inside.layout, 'beautiful-cities@0.5.0+beautiful-villages@1.4.2');
  assert.equal('layout' in makeAnchor({ worldContext: WORLD_CONTEXT.Exterior, pixel: { x: 101, y: 200 }, nativeX: 0, nativeZ: 0 }), false, 'outdoors: no building');
  // ...and the sites whose record lives elsewhere, by source: the quest's building site, the online claim, the inside save, the cached interior
  assert.match(src('src/systems/quest/place.js'), /this\.sitePending = false;\n {4}this\._stampSiteLayout\(\);/);
  assert.match(src('src/systems/quest/place.js'), /if \(sd\?\.siteType === SITE_TYPES\.Building && sd\.buildingKey > 0\) stampLayout\(sd, layoutStampOfMapId\(sd\.mapId\)\);/);
  assert.match(src('src/systems/onlineHomes.js'), /const stamp = layoutStampOfMapId\(mapId\);\n {2}return stamp && stamp !== CLASSIC_LAYOUT \? stamp : null;/);   // AUDIT PRE-MERGE 1003 WD1: homeClaimLayout, a hall's too
  assert.match(src('src/systems/onlineHomes.js'), /const layout = homeClaimLayout\(mapId\);/);
  assert.match(src('src/scenes/world.js'), /if \(interior\) \{ const at = playerTravelPixel\(\); stampLayout\(interior, layoutStampOfPixel\(at\.x, at\.y\)\); \}/);
  assert.match(src('src/scenes/worldModes.js'), /if \(_visitLayout !== null\) stampLayout\(state, _visitLayout\);/);
});

test('WD3 an interior\'s cached scene carries its town\'s layout through the save, and is restored only into that layout - an ordinary one cached in another layout goes, a permanent one is kept for its own and a visit in another layout kept beside it', () => {
  const cache = createSceneCache();
  cacheScene(cache, 'interior:1001:66051', { lootContainers: [], layout: 'beautiful-villages@1.4.2' });
  cacheScene(cache, 'interior:1004:7', { lootContainers: [], layout: '' });
  const back = createSceneCache();
  restoreSceneCache(back, JSON.parse(JSON.stringify(snapshotSceneCache(cache))));
  assert.equal(restoreCachedScene(back, 'interior:1001:66051').layout, 'beautiful-villages@1.4.2');
  assert.equal('layout' in restoreCachedScene(back, 'interior:1004:7'), false, 'a classic town\'s scene carries none');
  // AUDIT WD3 R1: a permanent scene's visit in another layout is kept BESIDE it, under its own name, permanent too, and
  // goes with it when the house is sold or the room expires
  const held = createSceneCache();
  const house = 'interior:1001:66051';
  addPermanentScene(held, house);
  const alt = layoutSceneName(house, '');
  assert.equal(alt, 'interior:1001:66051|classic');
  assert.equal(layoutSceneName(house, 'beautiful-villages@1.4.2'), 'interior:1001:66051|beautiful-villages@1.4.2');
  addPermanentScene(held, alt); addPermanentScene(held, 'interior:1001:660510|classic');
  removePermanentScene(held, house);
  assert.deepEqual([...held.permanent], ['interior:1001:660510|classic'], 'the sale takes its visits, never another building\'s');
  const W = src('src/scenes/worldModes.js');
  assert.match(W, /if \(townKey != null && !layoutsMatch\(data\.layout, _visitLayout\)\) \{\n {6}if \(!containsPermanentScene\(sceneCache\(\), name\)\) \{ console\.warn\(`\[layout\] \$\{name\}: cached in another layout of this town - not restored`\); return; \}\n {6}cacheScene\(sceneCache\(\), name, data\);\n {6}_sceneHeldForLayout = name;\n(?: {6}.*\n) {6}data = restoreCachedScene\(sceneCache\(\), layoutSceneName\(name, _visitLayout\)\);/);
  // the held scene is never written over by the visit's own leaving; the visit is kept beside it (AUDIT WD3 S1/R1)
  assert.match(W, /if \(_sceneHeldForLayout === name\) \{\n {6}const alt = layoutSceneName\(name, _visitLayout\);\n {6}cacheScene\(sceneCache\(\), alt, state\);\n {6}addPermanentScene\(sceneCache\(\), alt\);\n {6}return;\n {4}\}/);
  // nor furnished there: the deed sleeps where its town stands in another layout (banking.js deedStands, AUDIT WD3 H1)
  assert.match(src('src/systems/banking.js'), /return ownedHouseKey\(houses, regionIndex\) === buildingKey && deedStands\(houses\?\.\[regionIndex\]\);/);
  // AUDIT WD3 R4: stamped with the layout the visit began in
  assert.match(W, /_visitLayout = visitLayoutNow\(\);/);
  assert.match(W, /const visitLayoutNow = \(\) => \{ const k = layoutLocationKeyOfMapId\(questSceneCtx\?\.\(\)\?\.mapId \?\? 0\); return k != null \? layoutStampAt\(k\) : null; \};/);
});

test('WD3 the discoveries: a town\'s found buildings carry the layout they were found in, through the save; a load where the layout moved forgets them (the town itself stays found), a town in its layout or one the host cannot place keeps them', () => {
  world();
  restoreDiscovery(null);
  discoverBuilding('17:Aldleigh', { buildingKey: 0x10203, name: 'The Smithy', buildingType: 0 });
  discoverBuilding('17:Daggerfall', { buildingKey: 0x10101, name: 'The Bank of Daggerfall', buildingType: 0 });
  discoverBuilding('17:Nowhere', { buildingKey: 5, name: 'A House', buildingType: 0 });
  discoverBuilding('23:The Rusty Mug', { buildingKey: 9, name: 'The Rusty Mug', buildingType: 0 });
  const snap = JSON.parse(JSON.stringify(snapshotDiscovery()));
  assert.deepEqual(snap.layouts, { '17:Aldleigh': 'beautiful-villages@1.4.2', '17:Daggerfall': 'beautiful-cities@0.5.0+beautiful-villages@1.4.2', '23:The Rusty Mug': 'beautiful-villages@1.4.2' });
  restoreDiscovery(snap);
  assert.equal(pruneDiscoveryLayouts(), 0, 'every town in the layout it was found in');
  // the next game loads with Cities switched off: the city moved, the village and the tavern did not
  world({ on: [BV] });
  assert.equal(pruneDiscoveryLayouts(), 1);
  assert.deepEqual(discoveredBuildings('17:Daggerfall'), [], 'the city\'s buildings are forgotten');
  assert.equal(discoveredBuildings('17:Aldleigh').length, 1);
  assert.equal(discoveredBuildings('17:Nowhere').length, 1, 'a town the host cannot place is kept as it is');
  // a save from before WD3 carries no layouts: its towns were classic - found again in a village, they are forgotten
  restoreDiscovery({ buildings: { '17:Aldleigh': { 66051: { buildingKey: 66051, displayName: 'The Smithy' } } } });
  assert.equal(pruneDiscoveryLayouts(), 1);
  assert.equal(snapshotDiscovery().layouts, undefined, 'and a game without the mods writes no layouts at all');
  restoreDiscovery(null);
});

test('WD3 the load: the save\'s towns in the layouts its things were made in, before its place is built - online only the service\'s homes pin, a pack a pin lets in is on the door first, each changed town read again and rebuilt where it stands, and discoveries pruned', () => {
  const W = src('src/scenes/world.js');
  const at = W.indexOf('async function applyLayoutPins(extras = null) {');
  assert.ok(at > 0);
  const body = W.slice(at, W.indexOf('\n  async function worldQuickLoad', at));
  assert.match(body, /const records = homeLayoutsOnline \? \(_serverLayoutRecords \?\? \[\]\) : layoutRecordsOf\(\{\n {6}houses: playerEntity\.houses, rooms: playerEntity\.rentedRooms,/);
  assert.match(body, /repairs: \(playerEntity\.otherItems \?\? \[\]\)\.map\(\(it\) => it\?\.repairData\)\.filter\(Boolean\),\n {6}anchor: playerEntity\.anchorPosition,/);
  assert.match(body, /for \(const v of \[\.\.\.pin\.in\]\) if \(!\(await ensureWorldDataPack\(v\)\)\) \{ pin\.in\.delete\(v\); dropped\+\+; \}/);
  assert.match(body, /const changed = setLayoutPins\(pins\);/);
  assert.match(body, /if \(built\.has\(pixelKey\)\) \{[\s\S]{0,120}destroyPixel\(px, py, \{ collectLoose: false \}\);\n {8}queue\.push\(\{ px, py \}\);/);
  assert.match(body, /const forgotten = homeLayoutsOnline && _serverLayoutRecords === null \? 0 : pruneDiscoveryLayouts\(\);/);
  assert.match(W, /await applyLayoutPins\(extras\);   \/\/ WD3: the save's towns in the layouts its things were made in, before its place is built/);
  assert.match(src('src/scenes/dungeonContext.js'), /if \(session\) opts\.layoutPinsLoaded\?\.\(extras\);/);
});

test('WD3 a deed customs gives back crosses WITH its town\'s layout (AUDIT WD3 S2) - its key names a building only in that layout; a slot the realm held keeps none of its own', async () => {
  const { reclaimCustomsDeeds } = await import('../src/systems/realmCustoms.js');
  const { interiorSceneName } = await import('../src/systems/sceneCache.js');
  const name = interiorSceneName(1017, 5);
  const realm = { houses: [{ regionIndex: 0, layout: 'beautiful-cities@0.5.0' }, {}], sceneCache: { permanentScenes: [name], scenes: [] } };
  const offline = { houses: [{}, { regionIndex: 1, location: 'Wayrest', mapId: 1017, buildingKey: 5, layout: 'beautiful-villages@1.4.2' }], sceneCache: { scenes: [] } };
  reclaimCustomsDeeds(realm, offline);
  assert.equal(realm.houses[1].layout, 'beautiful-villages@1.4.2');
  const classic = { houses: [{}, { layout: 'beautiful-cities@0.5.0' }], sceneCache: { permanentScenes: [name], scenes: [] } };
  reclaimCustomsDeeds(classic, { houses: [{}, { location: 'Wayrest', mapId: 1017, buildingKey: 5 }], sceneCache: { scenes: [] } });
  assert.equal('layout' in classic.houses[1], false, 'a deed made in Daggerfall\'s own town carries none');
});

test('WD3 a questor met indoors is stamped with their town\'s layout (AUDIT WD3 S3) - the return to them finds them only there; the save carries it, and the host pins the active quests\' questors', () => {
  const P = src('src/systems/quest/person.js');
  assert.match(P, /this\.questorData = stampLayout\(\{ \.\.\.clicked \}, clicked\.buildingKey > 0 \? layoutStampOfMapId\(clicked\.mapID\) : ''\);/);
  assert.match(P, /questorData: \{ \.\.\.this\.questorData \},/, 'saved with the struct');
  assert.match(P, /this\.questorData = \{ \.\.\.ZERO_NPC_DATA, \.\.\.\(dataIn\.questorData \?\? \{\}\) \};/, 'and restored with it');
  assert.match(src('src/systems/quest/machine.js'), /if \(resource\.isPerson && resource\.isQuestor && resource\.questorData\?\.buildingKey > 0\) out\.push\(resource\.questorData\);/);
  assert.match(src('src/scenes/world.js'), /questors: questBridge\?\.machine\?\.getAllActiveQuestors\?\.\(\) \?\? \[\],/);
});

test('WD3 a deed SLEEPS where its town stands in another layout (AUDIT WD3 H1) - no building is the player\'s by its key there (door, cupboards, bed, furniture, the bank\'s sale) until the town stands in its layout again; one whose town the host cannot place stands as Daggerfall read it; and the market never sells a house with no model of its own (H2)', async () => {
  const { isHouseOwned, deedStands, housesForSale } = await import('../src/systems/banking.js');
  world();
  const houses = [{}, {}];
  allocateHouseToPlayer(houses, 1, { buildingKey: 0x10203, mapId: 1001, location: 'Aldleigh' });
  assert.equal(isHouseOwned(houses, 1, 0x10203), true, 'its town in the layout it was bought in');
  world({ on: [] });   // the village now Daggerfall's own (its pack not loaded, the pin dropped)
  assert.equal(deedStands(houses[1]), false);
  assert.equal(isHouseOwned(houses, 1, 0x10203), false, 'the key names another building here');
  world();
  assert.equal(isHouseOwned(houses, 1, 0x10203), true, 'and wakes with its layout');
  assert.equal(deedStands({ mapId: 424242, buildingKey: 5, layout: BV + '@1.4.2' }), true, 'a town the host cannot place');
  assert.equal(deedStands({ buildingKey: 5 }), true, 'a deed naming no town');
  const src2 = src('src/scenes/worldModes.js');
  assert.match(src2, /if \(!deedStands\(playerEntity\.houses\?\.\[bankRegion\(\)\]\)\) return null;/, 'the bank prices and sells no sleeping deed');
  // H2: the market's candidates - a house standing on no model is skipped, every other as before
  const { BUILDING_TYPES } = await import('../src/world/buildingNames.js');
  const b = (k, t, m = 1) => ({ buildingKey: k, buildingType: t, modelIdNum: m });
  const list = [b(1, BUILDING_TYPES.Tavern), b(3, BUILDING_TYPES.House2, null), b(4, BUILDING_TYPES.HouseForSale, null), ...Array.from({ length: 37 }, (_, i) => b(10 + i, BUILDING_TYPES.House2))];
  const sold = housesForSale(list, { mapId: 9, month: 3, stands: (x) => x.modelIdNum != null });
  assert.ok(sold.length > 0 && sold.every((x) => x.buildingKey !== 3 && x.buildingKey !== 4), 'neither the doorless house nor a doorless house-for-sale');
  assert.ok(housesForSale(list, { mapId: 9, month: 3 }).some((x) => x.buildingKey === 4), 'which the market without the law would sell');
  assert.deepEqual(housesForSale(list.map((x) => (x.buildingKey === 3 || x.buildingKey === 4 ? { ...x, buildingType: BUILDING_TYPES.Tavern } : x)), { mapId: 9, month: 3 }).map((x) => x.buildingKey), sold.map((x) => x.buildingKey), 'the roll is the one a town where they were no house rolls');
  assert.match(src2, /stands: \(bs\) => houseMeshRadius\(bs\) > 0,/);
});

test('WD3 the port\'s curation (AUDIT WD3 G2): a TAVERN location laid out on Beautiful Villages\' TVRNAS00 or TVRNAS06 (houses, no tavern) is kept Daggerfall\'s own - its pin standing though no save holds it, its records stamped classic, a record stamped in the mod pinning it in; a village laying those blocks out, and every other tavern, as the mod has it', async () => {
  const { curatedOut, CURATED_CLASSIC } = await import('../src/systems/layoutPins.js');
  const TAV = 4417, VIL = 4517, ROAD = 4617;
  world();
  registerWorldDataAsset('TVRNAS00.RMB.json', {}, null, { priority: 10, vendor: BV });
  registerWorldDataAsset('TVRNAS06.RMB.json', {}, null, { priority: 10, vendor: BV });
  const grids = new Map([[TAV, ['TVRNAS00.RMB']], [VIL, ['TVRNAS06.RMB', 'TVRNAL01.RMB']], [ROAD, ['TVRNAL01.RMB']]]);
  const types = new Map([[TAV, 6], [VIL, 2], [ROAD, 6]]);
  configureLayoutPins({ gridOf: (k) => grids.get(k) ?? null, locationTypeOf: (k) => types.get(k) ?? null });
  assert.deepEqual(CURATED_CLASSIC.map((c) => [c.vendor, c.locationType, [...c.blocks]]), [[BV, 6, ['TVRNAS00.RMB', 'TVRNAS06.RMB']]]);
  assert.deepEqual([...(curatedOut(TAV) ?? [])], [BV]);
  assert.equal(curatedOut(VIL), null, 'a village is the author\'s');
  assert.equal(curatedOut(ROAD), null, 'a tavern on another block keeps its rebuilt tavern');
  assert.deepEqual([...pinAt(TAV).out], [BV], 'the door serves the classic tavern');
  assert.equal(layoutStampAt(TAV), CLASSIC_LAYOUT, 'a record made there is stamped as it stands');
  assert.equal(layoutStampAt(ROAD), 'beautiful-villages@1.4.2');
  assert.equal(pinsFrom([{ locationKey: TAV, stamp: CLASSIC_LAYOUT, kind: 'house' }]).size, 0, 'a classic record needs no save pin there');
  const kept = pinsFrom([{ locationKey: TAV, stamp: 'beautiful-villages@1.4.2', kind: 'house' }]).get(TAV);
  assert.deepEqual([[...kept.out], [...kept.in]], [[], [BV]], 'a house bought there in the mod keeps its town (the save\'s pin wins)');
  setLayoutPins(new Map([[TAV, kept]]));
  assert.equal(layoutStampAt(TAV), 'beautiful-villages@1.4.2');
  setLayoutPins(new Map());
});

test('WD3 a record whose town stands in another layout is honoured, never misread (AUDIT WD3 S5) - a smith\'s ticket is handed over at any smith of its town (never at a stranger\'s counter by the key alone), a rented room at any inn of its town, and a save or anchor made inside stands the player outside rather than through a stranger\'s door', async () => {
  const { recordStands } = await import('../src/systems/layoutPins.js');
  const { isBeingRepairedAt, repairJobsAt } = await import('../src/systems/repairService.js');
  const { findRentedRoom } = await import('../src/systems/tavern.js');
  world();
  const sword = {}; leaveForRepair(sword, 0x10203, 1440, 0, 1001);
  assert.equal(sword.repairData.layout, 'beautiful-villages@1.4.2');
  assert.equal(recordStands(sword.repairData), true);
  assert.equal(isBeingRepairedAt(sword, 0x10203, 1001), true, 'at its smith');
  assert.equal(isBeingRepairedAt(sword, 0x999, 1001), false, 'and nowhere else while its town stands');
  const room = { mapId: 1001, buildingKey: 0x305, expiryMinutes: 99999, layout: 'beautiful-villages@1.4.2' };
  assert.equal(findRentedRoom([room], 1001, 0x305), room);
  assert.equal(findRentedRoom([room], 1001, 0x777), null);
  world({ on: [] });   // the village Daggerfall's own all the same (its pack not loaded; online, a record from before)
  assert.equal(recordStands(sword.repairData), false);
  assert.equal(isBeingRepairedAt(sword, 0x10203, 1002), false, 'never at another town\'s counter');
  assert.equal(isBeingRepairedAt(sword, 0x999, 1001), true, 'any smith of its town hands it over');
  assert.deepEqual(repairJobsAt({ otherItems: [sword] }, 0x999, 0, 1001), [sword]);
  assert.equal(findRentedRoom([room], 1001, 0x777), room, 'its room at an inn of its town');
  assert.equal(findRentedRoom([room], 1001, 0x777, false), null, 'never a bed in a building that is no inn');
  assert.equal(recordStands({ buildingKey: 5 }), true, 'a record naming no town stands as Daggerfall read it');
  const M = src('src/scenes/worldModes.js');
  assert.match(M, /if \(layoutLocationKeyOfMapId\(questSceneCtx\?\.\(\)\?\.mapId \?\? 0\) != null && !layoutsMatch\(saved\.layout, visitLayoutNow\(\)\)\) \{\n {8}console\.warn\('\[layout\] the building was left in another layout of this town - standing outside'\);\n {8}return false;/);
  assert.match(M, /room: findRentedRoom\(playerEntity\.rentedRooms \?\? \[\], mapId, buildingKey, b\?\.buildingType === BUILDING_TYPES\.Tavern\),/);
  assert.match(src('src/scenes/world.js'), /restoreInterior\?\.\(a\.interior \? \{ \.\.\.a\.interior, layout: a\.layout \} : a\.interior, anchorLanding\(a\)\)/, 'an anchor carries the layout it was set in');
});

test('WD3 a quest\'s building site whose town stands in another layout is chosen AGAIN in it (AUDIT WD3 S5) - by the place\'s own law (its P2/P3), keeping what was assigned to it, stamped anew, its site link following; a site standing in its layout, a town site and one with no building of its kind are left as they are', async () => {
  const { QuestMachine } = await import('../src/systems/quest/machine.js');
  const { Place } = await import('../src/systems/quest/place.js');
  const { SITE_TYPES } = await import('../src/systems/quest/place.js');
  const { loadQuestTables } = await import('../src/systems/quest/tables.js');
  const { readdirSync } = await import('node:fs');
  const T = new URL('../vendor/dfu-quests/Tables/', import.meta.url);
  { const s = {}; for (const f of readdirSync(T)) if (f.endsWith('.txt')) s[f.replace('.txt', '')] = readFileSync(new URL(f, T), 'utf8').replace(/^﻿/, ''); loadQuestTables(s); }
  world();
  const m = new QuestMachine();
  const quest = m.parseQuestForLists(['Quest: __QRS', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'variable _done_'], 0, { rolls: () => 0 });
  m.startQuestImmediate(quest);
  const sym = (name) => ({ name, original: `_${name}_`, clone() { return sym(name); } });
  const place = new Place(quest); place.symbol = sym('house'); place.p1 = 0; place.p2 = 17; place.p3 = 0;
  const assigned = { targetResources: [{ original: '_victim_', name: 'victim' }] };
  place.siteDetails = { siteType: SITE_TYPES.Building, mapId: 1001, regionIndex: 17, locationName: 'Aldleigh', buildingKey: 0x10203, magicNumberIndex: 0, selectedMarker: assigned, layout: 'beautiful-villages@1.4.2' };
  quest.resources.set('house', place);
  m.createSiteLink(quest, place.symbol);
  const asked = [];
  place._collectQuestSitesOfBuildingType = (w, loc, type, p3) => { asked.push([loc.name, type, p3]); return [{ siteType: SITE_TYPES.Building, mapId: 1001, regionIndex: 17, locationName: 'Aldleigh', buildingKey: 0x20101, buildingName: 'The Penrose Residence', magicNumberIndex: 0, selectedMarker: { targetResources: null }, questSpawnMarkers: [{ markerType: 11, flatPosition: { x: 5, y: 0, z: 5 }, dungeonX: 0, dungeonZ: 0, targetResources: null }], questItemMarkers: [] }]; };
  const w = { maps: { getRegion: () => ({ mapNameLookup: new Map([['Aldleigh', 3]]) }), getLocation: () => ({ name: 'Aldleigh', exterior: { exteriorData: {} } }) } };
  assert.equal(m.reseatMovedSites(w), 0, 'its town stands in its layout: left as it is');
  world({ on: [] });   // the village Daggerfall's own all the same
  assert.equal(m.reseatMovedSites(w), 1);
  assert.deepEqual(asked, [['Aldleigh', 17, 0]], 'chosen by its own P2/P3');
  assert.equal(place.siteDetails.buildingKey, 0x20101);
  // AUDIT PRE-MERGE 1003 WD2: what was assigned to it rides along - on the new building's own marker, never the old
  // building's (its position is the old interior's frame; test/audit1003_wd.test.js)
  assert.notEqual(place.siteDetails.selectedMarker, assigned);
  assert.deepEqual(place.siteDetails.selectedMarker.targetResources.map((s) => s.name), ['victim'], 'what was assigned to it rides along');
  assert.equal(place.siteDetails.selectedMarker.flatPosition.x, 5, 'at the new building\'s marker');
  assert.equal('layout' in place.siteDetails, false, 'stamped in the layout it stands in now (Daggerfall\'s own)');
  assert.equal(m.siteLinks.find((l) => l.questUID === quest.uid).buildingKey, 0x20101, 'its site link follows');
  assert.equal(m.reseatMovedSites(w), 0, 'and stands');
  assert.match(src('src/scenes/world.js'), /const reseated = homeLayoutsOnline && _serverLayoutRecords === null \? 0 : \(questBridge\?\.machine\?\.reseatMovedSites\?\.\(\) \?\? 0\);/);
});

test('WD3 the versions every stamp was made against (AUDIT WD3 B5) - two stamps are one layout whatever versions they name while each mod ships one; a vendored pack of another version may move buildings under every stamped record, so it is held to LAYOUT_MOD_VERSIONS until a layout migration is written', async () => {
  const { LAYOUT_MOD_VERSIONS } = await import('../src/systems/layoutPins.js');
  const zlib = await import('node:zlib');
  assert.deepEqual(Object.keys(LAYOUT_MOD_VERSIONS), LAYOUT_MODS);
  for (const v of LAYOUT_MODS) {
    const pack = JSON.parse(zlib.gunzipSync(readFileSync(new URL(`../vendor/${v}/WorldDataPack/${v}.pack.json.gz`, import.meta.url))).toString('utf8'));
    assert.equal(pack.mod?.version, LAYOUT_MOD_VERSIONS[v], `${v}: a new version is a layout migration, not a file swap`);
  }
});
