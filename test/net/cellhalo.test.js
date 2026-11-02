// COST-2 (2026-10-24; bible/11-Multiplayer/Scale-Arc.md COST-2): THE PAGE'S HALO NAMES ITS OWN ROOM, AND TAKES "SAME
// ROOM" AS A WAIT. A halo's socket asks for its neighbouring cell with `?of=<the cell this page stands in>`
// (wire.js HALO_OF_PARAM), so the Worker can tell when both are one node's object (server/src/cellNodes.js); a halo it
// closes CLOSE_SAME_ROOM is asked again HALO_WAIT_MS later - never weighed as a drop, never backed off. Through the real
// session (src/net/online.js) over the pins' fake socket.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OnlineSession, HALO_WAIT_MS, BACKOFF_MIN_MS } from '../../src/net/online.js';
import { CLOSE_SAME_ROOM, HALO_OF_PARAM, CHAT_WORLD_ROOM } from '../../src/net/wire.js';
import { fakeSocketClass } from '../fakeSocket.mjs';

const pose = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 };
const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
const session = (room = 'world:2,12') => {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { t: 1000 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => clock.t, rand: () => 0 });
  s.join(room, pose); sockets[0].open(); sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null });
  return { s, sockets, clock };
};

test('COST-2 A HALO SAYS WHICH ROOM ITS PAGE STANDS IN: its socket asks for the neighbouring cell with `?of=` the page\'s own cell, encoded; the primary\'s socket says nothing of the kind (mutants: `of` unsaid; the halo\'s own key said as `of`; the primary marked)', () => quiet(() => {
  assert.equal(HALO_OF_PARAM, 'of');
  const { s, sockets } = session();
  assert.equal(sockets[0].url, 'wss://relay.test/room/world:2,12', 'the primary as before');
  s.setHalo(['world:3,12']);
  assert.equal(sockets[1].url, `wss://relay.test/room/world:3,12?of=${encodeURIComponent('world:2,12')}`);
  assert.equal(new URL(sockets[1].url).searchParams.get(HALO_OF_PARAM), 'world:2,12');
  // COST-2 (b): and every halo it holds already - the second halo of a corner names the first
  s.setHalo(['world:3,12', 'world:2,13']);
  assert.equal(new URL(sockets[2].url).searchParams.get(HALO_OF_PARAM), 'world:2,12;world:3,12');
}));

test('COST-2 "SAME ROOM" IS A WAIT, NOT A DROP: a halo closed CLOSE_SAME_ROOM keeps no socket and asks again only after HALO_WAIT_MS, its backoff untouched and no drop weighed; asked again it names the room the page stands in then; any other close is retried on its backoff as before (mutants: the close retried on its backoff; weighed as a drop; the wait short; the backoff doubled)', () => quiet(() => {
  const { s, sockets, clock } = session();
  s.setHalo(['world:3,12']);
  const h = s._halo.get('world:3,12');
  const backoff = h.backoff;
  sockets[1].open(); sockets[1].drop(CLOSE_SAME_ROOM, 'same room');
  assert.equal(h.ws, null);
  assert.equal(h.status, 'closed');
  assert.equal(h.dropAt, null, 'no drop weighed');
  assert.equal(h.backoff, backoff, 'the backoff untouched');
  assert.equal(h.retryAt, 1000 + HALO_WAIT_MS);
  clock.t = 1000 + HALO_WAIT_MS - 1; s.tick();
  assert.equal(sockets.length, 2, 'not asked again inside the wait');
  clock.t = 1000 + HALO_WAIT_MS; s.tick();
  assert.equal(sockets.length, 3, 'asked again after it');
  assert.equal(new URL(sockets[2].url).searchParams.get(HALO_OF_PARAM), 'world:2,12');
  // any other close: the backoff's retry, as before
  sockets[2].drop(1006);
  const h2 = s._halo.get('world:3,12');
  assert.ok(h2.retryAt < clock.t + HALO_WAIT_MS && h2.retryAt >= clock.t + BACKOFF_MIN_MS, 'a dropped halo on its backoff');
  assert.ok(h2.backoff > backoff, 'and its backoff doubled');
}));

test('COST-2 a page that is in no cell opens no halo to name it: a hub link\'s socket says no `of` (mutants: `of` said for any room)', () => quiet(() => {
  const { sockets } = session(CHAT_WORLD_ROOM);
  assert.equal(new URL(sockets[0].url).searchParams.has(HALO_OF_PARAM), false);
}));
