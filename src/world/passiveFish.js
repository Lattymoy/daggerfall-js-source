// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DW-E3 (2026-09-25): ILIAC PUDDLE NO MORE'S PASSIVE FISH - the species
// and the laws a fish lives by, as pure functions (jet082, 1.2.2):
// PassiveFishSpecies.cs, PassiveFishSpeciesCatalog.cs, PassiveFishSchool
// .cs, PassiveFishBehaviour.cs and the placement half of
// UnderwaterPassiveFishSpawner.cs. The host half - the spawner's pixel
// groups, the encounter pulse, the loot, the draw - is scenes/
// deepWatersFish.js.
//
// THE SPECIES. Seven, each an item the player can take (templates 9001 -
// 9007, the mod's ItemTemplates.json), with a spawn weight, a billboard
// height and aspect, a school size, the water biomes it lives in and the
// band of the sea's depth it keeps to (a weight that falls off over 0.18
// of the depth past either edge).
//
// THE SCHOOL. A centre that cruises (0.95 m/s x the species' cruise
// multiplier) in a direction held 2.2 - 4.4 s, flattened to 0.15 of its
// climb; a threat turns it away from the player at 1.45 m/s x the flee
// multiplier for 3 s. It keeps 1.2 m off the floor and 1.4 m under the
// surface and turns back from water under 2 m deep.
//
// THE FISH. Cruises 1.2 m/s x its multiplier, with its school or on its
// own (a new heading every 5 - 9 s); within 8 m of the player it flees at
// 3.5 m/s x its flee multiplier, darting 35 - 75 degrees off the line
// away, held 1.6 - 2.8 s (the species' own hold); it keeps 0.8 m off the
// floor and 1.4 m under the surface, and a fish in water under 2 m deep
// goes back where it was and turns round.
//
// THE DRAWS. Every one is an unseeded UnityEngine.Random draw, and rides
// the host's injectable roll (Port-Ledger A, the engine-PRNG rule).
// ═══════════════════════════════════════════════════════════════════

import { WATER_BIOME, climateToBiome } from './underwaterDecorations.js';
import { rangeInt, rangeFloat } from '../systems/unleveledLoot.js';   // Random.Range(int, int) and (float, float)
import { insideUnitSphere } from '../scenes/magicCandle.js';          // Random.insideUnitSphere
import { roundToInt } from '../systems/mathf.js';                   // Mathf.RoundToInt

export { rangeInt, rangeFloat, insideUnitSphere };

const f32 = Math.fround;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The fish items' templates (PassiveFishSpeciesCatalog's *TemplateIndex). */
export const FISH_TEMPLATE = Object.freeze({
  LongnoseButterflyfish: 9001, LargemouthBass: 9002, CanaryRockfish: 9003, CrucianCarp: 9004,
  Mackerel: 9005, WhiteZebraAngelfish: 9006, Finulon: 9007,
});
/** CustomItemTemplateIndices. */
export const FISH_TEMPLATE_INDICES = Object.freeze([9001, 9002, 9003, 9004, 9005, 9006, 9007]);
/** FishItemGroup: ItemGroups.UselessItems2 (9), where DFU's custom items live. */
export const FISH_ITEM_GROUP = 9;
/** DepthEdgeSoftness. */
export const DEPTH_EDGE_SOFTNESS = 0.18;
/** The fish's pictures' archive (PassiveFishSpecies' textureArchive default). */
export const FISH_TEXTURE_ARCHIVE = 216;

/**
 * PassiveFishSpecies' constructor, its clamps included: at least one in a
 * school and the max no less; a height multiplier of at least 0.05; a dart
 * held at least 0.1 s; no biome is every biome; the depth band in order and
 * inside 0..1.
 */
export function passiveFishSpecies(templateIndex, itemName, textureRecord, spawnWeight, billboardHeight, billboardAspect, textureName,
  cruiseSpeedMultiplier, fleeSpeedMultiplier, minSchoolSize, maxSchoolSize, biomes, minDepthFraction, maxDepthFraction,
  minHeightMultiplier = 1, maxHeightMultiplier = 1, fleeDartHoldMin = 1.6, fleeDartHoldMax = 2.8, textureArchive = FISH_TEXTURE_ARCHIVE) {
  const minSchool = Math.max(1, minSchoolSize);
  const minH = Math.max(f32(0.05), f32(minHeightMultiplier));
  const dartMin = Math.max(f32(0.1), f32(fleeDartHoldMin));
  return Object.freeze({
    templateIndex, itemName, textureArchive, textureRecord, spawnWeight,
    billboardHeight: f32(billboardHeight), billboardAspect: f32(billboardAspect), textureName,
    cruiseSpeedMultiplier: f32(cruiseSpeedMultiplier), fleeSpeedMultiplier: f32(fleeSpeedMultiplier),
    minSchoolSize: minSchool, maxSchoolSize: Math.max(minSchool, maxSchoolSize),
    minHeightMultiplier: minH, maxHeightMultiplier: Math.max(minH, f32(maxHeightMultiplier)),
    fleeDartHoldMin: dartMin, fleeDartHoldMax: Math.max(dartMin, f32(fleeDartHoldMax)),
    biomes: biomes === WATER_BIOME.None ? WATER_BIOME.Any : biomes,
    minDepthFraction: clamp01(Math.min(f32(minDepthFraction), f32(maxDepthFraction))),
    maxDepthFraction: clamp01(Math.max(f32(minDepthFraction), f32(maxDepthFraction))),
  });
}

