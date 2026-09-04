// U8b: the native talk window - DFU's verbatim hit-rect geometry and
// the click state machine over fake session hooks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NativeTalkWindow, TALK_RECTS, TOPIC_ROWS, TOPIC_ROW_H, CONV_LINE_H, ROW_H, ROW_SPACING, QUESTION_COLOR, ANSWER_COLOR, SELECTED_TEXT_COLOR, TOPIC_SELECTED_TEXT_COLOR, topicRowStyle, PORTRAIT_RECT, PORTRAIT_ARCHIVE } from '../src/ui/nativeTalk.js';
import { portraitIndexFromStaticNPCBillboard, OOPS_PORTRAIT_RECORD } from '../src/systems/npcSession.js';
import { PERSON_FACE_RECORDS, PERSON_TEXTURES, NUM_PERSON_FACE_VARIANTS } from '../src/characters/mobilePerson.js';

/** ROAD-D D10: MouseClick selects, MouseDoubleClick uses - so the
 *  pins that mean "use this row" press twice inside
 *  DOUBLE_CLICK_DELAY_MS, with the clock injected. */
const dblClick = (w, x, y) => { w.click(x, y, false, 1000); return w.click(x, y, false, 1100); };

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
  // AUDIT 17e F19: DFU's PixelWise list DRAWS the partially clipped
  // last row and its hit test selects it - 104/7 = 14.857 -> 15 rows.
  // The port drew floor() = 14 while the click rect admitted row 14,
  // so the bottom band selected a row that was never rendered.
  assert.equal(TOPIC_ROWS, Math.ceil(104 / TOPIC_ROW_H));
  assert.equal(TOPIC_ROWS, 15);
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
  // ROAD-D D10: SetListboxTopics SELECTS row 0 as it fills (:893-905)
  assert.equal(w.selected, 0);
  // a SINGLE click on the second row only moves the selection - no
  // navigation, no ask (ListBox.MouseClick :465-505)
  assert.ok(w.click(10, 72 + TOPIC_ROW_H));
  assert.equal(w.selected, 1);
  assert.equal(w.topicMode, 'categories', 'one click never descends');
  // the DOUBLE click uses it (MouseDoubleClick :507-512)
  assert.ok(dblClick(w, 10, 72));
  assert.equal(w.topicMode, 'buildings');
  assert.equal(w.topics[0].label, 'The Howling Wolf');
  // double-click the second row -> the answer lands in the conversation
  assert.ok(dblClick(w, 10, 72 + TOPIC_ROW_H));
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

// ---------------------------------------------------------------
// ROAD-D D10: THE SELECTION MODEL. DaggerfallTalkWindow splits the
// topic list in two (:549-550) - OnSelectItem moves the index and
// refreshes the player-says label through UpdateQuestion
// (:1381-1387/:1222-1249), OnUseSelectedItem asks
// (:1389-1392/:1290-1340) - and OKAY is the button that asks the
// SELECTED topic (ButtonOkay_OnMouseClick :1534-1548). The port asked
// on the single click and never drew a selection at all.
// ---------------------------------------------------------------
test('D10: UpdateQuestion runs on SELECTION - group rows clear the label, item rows fill it', () => {
  const h = hooks();
  h.question = (b) => `Where is ${b.label}?`;
  const w = new NativeTalkWindow('Yes?', h);
  w.click(10, 15);                                     // Where is -> the category list
  // SetListboxTopics' tail selects row 0 as it fills (:893-905)
  assert.equal(w.selected, 0);
  // ...and a category row is an ItemGroup, so currentQuestion is ""
  assert.equal(w.question, '');
  assert.ok(w.click(10, 72, false, 1000));             // select Taverns
  assert.ok(w.click(10, 72, false, 1100));             // use it
  assert.equal(w.topicMode, 'buildings');
  assert.equal(w.selected, 0, 'the child list selects its own row 0');
  assert.equal(w.question, 'Where is The Howling Wolf?', 'the label is filled before any ask');
  assert.equal(w.conversation.length, 1, 'descending into a group asks nothing');
});

test('D10: OKAY asks the selected topic (ButtonOkay :1547 -> SelectTopicFromTopicList)', () => {
  const h = hooks();
  const w = new NativeTalkWindow('Yes?', h);
  // OKAY with nothing selected is inert - SelectTopicFromTopicList
  // returns on an out-of-range index (:1300-1305)
  w.click(...[TALK_RECTS.okay[0] + 1, TALK_RECTS.okay[1] + 1]);
  assert.equal(w.conversation.length, 1);
  w.click(10, 15);                                     // categories, row 0 selected
  w.click(...[TALK_RECTS.okay[0] + 1, TALK_RECTS.okay[1] + 1]);   // OKAY descends the group
  assert.equal(w.topicMode, 'buildings');
  w.click(10, 72 + TOPIC_ROW_H);                       // select The Dancing Chasm
  assert.equal(w.selected, 1);
  w.click(...[TALK_RECTS.okay[0] + 1, TALK_RECTS.okay[1] + 1]);
  assert.equal(w.conversation.at(-1).text, 'The Dancing Chasm is east of here');
  assert.equal(w.conversation.at(-2).kind, 'question');
});

