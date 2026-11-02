// AUDIT QA3 (2026-10-23, the owner: "Audit this", of QUEST-AUDIT III; bible/01-Overview/audits/Quest-Audit-III.md): the
// main story's door (STORY-AGAIN, #982) held to Daggerfall's own scripts. The ladder read a step's success and its direct
// `start quest` lines alone, and over the real story it offered the Orcish Treaty and Lysandus' Revenge again from an old
// save (they finish without the QuestComplete box), kept S0000004 and S0000015 off the door because they had paid on the
// way to stopping the story, offered Elysana's Betrayal and Mantella Revealed after the finale (each new copy ended at
// once, and the door came back), read the Totem's revenge quests as the story going on, and offered the guilds' own S
// series. The law now (quest/machine.js storyShape, storyAgainRefusal): a step the story needs - one that sets a global
// the story reads, or starts a step that does - ended, and nothing it would do has happened. And the pause window's
// Quests tab and the chronicle draw the door (F3), saying the press's words where the player can read them (B9, F6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Node_ } from '../../chargenDom.mjs';   // the minimal DOM - globals (the pause window and the chronicle mount on it)
import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import * as machineModule from '../../../src/systems/quest/machine.js';   // a namespace: the snapshot this audit read has no storyShape, and its pins are each red there on their own law
import { mountEnhancedMenu } from '../../../src/ui/enhanced/enhancedMenu.js';
import { mountEnhancedChronicle } from '../../../src/ui/enhanced/enhancedChronicle.js';
import { createQuestBridge } from '../../../src/scenes/quest/questBridge.js';

void Node_;
const { QuestMachine } = machineModule;
const storyShape = (l) => machineModule.storyShape(l);
globalThis.window ??= globalThis;   // the journal faces read the window's size (audit_guide.test.js's own)
const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  loadQuestTables(sources);
}
const lines = (name) => { try { return read(join(VENDOR, 'Quests', `${name}.txt`)).split(/\r?\n/); } catch { return null; } };
// the globals by their Quests-GlobalVars ids
const G = { KingOfWormsGotTotem: 2, GothrydEnding: 11, MyniseraSatisfied: 29, KingOfWormsSatisfied: 33, FinishedMantellanCrux: 36 };

/** A game loaded from an envelope saved before the story's record, its globals as given, and the journal's archive
 *  `filed` (each `[name, success]`) read once - the public road a player's old save takes (questBridge.js restore). */
function oldSave(filed, globals = []) {
  const m = new QuestMachine({ nowSeconds: () => 0, playerLevel: () => 1, getQuestSourceLines: lines });
  m.restoreSaveData({ siteLinks: [], quests: [], globalVars: globals.map((id) => [id, true]) });
  m.seedStory(filed.map(([quest, success = false]) => ({ quest, success })));
  return m;
}

test('QA3 B2-B6: Daggerfall\'s own scripts say what each step does for the story - its successors, the globals it sets, the work a set global runs again (mutants: each read)', () => {
  const shape = (n) => storyShape(lines(n));
  assert.deepEqual(shape('S0000012').next, ['S0000020']);
  assert.deepEqual(shape('S0000021'), { next: [], sets: [G.KingOfWormsSatisfied], replays: [] }, 'Lich\'s Soul starts nothing and sets KingOfWormsSatisfied');
  assert.deepEqual(shape('S0000020').sets, [G.MyniseraSatisfied], 'the Orcish Treaty sets MyniseraSatisfied');
  assert.deepEqual(shape('S0000008').next, ['S0000016'], 'the Totem\'s revenge and powers (S00001xx) are no step');
  assert.ok(shape('S0000008').replays.includes(G.KingOfWormsGotTotem), 'the totem to the King of Worms: `start quest 106 106` again');
  assert.deepEqual(shape('S0000009'), { next: [], sets: [], replays: [G.FinishedMantellanCrux] }, 'Mantella Revealed: a dead end, ended by the finale');
  assert.deepEqual(shape('S0000988').next, ['S0000009']);
  assert.ok(shape('S0000016').sets.length > 0, 'the finale sets its endings');
});

test('QA3 #982: The Emperor\'s Courier failed is offered from an old save, and not once the Orcish Treaty began (mutants: the ladder)', () => {
  assert.deepEqual(oldSave([['S0000012']]).storyAgainQuests(), ['S0000012']);
  assert.deepEqual(oldSave([['S0000012'], ['S0000020']], [G.MyniseraSatisfied]).storyAgainQuests(), [], 'the story went on');
});

test('QA3 B2: an old save never offers a step the story went on past - the Orcish Treaty finished (it files no QuestComplete), the Lysandus\' Revenge diary handed in (mutants: the success read, the global read)', () => {
  assert.deepEqual(oldSave([['S0000020', false]], [G.MyniseraSatisfied]).storyAgainQuests(), [], 'MyniseraSatisfied set: the treaty was made');
  assert.deepEqual(oldSave([['S0000015', false], ['S0000008', false]]).storyAgainRefusal('S0000015'), 'carried', 'the Totem began');
});

