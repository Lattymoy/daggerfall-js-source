// RELAY-H1 (2026-09-20, Mac: "cloudflare hit its limit"): A STANDING PLAYER
// IS HEARD BY THE RUNTIME, NOT THE ROOM.
//
// Cloudflare bills a Durable Object for every second it is awake, and its
// own words are "billable duration does not accrue during hibernation" and
// "incoming requests prevent hibernation". The presence session sent a
// POSE every five seconds whether or not the player had moved - a message,
// an event, a wake - so a room with anyone in it never slept, and the free
// tier (13,000 GB-s a day, ~7 player-hours at a player's ~4 rooms) was gone
// mid-stream. The relay already lets the runtime answer `{"t":"ping"}` in
// the object's sleep (setWebSocketAutoResponse); only channel sessions
// used it. Now the socket's liveness rides that ping at PING_MS, the pose
// goes when it MOVED or every HEARTBEAT_MS (20 s) as the peers' proof of
// life, and the peer timeout is DERIVED from the heartbeat.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEARTBEAT_MS, PING_MS, KEEPALIVE_FAN_MS } from '../src/net/wire.js';
import { OnlineSession, PEER_TIMEOUT_MS, POSE_HZ } from '../src/net/online.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

function fakeSocketClass() {
  const sockets = [];
  class FakeWS {
    constructor(url) { this.url = url; this.readyState = 0; this.sent = []; this.raw = []; sockets.push(this); }
    send(s) { this.raw.push(s); this.sent.push(JSON.parse(s)); }
    close() { this.readyState = 3; this.onclose?.({ code: 1000, reason: '' }); }
    open() { this.readyState = 1; this.onopen?.(); }
    message(o) { this.onmessage?.({ data: JSON.stringify(o) }); }
  }
  return { FakeWS, sockets };
}
const pose = (x, z = 0, mv = 0) => ({ x, y: 0, z, yaw: 0, pitch: 0, mv });
// The one request the runtime answers without waking the object - read off the relay, so the client's bytes are
// held to the relay's law and not to a copy of it here.
// AUDIT RELAY-H1 F3: the strings are CAPTURED, not spelled here - a relay that registers another spelling moves
// the law this test holds the client to, instead of failing a regex that had the old spelling in it.
const AUTO_PAIR = /new WebSocketRequestResponsePair\('([^']*)', '([^']*)'\)/.exec(rd('server/src/index.js'));
const AUTO_PING = AUTO_PAIR?.[1];

test('RELAY-H1: the numbers are one family - a pose no oftener than 20 s standing, four pings to a pose, the timeout four heartbeats, and none of them a literal beside the other', () => {
  assert.ok(HEARTBEAT_MS >= 20000, `HEARTBEAT_MS is ${HEARTBEAT_MS} - under 20 s a standing player wakes the object too often to let it sleep`);
  assert.equal(PING_MS, HEARTBEAT_MS / 4, 'four pings to a pose - the on-wire cadence intermediaries were proven against, without a wake');
  assert.equal(PEER_TIMEOUT_MS, 4 * HEARTBEAT_MS, 'the silence law is four heartbeats, DERIVED');
  assert.equal(KEEPALIVE_FAN_MS, HEARTBEAT_MS / 2, 'and the relay floor still follows the heartbeat');
  assert.ok(PEER_TIMEOUT_MS <= 120000, `a half-open socket lingers as a ghost for PEER_TIMEOUT_MS - ${PEER_TIMEOUT_MS} is past two minutes`);
  assert.doesNotMatch(rd('src/net/online.js'), /export const PEER_TIMEOUT_MS = \d+\s*;/, 'PEER_TIMEOUT_MS is derived from HEARTBEAT_MS, not a number that drifts beside it');
  assert.doesNotMatch(rd('src/net/wire.js'), /export const PING_MS = \d+\s*;/, 'PING_MS is derived from HEARTBEAT_MS');
});

test('RELAY-H1: the ping the client sends is the one the relay tells the runtime to answer in its sleep - two spellings, one string', () => {
  const relay = rd('server/src/index.js');
  const m = AUTO_PAIR;
  assert.ok(m, 'the relay no longer registers the auto-response pair - every ping wakes the object');
  assert.equal(JSON.parse(m[1]).t, 'ping'); assert.equal(JSON.parse(m[2]).t, 'pong');
  assert.equal(JSON.stringify({ t: 'ping' }), m[1], 'the client\'s ping, serialised, IS the request the runtime matches byte for byte - a key added, a space, a different order, and every ping wakes the object again');
  const online = rd('src/net/online.js');
  assert.match(online, /this\._send\(\{ t: 'ping' \}\)/, 'and the client sends exactly that object');
  const halo = /h\.ws\.send\('([^']*)'\)/.exec(online);
  assert.ok(halo, 'the halo sockets are pinged');
  assert.equal(halo[1], m[1], 'the halo sockets too, as the same bytes');
  const fallback = /if \(m\.t === 'ping'\) \{ this\._send\(ws, '([^']*)'\); return; \}/.exec(relay);
  assert.ok(fallback, 'an older runtime that delivers the ping still gets a pong from the object');
  assert.equal(fallback[1], m[2], 'and it is the same pong the runtime would have sent');
});

