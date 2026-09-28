// OWN1 (2026-09-26, Mac: "Dungeons and buildings" - a shared quest's foes in a dungeon and a building, and a building's
// foes at all). A WORLD room (a dungeon, a building) streamed its host's foes alone: a joiner's foes frame was junk and,
// past DROP_STRIKES_MAX of them, closed the socket for good, and every hit went to the host whatever `to` said. The
// `own` frame is the room's second lane: any hello'd socket streams its OWN foes beside the host's, fanned as a cell's
// are, and a hit marked `own` goes to the owner its `to` names. A client uses either only through a relay at
// OWN_RELAY_MIN - an older one would strike it out. These pins execute the relay's Room on the fake Durable Object and
// the session on the fake socket.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseClient, frameCap, OWN_PREFIX, FOES_FRAME_MAX, WORLD_FRAME_MAX, MAX_FRAME_BYTES, CELL_FRAME_RECORDS_MAX, PIXEL_UNITS, OWN_RELAY_MIN, relaySupportsOwn, RELAY_VERSION } from '../src/net/wire.js';
import { OnlineSession } from '../src/net/online.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';

const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
const rec = (i) => ({ i, t: 0, x: 0, f: [10, 0, 10], y: 1, h: 5, d: 0, a: 0, m: 0 });

test('OWN1: the wire - an own frame is an object from a hello\'d socket, capped as the foes frame is and told by its prefix; the relay that knows it is OWN_RELAY_MIN', () => {
  assert.equal(frameCap(OWN_PREFIX + '...'), FOES_FRAME_MAX, 'the prefix admits the foes frame\'s size');
  const data = { n: 1, full: 1, f: [rec(1)] };
  assert.deepEqual(parseClient(JSON.stringify({ t: 'own', data }), { hasHello: true }), { t: 'own', data });
  assert.equal(parseClient(JSON.stringify({ t: 'own', data }), { hasHello: false }).error, 'own before hello');
  assert.equal(parseClient(JSON.stringify({ t: 'own', data: [1] }), { hasHello: true }).error, 'bad own');
  assert.equal(parseClient(JSON.stringify({ t: 'own', data: { f: [], pad: 'p'.repeat(FOES_FRAME_MAX) } }), { hasHello: true }).error, 'frame too large');
  const smuggled = `{"t":"world","data":{"pad":"${'p'.repeat(FOES_FRAME_MAX)}"},"t":"own"}`;
  assert.ok(smuggled.length < WORLD_FRAME_MAX);
  assert.equal(parseClient(smuggled, { hasHello: true }).error, 'frame too large', 'a world frame\'s prefix that parses as own keeps the own frame\'s cap (AUDIT WORLD A2)');
  assert.equal(relaySupportsOwn('world113'), false); assert.equal(relaySupportsOwn('world117'), false, 'main\'s last relay before the merge (SHADOW-FANG) knows no own frame'); assert.equal(relaySupportsOwn(`world${OWN_RELAY_MIN}`), true); assert.equal(relaySupportsOwn('whatever'), false);
  assert.equal(relaySupportsOwn(RELAY_VERSION), true, 'this relay carries it - world121 since ONE-SEAT\'s merge (the Sigil Sets branch\'s AUDIT SET at world119, then PARTY-BUFFS, REST-OPT and the batch\'s audit at world120)');
  assert.equal(OWN_RELAY_MIN, 118, 'AUDIT (cross-cutting F7): the own lane\'s first relay stays world118 - the re-aim to relaySupportsOwn(RELAY_VERSION) alone let it drift to any later number');
});

