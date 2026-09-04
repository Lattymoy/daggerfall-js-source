// AUDIT 24, wave 25: the five findings the seven-slice adversarial
// sweep confirmed after 151 agents.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { expandQuestMessage } from '../src/systems/quest/questMacros.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
const sources = {};
for (const f of readdirSync(join(VENDOR, 'Tables'))) {
  if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readFileSync(join(VENDOR, 'Tables', f), 'utf8').replace(/^﻿/, '');
}
loadQuestTables(sources);
const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

// A quest with a questor Person, so ActiveQuestor has something to find.
const QUESTOR_SRC = [
  'Quest: __QSTR', 'QRC:', 'Message:  1011', ' x', '',
  'QBN:',
  'Person _qgiver_ face 1 factionType Merchant',
  '',
  '_start_ task:',
  ' hide npc _qgiver_',
];

test('audit24 wave25: StartQuest assigns the questor behaviour to the last-clicked NPC', () => {
  // QuestMachine.cs:729-734 - "Assign QuestResourceBehaviour to
  // questor NPC - this will be last NPC clicked. This will ensure
  // quests actions like 'hide npc' will operate on questor at quest
  // startup". The port waved the tail off as "scene work (Q3)" and
  // never came back for it, so the questor you just took a quest from
  // carried no behaviour until the next layout.
  const m = new QuestMachine({ nowSeconds: () => 0 });
  const host = {};
  const npcData = { hash: 4242, mapID: 1, nameSeed: 7, buildingKey: 9 };
  m.setLastNPCClicked(npcData, host);
  assert.equal(m.lastNPCClickedHost, host, 'the host rides with the click');

  const quest = m.parseQuestForLists(QUESTOR_SRC, 0, { rolls: () => 0 });
  const person = quest.getResource({ name: 'qgiver' });
  quest.addQuestor(person.symbol);
  person.questorData = { ...npcData };

  m.startQuestImmediate(quest);
  assert.ok(host.questBehaviour, 'the clicked NPC now carries a behaviour');
  assert.equal(host.questBehaviour.targetResource, person, 'pointed at the questor Person');
  // C# does NOT write the back-link here - AssignResource only sets
  // questUID/targetSymbol (QuestResourceBehaviour.cs:217-224). The
  // link is filled by the first Update (:135-138), which is where the
  // port fills it too.
  assert.equal(person.questResourceBehaviour, null, 'not at assign time');
  host.questBehaviour.update();
  assert.equal(person.questResourceBehaviour, host.questBehaviour,
    'the first Update couples them, as C# does');
});

test('audit24 wave25: only the QUESTOR gets one, and only once', () => {
  const m = new QuestMachine({ nowSeconds: () => 0 });
  // a click on somebody who is nobody's questor
  const stranger = {};
  m.setLastNPCClicked({ hash: 1, mapID: 0, nameSeed: 0, buildingKey: 0 }, stranger);
  const q1 = m.parseQuestForLists(QUESTOR_SRC, 0, { rolls: () => 0 });
  const p1 = q1.getResource({ name: 'qgiver' });
  q1.addQuestor(p1.symbol);
  p1.questorData = { hash: 999, mapID: 0, nameSeed: 0, buildingKey: 0 };
  m.startQuestImmediate(q1);
  assert.equal(stranger.questBehaviour, undefined, 'no match, no behaviour');

  // "Can only have a single QuestResourceBehaviour"
  const host = { questBehaviour: 'ALREADY HERE' };
  const npcData = { hash: 55, mapID: 0, nameSeed: 0, buildingKey: 0 };
  m.setLastNPCClicked(npcData, host);
  const q2 = m.parseQuestForLists(QUESTOR_SRC, 0, { rolls: () => 0 });
  const p2 = q2.getResource({ name: 'qgiver' });
  q2.addQuestor(p2.symbol);
  p2.questorData = { ...npcData };
  m.startQuestImmediate(q2);
  assert.equal(host.questBehaviour, 'ALREADY HERE', 'the existing one is left alone');

  // a never-clicked machine does nothing at all
  const m2 = new QuestMachine({ nowSeconds: () => 0 });
  const q3 = m2.parseQuestForLists(QUESTOR_SRC, 0, { rolls: () => 0 });
  assert.doesNotThrow(() => m2.startQuestImmediate(q3));
});

