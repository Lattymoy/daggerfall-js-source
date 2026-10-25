// QUEST-AUDIT III (2026-10-23, the owner: "Can you do a detailed quest audit, fix any and all outstanding issues. Do not
// worry about DFU parity."; bible/01-Overview/audits/Quest-Audit-III.md). The quest's life - its end, its children, its
// questions, its restart, its shelf - each fix pinned here by its law:
//
// - END-GRACE: a quest saved inside its `end quest`'s two ticks of grace (a reward box holds the tick) ends after the
//   load (quest/machine.js restoreSaveData, endQuestRan).
// - END-ONCE: a second `end quest` inside the grace extends it and pays nothing more (quest/quest.js endQuest).
// - START-HELD: a `start quest` scheduled and not yet started rides the save (machine.js getSaveData `toInvoke`).
// - PROMPT-HELD: a question is spent by its answer, not by its box (quest/actions.js Prompt, PromptMulti, holdPrompt).
// - RESTART-PAID: a quest that paid out refuses QUEST-RESET's restart (machine.js questPaidOut, restartRefusal).
// - SHELF-TWIN: a second copy of a quest item is never taken, and "is it kept" reads every keeping
//   (item/itemTransfer.js holdsQuestTwin, keepsQuestItem).
// - RESTART-WORDS: a questline step the journal restarted is not a stall (questlines/qlLineRunner.js look, ended).
// - NO-ASKS-AGAIN's clearing No (quest/noAsksAgain.js clearingNo): C0C00Y10's healer itself is fb1013e_noasks.test.js's;
//   here the No's refusals and the law's own order, on a script of the healer's shape.
// - DUEL-TOWN: A0C00Y10's journal names the inn's own town (quest/questPatches.js).
//
// Every quest here is a script through the real parser and machine - none needs ARENA2: its places are none, its
// asking a click on an Item, its answers through the box's own callback, its saves through the machine's own envelope.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { QuestMachine, questPaidOut } from '../../../src/systems/quest/machine.js';
import { restartRefusalText } from '../../../src/scenes/quest/questBridge.js';
import { planTake, holdsQuestTwin, keepsQuestItem, REFUSAL } from '../../../src/systems/item/itemTransfer.js';
import { createLineRunner } from '../../../src/systems/questlines/qlLineRunner.js';
import { QUESTLINES_PREF } from '../../../src/systems/questlines/qlLaw.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { promptsThatAskAgain } from '../../../src/systems/quest/noAsksAgain.js';
import { applyQuestPatches, QUEST_PATCHES } from '../../../src/systems/quest/questPatches.js';
import { expandQuestMessage } from '../../../src/systems/quest/questMacros.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  loadQuestTables(sources);
}
const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

/** A script: two messages, a gold Item and a letter, then `body` (the start-up block, then its tasks). */
const script = (name, body) => [`Quest: ${name}`, `DisplayName: ${name}`, 'QRC:', 'Message:  1011', ' x', '', 'Message:  1012', ' y', '',
  'QBN:', 'Item _gold_ gold', 'Item _letter_ letter', '', ...body];
const SOURCES = {
  // `end quest` under a reward: `_S.01_` set, the gold given and the quest ended in one tick
  __END: script('__END', ['_S.00_ task:', '\twhen _S.01_', '\tgive pc _gold_', '\tend quest', '', 'variable _S.01_']),
  // a reward's end, and a deadline's: M0C00Y11's `_S.02_` (give pc nothing / end quest) and `_2dung_ task: end quest`
  __END2: script('__END2', ['\tlog 1011 step 0', '', '_S.00_ task:', '\tgive pc nothing', '\tend quest', '', '_S.01_ task:', '\tend quest']),
  // a quest whose start-up starts another (S0000012's `start quest 20 20`, by name)
  __MOM: script('__MOM', ['\tstart quest __KID', '\tlog 1011 step 0']),
  __KID: script('__KID', ['\tlog 1012 step 0']),
  // a question at start-up (S0000003's `prompt QuestorOffer`), and a 2-button one
  __ASK: script('__ASK', ['\tprompt 1011 yes _yes_ no _no_', '', 'variable _yes_', 'variable _no_']),
  __MULTI: script('__MULTI', ['\tpromptmulti 1011 4:a _a_ 5:b _b_', '', 'variable _a_', 'variable _b_']),
};
/** A machine over SOURCES (and `more`), every box it raises kept with its answer's door. */
function rig(extra = {}, more = {}) {
  const seen = { boxes: [], rep: [], filed: [], ending: [], ended: [] };
  const m = new QuestMachine({
    nowSeconds: () => 0, playerLevel: () => 1, getQuestSourceLines: (name) => more[name] ?? SOURCES[name] ?? null,
    showPrompt: (q, message, respond) => { seen.boxes.push({ id: message.id, respond }); },
    showPromptMulti: (q, message, buttons, respond) => { seen.boxes.push({ id: message.id, buttons, respond }); },
    showPopup() {}, addGold() {}, giveItemToPlayer() {}, changeLegalRep() {},
    changeReputation: (fid, amount) => seen.rep.push([fid, amount]),
    addFinishedQuest: (messages) => seen.filed.push(messages.length),
    questEnding: (q) => seen.ending.push(q.questName),
    onQuestEnded: (q) => seen.ended.push(q.questName),
    ...extra,
  });
  m.seen = seen;
  return m;
}
const ticks = (m, n = 5) => { for (let i = 0; i < n; i++) m.tick(); };
const envelope = (m) => JSON.parse(JSON.stringify(m.getSaveData()));
const task = (q, name) => q.getTask({ name });
const promptOf = (q) => [...q.tasks.values()].flatMap((t) => t.actions).find((a) => /^Prompt/.test(a.typeName));
const live = (m) => [...m.quests.values()].filter((q) => !q.questTombstoned).map((q) => q.questName).sort();

