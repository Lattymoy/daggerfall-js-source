// WORLD6b-ii (Mac, 2026-09-14: "Continue" after AUDIT WORLD6b): THE FOE HUNTS EVERY PLAYER IN THE CELL - WORLD3's
// law for the dungeon host's foes, per owner. The peers ride MY foes' target machine as candidates minted off the
// pose stream; my frame's record carries the target (`g`: '.' me, an id a peer, '' none); a PUPPET whose streamed
// target is ME resolves its owner's foe's melee frame and shaft here, with my own reach and my own stats, and at
// another the swing's clip and a shaft that pays nothing; MY foe's blow at a peer is the peer's to resolve (the
// swing's voice alone here); a peer's hit on my foe carries the striker's feet and the blow's direction, so the foe
// turns on the striker and the shove goes the way the blow went.
//
// These pins EXECUTE the pool on a crafted MONSTER.BSA with a net that has peers and an id.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validFoeRecord, POSE_BOUND } from '../src/net/wire.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { isPeerTarget, isLocalPlayerTarget } from '../src/characters/enemyTargets.js';
import { SKILLS } from '../src/systems/skills.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

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
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const settle = () => new Promise((r) => setTimeout(r, 0));
const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const poolRig = (extra = {}) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },   // the pursuit walks on open flat ground
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
  getTexture: async () => stubTex,
  uploadRecordFrame: () => {},
  currentMinute: () => 0,
  currentPixelKey: () => '3,12',
  playerEntity: playerEntity(),
  audio: null,
  onPlayerHurt: () => {},
  rolls: () => 0.01,
  rand: () => 0.01,
  ...extra,
});
/** The net with an id and peers - the scene frame IS the world frame. */
const netFor = (hits, peers) => ({
  room: () => 'world:3,12', selfId: () => 'mac-0001', peers: () => peers.list, now: () => 0, staleMs: 0,
  onPeerHit: (h) => { hits.push(h); return true; },
  toWire: (feet) => [feet[0], feet[1], feet[2]], toScene: (p) => [p[0], p[1], p[2]],
});
const senses = (pe) => ({ candidates: () => [], playerEntity: pe, playerHeight: 1.8, playerCrouching: false, playerInvisible: false, movingLessThanHalfSpeed: true });
const puppets = (pool) => pool.foes.filter((f) => !!f.puppet);
const rec = (i, over = {}) => ({ i, t: 0, x: 0, f: [12, 0, 10], y: 0, h: 9, d: 0, a: 0, m: 0, g: '', ...over });
const frame = (n, f, full = 1) => ({ n, k: 'world:3,12', full, f });

test('WORLD6b-ii: the wire - a record\'s target is \'.\' (its owner), a peer id or \'\' (none), by the id law; anything else refuses the record whole', () => {
  for (const g of ['.', '', 'bob-0002', 'x'.repeat(40)]) assert.deepEqual(validFoeRecord({ i: 1, g }), { i: 1, g }, g);
  for (const g of ['a', 'x'.repeat(41), 7, null, 'bob 0002', '..']) assert.equal(validFoeRecord({ i: 1, g }), null, JSON.stringify(g));
  assert.deepEqual(validFoeRecord({ i: 1 }), { i: 1 }, 'absent is absent');
});

