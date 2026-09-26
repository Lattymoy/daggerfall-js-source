// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DW-E5 (2026-09-26): ILIAC PUDDLE NO MORE'S SUNKEN LOOT IN THE STREAMED
// WORLD (jet082, 1.2.2) - UnderwaterLootSpawner.cs's pulse over the
// port's world. The laws are world/underwaterLoot.js; what a pile, a
// batch of rubble and a guard ARE in the world is the host's.
//
// THE PULSE, every frame (DeepWaters.Update, last): heavy work allowed, a
// loot rate or a wreck rate above nothing, the player playing in the
// outdoor water context, and water 8 m deep within 72 m of the player
// (HasNearbyWaterColumn, asked every two seconds). The first frame of that
// runs the pulse at once; after it, the player must have moved 90 m (flat)
// from where the last one was asked, and the pulse itself waits 8 s after
// one that stood something and 3 s after one that stood nothing.
//
// A PULSE: the tracked piles and batches past 140 m destroyed, and the
// farthest while more than Max Live Loot Objects remain; a wreck forgotten
// past 140 m. At the cap, nothing. Else a wreck, by its chance, and stray
// piles by their count - each over a shore's eighth when the player is not
// in or over water 8 m deep. A spot is 42-72 m out: half the tries a point
// ahead just past what the player can see, the rest on the ring (seven in
// ten within 110 degrees of the camera's heading); never a 48 m cell used
// in the last 128; the seafloor 2 m deep under it; out of the player's
// immediate view.
//
// A PILE is DFU's RandomTreasure DaggerfallLoot (TEXTURE.216, one of 25
// records, its base on the floor + 0.08, parented to the terrain the
// column stands on, no shadow, the decorations' underwater material), with
// one of FillRandomItem's seven kinds in it; a stray pile brings one or
// two flats of rubble round it three times in four. A WRECK - the spot at
// least half the Water Depth deep - is 24 flats of rubble over 22 m and
// three to five piles within 11 m of its centre, 3 m apart, two to four
// items each, and the treasure guards (UnderwaterEnemySpawner); a Treasure
// Cove doubles its rubble, raises its piles and their items and lets
// stray piles come with it. Every pile and every batch is tracked; a
// load or a teleport destroys them all (OnTransientReset).
// ═══════════════════════════════════════════════════════════════════

import { TransientObjectTracker } from '../world/deepWaterTransients.js';
import { isOutsideImmediateView } from '../world/underwaterEnemies.js';
import {
  LOOT_PULSE_DISTANCE, MIN_PULSE_INTERVAL_SECONDS, FAILED_PULSE_RETRY_SECONDS, DESPAWN_DISTANCE, SHORE_LOOT_PULSE_MULTIPLIER,
  NEARBY_WATER_PROBE_DIRECTIONS, NEARBY_WATER_GATE_CHECK_INTERVAL, NEARBY_WATER_MINIMUM_DEPTH, DEEP_WATER_PULSE_DEPTH,
  DEFAULT_LOOT_MIN_SPAWN_DISTANCE, DEFAULT_LOOT_MAX_SPAWN_DISTANCE, FOG_AHEAD_MAX_DISTANCE, SPAWN_SPOT_ATTEMPTS, SPAWN_CELL_SIZE,
  MAX_REMEMBERED_SPAWN_CELLS, LOOSE_LOOT_DEBRIS_SPOT_ATTEMPTS, LOOT_VIEWPORT_MARGIN,
  worldCellKey, depthSpawnMultiplier, shouldSpawnTreasureCluster, rollStrayLootCount, pickSpawnAngle, tryPickFogAheadPoint,
  resolveSeafloorAt, isDeepEnoughForWreck, pickClusterLootSpot, pickClusterDebrisPoint, pickLooseDebrisPoint, clusterDebrisCount,
  rollClusterTreasureCount, rollClusterItemCount, rollLooseDebrisCount, pickTreasurePileRecord, pickRubbleRecord,
  pickRubbleRecordExcept, pickRandomItemKind, pruneLiveClusters,
} from '../world/underwaterLoot.js';
import { pickRingDistance } from '../world/underwaterEnemies.js';

/**
 * @typedef {{destroyed(): boolean, position(): number[], destroy(): void}} Transient
 * @typedef {{archive: number, record: number, local: number[]}} RubblePlacement - UnderwaterDecorationPlacementInfo: the record, the point off its terrain's origin
 */

