// Player activation ray. Verbatim Daggerfall Unity PlayerActivate
// constants (MIT, Daggerfall Workshop): the ray reaches classic's
// farthest view distance, individual targets gate on their activation
// distance (doors/default 128 * GlobalScale).
// Target picking (ours): activatables are tested as world AABBs (their
// model's transformed corner box - doors and levers are box-like), the
// nearest in-reach hit wins, and a collider raycast rejects targets
// occluded by closer world geometry.

// AUDIT 24 (wave 23): MeshReader.GlobalScale has one home
// (world/meshReader.js), which every other module in the port already
// imports it from. This file declared a second 0.025 - agreeing, as
// duplicates do until they do not.
import { GLOBAL_SCALE } from '../world/meshReader.js';

export { GLOBAL_SCALE };

// PlayerActivate.cs:76-88, the WHOLE set. Three of these used to live
// in systems/talk.js instead, and wave 22 of this audit added a fourth
// there without noticing the first three - which is how a duplicate
// set gets built one honest commit at a time. talk.js re-exports these
// now.
export const RAY_DISTANCE = 3072 * GLOBAL_SCALE; // 76.8
export const DEFAULT_ACTIVATION_DISTANCE = 128 * GLOBAL_SCALE; // 3.2
export const DOOR_ACTIVATION_DISTANCE = 128 * GLOBAL_SCALE;
export const TREASURE_ACTIVATION_DISTANCE = 128 * GLOBAL_SCALE;
export const PICKPOCKET_DISTANCE = 128 * GLOBAL_SCALE;
export const STATIC_NPC_ACTIVATION_DISTANCE = 256 * GLOBAL_SCALE;
export const MOBILE_NPC_ACTIVATION_DISTANCE = 256 * GLOBAL_SCALE;
// PlayerActivate.cs:85 - corpses reach FURTHER than everything else
// (150 classic units, not 128). It is deliberate, not incidental:
// ActivateLootContainer (:866-874) exempts CorpseMarker from the
// TreasureActivationDistance gate and re-tests it at :938 against
// CorpseActivationDistance. AUDIT 18: this constant was missing, so
// corpse targets fell back to the 128-unit default.
export const CORPSE_ACTIVATION_DISTANCE = 150 * GLOBAL_SCALE; // 3.75

/** Axis-aligned bounds of a model's positions under a matrix. */
export function worldAabb(positions, m) {
  let minX = Infinity; let minY = Infinity; let minZ = Infinity;
  let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
    const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
    if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
    if (wy < minY) minY = wy; if (wy > maxY) maxY = wy;
    if (wz < minZ) minZ = wz; if (wz > maxZ) maxZ = wz;
  }
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

/** Slab ray-AABB; distance along unit dir or null. */
export function rayAabb(origin, dir, aabb) {
  let tMin = 0;
  let tMax = Infinity;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(dir[a]) < 1e-9) {
      if (origin[a] < aabb.min[a] || origin[a] > aabb.max[a]) return null;
      continue;
    }
    const inv = 1 / dir[a];
    let t0 = (aabb.min[a] - origin[a]) * inv;
    let t1 = (aabb.max[a] - origin[a]) * inv;
    if (t0 > t1) { const s = t0; t0 = t1; t1 = s; }
    if (t0 > tMin) tMin = t0;
    if (t1 < tMax) tMax = t1;
    if (tMin > tMax) return null;
  }
  return tMin;
}

/**
 * Build activation targets from an ActionSystem's live objects - ONE
 * source for both scenes (audit 2026-08-16: the scenes built targets
 * inline with worldAabb(o.cpu.positions, o.matrix) and CRASHED on
 * effect objects, which carry a precomputed aabb and no cpu/matrix;
 * relay objects carry neither and are chain-only, never targets).
 * @param {Map<string, object>} objects - ActionSystem.objects
 * @param {number} distance - activation reach for every target.
 */
export function activationTargets(objects, distance = DOOR_ACTIVATION_DISTANCE) {
  const targets = [];
  for (const o of objects.values()) {
    const aabb = o.aabb ?? (o.cpu ? worldAabb(o.cpu.positions, o.matrix) : null);
    if (!aabb) continue;
    targets.push({ key: o.key, aabb, distance });
  }
  return targets;
}

/**
 * Pick the nearest activatable the eye ray hits within reach and sight.
 * @param {Array<{key:string, aabb:{min,max}, distance?:number}>} targets
 * @returns {string|null} target key
 */
export function pickActivatable(eye, dir, targets, collider) {
  let bestKey = null;
  let bestDist = Infinity;
  let bestAabb = null;
  for (const target of targets) {
    const d = rayAabb(eye, dir, target.aabb);
    if (d === null || d >= bestDist) continue;
    if (d > (target.distance ?? DEFAULT_ACTIVATION_DISTANCE)) continue;
    bestKey = target.key;
    bestDist = d;
    bestAabb = target.aabb;
  }
  if (bestKey === null) return null;
  // Occlusion: solid world strictly in front of the target blocks it -
  // UNLESS the blocking hit lies inside the target's own box (thin or
  // diagonal meshes sit well inside their AABB, so their own surface
  // legitimately lands nearer than the AABB entry).
  const wall = collider.raycast(eye, dir, bestDist - 0.05);
  if (wall < bestDist - 0.05) {
    const hx = eye[0] + dir[0] * wall;
    const hy = eye[1] + dir[1] * wall;
    const hz = eye[2] + dir[2] * wall;
    const b = bestAabb;
    const skin = 0.15;
    const inside = hx >= b.min[0] - skin && hx <= b.max[0] + skin
      && hy >= b.min[1] - skin && hy <= b.max[1] + skin
      && hz >= b.min[2] - skin && hz <= b.max[2] + skin;
    if (!inside) return null;
  }
  return bestKey;
}
