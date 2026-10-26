// COST-2 (b) (2026-10-24, the owner's session: no leave and join on a crossing inside a node; bible/11-Multiplayer/
// Scale-Arc.md COST-2): A SOCKET COVERS ITS NODE. The Worker puts a page's cell in the node that holds it; the object
// keeps that node on the socket's attachment (`nd`) and says the fine cells it covers in the welcome (`cells`); every
// cell-scoped law compares against that cover (net/cellTree.js coversCell) where it compared against the socket's key -
// a word's pixel, a grant's `q`, a park's anchor, a ledger row. The page keeps the cover its welcome said: a crossing
// into a covered cell is no crossing (the room renamed, the socket kept), no halo is asked toward a covered cell, and a
// word for a covered cell goes down the socket that covers it. Under L0 every cover is its own cell: today's law.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { coversCell, cellsOfNode, nodeOfCells, nodeHoldsCell } from '../../src/net/cellTree.js';
import { owCellSquare, owIdInCell, OW_BAND_LIFE_MS } from '../../src/net/overworldLaw.js';
import { grantRefusal, signGrant, GRANT_TTL_MS } from '../../src/net/grantLaw.js';
import { createGrantHost } from '../../src/scenes/grantHost.js';
import { OW_LEDGER_KEY } from '../../src/net/wire.js';
import { OnlineSession } from '../../src/net/online.js';
import { fakeRoom } from '../fakeRoom.mjs';
import { fakeSocketClass } from '../fakeSocket.mjs';
import { NODE_HEADER, coverOf, inCover, atCover } from '../../server/src/cellNodes.js';

/** A live band of cell origin (2cx, 499 - 2cy) - its last part its life, now's. */
const band = (cx, cy) => `b${cx}.${cy}.${Math.floor(Date.now() / OW_BAND_LIFE_MS)}`;
const NODE = 'cell:1:12,4';   // fine cells 24..25 x 8..9; map pixels [384, 416) x [128, 160)
const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn }; console.info = console.warn = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };

test('COST-2 (b) THE LAW OF WHAT A SOCKET COVERS: a fine cell covers itself alone, a coarse node every fine cell it holds and nothing else; a node\'s cells as the welcome says them and back; the ledger\'s square a node\'s widened like a cell\'s; a grant stands in any cell its reader\'s socket covers, and under L0 its own cell alone (mutants: a node covers its neighbour; a fine cover covers its node; the cells off by one; the square unwidened; the grant\'s cover unread)', () => {
  assert.equal(coversCell('world:24,8', 'world:24,8'), true);
  assert.equal(coversCell('world:24,8', 'world:25,8'), false, 'L0: its own cell alone');
  for (const c of ['world:24,8', 'world:25,8', 'world:24,9', 'world:25,9']) assert.equal(coversCell(NODE, c), true, c);
  for (const c of ['world:26,8', 'world:23,9', 'world:24,10', 'cell:1:12,4', 'town:x', null]) assert.equal(coversCell(NODE, c), c === NODE, String(c));
  assert.equal(coversCell('world:24,8', NODE), false, 'a fine cover never covers its node');
  assert.equal(nodeHoldsCell(NODE, 'world:25,9'), true);
  assert.deepEqual(cellsOfNode(NODE), [24, 8, 26, 10]);
  assert.deepEqual(cellsOfNode('world:24,8'), [24, 8, 25, 9]);
  assert.equal(nodeOfCells([24, 8, 26, 10]), NODE);
  assert.equal(nodeOfCells([24, 8, 25, 9]), 'world:24,8');
  for (const bad of [[24, 8, 27, 11], [25, 8, 27, 10], [24, 8, 26, 9], [0, 0, 32, 32], [24, 8, 26], 'x', null]) assert.equal(nodeOfCells(bad), null, JSON.stringify(bad));
  assert.deepEqual(owCellSquare(NODE), { x0: 376, y0: 120, x1: 424, y1: 168 }, 'the node\'s square widened by OW_CELL_MARGIN_PX');
  assert.equal(owIdInCell('b205.174.1', 'world:24,8'), false, 'a band of world:25,9 is no row of world:24,8');
  assert.equal(owIdInCell('b205.174.1', NODE), true, 'and is one of the node');
  // a grant made out to one cell of the node stands in any other the reader's socket covers
  const g = { o: 'peer-a', q: 'world:24,8', x: 10_000, n: 2, h: -1 };
  assert.equal(grantRefusal(g, { from: 'peer-a', cell: 'world:25,9', nowMs: 0, i: 0 }), 'cell', 'L0: the reader\'s own cell alone');
  assert.equal(grantRefusal(g, { from: 'peer-a', cell: 'world:25,9', cover: NODE, nowMs: 0, i: 0 }), null, 'its socket covers the grant\'s cell');
  assert.equal(grantRefusal({ ...g, q: 'world:26,8' }, { from: 'peer-a', cell: 'world:25,9', cover: NODE, nowMs: 0, i: 0 }), 'cell', 'one outside it is no grant here');
  // the relay's reads of a socket's cover
  assert.equal(coverOf({ key: 'world:24,8' }), 'world:24,8');
  assert.equal(coverOf({ key: 'world:24,8', nd: NODE }), NODE);
  assert.equal(inCover({ key: 'world:24,8', nd: NODE }, 'world:25,9'), true);
  assert.equal(inCover({ key: 'world:24,8' }, 'world:25,9'), false);
  assert.equal(atCover(null, null), true, 'a place that is no cell keeps a team that names no cell');
  assert.equal(atCover(null, 'world:1,1'), false);
  assert.equal(atCover(NODE, 'world:25,9'), true);
});