test('END-GRACE: a quest saved inside its `end quest`\'s two ticks of grace ends after the load, in the same two ticks as the copy never saved; one whose `end quest` has not run runs on, and a tombstone is not set ending again (mutants: the re-arm, the run test, the complete guard)', () => {
  const m = rig();
  const q = m.startQuestByName('__END');
  m.tick();
  const before = envelope(m);   // `end quest` not yet run
  q.startTask({ name: 'S.01' });
  m.tick();
  assert.equal(q.ticksToEnd, 2, 'the fixture: `end quest` has run, its grace begun');
  assert.ok(q.questSuccess && !q.questComplete);
  const saved = envelope(m);   // the reward box up: the five-minute save, the page-hide save
  assert.equal('ticksToEnd' in saved.quests[0], false, 'the envelope carries no grace');

  const back = rig();
  back.restoreSaveData(saved);
  const qb = back.getQuest(q.uid);
  assert.equal(qb.ticksToEnd, 2, 'loaded: the grace again');
  back.tick(); m.tick();
  assert.deepEqual([qb.questComplete, q.questComplete], [false, false], 'one tick of grace left, on both');
  back.tick(); m.tick();
  assert.deepEqual([qb.questComplete, qb.questTombstoned], [true, true], 'the loaded copy ends');
  assert.deepEqual([q.questComplete, q.questTombstoned], [true, true], 'as the copy never saved ends');
  assert.deepEqual(back.seen.ended, ['__END']);
  assert.deepEqual(back.seen.ending, [], 'its `end quest` paid before the save: the load pays nothing again');

  const early = rig();
  early.restoreSaveData(before);
  const qe = early.getQuest(q.uid);
  assert.equal(qe.ticksToEnd, 0, 'an `end quest` not yet run is not ending');
  ticks(early, 10);
  assert.equal(qe.questComplete, false, 'it runs on');

  const tomb = rig();
  tomb.restoreSaveData(envelope(m));
  const qt = tomb.getQuest(q.uid);
  assert.ok(qt.questTombstoned, 'the fixture: the week of its tombstone');
  assert.equal(qt.ticksToEnd, 0, 'a tombstone is not set ending again');
});

test('END-ONCE: a second `end quest` inside the first one\'s grace - a deadline running out under the reward box - pays nothing more: the faction\'s standing moved once, the notebook filed once; it extends the grace by its two ticks (mutants: the guard, the extension)', () => {
  const m = rig();
  const q = m.startQuestByName('__END2', 40);
  m.tick();
  q.startTask({ name: 'S.00' });
  m.tick();
  assert.equal(q.ticksToEnd, 2, 'the reward\'s `end quest`');
  assert.deepEqual([m.seen.rep, m.seen.filed, m.seen.ending], [[[40, 5]], [1], ['__END2']], 'paid once: +5, one entry');
  q.startTask({ name: 'S.01' });   // the deadline, inside the grace
  m.tick();
  assert.equal(q.ticksToEnd, 2, 'the grace extended');
  m.tick();
  assert.equal(q.questComplete, false, 'one tick of the extended grace left');
  m.tick();
  assert.ok(q.questComplete && q.questTombstoned, 'and then it ends');
  ticks(m);
  assert.deepEqual([m.seen.rep, m.seen.filed, m.seen.ending, m.seen.ended], [[[40, 5]], [1], ['__END2'], ['__END2']], 'nothing paid twice');
});

