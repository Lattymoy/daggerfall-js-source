// WORLD2 (Mac, 2026-09-12: "Lets continue on with the next phase") -
// SLICE 2: ONE SIMULATION PER ROOM. The host's foes are everyone's: the
// host streams each changed layout foe's state a few times a second
// ({t:'foes', data}, FOES_HZ_MAX on its own bucket, to everyone but the
// host), a joiner's layout foes are PUPPETS that mirror it and decide
// nothing, a joiner's own blows on a puppet go to the host as a hit
// ({t:'hit', data}, to the host's socket alone) and are applied through
// the host's own damage door, and the seat's handover (the relay's host
// frame) makes the puppets live. THE ARM EXECUTES: the wire (the two
// frames after hello, objects, the foes frame admitted past
// MAX_FRAME_BYTES by its prefix up to FOES_FRAME_MAX, the hit under the
// small cap, the constants one home); the Room over the one fake (the
// stream fanned to everyone but the host, a non-host's ignored unparsed,
// the stream's own bucket, a hit to the host alone and never the host's
// own, a town relaying neither, the seat's move re-routing the hits);
// the session (sendFoes the host's alone in a world room under the
// stream's own gate and the cap, sendHit anyone else's, onFoes from the
// room's host alone, onHit while hosting alone).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseClient, frameCap, foesGate, FOES_FRAME_MAX, FOES_HZ_MAX, FOES_PREFIX, WORLD_PREFIX, WORLD_FRAME_MAX, MAX_FRAME_BYTES, PIXEL_UNITS } from '../src/net/wire.js';
import * as relay from '../server/src/relay.js';
import { fakeRoom } from './fakeRoom.mjs';
import { OnlineSession } from '../src/net/online.js';

const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);

test('WORLD2: the wire - a foes frame and a hit are objects from a hello\'d socket; the foes frame is the other one admitted past MAX_FRAME_BYTES, by its prefix, up to FOES_FRAME_MAX and never past it whatever prefix it wore; the hit keeps the small cap; the stream\'s gate is its own; one home at both ends', () => {
  assert.equal(FOES_FRAME_MAX, 64 * 1024); assert.equal(FOES_HZ_MAX, 12); assert.equal(FOES_PREFIX, '{"t":"foes"');
  assert.ok(FOES_FRAME_MAX < WORLD_FRAME_MAX && FOES_FRAME_MAX > MAX_FRAME_BYTES, 'a delta, larger than a pose and smaller than the memory');
  for (const k of ['frameCap', 'foesGate', 'FOES_FRAME_MAX', 'FOES_HZ_MAX', 'FOES_PREFIX']) assert.equal(relay[k], { frameCap, foesGate, FOES_FRAME_MAX, FOES_HZ_MAX, FOES_PREFIX }[k], `${k} at both ends`);
  assert.equal(frameCap(WORLD_PREFIX + 'x'), WORLD_FRAME_MAX); assert.equal(frameCap(FOES_PREFIX + 'x'), FOES_FRAME_MAX); assert.equal(frameCap('{"t":"pose"'), MAX_FRAME_BYTES); assert.equal(frameCap(''), MAX_FRAME_BYTES);
  assert.ok(JSON.stringify({ t: 'foes', data: {} }).startsWith(FOES_PREFIX), 'the prefix is what the client mints');
  const foes = { seq: 1, f: [{ i: 0, f: [1, 2, 3], y: 0.5, h: 10, d: 0 }] };
  assert.deepEqual(parseClient(JSON.stringify({ t: 'foes', data: foes }), { hasHello: true }), { t: 'foes', data: foes });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'foes', data: foes })), { error: 'foes before hello' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'foes' }), { hasHello: true }), { error: 'bad foes' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'foes', data: [1] }), { hasHello: true }), { error: 'bad foes' });
  const hit = { i: 3, dmg: 12, kind: 'melee' };
  assert.deepEqual(parseClient(JSON.stringify({ t: 'hit', data: hit }), { hasHello: true }), { t: 'hit', data: hit });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'hit', data: hit })), { error: 'hit before hello' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'hit', data: 'x' }), { hasHello: true }), { error: 'bad hit' });
  assert.equal(parseClient(JSON.stringify({ t: 'foes', data: { pad: 'x'.repeat(MAX_FRAME_BYTES * 2) } }), { hasHello: true }).t, 'foes', 'a foes frame past MAX_FRAME_BYTES parses');
  assert.deepEqual(parseClient(JSON.stringify({ t: 'foes', data: { pad: 'x'.repeat(FOES_FRAME_MAX) } }), { hasHello: true }), { error: 'frame too large' }, 'and past FOES_FRAME_MAX does not');
  assert.deepEqual(parseClient('{"t":"world","pad":"' + 'x'.repeat(FOES_FRAME_MAX) + '","t":"foes","data":{}}', { hasHello: true }), { error: 'frame too large' }, 'the world prefix earns a foes frame nothing past its own cap');
  assert.deepEqual(parseClient(JSON.stringify({ data: { pad: 'x'.repeat(MAX_FRAME_BYTES * 2) }, t: 'foes' }), { hasHello: true }), { error: 'frame too large' }, 'without the prefix: the small cap, before any parse');
  assert.deepEqual(parseClient(JSON.stringify({ t: 'hit', data: { pad: 'x'.repeat(MAX_FRAME_BYTES) } }), { hasHello: true }), { error: 'frame too large' }, 'a hit keeps the small cap');
  assert.deepEqual(parseClient('{"t":"foes","pad":"' + 'x'.repeat(MAX_FRAME_BYTES * 2) + '","t":"hit","data":{}}', { hasHello: true }), { error: 'frame too large' }, 'the foes prefix earns a hit nothing (AUDIT WORLD A2\'s law)');
  let b = null, passed = 0;
  for (let i = 0; i < FOES_HZ_MAX + 5; i++) { const g = foesGate(b, 1000); b = g.bucket; if (g.pass) passed++; }
  assert.equal(passed, FOES_HZ_MAX, 'the stream\'s burst is FOES_HZ_MAX');
});

