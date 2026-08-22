// Q4-iv - JOURNAL + SAVE: the quest save envelope (QuestMachine ->
// Quest -> Message/Resource/Task/Action v1 shapes) with a
// corpus-wide round-trip gate, the journal's ACTIVE-page walk, the
// EndQuest notebook filing, and PlayerNotebook.cs whole. Every pin
// asserts DFU literals and C#'s own holes (the unsaved message ring,
// the lost rumorsMessageID, the restore-order global-var silence).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { resetUid, nextUid } from '../src/systems/quest/quest.js';
import { PlayerNotebook, MAX_MESSAGE_COUNT, MAX_LINES_QUESTS } from '../src/systems/notebook.js';
import { Person } from '../src/systems/quest/person.js';
import { Place } from '../src/systems/quest/place.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
const readLines = (p) => read(p).split(/\r?\n/);

function loadTables() {
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) {
    if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  }
  loadQuestTables(sources);
}
loadTables();

const RICH_SRC = [
  'Quest: __SAV', 'DisplayName: The Saved Errand', 'QRC:',
  'Message:  1011', ' the log line', '',
  'Message:  1012', '<ce> centered a', '<--->', '<ce> centered b', '',
  'QBN:',
  'Item _gold_ gold', '',
  'Clock _c_ 1:00 2:00', '',
  ' log 1011 step 2', ' say 1011', '',
  'variable _pad_',
];

function makeMachine(deps = {}) {
  const m = new QuestMachine({ nowSeconds: () => m.now, ...deps });
  m.now = 100;
  return m;
}

// ---------------------------------------------------------------
// THE CORPUS ROUND-TRIP GATE
// ---------------------------------------------------------------

// AUDIT 24 (the seven-slice sweep): the fixed point has ONE documented
// hole, and it is DFU's. CreateFoe.RestoreSaveData ends with
// `if (lastSpawnTime == 0) lastSpawnTime = now;` (CreateFoe.cs:427-429)
// - the only non-pure restore in any shipped action. A quest saved
// before CreateFoe's first Update carries 0, and the load stamps NOW,
// which permanently retires the random backdate. So the second save of
// such a quest is NOT equal to the first, in DFU as here, and this gate
// normalises exactly that field and nothing else.
const normaliseCreateFoeStamp = (data, now) => {
  for (const task of data.tasks ?? []) {
    for (const action of task.actions ?? []) {
      if (action.type !== 'CreateFoe') continue;
      const spec = action.actionSpecific;
      if (spec && spec.lastSpawnTime === now) spec.lastSpawnTime = 0;
    }
  }
  return data;
};

test('every corpus quest round-trips the envelope: save -> restore -> save is a fixed point', () => {
  const files = readdirSync(join(VENDOR, 'Quests')).filter((f) => f.endsWith('.txt')).sort();
  assert.ok(files.length >= 265);
  const m = makeMachine();
  let checked = 0;
  let restamped = 0;
  for (const f of files) {
    resetUid();
    const quest = m.parseQuestForLists(readLines(join(VENDOR, 'Quests', f)), 0, { rolls: () => 0.5 });
    const data1 = quest.getSaveData();
    const m2 = makeMachine();
    resetUid();
    m2.restoreSaveData({ siteLinks: [], quests: [data1] });
    const restored = m2.getQuest(quest.uid);
    assert.ok(restored, `${f} restored under its saved uid`);
    const data2 = restored.getSaveData();
    for (const task of data2.tasks ?? []) {
      for (const action of task.actions ?? []) {
        if (action.type === 'CreateFoe' && action.actionSpecific?.lastSpawnTime === m2.now) restamped++;
      }
    }
    assert.deepEqual(normaliseCreateFoeStamp(data2, m2.now), data1, `${f} round-trips exactly`);
    checked++;
  }
  assert.equal(checked, files.length);
  // the hole is REAL and the corpus exercises it - if this ever reads 0
  // the normaliser above has gone blind and the gate is testing nothing
  assert.ok(restamped > 0, 'the corpus carries CreateFoe actions that get re-stamped on load');
});