test('OWN1: the Room - in a dungeon and a building ANY hello\'d socket streams its own foes to everyone else (no strike), a frame past the record bound is junk, a cell has no such lane; a hit marked `own` goes to the owner `to` names, a plain one still to the host', async () => {
  for (const key of ['dungeon:m187', 'interior:m187.4']) {
    const r = fakeRoom(key);
    const h = r.connect(), j = r.connect(), k = r.connect();
    await r.hello(h, 'host-0001', at(1, 1)); await r.hello(j, 'join-0002', at(1, 1)); await r.hello(k, 'join-0003', at(1, 1));
    const mine = { n: 1, full: 1, f: [rec(1)], qf: [[1, 'WAQ_SHIP_SMALLRAID', '_pirate_']] };
    await r.raw(j, JSON.stringify({ t: 'own', data: mine }));
    assert.deepEqual(ofType(h, 'own'), [{ t: 'own', id: 'join-0002', data: mine }], `${key}: a joiner's own foes reach the host`);
    assert.deepEqual(ofType(k, 'own'), [{ t: 'own', id: 'join-0002', data: mine }], 'and every other joiner');
    assert.equal(ofType(j, 'own').length, 0, 'never back to the sender');
    await r.raw(h, JSON.stringify({ t: 'own', data: mine }));
    assert.deepEqual(ofType(j, 'own').at(-1), { t: 'own', id: 'host-0001', data: mine }, 'the host has an own lane too, beside its stream');
    const big = { n: 2, full: 0, f: [], pad: 'p'.repeat(MAX_FRAME_BYTES * 2) };
    await r.raw(k, JSON.stringify({ t: 'own', data: big }));
    assert.deepEqual(ofType(h, 'own').at(-1), { t: 'own', id: 'join-0003', data: big }, 'past the small cap by its prefix');
    assert.equal((j.meters.junk ?? 0) + (k.meters.junk ?? 0), 0, 'no strike counted');
    await r.raw(k, JSON.stringify({ t: 'own', data: { n: 3, f: Array.from({ length: CELL_FRAME_RECORDS_MAX + 1 }, (_, i) => rec(i)) } }));
    assert.equal(k.meters.junk, 1, 'past the record bound: junk');
    await r.raw(k, JSON.stringify({ t: 'own', data: { n: 4, full: 1 } }));
    assert.equal(k.meters.junk, 2, 'and without its records');
    // the hits
    await r.raw(k, JSON.stringify({ t: 'hit', data: { own: 1, to: 'join-0002', i: 1, dmg: 4, kind: 'melee' } }));
    assert.deepEqual(ofType(j, 'hit').map((m) => m.id), ['join-0003'], 'a blow on a joiner\'s own foe goes to that joiner');
    assert.equal(ofType(h, 'hit').length, 0, 'not the host');
    await r.raw(k, JSON.stringify({ t: 'hit', data: { i: 1, dmg: 4, kind: 'melee', to: 'join-0002' } }));
    assert.deepEqual(ofType(h, 'hit').map((m) => m.id), ['join-0003'], 'a plain blow goes to the host, `to` or no');
    const before = k.meters.junk;
    await r.raw(k, JSON.stringify({ t: 'hit', data: { own: 1, to: 'nobody-0009', i: 1, dmg: 4, kind: 'melee' } }));
    assert.equal(k.meters.junk, before + 1, 'an own blow to no one in the room is junk, as a cell\'s is');
    await r.raw(k, JSON.stringify({ t: 'hit', data: { own: 1, to: 'join-0003', i: 1, dmg: 4, kind: 'melee' } }));
    assert.equal(ofType(k, 'hit').length, 0, 'and one naming the striker goes nowhere');
  }
  const c = fakeRoom('world:3,12');
  const a = c.connect(), b = c.connect();
  await c.hello(a, 'aaaa-0001', at(1, 1)); await c.hello(b, 'bbbb-0002', at(1, 1));
  await c.raw(a, JSON.stringify({ t: 'own', data: { n: 1, f: [] } }));
  await c.raw(a, OWN_PREFIX + ',"data":{"n":1,"f":[]}}');
  assert.equal(ofType(b, 'own').length, 0, 'a cell has no second lane - its foes frame is everyone\'s already');
  assert.equal(a.meters.junk, 2, 'and the frame is junk');
});

