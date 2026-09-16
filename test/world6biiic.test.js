// WORLD6b-iii(c) (Mac, 2026-09-14: "Continue" after AUDIT WORLD6b-iii(b)): A PUPPET'S CORPSE LOOT. A puppet's body was
// its owner's and nobody else's - "no loot of this player's" (WORLD6b) - so a peer who killed my rat, or stood over
// the one I killed, found a body that could not be opened. The law: THE PILE IS THE OWNER'S ROLL, TAKEN UNDER THE
// OWNER'S WORD. The owner's record says how many items the body holds (`o`, the wire's law); a peer's body is a loot
// target while it says more than none; a take is ASKED of the owner - a hit frame naming the body (`take`), routed to
// the owner as a blow is - and the owner answers with a GRANT (a hit frame back, `grant` the items through WORLD4's
// projection, as much as one frame carries; the rest stays and the next record still says so); the pile is emptied
// of what went only once the frame left; the taker lands the grant through the ONE take law (arrows whole, gold to
// the counter, the count said). Two takers race at the owner: the second is told the body has no treasure. No relay
// change: the hit arm routes any frame by `to`.
//
// These pins EXECUTE two pools over a crafted MONSTER.BSA - the owner's and the peer's - joined by nets that carry
// each other's frames.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validFoeRecord } from '../src/net/wire.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { generateItems, validLootList } from '../src/systems/loot.js';
import { makeHitPend } from '../src/net/hitPend.js';   // LOOT-DUP: the REAL hit queue, whose boolean is the defect

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
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
  currentMinute: () => 0, currentPixelKey: () => '3,12', playerEntity: pe, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.5, spellsByIndex: () => null, say: (l) => said.push(l),
});
const netFor = (me, hits, peers) => ({ room: () => 'world:3,12', inRoom: () => false, selfId: () => me, peers: () => peers, now: () => 0, staleMs: 0, onPeerHit: (h, fate) => { hits.push(h); fate?.sent?.(); return true; }, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]] });
const senses = (pe) => ({ candidates: () => [], playerEntity: pe, playerHeight: 1.8, playerCrouching: false, playerInvisible: false, movingLessThanHalfSpeed: true });

test('WORLD6b-iii(c): the wire - o, the body\'s pile count, a whole number in [0, 255]; else the record refused whole', () => {
  for (const r of [{ i: 1, o: 0 }, { i: 1, o: 255 }, { i: 1 }]) assert.deepEqual(validFoeRecord(r), r);
  for (const r of [{ i: 1, o: -1 }, { i: 1, o: 256 }, { i: 1, o: 1.5 }, { i: 1, o: '2' }]) assert.equal(validFoeRecord(r), null, JSON.stringify(r));
});

