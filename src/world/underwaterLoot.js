// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DW-E5 (2026-09-26): ILIAC PUDDLE NO MORE'S SUNKEN LOOT - the laws
// UnderwaterLootSpawner.cs places it by, as pure functions (jet082,
// 1.2.2): the pulse's two rolls (a treasure cluster, the stray piles),
// the spot a pile may lie on (DeepWaterWorld.TryPickFogAheadPoint, the
// forward-biased angle, the ring, the 48 m cells), the seafloor under it,
// the wreck's depth, the cluster's own spots, the debris round a pile and
// a wreck, and FillRandomItem's seven kinds. The host half - the pulse,
// the tracker, the pile stood, its batches of rubble, the guards - is
// scenes/deepWatersLoot.js.
//
// THE DRAWS are the unseeded UnityEngine.Random and ride the host's
// injectable roll (Port-Ledger A, the engine-PRNG rule), in the order the
// C# makes them.
// ═══════════════════════════════════════════════════════════════════

import { rangeInt, rangeFloat } from '../systems/unleveledLoot.js';   // Random.Range(int, int) and (float, float)
import { rollCount, pickRingDistance } from './underwaterEnemies.js';   // DeepWaterWorld.RollCount and PickRingDistance, one home

const f32 = Math.fround;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** 2π as the C# writes it (6.2831854820251465f). */
const TWO_PI = f32(Math.PI * 2);

// ── UnderwaterLootSpawner's constants, as the assembly declares them ──
export const LOOT_PULSE_DISTANCE = 90;
export const MIN_PULSE_INTERVAL_SECONDS = 8;
export const FAILED_PULSE_RETRY_SECONDS = 3;
export const DESPAWN_DISTANCE = 140;
export const FULL_STRAY_LOOT_PER_PULSE = 2;
export const NORMAL_LOOT_MULTIPLIER = 2;
export const TREASURE_COVE_STRAY_MULTIPLIER = 3;
export const TREASURE_COVE_CLUSTER_CHANCE_MULTIPLIER = 3;
export const MAX_CLUSTER_CHANCE = f32(0.85);
export const CLUSTER_DEBRIS_RADIUS = 22;
export const CLUSTER_DEBRIS_COUNT = 24;
export const SHORE_LOOT_PULSE_MULTIPLIER = 0.125;
export const LOOSE_LOOT_DEBRIS_CHANCE = 0.75;
export const TREASURE_COVE_LOOSE_LOOT_DEBRIS_CHANCE = f32(0.95);
export const LOOSE_LOOT_DEBRIS_MIN_RADIUS = 1.5;
export const LOOSE_LOOT_DEBRIS_MAX_RADIUS = 5;
export const LOOSE_LOOT_DEBRIS_SPOT_ATTEMPTS = 4;
export const NEARBY_WATER_PROBE_DIRECTIONS = 12;
export const NEARBY_WATER_GATE_CHECK_INTERVAL = 2;
export const DEFAULT_LOOT_MIN_SPAWN_DISTANCE = 42;
export const DEFAULT_LOOT_MAX_SPAWN_DISTANCE = 72;
export const MAX_STRAY_LOOT_PER_PULSE = 12;
export const TREASURE_COVE_MAX_STRAY_LOOT_PER_PULSE = 18;
export const FORWARD_SPAWN_ARC_DEGREES = 110;
export const FORWARD_BIAS_CHANCE = f32(0.7);
export const FOG_AHEAD_MAX_DISTANCE = 130;
export const SEAFLOOR_Y_CLEARANCE = 2;
export const LOOT_FLOOR_LIFT = f32(0.08);
export const SPAWN_SPOT_ATTEMPTS = 18;
export const SPAWN_CELL_SIZE = 48;
export const MAX_REMEMBERED_SPAWN_CELLS = 128;
export const CLUSTER_LOOT_RADIUS = 11;
export const CLUSTER_LOOT_MIN_SPACING = 3;
export const CLUSTER_LOOT_SPOT_ATTEMPTS = 8;
export const WRECK_MINIMUM_DEPTH_FRACTION = 0.5;
/** IsOutsideImmediateView's margin in PickSpawnSpot (a literal there, not a field). */
export const LOOT_VIEWPORT_MARGIN = f32(0.12);
/** HasNearbyWaterColumn's minimum depth in CanRunLootPulse (a literal there). */
export const NEARBY_WATER_MINIMUM_DEPTH = 8;
/** IsPlayerInOrAboveDeepWater's minimum depth in TryRunLootPulse (a literal there). */
export const DEEP_WATER_PULSE_DEPTH = 8;
/** EffectiveLootCap and the live cluster cap with no mod instance. */
export const DEFAULT_MAX_LIVE_LOOT_OBJECTS = 32;
export const DEFAULT_MAX_LIVE_TREASURE_CLUSTERS = 3;
/** DeepWaterWorld's WaterDepth with no mod instance. */
export const DEFAULT_WATER_DEPTH = 200;

