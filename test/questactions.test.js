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
import { Person } from '../src/systems/quest/person.js';

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
    showPopup: (q, tokens) => calls.push(['showPopup', tokens]),
    showPrompt: (q, message, respond) => calls.push(['showPrompt', message, respond]),
    changeReputation: capture('changeReputation'),
    addQuestTopics: capture('addQuestTopics'),
    changeLegalRep: capture('changeLegalRep'),
    playerLevel: () => deps.level ?? 0,
    getGold: () => m.gold,
    deductGold: (amount) => { m.gold -= amount; calls.push(['deductGold', amount]); },
    playVideo: capture('playVideo'),
    playSound: (soundId) => { calls.push(['playSound', soundId]); return deps.playSoundResult ?? true; },
    playSong: capture('playSong'),
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
  m.tick();
  assert.equal(m.of('showPopup').length, 1,
    'a TRIGGERED task never re-runs its plain trigger conditions - the saying pops once (Task.cs:218 gate)');

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

test('DestroyNpc: destroys the person; the Tick destroyed->hidden law is GATED on a scene behaviour AND on destroyed', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Person _pp_ group Questor', '',
    '_d_ task:', ' destroy _pp_', '',
    'variable _pad_',
  ]);
  m.tick();
  const person = q.getResource({ name: 'pp' });
  person.questResourceBehaviour = {    // a minimal scene-link stub (the accessor subscribes destroy - Q4-iii)
    onDestroy() {}, offDestroy() {}, setGameObjectActive() {},
  };
  m.tick();
  assert.equal(person.isHidden, false, 'destroyed-ONLY: a live person with a behaviour stays visible');
  q.getTask({ name: 'd' }).start(); m.tick();
  assert.equal(person.isDestroyed, true);
  m.tick();   // resources Tick BEFORE tasks (Quest.cs:308), so the hide lands next tick
  assert.equal(person.isHidden, true, 'with a behaviour the destroyed NPC is always hidden');

  // No QuestResourceBehaviour in scene -> Tick's whole body is inert
  // (QuestResource.cs:158 gates on the behaviour) - NOT auto-hidden.
  const m2 = makeMachine();
  const q2 = schedule(m2, ['Person _pp_ group Questor', '', ' destroy _pp_']);
  m2.tick(); m2.tick();
  const p2 = q2.getResource({ name: 'pp' });
  assert.equal(p2.isDestroyed, true);
  assert.equal(p2.isHidden, false, 'no scene link, no auto-hide');
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
// PlaySong
// ---------------------------------------------------------------

test('PlaySong: the SongFiles member reaches the hook as a MIDI.BSA record name, ONCE', () => {
  const m = makeMachine();
  const q = schedule(m, [' play song song_dungeon5']);
  m.tick();
  // DFU hands the enum value to DaggerfallSongPlayer.Play, which does
  // EnumToFilename at the last moment; the port's song layer keys on
  // the archive's spelling, so the action converts before the seam.
  assert.deepEqual(m.of('playSong'), [['playSong', 'DUNGEON5.HMI']]);
  const action = [...q.tasks.values()][0].actions[0];
  assert.equal(action.isComplete, true, 'PlaySong completes on its first update');
  m.tick(); m.tick();
  assert.equal(m.of('playSong').length, 1, 'a completed action does not play again');
});

test('PlaySong: the underscore-heavy and digit-leading members survive the trip', () => {
  const m = makeMachine();
  schedule(m, [' play song song_gday___d']);
  m.tick();
  assert.deepEqual(m.of('playSong'), [['playSong', 'GDAY___D.HMI']]);

  const m2 = makeMachine();
  schedule(m2, [' play song song_5strong']);
  m2.tick();
  assert.deepEqual(m2.of('playSong'), [['playSong', '5STRONG.HMI']]);
});

test('PlaySong: an unknown song THROWS out of the parse and the quest is dropped whole', () => {
  // C# has no try/catch here (PlaySong.cs:47-52) - unlike PlaySound
  // one screen up, whose catch pends the single line - so the throw
  // leaves ReadTaskLines and takes the quest with it.
  const m = makeMachine();
  assert.throws(
    () => schedule(m, [' play song song_notarealsong']),
    /PlaySong: Song file song_notarealsong is not a known song from MIDI\.BSA/,
  );
  // ParseQuest's own catch is what turns that into a dropped quest
  // rather than a dropped picker (machine.parseQuestForLists).
  const m2 = makeMachine();
  assert.equal(m2.parseQuestForLists([...HEADER, ' play song song_notarealsong'], 0, { rolls: () => 0 }), null);

  // ...and the guard is the ENUM, not the regex: a name the pattern
  // accepts but the enum does not is what throws.
  const m3 = makeMachine();
  assert.throws(() => schedule(m3, [' play song SONG_TAVERN']), /not a known song/,
    'Enum.IsDefined is ordinal - a shouted member name is undefined');
});

