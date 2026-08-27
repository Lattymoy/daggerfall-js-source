// SAV4 - multi-slot save management (SaveLoadManager.cs's slot half,
// verbatim laws over the port's one-blob envelope). A Map-backed
// localStorage stub drives every law; the host wiring is source-pinned
// (a canvas cannot boot headless).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  enumerateSaves, migrateLegacyQuicksave, firstFreeKey, saveInfoOf,
  saveKeysOfCharacter, characterNames, findSave, findMostRecentSave,
  saveSlot, loadSlot, restorableSlot, mostRecentRestorable,
  screenshotOf, deleteSave, renameSave,
  quickSaveSlot, hasQuickSave, quickLoadSlot,
  SAVE_DATA_PREFIX, SAVE_INFO_PREFIX, SAVE_SHOT_PREFIX, QUICK_SAVE_NAME,
} from '../src/systems/saveSlots.js';
import { SAVE_VERSION, QUICKSAVE_KEY } from '../src/systems/save.js';

// localStorage's shape over a Map (length + key(i) drive the sweep).
function mockStorage(entries = {}, { failSet = null } = {}) {
  const m = new Map(Object.entries(entries));
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      if (failSet && failSet(k)) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
      m.set(k, String(v));
    },
    removeItem: (k) => { m.delete(k); },
    _map: m,
  };
}

const snapOf = (name, minutes = 100, v = SAVE_VERSION) => ({ v, name, classicMinutes: minutes });

test('SAV4: a save is (characterName, saveName) - overwrite keeps the key, a new pair takes the first free', () => {
  const s = mockStorage();
  const a = saveSlot('Alaric', 'First', snapOf('Alaric'), { storage: s, now: 10 });
  const b = saveSlot('Alaric', 'Second', snapOf('Alaric'), { storage: s, now: 20 });
  const c = saveSlot('Brisa', 'First', snapOf('Brisa'), { storage: s, now: 30 });
  assert.deepEqual([a.key, b.key, c.key], [0, 1, 2], 'first free integer keys');

  // Overwriting Alaric/First lands on key 0 again.
  const a2 = saveSlot('Alaric', 'First', snapOf('Alaric', 500), { storage: s, now: 40 });
  assert.equal(a2.key, 0);
  assert.equal(loadSlot(0, s).classicMinutes, 500);

  // Delete key 1 - CreateNewSavePath recycles it for the next NEW pair.
  assert.equal(deleteSave(1, s), true);
  const d = saveSlot('Brisa', 'Second', snapOf('Brisa'), { storage: s, now: 50 });
  assert.equal(d.key, 1, 'deleted indexes recycle');
});

test('SAV4: enumeration wants the INFO (SaveInfo.txt-must-exist), but a data orphan still blocks its key', () => {
  const s = mockStorage();
  saveSlot('Alaric', 'First', snapOf('Alaric'), { storage: s, now: 10 });
  s._map.set(SAVE_DATA_PREFIX + '7', JSON.stringify(snapOf('Ghost')));   // data with no info
  const { info, characterSaves } = enumerateSaves(s);
  assert.deepEqual([...info.keys()], [0], 'the orphan does not enumerate');
  assert.deepEqual(characterSaves.get('Alaric'), [0]);
  assert.equal(firstFreeKey(s), 1, 'but its key is not recycled under it');
  s._map.delete(SAVE_DATA_PREFIX + '7');
  // A non-integer suffix never parses into a key (int.TryParse's gate).
  s._map.set(SAVE_INFO_PREFIX + 'junk', JSON.stringify({ characterName: 'X', saveName: 'Y' }));
  assert.deepEqual([...enumerateSaves(s).info.keys()], [0]);
});

