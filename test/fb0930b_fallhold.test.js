// FIELD BUGS 2026-09-30b (FALL-HOLD) - ReynBlackwinter, #support: "anyone else having the constant fps drop in
// overworld? Resets after saving\loading, heard its from an enemy endlessly falling through the ground somewhere".
//
// It was. A World of Daggerfall camp's foe (world.js standWodAction, `placed: true`) is never culled and outlives its
// pixel - the teardown frees corpses only, and only the Privateer's Hold's foes go with the block - and the save carries
// it wherever it stands (exteriorFoes.js snapshotWorld). A load re-mints it there (restoreWorld), over a pixel the load
// has not built: the teleport awaits the arrival pixel alone, and a camp left behind is outside the ring. The world
// host's heightAt answers -Infinity off a built pixel, so the collider has no floor under it, and the fresh motor (no
// rest latch) falls - for ever: nothing in EnemyAI bounds a fall, and a placed foe is never culled. Every fixed step of
// the fall cost more: collider.move sweeps a motion in SUBSTEP_LEN (0.2625) pieces, 256 at most, ten capsule resolves
// a piece - 770 capsule resolves a frame at a minute's fall (36 km down), 2,560 (23,040 sphere resolves) from 201.6 s
// on, three times that at 20 fps (FOE-CATCHUP). DFU's CharacterController.Move is one sweep however long, and DFU's
// loose foes never outlive their ground (CollectLooseObjects). The save keeps the feet, not the fall's speed, so a load
// re-mints the foe from rest: the cost falls back to a dozen resolves a frame and climbs again - "resets after
// saving\loading". The city watch, saved and restored the same way and with no distance cull at all, fell the same.
//
// THE FIX, the player's own law: the host holds the player's motor until the pixel under him is built
// (world.js _seasonHoldKey, player.holdFrame); both pools now hold a foe whose column has no built ground
// (`groundStands`, the host's heightAt finite) - not stepped, sensing nothing (EnemyAI.holdFrame), so a non-placed foe
// is culled as before and none refuses a rest. When the pixel builds, the collider's floor stands it on its ground. The
// column alone is asked: a flyer, a levitator or a swimmer over built ground, and a Deep Waters swimmer (a carved cell
// answers its seafloor), are stepped as before. Every pin runs the REAL pools on the REAL Collider over a streamed
// world whose heightAt is the host's law, the pool rig of audit_wod_branch.test.js (a crafted MONSTER.BSA).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Collider } from '../src/player/collider.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { createCityGuards } from '../src/scenes/cityGuards.js';
import { areEnemiesNearby } from '../src/systems/encounters.js';
import { TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { setPref } from '../src/systems/uiPrefs.js';   // BAL4: the switch this file's pins assumed

// BAL4 (bible/05-Combat/Balance-Arc.md section 6): the Enhanced AI ships On now; this file pins the classic motor's hold and swing (the tactics brain's tokens and recovery are TACT's own pins),
// so it says Off outright where it used to read the default (LR5's trap: a pin that leaned on a default moves with it)
setPref('enhancedAI', false);

const rd = (p) => readFileSync(join(import.meta.dirname, '..', p), 'utf8');
const settle = async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0)); };
const E = TERRAIN_SIZE;   // one pixel east

// the world host's floor law (world.js heightAt): the heightfield on a BUILT pixel, -Infinity off one; `floor` answers
// a carved cell's seafloor (DW-B) where it names one
function streamedWorld(keys, floor = () => 0) {
  const built = new Set(keys);
  const heightAt = (x, z) => (built.has(`${Math.floor(x / E)},${Math.floor(z / E)}`) ? floor(x, z) : -Infinity);
  const collider = new Collider(heightAt);
  let work = 0;   // capsule resolves this collider ran - the falling foe's cost
  const rc = collider._resolveCapsule;
  collider._resolveCapsule = function (...a) { work++; return rc.apply(this, a); };
  return { built, heightAt, collider, work: () => work, groundStands: (x, z) => Number.isFinite(heightAt(x, z)) };
}
// the crafted MONSTER.BSA (audit_wod_branch.test.js): 0 the Rat (a walker), 3 the Giant Bat (a flyer), 11 the
// Slaughterfish (a swimmer); and the watch's CLASS18.CFG (watch1.test.js)
function craftCfg() {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  [40, 50, 50, 85, 50, 50, 90, 55].forEach((a, i) => v.setUint16(58 + i * 2, a, true));
  return b;
}
function craftMonsterBsa(records) {
  const out = new Uint8Array(4 + records.reduce((a, [, b]) => a + b.length, 0) + 18 * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + 14, bytes.length, true); pos += 18; }
  return out;
}
function classCfg() {
  const b = new Uint8Array(80); const v = new DataView(b.buffer);
  v.setUint16(52, 10, true);
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true);
  return b;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()], ['ENEMY003.CFG', craftCfg()], ['ENEMY011.CFG', craftCfg()]]);
