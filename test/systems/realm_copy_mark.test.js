// REALM-COPY (2026-10-25, from the field reports: "Online -> Offline -> Online: Fails quietly (nothing happens)"):
// a copy of a realm character made by Copy to offline is marked, the mark rides every save of it, and the Online pane's
// Bring online button on its tile is dead and says why (systems/realmCopyMark.js, ui/enhanced/bringOnlineButton.js).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { offlineCopyOf, onlineCopyOf } from '../../src/systems/offlineCopy.js';
import { REALM_COPY_SAVE_NAME, markRealmCopy, realmCopyIds } from '../../src/systems/realmCopyMark.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import { saveSlot, loadSlot } from '../../src/systems/save/saveSlots.js';
import { bringOnlineButton } from '../../src/ui/enhanced/bringOnlineButton.js';

const REALM_ID = 'r' + 'a'.repeat(20);
const COPY_ID = 'c0ffee00-1111-2222-3333-444455556666';

function memoryStorage() {
  const items = new Map();
  return {
    get length() { return items.size; },
    key: (index) => [...items.keys()][index] ?? null,
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => { items.set(key, String(value)); },
    removeItem: (key) => { items.delete(key); },
  };
}

const makeEntity = (over = {}) => ({
  name: 'Nystul', level: 3, health: 20, maxHealth: 30, fatigue: 100, magicka: 10, maxMagicka: 40,
  stats: { strength: 50 }, skills: new Array(35).fill(20), items: [], spells: [],
  ...over,
});

test('REALM-COPY: the copy that leaves the realm is marked, and the realm save it came from is not', () => {
  const realmSave = { v: 1, name: 'Nystul', characterId: REALM_ID, classicMinutes: 1_000_000, worldMinutes: 2_000_000 };
  const copy = offlineCopyOf(realmSave);
  assert.equal(copy.realmCopy, true);
  assert.equal('realmCopy' in realmSave, false, 'the realm save is untouched');
  assert.equal(offlineCopyOf({ v: 1, name: 'Old' }).realmCopy, true, 'a save with no world clock is marked too');
  assert.equal('realmCopy' in onlineCopyOf({ v: 1, name: 'Nystul', classicMinutes: 1_000 }, 2_000_000), false, 'customs\' door marks nothing');
});

test('REALM-COPY: the mark rides the copy\'s own slot and every later save of the character', () => {
  const storage = memoryStorage();
  const realmSave = JSON.parse(JSON.stringify(snapshotPlayer(makeEntity({ characterId: REALM_ID }))));
  const copy = offlineCopyOf(realmSave);
  copy.characterId = COPY_ID;
  const written = saveSlot(copy.name, REALM_COPY_SAVE_NAME, copy, { storage });
  assert.equal(written.ok, true);
  assert.equal(loadSlot(written.key, storage).realmCopy, true, 'the slot Copy to offline writes');

  const played = makeEntity();
  restorePlayer(played, loadSlot(written.key, storage), null);
  assert.equal(played.realmCopy, true, 'loading the copy restores the mark');
  const later = JSON.parse(JSON.stringify(snapshotPlayer(played)));
  assert.equal(later.realmCopy, true, 'a later save of the copy keeps it');

  const plain = JSON.parse(JSON.stringify(snapshotPlayer(makeEntity())));
  assert.equal('realmCopy' in plain, false, 'a character that is no copy writes nothing');
  const loadedOver = makeEntity();
  markRealmCopy(loadedOver);
  restorePlayer(loadedOver, plain, null);
  assert.equal(loadedOver.realmCopy, undefined, 'loading another character over a copy leaves no mark behind');
});

test('REALM-COPY: the copies among the slot cards - by the mark, or by the slot Copy to offline wrote before the mark', () => {
  const ids = realmCopyIds([
    { characterId: 'marked', saveName: 'QuickSave', realmCopy: true },
    { characterId: 'older-copy', saveName: REALM_COPY_SAVE_NAME, realmCopy: false },
    { characterId: 'older-copy', saveName: 'QuickSave', realmCopy: false },
    { characterId: 'offline', saveName: 'QuickSave', realmCopy: false },
    { characterId: null, saveName: REALM_COPY_SAVE_NAME, realmCopy: false },
  ]);
  assert.deepEqual([...ids].sort(), ['marked', 'older-copy']);
});

test('REALM-COPY: a copy\'s Bring online button is dead and says why; a Test Room character keeps its own words', () => {
  assert.deepEqual(bringOnlineButton({ testRoom: false }, { realmCopy: true }), { label: 'Copied from online: offline only', offlineOnly: true });
  assert.deepEqual(bringOnlineButton({ testRoom: false }, { realmCopy: false }), { label: 'Bring online', offlineOnly: false });
  assert.deepEqual(bringOnlineButton({ testRoom: true }, { realmCopy: true }), { label: 'Test Room: offline only', offlineOnly: true });
});
