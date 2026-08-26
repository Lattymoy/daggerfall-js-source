// AUDIT 26 PARITY, wave ui-native. Five laws the native windows had
// dropped, each pinned against the C# it is taken from:
//   F156 TransferItem's MAP arm (DaggerfallInventoryWindow.cs:1471-1478)
//   F157 TransferItem's LIGHT arm (:1506-1508), inventory AND trade
//   F158 the Buy basket's CanCarryAmount gate (DaggerfallTradeWindow.cs:842)
//   F159 the conversation arrows (DaggerfallTalkWindow.cs:226-227, :1442-1452)
//   F160 HandleClick's notebook arms (DaggerfallQuestJournalWindow.cs:405-435)
// plus the OnPush/OnPop equip-delay pair (:667, :729) the window is the
// one caller of.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NativeInventoryWindow, CANNOT_CARRY_TEXT } from '../src/ui/nativeInventory.js';
import { NativeTradeWindow } from '../src/ui/nativeTrade.js';
import {
  NativeTalkWindow, TALK_RECTS, CONVERSATION_ARROW_SCROLL, conversationScroll,
} from '../src/ui/nativeTalk.js';
import {
  QuestJournalWindow, JOURNAL_RECTS, CONFIRM_MOVE_TEXT, CONFIRM_REMOVE_TEXT, ENTER_NOTE_TEXT,
} from '../src/ui/questJournal.js';
import { MAP_TEXT_ID, TEMPLATES } from '../src/systems/useItem.js';
import { MB_BUTTONS } from '../src/ui/messageBox.js';
import { EQUIP_DELAY_TIMES } from '../src/characters/weaponStates.js';

const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
const ROWS = (id) => [{ text: `#${id}`, center: true }];
const mapItem = (name = 'Treasure Map') => ({ group: 'MiscItems', templateIndex: TEMPLATES.Map, name, stackCount: 1 });
const torch = () => ({ group: 'UselessItems2', templateIndex: TEMPLATES.Torch, name: 'Torch', stackCount: 1, currentCondition: 100, maxCondition: 100 });

// ---------------------------------------------------------------
// F156  TransferItem's map arm - a map is READ, never transferred
// ---------------------------------------------------------------
test('AUDIT 26 F156: dropping a map REVEALS a location and eats it - it never reaches the pile', () => {
  // TransferItem (:1471-1478): `if (item.IsOfTemplate(MiscItems, Map))
  // { RecordLocationFromMap(item); from.RemoveItem(item); Refresh; return; }`
  // - unconditional, in either direction, above the quest arm.
  const bag = [mapItem()];
  let revealed = 0;
  const w = new NativeInventoryWindow({
    items: () => bag, icons: ICONS, rows: ROWS,
    revealMap: () => { revealed++; return 'Daggerfall'; },
  });
  w.mode = 'remove';
  w.tab = 'clothing';            // MiscItems land on ClothingAndMisc
  w._pick(0);

  assert.equal(revealed, 1, 'RecordLocationFromMap ran');
  assert.equal(bag.length, 0, 'from.RemoveItem ate the map');
  assert.deepEqual(w._remote(), [], 'and it did NOT land in the remote pile');
  assert.equal(MAP_TEXT_ID, 499, 'the reveal message is TEXT.RSC 499 (:1820)');
  assert.deepEqual(w.topBox.rows, ROWS(499));
});

test('AUDIT 26 F156: taking a map OFF a loot pile reads it where it lies', () => {
  // The other caller (RemoteItemListScroller_OnItemClick :2043 ->
  // TransferItem with from = remoteItems): the arm is direction-blind.
  const bag = [];
  const pile = [mapItem()];
  let revealed = 0;
  const w = new NativeInventoryWindow({
    items: () => bag, icons: ICONS, rows: ROWS, loot: { items: () => pile },
    revealMap: () => { revealed++; return 'Sentinel'; },
  });
  w.mode = 'remove';
  w._pickRemote(0);

  assert.equal(revealed, 1);
  assert.equal(pile.length, 0, 'the pile no longer holds it');
  assert.deepEqual(bag, [], 'and it never entered the pack');
  assert.deepEqual(w.topBox.rows, ROWS(499));
});

