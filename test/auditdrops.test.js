// AUDIT DROPS (2026-09-22, Mac: "Lets do an audit before merging") - three
// lenses over the four drops and the three additions, the findings paid
// and PINNED BY EXECUTION here. A: the quest envelope is not trusted. B:
// the trade's freeze and its reservation. C: the quest cooldowns. D: party
// rest indoors and underground, the mirror's own latch. E: the plaque
// under a pointer surface, the footstep kind by mode, the peer sounds'
// leak, stride and hand. F: the drop laws no pin had held.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { receiveSharedQuest, prepareQuestShare, shapeMismatch, takeLocalItems, SHARE_REFUSAL_TEXT } from '../src/systems/questShare.js';
import { createTradeManager, TradeSession } from '../src/net/tradeSession.js';
import { validTradeData, validPose, parseClient, relaySupportsTrade, questShareGate, questInGate, QUEST_HUB_MIN_MS, QUEST_SEND_MS, QUEST_FRAME_MAX, TRADE_FRAME_MAX, TRADE_ROOM_BYTES_PER_S, TRADE_HZ_MAX, RELAY_VERSION, inRange } from '../src/net/wire.js';
import { createTradePack } from '../src/systems/tradePack.js';
import { RemotePlayers } from '../src/net/remotePlayers.js';
import { EQUIP_SLOTS } from '../src/characters/paperdoll.js';
import { swingSoundFor, SOUND } from '../src/systems/soundClips.js';
import { fakeRoom } from './fakeRoom.mjs';
import { WHY_IN_PARTY, SocialState } from '../src/net/social.js';
import { peerPromptText } from '../src/player/socialPick.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);

// ── A. the quest envelope ───────────────────────────────────────────

const VENDOR = join(ROOT, 'vendor', 'dfu-quests');
{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readFileSync(join(VENDOR, 'Tables', f), 'utf8').replace(/^﻿/, '');
  loadQuestTables(sources);
}
const SRC = {
  __SH: ['Quest: __SH', 'QRC:', 'Message:  1011', ' a reward', '', 'QBN:', 'Item _reward_ gold', '', '_t_ task:', ' give pc _reward_', '', 'variable _pad_'],
  __OTHER: ['Quest: __OTHER', 'QRC:', 'Message:  1011', ' other', '', 'QBN:', 'variable _x_'],
  __SH2: ['Quest: __SH2', 'QRC:', 'Message:  1011', ' a reward', '', 'QBN:', 'Item _reward_ gold', '', '_t_ task:', ' give pc _reward_', '', 'variable _pad_'],   // a TWIN of __SH: the same shape under another name
};
const machine = () => new QuestMachine({ nowSeconds: () => 0, showPopup() {}, getQuestSourceLines: (name) => SRC[name] ?? null });
const lists = { findQuestMeta: () => null, hasAcceptedOneTime: () => false, markOneTimeAccepted() {} };
/** A sender with __SH live, and its envelope. */
const sender = () => {
  const m = machine();
  const q = m.scheduleQuest(SRC.__SH, 0, { rolls: () => 0 });
  m.tick();
  const p = prepareQuestShare(m, q.uid);
  assert.ok(p.ok, 'the sender can share it');
  return { m, q, data: p.data };
};

