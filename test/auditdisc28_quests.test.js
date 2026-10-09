// AUDIT DISC28 (2026-09-28, before the merge) - lane 5, the quests: DISC28-I (a shared quest ends for the whole
// party), DISC28-J (a partner's quest foe stands for a linked copy) and DISC28-K (a re-picked house shows the live
// job's name), read against their own field reports. Each pin is DRIVEN: the real QuestMachine and share path
// (systems/questShare.js) over the vendored quests, the real OnlineSession with its client floor and inbound gates,
// and world.js's own questSyncTick / shareQuestWithParty / onQuestShared / questShareSeam lifted verbatim out of the
// host and bound to real collaborators - a copy of the law would pass with the host broken.
//
// QS-1  a final the client's floor (QUEST_SEND_MS) refused was drained and lost - it waits now until it has left;
//       and nothing is synced from EndQuest's grace (the reward window), which spent the floor the final needed.
// QS-2  the live-sync watch ran below the exterior's modal return: a finish in a house or a dungeon told nobody.
// QS-3  a partner's final meeting a copy already ended said "... but you have already done this quest".
// QS-4  a finishing envelope on a copy in grace ran endQuest again (reputation, notebook twice); a reward armed by one
//       envelope and not yet run was refused by the next and never ran.
// QS-5  the grace sync handed a member with no copy an ending quest - its reward paid, a copy that never ended.
// QS-J  a quest foe handed to an heir with no linked copy was refused and lost for everyone.
// QS-K1 the re-stamp wiped the town map's rename and the lockpick record, and renamed the player's own house.
// QS-K2 the town map opened on arrival still named a house for the job before.
// QS-D  the lock ladder's contract still called the quest rung "the siteLinks walk".
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import * as QS from '../src/systems/questShare.js';
import * as discovery from '../src/systems/discovery.js';
import { mapPixelToWorldCoord } from '../src/formats/mapsFile.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { OnlineSession } from '../src/net/online.js';
import { CHAT_WORLD_ROOM } from '../src/net/wire.js';
import { createExteriorFoes, QUEST_PUPPETS_MAX } from '../src/scenes/exteriorFoes.js';
import { questShareTag, sharedQuestFoe, questPrivateTag, partyQuestFoe, questBehaviourFor, adoptsOrphanQuestFoe } from '../src/scenes/questFoeHost.js';
import { ExteriorAutomapWindow, stampResidenceQuestNames } from '../src/ui/exteriorAutomapWindow.js';
import { buildingSummaries } from '../src/world/buildingSummaries.js';
import { fakeSocketClass } from './fakeSocket.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const VENDOR = join(ROOT, 'vendor', 'dfu-quests');
const readQ = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readQ(join(VENDOR, 'Tables', f));
  loadQuestTables(sources);
}
const CORPUS = {};
for (const f of readdirSync(join(VENDOR, 'Quests'))) CORPUS[f.replace(/\.txt$/i, '')] = readQ(join(VENDOR, 'Quests', f)).split(/\r?\n/);
// test/disc28_quest.test.js's own: a reward and an end in one task, and a `get item` beside it
CORPUS.__FN = ['Quest: __FN', 'QRC:', 'Message:  1011', ' a reward', '', 'QBN:', 'Item _reward_ gold', 'Item _pkg_ letter', '',
  '_t_ task:', ' give pc _reward_', ' end quest', '', '_g_ task:', ' get item _pkg_', '', 'variable _pad_'];
const lists = { findQuestMeta: () => null, hasAcceptedOneTime: () => false, markOneTimeAccepted() {} };
const quiet = (fn) => { const w = console.warn, l = console.log, i = console.info; console.warn = () => {}; console.log = () => {}; console.info = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; console.info = i; } };
const sym = (q, name) => [...q.tasks.values()].find((t) => t.symbol?.name === name.replace(/_/g, ''))?.symbol;
const run = (m, n = 4) => { for (let i = 0; i < n; i++) m.tick(); };

/** A machine whose every reward door is counted: the reward offer, the items handed, reputation, the notebook. */
function machine(world = null, now = () => 0) {
  const m = new QuestMachine({
    nowSeconds: now, showPopup() {}, world, lastNPCClicked: () => m.clicked ?? null,
    getQuestSourceLines: (n) => CORPUS[n] ?? null,
    offerReward: () => { m.rewards = (m.rewards ?? 0) + 1; },
    giveItemToPlayer: (it) => { (m.given ??= []).push(it); },
    changeReputation: (fid, amount) => { (m.rep ??= []).push([fid, amount]); },
    addFinishedQuest: () => { m.notebook = (m.notebook ?? 0) + 1; },
  });
  return m;
}

// ---- a one-town world (test/disc28_quest.test.js's fixture) for the vendored quests that name a house ----
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

// ---- THE HOST: world.js's quest-share arm, lifted verbatim ----
const W = rd('src/scenes/world.js');
/** A statement out of `src` from `marker` (which ends on its opening brace) to that brace's close - `const x = () => {`,
 *  `x.y = (a) => {`, `const x = {` - with the `;` that ends it. Strings and line comments are skipped. */
function lift(src, marker) {
  const at = src.indexOf(marker);
  assert.ok(at >= 0 && marker.endsWith('{'), `world.js carries ${marker}`);
  let i = at + marker.length - 1, depth = 0, q = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue; }
    if (c === "'" || c === '"') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) break;
  }
  return src.slice(at, i + 1) + ';';
}
const makeHost = new Function('d', `
  const { questBridge, _questSyncSeen, partyMembersHere, prepareShareData, socialLink, performance, QUEST_SYNC_CHECK_MS,
    shareSignature, prepareQuestShare, link, social, receiveSharedQuest, activeMemberships, playerEntity, _questSharer,
    setMidScreenText, sayShareRefusal, _questRefusalSaid, shareRefusalText, SHARE_REFUSAL_TEXT } = d;
  let _questSyncCheckAt = -Infinity;
  ${lift(W, 'const questSyncTick = () => {')}
  ${lift(W, 'const shareQuestWithParty = (uid, questName, displayName) => {')}
  ${lift(W, 'link.onQuestShared = (acct, name, quest) => {')}
  return { questSyncTick, shareQuestWithParty };
`);