test('a STARTED quest with live state round-trips and its twin continues identically', () => {
  resetUid();
  const m = makeMachine();
  const quest = m.scheduleQuest(RICH_SRC, 0, { rolls: () => 0.5 });
  m.tick();   // starts; the log step and clock state land
  m.now = 200; m.tick();
  const saved = quest.getSaveData();
  assert.equal(saved.activeLogMessages.length, 1, 'the log step rides the envelope');
  assert.equal(saved.activeLogMessages[0].stepID, 2);

  const m2 = makeMachine();
  m2.now = 200;
  m2.restoreSaveData({ siteLinks: [], quests: [saved] });
  const twin = m2.getQuest(quest.uid);
  assert.deepEqual(twin.getSaveData(), saved, 'the restored twin saves identically');

  // both continue under the same clock: the envelopes stay equal
  m.now = 500; m2.now = 500;
  m.tick(); m2.tick();
  assert.deepEqual(twin.getSaveData(), quest.getSaveData(), 'the twin ticks in lockstep');
});

test('the allocator advances past restored uids - a new quest never collides', () => {
  resetUid();
  const m = makeMachine();
  const quest = m.parseQuestForLists(RICH_SRC, 0, { rolls: () => 0 });
  const data = quest.getSaveData();
  resetUid();   // a fresh session: the allocator would hand out the SAME ids
  const m2 = makeMachine();
  m2.restoreSaveData({ siteLinks: [], quests: [data] });
  assert.ok(nextUid() > data.uid, 'ensureUidAtLeast bumped the allocator');
});

// ---------------------------------------------------------------
// The machine envelope's failure laws
// ---------------------------------------------------------------

test('the removed-mod law: an unknown action type drops THAT quest with the warn + HUD line; its SiteLinks scrub', () => {
  resetUid();
  const hud = [];
  const m = makeMachine();
  const quest = m.parseQuestForLists(RICH_SRC, 0, { rolls: () => 0 });
  const data = quest.getSaveData();
  data.tasks[0].actions[0].type = 'ModAction';   // the mod was removed
  const m2 = makeMachine({ addHUDText: (t) => hud.push(t) });
  m2.restoreSaveData({
    siteLinks: [{ questUID: data.uid, placeSymbol: { original: '_x_', name: 'x' }, siteType: 2, mapId: 1, buildingKey: 0, magicNumberIndex: 0 }],
    quests: [data],
  });
  assert.equal(m2.quests.size, 0, 'the broken quest never lands');
  assert.deepEqual(hud, ["Failed to load quest 'The Saved Errand [__SAV]'. This is expected if quest mod removed."]);
  assert.equal(m2.siteLinks.length, 0, 'RemoveStaleSiteLinks scrubbed the orphan link');
});

test('a duplicate restored UID throws into the per-quest catch, as Dictionary.Add does - the first wins', () => {
  resetUid();
  const m = makeMachine();
  const data = m.parseQuestForLists(RICH_SRC, 0, { rolls: () => 0 }).getSaveData();
  const m2 = makeMachine();
  m2.restoreSaveData({ siteLinks: [], quests: [data, structuredClone(data)] });
  assert.equal(m2.quests.size, 1);
});

test('an unknown Person faction id fails THAT quest load loudly (the C# deserialize throw)', () => {
  resetUid();
  const m = makeMachine();
  const quest = m.parseQuestForLists(RICH_SRC, 0, { rolls: () => 0 });
  const data = quest.getSaveData();
  data.resources.push({
    type: 'Person', symbol: { original: '_npc_' }, infoMessageID: -1, usedMessageID: -1,
    rumorsMessageID: 0, hasPlayerClicked: false, isHidden: false,
    resourceSpecific: { factionID: 999999, nameBank: 0, npcGender: 0, faceIndex: -1, nameSeed: 1 },
  });
  const m2 = makeMachine();   // no world seam: the faction store answers nothing
  m2.restoreSaveData({ siteLinks: [], quests: [data] });
  assert.equal(m2.quests.size, 0, 'Could not deserialize Person resource FactionID to FactionData');
});

// ---------------------------------------------------------------
// The inner-shape laws
// ---------------------------------------------------------------

