// AUDIT WORLD6b (Mac, 2026-09-14: "Audit first"): three opus lenses over WORLD6b-i - the relay and the session (A),
// the encounter pool's puppet and stream arms (B), the world host's wiring, the day's rolls and the record (C).
// Thirty-three findings paid at their root; these pins EXECUTE the pay-outs: the relay's Room on the fake Durable
// Object, the session on the fake socket, the encounter pool on a crafted MONSTER.BSA with a converting net and a
// clock of its own, the day change under the shared clock.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hitOwnerOf, validFoeRecord, CELL_FRAME_RECORDS_MAX, CELL_PUPPETS_MAX, FOE_SEQ_MAX, FOE_HEALTH_MAX, POSE_BOUND, POSE_Y_BOUND, PIXEL_UNITS, MAX_FRAME_BYTES, DROP_STRIKES_MAX, HIT_ROOM_HZ_MAX, FOES_ROOM_BYTES_PER_S, RANGE_PIXELS } from '../src/net/wire.js';
import * as relay from '../server/src/relay.js';
import { RELAY_VERSION } from '../server/src/index.js';
import { OnlineSession, FOES_STALE_MS } from '../src/net/online.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { createExteriorFoes, MAX_ACTIVE_ENCOUNTER_FOES } from '../src/scenes/exteriorFoes.js';
import { runDayChange, dayRollsFor, setSharedClock, sharedClockOn, MINUTES_PER_DAY, DAY_SALT } from '../src/systems/worldTick.js';
import { MERCHANTS_FACTION_ID } from '../src/systems/guilds.js';
import { FACTION_TYPES } from '../src/formats/factionFile.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);

test('AUDIT WORLD6b A5/B3/C2: the wire - an owner is an id by the wire\'s own law; a streamed record is projected whole (the feet inside the pose\'s bounds, the health and the numbers bounded, the bits bits) or refused whole; the cell\'s bounds are one home at both ends', () => {
  assert.equal(hitOwnerOf({ to: 'bbbb-0002' }), 'bbbb-0002'); assert.equal(hitOwnerOf({ to: 'x'.repeat(40) }), 'x'.repeat(40)); assert.equal(hitOwnerOf({ to: 'ab_-' }), 'ab_-');
  for (const to of ['a', 'abc', 'x'.repeat(41), 'bbbb 0002', 'bbbb.0002', '', 'x'.repeat(64)]) assert.equal(hitOwnerOf({ to }), null, `A5: ${JSON.stringify(to)} is no id`);
  const full = { i: 5, t: 0, x: 1, f: [20, 0, 20], y: 1.5, h: 9, d: 0, a: 4, m: 1 };
  assert.deepEqual(validFoeRecord(full), full, 'a whole record, whole'); assert.notEqual(validFoeRecord(full).f, full.f, 'copied, not aliased');
  assert.deepEqual(validFoeRecord({ i: 0 }), { i: 0 }, 'the number alone is a record (a delta)');
  for (const r of [null, 7, [], { i: -1 }, { i: 1.5 }, { i: FOE_SEQ_MAX + 1 }, { i: 1, t: 256 }, { i: 1, t: -1 }, { i: 1, t: 0.5 }, { i: 1, x: 2 }, { i: 1, d: 'yes' }, { i: 1, m: -1 },
    { i: 1, f: [1, 2] }, { i: 1, f: [1, 2, 'x'] }, { i: 1, f: [POSE_BOUND + 1, 0, 0] }, { i: 1, f: [0, POSE_Y_BOUND + 1, 0] }, { i: 1, f: [0, 0, -POSE_BOUND - 1] }, { i: 1, f: [NaN, 0, 0] },
    { i: 1, y: Infinity }, { i: 1, h: -1 }, { i: 1, h: FOE_HEALTH_MAX + 1 }, { i: 1, h: 'x' }, { i: 1, a: -1 }, { i: 1, a: 2 ** 31 }, { i: 1, a: 1.5 }]) assert.equal(validFoeRecord(r), null, `C2: refused whole: ${JSON.stringify(r)}`);
  assert.equal(CELL_PUPPETS_MAX, MAX_ACTIVE_ENCOUNTER_FOES, 'B3: an owner\'s live cap is the pool\'s own'); assert.equal(CELL_FRAME_RECORDS_MAX, 64);
  assert.equal(relay.validFoeRecord, validFoeRecord); assert.equal(relay.CELL_FRAME_RECORDS_MAX, CELL_FRAME_RECORDS_MAX); assert.equal(relay.hitOwnerOf, hitOwnerOf);
  assert.equal(RELAY_VERSION, 'world68', 'the relay bumped');   // AUDIT WORLD6b-iii(c) C3: the hit arm's byte budget
});

