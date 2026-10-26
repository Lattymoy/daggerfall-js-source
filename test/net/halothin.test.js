// HALO-THIN (2026-10-10, the owner: "For you when you are near a player ... Theres 10 position updates every time.
// Multiply it by the times the player is near you and its an insane bottleneck"): A HALO HEARS WHERE I AM, NOT EVERY
// STEP. Every pose went down my cell's socket AND every halo's, and a listener holding the same rooms heard each pose
// once per room - two copies astride an edge, four at a corner. Everyone in range of me holds my own cell (wire.js
// cellHaloFor's symmetry), so its fan alone reaches them; a halo hears a pose when it is due (net/online.js
// haloPoseDue) - its first, a new map pixel, HALO_STEP_M moved, standing at a place it has not heard, the heartbeat -
// and every pose while my own cell's socket takes none, while it reaches a player in range who does not hold my cell,
// or while a referee may stand in a halo (the host's `haloWhole`). AUDIT PEER-RANGE + HALO-THIN: a word for a referee
// down a halo brings it my latest pose first, and a halo is pinged on its own clock. Design:
// bible/11-Multiplayer/Scale-Arc.md HALO-THIN.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { OnlineSession, haloPoseDue, HALO_STEP_M, HALO_STEP_UNITS, HEARTBEAT_MS, PING_MS, POSE_HZ, BACKOFF_MAX_MS } from '../../src/net/online.js';
import { PIXEL_UNITS, WORLD_CELL, cellHaloFor } from '../../src/net/wire.js';
import { fakeSocketClass } from '../fakeSocket.mjs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const UNITS_PER_M = PIXEL_UNITS / 819.2;
const CELL = WORLD_CELL * PIXEL_UNITS;
const quiet = (fn) => { const w = console.log; console.log = () => {}; try { return fn(); } finally { console.log = w; } };
const welcome = (ws) => quiet(() => { ws.open(); ws.receive({ t: 'welcome', id: 'mac-0001', peers: [] }); });

// ── the law ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('HALO-THIN the step: eight metres in the pose\'s own units - a cell\'s poses are MapsFile\'s frame, 40 to the metre (mutants: another step; the units dropped)', () => {
  assert.equal(HALO_STEP_M, 8);
  assert.equal(HALO_STEP_UNITS, 8 * 40);
  assert.equal(UNITS_PER_M, 40);
});