test('WORLD6b-iii(c): the owner\'s body says what it holds (o on the record, 0 alive, 0 once taken); the peer\'s puppet body is a loot target while it says more than none; a take asks the owner, the owner grants the pile and empties it, the taker lands it through the one take law and says the count; asked again the body has no treasure; a second taker races and gets nothing; a refused grant frame takes nothing from the pile', async () => {
  const bobE = playerEntity(), macE = playerEntity(), eveE = playerEntity();
  const bobSaid = [], macSaid = [], eveSaid = [];
  const bob = poolFor(bobE, bobSaid), mac = poolFor(macE, macSaid), eve = poolFor(eveE, eveSaid);
  const bobHits = [], macHits = [], eveHits = [];
  const roster = [{ id: 'bob-0002', feet: [30, 0, 30], height: 1.8 }, { id: 'mac-0001', feet: [10, 0, 10], height: 1.8 }, { id: 'eve-0003', feet: [12, 0, 10], height: 1.8 }];
  bob.setNet(netFor('bob-0002', bobHits, roster)); mac.setNet(netFor('mac-0001', macHits, roster)); eve.setNet(netFor('eve-0003', eveHits, roster));
  // Bob's rat, with a pile
  const rat = await bob.spawnFoe(0, [12, 0, 12], { feetGiven: true });
  const pile = generateItems('M', { level: 10, gender: 'male' }, () => 0.99);
  assert.ok(pile.length >= 1, `the loot table rolled something (${pile.length})`);
  rat.entity.items = pile.map((it) => ({ ...it }));
  const held = rat.entity.items.length;
  let f = bob.foesFrame(true).f[0];
  assert.equal(f.o, 0, 'alive: the record says no pile');
  bob.damageFoe(rat, 9999, [10, 0, 10]);
  assert.equal(rat.dead, true); assert.equal(rat.corpse, true);
  f = bob.foesFrame(true).f[0];
  assert.equal(f.d, 1); assert.equal(f.o, held, 'dead: the body says how many it holds');
  assert.ok(rat.entity.health < 0, 'the killing blow overshot'); assert.equal(f.h, 0, 'and the record clamps it into the wire\'s bound (a negative h refused the death record whole, and the full frame then REMOVED the puppet - no body ever streamed)');
  assert.ok(validFoeRecord(f), 'the death record is the wire\'s');
  // the puppet at me and at Eve, from Bob's word
  for (const [pool, pe] of [[mac, macE], [eve, eveE]]) {
    pool.applyFoes('bob-0002', { n: 1, k: 'world:3,12', full: 1, f: [{ ...f, d: 0, h: 9, o: 0 }] }); await settle();
    pool.update(0.05, [10, 0, 10], [10, 1.6, 10], senses(pe));
    pool.applyFoes('bob-0002', { n: 2, k: 'world:3,12', full: 1, f: [f] });
  }
  const pup = mac.foes.find((x) => x.puppet === 'bob-0002');
  assert.equal(pup.dead, true); assert.equal(pup.corpse, true); assert.equal(pup._pup.o, held);
  const targets = mac.lootTargets();
  assert.equal(targets.length, 1, 'the puppet\'s body is a loot target'); assert.equal(targets[0].key, `foeCorpse:${pup.uid}`);
  // the take: asked of Bob
  assert.equal(mac.takeLoot(targets[0].key, (l) => macSaid.push(l)), 0, 'nothing taken on my word');
  assert.deepEqual(macHits, [{ to: 'bob-0002', k: 'world:3,12', i: rat.seq, take: 1 }], 'the ask, routed to the owner as a blow is');
  assert.deepEqual(macSaid, [], 'and nothing said yet');
  // Bob answers
  assert.equal(bob.applyHit('mac-0001', macHits[0]), true);
  assert.equal(bobHits.length, 1); const grant = bobHits[0];
  assert.equal(grant.to, 'mac-0001'); assert.equal(grant.i, rat.seq); assert.equal(grant.grant.length, held, 'the whole pile, through WORLD4\'s projection');
  assert.deepEqual(grant.grant, validLootList(pile), 'the items as the wire clamps them');
  assert.equal(rat.entity.items.length, 0, 'emptied once the frame left');
  assert.equal(bob.foesFrame(true).f[0].o, 0, 'the next record says so');
  // the grant lands at me
  assert.equal(mac.applyHit('bob-0002', grant), true);
  assert.equal(macE.items.length + (macE.goldPieces > 0 ? 1 : 0) >= 1, true, 'the items are mine');
  assert.equal(macSaid.at(-1), held === 1 ? 'You take 1 item.' : `You take ${held} items.`, 'the one take law says the count');
  assert.equal(pup._pup.o, 0); assert.deepEqual(mac.lootTargets(), [], 'the body is no target now');
  // Eve raced: her take, Bob's empty answer
  const epup = eve.foes.find((x) => x.puppet === 'bob-0002');
  eve.takeLoot(`foeCorpse:${epup.uid}`, (l) => eveSaid.push(l));
  assert.equal(bob.applyHit('eve-0003', eveHits[0]), true);
  assert.equal(bobHits[1].to, 'eve-0003'); assert.equal(bobHits[1].i, rat.seq); assert.deepEqual(bobHits[1].grant, [], 'nothing on it'); assert.ok(Number.isInteger(bobHits[1].n), 'the owner\'s frame counter rides the grant (AUDIT WORLD6b-iii(c) A7)');
  assert.equal(eve.applyHit('bob-0002', bobHits[1]), true);
  assert.equal(eveSaid.at(-1), 'The body has no treasure.'); assert.equal(epup.corpseDisabled, true); assert.deepEqual(eve.lootTargets(), []);
  assert.equal(eveE.items.length, 0);
  // asked again at me: the body has no treasure, nothing sent
  const n = macHits.length;
  mac.takeLoot(`foeCorpse:${pup.uid}`, (l) => macSaid.push(l));
  assert.equal(macSaid.at(-1), 'The body has no treasure.'); assert.equal(macHits.length, n, 'no ask');
  // a refused grant frame takes nothing: Bob's second rat, its pile stays when the send is refused
  const rat2 = await bob.spawnFoe(0, [14, 0, 12], { feetGiven: true });
  rat2.entity.items = pile.map((it) => ({ ...it }));
  bob.damageFoe(rat2, 9999, [10, 0, 10]);
  bob.setNet({ ...netFor('bob-0002', bobHits, roster), onPeerHit: (h, fate) => { fate?.dropped?.(); return false; } });
  assert.equal(bob.applyHit('mac-0001', { to: 'bob-0002', k: 'world:3,12', i: rat2.seq, take: 1 }), true);
  assert.equal(rat2.entity.items.length, held, 'the frame did not leave: the pile stays');
  // a take for a body I do not have answers nothing on it; a grant that is not a list is refused
  bob.setNet(netFor('bob-0002', bobHits, roster));
  const sent = bobHits.length;
  bob.applyHit('mac-0001', { to: 'bob-0002', k: 'world:3,12', i: 99, take: 1 });
  assert.equal(bobHits.length, sent, 'a take for a body I do not have answers NOTHING (AUDIT WORLD6b-iii(c) A2/C4: an answer for a number invented on the spot was a frame out of me for free)');
  assert.equal(mac.applyHit('bob-0002', { to: 'mac-0001', k: 'world:3,12', i: rat.seq, grant: 'x' }), false);
  assert.equal(mac.applyHit('bob-0002', { to: 'mac-0001', k: 'world:3,12', i: rat.seq, grant: [{ templateIndex: 999999 }] }), false, 'an item the port could not mint is no grant');
});

