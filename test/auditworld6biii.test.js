// AUDIT WORLD6b-iii(a) (2026-09-14, Mac: "Continue" after WORLD6b-iii(a)): three opus lenses over the cast at a peer -
// the owner's side, the puppet's side, the wire / the dungeon twin / the merge / the records. The criticals: a puppet
// cast ANY spell in SPELLS.STD on its owner's word (B1 - resolved out of the puppet's OWN list now), and a puppet's own
// self or area cast went to its owner as MY hit through the pool's sink (B2 - the sink says whose it is). The highs:
// "nothing of mine in the blast at a peer" guarded an arm the pick never reaches while the reachable blast hit me
// anyway, and the wall arm credited every enemy blast to ME at MY level (A1); a foe duelling another FOE still
// fireballed me (A2); the dungeon handed a PEER's feet to the blast's probe for the LOCAL player, so a blast beside the
// peer landed on me wherever I stood (C2). The mediums: the cast's (and the blow's) recipient read off the live hunt
// 200 ms after the fact (A3 - b/u ride with the counts), a paralysed puppet kept casting (A4/B5), a puppet across the
// map cast at me (B4 - the owner's bands), no spell cast spell 0 (B3/C9), the lens over the pins (A5 - the real decision
// runs here). These pins EXECUTE the pool on a crafted MONSTER.BSA (a rat and an imp), the shared magic engine over
// stubs, and the wire.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validFoeRecord } from '../src/net/wire.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { createPlayerMagic } from '../src/scenes/hostMagic.js';
import { isPeerTarget, missileAimDirection, PEER_CAST_TARGET } from '../src/characters/enemyTargets.js';
import { MIN_RANGED_DISTANCE, MAX_RANGED_DISTANCE } from '../src/characters/enemyCasting.js';

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
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()], ['ENEMY001.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const settle = () => new Promise((r) => setTimeout(r, 0));
const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const damageEffect = (mag = 20) => ({
  type: 4, subType: 0,
  magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 1, magnitudeLevelHigh: 1, magnitudePerLevel: 1,   // magnitude grows with the CASTER's level
  durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
});
// each with a real effect: the pick's EffectsAlreadyOnTarget veto reads an EMPTY list as "all already on the target"
const MISSILE = { index: 7, name: 'Bolt', element: 0, rangeType: 2, effects: [damageEffect(5)] };
const BLAST = { index: 10, name: 'Nova', element: 1, rangeType: 3, effects: [damageEffect(5)] };
const TOUCH = { index: 29, name: 'Grasp', element: 4, rangeType: 1, effects: [damageEffect(5)] };
const SELF = { index: 44, name: 'Bane', element: 4, rangeType: 0, effects: [damageEffect(5)] };   // a self-cast that HURTS (the sink's provenance is what B2 pins)
const spells = new Map([[7, MISSILE], [10, BLAST], [29, TOUCH], [44, SELF]]);
const poolRig = (extra = {}) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
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
  spellsByIndex: () => spells,
  ...extra,
});
const netFor = (hits, peers, clock = { t: 0 }) => ({
  room: () => 'world:3,12', selfId: () => 'mac-0001', peers: () => peers.list, now: () => clock.t, staleMs: 0,
  onPeerHit: (h, fate) => { hits.push(h); fate?.sent?.(); return true; },
  toWire: (feet) => [feet[0], feet[1], feet[2]], toScene: (p) => [p[0], p[1], p[2]],
});
const senses = (pe) => ({ candidates: () => [], playerEntity: pe, playerHeight: 1.8, playerCrouching: false, playerInvisible: false, movingLessThanHalfSpeed: true });
const puppets = (pool) => pool.foes.filter((f) => !!f.puppet);
const rec = (i, over = {}) => ({ i, t: 1, x: 0, f: [20, 0, 10], y: -Math.PI / 2, h: 9, d: 0, a: 0, b: '', m: 0, g: 'mac-0001', l: 1, w: null, c: 0, s: 0, u: '', ...over });
const frame = (n, f, full = 1) => ({ n, k: 'world:3,12', full, f });
const step = (pool, me, pe, n = 1) => { for (let i = 0; i < n; i++) pool.update(0.05, me, [me[0], me[1] + 1.6, me[2]], senses(pe)); };
const hooks = (missiles, blasts) => ({ fireMissile: (from, sp, lvl, foe, aimAt) => missiles.push({ sp, lvl, aimAt }), explodeAt: (pos, sp, lvl, feet) => blasts.push({ sp, feet }) });