test('HALO-THIN due: a halo that heard nothing yet, the heartbeat, a stop, standing at a place it has not heard, a new map pixel either way and eight metres on the ground are due - a step, a turn, a start, a run on and a height are not (mutants: the first unheard; no heartbeat; no stop; a start counted; a standing place unread; the pixel unread on x or z; the step strict; height counted)', () => {
  const at = 5000, x = 10 * PIXEL_UNITS + 1000, z = 20 * PIXEL_UNITS + 1000;
  const last = { x, z, mv: 1, at };
  assert.equal(haloPoseDue(null, { x, z, mv: 1 }, at), true, 'its first since its welcome');
  assert.equal(haloPoseDue(undefined, { x, z, mv: 1 }, at), true);
  assert.equal(haloPoseDue(last, { x: x + 40, z, mv: 1 }, at + 100), false, 'a metre on: not due');
  assert.equal(haloPoseDue(last, { x, z, mv: 1, yaw: 3 }, at + 100), false, 'a turn: not due');
  assert.equal(haloPoseDue(last, { x, z, y: 9999, mv: 1 }, at + 100), false, 'a height: not due - the ground\'s distance');
  assert.equal(haloPoseDue(last, { x, z, mv: 1 }, at + HEARTBEAT_MS - 1), false);
  assert.equal(haloPoseDue(last, { x, z, mv: 1 }, at + HEARTBEAT_MS), true, 'the heartbeat');
  assert.equal(haloPoseDue(last, { x, z, mv: 0 }, at + 100), true, 'a stop: where I stand');
  // AUDIT B F3: standing at a place the halo has not heard - a walk under the step, then a stop
  const still = { ...last, mv: 0 };
  assert.equal(haloPoseDue(still, { x, z, mv: 0 }, at + 100), false, 'standing where it heard me: not due');
  assert.equal(haloPoseDue(still, { x, z, mv: 0, yaw: 2 }, at + 100), false, 'turning where I stand: not due');
  assert.equal(haloPoseDue(still, { x: x + 316, z, mv: 0 }, at + 3000), true, 'standing 7.9 m from where it heard me: due');
  assert.equal(haloPoseDue(still, { x, z: z - 1, mv: 0 }, at + 100), true, 'a unit north, standing: due');
  assert.equal(haloPoseDue(still, { x: x + 316, z, mv: 1 }, at + 100), false, 'a start (moving, under the step) is not due');
  assert.equal(haloPoseDue({ ...last, mv: 1 }, { x, z, mv: 2 }, at + 100), false, 'a run on from a walk is not');
  // the pixel - the range's own grain and a raid's word - even a unit across
  const edgeX = { x: 11 * PIXEL_UNITS - 1, z, mv: 1, at };
  assert.equal(haloPoseDue(edgeX, { x: 11 * PIXEL_UNITS, z, mv: 1 }, at + 100), true, 'a new pixel east');
  const edgeZ = { x, z: 21 * PIXEL_UNITS - 1, mv: 1, at };
  assert.equal(haloPoseDue(edgeZ, { x, z: 21 * PIXEL_UNITS, mv: 1 }, at + 100), true, 'a new pixel north');
  // eight metres on the ground, the edge included
  assert.equal(haloPoseDue(last, { x: x + HALO_STEP_UNITS, z, mv: 1 }, at + 100), true, 'eight metres east');
  assert.equal(haloPoseDue(last, { x, z: z - HALO_STEP_UNITS, mv: 1 }, at + 100), true, 'eight metres south');
  assert.equal(haloPoseDue(last, { x: x + HALO_STEP_UNITS - 1, z, mv: 1 }, at + 100), false, 'not quite');
  const d = HALO_STEP_UNITS / Math.SQRT2 + 1;
  assert.equal(haloPoseDue(last, { x: x + d, z: z + d, mv: 1 }, at + 100), true, 'eight metres on the diagonal');
});

// ── the session ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** A real session at the corner of four cells - in (1,1) and holding the three round the corner, every socket open and
 *  welcomed - and a clock. */
function cornerSession() {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { t: 1_000_000 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: FakeWS, now: () => clock.t });
  const start = { x: CELL + 100 * UNITS_PER_M, y: 0, z: CELL + 100 * UNITS_PER_M, yaw: 0, pitch: 0, mv: 1 };
  const halos = cellHaloFor(Math.floor(start.x / PIXEL_UNITS), Math.floor(start.z / PIXEL_UNITS));
  quiet(() => s.join('world:1,1', start));
  welcome(sockets[0]);
  quiet(() => s.setHalo(halos));
  for (let i = 1; i < sockets.length; i++) welcome(sockets[i]);
  for (const ws of sockets) ws.sent.length = 0;
  const poses = (ws) => ws.sent.filter((t) => t.startsWith('{"t":"pose"')).map((t) => JSON.parse(t).p);
  const haloWs = (room) => s._halo.get(room).ws;
  return { s, sockets, clock, start, halos, poses, haloWs, FakeWS };
}