/** One player: a real OnlineSession on the hub (its client floor, its inbound gates), a real machine, and the host's
 *  own three closures over them. `party` is the account list (mutable: a member may join later). */
function seat(acct, clock, party, { world = null, gameNow = () => 0 } = {}) {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: acct, id: `peer-${acct}`, secret: `secret-of-peer-${acct}`, WebSocketImpl: FakeWS,
    now: () => clock.t, presence: false, acct, asecret: `secret-of-${acct}` });
  quiet(() => { s.join(CHAT_WORLD_ROOM, null); sockets[0].open(); sockets[0].receive({ t: 'welcome', id: `peer-${acct}`, peers: [], n: 1 }); });
  const m = machine(world, gameNow);
  const said = [];
  const host = makeHost({
    questBridge: { machine: m, questLists: lists }, _questSyncSeen: new Map(),
    partyMembersHere: () => party.filter((a) => a !== acct).map((a) => ({ acct: a })),
    prepareShareData: QS.prepareShareData, socialLink: () => s, performance: { now: () => clock.t }, QUEST_SYNC_CHECK_MS: 2000,
    shareSignature: QS.shareSignature, prepareQuestShare: QS.prepareQuestShare, link: s,
    social: { inMyParty: (a) => party.includes(a) }, receiveSharedQuest: QS.receiveSharedQuest,
    activeMemberships: () => ({}), playerEntity: {}, _questSharer: new Map(), setMidScreenText: (t) => said.push(t),
    sayShareRefusal: QS.sayShareRefusal, _questRefusalSaid: new Set(), shareRefusalText: QS.shareRefusalText, SHARE_REFUSAL_TEXT: QS.SHARE_REFUSAL_TEXT,
  });
  let read = 0;
  return {
    acct, m, said, s, sockets,
    sync: () => quiet(() => host.questSyncTick()),
    share: (uid) => quiet(() => host.shareQuestWithParty(uid, null, null)),
    outbox() { const out = sockets[0].sent.slice(read).map((x) => JSON.parse(x)).filter((f) => f.t === 'quest'); read = sockets[0].sent.length; return out; },
    deliver: (from, quest) => quiet(() => sockets[0].receive({ t: 'quest', acct: from, name: from, quest })),
  };
}
/** The hub: every quest frame a seat wrote goes to every other seat. Answers what moved. */
function pump(seats) {
  const moved = [];
  for (const a of seats) for (const f of a.outbox()) {
    moved.push({ from: a.acct, final: f.quest?.data?.final === 1 });
    for (const b of seats) if (b !== a) b.deliver(a.acct, f.quest);
  }
  return moved;
}
const refusals = (s) => s.said.filter((t) => / tried to share /.test(t));
/** The Exterminator (vendored A0C00Y07), taken by `A` at a faction for its reputation, and shared with the others. */
function exterminator(A, others) {
  A.m.clicked = { factionID: 510, nameSeed: 4242, gender: 0 };
  const q = quiet(() => { const x = A.m.scheduleQuest(CORPUS.A0C00Y07, 510, { rolls: () => 0.4 }); A.m.tick(); A.m.tick(); return x; });
  A.share(q.uid); pump([A, ...others]);
  return q;
}
/** A copy's vermin dead and its questor clicked - `give pc _gold_` + `end quest` (`_pcgetsgold_`); `ticks` machine ticks. */
function deliver(m, q, ticks) {
  quiet(() => { q.startTask(sym(q, '_S.03_')); m.tick(); q.startTask(sym(q, '_questdone_')); run(m, ticks); });
}

test('AUDIT DISC28 QS-1: a final the client\'s floor refused waits for it and goes - The Exterminator\'s receiver ends with its sharer, paid once', () => {
  const clock = { t: 1e6 };
  const party = ['acct-a', 'acct-r'];
  const A = seat('acct-a', clock, party, { world: town() }), R = seat('acct-r', clock, party, { world: town() });
  const q = exterminator(A, [R]);
  const r = R.m.sharedCandidateNamed('A0C00Y07');
  assert.ok(r, 'the share landed');
  clock.t += 60000;
  quiet(() => { q.startTask(sym(q, '_S.03_')); A.m.tick(); });   // the vermin fall: a sync leaves
  A.sync();
  assert.equal(pump([A, R]).length, 1, 'the kill synced');
  clock.t += 3000;
  quiet(() => { q.startTask(sym(q, '_questdone_')); run(A.m, 4); });   // three seconds on, the questor: rewarded, ended
  assert.equal(q.questTombstoned, true);
  const finals = [];
  for (let i = 0; i < 15; i++) { A.sync(); finals.push(...pump([A, R]).filter((x) => x.final)); quiet(() => run(R.m, 10)); clock.t += 1000; }
  assert.equal(finals.length, 1, 'the final went, once, when the floor opened');
  assert.equal(r.questTombstoned, true, 'and the receiver\'s copy ended with it');
  assert.equal(R.m.rewards, 1, 'its reward paid, once');
  assert.equal(A.m.nextFinishedShare(), null, 'settled');
});