test('QA3 B3: a step that paid on the way to stopping the story is offered - Morgiah\'s Wedding after its errand and the missed days, Lysandus\' Revenge to Gortwog before its gates stood (mutants: the paid read)', () => {
  assert.deepEqual(oldSave([['S0000004', true]]).storyAgainQuests(), ['S0000004'], 'filed a success, and Lich\'s Soul never began');
  assert.deepEqual(oldSave([['S0000015', true]]).storyAgainQuests(), ['S0000015'], 'the Totem never began');
});

test('QA3 B4: after the finale neither Elysana\'s Betrayal nor Mantella Revealed is offered - each new copy ended on its first tick, and the door came back (mutants: the dead end, the replay)', () => {
  const m = oldSave([['S0000988'], ['S0000009'], ['S0000016', true]], [G.FinishedMantellanCrux, G.GothrydEnding]);
  assert.deepEqual(m.storyAgainQuests(), [], 'nor the finale, its ending set');
  assert.equal(m.storyAgainRefusal('S0000009'), 'needless');
  assert.equal(m.storyAgainRefusal('S0000988'), 'needless');
});

test('QA3 B5/B1: Who Gets the Totem run out of its year is offered though its revenge quests began; never once the totem was given (mutants: the aftermath read, the replay)', () => {
  const filed = [['S0000008'], ['S0000100'], ['S0000101'], ['S0000102']];
  assert.deepEqual(oldSave(filed).storyAgainQuests(), ['S0000008']);
  assert.deepEqual(oldSave(filed, [G.KingOfWormsGotTotem]).storyAgainQuests(), [], 'given to the King of Worms: a new copy starts S0000106 again');
  // (given to Gothryd, the totem's `_deliveredtotem_` stops the year's clock: that step cannot run out after it)
});

test('QA3 B6: the guilds\' series and the story\'s dead ends never take the main story\'s door or its words (mutants: the guild names, the needless rung)', () => {
  const m = oldSave([['S0000500'], ['S0000501'], ['S0000502'], ['S0000503'], ['S0000010'], ['S0000013'], ['S0000001'], ['S0000017']]);
  assert.deepEqual(m.storyAgainQuests(), []);
  assert.equal(m.storyAgainRefusal('S0000500'), 'protected', 'Lord K\'avar is the Fighters Guild\'s');
  assert.equal(m.storyAgainRefusal('S0000010'), 'needless');
});

// ---- the doors (F3, B9, F6) ----

const all = (root) => root.querySelectorAll('*');
const byText = (root, tag, words) => all(root).filter((n) => n.tagName === tag && n.textContent.includes(words));
const rowNamed = (host, words) => byText(host, 'BUTTON', words).find((b) => String(b.className).includes('px-qrow'));
const detailOf = (host) => host.querySelectorAll('.px-qdetail')[0];
const DONE = 'The Emperor\'s Courier begins again from its first step. The main story can go on.';

/** The bridge's journalClean, as the tab and the chronicle read it, over one stalled step - pressed, it starts once. */
function storyJournal({ other = true } = {}) {
  const pressed = [];
  let waiting = [{ questName: 'S0000012', title: 'The Emperor\'s Courier' }];
  const clean = {
    storyAgain: () => waiting.map((s) => ({ ...s })),
    startStoryAgain: (questName) => { pressed.push(questName); waiting = []; return { ok: true, uid: 99, text: DONE }; },
    offers: () => [], unhide: () => true, canAbandon: () => true, canRestart: () => true, removeFinished: () => true, clearFinished: () => 0,
  };
  const message = (text) => ({ id: 1, getTextTokens: () => [{ formatting: 'text', text }], parentQuest: null });
  const log = {
    active: other ? [{ id: '4', name: 'Rat Problem', questName: 'M0B00Y01', clockSeconds: null, clocks: [], messages: [message('Rats in the cellar.')], steps: [{ stepID: 0, messageID: 1, time: 1 }] }] : [],
    unlogged: [], shelved: [], hidden: [], finished: [], lines: [], ladders: [],
  };
  return { log, clean, pressed };
}
function withTab(j, fn) {
  const host = globalThis.document.createElement('div');
  globalThis.document.body.append(host);
  const menu = mountEnhancedMenu(host, { mode: 'pause', hooks: { questLog: () => j.log, journalClean: () => j.clean }, onAction: () => {}, at: 'quests' });
  try { return fn(host); } finally { menu.unmount(); host.remove(); }
}
const goOf = (host) => byText(detailOf(host), 'BUTTON', 'Take it up again')[0] ?? byText(detailOf(host), 'BUTTON', 'Click again')[0];

