// GRANT-DOOR and FOE-BOUNDS (2026-10-19, Mac: "Spec + B + A"; bible/11-Multiplayer/Spawn-Grants.md sections 19 and 20):
// THE RELAY'S HALF, over real Rooms (test/fakeRoom.mjs) - while `grantDoor` is on a foes room turns away a build whose
// hello says no spawn grants (GROUND-GATE's own law: a current build asks nothing, a cold room asks the hub before its
// first such hello, the hub itself lets anyone in); the relay vouches on every foes frame it fans for a sender whose
// hello said it (`g` 1); and with `grantStrip` on, such a sender is held to grants and a record no builder could give
// goes nowhere - counted once under the relay's own name, the worst one's evidence beside it, in the batch it signs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRoom, fakeRooms } from '../fakeRoom.mjs';
import { GROUND_LAW, GRANT_HELLO_LAW, GRANT_HELLO_LAW_WIRE_MAX, GRANT_OLD_REASON, CLOSE_POLICY, parseClient, cellRoomOfWire, PIXEL_UNITS } from '../../src/net/wire.js';
import { RELAY_CFG_KEYS, RELAY_INTERNAL_CFG, RELAY_CFG_TTL_MS, parseRelayCfgCommand } from '../../src/net/relayCfg.js';
import { openGrantMeasure, GRANT_MEASURE_SIG_HEADER, GRANT_RELAY_READER } from '../../src/net/grantMeasure.js';
import { foeHealthBound } from '../../src/net/foeBounds.js';

const { subtle } = globalThis.crypto;
const quiet = async (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return await fn(); } finally { console.warn = w; console.log = l; } };
const P0 = { x: 402 * PIXEL_UNITS + 100, y: 60, z: (499 - 151) * PIXEL_UNITS + 100, yaw: 0, pitch: 0 };
const CELL = cellRoomOfWire(P0.x, P0.z);
const CURRENT = { gl: GROUND_LAW, gv: GRANT_HELLO_LAW };

test('GRANT-DOOR THE WIRE: a hello says `gv` 1 to GRANT_HELLO_LAW_WIRE_MAX, any other value read as none (never refused for it); the setting is `grantDoor`, on or off; the refusal\'s reason fits a WebSocket close (mutants: the field dropped; the range)', () => {
  const hello = (gv) => parseClient(JSON.stringify({ t: 'hello', id: 'mac-0001', secret: 'secret-of-mac-0001', name: 'Mac', look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, pose: null, gv }), { hasHello: false });
  assert.equal(hello(GRANT_HELLO_LAW).gv, GRANT_HELLO_LAW);
  assert.equal(hello(GRANT_HELLO_LAW_WIRE_MAX).gv, GRANT_HELLO_LAW_WIRE_MAX);
  for (const v of [undefined, 0, -1, 1.5, '1', null, GRANT_HELLO_LAW_WIRE_MAX + 1]) assert.equal(hello(v).gv, undefined, String(v));
  assert.ok(new TextEncoder().encode(GRANT_OLD_REASON).length <= 123);
  assert.ok(RELAY_CFG_KEYS.includes('grantDoor'));
  assert.deepEqual(parseRelayCfgCommand('grantdoor on'), { cmd: 'relay', k: 'grantDoor', v: 'on' });
});

