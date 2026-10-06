// PERF-URL2 (2026-10-06, Mac: "I wanna look into how we can continue to improve performance, including for online"):
// THE FORCED-PREF TABLE IS ASKED BEFORE THE PAGE. getPref asks systems/onlineLane.js onlineForcedPref on every read -
// hundreds a frame - and it read `location.search` (a DOM getter, before PERF-URL's memo can answer) to learn whether
// the page is online, then looked the key up in a table that forces a handful of keys (the mods' switches the features
// register). Measured in the real game (Knightstale, offline): 0.09 ms a frame of isOnlinePage under onlineForcedPref.
// Now the table first, as onlineForcedSetting has asked it since AUDIT RETRO1 G2: the same answer (two pure reads joined by &&), and
// no page read for a key no page forces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onlineForcedPref, ONLINE_FORCED_PREFS, isOnlinePage } from '../src/systems/onlineLane.js';
import { getPref, PREF_DEFAULTS } from '../src/systems/uiPrefs.js';

test('PERF-URL2: onlineForcedPref answers what it answered - every key the shelf knows and a stranger, a key the table forces and one it does not, on pages online and not (mutants: the forced value lost; the page test dropped)', () => {
  const searches = ['', '?online', '?online&skin=classic', '?x=1&online=', '?realm=a&load'];
  const old = (key, search) => (isOnlinePage(search) && Object.hasOwn(ONLINE_FORCED_PREFS, key) ? ONLINE_FORCED_PREFS[key] : undefined);   // the order before
  const keys = [...Object.keys(PREF_DEFAULTS), 'no-such-pref', 'toString', '__proto__'];
  ONLINE_FORCED_PREFS.perfUrl2Probe = 'forced';   // a key forced for the length of the test, beside the table's own
  try {
    for (const k of [...keys, 'perfUrl2Probe']) for (const s of searches) assert.equal(onlineForcedPref(k, s), old(k, s), `${k} on '${s}'`);
    assert.equal(onlineForcedPref('perfUrl2Probe', '?online'), 'forced', 'a forced key online reads forced');
    assert.equal(onlineForcedPref('perfUrl2Probe', ''), undefined, 'and offline reads the player\'s');
  } finally { delete ONLINE_FORCED_PREFS.perfUrl2Probe; }
});

test('PERF-URL2: a pref no page forces reads the page NOT AT ALL - getPref over every shelf key the table does not force asks `location.search` zero times, and a forced key still asks it once a read (mutants: the page asked first again)', () => {
  let reads = 0;
  const had = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { get search() { reads++; return '?online'; }, pathname: '/play/', hash: '' } });
  try {
    const free = Object.keys(PREF_DEFAULTS).filter((k) => !Object.hasOwn(ONLINE_FORCED_PREFS, k));
    assert.ok(free.length > 20 && free.length < Object.keys(PREF_DEFAULTS).length, `the shelf's free keys (${free.length}) and some the table forces`);
    for (let i = 0; i < 3; i++) for (const k of free) getPref(k);
    assert.equal(reads, 0, `${reads} page reads for prefs no page forces`);
    ONLINE_FORCED_PREFS.perfUrl2Probe = 'forced';
    try {
      assert.equal(getPref('perfUrl2Probe'), 'forced', 'online, a forced key reads forced through getPref');
      assert.equal(reads, 1, 'and asked the page once');
    } finally { delete ONLINE_FORCED_PREFS.perfUrl2Probe; }
  } finally {
    if (had) Object.defineProperty(globalThis, 'location', had); else delete globalThis.location;
  }
});