test('AUDIT 26 F156: a host with no reveal seam does not eat the map', () => {
  // useItem's recorded answer (the ONE member the arm is read from):
  // no DiscoverRandomLocation to walk, so nothing is claimed and the
  // map stays where it is.
  const bag = [mapItem()];
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, rows: ROWS });
  w.mode = 'remove';
  w.tab = 'clothing';
  w._pick(0);
  assert.equal(bag.length, 1, 'unread and uneaten');
  assert.deepEqual(w._remote(), [], 'and still not transferred');
});

// ---------------------------------------------------------------
// F157  TransferItem's light arm - out of the pack is out
// ---------------------------------------------------------------
test('AUDIT 26 F157: dropping a LIT torch puts it out', () => {
  // :1506-1508 - `item.IsLightSource && playerEntity.LightSource ==
  // item && from == localItems`.
  const lit = torch();
  const entity = { stats: { strength: 50 }, items: [lit], lightSource: lit };
  const w = new NativeInventoryWindow({ items: () => entity.items, entity, icons: ICONS, rows: ROWS });
  w.mode = 'remove';
  w.tab = 'clothing';
  w._pick(0);

  assert.equal(entity.items.length, 0, 'the torch left the pack');
  assert.equal(entity.lightSource, null, 'and the light went with it');
});

test('AUDIT 26 F157: the arm is exact - another torch, and the pile side, leave the light alone', () => {
  const lit = torch();
  const spare = torch();
  const entity = { stats: { strength: 50 }, items: [lit, spare], lightSource: lit };
  const w = new NativeInventoryWindow({ items: () => entity.items, entity, icons: ICONS, rows: ROWS });
  w.mode = 'remove';
  w.tab = 'clothing';
  w._pick(1);                                  // the SPARE goes
  assert.equal(entity.lightSource, lit, 'LightSource == item is a THIS-item test');

  // `from == localItems` is the other half: a torch taken off a pile
  // was never the player's light.
  const pile = [torch()];
  const w2 = new NativeInventoryWindow({
    items: () => entity.items, entity, icons: ICONS, rows: ROWS, loot: { items: () => pile },
  });
  w2.mode = 'remove';
  w2._pickRemote(0);
  assert.equal(entity.lightSource, lit, 'a pickup is not a transfer OUT');
});

test('AUDIT 26 F157: staging a lit torch for SALE puts it out too', () => {
  // DaggerfallTradeWindow stages through the same TransferItem, `from`
  // = localItems at every one of :795/:817/:823/:826.
  const lit = torch();
  const bag = [lit];
  const entity = { stats: { strength: 50 }, items: bag, lightSource: lit };
  const w = new NativeTradeWindow({
    mode: 'Sell', entity, icons: ICONS,
    shelfItems: () => [], packItems: () => bag,
    accepts: () => true, enchanted: () => false,
    priceCtx: () => ({ quality: 10, skills: { mercantile: 50, personality: 50 } }),
    gold: () => 100, rows: ROWS,
    weight: () => ({ carriedWeightKg: 0, maxEncumbranceKg: 1e9 }),
  });
  w._pickLocal(0);
  assert.deepEqual(w.staged, [lit], 'it is staged');
  assert.equal(entity.lightSource, null, 'and doused');
});

// ---------------------------------------------------------------
// F158  the Buy basket is weighed - CanCarryAmount over GetCarriedWeight
// ---------------------------------------------------------------
const buyWindow = (shelf, { carriedWeightKg = 0, maxEncumbranceKg = 5 } = {}) => new NativeTradeWindow({
  mode: 'Buy', icons: ICONS,
  shelfItems: () => shelf, packItems: () => [],
  accepts: () => true, enchanted: () => false,
  priceCtx: () => ({ quality: 10, skills: { mercantile: 50, personality: 50 } }),
  gold: () => 100000, rows: ROWS,
  weight: () => ({ carriedWeightKg, maxEncumbranceKg }),
});