test('QA3 F3/B9: the pause window\'s door - the step\'s row under Main Quests, its page, a press that arms and a second that starts it once; its words said at the tab\'s head, never at the foot of another quest\'s page (mutants: the row, the page, the arming, the words)', () => {
  const j = storyJournal();
  withTab(j, (host) => {
    const row = rowNamed(host, 'The Emperor\'s Courier');
    assert.ok(row, 'a row of its own');
    row.click();
    assert.match(detailOf(host).textContent, /This step of the main story ended before the story could go on\./);
    goOf(host).click();
    assert.deepEqual(j.pressed, [], 'the first press arms');
    assert.match(goOf(host).textContent, /Click again/);
    goOf(host).click();
    assert.deepEqual(j.pressed, ['S0000012'], 'the second starts it, once');
    assert.ok(!detailOf(host).textContent.includes(DONE), 'not under the page the selection fell to (Rat Problem\'s)');
    assert.ok(byText(host, 'P', DONE).length === 1, 'said once, at the tab\'s head');
  });
});

test('QA3 F6: the words are said when the step was the tab\'s only row (mutants: the empty tab\'s return)', () => {
  const j = storyJournal({ other: false });
  withTab(j, (host) => {
    rowNamed(host, 'The Emperor\'s Courier').click();
    goOf(host).click();
    goOf(host).click();
    assert.deepEqual(j.pressed, ['S0000012']);
    assert.match(host.textContent, /No active quests\./);
    assert.ok(byText(host, 'P', DONE).length === 1, 'and the press\'s words beside it');
  });
});

test('QA3 F3: the chronicle\'s door - a card above the quests, a press that arms and a second that starts it once, its words said (mutants: the cards, the arming)', () => {
  const j = storyJournal();
  const host = globalThis.document.createElement('div');
  globalThis.document.body.append(host);
  const view = mountEnhancedChronicle(host, { section: 'quests', questLog: () => j.log, shelfDoor: () => j.clean, onExit: () => {} });
  try {
    const card = () => host.querySelectorAll('.cr-story')[0];
    assert.match(card().textContent, /The Emperor's Courier.*This step of the main story ended before the story could go on\./);
    const go = () => byText(card(), 'BUTTON', 'Take it up again')[0] ?? byText(card(), 'BUTTON', 'Click again')[0];
    go().click();
    assert.deepEqual(j.pressed, [], 'the first press arms');
    go().click();
    assert.deepEqual(j.pressed, ['S0000012']);
    assert.deepEqual(host.querySelectorAll('.cr-shelfword').map((n) => n.textContent), [DONE]);
    assert.equal(host.querySelectorAll('.cr-story').length, 0, 'the card goes with the step');
  } finally { view?.unmount?.(); host.remove(); }
});

// ---- the bridge's door (F5's survivors) ----

/** A main-story step by its pack's own words: its DisplayName, a start-up that fails it, the step its success starts. */
const STEP = ['Quest: S0000071', 'DisplayName: The Courier Again', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', '',
  '\tend quest', '', '_win_ task:', '\tstart quest 72 72'];
const NEXT = ['Quest: S0000072', 'QRC:', 'QBN:', 'MorgiahSatisfied _S.08_', '', '_set_ task:', '\tstart task _S.08_'];

test('QA3 F5: the bridge\'s door names the step by its pack\'s own title, in the list and in the words of the press, and a start refreshes the talk\'s topics (mutants: the raw names, the refresh)', () => {
  let topics = 0;
  const bridge = createQuestBridge({
    data: { readListTable: () => '', getQuestSourceLines: (n) => ({ S0000071: STEP, S0000072: NEXT })[n] ?? null },
    world: {}, classicSeconds: () => 0, playerEntity: { level: 1, name: 'Tester', gender: 'male' }, getReputation: () => 0,
    forceTopicListsUpdate: () => { topics++; },
  });
  bridge.machine.restoreSaveData({ siteLinks: [], quests: [] });
  bridge.machine.seedStory([{ quest: 'S0000071', success: false }]);
  assert.deepEqual(bridge.journalClean.storyAgain(), [{ questName: 'S0000071', title: 'The Courier Again' }]);
  const before = topics;
  const out = bridge.journalClean.startStoryAgain('S0000071');
  assert.equal(out.ok, true);
  assert.equal(out.text, 'The Courier Again begins again from its first step. The main story can go on.');
  assert.ok(topics > before, 'the talk\'s topics read again');
});

test('QA3 F5: a copy a `start quest` has scheduled, not yet started, is running - the door waits (mutants: the scheduled arm)', () => {
  const m = new QuestMachine({ nowSeconds: () => 0, playerLevel: () => 1, getQuestSourceLines: (n) => ({ S0000071: STEP, S0000072: NEXT })[n] ?? null });
  m.restoreSaveData({ siteLinks: [], quests: [] });
  m.seedStory([{ quest: 'S0000071', success: false }]);
  assert.equal(m.storyAgainRefusal('S0000071'), null);
  m.scheduleQuestByName('S0000071');
  assert.equal(m.storyAgainRefusal('S0000071'), 'running', 'scheduled, the next tick starts it');
});
