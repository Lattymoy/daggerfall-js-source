// SLAM13 (2026-09-16, AUDIT SLAM): THE FINAL LENS'S RELAY FINDINGS - five, each a hole a modified client or a large
// room could put a full room through, and each in law the slams before it wrote.
//
// A1 THE ACT FAN'S BORROW WAS ONE SENDER'S TO HOLD. SLAM11 let the room's act bucket borrow so a big door lands whole.
// A borrowing bucket is one a single socket can drive into debt on purpose: the largest act into a full room is four
// seconds of the room's rate, at ACT_HZ_MAX, and every other door in the room was refused while it kept it up. The
// fan is charged to the SENDER's own borrowing bucket first (ACT_SENDER_BYTES_PER_S, a sixteenth of the room's), and
// only a frame its own bucket admits is charged to the room's.
//
// A2 THE KEEPALIVE'S WHOLE FAN HAD NO FLOOR. SLAM8 fans an unmoved pose to everyone in range because the port's client
// sends one every HEARTBEAT_MS. A modified client sends them at the pose gate's ceiling, 20 a second, and each went to
// the whole room - beyond what the tier bounds a MOVER to. A keepalive is heard whole only when the sender's last
// whole fan is KEEPALIVE_FAN_MS old (`kept`, on the pass patch as `turn` is); inside the floor it is tiered.
//
// A3 THE YAW SEAM. `validPose` wraps the relay's pose into (-PI, PI]; a player facing due south drifts across the seam
// and the bare yaw difference read 2PI - a "move", so that player's keepalives were tiered, SLAM8's bug for one
// heading. `poseChanged` wraps the difference.
//
// A4 THE MEMORY PUSH BORROWED THE WHOLE FAN. The largest memory into a full room is 127 MiB queued in ONE tick, the
// object's whole memory. It is served a listener at a time now: a second of the rate plus one, the rest unseen until
// the next publish, the debt never deeper than one frame.
//
// A5 A VERSION SKEW WAS INVISIBLE FROM BOTH ENDS. The client ships by CI and the relay by hand. The welcome carries
// RELAY_VERSION now (its home is net/wire.js, so both ends read one constant), and a client built against another
// says so once on the console and the HUD line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as wire from '../src/net/wire.js';
import { poseChanged, byteGate, HEARTBEAT_MS, KEEPALIVE_FAN_MS, RELAY_VERSION, ACT_SENDER_BYTES_PER_S, ACT_ROOM_BYTES_PER_S, FOES_ROOM_BYTES_PER_S, POSE_FAN_MAX, POSE_FAR_SHARE, POSE_HZ_MAX, MAX_FRAME_BYTES, WORLD_FRAME_MAX, WHO_RETRY_MS } from '../src/net/wire.js';
import * as relay from '../server/src/relay.js';
import * as index from '../server/src/index.js';
import * as online from '../src/net/online.js';
import { OnlineSession, poseHzFor, PEER_TIMEOUT_MS } from '../src/net/online.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const at = (x, z, yaw = 0) => ({ x, y: 0, z, yaw, pitch: 0, mv: 0 });
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
const look = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };

/** A room of `n` on a HELD clock, hello'd at the room's admission rate; the clock is the test's to move. */
async function held(n, key, poseOf = (i) => at(i * 2, 0)) {
  const r = fakeRoom(key);
  const realNow = Date.now; let clock = 1_000_000_000; Date.now = () => clock;
  const ws = [];
  for (let i = 0; i < n; i++) { if (i % 7 === 6) clock += 1000; const s = r.connect(); await r.hello(s, `p${String(i).padStart(4, '0')}`, poseOf(i)); ws.push(s); }
  clock += HEARTBEAT_MS;   // RELAY-H1: past the keepalive floor by the heartbeat's own name, not a literal that was 5000 when the heartbeat was
  for (const s of ws) s.sent.length = 0;
  return { r, ws, tick: (ms) => { clock += ms; }, get clock() { return clock; }, done: () => { Date.now = realNow; } };
}

