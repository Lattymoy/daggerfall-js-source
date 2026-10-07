// SCALE2b (2026-10-04, Mac: "I definitely want to do all these changes in full. No exceptions"): the scale arc's relay
// slice and its second half of NET-SMOOTH, in the one relay deploy SCALE's policy asks for (bible/11-Multiplayer/
// Scale-Arc.md SCALE2b). The relay: the socket index kept rather than re-walked, the hello's storage moved to memory, a
// pose's attachment written lazily, the fan selected rather than sorted, the caches bounded without thrashing, every
// call to another room under a deadline, the room's counts written to Analytics Engine. The wire: a pose's SEND TIME
// (`ts`). The client: ordered and spaced by it, and quiet where nobody hears - the foes streams, an unchanged memory,
// an idle checkpoint, the party map, the cabin lane.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { IDX_TRUST_MS, ATTACH_LAZY_MS, ROOM_CALL_MS, METRICS_WINDOW_MS, Bounded, RoomMetrics, roomKindOf, countedState } from '../server/src/relayScale.js';
import { validPose, poseTsDiff, POSE_TS_MOD, poseFan, nearestFan, hashKey, POSE_FAN_MAX, POSE_FAR_SHARE, PIXEL_UNITS, WORLD_CELL, RELAY_VERSION } from '../src/net/wire.js';
import { OnlineSession, TS_RESYNC_MS, PLAY_RATE_MAX, OFFSET_SAMPLES } from '../src/net/online.js';
import { createRealmSession, idleKeyOf, REALM_IDLE_CHECKPOINT_MS } from '../src/systems/realmSaves.js';
import { createSailingCabinLink } from '../src/net/sailingCabinLink.js';

const at = (x, z = 0, mv = 0) => ({ x: x * PIXEL_UNITS, y: 0, z: z * PIXEL_UNITS, yaw: 0, pitch: 0, mv });
const quiet = async (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return await fn(); } finally { console.info = info; console.warn = warn; } };
const withClock = async (fn) => { const real = Date.now; const clock = { t: real() }; Date.now = () => clock.t; try { return await fn(clock); } finally { Date.now = real; } };
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ─── the relay ────────────────────────────────────────────────────────────────────────────────────────────────────

test('SCALE2b index: the socket index is KEPT - a pose asks the runtime for no socket list inside IDX_TRUST_MS, a socket that comes in by the door is in it at once, and past the window one walk lets go of a socket the runtime no longer holds (mutants: the index re-walked on every call; the walk never trusted; a new socket not adopted)', () => quiet(() => withClock(async (clock) => {
  const r = fakeRoom('world:0,0');
  const a = r.connect(), b = r.connect();
  await r.hello(a, 'aaaa-0001', at(0)); await r.hello(b, 'bbbb-0002', at(0.1));
  let walks = 0;
  const list = r.state.getWebSockets;
  r.state.getWebSockets = () => { walks++; return list(); };
  for (let k = 1; k <= 10; k++) { clock.t += 50; await r.pose(a, at(0.01 * k, 0, 1)); }
  assert.equal(walks, 0, 'ten poses, no walk of the runtime\'s list - it was three a pose');
  assert.equal(b.sent.filter((m) => m.t === 'pose').length, 10, 'and every pose reached the peer');
  const c = r.connect();
  await r.hello(c, 'cccc-0003', at(0.2));
  assert.ok(b.sent.some((m) => m.t === 'join' && m.id === 'cccc-0003'), 'a socket in by the door is in the index at once - its join was said');
  assert.ok(IDX_TRUST_MS > 0 && IDX_TRUST_MS <= 1000);
  // the runtime loses a socket without a word to the object: the next walk lets it go
  r.sockets.splice(r.sockets.indexOf(c), 1);
  clock.t += IDX_TRUST_MS + 1;
  walks = 0;
  await r.pose(a, at(0.5, 0, 1));
  assert.ok(walks >= 1, 'past the window the index is walked once');
  assert.equal(r.room._all().has(c), false, 'and the socket the runtime no longer holds is gone from it');
})));

