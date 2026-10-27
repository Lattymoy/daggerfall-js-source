// RPT1026-SECNET, the relay and the session (bible/11-Multiplayer/Instances.md, Chat-Safety-Arc.md section 2):
// - ACT WAITS (from a private report, 2026-10-20): a door's act queued while the socket was away went out the frame the
//   socket opened, ahead of its welcome; a party member's hello at an instance is held while the hub is asked, the room read the act
//   first - refused by the relay's parseClient - and closed the socket for good. Driven through the REAL Room
//   (test/fakeRoom.mjs, real tokens) and the REAL session, the hub held as a stale membership holds it.
// - LINE-STALL (from a private report, 2026-10-20, a player on a poor line): a stalled TCP line keeps every pose it is
//   given and delivers them in one burst when it clears; the relay's meter read ~22 s of a walk as a flood (the relay's
//   "too many poses", DROP_STRIKES_MAX in a row) and closed the socket for good. The session now hears its line (a
//   ping's answer) and hands a stalled one no burst - the latest pose waits, a heartbeat's worth meanwhile. Driven
//   through the real Room, the runtime's own ping answer in front of it, the line held 29 s and let go at once.
// - and the sends ACT WAITS left skipping the welcome (Online-Arc's latent list): a bout's room (sendDuel), the open
//   zone's room words (sendWild) and a cell's blow by a kept roster (sendHit), across a reconnect.
// - BLOCK STAMP (from a private report, 2026-10-20), the session's half: a request that names no account (a relay before
//   the stamp) is heard only while nobody is blocked - a place room's roster names no account to stand in for it (AUDIT
//   RPT1026 A2, test/net/audit_rpt1026_secnet.test.js). The relay's half is CLIENT-7's (safe_client.test.js), on the
//   relay's own frames.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRoom } from '../fakeRoom.mjs';
import { fakeSocketClass } from '../fakeSocket.mjs';
import { OnlineSession, POSE_HZ, LINE_STALL_MS } from '../../src/net/online.js';
import { instanceOwnerOf, instanceRoomOf } from '../../src/net/instanceRoom.js';
import { CLOSE_POLICY, PIXEL_UNITS, PING_MS, HEARTBEAT_MS, POSE_HZ_MAX, FOES_HZ_MAX, DROP_STRIKES_MAX, RELAY_VERSION, WORLD_CELL, cellHaloFor } from '../../src/net/wire.js';
import { createChatSafetyHost } from '../../src/scenes/chatSafetyHost.js';
import { SESSION_KEY, SERVICE_KEY } from '../../src/net/accountClient.js';

const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
/** Waits on the machine's own clock (performance.now), so a pin that holds Date.now still at its own time can wait too. */
const until = async (ready, label) => {
  const deadline = performance.now() + 30_000;
  while (!ready()) {
    assert.ok(performance.now() < deadline, `${label}: timed out`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};
const POSE = { x: 10 * PIXEL_UNITS, y: 0, z: 10 * PIXEL_UNITS, yaw: 0, pitch: 0, mv: 0 };
const DOOR = { k: 'dungeon:1', a: [{ key: 'act:1:2', state: 'forward', t: 1 }] };

/** A party member's session joining the owner's instance through the real Room, the hub's word on the party HELD until
 *  `release()` (its membership cache stale, as it is after a while away or a deploy). The bridge hands the Room every
 *  frame as it arrives, unawaited - a Durable Object takes the next frame while a hello waits on another object. */
async function memberAtInstance() {
  let release;
  const held = new Promise((r) => { release = r; });
  let asked = 0;
  const ROOMS = { idFromName: (n) => n, get: () => ({ fetch: async () => { asked++; await held; return new Response(JSON.stringify({ kin: true })); } }) };
  const key = instanceRoomOf('dungeon:m187853213', { owner: await instanceOwnerOf('acct-lead-0001'), epoch: '89abcdef' });
  const r = fakeRoom(key, { ROOMS });
  await r.signer();
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'mate-0002', id: 'mate-0002', secret: 'secret-of-mate-0002', WebSocketImpl: FakeWS, now: () => Date.now(), mintToken: () => r.token('mate-0002') });
  quiet(() => s.join(key, POSE));
  const ws = sockets[0];
  const server = r.connect();
  ws.send = (str) => { void r.raw(server, str); };
  server.send = (str) => ws.receive(str);
  const shut = server.close.bind(server);
  server.close = (code, reason) => { shut(code, reason); ws.drop(code, reason); };
  quiet(() => ws.open());
  await until(() => asked > 0, 'the hello is held on the hub');
  return { s, ws, server, release, r };
}

