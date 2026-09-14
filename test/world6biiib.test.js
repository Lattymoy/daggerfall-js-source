// WORLD6b-iii(b) (Mac, 2026-09-14: "Continue" after AUDIT WORLD6b-iii(a)): THE CELL SEAM. D9 recorded it: two players
// a pixel apart astride a cell edge were in two rooms and never saw each other - the cell is sixteen pixels, the
// range three, so the seam was a strip three pixels wide on every edge. The HALO pays it: a player hellos into every
// neighbouring cell room whose nearest pixel is within the relay's range (one to three of them), poses into each
// (their fans range me by it, their rosters place me) and listens to each (a peer's roster, its foes, a blow at me),
// but STREAMS (foes, chat, a hit) through one room - by symmetry everyone within range of me is a member of my own
// cell's room, and a blow goes through the OWNER's cell (the room its frame was keyed to). A crossing PROMOTES the
// halo's socket in place (no close, no reconnect, no roster wiped, no puppet lost); the cell left steps down to a halo
// until it is out of range (a pixel of hysteresis keeps a player pacing the edge from churning sockets). No relay
// change: a halo member is a member. AUDIT WORLD6b-iii(b): a blow is struck where its owner is REPORTED (the frame's
// cell a preference), a crossing is joined the moment the cell is held, only a live halo is promoted.
//
// These pins EXECUTE the wire's geometry, the session over fake sockets, and the pool over a crafted MONSTER.BSA.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cellHaloFor, RANGE_PIXELS, WORLD_CELL } from '../src/net/wire.js';
import { OnlineSession } from '../src/net/online.js';
import { fakeSocketClass } from './fakeSocket.mjs';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('WORLD6b-iii(b): the wire - the halo is the neighbouring cells whose nearest pixel is within the range (Chebyshev, as the fan is): none mid-cell, one along an edge, three at a corner; a held room stays a pixel past the range (the hysteresis); no cell off the map; nothing for a pose that is not a number', () => {
  assert.equal(WORLD_CELL, 16); assert.equal(RANGE_PIXELS, 3);
  const cell = (x, y) => `world:${x},${y}`;
  assert.deepEqual(cellHaloFor(55, 200), [], 'mid-cell (3,12): none');
  assert.deepEqual(cellHaloFor(48, 200), [cell(2, 12)], 'the left edge pixel: the left neighbour a pixel away');
  assert.deepEqual(cellHaloFor(50, 200), [cell(2, 12)], 'three pixels in: still within the range');
  assert.deepEqual(cellHaloFor(51, 200), [], 'four in: out of it');
  assert.deepEqual(cellHaloFor(51, 200, { current: [cell(2, 12)] }), [cell(2, 12)], 'but a room held stays a pixel past it');
  assert.deepEqual(cellHaloFor(52, 200, { current: [cell(2, 12)] }), [], 'and goes two past it');
  assert.deepEqual(cellHaloFor(63, 200), [cell(4, 12)], 'the right edge pixel');
  assert.deepEqual(cellHaloFor(60, 207), [cell(3, 13)], 'the bottom edge');
  assert.deepEqual(cellHaloFor(48, 192), [cell(2, 11), cell(3, 11), cell(2, 12)], 'a corner: the three neighbours that touch it');
  assert.deepEqual(cellHaloFor(63, 207), [cell(4, 12), cell(3, 13), cell(4, 13)], 'the other corner');
  assert.deepEqual(cellHaloFor(0, 0), [], 'the map\'s corner: no cell below zero');
  assert.deepEqual(cellHaloFor(0, 200), [], 'the map\'s left edge: no cell below zero (mid-cell in y)');
  assert.deepEqual(cellHaloFor(NaN, 200), []); assert.deepEqual(cellHaloFor(48, undefined), []);
});