/** CreateLootContainer's picture: DaggerfallLootDataTables.randomTreasureArchive (TEXTURE.216). */
export const TREASURE_PILE_ARCHIVE = 216;
/** TreasurePileRecords: the 25 records of TEXTURE.216 a pile is drawn with (the assembly's static array). */
export const TREASURE_PILE_RECORDS = Object.freeze([0, 1, 3, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 36, 37, 38, 39, 40]);
/** RubbleRecords: the 17 flats the debris round a pile and a wreck is made of - UnderwaterDecorationRecord(archive, record). */
export const RUBBLE_RECORDS = Object.freeze([
  [105, 0], [105, 5], [105, 6], [105, 7], [105, 8], [105, 9], [105, 10],
  [400, 0], [400, 1], [400, 4], [400, 6], [380, 1], [96, 0], [96, 2], [96, 3], [96, 4], [96, 5],
].map(([archive, record]) => Object.freeze({ archive, record })));
/** The TEXTURE files the rubble reads. */
export const RUBBLE_ARCHIVES = Object.freeze([...new Set(RUBBLE_RECORDS.map((r) => r.archive))]);

/** DeepWaterWorld.WorldCellKey: the cell's two FloorToInt coordinates, one key (a long in the C#, a string here). */
export const worldCellKey = (x, z, cellSize) => `${Math.floor(f32(f32(x) / cellSize))},${Math.floor(f32(f32(z) / cellSize))}`;

/**
 * DeepWaterWorld.DepthSpawnMultiplier: 1 with no column under the player,
 * else Lerp(1, 2, the column's depth over the sea's Water Depth).
 * @param {?{depth: number}} column - TryGetWaterColumn at the player
 */
export function depthSpawnMultiplier(column, waterDepth) {
  if (!column) return 1;
  return f32(1 + f32(clamp01(f32(column.depth / Math.max(1, waterDepth)))));
}

/**
 * ShouldSpawnTreasureCluster: a rate above nothing, fewer live clusters than
 * the cap, and Random.value under the rate x 2 (3 in a Treasure Cove) x the
 * shore's share x the depth's, capped at 0.85.
 * @param {{rate: number, liveClusters: number, maxLiveClusters: number, cove: boolean, shore: number, depthMultiplier: number}} s
 */
export function shouldSpawnTreasureCluster(s, roll) {
  const rate = Math.max(0, f32(s.rate));
  if (rate <= 0) return false;   // bgt.un (IL_19efb): the C#'s own form - a NaN rate goes on
  if (s.liveClusters >= s.maxLiveClusters) return false;
  const mult = s.cove ? TREASURE_COVE_CLUSTER_CHANCE_MULTIPLIER : NORMAL_LOOT_MULTIPLIER;
  const chance = Math.min(f32(f32(f32(rate * mult) * f32(s.shore)) * f32(s.depthMultiplier)), MAX_CLUSTER_CHANCE);
  return roll() < chance;
}

/**
 * RollStrayLootCount: none after a cluster (but in a Treasure Cove); else
 * RollCount(2 x the rate x 2 (3 in a cove) x the shore's share x the
 * depth's), clamped to 12 (18 in a cove).
 * @param {{clusterSpawned: boolean, cove: boolean, rate: number, shore: number, depthMultiplier: number}} s
 */
export function rollStrayLootCount(s, roll) {
  if (s.clusterSpawned && !s.cove) return 0;
  const rate = Math.max(0, f32(s.rate));
  if (rate <= 0) return 0;   // bgt.un (IL_19f98)
  const mult = s.cove ? TREASURE_COVE_STRAY_MULTIPLIER : NORMAL_LOOT_MULTIPLIER;
  const n = rollCount(f32(f32(f32(f32(FULL_STRAY_LOOT_PER_PULSE * rate) * mult) * f32(s.shore)) * f32(s.depthMultiplier)), roll);
  return Math.min(s.cove ? TREASURE_COVE_MAX_STRAY_LOOT_PER_PULSE : MAX_STRAY_LOOT_PER_PULSE, Math.max(0, n));
}

