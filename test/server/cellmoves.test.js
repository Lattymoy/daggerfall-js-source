// COST-2 part two (2026-10-25; bible/11-Multiplayer/Scale-Arc.md COST-2 part two): THE TREE MOVES, at the relay
// (server/src/cellMoves.js, cellNodes.js, cellHandover.js). The directory seeds its tree while `cellSeed` is on, hears its
// nodes' counts, plans a move when the law says one is due, and makes it in its alarm - each departing layer's rows sent
// and kept, the tree committed, then every socket closed CLOSE_REPARTITION and the rows sent again and let go - resuming
// from the stage it stored. A node a move closed answers "moved" to an isolate whose tree is older, which asks again; the
// calls between rooms that name a cell reach the node that holds it; a coarse node pulls a fine cell's rows from before
// the seed; and a coarse node's door refuses a page that names no `of`. Over real Rooms on the pins' fake objects.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import worker from '../../server/src/index.js';
import { fakeRoom, fakeRooms } from '../fakeRoom.mjs';
import {
  CELL_INTERNAL_COUNT, CELL_INTERNAL_MOVE, CELL_PLAN_KEY, COUNT_TELL_MS, COUNT_STALE_MS, MOVE_COOLDOWN_MS, MOVED_KEEP_MS, CLOSE_RETRY_MS,
  CELL_LAW_DEFAULT, CELL_LAW_VARS, cellLawOf, cellDoors, isCellDirectory,
} from '../../server/src/cellMoves.js';
import { CELL_DIRECTORY, CELL_INTERNAL_TREE, CELL_TREE_KEY, NODE_HEADER, CELL_TELL_HEADER, MOVED_HEADER, cellTreeCache, cellCall, nodeHeard, cellLevelOf } from '../../server/src/cellNodes.js';
import { RELAY_CFG_TTL_MS } from '../../src/net/relayCfg.js';
import { CELL_MOVED_KEY, CELL_PULLED_KEY } from '../../server/src/cellHandover.js';
import { tellCell, SEV_INTERNAL_CALL } from '../../server/src/staffEvents.js';
import { RoomMetrics } from '../../server/src/relayScale.js';
import { loadSql } from '../../tools/relayLoad.mjs';
import { L0_TREE, seedTree, splitTree, childNodes, nodeHolds } from '../../src/net/cellTree.js';
import { owLedgerOf, owIdPixel } from '../../src/net/overworldLaw.js';
import {
  SOCIAL_ROOM, OW_LEDGER_KEY, PIXEL_UNITS, parkKey, RAID_LEDGER_PREFIX, LAYER_HEADER, PARK_INTERNAL_DROP, CLOSE_REPARTITION, CLOSE_POLICY, CELL_OLD_REASON, CELL_HELLO_LAW,
} from '../../src/net/wire.js';

const T0 = 1_800_000_000_000;
const NODE = 'cell:2:6,2';   // map pixels [384, 448) x [128, 192): world:24,8 to world:27,11
const KIDS = childNodes(NODE);   // cell:1:12,4 13,4 12,5 13,5
const SEED = seedTree(2);
const SPLIT = splitTree(SEED, NODE);
const settle = async () => { for (let i = 0; i < 40; i++) await new Promise((r) => setImmediate(r)); };
const quiet = async (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return await fn(); } finally { console.warn = w; console.log = l; } };
const internal = (path, body) => new Request(`https://relay.internal${path}`, { method: 'POST', body: JSON.stringify(body) });
const K = (c) => c.repeat(24);
/** A park record standing its wagon at map pixel (px, py) (cellhandover.test.js's). */
const park = (k, px, py, at = T0 - 1000) => [parkKey(k), { k, sub: `acct-${k}`, id: `peer-${k}`, name: k, at, r: { w: [1, px * PIXEL_UNITS + 10, 1, (499 - py) * PIXEL_UNITS + 10, 0, 0, 0, 1, 50, 0] } }];
/** A world of rooms whose directory's `cellSeed` is `seed` ('' off). */
function world(seed = '2') {
  cellTreeCache.reset();
  const W = fakeRooms({ now: () => Date.now() });
  if (seed) W.room(CELL_DIRECTORY).env.CELL_SEED = seed;
  return W;
}
/** A hello'd socket of fine cell `cell` in node room `r` (its cover the coarse node `nd`, its layer `ly`). */
async function seat(r, id, cell, nd, ly = 0) {
  const ws = r.connect();
  ws.att = { ...ws.att, key: cell, ...(nd ? { nd } : {}), ...(ly ? { ly } : {}) };
  r.room._adopt(ws, ws.att);
  await r.hello(ws, id, null, { cv: CELL_HELLO_LAW });
  return ws;
}

