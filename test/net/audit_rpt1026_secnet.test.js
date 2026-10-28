// AUDIT RPT1026 lane A (SECNET), the relay and the session (bible/01-Overview/bugs/Field-Bugs-2026-10-26r.md,
// RPT1026-SECNET; bible/06-Systems/Online-Arc.md LINE-STALL): driven through the real Room (test/fakeRoom.mjs, real
// tokens) and the real session.
// - A1: a blow spends the relay's POSE meter (server/src/index.js, the hit arm's `_meter`), and LINE-STALL held a
//   stalled line's poses but not its blows - a fighter on a held line was handed HIT_HZ_MAX blows a second beside its
//   poses, and the burst struck the socket out ("too many poses", terminal) as a held walk once did.
// - A2: a place room's roster and its joins name no account (MOD1), so the session's fallback to "the account the
//   room's roster said" for a request with none never has an account to ask - a relay before the stamp holds back every
//   sender's trade and page while the list blocks anyone. RPT1026-SECNET's pin had hand-built a roster naming one.
// - A5: ACT WAITS counted `host` among the flags a hello resets, and an AURA-LIVE rehello keeps it: at an instance whose
//   hub is slow, a member's blow at the host and, hosting, the room's memory went down the replacement socket ahead of
//   its welcome, and the room closed it for good.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRoom } from '../fakeRoom.mjs';
import { fakeSocketClass } from '../fakeSocket.mjs';
import { OnlineSession, POSE_HZ, LINE_STALL_MS } from '../../src/net/online.js';
import { PIXEL_UNITS, PING_MS, POSE_HZ_MAX, HIT_HZ_MAX, DROP_STRIKES_MAX, RELAY_VERSION } from '../../src/net/wire.js';
import { createChatSafetyHost } from '../../src/scenes/chatSafetyHost.js';
import { instanceOwnerOf, instanceRoomOf, INSTANCE_INTERNAL_KIN } from '../../src/net/instanceRoom.js';
import { SESSION_KEY, SERVICE_KEY } from '../../src/net/accountClient.js';