test('SLAM13: ONE HOME for the numbers both ends read - RELAY_VERSION and HEARTBEAT_MS live in wire.js, the relay and the session re-export those very values, and the floor and the share are derived, not typed (mutants: a second RELAY_VERSION in index.js; HEARTBEAT_MS re-declared in online.js; KEEPALIVE_FAN_MS 2500 -> 6000, which tiers every honest heartbeat)', () => {
  assert.equal(index.RELAY_VERSION, undefined, 'LOCALDEV1: the worker entry exports handlers alone - workerd refused a bundle whose named export was this string, so the relay could not start locally');
  assert.match(rd('server/src/index.js'), /version: RELAY_VERSION/, 'and /health still says the wire\'s version, through the import');
  assert.equal(relay.RELAY_VERSION, RELAY_VERSION, 'through relay.js too');
  assert.equal(online.HEARTBEAT_MS, HEARTBEAT_MS, 'the session\'s heartbeat is the wire\'s');
  assert.equal(relay.HEARTBEAT_MS, HEARTBEAT_MS, 'and the relay reads the same one');
  assert.equal(KEEPALIVE_FAN_MS, HEARTBEAT_MS / 2, 'the floor is half the heartbeat');
  assert.ok(KEEPALIVE_FAN_MS < HEARTBEAT_MS, 'so an honest heartbeat, jittered late or early, always clears it');
  assert.ok(KEEPALIVE_FAN_MS * 2 <= HEARTBEAT_MS && HEARTBEAT_MS * 3 <= PEER_TIMEOUT_MS, 'and a standing peer is still heard whole three times before the silence law could hide it');
  assert.equal(ACT_SENDER_BYTES_PER_S * 16, ACT_ROOM_BYTES_PER_S, 'sixteen honest senders fill the room\'s rate exactly');
  assert.ok(ACT_SENDER_BYTES_PER_S >= 64 * 1024, 'and one honest door - a few KiB to a full room - lands whole');
  assert.doesNotMatch(rd('server/src/index.js'), /export const RELAY_VERSION/, 'one declaration, in wire.js');
  assert.doesNotMatch(rd('src/net/online.js'), /export const HEARTBEAT_MS/, 'one declaration, in wire.js');
  assert.match(rd('src/net/wire.js'), /export const RELAY_VERSION = 'world\d+';/);
  // the false lines the final audit found, struck: nobody has measured where a deployed object stops
  assert.doesNotMatch(rd('src/net/wire.js'), /stops keeping up somewhere around two hundred|observed a real\s+\*\s+object carry/, 'wire.js no longer claims a measured ceiling');
  assert.doesNotMatch(rd('server/src/index.js'), /past about two hundred it cannot keep up/, 'index.js neither');
});

test('SLAM13 A3: the yaw is compared as an ANGLE - a heading that drifts across the -PI/PI seam is not a move (mutant: the bare difference, which read 2PI and tiered that player\'s every keepalive)', () => {
  const south = at(0, 0, Math.PI - 0.001), southToo = at(0, 0, -Math.PI + 0.001);
  assert.equal(poseChanged(south, southToo), false, '0.002 rad apart across the seam: unmoved');
  assert.equal(poseChanged(at(0, 0, 0.5), at(0, 0, 0.5 + Math.PI)), true, 'a half turn is a turn');
  assert.equal(poseChanged(at(0, 0, 0), at(0, 0, 0.02)), true, 'and the epsilon still bites on an ordinary heading');
  assert.equal(poseChanged(at(0, 0, 3), at(0, 0, 3 + 2 * Math.PI)), false, 'a full winding is no heading at all');
});

test('SLAM13 A3 at the relay: a standing player facing due south is heard by the WHOLE crowd, seam or no seam (mutant: the bare difference - the far tier heard one keepalive in POSE_FAR_SHARE from that player)', async () => {
  const n = POSE_FAN_MAX + 28;
  const h = await held(n, 'town:m9', (i) => at(i * 2, 0, i === 0 ? Math.PI - 0.001 : 0));
  try {
    const { r, ws } = h;
    for (let k = 0; k < POSE_FAR_SHARE; k++) { h.tick(HEARTBEAT_MS); await r.pose(ws[0], at(0, 0, k % 2 ? Math.PI - 0.001 : -Math.PI + 0.001)); }
    const each = ws.slice(1).map((s) => ofType(s, 'pose').length);
    assert.equal(Math.min(...each), POSE_FAR_SHARE, 'the farthest listener heard every heartbeat');
    assert.equal(Math.max(...each), POSE_FAR_SHARE);
  } finally { h.done(); }
});

