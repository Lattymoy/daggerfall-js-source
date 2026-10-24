// L10N5 (2026-10-03): SAVES HOLD THE GAME'S OWN WORDS, AND EACH LANGUAGE READS ITS OWN AGAIN AFTER A LOAD. DFU saves
// what a translation replaced - a quest begun in French is saved in French and stays French in English (L10N3c recorded
// it as owed). The port saves the source and renders the language when the text is read:
//   - A QUEST'S MESSAGES (quest/message.js localize, quest/quest.js getMessage): a translation's lines are read in
//     place of the message's own, the own kept; the save holds the own; a language with no translation of a message
//     reads the own again - after a load, or at once on a switch.
//   - A QUEST'S DISPLAYNAME (quest.js localizeDisplayName, machine.js): the -LOC name stands over the quest's own, the
//     own is saved, and the machine names a restored quest in the current language.
import '../../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as tm from '../../../src/systems/textManager.js';
import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { Message } from '../../../src/systems/quest/message.js';
import { QUEST_DOCUMENT } from '../../../src/systems/quest/localizedQuest.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const V = join(ROOT, 'vendor/dfu-quests/Tables');
const tables = {};
for (const f of readdirSync(V)) if (f.endsWith('.txt')) tables[f.replace('.txt', '')] = readFileSync(join(V, f), 'utf8').replace(/^﻿/, '');
loadQuestTables(tables);
const questLines = (name) => readFileSync(join(ROOT, `vendor/dfu-quests/Quests/${name}.txt`), 'utf8').replace(/^﻿/, '').split(/\r?\n/);

const LOC = ['Quest: S0000977', 'DisplayName: La Malédiction de Daggerfall', 'QRC:', '',
  'RumorsDuringQuest:  [1005]', 'Des spectres errent dans les rues de Daggerfall.', '<--->', '<ce>   Le roi Lysandus hante sa capitale la nuit.', ''].join('\n');
const text = (msg) => msg.getTextTokens(0, false).map((t) => t.text).join('|');
const machine = () => new QuestMachine({ nowSeconds: () => 0, showPopup: () => {} });

beforeEach(() => {
  tm._resetTextManagerForTests();
  tm.setLocaleDocuments('fr', [[`${QUEST_DOCUMENT}:S0000977`, LOC]]);
});

test('L10N5 a quest\'s message: a translation read in place keeps the quest\'s own lines - the save holds the own, a language with no translation reads it again, and a message never translated saves as it always did', () => {
  const english = machine().scheduleQuest(questLines('S0000977'), 0, { rolls: () => 0 });
  const own = english.getMessage(1005).getSaveData();
  const enText = text(english.getMessage(1005));
  tm.setLocale('fr');
  const quest = machine().scheduleQuest(questLines('S0000977'), 0, { rolls: () => 0 });
  const msg = quest.getMessage(1005);
  assert.match(text(msg), /Des spectres errent/);
  assert.deepEqual(msg.getSaveData(), own, 'the save holds the quest\'s own lines, never the translation\'s');
  assert.match(text(quest.getMessage(1005)), /Des spectres errent/, 'asked again in French: the translation, read over the same Message');
  assert.deepEqual(quest.getMessage(1005).getSaveData(), own, 'and its own still kept beneath - read twice, never the translation taken for the own');
  tm.setLocale('en');
  assert.equal(text(quest.getMessage(1005)), enText, 'a switch to English: the quest\'s own words at once');
  assert.equal(quest.getMessage(1005).ownLines, null, 'nothing kept once the own stands');
  assert.deepEqual(quest.getMessage(1009).getSaveData(), english.getMessage(1009).getSaveData(), 'a message the translation lacks saves as it always did');

  const m = new Message(null, 7, ['one', '<ce>two']);
  m.localize(['un']);
  assert.deepEqual(m.getSaveData(), { id: 7, lines: ['one', '<ce>two'] });
  m.restoreSaveData({ id: 7, lines: ['three'] });
  assert.equal(m.ownLines, null, 'a restore is the message\'s own again');
  assert.deepEqual(m.getSaveData(), { id: 7, lines: ['three'] });
  m.ownText();
  assert.deepEqual(m.getSaveData(), { id: 7, lines: ['three'] }, 'nothing kept, nothing restored');
});

test('L10N5 a quest saved in French loads in each language\'s words: its own DisplayName and messages in the save, the machine naming it in the language of the load', () => {
  tm.setLocale('fr');
  const m = machine();
  const quest = m.scheduleQuest(questLines('S0000977'), 0, { rolls: () => 0 });
  m.tick?.();
  assert.equal(quest.displayName, 'La Malédiction de Daggerfall');
  quest.getMessage(1005);
  const saved = quest.getSaveData();
  assert.equal(saved.displayName, 'Curse of Daggerfall', 'the quest\'s own name in the save');
  quest.localizeDisplayName('La Malédiction de Daggerfall');
  assert.equal(quest.getSaveData().displayName, 'Curse of Daggerfall', 'named twice: the translation never taken for its own');
  quest.localizeDisplayName('');
  assert.equal(quest.displayName, 'Curse of Daggerfall', 'no translated name: its own');
  quest.localizeDisplayName('La Malédiction de Daggerfall');
  assert.match(saved.messages.find((x) => x.id === 1005).lines.join('\n'), /Ghosts are haunting the streets of Daggerfall/, 'its own words in the save');
  assert.doesNotMatch(JSON.stringify(saved), /spectres|Malédiction/, 'no French anywhere in the quest\'s save');

  const restoreIn = (code) => {
    tm.setLocale(code);
    const r = machine();
    r.restoreSaveData({ ...r.getSaveData(), quests: [saved] });
    return r.getQuest(saved.uid);
  };
  const en = restoreIn('en');
  assert.equal(en.displayName, 'Curse of Daggerfall');
  assert.match(text(en.getMessage(1005)), /Ghosts are haunting/);
  const fr = restoreIn('fr');
  assert.equal(fr.displayName, 'La Malédiction de Daggerfall', 'loaded in French: named in French again');
  assert.match(text(fr.getMessage(1005)), /Des spectres errent/);
  assert.equal(fr.getSaveData().displayName, 'Curse of Daggerfall', 'and saved again under its own');
});
