// SCALE5a (2026-10-10, Mac: "we just hit 500 online people. I think its time to scale up our server and improve
// performance for more people"; bible/11-Multiplayer/Scale-Arc.md SCALE5a): THE HUB'S HELLO AND LEAVE WITHOUT A WALK OF
// THE WORLD, AND A BUSY REFUSAL THAT MINTS NOTHING. Every player online holds a socket in the hub (`chat:world`), and a
// relay deploy brings all of them back through its hello inside a minute: each hello walked every socket six times and
// rebuilt the account index (O(N) a hello, O(N^2) a wave), each leave three times, and every hello the hub's gate
// refused busy - hundreds a wave - cost the account service another token mint. The relay's half over the real Room on
// the pins' fake object (test/fakeRoom.mjs); the client's over a fake socket and a fake service.
// tools/mutants/scale5a.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { fakeRoom } from './fakeRoom.mjs';
import { SOCIAL_ROOM, CHAT_HELLO_HZ_MAX, CLOSE_BUSY, BUSY_TOKEN_UNREAD, ACCOUNT_TABS_MAX, SERPENT_INTERNAL_FELL, SERPENT_RC_PREFIX, CHAT_WORLD_ROOM, CHAT_ROSTER_MAX } from '../src/net/wire.js';
import { rosterRows } from '../src/net/roster.js';
import { OnlineSession } from '../src/net/online.js';
import { accountTokenMinter, SESSION_KEY } from '../src/net/accountClient.js';
import { mintSerpentReceipt } from '../src/net/serpentReceipt.js';
import { fakeSocketClass } from './fakeSocket.mjs';

const { subtle } = globalThis.crypto;
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn, log: console.log }; console.info = console.warn = console.log = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };

