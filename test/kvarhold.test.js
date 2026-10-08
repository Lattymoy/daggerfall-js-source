// KVAR-HOLD (FIELD BUGS 2026-10-08, Themicles: Lord K'avar Part 1 "assigned K'var's location to Privateers Hold in
// Daggerfall. I've searched the dungeon several times now and have tried the repair button ... I can now not receive new
// Fighters Guild quests with this one still stuck"; bible/06-Systems/Quest-Arc.md KVAR-HOLD). DFU's random dungeon draw
// keeps out only a dungeon another Place holds, so once the tutorial let Privateer's Hold go a guild's `remote
// dungeon2` could land in it - and NEARBY-QUESTS' nearest few made it likely beside the classic start. The main story's
// dungeons are no random quest's now (quest/place.js _collectDungeonIndicesOfType), and a save that holds such a site has
// it drawn again at the load's re-seat (Place._reseatStoryDungeon), its foe carried and its reveal made again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine, linkSiteOf } from '../src/systems/quest/machine.js';
import { Scopes } from '../src/systems/quest/place.js';
import { mapPixelToWorldCoord, mapPixelToLongitudeLatitude } from '../src/formats/mapsFile.js';
import { MAIN_STORY_DUNGEON_IDS } from '../src/world/dungeonTextures.js';
import { getPref, setPref } from '../src/systems/uiPrefs.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  loadQuestTables(sources);
}

const PRIVATEERS_HOLD = 187853213;
const HOME = { x: 100, y: 100 };
const lair = { position: 9000, rdbBlock: { objectRootList: [{ rdbObjects: [11, 18].map((record, i) => ({ type: 3, position: 100 + i * 8, xPos: 10, yPos: 4, zPos: 20, resources: { flatResource: { textureArchive: 199, textureRecord: record } } })) }] } };

/** A region: the player's town at HOME, then Human Strongholds (dungeon type 2) `dx` pixels east, one of them `story`
 *  (its map id the main story's). */
function makeWorld(sites, found = []) {
  const all = [{ kind: 'town', dx: 0 }, ...sites.map((s) => ({ kind: 'dungeon', ...s }))];
  const locations = all.map((s, index) => {
    const pixel = { x: HOME.x + s.dx, y: HOME.y };
    const wc = mapPixelToWorldCoord(pixel.x, pixel.y);
    const ll = mapPixelToLongitudeLatitude(pixel.x, pixel.y);
    const dungeon = s.kind === 'dungeon';
    return {
      loaded: true, regionIndex: 0, regionName: 'Testshire', name: s.story ? 'Privateer\'s Hold' : `${s.kind}${s.dx}`, locationIndex: index, hasDungeon: dungeon,
      mapTableData: { mapId: s.story ? PRIVATEERS_HOLD : 5000 + index, locationType: dungeon ? 7 : 0, dungeonType: dungeon ? 2 : -1, longitude: ll.x, latitude: ll.y },
      exterior: { buildings: [], recordElement: { header: { x: wc.x, y: wc.y } }, exteriorData: { locationId: 0x500 + index, width: 0, height: 0, blockNames: [] } },
      dungeon: dungeon ? { blocks: [{ x: 0, z: 0, blockName: 'LAIRAA00.RDB' }] } : null,
    };
  });
  const region = { name: 'Testshire', locationCount: locations.length, mapTable: locations.map((l) => ({ ...l.mapTableData })) };
  return {
    locations,
    maps: {
      regionCount: 1, getRegion: (r) => (r === 0 ? region : null), getLocation: (r, l) => (r === 0 ? locations[l] ?? null : null),
      getLocationByName: (rn, ln) => locations.find((l) => l.name === ln) ?? null,
      readLocationIdFast: (r, l) => locations[l].exterior.exteriorData.locationId, getClimateIndex: () => 231,
    },
    getBlock: (name) => (name === 'LAIRAA00.RDB' ? lair : null),
    currentLocation: () => locations[0], currentRegionIndex: () => 0, currentLocationIndex: () => 0, currentRegionName: () => 'Testshire',
    isPlayerInLocationRect: () => true, playerInside: () => null, isHouseOwned: () => false,
    playerPixel: () => ({ ...HOME }), buildingNameOpts: () => ({}),
    discoverLocation: (region, location) => { found.push(location); }, addNote: () => {},
  };
}