test('AUDIT DISC28 QS-1/QS-5: nothing is synced from the sharer\'s grace (its reward window up) - the final goes, and a member who joined later is handed nothing', () => {
  const clock = { t: 1e6 };
  const party = ['acct-a', 'acct-r'];
  const A = seat('acct-a', clock, party, { world: town() }), R = seat('acct-r', clock, party, { world: town() });
  const q = exterminator(A, [R]);
  const r = R.m.sharedCandidateNamed('A0C00Y07');
  clock.t += 120000;
  party.push('acct-c');
  const C = seat('acct-c', clock, party, { world: town() });
  deliver(A.m, q, 1);   // the reward window opens; the machine waits under it (world.js ticks it with no overlay up)
  assert.ok(q.ticksToEnd > 0 && !q.questComplete, 'in grace');
  const inGrace = [];
  for (let i = 0; i < 6; i++) { clock.t += 1000; A.sync(); inGrace.push(...pump([A, R, C])); quiet(() => { run(R.m, 10); run(C.m, 10); }); }
  assert.deepEqual(inGrace, [], 'no ordinary sync of an ending copy');
  quiet(() => run(A.m, 3));   // the window closes
  for (let i = 0; i < 12; i++) { A.sync(); pump([A, R, C]); quiet(() => { run(R.m, 10); run(C.m, 10); }); clock.t += 1000; }
  assert.equal(r.questTombstoned, true, 'the receiver\'s copy ended with its sharer\'s');
  assert.equal(R.m.rewards, 1);
  assert.equal(C.m.sharedCandidateNamed('A0C00Y07'), null, 'the member who joined later holds no copy');
  assert.equal(C.m.rewards ?? 0, 0, 'and was paid nothing');
  assert.deepEqual(C.said, [], 'and told nothing');
});

test('AUDIT DISC28 QS-5: an envelope whose `end quest` has run makes no copy - a fresh receipt of an ending quest is \'finished\', said to nobody', () => {
  const A = machine(town());
  A.clicked = { factionID: 510, nameSeed: 4242, gender: 0 };
  const q = quiet(() => { const x = A.scheduleQuest(CORPUS.A0C00Y07, 510, { rolls: () => 0.4 }); A.tick(); A.tick(); return x; });
  A.markQuestShared('A0C00Y07');
  deliver(A, q, 1);   // mid-grace: questComplete false, EndQuest done
  const env = QS.prepareQuestShare(A, q.uid).data;
  assert.equal(env.questComplete, false);
  assert.equal(QS.shareEnvelopeEnding?.(env), true, 'the envelope carries its end');
  const C = machine(town());
  const got = quiet(() => QS.receiveSharedQuest(C, lists, 'A0C00Y07', env));
  assert.equal(got.reason, 'finished');
  assert.equal(C.sharedCandidateNamed('A0C00Y07'), null);
  assert.equal(C.rewards ?? 0, 0);
});

test('AUDIT DISC28 QS-2: the live-sync watch runs above the modal gate - one call for the exterior, the interior and the dungeon', () => {
  const frameAt = W.indexOf('  function frame(now) {');
  const modal = W.indexOf('    if (modes.frame(dt, now)) {', frameAt);
  const calls = [...W.matchAll(/^\s*questSyncTick\(\);/gm)].map((x) => x.index);
  assert.equal(calls.length, 1, 'one call');
  assert.ok(calls[0] > W.indexOf('    tickAmbientText();', frameAt) && calls[0] < modal, 'above the modal return, beside the ambient text');
  assert.ok(W.indexOf('    if (_mode() !== _torchesMode)', frameAt) < modal && W.indexOf('    if (_mode() !== _torchesMode)', frameAt) > calls[0], 'the torch sweep stays adjacent to the gate (AUDIT 66 F11)');
});

test('AUDIT DISC28 QS-3: finals that cross say nothing - two members who both delivered The Exterminator, and a timer that ran out in every world', () => {
  {
    const clock = { t: 1e6 };
    const party = ['acct-a', 'acct-r'];
    const A = seat('acct-a', clock, party, { world: town() }), R = seat('acct-r', clock, party, { world: town() });
    const q = exterminator(A, [R]);
    const r = R.m.sharedCandidateNamed('A0C00Y07');
    clock.t += 60000;
    deliver(A.m, q, 4); deliver(R.m, r, 4);   // both in the house, both hand it over; then both step out
    A.sync(); R.sync();
    assert.equal(pump([A, R]).filter((x) => x.final).length, 2, 'the finals crossed');
    assert.deepEqual([...refusals(A), ...refusals(R)], [], 'nobody is told they "already did" what they just did together');
    assert.equal(A.m.rewards + R.m.rewards, 2);
  }
  {
    const clock = { t: 1e6 };
    const game = { s: 1000 };
    const party = ['acct-a', 'acct-r'];
    const A = seat('acct-a', clock, party, { world: town(), gameNow: () => game.s });
    const R = seat('acct-r', clock, party, { world: town(), gameNow: () => game.s });
    const q = exterminator(A, [R]);
    const r = R.m.sharedCandidateNamed('A0C00Y07');
    clock.t += 60000;
    game.s += 86400 + 60;   // _oneday_ runs out in both worlds on the one shared clock
    quiet(() => { run(A.m, 4); run(R.m, 4); });
    assert.equal(q.questTombstoned && r.questTombstoned && !q.questSuccess, true, 'both failed');
    A.sync(); R.sync(); pump([A, R]);
    assert.deepEqual([...refusals(A), ...refusals(R)], []);
    assert.deepEqual([A.m.rep, R.m.rep], [[[510, -2]], [[510, -2]]], 'the failure charged once each');
  }
  {
    // a sync a member sent before the end reached them, landing on a copy the end has already closed: 'done', mine
    const clock = { t: 1e6 };
    const party = ['acct-a', 'acct-b', 'acct-c'];
    const [A, B, C] = party.map((a) => seat(a, clock, party, { world: town() }));
    const q = exterminator(A, [B, C]);
    const qb = B.m.sharedCandidateNamed('A0C00Y07'), qc = C.m.sharedCandidateNamed('A0C00Y07');
    clock.t += 60000;
    quiet(() => { qb.startTask(sym(qb, '_S.03_')); B.m.tick(); });
    B.sync();
    const lagging = B.outbox();
    assert.equal(lagging.length, 1, 'B\'s progress left');
    deliver(A.m, q, 4); A.sync();
    for (const f of A.outbox()) { B.deliver('acct-a', f.quest); C.deliver('acct-a', f.quest); }
    quiet(() => run(C.m, 6));
    assert.equal(qc.questTombstoned, true);
    for (const f of lagging) C.deliver('acct-b', f.quest);
    assert.deepEqual(refusals(C), [], 'a sync\'s \'done\' is my own finish - nothing to say');
  }
});

