// @ts-check
// AUDIT FIELD-GUN-MW (2026-09-21, Mac: "needs proper rigging in 3rd and
// 1st person, proper animations. Just want you to audit it and ensure its
// perfect"): WHERE THE BARREL ENDS, off the rig itself.
//
// The classic lane knows its muzzle as a pixel of the sprite it drew
// (`weaponRig.muzzleRay`). The Morrowind lane draws no sprite: the arm's
// branch of the draw ladder returns before `drawThunderlock` runs, so the
// sprite's record was null under the arm - or a stale rect from before it
// came up - and the orb left the EYE, not the barrel, in first person and
// in third. The rig has the answer the sprite had: the weapon piece is
// posed every frame, and its muzzle is a vertex.
//
// WHICH vertex is derived, not typed: the bake put the piece's origin at
// the GRIP (FIELD-GUN-MW3 `--origin=grip`), so the muzzle is the vertex
// farthest from the origin in the piece's own frame - 47.4 units ahead of
// the hand against 5.1 behind it. No axis is assumed, so a re-bake that
// turns the mesh does not move the muzzle off the barrel.
//
// Pure, so the pins can drive both answers with matrices of their own.
import { transformPoint } from '../world/mat4.js';

/** The index of the vertex farthest from the piece's own origin (the
 *  grip), off its unposed `source`; -1 for an empty piece. */
export function farthestVertexIndex(source) {
  let best = -1, bestD = -1;
  for (let i = 0; i + 2 < source.length; i += 3) {
    const d = source[i] * source[i] + source[i + 1] * source[i + 1] + source[i + 2] * source[i + 2];
    if (d > bestD) { bestD = d; best = i / 3; }
  }
  return best;
}

/** A posed vertex, as a point. */
export function posedVertex(positions, index) {
  return [positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]];
}

/**
 * The classic muzzle's own shape - a lens-local offset in metres,
 * `{ right, up, forward }` - for a rig-space point through the pass the
 * arm drew with: its model (NIF Z-up into the pass's Y-up) and its view
 * (a lookAt from the rig's eye, so view space IS the lens: +X right, +Y
 * up, -Z ahead), divided by the rig's units to the metre.
 */
export function viewOffsetOf(point, model, view, unitsPerMetre) {
  const [x, y, z] = transformPoint(model, point[0], point[1], point[2]);
  const vx = view[0] * x + view[4] * y + view[8] * z + view[12];
  const vy = view[1] * x + view[5] * y + view[9] * z + view[13];
  const vz = view[2] * x + view[6] * y + view[10] * z + view[14];
  return { right: vx / unitsPerMetre, up: vy / unitsPerMetre, forward: -vz / unitsPerMetre };
}

/** The world point of a rig-space point through the body's model
 *  matrix (the third-person draw's own: feet, yaw, race scale, the pass
 *  basis) - `{ world }`, because behind the body a lens offset is the
 *  wrong shape. */
export function worldPointOf(point, model) {
  return transformPoint(model, point[0], point[1], point[2]);
}