/** A seeded roll (mulberry32) - every story replays. */
function roll(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** A hub on a clock of its own - the room reads Date.now. */
async function onClock(fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try { return await quiet(() => fn({ now: () => clock, tick: (ms) => { clock += ms; } })); } finally { Date.now = realNow; }
}

// ═══ THE ORACLE: WHAT A WALK OF EVERY SOCKET ANSWERED ═════════════════════════════════════════════════════════════════

/** `_socketsOf` as the walk built it before SCALE5a: every hello'd socket of the account in the index's order, the newest
 *  ACCOUNT_TABS_MAX by the hello's `since` when over the bound, one `except`ed. */
function walkSocketsOf(room, acct, except = null) {
  const idx = room._all();
  let s = [...idx].filter(([, a]) => a.id && a.acct === acct).map(([ws]) => ws);
  if (s.length > ACCOUNT_TABS_MAX) { s.sort((x, y) => (idx.get(y)?.since ?? 0) - (idx.get(x)?.since ?? 0)); s = s.slice(0, ACCOUNT_TABS_MAX); }
  return except ? s.filter((ws) => ws !== except) : s;
}
/** `_otherTabsOf` as the walk built it. */
function walkOtherTabs(room, sub, ws, id) {
  const out = [];
  for (const [other, b] of room._all()) if (other !== ws && b.id && b.id !== id && b.sub === sub && !room._dead.has(other) && !room._gone.has(other)) out.push(other);
  return out;
}

/** A story of hub hellos and drops: ids that reconnect, players with tabs that claim the seat or do not, the clock walked
 *  past the index's trust. The hub's account is the token's verified subject and ONE-SEAT gives it one hub socket, so
 *  here every set holds at most one (AUDIT SCALE5a D9: this said profiles shared ran an account past its bound - they do
 *  not); the order, the bound and the dead are `indexStory`'s, at the index's own doors. */
async function story(seed, { steps = 160, ids = 24, subs = 10, accts = 3 } = {}) {
  return onClock(async ({ tick }) => {
    const rnd = roll(seed), pick = (n) => Math.floor(rnd() * n);
    const r = fakeRoom(SOCIAL_ROOM);
    const live = [];
    const names = new Map();
    let checked = 0;
    const check = (label) => {
      const room = r.room;
      const name = (ws) => names.get(ws) ?? '?';
      // the hub's account is the token's verified subject (`acct: who.subject || m.acct`): every one in the room, and one not
      const keys = new Set(['nobody-here']);
      for (const [, b] of room._all()) if (b.acct) keys.add(b.acct);
      for (const acct of keys) {
        assert.deepEqual(room._socketsOf(acct).map(name), walkSocketsOf(room, acct).map(name), `${label}: ${acct}'s sockets`);
        const some = live[pick(live.length || 1)];
        if (some) assert.deepEqual(room._socketsOf(acct, some).map(name), walkSocketsOf(room, acct, some).map(name), `${label}: ${acct}'s but one`);
      }
      for (let k = 0; k < subs; k++) {
        const sub = `player-${k}`, ws = live[pick(live.length || 1)] ?? null, id = ws ? room._attach(ws).id : null;
        assert.deepEqual(room._otherTabsOf(sub, ws, id).map(name), walkOtherTabs(room, sub, ws, id).map(name), `${label}: ${sub}'s other tabs`);
      }
      checked++;
    };
    for (let i = 0; i < steps; i++) {
      tick(25 + pick(400));   // past the hello gate, and now and then past IDX_TRUST_MS
      if (live.length && rnd() < 0.3) {
        const ws = live.splice(pick(live.length), 1)[0];
        await r.drop(ws);
      } else {
        const ws = r.connect();
        names.set(ws, `s${i}`);
        const n = pick(ids), sub = `player-${n % subs}`, acct = `profile-${pick(accts)}`;
        await r.hello(ws, `peer-${String(n).padStart(4, '0')}`, null, { tokenSub: sub, cl: rnd() < 0.5 ? 1 : undefined, acct, asecret: `asecret-of-${acct}` });
        if (!ws.closed) live.push(ws);
        for (let j = live.length - 1; j >= 0; j--) if (live[j].closed) live.splice(j, 1);
      }
      check(`seed ${seed} step ${i}`);
    }
    return { checked, r };
  });
}

/** A story at the index's own doors - sockets adopted, attachments set (an id, an account, a subject, a `since`) and
 *  cleared, sockets forgotten, and sockets the runtime lets go of unannounced so the next walk past IDX_TRUST_MS finds
 *  them gone - with few accounts and many sockets each, so an account runs past ACCOUNT_TABS_MAX and two hellos share a
 *  `since`. Whatever the hub's doors make of a hello, these are the moves the index can be asked to keep. */
async function indexStory(seed, steps = 400) {
  return onClock(async ({ tick, now }) => {
    const rnd = roll(seed), pick = (n) => Math.floor(rnd() * n);
    const r = fakeRoom(SOCIAL_ROOM);
    const room = r.room;
    const names = new Map(), name = (ws) => names.get(ws) ?? '?';
    let over = 0, checks = 0;
    for (let i = 0; i < steps; i++) {
      const u = rnd(), socks = [...room._all().keys()];
      if (u < 0.3 || !socks.length) { const ws = r.connect(); names.set(ws, `s${i}`); }
      else if (u < 0.75) {
        const ws = socks[pick(socks.length)], a = room._attach(ws);
        const id = rnd() < 0.15 ? null : `peer-${pick(30)}`;
        room._setAttach(ws, { ...a, id, acct: rnd() < 0.1 ? undefined : `acct-${pick(3)}`, sub: `player-${pick(4)}`, since: now() - pick(3) * 1000 }, rnd() < 0.3);
      } else if (u < 0.88) { const ws = socks[pick(socks.length)]; room._forget(ws); const j = r.sockets.indexOf(ws); if (j >= 0) r.sockets.splice(j, 1); }
      else if (u < 0.92) { const ws = socks[pick(socks.length)]; const j = r.sockets.indexOf(ws); if (j >= 0) r.sockets.splice(j, 1); }   // gone from the runtime, unannounced
      else if (u < 0.95) { const ws = socks[pick(socks.length)], a = room._attach(ws); room._forget(ws); room._setAttach(ws, { ...a, id: `peer-${pick(30)}`, acct: `acct-${pick(3)}`, sub: `player-${pick(4)}` }); }   // forgotten and set again at once: last in the index's order now
      else tick(1100);   // past IDX_TRUST_MS: the next ask walks the runtime's list
      for (const acct of ['acct-0', 'acct-1', 'acct-2', 'nobody']) {
        const got = room._socketsOf(acct);
        assert.deepEqual(got.map(name), walkSocketsOf(room, acct).map(name), `seed ${seed} step ${i}: ${acct}`);
        if ((room._byAcct().get(acct)?.size ?? 0) > ACCOUNT_TABS_MAX) over++;
        checks++;
      }
      // AUDIT SCALE5a D7: a kept index lives as long as the object - a key whose last socket left goes with it
      for (const m of [room._acctIdx, room._subIdx]) if (m) for (const [k, set] of m) assert.ok(set.size > 0, `seed ${seed} step ${i}: an empty set kept for ${k}`);
      for (const sub of ['player-0', 'player-1', 'player-2', 'player-3']) {
        const all = [...room._all().keys()], ws = all[pick(all.length || 1)] ?? null, id = ws ? room._attach(ws).id : null;
        assert.deepEqual(room._otherTabsOf(sub, ws, id).map(name), walkOtherTabs(room, sub, ws, id).map(name), `seed ${seed} step ${i}: ${sub}`);
        checks++;
      }
    }
    return { over, checks };
  });
}

test('SCALE5a the kept account index and subject index answer EXACTLY what a walk of every socket answered - each account\'s sockets in the index\'s order, the bound by the newest, one excepted; each player\'s other tabs - after every hello, reconnect, claim and drop of seeded stories (mutants: a hello\'s account change not moved; a forgotten socket left in; the order not the index\'s; a socket new to the index not placed last; the bound unread; the subject index not moved)', async () => {
  let checks = 0, over = 0, accounts = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const { checked, r } = await story(seed);
    checks += checked;
    accounts += r.room._byAcct().size;
  }
  assert.ok(checks >= 900, `every step of the hub's own doors checked (${checks})`);
  assert.ok(accounts >= 6, 'and the stories left accounts in the hub to ask after');
  for (const seed of [11, 12, 13, 14]) { const x = await indexStory(seed); over += x.over; checks += x.checks; }
  assert.ok(over >= 20, `an account past ACCOUNT_TABS_MAX, so the bound was asked (${over})`);
});