test('SAV4: most recent is the largest realTime; the window order is descending', () => {
  const s = mockStorage();
  saveSlot('Alaric', 'Old', snapOf('Alaric'), { storage: s, now: 100 });
  saveSlot('Alaric', 'New', snapOf('Alaric'), { storage: s, now: 300 });
  saveSlot('Alaric', 'Mid', snapOf('Alaric'), { storage: s, now: 200 });
  assert.equal(findMostRecentSave(s), 1);
  assert.equal(saveInfoOf(1, s).saveName, 'New');
  assert.deepEqual(characterNames(s), ['Alaric']);
  assert.deepEqual(saveKeysOfCharacter('Alaric', s), [0, 1, 2]);
  assert.equal(findSave('Alaric', 'Mid', s), 2);
  assert.equal(findSave('Alaric', 'Absent', s), -1);
  assert.equal(findSave('Nobody', 'Old', s), -1);
});

test('SAV4: rename writes ONLY when the name changed; delete removes all three keys', () => {
  const s = mockStorage();
  const { key } = saveSlot('Alaric', 'First', snapOf('Alaric'), { storage: s, now: 10, screenshot: 'data:image/jpeg;base64,x' });
  assert.equal(renameSave(key, 'First', s), false, 'same name writes nothing');
  assert.equal(renameSave(key, 'Better', s), true);
  assert.equal(saveInfoOf(key, s).saveName, 'Better');
  assert.equal(renameSave(99, 'X', s), false, 'no info, no rename');

  assert.equal(screenshotOf(key, s), 'data:image/jpeg;base64,x');
  assert.equal(deleteSave(key, s), true);
  assert.equal(s.getItem(SAVE_DATA_PREFIX + key), null);
  assert.equal(s.getItem(SAVE_INFO_PREFIX + key), null);
  assert.equal(s.getItem(SAVE_SHOT_PREFIX + key), null);
  assert.equal(deleteSave(key, s), false, 'a second delete answers false');
});

test('SAV4: the quicksave IS a slot named QuickSave, per character', () => {
  const s = mockStorage();
  assert.equal(hasQuickSave('Alaric', s), false);
  const r = quickSaveSlot('Alaric', snapOf('Alaric', 111), { storage: s, now: 10 });
  assert.equal(r.ok, true);
  assert.equal(hasQuickSave('Alaric', s), true);
  assert.equal(hasQuickSave('Brisa', s), false, 'per character - the QuickLoad law');
  assert.equal(quickLoadSlot('Alaric', s).classicMinutes, 111);
  assert.equal(quickLoadSlot('Brisa', s), null);
  assert.equal(saveInfoOf(r.key, s).saveName, QUICK_SAVE_NAME);
  // A second quicksave OVERWRITES the same slot.
  const r2 = quickSaveSlot('Alaric', snapOf('Alaric', 222), { storage: s, now: 20 });
  assert.equal(r2.key, r.key);
  assert.equal(quickLoadSlot('Alaric', s).classicMinutes, 222);
});

test('SAV4: mostRecentRestorable walks recency and the F2 version gate together', () => {
  const s = mockStorage();
  saveSlot('Alaric', 'Good', snapOf('Alaric', 1), { storage: s, now: 100 });
  saveSlot('Alaric', 'Stale', snapOf('Alaric', 2, SAVE_VERSION + 99), { storage: s, now: 200 });
  // The NEWEST save is a version this build refuses - the walk falls
  // through to the older good one instead of answering nothing.
  const found = mostRecentRestorable(s);
  assert.equal(found.snap.classicMinutes, 1);
  assert.equal(restorableSlot(1, s), null, 'the stale one is refused at the reader');
  assert.equal(mostRecentRestorable(mockStorage()), null);
});

test('SAV4: legacy dagger.quicksave migrates - written, VERIFIED, then removed', () => {
  const legacy = JSON.stringify({ v: SAVE_VERSION, name: 'Old Hero', classicMinutes: 777 });
  const s = mockStorage({ [QUICKSAVE_KEY]: legacy });
  assert.equal(migrateLegacyQuicksave(s), true);
  assert.equal(s.getItem(QUICKSAVE_KEY), null, 'the legacy key is gone');
  const key = findSave('Old Hero', QUICK_SAVE_NAME, s);
  assert.ok(key !== -1);
  assert.equal(loadSlot(key, s).classicMinutes, 777);
  assert.equal(saveInfoOf(key, s).dateAndTime.realTime, 0, 'no real stamp survives the legacy key');
  // Enumeration runs it implicitly too.
  const s2 = mockStorage({ [QUICKSAVE_KEY]: legacy });
  const { characterSaves } = enumerateSaves(s2);
  assert.ok(characterSaves.has('Old Hero'));
});

