// SCALE5c (2026-10-10, Mac: "lets now tackle the bigger work ... really future proof our archetecture while also
// increasing performance", then "I wanna do every single slice"; bible/11-Multiplayer/Scale-Arc.md SCALE5c): THE HUB,
// SIXTEEN WAYS. A hub link lands on its account's shard (`chat:world.<k>`, net/hubShards.js), which holds the socket and
// its roster; `chat:world` is the world's bus, and runs every law it ran over a ShardSocket for each shard's socket.
// Held here over a world of real Rooms on the pins' fake objects (test/fakeRoom.mjs fakeRooms - the ROOMS binding that
// carries the internal doors between them) and real sessions over the pins' fake socket. tools/mutants/scale5c.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { fakeRooms } from '../fakeRoom.mjs';
import { fakeSocketClass } from '../fakeSocket.mjs';
import { OnlineSession, HUB_FIND_ASK_MS, HUB_FIND_FRESH_MS } from '../../src/net/online.js';
import { SOCIAL_ROOM, CHAT_ROOMS, isSocialRoom, isChatRoom, isRegionRoom, parseClient, RELAY_VERSION, CLOSE_REPLACED } from '../../src/net/wire.js';
import * as H from '../../src/net/hubShards.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn, log: console.log }; console.info = console.warn = console.log = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };

/** Names whose accounts (`acct-<name>`, the token's subject) land on distinct shards - and two that share one. */
function namesOnShards(count) {
  const out = [], seen = new Set();
  for (let i = 0; out.length < count && i < 4096; i++) { const n = `p${i}`; const k = H.hubOfSubject(`acct-${n}`); if (!seen.has(k)) { seen.add(k); out.push(n); } }
  assert.equal(out.length, count, `${count} accounts on ${count} shards`);
  return out;
}