test('PlaySong: a line the pattern does not match still PENDS, it does not throw', () => {
  const m = makeMachine();
  const q = schedule(m, [' play song ']);
  const startup = [...q.tasks.values()][0];
  assert.equal(startup.actions.length, 0);
  assert.equal(startup.pendingActionLines.length, 1, 'no song group, no match, no template');
});

test('PlaySong: the save envelope carries the ENUM name under C#\'s field name', () => {
  const m = makeMachine();
  const q = schedule(m, [' play song song_tavern']);
  const action = [...q.tasks.values()][0].actions[0];
  // SaveData_v1 { SongFiles song; } - the SAVED value is the member,
  // not the resolved record, exactly as C# serialises the enum.
  assert.deepEqual(action.getSaveData(), { song: 'song_tavern' });
  assert.equal(action.getActionSaveData().type, 'PlaySong');

  const m2 = makeMachine();
  m2.restoreSaveData({ siteLinks: [], quests: [q.getSaveData()] });
  const twin = m2.getQuest(q.uid);
  const restored = [...twin.tasks.values()][0].actions[0];
  assert.equal(restored.constructor.typeName, 'PlaySong', 'the type registry resolves it');
  assert.equal(restored.songFile, 'song_tavern');
  restored.isComplete = false;
  restored.update(null);
  assert.deepEqual(m2.of('playSong'), [['playSong', 'TAVERN.HMI']], 'a restored action still resolves');
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
  m.tick();
  const person = q.getResource({ name: 'pp' });
  const foe = q.getResource({ name: 'crook' });
  // The saying pops IMMEDIATE: the questBreak defers the SECOND
  // add-face to the next tick (ShowMessagePopup's immediate=true arm).
  assert.deepEqual(m.of('addFace').map((c) => c[1]), [person], 'the break held the foe face back');
  assert.equal(m.of('showPopup').length, 1, 'the saying showed');
  m.tick();
  assert.deepEqual(m.of('addFace').map((c) => c[1]), [person, foe]);
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

// ---------------------------------------------------------------
// Q2b-VERIFY - the adversarial-review fixes and the mutation-campaign
// survivors, each now a pin that fails under its one-character mutant.
// ---------------------------------------------------------------

test('VERIFY: the enum literals are DFU\'s own values, pinned as literals', () => {
  // The first drafts compared hook calls against the imported enums -
  // vacuous under an enum mutation. deepEqual against LITERALS.
  assert.deepEqual(QUEST_INFO_RESOURCE_TYPE, { NotSet: 0, Location: 1, Person: 2, Thing: 3 });
  assert.deepEqual(QUEST_MESSAGES, {
    QuestorOffer: 1000, RefuseQuest: 1001, AcceptQuest: 1002, QuestFail: 1003,
    QuestComplete: 1004, RumorsDuringQuest: 1005, RumorsPostFailure: 1006,
    RumorsPostSuccess: 1007, QuestorPostSuccess: 1008, QuestorPostFailure: 1009,
  });
});

test('VERIFY: a cleared and restarted task does NOT re-run its allowRearm=false actions', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'variable _a_', '', 'variable _b_', '',
    '_t_ task:', ' prompt 1011 yes _a_ no _b_', '',
    'variable _pad_',
  ]);
  m.tick();
  q.getTask({ name: 't' }).start(); m.tick();
  assert.equal(m.of('showPrompt').length, 1);
  q.getTask({ name: 't' }).clear();
  q.getTask({ name: 't' }).start(); m.tick();
  assert.equal(m.of('showPrompt').length, 1, 'allowRearm=false survives the clear (QuestAction.cs RearmAction)');
});

test('VERIFY: WhenTask\'s single "when _x_" with _x_ unset reads FALSE (the one-eval guard)', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'variable _x_', '',
    '_t_ task:', ' when _x_', '',
    'variable _pad_',
  ]);
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), false);
});

test('VERIFY: a SECONDARY always-on trigger can start but never STOP the task', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'variable _a_', '', 'variable _b_', '',
    '_t_ task:', ' when _a_', ' when _b_', '',
    'variable _pad_',
  ]);
  m.tick();
  q.getTask({ name: 'a' }).start();
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), true, 'the primary started the task');
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), true,
    'the false secondary (_b_ unset) cannot stop it (Task.cs Update\'s ranPrimary law)');
});