test('COST-2 part two THE DIRECTORY KNOWS ITSELF BY ITS ID, AND ITS THRESHOLDS ARE THE RELAY\'S VARS: no room but the directory runs its alarm as the directory\'s; the law each var says, a bad one its default, a merge not under the split the defaults whole - and wrangler.toml declares the four at their defaults (mutants: every room the directory; a var unread; the merge over the split taken)', () => {
  const W = world();
  assert.equal(isCellDirectory(W.room(CELL_DIRECTORY).room), true);
  assert.equal(isCellDirectory(W.room(NODE).room), false);
  assert.equal(isCellDirectory(fakeRoom(CELL_DIRECTORY).room), false, 'no ROOMS binding: no directory to be');
  assert.deepEqual(cellLawOf({}), CELL_LAW_DEFAULT);
  assert.deepEqual(cellLawOf({ CELL_SPLIT_AT: '200', CELL_SPLIT_DWELL_MS: '5000', CELL_MERGE_AT: '20', CELL_MERGE_DWELL_MS: '9000' }), { splitAt: 200, splitDwellMs: 5000, mergeAt: 20, mergeDwellMs: 9000 });
  assert.equal(cellLawOf({ CELL_SPLIT_AT: 'lots' }).splitAt, 150);
  assert.deepEqual(cellLawOf({ CELL_MERGE_AT: '150' }), CELL_LAW_DEFAULT);
  // the deploy's own [vars], read as the relay reads them: the four thresholds the defaults, and no seed
  const toml = readFileSync(new URL('../../server/wrangler.toml', import.meta.url), 'utf8');
  const deployed = Object.fromEntries([...toml.matchAll(/^(CELL_\w+) = "([^"]*)"$/gm)].map((m) => [m[1], m[2]]));
  assert.deepEqual(Object.keys(deployed).sort(), Object.values(CELL_LAW_VARS).sort(), 'the four thresholds declared, and cellSeed not: it goes on at the hub once the site serves the build that says `cv`');
  assert.deepEqual(cellLawOf(deployed), CELL_LAW_DEFAULT);
  for (const k of Object.values(CELL_LAW_VARS)) assert.ok(/^\d+$/.test(deployed[k]), `${k} a whole number, never a default by accident`);
});

test('COST-2 part two THE SEED IS A SETTING AT THE HUB: a developer sets cellSeed - off, or a level 1 to 4, anything else refused with its words - and the directory, asking the hub as a ground room\'s door does, seeds its tree at that level; set off, the directory answers L0 and keeps the tree it stored (mutants: the setting unrefused; the hub unasked; the stored tree dropped)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now);
  await quiet(async () => {
    const W = world('');
    const H = W.room(SOCIAL_ROOM);
    const dev = H.connect();
    await H.hello(dev, 'dev-0001', null, { glyphs: ['dev'] });
    const say = async (v) => { now += 5000; await H.raw(dev, JSON.stringify({ t: 'cfg', k: 'cellSeed', v })); return dev.sent.filter((f) => f.t === 'cfg').at(-1); };
    for (const bad of ['on', '5', '0']) assert.match((await say(bad)).error ?? '', /cellSeed is off .* or the level the directory seeds it at, 1 to 4/, bad);
    assert.deepEqual(await say('2'), { t: 'cfg', k: 'cellSeed', v: '2' });
    const dir = W.room(CELL_DIRECTORY);
    const tree = async () => (await dir.room.fetch(new Request(`https://relay.internal${CELL_INTERNAL_TREE}`))).json();
    assert.deepEqual(await tree(), SEED, 'the hub asked before its first answer: seeded');
    assert.deepEqual(dir.store.get(CELL_TREE_KEY), SEED);
    await say('off');
    now += RELAY_CFG_TTL_MS;
    await tree();   // asked beside: the answer is the next one's
    await settle();
    assert.deepEqual(await tree(), L0_TREE, 'off: L0');
    assert.deepEqual(dir.store.get(CELL_TREE_KEY), SEED, 'and the stored tree kept for the way forward');
  });
});