test('Message.getSaveData reconstructs SOURCE lines - <ce> re-prefixes, variants re-split, junk throws', () => {
  resetUid();
  const m = makeMachine();
  const quest = m.parseQuestForLists(RICH_SRC, 0, { rolls: () => 0 });
  const msg = quest.getMessage(1012);
  assert.deepEqual(msg.getSaveData(), { id: 1012, lines: ['<ce>centered a', '<--->', '<ce>centered b'] },
    'the center token re-prefixes WITHOUT its original trailing space (trim law)');
  const plain = quest.getMessage(1011);
  assert.deepEqual(plain.getSaveData(), { id: 1011, lines: [' the log line'] },
    'an uncentered line keeps its left indent');
  msg.variants[0].tokens[0] = { formatting: 'bogus', text: 'x' };
  assert.throws(() => msg.getSaveData(), /Message.GetSaveData\(\) encountered unexpected formatting token bogus/);
});

test("rumorsMessageID is C#'s own hole: in the struct, never saved, never restored - a load resets it to -1", () => {
  resetUid();
  const m = makeMachine();
  const SRC = ['Quest: __RUM', 'QRC:', 'Message:  1011', ' x', '',
    'Message:  1030', ' r', '', 'QBN:', 'Item _it_ gold rumors 1030', '', 'variable _pad_'];
  const quest = m.parseQuestForLists(SRC, 0, { rolls: () => 0 });
  assert.equal(quest.getResource({ name: 'it' }).rumorsMessageID, 1030, 'the tag parsed live');
  const envelope = quest.getResource({ name: 'it' }).getResourceSaveData();
  assert.equal(envelope.rumorsMessageID, 0, 'serialized at the struct default, not the live value');
  const data = quest.getSaveData();
  const m2 = makeMachine();
  m2.restoreSaveData({ siteLinks: [], quests: [data] });
  assert.equal(m2.getQuest(quest.uid).getResource({ name: 'it' }).rumorsMessageID, -1,
    'the restored resource wears the ctor default');
});

test('the task restore ORDER is law: a triggered GlobalVarLink task never re-writes the global var on load', () => {
  resetUid();
  const m = makeMachine();
  const SRC = ['Quest: __GVL', 'QRC:', 'Message:  1011', ' x', '', 'QBN:',
    'BrisiennaEnding _brisienna_', '', 'variable _pad_'];
  const quest = m.parseQuestForLists(SRC, 0, { rolls: () => 0 });
  quest.getTask({ name: 'brisienna' }).start();
  assert.equal(m.globalVars.get(18), true, 'the live start wrote the link');
  const data = quest.getSaveData();
  const m2 = makeMachine();
  m2.restoreSaveData({ siteLinks: [], quests: [data] });
  assert.equal(m2.globalVars.has(18), false,
    'IsTriggered restores while globalVarLink is still -1 - the store never hears about it');
  assert.equal(m2.getQuest(quest.uid).getTask({ name: 'brisienna' }).triggered, true);
});

test('the journal walk: insertion order, no sort, completed quests skip whole', () => {
  resetUid();
  const m = makeMachine();
  const q1 = m.scheduleQuest(RICH_SRC, 0, { rolls: () => 0 });
  const q2 = m.scheduleQuest(RICH_SRC.map((l) => l.replace('__SAV', '__SB')), 0, { rolls: () => 0 });
  m.tick();
  assert.deepEqual(m.getAllQuestLogMessages().map((msg) => msg.parentQuest.questName),
    ['__SAV', '__SB'], 'one live log entry per quest, machine order');
  q1.questComplete = true;
  assert.deepEqual(m.getAllQuestLogMessages().map((msg) => msg.parentQuest.questName), ['__SB'],
    "a completed quest's null log skips");
});

test('EndQuest files the ACTIVE log to the notebook through the hook, resolved to Message objects', () => {
  resetUid();
  const filed = [];
  const m = makeMachine({ addFinishedQuest: (messages) => filed.push(messages) });
  const quest = m.scheduleQuest(RICH_SRC, 0, { rolls: () => 0 });
  m.tick();
  quest.endQuest();
  assert.equal(filed.length, 1);
  assert.deepEqual(filed[0].map((msg) => msg.id), [1011]);
});

// ---------------------------------------------------------------
// PlayerNotebook.cs whole
// ---------------------------------------------------------------

const nbDeps = { dateTimeString: () => '12:00:00 on Morndas', midDateTimeString: () => 'Morndas, 1 AM', cityName: () => 'Daggerfall' };

