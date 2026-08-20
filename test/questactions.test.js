// Q2b-i - THE STATE TRANCHE: per-action law pins for the 25 actions
// that ride resource state, task state, world time and the machine's
// hook seams, plus the resource lifecycle they consume - the click
// law (SetPlayerClicked / the muted-destroyed refusal / PostTick's
// unconditional rearm / ScheduleClickRearm's first-come-first-serve
// click ownership, N0B00Y16), the Foe injury/kill/restrain tracking,
// the questor registry, and the tombstone/end talk halves. Every pin
// asserts against the DFU literal, not the port's own output.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine, QUEST_MESSAGES } from '../src/systems/quest/machine.js';
import { KilledFoe, PlayVideo, QUEST_INFO_RESOURCE_TYPE } from '../src/systems/quest/actions.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');

function loadTables() {
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) {
    if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  }
  loadQuestTables(sources);
}
loadTables();

/** A machine over a mutable clock plus capture-everything hooks. */
function makeMachine(deps = {}) {
  const calls = [];
  const capture = (name) => (...args) => { calls.push([name, ...args]); return deps[`${name}Result`]; };
  const m = new QuestMachine({
    nowSeconds: () => m.now,
    showPopup: (q, message) => calls.push(['showPopup', message]),
    showPrompt: (q, message, respond) => calls.push(['showPrompt', message, respond]),
    changeLegalRep: capture('changeLegalRep'),
    playerLevel: () => deps.level ?? 0,
    getGold: () => m.gold,
    deductGold: (amount) => { m.gold -= amount; calls.push(['deductGold', amount]); },
    playVideo: capture('playVideo'),
    playSound: (soundId) => { calls.push(['playSound', soundId]); return deps.playSoundResult ?? true; },
    dialogLink: capture('dialogLink'),
    addDialog: capture('addDialog'),
    addQuestRumor: capture('addQuestRumor'),
    addProgressRumor: capture('addProgressRumor'),
    addQuestorPostMessage: capture('addQuestorPostMessage'),
    removeProgressRumors: capture('removeProgressRumors'),
    removeQuestorPostMessage: capture('removeQuestorPostMessage'),
    removeQuestRumors: capture('removeQuestRumors'),
    removeQuestInfoTopics: capture('removeQuestInfoTopics'),
    addFace: capture('addFace'),
    dropFace: capture('dropFace'),
    getQuestSourceLines: (name) => { calls.push(['getQuestSourceLines', name]); return deps.childSources?.[name] ?? null; },
  });
  m.now = 0;
  m.gold = 0;
  m.calls = calls;
  m.of = (name) => calls.filter((c) => c[0] === name);
  return m;
}

const HEADER = ['Quest: __QA', 'QRC:', 'Message:  1011', ' x', '', 'Message:  1012', ' y', '', 'QBN:'];
const schedule = (m, qbn) => m.scheduleQuest([...HEADER, ...qbn], 0, { rolls: () => 0 });

// ---------------------------------------------------------------
// The click lifecycle
// ---------------------------------------------------------------

test('click law: SetPlayerClicked triggers ClickedNpc with its say, and PostTick rearms the click', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Person _pp_ group Questor', '',
    '_t_ task:', ' clicked npc _pp_ say 1011', '',
    'variable _pad_',
  ]);
  m.tick();
  const person = q.getResource({ name: 'pp' });
  const t = q.getTask({ name: 't' });
  assert.equal(t.getTriggerValue(), false);

  person.setPlayerClicked();
  assert.equal(person.hasPlayerClicked, true);
  m.tick();
  assert.equal(t.getTriggerValue(), true, 'the click starts the task');
  assert.equal(m.of('showPopup').length, 1, 'the say popup showed');
  // QuestResource.PostTick: the click rearms unconditionally at end
  // of the quest tick - a click lives exactly one tick.
  assert.equal(person.hasPlayerClicked, false);
});