test('RPT1026-SECNET AN ACT WAITS FOR ITS SOCKET\'S WELCOME: at an instance whose hub is slow to say the party, a door\'s act sent the moment the socket opens is read ahead of the hello, parseClient refuses it, and the socket is closed for good, the member offline in the room; sendAct now refuses until the welcome (the world host keeps a refused act queued) and the act goes after it, the socket standing (mutant: sendAct asks the socket open alone)', async () => {
  // what the report found: a frame ahead of the welcome is the room's terminal close
  {
    const { s, ws, server, release } = await memberAtInstance();
    assert.equal(s.status, 'open', 'the socket says open');
    ws.send(JSON.stringify({ t: 'act', data: DOOR }));   // the frame sendAct sent before this change, the frame the socket opened
    await until(() => server.closed, 'the room closes on it');
    release();
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(server.closed.code, CLOSE_POLICY);
    assert.equal(s.terminal, true, 'closed for good - no reconnect until the room changes');
    assert.equal(s.error, 'act before hello');
  }
  // the session now
  {
    const { s, server, release } = await memberAtInstance();
    assert.equal(s.status, 'open');
    assert.equal(s.welcomed, false, 'its welcome is still owed');
    assert.equal(s.sendAct(DOOR), false, 'refused - kept for the welcome');
    release();
    await until(() => s.welcomed, 'the welcome');
    assert.equal(s.sendAct(DOOR), true, 'sent once the welcome is in');
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(server.closed, null, 'the socket stands');
    assert.equal(s.terminal, false);
  }
});

/** A session in a place room welcomed with `peers`, its ear the host's block list of `blocks`. */
async function hearing(blocks, peers = []) {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Me', id: 'me-00001', secret: 'secret-of-me-00001', presence: false, WebSocketImpl: FakeWS, now: () => 1_000_000 });
  quiet(() => s.join('world:3,12'));
  const ws = sockets.at(-1);
  ws.open();
  ws.receive({ t: 'welcome', id: 'me-00001', peers, n: 1 + peers.length, v: 'world268' });
  const got = [];
  s.onTrade = (id) => got.push(`trade:${id}`); s.onPage = (id) => got.push(`page:${id}`);
  const fetch = async () => new Response(JSON.stringify({ ok: true, blocks }), { status: 200, headers: { 'content-type': 'application/json' } });
  const storage = { getItem: (k) => (k === SESSION_KEY ? JSON.stringify({ secret: 's3cret', id: 'acct-me' }) : k === SERVICE_KEY ? 'https://accounts.test' : null) };
  const host = createChatSafetyHost({ log: () => null, links: () => [s], fetch, storage, touch: false, register: () => () => {} });
  await host.start();
  return { s, ws, got, host };
}
const ASKS = [['trade', { k: 'ask', to: 'me-00001', s: 'abc123' }], ['page', { to: 'me-00001', page: { head: 'Morndas', lines: ['Meet me'] } }]];

test('RPT1026-SECNET A REQUEST THAT NAMES NO ACCOUNT IS NOT HEARD AS NOBODY\'S: from a relay before the stamp, one no roster names is held back while the list blocks anyone and heard while it blocks nobody; a sender not blocked is heard (mutant: an unknown account heard)', async () => {
  // PIN MOVED (AUDIT RPT1026 A2): a first case stood here on a welcome whose roster named each peer's account - a roster
  // no producer sends: a place room's names none (MOD1), so the session's fallback to the roster's account has none to
  // ask. Its pin through the real Room is test/net/audit_rpt1026_secnet.test.js A2.
  // nobody named the sender's account: held back while the list blocks anyone
  {
    const { ws, got } = await hearing([{ sub: 'acct-tro-0002', name: 'Troll', at: 1 }]);
    for (const [t, data] of ASKS) ws.receive({ t, id: 'who-0004', data });
    assert.deepEqual(got, [], 'it might be the one blocked');
    for (const [t, data] of ASKS) ws.receive({ t, id: 'pal-0003', sub: 'acct-pal-0003', data });
    assert.deepEqual(got, ['trade:pal-0003', 'page:pal-0003'], 'an account named and not blocked is heard');
  }
  // and heard while it blocks nobody
  {
    const { ws, got, host } = await hearing([]);
    assert.equal(host.hears(null), true);
    for (const [t, data] of ASKS) ws.receive({ t, id: 'who-0004', data });
    assert.deepEqual(got, ['trade:who-0004', 'page:who-0004']);
  }
});

