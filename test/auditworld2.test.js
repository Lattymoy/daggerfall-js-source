// AUDIT WORLD2 (Mac, 2026-09-12: "Lets do an audit on slice 2") - four
// opus lenses over WORLD2 (the relay and the wire; the puppets; the
// world host's lifecycle; the pins and the record), every finding
// refuted twice and fixed on the branch. THE FIXES EXECUTE: the relay
// over the one fake (a frame whose type disagrees with its prefix
// spends the type's bucket - A3; a large frame outside a world room
// refused, a non-host's stream of prefixed frames struck out, the
// refusal named for its prefix - A4/A7; the room's foes byte budget
// and its hit funnel - A5/A6; a small unprefixed world frame metered -
// D5); the session (a dead socket and a leave clear the seat through
// the one door, so the world host hears it - A2/C2; the hits' own gate
// at home - A6; my own id as the host is not the world in - D11); the
// record's struck sentences (D1, D6-D10).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PIXEL_UNITS, MAX_FRAME_BYTES, FOES_PREFIX, WORLD_PREFIX, FOES_HZ_MAX, FOES_ROOM_BYTES_PER_S, HIT_ROOM_HZ_MAX, HIT_HZ_MAX, POSE_HZ_MAX, DROP_STRIKES_MAX, byteGate, hitGate } from '../src/net/wire.js';
import * as relay from '../server/src/relay.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { OnlineSession, POSE_HZ, FOES_STALE_MS, FOES_FULL_MS } from '../src/net/online.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);