test('COST-2 part two A NODE TELLS ITS COUNT: an object the Worker says stands in a moving tree tells the directory its named sockets, by node and layer, from its metrics tick and at most every COUNT_TELL_MS; one in a fixed tree tells nothing (mutants: the count untold; told every frame; told in a fixed tree; the layer unsaid)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now);
  await quiet(async () => {
    const W = world();
    const r = W.room(`${NODE}#2`);
    nodeHeard(r.room, new Request('https://relay.invalid/room/world:25,9', { headers: { [NODE_HEADER]: NODE, [CELL_TELL_HEADER]: '1', [LAYER_HEADER]: '2' } }), 'world:25,9');
    assert.equal(r.room._cellTell, true);
    assert.equal(r.room._cellLy, 2);
    await seat(r, 'peer-0001', 'world:25,9', NODE, 2);
    await seat(r, 'peer-0002', 'world:24,8', NODE, 2);
    await settle();
    const reports = () => W.room(CELL_DIRECTORY).room._cellDir?.reports;
    assert.deepEqual(reports()?.get(`${NODE}#2`), { node: NODE, n: 1, at: T0 }, 'told at its first hello: one named then');
    now += COUNT_TELL_MS - 1;
    r.room._metricsTick();
    await settle();
    assert.equal(reports().get(`${NODE}#2`).at, T0, 'not again before COUNT_TELL_MS');
    now += 1;
    r.room._metricsTick();
    await settle();
    assert.deepEqual(reports().get(`${NODE}#2`), { node: NODE, n: 2, at: now });
    // hibernated and woken by a frame: the Worker tells the new instance nothing - it reads its node back off a socket
    r.wake();
    now += COUNT_TELL_MS;
    r.room._metricsTick();
    await settle();
    assert.deepEqual(reports().get(`${NODE}#2`), { node: NODE, n: 2, at: now }, 'a woken node tells its count again');
    assert.equal(cellLevelOf(r.room), '2', 'and says its level');
    // a fixed tree: the header unsaid, nothing told
    const L0 = world('');
    const f = L0.room('world:25,9');
    nodeHeard(f.room, new Request('https://relay.invalid/room/world:25,9', { headers: { [NODE_HEADER]: 'world:25,9', [CELL_TELL_HEADER]: '' } }), 'world:25,9');
    await seat(f, 'peer-0003', 'world:25,9', null);
    await settle();
    assert.equal(L0.made.has(CELL_DIRECTORY), false, 'the directory never asked');
  });
});

test('COST-2 part two THE LAW PLANS A MOVE: a node past the split line for its dwell is planned and the alarm set at once; a count gone stale counts none; nothing is planned in a fixed tree, nor while a move is being made; a count that is no count is refused (mutants: the plan unstored; the alarm unset; a stale count counted; a plan over a plan; a fixed tree moved)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now);
  await quiet(async () => {
    const W = world();
    const dir = W.room(CELL_DIRECTORY);
    const tell = (node, n, ly = 0) => dir.room.fetch(internal(CELL_INTERNAL_COUNT, { node, ly, n }));
    assert.equal((await tell(NODE, 151)).status, 200);
    assert.deepEqual(dir.store.get(CELL_TREE_KEY), SEED, 'seeded at its first ask');
    now += 30_000;
    await tell(NODE, 100, 1);   // its layer: 151 + 100 together
    now += 30_000;
    await tell(NODE, 151);
    const planned = { kind: 'split', from: [NODE], to: KIDS, stage: 'move', at: now };
    assert.deepEqual(dir.store.get(CELL_PLAN_KEY), planned);
    assert.equal(dir.alarm.at, now, 'the alarm set for it at once');
    now += 60_000;
    await tell('cell:2:9,2', 999);
    await tell(NODE, 151);
    assert.deepEqual(dir.store.get(CELL_PLAN_KEY), planned, 'one move at a time: the plan as it was made');
    for (const bad of [{ node: 'town:x', ly: 0, n: 1 }, { node: NODE, ly: 8, n: 1 }, { node: NODE, ly: 0, n: -1 }, { node: NODE, ly: 0, n: 1.5 }]) assert.equal((await dir.room.fetch(internal(CELL_INTERNAL_COUNT, bad))).status, 400, JSON.stringify(bad));
    // stale: a count unheard for COUNT_STALE_MS counts none, so its dwell is forgotten
    const S = world();
    const sd = S.room(CELL_DIRECTORY);
    now = T0;
    await sd.room.fetch(internal(CELL_INTERNAL_COUNT, { node: NODE, ly: 0, n: 200 }));
    now += COUNT_STALE_MS + 1;
    await sd.room.fetch(internal(CELL_INTERNAL_COUNT, { node: 'cell:2:9,2', ly: 0, n: 3 }));
    assert.deepEqual(sd.room._cellDir.dwell.over, {}, 'stale: its dwell forgotten');
    // a fixed tree moves nothing, whatever it hears
    const F = world('');
    const fd = F.room(CELL_DIRECTORY);
    now = T0;
    for (let i = 0; i < 3; i++) { await fd.room.fetch(internal(CELL_INTERNAL_COUNT, { node: 'world:25,9', ly: 0, n: 0 })); now += 10 * 60_000; }
    assert.equal(fd.store.has(CELL_PLAN_KEY), false);
    assert.equal(fd.store.has(CELL_TREE_KEY), false, 'nothing written');
  });
});

/** A seeded world whose node NODE holds a park in each child's square and a ledger, two players, and a layer (#1) with
 *  one player and a park of its own - and the directory's split of NODE planned. */