test('AUDIT DROPS A1: an envelope is BUILT only when it is the quest it names AND its shape is the receiver\'s own parse - a wire name that is not the data\'s, a task or action that is not in the quest, and the main quest are all refused', () => {
  const { data } = sender();
  const ok = receiveSharedQuest(machine(), lists, '__SH', data);
  assert.ok(ok.ok && ok.quest?.questName === '__SH', 'the honest envelope lands');
  assert.deepEqual(receiveSharedQuest(machine(), lists, '__OTHER', data).reason, 'mismatch', 'gated as __OTHER, built as __SH: refused');
  assert.deepEqual(receiveSharedQuest(machine(), lists, '__SH2', data).reason, 'mismatch', 'gated as __SH2 - the SAME shape under another name - built as __SH: refused on the name alone');
  const swapped = structuredClone(data); swapped.tasks[0].actions[0].type = 'TeleportPc';
  assert.equal(receiveSharedQuest(machine(), lists, '__SH', swapped).reason, 'mismatch', 'an action the quest does not carry');
  const extra = structuredClone(data); extra.tasks.push(structuredClone(data.tasks[0]));
  assert.equal(receiveSharedQuest(machine(), lists, '__SH', extra).reason, 'mismatch', 'a task the quest does not carry');
  const res = structuredClone(data); res.resources.push({ ...structuredClone(data.resources[0]), symbol: { original: '_gift_' } });
  assert.equal(receiveSharedQuest(machine(), lists, '__SH', res).reason, 'mismatch', 'a resource the quest does not carry');
  const renamed = structuredClone(data); renamed.resources[0].symbol = { original: '_gift_' };
  assert.equal(receiveSharedQuest(machine(), lists, '__SH', renamed).reason, 'mismatch', 'a resource renamed, the count kept');
  const retyped = structuredClone(data); retyped.resources[0].type = 'Foe';
  assert.equal(receiveSharedQuest(machine(), lists, '__SH', retyped).reason, 'mismatch', 'a resource retyped, the count kept');
  assert.equal(receiveSharedQuest(machine(), lists, 'S0000999', { ...data, questName: 'S0000999' }).reason, 'mainQuest', 'the main quest, refused on RECEIPT');
  assert.equal(receiveSharedQuest(machine(), lists, '__SH', null).reason, 'mismatch');
  assert.equal(receiveSharedQuest(machine(), lists, '__NOSRC', { ...data, questName: '__NOSRC' }).reason, 'unknown', 'no local source to hold it against');
  assert.equal(shapeMismatch(machine().parseQuestShape('__SH'), data), null);
  assert.equal(shapeMismatch(machine().parseQuestShape('__SH'), { ...data, tasks: 7 }), 'tasks');
  for (const k of ['mismatch', 'unknown']) assert.ok(SHARE_REFUSAL_TEXT[k], `a word for ${k}`);
});

test('AUDIT DROPS A1: the ITEM a receiver ends up holding is their OWN roll - a typed daggerfallUnityItem in the envelope never lands', () => {
  const { data } = sender();
  const forged = structuredClone(data);
  const it = forged.resources.find((r) => r.type === 'Item');
  it.resourceSpecific.item = { templateIndex: 999, group: 'Weapons', stackCount: 1_000_000, name: 'Ebony Dai-Katana of Nothing' };
  const m = machine();
  const r = receiveSharedQuest(m, lists, '__SH', forged);
  assert.ok(r.ok, 'the shape is honest, so it lands...');
  const item = [...r.quest.resources.values()].find((x) => x.resourceTypeName === 'Item').daggerfallUnityItem;
  assert.notEqual(item?.templateIndex, 999, '...but the item is not the sender\'s bytes');
  const own = [...m.parseQuestShape('__SH').resources.values()].find((x) => x.resourceTypeName === 'Item').daggerfallUnityItem;
  assert.equal(item?.templateIndex, own?.templateIndex, 'it is the receiver\'s own parse\'s roll');
  const safe = takeLocalItems(m.parseQuestShape('__SH'), forged);
  assert.equal(forged.resources.find((r) => r.type === 'Item').resourceSpecific.item.templateIndex, 999, 'takeLocalItems copies; the envelope handed in is untouched');
  assert.notEqual(safe.resources.find((r) => r.type === 'Item').resourceSpecific.item?.templateIndex, 999);
});