test('AUDIT WORLD2 A: the relay - the budgets are one home and the byte gate spends what fits; a frame whose TYPE disagrees with its prefix spends the type\'s bucket too (A3); outside a world room a large frame is refused and a small prefixed one ignored with the socket kept (A4); a non-host\'s stream of prefixed frames in a world room is struck out (A4); the refusal is named for its prefix (A7); the room\'s foes fan is budgeted by bytes times listeners and its hit funnel by rate, both dropping without a strike (A5/A6); a small unprefixed world frame is metered (D5)', async () => {
  for (const k of ['FOES_ROOM_BYTES_PER_S', 'HIT_ROOM_HZ_MAX', 'HIT_HZ_MAX', 'byteGate', 'hitGate']) assert.equal(relay[k], { FOES_ROOM_BYTES_PER_S, HIT_ROOM_HZ_MAX, HIT_HZ_MAX, byteGate, hitGate }[k], `${k} at both ends`);
  assert.ok(HIT_HZ_MAX + POSE_HZ <= POSE_HZ_MAX, 'a joiner\'s hits and poses together fit the relay\'s pose bucket');
  let g = byteGate(null, 1000, 3000, 4000); assert.equal(g.pass, true); assert.equal(g.bucket.bytes, 1000);
  g = byteGate(g.bucket, 1000, 3000, 4000); assert.equal(g.pass, false, 'over the budget: refused, nothing spent'); assert.equal(g.bucket.bytes, 1000);
  g = byteGate(g.bucket, 1500, 3000, 4000); assert.equal(g.pass, true, 'half a second later: refilled by half the rate'); assert.equal(g.bucket.bytes, 0);
  g = byteGate(g.bucket, 9000, 1, 4000); assert.equal(g.bucket.bytes, 4000 - 1, 'a second\'s worth at most');
  // A3: the door meters by prefix, the arms by type - a duplicate-key frame spends both
  const r = fakeRoom('dungeon:m187');
  const a = r.connect(), b = r.connect();
  await r.hello(a, 'aaaa-0001', at(1, 1)); await r.hello(b, 'bbbb-0002', at(1, 1));
  const foes = { n: 1, f: [{ i: 0, f: [1, 2, 3], y: 0, h: 5, d: 0, a: 0, m: 0 }] };
  const pose0 = JSON.stringify(a.att.bucket ?? null);
  await r.raw(a, '{"t":"world","pad":"' + 'x'.repeat(200) + '","t":"foes","data":' + JSON.stringify(foes) + '}');
  assert.deepEqual(ofType(b, 'foes').at(-1)?.data, foes, 'a foes frame under a world prefix still fans');
  assert.ok(a.att.fbucket, 'A3: and spent the stream\'s bucket, not the pose bucket alone'); assert.notEqual(JSON.stringify(a.att.bucket ?? null), pose0, 'the door\'s own spend stands');
  const fb = JSON.stringify(a.att.fbucket);
  await r.raw(a, '{"t":"foes","pad":"' + 'x'.repeat(200) + '","t":"world","data":{"locationKey":"dungeon:1","world":{}}}');
  assert.ok(r.store.has('world:meta'), 'a world frame under a foes prefix is stored');
  assert.notEqual(JSON.stringify(a.att.bucket ?? null), pose0, 'A3: and spent the pose bucket the world arm owns'); assert.notEqual(JSON.stringify(a.att.fbucket), fb, 'the door\'s spend on the stream\'s bucket stands');
  // D5: a small unprefixed world frame comes in by the ordinary door and is metered on the pose bucket there
  const pose1 = JSON.stringify(a.att.bucket);
  r.store.get('world:meta').at -= 10000;
  await r.raw(a, '{"data":{"locationKey":"dungeon:1","world":{"x":1}},"t":"world"}');
  assert.notEqual(JSON.stringify(a.att.bucket), pose1, 'D5: metered'); assert.equal(r.store.get('world:0'), '{"locationKey":"dungeon:1","world":{"x":1}}', 'and taken');
  // A4: a non-host's stream of prefixed frames is struck out, not sunk for free
  let n = 0; while (!b.closed && n++ < DROP_STRIKES_MAX + FOES_HZ_MAX + 20) await r.raw(b, FOES_PREFIX + 'x'.repeat(100));
  assert.ok(b.closed && ['too many foes', 'too many frames'].includes(b.sent.at(-1)?.m), `A4: struck out after ${n} frames (${b.sent.at(-1)?.m})`);
  // A7: the refusal is named for its prefix
  const cold = r.connect(); await r.raw(cold, FOES_PREFIX + 'x'.repeat(10));
  assert.deepEqual(cold.sent.at(-1), { t: 'error', m: 'foes before hello' }, 'A7');
  const cold2 = r.connect(); await r.raw(cold2, WORLD_PREFIX + 'x'.repeat(10));
  assert.deepEqual(cold2.sent.at(-1), { t: 'error', m: 'world before hello' });
  // A4: outside a world room a large frame has no home - refused, as the small cap always was; a small prefixed one is ignored, the socket kept
  const town = fakeRoom('town:m9');
  const t = town.connect(), u = town.connect();
  await town.hello(t, 'town-0001', at(1, 1)); await town.hello(u, 'town-0002', at(1, 1));
  await town.raw(t, FOES_PREFIX + ',"data":{},"pad":"' + 'x'.repeat(MAX_FRAME_BYTES) + '"}');
  assert.deepEqual(t.sent.at(-1), { t: 'error', m: 'frame too large' }, 'A4: a large prefixed frame in a town is refused'); assert.equal(t.closed?.code, 1008);
  await town.raw(u, 'x'.repeat(MAX_FRAME_BYTES + 1));
  assert.deepEqual(u.sent.at(-1), { t: 'error', m: 'frame too large' }, 'and a large unprefixed one');
  const v = town.connect(); await town.hello(v, 'town-0003', at(1, 1));
  await town.raw(v, JSON.stringify({ t: 'foes', data: foes }));
  assert.equal(v.closed, null, 'a small prefixed frame in a town: ignored, the socket kept'); assert.equal(v.att.junk, 1, 'and counted');
  // A5: the room's byte budget on the fan - the frame times its listeners; over it the frame is dropped and nobody struck
  const r2 = fakeRoom('dungeon:m9');
  const h = r2.connect(), j1 = r2.connect(), j2 = r2.connect();
  await r2.hello(h, 'host-0001', at(1, 1)); await r2.hello(j1, 'join-0002', at(1, 1)); await r2.hello(j2, 'join-0003', at(1, 1));
  const frame = JSON.stringify({ t: 'foes', data: { n: 1, pad: 'p'.repeat(1000) } });
  await r2.raw(h, frame);
  assert.equal(ofType(j1, 'foes').length, 1); assert.equal(ofType(j2, 'foes').length, 1);
  assert.ok(r2.room._roomFoes && r2.room._roomFoes.bytes < FOES_ROOM_BYTES_PER_S - 2 * frame.length && r2.room._roomFoes.bytes > FOES_ROOM_BYTES_PER_S - 2 * (frame.length + 60), `A5: the fan cost the budget twice the frame (${FOES_ROOM_BYTES_PER_S - r2.room._roomFoes.bytes} for ${frame.length} x 2)`);
  r2.room._roomFoes = { bytes: 10, at: Date.now() };   // the budget spent
  await r2.raw(h, frame.replace('"n":1', '"n":2'));
  assert.equal(ofType(j1, 'foes').length, 1, 'A5: over the budget - dropped'); assert.equal(h.closed, null, 'and no strike');
  r2.room._roomFoes = { bytes: 10, at: Date.now() - 1000 };   // a second on: refilled
  await r2.raw(h, frame.replace('"n":1', '"n":3'));
  assert.equal(ofType(j1, 'foes').at(-1).data.n, 3, 'refilled: fanned');
  // A6: the hit funnel onto the host's one socket is the room's to budget
  const hit = JSON.stringify({ t: 'hit', data: { i: 0, dmg: 1, kind: 'melee' } });
  await r2.raw(j1, hit); assert.equal(ofType(h, 'hit').length, 1);
  r2.room._roomHits = { tokens: 0, at: Date.now() };
  await r2.raw(j2, hit); assert.equal(ofType(h, 'hit').length, 1, 'A6: over the room\'s hit budget - dropped'); assert.equal(j2.closed, null, 'and no strike');
  r2.room._roomHits = { tokens: 0, at: Date.now() - 1000 };
  await r2.raw(j2, hit); assert.equal(ofType(h, 'hit').length, 2, 'refilled: forwarded');
  assert.equal(HIT_ROOM_HZ_MAX, 60);
  // the header says the truth (A8)
  const room = rd('server/src/index.js');
  assert.match(room, /WORLD2 \(2026-09-12\): THE LIVE FOES\./, 'the head has a WORLD2 paragraph'); assert.match(room, /metered on the pose bucket, or the\n\/\/ stream's own for a foes frame \(A1/, 'and the A1 sentence names both buckets');
  assert.match(rd('src/net/wire.js'), /\{t:'hello'\|'pose'\|'ping'\|'chat'\|'world'\|'foes'\|'hit'\|'act', \.\.\.\}/, 'parseClient\'s doc names the two frames (and WORLD3\'s third)');
});

test('AUDIT WORLD2: the session - a dead socket and a leave clear the seat through the one door, so the world host hears the seat go (A2/C2); the hits\' own gate at home refuses an over-rate blow to its caller (A6); my own id as the host is not the world in (D11); FOES_STALE_MS is three full frames', () => {
  assert.equal(FOES_STALE_MS, 3 * FOES_FULL_MS);
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now });
  const hosts = [], foesIn = [];
  s.onHost = (id, mine) => hosts.push([id, mine]); s.onFoes = (id, data) => foesIn.push([id, data]);
  s.join('dungeon:m187', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 });
  const ws = sockets[0]; ws.open();
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: 'bob-0002', world: null });
  assert.deepEqual(hosts, [['bob-0002', false]]);
  // A6: the hits' own gate at home
  let passed = 0; for (let i = 0; i < HIT_HZ_MAX + 5; i++) if (s.sendHit({ i, dmg: 1, kind: 'melee' })) passed++;
  assert.equal(passed, HIT_HZ_MAX, 'HIT_HZ_MAX a second, refused to the caller past it'); assert.equal(s.stats.hits, HIT_HZ_MAX);
  now += 1000; assert.equal(s.sendHit({ i: 0, dmg: 1, kind: 'melee' }), true, 'a second on: refilled');
  // A2/C2: the socket dies - the seat is cleared through the one door
  ws.drop(1006);
  assert.equal(s.host, null, 'a dead socket holds no seat'); assert.deepEqual(hosts.at(-1), [null, false], 'and the world host heard it');
  assert.equal(s.status, 'closed');
  const ws2 = sockets[1] ?? null;
  // the retry's welcome re-seats it: a change from null, so onHost fires again
  now += 10000; s.tick(); const w2 = sockets.at(-1); assert.notEqual(w2, ws, 'a retry opened'); w2.open();
  w2.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: 'bob-0002', world: null });
  assert.deepEqual(hosts.at(-1), ['bob-0002', false], 'the welcome re-seats the host - a change from none, said again');
  // D11: my own id as the host - my stream is not the world in
  w2.receive({ t: 'host', id: 'mac-0001' });
  w2.receive({ t: 'foes', id: 'mac-0001', data: { n: 1, f: [] } });
  assert.equal(foesIn.length, 0, 'D11: never myself');
  // a terminal close clears the seat too
  w2.drop(1008, 'refused');
  assert.equal(s.host, null); assert.equal(s.terminal, true); assert.deepEqual(hosts.at(-1), [null, false]);
  // a leave: through the one door
  const s2 = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0002', secret: 'secret-of-mac-0002', WebSocketImpl: FakeWS, now: () => now });
  const hosts2 = []; s2.onHost = (id, mine) => hosts2.push([id, mine]);
  s2.join('dungeon:m187', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 }); const w3 = sockets.at(-1); w3.open();
  w3.receive({ t: 'welcome', id: 'mac-0002', peers: [], host: 'bob-0002', world: null });
  s2.leave();
  assert.deepEqual(hosts2, [['bob-0002', false], [null, false]], 'C2: the leave says the seat went - with the room already gone'); assert.equal(s2.room, null);
  void ws2;
});