test('START-HELD: a quest a `start quest` scheduled and the next tick has not started rides the save (`toInvoke`) and starts on the loaded game\'s first tick, its uid its own; a save with none writes no field; a child named twice, or already running, is scheduled once (mutants: the field, its gate, the restore, the dedupe of each)', () => {
  const m = rig();
  m.startQuestByName('__MOM');
  m.tick();
  assert.deepEqual(m.questsToInvoke.map((q) => q.questName), ['__KID'], 'the fixture: `start quest __KID` scheduled, not started');
  const kid = m.questsToInvoke[0].uid;
  const saved = envelope(m);
  assert.deepEqual(saved.toInvoke?.map((d) => [d.questName, d.uid]), [['__KID', kid]], 'the envelope holds it');
  assert.deepEqual(saved.quests.map((d) => d.questName), ['__MOM']);

  const back = rig();
  back.restoreSaveData(saved);
  assert.deepEqual(back.questsToInvoke.map((q) => [q.questName, q.uid]), [['__KID', kid]], 'loaded: still scheduled');
  back.tick();
  assert.deepEqual(live(back), ['__KID', '__MOM'], 'and started by the first tick');
  assert.equal(back.getQuest(kid)?.questName, '__KID');
  assert.deepEqual(back.questsToInvoke, []);
  assert.equal('toInvoke' in envelope(back), false, 'a save with none waiting is the shape it always was');

  const twice = rig();
  twice.restoreSaveData({ ...saved, toInvoke: [saved.toInvoke[0], saved.toInvoke[0]] });
  assert.equal(twice.questsToInvoke.length, 1, 'one child, scheduled once');
  m.tick();   // the copy never saved starts its child
  const running = envelope(m);
  const both = rig();
  both.restoreSaveData({ ...running, toInvoke: saved.toInvoke });
  assert.deepEqual(both.questsToInvoke, [], 'a child already running is not scheduled again');
  both.tick();
  assert.deepEqual(live(both), ['__KID', '__MOM']);
});

test('PROMPT-HELD: a question is spent by its answer, not by its box - asked once while its box is up, complete on the answer and never asked again; a save while it is up loads asking again; a host with no box spends it at once (mutants: the hold, the answer\'s complete, the no-box arm, the machine\'s two doors)', () => {
  const m = rig();
  const q = m.startQuestByName('__ASK');
  ticks(m);
  assert.deepEqual(m.seen.boxes.map((b) => b.id), [1011], 'asked once, five ticks under the box');
  assert.equal(promptOf(q).isComplete, false, 'asked, not answered');
  const saved = envelope(m);
  m.seen.boxes[0].respond(true);
  assert.equal(promptOf(q).isComplete, true, 'the answer spends it');
  ticks(m);
  assert.equal(task(q, 'yes').getTriggerValue(), true, 'Yes: `_yes_`');
  assert.equal(m.seen.boxes.length, 1, 'never asked again');

  const back = rig();
  back.restoreSaveData(saved);
  const qb = back.getQuest(q.uid);
  ticks(back);
  assert.deepEqual(back.seen.boxes.map((b) => b.id), [1011], 'loaded: asked again, once');
  back.seen.boxes[0].respond(false);
  ticks(back);
  assert.deepEqual([promptOf(qb).isComplete, task(qb, 'no').getTriggerValue(), back.seen.boxes.length], [true, true, 1]);

  // no box: a host whose box answers false, and a machine with no box at all
  const refused = rig({ showPrompt: (q2, message, respond) => { refused.seen.boxes.push({ id: message.id, respond }); return false; } });
  const qr = refused.startQuestByName('__ASK');
  ticks(refused);
  assert.equal(promptOf(qr).isComplete, true, 'no box to answer it: spent at once, as before');
  assert.equal(refused.seen.boxes.length, 1, 'and asked once');
  const bare = new QuestMachine({ nowSeconds: () => 0, getQuestSourceLines: (name) => SOURCES[name] ?? null });
  const qn = bare.startQuestByName('__ASK');
  ticks(bare);
  assert.equal(promptOf(qn).isComplete, true, 'no showPrompt: spent at once');
});

test('PROMPT-HELD, PromptMulti: the 2-4 button box is held the same way - asked once while up, complete on its button, its button\'s task started; no box spends it at once (mutants: the hold, the no-box arm, the machine\'s two doors)', () => {
  const m = rig();
  const q = m.startQuestByName('__MULTI');
  ticks(m);
  assert.deepEqual(m.seen.boxes.map((b) => [b.id, b.buttons]), [[1011, [4, 5]]]);
  assert.equal(promptOf(q).isComplete, false);
  m.seen.boxes[0].respond(5);
  ticks(m);
  assert.deepEqual([promptOf(q).isComplete, task(q, 'b').getTriggerValue(), task(q, 'a').getTriggerValue(), m.seen.boxes.length], [true, true, false, 1]);
  const refused = rig({ showPromptMulti: () => false });
  const qr = refused.startQuestByName('__MULTI');
  ticks(refused);
  assert.equal(promptOf(qr).isComplete, true, 'no box: spent at once');
  const bare = new QuestMachine({ nowSeconds: () => 0, getQuestSourceLines: (name) => SOURCES[name] ?? null });
  const qn = bare.startQuestByName('__MULTI');
  ticks(bare);
  assert.equal(promptOf(qn).isComplete, true, 'no showPromptMulti: spent at once');
});