test('COST-2 (b) THE RELAY: an object told a coarse node keeps it on the socket\'s attachment (`nd`) - never one that does not hold the cell, never an L0 one; the welcome says the cells the socket covers; a ledger word for another cell of the node is taken there, and at L0 it is junk as before (mutants: the cover unkept; the welcome unsaid; the ledger bound to the fine cell)', async (t) => {
  const had = globalThis.WebSocketPair;
  const made = [];
  globalThis.WebSocketPair = class { constructor() { const att = { v: null }; this[0] = {}; this[1] = { serializeAttachment(a) { att.v = JSON.parse(JSON.stringify(a)); }, deserializeAttachment() { return att.v; }, close() {} }; made.push(att); } };
  t.after(() => { globalThis.WebSocketPair = had; });
  const upgrade = (node) => new Request('https://relay.test/room/world:24,8', { headers: { Upgrade: 'websocket', ...(node ? { [NODE_HEADER]: node } : {}) } });
  const accept = async (node) => { const r = fakeRoom('world:24,8'); try { await r.room.fetch(upgrade(node)); } catch { /* node mints no 101 */ } return made.at(-1).v; };
  assert.equal((await accept(NODE)).nd, NODE, 'a coarse node kept on the socket');
  assert.equal((await accept('world:24,8')).nd, undefined, 'an L0 node is the socket\'s own key: nothing kept');
  assert.equal((await accept('cell:1:13,4')).nd, undefined, 'a node that does not hold the cell is never believed');
  assert.equal((await accept(null)).nd, undefined);

  await quiet(async () => {
    const r = fakeRoom('world:24,8');
    const a = r.connect();
    a.att = { ...a.att, nd: NODE };
    r.room._adopt(a, a.att);
    await r.hello(a, 'peer-0001', null, { cv: 1 });   // PIN MOVED (COST-2 part two): a coarse node's hello says the cell law (cv), or the cell door refuses it - test/server/cellmoves.test.js
    assert.deepEqual(a.sent.find((m) => m.t === 'welcome')?.cells, [24, 8, 26, 10], 'the welcome: the cells the socket covers');
    const there = band(205, 174);   // map pixel (410, 151): world:25,9
    await r.raw(a, JSON.stringify({ t: 'ow', k: 'sp', ids: [there] }));
    assert.deepEqual(r.store.get(OW_LEDGER_KEY)?.sp?.map((e) => e[0]), [there], 'a band of world:25,9 taken in the node');
    const L0 = fakeRoom('world:24,8');
    const b = L0.connect();
    await L0.hello(b, 'peer-0002', null);
    assert.deepEqual(b.sent.find((m) => m.t === 'welcome')?.cells, [24, 8, 25, 9], 'L0: its own cell');
    await L0.raw(b, JSON.stringify({ t: 'ow', k: 'sp', ids: [band(205, 174)] }));
    assert.equal(L0.store.has(OW_LEDGER_KEY), false, 'at L0 the neighbour\'s band is junk, as before');
    await L0.raw(b, JSON.stringify({ t: 'ow', k: 'sp', ids: [band(195, 180)] }));
    assert.deepEqual(L0.store.get(OW_LEDGER_KEY)?.sp?.map((e) => e[0]), [band(195, 180)], 'its own cell\'s band taken - the fixture is live');
  });
});