/**
 * PickSpawnAngle: the camera's flat heading (the player's when the camera
 * has none) within 110 degrees either side seven times in ten, else any
 * angle - and any angle with no heading at all (no draw spent on the bias).
 * @param {?number[]} camForward @param {?number[]} playerForward
 */
export function pickSpawnAngle(camForward, playerForward, roll) {
  let fx = camForward?.[0] ?? 0, fy = camForward?.[1] ?? 0, fz = camForward?.[2] ?? 0;
  if (fx * fx + fy * fy + fz * fz < 0.001 && playerForward) { fx = playerForward[0]; fy = playerForward[1]; fz = playerForward[2]; }
  if (fx * fx + fz * fz < 0.001 || roll() > FORWARD_BIAS_CHANCE) return rangeFloat(0, TWO_PI, roll);
  const arc = f32(FORWARD_SPAWN_ARC_DEGREES * Math.PI / 180);   // 1.919862151145935f
  return f32(Math.atan2(fz, fx) + rangeFloat(-arc, arc, roll));
}

/**
 * DeepWaterWorld.TryPickFogAheadPoint: a point ahead of the camera's flat
 * heading, within 45 degrees of it, just past the reveal distance (+2 and a
 * random 25 m) and no farther than `maxDistance` - null with no heading, or
 * when the reveal distance already reaches it.
 * @param {number[]} pos @param {?number[]} camForward @param {number} revealDistance - SpawnRevealDistance
 */
export function tryPickFogAheadPoint(pos, maxDistance, camForward, revealDistance, roll) {
  const fx = camForward?.[0] ?? 0, fz = camForward?.[2] ?? 0;
  if (fx * fx + fz * fz < 0.001) return null;
  const reveal = f32(revealDistance + 2);
  if (reveal >= maxDistance) return null;   // blt.un (IL_5795)
  const quarter = f32(Math.PI / 4);   // 0.7853981852531433f
  const angle = f32(Math.atan2(fz, fx) + rangeFloat(-quarter, quarter, roll));
  const d = Math.min(f32(reveal + f32(roll() * 25)), maxDistance);
  return [pos[0] + Math.cos(angle) * d, pos[1], pos[2] + Math.sin(angle) * d];
}

/**
 * ResolveSeafloorAt: the column's rendered seafloor, 0.08 over it, where
 * the column stands on a terrain, is at least 2 m deep and its rendered
 * floor at least 2 m under the sea - else null.
 * @param {?{depth: number, oceanY: number, renderedSeafloorY: number, entry: ?object}} column - TryGetWaterColumn
 * @returns {?{y: number, entry: object}}
 */
export function resolveSeafloorAt(column) {
  if (!column || !column.entry || column.depth < SEAFLOOR_Y_CLEARANCE) return null;   // bge.un (IL_1aa49)
  if (column.oceanY - column.renderedSeafloorY < SEAFLOOR_Y_CLEARANCE) return null;   // bge.un (IL_1aa68)
  return { y: column.renderedSeafloorY + LOOT_FLOOR_LIFT, entry: column.entry };
}

/**
 * IsDeepEnoughForWreck: a column there at least half the sea's Water Depth deep.
 * @param {?{depth: number}} column
 */
export const isDeepEnoughForWreck = (column, waterDepth) =>
  !!column && column.depth >= f32(Math.max(1, waterDepth) * WRECK_MINIMUM_DEPTH_FRACTION);   // clt.un; ceq (IL_1a980): a NaN depth is none

/** IsFarEnoughFromClusterLoot: no spot of the cluster's within 3 m (flat). @param {number[][]} spots */
export function isFarEnoughFromClusterLoot(p, spots) {
  const min = CLUSTER_LOOT_MIN_SPACING * CLUSTER_LOOT_MIN_SPACING;
  for (const s of spots) {
    const dx = p[0] - s[0], dz = p[2] - s[2];
    if (dx * dx + dz * dz < min) return false;
  }
  return true;
}

/** TryPickClusterLootSpot: 8 tries at a point uniform over the 11 m disc round the centre, 3 m from the cluster's others. */
export function pickClusterLootSpot(centre, spots, roll) {
  for (let i = 0; i < CLUSTER_LOOT_SPOT_ATTEMPTS; i++) {
    const r = f32(f32(Math.sqrt(roll())) * CLUSTER_LOOT_RADIUS);
    const a = rangeFloat(0, TWO_PI, roll);
    const p = [centre[0] + Math.cos(a) * r, 0, centre[2] + Math.sin(a) * r];
    if (isFarEnoughFromClusterLoot(p, spots)) return p;
  }
  return null;
}