test('click law (N0B00Y16): the FIRST task to handle a click consumes it via ScheduleClickRearm', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Person _pp_ group Questor', '',
    '_a_ task:', ' clicked npc _pp_', '',
    '_b_ task:', ' clicked npc _pp_', '',
    'variable _pad_',
  ]);
  m.tick();
  q.getResource({ name: 'pp' }).setPlayerClicked();
  m.tick();
  assert.equal(q.getTask({ name: 'a' }).getTriggerValue(), true, 'first-come task owns the click');
  assert.equal(q.getTask({ name: 'b' }).getTriggerValue(), false, 'the rearm after task _a_ hides it from _b_');
});

test('click law: a muted or destroyed Person refuses SetPlayerClicked', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Person _pp_ group Questor', '',
    '_t_ task:', ' mute npc _pp_', '',
    'variable _pad_',
  ]);
  m.tick();
  const person = q.getResource({ name: 'pp' });
  q.getTask({ name: 't' }).start(); m.tick();
  assert.equal(person.isMuted, true);
  person.setPlayerClicked();
  assert.equal(person.hasPlayerClicked, false, 'muted refuses the click');
  // MuteNpc's rearm law: clearing the owning task UNMUTES.
  q.getTask({ name: 't' }).clear();
  assert.equal(person.isMuted, false);
  person.setPlayerClicked();
  assert.equal(person.hasPlayerClicked, true);

  person.destroyNPC();
  person.rearmPlayerClick();
  person.setPlayerClicked();
  assert.equal(person.hasPlayerClicked, false, 'destroyed refuses the click');
});

test('ClickedNpc gold gate: enough gold deducts and fires; short gold starts the otherwise-task instead', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Person _pp_ group Questor', '',
    '_t_ task:', ' clicked _pp_ and at least 100 gold otherwise do _broke_', '',
    'variable _broke_',
  ]);
  m.tick();
  const person = q.getResource({ name: 'pp' });

  m.gold = 40;
  person.setPlayerClicked();
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), false, 'short gold refuses the trigger');
  assert.equal(q.getTask({ name: 'broke' }).getTriggerValue(), true, 'and starts the otherwise-task');
  assert.equal(m.gold, 40, 'nothing deducted');

  q.getTask({ name: 'broke' }).clear();
  m.gold = 150;
  person.setPlayerClicked();
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), true);
  assert.deepEqual(m.of('deductGold'), [['deductGold', 100]]);
  assert.equal(m.gold, 50);
});

test('ClickedItem: the item click triggers with its say', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Item _it_ letter', '',
    '_t_ task:', ' clicked item _it_ say 1011', '',
    'variable _pad_',
  ]);
  m.tick();
  const item = q.getResource({ name: 'it' });
  item.setPlayerClicked();
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), true);
  assert.equal(m.of('showPopup').length, 1);
  assert.equal(item.hasPlayerClicked, false, 'PostTick cleared it');
});

// ---------------------------------------------------------------
// Foe tracking triggers
// ---------------------------------------------------------------

test('KilledFoe: fires at the kill count with its saying; a zero count clamps to 1', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Foe _crook_ is 2 Thief', '',
    '_t_ task:', ' killed 2 _crook_ saying 1012', '',
    'variable _pad_',
  ]);
  m.tick();
  const foe = q.getResource({ name: 'crook' });
  foe.incrementKills();
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), false, 'one of two is not enough');
  foe.incrementKills();
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), true);
  assert.equal(m.of('showPopup').length, 1, 'the saying showed');
  assert.equal(foe.killCount, 2, 'kill counts never rearm');

  // "Kills required must be 1 or more" (KilledFoe.cs CreateNew)
  const action = new KilledFoe(null).createNew('killed 0 _crook_', q);
  assert.equal(action.killsRequired, 1);
});

