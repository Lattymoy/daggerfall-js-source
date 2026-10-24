// OUTDOOR-LOOT, HARDENING (2026-10-18): THE PINS THE MUTANTS FOUND MISSING. `tools/mutants/outdoorloot.json` was first run against the
// three slices' tests and sixteen of its seventy-two records SURVIVED; nine of them were laws the slices decided and no test held.
// This file holds them (the other seven were equivalent in outcome, or narrow edges - AUDIT OUTDOOR-LOOT, 2026-10-18, pinned the ones
// a player could meet in the files its record names: bible/06-Systems/Online-Arc.md OUTDOOR-LOOT, "AUDIT OUTDOOR-LOOT"):
//   1. THE DIGEST MERGES MONOTONELY (net/bodyLoot.js mergeDigest): two words land the same in either order and a stale word never
//      brings a taken place back, or a drawn-down stack back up - the law a verdict's digest and a delayed stream frame both
//      meet.
//   2. THE OWNER ANSWERS A PEEK ONLY WITHIN REACH (A1/C7 for the peek): a reader across the cell is met with silence.
//   3. THE WINDOW IS TOLD (DESIGN 3.6): ui/inventoryDoor.js createInventoryWindow tells a container its window stands (`opened`),
//      systems/inventorySession.js closeSession tells it the window is gone (`closed`) - once, and a close that throws does not
//      keep the window's own `onClose` from running. Every body pin drives a window stand-in that calls the hooks itself, so the
//      plumbing between the real doors and the container was held by nothing.
//   4. AN OLDER BUILD'S WHOLE LIST IS A DIFF AGAINST ITS OWN PREVIOUS WORD, a baseline when it has none (roomLoot.js legacyDelta;
//      interiorRoomLoot.js landLegacy): a SECOND older build's first word - its list as the room stood - brings back nothing
//      the room's takers took, and an older build's word dated yesterday never touches today's list.
import '../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { digestWord, hexOfPlaces, validDigest, mergeDigest, placeGone } from '../../src/net/bodyLoot.js';
import { createInventoryWindow } from '../../src/ui/inventoryDoor.js';
import { closeSession } from '../../src/systems/inventorySession.js';
import { scene, run, restoreRandom, SETTLED_MS } from './bodyLootHarness.mjs';
import { TODAY, KEY, ROOM, REAL_RANDOM, items, names, mk, frame, quiesce, building, older, pressYes, windowOf, packHas, clone, olderLootRecords } from './containerLootHarness.mjs';
import { resetQuickLoot } from '../../src/systems/quickLoot.js';
import { setSharedClock } from '../../src/systems/worldTick.js';

afterEach(() => { restoreRandom(); Math.random = REAL_RANDOM; resetQuickLoot(); setSharedClock(null); });

// ── 1. the digest ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const word = (g, l, taken, counts = []) => validDigest(digestWord(g, l, new Set(taken), new Map(counts)));
const snap = (d) => JSON.stringify({ g: d.g, l: d.l, x: d.x.toString(16), c: [...d.c].sort((a, b) => a[0] - b[0]) });

test('OUTDOOR-LOOT: the digest merges monotonely - a stale word never brings a taken place back or a drawn-down stack back up, and two words land the same in either order', () => {
  const stale = () => word(7, 4, [], [[1, 50]]);          // before any take: four places, a stack of 50 at place 1
  const fresh = () => word(7, 4, [2], [[1, 20]]);         // after: place 2 gone, the stack drawn down to 20
  const there = word(7, 4, [2], [[1, 20]]);
  assert.equal(mergeDigest(there, stale()), false, 'a stale word changes nothing the reader holds');
  assert.equal(placeGone(there, 2), true, 'and place 2 stays GONE - the stale word said it was there');
  assert.equal(there.c.get(1), 20, 'and the stack stays at 20 - the stale word said 50');
  const ab = stale(); mergeDigest(ab, fresh());
  const ba = fresh(); mergeDigest(ba, stale());
  assert.equal(snap(ab), snap(ba), 'two words merge to the same state in either order');
  assert.equal(snap(ab), snap(there), 'and to the newer word\'s state');
  const grown = word(7, 4, [2], [[1, 20]]);
  assert.equal(mergeDigest(grown, word(7, 6, [2, 5], [[1, 20]])), true, 'a word with more places and one more gone is news');
  assert.equal(grown.l, 6, 'the larger count of places stands');
  assert.equal(placeGone(grown, 5), true, 'and the union of the places gone');
  assert.equal(hexOfPlaces([0, 3]), '9', 'the bitset is the places gone, bit p the place p (guard)');
});