test('AUDIT DISC28 QS-3: the copy a partner\'s final ended never syncs back - its reward window up, it says nothing to the sharer', () => {
  const clock = { t: 1e6 };
  const party = ['acct-a', 'acct-r'];
  const A = seat('acct-a', clock, party, { world: town() }), R = seat('acct-r', clock, party, { world: town() });
  const q = exterminator(A, [R]);
  const r = R.m.sharedCandidateNamed('A0C00Y07');
  clock.t += 60000;
  deliver(A.m, q, 4); A.sync(); pump([A, R]);
  assert.ok(r.ticksToEnd > 0, 'the final ended it: grace');
  quiet(() => R.m.tick());   // its re-armed reward fires: the window opens and the machine waits
  const back = [];
  for (let i = 0; i < 4; i++) { clock.t += 1000; R.sync(); back.push(...pump([A, R])); }
  assert.deepEqual(back, [], 'nothing went back');
  assert.deepEqual(refusals(A), []);
  quiet(() => run(R.m, 3));
  assert.equal(r.questTombstoned, true);
  assert.equal(R.m.rewards, 1);
});

test('AUDIT DISC28 QS-4: a finishing envelope on a copy already ending changes nothing - The Exterminator\'s reputation and notebook entry are paid once', () => {
  const clock = { t: 1e6 };
  const party = ['acct-a', 'acct-r'];
  const A = seat('acct-a', clock, party, { world: town() }), R = seat('acct-r', clock, party, { world: town() });
  const q = exterminator(A, [R]);
  const r = R.m.sharedCandidateNamed('A0C00Y07');
  clock.t += 60000;
  deliver(A.m, q, 4);   // the sharer delivers inside the guild hall and walks out...
  deliver(R.m, r, 1);   // ...as the receiver delivers too: its reward window up, its copy in grace
  A.sync(); pump([A, R]);
  quiet(() => run(R.m, 4));
  assert.equal(r.questTombstoned, true);
  assert.deepEqual(R.m.rep, [[510, 5]], 'reputation, once');
  assert.equal(R.m.notebook, 1, 'the notebook entry, once');
  assert.equal(R.m.rewards, 1);
});

test('AUDIT DISC28 QS-4: a reward armed by one envelope and not yet run stays armed through the next - two members\' finals, and a lagging sync', () => {
  const three = () => {
    const clock = { t: 1e6 };
    const party = ['acct-a', 'acct-b', 'acct-c'];
    const [A, B, C] = party.map((a) => seat(a, clock, party, { world: town() }));
    const q = exterminator(A, [B, C]);
    clock.t += 60000;
    return { A, B, C, q, qb: B.m.sharedCandidateNamed('A0C00Y07'), qc: C.m.sharedCandidateNamed('A0C00Y07') };
  };
  {
    const { A, B, C, q, qb, qc } = three();
    deliver(A.m, q, 4); deliver(B.m, qb, 4);
    A.sync(); B.sync(); pump([A, B, C]);   // two finals reach C before its machine ticks
    quiet(() => run(C.m, 6));
    assert.equal(qc.questTombstoned, true);
    assert.equal(C.m.rewards, 1, 'C\'s reward, paid');
    assert.deepEqual(C.m.rep, [[510, 5]]);
  }
  {
    const { A, B, C, q, qb, qc } = three();
    quiet(() => { qb.startTask(sym(qb, '_S.03_')); B.m.tick(); });   // B's vermin fall...
    deliver(A.m, q, 4);   // ...as A delivers
    A.sync(); B.sync();
    const fromA = A.outbox(), fromB = B.outbox();
    for (const f of fromA) C.deliver('acct-a', f.quest);   // A's final reaches C first,
    for (const f of fromB) C.deliver('acct-b', f.quest);   // then B's sync, sent before B heard of the end
    quiet(() => run(C.m, 6));
    assert.equal(qc.questTombstoned, true);
    assert.equal(C.m.rewards, 1, 'the lagging sync did not take the reward\'s task back');
  }
});

// ---- QS-J: the heir's law, over real encounter pools and world.js's own seam ----
function craftCfg() { const b = new Uint8Array(74); const v = new DataView(b.buffer); b[10] = 0x08; v.setUint16(52, 40, true); const at = [40, 50, 50, 85, 50, 50, 90, 55]; for (let k = 0; k < 8; k++) v.setUint16(58 + k * 2, at[k], true); return b; }
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18; const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true); let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let k = 0; k < name.length; k++) out[pos + k] = name.charCodeAt(k); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const settle = async () => { for (let k = 0; k < 5; k++) await new Promise((r) => setTimeout(r, 0)); };
const pe = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const PARTY = ['host-0001', 'amy-0003', 'cat-0004', 'aaa-0002', 'host-0005', 'zzz-0009'];
const makeSeam = new Function('d', `const { questShareTag, questPrivateTag, partyQuestFoe, questBridge, social, sharedQuestFoe, questBehaviourFor, adoptsOrphanQuestFoe, online, player, peersNear } = d;\n${lift(W, '  const questShareSeam = {')}\nreturn questShareSeam;`);
/** world.js's questShareSeam over `self`'s real machine - every other seat a party peer; `feet` where I stand and `near`
 *  the peers around me (the orphan law's view). */
