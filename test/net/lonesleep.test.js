// LONE-SLEEP (2026-10-26, the owner choosing among AUDIT RELEASE R4's levers - R4-3 lever 2, "Idle lone cells": a player
// with nobody near sends their position only on the heartbeat, so their cells can sleep; full rate the moment someone
// comes near. No visible change to players). bible/11-Multiplayer/Scale-Arc.md LONE-SLEEP; net/loneSleep.js. Pins by
// count, never by the wall clock: a lone session's poses over N simulated seconds, the wake one notice after a peer, the
// relay's readers over the lone gap, and a peer's first sight of the lone player. tools/mutants/lonesleep.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { OnlineSession, POSE_HZ, HEARTBEAT_MS, PEER_TIMEOUT_MS, PING_MS } from '../../src/net/online.js';
import { PIXEL_UNITS, WORLD_CELL, cellHaloFor, cellRoomOfWire, RELAY_VERSION, WORLD_WIDE_RELAY_MIN } from '../../src/net/wire.js';
import { LONE_POSE_MS, LONE_HOLD_MS, LONE_RELAY_MIN, LONE_FIGHT_KEYS, loneNow, aloneNow, loneSupported, fightMoved } from '../../src/net/loneSleep.js';
import { WATCH_TICK_MS, WATCH_MOVED_MS } from '../../src/net/watchReceipt.js';
import { REACT_FIRST_MS } from '../../server/src/staffFeedLaw.js';
import { fakeSocketClass } from '../fakeSocket.mjs';
import { fakeRoom } from '../fakeRoom.mjs';

const { subtle } = globalThis.crypto;
const UNITS_PER_M = PIXEL_UNITS / 819.2;
const CELL = WORLD_CELL * PIXEL_UNITS;
const quiet = (fn) => { const keep = { log: console.log, info: console.info, warn: console.warn }; console.log = console.info = console.warn = () => {}; try { return fn(); } finally { Object.assign(console, keep); } };
const isPose = (t) => t.startsWith('{"t":"pose"');

/** A real session at the corner of four cells - in (1,1), holding the three round the corner - every socket open and
 *  welcomed by a relay at `v` with nobody in its roster, and a clock; `walk(s)` moves it north at 4 m/s, a frame each
 *  1/POSE_HZ, as the world host hands its poses in. */
function loneSession({ v = RELAY_VERSION } = {}) {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { t: 1_000_000 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: FakeWS, now: () => clock.t });
  const pose = { x: CELL + 100 * UNITS_PER_M, y: 0, z: CELL + 100 * UNITS_PER_M, yaw: 0, pitch: 0, mv: 1 };
  const halos = cellHaloFor(Math.floor(pose.x / PIXEL_UNITS), Math.floor(pose.z / PIXEL_UNITS));
  const welcome = (ws) => quiet(() => { ws.open(); ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], ...(v ? { v } : {}), gm: 'measure' }); });
  quiet(() => s.join('world:1,1', { ...pose }));
  welcome(sockets[0]);
  quiet(() => s.setHalo(halos));
  for (let i = 1; i < sockets.length; i++) welcome(sockets[i]);
  for (const ws of sockets) ws.sent.length = 0;
  const poses = (ws) => ws.sent.filter(isPose).map((t) => JSON.parse(t).p);
  const walk = (seconds, extra = {}, tick = true) => { for (let f = 0; f < seconds * POSE_HZ; f++) { clock.t += 1000 / POSE_HZ; pose.z += (4 * UNITS_PER_M) / POSE_HZ; s.sendPose({ ...pose, ...extra }); if (tick) s.tick(); } };   // the session's tick too: its pings carry no pose
  return { s, sockets, clock, pose, poses, walk, halos };
}