test('AUDIT WORLD6b A1/A2: the Room - a cell\'s blow to a `to` nobody carries delivers nothing, spends nothing and is counted as junk (struck out at DROP_STRIKES_MAX); the funnel is the DESTINATION\'s own bucket - one owner\'s spent bucket stops no blow to another, and the dungeon host\'s is its own', async () => {
  const r = fakeRoom('world:3,12');
  const a = r.connect(), b = r.connect(), c = r.connect();
  await r.hello(a, 'aaaa-0001', at(1, 1)); await r.hello(b, 'bbbb-0002', at(1, 1)); await r.hello(c, 'cccc-0003', at(1, 1));
  const hitTo = (to) => JSON.stringify({ t: 'hit', data: { to, i: 1, dmg: 1, kind: 'melee' } });
  // A1: unroutable - junk, no token spent
  for (let i = 0; i < 5; i++) await r.raw(a, hitTo('zzzz-0009'));
  assert.equal(a.att.junk, 5, 'A1: five blows to nobody, five junk'); assert.equal(a.closed, null);
  assert.equal(r.room._attach(b).hbucket ?? null, null, 'and no bucket of anyone\'s was touched'); assert.equal(r.room._attach(c).hbucket ?? null, null);
  await r.raw(a, hitTo('cccc-0003'));
  assert.equal(ofType(c, 'hit').length, 1, 'an honest blow after them lands: nothing was spent');
  // A2: per destination - c's bucket spent, b still hears
  r.room._setAttach(c, { ...r.room._attach(c), hbucket: { tokens: 0, at: Date.now() + 1000 } });   // stamped a second ahead: no refill under load
  await r.raw(a, hitTo('cccc-0003')); await r.raw(a, hitTo('bbbb-0002'));
  assert.equal(ofType(c, 'hit').length, 1, 'A2: over C\'s budget - dropped'); assert.equal(ofType(b, 'hit').length, 1, 'B\'s own budget is untouched: the blow lands');
  assert.equal(a.closed, null, 'and no strike for a dropped honest blow');
  r.room._setAttach(c, { ...r.room._attach(c), hbucket: { tokens: 0, at: Date.now() - 1000 } });
  await r.raw(a, hitTo('cccc-0003')); assert.equal(ofType(c, 'hit').length, 2, 'refilled: forwarded');
  assert.equal(HIT_ROOM_HZ_MAX, 60);
  // A1: a stream of unroutable blows is struck out
  const z = r.connect(); await r.hello(z, 'zzzz-0001', at(1, 1));
  for (let i = 0; i < 30; i++) await r.raw(z, hitTo('nobody-0000'));
  assert.ok(z.att.junk >= 10 && z.att.junk <= 30, `every unroutable blow the pose bucket lets through is junk (${z.att.junk}; the rest are rate-dropped, POSE_HZ_MAX a second)`);
  r.room._setAttach(z, { ...r.room._attach(z), junk: DROP_STRIKES_MAX, bucket: null });
  await r.raw(z, hitTo('nobody-0000'));
  assert.equal(z.closed?.reason, 'too many frames', 'struck out past DROP_STRIKES_MAX (AUDIT WORLD2 A4\'s instrument)');
  // the dungeon host's funnel is the host socket's own
  const d = fakeRoom('dungeon:m187'); const h = d.connect(), j = d.connect();
  await d.hello(h, 'host-0001', at(1, 1)); await d.hello(j, 'join-0002', at(1, 1));
  await d.raw(j, JSON.stringify({ t: 'hit', data: { i: 0, dmg: 1, kind: 'melee' } })); assert.equal(ofType(h, 'hit').length, 1);
  assert.ok(d.room._attach(h).hbucket, 'the host\'s own bucket'); assert.equal(d.room._attach(j).hbucket ?? null, null, 'the striker\'s untouched');
});

