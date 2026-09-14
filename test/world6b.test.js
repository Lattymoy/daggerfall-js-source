// WORLD6b (Mac, 2026-09-14: "Continue" after AUDIT WORLD6a): THE CELL STREAMS ITS FOES. The open country's room
// is a sixteen-pixel cell, nothing in it is a layout every client builds alike, and every foe was one client's
// roll - so a cell has no host and no memory, and A FOE IS ITS SPAWNER'S: the spawner steps it and streams it,
// everyone else in the cell puppets it, and a blow on another's foe goes to its OWNER as a hit (`to`). The relay
// fans a cell's foes frames from anyone hello'd and routes a cell's hit to the socket `to` names; the session
// streams from anyone in a cell and hears a blow that names it; the encounter pool stands a peer's foes as
// puppets, streams its own, and takes a peer's blow on its own through the one damage door. And the day's rolls
// are the shared day's: the price walk and the faction powers draw from a generator the world's day seeds.
//
// These pins EXECUTE: the relay's Room on the fake Durable Object, the session on the fake socket, the encounter
// pool on a crafted MONSTER.BSA (a rat's career) with the net installed, the day change under the shared clock.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isCellRoom, streamsFoes, hitOwnerOf, isWorldRoom, PIXEL_UNITS, MAX_FRAME_BYTES, FOES_PREFIX } from '../src/net/wire.js';
import * as relay from '../server/src/relay.js';
import { RELAY_VERSION } from '../server/src/index.js';
import { OnlineSession } from '../src/net/online.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { createExteriorFoes, MAX_ACTIVE_ENCOUNTER_FOES } from '../src/scenes/exteriorFoes.js';
import { runDayChange, dayRollsFor, setSharedClock, sharedClockOn, MINUTES_PER_DAY } from '../src/systems/worldTick.js';
import { seededRng } from '../src/systems/wind.js';
import { MERCHANTS_FACTION_ID } from '../src/systems/guilds.js';
import { FACTION_TYPES } from '../src/formats/factionFile.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);

test('WORLD6b: the wire - a cell is world:<x>,<y> alone (no dungeon, no building, no town, no fourth digit, no third number), at both ends; a room streams foes when it is a world room or a cell; a hit\'s owner is its `to`, a peer id of at most 64, or nothing', () => {
  for (const k of ['world:3,12', 'world:0,0', 'world:999,999']) { assert.equal(isCellRoom(k), true, k); assert.equal(streamsFoes(k), true, k); assert.equal(isWorldRoom(k), false, `${k} is no world room: no host, no memory`); }
  for (const k of ['world:3', 'world:3,12,1', 'world:1234,1', 'world:1,1234', 'world:-1,1', 'world:a,1', 'dungeon:m187', 'interior:m187.4', 'town:m9', 'chat:global', '', null, undefined, 3]) assert.equal(isCellRoom(k), false, String(k));
  assert.equal(streamsFoes('dungeon:m187'), true); assert.equal(streamsFoes('interior:m187.4'), true, 'a building is a world room (WORLD6a) and streams its foes by law, though its pool streams none yet'); assert.equal(streamsFoes('town:m9'), false);
  assert.equal(hitOwnerOf({ to: 'bbbb-0002' }), 'bbbb-0002'); assert.equal(hitOwnerOf({ to: 'x'.repeat(40) }), 'x'.repeat(40), 'the wire\'s own id law (AUDIT WORLD6b A5: ID_RE, 4 to 40 of [A-Za-z0-9_-])');
  for (const d of [{ to: '' }, { to: 'a' }, { to: 'x'.repeat(41) }, { to: 'bbbb 0002' }, { to: 7 }, { to: null }, {}, null, undefined, 'bbbb-0002', ['bbbb-0002']]) assert.equal(hitOwnerOf(d), null, JSON.stringify(d));
  assert.equal(relay.isCellRoom, isCellRoom, 'one home at both ends'); assert.equal(relay.hitOwnerOf, hitOwnerOf); assert.equal(relay.streamsFoes, streamsFoes);
  assert.equal(RELAY_VERSION, 'world66', 'the relay says which one it is');
});

