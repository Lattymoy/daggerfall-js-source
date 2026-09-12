// SLOTS1 (Mac, 2026-09-12: "multiple save slots and then the ability
// to choose which save to use in online"). THE LIST EXECUTES: every
// restorable slot most recent first, the stale-version one skipped,
// the most-recent question riding the same walk; the front door's
// pick seams hand a key and a name over ONCE; the doors that act on
// them are pinned by source - main.js's enhanced branch (the key ->
// ?loadkey under the set-or-delete law), the pause door (the name ->
// the host's saveAs, the key -> its loadKey, behind the two verbs the
// MAC1 pin reads), and the three panes (Load and Online a card per
// slot, Save a slot name that overwrites or opens a new slot).
// Mutants: the list unsorted, the stale save listed, a pick taken
// twice, the key set on Continue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { restorableSaves, mostRecentRestorable, saveSlot, SAVE_INFO_PREFIX } from '../src/systems/saveSlots.js';
import { SAVE_VERSION } from '../src/systems/save.js';
import { takePickedSaveKey, takePickedSaveName } from '../src/ui/enhancedMenu.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

function mockStorage() {
  const m = new Map();
  return {
    get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); },
  };
}

test('SLOTS1: restorableSaves lists every slot this build can restore, most recent first, with its info and snap; the stale-version slot is skipped; mostRecentRestorable is its head (mutants: unsorted, the stale save listed)', () => {
  const s = mockStorage();
  saveSlot('Alaric', 'QuickSave', { v: SAVE_VERSION, name: 'Alaric', classicMinutes: 10 }, { storage: s, now: 100 });
  saveSlot('Alaric', 'Before the crypt', { v: SAVE_VERSION, name: 'Alaric', classicMinutes: 20 }, { storage: s, now: 300 });
  saveSlot('Beth', 'QuickSave', { v: SAVE_VERSION, name: 'Beth', classicMinutes: 5 }, { storage: s, now: 200 });
  saveSlot('Old', 'QuickSave', { v: SAVE_VERSION - 1, name: 'Old', classicMinutes: 1 }, { storage: s, now: 999 });
  const list = restorableSaves(s);
  assert.deepEqual(list.map((e) => [e.info.characterName, e.info.saveName, e.info.dateAndTime.realTime]),
    [['Alaric', 'Before the crypt', 300], ['Beth', 'QuickSave', 200], ['Alaric', 'QuickSave', 100]], 'most recent first, the stale-version slot (newest of all) left out');
  assert.equal(list[0].snap.classicMinutes, 20); assert.equal(typeof list[0].key, 'number');
  assert.deepEqual(mostRecentRestorable(s), { key: list[0].key, snap: list[0].snap }, 'the most-recent question is the list\'s head');
  s.removeItem(SAVE_INFO_PREFIX + list[0].key);
  assert.equal(restorableSaves(s).length, 2, 'a slot without its info is no slot (the SaveInfo-must-exist law)');
  assert.deepEqual(restorableSaves(mockStorage()), []);
});

