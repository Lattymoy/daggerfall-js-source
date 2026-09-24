// AUDIT 68 (2026-09-24), the whole-tree sweep - cluster "net" (S14, src/net). The halo socket a join forgot without
// closing, a halo's error frame wedging the primary, the quest arm's missing per-room gate and party seat, the trade
// confirm a cancel could strand the peer's goods behind, the class-sprite builds kept for peers already gone, and the
// emote target read as a replacement pattern. Each pin is driven through the real module and fails on the base.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OnlineSession } from '../src/net/online.js';
import { CLOSE_BUSY, CHAT_WORLD_ROOM, PARTY_MAX, validTradeData } from '../src/net/wire.js';
import { createTradeManager, inTradeRange, COMMIT_WAIT_MS } from '../src/net/tradeSession.js';
import { RemotePlayers } from '../src/net/remotePlayers.js';
import { emoteText } from '../src/net/chatCommands.js';
import { fakeSocketClass } from './fakeSocket.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const pose = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 };
const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
const cellSession = () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { t: 1000 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => clock.t });
  s.join('world:2,12', pose); sockets[0].open(); sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null });
  return { s, sockets, clock };
};

test('AUDIT 68 X7-halo-connecting-orphan: joining a cell whose halo is still CONNECTING closes that halo\'s socket - it was forgotten open, never hello\'d and never closed', () => quiet(() => {
  const { s, sockets } = cellSession();
  s.setHalo(['world:3,12']);   // the next cell's socket, still connecting (TLS, or the token mint)
  s.join('world:3,12', pose);
  assert.equal(sockets.length, 3, 'the ordinary join stands the new cell\'s own socket');
  assert.equal(s._ws, sockets[2]);
  assert.deepEqual(sockets[1].closed, { code: 1000, reason: 'leaving' }, 'the connecting halo is closed, not leaked');
  assert.deepEqual(s.haloRooms(), []);
  sockets[1].open();
  assert.equal(sockets[1].sent.length, 0, 'and says nothing when it opens');
}));

test('AUDIT 68 S14-halo-error-wedges-primary: a halo\'s error frame is the halo\'s - the primary stays open and my poses still go down it; the primary\'s own error still counts', () => quiet(() => {
  const { s, sockets, clock } = cellSession();
  s.setHalo(['world:3,12']); sockets[1].open();
  sockets[1].receive({ t: 'error', m: 'busy' }); sockets[1].drop(CLOSE_BUSY);   // the relay's hello gate refusing the halo
  assert.equal(s.status, 'open'); assert.equal(s.error, null); assert.equal(s.statusLine(), null);
  const n = sockets[0].sent.length;
  clock.t += 1000;
  assert.equal(s.sendPose({ ...pose, x: 20 }), true);
  assert.equal(sockets[0].sent.length, n + 1, 'the pose went down the primary');
  sockets[0].receive({ t: 'error', m: 'bad pose' });
  assert.equal(s.status, 'error', 'the primary\'s own refusal is the session\'s');
}));

const hubSession = () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { t: 1e6 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'peer-me', secret: 'secret-of-peer-me', WebSocketImpl: FakeWS, now: () => clock.t, presence: false, acct: 'acct-me', asecret: 'secret-of-acct-me' });
  s.join(CHAT_WORLD_ROOM, null); sockets[0].open(); sockets[0].receive({ t: 'welcome', id: 'peer-me', peers: [], n: 1 });
  const got = [];
  s.onQuestShared = (acct) => got.push(acct);
  const share = (acct) => sockets[0].receive({ t: 'quest', acct, name: acct, quest: { questName: 'Q1', displayName: 'Q', data: { a: 1 } } });
  return { s, got, share, clock };
};

test('AUDIT 68 S14-quest-inbound-ungated: quest shares are gated PER ROOM before the per-sender cooldown - a relay naming a fresh account per frame no longer delivers every one, and the per-sender map stays bounded', () => quiet(() => {
  const { s, got, share } = hubSession();
  for (let i = 0; i < 100; i++) share(`acct-flood-${String(i).padStart(3, '0')}`);
  assert.ok(got.length <= PARTY_MAX - 1, `a flood of made-up senders delivered ${got.length}`);
  assert.ok(s._inQuest.size <= 65, `the per-sender map holds ${s._inQuest.size}`);
}));