const hostSeam = (self, m, { feet = [0, 0, 0], near = [] } = {}) => makeSeam({ questShareTag, questPrivateTag, partyQuestFoe, questBridge: { machine: m }, social: { party: {}, isPartyPeer: (id) => PARTY.includes(id) && id !== self },
  sharedQuestFoe, questBehaviourFor, adoptsOrphanQuestFoe, online: { id: self }, player: { feetAt: () => feet }, peersNear: () => near });
function pool(self, seam, { clock = { t: 0 }, staleMs = 0 } = {}) {
  const p = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {}, currentMinute: () => 0, currentPixelKey: () => '3,12',
    playerEntity: pe(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
  });
  p.setNet({ room: () => 'world:3,12', selfId: () => self, peers: () => [], now: () => clock.t, staleMs, onPeerHit: () => true, toWire: (f) => [f[0], f[1], f[2]], toScene: (x) => [x[0], x[1], x[2]] });
  p.setQuestShare(seam);
  return p;
}

test('AUDIT DISC28 QS-J: a quest foe handed to a party member with no linked copy is taken on the partner\'s word - it rides to the linked member, and a party member\'s blow lands on it', async () => {
  const A = machine(town()); A.clicked = { factionID: 510, nameSeed: 4242, gender: 0 };
  const q = quiet(() => { const x = A.scheduleQuest(CORPUS.A0C00Y07, 0, { rolls: () => 0.4 }); A.tick(); A.tick(); return x; });
  A.markQuestShared('A0C00Y07');
  const Amy = machine(town());
  assert.ok(quiet(() => QS.receiveSharedQuest(Amy, lists, 'A0C00Y07', QS.prepareQuestShare(A, q.uid).data)).ok, 'amy\'s copy is linked');
  const Cat = machine(town());   // cat never took it
  const foeSym = [...q.resources.values()].find((r) => r.isFoe).symbol;
  const host = pool('host-0001', { tagOf: (f) => (f.questBehaviour ? { q: 'A0C00Y07', s: foeSym.name } : null), accepts: () => true, partyPeer: () => true,
    peerMayHit: () => true, onPuppetHurt() {}, onPuppetDied() {}, behaviourFor: () => null, adoptsOrphan: () => false });
  const amy = pool('amy-0003', hostSeam('amy-0003', Amy)), cat = pool('cat-0004', hostSeam('cat-0004', Cat));
  const f = await host.spawnFoe(0, [100, 0, 100], { feetGiven: true, loose: true });
  f.questBehaviour = { questUID: q.uid, targetSymbol: foeSym, bindHost() {}, start() {}, update() {} };
  for (const x of [amy, cat]) quiet(() => x.applyFoes('host-0001', host.foesFrame(true)));
  await settle();
  assert.equal(cat.foes.filter((x) => x.puppet === 'host-0001').length, 1, 'DESYNC-ZERO (was DISC28-J): a copy with no link stands it too - every player in the room sees the foe the room fights');
  const handed = host.handOverFrame(() => 'cat-0004');   // world.js heirOf: the nearest party peer
  quiet(() => { amy.applyFoes('host-0001', handed); cat.applyFoes('host-0001', handed); });
  await settle();
  assert.equal(host.dropOwnLive(), 1, 'the owner let it go');
  const took = cat.foes.find((x) => !x.puppet && !x.dead);
  assert.ok(took, 'the heir took it');
  assert.deepEqual(took._keptTag, { q: 'A0C00Y07', s: foeSym.name }, 'on the partner\'s word');
  quiet(() => amy.applyFoes('host-0001', host.foesFrame(true)));
  quiet(() => amy.applyFoes('cat-0004', cat.foesFrame(true)));
  await settle();
  assert.equal(amy.foes.filter((x) => x.puppet === 'cat-0004' && !x.dead).length, 1, 'it rides to the linked member as the quest\'s');
  assert.equal(cat.applyHit('amy-0003', { i: took.seq, dmg: 5, kind: 'melee' }), true, 'a party member\'s blow lands on it');
  assert.equal(cat.applyHit('bob-0009', { i: took.seq, dmg: 5, kind: 'melee' }), true, 'DESYNC-ZERO: a stranger\'s lands too - the foe is the room\'s, the credit stays the party\'s');
});

/** The Exterminator (vendored A0C00Y07) taken by a sharer, linked to `linked` by a real share (`link` links another);
 *  its first Foe's symbol. */
function sharedExterminator(linked) {
  const A = machine(town()); A.clicked = { factionID: 510, nameSeed: 4242, gender: 0 };
  const q = quiet(() => { const x = A.scheduleQuest(CORPUS.A0C00Y07, 0, { rolls: () => 0.4 }); A.tick(); A.tick(); return x; });
  A.markQuestShared('A0C00Y07');
  const link = (m) => assert.ok(quiet(() => QS.receiveSharedQuest(m, lists, 'A0C00Y07', QS.prepareQuestShare(A, q.uid).data)).ok, 'linked');
  for (const m of linked) link(m);
  return { q, link, foeSym: [...q.resources.values()].find((r) => r.isFoe).symbol };
}
/** An owner's pool standing one foe of the shared quest at `at`. */
async function questOwner(id, q, foeSym, at = [100, 0, 100]) {
  const host = pool(id, { tagOf: (f) => (f.questBehaviour ? { q: 'A0C00Y07', s: foeSym.name } : null), accepts: () => true, partyPeer: () => true,
    peerMayHit: () => true, onPuppetHurt() {}, onPuppetDied() {}, behaviourFor: () => null, adoptsOrphan: () => false });
  const f = await host.spawnFoe(0, at, { feetGiven: true, loose: true });
  f.questBehaviour = { questUID: q.uid, targetSymbol: foeSym, bindHost() {}, start() {}, update() {} };
  return { host, f };
}
const HERE = [100, 0, 100];
const around = (self) => [{ id: 'aaa-0002', feet: HERE }, { id: 'zzz-0009', feet: HERE }].filter((p) => p.id !== self);