test('WORLD6b-iii(b): the session - a halo room is hello\'d into and posed into; its roster merges (a peer held by any room stays, gone from every room goes); a peer\'s foes and a blow at me arrive through it; foes and chat go through my own cell alone; a hit goes through the OWNER\'s cell; a crossing PROMOTES the halo\'s socket; a halo out of range is left; leave closes all; a halo that dropped is retried', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now });
  const foesIn = [], hitsIn = [], chats = [];
  s.onFoes = (id, data) => foesIn.push([id, data]); s.onHit = (id, data) => hitsIn.push([id, data]); s.onChat = (l) => chats.push(l);
  const info = console.info; const lines = []; console.info = (l) => lines.push(l);
  try {
    const pose = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 };
    const look = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };
    s.join('world:3,12', pose);
    const ws = sockets[0]; ws.open();
    ws.receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'bob-0002', name: 'Bob', look, pose }], host: null, world: null });
    assert.equal(s.haloRooms().length, 0);
    s.setHalo(['world:2,12', 'world:3,12', 'town:m1']);
    assert.deepEqual(s.haloRooms(), ['world:2,12'], 'my own cell and a non-cell are no halo');
    assert.equal(sockets.length, 2); const hw = sockets[1];
    assert.equal(hw.url, 'wss://relay.test/room/world:2,12', 'the halo\'s own room');
    assert.equal(s.inRoom('world:2,12'), false, 'not until it opens');
    hw.open();
    assert.equal(hw.sent[0], JSON.stringify({ t: 'hello', id: 'mac-0001', secret: 'secret-of-mac-0001', name: 'Mac', look: s.look, pose }), 'the hello, my pose in it');
    assert.equal(s.inRoom('world:2,12'), true); assert.equal(s.inRoom('world:3,12'), true); assert.equal(s.inRoom('world:9,9'), false);
    assert.equal(s.status, 'open', 'my own socket untouched'); assert.equal(s.room, 'world:3,12');
    hw.receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'eve-0003', name: 'Eve', look, pose }, { id: 'bob-0002', name: 'Bob', look, pose }], host: null, world: null });
    assert.deepEqual([...s.peers.keys()].sort(), ['bob-0002', 'eve-0003'], 'the rosters merge - Eve across the seam is a peer');
    // the pose goes to every room, the foes and the chat to my own
    now += 1000;
    assert.equal(s.sendPose({ ...pose, x: 5 }), true);
    assert.equal(ws.sent.at(-1), JSON.stringify({ t: 'pose', p: { ...pose, x: 5 } })); assert.equal(hw.sent.at(-1), JSON.stringify({ t: 'pose', p: { ...pose, x: 5 } }), 'the halo hears my pose');
    const foes = { n: 1, k: 'world:3,12', full: 1, f: [] };
    assert.equal(s.sendFoes(foes), true);
    assert.equal(ws.sent.at(-1), JSON.stringify({ t: 'foes', data: foes })); assert.equal(hw.sent.at(-1), JSON.stringify({ t: 'pose', p: { ...pose, x: 5 } }), 'no foes frame to the halo: my own cell\'s fan reaches everyone in range');
    assert.equal(s.sendChat('hello'), true);
    assert.equal(ws.sent.at(-1), JSON.stringify({ t: 'chat', text: 'hello' })); assert.equal(hw.sent.at(-1), JSON.stringify({ t: 'pose', p: { ...pose, x: 5 } }), 'nor a line');
    // Eve's foes and her foe's blow at me come through the halo
    const evesFoes = { n: 1, k: 'world:2,12', full: 1, f: [] };
    hw.receive({ t: 'foes', id: 'eve-0003', data: evesFoes });
    hw.receive({ t: 'hit', id: 'eve-0003', data: { to: 'mac-0001', k: 'world:3,12', i: 1, dmg: 2, kind: 'melee' } });
    assert.deepEqual(foesIn, [['eve-0003', evesFoes]]); assert.deepEqual(hitsIn, [['eve-0003', { to: 'mac-0001', k: 'world:3,12', i: 1, dmg: 2, kind: 'melee' }]]);
    hw.receive({ t: 'chat', id: 'eve-0003', name: 'Eve', text: 'hi', at: now });
    assert.equal(chats.length, 1, 'a line from across the seam');
    // a hit goes through the OWNER's cell
    now += 1000;
    assert.equal(s.sendHit({ to: 'eve-0003', k: 'world:2,12', i: 1, dmg: 3, kind: 'arrow' }), true, 'Eve\'s foe: through Eve\'s cell');
    assert.equal(hw.sent.at(-1), '{"t":"hit","data":{"to":"eve-0003","k":"world:2,12","i":1,"dmg":3,"kind":"arrow"}}');
    now += 1000;
    assert.equal(s.sendHit({ to: 'eve-0003', k: 'world:3,12', i: 1, dmg: 3, kind: 'arrow' }), true, 'keyed to my cell, where Eve is not reported: struck where she IS (AUDIT WORLD6b-iii(b) A3 - the key is a preference; a crossing made it stale for a foes interval)');
    assert.equal(hw.sent.at(-1), '{"t":"hit","data":{"to":"eve-0003","k":"world:3,12","i":1,"dmg":3,"kind":"arrow"}}', 'through her cell');
    now += 1000;
    assert.equal(s.sendHit({ to: 'eve-0003', k: 'world:9,9', i: 1, dmg: 3, kind: 'arrow' }), true, 'keyed to a cell I do not hold: the same');
    assert.equal(s.sendHit({ to: 'bob-0002', k: 'world:2,12', i: 1, dmg: 3, kind: 'arrow' }), true, 'Bob is in both: through the one the blow names');
    assert.equal(hw.sent.at(-1), '{"t":"hit","data":{"to":"bob-0002","k":"world:2,12","i":1,"dmg":3,"kind":"arrow"}}');
    // the roster: gone from one room, kept by the other
    hw.receive({ t: 'leave', id: 'bob-0002' });
    assert.equal(s.peers.has('bob-0002'), true, 'Bob left the halo room and my own still holds him');
    ws.receive({ t: 'leave', id: 'bob-0002' });
    assert.equal(s.peers.has('bob-0002'), false, 'gone from every room: gone');
    hw.receive({ t: 'join', id: 'ann-0004', name: 'Ann', look, pose });
    assert.equal(s.peers.has('ann-0004'), true, 'a join through the halo');
    hw.receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'eve-0003', name: 'Eve', look, pose }], host: null, world: null });
    assert.equal(s.peers.has('ann-0004'), false, 'a fresh roster from that room drops who it no longer names');
    // the crossing: the halo's socket is promoted, my old cell's steps down
    const sent = sockets.length, reconnects = s.stats.reconnects;
    s.join('world:2,12', pose);
    assert.equal(sockets.length, sent, 'no new socket'); assert.equal(s.stats.reconnects, reconnects);
    assert.equal(s.room, 'world:2,12'); assert.equal(s._ws, hw, 'the halo\'s socket is mine now'); assert.equal(s.status, 'open');
    assert.deepEqual(s.haloRooms(), ['world:3,12'], 'the cell left is a halo'); assert.equal(ws.closed, null, 'its socket still open');
    assert.equal(lines.at(-1), '[online] room world:2,12 - shared country (each player\'s foes are everyone\'s), crossed');
    assert.equal(s.peers.has('eve-0003'), true, 'nobody wiped');
    now += 1000;
    assert.equal(s.sendFoes({ n: 2, k: 'world:2,12', full: 1, f: [] }), true); assert.equal(hw.sent.at(-1), JSON.stringify({ t: 'foes', data: { n: 2, k: 'world:2,12', full: 1, f: [] } }), 'my foes go through the new cell');
    // out of range: the halo is left, its own peers with it
    s.setHalo([]);
    assert.deepEqual(s.haloRooms(), []); assert.deepEqual(ws.closed, { code: 1000, reason: 'leaving' });
    assert.equal(s.inRoom('world:3,12'), false); assert.equal(s.peers.has('eve-0003'), true, 'Eve is in my cell still');
    // a halo that drops is retried on the session's clock
    s.setHalo(['world:1,12']);
    const h2 = sockets.at(-1); h2.open(); h2.drop(1006);
    assert.equal(s.inRoom('world:1,12'), false); assert.deepEqual(s.haloRooms(), ['world:1,12'], 'still held - to be retried');
    const before = sockets.length;
    s.tick(); assert.equal(sockets.length, before, 'not yet');
    now += 60000; s.tick();
    assert.equal(sockets.length, before + 1, 'retried'); assert.equal(sockets.at(-1).url, 'wss://relay.test/room/world:1,12');
    // leave closes all
    s.leave();
    assert.equal(sockets.at(-1).closed?.code, 1000); assert.deepEqual(s.haloRooms(), []); assert.equal(s.peers.size, 0);
    // a halo is a cell's alone
    s.join('dungeon:m187', pose); sockets.at(-1).open();
    const n = sockets.length; s.setHalo(['world:2,12']); assert.equal(sockets.length, n, 'a dungeon holds no halo');
  } finally { console.info = info; }
});

