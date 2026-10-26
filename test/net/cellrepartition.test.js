// COST-2 part two (2026-10-25; bible/11-Multiplayer/Scale-Arc.md COST-2 part two): THE PAGE IN A MOVING TREE. A cell's
// hello says the cell law it stands on (`cv`, wire.js CELL_HELLO_LAW) - a coarse node refuses one without it - and a
// socket the tree's move closed (CLOSE_REPARTITION) joins again after BACKOFF_MIN_MS and up to REPARTITION_SPAN_MS more,
// with no drop weighed and no backoff, as its halos do. Through the real session (src/net/online.js) over the pins'
// fake socket.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OnlineSession, BACKOFF_MIN_MS, REPARTITION_SPAN_MS } from '../../src/net/online.js';
import { CLOSE_REPARTITION, CELL_HELLO_LAW, CHAT_WORLD_ROOM } from '../../src/net/wire.js';
import { fakeSocketClass } from '../fakeSocket.mjs';

const pose = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 };
const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
const session = (room = 'world:2,12', rand = () => 0) => {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { t: 1000 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => clock.t, rand });
  s.join(room, pose); sockets[0].open(); sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null });
  return { s, sockets, clock };
};
const hello = (ws) => JSON.parse(ws.sent.find((x) => x.startsWith('{"t":"hello"')) ?? 'null');

test('COST-2 part two A CELL\'S HELLO SAYS ITS CELL LAW: `cv` CELL_HELLO_LAW to a cell - the primary\'s and a halo\'s - and nothing to a room that is no cell (mutants: `cv` unsaid; said to every room)', () => quiet(() => {
  assert.equal(CELL_HELLO_LAW, 1);
  const { s, sockets } = session();
  assert.equal(hello(sockets[0]).cv, CELL_HELLO_LAW);
  s.setHalo(['world:3,12']);
  sockets[1].open();
  assert.equal(hello(sockets[1]).cv, CELL_HELLO_LAW, 'a halo\'s too');
  const hub = session(CHAT_WORLD_ROOM);
  assert.equal('cv' in hello(hub.sockets[0]), false);
}));

test('COST-2 part two A MOVE\'S CLOSE IS A SHORT WAIT, NOT A DROP: the primary closed CLOSE_REPARTITION joins its cell again BACKOFF_MIN_MS on and within REPARTITION_SPAN_MS more, its backoff untouched and no drop weighed; a halo the same; any other drop is weighed and backed off as before (mutants: the close weighed as a drop; backed off; the wait unjittered; the halo\'s retry on its backoff)', () => quiet(() => {
  assert.equal(REPARTITION_SPAN_MS, 2 * BACKOFF_MIN_MS);
  const { s, sockets, clock } = session('world:2,12', () => 0.5);
  const backoff = s._backoff;
  sockets[0].drop(CLOSE_REPARTITION, 'cells moved');
  assert.equal(s.status, 'closed');
  assert.equal(s._dropAt, null, 'no drop weighed');
  assert.equal(s._backoff, backoff, 'the backoff untouched');
  assert.equal(s._retryAt, 1000 + BACKOFF_MIN_MS + 0.5 * REPARTITION_SPAN_MS, 'jittered over the span');
  clock.t = s._retryAt - 1; s.tick();
  assert.equal(sockets.length, 1, 'not before its wait');
  clock.t = s._retryAt; s.tick();
  assert.equal(sockets.length, 2, 'joined again');
  assert.equal(sockets[1].url, 'wss://relay.test/room/world:2,12', 'its own cell, the Worker\'s to place');
  // a halo
  sockets[1].open(); sockets[1].receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null });
  s.setHalo(['world:3,12']);
  const h = s._halo.get('world:3,12');
  sockets[2].open();
  const hb = h.backoff;
  sockets[2].drop(CLOSE_REPARTITION, 'cells moved');
  assert.deepEqual([h.ws, h.status, h.dropAt, h.backoff], [null, 'closed', null, hb]);
  assert.equal(h.retryAt, clock.t + BACKOFF_MIN_MS + 0.5 * REPARTITION_SPAN_MS);
  // any other drop of an open socket: weighed as a wave, and backed off
  const o = session();
  o.sockets[0].drop(1006);
  assert.ok(o.s._backoff > backoff, 'a plain drop backs off');
}));