test('SCALE5a a hub hello and leave KEEP the account index - moved one socket, never dropped and rebuilt by a walk; a channel\'s hello asks no host (mutants: the index dropped at every account change; at every forget; the host walked in a channel)', async () => {
  await onClock(async ({ tick }) => {
    const r = fakeRoom(SOCIAL_ROOM);
    const socks = [];
    for (let i = 0; i < 40; i++) { const ws = r.connect(); tick(25); await r.hello(ws, `peer-${String(i).padStart(4, '0')}`, null, { tokenSub: `player-${i}`, cl: 1, acct: `profile-${i}`, asecret: `asecret-of-profile-${i}` }); socks.push(ws); }
    const kept = r.room._byAcct(), keptSub = r.room._bySub();
    let hosts = 0;
    const realHost = r.room._hostOf.bind(r.room);
    r.room._hostOf = (...a) => { hosts++; return realHost(...a); };
    const ws = r.connect(); tick(25);
    await r.hello(ws, 'peer-0100', null, { tokenSub: 'player-100', cl: 1, acct: 'profile-100', asecret: 'asecret-of-profile-100' });
    assert.ok(!ws.closed);
    assert.equal(r.room._acctIdx, kept, 'the same index after a hello');
    assert.equal(r.room._subIdx, keptSub, 'the subject index too');
    assert.deepEqual(r.room._socketsOf('player-100'), [ws], 'with the new account in it (the hub\'s account: the token\'s verified subject)');
    assert.equal(hosts, 0, 'a channel has no host: none walked for');
    await r.drop(socks[7]);
    assert.equal(r.room._acctIdx, kept, 'and after a leave');
    assert.deepEqual(r.room._socketsOf('player-7'), [], 'without the account that left');
    // a place room still asks its host
    const w = fakeRoom('world:3,12');
    const hostOf = w.room._hostOf.bind(w.room);
    let asked = 0;
    w.room._hostOf = (...a) => { asked++; return hostOf(...a); };
    const p = w.connect(); tick(200);
    await w.hello(p, 'peer-0200', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
    assert.ok(asked >= 1, 'a place room still walks for its host');
  });
});

test('SCALE5a the join and the leave reach every hello\'d socket but the one they name - the index walked in place, a send that fails mid-walk closing its socket and the walk going on (mutants: the joiner told its own join; an unhello\'d socket told)', async () => {
  await onClock(async ({ tick }) => {
    const r = fakeRoom(SOCIAL_ROOM);
    const socks = [];
    for (let i = 0; i < 8; i++) { const ws = r.connect(); tick(25); await r.hello(ws, `peer-${String(i).padStart(4, '0')}`, null, { tokenSub: `player-${i}`, cl: 1 }); socks.push(ws); }
    const silent = r.connect();   // opened, no hello
    socks[3].send = () => { throw new Error('gone'); };
    for (const ws of socks) ws.sent.length = 0;
    const joiner = r.connect(); tick(25);
    await r.hello(joiner, 'peer-0100', null, { tokenSub: 'player-100', cl: 1 });
    const joined = (ws) => ws.sent.some((f) => f.t === 'join' && f.id === 'peer-0100');
    assert.deepEqual(socks.map(joined), [true, true, true, false, true, true, true, true], 'every hello\'d socket but the one that failed');
    assert.equal(socks[3].closed?.code, 1011, 'the failed one closed');
    assert.equal(joined(joiner), false, 'never the joiner');
    assert.equal(silent.sent.length, 0, 'never a socket that said no hello');
    assert.ok(socks[0].sent.some((f) => f.t === 'leave' && f.id === 'peer-0003'), 'the failed one\'s leave said at the reap');
    for (const ws of socks) ws.sent.length = 0;
    await r.drop(socks[5]);
    const left = (ws) => ws.sent.some((f) => f.t === 'leave' && f.id === 'peer-0005');
    assert.deepEqual([...socks.filter((_, i) => i !== 3 && i !== 5), joiner].map(left), [true, true, true, true, true, true, true], 'the leave to everyone left');
  });
});

// ═══ AUDIT SCALE5a C1-C3: THE WORLD TAB'S COUNT PAST THE CUT ═════════════════════════════════════════════════════════════

/** The room's own count: hello'd sockets neither closed by the object nor said gone - the welcome's `n`. */
function trueCount(room) { let n = 0; for (const [w, b] of room._all()) if (b.id && !room._dead.has(w) && !room._gone.has(w)) n++; return n; }

/** A channel link (the real OnlineSession) fed exactly what the relay sent the relay-side socket it is attached to. */
function observer(id, now) {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: id, id, secret: 'secret-of-' + id, WebSocketImpl: FakeWS, now, presence: false });
  s.join(CHAT_WORLD_ROOM, null); sockets[0].open();
  const c = { s, sockets, rws: null, fed: 0, id, sub: `acct-${id}` };
  c.attach = (rws) => { c.rws = rws; c.fed = 0; };
  c.pump = () => { const ws = sockets[sockets.length - 1]; if (!c.rws) return; while (c.fed < c.rws.sent.length) ws.receive(c.rws.sent[c.fed++]); };
  c.total = () => rosterRows(s).total;
  return c;
}