test('AUDIT WORLD6b-iii(a) A5: the REAL decision at a peer, executed - an imp hunting Bob in DoRangedAttack\'s band picks its ranged spell off its own list, reads the bare stand-in and casts at Bob\'s transform; the record says c, s and u', async () => {
  const hits = [], missiles = [], blasts = [];
  const peers = { list: [{ id: 'bob-0002', feet: [30, 0, 10], height: 1.8 }] };
  const pe = playerEntity(); pe.activeEffects = [{ kind: 'shield' }];
  let impRef = null;
  // the dice: 0.99 until the imp has Bob (my Stealth FAILS at eighty units - the encounter starts, and GetTargets walks
  // the peers), then 0.01 (the 1/40 cast roll passes; my Stealth holds from there)
  const pool = createExteriorFoes(poolRig({ playerEntity: pe, rolls: () => (isPeerTarget(impRef?.ai?.target) ? 0.01 : 0.99), magicHooks: hooks(missiles, blasts) }));
  pool.setNet(netFor(hits, peers));
  const imp = impRef = await pool.spawnFoe(1, [10, 0, 10], { feetGiven: true, yaw: Math.PI / 2 });
  assert.deepEqual(imp.entity.spells.map((s) => s.index), [7, 10, 29, 44], 'IMP_SPELLS, verbatim'); assert.ok(imp.caster, 'a real EnemyCaster');
  imp.ai.isHostile = true; imp.ai.detected = true;
  const far = [80, 0, 80];
  step(pool, far, pe, 240);
  assert.ok(imp.entity.magicka < imp.entity.maxMagicka, 'its casts spent its magicka (an owner\'s cast is not free), and out of magicka it closes to melee - DFU\'s own arc');
  assert.ok(isPeerTarget(imp.ai.target), 'the imp hunts Bob'); assert.ok(imp.ai.detected, 'and has him');
  assert.ok(missiles.length > 0, 'the REAL decision released a cast');
  assert.equal(missiles[0].sp, MISSILE, 'the one ranged spell of its list (pickRangedSpell: rangeType 2/4)');
  assert.deepEqual(missiles[0].aimAt, [30, 0.9, 10], 'aimed at Bob\'s transform');
  assert.deepEqual(blasts, [], 'no blast: the pick never reaches rangeType 3 (A1 - the arm the slice guarded)');
  const r = pool.foesFrame(true).f[0];
  assert.ok(r.c > 0); assert.equal(r.s, 7); assert.equal(r.u, 'bob-0002', 'whom it was at');
  assert.equal(validFoeRecord(r) != null, true, 'the record is the wire\'s');
});

