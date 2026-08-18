// U8b: the native talk window - DFU's verbatim hit-rect geometry and
// the click state machine over fake session hooks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NativeTalkWindow, TALK_RECTS, TOPIC_ROWS, TOPIC_ROW_H, CONV_LINE_H, ROW_H, ROW_SPACING, QUESTION_COLOR, ANSWER_COLOR, SELECTED_TEXT_COLOR } from '../src/ui/nativeTalk.js';

const hooks = () => {
  const state = { tone: 1, closed: 0 };
  return {
    state,
    categories: () => [
      { label: 'Taverns', buildings: [{ label: 'The Howling Wolf' }, { label: 'The Dancing Chasm' }] },
      { label: 'Banks', buildings: [{ label: 'The Bank of Daggerfall' }] },
    ],
    answer: (b) => `${b.label} is east of here`,
    tone: () => state.tone,
    setTone: (t) => { state.tone = t; },
    onClose: () => state.closed++,
    npcName: 'People of Daggerfall',
  };
};

test('nativeTalk: the verbatim rects + the click state machine', () => {
  // DaggerfallTalkWindow geometry spot pins
  assert.deepEqual([...TALK_RECTS.whereIs], [4, 14, 107, 10]);
  assert.deepEqual([...TALK_RECTS.topicList], [6, 71, 94, 104]);
  assert.deepEqual([...TALK_RECTS.conversation], [189, 65, 114, 126]);
  assert.deepEqual([...TALK_RECTS.goodbye], [118, 183, 67, 10]);
  assert.deepEqual([...TALK_RECTS.tonePolite], [258, 18, 6, 6]);
  assert.equal(TOPIC_ROWS, Math.floor(104 / TOPIC_ROW_H));
  // the 17d UI audit: ListBox rows = FONT0003 fixedHeight 7 + spacing
  assert.equal(TOPIC_ROW_H, 7, 'topic RowSpacing 0');
  // AUDIT 17e F18: RowSpacing is per ITEM, not per wrapped line -
  // rows inside one entry are ROW_H apart, entries add ROW_SPACING.
  assert.equal(ROW_H, 7, 'FONT0003 fixedHeight');
  assert.equal(ROW_SPACING, 4, 'ListBox RowSpacing, per item');
  assert.equal(CONV_LINE_H, 11);
  assert.ok(SELECTED_TEXT_COLOR, 'the newest row highlights');
  assert.deepEqual(QUESTION_COLOR, [0.698, 0.812, 1, 1]);
  assert.deepEqual(ANSWER_COLOR.map((v) => Math.round(v * 255)), [227, 223, 0, 255]);
  const h = hooks();
  const w = new NativeTalkWindow('Yes?', h);
  assert.deepEqual(w.conversation, ['Yes?']);   // the greeting is a bare string; picks push {text, kind} entries
  // click Where is -> categories fill the topic list
  assert.ok(w.click(10, 15));
  assert.equal(w.topicMode, 'categories');
  assert.equal(w.topics.length, 2);
  // click the first row -> that category's buildings
  assert.ok(w.click(10, 72));
  assert.equal(w.topicMode, 'buildings');
  assert.equal(w.topics[0].label, 'The Howling Wolf');
  // click the second row -> the answer lands in the conversation
  assert.ok(w.click(10, 72 + TOPIC_ROW_H));
  // AUDIT 17e: DFU pushes the question/answer PAIR
  assert.equal(w.conversation.at(-1).text, 'The Dancing Chasm is east of here');
  assert.equal(w.conversation.at(-1).kind, 'answer');
  assert.equal(w.conversation.at(-2).kind, 'question');
  // tone radio clicks
  assert.ok(w.click(259, 19));
  assert.equal(h.state.tone, 0, 'Polite');
  assert.ok(w.click(259, 39));
  assert.equal(h.state.tone, 2, 'Blunt');
  // outside every rect: not consumed
  assert.equal(w.click(160, 100), false);
  // goodbye closes + fires onClose
  assert.ok(w.click(120, 184));
  assert.ok(w.done);
  assert.equal(h.state.closed, 1);
});

test('nativeTalk: the keyboard accelerators mirror the session keys', () => {
  const h = hooks();
  const w = new NativeTalkWindow('Greetings.', h);
  w.input('KeyW');
  assert.equal(w.topicMode, 'categories');
  w.input('Digit2');           // Banks
  assert.equal(w.topics[0].label, 'The Bank of Daggerfall');
  w.input('Digit1');
  assert.equal(w.conversation.at(-1).text, 'The Bank of Daggerfall is east of here');
  w.input('KeyT');             // tone cycles 1 -> 2
  assert.equal(h.state.tone, 2);
  w.input('Escape');
  assert.ok(w.done && h.state.closed === 1);
});
