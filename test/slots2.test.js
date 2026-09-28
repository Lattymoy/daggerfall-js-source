// SLOTS2 (Mac, 2026-09-26: "Go ahead and do the follow up" - the MW-EARLY
// audit's note that picking the most recent save parsed every slot).
// THE MOST-RECENT PICK STOPS AT THE FIRST SAVE IT CAN RESTORE.
// mostRecentRestorable was restorableSaves' head: every slot's envelope
// read and parsed - a whole world state each, a size that meets the
// storage quota - to keep one, at the boot's ?load door, the start
// menu's hasSavedGame and the Continue card. Pins: over a store that
// counts envelope reads, the newest restorable save costs ONE read, a
// stale newest one costs two (the walk still falls through it), and no
// restorable save reads every slot and answers null; the pick is still
// the list's head over every kind of slot the list skips (a stale
// version, an envelope that will not parse, a card with no envelope,
// equal stamps); the list itself still reads every envelope (its cards
// draw each); and the recency order has one home.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { saveSlot, mostRecentRestorable, restorableSaves, firstRestorable, SAVE_DATA_PREFIX } from '../src/systems/saveSlots.js';
import { newestPortraitSave } from '../src/ui/enhancedMenu.js';
import { portraitSave } from '../src/ui/profileBadge.js';
import { SAVE_VERSION } from '../src/systems/save.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/** A Storage double that counts the ENVELOPE reads - the data keys, the parse this slice is about. */
function countingStorage() {
  const m = new Map();
  const s = {
    reads: 0,
    get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => { if (k.startsWith(SAVE_DATA_PREFIX)) s.reads++; return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); },
  };
  return s;
}
const snap = (name, minutes, v = SAVE_VERSION) => ({ v, name, classicMinutes: minutes });

test('SLOTS2: the most-recent pick reads ONE envelope when the newest save restores, two when the newest is stale, and every one only when none restores (mutant: the list\'s head again)', () => {
  const s = countingStorage();
  for (let i = 0; i < 6; i++) saveSlot(`Hero${i}`, 'QuickSave', snap(`Hero${i}`, i), { storage: s, now: 100 + i });
  s.reads = 0;
  const found = mostRecentRestorable(s);
  assert.equal(found.snap.name, 'Hero5', 'the newest');
  assert.equal(s.reads, 1, 'one envelope read for six slots');
  // the newest refused by the version gate: the walk falls through it to the next, and stops there
  saveSlot('Stale', 'QuickSave', snap('Stale', 99, SAVE_VERSION - 1), { storage: s, now: 999 });
  s.reads = 0;
  assert.equal(mostRecentRestorable(s).snap.name, 'Hero5');
  assert.equal(s.reads, 2, 'the stale newest, then the good one - no further');
  // nothing restorable: every slot tried, null
  const none = countingStorage();
  for (let i = 0; i < 3; i++) saveSlot(`Old${i}`, 'QuickSave', snap(`Old${i}`, i, SAVE_VERSION - 1), { storage: none, now: 10 + i });
  none.reads = 0;
  assert.equal(mostRecentRestorable(none), null);
  assert.equal(none.reads, 3);
  assert.equal(mostRecentRestorable(countingStorage()), null, 'an empty store');
});

test('SLOTS2: the pick is still the list\'s head - over a stale version, an envelope that will not parse, a card with no envelope and equal stamps - and the list still reads every envelope its cards draw (mutant: a second recency order, or the first slot taken whether it restores or not)', () => {
  const s = countingStorage();
  saveSlot('A', 'One', snap('A', 1), { storage: s, now: 300 });
  saveSlot('B', 'Two', snap('B', 2), { storage: s, now: 300 });   // the same stamp as A's: the store's own order breaks the tie, in both
  saveSlot('C', 'Three', snap('C', 3), { storage: s, now: 100 });
  const stale = saveSlot('D', 'Stale', snap('D', 4, SAVE_VERSION + 1), { storage: s, now: 900 });
  const torn = saveSlot('E', 'Torn', snap('E', 5), { storage: s, now: 800 });
  s.setItem(SAVE_DATA_PREFIX + torn.key, '{"v": 1, "name": "E"');   // an envelope that will not parse
  const bare = saveSlot('F', 'Bare', snap('F', 6), { storage: s, now: 700 });
  s.removeItem(SAVE_DATA_PREFIX + bare.key);   // a card whose envelope is gone
  assert.ok(stale.ok && torn.ok && bare.ok);
  const list = restorableSaves(s);
  assert.deepEqual(list.map((e) => e.info.characterName), ['A', 'B', 'C'], 'the list skips all three and keeps the tie in the store\'s order');
  assert.deepEqual(mostRecentRestorable(s), { key: list[0].key, snap: list[0].snap }, 'the card is the list\'s head');
  // swap the tie's store order: both readers follow it
  const t = countingStorage();
  saveSlot('B', 'Two', snap('B', 2), { storage: t, now: 300 });
  saveSlot('A', 'One', snap('A', 1), { storage: t, now: 300 });
  assert.equal(mostRecentRestorable(t).snap.name, restorableSaves(t)[0].snap.name);
  assert.equal(mostRecentRestorable(t).snap.name, 'B');
  // the list is unchanged: every restorable envelope read, for its cards
  s.reads = 0;
  restorableSaves(s);
  assert.equal(s.reads, 6, 'the Load and Online panes read every slot - their cards draw each');
});

