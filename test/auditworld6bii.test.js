// AUDIT WORLD6b-ii (Mac, 2026-09-14: "Lead the way"): three opus lenses over the hunt - the owner's side (A), the
// puppet's side and the hit-in (B), the wiring, the merge and the record (C). Twenty-four findings paid at their root;
// these pins EXECUTE the pay-outs on the encounter pool over a crafted MONSTER.BSA with a net that has peers, an id
// and a clock of its own.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validFoeRecord, FOE_LEVEL_MAX } from '../src/net/wire.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { isPeerTarget, PLAYER_TARGET } from '../src/characters/enemyTargets.js';
import { SKILLS } from '../src/systems/skills.js';
import { WEAPONS_ENUM } from '../src/combat/enemyEquipment.js';
import { GIVE_UP_TICKS } from '../src/characters/enemyMotor.js';

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
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; if (n === 'CLASS00.CFG') return craftCfg({ hpPerLevel: 6 }); throw new Error(`no ${n} in this pin`); },   // a rat's career, and one class career (mobile 128) for the level pins
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
const netFor = (hits, peers, clock = { t: 0 }) => ({
  room: () => 'world:3,12', selfId: () => 'mac-0001', peers: () => peers.list, now: () => clock.t, staleMs: 0,
  onPeerHit: (h, fate) => { hits.push(h); fate?.sent?.(); return true; },
  toWire: (feet) => [feet[0], feet[1], feet[2]], toScene: (p) => [p[0], p[1], p[2]],
});
const senses = (pe) => ({ candidates: () => [], playerEntity: pe, playerHeight: 1.8, playerCrouching: false, playerInvisible: false, movingLessThanHalfSpeed: true });
const puppets = (pool) => pool.foes.filter((f) => !!f.puppet);
const rec = (i, over = {}) => ({ i, t: 0, x: 0, f: [12, 0, 10], y: 0, h: 9, d: 0, a: 0, m: 0, g: '', l: 1, w: null, ...over });
const frame = (n, f, full = 1) => ({ n, k: 'world:3,12', full, f });
const step = (pool, me, pe, n = 1) => { for (let i = 0; i < n; i++) pool.update(0.05, me, [me[0], me[1] + 1.6, me[2]], senses(pe)); };