test('HALO-THIN the session: my own cell hears every pose; each halo its first, each eight metres, the stop and the heartbeat - one copy where four went (mutants: halos every pose; the primary thinned; a halo\'s last not kept; the step unread)', () => {
  const { s, sockets, clock, start, halos, poses } = cornerSession();
  assert.equal(halos.length, 3, 'a corner holds three halos');
  assert.equal(sockets.length, 4);
  const pose = { ...start };
  // walking north at 4 m/s for ten seconds, a frame every 100 ms (the pose rate)
  for (let f = 0; f < 100; f++) { clock.t += 1000 / POSE_HZ; pose.z += 4 * UNITS_PER_M / POSE_HZ; s.sendPose({ ...pose }); }
  const mine = poses(sockets[0]);
  assert.equal(mine.length, 100, 'my own cell: every pose');
  for (const ws of sockets.slice(1)) {
    const heard = poses(ws);
    assert.equal(heard.length, 5, 'a halo: its first (0.4 m on), then one each eight metres - 8.4, 16.4, 24.4 and 32.4 of the forty walked (4 m/s for 10 s)');
    for (let i = 1; i < heard.length; i++) assert.ok(heard[i].z - heard[i - 1].z >= HALO_STEP_UNITS, 'each eight metres on from the last it heard');
    assert.deepEqual(heard[0], mine[0], 'the same pose, its send time with it');
  }
  assert.equal(s.stats.haloThinned, 3 * 95, 'and the rest counted as not due');
  // a stop is heard by every halo at once
  clock.t += 1000 / POSE_HZ;
  s.sendPose({ ...pose, mv: 0 });
  for (const ws of sockets.slice(1)) { const h = poses(ws); assert.equal(h.length, 6); assert.equal(h[5].mv, 0, 'where I stopped'); }
  // HIBERNATE: standing with nobody anywhere - my cell or a halo - sends no heartbeat
  clock.t += HEARTBEAT_MS;
  assert.equal(s.sendPose({ ...pose, mv: 0 }), false, 'alone, standing: no heartbeat');
  // standing with a peer in a halo (nobody in my own cell): the heartbeat, through every socket - the halo's player keeps me
  quiet(() => sockets[1].receive({ t: 'join', id: 'ann-0002', name: 'Ann' }));
  clock.t += HEARTBEAT_MS;
  s.sendPose({ ...pose, mv: 0 });
  for (const ws of sockets) assert.equal(poses(ws).at(-1).ts, poses(sockets[0]).at(-1).ts, 'the heartbeat, everywhere');
  assert.equal(poses(sockets[1]).length, 7);
});

test('HALO-THIN standing and turning: my own cell hears each turn, a halo the place once - the session keeps the stop it sent (AUDIT C3; mutants: the halo\'s last recorded moving)', () => {
  const { s, sockets, clock, start, poses } = cornerSession();
  for (let f = 0; f < 30; f++) { clock.t += 1000 / POSE_HZ; s.sendPose({ ...start, mv: 0, yaw: f * 0.1 }); }
  assert.equal(poses(sockets[0]).length, 30, 'every turn to my own cell');
  for (const ws of sockets.slice(1)) assert.equal(poses(ws).length, 1, 'a halo: where I stand, once');
});

test('HALO-THIN whole: while the host says a referee may stand in a halo, and while my own cell\'s socket takes nothing - dropped, its reconnect pending - every pose goes to every halo (mutants: haloWhole unread; the primary\'s refusal unread)', () => {
  const { s, sockets, clock, start, poses } = cornerSession();
  const pose = { ...start };
  s.haloWhole = true;
  for (let f = 0; f < 20; f++) { clock.t += 1000 / POSE_HZ; pose.z += UNITS_PER_M; s.sendPose({ ...pose }); }
  for (const ws of sockets) assert.equal(poses(ws).length, 20, 'a duel, a serpent\'s fight: whole');
  s.haloWhole = false;
  for (const ws of sockets) ws.sent.length = 0;
  // my own cell's socket drops (its reconnect pending): the halos carry me whole (AUDIT WORLD6b-iii(b) A5)
  quiet(() => sockets[0].drop());
  assert.notEqual(s.status, 'open');
  for (let f = 0; f < 20; f++) { clock.t += 1000 / POSE_HZ; pose.z += UNITS_PER_M; s.sendPose({ ...pose }); }
  assert.equal(poses(sockets[0]).length, 0, 'my own cell took none');
  for (const ws of sockets.slice(1)) assert.equal(poses(ws).length, 20, 'every halo, every pose');
});

