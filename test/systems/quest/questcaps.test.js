// QUEST-CAPS (2026-10-14, Dudey: "almost every quest has problems to spawn enemies inside dungeons ... Quest enemies
// being placed outside of the rooms and halls"): a re-laid dungeon (small, medium) enumerates its quest markers from
// its interior blocks alone while they hold any - its border blocks are caps drawn at random, their pockets sealed.
// The whole dungeon keeps DFU's enumeration. A quest already standing a target in a cap is laid again at the mount.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { Place, SITE_TYPES, questCapsSkipped, dungeonQuestSpawnSpots } from '../../../src/systems/quest/place.js';
import { relayBuiltDungeon } from '../../../src/systems/quest/questRepair.js';
import { RDB_RESOURCE_TYPES } from '../../../src/formats/blocksFile.js';
import { loadQuestTables } from '../../../src/systems/quest/tables.js';
{
  const dir = new URL('../../../vendor/dfu-quests/Tables/', import.meta.url);
  const sources = {};
  for (const f of readdirSync(dir)) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readFileSync(new URL(f, dir), 'utf8').replace(/^﻿/, '');
  loadQuestTables(sources);
}

const BARE_SRC = ['Quest: __QCP', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'variable _done_'];
const sym = (name) => ({ name, original: `_${name}_`, clone() { return sym(name); } });
const flat = (record, x) => ({ type: RDB_RESOURCE_TYPES.Flat, position: x, xPos: x, yPos: 0, zPos: 0, resources: { flatResource: { textureArchive: 199, textureRecord: record } } });
const NAMES = ['N0000001.RDB', 'B0000001.RDB', 'B0000002.RDB', 'B0000003.RDB', 'B0000004.RDB'];
const blockData = Object.fromEntries(NAMES.map((name, i) => [name, { position: 1000 * (i + 1), rdbBlock: { objectRootList: [{ rdbObjects: [flat(11, i + 1), flat(18, i + 10)] }] } }]));
const world = { getBlock: (n) => blockData[n] ?? null };
const plus = (mark) => ({ name: 'Ruins', regionIndex: 3, hasDungeon: true, mapTableData: { mapId: 4242 }, dungeon: { ...(mark ? { [mark]: true } : {}), blocks: [['N0000001.RDB', 0, 0], ['B0000001.RDB', 0, -1], ['B0000002.RDB', -1, 0], ['B0000003.RDB', 1, 0], ['B0000004.RDB', 0, 1]].map(([blockName, x, z], i) => ({ blockName, x, z, isStartingBlock: i === 0 })) } });
const blocksOf = (list) => [...new Set((list ?? []).map((m) => `${m.dungeonX},${m.dungeonZ}`))];

test('QUEST-CAPS a re-laid build enumerates its interior blocks alone; the whole dungeon every block (mutant: the skip removed)', () => {
  const p = new Place(null);
  p.symbol = sym('crypt');
  for (const mark of ['smaller', 'medium']) {
    assert.equal(questCapsSkipped(world, plus(mark)), true);
    const { questSpawnMarkers, questItemMarkers } = p._enumerateDungeonQuestMarkers(world, plus(mark));
    assert.deepEqual(blocksOf(questSpawnMarkers), ['0,0']);
    assert.deepEqual(blocksOf(questItemMarkers), ['0,0']);
  }
  assert.equal(questCapsSkipped(world, plus(null)), false);
  assert.equal(p._enumerateDungeonQuestMarkers(world, plus(null)).questSpawnMarkers.length, 5);
});

test('QUEST-CAPS an interior with no marker keeps every marker (never a dungeon with none)', () => {
  const bare = { ...blockData, 'N0000001.RDB': { position: 1000, rdbBlock: { objectRootList: [] } } };
  const w = { getBlock: (n) => bare[n] ?? null };
  assert.equal(questCapsSkipped(w, plus('medium')), false);
  const p = new Place(null);
  p.symbol = sym('crypt');
  assert.equal(p._enumerateDungeonQuestMarkers(w, plus('medium')).questSpawnMarkers.length, 4);
});

test('QUEST-CAPS a quest foe already on a cap marker is laid again on the interior at the mount', () => {
  const m = new QuestMachine();
  const q = m.parseQuestForLists(BARE_SRC, 0, { rolls: () => 0 });
  m.startQuestImmediate(q);
  q.hooks = { ...(q.hooks ?? {}), world };
  const crypt = new Place(q);
  crypt.symbol = sym('crypt');
  const whole = crypt._enumerateDungeonQuestMarkers(world, plus(null));   // the old enumeration, caps and all
  const spawn = whole.questSpawnMarkers.map((k) => ({ ...k, flatPosition: { ...k.flatPosition }, targetResources: null }));
  crypt.siteDetails = { siteType: SITE_TYPES.Dungeon, mapId: 4242, regionIndex: 3, locationName: 'Ruins', buildingKey: 0, magicNumberIndex: 0,
    selectedMarker: { ...spawn[2], targetResources: [sym('mummy')] }, questSpawnMarkers: spawn, questItemMarkers: null };
  crypt._range = () => 0;
  q.resources.set('crypt', crypt);
  q.resources.set('mummy', { symbol: sym('mummy'), isFoe: true, spawnCount: 1, killCount: 0, parentQuest: q, questResourceBehaviour: null });
  q.tasks.set('_go_', { actions: [{ typeName: 'PlaceFoe', foeSymbol: sym('mummy'), placeSymbol: sym('crypt'), marker: -1, isComplete: true }] });
  m.createSiteLink(q, crypt.symbol);
  assert.equal(relayBuiltDungeon(m, plus('medium')), 1);
  const sd = crypt.siteDetails;
  assert.deepEqual([sd.selectedMarker.dungeonX, sd.selectedMarker.dungeonZ], [0, 0]);
  assert.deepEqual(sd.selectedMarker.targetResources.map((s) => s.name), ['mummy']);
  assert.equal(relayBuiltDungeon(m, plus('medium')), 0);   // again: nothing
});

test('QUEST-CAPS the bounty lair stands in an interior block where one holds a spawn marker', () => {
  const b = (name, ox) => ({ name, originX: ox, originZ: 0, layout: { markers: [{ record: 11, x: 1, y: 0, z: 1 }] } });
  assert.deepEqual(dungeonQuestSpawnSpots([b('B0000001.RDB', 0), b('N0000001.RDB', 51.2)]), [[52.2, 0, 1]]);
  assert.equal(dungeonQuestSpawnSpots([b('B0000001.RDB', 0)]).length, 1);
});