test('AUDIT WORLD6b-iii(a) A1/C15: the shared engine - an ENEMY missile\'s blast on a wall is the enemy\'s (its caster\'s level, not mine at mine), and a FOE\'s blast lands nothing on a PUPPET while my own blast reaches it (its owner takes it as my hit)', () => {
  const mkPlayer = () => ({ isPlayer: true, level: 1, health: 500, maxHealth: 500, maxMagicka: 500, magicka: 500, skills: new Array(40).fill(50), skillUses: new Array(40).fill(0), stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [] });
  const mkFoe = (x, z, over = {}) => ({ dead: false, ai: { feet: [x, 0, z], height: 1.8 }, entity: { level: 1, health: 40, maxHealth: 40, magicka: 0, maxMagicka: 0, skills: new Array(40).fill(30), stats: { willpower: 30 }, career: {}, activeEffects: [] }, ...over });
  const rig = ({ foes = [] } = {}) => {
    const player = mkPlayer(); const world = { hurt: 0, foeHurt: new Map(), said: [] };
    const magic = createPlayerMagic({
      renderer: { createBillboardBatch: () => ({ origin: null }), destroyBillboardBatch: () => {} },
      audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} },
      getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }), uploadRecord: () => {}, uploadRecordFrame: () => {},
      collider: { raycast: () => 0.4 },   // a wall just ahead
      playerEntity: player,
      playerSinks: { hurt: (n) => { world.hurt += n; player.health -= n; }, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say: (l) => world.said.push(l) },
      say: (l) => world.said.push(l), surfacePlayer: () => {},
      foes: () => foes,
      foeSinks: (f) => ({ hurt: (n) => { world.foeHurt.set(f, (world.foeHurt.get(f) ?? 0) + n); }, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
      absorbCtx: () => ({ inside: true, day: false }),
      rolls: () => 0.99,
    });
    return { magic, world, player };
  };
  const caster = mkFoe(5, 5);
  const blastOf = (level) => { const r = rig(); r.magic.fireEnemyMissile([0, 0.9, 0], [0, 0, 1], { name: 'Nova', index: 10, element: 1, rangeType: 4, effects: [damageEffect(5)] }, level, caster); r.magic.update(0.05, [0, 0, 0]); return r.world.hurt; };
  const atOne = blastOf(1), atNine = blastOf(9);
  assert.ok(atOne > 0, 'the wall blast catches me beside it');
  assert.ok(atNine > atOne, `A1: the blast is the CASTER's - a level-9 foe's hurts more than a level-1 foe's (${atNine} > ${atOne}); it was MY level and MY caster wrapper for every enemy blast on a wall`);
  // C15: a puppet in the sphere
  const pup = mkFoe(0, 1, { puppet: 'bob-0002' });
  const r = rig({ foes: [pup] });
  r.magic.fireEnemyMissile([0, 0.9, 0], [0, 0, 1], { name: 'Nova', index: 10, element: 1, rangeType: 4, effects: [damageEffect(5)] }, 3, caster); r.magic.update(0.05, [0, 0, 0]);
  assert.equal(r.world.foeHurt.get(pup), undefined, 'C15: a FOE\'s blast lands nothing on a puppet here - its owner\'s world resolves that foe');
  r.magic.explodeAt([0, 0.9, 1], { name: 'Nova', index: 10, element: 1, rangeType: 4, effects: [damageEffect(5)] }, 1, null, { entity: r.player });
  assert.ok(r.world.foeHurt.get(pup) > 0, 'my own blast reaches it (the host\'s sink diverts it to the owner as my hit)');
});

test('AUDIT WORLD6b-iii(a) B2: a puppet\'s OWN self-cast that hurts sends NOTHING to its owner (the sink says whose blow it is) and lands nothing here (a puppet takes no damage in this pool); my blow still goes to the owner', async () => {
  const hits = [], missiles = [], blasts = [];
  const peers = { list: [{ id: 'bob-0002', feet: [30, 0, 30], height: 1.8 }] };
  const pe = playerEntity();
  const pool = createExteriorFoes(poolRig({ playerEntity: pe, magicHooks: hooks(missiles, blasts) }));
  pool.setNet(netFor(hits, peers));
  const me = [10, 0, 10];
  pool.applyFoes('bob-0002', frame(1, [rec(5, { f: [12, 0, 10], c: 3, s: 44, u: 'mac-0001' })])); await settle();
  const pup = puppets(pool)[0];
  step(pool, me, pe);
  pool.applyFoes('bob-0002', frame(2, [{ i: 5, c: 4, s: 44, u: 'mac-0001' }], 0));
  step(pool, me, pe);
  assert.deepEqual(hits, [], 'B2: its self-cast is not my blow - nothing went to Bob (a 200-damage phantom hit did, billed to me, and his foe turned on me)');
  assert.equal(pup.entity.health, 9, 'and the puppet\'s health is its owner\'s word, untouched');
  pool.damageFoe(pup, 5, me);
  assert.equal(hits.length, 1, 'my blow goes to the owner'); assert.equal(hits[0].dmg, 5);
});

