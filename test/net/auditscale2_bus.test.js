// AUDIT SCALE II (2026-10-11, Mac: "Lets do an audit on everything. Ensure perfection"; bible/01-Overview/audits/Audit-Scale-II.md):
// THE BUS AND ITS SHARDS, AND A COURT AND ITS COPIES - the machinery SCALE5c and SCALE5d part two share
// (server/src/index.js ShardSocket, `_hub*`, `_v*`, `_down*`, `_court*`; net/hubShards.js), hardened. Every finding of the
// audit's relay lanes on it, each reproduced on the frozen head (e729cea7) before it was fixed and each pin red there: a
// stranger's hello taking a player's peer id on the bus (R2-1, R2-2, R2-12), a mute or a guild's removal that a shard
// never heard (R2-5), a woken shard that forgot its own name (R2-4 = R3-2), a woken bus that dropped frames and every
// silent shard (R2-6), a lost hand-up or delivery lost for good (R2-7), a reconnect said as a leave (R2-8), a reset
// shard's ghosts (R2-9), a hand-up of 32 MiB (R2-11), a frame kept by its first bytes (R1-7, R3-1, R3-7), a woken court
// sealing its copies' watchers (R3-6) and a court hello held unjudged (R3-11). tools/mutants/auditscale2_bus.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fakeRooms } from '../fakeRoom.mjs';
import * as H from '../../src/net/hubShards.js';
import { SOCIAL_ROOM, GATE_BRAIN_V } from '../../src/net/wire.js';
import { mintOrder, mintGuildOutOrder } from '../../src/net/identityToken.js';
import { gateTimes, gateRoomKey } from '../../src/net/gate/gateLaw.js';
import { COURT_CENTRE, BRAIN_TICK_MS } from '../../src/net/gate/gateBrain.js';
import { ROOM_CALL_MS } from '../../server/src/relayScale.js';

const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn, log: console.log }; console.info = console.warn = console.log = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };

/** Names whose accounts (`acct-<name>`) land on distinct hub shards. */
function namesOnShards(count) {
  const out = [], seen = new Set();
  for (let i = 0; out.length < count && i < 4096; i++) { const n = `p${i}`; const k = H.hubOfSubject(`acct-${n}`); if (!seen.has(k)) { seen.add(k); out.push(n); } }
  assert.equal(out.length, count);
  return out;
}

