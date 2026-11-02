// HUB-PULL (2026-10-16, Mac: "Is the server okay?", then "Yes and do any other improvements along the way. I really wanna
// continue to beef up the server"; bible/11-Multiplayer/Scale-Arc.md HUB-PULL): THE BUS NEVER CALLS A SHARD. The live
// relay refused hundreds of thousands of the hub's calls a day with `Subrequest depth limit exceeded`: a Durable Object
// charges every call it makes to the newest call it is serving (workerd io-context.h, getCurrentIncomingRequest), so the
// bus's push to a shard (`/internal/hub/down`) rode the shard's hand-up it was serving, the shard's next hand-up rode
// that push, one hop deeper each round, until the runtime refused them. A shard now keeps one poll held at the bus
// (net/hubShards.js HUB_INTERNAL_POLL) and the bus answers it with what it owes. Held here over the pins' fake objects
// (test/fakeRoom.mjs fakeRooms): the loop the runtime runs (`poll: 'held'`, on the real clock), and the poll's door and
// its `gone` as the other worlds drive it. tools/mutants/hubpull.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fakeRooms } from '../fakeRoom.mjs';
import * as H from '../../src/net/hubShards.js';
import { SOCIAL_ROOM } from '../../src/net/wire.js';

const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn, log: console.log }; console.info = console.warn = console.log = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };

/** Names whose accounts (`acct-<name>`) land on distinct hub shards. */
function namesOnShards(count) {
  const out = [], seen = new Set();
  for (let i = 0; out.length < count && i < 4096; i++) { const n = `p${i}`; const k = H.hubOfSubject(`acct-${n}`); if (!seen.has(k)) { seen.add(k); out.push(n); } }
  assert.equal(out.length, count);
  return out;
}
const ofT = (ws, t, k) => ws.sent.filter((f) => f.t === t && (k === undefined || f.k === k));
const lines = (ws) => ofT(ws, 'chat').map((f) => f.text);
const HUB_RETRY_MS_HERE = 1000;   // server/src/index.js HUB_RETRY_MS
const pollReq = (body) => new Request(`https://relay.internal${H.HUB_INTERNAL_POLL}`, { method: 'POST', body: JSON.stringify(body) });

/** Until `fn()` holds, on the real clock (the held poll's loop and the batches' timers run on it here), or fail. */
async function until(fn, what, ms = 4000) {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) assert.fail(`never: ${what}`);
    await new Promise((r) => setTimeout(r, 5));
  }
}

/** A world whose shards run the loop the runtime runs, every call between its objects recorded by its target. */
async function heldWorld(fn) {
  return quiet(async () => {
    const W = fakeRooms({ poll: 'held' });
    const get = W.ROOMS.get;
    const called = [];
    W.ROOMS.get = (id) => { called.push(id); return get(id); };
    const bus = W.room(SOCIAL_ROOM);
    const link = async (n) => {
      const R = W.room(H.hubOfSubject(`acct-${n}`));
      const ws = R.connect();
      await R.hello(ws, `peer-${n}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}` });
      return ws;
    };
    try { return await fn({ W, bus, link, called, get }); } finally {
      // every socket dropped and every held poll answered with nothing: each loop finds nothing here the bus's, and ends
      for (const [, r] of W.made) for (const ws of r.sockets.slice()) await r.drop(ws);
      W.ROOMS.get = get;
      await until(() => [...W.made.values()].every((r) => { for (const [h, p] of [...r.room._polls]) r.room._pollAnswer(h, p, false); return !r.room._pollOn; }), 'every poll loop ended');
      for (const [, r] of W.made) { clearTimeout(r.room._upT); clearTimeout(r.room._downT); clearTimeout(r.room._hubCountT); clearTimeout(r.room._countT); clearTimeout(r.room._owedSoon); clearTimeout(r.room._owedLate); }
    }
  });
}

