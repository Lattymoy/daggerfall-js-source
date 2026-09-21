// AUDIT WORLD6b-iii(b) (2026-09-14, Mac: "Audit"): three opus lenses over the cell seam - the session's halo, the
// geometry / the relay / the world host, the pool and the hits. The critical: the world host CLOSED the halo of the
// cell it was entering on the crossing frame (the wanted list is the new pixel's, which names neither the old cell -
// my own - nor the new one - the pixel's), so the promotion never fired from the shipped host and every crossing was
// still a leave-and-reconnect with the roster wiped and every puppet swept (B1). The highs: a promotion onto a
// dropped halo demoted the live socket (A1/B7/C2); a blow keyed to a cell the owner had just crossed out of was
// refused - silently - for a foes interval (A3/C1/B6); an unanswerable roster pruned every owner while the halos
// kept feeding frames, a spawn-and-discard loop per frame (C3/B5); a halo's terminal close was re-opened every frame
// (A2); the halo's life hung on the primary's socket (A5); a demoted primary kept a stale status (A6); a halo stuck
// connecting was immortal (A7); the primary's terminal close left the halos posing my ghost (A4). These pins EXECUTE
// the session over fake sockets in the world host's own frame order, the pool, and the wire.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cellHaloFor, CLOSE_POLICY, CLOSE_REPLACED, isCellRoom, worldRoom } from '../src/net/wire.js';
import { OnlineSession, BACKOFF_MAX_MS } from '../src/net/online.js';
import { fakeSocketClass } from './fakeSocket.mjs';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const pose = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 };
const look = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };
const quiet = (fn) => { const info = console.info; console.info = () => {}; try { return fn(); } finally { console.info = info; } };
const session = (now) => new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: fakeSocketClass().FakeWS, now });

/** The world host's online frame, as world.js orders it (B1): the key from the pixel, the join when the cell is held
 *  or the hold is up, the halo from the pixel plus the cell stood in, the tick. */
function hostFrame(s, mp, now, state) {
  const key = worldRoom(mp.x, mp.y);
  if (key !== state.key) { state.key = key; state.since = now; }
  if (key !== s.room) { if (!s.room || (isCellRoom(key) && s.inRoom(key)) || now - state.since >= 500) s.join(key, pose); }
  else s.sendPose(pose);
  const want = isCellRoom(s.room) ? cellHaloFor(mp.x, mp.y, { current: s.haloRooms() }) : [];
  if (isCellRoom(s.room) && isCellRoom(key) && key !== s.room) want.push(key);
  s.setHalo(want);
  s.tick();
}

test('AUDIT WORLD6b-iii(b) B1/B8: the crossing in the world host\'s OWN frame order - the halo of the cell I step into is KEPT on the crossing frame (it was closed: the wanted list was the new pixel\'s), the join promotes the moment the cell is held (no hold), nothing closed, nobody wiped, no reconnect', () => quiet(() => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now });
  const st = { key: null, since: 0 };
  hostFrame(s, { x: 40, y: 200 }, now, st);   // mid cell 2
  sockets[0].open(); sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'bob-0002', name: 'Bob', look, pose }], host: null, world: null });
  assert.equal(s.room, 'world:2,12'); assert.deepEqual(s.haloRooms(), []);
  now += 100; hostFrame(s, { x: 47, y: 200 }, now, st);   // the last pixel of cell 2: cell 3 is a halo
  assert.deepEqual(s.haloRooms(), ['world:3,12']); assert.equal(sockets.length, 2);
  sockets[1].open(); sockets[1].receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'eve-0003', name: 'Eve', look, pose }], host: null, world: null });
  assert.deepEqual([...s.peers.keys()].sort(), ['bob-0002', 'eve-0003']);
  const reconnects = s.stats.reconnects;
  now += 100; hostFrame(s, { x: 48, y: 200 }, now, st);   // the crossing frame
  assert.equal(s.room, 'world:3,12', 'joined at once: the cell was held'); assert.equal(s._ws, sockets[1], 'the halo\'s socket promoted');
  assert.deepEqual(s.haloRooms(), ['world:2,12'], 'the cell left is a halo'); assert.equal(sockets.length, 2, 'no socket opened');
  assert.equal(sockets[0].closed, null); assert.equal(sockets[1].closed, null, 'nothing closed');
  assert.equal(s.stats.reconnects, reconnects); assert.deepEqual([...s.peers.keys()].sort(), ['bob-0002', 'eve-0003'], 'nobody wiped');
  assert.equal(s.status, 'open');
  now += 100; hostFrame(s, { x: 49, y: 200 }, now, st);
  assert.deepEqual(s.haloRooms(), ['world:2,12'], 'held on'); assert.equal(sockets.length, 2);
  now += 100; hostFrame(s, { x: 53, y: 200 }, now, st);   // five in: the old cell out of the hysteresis
  assert.deepEqual(s.haloRooms(), []); assert.deepEqual(sockets[0].closed, { code: 1000, reason: 'leaving' }); assert.deepEqual([...s.peers.keys()], ['eve-0003'], 'Bob went with his room');
}));