const B = WATER_BIOME;
const species = passiveFishSpecies;
/** PassiveFishSpeciesCatalog.All, in its order. */
export const PASSIVE_FISH_SPECIES = Object.freeze([
  species(9001, 'Longnose Butterflyfish', 42, 10, 0.5, 1.3958334, 'longnose_butterflyfish', 1, 1, 8, 16, B.Tropical, 0, 0.35, 0.85, 1.15, 1.1, 2.2),
  species(9002, 'Largemouth Bass', 43, 4, 1.2, 2.2962964, 'largemouth_bass', 1.3, 1.3, 1, 2, B.Temperate | B.Swamp | B.Desert, 0, 0.45, 0.9, 1.25, 1.8, 3.2),
  species(9003, 'Canary Rockfish', 44, 8, 0.5, 2.7333333, 'canary_rockfish', 1.2, 1.2, 2, 4, B.OpenOcean | B.Temperate | B.Cold | B.Desert, 0.35, 1, 0.85, 1.15, 1.3, 2.4),
  species(9004, 'Crucian Carp', 45, 6, 1.2, 1.64, 'crucian_carp', 0.8, 0.8, 1, 3, B.Temperate | B.Swamp, 0, 0.4, 0.85, 1.2, 1.6, 3),
  species(9005, 'Mackerel', 46, 15, 0.8, 2.2666667, 'mackerel', 1.1, 1.1, 5, 12, B.Any, 0.1, 1, 0.8, 1.2, 0.9, 1.8),
  species(9006, 'White Zebra Angelfish', 47, 2, 0.4, 0.625, 'white_zebra_angelfish', 1.3, 1.3, 1, 1, B.Tropical, 0, 0.35, 0.85, 1.15, 1.1, 2),
  species(9007, 'Finulon', 41, 5, 1.8, 1.7083334, 'finulon', 1.2, 1.2, 1, 1, B.OpenOcean | B.Cold, 0.6, 1, 0.8, 1.1, 1.4, 2.6),
]);

/** A species by its item template, or null. */
export const speciesOfTemplate = (templateIndex) => PASSIVE_FISH_SPECIES.find((s) => s.templateIndex === templateIndex) ?? null;
/** IsFishTemplateIndex. */
export const isFishTemplateIndex = (templateIndex) => FISH_TEMPLATE_INDICES.includes(templateIndex);

/** DepthWeight01: 1 inside the band, falling to 0 over DepthEdgeSoftness past either edge. */
export function depthWeight01(s, depthFraction) {
  if (depthFraction >= s.minDepthFraction && depthFraction <= s.maxDepthFraction) return 1;
  const off = depthFraction < s.minDepthFraction ? f32(s.minDepthFraction - depthFraction) : f32(depthFraction - s.maxDepthFraction);
  return clamp01(f32(1 - f32(off / f32(DEPTH_EDGE_SOFTNESS))));
}

/** EffectiveWeight: none outside the species' biomes, else its weight x the depth's. */
export function effectiveWeight(s, biome, depthFraction) {
  if ((s.biomes & biome) === 0) return 0;
  return f32(s.spawnWeight * depthWeight01(s, depthFraction));
}

/**
 * PickRandom(climateIndex, depthFraction): a species drawn by its
 * effective weight among the spawnable ones (a species with weight and a
 * picture), or by its bare weight when the biome and depth leave none.
 * @param {ReadonlyArray<any>} spawnable - BuildSpawnableCache's list, in the catalog's order
 * @param {number} climateIndex @param {number} depthFraction
 * @param {() => number} roll - Random.value
 */
export function pickSpecies(spawnable, climateIndex, depthFraction, roll) {
  const total = spawnable.reduce((t, s) => t + s.spawnWeight, 0);
  if (total <= 0) return null;
  const biome = climateToBiome(climateIndex);
  depthFraction = clamp01(f32(depthFraction));
  let sum = 0;
  for (const s of spawnable) sum = f32(sum + effectiveWeight(s, biome, depthFraction));
  if (sum <= 0) return pickSpeciesByWeight(spawnable, roll);
  let r = f32(roll() * sum);
  for (const s of spawnable) {
    const w = effectiveWeight(s, biome, depthFraction);
    if (r < w) return s;
    r = f32(r - w);
  }
  return spawnable[spawnable.length - 1];
}

/** PickRandom(): Random.Range(0, totalSpawnWeight) walked down the list; the first when it runs off. */
export function pickSpeciesByWeight(spawnable, roll) {
  const total = spawnable.reduce((t, s) => t + s.spawnWeight, 0);
  if (total <= 0) return null;
  let n = Math.floor(roll() * total);
  for (const s of spawnable) {
    if (n < s.spawnWeight) return s;
    n -= s.spawnWeight;
  }
  return spawnable[0];
}

