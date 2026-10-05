// VERMIN-SHARED (FIELD BUGS 2026-10-03b; Discord #bug-reports, "Spiders aren't spawning for shared exterminator quest":
// "Every time we look around inside the guild nothing seems to have spawned, even though the first spider did spawn and
// we killed it"). The Exterminator (vendored A0C00Y07) picks its vermin once, at the house (`pick one of _S.04_ _S.05_
// _S.06_ _S.07_`), and each copy of a shared quest rolled its own: the resync (machine.updateSharedQuest) takes the
// partner's task flags whole while the pick stays complete, so two copies that rolled apart traded their picks at every
// crossing sync - and a kill is counted on both copies at once, so every kill crossed. The receiver's copy, meanwhile,
// counted its wave as placed whenever the sharer stood near (scenes/world.js tryPlaceFoe), whatever the sharer's copy
// was standing: the spider wave lived in the receiver's copy and was thrown away there. Now a copy kept in step with the
// party draws the share's roll (actions.js sharedPickRoll - the same task in every copy), and the receiver defers only
// to a foe of the sharer's of the wave's own Foe standing in its pool; otherwise it stands its own, as CreateFoe always
// places (CreateFoe.cs:183-212).
//
// Driven through the real QuestMachine, the real share path (systems/questShare.js), the real OnlineSession with its
// client floor, world.js's own questSyncTick / shareQuestWithParty / onQuestShared / questShareSeam and both
// tryPlaceFoe partner calls lifted verbatim out of the host, and two real encounter pools streaming to each other.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import * as ACTIONS from '../src/systems/quest/actions.js';   // sharedPickRoll - read off the module, so each pin here stands or falls alone
import * as QS from '../src/systems/questShare.js';
import { mapPixelToWorldCoord } from '../src/formats/mapsFile.js';
import { OnlineSession } from '../src/net/online.js';
import { CHAT_WORLD_ROOM } from '../src/net/wire.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { questShareTag, sharedQuestFoe, questBehaviourFor, adoptsOrphanQuestFoe, partnerStandsQuestFoes, mintQuestFoeWave, KeptKillLedger } from '../src/scenes/questFoeHost.js';
import { fakeSocketClass } from './fakeSocket.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = join(ROOT, 'vendor', 'dfu-quests');
const readQ = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readQ(join(VENDOR, 'Tables', f));
  loadQuestTables(sources);
}
const CORPUS = {};
for (const f of readdirSync(join(VENDOR, 'Quests'))) CORPUS[f.replace(/\.txt$/i, '')] = readQ(join(VENDOR, 'Quests', f)).split(/\r?\n/);
const lists = { findQuestMeta: () => null, hasAcceptedOneTime: () => false, markOneTimeAccepted() {} };
const quiet = (fn) => { const w = console.warn, l = console.log, i = console.info; console.warn = () => {}; console.log = () => {}; console.info = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; console.info = i; } };
const settle = async () => { for (let k = 0; k < 6; k++) await new Promise((r) => setTimeout(r, 0)); };

const QUEST = 'A0C00Y07';
/** The share's identity the pins mint (Quest.shareId; machine.getShareableQuestData keeps one already stamped): its roll
 *  for `_pickspawn_`'s one action falls on `_S.07_`, the spiders - checked against sharedPickRoll itself below. */
const SHARE_ID = 'vermin-7';
const PICKS = ['S.04', 'S.05', 'S.06', 'S.07'];   // bats, rats, scorpions, spiders (A0C00Y07:139-140, :150-168)
/** Two picks in one task (the corpus has none; the seed's task name and place are pinned through it). */
const TWO_PICKS = ['Quest: __PK', 'QRC:', '', 'QBN:', 'variable _a_', 'variable _b_', 'variable _c_', 'variable _d_', '',
  '_t_ task:', ' pick one of _a_ _b_', ' pick one of _c_ _d_', '', 'variable _pad_'];