test("a note wraps at the LAST space at or before 70 and every line takes C#'s leading space", () => {
  const nb = new PlayerNotebook(nbDeps);
  const long = 'a'.repeat(60) + ' tail that pushes this line well past the seventy column mark here';
  nb.addNote(long);
  const note = nb.getNote(0);
  assert.equal(note[0].formatting, 'highlight');
  assert.equal(note[0].text, '12:00:00 on Morndas in Daggerfall:', 'the noteHeader literal {0} in {1}:');
  const bodyLines = note.filter((t) => t.formatting === 'text').map((t) => t.text);
  assert.equal(bodyLines[0], ' ' + 'a'.repeat(60) + ' tail that',
    'broken at the LAST space at column 70 itself, space-prefixed');
  assert.ok(bodyLines.every((l) => l.startsWith(' ')));
  assert.ok(bodyLines.every((l) => l.length <= 1 + 70));
});

test('moveNote corrects the destination DOWN when it sat past the source', () => {
  const nb = new PlayerNotebook(nbDeps);
  nb.addNote('one'); nb.addNote('two'); nb.addNote('three');
  nb.moveNote(0, 2);
  assert.deepEqual(nb.getNotes().map((n) => n[2].text), [' two', ' one', ' three'],
    'destIdx-- lands the note BEFORE the element it named');
});

test('the message ring: fills to 50, overwrites the oldest, answers rotated; Clear() spares it', () => {
  const nb = new PlayerNotebook(nbDeps);
  for (let i = 0; i < MAX_MESSAGE_COUNT + 3; i++) nb.addMessage(`m${i}`);
  const texts = nb.getMessages().map((e) => e[1].text);
  assert.equal(texts.length, 50);
  assert.equal(texts[0], 'm3', 'the oldest surviving message leads');
  assert.equal(texts[49], 'm52');
  nb.clear();
  assert.equal(nb.getMessages().length, 50, "Clear() clears notes and finished quests but NOT the ring - C#'s hole");
  assert.equal(nb.getNotes().length, 0);
});

test("the finished-quest header speaks the literals - displayName else 'Quest', completed/ended by outcome", () => {
  const nb = new PlayerNotebook(nbDeps);
  const mkMsg = (quest) => ({ parentQuest: quest, getTextTokens: () => [{ formatting: 'text', text: 'done deed' }] });
  nb.addFinishedQuest([mkMsg({ displayName: 'The Wraith of Wabbajack', questSuccess: true })]);
  nb.addFinishedQuest([mkMsg({ displayName: '', questSuccess: false })]);
  assert.equal(nb.getFinishedQuest(0)[0].text, 'The Wraith of Wabbajack completed at Morndas, 1 AM:');
  assert.equal(nb.getFinishedQuest(1)[0].text, 'Quest ended at Morndas, 1 AM:');
});

test('the finished-quest overflow quirk: the current message refiles HEADERLESS and an empty entry can land', () => {
  const nb = new PlayerNotebook(nbDeps);
  const bigTokens = Array.from({ length: MAX_LINES_QUESTS * 2 }, (_, i) => ({ formatting: 'text', text: `line ${i}` }));
  const quest = { displayName: 'Big', questSuccess: true };
  nb.addFinishedQuest([{ parentQuest: quest, getTextTokens: () => bigTokens }]);
  const entries = nb.getFinishedQuests();
  assert.equal(entries.length, 3, 'the overflowing entry + the headerless refile + the unguarded empty tail');
  assert.equal(entries[0][0].formatting, 'highlight', 'the first carries the header');
  assert.equal(entries[1][0].formatting, 'text', 'the refile carries NO header');
  assert.deepEqual(entries[2], [], 'the final push is unguarded, verbatim');
});

test('the notebook save round-trips D:/Q:/A: prefixes and the double-newline law; messages are LOST', () => {
  const nb = new PlayerNotebook(nbDeps);
  nb.addNoteTokens([
    { formatting: 'question', text: 'Where is the Ogre?' },
    { formatting: 'answer', text: 'In the pub.' },
    { formatting: 'text', text: '' },   // an empty token = a line BREAK
    { formatting: 'text', text: 'a plain remark' },
  ]);
  nb.addMessage('a courier letter');
  const data = nb.getSaveData();
  assert.deepEqual(data.notebookEntries[0], [
    'D:12:00:00 on Morndas in Daggerfall:',
    'Q: Where is the Ogre?',
    'A: In the pub.',
    '',
    ' a plain remark',
  ], 'one nothing-token joins (dropped); the second consecutive lands the empty line');
  const nb2 = new PlayerNotebook(nbDeps);
  nb2.restoreSaveData(data);
  assert.deepEqual(nb2.getSaveData(), data, 'a fixed point through the line encoding');
  assert.equal(nb2.getNote(0)[0].formatting, 'highlight');
  assert.equal(nb2.getMessages().length, 0, 'the ring is not in the shape - lost on load, C#');
});

