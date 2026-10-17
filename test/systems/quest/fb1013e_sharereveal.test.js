// SHARE-REVEAL (FIELD BUGS 2026-10-13e, Starempire42: "Shared Guild quest doesn't give me map location after friend
// talked to the quest npc" - "my friend found the quest npc and advanced the quest ... I do not have the next dungeon
// destination. it tells me to ask for directions yet none of the npcs know where it is"; the journal: "The Nest of
// Aneloth - Not on your map yet. Ask around for directions.").
//
// A shared quest travels as its save state, and a receiver's copy restores every action as it stands - complete actions
// are never run (a load must not refire a reward). QUEST1 re-arms, on the receiver, the one-time actions whose effect
// lands in the HOLDER'S OWN world (REPLAYABLE_ONE_TIME_ACTIONS), and `reveal` was not among them: the partner who
// clicked the scholar had the dungeon on their map, the receiver's copy carried the reveal complete and never ran it.
// Nobody could tell the receiver either - the quest's people take the click (QuestResourceBehaviour) and DFU's talk
// names no remote quest dungeon.
//
// Driven on the real Mages Guild quest N0B00Y17 ("Azimuthal Vectors": `_S.05_ clicked npc _scholar_`, `_S.12_ when _S.05_
// and _S.02_ ... reveal _itemdung_`) through the real QuestMachine on two sides and the real share (questShare.js
// prepareQuestShare / receiveSharedQuest). Its `place npc` / `place item` lines want a loaded world, so they are cut
// on both sides, as the AUDIT TIMEFREE II harness cuts them (test/systems/quest/rest8_audit_timefree.test.js); every Place stands at
// a named site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { receiveSharedQuest, prepareQuestShare } from '../../../src/systems/quest/questShare.js';

const ROOT = new URL('../../..', import.meta.url).pathname;
const rd = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/^﻿/, '');
loadQuestTables(Object.fromEntries(readdirSync(join(ROOT, 'vendor/dfu-quests/Tables')).filter((f) => f.endsWith('.txt'))
  .map((f) => [f.replace('.txt', ''), rd(join('vendor/dfu-quests/Tables', f))])));
const LINES = rd('vendor/dfu-quests/Quests/N0B00Y17.txt').split(/\r?\n/).filter((l) => !/^\s*(place npc|place item|create npc at)/.test(l));
const SITES = Object.freeze({ scholardung: 'Scholar Crypt', hintdung: 'Hint Barrow', itemdung: 'The Nest of Aneloth' });
const LISTS = { findQuestMeta: () => null, hasAcceptedOneTime: () => false, markOneTimeAccepted() {} };

/** One player's machine and map (the host's world seam: PlayerGPS.DiscoverLocation, as world.js answers it). */
function side() {
  const now = { s: 1e6 };
  const map = [];
  const notes = [];
  const world = { discoverLocation: (_region, loc) => { map.push(loc); return true; }, addNote: (n) => notes.push(n) };
  const m = new QuestMachine({ nowSeconds: () => now.s, getQuestSourceLines: () => LINES, showPopup() {}, isPlayerInTown: () => true, giveItemToPlayer() {} });
  return { m, map, notes, world, tick(n = 1) { for (let i = 0; i < n; i++) { now.s += 5; m.tick(); } } };
}
const task = (q, n) => [...q.tasks.values()].find((t) => t.symbol?.name === n);
const shown = (map) => [...new Set(map)].sort();

/** The partner A takes the quest (its lead roll set to the scholar's path) and shares it to B. */
function sharedPair() {
  const A = side(), B = side();
  const rnd = Math.random;
  Math.random = () => 0;   // `pick one of _S.02_ _cousin_ _cousin_ _S.03_` -> _S.02_, the scholar's lead
  let qa;
  try {
    qa = A.m.startQuestByName('N0B00Y17');
    qa.hooks.world = A.world;
    for (const r of qa.resources.values()) {
      if (r.isPlace) r.siteDetails = { regionName: 'Testshire', locationName: SITES[r.symbol.name], mapId: 1, siteType: 2, questSpawnMarkers: [], questItemMarkers: [] };
    }
    A.tick(3);
  } finally { Math.random = rnd; }
  assert.equal(task(qa, 'S.02').triggered, true, 'the scholar\'s lead');
  A.m.markQuestShared('N0B00Y17');
  const first = receiveSharedQuest(B.m, LISTS, 'N0B00Y17', prepareQuestShare(A.m, qa.uid).data, { online: false });
  assert.equal(first.ok, true);
  first.quest.hooks.world = B.world;
  B.tick(3);
  return { A, B, qa, qb: first.quest };
}

test('SHARE-REVEAL 1: the partner clicks the scholar and the resync puts The Nest of Aneloth on the receiver\'s map - once', () => {
  const { A, B, qa } = sharedPair();
  assert.deepEqual(shown(B.map), shown(A.map), 'a fresh receive marks what the partner\'s start-up revealed');
  assert.equal(B.map.includes(SITES.itemdung), false);
  qa.getResource({ name: 'scholar' }).setPlayerClicked();
  A.tick(3);
  assert.equal(task(qa, 'S.12').triggered, true);
  assert.ok(A.map.includes(SITES.itemdung), 'the clicker\'s map');
  const sync = receiveSharedQuest(B.m, LISTS, 'N0B00Y17', prepareQuestShare(A.m, qa.uid).data, { online: false });
  assert.equal(sync.ok, true);
  assert.equal(sync.resync, true);
  B.tick(3);
  const qb = sync.quest;
  assert.equal(task(qb, 'S.12').triggered, true);
  assert.equal(B.map.filter((l) => l === SITES.itemdung).length, 1, 'the receiver\'s map - the line that read "Not on your map yet"');
  // the same envelope again, and a later one: nothing fires twice
  const again = receiveSharedQuest(B.m, LISTS, 'N0B00Y17', prepareQuestShare(A.m, qa.uid).data, { online: false });
  assert.equal(again.ok, true);
  B.tick(5);
  assert.equal(B.map.filter((l) => l === SITES.itemdung).length, 1, 'a reveal already run here is never armed again');
  assert.deepEqual(B.notes, [], 'N0B00Y17\'s reveals are not readmap - no note');
});

test('SHARE-REVEAL 2: every `reveal` the partner has run reaches a fresh receiver - the quest\'s own Places only, each once', () => {
  const { A, B, qa } = sharedPair();
  qa.getResource({ name: 'scholar' }).setPlayerClicked();
  A.tick(3);
  // C joins after the scholar was clicked: one receive carries all of it
  const C = side();
  const got = receiveSharedQuest(C.m, LISTS, 'N0B00Y17', prepareQuestShare(A.m, qa.uid).data, { online: false });
  assert.equal(got.ok, true);
  got.quest.hooks.world = C.world;
  C.tick(3);
  assert.deepEqual(shown(C.map), shown(A.map));
  assert.ok(C.map.includes(SITES.itemdung));
  assert.equal(C.map.length, new Set(C.map).size, 'each once');
  assert.ok(C.map.every((l) => Object.values(SITES).includes(l)), 'nothing but this quest\'s own Places');
  void B;
});
