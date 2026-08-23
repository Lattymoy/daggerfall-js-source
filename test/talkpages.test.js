// B5-6-7 (AUDIT 25 blockers 5-7): the talk window's OTHER pages, and
// the static-NPC conversation that finally OPENS.
//
// The engine under the window has been ~95% ported since TK-v - the
// tree assembles listTopicTellMeAbout / Person / Thing, the pipeline
// answers every QuestionType - and the window mounted ONE of its five
// pages (Where-is > Location) while nativeTalk.js:196 pended the rest
// as INTERIM no-ops. "Any news?", "Where am I?", quest topics and
// work were computed and thrown away; every non-service static NPC
// answered "You get no response." over a fully-computed greeting.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NativeTalkWindow, TALK_RECTS } from '../src/ui/nativeTalk.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const at = (r) => [r[0] + 1, r[1] + 1];

const mkHooks = () => {
  const state = { tone: 1, workAsked: 0 };
  return {
    state,
    categories: () => [{ label: 'Taverns', buildings: [{ label: 'The Howling Wolf' }] }],
    tellMeAboutTopics: () => [
      { label: 'Any news?', listItem: { questionType: 1 } },
      { label: 'Where am I?', listItem: { questionType: 2 } },
    ],
    peopleTopics: () => [{ label: 'Lord Bridwell', listItem: { questionType: 5 } }],
    thingsTopics: () => [],   // classic never implemented Things - EMPTY, verbatim
    workQuestion: () => 'Do you know of any work?',
    askWork: () => { state.workAsked++; return 'You might try the Odd Blades.'; },
    question: (row) => `About ${row.label}...`,
    answer: (row) => `${row.label}: an answer`,
    tone: () => state.tone,
    setTone: (t) => { state.tone = t; },
    npcName: 'Cims Ravel',
  };
};

test('B5: Tell me about opens the flat engine list and a pick asks through the same Q/A pair', () => {
  const w = new NativeTalkWindow('greeting', mkHooks());
  assert.ok(w.click(...at(TALK_RECTS.tellMeAbout)));
  assert.equal(w.topicMode, 'topics');
  assert.equal(w.topics.length, 2);
  w.click(...at(TALK_RECTS.topicList));   // row 0: Any news?
  assert.equal(w.conversation.length, 3);   // greeting + question + answer
  assert.equal(w.conversation[1].kind, 'question');
  assert.equal(w.conversation[2].text, 'Any news?: an answer');
});

test('B5: People is the flat person list; Things opens EMPTY (classic never implemented it)', () => {
  const w = new NativeTalkWindow('greeting', mkHooks());
  assert.ok(w.click(...at(TALK_RECTS.categoryPeople)));
  assert.equal(w.topics.length, 1);
  assert.equal(w.topics[0].label, 'Lord Bridwell');
  assert.ok(w.click(...at(TALK_RECTS.categoryThings)));
  assert.equal(w.topicMode, 'topics');
  assert.deepEqual(w.topics, []);
});

test('B6: Work clears the list, shows the question, and OKAY asks it (ButtonOkay :1534-1543)', () => {
  const h = mkHooks();
  const w = new NativeTalkWindow('greeting', h);
  assert.ok(w.click(...at(TALK_RECTS.categoryWork)));
  assert.equal(w.topicMode, 'work');
  assert.deepEqual(w.topics, []);
  assert.equal(w.question, 'Do you know of any work?');
  w.click(...at(TALK_RECTS.okay));
  assert.equal(h.state.workAsked, 1);
  assert.equal(w.conversation.at(-1).text, 'You might try the Odd Blades.');
  // OKAY outside the Work page stays the recorded no-op
  w.click(...at(TALK_RECTS.tellMeAbout));
  w.click(...at(TALK_RECTS.okay));
  assert.equal(h.state.workAsked, 1);
});

test('B5-6: a page whose hook is absent consumes the click and opens nothing (the pre-engine host)', () => {
  const h = mkHooks();
  delete h.tellMeAboutTopics; delete h.workQuestion;
  const w = new NativeTalkWindow('greeting', h);
  assert.ok(w.click(...at(TALK_RECTS.tellMeAbout)));
  assert.equal(w.topicMode, 'none');
  assert.ok(w.click(...at(TALK_RECTS.categoryWork)));
  assert.equal(w.topicMode, 'none');
});

test('MERGE: Where-is remembers the selected category (SetTalkModeWhereIs :960-971 re-runs SetTalkCategory)', () => {
  const h = mkHooks();
  const w = new NativeTalkWindow('greeting', h);
  w.click(...at(TALK_RECTS.categoryPeople));
  assert.equal(w.topicMode, 'topics');
  w.click(...at(TALK_RECTS.tellMeAbout));       // leave for Tell me about
  w.click(...at(TALK_RECTS.whereIs));           // back to Where-is
  assert.equal(w.topics[0].label, 'Lord Bridwell', 'People again, not Location - the C# category persists');
  // and the default arm is Location for a fresh window
  const w2 = new NativeTalkWindow('greeting', mkHooks());
  w2.click(...at(TALK_RECTS.whereIs));
  assert.equal(w2.topicMode, 'categories');
});

test('B7 seam gate: the static-NPC conversation opens the window instead of "You get no response."', () => {
  const modes = read('src/scenes/worldModes.js');
  const town = read('src/scenes/townTalk.js');
  // the click fall-through pushes the window with the engine's greeting
  assert.match(modes, /if \(talk\?\.kind === 'talk' && townTalk\?\.openTalkWindow\) \{\s*\n\s*townTalk\.openTalkWindow\(talk\.greeting, \{ npcSeed: pn\.nameSeed \?\? 0, npcName: displayName \}\);/);
  // the guild popup's TALK button routes TalkToStaticNPC with menu TRUE
  // (DaggerfallGuildServicePopupWindow.cs:294) and yields to the window
  assert.match(modes, /\{ menu: true, isSpyMaster: false \}\);/);
  assert.match(modes, /interiorOverlay = null;\s*\/\/ the popup yields to the conversation/);
  // ONE window-opener - the mobile path and the static path share it
  assert.match(town, /function openTalkWindow\(greeting, \{ npcSeed = 0, npcName = '' \} = \{\}\)/);
  assert.match(town, /openTalkWindow\(t\.text, \{ npcSeed: _talkNpc\?\._talkSeed \?\? 0, npcName: _talkNpc\?\.nameNPC \?\? '' \}\);/);
  // and the Work answer rides the session's own pool flag
  assert.match(town, /workAvailable: eng\.session\?\.workAvailable \?\? false,/);
});
