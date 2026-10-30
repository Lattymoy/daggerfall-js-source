// QUEST-ZONE BEYOND (the owner, 2026-10-30, answering bible/01-Overview/audits/Quest-Audit-IV.md's open question): online,
// a questor inside the open zone draws a remote dungeon outside it - in the region of the land nearest outside the zone,
// among the dungeons nearest that land (src/systems/quest/questZoneBeyond.js, quest/place.js _beyondZoneSite). The world
// below is rpt1026_quests.test.js's QUEST-ZONE shape with a second region past the zone; then the freeware's Cyrodiil.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { QuestMachine, linkSiteOf } from '../../../src/systems/quest/machine.js';
import { nearestBeyondZone, ZONE_BEYOND_MAX_PX } from '../../../src/systems/quest/questZoneBeyond.js';
import { createQuestProvinceSites } from '../../../src/scenes/quest/questProvinceSites.js';
import { mapPixelToWorldCoord, mapPixelToLongitudeLatitude, LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { CYRODIIL_REGION } from '../../../src/formats/mapsTables.js';
import { setWildMask, buildWildMask, wildInside } from '../../../src/systems/wild/wildZone.js';
import { loadTables } from '../../qlSources.mjs';

loadTables();

const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };

/** The zone: x 100..199 over every row the fixture uses - region 0 whole; region 1 lies past it, x 200..299. */
const inZone = (x, y) => x >= 100 && x < 200 && y >= 0 && y < 200;
const zoneMask = () => buildWildMask({ width: 1000, height: 500, inZone });
const regionAt = (x, y) => (x >= 200 && x < 300 && y >= 0 && y < 200 ? 1 : 0);
const lairBlock = { position: 9000, rdbBlock: { objectRootList: [{ rdbObjects: [11, 18].map((record, i) => ({ type: 3, position: 100 + i * 8, xPos: 10, yPos: 4, zPos: 20, resources: { flatResource: { textureArchive: 199, textureRecord: record } } })) }] } };
const REGION_NAME = ['Wrothgarian Mountains', 'Dragontail Mountains'];