test('AUDIT 26 F158: the basket fills against MaxEncumbrance and then refuses', () => {
  // :842 - `TransferItem(item, remoteItems, basketItems,
  // CanCarryAmount(item), ...)`, and this window's GetCarriedWeight
  // (:630-633) is `PlayerEntity.CarriedWeight + basketItems.GetWeight()`,
  // so the gate TIGHTENS as the basket fills.
  const book = (n) => ({ group: 'Books', templateIndex: 277, name: n, value: 40, stackCount: 1 });   // 2 kg each
  const shelf = [book('A'), book('B'), book('C')];
  const w = buyWindow(shelf, { maxEncumbranceKg: 5 });

  w._pickRemote(0);
  w._pickRemote(0);
  assert.equal(w.basket.length, 2, '4 kg of the 5 staged');
  assert.equal(shelf.length, 1);

  w._pickRemote(0);
  assert.equal(w.basket.length, 2, 'the third does not fit');
  assert.equal(shelf.length, 1, 'and it stays on the shelf');
  assert.equal(w.box.rows[0].text, CANNOT_CARRY_TEXT, 'CanCarryAmount says so (key cannotCarryAnymore)');
});

test('AUDIT 26 F158: a partial fit SPLITS the lot, taking exactly what fits', () => {
  const stack = { group: 'Books', templateIndex: 277, name: 'Lot', value: 40, stackCount: 3 };
  const shelf = [stack];
  const w = buyWindow(shelf, { maxEncumbranceKg: 5 });   // 2 of the 3 books fit
  w._pickRemote(0);
  assert.equal(w.basket.length, 1);
  assert.equal(w.basket[0].stackCount, 2, 'exactly what fits is staged');
  assert.equal(stack.stackCount, 1, 'the rest stays on the shelf');
});

test('AUDIT 26 F158: no weight seam mounted leaves the gate open', () => {
  const shelf = [{ group: 'Books', templateIndex: 277, name: 'A', value: 40, stackCount: 1 }];
  const w = new NativeTradeWindow({
    mode: 'Buy', icons: ICONS, shelfItems: () => shelf, packItems: () => [],
    accepts: () => true, enchanted: () => false, gold: () => 1, rows: ROWS,
    priceCtx: () => ({ quality: 10, skills: {} }),
  });
  w._pickRemote(0);
  assert.equal(w.basket.length, 1, 'no capacity to read, no refusal');
  assert.equal(w.box, null);
});

// ---------------------------------------------------------------
// F159  the conversation arrows, and the pin that is NOT per frame
// ---------------------------------------------------------------
const talkWindow = () => new NativeTalkWindow('Yes?', {
  categories: () => [], answer: () => 'It is east of here.', question: () => 'Where is the Odd Blades?',
  tone: () => 1, setTone: () => {}, onClose: () => {},
});

test('AUDIT 26 F159: the conversation arrows are DFU rects and move 5 pixels', () => {
  // rectButtonConversationUp/Down (DaggerfallTalkWindow.cs:226-227),
  // handlers at :1442-1452.
  assert.deepEqual([...TALK_RECTS.conversationUp], [303, 64, 9, 16]);
  assert.deepEqual([...TALK_RECTS.conversationDown], [303, 176, 9, 16]);
  assert.equal(CONVERSATION_ARROW_SCROLL, 5);

  const w = talkWindow();
  w._resolveConversationScroll(326);            // 30 rows, as the draw measures them
  assert.equal(w.conversationScroll, conversationScroll(326, 126), 'OnPush pinned it to the last row');
  assert.equal(w.conversationScroll, 200);

  assert.equal(w.click(305, 70), true, 'the up arrow is live');
  assert.equal(w.conversationScroll, 195, 'ScrollIndex -= 5');
  assert.equal(w.click(305, 180), true);
  assert.equal(w.conversationScroll, 200, 'ScrollIndex += 5');

  // SetScrollIndex clamps to [0, totalUnits - displayUnits] both ways
  for (let i = 0; i < 60; i++) w.click(305, 70);
  assert.equal(w.conversationScroll, 0);
  for (let i = 0; i < 60; i++) w.click(305, 180);
  assert.equal(w.conversationScroll, 200);
});

