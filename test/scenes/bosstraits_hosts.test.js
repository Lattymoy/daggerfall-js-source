// BOSS-TRAITS (2026-10-25, bible/05-Combat/Boss-Traits.md): THE DOORS - a foe with traits met through the real open
// world's pool (scenes/exteriorFoes.js damageFoe: the striker's half, then the owner's), an elite of my own standing with
// its trait, its record carrying them to every puppet, and the dungeon host's and the stand-ins' doors by their source.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';
import { chooseRaider } from '../../src/systems/raidingParties.js';
import { promoteEliteFoe } from '../../src/systems/eliteFoes.js';
import { giveBossTraits, WARD_SHARE, THORN_SHARE, CURB_SHARE } from '../../src/systems/bossTraits.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { WEAPONS } from '../../src/characters/weapons.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

// the raid guards' rig (test/scenes/fb0929_raidguards.test.js): a synthetic CLASS18.CFG and MONSTER.BSA holding the orc's
// ENEMY007.CFG, a flat open world
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
const rig = (playerEntity, hurt, said) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false,
    move: (feet, dx, dy, dz) => { feet[0] += dx; feet[2] += dz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
  fetchBytes, getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 523530, currentPixelKey: () => '3,12',
  playerEntity, audio: null, onPlayerHurt: (n) => hurt.push(n), rolls: () => 0.5, rand: () => 0.9, say: (l) => said.push(l),
});

test('BOSS-TRAITS THE OPEN WORLD\'S DOOR, run on the real pool: my sword on a Warded, Thorned elite - the thorns a fifth of my blow at me, the ward taking it first and breaking, said once; a Curbing foe takes no more than its share a blow; a foe with no traits is the door as it was (mutants: the striker\'s half unwired; the owner\'s half unwired; the thorns unsent)', async () => {
  const hurt = [], said = [];
  const pool = createExteriorFoes(rig(me(), hurt, said));
  const sword = createWeapon(WEAPONS.Longsword, 0, () => 0.5);
  const orc = await pool.spawnFoe(ORC, [0, 0, 6], { feetGiven: true, loose: true, transient: true, eliteFoe: false });
  promoteEliteFoe(orc.entity, { checkLevel: false });
  orc.entity.bossTraits = undefined;   // whatever the spawn drew, this pin sets its own
  giveBossTraits(orc.entity, ['warded', 'thorned']);
  const max = orc.entity.maxHealth, ward = Math.round(max * WARD_SHARE);
  orc.entity.health = max;
  pool.damageFoe(orc, Math.floor(ward / 2), [0, 0, 0], null, { kind: 'melee', weapon: sword });
  assert.equal(orc.entity.health, max, 'the ward took it');
  assert.deepEqual(hurt, [Math.max(1, Math.round(Math.floor(ward / 2) * THORN_SHARE))], 'the thorns at me');
  pool.damageFoe(orc, ward, [0, 0, 0], null, { kind: 'melee', weapon: sword });
  assert.equal(orc.entity.health, max - (ward - Math.ceil(ward / 2)), 'the rest through');
  assert.equal(said.filter((l) => /ward on .* breaks/.test(l)).length, 1, 'said once');
  const cb = await pool.spawnFoe(ORC, [2, 0, 6], { feetGiven: true, loose: true, transient: true, eliteFoe: false });
  cb.entity.maxHealth = 1000; cb.entity.health = 1000;
  giveBossTraits(cb.entity, ['curbing']);
  pool.damageFoe(cb, 400, [0, 0, 0], null, { kind: 'melee', weapon: sword });
  assert.equal(cb.entity.health, 1000 - 1000 * CURB_SHARE);
  const plain = await pool.spawnFoe(ORC, [4, 0, 6], { feetGiven: true, loose: true, transient: true, eliteFoe: false });
  const h0 = plain.entity.health;
  pool.damageFoe(plain, 3, [0, 0, 0], null, { kind: 'melee', weapon: sword });
  assert.equal(plain.entity.health, h0 - 3, 'no traits: as it was');
});