/** AUDIT SCALE5a (lens C's story, in the suite): the real hub past CHAT_ROSTER_MAX and three real channel links whose
 *  welcome it cut, then seeded doors - fresh joins, clean leaves, reconnects that replace and that come back after a drop,
 *  claims from another device (the links' own players' too), a socket whose send fails and whose id comes back, a joiner
 *  whose welcome fails - and, `lingering`, a runtime that keeps a socket the object closed listed until later (AUDIT
 *  ONESEAT R4). Answers every link's worst drift from the room's own count over the story. */
async function countStory(seed, ops, lingering) {
  return onClock(async ({ tick, now }) => {
    const rnd = roll(seed), pick = (a) => a[Math.floor(rnd() * a.length)];
    const r = fakeRoom(CHAT_WORLD_ROOM);
    const pending = new Set();
    const connect = () => { const ws = r.connect(); if (lingering) ws.close = function (code, reason) { this.closed = { code, reason }; pending.add(this); }; return ws; };
    const settle = () => { for (const ws of pending) { const i = r.sockets.indexOf(ws); if (i >= 0) r.sockets.splice(i, 1); } pending.clear(); };
    const live = new Map();
    let next = 0;
    const fresh = () => `c${String(next++).padStart(5, '0')}`;
    const welcomed = (ws) => ws.sent.some((f) => f.t === 'welcome');
    const join = async (id, sub, extra = {}) => { const ws = connect(); tick(25); await r.hello(ws, id, null, { tokenSub: sub, ...extra }); return ws; };
    for (let i = 0; i < CHAT_ROSTER_MAX + 6; i++) { const id = fresh(); if (i % 40 === 39) tick(1000); live.set(id, { ws: await join(id, `acct-${id}`, { cl: 1 }), sub: `acct-${id}` }); }
    tick(1000);
    const obs = [];
    for (let k = 0; k < 3; k++) { const c = observer(`obs-${k}`, now); const ws = connect(); c.attach(ws); tick(25); await r.hello(ws, c.id, null, { tokenSub: c.sub, cl: 1 }); c.pump(); obs.push(c); }
    let worst = 0;
    for (let n = 0; n < ops; n++) {
      const u = rnd(), ids = [...live.keys()];
      if (u < 0.16) { const id = fresh(); const ws = await join(id, `acct-${id}`, { cl: 1 }); if (welcomed(ws)) live.set(id, { ws, sub: `acct-${id}` }); }
      else if (u < 0.32) { const id = pick(ids), e = live.get(id); live.delete(id); tick(25); await r.drop(e.ws); }
      else if (u < 0.44) { const id = pick(ids), e = live.get(id); const ws = await join(id, e.sub); if (welcomed(ws)) e.ws = ws; else live.delete(id); }
      else if (u < 0.52) { const id = pick(ids), e = live.get(id); tick(25); await r.drop(e.ws); tick(1500); const ws = await join(id, e.sub); if (welcomed(ws)) e.ws = ws; else live.delete(id); }
      else if (u < 0.62) { const id = pick(ids), e = live.get(id); const id2 = fresh(); const ws = await join(id2, e.sub, { cl: 1 }); live.delete(id); if (welcomed(ws)) live.set(id2, { ws, sub: e.sub }); }   // C1: a claim closes the other device's tab
      else if (u < 0.70) { const id = pick(ids), e = live.get(id); e.ws.send = () => { throw new Error('gone'); }; const f = fresh(); const w0 = await join(f, `acct-${f}`, { cl: 1 }); if (welcomed(w0)) live.set(f, { ws: w0, sub: `acct-${f}` }); tick(1500); const ws = await join(id, e.sub); if (welcomed(ws)) e.ws = ws; else live.delete(id); }   // C3: its leave said, then its id back
      else if (u < 0.76) { const id = fresh(); const ws = connect(); ws.send = () => { throw new Error('gone'); }; tick(25); await r.hello(ws, id, null, { tokenSub: `acct-${id}`, cl: 1 }); }   // C2: a joiner whose welcome fails
      else if (u < 0.82) {   // a link's player claims from another device: a new link, the old one superseded
        const k = Math.floor(rnd() * obs.length), old = obs[k];
        const c = observer(`${old.id.split('-n')[0]}-n${n}`, now); c.sub = old.sub;
        const ws = connect(); c.attach(ws); tick(25); await r.hello(ws, c.id, null, { tokenSub: c.sub, cl: 1 }); obs[k] = c;
      } else if (u < 0.88) { tick(15000); for (const c of obs) c.s.tick(); }
      else { tick(1200); settle(); }
      for (const c of obs) { c.pump(); c.s.tick(); }
      if (lingering && rnd() < 0.3) settle();
      const t = trueCount(r.room);
      for (const c of obs) worst = Math.max(worst, Math.abs(c.total() - t));
    }
    return { worst, total: trueCount(r.room) };
  });
}

