// @ts-check
// TAMRIEL2-WORKER (2026-10-08, the field: "game freezes when I go outside"): THE ONE SEGMENT DISTANCE, in a module
// that imports nothing. net/gate/gateStrike.js declared it first and world/tamriel/tamrielGeography.js imported it from there -
// which dragged the whole of net/ (wire.js and twenty modules with it) into the terrain WORKER's bundle through
// the ground beyond the Bay (world/tamriel/tamrielGround.js). The worker's import graph is pure by law (EV7,
// test/world/terrain/terrainworker.test.js), so the helper lives here and both import it.

/** Distance from (px, pz) to the segment (ax, az)-(bx, bz), same units. */
export function segmentDistance(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az, len2 = vx * vx + vz * vz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / len2)) : 0;
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}
