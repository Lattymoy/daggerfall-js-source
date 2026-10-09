// @ts-check
// NEARBY-QUESTS (2026-10-04, Discord: "quests of the game you take from guilds and so on need to be near you on
// overworld map"): a remote quest site is drawn within the quest reach of the player's map pixel - ten pixels at level
// one, four more a level - with the nearest three standing in when fewer are that near, and DFU's region-wide draw
// with the row off. Driven through the real parse (QuestMachine.scheduleQuest) over a crafted region whose sites stand
// at known distances.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { mapPixelToWorldCoord, mapPixelToLongitudeLatitude } from '../src/formats/mapsFile.js';
import {
  QUEST_REACH_TUNING, QUEST_REACH_BASE, QUEST_REACH_PER_LEVEL, QUEST_REACH_MIN_CHOICES,
  questReachPixels, nearbyIndices, mapPixelDistance, mapTablePixel,
} from '../src/systems/quest/questReach.js';
import { PREF_DEFAULTS } from '../src/systems/uiPrefs.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  loadQuestTables(sources);
}

const HOME = { x: 100, y: 100 };
const flat = (record) => ({ textureArchive: 199, textureRecord: record, xPos: 40, yPos: 8, zPos: 60 });
const tavern = { buildingType: 15, factionId: 0, nameSeed: 777, locationId: 0, sector: 0, quality: 9 };
const blocks = {
  'TOWNAA00.RMB': { position: 5000, rmbBlock: { fldHeader: { buildingDataList: [tavern], otherNames: null }, subRecords: [{ interior: { blockFlatObjectRecords: [flat(11), flat(18)] } }] } },
  'LAIRAA00.RDB': { position: 9000, rdbBlock: { objectRootList: [{ rdbObjects: [11, 18].map((record, i) => ({ type: 3, position: 100 + i * 8, xPos: 10, yPos: 4, zPos: 20, resources: { flatResource: { textureArchive: 199, textureRecord: record } } })) }] } },
};

/** A region: the player's town at HOME, then `sites` - { kind: 'town' | 'dungeon', dx } - each dx pixels east. */
function makeWorld(sites) {
  const all = [{ kind: 'town', dx: 0 }, ...sites];
  const locations = all.map((s, index) => {
    const pixel = { x: HOME.x + s.dx, y: HOME.y };
    const wc = mapPixelToWorldCoord(pixel.x, pixel.y);
    const ll = mapPixelToLongitudeLatitude(pixel.x, pixel.y);
    const dungeon = s.kind === 'dungeon';
    // PIN MOVED (KVAR-HOLD, 2026-10-08): the ids start past 5000 - 1001 is Mantellan Crux, a main-story dungeon, and no
    // random quest draws one now
    return {
      loaded: true, regionIndex: 0, regionName: 'Testshire', name: `${s.kind}${s.dx}`, locationIndex: index, hasDungeon: dungeon,
      mapTableData: { mapId: 5000 + index, locationType: dungeon ? 7 : 0, dungeonType: dungeon ? 2 : -1, longitude: ll.x, latitude: ll.y },
      exterior: {
        buildings: dungeon ? [] : [tavern],
        recordElement: { header: { x: wc.x, y: wc.y } },
        exteriorData: { locationId: 0x500 + index, width: dungeon ? 0 : 1, height: dungeon ? 0 : 1, blockNames: dungeon ? [] : ['TOWNAA00.RMB'] },
      },
      dungeon: dungeon ? { blocks: [{ x: 0, z: 0, blockName: 'LAIRAA00.RDB' }] } : null,
    };
  });
  const region = { name: 'Testshire', locationCount: locations.length, mapTable: locations.map((l) => ({ ...l.mapTableData })) };
  return {
    maps: {
      regionCount: 1, getRegion: () => region, getLocation: (r, l) => locations[l] ?? null,
      getLocationByName: (rn, ln) => locations.find((l) => l.name === ln) ?? null,
      getRmbBlockName: (loc, x, y) => loc.exterior.exteriorData.blockNames[y * loc.exterior.exteriorData.width + x],
      readLocationIdFast: (r, l) => locations[l].exterior.exteriorData.locationId,
      getClimateIndex: () => 231,
    },
    getBlock: (name) => blocks[name] ?? null,
    currentLocation: () => locations[0], currentRegionIndex: () => 0, currentLocationIndex: () => 0, currentRegionName: () => 'Testshire',
    isPlayerInLocationRect: () => true, playerInside: () => null, isHouseOwned: () => false,
    playerPixel: () => ({ ...HOME }), buildingNameOpts: () => ({}),
    discoverLocation: () => {}, addNote: () => {},
  };
}