test('AUDIT DROPS A2: a finished shared quest is never dragged back or paid twice - a resync onto a complete copy is refused, a tombstoned one leaves the sync set and a fresh receipt of it is "done", completion is monotonic, a reward re-arms once per action ever', () => {
  const { data } = sender();
  const m = machine();
  const first = receiveSharedQuest(m, lists, '__SH', data);
  assert.ok(first.ok);
  const quest = first.quest;
  const give = () => [...quest.tasks.values()][0].actions[0];   // re-read: a restore rebuilds the action objects
  assert.equal(give().typeName, 'GivePc');
  // the partner completes it: the resync arrives with isComplete true -> re-armed (false) ONCE
  const done = structuredClone(data); done.tasks[0].actions[0].isComplete = true;
  assert.ok(receiveSharedQuest(m, lists, '__SH', done).resync, 'a resync');
  assert.equal(give().isComplete, false, 'the reward is re-armed for this receiver');
  assert.ok(receiveSharedQuest(m, lists, '__SH', done).resync, 'the same completion again, before it has run here');
  assert.equal(give().isComplete, true, 'NOT re-armed a second time: the resync\'s `true` stands, once per action ever');
  give().isComplete = false;   // the receiver's own run of it is still pending from the first re-arm - put it back as the machine left it
  give().isComplete = true;   // ...and now it has run here
  // a partner who is BEHIND resyncs with false: monotonic - it stays complete
  assert.ok(receiveSharedQuest(m, lists, '__SH', data).resync);
  assert.equal([...quest.tasks.values()][0].actions[0].isComplete, true, 'never true -> false off an older copy');
  // the partner completes it again (a later resync with true): NOT re-armed a second time
  assert.ok(receiveSharedQuest(m, lists, '__SH', done).resync);
  assert.equal([...quest.tasks.values()][0].actions[0].isComplete, true, 'once per action, ever');
  // my copy completes: a resync onto it is refused
  quest.questComplete = true;
  assert.equal(receiveSharedQuest(m, lists, '__SH', data).reason, 'gone', 'a finished quest is not resynced');
  // tombstoned: out of the sync set, into the finished set; a fresh receipt is "done"
  m.tombstoneQuest(quest);
  assert.equal(m.hasSharedQuestNamed('__SH'), false);
  assert.equal(m.hasFinishedSharedQuestNamed('__SH'), true);
  assert.equal(receiveSharedQuest(m, lists, '__SH', data).reason, 'done');
  m.quests.delete(quest.uid);   // the tombstone expired
  assert.equal(receiveSharedQuest(m, lists, '__SH', data).reason, 'done', '...even after the tombstone is gone');
});

test('AUDIT DROPS A3: a malformed resync is refused whole and the LIVE quest is untouched - the restore is dry-run on a scratch quest first; a malformed fresh receipt lands nothing', () => {
  const { data } = sender();
  const m = machine();
  const q = receiveSharedQuest(m, lists, '__SH', data).quest;
  const resources = q.resources.size, tasks = q.tasks.size;
  assert.ok(resources > 0 && tasks > 0);
  const bad = structuredClone(data); bad.tasks[0].actions[0].actionSpecific = null; bad.messages = 3;
  assert.equal(shapeMismatch(m.parseQuestShape('__SH'), bad), null, 'the shape passes (the rot is deeper)');
  const r = receiveSharedQuest(m, lists, '__SH', bad);
  assert.equal(r.ok, false);
  assert.equal(q.resources.size, resources, 'resources intact'); assert.equal(q.tasks.size, tasks, 'tasks intact');
  const fresh = machine();
  assert.equal(receiveSharedQuest(fresh, lists, '__SH', bad).ok, false);
  assert.equal(fresh.quests.size, 0, 'nothing on the live table');
});

// ── B. the trade ────────────────────────────────────────────────────

function makePack(ids, gold) {
  const st = { items: ids.map((id) => ({ id, stackCount: 1 })), gold };
  return {
    st, offerable: () => null,
    wire: (entries) => entries.map(({ item, count }) => ({ id: item.id, n: count })),
    unwire: (recs) => (recs.every((r) => r && typeof r.id === 'string') ? recs.map((r) => ({ id: r.id, stackCount: r.n })) : null),
    take: (entries, g) => { if (g > st.gold || !entries.every((e) => st.items.includes(e.item))) return null; st.gold -= g; st.items = st.items.filter((it) => !entries.some((e) => e.item === it)); return { entries, g }; },
    restore: (h) => { st.gold += h.g; for (const e of h.entries) st.items.push(e.item); },
    give: (items, g) => { st.gold += g; for (const it of items) st.items.push(it); },
    fits: () => true, gold: () => st.gold,
  };
}
function rig() {
  const q = [], said = { A: [], B: [] };
  let clock = 0;
  const packA = makePack(['sword'], 100), packB = makePack(['ring'], 50);
  const mk = (me, other, id, pack) => createTradeManager({ pack, now: () => clock, say: (t) => said[me].push(t), peerName: () => other, selfId: () => id,
    send: (d) => { const v = validTradeData(d); if (!v) return false; q.push({ from: id, to: v.to, d: v }); return true; }, near: () => true, open: () => {} });
  const A = mk('A', 'B', 'peerAAAA', packA), B = mk('B', 'A', 'peerBBBB', packB);
  const mgrs = { peerAAAA: A, peerBBBB: B };
  const pump = () => { while (q.length) { const f = q.shift(); mgrs[f.to].onFrame(f.from, f.d); } };
  A.request('peerBBBB'); pump(); B.request('peerAAAA'); pump();
  assert.ok(A.session && B.session);
  return { A, B, packA, packB, said, pump, tick: (ms = 0) => { clock += ms; A.tick(); B.tick(); pump(); } };
}

