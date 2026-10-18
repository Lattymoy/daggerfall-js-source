// AUDIT ONLINE 3 (2026-10-16, the user: "audita online.js") - net/online.js read by four lanes, a quarter of the file
// each, every finding driven through the real OnlineSession over the fake socket before it was believed. The seven
// worst are fixed and pinned here; the rest are recorded with the audit (bible/06-Systems/Online-Arc.md).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OnlineSession, steadyClock, steadyNow } from '../../src/net/online.js';
import { CHAT_WORLD_ROOM } from '../../src/net/wire.js';
import { fakeSocketClass } from '../fakeSocket.mjs';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const settle = () => new Promise((r) => setImmediate(r));
const session = (o = {}) => {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, ...o });
  return { s, sockets };
};
const STILL = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0 };

// ── F1: A REPEATED FIRST TIMED POSE FROZE THE PEER ───────────────────────────────────────────────────────────────

test('AUDIT ONLINE 3 F1: a stranger whose first timed pose is heard twice (the twin room\'s copy, the who\'s join) walks where it walks - the tick\'s seed is on its send-time clock, not at 0', () => {
  const walk = (twice) => {
    let t = 1_000_000;
    const { s } = session({ now: () => t });
    const p = (ts, x) => JSON.stringify({ t: 'pose', id: 'bob-0002', p: { x, y: 0, z: 0, yaw: 0, pitch: 0, mv: 1, ts } });
    const TS0 = 5_000_000;
    s._receive(p(TS0, 0), 'world:3,12');
    s.tick();
    if (twice) s._receive(p(TS0, 0), 'world:4,12');   // the same pose by the next room over
    s.tick();
    let x = 0, ts = TS0;
    for (let k = 1; k <= 60; k++) {   // 4 units every 100 ms for 6 s
      for (let f = 0; f < 6; f++) { t += 16.67; s.tick(); }
      x += 4; ts += 100;
      s._receive(p(ts, x), 'world:3,12');
    }
    for (let f = 0; f < 6; f++) { t += 16.67; s.tick(); }
    const b = s.peers.get('bob-0002');
    return { drawn: b.shown.x, first: b.path[0].c };
  };
  const once = walk(false), twice = walk(true);
  assert.equal(once.drawn, 240);
  assert.equal(twice.drawn, 240, 'it walked the 240 units it sent - it stood frozen at 0, drawn at PLAY_RATE_MAX toward a waypoint five million ms away');
  assert.ok(twice.first >= 5_000_000, 'no waypoint at the untimed 0 is left on a timed peer\'s path');
});

// ── F2: A CLOCK SET BACK SILENCED THE SESSION ───────────────────────────────────────────────────────────────────

test('AUDIT ONLINE 3 F2: steadyClock never steps back - a step back holds it, it walks on from there, a step forward passes', () => {
  let w = 1_800_000_000_000;
  const c = steadyClock(() => w);
  assert.equal(c(), w);
  w += 500; assert.equal(c(), 1_800_000_000_500);
  w -= 3_600_000; assert.equal(c(), 1_800_000_000_500, 'set back an hour: held');
  w += 100; assert.equal(c(), 1_800_000_000_600, 'and on from there at the wall\'s pace');
  w += 10_000; assert.equal(c(), 1_800_000_010_600, 'forward is time passing');
});

test('AUDIT ONLINE 3 F2: a session built with no clock reads the page\'s steady one, and on it a clock set back an hour keeps the poses, the pings and the retry going', () => {
  assert.equal(session().s._now, steadyNow, 'the default is the page\'s one clock (the wave compares its sessions\' times)');
  let w = 1_800_000_000_000;
  const { s, sockets } = session({ now: steadyClock(() => w), rand: () => 0 });
  s.join('interior:1', { ...STILL, mv: 1 });
  const ws = sockets[0]; ws.open(); ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], v: 'world200', now: w });
  const said = () => ws.sent.filter((x) => x.startsWith('{"t":"pose"') || x.startsWith('{"t":"ping"')).length;
  for (let i = 0; i < 50; i++) { w += 100; s.sendPose({ ...STILL, x: i, mv: 1 }); s.tick(); }
  const before = said();
  w -= 3_600_000;   // the player sets the clock back an hour (CLOCK_WARNING asks them to)
  for (let i = 0; i < 600; i++) { w += 100; s.sendPose({ ...STILL, x: 100 + i, mv: 1 }); s.tick(); }
  assert.ok(said() - before >= 500, `a minute of walking is still said after the step (${said() - before} frames; 0 before the fix)`);
  const ts = ws.sent.filter((x) => x.startsWith('{"t":"pose"')).slice(-3).map((x) => JSON.parse(x).p.ts);
  assert.equal(ts[2] - ts[1], 100, 'and stamped at the pace it was said, not 1 ms apart');
  ws.drop(1006);
  w -= 3_600_000;
  for (let i = 0; i < 100; i++) { w += 100; s.tick(); }
  assert.equal(sockets.length, 2, 'a drop then a step back still retries within its backoff');
});

