// RPT1026-FIGHTS TRAP-TO-OWNER (a private report: in a party member's dungeon, Soul Trap on Daedra Lords said "Trap
// active." and no soul was ever trapped, whichever of the two killed them). Two holes, both where the foe is another player's:
//   - MY CAST'S TRAP ON THEIR FOE lay on my copy. A missile or a touch of Soul Trap went through the cast engine's foe door
//     onto the puppet my machine draws ("Trap active."), while the foe itself - the runner's - never held it; it fell on
//     the runner's machine with no trap, whoever struck. STRIKE-SHARED (Field-Bugs-2026-09-29g) carried a STRIKE's trap to
//     the runner; a cast's never went. Its Soul Trap now rides the same door, and I roll the soul when the runner's record
//     names me on the body (`j`, `q`).
//   - THE RUNNER'S OWN TRAP, killed by my blow: AUDIT WORLD2 B9 had a peer's killing blow read no gem of the runner's, so
//     a trap the runner laid on its own foe was spent for nothing when its party member struck the last blow. A soul is
//     its trap's caster's whoever struck (DFU's EnemyEntity.SetHealth: every damage source alike); a peer's blow is still
//     never tethered, and fills no Azura's Star.
// The pins run the wire's law over two street pools (the runner's and mine) with the real cast engine at each - the
// strikeshared.test.js fixture - and the dungeon's twin by source. tools/mutants/rpt1026_fights.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';
import { createPlayerMagic } from '../../src/scenes/hostMagic.js';
import { createEnchantCtx } from '../../src/scenes/hostEnchant.js';
import { setDefaultEnchantCtx, spellToFoeOwner } from '../../src/systems/enchantments.js';
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
/** A player's own cast engine - the real one; `trapToOwner` its host's door (the session's when none is handed). */
const magicFor = (pe, said, foeSinks, trapToOwner) => createPlayerMagic({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} }, audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
  getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }), uploadRecord() {}, uploadRecordFrame() {},
  collider: { raycast: () => Infinity }, playerEntity: pe,
  playerSinks: { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say: (l) => said.push(l) },
  say: (l) => said.push(l), surfacePlayer() {}, foes: () => [], foeSinks: foeSinks ?? (() => ({})), absorbCtx: () => ({ inside: true, day: false }), rolls: () => 0.99, startCastAnim: null,
  ...(trapToOwner ? { trapToOwner } : {}),
});
const netFor = (me, hits, peers, magic = null) => ({
  room: () => 'world:3,12', inRoom: () => false, selfId: () => me, peers: () => peers, now: () => 0, staleMs: 0,
  onPeerHit: (h, fate) => { hits.push(h); fate?.sent?.(); return true; }, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]],
  ...(magic ? { spellOnFoe: (f, spell, level, sinks, from) => { magic.applySpellToFoe(spell, level, f, { entity: { level } }, { peerCaster: from }, sinks); } } : {}),
});
const senses = (pe) => ({ candidates: () => [], playerEntity: pe, playerHeight: 1.8, playerCrouching: false, playerInvisible: false, movingLessThanHalfSpeed: true });
const fx = (type, subType, o = {}) => ({ type, subType, magnitudeBaseLow: 0, magnitudeBaseHigh: 0, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 5, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1, ...o });
/** A missile of Soul Trap and a Shock with it - my cast. */
const TRAP_BOLT = { name: 'Snare Bolt', index: 43, element: 2, rangeType: 2, effects: [fx(12, -1, { chanceBase: 100 }), fx(4, 0, { magnitudeBaseLow: 6, magnitudeBaseHigh: 6, durationBase: 0 })] };
const TRAP = { name: 'Soul Trap', index: 42, element: 4, rangeType: 1, effects: [fx(12, -1, { chanceBase: 100 })] };
const kinds = (e) => (e.activeEffects ?? []).filter((a) => !a.ended).map((a) => a.kind);
/** A foe's sinks as a host builds them for my spell on it (the street's: every hurt through the pool's one damage door). */
const sinksOf = (pool, f) => ({ hurt: (n, o) => pool.damageFoe(f, n, null, null, { kind: 'spell', fromPlayer: true, whole: !!o?.whole, element: o?.element ?? null }), heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} });