test('WORLD6b: the Room - in a cell ANYONE hello\'d streams foes (prefixed or not, no host asked, no strike counted) and everyone else hears it with the sender\'s id; a hit goes to the socket `to` names alone - never to the striker, nowhere without a `to` or to one not in the room; a cell keeps no memory (a world frame is refused as too large); the dungeon\'s law is untouched', async () => {
  const r = fakeRoom('world:3,12');
  const a = r.connect(), b = r.connect(), c = r.connect();
  await r.hello(a, 'aaaa-0001', at(1, 1)); await r.hello(b, 'bbbb-0002', at(1, 1)); await r.hello(c, 'cccc-0003', at(1, 1));
  // the relay seats a host in every room (ONLINE1's election, the presence roster's); a cell never asks it
  const foesB = { n: 1, k: 'world:3,12', full: 1, f: [{ i: 1, t: 0, x: 0, f: [10, 0, 10], y: 1, h: 5, d: 0, a: 0, m: 0 }] };
  await r.raw(b, JSON.stringify({ t: 'foes', data: foesB }));
  assert.deepEqual(ofType(a, 'foes'), [{ t: 'foes', id: 'bbbb-0002', data: foesB }], 'a non-host\'s stream, with its id');
  assert.deepEqual(ofType(c, 'foes'), [{ t: 'foes', id: 'bbbb-0002', data: foesB }]); assert.equal(ofType(b, 'foes').length, 0, 'never back to the sender');
  const foesC = { n: 1, k: 'world:3,12', full: 0, f: [{ i: 1, t: 3, x: 1, f: [12, 0, 12], y: 0, h: 9, d: 0, a: 0, m: 1 }] };
  await r.raw(c, JSON.stringify({ t: 'foes', data: foesC }));
  assert.deepEqual(ofType(a, 'foes').at(-1), { t: 'foes', id: 'cccc-0003', data: foesC }, 'and a second spawner\'s, each its own');
  assert.deepEqual(ofType(b, 'foes').at(-1), { t: 'foes', id: 'cccc-0003', data: foesC });
  const big = { n: 2, f: [], pad: 'p'.repeat(MAX_FRAME_BYTES * 2) };   // AUDIT WORLD6b B3: a cell's frame carries its roll (bounded) or it is junk
  await r.raw(b, JSON.stringify({ t: 'foes', data: big }));
  assert.deepEqual(ofType(a, 'foes').at(-1).data, big, 'a frame past the small cap goes by its prefix, from anyone');
  assert.equal(b.att.junk ?? 0, 0, 'no strike counted against a cell\'s spawner'); assert.equal(b.closed, null); assert.equal(ofType(b, 'error').length, 0);
  // the hit: to its owner alone
  const hit = { to: 'cccc-0003', i: 1, dmg: 4, kind: 'melee' };
  await r.raw(a, JSON.stringify({ t: 'hit', data: hit }));
  assert.deepEqual(ofType(c, 'hit'), [{ t: 'hit', id: 'aaaa-0001', data: hit }], 'the owner hears the blow with the striker\'s id');
  assert.equal(ofType(b, 'hit').length, 0, 'no one else'); assert.equal(ofType(a, 'hit').length, 0, 'not the striker');
  await r.raw(c, JSON.stringify({ t: 'hit', data: hit }));
  assert.equal(ofType(c, 'hit').length, 1, 'a blow naming the striker goes nowhere: the owner applies its own');
  await r.raw(a, JSON.stringify({ t: 'hit', data: { i: 1, dmg: 4, kind: 'melee' } }));
  await r.raw(a, JSON.stringify({ t: 'hit', data: { to: 'zzzz-0009', i: 1, dmg: 4, kind: 'melee' } }));
  await r.raw(a, JSON.stringify({ t: 'hit', data: { to: 'x'.repeat(65), i: 1, dmg: 4, kind: 'melee' } }));
  assert.equal(ofType(a, 'hit').length + ofType(b, 'hit').length + ofType(c, 'hit').length, 1, 'no `to`, a `to` not in the room, a `to` past the law: nowhere');
  assert.equal(a.closed, null, 'and no one is struck for it');
  // no memory: a cell is no world room
  await r.raw(b, JSON.stringify({ t: 'world', data: { pad: 'w'.repeat(MAX_FRAME_BYTES * 2) } }));
  assert.equal(b.closed?.reason ?? ofType(b, 'error').at(-1)?.error ?? null, 'frame too large', 'a large frame outside a world room is refused (AUDIT WORLD A1)');
  assert.equal([...r.store.keys()].some((k) => k.startsWith('world')), false, `the cell keeps no memory (the store holds the roster's looks and secrets alone): ${[...r.store.keys()].join(' ')}`);
  // the dungeon's law: the host's stream alone, the hit to the host, `to` ignored
  const d = fakeRoom('dungeon:m187');
  const h = d.connect(), j = d.connect(), k = d.connect();
  await d.hello(h, 'host-0001', at(1, 1)); await d.hello(j, 'join-0002', at(1, 1)); await d.hello(k, 'join-0003', at(1, 1));
  await d.raw(j, JSON.stringify({ t: 'foes', data: foesB })); await d.raw(j, FOES_PREFIX + 'x'.repeat(MAX_FRAME_BYTES * 2));
  assert.equal(ofType(h, 'foes').length + ofType(k, 'foes').length, 0, 'a joiner\'s stream reaches no one in a dungeon');
  assert.equal(j.att.junk, 2, 'and is counted (AUDIT WORLD2 A4)');
  await d.raw(j, JSON.stringify({ t: 'hit', data: { to: 'join-0003', i: 1, dmg: 4, kind: 'melee' } }));
  assert.deepEqual(ofType(h, 'hit').map((m) => m.id), ['join-0002'], 'a dungeon\'s hit goes to the host, whatever `to` says'); assert.equal(ofType(k, 'hit').length, 0);
});

