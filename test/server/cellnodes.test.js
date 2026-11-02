// COST-2 (2026-10-24; bible/11-Multiplayer/Scale-Arc.md COST-2): THE WORKER'S DOOR TO A CELL (server/src/cellNodes.js).
// The Worker asks the directory (one object, CELL_DIRECTORY) for the cell tree, keeps it CELL_TREE_KEEP_MS, and walks a
// page's cell request to the node that holds it - the request unchanged, so the socket's key is still the fine cell, and
// the object told its node. With the tree at L0 (COST-2's first drop) every object a cell's socket reaches is the one it
// reached before. A directory that fails leaves the last tree seen; a halo of the page's own node is closed
// CLOSE_SAME_ROOM by the Worker alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../../server/src/index.js';
import { fakeRoom } from '../fakeRoom.mjs';
import {
  CELL_DIRECTORY, CELL_INTERNAL_TREE, CELL_TREE_KEY, CELL_TREE_KEEP_MS, CELL_TREE_RETRY_MS, NODE_HEADER, cellTreeCache, cellTreeOf,
  cellTreeInternal, nodeHeard, cellLevelOf,
} from '../../server/src/cellNodes.js';
import { RoomMetrics } from '../../server/src/relayScale.js';
import { L0_TREE, seedTree } from '../../src/net/cellTree.js';
import { roomOf, CLOSE_SAME_ROOM, HALO_OF_PARAM, LAYER_HEADER, LAYER_ASK_HEADER } from '../../src/net/wire.js';

const upgrade = (path) => new Request(`https://relay.invalid/room/${path}`, { headers: { Upgrade: 'websocket', 'x-df-node': 'cell:4:0,0' } });   // a page's own node header is never believed
const SEEDED = { v: 1, base: 2, split: [], joined: [] };

/** A ROOMS binding: the directory a real Room over its own fake storage (`tree`: what it holds, `down`: it throws), every
 *  other object recording the ask - its name, the node and layer it was told - and answering 200. */
function relay({ tree = null, down = false } = {}) {
  const dir = fakeRoom(CELL_DIRECTORY);
  if (tree) dir.store.set(CELL_TREE_KEY, tree);
  if (tree?.base) dir.room.env.CELL_SEED = String(tree.base);   // PIN MOVED (COST-2 part two): the directory serves the tree it stores only while `cellSeed` is on - L0_TREE while it is off
  const asks = [], dirAsks = [];
  const ROOMS = {
    idFromName: (name) => name,
    get: (id) => ({
      fetch: async (req) => {
        if (id === CELL_DIRECTORY) { dirAsks.push(new URL(req.url).pathname); if (down) throw new Error('the directory is down'); return dir.room.fetch(req); }
        asks.push({ name: id, node: req.headers.get(NODE_HEADER), ly: req.headers.get(LAYER_HEADER), ask: req.headers.get(LAYER_ASK_HEADER), path: new URL(req.url).pathname });
        return new Response('{}', { status: 200 });
      },
    }),
  };
  return { ROOMS, asks, dirAsks, dir, set down(v) { down = v; } };
}

test('COST-2 AT L0 EVERY CELL REACHES ITS OWN OBJECT, AS BEFORE: the directory holds no tree and answers L0_TREE; each cell\'s request goes to the object named by its own key - its layers by their own names - unchanged (its path the fine cell\'s), the object told its node (the page\'s own word of it overwritten); a directory that fails or answers nothing readable changes nothing either; the tree asked once a CELL_TREE_KEEP_MS (mutants: the walk on another name; the node header the page\'s; the directory unasked; the tree unkept)', async (t) => {
  let now = 1_800_000_000_000;
  t.mock.method(Date, 'now', () => now);
  const keys = ['world:25,9', 'world:0,0', 'world:-3,7', 'world:62,31', 'world:-63,-32'];
  for (const mode of ['answers', 'down', 'garbage']) {
    cellTreeCache.reset();
    const R = relay({ down: mode === 'down', tree: mode === 'garbage' ? { v: 9 } : null });
    for (const k of keys) {
      const res = await worker.fetch(upgrade(k), { ROOMS: R.ROOMS });
      assert.equal(res.status, 200, `${mode} ${k}`);
    }
    assert.deepEqual(R.asks.map((a) => a.name), keys, `${mode}: every cell its own object`);
    assert.deepEqual(R.asks.map((a) => a.node), keys, `${mode}: each told it is its own node`);
    assert.deepEqual(R.asks.map((a) => a.path), keys.map((k) => `/room/${k}`), `${mode}: the page's request unchanged`);
    assert.deepEqual(R.dirAsks, [CELL_INTERNAL_TREE], `${mode}: the directory asked once for all five`);
  }
  // a layer asked (`?ly=2`): the place's own layer name, as SCALE5d walks it
  cellTreeCache.reset();
  const R = relay();
  await worker.fetch(upgrade('world:25,9?ly=2'), { ROOMS: R.ROOMS });
  assert.deepEqual([R.asks[0].name, R.asks[0].ly, R.asks[0].ask], ['world:25,9#2', '2', '1']);
  // kept CELL_TREE_KEEP_MS, then asked again
  now += CELL_TREE_KEEP_MS - 1;
  await worker.fetch(upgrade('world:1,1'), { ROOMS: R.ROOMS });
  assert.equal(R.dirAsks.length, 1);
  now += 1;
  await worker.fetch(upgrade('world:1,1'), { ROOMS: R.ROOMS });
  assert.equal(R.dirAsks.length, 2, 'asked again once kept long enough');
  assert.deepEqual(await (await cellTreeInternal(R.dir.room)).json(), L0_TREE, 'the directory\'s tree: L0, nothing stored');
});