test('AUDIT WORLD2: the record - the sentences WORLD2 falsified are struck or amended (D1, D6-D10)', () => {
  const home = rd('bible/Home.md');
  assert.doesNotMatch(home, /The live moment - one simulation per room - is the next iteration/, 'D1: Home.md');
  assert.match(home, /then the room's simulation \(WORLD2\)/, 'D1: the arc list');
  const arc = rd('bible/06-Systems/Online-Arc.md');
  assert.doesNotMatch(arc, /Not done: the live moment\. Two players in one dungeon still each run\ntheir own foes/, 'D6: WORLD1\'s "not done"');
  assert.doesNotMatch(arc, /vanished still comes back for the next visitor\./, 'D9: the bullet qualified');
  assert.doesNotMatch(arc, /rewinds nothing for anyone else and is itself rewound/, 'D10: the quickload item re-scoped');
  assert.match(arc, /## AUDIT WORLD2 \(2026-09-12\)/, 'the section');
  const ledger = rd('bible/01-Overview/Port-Ledger.md');
  assert.doesNotMatch(ledger, /the live simulation is still each player's own \(the memory is a snapshot, not the moment\)\. AUDIT WORLD/, 'D7: the Ledger row');
  const mp = rd('bible/11-Multiplayer/Multiplayer.md');
  assert.doesNotMatch(mp, /slice 2 of\nthe arc hands the live simulation over with it/, 'D8: decision 2'); assert.doesNotMatch(mp, /the live simulation, slice 2 of the arc\./, 'D8: the open question');
});
