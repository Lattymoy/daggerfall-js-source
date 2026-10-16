// QUEST-VOID (2026-10-12, a player online: the Dust of Restful Death's mummy nowhere in Ruins of Old Barbara's Place;
// Mac: "the enemy is not marked on the map. i prob spawned the mob somewhere in the void"). The net under the dungeon's
// mount (quest/questRepair.js relayBuiltDungeon): a quest target on a marker the dungeon AS BUILT has not is laid again
// on that build before anything stands - whatever drift put it there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { Place, SITE_TYPES } from '../../../src/systems/quest/place.js';
import { relayBuiltDungeon } from '../../../src/systems/quest/questRepair.js';
import { RDB_RESOURCE_TYPES } from '../../../src/formats/blocksFile.js';
import { loadQuestTables } from '../../../src/systems/quest/tables.js';
{
  const dir = new URL('../../../vendor/dfu-quests/Tables/', import.meta.url);
  const sources = {};
  for (const f of readdirSync(dir)) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readFileSync(new URL(f, dir), 'utf8').replace(/^\uFEFF/, '');
  loadQuestTables(sources);
}

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const BARE_SRC = ['Quest: __QVD', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'variable _done_'];
const sym = (name) => ({ name, original: `_${name}_`, clone() { return sym(name); } });
const flat = (record, x) => ({ type: RDB_RESOURCE_TYPES.Flat, position: x, xPos: x, yPos: 0, zPos: 0, resources: { flatResource: { textureArchive: 199, textureRecord: record } } });
const NAMES = ['N0000001.RDB', 'N0000002.RDB', 'B0000001.RDB', 'B0000002.RDB', 'B0000003.RDB'];
/** A dungeon of `cells` ([blockName, x, z]) on map 4242. */
const dungeon = (cells) => ({ name: 'Ruins', regionIndex: 3, hasDungeon: true, mapTableData: { mapId: 4242 }, dungeon: { blocks: cells.map(([blockName, x, z]) => ({ blockName, x, z, isStartingBlock: false })) } });
const WHOLE = dungeon([['N0000001.RDB', 0, 0], ['N0000002.RDB', 1, 0], ['B0000001.RDB', 2, 0], ['B0000002.RDB', 0, 1], ['B0000003.RDB', 1, 1]]);
const SMALL = dungeon([['N0000001.RDB', 0, 0], ['B0000001.RDB', 0, -1]]);

function fixture() {
  const m = new QuestMachine();
  const q = m.parseQuestForLists(BARE_SRC, 0, { rolls: () => 0 });
  m.startQuestImmediate(q);
  // every block its own spawn marker, so a layout's markers name its blocks
  const blockData = Object.fromEntries(NAMES.map((name, i) => [name, { position: 1000 * (i + 1), rdbBlock: { objectRootList: [{ rdbObjects: [flat(11, i + 1)] }] } }]));
  const world = { getBlock: (n) => blockData[n] ?? null };
  q.hooks = { ...(q.hooks ?? {}), world };
  const crypt = new Place(q);
  crypt.symbol = sym('crypt');
  const whole = crypt._enumerateDungeonQuestMarkers(world, WHOLE);
  const copy = (list) => (list ?? []).map((k) => ({ ...k, flatPosition: { ...k.flatPosition }, targetResources: null }));
  /** The quest chose on the WHOLE layout: the mummy on its marker `at`. */
  const sit = (at) => {
    const spawn = copy(whole.questSpawnMarkers);
    crypt.siteDetails = { siteType: SITE_TYPES.Dungeon, mapId: 4242, regionIndex: 3, locationName: 'Ruins', buildingKey: 0, magicNumberIndex: 0,
      selectedMarker: { ...spawn[at], targetResources: [sym('mummy')] }, questSpawnMarkers: spawn, questItemMarkers: null };
  };
  crypt._range = () => 0;
  q.resources.set('crypt', crypt);
  q.resources.set('mummy', { symbol: sym('mummy'), isFoe: true, spawnCount: 1, killCount: 0, parentQuest: q, questResourceBehaviour: null });
  q.tasks.set('_go_', { actions: [{ typeName: 'PlaceFoe', foeSymbol: sym('mummy'), placeSymbol: sym('crypt'), marker: -1, isComplete: true }] });
  sit(1);
  m.createSiteLink(q, crypt.symbol);
  return { m, q, crypt, world, sit };
}
const ids = (list) => (list ?? []).map((k) => [k.dungeonX, k.dungeonZ, k.markerID]);

test('QUEST-VOID a target on a block the build has not: the Place laid again on the build, the foe stood on a marker it has; again nothing (mutants: the check skipped, the put-back skipped)', () => {
  const { m, crypt, world, sit } = fixture();
  sit(1);   // N0000002 at (1,0): the small build has no such block - the void
  assert.equal(relayBuiltDungeon(m, SMALL), 1);
  const built = ids(crypt._enumerateDungeonQuestMarkers(world, SMALL).questSpawnMarkers);
  assert.deepEqual(ids(crypt.siteDetails.questSpawnMarkers), built, 'the build\'s own markers');
  const sel = crypt.siteDetails.selectedMarker;
  assert.deepEqual(sel.targetResources.map((t) => t.name), ['mummy'], 'the mummy put back');
  assert.ok(built.some(([x, z, id]) => x === sel.dungeonX && z === sel.dungeonZ && id === sel.markerID), '...on a marker the build has');
  assert.equal(relayBuiltDungeon(m, SMALL), 0, 'again: nothing');
});

test('QUEST-VOID a target the build has is left where it is, whatever else differs; a finished quest, another map and a dead foe are not touched', () => {
  const { m, q, crypt, sit } = fixture();
  sit(0);   // N0000001 at (0,0): both layouts have it
  const before = crypt.siteDetails;
  assert.equal(relayBuiltDungeon(m, SMALL), 0);
  assert.equal(crypt.siteDetails, before, 'untouched - nothing a player could find moves');
  sit(1);
  assert.equal(relayBuiltDungeon(m, { ...SMALL, mapTableData: { mapId: 99 } }), 0, 'another dungeon\'s links');
  assert.equal(relayBuiltDungeon(m, WHOLE), 0, 'the layout it chose on');
  q.questComplete = true;
  assert.equal(relayBuiltDungeon(m, SMALL), 0, 'finished');
  q.questComplete = false;
  q.resources.get('mummy').killCount = 1;   // dead: the re-lay moves the Place, the put-back stands no corpse again
  assert.equal(relayBuiltDungeon(m, SMALL), 1);
  assert.equal(crypt.siteDetails.selectedMarker.targetResources, null, 'a dead foe stays dead');
});

test('QUEST-VOID wired: the dungeon mount re-lays on the built dungeon first, its own placements\' mount held back, through the bridge', () => {
  const wm = src('src/scenes/worldModes.js');
  const body = wm.slice(wm.indexOf('function mountQuestResources() {'), wm.indexOf('const dungeonSceneBehaviours'));
  const relay = body.indexOf('questBridge.relayBuiltDungeon?.(dungeonLoc, dungeonQuestAdapter.currentMapId())');
  assert.ok(relay > 0, 'the built location and the mount\'s key');
  assert.ok(relay < body.indexOf('questBridge.mountScene(dungeonQuestAdapter'), 'before the mount');
  assert.match(body, /if \(relayingBuilt\) return;/);
  assert.match(body, /finally \{ relayingBuilt = false; \}/);
  assert.match(src('src/scenes/quest/questBridge.js'), /relayBuiltDungeon\(location, mapId\) \{\n\s+return relayBuiltDungeon\(machine, location, \{ carriesQuestItem/);
});
