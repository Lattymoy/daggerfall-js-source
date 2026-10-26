// AUDIT WORLD-EVENTS (2026-10-25, the owner: "Audit this. Ensure perfection"; bible/01-Overview/audits/Audit-World-Events.md)
// - THE BOSS TRAITS' FINDINGS (lane L2, and L5-4/L5-6/L5-12), each run through the real pools, the real stand-in spell door
// and the real save where it was found: a peer's strike spell and a stand-in's rounds unresisted; the ward sized before the
// health was; the owner's half on a fall, the wrath's clock on any wound and the wall; a raid leader's drop and its two
// traits; the ward and the wrath off the owner; a handover's ward; a load's redraw; SetHealth(0) curbed; a forged mask;
// the floating number; the relay's draw; the Spire's lords; the rules never shown; the title's word.
import '../modsOff.js';
import { test, beforeEach } from 'node:test';
import { _forceUnquietForTests } from '../../src/systems/revenant/unquietMark.js';   // the Unquiet mark held off: its draw is a fresh voice id's, so one foe in eight came "Unquiet Elite Orc"
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';
import { chooseRaider } from '../../src/systems/raidingParties.js';
import { promoteEliteFoe, promoteRaidLeader } from '../../src/systems/eliteFoes.js';
import {
  giveBossTraits, bossTake, bossTraitsTick, bossWardNow, bossTraitsOfMask, bossTraitMask, relayBossTraits, ELEMENT_TRAITS,
  RELAY_BOSS_BLOW_TRAITS, WARD_SHARE, WRATH_AFTER_S, WRATH_COOL_S, WRATH_X, tickBossClock, bossClockS, bossTraitsTaught,
  _resetBossTraitsTaughtForTests, BOSS_TRAIT_MASK_MAX,
} from '../../src/systems/bossTraits.js';
import { traitWire, readTraitWire, traitsAuthority, hostLordTraits } from '../../src/scenes/foeTraitsHost.js';
import { createStandInSpell } from '../../src/scenes/gate/standInSpell.js';
import { bossStandIn } from '../../src/world/gate/gateBoss.js';
import { COURT_ROUND_MS } from '../../src/scenes/gate/gateCourt.js';
import { applySpell } from '../../src/systems/effects.js';
import { hitSpellFields } from '../../src/net/wire.js';
import { foeTitle } from '../../src/systems/foeTitle.js';
import { foeTarget, markFoeStruck, clearFoeTarget } from '../../src/ui/hud/hudFoeTarget.js';
import { mountHitNumbers, unmountHitNumbers } from '../../src/ui/hitNumbers.js';
import { reportPlayerAttack } from '../../src/combat/formulas.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { WEAPONS } from '../../src/characters/weapons.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
// the raid guards' rig (test/scenes/bosstraits_hosts.test.js)
function craftCfg() {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  const attrs = [40, 50, 50, 85, 50, 50, 90, 55];
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
const ORC = chooseRaider(2, () => 0);
const bsa = craftMonsterBsa([[`ENEMY${String(ORC).padStart(3, '0')}.CFG`, craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 4 };
const fetchBytes = async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); };
const me = () => ({ isPlayer: true, level: 5, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50, willpower: 50, intelligence: 50, personality: 50 }, health: 100, maxHealth: 100 });
const pool = () => {
  const hurt = [], said = [];
  const p = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false,
      move: (feet, dx, dy, dz) => { feet[0] += dx; feet[2] += dz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
    fetchBytes, getTexture: async () => stubTex, uploadRecordFrame: () => {}, currentMinute: () => 523530, currentPixelKey: () => '3,12',
    playerEntity: me(), audio: null, onPlayerHurt: (n) => hurt.push(n), rolls: () => 0.5, rand: () => 0.9, say: (l) => said.push(l),
  });
  return { p, hurt, said };
};
const net = (id, extra = {}) => ({ room: () => 'world:3,12', selfId: () => id, peers: () => [], now: () => Date.now(), staleMs: 0, onPeerHit: () => true, toWire: (q) => [...q], toScene: (q) => [...q], ...extra });
const sword = createWeapon(WEAPONS.Longsword, 0, () => 0.5);
const settle = () => new Promise((r) => setTimeout(r, 50));
async function withRandom(v, fn) { const was = Math.random; Math.random = () => v; try { return await fn(); } finally { Math.random = was; } }
/** An elite of mine with exactly `traits`, its health `hp`. */
async function elite(p, traits, hp = 5000, x = 0) {
  const f = await p.spawnFoe(ORC, [x, 0, 6], { feetGiven: true, loose: true, transient: true, eliteFoe: false });
  promoteEliteFoe(f.entity, { checkLevel: false });
  f.entity.bossTraits = undefined; f.entity.bossWard = undefined; f.entity.bossTitle = undefined;
  f.entity.maxHealth = hp; f.entity.health = hp; f.entity.stats = undefined; f.entity.resistances = undefined;
  giveBossTraits(f.entity, traits);
  return f;
}
beforeEach(() => { _resetBossTraitsTaughtForTests(); clearFoeTarget(); _forceUnquietForTests(false); });   // a trait's foe, never the revenant arc's mark (unquietMark.js) - its own law, its own pins