test('InjuredFoe: fires on the injured flag with its saying', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Foe _crook_ is Thief', '',
    '_t_ task:', ' injured _crook_ saying 1011', '',
    'variable _pad_',
  ]);
  m.tick();
  const foe = q.getResource({ name: 'crook' });
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), false);
  foe.setInjured();
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), true);
  assert.equal(m.of('showPopup').length, 1);
});

test('RestrainFoe and RemoveFoe: the restrain flag sets; a missing Foe on remove ERROR-TERMINATES the quest', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Foe _crook_ is Thief', '',
    ' restrain foe _crook_',
    ' remove foe _crook_',
  ]);
  m.tick();
  const foe = q.getResource({ name: 'crook' });
  assert.equal(foe.isRestrained, true);
  assert.equal(foe.isHidden, true, 'remove foe hides (removing ALL spawned instances)');

  const m2 = makeMachine();
  const q2 = schedule(m2, [' remove foe _ghost_']);
  m2.tick();
  assert.equal(q2.questTombstoned, true, 'the throw error-terminated the quest');
  assert.equal(m2.quests.size, 0);
});

// ---------------------------------------------------------------
// Person flag actions
// ---------------------------------------------------------------

test('HideNpc/RestoreNpc: the hidden flag flips; a MISSING person keeps the action trying', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Person _pp_ group Questor', '',
    ' hide npc _pp_',
    '',
    '_r_ task:', ' restore _pp_', '',
    'variable _pad_',
  ]);
  m.tick();
  const person = q.getResource({ name: 'pp' });
  assert.equal(person.isHidden, true);
  q.getTask({ name: 'r' }).start(); m.tick();
  assert.equal(person.isHidden, false);

  // A missing person: update returns WITHOUT SetComplete (HideNpc.cs)
  const m2 = makeMachine();
  const q2 = schedule(m2, [' hide npc _ghost_']);
  m2.tick();
  const startup = [...q2.tasks.values()][0];
  assert.equal(startup.actions[0].isComplete, false, 'still trying');
});

test('DestroyNpc: destroys the person; the Tick destroyed->hidden law is GATED on a scene behaviour', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Person _pp_ group Questor', '',
    ' destroy _pp_',
  ]);
  m.tick();
  const person = q.getResource({ name: 'pp' });
  assert.equal(person.isDestroyed, true);
  // No QuestResourceBehaviour in scene -> Tick's whole body is inert
  // (QuestResource.cs:158 gates on the behaviour) - NOT auto-hidden.
  assert.equal(person.isHidden, false);
  person.questResourceBehaviour = {};   // Q3 will stand a real one
  m.tick();
  assert.equal(person.isHidden, true, 'with a behaviour the destroyed NPC is always hidden');
});

// ---------------------------------------------------------------
// The questor registry
// ---------------------------------------------------------------

test('AddAsQuestor/DropAsQuestor: the registry laws, verbatim quirks included', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Person _pp_ group Questor', '',
    ' add _pp_ as questor',
    '',
    '_d_ task:', ' drop _pp_ as questor', '',
    'variable _pad_',
  ]);
  m.tick();
  const person = q.getResource({ name: 'pp' });
  assert.equal(person.isQuestor, true);
  assert.equal(q.questors.size, 1);
  assert.equal(q.questors.get('pp').name, person.displayName, 'the questor record carries DisplayName');

  q.getTask({ name: 'd' }).start(); m.tick();
  assert.equal(q.questors.size, 0);
  assert.equal(person.isQuestor, true, 'DropQuestor leaves IsQuestor raised, as C# does');

  // Unnamed symbols THROW (Quest.cs:453,509)
  assert.throws(() => q.addQuestor(null), /AddQuestor\(\) must receive a named symbol/);
  assert.throws(() => q.dropQuestor(null), /DropQuestor\(\) must receive a named symbol/);
});

// ---------------------------------------------------------------
// Time triggers
// ---------------------------------------------------------------