// ── the law ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('LONE-SLEEP the interval and what bounds it: a minute - over the heartbeat, under the silence law\'s 80 s (a hidden staff spectator holds the lone player as a peer), a whole part of the Watch\'s two-minute tick and inside its five-minute moved window; the hold outlasts the reaction feed\'s first three seconds inside a wake\'s ten (mutants: another interval; another hold)', () => {
  assert.equal(LONE_POSE_MS, 60_000);
  assert.ok(LONE_POSE_MS > HEARTBEAT_MS, 'longer than the heartbeat, or nothing is saved');
  assert.ok(LONE_POSE_MS < PEER_TIMEOUT_MS, 'a peer that does hold me never hides me between two lone poses');
  assert.equal(WATCH_TICK_MS % LONE_POSE_MS, 0, 'the Watch ticks on a pose that finds its last tick two minutes old - a whole part of it keeps every tick');
  assert.ok(LONE_POSE_MS <= WATCH_MOVED_MS);
  assert.equal(LONE_HOLD_MS, 5_000);
  assert.ok(LONE_HOLD_MS >= REACT_FIRST_MS && LONE_HOLD_MS < 10_000, 'the moves the reaction feed times, inside the wake the mint made');
});

test('LONE-SLEEP the gate: a relay at the release\'s own number or later - this release\'s, whose every pose reader was read - and nothing else (mutants: the gate open; another floor)', () => {
  // PIN MOVED (LONE-SLEEP at the second merge with main): world260 on the branch is main's THE FOLD there - the gate is the
  // release's one number, WORLD_WIDE_RELAY_MIN (world269), and moves with it at a merge
  assert.equal(LONE_RELAY_MIN, WORLD_WIDE_RELAY_MIN);
  assert.equal(loneSupported(RELAY_VERSION), true, 'this branch\'s relay');
  assert.equal(loneSupported(`world${LONE_RELAY_MIN}`), true);
  assert.equal(loneSupported(`world${LONE_RELAY_MIN - 1}`), false, 'main\'s newest before the release');
  assert.equal(loneSupported('world259'), false, 'the live relay at this release\'s start');
  for (const v of [null, undefined, '', 'world', 'room260', 260]) assert.equal(loneSupported(v), false, String(v));
});

test('LONE-SLEEP alone and lone: ALONE (HIBERNATE\'s and LONE-SLEEP\'s one notion) is no referee, nobody in my room or any I hold, a world cell or a world room; LONE is alone, a relay at the gate, a presence session in a world cell with its socket open, outside the open zone and a fight\'s hold - each clause alone breaks it (mutants: each clause dropped)', () => {
  const al = { refereed: false, others: 0, peers: 0, room: 'world:1,1' };
  assert.equal(aloneNow(al), true);
  assert.equal(aloneNow({ ...al, room: 'dungeon:m123' }), true, 'a building or an ordinary dungeon: alone (HIBERNATE\'s)');
  assert.equal(aloneNow({ ...al, refereed: true }), false, 'a referee - a duel, a Wild zone fighter, a serpent');
  assert.equal(aloneNow({ ...al, others: 1 }), false, 'someone in my room');
  assert.equal(aloneNow({ ...al, peers: 1 }), false, 'a peer in a halo');
  assert.equal(aloneNow({ ...al, room: 'siege:3' }), false, 'a battle, a boss room, a channel - never');
  const ok = { alone: true, ok: true, presence: true, room: 'world:1,1', open: true, zone: false, now: 1000, holdUntil: -Infinity };
  assert.equal(loneNow(ok), true);
  assert.equal(loneNow({ ...ok, alone: false }), false, 'not alone');
  assert.equal(loneNow({ ...ok, ok: false }), false, 'an older relay');
  assert.equal(loneNow({ ...ok, presence: false }), false, 'a channel');
  assert.equal(loneNow({ ...ok, room: 'dungeon:m123' }), false, 'a world room: HIBERNATE\'s alone, never LONE-SLEEP\'s');
  assert.equal(loneNow({ ...ok, open: false }), false, 'my cell\'s socket down');
  assert.equal(loneNow({ ...ok, zone: true }), false, 'the open zone');
  assert.equal(loneNow({ ...ok, holdUntil: 1001 }), false, 'a fight');
  assert.equal(loneNow({ ...ok, holdUntil: 1000 }), true, 'the hold\'s end');
  assert.deepEqual([...LONE_FIGHT_KEYS], ['wd', 'an', 'cn', 'ar', 'hk', 'hu']);
  for (const k of LONE_FIGHT_KEYS) assert.equal(fightMoved({ x: 1 }, { x: 1, [k]: 1 }), true, k);
  assert.equal(fightMoved({ x: 1, an: 2 }, { x: 9, an: 2, mv: 1 }), false, 'a walk is no fight');
  assert.equal(fightMoved(null, { an: 1 }), false, 'no pose before: nothing moved');
});