test('WORLD2: the Room - the host\'s foes frame reaches everyone hello\'d but the host, as {t:\'foes\', id, data}; a non-host\'s is ignored - a prefixed one unparsed - and no one is closed; the stream spends its own bucket, not the poses\'; a hit from anyone but the host reaches the host\'s socket alone, the host\'s own goes nowhere; a town relays neither; the seat\'s move re-routes the hits', async () => {
  const r = fakeRoom('dungeon:m187');
  const a = r.connect(), b = r.connect(), c = r.connect();
  await r.hello(a, 'aaaa-0001', at(1, 1)); await r.hello(b, 'bbbb-0002', at(1, 1)); await r.hello(c, 'cccc-0003', at(1, 1));
  const foes = { seq: 7, f: [{ i: 2, f: [10, 0, 10], y: 1, h: 5, d: 0 }] };
  await r.raw(a, JSON.stringify({ t: 'foes', data: foes }));
  assert.deepEqual(ofType(b, 'foes'), [{ t: 'foes', id: 'aaaa-0001', data: foes }], 'the stream, with the host\'s id');
  assert.deepEqual(ofType(c, 'foes'), [{ t: 'foes', id: 'aaaa-0001', data: foes }]);
  assert.equal(ofType(a, 'foes').length, 0, 'never back to the host');
  const big = { seq: 8, pad: 'p'.repeat(MAX_FRAME_BYTES * 2) };
  await r.raw(a, JSON.stringify({ t: 'foes', data: big }));
  assert.deepEqual(ofType(b, 'foes').at(-1).data, big, 'a frame past the small cap goes through by its prefix');
  await r.raw(b, JSON.stringify({ t: 'foes', data: foes }));
  await r.raw(b, FOES_PREFIX + 'x'.repeat(MAX_FRAME_BYTES * 2));
  assert.equal(ofType(c, 'foes').length, 2, 'a non-host\'s stream reaches no one (the two above are the host\'s)'); assert.equal(ofType(a, 'foes').length, 0);
  assert.equal(b.closed, null, 'and its junk after the prefix was never parsed'); assert.equal(ofType(b, 'error').length, 0);
  // the stream's own bucket: the poses' stands untouched
  const poseBucket = JSON.stringify(a.att.bucket);
  let sent = 0; for (let i = 0; i < 40; i++) { await r.raw(a, JSON.stringify({ t: 'foes', data: { seq: 100 + i } })); sent++; }
  const got = ofType(b, 'foes').length - 2;
  assert.ok(got >= FOES_HZ_MAX - 2 && got < sent, `FOES_HZ_MAX a second on the stream's bucket (two spent above): ${got} of ${sent} relayed`);
  assert.equal(JSON.stringify(a.att.bucket), poseBucket, 'the pose bucket spent nothing on the stream'); assert.ok(a.att.fbucket, 'the stream\'s own');
  assert.equal(a.closed, null, 'over the rate: dropped, the host not struck out for a burst');
  // the hit: to the host alone
  const hit = { i: 2, dmg: 9, kind: 'melee' };
  await r.raw(b, JSON.stringify({ t: 'hit', data: hit }));
  assert.deepEqual(ofType(a, 'hit'), [{ t: 'hit', id: 'bbbb-0002', data: hit }], 'the host hears the blow with the striker\'s id');
  assert.equal(ofType(c, 'hit').length, 0, 'no one else'); assert.equal(ofType(b, 'hit').length, 0, 'not the striker');
  await r.raw(a, JSON.stringify({ t: 'hit', data: hit }));
  assert.equal(ofType(b, 'hit').length + ofType(c, 'hit').length, 0, 'the host\'s own blow goes nowhere: it applies its own');
  // the seat moves: the hits follow it
  await r.drop(a);
  await r.raw(c, JSON.stringify({ t: 'hit', data: hit }));
  assert.deepEqual(ofType(b, 'hit'), [{ t: 'hit', id: 'cccc-0003', data: hit }], 'the new host hears the blow');
  const cHad = ofType(c, 'foes').length;
  await r.raw(b, JSON.stringify({ t: 'foes', data: foes }));
  assert.deepEqual(ofType(c, 'foes').at(-1), { t: 'foes', id: 'bbbb-0002', data: foes }, 'and streams'); assert.equal(ofType(c, 'foes').length, cHad + 1);
  // a town keeps no simulation
  const town = fakeRoom('town:m9');
  const t = town.connect(), u = town.connect();
  await town.hello(t, 'town-0001', at(1, 1)); await town.hello(u, 'town-0002', at(1, 1));
  await town.raw(t, JSON.stringify({ t: 'foes', data: foes })); await town.raw(u, JSON.stringify({ t: 'hit', data: hit }));
  assert.equal(ofType(u, 'foes').length + ofType(t, 'hit').length, 0, 'a town relays neither'); assert.equal(t.closed, null); assert.equal(u.closed, null);
});

