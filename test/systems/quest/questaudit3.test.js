// QUEST-AUDIT III (2026-10-23, the owner: "Can you do a detailed quest audit, fix any and all outstanding issues. Do not
// worry about DFU parity."; bible/01-Overview/audits/Quest-Audit-III.md). The fixes the audit made, each pinned here:
//
// - STORY-AGAIN (#982, "Add way to reset a failed mandatory main quest"): a step of the main story that ended without
//   succeeding - S0000012's two days run out, a `_no_` - and whose story went no further is started again from the
//   journal (quest/machine.js storyAgainRefusal / startStoryAgain, questBridge.js journalClean.storyAgain).
// - QUEST-RESET's 'questor' rung reads a questor bound by the click alone: a quest whose script names its questor
//   (`add _Mynisera_ as questor`, every main-story step) restarts as any other.
// - LODGED-STAND: a dungeon quest Person stood at a marker inside a model is stood beside it (sceneMount.js
//   freeQuestStand) - the real data's N0000005 marker 29157 in statue 62330 is fb1004d_cratefree.test.js's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { QuestMachine, isMainStoryQuest, storySuccessors, storyShape } from '../../../src/systems/quest/machine.js';
import { freeQuestStand } from '../../../src/systems/quest/sceneMount.js';
import { Collider } from '../../../src/player/collider.js';
import { identity } from '../../../src/world/mat4.js';
import { lodgedIn } from '../../../src/characters/foeSpacing.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  loadQuestTables(sources);
}
const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

/** A main-story step that fails at once (its start-up ends it, as a `_no_` or a missed window does), and the steps the
 *  story's law reads (AUDIT QA3: machine.js storyShape - a step's successors, the globals it sets, the work a global
 *  would run again). */