test('PROMPT-HELD: a party\'s resync, which rebuilds every action, finds the box held at its place (its task, its index) and does not ask again; the answer spends the action standing there now; the bridge hands the host\'s box through by the same law (mutants: the resync\'s complete; source pin: the bridge\'s doors)', () => {
  const m = rig();
  const q = m.startQuestByName('__ASK');
  ticks(m);
  const asked = promptOf(q);
  q.restoreSaveData(envelope(m).quests.find((d) => d.uid === q.uid), m._saveResolvers());   // updateSharedQuest's own restore, in place
  const rebuilt = promptOf(q);
  assert.notEqual(rebuilt, asked, 'the fixture: a new action at the place');
  ticks(m);
  assert.equal(m.seen.boxes.length, 1, 'the box is up: not asked again');
  m.seen.boxes[0].respond(true);
  assert.equal(rebuilt.isComplete, true, 'the answer spends the action at its place now');
  ticks(m);
  assert.equal(m.seen.boxes.length, 1, 'and nothing asks again');
  assert.equal(task(q, 'yes').getTriggerValue(), true);

  const bridge = src('src/scenes/quest/questBridge.js');
  assert.match(bridge, /showPrompt: \(q, message, respond\) => \(ctx\.showPrompt \? ctx\.showPrompt\(q, message, respond\) \?\? true : false\),/);
  assert.match(bridge, /showPromptMulti: \(q, message, buttons, respond\) => \(ctx\.showPromptMulti \? ctx\.showPromptMulti\(q, message, buttons, respond\) \?\? true : false\),/);
});

// PIN MOVED (AUDIT QA3 A2/B3): "paid" is narrowed to what a restart cannot take back and would pay again - a trainer's
// lesson, or an item handed over (a `give pc` that is no `give pc nothing`, a `get item`) that is not gold and is the
// player's for good (made permanent, or released: its item no quest item). Gold is not (restartQuest carries the old
// copy's goldPaid marks to the new copy - auditqa3_life.test.js A2), standing is not (P0B00L01's errand), the
// QuestComplete box alone is not (A0C41Y18's `give pc nothing`), a permanent item nobody handed over is not (M0B00Y16).
test('RESTART-PAID: questPaidOut\'s arms - a trainer, an item handed over (given or got) that is the player\'s for good, made permanent or released; never gold, standing, the box alone, `give pc nothing`, a `make permanent` of an item nobody handed over, an action not yet run, a quest item handed over (mutants: each arm)', () => {
  const m = rig();
  const parsed = m.parseQuestShape('__END');
  const gold = parsed.getItem({ name: 'gold' }).daggerfallUnityItem;
  const letter = parsed.getItem({ name: 'letter' }).daggerfallUnityItem;
  assert.equal(letter.questItem, true, 'the fixture: the letter is a quest item until it is released');
  const released = { ...letter, questItem: false };
  /** A quest of one task holding `actions`, its Items `items` by symbol name (its resources too, unless `listed` is false -
   *  the Item an action names, read by that action alone). */
  const quest = (actions, items = {}, extra = {}, listed = true) => ({
    tasks: new Map([['t', { actions }]]), resources: new Map(listed ? Object.entries(items).map(([k, v]) => [k, { isItem: true, ...v }]) : []),
    getItem: (s) => items[s?.name] ?? null, ...extra,
  });
  const did = (typeName, more = {}) => ({ typeName, isComplete: true, ...more });
  const sym = { name: 'x' };
  assert.equal(questPaidOut(quest([], {}, { questSuccess: true })), false, 'the QuestComplete box alone (`give pc nothing`) pays nothing');
  assert.equal(questPaidOut(quest([did('TrainPc')])), true, 'a trainer');
  assert.equal(questPaidOut(quest([did('MakePermanent')])), false, '`make _x_ permanent` alone: nobody handed it over');
  for (const typeName of ['GivePc', 'GetItem']) {
    assert.equal(questPaidOut(quest([did(typeName, { itemSymbol: sym })], { x: { daggerfallUnityItem: gold } })), false, `${typeName}: gold rides the restart as paid`);
    assert.equal(questPaidOut(quest([did(typeName, { itemSymbol: sym })], { x: { daggerfallUnityItem: gold, goldPaid: true, madePermanent: true } })), false, `${typeName}: gold, paid and made permanent`);
    assert.equal(questPaidOut(quest([did(typeName, { itemSymbol: sym })], { x: { daggerfallUnityItem: letter, madePermanent: true } }, {}, false)), true, `${typeName}: an item made permanent`);
    assert.equal(questPaidOut(quest([did(typeName, { itemSymbol: sym })], { x: { daggerfallUnityItem: released } }, {}, false)), true, `${typeName}: an item released, no quest item`);
    assert.equal(questPaidOut(quest([did(typeName, { itemSymbol: sym })], { x: { daggerfallUnityItem: letter } })), false, `${typeName}: a quest item, taken back`);
    assert.equal(questPaidOut(quest([did(typeName, { itemSymbol: sym })], {})), false, `${typeName}: an Item the quest does not hold`);
    assert.equal(questPaidOut(quest([{ ...did(typeName, { itemSymbol: sym }), isComplete: false }], { x: { daggerfallUnityItem: released } })), false, `${typeName}: not yet run`);
  }
  assert.equal(questPaidOut(quest([did('GivePc', { isNothing: true, itemSymbol: sym })], { x: { daggerfallUnityItem: released } })), false, '`give pc nothing` is an empty box');
  for (const typeName of ['ChangeReputeWith', 'LegalRepute']) {
    assert.equal(questPaidOut(quest([did(typeName, { amount: 5 })])), false, `${typeName}: standing is no purse`);
    assert.equal(questPaidOut(quest([did(typeName, { amount: -5 })])), false, `${typeName}: standing lost`);
  }
  assert.equal(questPaidOut(quest([{ ...did('TrainPc'), isComplete: false }, { ...did('MakePermanent'), isComplete: false }])), false, 'not yet run');
  assert.equal(questPaidOut(quest([did('GiveItem', { itemSymbol: sym })], { x: { daggerfallUnityItem: released } })), false, 'an item handed to a foe is not paid');
  assert.equal(questPaidOut(quest([], { x: { daggerfallUnityItem: letter, madePermanent: true } })), false, 'an Item made permanent that nobody handed over');
  assert.equal(questPaidOut(quest([], { x: { daggerfallUnityItem: letter } })), false);
  assert.equal(questPaidOut(null), false);
});

