// AUDIT WORLD6b-iii(c) (2026-09-14, Mac: "Continue"): three opus lenses over a puppet's corpse loot - the owner's grant,
// the taker's landing, the wire / the relay / the records. The criticals: the take answered ANY peer for ANY body of
// mine by number, with no range, no roster and no quest law (A1/C7); a refused projection became an EMPTY grant that
// still spliced the whole pile (A3/C2); the grant arm had no "I asked" latch, so any socket in the cell put items and
// gold into my pack at will (B1/C1); the projection left the stack count open - one gold pile at 1e15, or at -5,
// minted or drained a purse (B2). The highs: every take, even for a number invented on the spot, made me spend my own
// hit budget answering (A2/B3/C4); the relay's hit arm carried a frame's worth of items with no byte budget (C3); the
// frame had no record bound and the relay junked a long one whole (C5). These pins EXECUTE two pools joined by nets,
// the projection, the fake Room and the frame.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validFoeRecord, CELL_FRAME_RECORDS_MAX, HIT_ROOM_BYTES_PER_S, PIXEL_UNITS } from '../src/net/wire.js';
import { RELAY_VERSION } from '../server/src/index.js';
import { fakeRoom } from './fakeRoom.mjs';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { generateItems, validLootItem, validLootList, LOOT_STACK_MAX, LOOT_LIST_MAX } from '../src/systems/loot.js';
import { CORPSE_ACTIVATION_DISTANCE } from '../src/player/activate.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
function craftCfg() { const b = new Uint8Array(74); const v = new DataView(b.buffer); b[10] = 0x08; v.setUint16(52, 4, true); const attrs = [40, 50, 50, 85, 50, 50, 90, 55]; for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true); return b; }
function craftMonsterBsa(records) { const NAME_FIELD = 14, ENTRY = 18; const dataLen = records.reduce((a, [, b]) => a + b.length, 0); const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer); v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true); let pos = 4; for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; } for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; } return out; }
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const settle = () => new Promise((r) => setTimeout(r, 0));
const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], goldPieces: 1000, activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const poolFor = (pe, said) => createExteriorFoes({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n}`); }, getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 0, currentPixelKey: () => '3,12', playerEntity: pe, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.5, spellsByIndex: () => null, say: (l) => said.push(l),
});
const netFor = (me, hits, peers, clock = { t: 0 }) => ({ room: () => 'world:3,12', inRoom: () => false, selfId: () => me, peers: () => peers, now: () => clock.t, staleMs: 0, onPeerHit: (h) => { hits.push(h); return true; }, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]] });
const senses = (pe) => ({ candidates: () => [], playerEntity: pe, playerHeight: 1.8, playerCrouching: false, playerInvisible: false, movingLessThanHalfSpeed: true });
const one = () => ({ ...generateItems('M', { level: 10, gender: 'male' }, () => 0.99)[0] });
const take = (i, from = 'mac-0001') => ({ to: 'bob-0002', k: 'world:3,12', i, take: 1 });
const landed = (pe) => pe.items.length + (pe.goldPieces > 1000 ? 1 : 0);   // the rolled item may be a gold pile, which lands in the purse

test('AUDIT WORLD6b-iii(c) A1/C7/A5/A2: the owner answers a take from a peer the hunt SEES standing within the body\'s reach - a peer it cannot see, a peer across the cell, a quest\'s foe, a body it does not have, a live foe: silence; and TAKES_PER_S asks a second from one peer, the rest silence', async () => {
  const bobE = playerEntity(); const bob = poolFor(bobE, []); const bobHits = [];
  const roster = [{ id: 'mac-0001', feet: [10, 0, 10], height: 1.8 }, { id: 'eve-0003', feet: [50, 0, 50], height: 1.8 }];
  bob.setNet(netFor('bob-0002', bobHits, roster));
  const rat = await bob.spawnFoe(0, [12, 0, 12], { feetGiven: true });
  rat.entity.items = [one()];
  bob.damageFoe(rat, 9999, [10, 0, 10]);
  assert.ok(CORPSE_ACTIVATION_DISTANCE > 3 && CORPSE_ACTIVATION_DISTANCE < 4);
  assert.equal(bob.applyHit('zed-0009', take(rat.seq, 'zed-0009')), true); assert.equal(bobHits.length, 0, 'A1: a peer the hunt does not see: silence');
  assert.equal(bob.applyHit('eve-0003', take(rat.seq)), true); assert.equal(bobHits.length, 0, 'C7: a peer fifty units off: silence');
  bob.applyHit('mac-0001', take(99)); assert.equal(bobHits.length, 0, 'A2: a body I do not have: silence, no frame');
  const live = await bob.spawnFoe(0, [11, 0, 11], { feetGiven: true });
  bob.applyHit('mac-0001', take(live.seq)); assert.equal(bobHits.length, 0, 'a live foe: silence');
  bob.applyHit('mac-0001', take(rat.seq)); assert.equal(bobHits.length, 1, 'in reach, seen: the grant'); assert.equal(bobHits[0].grant.length, 1); assert.equal(rat.entity.items.length, 0);
  // A5: a quest's foe
  const q = await bob.spawnFoe(0, [12, 0, 12], { feetGiven: true }); q.questBehaviour = {}; assert.equal(q.isQuestFoe, true); q.entity.items = [one()];
  bob.damageFoe(q, 9999, [10, 0, 10]);
  bob.applyHit('mac-0001', take(q.seq)); assert.equal(bobHits.length, 1, 'A5: a quest\'s foe answers as a body that does not exist'); assert.equal(q.entity.items.length, 1, 'its pile untouched');
  // A2/B3/C4: the asker's budget (the clock stands still: no refill)
  const rats = [];
  for (let i = 0; i < 5; i++) { const r = await bob.spawnFoe(0, [12, 0, 12], { feetGiven: true }); r.entity.items = [one()]; bob.damageFoe(r, 9999, [10, 0, 10]); rats.push(r); }
  const n0 = bobHits.length;
  for (const r of rats) bob.applyHit('mac-0001', take(r.seq));
  assert.equal(bobHits.length - n0, 2, 'TAKES_PER_S is three: one spent above, two more answered, the rest silence');
  assert.equal(rats.filter((r) => r.entity.items.length === 1).length, 3, 'and the unanswered bodies keep their piles');
});

test('AUDIT WORLD6b-iii(c) A3/C2, A4/C10: a refused projection is not an empty grant - the unprojectable item is dropped and the rest goes; a pile past LOOT_LIST_MAX goes in parts; one item larger than a frame is dropped and the rest reachable; the pile is emptied of what WENT', async () => {
  const bobE = playerEntity(); const bob = poolFor(bobE, []); const bobHits = [];
  bob.setNet(netFor('bob-0002', bobHits, [{ id: 'mac-0001', feet: [10, 0, 10], height: 1.8 }]));
  const clock = { t: 0 }; bob.setNet({ ...netFor('bob-0002', bobHits, [{ id: 'mac-0001', feet: [10, 0, 10], height: 1.8 }], clock) });
  // an unmintable item between two good ones
  const rat = await bob.spawnFoe(0, [12, 0, 12], { feetGiven: true });
  rat.entity.items = [one(), { templateIndex: 999999, stackCount: 1 }, one()];
  bob.damageFoe(rat, 9999, [10, 0, 10]);
  bob.applyHit('mac-0001', take(rat.seq));
  assert.equal(bobHits.at(-1).grant.length, 1, 'the first good item went'); assert.equal(rat.entity.items.length, 2, 'A3: the pile is not destroyed');
  clock.t += 1000; bob.applyHit('mac-0001', take(rat.seq));
  assert.equal(bobHits.at(-1).grant.length, 1, 'the second good item went'); assert.equal(rat.entity.items.length, 0, 'and the unmintable one is gone with it (it could never be granted)');
  // past LOOT_LIST_MAX
  const rat2 = await bob.spawnFoe(0, [12, 0, 12], { feetGiven: true });
  rat2.entity.items = Array.from({ length: LOOT_LIST_MAX + 6 }, () => one());
  bob.damageFoe(rat2, 9999, [10, 0, 10]);
  clock.t += 1000; bob.applyHit('mac-0001', take(rat2.seq));
  assert.equal(bobHits.at(-1).grant.length, 35, 'a part'); assert.equal(rat2.entity.items.length, 35, 'the rest stays');
  assert.equal(bob.foesFrame(true).f.find((r) => r.i === rat2.seq).o, 35, 'and the body still says so');
  // one item larger than a frame, a good one behind it
  const fat = { ...one(), enchantments: Array.from({ length: 64 }, () => Object.fromEntries(Array.from({ length: 40 }, (_, i) => ['k' + i, 'x'.repeat(120)]))) };
  assert.ok(JSON.stringify(validLootItem(fat)).length > 16 * 1024, 'the projection keeps it fat');
  const rat3 = await bob.spawnFoe(0, [12, 0, 12], { feetGiven: true });
  rat3.entity.items = [fat, one()];
  bob.damageFoe(rat3, 9999, [10, 0, 10]);
  clock.t += 1000; bob.applyHit('mac-0001', take(rat3.seq));
  assert.equal(bobHits.at(-1).grant.length, 1, 'A4/C10: the fat item dropped, the good one granted'); assert.equal(rat3.entity.items.length, 0);
  assert.ok(JSON.stringify({ t: 'hit', data: bobHits.at(-1) }).length <= 12 * 1024);
});

test('AUDIT WORLD6b-iii(c) B1/C1, B8, A7: a grant lands for a body I ASKED for, inside the window, once - an unasked grant is refused whole (no puppet; a puppet not asked), a second grant for one ask is refused, an ask past the window is refused; a stale record older than the grant that closed the body re-opens nothing, a newer one does', async () => {
  const macE = playerEntity(); const macSaid = []; const mac = poolFor(macE, macSaid); const macHits = []; const clock = { t: 0 };
  mac.setNet(netFor('mac-0001', macHits, [{ id: 'bob-0002', feet: [30, 0, 30], height: 1.8 }], clock));
  const g = () => ({ to: 'mac-0001', k: 'world:3,12', i: 5, grant: [one()] });
  assert.equal(mac.applyHit('bob-0002', g()), false, 'B1: no puppet of Bob\'s by that number: refused'); assert.equal(landed(macE), 0); assert.deepEqual(macSaid, []);
  const rec = (over) => ({ i: 5, t: 0, x: 0, f: [12, 0, 12], y: 0, h: 9, d: 0, a: 0, m: 0, g: '', l: 1, w: null, c: 0, s: 0, o: 0, ...over });
  mac.applyFoes('bob-0002', { n: 1, k: 'world:3,12', full: 1, f: [rec({})] }); await settle();
  mac.update(0.05, [10, 0, 10], [10, 1.6, 10], senses(macE));
  mac.applyFoes('bob-0002', { n: 2, k: 'world:3,12', full: 1, f: [rec({ d: 1, h: 0, o: 1 })] });
  const pup = mac.foes.find((x) => x.puppet === 'bob-0002');
  assert.equal(pup.corpse, true); assert.equal(pup._pup.o, 1);
  assert.equal(mac.applyHit('bob-0002', g()), false, 'B1: the body stands but I never asked: refused'); assert.equal(landed(macE), 0); assert.equal(pup._pup.o, 1);
  const key = `foeCorpse:${pup.uid}`;
  mac.takeLoot(key, (l) => macSaid.push(l)); assert.equal(macHits.length, 1, 'the ask');
  mac.takeLoot(key, (l) => macSaid.push(l)); assert.equal(macHits.length, 1, 'B8: one ask in flight - a second click sends nothing');
  clock.t = 4000;
  assert.equal(mac.applyHit('bob-0002', g()), false, 'B1: a grant past the window is refused'); assert.equal(landed(macE), 0);
  mac.takeLoot(key, (l) => macSaid.push(l)); assert.equal(macHits.length, 2, 'asked again after the window');
  clock.t = 5000;
  assert.equal(mac.applyHit('bob-0002', g()), true, 'inside it: lands'); assert.equal(landed(macE), 1); assert.equal(macSaid.at(-1), 'You take 1 item.');
  assert.equal(mac.applyHit('bob-0002', g()), false, 'B8: the ask is spent - a second grant is refused'); assert.equal(landed(macE), 1);
  // A7: the close and the stale record
  mac.applyFoes('bob-0002', { n: 3, k: 'world:3,12', full: 1, f: [rec({ d: 1, h: 0, o: 1 })] });   // the owner's word still says one (a frame in flight)
  assert.equal(pup._pup.o, 1); assert.notEqual(pup.corpseDisabled, true);
  mac.takeLoot(key, (l) => macSaid.push(l)); assert.equal(macHits.length, 3);
  assert.equal(mac.applyHit('bob-0002', { to: 'mac-0001', k: 'world:3,12', i: 5, grant: [], n: 4 }), true, 'the empty grant, as of the owner\'s frame 4');
  assert.equal(pup.corpseDisabled, true); assert.equal(macSaid.at(-1), 'The body has no treasure.');
  mac.applyFoes('bob-0002', { n: 4, k: 'world:3,12', full: 1, f: [rec({ d: 1, h: 0, o: 1 })] });
  assert.equal(pup.corpseDisabled, true, 'A7: a record no newer than the grant that closed it re-opens nothing');
  mac.applyFoes('bob-0002', { n: 5, k: 'world:3,12', full: 1, f: [rec({ d: 1, h: 0, o: 1 })] });
  assert.equal(pup.corpseDisabled, false, 'a newer word re-opens it');
});

test('AUDIT WORLD6b-iii(c) B2/C1, A6/B4: the projection bounds the stack (a whole number in [1, LOOT_STACK_MAX], else no item) and strips the marks that are the receiver\'s (equipSlot, questItem); through the arm a negative gold pile drains nothing', async () => {
  assert.equal(LOOT_STACK_MAX, 65535);
  const it = one();
  for (const n of [1e9, -5, 0, 1.5, LOOT_STACK_MAX + 1]) assert.equal(validLootItem({ ...it, stackCount: n }), null, `B2: a stack of ${n} is no item`);
  assert.equal(validLootItem({ ...it, stackCount: LOOT_STACK_MAX })?.stackCount, LOOT_STACK_MAX); assert.equal(validLootItem({ ...it, stackCount: 1 })?.stackCount, 1);
  assert.equal(validLootList([{ ...it, stackCount: -5 }]), null, 'the list with it refused whole');
  const w = validLootItem({ ...it, equipSlot: 2, questItem: true });
  assert.ok(w); assert.equal('equipSlot' in w, false, 'A6/B4: the worn mark is stripped'); assert.equal('questItem' in w, false, 'and the quest mark');
  // through the arm
  const macE = playerEntity(); const macSaid = []; const mac = poolFor(macE, macSaid); const macHits = [];
  mac.setNet(netFor('mac-0001', macHits, [{ id: 'bob-0002', feet: [30, 0, 30], height: 1.8 }]));
  const rec = (over) => ({ i: 5, t: 0, x: 0, f: [12, 0, 12], y: 0, h: 9, d: 0, a: 0, m: 0, g: '', l: 1, w: null, c: 0, s: 0, o: 0, ...over });
  mac.applyFoes('bob-0002', { n: 1, k: 'world:3,12', full: 1, f: [rec({})] }); await settle();
  mac.update(0.05, [10, 0, 10], [10, 1.6, 10], senses(macE));
  mac.applyFoes('bob-0002', { n: 2, k: 'world:3,12', full: 1, f: [rec({ d: 1, h: 0, o: 1 })] });
  const pup = mac.foes.find((x) => x.puppet === 'bob-0002');
  mac.takeLoot(`foeCorpse:${pup.uid}`, (l) => macSaid.push(l));
  assert.equal(mac.applyHit('bob-0002', { to: 'mac-0001', k: 'world:3,12', i: 5, grant: [{ group: 'Currency', templateIndex: 276, stackCount: -900, value: 0 }] }), false, 'a negative gold pile is no grant');
  assert.equal(macE.goldPieces, 1000, 'nothing drained'); assert.equal(macE.items.length, 0);
});

test('AUDIT WORLD6b-iii(c) C5: the frame obeys CELL_FRAME_RECORDS_MAX - the live foes ride first, then the newest bodies; the oldest bodies leave the roll (the relay junked a longer frame whole, and struck the socket out in the end)', async () => {
  const bobE = playerEntity(); const bob = poolFor(bobE, []); const clock = { t: 0 };
  bob.setNet(netFor('bob-0002', [], [], clock));
  const seqs = [];
  for (let i = 0; i < CELL_FRAME_RECORDS_MAX + 6; i++) { const r = await bob.spawnFoe(0, [12 + (i % 5), 0, 12], { feetGiven: true }); assert.ok(r, `spawned ${i}`); clock.t += 100; bob.damageFoe(r, 9999, [10, 0, 10]); seqs.push(r.seq); }
  const live = await bob.spawnFoe(0, [20, 0, 20], { feetGiven: true });
  const f = bob.foesFrame(true);
  assert.equal(f.f.length, CELL_FRAME_RECORDS_MAX, 'the cap');
  assert.equal(f.f[0].i, live.seq, 'the live foe first'); assert.equal(f.f[0].d, 0);
  const dead = f.f.slice(1).map((r) => r.i);
  assert.deepEqual(dead, seqs.slice(-(CELL_FRAME_RECORDS_MAX - 1)).reverse(), 'the newest bodies, the oldest seven gone from the roll');
  assert.ok(f.f.every((r) => validFoeRecord(r)), 'every record the wire\'s');
});

test('AUDIT WORLD6b-iii(c) C3: the Room - the hit arm counts BYTES (HIT_ROOM_BYTES_PER_S a second, the room\'s) - over the budget a frame is dropped and nobody struck; inside it a grant lands; the relay says world64', async () => {
  assert.equal(HIT_ROOM_BYTES_PER_S, 256 * 1024); assert.equal(RELAY_VERSION, 'world64');
  const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
  const r = fakeRoom('world:3,12');
  const a = r.connect(), c = r.connect();
  await r.hello(a, 'aaaa-0001', at(1, 1)); await r.hello(c, 'cccc-0003', at(1, 1));
  const grant = JSON.stringify({ t: 'hit', data: { to: 'cccc-0003', k: 'world:3,12', i: 1, grant: Array.from({ length: 40 }, () => ({ templateIndex: 7, name: 'x'.repeat(120), notes: 'y'.repeat(120) })), n: 1 } });
  assert.ok(grant.length > 10 * 1024 && grant.length < 16 * 1024);
  await r.raw(a, grant);
  assert.equal(c.sent.filter((m) => m.t === 'hit').length, 1, 'inside the budget: lands');
  r.room._roomHits = { bytes: 0, at: Date.now() + 1000 };   // spent, stamped a second ahead: no refill under load
  await r.raw(a, grant);
  assert.equal(c.sent.filter((m) => m.t === 'hit').length, 1, 'C3: over the room\'s hit bytes - dropped');
  assert.equal(a.closed, null); assert.equal(a.att.junk ?? 0, 0, 'and nobody struck');
  r.room._roomHits = { bytes: 20000, at: Date.now() + 1000 };
  await r.raw(a, grant); await r.raw(a, grant);
  assert.equal(c.sent.filter((m) => m.t === 'hit').length, 2, 'a budget of one grant: one lands, the next is dropped');
});

test('AUDIT WORLD6b-iii(c) by source: the dungeon\'s record clamps the overshoot too (C8); the rare-drop chime rings over a peer\'s body (B10); a live foe with no number streams no health (C9); the records', () => {
  assert.match(rd('src/scenes/dungeonContext.js'), /h: Number\.isFinite\(f\.entity\.health\) \? Math\.max\(0, f\.entity\.health\) : 0, d: f\.dead \? 1 : 0,/, 'C8');
  const x = rd('src/scenes/exteriorFoes.js');
  assert.match(x, /if \(n > 0\) playRareDrop\(audio, f\.corpseMarker\?\.pos \?\? f\.ai\?\.feet \?\? null, grant\);/, 'B10');
  assert.match(x, /\.\.\.\(Number\.isFinite\(f\.entity\.health\) \? \{ h: Math\.max\(0, Math\.min\(FOE_HEALTH_MAX, f\.entity\.health\)\) \} : \{\}\)/, 'C9');
  assert.match(x, /const asker = peerCandidate\(from\);/, 'A1: the asker read off the hunt\'s roster');
  assert.match(rd('server/src/index.js'), /const bytes = byteGate\(this\._roomHits, now, out\.length, HIT_ROOM_BYTES_PER_S\);/, 'C3');
  assert.match(rd('bible/06-Systems/Online-Arc.md'), /## AUDIT WORLD6b-iii\(c\) \(2026-09-14\)/, 'the record');
});