// ── F3: THE CROSSING DROPPED THE LOOK'S WORD ───────────────────────────────────────────────────────────────────

test('AUDIT ONLINE 3 F3: a cell crossing that promotes a halo carries `lookOk` both ways - the cell left still hears my look change', async () => {
  let t = 1e6;
  const { s, sockets } = session({ now: () => t });
  s.join('world:10,10', STILL); const A = sockets[0]; await A.onopen(); A.receive({ t: 'welcome', id: 'mac-0001', peers: [], v: 'world201' });
  s.setHalo(['world:11,10']); const B = sockets[1]; await B.onopen(); B.receive({ t: 'welcome', id: 'mac-0001', peers: [], v: 'world201' });
  s.join('world:11,10', STILL);
  assert.equal(s._ws, B, 'B promoted');
  assert.equal(s._halo.get('world:10,10')?.ws, A, 'A stepped down');
  assert.equal(s._halo.get('world:10,10').lookOk, true, 'A\'s own relay\'s word went with it');
  t += 10_000;
  s.setLook({ race: 'Nord', gender: 'female', faceIndex: 2, items: [] });
  const looks = (ws) => ws.sent.filter((x) => x.startsWith('{"t":"look"')).length;
  assert.equal(looks(B), 1);
  assert.equal(looks(A), 1, 'the cell left is told too (it was never told again)');
  // and the promoted socket says for itself: a halo whose relay knows no look is not handed one when it is crossed into
  const { s: s2, sockets: k2 } = session({ now: () => t });
  s2.join('world:10,10', STILL); await k2[0].onopen(); k2[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], v: 'world201' });
  s2.setHalo(['world:11,10']); await k2[1].onopen(); k2[1].receive({ t: 'welcome', id: 'mac-0001', peers: [], v: 'world60' });
  s2.join('world:11,10', STILL);
  assert.equal(s2.lookOk, false, 'the crossed-into cell\'s own word, not the old primary\'s');
});

// ── F4: A SLOWER ROOM'S COPY RE-STOOD THE DEAD ─────────────────────────────────────────────────────────────────

test('AUDIT ONLINE 3 F4: room copies out of order - a slower room\'s living pose from before the death stands nobody, and its death copy is not a second death; a rise after it is a new life', () => {
  let t = 1000;
  const { s } = session({ now: () => t });
  const deaths = [];
  s.onPeerDeath = (peer, pose, room) => deaths.push([peer.id, room]);
  const pose = (ts, over = {}) => JSON.stringify({ t: 'pose', id: 'bob-0002', p: { x: 1, y: 0, z: 2, yaw: 0, pitch: 0, mv: 0, ts, ...over } });
  s._receive(pose(100), 'world:3,12');
  s._receive(pose(200, { dd: 1 }), 'world:3,12');
  t += 150;   // the next room over is slower
  s._receive(pose(100), 'world:4,12');
  assert.equal(s.peers.has('bob-0002'), false, 'the old living pose stands nobody on the body');
  s._receive(pose(200, { dd: 1 }), 'world:4,12');
  assert.deepEqual(deaths, [['bob-0002', 'world:3,12']], 'one death - the slower room\'s copy was a second body, cry and handover');
  t += 1000;
  s._receive(pose(5000), 'world:3,12');   // risen
  assert.equal(s.peers.has('bob-0002'), true, 'a pose sent after the death is a rise');
  s._receive(pose(5100, { dd: 1 }), 'world:3,12');
  assert.equal(deaths.length, 2, 'and the next death is a death');
  // past TS_RESYNC_MS the send-time clock orders nothing - a sender whose clock started over still rises
  s._receive(pose(6000), 'world:3,12');
  s._receive(pose(7000, { dd: 1 }), 'world:3,12');
  t += 60_000;
  s._receive(pose(50), 'world:3,12');
  assert.equal(s.peers.has('bob-0002'), true);
});

// ── F5: AN INTRODUCTION'S DEATH POSE STOOD THE DEAD ────────────────────────────────────────────────────────────