test('WORLD6b: the session - in a cell sendFoes is anyone\'s (no host, no seat) and sendHit needs a `to` that is a peer, never me; onFoes hears every peer (never myself, never a malformed frame); onHit hears a blow that names me and no other; a world room keeps WORLD2\'s law', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now });
  const foesIn = [], hitsIn = [];
  s.onFoes = (id, data) => foesIn.push([id, data]); s.onHit = (id, data) => hitsIn.push([id, data]);
  const info = console.info; const lines = []; console.info = (l) => lines.push(l);
  try {
    s.join('world:3,12', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 });
    const ws = sockets[0]; ws.open();
    ws.receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'bob-0002', name: 'Bob', look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, pose: { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 } }], host: null, world: null });
    assert.equal(lines.at(-1), '[online] room world:3,12 - shared country (each player\'s foes are everyone\'s)', 'the room says what it shares');
    const foes = { n: 1, k: 'world:3,12', full: 1, f: [] };
    assert.equal(s.isHost(), false); assert.equal(s.sendFoes(foes), true, 'no host, and I stream'); assert.equal(ws.sent.at(-1), JSON.stringify({ t: 'foes', data: foes }));
    assert.equal(s.sendHit({ i: 1, dmg: 3, kind: 'arrow' }), false, 'a blow with no owner goes nowhere');
    assert.equal(s.sendHit({ to: 'mac-0001', i: 1, dmg: 3, kind: 'arrow' }), false, 'nor one naming me: my foe is my own door\'s');
    now += 1000;
    assert.equal(s.sendHit({ to: 'bob-0002', i: 1, dmg: 3, kind: 'arrow' }), true, 'a blow on Bob\'s foe goes to Bob');
    assert.equal(ws.sent.at(-1), '{"t":"hit","data":{"to":"bob-0002","i":1,"dmg":3,"kind":"arrow"}}', 'the owner rides the frame');
    ws.receive({ t: 'foes', id: 'bob-0002', data: foes });
    ws.receive({ t: 'foes', id: 'eve-0003', data: foes });
    ws.receive({ t: 'foes', id: 'mac-0001', data: foes }); ws.receive({ t: 'foes', id: 'bob-0002', data: [1] }); ws.receive({ t: 'foes', data: foes });
    assert.deepEqual(foesIn, [['bob-0002', foes]], 'every peer\'s stream is the world - a peer the roster holds (AUDIT WORLD6b A8: Eve is a stranger past the roster); my own, a malformed one, an unnamed one are not');
    ws.receive({ t: 'hit', id: 'bob-0002', data: { to: 'mac-0001', i: 1, dmg: 2, kind: 'melee' } });
    ws.receive({ t: 'hit', id: 'bob-0002', data: { to: 'eve-0003', i: 1, dmg: 2, kind: 'melee' } });
    ws.receive({ t: 'hit', id: 'bob-0002', data: { i: 1, dmg: 2, kind: 'melee' } });
    ws.receive({ t: 'hit', id: 'mac-0001', data: { to: 'mac-0001', i: 1, dmg: 2, kind: 'melee' } });
    assert.deepEqual(hitsIn, [['bob-0002', { to: 'mac-0001', i: 1, dmg: 2, kind: 'melee' }]], 'a blow that names me is mine to apply; one for another, one unnamed, one from myself are not');
    // a world room: WORLD2's law, the seat's
    s.leave(); s.join('dungeon:m187', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 });
    const ws2 = sockets[1]; ws2.open();
    ws2.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: 'bob-0002', world: null });
    assert.equal(s.sendFoes(foes), false, 'not the host: no stream');
    now += 1000;
    assert.equal(s.sendHit({ i: 1, dmg: 3, kind: 'arrow' }), true, 'a blow goes to the host with no `to` asked');
    ws2.receive({ t: 'foes', id: 'eve-0003', data: foes });
    assert.equal(foesIn.length, 1, 'a peer\'s frame is not the world in a dungeon');
    ws2.receive({ t: 'hit', id: 'eve-0003', data: { to: 'mac-0001', i: 1, dmg: 2, kind: 'melee' } });
    assert.equal(hitsIn.length, 1, 'not hosting: no blow is mine, whatever `to` says');
  } finally { console.info = info; }
});

