// RPT1026-MISC RUMOR-ORPHAN (a private report: an NPC asked for news told of a death with a quest's placeholders bare - its words,
// A0C01Y09's RumorsPostSuccess "_sister_ was found dead! And on the eve of %g3 wedding day too.", with every macro raw).
// A quest's tombstone files its post-quest rumor in the mill (Quest.cs:637-640, machine.js tombstoneQuest), and a week
// of the quest's clock later QuestMachine's removal drops the quest - leaving the rumor, whose telling asks for a quest
// the machine no longer holds: ExpandQuestMessage's null-parent bail (questMacros.js expandQuestMessage) hands the words
// over unexpanded. DFU sweeps such orphans only at its next load (RestoreConversationData, save.js
// removeOrphanedQuestRumors). Driven through the real machine and the real mill, wired as the world host wires them
// (world.js: addProgressRumor / removeProgressRumors into the mill, the telling's expandQuestTokens over getQuest).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { QuestMachine, QUEST_MESSAGES, SECONDS_PER_WEEK } from '../../../src/systems/quest/machine.js';
import { RumorMill, RUMOR_TYPE, tokensToString } from '../../../src/systems/rumorMill.js';
import { expandQuestMessage } from '../../../src/systems/quest/questMacros.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
const sources = {};
for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
loadQuestTables(sources);

const OUT_OF_NEWS = 'out of news';
/** The world host's wiring of the two: the machine's six rumor seams into the mill, the mill's telling over the machine. */
function rig() {
  const clock = { now: 0 };
  let machine = null;
  const mill = new RumorMill({
    rolls: () => 0, nowClassicMinutes: () => 0, questRumorWeight: 50,
    expandQuestTokens: (uid, tokens) => { expandQuestMessage(machine.getQuest(uid) ?? null, tokens, true); return tokensToString(tokens); },
    expandRandomTextRecord: () => OUT_OF_NEWS,
  });
  machine = new QuestMachine({
    nowSeconds: () => clock.now,
    addQuestRumor: (uid, m) => mill.addQuestRumorToRumorMill(uid, m),
    addProgressRumor: (uid, m) => mill.addOrReplaceQuestProgressRumor(uid, m),
    addQuestorPostMessage: (uid, m) => mill.addQuestorPostQuestMessage(uid, m),
    removeProgressRumors: (uid) => mill.removeQuestProgressRumorsFromRumorMill(uid),
    removeQuestorPostMessage: (uid) => mill.removeQuestorPostQuestMessage(uid),
    removeQuestRumors: (uid) => mill.removeQuestRumorsFromRumorMill(uid),
  });
  const news = () => mill.getNewsOrRumors({ numAnswersGivenTellMeAboutOrRumors: 0, isSpyMaster: false });
  return { clock, mill, machine, news };
}

test('RPT1026-MISC RUMOR-ORPHAN: a quest\'s post-quest rumor is told while its quest stands, and leaves the mill with it - never told raw after (mutant: rpt1026-misc-rumor-orphan-kept)', () => {
  const { clock, mill, machine, news } = rig();
  const q = machine.scheduleQuest([
    'Quest: __RO', 'QRC:',
    `Message:  ${QUEST_MESSAGES.RumorsPostSuccess}`, '_sister_ was found dead! And', ' on the eve of %g3 wedding day too.', '',
    'QBN:',
    ' end quest',
  ], 0, { rolls: () => 0 });
  q.questSuccess = true;
  for (let i = 0; i < 4; i++) machine.tick();
  assert.equal(q.questTombstoned, true, 'ended and tombstoned');
  assert.deepEqual(mill.listRumorMill.map((e) => [e.rumorType, e.questID]), [[RUMOR_TYPE.QuestProgressRumor, q.uid]], 'its post-quest rumor in the mill');
  assert.notEqual(news(), OUT_OF_NEWS, 'told while the quest stands');
  clock.now = SECONDS_PER_WEEK + 1;
  machine.tick();
  assert.equal(machine.getQuest(q.uid), null, 'a week on, the quest is removed');
  assert.deepEqual(mill.listRumorMill, [], 'and its rumor with it');
  const told = news();
  assert.equal(told, OUT_OF_NEWS, 'nothing of it is told');
  assert.doesNotMatch(told, /_sister_|%g3/, 'least of all its raw words');
});