test('VERIFY: DailyFrom\'s minutes-bearing LOWER boundary is inclusive', () => {
  const m = makeMachine();
  m.now = 16 * 3600 + 60;   // 16:01
  const q = schedule(m, [
    '_t_ task:', ' daily from 16:02 to 23:59', '',
    'variable _pad_',
  ]);
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), false, '16:01 is outside');
  m.now = 16 * 3600 + 120;  // 16:02 exactly
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), true, '>= min: 16:02 exactly fires');
  m.now = 23 * 3600 + 59 * 60;  // 23:59 exactly - the minute-bearing UPPER bound
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), true, '<= max: 23:59 exactly fires');
});

test('VERIFY: Prompt\'s static-message NAME form resolves through Quests-StaticMessages', () => {
  const m = makeMachine();
  const q = m.scheduleQuest([
    'Quest: __PN', 'QRC:', 'Message:  1011', ' x', '',
    'QuestComplete:  [1004]', ' done', '',
    'QBN:',
    'variable _a_', '', 'variable _b_', '',
    ' prompt QuestComplete yes _a_ no _b_',
  ], 0, { rolls: () => 0 });
  m.tick();
  const prompts = m.of('showPrompt');
  assert.equal(prompts.length, 1);
  assert.equal(prompts[0][1], q.getMessage(1004), 'QuestComplete resolved to id 1004');
});

test('VERIFY: DialogLink/AddDialog triple forms fire every link in the C# order', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Person _pp_ group Questor', '',
    'Place _house_ remote house2', '',
    'Item _it_ letter', '',
    ' dialog link for location _house_ person _pp_ item _it_',
    ' add dialog for location _house_ person _pp_ item _it_',
  ]);
  m.tick();
  const T = QUEST_INFO_RESOURCE_TYPE;
  const uid = q.uid;
  const dn = q.getResource({ name: 'pp' }).displayName;   // '' until Q3 binds
  assert.deepEqual(m.of('dialogLink'), [
    ['dialogLink', uid, 'house', T.Location],
    ['dialogLink', uid, 'pp', T.Person],
    ['dialogLink', uid, 'it', T.Thing],
    ['dialogLink', uid, '', T.Location, dn, T.Person],
    ['dialogLink', uid, dn, T.Person, '', T.Location],
    ['dialogLink', uid, '', T.Location, '', T.Thing],
    ['dialogLink', uid, '', T.Thing, '', T.Location],
    ['dialogLink', uid, dn, T.Person, '', T.Thing],
    ['dialogLink', uid, '', T.Thing, dn, T.Person],
  ]);
  assert.deepEqual(m.of('addDialog'), [
    ['addDialog', uid, 'house', T.Location, false],
    ['addDialog', uid, 'pp', T.Person, false],
    ['addDialog', uid, 'it', T.Thing, false],
  ]);
});

test('VERIFY: fresh resources start cold - the tracking state has no pre-lit flags', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Person _pp_ group Questor', '', 'Foe _crook_ is Thief', '', 'Item _it_ letter', '',
    'variable _pad_',
  ]);
  const foe = q.getResource({ name: 'crook' });
  const item = q.getResource({ name: 'it' });
  const person = q.getResource({ name: 'pp' });
  assert.deepEqual(
    [foe.injuredTrigger, foe.isRestrained, foe.killCount, foe.hasPlayerClicked,
      item.useClicked, item.actionWatching, item.allowDrop, item.playerDropped, item.madePermanent,
      person.isMuted, person.isDestroyed, person.isQuestor],
    [false, false, 0, false, false, false, false, false, false, false, false, false]);
  // Q2b-ii: the mint runs at parse - "letter" resolves through
  // Quests-Items (9,5) to UselessItems2[5] = template 279, Parchment,
  // quest-linked to THIS quest.
  assert.equal(item.daggerfallUnityItem.templateIndex, 279);
  assert.equal(item.daggerfallUnityItem.questItem, true);
  assert.equal(item.daggerfallUnityItem.questUID, q.uid);
  assert.equal(item.daggerfallUnityItem.questSymbol.name, 'it');
});

test('VERIFY: addResource auto-tracks an incoming Person already flagged questor (Quest.cs:879-881)', () => {
  const m = makeMachine();
  const q = schedule(m, ['variable _pad_']);
  const person = new Person(q, 'Person _qq_ group Questor');
  person.isQuestor = true;   // Q3's SetupQuestorNPC mints this at create
  q.addResource(person);
  assert.equal(q.questors.has('qq'), true, 'the auto-track registered it');
});