/** Bob runs the rat; Mac stands beside it, its copy a puppet on his machine - each with his own cast engine. */
async function twoPools() {
  const bobE = playerEntity(), macE = playerEntity();
  const bobSaid = [], macSaid = [];
  const bob = poolFor(bobE, bobSaid), mac = poolFor(macE, macSaid);
  const bobHits = [], macHits = [];
  const roster = [{ id: 'bob-0002', feet: [30, 0, 30], height: 1.8 }, { id: 'mac-0001', feet: [10, 0, 10], height: 1.8 }];
  const bobMagic = magicFor(bobE, bobSaid, null, (f, sp, lv) => bob.spellToOwner(f, sp, lv, [30, 0, 30]));
  const macMagic = magicFor(macE, macSaid, null, (f, sp, lv) => mac.spellToOwner(f, sp, lv, [10, 0, 10]));
  bob.setNet(netFor('bob-0002', bobHits, roster, bobMagic)); mac.setNet(netFor('mac-0001', macHits, roster));
  const rat = await bob.spawnFoe(0, [12, 0, 12], { feetGiven: true });
  rat.entity.level = 5;
  rat.entity.health = rat.entity.maxHealth = 500;
  const f = bob.foesFrame(true).f[0];
  mac.applyFoes('bob-0002', { n: 1, k: 'world:3,12', full: 1, f: [f] }); await settle();
  mac.update(0.05, [10, 0, 10], [10, 1.6, 10], senses(macE));
  const pup = mac.foes.find((x) => x.puppet === 'bob-0002');
  assert.ok(pup, 'the puppet stands');
  return { bob, mac, bobE, macE, bobSaid, macSaid, bobHits, macHits, rat, pup, bobMagic, macMagic };
}

test('RPT1026-FIGHTS TRAP-TO-OWNER MY CAST\'S TRAP ON A FOE ANOTHER PLAYER RUNS: its Soul Trap rides to the runner (the rest of my spell lands as ever - its damage a blow of mine at the runner), the runner\'s foe holds it marked mine, my copy holds nothing; whoever kills it, the runner names me on the body and the soul is in MY gem (mutants: the cast\'s trap laid on my copy, as the report found it)', async () => {
  const { bob, mac, bobE, macE, bobSaid, macSaid, macHits, rat, pup, macMagic } = await twoPools();
  macMagic.applySpellToFoe(TRAP_BOLT, 7, pup, { entity: macE }, undefined, sinksOf(mac, pup));
  assert.ok(!kinds(pup.entity).includes('soulTrap'), 'no trap laid on my copy - it was laid there, "Trap active.", and the runner\'s foe never held it');
  assert.ok(!macSaid.includes(SOUL_TRAP_TEXT.trapActive), 'the save is the runner\'s to roll - STRIKE-SHARED\'s own word');
  assert.equal(pup._trapSent, true, 'I sent a trap to this one');
  const trapHit = macHits.find((h) => h.sp);
  assert.ok(trapHit, 'the trap rode a hit to the runner');
  assert.deepEqual(trapHit.sp.effects.map((e) => e.type), [12], 'the trap alone - the Shock lands as my blow');
  assert.ok(macHits.some((h) => !h.sp && h.dmg > 0 && h.kind === 'spell'), 'the Shock: a blow of mine, as every spell\'s damage on a puppet');
  for (const h of macHits) assert.equal(bob.applyHit('mac-0001', h), true);
  assert.equal(peerSoulTrapOf(rat.entity)?.by, 'mac-0001', 'the runner\'s foe holds my trap');
  assert.deepEqual(bobSaid, [], 'and says nothing of it');
  // Bob's own blow kills it (the report's two players each striking it)
  bob.damageFoe(rat, 1000, [30, 0, 30], null, { kind: 'melee' });
  assert.equal(rat.dead, true);
  assert.equal(bobE.items[0].trappedSoulType, null, 'not the runner\'s gem');
  const rec = bob.foesFrame(true).f.find((r) => r.i === rat.seq);
  assert.deepEqual([rec.d, rec.j], [1, 'mac-0001']);
  mac.applyFoes('bob-0002', { n: 2, k: 'world:3,12', full: 1, f: [rec] }); await settle();
  assert.equal(macE.items[0].trappedSoulType, rat.mobileType, 'the soul is mine');
  assert.ok(macSaid.includes(SOUL_TRAP_TEXT.trapSuccess));
});