// ── the session ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('LONE-SLEEP the count: a lone session walking N seconds says ceil(N / LONE_POSE_MS) poses down its own cell\'s socket - the first at once, each the pose of its moment - and none down a halo; standing, HIBERNATE\'s nothing at all (mutants: lone never; the interval the heartbeat; the halos still told; lone ignores the peers)', () => {
  for (const N of [60, 300, 310]) {
    const { sockets, poses, walk, pose } = loneSession();
    walk(N);
    const mine = poses(sockets[0]);
    assert.equal(mine.length, Math.ceil((N * 1000) / LONE_POSE_MS), `${N} s alone`);
    for (let i = 1; i < mine.length; i++) assert.ok(mine[i].z - mine[i - 1].z > 230 * UNITS_PER_M, 'a minute\'s walk between two - each where I stood then');
    for (const ws of sockets.slice(1)) assert.equal(poses(ws).length, 0, 'an empty halo hears nothing');
    const pings = (N * 1000) / PING_MS - Math.ceil((N * 1000) / LONE_POSE_MS) - 1;   // one each PING_MS but beside a pose
    assert.ok(sockets.every((ws) => ws.sent.filter((t) => t === '{"t":"ping"}').length >= pings), 'each socket kept alive by the ping the runtime answers asleep');
    assert.ok(Math.abs(mine.at(-1).z - pose.z) <= LONE_POSE_MS / 1000 * 4 * UNITS_PER_M, 'the last within a minute of where I stand');
  }
  // composed with HIBERNATE: alone and STANDING, nothing at all - not the lone minute's, not the heartbeat
  const { s, sockets, poses, walk, clock, pose } = loneSession();
  walk(5);
  const n = poses(sockets[0]).length;
  for (let f = 0; f < 300 * POSE_HZ; f++) { clock.t += 1000 / POSE_HZ; s.sendPose({ ...pose, mv: 0 }); s.tick(); }
  assert.equal(poses(sockets[0]).length, n + 1, 'the stop said, then nothing for five minutes standing');
  for (const ws of sockets.slice(1)) assert.equal(poses(ws).length, 0);
});

test('LONE-SLEEP mixed builds: welcomed by an older relay, or one that names no version, the session says POSE_HZ as it always has (mutants: the gate open)', () => {
  for (const v of ['world259', null]) {
    const { sockets, poses, walk } = loneSession({ v });
    walk(30);
    assert.equal(poses(sockets[0]).length, 30 * POSE_HZ, `${v}: every pose`);
  }
});