test('DailyFrom: an ALWAYS-ON inclusive window - as primary trigger it stops the task outside the hours', () => {
  const m = makeMachine();
  m.now = 12 * 3600;   // 12:00
  const q = schedule(m, [
    'variable _v_', '',
    '_t_ task:', ' daily from 06:00 to 18:00', ' setvar _v_', '',
    'variable _pad_',
  ]);
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), true, '12:00 is inside');
  assert.equal(q.getTask({ name: 'v' }).getTriggerValue(), true, 'the action ran');

  m.now = 19 * 3600;   // 19:00
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), false, 'the primary always-on STOPS the task outside');

  m.now = 18 * 3600;   // 18:00 exactly - inclusive at the top
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), true, '<= max: 18:00 still fires');
});

test('LevelCompleted: player level >= N through the machine seam', () => {
  const m = makeMachine({ level: 6 });
  const q = schedule(m, [
    '_t_ task:', ' level 7 completed', '',
    'variable _pad_',
  ]);
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), false);

  const m2 = makeMachine({ level: 7 });
  const q2 = schedule(m2, [
    '_t_ task:', ' level 7 completed', '',
    'variable _pad_',
  ]);
  m2.tick();
  assert.equal(q2.getTask({ name: 't' }).getTriggerValue(), true);
});

// ---------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------

test('Prompt: Yes starts the yes-task, else the no-task; a missing message shows nothing but completes', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'variable _yes_', '', 'variable _no_', '',
    ' prompt 1011 yes _yes_ no _no_',
  ]);
  m.tick();
  const prompts = m.of('showPrompt');
  assert.equal(prompts.length, 1);
  prompts[0][2](true);
  assert.equal(q.getTask({ name: 'yes' }).getTriggerValue(), true);
  assert.equal(q.getTask({ name: 'no' }).getTriggerValue(), false);

  const m2 = makeMachine();
  const q2 = schedule(m2, [
    'variable _yes_', '', 'variable _no_', '',
    ' prompt 1999 yes _yes_ no _no_',
  ]);
  m2.tick();
  assert.equal(m2.of('showPrompt').length, 0, 'no message, no box');
  const startup = [...q2.tasks.values()].find((t) => t.actions.length);
  assert.equal(startup.actions[0].isComplete, true, 'SetComplete runs either way');
});

// ---------------------------------------------------------------
// PlaySound / PlayVideo
// ---------------------------------------------------------------

test('PlaySound: the vendored table resolves the id; the interval gates; only a REAL play re-stamps', () => {
  const m = makeMachine();
  m.now = 1000;
  const q = schedule(m, [' play sound vengence 5 0']);   // interval 5*60, count 0 = forever
  m.tick();
  assert.equal(m.of('playSound').length, 0, 'create stamped lastTimePlayed=1000; 1300 not reached');
  m.now = 1300;
  m.tick();
  assert.deepEqual(m.of('playSound'), [['playSound', 386]], 'vengence resolves to id 386 (Quests-Sounds)');
  m.now = 1400;
  m.tick();
  assert.equal(m.of('playSound').length, 1, 're-stamped at 1300; next fire at 1600');
  m.now = 1600;
  m.tick();
  assert.equal(m.of('playSound').length, 2, 'count 0 plays forever');
  assert.equal([...q.tasks.values()][0].actions[0].isComplete, false, 'PlaySound never completes');
});

test('PlaySound: a busy source (hook answers false) does not re-stamp; the count law caps plays', () => {
  const m = makeMachine({ playSoundResult: false });
  m.now = 0;
  schedule(m, [' play sound vengence every 1 minutes 1 times']);
  m.tick();
  m.now = 60; m.tick();
  m.now = 61; m.tick();
  // Not re-stamped, so the interval stays elapsed - but each elapsed
  // check burns timesPlayed, and count=1 is now exceeded (verbatim).
  assert.equal(m.of('playSound').length, 1, 'second attempt died on the count, not the clock');

  const m2 = makeMachine();
  m2.now = 0;
  schedule(m2, [' play sound vengence every 1 minutes 1 times']);
  m2.tick();
  m2.now = 60; m2.tick();
  m2.now = 120; m2.tick();
  assert.equal(m2.of('playSound').length, 1, 'count 1 means one play');
});