test('WORLD6b-iii(b): the pool - a frame keyed to a cell I hold across the seam is its owner\'s cell (the puppet stands), one keyed to a cell I do not hold is not; my blow on that puppet is keyed to the OWNER\'s cell, not mine', async () => {
  function craftCfg() { const b = new Uint8Array(74); const v = new DataView(b.buffer); b[10] = 0x08; v.setUint16(52, 4, true); const attrs = [40, 50, 50, 85, 50, 50, 90, 55]; for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true); return b; }
  function craftMonsterBsa(records) { const NAME_FIELD = 14, ENTRY = 18; const dataLen = records.reduce((a, [, b]) => a + b.length, 0); const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer); v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true); let pos = 4; for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; } for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; } return out; }
  const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
  const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
  const pe = { level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) };
  const hits = [];
  const pool = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n}`); }, getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 0, currentPixelKey: () => '3,12', playerEntity: pe, audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01, spellsByIndex: () => null,
  });
  pool.setNet({ room: () => 'world:3,12', inRoom: (k) => k === 'world:2,12', selfId: () => 'mac-0001', peers: () => [{ id: 'eve-0003', feet: [30, 0, 30], height: 1.8 }], now: () => 0, staleMs: 0, onPeerHit: (h) => { hits.push(h); return true; }, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]] });
  const rec = { i: 5, t: 0, x: 0, f: [12, 0, 10], y: 0, h: 9, d: 0, a: 0, m: 0, g: '', l: 1, w: null, c: 0, s: 0 };
  assert.equal(pool.applyFoes('eve-0003', { n: 1, k: 'world:9,9', full: 1, f: [rec] }), false, 'a cell I do not hold is not the world');
  assert.equal(pool.applyFoes('eve-0003', { n: 1, k: 'world:2,12', full: 1, f: [rec] }), true, 'Eve\'s own cell, held across the seam: the world');
  await new Promise((r) => setTimeout(r, 0));
  const pup = pool.foes.find((f) => f.puppet === 'eve-0003');
  assert.ok(pup, 'her puppet stands');
  pool.damageFoe(pup, 5, [10, 0, 10]);
  assert.equal(hits.length, 1); assert.equal(hits[0].k, 'world:2,12', 'my blow is keyed to EVE\'s cell (her frame\'s), not mine'); assert.equal(hits[0].to, 'eve-0003');
  assert.equal(pool.applyHit('eve-0003', { to: 'mac-0001', k: 'world:2,12', i: 1, dmg: 1 }), false, 'a blow at MY foe keyed to another cell is not mine (my foes stream through my own)');
});

test('WORLD6b-iii(b): the world host by source - the halo held from the map pixel with the hysteresis, a cell crossing keeps the puppets, the pool told which cells I hold; the record', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const wantHalo = mp && isCellRoom\(online\.room\) \? cellHaloFor\(mp\.x, mp\.y, \{ current: online\.haloRooms\(\) \}\) : \[\];\s*\n\s*if \(mp && isCellRoom\(online\.room\) && isCellRoom\(key\) && key !== online\.room\) wantHalo\.push\(key\);[^\n]*\n\s*if \(wantHalo\.some\(\(r\) => !online\.haloRooms\(\)\.includes\(r\)\)\) online\.look = composeLook\(playerEntity\);[^\n]*\n\s*online\.setHalo\(wantHalo\);/, 'the halo, every frame, from the pixel the room is keyed by - the cell I stand in held until the join (AUDIT WORLD6b-iii(b) B1), the look composed before a halo opens (C5)');
  assert.match(w, /const seam = isCellRoom\(online\.room\) && isCellRoom\(_foesRoom\); _foesRoom = online\.room; _foesFullAt = -Infinity; if \(!seam\) exteriorFoes\.clearPuppets\(\);/, 'the seam keeps the puppets, and the new cell still hears every foe of mine at once');
  assert.match(w, /inRoom: \(k\) => online\?\.inRoom\?\.\(k\) \?\? false,/, 'the pool reads which cells I hold');
  const o = rd('src/net/online.js');
  assert.match(o, /if \(h && h\.ws && h\.status === 'open' && this\._ws && isCellRoom\(room\) && isCellRoom\(this\.room\)\) \{/, 'the promotion (AUDIT WORLD6b-iii(b) A1: a live halo alone)');
  assert.match(o, /for \(const r of \[k, this\.room, \.\.\.this\._halo\.keys\(\)\]\) if \(has\(r\) && sock\(r\)\) \{ via = sock\(r\); break; \}/, 'a hit through the owner\'s cell - the frame\'s first, then wherever it is reported (AUDIT WORLD6b-iii(b) A3)');
  assert.match(rd('bible/06-Systems/Online-Arc.md'), /### 6b-iii\(b\): the cell seam/, 'the record');
});