test('LONE-SLEEP the wake: a peer\'s join in a halo, in my own cell, or a stranger\'s pose - my pose at once, before the next frame - down my cell\'s socket and each halo (none has heard me for a heartbeat) - and POSE_HZ from it; the peer gone, the quiet again a minute from the last pose; never a living pose from a body lying dead (mutants: no wake; the wake for the dead)', () => {
  for (const at of [1, 0]) {
    const { s, sockets, poses, walk, pose } = loneSession();
    walk(30);
    assert.equal(poses(sockets[0]).length, 1, 'half a minute alone: one pose');
    const before = sockets.map((ws) => poses(ws).length);
    quiet(() => sockets[at].receive({ t: 'join', id: 'peer-0002', name: 'Bo', look: null, pose: { x: pose.x + 500, y: 0, z: pose.z, yaw: 0, pitch: 0, mv: 0 } }));
    sockets.forEach((ws, i) => assert.equal(poses(ws).length, before[i] + 1, `socket ${i}: told at once, the notice\'s own turn`));
    for (const ws of sockets) assert.equal(poses(ws).at(-1).z, pose.z, 'where I stand now');
    walk(1);
    assert.equal(poses(sockets[0]).length, before[0] + 1 + POSE_HZ, 'POSE_HZ from the wake');
    quiet(() => sockets[at].receive({ t: 'leave', id: 'peer-0002' }));
    assert.equal(s.peers.size, 0);
    const n = poses(sockets[0]).length;
    walk(59);
    assert.equal(poses(sockets[0]).length, n, 'alone again: quiet');
    walk(2);
    assert.equal(poses(sockets[0]).length, n + 1, 'a minute on from the last');
  }
  // dead and lone: a join stands nobody up
  {
    const { s, sockets, poses, walk } = loneSession();
    walk(10);
    assert.equal(s.sendDeath(), true);
    const n = poses(sockets[0]).length;
    quiet(() => sockets[0].receive({ t: 'join', id: 'peer-0004', name: 'Cy', look: null, pose: null }));
    assert.equal(poses(sockets[0]).length, n, 'the body lies where it fell');
  }
  // a stranger's pose through a halo stands a peer: the same wake
  const { sockets, poses, walk } = loneSession();
  walk(10);
  const n = poses(sockets[0]).length;
  quiet(() => sockets[2].receive({ t: 'pose', id: 'peer-0003', p: { x: CELL - 400, y: 0, z: CELL + 400, yaw: 0, pitch: 0, mv: 1, ts: 5 } }));
  assert.equal(poses(sockets[0]).length, n + 1, 'a stranger heard: my pose at once');
});

test('LONE-SLEEP referees: a cell\'s `rf` (a duel, a Wild zone fighter, a serpent fight) on any socket I hold, or the host\'s haloWhole, is POSE_HZ - the relay judges those poses (mutants: rf unread; haloWhole unread)', () => {
  const { s, sockets, poses, walk } = loneSession();
  walk(10);
  quiet(() => sockets[2].receive({ t: 'rf', on: 1 }));
  assert.equal(poses(sockets[0]).length, 2, 'the referee\'s word: my pose at once');
  walk(2);
  assert.equal(poses(sockets[0]).length, 2 + 2 * POSE_HZ, 'judged: every pose');
  quiet(() => sockets[2].receive({ t: 'rf', on: 0 }));
  walk(30);
  assert.equal(poses(sockets[0]).length, 2 + 2 * POSE_HZ, 'no referee: quiet');
  s.haloWhole = true;
  walk(1);
  assert.equal(poses(sockets[0]).length, 2 + 3 * POSE_HZ, 'a duel\'s bout or a serpent\'s fight: every pose');
  s.haloWhole = false;
  walk(70);
  const n = poses(sockets[0]).length;
  quiet(() => sockets[0].receive({ t: 'rf', on: 1 }));
  walk(1);
  assert.equal(poses(sockets[0]).length, n + 1 + POSE_HZ, 'my own cell\'s referee: every pose');
});

test('LONE-SLEEP the open zone: standing in it (my zone word said) is POSE_HZ at once - its referee steps every pose it hears and reads a minute\'s walk as a jump, and the cell says `rf` only at the pose after the word; out of it, quiet again (mutants: the zone unread)', () => {
  const { s, sockets, poses, walk } = loneSession();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], v: RELAY_VERSION, gm: 'measure' });   // a relay that referees the zone (wildOk)
  walk(10);
  const n = poses(sockets[0]).length;
  s.setWildZone(1);
  walk(1);
  assert.equal(poses(sockets[0]).length, n + 1 + POSE_HZ, 'the zone word with my pose ahead, then every pose');
  s.setWildZone(0);
  walk(30);
  assert.equal(poses(sockets[0]).length, n + 1 + POSE_HZ, 'out of it: quiet again (the word that I left needs no pose ahead - the relay heard me a frame ago)');
});