test('RPT1026-SECNET A STALLED LINE IS HANDED NO BURST: a player walking alone while the line stalls 29 s - its poses kept by the line and let go at once - was struck out by the relay\'s meter ("too many poses", a terminal close); the session now asks its deaf line (a ping, which the runtime answers), holds its poses while the answer is owed (a heartbeat\'s worth meanwhile), and the burst is under the strike-out: the socket stands, and the latest pose reaches the room once the line answers (mutants: no hold; no ping while saying poses; the hold\'s clock never started)', async () => {
  const realNow = Date.now;
  let clock = 1e12;
  Date.now = () => clock;
  try {
    const r = fakeRoom('dungeon:m187853213');
    await r.signer();
    const { FakeWS, sockets } = fakeSocketClass();
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'walk-0001', id: 'walk-0001', secret: 'secret-of-walk-0001', WebSocketImpl: FakeWS, now: () => clock, mintToken: () => r.token('walk-0001') });
    quiet(() => s.join('dungeon:m187853213', POSE));
    const ws = sockets[0];
    const server = r.connect();
    // the line: while it stalls, nothing crosses either way - it is kept, in order; the runtime answers the exact ping in
    // front of the object (server/src/index.js setWebSocketAutoResponse), as it does in production
    let stalled = false;
    const up = [], down = [];
    const toClient = (str) => { if (stalled) down.push(str); else ws.receive(str); };
    const toRoom = (str) => (str === '{"t":"ping"}' ? toClient('{"t":"pong"}') : r.raw(server, str));
    ws.send = (str) => { if (stalled) up.push(str); else void toRoom(str); };
    server.send = toClient;
    const shut = server.close.bind(server);
    server.close = (code, reason) => { shut(code, reason); ws.drop(code, reason); };
    quiet(() => ws.open());
    await until(() => s.welcomed, 'the welcome');
    let x = POSE.x;
    for (let i = 0; i < 300; i++) {
      clock += 100;
      if (i === 10) stalled = true;
      x += 8;
      quiet(() => { s.sendPose({ ...POSE, x, mv: 1 }); s.tick(); });
    }
    const poses = up.filter((f) => f.startsWith('{"t":"pose"')).length;
    assert.ok(poses <= POSE_HZ * (PING_MS + LINE_STALL_MS) / 1000 + 2, `the line was handed ${poses} poses in 29 s`);
    // the line clears: everything it kept arrives together
    stalled = false;
    for (const f of up.splice(0)) await toRoom(f);
    for (const f of down.splice(0)) ws.receive(f);
    assert.equal(server.closed, null, 'the burst is no flood');
    assert.equal(s.terminal, false);
    clock += 200;
    x += 8;
    quiet(() => s.sendPose({ ...POSE, x, mv: 1 }));
    await new Promise((res) => setTimeout(res, 20));
    assert.equal(r.room._attach(server).pose?.x, x, 'the latest pose, once the line answered');   // the room's own reading of its socket (a pose's write to the runtime's copy is lazy)
  } finally { Date.now = realNow; }
});

test('RPT1026-SECNET THE STALL\'S ARITHMETIC: what a stalled line can be handed before the session knows (PING_MS deaf, then LINE_STALL_MS unanswered) stays under the relay\'s strike-out for a walk and for a host\'s foes - a burst the meter drops in part and never closes on; a stall the session did not know would not (mutant: the stall\'s wait past the strike-out)', () => {
  const known = (PING_MS + LINE_STALL_MS) / 1000;
  const struckAt = (cap) => cap + DROP_STRIKES_MAX;   // the bucket's whole cap passes, then DROP_STRIKES_MAX in a row
  assert.ok(Math.ceil(POSE_HZ * known) + 2 < struckAt(POSE_HZ_MAX), 'a walk: its poses, its ping and a heartbeat');
  assert.ok(Math.ceil(FOES_HZ_MAX * known) + 1 < struckAt(FOES_HZ_MAX), 'a host\'s foes stream at its home rate');
  assert.ok(POSE_HZ * 29 > struckAt(POSE_HZ_MAX), 'and the report\'s stall, unknown, was a strike-out');
  assert.ok(LINE_STALL_MS < HEARTBEAT_MS, 'a stall is known inside a heartbeat');
});