test('AUDIT WORLD6b-iii(a) B4/A4/B6: a puppet\'s cast at me is read against the owner\'s own bands off the streamed pose (a missile inside six or beyond 51.2 is none, a touch beyond melee reach is none); a puppet I paralysed casts nothing; a self-heal here is no hurt when the owner\'s health snaps it back', async () => {
  const hits = [], missiles = [], blasts = [], clock = { t: 0 };
  const peers = { list: [{ id: 'bob-0002', feet: [30, 0, 30], height: 1.8 }] };
  const pe = playerEntity();
  const pool = createExteriorFoes(poolRig({ playerEntity: pe, magicHooks: hooks(missiles, blasts) }));
  pool.setNet(netFor(hits, peers, clock));
  const me = [10, 0, 10];
  let fn = 0, c = 3;
  const send = (over, full = 0) => pool.applyFoes('bob-0002', frame(++fn, [{ i: 5, ...over }], full));
  const cast = (s) => { send({ c: ++c, s, u: 'mac-0001' }); step(pool, me, pe); };
  const walk = (x) => { clock.t += 30000; send({ f: [x, 0, 10] }); step(pool, me, pe, 2); assert.equal(puppets(pool)[0]._pup.leap, false); };
  send(rec(5, { f: [70, 0, 10], c: 3 }), 1); await settle();
  const pup = puppets(pool)[0];
  const anims = []; const orig = pup.mobile.update.bind(pup.mobile); pup.mobile.update = (dt, o, ...r) => { anims.push({ casting: !!o.casting, hurting: !!o.hurting }); return orig(dt, o, ...r); };
  step(pool, me, pe);
  assert.ok(MAX_RANGED_DISTANCE < 60 && MAX_RANGED_DISTANCE > 50 && MIN_RANGED_DISTANCE === 6, 'the band this pin walks');
  cast(7);
  assert.equal(missiles.length, 0, 'B4: sixty units off - beyond DoRangedAttack\'s band, no cast'); assert.equal(anims.at(-1).casting, true, 'its one-shot');
  walk(60);
  cast(7);
  assert.equal(missiles.length, 1, 'fifty off: inside the band, the cast');
  cast(29);
  assert.equal(missiles.length, 1, 'a TOUCH at fifty: no cast (DoTouchSpell\'s melee reach)'); assert.equal(anims.at(-1).casting, true);
  walk(12);
  cast(29);
  assert.equal(missiles.length, 2, 'a touch at two: the cast (it leaves as a missile at me, the executor\'s own shape)');
  cast(7);
  assert.equal(missiles.length, 2, 'a missile at two: inside six, none');
  // A4: paralysed here
  walk(20);
  pup.entity.activeEffects = [{ kind: 'paralyze' }];
  cast(7);
  assert.equal(missiles.length, 2, 'A4: a puppet I paralysed casts nothing (its swing was already stopped)');
  pup.entity.activeEffects = [];
  cast(7);
  assert.equal(missiles.length, 3, 'freed: the cast');
  // B6: the hurt one-shot against the last STREAMED health
  send({ h: 9 }); step(pool, me, pe);
  pup.entity.health = 14;   // a self-heal landed here (foeSinks.heal writes the entity)
  send({ h: 9 }); step(pool, me, pe);
  assert.equal(anims.at(-1).hurting, false, 'B6: the owner\'s 9 after my local 14 is no hurt - the drop is measured against the last streamed 9');
  send({ h: 7 }); step(pool, me, pe);
  assert.equal(anims.at(-1).hurting, true, 'a streamed drop is');
  assert.deepEqual(hits, []);
});

test('AUDIT WORLD6b-iii(a): the direction law, the stand-in, the wire\'s u8', () => {
  assert.deepEqual(missileAimDirection([0, 0, 0], [0, 0, 5]), [0, 0, 1]);
  assert.deepEqual(missileAimDirection([1, 1, 1], [1, 1, 1]), [0, 0, 0], 'a zero vector normalises to zero, no NaN');
  const d = missileAimDirection([0, 0, 0], [3, 4, 0]); assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-9);
  assert.equal(Object.isFrozen(PEER_CAST_TARGET), true); assert.deepEqual(PEER_CAST_TARGET.activeEffects, []);
  assert.equal(validFoeRecord({ i: 1, s: 255 })?.s, 255); assert.equal(validFoeRecord({ i: 1, s: 256 }), null, 'C8: a SPELLS.STD index is a u8');
});