// ── the unseeded engine draws (Random.Range's two arms and insideUnitSphere have their homes) ──
/** Random.insideUnitCircle: a uniform point in the unit disc (rejection - the same distribution). */
export function insideUnitCircle(roll) {
  for (let i = 0; i < 64; i++) {
    const x = roll() * 2 - 1, y = roll() * 2 - 1;
    if (x * x + y * y <= 1) return [x, y];
  }
  return [0, 0];
}

// ── Vector3 the way Unity does it ──────────────────────────────────
const sqrMag = (v) => v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
const normalized = (v) => {
  const m = Math.hypot(v[0], v[1], v[2]);
  return m > 1e-5 ? [v[0] / m, v[1] / m, v[2] / m] : [0, 0, 0];   // Vector3.Normalize: zero under kEpsilon
};
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** Rodrigues: `v` turned `angle` radians about the unit `axis`. */
function rotateAbout(v, axis, angle) {
  const c = Math.cos(angle), s = Math.sin(angle), d = dot3(axis, v) * (1 - c), x = cross3(axis, v);
  return [v[0] * c + x[0] * s + axis[0] * d, v[1] * c + x[1] * s + axis[1] * d, v[2] * c + x[2] * s + axis[2] * d];
}
const K_EPSILON = 0.00001;
/** OrthoNormalVectorFast: a unit vector square to the unit `n`. */
function orthoNormal(n) {
  if (Math.abs(n[2]) > Math.SQRT1_2) {
    const k = 1 / Math.sqrt(n[1] * n[1] + n[2] * n[2]);
    return [0, -n[2] * k, n[1] * k];
  }
  const k = 1 / Math.sqrt(n[0] * n[0] + n[1] * n[1]);
  return [-n[1] * k, n[0] * k, 0];
}
/**
 * Vector3.Slerp: the direction turned from `a` toward `b` by `t` of the
 * angle between them (t clamped to 0..1), the length lerped - a straight
 * lerp when either is zero or they point the same way, a half turn about
 * any square axis when they point apart.
 */
export function vector3Slerp(a, b, t) {
  t = clamp01(t);
  const am = Math.hypot(a[0], a[1], a[2]), bm = Math.hypot(b[0], b[1], b[2]);
  if (am < K_EPSILON || bm < K_EPSILON) return lerp3(a, b, t);
  const len = am + (bm - am) * t;
  const d = dot3(a, b) / (am * bm);
  if (d > 1 - K_EPSILON) return lerp3(a, b, t);
  const an = [a[0] / am, a[1] / am, a[2] / am];
  let out;
  if (d < -1 + K_EPSILON) out = rotateAbout(an, orthoNormal(an), Math.PI * t);
  else out = rotateAbout(an, normalized(cross3(a, b)), Math.acos(d) * t);
  return [out[0] * len, out[1] * len, out[2] * len];
}
/** Vector3.Reflect. */
export const reflect3 = (dir, n) => { const k = -2 * dot3(n, dir); return [dir[0] + n[0] * k, dir[1] + n[1] * k, dir[2] + n[2] * k]; };

/**
 * The per-frame world a school and its fish read - the host fills it once
 * a frame (PassiveFishBehaviour.PumpAll):
 * @typedef {object} FishFrame
 * @property {number} time - Time.time (s)
 * @property {number} dt - Time.deltaTime (s)
 * @property {number} frame - Time.frameCount
 * @property {() => number} roll - Random.value
 * @property {number[]} playerPos - the player object's position
 * @property {(x: number, z: number) => ?{oceanY: number, seafloorY: number, depth: number, entry: object}} column - DeepWaterWorld.TryGetWaterColumn
 * @property {(column: object, x: number, z: number) => number} renderedSeafloorY - TryGetRenderedSeafloorWorldY (the column's own floor where the mesh has none)
 * @property {number} visibleDistance - UpdateDistanceVisibility's reach this frame
 * @property {(origin: number[], dir: number[], maxDistance: number) => ?{normal: number[]}} raycast - Physics.Raycast, triggers ignored
 */

// ── PassiveFishSchool ──────────────────────────────────────────────
export const SCHOOL_CRUISE_SPEED = 0.95;
export const SCHOOL_DISRUPTED_SPEED = 1.45;
export const SCHOOL_DIRECTION_HOLD = Object.freeze([2.2, 4.4]);
export const SCHOOL_DISRUPTED_MEMORY_SECONDS = 3;
export const SCHOOL_SEAFLOOR_CLEARANCE = 1.2;
export const SCHOOL_SURFACE_CLEARANCE = 1.4;
/** A school turns back from water shallower than this, and a fish from it (both the mod's `< 2f`). */
export const MINIMUM_SWIM_DEPTH = 2;

export class PassiveFishSchool {
  /** @param {number[]} startCenter @param {number} schoolRadius @param {number} cruiseMultiplier @param {number} fleeMultiplier @param {{time: number, roll: () => number}} at */
  constructor(startCenter, schoolRadius, cruiseMultiplier, fleeMultiplier, at) {
    this.center = [...startCenter];
    this.radius = Math.max(0.1, schoolRadius);
    this.cruiseSpeedMultiplier = cruiseMultiplier;
    this.fleeSpeedMultiplier = fleeMultiplier;
    this.cruiseDirection = [0, 0, 1];
    this.disruptedDirection = [0, 0, 1];
    this.nextDirectionTime = 0;
    this.disruptedUntil = 0;
    this.lastUpdateFrame = -1;
    this.pickCruiseDirection(at);
    this.disruptedDirection = [...this.cruiseDirection];
  }