test('AUDIT WORLD6b-iii(b) A1/B7/C2, A6: only a LIVE, OPEN halo is promoted - a dropped one pending its retry is forgotten and the ordinary join stands the new cell\'s socket at once (the live socket was demoted and then closed); a demoted primary that was not open steps down as connecting, not with a stale status', () => quiet(() => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now });
  s.join('world:2,12', pose); sockets[0].open(); sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null });
  s.setHalo(['world:3,12']); sockets[1].open(); sockets[1].drop(1006);
  assert.equal(s.inRoom('world:3,12'), false);
  s.join('world:3,12', pose);
  assert.equal(s.room, 'world:3,12'); assert.equal(s.status, 'connecting', 'the ordinary join'); assert.equal(sockets.length, 3, 'a socket for the new cell at once');
  assert.equal(sockets[2].url, 'wss://relay.test/room/world:3,12'); assert.deepEqual(s.haloRooms(), [], 'the stale entry gone, the old cell not demoted into a halo (leave took it)');
  assert.deepEqual(sockets[0].closed, { code: 1000, reason: 'leaving' });
  sockets[2].open();
  assert.equal(s.status, 'open');
  // a demoted primary that was 'error' (a relay error frame, the close on its way) steps down as connecting
  s.setHalo(['world:4,12']); sockets[3].open();
  sockets[2].receive({ t: 'error', m: 'x' });
  assert.equal(s.status, 'error');
  s.join('world:4,12', pose);
  assert.equal(s._ws, sockets[3]); assert.equal(s.status, 'open');
  assert.equal(s._halo.get('world:3,12').status, 'connecting', 'A6: the socket\'s own state, not the session\'s');
  sockets[2].drop(1006);
  assert.equal(s._halo.get('world:3,12').status, 'closed'); assert.ok(s._halo.get('world:3,12').retryAt > now, 'and it is retried like any halo');
}));

test('AUDIT WORLD6b-iii(b) A2/A4/A5/A7: a halo\'s terminal close is REMEMBERED (no re-open every frame, no retry; cleared once out of range); the primary\'s terminal close ends every halo; a primary blip keeps the halos and my pose still goes through them; a halo stuck connecting is dropped past the longest backoff and retried', () => quiet(() => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now });
  s.join('world:3,12', pose); sockets[0].open(); sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null });
  // A2
  s.setHalo(['world:2,12']); const h1 = sockets[1]; h1.open(); h1.drop(CLOSE_POLICY);
  assert.deepEqual(s.haloRooms(), ['world:2,12'], 'remembered'); assert.equal(s.inRoom('world:2,12'), false);
  for (let i = 0; i < 5; i++) { s.setHalo(['world:2,12']); now += 60000; s.tick(); }
  assert.equal(sockets.length, 2, 'A2: never re-opened, never retried');
  s.setHalo([]); assert.deepEqual(s.haloRooms(), []);
  s.setHalo(['world:2,12']); assert.equal(sockets.length, 3, 'wanted afresh: tried again');
  const h2 = sockets[2]; h2.open(); h2.receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'eve-0003', name: 'Eve', look, pose }], host: null, world: null });
  // A5: a primary blip
  sockets[0].drop(1006);
  assert.equal(s.status, 'closed'); assert.equal(s.inRoom('world:2,12'), true);
  s.setHalo(['world:2,12']);
  assert.equal(h2.closed, null, 'A5: the halo rides out the blip'); assert.equal(s.peers.has('eve-0003'), true);
  now += 1000;
  assert.equal(s.sendPose({ ...pose, x: 9 }), true, 'my pose still goes'); assert.equal(h2.sent.at(-1), JSON.stringify({ t: 'pose', p: { ...pose, x: 9 } }), 'through the halo');
  now += 60000; s.tick();
  assert.equal(sockets.length, 4, 'the primary retried'); sockets[3].open(); assert.equal(s.status, 'open'); assert.equal(h2.closed, null);
  // A7: a halo that never opens
  s.setHalo(['world:2,12', 'world:4,12']); const stuck = sockets[4];
  assert.equal(stuck.url, 'wss://relay.test/room/world:4,12');
  now += BACKOFF_MAX_MS + 1; s.tick();
  assert.deepEqual(stuck.closed, { code: 1000, reason: 'timeout' }, 'A7: dropped past the longest backoff'); assert.equal(s._halo.get('world:4,12').status, 'closed');
  now += BACKOFF_MAX_MS + 1; s.tick();
  assert.equal(sockets.length, 6, 'and retried'); assert.equal(sockets[5].url, 'wss://relay.test/room/world:4,12');
  // A4: the primary's terminal close
  sockets[3].drop(CLOSE_REPLACED);
  assert.equal(s.terminal, true); assert.deepEqual(s.haloRooms(), [], 'A4: every halo ended'); assert.deepEqual(h2.closed, { code: 1000, reason: 'leaving' }); assert.equal(s.peers.has('eve-0003'), false);
  s.setHalo(['world:2,12']); assert.equal(sockets.length, 6, 'and none opened for a dead session');
}));