test('AUDIT WORLD6b-iii(a) by source: the sinks say whose blow it is (B2, the three doors); the leap spends no token (B7); every release counts, the rider too (A9); the wall arm\'s caster (A1); the dungeon\'s probe is MY capsule and its stand-in the shared one (C2/A10); Testing.md and the arc no longer state the retired law (C5/C7); the record', () => {
  const x = rd('src/scenes/exteriorFoes.js');
  assert.match(x, /hurt: \(n\) => damageFoe\(f, n, null, null, \{ fromPlayer: false, kind: 'spell' \}\),/, 'B2: the pool\'s sink');
  assert.match(rd('src/scenes/world.js'), /const foeSinks = \(g, fromPlayer = true\) => \(\{[^\n]*\n\s*hurt: \(n\) => \{ if \(n > 0\) \(g\._encounter \? exteriorFoes\.damageFoe\(g, n, player\.pos, null, \{ fromPlayer, kind: 'spell' \}\) : cityGuards\.hurtGuard\(g, n, player\.pos, null, \{ fromPlayer \}\)\); \},/, 'B2: the host\'s sink reads the engine\'s provenance');
  assert.match(rd('src/scenes/cityGuards.js'), /hurtGuard: \(g, dmg, playerFeet, knockDir = null, opts = undefined\) => damageGuard\(g, dmg, playerFeet, knockDir, opts\),/, 'B2: the guard door forwards it');
  assert.match(x, /function blowAllowed\(f\) \{\s*if \(f\._pup\?\.leap\) return false;/, 'B7: the leap before the bucket');
  assert.match(x, /if \(ok !== false\) \{ f\._castN = \(\(f\._castN \| 0\) \+ 1\) & 0xffff; f\._castIdx = spell\.index \| 0; f\._castU = wireRecipient\(f\.ai\.target\); \}/, 'A9/A3: the count, the spell and the recipient at the ONE release (AUDIT WATCH1: through the one home, enemyTargets.wireRecipient)');
  assert.equal((x.match(/f\._castN = /g) ?? []).length, 1, 'counted in one place');
  assert.match(x, /if \(strikeEdge\) \{ f\._atkA = [^\n]*f\._atkB = wireRecipient\(f\.ai\.target\); \}/, 'A3: the blow\'s recipient at its edge (AUDIT WATCH1: through the one home)');
  assert.match(x, /p\.strike = \{ kind: \(r\.a & 1\) \? 'ranged' : 'melee', at: r\.b \?\? r\.g \?\? p\.target \};/, 'the reader latches it with the strike');
  assert.match(x, /if \(p\.c != null && r\.c !== p\.c && Number\.isInteger\(r\.s\)\) p\.cast = \{ s: r\.s, at: r\.u \?\? r\.g \?\? p\.target \};/, 'and with the cast (B3: no spell, no cast)');
  assert.match(x, /const sp = recipientIsMe\(f, pc\.at\) \? \(f\.entity\.spells\?\.find\(\(x\) => \(x\.index \| 0\) === pc\.s\) \?\? null\) : null;/, 'B1: out of the puppet\'s OWN list');
  assert.match(x, /if \(sbi\) assignEnemySpells\(entity, sbi\);\s*\n\s*const caster = entity\.spells\?\.length && !puppet \? new EnemyCaster\(entity, rolls\) : null;/, 'B1: the list for a puppet too, no caster');
  const hm = rd('src/scenes/hostMagic.js');
  assert.match(hm, /explodeAt\(impact, m\.spell, m\.fromPlayer === false \? \(m\.casterLevel \?\? 1\) : playerEntity\.level, playerFeet, missileCaster\(m\), \{ playerHeight, allies: !!m\.ally, duel: !!m\.duel \}\);/, 'A1: the wall arm (AID1 onto ALLY-CAST: a friendly blast also gives to the party mates it meets)');
  assert.match(hm, /if \(t\.puppet && caster\?\.entity && caster\.entity !== playerEntity\) continue;/, 'C15');
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /playerFeet: lastPlayerFeet, playerHeight: lastPlayerHeight,\s+\/\/ ROAD-H H2/, 'C2: the dungeon\'s probe is mine');
  assert.doesNotMatch(d, /_pt\?\.feet \?\? lastPlayerFeet/, 'the peer\'s feet are gone from it');
  assert.match(d, /foeDeps\.isLocalPlayerTarget\(f\.ai\.target\)\)\s*\n\s*\? playerEntity : \(f\.ai\.target\?\.entity \?\? foeDeps\.PEER_CAST_TARGET \?\? playerEntity\);/, 'A10');
  const tm = rd('bible/09-Testing/Testing.md');
  assert.doesNotMatch(tm, /suppressed tick/, 'C5: Testing.md no longer describes the retired suppression');
  assert.doesNotMatch(tm, /no cast at a peer\)/, 'C5');
  const arc = rd('bible/06-Systems/Online-Arc.md');
  assert.match(arc, /~~\*\*No cast at a peer\*\*/, 'C7: the 6b-ii bullet is struck');
  assert.match(arc, /## AUDIT WORLD6b-iii\(a\) \(2026-09-14\)/, 'the record');
  assert.match(rd('bible/01-Overview/Port-Ledger.md'), /AUDIT WORLD6b-iii\(a\)/, 'the Ledger');
});
