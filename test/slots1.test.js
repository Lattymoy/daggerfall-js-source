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
  assert.match(online, /const saves = savedGames\(\);/);
  // TILE2: a TILE per slot now, in one grid - Mac: "I want [this pane]
  // reserved for a detailed tile based design for your saves". The
  // pressed one is still the character brought in.
  assert.match(online, /body\.append\(tileGrid\(saves,[\s\S]*?_pickedSaveKey = save\.key; onAction\('online'\);/,
    'a tile per slot, the pressed one is the character brought in');
  // ACC1g MOVED THE GUARD OFF THIS BUTTON, and the reason is the whole
  // slice: NAME-F2's check was about a name the player TYPED into this
  // pane, and there is no such name any more. The account service
  // refuses a rude handle at REGISTRATION (`handleRefusal` ends in
  // `nameIsIssuable`, which is `sanitizeName(h) === h`, which carries
  // `nameAllowed`), so a name is judged once when it is chosen rather
  // than on every press of this button.
  //
  // WHAT GUARDS THE BUTTON NOW IS THE SESSION, and it is a DEAD BUTTON
  // rather than a live one that fails at the relay: the relay refuses
  // an unverified hello whatever this pane does, and the pane declines
  // to send a player into a refusal it can already see.
  const latch = online.indexOf('_pickedSaveKey = save.key;');
  assert.ok(latch > 0, 'the pick is still latched by the press');
  assert.match(online, /disabled: !who,/, 'signed out is a dead Play online button');
  assert.match(online, /const who = storedSession\(appStorage\(\)\);/,
    'and `who` is the session on this device - a storage read, no network, so the pane opens on a train');
  assert.doesNotMatch(online, /entryVerdict|onlineName/,
    'the typed name and its entry-side filter are gone from this pane entirely');
  const load = menu.slice(menu.indexOf('function paneLoad(body)'), menu.indexOf('// ── SAVE GAME'));
  assert.match(load, /_pickedSaveKey = save\.key; onAction\('load'\);/);
  // TILE2: the delete moved onto the Load pane's own tile actions with
  // the card it used to live on - it still ASKS, and it still takes the
  // slot it is drawn beside and no other.
  assert.match(load, /label: 'Delete', onClick: \(\) => ask\([\s\S]{0,400}deleteSave\(save\.key\)/, 'delete asks first and removes the slot it shows');
  assert.doesNotMatch(load, /More saves/, 'the note that the list rode the classic window is gone with the reason for it');
  const save = menu.slice(menu.indexOf('function paneSave(body)'), menu.indexOf('// ── EXIT (pause only)'));
  assert.match(save, /const mine = savedGames\(\)\.filter\(\(s\) => \(myId \? s\.characterId === myId : s\.characterName === me\)\);/, 'the character\u2019s own slots - CHARID1: by id, so a namesake\u2019s are not offered to overwrite');
  assert.match(save, /_pickedSaveName = input\.value\.trim\(\) \|\| QUICK_SAVE_NAME; onAction\('save'\);/, 'the typed name rides the save verb');
  assert.match(save, /_pickedSaveName = save\.saveName; onAction\('save'\);/, 'a slot tile overwrites that slot');
  assert.match(save, /sensitivity: 'accent'/, 'the overwrite match is the classic window\'s own (localeCompare, accent-insensitive)');
  assert.doesNotMatch(save, /One slot/, 'the one-slot note is gone with the one slot');
  // one list producer for the cards and the most-recent card
  assert.match(menu, /function savedGames\(\) \{\s*\n\s*try \{ return restorableSaves\(\)\.map\(saveOf\); \}/);
  // TILE2: ONE TILE FOR THREE PANES. `slotCard` is gone - three
  // hand-rolled copies of "career, level, date, time" is how three
  // panes come to disagree about what a save is, and the pin that held
  // its signature would have held the drift in place.
  assert.doesNotMatch(menu, /function slotCard\(/, 'the old per-pane card is gone');
  assert.match(menu, /function tileGrid\(saves, forSave\) \{/, 'and one grid builds them');
  // ...and ALL THREE panes that list slots draw them, sliced to the
  // pane rather than searched across the file, so a pane that stopped
  // reddens here.
  const paneText = (from, to) => menu.slice(menu.indexOf(from), menu.indexOf(to));
  for (const [name, from, to] of [
    ['Online', 'function paneOnline(body)', 'function paneLoad(body)'],
    ['Load', 'function paneLoad(body)', '// ── SAVE GAME'],
    ['Save', 'function paneSave(body)', '// ── EXIT (pause only)'],
  ]) assert.match(paneText(from, to), /tileGrid\(/, `the ${name} pane draws tiles`);
});

test('SLOTS1: the doors act on the pick - main.js sets ?loadkey for load and online alone (set-or-delete), the pause door routes the name to saveAs and the key to loadKey behind the verbs the MAC1 pin reads, and the world host\'s load arm reads the key (mutant: the key set on Continue)', () => {
  const main = rd('src/main.js');
  const branch = main.slice(main.indexOf("if (choice !== 'begin') {"), main.indexOf('// FD1: BEGIN'));
  assert.match(branch, /const \{ takePickedSaveKey \} = await import\('\.\/ui\/enhancedMenu\.js'\);\s*\n\s*const picked = takePickedSaveKey\(\);\s*\n\s*if \(\(choice === 'load' \|\| choice === 'online'\) && picked != null\) params\.set\('loadkey', String\(picked\)\);\s*\n\s*else params\.delete\('loadkey'\);/);
  assert.ok(branch.indexOf("params.set('loadkey'") < branch.indexOf('return bootWorld('), 'before the boot');
  const door = rd('src/ui/pauseDoor.js');
  assert.match(door, /function enhancedPauseOverlay\(show, base\) \{/);
  // F5-QUESTS re-aimed the routing into `pauseMenuHooks`, the one home both doors that mount the pause window share
  // (this one and ui/charSheetDoor.js's F5 page) - the law read where it lives, and both doors held to it.
  assert.match(door, /quickSave: \(\) => \{ const n = seamsOf\(\)\?\.takePickedSaveName\?\.\(\) \?\? null; return n && typeof base\.saveAs === 'function' \? base\.saveAs\(n\) : base\.quickSave\?\.\(\); \}/);
  assert.match(door, /quickLoad: \(\) => \{ const k = seamsOf\(\)\?\.takePickedSaveKey\?\.\(\) \?\? null; return k != null && typeof base\.loadKey === 'function' \? base\.loadKey\(k\) : base\.quickLoad\?\.\(\); \}/);
  assert.match(door, /\.\.\.pauseMenuHooks\(base, \(\) => seams\),/, 'the pause door routes through it');
  const sheet = rd('src/ui/charSheetDoor.js');
  assert.match(sheet, /\}, \(\) => seams\);/, "F5's page routes through it too, over the module ITS pane came from");
  assert.equal((sheet.match(/mount: \(mod\) => \{ seams = mod; view = mod\.mountEnhancedMenu\(host, pageOpts\(\)\); \},/g) ?? []).length, 2, "both of the F5 page's mounts keep the seams");
  assert.match(door, /if \(action === 'save'\) hooks\.quickSave\?\.\(\);\s*\n\s*else if \(action === 'load'\) hooks\.quickLoad\?\.\(\);/, 'the verbs the MAC1 pin reads, untouched');
  assert.match(door, /seams = mod;/, 'the seams come from the module the pane came from');
  const world = rd('src/scenes/world.js');
  assert.match(world, /saveAs: \(saveName\) => worldQuickSave\(saveName\),\s*\n\s*loadKey: \(key\) => worldQuickLoad\(\{ key \}\),/, 'the world host\'s slot seams (SAV4)');
  assert.match(world, /\? \{ key: Number\(params\.get\('loadkey'\)\) \}\n\s*: \{ mostRecent: true \}/, 'the boot arm reads the picked key');
});