test('AUDIT DROPS B1: my Confirm FREEZES my offer - setOffer refuses after it, both packs come out whole; before it an edit still unlocks both sides', () => {
  const r = rig();
  const a = r.A.session, b = r.B.session;
  assert.ok(a.setOffer([{ item: r.packA.st.items[0], count: 1 }], 5).ok); r.pump();
  assert.ok(b.setOffer([{ item: r.packB.st.items[0], count: 1 }], 0).ok); r.pump();
  assert.ok(a.lock().ok); r.pump(); assert.ok(b.lock().ok); r.pump();
  assert.ok(a.confirm().ok); r.pump();
  const edit = a.setOffer([], 0);
  assert.equal(edit.ok, false, 'confirmed: frozen'); assert.match(edit.why, /confirmed/);
  assert.equal(a.myConfirm, true, 'the confirm stands'); assert.equal(b.theirLock, true, 'and so does the lock the peer holds');
  assert.ok(b.confirm().ok); r.pump(); r.tick(); r.tick();
  assert.equal(a.phase, 'done'); assert.equal(b.phase, 'done');
  assert.deepEqual(r.packA.st.items.map((i) => i.id), ['ring']); assert.deepEqual(r.packB.st.items.map((i) => i.id), ['sword']);
  assert.equal(r.packA.st.gold + r.packB.st.gold, 150, 'nothing lost');
});

test('AUDIT DROPS B2: goods RESERVED but never sent come back whichever way the session ends - a forged commit arriving while my own commit is still queued restores my reservation', () => {
  const pack = makePack(['sword'], 100);
  const st = pack.st;
  const sent = [];
  const s = new TradeSession({ sid: 'abcdef1234', me: 'peerAAAA', peer: 'peerBBBB', pack, send: (d) => { sent.push(d); return false; }, near: () => true });   // the socket refuses: the commit stays QUEUED
  s.setOffer([{ item: st.items[0], count: 1 }], 10); s.lock(); s.myLock = true; s.theirLock = true; s.theirRev = 1; s._theirRaw = []; s.theirs = { items: [], gold: 0 };
  s.confirm(); s._onConfirm({ r: 1, o: s.rev });
  assert.equal(s.phase, 'committing', 'my goods are reserved...'); assert.deepEqual(st.items, []); assert.equal(st.gold, 90);
  assert.equal(s._sentCommit, false, '...and the commit never left');
  s.receive({ s: 'abcdef1234', k: 'commit', r: 1, o: s.rev, items: [{ id: 'forged' }], g: 0 });   // a forged commit: refused, the session ends
  assert.ok(s.isOver);
  assert.deepEqual(st.items.map((i) => i.id), ['sword'], 'the sword is back'); assert.equal(st.gold, 100, 'and the gold');
  assert.equal(s._handle, null);
});

test('AUDIT DROPS B3: the relay budgets trade BYTES per sender - two flooders at the sender rate no longer starve an honest commit to the same peer', async () => {
  const r = fakeRoom('world:3,12');
  const a = r.connect(), b = r.connect(), c = r.connect(), d = r.connect();
  await r.hello(a, 'peer-0001'); await r.hello(b, 'peer-0002'); await r.hello(c, 'peer-0003'); await r.hello(d, 'peer-0004');
  const frame = (k, pad) => ({ to: 'peer-0002', k, s: 'abcdef1234', r: 1, o: 1, g: 0, items: Array.from({ length: 16 }, (_, i) => ({ id: `it${i}`, pad: 'x'.repeat(pad) })) });
  let pad = 800; while (pad > 0 && !validTradeData(frame('commit', pad))) pad--;   // the widest data the wire itself accepts
  const big = (k) => frame(k, pad);
  assert.ok(validTradeData(big('commit')), 'the frame is inside the wire\'s own data cap');
  // AUDIT DROPS B4: what the wire accepts at home the relay's door accepts too - the data's cap sits under the FRAME's
  assert.equal(parseClient(JSON.stringify({ t: 'trade', data: big('commit') }), { hasHello: true }).t, 'trade', 'the widest honest frame passes parseClient');
  assert.ok(JSON.stringify({ t: 'trade', id: 'peer-0003-xxxxxx', data: validTradeData(big('offer')) }).length <= TRADE_FRAME_MAX, 'and the relay\'s fan-out of it fits the frame cap too');
  const bytes = JSON.stringify({ t: 'trade', id: 'peer-0003', data: validTradeData(big('offer')) }).length;
  assert.ok(2 * TRADE_HZ_MAX * bytes > TRADE_ROOM_BYTES_PER_S - bytes, `two flooders' worth (${2 * TRADE_HZ_MAX * bytes}) exhausts one room budget (${TRADE_ROOM_BYTES_PER_S}) under the old law`);
  for (const ws of [c, d]) for (let i = 0; i < TRADE_HZ_MAX; i++) await r.raw(ws, JSON.stringify({ t: 'trade', data: big('offer') }));
  b.sent.length = 0;
  await r.raw(a, JSON.stringify({ t: 'trade', data: big('commit') }));
  const got = ofType(b, 'trade');
  assert.equal(got.length, 1, 'the honest commit reaches its peer');
  assert.equal(got[0].id, 'peer-0001'); assert.equal(got[0].data.k, 'commit');
});

