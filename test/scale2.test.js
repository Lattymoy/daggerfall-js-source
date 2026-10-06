// SCALE2 (2026-09-30, the scaling audit - bible/11-Multiplayer/Scale-Arc.md): A RELAY DEPLOY'S RECONNECT WAVE, made
// survivable from the client - nothing here deploys the relay.
//
// What broke first at five hundred players: a deploy drops every socket, every player reconnects three to six at
// once, and EVERY SOCKET minted its own identity token (~8 D1 statements and a signature). A mint slower than
// TOKEN_WAIT_MS sent the hello without one, the relay refused it (CLOSE_POLICY) - and that close was terminal: the
// player offline until they changed room. And the chat channels all came back on the same thirtieth second.
//
//   A. ONE MINT A CONNECT: a token is handed to every OTHER room asked within TOKEN_REUSE_MS, under the same session
//      and character, and sockets opening together share the one mint on the wire - never twice into one room;
//   B. a hello refused for a missing token is ASKED AGAIN while the device is signed in (the primary and a halo); a
//      missing sign-in or one the service refused ('auth') stays final;
//   C. the chat channel's rejoin is jittered, once a terminal close.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { accountTokenMinter, SESSION_KEY, TOKEN_REUSE_MS } from '../src/net/accountClient.js';
import { OnlineSession, tokenRetryable, BACKOFF_MIN_MS, BACKOFF_MAX_MS } from '../src/net/online.js';
import { CLOSE_POLICY } from '../src/net/wire.js';
import { fakeSocketClass } from './fakeSocket.mjs';

const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const quiet = async (fn) => { const w = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = w; } };

function fakeStorage(seed = null) {
  const m = new Map();
  if (seed) m.set(SESSION_KEY, JSON.stringify(seed));
  return { _map: m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
/** The service's token route: each mint a new token (`n` counts them), or the refusal `fail` names. */
function service({ fail = null, hold = null } = {}) {
  const box = { n: 0, bodies: [] };
  box.fetch = async (url, init) => {
    box.n += 1;
    box.bodies.push(JSON.parse(init.body ?? '{}'));
    if (hold) await hold;
    if (fail) return { ok: false, status: fail === 'auth' ? 401 : 503, headers: { get: () => 'application/json' }, json: async () => ({ error: fail }) };
    const token = `v1.claims${box.n}.sig${box.n}`;
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ token, name: 'Mac', kind: 'linked', expiresAt: 1 }) };
  };
  return box;
}
const SESSION = { id: 'p1', secret: 'a-secret-long-enough-0001' };

// ═══ A. ONE MINT A CONNECT ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCALE2 A: one token opens every OTHER room asked within TOKEN_REUSE_MS - and never a room it opened; a room named by nobody is minted fresh (mutants: reused into its own room; never reused; reused past its minute)', async () => quiet(async () => {
  let t = 1_000_000;
  const svc = service();
  const mint = accountTokenMinter({ fetch: svc.fetch, storage: fakeStorage(SESSION), now: () => t });
  // STORM-SHED (PIN MOVED): a room is opened by the hello that carries the token - net/online.js says so (`opened`), as here
  const open = async (/** @type {string} */ room) => { const tok = await mint(room); if (tok) mint.opened(room, tok); return tok; };
  const cell = await open('world:3,12');
  assert.equal(svc.n, 1);
  assert.equal(await open('world:4,12'), cell, 'a halo: the same token');
  assert.equal(await open('chat:world'), cell, 'the hub');
  assert.equal(await open('chat:region.17'), cell, 'the region channel');
  assert.equal(svc.n, 1, 'one mint for the connect');
  // the relay spends a token once IN A ROOM: a room it opened gets a fresh one
  const again = await open('world:3,12');
  assert.notEqual(again, cell);
  assert.equal(svc.n, 2, 'a reconnect into a room the token opened mints');
  // and that fresh token is the one other rooms get now
  assert.equal(await open('world:5,12'), again);
  // past the minute: minted again, whatever the room
  t += TOKEN_REUSE_MS;
  assert.notEqual(await mint('world:9,9'), again);
  assert.equal(svc.n, 3);
  // no room named: minted fresh (the call before SCALE2)
  await mint();
  await mint(null);
  assert.equal(svc.n, 5);
  assert.equal(TOKEN_REUSE_MS, 60_000);
}));

