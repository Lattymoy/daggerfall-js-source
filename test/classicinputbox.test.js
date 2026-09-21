// CM3 - THE ONE DAGGERFALL INPUT MESSAGE BOX (ui/inputMessageBox.js).
// Pins the modal itself - both hosts' vocabularies, the cap, the numeric
// filter, the close-before-callback order - the action system's
// construction of it (ActionInputBox), the first retired inline field
// (the item maker's rename), and the ROSTER: every raiser in src/ui, and
// no window left typing into its own art (Ledger A row TB1, retired).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InputMessageBoxWindow, DEFAULT_INPUT_MAX } from '../src/ui/inputMessageBox.js';
import { ActionInputBox, MAX_INPUT } from '../src/ui/actionText.js';
import { ItemMakerWindow, MAX_ITEM_NAME, ENTER_NEW_NAME } from '../src/ui/itemMakerWindow.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

const icons = () => ({
  getTexture: async () => ({ recordCount: 0 }),
  uploadRecord() {},
  textures: new Map(),
});

const maker = () => {
  const item = { group: 'Gems', templateIndex: 0, name: 'Ruby' };
  const player = { items: [item], goldPieces: 0 };
  const w = new ItemMakerWindow({
    packItems: () => player.items,
    player,
    entity: player,
    icons: icons(),
  });
  w._selectItem(item);
  return { w, item };
};

test('CM3: input box defaults to DFU TextBox max 31 and consumes background clicks without closing', () => {
  const box = new InputMessageBoxWindow({ label: 'Name: ' });
  assert.equal(DEFAULT_INPUT_MAX, 31);
  assert.equal(box.maxCharacters, 31);
  assert.equal(box.click(), true);
  assert.equal(box.done, false, 'DaggerfallInputMessageBox is modal, not ClickAnywhereToClose');
});

test('CM3: input box reads both overlay action chars and raw keyboard chars, with the fixed cap', () => {
  const box = new InputMessageBoxWindow({ maxCharacters: 3 });
  box.input('char:a');
  box.input('KeyB', { key: 'B' });
  box.input('Digit7');
  box.input('char:z');
  assert.equal(box.value, 'aB7', 'the fourth character is rejected at MaxCharacters');
  box.input('Backspace');
  assert.equal(box.value, 'aB');
});

test('CM3: numeric input filters non-digits and Return submits after closing', () => {
  const events = [];
  const box = new InputMessageBoxWindow({
    value: '0', maxCharacters: 8, numeric: true,
    onSubmit: (value) => events.push(['submit', value, box.done]),
    onCancel: () => events.push(['cancel']),
  });
  box.input('char:x');
  box.input('Digit4');
  box.input('Numpad2');
  box.input('Enter');
  assert.equal(box.value, '042');
  assert.deepEqual(events, [['submit', '042', true]], 'ReturnPlayerInputEvent closes before OnGotUserInput');
});

test('CM3: Escape cancels without delivering text', () => {
  const events = [];
  const box = new InputMessageBoxWindow({
    value: 'keep me',
    onSubmit: (v) => events.push(['submit', v]),
    onCancel: () => events.push(['cancel']),
  });
  box.input('Escape');
  assert.equal(box.done, true);
  assert.deepEqual(events, [['cancel']]);
});

test('CM3: Item Maker rename is a pushed input box seeded from the displayed item name', () => {
  const { w } = maker();
  w._openRename();
  assert.ok(w.renameBox instanceof InputMessageBoxWindow);
  assert.equal(w.renameBox.label, ENTER_NEW_NAME);
  assert.equal(w.renameBox.value, 'Ruby');
  assert.equal(w.renameBox.maxCharacters, MAX_ITEM_NAME);

  w.renameBox.value = 'The Red Ruby';
  w.renameBox.input('Enter');
  w.input('noop');   // parent notices the pushed box is done and pops it
  assert.equal(w.itemName, 'The Red Ruby');
  assert.equal(w.renameBox, null);
});

test('CM3: cancelling Item Maker rename preserves the old name', () => {
  const { w } = maker();
  w._openRename();
  w.renameBox.value = 'Discarded';
  w.renameBox.input('Escape');
  w.input('noop');
  assert.equal(w.itemName, 'Ruby');
  assert.equal(w.renameBox, null);
});

test('CM3: the dungeon host\'s ACTION vocabulary drives the same box - confirm, back, backspace, char:x - and a Ctrl chord types nothing', () => {
  const events = [];
  const box = new InputMessageBoxWindow({ lines: ['Say the word.'], label: ' > ', maxCharacters: 5, onSubmit: (v) => events.push(['submit', v]), onCancel: () => events.push(['cancel']) });
  box.input('char:a'); box.input('char:b'); box.input('backspace'); box.input('char:c');
  box.input('KeyV', { key: 'v', ctrlKey: true });   // a paste chord is not a letter
  assert.equal(box.value, 'ac');
  box.input('confirm');
  assert.deepEqual(events, [['submit', 'ac']]);
  const second = new InputMessageBoxWindow({ onCancel: () => events.push(['cancel']) });
  second.input('back');
  assert.deepEqual(events.at(-1), ['cancel']); assert.equal(second.done, true);
});

