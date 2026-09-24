// QUEST-UID1 (2026-09-24, found tracing the "two letters from the queen" report; Mac: "Go ahead and tackle your
// reported weaknesses").
//
// THE WEAKNESS: QuestMachine.StartQuest ends in `quests.Add(quest.UID, quest)` (QuestMachine.cs:725), a Dictionary.Add
// that THROWS on a UID already live - and the port's `quests.set` replaced it in silence. The door it came through is
// the port's own: a quickload runs from under ANY window (FIX-E - the death screen's F11), a quest offer popup among
// them, and the offer flow kept the quest it had parsed in the game being replaced. Answering Yes after the load
// started that quest in the loaded game, and if its UID matched a restored quest's, the restored quest was
// overwritten with no word - a quest that vanished. DFU cannot reach this: its load window and its quickload key
// both stand on the HUD, so no offer outlives the game it was parsed in.
//
// Driven through the real bridge over the vendored quests: the offer, the restore a quickload runs, the answer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QUESTS = join(ROOT, 'vendor/dfu-quests/Quests');
const TABLES = join(ROOT, 'vendor/dfu-quests/Tables');

async function bridge() {
  const { createQuestBridge } = await import('../src/scenes/questBridge.js');
  const { loadQuestTables } = await import('../src/systems/quest/tables.js');
  const sources = {};
  for (const f of readdirSync(TABLES)) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readFileSync(join(TABLES, f), 'utf8').replace(/^﻿/, '');
  loadQuestTables(sources);
  const started = [];
  const b = createQuestBridge({
    data: {
      readListTable: (n) => (existsSync(join(TABLES, `${n}.txt`)) ? readFileSync(join(TABLES, `${n}.txt`), 'utf8') : ''),
      getQuestSourceLines: (n) => {
        const f = join(QUESTS, `${n}.txt`);
        return existsSync(f) ? readFileSync(f, 'utf8').replace(/^﻿/, '').split(/\r?\n/) : null;
      },
    },
    world: null,
    classicSeconds: () => 0,
    playerEntity: { level: 1, name: 'Tester' },
    onQuestStarted: (q) => started.push(q.questName),
  });
  return { b, started };
}
const live = (b) => [...b.machine.quests.values()].map((q) => [q.uid, q.questName]).sort((a, c) => a[0] - c[0]);

test('QUEST-UID1: an offer parsed before a quickload is not the loaded game\'s - answering Yes starts nothing and overwrites nothing', async () => {
  const { b } = await bridge();
  b.initAtGameStart();
  const warn = console.warn; console.warn = () => {};
  let offer;
  try { offer = b.offerDaedricQuest('00B00Y00', 0); } finally { console.warn = warn; }
  assert.equal(offer?.kind, 'offer', 'a named quest is offered - its popup is up');
  const offered = b.offerFlow.offeredQuest;
  // the save being loaded holds a quest under THE SAME UID the offer drew - the collision the old code lost a quest to
  const snap = b.snapshot();
  const restored = snap.machine.quests[0];
  snap.machine.quests = [{ ...restored, uid: offered.uid }];
  // the quickload: from under the popup, as FIX-E lets it
  b.restore(snap);
  const before = live(b);
  assert.deepEqual(before, [[offered.uid, restored.questName]], 'the loaded game holds its own quest under that UID');
  const answer = offer.respond(true);
  assert.equal(answer.kind, 'close', 'the popup closes: the offer went with the game it was parsed in');
  assert.deepEqual(live(b), before, 'the restored quest stands - the old code replaced it with the offered one');
});

test('QUEST-UID1: StartQuest refuses a UID already live, as Dictionary.Add does (QuestMachine.cs:725) - the live quest stands', async () => {
  const { b } = await bridge();
  b.initAtGameStart();
  const [first] = [...b.machine.quests.values()];
  const warn = console.warn; console.warn = () => {};
  let twin;
  try { twin = b.machine.parseQuestForLists(readFileSync(join(QUESTS, '00B00Y00.txt'), 'utf8').replace(/^﻿/, '').split(/\r?\n/)); } finally { console.warn = warn; }
  assert.ok(twin);
  twin.uid = first.uid;
  assert.throws(() => b.machine.startQuestImmediate(twin), /same key has already been added/, 'the same refusal, in the same words, restoreSaveData makes');
  assert.equal(b.machine.getQuest(first.uid), first, 'the quest on the table is the one that was there');
});

test('QUEST-UID1: a load discards the guild picker\'s pool too - a pick after the load finds nothing to offer', async () => {
  const { b } = await bridge();
  b.offerFlow.questPool = ['00B00Y00'];
  b.restore(b.snapshot());
  assert.equal(b.offerFlow.questPool, null);
  assert.equal(b.offerFlow._questPicked(0), null, 'no pool, no pick - and no throw');
});
