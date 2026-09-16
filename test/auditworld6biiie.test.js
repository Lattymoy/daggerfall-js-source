// AUDIT WORLD6b-iii(e) (Mac, 2026-09-14: "Continue" after WORLD6b-iii(e)): three opus lenses over the striker's rider and
// the roster's bound - A the pools' poison door and the hit, B the wire/relay/session `who`, C the dungeon twin, the
// records and the merge. Paid here: the dose is the CALC's word, not the number's (A3: FormulaHelper doses on the
// calc's damage and the Strikes payload can zero it after - LowDamageVs - so a poisoned, enchanted blade spent its
// dose and the owner's foe never felt it; and a dose set aside for a blow that already went this frame rode a LATER
// blow); the dose is read inside the provenance gate (A5); the hit's `ar` is BOUNDED at the owner (A1: a crafted stream
// minted a stack the projection refused whole, and the grant dropped the pile with it - HIT_ARROWS_MAX); the zero
// blow's KIND rides (A2/C1: a shaft that connected and landed nothing was a swing to the owner, its Arrow lost); the
// dungeon has the one attack door (C2: a zero blow at a puppet woke every foe on my screen and told the host nothing);
// the relay's `who` carries a room budget and keeps the looks it heard (B1: the one arm past the hello that read
// storage, per ask, for free); the answer's pose rides within range alone (B2: a radar over the whole cell); a name
// that left is no junk (B3: the honest race with a leave struck a correct client); the asked list goes with the room
// (B4); five asks a second (B5: a halo let go re-learned twenty peers in ten seconds); the parser checks the name (B6);
// the socket asked for is read again after the await (B9). Recorded: the ask after the blow (B7), the merged roster's
// flicker (B8), the rig's attachment cap (B10), the dungeon's Math.random seam (A6/C10), the shadow's own Arrow
// (C10), the foe-vs-foe fallback (A7).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WHO_HZ_MAX, WHO_ROOM_HZ_MAX, HIT_ARROWS_MAX, parseClient, PIXEL_UNITS, validPose, RANGE_PIXELS } from '../src/net/wire.js';
import * as relay from '../server/src/relay.js';
import { RELAY_VERSION } from '../server/src/index.js';
import { POISONS } from '../src/systems/poisons.js';
import { OnlineSession } from '../src/net/online.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
function craftCfg() { const b = new Uint8Array(74); const v = new DataView(b.buffer); b[10] = 0x08; v.setUint16(52, 4, true); const attrs = [40, 50, 50, 85, 50, 50, 90, 55]; for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true); return b; }
function craftMonsterBsa(records) { const NAME_FIELD = 14, ENTRY = 18; const dataLen = records.reduce((a, [, b]) => a + b.length, 0); const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer); v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true); let pos = 4; for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; } for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; } return out; }
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const settle = () => new Promise((r) => setTimeout(r, 0));
const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], goldPieces: 0, activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const poolFor = (pe, said) => createExteriorFoes({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n}`); }, getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 120, currentPixelKey: () => '3,12', playerEntity: pe, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.5, spellsByIndex: () => null, say: (l) => said.push(l),
});
const netFor = (me, hits, peers) => ({ room: () => 'world:3,12', inRoom: () => false, selfId: () => me, peers: () => peers, now: () => 0, staleMs: 0, onPeerHit: (h, fate) => { hits.push(h); fate?.sent?.(); return true; }, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]] });
const senses = (pe) => ({ candidates: () => [], playerEntity: pe, playerHeight: 1.8, playerCrouching: false, playerInvisible: false, movingLessThanHalfSpeed: true });
const poisonsOf = (e) => (e.activeEffects ?? []).filter((a) => a.kind === 'poison').map((a) => a.poison);
const arrowsOf = (e) => (e.items ?? []).filter((it) => it.name === 'Arrow').reduce((n, it) => n + (it.stackCount ?? 1), 0);

async function twoPools() {
  const bobE = playerEntity(), macE = playerEntity();
  const bob = poolFor(bobE, []), mac = poolFor(macE, []);
  const bobHits = [], macHits = [];
  const roster = [{ id: 'bob-0002', feet: [30, 0, 30], height: 1.8 }, { id: 'mac-0001', feet: [10, 0, 10], height: 1.8 }];
  bob.setNet(netFor('bob-0002', bobHits, roster)); mac.setNet(netFor('mac-0001', macHits, roster));
  const rat = await bob.spawnFoe(0, [12, 0, 12], { feetGiven: true });
  rat.entity.level = 5; rat.entity.health = rat.entity.maxHealth = 5000;
  mac.applyFoes('bob-0002', { n: 1, k: 'world:3,12', full: 1, f: [bob.foesFrame(true).f[0]] }); await settle();
  mac.update(0.05, [10, 0, 10], [10, 1.6, 10], senses(macE));
  const pup = mac.foes.find((x) => x.puppet === 'bob-0002');
  return { bob, mac, bobE, macE, rat, pup, bobHits, macHits };
}

test('AUDIT WORLD6b-iii(e) A3/A5/A2: the pool - the dose is the CALC\'s word: a blow whose number is zero still carries it and the owner still lands it; a dose set aside for a blow that already went this frame is spent by the zero door, never carried to a later blow; a foe\'s own door on the puppet neither sends nor spends it; the zero blow\'s kind rides (a shaft that landed nothing is still a shaft, its Arrow landed at the owner)', async () => {
  const { bob, mac, macE, rat, pup, macHits } = await twoPools();
  const feet = [10, 0, 10], dir = [1, 0, 0];
  // A3: the number gates nothing
  mac.poisonFoe(pup, POISONS.Moonseed);
  mac.damageFoe(pup, 0, feet, dir);
  assert.equal(macHits.length, 1); assert.equal(macHits[0].dmg, 0); assert.equal(macHits[0].pt, POISONS.Moonseed, 'the dose rides a blow of no number');
  assert.equal(bob.applyHit('mac-0001', macHits[0]), true);
  assert.deepEqual(poisonsOf(rat.entity), [POISONS.Moonseed], 'and lands at the owner');
  // A3: spent by the zero door when a damaging blow already went this frame - never carried
  mac.poisonFoe(pup, POISONS.Arsenic);
  mac.attackFromPlayer(pup, feet, 'arrow');
  assert.equal(macHits.length, 1, 'no second frame this frame'); assert.equal(pup._divertPt, null, 'the dose spent, not carried');
  mac.damageFoe(pup, 2, feet, dir);
  assert.equal(macHits.length, 2); assert.equal(macHits[1].pt, undefined, 'the next blow carries none');
  // A5: a foe's door on the puppet leaves the dose (it is this player's blow's, read inside the provenance gate)
  mac.poisonFoe(pup, POISONS.Drothweed);
  pup.hurtFromFoe(3, null);
  assert.equal(macHits.length, 2, 'a foe\'s maul on a puppet is not mine to report'); assert.equal(pup._divertPt, POISONS.Drothweed, 'and does not spend my dose');
  mac.damageFoe(pup, 2, feet, dir);
  assert.equal(macHits[2].pt, POISONS.Drothweed, 'my next blow carries it');
  // A2: the zero blow's kind - a fresh frame, a shaft that landed nothing
  mac.update(0.05, feet, [10, 1.6, 10], senses(macE));
  mac.attackFromPlayer(pup, feet, 'arrow');
  assert.equal(macHits.length, 4); assert.equal(macHits[3].dmg, 0); assert.equal(macHits[3].kind, 'arrow'); assert.equal(macHits[3].ar, 1, 'the shaft rides the zero blow');
  const before = arrowsOf(rat.entity);
  assert.equal(bob.applyHit('mac-0001', macHits[3]), true);
  assert.equal(arrowsOf(rat.entity), before + 1, 'the owner lands the Arrow for a shaft that connected and landed nothing (BowDamage\'s :145-147 is outside the damage fork)');
  mac.update(0.05, feet, [10, 1.6, 10], senses(macE));
  mac.attackFromPlayer(pup, feet);
  assert.equal(macHits[4].kind, 'melee'); assert.equal(macHits[4].ar, undefined, 'a swing that landed nothing is a swing');
});

test('AUDIT WORLD6b-iii(e) A8: the pool - the MELEE CHAIN executed: resolvePlayerHit hands the weapon\'s poison hook to the one door and the results loop reaches the divert next, so the dose rides the same blow (a fake weapon standing in for playerWeapon.resolveHit\'s contract)', async () => {
  const { mac, pup, macHits } = await twoPools();
  const weapon = { weapon: { poisonType: -1 }, machine: { state: 'idle' }, lastDrawMs: 0,
    resolveHit(live, pe, canSee, rolls, backstabOf, say, onPoison) { assert.ok(live.includes(pup)); onPoison(pup, POISONS.Magebane); return [{ foe: pup, damage: 4 }]; } };
  assert.equal(mac.resolvePlayerHit(weapon, [10, 1.6, 10], [1, 0, 0], [10, 0, 10], () => true, null), true);
  assert.equal(macHits.length, 1); assert.equal(macHits[0].dmg, 4); assert.equal(macHits[0].kind, 'melee'); assert.equal(macHits[0].pt, POISONS.Magebane, 'the dose rides the blow the calc dosed');
  assert.deepEqual(poisonsOf(pup.entity), [], 'the shadow is not dosed'); assert.equal(pup._divertPt, null, 'spent');
});

test('AUDIT WORLD6b-iii(e) A1: the owner - HIT_ARROWS_MAX Arrows a body from peers\' shafts, past it the blow lands and no Arrow (a crafted stream minted a stack the projection refused whole); one home at both ends', async () => {
  const { bob, rat } = await twoPools();
  assert.equal(HIT_ARROWS_MAX, 255); assert.equal(relay.HIT_ARROWS_MAX, HIT_ARROWS_MAX);
  const hit = { to: 'bob-0002', k: 'world:3,12', i: rat.seq, dmg: 0, kind: 'arrow', ar: 1 };
  for (let n = 0; n < HIT_ARROWS_MAX + 40; n++) assert.equal(bob.applyHit('mac-0001', hit), true, 'the blow lands');
  assert.equal(arrowsOf(rat.entity), HIT_ARROWS_MAX, 'the pile holds the bound and no more');
  assert.equal(rat.dead, false);
  const x = rd('src/scenes/exteriorFoes.js'), d = rd('src/scenes/dungeonContext.js');
  for (const s of [x, d]) assert.match(s, /function arrowsIn\(items\) \{ let n = 0; for \(const it of items\) if \(it && it\.templateIndex === 131 && it\.name === 'Arrow'\) n \+= it\.stackCount \?\? 1; return n; \}/, 'the count, both twins');
  assert.match(d, /if \(data\.ar === 1 && kind === 'arrow' && arrowsIn\(f\.entity\.items \?\?= \[\]\) < HIT_ARROWS_MAX\) addItem\(f\.entity\.items, /, 'the dungeon host lands under the bound too');
});

test('AUDIT WORLD6b-iii(e) C2/C3: by source - the dungeon twin has the one attack door (a zero blow at a puppet goes to the host with its kind, a damaging shaft sends no second frame, no layout of mine wakes), the melee zero arm and the shaft go through it, the flight says what landed; the disease rider is the monster\'s alone in the PCAAO core too', () => {
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /function attackFromPlayer\(foe, playerFeet = null, kind = 'melee', landed = 0\) \{\s*\n\s*if \(!foe\) return;\s*\n\s*const pi = foes\.indexOf\(foe\);\s*\n\s*if \(!_authority && pi >= 0 && pi < _layoutFoes\) \{ if \(!\(landed > 0\)\) damageFoe\(foe, 0, playerFeet, null, \{ kind \}\); else foe\._divertPt = null; return; \}\s*\n\s*handleAttackFromPlayer\(foe, playerFeet\);\s*\n\s*\}/, 'the door');
  assert.match(d, /attackFromPlayer\(foe, playerFeet\);\s+\/\/ AUDIT WORLD6b-iii\(e\) C2[^\n]*\n\s*continue;/, 'the melee zero arm');
  assert.match(d, /onAttackFromPlayer: \(t, landed\) => attackFromPlayer\(t, lastPlayerFeet, 'arrow', landed\),/, 'the shaft');
  assert.match(rd('src/combat/arrowFlight.js'), /onAttackFromPlayer\?\.\(foe, dmg\);/, 'the flight says what landed');
  const x = rd('src/scenes/exteriorFoes.js');
  assert.match(x, /function attackFromPlayer\(f, playerFeet = null, kind = 'melee'\) \{[^\n]*\n\s*if \(!f\) return;\s*\n\s*if \(f\.puppet\) \{ if \(f\._divertFrame !== _peerFrame\) damageFoe\(f, 0, playerFeet, null, \{ kind \}\); else f\._divertPt = null; return; \}/, 'the exterior\'s door: the kind on the zero blow, the dose spent in the skip arm');
  for (const [p, re] of [['src/scenes/world.js', /: exteriorFoes\.attackFromPlayer\(f, player\.pos, 'arrow'\)\),/], ['src/scenes/exterior.js', /: exteriorFoes\.attackFromPlayer\(f, player\.pos, 'arrow'\)\),/], ['src/scenes/worldModes.js', /\? interiorFoes\?\.attackFromPlayer\(f, player\.pos, 'arrow'\)/]]) assert.match(rd(p), re, p);
  assert.match(x, /if \(fromPlayer && !peer\) \{\s*\n(?:\s*\/\/[^\n]*\n)*\s*const _pt = f\._divertPt \?\? null; f\._divertPt = null;/, 'A5: the dose read inside the provenance gate');
  // C3: the PCAAO core's onMonsterHit sits in the non-player, non-class arm as FormulaHelper's does
  const pc = rd('src/combat/pcaao.js');
  assert.equal((pc.match(/onMonsterHit\(/g) ?? []).length, 1, 'one call in the core');
  const i = pc.indexOf('onMonsterHit(attacker, target, hit)');
  const head = pc.slice(Math.max(0, i - 2500), i);
  assert.ok(/isPlayer\(attacker\)/.test(head) && /else if \(AIAttacker\)/.test(head), 'inside the AI (monster) arm, past the player and class-enemy arm');
  const fm = rd('src/combat/formulas.js');
  assert.equal((fm.match(/onMonsterHit\(/g) ?? []).length - (fm.match(/onMonsterHit\(attacker, target, hitDamage\)/g) ?? []).length, 0, 'formulas.js calls it once, in the monster arm (pinned by world6biiie)');
});

test('AUDIT WORLD6b-iii(e) B1/B2/B9: the Room - who carries the room\'s budget (WHO_ROOM_HZ_MAX a second, every asker together; over it dropped, nobody struck), keeps the looks it heard (a repeat ask reads no storage; after a wake the storage\'s copy is read once), answers a pose within range alone, and reads the socket again after the await', async () => {
  const r = fakeRoom('world:3,12');
  let reads = 0; const get = r.state.storage.get.bind(r.state.storage); r.state.storage.get = async (k) => { if (!Array.isArray(k)) reads++; return get(k); };
  const a = r.connect(), b = r.connect(), far = r.connect();
  await r.hello(a, 'aaaa-0001', at(1, 1)); await r.hello(b, 'bbbb-0002', at(2, 2)); await r.hello(far, 'ffff-0003', at(1 + RANGE_PIXELS + 2, 1));
  const who = (ws, id) => r.raw(ws, JSON.stringify({ t: 'who', id }));
  reads = 0;
  await who(a, 'bbbb-0002'); await who(a, 'bbbb-0002');
  assert.equal(ofType(a, 'join').filter((m) => m.id === 'bbbb-0002').length, 3, 'the hello\'s join and two answers');
  assert.equal(reads, 0, 'B1: the look was heard at the hello - no storage read');
  // B2: a member out of range answers with no pose - the pose fan's own law
  await who(a, 'ffff-0003');
  const j = ofType(a, 'join').filter((m) => m.id === 'ffff-0003').at(-1);
  assert.equal(j.pose, null, 'out of range: no pose'); assert.deepEqual(j.look, r.look, 'the look rides');
  assert.deepEqual(ofType(a, 'join').filter((m) => m.id === 'bbbb-0002').at(-1).pose, validPose(at(2, 2)), 'in range: the latest pose');
  // after a wake the instance has no looks: the storage's copy is read ONCE and then kept.
  // SLAM5: and the reader is now the HELLO, not the first `who` - the hello path fills `_looks` for the roster it
  // builds (at most ROSTER_MAX keys, never the whole room, which is the 128-key wall SLAM5 closed). So the law is
  // unchanged - one read, then kept - but the ask that pays for it moved earlier. Both halves are asserted, so
  // neither the read nor the keeping can quietly go away.
  r.wake(); reads = 0;
  const c = r.connect(); await r.hello(c, 'cccc-0004', at(1, 1));
  assert.ok(reads >= 1, 'the hello after a wake reads the roster\'s looks from storage');
  reads = 0;
  await who(c, 'bbbb-0002'); await who(c, 'bbbb-0002');
  assert.equal(reads, 0, 'and they are KEPT: a later ask about a peer the hello already read costs no storage');
  reads = 0;
  await who(c, 'ffff-0003'); await who(c, 'ffff-0003');
  assert.ok(reads <= 1, 'a peer outside that roster is read at most once, then kept too');
  assert.equal(ofType(c, 'join').filter((m) => m.id === 'bbbb-0002').length, 2);
  // B1: the room's budget - sockets asking at their own rate together, WHO_ROOM_HZ_MAX answered, the rest dropped without a strike
  const r2 = fakeRoom('world:5,5');
  const realNow = Date.now; let clock = realNow(); Date.now = () => clock;   // the room's hello gate (HELLO_HZ_MAX a second) admits the askers over two seconds; the asks then land in one instant
  const askers = [];
  let answered = 0;
  try {
    const t = r2.connect(); await r2.hello(t, 'tttt-0000', at(1, 1));
    for (let i = 0; i < 14; i++) { if (i === 7) clock += 1000; const w = r2.connect(); await r2.hello(w, `ask${String(i).padStart(3, '0')}-0${i}`, at(1, 1)); assert.equal(w.closed, null, 'hello\'d'); askers.push(w); }
    clock += 1000;
    for (const w of askers) for (let k = 0; k < WHO_HZ_MAX; k++) { await r2.raw(w, JSON.stringify({ t: 'who', id: 'tttt-0000' })); }
  } finally { Date.now = realNow; }
  for (const w of askers) answered += ofType(w, 'join').filter((m) => m.id === 'tttt-0000').length;
  assert.equal(14 * WHO_HZ_MAX > WHO_ROOM_HZ_MAX, true, 'the rig asks past the budget');
  assert.equal(answered, WHO_ROOM_HZ_MAX, `WHO_ROOM_HZ_MAX answered (${answered})`);
  for (const w of askers) { assert.equal(w.closed, null); assert.equal(w.att.junk ?? 0, 0); assert.equal(w.att.wdrops ?? 0, 0, 'no strike: the room\'s budget drops, the socket\'s own gate passed'); }
  assert.equal(WHO_ROOM_HZ_MAX, 60); assert.equal(relay.WHO_ROOM_HZ_MAX, WHO_ROOM_HZ_MAX);
  const s = rd('server/src/index.js');
  assert.match(s, /const budget = tokenGate\(this\._roomWho, now, WHO_ROOM_HZ_MAX\);\s*\n\s*this\._roomWho = budget\.bucket;\s*\n\s*if \(!budget\.pass\) return;/, 'the budget before the read');
  assert.match(s, /let look = this\._looks\.get\(b\.id\) \?\? null;\s*\n\s*if \(!look\) \{ look = \(await this\.state\.storage\.get\(lookKey\(b\.id\)\)\) \?\? null; if \(look\) this\._looks\.set\(b\.id, look\); \}/, 'the looks kept');
  assert.match(s, /if \(this\._attach\(tws\)\?\.id !== b\.id\) return;/, 'B9: the socket read again after the await');
  assert.match(s, /this\._looks\.set\(m\.id, m\.look\); \}/, 'set at the hello'); assert.match(s, /this\._looks\.delete\(a\.id\);/, 'gone at the leave'); assert.match(s, /this\._looks\.clear\(\);\s*\n\s*const dead = \['hellos'\];/, 'cleared with the sweep');
  assert.match(s, /if \(!id \|\| id === a\.id\) \{ this\._junk\(ws, a\); return; \}\s*\n\s*const target = [^\n]*\n\s*if \(!target\) return;/, 'B3: one\'s own name is junk, a name that left is nothing');
  assert.equal(RELAY_VERSION, 'world69', 'the relay says which one it is');
});

test('AUDIT WORLD6b-iii(e) B4/B6: the session forgets who it asked with the room (leave, and a join elsewhere); the parser refuses a bad name as an error, and passes a good one', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now });
  const info = console.info; console.info = () => {};
  try {
    const pose = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 };
    s.join('world:3,12', pose); sockets[0].open(); sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null });
    sockets[0].receive({ t: 'pose', id: 'eve-0003', p: pose });
    assert.equal(s._who.has('eve-0003'), true);
    s.join('world:9,9', pose);
    assert.equal(s._who.size, 0, 'a crossing forgets who was asked');
    sockets[1].open(); sockets[1].receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null });
    sockets[1].receive({ t: 'pose', id: 'eve-0003', p: pose });
    assert.ok(sockets[1].sent.some((x) => x === JSON.stringify({ t: 'who', id: 'eve-0003' })), 'asked at once in the new cell');
    s.leave();
    assert.equal(s._who.size, 0, 'and with the leave');
  } finally { console.info = info; }
  assert.deepEqual(parseClient('{"t":"who","id":"bbbb-0002"}', { hasHello: true }), { t: 'who', id: 'bbbb-0002' });
  for (const id of ['', 'a', 'x'.repeat(41), 'bbbb 0002', 7, null, { a: [1] }]) assert.deepEqual(parseClient(JSON.stringify({ t: 'who', id }), { hasHello: true }), { error: 'bad who' }, JSON.stringify(id));
  assert.deepEqual(parseClient('{"t":"who","id":"bbbb-0002"}', { hasHello: false }), { error: 'who before hello' });
  assert.equal(WHO_HZ_MAX, 5, 'B5');
});
