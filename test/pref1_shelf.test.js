// PREF1 (2026-09-15) - THE SHELF CARRIES CHOICES, NOT A SNAPSHOT OF THE
// DEFAULTS. Found auditing LR5, before it merged.
//
// THE DEFECT. `savePrefs` wrote `_prefs` whole, and `_prefs` is
// `{ ...PREF_DEFAULTS, ...stored }` - so the FIRST `setPref` of ANY key
// materialised EVERY default into storage. From that moment a stored
// value was indistinguishable from a deliberate answer, and a default
// the port later changed could never reach a player who had once
// touched any setting at all. It is a latent defect that only shows
// when a default moves, and LR5 is where it would have shown: the loot
// ladder's default went true, and every existing player - Mac's own
// shelf included - would have gone on reading the `lootRarity: false`
// their shelf wrote FOR them, seen no ladder, and reported the switch
// as broken.
//
// THE FIX, in two halves:
//   ROOT CAUSE - a key whose value equals the default is not written.
//   Reading is untouched (`_prefs[k] ?? PREF_DEFAULTS[k]`, and `??`
//   falls through on null/undefined alone, so a stored `false` still
//   beats a `true` default), so no behaviour moves today; what changes
//   is that every FUTURE default change lands.
//   THE SHELVES ALREADY WRITTEN - they carry their own day's defaults
//   with nothing saying which were answers, because that was destroyed
//   at save time. An UNSTAMPED shelf adopts the new default once, for
//   the named keys alone, and the save stamps it so it never runs
//   again. The one named key is `lootRarity`, and the reasoning is
//   bounded rather than hopeful: the row shipped OFF on 2026-09-14 and
//   LR5 turned it ON one day later, so a stored `false` was the
//   shelf's and not a player's.
//
// The law that matters after all of it: a player who presses the
// ladder off KEEPS it off, for ever, across any number of reloads.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const KEY = 'dagger.ui.v1';
let store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const P = await import('../src/systems/uiPrefs.js');
const shelf = () => JSON.parse(store.get(KEY) ?? '{}');
const fresh = () => { store = new Map(); P._resetForTests(); };
const withShelf = (blob) => { store = new Map([[KEY, JSON.stringify(blob)]]); P._resetForTests(); P.loadPrefs(); };
const reload = () => { P._resetForTests(); P.loadPrefs(); };

test('PREF1: a value equal to the default is NOT written - the shelf holds overrides and its own map', () => {
  fresh();
  P.setPref('showFps', P.PREF_DEFAULTS.showFps);   // "changing" a pref to what it already is
  assert.deepEqual(Object.keys(shelf()).filter((k) => k !== 'open' && k !== '_rev'), [],
    'a default written back is not an override');
  fresh();
  P.setPref('enhancedWater', !P.PREF_DEFAULTS.enhancedWater);
  assert.deepEqual(shelf().enhancedWater, !P.PREF_DEFAULTS.enhancedWater, 'a real override IS written');
  // and the whole shelf is never materialised again
  assert.ok(Object.keys(shelf()).length < 5, `the shelf stays small: ${JSON.stringify(shelf())}`);
  assert.equal(shelf().lootRarity, undefined, 'no default rides along');
  // the pure half
  assert.deepEqual(P.overridesOf({ ...P.PREF_DEFAULTS, skin: 'classic', open: { 'a:b': true } }),
    { skin: 'classic', open: { 'a:b': true }, _rev: 2 });   // HB-LYCFREE: rev 2 (PIN MOVED - the hotbar default's shelf, test/hb_lycfree.test.js)
});

test('PREF1: reading is unchanged - an override beats the default, and a stored false beats a true default', () => {
  fresh();
  assert.equal(P.getPref('lootRarity'), true, 'the default, with nothing stored');
  P.setPref('lootRarity', false);
  assert.equal(P.getPref('lootRarity'), false, 'a stored false beats a true default (?? is not ||)');
  reload();
  assert.equal(P.getPref('lootRarity'), false, 'and it survives the round trip through storage');
});

