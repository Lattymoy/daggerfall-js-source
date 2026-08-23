// B1 (AUDIT 25 blocker 1): quest foe spawning - the HOST half.
//
// The machine has declared world.createFoeGameObjects / tryPlaceFoe /
// raiseOnEncounterEvent since Q3-iii, the placement law sat fully
// ported in sceneMount.js, and NO host supplied any of them - so no
// quest that kills or meets a Foe resource could complete, and every
// killed/injured trigger was unreachable. These pins hold the new
// host wiring: the mint (GameObjectHelper.CreateFoeGameObjects), the
// behaviour host handle over a pool foe, the env adapter the raycast
// ring runs over, and the seam mounts themselves.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mintQuestFoeWave, bindQuestFoeHost, placeFoeEnv, entityOccupancy, questFoeGender } from '../src/scenes/questFoeHost.js';
import { placeFoeFreely } from '../src/systems/quest/sceneMount.js';
import { GENDERS } from '../src/characters/nameHelper.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const mkFoeResource = () => ({
  isFoe: true, isHidden: false, isRestrained: false,
  injuredTrigger: false, deathTrigger: false, kills: 0,
  spellQueue: null, itemQueueCount: 0,   // the real Foe's empty queues
  parentQuest: { uid: 42 },
  symbol: { name: '_foe_' },
  gender: GENDERS.Female,
  foeType: 7,
  spawnCount: 3,
  setInjured() { this.injuredTrigger = true; },
  incrementKills() { this.kills++; },
});

test('B1 mint: CreateFoeGameObjects - one behaviour per handle, identity stamped, count clamped 1..8', () => {
  const machine = { getQuest: () => null };
  const foe = mkFoeResource();
  const wave = mintQuestFoeWave(machine, foe, foe.spawnCount);
  assert.equal(wave.length, 3);
  for (const h of wave) {
    assert.equal(h.foe, foe);
    assert.equal(h.behaviour.questUID, 42);       // AssignResource stamps identity only
    assert.equal(h.behaviour.targetSymbol, foe.symbol);
    assert.equal(h.behaviour.targetResource, null);   // start() waits for placement (SetActive(false) defers Start)
  }
  assert.equal(mintQuestFoeWave(machine, foe, 0).length, 1);    // Mathf.Clamp(spawnCount, 1, 8)
  assert.equal(mintQuestFoeWave(machine, foe, 99).length, 8);
});

test('B1 host handle: the injured-then-dead flow credits the kill, restrain unhostiles, hidden destroys', () => {
  const foe = mkFoeResource();
  const quest = { uid: 42, getResource: (s) => (s === foe.symbol ? foe : null) };
  const machine = { getQuest: (uid) => (uid === 42 ? quest : null) };
  const [handle] = mintQuestFoeWave(machine, foe, 1);
  const f = { entity: { health: 20, maxHealth: 20, level: 4, items: [] }, ai: { isHostile: true }, dead: false };
  const removed = [];
  const pool = {
    removeFoe: (x) => { removed.push(x); x.dead = true; },
    zeroFoeHealth: (x) => { x.entity.health = 0; x.dead = true; },
    spellsByIndex: () => new Map(),
    foeSinks: () => ({}),
    rolls: Math.random,
  };
  bindQuestFoeHost(f, handle.behaviour, pool);
  assert.equal(f.questBehaviour, handle.behaviour);
  assert.equal(handle.behaviour.targetResource, foe);   // start() ran at the stand - the activation moment
  assert.equal(handle.behaviour.enemy.currentHealth, 20);

  // restrain: setNonHostile through the handle, latched once
  foe.isRestrained = true;
  handle.behaviour.update();
  assert.equal(f.ai.isHostile, false);
  assert.equal(handle.behaviour.restraintApplied, true);

  // injury holds death to the NEXT tick (C#'s own comment law)
  f.entity.health = 5;
  handle.behaviour.update();
  assert.equal(foe.injuredTrigger, true);
  assert.equal(foe.kills, 0);

  // death credits exactly once
  f.entity.health = 0;
  handle.behaviour.update();
  assert.equal(foe.kills, 1);
  handle.behaviour.update();
  assert.equal(foe.kills, 1);

  // hidden foe: Destroy(gameObject) through the pool
  foe.isHidden = true;
  handle.behaviour.update();
  assert.deepEqual(removed, [f]);
});