/** A questor's town and a stronghold in region 0 (inside the zone; `own` false, none), two strongholds in region 1 (past it). */
function beyondWorld(home = { x: 150, y: 100 }, found = [], own = true) {
  const all = [{ kind: 'town', at: home, r: 0 }, ...(own ? [{ kind: 'dungeon', at: { x: 160, y: 100 }, r: 0 }] : []), { kind: 'dungeon', at: { x: 215, y: 100 }, r: 1 }, { kind: 'dungeon', at: { x: 290, y: 140 }, r: 1 }];
  const locations = [[], []];
  for (const s of all) {
    const wc = mapPixelToWorldCoord(s.at.x, s.at.y), ll = mapPixelToLongitudeLatitude(s.at.x, s.at.y), dungeon = s.kind === 'dungeon';
    const index = locations[s.r].length, id = 7000 + s.r * 100 + index;
    locations[s.r].push({
      loaded: true, regionIndex: s.r, regionName: REGION_NAME[s.r], name: `${s.kind}${s.at.x}`, locationIndex: index, hasDungeon: dungeon,
      mapTableData: { mapId: id, locationType: dungeon ? 7 : 0, dungeonType: dungeon ? 2 : -1, longitude: ll.x, latitude: ll.y },
      exterior: { buildings: [], recordElement: { header: { x: wc.x, y: wc.y } }, exteriorData: { locationId: id, width: 0, height: 0, blockNames: [] } },
      dungeon: dungeon ? { blocks: [{ x: 0, z: 0, blockName: 'ZONEAA00.RDB' }] } : null,
    });
  }
  const regions = locations.map((ls, r) => ({ name: REGION_NAME[r], locationCount: ls.length, mapTable: ls.map((l) => ({ ...l.mapTableData })), mapNameLookup: new Map(ls.map((l, i) => [l.name, i])) }));
  const asked = [];
  return {
    locations, asked,
    maps: {
      regionCount: 2, getRegion: (r, from) => { asked.push([r, from ?? null]); return regions[r] ?? null; }, getLocation: (r, l) => locations[r]?.[l] ?? null,
      getLocationByName: (_rn, ln) => locations.flat().find((l) => l.name === ln) ?? null, getRegionIndexAt: regionAt,
      readLocationIdFast: (r, l) => locations[r][l].exterior.exteriorData.locationId, getClimateIndex: () => 231,
    },
    getBlock: (name) => (name === 'ZONEAA00.RDB' ? lairBlock : null),
    currentLocation: () => locations[0][0], currentRegionIndex: () => regionAt(home.x, home.y), currentLocationIndex: () => 0, currentRegionName: () => REGION_NAME[regionAt(home.x, home.y)],
    isPlayerInLocationRect: () => true, playerInside: () => null, isHouseOwned: () => false,
    playerPixel: () => ({ ...home }), buildingNameOpts: () => ({}),
    discoverLocation: (_r, location) => { found.push(location); }, addNote: () => {},
  };
}
const zoneQuest = (lines) => ['Quest: __ZB', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', ...lines, '', 'variable _pad_'];
const rolls = (seed) => { let s = seed * 7919; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; };
const lairOf = (world, online, seed = 1) => {
  const m = new QuestMachine({ nowSeconds: () => 0, world, playerLevel: () => 1, sharedClock: () => online });
  return quiet(() => m.scheduleQuest(zoneQuest(['Place _lair_ remote dungeon2']), 0, { rolls: rolls(seed) })).getResource({ name: 'lair' }).siteDetails;
};

test('QUEST-ZONE BEYOND: the land nearest outside the zone - the nearest ring, of it the straightest; land alone; none from outside the zone or past the bound (mutants: the first of the ring; sea taken; from outside the zone)', () => {
  const mask = zoneMask();
  assert.deepEqual(nearestBeyondZone(mask, 150, 100), { x: 200, y: 100 }, 'straight east, not the ring\'s first corner');
  assert.deepEqual(nearestBeyondZone(mask, 190, 30), { x: 200, y: 30 });
  assert.deepEqual(nearestBeyondZone(mask, 150, 100, { landAt: (x) => x >= 210 }), { x: 210, y: 100 }, 'the sea past the edge is passed over');
  assert.equal(nearestBeyondZone(mask, 90, 100), null, 'a pixel outside the zone has nothing to leave');
  assert.equal(nearestBeyondZone(mask, 150, 100, { max: 40 }), null, 'none within the bound');
  assert.equal(nearestBeyondZone(null, 150, 100), null, 'no zone');
  assert.ok(ZONE_BEYOND_MAX_PX >= 320, 'the bound reaches past the Imperial City\'s 297');
});

test('QUEST-ZONE BEYOND: online a questor inside the zone, whose region it seals whole, sends the player to a dungeon past it - drawn among those nearest the land outside, its table asked around that land; offline DFU\'s draw takes the region\'s own (mutants: the draw not widened; no origin for the table)', (t) => {
  t.after(() => setWildMask(null));
  setWildMask(zoneMask());
  assert.equal(wildInside(zoneMask(), 160, 100), true, 'the setup: the region\'s one stronghold sealed');
  const world = beyondWorld();
  const names = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const sd = lairOf(world, true, seed);
    assert.equal(sd.regionIndex, 1, 'past the zone');
    assert.equal(sd.regionName, 'Dragontail Mountains');
    names.add(sd.locationName);
  }
  assert.ok(names.has('dungeon215'), 'the nearest to the land outside among them');
  assert.ok(world.asked.some(([r, from]) => r === 1 && from?.x === 200 && from?.y === 100), 'region 1\'s table asked around the land outside');
  for (let seed = 1; seed <= 6; seed++) assert.equal(lairOf(world, false, seed).locationName, 'dungeon160', 'offline: Daggerfall\'s own');
});

test('QUEST-ZONE BEYOND: DFU\'s draw stands outside the zone and offline - a questor outside it whose region it seals, or offline in a region with no dungeon, gets no work there, as before (mutants: from outside the zone; offline widened)', (t) => {
  t.after(() => setWildMask(null));
  setWildMask(zoneMask());
  assert.throws(() => lairOf(beyondWorld({ x: 90, y: 100 }), true), /Search failed/);
  assert.throws(() => lairOf(beyondWorld({ x: 150, y: 100 }, [], false), false), /Search failed/, 'offline: the region\'s own or none');
  assert.equal(lairOf(beyondWorld({ x: 150, y: 100 }, [], false), true).regionIndex, 1, 'online: past the zone');
});

test('QUEST-ZONE BEYOND: a save whose remote dungeon the zone seals, in a region it covers whole, is drawn again past the zone at the load\'s re-seat - from the site it leaves, the foe carried, the reveal made again; offline it stays (mutant: the re-seat not widened)', (t) => {
  t.after(() => setWildMask(null));
  setWildMask(zoneMask());
  const found = [];
  const world = beyondWorld({ x: 150, y: 100 }, found);
  const build = (online) => {
    const m = new QuestMachine({ nowSeconds: () => 0, world, playerLevel: () => 1, sharedClock: () => online });
    // drawn offline - the region's own stronghold, as a save before the zone made it
    const q = quiet(() => m.scheduleQuest(zoneQuest(['Place _lair_ remote dungeon2', '', 'Foe _vamp_ is Vampire', '', ' reveal _lair_', ' place foe _vamp_ at _lair_']), 0, { rolls: rolls(3) }));
    quiet(() => { m.tick(); m.tick(); });
    m.deps.sharedClock = () => online;
    return { m, q, place: q.getResource({ name: 'lair' }) };
  };
  const off = build(false);
  assert.equal(off.place.siteDetails.locationName, 'dungeon160', 'the setup: drawn in the zone, offline');
  assert.equal(quiet(() => off.m.reseatMovedSites(world)), 0, 'offline: DFU\'s site stands');
  const on = build(false);
  on.m.deps.sharedClock = () => true;
  for (const link of on.m.siteLinks) if (link.questUID === on.q.uid) Object.assign(link, linkSiteOf(on.place));
  found.length = 0;
  assert.equal(quiet(() => on.m.reseatMovedSites(world)), 1, 'online: drawn again');
  const sd = on.place.siteDetails;
  assert.equal(sd.regionIndex, 1);
  assert.ok(sd.selectedMarker.targetResources.some((s) => s.name === 'vamp'), 'the foe carried');
  assert.deepEqual(found, [sd.locationName], 'its reveal made again');
});