  isDisrupted(time) { return time < this.disruptedUntil; }
  currentDirection(time) { return this.isDisrupted(time) ? this.disruptedDirection : this.cruiseDirection; }

  /** ReportThreat: away from the player, flattened to a quarter of its climb, for three seconds. */
  reportThreat(awayFromPlayer, time) {
    const a = [awayFromPlayer[0], awayFromPlayer[1] * 0.25, awayFromPlayer[2]];
    if (sqrMag(a) < 0.01) return;
    this.disruptedDirection = normalized(a);
    this.disruptedUntil = time + SCHOOL_DISRUPTED_MEMORY_SECONDS;
  }

  /** GetFleeDirection: from the player, flattened likewise; else the disrupted heading; else the cruise. */
  getFleeDirection(fishPos, playerPos) {
    const v = [fishPos[0] - playerPos[0], (fishPos[1] - playerPos[1]) * 0.25, fishPos[2] - playerPos[2]];
    if (sqrMag(v) > 0.01) return normalized(v);
    return sqrMag(this.disruptedDirection) > 0.01 ? this.disruptedDirection : this.cruiseDirection;
  }

  /** Update: once a frame, whichever of its fish asks first. @param {FishFrame} f */
  update(f) {
    if (this.lastUpdateFrame === f.frame) return;
    this.lastUpdateFrame = f.frame;
    if (!this.isDisrupted(f.time) && f.time >= this.nextDirectionTime) this.pickCruiseDirection(f);
    const dir = this.currentDirection(f.time);
    if (sqrMag(dir) < 0.01) return;
    const speed = this.isDisrupted(f.time) ? SCHOOL_DISRUPTED_SPEED * this.fleeSpeedMultiplier : SCHOOL_CRUISE_SPEED * this.cruiseSpeedMultiplier;
    this.moveCenter(normalized(dir), speed, f);
  }

  /** PickCruiseDirection: insideUnitSphere flattened to 0.15 of its climb (forward when nothing is left), held 2.2 - 4.4 s. */
  pickCruiseDirection(at) {
    const c = insideUnitSphere(at.roll);
    c[1] *= 0.15;
    this.cruiseDirection = sqrMag(c) < 0.01 ? [0, 0, 1] : normalized(c);
    this.nextDirectionTime = at.time + rangeFloat(SCHOOL_DIRECTION_HOLD[0], SCHOOL_DIRECTION_HOLD[1], at.roll);
  }

  /** MoveCenter: out of the sea or into water under 2 m, both headings turn about; else the step, kept off the floor and the surface. @param {FishFrame} f */
  moveCenter(direction, speed, f) {
    const next = [this.center[0] + direction[0] * speed * f.dt, this.center[1] + direction[1] * speed * f.dt, this.center[2] + direction[2] * speed * f.dt];
    const col = f.column(next[0], next[2]);
    if (!col || col.depth < MINIMUM_SWIM_DEPTH) {
      this.cruiseDirection = this.cruiseDirection.map((c) => -c);
      this.disruptedDirection = this.disruptedDirection.map((c) => -c);
      this.nextDirectionTime = f.time + 1;
      return;
    }
    const lo = f.renderedSeafloorY(col, next[0], next[2]) + SCHOOL_SEAFLOOR_CLEARANCE;
    const hi = col.oceanY - SCHOOL_SURFACE_CLEARANCE;
    if (next[1] < lo) {
      next[1] = lo;
      this.cruiseDirection[1] = Math.abs(this.cruiseDirection[1]);
      this.disruptedDirection[1] = Math.abs(this.disruptedDirection[1]);
    } else if (next[1] > hi) {
      next[1] = hi;
      this.cruiseDirection[1] = -Math.abs(this.cruiseDirection[1]);
      this.disruptedDirection[1] = -Math.abs(this.disruptedDirection[1]);
    }
    this.center = next;
  }
}

// ── PassiveFishBehaviour ───────────────────────────────────────────
export const BASE_CRUISE_SPEED = 1.2;
export const BASE_FLEE_SPEED = 3.5;
export const FLEE_DISTANCE = 8;
export const TURN_INTERVAL = Object.freeze([5, 9]);
export const CRUISE_TURN_SHARPNESS = 0.75;
export const SCHOOL_CRUISE_TURN_SHARPNESS = 2;
export const SCHOOL_COHESION_WEIGHT = 0.35;
export const SCHOOL_RETURN_COHESION_WEIGHT = 1.25;
export const FLEE_TURN_SHARPNESS = 9;
export const FLEE_DART_ANGLE = Object.freeze([35, 75]);
export const FLEE_DART_VERTICAL_BIAS = 0.18;
export const FISH_SEAFLOOR_CLEARANCE = 0.8;
export const FISH_SURFACE_CLEARANCE = 1.4;
export const WATER_COLUMN_REFRESH_INTERVAL = 0.25;
export const DISTANT_UPDATE_DISTANCE = 160;
export const DISTANT_UPDATE_INTERVAL = 0.25;
export const OBSTACLE_PROBE_FRAME_INTERVAL = 5;
export const OBSTACLE_PROBE_PLAYER_DISTANCE = 60;
export const COLLISION_PROBE_DISTANCE = 0.6;
export const COLLISION_PROBE_MARGIN = 0.15;

