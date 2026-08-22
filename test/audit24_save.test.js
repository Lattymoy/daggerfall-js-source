// AUDIT 24 (the seven-slice sweep), the SAVE/RESTORE survivors.
//
// The mutation campaign left five live mutants in src/systems/save.js -
// the file that decides whether a loaded character is the character who
// was saved. Every one is a law with a comment above it and no test
// under it: the faction-rep restore's two returns, the pre-S15 fatigue
// default, the pre-17f gold-stack upgrade, and the light-source
// sentinel. All five are pinned here by BEHAVIOUR, not by shape.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { restoreFactionRep, restorePlayer, snapshotPlayer } from '../src/systems/save.js';

/** A minimal live entity the snapshotter accepts. */
function makeEntity(over = {}) {
  return {
    name: 'Tester', race: 'Breton', gender: 'male', level: 3,
    stats: { strength: 50, endurance: 40, agility: 30, speed: 30, willpower: 30, intelligence: 30, luck: 30, personality: 30 },
    skills: new Array(35).fill(10), skillUses: new Array(35).fill(0),
    items: [], wagonItems: [], activeEffects: [], spells: [],
    health: 30, fatigue: 100, magicka: 10, gold: 0,
    ...over,
  };
}

test('audit24 save: restoreFactionRep answers FALSE without a store and TRUE when it wrote', () => {
  // The two returns are the caller's only signal that the rep half of
  // a load happened at all - a restore that quietly answers true on a
  // missing store would lose every faction standing in the save with
  // nothing said.
  assert.equal(restoreFactionRep(null, { ids: [1] }), false, 'no store');
  assert.equal(restoreFactionRep({ dict: new Map() }, null), false, 'no snapshot');
  assert.equal(restoreFactionRep({ dict: new Map() }, {}), false, 'a snapshot with no ids');
  const rec = { id: 42, rep: 0, flags: 0, power: 0 };
  const store = { dict: new Map([[42, rec]]) };
  assert.equal(restoreFactionRep(store, { ids: [42], rep: [17], flags: [3], power: [9] }), true);
  assert.deepEqual([rec.rep, rec.flags, rec.power], [17, 3, 9], 'and it really wrote');
  // an id the rebuilt store no longer has is SKIPPED, not invented
  assert.equal(restoreFactionRep(store, { ids: [999], rep: [1], flags: [1], power: [1] }), true);
  assert.equal(store.dict.size, 1, 'no ghost record');
});

test('audit24 save: a pre-S15 save defaults fatigue to MaxFatigue = (Str + End) x 64', () => {
  // The additive-field shape DFU's serializer gives a missing member.
  // 64 is MaxFatigue's own multiplier - at 65 a loaded character opens
  // over-rested and the first tick clamps them back down, at 63 under.
  const e = makeEntity();
  const snap = snapshotPlayer(e, {});
  delete snap.fatigue;
  const target = makeEntity({ fatigue: null });
  target.fatigue = undefined;
  restorePlayer(target, snap);
  assert.equal(target.fatigue, (50 + 40) * 64, 'exactly (Str + End) x 64');
  assert.equal(target.fatigue, 5760);
  // and a save that CARRIES fatigue keeps its own number
  const snap2 = snapshotPlayer(makeEntity({ fatigue: 1234 }), {});
  const t2 = makeEntity();
  restorePlayer(t2, snap2);
  assert.equal(t2.fatigue, 1234, 'the default is only for a MISSING field');
});

test('audit24 save: a pre-17f Currency stack is upgraded ONLY when it has no template index', () => {
  // stacksWith compares templateIndex, so a restored index-less gold
  // stack would grow a SECOND stack the next time gold was added - and
  // goldAmount only ever finds the first. The guard is an AND of two
  // conditions and both matter: an OR would rewrite every Currency
  // stack (losing a real index) and every index-less item of any group.
  const e = makeEntity({
    items: [
      { group: 'Currency', stackCount: 500 },                       // pre-17f: no index
      { group: 'Currency', templateIndex: 7, stackCount: 250 },     // already upgraded
      { group: 'Weapons', stackCount: 1 },                          // index-less, NOT currency
    ],
  });
  const snap = snapshotPlayer(e, {});
  const t = makeEntity();
  restorePlayer(t, snap);
  assert.ok(t.items[0].templateIndex != null, 'the index-less Currency stack gained one');
  assert.equal(t.items[0].stackCount, 500, 'and kept its gold');
  assert.equal(t.items[1].templateIndex, 7, 'an already-indexed stack is left alone');
  assert.equal(t.items[2].templateIndex, undefined, 'and a non-Currency item is never touched');
  assert.equal(t.items[2].group, 'Weapons');
});