test('D10: the selected row draws in ListBox selectedTextColor with NO shadow', () => {
  assert.deepEqual(TOPIC_SELECTED_TEXT_COLOR.map((v) => Math.round(v * 255)), [162, 36, 12, 255]);
  assert.equal(topicRowStyle(true).shadowOffset, 0, 'selectedShadowPosition = Vector2.zero');
  assert.deepEqual(topicRowStyle(true).color, TOPIC_SELECTED_TEXT_COLOR);
  assert.deepEqual(topicRowStyle(false), {}, 'an unselected row keeps every default');
});

// ---------------------------------------------------------------
// ROAD-D D10: THE PORTRAIT. panelPortrait (119,65) 64x64 has drawn
// the art's empty frame since U8b because nothing ever called
// SetNPCPortrait (DaggerfallTalkWindow.cs:360-385). Both of DFU's
// callers are now ported: a MOBILE always portraits from
// TFAC00I0.RCI at SetPerson's minted record (TalkManager.cs:817),
// and a STATIC NPC's archive/record come from
// GetPortraitIndexFromStaticNPCBillboard (:3505-3543).
// ---------------------------------------------------------------
test('D10: the portrait panel and its two archives are DaggerfallTalkWindow verbatim', () => {
  assert.deepEqual([...PORTRAIT_RECT], [119, 65, 64, 64]);      // :158-159
  assert.equal(PORTRAIT_ARCHIVE.CommonFaces, 'TFAC00I0.RCI');   // :37
  assert.equal(PORTRAIT_ARCHIVE.SpecialFaces, 'FACES.CIF');     // :38
});

test('D10: GetPortraitIndexFromStaticNPCBillboard, all three arms', () => {
  // 1. an INDIVIDUAL faction (type 4) returns its own face, and the
  //    archive test is inverted: over 60 is COMMON, 60 and under
  //    SPECIAL (:3514-3519).
  assert.deepEqual(portraitIndexFromStaticNPCBillboard({}, { factionData: { type: 4, face: 61 } }),
    { archive: 'CommonFaces', record: 61 });
  assert.deepEqual(portraitIndexFromStaticNPCBillboard({}, { factionData: { type: 4, face: 60 } }),
    { archive: 'SpecialFaces', record: 60 });
  // 2. nothing resolves: "oops", record 410 (:3523)
  assert.equal(OOPS_PORTRAIT_RECORD, 410);
  assert.deepEqual(portraitIndexFromStaticNPCBillboard({}, { factionData: { type: 2, flat1: 0 }, flatFaceIndex: () => -1 }),
    { archive: 'CommonFaces', record: 410 });
  // 3. the faction FLAT resolves first (flat2 for a female), then the
  //    NPC's OWN billboard overwrites it - "more specific".
  const flat1 = (182 * 128) + 1;
  const flat2 = (182 * 128) + 2;
  const faces = (a, r) => {
    if (a !== 182) return -1;
    if (r === 1) return 55;
    if (r === 2) return 56;
    if (r === 9) return 77;
    return -1;
  };
  const faction = { type: 2, flat1, flat2 };
  assert.equal(portraitIndexFromStaticNPCBillboard({ gender: 0 }, { factionData: faction, flatFaceIndex: faces }).record, 55);
  assert.equal(portraitIndexFromStaticNPCBillboard({ gender: 1 }, { factionData: faction, flatFaceIndex: faces }).record, 56,
    'a female NPC reads flat2 (:3530-3534)');
  assert.equal(portraitIndexFromStaticNPCBillboard(
    { gender: 0, billboardArchiveIndex: 182, billboardRecordIndex: 9 },
    { factionData: faction, flatFaceIndex: faces }).record, 77, 'the billboard overwrites the faction flat');
});

test('D10: SetPerson mints the mobile walker TFAC record from the outfit variant', () => {
  // MobilePersonNPC.cs:30-39, digit for digit and paired to the
  // PERSON_TEXTURES order beside them.
  assert.equal(NUM_PERSON_FACE_VARIANTS, 24);
  assert.deepEqual(PERSON_FACE_RECORDS.Redguard.male, [336, 312, 336, 312]);
  assert.deepEqual(PERSON_FACE_RECORDS.Redguard.female, [144, 144, 120, 96]);
  assert.deepEqual(PERSON_FACE_RECORDS.Nord.male, [240, 264, 168, 192]);
  assert.deepEqual(PERSON_FACE_RECORDS.Nord.female, [72, 0, 48, 0]);
  assert.deepEqual(PERSON_FACE_RECORDS.Breton.male, [192, 216, 288, 240]);
  assert.deepEqual(PERSON_FACE_RECORDS.Breton.female, [72, 72, 24, 72]);
  assert.equal(PERSON_TEXTURES.Breton.male.length, PERSON_FACE_RECORDS.Breton.male.length,
    'one face record per outfit variant');
});