// ---- the encounter pool on a crafted MONSTER.BSA ----------------------------------------------------------------
function craftCfg({ hpPerLevel = 4, speed = 90, str = 40, agi = 85, luck = 55, atkFlags = 0x08 } = {}) {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = atkFlags; v.setUint16(52, hpPerLevel, true);
  const attrs = [str, 50, 50, agi, 50, 50, speed, luck];
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true);
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()], ['ENEMY003.CFG', craftCfg({ speed: 60 })]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const settle = () => new Promise((r) => setTimeout(r, 0));
const poolRig = (extra = {}) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
  getTexture: async () => stubTex,
  uploadRecordFrame: () => {},
  currentMinute: () => 0,
  currentPixelKey: () => '3,12',
  playerEntity: { level: 1, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50 } },
  audio: null,
  onPlayerHurt: () => {},
  rolls: () => 0.5,
  rand: () => 0.5,
  ...extra,
});
/** The world host's net, with identity converters (the pin's scene IS the world frame). */
const netFor = (hits, room = 'world:3,12') => ({ selfId: () => 'mac-0001', room: () => room, onPeerHit: (h) => { hits.push(h); return true; }, toWire: (feet) => [feet[0], feet[1], feet[2]], toScene: (p) => [p[0], p[1], p[2]] });
const mine = (pool) => pool.foes.filter((f) => !f.puppet);
const puppets = (pool) => pool.foes.filter((f) => !!f.puppet);

test('WORLD6b: the pool streams MINE - numbered from one, every changed foe (every one when full), the record WORLD2\'s (species, gender bit, feet through the wire converter, yaw, health, dead, the attack count, moving), keyed to the room; nothing without the net; a puppet and a quest\'s foe never ride', async () => {
  const hits = [];
  const pool = createExteriorFoes(poolRig());
  assert.equal(pool.foesFrame(true), null, 'no net installed: nothing streams');
  pool.setNet(netFor(hits));
  const rat = await pool.spawnFoe(0, [10, 0, 10], { yaw: 1.5, feetGiven: true });
  assert.ok(rat, 'the rat stands on the crafted career'); assert.equal(rat.seq, 1, 'mine, numbered from one'); assert.equal(rat.puppet, null);
  const f1 = pool.foesFrame(false);
  assert.deepEqual(f1, { n: 1, k: 'world:3,12', full: 0, f: [{ i: 1, t: 0, x: rat.gender === 'female' ? 1 : 0, f: [10, 0, 10], y: 1.5, h: rat.entity.health, d: 0, a: 0, b: '', m: 0, g: '', l: rat.entity.level | 0, w: null, c: 0, s: 0, u: '', o: 0 }] }, 'the first frame carries the rat (WORLD6b-ii: and its target - none yet, AUDIT WORLD6b-ii A8; its level and no weapon, B2; WORLD6b-iii: no cast yet; AUDIT WORLD6b-iii(a) A3: no blow and no cast at anyone yet)');
  assert.equal(pool.foesFrame(false), null, 'nothing changed: nothing goes');
  const full = pool.foesFrame(true);
  assert.equal(full.n, 2); assert.equal(full.full, 1); assert.equal(full.f.length, 1, 'a full frame carries every foe of mine');
  rat.entity.health -= 2;
  assert.deepEqual(pool.foesFrame(false).f.map((r) => [r.i, r.h]), [[1, rat.entity.health]], 'a health change rides the delta');
  const bear = await pool.spawnFoe(3, [20, 0, 20], { feetGiven: true });
  assert.equal(bear.seq, 2, 'the next of mine is two');
  assert.deepEqual(pool.foesFrame(false).f.map((r) => r.i), [2], 'the new foe alone changed');
  // a quest's foe never rides, a puppet never rides
  bear.questBehaviour = { update() {} };   // isQuestFoe reads the behaviour (B1)
  assert.deepEqual(pool.foesFrame(true).f.map((r) => r.i), [1], 'the quest owner\'s foe is the quest owner\'s alone (Multiplayer.md\'s first lock)');
  bear.questBehaviour = null;
  assert.equal(pool.applyFoes('bob-0002', { n: 1, k: 'world:3,12', full: 1, f: [{ i: 7, t: 0, x: 1, f: [30, 0, 30], y: 0.5, h: 6, d: 0, a: 0, m: 0 }] }), true);
  await settle();
  assert.equal(puppets(pool).length, 1, 'Bob\'s rat stands here as a puppet');
  assert.deepEqual(pool.foesFrame(true).f.map((r) => r.i).sort(), [1, 2], 'and never rides my frame');
  assert.deepEqual(pool.snapshotWorld((feet) => ({ x: feet[0], z: feet[2] })).map((s) => s.mobileType), [0, 3], 'nor my save');
});