test('BOSS-TRAITS WHO CARRIES THEM, by the hosts\' source: an elite of my own draws one at its stand and its record carries the mask, the wrath and a leader\'s mark to every puppet, which takes them on an elite alone; the dungeon\'s elites draw off the pick\'s seed; the relay bosses\' stand-ins carry the striker\'s traits, said once, and every blow and spell of mine on one is resisted before its number goes (mutants: the elite bare; the record silent; a puppet\'s plain foe traited; the dungeon unseeded; the stand-in untraited)', () => {
  const x = rd('src/scenes/exteriorFoes.js');
  assert.match(x, /if \(entity\.eliteFoe && !puppet && !entity\.raidLeader && !bossTraitsOf\(entity\)\.length\) eliteTraits\(entity\);/);
  assert.match(x, /\.\.\.\(bossTraitsOf\(f\.entity\)\.length \? \{ bt: bossTraitMask\(f\.entity\.bossTraits\) \} : \{\}\), \.\.\.\(f\.entity\?\.bossWrath \? \{ bw: 1 \} : \{\}\), \.\.\.\(f\.entity\?\.bossWard \? \{ bv: bossWardShare\(f\.entity\) \} : \{\}\), \.\.\.\(f\.entity\?\.raidLeader \? \{ rl: 1 \} : \{\}\)/);   // PIN MOVED - AUDIT WORLD-EVENTS L2-7: and its ward's share
  assert.match(x, /if \(f\.entity\.eliteFoe && r\.bt\) \{ giveBossTraits\(f\.entity, bossTraitsOfMask\(r\.bt, r\.rl === 1 \? 2 : 1\), \{ own: false \}\); if \(r\.bw === 1 && markBossWrath\(f\.entity\)\) say\?\.\(bossWrathLine\(/);   // PIN MOVED - AUDIT WORLD-EVENTS L2-11: the mask trimmed; L2-7: its wrath said at a reader
  assert.match(x, /if \(fromPlayer && !peer\) damage = strikeTraits\(f\.entity, damage, kind, weapon, element, _whole \|\| bypassShield, \(n\) => \{ onPlayerHurt\?\.\(n, null\); flashPlayerDamage\(n\); \}, say\);/);   // PIN MOVED - AUDIT WORLD-EVENTS L2-10 / L2-13 / L5-6 (scenes/foeTraitsHost.js)
  assert.ok(x.indexOf('damage = strikeTraits(f.entity') < x.indexOf('    if (f.puppet) {\n      if (!fromPlayer && striker'), 'the striker\'s half before the divert');
  assert.match(x, /damage = bossTakeAt\(f\.entity, damage, _whole \|\| bypassShield, bossClockS\(\), say, [^\n]*\{ blow: fromPlayer \|\| striker != null \|\| kind !== 'melee', mine: fromPlayer \}\);/);   // PIN MOVED - AUDIT WORLD-EVENTS L2-5 / L2-10
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /\{ if \(e\.elite\) entity\.elite = true; eliteTraits\(entity, e\.eliteSeed\); return; \}/);
  assert.match(rd('src/systems/eliteFoes.js'), /enemies\[i\]\.eliteSeed = eliteHash\('elite-trait', key, i\);/);
  assert.match(d, /if \(!b\.entity\.bossTraits && giveBossTraits\(b\.entity, relayBossTraits\(b\.entity\.name, b\.mobile\), \{ own: false \}\)\) hudText\.add\(bossTraitsMetLine\(/);
  assert.match(d, /landOnBoss\(boss, bossStrikeAt\(boss\.entity, damage, 'melee', playerWeapon\.strikingWeapon, null, false, \(n\) => hurtPlayer\(n\)\), HIT_KINDS\.Melee\);/);
  assert.match(d, /dealDamage: \(t, d\) => landOnBoss\(boss, bossStrikeAt\(boss\.entity, d, 'arrow', null, null, false, \(n\) => hurtPlayer\(n\)\), HIT_KINDS\.Shaft\)/);
  assert.match(d, /if \(fromPlayer && !peer\) damage = strikeTraits\(foe\.entity, damage, kind, weapon, element, _whole \|\| bypassShield, \(n\) => hurtPlayer\(n\), \(l\) => hudText\.add\(l\)\);/);   // PIN MOVED - AUDIT WORLD-EVENTS L2-10 / L5-6 (scenes/foeTraitsHost.js)
  assert.match(d, /damage = bossTakeAt\(foe\.entity, damage, _whole \|\| bypassShield, bossClockS\(\), \(l\) => hudText\.add\(l\), [^\n]*\{ blow: fromPlayer \|\| striker != null \|\| kind !== 'melee', mine: fromPlayer \}\);/);   // PIN MOVED - AUDIT WORLD-EVENTS L2-5 / L2-10
  assert.match(rd('src/scenes/gate/standInSpell.js'), /const dealt = counted >= 1 \? bossStrike\(body\.entity, counted, \{ kind: 'spell', element: sp\.element \?\? null \}\)\.damage : counted;/);
  // the spells hand their element to the sinks a resistance reads it at
  const fx = rd('src/systems/effects.js');
  assert.match(fx, /sinks\.hurt\(n, \{ element: spell\.element \?\? null \}\);/);
  assert.match(fx, /round: true, element: a\.element \?\? null \}\);/);
  // the target frame
  const hud = rd('src/ui/hud/hudFoeTarget.js');
  assert.match(hud, /traits: bossTraitWords\(e\),/);
  assert.match(hud, /ward: bossWardNow\(e, bossClockS\(\)\)\?\.now \?\? 0,/);   // PIN MOVED - AUDIT WORLD-EVENTS L2-5: the traits' clock
});