async function splitPlanned() {
  const W = world();
  const dir = W.room(CELL_DIRECTORY);
  const n0 = W.room(NODE), n1 = W.room(`${NODE}#1`);
  for (const [k, v] of [park(K('a'), 390, 130), park(K('b'), 420, 131), park(K('c'), 386, 170)]) n0.store.set(k, v);
  const [k1, v1] = park(K('d'), 440, 180);
  n1.store.set(k1, v1);
  n0.store.set(OW_LEDGER_KEY, owLedgerOf({ sp: [['b195.175.2', T0 + 3_600_000]], dg: {}, gr: {} }));
  const socks = [await seat(n0, 'peer-0001', 'world:25,9', NODE), await seat(n0, 'peer-0002', 'world:26,10', NODE), await seat(n1, 'peer-0003', 'world:24,8', NODE)];
  await dir.room.fetch(internal(CELL_INTERNAL_COUNT, { node: NODE, ly: 0, n: 2 }));   // the tree seeded
  dir.store.set(CELL_PLAN_KEY, { kind: 'split', from: [NODE], to: KIDS, stage: 'move', at: T0 });
  dir.wake();
  return { W, dir, n0, n1, socks };
}
const parksIn = (W, name) => [...W.room(name).store.keys()].filter((k) => k.startsWith('park:')).sort();

test('COST-2 part two A SPLIT IS MADE IN THREE STAGES: each departing layer sends its rows and keeps them, the tree is committed, then each closes its sockets CLOSE_REPARTITION, marks itself moved and lets its rows go - every row in the child that holds its pixel, nothing left behind, an empty layer unmarked; the move counted on the directory\'s metrics point (mutants: the rows let go at stage 1; the tree uncommitted; the sockets left open; the close code; the layers unasked; an empty layer marked; the move uncounted)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now);
  await quiet(async () => {
    const { W, dir, n0, n1, socks } = await splitPlanned();
    const points = [];
    dir.env.METRICS = { writeDataPoint: (p) => points.push(p) };
    const asked = [];
    const get = W.ROOMS.get;
    W.ROOMS.get = (id) => ({ fetch: (req) => { asked.push([id, new URL(req.url).pathname]); return get(id).fetch(req); } });
    await dir.fire();
    W.ROOMS.get = get;
    assert.deepEqual(asked.filter(([, p]) => p === CELL_INTERNAL_MOVE).map(([id]) => id), Array.from({ length: 8 }, (_, ly) => (ly ? `${NODE}#${ly}` : NODE)), 'stage 1: every layer of the departing node');
    assert.deepEqual(dir.store.get(CELL_TREE_KEY), SPLIT, 'stage 2: the tree committed');
    assert.equal(dir.store.has(CELL_PLAN_KEY), false, 'the plan made and gone');
    assert.deepEqual(socks.map((s) => s.closed), Array(3).fill({ code: CLOSE_REPARTITION, reason: 'cells moved' }), 'stage 3: every socket closed');
    assert.equal(n0.sockets.length + n1.sockets.length, 0);
    assert.deepEqual(parksIn(W, NODE), [], 'the place let its rows go');
    assert.deepEqual(parksIn(W, `${NODE}#1`), [], 'and its layer');
    assert.equal(n0.store.has(OW_LEDGER_KEY), false);
    assert.equal(n0.store.get(CELL_MOVED_KEY), now, 'the place marked moved');
    assert.equal(n1.store.get(CELL_MOVED_KEY), now, 'a layer that held anyone marked');
    assert.equal(W.room(`${NODE}#5`).store.has(CELL_MOVED_KEY), false, 'an empty layer walked past to its place: unmarked');
    assert.deepEqual(parksIn(W, KIDS[0]), [parkKey(K('a'))]);
    assert.deepEqual(parksIn(W, KIDS[1]), [parkKey(K('b'))]);
    assert.deepEqual(parksIn(W, KIDS[2]), [parkKey(K('c'))]);
    assert.deepEqual(parksIn(W, KIDS[3]), [parkKey(K('d'))], 'the layer\'s park to the child that holds it');
    const band = owIdPixel('b195.175.2');
    const home = KIDS.find((k) => nodeHolds(k, band.x, band.y));
    assert.deepEqual(owLedgerOf(W.room(home).store.get(OW_LEDGER_KEY)).sp.map((e) => e[0]), ['b195.175.2'], 'the ledger\'s band to the child of its pixel');
    const p = points.at(-1);
    assert.deepEqual([p.indexes[0], p.blobs[11], p.blobs[12]], ['cells', '1', '0'], 'blob12: one move made');
  });
});