test('WORLD6b-ii: MY foe hunts a peer - the peers ride the target machine as candidates (one identity per id, gone when the net no longer lists them), the frame\'s record names the target, the attack aims at the peer\'s own feet; its blow at the peer is the peer\'s to resolve (nothing lands on me, no alert of mine); a puppet is never a candidate', async () => {
  const hits = [], hurt = [];
  const peers = { list: [{ id: 'bob-0002', feet: [12, 0, 10], height: 1.8 }] };
  const pe = playerEntity();
  const pool = createExteriorFoes(poolRig({ playerEntity: pe, onPlayerHurt: (d) => hurt.push(d) }));
  pool.setNet(netFor(hits, peers));
  const rat = await pool.spawnFoe(0, [10, 0, 10], { feetGiven: true, yaw: Math.PI / 2 });
  rat.ai.isHostile = true; rat.ai.detected = true;
  const me = [80, 0, 80];   // I am far away; Bob stands two units east of the rat
  for (let i = 0; i < 40; i++) pool.update(0.05, me, [me[0], me[1] + 1.6, me[2]], senses(pe));
  assert.ok(isPeerTarget(rat.ai.target), `the machine picked the peer (${JSON.stringify(rat.ai.target && { isPeer: rat.ai.target.isPeer, id: rat.ai.target.id })})`);
  assert.equal(rat.ai.target.id, 'bob-0002'); assert.equal(isLocalPlayerTarget(rat.ai.target), false, 'a peer is a player, not the local one (AUDIT WORLD3 C3)');
  assert.deepEqual(pool.foesFrame(true).f.map((r) => r.g), ['bob-0002'], 'the record names the target');
  assert.equal(pe.enemyAlert ?? false, false, 'no alert of mine for a foe hunting a peer');
  const c1 = rat.ai.target;
  peers.list = [{ id: 'bob-0002', feet: [13, 0, 10], height: 1.8 }];
  for (let i = 0; i < 5; i++) pool.update(0.05, me, [me[0], 1.6, me[2]], senses(pe));   // the machine re-reads the peers on its own classic timer
  assert.equal(rat.ai.target, c1, 'one identity per id - the reference holds across frames'); assert.deepEqual(c1.feet, [13, 0, 10], 'at the peer\'s live feet');
  // its blow at the peer: the peer resolves; nothing lands on me
  rat.ai._dist = 1; rat.ai.inSight = true;
  rat.mobile.doMeleeDamage = true;
  pool.update(0.05, me, [me[0], 1.6, me[2]], senses(pe));
  assert.equal(rat.mobile.doMeleeDamage, false, 'the damage frame was consumed');
  assert.deepEqual(hurt, [], 'and nothing landed on me'); assert.equal(pe.skillUses[SKILLS.Dodging], 0, 'no Dodging of mine tallied for a blow at another');
  // the peer gone: dead to the machine
  peers.list = [];
  for (let i = 0; i < 3; i++) pool.update(0.05, me, [me[0], 1.6, me[2]], senses(pe));
  assert.equal(c1.health, 0, 'a peer the net no longer lists is dead to the machine'); assert.notEqual(rat.ai.target, c1, 'and dropped');
  // a puppet is no candidate
  pool.applyFoes('eve-0003', frame(1, [rec(1, { f: [11, 0, 10] })])); await settle();
  assert.equal(puppets(pool).length, 1);
  for (let i = 0; i < 20; i++) pool.update(0.05, me, [me[0], 1.6, me[2]], senses(pe));
  assert.notEqual(rat.ai.target, puppets(pool)[0], 'the pool\'s own candidates are the host\'s list (a puppet is out of it, AUDIT WORLD6b B8)');
  assert.deepEqual(pool.foesFrame(true).f.map((r) => r.g), ['.'], 'Bob gone, the rat turns to the one player left - me - and the record says so');
});