test('SCALE2b hello: the hello bucket is the instance\'s, never stored; a reconnect writes nothing it did not change - not the id\'s secret, not the look; an id\'s secret is read once a wake and kept (mutants: the bucket back in storage; the secret written every hello; the look written every hello; the secret forgotten at a wake)', () => quiet(async () => {
  const r = fakeRoom('world:0,0');
  const a = r.connect();
  await r.hello(a, 'aaaa-0001', at(0));
  assert.equal(r.store.has('hellos'), false, 'no hello bucket in storage');
  assert.ok(r.room._hellos, 'the bucket is the instance\'s');
  let writes = 0, reads = 0;
  const { put, get, list } = r.state.storage;
  r.state.storage.put = async (...x) => { writes++; return put(...x); };
  r.state.storage.get = async (...x) => { reads++; return get(...x); };
  r.state.storage.list = async (...x) => { reads++; return list(...x); };
  const a2 = r.connect();
  await r.hello(a2, 'aaaa-0001', at(0));   // a reconnect: the same id, secret and look
  assert.equal(a.closed?.code, 4000, 'the reconnect replaced the first socket');
  assert.equal(writes, 0, 'nothing written: the secret and the look are what the room already holds (it was a bucket, a secret and a look)');
  assert.equal(reads, 0, 'and nothing read: the id\'s secret was read at the first hello and kept, the parked teams too');
  // a new look is written
  const a3 = r.connect();
  await r.hello(a3, 'aaaa-0001', at(0), { look: { race: 'Nord', gender: 'female', faceIndex: 2, items: [] } });
  assert.equal(writes, 1, 'a changed look is written, once');
  // after a wake the secret still guards the id
  r.wake();
  const thief = r.connect();
  await r.hello(thief, 'aaaa-0001', at(0), { secret: 'not-the-secret-0001' });
  assert.deepEqual(thief.sent.at(-1), { t: 'error', m: 'id taken' }, 'the secret, read again after a wake, still refuses a thief');
}));

test('SCALE2b world memory: a place\'s memory is read from storage once a wake and then served from memory - a hello reads no chunk, and a publish replaces the copy (mutant: the memory read on every hello)', () => quiet(async () => {
  const r = fakeRoom('dungeon:m187');
  const host = r.connect();
  await r.hello(host, 'hhhh-0001', at(0));
  await r.world(host, { doors: [1, 2, 3] });
  let metaReads = 0;
  const { get } = r.state.storage;
  r.state.storage.get = async (k) => { if (k === 'world:meta' || (Array.isArray(k) && k.some((x) => String(x).startsWith('world:')))) metaReads++; return get(k); };
  for (let i = 0; i < 3; i++) {
    const j = r.connect();
    await r.hello(j, `jjjj-000${i}`, at(0));
    assert.deepEqual(j.sent.find((m) => m.t === 'welcome').world, { doors: [1, 2, 3] }, 'the memory rides the welcome');
  }
  assert.equal(metaReads, 0, 'three hellos, no read of the memory - it is the copy the publish stored');
  r.wake();
  const k = r.connect();
  await r.hello(k, 'kkkk-0001', at(0));
  assert.deepEqual(k.sent.find((m) => m.t === 'welcome').world, { doors: [1, 2, 3] }, 'after a wake it is read back');
}));

test('SCALE2b pose path: a moving pose updates the index and writes the socket\'s attachment at most every ATTACH_LAZY_MS; a stop is written at once, so a wake stands the player where they stopped (mutants: the attachment written every pose; a stop left lazy; the index not updated)', () => quiet(() => withClock(async (clock) => {
  const r = fakeRoom('world:0,0');
  const a = r.connect(), b = r.connect();
  await r.hello(a, 'aaaa-0001', at(0)); await r.hello(b, 'bbbb-0002', at(0.1));
  let writes = 0;
  const ser = a.serializeAttachment.bind(a);
  a.serializeAttachment = (x) => { writes++; return ser(x); };
  for (let k = 1; k <= 8; k++) { clock.t += 100; await r.pose(a, at(0.01 * k, 0, 1)); }
  assert.ok(writes <= 1, `eight poses in 0.8 s, at most one attachment write (${writes})`);
  assert.equal(r.room._attach(a).pose.x, at(0.08).x, 'the index holds the newest pose all the same - every reader reads that');
  assert.ok(ATTACH_LAZY_MS >= 1000 && ATTACH_LAZY_MS <= 5000);
  const before = writes;
  clock.t += 100; await r.pose(a, at(0.09, 0, 0));   // the stop
  assert.equal(writes, before + 1, 'the stop is written at once');
  assert.equal(a.att.pose.x, at(0.09).x, 'the runtime\'s copy holds where the player stopped');
  r.wake();
  const c = r.connect();
  await r.hello(c, 'cccc-0003', at(0.1));
  assert.equal(c.sent.find((m) => m.t === 'welcome').peers.find((p) => p.id === 'aaaa-0001').pose.x, at(0.09).x, 'a wake\'s roster stands them where they stopped');
})));

