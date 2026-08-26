// AUDIT 25 B4: the ONE quest+talk quicksave composer.
//
// DFU saves quest and conversation state wherever the player stands -
// SaveLoadManager.cs:1113 (QuestMachine.GetSaveData) and :1119
// (TalkManager.GetConversationSaveData) fill every save, and
// :1433-1449 restore both, conversation after quest. The port grew
// that envelope inline in world.js alone, so an F9 pressed inside a
// dungeon wrote a snapshot with NEITHER slot and the load handed back
// an empty quest machine and rumor mill. The fix is one composer both
// hosts call; these pins hold its law and its call sites.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  composeSessionState, restoreSessionState, removeAllOrphanedItems, removeOrphanedItems,
  snapshotPlayer, restorePlayer,
} from '../src/systems/save.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const mkTrio = (log = []) => ({
  mill: {
    getSaveData: () => ({ listRumorMill: [1], dictQuestorPostQuestMessage: {} }),
    restoreSaveData: (d) => log.push(['mill', d]),
    removeOrphanedQuestRumors: (pred) => log.push(['sweep', pred]),
  },
  tree: { getSaveData: () => ({ dictQuestInfo: { 7: {} } }), restoreSaveData: (d) => log.push(['tree', d]) },
  session: { getSaveData: () => ({ npcsWithWork: [] }), restoreSaveData: (d) => log.push(['session', d]) },
});

test('composeSessionState: bridge + trio -> {quest, talk}; absent halves -> null', () => {
  const bridge = { snapshot: () => ({ machine: 'M' }), machine: { getQuest: () => null } };
  const full = composeSessionState({ questBridge: bridge, talk: mkTrio() });
  assert.deepEqual(full.quest, { machine: 'M' });
  // SaveDataConversation WHOLE - the three getSaveData halves merge flat
  assert.deepEqual(full.talk, { listRumorMill: [1], dictQuestorPostQuestMessage: {}, dictQuestInfo: { 7: {} }, npcsWithWork: [] });
  // the standalone ?dungeon scene mounts neither - the composer writes
  // nulls, byte-shape of every pre-B4 save. U41 added a THIRD half:
  // TravelMapSaveData rides the same composer (SaveLoadManager.cs:871)
  // and needs no seam passed in, because the travel map's session
  // state lives in systems/travelMapState.js.
  assert.deepEqual(composeSessionState({}), {
    quest: null,
    talk: null,
    travelMap: {
      filterDungeons: false, filterTemples: false, filterHomes: false, filterTowns: false,
      sleepInn: true, speedCautious: true, travelShip: true,
    },
  });
});

test('restoreSessionState: quest before conversation (the C# order), the mill orphan sweep asks the machine, and the return latches _questStarted', () => {
  const log = [];
  const live = new Set([11]);
  const bridge = { restore: (d) => log.push(['quest', d]), machine: { getQuest: (id) => (live.has(id) ? {} : null) } };
  const trio = mkTrio(log);
  const got = restoreSessionState({ quest: { q: 1 }, talk: { t: 1 } }, { questBridge: bridge, talk: trio });
  assert.equal(got, true);
  assert.deepEqual(log.map((e) => e[0]), ['quest', 'mill', 'tree', 'session', 'sweep']);   // conversation AFTER quest (:1442 comment's own order)
  const sweepPred = log[4][1];
  assert.equal(sweepPred(11), true);    // a live quest keeps its rumors
  assert.equal(sweepPred(99), false);   // an orphan is swept
  // the RECORDED null-arm departure: a pre-TK save leaves the live
  // session standing (DFU resets via RestoreConversationData(null),
  // TalkManager.cs:2440-2443 - world.js records the difference)
  const log2 = [];
  const got2 = restoreSessionState({ quest: null, talk: null }, { questBridge: { restore: (d) => log2.push(['quest', d]), machine: { getQuest: () => null } }, talk: mkTrio(log2) });
  assert.equal(got2, false);            // no quest envelope -> the latch stays down
  assert.deepEqual(log2, [['quest', null]]);   // restore(null) still runs (Q4-v: a no-op on the bridge side)
});

