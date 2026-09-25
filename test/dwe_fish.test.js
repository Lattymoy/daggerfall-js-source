// DW-E3 (2026-09-25) - ILIAC PUDDLE NO MORE 1.2.2's PASSIVE FISH (jet082), PINNED: the species
// against PassiveFishSpeciesCatalog.All; the depth weight and the weighted pick; the school's cruise,
// threat and water; a fish's flee, dart, school cohesion, clamp and obstacle; the spawner's placement
// (the depth band, the deep's floor bias, the schoolmates' ring); the icon's aspect; the pulse and the
// spawner's pacing through fakes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PASSIVE_FISH_SPECIES, passiveFishSpecies, FISH_TEMPLATE_INDICES, FISH_ITEM_GROUP, depthWeight01, effectiveWeight, pickSpecies, pickSpeciesByWeight,
  PassiveFishSchool, PassiveFish, vector3Slerp, reflect3, pickFishY, resolveFishPosition, pickSchoolmatePosition, schoolRadius,
  scaledAttemptsPerPixel, restoreIconAspect, isFishTemplateIndex, speciesOfTemplate, fishBillboardSize,
} from '../src/world/passiveFish.js';
import { WATER_BIOME } from '../src/world/underwaterDecorations.js';
import { createFishSpawner, createEncounterPulse, nearestEdgeDistanceSq } from '../src/scenes/deepWatersEncounters.js';