test('SLOTS2: the recency order has ONE home, and both walks read it; the doors that ask for one save are the ones this saves (mutant: a copy of the sort)', () => {
  const src = rd('src/systems/saveSlots.js');
  assert.equal((src.match(/\.sort\(\(a, b\) => \(b\[1\]\.dateAndTime\?\.realTime \?\? 0\) - \(a\[1\]\.dateAndTime\?\.realTime \?\? 0\)\)/g) ?? []).length, 1, 'one recency sort');
  assert.equal((src.match(/for \(const \[key, info\] of slotsByRecency\(storage\)\) \{/g) ?? []).length, 2, 'the list and the cut-short walk read it');
  assert.match(src, /export function firstRestorable\(accept = \(\) => true, storage = store\(\)\) \{\n\s*for \(const \[key, info\] of slotsByRecency\(storage\)\) \{\n\s*const snap = restorableSlot\(key, storage\);\n\s*if \(snap && accept\(\{ key, info, snap \}\)\) return \{ key, info, snap \};\n\s*\}\n\s*return null;\n\}/, 'the walk, cut short at the first it accepts');
  assert.match(src, /export function mostRecentRestorable\(storage = store\(\)\) \{\n\s*const first = firstRestorable\(undefined, storage\);/, 'the most-recent question is that walk, accepting any');
  assert.match(rd('src/scenes/world.js'), /mostRecent \? \(mostRecentRestorable\(\)\?\.snap \?\? null\)/, 'the boot\'s ?load door');
  assert.match(rd('src/scenes/menu.js'), /export const hasSavedGame = \(\) => !!mostRecentRestorable\(\);/, 'the start menu');
  assert.match(rd('src/ui/enhancedMenu.js'), /try \{ entry = mostRecentRestorable\(\); \}/, 'the Continue card');
  assert.match(rd('src/ui/enhancedMenu.js'), /: newestPortraitSave\(\);/, 'the door\'s portrait (AUDIT S1)');
});

test('AUDIT SLOTS2 S1: the door\'s portrait reads the saves only as far as portraitSave\'s answer - the same save the whole list gave, past a newest one still in chargen and one with no race; firstRestorable hands its question every restorable slot newest first and stops at the first it takes (mutant: the whole list read on every render again)', () => {
  const s = countingStorage();
  saveSlot('Oldest', 'QuickSave', { ...snap('Oldest', 1), race: 'Nord', gender: 'male', faceIndex: 1 }, { storage: s, now: 100 });
  saveSlot('Mith', 'QuickSave', { ...snap('Mith', 2), race: 'Breton', gender: 'female', faceIndex: 3 }, { storage: s, now: 200 });
  saveSlot('NoRace', 'QuickSave', snap('NoRace', 3), { storage: s, now: 300 });
  saveSlot('Midway', 'QuickSave', { ...snap('Midway', 4), race: 'Nord', chargenDone: false }, { storage: s, now: 400 });
  saveSlot('Stale', 'QuickSave', { ...snap('Stale', 5, SAVE_VERSION - 1), race: 'Nord' }, { storage: s, now: 500 });
  s.reads = 0;
  const face = newestPortraitSave(s);
  assert.equal(face.name, 'Mith', 'the newest FINISHED save with a race - portraitSave\'s law');
  assert.equal(face.race, 'Breton'); assert.equal(face.faceIndex, 3); assert.equal(face.gender, 'female');
  assert.equal(s.reads, 4, 'stale, mid-chargen, raceless, Mith - and not the oldest');
  const whole = restorableSaves(s).map((e) => ({ key: e.key, name: e.snap.name, race: e.snap.race ?? null, chargenDone: e.snap.chargenDone !== false }));
  assert.equal(portraitSave(whole).name, face.name, 'the same save the whole list gave');
  assert.equal(newestPortraitSave(countingStorage()), null, 'no saves: the silhouette');
  // the walk itself: newest first, every restorable slot offered until one is taken, the stale one never offered
  const asked = [];
  const hit = firstRestorable((e) => { asked.push(e.snap.name); return e.snap.name === 'NoRace'; }, s);
  assert.deepEqual(asked, ['Midway', 'NoRace']);
  assert.equal(hit.snap.name, 'NoRace'); assert.equal(hit.info.characterName, 'NoRace'); assert.equal(typeof hit.key, 'number');
  assert.equal(firstRestorable(() => false, s), null, 'nothing taken: null');
  assert.equal(firstRestorable(undefined, s).snap.name, 'Midway', 'no question: the newest restorable');
});
