// RE1 - THE RANDOM ENCOUNTER STANDS WHERE DFU STANDS IT (2026-08-29).
//
// Every random-spawn arm in PlayerEntity goes out through
// GameObjectHelper.CreateFoeSpawner, which is FoeSpawner.PlaceFoeFreely:
// a bearing chosen against the field of view, backed off whatever the
// ray hits by a separation the surface angle decides, on a floor found
// below, in space nothing already occupies.
//
// Both port hosts instead walked EIGHT COMPASS POINTS at minDistance
// and took the first with ground under it. That is three wrongs at
// once: the foe arrives due NORTH of the player unless north is
// blocked (the loop starts at bearing 0 and breaks on the first hit),
// it can stand inside a wall - nothing tested the space, only the
// ground beneath it - and it can share a spot with a foe already
// standing there.
//
// SD1 made the law consumable from a host and added the arm DFU's
// dungeon rest spawn needs. RE1 carries the CALL SITES' arguments as
// data, because the three encounter arms do not pass the same things:
// the dungeon one alone clears lineOfSightCheck.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SPAWNER_ARMS, intermittentEnemySpawn,
  MIN_DUNGEON_SPAWN_DISTANCE, MIN_LOCATION_SPAWN_DISTANCE, MIN_WILDERNESS_SPAWN_DISTANCE,
} from '../src/systems/encounters.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(HERE, '..', rel), 'utf8');

test('RE1: the arm table is CreateFoeSpawner\'s arguments, per call site', () => {
  // PlayerEntity.cs:574 / :594 / :610 / :687, and the max is
  // CreateFoeSpawner's own default (GameObjectHelper.cs:1314) wherever
  // the call site does not pass one.
  assert.deepEqual({ ...SPAWNER_ARMS.locationNight }, { minDistance: 10, maxDistance: 20, lineOfSightCheck: true });
  assert.deepEqual({ ...SPAWNER_ARMS.wilderness }, { minDistance: 10, maxDistance: 20, lineOfSightCheck: true });
  assert.deepEqual({ ...SPAWNER_ARMS.dungeonRest }, { minDistance: 8, maxDistance: 20, lineOfSightCheck: false });
  // D9: the guards' row is READ now - PlayerEntity.cs:687's fallback
  // stands its 2..5 watchmen through PlaceFoeFreely like every other
  // row, so the table is the whole call-site list AND every row of it
  // drives something.
  assert.deepEqual({ ...SPAWNER_ARMS.cityGuards }, { minDistance: 12.8, maxDistance: 51.2, lineOfSightCheck: true });
  assert.match(read('src/scenes/cityGuards.js'), /placeFoeFreely\(env, SPAWNER_ARMS\.cityGuards\)/,
    'the guards row is the crime law\'s own band, read from the table');
});

test('RE1: THE DUNGEON ARM ALONE CLEARS THE LINE-OF-SIGHT CHECK', () => {
  // This is the one a player feels. Set, the foe is placed just
  // outside the view cone; cleared, it takes any bearing in the
  // circle - DFU: "Don't care about player's field of view (e.g. at
  // rest)". A monster that finds you asleep may be standing over you.
  assert.equal(SPAWNER_ARMS.dungeonRest.lineOfSightCheck, false);
  assert.equal(SPAWNER_ARMS.locationNight.lineOfSightCheck, true);
  assert.equal(SPAWNER_ARMS.wilderness.lineOfSightCheck, true);
  // and the constants keep their own exported names - the table is a
  // second reader of them, not a second copy
  assert.equal(SPAWNER_ARMS.dungeonRest.minDistance, MIN_DUNGEON_SPAWN_DISTANCE);
  assert.equal(SPAWNER_ARMS.locationNight.minDistance, MIN_LOCATION_SPAWN_DISTANCE);
  assert.equal(SPAWNER_ARMS.wilderness.minDistance, MIN_WILDERNESS_SPAWN_DISTANCE);
});

test('RE1: the roll hands its arm\'s WHOLE band to the host, not just a distance', () => {
  // a wilderness night that rolls a spawn (the roll seam is injectable)
  const hit = intermittentEnemySpawn(
    { gameMinutes: 0, inside: false, inLocationRect: false, climateIndex: 231, playerLevel: 3 },
    () => 0,
  );
  assert.ok(hit, 'the fixture rolls a spawn');
  assert.equal(hit.minDistance, 10);
  assert.equal(hit.maxDistance, 20, 'the max used to be absent, so the host could not pass a band at all');
  assert.equal(hit.lineOfSightCheck, true);
  // the dungeon arm carries its own, including the false flag
  const dungeon = intermittentEnemySpawn(
    { gameMinutes: 0, inside: true, inDungeon: true, isResting: true, enemyAlertActive: true, dungeonType: 0, playerLevel: 3 },
    () => 0,
  );
  assert.ok(dungeon, 'the dungeon fixture rolls a spawn');
  assert.equal(dungeon.minDistance, 8);
  assert.equal(dungeon.lineOfSightCheck, false);
});