/**
 * One fish (PassiveFishBehaviour): its position, headings and clocks, its
 * school (or none), and its loot - `loot.items` the DaggerfallLoot's
 * collection, a fish emptied of its item leaving the world.
 */
export class PassiveFish {
  /**
   * Initialize.
   * @param {{position: number[], loot: ?{items: any[]}, cruiseMultiplier: number, fleeMultiplier: number, school: ?PassiveFishSchool, dartHoldMin: number, dartHoldMax: number}} o
   * @param {{time: number, roll: () => number}} at
   */
  constructor({ position, loot, cruiseMultiplier, fleeMultiplier, school, dartHoldMin, dartHoldMax }, at) {
    this.position = [...position];
    this.loot = loot;
    this.cruiseSpeedMultiplier = cruiseMultiplier;
    this.fleeSpeedMultiplier = fleeMultiplier;
    this.school = school ?? null;
    this.fleeDartHoldMin = Math.max(0.1, dartHoldMin);
    this.fleeDartHoldMax = Math.max(this.fleeDartHoldMin, dartHoldMax);
    this.swimDirection = [0, 0, 0];
    this.targetDirection = [0, 0, 0];
    this.fleeDartDirection = [0, 0, 0];
    this.nextTurnTime = 0;
    this.nextFleeDartTime = 0;
    this.schoolOffset = this.school ? this.position.map((c, i) => c - this.school.center[i]) : [0, 0, 0];
    this.lastSafePosition = [...this.position];
    this.hasLastSafePosition = true;
    this.cachedColumn = null;
    this.nextWaterColumnRefreshTime = 0;
    this.obstacleProbeFrameOffset = rangeInt(0, OBSTACLE_PROBE_FRAME_INTERVAL, at.roll);
    this.nextDistantUpdateTime = at.time + at.roll() * DISTANT_UPDATE_INTERVAL;
    this.visible = true;
    this.destroyed = false;
    this.pickWanderDirection(at);
  }

  /**
   * ManagedUpdate. Returns false once the fish is gone (its loot emptied:
   * the object destroyed). @param {FishFrame} f
   */
  managedUpdate(f) {
    if (this.destroyed) return false;
    if (this.loot && this.loot.items.length === 0) { this.destroyed = true; return false; }
    const away = this.position.map((c, i) => c - f.playerPos[i]);
    const sq = sqrMag(away);
    const distant = !this.updateDistanceVisibility(f) || sq > DISTANT_UPDATE_DISTANCE * DISTANT_UPDATE_DISTANCE;
    if (distant && f.time < this.nextDistantUpdateTime) return true;
    if (distant) this.nextDistantUpdateTime = f.time + DISTANT_UPDATE_INTERVAL + f.roll() * 0.05;
    let speed = BASE_CRUISE_SPEED * this.cruiseSpeedMultiplier;
    let sharpness = CRUISE_TURN_SHARPNESS;
    const threat = sq < FLEE_DISTANCE * FLEE_DISTANCE;
    if (threat && this.school) this.school.reportThreat(away, f.time);
    if (this.school) this.school.update(f);
    if (threat || (this.school && this.school.isDisrupted(f.time))) {
      away[1] *= 0.25;
      let flee = this.school ? this.school.getFleeDirection(this.position, f.playerPos) : away;
      if (sqrMag(flee) > 0.01) {
        flee = normalized(flee);
        this.refreshFleeDart(flee, f);
        this.targetDirection = sqrMag(this.fleeDartDirection) > 0.01 ? this.fleeDartDirection : flee;
      }
      speed = BASE_FLEE_SPEED * this.fleeSpeedMultiplier;
      sharpness = FLEE_TURN_SHARPNESS;
      this.nextTurnTime = f.time + 1;
    } else {
      this.swimWithSchool(f);
      if (this.school) sharpness = SCHOOL_CRUISE_TURN_SHARPNESS;
    }
    if (sqrMag(this.targetDirection) > 0.01) {
      this.swimDirection = vector3Slerp(this.swimDirection, this.targetDirection, f.dt * sharpness);
      if (sqrMag(this.swimDirection) > 0.01) this.swimDirection = normalized(this.swimDirection);
      else this.swimDirection = [...this.targetDirection];
    }
    const step = this.swimDirection.map((c) => c * speed * f.dt);
    if (!this.tryAvoidObstacle(step, f)) for (let i = 0; i < 3; i++) this.position[i] += step[i];
    this.clampToWater(f);
    return true;
  }

  /** UpdateDistanceVisibility: drawn and clickable within the frame's reach, flat distance. @param {FishFrame} f */
  updateDistanceVisibility(f) {
    const dx = this.position[0] - f.playerPos[0], dz = this.position[2] - f.playerPos[2];
    this.visible = dx * dx + dz * dz <= f.visibleDistance * f.visibleDistance;
    return this.visible;
  }