test('CM3: ActionInputBox IS the one box, built the way DaggerfallAction.cs:565 builds it - record lines above, " > ", 20 characters', () => {
  const got = [];
  const box = new ActionInputBox(['What is the word?'], (v) => got.push(v));
  assert.ok(box instanceof InputMessageBoxWindow);
  assert.equal(MAX_INPUT, 20); assert.equal(box.maxCharacters, MAX_INPUT); assert.equal(box.label, ' > ');
  assert.deepEqual(box.lines, ['What is the word?']);
  assert.equal(box.previousWindow, null, 'AUDIT 64 F35: the one construction with a null previous');
  for (let i = 0; i < 30; i++) box.input('char:x');
  assert.equal(box.value.length, 20);
  box.input('confirm');
  assert.deepEqual(got, ['x'.repeat(20)]); assert.equal(box.done, true);
  assert.equal(/class ActionInputBox extends InputMessageBoxWindow/.test(rd('src/ui/actionText.js')), true);
});

test('CM3-CM11: THE ROSTER - every DaggerfallInputMessageBox in src/ui is a pushed InputMessageBoxWindow, and no window types into its own art', () => {
  // The raisers, by DFU member. A new raiser lands here by name or the
  // pin refuses it; a raiser that grows an inline field of its own
  // again is what the second half catches.
  const raisers = {
    'src/ui/actionText.js': 'ShowTextWithInput (DaggerfallAction.cs:565)',
    'src/ui/automapWindow.js': 'EditUserNote (DaggerfallAutomapWindow.cs:1594-1607)',
    'src/ui/charsheet.js': 'NameButton_OnMouseClick (DaggerfallCharacterSheetWindow.cs:772-784)',
    'src/ui/guildServiceWindows.js': 'DaggerfallGuildServiceDonation :44-51 and the tavern\'s day count',
    'src/ui/itemMakerWindow.js': 'NameItemButon_OnMouseClick (DaggerfallItemMakerWindow.cs:799-811)',
    'src/ui/nativeInventory.js': 'the split popup (:1523-1536) and DropGoldPopup (:1246-1256)',
    'src/ui/saveWindow.js': 'RenameSaveButton_OnMouseClick (DaggerfallUnitySaveGameWindow.cs:566-570)',
    'src/ui/spellMakerWindow.js': 'NameSpellButton_OnMouseClick (DaggerfallSpellMakerWindow.cs:911-918)',
    'src/ui/spellbookWindow.js': 'SpellNameLabel_OnMouseClick (DaggerfallSpellBookWindow.cs:927-938)',
    'src/ui/travelMapWindow.js': 'FindlocationButtonClickHandler (DaggerfallTravelMapWindow.cs:959-975)',
  };
  const files = readdirSync(join(ROOT, 'src/ui')).filter((f) => f.endsWith('.js')).map((f) => `src/ui/${f}`);
  const raising = files.filter((f) => /new InputMessageBoxWindow\(|extends InputMessageBoxWindow/.test(rd(f)) && f !== 'src/ui/inputMessageBox.js');
  assert.deepEqual(raising.sort(), Object.keys(raisers).sort(), 'the raisers, no more and no fewer');
  assert.equal(new Set(Object.values(raisers)).size, Object.keys(raisers).length);
  // The field's law has ONE reader of typed characters in the classic
  // windows. What else reads typedChar in src/ui is a TextBox that is
  // INLINE in DFU too: the bank's transaction amount
  // (DaggerfallBankingWindow.cs:185 `transactionInput = new TextBox()`)
  // and the save window's name box (DaggerfallUnitySaveGameWindow's
  // saveNameTextBox), plus the helper's own home.
  const inlineInDfu = new Set(['src/ui/input.js', 'src/ui/inputMessageBox.js', 'src/ui/bankWindow.js', 'src/ui/saveWindow.js']);
  const typing = files.filter((f) => /typedChar\(/.test(rd(f)));
  assert.deepEqual(typing.filter((f) => !inlineInDfu.has(f)), [], 'no window types a DaggerfallInputMessageBox field into its own art');
  // ...and the inline copies the arc retired are gone by name
  for (const [f, needle] of [
    ['src/ui/spellbookWindow.js', 'renameText'], ['src/ui/travelMapWindow.js', 'findText'], ['src/ui/spellMakerWindow.js', '_nameInput'],
    ['src/ui/itemMakerWindow.js', 'this.renaming'], ['src/ui/automapWindow.js', '_noteBoxInput'], ['src/ui/nativeInventory.js', 'goldEntry'],
    ['src/ui/saveWindow.js', 'renameText'], ['src/ui/guildServiceWindows.js', 'this.value.slice'],
  ]) assert.equal(rd(f).includes(needle), false, `${f} no longer carries ${needle}`);
});

test('CM9: the automap\'s note editor is the box - youNote above, " > ", MaxCharacters 50 (:1603), seeded with the marker\'s note', () => {
  const s = rd('src/ui/automapWindow.js');
  assert.match(s, /lines: \[\{ text: AUTOMAP_STRINGS\.youNote, center: false \}\],\n\s+label: ' > ',\n\s+value: rec\.notes\.get\(id\)\?\.note \?\? '',\n\s+maxCharacters: NOTE_MAX_CHARACTERS,/);
  assert.match(s, /onSubmit: \(value\) => setUserNote\(this\.deps\.record\?\.\(\) \?\? null, id, value\),/, 'OnGotUserInput writes the note home (:1608-1614)');
  assert.match(s, /if \(this\._noteBox\) this\._noteBox\.box\.draw\(renderer, canvas, font, s\);/, 'drawn over the map by the box itself');
});
