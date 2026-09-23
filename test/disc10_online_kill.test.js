// DISC10-E online (2026-09-23, Mac: "Do the still open stuff"): a werewolf's
// KilledInnocent on ANOTHER player's watchman.
//
// OnWeaponHitEntity reads the target dead after DecreaseHealth
// (WeaponManager.cs:627-635). Online, a peer's watchman is a PUPPET in the
// striker's encounter pool: the blow goes to its owner as a hit and he dies
// THERE, so the striker's own call read a live puppet and the urge was never
// satisfied by the city watch online. The owner now answers a lethal blow
// with `slain` down the grant's own path back, and the striker's pool lands it
// for a puppet it struck, inside the window, once - KilledInnocent alone, on
// the live minute (the vampire already fed on the blow).
//
// Civilians and interiors are local to every client (their kills were always
// seen dead at the striker), and no dungeon holds the city watch.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { createCityGuards, GUARD_MOBILE_TYPE } from '../src/scenes/cityGuards.js';
import { createLycanthropyCurse, liveLycanthropy } from '../src/systems/lycanthropy.js';
import { LYCANTHROPY_TYPES } from '../src/systems/infection.js';
import { setWorldMinutes, playerWeaponKillReported } from '../src/systems/worldTick.js';
import { createVampirismCurse, liveVampirism } from '../src/systems/vampirism.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';

const NOW = 523530 + 40 * MINUTES_PER_DAY;   // forty days past the curse: the urge has been rising for ten

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
function stubClassCfg() {
  const b = new Uint8Array(80); const v = new DataView(b.buffer);
  v.setUint16(52, 10, true);
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true);
  return b;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 4 };
const settle = () => new Promise((r) => setTimeout(r, 0));
const fetchBytes = async (n) => { if (n === 'MONSTER.BSA') return bsa; if (n === 'CLASS18.CFG') return stubClassCfg(); throw new Error(`no ${n} in this pin`); };
const rig = (playerEntity) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
  fetchBytes, getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => NOW, currentPixelKey: () => '3,12',
  playerEntity, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
});
const human = () => ({
  isPlayer: true, level: 10, reflexes: 2, skills: new Array(40).fill(50), skillUses: new Array(40).fill(0), items: [], activeEffects: [], spells: [],
  stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50, intelligence: 50, willpower: 50, personality: 50 },
  health: 100, maxHealth: 100, crimeCommitted: 4, race: 'Nord', gender: 'male',
});
/** One client, netted as world.js nets it (identity frames); `hits` collects what it sends a peer. */
async function client(id, pe = human()) {
  const guards = createCityGuards(rig(pe));
  const pool = createExteriorFoes(rig(pe));
  const hits = [], peers = [], clock = { ms: 1000 };
  pool.setNet({
    selfId: () => id, room: () => 'world:3,12', peers: () => peers, now: () => clock.ms, onPeerHit: (h, fate) => { hits.push(h); fate?.sent?.(); return true; },
    toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]],
    watch: { list: () => guards.guards, hurt: (g, dmg, at, dir) => guards.hurtGuard(g, dmg, at, dir, { fromPlayer: false, peer: true }) },
  });
  return { pe, guards, pool, hits, peers, clock };
}
const summon = (c) => c.guards.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [{ pos: [5, 0, 5], fwdYaw: 0, guard: true, disable: () => {} }] });

/** Mac owns a watchman; Bob, a werewolf, stands him as a puppet and strikes. Answers the pair and Bob's puppet. */
async function scene() {
  setWorldMinutes(NOW);
  const mac = await client('mac-0001');
  await summon(mac);
  const g = mac.guards.guards[0];
  const werewolf = human();
  createLycanthropyCurse(werewolf, LYCANTHROPY_TYPES.Werewolf, { now: 523530 });
  const bob = await client('bob-0002', werewolf);
  assert.equal(bob.pool.applyFoes('mac-0001', mac.pool.foesFrame(true)), true);
  await settle();
  const pup = bob.pool.foes.find((f) => f.puppet === 'mac-0001');
  assert.equal(pup?.mobileType, GUARD_MOBILE_TYPE, 'Mac\'s watchman stands at Bob as a Knight_CityWatch puppet');
  mac.peers.push({ id: 'bob-0002', feet: [g.ai.feet[0] + 1, g.ai.feet[1], g.ai.feet[2]], height: 1.8 });
  mac.pool.update(0.016, [0, 0, 0], [0, 1.6, 0]);
  return { mac, bob, g, pup };
}
/** Bob's blow leaves Bob, lands at Mac, and whatever Mac answers lands at Bob. */
function exchange({ mac, bob, pup }, dmg) {
  bob.hits.length = 0; mac.hits.length = 0;
  bob.pool.damageFoe(pup, dmg, [pup.ai.feet[0] + 1, 0, pup.ai.feet[2]], [0, 0, 1], { kind: 'melee' });
  assert.equal(bob.hits.length, 1, 'the blow went to the owner');
  const blow = { ...bob.hits[0], p: [pup.ai.feet[0] + 1, pup.ai.feet[1], pup.ai.feet[2]] };
  assert.equal(mac.pool.applyHit('bob-0002', blow), true, 'and landed on his watchman');
  return mac.hits.filter((h) => h.slain !== undefined).map((h) => ({ answered: bob.pool.applyHit('mac-0001', h), h }));
}