test('COST-2 part two A DIRECTORY THAT STOPS RESUMES THE MOVE: stopped after stage 1 the departing node still serves its rows (sent, kept), and a new instance makes the move from it; stopped after the commit, a new instance closes; a layer that never answers the close is asked again CLOSE_RETRY_MS on, the plan kept (mutants: stage 1 letting go; the plan unread on a wake; a close unanswered taken as made)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now);
  await quiet(async () => {
    const { W, dir, n0 } = await splitPlanned();
    // stage 1 alone, as a directory that stopped before its commit leaves it
    const r = await (await n0.room.fetch(internal(CELL_INTERNAL_MOVE, { to: KIDS, ly: 0 }))).json();
    assert.equal(r.ok, true);
    assert.deepEqual(parksIn(W, NODE), [parkKey(K('a')), parkKey(K('b')), parkKey(K('c'))], 'sent and kept: the node still serves them');
    assert.deepEqual(parksIn(W, KIDS[0]), [parkKey(K('a'))], 'and the child holds its copy');
    await dir.fire();
    assert.deepEqual(dir.store.get(CELL_TREE_KEY), SPLIT, 'a new instance made the move');
    assert.deepEqual(parksIn(W, KIDS[0]), [parkKey(K('a'))], 'each row once');
    assert.deepEqual(parksIn(W, NODE), []);
    // committed, then stopped: the close alone
    const C = await splitPlanned();
    C.dir.store.set(CELL_TREE_KEY, SPLIT);
    C.dir.store.set(CELL_PLAN_KEY, { kind: 'split', from: [NODE], to: KIDS, stage: 'close', at: T0 });
    C.dir.wake();
    const get = C.W.ROOMS.get;
    C.W.ROOMS.get = (id) => (id === `${NODE}#3` ? { fetch: async () => { throw new Error('down'); } } : get(id));
    await C.dir.fire();
    assert.equal(C.dir.store.get(CELL_PLAN_KEY)?.stage, 'close', 'a layer unanswered: the plan kept');
    assert.equal(C.dir.alarm.at, now + CLOSE_RETRY_MS);
    assert.deepEqual(parksIn(C.W, KIDS[0]), [parkKey(K('a'))], 'the layers that answered closed');
    C.W.ROOMS.get = get;
    now += CLOSE_RETRY_MS;
    await C.dir.fire();
    assert.equal(C.dir.store.has(CELL_PLAN_KEY), false, 'asked again: made');
    // a key that blocks came between stage 1 and the close: the tree is committed, so the rows go and it is left behind
    const B = await splitPlanned();
    B.dir.store.set(CELL_TREE_KEY, SPLIT);
    B.dir.store.set(CELL_PLAN_KEY, { kind: 'split', from: [NODE], to: KIDS, stage: 'close', at: T0 });
    B.dir.wake();
    B.n0.store.set(`${RAID_LEDGER_PREFIX}r2`, { k: 'r2' });
    await B.dir.fire();
    assert.equal(B.dir.store.has(CELL_PLAN_KEY), false);
    assert.deepEqual(parksIn(B.W, KIDS[0]), [parkKey(K('a'))], 'the rows handed over all the same');
    assert.equal(B.n0.store.has(`${RAID_LEDGER_PREFIX}r2`), true, 'the key that blocks left behind');
  });
});

test('COST-2 part two A MOVE ITS ROWS BLOCK IS NOT MADE: a departing layer that holds a key that blocks, or a child that never takes, drops the plan with the tree as it was and every row where it stood; the node left alone MOVE_COOLDOWN_MS and the blocked move counted (mutants: a blocked move made; the plan kept; the node uncooled; uncounted)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now);
  await quiet(async () => {
    const { W, dir, n0, socks } = await splitPlanned();
    const points = [];
    dir.env.METRICS = { writeDataPoint: (p) => points.push(p) };
    n0.store.set(`${RAID_LEDGER_PREFIX}r1`, { k: 'r1' });
    await dir.fire();
    assert.deepEqual(dir.store.get(CELL_TREE_KEY), SEED, 'the tree as it was');
    assert.equal(dir.store.has(CELL_PLAN_KEY), false, 'the plan dropped');
    assert.equal(dir.room._cellDir.cool[NODE], now + MOVE_COOLDOWN_MS, 'left alone');
    assert.deepEqual(parksIn(W, KIDS[0]), [], 'nothing sent');
    assert.equal(socks[0].closed, null, 'no socket closed');
    assert.deepEqual(points.at(-1).blobs.slice(11), ['0', '1'], 'blob13: one move blocked');
    // a child that never takes
    const F = await splitPlanned();
    const get = F.W.ROOMS.get;
    F.W.ROOMS.get = (id) => (id === KIDS[1] ? { fetch: async () => new Response('{}', { status: 500 }) } : get(id));
    await F.dir.fire();
    assert.deepEqual(F.dir.store.get(CELL_TREE_KEY), SEED);
    assert.deepEqual(parksIn(F.W, NODE).length, 3, 'every row where it stood');
  });
});