// PIN MOVED (AUDIT QA3 A2/B3/B1): gold got, the box alone and standing gained restart now (their verdicts null); a
// `make permanent` with no hand-over restarts; a quest whose `start quest` has run refuses 'started', after 'paid'.
test('RESTART-PAID: a running quest that paid its player - a reward box\'s item, an item made permanent, a trainer - refuses the journal\'s Restart (\'paid\', in words) and runs on; one that paid only gold, the box alone or standing, handed only a quest item, made permanent an item it never handed over, lost standing, or has not paid yet restarts; one whose `start quest` ran refuses \'started\' (mutants: the rung)', () => {
  const PAY = {
    __GOLD: ['\tget item _gold_'], __GIVE: ['\tgive pc _letter_'], __NOTHING: ['\tgive pc nothing'], __PERM: ['\tget item _letter_', '\tmake _letter_ permanent'],
    __TRAIN: ['\ttrain pc Medical'], __UP: ['\tlegal repute +5'], __LOOT: ['\tmake _letter_ permanent'],
    __LETTER: ['\tget item _letter_'], __DOWN: ['\tlegal repute -5'], __LATER: ['\tlog 1011 step 0', '', '_S.00_ task:', '\twhen _S.01_', '\tget item _gold_', '', 'variable _S.01_'],
    __MOM: ['\tstart quest __KID', '\tlog 1011 step 0'],
  };
  const m = rig({}, Object.fromEntries(Object.entries(PAY).map(([k, v]) => [k, script(k, v)])));
  const verdicts = {};
  for (const name of Object.keys(PAY)) {
    const q = m.startQuestByName(name);
    ticks(m, 2);
    assert.equal(q.questComplete, false, `${name} runs`);
    verdicts[name] = m.restartRefusal(q.uid);
  }
  assert.deepEqual(verdicts, { __GOLD: null, __GIVE: 'paid', __NOTHING: null, __PERM: 'paid', __TRAIN: 'paid', __UP: null, __LOOT: null, __LETTER: null, __DOWN: null, __LATER: null, __MOM: 'started' });
  const paid = [...m.quests.values()].find((q) => q.questName === '__GIVE');
  assert.deepEqual(m.restartQuest(paid.uid), { ok: false, reason: 'paid' });
  assert.equal(m.getQuest(paid.uid), paid, 'it runs on to its end');
  assert.equal(restartRefusalText('paid'), 'That quest has already paid you, so it cannot be started again.');
  const letter = [...m.quests.values()].find((q) => q.questName === '__LETTER');
  const r = m.restartQuest(letter.uid);
  assert.equal(r.ok, true, 'a quest item handed over: the restart takes it back');
  assert.notEqual(r.quest.uid, letter.uid);
});

