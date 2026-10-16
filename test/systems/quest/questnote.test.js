// QUEST-NOTE (2026-10-13, a player on the DFO Discord: "Would it be possible to implement kill/quest notifications? I just
// got done doing 'A Dangerous Wizard' questline and killed the mage in question, but DFO never popped up saying the mage
// was killed"): a quest's foe fallen is told by the port itself (the HUD strip's row, a chat line), and a quest's box is
// not closed by the press already on its way when it comes up. bible/06-Systems/Quest-Arc.md QUEST-NOTE.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { ServiceFlowWindow } from '../../../src/ui/guildServiceWindows.js';
import { LevelNotices, NOTICE_QUEST, questSlainTitle, ANNOUNCE_MS, announceQuestFoeSlain } from '../../../src/ui/levelUp/levelNotice.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const VENDOR = join(ROOT, 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  loadQuestTables(sources);
}

test('QUEST-NOTE: a quest\'s foe fallen tells the host - the quest, the foe, its count - each kill, through the machine\'s hook (mutants: the hook never called)', () => {
  const told = [];
  const m = new QuestMachine({ nowSeconds: () => 0, playerLevel: () => 1, questFoeKilled: (q, foe, n) => told.push([q.questName, foe.symbol.name, foe.killCount, n]) });
  const q = m.scheduleQuest(['Quest: __QN', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Foe _monster_ is Mage', '', ' log 1011 step 0'], 0, { rolls: () => 0.5 });
  m.tick();
  const foe = q.getResource({ name: 'monster' });
  foe.incrementKills();
  assert.deepEqual(told, [['__QN', 'monster', 1, 1]]);
});

test('QUEST-NOTE: a quest box ignores a press for its grace after it comes up, then closes as DFU\'s does; no grace, at once (mutants: the grace never read; the click let through)', () => {
  const realNow = performance.now;
  let now = 1000;
  performance.now = () => now;
  try {
    const w = new ServiceFlowWindow([{ rows: ['You have slain the Mad Wizard.'] }], { graceMs: 600 });
    w.click(10, 10);
    w.input('KeyW');
    assert.equal(w.done, false, 'the swing and the step that raised it do not close it');
    now += 650;
    w.click(10, 10);
    assert.equal(w.done, true, 'read, it closes on a press');
    const plain = new ServiceFlowWindow([{ rows: ['x'] }]);
    plain.input('Space');
    assert.equal(plain.done, true, 'no grace: DFU\'s own box');
  } finally { performance.now = realNow; }
});

test('QUEST-NOTE: the notice - "Quest target slain", who, the count where there are several, the quest; news that goes; the classic skin\'s line', () => {
  const q = new LevelNotices();
  q.announceQuest('1|monster', questSlainTitle(), 'Mage · A Dangerous Wizard', 0);
  const [row] = q.frame(0);
  assert.deepEqual([row.kind, row.title, row.sub], [NOTICE_QUEST, 'Quest target slain', 'Mage · A Dangerous Wizard']);
  assert.equal(q.frame(ANNOUNCE_MS).length, 0);
  const said = [];
  announceQuestFoeSlain({ who: 'Rat', quest: 'Vermin', done: 2, of: 5 }, { say: (t) => said.push(t), doc: null });
  assert.deepEqual(said, ['Rat slain (2/5). (Vermin)']);
});
