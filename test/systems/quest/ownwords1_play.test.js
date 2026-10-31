// OWN-WORDS1 (2026-10-31, bible/06-Systems/Own-Words.md): a quest in our own words, played end to end. M0C00Y11 (the
// Fighters Guild's giant scorpion) is read as the game reads it - our file in place of DFU's (test/qlSources.mjs, the
// node twin of scenes/quest/questData.js) - and run through the real bridge and machine over the crafted world
// (test/guideWorld.mjs): the guild's offer, the answer, the journal, the kill, the questor's click and the quest's end.
// Every box the player sees is ours, every macro expanded, and the quest ends a success as DFU's script ends it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { makeWorld } from '../../guideWorld.mjs';
import { QUEST_FILES, loadTables } from '../../qlSources.mjs';
import { createQuestBridge } from '../../../src/scenes/quest/questBridge.js';
import { GUILD_GROUPS } from '../../../src/formats/factionFile.js';
import { quietLines } from '../../../src/ui/quest/questLens.js';

loadTables();
const NAME = 'M0C00Y11';
const quiet = (fn) => { const w = console.warn, i = console.info; console.warn = () => {}; console.info = () => {}; try { return fn(); } finally { console.warn = w; console.info = i; } };
const said = (tokens) => tokens.map((t) => t.text ?? '').filter(Boolean).join(' ');

function play() {
  const file = QUEST_FILES.get(NAME);
  const lines = readFileSync(file.path, 'utf8').split(/\r?\n/);
  const popups = [];
  const list = `schema: *name, group, membership, minReq, flag, notes\n${NAME}, FightersGuild, N, 0, 0, Passed`;
  const bridge = quiet(() => createQuestBridge({
    data: { readListTable: (n) => (n === 'Classic' ? list : null), getQuestSourceLines: (n) => (n === NAME ? lines : null) },
    world: makeWorld(),
    classicSeconds: () => 1000,
    playerEntity: { name: 'Hero', level: 3, gender: 'male' },
    getReputation: () => 0,
    dateTimeString: () => '13:30:00 on 4th of Morning Star, 3E405',
    midDateTimeString: () => '13:30:00 04 Morning Star 3E405',
    cityName: () => 'Bigtown',
    showPopup: (_q, tokens) => popups.push(said(tokens)),
  }));
  const ticks = (n) => quiet(() => { for (let i = 0; i < n; i++) bridge.machine.tick(); });
  return { file, bridge, popups, ticks };
}

test('OWN-WORDS1 the pack reads our M0C00Y11, and our file is DFU\'s quest in our words', () => {
  const { file } = play();
  assert.equal(file.dir, 'dfu', 'still DFU\'s quest');
  assert.equal(file.own, true);
  assert.match(file.path.replace(/\\/g, '/'), /src\/systems\/quest\/own\/M0C00Y11\.txt$/);
});

test('OWN-WORDS1 M0C00Y11 played end to end in our words: offer, answer, journal, kill, the questor\'s click, the end (mutants: the loader reading DFU\'s file; a message lost)', () => {
  const { bridge, popups, ticks } = play();
  const step = quiet(() => bridge.offerGuildQuest({ guildGroup: GUILD_GROUPS.FightersGuild, guild: { divine: '' }, membership: null, reputation: 0, buildingFactionId: 41 }));
  assert.equal(step.kind, 'offer');
  const offer = said(step.prompt.tokens);
  assert.match(offer, /^Call me \S.* Guild work is for members, but you look able, Hero\. A giant scorpion has to die\. Kill it, and I will tell the guild you are worth a look\. Will you do it\?$/);
  const answer = quiet(() => step.respond(true));
  assert.equal(answer.kind, 'accepted');
  assert.match(said(answer.popup.tokens), /^Good, Hero\. The scorpion got loose from a collector, and now it is shut in \S.*\. Kill it before the day ends and I will speak for you\.$/);
  ticks(5);
  const quest = [...bridge.machine.quests.values()].find((q) => q.questName === NAME);
  assert.ok(quest && !quest.questComplete, 'the quest is live');
  const entry = quiet(() => bridge.questLog({ windows: false })).active.find((r) => r.questName === NAME);
  const journal = quietLines(entry.messages[0]).join(' ').replace(/\s+/g, ' ');
  // the questor's home is the crafted world's Bigtown or, where its home rolls remote, Smallville (test/guideWorld.mjs)
  assert.match(journal, /The Fighters Guild in (Bigtown|Smallville) asked me to kill a giant scorpion trapped in \S.*\. I have one day\.$/);
  quest.getResource({ name: 'monster' }).incrementKills();
  ticks(3);
  quest.getResource({ name: 'qgiver' }).setPlayerClicked();
  ticks(6);
  assert.deepEqual(popups, [
    'You have killed the Giant Scorpion.',
    'The scorpion is dead and you are still standing. The guild will hear your name from me, and they will hear it kindly.',
  ]);
  assert.ok(quest.questComplete && quest.questSuccess, 'ended a success, as DFU\'s script ends it');
  for (const text of [offer, said(answer.popup.tokens), journal, ...popups]) {
    assert.doesNotMatch(text, /\[(undefined|unhandled|nullMCP|srcDataUnknown)\]|_\w+_|%\w+/, `every macro expanded: ${text}`);
    assert.doesNotMatch(text, /You can call me|You got guts|The Giant Scorpion is dead|weak-kneed jellyfish/, `none of DFU's words: ${text}`);
  }
});
