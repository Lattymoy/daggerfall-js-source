// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DW-E3 (2026-09-25): ILIAC PUDDLE NO MORE'S ENCOUNTER PULSE AND ITS FISH
// SPAWNER (jet082, 1.2.2) - UnderwaterEncounterPulse.cs and the host half
// of UnderwaterPassiveFishSpawner.cs, over the port's pixels. The laws a
// fish lives and is placed by are world/passiveFish.js; what a fish IS in
// the world (its picture, its loot, its click) is the host's `makeFish`.
//
// THE PULSE, every frame: a dozen of the queued destroys; five of the
// fish's queued spawns (the deep's foes' one, DW-E4); then, a tenth of a
// second apart, the tick - no heavy work, everything cleared; the player
// out of the outdoor water context, or the switch off, and after two
// seconds of that the spawner cleared (HandleDisable); else the loaded
// pixels within 300 m of the player (the nearest EDGE) kept, the rest
// released to the destroy queue, and the water pixels within 200 m -
// ocean-connected, with a distance field - each given two attempts, the
// nearest first.
//
// THE SPAWNER, per pixel: 90 attempts x the frequency / 3, spent two a
// tick; an attempt draws a point on the pixel, a species for its climate
// and depth, a place in the water for it, and a school of Range(min, max
// + 1) capped by the live count's headroom - the first fish at the point,
// its schoolmates on a ring round it. A spawn is queued, not stood: five
// stand a frame. The live count counts the queued; a pixel's group leaves
// with its pixel. Its draws are the unseeded UnityEngine.Random and ride
// the frame's roll (Port-Ledger A, the engine-PRNG rule).
// ═══════════════════════════════════════════════════════════════════

import { TransientObjectTracker } from '../world/deepWaterTransients.js';
import {
  PassiveFishSchool, pickSpecies, resolveFishPosition, pickSchoolmatePosition, schoolRadius, scaledAttemptsPerPixel,
  rangeInt, MAX_PENDING_FISH_SPAWNS_PER_FRAME, MAX_LIVE_FISH_LIMIT,
} from '../world/passiveFish.js';
import { TILE_WORLD_SIZE } from '../world/deepWaterFloor.js';

export const TICK_INTERVAL = 0.1;
export const POPULATE_RADIUS = 200;
export const DESPAWN_RADIUS = 300;
export const MAX_PENDING_DESTROYS_PER_FRAME = 12;
export const FISH_ATTEMPTS_PER_PIXEL_PER_TICK = 2;
export const ENEMY_ATTEMPTS_PER_PIXEL_PER_TICK = 4;
export const DISABLE_CLEAR_GRACE_SECONDS = 2;

/** NearestEdgeDistanceSq: the squared flat distance from a point to a pixel's square (0 inside it). */
export function nearestEdgeDistanceSq(p, originX, originZ, size) {
  const dx = Math.max(originX - p[0], 0, p[0] - (originX + size));
  const dz = Math.max(originZ - p[2], 0, p[2] - (originZ + size));
  return dx * dx + dz * dz;
}

/**
 * UnderwaterPassiveFishSpawner's host half.
 * @param {object} deps
 * @param {() => {frequency: number, maxLive: number, waterDepth: number}} deps.settings - PassiveFishFrequency (scaled), MaxLiveFish, WaterDepth
 * @param {() => object[]} deps.spawnable - PassiveFishSpeciesCatalog's spawnable list (a species with weight and a picture)
 * @param {(o: {pos: number[], species: object, school: ?PassiveFishSchool, column: object}) => ?object} deps.makeFish - SpawnPassiveFish: the fish stood, or null
 * @param {(entry: object) => number[]} deps.pixelOrigin - the pixel's world origin (its south-west corner)
 * @param {(entry: object) => number} deps.climateIndexOf - DeepWaterTileData.BiomeClimateIndex
 */
