import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PICKER_W, PICKER_H, PICKER_X, PICKER_Y, PICKER_RECTS,
  ROWS_DISPLAYED, ROW_SPACING, SELECTED_TEXT_COLOR, ListPickerWindow,
} from '../src/ui/listPicker.js';
import { DOUBLE_CLICK_DELAY_MS } from '../src/ui/chargenArt.js';
import {
  ServiceFlowWindow, buildTrainingFlow, buildDonationFlow, buildCureDiseaseFlow,
  DONATE_HOW_MUCH, FREE_HOLIDAY_CURING, CURED_DISEASE, DONATION_FIELD,
} from '../src/ui/guildServiceWindows.js';
import { GUILDS } from '../src/systems/guilds.js';
import { templeOf } from '../src/systems/guildVariants.js';
import { createFactionRep, getReputation } from '../src/systems/factionRep.js';
import { SKILLS, SKILL_NAMES } from '../src/systems/skills.js';
import { goldAmount } from '../src/systems/court.js';
import { startDisease, diseaseCount } from '../src/systems/diseases.js';
import { TRAINING_SKILLS } from '../src/systems/guildServices.js';
import { TRAINING_TOO_SOON_ID, TRAIN_SKILL_ID, NOT_ENOUGH_GOLD_ID,
  TRAINING_TOO_SKILLED_ID, DONATION_THANKS_ID, TOO_GENEROUS_ID } from '../src/systems/guildServiceActions.js';

const rows = (id) => [{ text: `rsc:${id}`, center: true }];
const idOf = (box) => Number(/rsc:(\d+)/.exec(box?.rows?.[0]?.text ?? '')?.[1] ?? NaN);

const player = (over = {}) => ({
  name: 'Bob', isPlayer: true, level: 2, health: 30, maxHealth: 30,
  items: [{ group: 'Currency', name: 'Gold pieces', stackCount: 5000 }],
  skills: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 20])),
  skillUses: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 0])),
  stats: { personality: 50 }, activeEffects: [], fatigue: 3200,
  timeOfLastSkillTraining: 0, ...over,
});

// ── the list picker's geometry (DaggerfallListPickerWindow) ───────

test('U24: PICK00I0 is 200x128, centred and middled', () => {
  assert.equal(PICKER_W, 200);
  assert.equal(PICKER_H, 128);
  assert.equal(PICKER_X, 60);
  assert.equal(PICKER_Y, 36);
});

test('U24: the picker\'s child rects and ListBox defaults are DFU literals', () => {
  assert.deepEqual(PICKER_RECTS, {
    list: [26, 27, 138, 72],
    previous: [179, 10, 9, 9],
    next: [179, 108, 9, 9],
    scrollBar: [181, 23, 5, 82],
  });
  assert.equal(ROWS_DISPLAYED, 9);
  assert.equal(ROW_SPACING, 1);
  // DaggerfallUI.cs:62 - the SELECTED row is a DARK RED, not a
  // brighter yellow, which is the one people guess wrong
  assert.deepEqual(SELECTED_TEXT_COLOR.slice(0, 3).map((c) => Math.round(c * 255)), [162, 36, 12]);
});