  /** TryAvoidObstacle: every fifth frame within 60 m, a ray ahead; a hit reflects the heading and the step is not taken. @param {FishFrame} f */
  tryAvoidObstacle(step, f) {
    if (sqrMag(step) < 1e-6) return false;
    const d = this.position.map((c, i) => c - f.playerPos[i]);
    if (sqrMag(d) > OBSTACLE_PROBE_PLAYER_DISTANCE * OBSTACLE_PROBE_PLAYER_DISTANCE) return false;
    if ((f.frame + this.obstacleProbeFrameOffset) % OBSTACLE_PROBE_FRAME_INTERVAL !== 0) return false;
    const reach = Math.max(COLLISION_PROBE_DISTANCE, Math.hypot(step[0], step[1], step[2]) * 5 + COLLISION_PROBE_MARGIN);
    const hit = f.raycast(this.position, this.swimDirection, reach);
    if (!hit) return false;
    let r = reflect3(this.swimDirection, hit.normal);
    if (sqrMag(r) < 0.01) r = this.swimDirection.map((c) => -c);
    this.swimDirection = normalized(r);
    this.targetDirection = [...this.swimDirection];
    this.nextTurnTime = f.time + 0.5;
    return true;
  }

  /** PickWanderDirection: insideUnitSphere flattened to a quarter of its climb, held 5 - 9 s. */
  pickWanderDirection(at) {
    const t = insideUnitSphere(at.roll);
    t[1] *= 0.25;
    this.targetDirection = sqrMag(t) < 0.01 ? [0, 0, 1] : normalized(t);
    if (sqrMag(this.swimDirection) < 0.01) this.swimDirection = [...this.targetDirection];
    this.nextTurnTime = at.time + rangeFloat(TURN_INTERVAL[0], TURN_INTERVAL[1], at.roll);
  }

  /** SwimWithSchool: back toward the school past its radius, else with it and gently toward its own place in it; alone, a new heading when its time comes. @param {FishFrame} f */
  swimWithSchool(f) {
    const s = this.school;
    if (!s) {
      if (f.time >= this.nextTurnTime) this.pickWanderDirection(f);
      return;
    }
    const toPlace = [s.center[0] + this.schoolOffset[0] - this.position[0], (s.center[1] + this.schoolOffset[1] - this.position[1]) * 0.25, s.center[2] + this.schoolOffset[2] - this.position[2]];
    const toCenter = [s.center[0] - this.position[0], (s.center[1] - this.position[1]) * 0.25, s.center[2] - this.position[2]];
    let dir = [...s.currentDirection(f.time)];
    dir[1] *= 0.5;
    if (sqrMag(dir) < 0.01) dir = sqrMag(this.swimDirection) > 0.01 ? [...this.swimDirection] : [0, 0, 1];
    dir = normalized(dir);
    if (sqrMag(toCenter) > s.radius * s.radius) {
      const n = normalized(toPlace);
      const v = dir.map((c, i) => c + n[i] * SCHOOL_RETURN_COHESION_WEIGHT);
      this.targetDirection = sqrMag(v) > 0.01 ? normalized(v) : dir;
    } else {
      const k = 1 / Math.max(0.1, s.radius);
      const v = dir.map((c, i) => c + toPlace[i] * k * SCHOOL_COHESION_WEIGHT);
      this.targetDirection = sqrMag(v) > 0.01 ? normalized(v) : dir;
    }
  }

  /** RefreshFleeDart: when the last dart's hold is out, a new one 35 - 75 degrees off the line away, either side, a little up or down. @param {FishFrame} f */
  refreshFleeDart(away, f) {
    if (f.time < this.nextFleeDartTime && sqrMag(this.fleeDartDirection) > 0.01) return;
    let side = cross3([0, 1, 0], away);
    if (sqrMag(side) < 0.01) side = [1, 0, 0];
    side = normalized(side);
    if (f.roll() < 0.5) side = side.map((c) => -c);
    const angle = rangeFloat(FLEE_DART_ANGLE[0], FLEE_DART_ANGLE[1], f.roll) * (Math.PI / 180);
    const dart = away.map((c, i) => c * Math.cos(angle) + side[i] * Math.sin(angle));
    dart[1] += rangeFloat(-FLEE_DART_VERTICAL_BIAS, FLEE_DART_VERTICAL_BIAS, f.roll);
    this.fleeDartDirection = sqrMag(dart) < 0.01 ? normalized(away) : normalized(dart);
    this.nextFleeDartTime = f.time + rangeFloat(this.fleeDartHoldMin, this.fleeDartHoldMax, f.roll);
  }

