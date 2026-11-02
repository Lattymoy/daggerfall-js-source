// ═══════════════════════════════════════════════════════════════════
// WOD3 - GameObjectHelper's two GROUND ALIGNS (GameObjectHelper.cs
// :336-362), ported once. Both cast a ray straight down from 0.2 above
// the object's transform and, on a hit within `distance`, move the
// TRANSFORM - a billboard's or a controller's CENTRE - to the hit plus
// 0.52 of a height; a miss leaves it where it was. The 0.52 is the 2%
// lift that keeps a bottom off the ground plane, and the height is NOT
// always the sprite's: a billboard takes the `size` its caller hands
// in, a controller its own capsule height.
//
// The caller casts the ray (the port's collider is a host's) and hands
// in its distance, null for no hit; these answer the new centre height.
// A LEAF.
// ═══════════════════════════════════════════════════════════════════

/**
 * AlignBillboardToGround(go, size, distance = 2f) (:336-346).
 * @param {number} centreY - the billboard's transform
 * @param {?number} hitDist - the ray's distance from centreY + 0.2 to ground
 * @param {number} sizeY - the `size.y` the caller passed
 * @param {number} [distance]
 * @returns {number} the new centre height
 */
export function alignBillboardToGround(centreY, hitDist, sizeY, distance = 2) {
  if (hitDist == null || !(hitDist <= distance)) return centreY;
  return centreY + 0.2 - hitDist + sizeY * 0.52;
}

/**
 * AlignControllerToGround(controller, distance = 3f) (:348-362).
 * @param {number} centreY - the controller's transform
 * @param {?number} hitDist - the ray's distance from centreY + 0.2 to ground
 * @param {number} controllerHeight - CharacterController.height
 * @param {number} [distance]
 * @returns {number} the new centre height
 */
export function alignControllerToGround(centreY, hitDist, controllerHeight, distance = 3) {
  if (hitDist == null || !(hitDist <= distance)) return centreY;
  return centreY + 0.2 - hitDist + controllerHeight * 0.52;
}