// ── C. the quest cooldowns ──────────────────────────────────────────

test('AUDIT DROPS C1/C2: the hub\'s and the receiver\'s cooldowns sit at HALF the client\'s floor, and the receiver keys them by the sender', () => {
  assert.equal(QUEST_HUB_MIN_MS, QUEST_SEND_MS / 2);
  const t0 = 1_000_000;
  const g1 = questShareGate(null, t0); assert.equal(g1.pass, true);
  assert.equal(questShareGate(g1.at, t0 + QUEST_HUB_MIN_MS - 1).pass, false);
  assert.equal(questShareGate(g1.at, t0 + QUEST_HUB_MIN_MS).pass, true, 'the hub passes a share the client\'s own floor let out, clock skew and all');
  assert.equal(questShareGate(g1.at, t0 + QUEST_SEND_MS - 10).pass, true, 'a share 9990 ms after the last, which the old gate dropped while the client said "Shared"');
  const i1 = questInGate(null, t0); assert.equal(i1.pass, true);
  assert.equal(questInGate(i1.at, t0 + 1000).pass, false);
  assert.equal(questInGate(i1.at, t0 + QUEST_HUB_MIN_MS).pass, true);
  const o = rd('src/net/online.js');
  assert.match(o, /const qk = `\$\{room\}\|\$\{f\.acct\}`;\s*\n\s*const g = questInGate\(this\._inQuest\.get\(qk\), now\);/, 'keyed by the SENDER: one member\'s share never costs another\'s');
  assert.match(o, /const f = validQuestFrame\(m\);\s*\n\s*if \(!f \|\| f\.acct === this\.acct\) return;/, 'validated first, so the key is the account\'s');
  assert.match(o, /if \(k\.startsWith\(`\$\{room\}\|`\)\) this\._inQuest\.delete\(k\);/, 'and swept by room on leave');
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(prepared\.ok && socialLink\(\)\?\.shareQuest\(\{[^\n]*\}\)\) _questSyncSeen\.set\(questName, count\);/, 'C1: `seen` moves only when the share LEFT - a refused resync is retried');
  const s = rd('server/src/index.js');
  const start = s.indexOf("if (doored !== 'quest')");
  const arm = s.slice(start, s.indexOf("for (const member of party.members)", start));
  assert.ok(arm.indexOf('if (!a.party) return;') < arm.indexOf('tokenGate(this._roomQuest'), 'C3: no party, no budget spent');
  assert.ok(arm.indexOf('this._speaker(a.acct) !== ws') < arm.indexOf('tokenGate(this._roomQuest'), 'C3: another tab speaks, no budget spent');
  assert.match(o, /if \(this\._inTradeBuckets\.size > TRADE_IN_SENDERS_MAX\) this\._inTradeBuckets\.clear\(\);\s*\n\s*const g = tradeInGate\(this\._inTradeBuckets\.get\(m\.id\) \?\? null, now\);/, 'B3 at home: the inbound trade gate is per sender');
});

// ── D. party rest in the modal hosts ────────────────────────────────