test('WORLD6b: the pool stands a peer\'s foes as PUPPETS - through the one spawn chain at the streamed feet, species and gender, outside my cap; a frame older than the owner\'s last, or another cell\'s, is not the world; the puppet follows the stream (eased, a far jump snapped, the hurt one-shot on a health drop, the strike edge once per count with its ranged bit), lands no blow of its own, dies where the stream says and is swept when a full frame stops naming it, its owner leaves, or the room changes', async () => {
  const hits = [];
  const pool = createExteriorFoes(poolRig());
  pool.setNet(netFor(hits));
  assert.equal(pool.applyFoes('bob-0002', { n: 1, k: 'world:4,4', full: 1, f: [{ i: 1, t: 0, x: 0, f: [1, 0, 1] }] }), false, 'another cell\'s frame');
  assert.equal(pool.applyFoes('', { n: 1, f: [] }), false); assert.equal(pool.applyFoes('bob-0002', { n: 1 }), false); assert.equal(pool.applyFoes('bob-0002', null), false);
  const rec = { i: 5, t: 0, x: 1, f: [20, 0, 20], y: 1, h: 9, d: 0, a: 0, m: 0 };
  assert.equal(pool.applyFoes('bob-0002', { n: 3, k: 'world:3,12', full: 1, f: [rec, { i: 6, t: 0, x: 0, d: 1, f: [1, 0, 1] }, { i: 9, t: 99999, x: 0, f: [1, 0, 1] }, { i: -1, t: 0 }, null] }), true);
  assert.equal(pool.applyFoes('bob-0002', { n: 3, k: 'world:3,12', full: 0, f: [rec] }), false, 'a frame no newer than the last is not the world');
  assert.equal(pool.applyFoes('bob-0002', { n: 2, k: 'world:3,12', full: 0, f: [rec] }), false);
  await settle();
  const p = puppets(pool);
  assert.equal(p.length, 1, 'one puppet: a corpse never seen, an unknown species and a bad number stand nothing');
  const pup = p[0];
  assert.equal(pup.puppet, 'bob-0002'); assert.equal(pup.seq, 5); assert.equal(pup.gender, 'female', 'the stream\'s gender bit, decoded, no roll'); assert.equal(pup.mobileType, 0);
  assert.deepEqual(pup.ai.feet, [20, 0, 20], 'at the streamed feet'); assert.equal(pup.ai.yaw, 1); assert.equal(pup.entity.health, 9, 'the streamed health');
  assert.equal(pool.activeCount(), 0, 'a puppet is not my cap\'s');
  // the cap: puppets stand past it
  for (let i = 0; i < MAX_ACTIVE_ENCOUNTER_FOES; i++) pool.foes.push({ mobileType: 0, dead: false, ai: { feet: [0, 0, 0], height: 1.8 }, entity: {}, seq: 100 + i });
  assert.equal(pool.activeCount(), MAX_ACTIVE_ENCOUNTER_FOES);
  assert.equal(await pool.spawnFoe(0, [1, 0, 1]), null, 'my own is refused at the cap');
  pool.applyFoes('bob-0002', { n: 4, k: 'world:3,12', full: 0, f: [{ i: 8, t: 0, x: 0, f: [25, 0, 25], y: 0, h: 9, d: 0, a: 0, m: 0 }] });
  await settle();
  assert.equal(puppets(pool).length, 2, 'a peer\'s stands past it');
  pool.foes.splice(pool.foes.findIndex((f) => f.seq === 100), MAX_ACTIVE_ENCOUNTER_FOES);
  // the stream moves it: eased, then snapped
  pool.applyFoes('bob-0002', { n: 5, k: 'world:3,12', full: 0, f: [{ i: 5, f: [21, 0, 20], y: 2, h: 5, m: 1 }] });
  pool.update(0.05, [0, 0, 0], [0, 1.6, 0]);
  assert.ok(pup.ai.feet[0] > 20 && pup.ai.feet[0] < 21, `eased toward the streamed feet: ${pup.ai.feet[0]}`); assert.equal(pup.ai.yaw, 2, 'the yaw set');
  assert.equal(pup.ai.moving, true, 'walking'); assert.equal(pup.entity.health, 5); assert.equal(pup._pup.hurt, false, 'the hurt one-shot fired and cleared');
  pool.update(0.05, [0, 0, 0], [0, 1.6, 0]);
  assert.equal(pup.ai.hurtKnock, false, 'once');
  pool.applyFoes('bob-0002', { n: 6, k: 'world:3,12', full: 0, f: [{ i: 5, f: [40, 0, 40], m: 0 }] });
  pool.update(0.05, [0, 0, 0], [0, 1.6, 0]);
  assert.deepEqual(pup.ai.feet, [40, 0, 40], 'a far jump snaps');
  pool.update(0.05, [0, 0, 0], [0, 1.6, 0]);
  assert.equal(pup.ai.moving, false, 'and stands still');
  // the strike edge: once per count, the ranged bit low
  pool.applyFoes('bob-0002', { n: 7, k: 'world:3,12', full: 0, f: [{ i: 5, a: 2 }] });
  pool.update(0.05, [0, 0, 0], [0, 1.6, 0]);
  assert.equal(pup.attack.firedRanged, false, 'a melee strike'); assert.equal(pup._pup.strike, null, 'consumed');
  pool.applyFoes('bob-0002', { n: 8, k: 'world:3,12', full: 0, f: [{ i: 5, a: 5 }] });
  pool.update(0.05, [0, 0, 0], [0, 1.6, 0]);
  assert.equal(pup.attack.firedRanged, true, 'a ranged one');
  assert.equal(pup.mobile.doMeleeDamage, false, 'no blow of its own'); assert.equal(pup.mobile.shootArrow, false);
  // a blow on a puppet goes to its owner, not into its health
  pool.damageFoe(pup, 4, [0, 0, 0], null, { kind: 'arrow' });
  assert.deepEqual(hits, [{ to: 'bob-0002', k: 'world:3,12', i: 5, dmg: 4, kind: 'arrow', p: [0, 0, 0], ar: 1 }], 'to Bob, with Bob\'s number and the kind, keyed to the cell (AUDIT WORLD6b A7), the striker\'s feet on it (WORLD6b-ii), the shaft (WORLD6b-iii(e))'); assert.equal(pup.entity.health, 5, 'my blow lands nothing here');
  // death by the stream, the body where it fell
  pool.applyFoes('bob-0002', { n: 9, k: 'world:3,12', full: 0, f: [{ i: 5, f: [41, 0, 41], d: 1 }] });
  assert.equal(pup.dead, true); assert.equal(pup.corpse, true); assert.deepEqual(pup.ai.feet, [41, 0, 41], 'where the stream let it fall');
  assert.equal(pool.lootTargets().some((t) => t.f === pup), false, 'its body carries none of my loot (recorded)');
  pool.update(0.05, [0, 0, 0], [0, 1.6, 0]);
  assert.ok(pool.foes.includes(pup), 'a corpse stays');
  pool.applyFoes('bob-0002', { n: 10, k: 'world:3,12', full: 1, f: [{ i: 8, t: 0, x: 0, f: [25, 0, 25], y: 0, h: 9, d: 0, a: 0, m: 0 }] });
  pool.update(0.05, [0, 0, 0], [0, 1.6, 0]);
  assert.equal(pool.foes.includes(pup), false, 'a full frame that stops naming it sweeps it'); assert.equal(puppets(pool).length, 1);
  pool.pruneOwners(new Set(['eve-0003']));
  pool.update(0.05, [0, 0, 0], [0, 1.6, 0]);
  assert.equal(puppets(pool).length, 0, 'an owner gone from the room takes its puppets');
  pool.applyFoes('eve-0003', { n: 1, k: 'world:3,12', full: 1, f: [{ i: 1, t: 0, x: 0, f: [2, 0, 2], y: 0, h: 9, d: 0, a: 0, m: 0 }] });
  await settle();
  assert.equal(puppets(pool).length, 1);
  pool.clearPuppets();
  pool.update(0.05, [0, 0, 0], [0, 1.6, 0]);
  assert.equal(puppets(pool).length, 0, 'a room change leaves every puppet behind');
  assert.equal(pool.applyFoes('bob-0002', { n: 1, k: 'world:3,12', full: 1, f: [] }), true, 'and Bob\'s numbers start over in the new cell');
});