test('AUDIT DISC28 QS-J: the orphan law\'s pick with no linked copy takes the orphan from the record it kept - it stands for the party', async () => {
  const Zed = machine(town()), Aaa = machine(town());   // zzz's copy linked by the share; aaa never took the quest
  const { q, foeSym } = sharedExterminator([Zed]);
  const { host } = await questOwner('host-0005', q, foeSym);
  const aaa = pool('aaa-0002', hostSeam('aaa-0002', Aaa, { feet: HERE, near: around('aaa-0002') }));
  const zzz = pool('zzz-0009', hostSeam('zzz-0009', Zed, { feet: HERE, near: around('zzz-0009') }));
  for (const x of [aaa, zzz]) quiet(() => x.applyFoes('host-0005', host.foesFrame(true)));
  await settle();
  assert.equal(aaa.foes.filter((x) => x.puppet === 'host-0005').length, 1, 'DESYNC-ZERO (was DISC28-J): the unlinked member stands it too');
  assert.equal(zzz.foes.filter((x) => x.puppet === 'host-0005').length, 1, 'the linked member stands it');
  quiet(() => { aaa.pruneOwners(new Set()); zzz.pruneOwners(new Set()); });   // the owner gone without a word: the law names the lowest id near it
  await settle();
  const took = aaa.foes.find((x) => !x.puppet && !x.dead);
  assert.ok(took, 'the law\'s pick took it, from the record it kept');
  assert.deepEqual(took._keptTag, { q: 'A0C00Y07', s: foeSym.name }, 'on the partner\'s word');
  assert.equal(zzz.foes.filter((x) => !x.dead).length, 0, 'the member the law did not name let its puppet go, and took nothing');
  quiet(() => zzz.applyFoes('aaa-0002', aaa.foesFrame(true)));
  await settle();
  assert.equal(zzz.foes.filter((x) => x.puppet === 'aaa-0002' && !x.dead).length, 1, 'it stands for the party');
});

test('AUDIT DISC28 QS-J: a kept record goes as a stood one goes - a full frame that no longer names it, its death, a heir named elsewhere, a quiet owner, a room change, a stranger\'s; bounded as a stood copy is; it never stands, credits a kill, or outlives its owner\'s return', async () => {
  const { q, link, foeSym } = sharedExterminator([]);
  /** An unlinked party member's pool that heard `owner`'s frame (then `drop`), and the owner then gone: what it took. */
  const kept = async (drop = () => {}, { owner = 'host-0005', self = 'aaa-0002', near = around(self), m = machine(town()) } = {}) => {
    const clock = { t: 0 };
    const { host } = await questOwner(owner, q, foeSym);
    const seam = hostSeam(self, m, { feet: HERE, near });
    const died = [], die = seam.onPuppetDied;
    seam.onPuppetDied = (t, ...a) => { if (partyQuestFoe(m, t)) died.push(t); return die(t, ...a); };   // DESYNC-ZERO: it stands now and may fall here - a copy with no such quest counts nothing off it
    const me = pool(self, seam, { clock, staleMs: 6000 });
    const fr = host.foesFrame(true);
    quiet(() => me.applyFoes(owner, fr));
    await settle();
    assert.equal(me.foes.filter((x) => x.puppet === owner && !x.dead).length, owner === 'host-0005' ? 1 : 1, 'DESYNC-ZERO: stood - every player sees it');
    await drop(me, fr, clock);
    quiet(() => me.pruneOwners(new Set(), clock.t));
    await settle();
    assert.deepEqual(died, [], 'a kept record credits no kill');
    return me.foes.filter((x) => !x.dead);
  };
  const word = (me, fr, over) => quiet(() => me.applyFoes('host-0005', { ...fr, n: fr.n + 1, ...over }));
  assert.equal((await kept()).length, 1, 'kept, then taken by the law (the control)');
  const merged = await kept((me, fr) => word(me, fr, { full: 0, f: [{ i: fr.f[0].i, h: 7 }] }));
  assert.equal(merged.length, 1, 'a record that carries only what changed is merged over the last word');
  assert.equal(merged[0].entity.health, 7, 'and taken as it stood last');
  assert.equal((await kept((me, fr) => word(me, fr, { f: [], qf: [] }))).length, 0, 'a full frame that no longer names it');
  assert.equal((await kept((me, fr) => word(me, fr, { full: 0, f: [{ ...fr.f[0], d: 1 }] }))).length, 0, 'its death');
  assert.equal((await kept((me, fr) => word(me, fr, { full: 0, f: [{ ...fr.f[0], e: 'zzz-0009' }] }))).length, 0, 'a handover naming another heir - that one takes it');
  assert.equal((await kept((me, fr, clock) => { clock.t = 7000; quiet(() => me.pruneOwners(new Set(['host-0005']), clock.t)); })).length, 0, 'an owner gone quiet (the stale sweep keeps nothing, adopts nothing)');
  assert.equal((await kept((me, fr) => { me.clearPuppets(); word(me, fr, { full: 0, f: [], qf: [] }); })).length, 0, 'a room change - the owner heard again in the new room, naming nothing');
  assert.equal((await kept(() => {}, { owner: 'bob-0007' })).length, 1, 'DESYNC-ZERO: a stranger\'s too - it stood here, and the room keeps it when its owner goes (it credits no kill: no copy holds it)');
  assert.equal((await kept(() => {}, { self: 'zzz-0009' })).length, 0, 'a member the law did not name');
  // a copy linked since stands it - the law takes that one, and that one alone
  const Aaa = machine(town());
  const once = await kept(async (me, fr) => { link(Aaa); word(me, fr, {}); await settle(); }, { m: Aaa });
  assert.equal(once.length, 1, 'one foe, not a second out of the record it kept before');
  assert.equal(once[0]._keptTag, undefined, 'bound to its own copy now');
  // no more of an owner's than a stood copy's allowance (QUEST_PUPPETS_MAX)
  {
    const { host } = await questOwner('host-0005', q, foeSym);
    const me = pool('aaa-0002', hostSeam('aaa-0002', machine(town()), { feet: HERE, near: [] }));
    const fr = host.foesFrame(true);
    const f = Array.from({ length: QUEST_PUPPETS_MAX + 2 }, (_, k) => ({ ...fr.f[0], i: 100 + k }));
    quiet(() => me.applyFoes('host-0005', { ...fr, f, qf: f.map((r) => [r.i, ...fr.qf[0].slice(1)]) }));
    await settle();   // DESYNC-ZERO: stood, as every copy stands them
    assert.equal(me.foes.filter((x) => x.puppet && !x.dead).length, QUEST_PUPPETS_MAX, 'stood under the quest allowance');
    quiet(() => me.pruneOwners(new Set()));
    await settle();
    assert.equal(me.foes.filter((x) => !x.dead).length, QUEST_PUPPETS_MAX, 'bounded as a stood copy is');
  }
  // its owner back under the same id, streaming it alive: DESYNC-ZERO - it stands here as its puppet, never twice
  {
    const { host } = await questOwner('host-0005', q, foeSym);
    const me = pool('aaa-0002', hostSeam('aaa-0002', machine(town()), { feet: HERE, near: [] }));
    quiet(() => me.applyFoes('host-0005', host.foesFrame(true)));
    await settle();
    quiet(() => { me.pruneOwners(new Set()); me.applyFoes('host-0005', host.foesFrame(true)); });   // gone, and its owner back
    await settle();
    assert.equal(me.foes.filter((x) => !x.dead).length, 1, 'one foe here, not a second');
    quiet(() => me.pruneOwners(new Set()));
    await settle();
    const took = me.foes.find((x) => !x.puppet && !x.dead);
    assert.ok(took, 'the law\'s pick takes it when its owner goes again');
    quiet(() => me.applyFoes('host-0005', host.foesFrame(true)));
    await settle();
    assert.equal(took.dead && took._gone, true, 'theirs again (AUDIT pre-merge D2) - mine let go, no death, no body');
    assert.equal(me.foes.filter((x) => !x.dead).length, 1, 'and stood once, as its owner\'s');
  }
});