test('HUB-PULL the loop the runtime runs: a shard keeps one poll held at the bus while it holds a socket, a delivery answers it at once and the shard asks again, a line crosses shards with no hand driving it - and the bus never calls a shard (mutants: no loop on a hello; a held poll not answered by a delivery; a poll never held)', async () => {
  await heldWorld(async ({ W, bus, link, called }) => {
    const [a, b] = namesOnShards(2);
    const ka = H.hubOfSubject(`acct-${a}`), kb = H.hubOfSubject(`acct-${b}`);
    const wa = await link(a), wb = await link(b);
    await until(() => ofT(wa, 'social', 'state').length && ofT(wb, 'social', 'state').length, 'each link greeted by the bus over its poll');
    await until(() => bus.room._polls.size === 2, 'one poll held for each shard');
    assert.deepEqual(new Set(bus.room._polls.keys()), new Set([ka, kb]));
    const held = bus.room._polls.get(kb);
    wa.sent.length = wb.sent.length = 0;
    await W.room(ka).raw(wa, JSON.stringify({ t: 'chat', text: 'over the held poll' }));
    await until(() => lines(wb).includes('over the held poll'), 'the line heard on the other shard');
    await until(() => bus.room._polls.get(kb) && bus.room._polls.get(kb) !== held, 'the shard asked again, at once');
    assert.equal(bus.room._polls.size, 2, 'and one poll a shard, never two');
    assert.deepEqual(called.filter((id) => id !== SOCIAL_ROOM), [], 'every call between the objects went TO the bus - the bus never called a shard');
  });
});

test('HUB-PULL a poll that misses is asked again HUB_RETRY_MS later and its deliveries are still owed; an answer of nothing is asked again after HUB_BATCH_MS, never in a loop - nor is one of deliveries the shard ran before (mutants: a miss ending the loop; an empty answer asked again at once; a stale one counted as new)', async () => {
  await heldWorld(async ({ W, bus, link, get }) => {
    const [a, b] = namesOnShards(2);
    const kb = H.hubOfSubject(`acct-${b}`);
    const wa = await link(a), wb = await link(b);
    await until(() => bus.room._polls.size === 2, 'both polls held');
    // the next poll of b's shard misses (the bus did not answer): a's line waits in b's outbox until b's shard asks again
    let missed = 0;
    W.ROOMS.get = (id) => ({ fetch: async (req) => { if (!missed && new URL(req.url).pathname === H.HUB_INTERNAL_POLL && (await req.clone().json()).hub === kb) { missed++; throw new Error('timeout'); } return get(id).fetch(req); } });
    bus.room._pollAnswer(kb, /** @type {any} */ (bus.room._polls.get(kb)), false);   // its held poll ends; the next is the miss
    await until(() => missed === 1, 'the miss');
    const t0 = Date.now();
    await W.room(H.hubOfSubject(`acct-${a}`)).raw(wa, JSON.stringify({ t: 'chat', text: 'owed past a miss' }));
    await until(() => lines(wb).includes('owed past a miss'), 'heard once b\'s shard asked again', 5000);
    assert.ok(Date.now() - t0 >= 500, 'asked again HUB_RETRY_MS on, never at once');
    // a bus that answers nothing at once is asked again HUB_BATCH_MS on: the loop never spins (the fake answers on the
    // next turn of the event loop, so a loop that did spin is counted here rather than starving the clock)
    let empties = 0;
    W.ROOMS.get = (id) => ({ fetch: async (req) => { if (new URL(req.url).pathname === H.HUB_INTERNAL_POLL && (await req.clone().json()).hub === kb) { empties++; await new Promise((r) => setImmediate(r)); return new Response('{"ok":1,"d":[]}'); } return get(id).fetch(req); } });
    bus.room._pollAnswer(kb, /** @type {any} */ (bus.room._polls.get(kb)), false);
    await new Promise((r) => setTimeout(r, 200));
    assert.ok(empties >= 2 && empties <= 12, `an empty answer asked again HUB_BATCH_MS on (${empties} in 200 ms)`);
    // and so is a bus handing the same delivery again and again - one its shard ran already is nothing new
    const ran = /** @type {{ b: string, q: number }} */ (W.room(kb).room._downSeen);
    const stale = JSON.stringify({ ok: 1, d: [{ b: ran.b, q: ran.q, s: [], seg: [], close: [] }] });
    let stales = 0;
    W.ROOMS.get = (id) => ({ fetch: async (req) => { if (new URL(req.url).pathname === H.HUB_INTERNAL_POLL && (await req.clone().json()).hub === kb) { stales++; await new Promise((r) => setImmediate(r)); return new Response(stale); } return get(id).fetch(req); } });
    await new Promise((r) => setTimeout(r, 200));
    assert.ok(stales >= 2 && stales <= 12, `a delivery run before, handed again, asked again HUB_BATCH_MS on (${stales} in 200 ms)`);
  });
});