test('OWN1: the session - streams its own foes only in a world room and only through a relay that knows the lane; hears a roster peer\'s; strikes a peer\'s own foe through `to`; hears an own blow that names it, host or not', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now });
  const ownIn = [], hitsIn = [];
  s.onOwnFoes = (id, data) => ownIn.push([id, data]); s.onHit = (id, data) => hitsIn.push([id, data]);
  const info = console.info; console.info = () => {};
  try {
    const bob = { id: 'bob-0002', name: 'Bob', look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, pose: { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 } };
    s.join('dungeon:m187', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 });
    let ws = sockets.at(-1); ws.open();
    ws.receive({ t: 'welcome', id: 'mac-0001', peers: [bob], host: 'bob-0002', world: null, v: 'world113' });
    const mine = { n: 1, full: 1, f: [] };
    assert.equal(s.sendOwnFoes(mine), false, 'a relay behind the lane: nothing sent (it would strike it out)');
    assert.equal(s.sendHit({ own: 1, to: 'bob-0002', i: 1, dmg: 3, kind: 'melee' }), false, 'nor an own blow');
    s.join('dungeon:m188', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 });
    ws = sockets.at(-1); ws.open();
    ws.receive({ t: 'welcome', id: 'mac-0001', peers: [bob], host: 'bob-0002', world: null, v: `world${OWN_RELAY_MIN}` });
    now += 1000;
    assert.equal(s.isHost(), false);
    assert.equal(s.sendOwnFoes(mine), true, 'a joiner streams its own foes');
    assert.equal(ws.sent.at(-1), JSON.stringify({ t: 'own', data: mine }), 'told by its prefix');
    assert.equal(s.sendHit({ own: 1, to: 'mac-0001', i: 1, dmg: 3, kind: 'melee' }), false, 'my own foe is my own door\'s');
    assert.equal(s.sendHit({ own: 1, to: 'eve-0003', i: 1, dmg: 3, kind: 'melee' }), false, 'a stranger\'s is no one I know');
    assert.equal(s.sendHit({ own: 1, to: 'bob-0002', i: 1, dmg: 3, kind: 'melee' }), true, 'a peer\'s own foe: to that peer');
    ws.receive({ t: 'own', id: 'bob-0002', data: mine });
    ws.receive({ t: 'own', id: 'mac-0001', data: mine }); ws.receive({ t: 'own', id: 'eve-0003', data: mine }); ws.receive({ t: 'own', id: 'bob-0002', data: [1] });
    assert.deepEqual(ownIn, [['bob-0002', mine]], 'a roster peer\'s own foes - never my own, a stranger\'s or a malformed one');
    ws.receive({ t: 'hit', id: 'bob-0002', data: { own: 1, to: 'mac-0001', i: 1, dmg: 2, kind: 'melee' } });
    ws.receive({ t: 'hit', id: 'bob-0002', data: { own: 1, to: 'eve-0003', i: 1, dmg: 2, kind: 'melee' } });
    ws.receive({ t: 'hit', id: 'bob-0002', data: { i: 1, dmg: 2, kind: 'melee' } });
    assert.deepEqual(hitsIn.map(([id, d]) => [id, d.to ?? null]), [['bob-0002', 'mac-0001']], 'an own blow naming me lands though I do not host; one naming another, or a plain one while I do not host, does not');
    s.join('world:3,12', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 });
    ws = sockets.at(-1); ws.open();
    ws.receive({ t: 'welcome', id: 'mac-0001', peers: [bob], host: null, world: null, v: `world${OWN_RELAY_MIN}` });
    now += 1000;
    assert.equal(s.sendOwnFoes(mine), false, 'a cell streams through its foes frame, not this');
  } finally { console.info = info; }
});