test('AUDIT SCALE5a C1-C3: past the roster\'s cut the World tab holds the ROOM\'S OWN COUNT - a channel\'s join and leave say it (`n`), so a claim\'s closed tab (C1), a joiner whose welcome failed (C2) and a reconnect after its old socket\'s leave (C3) move nothing; seeded stories of real channel links over the real hub, with and without a runtime that keeps a closed socket listed (mutants: `n` off the join; off the leave; counted with the dead; the client\'s count by arithmetic)', async () => {
  for (const [seed, lingering] of [[1, false], [2, true]]) {
    const { worst, total } = await countStory(seed, 220, lingering);
    assert.ok(total > CHAT_ROSTER_MAX, `the welcome was cut (${total} in the room)`);
    assert.equal(worst, 0, `seed ${seed}${lingering ? ', closes lingering' : ''}: every link's count is the room's after every door`);
  }
});

test('AUDIT SCALE5a C1-C3: EACH channel leave says the count the room can name - two sockets that die in one fan are both closed before either\'s leave is said, and neither leave counts the other (mutant: the count with the dead)', async () => {
  await onClock(async ({ tick }) => {
    const r = fakeRoom(CHAT_WORLD_ROOM);
    const socks = [];
    for (let i = 0; i < 6; i++) { const ws = r.connect(); tick(25); await r.hello(ws, `peer-${String(i).padStart(4, '0')}`, null, { tokenSub: `player-${i}`, cl: 1 }); socks.push(ws); }
    for (const k of [2, 4]) {
      socks[k].send = () => { throw new Error('gone'); };
      socks[k].close = function (code, reason) { this.closed = { code, reason }; };   // listed until its close completes (AUDIT ONESEAT R4) - in the index, id and all, while the other's leave is said
    }
    socks[0].sent.length = 0;
    const j = r.connect(); tick(25); await r.hello(j, 'peer-0100', null, { tokenSub: 'player-100', cl: 1 });   // its join's fan finds both dead
    const leaves = socks[0].sent.filter((f) => f.t === 'leave');
    assert.deepEqual(leaves.map((f) => f.id).sort(), ['peer-0002', 'peer-0004'], 'both leaves said at the reap');
    assert.deepEqual(leaves.map((f) => f.n), [5, 5], 'each says the five the room can name - never the other dead one');
    assert.equal(trueCount(r.room), 5);
  });
});