test('AUDIT DISC28 QS-1: a final the hub refuses as \'busy\' goes back on the machine and goes again - never for a terminal refusal, a late word, or an ordinary sync', () => {
  const wireBusy = new Function('d', `const { link, questBridge } = d;\n${lift(W, 'link.onQuestBusy = (quest) => {')}\nreturn link.onQuestBusy;`);
  const hubSays = (x, m) => quiet(() => x.sockets[0].receive({ t: 'social', k: 'error', m }));
  const setup = () => {
    const clock = { t: 1e6 };
    const party = ['acct-a', 'acct-r'];
    const A = seat('acct-a', clock, party, { world: town() }), R = seat('acct-r', clock, party, { world: town() });
    wireBusy({ link: A.s, questBridge: { machine: A.m } });
    const q = exterminator(A, [R]);
    clock.t += 60000;
    return { clock, A, R, q, r: R.m.sharedCandidateNamed('A0C00Y07') };
  };
  {
    const { clock, A, R, q, r } = setup();
    deliver(A.m, q, 4);
    A.sync();
    assert.equal(A.outbox().filter((f) => f.quest.data.final === 1).length, 1, 'the final left...');   // ...and the hub dropped it
    hubSays(A, 'busy');
    assert.ok(A.m.nextFinishedShare(), 'the hub said busy: it is back on the machine');
    for (let i = 0; i < 12; i++) { clock.t += 1000; A.sync(); pump([A, R]); quiet(() => run(R.m, 10)); }
    assert.equal(r.questTombstoned, true, 'it went again when the floor opened, and the receiver\'s copy ended');
    assert.equal(R.m.rewards, 1);
    assert.equal(A.m.nextFinishedShare(), null);
  }
  for (const [word, late, load] of [['no account', 0], ['busy', 6000], ['busy', 0, true]]) {
    const { clock, A, q } = setup();
    deliver(A.m, q, 4);
    A.sync(); A.outbox();
    clock.t += late;
    if (load) A.m.clearState();
    hubSays(A, word);
    assert.equal(A.m.nextFinishedShare(), null, `${word}${late ? ', said after the hub\'s own cooldown' : ''}${load ? ', said after a load' : ''}: nothing to try again`);
  }
  {
    // the vermin's sync leaves, the questor is clicked a second later - and the hub's 'busy' is that SYNC's
    const { clock, A, R, q, r } = setup();
    quiet(() => { q.startTask(sym(q, '_S.03_')); A.m.tick(); });
    A.sync();
    assert.equal(A.outbox().length, 1, 'an ordinary sync left...');   // ...and the hub dropped it
    clock.t += 1000;
    quiet(() => { q.startTask(sym(q, '_questdone_')); run(A.m, 4); });
    hubSays(A, 'busy');
    for (let i = 0; i < 12; i++) { clock.t += 1000; A.sync(); pump([A, R]); quiet(() => run(R.m, 10)); }
    assert.equal(r.questTombstoned, true, 'the final went when the floor opened - not the sync put back as one');
    assert.equal(R.m.rewards, 1, 'and it paid the receiver');
    assert.equal(A.m.nextFinishedShare(), null);
  }
});