/**
 * UnderwaterLootSpawner, the host's half.
 * @param {object} deps
 * @param {() => {rate: number, maxLive: number, clusterRate: number, maxClusters: number, cove: boolean, waterDepth: number}} deps.settings - SeafloorLootRate and TreasureClusterRate (scaled), MaxLiveLootObjects, MaxLiveTreasureClusters, TreasureCove, WaterDepth
 * @param {() => boolean} deps.canRunHeavy - DeepWaterRuntime.CanRunHeavyRuntimeWork
 * @param {() => boolean} deps.exteriorWaterContext - DeepWaterWorld.IsPlayerInExteriorWaterContext
 * @param {() => ?number[]} deps.playerPosition - TryGetPlayerPosition (the capsule's centre)
 * @param {(x: number, z: number) => ?{depth: number, oceanY: number, renderedSeafloorY: number, entry: ?object}} deps.column - TryGetWaterColumn
 * @param {(x: number, z: number, near: number, far: number, directions: number, minimumDepth: number) => boolean} deps.hasNearbyColumn - HasNearbyWaterColumn
 * @param {(minimumDepth: number) => boolean} deps.inOrAboveDeepWater - IsPlayerInOrAboveDeepWater
 * @param {() => ?{forward: number[], viewport: (p: number[]) => number[], revealDistance: number}} deps.view - the camera: its forward, WorldToViewportPoint, SpawnRevealDistance
 * @param {() => ?number[]} deps.playerForward - PlayerObject.transform.forward (the heading's fallback)
 * @param {() => number} deps.vision - UnderwaterVisionDistance
 * @param {(entry: object) => number[]} deps.pixelOrigin - the terrain's world origin (its transform's position)
 * @param {(o: {pos: number[], record: number, entry: object}) => ?(Transient & {add: (item: object) => void})} deps.spawnContainer - SpawnLootContainer: the pile stood, its base at `pos`; `add` is its Items.AddItem(item, AddPosition.Back)
 * @param {(entry: object, placements: RubblePlacement[]) => ?{count: number, anchor: ?Transient}} deps.spawnRubble - UnderwaterDecorationBatchFactory.Spawn and the batch's anchor: the placements it kept, and the anchor to track
 * @param {(centre: number[]) => number} deps.spawnGuards - UnderwaterEnemySpawner.TrySpawnRareEnemiesNearTreasureCluster
 * @param {(kind: string) => ?object} deps.makeItem - FillRandomItem's ItemBuilder call for a kind (see pickRandomItemKind)
 * @param {() => number} [deps.roll] - the unseeded UnityEngine.Random (Port-Ledger A, the engine-PRNG rule)
 */
