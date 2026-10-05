// AURA-LIVE (2026-10-05, Mac: "Ensure other players can see all auras") - AN AURA WORN MID-SESSION REACHES THE ROOM.
//
// The relay reads a badge (the aura, the title, the glyphs) off the TOKEN alone, and a token rides a hello - so an aura
// put on at the account card or the Broker was drawn at my own feet at once and at nobody else's until I changed area
// ("Others see it once you change area."). net/online.js `rehello` says hello again on a fresh token through a new
// socket of the same id, which the relay already takes as a reconnect. These pins run it end to end: a real
// OnlineSession, a real minter against the room's own key, the real Room (test/fakeRoom.mjs) - and the host
// (scenes/world.js) that asks for it when my aura changes from the one the last token said.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OnlineSession, REHELLO_GAP_MS, BACKOFF_MAX_MS } from '../src/net/online.js';
import { PIXEL_UNITS, CLOSE_REPLACED, CLOSE_BUSY } from '../src/net/wire.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { AURA_DRAW_MAX, AURA_FORGET_S, AURA_KINDLE_S } from '../src/render/auraRing.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
const until = async (ready, label) => {
  const deadline = Date.now() + 5000;
  while (!ready()) {
    assert.ok(Date.now() < deadline, `${label}: timed out`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const ROOM = 'dungeon:m1291010263';   // a world room: it has a host, whose seat a reconnect must keep

/** A WebSocket class whose every socket is a socket of the real Room: what the session writes reaches the Room, what
 *  the Room writes or closes reaches the session - each a moment later, as a network's would. */
function bridged(r) {
  const sockets = [];
  class WS {
    constructor(url) {
      this.url = url; this.closed = null; sockets.push(this);
      const server = r.connect();
      this.server = server;
      const shut = server.close.bind(server);
      server.close = (code, reason) => { shut(code, reason); if (!this.closed) { this.closed = { code, reason, by: 'relay' }; queueMicrotask(() => this.onclose?.({ code, reason })); } };
      server.send = (s) => { if (server.closed) throw new Error('closed'); queueMicrotask(() => this.onmessage?.({ data: s })); };
      queueMicrotask(() => this.onopen?.());
    }
    send(s) { if (this.closed) throw new Error('closed'); r.raw(this.server, s); }
    close(code = 1000, reason = '') {
      if (this.closed) return;
      this.closed = { code, reason, by: 'me' };
      if (!this.server.closed) r.drop(this.server);
      queueMicrotask(() => this.onclose?.({ code, reason }));
    }
  }
  return { WS, sockets };
}

/** A player in the room: a session, its sockets, the aura its account wears now (what the next token signs), and
 *  every leave it heard. */
function player(r, id, clock) {
  const { WS, sockets } = bridged(r);
  const me = { aura: null, sockets, leaves: [] };
  me.s = new OnlineSession({ url: 'wss://relay.test', name: id, id, secret: 'secret-of-' + id, WebSocketImpl: WS, now: () => clock.t, mintToken: () => r.token(id, { au: me.aura ?? undefined }) });
  const recv = me.s._receive.bind(me.s);
  me.s._receive = (data, room) => { try { const m = JSON.parse(data); if (m?.t === 'leave') me.leaves.push(m.id); } catch { /* the session's own parse says */ } return recv(data, room); };
  return me;
}

test('AURA-LIVE: an aura put on mid-session reaches the room through the real relay - the peer draws it, no leave is said, the host keeps its seat, the session is not superseded; taken off, it goes the same way', async () => {
  const r = fakeRoom(ROOM);
  await r.signer();
  const clock = { t: 1_000_000 };
  const a = player(r, 'aaaa-0001', clock), b = player(r, 'bbbb-0002', clock);
  quiet(() => a.s.join(ROOM, at(1, 1)));
  await until(() => a.s.host === 'aaaa-0001', 'a welcomed');
  quiet(() => b.s.join(ROOM, at(1, 1)));
  await until(() => b.s.peers.has('aaaa-0001'), 'b sees a');
  assert.equal(b.s.auraOf('aaaa-0001'), null, 'no aura yet');

  // the account card: Seraph Wings on - the service's next token signs it
  a.aura = 'seraphwings';
  const first = a.sockets[0];
  assert.equal(a.s.rehello(), true, 'owed: a socket is open to say it');
  await until(() => b.s.auraOf('aaaa-0001') === 'seraphwings', 'b draws the wings');
  await until(() => first.closed, 'the old socket closed');
  assert.equal(first.closed.code, CLOSE_REPLACED, 'by the relay, as a reconnect replaced');
  assert.equal(a.sockets.length, 2, 'one new socket');
  assert.equal(a.s._ws, a.sockets[1], 'which is the session\'s now');
  assert.equal(a.s.superseded, false, 'the replaced close was my own hand\'s - not the one-seat verdict');
  assert.equal(a.s.terminal, false);
  assert.equal(a.s.status, 'open');
  await until(() => a.s.host === 'aaaa-0001', 'a re-welcomed');
  assert.equal(b.s.host, 'aaaa-0001', 'the host kept its seat (the first hello\'s stamp)');
  assert.deepEqual(b.leaves, [], 'no leave said: nobody saw me vanish and re-stand');
  assert.equal(a.s._swap.size, 0); assert.equal(a.s._retired.size, 0, 'nothing left half-done');

  // and off again - held by the gap, then said on the tick
  a.aura = null;
  assert.equal(a.s.rehello(), true);
  await settle();
  assert.equal(a.sockets.length, 2, `within REHELLO_GAP_MS (${REHELLO_GAP_MS} ms) nothing goes`);
  clock.t += REHELLO_GAP_MS;
  a.s.tick();
  await until(() => b.s.auraOf('aaaa-0001') === null, 'b drops the wings');
  assert.equal(a.sockets.length, 3, 'the latest badge, one socket');
  assert.deepEqual(b.leaves, []);
  assert.equal(a.s.superseded, false);
});

test('AURA-LIVE: a run of changes inside the gap costs ONE hello, and it is the latest that goes', async () => {
  const r = fakeRoom(ROOM);
  await r.signer();
  const clock = { t: 1_000_000 };
  const a = player(r, 'aaaa-0001', clock), b = player(r, 'bbbb-0002', clock);
  quiet(() => a.s.join(ROOM, at(1, 1))); await until(() => a.s.host === 'aaaa-0001', 'a');
  quiet(() => b.s.join(ROOM, at(1, 1))); await until(() => b.s.peers.has('aaaa-0001'), 'b');
  a.aura = 'shadowcloak'; a.s.rehello();
  await until(() => b.s.auraOf('aaaa-0001') === 'shadowcloak', 'first');
  for (const k of ['oblivionward', 'emberfall', 'seraphwings']) { a.aura = k; a.s.rehello(); a.s.tick(); }
  await settle();
  assert.equal(a.sockets.length, 2, 'held');
  clock.t += REHELLO_GAP_MS; a.s.tick(); a.s.tick();
  await until(() => b.s.auraOf('aaaa-0001') === 'seraphwings', 'the latest');
  assert.equal(a.sockets.length, 3, 'one more hello for the three changes');
});

test('AURA-LIVE: every open socket says it - a halo\'s too, so a neighbouring cell\'s players see it; a replacement waits for its token before it takes the old one\'s place', async () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let release;
  const gate = new Promise((res) => { release = res; });
  let minted = 0;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'shh-0001', WebSocketImpl: FakeWS, now: () => 1000, mintToken: () => (++minted > 2 ? gate : 'v1.tok') });
  quiet(() => s.join('world:3,11', at(1, 1)));
  sockets[0].open(); await settle();
  sockets[0].receive({ t: 'welcome', peers: [] });
  s.setHalo(['world:3,12']); sockets[1].open(); await settle();
  sockets[1].receive({ t: 'welcome', peers: [] });
  assert.equal(s.rehello(), true);
  assert.equal(sockets.length, 4, 'one replacement a socket: the cell\'s and the halo\'s');
  assert.deepEqual(sockets.slice(2).map((w) => w.url).sort(), ['wss://relay.test/room/world:3,11', 'wss://relay.test/room/world:3,12']);
  sockets[2].open(); sockets[3].open(); await settle();
  assert.equal(s._ws, sockets[0], 'the token not yet minted: the old socket still speaks for the room');
  assert.equal(s._halo.get('world:3,12').ws, sockets[1]);
  release('v1.fresh'); await settle();
  const said = (w) => w.sent.map((x) => JSON.parse(x)).filter((f) => f.t === 'hello');
  assert.equal(s._ws, sockets[2], 'promoted, its hello ready');
  assert.equal(s._halo.get('world:3,12').ws, sockets[3]);
  assert.equal(said(sockets[2]).length, 1); assert.equal(said(sockets[2])[0].tok, 'v1.fresh', 'on a fresh token');
  assert.equal(said(sockets[3]).length, 1);
  assert.equal(said(sockets[3])[0].cl, undefined, 'a reconnect, never a claim of the seat');
  // the relay closes the old ones as replaced: ignored - they are no room's now
  sockets[0].drop(CLOSE_REPLACED); sockets[1].drop(CLOSE_REPLACED);
  assert.equal(s.superseded, false); assert.equal(s.terminal, false);
  assert.equal(s._halo.get('world:3,12').status, 'open', 'the halo is not ended');
});