test('PlaySound: an unknown sound name fails create inside the try/catch and the line pends', () => {
  const m = makeMachine();
  const q = schedule(m, [' play sound notasound 5 0']);
  const startup = [...q.tasks.values()][0];
  assert.equal(startup.actions.length, 0);
  assert.equal(startup.pendingActionLines.length, 1);
});

test('PlayVideo: ANIM + four-digit pad + .VID; five digits pends the line', () => {
  const action = new PlayVideo(null).createNew('play video 13', null);
  assert.equal(action.videoName, 'ANIM0013.VID');
  assert.equal(new PlayVideo(null).createNew('play video 12345', null), null);

  const m = makeMachine();
  schedule(m, [' play video 3']);
  m.tick();
  assert.deepEqual(m.of('playVideo'), [['playVideo', 'ANIM0003.VID']]);
});

// ---------------------------------------------------------------
// Faces, talk, rumors, legal rep
// ---------------------------------------------------------------

test('AddFace/DropFace: the HUD hook receives the resource; the saying pops IMMEDIATE', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Person _pp_ group Questor', '',
    'Foe _crook_ is Thief', '',
    ' add _pp_ face saying 1011',
    ' add foe _crook_ face',
    '',
    '_d_ task:', ' drop _pp_ face', ' drop foe _crook_ face', '',
    'variable _pad_',
  ]);
  m.tick(); m.tick();   // the immediate popup questBreaks mid-task; the rest runs next tick
  const person = q.getResource({ name: 'pp' });
  const foe = q.getResource({ name: 'crook' });
  assert.deepEqual(m.of('addFace').map((c) => c[1]), [person, foe]);
  assert.equal(m.of('showPopup').length, 1, 'the saying showed');
  q.getTask({ name: 'd' }).start(); m.tick();
  assert.deepEqual(m.of('dropFace').map((c) => c[1]), [person, foe]);
});

test('DialogLink: solo links by SYMBOL name; pair links by display names - with the C# empty-namePlace quirk', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Person _pp_ group Questor', '',
    'Place _house_ remote house2', '',
    ' dialog link for location _house_ person _pp_',
  ]);
  m.tick();
  const T = QUEST_INFO_RESOURCE_TYPE;
  const uid = q.uid;
  const displayName = q.getResource({ name: 'pp' }).displayName;
  assert.deepEqual(m.of('dialogLink'), [
    ['dialogLink', uid, 'house', T.Location],
    ['dialogLink', uid, 'pp', T.Person],
    // namePlace's assignment ships COMMENTED OUT in DialogLink.cs, so
    // the place side of every pair link is the empty string.
    ['dialogLink', uid, '', T.Location, displayName, T.Person],
    ['dialogLink', uid, displayName, T.Person, '', T.Location],
  ]);
});

test('AddDialog: one call per named resource, by symbol name, isSpecial false', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Person _pp_ group Questor', '',
    ' add dialog for person _pp_',
  ]);
  m.tick();
  assert.deepEqual(m.of('addDialog'), [['addDialog', q.uid, 'pp', QUEST_INFO_RESOURCE_TYPE.Person, false]]);
});

test('RumorMill: the message goes to the rumor pool - a missing id passes null through, as TalkManager receives', () => {
  const m = makeMachine();
  const q = schedule(m, [' rumor mill 1011', ' rumor mill 1999']);
  m.tick();
  assert.deepEqual(m.of('addQuestRumor').map((c) => [c[1], c[2]]),
    [[q.uid, q.getMessage(1011)], [q.uid, null]]);
});

test('LegalRepute: the signed amount reaches the region legal-rep seam', () => {
  const m = makeMachine();
  schedule(m, [' legal repute -20', ' legal repute +10']);
  m.tick();
  assert.deepEqual(m.of('changeLegalRep').map((c) => c[1]), [-20, 10]);
});