test('AUDIT WORLD-EVENTS L2-1: a PEER\'s Cast-When-Strikes spell on my Flameproof elite lands a quarter, as mine does - its element resisted where it lands whole (mutants: the peer\'s spell unresisted)', async () => {
  const FIRE = { name: 'Burn', element: 0, rangeType: 0, effects: [{ type: 4, subType: 0, magnitudeBaseLow: 40, magnitudeBaseHigh: 40, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 }] };
  const toFoe = (spell, level, f, caster, ctx, sinks) => applySpell(spell, level, f.entity, { ...sinks, hurt: (n, o) => sinks.hurt(n, { ...(o ?? {}), element: spell?.element ?? null }) }, () => 0.99, caster, ctx);
  const { p } = pool();
  p.setNet(net('me', { spellOnFoe: (f, spell, level, sinks, from) => { toFoe(spell, level, f, { entity: { level } }, { peerCaster: from }, sinks); } }));
  const a = await elite(p, ['flameproof']);
  toFoe(FIRE, 10, a, null, undefined, { hurt: (n, o) => p.damageFoe(a, n, [0, 0, 0], null, { fromPlayer: true, kind: 'spell', whole: !!o?.whole, element: o?.element ?? null }), heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} });
  const mine = 5000 - a.entity.health;
  const b = await elite(p, ['flameproof'], 5000, 2);
  assert.equal(p.applyHit('peerA', { i: b.seq, dmg: 0, kind: 'spell', ...hitSpellFields(FIRE, 10) }), true);
  assert.equal(5000 - b.entity.health, mine, 'the same quarter');
  assert.ok(mine < 40);
});

test('AUDIT WORLD-EVENTS L2-2: a relay boss\'s resistance holds on every carried round of a spell, not the cast\'s claim alone (mutants: the rounds unresisted)', () => {
  const claimsFor = (traits) => {
    const standIn = bossStandIn({ mobile: 0 }, 'Valkynaz Ruhn');
    if (traits.length) giveBossTraits(standIn, traits, { own: false });
    standIn.stats = undefined;
    const claims = [];
    let t = 1_800_000_000_000;
    const player = { isPlayer: true, level: 20, health: 100, maxHealth: 100, skills: new Array(40).fill(60), stats: { intelligence: 50, willpower: 50, luck: 50 }, activeEffects: [], items: [] };
    const body = { boss: true, entity: standIn, warded: false };
    const door = createStandInSpell({ player, say: () => {}, rolls: () => 0.99, now: () => t, boss: () => body, crystals: () => [], host: () => [], rival: () => null,
      landOnBoss: (b, d, r, tick) => { claims.push({ d, tick: !!tick }); return true; }, landOnCrystal: () => true, landOnHost: () => true, landOnRival: () => true, nextArenaQ: () => {}, trapNow: () => null, onTrap: () => true });
    const BURN = { name: 'Burn', element: 0, rangeType: 1, effects: [{ type: 1, subType: 0, durationBase: 5, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1, magnitudeBaseLow: 10, magnitudeBaseHigh: 10, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 }] };
    door.spellOnBoss(BURN, null);
    for (let k = 0; k < 4; k++) { t += COURT_ROUND_MS; door.standInRound(); }
    return { cast: claims.filter((c) => !c.tick).map((c) => c.d), rounds: claims.filter((c) => c.tick).map((c) => c.d) };
  };
  const plain = claimsFor([]), proof = claimsFor(['flameproof']);
  assert.ok(plain.rounds.length >= 3 && plain.rounds.every((d) => d === plain.cast[0]));
  assert.ok(proof.rounds.length === plain.rounds.length && proof.rounds.every((d) => d === proof.cast[0] && d < plain.cast[0]), `rounds ${proof.rounds} beside a cast of ${proof.cast}`);
});