test('U24 (X11b CORRECTED): the two buttons move the SELECTION by ONE, not a page', () => {
  // THIS GATE USED TO ASSERT THE OPPOSITE, and it was wrong. It cited
  // ScrollToNext/ScrollToPrevious, which belong to a different window.
  // DaggerfallListPickerWindow's own buttons call
  // `listBox.SelectPrevious()` / `SelectNext()` (:121-129): the
  // SELECTION moves one row and the list scrolls only far enough to
  // keep it visible (ListBox.cs:709-741, VerticalScrollModes.EntryWise).
  // On a 29-row list - Create Item's picker, the longest in the game -
  // paging by nine is the difference between choosing an item and
  // hunting for it. A green gate that pins the wrong law is worse than
  // no gate, which is why this one is rewritten rather than deleted.
  const items = Array.from({ length: 25 }, (_, i) => `item${i}`);
  const w = new ListPickerWindow({ items });
  const at = (rect, dx = 1, dy = 1) => [PICKER_X + rect[0] + dx, PICKER_Y + rect[1] + dy];
  assert.equal(w.scrollIndex, 0);
  assert.equal(w.selectedIndex, 0);
  // stepping DOWN inside the visible window moves the selection and
  // nothing else
  for (let i = 0; i < ROWS_DISPLAYED - 1; i++) w.click(...at(PICKER_RECTS.next));
  assert.equal(w.selectedIndex, ROWS_DISPLAYED - 1);
  assert.equal(w.scrollIndex, 0, 'the list has not moved - the selection is still on screen');
  // the next step pushes the selection past the last visible row, so
  // the list scrolls by exactly ONE
  w.click(...at(PICKER_RECTS.next));
  assert.equal(w.selectedIndex, ROWS_DISPLAYED);
  assert.equal(w.scrollIndex, 1);
  // ...all the way to the end, where SelectNext simply refuses
  for (let i = 0; i < 40; i++) w.click(...at(PICKER_RECTS.next));
  assert.equal(w.selectedIndex, 24, 'SelectNext refuses at the last row');
  assert.equal(w.scrollIndex, 25 - ROWS_DISPLAYED, 'and the scroll bound holds');
  // and back up the same way
  w.click(...at(PICKER_RECTS.previous));
  assert.equal(w.selectedIndex, 23);
  assert.equal(w.scrollIndex, 25 - ROWS_DISPLAYED, 'still visible, so still no scroll');
  for (let i = 0; i < 40; i++) w.click(...at(PICKER_RECTS.previous));
  assert.equal(w.selectedIndex, 0, 'SelectPrevious refuses at the first row');
  assert.equal(w.scrollIndex, 0, 'never below zero');
  // a list shorter than the window does not scroll at all
  const small = new ListPickerWindow({ items: ['a', 'b'] });
  small.click(...at(PICKER_RECTS.next));
  assert.equal(small.scrollIndex, 0);
  assert.equal(small.selectedIndex, 1);
});

test('U24 (ROAD-A7 CORRECTED): a click SELECTS the scrolled row; the DOUBLE click uses it', () => {
  // THIS PIN MOVED, deliberately, and the law it now holds is DFU's.
  // It used to assert that one click PICKED, because the port's
  // ListPickerWindow did - and ListBox.cs does not. MouseClick
  // (:465-505) only moves selectedIndex and raises OnSelectItem;
  // MouseDoubleClick (:507-512) is what reaches UseSelectedItem and,
  // through DaggerfallListPickerWindow's ListBox_OnUseSelectedItem
  // (:136-139), OnItemPicked. The row-resolution half of the old pin -
  // that the click resolves against the SCROLLED index, not the
  // visible row - is the same and is kept.
  const items = Array.from({ length: 25 }, (_, i) => `item${i}`);
  const picked = [];
  const w = new ListPickerWindow({ items, onPick: (i, l) => picked.push([i, l]) });
  const font = { fnt: { fixedHeight: 6 } };
  w.scrollIndex = 9;
  // row 2 of the visible page, at (glyphHeight + rowSpacing) each
  const rh = 6 + ROW_SPACING;
  const at = [PICKER_X + PICKER_RECTS.list[0] + 1, PICKER_Y + PICKER_RECTS.list[1] + 2 * rh + 1];
  w.click(at[0], at[1], font, 1000);
  assert.deepEqual(picked, [], 'one click picks nothing');
  assert.equal(w.selectedIndex, 11, 'it moved the SELECTION to the scrolled row');
  assert.equal(w.done, false, 'and the window is still up');
  // a second click far outside doubleClickDelay is another single click
  w.click(at[0], at[1], font, 1000 + DOUBLE_CLICK_DELAY_MS + 1);
  assert.deepEqual(picked, []);
  // ...and one inside it is the double click, which uses the row
  w.click(at[0], at[1], font, 1000 + DOUBLE_CLICK_DELAY_MS + 2);
  assert.deepEqual(picked, [[11, 'item11']]);
  assert.equal(w.done, true);
});