test('SHELF-TWIN: a quest item is never taken while another copy of it is kept - in the basket or the pack, the wagon, the Materials Bag; the item itself, another quest\'s, another symbol\'s and a plain item are no twin (mutants: the refusal, each keeping, each test)', () => {
  const qi = (uid, name, more = {}) => ({ name: 'Letter', stackCount: 1, weightInKg: 0.1, questItem: true, questUID: uid, questSymbol: { name }, ...more });
  const item = qi(7, 'letter');
  const lists = () => ({ items: [], wagonItems: [], bagItems: [], otherItems: [] });
  for (const where of ['bag', 'items', 'wagonItems', 'bagItems']) {
    const entity = lists();
    const bag = [];
    (where === 'bag' ? bag : entity[where]).push(qi(7, 'letter'));
    const r = planTake(item, { bag, entity, dryRun: true });
    assert.deepEqual([r.ok, r.refusal?.reason], [false, 'questTwin'], `a copy in ${where}`);
  }
  assert.equal(REFUSAL.questTwin.text, 'You already have this quest item.');
  const notTwin = (bag, entity = lists(), it = item) => planTake(it, { bag, entity, dryRun: true }).refusal?.reason !== 'questTwin';
  assert.ok(notTwin([]), 'none kept');
  const own = lists();
  own.wagonItems.push(item);
  assert.ok(notTwin([], own), 'the item itself, taken out of the wagon');
  assert.ok(notTwin([qi(8, 'letter')]), 'another quest\'s letter');
  assert.ok(notTwin([qi(7, 'relic')]), 'another symbol of the quest');
  assert.ok(notTwin([qi(7, 'letter')], lists(), { ...item, questItem: false }), 'a plain item (one made permanent)');
  assert.equal(holdsQuestTwin([[qi(7, 'letter')]], { ...item, questItem: false }), false);
  assert.equal(holdsQuestTwin([null, [{ ...qi(7, 'letter'), questItem: false }]], item), false, 'a permanent copy is the player\'s own');
  assert.equal(holdsQuestTwin([null, [qi(7, 'letter')]], item), true);
});

// PIN MOVED (AUDIT QA3 B8): the host's carriesQuestItem is the pack again (main's expression) - `toting` and `have` read
// it, and widened, the wagon's dust ran S0000022's step - and its own keepsQuestItem dep serves the reclaim (machine.js
// reclaimQuest); the share's relay keeps every keeping. The behaviour is auditqa3_life.test.js B8's.
test('SHELF-TWIN: keepsQuestItem - the reclaim\'s "is it kept" - reads every keeping: the pack, the wagon, the Materials Bag, a repairer\'s hands; never a permanent copy; the host hands it to the machine as keepsQuestItem and to the share\'s relay, its carriesQuestItem the pack alone (mutants: each keeping, the quest test; source pins: the host\'s three seams)', () => {
  const res = { parentQuest: { uid: 7 }, symbol: { name: 'letter' } };
  const kept = { questItem: true, questUID: 7, questSymbol: { name: 'letter' } };
  for (const where of ['items', 'wagonItems', 'bagItems', 'otherItems']) {
    assert.equal(keepsQuestItem({ [where]: [kept] }, res), true, where);
    assert.equal(keepsQuestItem({ [where]: [{ ...kept, questSymbol: { name: 'relic' } }] }, res), false, `${where}: another symbol`);
    assert.equal(keepsQuestItem({ [where]: [{ ...kept, questUID: 8 }] }, res), false, `${where}: another quest`);
    assert.equal(keepsQuestItem({ [where]: [{ ...kept, questItem: false }] }, res), false, `${where}: a permanent copy`);
  }
  assert.equal(keepsQuestItem({}, res), false);
  assert.equal(keepsQuestItem(null, res), false);
  const world = src('src/scenes/world.js');
  assert.equal((world.match(/carriesQuestItem: \(res\) => keepsQuestItem\(playerEntity, res\),/g) ?? []).length, 1, 'the share\'s relay: every keeping');
  assert.equal((world.match(/keepsQuestItem: \(res\) => keepsQuestItem\(playerEntity, res\),/g) ?? []).length, 1, 'the machine\'s reclaim: every keeping');
  assert.match(world, /carriesQuestItem: \(res\) => \(playerEntity\.items \?\? \[\]\)\.some\(\(it\) =>\n\s*it\.questItem && it\.questUID === res\.parentQuest\?\.uid && it\.questSymbol\?\.name === res\.symbol\?\.name\),\n\s*keepsQuestItem: \(res\) => keepsQuestItem\(playerEntity, res\),/, 'the machine\'s `toting` and `have`: the pack');
});