test('RPT1026-SECNET A STALLED LINE\'S FOES WAIT TOO, AND ITS POSE TO ONE A HEARTBEAT: the host\'s stream is refused while the ping is owed (the next frame carries every foe), a pose goes once a HEARTBEAT_MS, and the line\'s answer lets everything go (mutants: the foes never held; the heartbeat never let through)', () => {
  const { FakeWS, sockets } = fakeSocketClass({ pong: false });   // a dead line: the runtime's answer never comes
  let t = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'host-0001', id: 'host-0001', secret: 'secret-of-host-0001', WebSocketImpl: FakeWS, now: () => t });
  quiet(() => s.join('world:3,12', POSE));
  const ws = sockets[0];
  ws.open();
  quiet(() => ws.receive({ t: 'welcome', id: 'host-0001', peers: [], host: 'host-0001', world: null, v: RELAY_VERSION }));
  const foes = { n: 1, f: [] };
  assert.equal(s.sendFoes(foes), true, 'a live line');
  assert.equal(s.sendPose({ ...POSE, x: POSE.x + 1 }), true);
  t += PING_MS;
  quiet(() => s.tick());
  assert.equal(ws.sent.at(-1), '{"t":"ping"}', 'a line deaf PING_MS is asked');
  t += LINE_STALL_MS;
  assert.equal(s.sendFoes(foes), false, 'stalled: the stream waits');
  assert.equal(s.sendPose({ ...POSE, x: POSE.x + 2 }), false, 'and the pose');
  t += HEARTBEAT_MS;
  assert.equal(s.sendPose({ ...POSE, x: POSE.x + 3 }), true, 'a heartbeat\'s worth goes');
  t += 200;
  assert.equal(s.sendPose({ ...POSE, x: POSE.x + 4 }), false);
  ws.receive({ t: 'pong' });
  t += 200;
  assert.equal(s.sendFoes(foes), true, 'answered: the line is live');
  assert.equal(s.sendPose({ ...POSE, x: POSE.x + 5 }), true);
  // the own lane, in a world room, as the host's stream
  const w = fakeSocketClass({ pong: false });
  let u = 1000;
  const o = new OnlineSession({ url: 'wss://relay.test', name: 'mate-0003', id: 'mate-0003', secret: 'secret-of-mate-0003', WebSocketImpl: w.FakeWS, now: () => u });
  quiet(() => o.join('dungeon:m187853213', POSE));
  w.sockets[0].open();
  quiet(() => w.sockets[0].receive({ t: 'welcome', id: 'mate-0003', peers: [], host: 'other-0002', world: null, v: RELAY_VERSION }));
  assert.equal(o.sendOwnFoes(foes), true);
  u += PING_MS;
  quiet(() => o.tick());
  u += LINE_STALL_MS;
  assert.equal(o.sendOwnFoes(foes), false, 'stalled: my own foes wait');
  w.sockets[0].receive({ t: 'pong' });
  u += 200;
  assert.equal(o.sendOwnFoes(foes), true);
});

test('RPT1026-SECNET A HALO\'S STALLED LINE HOLDS ITS POSES TOO: my own cell\'s line answers and hears every pose; three halos whose lines owe their ping\'s answer hear one pose (a heartbeat\'s worth) where a walk of twenty metres would hand each three, and their answers let the walk go on to them (mutants: the halo never held; the halos\' pings never start the clock)', () => {
  const { FakeWS, sockets } = fakeSocketClass({ pong: false });   // the answers are the test's to give
  let t = 1_000_000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: FakeWS, now: () => t });
  const CELL = WORLD_CELL * PIXEL_UNITS, M = PIXEL_UNITS / 819.2;
  const start = { x: CELL + 100 * M, y: 0, z: CELL + 100 * M, yaw: 0, pitch: 0, mv: 1 };
  const halos = cellHaloFor(Math.floor(start.x / PIXEL_UNITS), Math.floor(start.z / PIXEL_UNITS));
  const welcome = (ws) => quiet(() => { ws.open(); ws.receive({ t: 'welcome', id: 'mac-0001', peers: [] }); });
  quiet(() => s.join('world:1,1', start));
  welcome(sockets[0]);
  quiet(() => s.setHalo(halos));
  for (let i = 1; i < sockets.length; i++) welcome(sockets[i]);
  assert.equal(sockets.length, 4, 'a corner: my cell and three halos');
  t += PING_MS;
  quiet(() => s.tick());
  for (const ws of sockets) assert.equal(ws.sent.at(-1), '{"t":"ping"}', 'every deaf line asked');
  sockets[0].receive({ t: 'pong' });
  t += LINE_STALL_MS;
  for (const ws of sockets) ws.sent.length = 0;
  const poses = (ws) => ws.sent.filter((f) => f.startsWith('{"t":"pose"')).length;
  const pose = { ...start };
  const walk = (frames) => { for (let f = 0; f < frames; f++) { t += 1000 / POSE_HZ; pose.z += 4 * M / POSE_HZ; s.sendPose({ ...pose }); } };
  walk(50);
  assert.equal(poses(sockets[0]), 50, 'my own cell: every pose');
  for (const ws of sockets.slice(1)) assert.equal(poses(ws), 1, 'a stalled halo: one');
  for (const ws of sockets.slice(1)) ws.receive({ t: 'pong' });
  for (const ws of sockets) ws.sent.length = 0;
  walk(50);
  for (const ws of sockets.slice(1)) assert.ok(poses(ws) >= 2, 'answered: the walk reaches it again');
  // my own cell busy (a frame in every frame) and the halos gone deaf: each halo is asked on its own clock, and held
  for (const ws of sockets) ws.sent.length = 0;
  let held = 0;
  for (let f = 0; f < 150; f++) {
    t += 1000 / POSE_HZ;
    pose.z += 4 * M / POSE_HZ;
    sockets[0].receive({ t: 'pong' });
    s.sendPose({ ...pose });
    quiet(() => s.tick());
    if (f === 50 + 10 * LINE_STALL_MS / 1000 + 5) for (const ws of sockets.slice(1)) ws.sent.length = 0;
    if (f > 50 + 10 * LINE_STALL_MS / 1000 + 5) held++;
  }
  assert.ok(held > 40, 'four seconds and more');
  for (const ws of sockets.slice(1)) assert.equal(poses(ws), 0, 'a deaf halo, asked and unanswered, is handed nothing while its heartbeat stands');
  assert.ok(sockets[0].sent.filter((x) => x.startsWith('{"t":"pose"')).length > 140, 'my own cell still hears the walk');
});