test('HUB-PULL the poll\'s door: a poll with `w` and nothing owed is held (HUB_POLL_MS at most), a newer one answers the older with nothing, a delivery sealed answers the held one, the shard\'s `ack` lets go what it ran, and a shard\'s first poll is told to say every socket again - told again until a poll says it heard (HUB-PULL audit: an \`rs\` answer lost never spends it) (mutants: the older poll left hanging; an ack never letting go; the hold\'s timer never set; rs spent at the first poll; the shard never saying it heard)', async () => {
  await quiet(async () => {
    const W = fakeRooms();
    const bus = W.room(SOCIAL_ROOM);
    const [a] = namesOnShards(1);
    const ka = H.hubOfSubject(`acct-${a}`);
    const R = W.room(ka);
    const wa = R.connect();
    await R.hello(wa, `peer-${a}`, null, { name: a, acct: `acct-${a}`, asecret: `secret-of-acct-${a}` });
    await R.room._hubUpFlush();
    await bus.room._downFlush();
    const first = await (await bus.room._hubPollInternal(pollReq({ hub: ka, b: R.room._boot, ack: null, gone: [] }))).json();
    assert.equal(first.rs, 1, 'a shard\'s first poll is told to say every socket again');
    assert.equal(first.rb, bus.room._boot, 'naming the bus instance that says it');
    assert.ok(first.d.length >= 1, 'with every delivery it is owed - its greeting');
    // HUB-PULL audit: that answer lost (or a poll its shard gave up on) - the next poll, saying no `rb`, is told again
    const again = await (await bus.room._hubPollInternal(pollReq({ hub: ka, b: R.room._boot, ack: null, gone: [] }))).json();
    assert.equal(again.rs, 1, 'rs said until the shard says it heard it');
    const ack = { b: bus.room._boot, q: bus.room._downSeq.get(ka) };
    const rb = first.rb;
    assert.equal((await (await bus.room._hubPollInternal(pollReq({ hub: ka, b: R.room._boot, ack, gone: [], rb }))).json()).rs, undefined, 'heard: never said again');
    // and the shard's own poll says what it heard
    let said = null;
    const get0 = W.ROOMS.get;
    W.ROOMS.get = (id) => ({ fetch: async (req) => { if (new URL(req.url).pathname === H.HUB_INTERNAL_POLL) said = (await req.clone().json()).rb ?? null; return get0(id).fetch(req); } });
    R.room._rsBoot = null;
    await R.room._hubPoll();
    assert.equal(said, null, 'a shard that heard none says none');
    await R.room._hubPoll();
    assert.equal(said, bus.room._boot, 'and once told, every poll says the bus instance it heard');
    W.ROOMS.get = get0;
    const p1 = bus.room._hubPollInternal(pollReq({ hub: ka, b: R.room._boot, ack: { b: bus.room._boot, q: bus.room._downSeq.get(ka) }, gone: [], w: 1, rb }));
    await until(() => bus.room._polls.has(ka), 'held, owed nothing');
    assert.equal(bus.room._outbox.get(ka).l.length, 0, 'what it ran let go');
    assert.ok(bus.room._polls.get(ka).t, 'held on a timer (HUB_POLL_MS)');
    let older = false;
    void p1.then(() => { older = true; });
    const p2 = bus.room._hubPollInternal(pollReq({ hub: ka, b: R.room._boot, ack: { b: bus.room._boot, q: bus.room._downSeq.get(ka) }, gone: [], w: 1, rb }));
    await until(() => older, 'the older answered at the newer, never left to its timer', 1000);
    assert.deepEqual(await (await p1).json(), { ok: 1, d: [] }, 'the older answered nothing - its shard gave up on it');
    await until(() => bus.room._polls.has(ka), 'the newer held');
    bus.room._vsendAll(JSON.stringify({ t: 'chat', text: 'to everyone' }));
    await bus.room._downFlush();
    const got = await (await p2).json();
    assert.equal(got.d.length, 1, 'a delivery sealed answers the held poll');
    assert.ok(got.d[0].s.includes(JSON.stringify({ t: 'chat', text: 'to everyone' })));
    assert.equal(bus.room._polls.size, 0);
    clearTimeout(bus.room._downT); clearTimeout(R.room._upT); clearTimeout(bus.room._countT); clearTimeout(R.room._hubCountT);
  });
});