test('SLAM13 A2: a keepalive BURST is tiered - the whole fan comes once per KEEPALIVE_FAN_MS and no more, while heartbeat-spaced keepalives are still heard whole by everyone (mutants: the floor removed, which is 20 x 199 sends a second from one standing socket; the floor at HEARTBEAT_MS, which tiers a heartbeat that arrives a hair early)', async () => {
  const n = POSE_FAN_MAX + 28;
  const h = await held(n, 'town:m9');
  try {
    const { r, ws } = h;
    const still = at(0, 0);
    for (let k = 0; k < 4; k++) await r.pose(ws[0], still);   // four identical keepalives in ONE instant - a modified client's flood
    const near = ws.slice(1, POSE_FAN_MAX + 1).map((s) => ofType(s, 'pose').length);
    const far = ws.slice(POSE_FAN_MAX + 1).map((s) => ofType(s, 'pose').length);
    assert.deepEqual([...new Set(near)], [4], 'the nearest hear every one of them, as they hear a mover');
    assert.equal(Math.min(...far), 1, 'the far tier heard the FIRST whole');
    assert.ok(Math.max(...far) < 4, 'and not the other three whole - those were tiered');
    const farTotal = far.reduce((a, b) => a + b, 0);
    assert.ok(farTotal <= far.length + Math.ceil(far.length / POSE_FAR_SHARE) * 3 + 2, `the far tier cost one share of three tiered poses, not three whole fans (${farTotal})`);
    // an honest client's next heartbeat: whole again, for everyone
    h.tick(HEARTBEAT_MS);
    await r.pose(ws[0], still);
    assert.deepEqual([...new Set(ws.slice(POSE_FAN_MAX + 1).map((s) => ofType(s, 'pose').length - far[0]).filter((_, i) => i === 0))], [1], 'the farthest listener heard the heartbeat');
    assert.equal(ws.slice(1).filter((s) => ofType(s, 'pose').length >= 2).length, n - 1, 'every listener heard the heartbeat whole');
    // and one that arrives a little early - the client's own jitter - still clears the floor
    h.tick(KEEPALIVE_FAN_MS);
    const before = ws.slice(1).map((s) => ofType(s, 'pose').length);
    await r.pose(ws[0], still);
    assert.equal(ws.slice(1).filter((s, i) => ofType(s, 'pose').length === before[i] + 1).length, n - 1, 'half a heartbeat later, whole again');
  } finally { h.done(); }
});

test('SLAM13 A2: `kept` rides the PASS patch - a keepalive the gate refused was heard by nobody and does not restart the floor (mutant: `kept` in the ordinary patch, which stamps a pose nobody was sent and tiers the next honest heartbeat)', async () => {
  const n = POSE_FAN_MAX + 28;
  const h = await held(n, 'town:m9');
  try {
    const { r, ws } = h;
    await r.pose(ws[0], at(0, 0));   // whole: kept = t0
    assert.equal(ws[ws.length - 1].sent.length, 1, 'the farthest heard it');
    h.tick(KEEPALIVE_FAN_MS);
    for (let k = 1; k <= POSE_HZ_MAX; k++) await r.pose(ws[0], at(k * 0.1, 0));   // a walk that drains the pose gate to zero
    h.tick(10);
    await r.pose(ws[0], at(POSE_HZ_MAX * 0.1, 0));   // a KEEPALIVE the gate refuses (a fifth of a token) - relayed to nobody
    const heardBefore = ws.slice(1).map((s) => ofType(s, 'pose').length);
    h.tick(50);   // one token
    await r.pose(ws[0], at(POSE_HZ_MAX * 0.1, 0));   // the honest heartbeat: the last WHOLE fan was t0, well past the floor
    assert.equal(ws.slice(1).filter((s, i) => ofType(s, 'pose').length === heardBefore[i] + 1).length, n - 1, 'heard whole by every listener - the refused one did not count as a whole fan');
    assert.equal(ws[0].att.kept, h.clock, 'and this one is the fan `kept` names');
  } finally { h.done(); }
});

test('SLAM13 A1: ONE SENDER CANNOT HOLD THE ROOM\'S ACT BUCKET IN DEBT - a flooder\'s second big act is refused by its own share and charges the room nothing, and an honest door still lands (mutants: the sender\'s bucket removed, which is SLAM11 - the honest door refused; the room charged for a frame the sender\'s bucket refused)', async () => {
  const n = 64;
  const h = await held(n, 'dungeon:m187853213', () => at(1, 1));
  try {
    const { r, ws } = h;
    const big = JSON.stringify({ t: 'act', data: { k: 'dungeon:1', l: [{ k: 'loot:3', r: [{ t: 1, pad: 'x'.repeat(15 * 1024) }] }] } });
    assert.ok(big.length < MAX_FRAME_BYTES, 'legal by the wire');
    const cost = JSON.stringify({ t: 'act', id: 'p0001', data: JSON.parse(big).data }).length * (n - 1);
    assert.ok(cost > ACT_SENDER_BYTES_PER_S && cost * 2 > ACT_ROOM_BYTES_PER_S, `the fixture is past both rates (${cost} a fan)`);
    await r.raw(ws[1], big);
    assert.equal(ofType(ws[0], 'act').length, 1, 'the first big act lands whole - a real chest cascade must');
    assert.ok(ws[1].meters.abytes.bytes < 0, 'and puts ITS OWN bucket in debt');
    const room = r.room._roomActBytes.bytes;
    assert.equal(room, ACT_ROOM_BYTES_PER_S - cost, 'the room charged once');
    await r.raw(ws[1], big);   // the flood: under SLAM11 this second frame put the ROOM in debt for the next second
    assert.equal(ofType(ws[0], 'act').length, 1, 'refused - by the sender\'s share');
    assert.equal(r.room._roomActBytes.bytes, room, 'and the room was charged NOTHING for it');
    assert.equal(ws[1].closed, null, 'no strike: a door refused is a door refused');
    const door = JSON.stringify({ t: 'act', data: { k: 'dungeon:1', a: [{ key: 'door:0', state: 'forward', t: 0, lock: 0, moveState: 'start', moveT: 0 }] } });
    await r.raw(ws[2], door);
    assert.equal(ofType(ws[0], 'act').length, 2, 'an honest door from somebody else lands at once');
    assert.equal(ofType(ws[5], 'act').length, 2, 'for everyone');
    assert.ok(ws[2].meters.abytes.bytes > 0, 'its sender\'s share barely dented');
  } finally { h.done(); }
});