test('SAV4: a quota failure leaves the legacy quicksave standing; a corrupt one is dropped', () => {
  const legacy = JSON.stringify({ v: SAVE_VERSION, name: 'Old Hero' });
  const s = mockStorage({ [QUICKSAVE_KEY]: legacy }, { failSet: (k) => k.startsWith(SAVE_DATA_PREFIX) });
  assert.equal(migrateLegacyQuicksave(s), false);
  assert.equal(s.getItem(QUICKSAVE_KEY), legacy, 'the old save is untouched');

  const s2 = mockStorage({ [QUICKSAVE_KEY]: 'not json {' });
  assert.equal(migrateLegacyQuicksave(s2), false);
  assert.equal(s2.getItem(QUICKSAVE_KEY), null, 'nothing worth keeping');
});

test('SAV4: a failed NEW save leaves no orphan; a failed overwrite keeps the old slot whole', () => {
  // Info write fails on a NEW slot: the data written before it is
  // swept so no orphan blocks the key forever.
  const s = mockStorage({}, { failSet: (k) => k.startsWith(SAVE_INFO_PREFIX) });
  const r = saveSlot('Alaric', 'First', snapOf('Alaric'), { storage: s, now: 10 });
  assert.equal(r.ok, false);
  assert.equal(s.getItem(SAVE_DATA_PREFIX + r.key), null, 'the half-written data is swept');

  // An overwrite whose data write fails keeps the previous write.
  const s2 = mockStorage();
  saveSlot('Alaric', 'First', snapOf('Alaric', 1), { storage: s2, now: 10 });
  let arm = false;
  s2.setItem = ((orig) => (k, v) => {
    if (arm && k.startsWith(SAVE_DATA_PREFIX)) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
    return orig(k, v);
  })(s2.setItem.bind(s2));
  arm = true;
  const r2 = saveSlot('Alaric', 'First', snapOf('Alaric', 2), { storage: s2, now: 20 });
  assert.equal(r2.ok, false);
  assert.equal(loadSlot(0, s2).classicMinutes, 1, 'the old save survives');
  assert.ok(saveInfoOf(0, s2), 'and still enumerates');
});

test('SAV4: the host wiring source pins - per-character quickslots, the boot arm loads most recent', () => {
  const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  // Save(name, saveName) with the QuickSave default - F9 and the slot
  // window's saveAs share the ONE producer.
  assert.match(world, /function worldQuickSave\(saveName = QUICK_SAVE_NAME\)/);
  assert.match(world, /saveSlot\(playerEntity\.name, saveName, snap\)/);
  assert.match(world, /: mostRecent \? \(mostRecentRestorable\(\)\?\.snap \?\? null\)\n\s*: quickLoadSlot\(playerEntity\.name\)/);
  // The boot arm: a picked slot key wins, else the most-recent shape.
  assert.match(world, /\? \{ key: Number\(params\.get\('loadkey'\)\) \}\n\s*: \{ mostRecent: true \}/);

  const dungeon = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  assert.match(dungeon, /quickSave\(saveName = QUICK_SAVE_NAME\)/);
  assert.match(dungeon, /saveSlot\(playerEntity\.name, saveName, snap\)/);
  assert.match(dungeon, /key != null \? loadSlot\(key\) : quickLoadSlot\(playerEntity\.name\)/);

  // The pause seam builds the slot-window doors from the hosts' seams.
  const pause = readFileSync(new URL('../src/ui/pauseWindow.js', import.meta.url), 'utf8');
  assert.match(pause, /openSave: hooks\.saveAs/);
  assert.match(pause, /openLoad: hooks\.loadKey/);
  assert.match(pause, /if \(this\.hooks\.openLoad\) this\.hooks\.openLoad\(\);\n\s*else this\.hooks\.quickLoad\?\.\(\);/);

  const menu = readFileSync(new URL('../src/scenes/menu.js', import.meta.url), 'utf8');
  assert.match(menu, /export const hasSavedGame = \(\) => !!mostRecentRestorable\(\);/);

  const enhanced = readFileSync(new URL('../src/ui/enhancedMenu.js', import.meta.url), 'utf8');
  assert.match(enhanced, /deleteSave\(save\.key\)/, 'the enhanced delete removes the SLOT it shows');
  assert.doesNotMatch(enhanced, /removeItem\(QUICKSAVE_KEY\)/);
});