export function createUnderwaterLoot({ settings, canRunHeavy, exteriorWaterContext, playerPosition, column, hasNearbyColumn, inOrAboveDeepWater,
  view, playerForward, vision, pixelOrigin, spawnContainer, spawnRubble, spawnGuards, makeItem, roll = Math.random }) {
  const tracked = new TransientObjectTracker();
  /** recentSpawnCells and recentSpawnCellOrder */
  const recentCells = new Set();
  const recentOrder = [];
  /** liveClusterCentres */
  const clusters = [];
  let anchor = null;             // lastPulseAnchor (hasPulseAnchor: not null)
  let nextAllowedPulseTime = 0;
  let nextGateTime = 0;          // nextNearbyWaterGateCheckTime
  let gateCached = false;        // hasNearbyWaterGateCache
  let gateResult = false;        // lastNearbyWaterGateResult
  let time = 0;                  // the frame's Time.time

  /** CanRunLootPulse: the player's position, or null. */
  function canRunLootPulse() {
    if (!canRunHeavy()) return null;
    const s = settings();
    if (s.rate <= 0 && s.clusterRate <= 0) return null;   // bgt.un twice (IL_1a776, IL_1a787): the C#'s own form
    if (!exteriorWaterContext()) return null;
    const pos = playerPosition();
    if (!pos) return null;
    if (gateCached && time < nextGateTime) return gateResult ? pos : null;
    gateResult = hasNearbyColumn(pos[0], pos[2], DEFAULT_LOOT_MIN_SPAWN_DISTANCE, DEFAULT_LOOT_MAX_SPAWN_DISTANCE, NEARBY_WATER_PROBE_DIRECTIONS, NEARBY_WATER_MINIMUM_DEPTH);
    gateCached = true;
    nextGateTime = time + NEARBY_WATER_GATE_CHECK_INTERVAL;
    return gateResult ? pos : null;
  }

  /** RememberSpawnCell: the cell kept, the oldest forgotten past 128. */
  function rememberSpawnCell(key) {
    if (recentCells.has(key)) return;
    recentCells.add(key);
    recentOrder.push(key);
    while (recentOrder.length > MAX_REMEMBERED_SPAWN_CELLS) recentCells.delete(recentOrder.shift());
  }

  /** PickSpawnSpot: 18 tries at a spot on the seafloor 42-72 m out, in no remembered cell, out of the immediate view. */
  function pickSpawnSpot(pos, minDistance, maxDistance) {
    minDistance = Math.max(0, minDistance);
    maxDistance = Math.max(minDistance + 1, maxDistance);
    const v = view();
    for (let i = 0; i < SPAWN_SPOT_ATTEMPTS; i++) {
      let x, z;
      const ahead = roll() < 0.5 ? tryPickFogAheadPoint(pos, FOG_AHEAD_MAX_DISTANCE, v?.forward ?? null, v?.revealDistance ?? vision(), roll) : null;
      if (ahead) { x = ahead[0]; z = ahead[2]; } else {
        const angle = pickSpawnAngle(v?.forward ?? null, playerForward(), roll);
        const d = pickRingDistance(minDistance, maxDistance, roll);
        x = pos[0] + Math.cos(angle) * d;
        z = pos[2] + Math.sin(angle) * d;
      }
      const key = worldCellKey(x, z, SPAWN_CELL_SIZE);
      if (recentCells.has(key)) continue;
      const floor = resolveSeafloorAt(column(x, z));
      if (!floor) continue;
      const spot = [x, floor.y, z];
      if (!isOutsideImmediateView(spot, pos, vision(), LOOT_VIEWPORT_MARGIN, v)) continue;
      return { spot, entry: floor.entry, key };
    }
    return null;
  }

  /** QueueRubbleSprite: the placement, off its terrain's origin, in its terrain's list. @param {Map<object, Array<{archive: number, record: number, local: number[]}>>} lists */
  function queueRubble(p, entry, lists, rec) {
    let list = lists.get(entry);
    if (!list) { list = []; lists.set(entry, list); }
    const o = pixelOrigin(entry);
    list.push({ archive: rec.archive, record: rec.record, local: [p[0] - o[0], p[1] - o[1], p[2] - o[2]] });
  }

  /** SpawnRubbleBatches: a batch a terrain, its anchor tracked; the placements stood. */
  function spawnRubbleBatches(lists) {
    let total = 0;
    for (const [entry, list] of lists) {
      if (!entry || !list?.length) continue;
      const r = spawnRubble(entry, list);
      if (!r) continue;
      if (r.anchor) tracked.add(r.anchor);
      total += r.count;
    }
    return total;
  }

  /** FillRandomItem: one item of a kind drawn by Random.value, added at the back (stacking allowed). */
  function fillRandomItem(container) {
    if (!container) return;
    const item = makeItem(pickRandomItemKind(roll()));
    if (item) container.add(item);
  }

  /** SpawnLooseLootDebris: one or two flats of rubble round a stray pile, three times in four (none twice). */
  function spawnLooseLootDebris(pos) {
    const n = rollLooseDebrisCount(settings().cove, roll);
    if (n === 0) return 0;
    const lists = new Map();
    const used = new Set();   // usedRubbleRecordsScratch
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < LOOSE_LOOT_DEBRIS_SPOT_ATTEMPTS; k++) {   // QueueLooseLootDebris
        const p = pickLooseDebrisPoint(pos, roll);
        const floor = resolveSeafloorAt(column(p[0], p[2]));
        if (!floor) continue;
        p[1] = floor.y;
        const rec = pickRubbleRecordExcept(used, roll);
        used.add(rec);
        queueRubble(p, floor.entry, lists, rec);
        break;
      }
    }
    return spawnRubbleBatches(lists);
  }

  /** TrySpawnStrayLoot: a pile on a spot, its item, its rubble. */
  function trySpawnStrayLoot(pos, minDistance, maxDistance) {
    const s = pickSpawnSpot(pos, minDistance, maxDistance);
    if (!s) return false;
    const c = spawnContainer({ pos: s.spot, record: pickTreasurePileRecord(roll), entry: s.entry });
    if (!c) return false;
    tracked.add(c);
    rememberSpawnCell(s.key);
    fillRandomItem(c);
    spawnLooseLootDebris(s.spot);
    return true;
  }

  /** SpawnClusterDebris: the wreck's rubble over 22 m. */
  function spawnClusterDebris(centre) {
    const lists = new Map();
    const n = clusterDebrisCount(settings().cove);
    for (let i = 0; i < n; i++) {
      const p = pickClusterDebrisPoint(centre, roll);
      const floor = resolveSeafloorAt(column(p[0], p[2]));
      if (!floor) continue;
      p[1] = floor.y;
      queueRubble(p, floor.entry, lists, pickRubbleRecord(roll));
    }
    return spawnRubbleBatches(lists);
  }

  /** SpawnClusterTreasure: the wreck's piles, 3 m apart within 11 m, each two to four items. */
  function spawnClusterTreasure(centre) {
    const cove = settings().cove;
    const n = rollClusterTreasureCount(cove, roll);
    const spots = [];   // clusterLootSpotsScratch
    let placed = 0;
    for (let i = 0; i < n; i++) {
      const p = pickClusterLootSpot(centre, spots, roll);
      if (!p) continue;
      const floor = resolveSeafloorAt(column(p[0], p[2]));
      if (!floor) continue;
      p[1] = floor.y;
      const c = spawnContainer({ pos: p, record: pickTreasurePileRecord(roll), entry: floor.entry });
      if (!c) continue;
      tracked.add(c);
      const items = rollClusterItemCount(cove, roll);   // FillClusterContainer
      for (let k = 0; k < items; k++) fillRandomItem(c);
      spots.push(p);
      placed++;
    }
    return placed;
  }

  /** TrySpawnTreasureCluster: a wreck on a spot half the sea's depth deep - its rubble, its piles, its guards. */
  function trySpawnTreasureCluster(pos, minDistance, maxDistance) {
    const s = pickSpawnSpot(pos, minDistance, maxDistance);
    if (!s) return false;
    if (!isDeepEnoughForWreck(column(s.spot[0], s.spot[2]), settings().waterDepth)) return false;
    const debris = spawnClusterDebris(s.spot);
    const treasure = spawnClusterTreasure(s.spot);
    if (debris === 0 && treasure === 0) return false;
    rememberSpawnCell(s.key);
    spawnGuards(s.spot);
    clusters.push(s.spot);
    return true;
  }

  /** TryRunLootPulse. */
  function tryRunLootPulse(force, pos) {
    if (!force && time < nextAllowedPulseTime) return;
    const s = settings();
    tracked.prune(pos, DESPAWN_DISTANCE, s.maxLive);
    pruneLiveClusters(clusters, pos);
    if (tracked.count >= s.maxLive) return;
    let cluster = false, stray = false;
    const shore = inOrAboveDeepWater(DEEP_WATER_PULSE_DEPTH) ? 1 : SHORE_LOOT_PULSE_MULTIPLIER;
    const depth = () => depthSpawnMultiplier(column(pos[0], pos[2]), s.waterDepth);   // DepthSpawnMultiplier, at the player
    if (shouldSpawnTreasureCluster({ rate: s.clusterRate, liveClusters: clusters.length, maxLiveClusters: s.maxClusters, cove: s.cove, shore, depthMultiplier: depth() }, roll)) {
      cluster = trySpawnTreasureCluster(pos, DEFAULT_LOOT_MIN_SPAWN_DISTANCE, DEFAULT_LOOT_MAX_SPAWN_DISTANCE);
    }
    const n = rollStrayLootCount({ clusterSpawned: cluster, cove: s.cove, rate: s.rate, shore, depthMultiplier: depth() }, roll);
    for (let i = 0; i < n; i++) if (trySpawnStrayLoot(pos, DEFAULT_LOOT_MIN_SPAWN_DISTANCE, DEFAULT_LOOT_MAX_SPAWN_DISTANCE)) stray = true;
    nextAllowedPulseTime = time + (cluster || stray ? MIN_PULSE_INTERVAL_SECONDS : FAILED_PULSE_RETRY_SECONDS);
  }

  return {
    tracked,
    get clusterCount() { return clusters.length; },

    /** Pump (DeepWaters.Update, after PassiveFishBehaviour.PumpAll). @param {{time: number}} f - Time.time */
    pump(f) {
      time = f.time;
      const pos = canRunLootPulse();
      if (!pos) { anchor = null; return; }
      if (!anchor) {
        anchor = [pos[0], pos[1], pos[2]];
        tryRunLootPulse(true, pos);
        return;
      }
      const dx = pos[0] - anchor[0], dz = pos[2] - anchor[2];
      if (dx * dx + dz * dz < LOOT_PULSE_DISTANCE * LOOT_PULSE_DISTANCE) return;
      anchor = [pos[0], pos[1], pos[2]];
      tryRunLootPulse(false, pos);
    },

    // NO offsetAll, and that is the mod's: the pulse's anchor and the wrecks' centres are the spawner's statics in
    // world space and it answers no FloatingOrigin event, so a crossing into a new pixel leaves them where the world
    // was - the next frame's anchor test runs a pulse, and that pulse forgets every wreck (past 140 m). The piles and
    // their rubble are parented to their terrains and move with the world (the host's droppedLoot.offsetAll).

    /** ResetRuntimeState (OnTransientReset): the cells, the anchor, the clocks, the gate, every tracked object destroyed, the wrecks. */
    reset() {
      recentCells.clear();
      recentOrder.length = 0;
      anchor = null;
      nextAllowedPulseTime = 0;
      gateCached = false;
      gateResult = false;
      tracked.clear();
      clusters.length = 0;
    },

    get debug() { return { tracked: tracked.count, wrecks: clusters.length, cells: recentCells.size, nextPulse: nextAllowedPulseTime }; },
  };
}