/** A session in world:24,8, its welcome saying `cells`. */
function session(cells) {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { t: 1000 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => clock.t, rand: () => 0 });
  const pose = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 };
  s.join('world:24,8', pose); sockets[0].open();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'bob-0002', name: 'Bob', pose: null }], host: null, world: null, ...(cells ? { cells } : {}) });
  return { s, sockets, clock, pose };
}

test('COST-2 (b) THE PAGE: a crossing into a cell its socket covers is no crossing - no socket closed or opened, the room renamed and its peers with it; no halo toward a covered cell, one toward the next node; the overworld word bounded by the node\'s square; a relay that says no `cells` keeps today\'s crossing (mutants: the crossing reopened; the roster left behind; a halo asked toward a covered cell; the word bound to the fine cell; an old relay\'s welcome read as a node)', async () => {
  await quiet(async () => {
    const { s, sockets, pose } = session([24, 8, 26, 10]);
    assert.equal(s.coverOf('world:24,8'), NODE);
    assert.equal(s.inRoom('world:25,9'), true, 'a covered cell is a cell I hold - the host joins it at once');
    s.join('world:25,9', pose);
    assert.equal(s.room, 'world:25,9');
    assert.equal(sockets.length, 1, 'no socket opened');
    assert.equal(sockets[0].closed, null, 'none closed');
    assert.equal(s._ws, sockets[0]);
    assert.ok(s._rooms.get('world:25,9')?.has('bob-0002') && !s._rooms.has('world:24,8'), 'the roster under the room crossed into');
    s.setHalo(['world:24,9', 'world:26,9']);
    assert.deepEqual(s.haloRooms(), ['world:26,9'], 'a halo toward the next node alone');
    assert.equal(new URL(sockets[1].url).searchParams.get('of'), 'world:25,9');
    // the overworld word: a band of world:24,8, in the node, said from world:25,9
    s.owOk = true;
    assert.deepEqual(s.sendOverworld('sp', ['b195.180.1', 'b215.180.1']), ['b195.180.1'], 'bounded by the node\'s square, not the fine cell\'s');
    // a welcome whose cells hold another node, or only the room itself, is no node of this socket's
    assert.equal(session([26, 8, 28, 10]).s.coverOf('world:24,8'), 'world:24,8', 'a node that does not hold the room is never believed');
    // a relay before COST-2: no `cells`, today's crossing
    const old = session(null);
    assert.equal(old.s.coverOf('world:24,8'), 'world:24,8');
    old.s.join('world:25,9', old.pose);
    assert.equal(old.sockets.length, 2, 'a new socket for the new cell');
    assert.ok(old.sockets[0].closed, 'and the old closed');
  });
});