test('GRANT-DOOR THE RELAY\'S DOOR, through real Rooms: off, a build that says no grants is let in; a developer turns it on at the hub; a cold cell lets the current build in without asking, asks the hub before its first such hello and refuses it with the words every build shows - a building\'s room too; the hub lets anyone in; turned off, a cell lets it in again inside a TTL (mutants: the door unread; the cold ask unawaited; a hub refused; the reason the ground\'s)', async () => {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try {
    await quiet(async () => {
      const W = fakeRooms({ now: () => clock });
      const H = W.room('chat:world');
      const join = async (R, id, extra = {}) => { const ws = R.connect(); clock += 300; await R.hello(ws, id, null, extra); return ws; };
      const A = W.room('world:9,9');
      assert.equal((await join(A, 'old-0001', { gl: GROUND_LAW })).closed, null, 'off: let in');
      const dev = await join(H, 'dev-0001', { glyphs: ['dev'] });
      const say = async (k, v) => { clock += 5000; await H.raw(dev, JSON.stringify({ t: 'cfg', k, v })); return dev.sent.filter((f) => f.t === 'cfg').at(-1); };
      assert.match((await say('grantDoor', 'maybe')).error, /grantDoor is on .* or off/);
      assert.deepEqual(await say('grantDoor', 'on'), { t: 'cfg', k: 'grantDoor', v: 'on' });
      assert.equal((await join(H, 'old-0002')).closed, null, 'the hub streams no foes: anyone in');
      let asked = 0;
      const fetch0 = H.room.fetch.bind(H.room);
      H.room.fetch = (req) => { if (new URL(req.url).pathname === RELAY_INTERNAL_CFG) asked++; return fetch0(req); };
      const B = W.room('world:10,10');
      assert.equal((await join(B, 'new-0001', CURRENT)).closed, null, 'the current build is let in');
      assert.equal(asked, 0, 'and asks the hub nothing');
      const old = await join(B, 'old-0003', { gl: GROUND_LAW });
      assert.equal(asked, 1, 'the cold room asked before it answered');
      assert.deepEqual(old.closed, { code: CLOSE_POLICY, reason: GRANT_OLD_REASON });
      assert.match(old.sent.at(-1).m, /^This copy of the game is older than the world online\. Update it to play online/, 'GROUND-GATE\'s own words');
      const I = W.room('interior:m123456.7');
      assert.deepEqual((await join(I, 'old-0004', { gl: GROUND_LAW })).closed, { code: CLOSE_POLICY, reason: GRANT_OLD_REASON }, 'a building\'s room streams foes too');
      assert.deepEqual(await say('grantDoor', 'off'), { t: 'cfg', k: 'grantDoor', v: 'off' });
      clock += RELAY_CFG_TTL_MS;
      await join(B, 'old-0005', { gl: GROUND_LAW });
      await new Promise((r) => setImmediate(r));
      assert.equal((await join(B, 'old-0006', { gl: GROUND_LAW })).closed, null, 'off again: let in');
    });
  } finally { Date.now = realNow; }
});

async function cell(t, env = {}) {
  let now = 1_800_000_000_000;
  t.mock.method(Date, 'now', () => now);
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const r = fakeRoom(CELL, { now: () => now });
  const posts = [];
  Object.assign(r.env, {
    GATE_SIGNING_KEY: Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64'),
    GRANT_FEED_URL: 'https://accounts.example/v1/mod/grant-feed',
    ACCOUNTS: { fetch: async (req) => { posts.push({ sig: req.headers.get(GRANT_MEASURE_SIG_HEADER), body: new Uint8Array(await req.arrayBuffer()) }); return new Response('{}', { status: 202 }); } },
    ...env,
  });
  const join = async (id, extra = {}) => { const ws = r.connect(); await quiet(() => r.hello(ws, id, P0, { lv: 7, charLevel: 12, ...extra })); return { ws, foes: () => ws.sent.filter((m) => m.t === 'foes') }; };
  return { r, kp, posts, join, tick: (ms) => { now += ms; }, get now() { return now; } };
}

test('GRANT-DOOR THE RELAY VOUCHES: a frame from a socket whose hello said its spawn grants reaches every peer with `g` 1; one from a socket that did not, without (mutants: the vouch dropped; vouched for everyone)', async (t) => {
  const C = await cell(t);
  const mac = await C.join('sock-mac-01', CURRENT), old = await C.join('sock-old-01'), zed = await C.join('sock-zed-01');
  const frame = (n) => JSON.stringify({ t: 'foes', data: { n, k: CELL, full: 1, f: [{ i: 1, t: 0, f: [1, 2, 3] }] } });
  await C.r.raw(mac.ws, frame(1));
  await C.r.raw(old.ws, frame(1));
  const heard = zed.foes();
  assert.deepEqual(heard.map((m) => [m.id, m.g]), [['sock-mac-01', 1], ['sock-old-01', undefined]]);
});