// ---- a one-town world (test/auditdisc28_quests.test.js's fixture), its player in or out of the house ----
const flat = (record) => ({ textureArchive: 199, textureRecord: record, xPos: 40, yPos: 8, zPos: 60 });
const building = (buildingType) => ({ buildingType, factionId: 0, nameSeed: 777, locationId: 0, sector: 0, quality: 9 });
const FACTIONS = new Map([[510, { id: 510, type: 2, name: 'The Merchants', race: -1 }], [201, { id: 201, type: 15, name: 'People of Testshire', race: -1 }], [867, { id: 867, type: 14, name: 'Court of Testshire', race: -1 }]]);
function town(seat) {
  const buildings = [building(17), building(17), building(17)];
  const block = { position: 5000, rmbBlock: { fldHeader: { buildingDataList: buildings, otherNames: null }, subRecords: buildings.map(() => ({ interior: { blockFlatObjectRecords: [flat(11), flat(18)] } })) } };
  const w0 = mapPixelToWorldCoord(100, 100);
  const loc = { loaded: true, regionIndex: 0, regionName: 'Testshire', name: 'Bigtown', locationIndex: 0, hasDungeon: false, mapTableData: { mapId: 111, locationType: 0, dungeonType: -1 },
    exterior: { buildings, recordElement: { header: { x: w0.x, y: w0.y } }, exteriorData: { locationId: 0x400, width: 1, height: 1, blockNames: ['TESTAA00.RMB'] } }, dungeon: null };
  const region = { name: 'Testshire', locationCount: 1, mapTable: [{ mapId: 111, locationType: 0, dungeonType: -1 }] };
  return {
    maps: { regionCount: 1, getRegion: () => region, getLocation: () => loc, getLocationByName: () => loc, getRmbBlockName: () => 'TESTAA00.RMB', readLocationIdFast: () => 0x400, getClimateIndex: () => 231 },
    getBlock: () => block, currentLocation: () => loc, currentRegionIndex: () => 0, currentLocationIndex: () => 0,
    isPlayerInLocationRect: () => true, isHouseOwned: () => false, playerPixel: () => ({ x: 100, y: 100 }), buildingNameOpts: () => ({}),
    playerInside: () => (seat.inside != null ? { building: { buildingKey: seat.inside, name: 'The Mages Guild' } } : null),
    getFactionData: (id) => FACTIONS.get(id) ?? null, findFactionsOfType: (t) => [...FACTIONS.values()].filter((f) => f.type === t),
    currentRegionPeople: () => 201, currentRegionCourt: () => 867, currentRegionFaction: () => 201, currentRegionVampireClan: () => 0, playerVampireClan: () => 0, currentRegionRace: () => 3,
    // B1's two spawn seams, as world.js answers them: GameObjectHelper's mint, and the placement
    createFoeGameObjects: (foe, count) => mintQuestFoeWave(seat.m, foe, count),
    tryPlaceFoe: (handle) => seat.place(handle),
    raiseOnEncounterEvent: () => {},
  };
}

// ---- THE HOST: world.js's quest-share arm and both tryPlaceFoe partner calls, lifted verbatim ----
const W = readFileSync(join(ROOT, 'src/scenes/world.js'), 'utf8');
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
const makeSeam = new Function('d', `const { questShareTag, questBridge, social, sharedQuestFoe, keptKills, questBehaviourFor, adoptsOrphanQuestFoe, online, player, peersNear } = d;\n${lift(W, '  const questShareSeam = {')}\nreturn questShareSeam;`);
/** world.js's two partner calls - the open air's and the room's - each its own argument list, verbatim. */
const callOf = (re) => { const m = re.exec(W); assert.ok(m, `world.js carries ${re}`); return m[1]; };
const OUTDOOR = callOf(/\n {6}if \(partnerStandsQuestFoes\((\{[^\n]*\})\)\) return true;/);
const INDOOR = callOf(/isWorldRoom\(online\.room\) && partnerStandsQuestFoes\((\{[^\n]*\})\)\) return true;/);
const defers = new Function('d', `const { partnerStandsQuestFoes, handle, _liveSharer, social, peersNear, player, feet, exteriorFoes, modes } = d;
  return { outdoor: partnerStandsQuestFoes(${OUTDOOR}), indoor: partnerStandsQuestFoes(${INDOOR}) };`);