test('AUDIT WORLD6b-iii(b) A3/C1/B6, C6: a blow is struck where its owner is REPORTED (the frame\'s cell a preference: its cell, my own, any halo; refused only when no held room reports it); the pool takes a blow at my foe keyed to any cell I hold; the same pose again through a second room is seen, not re-eased', async () => quiet(async () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now });
  s.join('world:3,12', pose); const ws = sockets[0]; ws.open(); ws.receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'eve-0003', name: 'Eve', look, pose }], host: null, world: null });
  s.setHalo(['world:2,12']); const hw = sockets[1]; hw.open(); hw.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null });
  now += 1000;
  assert.equal(s.sendHit({ to: 'eve-0003', k: 'world:2,12', i: 1, dmg: 3, kind: 'arrow' }), true, 'A3: Eve crossed into my cell since the frame that keyed my blow - struck where she is');
  assert.equal(ws.sent.at(-1), '{"t":"hit","data":{"to":"eve-0003","k":"world:2,12","i":1,"dmg":3,"kind":"arrow"}}', 'through my own cell'); assert.equal(hw.sent.filter((f) => f.includes('"hit"')).length, 0);
  now += 1000;
  hw.receive({ t: 'join', id: 'ann-0004', name: 'Ann', look, pose });
  assert.equal(s.sendHit({ to: 'ann-0004', k: 'world:9,9', i: 1, dmg: 3, kind: 'arrow' }), true, 'keyed to a cell I do not hold: through the halo that reports her');
  assert.equal(hw.sent.at(-1), '{"t":"hit","data":{"to":"ann-0004","k":"world:9,9","i":1,"dmg":3,"kind":"arrow"}}');
  hw.receive({ t: 'leave', id: 'ann-0004' });
  now += 1000;
  assert.equal(s.sendHit({ to: 'ann-0004', k: 'world:2,12', i: 1, dmg: 3, kind: 'arrow' }), false, 'reported nowhere: refused');
  // C6: the same pose through both rooms
  const eve = s.peers.get('eve-0003');
  now += 1000;
  ws.receive({ t: 'pose', id: 'eve-0003', p: { ...pose, x: 50 } });
  const at = eve.at, from = { ...eve.from };
  now += 30;
  hw.receive({ t: 'pose', id: 'eve-0003', p: { ...pose, x: 50 } });
  assert.equal(eve.at, at, 'C6: the ease not restarted'); assert.deepEqual(eve.from, from); assert.equal(eve.seenAt, now, 'but seen');
  // the pool: a blow at my foe keyed to a cell I hold
  function craftCfg() { const b = new Uint8Array(74); const v = new DataView(b.buffer); b[10] = 0x08; v.setUint16(52, 4, true); const attrs = [40, 50, 50, 85, 50, 50, 90, 55]; for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true); return b; }
  function craftMonsterBsa(records) { const NAME_FIELD = 14, ENTRY = 18; const dataLen = records.reduce((a, [, b]) => a + b.length, 0); const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer); v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true); let pos = 4; for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; } for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; } return out; }
  const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
  const pe = { level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) };
  const pool = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n}`); }, getTexture: async () => ({ getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 }), uploadRecordFrame: () => {},
    currentMinute: () => 0, currentPixelKey: () => '3,12', playerEntity: pe, audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01, spellsByIndex: () => null,
  });
  pool.setNet({ room: () => 'world:3,12', inRoom: (k) => k === 'world:2,12', selfId: () => 'mac-0001', peers: () => [{ id: 'eve-0003', feet: [30, 0, 30], height: 1.8 }], now: () => 0, staleMs: 0, onPeerHit: (h, fate) => { fate?.sent?.(); return true; }, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]] });
  const rat = await pool.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  const h0 = rat.entity.health;
  assert.equal(pool.applyHit('eve-0003', { to: 'mac-0001', k: 'world:2,12', i: rat.seq, dmg: 1, kind: 'melee' }), true, 'C1/B6: keyed to the cell I just left (held as a halo): mine');
  assert.equal(rat.entity.health, h0 - 1);
  assert.equal(pool.applyHit('eve-0003', { to: 'mac-0001', k: 'world:9,9', i: rat.seq, dmg: 1, kind: 'melee' }), false, 'a cell I do not hold: not');
}));

test('AUDIT WORLD6b-iii(b) B9: the geometry\'s diagonal is the Chebyshev MAX (a min or a sum would open the corner cell three pixels off one edge and four off the other), and the y reach is the x reach', () => {
  assert.deepEqual(cellHaloFor(50, 195), ['world:2,12'], 'x 3 in, y 4 in: the left neighbour alone (the corner is max(3, 4) = 4 off)');
  assert.deepEqual(cellHaloFor(50, 194), ['world:2,11', 'world:3,11', 'world:2,12'], 'x 3 in, y 3 in: the corner too');
  assert.deepEqual(cellHaloFor(55, 194), ['world:3,11'], 'the top edge at three'); assert.deepEqual(cellHaloFor(55, 195), [], 'and at four');
  assert.deepEqual(cellHaloFor(55, 195, { current: ['world:3,11'] }), ['world:3,11'], 'held at four'); assert.deepEqual(cellHaloFor(55, 196, { current: ['world:3,11'] }), [], 'gone at five');
});

test('AUDIT WORLD6b-iii(b) by source: the world host joins a held cell at once and keeps the cell it stands in wanted (B1/B8), composes the look before a halo opens (C5), prunes only on an answer (C3/B5); the pool takes a blow keyed to a held cell (C1); the session\'s doors; the records', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /\(isCellRoom\(key\) && online\.inRoom\(key\)\) \|\| now - _onlineKeySince >= ROOM_HOLD_MS/, 'B1/B8: a held cell is joined at once');
  assert.match(w, /if \(mp && isCellRoom\(online\.room\) && isCellRoom\(key\) && key !== online\.room\) wantHalo\.push\(key\);/, 'B1: the cell stood in, wanted until the join');
  assert.match(w, /if \(wantHalo\.some\(\(r\) => !online\.haloRooms\(\)\.includes\(r\)\)\) online\.look = composeLook\(playerEntity\);/, 'C5');
  assert.match(w, /const ids = ownerIds\(\); if \(ids\) exteriorFoes\.pruneOwners\(ids, now\);/, 'C3/B5');
  const x = rd('src/scenes/exteriorFoes.js');
  assert.match(x, /if \(data\.k != null && _net\?\.room && data\.k !== _net\.room\(\) && !_net\.inRoom\?\.\(data\.k\)\) return false;[\s\S]{0,5000}?const f = foes\.find\(\(x\) => !x\.puppet && x\.seq === \(data\.i \| 0\)\) \?\? watchOf\(data\.i \| 0\);\s*const dmg = Number\(data\.dmg\);/, 'C1: applyHit (WORLD6b-iii(c): the take and the grant arms stand between; WATCH1: the number may name a watchman)');
  const o = rd('src/net/online.js');
  assert.match(o, /if \(h && h\.ws && h\.status === 'open' && this\._ws && isCellRoom\(room\) && isCellRoom\(this\.room\)\) \{/, 'A1: a live halo alone');
  assert.match(o, /const want = new Set\(isCellRoom\(this\.room\) && !this\.terminal \? /, 'A5: the room\'s life');
  assert.match(o, /if \(code === CLOSE_REPLACED \|\| code === CLOSE_POLICY\) \{ h\.ws = null; h\.status = 'terminal'; h\.retryAt = null; return; \}/, 'A2');
  assert.equal((o.match(/this\._endHalo\(\);/g) ?? []).length, 3, 'A4: leave and the two terminal closes');
  assert.doesNotMatch(o, /_holder\(|_heldElsewhere\(/, 'A9: the dead code is gone');
  assert.match(rd('bible/06-Systems/Online-Arc.md'), /## AUDIT WORLD6b-iii\(b\) \(2026-09-14\)/, 'the record');
});