test('WORLD6b-iii(c): a pile larger than one frame is granted in parts - the first frame carries what fits, the rest stays and the body still says it holds something', async () => {
  const bobE = playerEntity(), macE = playerEntity();
  const bob = poolFor(bobE, []), mac = poolFor(macE, []);
  const bobHits = [], macHits = [];
  const roster = [{ id: 'bob-0002', feet: [30, 0, 30], height: 1.8 }, { id: 'mac-0001', feet: [10, 0, 10], height: 1.8 }];
  bob.setNet(netFor('bob-0002', bobHits, roster)); mac.setNet(netFor('mac-0001', macHits, roster));
  const rat = await bob.spawnFoe(0, [12, 0, 12], { feetGiven: true });
  const one = generateItems('M', { level: 10, gender: 'male' }, () => 0.99)[0];
  const fat = { ...one, customEnchantments: [], name: 'x'.repeat(120) };
  rat.entity.items = Array.from({ length: 60 }, () => ({ ...fat, notes: 'y'.repeat(120) }));
  bob.damageFoe(rat, 9999, [10, 0, 10]);
  assert.equal(bob.applyHit('mac-0001', { to: 'bob-0002', k: 'world:3,12', i: rat.seq, take: 1 }), true);
  const g = bobHits[0];
  assert.ok(g.grant.length >= 1 && g.grant.length < 60, `a part (${g.grant.length})`);
  assert.ok(JSON.stringify({ t: 'hit', data: g }).length <= 12 * 1024, 'under the frame\'s ceiling');
  assert.equal(rat.entity.items.length, 60 - g.grant.length, 'the rest stays');
  assert.equal(bob.foesFrame(true).f[0].o, 60 - g.grant.length, 'and the body still says it holds something');
});