test('SCALE2b fan: the nearest POSE_FAN_MAX are SELECTED, not sorted - the near set nearest first and the far tier by hash, exactly what the sort gave, ties in list order (mutants: every tie at the bound taken; ties out of order; the far tier unhashed)', () => {
  let s = 7; const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  const reference = (list, from, poseOf, turn) => {   // the law before SCALE2b, verbatim
    const d2 = (x) => { const p = poseOf(x); if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return Infinity; return (p.x - from.x) ** 2 + (p.z - from.z) ** 2; };
    const sorted = list.map((x) => [d2(x), x]).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
    const out = sorted.slice(0, POSE_FAN_MAX);
    for (let i = POSE_FAN_MAX; i < sorted.length; i++) if (hashKey(sorted[i].id) % POSE_FAR_SHARE === (((turn % POSE_FAR_SHARE) + POSE_FAR_SHARE) % POSE_FAR_SHARE)) out.push(sorted[i]);
    return out;
  };
  for (let round = 0; round < 60; round++) {
    const n = POSE_FAN_MAX + 1 + Math.floor(rnd() * 200);
    const list = Array.from({ length: n }, (_, i) => ({ id: `p${round}-${i}`, p: rnd() < 0.05 ? null : { x: Math.floor(rnd() * 20), z: Math.floor(rnd() * 20) } }));   // a coarse grid: many ties
    const from = { x: Math.floor(rnd() * 20), z: Math.floor(rnd() * 20) };
    const turn = Math.floor(rnd() * 9) - 2;
    const got = poseFan(list, from, (x) => x.p, turn).map((x) => x.id);
    const want = reference(list, from, (x) => x.p, turn).map((x) => x.id);
    assert.deepEqual(got.slice(0, POSE_FAN_MAX), want.slice(0, POSE_FAN_MAX), `round ${round}: the same near set, in the same order`);
    assert.deepEqual([...got.slice(POSE_FAN_MAX)].sort(), [...want.slice(POSE_FAN_MAX)].sort(), `round ${round}: the same far listeners`);
    assert.deepEqual(nearestFan(list, from, (x) => x.p).map((x) => x.id), want.slice(0, POSE_FAN_MAX), `round ${round}: the welcome's door agrees`);
  }
});

test('SCALE2b caches: a Bounded map lets its OLDEST go past the bound and never clears whole; setting a key again moves it to the back; the hub\'s records, cooldowns and parties are Bounded (mutants: the thrash back; a set that does not refresh)', () => {
  const m = new Bounded(3);
  m.set('a', 1); m.set('b', 2); m.set('c', 3); m.set('a', 4); m.set('d', 5);
  assert.deepEqual([...m.keys()], ['c', 'a', 'd'], 'b, the oldest, went - a, set again, was at the back');
  for (let i = 0; i < 100; i++) m.set(`k${i}`, i);
  assert.equal(m.size, 3, 'never past the bound');
  assert.deepEqual([...m.keys()], ['k97', 'k98', 'k99'], 'and never cleared whole: the newest stay');
  const r = fakeRoom('chat:social');
  for (const f of ['_recs', '_cool', '_parties', '_raids', '_asecrets']) assert.ok(r.room[f] instanceof Bounded, `${f} is bounded`);
  const index = src('server/src/index.js');
  assert.doesNotMatch(index, /this\._recs\.clear\(\)|this\._cool\.clear\(\)|this\._raids\.clear\(\)|this\._raidSavedAt\.clear\(\)/, 'no cache clears itself whole');
});