const QUEST = (lines) => ['Quest: __KV', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', ...lines, '', 'variable _pad_'];
const rollsOf = (seed) => { let s = seed * 7919; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; };

test('KVAR-HOLD a random dungeon is never the main story\'s: Privateer\'s Hold the nearest Human Stronghold of three, forty draws, never drawn - near or region-wide; the retry\'s any-dungeon draw keeps it out too (mutant: the exclusion dropped)', () => {
  assert.ok(MAIN_STORY_DUNGEON_IDS.has(PRIVATEERS_HOLD));
  const world = makeWorld([{ dx: 1, story: true }, { dx: 6 }, { dx: 90 }]);
  const saved = getPref('nearbyQuests');
  try {
    for (const near of [true, false]) {
      setPref('nearbyQuests', near);
      const names = new Set();
      for (let seed = 1; seed <= 40; seed++) {
        const m = new QuestMachine({ nowSeconds: () => 0, world, playerLevel: () => 1 });
        const q = m.scheduleQuest(QUEST(['Place _stronghold_ remote dungeon2']), 0, { rolls: rollsOf(seed) });
        names.add(q.getResource({ name: 'stronghold' }).siteDetails.locationName);
      }
      assert.ok(!names.has('Privateer\'s Hold'), `nearby ${near}: ${[...names]}`);
      assert.ok(names.has('dungeon6'), `nearby ${near}: the next nearest drawn`);
    }
    // any dungeon (the -1 retry and `remote dungeon`)
    setPref('nearbyQuests', true);
    for (let seed = 1; seed <= 20; seed++) {
      const m = new QuestMachine({ nowSeconds: () => 0, world, playerLevel: () => 1 });
      const q = m.scheduleQuest(QUEST(['Place _any_ remote dungeon']), 0, { rolls: rollsOf(seed) });
      assert.notEqual(q.getResource({ name: 'any' }).siteDetails.mapId, PRIVATEERS_HOLD);
    }
  } finally { setPref('nearbyQuests', saved); }
});

test('KVAR-HOLD a save that holds a random dungeon site in Privateer\'s Hold has it drawn again at the load\'s re-seat - in its region, by its declared type, K\'avar carried onto the new site\'s marker, the site link following, the reveal made again; once; a site the quest named `permanent` never (mutants: the arm unwired, the guard, the carry, the reveal)', () => {
  const found = [];
  const world = makeWorld([{ dx: 1, story: true }, { dx: 6 }, { dx: 90 }], found);
  const m = new QuestMachine({ nowSeconds: () => 0, world, playerLevel: () => 1 });
  const q = m.scheduleQuest(QUEST(['Place _stronghold_ remote dungeon2', '', 'Foe _mtraitor_ is Ranger', '',
    ' reveal _stronghold_', ' place foe _mtraitor_ at _stronghold_']), 0, { rolls: rollsOf(3) });
  m.tick(); m.tick();
  const place = q.getResource({ name: 'stronghold' });
  assert.ok(place.siteDetails.selectedMarker.targetResources.some((s) => s.name === 'mtraitor'), 'K\'avar stands on its marker');
  // the save as an older build wrote it: the same draw, landed in Privateer's Hold
  const hold = world.locations.find((l) => l.mapTableData.mapId === PRIVATEERS_HOLD);
  place.siteDetails = { ...place.siteDetails, mapId: PRIVATEERS_HOLD, locationId: hold.exterior.exteriorData.locationId, locationName: hold.name };
  for (const link of m.siteLinks) if (link.questUID === q.uid) Object.assign(link, linkSiteOf(place));
  found.length = 0;
  assert.equal(m.reseatMovedSites(world), 1, 'one site drawn again');
  const sd = place.siteDetails;
  assert.notEqual(sd.mapId, PRIVATEERS_HOLD);
  assert.equal(sd.regionIndex, 0);
  assert.ok(sd.selectedMarker.targetResources.some((s) => s.name === 'mtraitor'), 'K\'avar carried to the new site\'s marker');
  assert.ok(sd.questSpawnMarkers.some((k) => k.markerID === sd.selectedMarker.markerID), '...a marker the new site has');
  assert.ok(m.siteLinks.filter((l) => l.questUID === q.uid).every((l) => l.mapId === sd.mapId), 'the site link follows');
  assert.deepEqual(found, [sd.locationName], 'the reveal made again, of the new site');
  assert.equal(m.reseatMovedSites(world), 0, 'again: nothing');
  // a site the quest NAMED (the main story's own `permanent` Places) is never drawn again
  place.siteDetails = { ...place.siteDetails, mapId: PRIVATEERS_HOLD, locationName: hold.name };
  place.scope = Scopes.Fixed;
  assert.equal(m.reseatMovedSites(world), 0, 'permanent: the quest\'s own');
  assert.equal(place.siteDetails.mapId, PRIVATEERS_HOLD);
});