test('AUDIT DISC28 QS-K1: the re-stamp moves the name alone - the town map\'s rename and the lockpick record stand; the player\'s own house is never renamed', () => {
  const LOC = '0:Bigtown', KEY = 77;
  const house = { buildingKey: KEY, name: 'Residence', buildingType: BUILDING_TYPES.House1, factionId: 0, quality: 5 };
  const job = (name, owned = false) => ({ currentMapID: () => 111, ownsHouse: (k) => owned && k === KEY,
    isBuildingQuestResource: (m, k) => (m === 111 && k === KEY ? { isQuestResource: true, pcLearnedAboutExistence: true, overrideBuildingName: name } : null) });
  discovery.restoreDiscovery(null);
  discovery.discoverBuilding(LOC, house, null, job('The Selvani Residence'));
  discovery.setDiscoveredBuildingCustomName(LOC, KEY, 'Rat house');
  discovery.setLastLockpickAttempt(LOC, KEY, 45);
  assert.equal(discovery.discoverBuilding(LOC, house, null, job('The Direnni Residence')), true, 'the later job\'s name');
  const rec = discovery.getDiscoveredBuilding(LOC, KEY);
  assert.deepEqual([rec.displayName, rec.oldDisplayName, rec.isOverrideName], ['The Direnni Residence', 'Residence', true]);
  assert.equal(rec.customUserDisplayName, 'Rat house', 'the player\'s own rename stands');
  assert.equal(discovery.getLastLockpickAttempt(LOC, KEY), 45, 'and the anti-grind record');
  // the purchase's override (banking.js, DaggerfallBankManager's "<name>'s residence"), and a partner's shared job on it
  discovery.restoreDiscovery(null);
  discovery.discoverBuilding(LOC, { buildingKey: KEY, buildingType: BUILDING_TYPES.House1 }, "Mac's residence");
  assert.equal(discovery.discoverBuilding(LOC, house, null, job('The Direnni Residence', true)), false, 'never the player\'s own house');
  discovery.undiscoverBuilding(LOC, KEY, true, 'The Direnni Residence');   // that job's tombstone (Quest.cs's undiscover)
  assert.equal(discovery.getDiscoveredBuilding(LOC, KEY)?.displayName, "Mac's residence", 'and so never undiscovered by it');
  assert.match(W, /ownsHouse: \(buildingKey\) => isHouseOwned\(playerEntity\.houses \?\? \[\], _questRegionIndex\(\), buildingKey\),/, 'the host\'s one quest source carries IsHouseOwned');
});

test('AUDIT DISC28 QS-K2: the town plan opened on arrival names the house for the live job, not the one before', () => {
  const FAKE_BLOCK = { x: 1, y: 0, dfBlock: { rmbBlock: { fldHeader: { numBlockDataRecords: 2, buildingDataList: [
    { buildingType: 9, nameSeed: 1, factionId: 0, quality: 10 }, { buildingType: 17, nameSeed: 2, factionId: 0, quality: 4 }] },
  subRecords: [{ xPos: 2048, zPos: 1024, yRotation: 0, exterior: { block3dObjectRecords: [] }, interior: {} },
    { xPos: 512, zPos: 3072, yRotation: 0, exterior: { block3dObjectRecords: [] }, interior: {} }] } } };
  const LOC = 'r:town', MAP = 111;
  discovery.restoreDiscovery(null);
  const summaries = buildingSummaries([{ buildingType: 9, nameSeed: 1, factionId: 0, quality: 10 }], [FAKE_BLOCK], {});
  const KEY = summaries.find((b) => b.isResidence).buildingKey;
  const job = (name) => ({ currentMapID: () => MAP, ownsHouse: () => false, isBuildingQuestResource: (m, k) => (m === MAP && k === KEY
    ? { isQuestResource: true, pcLearnedAboutExistence: true, locationWasMarkedOnMapByNPC: false, overrideBuildingName: name } : { isQuestResource: false }) });
  discovery.discoverBuilding(LOC, { buildingKey: KEY, name: 'Residence', buildingType: 17 }, null, job('The Selvani Residence'));   // the job before
  const live = job('The Direnni Residence');   // the live job, learned in the guild's town; the player arrives and opens the plan
  discovery.restampQuestNames?.(LOC, live);   // world.js toggleExteriorAutomap's open
  const w = new ExteriorAutomapWindow({ locationName: 'T', locationId: LOC, gridW: 2, gridH: 2, blocks: [], playerPos: () => [102.4, 0, 102.4], playerYaw: () => 0,
    locOrigin: [0, 0, 0], isCustomLocation: false, arrowMesh: () => null, compassArt: null,
    buildings: () => stampResidenceQuestNames(summaries.map((s) => ({ ...s })), discovery.discoveredBuildings(LOC), { getAllActiveQuestIds: () => [] }, MAP),
    directory: () => [], discovered: () => discovery.discoveredBuildings(LOC) });
  const plate = quiet(() => w.buildPlates({ fnt: { fixedWidth: 6, fixedHeight: 6, glyphWidth: () => 5 } }, { s: 3, ox: 0, oy: 0 })).find((p) => p.buildingKey === KEY);
  assert.equal(plate?.text, 'The Direnni Residence');
  const open = W.indexOf('  const toggleExteriorAutomap = () => {');
  const stamp = W.indexOf('    restampQuestNames(locId, { ...questBuildingSource, currentMapID: () => dfLoc.mapTableData?.mapId ?? 0 });', open);
  assert.ok(open > 0 && stamp > open && stamp < W.indexOf('    stampResidenceQuestNames(summaries, discoveredBuildings(locId), {', open), 'the host re-stamps before the plates are built');
});

test('AUDIT DISC28 QS-D: the lock ladder\'s contract names DFU\'s rung - every Place of every incomplete quest, not the site links', () => {
  const b = rd('src/systems/buildingLocks.js');
  assert.doesNotMatch(b, /isActiveQuestBuilding\(building\) - the siteLinks walk/);
  assert.match(b, /isActiveQuestBuilding\(building\) - PlayerActivate\.IsActiveQuestBuilding/);
});
