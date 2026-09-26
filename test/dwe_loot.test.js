// DW-E5 (2026-09-26) - ILIAC PUDDLE NO MORE 1.2.2's SUNKEN LOOT (jet082), PINNED: UnderwaterLootSpawner's
// constants and its two static tables against the assembly; the pulse's rolls (a wreck, the stray piles), the
// spot (the fog-ahead point, the forward-biased angle, the 48 m cells), the seafloor under a pile, the wreck's
// depth, the cluster's spots, the rubble round a pile and a wreck, FillRandomItem's seven kinds; the spawner through
// fakes - the gate, the anchor, the clocks, the cap, a stray pile and its rubble, a wreck and its guards, the reset;
// ItemBuilder's three group draws as one export; droppedLoot's undrawn containers; the world's wiring.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as L from '../src/world/underwaterLoot.js';
import { createUnderwaterLoot } from '../src/scenes/deepWatersLoot.js';
import { createRandomReligiousItem, createRandomGem, createRandomJewellery, createRandomOfGroup, ITEM_GROUPS, generateRandomLoot, LOOT_MATRICES } from '../src/systems/loot.js';
import { createDroppedLoot } from '../src/scenes/droppedLoot.js';

const f32 = Math.fround;
const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const near = (a, b, eps = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} vs ${b}`);
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('DW-E5: UnderwaterLootSpawner\'s constants as the assembly declares them, TreasurePileRecords and RubbleRecords whole (mutants: any value, any record)', () => {
  assert.deepEqual([L.LOOT_PULSE_DISTANCE, L.MIN_PULSE_INTERVAL_SECONDS, L.FAILED_PULSE_RETRY_SECONDS, L.DESPAWN_DISTANCE, L.FULL_STRAY_LOOT_PER_PULSE,
    L.NORMAL_LOOT_MULTIPLIER, L.TREASURE_COVE_STRAY_MULTIPLIER, L.TREASURE_COVE_CLUSTER_CHANCE_MULTIPLIER, L.MAX_CLUSTER_CHANCE, L.CLUSTER_DEBRIS_RADIUS,
    L.CLUSTER_DEBRIS_COUNT, L.SHORE_LOOT_PULSE_MULTIPLIER, L.LOOSE_LOOT_DEBRIS_CHANCE, L.TREASURE_COVE_LOOSE_LOOT_DEBRIS_CHANCE, L.LOOSE_LOOT_DEBRIS_MIN_RADIUS,
    L.LOOSE_LOOT_DEBRIS_MAX_RADIUS, L.LOOSE_LOOT_DEBRIS_SPOT_ATTEMPTS, L.NEARBY_WATER_PROBE_DIRECTIONS, L.NEARBY_WATER_GATE_CHECK_INTERVAL,
    L.DEFAULT_LOOT_MIN_SPAWN_DISTANCE, L.DEFAULT_LOOT_MAX_SPAWN_DISTANCE, L.MAX_STRAY_LOOT_PER_PULSE, L.TREASURE_COVE_MAX_STRAY_LOOT_PER_PULSE,
    L.FORWARD_SPAWN_ARC_DEGREES, L.FORWARD_BIAS_CHANCE, L.FOG_AHEAD_MAX_DISTANCE, L.SEAFLOOR_Y_CLEARANCE, L.LOOT_FLOOR_LIFT, L.SPAWN_SPOT_ATTEMPTS,
    L.SPAWN_CELL_SIZE, L.MAX_REMEMBERED_SPAWN_CELLS, L.CLUSTER_LOOT_RADIUS, L.CLUSTER_LOOT_MIN_SPACING, L.CLUSTER_LOOT_SPOT_ATTEMPTS, L.WRECK_MINIMUM_DEPTH_FRACTION],
  [90, 8, 3, 140, 2, 2, 3, 3, f32(0.85), 22, 24, 0.125, 0.75, f32(0.95), 1.5, 5, 4, 12, 2, 42, 72, 12, 18, 110, f32(0.7), 130, 2, f32(0.08), 18, 48, 128, 11, 3, 8, 0.5]);
  assert.deepEqual([L.LOOT_VIEWPORT_MARGIN, L.NEARBY_WATER_MINIMUM_DEPTH, L.DEEP_WATER_PULSE_DEPTH, L.DEFAULT_MAX_LIVE_LOOT_OBJECTS, L.DEFAULT_MAX_LIVE_TREASURE_CLUSTERS, L.DEFAULT_WATER_DEPTH],
    [f32(0.12), 8, 8, 32, 3, 200], 'the literals the methods carry');
  assert.equal(L.TREASURE_PILE_ARCHIVE, 216);
  assert.deepEqual(L.TREASURE_PILE_RECORDS, [0, 1, 3, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 36, 37, 38, 39, 40]);
  assert.deepEqual(L.RUBBLE_RECORDS.map((r) => [r.archive, r.record]), [[105, 0], [105, 5], [105, 6], [105, 7], [105, 8], [105, 9], [105, 10],
    [400, 0], [400, 1], [400, 4], [400, 6], [380, 1], [96, 0], [96, 2], [96, 3], [96, 4], [96, 5]]);
  assert.deepEqual(L.RUBBLE_ARCHIVES, [105, 400, 380, 96]);
});

test('DW-E5: WorldCellKey floors each coordinate by the 48 m cell, negatives down; DepthSpawnMultiplier is Lerp(1, 2, the depth over the Water Depth) and 1 with no column (mutants: the floor, the lerp)', () => {
  assert.equal(L.worldCellKey(47.9, 0, 48), '0,0');
  assert.equal(L.worldCellKey(48, 96, 48), '1,2');
  assert.equal(L.worldCellKey(-0.1, -48.1, 48), '-1,-2');
  assert.notEqual(L.worldCellKey(10, 60, 48), L.worldCellKey(60, 10, 48), 'x and z are not one axis');
  assert.equal(L.depthSpawnMultiplier(null, 250), 1);
  near(L.depthSpawnMultiplier({ depth: 125 }, 250), 1.5, 1e-6);
  assert.equal(L.depthSpawnMultiplier({ depth: 600 }, 250), 2, 'clamped');
  near(L.depthSpawnMultiplier({ depth: 0.5 }, 0), 1.5, 1e-6, 'Max(1, WaterDepth)');
});

test('DW-E5: a wreck - no draw at a rate of nothing or at the cap; the rate x 2 (3 in a cove) x the shore x the depth, capped at 0.85 (mutants: the multipliers, the cap, the gates)', () => {
  let draws = 0;
  const r = (v) => () => { draws++; return v; };
  const base = { rate: 0.2, liveClusters: 0, maxLiveClusters: 12, cove: false, shore: 1, depthMultiplier: 1 };
  assert.equal(L.shouldSpawnTreasureCluster({ ...base, rate: 0 }, r(0)), false); assert.equal(draws, 0, 'no rate: no draw');
  assert.equal(L.shouldSpawnTreasureCluster({ ...base, liveClusters: 12 }, r(0)), false); assert.equal(draws, 0, 'at the cap: no draw');
  assert.equal(L.shouldSpawnTreasureCluster(base, r(f32(0.39))), true);
  assert.equal(L.shouldSpawnTreasureCluster(base, r(f32(0.4))), false, '0.2 x 2 = 0.4');
  assert.equal(L.shouldSpawnTreasureCluster({ ...base, cove: true }, r(f32(0.59))), true, 'a cove: x 3');
  assert.equal(L.shouldSpawnTreasureCluster({ ...base, shore: 0.125 }, r(0.049)), true);
  assert.equal(L.shouldSpawnTreasureCluster({ ...base, shore: 0.125 }, r(0.051)), false, 'the shore\'s eighth');
  assert.equal(L.shouldSpawnTreasureCluster({ ...base, depthMultiplier: 2 }, r(0.79)), true, 'the depth doubles it');
  assert.equal(L.shouldSpawnTreasureCluster({ ...base, rate: 1, depthMultiplier: 2 }, r(f32(0.85))), false, 'capped at 0.85');
  assert.equal(L.shouldSpawnTreasureCluster({ ...base, rate: 1, depthMultiplier: 2 }, r(0.849)), true);
});

test('DW-E5: the stray piles - none after a wreck but in a cove; RollCount(2 x the rate x 2 (3) x the shore x the depth), 12 at most (18 in a cove) (mutants: the gate, the product, the clamps)', () => {
  const base = { clusterSpawned: false, cove: false, rate: f32(0.7), shore: 1, depthMultiplier: 1 };
  assert.equal(L.rollStrayLootCount({ ...base, clusterSpawned: true }, () => 0), 0, 'a wreck took the pulse');
  assert.equal(L.rollStrayLootCount({ ...base, rate: 0 }, () => 0), 0);
  // 2 x 0.7 x 2 = 2.8: 2, and a third under 0.8 of a chance
  assert.equal(L.rollStrayLootCount(base, () => 0.79), 3);
  assert.equal(L.rollStrayLootCount(base, () => 0.81), 2);
  assert.equal(L.rollStrayLootCount({ ...base, clusterSpawned: true, cove: true }, () => 0.99), 4, 'a cove after its wreck: 2 x 0.7 x 3 = 4.2');
  assert.equal(L.rollStrayLootCount({ ...base, rate: 1, depthMultiplier: 2, cove: false }, () => 0.99), 8);
  assert.equal(L.rollStrayLootCount({ ...base, rate: 1, depthMultiplier: 2, shore: 3 }, () => 0.99), 12, 'clamped at 12');
  assert.equal(L.rollStrayLootCount({ ...base, rate: 1, depthMultiplier: 2, shore: 3, cove: true }, () => 0.99), 18, 'clamped at 18 in a cove');
  assert.equal(L.rollStrayLootCount({ ...base, shore: 0.125 }, () => 0.5), 0, '0.35 on the shore: a draw under 0.35 or none');
  assert.equal(L.rollStrayLootCount({ ...base, shore: 0.125 }, () => 0.3), 1);
});

test('DW-E5: PickSpawnAngle - the camera\'s flat heading within 110 degrees seven times in ten, any angle otherwise and with no heading (no bias draw spent); the player\'s forward when the camera has none (mutants: the arc, the chance, the fallback)', () => {
  const arc = f32(110 * Math.PI / 180);
  const fwd = [0, 0, 1];   // atan2(1, 0) = pi/2
  near(L.pickSpawnAngle(fwd, null, seq([f32(0.7), 1])), f32(Math.PI / 2 + arc), 1e-5, 'the bias draw at 0.7f keeps the arc (<=); Range at 1: its edge');
  near(L.pickSpawnAngle(fwd, null, seq([0.2, 0])), f32(Math.PI / 2 - arc), 1e-5);
  near(L.pickSpawnAngle(fwd, null, seq([0.71, 0.5])), f32(Math.PI), 1e-5, 'past 0.7: Range(0, 2 pi)');
  let draws = 0;
  near(L.pickSpawnAngle([0, 1, 0], null, () => { draws++; return 0.25; }), f32(Math.PI / 2), 1e-5, 'straight up: no flat heading, any angle');
  assert.equal(draws, 1, 'and the bias draw not spent');
  near(L.pickSpawnAngle([0, 0, 0], [1, 0, 0], seq([0.5, 0.5])), 0, 1e-6, 'no camera: the player\'s heading');
});

test('DW-E5: TryPickFogAheadPoint - within 45 degrees of the heading, the reveal distance + 2 and a random 25 m, never past the max; none with no heading or when the reveal reaches it (mutants: the spread, the 25, the +2, the gate)', () => {
  const p = L.tryPickFogAheadPoint([10, 5, 20], 130, [1, 0, 0], 70, seq([0.5, 0.5]));
  near(p[0], 10 + (72 + 12.5), 1e-4); near(p[2], 20, 1e-4); assert.equal(p[1], 5, 'the player\'s height');
  const edge = L.tryPickFogAheadPoint([0, 0, 0], 130, [1, 0, 0], 70, seq([1, 0]));
  near(Math.atan2(edge[2], edge[0]), f32(Math.PI / 4), 1e-5, 'Range(-pi/4, pi/4)');
  near(Math.hypot(edge[0], edge[2]), 72, 1e-4);
  const far = L.tryPickFogAheadPoint([0, 0, 0], 130, [1, 0, 0], 110, seq([0.5, 1]));
  near(Math.hypot(far[0], far[2]), 130, 1e-4, 'Min(.., 130)');
  assert.equal(L.tryPickFogAheadPoint([0, 0, 0], 130, [0, 1, 0], 70, () => 0.5), null, 'no flat heading');
  assert.equal(L.tryPickFogAheadPoint([0, 0, 0], 130, [1, 0, 0], 128, () => 0.5), null, 'reveal + 2 reaches the max');
  assert.ok(L.tryPickFogAheadPoint([0, 0, 0], 130, [1, 0, 0], 127.9, () => 0.5), 'just under it');
});

test('DW-E5: ResolveSeafloorAt - a column on a terrain, 2 m deep, its rendered floor 2 m under the sea: the floor + 0.08; IsDeepEnoughForWreck at half the Water Depth (mutants: the clearance, the lift, the half)', () => {
  const entry = {};
  const col = (depth, oceanY, rendered) => ({ depth, oceanY, renderedSeafloorY: rendered, entry });
  assert.deepEqual(L.resolveSeafloorAt(col(30, 34, 4)), { y: 4 + f32(0.08), entry });
  assert.equal(L.resolveSeafloorAt(col(1.99, 34, 4)), null, 'shallower than 2 m');
  assert.ok(L.resolveSeafloorAt(col(2, 34, 32)), '2 m exactly');
  assert.equal(L.resolveSeafloorAt(col(30, 34, 32.01)), null, 'the rendered floor within 2 m of the sea');
  assert.equal(L.resolveSeafloorAt({ ...col(30, 34, 4), entry: null }), null, 'no terrain');
  assert.equal(L.resolveSeafloorAt(null), null);
  assert.equal(L.isDeepEnoughForWreck({ depth: 125 }, 250), true);
  assert.equal(L.isDeepEnoughForWreck({ depth: 124.9 }, 250), false);
  assert.equal(L.isDeepEnoughForWreck(null, 250), false);
});

test('DW-E5: a wreck\'s spots - its piles uniform over 11 m, 3 m apart, 8 tries; its rubble over 22 m; a pile\'s rubble 1.5 to 5 m off at its height; the counts, a cove\'s bigger (mutants: the radii, the spacing, the counts)', () => {
  near(L.pickClusterLootSpot([0, 0, 0], [], seq([1, 0]))[0], 11, 1e-5, 'Sqrt(1) x 11 at angle 0');
  near(L.pickClusterLootSpot([0, 0, 0], [], seq([0.25, 0]))[0], 5.5, 1e-5, 'Sqrt(0.25) x 11');
  assert.equal(L.pickClusterLootSpot([0, 0, 0], [[11, 0, 0]], seq([1, 0])), null, 'every try on a taken spot');
  assert.ok(L.isFarEnoughFromClusterLoot([3, 0, 0], [[0, 0, 0]]), '3 m exactly');
  assert.ok(!L.isFarEnoughFromClusterLoot([2.99, 0, 0], [[0, 0, 0]]));
  near(L.pickClusterDebrisPoint([5, 0, 5], seq([1, 0]))[0], 27, 1e-5);
  const d = L.pickLooseDebrisPoint([0, 7, 0], seq([0, 0]));
  near(d[0], 1.5, 1e-6); assert.equal(d[1], 7);
  near(L.pickLooseDebrisPoint([0, 7, 0], seq([1, 0]))[0], 5, 1e-6);
  assert.deepEqual([L.clusterDebrisCount(false), L.clusterDebrisCount(true)], [24, 48]);
  assert.deepEqual([L.rollClusterTreasureCount(false, () => 0), L.rollClusterTreasureCount(false, () => 0.999), L.rollClusterTreasureCount(true, () => 0), L.rollClusterTreasureCount(true, () => 0.999)], [3, 5, 6, 10]);
  assert.deepEqual([L.rollClusterItemCount(false, () => 0), L.rollClusterItemCount(false, () => 0.999), L.rollClusterItemCount(true, () => 0), L.rollClusterItemCount(true, () => 0.999)], [2, 4, 4, 8]);
  assert.equal(L.rollLooseDebrisCount(false, seq([0.749, 0.999])), 2);
  assert.equal(L.rollLooseDebrisCount(false, seq([0.75, 0])), 0, 'three times in four');
  assert.equal(L.rollLooseDebrisCount(true, seq([0.94, 0])), 1, 'a cove: 0.95');
});

test('DW-E5: a pile\'s picture one of the 25; a rubble flat any of 17, a pile\'s never twice until all are used; FillRandomItem\'s seven bands (mutants: the bands, the except)', () => {
  assert.equal(L.pickTreasurePileRecord(() => 0), 0);
  assert.equal(L.pickTreasurePileRecord(() => 0.999), 40);
  const used = new Set([L.RUBBLE_RECORDS[0]]);
  assert.equal(L.pickRubbleRecordExcept(used, seq([0, 0.06])), L.RUBBLE_RECORDS[1], 'the first draw taken, the second kept');
  const all = new Set(L.RUBBLE_RECORDS);
  assert.equal(L.pickRubbleRecordExcept(all, () => 0), L.RUBBLE_RECORDS[0], 'all used: any');
  const kinds = [0, 0.2499, 0.25, 0.4499, 0.45, 0.5999, 0.6, 0.7499, 0.75, 0.8499, 0.85, 0.9499, 0.95, 0.999].map((v) => L.pickRandomItemKind(f32(v)));   // Random.value is a float
  assert.deepEqual(kinds, ['religious', 'religious', 'potion', 'potion', 'jewellery', 'jewellery', 'gem', 'gem', 'clothing', 'clothing', 'weapon', 'weapon', 'armor', 'armor']);
  assert.equal(L.pickRandomItemKind(f32(0.45) - 1e-9), 'potion', 'the float band edge');
});

test('DW-E5: PruneLiveClusters forgets a wreck past 140 m (flat); the rubble anchor is its placements\' centroid (mutants: the distance, the mean)', () => {
  const c = [[0, 0, 0], [140, 50, 0], [141, 0, 0], [0, 0, -99.5 * 2]];
  L.pruneLiveClusters(c, [0, 1000, 0]);
  assert.deepEqual(c, [[0, 0, 0], [140, 50, 0]]);
  assert.deepEqual(L.centroidLocal([{ local: [0, 0, 0] }, { local: [2, 4, 6] }]), [1, 2, 3]);
  assert.deepEqual(L.centroidLocal([]), [0, 0, 0]);
});

test('DW-E5: ItemBuilder\'s group draws - CreateRandomReligiousItem, CreateRandomGem, CreateRandomJewellery - one export each, uniform over the group; GenerateRandomLoot\'s RL row and CreateRegularMagicItem call them, and no inline copy is left (mutants: the group, the export\'s callers)', () => {
  assert.deepEqual(createRandomReligiousItem(() => 0), { group: 'ReligiousItems', templateIndex: ITEM_GROUPS.ReligiousItems[0] });
  assert.deepEqual(createRandomGem(() => 0.999), { group: 'Gems', templateIndex: ITEM_GROUPS.Gems.at(-1) });
  assert.deepEqual(createRandomJewellery(() => 0.5), { group: 'Jewellery', templateIndex: ITEM_GROUPS.Jewellery[Math.floor(0.5 * ITEM_GROUPS.Jewellery.length)] });
  assert.deepEqual(createRandomOfGroup('Gems', () => 0), { group: 'Gems', templateIndex: ITEM_GROUPS.Gems[0] });
  // the RL row of matrix K (100): its first religious item is the draw's
  const items = generateRandomLoot(LOOT_MATRICES.K, { level: 1, gender: 'male' }, () => 0);
  assert.ok(items.some((it) => it.group === 'ReligiousItems' && it.templateIndex === ITEM_GROUPS.ReligiousItems[0]));
  const src = rd('src/systems/loot.js');
  assert.doesNotMatch(src, /group: '(ReligiousItems|Gems|Jewellery)', templateIndex: pick\(/, 'no inline copy of the three draws');
  assert.match(src, /halving\(matrix\.RL, \(\) => createRandomReligiousItem\(rolls\)\);/);
  assert.match(src, /else if \(groupId === 10\) base = createRandomReligiousItem\(rolls\);\n\s+else if \(groupId === 14\) base = createRandomGem\(rolls\);\n\s+else base = createRandomJewellery\(rolls\);/);
  assert.match(rd('src/systems/rriKits.js'), /const randomOf = \(group, rolls\) => mint\(createRandomOfGroup\(group, rolls\)\);/);
});

test('DW-E5: droppedLoot - a container drawn by another pass has no batch of its own and is every other thing a pile is; removePile frees it; an emptied one is deactivated and leaves the other pass\'s list (mutants: drawn, remove, the list)', async () => {
  const made = [];
  const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 64, getFrameCount: () => 1 };
  const pool = createDroppedLoot({ renderer: { createBillboardBatch: () => { const b = {}; made.push(b); return b; }, destroyBillboardBatch: () => {} }, getTexture: async () => stubTex, uploadRecordFrame: () => {} });
  const a = pool.seedPile([{ group: 'Gems', templateIndex: 0 }], [1, 2, 3], { archive: 216, record: 5 }, null, '1,1', { unsaved: true, drawn: false, owner: 'deepWaters' });
  const b = pool.seedPile([{ group: 'Gems', templateIndex: 0 }], [4, 5, 6], { archive: 216, record: 6 }, null, '1,1', { unsaved: true });
  assert.equal(a.drawn, false); assert.equal(a.owner, 'deepWaters'); assert.equal(b.drawn, true);
  assert.deepEqual(pool.undrawnPiles(), [a], 'the other pass draws it');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(made.length, 1, 'only the drawn pile mounts a batch of its own');
  assert.equal(a.batch, null);
  assert.equal(pool.lootTargets().length, 2, 'both on the ray');
  assert.equal(pool.snapshotWorld((p) => ({ x: p[0], z: p[2] })).length, 0, 'never saved (LoadID never restored)');
  a.items.length = 0; pool.releaseEmptied();
  assert.equal(a.inactive, true, 'RemoveLootContainer: deactivated');
  assert.deepEqual(pool.undrawnPiles(), [], 'and not drawn');
  pool.removePile(a);
  assert.equal(a.dead, true); assert.ok(!pool._piles.includes(a), 'Object.Destroy');
  pool.removePile(a);   // twice is nothing
  assert.equal(pool._piles.length, 1);
});

// ── the spawner, through fakes ───────────────────────────────────
/** A seeded LCG - UnityEngine.Random's stand-in for the spawner's many draws (a constant roll would spin
 *  PickRubbleRecordExcept's do-while for ever, in the mod as here); `lead` answers the first draws first. */
function lcg(seed = 7, lead = []) {
  let s = seed >>> 0, i = 0;
  return () => (i < lead.length ? lead[i++] : ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296));
}
/** A sea everywhere 60 m deep over a floor at -26; the view absent (everything out of it). */
function fixture(over = {}) {
  const entry = { px: 1, py: 1 };
  const log = [];
  const containers = [];
  const rubble = [];
  const cfg = { rate: f32(0.7), maxLive: 192, clusterRate: f32(0.1), maxClusters: 12, cove: false, waterDepth: 250, ...over.settings };
  const deps = {
    settings: () => cfg,
    canRunHeavy: () => true,
    exteriorWaterContext: () => over.context?.() ?? true,
    playerPosition: () => over.pos?.() ?? [0, 0, 0],
    column: (x, z) => (over.column ? over.column(x, z) : { depth: 60, oceanY: 34, renderedSeafloorY: -26, entry }),
    hasNearbyColumn: (...a) => { log.push(['gate', ...a]); return over.gate ?? true; },
    inOrAboveDeepWater: (d) => { log.push(['deep', d]); return over.deep ?? true; },
    view: () => null,
    playerForward: () => [0, 0, 1],
    vision: () => 95,
    pixelOrigin: () => [0, 0, 0],
    spawnContainer: (o) => {
      const c = { ...o, items: [], gone: false, destroyed: () => c.gone, position: () => o.pos, destroy: () => { c.gone = true; }, add: (it) => c.items.push(it) };
      containers.push(c);
      return c;
    },
    spawnRubble: (e, placements) => { const r = { e, placements: [...placements], gone: false }; rubble.push(r); return { count: placements.length, anchor: { destroyed: () => r.gone, position: () => [0, 0, 0], destroy: () => { r.gone = true; } } }; },
    spawnGuards: (c) => { log.push(['guards', c]); return 1; },
    makeItem: (kind) => ({ kind }),
    roll: over.roll ?? lcg(),
  };
  return { loot: createUnderwaterLoot(deps), log, containers, rubble, cfg, entry };
}

test('DW-E5: the pulse\'s gate - no rate, no context, no heavy work: nothing asked; HasNearbyWaterColumn(42, 72, 12 ways, 8 m) asked every two seconds and its answer kept between (mutants: the gate\'s numbers, its cache)', () => {
  const fx = fixture({ gate: false });
  fx.loot.pump({ time: 0 });
  assert.deepEqual(fx.log.filter((l) => l[0] === 'gate'), [['gate', 0, 0, 42, 72, 12, 8]]);
  fx.loot.pump({ time: 1.9 });
  assert.equal(fx.log.filter((l) => l[0] === 'gate').length, 1, 'cached for two seconds');
  fx.loot.pump({ time: 2 });
  assert.equal(fx.log.filter((l) => l[0] === 'gate').length, 2, 'asked again at two');
  assert.equal(fx.containers.length, 0, 'no water near: no pulse');
  const off = fixture({ settings: { rate: 0, clusterRate: 0 } });
  off.loot.pump({ time: 0 });
  assert.equal(off.log.length, 0, 'no rate: not even the gate');
});

test('DW-E5: the pulse - the first frame at once, then every 90 m of travel (flat), and 8 s after a pulse that stood something, 3 s after one that stood nothing; at the cap no pulse and no clock (mutants: the distance, the clocks, the cap)', () => {
  let pos = [0, 0, 0];
  // a stray pile every pulse: RollCount(2 x 0.7 x 2 x 1.24) is at least three
  const fx = fixture({ pos: () => pos });
  fx.loot.pump({ time: 0 });
  const first = fx.containers.length;
  assert.ok(first >= 3, `the first frame: a pulse at once (${first})`);
  pos = [89.9, 0, 0]; fx.loot.pump({ time: 100 });
  assert.equal(fx.containers.length, first, 'under 90 m: no pulse');
  pos = [90.1, 50, 0]; fx.loot.pump({ time: 100 });
  assert.ok(fx.containers.length > first, '90 m on (flat): a pulse');
  const second = fx.containers.length;
  pos = [181, 0, 0]; fx.loot.pump({ time: 107.9 });
  assert.equal(fx.containers.length, second, 'within 8 s of a pulse that stood piles: the anchor moves, no pulse');
  pos = [272, 0, 0]; fx.loot.pump({ time: 108 });
  assert.ok(fx.containers.length > second, 'at 8 s: the pulse');
  // a pulse that stands nothing waits 3 s
  const dry = fixture({ pos: () => pos, column: () => null });
  pos = [0, 0, 0]; dry.loot.pump({ time: 0 });
  pos = [100, 0, 0]; dry.loot.pump({ time: 2.9 });
  pos = [200, 0, 0]; dry.loot.pump({ time: 3 });
  assert.equal(dry.loot.debug.nextPulse, 6, 'nothing stood at 0 and 3: the next at 6');
  // off the deep water (IsPlayerInOrAboveDeepWater(8) false) the stray count is a shore's eighth: RollCount(0.43), one at most
  const shore = fixture({ pos: () => [0, 0, 0], deep: false, roll: lcg(5, [0.9, 0.01]) });
  shore.loot.pump({ time: 0 });
  assert.deepEqual(shore.log.filter((l) => l[0] === 'deep'), [['deep', 8]], 'asked at 8 m');
  assert.equal(shore.containers.length, 1, 'the eighth: a draw under 0.43 gives one, and one only');
  // the cap: nothing, and no clock
  const full = fixture({ pos: () => pos, settings: { maxLive: 0 } });
  pos = [0, 0, 0]; full.loot.pump({ time: 0 });
  assert.equal(full.containers.length, 0);
  assert.equal(full.loot.debug.nextPulse, 0, 'the clock not set at the cap');
});

test('DW-E5: a stray pile - a TEXTURE.216 record, its base on the floor + 0.08, 42 m out or more, one item, its 48 m cell remembered and never used again, one or two flats of rubble 1.5 to 5 m round it (mutants: the fill, the cell, the rubble)', () => {
  const fx = fixture({ roll: lcg(11, [0.9]) });   // the first draw: no wreck (0.9 over 0.1 x 2 x 1.24)
  fx.loot.pump({ time: 0 });
  assert.ok(fx.containers.length >= 3);
  const cells = new Set();
  for (const c of fx.containers) {
    assert.ok(L.TREASURE_PILE_RECORDS.includes(c.record));
    near(c.pos[1], -26 + f32(0.08), 1e-6, 'the floor + 0.08');
    const r = Math.hypot(c.pos[0], c.pos[2]);
    assert.ok(r >= 42 - 1e-6 && r <= 72 + 1e-6, `on the ring (no camera, no fog-ahead point): ${r}`);
    assert.equal(c.items.length, 1, 'FillRandomItem: one');
    const cell = L.worldCellKey(c.pos[0], c.pos[2], 48);
    assert.ok(!cells.has(cell), 'a remembered cell is never used again');
    cells.add(cell);
  }
  assert.equal(fx.loot.debug.cells, cells.size);
  for (const r of fx.rubble) {
    assert.ok(r.placements.length >= 1 && r.placements.length <= 2, 'Range(1, 3)');
    const owner = fx.containers.find((c) => r.placements.every((p) => Math.hypot(p.local[0] - c.pos[0], p.local[2] - c.pos[2]) <= 5 + 1e-6));
    assert.ok(owner, 'round its pile, 5 m at most');
    for (const p of r.placements) assert.ok(Math.hypot(p.local[0] - owner.pos[0], p.local[2] - owner.pos[2]) >= 1.5 - 1e-6, '1.5 m at least');
    if (r.placements.length === 2) assert.notEqual(`${r.placements[0].archive}.${r.placements[0].record}`, `${r.placements[1].archive}.${r.placements[1].record}`, 'never the same flat twice');
  }
  assert.equal(fx.loot.tracked.count, fx.containers.length + fx.rubble.length, 'every pile and every batch\'s anchor tracked');
});

test('DW-E5: a wreck - on a spot half the Water Depth deep: 24 flats of rubble over 22 m, three to five piles 3 m apart within 11 m, two to four items each, the guards at its centre, no stray piles after it; none on a spot too shallow (mutants: the depth test, the counts, the guards)', () => {
  const fx = fixture({ roll: lcg(3, [0.01]), settings: { waterDepth: 100 } });   // 0.01: the wreck; 60 m of a 100 m sea is past half
  fx.loot.pump({ time: 0 });
  assert.equal(fx.loot.clusterCount, 1, 'a wreck');
  const guards = fx.log.filter((l) => l[0] === 'guards');
  assert.equal(guards.length, 1, 'TrySpawnRareEnemiesNearTreasureCluster');
  const centre = guards[0][1];
  assert.equal(fx.rubble.length, 1, 'the wreck\'s rubble, one batch on its one terrain');
  assert.equal(fx.rubble[0].placements.length, 24);
  for (const p of fx.rubble[0].placements) assert.ok(Math.hypot(p.local[0] - centre[0], p.local[2] - centre[2]) <= 22 + 1e-6);
  assert.ok(fx.containers.length >= 3 && fx.containers.length <= 5, `Range(3, 6) piles: ${fx.containers.length}`);
  for (const c of fx.containers) {
    assert.ok(Math.hypot(c.pos[0] - centre[0], c.pos[2] - centre[2]) <= 11 + 1e-6, 'within 11 m');
    assert.ok(c.items.length >= 2 && c.items.length <= 4, `Range(2, 5) items: ${c.items.length}`);
    for (const o of fx.containers) if (o !== c) assert.ok(Math.hypot(c.pos[0] - o.pos[0], c.pos[2] - o.pos[2]) >= 3 - 1e-6, '3 m apart');
  }
  const shallow = fixture({ roll: lcg(3, [0.01]) });   // 60 m of a 250 m sea: under half
  shallow.loot.pump({ time: 0 });
  assert.equal(shallow.loot.clusterCount, 0);
  assert.equal(shallow.log.filter((l) => l[0] === 'guards').length, 0);
  const cove = fixture({ roll: lcg(3, [0.01]), settings: { waterDepth: 100, cove: true } });
  cove.loot.pump({ time: 0 });
  assert.equal(cove.rubble[0].placements.length, 48, 'a cove: 48 flats');
  assert.ok(cove.containers.length > 5, 'and its stray piles after the wreck');
});

test('DW-E5: a remembered cell is skipped - every try that lands in one is spent, so a pulse whose ring offers one cell stands one pile (mutants: the skip)', () => {
  // every draw 0.5: no wreck; three strays (RollCount(3.47) at 0.5); each try on the angle path (fog 0.5 is not under 0.5),
  // the heading (bias 0.5, Range at 0.5: straight ahead), the ring's middle - the one spot (0, 58.9); the sea only at
  // x = 0, so no rubble stands round it and no second draw is ever asked of PickRubbleRecordExcept
  const fx = fixture({ roll: () => 0.5, column: (x) => (Math.abs(x) < 0.01 ? { depth: 60, oceanY: 34, renderedSeafloorY: -26, entry: {} } : null) });
  fx.loot.pump({ time: 0 });
  assert.equal(fx.containers.length, 1, 'the second and third find only the remembered cell');
  near(fx.containers[0].pos[2], Math.sqrt((42 * 42 + 72 * 72) / 2), 1e-3);
});

test('DW-E5: leaving the water context lets the anchor go, and coming back pulses at once - the 8 s wait skipped (the first frame\'s force) (mutants: the force)', () => {
  let inside = true;
  const fx = fixture({ context: () => inside });
  fx.loot.pump({ time: 0 });
  const first = fx.containers.length;
  assert.equal(fx.loot.debug.nextPulse, 8);
  inside = false; fx.loot.pump({ time: 1 });
  inside = true; fx.loot.pump({ time: 2 });
  assert.ok(fx.containers.length > first, 'forced: the pulse at 2, inside the wait');
});

test('DW-E5: RememberSpawnCell keeps the last 128 cells - the oldest forgotten first, a cell that stands already not counted twice (mutants: the 128, the order)', () => {
  let pos = [0, 0, 0];
  const fx = fixture({ pos: () => pos, roll: lcg(9, [0.9]) });
  let t = 0;
  for (let i = 0; i < 80 && fx.loot.debug.cells < 128; i++) { pos = [i * 200, 0, 0]; t += 8; fx.loot.pump({ time: t }); }
  assert.equal(fx.loot.debug.cells, 128, 'held at 128');
  for (let i = 80; i < 90; i++) { pos = [i * 200, 0, 0]; t += 8; fx.loot.pump({ time: t }); }
  assert.equal(fx.loot.debug.cells, 128, 'and still: the oldest go as new ones come');
});

test('DW-E5: the reset (OnTransientReset) destroys every tracked pile and batch, forgets the cells, the wrecks, the anchor and the clocks (mutants: any of them)', () => {
  const fx = fixture();
  fx.loot.pump({ time: 0 });
  assert.ok(fx.loot.tracked.count > 0);
  fx.loot.reset();
  assert.equal(fx.loot.tracked.count, 0);
  assert.ok(fx.containers.every((c) => c.gone), 'Clear: destroyed');
  assert.deepEqual(fx.loot.debug, { tracked: 0, wrecks: 0, cells: 0, nextPulse: 0 });
  const before = fx.containers.length;
  fx.loot.pump({ time: 0.5 });
  assert.ok(fx.containers.length > before, 'the anchor forgotten: the next frame pulses at once');
});

test('DW-E5: the world host - the loot lane pumped after the fish, indoors too; the reset on every transient reset; a pile is droppedLoot\'s own container, never saved, drawn by the loot pass; the rubble through the decorations\' factory, freed with its terrain; the guards; the settings (pins)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /dwFish\.pump\(f\);   \/\/ DW-E3: UnderwaterEncounterPulse\.Pump, then PassiveFishBehaviour\.PumpAll\n\s+if \(dwLoot\) pumpDeepWatersLoot\(f, dt\);/);
  assert.match(w, /dwFish\.pulse\.pump\(f\);[^\n]*\n\s+dwLoot\?\.pump\(f\);/);
  assert.match(w, /onTransientReset\(\(\) => \{ dwLoot\.reset\(\); dwLootLetGoVelocity\(\); \}\);/);
  assert.match(w, /droppedLoot\.seedPile\(\[\], pos, \{ archive: TREASURE_PILE_ARCHIVE, record \}, null, `\$\{entry\.px\},\$\{entry\.py\}`, \{ unsaved: true, drawn: false, owner: DW_LOOT_OWNER \}\);/);
  assert.match(w, /if \(dwLoot\) drawDeepWatersLoot\(\);/);
  assert.match(w, /for \(const r of \[\.\.\.\(_dwRubble\.get\(p\) \?\? \[\]\)\]\) dwFreeRubble\(r\);/);
  assert.match(w, /const kept = dwDecor\.filter\(entry, placements\);/);
  assert.match(w, /spawnGuards: \(centre\) => trySpawnTreasureGuards\(\{/);
  assert.match(w, /droppedLoot\.takePixel\(key, \(pile\) => pile\.unsaved && !pile\.owner\)/, 'a WoD site carries its own piles alone');
  assert.match(w, /g = \{ texture: tex, fps: 0, born: 0, facing: 1, cutoff: DECORATION_CUTOFF, billboards: \[\] \}/, 'a DaggerfallBillboard\'s facing, the billboard\'s cut-out');
  const h = rd('src/scenes/deepWatersHost.js');
  assert.match(h, /rate: scaledSliderValue\(get\('General\.SeafloorLootRate'\), Math\.fround\(0\.7\)\),/);
  assert.match(h, /clusterRate: scaledSliderValue\(get\('General\.TreasureClusterRate'\), Math\.fround\(0\.1\)\),/);
  assert.match(h, /maxLive: Math\.max\(0, Math\.trunc\(Number\(get\('General\.MaxLiveLootObjects'\)\)\)\),/);
  assert.match(h, /maxClusters: Math\.max\(0, Math\.trunc\(Number\(get\('General\.MaxLiveTreasureClusters'\)\)\)\),/);
  assert.match(h, /cove: get\('General\.TreasureCove'\) === true,/);
  const d = rd('src/scenes/deepWatersDecor.js');
  assert.match(d, /function spawn\(entry, positions\) \{\n\s+return standPlacements\(entry, filterPlacements\(entry, positions\)\);/, 'Spawn is FilterPlacements then the stand, as the factory is');
});