test("audit24 wave25: ActiveQuestor keeps C#'s LAST-quest-wins overwrite", () => {
  // The inner loop breaks on a match; the OUTER one does not. Two
  // quests with the same questor NPC and the later iteration wins.
  const m = new QuestMachine({ nowSeconds: () => 0 });
  const npcData = { hash: 77, mapID: 0, nameSeed: 0, buildingKey: 0 };
  const mk = () => {
    const q = m.parseQuestForLists(QUESTOR_SRC, 0, { rolls: () => 0 });
    const p = q.getResource({ name: 'qgiver' });
    q.addQuestor(p.symbol);
    p.questorData = { ...npcData };
    m.quests.set(q.uid, q);
    return p;
  };
  const first = mk();
  const second = mk();
  assert.notEqual(first, second);
  assert.equal(m.activeQuestor(npcData), second,
    'the LAST quest in iteration order wins, not the first match');
  assert.equal(m.activeQuestor({ hash: 1, mapID: 0, nameSeed: 0, buildingKey: 0 }), null);
});

test('audit24 wave25: a quest rumor is expanded IN PLACE, and so frozen at its first telling', () => {
  // TalkManager.cs:1425-1431 passes the mill's OWN stored variant by
  // ref, and QuestMacroHelper.cs:158 writes each expansion back into
  // it. So the second telling of a quest rumor shows the first
  // telling's wording. The port cloned first, which re-expanded from
  // source every time - the port being more correct than the game.
  const src = rd('src/scenes/world.js');
  const i = src.indexOf('const expandQuestTokens = (questID, tokens) => {');
  assert.ok(i > 0);
  const fn = src.slice(i, src.indexOf('\n  };', i));
  assert.match(fn, /expandQuestMessage\(questBridge\?\.machine\.getQuest\(questID\) \?\? null, tokens, true\);/);
  assert.match(fn, /return tokensToString\(tokens\);/);
  assert.doesNotMatch(fn, /tokens\.map\(\(t\) => \(\{ \.\.\.t \}\)\)/, 'no defensive clone');
  // C# calls ExpandQuestMessage whether or not GetQuest found
  // anything - the null-parent bail is inside the helper, not a
  // caller guard.
  assert.doesNotMatch(fn, /if \(quest\)/, 'and no caller-side null guard');

  // the mutation is real: expandQuestMessage writes token.text back
  const tokens = [{ formatting: 'text', text: 'the %qdt of it' }];
  expandQuestMessage(null, tokens, true);
  assert.equal(tokens.length, 1, 'the same array');
});

test('audit24 wave25: the factionListener comments name PlayerActivate, and claim nothing pending', () => {
  // HasFactionListener has exactly one consumer in the DFU tree -
  // PlayerActivate.StaticNPCClick:1534 - and TalkManager.cs does not
  // contain the word Listener. Three port comments named TalkManager
  // and marked the wiring "(Q4 wires)", over a reader that ships at
  // worldModes.js:452.
  const m = rd('src/systems/quest/machine.js');
  assert.doesNotMatch(m, /TalkManager reads the map/);
  assert.doesNotMatch(m, /TalkManager's Q4 signal/);
  assert.match(m, /PlayerActivate\.StaticNPCClick reads the map/);
  assert.match(m, /src\/scenes\/worldModes\.js:452/);
  assert.doesNotMatch(rd('bible/06-Systems/Quest-Arc.md').slice(0, 40000), /TalkManager reads the map at\n  Q4/);
  // and the reader really is there
  assert.match(rd('src/scenes/worldModes.js'), /factionListeners\.has\(pn\.factionID\)\) return;/);
});

test('audit24 wave25: the two stale claims in the macro header are gone', () => {
  // questMacros.js's header asserted "only %G has a capitalized
  // handler" and that the corpus's %G3/%G1 lines render
  // "%G3[undefined]" - which the same audit refuted forty lines below,
  // where all six capitalized forms are registered.
  const s = rd('src/systems/quest/questMacros.js');
  const header = s.slice(0, s.indexOf('import '));
  assert.doesNotMatch(header, /only %G\s*\n?\/\/ has a capitalized handler/);
  assert.doesNotMatch(header, /`%G3` and 1 `%G1` lines really do render/);
  for (const k of ['%G1', '%G2', '%G2self', '%G3', '%G4']) {
    assert.ok(s.includes(`'${k}': (mcp) => cap(`), `${k} has a capitalized handler`);
  }
});

test("audit24 wave25: the quest-flat click keeps DoClick's answer", () => {
  // PlayerActivate keeps the bool: the quest-resource arm (:326-339)
  // falls through to the building/door checks either way, and
  // StaticNPCClick (:1525-1528) returns only when it answered TRUE.
  const s = rd('src/scenes/worldModes.js');
  assert.match(s, /const foundInActiveQuest = s\.behaviour\?\.doClick\(\) \?\? false;/);
  assert.doesNotMatch(s, /^\s+s\.behaviour\?\.doClick\(\);$/m, 'and does not throw it away');
});