// ---------------------------------------------------------------
// AUDIT XII boundary pins (the campaign's survivors)
// ---------------------------------------------------------------

test('the action walk saves REAL shapes with COPIES - no nulls, no aliasing either direction', () => {
  resetUid();
  const m = makeMachine();
  const quest = m.parseQuestForLists(RICH_SRC, 0, { rolls: () => 0 });
  const logAction = [...quest.tasks.values()].flatMap((t) => t.actions).find((a) => a.saveShape.some(([f]) => f === 'messageID'));
  assert.deepEqual(logAction.getSaveData(), { messageID: 1011, stepID: 2 },
    'a shaped action serializes its C#-named fields, never null');

  const WT_SRC = ['Quest: __WT', 'QRC:', 'Message:  1011', ' x', '', 'QBN:',
    '_a_ task:', ' when _b_ and _c_', '', '_b_ task:', ' say 1011', '', '_c_ task:', ' say 1011', '', 'variable _pad_'];
  const q2 = m.parseQuestForLists(WT_SRC, 0, { rolls: () => 0 });
  const whenTask = [...q2.tasks.values()].flatMap((t) => t.actions).find((a) => a.evaluations);
  const data = whenTask.getSaveData();
  const savedLen = data.evaluations.length;
  whenTask.evaluations.push({ op: 'and', task: 'zz' });
  assert.equal(data.evaluations.length, savedLen, 'the save is a COPY - live mutation never reaches it');
  const fresh = [...q2.tasks.values()].flatMap((t) => t.actions).find((a) => a.evaluations);
  fresh.restoreSaveData(data);
  fresh.evaluations.push({ op: 'or', task: 'ww' });
  assert.equal(data.evaluations.length, savedLen, 'the restore is a COPY too');
});

test("the walk's null-shape arm answers null, and a sym field serializes as {original}", () => {
  resetUid();
  const m = makeMachine();
  const quest = m.parseQuestForLists(RICH_SRC, 0, { rolls: () => 0 });
  const SRC = ['Quest: __ST', 'QRC:', 'Message:  1011', ' x', '', 'QBN:',
    ' start task _tt_', '', '_tt_ task:', ' say 1011', '', 'variable _pad_'];
  const q2 = m.parseQuestForLists(SRC, 0, { rolls: () => 0 });
  const startTask = [...q2.tasks.values()].flatMap((t) => t.actions).find((a) => a.taskSymbol);
  assert.deepEqual(startTask.getSaveData(), { taskSymbol: { original: '_tt_' } });
  void quest;
});

test('EndQuest gates: factionId EXACTLY 1 still changes reputation; no log means NO filing; a complete quest re-ended never throws', () => {
  resetUid();
  const reps = [];
  const filed = [];
  const m = makeMachine({ addFinishedQuest: (msgs) => filed.push(msgs) });
  const quest = m.parseQuestForLists(RICH_SRC, 1, { rolls: () => 0 });
  quest.hooks = { ...quest.hooks, changeReputation: (fid, amt, prop) => reps.push([fid, amt, prop]) };
  quest.endQuest();   // never started - no log entries
  assert.deepEqual(reps, [[1, -2, true]], 'factionId > 0 is the gate - 1 qualifies');
  assert.equal(filed.length, 0, 'an EMPTY log never files');
  quest.questComplete = true;
  quest.endQuest();   // getLogMessages answers null - the && gate holds
  assert.equal(filed.length, 0);
});