test('WORLD6b-iii(c): by source - the record and the reader, the target, the ask, the grant emptied only once the frame left, the record', () => {
  const x = rd('src/scenes/exteriorFoes.js');
  assert.match(x, /o: f\.corpse \? Math\.min\(255, f\.entity\?\.items\?\.length \| 0\) : 0 \};/, 'the record');
  assert.match(x, /if \(r\.o !== undefined\) \{ p\.o = r\.o; if \(r\.o > 0 && !\(f\._closedN != null && \(_owners\.get\(f\.puppet\)\?\.n \?\? 0\) <= f\._closedN\)\) f\.corpseDisabled = false; \}/, 'the reader (AUDIT WORLD6b-iii(c) A7: a word older than the grant that closed it re-opens nothing)');
  assert.match(x, /isCorpse: \(f\) => !!f\.corpse && !!f\.entity && \(!f\.puppet \|\| \(f\._pup\?\.o \| 0\) > 0\),/, 'the target');
  assert.match(x, /_net\?\.onPeerHit\?\.\(\{ to: f\.puppet, k: _owners\.get\(f\.puppet\)\?\.k \?\? _net\.room\?\.\(\) \?\? null, i: f\.seq, take: 1 \},\s*\{ sent: \(\) => \{ f\._takeAsked = _now\(\); \} \}\);/, 'the ask, keyed to the owner\'s cell, latched when the frame left (AUDIT WORLD6b-iii(c) B1; LOOT-DUP: and left is THIS frame\'s word, not the hit queue\'s)');
  assert.match(x, /const held = items\.splice\(0, grant\.length\);\s*const back = \(\) => \{ items\.unshift\(\.\.\.held\); \};\s*if \(!_net\?\.onPeerHit\) \{ back\(\); return; \}\s*_net\.onPeerHit\(frame, \{ dropped: back \}\);/, 'LOOT-DUP: the items are RESERVED when the frame is accepted and put back if it never leaves - splicing on the queue\'s boolean granted the same pile twice (AUDIT WORLD6b-iii(c) A3/C2)');
  assert.match(x, /const n = takeCorpseLoot\(\{ entity: \{ items: grant \} \}, playerEntity, say \?\? \(\(\) => \{\}\)\);/, 'the one take law');
  assert.match(rd('bible/06-Systems/Online-Arc.md'), /### 6b-iii\(c\): a puppet's corpse loot/, 'the record');
});