test('HALO-THIN alone: a halo reaching a player in range who does not hold my cell - their socket into it still opening or refused - hears every pose, until my own cell reports them; one out of range does not count (AUDIT B F1; mutants: the halo never alone; my own room unread; the range unread)', () => {
  const { s, sockets, clock, start, halos, poses, haloWs } = cornerSession();
  const [y] = halos;
  const pose = { ...start };
  // a player in the next cell, 50 m off, heard through that halo alone (a pose on its socket), and one far across it
  const near = { x: start.x - 50 * UNITS_PER_M, y: 0, z: start.z, yaw: 0, pitch: 0, mv: 0, ts: 1 };
  const far = { x: start.x - 5 * PIXEL_UNITS, y: 0, z: start.z, yaw: 0, pitch: 0, mv: 0, ts: 1 };
  quiet(() => haloWs(y).receive({ t: 'pose', id: 'far-0001', p: far }));
  for (let f = 0; f < 10; f++) { clock.t += 1000 / POSE_HZ; pose.z += UNITS_PER_M; s.sendPose({ ...pose }); }
  assert.equal(poses(haloWs(y)).length, 2, 'one out of range alone: thinned (its first, and eight metres)');
  quiet(() => haloWs(y).receive({ t: 'pose', id: 'near-0001', p: near }));
  for (const ws of sockets) ws.sent.length = 0;
  for (let f = 0; f < 10; f++) { clock.t += 1000 / POSE_HZ; pose.z += UNITS_PER_M; s.sendPose({ ...pose }); }
  assert.equal(poses(haloWs(y)).length, 10, 'a player in range who holds only that halo: every pose to it');
  for (const r of halos.slice(1)) assert.equal(poses(haloWs(r)).length, 1, 'the other halos still thinned');
  // their socket into my cell opens: my own room reports them, and the halo is thinned again
  quiet(() => sockets[0].receive({ t: 'join', id: 'near-0001', name: 'Near', look: null, pose: near }));
  for (const ws of sockets) ws.sent.length = 0;
  for (let f = 0; f < 10; f++) { clock.t += 1000 / POSE_HZ; pose.z += UNITS_PER_M; s.sendPose({ ...pose }); }
  assert.ok(poses(haloWs(y)).length <= 2, 'heard through my own cell now: thinned');
});

test('HALO-THIN a new socket has heard nothing: AURA-LIVE\'s re-hello swaps a halo\'s socket in place, and a dropped halo reconnects with a new one - each hears the next pose, standing still; a fall goes everywhere (AUDIT C4; mutants: the last kept per room, not per socket; the fall thinned)', () => {
  const { s, sockets, clock, start, halos, poses, haloWs } = cornerSession();
  const still = { ...start, mv: 0 };
  clock.t += 100; s.sendPose({ ...still });
  clock.t += 100; s.sendPose({ ...still, yaw: 1 });
  for (const r of halos) assert.equal(poses(haloWs(r)).length, 1, 'standing still: once');
  // AURA-LIVE: the session's re-hello opens a replacement socket for every room and swaps each in place on its open
  const before = new Map(halos.map((r) => [r, haloWs(r)]));
  const n = sockets.length;
  assert.equal(s.rehello(), true);
  for (const ws of sockets.slice(n)) welcome(ws);
  for (const r of halos) assert.notEqual(haloWs(r), before.get(r), 'the halo\'s entry now holds the new socket');
  clock.t += 100; s.sendPose({ ...still, yaw: 2 });
  for (const r of halos) assert.equal(poses(haloWs(r)).length, 1, 'the swapped socket hears the next pose');
  // a halo dropped and reconnected after its backoff: a new entry, a new socket - it hears the next pose
  const room = halos[0];
  quiet(() => haloWs(room).drop());
  clock.t += BACKOFF_MAX_MS + 1;
  quiet(() => s.tick());
  welcome(haloWs(room));
  clock.t += 100; s.sendPose({ ...still, yaw: 3 });
  assert.equal(poses(haloWs(room)).length, 1, 'the reconnected socket hears the next pose');
  // a fall: every socket, as it always was (sendDeath)
  for (const ws of sockets) ws.sent.length = 0;
  assert.ok(s.sendDeath());
  assert.equal(poses(s._ws).length, 1);
  for (const r of halos) assert.equal(poses(haloWs(r)).length, 1, 'the fall in every halo');
});