const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
/** Waits on the machine's own clock (performance.now), so a pin that holds Date.now still can wait too. */
const until = async (ready, label) => {
  const deadline = performance.now() + 30_000;
  while (!ready()) {
    assert.ok(performance.now() < deadline, `${label}: timed out`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};
const CELL = 'world:3,12';
const POSE = { x: 56 * PIXEL_UNITS, y: 0, z: 200 * PIXEL_UNITS, yaw: 0, pitch: 0, mv: 0 };   // map pixel (56, 200), in CELL

/** My session in `key` of the real Room `r`, its socket bridged to the room's: `hold()` stalls the line (both ways, kept
 *  in order), `release()` lets it go at once; the runtime answers the exact ping in front of the room, as in production
 *  (server/src/index.js setWebSocketAutoResponse). */
async function bridged(r, key, id) {
  const { FakeWS, sockets } = fakeSocketClass();
  const tok = await r.token(id);   // minted before: no real-time race (TOKEN_WAIT_MS) is run
  const s = new OnlineSession({ url: 'wss://relay.test', name: id, id, secret: `secret-of-${id}`, WebSocketImpl: FakeWS, now: () => Date.now(), mintToken: () => tok });
  quiet(() => s.join(key, POSE));
  const ws = sockets[0];
  const server = r.connect();
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
  const release = async () => {
    stalled = false;
    for (const f of up.splice(0)) await toRoom(f);
    for (const f of down.splice(0)) ws.receive(f);
  };
  return { s, ws, server, up, hold: () => { stalled = true; }, release };
}

test('AUDIT RPT1026 A1 A STALLED LINE IS HANDED NO BLOWS EITHER: a player walking and striking a peer\'s foe at the session\'s own blow rate (HIT_HZ_MAX, which a quick fighter among several foes reaches) while the line is held 30 s from the moment it was last heard, then let go at once - the blows rode the poses\' meter, and the burst was the relay\'s "too many poses" close, terminal; the blows now wait with the poses, the burst is under the strike-out, the socket stands, and a blow after the line answers reaches the foe\'s owner (mutant: sendHit never asks the line)', async () => {
  const realNow = Date.now;
  let clock = 1e12;
  Date.now = () => clock;
  try {
    const r = fakeRoom(CELL);
    await r.signer();
    const owner = r.connect();
    await r.hello(owner, 'own-00009', { ...POSE, x: POSE.x + 50 });
    const { s, server, up, hold, release } = await bridged(r, CELL, 'fight-0001');
    assert.ok(s.peers.has('own-00009'), 'the foe\'s owner stands in my roster');
    hold();   // the worst case: the line stalls the moment after it was last heard (the welcome)
    let x = POSE.x;
    for (let i = 0; i < 300; i++) {
      clock += 100;
      x += 8;
      quiet(() => { s.sendPose({ ...POSE, x, mv: 1 }); s.sendHit({ to: 'own-00009', i: 0, d: 3 }); s.tick(); });
    }
    const handed = up.filter((f) => f.startsWith('{"t":"pose"') || f.startsWith('{"t":"hit"')).length;
    assert.ok(handed < POSE_HZ_MAX + DROP_STRIKES_MAX, `the line was handed ${handed} frames on the poses' meter in 30 s`);
    assert.ok(up.filter((f) => f.startsWith('{"t":"hit"')).length <= HIT_HZ_MAX * (PING_MS + LINE_STALL_MS) / 1000 + HIT_HZ_MAX + 1, 'no blow went once the stall was known');
    await release();
    assert.equal(server.closed, null, 'the burst is no flood');
    assert.equal(s.terminal, false);
    clock += 200;
    owner.sent.length = 0;
    assert.equal(quiet(() => s.sendHit({ to: 'own-00009', i: 0, d: 4 })), true, 'the line answered: a blow goes');
    await new Promise((res) => setTimeout(res, 20));
    assert.ok(owner.sent.some((m) => m.t === 'hit' && m.data?.d === 4), 'and reaches the foe\'s owner');
  } finally { Date.now = realNow; }
});

test('AUDIT RPT1026 A1 A WORLD ROOM\'S BLOW AT THE HOST WAITS ON A STALLED LINE TOO: a joiner\'s blow goes on a live line, is refused while its ping is owed past LINE_STALL_MS, and goes once the line answers (mutant: sendHit never asks the line)', () => {
  const { FakeWS, sockets } = fakeSocketClass({ pong: false });   // a dead line: the runtime's answer never comes
  let t = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'mate-0003', id: 'mate-0003', secret: 'secret-of-mate-0003', WebSocketImpl: FakeWS, now: () => t });
  quiet(() => s.join('dungeon:m187853213', POSE));
  const ws = sockets[0];
  ws.open();
  quiet(() => ws.receive({ t: 'welcome', id: 'mate-0003', peers: [{ id: 'host-0001', name: 'Host', pose: POSE }], host: 'host-0001', world: null, v: RELAY_VERSION }));
  assert.equal(s.sendHit({ i: 0, d: 3 }), true, 'a live line');
  t += PING_MS;
  quiet(() => s.tick());
  assert.equal(ws.sent.at(-1), '{"t":"ping"}', 'a line deaf PING_MS is asked');
  t += LINE_STALL_MS;
  assert.equal(s.sendHit({ i: 0, d: 3 }), false, 'stalled: the blow waits in its queue');
  ws.receive({ t: 'pong' });
  t += 200;
  assert.equal(s.sendHit({ i: 0, d: 3 }), true, 'answered: the line is live');
});

test('AUDIT RPT1026 A1 THE STALL\'S ARITHMETIC COUNTS THE BLOWS: what a fighter hands a stalled line on the poses\' meter before the session knows (its poses and its blows at their home rates, the blows\' bucket full) stays under the strike-out; the same fight unknown for 15 s was a strike-out (mutant: the stall\'s wait doubled, which the walk alone survives)', () => {
  const known = (PING_MS + LINE_STALL_MS) / 1000;
  const struckAt = (cap) => cap + DROP_STRIKES_MAX;
  assert.ok(Math.ceil((POSE_HZ + HIT_HZ_MAX) * known) + HIT_HZ_MAX + 2 < struckAt(POSE_HZ_MAX), 'a fight: its poses, its blows, its blows\' burst, its ping and a heartbeat');
  assert.ok((POSE_HZ + HIT_HZ_MAX) * 15 > struckAt(POSE_HZ_MAX), 'and a fight held 15 s, unknown, was a strike-out');
});

/** The host's block list over `s`, blocking `blocks`. */
async function ear(s, blocks) {
  const fetch = async () => new Response(JSON.stringify({ ok: true, blocks }), { status: 200, headers: { 'content-type': 'application/json' } });
  const storage = { getItem: (k) => (k === SESSION_KEY ? JSON.stringify({ secret: 's3cret', id: 'acct-me' }) : k === SERVICE_KEY ? 'https://accounts.test' : null) };
  const host = createChatSafetyHost({ log: () => null, links: () => [s], fetch, storage, touch: false, register: () => () => {} });
  await host.start();
  return host;
}