test('WORLD6b-ii: a PUPPET\'s blow at ME lands here - its streamed target is me, so the mobile\'s damage frame is mine to resolve with my own reach and stats (Dodging tallied, the hurt door), the hostility the owner\'s word; at another peer or at its owner the frame is dropped; its shaft flies at me (a real one) or at the peer\'s body (one that pays nothing). AUDIT WORLD6b-iii(a) A3: whom a swing is at rides its EDGE (b, or g for an older record), not the hunt\'s live word', async () => {
  const hits = [], hurt = [], shots = [];
  const peers = { list: [{ id: 'bob-0002', feet: [30, 0, 30], height: 1.8 }, { id: 'eve-0003', feet: [20, 0, 20], height: 1.8 }] };   // AUDIT WORLD6b-ii C2: the owner must be a peer the hunt sees for its puppet's blow to land
  const pe = playerEntity();
  const pool = createExteriorFoes(poolRig({ playerEntity: pe, onPlayerHurt: (d) => hurt.push(d), onArrow: (from, dir, f, aimFoe) => shots.push(aimFoe) }));
  pool.setNet(netFor(hits, peers));
  const me = [10, 0, 10];
  pool.applyFoes('bob-0002', frame(1, [rec(5, { f: [11, 0, 10], y: -Math.PI / 2, g: 'mac-0001' })])); await settle();
  const pup = puppets(pool)[0];
  pup.ai.isHostile = false;
  pool.update(0.05, me, [10, 1.6, 10], senses(pe));
  assert.equal(pup._pupTarget, 'mac-0001'); assert.equal(pup._pupMine, true, 'the streamed target is me');
  assert.equal(pup.ai.isHostile, true, 'the owner\'s word that it is fighting somebody (AUDIT WORLD3 D2)');
  let fn = 1, a = 0;
  const swing = (over = {}) => { pool.applyFoes('bob-0002', frame(++fn, [{ i: 5, a: (a += 2), ...over }], 0)); pup.mobile.doMeleeDamage = true; pool.update(0.05, me, [10, 1.6, 10], senses(pe)); };
  const shoot = (over = {}) => { pool.applyFoes('bob-0002', frame(++fn, [{ i: 5, a: (a += 2) | 1, ...over }], 0)); pool.update(0.05, me, [10, 1.6, 10], senses(pe)); pup.mobile.shootArrow = true; pool.update(0.05, me, [10, 1.6, 10], senses(pe)); };
  pup.mobile.doMeleeDamage = true;
  pool.update(0.05, me, [10, 1.6, 10], senses(pe));
  assert.equal(pup.mobile.doMeleeDamage, false, 'dropped'); assert.equal(pe.skillUses[SKILLS.Dodging], 0, 'A3: a damage frame with no swing behind it lands nothing - whom a blow is at is the SWING\'s word');
  swing({ b: 'mac-0001' });
  assert.equal(pup.mobile.doMeleeDamage, false, 'consumed'); assert.equal(pe.skillUses[SKILLS.Dodging], 1, 'the blow resolved against me: Dodging tallied (the reach and the yaw cone read off the streamed pose)');
  assert.deepEqual(hits, [], 'and nothing went back to Bob - his foe struck, I decided the hit');
  swing();
  assert.equal(pe.skillUses[SKILLS.Dodging], 2, 'an older record without b: the hunt\'s word (g) is the swing\'s');
  // at another - the hunt's word AND the swing's
  swing({ g: 'eve-0003', b: 'eve-0003' });
  assert.equal(pup._pupMine, false); assert.equal(pup._pupTarget, 'eve-0003');
  assert.equal(pup.mobile.doMeleeDamage, false, 'dropped unconsumed'); assert.equal(pe.skillUses[SKILLS.Dodging], 2, 'a blow at Eve is Eve\'s');
  // A3: the hunt turned to me inside the frame but the swing was Eve's - nothing; the swing at me while the hunt says Eve - mine
  swing({ g: 'mac-0001', b: 'eve-0003' });
  assert.equal(pe.skillUses[SKILLS.Dodging], 2, 'a swing at Eve with the hunt on me lands nothing on me');
  swing({ g: 'eve-0003', b: 'mac-0001' });
  assert.equal(pe.skillUses[SKILLS.Dodging], 3, 'a swing at me with the hunt on Eve lands on me');
  // at its owner
  pool.applyFoes('bob-0002', frame(++fn, [{ i: 5, g: '.' }], 0));
  pool.update(0.05, me, [10, 1.6, 10], senses(pe));
  assert.equal(pup._pupTarget, 'bob-0002', '\'.\' is the owner'); assert.equal(pup._pupMine, false);
  swing({ b: '.' });
  assert.equal(pe.skillUses[SKILLS.Dodging], 3, 'a swing at its owner is the owner\'s');
  // the shaft: at me a real one, at Eve one that pays nothing, at nobody none
  shoot({ g: 'mac-0001', b: 'mac-0001' });
  assert.deepEqual(shots, [null], 'at me: the player\'s arm (no foe named)'); assert.equal(pup.mobile.shootArrow, false);
  shoot({ g: 'eve-0003', b: 'eve-0003' });
  assert.equal(shots.length, 2); assert.equal(shots[1]?.isPeer, true, 'at Eve: the shaft names her candidate, and the flight lands only on the foe it names - nothing'); assert.equal(shots[1].id, 'eve-0003');
  shoot({ g: '', b: '' });
  assert.equal(shots.length, 2, 'at nobody: no shaft'); assert.equal(pup.mobile.shootArrow, false, 'dropped');
  peers.list = [];
  shoot({ g: 'eve-0003', b: 'eve-0003' });
  assert.equal(shots.length, 2, 'at a peer I cannot see: no shaft');
});

