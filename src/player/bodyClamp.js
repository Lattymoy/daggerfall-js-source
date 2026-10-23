// @ts-check
// PROP-BODIES: THE PLAYER KEPT OUT OF A FLAT'S BODY (world/propBodies.js) - DUEL1's ring's shape (motor.js
// _keepInArena): not a mesh in the shared collider but a clamp after its move. Each body whose span the capsule's meets
// and whose foot circle, widened by the capsule's radius, the feet stand in puts the feet back to its edge along the line
// from its middle - so a walk into a trunk slides round it - and takes away the airborne momentum that points into it.
// A body the step BEGAN inside (a spawn, a teleport, a mount taken beside a tree) is never a trap: the feet are put
// back no deeper than they stood, so they walk out. The put-back is the collider's own move, so a wall still stops it.
// Nothing holds a body that nothing holds a wall for: a body the motor holds (a teleport's settle), the hands (a climb,
// a wall, a parkour move), or a journey's pace (CLIMB-TRAVEL's law).

/**
 * After the motor's step: the feet out of every body they stand in, one body after another (a pinch between two trunks
 * settles over the next steps, a sixtieth of a second each). `radius` the capsule's (motor.js CAPSULE_RADIUS).
 * @param {any} m the PlayerMotor @param {number} radius
 */
export function keepOffBodies(m, radius) {
  const cover = m.collider?.cover;
  if (!cover?.near || m.freezeMotor > 0 || m.climb?.isClimbing || m._wall || m._pkMove || m.travelling?.()) return;
  const prev = m._prevPos, feet = m.pos[1], top = feet + m.height;
  cover.near(m.pos, radius, (it, cx, cy, cz) => {
    if (cy >= top || cy + it.h <= feet) return;   // under the feet or over the head: a jump clears a rock
    const R = it.r + radius, dx = m.pos[0] - cx, dz = m.pos[2] - cz, d = Math.hypot(dx, dz);
    if (d >= R) return;
    const pd = Math.hypot(prev[0] - cx, prev[2] - cz);
    const to = pd >= R ? R : Math.max(d, pd);   // from outside to its edge; from inside no deeper than it stood
    if (d >= to) return;
    const nx = d > 1e-6 ? dx / d : (pd > 1e-6 ? (prev[0] - cx) / pd : 1), nz = d > 1e-6 ? dz / d : (pd > 1e-6 ? (prev[2] - cz) / pd : 0);
    const push = to - d;
    m.collider.move(m.pos, nx * push, 0, nz * push, m.height, m.grounded && !m.jumping && !m.swimming && !m.levitating);
    const into = m._airVelX * nx + m._airVelZ * nz;
    if (into < 0) { m._airVelX -= into * nx; m._airVelZ -= into * nz; }
  });
}