/** SpawnClusterDebris' point: uniform over the 22 m disc round the wreck. */
export function pickClusterDebrisPoint(centre, roll) {
  const r = f32(f32(Math.sqrt(roll())) * CLUSTER_DEBRIS_RADIUS);
  const a = rangeFloat(0, TWO_PI, roll);
  return [centre[0] + Math.cos(a) * r, 0, centre[2] + Math.sin(a) * r];
}

/** QueueLooseLootDebris' point: 1.5 to 5 m off the pile, any way round. */
export function pickLooseDebrisPoint(pos, roll) {
  const r = rangeFloat(LOOSE_LOOT_DEBRIS_MIN_RADIUS, LOOSE_LOOT_DEBRIS_MAX_RADIUS, roll);
  const a = rangeFloat(0, TWO_PI, roll);
  return [pos[0] + Math.cos(a) * r, pos[1], pos[2] + Math.sin(a) * r];
}

/** SpawnClusterDebris' count: 24, 48 in a Treasure Cove. */
export const clusterDebrisCount = (cove) => (cove ? CLUSTER_DEBRIS_COUNT * 2 : CLUSTER_DEBRIS_COUNT);
/** SpawnClusterTreasure's count: Range(3, 6), Range(6, 11) in a Treasure Cove. */
export const rollClusterTreasureCount = (cove, roll) => rangeInt(cove ? 6 : 3, cove ? 11 : 6, roll);
/** FillClusterContainer's count: Range(2, 5), Range(4, 9) in a Treasure Cove. */
export const rollClusterItemCount = (cove, roll) => rangeInt(cove ? 4 : 2, cove ? 9 : 5, roll);
/** SpawnLooseLootDebris' roll: under 0.75 (0.95 in a Treasure Cove) the pile gets Range(1, 3) flats of rubble, else none. */
export function rollLooseDebrisCount(cove, roll) {
  const chance = cove ? TREASURE_COVE_LOOSE_LOOT_DEBRIS_CHANCE : LOOSE_LOOT_DEBRIS_CHANCE;
  if (!(roll() < chance)) return 0;
  return rangeInt(1, 3, roll);
}

/** SpawnLootContainer's picture: one of the 25 treasure piles. */
export const pickTreasurePileRecord = (roll) => TREASURE_PILE_RECORDS[rangeInt(0, TREASURE_PILE_RECORDS.length, roll)];
/** A rubble flat. */
export const pickRubbleRecord = (roll) => RUBBLE_RECORDS[rangeInt(0, RUBBLE_RECORDS.length, roll)];
/** PickRubbleRecordExcept: one the pile's debris has not used yet - any, once all 17 are. @param {Set<object>} used */
export function pickRubbleRecordExcept(used, roll) {
  if (!used || used.size >= RUBBLE_RECORDS.length) return pickRubbleRecord(roll);
  let r;
  do r = pickRubbleRecord(roll); while (used.has(r));
  return r;
}

/** FillRandomItem's seven kinds, by one Random.value: a religious item, a potion, jewellery, a gem, clothing, a weapon, armour. */
/** @type {ReadonlyArray<[number, string]>} */
const ITEM_KIND_BANDS = Object.freeze([[f32(0.25), 'religious'], [f32(0.45), 'potion'], [f32(0.6), 'jewellery'], [f32(0.75), 'gem'], [f32(0.85), 'clothing'], [f32(0.95), 'weapon']]);
/** @returns {string} */
export function pickRandomItemKind(v) {
  for (const [edge, kind] of ITEM_KIND_BANDS) if (v < edge) return kind;
  return 'armor';
}

/** PruneLiveClusters: a wreck's centre is forgotten past 140 m (flat) of the player, the last first. @param {number[][]} centres */
export function pruneLiveClusters(centres, playerPos) {
  const max = DESPAWN_DISTANCE * DESPAWN_DISTANCE;
  for (let i = centres.length - 1; i >= 0; i--) {
    const dx = centres[i][0] - playerPos[0], dz = centres[i][2] - playerPos[2];
    if (dx * dx + dz * dz > max) centres.splice(i, 1);
  }
}

/** ComputeCentroidLocal: the mean of the placements' local points (zero for none). @param {Array<{local: number[]}>} placements */
export function centroidLocal(placements) {
  if (!placements?.length) return [0, 0, 0];
  const c = [0, 0, 0];
  for (const p of placements) { c[0] += p.local[0]; c[1] += p.local[1]; c[2] += p.local[2]; }
  return [c[0] / placements.length, c[1] / placements.length, c[2] / placements.length];
}
