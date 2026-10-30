// QUEST-AUDIT IV (2026-10-30, bible/01-Overview/audits/Quest-Audit-IV.md; the owner: "audit the quest system in its
// entirety along with all the newly integrated quests to ensure no bugs exist"): THE STARTS AND THE MAIN QUEST'S
// BACKBONE, played on the real bridge and saved and loaded through its own snapshot and restore. START-1: a load while a
// start stands began the backbone (S0000999) early, and _BRISIEN a second one - every royal letter twice. START-2: a
// load a week past Lady Brisienna, its table the Curse and the backbone alone, was handed a second commission. Each
// start of START_QUESTS is played; the lair past the Bay is Skyrim's. Mutants: tools/mutants/questaudit4_starts.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { START_QUESTS, HAND_START_QUEST, BAY_START_QUEST, startOfSiteId } from '../../../src/systems/starts/starts.js';
import { createStartsHost } from '../../../src/scenes/startsHost.js';
import { createQuestBridge } from '../../../src/scenes/quest/questBridge.js';
import { resetUid } from '../../../src/systems/quest/quest.js';
import { SPINE, SPINE_OPENER, SPINE_CURSE } from '../../../src/systems/quest/mainSpine.js';
import { FACTION_TYPES } from '../../../src/formats/factionFile.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { PRIVATEERS_HOLD_MAP_ID } from '../../../src/world/dungeon/dungeonTextures.js';
import { ROOT, loadTables, questSource } from '../../qlSources.mjs';
import { town, dungeon, rmbBlock, worldOf, SPAWN, ITEM } from '../../fb1004dTowns.mjs';

const DAY = 86400;
const FLAT = (record, x, y, z) => ({ type: 3, position: record, xPos: x, yPos: y, zPos: z, resources: { flatResource: { textureArchive: 199, textureRecord: record } } });
const MARKERS = { position: 0, rdbBlock: { objectRootList: [{ rdbObjects: [FLAT(ITEM, 800, -40, 1200), FLAT(SPAWN, 200, -40, 300)] }] } };
const LAIR_MAP_ID = ((0x340 << 20) | 0x80000 | 12345) >>> 0;
const BLOCKS = new Map([['S0000999.RDB', MARKERS], ['N0000099.RDB', MARKERS], ['CITY.RMB', rmbBlock('CITY.RMB', [{ type: BUILDING_TYPES.Palace }])],
  ['INN.RMB', rmbBlock('INN.RMB', [{ type: BUILDING_TYPES.Tavern }])], ['FARM.RMB', rmbBlock('FARM.RMB', [{ type: BUILDING_TYPES.House1 }])]]);

