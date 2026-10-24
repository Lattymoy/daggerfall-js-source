// @ts-check
// THE GROUND ALONG A RAY - a leaf: the terrain the host draws (a collider's surfaceAt / heightAt) met by a ray, beside
// the collider's own mesh ray. Outdoors the ground is not a mesh: `raycast` never meets it (player/collider.js
// surfaceHit's own note). Indoors and underground the sampler answers -Infinity, and the floors are meshes.
// AUDIT TECH1 (2026-10-10) wrote the march for the techniques' looks (combat/techniques.js); AUDIT GROUND-BOLT
// (FIELD BUGS 2026-10-23c) moved it here, a module with no imports, so the cast engine (scenes/hostMagic.js) and a
// foe's shot (characters/enemy/enemyMotor.js) ask the one march without importing the techniques' whole runner.

/** THE GROUND'S HEIGHT at (x, z), or NaN: the terrain the host draws (the collider's surfaceAt - BLOOD1 AUDIT 3's drawn
 *  ground), else its sampler (heightAt). Outdoors the ground is not a mesh: `raycast` never meets it (player/collider.js
 *  surfaceHit's own note). Indoors and underground the sampler answers -Infinity, and the floors are meshes.
 *  @param {any} collider @param {number} x @param {number} z */
export function groundAt(collider, x, z) {
  try {
    const h = typeof collider?.surfaceAt === 'function' ? collider.surfaceAt(x, z) : collider?.heightAt?.(x, z);
    return Number.isFinite(h) ? h : NaN;
  } catch { return NaN; }
}
/** Steps the look's march takes along the ground (metres), and the halvings that refine where it crossed. */
export const GROUND_MARCH_STEP = 0.25;
const GROUND_MARCH_REFINE = 10;

/**
 * WHERE A RAY FIRST MEETS THE TERRAIN, within `max` metres: marched against groundAt, then halved down to the crossing,
 * as a distance along the unit `dir` - the first point found not above the ground, so within GROUND_MARCH_STEP / 2^10 of
 * the crossing and never short of it; Infinity when it meets none, where there is no terrain (indoors, underground) and
 * from an origin under the ground (it meets nothing it can see).
 * @param {ArrayLike<number>} origin @param {ArrayLike<number>} dir @param {number} max @param {any} collider
 */
export function groundHit(origin, dir, max, collider) {
  if (!Number.isFinite(groundAt(collider, origin[0], origin[2]))) return Infinity;   // no terrain here (indoors, underground)
  const above = (/** @type {number} */ t) => {
    const g = groundAt(collider, origin[0] + dir[0] * t, origin[2] + dir[2] * t);
    return !Number.isFinite(g) || origin[1] + dir[1] * t > g;
  };
  if (!above(0)) return Infinity;   // an origin under the ground meets nothing it can see
  for (let t = GROUND_MARCH_STEP, prev = 0; prev < max; prev = t, t = Math.min(max, t + GROUND_MARCH_STEP)) {
    if (above(t)) { if (t >= max) break; continue; }
    let lo = prev, hi = t;
    for (let i = 0; i < GROUND_MARCH_REFINE; i++) { const mid = (lo + hi) / 2; if (above(mid)) lo = mid; else hi = mid; }
    return hi;
  }
  return Infinity;
}

/**
 * WHERE A RAY FIRST MEETS THE WORLD, within `max` metres: the nearer of the collider's meshes (`raycast` - a wall, a
 * floor indoors, a building) and the terrain (groundHit), as a distance along the unit `dir`; Infinity when it meets
 * neither. AUDIT TECH1 (2026-10-10): every look a technique casts reads this - a mesh ray alone never met the outdoor
 * ground, so every Volley and every ground leap outdoors answered "Out of reach".
 * @param {ArrayLike<number>} origin @param {ArrayLike<number>} dir @param {number} max @param {any} collider
 */
export function rayHit(origin, dir, max, collider) {
  let best = Infinity;
  try { const m = collider?.raycast?.(origin, dir, max); if (Number.isFinite(m) && m >= 0) best = m; } catch { /* no meshes */ }
  return Math.min(best, groundHit(origin, dir, Math.min(max, best), collider));
}
