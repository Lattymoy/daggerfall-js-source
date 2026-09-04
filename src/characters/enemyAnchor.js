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

/** DaggerfallMobileUnit.cs:398-411 as a base: a flyer or swimmer keeps
 *  its CENTRE across records (it grows half up, half down); a walker
 *  keeps its FEET. The port's shader bottom-anchors, so the walker's
 *  origin is its feet and the flyer's is centre - recordH/2. */
export function spriteOriginY(feetY, idleH, recordH, behaviour) {
  return (behaviour === 'Flying' || behaviour === 'Aquatic') ? feetY + (idleH - recordH) / 2 : feetY;
}