/** The Bay (the Hold, Daggerfall, a tavern, a farm) and Skyrim's lair, through the real bridge. `S` is the save's world. */
function page(S) {
  loadTables();
  const hold = dungeon({ name: "Privateer's Hold", locationIndex: 0, mapId: PRIVATEERS_HOLD_MAP_ID, dungeonType: 0, block: 'S0000999.RDB' });
  hold.exterior.exteriorData.locationId = 0xc381;
  const city = town({ name: 'Daggerfall', locationIndex: 1, mapId: 1291010263, grid: ['CITY.RMB'] });
  city.exterior.exteriorData.locationId = 0xc36a;
  const inn = town({ name: 'Woodcroft Hall', locationIndex: 2, mapId: 5002, grid: ['INN.RMB'] });
  inn.exterior.buildings.push({ buildingType: BUILDING_TYPES.Tavern, factionId: 0, nameSeed: 100, quality: 10 });
  const farm = town({ name: 'Ashwick Farm', locationIndex: 3, mapId: 5003, grid: ['FARM.RMB'] });
  const lair = dungeon({ name: 'The Haunt of Baringon', locationIndex: 99, mapId: LAIR_MAP_ID, dungeonType: 8, block: 'N0000099.RDB', regionIndex: 64, regionName: 'Skyrim' });
  const list = [hold, city, inn, farm];
  const where = () => ({ hold, lair, city, farm })[S.at];
  const below = () => S.at === 'hold' || S.at === 'lair';
  const base = worldOf({ locations: list, blocks: BLOCKS });
  const world = {
    ...base,
    getFactionData: (id) => ({ ...base.getFactionData(id), type: FACTION_TYPES.Individual, rep: 0 }),
    currentLocation: where, playerInside: () => (below() ? { dungeon: true } : null), isPlayerInLocationRect: () => !below(),
    currentLocationIndex: () => list.indexOf(where()),
    discoverLocation: () => {}, mountCurrentSiteQuestResources: () => {},
    startSiteOfId: (id) => (startOfSiteId(id) ? lair : null),
  };
  return createQuestBridge({
    data: { readListTable: () => null, getQuestSourceLines: (n, on) => questSource(n, on ?? true) },
    world, classicSeconds: () => S.now, skySeconds: () => S.now, worldSeconds: () => S.now, raisedSeconds: () => 0,
    playerEntity: { get level() { return S.level; }, name: 'Tester', gender: 'male', items: null },
    isPlayerInTown: () => !below(), showPopup: () => {}, addHUDText: () => {},
    giveItemToPlayer: (it) => { S.pack.add(it); S.given.push(it); }, removeItemFromPlayer: (it) => S.pack.delete(it),
    carriesQuestItem: (r) => S.pack.has(r?.daggerfallUnityItem),
  }, { label: 'questaudit4' });
}
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
const fresh = (start) => {
  const S = { now: 1e6, level: 1, pack: new Set(), given: [], at: start === BAY_START_QUEST ? 'hold' : start === HAND_START_QUEST ? 'farm' : 'lair' };
  S.b = page(S);
  return S;
};
const tick = (S, n = 1, step = 60) => quiet(() => { for (let i = 0; i < n; i++) { S.now += step; S.b.tick(0.11); } });
/** Save and load on a fresh page, through the bridge's own snapshot and restore - a quest item in the pack its reloaded own. */
function reload(S) {
  const snap = JSON.parse(JSON.stringify(S.b.snapshot()));
  resetUid();
  S.b = page(S);
  quiet(() => S.b.restore(snap));
  const held = [...S.pack];
  S.pack.clear();
  for (const it of held) {
    const q = [...S.b.machine.quests.values()].find((x) => x.uid === it?.questUID);
    const r = q && [...q.resources.values()].find((x) => x.isItem && x.daggerfallUnityItem?.uid === it.uid);
    S.pack.add(r?.daggerfallUnityItem ?? it);
  }
}
const running = (S, name) => [...S.b.machine.quests.values()].filter((q) => q.questName === name && !q.questTombstoned && !q.questComplete).length;
const onTable = (S) => [...S.b.machine.quests.values()].map((q) => q.questName);
const quest = (S, name) => [...S.b.machine.quests.values()].find((q) => q.questName === name && !q.questTombstoned) ?? null;
const commission = (S, start) => quest(S, start).getItem({ name: 'commission' });

/** A start played to Daggerfall, saved and loaded at `at` (or never): how many backbones and openers ran on the way and after. */
function play(start, at) {
  const S = fresh(start);
  quiet(() => S.b.initAtGameStart(start));
  tick(S, 2);
  const early = [];
  const stage = (name) => {
    if (at === name) { reload(S); tick(S, 31); }   // past MAIN-SPINE's check (SPINE_CHECK_TICKS)
    early.push(running(S, SPINE));
  };
  stage('born');
  if (start !== HAND_START_QUEST) { const c = commission(S, start); c.setPlayerClicked(); S.pack.add(c.daggerfallUnityItem); tick(S, 2); }
  stage('found');
  commission(S, start).useClicked = true;
  tick(S, 2);
  stage('opened');
  S.at = 'farm';
  tick(S, 3);
  stage('road');
  S.at = 'city';
  tick(S, 48);
  return { S, early, spines: running(S, SPINE), openers: running(S, SPINE_OPENER), start: running(S, start), record: S.b.snapshot().machine.spine };
}