test('SCALE2 A: sockets opening together share the ONE mint on the wire (mutant: every socket its own mint)', async () => quiet(async () => {
  let release;
  const hold = new Promise((r) => { release = r; });
  const svc = service({ hold });
  const mint = accountTokenMinter({ fetch: svc.fetch, storage: fakeStorage(SESSION) });
  const asked = ['world:3,12', 'world:4,12', 'world:3,13', 'chat:world', 'chat:region.17'].map((room) => mint(room));
  await settle();
  assert.equal(svc.n, 1, 'one request on the wire while five sockets open');
  release();
  const tokens = await Promise.all(asked);
  assert.equal(new Set(tokens).size, 1, 'all five open with it');
  assert.equal(svc.n, 1);
}));

test('SCALE2 A: a token is another character\'s or another sign-in\'s for nobody - either change mints (mutants: the character or the session unasked)', async () => quiet(async () => {
  const svc = service();
  const storage = fakeStorage(SESSION);
  let character = 'char-a';
  const mint = accountTokenMinter({ fetch: svc.fetch, storage, character: () => character });
  const a = await mint('world:1,1');
  character = 'char-b';
  const b = await mint('world:2,2');
  assert.notEqual(a, b, 'another character: its own token, its own Renown signed in');
  assert.equal(svc.bodies[1].character, 'char-b');
  storage.setItem(SESSION_KEY, JSON.stringify({ id: 'p2', secret: 'another-secret-long-enough' }));
  const c = await mint('world:3,3');
  assert.notEqual(c, b, 'another sign-in on the device: its own token');
  assert.equal(svc.n, 3);
}));

test('SCALE2 A: the minter says why it answered null - no sign-in, or the service\'s own word - and says nothing after a token (mutants: the reason unsaid)', async () => quiet(async () => {
  const none = accountTokenMinter({ fetch: service().fetch, storage: fakeStorage() });
  assert.equal(await none('world:1,1'), null);
  assert.equal(none.lastWhy, 'no-session');
  for (const word of ['server', 'rate', 'auth']) {
    const m = accountTokenMinter({ fetch: service({ fail: word }).fetch, storage: fakeStorage(SESSION) });
    assert.equal(await m('world:1,1'), null);
    assert.equal(m.lastWhy, word);
  }
  const ok = accountTokenMinter({ fetch: service().fetch, storage: fakeStorage(SESSION) });
  assert.ok(await ok('world:1,1'));
  assert.equal(ok.lastWhy, null);
}));

test('SCALE2 A: a live session hands each socket\'s ROOM to the minter - the cell and its halo open on one mint, and each hello carries it (mutant: the session names no room)', async () => quiet(async () => {
  const svc = service();
  const mintToken = accountTokenMinter({ fetch: svc.fetch, storage: fakeStorage(SESSION) });
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => 1_000_000, mintToken });
  s.join('world:3,12', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
  sockets[0].open();
  await settle();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null });
  s.setHalo(['world:2,12']);
  sockets[1].open();
  await settle();
  const toks = sockets.map((w) => JSON.parse(w.sent[0]).tok);
  assert.equal(svc.n, 1, 'the cell and its halo: one mint');
  assert.ok(toks[0] && toks[0] === toks[1], 'both hellos carry it');
}));

// ═══ B. A TOKENLESS REFUSAL, ASKED AGAIN ═════════════════════════════════════════════════════════════════════════════

/** A session whose minter answers null with `why`. */
function tokenless(why) {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1_000_000;
  const mintToken = Object.assign(async () => null, { lastWhy: why });
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now, rand: () => 0.5, mintToken });
  return { s, sockets, tick: (ms) => { now += ms; s.tick(); }, at: () => now };
}
const pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };

test('SCALE2 B: the primary\'s hello refused for a token the service did not give (a bad minute, its rate, too slow) is asked again, backed off hard; a missing sign-in or a refused one stays final (mutants: every policy close final; every one retried)', async () => quiet(async () => {
  for (const [why, retried] of [['server', true], ['rate', true], ['late', true], ['offline', true], ['no-session', false], ['auth', false]]) {
    const r = tokenless(why);
    r.s.join('world:3,12', pose);
    r.sockets[0].open();
    await settle();
    assert.ok(!('tok' in JSON.parse(r.sockets[0].sent[0])), `${why}: the hello went without a token`);
    r.sockets[0].drop(CLOSE_POLICY);
    assert.equal(r.s.terminal, !retried, `${why}: ${retried ? 'asked again' : 'final'}`);
    if (retried) {
      assert.equal(r.s.status, 'closed');
      assert.ok(r.s._backoff >= BACKOFF_MAX_MS / 2, 'backed off hard, as a busy room is - the service is having a minute');
      r.tick(BACKOFF_MAX_MS * 2);
      assert.equal(r.sockets.length, 2, `${why}: a new socket`);
    } else {
      r.tick(BACKOFF_MAX_MS * 4);
      assert.equal(r.sockets.length, 1, `${why}: never retried`);
    }
  }
  assert.equal(tokenRetryable(undefined), false, 'a hello that had a token: its policy close is the relay\'s word, final');
}));

test('SCALE2 B: a halo refused for a token the service did not give is retried like a busy one, not remembered terminal (mutant: the halo\'s policy close always final)', async () => quiet(async () => {
  const r = tokenless('server');
  r.s.join('world:3,12', pose);
  r.sockets[0].open();
  await settle();
  r.sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null });
  r.s.setHalo(['world:2,12']);
  r.sockets[1].open();
  await settle();
  r.sockets[1].drop(CLOSE_POLICY);
  const h = r.s._halo.get('world:2,12');
  assert.equal(h.status, 'closed', 'not terminal');
  assert.ok(h.retryAt > r.at() && h.backoff >= BACKOFF_MAX_MS / 2, 'retried, backed off hard');
  // ...and a halo whose device holds no sign-in is remembered terminal, as before
  const n = tokenless('no-session');
  n.s.join('world:3,12', pose); n.sockets[0].open(); await settle();
  n.sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null });
  n.s.setHalo(['world:2,12']); n.sockets[1].open(); await settle(); n.sockets[1].drop(CLOSE_POLICY);
  assert.equal(n.s._halo.get('world:2,12').status, 'terminal');
}));

// ═══ C. THE CHANNELS' REJOIN, SPREAD ═════════════════════════════════════════════════════════════════════════════════

test('SCALE2 C: a channel\'s rejoin after a terminal close waits a jittered [half, one and a half) of its wait, drawn once a close - so a relay that closed every channel does not have them all back in one second (mutants: unjittered; drawn every frame)', () => {
  const REJOIN = 30_000;
  for (const [r, factor] of [[0, 0.5], [0.5, 1], [0.99, 1.49]]) {
    const { FakeWS } = fakeSocketClass();
    let now = 1_000_000;
    const draws = [r, 0.999, 0.999];   // any later draw pushes the wait to its far edge: one drawn again within a close fails the `due` below
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', presence: false, WebSocketImpl: FakeWS, now: () => now, rand: () => draws.shift() ?? 0 });
    s.join('chat:world');
    s._ws.open();
    s._ws.drop(CLOSE_POLICY);
    assert.equal(s.terminal, true);
    const due = s.terminalAt + REJOIN * factor;
    now = due - 1;
    assert.equal(s.rejoin('chat:world', REJOIN), false, `r=${r}: not before ${factor} of the wait`);
    assert.equal(s.rejoin('chat:world', REJOIN), false, 'asked every frame: the same wait');
    now = due;
    assert.equal(s.rejoin('chat:world', REJOIN), true, `r=${r}: at ${factor} of the wait`);
  }
  assert.ok(BACKOFF_MIN_MS > 0);
});