test('AUDIT RPT1026 A2 A PLACE ROOM NAMES NO ACCOUNT IN ITS ROSTER: through the real Room, the peers its welcome and its join stand in my session carry none (MOD1), so a request from a relay before the stamp - one naming no account - is held back from every sender while the list blocks anyone, the one not blocked too, and heard while it blocks nobody; the relay\'s own frame (stamped) is asked by its account', async () => {
  const realNow = Date.now;
  let clock = 1e12;
  Date.now = () => clock;
  try {
    const r = fakeRoom(CELL);
    await r.signer();
    const tro = r.connect();
    await r.hello(tro, 'tro-0002', POSE);
    const { s, ws } = await bridged(r, CELL, 'me-00001');
    const pal = r.connect();
    await r.hello(pal, 'pal-0003', POSE);
    assert.deepEqual([...s.peers.keys()].sort(), ['pal-0003', 'tro-0002'], 'the welcome stood one, the join the other');
    assert.deepEqual([s.peers.get('tro-0002').sub ?? null, s.peers.get('pal-0003').sub ?? null], [null, null], 'neither names an account');
    const got = [];
    s.onTrade = (id) => got.push(`trade:${id}`); s.onPage = (id) => got.push(`page:${id}`);
    const host = await ear(s, [{ sub: 'acct-tro-0002', name: 'Troll', at: 1 }]);
    const asks = [['trade', { k: 'ask', to: 'me-00001', s: 'abc123' }], ['page', { to: 'me-00001', page: { head: 'Morndas', lines: ['Meet me'] } }]];
    for (const [t, data] of asks) for (const id of ['tro-0002', 'pal-0003']) ws.receive({ t, id, data });
    assert.deepEqual(got, [], 'a relay before the stamp: every sender held back while anyone is blocked');
    clock += 2000;   // past the inbound gates (PAGE_IN_HZ_MAX)
    for (const [t, data] of asks) for (const id of ['tro-0002', 'pal-0003']) ws.receive({ t, id, sub: `acct-${id}`, data });
    assert.deepEqual(got, ['trade:pal-0003', 'page:pal-0003'], 'the relay\'s own frames: asked by their account');
    got.length = 0;
    host.dispose?.();
    const open = await ear(s, []);
    assert.equal(open.hears(null), true);
    clock += 2000;
    for (const [t, data] of asks) ws.receive({ t, id: 'pal-0003', data });
    assert.deepEqual(got, ['trade:pal-0003', 'page:pal-0003'], 'and heard while the list blocks nobody');
  } finally { Date.now = realNow; }
});

/** A party member's session at the owner's instance through the real Room, the hub's word on the party (its
 *  INSTANCE_INTERNAL_KIN ask) answered at once until `hold()`, then held until `go()` (its yes gone stale past
 *  INSTANCE_KIN_KEEP_MS). With `lead`, the owner stands in the room first and holds its seat. Every socket the session
 *  opens is bridged to a socket of the room.
 *  DETERMINISTIC, NOT TIMED (the coordinator's 12 parallel runs failed 4): only the KIN ask is counted and held - the
 *  hub hears other asks of the room, LEASE1's look at the relay's settings among them, off a frame of the member's own
 *  (`_leaseDoorOn`, never awaited by it), and that one counted for the hello's let the wait end before the replacement
 *  was even promoted; every other ask is answered at once with no settings. The session's tokens are minted before, so
 *  no real-time race (TOKEN_WAIT_MS) is run; and every frame the room is handed is kept, so the pin waits on the room's
 *  own work (`settle`, `frames`) before it moves the clock, never on the machine's time. */
async function memberAtInstance(clockRef, { lead = false } = {}) {
  let held = null, kin = 0;
  const answer = (o) => new Response(JSON.stringify(o));
  const ROOMS = { idFromName: (n) => n, get: () => ({ fetch: async (req) => {
    if (new URL(req.url).pathname !== INSTANCE_INTERNAL_KIN) return answer({});
    kin++;
    if (held) await held.p;
    return answer({ kin: true });
  } }) };
  const key = instanceRoomOf('dungeon:m187853213', { owner: await instanceOwnerOf('acct-lead-0001'), epoch: '89abcdef' });
  const r = fakeRoom(key, { ROOMS });
  await r.signer();
  const owner = lead ? r.connect() : null;
  if (owner) await r.hello(owner, 'lead-0001', POSE, { tokenSub: 'acct-lead-0001' });
  const tokens = [await r.token('mate-0002'), await r.token('mate-0002')];   // the join's and the rehello's
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'mate-0002', id: 'mate-0002', secret: 'secret-of-mate-0002', WebSocketImpl: FakeWS, now: () => clockRef.t, mintToken: () => tokens.shift() ?? r.token('mate-0002') });
  const servers = [];
  const bridge = (ws) => {
    const server = r.connect();
    server.frames = [];
    ws.send = (str) => { if (str === '{"t":"ping"}') { ws.receive('{"t":"pong"}'); return; } server.frames.push({ hello: str.startsWith('{"t":"hello"'), done: r.raw(server, str) }); };
    server.send = (str) => ws.receive(str);
    const shut = server.close.bind(server);
    server.close = (code, reason) => { shut(code, reason); ws.drop(code, reason); };
    servers.push(server);
    return server;
  };
  /** Every frame the room was handed, read through. */
  const settle = async () => { for (let n = -1; n !== servers.reduce((t, x) => t + x.frames.length, 0);) { n = servers.reduce((t, x) => t + x.frames.length, 0); await Promise.all(servers.flatMap((x) => x.frames.map((f) => f.done))); } };
  quiet(() => s.join(key, POSE));
  bridge(sockets[0]);
  quiet(() => sockets[0].open());
  await until(() => s.welcomed, 'the welcome');
  await settle();
  return {
    r, s, owner, sockets, servers, bridge, settle,
    kin: () => kin,
    hold: () => { held = {}; held.p = new Promise((res) => { held.go = res; }); },
    go: () => held?.go(),
    /** Every frame but its hello the room was handed down `server`, read through - the held hello is not waited on. */
    frames: (server) => Promise.all(server.frames.filter((f) => !f.hello).map((f) => f.done)),
  };
}