test('AUDIT 26 F159: the scroll SURVIVES the next frame, and only a new answer re-pins it', () => {
  // UpdateScrollBarConversation runs at OnPush (:275-278) and after a
  // Q&A pair (:1282) - NOT every frame. Recomputing it per frame
  // nailed the panel to its last row and no arrow could lift it.
  const w = talkWindow();
  w._resolveConversationScroll(326);
  w.click(305, 70);                             // read back 5 px
  assert.equal(w.conversationScroll, 195);
  assert.equal(w._resolveConversationScroll(326), 195, 'the next frame draws where the player left it');
  assert.equal(w._resolveConversationScroll(326), 195, 'and the one after that');

  // SetQuestionAnswerPairInConversationListbox (:1251-1284) ends in
  // UpdateScrollBarConversation, which pins to the bottom again.
  w.topicMode = 'topics';
  w.topics = [{ label: 'The Odd Blades' }];
  w._pickIndex(0);
  assert.equal(w.conversation.length, 3, 'the greeting plus the Q&A pair');
  assert.equal(w._resolveConversationScroll(400), conversationScroll(400, 126), 'the newest answer is shown');
});

// ---------------------------------------------------------------
// F160  HandleClick's notebook arms: add, move, remove
// ---------------------------------------------------------------
// questLogLabel's font: LineHeight is glyph height x textScale.
const FONT = { fnt: { fixedWidth: 6, fixedHeight: 7, glyphWidth: () => 5 } };
const note = (text) => [{ formatting: 'text', text }];

/** The notebook members HandleClick reaches (PlayerNotebook's own). */
const fakeNotebook = (notes) => ({
  getNotes: () => [...notes],
  getNote: (i) => notes[i] ?? null,
  removeNote: (i) => { notes.splice(i, 1); },
  moveNote: (src, dest) => {
    const item = notes[src];
    notes.splice(src, 1);
    notes.splice(dest > src ? dest - 1 : dest, 0, item);
  },
  addNote: (str, index = -1) => {
    if (index === -1) notes.push(note(str));
    else notes.splice(index, 0, note(str));
  },
  getFinishedQuests: () => [], getMessages: () => [],
});

const journalOn = (notes, mode = 'notebook') => {
  const w = new QuestJournalWindow({ questMessages: () => [], notebook: () => fakeNotebook(notes), mode });
  w._font = FONT;
  return w;
};
/** The y of a drawn line. questLogLabel.LineHeight is the glyph height
 *  times the page's TextScale, as an int (:36, textScaleSmall 0.8):
 *  trunc(7 * 0.8) = 5 on the notebook and message pages. */
const lineY = (n) => JOURNAL_RECTS.log[1] + n * 5 + 1;

test('AUDIT 26 F160: the gaps between notebook entries are NEGATIVE, as SetTextWithListEntries numbers them', () => {
  // :672 `entryLineMap.Add(--boundary)` - the blank line that closes
  // each entry maps to -1, -2, -3 down the page, and those negatives
  // are the whole of how HandleClick tells "on an entry" from
  // "between entries". SetTextActiveQuests (:602) maps the same line
  // to the entry instead, which is why a click under a quest still
  // opens that quest.
  const w = journalOn([note('first'), note('second')]);
  w.pageLines();
  assert.deepEqual(w.entryLineMap, [0, -1, 1, -2]);

  const q = new QuestJournalWindow({
    questMessages: () => [{ getTextTokens: () => [{ formatting: 'text', text: 'a quest' }] }],
    notebook: () => null,
  });
  q.pageLines();
  assert.deepEqual(q.entryLineMap, [0, 0], 'the active-quests page numbers BOTH lines to the entry');
});