test('U24 (ROAD-A7): Return is UseSelectedItem, the same door', () => {
  // ListBox.Update :296-297 - KeyCode.Return calls UseSelectedItem(),
  // which is exactly what MouseDoubleClick calls.
  const picked = [];
  const w = new ListPickerWindow({ items: ['a', 'b', 'c'], onPick: (i, l) => picked.push([i, l]) });
  w.input('ArrowDown');
  assert.equal(w.selectedIndex, 1);
  w.input('Enter');
  assert.deepEqual(picked, [[1, 'b']]);
});

test('U24: a click outside the panel cancels', () => {
  let cancelled = 0;
  const w = new ListPickerWindow({ items: ['a'], onCancel: () => { cancelled++; } });
  assert.equal(w.click(2, 2), true);
  assert.equal(cancelled, 1);
  assert.equal(w.done, true);
});

// ── the training chain ────────────────────────────────────────────

test('U24: too soon -> one box, no offer, no picker', () => {
  const e = player({ timeOfLastSkillTraining: 99999 });
  const f = buildTrainingFlow(e, GUILDS.FightersGuild, null, { rows, now: () => 100000 });
  assert.equal(idOf(f.top), TRAINING_TOO_SOON_ID);
  assert.equal(f.top.buttons, undefined, 'a click-anywhere box, not a question');
  f.input('Enter');
  assert.equal(f.done, true);
});

test('U24: the training chain - offer, gold check, picker, train', () => {
  const e = player({ level: 2 });
  const applied = [];
  const f = buildTrainingFlow(e, GUILDS.FightersGuild, { guild: 'FightersGuild', rank: 0 }, {
    rows, now: () => 100000, rolls: () => 0,
    applyTraining: (r, price) => applied.push([r.skill, r.tally, r.advanceMinutes, price]),
  });
  assert.equal(f.top.buttons, 'YesNo');
  f.input('KeyY');
  // the picker holds the guild's OWN training skills, by name
  // The list is the guild's TRAINING skills, by name - NOT its rank
  // skills, which are a different and shorter set (Jumping, Running
  // and Swimming are trainable at the Fighters Guild and count for no
  // rank at all).
  assert.deepEqual(f.top.picker, TRAINING_SKILLS.FightersGuild.map((sk) => SKILL_NAMES[sk]));
  assert.ok(f.top.picker.includes(SKILL_NAMES[SKILLS.Running]));
  assert.equal(GUILDS.FightersGuild.skills.includes(SKILLS.Running), false);
  f.input('Enter');   // picks the selected row (0)
  assert.equal(applied.length, 1);
  assert.equal(applied[0][2], 180, 'three hours');
  assert.equal(applied[0][3], 200, 'a rank-0 member at level 2');
  assert.equal(idOf(f.top), TRAIN_SKILL_ID);
  f.input('Enter');
  assert.equal(f.done, true);
});

test('U24: no gold -> the picker never opens', () => {
  const e = player({ level: 20 });   // 8000 needed, 5000 carried
  const applied = [];
  const f = buildTrainingFlow(e, GUILDS.FightersGuild, null, {
    rows, now: () => 100000, applyTraining: () => applied.push(1),
  });
  f.input('KeyY');
  assert.equal(idOf(f.top), NOT_ENOUGH_GOLD_ID);
  assert.equal(f.top.picker, undefined);
  assert.deepEqual(applied, []);
});

test('U24: too skilled -> the message, and NO payment taken', () => {
  const guild = GUILDS.FightersGuild;
  const e = player({ skills: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 99])) });
  const applied = [];
  const f = buildTrainingFlow(e, guild, null, {
    rows, now: () => 100000, applyTraining: () => applied.push(1),
  });
  f.input('KeyY');
  assert.ok(f.top.picker);
  f.input('Enter');
  assert.equal(idOf(f.top), TRAINING_TOO_SKILLED_ID);
  assert.deepEqual(applied, [], 'DFU pays AFTER the skill gate, not before');
  assert.equal(goldAmount(e), 5000);
});

test('U24: saying No to the offer ends the chain', () => {
  const f = buildTrainingFlow(player(), GUILDS.FightersGuild, null, { rows, now: () => 100000 });
  f.input('KeyN');
  assert.equal(f.done, true);
});

// ── the donation chain ────────────────────────────────────────────

const store21 = () => createFactionRep(new Map([[21, { id: 21, rep: 0, children: [] }]]));