test('AUDIT 68 S14-quest-inbound-ungated: an honest hub at full tilt passes whole - every other seat of a full party at once, and again at the hub\'s own cooldown', () => quiet(() => {
  const { got, share, clock } = hubSession();
  const seats = Array.from({ length: PARTY_MAX - 1 }, (_, i) => `acct-seat-${i}`);
  for (const a of seats) share(a);
  clock.t += 5000;   // QUEST_HUB_MIN_MS: each seat may share again
  for (const a of seats) share(a);
  assert.equal(got.length, 2 * seats.length);
  // and the host takes a share from a seat of my party alone - applyParty's rule (world.js is not driven here)
  assert.match(rd('src/scenes/world.js'), /link\.onQuestShared = \(acct, name, quest\) => \{\n\s*if \(!social\.inMyParty\(acct\)\) return;/, 'a share from an account holding no seat is nothing');
}));

// ---- the trade: a confirm that has left binds until the peer answers ------------------------------------------------
function makePack(ids, gold) {
  const st = { items: ids.map((id) => ({ id, stackCount: 1 })), gold };
  return {
    st,
    offerable: () => null,
    wire: (entries) => entries.map(({ item, count }) => ({ id: item.id, n: count })),
    unwire: (recs) => recs.map((r) => ({ id: r.id, stackCount: r.n })),
    take: (entries, g) => {
      if (g > st.gold || !entries.every((e) => st.items.includes(e.item))) return null;
      st.gold -= g; st.items = st.items.filter((it) => !entries.some((e) => e.item === it));
      return { entries, g };
    },
    restore: (h) => { st.gold += h.g; for (const e of h.entries) st.items.push(e.item); },
    give: (items, g) => { st.gold += g; for (const it of items) st.items.push(it); },
    fits: () => true,
    gold: () => st.gold,
  };
}
/** Two managers over one ordered wire, both locked on sword + 10 gold for ring + 5 gold. */
function lockedTrade() {
  const pos = { A: [0, 0, 0], B: [2, 0, 0] };
  const q = [];
  let clock = 0;
  const packA = makePack(['sword'], 100), packB = makePack(['ring'], 50);
  const mk = (me, other, id, otherId, pack) => createTradeManager({
    pack, now: () => clock, say: () => {}, peerName: () => other, selfId: () => id,
    send: (d) => { const v = validTradeData(d); if (!v) return false; q.push({ from: id, to: v.to, d: v }); return true; },
    near: (peer) => inTradeRange(pos[me], pos[peer === otherId ? other : me]),
  });
  const A = mk('A', 'B', 'peerAAAA', 'peerBBBB', packA), B = mk('B', 'A', 'peerBBBB', 'peerAAAA', packB);
  const mgrs = { peerAAAA: A, peerBBBB: B };
  const pump = () => { while (q.length) { const f = q.shift(); mgrs[f.to].onFrame(f.from, f.d); } };
  A.request('peerBBBB'); pump(); B.request('peerAAAA'); pump();
  A.session.setOffer([{ item: packA.st.items[0], count: 1 }], 10); pump();
  B.session.setOffer([{ item: packB.st.items[0], count: 1 }], 5); pump();
  A.session.lock(); pump(); B.session.lock(); pump();
  const ids = (p) => p.st.items.map((i) => i.id);
  return { A, B, packA, packB, pos, pump, ids, lose: () => { q.length = 0; }, advance: (ms) => { clock += ms; }, tick: (ms) => { clock += ms; A.tick(); B.tick(); pump(); } };
}

test('AUDIT 68 S14-trade-cancel-after-confirm-loses-goods: a cancel pressed after my confirm left, while the peer\'s commit is on its way, completes the exchange instead of destroying the peer\'s goods', () => {
  const r = lockedTrade();
  r.A.session.confirm(); r.pump();
  r.B.session.confirm();   // B confirms second: B commits at once, its ring and 5 gold are OUT of its pack
  const res = r.A.session.cancel();   // A presses Cancel before B's frames land
  r.pump(); r.tick(COMMIT_WAIT_MS * 4);
  assert.equal(r.packA.st.gold + r.packB.st.gold, 150, 'nothing destroyed');
  assert.deepEqual(r.ids(r.packA), ['ring']); assert.deepEqual(r.ids(r.packB), ['sword']);
  assert.deepEqual(res, { ok: true, pending: true }, 'the cancel was asked, not final');
});

test('AUDIT 68 S14-trade-cancel-after-confirm-loses-goods: the manager\'s range cancel of a confirmed trade is asked too - the peer stepping away as its commit leaves no longer strands its goods', () => {
  const r = lockedTrade();
  r.A.session.confirm(); r.pump();
  r.B.session.confirm();
  r.pos.A = [8, 0, 0]; r.A.tick();   // A's frame: B measures past 5 m before B's confirm lands
  r.pump(); r.tick(COMMIT_WAIT_MS * 4);
  assert.equal(r.packA.st.gold + r.packB.st.gold, 150, 'nothing destroyed');
  assert.deepEqual(r.ids(r.packA), ['ring']); assert.deepEqual(r.ids(r.packB), ['sword']);
});

test('AUDIT 68 S14-trade-cancel-after-confirm-loses-goods: a withdrawn confirm the peer has not acted on is answered with its cancel - both end, nothing moves; unanswered, it is given up at COMMIT_WAIT_MS', () => {
  const r = lockedTrade();
  const a = r.A.session;
  a.confirm(); r.pump();
  assert.deepEqual(a.cancel(), { ok: true, pending: true });
  assert.equal(a.withdrawing, true, 'waiting on the peer\'s answer');
  assert.deepEqual(a.cancel(), { ok: true, pending: true }, 'asked once');
  r.pump();
  assert.equal(r.A.session, null); assert.equal(r.B.session, null, 'the peer answered and both ended');
  assert.deepEqual(r.ids(r.packA), ['sword']); assert.deepEqual(r.ids(r.packB), ['ring']);
  assert.equal(r.packA.st.gold, 100); assert.equal(r.packB.st.gold, 50);
  const r2 = lockedTrade();
  r2.A.session.confirm(); r2.pump();
  r2.A.session.cancel(); r2.lose();   // the cancel is lost on the wire: no answer ever comes back
  r2.advance(COMMIT_WAIT_MS - 1); r2.A.tick();
  assert.ok(r2.A.session?.withdrawing, 'still asking');
  r2.advance(2); r2.A.tick();
  assert.equal(r2.A.session, null, 'given up');
});

test('AUDIT 68 S14-remoteplayers-mobiles-unswept: a peer gone before its class sprite landed keeps no bundle - the build lands for nobody and is dropped', async () => {
  const rp = new RemotePlayers({
    renderer: {}, compose: () => new Promise((res) => setTimeout(() => res(null), 5)),
    deps: { fetchBytes: async () => null, palette: null, audio: null, uploadRecordFrame: () => null, getTexture: () => new Promise((res) => setTimeout(() => res({ getFrameCount: () => 4 }), 5)) },
  });
  const peer = { id: 'peer0001', name: 'P', look: { race: 'Nord', gender: 'male', faceIndex: 0, class: 'Warrior', items: [] }, shown: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0 } };
  quiet(() => { rp.sync([peer]); rp.sync([]); });
  await new Promise((res) => setTimeout(res, 20));
  assert.equal(rp._batches.size, 0);
  assert.equal(rp._mobiles.size, 0, 'no MobileUnit bundle kept for a peer who left');
});

test('AUDIT 68 S14-emote-target-replacement-pattern: a target is inserted as typed - `$$`, `$&` and `$`` are a name, not String.replace patterns', () => {
  assert.equal(emoteText('wave', 'Mr$$Money'), 'waves at Mr$$Money.');
  assert.equal(emoteText('bow', '$&'), 'bows to $&.');
  assert.equal(emoteText('wave', '$`$`'), 'waves at $`$`.');
  assert.equal(emoteText('wave', "$'"), "waves at $'.");
});