test('AUDIT 26 F160: a click BETWEEN notebook entries adds a note there', () => {
  // :409-411 -> EnterNote(:505-524): selectedEntry = -index +
  // currentMessageIndex, and AddNote(text, selectedEntry) inserts at it.
  const notes = [note('first'), note('second')];
  const w = journalOn(notes);
  assert.equal(w.click(JOURNAL_RECTS.log[0] + 4, lineY(1)), true, 'the gap under the first entry');
  assert.equal(w.selectedEntry, 1, '-(-1) + 0');
  assert.deepEqual(w.noteBox.rows, [{ text: ENTER_NOTE_TEXT, center: false }]);
  assert.equal(ENTER_NOTE_TEXT, 'Enter your note:', 'Internal_Strings.csv :802');

  w.input('char:h');
  w.input('char:i');
  assert.equal(w.noteEntry, 'hi');
  w.input('confirm');
  assert.deepEqual(notes.map((n) => n[0].text), ['first', 'hi', 'second'], 'filed BETWEEN the two');
  assert.equal(w.noteBox, null);
  assert.equal(w.selectedEntry, -1, 'NULLINT again (:373)');

  // an EMPTY line files nothing (:367)
  w.click(JOURNAL_RECTS.log[0] + 4, lineY(1));
  w.input('back');
  assert.equal(notes.length, 3, 'cancel adds nothing');
});

test('AUDIT 26 F160: the TITLE panel adds a note - the only door an empty notebook has', () => {
  // TitlePanel_OnMouseClick (:297-300) is `EnterNote(0)`, and the
  // guard at :507 is why it does nothing off the notebook page.
  const notes = [];
  const w = journalOn(notes);
  assert.equal(w.click(JOURNAL_RECTS.title[0] + 2, JOURNAL_RECTS.title[1] + 2), true);
  assert.ok(w.noteBox, 'the field opened');
  w.input('char:a');
  w.input('confirm');
  assert.deepEqual(notes.map((n) => n[0].text), ['a']);

  const finished = new QuestJournalWindow({ questMessages: () => [], notebook: () => fakeNotebook([]), mode: 'finishedQuests' });
  finished._font = FONT;
  assert.equal(finished.click(JOURNAL_RECTS.title[0] + 2, JOURNAL_RECTS.title[1] + 2), true, 'consumed');
  assert.equal(finished.noteBox, null, 'but EnterNote is the notebook page only');
});

test('AUDIT 26 F160: click an entry to MOVE it, right-click to REMOVE it', () => {
  // :413-421 CreateDialogBox over confirmMove / confirmRemove, and
  // MoveEntry_OnButtonClick (:346-351) KEEPS the selection on Yes -
  // which is what arms the next click as the destination (:425-434).
  const notes = [note('first'), note('second'), note('third')];
  const w = journalOn(notes);
  assert.equal(w.click(JOURNAL_RECTS.log[0] + 4, lineY(4)), true, 'the third entry');
  assert.equal(w.selectedEntry, 2);
  assert.deepEqual(w.entryBox.rows, [
    { text: CONFIRM_MOVE_TEXT.head, center: true },
    { text: CONFIRM_MOVE_TEXT.action, center: false },
    { text: '', center: false },
    { text: 'third', center: true },
    { text: CONFIRM_MOVE_TEXT.note, center: false },
  ]);
  assert.deepEqual([CONFIRM_MOVE_TEXT.head, CONFIRM_MOVE_TEXT.action, CONFIRM_MOVE_TEXT.note],
    ['Move entry', 'Do you want to change the position of this entry?',
      '(It will be moved to before the next entry clicked)'], 'Internal_Strings.csv :793-795');

  w.answerEntryBox(MB_BUTTONS.Yes);
  assert.equal(w.selectedEntry, 2, 'Yes keeps the source');
  w.click(JOURNAL_RECTS.log[0] + 4, lineY(0));   // ...and this click is the destination
  assert.deepEqual(notes.map((n) => n[0].text), ['third', 'first', 'second']);
  assert.equal(w.selectedEntry, -1, 'the move ends the selection (:431)');

  // the RIGHT-click is the same handler, one flag apart (:327-330)
  assert.equal(w.click(JOURNAL_RECTS.log[0] + 4, lineY(0), true), true);
  assert.deepEqual(w.entryBox.rows[0], { text: CONFIRM_REMOVE_TEXT.head, center: true });
  assert.deepEqual([CONFIRM_REMOVE_TEXT.head, CONFIRM_REMOVE_TEXT.action, CONFIRM_REMOVE_TEXT.note],
    ['Delete entry', 'Are you sure you want to remove this entry?',
      '(It will be deleted permanently and cannot be restored)'], 'Internal_Strings.csv :796-798');
  w.answerEntryBox(MB_BUTTONS.Yes);
  assert.deepEqual(notes.map((n) => n[0].text), ['first', 'second'], 'RemoveEntry ran');
  assert.equal(w.selectedEntry, -1);

  // No on the move box drops the selection instead (:348-349)
  w.click(JOURNAL_RECTS.log[0] + 4, lineY(0));
  w.answerEntryBox(MB_BUTTONS.No);
  assert.equal(w.selectedEntry, -1);
  assert.deepEqual(notes.map((n) => n[0].text), ['first', 'second'], 'and nothing moved');
});