// ── 2. the peek's reach ─────────────────────────────────────────────────────────────────────────────────────────────────────
for (const where of ['street', 'building']) {
  test(`OUTDOOR-LOOT [${where}]: the owner answers a peek only within reach - a reader across the cell is met with silence, one at the body is answered`, async () => {
    const s = await scene(where, ['mac-0001', 'eve-0003']);
    const answers = (to) => s.net.log.filter((e) => e.from === s.bob.id && e.to === to.id && Array.isArray(e.data.br)).length;
    const base = { mac: answers(s.mac), eve: answers(s.eve) };
    s.eve.feet[0] += 24; s.eve.feet[2] += 24;   // far past BODY_PEEK_REACH + two pose slacks, still in the roster and in the owner's pose list
    run(s.net, 400);
    s.bob.hit(s.eve.id, s.frame(s.bob.id, { bp: [0, 1, 2] }));
    run(s.net, SETTLED_MS);
    assert.equal(answers(s.eve), base.eve, 'the owner answered a peek from a reader 34 m off - a body\'s records go to whoever asks, from anywhere in the cell');
    s.bob.hit(s.mac.id, s.frame(s.bob.id, { bp: [0, 1, 2] }));
    run(s.net, SETTLED_MS);
    assert.ok(answers(s.mac) > base.mac, 'a reader standing at the body is answered (guard)');
  });
}

// ── 3. the window's hooks ───────────────────────────────────────────────────────────────────────────────────────────────────
const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };

test('OUTDOOR-LOOT (DESIGN 3.6): createInventoryWindow tells a container its window STANDS - once, as the window is built', () => {
  let opened = 0;
  const bag = [{ group: 'Weapons', templateIndex: 113, name: 'Dagger' }];
  const w = createInventoryWindow({ items: () => bag, icons: ICONS, loot: { items: () => bag, opened: () => { opened++; } } });
  assert.ok(w, 'a window was built');
  assert.equal(opened, 1, 'the container was told its window stands, once - the pool composes nothing under it (AUDIT WORLD4 C1) only if it is told');
});

test('OUTDOOR-LOOT (DESIGN 3.6): closeSession tells a container its window is GONE - once, and a close that throws does not keep the window\'s own onClose from running', () => {
  const log = [];
  closeSession({ loot: { items: () => [], closed: () => log.push('closed') }, onClose: () => log.push('onClose') }, { dropped: [] });
  assert.deepEqual(log, ['closed', 'onClose'], 'the container is told, then the window\'s own close runs');
  const warn = console.warn; console.warn = () => {};
  const log2 = [];
  try { closeSession({ loot: { items: () => [], closed: () => { throw new Error('a container that cannot close'); } }, onClose: () => log2.push('onClose') }, { dropped: [] }); } finally { console.warn = warn; }
  assert.deepEqual(log2, ['onClose'], 'the window is gone whatever the container says');
});

// ── 4. an older build's list is a diff ──────────────────────────────────────────────────────────────────────────────────────
const STOCK = () => [mk('Dagger'), mk('Mace'), mk('Katana'), mk('Staff')];

test('OUTDOOR-LOOT T27: a SECOND older build\'s first word is a baseline - its list as the room stood brings back nothing a new player took, and its second untouched word nothing more', () => {
  const s = building(3);
  const O = older(s.net, 'oooo-0009', { list: STOCK() });
  O.say(); s.net.flush();
  const wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  wb.takeNamed('Dagger'); wb.close(); frame(s.B); s.net.flush(); quiesce(s);
  for (const p of s.ps) assert.deepEqual(names(items(p)), ['Mace', 'Katana', 'Staff'], `${p.id} holds the list less the Dagger B took (guard)`);
  const O2 = older(s.net, 'oooo-0010', { list: STOCK() });   // another older build, joined late, holding the list it was handed before B\'s take
  O2.say(); s.net.flush(); quiesce(s);
  for (const p of s.ps) assert.deepEqual(names(items(p)), ['Mace', 'Katana', 'Staff'], `${p.id}'s list is ${JSON.stringify(names(items(p)))} after a second older build\'s first word - it was read as that build\'s PUTS, every piece of its list: the room doubled`);
  O2.say(); s.net.flush(); quiesce(s);
  for (const p of s.ps) assert.deepEqual(names(items(p)), ['Mace', 'Katana', 'Staff'], `${p.id}'s list after its second, untouched word`);
  assert.equal(packHas(s.B, 'Dagger'), 1, 'and B holds the Dagger once');
});

test('OUTDOOR-LOOT A3: an older build\'s whole list dated YESTERDAY never touches today\'s cupboard - not its list, not a diff of it', () => {
  const s = building(3);
  const O = older(s.net, 'oooo-0009', { list: STOCK() });
  O.say(); s.net.flush();
  const wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  wb.takeNamed('Dagger'); wb.close(); frame(s.B); s.net.flush(); quiesce(s);
  O.say(); s.net.flush(); quiesce(s);   // the older build\'s baseline, today
  const stale = olderLootRecords(O.ctx, [KEY]).map((r) => ({ ...r, r: r.r.filter((it) => it.name !== 'Mace'), d: TODAY - 1 }));   // yesterday\'s word: the Mace gone from it
  s.net.accept(O.id, { k: ROOM, l: clone(stale) }); s.net.flush(); quiesce(s);
  for (const p of s.ps) assert.deepEqual(names(items(p)), ['Mace', 'Katana', 'Staff'], `${p.id}'s list after yesterday\'s word from an older build - its Mace came out of today\'s cupboard: yesterday's word never beats today's (A3)`);
});