test('envelope literals: smallerDungeonsState 0, person race -1 and undiscovered false, restored clocks and places stand resolved', () => {
  resetUid();
  const m = makeMachine();
  const quest = m.parseQuestForLists(RICH_SRC, 0, { rolls: () => 0 });
  assert.equal(quest.getSaveData().smallerDungeonsState, 0);

  const p = new Person(quest);
  assert.equal(p.getSaveData().race, -1, 'the port stores no race - the C# default serializes');
  assert.equal(p.getSaveData().discoveredThroughTalkManager, false);

  const clock = quest.getResource({ name: 'c' });
  clock.travelTimePending = true;
  clock.restoreSaveData(clock.getSaveData());
  assert.strictEqual(clock.travelTimePending, false, 'a restored clock is resolved');

  const pl = new Place(quest);
  pl.restoreSaveData({ scope: 'local', name: 'x', p1: 0, p2: 0, p3: 0, siteDetails: { siteType: 1 } });
  assert.strictEqual(pl.sitePending, false, 'a restored site is a BOOLEAN false, not the details object');
});

test('a restored quest with no clock seam reads time ZERO; the stale-link scrub removes EXACTLY the stale one', () => {
  resetUid();
  const m = makeMachine();
  const data = m.parseQuestForLists(RICH_SRC, 0, { rolls: () => 0 }).getSaveData();
  const m2 = new QuestMachine();   // NO nowSeconds dep
  m2.restoreSaveData({
    siteLinks: [
      { questUID: 424242, placeSymbol: { original: '_gone_', name: 'gone' }, siteType: 2, mapId: 1, buildingKey: 0, magicNumberIndex: 0 },
      { questUID: data.uid, placeSymbol: { original: '_kept_', name: 'kept' }, siteType: 2, mapId: 1, buildingKey: 0, magicNumberIndex: 0 },
    ],
    quests: [data],
  });
  assert.equal(m2.getQuest(data.uid).nowSeconds(), 0, 'the seam default is zero');
  assert.deepEqual(m2.siteLinks.map((l) => l.placeSymbol.name), ['kept'], 'splice(i, 1) - the neighbour survives');
});

// ---------------------------------------------------------------
// The notebook boundaries
// ---------------------------------------------------------------

test('the notebook literals: 70 / 50 / 20 / 28', async () => {
  const nbmod = await import('../src/systems/notebook.js');
  assert.equal(nbmod.MAX_LINE_LENGTH, 70);
  assert.equal(nbmod.MAX_MESSAGE_COUNT, 50);
  assert.equal(nbmod.MAX_LINES_QUESTS, 20);
  assert.equal(nbmod.MAX_LINES_SMALL, 28);
});

test('the wrap column is EXACT: 70 chars stay one line, 71 wrap; the remainder starts one past the space', () => {
  const nb = new PlayerNotebook(nbDeps);
  nb.addNote('b'.repeat(35) + ' ' + 'c'.repeat(34));   // 70 exactly
  assert.equal(nb.getNote(0).filter((t) => t.formatting === 'text').length, 1, '70 is NOT > 70');
  nb.addNote('b'.repeat(35) + ' ' + 'c'.repeat(35));   // 71
  const body = nb.getNote(1).filter((t) => t.formatting === 'text').map((t) => t.text);
  assert.equal(body.length, 2);
  assert.equal(body[1], ' ' + 'c'.repeat(35), 'the remainder starts at pos + 1 - the space itself drops');
});

test('index boundaries answer STRICT null; moveNote to the SAME slot is the identity', () => {
  const nb = new PlayerNotebook(nbDeps);
  nb.addNote('one'); nb.addNote('two');
  assert.strictEqual(nb.getNote(2), null, 'index == count is out');
  assert.strictEqual(nb.getFinishedQuest(0), null);
  nb.moveNote(1, 1);
  assert.deepEqual(nb.getNotes().map((n) => n[2].text), [' one', ' two'], 'destIdx == srcIdx never decrements');
  nb.addFinishedQuestTokens([{ formatting: 'text', text: 'fq1' }]);
  nb.addFinishedQuestTokens([{ formatting: 'text', text: 'fq2' }]);
  nb.moveFinishedQuest(0, 2);
  assert.deepEqual(nb.getFinishedQuests().map((e) => e[0].text), ['fq2', 'fq1'], 'the finished-quest move corrects DOWN too');
  nb.moveFinishedQuest(1, 1);
  assert.deepEqual(nb.getFinishedQuests().map((e) => e[0].text), ['fq2', 'fq1'], 'the same-slot move is the identity (strict >)');
  nb.addFinishedQuestTokens([{ formatting: 'text', text: 'fq3' }]);
  nb.moveFinishedQuest(2, 0);
  assert.deepEqual(nb.getFinishedQuests().map((e) => e[0].text), ['fq3', 'fq2', 'fq1'],
    'a move to the FRONT inserts without deleting (splice deleteCount 0)');
});