const step = (name, body) => [`Quest: ${name}`, 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Item _gold_ gold', '', ...body];
const SOURCES = {
  S0000041: step('S0000041', ['\tend quest', '', '_win_ task:', '\tstart quest 42 42', '\tend quest']),   // fails; its success starts S0000042
  S0000042: step('S0000042', ['\tlog 1011 step 0', '', 'MorgiahSatisfied _S.08_', '', '_done_ task:', '\tstart task _S.08_']),   // runs; sets a global
  S0000043: step('S0000043', ['\tend quest']),                                               // a dead end: starts and sets nothing
  S0000044: step('S0000044', ['\tend quest', '', 'KingOfWormsSatisfied _S.14_', '', '_win_ task:', '\tstart task _S.14_']),   // starts nothing; sets a global
  S0000045: step('S0000045', ['\tend quest', '', 'FinishedMantellanCrux _S.09_', '\tend quest', '', '_win_ task:', '\tstart quest 42 42']),   // its global's task would end it
  S0000046: step('S0000046', ['\tend quest', '', '_win_ task:', '\tstart quest 47 47']),   // carried two steps on
  S0000047: step('S0000047', ['\tstart quest 42 42']),
  S0000048: step('S0000048', ['\tgive pc _gold_', '\tend quest', '', '_win_ task:', '\tstart quest 42 42']),   // paid, and stopped the story
  A0C00Y41: step('A0C00Y41', ['\tend quest']),                                               // not the main story's
};
function rig() {
  const m = new QuestMachine({ nowSeconds: () => 0, playerLevel: () => 1, getQuestSourceLines: (name) => SOURCES[name] ?? null });
  return m;
}
/** Start a step and tick it past `end quest`'s two-tick countdown (quest.js ticksToEnd) to its tombstone. */
const ticks = (m, n = 5) => { for (let i = 0; i < n; i++) m.tick(); };
const run = (m, name) => { const q = m.startQuestByName(name); ticks(m); return q; };

test('STORY-AGAIN: the main story is the S group by number - the world\'s backbone, the Totem\'s aftermath (S00001xx) and the guilds\' series (S00005xx) apart; a script says its successors, the globals it sets and the work a global would run again (mutants: the backbone, the aftermath, the guilds, the padding, each read)', () => {
  // PIN MOVED (AUDIT QA3 B5/B6): S0000500 is the Fighters Guild's Lord K'avar, S0000106 the Totem's powers
  assert.deepEqual(['S0000012', 's0000020', 'S0000988', 'S0000500', 'S0000503', 'S0000106', 'S0000100', 'S0000999', 'S0000977', '_BRISIEN', 'A0C00Y41', 'S000012'].map(isMainStoryQuest),
    [true, true, true, false, false, false, false, false, false, false, false, false]);
  assert.deepEqual(storySuccessors(['\tstart quest 20 20 ', '-- start quest 7 7', '\tstart quest _child_', 'x start quest 3 3']), ['S0000020', '_CHILD_']);
  assert.deepEqual(storySuccessors(read(join(VENDOR, 'Quests', 'S0000012.txt')).split('\n')), ['S0000020'], 'The Emperor\'s Courier carries the story to the Orcish Treaty');
  assert.deepEqual(storyShape(SOURCES.S0000042), { next: [], sets: [23], replays: [] }, 'a `start task` of its link sets MorgiahSatisfied');
  assert.deepEqual(storyShape(SOURCES.S0000045), { next: ['S0000042'], sets: [], replays: [36] }, 'a link task that ends the quest');
  assert.deepEqual(storyShape(['QBN:', 'LysandusSatisfied _S.05_', '\thave _spider_ set _S.05_', '', 'start quest 100 100']), { next: [], sets: [43], replays: [] }, 'a link its own trigger sets; the aftermath is no successor');
  assert.deepEqual(storyShape(['MorgiahSatisfied _S.08_', 'start task _S.08_']), { next: [], sets: [], replays: [] }, 'the QBN alone');
});

test('STORY-AGAIN: an ended step whose story went no further may be started again, and starts from its first step; once running, or once a step it starts began, it may not (mutants: each rung)', () => {
  const m = rig();
  const failed = run(m, 'S0000041');
  assert.ok(failed.questTombstoned && !failed.questSuccess, 'it ended, unpaid');
  assert.deepEqual(m.storyAgainQuests(), ['S0000041']);
  assert.equal(m.storyAgainRefusal('s0000041'), null, 'by name, in any case');
  const r = m.startStoryAgain('S0000041');
  assert.equal(r.ok, true);
  assert.notEqual(r.quest.uid, failed.uid);
  assert.equal(m.getQuest(r.quest.uid), r.quest, 'the new copy is on the table, running');
  assert.equal(m.storyAgainRefusal('S0000041'), 'running');
  assert.deepEqual(m.storyAgainQuests(), [], 'no door while it runs');
  ticks(m);
  assert.deepEqual(m.storyAgainQuests(), ['S0000041'], 'failed again: the door again');
  run(m, 'S0000042');
  assert.equal(m.storyAgainRefusal('S0000041'), 'carried', 'the step it starts has begun: the story went on');
  assert.deepEqual(m.storyAgainQuests(), []);
});

test('STORY-AGAIN refusals: not the main story\'s, the backbone, the aftermath, a guild\'s series, a step never ended, one the story does not need, one whose global is set, one whose global\'s task would run again, no source - and a step that paid and still stopped the story is offered (mutants: each)', () => {
  const m = rig();
  run(m, 'A0C00Y41');
  for (const n of ['A0C00Y41', 'S0000999', 'S0000500', 'S0000106']) assert.equal(m.storyAgainRefusal(n), 'protected', n);
  assert.equal(m.storyAgainRefusal('S0000042'), 'gone', 'never begun');
  run(m, 'S0000043');
  assert.equal(m.storyAgainRefusal('S0000043'), 'needless', 'a dead end: the story does not need it (AUDIT QA3 B6)');
  run(m, 'S0000044');
  assert.equal(m.storyAgainRefusal('S0000044'), null, 'it sets a global the story reads, and the global is not set');
  m.globalVars.set(33, true);
  assert.equal(m.storyAgainRefusal('S0000044'), 'carried', 'KingOfWormsSatisfied set: its work is done');
  run(m, 'S0000045');
  assert.equal(m.storyAgainRefusal('S0000045'), null);
  m.globalVars.set(36, true);
  assert.equal(m.storyAgainRefusal('S0000045'), 'carried', 'FinishedMantellanCrux set: a new copy would end on its first tick (AUDIT QA3 B4)');
  const paid = run(m, 'S0000048');
  assert.ok(paid.questSuccess && paid.questTombstoned, 'it paid and ended');
  assert.equal(m.storyAgainRefusal('S0000048'), null, 'paid, and the story stopped there: it is the story\'s to take up again (AUDIT QA3 B3)');
  m.storyEnded.add('S0000049');
  assert.equal(m.storyAgainRefusal('S0000049'), 'unparsed');
  assert.deepEqual(m.startStoryAgain('S0000043'), { ok: false, reason: 'needless' });
  assert.deepEqual(m.storyAgainQuests(), ['S0000048']);
});

test('STORY-AGAIN rides the save: the record round-trips, the tombstone\'s week is not its memory, and an envelope from before the record learns it from its tombstones and the journal\'s archive - an end an end, whatever the archive says of success, and a step carried on by a step that filed nothing is carried (mutants: the fields, the legacy reads, the seed, the chain)', () => {
  const m = rig();
  run(m, 'S0000041');
  const data = JSON.parse(JSON.stringify(m.getSaveData()));
  assert.deepEqual([data.storyStarted, data.storyEnded], [['S0000041'], ['S0000041']]);
  const back = rig();
  back.restoreSaveData({ ...data, quests: [] });   // the tombstone gone, a week on
  back.seedStory([{ quest: 'S0000041', success: true }]);   // a record-bearing save never reads the archive
  assert.deepEqual(back.storyAgainQuests(), ['S0000041']);
  // AUDIT QA3 F4: a REAL envelope from before the record - its tombstone holds the failure
  const old = { ...data };
  delete old.storyStarted; delete old.storyEnded;
  const legacy = rig();
  legacy.restoreSaveData(old);
  assert.deepEqual(legacy.storyAgainQuests(), ['S0000041'], 'the restored tombstone is the record');
  // AUDIT QA3 B2/F1: the archive's success is the QuestComplete box's word, not the story's - every entry an end
  const archive = rig();
  archive.restoreSaveData({ siteLinks: [], quests: [] });
  archive.seedStory([{ quest: 'S0000041', success: true }, { quest: 'A0C00Y41', success: false }, { kind: 'note' }]);
  assert.deepEqual(archive.storyAgainQuests(), ['S0000041'], 'filed a success, and its successor never began: the story stopped there');
  archive.seedStory([{ quest: 'S0000043', success: false }]);
  assert.equal(archive.storyAgainRefusal('S0000043'), 'gone', 'read once');
  const chain = rig();
  chain.restoreSaveData({ siteLinks: [], quests: [] });
  chain.seedStory([{ quest: 'S0000046', success: false }, { quest: 'S0000042', success: false }]);
  assert.equal(chain.storyAgainRefusal('S0000046'), 'carried', 'S0000047 filed nothing, and the step it starts began: carried two steps on (AUDIT QA3 B2)');
  m.clearState();
  assert.deepEqual([m.storyStarted.size, m.storyEnded.size], [0, 0], 'a load starts the loaded game\'s story');
});

test('QUEST-RESET\'s questor rung: a questor the click bound refuses the restart; one the script names and makes its questor does not (mutants: the bound test)', () => {
  const m = rig();
  const q = m.startQuestByName('S0000042');
  m.tick();
  const person = { isPerson: true, isQuestor: true, symbol: { name: 'qg' }, questorData: { hash: 0, nameSeed: 0, mapID: 0, buildingKey: 0 } };
  q.resources.set('qg', person);
  assert.equal(m.restartRefusal(q.uid), null, '`add _Mynisera_ as questor`: the same person again');
  person.questorData = { hash: 0x1234, nameSeed: 9, mapID: 12, buildingKey: 0 };
  assert.equal(m.restartRefusal(q.uid), 'questor', 'the clicked NPC: whoever was clicked last would be bound');
  for (const k of ['hash', 'nameSeed', 'mapID', 'buildingKey']) {
    person.questorData = { hash: 0, nameSeed: 0, mapID: 0, buildingKey: 0, [k]: 3 };
    assert.equal(m.restartRefusal(q.uid), 'questor', k);
  }
});

test('STORY-AGAIN\'s doors: the bridge hands both through journalClean (every host\'s pause window and chronicle), seeds a legacy save after the notebook restores, and the two journals draw the press twice (source pins)', () => {
  const bridge = src('src/scenes/quest/questBridge.js');
  assert.match(bridge, /storyAgain: \(\) => machine\.storyAgainQuests\(\)\.map/);
  assert.match(bridge, /const r = machine\.startStoryAgain\(questName\);/);
  assert.match(bridge, /if \(data\.notebook\) notebook\.restoreSaveData\(data\.notebook\);\n(?:\s*\/\/.*\n)*\s*machine\.seedStory\(notebook\.getFinishedQuests\(\)\.map\(\(e\) => e\[0\]\?\.render\)\.filter\(\(r\) => r\?\.kind === 'quest'\)\);/);
  const menu = src('src/ui/enhanced/enhancedMenu.js');
  assert.match(menu, /const story = \(clean\?\.storyAgain\?\.\(\) \?\? \[\]\)\.map/);
  assert.match(menu, /section\(t\('pause\.journal\.main', 'Main Quests'\), \[\.\.\.mains, \.\.\.story\]/);
  assert.match(menu, /if \(journalCleanArmed !== sel\.key\) \{ journalCleanArmed = sel\.key; render\(\); return; \}\n\s*journalCleanArmed = null;\n\s*const out = clean\.startStoryAgain\(sel\.story\.questName\);/);
  const chron = src('src/ui/enhanced/enhancedChronicle.js');
  assert.match(chron, /shelfWord = storyDoor\.startStoryAgain\(s\.questName\)\?\.text \?\? '';/);
});

test('LODGED-STAND: a quest Person whose feet stand inside a model stands beside it; feet in the open stand as given; the dungeon host stands its Persons through it (mutants: the free, the host\'s call)', () => {
  // a floor facing up, and a closed 2 m box on it round the marker, its faces looking out
  const c = new Collider(() => -Infinity);
  c.addMesh('dungeon', [-10, 0, -10, 10, 0, -10, 10, 0, 10, -10, 0, 10], [0, 2, 1, 0, 3, 2], identity());
  const box = { positions: [], indices: [] };
  const v = (x, y, z) => { box.positions.push(x, y, z); return box.positions.length / 3 - 1; };
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => [v(x, 0, z), v(x, 2, z)]);
  for (let i = 0; i < 4; i++) {
    const [a0, a1] = corners[i], [b0, b1] = corners[(i + 1) % 4];
    box.indices.push(a0, b1, b0, a0, a1, b1);
  }
  const [t0, t1, t2, t3] = corners.map(([, top]) => top);
  box.indices.push(t0, t2, t1, t0, t3, t2);
  c.addMesh('dungeon', box.positions, box.indices, identity());
  const inside = [0.2, 0, 0.1];
  assert.ok(lodgedIn(c, inside), 'the fixture: the marker stands in the box');
  const stood = freeQuestStand(c, inside, 1.8);
  assert.notEqual(stood, inside);
  assert.ok(!lodgedIn(c, stood) && Math.max(Math.abs(stood[0]), Math.abs(stood[2])) > 1, `beside the box - ${stood}`);
  const open = [5, 0, 5];
  assert.equal(freeQuestStand(c, open, 1.8), open, 'in the open: as given');
  assert.equal(freeQuestStand(null, inside, 1.8), inside, 'no collider: as given');
  const modes = src('src/scenes/worldModes.js');
  assert.match(modes, /if \(Number\.isFinite\(drop\)\) by = \(origin - drop\) \+ size\.h \* 0\.02;\n\s*if \(inDungeon\) \{ \[x, by, z\] = freeQuestStand\(ctx\.collider, \[x, by, z\], size\.h\); stand\.x = x; stand\.z = z; \}/);
});