test('COST-2 part two A MOVED NODE SENDS ITS CALLER TO THE TREE AGAIN: a socket or a call that names a cell, from a caller in a moving tree, is answered 503 "moved" for MOVED_KEEP_MS, then admitted and the mark let go; a node that takes rows is a node again; a caller in a fixed tree is never answered so (mutants: the mark unread; kept for ever; read for a fixed tree; the take leaving it)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now);
  await quiet(async () => {
    const r = fakeRoom(NODE);
    r.store.set(CELL_MOVED_KEY, T0);
    const sock = (tell) => new Request('https://relay.invalid/room/world:25,9', { headers: { Upgrade: 'websocket', [NODE_HEADER]: NODE, [CELL_TELL_HEADER]: tell } });
    const res = await cellDoors(r.room, '/room/world:25,9', sock('1'));
    assert.equal(res?.status, 503);
    assert.equal(res.headers.get(MOVED_HEADER), '1');
    assert.equal((await cellDoors(r.room, PARK_INTERNAL_DROP, new Request(`https://relay.internal${PARK_INTERNAL_DROP}`, { method: 'POST', body: '{}', headers: { [CELL_TELL_HEADER]: '1' } })))?.status, 503, 'the registry\'s drop too');
    assert.equal(await cellDoors(r.room, '/room/world:25,9', sock('')), null, 'a fixed tree\'s caller: no mark read');
    assert.equal(await cellDoors(r.room, '/room/town:x', sock('1')), null, 'no cell');
    now += MOVED_KEEP_MS;
    assert.equal(await cellDoors(r.room, '/room/world:25,9', sock('1')), null, 'its keep past: admitted');
    assert.equal(r.store.has(CELL_MOVED_KEY), false, 'and the mark let go');
    const back = fakeRoom(NODE);
    back.store.set(CELL_MOVED_KEY, now);
    await back.room.fetch(internal('/internal/cells/take', { v: 1, parks: [], sp: [], dg: [], gr: [], copy: {} }));
    assert.equal(back.store.has(CELL_MOVED_KEY), false, 'a take: a node again');
    assert.equal(await cellDoors(back.room, '/room/world:25,9', sock('1')), null);
  });
});

/** A ROOMS binding (cellnodes.test.js's shape): the directory a real Room holding `tree` under `cellSeed` 2, `moved` the
 *  objects that answer "moved", every other object answering 200 and recorded. */
function relay(tree, moved = []) {
  const dir = fakeRoom(CELL_DIRECTORY);
  dir.env.CELL_SEED = '2';
  dir.store.set(CELL_TREE_KEY, tree);
  const asks = [], dirAsks = [];
  let down = false;
  const ROOMS = {
    idFromName: (name) => name,
    get: (id) => ({
      fetch: async (req) => {
        if (id === CELL_DIRECTORY) { dirAsks.push(1); if (down) throw new Error('down'); return dir.room.fetch(req); }
        asks.push({ name: id, tell: req.headers.get(CELL_TELL_HEADER) });
        if (moved.includes(id)) { const r = new Response('{}', { status: 503 }); r.headers.set(MOVED_HEADER, '1'); return r; }
        return new Response('{}', { status: 200 });
      },
    }),
  };
  return { ROOMS, asks, dirAsks, dir, set down(v) { down = v; } };
}
const upgrade = (key) => new Request(`https://relay.invalid/room/${key}`, { headers: { Upgrade: 'websocket' } });

test('COST-2 part two THE WORKER WALKS AGAIN PAST A MOVED NODE: an isolate whose tree is older than a move is answered "moved", asks the directory again at once and walks the node that holds the cell now; with the directory down it keeps the tree it had (never the fine key) and the page is answered 503; every walk says whether the tree moves (mutants: no second walk; the kept tree dropped; walked more than twice; the tell header unsaid or the page\'s)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now);
  await quiet(async () => {
    cellTreeCache.reset();
    const R = relay(SEED, [NODE]);
    await worker.fetch(upgrade('world:28,9'), { ROOMS: R.ROOMS });   // the isolate keeps the seed
    R.dir.store.set(CELL_TREE_KEY, SPLIT);
    R.dir.wake();
    R.dir.env.CELL_SEED = '2';
    const res = await worker.fetch(upgrade('world:25,9'), { ROOMS: R.ROOMS });
    assert.equal(res.status, 200);
    assert.deepEqual(R.asks.slice(1).map((a) => a.name), [NODE, KIDS[0]], 'the old node, then the child that holds the cell now');
    assert.equal(R.dirAsks.length, 2, 'the directory asked again at once');
    assert.deepEqual(R.asks.map((a) => a.tell), ['1', '1', '1'], 'a moving tree, said to every object');
    // the directory down at the second ask: the old tree kept, the page answered the node's 503
    cellTreeCache.reset();
    const D = relay(SEED, [NODE]);
    await worker.fetch(upgrade('world:28,9'), { ROOMS: D.ROOMS });
    D.down = true;
    const r2 = await worker.fetch(upgrade('world:25,9'), { ROOMS: D.ROOMS });
    assert.equal(r2.status, 503);
    assert.deepEqual(D.asks.slice(1).map((a) => a.name), [NODE, NODE], 'walked twice at most');
    assert.deepEqual(cellTreeCache.get()?.tree, SEED, 'the tree kept, never the fine key');
    // a fixed tree: the header said empty, whatever the page sent
    cellTreeCache.reset();
    const F = relay(SEED);
    F.dir.env.CELL_SEED = 'off';
    await worker.fetch(new Request('https://relay.invalid/room/world:25,9', { headers: { Upgrade: 'websocket', [CELL_TELL_HEADER]: '1' } }), { ROOMS: F.ROOMS });
    assert.deepEqual(F.asks.map((a) => [a.name, a.tell]), [['world:25,9', '']]);
  });
});