test('audit24 save: the light-source sentinel is -1, and only >= 0 relinks', () => {
  // AUDIT 22 F7: the lit light source is a REFERENCE into an items
  // array the restore just replaced. A snapshot older than the field
  // carries none, which must read as "nothing lit" - not as index -1,
  // and not as index 0, which would light the first thing in the pack.
  const torch = { group: 'UselessItems2', templateIndex: 1, stackCount: 1 };
  const e = makeEntity({ items: [torch, { group: 'Weapons' }] });
  e.lightSource = torch;
  const snap = snapshotPlayer(e, {});
  const t = makeEntity();
  restorePlayer(t, snap);
  assert.equal(t.lightSource, t.items[0], 'the RESTORED record, not the old object');
  assert.notEqual(t.lightSource, torch, 'and not a reference into the discarded array');

  // a pre-field snapshot: nothing lit
  delete snap.lightSourceIndex;
  const t2 = makeEntity();
  restorePlayer(t2, snap);
  assert.equal(t2.lightSource, null, 'a missing index is NOTHING lit, not items[0]');
  // and an explicit -1 is the same
  snap.lightSourceIndex = -1;
  const t3 = makeEntity();
  restorePlayer(t3, snap);
  assert.equal(t3.lightSource, null);
  // AN HONEST NON-KILL, recorded rather than dressed up: the campaign's
  // fifth survivor here flips that `?? -1` default to `?? -2`, and no
  // test can catch it - the only reader is `li >= 0`, so every negative
  // behaves identically. It is an EQUIVALENT MUTANT. -1 is the value
  // because it is the sentinel the rest of the port writes, not because
  // anything can tell.
  snap.lightSourceIndex = -99;
  const t4 = makeEntity();
  restorePlayer(t4, snap);
  assert.equal(t4.lightSource, null, 'any negative reads as nothing lit - the sentinel is a convention');
});

test('audit24 save: the 64 quest GLOBALS ride the envelope, and survive a clearState', async () => {
  // DFU keeps the SAVEVARS.DAT globals on PlayerEntity.GlobalVars and
  // serialises them with the PLAYER (SerializablePlayer.cs:134, :303).
  // The port homed them on the machine, where getSaveData wrote two
  // keys and clearState wiped four - and this store was in NEITHER. So
  // every global a quest had set, the main quest's own progress among
  // them, was lost on save and reset to false on load.
  const { QuestMachine } = await import('../src/systems/quest/machine.js');
  const m = new QuestMachine({ nowSeconds: () => 0 });
  m.globalVars.set(11, true);
  m.globalVars.set(42, false);
  const snap = m.getSaveData();
  assert.ok(Array.isArray(snap.globalVars), 'the envelope carries them');

  const m2 = new QuestMachine({ nowSeconds: () => 0 });
  assert.equal(m2.globalVars.size, 0, 'a fresh machine starts empty');
  m2.restoreSaveData(snap);
  assert.equal(m2.globalVars.get(11), true, 'a set global survives the round trip');
  assert.equal(m2.globalVars.get(42), false, 'and an explicitly-cleared one is not lost');

  // ClearState does NOT wipe them - C#'s wipes the machine's own four
  // collections, and the globals live on PlayerEntity, replaced
  // wholesale by the player restore that follows.
  m2.clearState();
  assert.equal(m2.globalVars.get(11), true, 'clearState leaves the globals standing');

  // a pre-AUDIT-24 envelope carries none: the fresh all-false start
  // holds, which is the additive-field shape DFU's serializer gives
  const m3 = new QuestMachine({ nowSeconds: () => 0 });
  m3.globalVars.set(7, true);
  m3.restoreSaveData({ siteLinks: [], quests: [] });
  assert.equal(m3.globalVars.get(7), true, 'an old save does not blank them');
});

// A TIMEOUT, deliberately: the defect this pins is an INFINITE LOOP, so
// a regression does not fail an assertion - it hangs the whole suite
// with no output. Five seconds turns that into a red test.
test('audit24: the notebook wrap THROWS on an unbreakable run, where the port span for ever',
  { timeout: 5000 }, async () => {
  // WrapLinesIntoNote breaks on the last space at or before column 70.
  // C# `LastIndexOf` answers -1 when the first 71 characters carry no
  // space, and `Substring(0, -1)` is an ArgumentOutOfRangeException -
  // DFU shows an exception. In JS `slice(0, -1)` is a legal "drop the
  // last character" and `slice(0)` is the SAME STRING, so the loop
  // made no progress and spun for ever: a frozen tab. A 71-character
  // run with no space is reachable - a long quest name, a pasted
  // token, any note the player types.
  const { wrapLinesIntoNote, MAX_LINE_LENGTH } = await import('../src/systems/notebook.js');
  assert.equal(MAX_LINE_LENGTH, 70);
  // THE SHAPE FIRST, and it has to be. A synchronous infinite loop is
  // the one defect a behavioural pin cannot catch: the pin never
  // returns, so node's per-test timeout never fires (the event loop
  // does not get a turn) and the whole suite hangs with no output
  // instead of going red. This assertion runs BEFORE the call that
  // would hang, so removing the guard fails here.
  const src = readFileSync(new URL('../src/systems/notebook.js', import.meta.url), 'utf8');
  assert.match(src, /if \(pos < 0\) \{[\s\S]{0,200}throw new RangeError\(/,
    'the no-break-point guard is present - without it this test HANGS rather than fails');
  const note = [];
  assert.throws(() => wrapLinesIntoNote(note, 'x'.repeat(MAX_LINE_LENGTH + 1), 'text'), RangeError,
    'no break point in the first 71 characters throws, as C# does');
  // exactly 70 is fine - the loop never runs
  const ok = [];
  wrapLinesIntoNote(ok, 'y'.repeat(MAX_LINE_LENGTH), 'text');
  assert.equal(ok.length, 2, 'one line and its NOTHING');
  assert.equal(ok[0].text, ' ' + 'y'.repeat(MAX_LINE_LENGTH), 'with C#s leading space');
  // and a breakable long run still wraps
  const wrapped = [];
  wrapLinesIntoNote(wrapped, `${'a'.repeat(40)} ${'b'.repeat(40)}`, 'text');
  assert.equal(wrapped.length, 4, 'two lines, each with its NOTHING');
});