test('SLAM13 A1: a frame the ROOM refuses charges the sender nothing either - an honest sender behind a flooder does not pay for a door that never opened (mutant: the sender\'s bucket charged before the room\'s verdict)', async () => {
  const h = await held(6, 'dungeon:m187853213', () => at(1, 1));
  try {
    const { r, ws } = h;
    const door = JSON.stringify({ t: 'act', data: { k: 'dungeon:1', a: [{ key: 'door:0', state: 'forward', t: 0, lock: 0, moveState: 'start', moveT: 0 }] } });
    r.room._roomActBytes = { bytes: -1, at: h.clock };   // the room in debt (a flooder's doing, under the old law)
    await r.raw(ws[2], door);
    assert.equal(ofType(ws[0], 'act').length, 0, 'refused by the room');
    assert.equal(ws[2].meters.abytes.bytes, ACT_SENDER_BYTES_PER_S, 'the sender\'s share is FULL - refilled, not charged');
    h.tick(1000);   // the room repaid
    await r.raw(ws[2], door);
    assert.equal(ofType(ws[0], 'act').length, 1, 'and the door lands the moment the room can carry it');
    assert.ok(ws[2].meters.abytes.bytes < ACT_SENDER_BYTES_PER_S && ws[2].meters.abytes.bytes > 0, 'charged once, for the one that went');
  } finally { h.done(); }
});

test('SLAM13 A4: the memory is served A LISTENER AT A TIME - the largest memory into a room queues a second of the rate plus one frame, never the whole fan, and the debt is under one frame (mutants: the whole fan as one charge, which is 127 MiB in one tick for a full room; the bucket\'s cap or rate changed)', async () => {
  const n = 20;
  const h = await held(n, 'dungeon:m187853213', () => at(1, 1));
  try {
    const { r, ws } = h;
    const memory = { big: 'x'.repeat(480 * 1024) };
    const raw = JSON.stringify({ t: 'world', data: memory });
    assert.ok(raw.length < WORLD_FRAME_MAX && raw.length > FOES_ROOM_BYTES_PER_S / 10, 'the largest memory the wire admits, near enough');
    const frame = `{"t":"world","id":"p0000","data":${JSON.stringify(memory)}}`.length;
    h.tick(20_000);
    await r.raw(ws[0], raw);
    const served = ws.slice(1).filter((s) => ofType(s, 'world').length === 1).length;
    const expect = Math.floor(FOES_ROOM_BYTES_PER_S / frame) + 1;
    assert.equal(served, expect, `a second of the rate (${Math.floor(FOES_ROOM_BYTES_PER_S / frame)}) plus one on the borrow`);
    assert.ok(served < n - 1, 'so NOT the whole room in one tick');
    assert.ok(r.room._roomWorld.bytes < 0 && r.room._roomWorld.bytes > -frame, `the debt is under ONE frame (${r.room._roomWorld.bytes})`);
    assert.equal(r.room._roomWorld.bytes, FOES_ROOM_BYTES_PER_S - frame * expect, 'the rate is FOES_ROOM_BYTES_PER_S, spent per listener');
    assert.equal(ws.slice(1).filter((s) => s.att.worldSeen === true).length, expect, 'exactly the served are latched');
    // the cap: a bucket idle for a minute holds one second's worth, not sixty
    h.tick(60_000);
    r.room._roomWorld = { bytes: -1, at: h.clock - 60_000 };
    await r.raw(ws[0], raw);
    assert.equal(ws.slice(1).filter((s) => ofType(s, 'world').length === 1).length, Math.min(n - 1, expect * 2), 'the next publish serves one more second\'s worth - the refill is capped at the rate');
    h.tick(20_000);
    await r.raw(ws[0], raw);
    assert.equal(ws.slice(1).filter((s) => ofType(s, 'world').length === 1).length, n - 1, 'and the rest on the one after');
    assert.equal(ws.slice(1).filter((s) => ofType(s, 'world').length > 1).length, 0, 'nobody twice');
  } finally { h.done(); }
});