function fakeSocketClass() {
  const sockets = [];
  class FakeWS {
    constructor(url) { this.url = url; this.sent = []; this.closed = null; sockets.push(this); }
    send(s) { this.sent.push(s); }
    close(code, reason) { this.closed = { code, reason }; }
    open() { this.onopen?.(); }
    receive(o) { this.onmessage?.({ data: JSON.stringify(o) }); }
  }
  return { FakeWS, sockets };
}

test('WORLD2: the session - sendFoes is the host\'s alone, in a world room, under the stream\'s own gate and its cap, t first; sendHit is anyone else\'s; onFoes hears the room\'s host alone (never a peer, never myself); onHit hears anyone while I host and no one otherwise', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now });
  const foesIn = [], hitsIn = [];
  s.onFoes = (id, data) => foesIn.push([id, data]); s.onHit = (id, data) => hitsIn.push([id, data]);
  assert.equal(s.stats.foes, 0); assert.equal(s.stats.hits, 0);
  s.join('dungeon:m187', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 });
  const ws = sockets[0]; ws.open();
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: 'bob-0002', world: null });
  const foes = { seq: 1, f: [] }, hit = { i: 0, dmg: 3, kind: 'arrow' };
  assert.equal(s.sendFoes(foes), false, 'not the host: no stream');
  assert.equal(s.sendHit(hit), true, 'a blow goes to the host'); assert.equal(ws.sent.at(-1), '{"t":"hit","data":{"i":0,"dmg":3,"kind":"arrow"}}');
  assert.equal(s.sendHit({ pad: 'x'.repeat(MAX_FRAME_BYTES) }), false, 'under the small cap'); assert.equal(s.sendHit([1]), false); assert.equal(s.sendHit(null), false);
  ws.receive({ t: 'foes', id: 'bob-0002', data: foes });
  assert.deepEqual(foesIn, [['bob-0002', foes]], 'the host\'s stream in');
  ws.receive({ t: 'foes', id: 'eve-0003', data: foes }); ws.receive({ t: 'foes', id: 'mac-0001', data: foes }); ws.receive({ t: 'foes', id: 'bob-0002', data: [1] });
  assert.equal(foesIn.length, 1, 'a peer\'s, my own, a malformed one: not the world');
  ws.receive({ t: 'hit', id: 'eve-0003', data: hit });
  assert.equal(hitsIn.length, 0, 'not hosting: no blow is mine to apply');
  ws.receive({ t: 'host', id: 'mac-0001' });
  assert.equal(s.sendHit(hit), false, 'the host applies its own blows');
  assert.equal(s.sendFoes(foes), true); assert.equal(ws.sent.at(-1), '{"t":"foes","data":{"seq":1,"f":[]}}', 't first: the relay\'s door reads the prefix');
  assert.equal(s.sendFoes({ pad: 'x'.repeat(FOES_FRAME_MAX) }), false, 'past the cap: kept home');
  let passed = 1; for (let i = 0; i < FOES_HZ_MAX + 5; i++) if (s.sendFoes({ seq: i })) passed++;
  assert.equal(passed, FOES_HZ_MAX, 'the stream\'s own gate at home: the relay never strikes the host');
  now += 1000; assert.equal(s.sendFoes({ seq: 99 }), true, 'a second on: refilled');
  assert.equal(s.stats.foes, FOES_HZ_MAX + 1); assert.equal(s.stats.hits, 1);
  ws.receive({ t: 'foes', id: 'bob-0002', data: foes });
  assert.equal(foesIn.length, 1, 'hosting: a stream from another is not the world');
  ws.receive({ t: 'hit', id: 'eve-0003', data: hit }); ws.receive({ t: 'hit', id: 'mac-0001', data: hit }); ws.receive({ t: 'hit', id: 'eve-0003', data: 'x' });
  assert.deepEqual(hitsIn, [['eve-0003', hit]], 'hosting: a blow from anyone else, with the striker\'s id');
  // a town: nothing out
  s.join('town:m9', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 });
  const ws2 = sockets[1]; ws2.open(); ws2.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: 'mac-0001', world: null });
  assert.equal(s.sendFoes(foes), false, 'a town streams no foes'); assert.equal(s.sendHit(hit), false);
});