/** The member's AURA-LIVE rehello with the hub held: the replacement opened, bridged and its hello waiting on the hub. */
async function rehelloHeld(m) {
  await m.settle();   // nothing of the member's earlier frames still being read
  m.hold();
  const before = m.kin();
  assert.equal(quiet(() => m.s.rehello()), true);
  m.bridge(m.sockets[1]);
  quiet(() => m.sockets[1].open());
  await until(() => m.kin() > before, 'the rehello is held on the hub');
  assert.equal(m.s._ws, m.sockets[1], 'the replacement stands for the room');
  assert.equal(m.s.welcomed, false, 'its welcome owed');
}

test('AUDIT RPT1026 A5 A REHELLO\'S BLOW AND MEMORY WAIT FOR ITS WELCOME: at an instance whose hub is slow to say the party, a member\'s AURA-LIVE rehello (an aura or a name chosen) opens a replacement socket that stands for the room from its hello on, its host kept - a blow at the owner\'s foe and, hosting, the room\'s memory went down it ahead of the welcome, the room refused them ("hit before hello", "world before hello") and closed the socket for good; both now wait, and go once the welcome is in (mutants: the world room\'s blow unwelcomed; the memory unwelcomed)', async () => {
  const realNow = Date.now;
  const clock = { t: 1e12 };
  Date.now = () => clock.t;
  try {
    // a blow at the owner's foe, the owner hosting
    {
      const m = await memberAtInstance(clock, { lead: true });
      assert.equal(m.s.host, 'lead-0001');
      assert.equal(quiet(() => m.s.sendHit({ i: 0, d: 3 })), true, 'welcomed: the blow goes');
      await m.settle();
      for (let i = 0; i < 20; i++) { clock.t += 1000; await m.r.pose(m.owner, { ...POSE, x: POSE.x + i }); }   // the yes goes stale; the owner keeps its seat
      await rehelloHeld(m);
      assert.equal(m.s.host, 'lead-0001', 'its host kept');
      assert.equal(quiet(() => m.s.sendHit({ i: 0, d: 3 })), false, 'the blow waits in its queue');
      await m.frames(m.servers[1]);   // whatever went down the replacement, read by the room while its hello waits
      assert.equal(m.servers[1].closed, null, 'nothing went down it to be refused');
      m.go();
      await until(() => m.s.welcomed, 'the replacement\'s welcome');
      assert.equal(m.servers[1].closed, null, 'the socket stands');
      assert.equal(m.s.terminal, false);
      assert.equal(quiet(() => m.s.sendHit({ i: 0, d: 3 })), true, 'and the blow goes after it');
    }
    // the room's memory, the member hosting
    {
      const m = await memberAtInstance(clock);
      assert.equal(m.s.isHost(), true);
      assert.equal(m.s.sendWorld({ v: 1 }), true, 'welcomed: the memory goes');
      await m.settle();
      clock.t += 20_000;
      await rehelloHeld(m);
      assert.equal(m.s.isHost(), true, 'its seat kept');
      assert.equal(m.s.sendWorld({ v: 2 }), false, 'the memory waits');
      await m.frames(m.servers[1]);
      assert.equal(m.servers[1].closed, null, 'nothing went down it to be refused');
      m.go();
      await until(() => m.s.welcomed, 'the replacement\'s welcome');
      assert.equal(m.servers[1].closed, null, 'the socket stands');
      assert.equal(m.s.terminal, false);
      assert.equal(m.s.sendWorld({ v: 2 }), true, 'and goes after it');
    }
  } finally { Date.now = realNow; }
});