test('VERIFY: endQuest reputation goes through the PROPAGATING overload, and factionId 0 stays silent', () => {
  const src = ['Quest: __RP', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', ' end quest'];
  const m = makeMachine();
  const q = m.scheduleQuest(src, 77, { rolls: () => 0 });
  q.questSuccess = true;
  m.tick();
  assert.deepEqual(m.of('changeReputation'), [['changeReputation', 77, 5, true]],
    'Quest.cs:385: QuestSuccessRep with propagate=TRUE (allies/enemies/tree spread)');

  const m2 = makeMachine();
  m2.scheduleQuest(src.map((l) => l.replace('__RP', '__RF')), 42, { rolls: () => 0 });
  m2.tick();
  assert.deepEqual(m2.of('changeReputation'), [['changeReputation', 42, -2, true]],
    'the failure path pays QuestFailureRep, still propagating');

  const m3 = makeMachine();
  m3.scheduleQuest(src.map((l) => l.replace('__RP', '__R0')), 0, { rolls: () => 0 });
  m3.tick();
  assert.equal(m3.of('changeReputation').length, 0, 'factionId 0 never touches reputation');
});

test('VERIFY: quest start registers its talk topics between start and the live table (QuestMachine.cs:723)', () => {
  const m = makeMachine();
  const q = schedule(m, ['variable _pad_']);
  assert.equal(m.of('addQuestTopics').length, 0, 'not before the invoke tick');
  m.tick();
  assert.deepEqual(m.of('addQuestTopics'), [['addQuestTopics', q]]);
  m.tick();
  assert.equal(m.of('addQuestTopics').length, 1, 'once per quest');
});

test('VERIFY: a faulting quest tombstones AFTER the surviving quests update (C# collect-then-remove)', () => {
  const m = makeMachine();
  const bad = schedule(m, [' remove foe _ghost_']);
  const good = schedule(m, [' say 1011']);
  m.tick();
  assert.equal(bad.questTombstoned, true, 'error termination still lands');
  assert.equal(m.quests.has(bad.uid), false);
  assert.equal(good.questTombstoned, false);
  const order = m.calls.map((c) => c[0]).filter((n) => n === 'showPopup' || n === 'removeQuestRumors');
  assert.deepEqual(order, ['showPopup', 'removeQuestRumors'],
    'the good quest\'s same-tick popup lands BEFORE the faulting quest\'s tombstone scrub (QuestMachine.cs:486,509-512)');
});

test('VERIFY-2: WhenTask "when A and B or C" with only A set stays FALSE (the mid-chain short-circuit)', () => {
  // WhenTask.cs's and-arm peeks at the NEXT op only when right is
  // TRUE; a mutant that peeks on false returns true here.
  const m = makeMachine();
  const q = schedule(m, [
    'variable _a_', '', 'variable _b_', '', 'variable _c_', '',
    '_t_ task:', ' when _a_ and _b_ or _c_', '',
    'variable _pad_',
  ]);
  m.tick();
  q.getTask({ name: 'a' }).start();
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), false, 'A alone satisfies neither A-and-B nor C');
  q.getTask({ name: 'c' }).start();
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), true, 'C opens the or');
});

test('VERIFY-2: DestroyNpc\'s "destroy npc X" first alternative destroys too', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Person _pp_ group Questor', '',
    ' destroy npc _pp_',
  ]);
  m.tick();
  assert.equal(q.getResource({ name: 'pp' }).isDestroyed, true);
});

test('VERIFY-2: Toting with an UNDECLARED person refuses, it does not trigger', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Item _it_ letter', '',
    '_t_ task:', ' toting _it_ and _ghost_ clicked', '',
    'variable _pad_',
  ]);
  m.tick(); m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), false, 'a missing Person reads false, never true');
});

test('VERIFY-2: Say\'s static-message NAME form resolves through Quests-StaticMessages', () => {
  const m = makeMachine();
  const q = m.scheduleQuest([
    'Quest: __SN', 'QRC:', 'Message:  1011', ' x', '',
    'QuestComplete:  [1004]', ' done', '',
    'QBN:', ' say QuestComplete',
  ], 0, { rolls: () => 0 });
  m.tick();
  const popups = m.of('showPopup');
  assert.equal(popups.length, 1);
  // wave 21: the hook takes the expanded TOKENS of one box now, so the
  // pin reads the text the message actually carries.
  assert.equal(popups[0][1].map((t) => t.text ?? '').join('').trim(), 'done',
    'QuestComplete resolved to id 1004');
});