test('HALO-THIN never ahead of a welcome: a halo open but not yet welcomed hears no pose (SD-HELLO; mutants: the welcome unasked)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { t: 1_000_000 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: FakeWS, now: () => clock.t });
  const start = { x: CELL + 100 * UNITS_PER_M, y: 0, z: CELL + 100 * UNITS_PER_M, yaw: 0, pitch: 0, mv: 1 };
  quiet(() => s.join('world:1,1', start));
  welcome(sockets[0]);
  quiet(() => s.setHalo(['world:0,1']));
  quiet(() => sockets[1].open());   // open, its hello said - no welcome yet
  sockets[1].sent.length = 0;
  for (let f = 0; f < 5; f++) { clock.t += 1000 / POSE_HZ; start.z += 10 * UNITS_PER_M; s.sendPose({ ...start }); }
  assert.equal(sockets[1].sent.filter((t) => t.startsWith('{"t":"pose"')).length, 0);
});

test('HALO-THIN the halos\' own keepalive: standing and turning for half a minute - my own cell busy at the pose rate, the halos not due - no halo goes PING_MS without a frame (AUDIT B F2, RELAY-H1\'s cadence; mutants: no halo ping; the ping\'s clock not kept)', () => {
  const { s, sockets, clock, start } = cornerSession();
  const at = new Map(sockets.slice(1).map((ws) => [ws, clock.t]));
  const gaps = new Map(sockets.slice(1).map((ws) => [ws, 0]));
  const count = new Map(sockets.slice(1).map((ws) => [ws, 0]));
  for (let f = 0; f < 30 * 60; f++) {
    clock.t += 1000 / 60;
    s.sendPose({ ...start, mv: 0, yaw: f * 0.01 });
    s.tick();
    for (const ws of sockets.slice(1)) {
      if (ws.sent.length !== count.get(ws)) { count.set(ws, ws.sent.length); at.set(ws, clock.t); }
      gaps.set(ws, Math.max(gaps.get(ws), clock.t - at.get(ws)));
    }
  }
  for (const ws of sockets.slice(1)) {
    assert.ok(gaps.get(ws) <= PING_MS + 20, `a halo's longest silence ${Math.round(gaps.get(ws))} ms, at most PING_MS`);
    assert.ok(ws.sent.filter((t) => t === '{"t":"ping"}').length >= 4, 'kept by its own pings');
    assert.ok(ws.sent.filter((t) => t === '{"t":"ping"}').length <= 7, 'and no more than the cadence asks');
  }
});