test('AUDIT WORLD6b A3/A4/B3: the Room - a cell\'s frame past CELL_FRAME_RECORDS_MAX, or without its roll, is junk (counted); the fan is RANGED as the pose\'s is (a socket ten pixels off hears no foes and no poses); the ingress budget drops a frame unread with no strike; a dungeon\'s fan reaches everyone', async () => {
  const r = fakeRoom('world:3,12');
  const a = r.connect(), b = r.connect(), far = r.connect();
  await r.hello(a, 'aaaa-0001', at(1, 1)); await r.hello(b, 'bbbb-0002', at(2, 1)); await r.hello(far, 'ffff-0003', at(1 + RANGE_PIXELS + 7, 1));
  const frame = (n, f) => JSON.stringify({ t: 'foes', data: { n, k: 'world:3,12', full: 1, f } });
  await r.raw(a, frame(1, new Array(CELL_FRAME_RECORDS_MAX + 1).fill({ i: 1 })));
  assert.equal(a.att.junk, 1, 'B3: sixty-five records is junk'); assert.equal(ofType(b, 'foes').length, 0, 'and reaches nobody');
  await r.raw(a, JSON.stringify({ t: 'foes', data: { n: 2, k: 'world:3,12' } }));
  assert.equal(a.att.junk, 2, 'no roll at all is junk');
  await r.raw(a, frame(3, new Array(CELL_FRAME_RECORDS_MAX).fill({ i: 1 })));
  assert.equal(a.att.junk, 2, 'sixty-four is the law'); assert.equal(ofType(b, 'foes').length, 1, 'A4: the neighbour hears it'); assert.equal(ofType(far, 'foes').length, 0, 'A4: ten pixels off hears nothing');
  await r.pose(a, at(1, 1)); assert.equal(ofType(b, 'pose').length, 1); assert.equal(ofType(far, 'pose').length, 0, 'as the pose fan already had it');
  // A3: the ingress budget, spent at the door before the parse
  r.room._roomFoesIn = { bytes: 0, at: Date.now() + 1000 };   // stamped a second ahead: no refill under load
  const big = JSON.stringify({ t: 'foes', data: { n: 4, k: 'world:3,12', full: 1, f: [], pad: 'p'.repeat(MAX_FRAME_BYTES * 2) } });
  await r.raw(a, big);
  assert.equal(ofType(b, 'foes').length, 1, 'A3: over the ingress budget - dropped unread'); assert.equal(a.att.junk, 2, 'no junk counted'); assert.equal(a.closed, null, 'no strike');
  r.room._roomFoesIn = { bytes: 0, at: Date.now() - 1000 };
  await r.raw(a, big); assert.equal(ofType(b, 'foes').length, 2, 'refilled: through');
  assert.equal(FOES_ROOM_BYTES_PER_S, 4 * 1024 * 1024);
  // a dungeon's fan is every socket's - the host's frame, ranged by nothing
  const d = fakeRoom('dungeon:m187'); const h = d.connect(), j = d.connect();
  await d.hello(h, 'host-0001', at(1, 1)); await d.hello(j, 'join-0002', at(40, 40));
  await d.raw(h, JSON.stringify({ t: 'foes', data: { seq: 1, f: new Array(CELL_FRAME_RECORDS_MAX + 1).fill({ i: 1 }) } }));
  assert.equal(ofType(j, 'foes').length, 1, 'a dungeon\'s frame is neither ranged nor bounded by the cell\'s law'); assert.equal(h.att.junk ?? 0, 0);
});

test('AUDIT WORLD6b A6/A7/A8: the session - a blow to an owner the roster does not hold goes nowhere; a stranger\'s frame is not the world; the pool\'s blow carries the cell key and the owner refuses another cell\'s', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now });
  const foesIn = [];
  s.onFoes = (id, data) => foesIn.push(id);
  const info = console.info; console.info = () => {};
  try {
    s.join('world:3,12', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 });
    const ws = sockets[0]; ws.open();
    ws.receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'bob-0002', name: 'Bob', look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, pose: { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 } }], host: null, world: null });
    assert.equal(s.sendHit({ to: 'eve-0003', i: 1, dmg: 3, kind: 'melee' }), false, 'A6: Eve is no peer of mine');
    now += 1000;
    assert.equal(s.sendHit({ to: 'bob-0002', k: 'world:3,12', i: 1, dmg: 3, kind: 'melee' }), true, 'Bob is');
    assert.equal(ws.sent.at(-1), '{"t":"hit","data":{"to":"bob-0002","k":"world:3,12","i":1,"dmg":3,"kind":"melee"}}', 'A7: the key rides');
    const foes = { n: 1, k: 'world:3,12', full: 1, f: [] };
    ws.receive({ t: 'foes', id: 'eve-0003', data: foes }); ws.receive({ t: 'foes', id: 'bob-0002', data: foes });
    assert.deepEqual(foesIn, ['bob-0002'], 'A8: a stranger\'s frame is not the world; a peer\'s is');
    ws.receive({ t: 'leave', id: 'bob-0002' });
    ws.receive({ t: 'foes', id: 'bob-0002', data: foes });
    assert.deepEqual(foesIn, ['bob-0002'], 'and a peer gone is a stranger again');
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
/** The world host's net with a CONVERTING pair (the scene frame is the world frame shifted by `off`, the floating
 *  origin's compensation) and a clock of its own. */