  /** ClampToWater: out of the sea or over water under 2 m, back where it was and turned round; else kept off the floor and the surface. @param {FishFrame} f */
  clampToWater(f) {
    const col = this.currentWaterColumn(f);
    if (!col || col.depth < MINIMUM_SWIM_DEPTH) {
      if (this.hasLastSafePosition) this.position = [...this.lastSafePosition];
      this.swimDirection = this.swimDirection.map((c) => -c);
      return;
    }
    const lo = f.renderedSeafloorY(col, this.position[0], this.position[2]) + FISH_SEAFLOOR_CLEARANCE;
    const hi = col.oceanY - FISH_SURFACE_CLEARANCE;
    if (this.position[1] < lo) { this.position[1] = lo; this.swimDirection[1] = Math.abs(this.swimDirection[1]); }
    else if (this.position[1] > hi) { this.position[1] = hi; this.swimDirection[1] = -Math.abs(this.swimDirection[1]); }
    this.lastSafePosition = [...this.position];
    this.hasLastSafePosition = true;
  }

  /** TryGetCurrentWaterColumn: the column under the fish, asked again a quarter-second on. @param {FishFrame} f */
  currentWaterColumn(f) {
    if (this.cachedColumn && f.time < this.nextWaterColumnRefreshTime) return this.cachedColumn;
    this.nextWaterColumnRefreshTime = f.time + WATER_COLUMN_REFRESH_INTERVAL;
    this.cachedColumn = f.column(this.position[0], this.position[2]);
    return this.cachedColumn;
  }

  /** A recentre moved the world by `offset`: every world position the fish holds moves with it. */
  shift(offset) {
    for (let i = 0; i < 3; i++) { this.position[i] += offset[i]; this.lastSafePosition[i] += offset[i]; }
    this.cachedColumn = null;
  }
}

// ── UnderwaterPassiveFishSpawner's placement ───────────────────────
export const FISH_ATTEMPTS_PER_PIXEL = 90;
export const PASSIVE_FISH_FREQUENCY_AT_MIDPOINT = 3;
export const MINIMUM_FISH_COLUMN_DEPTH = 8;
export const SPAWN_SEAFLOOR_CLEARANCE = 1.2;
export const SPAWN_SURFACE_CLEARANCE = 1.4;
export const SCHOOL_MEMBER_RADIUS = Object.freeze([1.2, 5]);
export const SCHOOL_MEMBER_MIN_SEPARATION = 2.2;
const SCHOOL_MEMBER_MIN_SEPARATION_SQ = f32(4.84);   // IsFarEnoughFromSchoolmates' literal
export const SCHOOL_POSITION_ATTEMPTS = 24;
export const DEEP_FISH_FLOOR_BIAS_START = 0.55;
export const DEEP_FISH_FLOOR_BAND_METERS = 35;
export const MAX_PENDING_FISH_SPAWNS_PER_FRAME = 5;
/** MaxLiveFishLimit, and EffectiveFishCap's answer with no mod instance. */
export const MAX_LIVE_FISH_LIMIT = 1080;

/** ScaledAttemptsPerPixel: 90 x the frequency over its midpoint's 3, in floats, rounded as Mathf.RoundToInt rounds. */
export function scaledAttemptsPerPixel(frequency) {
  return Math.max(0, roundToInt(f32(FISH_ATTEMPTS_PER_PIXEL * f32(f32(frequency) / PASSIVE_FISH_FREQUENCY_AT_MIDPOINT))));
}

/** GetSchoolRadius. */
export const schoolRadius = (schoolSize) => Math.min(5, Math.max(1.2, 2.5 + schoolSize * 0.45));

/** GetFishBillboardSize: the height by the aspect. */
export const fishBillboardSize = (s, height) => ({ w: height * s.billboardAspect, h: height });

/**
 * TryResolveColumnRange: a column at least 8 m deep, the range between
 * the floor's clearance and the surface's, or null.
 * @param {FishFrame} f
 */
export function resolveColumnRange(f, x, z, floorClearance, surfaceClearance) {
  const col = f.column(x, z);
  if (!col || col.depth < MINIMUM_FISH_COLUMN_DEPTH) return null;
  const minY = f.renderedSeafloorY(col, x, z) + floorClearance;
  const maxY = col.oceanY - surfaceClearance;
  return maxY <= minY ? null : { minY, maxY, oceanY: col.oceanY, column: col };
}

/**
 * TryPickFishY: a depth inside the species' band of the sea's WaterDepth
 * and inside the column's range; past 0.55 of the depth the pick leans
 * toward the floor's 35 m band. The world height, or null.
 */
export function pickFishY(minY, maxY, oceanY, s, waterDepth, roll) {
  if (maxY <= minY) return null;
  const depth = Math.max(1, waterDepth);
  const lo = Math.max(s.minDepthFraction * depth, oceanY - maxY);
  const hi = Math.min(s.maxDepthFraction * depth, oceanY - minY);
  if (hi <= lo) return null;
  let d = rangeFloat(lo, hi, roll);
  const bias = clamp01((clamp01((oceanY - minY) / depth) - DEEP_FISH_FLOOR_BIAS_START) / 0.45);
  if (bias > 0) d = d + (rangeFloat(Math.max(lo, hi - DEEP_FISH_FLOOR_BAND_METERS), hi, roll) - d) * bias;
  return oceanY - d;
}

/**
 * TryResolveFishPosition (the species'): the clearances at least half the
 * tallest the species draws; the world point, or null.
 * @param {FishFrame} f
 */