export function createFishSpawner({ settings, spawnable, makeFish, pixelOrigin, climateIndexOf }) {
  /** @type {Map<string, {fish: TransientObjectTracker, attemptsRemaining: number, liveOrPending: number, active: boolean}>} */
  const groups = new Map();
  /** @type {Array<{group: any, pos: number[], species: object, school: ?PassiveFishSchool, column: object}>} */
  const pending = [];
  let liveCount = 0;

  /** EffectiveFishCap. */
  const cap = () => settings().maxLive;

  function clearAll() {
    for (const g of groups.values()) { g.active = false; g.fish.clear(); }
    groups.clear();
    pending.length = 0;
    liveCount = 0;
  }

  /** SpawnFish: queued - counted live now, stood when its turn comes. */
  function reserve(group, pos, species, school, column) {
    if (!group?.active || !species) return false;
    pending.push({ group, pos, species, school, column });
    group.liveOrPending++;
    liveCount++;
    return true;
  }

  /** ResolveSpeciesContext: the pixel's biome climate and the column's depth over the sea's WaterDepth. */
  function speciesContext(f, x, z) {
    const col = f.column(x, z);
    if (!col) return { climateIndex: 0, depthFraction: 0 };
    const depth = Math.max(1, settings().waterDepth);
    return { climateIndex: climateIndexOf(col.entry) ?? 0, depthFraction: Math.min(1, Math.max(0, col.depth / depth)) };
  }

  /** SpawnSchool: the first at the point; the rest on the ring, while the live count allows. */
  function spawnSchool(f, first, species, size, liveCap, group) {
    const radius = schoolRadius(size);
    const school = size > 1 ? new PassiveFishSchool(first.pos, radius, species.cruiseSpeedMultiplier, species.fleeSpeedMultiplier, f) : null;
    const placed = size > 1 ? [] : null;
    if (!reserve(group, first.pos, species, school, first.column)) return;
    placed?.push(first.pos);
    for (let i = 1; i < size; i++) {
      if (liveCount >= liveCap) break;
      const mate = pickSchoolmatePosition(f, first.pos, radius, placed);
      if (mate && reserve(group, mate.pos, species, school, mate.column)) placed?.push(mate.pos);
    }
  }

  return {
    get liveCount() { return liveCount; },
    get pendingCount() { return pending.length; },
    groupOf: (key) => groups.get(key) ?? null,
    clearAll,

    /** PumpPendingSpawns: five a frame; a spawn whose group left is dropped, one that fails un-counted. */
    pumpPendingSpawns() {
      let n = MAX_PENDING_FISH_SPAWNS_PER_FRAME;
      while (n > 0 && pending.length) {
        n--;
        const r = pending.shift();
        if (!r.group?.active) continue;
        const fish = makeFish({ pos: r.pos, species: r.species, school: r.school, column: r.column });
        if (fish) { r.group.fish.add(fish); continue; }
        r.group.liveOrPending = Math.max(0, r.group.liveOrPending - 1);
        liveCount = Math.max(0, liveCount - 1);
      }
    },

    /** TickDespawn: a group whose pixel is not kept releases its fish to the destroy queue. */
    tickDespawn(keepKeys, queueDestroy) {
      for (const [key, g] of [...groups]) {
        if (keepKeys.has(key)) continue;
        g.active = false;
        liveCount = Math.max(0, liveCount - g.liveOrPending);
        g.fish.release(queueDestroy);
        groups.delete(key);
      }
    },

    /**
     * TickPopulate: the pixel's attempts, while the tick's budget lasts.
     * @param {import('../world/passiveFish.js').FishFrame} f
     * @param {object} entry - the pixel (DaggerfallTerrain)
     * @param {{n: number}} budget
     */
    tickPopulate(f, entry, key, budget) {
      if (budget.n <= 0 || !entry) return;
      let g = groups.get(key);
      if (!g) {
        g = { fish: new TransientObjectTracker(), attemptsRemaining: scaledAttemptsPerPixel(settings().frequency), liveOrPending: 0, active: true };
        groups.set(key, g);
      }
      if (g.attemptsRemaining <= 0) return;
      const liveCap = cap();
      const origin = pixelOrigin(entry);
      const s = settings();
      while (budget.n > 0 && g.attemptsRemaining > 0) {
        if (liveCount >= liveCap) { g.attemptsRemaining = 0; break; }
        budget.n--;
        g.attemptsRemaining--;
        const x = origin[0] + f.roll() * TILE_WORLD_SIZE;
        const z = origin[2] + f.roll() * TILE_WORLD_SIZE;
        const ctx = speciesContext(f, x, z);
        const species = pickSpecies(spawnable(), ctx.climateIndex, ctx.depthFraction, f.roll);
        if (!species) continue;
        const first = resolveFishPosition(f, x, z, species, s.waterDepth);
        if (!first) continue;
        const size = Math.min(rangeInt(species.minSchoolSize, species.maxSchoolSize + 1, f.roll), liveCap - liveCount);
        if (size <= 0) { g.attemptsRemaining = 0; break; }
        spawnSchool(f, first, species, size, liveCap, g);
      }
    },
  };
}

/**
 * UnderwaterEncounterPulse. The spawners are {pumpPendingSpawns(),
 * tickDespawn(keep, queueDestroy), tickPopulate(f, entry, key, budget),
 * clearAll()}; a queued destroy is an object with {hide(), destroy()}
 * (SetActive(false), then Object.Destroy a frame or more on).
 * @param {object} deps
 * @param {() => boolean} deps.canRunHeavy - DeepWaterRuntime.CanRunHeavyRuntimeWork
 * @param {() => boolean} deps.exteriorWaterContext - DeepWaterWorld.IsPlayerInExteriorWaterContext
 * @param {() => ?number[]} deps.playerPosition - TryGetPlayerPosition
 * @param {() => Iterable<object>} deps.loadedPixels - DeepWaterTerrainLookup.GetLoadedTerrains
 * @param {(entry: object) => boolean} deps.isWaterPixel - IsWaterPixel: ocean-connected with a distance field
 * @param {(entry: object) => number[]} deps.pixelOrigin
 * @param {(entry: object) => string} deps.keyOf - DeepWaterWorld.TileKey
 * @param {{spawner: any, canPopulate: () => boolean, attempts: number}} deps.fish
 * @param {?{spawner: any, canPopulate: () => boolean, attempts: number}} [deps.enemies]
 * @param {() => void} [deps.updateInventoryState] - PassiveFishResources.UpdateInventoryState
 */