/** The distance of the site `placeLine` draws, for `n` seeds of the quest's roll, at `level`. */
function draws(world, placeLine, { level = 1, n = 40 } = {}) {
  const out = [];
  for (let seed = 1; seed <= n; seed++) {
    let s = seed * 7919;
    const rolls = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
    const m = new QuestMachine({ nowSeconds: () => 0, world, playerLevel: () => level });
    const q = m.scheduleQuest(['Quest: __NQ', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', placeLine, '', 'variable _pad_'], 0, { rolls });
    const sd = q.getResource({ name: 'site' }).siteDetails;
    out.push(Number(sd.locationName.replace(/^\D+/, '')));
  }
  return out;
}

test('NEARBY-QUESTS: the reach is ten pixels at level one and four more a level; on by default', () => {
  assert.equal(QUEST_REACH_BASE, 10); assert.equal(QUEST_REACH_PER_LEVEL, 4); assert.equal(QUEST_REACH_MIN_CHOICES, 3);
  assert.equal(questReachPixels(1), 10);
  assert.equal(questReachPixels(10), 46);
  assert.equal(questReachPixels(0), 10, 'an unanswered level is level one');
  assert.equal(questReachPixels(NaN), 10);
  assert.equal(PREF_DEFAULTS.nearbyQuests, true);
  assert.equal(mapPixelDistance({ x: 0, y: 0 }, { x: 3, y: -7 }), 7, 'the longest axis - the travel walk\'s');
});

test('NEARBY-QUESTS: the pool is the sites within reach; fewer than three, the nearest three; an unmeasured site leaves DFU\'s pool', () => {
  const at = (x) => { const ll = mapPixelToLongitudeLatitude(x, 100); return { longitude: ll.x, latitude: ll.y }; };
  const rd = { mapTable: [at(101), at(105), at(130), at(160), at(190), at(103)] };
  assert.deepEqual(nearbyIndices(rd, [0, 1, 2, 3, 4, 5], HOME, 10), [0, 1, 5], 'three within ten, in their own order');
  assert.deepEqual(nearbyIndices(rd, [2, 3, 4, 1], HOME, 10), [1, 2, 3], 'one within ten: the nearest three');
  assert.deepEqual(nearbyIndices(rd, [3, 4], HOME, 10), [3, 4], 'the region has only two: both');
  assert.deepEqual(mapTablePixel(rd.mapTable[2]), { x: 130, y: 100 });
  assert.deepEqual(nearbyIndices({ mapTable: [at(101), {}] }, [0, 1], HOME, 10), [0, 1], 'a crafted entry with no place');
});

test('NEARBY-QUESTS: a level-one quest\'s dungeon is within ten pixels, every draw - and off, the far ones come up', () => {
  const world = makeWorld([2, 6, 9, 40, 80, 120, 150].map((dx) => ({ kind: 'dungeon', dx })));
  QUEST_REACH_TUNING.override = null;
  try {
    const near = draws(world, 'Place _site_ remote dungeon');
    assert.ok(near.every((d) => d <= 10), `every draw within reach: ${near}`);
    assert.ok(new Set(near).size > 1, 'and still a draw among them, not always the nearest');
    QUEST_REACH_TUNING.override = false;
    const classic = draws(world, 'Place _site_ remote dungeon');
    assert.ok(classic.some((d) => d >= 40), `off: DFU's region-wide draw (${classic})`);
  } finally { QUEST_REACH_TUNING.override = null; }
});

test('NEARBY-QUESTS: the reach grows with level - level ten may draw a dungeon forty pixels out', () => {
  const world = makeWorld([2, 40, 44, 80, 120].map((dx) => ({ kind: 'dungeon', dx })));
  const l1 = draws(world, 'Place _site_ remote dungeon', { level: 1 });
  assert.ok(l1.every((d) => d <= 44), `level one: the nearest three (2, 40, 44 - only one within ten) - ${l1}`);
  assert.ok(l1.every((d) => d !== 80 && d !== 120));
  const l10 = draws(world, 'Place _site_ remote dungeon', { level: 10 });
  assert.ok(l10.every((d) => d <= 46) && l10.some((d) => d >= 40), `level ten: within 46 - ${l10}`);
});

test('NEARBY-QUESTS: a remote town is a near one; with none near enough, twice the reach; with none there either, the region', () => {
  const near = draws(makeWorld([3, 8, 60, 90].map((dx) => ({ kind: 'town', dx }))), 'Place _site_ remote tavern');
  assert.ok(near.every((d) => d === 3 || d === 8), `within ten - ${near}`);
  const doubled = draws(makeWorld([15, 60, 90].map((dx) => ({ kind: 'town', dx }))), 'Place _site_ remote tavern');
  assert.ok(doubled.every((d) => d === 15), `none within ten, one within twenty - ${doubled}`);
  const far = draws(makeWorld([60, 90].map((dx) => ({ kind: 'town', dx }))), 'Place _site_ remote tavern', { n: 10 });
  assert.ok(far.every((d) => d === 60 || d === 90), `none within twenty: DFU's darts still start the quest - ${far}`);
});

test('NEARBY-QUESTS: the player\'s own town is never the remote one, near or not', () => {
  const got = draws(makeWorld([5, 70].map((dx) => ({ kind: 'town', dx }))), 'Place _site_ remote tavern');
  assert.ok(got.every((d) => d === 5), `${got}`);
});