test('COST-2 THE TREE OUTLIVES ITS DIRECTORY: a tree seen is kept when the directory stops answering - never the fine key, which would stand a player alone in an object no one of its node is in - and a failed ask is not repeated for CELL_TREE_RETRY_MS; only an isolate that never saw a tree uses the fine key (mutants: the fine key on a failure; the retry unpaced; the stale tree dropped)', async (t) => {
  let now = 1_800_000_000_000;
  t.mock.method(Date, 'now', () => now);
  cellTreeCache.reset();
  const R = relay({ tree: SEEDED });
  await worker.fetch(upgrade('world:25,9'), { ROOMS: R.ROOMS });
  assert.equal(R.asks.at(-1).name, 'cell:2:6,2', 'seeded at L2: the 64-pixel node');
  assert.equal(R.asks.at(-1).node, 'cell:2:6,2');
  assert.equal(R.asks.at(-1).path, '/room/world:25,9', 'the socket\'s key still its fine cell');
  R.down = true;
  now += CELL_TREE_KEEP_MS;
  await worker.fetch(upgrade('world:24,9'), { ROOMS: R.ROOMS });
  assert.equal(R.asks.at(-1).name, 'cell:2:6,2', 'the directory down: the last tree');
  assert.equal(R.dirAsks.length, 2);
  now += CELL_TREE_RETRY_MS - 1;
  await worker.fetch(upgrade('world:24,9'), { ROOMS: R.ROOMS });
  assert.equal(R.dirAsks.length, 2, 'not asked again before CELL_TREE_RETRY_MS');
  now += 1;
  R.down = false;
  await worker.fetch(upgrade('world:24,9'), { ROOMS: R.ROOMS });
  assert.equal(R.dirAsks.length, 3, 'asked again after it');
  // an isolate that never saw a tree: the fine key, and the same pacing
  cellTreeCache.reset();
  const D = relay({ tree: SEEDED, down: true });
  assert.equal(await cellTreeOf({ ROOMS: D.ROOMS }, now), null);
  await worker.fetch(upgrade('world:25,9'), { ROOMS: D.ROOMS });
  assert.equal(D.asks.at(-1).name, 'world:25,9');
  assert.equal(D.dirAsks.length, 1, 'the failure paced');
});

test('COST-2 NO PAGE REACHES A NODE OR THE DIRECTORY BY NAME: a coarse node\'s key is refused 404 at the Worker, and the directory\'s name is one wire.js roomOf never gives (mutants: a coarse key let through; the directory named as a room could be)', async () => {
  cellTreeCache.reset();
  const R = relay();
  const res = await worker.fetch(upgrade('cell:2:6,2'), { ROOMS: R.ROOMS });
  assert.equal(res.status, 404);
  assert.equal(R.asks.length, 0);
  assert.equal(roomOf(`/room/${CELL_DIRECTORY}`), null);
  assert.equal(roomOf(`/room/${encodeURIComponent(CELL_DIRECTORY)}`), null);
});