const fetchBytes = async (n) => { if (n === 'MONSTER.BSA') return bsa; if (n === 'CLASS18.CFG') return classCfg(); throw new Error(`no ${n}`); };
const tex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60), crimeCommitted: 4 });   // Assault: the watch stands
const rig = (w, pe, extra = {}) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, destroyBatch: () => {}, textures: new Map() },
  collider: w.collider, fetchBytes, getTexture: async () => tex,
  uploadRecordFrame: () => {}, currentMinute: () => 0, currentPixelKey: () => '0,0',
  playerEntity: pe, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9,
  groundStands: w.groundStands,   // the world host's mount (world.js): its heightAt, finite
  ...extra,
});
// the world host's encounter pool, and world.js's load: snapshotWorld (natives), the teleport's clearLive, restoreWorld
function worldPool(w, pe = playerEntity(), extra = {}) {
  const pool = createExteriorFoes(rig(w, pe, extra));
  const senses = { candidates: () => [], playerEntity: pe, playerHeight: 1.8, playerCrouching: false, playerInvisible: false, movingLessThanHalfSpeed: true };
  const run = (seconds, me) => { for (let i = 0; i < Math.round(seconds * 60); i++) pool.update(1 / 60, me, [me[0], me[1] + 1.6, me[2]], senses); };
  const saveAndLoad = async () => {
    const saved = pool.snapshotWorld((p) => ({ x: p[0], z: p[2] }));
    pool.clearLive();
    pool.restoreWorld(saved, (nx, nz) => [nx, nz], 0);
    await settle();
    return saved;
  };
  return { pool, run, saveAndLoad };
}

test('FALL-HOLD: a World of Daggerfall camp foe a load restores over a pixel not built is held - it fell for ever, never culled, and every frame cost more', async () => {
  const w = streamedWorld(['0,0', '1,0']);
  const { pool, run, saveAndLoad } = worldPool(w);
  let me = [E + 380, 0, 400];
  const camp = await pool.spawnFoe(0, [E + 400, 0, 400], { placed: true, groundAlign: { hitDist: 0.5 } });   // world.js standWodAction's stand
  run(2, me);
  assert.ok(Math.abs(camp.ai.feet[1]) < 0.05, 'it stands on its camp');
  me = [-3 * E + 400, 0, 400];
  w.built.delete('1,0'); w.built.add('-3,0');   // ridden three pixels west: destroyPixel took the camp's ground
  run(5, me);
  await saveAndLoad();
  const [f] = pool.foes.filter((x) => !x.dead);
  assert.ok(f?.placed, 'the load re-mints it, placed (never culled), wherever it stood');
  run(59, me);
  const before = w.work();
  run(1, me);
  assert.equal(w.work() - before, 0, 'no collider work for a held foe (it was ~770 capsule resolves a frame at a minute\'s fall, 2,560 from 201.6 s)');
  assert.ok(Math.abs(f.ai.feet[1]) < 0.05, `it stands where the save left it, not ${Math.round(f.ai.feet[1])} (36 km down at a minute)`);
  // the player rides back: the pixel builds, the foe stands on its ground and is stepped again
  me = [E + 300, 0, 400];
  w.built.add('1,0');
  run(1, me);
  assert.ok(Math.abs(f.ai.feet[1]) < 0.05 && f.ai.isGrounded, 'on its ground again once the pixel builds');
  assert.ok(w.work() > before, 'and stepped');
});

test('FALL-HOLD: a save taken mid-fall heals - the foe is held deep over nothing, and stood on its ground when the pixel builds, no fall billed', async () => {
  const w = streamedWorld(['0,0']);
  const { pool, run } = worldPool(w);
  const me = [400, 0, 400];
  pool.restoreWorld([{ mobileType: 0, nativeX: E + 400, nativeZ: 400, y: -576040, yaw: 0, health: 20, maxHealth: 20, placed: true }], (nx, nz) => [nx, nz], 0);
  await settle();
  const [f] = pool.foes;
  run(10, me);
  assert.equal(Math.round(f.ai.feet[1]), -576040, 'held where the save left it - it did not fall on (1 km more in those ten seconds)');
  w.built.add('1,0');
  run(0.1, me);
  assert.ok(Math.abs(f.ai.feet[1]) < 0.05, `the collider's floor stands it on the ground (${f.ai.feet[1]})`);
  assert.ok(!f.dead && f.entity.health === 20, 'no fall billed for it');
});