test('AURA-LIVE: a replacement whose room went while it minted (a leave, a crossing) is closed and the old paths stand; one the relay refuses takes its old socket with it, and the ordinary retry says hello', async () => {
  {
    const { FakeWS, sockets } = fakeSocketClass();
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'shh-0001', WebSocketImpl: FakeWS, now: () => 1000, mintToken: () => 'v1.tok' });
    quiet(() => s.join('town:m9', at(1, 1)));
    sockets[0].open(); await settle(); sockets[0].receive({ t: 'welcome', peers: [] });
    s.rehello();
    quiet(() => s.leave());
    assert.ok(sockets[1].closed, 'the replacement goes with the room');
    sockets[1].open(); await settle();
    assert.equal(sockets[1].sent.length, 0, 'and says nothing');
  }
  {
    const { FakeWS, sockets } = fakeSocketClass();
    let hold; const gate = new Promise((res) => { hold = res; });
    let n = 0;
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'shh-0001', WebSocketImpl: FakeWS, now: () => 1000, mintToken: () => (++n > 1 ? gate : 'v1.tok') });
    quiet(() => s.join('town:m9', at(1, 1)));
    sockets[0].open(); await settle(); sockets[0].receive({ t: 'welcome', peers: [] });
    s.rehello(); sockets[1].open(); await settle();
    sockets[0].drop(1006);   // the old socket dropped while the new one minted
    hold('v1.fresh'); await settle();
    assert.ok(sockets[1].closed, 'not promoted over a socket that is gone');
    assert.equal(sockets[1].sent.length, 0);
    assert.equal(s._ws, null, 'the drop\'s own path stands: a retry is scheduled');
  }
  {
    const { FakeWS, sockets } = fakeSocketClass();
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'shh-0001', WebSocketImpl: FakeWS, now: () => 1000, mintToken: () => 'v1.tok' });
    quiet(() => s.join('town:m9', at(1, 1)));
    sockets[0].open(); await settle(); sockets[0].receive({ t: 'welcome', peers: [] });
    s.rehello(); sockets[1].open(); await settle();
    assert.equal(s._ws, sockets[1]);
    quiet(() => sockets[1].drop(CLOSE_BUSY));   // the room's hello budget spent: refused busy
    assert.ok(sockets[0].closed, 'the socket it replaced goes too');
    assert.equal(s.status, 'closed'); assert.equal(s.terminal, false, 'the busy path: backed off, retried');
    assert.ok(s._retryAt != null);
  }
  {
    const { FakeWS, sockets } = fakeSocketClass();
    let t = 1000;
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'shh-0001', WebSocketImpl: FakeWS, now: () => t, mintToken: () => 'v1.tok' });
    quiet(() => s.join('town:m9', at(1, 1)));
    sockets[0].open(); await settle(); sockets[0].receive({ t: 'welcome', peers: [] });
    s.rehello();
    assert.equal(sockets.length, 2);
    t += BACKOFF_MAX_MS + 1; s.tick();
    assert.ok(sockets[1].closed, 'a replacement that never opens is dropped past the longest backoff');
    t += REHELLO_GAP_MS; s.tick();
    assert.equal(sockets.length, 3, 'and the badge is owed again');
  }
  {
    const { FakeWS, sockets } = fakeSocketClass();
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'shh-0001', WebSocketImpl: FakeWS, now: () => 1000, mintToken: () => 'v1.tok' });
    assert.equal(s.rehello(), true);
    assert.equal(sockets.length, 0, 'nothing open: the next hello says it, nothing is opened');
  }
});