test('HUB-PULL `gone`: a delivery naming a socket its shard no longer holds (an object reset, no close said) is told the bus on the shard\'s next poll, which lets that ShardSocket go and says its leave (mutants: gone never kept; gone never read)', async () => {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try {
    await quiet(async () => {
      const W = fakeRooms({ now: () => clock });
      const bus = W.room(SOCIAL_ROOM);
      const settle = async () => {
        for (let i = 0; i < 6; i++) {
          for (const [k, r] of [...W.made]) if (H.isChannelShard(k)) await r.room._hubUpFlush();
          await bus.room._downFlush();
          for (const [k, r] of [...W.made]) if (H.isChannelShard(k)) await r.room._hubPoll();
        }
      };
      const link = async (n, key = H.hubOfSubject(`acct-${n}`), extra = {}) => {
        const R = W.room(key);
        const ws = R.connect();
        clock += 30;
        await R.hello(ws, `peer-${n}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}`, ...extra });
        await settle();
        return ws;
      };
      const [a, b] = namesOnShards(2);
      const ka = H.hubOfSubject(`acct-${a}`), kb = H.hubOfSubject(`acct-${b}`);
      const wa = await link(a), wb = await link(b);
      const watcher = await link('watcher', SOCIAL_ROOM, { hs: undefined });
      assert.equal(bus.room._vsocks.size, 2);
      const S = W.room(ka);
      S.sockets.splice(S.sockets.indexOf(wa), 1);   // a's socket gone with its object's reset - no close said to anyone
      S.wake();
      S.room._hubSyncAt = clock;   // and its sync not yet due - only a delivery's `gone` can tell the bus
      S.room._rsBoot = bus.room._boot;   // HUB-PULL audit: nor `rs` - a woken shard says none heard and is told it (its sockets said again); this pins the delivery's own word
      watcher.sent.length = 0;
      await W.room(kb).raw(wb, JSON.stringify({ t: 'social', k: 'friend.request', peer: `peer-${a}` }));
      await settle();
      assert.equal(bus.room._vsocks.size, 1, 'the ShardSocket its shard no longer holds, let go');
      assert.ok(watcher.sent.some((f) => f.t === 'leave' && f.id === `peer-${a}`), 'its leave said');
      for (const [, r] of W.made) { clearTimeout(r.room._upT); clearTimeout(r.room._downT); clearTimeout(r.room._hubCountT); clearTimeout(r.room._countT); clearTimeout(r.room._owedSoon); clearTimeout(r.room._owedLate); }
    });
  } finally { Date.now = realNow; }
});