test('AUDIT SCALE5a (lens C, pre-existing): a room let go takes its count with it - a World tab superseded by another device\'s claim said "Online - 600" over an empty list (mutant: the count kept past the room)', () => quiet(() => {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => 1e6, presence: false });
  s.join(CHAT_WORLD_ROOM, null); sockets[0].open();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'aaaa-0001', name: 'Alpha' }], n: 600, v: 'world189' });
  assert.equal(rosterRows(s).total, 600, 'the cut welcome\'s count');
  sockets[0].drop(4000, 'online in another tab, window or device');
  assert.equal(s.roomCount, null, 'superseded: the count goes with the room');
  assert.equal(rosterRows(s).total, rosterRows(s).rows.length, 'and the tab counts what it lists');
}));

// ═══ THE BUSY REFUSAL THAT MINTS NOTHING ═══════════════════════════════════════════════════════════════════════════════

test('SCALE5a a hello the room\'s gate refuses busy closes 1013 with BUSY_TOKEN_UNREAD - and its token IS unspent: the same token opens the room once the gate refills, where a token a hello spent is refused (mutants: the reason never said; said by a gate asked after the token)', async () => {
  assert.equal(BUSY_TOKEN_UNREAD, 'busy, token unread');
  await onClock(async ({ tick }) => {
    const r = fakeRoom(SOCIAL_ROOM);
    const socks = [];
    for (let i = 0; i < CHAT_HELLO_HZ_MAX; i++) { const ws = r.connect(); await r.hello(ws, `peer-${String(i).padStart(4, '0')}`, null, { tokenSub: `player-${i}`, cl: 1 }); assert.ok(!ws.closed, `burst ${i}`); socks.push(ws); }
    const tok = await r.token('peer-9999', { s: 'player-9999', n: 'peer-9999' });
    const refused = r.connect();
    await r.hello(refused, 'peer-9999', null, { tok, cl: 1 });
    assert.deepEqual(refused.closed, { code: CLOSE_BUSY, reason: BUSY_TOKEN_UNREAD }, 'busy, and the token unread');
    tick(1000);
    const back = r.connect();
    await r.hello(back, 'peer-9999', null, { tok, cl: 1 });
    assert.equal(back.closed, null, 'the same token opens the room: it was never spent');
    assert.ok(back.sent.some((f) => f.t === 'welcome'));
    // the contrast: a token a hello DID spend is refused again in the same room
    await r.drop(back);
    tick(1000);
    const replay = r.connect();
    await r.hello(replay, 'peer-9999', null, { tok, cl: 1 });
    assert.ok(replay.closed && replay.closed.reason !== BUSY_TOKEN_UNREAD, 'a spent token is refused - never as unread');
  });
  // the reason is said at the gate asked before the token, and at no gate after it
  const relay = src('server/src/index.js');
  assert.equal(relay.split('BUSY_TOKEN_UNREAD); return; }').length - 1, 1, 'one door says it');
  assert.match(relay, /this\._hellos = gate\.bucket;\n\s*if \(!gate\.pass\) \{ this\._refuse\(ws, 'busy', CLOSE_BUSY, BUSY_TOKEN_UNREAD\); return; \}[^\n]*\n\s*\}\n[\s\S]{0,600}const who = await this\._named\(m, now\);/, 'the room\'s gate, before the token is read');
});