test('RPT1026-FIGHTS TRAP-TO-OWNER MY CAST\'S TRAP ON MY OWN FOE stays mine to lay: the door answers false and it lands here, "Trap active." said, as ever; and the session\'s door is the one STRIKE-SHARED\'s strike takes (mutants: every cast\'s trap sent away)', async () => {
  const { bob, bobE, bobSaid, rat, bobMagic } = await twoPools();
  bobMagic.applySpellToFoe(TRAP, 7, rat, { entity: bobE }, undefined, sinksOf(bob, rat));
  assert.deepEqual(kinds(rat.entity), ['soulTrap'], 'laid on my own foe');
  assert.equal(peerSoulTrapOf(rat.entity), null, 'mine - no peer\'s mark');
  assert.ok(bobSaid.includes(SOUL_TRAP_TEXT.trapActive));
  // the session's door: the mounted enchantment ctx's own spellToOwner (none mounted: no door)
  assert.equal(spellToFoeOwner({}, TRAP, 7), false);
  const sent = [];
  setDefaultEnchantCtx(createEnchantCtx({ playerEntity: bobE, spellsByIndex: () => null, now: () => 0, sinks: {}, magic: {}, foes: () => [], spellToOwner: (f, r, l) => { sent.push([f, r.name, l]); return true; } }));
  try {
    const foe = { entity: {} };
    assert.equal(spellToFoeOwner(foe, TRAP, 9), true);
    assert.deepEqual(sent, [[foe, 'Soul Trap', 9]]);
  } finally { setDefaultEnchantCtx(null); }
});

test('RPT1026-FIGHTS TRAP-TO-OWNER THE RUNNER\'S OWN TRAP, KILLED BY ITS PARTY MEMBER: the soul is the runner\'s - its gem filled, its line said - and the death stands (a peer\'s blow is never tethered: with no empty gem the foe falls); a foe with no trap fills nothing (mutants: a peer\'s kill reads no gem of the runner\'s, as B9 had it; a peer\'s blow tethered)', async () => {
  const { bob, mac, bobE, bobSaid, macHits, rat, pup, bobMagic } = await twoPools();
  bobMagic.applySpellToFoe(TRAP, 7, rat, { entity: bobE }, undefined, sinksOf(bob, rat));
  assert.deepEqual(kinds(rat.entity), ['soulTrap']);
  bobSaid.length = 0;
  mac.damageFoe(pup, 1000, [10, 0, 10], null, { kind: 'melee' });
  const hit = macHits.at(-1);
  assert.ok(hit && hit.dmg > 0, 'my blow went to the runner');
  assert.equal(bob.applyHit('mac-0001', hit), true);
  assert.equal(rat.dead, true, 'the peer\'s blow kills');
  assert.equal(bobE.items[0].trappedSoulType, rat.mobileType, 'the runner\'s trap, the runner\'s soul');
  assert.deepEqual(bobSaid.filter((l) => Object.values(SOUL_TRAP_TEXT).includes(l)), [SOUL_TRAP_TEXT.trapSuccess]);
  // no empty gem: a peer's blow still kills - no tether
  const t = await twoPools();
  t.bobE.items = [];
  t.bobMagic.applySpellToFoe(TRAP, 7, t.rat, { entity: t.bobE }, undefined, sinksOf(t.bob, t.rat));
  t.mac.damageFoe(t.pup, 1000, [10, 0, 10], null, { kind: 'melee' });
  assert.equal(t.bob.applyHit('mac-0001', t.macHits.at(-1)), true);
  assert.equal(t.rat.dead, true, 'never held at 1 for a blow not mine');
  assert.ok(t.bobSaid.includes(SOUL_TRAP_TEXT.trapNoneEmpty));
});

test('RPT1026-FIGHTS TRAP-TO-OWNER THE DUNGEON\'S TWIN, by source: the room\'s runner reads its own trap whoever struck, and tethers only its own blow - the street pool\'s law (mutants: the dungeon\'s peer kill reads no gem)', () => {
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /const trap = _peerTrap \? \{ allowDeath: true \} : attemptSoulTrap\(foe\.entity, foe\.mobileType, playerEntity\.items, Math\.random\(\)\);\n\s+if \(trap\.alert\) hudText\.add\(SOUL_TRAP_TEXT\[trap\.alert\]\);\n\s+if \(!trap\.allowDeath && !peer\) \{ foe\.entity\.health = 1; return; \}/);
  // its cast engine takes the session's door (none handed: the default)
  assert.ok(!/trapToOwner:/.test(d), 'the dungeon hands no door of its own - the session\'s routes by the pool');
  const h = rd('src/scenes/hostEnchant.js');
  assert.match(h, /spellToOwner: \(f, record, level\) => !!spellToOwner\?\.\(f, record, level\),/, 'the ctx offers STRIKE-SHARED\'s door');
});