test('SLAM13 A5: every welcome carries the relay\'s version - a place room\'s and a channel\'s (mutant: `v` dropped, which is a skew nobody can see again)', async () => {
  const h = await held(2, 'town:m9');
  try {
    const w = ofType(h.ws[1], 'welcome');   // cleared by held(); re-read the raw welcome on a fresh joiner instead
    assert.equal(w.length, 0);
    const c = h.r.connect(); h.tick(1000); await h.r.hello(c, 'cccc-0003', at(5, 5));
    assert.equal(ofType(c, 'welcome')[0].v, RELAY_VERSION, 'a town\'s welcome names the relay');
  } finally { h.done(); }
  const ch = fakeRoom(wire.CHAT_WORLD_ROOM);
  const s = ch.connect(); await ch.hello(s, 'dddd-0004');
  assert.equal(ofType(s, 'welcome')[0].v, RELAY_VERSION, 'a channel\'s too');
  assert.match(rd('server/src/index.js'), /"v":\$\{JSON\.stringify\(RELAY_VERSION\)\}/, 'built into the welcome string, not a second constant');
});

test('SKEW1 (Mac: two strings outside the chat box after a deploy): the session puts NO version-skew line on the HUD - a foreign `v` is SRV-N\'s to read (`onRelay`), and statusLine stays quiet (mutant: SLAM13 A5\'s statusLine warning restored)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'M', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => 1_000_000 });
  const heard = []; s.onRelay = (v) => heard.push(v);
  const warned = [];
  const realWarn = console.warn; console.warn = (...a) => warned.push(a.join(' '));
  const realInfo = console.info; console.info = () => {};
  try {
    s.join('town:m9', at(0, 0)); const ws = sockets[0]; ws.open();
    ws.receive({ t: 'welcome', id: 'mac-0001', v: 'world1', peers: [], host: null, world: null });
    assert.deepEqual(heard, ['world1'], 'the relay\'s name reaches SRV-N\'s presenter');
    assert.equal(s.statusLine('online'), null, 'and the HUD line says nothing about it');
    assert.equal(s.statusLine('chat'), null, 'nor the chat link\'s');
    assert.equal(warned.length, 0, 'nor the console');
    ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null });
    assert.equal(s.statusLine('online'), null, 'a welcome with no version: the same silence');
    assert.equal(s.versionWarning, undefined, 'the field is gone, not merely quiet');
  } finally { console.warn = realWarn; console.info = realInfo; }
  assert.doesNotMatch(rd('src/net/online.js'), /VERSION_WARNING|versionWarning/, 'nothing of it left in the session');
});

test('SLAM13 (final lens survivors): the asked list prunes by its own retry, poseHzFor rounds (33 peers is 7 Hz), and byteGate\'s cap is the rate (mutants: the prune removed; `round` -> `floor`; the cap dropped)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1_000_000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'M', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now });
  const realInfo = console.info; console.info = () => {};
  try {
    s.join('world:3,12', at(0, 0)); const ws = sockets[0]; ws.open();
    ws.receive({ t: 'welcome', id: 'mac-0001', v: RELAY_VERSION, peers: [], host: null, world: null });
    for (let i = 0; i < 256; i++) s._who.set(`old-${String(i).padStart(4, '0')}`, now - WHO_RETRY_MS);
    assert.equal(s._askWho('world:3,12', 'zzzz-0001', now), true, 'asked');
    assert.equal(s._who.size, 1, 'the 256 stale asks went with it - the list is bounded by its own retry');
    assert.ok(s._who.has('zzzz-0001'));
  } finally { console.info = realInfo; }
  assert.equal(poseHzFor(33), 7, '240/33 = 7.27 rounds to 7');
  assert.equal(poseHzFor(35), 7, '240/35 = 6.86 rounds to 7 - floor would say 6');
  const idle = byteGate({ bytes: 5, at: 0 }, 60_000, 1, 1000);
  assert.equal(idle.bucket.bytes, 999, 'a minute idle holds one second, not sixty');
});