// ---- two real encounter pools on a synthetic MONSTER.BSA (the QS-J rig), one per player ----
function craftCfg() { const b = new Uint8Array(74); const v = new DataView(b.buffer); b[10] = 0x08; v.setUint16(52, 40, true); const at = [40, 50, 50, 85, 50, 50, 90, 55]; for (let k = 0; k < 8; k++) v.setUint16(58 + k * 2, at[k], true); return b; }
function craftMonsterBsa(names) {
  const NAME_FIELD = 14, ENTRY = 18, recs = names.map((n) => [n, craftCfg()]);
  const dataLen = recs.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * recs.length); const v = new DataView(out.buffer);
  v.setInt16(0, recs.length, true); v.setUint16(2, 0x0100, true); let pos = 4;
  for (const [, bytes] of recs) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of recs) { for (let k = 0; k < name.length; k++) out[pos + k] = name.charCodeAt(k); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
const bsa = craftMonsterBsa(['ENEMY000.CFG', 'ENEMY003.CFG', 'ENEMY006.CFG', 'ENEMY020.CFG']);   // rats, bats, spiders, scorpions
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const pe = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
function pool(self, seam) {
  const p = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {}, currentMinute: () => 0, currentPixelKey: () => '3,12',
    playerEntity: pe(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
  });
  p.setNet({ room: () => 'interior:m111.5', selfId: () => self, peers: () => [], now: () => 0, staleMs: 0, onPeerHit: () => true, toWire: (f) => [f[0], f[1], f[2]], toScene: (x) => [x[0], x[1], x[2]] });
  p.setQuestShare(seam);
  return p;
}