test('RESTART-WORDS: a questline step the journal restarted is no stall - its end lets the drop\'s "could not begin" go, and the runner\'s next look, the step running again, lets go its day of waiting; a step that truly could not begin is still said, and tried again a day later, never every look (mutants: the end\'s clear, the look\'s clear, its wait, its running test)', () => {
  setPref(QUESTLINES_PREF, true);
  const make = (refuse = false) => {
    let uid = 1;
    const m = {
      quests: new Map(), questsToInvoke: [], scheduled: 0,
      scheduleQuestByName(name) { m.scheduled++; if (refuse) return null; const q = { uid: uid++, questName: name, questComplete: false, questTombstoned: false }; m.questsToInvoke.push(q); return q; },
      tick() { for (const q of m.questsToInvoke.splice(0)) m.quests.set(q.uid, q); },
    };
    const clock = { s: 1000 };
    const runner = createLineRunner({ machine: m, ctx: { level: () => 2, online: () => false, nowSeconds: () => clock.s, outcomeText: () => 'ok' } });
    // PIN MOVED (QL-OFFERED): the line taken - and the refused case stands at its second step (a save's), for a first
    // step that will not begin is no take at all (its line stays on offer)
    if (refuse) runner.restore({ introTables: { step: 1, outcomes: {}, done: false, wait: 0, claims: {}, taken: true } });
    else runner.takeLine('introTables');
    runner.look(); m.tick();
    /** The journal's Restart (machine.js restartQuest): the old copy removed - its tombstone hands it to `dropped` - and
     *  the new started. */
    const restart = () => {
      const old = [...m.quests.values()].find((q) => q.questName === 'QLIT01');
      const fresh = { uid: uid++, questName: 'QLIT01', questComplete: false, questTombstoned: false };
      old.questTombstoned = true;
      runner.dropped(old);
      m.quests.delete(old.uid);
      m.quests.set(fresh.uid, fresh);
      return fresh;
    };
    return { m, clock, runner, restart, rec: () => runner.snapshot().introTables, row: () => runner.rows().find((r) => r.id === 'introTables') };
  };
  const STALLED = 'Its next step could not begin here: it will be offered again.';

  const a = make();
  const fresh = a.restart();
  assert.equal(a.rec().stalled, true, 'the fixture: the drop marks the line');
  fresh.questComplete = true;
  fresh.questSuccess = true;
  assert.equal(a.runner.ended(fresh, { id: 'done', failure: false })?.moved, true);
  assert.equal(a.rec().stalled, false, 'a step that ended began');
  assert.deepEqual([a.row().state, a.row().opens], ['waiting', null], 'between steps, nothing said');

  const b = make();
  b.restart();
  b.runner.look();
  assert.deepEqual([b.rec().stalled, b.rec().wait], [false, 0], 'running again: no stall, no day of waiting');
  assert.equal(b.row().state, 'running', 'QL-OFFERED: a first step restarted is the line\'s still - never put back on offer');

  const c = make(true);
  assert.deepEqual([c.rec().stalled, c.m.scheduled, c.row().opens], [true, 1, STALLED], 'a step that could not begin is said');
  for (let i = 0; i < 5; i++) c.runner.look();
  assert.equal(c.m.scheduled, 1, 'tried again a day later, never every look');
  assert.equal(c.rec().stalled, true);
  c.clock.s += 24 * 3600;
  c.runner.look();
  assert.equal(c.m.scheduled, 2, 'a day on, again');
});

/** The healer's shape (C0C00Y10's `_S.10_` / `_no_ task: clear _S.10_`) on a click of the letter: `no` the No task's
 *  lines, `more` lines after. */
const heal = (no = ['_no_ task:', '\tclear _S.10_'], more = []) => script('__HEAL', ['_S.10_ task:', '\tclicked item _letter_', '\tprompt 1011 yes _S.11_ no _no_', '', ...no, '', 'variable _S.11_', ...more]);

test('NO-ASKS-AGAIN\'s clearing No: a No whose every action clears its click-asked task asks again (twice cleared, twice named); a No that does more, clears another task, drops it, is named twice or is a variable, a line unparsed, or an asking named elsewhere, is DFU\'s (mutants: each refusal, the clears count)', () => {
  const law = (lines) => promptsThatAskAgain(rig({}, { __HEAL: lines }).parseQuestShape('__HEAL')).map((e) => [e.task.symbol.name, e.no.symbol.name, e.clears]);
  assert.deepEqual(law(heal()), [['S.10', 'no', true]], 'the healer\'s');
  assert.deepEqual(law(heal(['_no_ task:', '\tclear _S.10_', '\tclear _S.10_'])), [['S.10', 'no', true]], 'cleared twice: the asking named by the No alone');
  const refused = {
    'does more': heal(['_no_ task:', '\tclear _S.10_', '\tsay 1012']),
    'drops it': heal(['_no_ task:', '\tunset _S.10_']),
    'clears another too': heal(['_no_ task:', '\tclear _S.10_ _S.11_'], ['', '_heard_ task:', '\twhen _S.10_', '\tsay 1012']),
    'named twice': heal(undefined, ['', '_heard_ task:', '\twhen _no_', '\tsay 1012']),
    'a variable': heal(['variable _no_', '_no_ task:', '\tclear _S.10_']),
    'a line unparsed': heal(['_no_ task:', '\tclear _S.10_', '\tfrobnicate the healer']),
    'an empty No': heal(['_no_ task:']),
    'the asking named elsewhere': heal(undefined, ['', '_heard_ task:', '\twhen _S.10_', '\tsay 1012']),
  };
  for (const [why, lines] of Object.entries(refused)) assert.deepEqual(law(lines), [], why);
});