test('FALL-HOLD: a held foe senses nothing - the encounter foe is culled as before, and a quickload\'s attacker over a pixel still building is kept, refuses no rest, and fights on its ground', async () => {
  const w = streamedWorld(['0,0', '1,0']);
  const { pool, run, saveAndLoad } = worldPool(w);
  let me = [E + 380, 0, 400];
  const rat = await pool.spawnFoe(0, [E + 400, 0, 400], { feetGiven: true });
  run(3, me);
  assert.ok(rat.ai.detected, 'it has seen the player');
  me = [-3 * E + 400, 0, 400];
  w.built.delete('1,0');
  run(1, me);
  assert.ok(rat.dead, 'held, it holds no "detected": the 120 m cull takes it as it always did');
  // the quickload in an ambush (AUDIT 26 F216): the attacker is ten metres off, across a pixel edge still building
  me = [E - 5, 0, 400];
  await pool.spawnFoe(0, [E + 5, 0, 400], { feetGiven: true });
  run(2, me);
  await saveAndLoad();
  const [f] = pool.foes.filter((x) => !x.dead);
  run(10, me);
  assert.ok(f && !f.dead && Math.abs(f.ai.feet[1]) < 0.05, 'held ten seconds - neither fallen nor culled (it fell 1 km and was culled)');
  assert.equal(areEnemiesNearby(pool.foes, { resting: true }), false, 'and it refuses no rest while it is off the world');
  w.built.add('1,0');
  run(2, me);
  assert.ok(Math.abs(f.ai.feet[1]) < 0.05 && f.ai.detected, 'on its ground, on the player again');
});

test('FALL-HOLD: a foe whose ground goes down under it mid-fight (a re-skin\'s teardown, a pixel still building) is held and acts on nothing it sensed - no swing, no refused rest - and fights on once it builds', async () => {
  const w = streamedWorld(['0,0', '1,0']);
  const hurt = [];
  const { pool, run } = worldPool(w, playerEntity(), { onPlayerHurt: (...a) => hurt.push(a) });
  const me = [E - 0.6, 0, 400];   // on pixel 0,0; the rat a pace away, over the edge on 1,0
  const f = await pool.spawnFoe(0, [E + 0.6, 0, 400], { feetGiven: true });
  run(4, me);
  assert.ok(f.ai.detected && f.ai.inSight && f.attack.swingSeq > 0, 'it has seen the player and swung');
  assert.equal(areEnemiesNearby(pool.foes, { resting: true }), true, 'and refuses the rest, as it should');
  w.built.delete('1,0');   // tickSeason's destroyPixel: the rebuild puts the player's own pixel back first
  const swings = f.attack.swingSeq;
  run(4, me);
  assert.ok(Math.abs(f.ai.feet[1]) < 0.05 && !f.dead, 'held - neither fallen nor culled');
  assert.equal(f.attack.swingSeq, swings, 'no swing decided on a sight latched before the hold');
  assert.equal(areEnemiesNearby(pool.foes, { resting: true }), false, 'and no rest refused on one');
  w.built.add('1,0');
  run(4, me);
  assert.ok(f.ai.detected && f.attack.swingSeq > swings, 'on its ground, it sees and swings again');
});

test('FALL-HOLD: the watch - a watchman a load restores over a pixel not built (a crime standing) is held, and stands when it builds', async () => {
  const w = streamedWorld(['0,0']);
  const pe = playerEntity();
  const guards = createCityGuards(rig(w, pe));
  guards.restoreWorld([{ nativeX: E + 400, nativeZ: 400, y: 0, yaw: 0, health: 30, maxHealth: 30 }], (x, z) => [x, z], 0);
  await settle();
  const [g] = guards.guards;
  assert.ok(g, 'restored');
  const me = [400, 0, 400];
  const run = (s) => { for (let i = 0; i < Math.round(s * 60); i++) guards.update(1 / 60, me, [me[0], 1.6, me[2]]); };
  run(59);
  const before = w.work();
  run(1);
  assert.equal(w.work() - before, 0, 'no collider work (the watch has no distance cull: it fell for ever, ~770 resolves a frame at a minute)');
  assert.ok(!g.dead && Math.abs(g.ai.feet[1]) < 0.2, `held where the restore stood it, 0.1 up (not ${Math.round(g.ai.feet[1])}: 1 km down in ten seconds)`);
  w.built.add('1,0');
  run(1);
  assert.ok(Math.abs(g.ai.feet[1]) < 0.05 && g.ai.isGrounded, 'on its ground once the pixel builds');
});