test('DISC10-E online: a werewolf that KILLS another player\'s watchman is told so by the owner, and the urge is satisfied at the live minute; a blow that does not kill says nothing', async () => {
  const s = await scene();
  const entry = liveLycanthropy(s.bob.pe);
  const before = entry.lastKilledInnocent;
  assert.deepEqual(exchange(s, 1), [], 'a blow that leaves him standing: no report');
  assert.equal(entry.lastKilledInnocent, before);
  const r = exchange(s, 9999);
  assert.equal(s.g.dead, true, 'the watchman died at his OWNER');
  assert.equal(r.length, 1, 'one report back');
  assert.deepEqual([r[0].h.to, r[0].h.i, r[0].h.slain, r[0].h.k], ['bob-0002', s.g.seq, 1, 'world:3,12'], 'to the striker, by the watchman\'s number, keyed to the cell');
  assert.equal(r[0].answered, true, 'and Bob\'s pool lands it');
  assert.equal(entry.lastKilledInnocent, NOW, 'KilledInnocent: the urge satisfied at the live minute');
  assert.equal(entry.urgeToKillRising, false);
  assert.equal(s.bob.pe.maxHealthLimiter ?? null, null, 'and the health limiter lifted');
});

test('DISC10-E online: the report is the STRIKER\'s - refused for a puppet I never struck, past the window, a second time, from another owner, or for a foe that is no innocent; an older owner\'s frame shape is refused whole at the owner', async () => {
  const s = await scene();
  const entry = liveLycanthropy(s.bob.pe);
  const stamp = () => entry.lastKilledInnocent;
  const t0 = stamp();
  const report = { to: 'bob-0002', k: 'world:3,12', i: s.g.seq, slain: 1 };
  assert.equal(s.bob.pool.applyHit('mac-0001', report), false, 'a puppet I never struck: nothing (any socket in the cell could feed the urge)');
  assert.equal(stamp(), t0);
  s.bob.pool.damageFoe(s.pup, 1, null, null, { kind: 'melee' });
  assert.equal(s.bob.pool.applyHit('eve-0003', report), false, 'another owner\'s word about Mac\'s watchman: nothing');
  assert.equal(s.bob.pool.applyHit('mac-0001', { ...report, slain: 2 }), false, 'a malformed report: nothing');
  s.bob.clock.ms += 3001;
  assert.equal(s.bob.pool.applyHit('mac-0001', report), false, 'past the window: nothing');
  s.bob.pool.damageFoe(s.pup, 1, null, null, { kind: 'melee' });
  assert.equal(s.bob.pool.applyHit('mac-0001', report), true, 'inside it, once');
  assert.equal(s.bob.pool.applyHit('mac-0001', report), false, 'and not twice for one blow');
  assert.equal(stamp(), NOW);
  // a non-innocent puppet: the report lands (it was my blow) and satisfies nothing
  const rat = await s.mac.pool.spawnFoe(0, [30, 0, 30], { feetGiven: true });
  assert.equal(s.bob.pool.applyFoes('mac-0001', s.mac.pool.foesFrame(false)), true);
  await settle();
  const pupRat = s.bob.pool.foes.find((f) => f.puppet === 'mac-0001' && f.seq === rat.seq);
  entry.lastKilledInnocent = t0;
  s.bob.pool.damageFoe(pupRat, 1, null, null, { kind: 'melee' });
  assert.equal(s.bob.pool.applyHit('mac-0001', { ...report, i: rat.seq }), true);
  assert.equal(stamp(), t0, 'KilledInnocent asks for the city watch or a civilian - a rat is neither');
  // the report shape at an owner that predates it: no `dmg`, so the blow arm refuses it whole
  assert.equal(s.mac.pool.applyHit('bob-0002', { k: 'world:3,12', i: s.g.seq, slain: 1 }), false);
});

test('DISC10-E online: the reported death runs KilledInnocent ALONE - the vampire fed on the blow and is not fed twice; no curse, no effect', () => {
  setWorldMinutes(NOW);
  const v = human();
  createVampirismCurse(v, null, { now: 523530 });
  const vamp = liveVampirism(v);
  assert.ok(vamp && v.racialOverride, 'a vampire');
  const fed = vamp.lastTimeFed;
  assert.equal(fed, 523530);
  playerWeaponKillReported(v, { mobileType: GUARD_MOBILE_TYPE });
  assert.equal(vamp.lastTimeFed, fed, 'the report is a death, not a blow');
  const plain = human();
  playerWeaponKillReported(plain, { mobileType: GUARD_MOBILE_TYPE });
  assert.equal(plain.racialOverride ?? null, null, 'nothing on a player with no curse');
});
