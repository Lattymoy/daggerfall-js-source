// DISC28-I/J (2026-09-28, Discord): the shared quest's end, its house, and a partner's quest foe.
//
// I-a (The Courier, Buckingwing Residence: a quest shared by a friend "does not complete" for the receiver). The
// sharer's `end quest` completes the quest and the machine tombstones it IN THE SAME TICK - which takes it out of
// sharedQuestNames, the one set the live sync walks - so the finish was never sent, and the sync's measure (the log's
// length) never saw a kill, a reward or an end anyway. Now a finished shared copy leaves its final envelope for the
// party; the receiver's copy is restored as the running quest it was a tick before the end, its newly-completed
// rewards re-armed as every resync's are, and ended by the quest's own EndQuest - the reward paid once, no echo back.
// And `get item` joins the actions a receiver replays: the package the sharer took is the receiver's to carry too.
//
// I-b ("we couldn't enter the house after I entered it"): the door's quest rung asked the SITE LINKS, which only a
// placement action makes; DFU's IsActiveQuestBuilding (PlayerActivate.cs:1315-1329) asks every Place of every active
// quest. The Exterminator names its house and places nothing in it: its own holder was locked out, while a friend
// the quest was shared with (whose receipt links every Place) walked in.
//
// J (Atronach Hunting: the kill "not credited"): a party peer's quest foe stood for any party member, but its death
// credits only a LINKED copy (sharedQuestFoe) - an independent copy stood the partner's foe beside its own and
// killing it did nothing.
//
// Driven through the real machine, the real share path and the vendored quests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { receiveSharedQuest, prepareQuestShare, prepareShareData, shareSignature } from '../src/systems/questShare.js';
import { mapPixelToWorldCoord } from '../src/formats/mapsFile.js';
import { buildingIsUnlocked } from '../src/systems/buildingLocks.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { sharedQuestFoe } from '../src/scenes/questFoeHost.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  loadQuestTables(sources);
}
const CORPUS = {};
for (const f of readdirSync(join(VENDOR, 'Quests'))) CORPUS[f.replace(/\.txt$/i, '')] = read(join(VENDOR, 'Quests', f)).split(/\r?\n/);
// a quest whose reward and end sit in one task nobody has started yet - started by hand below, as a click would
CORPUS.__FN = ['Quest: __FN', 'QRC:', 'Message:  1011', ' a reward', '', 'QBN:', 'Item _reward_ gold', 'Item _pkg_ letter', '',
  '_t_ task:', ' give pc _reward_', ' end quest', '', '_g_ task:', ' get item _pkg_', '', 'variable _pad_'];
const lists = { findQuestMeta: () => null, hasAcceptedOneTime: () => false, markOneTimeAccepted() {} };
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };

function machine(world = null) {
  const m = new QuestMachine({
    nowSeconds: () => 0, showPopup() {}, world, lastNPCClicked: () => m.clicked ?? null,
    getQuestSourceLines: (n) => CORPUS[n] ?? null,
    offerReward: () => { m.rewards = (m.rewards ?? 0) + 1; },
    giveItemToPlayer: (it) => { (m.given ??= []).push(it); },
  });
  return m;
}
/** The sharer takes __FN, shares it (the Share button: mark it shared, send the envelope), the receiver takes it in. */
function sharedPair() {
  const A = machine(), R = machine();
  const q = A.scheduleQuest(CORPUS.__FN, 0, { rolls: () => 0 });
  A.tick();
  A.markQuestShared('__FN');
  const got = receiveSharedQuest(R, lists, '__FN', prepareQuestShare(A, q.uid).data);
  assert.ok(got.ok);
  return { A, R, q, r: got.quest };
}
const sym = (q, name) => [...q.tasks.values()].find((t) => t.symbol?.name === name.replace(/_/g, ''))?.symbol;   // a symbol's name drops its underscores
const run = (m, n = 4) => { for (let i = 0; i < n; i++) m.tick(); };
/** The finals a machine holds, settled as the host settles each once it has left (AUDIT DISC28 QS-1). */
const takeFinals = (m) => { const out = []; for (let d = m.nextFinishedShare(); d; d = m.nextFinishedShare()) { out.push(d); m.settleFinishedShare(d); } return out; };

test('DISC28-I: the sharer\'s end leaves its final envelope - taken once, before the tombstone disposed anything', () => {
  const { A, q } = sharedPair();
  q.startTask(sym(q, '_t_'));
  run(A);
  assert.equal(q.questTombstoned, true, 'the sharer\'s copy ended');
  assert.equal(A.rewards, 1, 'and paid the sharer');
  const out = takeFinals(A);
  assert.equal(out.length, 1);
  assert.equal(out[0].questName, '__FN');
  assert.equal(out[0].questComplete, true);
  assert.equal(out[0].questTombstoned, false, 'the state a tick before the tombstone');
  assert.equal(typeof out[0].shareId, 'string');
  assert.equal(takeFinals(A).length, 0, 'handed over once');
});