test('AUDIT WORLD-EVENTS L2-4: the ward is WARD_SHARE of the foe\'s health as it stands - a foe scaled after its traits were given has the share of its new maximum (mutants: the ward fixed at the give)', () => {
  const e = { maxHealth: 100, health: 100 };
  giveBossTraits(e, ['warded']);
  e.maxHealth = 1000; e.health = 1000;   // the open zone's x4 and the rest, after the stand gave the trait
  assert.equal(bossWardNow(e, 0).max, Math.round(1000 * WARD_SHARE));
  assert.equal(bossWardNow(e, 0).now, Math.round(1000 * WARD_SHARE));
  assert.deepEqual(bossTake(e, 100, { nowS: 1 }), { damage: 0, ward: 100, broke: false });
});

test('AUDIT WORLD-EVENTS L2-5: the owner\'s half is for blows - a fall is neither curbed nor warded; the wrath\'s clock starts at a player\'s blow, turns on its own tick, and lets go when the fight drops; the traits\' clock holds through a pause (mutants: a fall warded; any wound starting the wrath; the tick never turning; the cool ignored; the pause counted)', () => {
  const w = { maxHealth: 1000, health: 1000 }; giveBossTraits(w, ['warded', 'curbing']);
  assert.deepEqual(bossTake(w, 400, { nowS: 1, blow: false }), { damage: 400, ward: 0, broke: false }, 'a fall: whole, the ward untouched');
  const r = { maxHealth: 1000, health: 1000, damageScale: 1 }; giveBossTraits(r, ['wrathful']);
  bossTake(r, 10, { nowS: 0, mine: false });
  assert.equal(r.bossWrathFrom ?? null, null, 'a guard\'s blow starts no clock');
  bossTake(r, 10, { nowS: 100, mine: true });
  assert.equal(r.bossWrathFrom, 100);
  for (let s = 110; s < 100 + WRATH_AFTER_S; s += 10) { bossTake(r, 1, { nowS: s }); assert.equal(bossTraitsTick(r, s), null); }
  assert.equal(bossTraitsTick(r, 100 + WRATH_AFTER_S), 'wrath', 'its own tick turns it, struck or not');
  assert.equal(r.damageScale, WRATH_X);
  const c = { maxHealth: 1000, health: 1000 }; giveBossTraits(c, ['wrathful']);
  bossTake(c, 10, { nowS: 0 });
  assert.equal(bossTraitsTick(c, WRATH_COOL_S + 1), null);
  assert.equal(c.bossWrathFrom, null, 'no blow for WRATH_COOL_S: the fight is over');
  const s0 = tickBossClock(1_000_000);
  tickBossClock(1_000_500);
  tickBossClock(1_030_500, true);   // a window open half a minute
  tickBossClock(1_031_000);
  assert.ok(Math.abs(bossClockS() - s0 - 1) < 1e-9, 'half a second, then held, then half a second');
});