test('HALO-THIN a referee\'s word down a halo carries where I am: the halo hears my latest pose first when its last is not it, and nothing more when it is - a duel\'s word and a rite\'s call it before they leave (AUDIT D3; mutants: never brought; brought every time; the call sites dropped)', () => {
  const { s, sockets, clock, start, halos, poses, haloWs } = cornerSession();
  const pose = { ...start };
  clock.t += 100; s.sendPose({ ...pose });
  for (let f = 0; f < 5; f++) { clock.t += 100; pose.z += UNITS_PER_M; s.sendPose({ ...pose }); }   // five metres on: not due
  const ws = haloWs(halos[0]);
  assert.equal(poses(ws).length, 1);
  s._haloCurrent(ws);
  assert.equal(poses(ws).length, 2, 'brought up to date');
  assert.equal(poses(ws).at(-1).z, pose.z, 'where I am');
  s._haloCurrent(ws);
  assert.equal(poses(ws).length, 2, 'already current: nothing more');
  s._haloCurrent(sockets[0]);
  assert.equal(poses(sockets[0]).length, 6, 'my own cell is never brought (it hears every pose)');
  const online = read('src/net/online.js');
  assert.match(online, /if \(s\.length > DUEL_FRAME_MAX\) return false;[^\n]*\n\s*this\._haloCurrent\(ws\);[^\n]*\n\s*try \{ ws\.send\(s\); \}/, 'the duel\'s word');
  assert.match(online, /this\._haloCurrent\(ws\);[^\n]*\n\s*try \{ ws\.send\(JSON\.stringify\(\{ t: 'rite', \.\.\.w \}\)\); \}/, 'the rite\'s');
});

// ── the host ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('HALO-THIN the host: the halos whole while a duel stands (it is refereed in the room my opponent is heard through) and in a serpent\'s fight - never for the open zone, whose referee holds me by a word my own cell alone says - said before the frame\'s pose; the serpent\'s fight is this frame\'s (mutants: the duel unasked; the serpent unasked; the word after the pose; the fight never put down)', () => {
  const w = read('src/scenes/world.js');
  const line = /\n\s*online\.haloWhole = !!duelMgr\.duel \|\| _serpentFight;[^\n]*\n\s*if \(!modes\?\.caravanVisit\) caravanVisitLink\.close\(\);[^\n]*\n\s*if \(!key\) \{ if \(online\.room\) online\.leave\(\); \}/;   // above the caravan's close, which WAGONS2-VISIT holds against the join (test/systems/wagons2_visit.test.js)
  assert.match(w, line, 'the word, just before the frame\'s join or pose');
  assert.ok(w.indexOf('online.haloWhole = ') < w.indexOf('    else online.sendPose({ ...pose, ...arm, ...poseFx() });'));
  assert.match(w, /\n\s*_serpentFight = false;\n\s*if \(!serpentHost\) return;/, 'put down each frame first');
  assert.match(w, /try \{ fight = street && serpentHost\.frame\(\); \} catch \(e\) \{[^\n]*\}\n\s*_serpentFight = !!fight;/, 'then this frame\'s fight');
  const of = w.indexOf('  const onlineFrame = (now, dt) => {');
  assert.ok(of > 0 && w.indexOf('    serpentFrame();', of) < w.indexOf('online.haloWhole = ', of), 'the fight read before the word');
  // the relay's referees read the pose of the room the bout is in - the reason the word exists; the open zone's holds a
  // fighter by the zone word, and the session says it down its own cell's socket alone
  const relay = read('server/src/index.js');
  assert.match(relay, /if \(posed && this\._duelRef\?\.bouts\.size\) \{ duelPose\(this\._duelRef, a\.sub, m\.p, now\);/);
  assert.match(relay, /if \(posed && this\._trailing\(a\)\) this\._trailPose\(ws, m\.p, now\);/);
  const online = read('src/net/online.js');
  assert.match(online, /: this\._socketFor\(d\.to\);/, 'a duel frame goes down the socket the opponent is heard through');
  assert.match(online, /setWildZone\(z, dead = false\) \{[\s\S]*?if \(this\.status === 'open' && this\.wildOk && this\._ws && this\._welcomed\.has\(this\._ws\)\) \{ this\._sayZone\(this\._ws, v, !v && dead\);/, 'the zone word: my own cell\'s socket alone');   // PIN MOVED (AUDIT FOE-KEEPS E2): and left dying, the kill credit's word
});