test('FOE-BOUNDS THE RELAY STRIPS WHAT NO BUILDER COULD GIVE: with `grantStrip` on, a rat of 99,999 health goes to nobody - said three times, counted once - and a vouched sender\'s record with no grant goes too, at its bound or not; an ally of any health passes; the batch the relay signs carries the count under its own name with the worst one\'s evidence (mutants: the bound unread; counted every frame; the vouched sender passed whole; the evidence dropped)', async (t) => {
  const C = await cell(t, { GRANT_STRIP: 'on' });
  const mac = await C.join('sock-mac-01', CURRENT), zed = await C.join('sock-zed-01', CURRENT);
  const mx = foeHealthBound({ t: 0 }, { lane: 'street', wild: true, camp: false });
  const f = [
    { i: 1, t: 0, f: [1, 2, 3], k: 99_999, h: 99_999 },   // no builder's rat
    { i: 2, t: 0, f: [1, 2, 3], k: mx, h: mx },   // at its bound - but with no grant, from a sender the door holds to them
    { i: 3, t: 0, f: [1, 2, 3], k: 99_999, h: 99_999 },   // an ally: unverified
  ];
  for (let n = 1; n <= 3; n++) await C.r.raw(mac.ws, JSON.stringify({ t: 'foes', data: { n, k: CELL, full: 1, f, cp: [3], cn: ['Sworn'] } }));
  assert.deepEqual(zed.foes().at(-1)?.data?.f.map((r) => r.i), [3], 'the forged rat and the ungranted one went nowhere; the ally passed');
  await C.r.room._grantFlush();
  assert.equal(C.posts.length, 1);
  const opened = await openGrantMeasure(C.posts[0].body, C.posts[0].sig, C.kp.publicKey, { subtle, nowMs: C.now });
  assert.ok(opened.ok, opened.error ?? '');
  assert.deepEqual(opened.batch.tl, [{ a: GRANT_RELAY_READER, b: 'acct-sock-mac-01', r: 'stats', n: 1, e: { t: 0, k: 99_999, mx } }], 'once, under the relay\'s name, with its evidence');
});

test('GRANT-DOOR THE CLIENT: a foes room\'s hello says its spawn grants; a frame the relay vouched (`g` 1) makes its sender one held to them, an unvouched one does not; a relay at world223 takes `stats`, one before it does not (mutants: the vouch unread; the relay\'s version unread)', async () => {
  const { OnlineSession } = await import('../../src/net/online.js');
  const { fakeSocketClass } = await import('../fakeSocket.mjs');
  const room = 'interior:m123456.7';
  for (const v of ['world223', 'world222']) {
    const { FakeWS, sockets } = fakeSocketClass();
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => 1000 });
    await quiet(() => s.join(room, { x: 1, y: 2, z: 3, yaw: 0 }));
    sockets[0].open();
    assert.equal(JSON.parse(sockets[0].sent[0]).gv, GRANT_HELLO_LAW, 'the hello says it');
    await quiet(() => sockets[0].receive({ t: 'welcome', id: 'aaaa-0001', peers: [{ id: 'zzz-0001', name: 'Z', look: null, pose: null }, { id: 'zzz-0002', name: 'Y', look: null, pose: null }], host: 'zzz-0001', world: null, v, gm: 'measure' }));
    sockets[0].receive({ t: 'own', id: 'zzz-0001', g: 1, data: { n: 1, k: room, full: 1, f: [] } });
    sockets[0].receive({ t: 'own', id: 'zzz-0002', data: { n: 1, k: room, full: 1, f: [] } });
    assert.deepEqual([[...s.grantSenders], s.grantStatsOk], [['zzz-0001'], v === 'world223'], v);
  }
});