test('COST-2 A HALO IN THE PAGE\'S OWN NODE IS CLOSED BY THE WORKER: a halo naming its page\'s room (`?of=`) whose node is that room\'s node is answered with a socket closed CLOSE_SAME_ROOM and asks no object; a halo of another node walks as any cell; at L0 no halo is ever its page\'s own (mutants: the halo walked into its own node; another node\'s halo refused; `of` read loose)', async (t) => {
  const had = globalThis.WebSocketPair;
  const closes = [];
  globalThis.WebSocketPair = class { constructor() { this[0] = {}; this[1] = { accept() {}, close(code, reason) { closes.push([code, reason]); } }; } };
  t.after(() => { globalThis.WebSocketPair = had; });
  const reach = (p) => p.then((r) => r.status, () => 101);   // node mints no 101 - a throw is the closed socket handed back
  assert.equal(HALO_OF_PARAM, 'of');
  assert.equal(CLOSE_SAME_ROOM, 4002);
  cellTreeCache.reset();
  const R = relay({ tree: SEEDED });
  assert.equal(await reach(worker.fetch(upgrade('world:24,9?of=world:25,9'), { ROOMS: R.ROOMS })), 101);
  assert.deepEqual(closes, [[CLOSE_SAME_ROOM, 'same room']]);
  assert.equal(R.asks.length, 0, 'no object asked');
  assert.equal(await reach(worker.fetch(upgrade('world:28,9?of=world:25,9'), { ROOMS: R.ROOMS })), 200, 'a halo of the next node walks');
  assert.equal(R.asks.at(-1).name, 'cell:2:7,2');
  assert.equal(await reach(worker.fetch(upgrade('world:24,9?of=town:x'), { ROOMS: R.ROOMS })), 200, 'an `of` that is no cell is no halo of one');
  assert.equal(await reach(worker.fetch(upgrade('world:24,9?of=cell:2:6,2'), { ROOMS: R.ROOMS })), 200, 'nor a node\'s own key: a page names cells');
  // COST-2 (b): `of` names every room the page holds - a second halo toward a node a halo of the page already holds is
  // that halo's room, never a second socket of one peer in one object
  assert.equal(await reach(worker.fetch(upgrade(`world:29,9?of=${encodeURIComponent('world:25,9;world:28,9')}`), { ROOMS: R.ROOMS })), 101, 'the next node already held by a halo');
  assert.equal(closes.length, 2);
  assert.equal(await reach(worker.fetch(upgrade(`world:32,9?of=${encodeURIComponent('world:25,9;world:28,9')}`), { ROOMS: R.ROOMS })), 200, 'a node none of them is in walks');
  const many = Array.from({ length: 12 }, (_, i) => `world:${60 + i},0`).concat('world:25,9').join(';');
  assert.equal(await reach(worker.fetch(upgrade(`world:24,9?of=${encodeURIComponent(many)}`), { ROOMS: R.ROOMS })), 200, 'no more than HALO_OF_MAX rooms read');
  closes.length = 1;
  cellTreeCache.reset();
  const L0 = relay();
  assert.equal(await reach(worker.fetch(upgrade('world:24,9?of=world:25,9'), { ROOMS: L0.ROOMS })), 200, 'at L0 the neighbour is its own object');
  assert.equal(L0.asks.at(-1).name, 'world:24,9');
  assert.equal(closes.length, 1);
});

test('COST-2 AN OBJECT BELIEVES ITS NODE ONLY WHEN IT HOLDS THE CELL, AND SAYS ITS LEVEL: the Worker\'s header kept when the node holds the socket\'s cell, never when it does not; the directory\'s stored tree read strictly; the level on the metrics point (blob11), \'\' for a room told none (mutants: a header believed loose; the level unsaid)', async () => {
  const room = {};
  const req = (node) => new Request('https://relay.invalid/room/world:25,9', { headers: { [NODE_HEADER]: node } });
  nodeHeard(room, req('cell:4:0,0'), 'world:25,9');
  assert.equal(room._node, undefined, 'world:25,9 is not in cell:4:0,0');
  nodeHeard(room, req('cell:2:6,2'), 'town:x');
  assert.equal(room._node, undefined, 'no cell, no node');
  assert.equal(cellLevelOf(room), '');
  nodeHeard(room, req('cell:2:6,2'), 'world:25,9');
  assert.equal(room._node, 'cell:2:6,2');
  assert.equal(cellLevelOf(room), '2');
  nodeHeard(room, req('world:25,9'), 'world:25,9');
  assert.equal(cellLevelOf(room), '0');
  // the directory: a stored tree read strictly, kept for the instance
  // PIN MOVED (COST-2 part two): served only while `cellSeed` is on (L0 while it is off: the way back), and a tree it
  // cannot read seeded afresh at the setting's level - test/server/cellmoves.test.js holds the seed
  const dir = fakeRoom(CELL_DIRECTORY);
  dir.store.set(CELL_TREE_KEY, SEEDED);
  assert.deepEqual(await (await cellTreeInternal(dir.room)).json(), L0_TREE, 'cellSeed off: L0, whatever it stores');
  dir.room.env.CELL_SEED = '2';
  assert.deepEqual(await (await cellTreeInternal(dir.room)).json(), SEEDED);
  const bad = fakeRoom(CELL_DIRECTORY);
  bad.room.env.CELL_SEED = '3';
  bad.store.set(CELL_TREE_KEY, { v: 1, base: 2, split: ['world:1,1'] });
  assert.deepEqual(await (await cellTreeInternal(bad.room)).json(), seedTree(3), 'a tree it cannot read: seeded afresh');
  // blob11
  let p = null;
  const m = new RoomMetrics(0);
  m.c.frames = 1;
  m.flush({ writeDataPoint: (x) => { p = x; } }, 'world', 1, 'v', 1000, true, '2');
  assert.equal(p.blobs[10], '2');
  m.c.frames = 1;
  m.flush({ writeDataPoint: (x) => { p = x; } }, 'chat', 1, 'v', 2000, true);
  assert.equal(p.blobs[10], '');
});