export function createEncounterPulse({ canRunHeavy, exteriorWaterContext, playerPosition, loadedPixels, isWaterPixel, pixelOrigin, keyOf, fish, enemies = null, updateInventoryState = () => {} }) {
  let nextTickTime = 0;
  const disabledSince = { fish: -1, enemies: -1 };
  const keepKeys = new Set();
  /** @type {Array<{entry: object, key: string, edgeDistanceSq: number}>} */
  const candidates = [];
  const pendingDestroys = [];
  /** @type {Array<[string, {spawner: any, canPopulate: () => boolean, attempts: number}]>} */
  const lanes = /** @type {any} */ ([['fish', fish], ['enemies', enemies]].filter(([, l]) => l));

  /** Unity's `!= null`: there, and not destroyed. */
  const live = (o) => !!o && !o.destroyed?.();
  /** QueueDestroy: inactive now, gone when its turn comes - a destroyed one is not queued. */
  function queueDestroy(o) {
    if (!live(o)) return;
    o.hide?.();
    pendingDestroys.push(o);
  }
  /** PumpPendingDestroys: a dozen turns a frame; one destroyed meanwhile spends its turn. */
  function pumpPendingDestroys() {
    let n = MAX_PENDING_DESTROYS_PER_FRAME;
    while (n-- > 0 && pendingDestroys.length) {
      const o = pendingDestroys.shift();
      if (live(o)) o.destroy?.();
    }
  }
  function flushPendingDestroys() {
    while (pendingDestroys.length) {
      const o = pendingDestroys.shift();
      if (live(o)) o.destroy?.();
    }
  }
  function clearEverything() {
    flushPendingDestroys();
    for (const [, l] of lanes) l.spawner.clearAll();
  }
  /** HandleDisable: off for two seconds running, the lane is cleared. */
  function handleDisable(name, enabled, time, clearAll) {
    if (enabled) disabledSince[name] = -1;
    else if (disabledSince[name] < 0) disabledSince[name] = time;
    else if (time - disabledSince[name] >= DISABLE_CLEAR_GRACE_SECONDS) clearAll();
  }
  /** CollectPixels: kept within 300 m (the nearest edge), populated within 200 m if water, nearest first. */
  function collectPixels(p) {
    keepKeys.clear();
    candidates.length = 0;
    for (const e of loadedPixels()) {
      if (!e) continue;
      const o = pixelOrigin(e);
      const d = nearestEdgeDistanceSq(p, o[0], o[2], TILE_WORLD_SIZE);
      if (d > DESPAWN_RADIUS * DESPAWN_RADIUS) continue;
      const key = keyOf(e);
      keepKeys.add(key);
      if (d <= POPULATE_RADIUS * POPULATE_RADIUS && isWaterPixel(e)) candidates.push({ entry: e, key, edgeDistanceSq: d });
    }
    candidates.sort((a, b) => a.edgeDistanceSq - b.edgeDistanceSq);
  }

  return {
    queueDestroy,
    get pendingDestroyCount() { return pendingDestroys.length; },
    get keepKeys() { return keepKeys; },

    /** Pump. @param {import('../world/passiveFish.js').FishFrame} f */
    pump(f) {
      pumpPendingDestroys();
      for (const [, l] of lanes) l.spawner.pumpPendingSpawns();
      if (f.time < nextTickTime) return;
      nextTickTime = f.time + TICK_INTERVAL;
      if (!canRunHeavy()) { clearEverything(); return; }
      updateInventoryState();
      const context = exteriorWaterContext();
      const on = {};
      for (const [name, l] of lanes) {
        on[name] = context && l.canPopulate();
        handleDisable(name, on[name], f.time, () => l.spawner.clearAll());
      }
      const pos = playerPosition();
      if (!lanes.some(([name]) => on[name]) || !pos) return;
      collectPixels(pos);
      for (const [name, l] of lanes) if (on[name]) l.spawner.tickDespawn(keepKeys, queueDestroy);
      for (const c of candidates) {
        for (const [name, l] of lanes) {
          if (on[name]) l.spawner.tickPopulate(f, c.entry, c.key, { n: l.attempts });
        }
      }
    },

    /** ResetState (OnTransientReset). */
    reset() {
      nextTickTime = 0;
      disabledSince.fish = disabledSince.enemies = -1;
      keepKeys.clear();
      candidates.length = 0;
      clearEverything();
    },
  };
}

/** MaxLiveFish, clamped as ApplySettings clamps it. */
export const clampMaxLiveFish = (v) => Math.min(MAX_LIVE_FISH_LIMIT, Math.max(0, v | 0));