// ---- one player: a real OnlineSession (its client floor), a real machine, the host's closures, a pool ----
const ACCT = { 'peer-acct-a': 'acct-a', 'peer-acct-r': 'acct-r' };
function party() {
  const clock = { t: 1e6, game: 5_000_000 };
  const accts = ['acct-a', 'acct-r'];
  const seat = (acct) => {
    const peer = `peer-${acct}`, other = accts.find((a) => a !== acct);
    const { FakeWS, sockets } = fakeSocketClass();
    const s = new OnlineSession({ url: 'wss://relay.test', name: acct, id: peer, secret: `secret-of-${peer}`, WebSocketImpl: FakeWS, now: () => clock.t, presence: false, acct, asecret: `secret-of-${acct}` });
    quiet(() => { s.join(CHAT_WORLD_ROOM, null); sockets[0].open(); sockets[0].receive({ t: 'welcome', id: peer, peers: [], n: 1 }); });
    const st = { acct, peer, inside: null, own: [], beside: [], defer: 0, sharer: new Map(), feet: [0, 0, 0] };
    const m = new QuestMachine({ nowSeconds: () => clock.game, showPopup() {}, world: town(st), lastNPCClicked: () => m.clicked ?? null, getQuestSourceLines: (n) => CORPUS[n] ?? null });
    const social = { party: {}, inMyParty: (a) => accts.includes(a), isPartyPeer: (id) => id === `peer-${other}`, accountOfPeer: (id) => ACCT[id] ?? null };
    const host = makeHost({ questBridge: { machine: m, questLists: lists }, _questSyncSeen: new Map(), partyMembersHere: () => [{ acct: other }],
      prepareShareData: QS.prepareShareData, socialLink: () => s, performance: { now: () => clock.t }, QUEST_SYNC_CHECK_MS: 2000,
      shareSignature: QS.shareSignature, prepareQuestShare: QS.prepareQuestShare, link: s, social, receiveSharedQuest: QS.receiveSharedQuest,
      activeMemberships: () => ({}), playerEntity: {}, _questSharer: st.sharer, setMidScreenText: () => {}, sayShareRefusal: QS.sayShareRefusal,
      _questRefusalSaid: new Set(), shareRefusalText: QS.shareRefusalText, SHARE_REFUSAL_TEXT: QS.SHARE_REFUSAL_TEXT });
    const seam = makeSeam({ questShareTag, questBridge: { machine: m }, social, sharedQuestFoe, keptKills: new KeptKillLedger(), questBehaviourFor, adoptsOrphanQuestFoe, online: { id: peer }, player: { feetAt: () => st.feet }, peersNear: () => [] });
    const p = pool(peer, seam);
    // world.js's _liveSharer (:16516), over this seat's machine and its sharer map
    const _liveSharer = (q) => (m.hasSharedQuestNamed(q) ? (st.sharer.get(q) ?? null) : null);
    let read = 0;
    Object.assign(st, { m, s, sockets, social, pool: p, _liveSharer,
      sync: () => quiet(() => host.questSyncTick()), share: (uid) => quiet(() => host.shareQuestWithParty(uid, null, null)),
      outbox() { const out = sockets[0].sent.slice(read).map((x) => JSON.parse(x)).filter((f) => f.t === 'quest'); read = sockets[0].sent.length; return out; },
      deliver: (from, quest) => quiet(() => sockets[0].receive({ t: 'quest', acct: from, name: from, quest })),
      /** world.js's two partner calls over this seat - its pool's records, its party, the other player beside it */
      defers: (handle, mode = 'interior') => defers({ partnerStandsQuestFoes, handle, _liveSharer, social, peersNear: () => [{ id: `peer-${other}`, feet: [3, 0, 0] }], player: { pos: st.feet }, feet: st.feet, exteriorFoes: { foes: p.foes }, modes: { insideFoes: () => p.foes.filter((f) => !f.dead) } })[mode === 'interior' ? 'indoor' : 'outdoor'],
      /** CreateFoe.TryPlacement through this seat's host: the party's law first (world.js:16073's), else the pool stands it */
      place: (handle) => {
        if (st.defers(handle)) { st.defer++; return true; }
        st.own.push(handle.foe.symbol.name);
        st.beside.push(p.foes.filter((f) => !f.dead && f.puppet && f._pupQuest?.s === handle.foe.symbol.name).length);
        p.spawnFoe(handle.foe.foeType, [10 + st.own.length, 0, 10], { feetGiven: true, questBehaviour: handle.behaviour });
        return true;
      },
    });
    return st;
  };
  const A = seat('acct-a'), R = seat('acct-r');
  const seats = [A, R];
  /** The hub: every quest frame a seat wrote goes to the other. */
  const pump = () => { for (const a of seats) for (const f of a.outbox()) for (const b of seats) if (b !== a) b.deliver(a.acct, f.quest); };
  /** The room's own lane both ways: each pool's frame stood (or let go) in the other's. */
  const stream = async () => { R.pool.applyFoes(A.peer, A.pool.foesFrame(true)); A.pool.applyFoes(R.peer, R.pool.foesFrame(true)); await settle(); };
  /** One real tenth of a second: 1.2 game seconds (the online 12x), a machine tick each. */
  const tick = () => { clock.t += 100; clock.game += 1.2; quiet(() => { A.m.tick(); R.m.tick(); }); };
  /** The sync a frame runs (questSyncTick above the modal gate), both seats, then the hub. */
  const sync = () => { A.sync(); R.sync(); pump(); };
  return { clock, A, R, pump, stream, tick, sync };
}
const copy = (s) => s.m.sharedCandidateNamed(QUEST);
const task = (q, n) => [...q.tasks.values()].find((t) => t.symbol?.name === n);
const pickOf = (q) => PICKS.filter((n) => task(q, n)?.triggered);
const foeRes = (q, n) => [...q.resources.values()].find((r) => r.isFoe && r.symbol?.name === n);
const live = (p, pred = () => true) => p.foes.filter((f) => !f.dead && pred(f));

/** The Exterminator taken by A (its questor at a faction), its copy's identity minted, shared to R at the questor's -
 *  both copies before the house, no pick yet in either. `rollsA`/`rollsR`: each copy's own quest rolls. */