test('B1 host handle: DeathTrigger zeroing routes the pool death door; a positive set writes health', () => {
  const foe = mkFoeResource();
  const quest = { uid: 42, getResource: () => foe };
  const machine = { getQuest: () => quest };
  const [handle] = mintQuestFoeWave(machine, foe, 1);
  const f = { entity: { health: 20, maxHealth: 20 }, ai: {}, dead: false };
  let zeroed = 0;
  bindQuestFoeHost(f, handle.behaviour, { removeFoe: () => {}, zeroFoeHealth: () => { zeroed++; f.entity.health = 0; }, foeSinks: () => ({}) });
  handle.behaviour.enemy.setCurrentHealth(12);
  assert.equal(f.entity.health, 12);
  assert.equal(zeroed, 0);
  handle.behaviour.enemy.setCurrentHealth(0);   // the "kill foe" action's zeroing
  assert.equal(zeroed, 1);
});

test('B1 env adapter: collider raycastHit rides the {point, normal, distance} contract and the overlap adds the entity term', () => {
  const collider = {
    raycastHit: (o, d, max) => (d[1] === -1
      ? { dist: 2, key: null, normal: [0, 1, 0] }               // floor 2 below
      : { dist: Math.min(10, max), key: 'wall', normal: [-d[0], 0, -d[2]] }),
    sphereOverlaps: () => false,
  };
  const occupied = entityOccupancy((f) => f.feet, () => [{ feet: [3, 0.9, 0], dead: false }], [0, 0, 0]);
  const env = placeFoeEnv({ collider, playerFeet: [0, 0.9, 0], playerYawRad: 0, fovDegrees: 60, rolls: () => 0.6, isOccupied: occupied });
  const hit = env.raycast({ x: 0, y: 0.9, z: 0 }, { x: 1, y: 0, z: 0 }, 20);
  assert.equal(hit.distance, 10);
  assert.equal(hit.point.x, 10);
  assert.equal(hit.normal.x, -1);
  assert.equal(env.raycast({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 5).distance, 5);
  // the entity term: a foe capsule near the test point occupies it
  assert.equal(env.overlapSphere({ x: 3, y: 1.8, z: 0 }, 0.65), true);
  assert.equal(env.overlapSphere({ x: 12, y: 1.8, z: 0 }, 0.65), false);
  // and the whole ring runs over the adapter to a real spot
  const spot = placeFoeFreely(env);
  assert.ok(spot && Number.isFinite(spot.x + spot.y + spot.z), 'the ring lands a spot through the adapter');
});

test('B1 gender: the Foe resource\'s own humanoid gender, the marker stand\'s read', () => {
  assert.equal(questFoeGender({ gender: GENDERS.Female }), 'female');
  assert.equal(questFoeGender({ gender: GENDERS.Male }), 'male');
});

test('B1 seam gate: the trio is mounted on questWorld and the pools drive + tear down behaviours', () => {
  const world = read('src/scenes/world.js');
  const modes = read('src/scenes/worldModes.js');
  const ext = read('src/scenes/exteriorFoes.js');
  const dun = read('src/scenes/dungeonContext.js');
  for (const seam of ['createFoeGameObjects:', 'tryPlaceFoe:', 'raiseOnEncounterEvent:']) {
    assert.ok(world.includes(seam), `questWorld mounts ${seam}`);
  }
  // the wilderness arm widens the ring (TryPlacement :252-257)
  assert.match(world, /minDistance: 8, maxDistance: 25/);
  // MERGE (the S-A lane's catch): fieldOfView() answers RADIANS and
  // the law speaks DEGREES - both arms must convert, or every foe
  // places ~1 degree off the view axis, dead ahead of the player
  assert.match(world, /fovDegrees: fieldOfView\(\) \* 180 \/ Math\.PI/);
  assert.match(modes, /fovDegrees: fieldOfView\(\) \* 180 \/ Math\.PI/);
  // FinalizeFoe (:341-359): the Flying lift, in both arms - and only
  // Flying, never Spectral (the one flag FinalizeFoe reads)
  assert.match(world, /=== 'Flying'/);
  assert.match(modes, /=== 'Flying'/);
  // the dungeon arm stands through the context's one build chain
  assert.match(modes, /dungeonCtx\.spawnQuestFoe\(/);
  // both pools drive the behaviour every frame the object lives
  // (a ported function with no caller is a comment - the standing lesson)
  assert.match(ext, /f\.questBehaviour\?\.update\(\)/);
  assert.match(dun, /f\.questBehaviour\?\.update\(\)/);
  // and both tear it down - the cull, the hidden-foe remove, the scene destroy
  assert.match(ext, /questBehaviour\?\.notifyDestroyed\(\)/);
  assert.match(dun, /questBehaviour\?\.notifyDestroyed\(\)/);
});
