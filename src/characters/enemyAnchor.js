// INCIDENT (2026-09-04, Mac: "bat enemies stuck in the ceiling") - WHERE
// A FOE'S SPRITE AND CAPSULE SIT RELATIVE TO THE POSITION DFU HANDS IT.
//
// DFU places an enemy's TRANSFORM (RDBLayout.cs:1537 for a marker,
// FoeSpawner/CreateFoe for a spawn) and hangs the mobile billboard on
// it CENTRED: DaggerfallMobileUnit.cs:398-411 keeps
// `transform.localPosition = Vector3.zero` for a Flying or Aquatic unit
// (and for any unit in the Idle state), and lifts a WALKER's sprite by
// `(size.y - idleSize.y) * 0.5` in every other state so its FEET stay
// put while the record grows. The port's motor keeps FEET and its
// billboard shader bottom-anchors, which is DFU's walker exactly and
// DFU's flyer half a sprite too high: a bat's marker is its centre,
// and standing its feet there put its head in the ceiling.
//
// The capsule follows SetupDemoEnemy.cs:103-115: height from the idle
// sprite, HALVED for a flyer ("assume body is the lower half",
// bottom-justified so the bottom edge stays), and never under 1.6.
import { scaledBillboardSize } from '../world/rmbFlats.js';

/** SetupDemoEnemy.cs:103-115 - the CharacterController height. */
export function enemyControllerHeight(idleH, behaviour) {
  let h = idleH;
  if (behaviour === 'Flying') h = h / 2;   // :108-110, ControllerJustification.BOTTOM
  if (h < 1.6) h = 1.6;                    // :112-114, BOTTOM again
  return h;
}

/** The idle record's scaled sprite height - dfMobile.GetSize() at setup
 *  (:104, the Idle state the unit is set up in). */
export function idleSpriteHeight(t) {
  return scaledBillboardSize(t.getSize(0), t.getScale(0)).h;
}

/** DFU's transform is the sprite's CENTRE (localPosition zero); the
 *  port's motor wants FEET. Only a unit DFU does not ground-align takes
 *  this - RDBLayout.cs:1546-1548 aligns everything but Flying. */
export function feetFromCentre(pos, idleH) {
  return [pos[0], pos[1] - idleH / 2, pos[2]];
}

/** The inverse: DFU's transform from the port's feet. WabbajackEffect.cs:90
 *  hands CreateEnemy the struck foe's transform.localPosition, and a
 *  save restores the transform it wrote - both are the sprite CENTRE,
 *  feet + idleH/2 for walker and flyer alike (the BOTTOM-justified
 *  capsule keeps the sprite bottom on the feet whatever its height). A
 *  record with no idleH (a watchman stood before it carried one) reads
 *  its capsule, which for a walker over 1.6 IS its idle height. */
export function centreFromFeet(feet, idleH) {
  return [feet[0], feet[1] + idleH / 2, feet[2]];
}

/** REVIEW 2026-09-05 (PR #55): a dungeon save written BEFORE this law
 *  holds every idle flyer's feet AT its marker - the old spawn stood
 *  them there, half a sprite too high. Such an entry carries no
 *  `anchor` stamp; when its saved feet are exactly the rebuilt spawn's
 *  feet plus half the idle sprite (the bat never moved), the rebuilt
 *  spawn is kept and the old position is not written back. A flyer
 *  that had moved restores verbatim, as DFU's SerializableEnemy does. */
export function keepRebuiltSpawn(sf, feet, idleH, behaviour) {
  if (sf.anchor != null || behaviour !== 'Flying' || idleH === undefined || !sf.feet) return false;
  const eps = 1e-3;
  return Math.abs(sf.feet[0] - feet[0]) < eps && Math.abs(sf.feet[2] - feet[2]) < eps
    && Math.abs(sf.feet[1] - (feet[1] + idleH / 2)) < eps;
}

/** DaggerfallMobileUnit.cs:398-411 as a base: a flyer or swimmer keeps
 *  its CENTRE across records (it grows half up, half down); a walker
 *  keeps its FEET. The port's shader bottom-anchors, so the walker's
 *  origin is its feet and the flyer's is centre - recordH/2. */
export function spriteOriginY(feetY, idleH, recordH, behaviour) {
  return (behaviour === 'Flying' || behaviour === 'Aquatic') ? feetY + (idleH - recordH) / 2 : feetY;
}