test('B4 seam gate: both quicksaving hosts run the composer, and the dungeon context is HANDED the bridge', () => {
  const world = read('src/scenes/world.js');
  const dungeonCtx = read('src/scenes/dungeonContext.js');
  const modes = read('src/scenes/worldModes.js');
  // two inline copies of the envelope is exactly how the halves
  // drifted - each host must call the ONE composer, both ways
  for (const src of [world, dungeonCtx]) {
    assert.match(src, /composeSessionState\(/);
    assert.match(src, /restoreSessionState\(/);
  }
  // and the world host must actually hand the dungeon context the
  // bridge + trio + latch when it builds one (a seam nobody mounts is
  // a ported law that evaporates silently - the standing lesson)
  assert.match(modes, /questBridge, talkSave,\s*\n\s*onQuestRestored: \(\) => \{ onQuestRestored\?\.\(\); mountQuestResources\(\); \},/);
  assert.match(world, /talkSave: \{ mill: rumorMill, tree: topicTree, session: npcSession \}/);
  assert.match(world, /onQuestRestored: \(\) => \{ _questStarted = true; \}/);
});

// --- The orphaned-item sweep (SaveLoadManager.cs:1518 -> :1556-1570 ->
// ItemCollection.RemoveOrphanedItems, Items/ItemCollection.cs:661-688).

const questItem = (uid, symbol) => ({ group: 'MiscItems', templateIndex: 1, questItem: true, questUID: uid, questSymbol: symbol });

test('RemoveOrphanedItems (ItemCollection.cs:661-688): a null OR tombstoned quest drops the item, across Items/WagonItems/OtherItems', () => {
  const quests = new Map([
    [11, { questTombstoned: false }],
    [22, { questTombstoned: true }],
  ]);
  const getQuest = (uid) => quests.get(uid) ?? null;
  const plain = { group: 'Weapons', templateIndex: 129, name: 'Short Bow' };
  const live = questItem(11, '_gem_');
  const entity = {
    items: [plain, live, questItem(22, '_urn_'), questItem(99, '_gone_')],
    wagonItems: [questItem(99, '_crate_'), plain],
    otherItems: [questItem(22, '_blade_')],
  };
  // one count over the three collections, C#'s own sum (:1560-1566)
  assert.equal(removeAllOrphanedItems(entity, getQuest), 4);
  assert.deepEqual(entity.items, [plain, live], 'the live quest keeps its item; a plain item is never touched');
  assert.deepEqual(entity.wagonItems, [plain]);
  assert.deepEqual(entity.otherItems, []);
  // nothing orphaned -> zero, and nothing moved
  assert.equal(removeAllOrphanedItems(entity, getQuest), 0);
  assert.deepEqual(entity.items, [plain, live]);

  // the two passes are C#'s: schedule, then remove. A splice inside
  // the scan would skip the item after each removal.
  const run = [questItem(99, 'a'), questItem(99, 'b'), questItem(99, 'c')];
  assert.equal(removeOrphanedItems(run, () => null), 3);
  assert.deepEqual(run, []);

  // no quest machine, no question to ask: DFU reaches
  // GameManager.Instance.QuestMachine, which always exists, so a host
  // that mounts none must not call every quest item an orphan.
  const noMachine = { items: [questItem(11, '_gem_')] };
  assert.equal(removeAllOrphanedItems(noMachine, null), 0);
  assert.equal(noMachine.items.length, 1);
});

test('the sweep runs at DFU:1518 - AFTER the quest machine has restored, so a live quest item survives the load', () => {
  // SaveLoadManager.LoadGame calls RemoveAllOrphanedItems at :1518,
  // past RestoreSaveData (which is where the quest machine and the
  // conversation come back, :1433-1449). The port's load is the same
  // two halves - restorePlayer, then restoreSessionState - so the
  // sweep is the last line of the second. Run any earlier and it reads
  // a machine with no quests in it yet and eats the whole pack.
  const machineQuests = new Map();
  const bridge = {
    restore: () => { machineQuests.set(11, { questTombstoned: false }); },   // the quests only exist AFTER this
    machine: { getQuest: (uid) => machineQuests.get(uid) ?? null },
  };
  const src = {
    stats: {}, items: [questItem(11, '_gem_'), questItem(77, '_lost_')],
    wagonItems: [], otherItems: [],
  };
  const snap = snapshotPlayer(src, { classicMinutes: 0 });
  const dst = {};
  const extras = restorePlayer(dst, snap);
  assert.equal(extras.entity, dst, 'the entity rides the extras - the port has no GameManager singleton (:1559)');
  assert.equal(dst.items.length, 2, 'restorePlayer itself sweeps nothing');

  restoreSessionState(extras, { questBridge: bridge });
  // quest 11 restored and is live -> its item stays; quest 77 never
  // reconstructed (machine.restoreSaveData catches PER QUEST and keeps
  // going) -> its item is gone.
  assert.deepEqual(dst.items.map((it) => it.questUID), [11]);
});