test('AUDIT WORLD-EVENTS L2-6: a raid\'s leader carries an elite\'s drop, and its two traits stand in place of any its stand drew (mutants: the drop never given)', () => {
  const e = { level: 10, maxHealth: 100, health: 100, items: [] };
  promoteRaidLeader(e, { name: 'Orc Warlord' });
  assert.equal(e.eliteFoe, true);
  assert.ok(e.items.length > 0 && e._eliteLoot === true, 'the elite\'s drop');
  const was = e.items.length;
  promoteRaidLeader(e, { name: 'Orc Warlord' });
  assert.equal(e.items.length, was, 'once');
  assert.match(rd('src/systems/raidingParties.js'), /promoteRaidLeader\(foe\.entity, \{ name: raidLeaderNameOf\(foe\.mobileType \?\? mobileType\) \}\); foe\.entity\.bossTraits = undefined; foe\.entity\.bossWard = undefined; giveBossTraits\(foe\.entity, rollBossTraits\(RAID_LEADER_TRAITS, rnd\(\)\)\);/, 'its two, in place of a stand\'s one');
});

test('AUDIT WORLD-EVENTS L2-7 / L2-8 / L2-11: two real pools - my ward\'s share rides my record, a reader draws it and hears it break; a forged mask stands an elite\'s one trait; the heir of a warded foe keeps a ward (mutants: the share unsent; the share unread; the mask untrimmed; the heir unwarded)', async () => {
  const A = pool(); A.p.setNet(net('peerA'));
  const B = pool(); B.p.setNet(net('meme'));
  const fa = await withRandom(0.01, () => A.p.spawnFoe(ORC, [0, 0, 6], { feetGiven: true, loose: true, eliteFoe: true }));
  assert.deepEqual(fa.entity.bossTraits, ['warded']);
  B.p.applyFoes('peerA', A.p.foesFrame(true, true)); await settle();
  B.p.applyFoes('peerA', A.p.foesFrame(true, true)); await settle();
  const pup = B.p.foes.find((f) => f.puppet === 'peerA');
  markFoeStruck(pup);
  assert.equal(foeTarget().ward, bossWardNow(fa.entity, bossClockS()).now, 'the reader draws the owner\'s ward');
  A.p.damageFoe(fa, fa.entity.maxHealth, [0, 0, 0], null, { kind: 'melee', weapon: sword, fromPlayer: false, striker: { entity: {} } });   // a blow that breaks it
  B.p.applyFoes('peerA', A.p.foesFrame(true, true)); await settle();
  assert.ok(B.said.some((l) => /ward on .* breaks/.test(l)), 'its break said at the reader too');
  // the heir
  const hf = A.p.foesFrame(true, true);
  for (const r of hf.f) r.e = 'meme';
  B.p.applyFoes('peerA', hf);
  const took = B.p.foes.find((f) => !f.puppet && f.mobileType === ORC && !f.dead);
  assert.ok(took?.entity?.bossWard, 'a ward of its own now');
  // a forged mask on an elite's record, through a fresh reader
  const C = pool(); C.p.setNet(net('cee'));
  const forged = A.p.foesFrame(true, true);
  for (const r of forged.f) r.bt = BOSS_TRAIT_MASK_MAX;
  C.p.applyFoes('peerA', forged); await settle(); C.p.applyFoes('peerA', forged); await settle();
  const fp = C.p.foes.find((f) => f.puppet === 'peerA');
  assert.equal(fp?.entity?.bossTraits?.length, 1, 'an elite carries one, whatever its record says');
  assert.deepEqual(bossTraitsOfMask(BOSS_TRAIT_MASK_MAX, 1), ['warded']);
  assert.deepEqual(bossTraitsOfMask(bossTraitMask(['bladeturning', 'stoneskin', 'thorned']), 2), ['bladeturning', 'thorned'], 'never an exclusive pair');
});