test('COST-2 (b) A COVERED CROSSING TAKES EVERY ROOM-KEYED RECORD WITH IT: every map and set _forgetRoom lets go of a room by - its own key or its `room|account` keys - is one _renameRoom moves, the peers it heard there and the layer it stood in going with it (mutants: a map left behind; a peer\'s source left)', () => {
  // a room beside the session's own: letting its own room go also starts the hub's lists afresh, which is no record kept by room
  const FROM = 'world:24,9';
  const TO = 'world:25,9';
  // Each entry is iterable (the room's own roster is read as a set of ids) and carries the field a peer is read by.
  const entry = () => Object.assign([], { src: null });
  const collections = (session) => Object.entries(session).filter(([, value]) => value instanceof Map || value instanceof Set);
  const fill = (session) => {
    for (const [, collection] of collections(session)) {
      for (const key of [FROM, `${FROM}|acct-x`]) {
        if (collection instanceof Map) collection.set(key, entry());
        else collection.add(key);
      }
    }
  };
  const held = (collection, key) => collection.has(key);

  // Which collections are keyed by the room, learned by asking _forgetRoom to let one go.
  const probe = session(null).s;
  fill(probe);
  probe._forgetRoom(FROM);
  const roomKeyed = collections(probe)
    .map(([name, collection]) => [name, [FROM, `${FROM}|acct-x`].filter((key) => !held(collection, key))])
    .filter(([, keys]) => keys.length);
  assert.ok(roomKeyed.length >= 6, `the room-keyed records found: ${roomKeyed.map(([name]) => name).join(', ')}`);

  // A crossing's rename moves every one of them, each key to the new room's.
  const crossing = session(null).s;
  fill(crossing);
  const peer = { id: 'peer-0001', src: FROM };
  crossing.peers.set(peer.id, peer);
  crossing._layerRoom = FROM;
  crossing._renameRoom(FROM, TO);
  for (const [name, keys] of roomKeyed) {
    const collection = crossing[name];
    for (const key of keys) {
      assert.equal(held(collection, key), false, `${name}: ${key} let go`);
      assert.equal(held(collection, TO + key.slice(FROM.length)), true, `${name}: moved to the room crossed into`);
    }
  }
  assert.equal(peer.src, TO, 'a peer heard in the room is heard in the room crossed into');
  assert.equal(crossing._layerRoom, TO, 'and the layer the room stood in is that room\'s');
});

test('COST-2 (b) THE GRANTS\' READER ASKS THE SOCKET\'S COVER: a foe on a grant made out to a cell the socket it came on covers stands; the same grant read by a socket covering its own cell alone is refused as another cell\'s (mutants: the cover unread by the host)', async () => {
  const { subtle } = globalThis.crypto;
  const keys = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const OWNER = 'aaa-0001';
  const unsigned = { g: 7, o: OWNER, q: 'world:24,8', a: 'acct-a', k: 'enc', p: [3, 12], m: 9, l: 9, r: 7, n: 1, s: 5, e: 0, c: [-1], h: -1, x: Date.now() + GRANT_TTL_MS };
  const grant = { ...unsigned, sg: await signGrant(unsigned, keys.privateKey, { subtle }) };
  const record = { i: 1, gr: [grant.g, 0] };
  const readFrom = async (coverOfRoom) => {
    const session = { id: 'mmm-0002', room: 'world:25,9', status: 'open', grantMode: 'measure', coverOf: coverOfRoom, sendGrant: () => true };
    const host = createGrantHost({ session: () => session, climateAt: null, fetchKey: async () => keys.publicKey });   // no climate: the species is not the question here
    host.heard(OWNER, [grant]);
    return host.check(OWNER, 'world:25,9', record);
  };
  assert.equal(await readFrom(() => NODE), null, 'the socket covers the node that holds the grant\'s cell: it stands');
  assert.equal(await readFrom((room) => room), 'cell', 'a socket covering its own cell alone: another cell\'s grant');
});