test('WORLD6b: a peer\'s blow on MY foe lands through the one damage door - by my number, the kind kept, bounded; a puppet\'s number, an unknown one, a dead foe, a blow past the bound are refused; the foe turns on me (its owner) and the area does not wake for a peer\'s blow', async () => {
  const hits = [];
  let woke = 0;
  const pool = createExteriorFoes(poolRig({ makeAreaHostile: () => { woke++; } }));
  pool.setNet(netFor(hits));
  const rat = await pool.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  rat.ai.isHostile = false; rat.ai.target = null;
  const h0 = rat.entity.health;
  assert.equal(pool.applyHit('bob-0002', { i: 1, dmg: 3, kind: 'arrow' }), true);
  assert.equal(rat.entity.health, h0 - 3, 'the blow landed'); assert.equal(woke, 0, 'a peer\'s blow wakes no area (AUDIT WORLD2 B9\'s law)');
  assert.equal(rat.ai.target, null, 'AUDIT WORLD6b-ii A3: a peer\'s blow names no target of mine - with no candidate for the striker the foe wakes and the next machine pass picks'); assert.ok(rat.ai.giveUpTimer > 0, 'woken');
  assert.equal(pool.applyHit('bob-0002', { i: 1, dmg: 0, kind: 'melee' }), true, 'a zero blow is a blow');
  assert.equal(pool.applyHit('bob-0002', { i: 2, dmg: 3 }), false, 'no foe of mine numbered two');
  assert.equal(pool.applyHit('bob-0002', { i: 1, dmg: 10001 }), false, 'past the bound'); assert.equal(pool.applyHit('bob-0002', { i: 1, dmg: -1 }), false); assert.equal(pool.applyHit('bob-0002', { i: 1, dmg: 'x' }), false); assert.equal(pool.applyHit('bob-0002', null), false);
  pool.applyFoes('eve-0003', { n: 1, k: 'world:3,12', full: 1, f: [{ i: 1, t: 0, x: 0, f: [20, 0, 20], y: 0, h: 9, d: 0, a: 0, m: 0 }] });
  await settle();
  const pup = puppets(pool)[0];
  assert.equal(pool.applyHit('bob-0002', { i: 1, dmg: 3 }), true, 'MY number one, not Eve\'s'); assert.equal(pup.entity.health, 9, 'Eve\'s puppet is untouched');
  rat.entity.health = 1;
  assert.equal(pool.applyHit('bob-0002', { i: 1, dmg: 5 }), true);
  assert.equal(rat.dead, true, 'and a peer\'s blow kills through the one door'); assert.equal(rat.corpse, true);
  assert.equal(pool.applyHit('bob-0002', { i: 1, dmg: 5 }), false, 'a dead foe takes none');
  assert.deepEqual(pool.foesFrame(true).f.map((r) => [r.i, r.d]), [[1, 1]], 'the next frame says so');
});