test('AUDIT WORLD-EVENTS L2-9: a save and a load keep an elite\'s traits, its ward\'s share and its wrath - never drawn again (mutants: the traits unsaved; the save unread)', async () => {
  const A = pool();
  const fa = await withRandom(0.01, () => A.p.spawnFoe(ORC, [0, 0, 6], { feetGiven: true, loose: true, eliteFoe: true }));
  bossTake(fa.entity, Math.round(bossWardNow(fa.entity, bossClockS()).max / 2), { nowS: bossClockS() });
  const saved = A.p.snapshotWorld((pos) => ({ x: pos[0], z: pos[2] }));
  assert.equal(saved[0].traits, bossTraitMask(['warded']));
  assert.equal(saved[0].ward, 50);
  const B = pool();
  await withRandom(0.97, async () => { B.p.restoreWorld(saved, (x, z) => [x, z], 0); await settle(); await settle(); });
  const fb = B.p.foes.find((f) => !f.dead);
  assert.deepEqual(fb.entity.bossTraits, ['warded'], 'its own, not the load\'s fresh draw');
  assert.equal(Math.round(bossWardNow(fb.entity, bossClockS()).now), Math.round(bossWardNow(fb.entity, bossClockS()).max / 2), 'its ward as it was');
});

test('AUDIT WORLD-EVENTS L2-10: a SetHealth(0) on a curbing or a warded foe kills it - no blow (mutants: the zeroing curbed)', async () => {
  const { p } = pool();
  for (const traits of [['curbing'], ['warded']]) {
    const f = await elite(p, traits, 1000);
    p.damageFoe(f, f.entity.health, null, null, { fromPlayer: false, bypassShield: true });
    assert.equal(f.dead, true, traits[0]);
  }
});

test('AUDIT WORLD-EVENTS L2-13: my resisted blow\'s floating number is the number that landed, tagged Resisted (mutants: the number unretold)', async () => {
  const nodes = [];
  const fakeEl = (tag) => { const el = { tag, children: [], style: { setProperty() {} }, dataset: {}, className: '', textContent: '', isConnected: true, append(...c) { this.children.push(...c); }, addEventListener() {}, remove() { this.isConnected = false; }, setAttribute() {} }; nodes.push(el); return el; };
  const body = fakeEl('body');
  const had = globalThis.document;
  globalThis.document = { createElement: fakeEl, getElementById: () => null, body };
  try {
    mountHitNumbers();
    const { p } = pool();
    const f = await elite(p, ['bladeturning'], 5000);
    reportPlayerAttack({ hit: true, damage: 40, target: f.entity });
    p.damageFoe(f, 40, [0, 0, 0], null, { kind: 'melee', weapon: sword });
    const num = nodes.find((n) => n.className === 'hitnum hitnum-hit');
    assert.equal(num.textContent, '20');
    assert.ok(num.children.some((c) => c.textContent === 'Resisted'));
  } finally { unmountHitNumbers(); globalThis.document = had; }
});

test('AUDIT WORLD-EVENTS L2-14: a relay boss draws one element\'s proof and one answer to a blow - never two proofs, never none (mutants: any two of eight)', () => {
  for (let i = 0; i < 400; i++) {
    const t = relayBossTraits(`Lord ${i}`, i % 7);
    assert.equal(t.filter((id) => ELEMENT_TRAITS.includes(id)).length, 1, t.join());
    assert.equal(t.filter((id) => RELAY_BOSS_BLOW_TRAITS.includes(id)).length, 1, t.join());
  }
  assert.deepEqual(relayBossTraits('Valkynaz Ruhn', 0), relayBossTraits('Valkynaz Ruhn', 0), 'the same on every machine');
});