test('WORLD6b-ii: a peer\'s blow on MY foe carries the striker\'s feet and the blow\'s direction - the foe turns on the striker\'s candidate at those feet and the shove goes that way; a direction that is no unit vector knocks nothing, feet outside the pose\'s bounds seed nothing, a spell carries no direction; the divert out spells both', async () => {
  const hits = [];
  const peers = { list: [{ id: 'bob-0002', feet: [15, 0, 10], height: 1.8 }] };
  const pool = createExteriorFoes(poolRig());
  pool.setNet(netFor(hits, peers));
  const rat = await pool.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  rat.ai.target = null;
  assert.equal(pool.applyHit('bob-0002', { k: 'world:3,12', i: rat.seq, dmg: 2, kind: 'melee', p: [15, 0, 10], d: [1, 0, 0] }), true);
  assert.equal(isPeerTarget(rat.ai.target), true, 'the foe turns on the striker'); assert.equal(rat.ai.target.id, 'bob-0002');
  assert.deepEqual(rat.ai.lastKnownTargetPos, [15, 0, 10], 'at the feet the hit carried');
  assert.deepEqual(rat.ai.knockbackDir, [1, 0, 0], 'the shove the way the blow went'); assert.ok(rat.ai.knockbackSpeed > 0);
  rat.ai.knockbackSpeed = 0; rat.ai.knockbackDir = null; rat.ai.target = null; rat.ai.lastKnownTargetPos = null;
  assert.equal(pool.applyHit('bob-0002', { k: 'world:3,12', i: rat.seq, dmg: 2, kind: 'melee', p: [POSE_BOUND + 1, 0, 0], d: [1e9, 0, 0] }), true, 'the blow lands');
  assert.equal(rat.ai.knockbackDir, null, 'AUDIT WORLD3 F2: a direction that is no unit vector knocks nothing'); assert.equal(rat.ai.lastKnownTargetPos, null, 'feet outside the bounds seed nothing');
  assert.equal(isPeerTarget(rat.ai.target), true, 'but the foe still turns on the striker');
  rat.ai.knockbackDir = null;
  assert.equal(pool.applyHit('bob-0002', { k: 'world:3,12', i: rat.seq, dmg: 1, kind: 'spell', d: [1, 0, 0] }), true);
  assert.equal(rat.ai.knockbackDir, null, 'a spell knocks nothing, verbatim');
  // the divert out
  pool.applyFoes('eve-0003', frame(1, [rec(1, { f: [20, 0, 20] })])); await settle();
  const pup = puppets(pool)[0];
  pool.damageFoe(pup, 3, [18, 0, 20], [0.6, 0, 0.8], { kind: 'arrow' });
  assert.deepEqual(hits, [{ to: 'eve-0003', k: 'world:3,12', i: 1, dmg: 3, kind: 'arrow', p: [18, 0, 20], d: [0.6, 0, 0.8] }], 'my blow on Eve\'s foe carries my feet and its direction');
});