export function resolveFishPosition(f, x, z, s, waterDepth) {
  const half = 0.5 * s.billboardHeight * s.maxHeightMultiplier;
  const r = resolveColumnRange(f, x, z, Math.max(SPAWN_SEAFLOOR_CLEARANCE, half), Math.max(SPAWN_SURFACE_CLEARANCE, half));
  if (!r) return null;
  const y = pickFishY(r.minY, r.maxY, r.oceanY, s, waterDepth, f.roll);
  return y == null ? null : { pos: [x, y, z], column: r.column };
}

/**
 * TryPickSchoolmatePosition: 24 tries on the ring 1.2 m .. the school's
 * radius, at a depth within a metre of the centre's (ClampToSchoolDepth),
 * 2.2 m from every schoolmate stood. The world point, or null.
 * @param {FishFrame} f
 */
export function pickSchoolmatePosition(f, center, radius, existing) {
  for (let i = 0; i < SCHOOL_POSITION_ATTEMPTS; i++) {
    let c = insideUnitCircle(f.roll);
    if (c[0] * c[0] + c[1] * c[1] < 0.01) c = [1, 0];
    const m = Math.hypot(c[0], c[1]);
    const r = rangeFloat(SCHOOL_MEMBER_RADIUS[0], radius, f.roll);
    const x = center[0] + (c[0] / m) * r, z = center[2] + (c[1] / m) * r;
    const range = resolveColumnRange(f, x, z, SPAWN_SEAFLOOR_CLEARANCE, SPAWN_SURFACE_CLEARANCE);
    if (!range) continue;
    const pos = [x, rangeFloat(range.minY, range.maxY, f.roll), z];
    // ClampToSchoolDepth
    const col = f.column(x, z);
    if (col) {
      const lo = f.renderedSeafloorY(col, x, z) + SPAWN_SEAFLOOR_CLEARANCE, hi = col.oceanY - SPAWN_SURFACE_CLEARANCE;
      pos[1] = Math.min(hi, Math.max(lo, center[1] + rangeFloat(-1, 1, f.roll)));
    }
    if (!existing || existing.every((e) => sqrMag(pos.map((v, k) => v - e[k])) >= SCHOOL_MEMBER_MIN_SEPARATION_SQ)) return { pos, column: range.column };
  }
  return null;
}

// ── PassiveFishResources ───────────────────────────────────────────
/**
 * RestoreIconAspect: the picture Blit (point-sampled) to a width of
 * round(height x the species' aspect), its height kept - Unity's import
 * rounded the author's pictures to powers of two, and the icon takes the
 * drawn fish's shape back. The same picture when the width already
 * agrees. Rows in the picture's own order.
 * @param {{width: number, height: number, data: Uint8Array | Uint8ClampedArray}} src
 * @param {number} aspect
 */
export function restoreIconAspect(src, aspect) {
  const w = Math.max(1, roundToInt(f32(src.height * f32(aspect))));
  if (w === src.width) return src;
  const data = new Uint8Array(w * src.height * 4);
  for (let x = 0; x < w; x++) {
    const sx = Math.min(src.width - 1, Math.floor(((x + 0.5) / w) * src.width));   // the Blit's point sample at the pixel's centre
    for (let y = 0; y < src.height; y++) {
      const i = (y * w + x) * 4, j = (y * src.width + sx) * 4;
      data[i] = src.data[j]; data[i + 1] = src.data[j + 1]; data[i + 2] = src.data[j + 2]; data[i + 3] = src.data[j + 3];
    }
  }
  return { width: w, height: src.height, data };
}

/**
 * A ray against an upright capsule (a CharacterController: its feet at
 * `feet`, its caps `radius`, its height `height`) - the nearest hit within
 * `maxDist`, with the surface's outward normal, or null. Only the near
 * crossings count, so a ray starting inside it meets nothing (Physics
 * .Raycast's rule: the near crossing is behind it).
 */
export function rayUprightCapsule(o, d, maxDist, feet, radius, height) {
  const ya = feet[1] + radius, yb = feet[1] + Math.max(radius, height - radius);
  let best = null;
  const take = (t, n) => { if (t >= 0 && t <= maxDist && (!best || t < best.dist)) best = { dist: t, normal: normalized(n) }; };
  // the side
  const ox = o[0] - feet[0], oz = o[2] - feet[2];
  const a = d[0] * d[0] + d[2] * d[2];
  if (a > 1e-12) {
    const b = 2 * (ox * d[0] + oz * d[2]), c = ox * ox + oz * oz - radius * radius;
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      const y = o[1] + d[1] * t;
      if (y >= ya && y <= yb) take(t, [ox + d[0] * t, 0, oz + d[2] * t]);
    }
  }
  // the caps
  for (const cy of [ya, yb]) {
    const lx = o[0] - feet[0], ly = o[1] - cy, lz = o[2] - feet[2];
    const b = lx * d[0] + ly * d[1] + lz * d[2], c = lx * lx + ly * ly + lz * lz - radius * radius;
    const disc = b * b - c;
    if (disc < 0) continue;
    const t = -b - Math.sqrt(disc);
    const p = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
    if ((cy === ya && p[1] <= ya) || (cy === yb && p[1] >= yb)) take(t, [p[0] - feet[0], p[1] - cy, p[2] - feet[2]]);
  }
  return best;
}