test('AUDIT WORLD-EVENTS L2-3 / L2-7: the dungeon room\'s word on a copy - its wrath and its ward\'s share for every joiner, an own lane\'s elite its mark and traits; a joiner\'s copy takes them and keeps no ward of its own, and the client that takes the room over stands one (mutants: the wrath unsent; the own lane plain; the joiner\'s ward kept)', () => {
  const host = { eliteFoe: true, maxHealth: 1000, health: 1000 }; giveBossTraits(host, ['warded', 'wrathful']);
  host.bossWrath = true;
  assert.deepEqual(traitWire(host), { bw: 1, bv: 100 });
  assert.deepEqual(traitWire(host, true), { bw: 1, bv: 100, z: 1, bt: bossTraitMask(['warded', 'wrathful']) });
  const said = [];
  const copy = { maxHealth: 1000, health: 1000, damageScale: 1 };
  readTraitWire(copy, { z: 1, bt: bossTraitMask(['warded']), bv: 40, bw: 1 }, (l) => said.push(l), () => 'Elite Orc');
  assert.equal(copy.eliteFoe, true);
  assert.deepEqual(copy.bossTraits, ['warded']);
  assert.equal(copy.bossWard, undefined, 'no ward of its own');
  assert.equal(Math.round(bossWardNow(copy, 0).now), 120, 'drawn as the host holds it');
  const twin = { maxHealth: 1000, health: 1000, damageScale: 1 }; promoteEliteFoe(twin, { own: false });
  assert.ok(copy.bossWrath === true && Math.abs(copy.damageScale - twin.damageScale * WRATH_X) < 1e-9, 'wrathful as the host\'s');
  readTraitWire(copy, { bv: 0 }, (l) => said.push(l), () => 'Elite Orc');
  assert.ok(said.some((l) => /rage/.test(l)) && said.some((l) => /breaks/.test(l)));
  const mine = { maxHealth: 1000 }; giveBossTraits(mine, ['warded']);
  traitsAuthority(mine, false);
  assert.equal(mine.bossWard, undefined, 'a copy I only draw keeps none');
  traitsAuthority(mine, true);
  assert.ok(mine.bossWard, 'the room mine: a ward again');
});

test('AUDIT WORLD-EVENTS L5-4: a Spire lord (its target\'s `lord`) carries its two traits, said once; one of the legion carries none (mutants: the lords bare)', () => {
  const said = [];
  const lord = { lord: true, name: 'Seyth the Binder', mobile: 3, entity: { name: 'Seyth the Binder' } };
  const legion = { lord: false, name: 'Dremora', mobile: 1, entity: { name: 'Dremora' } };
  hostLordTraits(lord, (l) => said.push(l)); hostLordTraits(lord, (l) => said.push(l)); hostLordTraits(legion, (l) => said.push(l));
  assert.equal(lord.entity.bossTraits.length, 2);
  assert.equal(said.length, 1, 'said once');
  assert.equal(legion.entity.bossTraits, undefined);
  assert.match(rd('src/scenes/eliteGates/egFight.js'), /name: look\.name, lord: !!look\.lord, m: b\.max, hp: b\.hp \};/);
  assert.match(rd('src/scenes/dungeonContext.js'), /hostLordTraits\(q, \(l\) => hudText\.add\(l\)\);/);
});

test('AUDIT WORLD-EVENTS L5-6 / L5-12: each trait\'s rule is told once a session at my first blow on one; the target frame carries the rules and names the foe without the word its trait line says; the title\'s word composes in the player\'s language (mutants: the rules never told; told every blow; the word twice)', async () => {
  const { p, said } = pool();
  const f = await elite(p, ['thorned'], 5000);
  p.damageFoe(f, 5, [0, 0, 0], null, { kind: 'melee', weapon: sword });
  p.damageFoe(f, 5, [0, 0, 0], null, { kind: 'melee', weapon: sword });
  assert.equal(said.filter((l) => l.startsWith('Thorned:')).length, 1);
  assert.deepEqual(bossTraitsTaught(f.entity), [], 'taught already');
  f.entity.name = 'Orc';
  markFoeStruck(f);
  assert.deepEqual(foeTarget().traits, ['Thorned']);
  assert.ok(foeTarget().rules[0].includes('comes back at you'));
  assert.equal(foeTarget().name, 'Elite Orc', 'the name without the word its trait line says');
  assert.equal(foeTitle(f.entity, 'Orc'), 'Thorned Elite Orc', 'the title keeps it (the hover, the death line)');
  assert.match(rd('src/ui/enhanced/enhancedHud.js'), /parts\.foeTraits\.title = rules;/);
});