test('QUEST-AUDIT IV START-1 a save and load while a start stands - born, found, opened, on the road - begins no backbone early, and Daggerfall reached begins one opener and one backbone, every start of START_QUESTS (mutant: the standing start unread)', () => {
  for (const start of START_QUESTS) {
    for (const at of [null, 'born', 'found', 'opened', 'road']) {
      const r = play(start, at);
      const why = `${start}, loaded ${at ?? 'never'}`;
      assert.deepEqual(r.early, [0, 0, 0, 0], `${why}: no backbone before Daggerfall`);
      assert.equal(r.start, 0, `${why}: the start handed off`);
      assert.equal(r.openers, 1, `${why}: one _BRISIEN`);
      assert.equal(r.spines, 1, `${why}: one backbone`);
      assert.deepEqual(r.record, { opened: true, ran: true }, `${why}: the record true once the start has ended`);
    }
  }
});

test('QUEST-AUDIT IV START-1 a save the defect already wrote - the spine record "opened" while the start stands - is read as the opener still to come: no backbone until the hand-off (mutant: the saved record trusted over the table)', () => {
  const S = fresh(BAY_START_QUEST);
  quiet(() => S.b.initAtGameStart(BAY_START_QUEST));
  tick(S, 2);
  const snap = JSON.parse(JSON.stringify(S.b.snapshot()));
  snap.machine.spine = { opened: true, ran: false };   // what the old record wrote for every start in progress
  resetUid();
  S.b = page(S);
  quiet(() => S.b.restore(snap));
  tick(S, 31);
  assert.equal(running(S, SPINE), 0, 'no backbone while the start stands');
  assert.equal(S.b.machine.spine.opened, false, 'the record corrected');
});

test('QUEST-AUDIT IV START-2 a load a week past Lady Brisienna - the table the Curse and the backbone alone - hands no second commission and no second Curse, past the Bay and in the Bay; a load before the story began still hands the commission (mutants: the Curse unread; the backbone unread; the healing dropped)', () => {
  const host = (S) => createStartsHost({
    params: new URLSearchParams('classic=1'), pastBay: true, quests: () => ({ startSiteOfId: () => null, respawnLatched: async () => {} }),
    teleport: async () => {}, landReady: Promise.resolve(), talk: { say: () => {} }, machine: () => S.b.machine,
  });
  for (const start of [START_QUESTS.find((q) => q === '_STARTSK'), BAY_START_QUEST]) {
    const { S } = play(start, null);
    quest(S, SPINE_OPENER).startTask({ name: 'meetladyb' });   // her `clicked npc`
    tick(S, 3);
    S.now += 2 * DAY;
    tick(S, 3);
    S.now += 8 * DAY;   // past the tombstones' week
    tick(S, 3);
    assert.deepEqual(onTable(S).sort(), [SPINE_CURSE, SPINE].sort(), `${start}: the table a week on`);
    reload(S);
    assert.equal(host(S).restored(), true);
    tick(S, 3);
    assert.deepEqual(onTable(S).sort(), [SPINE_CURSE, SPINE].sort(), `${start}: nothing handed at the load`);
  }
  // a save made before any of the story began (no quest at all) is handed the commission, the Curse beside it
  const S = fresh(HAND_START_QUEST);
  reload(S);
  host(S).restored();
  assert.deepEqual(onTable(S), [SPINE_CURSE, HAND_START_QUEST]);
});

test('QUEST-AUDIT IV START-3 the world\'s load reads the save only once FACTION.TXT has landed - the boot reads it unawaited, and a quest\'s Person restores against it, so a cold restore dropped _BRISIEN and every quest with a Person (mutant: the await dropped)', () => {
  const W = readFileSync(`${ROOT}/src/scenes/world.js`, 'utf8');
  const load = W.slice(W.indexOf('async function worldQuickLoad('));
  const awaited = load.indexOf('await townTalk.ensureFactions?.();');
  assert.ok(awaited > 0, 'the load awaits the faction records');
  assert.ok(awaited < load.indexOf('restoreSessionState(extras'), 'before the quest machine is restored');
});