const netFor = (hits, { room = 'world:3,12', off = { v: 0 }, clock = { t: 0 }, staleMs = FOES_STALE_MS } = {}) => ({
  room: () => room, now: () => clock.t, staleMs,
  onPeerHit: (h, fate) => { hits.push(h); fate?.sent?.(); return true; },
  toWire: (feet) => [feet[0] - off.v, feet[1], feet[2] - off.v],
  toScene: (p) => [p[0] + off.v, p[1], p[2] + off.v],
});
const puppets = (pool) => pool.foes.filter((f) => !!f.puppet);
const rec = (i, over = {}) => ({ i, t: 0, x: 0, f: [20 + i, 0, 20], y: 0, h: 9, d: 0, a: 0, m: 0, ...over });
const frame = (n, f, full = 1) => ({ n, k: 'world:3,12', full, f });

test('AUDIT WORLD6b B1/B2/B10: the pool - a fall\'s, another foe\'s and a relayed blow on a puppet are NOT diverted to its owner (only my own is, a zero one too); a peer\'s kill of MY foe reads no soul gem of mine (a trap that would tether it lets the peer\'s blow kill) and speaks no kill notice; my own does both', async () => {
  const hits = [], said = [];
  const pool = createExteriorFoes(poolRig({ say: (t) => said.push(t) }));
  pool.setNet(netFor(hits));
  pool.applyFoes('bob-0002', frame(1, [rec(5)]));
  await settle();
  const pup = puppets(pool)[0];
  assert.ok(pup, 'Bob\'s rat stands');
  pool.damageFoe(pup, 5, null, null, { fromPlayer: false });
  pup.hurtFromFoe(5, [1, 0, 0]);
  pool.damageFoe(pup, 5, null, null, { fromPlayer: true, peer: true });
  assert.deepEqual(hits, [], 'B1: a fall, a foe\'s maul, a relayed blow - none of them mine to report');
  pool.damageFoe(pup, 5, [0, 0, 0], null);
  pool.damageFoe(pup, 0, [0, 0, 0], null);
  assert.deepEqual(hits.map((h) => [h.to, h.i, h.dmg]), [['bob-0002', 5, 5], ['bob-0002', 5, 0]], 'my own blow goes to Bob, a zero one too (B10)');
  assert.equal(pup.entity.health, 9, 'and none of them landed here');
  // B2: the peer's kill
  const rat = await pool.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  rat.entity.activeEffects = [{ kind: 'soulTrap', chance: 100 }];   // a trap that succeeds with no empty gem TETHERS the foe at 1 (X5)
  rat.entity.health = 1;
  assert.equal(pool.applyHit('bob-0002', { k: 'world:3,12', i: rat.seq, dmg: 5 }), true);
  assert.equal(rat.dead, true, 'B2: a peer\'s blow kills through the door - no trap of mine intercepts'); assert.deepEqual(said, [], 'and no kill notice of mine');
  const rat2 = await pool.spawnFoe(0, [12, 0, 12], { feetGiven: true });
  rat2.entity.activeEffects = [{ kind: 'soulTrap', chance: 100 }]; rat2.entity.health = 1;
  pool.damageFoe(rat2, 5, [0, 0, 0], null);
  assert.equal(rat2.dead, false, 'my own killing blow is intercepted by the trap (tethered at 1, X5\'s law)'); assert.equal(rat2.entity.health, 1);
  rat2.entity.activeEffects = [];
  pool.damageFoe(rat2, 5, [0, 0, 0], null);
  assert.equal(rat2.dead, true); assert.equal(said.length, 2, 'and my own says the trap\'s word and the kill notice - a peer\'s said neither');
  assert.equal(pool.applyHit('bob-0002', { k: 'world:4,4', i: rat.seq, dmg: 5 }), false, 'A7: another cell\'s blow is refused');
  const x = rd('src/scenes/exteriorFoes.js');
  assert.match(x, /const trap = peer \? \{ allowDeath: true \} : attemptSoulTrap\(f\.entity, f\.mobileType, playerEntity\.items, Math\.random\(\)\);/, 'B2: the trap, by source');
  assert.match(x, /if \(!peer && f\.mobileType < 128 && isAzurasStarEquipped\(playerEntity\)/, 'B2: the Star, by source');
  assert.match(x, /if \(fromPlayer && !peer\) \{\s*(?:\/\/[^\n]*\n\s*)*const _pt = f\._divertPt \?\? null; f\._divertPt = null;\s*f\._divertFrame = _peerFrame;\s*_net\?\.onPeerHit\?\.\(\{ to: f\.puppet, k: _owners\.get\(f\.puppet\)\?\.k \?\? _net\.room\?\.\(\) \?\? null, i: f\.seq, dmg: Math\.max\(0, Math\.round\(Number\(damage\) \|\| 0\)\), kind,[^\n]*\n\s*\.\.\.\(_pAt \? \{ p: [^\n]*\n\s*\.\.\.\(knockDir \? \{ d: [^\n]*\n\s*\.\.\.\(_pt != null \? \{ pt: _pt \} : \{\}\),[^\n]*\n\s*\.\.\.\(kind === 'arrow' \? \{ ar: 1 \} : \{\}\) \}\);[^\n]*\n\s*\}\s*return;/, 'B1: the divert\'s gate, by source (WORLD6b-ii: the striker\'s feet and the blow\'s direction ride; WORLD6b-iii(e): the poison and the shaft)');
  assert.match(rd('src/scenes/shared.js'), /if \(!f \|\| f\.dead \|\| !f\.entity \|\| f\.puppet\) continue;/, 'B1: the magic-round broker skips a puppet');
});

test('AUDIT WORLD6b B3/C2/B14: the pool - an owner stands at most CELL_PUPPETS_MAX live puppets here (a corpse and a build count, a swept one does not); a record outside the law is refused whole while its neighbours land; a puppet carries no loot, no kit and no spells', async () => {
  const hits = [];
  const pool = createExteriorFoes(poolRig());
  pool.setNet(netFor(hits));
  const many = []; for (let i = 1; i <= CELL_PUPPETS_MAX + 4; i++) many.push(rec(i));
  pool.applyFoes('bob-0002', frame(1, many));
  await settle();
  assert.equal(puppets(pool).length, CELL_PUPPETS_MAX, `B3: ${CELL_PUPPETS_MAX} of ${many.length} stand`);
  assert.equal(pool.applyFoes('bob-0002', frame(2, [rec(1, { d: 1 })], 0)), true);
  assert.equal(puppets(pool).filter((f) => !f.dead).length, CELL_PUPPETS_MAX - 1);
  pool.applyFoes('bob-0002', frame(3, [rec(20)], 0)); await settle();
  assert.equal(puppets(pool).filter((f) => !f.dead).length, CELL_PUPPETS_MAX, 'a dead one\'s slot is free for the next');
  pool.applyFoes('bob-0002', frame(4, [rec(21)], 0)); await settle();
  assert.equal(puppets(pool).filter((f) => !f.dead).length, CELL_PUPPETS_MAX, 'and the cap holds');
  pool.applyFoes('eve-0003', frame(1, [rec(1), rec(2)])); await settle();
  assert.equal(puppets(pool).filter((f) => f.puppet === 'eve-0003').length, 2, 'the cap is per owner');
  // C2: the projection
  const pool2 = createExteriorFoes(poolRig()); pool2.setNet(netFor(hits));
  pool2.applyFoes('bob-0002', frame(1, [rec(1), rec(2, { f: [POSE_BOUND + 1, 0, 0] }), rec(3, { h: FOE_HEALTH_MAX + 1 }), rec(4, { t: 300 }), rec(5, { i: -5 }), rec(6, { x: 3 }), rec(7)]));
  await settle();
  assert.deepEqual(puppets(pool2).map((f) => f.seq).sort(), [1, 7], 'C2: the records outside the law refused whole, their neighbours landed');
  const pup = puppets(pool2)[0];
  assert.deepEqual(pup.entity.items, [], 'B14: no loot of mine'); assert.equal(pup.entity.spells?.length ?? 0, 0, 'no spells'); assert.equal(pup.entity.equipped?.length ?? 0, 0, 'no kit');
  const mine = await pool2.spawnFoe(0, [1, 0, 1], { feetGiven: true });
  assert.ok(Array.isArray(mine.entity.items), 'my own rolls its table as ever');
  pool2.applyFoes('bob-0002', frame(2, [rec(1, { h: 3 }), rec(1, { h: 2 })], 0));
  assert.equal(pup.entity.health, 2, 'a record for a standing puppet lands in order');
});

test('AUDIT WORLD6b B4/B5/B6/B7/C3/C10: the pool - an owner gone and back numbers from one again (the prune ends its record); a swept puppet\'s record ENDS at once and the owner\'s next record stands it anew; a build the clear overtook ends on arrival; a body still loading is refused for a record that ended; a quiet owner is swept by the clock; the teardown ends every owner', async () => {
  const hits = [], freed = { n: 0 };
  const clock = { t: 0 };
  const rig = poolRig(); rig.renderer.destroyBillboardBatch = () => { freed.n++; };
  const pool = createExteriorFoes(rig);
  pool.setNet(netFor(hits, { clock }));
  // B4: the restart
  for (let n = 1; n <= 40; n++) pool.applyFoes('bob-0002', frame(n, [rec(1)], n === 1 ? 1 : 0));
  await settle();
  assert.equal(puppets(pool).length, 1);
  pool.pruneOwners(new Set(), clock.t);
  assert.equal(puppets(pool).length, 0, 'Bob left: his puppet went');
  assert.equal(pool.applyFoes('bob-0002', frame(1, [rec(1)])), true, 'B4: Bob is back (a reload keeps the id) and numbers from one - heard');
  await settle();
  assert.equal(puppets(pool).length, 1, 'and his rat stands again');
  // B5: the splice
  const pup = puppets(pool)[0];
  pool.applyFoes('bob-0002', frame(2, [rec(2)])); await settle();
  assert.equal(pool.foes.includes(pup), false, 'B5: a full frame that stops naming it ENDS the record at once, no frame\'s tail asked'); assert.equal(pup._gone, true);
  pool.applyFoes('bob-0002', frame(3, [rec(1), rec(2)], 0)); await settle();
  assert.equal(puppets(pool).filter((f) => f.seq === 1 && !f.dead).length, 1, 'and the owner\'s next record stands it anew instead of landing on the dead');
  // B6: the build the clear overtook
  pool.applyFoes('bob-0002', frame(4, [rec(1), rec(2), rec(3)], 0));
  pool.clearPuppets();
  await settle();
  assert.equal(puppets(pool).length, 0, 'B6: the build in flight when the room changed ended on arrival');
  pool.applyFoes('bob-0002', frame(1, [rec(9)], 1));
  pool.pruneOwners(new Set(), clock.t);
  await settle();
  assert.equal(puppets(pool).length, 0, 'and one the prune overtook');
  // B7: the late body
  pool.applyFoes('bob-0002', frame(2, [rec(1)])); await settle();
  const p1 = puppets(pool)[0];
  const before = freed.n;
  pool.applyFoes('bob-0002', frame(3, [rec(1, { d: 1 })], 0));
  assert.equal(p1.dead, true, 'dead by the stream');
  pool.pruneOwners(new Set(), clock.t);
  await settle(); await settle();
  assert.equal(pool.foes.includes(p1), false); assert.equal(freed.n > before, true, 'B7: the body that landed after the sweep was destroyed on arrival');
  assert.equal(pool.batches().length, 0, 'and nothing draws it');
  // C3: the quiet owner
  clock.t = 10000;
  pool.applyFoes('bob-0002', frame(1, [rec(1)])); await settle();
  assert.equal(puppets(pool).length, 1);
  pool.pruneOwners(new Set(['bob-0002']), clock.t + FOES_STALE_MS);
  assert.equal(puppets(pool).length, 1, 'inside the window: kept');
  pool.pruneOwners(new Set(['bob-0002']), clock.t + FOES_STALE_MS + 1);
  assert.equal(puppets(pool).length, 0, 'C3: a stream gone quiet for FOES_STALE_MS is swept though its owner is still in the room');
  assert.equal(pool.applyFoes('bob-0002', frame(1, [rec(1)])), true, 'and its next frame starts over'); await settle();
  // C10: the teardown
  pool.clearLive();
  assert.equal(pool.foes.length, 0);
  assert.equal(pool.applyFoes('bob-0002', frame(1, [rec(1)])), true, 'C10: the owners\' records went with the teardown - a frame numbered one is heard');
});

test('AUDIT WORLD6b B8/B9/B11/B12/B13/B15: the pool - removeFoe and zeroFoeHealth refuse a puppet, a foe\'s shaft into one lands nothing; a record whose species disagrees rebuilds the puppet; a dead puppet the owner says lives is re-stood; a death that arrives while the build is in flight lands when it does; the corpse loot keys by a stable id', async () => {
  const hits = [];
  const pool = createExteriorFoes(poolRig());
  pool.setNet(netFor(hits));
  pool.applyFoes('bob-0002', frame(1, [rec(1)])); await settle();
  const pup = puppets(pool)[0];
  pool.removeFoe(pup); pool.foes.length && assert.equal(pup.dead, false, 'B9: removeFoe leaves a puppet standing');
  assert.equal(pool.foes.includes(pup), true);
  const shooter = await pool.spawnFoe(0, [1, 0, 1], { feetGiven: true });
  pool.arrowHitFoe({ shooterFoe: shooter, dir: [1, 0, 0], weapon: null }, pup);
  assert.equal(pup.entity.health, 9, 'B8: a foe\'s shaft into a puppet lands nothing'); assert.deepEqual(hits, [], 'and reports nothing');
  // B11: the species rebuild
  pool.applyFoes('bob-0002', frame(2, [rec(1, { t: 3, x: 1 })], 0)); await settle();
  assert.equal(pool.foes.includes(pup), false, 'B11: the old puppet ended');
  const re = puppets(pool)[0];
  assert.equal(re.mobileType, 3, 'and the streamed species stands'); assert.equal(re.gender, 'female');
  // B12: the undie
  pool.applyFoes('bob-0002', frame(3, [rec(1, { t: 3, d: 1 })], 0));
  assert.equal(re.dead, true);
  pool.applyFoes('bob-0002', frame(4, [rec(1, { t: 3 })], 0)); await settle();
  assert.equal(pool.foes.includes(re), false, 'B12: the owner says it lives: the dead one ends'); assert.equal(puppets(pool).filter((f) => !f.dead).length, 1, 'and a live one stands');
  // B13: the death in flight
  pool.applyFoes('bob-0002', frame(5, [rec(7)], 0));
  pool.applyFoes('bob-0002', frame(6, [rec(7, { d: 1, f: [30, 0, 30] })], 0));
  await settle();
  const p7 = puppets(pool).find((f) => f.seq === 7);
  assert.ok(p7, 'the build landed'); assert.equal(p7.dead, true, 'B13: dead on arrival, where the latest word put it'); assert.deepEqual(p7.ai.feet, [30, 0, 30]);
  // B15: the stable loot key
  const mine = await pool.spawnFoe(0, [5, 0, 5], { feetGiven: true });
  mine.entity.health = 1; pool.damageFoe(mine, 5, [0, 0, 0], null);
  assert.equal(mine.dead, true);
  const targets = pool.lootTargets();
  assert.equal(targets.length, 1, 'one corpse of mine (the puppet\'s is not mine to loot)');
  assert.equal(targets[0].key ?? targets[0].id ?? null, `foeCorpse:${mine.uid}`, 'B15: keyed by the foe\'s uid, not its index');
  pool.applyFoes('bob-0002', frame(7, [], 1));   // every puppet of Bob's swept: the indices shift
  assert.equal(pool.lootTargets()[0].key ?? pool.lootTargets()[0].id, `foeCorpse:${mine.uid}`, 'and the key survives the splice');
});

test('AUDIT WORLD6b C1: the puppet\'s target lives in the WORLD frame - when the floating origin shifts this scene (offsetAll moves every foe\'s feet and the converter\'s compensation changes) a standing puppet stays where it is; cached in the scene frame it snapped a map pixel away', async () => {
  const hits = [], off = { v: 0 };
  const pool = createExteriorFoes(poolRig());
  pool.setNet(netFor(hits, { off }));
  pool.applyFoes('bob-0002', frame(1, [rec(1, { f: [20, 0, 20] })])); await settle();
  const pup = puppets(pool)[0];
  pool.update(0.05, [0, 0, 0], [0, 1.6, 0]);
  assert.deepEqual(pup.ai.feet, [20, 0, 20]);
  // the crossing: the world host shifts every foe's feet by the recenter and the converter's compensation moves with it
  const shift = 819.2;
  pool.offsetAll([shift, 0, shift]); off.v = shift;
  pool.update(0.05, [0, 0, 0], [0, 1.6, 0]);
  assert.deepEqual(pup.ai.feet, [20 + shift, 0, 20 + shift], 'C1: the puppet stands where it stood - the target is converted through the new compensation every step');
  assert.equal(pup.ai.moving, false, 'and did not walk');
  pool.applyFoes('bob-0002', frame(2, [rec(1, { f: [21, 0, 20] })], 0));
  pool.update(0.05, [0, 0, 0], [0, 1.6, 0]);
  assert.ok(pup.ai.feet[0] > 20 + shift && pup.ai.feet[0] < 21 + shift, 'and a new record eases in the new frame');
  const x = rd('src/scenes/exteriorFoes.js');
  assert.match(x, /const feet = f\.ai\.feet, t = p\.wire \? _net\.toScene\(p\.wire\) : null;/, 'by source: converted in the step');
  assert.doesNotMatch(x, /_pup\.feet/, 'no scene-frame target survives');
});

test('AUDIT WORLD6b C4/C5: the day\'s rolls - online the walk is one day at a time, each day from its own generator, so three days caught up at once equal three days walked one by one; offline the caller\'s stream walks the span whole; the prices and the powers draw different sequences on one day', () => {
  const dict = () => new Map([[MERCHANTS_FACTION_ID, { id: MERCHANTS_FACTION_ID, type: FACTION_TYPES.Group, region: -1, power: 50 }], [9000, { id: 9000, type: FACTION_TYPES.Province, region: 0, power: 50 }], [9001, { id: 9001, type: FACTION_TYPES.Province, region: 1, power: 50 }]]);
  const fresh = () => ({ regionPrices: { 0: 1000, 1: 1000 }, factionRep: { dict: dict() } });
  const day = 40;
  try {
    setSharedClock(() => day * MINUTES_PER_DAY);
    assert.equal(sharedClockOn(), true);
    const stayed = fresh();
    for (let d = day - 2; d <= day; d++) runDayChange({ entity: stayed, lastMinutes: (d - 1) * MINUTES_PER_DAY, nowMinutes: d * MINUTES_PER_DAY, rolls: () => 0.99 });
    const away = fresh();
    runDayChange({ entity: away, lastMinutes: (day - 3) * MINUTES_PER_DAY, nowMinutes: day * MINUTES_PER_DAY, rolls: () => 0.01 });
    assert.deepEqual(away.regionPrices, stayed.regionPrices, 'C4: three days away and three days there walk the region alike, whatever the dice');
    assert.notDeepEqual(stayed.regionPrices, { 0: 1000, 1: 1000 }, 'and the walk walked');
    const a = dayRollsFor(day * MINUTES_PER_DAY, Math.random, DAY_SALT.prices), b = dayRollsFor(day * MINUTES_PER_DAY, Math.random, DAY_SALT.powers), c = dayRollsFor(day * MINUTES_PER_DAY, Math.random, DAY_SALT.prices);
    assert.notEqual(a(), b(), 'C5: the prices and the powers are salted apart'); assert.equal(c(), dayRollsFor(day * MINUTES_PER_DAY, Math.random, DAY_SALT.prices)(), 'one salt, one sequence');
  } finally { setSharedClock(null); }
  const off1 = fresh(), off2 = fresh();
  runDayChange({ entity: off1, lastMinutes: (day - 3) * MINUTES_PER_DAY, nowMinutes: day * MINUTES_PER_DAY, rolls: () => 0.99 });
  runDayChange({ entity: off2, lastMinutes: (day - 3) * MINUTES_PER_DAY, nowMinutes: day * MINUTES_PER_DAY, rolls: () => 0.01 });
  assert.notDeepEqual(off1.regionPrices, off2.regionPrices, 'offline the dice decide, the span whole (DFU\'s own)');
  const w = rd('src/systems/worldTick.js');
  const imports = w.match(/^import [^\n]* from '[^\n]*';/gm); assert.ok(w.indexOf('const SHARED_DAY_SEED') > w.lastIndexOf(imports.at(-1)), 'the constants sit below the imports');
  assert.match(w, /export const DAY_SALT = Object\.freeze\(\{ prices: 1, powers: 2 \}\);/);
  // the world host by source: the heartbeat (A9), the death branch (C8), the full kick (C7), the targets (B8), the Wabbajack (B9), the pane (C9)
  const h = rd('src/scenes/world.js');
  assert.match(h, /else if \(id && isWorldRoom\(online\.room\)\) _foesInAt = performance\.now\(\);/, 'A9');
  assert.match(h, /if \(online\.room\) \{ worldPublish\(now, true\); online\.leave\(\); exteriorFoes\.clearPuppets\(\); _foesRoom = null; \}/, 'C8');
  assert.match(h, /if \(online\.room !== _foesRoom\) \{ const seam = isCellRoom\(online\.room\) && isCellRoom\(_foesRoom\); _foesRoom = online\.room; _foesFullAt = -Infinity; if \(!seam\) exteriorFoes\.clearPuppets\(\); \}/, 'C7 (WORLD6b-iii(b): a cell crossing keeps them - the seam is no room change to the puppets)');
  assert.match(h, /\{ const near = peersNear\(\); if \(near\) exteriorFoes\.pruneOwners\(new Set\(near\.map\(\(p\) => p\.id\)\), now\); \}/, 'C3: the prune reads the clock');
  assert.match(h, /candidates: \(\) => \[\.\.\.cityGuards\.guards, \.\.\.exteriorFoes\.foes\]\.filter\(\(f\) => !f\.dead && !f\.puppet\),/, 'B8');
  assert.match(h, /const f = enchantFoes\(\)\.find\(\(x\) => !x\.dead && x\.entity === targetEntity\);\s*if \(!f \|\| f\.puppet\) return;/, 'B9');
  assert.match(rd('src/scenes/exteriorFoes.js'), /const me = _net\?\.selfId\?\.\(\) \?\? null;/, 'C11: selfId on the net is READ now (WORLD6b-ii: whose blow a streamed target names) - no dead wiring');
  assert.match(rd('src/ui/enhancedMenu.js'), /everyone nearby sees and fights - and its creatures can hurt you too\./, 'C9 (AUDIT WORLD6b-ii C3: since the hunt a peer\'s creature can hurt me)');
  assert.match(rd('bible/06-Systems/Online-Arc.md'), /## AUDIT WORLD6b \(2026-09-14\)/, 'the record');
});