test('U24: the donation field opens pre-filled on 1000 and refuses letters', () => {
  const e = player();
  const f = buildDonationFlow(e, store21(), 21, { rows });
  assert.equal(f.top.rows[0].text, DONATE_HOW_MUCH);
  assert.deepEqual(f.top.field, DONATION_FIELD);
  assert.equal(f.value, '1000', 'TextBox.Text = "1000"');
  f.input('backspace'); f.input('backspace'); f.input('backspace'); f.input('backspace');
  assert.equal(f.value, '');
  f.input('char:a'); f.input('char:5'); f.input('char:-');
  assert.equal(f.value, '5', 'TextBox.Numeric drops everything but digits');
  for (let i = 0; i < 20; i++) f.input('char:9');
  assert.equal(f.value.length, 8, 'MaxCharacters 8');
});

test('U24: a donation lands, and an unaffordable one is refused', () => {
  const e = player();
  const store = store21();
  const f = buildDonationFlow(e, store, 21, { rows, rolls: () => 0 });
  f.value = '100';
  f.input('Enter');
  assert.equal(idOf(f.top), DONATION_THANKS_ID);
  assert.equal(goldAmount(e), 4900);
  assert.equal(getReputation(store, 21), 1);

  const e2 = player();
  const f2 = buildDonationFlow(e2, store21(), 21, { rows, rolls: () => 0 });
  f2.value = '99999';
  f2.input('Enter');
  assert.equal(idOf(f2.top), TOO_GENEROUS_ID);
  assert.equal(goldAmount(e2), 5000);
});

test('U24: an unparsable field does NOTHING AT ALL, as int.TryParse does', () => {
  const e = player();
  const f = buildDonationFlow(e, store21(), 21, { rows });
  f.value = '';
  f.input('Enter');
  assert.equal(f.done, true, 'the window closes with no message');
  assert.equal(goldAmount(e), 5000);
});

// ── the cure chain ────────────────────────────────────────────────

test('U24: the cure chain pays, cures, and says so', () => {
  const e = player();
  startDisease(e, 0, 0, () => 0);
  const f = buildCureDiseaseFlow(e, GUILDS.FightersGuild, null, {
    rows, now: () => 0, quality: 10,
  });
  assert.equal(f.top.buttons, 'YesNo');
  const before = goldAmount(e);
  f.input('KeyY');
  assert.equal(f.top.rows[0].text, CURED_DISEASE);
  assert.equal(diseaseCount(e), 0);
  assert.ok(goldAmount(e) < before);
});

test('U24: a free-holiday cure happens on OPEN, before any question', () => {
  const e = player({ items: [] });   // no gold at all
  startDisease(e, 0, 0, () => 0);
  // South Winds Prayer is day 15 (0x0F), everywhere
  const f = buildCureDiseaseFlow(e, templeOf('Arkay'), null, {
    rows, now: () => 14 * 1440, quality: 10, regionIndex: 0,
  });
  assert.equal(f.top.rows[0].text, FREE_HOLIDAY_CURING);
  assert.equal(diseaseCount(e), 0, 'cured before the box was even dismissed');
});

test('U24: saying yes with no gold is told so, and stays sick', () => {
  const e = player({ items: [{ group: 'Currency', name: 'Gold pieces', stackCount: 1 }] });
  startDisease(e, 0, 0, () => 0);
  const f = buildCureDiseaseFlow(e, GUILDS.FightersGuild, null, { rows, now: () => 0, quality: 10 });
  f.input('KeyY');
  assert.equal(idOf(f.top), NOT_ENOUGH_GOLD_ID);
  assert.equal(diseaseCount(e), 1);
});

test('U24: ServiceFlowWindow closes only when its queue empties', () => {
  const closed = [];
  const f = new ServiceFlowWindow([
    { rows: [{ text: 'one' }] },
    { rows: [{ text: 'two' }] },
  ], { onClose: () => closed.push(1) });
  f.input('Enter');
  assert.equal(f.done, false);
  assert.equal(f.top.rows[0].text, 'two');
  f.input('Enter');
  assert.equal(f.done, true);
  assert.deepEqual(closed, [1]);
});