test('AUDIT pre-merge O3/O4: the Room fans a peer\'s frame only as the bytes its budget was charged - one that grows when re-serialised (`1e20`) is junk, as is one nested past what stringify takes (it threw out of the handler, budget spent); an honest frame fans as ever', async () => {
  const r = fakeRoom('dungeon:m187');
  const h = r.connect(), j = r.connect();
  await r.hello(h, 'host-0001', { x: 1, y: 0, z: 1, yaw: 0, pitch: 0, mv: 0 });
  await r.hello(j, 'join-0002', { x: 1, y: 0, z: 1, yaw: 0, pitch: 0, mv: 0 });
  const honest = { n: 1, full: 1, f: [rec(1)] };
  await r.raw(j, JSON.stringify({ t: 'own', data: honest }));
  assert.deepEqual(ofType(h, 'own').at(-1), { t: 'own', id: 'join-0002', data: honest }, 'an honest frame fans');
  const fanned = ofType(h, 'own').length;
  await r.raw(j, `{"t":"own","data":{"n":2,"f":[],"pad":[${Array(200).fill('1e20').join(',')}]}}`);
  assert.equal(ofType(h, 'own').length, fanned, 'a frame that grows in the re-serialising is not fanned');
  assert.equal(j.meters.junk, 1, 'it is junk');
  const deep = 20000;
  await r.raw(j, `{"t":"own","data":{"n":3,"f":[],"x":${'['.repeat(deep)}${']'.repeat(deep)}}}`);
  assert.equal(j.meters.junk, 2, 'a nesting stringify cannot take: junk, not a throw');
  const hitDeep = 7000;   // under the plain frame's 16 KiB cap (MAX_FRAME_BYTES), past what stringify takes
  const hit = `{"t":"hit","data":{"own":1,"to":"host-0001","i":1,"dmg":4,"kind":"melee","x":${'['.repeat(hitDeep)}${']'.repeat(hitDeep)}}}`;
  assert.ok(hit.length < MAX_FRAME_BYTES, 'the frame passes the door');
  await r.raw(j, hit);
  assert.equal(j.meters.junk, 3, 'the hit arm too');
  assert.equal(ofType(h, 'hit').length, 0);
  // AUDIT pre-merge O5: a cell's own frame WITHOUT the prefix (the arm's own room test, not the door's) is junk too
  const c = fakeRoom('world:3,12');
  const a = c.connect(), b = c.connect();
  await c.hello(a, 'aaaa-0001', at(1, 1)); await c.hello(b, 'bbbb-0002', at(1, 1));
  await c.raw(a, JSON.stringify({ data: { n: 1, f: [] }, t: 'own' }));
  assert.equal(ofType(b, 'own').length, 0, 'fanned to nobody in a cell');
  assert.equal(a.meters.junk, 1, 'junk');
  // the cell's foes frame is fanned by the same guard (any socket streams there)
  await c.raw(a, JSON.stringify({ t: 'foes', data: { n: 1, full: 1, f: [rec(1)] } }));
  assert.equal(ofType(b, 'foes').length, 1, 'an honest cell frame fans');
  await c.raw(a, `{"t":"foes","data":{"n":2,"f":[],"pad":[${Array(200).fill('1e20').join(',')}]}}`);
  assert.equal(ofType(b, 'foes').length, 1, 'a growing one does not');
  assert.equal(a.meters.junk, 2);
});

test('AUDIT pre-merge O2 + O5: the session - a new socket waits for ITS welcome before its own stream (a reconnect to a relay rolled back behind the lane was closed on it); a HOST hears an own blow that names it too', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now });
  const hitsIn = [];
  s.onHit = (id, data) => hitsIn.push([id, data]);
  const info = console.info; console.info = () => {};
  try {
    const bob = { id: 'bob-0002', name: 'Bob', look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, pose: { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 } };
    const mine = { n: 1, full: 1, f: [] };
    s.join('dungeon:m187', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 });
    let ws = sockets.at(-1); ws.open();
    ws.receive({ t: 'welcome', id: 'mac-0001', peers: [bob], host: 'mac-0001', world: null, v: `world${OWN_RELAY_MIN}` });
    now += 1000;
    assert.equal(s.isHost(), true);
    assert.equal(s.sendOwnFoes(mine), true, 'a host streams its own lane beside its stream');
    ws.receive({ t: 'hit', id: 'bob-0002', data: { own: 1, to: 'mac-0001', i: 1, dmg: 2, kind: 'melee' } });
    assert.deepEqual(hitsIn.map(([id, d]) => [id, d.own ?? 0]), [['bob-0002', 1]], 'the host hears an own blow naming it - a party member\'s blow on the host\'s shared quest foe');
    s.join('dungeon:m188', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 });
    ws = sockets.at(-1); ws.open();
    assert.equal(s.status, 'open', 'the socket is open ...');
    assert.equal(s.sendOwnFoes(mine), false, '... but no welcome has named its relay: nothing on the own lane');
    ws.receive({ t: 'welcome', id: 'mac-0001', peers: [bob], host: 'bob-0002', world: null, v: `world${OWN_RELAY_MIN}` });
    now += 1000;
    assert.equal(s.sendOwnFoes(mine), true, 'its welcome names a relay that knows it');
  } finally { console.info = info; }
});