function takeAndShare(P, { rollsA = () => 0.8, rollsR = () => 0.1 } = {}) {
  P.A.m.clicked = { factionID: 510, nameSeed: 4242, gender: 0 };
  const q = quiet(() => { const x = P.A.m.scheduleQuest(CORPUS[QUEST], 510, { rolls: rollsA }); P.A.m.tick(); P.A.m.tick(); return x; });
  q.shareId = SHARE_ID;
  P.A.share(q.uid); P.pump();
  const r = copy(P.R);
  assert.ok(r, 'the share landed');
  r.rolls = rollsR;
  assert.deepEqual([pickOf(q), pickOf(r)], [[], []], 'no pick yet: neither copy has been in the house');
  P.clock.t += 60_000;   // the walk to the house: every client floor open
  return { q, r, house: q.resources.get('house').siteDetails.buildingKey };
}

test('VERMIN-SHARED: two copies that would roll different vermin pick the same - the share\'s roll, in both; solo, and a copy no longer kept in step, keep the quest\'s own roll (DFU\'s Random.Range)', () => {
  assert.equal(PICKS[Math.floor(ACTIONS.sharedPickRoll(SHARE_ID, 'pickspawn', 0) * PICKS.length)], 'S.07', 'the pins\' share rolls the spiders (sharedPickRoll, the producer)');
  const P = party();
  const { q, r, house } = takeAndShare(P);
  // both walk in together - the two picks land inside one sync window, and each copy's envelope crosses the other's
  P.A.inside = house; P.R.inside = house;
  P.tick(); P.tick();   // `pc at` sets _S.01_; its task starts _pickspawn_, which picks
  assert.deepEqual(pickOf(q), ['S.07'], 'the sharer\'s copy picks the share\'s vermin (its own roll would have been the spiders too)');
  assert.deepEqual(pickOf(r), ['S.07'], 'and the receiver\'s - whose own roll (0.1) was the bats');
  for (let k = 0; k < 30; k++) { P.sync(); P.tick(); }
  assert.deepEqual([pickOf(q), pickOf(r)], [['S.07'], ['S.07']], 'the crossing syncs trade nothing: one vermin, both copies');
  // solo: the same quest never shared draws its own roll, as DFU's PickOneOf.Update does
  const S = party();
  S.A.m.clicked = { factionID: 510, nameSeed: 4242, gender: 0 };
  const solo = quiet(() => { const x = S.A.m.scheduleQuest(CORPUS[QUEST], 510, { rolls: () => 0.1 }); S.A.m.tick(); S.A.m.tick(); return x; });
  solo.shareId = SHARE_ID;   // a share id alone is no share (a copy shared once and since loaded, say)
  S.A.inside = solo.resources.get('house').siteDetails.buildingKey;
  S.tick(); S.tick();
  assert.deepEqual(pickOf(solo), ['S.04'], 'not kept in step with a party: the quest\'s own roll (0.1 - the bats), never the share\'s');
  // a later private instance of the same name beside a shared one (AUDIT Q7) is no shared copy either
  assert.equal(S.A.m._buildHooks().sharedCopy(solo), false);
  S.A.m.markQuestShared(QUEST);
  assert.equal(S.A.m._buildHooks().sharedCopy(solo), true, 'kept in step: the live copy of its name');
  assert.equal(S.A.m._buildHooks().sharedCopy({ questName: QUEST }), false, 'and only that copy');
  // two picks in one task draw two numbers - the task's name and each action's place in it are the seed's
  const T = party();
  const pk = quiet(() => { const x = T.A.m.scheduleQuest(TWO_PICKS, 0, { rolls: () => 0.1 }); T.A.m.tick(); return x; });
  pk.shareId = 'pk-1';
  T.A.m.markQuestShared('__PK');
  pk.startTask(task(pk, 't').symbol);
  quiet(() => { T.A.m.tick(); T.A.m.tick(); });
  const want = ['a', 'b'][Math.floor(ACTIONS.sharedPickRoll('pk-1', 't', 0) * 2)] + ['c', 'd'][Math.floor(ACTIONS.sharedPickRoll('pk-1', 't', 1) * 2)];
  assert.equal(want, 'bc', 'the pin\'s share draws apart for the two places');
  assert.deepEqual(['a', 'b', 'c', 'd'].filter((n) => task(pk, n)?.triggered), ['b', 'c'], 'each pick its own draw: _b_ and _c_ (its own roll, 0.1, would have taken _a_ and _c_)');
});