test('QUEST-ZONE BEYOND: a province\'s table is made around the pixel a draw measures from - its lairs read there, not at the questor (mutant: `from` unread)', () => {
  const R = CYRODIIL_REGION - 2;
  const read = [];
  const p = createQuestProvinceSites({
    worldPlaces: { inTheatre: () => [], generation: () => 0 }, regionAt: () => R, standAt: () => null,
    lairsNear: (x, y) => { read.push(`${x},${y}`); return [{ mapId: 0xa9000000 + x, name: `lair${x}`, px: x + 1, py: y, type: LOCATION_TYPES.DungeonRuin, dungeonType: 9 }]; },
    origin: () => ({ x: 2076, y: 664 }),
  });
  assert.deepEqual(p.getRegion(R).mapNames, ['lair2076']);
  assert.deepEqual(p.getRegion(R, { x: 1842, y: 961 }).mapNames, ['lair1842'], 'around the land outside the zone');
  assert.deepEqual(read, ['2076,664', '1842,961']);
});

// ─── WITH ARENA2: THE IMPERIAL CITY'S ARCANE UNIVERSITY, ONLINE ─────────────────────────────────

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['MAPS.BSA', 'BLOCKS.BSA', 'WOODS.WLD', 'CLIMATE.PAK', 'POLITIC.PAK', 'FACTION.TXT', 'TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL'].every((f) => existsSync(join(ARENA2, f)));

test('QUEST-ZONE BEYOND with ARENA2: the Mages Guild of the Arcane University gives its lair quest online - the lair Elsweyr\'s, past the zone, found again by its name and drawn alike on a second client; offline a lair of Cyrodiil, as DFU (mutants: the draw not widened; the quest world\'s table not handed `from`)', { skip: HAVE ? false : 'ARENA2_PATH not set', timeout: 600_000 }, async (t) => {
  const { standWorldPastBay, questLayerAt } = await import('./r25World.mjs');
  const { loadTables, questSource } = await import('../../qlSources.mjs');
  const { cyrodiilMask } = await import('../../../src/systems/wild/cyrodiilZone.js');
  const { QUEST_REACH_TUNING } = await import('../../../src/systems/quest/questReach.js');
  t.after(() => { setWildMask(null); QUEST_REACH_TUNING.override = null; });
  loadTables();
  const world = await standWorldPastBay(ARENA2);
  QUEST_REACH_TUNING.override = true;
  const mask = cyrodiilMask();
  const lairAt = async (online, seed) => {
    setWildMask(online ? mask : null);
    const location = world.places.provinceQuestPlaces.standAt(2076, 664);
    const L = await questLayerAt(world, { pixel: { x: 2076, y: 664 }, location });
    L.machine.deps.sharedClock = () => online;
    L.machine.setLastNPCClicked({ hash: 1, mapID: location.mapTableData.mapId, nameSeed: 7, buildingKey: 0, factionID: 40, gender: 0 });
    let s = seed;
    const q = quiet(() => L.machine.parseQuestForLists(questSource('N0B00Y06', true), 40, { rolls: () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; } }));
    const sd = [...(q?.resources.values() ?? [])].find((x) => x.isPlace && x.siteDetails?.siteType === 2)?.siteDetails ?? null;
    return { sd, L };
  };
  for (const seed of [13, 990]) {
    const { sd, L } = await lairAt(true, seed);
    assert.ok(sd, 'online: work given');
    assert.equal(sd.regionName, 'Elsweyr', `${sd.locationName}: the nearest land outside the zone is Elsweyr's`);
    assert.equal(wildInside(mask, sd.worldPixel.x, sd.worldPixel.y), false, 'past the zone');
    assert.equal(L.questWorld.maps.getLocationByName(sd.regionName, sd.locationName)?.mapTableData?.mapId, sd.mapId, 'found again by its name');
    const again = (await lairAt(true, seed)).sd;
    assert.deepEqual([again.mapId, again.worldPixel], [sd.mapId, sd.worldPixel], 'a second client draws the same');
  }
  const off = (await lairAt(false, 13)).sd;
  assert.equal(off.regionName, 'Cyrodiil', 'offline: a lair of the questor\'s own province');
});