test('AUDIT 26 F160: the MESSAGES page is read-only - GetEntry answers nothing for it', () => {
  // :526-535 - the switch has arms for FinshedQuests and Notebook only.
  const messages = [note('a message')];
  const w = new QuestJournalWindow({
    questMessages: () => [],
    notebook: () => ({ getNotes: () => [], getFinishedQuests: () => [], getMessages: () => messages }),
    mode: 'messages',
  });
  w._font = FONT;
  w.click(JOURNAL_RECTS.log[0] + 4, lineY(0));
  assert.equal(w.entryBox, null, 'no move box');
  assert.equal(w.noteBox, null, 'and no note field');
});

// ---------------------------------------------------------------
// The equip pause: the window is SetEquipDelayTime's only caller
// ---------------------------------------------------------------
test('AUDIT 26 F128 wiring: the window snapshots at OnPush and bills the NET at OnPop', () => {
  // OnPush (:667) SetEquipDelayTime(false) - "Update tracked weapons
  // for setting equip delay"; OnPop (:729) SetEquipDelayTime(true) -
  // "Add equip delay if weapon was changed".
  const entity = { stats: { strength: 50 }, items: [], equipCountdown: 0 };
  entity.items.push({ group: 'Weapons', templateIndex: 113, name: 'Dagger' });
  entity.items.push({ group: 'Weapons', templateIndex: 123, name: 'Katana' });
  const w = new NativeInventoryWindow({ items: () => entity.items, entity, icons: ICONS, rows: ROWS });
  assert.equal(w.mode, 'equip');
  w._pick(0);                       // empty hands -> dagger
  w._pick(0);                       // dagger -> katana (an equipped item leaves the list)
  assert.equal(entity.equipCountdown, 0, 'nothing is billed while the window is open');

  w._close();
  assert.equal(entity.equipCountdown, EQUIP_DELAY_TIMES[10]);
  assert.equal(entity.equipCountdown, 3400, 'the katana alone - NOT 500 + 500 + 3400');

  // a session that changes nothing bills nothing...
  const w2 = new NativeInventoryWindow({ items: () => entity.items, entity, icons: ICONS, rows: ROWS });
  w2._close();
  assert.equal(entity.equipCountdown, 3400, 'last == current, so no bill');

  // ...and the bill lands ONCE however the window is closed.
  const w3 = new NativeInventoryWindow({ items: () => entity.items, entity, icons: ICONS, rows: ROWS });
  w3._pick(0);                      // katana -> dagger
  w3._close();
  w3._close();                      // a second drain must not bill again
  assert.equal(entity.equipCountdown, 3400 + EQUIP_DELAY_TIMES[10] + EQUIP_DELAY_TIMES[0]);
});
