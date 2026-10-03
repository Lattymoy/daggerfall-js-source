// L10N3c (2026-09-27): A QUEST IN A TRANSLATION'S OWN WORDS. Parser.ParseLocalized's law over a -LOC file (the
// DisplayName, fixed and numbered messages, an author's empty line kept as ' ', QBN ignored, and the throws where the
// C# throws); ParseLocalizedQuestText filling the language's Internal_Quests only where it has no entry; GetMessage
// reading the translation into the same Message every time it is asked (ReplaceMessage); ParseQuest's tail taking the
// -LOC DisplayName; English, with no -LOC file, reading the vendored source untouched; the offer list's label, by
// source. Over the real S0000977 (the Curse of Daggerfall) and a -LOC fixture written here - no pack's text is committed.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as tm from '../src/systems/textManager.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { parseLocalizedQuest, parseLocalizedQuestText, localizedQuestDisplayName, localizedQuestMessage, QUEST_DOCUMENT } from '../src/systems/quest/localizedQuest.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const V = join(ROOT, 'vendor/dfu-quests/Tables');
const tables = {};
for (const f of readdirSync(V)) if (f.endsWith('.txt')) tables[f.replace('.txt', '')] = readFileSync(join(V, f), 'utf8').replace(/^﻿/, '');
loadQuestTables(tables);
const questLines = (name) => rd(`vendor/dfu-quests/Quests/${name}.txt`).replace(/^﻿/, '').split(/\r?\n/);

beforeEach(() => tm._resetTextManagerForTests());

const LOC = [
  'Quest: S0000977',
  'DisplayName: La Malédiction de Daggerfall',
  '-- a comment',
  'QRC:',
  '',
  'QuestorOffer:  [1000]',
  '',
  'RumorsDuringQuest:  [1005]',
  'Des spectres errent dans les rues de Daggerfall.',
  '<--->',
  '<ce>   Le roi Lysandus hante sa capitale la nuit.',
  '',
  '<ce>   Nul ne sait pourquoi.',
  '',
  '-- a translator\'s note between the messages',
  '',
  'QuestorPostsuccess:  [1008]',
  'Vous avez vaincu le spectre, %pcn.',
  '',
  'QBN:',
  'Message:  1012',
  'ceci ne compte pas',
].join('\r\n');

test('L10N3c ParseLocalized\'s law: the DisplayName, a fixed message type by the table\'s id and a numbered one by its header, an author\'s empty line kept as \' \' where the next line is no header, the QBN ignored; and the throws where the C# throws', () => {
  const p = parseLocalizedQuest(LOC.split('\n'));
  assert.equal(p.displayName, 'La Malédiction de Daggerfall');
  assert.deepEqual([...p.messages.keys()], [1000, 1005, 1008]);
  assert.equal(p.messages.get(1000), '', 'an empty message');
  assert.equal(p.messages.get(1005), 'Des spectres errent dans les rues de Daggerfall.\n<--->\n<ce>   Le roi Lysandus hante sa capitale la nuit.\n \n<ce>   Nul ne sait pourquoi.', 'the empty line inside kept as a space - the next line was no header');
  assert.equal(p.messages.get(1008), 'Vous avez vaincu le spectre, %pcn.');
  assert.equal(parseLocalizedQuest([]), null);
  assert.throws(() => parseLocalizedQuest(['QRC:', 'Message:  onze', 'x']), /Could not parse localized quest message ID 'onze'/);
  assert.throws(() => parseLocalizedQuest(['QRC:', 'Message:  1011', 'a', '', 'Message:  1011', 'b']), /same key/);
  assert.throws(() => parseLocalizedQuest(['QRC:', 'une ligne: avec: deux points']), /SplitField/, 'a stray line of two colons in QRC');
});