test('LONE-SLEEP my own cell\'s socket down: not lone - the halos carry me whole, every pose, as HALO-THIN says (mutants: the socket\'s state unread)', () => {
  const { s, sockets, poses, walk } = loneSession();
  walk(10);
  quiet(() => sockets[0].drop());
  assert.notEqual(s.status, 'open');
  walk(2, {}, false);   // inside its reconnect's wait
  for (const ws of sockets.slice(1)) assert.equal(poses(ws).length, 2 * POSE_HZ, 'every halo, every pose');
});

test('LONE-SLEEP a fight: a pose whose fight counter moved goes at once and holds POSE_HZ for LONE_HOLD_MS; a grant\'s mint asked carries my pose ahead of it and holds the same (mutants: the counters unread; no hold after a mint; the hold never ends)', () => {
  const { s, sockets, poses, walk } = loneSession();
  walk(10);
  assert.equal(poses(sockets[0]).length, 1);
  walk(0.1, { an: 1 });
  assert.equal(poses(sockets[0]).length, 2, 'the swing, said at once');
  walk(LONE_HOLD_MS / 1000, { an: 1 });
  assert.equal(poses(sockets[0]).length, 2 + (LONE_HOLD_MS / 1000) * POSE_HZ - 1, 'POSE_HZ through the hold');
  walk(50, { an: 1 });
  const n = poses(sockets[0]).length;
  assert.equal(n, 2 + (LONE_HOLD_MS / 1000) * POSE_HZ - 1, 'the hold over: quiet');
  // a mint: my pose first (the relay mints at the pixel it holds me in), then the hold
  walk(20, { an: 1 });
  sockets[0].sent.length = 0;
  assert.equal(s.sendGrant({ k: 'mint', id: 7, kind: 'enc', n: 1 }), true);
  assert.equal(sockets[0].sent.length, 2);
  assert.ok(isPose(sockets[0].sent[0]) && sockets[0].sent[1].startsWith('{"t":"grant","k":"mint"'), 'the pose ahead of the ask');
  walk(1, { an: 1 });
  assert.equal(poses(sockets[0]).length, 1 + POSE_HZ, 'the encounter\'s first seconds at POSE_HZ');
});

test('LONE-SLEEP a word carries my pose: any frame but a ping, a hello, a pose or a lease said while lone goes behind my pose when the socket last heard me elsewhere - down a halo too; once (mutants: no pose ahead; ahead every time; ahead when not lone; the clock not restarted; a ping not quiet)', () => {
  const { s, sockets, poses, walk } = loneSession();
  walk(30);
  const n = poses(sockets[0]).length;
  assert.equal(s.sendChat('anyone out here?'), true);
  const tail = sockets[0].sent.slice(-2);
  assert.ok(isPose(tail[0]) && tail[1].startsWith('{"t":"chat"'), 'my pose, then the line');
  assert.equal(JSON.parse(tail[0]).p.z, s._pose.z, 'where I stand');
  assert.equal(poses(sockets[0]).length, n + 1);
  assert.equal(s.sendChat('hello?'), true);
  assert.equal(poses(sockets[0]).length, n + 1, 'the socket heard me here already');
  const halo = sockets[1];
  halo.send('{"t":"rite","k":"look"}');
  assert.ok(isPose(halo.sent.at(-2)), 'a halo\'s word: its pose first');
  walk(45);
  assert.equal(poses(sockets[0]).length, n + 1, 'the pose ahead started the minute again - nothing at the first pose\'s minute');
  walk(20);
  assert.equal(poses(sockets[0]).length, n + 2, 'a minute from the pose ahead');
  // not lone: no pose ahead (the poses go at POSE_HZ)
  quiet(() => sockets[0].receive({ t: 'join', id: 'peer-0002', name: 'Bo', look: null, pose: null }));
  walk(0.1);
  const m = poses(sockets[0]).length;
  assert.equal(s.sendChat('hi Bo'), true);
  assert.equal(poses(sockets[0]).length, m, 'the line alone');
  walk(1);
  const h = poses(halo).length;
  halo.send('{"t":"rite","k":"look"}');
  assert.equal(poses(halo).length, h, 'a halo thinned by HALO-THIN, a word down it while someone is near: the word alone (a referee\'s word brings its own - _haloCurrent)');
});