test('AURA-LIVE: the host asks for it when MY aura changes from the one the last token said - not on a mint, which said it - and the Broker no longer says "once you change area"', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(who && 'aura' in who\) _auraHeard = who\.aura \?\? null;/, 'a mint\'s token said this one');
  assert.match(w, /const mine = ownAura\(\); if \(_auraHeard !== undefined && mine !== _auraHeard && online\.rehello\?\.\(\)\) _auraHeard = mine;/, 'a change since: said again');
  assert.match(w, /let renownXp = null, _auraHeard;/, 'declared before anything can call the minter\'s hook');
  assert.ok(w.indexOf('let renownXp = null, _auraHeard;') < w.indexOf('const adoptIssued = (who) => {'));
  assert.doesNotMatch(w, /Others see it once you change area/);
  assert.match(w, /Wearing \$\{row\.name\}\.`/);
});

test('AURA-LIVE (AUDIT 3): every wearer in reach drawn - a crowd at a hub\'s fountain is more than sixteen; and a peer who blinks out of the list for a moment keeps their aura kindled, it is not lit again from nothing (mutants: the cap back to sixteen, the pool forgetting at once)', () => {
  assert.ok(AURA_DRAW_MAX >= 32, `the cap (${AURA_DRAW_MAX})`);
  assert.ok(AURA_FORGET_S >= 1 && AURA_FORGET_S > AURA_KINDLE_S, `remembered unseen for ${AURA_FORGET_S} s - longer than a kindling`);
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(_auraPool\.size\) for \(const \[id, w\] of _auraPool\) if \(t - w\.seen > AURA_FORGET_S\) _auraPool\.delete\(id\);/);
});