test('DISC28-I: the receiver\'s copy ends with the sharer\'s - its reward paid exactly once, and nothing echoed back', () => {
  const { A, R, q, r } = sharedPair();
  q.startTask(sym(q, '_t_'));
  run(A);
  const [final] = takeFinals(A);
  const got = receiveSharedQuest(R, lists, '__FN', prepareShareData(final).data);
  assert.ok(got.ok && got.resync, `the finish is a resync of the standing copy (${got.reason})`);
  assert.equal(got.quest, r);
  run(R);
  assert.equal(r.questTombstoned, true, 'the receiver\'s copy ended too');
  assert.equal(R.rewards, 1, 'the receiver\'s reward, once');
  run(R);
  assert.equal(R.rewards, 1);
  assert.equal(takeFinals(R).length, 0, 'a finish the partner brought is not sent back');
  assert.equal(receiveSharedQuest(R, lists, '__FN', prepareShareData(final).data).reason, 'done', 'and a re-send pays nothing');
});

test('DISC28-I: a finished envelope never makes a copy for a member who never took the quest', () => {
  const { A, q } = sharedPair();
  q.startTask(sym(q, '_t_'));
  run(A);
  const [final] = takeFinals(A);
  const C = machine();
  assert.equal(receiveSharedQuest(C, lists, '__FN', prepareShareData(final).data).reason, 'finished');
  assert.equal(C.sharedCandidateNamed('__FN'), null);
});

test('DISC28-I: an error\'s removal and an unshared quest leave nothing to send', () => {
  const A = machine();
  const q = A.scheduleQuest(CORPUS.__FN, 0, { rolls: () => 0 });
  A.tick();
  q.startTask(sym(q, '_t_'));
  run(A);
  assert.equal(takeFinals(A).length, 0, 'never shared');
  const { A: B, q: q2 } = sharedPair();
  B.removeQuest(q2);
  assert.equal(takeFinals(B).length, 0, 'removed unfinished');
});

test('DISC28-I: the sync\'s measure sees what the log does not - a task begun, an action done, a kill', () => {
  const { q } = sharedPair();
  const s0 = shareSignature(q);
  q.startTask(sym(q, '_g_'));
  assert.notEqual(shareSignature(q), s0, 'a task begun');
  const s1 = shareSignature(q);
  q.getTask(sym(q, '_g_')).actions[0].isComplete = true;
  assert.notEqual(shareSignature(q), s1, 'an action done');
  assert.equal(shareSignature(null), '');
});

test('DISC28-I: `get item` the sharer already did is the receiver\'s to do too - their own package, handed once', () => {
  const A = machine(), R = machine();
  const q = A.scheduleQuest(CORPUS.__FN, 0, { rolls: () => 0 });
  A.tick();
  q.startTask(sym(q, '_g_'));
  run(A, 2);
  assert.equal(A.given?.length, 1, 'the sharer took the package');
  A.markQuestShared('__FN');
  const got = receiveSharedQuest(R, lists, '__FN', prepareQuestShare(A, q.uid).data);
  run(R, 2);
  assert.equal(R.given?.length, 1, 'the receiver is handed their own');
  assert.notEqual(R.given[0], A.given[0], 'the receiver\'s own roll, not the sender\'s object');
  receiveSharedQuest(R, lists, '__FN', prepareQuestShare(A, q.uid).data);
  run(R, 2);
  assert.equal(R.given.length, 1, 'a later resync hands nothing again');
  assert.ok(got.ok);
});

// ---- I-b: the door ----
const flat = (record) => ({ textureArchive: 199, textureRecord: record, xPos: 40, yPos: 8, zPos: 60 });
const building = (buildingType) => ({ buildingType, factionId: 0, nameSeed: 777, locationId: 0, sector: 0, quality: 9 });
const FACTIONS = new Map([
  [510, { id: 510, type: 2, name: 'The Merchants', race: -1 }],
  [201, { id: 201, type: 15, name: 'People of Testshire', race: -1 }],
  [867, { id: 867, type: 14, name: 'Court of Testshire', race: -1 }],
]);
function town() {
  const buildings = [building(17), building(17), building(17)];
  const block = { position: 5000, rmbBlock: { fldHeader: { buildingDataList: buildings, otherNames: null },
    subRecords: buildings.map(() => ({ interior: { blockFlatObjectRecords: [flat(11), flat(18)] } })) } };
  const w0 = mapPixelToWorldCoord(100, 100);
  const loc = { loaded: true, regionIndex: 0, regionName: 'Testshire', name: 'Bigtown', locationIndex: 0, hasDungeon: false,
    mapTableData: { mapId: 111, locationType: 0, dungeonType: -1 },
    exterior: { buildings, recordElement: { header: { x: w0.x, y: w0.y } }, exteriorData: { locationId: 0x400, width: 1, height: 1, blockNames: ['TESTAA00.RMB'] } },
    dungeon: null };
  const region = { name: 'Testshire', locationCount: 1, mapTable: [{ mapId: 111, locationType: 0, dungeonType: -1 }] };
  return {
    maps: { regionCount: 1, getRegion: () => region, getLocation: () => loc, getLocationByName: () => loc,
      getRmbBlockName: () => 'TESTAA00.RMB', readLocationIdFast: () => 0x400, getClimateIndex: () => 231 },
    getBlock: () => block, currentLocation: () => loc, currentRegionIndex: () => 0, currentLocationIndex: () => 0,
    isPlayerInLocationRect: () => true, playerInside: () => null, isHouseOwned: () => false,
    playerPixel: () => ({ x: 100, y: 100 }), buildingNameOpts: () => ({}),
    getFactionData: (id) => FACTIONS.get(id) ?? null, findFactionsOfType: (t) => [...FACTIONS.values()].filter((f) => f.type === t),
    currentRegionPeople: () => 201, currentRegionCourt: () => 867, currentRegionFaction: () => 201,
    currentRegionVampireClan: () => 0, playerVampireClan: () => 0, currentRegionRace: () => 3,
  };
}