test('WORLD6b-ii: by source - the world host hands the pool my id and the peers seam (one closure, the dungeon host\'s and the cell\'s), the pool reads the local player from a peer at every site that meant me, the cast at a peer rides the stream (WORLD6b-iii), the pane says the hunt', () => {
  const w = rd('src/scenes/world.js');
  assert.equal((w.match(/peers: peersNear,/g) ?? []).length, 2, 'one closure, two readers');
  assert.match(w, /const peersNear = \(\) => \{\s*if \(!online \|\| !online\.room \|\| online\.status !== 'open'\) return null;/);
  assert.match(w, /exteriorFoes\.setNet\(\{\s*room: \(\) => online\?\.room \?\? null,\s*selfId: \(\) => online\?\.id \?\? null,/);
  const x = rd('src/scenes/exteriorFoes.js');
  assert.match(x, /runTargetMachine\(f, \[\.\.\.senses\.candidates\(\), PLAYER_TARGET, \.\.\.peerCandidates\(\)\], pf, cdt, \{/, 'the peers are MY foes\' candidates (AUDIT WORLD6b-ii A5: after me)');
  assert.match(x, /return isLocalPlayerTarget\(t\) \? playerFeet : \(isPeerTarget\(t\) \? t\.feet : t\.ai\.feet\);/, 'the attack aims at a peer\'s own feet');
  assert.match(x, /if \(isLocalPlayerTarget\(f\.ai\.target\) && f\.ai\.inSight && f\.ai\.detected\) setEnemyAlert\(playerEntity, true, currentMinute\(\)\);/, 'the alert is mine alone');
  assert.match(x, /if \(isLocalPlayerTarget\(f\.ai\?\.target\) && f\.ai\?\.detected\) setEnemyAlert\(playerEntity, false\);/);
  assert.match(x, /const dec = f\.caster\.update\(dt, f\.ai, f\.attack, _tgt, _castTargetEntity\);\s*if \(dec\) castSpellFrom\(f, dec\.spell, playerFeet, false, \{ aimAt: castAimAt\(f, playerFeet\) \}\);/, 'the cast at a peer (WORLD6b-iii): the tick runs as at me, the cast rides the stream (AUDIT WORLD6b-iii(a) A2/A3: aimed at the SELECTED target, the count and its recipient latched at the release)');
  assert.match(x, /const _at = f\.ai\.target \?\? PLAYER_TARGET, _atPlayer = isLocalPlayerTarget\(_at\);/, 'my foe\'s shaft at a peer pays nothing here');
  assert.match(x, /if \(isPeerTarget\(f\.ai\.target\)\) \{\s*const pv = enemyAttackVoice\(f\);/, 'the swing\'s voice alone at a peer');
  assert.match(x, /if \(_blowMine && !_pupParalyzed && f\.mobile\.doMeleeDamage\) \{[^\n]*\n\s*f\.mobile\.doMeleeDamage = false;[\s\S]{0,400}if \(blowAllowed\(f\)\) resolveFoeMeleeVsPlayer\(f, playerFeet\);/, 'the puppet\'s blow at me through the one player arm, bounded (AUDIT WORLD6b-ii B1; WORLD6b-iii: one budget for the blow and the cast)');
  assert.match(x, /const _t = f\.ai\.target, g = _t\?\.isPeer \? _t\.id : \(_t == null \? '' : \(_t\.isPlayer \? '\.' : ''\)\);/, 'the target on the wire, WORLD3\'s spelling (AUDIT WORLD6b-ii A8: none is none)');
  assert.match(rd('bible/06-Systems/Online-Arc.md'), /### 6b-ii: the foe hunts every player in the cell/, 'the record');
});