test('SCALE2b deadlines: every call from one room to another carries one - the park registry and its drop, an arena post, a gate\'s kill, a raid\'s cleanse and its day (mutant: a call without its signal)', () => {
  const index = src('server/src/index.js');
  const calls = [...index.matchAll(/\.fetch\(new Request\(`https:\/\/relay\.internal[^\n]*/g)].map((m) => m[0]);
  assert.equal(calls.length, 13, 'the thirteen calls between rooms (SERPENT1\'s tell of a sea serpent\'s kill to the hub joined them at its merge - PIN MOVED; SD3\'s three after it - the Worker\'s and a realm\'s ask of the hub\'s record, the census of the region channels and a cell\'s tell of a find - PIN MOVED; SD8b\'s realm\'s tell of the Brass Remnant\'s fall - PIN MOVED)');
  for (const c of calls) assert.match(c, /signal: AbortSignal\.timeout\(/, `a deadline on ${c.slice(0, 80)}`);
  assert.equal(calls.filter((c) => c.includes('AbortSignal.timeout(ROOM_CALL_MS)')).length, 9, 'nine on ROOM_CALL_MS (the rite\'s two had their own, and SD3\'s tell of a find its own retry, as the rite\'s - and SD8b\'s tell of the Remnant\'s fall the same retry) - PIN MOVED with the serpent\'s, and with SD3\'s ask and census');
  assert.ok(ROOM_CALL_MS >= 1000 && ROOM_CALL_MS <= 10000);
});

test('SCALE2b metrics: a room writes ONE point a window - its kind and the relay\'s version beside counts, never a player - flushed at a drain; no binding is no metric and a throwing one costs nothing (mutants: a point a frame; an id in a point; the drain not flushed; a throwing sink thrown)', () => quiet(async () => {
  const points = [];
  const r = fakeRoom('world:3,4');
  r.room.env.METRICS = { writeDataPoint: (p) => points.push(p) };
  const a = r.connect(), b = r.connect();
  await r.hello(a, 'aaaa-0001', at(3, 4)); await r.hello(b, 'bbbb-0002', at(3, 4));
  for (let k = 1; k <= 5; k++) await r.pose(a, at(3 + 0.01 * k, 4, 1));
  assert.equal(points.length, 0, 'nothing written inside the window');
  await r.drop(a); await r.drop(b);
  assert.equal(points.length, 1, 'the drain writes the window\'s one point');
  const p = points[0];
  assert.deepEqual(p.indexes, ['world']); assert.deepEqual(p.blobs, ['world', RELAY_VERSION]);
  assert.equal(p.doubles.length, 12);
  const [, sockets, hellos, busy, frames, bytesIn, poses, sends, bytesOut, reads, writes, refusals] = p.doubles;
  assert.equal(hellos, 2); assert.equal(busy, 0); assert.equal(poses, 5); assert.equal(refusals, 0);
  assert.equal(frames, 7, 'two hellos and five poses');
  assert.ok(bytesIn > 0 && sends >= 5 && bytesOut > 0 && reads >= 1 && writes >= 1, 'counted: the bytes, the sends, the storage');
  assert.ok(sockets <= 1);
  assert.doesNotMatch(JSON.stringify(p), /aaaa|bbbb|acct-|secret/, 'nothing that names a player');
  assert.equal(METRICS_WINDOW_MS, 5 * 60 * 1000);
  // the law, alone
  const m = new RoomMetrics(0);
  m.c.frames = 3;
  assert.equal(m.flush({ writeDataPoint() { throw new Error('down'); } }, 'world', 1, 'w', 1, true), true, 'a throwing sink is swallowed');
  m.c.frames = 3;
  assert.equal(m.flush(undefined, 'world', 1, 'w', METRICS_WINDOW_MS + 2), false, 'no binding, no metric - and no throw');
  assert.equal(m.flush({ writeDataPoint: () => assert.fail('an empty window writes nothing') }, 'world', 0, 'w', 10 * METRICS_WINDOW_MS), false);
  assert.equal(roomKindOf('dungeon:m187'), 'dungeon'); assert.equal(roomKindOf('owned:abc.def:1.2'), 'owned'); assert.equal(roomKindOf(null), 'none');
  const counts = new RoomMetrics();
  const st = countedState({ storage: { get: async () => 1, put: async () => {}, list: async () => new Map() }, getWebSockets() { return [this]; } }, counts);
  await st.storage.get('x'); await st.storage.list({}); await st.storage.put('x', 1);
  assert.deepEqual([counts.c.reads, counts.c.writes], [2, 1], 'the storage counted');
  assert.equal(st.getWebSockets().length, 1, 'and the state\'s own methods bound to it');
  assert.match(src('server/wrangler.toml'), /\[\[analytics_engine_datasets\]\]\s*\nbinding = "METRICS"\s*\ndataset = "daggerfall_relay"/, 'the relay binds its dataset');
  assert.doesNotMatch(src('server/src/index.js'), /^export (const|class|function) (?!Room\b)/m, 'the entrypoint exports Room alone - a module Worker reads every named export of it as an entrypoint');
}));

// ─── the wire ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('SCALE2b wire: a pose\'s send time `ts` is an integer inside POSE_TS_MOD or nothing - never clamped - and poseTsDiff orders two across the wrap; the relay fans it and its welcome says the stored one (mutants: ts clamped; ts dropped by the door; the wrap misread)', () => quiet(async () => {
  const base = { x: 1, y: 0, z: 0, yaw: 0, pitch: 0 };
  assert.equal(validPose({ ...base, ts: 1234 }).ts, 1234);
  for (const bad of [-1, 1.5, POSE_TS_MOD, 'x', null, Infinity]) assert.equal('ts' in validPose({ ...base, ts: bad }), false, `${bad}: dropped, not clamped`);
  assert.equal('ts' in validPose(base), false, 'absent stays absent - an older client\'s pose keeps its bytes');
  assert.equal(poseTsDiff(5, 3), 2); assert.equal(poseTsDiff(1, POSE_TS_MOD - 1), 2, 'across the wrap, newer');
  assert.equal(poseTsDiff(POSE_TS_MOD - 1, 1), -2); assert.equal(poseTsDiff(7, 7), 0);
  const r = fakeRoom('world:0,0');
  const a = r.connect(), b = r.connect();
  await r.hello(a, 'aaaa-0001', { ...at(0), ts: 100 }); await r.hello(b, 'bbbb-0002', at(0.1));
  await r.pose(a, { ...at(0.01, 0, 1), ts: 200 });
  assert.equal(b.sent.filter((m) => m.t === 'pose').at(-1).p.ts, 200, 'fanned with its send time');
  const c = r.connect(); await r.hello(c, 'cccc-0003', at(0.1));
  assert.equal(c.sent.find((m) => m.t === 'welcome').peers.find((p) => p.id === 'aaaa-0001').pose.ts, 200, 'the roster says the stored pose\'s');
}));

// ─── the client: timed poses ──────────────────────────────────────────────────────────────────────────────────────

function edge() {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { now: 1_700_000_000_000 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => clock.now });
  const cellX = 25, cellZ = 15, U = PIXEL_UNITS;
  const me = { x: (cellX * WORLD_CELL + WORLD_CELL - 1) * U + U / 2, y: 0, z: (cellZ * WORLD_CELL + 8) * U, yaw: 0, pitch: 0, mv: 0 };
  s.join(`world:${cellX},${cellZ}`, me); sockets[0].open();
  s.setHalo([`world:${cellX + 1},${cellZ}`]);
  const halo = sockets.find((w) => w.url.endsWith(`world:${cellX + 1},${cellZ}`)); halo.open();
  const atx = (dx, ts, mv = 1) => ({ ...me, x: me.x - 1600 + dx, mv, ts: ts % POSE_TS_MOD });
  for (const w of [sockets[0], halo]) w.receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'eve-0003', name: 'Eve', look: null, pose: atx(0, 0, 0) }], host: null, world: null });
  return { s, cell: sockets[0], halo, clock, atx, sockets, eve: () => s.peers.get('eve-0003') };
}
const framesOf = (ws) => ws.sent.map((f) => (typeof f === 'string' ? JSON.parse(f) : f));

test('SCALE2b client: a pose goes out stamped with its send time - the same on every room\'s copy, never less than one past the last, nothing stamped with nowhere to say it, and the hello\'s pose stamped too (mutants: a copy per room stamped apart; the stamp not monotonic; a stamp spent on a closed socket)', () => quiet(() => {
  const env = edge();
  env.s.sendPose({ x: 1, y: 0, z: 0, yaw: 0, pitch: 0, mv: 1 });
  const fromCell = framesOf(env.cell).filter((f) => f.t === 'pose').at(-1), fromHalo = framesOf(env.halo).filter((f) => f.t === 'pose').at(-1);
  const lead = poseTsDiff(fromCell.p.ts, env.clock.now % POSE_TS_MOD);
  assert.ok(lead >= 0 && lead <= 2, `the wall clock - a millisecond on for each stamp already spent in this one (the two hellos): ${lead}`);
  assert.equal(fromHalo.p.ts, fromCell.p.ts, 'one send time on every room\'s copy - what lets a listener order them');
  env.clock.now += 100;
  env.s.sendPose({ x: 2, y: 0, z: 0, yaw: 0, pitch: 0, mv: 1 });
  assert.ok(poseTsDiff(framesOf(env.cell).filter((f) => f.t === 'pose').at(-1).p.ts, fromCell.p.ts) > 0);
  assert.equal(env.s._stampTs() > 0 && env.s._stampTs() % POSE_TS_MOD > 0, true);
  const t1 = env.s._tsLast, t2 = (env.s._stampTs(), env.s._tsLast);
  assert.equal(t2, t1 + 1, 'two in one millisecond still order');
  const hello = framesOf(env.sockets[0]).find((f) => f.t === 'hello');
  assert.ok(Number.isInteger(hello.pose.ts), 'the hello\'s pose is a pose said then');
  // closed: nothing stamped
  const { FakeWS } = fakeSocketClass();
  const lone = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0009', secret: 'secret-of-mac-0009', WebSocketImpl: FakeWS, now: () => 5 });
  lone.join('world:1,1', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0 });
  assert.equal(lone.sendPose({ x: 1, y: 0, z: 0, yaw: 0, pitch: 0, mv: 1 }), false);
  assert.equal(lone._tsLast, undefined, 'no stamp spent where nothing went');
}));

test('SCALE2b client: a TIMED peer is ordered by send time from ANY room - the newest moves it whichever room brings it first, an older or repeated copy moves nothing, an introduction with an older time is older, and a sender\'s clock set back is followed after TS_RESYNC_MS (mutants: copies ordered by room; an older copy eased toward; no resync)', () => quiet(() => {
  const env = edge();
  const T = 1_000_000;
  env.cell.receive({ t: 'pose', id: 'eve-0003', p: env.atx(10, T + 100) });
  assert.equal(env.eve().pose.x, env.atx(10, 0).x);
  env.clock.now += 20; env.halo.receive({ t: 'pose', id: 'eve-0003', p: env.atx(20, T + 200) });
  assert.equal(env.eve().pose.x, env.atx(20, 0).x, 'the halo brought the newer pose first: it moves her, whoever spoke last');
  env.clock.now += 20; env.cell.receive({ t: 'pose', id: 'eve-0003', p: env.atx(20, T + 200) });
  env.clock.now += 20; env.cell.receive({ t: 'pose', id: 'eve-0003', p: env.atx(15, T + 150) });
  assert.equal(env.eve().pose.x, env.atx(20, 0).x, 'the repeat and the older copy move nothing');
  env.halo.receive({ t: 'join', id: 'eve-0003', name: 'Eve', look: null, pose: env.atx(0, T + 50) });
  assert.equal(env.eve().pose.x, env.atx(20, 0).x, 'a join\'s hello pose is simply older');
  env.cell.receive({ t: 'join', id: 'eve-0003', name: 'Eve', look: null, pose: env.atx(30, T + 300) });
  assert.equal(env.eve().pose.x, env.atx(30, 0).x, 'an introduction with a newer time is the newest word');
  // the sender's clock goes back (a clock set right, a reload on a machine whose clock is behind)
  env.clock.now += 100; env.cell.receive({ t: 'pose', id: 'eve-0003', p: env.atx(31, T - 5000) });
  assert.equal(env.eve().pose.x, env.atx(30, 0).x, 'older: nothing, at first');
  env.clock.now += TS_RESYNC_MS + 1; env.cell.receive({ t: 'pose', id: 'eve-0003', p: env.atx(32, T - 4000) });
  assert.equal(env.eve().pose.x, env.atx(32, 0).x, 'past TS_RESYNC_MS with nothing newer, its stream is followed from there');
}));

test('SCALE2b client: a timed peer is played at the pace it was SAID - a line jittering 0-60 ms walks at its own speed with no step back and no frame standing, a stall\'s backlog at most PLAY_RATE_MAX, and a peer setting off after standing still is not walked over the standing (mutants: spaced by arrival; the delay off the slowest arrival; the standing walked)', () => quiet(() => {
  const env = edge();
  let x = 0, k = 0;
  const q = [];
  const drawn = [];
  const run = (ms, each) => {
    for (let t = 10; t <= ms; t += 10) {
      env.clock.now += 10;
      each(t);
      q.sort((a, b) => a.at - b.at);
      while (q.length && q[0].at <= env.clock.now) { const f = q.shift(); f.w.receive(f.frame); }
      env.s.tick();
      drawn.push(env.eve().shown.x);
    }
  };
  let tail = 0;
  const sendAt = (t, dx, delay, mv = 1) => { const at = Math.max(env.clock.now + delay, tail); tail = at; q.push({ at, w: env.cell, frame: { t: 'pose', id: 'eve-0003', p: env.atx(dx, 5_000_000 + t, mv) } }); };
  run(4000, (t) => { if (t % 100) return; x += 20; k++; sendAt(t, x, 40 + Math.round((((k * 2654435761) >>> 0) / 4294967296) * 6) * 10); });
  const v = drawn.slice(1).map((d, i) => (d - drawn[i]) / 10).slice(150);
  assert.equal(v.filter((s) => s < -1e-9).length, 0, 'no step back');
  assert.equal(v.filter((s) => s < 1e-9).length, 0, 'no frame standing');
  assert.ok(Math.max(...v) <= PLAY_RATE_MAX * 0.2 + 1e-9, `never past twice her pace (${(Math.max(...v) / 0.2).toFixed(2)}x)`);
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  assert.ok(Math.abs(mean / 0.2 - 1) < 0.05, `at her own pace on the whole (${(mean / 0.2).toFixed(3)}x)`);
  assert.ok(env.eve().offs.length === OFFSET_SAMPLES, 'the delay read off the last OFFSET_SAMPLES arrivals');
  // she stands three seconds (her last pose a still one), then sets off: the first step is a step, not three seconds of crawl
  const stood = env.eve().shown.x;
  run(3000, () => {});
  env.clock.now += 10; env.cell.receive({ t: 'pose', id: 'eve-0003', p: env.atx(x, 5_000_000 + 4000 + 3000, 0) });   // the still pose, said late
  run(10, () => {});
  const t0 = 5_000_000 + 4000 + 3000 + 2000;
  x += 20;
  env.clock.now += 2000; env.cell.receive({ t: 'pose', id: 'eve-0003', p: env.atx(x, t0) });
  const from = env.eve().shown.x;
  run(400, () => {});
  assert.ok(env.eve().shown.x - from >= 19, `the step is walked within a few frames of an interval, not over the two seconds she stood (${(env.eve().shown.x - from).toFixed(1)} of 20)`);
  assert.ok(stood <= from);
}));

// ─── the client: rooms that sleep ─────────────────────────────────────────────────────────────────────────────────

test('SCALE2b idle: the foes streams say nothing to a room with nobody else in it and owe their next frame FULL; an unchanged memory is not published again inside WORLD_REPUBLISH_MS; the party map goes only with a mate online (mutants: the gate gone; the frame owed a delta; the memory every fifteen seconds)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /const foesStream = \(now\) => \{[\s\S]{0,1600}?if \(online\.othersHere === 0\) \{ _foesFullAt = -Infinity; return false; \}/, 'the foes stream: alone, quiet, its next frame full');
  assert.match(w, /const ownStream = \(now\) => \{[\s\S]{0,600}?if \(online\.othersHere === 0\) \{ _ownFullAt = -Infinity; return false; \}/, 'the own lane too');
  assert.match(w, /if \(!force && said === _worldSaid && key === _worldSaidKey && now - _worldSaidAt < WORLD_REPUBLISH_MS\) return false;/, 'an unchanged memory, the same room and welcome and host: not said again');
  assert.match(w, /else \{ _worldSaid = said; _worldSaidAt = now; _worldSaidKey = key; \}/, 'remembered only when it went');
  assert.match(w, /partied: !!social\?\.party\?\.members\?\.some\(\(m\) => m\.online && m\.acct !== social\.acct\)/, 'the party map: a mate online');
});

test('SCALE2b idle: the periodic checkpoint of a save that says nothing new - the landed one but for its clock and its look - is answered without a put, inside REALM_IDLE_CHECKPOINT_MS; any other checkpoint, a changed save, a hidden page or a stale one goes (mutants: every checkpoint skipped; the clock counted as news; the window unbounded; a hidden page skipped)', async () => {
  let puts = 0, seq = 1;
  const io = { base: 'https://acct.test', secret: 's', storage: null, player: 'p', fetch: async () => { puts++; seq++; return new Response(JSON.stringify({ ok: true, seq }), { status: 200, headers: { 'content-type': 'application/json' } }); } };
  let now = 0, hide = false;
  const session = createRealmSession({ io, id: 'c1', lease: 'L', seq: 1, later: () => () => {}, hidden: () => hide, watchHidden: () => {}, now: () => now });
  const save = (minutes, yaw, gold = 5) => JSON.stringify({ v: 1, classicMinutes: minutes, worldMinutes: minutes * 2, pose: { yaw, pitch: 0.1, camera: { d: 1 }, crouching: false }, goldPieces: gold });
  assert.equal((await session.checkpoint(save(1, 0))).ok, true); assert.equal(puts, 1);
  now += 120_000;
  const r = await session.idle(() => session.checkpoint(save(3, 1.5)));
  assert.deepEqual([r.ok, r.idle, puts], [true, true, 1], 'the clock and the look moved, nothing else: answered, no put');
  now += 120_000;
  await session.checkpoint(save(5, 2));
  assert.equal(puts, 2, 'a checkpoint asked for anything else (an act\'s, an exit\'s) always goes');
  now += 120_000;
  await session.idle(() => session.checkpoint(save(7, 2, 6)));
  assert.equal(puts, 3, 'a changed save goes');
  now += 120_000; hide = true;
  await session.idle(() => session.checkpoint(save(9, 2, 6)));
  assert.equal(puts, 4, 'never on a page going away'); hide = false;
  now += REALM_IDLE_CHECKPOINT_MS;
  await session.idle(() => session.checkpoint(save(11, 2, 6)));
  assert.equal(puts, 5, 'and at least every REALM_IDLE_CHECKPOINT_MS');
  assert.equal(idleKeyOf(save(1, 0)), idleKeyOf(save(99, 3)), 'the clock and the look set aside');
  assert.notEqual(idleKeyOf(save(1, 0, 5)), idleKeyOf(save(1, 0, 6)));
  assert.equal(idleKeyOf('not json'), null);
  assert.notEqual(idleKeyOf(save(1, 0), { level: 1 }), idleKeyOf(save(1, 0), { level: 2 }), 'the summary is part of what a save says');
});

test('SCALE2b idle: the cabin lane holds its boat\'s full record back while nobody is in that cell, and says it at once when somebody is (mutant: the record every second to nobody)', () => {
  const sent = [];
  let others = 0;
  class Session {
    constructor() { this.room = null; this.status = 'open'; this.welcomes = 1; }
    get othersHere() { return others; }
    join(room) { this.room = room; } sendPose() {} setHalo() {} haloRooms() { return []; } tick() {} drawable() { return []; } leave() {} inRoom() { return false; }
    sendFoes(f) { sent.push(f); return true; }
  }
  const lane = createSailingCabinLink({ frame: () => ({ b: [1] }), receive() {}, sweep() {}, Session });
  const main = { room: 'interior:x', inRoom: () => false, terminal: false, url: 'wss://r', id: 'i', secret: 's', name: 'n', look: null };
  const cabin = { origin: [0, 0, 0], yaw: 0 };
  for (let t = 0; t < 5000; t += 100) lane.tick(main, cabin, { x: 10, y: 10 }, t);
  assert.equal(sent.length, 0, 'nobody in the cell: nothing said');
  others = 1;
  lane.tick(main, cabin, { x: 10, y: 10 }, 5000);
  assert.equal(sent.length, 1, 'somebody came: said at once');
});