/** A device's storage holding a sign-in. */
const signedIn = () => { const m = new Map([[SESSION_KEY, JSON.stringify({ id: 'p1', secret: 'a-secret-long-enough-0001' })]]); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
/** The service's token route, each mint counted. */
function service() {
  const box = { n: 0 };
  box.fetch = async () => { box.n += 1; return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ token: `v1.claims${box.n}.sig${box.n}`, name: 'Mac', kind: 'linked', expiresAt: 1 }) }; };
  return box;
}

test('SCALE5a the minter: a token handed back for a room (`unopened`) opens that room again without a mint, within TOKEN_REUSE_MS; one never handed back is minted afresh; a stale token handed back moves nothing (mutants: unopened a no-op; it forgets every room)', async () => {
  let t = 1_000_000;
  const svc = service();
  const mint = accountTokenMinter({ fetch: svc.fetch, storage: signedIn(), now: () => t });
  const hub = 'chat:world', cell = 'world:3,12';
  const T1 = await mint(hub); mint.opened(hub, T1);
  assert.equal(await mint(cell), T1, 'the connect\'s other room: the same token'); mint.opened(cell, T1);
  assert.equal(svc.n, 1);
  mint.unopened(hub, T1);   // the hub's gate refused it busy, unread
  t += 4000;
  assert.equal(await mint(hub), T1, 'the hub again: the token it never read');
  assert.equal(svc.n, 1, 'no mint for the retry');
  mint.opened(hub, T1);
  const T2 = await mint(cell);
  assert.notEqual(T2, T1, 'the cell, never handed back: a fresh mint');
  assert.equal(svc.n, 2);
  mint.opened(cell, T2);
  mint.unopened(cell, T1);   // an older token's word: not the one held
  assert.notEqual(await mint(cell), T2, 'the held token stays spent in its room');
});

test('SCALE5a the session hands its hello\'s token back when the close says it was unread - a busy close alone, or any other, hands nothing back (mutants: never handed back; handed back on every busy close)', async () => {
  const run = async (reason) => {
    const { FakeWS, sockets } = fakeSocketClass();
    const log = [];
    const mintToken = Object.assign(async () => 'TOKEN-A', { opened: (r, t) => log.push(['opened', r, t]), unopened: (r, t) => log.push(['unopened', r, t]), coolMs: () => 0, lastWhy: null });
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => 1e6, presence: false, mintToken });
    await quiet(async () => {
      s.join('chat:world', null);
      sockets[0].open();
      for (let i = 0; i < 10; i++) await Promise.resolve();
      sockets[0].drop(CLOSE_BUSY, reason);
    });
    return log;
  };
  assert.deepEqual(await run(BUSY_TOKEN_UNREAD), [['opened', 'chat:world', 'TOKEN-A'], ['unopened', 'chat:world', 'TOKEN-A']], 'unread: handed back');
  assert.deepEqual(await run('busy'), [['opened', 'chat:world', 'TOKEN-A']], 'busy alone (a gate after the token, or a relay before this): kept spent');
});

test('AUDIT SCALE5a D4: a HALO hands its hello\'s token back on the same word - the halo\'s own room, its own token (mutant: the halo\'s close hands nothing back)', async () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const log = [];
  const mintToken = Object.assign(async (room) => `TOKEN-${room}`, { opened: (r, t) => log.push(['opened', r, t]), unopened: (r, t) => log.push(['unopened', r, t]), coolMs: () => 0, lastWhy: null });
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => 1e6, mintToken });
  await quiet(async () => {
    s.join('world:2,12', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
    s.setHalo(['world:3,12']);
    sockets[1].open();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    sockets[1].drop(CLOSE_BUSY, BUSY_TOKEN_UNREAD);
  });
  assert.deepEqual(log.filter((e) => e[1] === 'world:3,12'), [['opened', 'world:3,12', 'TOKEN-world:3,12'], ['unopened', 'world:3,12', 'TOKEN-world:3,12']], 'the halo\'s token, handed back for the halo\'s room');
});

