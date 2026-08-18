// AUDIT 17e F24 / ONE DFU MEMBER, ONE EXPORT: WeaponManager's
// camera-frustum gate for melee (MeleeAttackDetection requires the
// target to be inside the camera view, not merely within reach and
// line of sight). The dungeon host had this inline; both exterior
// hosts passed null and cityGuards' default was ACCEPT, so a guard
// standing BEHIND the player could be hit by a swing.
//
// The default is now REJECT at the call sites that matter - a missing
// gate should fail visibly (nothing hittable) rather than silently
// widening melee to 360 degrees.

/** Build an inView(point) predicate from the live projection*view.
 *  A point is in view when it lies inside NDC with positive w. */
export function makeInView(proj, view, multiply) {
  const pv = multiply(proj, view);
  return ([x, y, z]) => {
    const w = pv[3] * x + pv[7] * y + pv[11] * z + pv[15];
    if (w <= 0) return false;
    const nx = (pv[0] * x + pv[4] * y + pv[8] * z + pv[12]) / w;
    const ny = (pv[1] * x + pv[5] * y + pv[9] * z + pv[13]) / w;
    return nx >= -1 && nx <= 1 && ny >= -1 && ny <= 1;
  };
}