test('SLOTS1: the pick seams hand a key and a name over once (mutant: a pick taken twice boots the next Continue into the wrong save)', () => {
  assert.equal(takePickedSaveKey(), null); assert.equal(takePickedSaveName(), null);
  const menu = rd('src/ui/enhancedMenu.js');
  assert.match(menu, /export function takePickedSaveKey\(\) \{ const k = _pickedSaveKey; _pickedSaveKey = null; return k; \}/);
  assert.match(menu, /export function takePickedSaveName\(\) \{ const n = _pickedSaveName; _pickedSaveName = null; return n; \}/);
  // the panes set them beside the verb the census pins
  const online = menu.slice(menu.indexOf('function paneOnline(body)'), menu.indexOf('function paneLoad(body)'));
  assert.match(online, /const saves = savedGames\(\);/); assert.match(online, /for \(const save of saves\) \{[\s\S]*?_pickedSaveKey = save\.key; onAction\('online'\);/, 'a card per slot, the pressed one is the character brought in');
  assert.doesNotMatch(online, /disabled: !save/, 'no single most-recent button any more');
  const load = menu.slice(menu.indexOf('function paneLoad(body)'), menu.indexOf('// ── SAVE GAME'));
  assert.match(load, /_pickedSaveKey = save\.key; onAction\('load'\);/); assert.match(load, /deletable: true/, 'the Load cards delete');
  const card = menu.slice(menu.indexOf('function slotCard('), menu.indexOf('function savedGame()'));
  assert.match(card, /label: 'Delete', onClick: \(\) => ask\([\s\S]{0,300}deleteSave\(save\.key\)/, 'delete asks first and removes the slot it shows');
  assert.doesNotMatch(load, /More saves/, 'the note that the list rode the classic window is gone with the reason for it');
  const save = menu.slice(menu.indexOf('function paneSave(body)'), menu.indexOf('// ── EXIT (pause only)'));
  assert.match(save, /const mine = savedGames\(\)\.filter\(\(s\) => s\.characterName === me\);/, 'the character\'s own slots');
  assert.match(save, /_pickedSaveName = input\.value\.trim\(\) \|\| QUICK_SAVE_NAME; onAction\('save'\);/, 'the typed name rides the save verb');
  assert.match(save, /_pickedSaveName = save\.saveName; onAction\('save'\);/, 'a slot card overwrites that slot');
  assert.match(save, /sensitivity: 'accent'/, 'the overwrite match is the classic window\'s own (localeCompare, accent-insensitive)');
  assert.doesNotMatch(save, /One slot/, 'the one-slot note is gone with the one slot');
  // one list producer for the cards and the most-recent card
  assert.match(menu, /function savedGames\(\) \{\s*\n\s*try \{ return restorableSaves\(\)\.map\(saveOf\); \}/);
  assert.match(menu, /function slotCard\(save, \{ primaryLabel, onPrimary, disabled = false, deletable = false \}\)/);
});

test('SLOTS1: the doors act on the pick - main.js sets ?loadkey for load and online alone (set-or-delete), the pause door routes the name to saveAs and the key to loadKey behind the verbs the MAC1 pin reads, and the world host\'s load arm reads the key (mutant: the key set on Continue)', () => {
  const main = rd('src/main.js');
  const branch = main.slice(main.indexOf("if (choice !== 'begin') {"), main.indexOf('// FD1: BEGIN'));
  assert.match(branch, /const \{ takePickedSaveKey \} = await import\('\.\/ui\/enhancedMenu\.js'\);\s*\n\s*const picked = takePickedSaveKey\(\);\s*\n\s*if \(\(choice === 'load' \|\| choice === 'online'\) && picked != null\) params\.set\('loadkey', String\(picked\)\);\s*\n\s*else params\.delete\('loadkey'\);/);
  assert.ok(branch.indexOf("params.set('loadkey'") < branch.indexOf('return bootWorld('), 'before the boot');
  const door = rd('src/ui/pauseDoor.js');
  assert.match(door, /function enhancedPauseOverlay\(show, base\) \{/);
  assert.match(door, /quickSave: \(\) => \{ const n = seams\?\.takePickedSaveName\?\.\(\) \?\? null; return n && typeof base\.saveAs === 'function' \? base\.saveAs\(n\) : base\.quickSave\?\.\(\); \}/);
  assert.match(door, /quickLoad: \(\) => \{ const k = seams\?\.takePickedSaveKey\?\.\(\) \?\? null; return k != null && typeof base\.loadKey === 'function' \? base\.loadKey\(k\) : base\.quickLoad\?\.\(\); \}/);
  assert.match(door, /if \(action === 'save'\) hooks\.quickSave\?\.\(\);\s*\n\s*else if \(action === 'load'\) hooks\.quickLoad\?\.\(\);/, 'the verbs the MAC1 pin reads, untouched');
  assert.match(door, /seams = mod;/, 'the seams come from the module the pane came from');
  const world = rd('src/scenes/world.js');
  assert.match(world, /saveAs: \(saveName\) => worldQuickSave\(saveName\),\s*\n\s*loadKey: \(key\) => worldQuickLoad\(\{ key \}\),/, 'the world host\'s slot seams (SAV4)');
  assert.match(world, /\? \{ key: Number\(params\.get\('loadkey'\)\) \}\n\s*: \{ mostRecent: true \}/, 'the boot arm reads the picked key');
});
