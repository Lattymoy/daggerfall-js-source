// ROAD-B (b2-hostility-model) - THE WATCH COMES THROUGH THE FRONT
// DOOR. PlayerEntity.SpawnCityGuards' FIRST arm (:626-642): when the
// player is inside an open shop, a tavern or a residence, the response
// is 2-5 Knight_CityWatch standing at THAT building's lowest outer
// interior door, all facing Vector3.forward - and the method RETURNS,
// so the street law never runs for those buildings.
//
// world.js carried the FLAG for this since AUDIT 39 (#22): "this
// host's pool is the exterior street, so the watch is waiting
// outside". The pool it needed is the mode machine's own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findLowestOuterInteriorDoor, doorWorldPosition } from '../src/player/enterExit.js';
import { GUARD_INDOOR_DOOR_OFFSET } from '../src/scenes/cityGuards.js';
import { CAPSULE_RADIUS } from '../src/player/motor.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => readFileSync(join(root, rel), 'utf8');

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** A static door at a world point with a world-space normal. */
const door = (x, y, z, n = { x: 0, y: 0, z: 1 }) => ({
  centre: { x, y, z }, normal: n, size: { x: 1, y: 2, z: 1 }, matrix: I,
});

// ---------------------------------------------------------------
// DaggerfallStaticDoors.FindLowestOutermostDoor (:205-238)
// ---------------------------------------------------------------

test('ROAD-B: the lowest outer interior door is lowest AND farthest from the building centre', () => {
  // dist is HORIZONTAL and measured from the interior's own origin.
  const doors = [door(3, 4, 0), door(8, 0, 0), door(2, 0, 0)];
  const got = findLowestOuterInteriorDoor(doors, [0, 0, 0]);
  assert.equal(got.index, 1, 'the ground-level one 8 units out');
  assert.deepEqual(got.pos, [8, 0, 0]);
  assert.deepEqual(got.normal, [0, 0, 1]);

  // HORIZONTAL is a Vector2 (DaggerfallStaticDoors.cs:226), and the y
  // gap is no part of it: an upper-storey door NEAR in xz must not lock
  // farthestDist against a ground-floor door farther out. Read in 3D
  // this answers 0 - the watch would stand upstairs.
  const storey = [door(1, 6, 0), door(3, 0, 0)];
  assert.equal(findLowestOuterInteriorDoor(storey, [0, 0, 0]).index, 1,
    'the y gap is not part of dist - Vector2.Distance, not Vector3');
});

test('ROAD-B: the pick is measured from the INTERIOR origin, not from world zero', () => {
  // The same three doors, in a building parented far from the origin:
  // the far-from-centre one is now the one at x = -8 relative to the
  // building, which is world x = 92.
  const org = [100, 0, 100];
  const doors = [door(103, 0, 100), door(92, 0, 100)];
  assert.equal(findLowestOuterInteriorDoor(doors, org).index, 1);
  // Read against world zero instead and the answer flips - which is
  // the bug this argument exists to avoid.
  assert.equal(findLowestOuterInteriorDoor(doors, [0, 0, 0]).index, 0);
});

test('ROAD-B: C#\'s single-pass predicate is order-dependent, and is ported as written', () => {
  // `if (y <= lowestY && dist > farthestDist)` over ONE pass with
  // lowestY = MaxValue and farthestDist = 0: a door only wins if it is
  // no higher than every previous WINNER and strictly farther than
  // every previous WINNER. So a low-but-near door seen first can lock
  // out a lower-and-nearer door seen later...
  const far = door(9, 0, 0), lowNear = door(4, -1, 0);
  assert.equal(findLowestOuterInteriorDoor([far, lowNear], [0, 0, 0]).index, 0,
    'the farther one holds farthestDist at 9 and the lower one never gets in');
  // ...and the same two doors in the other order answer differently.
  assert.equal(findLowestOuterInteriorDoor([lowNear, far], [0, 0, 0]).index, 0,
    'seen first, the LOWER one wins and the higher one fails the y test');
  // (both answers are index 0 here for different reasons - that is the
  // quirk: the array order, not the geometry, decides.)
});

test('ROAD-B: no doors is null, not a Doors[-1] index', () => {
  // DFU returns TRUE with doorIndexOut = -1 and its caller indexes the
  // array. Unreachable with real data; the port answers null.
  assert.equal(findLowestOuterInteriorDoor([], [0, 0, 0]), null);
  assert.equal(findLowestOuterInteriorDoor(null), null);
  // A door exactly at the origin has dist 0, which is never > 0.
  assert.equal(findLowestOuterInteriorDoor([door(0, 0, 0)], [0, 0, 0]), null);
});

test('ROAD-B: the door centre and normal come through the door MATRIX', () => {
  // A rotated/translated building: the query must answer the world
  // point and the world normal, which is what the arrival offset is
  // applied along.
  const m = new Float32Array([0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 10, 0, 20, 1]);  // yaw 90, translate
  const d = { centre: { x: 5, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 }, size: { x: 1, y: 2, z: 1 }, matrix: m };
  const got = findLowestOuterInteriorDoor([d], [10, 0, 20]);
  assert.deepEqual(got.pos, doorWorldPosition(d));
  assert.deepEqual(got.pos.map((v) => Math.round(v)), [10, 0, 15]);
  assert.deepEqual(got.normal.map((v) => Math.round(v)), [1, 0, 0]);
});