test('AUDIT ONLINE 3 F5: a welcome\'s roster or a join naming the fallen (a Wild ghost\'s held death pose) is a death - laid once, said as an introduction, never drawn standing', () => {
  const { s } = session({ now: () => 1000 });
  const deaths = [];
  s.onPeerDeath = (peer, pose, room, how) => deaths.push([peer.id, peer.name, room, how?.intro === true]);
  const dead = { x: 1, y: 0, z: 2, yaw: 0, pitch: 0, mv: 0, dd: 1, ts: 5 };
  s._receive(JSON.stringify({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'bob-0002', name: 'Bob', look: null, pose: dead }], host: null, now: Date.now(), v: 'world1' }), 'world:3,12');
  s._receive(JSON.stringify({ t: 'join', id: 'carl-0003', name: 'Carl', look: null, pose: { ...dead, ts: 9 } }), 'world:3,12');
  s.tick();
  assert.deepEqual(s.drawable().map((p) => p.id), [], 'nobody stands on a body');
  assert.deepEqual(deaths, [['bob-0002', 'Bob', 'world:3,12', true], ['carl-0003', 'Carl', 'world:3,12', true]], 'each laid, dressed from its introduction');
  s._receive(JSON.stringify({ t: 'pose', id: 'bob-0002', p: dead }), 'world:4,12');
  s._receive(JSON.stringify({ t: 'join', id: 'carl-0003', name: 'Carl', look: null, pose: { ...dead, ts: 9 } }), 'world:4,12');
  assert.equal(deaths.length, 2, 'and once: the pose frame\'s copy, a second room\'s join');
  // a living peer already standing, re-introduced dead
  s._receive(JSON.stringify({ t: 'join', id: 'dan-0004', name: 'Dan', look: null, pose: { ...STILL, ts: 1 } }), 'world:3,12');
  assert.equal(s.peers.has('dan-0004'), true);
  s._receive(JSON.stringify({ t: 'join', id: 'dan-0004', name: 'Dan', look: null, pose: { ...dead, ts: 2 } }), 'world:3,12');
  assert.equal(s.peers.has('dan-0004'), false);
  assert.equal(deaths.length, 3);
  // the host hands an introduction's word on - RemotePlayers.peerDeath lays its body without its cry (AUDIT ONLINE 3, the
  // second read: test/net/auditonline3b.test.js drives it)
  assert.match(rd('src/scenes/world.js'), /online\.onPeerDeath = \(peer, pose, room, how\) => \{\n(?:\s*\/\/[^\n]*\n)*\s*remotePlayers\?\.peerDeath\(\{ \.\.\.peer, acct: social\?\.accountOfPeer\?\.\(peer\.id\) \?\? null \}, pose, room, how\);/);
});

// ── F6: ANOTHER SOCKET'S MINT WROTE OVER THIS ONE'S TOKEN ──────────────────────────────────────────────────────

test('AUDIT ONLINE 3 F6: a halo\'s mint that ends while a siege socket awaits its pass leaves the siege\'s token its own', async () => {
  const pend = new Map();
  const { s, sockets } = session({ now: () => 1e6, rand: () => 0, mintToken: (room) => new Promise((r) => pend.set(room, r)) });
  s.join('world:2,12', STILL); s.setHalo(['world:3,12']);
  sockets[1].open();   // the halo opens: its mint is out
  let pass; s.mintSiegePass = () => new Promise((r) => { pass = r; });
  s.join('siege:5:7', STILL);
  const P = sockets.at(-1);
  P.open(); await settle();
  pend.get('siege:5:7')('TOKEN-FOR-SIEGE'); await settle();
  pend.get('world:3,12')(null); await settle();   // the dead halo's mint fails, late
  pass('PASS'); await settle();
  const hello = P.sent.map((x) => JSON.parse(x)).find((x) => x.t === 'hello');
  assert.equal(hello?.tok, 'TOKEN-FOR-SIEGE', 'the siege\'s hello carries the token minted for it');
  assert.equal(hello?.sp, 'PASS');
  // and a tokenless socket's why is its own mint's
  const { s: s2, sockets: k2 } = session({ now: () => 1e6, rand: () => 0, mintToken: Object.assign(() => Promise.resolve(null), { lastWhy: 'no-session' }) });
  s2.join('town:m1', STILL); k2[0].open(); await settle(); await settle();
  assert.equal(s2._tokenless.get(k2[0]), 'no-session');
});

// ── F7: A LEAVE KEPT THE ROOM'S COUNT AND ITS BUCKETS ──────────────────────────────────────────────────────────

test('AUDIT ONLINE 3 F7: a leave forgets the room through _forgetRoom - a superseded World tab says nobody, and a room\'s inbound buckets do not pile up a room at a time', () => {
  const { s, sockets } = session({ now: () => 1e6, presence: false });
  s.join(CHAT_WORLD_ROOM, null); sockets[0].open();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'aaaa-0001', name: 'Alpha' }], n: 600, v: 'world189' });
  assert.equal(s.roomCount, 600);
  s.supersede();
  assert.equal(s.roomCount, null, 'no "Online - 600" over an empty list');
  assert.equal(s.othersHere, 0);
  let now = 1e6;
  const { s: s2, sockets: k2 } = session({ now: () => now });
  for (let i = 0; i < 20; i++) {
    s2.join(`town:m${1000 + i}`, STILL);
    const ws = k2.at(-1); ws.open();
    ws.receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'aaaa-0001', name: 'Alpha' }], v: 'world189' });
    ws.receive({ t: 'chat', id: 'aaaa-0001', name: 'Alpha', text: 'hi', at: now });
    now += 1000;
  }
  assert.equal(s2._inChat.size, 1, 'the room I am in, alone');
});
