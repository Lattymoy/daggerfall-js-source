// STRIKE-SHARED (2026-09-29, Mac: "Do #1" - FIELD BUGS 29g's For Mac 4): A "CAST WHEN STRIKES" SPELL REACHES A FOE
// ANOTHER PLAYER RUNS. Online, a foe someone else spawned is a PUPPET on my machine - a copy its owner's next frame
// overwrites - and the strike spell landed on that copy: the damage crossed (as a blow, through the one divert) and
// every other effect (paralysis, sleep, drains, pacify, soul trap) was gone a frame later. Now the whole spell rides
// the hit to the owner (`sp` through the cast frame's own projection, `lv` the striker's level) and the owner lands it
// on its real foe through the cast engine's own foe door, every point of its damage the striker's blow. A peer's soul
// trap is its CASTER's: the owner reads no gem of its own for it and names the caster on the body's record (`j`, `q`),
// where the caster rolls it against its own pack.
//
// These pins EXECUTE the wire's law, two exterior pools (the owner's and the striker's) over a crafted MONSTER.BSA with
// the real cast engine at the owner, and the enchantment door; the dungeon twin and the hosts' wiring are pinned by
// source.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hitSpellOf, hitSpellFields, validFoeRecord, CAST_LEVEL_MAX } from '../../src/net/wire.js';
import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';
import { createPlayerMagic } from '../../src/scenes/hostMagic.js';
import { createEnchantCtx } from '../../src/scenes/hostEnchant.js';
import { SOUL_TRAP_TEMPLATE, SOUL_TRAP_TEXT, peerSoulTrapOf } from '../../src/systems/mysticism.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
function craftCfg() { const b = new Uint8Array(74); const v = new DataView(b.buffer); b[10] = 0x08; v.setUint16(52, 4, true); const attrs = [40, 50, 50, 85, 50, 50, 90, 55]; for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true); return b; }
function craftMonsterBsa(records) { const NAME_FIELD = 14, ENTRY = 18; const dataLen = records.reduce((a, [, b]) => a + b.length, 0); const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer); v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true); let pos = 4; for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; } for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; } return out; }
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const settle = () => new Promise((r) => setTimeout(r, 0));
const gem = () => ({ group: 'MiscItems', templateIndex: SOUL_TRAP_TEMPLATE, trappedSoulType: null, name: 'Soul gem' });
const playerEntity = () => ({ level: 7, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [gem()], goldPieces: 0, activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const poolFor = (pe, said) => createExteriorFoes({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n}`); }, getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 120, currentPixelKey: () => '3,12', playerEntity: pe, audio: null, onPlayerHurt: () => {}, rolls: () => 0, rand: () => 0.5, spellsByIndex: () => null, say: (l) => said.push(l),
});
// the owner's cast engine - the real one, the door world.js hands the pool (`spellOnFoe`)
const magicFor = (pe, said) => createPlayerMagic({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} }, audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
  getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }), uploadRecord() {}, uploadRecordFrame() {},
  collider: { raycast: () => Infinity }, playerEntity: pe,
  playerSinks: { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say: (l) => said.push(l) },
  say: (l) => said.push(l), surfacePlayer() {}, foes: () => [], foeSinks: () => ({}), absorbCtx: () => ({ inside: true, day: false }), rolls: () => 0.99, startCastAnim: null,   // a high roll: the foe's saving throw fails, the chance holds
});
const netFor = (me, hits, peers, magic = null) => ({
  room: () => 'world:3,12', inRoom: () => false, selfId: () => me, peers: () => peers, now: () => 0, staleMs: 0,
  onPeerHit: (h, fate) => { hits.push(h); fate?.sent?.(); return true; }, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]],
  ...(magic ? { spellOnFoe: (f, spell, level, sinks, from) => { magic.applySpellToFoe(spell, level, f, { entity: { level } }, { peerCaster: from }, sinks); } } : {}),
});
const senses = (pe) => ({ candidates: () => [], playerEntity: pe, playerHeight: 1.8, playerCrouching: false, playerInvisible: false, movingLessThanHalfSpeed: true });
const fx = (type, subType, o = {}) => ({
  type, subType, magnitudeBaseLow: 0, magnitudeBaseHigh: 0, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: 5, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1, ...o,
});
const EMPTY = { type: -1, subType: -1 };
const PARALYZE = { name: 'Hand of Sleep', index: 40, element: 4, rangeType: 1, icon: 12, effects: [fx(0, -1), EMPTY, EMPTY] };
const SHOCK = { name: 'Shock', index: 41, element: 2, rangeType: 1, effects: [fx(4, 0, { magnitudeBaseLow: 6, magnitudeBaseHigh: 6, durationBase: 0 }), fx(0, -1)] };
const TRAP = { name: 'Soul Trap', index: 42, element: 4, rangeType: 1, effects: [fx(12, -1, { chanceBase: 100 })] };
const kinds = (e) => (e.activeEffects ?? []).filter((a) => !a.ended).map((a) => a.kind);

async function twoPools() {
  const bobE = playerEntity(), macE = playerEntity();
  const bobSaid = [], macSaid = [];
  const bob = poolFor(bobE, bobSaid), mac = poolFor(macE, macSaid);
  const bobHits = [], macHits = [];
  const roster = [{ id: 'bob-0002', feet: [30, 0, 30], height: 1.8 }, { id: 'mac-0001', feet: [10, 0, 10], height: 1.8 }];
  bob.setNet(netFor('bob-0002', bobHits, roster, magicFor(bobE, bobSaid))); mac.setNet(netFor('mac-0001', macHits, roster));
  const rat = await bob.spawnFoe(0, [12, 0, 12], { feetGiven: true });
  rat.entity.level = 5;
  rat.entity.health = rat.entity.maxHealth = 500;
  const f = bob.foesFrame(true).f[0];
  mac.applyFoes('bob-0002', { n: 1, k: 'world:3,12', full: 1, f: [f] }); await settle();
  mac.update(0.05, [10, 0, 10], [10, 1.6, 10], senses(macE));
  const pup = mac.foes.find((x) => x.puppet === 'bob-0002');
  assert.ok(pup, 'the puppet stands');
  return { bob, mac, bobE, macE, bobSaid, macSaid, bobHits, macHits, rat, pup };
}

test('STRIKE-SHARED: the wire - a strike spell rides as the cast frame\'s own projection (unused slots dropped, the icon 0, any of the five range types) with the striker\'s level bounded to CAST_LEVEL_MAX; the owner reads it back whole or not at all', () => {
  const fields = hitSpellFields(PARALYZE, 7);
  assert.deepEqual(Object.keys(fields).sort(), ['lv', 'sp']);
  assert.equal(fields.lv, 7); assert.equal(fields.sp.icon, 0, 'the HUD\'s icon does not ride'); assert.equal(fields.sp.effects.length, 1, 'the empty slots do not ride');
  assert.equal(fields.sp.effects[0].type, 0); assert.equal(fields.sp.effects[0].subType, -1); assert.equal(fields.sp.effects[0].durationBase, 5);
  const back = hitSpellOf({ dmg: 0, kind: 'spell', ...fields });
  assert.deepEqual(back, { spell: fields.sp, level: 7 }, 'round trip');
  for (const rangeType of [0, 1, 2, 3, 4]) assert.ok(hitSpellFields({ ...PARALYZE, rangeType }, 1), `range type ${rangeType} rides - the owner lands it on the struck foe whatever the record says`);
  assert.equal(hitSpellFields(PARALYZE, 99).lv, CAST_LEVEL_MAX, 'the level is clamped to the wire\'s ceiling');
  assert.equal(hitSpellFields(PARALYZE, 0).lv, 1);
  for (const bad of [null, 7, { ...PARALYZE, element: 9 }, { ...PARALYZE, effects: [EMPTY, EMPTY] }, { ...PARALYZE, effects: [fx(0, -1, { chanceBase: 300 })] }, { ...PARALYZE, effects: [fx(0, -1), fx(0, -1), fx(0, -1), fx(0, -1)] }]) {
    assert.equal(hitSpellFields(bad, 5), null, `refused: ${JSON.stringify(bad)?.slice(0, 60)}`);
  }
  assert.equal(hitSpellOf({ dmg: 5 }), null, 'a hit with no spell carries none');
  for (const lv of [0, 31, 2.5, '5', undefined]) assert.equal(hitSpellOf({ ...fields, lv }), null, `lv ${lv} refuses the spell whole`);
  assert.equal(hitSpellOf({ sp: { ...fields.sp, effects: [] }, lv: 5 }), null);
  // the body's trap record
  assert.deepEqual(validFoeRecord({ i: 3, d: 1, j: 'mac-0001', q: 55 }), { i: 3, d: 1, j: 'mac-0001', q: 55 });
  for (const r of [{ i: 3, d: 0, j: 'mac-0001', q: 55 }, { i: 3, d: 1, j: 'mac-0001' }, { i: 3, d: 1, q: 55 }, { i: 3, d: 1, j: 'x', q: 55 }, { i: 3, d: 1, j: 'mac-0001', q: 101 }, { i: 3, d: 1, j: 'mac-0001', q: 2.5 }]) {
    assert.equal(validFoeRecord(r), null, `refused whole: ${JSON.stringify(r)}`);
  }
});

test('STRIKE-SHARED: the pools - my strike spell on a PUPPET goes to its owner and lands nothing on the copy; the owner lands the whole spell on its real foe (a paralysis the copy never held), the damage as MY blow; my own foe answers false (the caller lands it here as before)', async () => {
  const { bob, mac, bobSaid, macHits, rat, pup } = await twoPools();
  assert.equal(mac.spellToOwner(pup, PARALYZE, 7, [10, 0, 10]), true, 'it went');
  assert.deepEqual(kinds(pup.entity), [], 'nothing landed on the copy');
  assert.equal(macHits.length, 1);
  const hit = macHits[0];
  assert.equal(hit.to, 'bob-0002'); assert.equal(hit.i, rat.seq); assert.equal(hit.dmg, 0); assert.equal(hit.kind, 'spell');
  assert.equal(hit.lv, 7); assert.equal(hit.sp.name, 'Hand of Sleep');
  assert.deepEqual(kinds(rat.entity), []);
  assert.equal(bob.applyHit('mac-0001', hit), true);
  assert.deepEqual(kinds(rat.entity), ['paralyze'], 'the owner\'s foe is paralysed');
  assert.deepEqual(bobSaid, [], 'the owner is told nothing - the spell is not theirs');
  // a damaging strike: its damage is the striker's blow at the owner (the fighters' count names the striker)
  const hp = rat.entity.health;
  assert.equal(mac.spellToOwner(pup, SHOCK, 7), true);
  assert.equal(bob.applyHit('mac-0001', macHits[1]), true);
  assert.equal(rat.entity.health, hp - 6, 'the Shock\'s six points landed once, at the owner');
  // a foe I own is mine to land: the door answers false and sends nothing
  assert.equal(bob.spellToOwner(rat, PARALYZE, 7), false);
  assert.equal(mac.spellToOwner(pup, { ...PARALYZE, effects: [EMPTY] }, 7), false, 'a record the wire refuses stays here');
  const mt = pup.mobileType; pup.mobileType = 146;
  assert.equal(mac.spellToOwner(pup, PARALYZE, 7), false, 'a peer\'s watchman stays on the watch\'s own door (WATCH1: a blow, nothing else)');
  pup.mobileType = mt;
  assert.equal(macHits.length, 2);
  // an older owner's net (no spellOnFoe) reads past the fields: the blow lands, nothing throws
  const e = rd('src/scenes/exteriorFoes.js');
  assert.match(e, /const hs = onWatch \|\| f\.dead \? null : hitSpellOf\(data\);\n\s*if \(hs\) _net\?\.spellOnFoe\?\.\(f, hs\.spell, hs\.level, peerSpellSinks\(f, from\), from\);\n\s*if \(f\.dead\) _net\?\.onPeerHit\?\.\(\{ to: from,[^\n]*slain: 1 \}\);/, 'landed before the kill report, so a killing spell says slain; never on my watch');
});

test('STRIKE-SHARED: a peer\'s SOUL TRAP is its caster\'s - the owner marks it, says nothing and reads no gem of its own at the kill (whoever strikes), and names the caster on the body; the caster rolls it into its own pack, once, and only for a puppet it trapped', async () => {
  const { bob, mac, bobE, macE, bobSaid, macSaid, macHits, rat, pup } = await twoPools();
  assert.equal(mac.spellToOwner(pup, TRAP, 7), true);
  assert.equal(pup._trapSent, true);
  assert.equal(bob.applyHit('mac-0001', macHits[0]), true);
  assert.equal(peerSoulTrapOf(rat.entity)?.by, 'mac-0001', 'the trap is marked with its caster');
  assert.deepEqual(bobSaid, [], '"Trap active." is not the owner\'s line');
  // the OWNER's own blow kills it: its gem stays empty, the death stands
  bob.damageFoe(rat, 1000, [30, 0, 30], null, { kind: 'melee' });
  assert.equal(rat.dead, true, 'no tether - the caster\'s gems are not here to ask');
  assert.equal(bobE.items[0].trappedSoulType, null, 'the owner\'s gem is not filled');
  const rec = bob.foesFrame(true).f.find((r) => r.i === rat.seq);
  assert.equal(rec.d, 1); assert.equal(rec.j, 'mac-0001'); assert.equal(rec.q, 100);
  assert.ok(validFoeRecord(rec), 'the record passes the wire');
  mac.applyFoes('bob-0002', { n: 2, k: 'world:3,12', full: 1, f: [rec] }); await settle();
  assert.equal(pup.dead, true);
  assert.equal(macE.items[0].trappedSoulType, rat.mobileType, 'the soul is in the caster\'s gem');
  assert.deepEqual(macSaid, [SOUL_TRAP_TEXT.trapSuccess]);
  assert.equal(pup._trapSent, false, 'spent');
  const e = rd('src/scenes/exteriorFoes.js');
  assert.match(e, /if \(!f\._trapSent \|\| r\.j !== \(_net\?\.selfId\?\.\(\) \?\? null\)\) return;/, 'only a puppet I trapped, only my name');
  assert.match(e, /const trap = peer \|\| _peerTrap \? \{ allowDeath: true \} : attemptSoulTrap\(/, 'the owner reads no gem for a peer\'s trap');
});

test('STRIKE-SHARED: a puppet I did NOT trap fills no gem of mine on the owner\'s word', async () => {
  const { bob, mac, macE, macSaid, rat, pup } = await twoPools();
  (rat.entity.activeEffects ??= []).push({ kind: 'soulTrap', chance: 100, roundsRemaining: 5, by: 'mac-0001' });
  bob.damageFoe(rat, 1000, [30, 0, 30], null, { kind: 'melee' });
  const rec = bob.foesFrame(true).f.find((r) => r.i === rat.seq);
  assert.equal(rec.j, 'mac-0001');
  mac.applyFoes('bob-0002', { n: 2, k: 'world:3,12', full: 1, f: [rec] }); await settle();
  assert.equal(pup.dead, true);
  assert.equal(macE.items[0].trappedSoulType, null);
  assert.deepEqual(macSaid, []);
});

test('STRIKE-SHARED: the enchantment door - the player\'s strike on a foe another player runs goes by `spellToOwner` and lands nothing here; a foe\'s strike, or a door that answers false, lands here as before', () => {
  const player = { level: 9 };
  const foe = { entity: { mobileType: 0 }, dead: false };
  const landed = [], sent = [];
  const magic = { applySpellToFoe: (record, lvl, f) => landed.push([record.name, lvl, f]) };
  const mk = (answer) => createEnchantCtx({ playerEntity: player, spellsByIndex: () => null, now: () => 0, sinks: {}, magic, foes: () => [foe], foeSinks: () => ({}), spellToOwner: (f, r, l) => { sent.push([f, r.name, l]); return answer; } });
  mk(true).applySpellToTarget(PARALYZE, player, foe.entity);
  assert.deepEqual(sent, [[foe, 'Hand of Sleep', 9]]); assert.deepEqual(landed, []);
  mk(false).applySpellToTarget(PARALYZE, player, foe.entity);
  assert.equal(landed.length, 1, 'answered false: landed here');
  const other = { level: 3 };
  mk(true).applySpellToTarget(PARALYZE, other, foe.entity);
  assert.equal(sent.length, 2, 'a foe\'s strike is never sent');
  assert.equal(landed.length, 2);
});

test('STRIKE-SHARED: the dungeon twin and the hosts, by source - the same field on both diverts, the same send, the landing in landPeerBlow with the striker\'s provenance, the peer\'s trap on the kill and the record; the world host routes the door and the cast engine is quiet for a peer\'s trap', () => {
  const d = rd('src/scenes/dungeonContext.js');
  assert.equal((d.match(/\.\.\.\(spell \?\? \{\}\),   \/\/ STRIKE-SHARED/g) ?? []).length, 2, 'both diverts (the room\'s foe, a party member\'s own) carry the spell');
  assert.match(d, /if \(pi < 0 \|\| !\(f\._ownFrom != null \|\| \(!_authority && isRoomFoe\(f, pi\)\)\)\) return false;/, 'only a foe another player runs');
  assert.match(d, /const hs = f\.dead \? null : hitSpellOf\(data\);\n\s*if \(hs\) \{\n\s*magic\.applySpellToFoe\(hs\.spell, hs\.level, f, \{ entity: \{ level: hs\.level \} \}, \{ peerCaster: id \}, \{\n\s*\.\.\.foeSinks\(f\),\n\s*hurt: \(n, o\) => damageFoe\(f, bossStrikeAt\(f\.entity, n, 'spell', null, o\?\.element \?\? null, !!o\?\.whole, null\), null, null, \{ fromPlayer: true, peer: true, peerId: id, kind: 'spell', whole: !!o\?\.whole, element: o\?\.element \?\? null \}\),/, 'landPeerBlow lands it with the striker\'s provenance');   // PIN MOVED (AUDIT WORLD-EVENTS L2-1): and its element, resisted at the owner for the peer
  assert.match(d, /const trap = peer \|\| _peerTrap \? \{ allowDeath: true \} : attemptSoulTrap\(foe\.entity/);
  assert.match(d, /r\.j = f\._trapBy; r\.q = f\._trapQ \| 0;/);
  assert.match(d, /if \(r\.d === 1 && !f\.dead && r\.j !== undefined && f\._trapSent && r\.j === \(opts\.selfId\?\.\(\) \?\? null\)\) \{/);
  assert.match(d, /spellToOwner: \(f, record, level\) => spellToOwner\(f, record, level\),/, 'the standalone host\'s enchant ctx');
  assert.match(d, /\n\s*spellToOwner,   \/\/ STRIKE-SHARED/, 'on the context\'s API');
  const w = rd('src/scenes/world.js');
  assert.match(w, /spellToOwner: \(f, record, level\) => enchantSpellToOwner\(f, record, level\),/);
  assert.match(w, /const host = enchantFoeHost\(f, modes\?\.dungeonCtx \?\? null, _insidePool\);\n\s*if \(host === 'dungeon'\) return !!modes\?\.dungeonCtx\?\.spellToOwner\?\.\(f, record, level\);\n\s*if \(host === 'exterior'\) return exteriorFoes\.spellToOwner\(f, record, level, enchantFeet\(\)\);\n\s*return false;/, 'by membership, as the sinks and the Wabbajack are');
  assert.match(w, /spellOnFoe: \(f, spell, level, sinks, from\) => \{ magic\.applySpellToFoe\(spell, level, f, \{ entity: \{ level \} \}, \{ peerCaster: from \}, sinks\); \},/, 'the same call the pool test hands its owner');
  const m = rd('src/scenes/hostMagic.js');
  assert.match(m, /if \(r\.trapAlert && !peerCaster\) say\(SOUL_TRAP_TEXT\[r\.trapAlert\]\);/);
  assert.match(m, /if \(r\.reflected && caster\?\.entity && !peerCaster\) \{/);
});

test('STRIKE-SHARED: THE FOUR HOSTS RULE - every enchant ctx mount passes the door (the fixed-city host\'s through the dungeon\'s, its own foes streaming to no one)', () => {
  for (const [file, re] of [
    ['src/scenes/world.js', /spellToOwner: \(f, record, level\) => enchantSpellToOwner\(f, record, level\),/],
    ['src/scenes/exterior.js', /spellToOwner: \(f, record, level\) => !!modes\?\.dungeonCtx\?\.spellToOwner\?\.\(f, record, level\),/],
    ['src/scenes/dungeonContext.js', /spellToOwner: \(f, record, level\) => spellToOwner\(f, record, level\),/],
  ]) assert.match(rd(file), re, file);
  const mounts = ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js'].map((f) => (rd(f).match(/createEnchantCtx\(\{/g) ?? []).length);
  assert.deepEqual(mounts, [1, 1, 1], 'three mounts, each pinned above');
});