test('VERMIN-SHARED: The Exterminator shared and walked into together - the first spider stands at the sharer, is killed and counted on both copies, and the next wave is a spider again; no wave of the receiver\'s stands beside a live spider of the sharer\'s', async () => {
  const P = party();
  const { q, r, house } = takeAndShare(P);
  P.A.inside = house; P.R.inside = house;
  const stood = () => P.A.own.length + P.R.own.length;
  for (let k = 0; k < 600 && !stood(); k++) { P.tick(); P.sync(); await P.stream(); }
  await P.stream();
  assert.deepEqual([P.A.own, P.R.own], [['spiders'], []], 'the first wave is a spider, the sharer\'s');
  const spider = live(P.A.pool, (f) => !f.puppet)[0];
  assert.equal(live(P.R.pool, (f) => f.puppet === P.A.peer && f._pupQuest?.s === 'spiders').length, 1, 'riding to the receiver as the quest\'s');
  // killed: the sharer's own death door and the behaviour's count (QuestResourceBehaviour.update, the pool's frame), the
  // receiver's off the puppet's fall (onPuppetDied)
  spider.questBehaviour.host.enemy.setCurrentHealth(0);
  spider.questBehaviour.update(); spider.questBehaviour.update();
  await P.stream();
  assert.deepEqual([foeRes(q, 'spiders').killCount, foeRes(r, 'spiders').killCount], [1, 1], 'the kill counted on both copies');
  // both copies changed - the crossing syncs - and the next wave, three game minutes on (or the receiver's own, sooner)
  for (let k = 0; k < 400 && stood() < 3; k++) { P.tick(); P.sync(); await P.stream(); }
  assert.ok(stood() >= 3, 'the waves come on');
  assert.deepEqual([...P.A.own, ...P.R.own].filter((n) => n !== 'spiders'), [], 'every wave after the first spider is a spider - never the receiver\'s own roll');
  assert.ok(P.A.own.length >= 2, 'the sharer stood its next spider');
  assert.deepEqual([pickOf(q), pickOf(r)], [['S.07'], ['S.07']], 'both copies still on the spiders');
  assert.deepEqual(P.R.beside.filter((n) => n > 0), [], 'the receiver stood its own only when no spider of the sharer\'s stood here');
  assert.ok(P.R.defer + P.R.own.length >= 1, 'and its wave ran - deferred to the sharer\'s spider or stood');
});

test('VERMIN-SHARED: the receiver stands its own wave when the sharer, near, stands none of the wave\'s Foe here - CreateFoe always places', async () => {
  const P = party();
  const { q, r, house } = takeAndShare(P, { rollsR: () => 0.99 });   // the receiver's wave backdated near a whole interval: it comes at once
  // the sharer's copy is somewhere else (out of the house: its pick, its wave, nothing standing) while the sharer itself
  // stands beside the receiver - a window open, a link a reload dropped, a copy that rolled apart all look the same
  P.R.inside = house;
  for (let k = 0; k < 400 && !P.R.own.length; k++) { P.tick(); P.sync(); await P.stream(); }
  assert.equal(live(P.A.pool).length, 0, 'the sharer stands nothing');
  assert.deepEqual(P.R.own, ['spiders'], 'the receiver\'s own wave stands, in its own pool');
  assert.equal(P.R.defer, 0, 'nothing thrown away');
  const mine = live(P.R.pool, (f) => !f.puppet);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].questBehaviour.targetSymbol.name, 'spiders', 'bound to the receiver\'s own Foe');
  await P.stream();
  assert.equal(live(P.A.pool, (f) => f.puppet === P.R.peer).length, 1, 'and it rides to the sharer as the quest\'s');
  assert.equal(copy(P.A), q); assert.equal(copy(P.R), r);
});