test('NO-ASKS-AGAIN\'s clearing No, in play: after each No the next click - and only a click - asks again, once its own `clear` has run; a Yes goes on; a No that does more is asked once (mutants: the clearer read, the order, the prompt left complete, the No left set, the place held after the answer)', () => {
  const play = (lines) => {
    const m = rig({}, { __HEAL: lines });
    const q = m.startQuestByName('__HEAL');
    ticks(m, 2);
    const click = () => { q.getItem({ name: 'letter' }).setPlayerClicked(); m.tick(); };
    const answer = (yes) => { m.tick(); m.seen.boxes.at(-1).respond(yes); ticks(m, 3); };
    return { m, q, click, answer };
  };
  const { m, q, click, answer } = play(heal());
  click();
  assert.equal(m.seen.boxes.length, 1, 'the click asks');
  answer(false);
  assert.deepEqual([promptOf(q).isComplete, task(q, 'no').getTriggerValue(), task(q, 'S.10').getTriggerValue()], [false, false, false], 'armed again, the No cleared, the asking cleared by its own `clear`');
  ticks(m);
  assert.equal(m.seen.boxes.length, 1, 'nothing asks without a click');
  click();
  assert.equal(m.seen.boxes.length, 2, 'the next click asks again');
  answer(false);
  click();
  assert.equal(m.seen.boxes.length, 3, 'and again, after a second No');
  answer(true);
  assert.equal(task(q, 'S.11').getTriggerValue(), true, 'a Yes goes on');
  click();
  ticks(m);
  assert.equal(m.seen.boxes.length, 3, 'a Yes is final');

  const more = play(heal(['_no_ task:', '\tclear _S.10_', '\tsay 1012']));
  more.click();
  more.answer(false);
  more.click();
  ticks(more.m);
  assert.equal(more.m.seen.boxes.length, 1, 'a No that does more: DFU\'s, asked once');
});

test('DUEL-TOWN: A0C00Y10\'s journal names the inn\'s own town - its duel at the nearest town\'s inn is sent there, not to the questor\'s town; the patch moves that one word and nothing else (mutants: the patch\'s words)', () => {
  const raw = read(join(VENDOR, 'Quests', 'A0C00Y10.txt'));
  const patched = applyQuestPatches('A0C00Y10', raw);
  assert.deepEqual(QUEST_PATCHES.A0C00Y10().map((p) => p.count), [1]);
  const norm = (s) => s.replace(/\r\n?/g, '\n');
  assert.equal(norm(patched), norm(raw).replace(' _inn_ in ___giver_ in six hours.', ' _inn_ in ___inn_ in six hours.'), 'one word moved');
  /** The QuestFail entry (1003) as the journal says it, the inn at Moriribia and the questor of Glaghton Court. */
  const entry = (text) => {
    const lines = text.split(/\r?\n/);
    const q = rig({}, { A0C00Y10: lines }).parseQuestShape('A0C00Y10');
    const stub = (name, isPlace, names) => ({ symbol: { name }, isPlace, isPerson: !isPlace, expandMacro: (type) => names[type] ?? null });
    q.resources.set('inn', stub('inn', true, { 1: 'The Rusty Mug', 3: 'Moriribia' }));
    q.resources.set('giver', stub('giver', false, { 1: 'Aldo', 3: 'Glaghton Court' }));
    const tokens = q.getMessage(1003).getTextTokens(-1, () => 0, false);
    expandQuestMessage(q, tokens);   // in place, as the journal's pass
    return tokens.map((t) => t.text).join(' ');
  };
  assert.match(entry(raw), /The Rusty Mug in Glaghton Court in six hours\./, 'the fixture: DFU\'s words name the questor\'s town');
  const said = entry(patched);
  assert.match(said, /I have agreed to duel with Aldo at/);
  assert.match(said, /The Rusty Mug in Moriribia in six hours\./, 'the inn\'s own town');
  assert.doesNotMatch(said, /Glaghton Court/);
});