test('ROAD-B: the arrival clearance is PlayerController.radius + 0.1', () => {
  assert.equal(GUARD_INDOOR_DOOR_OFFSET, CAPSULE_RADIUS + 0.1);
  assert.ok(Math.abs(GUARD_INDOOR_DOOR_OFFSET - 0.45) < 1e-9);
});

// ---------------------------------------------------------------
// THE ARM, and the wiring that reaches it
// ---------------------------------------------------------------

test('ROAD-B: the indoor arm is the FIRST thing in SpawnCityGuards and always returns', () => {
  const g = src('src/scenes/cityGuards.js');
  const fn = g.slice(g.indexOf('async function spawnCityGuards('));
  const cap = fn.indexOf('if (activeCount() > MAX_ACTIVE_GUARD_SPAWNS) return;');
  const arm = fn.indexOf('if (interior?.eligible) {');
  const street = fn.indexOf('if (immediate) {');
  assert.ok(cap >= 0 && arm > cap && street > arm,
    'inside the cap gate, ahead of both street arms (PlayerEntity.cs:626-642)');
  const armBody = fn.slice(arm, street);
  assert.match(armBody, /findLowestOuterInteriorDoor\(interior\.doors, interior\.origin\)/);
  assert.match(armBody, /GUARD_INDOOR_DOOR_OFFSET/);
  assert.match(armBody, /const guardCount = 2 \+ Math\.floor\(rand\(\) \* 4\);/, 'Random.Range(2, 6)');
  assert.match(armBody, /spawnGuardAt\(\[\.\.\.at\], 0, playerFeet \?\? null\)/, 'Vector3.forward, and the same point every time');
  // :641 - the return is OUTSIDE the door-query `if`, so a building
  // whose query fails spawns nothing and still does not fall through.
  assert.ok(/\}\n\s*return;\n\s*\}/.test(armBody), 'the return is unconditional within the arm');
  assert.ok(!/immediate/.test(armBody), 'the bool is not read by the indoor arm at all');
});

test('ROAD-B: the mode machine mints a watch pool with every interior and tears it down with it', () => {
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /interiorGuards = makeInteriorGuards\(ctx\);/, 'minted at the mount');
  assert.equal((wm.match(/interiorGuards\?\.clearLive\?\.\(\);/g) ?? []).length, 2,
    'and freed at BOTH teardowns, beside interiorFoes');
  assert.equal((wm.match(/interiorGuards\?\.clearLive\?\.\(\);[^\n]*\n\s*interiorGuards = null;/g) ?? []).length, 2,
    'and nulled at both, so a stale pool cannot outlive its collider');
  // it drives, draws, and can be swung at
  assert.match(wm, /const _guardBatches = interiorGuards\.update\(overlayHeld \? 0 : dt, player\.pos, cam\.pos,/);
  assert.match(wm, /renderer\.drawBillboards\(_guardBatches, camRight, UP_Y\)/);
  assert.match(wm, /if \(interiorGuards\?\.resolvePlayerHit\(interiorWeapon\.playerWeapon/,
    'and the interior swing resolves against the watch FIRST, as it does above ground');
});

test('ROAD-B: spawnCityGuardsInside gates on the three PlayerEnterExit flags', () => {
  const wm = src('src/scenes/worldModes.js');
  const fn = wm.slice(wm.indexOf('spawnCityGuardsInside(immediate) {'));
  assert.match(fn.slice(0, 1200), /if \(mode !== 'interior' \|\| !interiorCtx \|\| !interiorGuards\) return false;/);
  assert.match(fn.slice(0, 1200), /!!b\.insideOpenShop/, 'IsPlayerInsideOpenShop, off the latched building record');
  assert.match(fn.slice(0, 1200), /b\.buildingType === BUILDING_TYPES\.Tavern/, 'IsPlayerInsideTavern');
  assert.match(fn.slice(0, 1200), /isResidence\(b\.buildingType\)/, 'IsPlayerInsideResidence');
  assert.match(fn.slice(0, 1200), /if \(!eligible\) return false;/,
    'and a temple or a guild hall falls through to the street arm, as C# does');
  assert.match(fn.slice(0, 1200), /interior: \{ doors: interiorCtx\.doors, origin: interiorCtx\.parentPt\(0, 0, 0\), eligible: true \}/,
    'the interior hands its own doors and its own origin');
});

test('ROAD-B: both mode-machine hosts offer the indoor arm the call before the street law', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = src(host);
    const fn = s.slice(s.indexOf('function _spawnGuards(immediate) {'));
    assert.ok(fn.indexOf('if (modes?.spawnCityGuardsInside?.(immediate)) return;') >= 0
      && fn.indexOf('spawnCityGuardsInside') < fn.indexOf('cityGuards.spawnCityGuards('),
      `${host}: the indoor arm first, the street pool second`);
    assert.match(s, /onGuardHit: \(dmg, apply\) => arrestFlow\.onGuardHit\(dmg, apply\)/,
      `${host}: and the indoor watch reaches the host's arrest interception`);
  }
  // the FLAG this closes
  assert.ok(!src('src/scenes/world.js').includes("FLAGGED: DFU's INDOOR arm spawns 2-5 guards"),
    'the AUDIT 39 flag is closed, not left standing beside its fix');
});