test('VERMIN-SHARED: the receiver defers while the sharer\'s foe of the same Foe stands in its pool, indoors and out - a foe of another Foe, the sharer\'s body, another quest\'s, defer nothing', async () => {
  const P = party();
  const { q } = takeAndShare(P);
  const handle = (name) => ({ foe: foeRes(copy(P.R), name), behaviour: null });
  const sharers = async (name) => {
    const wave = mintQuestFoeWave(P.A.m, foeRes(q, name), 1)[0];
    const f = await P.A.pool.spawnFoe(wave.foe.foeType, [5, 0, 5], { feetGiven: true, questBehaviour: wave.behaviour });
    await P.stream();
    return f;
  };
  for (const mode of ['interior', 'exterior']) assert.equal(P.R.defers(handle('spiders'), mode), false, `${mode}: the sharer near and nothing of its standing - this copy stands its own`);
  const bat = await sharers('bats');
  assert.equal(live(P.R.pool, (f) => f.puppet === P.A.peer).length, 1, 'the sharer\'s bat stands here');
  for (const mode of ['interior', 'exterior']) assert.equal(P.R.defers(handle('spiders'), mode), false, `${mode}: a bat of the sharer\'s stands for no spider wave`);
  const spider = await sharers('spiders');
  for (const mode of ['interior', 'exterior']) {
    assert.equal(P.R.defers(handle('spiders'), mode), true, `${mode}: the sharer's spider stands here - the spider wave is the sharer's`);
    assert.equal(P.R.defers(handle('bats'), mode), true, `${mode}: and its bat for the bat wave`);
  }
  // the spider killed: its body defers nothing
  spider.questBehaviour.host.enemy.setCurrentHealth(0);
  await P.stream();
  assert.equal(live(P.R.pool, (f) => f.puppet === P.A.peer && f._pupQuest?.s === 'spiders').length, 0, 'the spider fell here too');
  for (const mode of ['interior', 'exterior']) assert.equal(P.R.defers(handle('spiders'), mode), false, `${mode}: the sharer's body is no wave`);
  // the sharer's own copy never defers (it shared nothing it received)
  assert.equal(P.A.defers({ foe: foeRes(q, 'bats'), behaviour: null }), false, 'the sharer stands its own, always');
  // a quest word of another quest - the same Foe's name - defers nothing
  const other = live(P.R.pool, (f) => f.puppet === P.A.peer)[0];
  assert.equal(other, live(P.R.pool, (f) => f.puppet === P.A.peer && f._pupQuest?.s === 'bats')[0], 'the bat still stands');
  other._pupQuest = { ...other._pupQuest, q: 'M0B00Y06' };
  assert.equal(P.R.defers(handle('bats')), false, 'another quest\'s bat stands for none of this one\'s');
  assert.ok(bat);
  // THE FOUR HOSTS: the room's arm reads worldModes' insideFoes - a building's pool (its puppets in `puppet`, as these
  // pools mint them) and a dungeon's records, whose own-lane puppets dungeonContext names in `_ownFrom` beside the word
  const rd = (f) => readFileSync(join(ROOT, f), 'utf8');
  assert.match(rd('src/scenes/worldModes.js'), /if \(mode === 'dungeon' && dungeonCtx\) return dungeonCtx\.foes\.filter\(\(f\) => !f\.dead\);[\s\S]{0,200}if \(mode === 'interior'\) return interiorEnemyDatabase\(\);/);
  assert.match(rd('src/scenes/dungeonContext.js'), /f\._ownFrom = from; f\._ownI = r\.i; f\._pupQuest = qt;/);
  assert.equal(partnerStandsQuestFoes({ questName: QUEST, symbol: 'spiders', sharerOf: () => 'acct-a', inMyParty: () => true, peers: [{ id: 'peer-acct-a', feet: [1, 0, 0] }], accountOfPeer: (id) => ACCT[id], myFeet: [0, 0, 0],
    foes: [{ _ownFrom: 'peer-acct-a', dead: false, _pupQuest: { q: QUEST, s: 'spiders' } }] }), true, 'a dungeon\'s own-lane puppet of the sharer\'s spider defers the spider wave');
  // exterior.js (the dev host: no session, no party, no share) stands every wave - nothing to wire there
  assert.doesNotMatch(rd('src/scenes/exterior.js'), /partnerStandsQuestFoes/);
});