test('WORLD6b: the day\'s rolls are the shared day\'s - under the shared clock the price walk and the powers draw from a generator the world\'s day seeds (two players whose state agrees walk alike, whatever their own dice); offline the caller\'s dice; the state stays each player\'s', () => {
  const day = 40;
  assert.equal(sharedClockOn(), false);
  assert.equal(dayRollsFor(day * MINUTES_PER_DAY, Math.random), Math.random, 'offline: the caller\'s own');
  const dict = () => new Map([[MERCHANTS_FACTION_ID, { id: MERCHANTS_FACTION_ID, type: FACTION_TYPES.Group, region: -1, power: 50 }], [9000, { id: 9000, type: FACTION_TYPES.Province, region: 0, power: 50 }]]);
  const price = (rolls) => { const e = { regionPrices: { 0: 1000 }, factionRep: { dict: dict() } }; runDayChange({ entity: e, lastMinutes: (day - 1) * MINUTES_PER_DAY, nowMinutes: day * MINUTES_PER_DAY, rolls }); return e.regionPrices[0]; };
  const up = price(() => 0.99), down = price(() => 0.01);
  assert.notEqual(up, down, 'offline the dice decide the walk');
  try {
    setSharedClock(() => day * MINUTES_PER_DAY);
    const a = dayRollsFor(day * MINUTES_PER_DAY, Math.random), b = dayRollsFor(day * MINUTES_PER_DAY + 500, Math.random);
    assert.notEqual(a, Math.random, 'online: the day\'s generator');
    assert.deepEqual([a(), a(), a()], [b(), b(), b()], 'one day, one sequence, any minute of it');
    const c = dayRollsFor((day + 1) * MINUTES_PER_DAY, Math.random);
    assert.notEqual(a(), c(), 'another day, another sequence');
    const s1 = price(() => 0.99), s2 = price(() => 0.01);
    assert.equal(s1, s2, 'two players with the same state, whatever their dice, walk the region alike');
    const expect = seededRng((((day * 7919) ^ 0x44415953) ^ Math.imul(1, 0x9E3779B1)) >>> 0);   // AUDIT WORLD6b C5: the prices' salt
    const e = { regionPrices: { 0: 1000 }, factionRep: { dict: dict() } };
    runDayChange({ entity: e, lastMinutes: (day - 1) * MINUTES_PER_DAY, nowMinutes: day * MINUTES_PER_DAY, rolls: expect });
    assert.equal(e.regionPrices[0], s1, 'and the seed is the day\'s');
  } finally { setSharedClock(null); }
  const w = rd('src/systems/worldTick.js');
  assert.match(w, /if \(sharedClockOn\(\)\) \{\s*const firstDay = Math\.floor\(lastMinutes \/ MINUTES_PER_DAY\) \+ 1, lastDay = Math\.floor\(nowMinutes \/ MINUTES_PER_DAY\);\s*for \(let d = firstDay; d <= lastDay; d\+\+\) updateRegionalPrices\(entity, entity\.factionRep\?\.dict \?\? null, 1, dayRollsFor\(d \* MINUTES_PER_DAY, rolls, DAY_SALT\.prices\), entity\.regionConditions \?\? null\);/, 'the day change walks one day at a time online, each from its own generator (AUDIT WORLD6b C4)');
  assert.match(w, /const dayRolls = dayRollsFor\(i, rolls, DAY_SALT\.powers\);\s*if \(i % FACTION_POWER_INTERVAL_MINUTES === 0\) \{\s*regionPowerUpdate\(entity\.factionRep \?\? null, \{ rumorMill: entity\.rumorMill \?\? null, rolls: dayRolls \}\);/, 'the powers\' 7-day arm reads the minute\'s day');
  assert.match(w, /rumorMill: entity\.rumorMill \?\? null, rolls: dayRolls,[^\n]*\n\s*updateConditions: true/, 'and the 38-day arm the same generator');
});

test('WORLD6b: the world host by source - the stream\'s cell arm is everyone\'s and the exterior pool\'s frame; a cell\'s foes and hits route to the pool, a world room\'s to the dungeon; the net installed with the world frame\'s converters; a room change clears the puppets and a gone peer takes its own; the pane says what a cell shares', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const cell = isCellRoom\(online\.room\);\s*if \(!cell && \(!online\.isHost\(\) \|\| !isWorldRoom\(online\.room\)\)\) return false;/, 'the cell arm asks no seat');
  assert.match(w, /const frame = cell \? \(\(modes\?\.mode \?\? 'exterior'\) === 'exterior' \? exteriorFoes\.foesFrame\(full\) : null\) : modes\?\.dungeonFoesFrame\?\.\(full\);/, 'the exterior pool\'s frame, above ground alone');
  assert.match(w, /if \(isCellRoom\(online\.room\)\) \{ if \(\(modes\?\.mode \?\? 'exterior'\) === 'exterior'\) exteriorFoes\.applyFoes\(id, data\); return; \}/, 'a cell\'s frame is the pool\'s, never a dungeon heartbeat');
  assert.match(w, /online\.onHit = \(id, data\) => \{ if \(isCellRoom\(online\.room\)\) exteriorFoes\.applyHit\(id, data\); else modes\?\.applyDungeonHit\?\.\(id, data\); \};/);
  assert.match(w, /exteriorFoes\.setNet\(\{\s*room: \(\) => online\?\.room \?\? null,\s*inRoom: \(k\) => online\?\.inRoom\?\.\(k\) \?\? false,[^\n]*\n\s*selfId: \(\) => online\?\.id \?\? null,[^\n]*\n\s*peers: peersNear,[^\n]*\n\s*now: \(\) => performance\.now\(\),\s*staleMs: FOES_STALE_MS,[^\n]*\n\s*onPeerHit: \(hit\) => online\?\.sendHit\(hit\) \?\? false,\s*toWire: \(feet\) => \{ const wc = state\.worldCoords\(feet\); return \[wc\.x, feet\[1\] - state\.compensation\[1\], wc\.z\]; \},\s*toScene: \(p\) => \{ const l = state\.localFromWorld\(p\[0\], p\[2\]\); return \[l\[0\], p\[1\] \+ state\.compensation\[1\], l\[1\]\]; \},\s*\}\);/, 'the net: the pose\'s own frame on the wire (AUDIT ONLINE D7), this scene\'s feet here');
  assert.match(w, /if \(online\.room !== _foesRoom\) \{ const seam = isCellRoom\(online\.room\) && isCellRoom\(_foesRoom\); _foesRoom = online\.room; _foesFullAt = -Infinity; if \(!seam\) exteriorFoes\.clearPuppets\(\); \}[^\n]*\n\s*if \(isCellRoom\(online\.room\)\) \{ const near = peersNear\(\); if \(near\) exteriorFoes\.pruneOwners\(new Set\(near\.map\(\(p\) => p\.id\)\), now\); \}/, 'every frame (AUDIT WORLD6b C7: a new room hears every foe at once; C3: the prune reads the clock)');
  assert.match(rd('src/ui/enhancedMenu.js'), /Towns and the open country share who is there and the creatures that find you: what one player meets, everyone nearby sees and fights - and its creatures can hurt you too\./);   // AUDIT WORLD6b C9: nearby (the fan is ranged), help (a puppet lands no blow)
  assert.match(rd('bible/06-Systems/Online-Arc.md'), /## WORLD6b \(2026-09-14\)/, 'the record');
});