test('SAV4: a realTime TIE keeps the first-enumerated key (FindMostRecentSave is strictly >)', () => {
  const s = mockStorage();
  saveSlot('Alaric', 'A', snapOf('Alaric'), { storage: s, now: 100 });
  saveSlot('Alaric', 'B', snapOf('Alaric'), { storage: s, now: 100 });
  assert.equal(findMostRecentSave(s), 0, 'the tie is not stolen by the later key');
});

test('SAV4: migration trusts NOTHING - a silently dropped write keeps the legacy key', () => {
  // Some browsers fail localStorage writes without throwing (private
  // windows); the verify readback is the only guard that catches it.
  const legacy = JSON.stringify({ v: SAVE_VERSION, name: 'Old Hero' });
  const s = mockStorage({ [QUICKSAVE_KEY]: legacy });
  const origSet = s.setItem.bind(s);
  s.setItem = (k, v) => { if (!k.startsWith(SAVE_DATA_PREFIX)) origSet(k, v); };   // the data write silently vanishes
  assert.equal(migrateLegacyQuicksave(s), false);
  assert.equal(s.getItem(QUICKSAVE_KEY), legacy, 'the legacy save survives the lie');
});

// ═══════════════════ SAV4: the save/load window behaviors ═══════════════════

import {
  SaveWindow, MAIN_PANEL, SW_RECTS, SW_COLORS, SW_LIST_ROWS,
  NAME_MAX_CHARS, RENAME_MAX_CHARS,
} from '../src/ui/saveWindow.js';
import { MB_BUTTONS } from '../src/ui/messageBox.js';