test('PREF1: a player who presses the ladder OFF keeps it off, across any number of reloads', () => {
  fresh();
  P.setPref('lootRarity', false);
  for (let i = 0; i < 5; i++) {
    reload();
    assert.equal(P.getPref('lootRarity'), false, `still off after reload ${i + 1}`);
  }
  assert.equal(shelf().lootRarity, false, 'because it is a genuine override now, and is written as one');
});

test('PREF1: an UNSTAMPED shelf adopts the new default once - and never again', () => {
  // the shape every existing player has: the old default, materialised by some unrelated save
  // PIN MOVED (BAL4, bible/05-Combat/Balance-Arc.md section 6): the Enhanced AI joined the list (it shipped Off the day
  // before this stamp, and turned On); the control is a key the port did NOT change its mind about
  withShelf({ skin: 'enhanced', showFps: true, lootRarity: false, enhancedAI: false, worldDungeonSizes: true });
  assert.equal(P.getPref('lootRarity'), true, 'LR5 reaches a player who never chose anything');
  assert.equal(P.getPref('enhancedAI'), true, 'BAL4 does too');
  assert.equal(P.getPref('worldDungeonSizes'), true, 'and a key the port did NOT change its mind about is left alone');

  P.setPref('showFps', false);                       // any save stamps the shelf
  assert.equal(shelf()._rev, 2, 'the shelf is stamped');   // HB-LYCFREE: rev 2 (PIN MOVED)
  P.setPref('lootRarity', false);                    // NOW the player really chooses
  reload();
  assert.equal(P.getPref('lootRarity'), false, 'the adoption does not run a second time over a real choice');
});

test('PREF1: a shelf that predates the key entirely, and one already stamped, are both left to the defaults', () => {
  withShelf({ skin: 'enhanced', textScale: 1 });
  assert.equal(P.getPref('lootRarity'), true, 'no stored answer: the default');
  withShelf({ lootRarity: false, _rev: 1 });
  assert.equal(P.getPref('lootRarity'), false, 'a STAMPED shelf is trusted whole - its false is a choice');
});

test('PREF1: the open map and resetPrefs still work over the narrower shelf', () => {
  fresh();
  P.setOpen('video', 'stored', true);
  assert.equal(P.isOpen('video', 'stored'), true);
  reload();
  assert.equal(P.isOpen('video', 'stored'), true, 'the map is always written, defaults or not');
  P.setPref('skin', 'classic');
  P.resetPrefs();
  assert.equal(P.getPref('skin'), P.PREF_DEFAULTS.skin, 'reset drops the override');
  assert.deepEqual(shelf().skin, undefined, 'and does not write the default back as one');
  assert.deepEqual(P.isOpen('video', 'stored'), false, 'reset clears the map too');
});

test('GRASS-ON (Mac: "Can you please turn grass on by default"): THE GRASS IS FULL BY DEFAULT AGAIN - nothing stored is Full, and AUDIT MEADOW1\'s adoption went with its Off: no shelf\'s value moves - an unstamped Full is the default again, and an Off, a Half or a Quarter anywhere was pressed while Full was the default, and stands, an Off written back as the choice it is (mutant: the grass off by default)', () => {
  assert.equal(P.PREF_DEFAULTS.grassDensity, 1, 'Full by default');
  withShelf({ skin: 'enhanced' });
  assert.equal(P.getPref('grassDensity'), 1, 'nothing stored: Full');
  for (const rev of [undefined, 1, 2]) {
    for (const v of [1, 0.5, 0.25, 0]) {
      withShelf(rev === undefined ? { grassDensity: v } : { grassDensity: v, _rev: rev });
      assert.equal(P.getPref('grassDensity'), v, `${rev === undefined ? 'an unstamped' : `a rev ${rev}`} shelf's ${v} stands`);
    }
  }
  withShelf({ grassDensity: 0, _rev: 2 });
  P.setPref('showFps', true);
  reload();
  assert.equal(P.getPref('grassDensity'), 0, '...an Off is written back as the choice it is');
  assert.equal(shelf().grassDensity, 0);
  P.setPref('grassDensity', 1);
  assert.equal(shelf().grassDensity, undefined, 'and a press back to Full is the default, which the shelf does not write');
});