// ═══ THE SERPENT'S RECEIPT, ASKED ONCE ═════════════════════════════════════════════════════════════════════════════════

test('SCALE5a the hub asks storage for an account\'s serpent receipt once - a hello after it finds "none" kept - and a receipt written lets every "none" go, so the next hello is handed it (mutants: no "none" kept; the "none" kept past a write)', async () => {
  await onClock(async ({ tick, now }) => {
    const r = fakeRoom(SOCIAL_ROOM);
    let reads = 0;
    const get = r.state.storage.get;
    r.state.storage.get = async (k) => { if (typeof k === 'string' && k.startsWith(SERPENT_RC_PREFIX)) reads++; return get(k); };
    const hello = async (id) => { const ws = r.connect(); tick(25); await r.hello(ws, id, null, { tokenSub: 'player-1', cl: 1, acct: 'profile-1', asecret: 'asecret-of-profile-1' }); return ws; };
    await hello('peer-0001');
    await hello('peer-0001');   // a reconnect
    assert.equal(reads, 1, 'asked once: the second hello takes the kept "none"');
    const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const d = 611;
    const rcpt = await mintSerpentReceipt({ d, b: 'sethrakul', s: 'player-1', c: 4242, x: 'dealt', h: 4, l: 22 }, kp.privateKey, { subtle, nowS: Math.floor(now() / 1000) });
    const res = await r.room.fetch(new Request(`https://relay.internal${SERPENT_INTERNAL_FELL}`, { method: 'POST', body: JSON.stringify({ d, at: now(), top: ['Ann'], n: 1, sx: 81_000, sz: -42_000, rc: [['player-1', rcpt]], here: [] }) }));
    assert.equal(res.status, 200);
    assert.ok(r.store.has(SERPENT_RC_PREFIX + 'player-1'), 'the receipt kept');
    const ws = await hello('peer-0001');
    assert.ok(ws.sent.some((f) => f.t === 'serpent' && f.k === 'rcpt' && f.r === rcpt), 'the next hello is handed it');
  });
});

test('SCALE5a the hello\'s walks are methods of their own (`_message` runs interpreted, PERF-RELAY1) and the hub\'s fans walk the index in place; the client\'s frame walks its peers in place', () => {
  const relay = src('server/src/index.js');
  assert.match(relay, /for \(const \[other, b\] of this\._withId\(m\.id, ws\)\) \{/);
  assert.match(relay, /const others = this\._othersOf\(ws\);/);
  assert.match(relay, /this\._fanBut\(ws, said\);/);
  assert.match(relay, /this\._fanBut\(ws, out\);   \/\/ SCALE5a: in place, as the join's/);
  assert.match(relay, /_fanBut\(ws, out\) \{ for \(const \[other, b\] of this\._all\(\)\) if \(other !== ws && b\.id\) this\._send\(other, out\); \}/, 'the fan walks the index itself, never a copy');
  assert.match(src('src/net/online.js'), /for \(const p of this\.peers\.values\(\)\) \{/);
});

test('SCALE5a the leave knows the room drained without a filtered copy of every socket - the last one out, still listed by a runtime whose close has not completed (AUDIT ONESEAT R4), sweeps the room as the filter said it should (mutant: "the last" only when the runtime lists none)', async () => {
  await onClock(async ({ tick }) => {
    const r = fakeRoom('chat:world');
    const ws = r.connect(); tick(25);
    await r.hello(ws, 'peer-0001', null, { tokenSub: 'player-1', cl: 1 });
    r.store.set('secret:peer-stray', 'left behind by an unclean close');
    ws.close = function (code, reason) { this.closed = { code, reason }; };   // the runtime keeps listing it until the close completes
    r.room._refuse(ws, 'bad frame');
    await r.room._reap();
    assert.ok(r.sockets.includes(ws), 'still listed');
    assert.equal(r.store.has('secret:peer-stray'), false, 'the drain swept what an unclean close left behind');
  });
});