test('RPT1026-SECNET A BOUT\'S ROOM AND THE ZONE\'S ROOM WORDS WAIT FOR THE WELCOME: across a reconnect, the socket open and its hello not yet answered, a duel blow to the bout\'s room and a take to the zone\'s pile go nowhere, nor a cell\'s blow by its kept roster (the relay closes a frame ahead of its hello for good); after the welcome all three go (mutants: sendDuel\'s room path unwelcomed; sendWild unwelcomed; sendHit\'s cell loop unwelcomed)', async () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let t = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'duel-0001', id: 'duel-0001', secret: 'secret-of-duel-0001', WebSocketImpl: FakeWS, now: () => t, rand: () => 0 });
  quiet(() => s.join('world:3,12', POSE));
  const welcome = { t: 'welcome', id: 'duel-0001', peers: [{ id: 'peer-0002', name: 'Bran', p: { x: 2, y: 0, z: 1, yaw: 0 } }], host: 'duel-0001', world: null, v: RELAY_VERSION };
  sockets[0].open();
  quiet(() => sockets[0].receive(welcome));
  assert.equal(s.duelOk && s.wildOk, true);
  const blow = { to: 'peer-0002', s: 'abc123def0', k: 'strike', n: 1, by: 'melee', p: [100000, 10.5, 200000], d: 5, a: { lv: 30 } };
  const take = { k: 'take', r: '0123456789ab', i: 0, n: 1 };
  assert.equal(s.sendDuel(blow, { room: s.room }), true, 'welcomed: the bout\'s room hears it');
  // the line blinks, and the session joins again
  quiet(() => sockets[0].drop(1006));
  t += 5000;
  quiet(() => s.tick());
  assert.equal(sockets.length, 2, 'a new socket');
  quiet(() => sockets[1].open());
  await new Promise((res) => setTimeout(res, 0));
  assert.equal(s.status, 'open');
  assert.equal(s.welcomed, false);
  assert.equal(s.sendDuel(blow, { room: s.room }), false, 'the bout\'s room, before its welcome');
  assert.equal(s.sendWild(take), false, 'the zone\'s room word, before its welcome');
  assert.equal(s.sendHit({ to: 'peer-0002', i: 0, d: 3 }), false, 'a cell\'s blow at a peer\'s foe the kept roster still names, before its welcome');
  assert.deepEqual(sockets[1].sent.map((f) => JSON.parse(f).t).filter((k) => k !== 'ping'), ['hello'], 'its hello and nothing else');
  quiet(() => sockets[1].receive(welcome));
  t += 1000;
  assert.equal(s.sendDuel(blow, { room: s.room }), true, 'welcomed');
  assert.equal(s.sendWild(take), true);
  assert.equal(s.sendHit({ to: 'peer-0002', i: 0, d: 3 }), true);
});