test('L10N3c the quest in French: GetMessage reads the -LOC message into the same Message every time it is asked; a message the file lacks keeps its own source; ParseQuest takes the -LOC DisplayName; the table is filled only where it has no entry; English reads the vendored source untouched', () => {
  const english = new QuestMachine({ nowSeconds: () => 0, showPopup: () => {} }).scheduleQuest(questLines('S0000977'), 0, { rolls: () => 0 });
  const enRumor = english.getMessage(1005).getTextTokens(0, false).map((t) => t.text).join('|');
  assert.equal(english.displayName, 'Curse of Daggerfall');
  assert.match(enRumor, /Ghosts are haunting the streets of Daggerfall/);
  tm.setLocaleDocuments('fr', [[`${QUEST_DOCUMENT}:S0000977`, LOC]]);
  tm.patchLocaleTable('fr', 'Internal_Quests', [['S0000977.1008', 'Le spectre est tombé. (une ligne du tableau)']]);
  tm.setLocale('fr');
  const m = new QuestMachine({ nowSeconds: () => 0, showPopup: () => {} });
  const quest = m.scheduleQuest(questLines('S0000977'), 0, { rolls: () => 0 });
  assert.equal(quest.displayName, 'La Malédiction de Daggerfall', 'ParseQuest\'s tail');
  const msg = quest.getMessage(1005);
  assert.equal(msg.variantCount, 2);
  assert.match(msg.getTextTokens(0, false).map((t) => t.text).join('|'), /Des spectres errent/);
  assert.equal(quest.getMessage(1005), msg, 'the same Message, re-read (ReplaceMessage)');
  assert.equal(quest.getMessage(1008).getTextTokens(0, false).map((t) => t.text).join(''), 'Le spectre est tombé. (une ligne du tableau)', 'a table row already there is not replaced by the file (AddEntry only where GetEntry found none)');
  assert.equal(localizedQuestMessage('S0000977', 1012), null, 'the QBN\'s "message" is no message');
  const own = 1009;   // QuestorPostfailure: the fixture has none
  assert.equal(localizedQuestMessage('S0000977', own), null);
  assert.equal(quest.getMessage(1011), null, 'a message the quest has not: null, as DFU\'s GetMessage answers');
  const before = quest.messages.get(own).getTextTokens(0, false).map((t) => t.text).join('|');
  assert.equal(quest.getMessage(own).getTextTokens(0, false).map((t) => t.text).join('|'), before, 'a message the file lacks keeps its own source');
  assert.equal(localizedQuestDisplayName('s0000977.txt'), 'La Malédiction de Daggerfall', 'the quest named as a file, any case');
  tm.setLocale('en');
  assert.equal(localizedQuestDisplayName('S0000977'), '', 'English: no -LOC file');
  const again = new QuestMachine({ nowSeconds: () => 0, showPopup: () => {} }).scheduleQuest(questLines('S0000977'), 0, { rolls: () => 0 });
  assert.equal(again.displayName, 'Curse of Daggerfall');
  assert.equal(again.getMessage(1005).getTextTokens(0, false).map((t) => t.text).join('|'), enRumor, 'English: the vendored source, byte for byte');
});

test('L10N3c a -LOC file that will not do is said and read as none - no DisplayName, no message, a parse that throws - and a forgotten language parses again', () => {
  const said = [];
  const was = console.error;
  console.error = (m) => said.push(String(m));
  try {
    tm.setLocale('de');
    tm.setLocaleDocuments('de', [[`${QUEST_DOCUMENT}:A`, 'Quest: A\nQRC:\nMessage:  1\nhallo\n'], [`${QUEST_DOCUMENT}:B`, 'Quest: B\nDisplayName: B\nQRC:\n'], [`${QUEST_DOCUMENT}:C`, 'Quest: C\nDisplayName: C\nQRC:\nMessage:  x\ny\n']]);
    for (const q of ['A', 'B', 'C']) assert.equal(parseLocalizedQuestText(q), null, q);
    assert.match(said.join('\n'), /'A-LOC\.txt' has a null or empty DisplayName/);
    assert.match(said.join('\n'), /'B-LOC\.txt' parsed no valid messages/);
    assert.match(said.join('\n'), /Parsing localized quest `C-LOC\.txt` FAILED!/);
    assert.equal(localizedQuestMessage('A', 1), null, 'nothing reached the table');
    tm.setLocaleDocuments('de', [[`${QUEST_DOCUMENT}:A`, 'Quest: A\nDisplayName: Ein Auftrag\nQRC:\nMessage:  1\nhallo\n']]);
    assert.equal(localizedQuestDisplayName('A'), 'Ein Auftrag', 'new documents: parsed afresh (the text revision moved)');
    assert.deepEqual(localizedQuestMessage('A', 1), ['hallo']);
    tm.clearLocaleTables('de');
    assert.equal(localizedQuestMessage('A', 1), null, 'the language forgotten: its table and its document gone');
  } finally { console.error = was; }
});

test('L10N3c by source: both parse doors take the -LOC DisplayName, GetMessage asks the table, and the offer list\'s label is wired to it', () => {
  const machine = rd('src/systems/quest/machine.js');
  assert.match(machine, /localizeDisplayName\(quest\);   \/\/ L10N3c\n\s+this\.questsToInvoke\.push\(quest\);/, 'scheduleQuest');
  assert.match(machine, /return localizeDisplayName\(this\.parser\.parse\(lines, factionId,/, 'parseQuestForLists');
  assert.match(rd('src/systems/quest/quest.js'), /const lines = localizedQuestMessage\(this\.questName, messageID\);\n\s+if \(lines\) result\.loadMessage\(messageID, lines\);/);
  assert.match(rd('src/scenes/questBridge.js'), /getLocalizedQuestDisplayName: \(questName\) => localizedQuestDisplayName\(questName\),/);
});