test('AUDIT DROPS D1 (as the party-rest drop now keeps it): the building and the dungeon expose `restState` (RESTING, never a mirror, never the wake box) and run the stranger and party gates before their rest window; world.js reads them, broadcasts a rest only while RESTING, and its own toggle is guarded until the mode machine stands', () => {
  const m = rd('src/scenes/worldModes.js'), d = rd('src/scenes/dungeonContext.js'), w = rd('src/scenes/world.js');
  const getter = /get restState\(\) \{[\s\S]{0,2200}?if \(!w\?\.isRestWindow \|\| w\.isPartyRestMirror \|\| !w\.session \|\| w\.state !== 'resting'\) return null;\s*return \{ mode: w\.mode, hoursRemaining: w\.session\.hoursRemaining, totalHours: w\.session\.totalHours \};/;
  assert.match(m, getter, 'the building\'s'); assert.match(d, getter, 'the dungeon\'s');
  // The drop put the building's getter on interiorKeyCtx - the KEY table's ctx, which the factory never
  // returns - so `modes?.restState` read undefined from a tavern: D1's hole, re-opened. ONE getter per host,
  // ONE `restState` key at all, and the building's lies inside the factory's returned literal.
  for (const [src, who] of [[m, 'the building'], [d, 'the dungeon']]) {
    assert.equal(src.match(/get restState\(\)/g).length, 1, `${who}: one getter`);
    assert.equal(src.match(/\brestState\s*:/g), null, `${who}: no plain key beside the getter (the later key of a literal wins)`);
  }
  assert.ok(m.indexOf('get restState()') > m.lastIndexOf('\n  return {'), 'the building\'s getter sits on the object world.js reads, not the key ctx');
  assert.ok(m.indexOf('get restState()') > m.indexOf('get footstepKind()'), 'beside E2\'s footstepKind, on the same literal');
  assert.ok(d.indexOf('get restState()') > d.indexOf('\n  const api = {') && d.indexOf('get restState()') < d.indexOf('get uiOverlayActive() { return dungeonPaused(); }'), 'the dungeon\'s on `api`');
  assert.match(m, /const strangerRefusal = host\.strangerRestGate\?\.\(\);\s*if \(strangerRefusal\) \{ mountInterior\(new ActionTextBox\(\[strangerRefusal\]\)\); return; \}[\s\S]{0,600}?const partyRefusal = host\.partyRestGate\?\.\(\);\s*if \(partyRefusal\) \{ mountInterior\(new ActionTextBox\(\[partyRefusal\]\)\); return; \}[\s\S]{0,600}?host\.markPartyRestSpent\?\.\(\);\s*mountInterior\(createRestWindow\(interiorRestDeps\)\);/, 'the building: strangers, the party, the spend, the window');
  assert.match(d, /const strangerRefusal = opts\.strangerRestGate\?\.\(\);\s*if \(strangerRefusal\) \{ activeOverlay = new ActionTextBox\(\[strangerRefusal\]\); return; \}[\s\S]{0,600}?const partyRefusal = opts\.partyRestGate\?\.\(\);\s*if \(partyRefusal\) \{ activeOverlay = new ActionTextBox\(\[partyRefusal\]\); return; \}[\s\S]{0,600}?opts\.markPartyRestSpent\?\.\(\);\s*activeOverlay = createRestWindow\(_restDeps\);/, 'the dungeon: the same four, through the outer host\'s doors');
  assert.match(m, /partyRestGate: \(\) => host\.partyRestGate\?\.\(\),/, 'handed down to the dungeon');
  assert.match(m, /markPartyRestSpent: \(\) => host\.markPartyRestSpent\?\.\(\),/);
  assert.match(w, /const restWin = !isEnhanced\(\) \? null[^\n]*\n\s*: mode === 'interior' \? modes\?\.restState\s*: mode === 'dungeon' \? modes\?\.dungeonCtx\?\.restState/, 'world.js reads the two getters (AUDIT PARTY-REST: under the enhanced skin alone - ONLINE-REST1)');
  assert.match(w, /townTalk\.overlay\.session && townTalk\.overlay\.state === 'resting'/, 'D2: outdoors too, RESTING - not the wake box');
  assert.match(w, /const markPartyRestSpent = \(\) => \{\s*\n(?:\s*\/\/[^\n]*\n)*\s*if \(!isEnhanced\(\)\) return;\s*\n(?:\s*\/\/[^\n]*\n)*\s*if \(!social\) return;\s*\n\s*_partyRestReady = false;/, 'PARTY-REST28: the one shared reset every host runs on a granted rest (REST-OFFLINE1: a no-op with no social clock)');
  assert.match(w, /const partyRefusal = modes \? partyRestGate\(\) : null;/, 'D5: no TDZ before the mode machine stands');
  assert.match(w, /const strangerRefusal = modes \? strangerRestGate\(\) : null;/, 'D5: the stranger gate the same');
  assert.match(w, /if \(modes\) markPartyRestSpent\(\);/, 'D5: and the spend');
});

// ── E. the plaque, the kind, the peer sounds ────────────────────────

test('AUDIT DROPS E2: the pose\'s footstep kind is the MODE\'s indoors and underground - the building\'s stride caches the kind off the very ctx its clip pair was picked from', () => {
  const m = rd('src/scenes/worldModes.js'), w = rd('src/scenes/world.js');
  assert.match(m, /pickFootstepSet\(_fsCtx = mode === 'interior'/);
  assert.match(m, /_modeFootstepKind = pickFootstepKind\(_fsCtx\);/);
  assert.match(m, /get footstepKind\(\) \{ return _modeFootstepKind; \},/);
  assert.match(w, /fk: \(modes\?\.mode \?\? 'exterior'\) === 'exterior' \? _lastFootstepKind : \(modes\?\.footstepKind \?\? 0\),/);
});

const peerRig = () => {
  const played = [];
  const rp = new RemotePlayers({ renderer: {}, deps: { fetchBytes: async () => null, palette: null, audio: { playOneShot: (clip, vol) => played.push({ clip, vol }) } }, compose: async () => null });
  return { rp, played };
};
const body = (id, x, extra = {}) => ({ id, name: id, shown: { x, y: 0, z: 0, yaw: 0, pitch: 0, mv: 1, wd: 0, an: 0, fk: 0, ...extra.shown }, look: extra.look ?? null });

test('AUDIT DROPS E4: a BODY peer\'s stride machine and swing edge are swept when they leave, and no phantom swing plays when they return', () => {
  const { rp, played } = peerRig();
  const opts = { bodyHeight: () => 2, eye: [0, 1.7, 0] };
  rp.sync([body('bob-0001', 1, { shown: { an: 3 } })], undefined, opts);
  assert.ok(rp._footsteps.has('bob-0001') && rp._attackAn.has('bob-0001'), 'entries while they stand');
  rp.sync([], undefined, opts);
  assert.equal(rp._footsteps.has('bob-0001'), false, 'swept'); assert.equal(rp._attackAn.has('bob-0001'), false);
  played.length = 0;
  rp.sync([body('bob-0001', 1, { shown: { an: 9 } })], undefined, opts);
  assert.equal(played.filter((p) => p.clip === SOUND.SwingHighPitch).length, 0, 'a returning peer\'s first `an` is a sighting, not a swing');
});

test('AUDIT DROPS E5, as PEER-BUZZ keeps it: the peer stride is measured in the SCENE\'s frame in scene units, and a floating-origin shift of the scene point is not a step because the recentre REBASES every peer machine (the wire\'s frame is forty scene units to one in the overworld - measured there, the stride fired forty-eight times a second)', () => {
  const { rp, played } = peerRig();
  const opts = { bodyHeight: () => 2, eye: [0, 1.7, 0] };
  let x = 0;
  for (let i = 0; i < 40 && !played.length; i++) { x += 0.6; rp.sync([body('bob-0001', x)], undefined, opts); }
  assert.ok(played.length >= 1, 'walking makes a step');
  const before = played.length;
  const shifted = { bodyHeight: () => 2, eye: [x + 819.2, 1.7, 0] };   // the origin recentred: the scene point jumps (and the listener with it)
  rp.rebaseFootsteps();   // world.js's recentre block, the line beside footsteps.rebase()
  rp.sync([body('bob-0001', x)], (p) => [p.x + 819.2, p.y, p.z], shifted);
  rp.sync([body('bob-0001', x)], (p) => [p.x + 819.2, p.y, p.z], shifted);
  assert.equal(played.length, before, 'no step for a recentre');
});

test('AUDIT DROPS E6: a swing sounds as the weapon IN HAND - the right-hand slot - and as a fist while the pose says sheathed', () => {
  const { rp, played } = peerRig();
  const opts = { bodyHeight: () => 2, eye: [0, 1.7, 0] };
  const look = { items: [{ templateIndex: 128, group: 'Weapons', equipSlot: EQUIP_SLOTS.LeftHand }, { templateIndex: 120, group: 'Weapons', equipSlot: EQUIP_SLOTS.RightHand }] };
  rp.sync([body('bob-0001', 1, { shown: { an: 0, wd: 1 }, look })], undefined, opts);
  rp.sync([body('bob-0001', 1, { shown: { an: 1, wd: 1 }, look })], undefined, opts);
  assert.equal(played.at(-1)?.clip, swingSoundFor({ templateIndex: 120 }), 'the right hand\'s weapon, not the first weapon in the look');
  rp.sync([body('bob-0001', 1, { shown: { an: 2, wd: 0 }, look })], undefined, opts);
  assert.equal(played.at(-1)?.clip, swingSoundFor(null), 'sheathed: a fist');
});

// ── F. the drop laws no pin held ────────────────────────────────────

test('AUDIT DROPS F: the pose\'s fk is clamped 0-5, the quest frame has its own cap at the door, relaySupportsTrade reads the welcome\'s number, the real pack reserves and restores exactly, and the seat\'s reason has ONE home', () => {
  const base = { x: 1, y: 2, z: 3, yaw: 0.5, pitch: 0.1, mv: 1 };
  assert.equal(validPose({ ...base, fk: 3 }).fk, 3); assert.equal(validPose({ ...base, fk: 9 }).fk, 5); assert.equal(validPose({ ...base, fk: -1 }).fk, 0); assert.equal(validPose({ ...base, fk: 'x' }).fk, 0);
  const quest = (n) => JSON.stringify({ t: 'quest', quest: { questName: '__SH', displayName: 'x', data: { pad: 'x'.repeat(n) } } });
  assert.equal(parseClient(quest(QUEST_FRAME_MAX - 200), { hasHello: true }).t, 'quest', 'under the quest cap: in, though far over MAX_FRAME_BYTES');
  assert.deepEqual(parseClient(quest(QUEST_FRAME_MAX + 1), { hasHello: true }), { error: 'frame too large' });
  assert.deepEqual(parseClient(quest(10), { hasHello: false }), { error: 'quest before hello' });
  assert.equal(relaySupportsTrade('world90'), false); assert.equal(relaySupportsTrade('world91'), true); assert.equal(relaySupportsTrade(RELAY_VERSION), true); assert.equal(relaySupportsTrade('junk'), false); assert.equal(relaySupportsTrade(null), false);
  assert.ok(JSON.stringify(validTradeData({ to: 'peer-0002', k: 'offer', s: 'abcdef1234', r: 1, g: 0, items: [{ pad: 'x'.repeat(TRADE_FRAME_MAX) }] })) === 'null', 'a trade frame over its cap is no frame');
  // the real pack over a real entity: a split stack, gold, the round trip
  const entity = { items: [{ name: 'Arrow', templateIndex: 131, group: 'Weapons', stackCount: 20 }, { name: 'Ring', templateIndex: 70, group: 'Jewellery', stackCount: 1 }], goldPieces: 100 };
  const pack = createTradePack(entity);
  assert.equal(pack.take([{ item: entity.items[1], count: 1 }], 500), null, 'more gold than the purse: nothing moves');
  assert.equal(entity.items.length, 2);
  const h = pack.take([{ item: entity.items[0], count: 5 }, { item: entity.items[1], count: 1 }], 30);
  assert.ok(h); assert.equal(entity.goldPieces, 70); assert.equal(entity.items.length, 1); assert.equal(entity.items[0].stackCount, 15, 'a split stack keeps the rest');
  pack.restore(h);
  assert.equal(entity.goldPieces, 100); assert.equal(entity.items.find((i) => i.name === 'Arrow').stackCount, 20, 'the split rejoins its origin'); assert.ok(entity.items.some((i) => i.name === 'Ring'));
  // the seat's reason: one home, read by the plaque through the real actionsFor
  const st = new SocialState({ acct: 'me' });
  assert.equal(WHY_IN_PARTY, 'in your party');
  assert.equal(peerPromptText({ canFriend: false, canInvite: false, canTrade: false, whyNotInvite: WHY_IN_PARTY, relation: 'friend' }, 'F'), 'In your party');
  assert.match(rd('src/net/social.js'), /if \(seated\) whyNotInvite = WHY_IN_PARTY;/);
  assert.equal(typeof st.actionsFor, 'function');
  // tradeFrame after chatFrame, before the dead return (lens 3 #5)
  assert.match(rd('src/scenes/world.js'), /const onlineFrame = \(now, dt\) => \{\s*chatFrame\(\);[^\n]*\n\s*tradeFrame\(\);[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*if \(townTalk\.overlay instanceof DeathScreen/);
  assert.ok(inRange);
});