const f32 = Math.fround;
const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const near = (a, b, eps = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} vs ${b}`);

test('DW-E3: the seven species are PassiveFishSpeciesCatalog.All - weights, sizes, speeds, schools, biomes, depth bands, height ranges, dart holds, item templates 9001-9007 in UselessItems2 (mutants: any field)', () => {
  const B = WATER_BIOME;
  const rows = PASSIVE_FISH_SPECIES.map((s) => [s.templateIndex, s.itemName, s.textureArchive, s.textureRecord, s.spawnWeight, s.billboardHeight, s.billboardAspect,
    s.textureName, s.cruiseSpeedMultiplier, s.fleeSpeedMultiplier, s.minSchoolSize, s.maxSchoolSize, s.biomes, s.minDepthFraction, s.maxDepthFraction,
    s.minHeightMultiplier, s.maxHeightMultiplier, s.fleeDartHoldMin, s.fleeDartHoldMax]);
  assert.deepEqual(rows, [
    [9001, 'Longnose Butterflyfish', 216, 42, 10, f32(0.5), f32(1.3958334), 'longnose_butterflyfish', 1, 1, 8, 16, B.Tropical, 0, f32(0.35), f32(0.85), f32(1.15), f32(1.1), f32(2.2)],
    [9002, 'Largemouth Bass', 216, 43, 4, f32(1.2), f32(2.2962964), 'largemouth_bass', f32(1.3), f32(1.3), 1, 2, B.Temperate | B.Swamp | B.Desert, 0, f32(0.45), f32(0.9), f32(1.25), f32(1.8), f32(3.2)],
    [9003, 'Canary Rockfish', 216, 44, 8, f32(0.5), f32(2.7333333), 'canary_rockfish', f32(1.2), f32(1.2), 2, 4, B.OpenOcean | B.Temperate | B.Cold | B.Desert, f32(0.35), 1, f32(0.85), f32(1.15), f32(1.3), f32(2.4)],
    [9004, 'Crucian Carp', 216, 45, 6, f32(1.2), f32(1.64), 'crucian_carp', f32(0.8), f32(0.8), 1, 3, B.Temperate | B.Swamp, 0, f32(0.4), f32(0.85), f32(1.2), f32(1.6), 3],
    [9005, 'Mackerel', 216, 46, 15, f32(0.8), f32(2.2666667), 'mackerel', f32(1.1), f32(1.1), 5, 12, B.Any, f32(0.1), 1, f32(0.8), f32(1.2), f32(0.9), f32(1.8)],
    [9006, 'White Zebra Angelfish', 216, 47, 2, f32(0.4), f32(0.625), 'white_zebra_angelfish', f32(1.3), f32(1.3), 1, 1, B.Tropical, 0, f32(0.35), f32(0.85), f32(1.15), f32(1.1), 2],
    [9007, 'Finulon', 216, 41, 5, f32(1.8), f32(1.7083334), 'finulon', f32(1.2), f32(1.2), 1, 1, B.OpenOcean | B.Cold, f32(0.6), 1, f32(0.8), f32(1.1), f32(1.4), f32(2.6)],
  ]);
  assert.deepEqual(FISH_TEMPLATE_INDICES, [9001, 9002, 9003, 9004, 9005, 9006, 9007]);
  assert.equal(FISH_ITEM_GROUP, 9, 'ItemGroups.UselessItems2');
  assert.ok(isFishTemplateIndex(9004) && !isFishTemplateIndex(9008) && !isFishTemplateIndex(288));
  assert.equal(speciesOfTemplate(9007).itemName, 'Finulon');
  assert.deepEqual(fishBillboardSize(PASSIVE_FISH_SPECIES[0], 1), { w: f32(1.3958334), h: 1 }, 'GetFishBillboardSize: height x aspect');
  // the constructor's clamps
  const odd = passiveFishSpecies(1, 'x', 0, 1, 1, 1, 'x', 1, 1, 0, -3, WATER_BIOME.None, 0.9, 0.2, 0.01, 0.005, 0.05, 0.01);
  assert.deepEqual([odd.minSchoolSize, odd.maxSchoolSize], [1, 1], 'at least one, the max no less');
  assert.deepEqual([odd.minHeightMultiplier, odd.maxHeightMultiplier], [f32(0.05), f32(0.05)], 'a height multiplier of at least 0.05');
  assert.deepEqual([odd.fleeDartHoldMin, odd.fleeDartHoldMax], [f32(0.1), f32(0.1)], 'a dart held at least 0.1 s');
  assert.equal(odd.biomes, WATER_BIOME.Any, 'no biome is every biome');
  assert.deepEqual([odd.minDepthFraction, odd.maxDepthFraction], [f32(0.2), f32(0.9)], 'the band in order');
  assert.deepEqual([passiveFishSpecies(1, 'x', 0, 1, 1, 1, 'x', 1, 1, 1, 1, 1, -1, 2).minDepthFraction, passiveFishSpecies(1, 'x', 0, 1, 1, 1, 'x', 1, 1, 1, 1, 1, -1, 2).maxDepthFraction], [0, 1], 'and inside 0..1');
});

test('DW-E3: DepthWeight01 is 1 in the band and falls to 0 over 0.18 past it; EffectiveWeight is none outside the biome; PickRandom draws by the effective weight, and by the bare weight when none is left (mutants: the softness, the biome mask, the fallback)', () => {
  const mack = PASSIVE_FISH_SPECIES[4], rock = PASSIVE_FISH_SPECIES[2], fin = PASSIVE_FISH_SPECIES[6];
  assert.equal(depthWeight01(rock, 0.35), 1); assert.equal(depthWeight01(rock, 1), 1);
  near(depthWeight01(rock, 0.26), f32(1 - f32(f32(0.35 - 0.26) / f32(0.18))), 1e-6, 'nine hundredths under the band: half');
  assert.equal(depthWeight01(rock, 0.1), 0, 'past the softness: none');
  assert.equal(effectiveWeight(fin, WATER_BIOME.Tropical, 0.8), 0, 'the Finulon keeps to the open ocean and the cold');
  assert.equal(effectiveWeight(fin, WATER_BIOME.Cold, 0.8), 5);
  assert.equal(effectiveWeight(mack, WATER_BIOME.Desert, 0.5), 15, 'the mackerel is everywhere');
  // tropical (229), shallow: butterflyfish 10, mackerel 15 x its weight at 0.05 (0.05 under 0.1: 1 - 0.05/0.18), angelfish 2
  const spawnable = PASSIVE_FISH_SPECIES;
  const wMack = f32(15 * depthWeight01(mack, 0.05));
  const total = f32(f32(10 + wMack) + 2);
  assert.equal(pickSpecies(spawnable, 229, 0.05, () => 0).itemName, 'Longnose Butterflyfish');
  assert.equal(pickSpecies(spawnable, 229, 0.05, () => f32(9.99 / total)).itemName, 'Longnose Butterflyfish');
  assert.equal(pickSpecies(spawnable, 229, 0.05, () => f32(10.01 / total)).itemName, 'Mackerel', 'the list walked in the catalog\'s order');
  assert.equal(pickSpecies(spawnable, 229, 0.05, () => 0.9999).itemName, 'White Zebra Angelfish');
  // a desert pixel at the very bottom: only the rockfish (0.35..1) and the mackerel (0.1..1) - and the bass's band is 0..0.45
  assert.equal(pickSpecies([PASSIVE_FISH_SPECIES[5]], 223, 0.9, () => 0.5).itemName, 'White Zebra Angelfish', 'nothing lives here: the bare weight picks');
  assert.equal(pickSpeciesByWeight(spawnable, () => 0).itemName, 'Longnose Butterflyfish');
  assert.equal(pickSpeciesByWeight(spawnable, () => 49.5 / 50).itemName, 'Finulon', 'Random.Range(0, 50) = 49: the last');
  assert.equal(pickSpecies([], 229, 0.5, () => 0.5), null, 'no spawnable species: none');
});

test('DW-E3: Vector3.Slerp turns the direction by t of the angle and lerps the length; the same way, a lerp; opposite, a half turn about a square axis; Reflect mirrors about the normal (mutants: the clamp, the axis)', () => {
  const s = vector3Slerp([1, 0, 0], [0, 1, 0], 0.5);
  near(s[0], Math.SQRT1_2, 1e-12); near(s[1], Math.SQRT1_2, 1e-12); near(s[2], 0, 1e-12);
  const l = vector3Slerp([2, 0, 0], [0, 4, 0], 0.5);
  near(Math.hypot(...l), 3, 1e-12, 'the length lerped');
  assert.deepEqual(vector3Slerp([1, 0, 0], [0, 1, 0], 2), [0, 1, 0].map((c, i) => vector3Slerp([1, 0, 0], [0, 1, 0], 1)[i]), 't clamped to 1');
  const half = vector3Slerp([1, 0, 0], [-1, 0, 0], 0.5);
  near(Math.hypot(...half), 1, 1e-12); near(half[0], 0, 1e-12, 'a quarter of the half turn is square to both');
  assert.deepEqual(vector3Slerp([0, 0, 0], [0, 0, 2], 0.25), [0, 0, 0.5], 'a zero vector: a lerp');
  assert.deepEqual(reflect3([1, -1, 0], [0, 1, 0]), [1, 1, 0]);
});

/** A sea for the laws: x in [0, 100) is water 30 m deep (floor at 4, surface at 34); anything else land. */
function sea({ time = 0, roll = () => 0.5, frame = 0, dt = 0.1, playerPos = [50, 20, -500], deep = 30 } = {}) {
  const col = (x) => (x >= 0 && x < 100 ? { oceanY: 34, seafloorY: 34 - deep, depth: deep, entry: { key: 'e' } } : null);
  return { time, dt, frame, roll, playerPos, column: (x) => col(x), renderedSeafloorY: (c) => c.seafloorY, visibleDistance: 70, raycast: () => null };
}

test('DW-E3: the school cruises 0.95 m/s on a heading held 2.2 - 4.4 s and flattened to 0.15 of its climb; a threat turns it away at 1.45 m/s for 3 s; water under 2 m or none turns both headings about; it keeps 1.2 m off the floor and 1.4 m under the surface; once a frame (mutants: each speed, the hold, the clearances)', () => {
  const f = sea({ roll: seq([0.9, 0.5, 0.5, 0.5]) });   // insideUnitSphere (0.8, 0, 0), the hold 2.2 + 0.5 x 2.2
  const s = new PassiveFishSchool([50, 20, 0], 3, 1, 1, f);
  assert.deepEqual(s.cruiseDirection, [1, 0, 0]);
  near(s.nextDirectionTime, f32(2.2 + 0.5 * (4.4 - 2.2)), 1e-6);
  s.update(f);
  near(s.center[0], 50 + 0.95 * 0.1, 1e-12, 'cruise: 0.95 m/s');
  s.update(f);
  near(s.center[0], 50 + 0.95 * 0.1, 1e-12, 'once a frame');
  s.reportThreat([0, 40, -10], 0);
  near(s.disruptedDirection[2], -10 / Math.hypot(10, 10), 1e-12, 'flattened to a quarter of its climb');
  assert.ok(s.isDisrupted(2.9) && !s.isDisrupted(3), 'three seconds');
  s.update({ ...f, frame: 1 });
  near(Math.hypot(s.center[0] - (50 + 0.095), s.center[1] - 20, s.center[2]), 1.45 * 0.1, 1e-12, 'disrupted: 1.45 m/s');
  // out of the water: both headings turn about, the centre stays
  const e = new PassiveFishSchool([99.99, 20, 0], 3, 1, 1, sea({ roll: seq([0.9, 0.5, 0.5, 0.5]) }));
  const before = [...e.center];
  e.update(sea({ frame: 5, time: 1 }));
  assert.deepEqual(e.center, before);
  assert.deepEqual(e.cruiseDirection, [-1, -0, -0]);
  near(e.nextDirectionTime, 2, 1e-12, 'a second before it picks again');
  // the floor and the surface
  const low = new PassiveFishSchool([50, 4.5, 0], 3, 1, 1, sea({ roll: seq([0.5, 0.1, 0.5, 0.5]) }));
  low.update(sea({ frame: 9 }));
  near(low.center[1], 4 + 1.2, 1e-12, '1.2 m off the floor');
  assert.ok(low.cruiseDirection[1] >= 0, 'and heading up');
  const high = new PassiveFishSchool([50, 33.9, 0], 3, 1, 1, sea({ roll: seq([0.5, 0.9, 0.5, 0.5]) }));
  high.update(sea({ frame: 9 }));
  near(high.center[1], 34 - 1.4, 1e-12, '1.4 m under the surface');
  // the cruise heading's climb: insideUnitSphere (0.5, 0.5, 0) flattened to (0.5, 0.075, 0)
  const flat = new PassiveFishSchool([50, 20, 0], 3, 1, 1, sea({ roll: seq([0.75, 0.75, 0.5, 0.5]) }));
  near(flat.cruiseDirection[1], 0.075 / Math.hypot(0.5, 0.075), 1e-12, 'flattened to 0.15 of its climb');
});

test('DW-E3: a fish flees within 8 m at 3.5 m/s, darting 35 - 75 degrees off the line away; cruises 1.2 m/s; turns with sharpness 0.75 alone, 2 in a school, 9 fleeing; a fish in water under 2 m goes back and turns round; it keeps 0.8 m off the floor; its loot emptied, it is gone (mutants: the flee radius, the speeds, the clamps)', () => {
  const at = { time: 0, roll: () => 0.5 };
  const fish = new PassiveFish({ position: [50, 20, 0], loot: { items: [{}] }, cruiseMultiplier: 1, fleeMultiplier: 1, school: null, dartHoldMin: 1.6, dartHoldMax: 2.8 }, at);
  // cruise, alone: 1.2 m/s along its heading (the wander draws (0,0,0) -> forward)
  fish.swimDirection = [0, 0, 1]; fish.targetDirection = [0, 0, 1];
  const f = sea({ playerPos: [50, 20, -20], roll: () => 0.5 });   // 20 m off: near enough to update every frame, far enough not to flee
  fish.managedUpdate(f);
  near(fish.position[2], 1.2 * 0.1, 1e-9, 'cruise: 1.2 m/s');
  // the player within 8 m: 3.5 m/s away, off the line by 35 + 0.5 x 40 = 55 degrees
  const g = new PassiveFish({ position: [50, 20, 0], loot: { items: [{}] }, cruiseMultiplier: 1, fleeMultiplier: 1, school: null, dartHoldMin: 1.6, dartHoldMax: 2.8 }, at);
  g.swimDirection = [0, 0, 1];
  g.managedUpdate(sea({ playerPos: [50, 20, -5], roll: () => 0.6, dt: 10 }));
  const moved = g.position.map((c, i) => c - [50, 20, 0][i]);
  near(Math.hypot(...moved), 3.5 * 10, 1e-6, 'flee: 3.5 m/s');
  const ang = Math.acos(moved[2] / Math.hypot(moved[0], moved[2])) * 180 / Math.PI;
  near(ang, 35 + 0.6 * 40, 0.5, 'the dart (the Slerp saturated at 9 x 10 s)');
  // out of the sea: back where it was, turned round
  const h = new PassiveFish({ position: [99.9, 20, 0], loot: null, cruiseMultiplier: 1, fleeMultiplier: 1, school: null, dartHoldMin: 1.6, dartHoldMax: 2.8 }, at);
  h.swimDirection = [1, 0, 0]; h.targetDirection = [1, 0, 0];
  h.managedUpdate(sea({ playerPos: [50, 20, -20], dt: 1 }));
  assert.ok(h.position[0] > 99.9 - 1e-9, 'it moved into the land');
  h.cachedColumn = null;
  h.clampToWater(sea({ time: 5 }));
  assert.deepEqual(h.position, [99.9, 20, 0], 'back to its last safe place');
  assert.ok(h.swimDirection[0] < 0, 'turned round');
  // the floor
  const k = new PassiveFish({ position: [50, 4.2, 0], loot: null, cruiseMultiplier: 1, fleeMultiplier: 1, school: null, dartHoldMin: 1.6, dartHoldMax: 2.8 }, at);
  k.clampToWater(sea());
  near(k.position[1], 4 + 0.8, 1e-12, '0.8 m off the floor');
  // the loot taken
  const l = new PassiveFish({ position: [50, 20, 0], loot: { items: [] }, cruiseMultiplier: 1, fleeMultiplier: 1, school: null, dartHoldMin: 1.6, dartHoldMax: 2.8 }, at);
  assert.equal(l.managedUpdate(sea()), false, 'an emptied fish is destroyed');
});

test('DW-E3: a far fish (160 m, or out of sight) moves a frame a quarter-second; the obstacle ray runs every fifth frame within 60 m and a hit reflects the heading without the step (mutants: the intervals, the ray reach)', () => {
  const at = { time: 0, roll: () => 0 };
  const fish = new PassiveFish({ position: [50, 20, 0], loot: null, cruiseMultiplier: 1, fleeMultiplier: 1, school: null, dartHoldMin: 1.6, dartHoldMax: 2.8 }, at);
  fish.swimDirection = [0, 0, 1]; fish.targetDirection = [0, 0, 1]; fish.nextTurnTime = 99;
  const far = (t) => ({ ...sea({ playerPos: [50, 20, -300], time: t }), visibleDistance: 70 });
  fish.managedUpdate(far(0));   // nextDistantUpdateTime = 0 + 0 x 0.25: due
  const z1 = fish.position[2];
  fish.managedUpdate(far(0.1));
  assert.equal(fish.position[2], z1, 'held: not a quarter-second yet');
  fish.managedUpdate(far(0.26));
  assert.equal(fish.position[2], z1, 'held for 0.25 s + Random.value x 0.05 (0.275)');
  fish.managedUpdate(far(0.3));
  assert.ok(fish.position[2] > z1, 'then one frame\'s step');
  // the ray
  const g = new PassiveFish({ position: [50, 20, 0], loot: null, cruiseMultiplier: 1, fleeMultiplier: 1, school: null, dartHoldMin: 1.6, dartHoldMax: 2.8 }, at);
  g.swimDirection = [0, 0, 1]; g.targetDirection = [0, 0, 1]; g.nextTurnTime = 99;
  let asked = null;
  const f = { ...sea({ playerPos: [50, 20, -20], frame: 5 }), raycast: (o, d, reach) => { asked = reach; return { normal: [0, 0, -1] }; } };
  g.obstacleProbeFrameOffset = 0;
  g.managedUpdate(f);
  near(asked, Math.max(0.6, 1.2 * 0.1 * 5 + 0.15), 1e-9, 'max(0.6, |step| x 5 + 0.15)');
  assert.deepEqual(g.position, [50, 20, 0], 'the step not taken');
  assert.ok(g.swimDirection[2] < 0, 'reflected');
  asked = null;
  g.managedUpdate({ ...f, frame: 6 });
  assert.equal(asked, null, 'not the fifth frame: no ray');
});

test('DW-E3: TryPickFishY keeps to the species\' band of WaterDepth and the column; past 0.55 of the depth it leans to the floor\'s 35 m; the schoolmates stand on the 1.2 m .. radius ring within a metre of the centre\'s depth, 2.2 m apart; GetSchoolRadius; ScaledAttemptsPerPixel (mutants: the band, the bias, the ring, the separation)', () => {
  const rock = PASSIVE_FISH_SPECIES[2];   // 0.35 .. 1
  // a 30 m column (floor 4 + 1.2, surface 34 - 1.4) with WaterDepth 200: the band is 70..200 m - no room
  assert.equal(pickFishY(5.2, 32.6, 34, rock, 200, () => 0.5), null, 'the column is shallower than the species keeps to');
  const mack = PASSIVE_FISH_SPECIES[4];   // 0.1 .. 1 -> 20 .. 200 m of 200
  near(pickFishY(-66, 32.6, 34, mack, 200, () => 0.5), 34 - (20 + 0.5 * (100 - 20)), 1e-3, 'a column 0.5 of the depth: no lean');
  // a deep column: floor at -180 (214 m of 200 - clamped to 1): the lean is full, into the floor's last 35 m
  const y = pickFishY(-178, 32.6, 34, mack, 200, () => 0.5);
  near(y, 34 - (165 + 0.5 * 35), 1e-3, 'Lerp(pick, Range(max(lo, hi - 35), hi), 1)');
  assert.equal(schoolRadius(1), 2.95); assert.equal(schoolRadius(8), 5); near(schoolRadius(0), 2.5, 1e-12);
  assert.equal(scaledAttemptsPerPixel(3), 90); assert.equal(scaledAttemptsPerPixel(0), 0);
  near(scaledAttemptsPerPixel(f32(1.0 / 60)), 0, 0, '0.5 exactly rounds to even (0)');
  // the ring
  const f = sea({ roll: seq([0.9, 0.5, 0.5, 0.5, 0.5]) });
  const m = pickSchoolmatePosition(f, [50, 20, 0], 5, [[50, 20, 0]]);
  const r = Math.hypot(m.pos[0] - 50, m.pos[2]);
  assert.ok(r >= 1.2 - 1e-9 && r <= 5 + 1e-9, `on the ring: ${r}`);
  assert.ok(Math.abs(m.pos[1] - 20) <= 1 + 1e-9, 'within a metre of the centre\'s depth');
  near(pickSchoolmatePosition(sea({ roll: seq([0.9, 0.5, 0.5, 0.5, 1]) }), [50, 20, 0], 5, [[50, 20, 0]]).pos[1], 21, 1e-6, 'the centre\'s depth + Range(-1, 1)');
  const mate = pickSchoolmatePosition(sea({ roll: () => 0.5 }), [50, 20, 0], 1.2, [[50, 20, 5]]).pos;
  near(mate[0], 51.2, 1e-6, 'a mate far enough stands (a zero draw is Vector2.right, Range(1.2, 1.2) in floats)'); assert.equal(mate[1], 20); assert.equal(mate[2], 0);
  assert.equal(pickSchoolmatePosition(sea({ roll: () => 0.5 }), [50, 20, 0], 1.2, [[50, 20, 1.2]]), null, 'within 2.2 m of a mate, 24 times: none');
  const crowded = Array.from({ length: 50 }, (_, i) => [50 + Math.cos(i) * 1.5, 20, Math.sin(i) * 1.5]);
  assert.equal(pickSchoolmatePosition(sea({ roll: () => 0.5 }), [50, 20, 0], 1.2, crowded), null, '24 tries, all within 2.2 m of a mate');
  // TryResolveFishPosition: a column under 8 m holds no fish (the butterflyfish keeps to the shallows: 0 .. 0.35)
  assert.equal(resolveFishPosition(sea({ deep: 7 }), 50, 0, PASSIVE_FISH_SPECIES[0], 200), null);
  assert.ok(resolveFishPosition(sea({ deep: 8 }), 50, 0, PASSIVE_FISH_SPECIES[0], 200), '8 m does');
});

test('DW-E3: RestoreIconAspect point-samples the picture to round(height x aspect) wide, its height kept, and hands back the same picture when the width agrees (mutants: the rounding, the sample)', () => {
  const src = { width: 4, height: 2, data: new Uint8Array(4 * 2 * 4).map((_, i) => (i % 4 === 3 ? 255 : Math.floor(i / 4) % 4)) };
  assert.equal(restoreIconAspect(src, 2), src, 'already 4 wide');
  const out = restoreIconAspect(src, 3);
  assert.equal(out.width, 6); assert.equal(out.height, 2);
  assert.deepEqual([...out.data].filter((_, i) => i % 4 === 0).slice(0, 6), [0, 1, 1, 2, 3, 3], 'each pixel the texel under its centre: floor((x + 0.5) / 6 x 4)');
});

test('DW-E3: the spawner - attempts per pixel from the frequency, two a tick; a school queued whole and five stood a frame; the live cap; a departed group dropped; clearAll (mutants: the per-frame five, the cap, the release)', () => {
  const made = [];
  const settings = { frequency: 3, maxLive: 1080, waterDepth: 200 };
  const spawner = createFishSpawner({
    settings: () => settings,
    spawnable: () => [PASSIVE_FISH_SPECIES[4]],   // mackerel only: schools of 5 - 12
    makeFish: (o) => { const fish = { ...o, gone: false, destroyed: () => fish.gone, destroy: () => { fish.gone = true; }, position: () => o.pos }; made.push(fish); return fish; },
    pixelOrigin: () => [0, 0, 0],
    climateIndexOf: () => 223,
  });
  // a 60 m sea everywhere on the pixel
  const f = { time: 0, dt: 0.1, frame: 0, roll: seq([0.3, 0.3, 0.5, 0.5, 0.5, 0.5, 0.2, 0.7, 0.4]), playerPos: [0, 0, 0],
    column: () => ({ oceanY: 34, seafloorY: -26, depth: 60, entry: {} }), renderedSeafloorY: (c) => c.seafloorY, visibleDistance: 70, raycast: () => null };
  spawner.tickPopulate(f, {}, 'p', { n: 2 });
  assert.equal(spawner.groupOf('p').attemptsRemaining, 88, 'two attempts spent of 90');
  const queued = spawner.pendingCount;
  assert.ok(queued >= 5, `two schools queued (${queued})`);
  assert.equal(spawner.liveCount, queued, 'the queued count live');
  spawner.pumpPendingSpawns();
  assert.equal(made.length, 5, 'five stood a frame');
  assert.ok(spawner.pendingCount > 0, 'more still queued');
  // released: a departed pixel's group gives its fish to the destroy queue and its count back
  const released = [];
  spawner.tickDespawn(new Set(), (o) => released.push(o));
  assert.equal(released.length, 5);
  assert.equal(spawner.liveCount, 0);
  spawner.pumpPendingSpawns();
  assert.equal(made.length, 5, 'the departed group\'s queued spawns are dropped');
  assert.equal(spawner.pendingCount, 0);
  // the cap: a new pixel with room for three
  settings.maxLive = 3;
  spawner.tickPopulate(f, {}, 'q', { n: 5 });
  assert.equal(spawner.liveCount, 3, 'a school trimmed to the headroom');
  assert.equal(spawner.groupOf('q').attemptsRemaining, 0, 'the cap reached: the pixel\'s attempts end');
  spawner.clearAll();
  assert.equal(spawner.liveCount, 0); assert.equal(spawner.pendingCount, 0);
});

test('DW-E3: the pulse - a dozen destroys and the queued spawns every frame; the tick every 0.1 s; no heavy work clears all; a lane switched off two seconds is cleared; pixels kept within 300 m of the nearest edge and populated within 200 m if water, nearest first (mutants: the radii, the grace, the tick)', () => {
  assert.equal(nearestEdgeDistanceSq([50, 0, 50], 0, 0, 819.2), 0, 'inside');
  assert.equal(nearestEdgeDistanceSq([-30, 0, 900], 0, 0, 819.2), 30 * 30 + (900 - 819.2) ** 2);
  const calls = [];
  let heavy = true, context = true, canFish = true;
  const lane = {
    pumpPendingSpawns: () => calls.push('pump'),
    tickDespawn: (keep) => calls.push(`despawn ${[...keep].sort().join(',')}`),
    tickPopulate: (f, e, key, budget) => calls.push(`populate ${key} ${budget.n}`),
    clearAll: () => calls.push('clear'),
  };
  const pixels = [
    { key: 'near', o: [-100, 0, -100], water: true },
    { key: 'dry', o: [719.2, 0, -100], water: false },  // 50 m away: kept, no water to populate
    { key: 'mid', o: [919.2, 0, 0], water: true },     // 250 m away: kept, not populated
    { key: 'far', o: [1519.2, 0, 0], water: true },    // 850 m: released
  ];
  const pulse = createEncounterPulse({
    canRunHeavy: () => heavy, exteriorWaterContext: () => context, playerPosition: () => [669.2, 0, 100],
    loadedPixels: () => pixels, isWaterPixel: (e) => e.water, pixelOrigin: (e) => e.o, keyOf: (e) => e.key,
    fish: { spawner: lane, canPopulate: () => canFish, attempts: 2 },
  });
  const destroyed = [];
  let gone = false;
  pulse.queueDestroy({ destroyed: () => true, hide() { throw new Error('a destroyed object is not queued'); }, destroy() {} });
  for (let i = 0; i < 15; i++) pulse.queueDestroy({ destroyed: () => i === 0 && gone, hide() {}, destroy() { destroyed.push(i); } });
  assert.equal(pulse.pendingDestroyCount, 15);
  gone = true;   // the first one destroyed from outside while it waits
  pulse.pump({ time: 0 });
  assert.equal(destroyed.length, 11, 'a dozen turns a frame - the one already gone spends its turn');
  assert.equal(pulse.pendingDestroyCount, 3);
  assert.deepEqual(calls, ['pump', 'despawn dry,mid,near', 'populate near 2'], 'kept within 300 m; the water within 200 m populated, two attempts');
  calls.length = 0;
  pulse.pump({ time: 0.05 });
  assert.deepEqual(calls, ['pump'], 'the tick waits a tenth of a second');
  calls.length = 0;
  canFish = false;
  pulse.pump({ time: 0.1 }); pulse.pump({ time: 1.1 });
  assert.ok(!calls.includes('clear'), 'switched off under two seconds: kept');
  pulse.pump({ time: 2.2 });
  assert.ok(calls.includes('clear'), 'two seconds off: cleared');
  calls.length = 0;
  heavy = false;
  pulse.pump({ time: 3 });
  assert.deepEqual(calls, ['pump', 'clear'], 'no heavy work: everything cleared');
  assert.equal(destroyed.length, 14, 'and the destroy queue flushed');
});

// ── the fish as items, their pictures, and the host ─────────────────
import { readFileSync } from 'node:fs';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { preloadTextureRecord, decodedTextureTopDown, setTextureDeriveContext, isVendorArchive } from '../src/systems/textureReplacement.js';
import { DEEP_WATERS_FISH_TEMPLATES, createFishItem, normalizeFishItems, installDeepWatersFishIcons, fishIconArchive, FISH_GROUP } from '../src/systems/deepWatersFishItems.js';
import { createDeepWatersFish, createFishPictures, fishBoxDepth, FISH_CUTOFF } from '../src/scenes/deepWatersFish.js';
import { rayUprightCapsule } from '../src/world/passiveFish.js';
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('DW-E3: the fish items are the mod\'s ItemTemplates.json row for row, each drawn from an archive of its own (the treasure piles keep TEXTURE.216); TryCreateFishItem mints the template in UselessItems2; NormalizeFishItemCollection puts a stray fish back, its stack and condition kept (mutants: the remap, the group)', () => {
  const shipped = JSON.parse(rd('vendor/iliac-puddle-no-more/ItemTemplates.json'));
  assert.equal(shipped.length, 7);
  for (const row of shipped) {
    const t = templateByIndex(row.index);
    assert.ok(t?.custom, `${row.index} registered`);
    for (const k of Object.keys(row)) {
      if (k === 'worldTextureArchive' || k === 'worldTextureRecord') continue;
      assert.deepEqual(t[k], row[k], `${row.index}.${k}`);
    }
    assert.equal(row.worldTextureArchive, 216, 'the mod names TEXTURE.216 ...');
    assert.equal(t.worldTextureArchive, fishIconArchive(row.index), '... the port the fish\'s own archive');
    assert.equal(t.worldTextureRecord, 0);
  }
  assert.equal(DEEP_WATERS_FISH_TEMPLATES.find((t) => t.index === 9007).name, 'Juvenile Finulon', 'the item is the template\'s name, not the species\'');
  const item = createFishItem(PASSIVE_FISH_SPECIES[4]);
  assert.equal(item.group, 'UselessItems2'); assert.equal(FISH_GROUP, 'UselessItems2');
  assert.equal(item.templateIndex, 9005); assert.equal(item.name, 'Mackerel');
  assert.equal(createFishItem(null), null);
  const enchantments = [{ type: 1, param: 2 }];
  const stray = { ...createFishItem(PASSIVE_FISH_SPECIES[1]), group: 'MiscItems', stackCount: 3, currentCondition: 1, maxCondition: 1,
    name: 'Old Bass', material: 5, dyeColor: 2, flags: 4, value: 999, message: 7, worldTextureArchive: 216, worldTextureRecord: 43, id: 'u1', enchantments };
  const other = { group: 'MiscItems', templateIndex: 200, name: 'x' };
  assert.equal(normalizeFishItems([stray, other, null]), 1);
  assert.equal(stray.group, 'UselessItems2'); assert.equal(stray.name, 'Largemouth Bass');
  assert.deepEqual([stray.stackCount, stray.currentCondition, stray.maxCondition], [3, 1, 1], 'the stack and the condition given back');
  assert.deepEqual([stray.material, stray.dyeColor, stray.flags, stray.value, stray.message, stray.worldTextureArchive], [0, undefined, 0, 100, 0, undefined], 'SetItem: the template\'s data over the item\'s');
  assert.equal(stray.id, 'u1'); assert.equal(stray.enchantments, enchantments, 'what SetItem does not write, kept');
  assert.equal(other.group, 'MiscItems', 'not a fish: left alone');
});

test('DW-E3: the icons - each fish\'s archive a stand-in of one record, built from its picture with the aspect restored (LoadFishIconTexture\'s fallback, RestoreIconAspect) (mutants: the aspect, the archive)', async () => {
  const pic = { width: 4, height: 2, data: new Uint8Array(4 * 2 * 4).fill(255) };
  const asked = [];
  const n = installDeepWatersFishIcons({ fetchBytes: async (name) => { asked.push(name); return new Uint8Array([1]); }, decode: async () => pic });
  assert.equal(n, 7);
  assert.ok(isVendorArchive(9001) && isVendorArchive(9007), 'an archive that is only the icon');
  assert.ok(!isVendorArchive(216), 'TEXTURE.216 untouched');
  setTextureDeriveContext({});
  try {
    await preloadTextureRecord(9005, 0);
    const icon = decodedTextureTopDown(9005, 0);
    assert.equal(icon.width, Math.round(2 * f32(2.2666667)), 'the mackerel\'s shape: round(2 x 2.2666667) = 5 wide');
    assert.equal(icon.height, 2);
    assert.ok(asked.includes('mackerel'));
  } finally { setTextureDeriveContext(null); }
});

test('DW-E3: the host - a spawned fish is a loot container of its species\' item, sized height x Range(min, max) by the aspect; its box turned to the camera, the loot container\'s reach, no surface of its own; the pump moves the fish and destroys an emptied one; the draw groups by species at the fish\'s cut-out; a recentre moves the fish and their schools (mutants: the box, the reach, the cutoff, the shift)', () => {
  const pictures = { loaded: () => true, spawnable: () => [PASSIVE_FISH_SPECIES[4]], texture: () => ({ tex: 't', frames: 1 }) };
  const host = createDeepWatersFish({
    settings: () => ({ frequency: 3, maxLive: 50, waterDepth: 200 }),
    canRunHeavy: () => true, exteriorWaterContext: () => true, playerPosition: () => [0, 0, 0],
    loadedPixels: () => [{ px: 1, py: 1 }], isWaterPixel: () => true, pixelOrigin: () => [0, 0, 0], keyOf: () => '1,1', climateIndexOf: () => 223,
    pictures, makeItem: (s) => createFishItem(s), roll: () => 0.25,
  });
  const col = { oceanY: 34, seafloorY: -26, depth: 60, entry: {} };
  const f = { time: 0, dt: 0.1, frame: 1, roll: () => 0.5, playerPos: [400, 20, 400], column: () => col, renderedSeafloorY: (c) => c.seafloorY, visibleDistance: 1e6, raycast: () => null };
  host.pump(f);   // the tick queues two schools (PumpPendingSpawns runs before the tick)
  assert.equal(host.count, 0, 'queued, not yet stood');
  assert.equal(host.spawner.pendingCount, 4, 'two schools of two: a constant roll puts every later mate on the first mate');
  host.pump({ ...f, frame: 2, time: 0.05 });   // they stand the next frame (no tick: 0.1 s)
  assert.equal(host.count, 4);
  const o = host.fishes[0];
  near(o.size.h, f32(0.8) * f32(f32(0.8) + 0.25 * f32(f32(1.2) - f32(0.8))), 1e-6, 'height x Range(0.8, 1.2)');
  near(o.size.w, o.size.h * f32(2.2666667), 1e-9);
  assert.equal(o.loot.items[0].templateIndex, 9005);
  const t = host.lootTargets([1, 0, 0], [0, 1, 0], [0, 0, 1]).find((x) => x.key === o.key);
  assert.deepEqual(t.obb.box, [-o.size.w / 2, -o.size.h / 2, -fishBoxDepth(o.size.w) / 2, o.size.w / 2, o.size.h / 2, fishBoxDepth(o.size.w) / 2]);
  assert.equal(fishBoxDepth(1), 0.35); assert.equal(fishBoxDepth(2), 0.5);
  assert.equal(t.reach, 3.2, 'TreasureActivationDistance'); assert.equal(t.noSurface, true);
  assert.equal(host.fishFor(o.key), o);
  const g = host.drawGroups(() => ({ tex: 't', frames: 1 }));
  assert.equal(g.length, 1); assert.equal(g[0].facing, 2); assert.equal(g[0].cutoff, FISH_CUTOFF); assert.equal(FISH_CUTOFF, 0.1);
  // taken: gone the next frame
  o.loot.items.length = 0;
  host.pump({ ...f, frame: 3, time: 0.06 });
  assert.equal(host.fishFor(o.key), null);
  assert.ok(!host.fishes.includes(o), 'Object.Destroy');
  // a recentre
  const other = host.fishes[0];
  const before = [...other.fish.position], sc = other.fish.school ? [...other.fish.school.center] : null;
  host.offsetAll([819.2, 0, 0]);
  near(other.fish.position[0], before[0] + 819.2, 1e-9);
  if (sc) near(other.fish.school.center[0], sc[0] + 819.2, 1e-9, 'the school\'s centre moves with its water');
});

test('DW-E3: the fish pictures load once each, edge-cleaned, bottom-up; a species with no picture never spawns (mutants: the clean, the flip)', async () => {
  const made = [];
  let cleaned = 0;
  const pics = createFishPictures({
    fetchBytes: async (name) => { if (name === 'finulon') throw new Error('404'); return new Uint8Array([1]); },
    decode: async () => ({ width: 1, height: 2, data: new Uint8Array([1, 1, 1, 255, 2, 2, 2, 255]) }),
    clean: () => { cleaned++; return true; },
    createTexture: (frames) => { made.push(frames); return { tex: made.length, frames: frames.length }; },
  });
  const warn = console.warn; console.warn = () => {};
  try {
    pics.start(); pics.start();
    for (let i = 0; i < 10; i++) await null;
  } finally { console.warn = warn; }
  assert.equal(made.length, 6, 'six pictures, once');
  assert.equal(cleaned, 6);
  assert.deepEqual([...made[0][0].data].filter((_, i) => i % 4 === 0), [2, 1], 'the rows turned bottom-up');
  assert.equal(pics.spawnable().length, 6, 'the Finulon without its picture is not spawnable');
  assert.equal(pics.failed, 1);
});

test('DW-E3: a fish\'s probe meets the player\'s capsule - its side and its caps, from outside only', () => {
  const side = rayUprightCapsule([-2, 1, 0], [1, 0, 0], 5, [0, 0, 0], 0.35, 1.8);
  near(side.dist, 1.65, 1e-12); assert.deepEqual(side.normal, [-1, 0, 0]);
  const top = rayUprightCapsule([0, 3, 0], [0, -1, 0], 5, [0, 0, 0], 0.35, 1.8);
  near(top.dist, 1.2, 1e-12); assert.deepEqual(top.normal, [0, 1, 0]);
  assert.equal(rayUprightCapsule([0, 1, 0], [1, 0, 0], 5, [0, 0, 0], 0.35, 1.8), null, 'from inside: nothing');
  assert.equal(rayUprightCapsule([-2, 1, 0], [1, 0, 0], 1, [0, 0, 0], 0.35, 1.8), null, 'out of reach');
});

test('DW-E3: the world host - the pulse and PumpAll after the decorations, the pulse alone indoors, the fish raced with the piles and opened on the pile arm, hovered and itemised by the fish\'s own item, moved with a recentre, drawn streamed after the decorations; the loot window shows the fish\'s icon (pins)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(dwDecor\) \{ dwDecor\.process\(\); deepWaters\.flushPromoteTiming\(\); \}[^\n]*\n\s+if \(dwFish\) \{ _dwFishInside = false; dwFish\.pump\(dwFishFrame\(dt\)\); \}/);
  assert.match(w, /if \(dwFish\) \{ _dwFishInside = true; dwFish\.pulse\.pump\(dwFishFrame\(dt\)\); \}/, 'indoors: the pulse only (IsPlayerInExteriorWaterContext false - cleared two seconds on)');
  assert.match(w, /_pilePick = pickActivatableHit\(cam\.pos, useFwd, dwLootTargets\(\), collider\);/);
  assert.match(w, /pile: pickActivatableHit\(cam\.pos, _hd, dwLootTargets\(\), collider\),/);
  assert.match(w, /const _fish = dwFish\?\.fishFor\(dropKey\) \?\? null;[^\n]*\n\s+const pile = _fish \? null : droppedLoot\.pileFor\(dropKey\);/, 'a fish key never reaches pileFor (it reads no prefix)');
  assert.match(w, /dwFish\?\.offsetAll\(r\.offset\);/);
  assert.match(w, /if \(dwDecor\) drawDeepWatersDecorations\(groundQueue\);[^\n]*\n\s+if \(dwFish\) drawDeepWatersFish\(\);/);
  assert.match(w, /onTransientReset\(\(\) => dwFish\.reset\(\)\);/);
  assert.match(w, /visibleDistance: cam\.pos\[1\] < seaY - 0\.05 \? vision \* 1\.1 : topSurfaceOpaqueFadeEnd\(vision\),/);
  assert.match(w, /const dwPlayerObjectPosition = \(\) => \(walkMode \? \[player\.pos\[0\], player\.pos\[1\] \+ \(player\.height \?\? CAPSULE_HEIGHT\) \/ 2, player\.pos\[2\]\] : cam\.pos\);/, 'PlayerObject.transform.position: the capsule centre');
  assert.match(w, /playerPos: dwPlayerObjectPosition\(\),/, 'the flee, the probe and the distant step measure from the centre');
  assert.match(w, /playerPosition: \(\) => \(dwPlaying\(\) \? dwPlayerObjectPosition\(\) : null\),/);
  assert.match(w, /for \(const pool of \[exteriorFoes\.foes, cityGuards\.guards\]\) \{[\s\S]{0,300}rayUprightCapsule\(o, d, reach, feet, BODY_CAPSULE_RADIUS, f\.ai\.height \?\? CAPSULE_HEIGHT\);/, 'the probe meets the foes\' CharacterControllers (every layer, triggers ignored)');
  assert.match(w, /const td = decodedTextureTopDown\(a, 0\);[\s\S]{0,120}renderer\.uploadTexture\('img', `dwfish:\$\{a\}`, \{ width: td\.width, height: td\.height, colors: td\.rgba \}\)/, 'the icon uploads top-down, as the panel\'s drawImgCrop samples UI art');
  const inv = rd('src/ui/nativeInventory.js');
  assert.match(inv, /const own = this\.hooks\.loot\?\.remoteImage\?\.\(\);\n\s+return own \? \{ image: own, label: shown\.label \} : shown;/, 'UpdateFishLootIcon: over whatever the window drew, its label kept');
  const r = rd('src/render/deepWatersRender.js');
  assert.match(r, /gl\.uniform1f\(u\.uCutoff, g\.cutoff \?\? DECORATION_CUTOFF\);/);
  assert.match(r, /gl\.drawElements\(gl\.TRIANGLES, g\.count, gl\.UNSIGNED_INT, g\.offset \?\? 0\);/);
});