test('DISC28-I: The Exterminator\'s house opens for its own holder - DFU\'s rung reads every Place, not the site links', () => {
  const A = machine(town());
  A.clicked = { factionID: 510, nameSeed: 4242, gender: 0 };
  const q = quiet(() => A.scheduleQuest(CORPUS.A0C00Y07, 0, { rolls: () => 0.4 }));
  quiet(() => { A.tick(); A.tick(); });
  const site = q.resources.get('house').siteDetails;
  assert.equal(A.getSiteLinks(site.siteType, 111, site.buildingKey).length, 0, 'the quest places nothing there - no link');
  const door = (m, type = BUILDING_TYPES.House1) => buildingIsUnlocked({ buildingType: type, buildingKey: site.buildingKey }, {
    hour: 12, online: true, isActiveQuestBuilding: (b) => m.isActiveQuestBuilding(111, b.buildingKey, b.buildingType),
  });
  assert.equal(door(A), true, 'the holder walks in');
  A.markQuestShared('A0C00Y07');
  const R = machine(town());
  assert.ok(quiet(() => receiveSharedQuest(R, lists, 'A0C00Y07', prepareQuestShare(A, q.uid).data)).ok);
  assert.equal(door(R), true, 'and so does the friend it was shared with');
  assert.equal(A.isActiveQuestBuilding(111, site.buildingKey, BUILDING_TYPES.House6), true, 'House1-House6, the rung\'s own range');
  assert.equal(A.isActiveQuestBuilding(111, site.buildingKey, BUILDING_TYPES.GeneralStore), false, 'residencesOnly');
  assert.equal(A.isActiveQuestBuilding(111, site.buildingKey, BUILDING_TYPES.GeneralStore, false), true);
  assert.equal(A.isActiveQuestBuilding(112, site.buildingKey, BUILDING_TYPES.House1), false, 'another town');
  quiet(() => A.tombstoneQuest(q));
  assert.equal(A.isActiveQuestBuilding(111, site.buildingKey, BUILDING_TYPES.House1), false, 'an ended quest opens nothing');
});

test('DISC28-I/J: the hosts read the rung, send the finish and stand a partner\'s quest foe for a linked copy alone', () => {
  const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
  const wm = src('scenes/worldModes.js');
  assert.match(wm, /return questBridge\.machine\.isActiveQuestBuilding\(questSceneCtx\?\.\(\)\?\.mapId \?\? 0, b\.buildingKey, b\.buildingType\);/);
  assert.match(wm, /isActiveQuestBuilding: \(bs\) => \(questBridge \? questBridge\.machine\.isActiveQuestBuilding\(dir\.mapId, bs\.buildingKey, bs\.buildingType\) : false\),/);
  assert.doesNotMatch(wm, /getSiteLinks\(SITE_TYPES\.Building, [^\n]*\.buildingKey\)\.length > 0/, 'no rung on the site links');
  const w = src('scenes/world.js');
  assert.match(w, /for \(let data = machine\.nextFinishedShare\?\.\(\) \?\? null; data; data = machine\.nextFinishedShare\(\)\) \{/);   // AUDIT DISC28 QS-1: pending until it has left
  assert.match(w, /data: \{ \.\.\.prepared\.data, sync: 1, final: 1 \}/);
  assert.match(w, /const count = shareSignature\(quest\);/);
  assert.match(w, /accepts: \(\) => true,/);   // PIN MOVED (DESYNC-ZERO): every player in the room stands every foe it holds - the credit, not the sight, is the party's
});

test('DISC28-J: a partner\'s quest foe credits only a linked copy - an independent one has nothing to count it on', () => {
  const { R } = sharedPair();
  assert.ok(sharedQuestFoe(R, { q: '__FN', s: 'reward' }) === null, 'an Item is no Foe');
  const solo = machine();
  solo.scheduleQuest(CORPUS.__FN, 0, { rolls: () => 0 });
  solo.tick();
  assert.equal(solo.hasSharedQuestNamed('__FN'), false, 'taken independently');
  assert.equal(sharedQuestFoe(solo, { q: '__FN', s: 't' }), null, 'an unlinked copy is never handed a partner\'s foe');
});
