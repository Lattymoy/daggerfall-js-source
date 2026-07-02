// Player activation ray. Verbatim Daggerfall Unity PlayerActivate
// constants (MIT, Daggerfall Workshop): the ray reaches classic's
// farthest view distance, individual targets gate on their activation
// distance (doors/default 128 * GlobalScale).
// Target picking (ours): activatables are tested as world AABBs (their
// model's transformed corner box - doors and levers are box-like), the
// nearest in-reach hit wins, and a collider raycast rejects targets
// occluded by closer world geometry.

export const GLOBAL_SCALE = 0.025;
export const RAY_DISTANCE = 3072 * GLOBAL_SCALE; // 76.8
export const DEFAULT_ACTIVATION_DISTANCE = 128 * GLOBAL_SCALE; // 3.2
export const DOOR_ACTIVATION_DISTANCE = 128 * GLOBAL_SCALE;

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
 * Pick the nearest activatable the eye ray hits within reach and sight.
 * @param {Array<{key:string, aabb:{min,max}, distance?:number}>} targets
 * @returns {string|null} target key
 */
export function pickActivatable(eye, dir, targets, collider) {
  let bestKey = null;
  let bestDist = Infinity;
  for (const target of targets) {
    const d = rayAabb(eye, dir, target.aabb);
    if (d === null || d >= bestDist) continue;
    if (d > (target.distance ?? DEFAULT_ACTIVATION_DISTANCE)) continue;
    bestKey = target.key;
    bestDist = d;
  }
  if (bestKey === null) return null;
  // Occlusion: solid world strictly in front of the target blocks it
  // (the target's own triangles sit at ~bestDist, hence the margin).
  const wall = collider.raycast(eye, dir, bestDist - 0.05);
  if (wall < bestDist - 0.05) return null;
  return bestKey;
}