test('COST-2 part two A CALL BETWEEN ROOMS THAT NAMES A CELL REACHES ITS NODE: the park registry\'s drop goes to the layer of the node that holds the cell (not the fine cell\'s object), and past a move to the child that holds it now; the staff event\'s call to its cell goes the same way (mutants: the drop to the fine key; the layer dropped; no walk past a move; the staff call by its fine key)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now);
  await quiet(async () => {
    const W = world();
    const [pk, pv] = park(K('e'), 400, 150);
    W.room(`${NODE}#2`).store.set(pk, pv);
    W.room('world:25,9#2').store.set(pk, pv);   // a fine cell's object from before the seed: never the drop's
    await W.room('reg:somebody').room._parkTellDrop('world:25,9#2', K('e'), T0);
    assert.equal(W.room(`${NODE}#2`).store.has(pk), false, 'dropped in the node\'s layer');
    assert.equal(W.room('world:25,9#2').store.has(pk), true, 'never the fine cell\'s own object');
    // past a split, an isolate that kept the seed: the old node says "moved", the drop reaches the child
    W.room(KIDS[0]).store.set(pk, pv);
    W.room(CELL_DIRECTORY).store.set(CELL_TREE_KEY, SPLIT);
    W.room(CELL_DIRECTORY).wake();
    W.room(CELL_DIRECTORY).env.CELL_SEED = '2';
    W.room(NODE).store.set(CELL_MOVED_KEY, now);
    const res = await cellCall({ ROOMS: W.ROOMS }, 'world:25,9', 0, PARK_INTERNAL_DROP, { owner: K('e'), at: T0 });
    assert.equal(res.status, 200);
    assert.equal(W.room(KIDS[0]).store.has(pk), false, 'the child dropped it');
    // a staff event's call to its cell (the hub's, staffEvents.js tellCell): to the child that holds its pixel now
    const reached = [];
    const get = W.ROOMS.get;
    W.ROOMS.get = (id) => ({ fetch: (req) => { reached.push([id, new URL(req.url).pathname]); return get(id).fetch(req); } });
    await tellCell({ env: { ROOMS: W.ROOMS } }, { px: 400, py: 150 }, { id: 'sev-1', op: 'end' });
    W.ROOMS.get = get;
    assert.deepEqual(reached.filter(([, p]) => p === SEV_INTERNAL_CALL).map(([id]) => id), [KIDS[0]], 'the event\'s cell (world:25,9) reached at the node that holds it, never by its fine key');
  });
});

test('COST-2 part two A CALL THAT NAMES A CELL CARRIES A DEADLINE: an object that never answers is given up on when the call\'s time runs out, as every call between rooms is (SCALE2b\'s law) (mutants: the call without its signal)', async () => {
  cellTreeCache.reset();
  const ROOMS = {
    idFromName: (name) => name,
    get: (id) => ({
      fetch: (req) => (id === CELL_DIRECTORY
        ? Promise.resolve(new Response(JSON.stringify(SEED)))
        : new Promise((resolve, reject) => {
          // a call with no deadline would wait for ever: the object gives up on it first, so the pin fails, never hangs
          const giveUp = setTimeout(() => reject(new Error('never aborted: the call carries no deadline')), 1500);
          req.signal?.addEventListener('abort', () => { clearTimeout(giveUp); reject(req.signal.reason); });
        })),
    }),
  };
  const began = performance.now();
  await assert.rejects(cellCall({ ROOMS }, 'world:25,9', 0, PARK_INTERNAL_DROP, {}, 40), (e) => e?.name === 'TimeoutError');
  assert.ok(performance.now() - began < 2000, 'given up on at its deadline');
  cellTreeCache.reset();
});