// The window reads the module store; give it a real localStorage.
function withStorage(entries, fn) {
  const prev = globalThis.localStorage;
  globalThis.localStorage = mockStorage(entries);
  try { return fn(globalThis.localStorage); }
  finally {
    if (prev === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prev;
  }
}

function seedSaves(s) {
  saveSlot('Alaric', 'Old', snapOf('Alaric', 10), { storage: s, now: 100 });
  saveSlot('Alaric', 'New', snapOf('Alaric', 20), { storage: s, now: 300 });
  saveSlot('Brisa', 'Hers', snapOf('Brisa', 30), { storage: s, now: 200 });
}

const nat = ([x, y]) => [MAIN_PANEL[0] + x + 1, MAIN_PANEL[1] + y + 1];

test('SAV4 window: the DFU geometry pinned WHOLE', () => {
  assert.deepEqual([...MAIN_PANEL], [20, 15, 280, 170], '280x170 centered in 320x200');
  assert.deepEqual([...SW_RECTS.namePanel], [4, 12, 272, 9]);
  assert.deepEqual([...SW_RECTS.savesPanel], [4, 25, 100, 141]);
  assert.deepEqual([...SW_RECTS.savesList], [6, 27, 91, 129]);
  assert.deepEqual([...SW_RECTS.scroller], [98, 27, 5, 129]);
  assert.deepEqual([...SW_RECTS.go], [108, 150, 40, 16]);
  assert.deepEqual([...SW_RECTS.switchClassic], [172, 150, 40, 16]);
  assert.deepEqual([...SW_RECTS.cancel], [236, 150, 40, 16]);
  assert.deepEqual([...SW_RECTS.screenshot], [108, 25, 168, 95]);
  assert.deepEqual([...SW_RECTS.infoPanel], [108, 122, 168, 26]);
  assert.deepEqual([...SW_RECTS.rename], [6, 157, 48, 8]);
  assert.deepEqual([...SW_RECTS.del], [55, 157, 48, 8]);
  assert.deepEqual([...SW_RECTS.switchChar], [216, 2, 60, 8]);
  assert.equal(SW_LIST_ROWS, 16);
  assert.equal(NAME_MAX_CHARS, 26);
  assert.equal(RENAME_MAX_CHARS, 31);
  assert.deepEqual([...SW_COLORS.save], [0, 0.5, 0, 0.4]);
  assert.deepEqual([...SW_COLORS.cancel], [0.7, 0, 0, 0.4]);
  assert.deepEqual([...SW_COLORS.listText], [0.8, 0.8, 0.8, 1]);
});

test('SAV4 window: load mode - descending order, top autoselect, displayMostRecentChar', () => {
  withStorage({}, (s) => {
    seedSaves(s);
    const win = new SaveWindow('load', { playerName: () => 'Alaric' });
    assert.deepEqual(win.rows.map((r) => r.saveName), ['New', 'Old'], 'realTime descending');
    assert.equal(win.selectedIndex, 0, 'the top save autoselects');
    assert.equal(win.nameText, 'New');

    // displayMostRecentChar re-keys to the most recent save's OWNER.
    const win2 = new SaveWindow('load', { playerName: () => 'Brisa' }, { displayMostRecentChar: true });
    assert.equal(win2.currentPlayerName, 'Alaric', 'the most recent save is Alaric-New');
  });
});

test('SAV4 window: load go hands the RIGHT KEY through the (char,name) identity', () => {
  withStorage({}, () => {
    let loaded = null;
    const win = new SaveWindow('load', { playerName: () => 'Alaric', loadKey: (k) => { loaded = k; } });
    seedSaves(globalThis.localStorage);
    win.refresh(); win._select(1);          // 'Old' = slot key 0
    win.input('Enter');
    assert.equal(loaded, 0);
    assert.equal(win.done, true, 'PopToHUD before the restore');
  });
});

test('SAV4 window: save mode - empty-name note, typed match selects, overwrite confirms', () => {
  withStorage({}, (s) => {
    seedSaves(s);
    let savedAs = null;
    const win = new SaveWindow('save', { playerName: () => 'Alaric', saveAs: (n) => { savedAs = n; return true; } });
    assert.equal(win.selectedIndex, -1, 'save mode does not autoselect');

    // Empty name -> "You must enter a save name." - and NO save.
    win.input('Enter');
    assert.equal(win.top, 'note');
    assert.equal(savedAs, null, 'an empty name never reaches saveAs');
    assert.equal(win.done, false);
    win.input('Escape');

    // Typing a name that matches a row SELECTS it (:539-545)...
    for (const ch of 'New') win.input('char:' + ch);
    assert.equal(win.selectedIndex, 0);
    // ...and one more character deselects (:546-550).
    win.input('char:!');
    assert.equal(win.selectedIndex, -1);
    assert.equal(win.nameText, 'New!');

    // A fresh name saves straight through.
    win.input('Enter');
    assert.equal(savedAs, 'New!');
    assert.equal(win.done, true);

    // An EXISTING (char,name) asks first; Yes overwrites.
    savedAs = null;
    const win2 = new SaveWindow('save', { playerName: () => 'Alaric', saveAs: (n) => { savedAs = n; return true; } });
    for (const ch of 'Old') win2.input('char:' + ch);
    win2.input('Enter');
    assert.equal(win2.top, 'overwrite');
    win2._boxHit = () => MB_BUTTONS.Yes;
    win2.click(0, 0);
    assert.equal(savedAs, 'Old');

    // No pops the confirm and stays.
    const win3 = new SaveWindow('save', { playerName: () => 'Alaric', saveAs: () => true });
    for (const ch of 'Old') win3.input('char:' + ch);
    win3.input('Enter');
    win3._boxHit = () => MB_BUTTONS.No;
    win3.click(0, 0);
    assert.equal(win3.top, null);
    assert.equal(win3.done, false);
  });
});

test('SAV4 window: delete confirms and refreshes; rename prefills and writes only a change', () => {
  withStorage({}, (s) => {
    seedSaves(s);
    const win = new SaveWindow('load', { playerName: () => 'Alaric' });
    // Delete needs a selection; the top row ('New', key 1) is selected.
    win.click(...nat([SW_RECTS.del[0], SW_RECTS.del[1]]));
    assert.equal(win.top, 'delete');
    win._boxHit = () => MB_BUTTONS.Delete;
    win.click(0, 0);
    assert.equal(findSave('Alaric', 'New', s), -1, 'the slot is gone');
    assert.deepEqual(win.rows.map((r) => r.saveName), ['Old'], 'the list refreshed');
    assert.equal(win.nameText, '', 'the box cleared');

    // Rename: select Old, open, prefill, type, commit.
    win._select(0);
    win.click(...nat([SW_RECTS.rename[0], SW_RECTS.rename[1]]));
    assert.equal(win.top, 'rename');
    assert.equal(win.renameText, 'Old', 'TextBox.Text prefills');
    win.input('Backspace'); win.input('Backspace'); win.input('Backspace');
    for (const ch of 'Better') win.input('char:' + ch);
    win.input('Enter');
    assert.equal(win.top, null);
    assert.equal(findSave('Alaric', 'Better', s) !== -1, true);
    assert.equal(win.nameText, 'Better');
  });
});

test('SAV4 window: switch character lists names ALPHABETICALLY and re-keys', () => {
  withStorage({}, (s) => {
    // Zed seeds FIRST (key 0) so enumeration order is Zed, Alaric,
    // Brisa - the sort has to earn the alphabetical order.
    saveSlot('Zed', 'His', snapOf('Zed'), { storage: s, now: 50 });
    seedSaves(s);
    const win = new SaveWindow('load', { playerName: () => 'Alaric' });
    win.click(...nat([SW_RECTS.switchChar[0], SW_RECTS.switchChar[1]]));
    assert.equal(win.top, 'charPicker');
    assert.deepEqual(win._charRows, ['Alaric', 'Brisa', 'Zed'], 'OrderBy(o => o)');
    // Pick row 1 (Brisa) - rows draw from y=40 at 10px pitch, x 90-230.
    win.click(100, 51);
    assert.equal(win.currentPlayerName, 'Brisa');
    assert.deepEqual(win.rows.map((r) => r.saveName), ['Hers']);
    assert.equal(win.nameText, '', 'the box clears on a character switch');
  });
});

test('SAV4 window: the classic switch is a LOAD-mode door; Escape cancels through onBack', () => {
  withStorage({}, (s) => {
    seedSaves(s);
    let classic = 0, back = 0;
    const win = new SaveWindow('load', { playerName: () => 'Alaric', onSwitchClassic: () => classic++, onBack: () => back++ });
    win.click(...nat([SW_RECTS.switchClassic[0], SW_RECTS.switchClassic[1]]));
    assert.equal(classic, 1, 'reachable WITH saves present - the SAV3 residue closes');
    assert.equal(win.done, true);

    const save = new SaveWindow('save', { playerName: () => 'Alaric', onSwitchClassic: () => classic++ });
    save.click(...nat([SW_RECTS.switchClassic[0], SW_RECTS.switchClassic[1]]));
    assert.equal(classic, 1, 'save mode disables the classic door (:437)');

    const win2 = new SaveWindow('load', { playerName: () => 'Alaric', onBack: () => back++ });
    win2.input('Escape');
    assert.equal(back, 1);
    assert.equal(win2.done, true);
  });
});

test('SAV4 window: LoadGame with no saves at all prompts for a classic save', () => {
  withStorage({}, () => {
    const win = new SaveWindow('load', { playerName: () => 'Nobody' });
    assert.equal(win.noSaves, true, 'the :328-332 arm');
    assert.equal(win.rows.length, 0);
  });
});