// LOOT-DUP (2026-09-15, AUDIT ONCRASH1's own finding): THE SAME PILE CANNOT BE GRANTED TWICE.
//
// `grantCorpse` emptied the body on `onPeerHit`'s return, and that return is the hit QUEUE's news, not this frame's:
// a grant that is merely QUEUED answers false and is usually sent a frame later. So the taker's pack filled while
// the corpse kept the same list, and the next peer to ask that body was granted the same loot again - silent
// duplication, online only. The items are RESERVED when the frame is accepted now, and put back only if it never
// leaves. These pins drive the real hit queue, not a stub that always answers true.
test('LOOT-DUP: a grant queued behind a shut gate does not leave the pile on the body - a second asker is granted NOTHING while it is in flight, and the delivered grant is the only copy (mutant: the splice back on onPeerHit\'s boolean, which granted the same pile to everyone who asked)', async () => {
  const bobE = playerEntity(), macE = playerEntity(), eveE = playerEntity();
  const bobSaid = [], macSaid = [], eveSaid = [];
  const bob = poolFor(bobE, bobSaid), mac = poolFor(macE, macSaid), eve = poolFor(eveE, eveSaid);
  const roster = [{ id: 'bob-0002', feet: [30, 0, 30], height: 1.8 }, { id: 'mac-0001', feet: [10, 0, 10], height: 1.8 }, { id: 'eve-0003', feet: [12, 0, 10], height: 1.8 }];
  // THE REAL QUEUE, with a gate we can shut - this is the state the boolean lied about
  const wire = [];
  let open = false, at = 0;
  const pend = makeHitPend({ send: (h) => { if (!open) return false; wire.push(h); return true; }, room: () => 'world:3,12', now: () => at, warn: () => {} });
  const bobHits = [], macHits = [], eveHits = [];
  bob.setNet({ ...netFor('bob-0002', bobHits, roster), onPeerHit: (h, fate) => pend.send(h, fate) });
  mac.setNet(netFor('mac-0001', macHits, roster)); eve.setNet(netFor('eve-0003', eveHits, roster));

  const rat = await bob.spawnFoe(0, [12, 0, 12], { feetGiven: true });
  const pile = generateItems('M', { level: 10, gender: 'male' }, () => 0.99);
  rat.entity.items = pile.map((it) => ({ ...it }));
  const held = rat.entity.items.length;
  assert.ok(held >= 1);
  bob.damageFoe(rat, 9999, [10, 0, 10]);

  // Mac asks while the gate is SHUT: the grant is queued, and the body is already empty of what it promised
  assert.equal(bob.applyHit('mac-0001', { to: 'bob-0002', k: 'world:3,12', i: rat.seq, take: 1 }), true);
  assert.equal(wire.length, 0, 'the gate is shut: nothing on the wire yet');
  assert.equal(rat.entity.items.length, 0, 'and the pile is RESERVED - this is the whole fix: it is not on the body to be granted again');
  // Eve asks for the same body, in that window
  assert.equal(bob.applyHit('eve-0003', { to: 'bob-0002', k: 'world:3,12', i: rat.seq, take: 1 }), true);
  // the gate opens: both frames leave, in order
  open = true;
  pend.flush(at);
  const grants = wire.filter((h) => Array.isArray(h.grant));
  assert.equal(grants.length, 2, 'both askers were answered');
  assert.equal(grants[0].to, 'mac-0001'); assert.equal(grants[0].grant.length, held, 'the first asker gets the pile');
  assert.equal(grants[1].to, 'eve-0003'); assert.deepEqual(grants[1].grant, [], 'the second gets NOTHING - it was already in flight');
  assert.equal(rat.entity.items.length, 0, 'and the body stays empty: one pile, one taker');
  // one pile left Bob, once - the landing itself is the test above's subject
  assert.equal(grants[0].grant.length + grants[1].grant.length, held, 'the pile crossed the wire exactly once, whole');
});

test('LOOT-DUP: a grant that never leaves puts the pile BACK - the frame aged out of the queue, so the body still holds what it promised (mutant: the reservation kept, which loses the loot instead of duplicating it)', async () => {
  const bobE = playerEntity(), bobSaid = [];
  const bob = poolFor(bobE, bobSaid);
  const roster = [{ id: 'bob-0002', feet: [30, 0, 30], height: 1.8 }, { id: 'mac-0001', feet: [10, 0, 10], height: 1.8 }];
  let at = 0;
  const pend = makeHitPend({ send: () => false, room: () => 'world:3,12', now: () => at, ms: 100, warn: () => {} });
  bob.setNet({ ...netFor('bob-0002', [], roster), onPeerHit: (h, fate) => pend.send(h, fate) });
  const rat = await bob.spawnFoe(0, [12, 0, 12], { feetGiven: true });
  rat.entity.items = generateItems('M', { level: 10, gender: 'male' }, () => 0.99).map((it) => ({ ...it }));
  const held = rat.entity.items.length;
  bob.damageFoe(rat, 9999, [10, 0, 10]);
  bob.applyHit('mac-0001', { to: 'bob-0002', k: 'world:3,12', i: rat.seq, take: 1 });
  assert.equal(rat.entity.items.length, 0, 'reserved while it waits');
  at = 500;
  pend.flush(at);   // the fight moved on: the frame is dropped
  assert.equal(rat.entity.items.length, held, 'and the pile is back on the body, whole');
});