// ---------------------------------------------------------------
// ItemUsedDo / StartQuest
// ---------------------------------------------------------------

test('ItemUsedDo: watches the item until the player uses it, then says, starts the task and completes', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Item _it_ letter', '',
    ' _it_ used saying 1011 do _read_', '',
    'variable _read_',
  ]);
  m.tick();
  const item = q.getResource({ name: 'it' });
  assert.equal(item.actionWatching, true, 'the watch flag raises every update');
  assert.equal(q.getTask({ name: 'read' }).getTriggerValue(), false);
  item.useClicked = true;
  m.tick();
  assert.equal(q.getTask({ name: 'read' }).getTriggerValue(), true);
  assert.equal(item.actionWatching, false);
  assert.equal(m.of('showPopup').length, 1);
});

test('StartQuest: "start quest 500 500" formats S0000500 and schedules through the data seam', () => {
  const CHILD = ['Quest: __CHILD', 'QRC:', 'Message:  1011', ' c', '', 'QBN:', 'variable _x_'];
  const m = makeMachine({ childSources: { S0000500: CHILD } });
  schedule(m, [' start quest 500 500']);
  m.tick();
  assert.deepEqual(m.of('getQuestSourceLines').map((c) => c[1]), ['S0000500']);
  m.tick();
  assert.ok([...m.quests.values()].some((q) => q.questName === '__CHILD'), 'the child quest went live');
});

// ---------------------------------------------------------------
// The end/tombstone talk halves
// ---------------------------------------------------------------

test('tombstone talk: the post-quest messages post by outcome and the rumor/topic pools scrub', () => {
  const src = [
    'Quest: __TT', 'QRC:',
    `Message:  ${QUEST_MESSAGES.RumorsPostFailure}`, ' rf', '',
    `Message:  ${QUEST_MESSAGES.RumorsPostSuccess}`, ' rs', '',
    `Message:  ${QUEST_MESSAGES.QuestorPostSuccess}`, ' qs', '',
    'QBN:',
    ' end quest',
  ];
  const m = makeMachine();
  const q = m.scheduleQuest(src, 0, { rolls: () => 0 });
  q.questSuccess = true;
  m.tick(); m.tick(); m.tick(); m.tick();
  assert.equal(q.questTombstoned, true);
  assert.deepEqual(m.of('addProgressRumor'), [['addProgressRumor', q.uid, q.getMessage(QUEST_MESSAGES.RumorsPostSuccess)]]);
  assert.deepEqual(m.of('addQuestorPostMessage'), [['addQuestorPostMessage', q.uid, q.getMessage(QUEST_MESSAGES.QuestorPostSuccess)]]);
  assert.deepEqual(m.of('removeQuestRumors'), [['removeQuestRumors', q.uid]]);
  assert.deepEqual(m.of('removeQuestInfoTopics'), [['removeQuestInfoTopics', q.uid]]);
  // EndQuest's own scrub (Quest.cs:375-379) ran at end time
  assert.deepEqual(m.of('removeProgressRumors'), [['removeProgressRumors', q.uid]]);
  assert.deepEqual(m.of('removeQuestorPostMessage'), [['removeQuestorPostMessage', q.uid]]);

  // Failure outcome posts the failure rumor; QuestorPostFailure is not
  // in this quest so only the rumor message goes.
  const m2 = makeMachine();
  const q2 = m2.scheduleQuest(src.map((l) => l.replace('__TT', '__TF')), 0, { rolls: () => 0 });
  m2.tick(); m2.tick(); m2.tick(); m2.tick();
  assert.equal(q2.questTombstoned, true);
  assert.deepEqual(m2.of('addProgressRumor'), [['addProgressRumor', q2.uid, q2.getMessage(QUEST_MESSAGES.RumorsPostFailure)]]);
  assert.deepEqual(m2.of('addQuestorPostMessage'), [], 'no QuestorPostFailure message in the quest');
});