test('RE1: the exterior host stands its encounter through the ONE law', () => {
  const world = read('src/scenes/world.js');
  // the eight-point ring is gone
  assert.equal(/eight compass points at the classic distance, terrain-landed/.test(world), false);
  assert.equal(/const a = \(d \* Math\.PI\) \/ 4;/.test(world), false);
  const at = world.indexOf('const _standEncounterFoe =');
  assert.ok(at > 0, 'the stander exists');
  const body = world.slice(at, at + 1400);
  assert.match(body, /placeFoeFreely\(env, \{\n\s*minDistance: hit\.minDistance, maxDistance: hit\.maxDistance,\n\s*lineOfSightCheck: hit\.lineOfSightCheck,\n\s*\}\)/,
    'all three of the arm\'s arguments are passed, not a hardcoded band');
  assert.match(body, /fovDegrees: fieldOfView\(\) \* 180 \/ Math\.PI,/, 'fieldOfView() answers RADIANS');
  assert.match(body, /isOccupied: entityOccupancy\(\(f\) => f\.ai\?\.feet, \(\) => exteriorFoePool\(\), feet\)/,
    'and the spot must be empty of the foes already standing');
  assert.match(body, /const fly = \(ENEMY_BASICS\[hit\.mobileType\]\?\.behaviour \?\? 'General'\) === 'Flying';/);
  assert.match(body, /yaw: Math\.atan2\(feet\[0\] - spot\.x, feet\[2\] - spot\.z\)/, 'LookAt player');
  assert.match(world, /_standEncounterFoe\(hit, playerFeet\);/, 'the tick calls it');
});

test('RE1: the dungeon host stands its rest interruption the same way, with its own flag', () => {
  const dc = read('src/scenes/dungeonContext.js');
  assert.equal(/const landed = foeDeps\.floorLanding\(collider, \[x, feet\[1\] \+ 1\.5, z\]\);/.test(dc), false,
    'the eight-point ring is gone');
  assert.match(dc, /async function _spawnEncounter\(\{ mobileType, minDistance, maxDistance, lineOfSightCheck \}\)/,
    'the whole band arrives from the roll');
  assert.match(dc, /spot = placeFoeFreely\(env, \{ minDistance, maxDistance, lineOfSightCheck \}\);/);
  assert.match(dc, /playerYawRad: _motorYaw,/, 'the host\'s live look yaw, which both dungeon hosts report as cam.yaw');
  assert.match(dc, /isOccupied: entityOccupancy\(\(f\) => f\.ai\?\.feet, \(\) => foes, feet\)/, 'against THIS host\'s pool');
  assert.match(dc, /if \(f\?\.ai\) f\.ai\.yaw = Math\.atan2\(feet\[0\] - spot\.x, feet\[2\] - spot\.z\);/, 'LookAt player');
  // FinalizeFoe's fork, which the exterior stander also carries - a bat
  // woken at rest hangs above the floor rather than standing on it
  assert.match(dc, /const fly = \(ENEMY_BASICS\[mobileType\]\.behaviour \?\? 'General'\) === 'Flying';/);
  assert.match(dc, /y: fly \? spot\.y \+ 1\.5 : spot\.y,/, 'the flier lift rides into the build record');
  // the NT2 gender law survived the rewrite - it is the reason this
  // call passes 'unspecified' rather than rolling one here
  assert.match(dc, /gender: 'unspecified',/);
  assert.match(dc, /no ad-hoc roll - buildFoeAt resolves an unspecified/);
});

test('RE1: both hosts bound the retry, and neither invented a second law', () => {
  const world = read('src/scenes/world.js');
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /const ENCOUNTER_PLACE_ATTEMPTS = 12;/);
  assert.match(dc, /for \(let i = 0; i < ENCOUNTER_PLACE_ATTEMPTS && !spot; i\+\+\)/);
  assert.match(world, /for \(let i = 0; i < LOOSE_FOE_PLACE_ATTEMPTS && !spot; i\+\+\)/);
  // both import the shared ring rather than reimplementing it
  for (const [name, src] of [['world.js', world], ['dungeonContext.js', dc]]) {
    assert.match(src, /import \{ placeFoeFreely \} from '\.\.\/systems\/quest\/sceneMount\.js'/, `${name} imports the law`);
    assert.match(src, /placeFoeEnv/, `${name} uses the shared env adapter`);
  }
});