test('COST-2 part two THE SEED\'S PULL: a fine cell\'s first socket in a coarse node pulls the rows that cell\'s own object kept before the seed - its parks and ledger taken, forgotten there, the cell remembered - and a second socket asks nothing; a layer\'s socket, an L0 node\'s and a fixed tree\'s never pull (mutants: no pull; pulled again; the rows left behind; a layer pulling; a fixed tree pulling)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now);
  await quiet(async () => {
    const W = world();
    const fine = W.room('world:25,9');
    const [pk, pv] = park(K('f'), 404, 150);
    fine.store.set(pk, pv);
    fine.store.set(OW_LEDGER_KEY, owLedgerOf({ sp: [['b202.175.1', T0 + 3_600_000]], dg: {}, gr: {} }));
    const node = W.room(NODE);
    const gives = [];
    const get = W.ROOMS.get;
    W.ROOMS.get = (id) => ({ fetch: (req) => { if (id === 'world:25,9') gives.push(new URL(req.url).pathname); return get(id).fetch(req); } });
    const sock = (key, headers) => new Request(`https://relay.invalid/room/${key}`, { headers: { Upgrade: 'websocket', [NODE_HEADER]: NODE, [CELL_TELL_HEADER]: '1', [LAYER_HEADER]: '0', ...headers } });
    assert.equal(await cellDoors(node.room, '/room/world:25,9', sock('world:25,9')), null, 'the socket goes on to its door');
    assert.deepEqual(gives, ['/internal/cells/give', '/internal/cells/forget']);
    assert.deepEqual(node.store.get(pk)?.k, K('f'), 'its park taken');
    assert.deepEqual(owLedgerOf(node.store.get(OW_LEDGER_KEY)).sp.map((e) => e[0]), ['b202.175.1'], 'its ledger merged');
    assert.equal(fine.store.has(pk), false, 'forgotten there');
    assert.equal(fine.store.has(OW_LEDGER_KEY), false);
    assert.deepEqual(node.store.get(CELL_PULLED_KEY), ['world:25,9']);
    await cellDoors(node.room, '/room/world:25,9', sock('world:25,9'));
    node.wake();
    await cellDoors(node.room, '/room/world:25,9', sock('world:25,9'));
    assert.equal(gives.length, 2, 'pulled once, a woken node too');
    await cellDoors(W.room(`${NODE}#1`).room, '/room/world:24,8', sock('world:24,8', { [LAYER_HEADER]: '1' }));
    await cellDoors(W.room('world:26,9').room, '/room/world:26,9', sock('world:26,9', { [NODE_HEADER]: 'world:26,9' }));
    await cellDoors(node.room, '/room/world:24,9', sock('world:24,9', { [CELL_TELL_HEADER]: '' }));
    W.ROOMS.get = get;
    assert.equal(W.made.has('world:24,8') || W.made.has('world:24,9'), false, 'a layer, an L0 node, a fixed tree: no pull');
  });
});

test('COST-2 part two THE CELL DOOR: a cell\'s hello in a coarse node from a build that says no cell law is refused with the reload words (CELL_OLD_REASON) and nothing written; one that says it is welcomed; a fine cell\'s object refuses nobody (mutants: the door open; shut at L0; the law read loose)', async () => {
  await quiet(async () => {
    const r = fakeRoom('world:25,9');
    const old = r.connect();
    old.att = { ...old.att, nd: NODE };
    r.room._adopt(old, old.att);
    await r.hello(old, 'peer-0001', null);
    assert.deepEqual(old.closed, { code: CLOSE_POLICY, reason: CELL_OLD_REASON });
    assert.match(old.sent.find((m) => m.t === 'error')?.m ?? '', /older than the world online/);
    assert.equal(old.sent.some((m) => m.t === 'welcome'), false);
    const now = r.connect();
    now.att = { ...now.att, nd: NODE };
    r.room._adopt(now, now.att);
    await r.hello(now, 'peer-0002', null, { cv: CELL_HELLO_LAW });
    assert.ok(now.sent.some((m) => m.t === 'welcome'));
    const fine = fakeRoom('world:25,9');
    const f = fine.connect();
    await fine.hello(f, 'peer-0003', null);
    assert.ok(f.sent.some((m) => m.t === 'welcome'), 'L0: nobody refused');
  });
});

test('COST-2 part two THE NODE COUNT BY LEVEL IS READ BACK: the relay-load workflow\'s `levels` question groups the cells\' points by their node\'s level (blob11) - the room-windows each level was awake, before the seed and after it - and its `moves` question reads the directory\'s moves made and blocked (blob12, blob13) over the points that carry them; RoomMetrics writes the two after the level (mutants: the level ungrouped; another kind read; a blob moved; an empty blob read as a number)', () => {
  const lv = loadSql('levels', 3);
  assert.match(lv, /SELECT blob1 AS kind, blob11 AS level, SUM\(_sample_interval\) AS room_windows,/);
  assert.match(lv, /AND blob1 = 'world' GROUP BY kind, level ORDER BY level LIMIT 10/);
  const mv = loadSql('moves', 3);
  assert.match(mv, /SUM\(_sample_interval \* toUInt32\(blob12\)\) AS moves, SUM\(_sample_interval \* toUInt32\(blob13\)\) AS blocked/);
  assert.match(mv, /AND blob1 = 'cells' AND blob12 != '' GROUP BY kind/);
  let p = null;
  const m = new RoomMetrics(0);
  Object.assign(m.c, { frames: 1, cellMoves: 2, cellBlocked: 3 });
  m.flush({ writeDataPoint: (x) => { p = x; } }, 'cells', 0, 'v', 1000, true);
  assert.deepEqual(p.blobs.slice(10), ['', '2', '3']);
});