test('FALL-HOLD: the column alone is asked - a flyer, a levitator and a Deep Waters swimmer over built ground are stepped as before; over none, even a paralysed flyer (which falls) is held', async () => {
  // pixel 0,0 built: flat ground at 0, and a carved cell (x < 100) whose seafloor is 40 down under a sea at 0
  const w = streamedWorld(['0,0'], (x) => (x < 100 ? -40 : 0));
  const pe = playerEntity();
  const { pool, run } = worldPool(w, pe, { waterLevelY: () => 0 });
  const me = [120, 0, 120];   // every foe inside the 120 m cull
  const bat = await pool.spawnFoe(3, [150, 30, 150], { feetGiven: true });   // Flying, 30 m up
  const lev = await pool.spawnFoe(0, [170, 12, 170], { feetGiven: true });   // a walker under Levitate, 12 m up
  const fish = await pool.spawnFoe(11, [60, -20, 60], { feetGiven: true });  // Aquatic, 20 m under the forged sea, over the carved cell
  lev.entity.activeEffects = [{ kind: 'levitate' }];
  const spy = (f) => {
    const c = { stepped: 0, held: 0 };
    const u = f.ai.update.bind(f.ai), h = f.ai.holdFrame?.bind(f.ai);
    f.ai.update = (...a) => { c.stepped++; return u(...a); };
    f.ai.holdFrame = (...a) => { c.held++; return h?.(...a); };
    return c;
  };
  const counts = [bat, lev, fish].map(spy);
  run(1, me);
  assert.ok(lev.ai.levitating && bat.ai.flies && fish.ai.swims, 'the three behaviours');
  for (const [name, c] of [['flyer', counts[0]], ['levitator', counts[1]], ['Deep Waters swimmer', counts[2]]]) {
    assert.deepEqual(c, { stepped: 60, held: 0 }, `the ${name} over built ground is stepped every frame, never held`);
  }
  assert.ok(bat.ai.feet[1] > 20 && lev.ai.feet[1] > 5 && fish.ai.feet[1] > -40 && fish.ai.feet[1] < 0, 'none was brought down, and the fish is still under the sea');
  assert.ok(counts.every((c) => c.stepped === 60) && [bat, lev, fish].every((f) => !f.dead), 'all three stood the second');
  // off the built world a flyer is held too - a paralysed flyer falls (flyerFalls), and a knocked one
  const w2 = streamedWorld(['0,0']);
  const pe2 = playerEntity();
  const p2 = worldPool(w2, pe2);
  const bat2 = await p2.pool.spawnFoe(3, [E + 400, 30, 400], { feetGiven: true, placed: true });   // a camp's flyer: never culled
  bat2.entity.activeEffects = [{ kind: 'paralyze' }];
  p2.run(5, [400, 0, 400]);
  assert.ok(!bat2.dead && Math.abs(bat2.ai.feet[1] - 30) < 0.05, `the paralysed flyer over no ground is held at its height, not fallen to ${Math.round(bat2.ai.feet[1])}`);
});

test('FALL-HOLD: the world host hands the ground law to both its pools; a pool without one (an interior, the one-location host) holds nothing', () => {
  const src = rd('src/scenes/world.js');
  for (const pool of ['createExteriorFoes', 'createCityGuards']) {
    const at = src.indexOf(`= ${pool}({`);
    assert.ok(at > 0, pool);
    assert.match(src.slice(at, at + 500), /groundStands: \(x, z\) => Number\.isFinite\(heightAt\(x, z\)\)/, `${pool} is handed the streamed ground`);
  }
  assert.doesNotMatch(rd('src/scenes/worldModes.js'), /groundStands/, 'the interior mount (heightAt -Infinity, mesh floors) is handed none');
  assert.doesNotMatch(rd('src/scenes/exterior.js'), /groundStands/, 'nor the one-location host');
});

test('FALL-HOLD: an interior-shaped collider (heightAt -Infinity, a mesh floor) with no ground law still lets a foe fall onto its floor', async () => {
  const c = new Collider(() => -Infinity);
  c.addMesh('floor', new Float32Array([-50, 0, -50, 50, 0, -50, 50, 0, 50, -50, 0, 50]), new Uint32Array([0, 1, 2, 0, 2, 3]), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const pe = playerEntity();
  const pool = createExteriorFoes({ ...rig({ collider: c, groundStands: undefined }, pe) });
  const f = await pool.spawnFoe(0, [0, 3, 0], { feetGiven: true });
  for (let i = 0; i < 120; i++) pool.update(1 / 60, [20, 0, 20], [20, 1.6, 20], { candidates: () => [], playerEntity: pe, playerHeight: 1.8 });
  assert.ok(Math.abs(f.ai.feet[1]) < 0.05, `it lands on the room's floor (${f.ai.feet[1]})`);
});