/** A world of rooms on a clock of its own, and the hub's doors driven to rest between steps. */
async function world(fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try {
    return await quiet(async () => {
      const W = fakeRooms({ now: () => clock });
      const bus = W.room(SOCIAL_ROOM);
      /** Every shard's hand-up and the bus's deliveries, until both rest. */
      const settle = async () => {
        for (let i = 0; i < 6; i++) {
          for (const [k, r] of W.made) if (H.isChannelShard(k)) await r.room._hubUpFlush();
          for (const [k, r] of [...W.made]) if (H.isChannelBus(k)) await r.room._downFlush();
          for (const [k, r] of [...W.made]) if (H.isChannelShard(k)) await r.room._hubPoll();   // HUB-PULL: each shard asks for what it is owed
        }
      };
      /** A hub link for `n` (account `acct-<n>`), said hello to `key` - its own shard unless named. */
      const link = async (n, key = H.hubOfSubject(`acct-${n}`), extra = {}) => {
        const R = W.room(key);
        const ws = R.connect();
        clock += 30;
        const { peer = `peer-${n}`, ...over } = extra;   // a tab's own peer id - another tab of one account has its own
        await R.hello(ws, peer, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}`, ...over });
        await settle();
        return ws;
      };
      const say = async (ws, key, o) => { await W.room(key).raw(ws, JSON.stringify(o)); await settle(); };
      const drop = async (ws, key) => { await W.room(key).drop(ws); await settle(); };
      try { return await fn({ W, bus, settle, link, say, drop, tick: (ms) => { clock += ms; } }); } finally {
        for (const [, r] of W.made) { clearTimeout(r.room._upT); clearTimeout(r.room._downT); clearTimeout(r.room._hubCountT); clearTimeout(r.room._owedSoon); clearTimeout(r.room._owedLate); }
      }
    });
  } finally { Date.now = realNow; }
}
const ofT = (ws, t, k) => ws.sent.filter((f) => f.t === t && (k === undefined || f.k === k));

test('SCALE5c the law: sixteen shards beside the bus, each a channel the Worker opens and a hub link\'s room; an account lands on one by its subject, evenly, and nothing else is a shard (mutants: the bus a shard; a seventeenth; the subject unread; a key with a leading zero)', () => {
  assert.equal(H.HUB_SHARDS, 16);
  assert.deepEqual(H.HUB_SHARD_ROOMS, Array.from({ length: 16 }, (_, k) => `chat:world.${k}`));
  for (const k of H.HUB_SHARD_ROOMS) { assert.ok(CHAT_ROOMS.has(k), k); assert.equal(isSocialRoom(k), true); assert.equal(isChatRoom(k), true); assert.equal(isRegionRoom(k), false); assert.equal(H.isHubShard(k), true); }
  for (const k of [SOCIAL_ROOM, 'chat:world.16', 'chat:world.01', 'chat:world.', 'chat:world.-1', 'chat:region.3', null, 7]) assert.equal(H.isHubShard(k), false, String(k));
  assert.equal(isSocialRoom(SOCIAL_ROOM), true);
  assert.equal(H.chatHubRoom(16), null);
  const count = new Array(16).fill(0);
  for (let i = 0; i < 16_000; i++) count[Number(H.hubOfSubject(`p_${(i * 2654435761 >>> 0).toString(36)}`).split('.')[1])]++;
  assert.ok(Math.min(...count) > 800 && Math.max(...count) < 1200, `an even spread (${count.join(' ')})`);
  assert.equal(H.hubOfSubject('acct-x'), H.hubOfSubject('acct-x'), 'the same account, the same shard');
  assert.equal(H.hubOfSubject(''), null); assert.equal(H.hubOfSubject(null), null);
  assert.equal(H.shardHash('a'), 0xe40c292c, 'FNV-1a, both ends');
  assert.equal(H.hubHopOf({ t: 'hub', key: 'chat:world.3' }), 'chat:world.3');
  assert.equal(H.hubHopOf({ t: 'hub', key: SOCIAL_ROOM }), SOCIAL_ROOM);
  for (const bad of [{ t: 'hub', key: 'chat:region.62' }, { t: 'hub', key: 'world:1,2' }, { t: 'hub' }, { t: 'x', key: 'chat:world.3' }, null]) assert.equal(H.hubHopOf(bad), null);   // part two: a region's channel and its shards are hops too
  assert.equal(H.hubShardsSupported('world191'), false); assert.equal(H.hubShardsSupported('world192'), true);
  const look = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };
  const hello = (hs) => parseClient(JSON.stringify({ t: 'hello', id: 'peer-0001', secret: 'secret-of-peer-0001', name: 'x', look, pose: null, hs }));
  assert.equal(hello(1).hs, 1);
  for (const v of [2, true, 0]) { const h = hello(v); assert.equal(h.error, undefined); assert.equal(h.hs, undefined); }
  assert.deepEqual(parseClient('{"t":"find","q":"ald"}', { hasHello: true }), { t: 'find', q: 'ald' });
  for (const q of ['', 'x'.repeat(H.HUB_FIND_Q_MAX + 1), 5]) assert.ok(parseClient(JSON.stringify({ t: 'find', q }), { hasHello: true }).error);
});

test('SCALE5c the bus runs a shard\'s socket as its own: a hub link on its shard is welcomed there and greeted by the bus (its picture); a world line from one shard reaches another shard\'s link and a tab from before the shards on the bus itself; a friend request crosses shards (mutants: a frame not handed up; a hello not handed up; the bus\'s words unsaid to a ShardSocket; a delivery dropped)', async () => {
  await world(async ({ bus, link, say, settle }) => {
    const [a, b] = namesOnShards(2);
    const ka = H.hubOfSubject(`acct-${a}`), kb = H.hubOfSubject(`acct-${b}`);
    assert.notEqual(ka, kb);
    const wa = await link(a), wb = await link(b);
    const old = await link('legacy', SOCIAL_ROOM, { hs: undefined });   // a tab from before the shards: the bus itself
    for (const ws of [wa, wb]) {
      assert.equal(ws.sent[0].t, 'welcome', 'welcomed by its shard');
      assert.ok(ofT(ws, 'social', 'state').length >= 1, 'and its picture from the bus');
    }
    assert.equal(bus.room._vsocks.size, 2, 'the bus holds a ShardSocket for each');
    for (const ws of [wa, wb, old]) ws.sent.length = 0;
    await say(wa, ka, { t: 'chat', text: 'hail from the east' });
    for (const ws of [wa, wb, old]) assert.deepEqual(ofT(ws, 'chat').map((f) => f.text), ['hail from the east'], 'the world line, everywhere');
    await say(wa, ka, { t: 'social', k: 'friend.request', peer: `peer-${b}` });   // met in the world: asked by peer (AUDIT SOC A6)
    const st = ofT(wb, 'social', 'state').at(-1);
    assert.ok(st && st.in.some((r) => r.acct === `acct-${a}`), 'the request heard on the other shard');
    assert.ok(ofT(wb, 'social', 'note').some((f) => f.code === 'friend.requested'));
    await say(wb, kb, { t: 'social', k: 'friend.accept', acct: `acct-${a}` });
    const mine = ofT(wa, 'social', 'state').at(-1);
    assert.ok(mine.friends.some((r) => r.acct === `acct-${b}` && r.online), 'friends, and the friend online - on another shard');
    await settle();
  });
});

test('SCALE5c a shard holds its own roster and says the hub\'s count: its welcome names its own sockets, a join or leave elsewhere moves the count it says (`n`), and the bus\'s own welcome counts every shard (mutants: the count the shard\'s own; the count frame never said)', async () => {
  await world(async ({ W, bus, link, drop, settle }) => {
    const names = namesOnShards(4);
    const k0 = H.hubOfSubject(`acct-${names[0]}`);
    const w0 = await link(names[0]);
    for (const n of names.slice(1)) await link(n);
    clearTimeout(bus.room._countT); bus.room._countT = null;
    const old = await link('legacy', SOCIAL_ROOM);
    assert.equal(old.sent[0].n, 5, 'the bus counts every shard');
    const shard = W.room(k0);
    assert.ok(bus.room._countT, 'the count\'s tell owed - a hello on the bus');
    await bus.room._busCountTell(); await shard.room._hubPoll();   // what its timer runs, HUB_COUNT_MS on - and (HUB-PULL) the shard asking for it
    assert.equal(shard.room._hubTotal, 5, 'told the bus\'s count - a hello on the bus moved it');
    assert.equal(bus.room._toldN.get(k0), 5, 'and what it was told kept');
    assert.ok(shard.room._hubCountT, 'and owes its sockets the count');
    shard.room._hubCountSay();
    assert.equal(ofT(w0, 'n').at(-1)?.n, 5, 'the count said to the shard\'s sockets');
    const said = ofT(w0, 'n').length;
    shard.room._hubCountSay();
    assert.equal(ofT(w0, 'n').length, said, 'once a count');
    const late = namesOnShards(5)[4];
    clearTimeout(bus.room._countT); bus.room._countT = null;
    const wl = await link(late);
    assert.ok(bus.room._countT, 'a hello on a shard owes the tell too');
    await bus.room._busCountTell(); await shard.room._hubPoll();
    assert.equal(shard.room._hubTotal, 6, 'a hello on another shard');
    assert.equal(bus.room._namedCount(), 6);
    clearTimeout(bus.room._countT); bus.room._countT = null;
    await drop(old, SOCIAL_ROOM);
    assert.ok(bus.room._countT, 'a leave on the bus owes the tell');
    await bus.room._busCountTell(); await shard.room._hubPoll();
    assert.equal(shard.room._hubTotal, 5, 'a leave on the bus');
    const held = bus.room._vsocks.size;
    await drop(wl, H.hubOfSubject(`acct-${late}`));
    assert.equal(bus.room._vsocks.size, held - 1, 'a leave on a shard handed up at once, not at its sync');
    await bus.room._busCountTell(); await shard.room._hubPoll();
    assert.equal(shard.room._hubTotal, 4);
    const told = bus.room._toldN.get(k0);
    await bus.room._busCountTell(); await shard.room._hubPoll();
    assert.equal(bus.room._toldN.get(k0), told, 'nothing said to a shard told the count already');
    assert.deepEqual(w0.sent[0].peers, [], 'its roster its own shard\'s (it was first there)');
  });
});

test('SCALE5c an account on the wrong shard is told its own and closed, nothing written; the bus tells a link of this build its shard the same way, and keeps a tab from before the shards (mutants: the hop unasked; the bus\'s hop unasked; the bus\'s hop held)', async () => {
  await world(async ({ W, bus, link }) => {
    const [a] = namesOnShards(1);
    const right = H.hubOfSubject(`acct-${a}`);
    const wrong = H.HUB_SHARD_ROOMS.find((k) => k !== right);
    const ws = await link(a, wrong);
    assert.deepEqual(ws.sent, [{ t: 'hub', key: right }]);
    assert.equal(ws.closed?.code, H.CLOSE_HUB);
    assert.equal(bus.room._vsocks.size, 0, 'the bus never heard of it');
    assert.equal(W.room(wrong).room._namedCount(), 0);
    const viaBus = await link(a, SOCIAL_ROOM, { hs: 1 });
    assert.deepEqual(viaBus.sent, [{ t: 'hub', key: right }], 'the bus names the shard, and greets nobody it is sending away');
    assert.equal(viaBus.closed?.code, H.CLOSE_HUB);
    assert.equal(bus.room._namedCount(), 0, 'nothing held - its close says no leave');
    assert.equal(await bus.store.get(`secret:peer-${a}`), undefined, 'nothing written');
    const before = await link('legacy', SOCIAL_ROOM, { hs: undefined });
    assert.equal(before.sent[0].t, 'welcome', 'a tab from before the shards is the bus\'s to keep');
    assert.equal(before.closed, null);
  });
});

test('SCALE5c ONE-SEAT across the bus and a shard, and a shard\'s reconnect: a claim on a shard closes the account\'s tab on the bus; a reconnect on its shard replaces the old ShardSocket with no leave said (mutants: the seat unasked across; the replacement said as a leave)', async () => {
  await world(async ({ bus, link }) => {
    const [a, f] = namesOnShards(2);
    const onBus = await link(a, SOCIAL_ROOM, { peer: `peer-${a}-old` });   // a tab from before the shards, on the bus
    const shardTab = await link(a, undefined, { cl: 1 });
    assert.ok(onBus.closed && onBus.closed.code === CLOSE_REPLACED, 'the claim took the seat from the bus\'s tab');
    assert.equal(shardTab.closed, null);
    // a reconnect is no leave: a tab on the bus watching the roster hears none
    const wf = await link(f);
    void wf;
    const watcher = await link('watcher', SOCIAL_ROOM);
    const vids = [...bus.room._vsocks.keys()].filter((v) => v.startsWith(`peer-${a}~`));
    assert.equal(vids.length, 1);
    watcher.sent.length = 0;
    const again = await link(a, undefined, { cl: 1 });
    assert.equal(shardTab.closed?.code, CLOSE_REPLACED, 'the old socket replaced on its shard');
    assert.equal(ofT(watcher, 'leave').filter((x) => x.id === `peer-${a}`).length, 0, 'no leave said for a reconnect');
    assert.equal(again.closed, null);
    const after = [...bus.room._vsocks.keys()].filter((v) => v.startsWith(`peer-${a}~`));
    assert.equal(after.length, 1);
    assert.notEqual(after[0], vids[0], 'a new ShardSocket for the new socket');
  });
});

test('SCALE5c the bus woken, or a hello lost: the shard\'s next frame is answered unknown and its hello said again; its sync lets the bus close a socket it no longer holds (mutants: the re-hello; the sync\'s live list unread)', async () => {
  await world(async ({ W, bus, link, say, settle }) => {
    const [a, b] = namesOnShards(2);
    const ka = H.hubOfSubject(`acct-${a}`);
    const wa = await link(a), wb = await link(b);
    bus.wake();   // the bus evicted: every ShardSocket gone with its memory
    assert.equal(bus.room._vsocks.size, 0);
    wa.sent.length = 0;
    await say(wa, ka, { t: 'chat', text: 'anyone?' });
    await settle();
    assert.equal(bus.room._vsocks.size, 2, 'said again by its shard - and the other shard\'s, which the woken bus asked for every socket it holds');   // PIN MOVED (AUDIT SCALE II R2-6): a woken bus asks every shard it has heard from - the one that spoke alone was 1
    assert.ok(ofT(wa, 'social', 'state').length >= 1, 'and greeted again');
    // a socket the bus holds that its shard does not: closed at the sync
    const kb = H.hubOfSubject(`acct-${b}`);
    const sb = W.room(kb);
    await say(wb, kb, { t: 'chat', text: 'here too' });   // b's hello said again too
    assert.equal([...bus.room._vsocks.values()].filter((v) => v.hub === kb).length, 1, 'the bus holds b again');
    sb.sockets.splice(sb.sockets.indexOf(wb), 1);   // the runtime let it go, nothing said
    sb.room._idx = null;
    await say(wa, ka, { t: 'chat', text: 'again' });
    sb.room._vidIdxFull = false; sb.room._vidIdx.clear();
    await sb.fire();   // the shard's alarm: its sync, every socket it holds
    await settle();
    assert.equal([...bus.room._vsocks.values()].filter((v) => v.hub === kb).length, 0, 'the bus let it go');
    const sa = W.room(ka);
    await sa.fire();
    assert.equal(sa.alarm.at, Date.now() + H.HUB_SYNC_MS, 'a shard holding sockets syncs again HUB_SYNC_MS on');
  });
});

test('SCALE5c a search of everyone online by name (Mac\'s decision 2): asked on a shard, answered from every shard and the bus, HUB_FIND_MAX at most, on a bucket of its own (mutants: the fold; the bound; the asker in its own answer)', async () => {
  await world(async ({ link, say }) => {
    const names = namesOnShards(3);
    const ws = await link(names[0]);
    for (const n of names.slice(1)) await link(n);
    await link('legacy', SOCIAL_ROOM);
    await link('obrien', SOCIAL_ROOM, { peer: 'peer-obrien', name: 'O\'Brien' });
    ws.sent.length = 0;
    await say(ws, H.hubOfSubject(`acct-${names[0]}`), { t: 'find', q: 'P' });
    const f = ofT(ws, 'found').at(-1);
    assert.equal(f.q, 'P');
    assert.deepEqual(f.l.map((p) => p.name).sort(), names.slice(1).sort(), 'every other player whose name holds it, on every shard - never the asker');
    ws.sent.length = 0;
    await say(ws, H.hubOfSubject(`acct-${names[0]}`), { t: 'find', q: 'obri' });
    assert.deepEqual(ofT(ws, 'found').at(-1).l.map((p) => p.name), ['O\'Brien'], 'a name folded as the search is');
    ws.sent.length = 0;
    await say(ws, H.hubOfSubject(`acct-${names[0]}`), { t: 'find', q: 'leg acy' });
    assert.deepEqual(ofT(ws, 'found').at(-1).l.map((p) => p.name), ['legacy'], 'folded: case, spaces and apostrophes');
  });
  // HUB_FIND_MAX at most, over an index of more
  const R = { _all: () => new Map(Array.from({ length: H.HUB_FIND_MAX + 8 }, (_, i) => [{}, { id: `x${i}`, name: `Pal${i}` }])), _dead: new Set(), _gone: new WeakSet(), _folds: new WeakMap() };
  const { Room } = await import('../../server/src/index.js');
  assert.equal(Room.prototype._findNames.call(R, null, 'pal').length, H.HUB_FIND_MAX);
});

test('SCALE5c the session: a hub link offers the shards in its hello, goes where the hub says (`hub`), keeps the hub\'s count (`n`), reads a search\'s answer, and a shard that never opens twice is a relay before them - back to the bus, offering them no more (mutants: the offer; the hop unread; the count unread; the fallback; the offer after it)', async () => {
  await quiet(() => {
    const { FakeWS, sockets } = fakeSocketClass();
    let t = 1_000_000;
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => t, rand: () => 0, presence: false });
    s.join(SOCIAL_ROOM);
    sockets[0].open();
    const hello = JSON.parse(sockets[0].sent.find((x) => x.startsWith('{"t":"hello"')));
    assert.equal(hello.hs, 1, 'a hub link offers');
    sockets[0].receive({ t: 'hub', key: 'chat:world.7' });
    assert.equal(s.room, 'chat:world.7', 'the bus sent it to its shard');
    assert.equal(sockets[0].closed?.code, 1000);
    sockets[1].open();
    sockets[1].receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 400, v: 'world192', now: t });
    assert.equal(s.roomCount, 400);
    sockets[1].receive({ t: 'n', n: 512 });
    assert.equal(s.roomCount, 512, 'the hub\'s count moved by another shard');
    let found = null;
    s.onFound = (f) => { found = f; };
    assert.equal(s.sendFind('  Ald '), true);
    assert.deepEqual(JSON.parse(sockets[1].sent.at(-1)), { t: 'find', q: 'Ald' });
    sockets[1].receive({ t: 'found', q: 'Ald', l: [{ id: 'peer-0002', name: 'Aldric', sub: 'acct-x' }, null] });
    assert.deepEqual(found.l.map((p) => [p.id, p.name, p.sub]), [['peer-0002', 'Aldric', 'acct-x']]);
    sockets[1].receive({ t: 'hub', key: 'chat:world.2' });
    assert.equal(s.room, 'chat:world.2', 'a shard\'s hop');
    sockets[2].receive({ t: 'hub', key: 'chat:region.4' });
    assert.equal(s.room, 'chat:world.2', 'never anywhere but the hub');
    // a relay before the shards refuses the key: the socket never opens, twice - the hub itself
    sockets[2].drop(1006);
    t += 5000; s.tick?.();
    const third = sockets.at(-1);
    assert.equal(s.room, 'chat:world.2');
    third.drop(1006);
    assert.equal(s.room, SOCIAL_ROOM, 'back to the bus');
    const bus = sockets.at(-1);
    bus.open();
    const again = JSON.parse(bus.sent.find((x) => x.startsWith('{"t":"hello"')));
    assert.equal(again.hs, undefined, 'and offers the shards no more - the bus would send it straight back');
  });
  const world = src('src/scenes/world.js');
  assert.match(world, /if \(tab\.room\) link\.join\(channelLinkRoom\(tab\.room\)\);/);
  assert.match(world, /return seen === '1' \? \(shardOf\(room, storedSession\(appStorage\(\)\)\?\.id\) \?\? room\) : room;/);
  // PIN MOVED, AUDIT SCALE II C-2: the flag kept under the relay's own key (hubShardsSeenKey), and a relay without the
  // shards takes the links off them (test/net/auditscale2_client.test.js runs the host's own closures)
  assert.match(world, /const onRelayVersion = \(v\) => \{ const keeps = hubShardsSupported\(v\); try \{ appStorage\(\)\?\.setItem\?\.\(hubShardsSeenKey\(\), keeps \? '1' : '0'\); \}/);
});

test('CHAT-FIND-HUB the session: the search box asks the hub while this link knows fewer than are online - once a query moves, never closer than HUB_FIND_ASK_MS, never a tag, never twice in flight, again when its answer is stale - keeps the answer as `hubFound` and never says it as a line; a busy hub is asked again; /find of the same query is still a line; the box cleared lets the answer go (mutants: the box never asks; asked though everyone is known; no floor; the answer said as a line; a busy answer kept; the answer outliving the box)', async () => {
  await quiet(() => {
    const { FakeWS, sockets } = fakeSocketClass();
    let t = 1_000_000;
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => t, rand: () => 0, presence: false });
    s.join('chat:world.7');
    sockets[0].open();
    const ws = sockets[0];
    const finds = () => ws.sent.map((x) => JSON.parse(x)).filter((f) => f.t === 'find' && f.q !== undefined);
    assert.equal(s.askFind('ald'), false, 'not before the welcome');
    ws.receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'peer-0003', name: 'Borgrim' }], n: 2, v: 'world192', now: t });
    assert.equal(s.askFind('ald'), false, 'everyone online is known here: the box filters them');
    ws.receive({ t: 'n', n: 600 });
    let lines = 0;
    s.onFound = () => { lines++; };
    assert.equal(s.askFind('#ab'), false, 'a tag is not the hub\'s to search');
    assert.equal(s.askFind('  Ald '), true);
    assert.deepEqual(finds().at(-1), { t: 'find', q: 'ald' });
    t += 100;
    assert.equal(s.askFind('aldr'), false, 'the floor');
    t += HUB_FIND_ASK_MS;
    assert.equal(s.askFind('ald'), false, 'asked, the answer on its way');
    ws.receive({ t: 'found', q: 'ald', l: [{ id: 'peer-0002', name: 'Aldric', sub: 'acct-x' }] });
    assert.equal(lines, 0, 'the box\'s answer is never a line');
    assert.deepEqual(s.hubFound.l.map((p) => [p.id, p.name]), [['peer-0002', 'Aldric']]);
    assert.equal(s.hubFound.q, 'ald');
    assert.equal(s.askFind('ald'), false, 'answered, and fresh');
    assert.equal(s.askFind('aldr'), true, 'a query moved');
    ws.receive({ t: 'found', q: 'aldr', l: [], busy: 1 });
    assert.equal(s.hubFound.q, 'ald', 'a busy hub answered nothing');
    t += HUB_FIND_ASK_MS;
    assert.equal(s.askFind('aldr'), true, 'and is asked again');
    ws.receive({ t: 'found', q: 'aldr', l: [{ id: 'peer-0002', name: 'Aldric' }] });
    t += HUB_FIND_FRESH_MS;
    assert.equal(s.askFind('aldr'), true, 'a stale answer is asked again');
    assert.equal(s.sendFind('aldr'), true);
    ws.receive({ t: 'found', q: 'aldr', l: [] });
    assert.equal(lines, 1, '/find of the box\'s own query is still said as a line');
    assert.equal(s.askFind(''), false);
    assert.equal(s.hubFound, null, 'the box cleared lets the answer go');
    const n = finds().length;
    for (let i = 0; i < 50; i++) { t += 16; s.askFind(`q${i}`); }
    assert.ok(finds().length - n <= Math.ceil((50 * 16) / HUB_FIND_ASK_MS) + 1, 'a typist at sixty frames a second stays under the relay\'s bucket');
  });
});

test('SCALE5c the bus\'s fans: a world line is one entry a shard, never one a socket, in its batch\'s order; a guild\'s line reaches a guildmate on another shard and nobody else (off the guild\'s own sockets); my guild online from every shard, never me; a search past the hub\'s budget is answered busy (mutants: the line a socket each; the broadcast out of order; the guild a walk of nothing; the guild index unkept; the guild ask unanswered; the asker listed; the hub\'s budget unasked)', async () => {
  const G1 = 'gaaaaaaaaaa', G2 = 'gbbbbbbbbbb';
  await world(async ({ W, bus, link, say, settle }) => {
    const [a, b, c, d, e] = namesOnShards(5);
    const ka = H.hubOfSubject(`acct-${a}`), kb = H.hubOfSubject(`acct-${b}`);
    const wa = await link(a, undefined, { gi: G1, gt: 'HND', gm: 'm1' });
    const wb = await link(b, undefined, { gi: G1, gt: 'HND', gm: 'm2' });
    const wc = await link(c, undefined, { gi: G2, gt: 'OWL', gm: 'm1' });
    const wd = await link(d);
    const old = await link('legacy', SOCIAL_ROOM, { gi: G1, gt: 'HND', gm: 'm3' });   // a tab from before the shards, in the guild
    for (const ws of [wa, wb, wc, wd, old]) ws.sent.length = 0;
    // a world line: the bus owes each shard one entry, after what it owed it before
    bus.room._vsend(bus.room._vsocks.get([...bus.room._vsocks.keys()].find((v) => v.startsWith(`peer-${b}~`))), '{"t":"x","k":1}');   // a frame owed b first
    await W.room(ka).raw(wa, JSON.stringify({ t: 'chat', text: 'to all' }));
    await W.room(ka).room._hubUpFlush();
    bus.room._vsend(bus.room._vsocks.get([...bus.room._vsocks.keys()].find((v) => v.startsWith(`peer-${b}~`))), '{"t":"y","k":2}');   // and one after it
    const owed = bus.room._down.get(kb);
    assert.ok(owed, 'b\'s shard is owed the line');
    assert.equal(owed.seg.length, 3, 'b\'s own frame, the line, the frame after it');
    assert.ok(owed.seg[0] instanceof Map && owed.seg[0].size === 1, 'the frame owed b alone first');
    assert.deepEqual(owed.seg[1], { all: owed.s.indexOf(owed.s.find((x) => x.includes('to all'))) }, 'the line one entry for the whole shard');
    assert.equal([...bus.room._down.values()].every((o) => o.seg.every((g) => !(g instanceof Map) || ![...g.values()].some((l) => l.some((k) => o.s[k].includes('to all'))))), true, 'never a socket\'s own entry');
    await settle();
    assert.deepEqual(wb.sent.map((f) => f.t), ['x', 'chat', 'y'], 'heard in the order the bus said them');
    for (const ws of [wa, wc, wd, old]) assert.deepEqual(ofT(ws, 'chat').map((f) => f.text), ['to all']);
    // a guild's line: the guild on every shard and the bus, nobody else
    for (const ws of [wa, wb, wc, wd, old]) ws.sent.length = 0;
    await say(wa, ka, { t: 'chat', text: 'to the hand', ch: 'guild' });
    for (const ws of [wa, wb, old]) assert.deepEqual(ofT(ws, 'chat').map((f) => f.text), ['to the hand'], 'the guild, every shard');
    for (const ws of [wc, wd]) assert.equal(ofT(ws, 'chat').length, 0, 'nobody else');
    assert.equal(bus.room._byGuild().get(G1)?.size, 3);
    // my guild online, every shard's - never me
    await link(e, undefined, { gi: G1, gt: 'HND', gm: 'm4' });   // a guildmate who comes after the index was built
    assert.equal(bus.room._byGuild().get(G1)?.size, 4, 'the guild\'s index kept as a hello lands');
    wa.sent.length = 0;
    await say(wa, ka, { t: 'find', g: 1 });
    const g = ofT(wa, 'found').at(-1);
    assert.equal(g.g, 1);
    assert.deepEqual(g.l.map((p) => p.name).sort(), [b, e, 'legacy'].sort(), 'every shard\'s and the bus\'s, never the asker');
    assert.ok(g.l.every((p) => p.gt === 'HND'), 'badged as a roster is');
    wd.sent.length = 0;
    await say(wd, H.hubOfSubject(`acct-${d}`), { t: 'find', g: 1 });
    assert.deepEqual(ofT(wd, 'found').at(-1).l, [], 'no guild, nobody');
    // the hub's budget: past HUB_FIND_ROOM_HZ_MAX a second, busy
    bus.room._findRoom = { tokens: 0, at: Date.now() };
    wa.sent.length = 0;
    bus.room._meters?.delete?.(bus.room._vsocks.get([...bus.room._vsocks.keys()].find((v) => v.startsWith(`peer-${a}~`))));
    await say(wa, ka, { t: 'find', q: b });
    assert.deepEqual(ofT(wa, 'found').at(-1), { t: 'found', q: b, l: [], busy: 1 }, 'busy, said');
    assert.equal(H.HUB_FIND_ROOM_HZ_MAX, 10);
  });
});

test('SCALE5c the World tab\'s search and the Guild tab\'s list: `/find` and `/who` ask the hub by name and its answer is a line in the tab that asked; the Guild tab asks who of the guild is online on every shard at most every HUB_GUILD_WHO_MS and lists them beside its own shard\'s (mutants: the command unknown; the answer\'s words; the guild ask unbounded; the guild list unread; the roster unmerged)', async () => {
  const { parseChatLine, foundText, HELP_LINES } = await import('../../src/net/chatCommands.js');
  const { guildRosterSource } = await import('../../src/net/roster.js');
  assert.deepEqual(parseChatLine('/find Ald'), { kind: 'find', q: 'Ald' });
  assert.deepEqual(parseChatLine('/who Mara  '), { kind: 'find', q: 'Mara' });
  assert.deepEqual(parseChatLine('/find'), { kind: 'empty', name: 'find' });
  assert.ok(HELP_LINES.some((l) => l.startsWith('/find or /who <name>')));
  assert.equal(foundText({ q: 'al', l: [{ name: 'Aldric' }, { name: 'Alma' }] }), 'Online, by "al": Aldric, Alma.');
  assert.equal(foundText({ q: 'zz', l: [] }), 'No one online by "zz".');
  assert.equal(foundText({ q: 'a', l: Array.from({ length: H.HUB_FIND_MAX }, (_, i) => ({ name: `N${i}` })) }).includes(`(the first ${H.HUB_FIND_MAX})`), true);
  assert.match(foundText({ q: 'a', l: [], busy: true }), /^Too many players are searching/);
  await quiet(() => {
    const { FakeWS, sockets } = fakeSocketClass();
    let t = 1_000_000;
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => t, rand: () => 0, presence: false });
    s.join('chat:world.3');
    sockets[0].open();
    assert.equal(s.sendGuildWho(), false, 'never before the welcome');
    sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'p-near', name: 'Near', sub: 'acct-near', gt: 'HND' }], n: 2, v: 'world192', now: t });
    assert.equal(s.sendGuildWho(), true);
    assert.deepEqual(JSON.parse(sockets[0].sent.at(-1)), { t: 'find', g: 1 });
    assert.equal(s.sendGuildWho(), false, 'once each HUB_GUILD_WHO_MS');
    t += H.HUB_GUILD_WHO_MS;
    assert.equal(s.sendGuildWho(), true);
    sockets[0].receive({ t: 'found', g: 1, l: [{ id: 'p-far', name: 'Far', sub: 'acct-far', gt: 'HND' }, { id: 'p-near', name: 'Near', sub: 'acct-near', gt: 'HND' }] });
    assert.deepEqual([...s.guildOnline.keys()], ['p-far', 'p-near']);
    const g = guildRosterSource(s, 'HND');
    assert.deepEqual([...g.peers.keys()].sort(), ['p-far', 'p-near'], 'its own shard\'s and every other\'s, once');
    assert.equal(guildRosterSource(s, null).peers.size, 0, 'no guild, a list of one');
    let found = null;
    s.onFound = (f) => { found = f; };
    sockets[0].receive({ t: 'found', q: 'x', l: [], busy: 1 });
    assert.deepEqual(found, { q: 'x', l: [], busy: true });
  });
  const world = src('src/scenes/world.js');
  // PIN MOVED, AUDIT SCALE II C-1: a hub on a relay before the shards is never asked, and the line says it needs a newer one
  assert.match(world, /if \(cmd\.kind === 'find'\) \{ findTab = tabId; const hub = chatLinks\?\.get\('world'\); if \(!hub\?\.sendFind\(cmd\.q\)\) note\(hub\?\.welcomed && !hub\.findOk \? FIND_RELAY_TEXT : FIND_OFFLINE_TEXT\); return 'read'; \}/);
  assert.match(world, /link\.onFound = \(f\) => chatLog\.push\(findTab \?\? tab\.id, \{ text: foundText\(f\), system: true \}\);/);
  assert.match(world, /if \(tabId === 'guild'\) \{ s\?\.sendGuildWho\?\.\(\); return guildRosterSource\(s, myGuildTag\(\)\); \}/);
});

test('SCALE5c a shard hands on a frame AS IT CAME, before any door of its own: a shared quest reaches the bus (the shard\'s door asks the account only the bus\'s socket carries), a frame past the hub\'s largest is refused, a socket over HUB_UP_HZ_MAX is struck, and the hello, ping and pose stay the shard\'s; the filter\'s verdict on a place name kept (mutants: the forward after the doors; the size unasked; the gate unasked; a pose handed up; the verdict kept wrong)', async () => {
  const { QUEST_PREFIX, QUEST_FRAME_MAX, sanitizeLabel, DROP_STRIKES_MAX } = await import('../../src/net/wire.js');
  assert.equal(H.HUB_FRAME_MAX, QUEST_FRAME_MAX, 'the largest frame the hub takes');
  assert.equal(H.shardKeeps('{"t":"pose","p":{}}'), true); assert.equal(H.shardKeeps('{"t":"ping","x":1}'), true); assert.equal(H.shardKeeps('{"t":"hello","id":"x"}'), true);
  assert.equal(H.shardKeeps('{"p":{},"t":"pose"}'), false, 'any other shape the bus\'s to parse');
  assert.equal(H.shardKeeps('{"t":"chat","text":"x"}'), false);
  await world(async ({ W, link }) => {
    const [a] = namesOnShards(1);
    const ka = H.hubOfSubject(`acct-${a}`);
    const R = W.room(ka);
    const wa = await link(a);
    const quest = `${QUEST_PREFIX},"q":{}}`;
    await R.raw(wa, quest);
    assert.deepEqual(R.room._up.at(-1)?.slice(1), ['f', quest], 'a shared quest handed up as it came');
    assert.equal(wa.closed, null, 'never refused at the shard\'s door');
    R.room._up.length = 0;
    await R.raw(wa, '{"t":"ping","x":1}');
    assert.equal(R.room._up.length, 0, 'a ping the shard\'s');
    R.room._upGate = new WeakMap();   // a full bucket (the quest spent one)
    for (let i = 0; i < H.HUB_UP_BURST + 3; i++) await R.raw(wa, '{"t":"chat","text":"x"}');
    assert.equal(R.room._up.length, H.HUB_UP_BURST, 'the burst handed up, the rest struck');
    assert.equal(wa.meters.junk, 3);
    assert.ok(DROP_STRIKES_MAX > 3);
    await R.raw(wa, `{"t":"chat","text":"${'x'.repeat(H.HUB_FRAME_MAX)}"}`);
    assert.equal(wa.closed?.reason, 'frame too large');
  });
  assert.equal(sanitizeLabel('COONS'), '', 'refused');
  assert.equal(sanitizeLabel('COONS'), '', 'and refused again, off the kept verdict');
  assert.equal(sanitizeLabel('Daggerfall'), 'Daggerfall');
  assert.equal(sanitizeLabel('Daggerfall'), 'Daggerfall');
});

test('SCALE5c the World tab while the hub is small (Mac\'s decision 2): a shard\'s link asks the bus for everyone online at most every HUB_WHO_MS while the hub\'s count is no more than a roster says, the bus answers the room\'s roster as a welcome cuts it - one frame a second, nobody past CHAT_ROSTER_MAX - and the roster lists them beside its own shard\'s, each once (mutants: the ask unbounded; the ask past the roster; the answer unread; the roster unmerged; the frame unkept; the list past the roster)', async () => {
  const { rosterRows } = await import('../../src/net/roster.js');
  const { CHAT_ROSTER_MAX } = await import('../../src/net/wire.js');
  await world(async ({ bus, link, say }) => {
    const names = namesOnShards(3);
    const ws = await link(names[0]);
    for (const n of names.slice(1)) await link(n);
    await link('legacy', SOCIAL_ROOM);
    const k0 = H.hubOfSubject(`acct-${names[0]}`);
    ws.sent.length = 0;
    await say(ws, k0, { t: 'find', all: 1 });
    const f = ofT(ws, 'found').at(-1);
    assert.equal(f.all, 1);
    assert.deepEqual(f.l.map((p) => p.name).sort(), [...names, 'legacy'].sort(), 'everyone, every shard and the bus');
    const kept = bus.room._everyone;
    await say(ws, k0, { t: 'find', all: 1 });
    assert.equal(bus.room._everyone, kept, 'one frame for HUB_WHO_KEEP_MS');
    bus.room._everyone = null;
    bus.room._busCount = () => CHAT_ROSTER_MAX + 1;   // a hub past a roster's worth
    ws.sent.length = 0;
    await say(ws, k0, { t: 'find', all: 1 });
    assert.deepEqual(ofT(ws, 'found').at(-1).l, [], 'nobody past a roster\'s worth - the list is its own shard\'s then');
  });
  await quiet(() => {
    const { FakeWS, sockets } = fakeSocketClass();
    let t = 1_000_000;
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => t, rand: () => 0, presence: false });
    s.join('chat:world.3');
    sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'p-near', name: 'Near', sub: 'acct-near' }], n: 3, v: 'world192', now: t });
    assert.equal(s.sendHubWho(), true);
    assert.deepEqual(JSON.parse(sockets[0].sent.at(-1)), { t: 'find', all: 1 });
    assert.equal(s.sendHubWho(), false, 'once each HUB_WHO_MS');
    sockets[0].receive({ t: 'found', all: 1, l: [{ id: 'p-far', name: 'Far', sub: 'acct-far' }, { id: 'p-near', name: 'Near', sub: 'acct-near' }, { id: 'mac-0001', name: 'Mac', sub: 'acct-mac' }] });
    assert.deepEqual([...s.hubOnline.keys()], ['p-far', 'p-near', 'mac-0001']);
    const r = rosterRows(s);
    assert.deepEqual(r.rows.map((x) => x.name), ['Far', 'Mac', 'Near'], 'its own shard\'s and every other\'s, each once, me once');
    sockets[0].receive({ t: 'n', n: CHAT_ROSTER_MAX + 1 });
    t += H.HUB_WHO_MS;
    assert.equal(s.sendHubWho(), false, 'never past a roster\'s worth');
    assert.equal(s.hubOnline.size, 0, 'and the list let go');
  });
  assert.match(src('src/scenes/world.js'), /if \(tabId === 'world' \|\| tabId === 'region'\) s\?\.sendHubWho\?\.\(\);/);
});

test('SCALE5c part two: A REGION\'S CHANNEL, FOUR WAYS - its shards beside it, an account on one by its subject; the region\'s own channel the bus: a region line and a traveller\'s mark from one shard heard on another and on a tab from before (the mark never back to its own), a shard\'s joiner told the region\'s marks, the census over every shard, everyone online for the Region tab, the hops, and a bus never another channel\'s (mutants: a region shard no channel; the bus the hub; the mark a socket each; the mark back to its sender; the joiner told nothing; the census the bus\'s own; the region\'s list unanswered; a bus taking another channel\'s shard)', async () => {
  const { CHAT_REGION_COUNT, chatRegionRoom, isChatRoom: chatRoom, isRegionRoom: regionRoom, isSocialRoom: socialRoom } = await import('../../src/net/wire.js');
  assert.equal(H.REGION_SHARDS, 4);
  assert.equal(H.REGION_CHANNELS, CHAT_REGION_COUNT, 'the politic map\'s regions, both ends');
  assert.equal(H.REGION_SHARD_ROOMS.length, CHAT_REGION_COUNT * H.REGION_SHARDS);
  for (const k of H.REGION_SHARD_ROOMS) { assert.ok(CHAT_ROOMS.has(k), k); assert.equal(chatRoom(k), true); assert.equal(regionRoom(k), true); assert.equal(socialRoom(k), false); assert.equal(H.isRegionShard(k), true); }
  for (const k of ['chat:region.62.0', 'chat:region.3.4', 'chat:region.03.1', 'chat:region.3.01', 'chat:region.3', 'chat:world.3', null]) assert.equal(H.isRegionShard(k), false, String(k));
  assert.equal(H.busOf('chat:region.7.2'), 'chat:region.7'); assert.equal(H.busOf('chat:world.3'), SOCIAL_ROOM); assert.equal(H.busOf('chat:region.7'), null);
  assert.equal(H.isChannelBus('chat:region.7'), true); assert.equal(H.isChannelBus(SOCIAL_ROOM), true); assert.equal(H.isChannelBus('chat:world.3'), false); assert.equal(H.isChannelBus('chat:region.62'), false);
  assert.equal(H.channelOf('chat:region.7.2'), 'chat:region.7'); assert.equal(H.channelOf('cell:1,2'), 'cell:1,2');
  assert.equal(H.shardOf('chat:region.7', 'acct-x'), `chat:region.7.${H.shardHash('acct-x') % H.REGION_SHARDS}`);
  assert.equal(H.shardOf(SOCIAL_ROOM, 'acct-x'), H.hubOfSubject('acct-x'));
  assert.equal(H.shardOf('chat:region.7', ''), null); assert.equal(H.shardOf('chat:world.3', 'acct-x'), null);
  assert.equal(H.hubHopOf({ t: 'hub', key: 'chat:region.7.2' }), 'chat:region.7.2'); assert.equal(H.hubHopOf({ t: 'hub', key: 'chat:region.7' }), 'chat:region.7');
  const MARK = { px: 207, py: 213, fx: 12, fy: 250, h: 64, m: 1, tv: 1 };
  const RB = chatRegionRoom(5);
  /** Names whose accounts land on distinct shards of the region. */
  const onRegionShards = (count) => { const out = [], seen = new Set(); for (let i = 0; out.length < count && i < 4096; i++) { const n = `r${i}`; const k = H.shardOf(RB, `acct-${n}`); if (!seen.has(k)) { seen.add(k); out.push(n); } } assert.equal(out.length, count); return out; };
  await world(async ({ W, link, say }) => {
    const bus = W.room(RB);
    const [a, b, c] = onRegionShards(3);
    const ka = H.shardOf(RB, `acct-${a}`), kb = H.shardOf(RB, `acct-${b}`), kc = H.shardOf(RB, `acct-${c}`);
    const wa = await link(a, ka, { kind: 'linked' }), wb = await link(b, kb);
    const old = await link('regold', RB, { hs: undefined, kind: 'linked' });   // a tab from before: the region's channel itself
    assert.equal(wa.sent[0].t, 'welcome');
    assert.equal(bus.room._vsocks.size, 2, 'the region\'s bus holds a ShardSocket each');
    assert.equal(bus.room._busKey, RB);
    for (const ws of [wa, wb, old]) ws.sent.length = 0;
    await say(wa, ka, { t: 'chat', text: 'hail, region' });
    for (const ws of [wa, wb, old]) assert.deepEqual(ofT(ws, 'chat').map((f) => f.text), ['hail, region'], 'the region\'s line on every shard and the bus');
    const sentAll = [];
    const vsendAll = bus.room._vsendAll.bind(bus.room);
    bus.room._vsendAll = (out, x) => { sentAll.push([out, x]); return vsendAll(out, x); };
    await say(wa, ka, { t: 'trav', p: MARK });
    assert.ok(sentAll.some(([out, x]) => out.startsWith('{"t":"trav"') && x === `peer-${a}`), 'the mark one entry a shard, its sender\'s own skipped');
    for (const ws of [wb, old]) assert.deepEqual(ofT(ws, 'trav').map((f) => [f.id, f.p?.px]), [[`peer-${a}`, MARK.px]], 'the mark on every other shard and the bus');
    assert.equal(ofT(wa, 'trav').length, 0, 'never back to its own');
    const wc = await link(c, kc);
    assert.deepEqual(ofT(wc, 'trav').map((f) => f.id), [`peer-${a}`], 'a shard\'s joiner told the region\'s marks by the bus');
    const census = await (await bus.room._sdCensusInternal()).json();
    assert.equal(census.n, 2, 'the census over every shard: the two registered accounts, wherever they stand');
    wb.sent.length = 0;
    await say(wb, kb, { t: 'find', all: 1 });
    assert.deepEqual(ofT(wb, 'found').at(-1).l.map((p) => p.name).sort(), [a, b, c, 'regold'].sort(), 'everyone in the region, for the Region tab');
    // the hops
    const wrong = H.REGION_SHARD_ROOMS.find((k) => H.busOf(k) === RB && k !== ka);
    const hop = await link(a, wrong, { peer: `peer-${a}-x` });
    assert.deepEqual(hop.sent, [{ t: 'hub', key: ka }]);
    const viaBus = await link(b, RB, { peer: `peer-${b}-y`, hs: 1 });
    assert.deepEqual(viaBus.sent, [{ t: 'hub', key: kb }]);
    // a bus never another channel's
    const res = await bus.room._hubUpInternal(new Request('https://relay.internal/', { method: 'POST', body: JSON.stringify({ hub: 'chat:world.3', e: [] }) }));
    assert.equal(res.status, 400);
  });
  await quiet(() => {
    const { FakeWS, sockets } = fakeSocketClass();
    let t = 1_000_000;
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => t, rand: () => 0, presence: false });
    s.join('chat:region.5');
    sockets[0].open();
    assert.equal(JSON.parse(sockets[0].sent.find((x) => x.startsWith('{"t":"hello"'))).hs, 1, 'a region link offers');
    sockets[0].receive({ t: 'hub', key: 'chat:world.3' });
    assert.equal(s.room, 'chat:region.5', 'never out of its own channel');
    sockets[0].receive({ t: 'hub', key: 'chat:region.5.2' });
    assert.equal(s.room, 'chat:region.5.2');
    sockets.at(-1).drop(1006);
    t += 5000; s.tick?.();
    sockets.at(-1).drop(1006);
    assert.equal(s.room, 'chat:region.5', 'a relay before them: back to the region\'s channel');
  });
  const w = src('src/scenes/world.js');
  assert.match(w, /const channelLinkRoom = \(room\) => \{\n\s*if \(!isChannelBus\(room\)\) return room;[\s\S]{0,200}?return seen === '1' \? \(shardOf\(room, storedSession\(appStorage\(\)\)\?\.id\) \?\? room\) : room;/);
  assert.match(w, /chatLog\.setRoom\('region', room, place\);\n\s*link\.join\(channelLinkRoom\(room\)\);/);
  assert.match(w, /channelOf\(link\.room\) === chatRegionRoom\(_questRegionIndex\(\)\)/);
  assert.match(w, /hubOnline: s\.hubOnline, label: place \}/);
});