// ── the relay ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('LONE-SLEEP the relay reads the minute: poses a minute and 600 m apart are taken whole - no drop, no strike, no close - the Watch ticks every two minutes as at a pose a second, at the pixel each pose stands in; and a peer arriving sees the lone player where it stands one answer after the join (mutants: none - the relay is unchanged; this is the reading)', async (t) => {
  let now = 1_800_000_000_000;
  t.mock.method(Date, 'now', () => now);
  const at = (px, py, dx = 100) => ({ x: px * PIXEL_UNITS + dx, y: 60, z: (499 - py) * PIXEL_UNITS + 100, yaw: 0, pitch: 0, mv: 1 });
  const p0 = at(402, 151);
  const key = cellRoomOfWire(p0.x, p0.z);
  const watched = async (gapMs, spanMs) => {
    const r = fakeRoom(key, { now: () => now });
    const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    r.env.GATE_SIGNING_KEY = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
    const ws = r.connect();
    await r.hello(ws, 'peer-0001', p0);
    for (let k = 1; k * gapMs <= spanMs; k++) { now += gapMs; await r.pose(ws, at(402, 151, 100 + ((k * gapMs) / 1000) * 10 * 40 % (PIXEL_UNITS - 200))); }
    return { r, ws, ticks: ws.sent.filter((m) => m.t === 'watch').length };
  };
  const lone = await watched(LONE_POSE_MS, 600_000);
  assert.equal(lone.ws.closed, null, 'never closed');
  assert.equal(lone.ws.meters.drops ?? 0, 0, 'never dropped');
  const busy = await watched(1000, 600_000);
  assert.equal(lone.ticks, busy.ticks, 'the Watch\'s receipts the same');
  assert.equal(lone.ticks, 5);
  // a peer arriving: the lone player's client hears the join and answers; the peer hears that answer where it stands
  const { FakeWS, sockets } = fakeSocketClass();
  let ct = 1_000_000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'peer-0007', id: 'peer-0007', secret: 'secret-of-peer-0007', WebSocketImpl: FakeWS, now: () => ct });
  const r = fakeRoom(key, { now: () => now });
  const a = r.connect();
  await r.hello(a, 'peer-0007', p0);
  quiet(() => s.join(key, { ...p0 }));
  quiet(() => { sockets[0].open(); sockets[0].receive({ t: 'welcome', id: 'peer-0007', peers: [], v: RELAY_VERSION }); });
  sockets[0].sent.length = 0;
  const here = { ...p0 };
  for (let f = 0; f < 50 * POSE_HZ; f++) { ct += 1000 / POSE_HZ; now += 1000 / POSE_HZ; here.x += (4 * UNITS_PER_M) / POSE_HZ; s.sendPose({ ...here }); }
  for (const f of sockets[0].sent.splice(0)) await r.raw(a, f);
  assert.equal(a.att.pose?.x === here.x, false, 'the relay holds me where I was 50 s ago');
  const b = r.connect();
  await r.hello(b, 'peer-0008', at(402, 151, 3000));
  const seenFirst = b.sent.find((m) => m.t === 'welcome').peers.find((p) => p.id === 'peer-0007');
  assert.notEqual(seenFirst.pose.x, here.x, 'the welcome stands me where the relay last heard me');
  const join = a.sent.find((m) => m.t === 'join' && m.id === 'peer-0008');
  assert.ok(join, 'the join, told to me');
  quiet(() => sockets[0].receive(join));
  const answer = sockets[0].sent.filter(isPose);
  assert.equal(answer.length, 1, 'answered at once');
  for (const f of sockets[0].sent.splice(0)) await r.raw(a, f);
  const seen = b.sent.filter((m) => m.t === 'pose' && m.id === 'peer-0007');
  assert.equal(seen.length, 1, 'the peer hears my answer');
  assert.equal(seen[0].p.x, here.x, 'where I stand');
});
