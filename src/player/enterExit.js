// Building enter/exit spawn math, 1:1 with Daggerfall Unity's
// PlayerEnterExit / DaggerfallStaticDoors (MIT, Daggerfall Workshop):
//   - Entering: checkPosition = the activated exterior door's world
//     position, snapped to the closest interior ENTER marker when one
//     exists; the landing is the closest INTERIOR static door to that
//     point, pushed along the door normal by (playerRadius + 0.4) =
//     0.75; the marker fallback lands at marker + up * (height * 0.6).
//   - Exiting: the closest EXTERIOR static door of the building, pushed
//     along its normal by (playerRadius * 3) = 1.05.
// Static-door geometry is stored in FINAL mesh space - meshReader
// scales and Y-negates the door plane verts exactly like positions -
// so world transforms apply the door's matrix directly (verified
// numerically: model 444's door centre lands halfway up its 14.45-unit
// gate only without re-scaling).

import { CAPSULE_RADIUS, CAPSULE_HEIGHT } from '../player/motor.js';

export const ENTER_DOOR_OFFSET = CAPSULE_RADIUS + 0.4; // 0.75
export const EXIT_DOOR_OFFSET = CAPSULE_RADIUS * 3; // 1.05
export const MARKER_UP_OFFSET = CAPSULE_HEIGHT * 0.6; // 1.08

/** World position of a static door's centre under its matrix. */
export function doorWorldPosition(door) {
  const m = door.matrix;
  const x = door.centre.x;
  const y = door.centre.y;
  const z = door.centre.z;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

/** World-space unit normal of a static door (rotation only, Y negated). */
export function doorWorldNormal(door) {
  const m = door.matrix;
  const nx = door.normal.x;
  const ny = door.normal.y;
  const nz = door.normal.z;
  const x = m[0] * nx + m[4] * ny + m[8] * nz;
  const y = m[1] * nx + m[5] * ny + m[9] * nz;
  const z = m[2] * nx + m[6] * ny + m[10] * nz;
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

/** World AABB of a static door trigger volume (for activation picking). */
export function doorWorldAabb(door) {
  const c = doorWorldPosition(door);
  const h = [
    door.size.x / 2 + 0.25,
    door.size.y / 2 + 0.25,
    door.size.z / 2 + 0.25,
  ];
  // The size triple is axis-agnostic (thickness-major); padding an
  // axis-aligned box around the centre covers any door orientation.
  const e = Math.max(h[0], h[2]);
  return {
    min: [c[0] - e, c[1] - h[1], c[2] - e],
    max: [c[0] + e, c[1] + h[1], c[2] + e],
  };
}

function closest(points, p) {
  let best = null;
  let bestD = Infinity;
  for (const point of points) {
    const dx = point.pos[0] - p[0];
    const dy = point.pos[1] - p[1];
    const dz = point.pos[2] - p[2];
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestD) { bestD = d; best = point; }
  }
  return best;
}

/**
 * Verbatim TransitionInterior landing: exterior door world pos ->
 * closest enter marker -> closest interior door + normal * 0.75, with
 * the marker + up * 1.08 fallback.
 * @param {Array<[x,y,z]>} enterMarkers interior-space positions
 * @param {Array} interiorDoors staticDoors of the interior layout
 * @returns {[x,y,z]|null}
 */
export function interiorLanding(exteriorDoorPos, enterMarkers, interiorDoors) {
  let check = exteriorDoorPos;
  const markers = enterMarkers.map((m) => ({ pos: m }));
  const marker = closest(markers, check);
  if (marker) check = marker.pos;
  const doors = interiorDoors.map((d) => ({
    pos: doorWorldPosition(d),
    normal: doorWorldNormal(d),
  }));
  const door = closest(doors, check);
  if (door) {
    return [
      door.pos[0] + door.normal[0] * ENTER_DOOR_OFFSET,
      door.pos[1] + door.normal[1] * ENTER_DOOR_OFFSET,
      door.pos[2] + door.normal[2] * ENTER_DOOR_OFFSET,
    ];
  }
  if (marker) {
    return [marker.pos[0], marker.pos[1] + MARKER_UP_OFFSET, marker.pos[2]];
  }
  return null;
}

/** Verbatim TransitionExterior landing: closest building door + n * 1.05. */
export function exteriorLanding(playerPos, buildingDoors) {
  const doors = buildingDoors.map((d) => ({
    pos: doorWorldPosition(d),
    normal: doorWorldNormal(d),
  }));
  const door = closest(doors, playerPos);
  if (!door) return null;
  return [
    door.pos[0] + door.normal[0] * EXIT_DOOR_OFFSET,
    door.pos[1] + door.normal[1] * EXIT_DOOR_OFFSET,
    door.pos[2] + door.normal[2] * EXIT_DOOR_OFFSET,
  ];
}