/** scale5c's world: the bus, its shards on the pins' fake objects, a clock of its own, the doors driven to rest. */
async function world(fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try {
    return await quiet(async () => {
      const W = fakeRooms({ now: () => clock });
      const bus = W.room(SOCIAL_ROOM);
      const settle = async () => {
        for (let i = 0; i < 6; i++) {
          for (const [k, r] of [...W.made]) if (H.isChannelShard(k)) await r.room._hubUpFlush();
          for (const [k, r] of [...W.made]) if (H.isChannelBus(k)) await r.room._downFlush();
          for (const [k, r] of [...W.made]) if (H.isChannelShard(k)) await r.room._hubPoll();   // HUB-PULL: each shard asks for what it is owed
        }
      };
      const link = async (n, key = H.hubOfSubject(`acct-${n}`), extra = {}) => {
        const R = W.room(key);
        const ws = R.connect();
        clock += 30;
        const { peer = `peer-${n}`, ...over } = extra;
        await R.hello(ws, peer, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}`, ...over });
        await settle();
        return ws;
      };
      const say = async (ws, key, o) => { await W.room(key).raw(ws, typeof o === 'string' ? o : JSON.stringify(o)); await settle(); };
      try { return await fn({ W, bus, settle, link, say, tick: (ms) => { clock += ms; } }); } finally {
        for (const [, r] of W.made) { clearTimeout(r.room._upT); clearTimeout(r.room._downT); clearTimeout(r.room._hubCountT); clearTimeout(r.room._owedSoon); clearTimeout(r.room._owedLate); clearTimeout(r.room._countT); }
      }
    });
  } finally { Date.now = realNow; }
}
const ofT = (ws, t, k) => ws.sent.filter((f) => f.t === t && (k === undefined || f.k === k));
const lines = (ws) => ofT(ws, 'chat').map((f) => f.text);
const holders = (bus, id) => [...bus.room._all()].filter(([, b]) => b.id === id).map(([ws, b]) => `${ws.virtual ? 'v' : 'own'}:${b.sub}`);

/** scale5d_court's court: a gate's court and its copies on a clock of their own. */
const DAY = 200;
const TT = gateTimes(DAY);
const KEY = gateRoomKey(DAY);
const at = (x, z) => ({ x: COURT_CENTRE[0] + x, y: 0, z: COURT_CENTRE[2] + z, yaw: 0, pitch: 0 });
const gates = (ws, k) => ws.sent.filter((m) => m.t === 'gate' && (!k || m.k === k));
async function court(fn, { start = TT.openAt + 1000 } = {}) {
  const realNow = Date.now;
  let clock = start;
  Date.now = () => clock;
  try {
    return await quiet(async () => {
      const W = fakeRooms({ now: () => clock });
      const F = W.room(KEY);
      const copy = (k) => W.room(`${KEY}#${k}`);
      const settle = async () => {
        for (let i = 0; i < 6; i++) {
          for (const [k, r] of [...W.made]) if (H.isCourtCopy(k)) await r.room._hubUpFlush();
          await F.room._downFlush();
          for (const [k, r] of [...W.made]) if (H.isCourtCopy(k)) await r.room._hubPoll();   // HUB-PULL: each copy asks for what it is owed
        }
      };
      const into = async (k, peer, pose) => { const C = copy(k); const ws = C.connect(); ws.att.key = KEY; ws.att.ly = k; clock += 10; await C.hello(ws, peer, pose); await settle(); return ws; };
      const own = async (peer, pose) => { const ws = F.connect(); clock += 10; await F.hello(ws, peer, pose); await settle(); return ws; };
      const raw = async (R, ws, s) => { await R.raw(ws, s); await settle(); };
      try { return await fn({ W, F, copy, into, own, raw, settle, set: (t) => { clock = t; }, adv: (ms) => { clock += ms; } }); } finally {
        for (const [, r] of W.made) { clearTimeout(r.room._upT); clearTimeout(r.room._downT); clearTimeout(r.room._hubCountT); clearTimeout(r.room._owedSoon); clearTimeout(r.room._owedLate); clearTimeout(r.room._countT); }
      }
    });
  } finally { Date.now = realNow; }
}
const courtVs = (F) => [...F.room._vsocks.values()].filter((v) => v.court);

test('AUDIT SCALE II R2-1 R2-2 R2-12: the id\'s secret is the bus\'s to ask - a stranger\'s hello naming a shard player\'s peer id, on the bus itself or on another shard (a region\'s too), is refused `id taken` and the player keeps the game; the player\'s own tab from before the shards is replaced by its shard\'s hello (mutants: the secret not handed up; not asked at the bus; not kept there; the same id not replaced)', async () => {
  await world(async ({ bus, link }) => {
    const [v, w, z] = namesOnShards(3);
    const victim = await link(v);
    const mal = await link('mallory', SOCIAL_ROOM, { peer: `peer-${v}`, secret: 'mallorys-own-secret', hs: undefined });
    assert.equal(mal.closed?.reason, 'id taken', 'a hello on the bus with the id and another secret');
    assert.equal(victim.closed, null, 'the player\'s socket on its shard stands (it was closed `replaced`, for good)');
    assert.equal(await bus.store.get(`secret:peer-${v}`), `secret-of-peer-${v}`, 'the bus keeps the id\'s secret, as the hub always did');
    const squat = await link(w, H.hubOfSubject(`acct-${w}`), { peer: `peer-${v}`, secret: 'squatters-own' });
    assert.equal(squat.closed?.reason, 'id taken', 'a hello on another shard with the id - the bus closes it there');
    assert.deepEqual(holders(bus, `peer-${v}`), [`v:acct-${v}`], 'one holder of the id: the player');
    // the player's own tab from before the shards, its id and its secret: replaced by its shard's newer hello
    const old = await link(z, SOCIAL_ROOM, { hs: undefined });
    const neu = await link(z);
    assert.equal(old.closed?.code, 4000, 'the older replaced');
    assert.equal(neu.closed, null);
    assert.deepEqual(holders(bus, `peer-${z}`), [`v:acct-${z}`]);
  });
  await world(async ({ W, link }) => {
    const [v] = namesOnShards(1);
    const bus = 'chat:region.5';
    const victim = await link(v, H.shardOf(bus, `acct-${v}`));
    const mal = await link('mallory', bus, { peer: `peer-${v}`, secret: 'mallorys-own-secret', hs: undefined });
    assert.equal(mal.closed?.reason, 'id taken', 'a region\'s bus the same');
    assert.equal(victim.closed, null);
    assert.equal(await W.room(bus).store.get(`secret:peer-${v}`), `secret-of-peer-${v}`);
  });
});

test('AUDIT SCALE II R2-5: the bus\'s orders hold over a shard\'s hello - a mute it applied holds through the muted player\'s reconnect on a token minted before it and through the bus\'s own wake (the shard\'s attachment is told it), and a guild\'s removal through the member\'s reconnect (mutants: the order unread at a shard\'s hello; the guild\'s removal unread; the law not told the shard; the shard not taking it)', async () => {
  for (const how of ['reconnect', 'bus woken']) {
    await world(async ({ bus, link, say, tick }) => {
      const [v, c] = namesOnShards(2);
      const kv = H.hubOfSubject(`acct-${v}`), kc = H.hubOfSubject(`acct-${c}`);
      let wv = await link(v);
      const wc = await link(c);
      const kp = await bus.signer();
      const order = await mintOrder({ s: `acct-${v}`, mu: Math.floor(Date.now() / 1000) + 3600 }, kp.privateKey, { subtle: crypto.subtle, nowS: Math.floor(Date.now() / 1000) });
      await say(wc, kc, { t: 'mute', order });
      tick(2000);
      if (how === 'bus woken') { bus.wake(); await say(wc, kc, { t: 'chat', text: 'wake it' }); }
      else wv = await link(v);   // the same tab's link blips: a token minted a moment before the order
      tick(2000);
      await say(wv, kv, { t: 'chat', text: 'muted?' });
      assert.ok(ofT(wv, 'muted').length > 0, `${how}: told it is muted`);
      assert.ok(!lines(wc).includes('muted?'), `${how}: its line reaches nobody`);
      const mine = W_attach(wv);
      assert.ok(mine?.mu > Date.now() / 1000, `${how}: the shard's own attachment carries the bus's mute (seconds)`);
    });
  }
  await world(async ({ bus, link, say, tick }) => {
    const G = 'gaaaaaaaaaa';
    const [m, o] = namesOnShards(2);
    const km = H.hubOfSubject(`acct-${m}`), ko = H.hubOfSubject(`acct-${o}`);
    let wm = await link(m, undefined, { gi: G, gt: 'HND', gm: 'm2' });
    const wo = await link(o, undefined, { gi: G, gt: 'HND', gm: 'm1' });
    const kp = await bus.signer();
    await say(wo, ko, { t: 'guildout', order: await mintGuildOutOrder({ s: `acct-${m}`, gi: G, gm: 'm2' }, kp.privateKey, { subtle: crypto.subtle, nowS: Math.floor(Date.now() / 1000) }) });
    tick(2000);
    wm = await link(m, undefined, { gi: G, gt: 'HND', gm: 'm2' });   // a token minted before the removal
    tick(2000);
    await say(wo, ko, { t: 'chat', text: 'secret plans', ch: 'guild' });
    assert.ok(!lines(wm).includes('secret plans'), 'the removed member hears its old guild no more');
    assert.equal(W_attach(wm)?.gi, undefined, 'and its shard\'s attachment wears no guild');
    void km;
  });
});
/** A test socket's attachment as its room holds it. */
function W_attach(ws) { return ws.att; }

test('AUDIT SCALE II R2-4 = R3-2: a woken shard knows its own name (its storage) - a frame said after its wake reaches the bus at once, never at its alarm a minute on; its last socket\'s leave is handed up; and it says no count of its own few as the hub\'s - every answer of the bus carries the hub\'s (mutants: the name not kept; not read back; the leave\'s count its own; the answer\'s count unread)', async () => {
  await world(async ({ W, bus, link, say, settle, tick }) => {
    const [v, c, d] = namesOnShards(3);
    const kv = H.hubOfSubject(`acct-${v}`);
    const wv = await link(v), wc = await link(c);
    await link(d);
    assert.equal(await W.room(kv).store.get(H.HUB_KEY_KEY), kv, 'its name kept');
    const S = W.room(kv);
    S.wake();
    assert.equal(S.room._hubKey, undefined);
    tick(1000);
    await say(wv, kv, { t: 'chat', text: 'after the nap' });
    assert.ok(lines(wc).includes('after the nap'), 'heard at once');
    // the shard woken again, its last socket closes: the leave goes up, and the bus lets the player go
    S.wake();
    await S.drop(wv);
    tick(1000); await settle();
    assert.equal([...bus.room._vsocks.values()].filter((x) => x.hub === kv).length, 0, 'the bus let it go');
    assert.equal(bus.room._busCount(), 2);
    // a woken shard's leave carries no count of its own (the client counts it), and the bus's answer tells it the hub's
    const [e, f] = namesOnShards(5).slice(3);
    void e; void f;
  });
  await world(async ({ W, link, settle, tick }) => {
    const names = []; for (let i = 0; names.length < 2 && i < 4096; i++) { const n = `q${i}`; if (H.hubOfSubject(`acct-${n}`) === H.hubOfSubject('acct-q0')) names.push(n); }
    const k = H.hubOfSubject('acct-q0');
    const [x, y] = names;
    const others = namesOnShards(3);
    for (const n of others) await link(n);
    const wx = await link(x), wy = await link(y);
    const S = W.room(k);
    S.wake();
    assert.equal(S.room._hubTotal, null);
    wx.sent.length = 0;
    await S.drop(wy);
    const leave = ofT(wx, 'leave').at(-1) ?? null;
    assert.ok(leave, 'the leave said');
    assert.equal(leave.n, undefined, 'a woken shard says no count of its own few as the hub\'s');
    tick(1000); await settle();
    assert.equal(S.room._hubTotal, 4, 'the bus\'s answer carried the hub\'s count');
  });
});

test('AUDIT SCALE II R2-6 (HUB-PULL): a woken bus tells each shard\'s first poll to say every socket it holds again (`rs`) - a frame said before any shard polled is handed again behind its socket\'s hello and heard, the bus holds every shard\'s sockets once they have polled, and the next line reaches every shard and a tab on the bus itself (mutants: the first poll not told; the told shard not syncing; the frame not handed again)', async () => {
  await world(async ({ W, bus, link, say, tick, settle }) => {
    const [a, b, c] = namesOnShards(3);
    const ka = H.hubOfSubject(`acct-${a}`), kb = H.hubOfSubject(`acct-${b}`);
    const wa = await link(a), wb = await link(b), wc = await link(c);
    const old = await link('legacy', SOCIAL_ROOM, { hs: undefined });
    bus.wake();
    assert.equal(bus.room._busCount(), 1, 'a woken bus holds no ShardSocket - its own tab alone');
    for (const ws of [wa, wb, wc, old]) ws.sent.length = 0;
    await W.room(ka).raw(wa, JSON.stringify({ t: 'chat', text: 'first line after the bus slept' }));
    await W.room(ka).room._hubUpFlush();   // up before any shard has polled the woken bus
    assert.ok(lines(old).includes('first line after the bus slept'), 'the frame the bus could not run, handed again behind its hello, and run');
    await settle();
    assert.ok(lines(wa).includes('first line after the bus slept'), 'its sender hears it back');
    assert.equal(bus.room._busCount(), 4, 'every shard\'s first poll told it to say every socket - all held again');
    for (const ws of [wa, wb, wc, old]) ws.sent.length = 0;
    await say(wb, kb, { t: 'chat', text: 'and the next' });
    for (const ws of [wa, wc, old]) assert.ok(lines(ws).includes('and the next'), 'heard by every shard and the bus\'s own tab');
    tick(1000); await settle();
  });
});

test('AUDIT SCALE II R2-7: every hand-up and delivery is numbered - one that did not land goes again as it was (a line is heard, once), one that landed twice runs once, and a close the shard never heard is said again at its sync (mutants: a missed hand-up not kept; not sent again; a replay run; a missed delivery let go; a not-ok answer taken; the close not said again)', async () => {
  await world(async ({ W, bus, link, say, settle, tick }) => {
    const [a, c] = namesOnShards(2);
    const ka = H.hubOfSubject(`acct-${a}`);
    const wa = await link(a, undefined, { kind: 'linked' }), wc = await link(c);   // PIN MOVED (AUDIT SAFE RELAY-11): a registered speaker - a guest's channel lines are paced now
    const get = W.ROOMS.get;
    let failed = 0;
    W.ROOMS.get = (id) => (id === SOCIAL_ROOM && !failed ? { fetch: async (req) => { if (new URL(req.url).pathname === H.HUB_INTERNAL_UP) { failed++; throw new Error('timeout'); } return get(id).fetch(req); } } : get(id));
    await say(wa, ka, { t: 'chat', text: 'line one' });
    W.ROOMS.get = get;
    assert.equal(failed, 1);
    tick(1000); await settle();
    await say(wa, ka, { t: 'chat', text: 'line two' });
    assert.deepEqual(lines(wc), ['line one', 'line two'], 'the missed hand-up sent again, in its order');
    const S = W.room(ka).room;
    const realUp = bus.room._hubUpInternal.bind(bus.room);
    // a hand-up answered not ok with nothing run (the bus refused it, a proxy's 503) is a miss: sent again, heard
    tick(5000);
    let refused = 0;
    bus.room._hubUpInternal = async (req) => { const body = await req.clone().json(); if (!refused && body.e?.some((e) => e[1] === 'f')) { refused++; return new Response('busy', { status: 503 }); } return realUp(req); };
    await say(wa, ka, { t: 'chat', text: 'line three' });
    tick(1000); await settle();
    assert.equal(refused, 1);
    assert.equal(lines(wc).filter((t) => t === 'line three').length, 1, 'refused, sent again: heard');
    // one that landed but whose answer was lost, sent again, runs once
    tick(5000);
    let ran = 0;
    bus.room._hubUpInternal = async (req) => { const body = await req.clone().json(); const res = await realUp(new Request(req.url, { method: 'POST', body: JSON.stringify(body) })); if (body.e?.some((e) => e[1] === 'f')) ran++; return ran === 1 ? new Response('lost', { status: 503 }) : res; };
    await say(wa, ka, { t: 'chat', text: 'line four' });
    tick(1000); await settle();
    bus.room._hubUpInternal = realUp;
    assert.ok(ran >= 2, 'sent again');
    assert.equal(lines(wc).filter((t) => t === 'line four').length, 1, 'landed, its answer lost, sent again: heard once');
    assert.equal(S._upRetry, null);
    // HUB-PULL: a delivery stays until its shard says it ran it - a poll whose answer was lost is answered with it again
    tick(5000);
    const kc = H.hubOfSubject(`acct-${c}`), Sc = W.room(kc).room;
    const realPoll = bus.room._hubPollInternal.bind(bus.room);
    let lost = 0;
    bus.room._hubPollInternal = async (req) => { const body = await req.clone().json(); const res = await realPoll(new Request(req.url, { method: 'POST', body: JSON.stringify(body) })); if (!lost && body.hub === kc && (await res.clone().json()).d?.length) { lost++; return new Response('lost', { status: 503 }); } return res; };
    await say(wa, ka, { t: 'chat', text: 'line five' });
    bus.room._hubPollInternal = realPoll;
    assert.equal(lost, 1, 'an answer lost on the way');
    assert.equal(lines(wc).filter((t) => t === 'line five').length, 1, 'answered again with it: heard');
    // and one handed twice (two polls on the wire, carrying one ack) runs once
    tick(5000);
    await W.room(ka).raw(wa, JSON.stringify({ t: 'chat', text: 'line six' }));
    await W.room(ka).room._hubUpFlush(); await bus.room._downFlush();   // sealed for c's shard, not yet asked for
    await Promise.all([Sc._hubPoll(), Sc._hubPoll()]);
    assert.equal(lines(wc).filter((t) => t === 'line six').length, 1, 'a delivery handed twice: heard once');
  });
  await world(async ({ W, link, say, settle, tick }) => {
    const [a, c] = namesOnShards(2);
    const ka = H.hubOfSubject(`acct-${a}`);
    const wc = await link(c);
    await link(a, SOCIAL_ROOM, { peer: `peer-${a}-old`, hs: undefined });   // a's tab before the shards holds the seat
    const get = W.ROOMS.get;
    let cut = true, failed = 0;
    // HUB-PULL: shard a's polls never reach the bus - its every delivery owed, never handed
    W.ROOMS.get = (id) => (id === SOCIAL_ROOM ? { fetch: async (req) => { if (cut && new URL(req.url).pathname === H.HUB_INTERNAL_POLL && (await req.clone().json()).hub === ka) { failed++; throw new Error('timeout'); } return get(id).fetch(req); } } : get(id));
    const wa = await link(a);   // not claiming: the bus refuses it and closes it - the close owed a, never handed
    assert.ok(failed > 0);
    assert.equal(wa.closed, null, 'the close never got there');
    tick(H.HUB_SILENT_MS + 1000); await W.room(SOCIAL_ROOM).fire();   // a shard silent past HUB_SILENT_MS: what it was owed let go
    assert.equal(W.room(SOCIAL_ROOM).room._outbox.has(ka), false, 'the silent shard\'s deliveries let go');
    cut = false;
    tick(61_000); await W.room(ka).fire(); await settle();
    assert.equal(wa.closed?.code, 4000, 'said again at its shard\'s sync - never open and mute');
    W.ROOMS.get = get;
    void wc; void say;
  });
});

test('AUDIT SCALE II R2-8: a reconnect on a shard whose old socket the bus owes a delivery is said as a reconnect - its leave never said (mutants: a socket whose replacement is owed reported gone)', async () => {
  await world(async ({ W, bus, link, settle }) => {
    const [v, c] = namesOnShards(2);
    const kv = H.hubOfSubject(`acct-${v}`), kc = H.hubOfSubject(`acct-${c}`);
    await link(v);
    const wc = await link(c);
    const watcher = await link('watcher', SOCIAL_ROOM, { hs: undefined });
    watcher.sent.length = 0;
    await W.room(kc).raw(wc, JSON.stringify({ t: 'social', k: 'friend.request', peer: `peer-${v}` }));
    await W.room(kc).room._hubUpFlush();
    const R = W.room(kv); const wv2 = R.connect();
    await R.hello(wv2, `peer-${v}`, null, { name: v, acct: `acct-${v}`, asecret: `secret-of-acct-${v}` });
    await bus.room._downFlush();
    await R.room._hubPoll(); await R.room._hubPoll();   // HUB-PULL: the delivery run, and the next poll (its `gone`) at the bus before the reconnect's hand-up
    await settle();
    assert.ok(!watcher.sent.some((f) => f.t === 'leave' && f.id === `peer-${v}`), 'no leave said for a reconnect');
    assert.equal(wv2.closed, null);
  });
});

test('AUDIT SCALE II R2-9: a shard the bus has not heard from in HUB_SILENT_MS has lost its sockets - the bus lets go of every ShardSocket of its (mutants: never let go; the silence not stamped)', async () => {
  assert.equal(H.HUB_SILENT_MS, 3 * H.HUB_SYNC_MS);
  await world(async ({ W, bus, link, say, tick }) => {
    const [v, c] = namesOnShards(2);
    const kv = H.hubOfSubject(`acct-${v}`), kc = H.hubOfSubject(`acct-${c}`);
    await link(v);
    const wc = await link(c);
    const S = W.room(kv);
    S.sockets.length = 0; S.room._idx = null;   // the shard reset: its sockets gone, nothing said
    S.room._hubUpFlush = () => Promise.resolve();   // and it hands nothing up again (no alarm: it holds no socket)
    assert.equal(bus.room._busCount(), 2);
    const kept = [...bus.room._vsocks.values()].find((x) => x.hub === kc);
    tick(H.HUB_SILENT_MS + 1000);
    await say(wc, kc, { t: 'chat', text: 'anyone' });   // any other shard's hand-up
    assert.equal([...bus.room._vsocks.values()].filter((x) => x.hub === kv).length, 0, 'its ghosts let go');
    assert.equal(bus.room._busCount(), 1);
    assert.equal(bus.room._vsocks.get(kept.vid), kept, 'the shard heard from keeps its very ShardSockets - never let go and said again');
  });
});

test('AUDIT SCALE II R2-11: a hand-up carries HUB_BATCH_BYTES at most (one event at least) and a shard holds HUB_UP_QUEUE_BYTES owed at most - past it a frame is dropped, never queued without end (mutants: no byte cap; no queue bound)', async () => {
  assert.equal(H.HUB_BATCH_BYTES, 1024 * 1024);
  assert.equal(H.HUB_UP_QUEUE_BYTES, 8 * 1024 * 1024);
  await world(async ({ W, link }) => {
    const k = 'chat:world.3';
    const names = []; for (let i = 0; names.length < 16 && i < 8192; i++) { const n = `g${i}`; if (H.hubOfSubject(`acct-${n}`) === k) names.push(n); }
    const socks = [];
    for (const n of names) socks.push(await link(n));
    const S = W.room(k);
    const sizes = [];
    const get = W.ROOMS.get;
    W.ROOMS.get = (id) => (id === SOCIAL_ROOM ? { fetch: async (req) => { if (new URL(req.url).pathname === H.HUB_INTERNAL_UP) sizes.push((await req.clone().text()).length); return get(id).fetch(req); } } : get(id));
    S.room._hubUpFlush = () => Promise.resolve();   // hold the queue while it fills
    const big = JSON.stringify({ t: 'chat', text: 'x'.repeat(H.HUB_FRAME_MAX - 64) });
    for (let i = 0; i < 32; i++) for (const ws of socks) await S.raw(ws, big);
    assert.ok(S.room._upBytes <= H.HUB_UP_QUEUE_BYTES, `the queue bounded (${S.room._upBytes})`);
    assert.ok(S.room._up.length < 32 * socks.length, 'past the bound, frames dropped');
    delete S.room._hubUpFlush;
    await S.room._hubUpFlush();
    W.ROOMS.get = get;
    assert.ok(sizes.length > 1 && sizes.every((n) => n <= H.HUB_BATCH_BYTES + 4096), `every hand-up within the byte cap (${sizes.join(',')})`);
  });
});

test('AUDIT SCALE II R1-7: a shard keeps a frame by what it IS - `{"t":"pose","t":"chat",...}` parses as a line and goes to the bus, whose mute holds: a shard-mate never hears it (mutants: kept by its first key)', async () => {
  await world(async ({ bus, link, say }) => {
    const k = H.hubOfSubject('acct-q0');
    const mates = []; for (let i = 0; mates.length < 2 && i < 8192; i++) { const n = `q${i}`; if (H.hubOfSubject(`acct-${n}`) === k) mates.push(n); }
    const [v, mate] = mates;
    const [far] = namesOnShards(1).filter((n) => H.hubOfSubject(`acct-${n}`) !== k).concat(namesOnShards(2)).filter((n) => H.hubOfSubject(`acct-${n}`) !== k);
    const wv = await link(v), wm = await link(mate), wf = await link(far);
    const kp = await bus.signer();
    const order = await mintOrder({ s: `acct-${v}`, mu: Math.floor(Date.now() / 1000) + 3600 }, kp.privateKey, { subtle: crypto.subtle, nowS: Math.floor(Date.now() / 1000) });
    await say(wf, H.hubOfSubject(`acct-${far}`), { t: 'mute', order });
    const told = ofT(wv, 'muted').length;
    await say(wv, k, '{"t":"pose","t":"chat","text":"past the mute"}');
    assert.ok(!lines(wm).includes('past the mute'), 'its shard-mate never hears it - the shard ran no line of its own');
    assert.ok(!lines(wf).includes('past the mute'));
    assert.ok(ofT(wv, 'muted').length > told, 'the bus judged it, and said so');
    // and anyone's such line is the bus's to fan: a player on another shard hears it, its shard-mate once
    await say(wm, k, '{"t":"pose","t":"chat","text":"from a mate"}');
    assert.deepEqual(lines(wf).filter((t) => t === 'from a mate'), ['from a mate'], 'the bus ran it - the far shard heard it');
    assert.equal(lines(wv).filter((t) => t === 'from a mate').length, 1, 'its shard-mate once');
  });
});

test('AUDIT SCALE II R3-1 R3-7: a copy holds no fight - a gate word in any key order goes to the court, written `t` first; a copy stands no fight and tells the hub nothing; the court hears from a copy\'s socket its gate words alone (mutants: the copy\'s gate arm runs the fight; the word handed up as it came; the court runs a copy\'s line)', async () => {
  await court(async ({ W, F, copy, into, own, raw }) => {
    const C = copy(1);
    const a = await own('peer-0001', at(0, 4));
    await raw(F, a, JSON.stringify({ t: 'gate', k: 'in', lv: 30, bv: GATE_BRAIN_V }));
    const c = await into(1, 'peer-0002', at(0, 3));
    const sent = [];
    const keep = C.room._hubUpOwe.bind(C.room);
    C.room._hubUpOwe = (vid, kind, p) => { if (kind === 'f') sent.push(p); return keep(vid, kind, p); };
    await raw(C, c, JSON.stringify({ k: 'in', t: 'gate', lv: 30, bv: GATE_BRAIN_V }));
    assert.equal(C.room._fight ?? null, null, 'the copy stood no fight');
    assert.equal(C.store.has('gatefight'), false);
    assert.ok(F.room._fight?.players?.['acct-peer-0002'], 'the court\'s fight took it');
    assert.ok(gates(c, 'st').length >= 1, 'answered through its copy');
    assert.ok(sent.length >= 1 && sent.every((s) => s.startsWith('{"t":"gate",')), `handed up as one gate frame, \`t\` first (${sent[0]})`);
    // a frame that begins as a gate word and parses as a line: the copy's own crowd's, never the court's
    a.sent.length = 0;
    await raw(C, c, '{"t":"gate","t":"chat","text":"over the wall"}');
    assert.ok(!a.sent.some((m) => m.t === 'chat'), 'the court\'s crowd heard no copy\'s line');
    void W;
  });
  // and a court that hears a line from a copy's socket (a copy of another build) runs none of it
  await court(async ({ F, into }) => {
    const c = await into(2, 'peer-0003', at(1, 3));
    const [v] = courtVs(F);
    const a = F.connect(); await F.hello(a, 'peer-0004', at(0, 2));
    a.sent.length = 0;
    await F.room.webSocketMessage(v, JSON.stringify({ t: 'chat', text: 'smuggled' }));
    assert.ok(!a.sent.some((m) => m.t === 'chat'), 'junked');
    void c;
  });
});

test('AUDIT SCALE II R3-6 R3-11: a woken court keeps its copies\' watchers past the seal (a hello said again is judged by the clock), and a copy\'s hello whose judgement throws is refused `busy`, never held (mutants: a re-hello judged as a newcomer; held before it is judged)', async () => {
  await court(async ({ F, copy, into, settle, set }) => {
    const w = await into(1, 'peer-0005', at(2, 2));
    set(TT.sealAt + 60_000);
    F.wake();
    await settle();   // HUB-PULL: the copy's first poll to the woken court is told to say every socket again
    assert.equal(w.closed, null, 'its watcher stays');
    assert.ok(courtVs(F).some((v) => v.att.id === 'peer-0005'), 'held again by the court');
  });
  await court(async ({ F, into }) => {
    F.room._gateFightOf = async () => { throw new Error('storage overloaded'); };
    const n = await into(1, 'peer-0006', at(3, 3));
    assert.equal(courtVs(F).length, 0, 'never held unjudged');
    assert.equal(n.closed?.code, 1013, 'refused busy - its client asks again');
  });
});

test('AUDIT SCALE II D-7 D-8: the bus greets a ShardSocket once (a hello said again for one it holds is nothing), a hand-up carries HUB_BATCH_MAX events at most, and the machinery\'s numbers are the record\'s (mutants: a second hello greeted; the batch unbounded; each number moved)', async () => {
  assert.equal(H.HUB_BATCH_MAX, 512);
  assert.equal(H.HUB_BATCH_MS, 25);
  assert.equal(H.HUB_SYNC_MS, 60_000);
  assert.equal(H.HUB_COUNT_MS, 1000);
  assert.equal(H.HUB_UP_HZ_MAX, 16);
  assert.equal(H.HUB_UP_BURST, 32);
  assert.equal(H.HUB_WHO_MS, 15_000);
  assert.equal(H.HUB_FRAME_MAX, 64 * 1024);
  assert.equal(H.HUB_POLL_MS, 20_000);   // HUB-PULL
  assert.equal(H.HUB_OUTBOX_MAX, 1024);   // HUB-PULL audit: PIN MOVED from 256 - a poll's whole deadline of deliveries
  assert.equal(H.HUB_OUTBOX_BYTES, 2 * 1024 * 1024);   // HUB-PULL audit: PIN MOVED from 4 MiB - every shard's at once a quarter of an object's memory
  assert.ok(H.HUB_OUTBOX_MAX * H.HUB_BATCH_MS >= H.HUB_POLL_MS + ROOM_CALL_MS, 'a delivery every batch, kept as long as a poll may be out');
  assert.ok(H.HUB_SHARDS * H.HUB_OUTBOX_BYTES <= 32 * 1024 * 1024, 'the bus\'s outboxes, every shard stalled, a quarter of 128 MB at most');
  await world(async ({ bus, link, settle }) => {
    const [v] = namesOnShards(1);
    const wv = await link(v);
    const [vws] = [...bus.room._vsocks.values()];
    const before = wv.sent.length;
    await bus.room._vhello(vws.hub, vws.vid, { att: { ...vws.att, key: vws.hub }, m: { secret: `secret-of-peer-${v}` } });
    await settle();
    assert.equal(bus.room._vsocks.size, 1);
    assert.equal([...bus.room._vsocks.values()][0], vws, 'the same ShardSocket');
    assert.equal(wv.closed, null, 'its socket never closed as replaced');
    assert.equal(wv.sent.length, before, 'greeted once');
  });
  await world(async ({ W, link }) => {
    const [v] = namesOnShards(1);
    await link(v);
    const S = W.room(H.hubOfSubject(`acct-${v}`)).room;
    const vid = [...S._vidIdx.keys()][0] ?? [...S._all()].map(([, b]) => b.vid).find(Boolean);
    for (let i = 0; i < 700; i++) S._up.push([vid, 'f', '{"t":"chat","text":"x"}']);
    const took = S._upTake();
    assert.equal(took.length, H.HUB_BATCH_MAX, 'one hand-up HUB_BATCH_MAX at most');
    S._up.length = 0;
  });
});