test('AUDIT WORLD6b-ii A1: the caster\'s tick runs always, never gated off (the pick cleared on its own cadence, the timers counting) - at a peer as at me; the suppression this audit paid was retired by WORLD6b-iii (one signature, no flag); by source the caster\'s arm', async () => {
  const hits = [], calls = [];
  const peers = { list: [{ id: 'bob-0002', feet: [12, 0, 10], height: 1.8 }] };
  const pe = playerEntity();
  const pool = createExteriorFoes(poolRig({ playerEntity: pe }));
  pool.setNet(netFor(hits, peers));
  const rat = await pool.spawnFoe(0, [10, 0, 10], { feetGiven: true, yaw: Math.PI / 2 });
  rat.ai.isHostile = true; rat.ai.detected = true;
  rat.caster = { update: (...a) => { calls.push(a[5]); return null; } };   // the decision machine, observed
  const far = [80, 0, 80];
  step(pool, far, pe, 40);
  assert.ok(isPeerTarget(rat.ai.target), 'the rat hunts Bob');
  assert.ok(calls.length > 0, 'the tick RAN while the target was a peer (gated off, the pick latched and the foe stood rooted)');
  assert.ok(calls.slice(-5).every((o) => o === undefined), 'and is not suppressed - WORLD6b-iii superseded the suppression: the cast at a peer flies (the pay-out that mattered is the tick running)');
  peers.list = [];
  const me = [11, 0, 10];
  step(pool, me, pe, 10);
  assert.ok(calls.slice(-3).every((o) => o === undefined), 'at me the same');
  const c = rd('src/characters/enemyCasting.js');
  assert.match(c, /update\(dt, ai, attack, playerFeet, playerEntity\) \{/, 'one signature (WORLD6b-iii retired the suppress arm)'); assert.doesNotMatch(c, /suppress/, 'no dead option');
});

test('AUDIT WORLD6b-ii A2: a foe of mine that walked off with a peer is culled by MY relevance - detected of a peer is not detected of me', async () => {
  const hits = [];
  const peers = { list: [{ id: 'bob-0002', feet: [202, 0, 200], height: 1.8 }] };
  const pe = playerEntity();
  const pool = createExteriorFoes(poolRig({ playerEntity: pe }));
  pool.setNet(netFor(hits, peers));
  const rat = await pool.spawnFoe(0, [200, 0, 200], { feetGiven: true, yaw: Math.PI / 2 });
  rat.ai.isHostile = true; rat.ai.detected = true;
  const me = [0, 0, 0];   // I am 280 units away, past ENCOUNTER_CULL_DISTANCE
  step(pool, me, pe, 40);
  assert.equal(rat.dead, true, 'A2: hunting Bob far from me, the rat is culled (it held the pool full for the session before)');
});

test('AUDIT WORLD6b-ii A3/B5: a peer\'s blow with no candidate for the striker wakes my foe with NO target and NO feet (never me, never a stranger\'s feet); with a candidate the foe turns on the striker at the feet the hit carried', async () => {
  const hits = [];
  const peers = { list: [] };
  const pool = createExteriorFoes(poolRig());
  pool.setNet(netFor(hits, peers));
  const rat = await pool.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  rat.ai.target = null; rat.ai.lastKnownTargetPos = null; rat.ai.giveUpTimer = 0;
  assert.equal(pool.applyHit('bob-0002', { k: 'world:3,12', i: rat.seq, dmg: 2, kind: 'melee', p: [15, 0, 10], d: [1, 0, 0] }), true);
  assert.equal(rat.ai.target, null, 'A3: no candidate - no target, never me'); assert.equal(rat.ai.lastKnownTargetPos, null, 'B5: and no stranger\'s feet');
  assert.equal(rat.ai.giveUpTimer, GIVE_UP_TICKS, 'woken all the same');
  peers.list = [{ id: 'bob-0002', feet: [15, 0, 10], height: 1.8 }];
  pool.update(0.05, [50, 0, 50], [50, 1.6, 50], senses(playerEntity()));
  assert.equal(pool.applyHit('bob-0002', { k: 'world:3,12', i: rat.seq, dmg: 2, kind: 'melee', p: [15, 0, 10], d: [1, 0, 0] }), true);
  assert.equal(isPeerTarget(rat.ai.target), true, 'with a candidate: the striker'); assert.deepEqual(rat.ai.lastKnownTargetPos, [15, 0, 10]);
});

test('AUDIT WORLD6b-ii A5/A8: the player\'s slot is named in the target walk (foes, ME, the peers - a peer never beats me on a tie) and a foe with no target streams none (\'\'), not its owner', async () => {
  const hits = [];
  const pool = createExteriorFoes(poolRig());
  pool.setNet(netFor(hits, { list: [] }));
  const rat = await pool.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  assert.deepEqual(pool.foesFrame(true).f.map((r) => r.g), [''], 'A8: not stepped yet - none, not \'.\' (which latched the puppet hostile)');
  const t = rd('src/characters/enemyTargets.js');
  assert.match(t, /const walk = \(candidates \?\? \[\]\)\.includes\(PLAYER_TARGET\) \? \[\.\.\.candidates\] : \[\.\.\.\(candidates \?\? \[\]\), PLAYER_TARGET\];/, 'A5: the caller names my slot');
  assert.match(rd('src/scenes/exteriorFoes.js'), /runTargetMachine\(f, \[\.\.\.senses\.candidates\(\), PLAYER_TARGET, \.\.\.\(f\.placed && !f\.site \? \[\] : peerCandidates\(\)\)\], pf, cdt, \{/, 'and the pool puts the peers after me');
  void rat;
});

test('AUDIT WORLD6b-ii B1/C1: a puppet\'s blow at me is BOUNDED - the owner\'s budget (PUPPET_BLOWS_PER_S, then none until the clock refills), and a puppet that LEAPT to me lands nothing until its next record walks it', async () => {
  const hits = [], clock = { t: 0 };
  const peers = { list: [{ id: 'bob-0002', feet: [30, 0, 30], height: 1.8 }] };
  const pe = playerEntity();
  const pool = createExteriorFoes(poolRig({ playerEntity: pe }));
  pool.setNet(netFor(hits, peers, clock));
  const me = [10, 0, 10];
  pool.applyFoes('bob-0002', frame(1, [rec(5, { f: [11, 0, 10], y: -Math.PI / 2, g: 'mac-0001' })])); await settle();
  const pup = puppets(pool)[0];
  step(pool, me, pe);
  assert.equal(pup._pupMine, true);
  const blows = () => pe.skillUses[SKILLS.Dodging];
  let fn = 1, a = 0;   // AUDIT WORLD6b-iii(a) A3: a damage frame lands only behind a SWING at me (its edge carries whom it was at)
  const swing = (over = {}) => { pool.applyFoes('bob-0002', frame(++fn, [{ i: 5, a: (a += 2), ...over }], 0)); pup.mobile.doMeleeDamage = true; step(pool, me, pe); };
  for (let i = 0; i < 12; i++) swing();
  assert.equal(blows(), 6, 'B1: six blows of one owner\'s, then none - the budget (the clock stands still)');
  clock.t = 1000;
  for (let i = 0; i < 12; i++) swing();
  assert.equal(blows(), 12, 'a second on: six more, no more');
  // the leap: fifty units in a fifth of a second is no rat's walk
  clock.t = 2000;
  pool.applyFoes('bob-0002', frame(++fn, [{ i: 5, f: [61, 0, 10] }], 0));
  clock.t = 2200;
  pool.applyFoes('bob-0002', frame(++fn, [{ i: 5, f: [11, 0, 10] }], 0));
  step(pool, me, pe);
  assert.equal(pup._pup.leap, true, 'C1: leapt');
  swing();
  assert.equal(blows(), 12, 'a puppet that leapt lands nothing');
  clock.t = 2400;
  pool.applyFoes('bob-0002', frame(++fn, [{ i: 5, f: [11.2, 0, 10] }], 0));
  step(pool, me, pe);
  assert.equal(pup._pup.leap, false, 'walked: inside the law again');
  swing();
  assert.equal(blows(), 13, 'and its blow lands');
  // a dropped frame's catch-up is inside the law: two seconds of walking
  clock.t = 4400;
  pool.applyFoes('bob-0002', frame(++fn, [{ i: 5, f: [16, 0, 10] }], 0));
  assert.equal(pup._pup.leap, false, 'five units in two seconds is a walk');
});

test('AUDIT WORLD6b-ii B2/B3: the attacker\'s terms ride the record - my foe\'s level and its weapon (or null) in the wire\'s law; a puppet is built at its OWNER\'s level (a change rebuilds it) and wears the owner\'s weapon rebuilt from the descriptor, none for null', async () => {
  for (const r of [{ i: 1, l: 7 }, { i: 1, w: null }, { i: 1, w: [WEAPONS_ENUM.Broadsword, 2] }]) assert.deepEqual(validFoeRecord(r), r, JSON.stringify(r));
  for (const r of [{ i: 1, l: -1 }, { i: 1, l: FOE_LEVEL_MAX + 1 }, { i: 1, l: 1.5 }, { i: 1, w: [1] }, { i: 1, w: [-1, 0] }, { i: 1, w: [1, 256] }, { i: 1, w: 'sword' }, { i: 1, w: [1.5, 0] }]) assert.equal(validFoeRecord(r), null, JSON.stringify(r));
  const hits = [];
  const pe = playerEntity(); pe.level = 12;
  const pool = createExteriorFoes(poolRig({ playerEntity: pe }));
  pool.setNet(netFor(hits, { list: [] }));
  const mine = await pool.spawnFoe(0, [1, 0, 1], { feetGiven: true });
  const out = pool.foesFrame(true).f[0];
  assert.equal(out.l, mine.entity.level | 0, 'my foe\'s level rides'); assert.equal(out.w, null, 'a rat carries no weapon');
  mine.entity.weapon = { templateIndex: WEAPONS_ENUM.Broadsword, material: 3 };
  assert.deepEqual(pool.foesFrame(true).f[0].w, [WEAPONS_ENUM.Broadsword, 3], 'a weapon rides as [template, material]');
  pool.applyFoes('bob-0002', frame(1, [rec(5, { t: 128, l: 7, w: [WEAPONS_ENUM.Broadsword, 2] }), rec(6, { l: 7 })])); await settle();
  const pup = puppets(pool).find((f) => f.seq === 5), ratPup = puppets(pool).find((f) => f.seq === 6);
  assert.equal(pup.entity.level, 7, 'B2: a CLASS puppet is built at the owner\'s level, not mine (12)');
  assert.equal(ratPup.entity.level, 1, 'a monster\'s level is its species\', whatever the record says (makeEnemyEntity\'s own law)');
  pool.applyFoes('bob-0002', frame(2, [rec(6, { l: 7 })], 0)); await settle();
  assert.equal(pool.foes.includes(ratPup), true, 'and a monster is never rebuilt over its record\'s level (a crafted one would have churned it every frame)');
  assert.equal(pup.entity.weapon?.templateIndex, WEAPONS_ENUM.Broadsword, 'wears the owner\'s weapon'); assert.equal(pup.entity.weapon?.material, 2);
  assert.deepEqual(pup.entity.items, [], 'and still no loot of mine (B14)');
  pool.applyFoes('bob-0002', frame(3, [{ i: 5, w: [WEAPONS_ENUM.Longsword, 4] }], 0));
  assert.equal(pup.entity.weapon?.templateIndex, WEAPONS_ENUM.Longsword, 'a new descriptor rebuilds the weapon');
  pool.applyFoes('bob-0002', frame(4, [{ i: 5, w: null }], 0));
  assert.equal(pup.entity.weapon, null, 'null is none');
  pool.applyFoes('bob-0002', frame(5, [rec(5, { t: 128, l: 9 })], 0)); await settle();
  assert.equal(pool.foes.includes(pup), false, 'a class foe\'s level change ends the puppet'); assert.equal(puppets(pool).find((f) => f.seq === 5)?.entity.level, 9, 'and stands it anew at the new level');
});

test('AUDIT WORLD6b-ii B4: one attack door - a connecting swing or shaft of mine that landed no damage wakes MY foe (the area walk), and reaches a PUPPET\'s owner as a zero blow unless a damaging one already went this frame; no area of mine wakes for a puppet', async () => {
  const hits = []; let woke = 0;
  const pool = createExteriorFoes(poolRig({ makeAreaHostile: () => { woke++; } }));
  pool.setNet(netFor(hits, { list: [{ id: 'bob-0002', feet: [30, 0, 30], height: 1.8 }] }));
  const mine = await pool.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  mine.ai.isHostile = false;
  pool.attackFromPlayer(mine, [9, 0, 10]);
  assert.equal(woke, 1, 'my foe: the area wakes'); assert.equal(mine.ai.isHostile, true);
  pool.applyFoes('bob-0002', frame(1, [rec(5, { f: [12, 0, 10] })])); await settle();
  const pup = puppets(pool)[0];
  pool.attackFromPlayer(pup, [11, 0, 10]);
  assert.equal(woke, 1, 'a puppet: no area of mine'); assert.deepEqual(hits.map((h) => [h.i, h.dmg]), [[5, 0]], 'the owner hears the zero blow');
  pool.update(0.05, [11, 0, 10], [11, 1.6, 10], senses(playerEntity()));
  pool.damageFoe(pup, 4, [11, 0, 10], null, { kind: 'arrow' });
  pool.attackFromPlayer(pup, [11, 0, 10]);
  assert.deepEqual(hits.map((h) => [h.i, h.dmg]), [[5, 0], [5, 4]], 'a damaging blow this frame: the zero one is not sent twice');
  pool.update(0.05, [11, 0, 10], [11, 1.6, 10], senses(playerEntity()));
  pool.attackFromPlayer(pup, [11, 0, 10]);
  assert.deepEqual(hits.map((h) => [h.i, h.dmg]), [[5, 0], [5, 4], [5, 0]], 'the next frame\'s zero blow goes');
  assert.match(rd('src/scenes/world.js'), /: exteriorFoes\.attackFromPlayer\(f, player\.pos, 'arrow'\)\),/, 'the arrow seam reads the one door (AUDIT WORLD6b-iii(e) A2: with the shaft\'s kind)');
  assert.match(rd('src/scenes/exteriorFoes.js'), /attackFromPlayer\(foe, playerFeet\);\n/, 'and so does the melee arm');
});

test('AUDIT WORLD6b-ii B6/B8/C2: a puppet beating on me raises the enemy alert and its end clears it; the senses run for a puppet at me alone (a puppet at another is no enemy that has detected me); a puppet whose OWNER the hunt cannot see lands no blow', async () => {
  const hits = [];
  const peers = { list: [{ id: 'bob-0002', feet: [30, 0, 30], height: 1.8 }, { id: 'eve-0003', feet: [20, 0, 20], height: 1.8 }] };
  const pe = playerEntity();
  const pool = createExteriorFoes(poolRig({ playerEntity: pe }));
  pool.setNet(netFor(hits, peers));
  const me = [10, 0, 10];
  pool.applyFoes('bob-0002', frame(1, [rec(5, { f: [11, 0, 10], y: -Math.PI / 2, g: 'eve-0003' })])); await settle();
  const pup = puppets(pool)[0];
  step(pool, me, pe, 3);
  assert.equal(pup.ai.targetIsLocalPlayer, false, 'B8: at Eve - not an enemy that has detected me'); assert.equal(pe.enemyAlertActive ?? false, false, 'no alert');
  pool.applyFoes('bob-0002', frame(2, [{ i: 5, g: 'mac-0001' }], 0));
  step(pool, me, pe, 3);
  assert.equal(pup._pupMine, true); assert.equal(pup.ai.targetIsLocalPlayer, true); assert.equal(pup.ai.inSight && pup.ai.detected, true, 'the senses ran for a puppet at me');
  assert.equal(pe.enemyAlertActive, true, 'B6: a peer\'s foe beating on me is an enemy alert of mine');
  pool.applyFoes('bob-0002', frame(3, [{ i: 5, d: 1 }], 0));
  assert.equal(pe.enemyAlertActive, false, 'and its death clears it');
  // C2: the owner must be visible to the hunt
  pool.applyFoes('bob-0002', frame(4, [rec(6, { f: [11, 0, 10], y: -Math.PI / 2, g: 'mac-0001' })], 0)); await settle();
  const p6 = puppets(pool).find((f) => f.seq === 6);
  step(pool, me, pe);
  assert.equal(p6._pupMine, true, 'Bob visible: his foe\'s blow is mine to take');
  peers.list = [{ id: 'eve-0003', feet: [20, 0, 20], height: 1.8 }];
  step(pool, me, pe, 2);
  assert.equal(p6._pupMine, false, 'C2: Bob gone from the peers the hunt sees - his puppet lands nothing (one liveness for the hunt and the blow)');
  p6.mobile.doMeleeDamage = true; step(pool, me, pe);
  assert.equal(pe.skillUses[SKILLS.Dodging], 0, 'no blow');
});

test('AUDIT WORLD6b-ii by source: the Seducer transforms for ME in both pools (A4/C4); the dungeon drops a puppet\'s latches after the mobile (B10); no double loose (B7); the pane says a peer\'s creature can hurt me (C3); the peer\'s height is the last standing one (C5); the prune reads the peers the hunt sees (C2); the record', () => {
  const x = rd('src/scenes/exteriorFoes.js'), d = rd('src/scenes/dungeonContext.js'), w = rd('src/scenes/world.js');
  assert.match(x, /f\.seducer\?\.update\(dt, isLocalPlayerTarget\(f\.ai\.target\) \|\| !f\.ai\._armedTargeting\);/, 'A4');
  assert.match(d, /f\.seducer\?\.update\(dt, !foeDeps \|\| !f\.ai\._armedTargeting \|\| foeDeps\.isLocalPlayerTarget\(f\.ai\.target\)\);/, 'C4');
  assert.match(d, /f\._castPending = false;[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*if \(_puppet && f\.mobile\) \{\s*if \(!f\._pupMine\) f\.mobile\.doMeleeDamage = false;/, 'B10: dropped after the mobile');
  assert.doesNotMatch(d.slice(d.indexOf('function puppetStep('), d.indexOf('function puppetStep(') + 4000), /if \(f\.mobile\) \{[^\n]*\n\s*if \(!f\._pupMine\) f\.mobile\.doMeleeDamage = false;/, 'and no longer in puppetStep');
  const pupArm = x.slice(x.indexOf("onArrow(from, dir, f, f._pupMine ? null : _at);"), x.indexOf("onArrow(from, dir, f, f._pupMine ? null : _at);") + 300);
  assert.doesNotMatch(pupArm, /SOUND\.ArrowShoot/, 'B7: the loose rings at the host\'s seam alone');
  assert.match(rd('src/ui/enhancedMenu.js'), /everyone nearby sees and fights - and its creatures can hurt you too\./, 'C3');
  assert.match(w, /const h = peerBodies\?\.heightOf\(p\.id\) \|\| 0;\s*if \(h > 0\) _peerHeights\.set\(p\.id, h\);\s*out\.push\(\{ id: p\.id, feet: onlineToScene\(p\.shown\), height: _peerHeights\.get\(p\.id\) \}\);/, 'C5');
  assert.match(w, /\{ const ids = ownerIds\(\); if \(ids\) exteriorFoes\.pruneOwners\(ids, now\); \}/, 'C2: the prune reads the same list');
  assert.match(x, /if \(!f\.placed && !f\.managed && _playerDist > ENCOUNTER_CULL_DISTANCE && !\(f\.ai\.detected && f\.ai\.targetIsLocalPlayer !== false\)\) \{/, 'A2');   // WOD3: a mod-placed foe is never culled; DW-E4: nor a spawner-managed one
  assert.match(x, /f\.ai\.targetIsLocalPlayer = f\._pupMine;\s*if \(f\._pupMine\) \{\s*f\.ai\._senses\?\.\(playerFeet, null\);/, 'A6/B8');
  assert.match(rd('bible/06-Systems/Online-Arc.md'), /## AUDIT WORLD6b-ii \(2026-09-14\)/, 'the record');
});