test('RELAY-H1: a standing presence session pings at PING_MS and poses only at HEARTBEAT_MS; a move goes at once; the ping never delays the pose', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1_700_000_000_000;
  const s = new OnlineSession({ url: 'wss://relay.test/', name: 'Mac', look: { race: 'Nord', gender: 'male', faceIndex: 2, items: [] }, id: 'mac-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: FakeWS, now: () => now });
  s.join('dungeon:m187853213', pose(0));
  sockets[0].open();
  assert.equal(s.sendPose(pose(1)), true, 'the first pose goes');
  sockets[0].sent.length = 0; sockets[0].raw.length = 0;
  // stand still for exactly one minute, ticking every second, offering the same pose each frame
  const still = pose(1);
  for (let t = 0; t < 60; t++) { now += 1000; s.sendPose(still); s.tick(); }
  const poses = sockets[0].sent.filter((m) => m.t === 'pose').length;
  const pings = sockets[0].sent.filter((m) => m.t === 'ping').length;
  // a WAKE is any frame whose bytes are not the runtime's auto-response request - a ping with a key added wakes the object as surely as a pose
  const wakes = sockets[0].raw.filter((raw) => raw !== AUTO_PING).length;
  assert.equal(poses, Math.floor(60000 / HEARTBEAT_MS), `standing for a minute sends ${poses} poses - one per HEARTBEAT_MS, the peers' proof of life`);
  assert.ok(pings >= Math.floor(60000 / PING_MS) - poses - 1 && pings <= Math.floor(60000 / PING_MS), `${pings} pings in a minute - the socket stays proven at PING_MS between poses`);
  assert.equal(wakes, poses, `${wakes} frames reached the object in a minute of standing still - only the poses; a ping is answered in the object's sleep`);
  // the ping must not push the heartbeat back: the poses land on the heartbeat grid, not PING_MS late
  const at = []; let t = 0;
  sockets[0].sent.length = 0; sockets[0].raw.length = 0;
  for (t = 0; t < HEARTBEAT_MS * 2; t += 1000) { now += 1000; s.sendPose(still); s.tick(); if (sockets[0].sent.some((m) => m.t === 'pose')) { at.push(t + 1000); sockets[0].sent.length = 0; } }
  assert.deepEqual(at, [HEARTBEAT_MS, HEARTBEAT_MS * 2], 'a pose every HEARTBEAT_MS exactly, with pings in between');
  // and a MOVE is not gated by any of this
  now += 1000 / POSE_HZ + 1;
  assert.equal(s.sendPose(pose(2, 0, 1)), true, 'a moved pose goes at POSE_HZ, heartbeat or no heartbeat');
});

test('RELAY-H1: a channel session (presence: false) keeps its own ping cadence and sends no pose, as CHAT1 had it', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1_700_000_000_000;
  const s = new OnlineSession({ url: 'wss://relay.test/', name: 'Mac', id: 'mac-0002', secret: 'shh-shh-shh-0002', WebSocketImpl: FakeWS, now: () => now, presence: false });
  s.join('chat:global');
  sockets[0].open();
  sockets[0].sent.length = 0; sockets[0].raw.length = 0;
  for (let t = 0; t < 60; t++) { now += 1000; s.sendPose(pose(1)); s.tick(); }
  assert.equal(sockets[0].sent.filter((m) => m.t === 'pose').length, 0, 'a channel poses nothing');
  assert.equal(sockets[0].sent.filter((m) => m.t === 'ping').length, Math.floor(60000 / HEARTBEAT_MS), 'and pings every HEARTBEAT_MS, unchanged');
});