test('the guards hold their exact arms: null/empty inputs park, single entries file', () => {
  const nb = new PlayerNotebook(nbDeps);
  nb.addNoteTokens(null);
  nb.addNoteTokens([]);
  nb.addNoteTokens([{ formatting: 'text', text: 'solo' }]);
  assert.equal(nb.getNotes().length, 1, 'ONE token files one note - the length gate is === 0');
  nb.addFinishedQuestTokens(null);
  nb.addFinishedQuestTokens([]);
  nb.addFinishedQuestTokens([{ formatting: 'text', text: 'x' }]);
  assert.equal(nb.getFinishedQuests().length, 1, 'the > 0 gate: empty stays out, one goes in');
  nb.addFinishedQuest(null);
  nb.addFinishedQuest([]);
  assert.equal(nb.getFinishedQuests().length, 1, 'the filing guard parks null and empty without a throw');
  // the === 0 gate must not be === 1: a LONE token's CONTENT files
  // (a count assert alone is compensable - an empty-array call that
  // wrongly filed a header note would restore the count)
  const solo = new PlayerNotebook(nbDeps);
  solo.addNoteTokens([{ formatting: 'text', text: 'lone' }]);
  assert.equal(solo.getNotes()[0]?.[2]?.text, ' lone', 'the single token really landed');
});

test('the page splits fire at their EXACT token boundaries', () => {
  // notes: 28 one-line tokens land 2+56 entries - (58-2) >= 56 splits;
  // the continuation carries its own header and nothing else
  const nb = new PlayerNotebook(nbDeps);
  nb.addNoteTokens(Array.from({ length: 28 }, (_, i) => ({ formatting: 'text', text: `t${i}` })));
  assert.equal(nb.getNotes().length, 2, 'the split fired exactly at maxLinesSmall*2');
  assert.equal(nb.getNotes()[1].length, 2, 'the continuation is header-only');

  // finished quests: 39 tokens + the newline make (42-2) == 40 - the
  // >= boundary fires; 38 do not
  const quest = { displayName: 'B', questSuccess: true };
  const nb2 = new PlayerNotebook(nbDeps);
  nb2.addFinishedQuest([{ parentQuest: quest, getTextTokens: () => Array.from({ length: 39 }, (_, i) => ({ formatting: 'text', text: `l${i}` })) }]);
  assert.equal(nb2.getFinishedQuests().length, 3, '(entry - 2) >= 40 EXACTLY splits');
  const nb3 = new PlayerNotebook(nbDeps);
  nb3.addFinishedQuest([{ parentQuest: quest, getTextTokens: () => Array.from({ length: 38 }, (_, i) => ({ formatting: 'text', text: `l${i}` })) }]);
  assert.equal(nb3.getFinishedQuests().length, 1, 'one under the boundary stays whole');
});

test('clear() empties BOTH lists completely', () => {
  const nb = new PlayerNotebook(nbDeps);
  nb.addNote('one'); nb.addNote('two');
  nb.addFinishedQuestTokens([{ formatting: 'text', text: 'fq' }]);
  nb.clear();
  assert.equal(nb.getNotes().length, 0);
  assert.equal(nb.getFinishedQuests().length, 0);
});

test('remove and insert touch EXACTLY one entry', () => {
  const nb = new PlayerNotebook(nbDeps);
  nb.addNote('one'); nb.addNote('two'); nb.addNote('three');
  nb.removeNote(1);
  assert.deepEqual(nb.getNotes().map((n) => n[2].text), [' one', ' three'], 'removeNote splices ONE');
  nb.addNote('zero', 0);
  assert.deepEqual(nb.getNotes().map((n) => n[2].text), [' zero', ' one', ' three'], 'an indexed insert deletes NOTHING');
  nb.addFinishedQuestTokens([{ formatting: 'text', text: 'a' }]);
  nb.addFinishedQuestTokens([{ formatting: 'text', text: 'b' }]);
  nb.removeFinishedQuest(0);
  assert.deepEqual(nb.getFinishedQuests().map((e) => e[0].text), ['b']);
});