test('HUB-PULL audit: an `rs` answer never holds the shard\'s poll on the hand-up it asks; a sync it makes due while a hand-up is on the wire is handed after that one; and a hand-up that missed is tried again HUB_RETRY_MS on with nothing new owed (mutants: the rs hand-up awaited by the held poll; the sync made due on the wire left for the alarm; the miss never tried again)', async () => {
  await quiet(async () => {
    const W = fakeRooms();
    const [a] = namesOnShards(1);
    const S = W.room(H.hubOfSubject(`acct-${a}`));
    const B = () => W.room(SOCIAL_ROOM).room;
    const settle = async () => { for (let i = 0; i < 3; i++) { await S.room._hubUpFlush(); await B()._downFlush(); await S.room._hubPoll(); } };
    const ws = S.connect();
    await S.hello(ws, `peer-${a}`, null, { name: a, acct: `acct-${a}`, asecret: `secret-of-acct-${a}` });
    await settle();
    assert.equal(B()._vsocks.size, 1);
    const get = W.ROOMS.get;
    let release = () => {}, gate = Promise.resolve();
    const hold = () => { gate = new Promise((r) => { release = r; }); };
    let throwUp = 0;
    W.ROOMS.get = (id) => ({ fetch: async (req) => {
      if (new URL(req.url).pathname === H.HUB_INTERNAL_UP) { if (throwUp) { throwUp--; throw new Error('timeout'); } await gate; }
      return get(id).fetch(req);
    } });
    // (1) a woken bus: the shard's held poll told `rs` answers while the hand-up it asked is still on the wire
    W.room(SOCIAL_ROOM).wake();
    hold();
    S.room._hubSyncAt = Date.now();
    assert.equal(await S.room._hubPoll(true), 1, 'the held poll answered - rs, nothing else new');
    assert.ok(S.room._upBusy, 'while the hand-up it asked is still on the wire');
    release();
    await until(() => B()._vsocks.size === 1, 'the hand-up landed: the woken bus holds the socket again');
    await S.room._hubPoll();
    // (2) woken again, a hand-up already on the wire when `rs` comes: the sync is handed after it, not at the alarm
    W.room(SOCIAL_ROOM).wake();
    hold();
    S.room._hubSyncAt = Date.now();
    S.room._hubUpOwe('someone-else', 'x', 0);
    clearTimeout(S.room._upT); S.room._upT = null;
    const inflight = S.room._hubUpFlush();
    await S.room._hubPoll(true);
    release();
    await inflight;
    await until(() => B()._vsocks.size === 1 && !S.room._upBusy, 'the sync rs made due handed after the hand-up on the wire');
    await S.room._hubPoll();
    // (3) woken again and the resync's hand-up misses: tried again HUB_RETRY_MS on, with nothing new owed to start it
    W.room(SOCIAL_ROOM).wake();
    throwUp = 1;
    await S.room._hubPoll();
    assert.equal(throwUp, 0, 'the hand-up missed');
    assert.equal(B()._vsocks.size, 0);
    await until(() => B()._vsocks.size === 1, 'the miss tried again on its own', 3000);
    W.ROOMS.get = get;
    for (const [, r] of W.made) { clearTimeout(r.room._upT); clearTimeout(r.room._downT); clearTimeout(r.room._hubCountT); clearTimeout(r.room._countT); clearTimeout(r.room._owedSoon); clearTimeout(r.room._owedLate); }
  });
});

test('HUB-PULL audit: a poll backing off after a miss is asked again the moment a hand-up of its shard is answered - the bus is back - and a poll that throws is a miss, never the loop\'s end (mutants: the backoff never woken; the loop ended by one throw)', async () => {
  await heldWorld(async ({ W, bus, link, get }) => {
    const [a] = namesOnShards(1);
    const ka = H.hubOfSubject(`acct-${a}`);
    const S = W.room(ka);
    const wa = await link(a);
    await until(() => bus.room._polls.has(ka), 'the poll held');
    // the next poll misses; a moment later the shard hands something up, and the bus answers it
    let missAt = 0;
    const polls = [];
    W.ROOMS.get = (id) => ({ fetch: async (req) => {
      if (new URL(req.url).pathname === H.HUB_INTERNAL_POLL) { polls.push(Date.now()); if (!missAt) { missAt = Date.now(); throw new Error('timeout'); } }
      return get(id).fetch(req);
    } });
    bus.room._pollAnswer(ka, /** @type {any} */ (bus.room._polls.get(ka)), false);
    await until(() => missAt, 'the miss');
    await new Promise((r) => setTimeout(r, 50));
    await S.raw(wa, JSON.stringify({ t: 'chat', text: 'the bus is back' }));
    await until(() => polls.length >= 2, 'asked again');
    assert.ok(polls[1] - missAt < HUB_RETRY_MS_HERE / 2, `asked again once the hand-up was answered (${polls[1] - missAt} ms after the miss), not HUB_RETRY_MS on`);
    await until(() => bus.room._polls.has(ka), 'held again');
    // a delivery whose run throws: a miss - the loop asks again and the delivery, never acknowledged, runs then
    const real = S.room._hubDownApply.bind(S.room);
    let threw = 0;
    S.room._hubDownApply = async (d) => { if (!threw) { threw++; throw new Error('a delivery threw'); } return real(d); };
    wa.sent.length = 0;
    bus.room._vsendAll(JSON.stringify({ t: 'chat', text: 'past a throw' }));
    await bus.room._downFlush();
    await until(() => threw === 1, 'the throw');
    assert.equal(S.room._pollOn, true, 'the loop still runs');
    await until(() => lines(wa).includes('past a throw'), 'the delivery run on the next poll', 4000);
    S.room._hubDownApply = real;
  });
});
